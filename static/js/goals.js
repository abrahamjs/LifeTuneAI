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
            const detailsContent = document.getElementById('goalDetailsContent');
            detailsContent.innerHTML = `
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
                                <div class="list-group-item" onclick="showTaskDetails(${task.id})">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <div class="fw-bold">${task.title}</div>
                                            <small class="text-muted">${task.description || ''}</small>
                                        </div>
                                        <span class="badge bg-${getPriorityBadgeClass(task.priority)}">${task.priority}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            
            // Setup delete handler
            document.getElementById('deleteGoal').onclick = () => deleteGoal(goal.id);
            // Setup edit handler
            document.getElementById('editGoal').onclick = () => editGoal(goal.id);
            
            // Show the modal
            const modal = new bootstrap.Modal(document.getElementById('goalDetailsModal'));
            modal.show();
        });
}

function editGoal(goalId) {
    const detailsContent = document.getElementById('goalDetailsContent');
    const currentContent = detailsContent.innerHTML;
    
    fetch(`/api/goals/${goalId}`)
        .then(response => response.json())
        .then(goal => {
            detailsContent.innerHTML = `
                <form id="editGoalForm">
                    <div class="mb-3">
                        <label class="form-label">Title</label>
                        <input type="text" class="form-control" id="editGoalTitle" value="${goal.title}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Description</label>
                        <textarea class="form-control" id="editGoalDescription" rows="3">${goal.description}</textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Category</label>
                        <select class="form-control" id="editGoalCategory">
                            <option value="personal" ${goal.category === 'personal' ? 'selected' : ''}>Personal</option>
                            <option value="professional" ${goal.category === 'professional' ? 'selected' : ''}>Professional</option>
                            <option value="health" ${goal.category === 'health' ? 'selected' : ''}>Health</option>
                            <option value="education" ${goal.category === 'education' ? 'selected' : ''}>Education</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Target Date</label>
                        <input type="date" class="form-control" id="editGoalTargetDate" 
                               value="${goal.target_date.split('T')[0]}">
                    </div>
                </form>
            `;
            
            // Change footer buttons
            const footer = document.querySelector('#goalDetailsModal .modal-footer');
            footer.innerHTML = `
                <button type="button" class="btn btn-secondary" onclick="cancelEdit(${goalId}, '${encodeURIComponent(currentContent)}')">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="saveGoalEdit(${goalId})">Save Changes</button>
            `;
        });
}

function cancelEdit(goalId, previousContent) {
    document.getElementById('goalDetailsContent').innerHTML = decodeURIComponent(previousContent);
    resetModalFooter(goalId);
}

function resetModalFooter(goalId) {
    const footer = document.querySelector('#goalDetailsModal .modal-footer');
    footer.innerHTML = `
        <button type="button" class="btn btn-danger" id="deleteGoal" onclick="deleteGoal(${goalId})">Delete</button>
        <button type="button" class="btn btn-primary" onclick="editGoal(${goalId})">Edit</button>
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
    `;
}

function saveGoalEdit(goalId) {
    const data = {
        title: document.getElementById('editGoalTitle').value,
        description: document.getElementById('editGoalDescription').value,
        category: document.getElementById('editGoalCategory').value,
        target_date: document.getElementById('editGoalTargetDate').value
    };
    
    fetch(`/api/goals/${goalId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showGoalDetails(goalId);  // Refresh the details view
            loadGoals();  // Refresh the goals list
        }
    });
}

function deleteGoal(goalId) {
    if (confirm('Are you sure you want to delete this goal?')) {
        fetch(`/api/goals/${goalId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                const modal = bootstrap.Modal.getInstance(document.getElementById('goalDetailsModal'));
                modal.hide();
                loadGoals();
            }
        });
    }
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
