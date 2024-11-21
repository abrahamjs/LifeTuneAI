from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from models import User, Task, Goal, Habit, UserAnalytics, AIInsight, Achievement, DailyChallenge, HabitLog, SharedContent, ActivityFeed, Comment
from database import db
from config.settings import AUTH_REQUIRED
from services.analytics import AnalyticsService
from services.gamification import GamificationService
import os

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

        user = User(username=username,
                    email=email,
                    password_hash=generate_password_hash(password))
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
        goal = Goal(title=data['title'],
                    description=data['description'],
                    category=data['category'],
                    target_date=datetime.strptime(data['target_date'],
                                                  '%Y-%m-%d'),
                    user_id=current_user.id if AUTH_REQUIRED else 1)
        db.session.add(goal)
        db.session.commit()

        # Create associated tasks if provided
        if 'tasks' in data:
            for task_data in data['tasks']:
                task = Task(title=task_data['title'],
                            description=task_data['description'],
                            user_id=current_user.id if AUTH_REQUIRED else 1,
                            goal_id=goal.id)
                db.session.add(task)
            db.session.commit()

        return jsonify({'status': 'success'})

    goals = Goal.query.filter_by(
        user_id=current_user.id if AUTH_REQUIRED else 1).all()
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
        'id':
        goal.id,
        'title':
        goal.title,
        'description':
        goal.description,
        'category':
        goal.category,
        'progress':
        goal.progress,
        'target_date':
        goal.target_date.isoformat(),
        'created_at':
        goal.created_at.isoformat(),
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
        task = Task(title=data['title'],
                    description=data['description'],
                    priority=data['priority'],
                    due_date=datetime.strptime(data['due_date'], '%Y-%m-%d')
                    if data['due_date'] else None,
                    user_id=current_user.id if AUTH_REQUIRED else 1)
        db.session.add(task)
        db.session.commit()
        return jsonify({'status': 'success'})

    tasks = Task.query.filter_by(
        user_id=current_user.id if AUTH_REQUIRED else 1).all()
    return jsonify([{
        'id':
        task.id,
        'title':
        task.title,
        'description':
        task.description,
        'priority':
        task.priority,
        'completed':
        task.completed,
        'due_date':
        task.due_date.isoformat() if task.due_date else None
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
        task.due_date = datetime.strptime(
            data['due_date'], '%Y-%m-%d') if data['due_date'] else None
        task.completed = data['completed']

        # Process task completion for gamification
        if not was_completed and task.completed:
            task.completed_at = datetime.utcnow()
            GamificationService.process_task_completion(task.user_id, task)

            # Update related goal progress
            if task.goal_id:
                goal = Goal.query.get(task.goal_id)
                if goal:
                    goal_tasks = Task.query.filter_by(goal_id=goal.id).count()
                    completed_tasks = Task.query.filter_by(
                        goal_id=goal.id, completed=True).count()

                    old_progress = goal.progress
                    goal.progress = int((completed_tasks / goal_tasks) * 100)

                    # Check if goal was completed
                    if old_progress < 100 and goal.progress == 100:
                        GamificationService.process_goal_completion(
                            goal.user_id, goal)

        db.session.commit()
        return jsonify({'status': 'success'})

    # GET method
    return jsonify({
        'id':
        task.id,
        'title':
        task.title,
        'description':
        task.description,
        'priority':
        task.priority,
        'due_date':
        task.due_date.isoformat() if task.due_date else None,
        'completed':
        task.completed,
        'created_at':
        task.created_at.isoformat(),
        'completed_at':
        task.completed_at.isoformat() if task.completed_at else None,
        'goal_id':
        task.goal_id
    })


@app.route('/api/gamification/profile', methods=['GET'])
@login_required_if_enabled
def get_gamification_profile():
    user_id = current_user.id if AUTH_REQUIRED else 1
    user = User.query.get_or_404(user_id)

    # Update streak and multiplier
    GamificationService.update_streak_and_multiplier(user_id)

    # Get achievements
    achievements = Achievement.query.filter_by(user_id=user_id).all()

    # Get daily challenges
    today = datetime.utcnow().date()
    challenges = DailyChallenge.query.filter_by(user_id=user_id,
                                                date=today).all()

    # Calculate XP needed for next level
    current_level = user.level
    xp_for_next = GamificationService.get_level_threshold(current_level + 1)
    xp_progress = (
        user.experience_points -
        GamificationService.get_level_threshold(current_level)) / (
            xp_for_next -
            GamificationService.get_level_threshold(current_level)) * 100

    return jsonify({
        'level':
        user.level,
        'experience_points':
        user.experience_points,
        'xp_progress':
        xp_progress,
        'xp_needed':
        xp_for_next - user.experience_points,
        'daily_streak':
        user.daily_streak,
        'multiplier':
        user.current_multiplier,
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
        habit = Habit(title=data['title'],
                      description=data['description'],
                      frequency=data['frequency'],
                      user_id=current_user.id if AUTH_REQUIRED else 1)
        db.session.add(habit)
        db.session.commit()
        return jsonify({'status': 'success'})

    habits = Habit.query.filter_by(
        user_id=current_user.id if AUTH_REQUIRED else 1).all()
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
    completion_rates = AnalyticsService.get_completion_rate_by_priority(
        user_id)

    return jsonify({
        'productivity': trends,
        'completion_rates': completion_rates
    })


@app.route('/api/analytics/acknowledge-insight/<int:insight_id>',
           methods=['POST'])
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


# Social Feature Routes
@app.route('/social/feed')
@login_required_if_enabled
def social_feed():
    """Render the social feed page"""
    return render_template('social_feed.html')

@app.route('/social/profile/<int:user_id>')
@login_required_if_enabled
def social_profile(user_id):
    """Render the social profile page"""
    return render_template('social_profile.html', user_id=user_id)

@app.route('/profile')
@login_required_if_enabled
def profile():
    """Render the current user's profile page"""
    return render_template('social_profile.html', user_id=current_user.id if AUTH_REQUIRED else 1)

# Social API Routes
@app.route('/api/social/users/<int:user_id>')
@login_required_if_enabled
def get_user_profile(user_id):
    """Get user profile information"""
    user = User.query.get_or_404(user_id)
    if not user.privacy_settings.get('profile_visible', True) and (not AUTH_REQUIRED or user.id != current_user.id):
        return jsonify({'error': 'Profile not visible'}), 403

    return jsonify({
        'username': user.username,
        'bio': user.bio,
        'level': user.level,
        'followers_count': user.followers.count(),
        'following_count': user.following.count(),
        'achievements_count': len(user.achievements),
        'is_current_user': user.id == current_user.id if AUTH_REQUIRED else False,
        'is_following': user in current_user.following if AUTH_REQUIRED else False,
        'privacy_settings': user.privacy_settings if (AUTH_REQUIRED and user.id == current_user.id) else None
    })


@app.route('/api/social/shared-content/<int:content_id>/comments', methods=['GET', 'POST'])
@login_required_if_enabled
def handle_comments(content_id):
    """Handle comments on shared content"""
    content = SharedContent.query.get_or_404(content_id)
    
    if request.method == 'POST':
        if not content.comments_enabled:
            return jsonify({'error': 'Comments are disabled'}), 403
            
        data = request.get_json()
        comment = Comment(
            user_id=current_user.id if AUTH_REQUIRED else 1,
            shared_content_id=content_id,
            content=data.get('content')
        )
        db.session.add(comment)
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'comment': {
                'id': comment.id,
                'content': comment.content,
                'created_at': comment.created_at.isoformat(),
                'user_id': comment.user_id,
                'username': User.query.get(comment.user_id).username
            }
        })
        
    # GET request - return all comments
    comments = Comment.query.filter_by(shared_content_id=content_id).order_by(Comment.created_at.desc()).all()
    return jsonify([{
        'id': comment.id,
        'content': comment.content,
        'created_at': comment.created_at.isoformat(),
        'user_id': comment.user_id,
        'username': User.query.get(comment.user_id).username
    } for comment in comments])

@app.route('/api/social/shared-content/<int:content_id>/like', methods=['POST'])
@login_required_if_enabled
def like_content(content_id):
    """Like or unlike shared content"""
    content = SharedContent.query.get_or_404(content_id)
    content.likes = content.likes + 1
    db.session.commit()
    return jsonify({'status': 'success', 'likes': content.likes})
    filter_type = request.args.get('filter', 'all')
    before_id = request.args.get('before_id', type=int)
    following_only = request.args.get('following_only', type=bool, default=False)
    
    query = ActivityFeed.query
    
    if filter_type != 'all':
        query = query.filter(ActivityFeed.activity_type == filter_type)
    
    if following_only and AUTH_REQUIRED:
        following_ids = [u.id for u in current_user.following]
        following_ids.append(current_user.id)
        query = query.filter(ActivityFeed.user_id.in_(following_ids))
    else:
        query = query.filter(
            (ActivityFeed.privacy_level == 'public') |
            (ActivityFeed.user_id == current_user.id if AUTH_REQUIRED else False)
        )
    
    if before_id:
        query = query.filter(ActivityFeed.id < before_id)
    
    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()
    
    return jsonify([{
        'id': activity.id,
        'user_id': activity.user_id,
        'type': activity.activity_type,
        'content': activity.content,
        'created_at': activity.created_at.isoformat(),
        'privacy_level': activity.privacy_level,
        'username': User.query.get(activity.user_id).username if User.query.get(activity.user_id) else 'Unknown'
    } for activity in activities])
    filter_type = request.args.get('filter', 'all')
    before_id = request.args.get('before_id', type=int)
    following_only = request.args.get('following_only', type=bool, default=False)
    
    query = ActivityFeed.query
    
    if filter_type != 'all':
        query = query.filter(ActivityFeed.activity_type == filter_type)
    
    if following_only and AUTH_REQUIRED:
        following_ids = [u.id for u in current_user.following]
        following_ids.append(current_user.id)
        query = query.filter(ActivityFeed.user_id.in_(following_ids))
    else:
        query = query.filter(
            (ActivityFeed.privacy_level == 'public') |
            (ActivityFeed.user_id == current_user.id if AUTH_REQUIRED else False)
        )
    
    if before_id:
        query = query.filter(ActivityFeed.id < before_id)
    
    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()
    
    activity_list = []
    for activity in activities:
        user = User.query.get(activity.user_id)
        activity_data = {
            'id': activity.id,
            'user_id': activity.user_id,
            'type': activity.activity_type,
            'content': activity.content,
            'created_at': activity.created_at.isoformat(),
            'privacy_level': activity.privacy_level,
            'username': user.username if user else 'Unknown'
        }
        activity_list.append(activity_data)
    
    return jsonify(activity_list)
    filter_type = request.args.get('filter', 'all')
    before_id = request.args.get('before_id', type=int)
    following_only = request.args.get('following_only', type=bool, default=False)
    
    query = ActivityFeed.query
    
    if filter_type != 'all':
        query = query.filter(ActivityFeed.activity_type == filter_type)
    
    if following_only and AUTH_REQUIRED:
        following_ids = [u.id for u in current_user.following]
        following_ids.append(current_user.id)
        query = query.filter(ActivityFeed.user_id.in_(following_ids))
    else:
        query = query.filter(
            (ActivityFeed.privacy_level == 'public') |
            (ActivityFeed.user_id == current_user.id if AUTH_REQUIRED else False)
        )
    
    if before_id:
        query = query.filter(ActivityFeed.id < before_id)
    
    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()
    
    activity_list = []
    for activity in activities:
        user = User.query.get(activity.user_id)
        activity_data = {
            'id': activity.id,
            'user_id': activity.user_id,
            'type': activity.activity_type,
            'content': activity.content,
            'created_at': activity.created_at.isoformat(),
            'privacy_level': activity.privacy_level,
            'username': user.username if user else 'Unknown'
        }
        activity_list.append(activity_data)
    
    return jsonify(activity_list)
    filter_type = request.args.get('filter', 'all')
    before_id = request.args.get('before_id', type=int)
    following_only = request.args.get('following_only', type=bool, default=False)
    
    query = ActivityFeed.query
    
    if filter_type != 'all':
        query = query.filter(ActivityFeed.activity_type == filter_type)
    
    if following_only and AUTH_REQUIRED:
        following_ids = [u.id for u in current_user.following]
        following_ids.append(current_user.id)
        query = query.filter(ActivityFeed.user_id.in_(following_ids))
    else:
        query = query.filter(
            (ActivityFeed.privacy_level == 'public') |
            (ActivityFeed.user_id == current_user.id if AUTH_REQUIRED else False)
        )
    
    if before_id:
        query = query.filter(ActivityFeed.id < before_id)
    
    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()
    
    activity_list = []
    for activity in activities:
        user = User.query.get(activity.user_id)
        activity_data = {
            'id': activity.id,
            'user_id': activity.user_id,
            'type': activity.activity_type,
            'content': activity.content,
            'created_at': activity.created_at.isoformat(),
            'privacy_level': activity.privacy_level,
            'username': user.username if user else 'Unknown'
        }
        activity_list.append(activity_data)
    
    return jsonify(activity_list)
    filter_type = request.args.get('filter', 'all')
    before_id = request.args.get('before_id', type=int)
    following_only = request.args.get('following_only', type=bool, default=False)
    
    query = ActivityFeed.query

    if filter_type != 'all':
        query = query.filter(ActivityFeed.activity_type == filter_type)
    
    if following_only and AUTH_REQUIRED:
        following_ids = [u.id for u in current_user.following]
        following_ids.append(current_user.id)
        query = query.filter(ActivityFeed.user_id.in_(following_ids))
    else:
        query = query.filter(
            (ActivityFeed.privacy_level == 'public') |
            (ActivityFeed.user_id == current_user.id if AUTH_REQUIRED else False)
        )
    
    if before_id:
        query = query.filter(ActivityFeed.id < before_id)
    
    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()
    
    activity_list = []
    for activity in activities:
        user = User.query.get(activity.user_id)
        activity_data = {
            'id': activity.id,
            'user_id': activity.user_id,
            'type': activity.activity_type,
            'content': activity.content,
            'created_at': activity.created_at.isoformat(),
            'privacy_level': activity.privacy_level,
            'username': user.username if user else 'Unknown'
        }
        activity_list.append(activity_data)
    
    return jsonify(activity_list)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
    before_id = request.args.get('before_id', type=int)
    following_only = request.args.get('following_only', type=bool, default=False)
    
    query = ActivityFeed.query
    
    if filter_type != 'all':
        query = query.filter(ActivityFeed.activity_type == filter_type)
    
    if following_only and AUTH_REQUIRED:
        following_ids = [user.id for user in current_user.following]
        following_ids.append(current_user.id)
        query = query.filter(ActivityFeed.user_id.in_(following_ids))
    else:
        query = query.filter(
            (ActivityFeed.privacy_level == 'public') |
            (ActivityFeed.user_id == current_user.id if AUTH_REQUIRED else False)
        )
    
    if before_id:
        query = query.filter(ActivityFeed.id < before_id)
    
    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()
    
    return jsonify([{
        'id': activity.id,
        'user_id': activity.user_id,
        'type': activity.activity_type,
        'content': activity.content,
        'created_at': activity.created_at.isoformat(),
        'privacy_level': activity.privacy_level,
        'username': User.query.get(activity.user_id).username if User.query.get(activity.user_id) else 'Unknown'
    } for activity in activities])

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
    """Get social activity feed with filtering and pagination"""
    filter_type = request.args.get('filter', 'all')
    before_id = request.args.get('before_id', type=int)
    following_only = request.args.get('following_only', type=bool, default=False)
    
    query = ActivityFeed.query
    
    if filter_type != 'all':
        query = query.filter(ActivityFeed.activity_type.contains(filter_type))
    
    if following_only and AUTH_REQUIRED:
        following_ids = [user.id for user in current_user.following]
        following_ids.append(current_user.id)
        query = query.filter(ActivityFeed.user_id.in_(following_ids))
    else:
        query = query.filter(
            (ActivityFeed.privacy_level == 'public') |
            (ActivityFeed.user_id == current_user.id if AUTH_REQUIRED else False)
        )
    
    if before_id:
        query = query.filter(ActivityFeed.id < before_id)
    
    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()
    
    return jsonify([{
        'id': activity.id,
        'user_id': activity.user_id,
        'type': activity.activity_type,
        'content': activity.content,
        'created_at': activity.created_at.isoformat(),
        'privacy_level': activity.privacy_level,
        'username': User.query.get(activity.user_id).username if User.query.get(activity.user_id) else 'Unknown'
    } for activity in activities])
        'user_id': activity.user_id,
        'type': activity.activity_type,
        'content': activity.content,
        'created_at': activity.created_at.isoformat(),
        'privacy_level': activity.privacy_level,
        'username': User.query.get(activity.user_id).username if User.query.get(activity.user_id) else 'Unknown'
    } for activity in activities])

