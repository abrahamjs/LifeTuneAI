from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from models import User, Task, Goal, Habit, UserAnalytics, AIInsight, Achievement, DailyChallenge, HabitLog
from database import db
from config.settings import AUTH_REQUIRED
from services.analytics import AnalyticsService
from services.gamification import GamificationService, GamificationError
import os
from sqlalchemy.exc import SQLAlchemyError

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

def login_required_if_enabled(f):
    if AUTH_REQUIRED:
        return login_required(f)
    return f

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.before_request
def create_tables():
    db.create_all()

@app.route('/')
@login_required_if_enabled
def dashboard():
    return render_template('dashboard.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
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
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        
        if User.query.filter_by(email=email).first():
            flash('Email already registered')
            return render_template('register.html')
            
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

# API Routes
@app.route('/api/goals', methods=['GET', 'POST'])
@login_required_if_enabled
def api_goals():
    if request.method == 'POST':
        data = request.get_json()
        goal = Goal(
            title=data['title'],
            description=data['description'],
            category=data['category'],
            target_date=datetime.strptime(data['target_date'], '%Y-%m-%d'),
            user_id=current_user.id if AUTH_REQUIRED else 1
        )
        db.session.add(goal)
        db.session.commit()
        
        # Create associated tasks if provided
        if 'tasks' in data:
            for task_data in data['tasks']:
                task = Task(
                    title=task_data['title'],
                    description=task_data['description'],
                    user_id=current_user.id if AUTH_REQUIRED else 1,
                    goal_id=goal.id
                )
                db.session.add(task)
            db.session.commit()
            
        return jsonify({'status': 'success'})
        
    goals = Goal.query.filter_by(
        user_id=current_user.id if AUTH_REQUIRED else 1
    ).all()
    return jsonify([{
        'id': goal.id,
        'title': goal.title,
        'description': goal.description,
        'category': goal.category,
        'progress': goal.progress,
        'target_date': goal.target_date.isoformat(),
        'created_at': goal.created_at.isoformat()
    } for goal in goals])

@app.route('/api/goals/<int:goal_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required_if_enabled
def manage_goal(goal_id):
    goal = Goal.query.get_or_404(goal_id)
    if AUTH_REQUIRED and goal.user_id != current_user.id:
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
        'category': goal.category,
        'progress': goal.progress,
        'target_date': goal.target_date.isoformat(),
        'created_at': goal.created_at.isoformat(),
        'tasks': [{
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'priority': task.priority,
            'completed': task.completed
        } for task in goal.tasks]
    })

@app.route('/api/tasks', methods=['GET', 'POST'])
@login_required_if_enabled
def api_tasks():
    if request.method == 'POST':
        data = request.get_json()
        task = Task(
            title=data['title'],
            description=data['description'],
            priority=data['priority'],
            due_date=datetime.strptime(data['due_date'], '%Y-%m-%d') if data['due_date'] else None,
            user_id=current_user.id if AUTH_REQUIRED else 1
        )
        db.session.add(task)
        db.session.commit()
        return jsonify({'status': 'success'})
        
    tasks = Task.query.filter_by(
        user_id=current_user.id if AUTH_REQUIRED else 1
    ).all()
    return jsonify([{
        'id': task.id,
        'title': task.title,
        'description': task.description,
        'priority': task.priority,
        'completed': task.completed,
        'due_date': task.due_date.isoformat() if task.due_date else None
    } for task in tasks])

