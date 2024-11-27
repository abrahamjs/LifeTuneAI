// Shared task functions for tasks and goals views

function showTaskDetails(taskId, event) {
    if (event) {
        event.stopPropagation();
    }

    fetch(`/api/tasks/${taskId}`)
        .then(response => {
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Task not found');
                }
                throw new Error('Failed to load task details');
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
            showError(error.message || 'Failed to load task details');
            // Close the modal if it's open
            const modal = bootstrap.Modal.getInstance(document.getElementById('taskDetailsModal'));
            if (modal) {
                modal.hide();
            }
        });
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
            // Reload tasks if the function exists
            if (typeof loadTasks === 'function') {
                loadTasks();
            }
            // Reload goals if the function exists
            if (typeof loadGoals === 'function') {
                loadGoals();
            }
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