@app.route('/api/social/users/<int:user_id>')
@login_required_if_enabled
def get_user_profile(user_id):
    """Get user profile information"""
    user = User.query.get_or_404(user_id)
    if not user.privacy_settings.get('profile_visible', True) and user.id != current_user.id:
        return jsonify({'error': 'Profile not visible'}), 403

    return jsonify({
        'username': user.username,
        'bio': user.bio,
        'level': user.level,
        'followers_count': user.followers.count(),
        'following_count': user.following.count(),
        'achievements_count': len(user.achievements),
        'is_current_user': user.id == current_user.id if AUTH_REQUIRED else False,
        'is_following': user in current_user.following if AUTH_REQUIRED else False,
        'privacy_settings': user.privacy_settings if user.id == current_user.id else None
    })

@app.route('/api/social/unfollow/<int:user_id>', methods=['POST'])
@login_required_if_enabled
def unfollow_user(user_id):
    """Unfollow a user"""
    user_to_unfollow = User.query.get_or_404(user_id)
    if user_to_unfollow in current_user.following:
        current_user.following.remove(user_to_unfollow)
        db.session.commit()
    return jsonify({'status': 'success'})

@app.route('/api/social/privacy-settings', methods=['PUT'])
@login_required_if_enabled
def update_privacy_settings():
    """Update user privacy settings"""
    data = request.get_json()
    current_user.privacy_settings = {
        'share_achievements': data.get('share_achievements', True),
        'share_goals': data.get('share_goals', True),
        'share_habits': data.get('share_habits', False),
        'profile_visible': data.get('profile_visible', True)
    }
    db.session.commit()
    return jsonify({'status': 'success'})

