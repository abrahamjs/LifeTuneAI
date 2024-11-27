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
                // Reset form
                document.getElementById('newTaskForm').reset();
            } else {
                showError('Failed to create task');
            }
        })
        .catch(error => {
            console.error('Error creating task:', error);
            showError('An error occurred while creating the task');
        });
    });

    // Setup delete and edit task handlers
    document.getElementById('deleteTask').addEventListener('click', function() {
        const taskId = this.dataset.taskId;
        if (taskId) {
            deleteTask(taskId);
        }
    });

    document.getElementById('editTask').addEventListener('click', function() {
        const taskId = this.dataset.taskId;
        if (taskId) {
            editTask(taskId);
        }
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
                <div class="task-item mb-2 d-flex align-items-center">
                    <input type="checkbox" class="form-check-input me-2" 
                           ${task.completed ? 'checked' : ''} 
                           onclick="toggleTaskCompletion(${task.id}, event)">
                    <span class="task-title ${task.completed ? 'text-muted text-decoration-line-through' : ''}"
                          onclick="showTaskDetails(${task.id}, event)">${task.title}</span>
                    <span class="badge ms-auto ${getPriorityBadgeClass(task.priority)}">${task.priority}</span>
                </div>
            `).join('');
        })
        .catch(error => {
            console.error('Error loading tasks:', error);
            showError('Failed to load tasks');
        });
}

function showTaskDetails(taskId, event) {
    if (event) {
        event.stopPropagation();
    }

    fetch(`/api/tasks/${taskId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Task not found');
            }
            return response.json();
        })
        .then(task => {
            const detailsContent = document.getElementById('taskDetailsContent');
            detailsContent.innerHTML = `
                <div class="task-details">
                    <div class="task-header mb-4">
                        <h4>${task.title}</h4>
                        <span class="badge bg-${getPriorityBadgeClass(task.priority)} mb-2">${task.priority}</span>
                        <p class="text-muted">${task.description || 'No description provided'}</p>
                    </div>
                    <div class="task-dates mb-4">
                        <div class="row">
                            <div class="col-6">
                                <small class="text-muted">Created</small>
                                <div>${new Date(task.created_at).toLocaleDateString()}</div>
                            </div>
                            <div class="col-6">
                                <small class="text-muted">Due Date</small>
                                <div>${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</div>
                            </div>
                        </div>
                    </div>
                    <div class="task-status mb-4">
                        <h6>Status</h6>
                        <span class="badge bg-${task.completed ? 'success' : 'warning'}">
                            ${task.completed ? 'Completed' : 'Pending'}
                        </span>
                        ${task.completed && task.completed_at ? 
                            `<small class="text-muted d-block mt-2">Completed on: ${new Date(task.completed_at).toLocaleString()}</small>` 
                            : ''}
                    </div>
                    ${task.goal_id ? `
                        <div class="task-goal mb-4">
                            <h6>Associated Goal</h6>
                            <a href="/goals#${task.goal_id}" class="text-decoration-none">
                                <span class="badge bg-primary">${task.goal_title || 'View Goal'}</span>
                            </a>
                        </div>
                    ` : ''}
                </div>
            `;

            // Set task ID for delete and edit buttons
            document.getElementById('deleteTask').dataset.taskId = taskId;
            document.getElementById('editTask').dataset.taskId = taskId;

            // Show the modal
            const modal = new bootstrap.Modal(document.getElementById('taskDetailsModal'));
            modal.show();
        })
        .catch(error => {
            console.error('Error loading task details:', error);
            showError('Failed to load task details');
        });
}

function editTask(taskId) {
    // Hide details modal
    const detailsModal = bootstrap.Modal.getInstance(document.getElementById('taskDetailsModal'));
    detailsModal.hide();

    // Show edit modal
    const editModal = new bootstrap.Modal(document.getElementById('newTaskModal'));
    editModal.show();

    // Populate form with task data
    fetch(`/api/tasks/${taskId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Task not found');
            }
            return response.json();
        })
        .then(task => {
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskDescription').value = task.description || '';
            document.getElementById('taskPriority').value = task.priority;
            document.getElementById('taskDueDate').value = task.due_date ? task.due_date.split('T')[0] : '';

            // Update save button to handle edit
            const saveButton = document.getElementById('saveTask');
            saveButton.textContent = 'Update Task';
            saveButton.onclick = () => updateTask(taskId);
        })
        .catch(error => {
            console.error('Error loading task for edit:', error);
            showError('Failed to load task for editing');
        });
}

function updateTask(taskId) {
    const data = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        priority: document.getElementById('taskPriority').value,
        due_date: document.getElementById('taskDueDate').value
    };

    fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to update task');
        }
        return response.json();
    })
    .then(data => {
        if (data.status === 'success') {
            const modal = bootstrap.Modal.getInstance(document.getElementById('newTaskModal'));
            modal.hide();
            loadTasks();

            // Reset the save button
            const saveButton = document.getElementById('saveTask');
            saveButton.textContent = 'Create Task';
            saveButton.onclick = null; // Reset to default handler
        }
    })
    .catch(error => {
        console.error('Error updating task:', error);
        showError('Failed to update task');
    });
}

function deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
        fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to delete task');
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                const modal = bootstrap.Modal.getInstance(document.getElementById('taskDetailsModal'));
                modal.hide();
                loadTasks();
            }
        })
        .catch(error => {
            console.error('Error deleting task:', error);
            showError('Failed to delete task');
        });
    }
}

function toggleTaskCompletion(taskId, event) {
    if (event) {
        event.stopPropagation();
    }

    fetch(`/api/tasks/${taskId}/toggle`, {
        method: 'POST'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to toggle task completion');
        }
        return response.json();
    })
    .then(data => {
        if (data.status === 'success') {
            loadTasks();
        }
    })
    .catch(error => {
        console.error('Error toggling task completion:', error);
        showError('Failed to update task status');
    });
}

function getPriorityBadgeClass(priority) {
    switch(priority.toLowerCase()) {
        case 'urgent': return 'bg-danger';
        case 'important': return 'bg-warning';
        default: return 'bg-secondary';
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger alert-dismissible fade show';
    errorDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.card-body').prepend(errorDiv);
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}
