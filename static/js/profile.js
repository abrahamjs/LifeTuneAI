document.addEventListener('DOMContentLoaded', function() {
    loadProfile();
    initializeNotifications();
    startChallengeTimer();
    
    // Refresh data every minute
    setInterval(loadProfile, 60000);
});

function loadProfile() {
    fetch('/api/gamification/profile')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            try {
                updateProfileInfo(data);
                updateAchievements(data.achievements || []);
                updateChallenges(data.daily_challenges || []);
                checkForLevelUp(data);
            } catch (error) {
                console.error('Error updating profile:', error);
                showNotification('Error updating profile information', 'error');
            }
        })
        .catch(error => {
            console.error('Error loading profile:', error);
            showNotification('Unable to load profile data', 'error');
            // Set default values for UI elements
            setDefaultProfileValues();
        });
}

function setDefaultProfileValues() {
    // Set default values when data is unavailable
    document.getElementById('currentLevel').textContent = '1';
    document.getElementById('xpProgress').style.width = '0%';
    document.getElementById('xpText').textContent = 'XP: 0 / 100';
    document.getElementById('streakCount').textContent = '0';
    document.getElementById('multiplier').textContent = '1.0';
    document.getElementById('achievementsList').innerHTML = '<p class="text-muted">No achievements available</p>';
    document.getElementById('challengesList').innerHTML = '<p class="text-muted">No active challenges</p>';
}

function updateProfileInfo(data) {
    try {
        document.getElementById('currentLevel').textContent = data.level || 1;
        document.getElementById('xpProgress').style.width = `${data.xp_progress || 0}%`;
        document.getElementById('xpText').textContent = `XP: ${data.experience_points || 0} / ${(data.experience_points || 0) + (data.xp_needed || 100)}`;
        document.getElementById('streakCount').textContent = data.daily_streak || 0;
        document.getElementById('multiplier').textContent = (data.multiplier || 1.0).toFixed(1);
    } catch (error) {
        console.error('Error updating profile info:', error);
        setDefaultProfileValues();
    }
}

function updateAchievements(achievements) {
    try {
        const container = document.getElementById('achievementsList');
        if (!achievements.length) {
            container.innerHTML = '<p class="text-muted">No achievements unlocked yet</p>';
            return;
        }

        container.innerHTML = achievements.map(achievement => `
            <div class="achievement-card" data-achievement-id="${achievement.badge_type || ''}">
                <div class="achievement-icon">
                    ${getAchievementIcon(achievement.badge_type)}
                </div>
                <h6>${achievement.name || 'Unknown Achievement'}</h6>
                <small class="text-muted">${achievement.description || ''}</small>
                <div class="mt-2">
                    <span class="badge bg-success">+${achievement.points_awarded || 0} XP</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error updating achievements:', error);
        document.getElementById('achievementsList').innerHTML = '<p class="text-muted">Error loading achievements</p>';
    }
}

function updateChallenges(challenges) {
    try {
        const container = document.getElementById('challengesList');
        if (!challenges.length) {
            container.innerHTML = '<p class="text-muted">No active challenges</p>';
            return;
        }

        container.innerHTML = challenges.map(challenge => `
            <div class="challenge-card ${challenge.completed ? 'completed' : ''}"
                 data-challenge-type="${challenge.type || ''}">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6>${getChallengeTitle(challenge.type)}</h6>
                        <p class="mb-2 text-muted">
                            Progress: ${challenge.current || 0}/${challenge.target || 0}
                        </p>
                    </div>
                    <span class="badge bg-primary">+${challenge.reward || 0} XP</span>
                </div>
                <div class="progress challenge-progress">
                    <div class="progress-bar" role="progressbar" 
                         style="width: ${((challenge.current || 0) / (challenge.target || 1) * 100)}%"></div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error updating challenges:', error);
        document.getElementById('challengesList').innerHTML = '<p class="text-muted">Error loading challenges</p>';
    }
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
        { icon: 'bi-graph-up', description: 'Increased XP gain' }
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