@app.route('/api/social/shared-content/<int:content_id>/comments', methods=['GET', 'POST'])
@login_required_if_enabled
def handle_comments(content_id):
    """Handle comments on shared content"""
    content = SharedContent.query.get_or_404(content_id)
    
    if request.method == 'POST':
        if not content.comments_enabled:
            return jsonify({'error': 'Comments are disabled'}), 403
            
        data = request.get_json()
        comment = Comment(
            user_id=current_user.id if AUTH_REQUIRED else 1,
            shared_content_id=content_id,
            content=data['content']
        )
        db.session.add(comment)
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'comment': {
                'id': comment.id,
                'content': comment.content,
                'created_at': comment.created_at.isoformat(),
                'username': User.query.get(comment.user_id).username
            }
        })
    
    # GET method
    comments = Comment.query.filter_by(shared_content_id=content_id).all()
    return jsonify([{
        'id': comment.id,
        'content': comment.content,
        'created_at': comment.created_at.isoformat(),
        'username': User.query.get(comment.user_id).username
    } for comment in comments])

@app.route('/api/social/shared-content/<int:content_id>/like', methods=['POST'])
@login_required_if_enabled
def like_content(content_id):
    """Like or unlike shared content"""
    content = SharedContent.query.get_or_404(content_id)
    content.likes = content.likes + 1
    db.session.commit()
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
    # Get activities with user information
    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()
    return jsonify([{
        'id': activity.id,
        'user_id': activity.user_id,
        'type': activity.activity_type,
        'content': activity.content,
        'created_at': activity.created_at.isoformat(),
        'privacy_level': activity.privacy_level,
        'username': User.query.get(activity.user_id).username if User.query.get(activity.user_id) else 'Unknown'
    } for activity in activities])

    # Get activities with user information
    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()
    return jsonify([{
        'id': activity.id,
        'user_id': activity.user_id,
        'type': activity.activity_type,
        'content': activity.content,
        'created_at': activity.created_at.isoformat(),
        'privacy_level': activity.privacy_level,
        'username': User.query.get(activity.user_id).username if User.query.get(activity.user_id) else 'Unknown'
    } for activity in activities])

    # Get activities with user information
    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()
    return jsonify([{
        'id': activity.id,
        'user_id': activity.user_id,
        'type': activity.activity_type,
        'content': activity.content,
        'created_at': activity.created_at.isoformat(),
        'privacy_level': activity.privacy_level,
        'username': User.query.get(activity.user_id).username if User.query.get(activity.user_id) else 'Unknown'
    } for activity in activities])

    # Get activities with user information
    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()

    return jsonify([{
        'id': activity.id,
        'user_id': activity.user_id,
        'type': activity.activity_type,
        'content': activity.content,
        'created_at': activity.created_at.isoformat(),
        'privacy_level': activity.privacy_level,
        'username': User.query.get(activity.user_id).username if User.query.get(activity.user_id) else 'Unknown'
    } for activity in activities])

    # Get activities with user information
    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()

    return jsonify([{
        'id': activity.id,
        'user_id': activity.user_id,
        'type': activity.activity_type,
        'content': activity.content,
        'created_at': activity.created_at.isoformat(),
        'privacy_level': activity.privacy_level,
        'username': User.query.get(activity.user_id).username if User.query.get(activity.user_id) else 'Unknown'
    } for activity in activities])

