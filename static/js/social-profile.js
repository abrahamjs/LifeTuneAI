document.addEventListener('DOMContentLoaded', function() {
    const userId = new URLSearchParams(window.location.search).get('user_id');
    loadUserProfile(userId);
    loadUserActivity(userId);
    loadSharedContent(userId);
    setupFollowButton(userId);
});

function loadUserProfile(userId) {
    fetch(`/api/social/users/${userId}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('profileUsername').textContent = data.username;
            document.getElementById('profileBio').textContent = data.bio || 'No bio available';
            document.getElementById('profileLevel').textContent = data.level;
            document.getElementById('profileFollowers').textContent = data.followers_count;
            document.getElementById('profileFollowing').textContent = data.following_count;
            document.getElementById('profileAchievements').textContent = data.achievements_count;
            
            // Show/hide follow button based on whether it's the current user's profile
            const followButton = document.getElementById('followButton');
            if (data.is_current_user) {
                followButton.classList.add('d-none');
            } else {
                followButton.classList.remove('d-none');
                followButton.textContent = data.is_following ? 'Unfollow' : 'Follow';
                followButton.dataset.following = data.is_following;
            }
        })
        .catch(error => console.error('Error loading profile:', error));
}

function loadUserActivity(userId) {
    fetch(`/api/social/users/${userId}/activity`)
        .then(response => response.json())
        .then(activities => {
            const feed = document.getElementById('profileActivityFeed');
            feed.innerHTML = activities.map(activity => `
                <div class="activity-item mb-3">
                    <div class="d-flex align-items-center">
                        <i class="bi ${getActivityIcon(activity.activity_type)} me-2"></i>
                        <div>
                            ${getActivityContent(activity)}
                            <small class="text-muted d-block">
                                ${new Date(activity.created_at).toLocaleString()}
                            </small>
                        </div>
                    </div>
                </div>
            `).join('');
        })
        .catch(error => console.error('Error loading activity:', error));
}

function loadSharedContent(userId) {
    fetch(`/api/social/users/${userId}/shared-content`)
        .then(response => response.json())
        .then(content => {
            const contentList = document.getElementById('sharedContentList');
            contentList.innerHTML = content.map(item => `
                <div class="shared-content-card mb-3">
                    <div class="card">
                        <div class="card-body">
                            ${getSharedContentBody(item)}
                            <div class="content-actions mt-3">
                                <button class="btn btn-sm btn-outline-primary me-2" 
                                        onclick="likeContent(${item.id})">
                                    <i class="bi bi-heart"></i> ${item.likes}
                                </button>
                                ${item.comments_enabled ? `
                                    <button class="btn btn-sm btn-outline-secondary"
                                            onclick="showComments(${item.id})">
                                        <i class="bi bi-chat"></i> Comments
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        })
        .catch(error => console.error('Error loading shared content:', error));
}

function setupFollowButton(userId) {
    const followButton = document.getElementById('followButton');
    followButton.addEventListener('click', function() {
        const isFollowing = followButton.dataset.following === 'true';
        const endpoint = `/api/social/${isFollowing ? 'unfollow' : 'follow'}/${userId}`;
        
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                followButton.textContent = isFollowing ? 'Follow' : 'Unfollow';
                followButton.dataset.following = (!isFollowing).toString();
                // Update followers count
                const followersCount = document.getElementById('profileFollowers');
                followersCount.textContent = parseInt(followersCount.textContent) + (isFollowing ? -1 : 1);
            }
        })
        .catch(error => console.error('Error updating follow status:', error));
    });
}

function getActivityIcon(type) {
    const icons = {
        'achievement_earned': 'bi-trophy',
        'goal_completed': 'bi-flag',
        'habit_streak': 'bi-lightning',
        'following_new_user': 'bi-person-plus'
    };
    return icons[type] || 'bi-star';
}

function getSharedContentBody(item) {
    switch(item.content_type) {
        case 'achievement':
            return `
                <div class="achievement-share">
                    <h6><i class="bi bi-trophy"></i> Achievement Unlocked</h6>
                    <p>${item.content.name}</p>
                    <small class="text-muted">${item.content.description}</small>
                </div>
            `;
        case 'goal':
            return `
                <div class="goal-share">
                    <h6><i class="bi bi-flag"></i> Goal Completed</h6>
                    <p>${item.content.title}</p>
                    <div class="progress">
                        <div class="progress-bar" role="progressbar" 
                             style="width: ${item.content.progress}%">
                            ${item.content.progress}%
                        </div>
                    </div>
                </div>
            `;
        default:
            return `<p>${item.content}</p>`;
    }
}

function showComments(contentId) {
    fetch(`/api/social/shared-content/${contentId}/comments`)
        .then(response => response.json())
        .then(comments => {
            const commentsList = document.getElementById('commentsList');
            commentsList.innerHTML = comments.map(comment => `
                <div class="comment mb-3">
                    <strong>${comment.username}</strong>
                    <p>${comment.content}</p>
                    <small class="text-muted">
                        ${new Date(comment.created_at).toLocaleString()}
                    </small>
                </div>
            `).join('');
            
            // Setup comment form submission
            document.getElementById('commentForm').onsubmit = function(e) {
                e.preventDefault();
                submitComment(contentId);
            };
            
            const modal = new bootstrap.Modal(document.getElementById('commentModal'));
            modal.show();
        })
        .catch(error => console.error('Error loading comments:', error));
}

function submitComment(contentId) {
    const content = document.getElementById('commentContent').value;
    fetch(`/api/social/shared-content/${contentId}/comments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            document.getElementById('commentContent').value = '';
            showComments(contentId); // Reload comments
        }
    })
    .catch(error => console.error('Error posting comment:', error));
}

function likeContent(contentId) {
    fetch(`/api/social/shared-content/${contentId}/like`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            loadSharedContent(new URLSearchParams(window.location.search).get('user_id'));
        }
    })
    .catch(error => console.error('Error liking content:', error));
}
