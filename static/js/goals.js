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
                                <button class="list-group-item list-group-item-action" 
                                        onclick="openTaskDetails(${task.id}, ${goal.id})">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <div class="fw-bold">${task.title}</div>
                                            <small class="text-muted">${task.description || ''}</small>
                                        </div>
                                        <span class="badge bg-${getPriorityBadgeClass(task.priority)}">${task.priority}</span>
                                    </div>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            
            // Setup handlers
            document.getElementById('deleteGoal').onclick = () => deleteGoal(goal.id);
            document.getElementById('editGoal').onclick = () => editGoal(goal.id);
            
            const modal = new bootstrap.Modal(document.getElementById('goalDetailsModal'));
            modal.show();
        });
}

function openTaskDetails(taskId, goalId) {
    // Close goal modal if it's open
    const goalModal = bootstrap.Modal.getInstance(document.getElementById('goalDetailsModal'));
    if (goalModal) {
        goalModal.hide();
        document.getElementById('goalDetailsModal').addEventListener('hidden.bs.modal', function handler() {
            // Remove the event listener
            document.getElementById('goalDetailsModal').removeEventListener('hidden.bs.modal', handler);
            
            // Now fetch and show task details
            fetch(`/api/tasks/${taskId}`)
                .then(response => response.json())
                .then(task => {
                    const detailsContent = document.getElementById('taskDetailsContent');
                    detailsContent.innerHTML = `
                        <div class="task-details">
                            <div class="mb-3 goal-link">
                                <h6>Related Goal</h6>
                                <button class="btn btn-link p-0" onclick="navigateToGoal(${goalId}); return false;">
                                    <i class="bi bi-arrow-up-right-circle"></i> View Related Goal
                                </button>
                            </div>
                            <div class="mb-3">
                                <h6>Title</h6>
                                <p>${task.title}</p>
                            </div>
                            <div class="mb-3">
                                <h6>Description</h6>
                                <p>${task.description || 'No description'}</p>
                            </div>
                            <div class="mb-3">
                                <h6>Priority</h6>
                                <span class="badge bg-${getPriorityBadgeClass(task.priority)}">${task.priority}</span>
                            </div>
                            <div class="mb-3">
                                <h6>Due Date</h6>
                                <p>${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</p>
                            </div>
                            <div class="mb-3">
                                <h6>Status</h6>
                                <span class="badge bg-${task.completed ? 'success' : 'warning'}">
                                    ${task.completed ? 'Completed' : 'Pending'}
                                </span>
                            </div>
                        </div>
                    `;
                    
                    // Setup handlers
                    document.getElementById('deleteTask').onclick = () => deleteTask(task.id);
                    document.getElementById('editTask').onclick = () => editTask(task.id);
                    
                    const taskModal = new bootstrap.Modal(document.getElementById('taskDetailsModal'));
                    taskModal.show();
                });
        }, { once: true });
    }
}

function hideModal(modalId) {
    return new Promise((resolve) => {
        const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
        if (modal) {
            document.getElementById(modalId).addEventListener('hidden.bs.modal', () => resolve(), { once: true });
            modal.hide();
        } else {
            resolve();
        }
    });
}

async function navigateToGoal(goalId) {
    await hideModal('taskDetailsModal');
    const response = await fetch(`/api/goals/${goalId}`);
    const goal = await response.json();
    
    const detailsContent = document.getElementById('goalDetailsContent');
    // Update goal details content
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
                        <button class="list-group-item list-group-item-action" 
                                onclick="openTaskDetails(${task.id}, ${goal.id})">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fw-bold">${task.title}</div>
                                    <small class="text-muted">${task.description || ''}</small>
                                </div>
                                <span class="badge bg-${getPriorityBadgeClass(task.priority)}">${task.priority}</span>
                            </div>
                        </button>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    // Setup handlers
    document.getElementById('deleteGoal').onclick = () => deleteGoal(goal.id);
    document.getElementById('editGoal').onclick = () => editGoal(goal.id);
    
    const goalModal = new bootstrap.Modal(document.getElementById('goalDetailsModal'));
    goalModal.show();
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

function deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
        fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                const modal = bootstrap.Modal.getInstance(document.getElementById('taskDetailsModal'));
                modal.hide();
                // Reload the relevant goal details to update the task list
                const goalId = data.goalId; // Assuming API response provides goalId
                if (goalId) {
                    showGoalDetails(goalId);
                }
            }
        });
    }
}

function editTask(taskId) {
    const detailsContent = document.getElementById('taskDetailsContent');
    const currentContent = detailsContent.innerHTML;
    
    fetch(`/api/tasks/${taskId}`)
        .then(response => response.json())
        .then(task => {
            detailsContent.innerHTML = `
                <form id="editTaskForm">
                    <div class="mb-3">
                        <label class="form-label">Title</label>
                        <input type="text" class="form-control" id="editTaskTitle" value="${task.title}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Description</label>
                        <textarea class="form-control" id="editTaskDescription" rows="3">${task.description}</textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Priority</label>
                        <select class="form-control" id="editTaskPriority">
                            <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
                            <option value="important" ${task.priority === 'important' ? 'selected' : ''}>Important</option>
                            <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Due Date</label>
                        <input type="date" class="form-control" id="editTaskDueDate" 
                               value="${task.due_date ? task.due_date.split('T')[0] : ''}">
                    </div>
                </form>
            `;
            
            // Change footer buttons
            const footer = document.querySelector('#taskDetailsModal .modal-footer');
            footer.innerHTML = `
                <button type="button" class="btn btn-secondary" onclick="cancelEditTask(${taskId}, '${encodeURIComponent(currentContent)}')">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="saveTaskEdit(${taskId})">Save Changes</button>
            `;
        });
}

function cancelEditTask(taskId, previousContent) {
    document.getElementById('taskDetailsContent').innerHTML = decodeURIComponent(previousContent);
    resetTaskModalFooter(taskId);
}

function resetTaskModalFooter(taskId) {
    const footer = document.querySelector('#taskDetailsModal .modal-footer');
    footer.innerHTML = `
        <button type="button" class="btn btn-danger" id="deleteTask" onclick="deleteTask(${taskId})">Delete</button>
        <button type="button" class="btn btn-primary" onclick="editTask(${taskId})">Edit</button>
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
    `;
}

function saveTaskEdit(taskId) {
    const data = {
        title: document.getElementById('editTaskTitle').value,
        description: document.getElementById('editTaskDescription').value,
        priority: document.getElementById('editTaskPriority').value,
        due_date: document.getElementById('editTaskDueDate').value
    };
    
    fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showTaskDetails(taskId); // Refresh the task details view
            // Assuming you want to refresh the goal details after editing a task
            if (data.goalId) {
                showGoalDetails(data.goalId); // Refresh the goal details
            }
        }
    });
}