@app.route('/api/social/users/<int:user_id>')
@login_required_if_enabled
def get_user_profile(user_id):
    """Get user profile information"""
    user = User.query.get_or_404(user_id)
    if not user.privacy_settings.get('profile_visible', True) and user.id != current_user.id:
        return jsonify({'error': 'Profile not visible'}), 403

    return jsonify({
        'username': user.username,
        'bio': user.bio,
        'level': user.level,
        'followers_count': user.followers.count(),
        'following_count': user.following.count(),
        'achievements_count': len(user.achievements),
        'is_current_user': user.id == current_user.id if AUTH_REQUIRED else False,
        'is_following': user in current_user.following if AUTH_REQUIRED else False,
        'privacy_settings': user.privacy_settings if user.id == current_user.id else None
    })


@app.route('/api/social/privacy-settings', methods=['PUT'])
@login_required_if_enabled
def update_privacy_settings():
    """Update user privacy settings"""
    if not AUTH_REQUIRED:
        return jsonify({'error': 'Authentication required'}), 403

    data = request.get_json()
    user = current_user
    user.privacy_settings = {
        'share_achievements': data.get('share_achievements', True),
        'share_goals': data.get('share_goals', True),
        'share_habits': data.get('share_habits', False),
        'profile_visible': data.get('profile_visible', True)
    }
    db.session.commit()
    return jsonify({'status': 'success'})
    """Get social activity feed with filtering and pagination"""
    filter_type = request.args.get('filter', 'all')
    before_id = request.args.get('before_id', type=int)
    following_only = request.args.get('following_only', type=bool, default=False)

    # Base query for activities
    query = ActivityFeed.query

    # Filter by type if specified
    if filter_type != 'all':
        query = query.filter(ActivityFeed.activity_type.contains(filter_type))

    # Filter by visibility and following
    if following_only and AUTH_REQUIRED:
        following_ids = [user.id for user in current_user.following]
        following_ids.append(current_user.id)
        query = query.filter(ActivityFeed.user_id.in_(following_ids))
    else:
        query = query.filter(
            (ActivityFeed.privacy_level == 'public') |
            (ActivityFeed.user_id == current_user.id if AUTH_REQUIRED else False)
        )

    # Apply pagination
    if before_id:
        query = query.filter(ActivityFeed.id < before_id)

    # Get activities with user information
    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()

    return jsonify([{
        'id': activity.id,
        'user_id': activity.user_id,
        'type': activity.activity_type,
        'content': activity.content,
        'created_at': activity.created_at.isoformat(),
        'privacy_level': activity.privacy_level,
        'username': User.query.get(activity.user_id).username if User.query.get(activity.user_id) else 'Unknown'
    } for activity in activities])

