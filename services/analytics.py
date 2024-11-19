import os
from datetime import datetime, timedelta
from sqlalchemy import func, desc, and_
import openai
from models import Task, Goal, Habit, UserAnalytics, AIInsight, HabitLog
from database import db

class AnalyticsService:
    @staticmethod
    def calculate_daily_analytics(user_id):
        """Calculate comprehensive daily analytics for a user"""
        today = datetime.utcnow().date()
        
        # Get completed tasks count and completion rate
        total_tasks = Task.query.filter(
            Task.user_id == user_id,
            func.date(Task.created_at) == today
        ).count()
        
        completed_tasks = Task.query.filter(
            Task.user_id == user_id,
            Task.completed == True,
            func.date(Task.completed_at) == today
        ).count()
        
        task_completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        # Calculate average goals progress and trend
        goals = Goal.query.filter_by(user_id=user_id).all()
        goals_progress = sum(goal.progress for goal in goals) / len(goals) if goals else 0
        
        # Calculate habit consistency and streaks
        habits = Habit.query.filter_by(user_id=user_id).all()
        active_habits = sum(1 for habit in habits if habit.current_streak > 0)
        avg_streak = sum(habit.current_streak for habit in habits) / len(habits) if habits else 0
        
        # Calculate focus time (from Pomodoro sessions)
        focus_time = UserAnalytics.query.filter_by(
            user_id=user_id,
            date=today
        ).with_entities(func.sum(UserAnalytics.focus_time)).scalar() or 0
        
        # Calculate productivity score with weighted factors
        productivity_score = (
            (task_completion_rate * 0.3) +
            (goals_progress * 0.3) +
            (min((active_habits / max(len(habits), 1)) * 100, 100) * 0.2) +
            (min((focus_time / 240) * 100, 100) * 0.2)  # 240 minutes (4 hours) as target
        )
        
        # Create or update analytics record
        analytics = UserAnalytics.query.filter_by(
            user_id=user_id,
            date=today
        ).first()
        
        if not analytics:
            analytics = UserAnalytics(
                user_id=user_id,
                date=today,
                tasks_completed=completed_tasks,
                goals_progress=goals_progress,
                active_habits=active_habits,
                focus_time=focus_time,
                productivity_score=min(productivity_score, 100)
            )
            db.session.add(analytics)
        else:
            analytics.tasks_completed = completed_tasks
            analytics.goals_progress = goals_progress
            analytics.active_habits = active_habits
            analytics.focus_time = focus_time
            analytics.productivity_score = min(productivity_score, 100)
        
        db.session.commit()
        return analytics

    @staticmethod
    def generate_insights(user_id):
        """Generate comprehensive AI-driven insights based on user's data"""
        # Get user's analytics for the past week
        week_ago = datetime.utcnow().date() - timedelta(days=7)
        analytics = UserAnalytics.query.filter(
            UserAnalytics.user_id == user_id,
            UserAnalytics.date >= week_ago
        ).order_by(UserAnalytics.date.asc()).all()
        
        if not analytics:
            return None
            
        # Prepare detailed analytics data for AI
        analytics_data = {
            'productivity_trend': [
                {
                    'date': a.date.strftime('%Y-%m-%d'),
                    'score': a.productivity_score,
                    'tasks_completed': a.tasks_completed,
                    'active_habits': a.active_habits,
                    'focus_time': a.focus_time,
                    'goals_progress': a.goals_progress
                }
                for a in analytics
            ],
            'goals': [
                {
                    'title': goal.title,
                    'progress': goal.progress,
                    'days_left': (goal.target_date - datetime.utcnow()).days
                }
                for goal in Goal.query.filter_by(user_id=user_id).all()
            ],
            'habits': [
                {
                    'title': habit.title,
                    'streak': habit.current_streak,
                    'best_streak': habit.best_streak
                }
                for habit in Habit.query.filter_by(user_id=user_id).all()
            ]
        }
        
        # Generate insights using OpenAI
        try:
            completion = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": """You are an advanced productivity and personal development analyst. 
                    Analyze the user's performance data and provide detailed insights and actionable recommendations.
                    Focus on patterns, trends, and areas for improvement. Include specific suggestions for improving productivity,
                    maintaining habits, and achieving goals."""},
                    {"role": "user", "content": f"Weekly analytics data: {analytics_data}"}
                ]
            )
            
            insight_content = completion.choices[0].message.content
            
            # Parse recommendations and insights
            parts = insight_content.split('\n\nRecommendations:')
            analysis = parts[0]
            recommendations = parts[1] if len(parts) > 1 else None
            
            # Generate multiple targeted insights
            insights = []
            
            # Productivity insight
            if any(a.productivity_score < 70 for a in analytics):
                insights.append(AIInsight(
                    user_id=user_id,
                    insight_type='productivity',
                    content=f"Productivity Analysis:\n{analysis}",
                    recommendations=recommendations
                ))
            
            # Goals insight
            goals = Goal.query.filter(
                Goal.user_id == user_id,
                Goal.progress < 100
            ).all()
            if goals:
                goals_analysis = [f"Goal '{goal.title}' is {goal.progress}% complete" for goal in goals]
                insights.append(AIInsight(
                    user_id=user_id,
                    insight_type='goals',
                    content=f"Goals Progress:\n{'. '.join(goals_analysis)}",
                    recommendations=f"Focus on completing goals that are close to completion. Break down larger goals into smaller tasks."
                ))
            
            # Habits insight
            habits = Habit.query.filter(
                Habit.user_id == user_id,
                Habit.current_streak < Habit.best_streak
            ).all()
            if habits:
                habits_analysis = [f"Habit '{habit.title}' streak: {habit.current_streak} days (best: {habit.best_streak})" for habit in habits]
                insights.append(AIInsight(
                    user_id=user_id,
                    insight_type='habits',
                    content=f"Habits Analysis:\n{'. '.join(habits_analysis)}",
                    recommendations=f"Work on rebuilding streaks for habits that have fallen below your best performance."
                ))
            
            # Save all insights
            for insight in insights:
                db.session.add(insight)
            db.session.commit()
            
            return insights
            
        except Exception as e:
            print(f"Error generating insights: {str(e)}")
            return None

    @staticmethod
    def get_user_insights(user_id, limit=5):
        """Get recent insights for a user"""
        return AIInsight.query.filter_by(
            user_id=user_id,
            is_acknowledged=False
        ).order_by(AIInsight.created_at.desc()).limit(limit).all()

    @staticmethod
    def get_productivity_trends(user_id, days=30):
        """Get detailed productivity trends for visualization"""
        start_date = datetime.utcnow().date() - timedelta(days=days)
        analytics = UserAnalytics.query.filter(
            UserAnalytics.user_id == user_id,
            UserAnalytics.date >= start_date
        ).order_by(UserAnalytics.date.asc()).all()
        
        return {
            'dates': [a.date.strftime('%Y-%m-%d') for a in analytics],
            'productivity_scores': [a.productivity_score for a in analytics],
            'tasks_completed': [a.tasks_completed for a in analytics],
            'active_habits': [a.active_habits for a in analytics],
            'focus_time': [a.focus_time for a in analytics],
            'goals_progress': [a.goals_progress for a in analytics]
        }

    @staticmethod
    def get_completion_rate_by_priority(user_id, days=7):
        """Get task completion rates grouped by priority"""
        start_date = datetime.utcnow().date() - timedelta(days=days)
        tasks = Task.query.filter(
            Task.user_id == user_id,
            Task.created_at >= start_date
        ).all()
        
        completion_rates = {}
        for priority in ['urgent', 'important', 'normal']:
            priority_tasks = [t for t in tasks if t.priority == priority]
            if priority_tasks:
                completed = len([t for t in priority_tasks if t.completed])
                completion_rates[priority] = (completed / len(priority_tasks)) * 100
            else:
                completion_rates[priority] = 0
                
        return completion_rates
