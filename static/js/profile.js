document.addEventListener('DOMContentLoaded', function() {
    loadProfile();
    initializeNotifications();
    startChallengeTimer();
    
    // Refresh data every minute
    setInterval(loadProfile, 60000);
});

function loadProfile() {
    fetch('/api/gamification/profile')
        .then(response => response.json())
        .then(data => {
            updateProfileInfo(data);
            updateAchievements(data.achievements);
            updateChallenges(data.daily_challenges);
            updateRewardsShop(data);
            checkForLevelUp(data);
        });
}

function updateProfileInfo(data) {
    document.getElementById('currentLevel').textContent = data.level;
    document.getElementById('xpProgress').style.width = `${data.xp_progress}%`;
    document.getElementById('xpText').textContent = `XP: ${data.experience_points} / ${data.experience_points + data.xp_needed}`;
    document.getElementById('streakCount').textContent = data.daily_streak;
    document.getElementById('multiplier').textContent = data.multiplier.toFixed(1);
    document.getElementById('availablePoints').textContent = `Points: ${data.experience_points}`;
}

function updateAchievements(achievements) {
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

function purchaseReward(rewardId) {
    fetch('/api/gamification/purchase-reward', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reward_id: rewardId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Reward Purchased!', 'success');
            loadProfile();
        } else {
            showNotification('Not enough points!', 'error');
        }
    });
}

function checkForLevelUp(data) {
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

function getLevelRewards(level) {
    const rewards = [
        { icon: 'bi-star-fill', description: 'New achievement slots unlocked' },
        { icon: 'bi-graph-up', description: 'Increased XP gain' },
        { icon: 'bi-gift', description: 'Special reward available in shop' }
    ];
    return rewards;
}

function showAchievementModal(achievement) {
    document.getElementById('achievementName').textContent = achievement.name;
    document.getElementById('achievementDescription').textContent = achievement.description;
    document.getElementById('achievementXP').textContent = `+${achievement.points_awarded} XP`;
    
    const modal = new bootstrap.Modal(document.getElementById('achievementModal'));
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
