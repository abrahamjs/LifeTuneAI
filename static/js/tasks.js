document.addEventListener('DOMContentLoaded', function() {
    loadTasks();

    // Handle task filtering
    document.querySelectorAll('[data-filter]').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelector('[data-filter].active').classList.remove('active');
            this.classList.add('active');
            loadTasks(this.dataset.filter);
        });
    });

    // Handle new task form submission
    document.getElementById('saveTask').addEventListener('click', function() {
        const title = document.getElementById('taskTitle').value;
        const description = document.getElementById('taskDescription').value;
        const priority = document.getElementById('taskPriority').value;
        const due_date = document.getElementById('taskDueDate').value;

        fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title,
                description,
                priority,
                due_date
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                const modal = bootstrap.Modal.getInstance(document.getElementById('newTaskModal'));
                modal.hide();
                loadTasks();
            }
        });
    });
});

function loadTasks(filter = 'all') {
    fetch('/api/tasks')
        .then(response => response.json())
        .then(tasks => {
            if (filter !== 'all') {
                tasks = tasks.filter(task => 
                    filter === 'completed' ? task.completed : !task.completed
                );
            }

            const tasksList = document.getElementById('tasksList');
            tasksList.innerHTML = tasks.map(task => `
                <div class="task-item mb-2 d-flex align-items-center" onclick="showTaskDetails(${task.id})">
                    <input type="checkbox" class="form-check-input me-2" 
                           ${task.completed ? 'checked' : ''} onclick="event.stopPropagation();">
                    <span class="task-title ${task.completed ? 'text-muted text-decoration-line-through' : ''}">${task.title}</span>
                    <span class="badge ms-auto ${getPriorityBadgeClass(task.priority)}">${task.priority}</span>
                </div>
            `).join('');
        });
}

function showTaskDetails(taskId) {
    fetch(`/api/tasks/${taskId}`)
        .then(response => response.json())
        .then(task => {
            const detailsContent = document.getElementById('taskDetailsContent');
            detailsContent.innerHTML = `
                <div class="task-details">
                    ${task.goal_id ? `
                        <div class="mb-3 goal-link">
                            <h6>Related Goal</h6>
                            <button class="btn btn-link p-0" onclick="showGoalDetails(${task.goal_id}); return false;">
                                <i class="bi bi-arrow-up-right-circle"></i> View Related Goal
                            </button>
                        </div>
                    ` : ''}
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
            
            const modal = new bootstrap.Modal(document.getElementById('taskDetailsModal'));
            modal.show();
        });
}

function editTask(taskId) {
    fetch(`/api/tasks/${taskId}`)
        .then(response => response.json())
        .then(task => {
            const detailsContent = document.getElementById('taskDetailsContent');
            const currentContent = detailsContent.innerHTML;
            
            detailsContent.innerHTML = `
                <form id="editTaskForm">
                    <div class="mb-3">
                        <label class="form-label">Title</label>
                        <input type="text" class="form-control" id="editTaskTitle" value="${task.title}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Description</label>
                        <textarea class="form-control" id="editTaskDescription" rows="3">${task.description || ''}</textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Priority</label>
                        <select class="form-control" id="editTaskPriority">
                            <option value="normal" ${task.priority === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="important" ${task.priority === 'important' ? 'selected' : ''}>Important</option>
                            <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Due Date</label>
                        <input type="date" class="form-control" id="editTaskDueDate" 
                               value="${task.due_date ? task.due_date.split('T')[0] : ''}">
                    </div>
                    <div class="mb-3">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="editTaskCompleted" 
                                   ${task.completed ? 'checked' : ''}>
                            <label class="form-check-label">
                                Mark as completed
                            </label>
                        </div>
                    </div>
                </form>
            `;
            
            // Change footer buttons
            const footer = document.querySelector('#taskDetailsModal .modal-footer');
            footer.innerHTML = `
                <button type="button" class="btn btn-secondary" onclick="cancelTaskEdit(${taskId}, '${encodeURIComponent(currentContent)}')">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="saveTaskEdit(${taskId})">Save Changes</button>
            `;
        });
}

function cancelTaskEdit(taskId, previousContent) {
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
        due_date: document.getElementById('editTaskDueDate').value,
        completed: document.getElementById('editTaskCompleted').checked
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
            showTaskDetails(taskId);  // Refresh the details view
            loadTasks();  // Refresh the tasks list
        }
    });
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
                loadTasks();
            }
        });
    }
}

function getPriorityBadgeClass(priority) {
    switch(priority.toLowerCase()) {
        case 'urgent': return 'danger';
        case 'important': return 'warning';
        default: return 'secondary';
    }
}

function showGoalDetails(goalId) {
    // Hide task modal first
    const taskModal = bootstrap.Modal.getInstance(document.getElementById('taskDetailsModal'));
    if (taskModal) {
        taskModal.hide();
        
        // Wait for modal to finish hiding
        setTimeout(() => {
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
                    
                    const goalModal = new bootstrap.Modal(document.getElementById('goalDetailsModal'));
                    goalModal.show();
                });
        }, 300); // Wait for modal transition
    }
}

function getCategoryBadgeClass(category) {
    switch(category.toLowerCase()) {
        case 'work': return 'primary';
        case 'personal': return 'secondary';
        case 'health': return 'success';
        case 'finance': return 'warning';
        default: return 'info';
    }
}

function openTaskDetails(taskId, goalId) {
    // Hide the goal details modal first
    const goalModal = bootstrap.Modal.getInstance(document.getElementById('goalDetailsModal'));
    if (goalModal) {
        goalModal.hide();
        
        // Wait for the modal to finish hiding
        setTimeout(() => {
            showTaskDetails(taskId); // Display the task details
        }, 300); // Wait for modal transition
    }
}

function editGoal(goalId) {
    fetch(`/api/goals/${goalId}`)
        .then(response => response.json())
        .then(goal => {
            const detailsContent = document.getElementById('goalDetailsContent');
            const currentContent = detailsContent.innerHTML;
            
            detailsContent.innerHTML = `
                <form id="editGoalForm">
                    <div class="mb-3">
                        <label class="form-label">Title</label>
                        <input type="text" class="form-control" id="editGoalTitle" value="${goal.title}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Description</label>
                        <textarea class="form-control" id="editGoalDescription" rows="3">${goal.description || ''}</textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Category</label>
                        <select class="form-control" id="editGoalCategory">
                            <option value="work" ${goal.category === 'work' ? 'selected' : ''}>Work</option>
                            <option value="personal" ${goal.category === 'personal' ? 'selected' : ''}>Personal</option>
                            <option value="health" ${goal.category === 'health' ? 'selected' : ''}>Health</option>
                            <option value="finance" ${goal.category === 'finance' ? 'selected' : ''}>Finance</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Target Date</label>
                        <input type="date" class="form-control" id="editGoalTargetDate" 
                               value="${goal.target_date ? goal.target_date.split('T')[0] : ''}">
                    </div>
                </form>
            `;
            
            // Change footer buttons
            const footer = document.querySelector('#goalDetailsModal .modal-footer');
            footer.innerHTML = `
                <button type="button" class="btn btn-secondary" onclick="cancelGoalEdit(${goalId}, '${encodeURIComponent(currentContent)}')">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="saveGoalEdit(${goalId})">Save Changes</button>
            `;
        });
}

function cancelGoalEdit(goalId, previousContent) {
    document.getElementById('goalDetailsContent').innerHTML = decodeURIComponent(previousContent);
    resetGoalModalFooter(goalId);
}

function resetGoalModalFooter(goalId) {
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
            showGoalDetails(goalId);
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
            }
        });
    }
}