document.addEventListener('DOMContentLoaded', function() {
    loadProfile();
    loadLeaderboard();
    initializeNotifications();
    startChallengeTimer();
    loadSocialSettings();
    
    // Refresh data every minute
    setInterval(() => {
        loadProfile();
        loadLeaderboard();
    }, 60000);
});

async function loadProfile() {
    try {
        // Show loading state
        updateLoadingState(true);
        
        const response = await fetch('/api/gamification/profile');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        updateProfileInfo(data);
        updateAchievements(data.achievements);
        updateChallenges(data.daily_challenges);
        updateRewardsShop(data);
        checkForLevelUp(data);
    } catch (error) {
        console.error('Error loading profile:', error);
        showNotification('Failed to load profile data. Please try again later.', 'error');
    } finally {
        updateLoadingState(false);
    }
}

function updateLoadingState(isLoading) {
    const elements = ['currentLevel', 'xpProgress', 'streakCount', 'multiplier'];
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.opacity = isLoading ? '0.5' : '1';
        }
    });
    
    // Add loading spinner if loading
    const container = document.querySelector('.profile-card .card-body');
    const existingSpinner = container.querySelector('.loading-spinner');
    if (isLoading && !existingSpinner) {
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner spinner-border text-primary';
        spinner.setAttribute('role', 'status');
        container.prepend(spinner);
    } else if (!isLoading && existingSpinner) {
        existingSpinner.remove();
    }
}

function updateProfileInfo(data) {
    if (!data) return;
    
    document.getElementById('currentLevel').textContent = data.level;
    document.getElementById('xpProgress').style.width = `${data.xp_progress}%`;
    document.getElementById('xpText').textContent = `XP: ${data.experience_points} / ${data.experience_points + data.xp_needed}`;
    document.getElementById('streakCount').textContent = data.daily_streak;
    document.getElementById('multiplier').textContent = data.multiplier.toFixed(1);
    document.getElementById('availablePoints').textContent = `Points: ${data.experience_points}`;
}

function updateAchievements(achievements) {
    if (!achievements) return;
    
    const container = document.getElementById('achievementsList');
    container.innerHTML = achievements.map(achievement => `
        <div class="achievement-card" data-achievement-id="${achievement.badge_type}">
            <div class="achievement-icon">
                ${getAchievementIcon(achievement.badge_type)}
            </div>
            <h6>${achievement.name}</h6>
            <small class="text-muted">${achievement.description}</small>
            <div class="mt-2">
                <span class="badge bg-success">+${achievement.points_awarded} XP</span>
            </div>
        </div>
    `).join('');
}

function updateChallenges(challenges) {
    if (!challenges) return;
    
    const container = document.getElementById('challengesList');
    container.innerHTML = challenges.map(challenge => `
        <div class="challenge-card ${challenge.completed ? 'completed' : ''}"
             data-challenge-type="${challenge.type}">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h6>${getChallengeTitle(challenge.type)}</h6>
                    <p class="mb-2 text-muted">
                        Progress: ${challenge.current}/${challenge.target}
                    </p>
                </div>
                <span class="badge bg-primary">+${challenge.reward} XP</span>
            </div>
            <div class="progress challenge-progress">
                <div class="progress-bar" role="progressbar" 
                     style="width: ${(challenge.current / challenge.target * 100)}%"></div>
            </div>
        </div>
    `).join('');
}

function updateRewardsShop(data) {
    if (!data) return;
    
    const container = document.getElementById('rewardsList');
    const rewards = getAvailableRewards();
    container.innerHTML = rewards.map(reward => `
        <div class="reward-card ${data.experience_points >= reward.cost ? '' : 'locked'}"
             onclick="purchaseReward(${reward.id})">
            <div class="reward-icon mb-2">
                <i class="bi ${reward.icon}"></i>
            </div>
            <h6>${reward.name}</h6>
            <p class="text-muted mb-2">${reward.description}</p>
            <span class="reward-cost">
                <i class="bi bi-coin"></i> ${reward.cost}
            </span>
        </div>
    `).join('');
}

async function purchaseReward(rewardId) {
    try {
        const response = await fetch('/api/gamification/purchase-reward', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reward_id: rewardId })
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            showNotification('Reward Purchased!', 'success');
            await loadProfile();
        } else {
            showNotification(data.message || 'Not enough points!', 'error');
        }
    } catch (error) {
        console.error('Error purchasing reward:', error);
        showNotification('Failed to purchase reward. Please try again.', 'error');
    }
}

function checkForLevelUp(data) {
    if (!data) return;
    
    const oldLevel = parseInt(localStorage.getItem('currentLevel') || '0');
    if (data.level > oldLevel) {
        showLevelUpModal(data.level);
        localStorage.setItem('currentLevel', data.level);
    }
}

function showLevelUpModal(level) {
    document.getElementById('newLevel').textContent = level;
    const rewards = getLevelRewards(level);
    document.getElementById('levelRewards').innerHTML = rewards.map(reward =>
        `<li><i class="bi ${reward.icon}"></i> ${reward.description}</li>`
    ).join('');
    
    const modal = new bootstrap.Modal(document.getElementById('levelUpModal'));
    modal.show();
}

