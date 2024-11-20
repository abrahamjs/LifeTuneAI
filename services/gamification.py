from datetime import datetime, timedelta
from models import (
    User, Achievement, DailyChallenge, Task, Goal, Habit,
    db
)

class GamificationService:
    # XP Constants
    TASK_COMPLETION_XP = 50
    GOAL_COMPLETION_XP = 200
    HABIT_STREAK_XP = 25
    DAILY_CHALLENGE_XP = 100
    
    # Level thresholds (XP needed for each level)
    @staticmethod
    def get_level_threshold(level):
        return int(100 * (level ** 1.5))
    
    @staticmethod
    def calculate_level(xp):
        level = 1
        while GamificationService.get_level_threshold(level) <= xp:
            level += 1
        return level - 1
    
    @staticmethod
    def award_experience(user_id, xp_amount, multiplier=1.0):
        user = User.query.get(user_id)
        if not user:
            return False
            
        # Apply multiplier to XP gain
        xp_gained = int(xp_amount * multiplier)
        user.experience_points += xp_gained
        
        # Check for level up
        new_level = GamificationService.calculate_level(user.experience_points)
        if new_level > user.level:
            user.level = new_level
            # Award level-up achievement
            GamificationService.award_achievement(
                user_id,
                f"Reached Level {new_level}",
                f"Congratulations! You've reached level {new_level}",
                "level_up",
                bonus_xp=50
            )
        
        db.session.commit()
        return True
    
    @staticmethod
    def award_achievement(user_id, name, description, badge_type, bonus_xp=0):
        # Check if achievement already earned
        existing = Achievement.query.filter_by(
            user_id=user_id,
            name=name
        ).first()
        
        if existing:
            return False
            
        achievement = Achievement(
            user_id=user_id,
            name=name,
            description=description,
            badge_type=badge_type,
            points_awarded=bonus_xp
        )
        
        db.session.add(achievement)
        if bonus_xp > 0:
            GamificationService.award_experience(user_id, bonus_xp)
            
        db.session.commit()
        return True
    
    @staticmethod
    def process_task_completion(user_id, task):
        # Award base XP for task completion
        user = User.query.get(user_id)
        if not user:
            return False
            
        xp = GamificationService.TASK_COMPLETION_XP
        
        # Bonus XP for priority tasks
        if task.priority == 'urgent':
            xp *= 1.5
        elif task.priority == 'important':
            xp *= 1.2
            
        # Award XP with user's current multiplier
        GamificationService.award_experience(user_id, xp, user.current_multiplier)
        
        # Check for achievements
        tasks_completed = Task.query.filter_by(
            user_id=user_id,
            completed=True
        ).count()
        
        # Task milestone achievements
        milestones = {
            10: ("Task Novice", "Complete 10 tasks"),
            50: ("Task Expert", "Complete 50 tasks"),
            100: ("Task Master", "Complete 100 tasks"),
            500: ("Task Legend", "Complete 500 tasks")
        }
        
        for count, (name, desc) in milestones.items():
            if tasks_completed >= count:
                GamificationService.award_achievement(
                    user_id, name, desc, "task_master", bonus_xp=50
                )
        
        return True
    
    @staticmethod
    def process_goal_completion(user_id, goal):
        user = User.query.get(user_id)
        if not user:
            return False
            
        # Award XP for goal completion
        GamificationService.award_experience(
            user_id,
            GamificationService.GOAL_COMPLETION_XP,
            user.current_multiplier
        )
        
        # Check for goal-related achievements
        goals_completed = Goal.query.filter_by(
            user_id=user_id,
            progress=100
        ).count()
        
        # Goal milestone achievements
        milestones = {
            5: ("Goal Setter", "Complete 5 goals"),
            25: ("Goal Crusher", "Complete 25 goals"),
            50: ("Goal Master", "Complete 50 goals")
        }
        
        for count, (name, desc) in milestones.items():
            if goals_completed >= count:
                GamificationService.award_achievement(
                    user_id, name, desc, "goal_achiever", bonus_xp=100
                )
        
        return True
    
    @staticmethod
    def process_habit_streak(user_id, habit):
        user = User.query.get(user_id)
        if not user:
            return False
            
        # Award XP for maintaining streak
        streak_xp = GamificationService.HABIT_STREAK_XP * (1 + (habit.current_streak * 0.1))
        GamificationService.award_experience(
            user_id,
            int(streak_xp),
            user.current_multiplier
        )
        
        # Streak milestone achievements
        milestones = {
            7: ("Week Warrior", "Maintain a 7-day streak"),
            30: ("Monthly Master", "Maintain a 30-day streak"),
            100: ("Habit Hero", "Maintain a 100-day streak")
        }
        
        for days, (name, desc) in milestones.items():
            if habit.current_streak >= days:
                GamificationService.award_achievement(
                    user_id, name, desc, "habit_hero", bonus_xp=75
                )
        
        return True
    
    @staticmethod
    def generate_daily_challenges(user_id):
        """Generate new daily challenges for a user"""
        today = datetime.utcnow().date()
        
        # Clear old uncompleted challenges
        DailyChallenge.query.filter_by(
            user_id=user_id,
            completed=False
        ).delete()
        
        # Generate new challenges
        challenges = [
            {
                'type': 'task_completion',
                'target': 3,
                'reward': 100,
                'description': "Complete 3 tasks today"
            },
            {
                'type': 'habit_streak',
                'target': 1,
                'reward': 50,
                'description': "Maintain a habit streak"
            },
            {
                'type': 'goal_progress',
                'target': 10,
                'reward': 75,
                'description': "Make 10% progress on any goal"
            }
        ]
        
        for challenge in challenges:
            new_challenge = DailyChallenge(
                user_id=user_id,
                challenge_type=challenge['type'],
                target_value=challenge['target'],
                reward_points=challenge['reward'],
                date=today
            )
            db.session.add(new_challenge)
        
        db.session.commit()
    
    @staticmethod
    def update_streak_and_multiplier(user_id):
        """Update user's daily streak and multiplier"""
        user = User.query.get(user_id)
        if not user:
            return False
            
        today = datetime.utcnow()
        
        # Check if user logged in today
        if not user.last_login or user.last_login.date() < today.date():
            # If last login was yesterday, increment streak
            if user.last_login and user.last_login.date() == today.date() - timedelta(days=1):
                user.daily_streak += 1
                # Update multiplier (caps at 2.0)
                user.current_multiplier = min(1 + (user.daily_streak * 0.1), 2.0)
            else:
                # Reset streak if missed a day
                user.daily_streak = 1
                user.current_multiplier = 1.0
            
            user.last_login = today
            
            # Generate new daily challenges
            GamificationService.generate_daily_challenges(user_id)
            
            db.session.commit()
        
        return True
