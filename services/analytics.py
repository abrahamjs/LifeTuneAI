import os
from datetime import datetime, timedelta
from sqlalchemy import func, desc, and_, extract
from models import Task, Goal, Habit, UserAnalytics, AIInsight, HabitLog
from database import db
import openai

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
        
        # Calculate weekly pattern analysis
        weekly_pattern = AnalyticsService.analyze_weekly_pattern(user_id)
        
        # Calculate goal completion prediction
        goals_prediction = AnalyticsService.predict_goal_completion(user_id)
        
        # Calculate task efficiency
        task_efficiency = AnalyticsService.calculate_task_efficiency(user_id)
        
        # Calculate habit impact score with consistency analysis
        habit_impact = AnalyticsService.calculate_habit_consistency(user_id)
        
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
                habit_impact_score=habit_impact,
                weekly_pattern=weekly_pattern
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
            analytics.weekly_pattern = weekly_pattern
        
        db.session.commit()
        return analytics

    @staticmethod
    def analyze_weekly_pattern(user_id):
        """Analyze weekly productivity patterns"""
        week_ago = datetime.utcnow() - timedelta(days=7)
        analytics = UserAnalytics.query.filter(
            UserAnalytics.user_id == user_id,
            UserAnalytics.date >= week_ago
        ).all()
        
        # Calculate daily averages
        daily_scores = {}
        for analytic in analytics:
            day_name = analytic.date.strftime('%A')
            if day_name not in daily_scores:
                daily_scores[day_name] = {'total': 0, 'count': 0}
            daily_scores[day_name]['total'] += analytic.productivity_score
            daily_scores[day_name]['count'] += 1
        
        # Calculate most productive days
        productive_days = {
            day: scores['total'] / scores['count']
            for day, scores in daily_scores.items()
        }
        
        return productive_days

    @staticmethod
    def calculate_habit_consistency(user_id):
        """Calculate detailed habit consistency metrics"""
        habits = Habit.query.filter_by(user_id=user_id).all()
        if not habits:
            return 0
            
        consistency_scores = []
        for habit in habits:
            # Calculate consistency
            completion_rate = habit.current_streak / max(habit.best_streak, 1)
            
            # Calculate longevity impact
            days_active = (datetime.utcnow() - habit.created_at).days
            longevity_factor = min(days_active / 30, 1)  # Cap at 30 days
            
            # Calculate recent completion pattern
            recent_logs = HabitLog.query.filter(
                HabitLog.habit_id == habit.id,
                HabitLog.completed_at >= datetime.utcnow() - timedelta(days=30)
            ).order_by(HabitLog.completed_at.desc()).all()
            
            completion_pattern = len(recent_logs) / 30  # Percentage of days completed in last 30 days
            
            # Calculate final consistency score
            consistency_score = (
                (completion_rate * 0.4) +
                (longevity_factor * 0.3) +
                (completion_pattern * 0.3)
            ) * 100
            
            consistency_scores.append(consistency_score)
            
        return sum(consistency_scores) / len(consistency_scores)

    @staticmethod
    def predict_goal_completion(user_id):
        """Enhanced goal completion prediction with machine learning insights"""
        goals = Goal.query.filter_by(user_id=user_id).all()
        if not goals:
            return 0
        
        completion_predictions = []
        for goal in goals:
            days_left = (goal.target_date - datetime.utcnow()).days
            if days_left <= 0:
                continue
                
            # Calculate required daily progress
            required_progress = (100 - goal.progress) / max(days_left, 1)
            
            # Analyze historical progress rate
            week_ago = datetime.utcnow() - timedelta(days=7)
            analytics = UserAnalytics.query.filter(
                UserAnalytics.user_id == user_id,
                UserAnalytics.date >= week_ago
            ).order_by(UserAnalytics.date.asc()).all()
            
            if analytics:
                # Calculate average daily progress and trend
                daily_progress_rates = []
                for i in range(len(analytics) - 1):
                    progress_diff = analytics[i + 1].goals_progress - analytics[i].goals_progress
                    daily_progress_rates.append(max(progress_diff, 0))
                
                avg_daily_progress = sum(daily_progress_rates) / len(daily_progress_rates) if daily_progress_rates else 0
                
                # Calculate trend factor
                trend_factor = 1.0
                if len(daily_progress_rates) >= 3:
                    recent_progress = sum(daily_progress_rates[-3:]) / 3
                    if recent_progress > avg_daily_progress:
                        trend_factor = 1.1  # Positive trend
                    elif recent_progress < avg_daily_progress:
                        trend_factor = 0.9  # Negative trend
                
                # Calculate completion likelihood
                completion_likelihood = min((avg_daily_progress * trend_factor / required_progress) * 100, 100)
                completion_predictions.append(completion_likelihood)
            
        return sum(completion_predictions) / len(completion_predictions) if completion_predictions else 0

    @staticmethod
    def calculate_task_efficiency(user_id):
        """Enhanced task efficiency calculation with priority and complexity factors"""
        completed_tasks = Task.query.filter(
            Task.user_id == user_id,
            Task.completed == True,
            Task.completed_at.isnot(None)
        ).all()
        
        if not completed_tasks:
            return 0
            
        efficiency_scores = []
        priority_weights = {'urgent': 1.2, 'important': 1.0, 'normal': 0.8}
        
        for task in completed_tasks:
            completion_time = task.completed_at - task.created_at
            expected_time = timedelta(days={
                'urgent': 1,
                'important': 3,
                'normal': 7
            }.get(task.priority, 7))
            
            # Calculate base efficiency score
            base_score = min((expected_time / completion_time).total_seconds() * 100, 100) if completion_time > timedelta(0) else 100
            
            # Apply priority weight
            weighted_score = base_score * priority_weights.get(task.priority, 1.0)
            
            # Adjust for task complexity (based on description length as a simple metric)
            complexity_factor = 1.0
            if task.description:
                words = len(task.description.split())
                if words > 100:
                    complexity_factor = 1.2
                elif words > 50:
                    complexity_factor = 1.1
            
            final_score = weighted_score * complexity_factor
            efficiency_scores.append(min(final_score, 100))
            
        return sum(efficiency_scores) / len(efficiency_scores)

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
                    'goal_completion_prediction': a.goal_completion_prediction,
                    'weekly_pattern': getattr(a, 'weekly_pattern', {})
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
                    in your analysis. Pay special attention to weekly patterns and productivity trends."""},
                    {"role": "user", "content": f"Weekly analytics data: {analytics_data}"}
                ]
            )
            
            insight_content = completion.choices[0].message.content
            
            # Parse insights and recommendations
            parts = insight_content.split('\n\nRecommendations:')
            analysis = parts[0]
            recommendations = parts[1] if len(parts) > 1 else None
            
            # Generate multiple targeted insights
            insights = []
            
            # Productivity insight with weekly pattern analysis
            productivity_trend = [a.productivity_score for a in analytics]
            if any(score < 70 for score in productivity_trend):
                trend_direction = "improving" if productivity_trend[-1] > productivity_trend[0] else "declining"
                insights.append(AIInsight(
                    user_id=user_id,
                    insight_type='productivity',
                    content=f"Your productivity is {trend_direction}. Weekly pattern shows highest productivity on {max(analytics_data['productivity_trend'][-1]['weekly_pattern'].items(), key=lambda x: x[1])[0]}.",
                    recommendations=recommendations
                ))
            
            # Task efficiency insight with detailed metrics
            low_efficiency = any(a.task_efficiency_score < 60 for a in analytics)
            if low_efficiency:
                insights.append(AIInsight(
                    user_id=user_id,
                    insight_type='efficiency',
                    content="Task efficiency analysis shows room for improvement in completion times and priority management.",
                    recommendations="Focus on breaking down complex tasks and using the Pomodoro technique for better time management."
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
                    recommendations="Focus on completing goals that are close to completion and showing positive progress trends."
                ))
            
            # Habits insight with consistency analysis
            habits = Habit.query.filter(
                Habit.user_id == user_id,
                Habit.current_streak < Habit.best_streak
            ).all()
            if habits:
                habits_analysis = [
                    f"Habit '{habit.title}' current streak: {habit.current_streak} days (best: {habit.best_streak})"
                    for habit in habits
                ]
                insights.append(AIInsight(
                    user_id=user_id,
                    insight_type='habits',
                    content=f"Habits Analysis:\n{'. '.join(habits_analysis)}",
                    recommendations="Work on rebuilding streaks for habits that have fallen below your best performance."
                ))
            
            # Save insights
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
            'goal_predictions': [a.goal_completion_prediction for a in analytics],
            'weekly_patterns': [getattr(a, 'weekly_pattern', {}) for a in analytics]
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