@app.route('/api/tasks/<int:task_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required_if_enabled
def manage_task(task_id):
    task = Task.query.get_or_404(task_id)
    if AUTH_REQUIRED and task.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
        
    if request.method == 'DELETE':
        db.session.delete(task)
        db.session.commit()
        return jsonify({'status': 'success'})
        
    elif request.method == 'PUT':
        data = request.get_json()
        was_completed = task.completed
        task.title = data['title']
        task.description = data['description']
        task.priority = data['priority']
        task.due_date = datetime.strptime(data['due_date'], '%Y-%m-%d') if data['due_date'] else None
        task.completed = data['completed']
        
        # Process task completion for gamification
        if not was_completed and task.completed:
            task.completed_at = datetime.utcnow()
            try:
                success, xp_gained = GamificationService.process_task_completion(task.user_id, task)
                if not success:
                    raise GamificationError("Failed to process task completion rewards")
                
                # Update related goal progress
                if task.goal_id:
                    goal = Goal.query.get(task.goal_id)
                    if goal:
                        goal_tasks = Task.query.filter_by(goal_id=goal.id).count()
                        completed_tasks = Task.query.filter_by(
                            goal_id=goal.id,
                            completed=True
                        ).count()
                        
                        old_progress = goal.progress
                        goal.progress = int((completed_tasks / goal_tasks) * 100)
                        
                        # Check if goal was completed
                        if old_progress < 100 and goal.progress == 100:
                            try:
                                success, message = GamificationService.process_goal_completion(goal.user_id, goal)
                                if not success:
                                    raise GamificationError(message)
                            except GamificationError as e:
                                print(f"Error processing goal completion: {str(e)}")
            except GamificationError as e:
                print(f"Error in task completion gamification: {str(e)}")
        
        db.session.commit()
        return jsonify({'status': 'success'})
        
    # GET method
    return jsonify({
        'id': task.id,
        'title': task.title,
        'description': task.description,
        'priority': task.priority,
        'due_date': task.due_date.isoformat() if task.due_date else None,
        'completed': task.completed,
        'created_at': task.created_at.isoformat(),
        'completed_at': task.completed_at.isoformat() if task.completed_at else None,
        'goal_id': task.goal_id
    })

@app.route('/api/gamification/profile', methods=['GET'])
@login_required_if_enabled
def get_gamification_profile():
    try:
        user_id = current_user.id if AUTH_REQUIRED else 1
        user = User.query.get_or_404(user_id)
        
        # Update streak and multiplier
        try:
            success, message = GamificationService.update_streak_and_multiplier(user_id)
            if not success:
                raise GamificationError(message)
        except GamificationError as e:
            print(f"Error updating streak: {str(e)}")
        
        # Get achievements
        achievements = Achievement.query.filter_by(user_id=user_id).all()
        
        # Get daily challenges
        today = datetime.utcnow().date()
        challenges = DailyChallenge.query.filter_by(
            user_id=user_id,
            date=today
        ).all()
        
        # Calculate XP needed for next level
        current_level = user.level
        xp_for_next = GamificationService.get_level_threshold(current_level + 1)
        xp_progress = (user.experience_points - GamificationService.get_level_threshold(current_level)) / (xp_for_next - GamificationService.get_level_threshold(current_level)) * 100
        
        return jsonify({
            'level': user.level,
            'experience_points': user.experience_points,
            'xp_progress': xp_progress,
            'xp_needed': xp_for_next - user.experience_points,
            'daily_streak': user.daily_streak,
            'multiplier': user.current_multiplier,
            'achievements': [{
                'name': a.name,
                'description': a.description,
                'badge_type': a.badge_type,
                'earned_at': a.earned_at.isoformat(),
                'points_awarded': a.points_awarded
            } for a in achievements],
            'daily_challenges': [{
                'type': c.challenge_type,
                'current': c.current_value,
                'target': c.target_value,
                'reward': c.reward_points,
                'completed': c.completed
            } for c in challenges]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/gamification/purchase-reward', methods=['POST'])
@login_required_if_enabled
def purchase_reward():
    try:
        user_id = current_user.id if AUTH_REQUIRED else 1
        user = User.query.get_or_404(user_id)
        
        data = request.get_json()
        reward_id = data.get('reward_id')
        
        # Get reward details
        rewards = {
            1: {'name': 'Custom Theme', 'cost': 1000},
            2: {'name': 'Premium Badge', 'cost': 2000},
            3: {'name': 'Bonus Multiplier', 'cost': 3000}
        }
        
        reward = rewards.get(reward_id)
        if not reward:
            return jsonify({
                'status': 'error',
                'message': 'Invalid reward'
            }), 400
            
        # Check if user has enough points
        if user.experience_points < reward['cost']:
            return jsonify({
                'status': 'error',
                'message': 'Not enough points'
            }), 400
            
        try:
            # Process reward
            user.experience_points -= reward['cost']
            
            # Apply reward effects
            if reward_id == 3:  # Bonus Multiplier
                user.current_multiplier = min(user.current_multiplier * 2, 4.0)  # Cap at 4x
                
            db.session.commit()
            return jsonify({'status': 'success'})
        except SQLAlchemyError as e:
            db.session.rollback()
            return jsonify({
                'status': 'error',
                'message': 'Database error while processing reward'
            }), 500
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/habits/<int:habit_id>/check-in', methods=['POST'])
@login_required_if_enabled
def habit_check_in(habit_id):
    habit = Habit.query.get_or_404(habit_id)
    if AUTH_REQUIRED and habit.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Create habit log entry
    log_entry = HabitLog(habit_id=habit.id)
    db.session.add(log_entry)
    
    # Update streak
    habit.current_streak += 1
    if habit.current_streak > habit.best_streak:
        habit.best_streak = habit.current_streak
    
    # Process habit streak for gamification
    GamificationService.process_habit_streak(habit.user_id, habit)
    
    db.session.commit()
    return jsonify({'status': 'success'})

@app.route('/api/habits', methods=['GET', 'POST'])
@login_required_if_enabled
def api_habits():
    if request.method == 'POST':
        data = request.get_json()
        habit = Habit(
            title=data['title'],
            description=data['description'],
            frequency=data['frequency'],
            user_id=current_user.id if AUTH_REQUIRED else 1
        )
        db.session.add(habit)
        db.session.commit()
        return jsonify({'status': 'success'})
        
    habits = Habit.query.filter_by(
        user_id=current_user.id if AUTH_REQUIRED else 1
    ).all()
    return jsonify([{
        'id': habit.id,
        'title': habit.title,
        'description': habit.description,
        'frequency': habit.frequency,
        'current_streak': habit.current_streak,
        'best_streak': habit.best_streak
    } for habit in habits])

# Analytics API Routes
@app.route('/api/analytics/insights')
@login_required_if_enabled
def get_analytics_insights():
    user_id = current_user.id if AUTH_REQUIRED else 1
    insights = AnalyticsService.get_user_insights(user_id)
    return jsonify([{
        'id': insight.id,
        'type': insight.insight_type,
        'content': insight.content,
        'recommendations': insight.recommendations,
        'created_at': insight.created_at.isoformat()
    } for insight in insights])

@app.route('/api/analytics/trends')
@login_required_if_enabled
def get_analytics_trends():
    user_id = current_user.id if AUTH_REQUIRED else 1
    
    # Calculate daily analytics
    AnalyticsService.calculate_daily_analytics(user_id)
    
    # Get productivity trends
    trends = AnalyticsService.get_productivity_trends(user_id)
    
    # Get completion rates by priority
    completion_rates = AnalyticsService.get_completion_rate_by_priority(user_id)
    
    return jsonify({
        'productivity': trends,
        'completion_rates': completion_rates
    })

@app.route('/api/analytics/acknowledge-insight/<int:insight_id>', methods=['POST'])
@login_required_if_enabled
def acknowledge_insight(insight_id):
    insight = AIInsight.query.get_or_404(insight_id)
    if AUTH_REQUIRED and insight.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
        
    insight.is_acknowledged = True
    db.session.commit()
    return jsonify({'status': 'success'})

@app.route('/api/reset-data', methods=['POST'])
@login_required_if_enabled
def reset_analytics_data():
    user_id = current_user.id if AUTH_REQUIRED else 1
    
    # Clear existing analytics data
    UserAnalytics.query.filter_by(user_id=user_id).delete()
    AIInsight.query.filter_by(user_id=user_id).delete()
    db.session.commit()
    
    # Recalculate analytics
    AnalyticsService.calculate_daily_analytics(user_id)
    AnalyticsService.generate_insights(user_id)
    
    return jsonify({'status': 'success'})

# Add these new routes after the existing routes

@app.route('/profile')
@login_required_if_enabled
def profile():
    return render_template('profile.html')

@app.route('/api/social/follow/<int:user_id>', methods=['POST'])
@login_required_if_enabled
def follow_user(user_id):
    try:
        if user_id == current_user.id:
            return jsonify({'status': 'error', 'message': 'Cannot follow yourself'}), 400
            
        user_to_follow = User.query.get_or_404(user_id)
        if current_user.follow(user_to_follow):
            db.session.commit()
            return jsonify({
                'status': 'success',
                'message': f'You are now following {user_to_follow.username}'
            })
        return jsonify({'status': 'error', 'message': 'Already following this user'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/social/unfollow/<int:user_id>', methods=['POST'])
@login_required_if_enabled
def unfollow_user(user_id):
    try:
        user_to_unfollow = User.query.get_or_404(user_id)
        if current_user.unfollow(user_to_unfollow):
            db.session.commit()
            return jsonify({
                'status': 'success',
                'message': f'You have unfollowed {user_to_unfollow.username}'
            })
        return jsonify({'status': 'error', 'message': 'Not following this user'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/social/leaderboard')
@login_required_if_enabled
def get_leaderboard():
    try:
        users = User.query.order_by(User.experience_points.desc()).limit(10).all()
        return jsonify([{
            'id': user.id,
            'username': user.username,
            'level': user.level,
            'experience_points': user.experience_points,
            'achievements_count': Achievement.query.filter_by(user_id=user.id).count(),
            'is_following': current_user.is_following(user) if AUTH_REQUIRED else False
        } for user in users])
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/social/settings', methods=['GET', 'PUT'])
@login_required_if_enabled
def manage_social_settings():
    try:
        if request.method == 'PUT':
            data = request.get_json()
            current_user.profile_visibility = data['profile_visibility']
            current_user.shared_achievements = data['shared_achievements']
            current_user.shared_goals = data['shared_goals']
            db.session.commit()
            return jsonify({'status': 'success'})
            
        return jsonify({
            'profile_visibility': current_user.profile_visibility,
            'shared_achievements': current_user.shared_achievements,
            'shared_goals': current_user.shared_goals
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/social/profile/<int:user_id>')
@login_required_if_enabled
def get_social_profile(user_id):
    try:
        user = User.query.get_or_404(user_id)
        current_user_id = current_user.id if AUTH_REQUIRED else 1

        # Check visibility settings
        if user.profile_visibility == 'private' and user.id != current_user_id:
            return jsonify({
                'status': 'error',
                'message': 'This profile is private'
            }), 403

        if user.profile_visibility == 'friends' and not current_user.is_following(user) and user.id != current_user_id:
            return jsonify({
                'status': 'error',
                'message': 'This profile is only visible to followers'
            }), 403

        profile_data = {
            'username': user.username,
            'level': user.level,
            'experience_points': user.experience_points,
            'followers_count': user.get_followers_count(),
            'following_count': user.get_following_count(),
            'daily_streak': user.daily_streak,
        }

        if user.shared_achievements:
            profile_data['achievements'] = [{
                'name': a.name,
                'description': a.description,
                'badge_type': a.badge_type,
                'earned_at': a.earned_at.isoformat()
            } for a in user.achievements]

        if user.shared_goals:
            profile_data['goals'] = [{
                'title': g.title,
                'category': g.category,
                'progress': g.progress
            } for g in user.goals]

        return jsonify(profile_data)
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)