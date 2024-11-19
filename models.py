from datetime import datetime
from database import db
from flask_login import UserMixin

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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AIInsight(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    insight_type = db.Column(db.String(50))  # productivity, habits, goals
    content = db.Column(db.Text, nullable=False)
    recommendations = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_acknowledged = db.Column(db.Boolean, default=False)