@app.route('/api/social/users/<int:user_id>')
@login_required_if_enabled
def get_user_profile(user_id):
    """Get user profile information"""
    user = User.query.get_or_404(user_id)
    if not user.privacy_settings.get('profile_visible', True) and user.id != current_user.id:
        return jsonify({'error': 'Profile not visible'}), 403

    return jsonify({
        'username': user.username,
        'bio': user.bio,
        'level': user.level,
        'followers_count': user.followers.count(),
        'following_count': user.following.count(),
        'achievements_count': len(user.achievements),
        'is_current_user': user.id == current_user.id if AUTH_REQUIRED else False,
        'is_following': user in current_user.following if AUTH_REQUIRED else False,
        'privacy_settings': user.privacy_settings if user.id == current_user.id else None
    })

@app.route('/api/social/shared-content/<int:content_id>/comments', methods=['GET', 'POST'])
@login_required_if_enabled
def handle_comments(content_id):
    """Handle comments on shared content"""
    content = SharedContent.query.get_or_404(content_id)
    
    if request.method == 'POST':
        if not content.comments_enabled:
            return jsonify({'error': 'Comments are disabled'}), 403
            
        data = request.get_json()
        comment = Comment(
            user_id=current_user.id if AUTH_REQUIRED else 1,
            shared_content_id=content_id,
            content=data['content']
        )
        db.session.add(comment)
        db.session.commit()
        return jsonify({'status': 'success'})
    
    # GET method
    comments = Comment.query.filter_by(shared_content_id=content_id).all()
    return jsonify([{
        'id': comment.id,
        'user_id': comment.user_id,
        'content': comment.content,
        'created_at': comment.created_at.isoformat(),
        'username': User.query.get(comment.user_id).username if User.query.get(comment.user_id) else 'Unknown'
    } for comment in comments])
        'privacy_settings': user.privacy_settings if user.id == current_user.id else None
    })


