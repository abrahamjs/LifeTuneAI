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
        
        // Add edit functionality
        document.querySelectorAll('.edit-task').forEach(button => {
            button.addEventListener('click', handleTaskEdit);
        });
    } catch (error) {
        console.error('Error getting task suggestions:', error);
        document.getElementById('taskSuggestionsList').innerHTML = `
            <div class="alert alert-danger">
                An error occurred while generating tasks. Please try again.
            </div>
        `;
    }
}

function handleTaskEdit(event) {
    const listItem = event.target.closest('.task-suggestion-item');
    const titleInput = listItem.querySelector('.fw-bold');
    const descriptionInput = listItem.querySelector('small');
    const originalTitle = titleInput.textContent.trim();
    const originalDescription = descriptionInput.textContent.trim();
    
    // Replace the content with editable fields
    titleInput.innerHTML = `<input type="text" class="form-control" value="${originalTitle}">`;
    descriptionInput.innerHTML = `<textarea class="form-control">${originalDescription}</textarea>`;
    
    // Add Save and Cancel buttons
    const editButtonsContainer = document.createElement('div');
    editButtonsContainer.classList.add('mt-2');
    editButtonsContainer.innerHTML = `
        <button type="button" class="btn btn-primary btn-sm save-edit">Save</button>
        <button type="button" class="btn btn-secondary btn-sm cancel-edit">Cancel</button>
    `;
    listItem.querySelector('.form-check').appendChild(editButtonsContainer);

    // Add event listeners for Save and Cancel buttons
    listItem.querySelector('.save-edit').addEventListener('click', () => {
        const newTitle = listItem.querySelector('input').value;
        const newDescription = listItem.querySelector('textarea').value;
        titleInput.innerHTML = `<div class="fw-bold">${newTitle}</div>`;
        descriptionInput.innerHTML = `<small class="text-muted d-block">${newDescription}</small>`;
        editButtonsContainer.remove();
    });
    
    listItem.querySelector('.cancel-edit').addEventListener('click', () => {
        titleInput.textContent = originalTitle;
        descriptionInput.textContent = originalDescription;
        editButtonsContainer.remove();
    });
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