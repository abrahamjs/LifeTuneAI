from datetime import datetime, timedelta
from models import (
    User, Achievement, DailyChallenge, Task, Goal, Habit,
    db
)
from sqlalchemy.exc import SQLAlchemyError

class GamificationError(Exception):
    """Base exception class for gamification errors"""
    pass

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
        try:
            user = User.query.get(user_id)
            if not user:
                raise GamificationError("User not found")
                
            # Apply multiplier to XP gain
            xp_gained = int(xp_amount * multiplier)
            user.experience_points += xp_gained
            
            # Check for level up
            new_level = GamificationService.calculate_level(user.experience_points)
            if new_level > user.level:
                user.level = new_level
                # Award level-up achievement
                try:
                    GamificationService.award_achievement(
                        user_id,
                        f"Reached Level {new_level}",
                        f"Congratulations! You've reached level {new_level}",
                        "level_up",
                        bonus_xp=50
                    )
                except GamificationError as e:
                    print(f"Failed to award level-up achievement: {str(e)}")
            
            db.session.commit()
            return True, xp_gained
        except SQLAlchemyError as e:
            db.session.rollback()
            raise GamificationError(f"Database error while awarding XP: {str(e)}")
        except Exception as e:
            db.session.rollback()
            raise GamificationError(f"Error awarding experience: {str(e)}")
    
    @staticmethod
    def award_achievement(user_id, name, description, badge_type, bonus_xp=0):
        try:
            # Check if achievement already earned
            existing = Achievement.query.filter_by(
                user_id=user_id,
                name=name
            ).first()
            
            if existing:
                return False, "Achievement already earned"
                
            achievement = Achievement(
                user_id=user_id,
                name=name,
                description=description,
                badge_type=badge_type,
                points_awarded=bonus_xp
            )
            
            db.session.add(achievement)
            if bonus_xp > 0:
                try:
                    success, xp_gained = GamificationService.award_experience(user_id, bonus_xp)
                    if not success:
                        raise GamificationError("Failed to award bonus XP")
                except GamificationError as e:
                    print(f"Failed to award achievement bonus XP: {str(e)}")
                    
            db.session.commit()
            return True, "Achievement unlocked successfully"
        except SQLAlchemyError as e:
            db.session.rollback()
            raise GamificationError(f"Database error while awarding achievement: {str(e)}")
        except Exception as e:
            db.session.rollback()
            raise GamificationError(f"Error awarding achievement: {str(e)}")
    
    @staticmethod
    def process_task_completion(user_id, task):
        try:
            user = User.query.get(user_id)
            if not user:
                raise GamificationError("User not found")
                
            xp = GamificationService.TASK_COMPLETION_XP
            
            # Bonus XP for priority tasks
            if task.priority == 'urgent':
                xp *= 1.5
            elif task.priority == 'important':
                xp *= 1.2
                
            # Award XP with user's current multiplier
            success, xp_gained = GamificationService.award_experience(user_id, xp, user.current_multiplier)
            if not success:
                raise GamificationError("Failed to award task completion XP")
            
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
                    try:
                        GamificationService.award_achievement(
                            user_id, name, desc, "task_master", bonus_xp=50
                        )
                    except GamificationError as e:
                        print(f"Failed to award task milestone achievement: {str(e)}")
            
            # Update daily challenges
            GamificationService.update_daily_challenge(user_id, 'task_completion', 1)
            
            return True, xp_gained
        except Exception as e:
            raise GamificationError(f"Error processing task completion: {str(e)}")
    
    @staticmethod
    def update_daily_challenge(user_id, challenge_type, progress_amount):
        try:
            today = datetime.utcnow().date()
            challenge = DailyChallenge.query.filter_by(
                user_id=user_id,
                challenge_type=challenge_type,
                date=today,
                completed=False
            ).first()
            
            if challenge:
                challenge.current_value += progress_amount
                if challenge.current_value >= challenge.target_value:
                    challenge.completed = True
                    # Award XP for completing challenge
                    try:
                        GamificationService.award_experience(
                            user_id,
                            challenge.reward_points
                        )
                    except GamificationError as e:
                        print(f"Failed to award challenge completion XP: {str(e)}")
                
                db.session.commit()
                return True, "Challenge updated successfully"
        except SQLAlchemyError as e:
            db.session.rollback()
            raise GamificationError(f"Database error while updating challenge: {str(e)}")
        except Exception as e:
            raise GamificationError(f"Error updating daily challenge: {str(e)}")
    
    @staticmethod
    def generate_daily_challenges(user_id):
        """Generate new daily challenges for a user"""
        try:
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
            return True, "Daily challenges generated successfully"
        except SQLAlchemyError as e:
            db.session.rollback()
            raise GamificationError(f"Database error while generating challenges: {str(e)}")
        except Exception as e:
            raise GamificationError(f"Error generating daily challenges: {str(e)}")
    
    @staticmethod
    def update_streak_and_multiplier(user_id):
        """Update user's daily streak and multiplier"""
        try:
            user = User.query.get(user_id)
            if not user:
                raise GamificationError("User not found")
                
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
                try:
                    GamificationService.generate_daily_challenges(user_id)
                except GamificationError as e:
                    print(f"Failed to generate daily challenges: {str(e)}")
                
                db.session.commit()
                return True, "Streak and multiplier updated successfully"
            
            return True, "No update needed"
        except SQLAlchemyError as e:
            db.session.rollback()
            raise GamificationError(f"Database error while updating streak: {str(e)}")
        except Exception as e:
            raise GamificationError(f"Error updating streak and multiplier: {str(e)}")
