document.addEventListener('DOMContentLoaded', function() {
    loadSocialFeed();
    loadConnections();
    loadPrivacySettings();
    
    // Setup event listeners
    document.getElementById('privacySettingsForm').addEventListener('submit', updatePrivacySettings);
    
    // Share modal setup
    document.getElementById('shareVisibility').addEventListener('change', function() {
        const specificUsersSection = document.getElementById('specificUsersSection');
        specificUsersSection.style.display = this.value === 'specific' ? 'block' : 'none';
        
        if (this.value === 'specific') {
            loadUsersList();
        }
    });
});

function loadSocialFeed() {
    fetch('/api/social/feed')
        .then(response => response.json())
        .then(items => {
            const feedContainer = document.getElementById('socialFeed');
            feedContainer.innerHTML = items.map(item => {
                if (item.type === 'goal') {
                    return `
                        <div class="feed-item mb-3">
                            <div class="card">
                                <div class="card-body">
                                    <div class="d-flex align-items-center mb-2">
                                        <strong class="me-2">${item.user}</strong>
                                        <span class="text-muted">shared a goal</span>
                                    </div>
                                    <h6>${item.title}</h6>
                                    <div class="progress mb-2">
                                        <div class="progress-bar" role="progressbar" 
                                             style="width: ${item.progress}%" 
                                             aria-valuenow="${item.progress}" 
                                             aria-valuemin="0" 
                                             aria-valuemax="100">
                                            ${item.progress}%
                                        </div>
                                    </div>
                                    <small class="text-muted">
                                        ${new Date(item.created_at).toLocaleDateString()}
                                    </small>
                                </div>
                            </div>
                        </div>
                    `;
                } else if (item.type === 'achievement') {
                    return `
                        <div class="feed-item mb-3">
                            <div class="card">
                                <div class="card-body">
                                    <div class="d-flex align-items-center mb-2">
                                        <strong class="me-2">${item.user}</strong>
                                        <span class="text-muted">earned an achievement</span>
                                    </div>
                                    <div class="achievement-card">
                                        <h6>${item.name}</h6>
                                        <p class="text-muted mb-2">${item.description}</p>
                                    </div>
                                    <small class="text-muted">
                                        ${new Date(item.created_at).toLocaleDateString()}
                                    </small>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }).join('');
        });
}

function loadConnections() {
    fetch('/api/social/connections')
        .then(response => response.json())
        .then(data => {
            document.getElementById('followingCount').textContent = data.following_count;
            document.getElementById('followersCount').textContent = data.followers_count;
            
            const connectionsList = document.getElementById('connectionsList');
            connectionsList.innerHTML = data.connections.map(user => `
                <div class="connection-item d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <strong>${user.username}</strong>
                        <small class="text-muted d-block">Level ${user.level}</small>
                    </div>
                    ${user.is_following ? `
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="unfollowUser(${user.id})">
                            Unfollow
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="followUser(${user.id})">
                            Follow
                        </button>
                    `}
                </div>
            `).join('');
        });
}

function followUser(userId) {
    fetch(`/api/social/follow/${userId}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                loadConnections();
            }
        });
}

function unfollowUser(userId) {
    fetch(`/api/social/unfollow/${userId}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                loadConnections();
            }
        });
}

function loadPrivacySettings() {
    const privacySettings = {
        profileVisible: document.getElementById('profileVisible'),
        goalsVisible: document.getElementById('goalsVisible'),
        achievementsVisible: document.getElementById('achievementsVisible'),
        statsVisible: document.getElementById('statsVisible')
    };
    
    fetch('/api/social/privacy')
        .then(response => response.json())
        .then(settings => {
            for (const [key, element] of Object.entries(privacySettings)) {
                element.checked = settings[key];
            }
        });
}

function updatePrivacySettings(event) {
    event.preventDefault();
    
    const settings = {
        profile_visible: document.getElementById('profileVisible').checked,
        goals_visible: document.getElementById('goalsVisible').checked,
        achievements_visible: document.getElementById('achievementsVisible').checked,
        stats_visible: document.getElementById('statsVisible').checked
    };
    
    fetch('/api/social/privacy', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Privacy settings updated!', 'success');
        }
    });
}

function showShareModal(itemType, itemId) {
    const modal = new bootstrap.Modal(document.getElementById('shareModal'));
    
    // Setup share button handler
    document.getElementById('shareButton').onclick = function() {
        const visibility = document.getElementById('shareVisibility').value;
        let sharedWith = null;
        
        if (visibility === 'specific') {
            sharedWith = Array.from(document.querySelectorAll('#usersList input:checked'))
                .map(input => parseInt(input.value));
        } else if (visibility === 'followers') {
            sharedWith = 'followers';
        }
        
        shareItem(itemType, itemId, sharedWith);
        modal.hide();
    };
    
    modal.show();
}

function shareItem(type, id, sharedWith) {
    fetch('/api/social/share', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            type: type,
            id: id,
            shared_with: sharedWith
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Item shared successfully!', 'success');
        }
    });
}

function loadUsersList() {
    fetch('/api/social/users')
        .then(response => response.json())
        .then(users => {
            const usersList = document.getElementById('usersList');
            usersList.innerHTML = users.map(user => `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="${user.id}" id="user${user.id}">
                    <label class="form-check-label" for="user${user.id}">
                        ${user.username}
                    </label>
                </div>
            `).join('');
        });
}

// Add share buttons to goals, achievements, etc.
document.addEventListener('DOMContentLoaded', function() {
    // Add share buttons to achievement cards
    document.querySelectorAll('.achievement-card').forEach(card => {
        const achievementId = card.dataset.achievementId;
        const shareButton = document.createElement('button');
        shareButton.className = 'btn btn-sm btn-outline-primary mt-2';
        shareButton.innerHTML = '<i class="bi bi-share"></i> Share';
        shareButton.onclick = () => showShareModal('achievement', achievementId);
        card.appendChild(shareButton);
    });
});
