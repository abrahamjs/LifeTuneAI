import os
from datetime import datetime, timedelta
from flask import Flask, render_template, jsonify, request, redirect, url_for, flash
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import openai
import json
from database import db
from models import User, Goal, Task, Habit, HabitLog, VoiceNote, UserAnalytics, AIInsight
from services.analytics import AnalyticsService
from config.settings import AUTH_REQUIRED

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "development_key")
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB max file size
db.init_app(app)

# Set OpenAI API key
openai.api_key = os.environ.get("OPENAI_API_KEY")

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

def get_or_create_test_user():
    test_user = User.query.filter_by(email='test@example.com').first()
    if not test_user:
        test_user = User(
            username='test_user',
            email='test@example.com',
            password_hash='mock_hash'
        )
        db.session.add(test_user)
        db.session.commit()
    return test_user

def login_required_if_enabled(f):
    if AUTH_REQUIRED:
        return login_required(f)
    def wrapped(*args, **kwargs):
        if not current_user.is_authenticated:
            user = get_or_create_test_user()
            login_user(user)
        return f(*args, **kwargs)
    wrapped.__name__ = f.__name__
    return wrapped

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            flash('Logged in successfully!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid email or password', 'error')
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        
        if User.query.filter_by(username=username).first():
            flash('Username already exists', 'error')
            return render_template('register.html')
            
        if User.query.filter_by(email=email).first():
            flash('Email already registered', 'error')
            return render_template('register.html')
        
        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password)
        )
        db.session.add(user)
        db.session.commit()
        
        login_user(user)
        flash('Registration successful!', 'success')
        return redirect(url_for('dashboard'))
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out', 'success')
    return redirect(url_for('login'))

@app.route('/profile')
@login_required
def profile():
    return render_template('profile.html')

@app.route('/')
@login_required_if_enabled
def dashboard():
    # Generate fresh analytics before showing dashboard
    AnalyticsService.calculate_daily_analytics(current_user.id)
    insights = AnalyticsService.get_user_insights(current_user.id)
    return render_template('dashboard.html', insights=insights)

@app.route('/goals')
@login_required_if_enabled
def goals():
    return render_template('goals.html')

@app.route('/tasks')
@login_required_if_enabled
def tasks():
    return render_template('tasks.html')

@app.route('/habits')
@login_required_if_enabled
def habits():
    return render_template('habits.html')

@app.route('/analytics')
@login_required_if_enabled
def analytics():
    return render_template('analytics.html')

@app.route('/api/goals/<int:goal_id>', methods=['GET', 'DELETE', 'PUT'])
@login_required_if_enabled
def manage_goal(goal_id):
    goal = Goal.query.get_or_404(goal_id)
    if goal.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if request.method == 'DELETE':
        db.session.delete(goal)
        db.session.commit()
        return jsonify({'status': 'success'})
    
    elif request.method == 'PUT':
        data = request.get_json()
        goal.title = data['title']
        goal.description = data['description']
        goal.category = data['category']
        goal.target_date = datetime.strptime(data['target_date'], '%Y-%m-%d')
        db.session.commit()
        return jsonify({'status': 'success'})
    
    # GET method
    return jsonify({
        'id': goal.id,
        'title': goal.title,
        'description': goal.description,
        'progress': goal.progress,
        'category': goal.category,
        'created_at': goal.created_at.isoformat(),
        'target_date': goal.target_date.isoformat(),
        'tasks': [{
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'priority': task.priority,
            'completed': task.completed,
            'due_date': task.due_date.isoformat() if task.due_date else None
        } for task in goal.tasks]
    })

@app.route('/api/goals/suggest-tasks', methods=['POST'])
@login_required_if_enabled
def suggest_tasks():
    data = request.get_json()
    goal_title = data.get('title', '')
    goal_description = data.get('description', '')
    
    try:
        completion = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a goal planning assistant. Generate 5 specific, actionable tasks that will help achieve the goal. Format your response as a JSON array where each task has 'title' (short, action-oriented) and 'description' (detailed explanation) fields."},
                {"role": "user", "content": f"Generate specific, actionable tasks for this goal: {goal_title}. Additional context: {goal_description}"}
            ]
        )
        
        tasks_str = completion.choices[0].message.content.strip()
        # Handle cases where response might include markdown code blocks
        if '```json' in tasks_str:
            tasks_str = tasks_str.split('```json')[1].split('```')[0]
        elif '```' in tasks_str:
            tasks_str = tasks_str.split('```')[1].split('```')[0]
            
        tasks = json.loads(tasks_str)
        # Ensure response is an array
        if not isinstance(tasks, list):
            tasks = tasks.get('tasks', [])
            
        return jsonify(tasks)
    except Exception as e:
        print(f"Error generating tasks: {str(e)}")
        return jsonify({'error': 'Failed to generate tasks'}), 500

