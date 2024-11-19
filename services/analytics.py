import os
from datetime import datetime, timedelta
from sqlalchemy import func
import openai
from models import Task, Goal, Habit, UserAnalytics, AIInsight
from database import db

class AnalyticsService:
    @staticmethod
    def calculate_daily_analytics(user_id):
        """Calculate daily analytics for a user"""
        today = datetime.utcnow().date()
        
        # Get completed tasks count
        tasks_completed = Task.query.filter(
            Task.user_id == user_id,
            Task.completed == True,
            func.date(Task.completed_at) == today
        ).count()
        
        # Calculate average goals progress
        goals = Goal.query.filter_by(user_id=user_id).all()
        goals_progress = sum(goal.progress for goal in goals) / len(goals) if goals else 0
        
        # Get active habits count
        active_habits = Habit.query.filter(
            Habit.user_id == user_id,
            Habit.current_streak > 0
        ).count()
        
        # Calculate productivity score (simple weighted average)
        productivity_score = (
            (tasks_completed * 0.4) +
            (goals_progress * 0.4) +
            (active_habits * 0.2)
        ) * 100
        
        # Create or update analytics record
        analytics = UserAnalytics.query.filter_by(
            user_id=user_id,
            date=today
        ).first()
        
        if not analytics:
            analytics = UserAnalytics(
                user_id=user_id,
                date=today,
                tasks_completed=tasks_completed,
                goals_progress=goals_progress,
                active_habits=active_habits,
                productivity_score=min(productivity_score, 100)
            )
            db.session.add(analytics)
        else:
            analytics.tasks_completed = tasks_completed
            analytics.goals_progress = goals_progress
            analytics.active_habits = active_habits
            analytics.productivity_score = min(productivity_score, 100)
        
        db.session.commit()
        return analytics

    @staticmethod
    def generate_insights(user_id):
        """Generate AI-driven insights based on user's data"""
        # Get user's analytics for the past week
        week_ago = datetime.utcnow().date() - timedelta(days=7)
        analytics = UserAnalytics.query.filter(
            UserAnalytics.user_id == user_id,
            UserAnalytics.date >= week_ago
        ).all()
        
        if not analytics:
            return None
            
        # Prepare analytics data for AI
        productivity_trend = [
            {
                'date': a.date.strftime('%Y-%m-%d'),
                'score': a.productivity_score,
                'tasks': a.tasks_completed,
                'habits': a.active_habits
            }
            for a in analytics
        ]
        
        # Generate insights using OpenAI
        try:
            completion = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a productivity and personal development analyst. Analyze the user's weekly performance data and provide actionable insights and recommendations."},
                    {"role": "user", "content": f"Weekly productivity data: {productivity_trend}"}
                ]
            )
            
            insight_content = completion.choices[0].message.content
            
            # Store the insight
            insight = AIInsight(
                user_id=user_id,
                insight_type='productivity',
                content=insight_content,
                recommendations=insight_content.split('\n\nRecommendations:')[-1] if 'Recommendations:' in insight_content else None
            )
            
            db.session.add(insight)
            db.session.commit()
            
            return insight
            
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
