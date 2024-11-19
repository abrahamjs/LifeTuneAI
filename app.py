import os
import random
from datetime import datetime, timedelta
from flask import Flask, render_template, jsonify, request, redirect, url_for, flash
from flask_login import LoginManager, login_user, logout_user, login_required, current_user, AnonymousUserMixin
from werkzeug.security import generate_password_hash, check_password_hash
import openai
from database import db
from models import User, Goal, Task, Habit, HabitLog, VoiceNote, UserAnalytics, AIInsight
from services.analytics import AnalyticsService
from config.settings import AUTH_REQUIRED

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "a secret key"
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

def create_dummy_data():
    # Check if dummy data already exists
    if User.query.filter_by(email='test@example.com').first():
        return

    # Create test user
    test_user = get_or_create_test_user()
    
    # Create dummy goals
    goals = [
        Goal(title="Learn Python", description="Master Python programming", target_date=datetime.utcnow() + timedelta(days=30), progress=65, category="education", user_id=test_user.id),
        Goal(title="Exercise Routine", description="Establish workout habit", target_date=datetime.utcnow() + timedelta(days=60), progress=40, category="health", user_id=test_user.id),
        Goal(title="Reading Challenge", description="Read 12 books this year", target_date=datetime.utcnow() + timedelta(days=90), progress=75, category="personal", user_id=test_user.id)
    ]
    
    # Create dummy tasks
    tasks = [
        Task(title="Complete Project Documentation", description="Write technical docs", priority="urgent", due_date=datetime.utcnow() + timedelta(days=2), user_id=test_user.id),
        Task(title="Weekly Team Meeting", description="Discuss progress", priority="important", due_date=datetime.utcnow() + timedelta(days=1), completed=True, user_id=test_user.id),
        Task(title="Review Code PR", description="Review team's code", priority="normal", due_date=datetime.utcnow() + timedelta(days=3), user_id=test_user.id)
    ]
    
    # Create dummy habits
    habits = [
        Habit(title="Morning Meditation", description="15 minutes meditation", frequency="daily", current_streak=5, best_streak=10, user_id=test_user.id),
        Habit(title="Exercise", description="30 minutes workout", frequency="daily", current_streak=3, best_streak=15, user_id=test_user.id),
        Habit(title="Reading", description="Read for 30 minutes", frequency="daily", current_streak=7, best_streak=7, user_id=test_user.id)
    ]
    
    # Create dummy analytics
    for i in range(7):
        date = datetime.utcnow().date() - timedelta(days=i)
        analytics = UserAnalytics(
            user_id=test_user.id,
            date=date,
            productivity_score=random.randint(65, 95),
            tasks_completed=random.randint(3, 8),
            goals_progress=random.randint(50, 90),
            active_habits=random.randint(2, 3),
            focus_time=random.randint(120, 240)
        )
        db.session.add(analytics)
    
    # Create dummy insights
    insights = [
        AIInsight(
            user_id=test_user.id,
            insight_type="productivity",
            content="Your productivity has increased by 15% this week. Great job maintaining focus during work sessions!",
            recommendations="Try to take regular breaks to maintain this momentum.",
            created_at=datetime.utcnow() - timedelta(hours=2)
        ),
        AIInsight(
            user_id=test_user.id,
            insight_type="habits",
            content="Your meditation streak is building nicely. You've been consistent with morning meditation for 5 days.",
            recommendations="Consider increasing session duration to 20 minutes for better results.",
            created_at=datetime.utcnow() - timedelta(hours=1)
        )
    ]
    
    # Add all dummy data
    db.session.add_all(goals + tasks + habits + insights)
    db.session.commit()

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
    if not AUTH_REQUIRED:
        user = get_or_create_test_user()
        login_user(user)
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            return redirect(url_for('dashboard'))
        flash('Invalid email or password')
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if not AUTH_REQUIRED:
        return redirect(url_for('login'))

    if request.method == 'POST':
        email = request.form.get('email')
        username = request.form.get('username')
        password = request.form.get('password')
        
        if User.query.filter_by(email=email).first():
            flash('Email already registered')
            return redirect(url_for('register'))
            
        if User.query.filter_by(username=username).first():
            flash('Username already taken')
            return redirect(url_for('register'))
            
        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password)
        )
        db.session.add(user)
        db.session.commit()
        login_user(user)
        return redirect(url_for('dashboard'))
    return render_template('register.html')

@app.route('/logout')
@login_required_if_enabled
def logout():
    logout_user()
    return redirect(url_for('login'))

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

@app.route('/api/goals', methods=['GET', 'POST'])
@login_required_if_enabled
def handle_goals():
    if request.method == 'POST':
        data = request.json
        goal = Goal(
            title=data['title'],
            description=data['description'],
            target_date=datetime.strptime(data['target_date'], '%Y-%m-%d'),
            category=data['category'],
            user_id=current_user.id
        )
        db.session.add(goal)
        db.session.commit()
        return jsonify({'status': 'success'})
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
        data = request.json
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
        data = request.json
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
    insights = AnalyticsService.get_user_insights(current_user.id)
    return jsonify([{
        'id': i.id,
        'type': i.insight_type,
        'content': i.content,
        'recommendations': i.recommendations,
        'created_at': i.created_at.isoformat()
    } for i in insights])

@app.route('/api/analytics/acknowledge-insight/<int:insight_id>', methods=['POST'])
@login_required_if_enabled
def acknowledge_insight(insight_id):
    insight = AIInsight.query.get_or_404(insight_id)
    if insight.user_id != current_user.id:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 403
    insight.is_acknowledged = True
    db.session.commit()
    return jsonify({'status': 'success'})

@app.route('/api/voice-notes', methods=['GET', 'POST'])
@login_required_if_enabled
def handle_voice_notes():
    if request.method == 'POST':
        data = request.json
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

@app.route('/api/transcribe', methods=['POST'])
@login_required_if_enabled
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
    
    audio_file = request.files['audio']
    if not audio_file:
        return jsonify({'error': 'Empty audio file'}), 400

    try:
        temp_path = f"/tmp/{datetime.now().timestamp()}.wav"
        audio_file.save(temp_path)
        
        with open(temp_path, 'rb') as audio:
            response = openai.audio.transcriptions.create(
                model="whisper-1",
                file=audio
            )
        
        os.remove(temp_path)
        return jsonify({'text': response.text})
    except Exception as e:
        print(f"Whisper API error: {str(e)}")
        return jsonify({'error': 'Speech recognition failed. Please try again.'}), 500

@app.route('/api/analytics/trends')
@login_required_if_enabled
def get_analytics_trends():
    trends = AnalyticsService.get_productivity_trends(current_user.id)
    completion_rates = AnalyticsService.get_completion_rate_by_priority(current_user.id)
    return jsonify({
        'productivity': trends,
        'completion_rates': completion_rates
    })

with app.app_context():
    db.create_all()
    create_dummy_data()