@app.route('/api/social/feed')
@login_required_if_enabled
def get_activity_feed():
    """Get social activity feed with filtering and pagination"""
    filter_type = request.args.get('filter', 'all')
    before_id = request.args.get('before_id', type=int)
    following_only = request.args.get('following_only', type=bool, default=False)

    # Base query for activities
    query = ActivityFeed.query

    # Filter by type if specified
    if filter_type != 'all':
        query = query.filter(ActivityFeed.activity_type.contains(filter_type))

    # Filter by visibility and following
    if following_only and AUTH_REQUIRED:
        following_ids = [user.id for user in current_user.following]
        following_ids.append(current_user.id)
        query = query.filter(ActivityFeed.user_id.in_(following_ids))
    else:
        query = query.filter(
            (ActivityFeed.privacy_level == 'public') |
            (ActivityFeed.user_id == current_user.id if AUTH_REQUIRED else False)
        )

    # Apply pagination
    if before_id:
        query = query.filter(ActivityFeed.id < before_id)

    # Get activities
    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()

    return jsonify([{
        'id': activity.id,
        'user_id': activity.user_id,
        'type': activity.activity_type,
        'content': activity.content,
        'created_at': activity.created_at.isoformat(),
        'privacy_level': activity.privacy_level,
        'username': User.query.get(activity.user_id).username if User.query.get(activity.user_id) else 'Unknown'
    } for activity in activities])
    following_only = request.args.get('following_only', type=bool, default=False)

    # Base query for activities
    query = ActivityFeed.query

    # Filter by type if specified
    if filter_type != 'all':
        query = query.filter(ActivityFeed.activity_type.contains(filter_type))

    # Filter by visibility and following
    if following_only and AUTH_REQUIRED:
        following_ids = [user.id for user in current_user.following]
        following_ids.append(current_user.id)
        query = query.filter(ActivityFeed.user_id.in_(following_ids))
    else:
        query = query.filter(
            (ActivityFeed.privacy_level == 'public') |
            (ActivityFeed.user_id == current_user.id if AUTH_REQUIRED else False)
        )

    # Apply pagination
    if before_id:
        query = query.filter(ActivityFeed.id < before_id)

    # Get activities
    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()

    return jsonify([{
        'id': activity.id,
        'user_id': activity.user_id,
        'type': activity.activity_type,
        'content': activity.content,
        'created_at': activity.created_at.isoformat(),
        'privacy_level': activity.privacy_level,
        'username': User.query.get(activity.user_id).username
    } for activity in activities])
    following_only = request.args.get('following_only', type=bool, default=False)

    # Base query for activities
    query = ActivityFeed.query

    # Filter by type if specified
    if filter_type != 'all':
        query = query.filter(ActivityFeed.activity_type.contains(filter_type))

    # Filter by visibility and following
    if following_only and AUTH_REQUIRED:
        following_ids = [user.id for user in current_user.following]
        following_ids.append(current_user.id)
        query = query.filter(
            ActivityFeed.user_id.in_(following_ids)
        )
    else:
        query = query.filter(
            (ActivityFeed.privacy_level == 'public') |
            (ActivityFeed.user_id == current_user.id if AUTH_REQUIRED else False)
        )

    # Apply pagination
    if before_id:
        query = query.filter(ActivityFeed.id < before_id)

    # Get activities
    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()

    return jsonify([{
        'id': activity.id,
        'user_id': activity.user_id,
        'type': activity.activity_type,
        'content': activity.content,
        'created_at': activity.created_at.isoformat(),
        'privacy_level': activity.privacy_level,
        'username': User.query.get(activity.user_id).username
    } for activity in activities])

    # Base query for public activities
    query = ActivityFeed.query.filter(
        (ActivityFeed.privacy_level == 'public') |
        (ActivityFeed.user_id == current_user.id if AUTH_REQUIRED else False)
    )

    # Apply type filter if specified
    if filter_type != 'all':
        query = query.filter(ActivityFeed.activity_type.contains(filter_type))

    # Apply pagination
    if before_id:
        query = query.filter(ActivityFeed.id < before_id)

    # Get activities
    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()

    return jsonify([{
        'id': activity.id,
        'user_id': activity.user_id,
        'type': activity.activity_type,
        'content': activity.content,
        'created_at': activity.created_at.isoformat(),
        'privacy_level': activity.privacy_level
    } for activity in activities])

    activities = query.order_by(ActivityFeed.created_at.desc()).limit(10).all()

    # Social Routes


# Social Routes
@app.route('/api/social/users/<int:user_id>', methods=['GET'])
@login_required_if_enabled
def get_user_profile(user_id):
    """Get a user's profile information"""
    try:
        user = User.query.get_or_404(user_id)
        if not user.privacy_settings.get('profile_visible',
                                         True) and user.id != current_user.id:
            return jsonify({'error': 'Profile not visible'}), 403

        return jsonify({
            'status': 'success',
            'user': {
                'username':
                user.username,
                'bio':
                user.bio,
                'level':
                user.level,
                'followers_count':
                user.followers.count(),
                'following_count':
                user.following.count(),
                'achievements_count':
                len(user.achievements),
                'is_current_user':
                user.id == current_user.id,
                'is_following':
                user in current_user.following,
                'privacy_settings':
                user.privacy_settings if user.id == current_user.id else None
            }
        })
    except Exception as e:
        return jsonify({'error': 'Failed to fetch user profile'}), 500