function initializeNotifications() {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
}

function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast achievement-toast show`;
    toast.innerHTML = `
        <div class="toast-header">
            <i class="bi bi-info-circle me-2"></i>
            <strong class="me-auto">${type.toUpperCase()}</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    document.querySelector('.toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function startChallengeTimer() {
    const updateTimer = () => {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const timeLeft = tomorrow - now;
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        
        document.getElementById('challengesTimeLeft').textContent = 
            `Resets in: ${hours}h ${minutes}m`;
    };
    
    updateTimer();
    setInterval(updateTimer, 60000);
}

function getAchievementIcon(type) {
    const icons = {
        'task_master': '<i class="bi bi-check-circle"></i>',
        'goal_achiever': '<i class="bi bi-trophy"></i>',
        'habit_hero': '<i class="bi bi-lightning"></i>',
        'level_up': '<i class="bi bi-star"></i>'
    };
    return icons[type] || '<i class="bi bi-award"></i>';
}

function getChallengeTitle(type) {
    const titles = {
        'task_completion': 'Complete Daily Tasks',
        'habit_streak': 'Maintain Habit Streaks',
        'goal_progress': 'Make Progress on Goals'
    };
    return titles[type] || 'Challenge';
}

function getAvailableRewards() {
    return [
        {
            id: 1,
            name: "Custom Theme",
            description: "Unlock a custom color theme for your dashboard",
            cost: 1000,
            icon: "bi-palette"
        },
        {
            id: 2,
            name: "Premium Badge",
            description: "Show off your dedication with a special profile badge",
            cost: 2000,
            icon: "bi-award"
        },
        {
            id: 3,
            name: "Bonus Multiplier",
            description: "Get 2x XP for the next 24 hours",
            cost: 3000,
            icon: "bi-stars"
        }
    ];
}

async function loadLeaderboard() {
    try {
        const response = await fetch('/api/social/leaderboard');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const users = await response.json();
        
        const container = document.getElementById('leaderboardList');
        container.innerHTML = users.map((user, index) => `
            <div class="leaderboard-card p-3">
                <div class="d-flex align-items-center">
                    <div class="position-${index + 1} leaderboard-position me-3">
                        ${index + 1}
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-0">${user.username}</h6>
                                <small class="text-muted">Level ${user.level}</small>
                            </div>
                            <div class="text-end">
                                <div class="mb-1">${user.experience_points} XP</div>
                                <small>${user.achievements_count} achievements</small>
                            </div>
                        </div>
                    </div>
                    ${user.id !== getCurrentUserId() ? `
                        <button class="btn btn-sm btn-${user.is_following ? 'secondary' : 'primary'} ms-3"
                                onclick="toggleFollow(${user.id}, ${user.is_following})">
                            ${user.is_following ? 'Unfollow' : 'Follow'}
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        showNotification('Failed to load leaderboard data', 'error');
    }
}

async function toggleFollow(userId, isFollowing) {
    try {
        const response = await fetch(`/api/social/${isFollowing ? 'unfollow' : 'follow'}/${userId}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        showNotification(data.message, 'success');
        
        // Reload leaderboard to update follow buttons
        loadLeaderboard();
        loadProfile();
    } catch (error) {
        console.error('Error toggling follow:', error);
        showNotification('Failed to update follow status', 'error');
    }
}

function loadSocialSettings() {
    const visibility = document.getElementById('profileVisibility');
    const achievements = document.getElementById('sharedAchievements');
    const goals = document.getElementById('sharedGoals');
    
    fetch('/api/social/settings')
        .then(response => response.json())
        .then(data => {
            visibility.value = data.profile_visibility;
            achievements.checked = data.shared_achievements;
            goals.checked = data.shared_goals;
        })
        .catch(error => {
            console.error('Error loading social settings:', error);
            showNotification('Failed to load social settings', 'error');
        });
}

async function saveSocialSettings() {
    try {
        const visibility = document.getElementById('profileVisibility').value;
        const achievements = document.getElementById('sharedAchievements').checked;
        const goals = document.getElementById('sharedGoals').checked;
        
        const response = await fetch('/api/social/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                profile_visibility: visibility,
                shared_achievements: achievements,
                shared_goals: goals
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('socialSettingsModal'));
        modal.hide();
        showNotification('Social settings updated successfully', 'success');
    } catch (error) {
        console.error('Error saving social settings:', error);
        showNotification('Failed to update social settings', 'error');
    }
}

function getCurrentUserId() {
    // Get the current user's ID from a data attribute in the profile page
    return parseInt(document.querySelector('[data-user-id]')?.dataset.userId || '0');
}

function getLevelRewards(level) {
    // This function should be implemented to fetch level rewards from the API
    // or any other source. This is just a placeholder for now.
    return [
        {
            icon: "bi-trophy",
            description: "Unlocked a new Achievement"
        },
        {
            icon: "bi-star",
            description: "Increased XP multiplier"
        }
    ];
}