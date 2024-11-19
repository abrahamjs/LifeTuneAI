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
        
        # Calculate goal completion prediction
        goals_prediction = AnalyticsService.predict_goal_completion(user_id)
        
        # Calculate task efficiency (average time to complete tasks)
        task_efficiency = AnalyticsService.calculate_task_efficiency(user_id)
        
        # Calculate habit impact score
        habit_impact = AnalyticsService.calculate_habit_impact(user_id)
        
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
                productivity_score=min(productivity_score, 100),
                goal_completion_prediction=goals_prediction,
                task_efficiency_score=task_efficiency,
                habit_impact_score=habit_impact
            )
            db.session.add(analytics)
        else:
            analytics.tasks_completed = completed_tasks
            analytics.goals_progress = goals_progress
            analytics.active_habits = active_habits
            analytics.focus_time = focus_time
            analytics.productivity_score = min(productivity_score, 100)
            analytics.goal_completion_prediction = goals_prediction
            analytics.task_efficiency_score = task_efficiency
            analytics.habit_impact_score = habit_impact
        
        db.session.commit()
        return analytics

    @staticmethod
    def predict_goal_completion(user_id):
        """Predict likelihood of completing current goals on time"""
        goals = Goal.query.filter_by(user_id=user_id).all()
        if not goals:
            return 0
        
        completion_likelihood = 0
        for goal in goals:
            days_left = (goal.target_date - datetime.utcnow()).days
            if days_left <= 0:
                continue
                
            daily_progress_needed = (100 - goal.progress) / max(days_left, 1)
            # Calculate average daily progress from past week
            week_ago = datetime.utcnow() - timedelta(days=7)
            analytics = UserAnalytics.query.filter(
                UserAnalytics.user_id == user_id,
                UserAnalytics.date >= week_ago
            ).all()
            
            avg_daily_progress = sum(a.goals_progress for a in analytics) / len(analytics) if analytics else 0
            goal_likelihood = min((avg_daily_progress / daily_progress_needed) * 100, 100) if daily_progress_needed > 0 else 100
            completion_likelihood += goal_likelihood
            
        return completion_likelihood / len(goals)

    @staticmethod
    def calculate_task_efficiency(user_id):
        """Calculate task efficiency score based on completion time and priority"""
        completed_tasks = Task.query.filter(
            Task.user_id == user_id,
            Task.completed == True,
            Task.completed_at.isnot(None)
        ).all()
        
        if not completed_tasks:
            return 0
            
        efficiency_scores = []
        for task in completed_tasks:
            completion_time = task.completed_at - task.created_at
            expected_time = timedelta(days={
                'urgent': 1,
                'important': 3,
                'normal': 7
            }.get(task.priority, 7))
            
            score = min((expected_time / completion_time).total_seconds() * 100, 100) if completion_time > timedelta(0) else 100
            efficiency_scores.append(score)
            
        return sum(efficiency_scores) / len(efficiency_scores)

    @staticmethod
    def calculate_habit_impact(user_id):
        """Calculate the impact of habits on overall productivity"""
        habits = Habit.query.filter_by(user_id=user_id).all()
        if not habits:
            return 0
            
        total_impact = 0
        for habit in habits:
            # Calculate consistency
            consistency = habit.current_streak / max(habit.best_streak, 1)
            # Calculate longevity
            days_active = (datetime.utcnow() - habit.created_at).days
            longevity_factor = min(days_active / 30, 1)  # Cap at 30 days
            # Calculate frequency impact
            frequency_multiplier = 1.5 if habit.frequency == 'daily' else 1.0
            
            habit_score = (consistency * 0.4 + longevity_factor * 0.3) * frequency_multiplier * 100
            total_impact += habit_score
            
        return min(total_impact / len(habits), 100)

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
                    'goals_progress': a.goals_progress,
                    'task_efficiency': a.task_efficiency_score,
                    'habit_impact': a.habit_impact_score,
                    'goal_completion_prediction': a.goal_completion_prediction
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
                    'best_streak': habit.best_streak,
                    'frequency': habit.frequency
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
                    maintaining habits, and achieving goals. Consider task efficiency, habit impact, and goal completion predictions
                    in your analysis."""},
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
            
            # Task efficiency insight
            low_efficiency = any(a.task_efficiency_score < 60 for a in analytics)
            if low_efficiency:
                insights.append(AIInsight(
                    user_id=user_id,
                    insight_type='efficiency',
                    content=f"Your task completion efficiency has room for improvement. Consider breaking down complex tasks and prioritizing more effectively.",
                    recommendations="Try the Pomodoro technique for better focus and time management."
                ))
            
            # Goals insight with completion predictions
            goals = Goal.query.filter(
                Goal.user_id == user_id,
                Goal.progress < 100
            ).all()
            if goals:
                goals_analysis = [
                    f"Goal '{goal.title}' is {goal.progress}% complete with "
                    f"{(goal.target_date - datetime.utcnow()).days} days remaining"
                    for goal in goals
                ]
                insights.append(AIInsight(
                    user_id=user_id,
                    insight_type='goals',
                    content=f"Goals Progress:\n{'. '.join(goals_analysis)}",
                    recommendations=f"Focus on completing goals that are close to completion. Break down larger goals into smaller tasks."
                ))
            
            # Habits insight with impact analysis
            habits = Habit.query.filter(
                Habit.user_id == user_id,
                Habit.current_streak < Habit.best_streak
            ).all()
            if habits:
                habits_analysis = [
                    f"Habit '{habit.title}' streak: {habit.current_streak} days (best: {habit.best_streak})"
                    for habit in habits
                ]
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
            'goals_progress': [a.goals_progress for a in analytics],
            'task_efficiency': [a.task_efficiency_score for a in analytics],
            'habit_impact': [a.habit_impact_score for a in analytics],
            'goal_predictions': [a.goal_completion_prediction for a in analytics]
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