@app.route('/api/social/follow/<int:user_id>', methods=['POST'])
@login_required_if_enabled
def follow_user(user_id):
    """Follow another user"""
    if user_id == current_user.id:
        return jsonify({'error': 'Cannot follow yourself'}), 400

    user_to_follow = User.query.get_or_404(user_id)
    if not user_to_follow.privacy_settings.get('profile_visible', True):
        return jsonify({'error': 'Profile not visible'}), 403

    if user_to_follow in current_user.following:
        return jsonify({'error': 'Already following'}), 400

    try:
        current_user.following.append(user_to_follow)

        # Create activity feed entry
        activity = ActivityFeed(user_id=current_user.id,
                                activity_type='following_new_user',
                                content={
                                    'followed_user_id': user_id,
                                    'username': user_to_follow.username
                                },
                                privacy_level='public')
        db.session.add(activity)
        db.session.commit()
        return jsonify({
            'status': 'success',
            'message': f'Now following {user_to_follow.username}'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to follow user'}), 500

@app.route('/api/social/activity-feed/new')
@login_required_if_enabled
def get_new_activities():
    last_id = request.args.get('last_id', type=int)
    filter_type = request.args.get('filter', 'all')

    following_ids = [u.id for u in current_user.following]
    following_ids.append(current_user.id)

    query = ActivityFeed.query.filter((ActivityFeed.user_id.in_(following_ids))
                                      |
                                      (ActivityFeed.privacy_level == 'public'))

    if filter_type != 'all':
        query = query.filter(ActivityFeed.activity_type.contains(filter_type))

    if last_id:
        query = query.filter(ActivityFeed.id > last_id)

    activities = query.order_by(ActivityFeed.created_at.desc()).all()

    return jsonify([{
        'id': activity.id,
        'activity_type': activity.activity_type,
        'content': activity.content,
        'created_at': activity.created_at.isoformat(),
        'user': {
            'username': User.query.get(activity.user_id).username,
            'id': activity.user_id
        }
    } for activity in activities])


# Route removed as it's already defined above

@app.route('/api/social/share-content', methods=['POST'])
@login_required_if_enabled
def share_social_content():
    """Share content with privacy settings"""
    try:
        data = request.get_json()
        required_fields = ['content_type', 'content_id', 'privacy_level']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400

        # Validate content type
        valid_content_types = ['achievement', 'goal', 'habit']
        if data['content_type'] not in valid_content_types:
            return jsonify({'error': 'Invalid content type'}), 400

        # Create shared content entry
        content = SharedContent(user_id=current_user.id,
                                content_type=data['content_type'],
                                content_id=data['content_id'],
                                privacy_level=data['privacy_level'],
                                comments_enabled=data.get(
                                    'comments_enabled', True))
        db.session.add(content)

        # Create activity feed entry
        activity = ActivityFeed(user_id=current_user.id,
                                activity_type=f'shared_{data["content_type"]}',
                                content={
                                    'content_id': data['content_id'],
                                    'shared_content_id': content.id,
                                    'privacy_level': data['privacy_level']
                                },
                                privacy_level=data['privacy_level'])
        db.session.add(activity)
        db.session.commit()

        return jsonify({
            'status': 'success',
            'message': 'Content shared successfully',
            'content_id': content.id
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to share content'}), 500


@app.route('/api/social/shared-content/<int:content_id>/comments',
           methods=['GET', 'POST'])
@login_required_if_enabled
def handle_comments(content_id):
    """Handle comments on shared content"""
    try:
        shared_content = SharedContent.query.get_or_404(content_id)

        if request.method == 'POST':
            if not shared_content.comments_enabled:
                return jsonify({'error': 'Comments are disabled'}), 403

            data = request.get_json()
            if not data or 'content' not in data or not data['content'].strip(
            ):
                return jsonify({'error': 'Comment content is required'}), 400

            comment = Comment(user_id=current_user.id,
                              shared_content_id=content_id,
                              content=data['content'].strip())
            db.session.add(comment)
            db.session.commit()

            return jsonify({
                'status': 'success',
                'comment': {
                    'id': comment.id,
                    'content': comment.content,
                    'username': current_user.username,
                    'created_at': comment.created_at.isoformat()
                }
            })

        # GET request
        comments = Comment.query.filter_by(shared_content_id=content_id)\
            .order_by(Comment.created_at.desc()).all()

        return jsonify({
            'status':
            'success',
            'comments': [{
                'id': comment.id,
                'content': comment.content,
                'username': User.query.get(comment.user_id).username,
                'created_at': comment.created_at.isoformat(),
                'is_owner': comment.user_id == current_user.id
            } for comment in comments]
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to process comment request'}), 500


@app.route('/api/social/shared-content/<int:content_id>/like',
           methods=['POST'])
@login_required_if_enabled
def like_content(content_id):
    content = SharedContent.query.get_or_404(content_id)
    content.likes += 1
    db.session.commit()
    return jsonify({'status': 'success'})


@app.route('/api/social/privacy-settings', methods=['GET', 'PUT'])
@login_required_if_enabled
def manage_privacy_settings():
    if request.method == 'PUT':
        data = request.get_json()
        current_user.privacy_settings.update({
            'share_achievements':
            data.get('share_achievements', True),
            'share_goals':
            data.get('share_goals', True),
            'share_habits':
            data.get('share_habits', False),
            'profile_visible':
            data.get('profile_visible', True)
        })
        db.session.commit()
        return jsonify({'status': 'success'})

    return jsonify(current_user.privacy_settings)


@app.route('/api/gamification/leaderboard')
@login_required_if_enabled
def get_leaderboard():
    # Get top users by experience points
    top_users = User.query.order_by(
        User.experience_points.desc()).limit(10).all()

    return jsonify([{
        'username': user.username,
        'level': user.level,
        'experience_points': user.experience_points,
        'achievements_count': len(user.achievements)
    } for user in top_users])
    if user_to_unfollow in current_user.following:
        current_user.following.remove(user_to_unfollow)
        db.session.commit()
        return jsonify({'status': 'success'})
    return jsonify({'error': 'Not following this user'}), 400

    # Routes removed as they are already defined above with better implementations
    return jsonify({'status': 'success', 'shared_id': shared.id})


# Route removed as it's already defined above with better implementation


# Route removed as it's already defined above with better implementation


# Route removed as it's already defined above with better implementation


@app.route('/api/social/comment', methods=['POST'])
@login_required_if_enabled
def add_comment():
    data = request.get_json()
    shared_content = SharedContent.query.get_or_404(data['shared_content_id'])

    if not shared_content.comments_enabled:
        return jsonify({'error':
                        'Comments are disabled for this content'}), 403

    comment = Comment(user_id=current_user.id,
                      shared_content_id=shared_content.id,
                      content=data['content'])
    db.session.add(comment)
    db.session.commit()

    return jsonify({
        'id': comment.id,
        'content': comment.content,
        'created_at': comment.created_at.isoformat()
    })


@app.route('/social/feed')
@login_required_if_enabled
def social_feed():
    return render_template('social_feed.html')


@app.route('/social/profile/<int:user_id>')
@login_required_if_enabled
def social_profile(user_id):
    return render_template('social_profile.html', profile_user_id=user_id)


# Add these routes at the end of app.py, before if __name__ == '__main__':


@app.route('/api/social/profile')
@login_required_if_enabled
def get_social_profile():
    user = current_user if AUTH_REQUIRED else User.query.first()
    return jsonify({
        'username': user.username,
        'level': user.level,
        'followers_count': user.followers.count(),
        'following_count': user.following.count(),
        'privacy_settings': user.privacy_settings
    })


@app.route('/api/social/users/<int:user_id>')
@login_required_if_enabled
def view_user_profile(user_id):
    user = User.query.get_or_404(user_id)
    current_user_id = current_user.id if AUTH_REQUIRED else 1

    if not user.privacy_settings.get('profile_visible', True):
        return jsonify({'error': 'Profile not visible'}), 403

    return jsonify({
        'username':
        user.username,
        'bio':
        user.bio,
        'level':
        user.level,
        'followers_count':
        user.followers.count(),
        'following_count':
        user.following.count(),
        'achievements_count':
        len(user.achievements),
        'is_current_user':
        user_id == current_user_id,
        'is_following':
        user in current_user.following if AUTH_REQUIRED else False
    })


@app.route('/api/social/privacy-settings', methods=['PUT'])
@login_required_if_enabled
def update_privacy_settings():
    user = current_user if AUTH_REQUIRED else User.query.first()
    settings = request.get_json()

    user.privacy_settings = {
        'share_achievements': settings.get('share_achievements', True),
        'share_goals': settings.get('share_goals', True),
        'share_habits': settings.get('share_habits', False),
        'profile_visible': settings.get('profile_visible', True)
    }

    db.session.commit()
    return jsonify({'status': 'success'})


@app.route('/api/social/activity-feed')
@login_required_if_enabled
def get_activity_feed():
    user = current_user if AUTH_REQUIRED else User.query.first()
    following_ids = [u.id for u in user.following]
    following_ids.append(user.id)

    activities = ActivityFeed.query.filter(
        ActivityFeed.user_id.in_(following_ids),
        ActivityFeed.privacy_level == 'public').order_by(
            ActivityFeed.created_at.desc()).limit(50).all()

    return jsonify([{
        'id': activity.id,
        'activity_type': activity.activity_type,
        'content': activity.content,
        'created_at': activity.created_at.isoformat()
    } for activity in activities])


@app.route('/api/social/users/<int:user_id>/activity')
@login_required_if_enabled
def get_user_activity(user_id):
    user = User.query.get_or_404(user_id)
    if not user.privacy_settings.get('profile_visible', True):
        return jsonify({'error': 'Profile not visible'}), 403

    activities = ActivityFeed.query.filter_by(
        user_id=user_id, privacy_level='public').order_by(
            ActivityFeed.created_at.desc()).limit(20).all()

    return jsonify([{
        'id': activity.id,
        'activity_type': activity.activity_type,
        'content': activity.content,
        'created_at': activity.created_at.isoformat()
    } for activity in activities])


@app.route('/api/social/users/<int:user_id>/shared-content')
@login_required_if_enabled
def get_shared_content(user_id):
    user = User.query.get_or_404(user_id)
    if not user.privacy_settings.get('profile_visible', True):
        return jsonify({'error': 'Profile not visible'}), 403

    content = SharedContent.query.filter_by(
        user_id=user_id,
        privacy_level='public').order_by(SharedContent.shared_at.desc()).all()

    return jsonify([{
        'id': item.id,
        'content_type': item.content_type,
        'content': item.content,
        'shared_at': item.shared_at.isoformat(),
        'likes': item.likes,
        'comments_enabled': item.comments_enabled
    } for item in content])


@app.route('/api/social/shared-content/<int:content_id>/comments',
           methods=['GET', 'POST'])
@login_required_if_enabled
def handle_comments(content_id):
    content = SharedContent.query.get_or_404(content_id)
    if not content.comments_enabled:
        return jsonify({'error': 'Comments are disabled'}), 403

    if request.method == 'POST':
        data = request.get_json()
        comment = Comment(user_id=current_user.id if AUTH_REQUIRED else 1,
                          shared_content_id=content_id,
                          content=data['content'])
        db.session.add(comment)
        db.session.commit()
        return jsonify({'status': 'success'})

    comments = Comment.query.filter_by(shared_content_id=content_id)\
        .order_by(Comment.created_at.desc()).all()

    return jsonify([{
        'id': comment.id,
        'username': User.query.get(comment.user_id).username,
        'content': comment.content,
        'created_at': comment.created_at.isoformat()
    } for comment in comments])


@app.route('/api/social/shared-content/<int:content_id>/like',
           methods=['POST'])
@login_required_if_enabled
def like_content(content_id):
    content = SharedContent.query.get_or_404(content_id)
    content.likes += 1
    db.session.commit()
    return jsonify({'status': 'success'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
