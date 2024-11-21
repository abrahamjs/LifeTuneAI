let lastLoadedActivityId = null;
let isLoading = false;
let selectedFilter = 'all';

document.addEventListener('DOMContentLoaded', function() {
    loadUserProfile();
    setupActivityFilters();
    loadActivityFeed();
    setupPrivacyForm();
    setupInfiniteScroll();
    setupRealTimeUpdates();
});

function loadUserProfile() {
    fetch('/api/social/profile')
        .then(response => response.json())
        .then(data => {
            document.getElementById('username').textContent = data.username;
            document.getElementById('userLevel').textContent = data.level;
            document.getElementById('followersCount').textContent = data.followers_count;
            document.getElementById('followingCount').textContent = data.following_count;
            
            // Set privacy settings
            document.getElementById('shareAchievements').checked = data.privacy_settings.share_achievements;
            document.getElementById('shareGoals').checked = data.privacy_settings.share_goals;
            document.getElementById('shareHabits').checked = data.privacy_settings.share_habits;
            document.getElementById('profileVisible').checked = data.privacy_settings.profile_visible;
        })
        .catch(error => console.error('Error loading profile:', error));
}

function loadActivityFeed() {
    fetch('/api/social/activity-feed')
        .then(response => response.json())
        .then(activities => {
            const feed = document.getElementById('activityFeed');
            feed.innerHTML = activities.map(activity => `
                <div class="activity-card mb-3">
                    <div class="card">
                        <div class="card-body">
                            ${getActivityContent(activity)}
                            <div class="activity-meta text-muted mt-2">
                                <small>${new Date(activity.created_at).toLocaleString()}</small>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        })
        .catch(error => console.error('Error loading activity feed:', error));
}

function getActivityContent(activity) {
    switch(activity.activity_type) {
        case 'achievement_earned':
            return `
                <div class="achievement-earned">
                    <i class="bi bi-trophy"></i>
                    <strong>${activity.content.username}</strong> earned the achievement
                    <strong>${activity.content.achievement_name}</strong>
                </div>
            `;
        case 'goal_completed':
            return `
                <div class="goal-completed">
                    <i class="bi bi-flag"></i>
                    <strong>${activity.content.username}</strong> completed the goal
                    <strong>${activity.content.goal_title}</strong>
                </div>
            `;
        case 'following_new_user':
            return `
                <div class="new-following">
                    <i class="bi bi-person-plus"></i>
                    <strong>${activity.content.username}</strong> started following
                    <strong>${activity.content.followed_username}</strong>
                </div>
            `;
        default:
            return `<div class="activity-content">${activity.content}</div>`;
    }
}

function setupPrivacyForm() {
    document.getElementById('privacySettingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const settings = {
            share_achievements: document.getElementById('shareAchievements').checked,
            share_goals: document.getElementById('shareGoals').checked,
            share_habits: document.getElementById('shareHabits').checked,
            profile_visible: document.getElementById('profileVisible').checked
        };
        
        fetch('/api/social/privacy-settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                showNotification('Privacy settings updated successfully', 'success');
            } else {
                showNotification('Error updating privacy settings', 'error');
            }
        })
        .catch(error => {
            console.error('Error updating privacy settings:', error);
            showNotification('Error updating privacy settings', 'error');
        });
    });
}

function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast show notification-${type}`;
    toast.innerHTML = `
        <div class="toast-header">
            <strong class="me-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
            ${message}
function setupActivityFilters() {
    const filterContainer = document.createElement('div');
    filterContainer.className = 'activity-filters mb-3';
    filterContainer.innerHTML = `
        <div class="btn-group" role="group">
            <button type="button" class="btn btn-outline-primary active" data-filter="all">All</button>
            <button type="button" class="btn btn-outline-primary" data-filter="achievements">Achievements</button>
            <button type="button" class="btn btn-outline-primary" data-filter="goals">Goals</button>
            <button type="button" class="btn btn-outline-primary" data-filter="habits">Habits</button>
        </div>
    `;
    
    document.querySelector('#activityFeed').parentElement.prepend(filterContainer);
    
    filterContainer.addEventListener('click', function(e) {
        if (e.target.matches('[data-filter]')) {
            selectedFilter = e.target.dataset.filter;
            filterContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            loadActivityFeed(true);
        }
    });
}

function setupInfiniteScroll() {
    const feedContainer = document.querySelector('#activityFeed');
    const options = {
        root: null,
        rootMargin: '0px',
        threshold: 0.5
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isLoading) {
                loadMoreActivities();
            }
        });
    }, options);
    
    // Create and observe sentinel element
    const sentinel = document.createElement('div');
    sentinel.className = 'sentinel';
    feedContainer.appendChild(sentinel);
    observer.observe(sentinel);
}

function setupRealTimeUpdates() {
    // Poll for new activities every 30 seconds
    setInterval(() => {
        if (!document.hidden) {
            checkForNewActivities();
        }
    }, 30000);
    
    // Also check when tab becomes visible
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            checkForNewActivities();
        }
    });
}

function checkForNewActivities() {
    const firstActivityId = document.querySelector('.activity-card')?.dataset.activityId;
    if (!firstActivityId) return;
    
    fetch(`/api/social/activity-feed/new?last_id=${firstActivityId}&filter=${selectedFilter}`)
        .then(response => response.json())
        .then(activities => {
            if (activities.length > 0) {
                prependNewActivities(activities);
            }
        })
        .catch(error => console.error('Error checking for new activities:', error));
}

function prependNewActivities(activities) {
    const feed = document.getElementById('activityFeed');
    const newActivitiesHtml = activities.map(activity => `
        <div class="activity-card mb-3 new-activity" data-activity-id="${activity.id}">
            <div class="card">
                <div class="card-body">
                    ${getActivityContent(activity)}
                    <div class="activity-meta text-muted mt-2">
                        <small>${new Date(activity.created_at).toLocaleString()}</small>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = newActivitiesHtml;
    
    while (tempContainer.firstChild) {
        feed.insertBefore(tempContainer.firstChild, feed.firstChild);
    }
    
    // Animate new activities
    feed.querySelectorAll('.new-activity').forEach(el => {
        el.style.animation = 'slideDown 0.5s ease-out';
        setTimeout(() => el.classList.remove('new-activity'), 500);
    });
}

function loadMoreActivities() {
    if (isLoading) return;
    isLoading = true;
    
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'text-center my-3';
    loadingIndicator.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';
    document.getElementById('activityFeed').appendChild(loadingIndicator);
    
    fetch(`/api/social/activity-feed?before_id=${lastLoadedActivityId}&filter=${selectedFilter}`)
        .then(response => response.json())
        .then(activities => {
            loadingIndicator.remove();
            if (activities.length > 0) {
                appendActivities(activities);
                lastLoadedActivityId = activities[activities.length - 1].id;
            }
            isLoading = false;
        })
        .catch(error => {
            console.error('Error loading more activities:', error);
            loadingIndicator.remove();
            isLoading = false;
        });
}

function loadActivityFeed(reset = false) {
    if (reset) {
        lastLoadedActivityId = null;
        document.getElementById('activityFeed').innerHTML = '';
    }
    
    fetch(`/api/social/activity-feed?filter=${selectedFilter}`)
        .then(response => response.json())
        .then(activities => {
            if (activities.length > 0) {
                appendActivities(activities);
                lastLoadedActivityId = activities[activities.length - 1].id;
            }
        })
        .catch(error => console.error('Error loading activity feed:', error));
}

function appendActivities(activities) {
    const feed = document.getElementById('activityFeed');
    activities.forEach(activity => {
        const activityCard = document.createElement('div');
        activityCard.className = 'activity-card mb-3';
        activityCard.dataset.activityId = activity.id;
        activityCard.innerHTML = `
            <div class="card">
                <div class="card-body">
                    ${getActivityContent(activity)}
                    <div class="activity-meta text-muted mt-2">
                        <small>${new Date(activity.created_at).toLocaleString()}</small>
                    </div>
                </div>
            </div>
        `;
        feed.appendChild(activityCard);
    });
}</new_str>
        </div>
    `;
    
    document.querySelector('.toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
