// Initialize dashboard components
document.addEventListener('DOMContentLoaded', function() {
    updateGreeting();
    initializeGoalsChart();
    loadTasks();
    loadHabits();
});

function updateGreeting() {
    const hour = new Date().getHours();
    const greeting = document.querySelector('.greeting');
    let timeOfDay = 'Good Morning';
    
    if (hour >= 12 && hour < 17) {
        timeOfDay = 'Good Afternoon';
    } else if (hour >= 17) {
        timeOfDay = 'Good Evening';
    }
    
    if (greeting) {
        greeting.textContent = greeting.textContent.replace('Good Morning', timeOfDay);
    }
}

function initializeGoalsChart() {
    const ctx = document.getElementById('goalsChart');
    if (!ctx) return;

    fetch('/api/goals')
        .then(response => response.json())
        .then(goals => {
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: goals.map(goal => goal.title),
                    datasets: [{
                        label: 'Progress',
                        data: goals.map(goal => goal.progress),
                        backgroundColor: 'rgba(var(--bs-info-rgb), 0.5)',
                        borderColor: 'rgba(var(--bs-info-rgb), 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100
                        }
                    }
                }
            });
        });
}

function loadTasks() {
    const tasksList = document.getElementById('tasksList');
    if (!tasksList) return;

    fetch('/api/tasks')
        .then(response => response.json())
        .then(tasks => {
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

function loadHabits() {
    const habitStreaks = document.getElementById('habitStreaks');
    if (!habitStreaks) return;

    fetch('/api/habits')
        .then(response => response.json())
        .then(habits => {
            habitStreaks.innerHTML = habits.map(habit => `
                <div class="habit-streak mb-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h6 class="mb-0">${habit.title}</h6>
                        <span class="badge bg-success">${habit.current_streak} day streak</span>
                    </div>
                    <div class="progress">
                        <div class="progress-bar bg-info" role="progressbar" 
                             style="width: ${(habit.current_streak/habit.best_streak)*100}%">
                        </div>
                    </div>
                </div>
            `).join('');
        });
}
