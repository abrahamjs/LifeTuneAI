from datetime import datetime
from database import db
from flask_login import UserMixin
from sqlalchemy.dialects.postgresql import JSONB

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256))
    goals = db.relationship('Goal', backref='user', lazy=True)
    tasks = db.relationship('Task', backref='user', lazy=True)
    habits = db.relationship('Habit', backref='user', lazy=True)
    voice_notes = db.relationship('VoiceNote', backref='user', lazy=True)
    analytics = db.relationship('UserAnalytics', backref='user', lazy=True)
    # Enhanced Gamification attributes
    experience_points = db.Column(db.Integer, default=0)
    level = db.Column(db.Integer, default=1)
    achievements = db.relationship('Achievement', backref='user', lazy=True)
    daily_streak = db.Column(db.Integer, default=0)
    last_login = db.Column(db.DateTime)
    current_multiplier = db.Column(db.Float, default=1.0)
    # New gamification attributes
    total_tasks_completed = db.Column(db.Integer, default=0)
    total_goals_completed = db.Column(db.Integer, default=0)
    longest_streak = db.Column(db.Integer, default=0)
    achievement_points = db.Column(db.Integer, default=0)
    selected_title = db.Column(db.String(100))
    active_badges = db.Column(JSONB, default=list)
    seasonal_points = db.Column(db.Integer, default=0)
    unlocked_rewards = db.Column(JSONB, default=list)

class Achievement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    badge_type = db.Column(db.String(50))  # Extended badge types
    earned_at = db.Column(db.DateTime, default=datetime.utcnow)
    points_awarded = db.Column(db.Integer, default=0)
    rarity = db.Column(db.String(20), default='common')  # common, rare, epic, legendary
    category = db.Column(db.String(50))  # productivity, social, seasonal, special
    icon = db.Column(db.String(50))  # CSS icon class

class DailyChallenge(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    challenge_type = db.Column(db.String(50))
    target_value = db.Column(db.Integer)
    current_value = db.Column(db.Integer, default=0)
    reward_points = db.Column(db.Integer)
    date = db.Column(db.Date, nullable=False)
    completed = db.Column(db.Boolean, default=False)
    # New challenge attributes
    difficulty = db.Column(db.String(20))  # easy, medium, hard
    bonus_multiplier = db.Column(db.Float, default=1.0)
    time_sensitive = db.Column(db.Boolean, default=False)
    expires_at = db.Column(db.DateTime)
    category = db.Column(db.String(50))  # daily, weekly, seasonal
    streak_count = db.Column(db.Integer, default=0)  # Track consecutive completions

class SeasonalEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    rewards = db.Column(JSONB)
    requirements = db.Column(JSONB)
    participants = db.relationship('User', secondary='event_participants')
    active = db.Column(db.Boolean, default=True)

class EventParticipants(db.Model):
    __tablename__ = 'event_participants'
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('seasonal_event.id'), primary_key=True)
    points = db.Column(db.Integer, default=0)
    progress = db.Column(JSONB)
    rewards_claimed = db.Column(JSONB, default=list)

class Goal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    target_date = db.Column(db.DateTime, nullable=False)
    progress = db.Column(db.Integer, default=0)  # 0-100
    category = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    tasks = db.relationship('Task', backref='goal', lazy=True)

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    due_date = db.Column(db.DateTime)
    priority = db.Column(db.String(20))  # urgent, important, normal
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    goal_id = db.Column(db.Integer, db.ForeignKey('goal.id'), nullable=True)

class Habit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    frequency = db.Column(db.String(20))  # daily, weekly
    current_streak = db.Column(db.Integer, default=0)
    best_streak = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class HabitLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    habit_id = db.Column(db.Integer, db.ForeignKey('habit.id'), nullable=False)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)

class VoiceNote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    transcription = db.Column(db.Text, nullable=False)
    audio_data = db.Column(db.LargeBinary, nullable=True)  # For storing small audio clips if needed
    note_type = db.Column(db.String(20))  # 'task', 'journal'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), nullable=True)
    task = db.relationship('Task', backref='voice_notes', lazy=True, foreign_keys=[task_id])

class UserAnalytics(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    productivity_score = db.Column(db.Float, default=0.0)  # 0-100
    tasks_completed = db.Column(db.Integer, default=0)
    goals_progress = db.Column(db.Float, default=0.0)  # Average progress across goals
    active_habits = db.Column(db.Integer, default=0)
    focus_time = db.Column(db.Integer, default=0)  # Minutes spent in focus sessions
    task_efficiency_score = db.Column(db.Float, default=0.0)  # 0-100
    habit_impact_score = db.Column(db.Float, default=0.0)  # 0-100
    goal_completion_prediction = db.Column(db.Float, default=0.0)  # 0-100
    weekly_pattern = db.Column(JSONB)  # Store weekly productivity patterns
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AIInsight(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    insight_type = db.Column(db.String(50))  # productivity, habits, goals, efficiency
    content = db.Column(db.Text, nullable=False)
    recommendations = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_acknowledged = db.Column(db.Boolean, default=False)