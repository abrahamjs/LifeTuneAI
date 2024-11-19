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
                title: checkbox.nextElementSibling.textContent.trim(),
                description: checkbox.closest('.list-group-item').querySelector('small').textContent
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

async function suggestTasks(title, description) {
    try {
        const response = await fetch('/api/goals/suggest-tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title, description })
        });
        
        const tasks = await response.json();
        const suggestedTasks = document.getElementById('suggestedTasks');
        const tasksList = document.getElementById('taskSuggestionsList');
        
        if (tasks.error) {
            console.error('Error getting task suggestions:', tasks.error);
            return;
        }

        tasksList.innerHTML = tasks.map(task => `
            <div class="list-group-item">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="" id="task_${task.title}">
                    <label class="form-check-label" for="task_${task.title}">
                        ${task.title}
                    </label>
                </div>
                <small class="text-muted d-block">${task.description}</small>
                <div class="mt-2">
                    <button type="button" class="btn btn-outline-secondary btn-sm edit-task">
                        <i class="bi bi-pencil"></i> Edit
                    </button>
                </div>
            </div>
        `).join('');
        
        suggestedTasks.classList.remove('d-none');
        
        // Add event listeners for edit buttons
        document.querySelectorAll('.edit-task').forEach(button => {
            button.addEventListener('click', function() {
                const listItem = this.closest('.list-group-item');
                const title = listItem.querySelector('.form-check-label').textContent.trim();
                const description = listItem.querySelector('small').textContent.trim();
                
                // Replace the content with editable fields
                listItem.innerHTML = `
                    <div class="mb-2">
                        <input type="text" class="form-control" value="${title}">
                    </div>
                    <div class="mb-2">
                        <textarea class="form-control">${description}</textarea>
                    </div>
                    <div>
                        <button type="button" class="btn btn-primary btn-sm save-edit">Save</button>
                        <button type="button" class="btn btn-secondary btn-sm cancel-edit">Cancel</button>
                    </div>
                `;
                
                // Add event listeners for save and cancel buttons
                listItem.querySelector('.save-edit').addEventListener('click', function() {
                    const newTitle = listItem.querySelector('input').value;
                    const newDescription = listItem.querySelector('textarea').value;
                    listItem.innerHTML = `
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" value="" id="task_${newTitle}">
                            <label class="form-check-label" for="task_${newTitle}">
                                ${newTitle}
                            </label>
                        </div>
                        <small class="text-muted d-block">${newDescription}</small>
                        <div class="mt-2">
                            <button type="button" class="btn btn-outline-secondary btn-sm edit-task">
                                <i class="bi bi-pencil"></i> Edit
                            </button>
                        </div>
                    `;
                });
                
                listItem.querySelector('.cancel-edit').addEventListener('click', function() {
                    listItem.innerHTML = `
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" value="" id="task_${title}">
                            <label class="form-check-label" for="task_${title}">
                                ${title}
                            </label>
                        </div>
                        <small class="text-muted d-block">${description}</small>
                        <div class="mt-2">
                            <button type="button" class="btn btn-outline-secondary btn-sm edit-task">
                                <i class="bi bi-pencil"></i> Edit
                            </button>
                        </div>
                    `;
                });
            });
        });
    } catch (error) {
        console.error('Error getting task suggestions:', error);
    }
}

function loadGoals() {
    fetch('/api/goals')
        .then(response => response.json())
        .then(goals => {
            const goalsList = document.getElementById('goalsList');
            goalsList.innerHTML = goals.map(goal => `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="card-title mb-0">${goal.title}</h6>
                            <span class="badge bg-info">${goal.category}</span>
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

            updateGoalsChart(goals);
        });
}

function updateGoalsChart(goals) {
    const ctx = document.getElementById('goalsProgress');
    
    if (goalsChart) {
        goalsChart.destroy();
    }

    goalsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: goals.map(goal => goal.title),
            datasets: [{
                data: goals.map(goal => goal.progress),
                backgroundColor: [
                    'rgba(var(--bs-primary-rgb), 0.5)',
                    'rgba(var(--bs-success-rgb), 0.5)',
                    'rgba(var(--bs-info-rgb), 0.5)',
                    'rgba(var(--bs-warning-rgb), 0.5)'
                ],
                borderColor: [
                    'rgba(var(--bs-primary-rgb), 1)',
                    'rgba(var(--bs-success-rgb), 1)',
                    'rgba(var(--bs-info-rgb), 1)',
                    'rgba(var(--bs-warning-rgb), 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}