@app.route('/api/goals', methods=['GET', 'POST'])
@login_required_if_enabled
def handle_goals():
    if request.method == 'POST':
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['title', 'description', 'target_date', 'category']
        if not all(field in data for field in required_fields):
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields'
            }), 400
            
        try:
            target_date = datetime.strptime(data['target_date'], '%Y-%m-%d')
            
            # Start database transaction
            goal = Goal(
                title=data['title'],
                description=data['description'],
                target_date=target_date,
                category=data['category'],
                user_id=current_user.id
            )
            db.session.add(goal)
            db.session.flush()  # This gives us the goal.id
            
            # Create associated tasks
            if 'tasks' in data:
                for task_data in data['tasks']:
                    if not isinstance(task_data, dict) or 'title' not in task_data:
                        raise ValueError('Invalid task data structure')
                        
                    task = Task(
                        title=task_data['title'],
                        description=task_data.get('description', ''),
                        priority=task_data.get('priority', 'normal'),
                        due_date=target_date,  # Default to goal target date
                        user_id=current_user.id,
                        goal_id=goal.id
                    )
                    db.session.add(task)
            
            db.session.commit()
            return jsonify({
                'status': 'success',
                'goal_id': goal.id
            })
            
        except ValueError as e:
            db.session.rollback()
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 400
        except Exception as e:
            db.session.rollback()
            print(f"Error creating goal: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': 'An error occurred while creating the goal'
            }), 500
    
    goals = Goal.query.filter_by(user_id=current_user.id).all()
    return jsonify([{
        'id': g.id,
        'title': g.title,
        'progress': g.progress,
        'category': g.category
    } for g in goals])

@app.route('/api/tasks', methods=['GET', 'POST'])
@login_required_if_enabled
def handle_tasks():
    if request.method == 'POST':
        data = request.get_json()
        task = Task(
            title=data['title'],
            description=data['description'],
            priority=data['priority'],
            due_date=datetime.strptime(data['due_date'], '%Y-%m-%d'),
            user_id=current_user.id
        )
        db.session.add(task)
        db.session.commit()
        return jsonify({'status': 'success'})
    
    tasks = Task.query.filter_by(user_id=current_user.id).all()
    return jsonify([{
        'id': t.id,
        'title': t.title,
        'priority': t.priority,
        'completed': t.completed
    } for t in tasks])

@app.route('/api/habits', methods=['GET', 'POST'])
@login_required_if_enabled
def handle_habits():
    if request.method == 'POST':
        data = request.get_json()
        habit = Habit(
            title=data['title'],
            description=data['description'],
            frequency=data['frequency'],
            user_id=current_user.id
        )
        db.session.add(habit)
        db.session.commit()
        return jsonify({'status': 'success'})
    
    habits = Habit.query.filter_by(user_id=current_user.id).all()
    return jsonify([{
        'id': h.id,
        'title': h.title,
        'current_streak': h.current_streak,
        'best_streak': h.best_streak
    } for h in habits])

@app.route('/api/analytics/insights', methods=['GET'])
@login_required_if_enabled
def get_insights():
    # Generate fresh insights
    AnalyticsService.generate_insights(current_user.id)
    insights = AnalyticsService.get_user_insights(current_user.id)
    
    return jsonify([{
        'id': i.id,
        'type': i.insight_type,
        'content': i.content,
        'recommendations': i.recommendations,
        'created_at': i.created_at.isoformat()
    } for i in insights])

@app.route('/api/analytics/trends', methods=['GET'])
@login_required_if_enabled
def get_analytics_trends():
    trends = AnalyticsService.get_productivity_trends(current_user.id)
    completion_rates = AnalyticsService.get_completion_rate_by_priority(current_user.id)
    
    return jsonify({
        'productivity': trends,
        'completion_rates': completion_rates
    })

@app.route('/api/voice-notes', methods=['GET', 'POST'])
@login_required_if_enabled
def handle_voice_notes():
    if request.method == 'POST':
        data = request.get_json()
        voice_note = VoiceNote(
            transcription=data['transcription'],
            note_type=data['note_type'],
            user_id=current_user.id
        )
        db.session.add(voice_note)
        db.session.commit()
        return jsonify({'status': 'success', 'id': voice_note.id})
    
    voice_notes = VoiceNote.query.filter_by(user_id=current_user.id).all()
    return jsonify([{
        'id': n.id,
        'transcription': n.transcription,
        'note_type': n.note_type,
        'created_at': n.created_at.isoformat()
    } for n in voice_notes])

@app.route('/api/reset-data', methods=['POST'])
@login_required_if_enabled
def reset_data():
    with app.app_context():
        db.drop_all()
        db.create_all()
        get_or_create_test_user()
    return jsonify({'status': 'success'})

with app.app_context():
    db.create_all()
    get_or_create_test_user()
