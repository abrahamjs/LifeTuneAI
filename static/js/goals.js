let goalsChart;

document.addEventListener('DOMContentLoaded', function() {
    loadGoals();

    // Handle goal title changes to suggest tasks
    document.getElementById('goalTitle').addEventListener('blur', async function() {
        const title = this.value;
        const description = document.getElementById('goalDescription').value;
        if (title) {
            await suggestTasks(title, description);
        }
    });

    // Handle generate more tasks button
    document.getElementById('generateMoreTasks')?.addEventListener('click', async function() {
        const title = document.getElementById('goalTitle').value;
        const description = document.getElementById('goalDescription').value;
        if (title) {
            await suggestTasks(title, description);
        }
    });

    // Handle new goal form submission
    document.getElementById('saveGoal').addEventListener('click', async function() {
        const title = document.getElementById('goalTitle').value;
        const description = document.getElementById('goalDescription').value;
        const category = document.getElementById('goalCategory').value;
        const target_date = document.getElementById('goalTargetDate').value;
        
        // Get selected tasks
        const selectedTasks = Array.from(document.querySelectorAll('#taskSuggestionsList input[type="checkbox"]:checked'))
            .map(checkbox => ({
                title: checkbox.nextElementSibling.querySelector('.fw-bold').textContent.trim(),
                description: checkbox.nextElementSibling.querySelector('small').textContent
            }));

        try {
            const response = await fetch('/api/goals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title,
                    description,
                    category,
                    target_date,
                    tasks: selectedTasks
                })
            });
            
            if (response.ok) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('newGoalModal'));
                modal.hide();
                loadGoals();
            }
        } catch (error) {
            console.error('Error saving goal:', error);
        }
    });
});

function loadGoals() {
    fetch('/api/goals')
        .then(response => response.json())
        .then(goals => {
            const goalsList = document.getElementById('goalsList');
            goalsList.innerHTML = goals.map(goal => `
                <div class="goal-card" onclick="showGoalDetails(${goal.id})">
                    <div class="goal-card-content">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="card-title mb-0">${goal.title}</h6>
                            <span class="badge bg-${getCategoryBadgeClass(goal.category)}">${goal.category}</span>
                        </div>
                        <div class="progress">
                            <div class="progress-bar" role="progressbar" 
                                 style="width: ${goal.progress}%" 
                                 aria-valuenow="${goal.progress}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                                ${goal.progress}%
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        });
}

function showGoalDetails(goalId) {
    fetch(`/api/goals/${goalId}`)
        .then(response => response.json())
        .then(goal => {
            const detailsPanel = document.getElementById('goalDetailsPanel');
            detailsPanel.innerHTML = `
                <div class="goal-details">
                    <div class="goal-header mb-4">
                        <h4>${goal.title}</h4>
                        <span class="badge bg-${getCategoryBadgeClass(goal.category)} mb-2">${goal.category}</span>
                        <p class="text-muted">${goal.description}</p>
                    </div>
                    <div class="goal-dates mb-4">
                        <div class="row">
                            <div class="col-6">
                                <small class="text-muted">Created</small>
                                <div>${new Date(goal.created_at).toLocaleDateString()}</div>
                            </div>
                            <div class="col-6">
                                <small class="text-muted">Target Date</small>
                                <div>${new Date(goal.target_date).toLocaleDateString()}</div>
                            </div>
                        </div>
                    </div>
                    <div class="goal-progress mb-4">
                        <h6>Progress</h6>
                        <div class="progress">
                            <div class="progress-bar" role="progressbar" 
                                 style="width: ${goal.progress}%" 
                                 aria-valuenow="${goal.progress}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                                ${goal.progress}%
                            </div>
                        </div>
                    </div>
                    <div class="goal-tasks">
                        <h6>Related Tasks</h6>
                        <div class="list-group">
                            ${goal.tasks.map(task => `
                                <a href="/tasks?task=${task.id}" class="list-group-item list-group-item-action">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <div class="fw-bold">${task.title}</div>
                                            <small class="text-muted">${task.description || ''}</small>
                                        </div>
                                        <span class="badge bg-${getPriorityBadgeClass(task.priority)}">${task.priority}</span>
                                    </div>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        });
}

function getCategoryBadgeClass(category) {
    switch(category.toLowerCase()) {
        case 'personal': return 'info';
        case 'professional': return 'primary';
        case 'health': return 'success';
        case 'education': return 'warning';
        default: return 'secondary';
    }
}

function getPriorityBadgeClass(priority) {
    switch(priority.toLowerCase()) {
        case 'urgent': return 'danger';
        case 'important': return 'warning';
        default: return 'secondary';
    }
}

async function suggestTasks(title, description) {
    try {
        const response = await fetch('/api/goals/suggest-tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title, description })
        });
        
        const data = await response.json();
        const suggestedTasks = document.getElementById('suggestedTasks');
        const tasksList = document.getElementById('taskSuggestionsList');
        
        if (data.error) {
            console.error('Error getting task suggestions:', data.error);
            tasksList.innerHTML = `
                <div class="alert alert-danger">
                    Failed to generate tasks. Please try again or add tasks manually.
                </div>
            `;
            suggestedTasks.classList.remove('d-none');
            return;
        }
        
        if (!Array.isArray(data) || data.length === 0) {
            tasksList.innerHTML = `
                <div class="alert alert-warning">
                    No task suggestions available. Try adding more details to your goal.
                </div>
            `;
            suggestedTasks.classList.remove('d-none');
            return;
        }

        tasksList.innerHTML = data.map(task => `
            <div class="list-group-item task-suggestion-item">
                <div class="form-check d-flex align-items-center">
                    <input class="form-check-input me-2" type="checkbox" value="" id="task_${btoa(task.title)}">
                    <label class="form-check-label flex-grow-1" for="task_${btoa(task.title)}">
                        <div class="fw-bold">${task.title}</div>
                        <small class="text-muted d-block">${task.description}</small>
                    </label>
                    <div class="ms-2">
                        <button type="button" class="btn btn-outline-secondary btn-sm edit-task">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        suggestedTasks.classList.remove('d-none');
    } catch (error) {
        console.error('Error getting task suggestions:', error);
        document.getElementById('taskSuggestionsList').innerHTML = `
            <div class="alert alert-danger">
                An error occurred while generating tasks. Please try again.
            </div>
        `;
    }
}
