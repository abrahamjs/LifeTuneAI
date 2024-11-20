from datetime import datetime, timedelta
from models import (
    User, Achievement, DailyChallenge, Task, Goal, Habit,
    SeasonalEvent, EventParticipants, db
)

class GamificationService:
    # Enhanced XP Constants
    TASK_COMPLETION_XP = {
        'normal': 50,
        'important': 75,
        'urgent': 100
    }
    GOAL_COMPLETION_XP = {
        'small': 200,
        'medium': 400,
        'large': 600
    }
    HABIT_STREAK_XP = {
        'base': 25,
        'bonus_per_day': 5,
        'max_bonus': 100
    }
    CHALLENGE_XP = {
        'easy': 100,
        'medium': 200,
        'hard': 300
    }
    
    # Achievement Categories
    ACHIEVEMENT_CATEGORIES = {
        'productivity': ['task_master', 'goal_achiever', 'habit_hero'],
        'social': ['team_player', 'mentor', 'community_leader'],
        'seasonal': ['spring_champion', 'summer_warrior', 'fall_achiever', 'winter_master'],
        'special': ['early_bird', 'night_owl', 'weekend_warrior']
    }
    
    @staticmethod
    def get_level_threshold(level):
        # Enhanced leveling curve
        base_xp = 100
        scaling_factor = 1.5
        return int(base_xp * (level ** scaling_factor))
    
    @staticmethod
    def calculate_level(xp):
        level = 1
        while GamificationService.get_level_threshold(level) <= xp:
            level += 1
        return level - 1
    
    @staticmethod
    def process_task_completion(user_id, task):
        # Award XP based on task priority
        xp_amount = GamificationService.TASK_COMPLETION_XP[task.priority]
        
        # Get user for streak calculation
        user = User.query.get(user_id)
        if not user:
            return
            
        # Apply streak bonus
        streak_bonus = min(user.daily_streak * 0.05, 0.5)  # Max 50% bonus
        
        # Award XP with streak bonus
        GamificationService.award_experience(
            user_id, 
            xp_amount, 
            multiplier=(1 + streak_bonus)
        )
        
        # Update total tasks completed
        user.total_tasks_completed += 1
        
        # Check for achievements
        GamificationService.check_task_achievements(user)
        
        db.session.commit()
    
    @staticmethod
    def process_goal_completion(user_id, goal):
        # Determine goal size based on number of tasks
        tasks_count = len(goal.tasks)
        if tasks_count <= 3:
            size = 'small'
        elif tasks_count <= 7:
            size = 'medium'
        else:
            size = 'large'
            
        # Award XP
        xp_amount = GamificationService.GOAL_COMPLETION_XP[size]
        GamificationService.award_experience(user_id, xp_amount)
        
        # Update user stats
        user = User.query.get(user_id)
        user.total_goals_completed += 1
        
        # Check for achievements
        GamificationService.check_goal_achievements(user)
        
        db.session.commit()
    
    @staticmethod
    def process_habit_streak(user_id, habit):
        # Calculate streak bonus
        streak_bonus = min(
            habit.current_streak * GamificationService.HABIT_STREAK_XP['bonus_per_day'],
            GamificationService.HABIT_STREAK_XP['max_bonus']
        )
        
        # Award XP with streak bonus
        xp_amount = GamificationService.HABIT_STREAK_XP['base'] + streak_bonus
        GamificationService.award_experience(user_id, xp_amount)
        
        # Update user stats if best streak
        if habit.current_streak > habit.best_streak:
            user = User.query.get(user_id)
            user.longest_streak = max(user.longest_streak, habit.current_streak)
            
            # Check for streak achievements
            GamificationService.check_streak_achievements(user, habit)
            
        db.session.commit()
    
    @staticmethod
    def check_task_achievements(user):
        achievements = [
            (10, "Task Beginner", "Complete 10 tasks", "task_master", "common"),
            (50, "Task Expert", "Complete 50 tasks", "task_master", "rare"),
            (100, "Task Master", "Complete 100 tasks", "task_master", "epic"),
            (500, "Task Legend", "Complete 500 tasks", "task_master", "legendary")
        ]
        
        for count, name, desc, badge, rarity in achievements:
            if user.total_tasks_completed >= count:
                GamificationService.award_achievement(
                    user.id, name, desc, badge,
                    bonus_xp=count,
                    rarity=rarity,
                    category='productivity'
                )
    
    @staticmethod
    def check_goal_achievements(user):
        achievements = [
            (5, "Goal Setter", "Complete 5 goals", "goal_achiever", "common"),
            (20, "Goal Crusher", "Complete 20 goals", "goal_achiever", "rare"),
            (50, "Goal Master", "Complete 50 goals", "goal_achiever", "epic"),
            (100, "Goal Legend", "Complete 100 goals", "goal_achiever", "legendary")
        ]
        
        for count, name, desc, badge, rarity in achievements:
            if user.total_goals_completed >= count:
                GamificationService.award_achievement(
                    user.id, name, desc, badge,
                    bonus_xp=count*2,
                    rarity=rarity,
                    category='productivity'
                )
    
    @staticmethod
    def check_streak_achievements(user, habit):
        achievements = [
            (7, "Habit Builder", "Maintain a 7-day streak", "habit_hero", "common"),
            (30, "Habit Master", "Maintain a 30-day streak", "habit_hero", "rare"),
            (100, "Habit Legend", "Maintain a 100-day streak", "habit_hero", "epic"),
            (365, "Habit God", "Maintain a 365-day streak", "habit_hero", "legendary")
        ]
        
        for days, name, desc, badge, rarity in achievements:
            if habit.current_streak >= days:
                GamificationService.award_achievement(
                    user.id, name, desc, badge,
                    bonus_xp=days,
                    rarity=rarity,
                    category='productivity'
                )
    
    @staticmethod
    def update_streak_and_multiplier(user_id):
        user = User.query.get(user_id)
        if not user:
            return
            
        # Check if user was active today
        today = datetime.utcnow().date()
        if user.last_login and user.last_login.date() == today:
            return
            
        # Check if streak should be maintained or reset
        if user.last_login and (today - user.last_login.date()).days == 1:
            # Maintain streak
            user.daily_streak += 1
            # Update longest streak if applicable
            user.longest_streak = max(user.longest_streak, user.daily_streak)
        else:
            # Reset streak if more than one day has passed
            user.daily_streak = 1
            
        # Update multiplier based on streak
        user.current_multiplier = min(1.0 + (user.daily_streak * 0.1), 2.0)  # Cap at 2x
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
    
    @staticmethod
    def award_experience(user_id, xp_amount, multiplier=1.0, category=None):
        user = User.query.get(user_id)
        if not user:
            return False
            
        # Apply streak bonus and seasonal multipliers
        streak_bonus = min(user.daily_streak * 0.05, 0.5)  # Max 50% bonus from streak
        seasonal_multiplier = GamificationService.get_seasonal_multiplier(user_id)
        
        final_multiplier = multiplier * (1 + streak_bonus) * seasonal_multiplier
        xp_gained = int(xp_amount * final_multiplier)
        
        # Update user XP and check for level up
        old_level = user.level
        user.experience_points += xp_gained
        new_level = GamificationService.calculate_level(user.experience_points)
        
        if new_level > old_level:
            user.level = new_level
            GamificationService.process_level_up(user_id, new_level)
        
        # Update seasonal points if applicable
        if category == 'seasonal':
            user.seasonal_points += xp_gained
        
        db.session.commit()
        return True
    
    @staticmethod
    def get_seasonal_multiplier(user_id):
        current_event = SeasonalEvent.query.filter(
            SeasonalEvent.start_date <= datetime.utcnow(),
            SeasonalEvent.end_date >= datetime.utcnow(),
            SeasonalEvent.active == True
        ).first()
        
        if not current_event:
            return 1.0
            
        participant = EventParticipants.query.filter_by(
            user_id=user_id,
            event_id=current_event.id
        ).first()
        
        if not participant:
            return 1.0
            
        # Calculate bonus based on participation level
        return 1.0 + (min(participant.points / 1000, 0.5))  # Max 50% bonus
