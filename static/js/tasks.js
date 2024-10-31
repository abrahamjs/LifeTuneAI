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
                <div class="task-item mb-2 d-flex align-items-center">
                    <input type="checkbox" class="form-check-input me-2" 
                           ${task.completed ? 'checked' : ''}>
                    <span class="task-title ${task.completed ? 'text-muted text-decoration-line-through' : ''}">${task.title}</span>
                    <span class="badge ms-auto ${getPriorityBadgeClass(task.priority)}">${task.priority}</span>
                </div>
            `).join('');
        });
}

function getPriorityBadgeClass(priority) {
    switch(priority.toLowerCase()) {
        case 'urgent': return 'bg-danger';
        case 'important': return 'bg-warning';
        default: return 'bg-secondary';
    }
}
