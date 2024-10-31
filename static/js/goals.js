let goalsChart;

document.addEventListener('DOMContentLoaded', function() {
    loadGoals();

    // Handle new goal form submission
    document.getElementById('saveGoal').addEventListener('click', function() {
        const title = document.getElementById('goalTitle').value;
        const description = document.getElementById('goalDescription').value;
        const category = document.getElementById('goalCategory').value;
        const target_date = document.getElementById('goalTargetDate').value;

        fetch('/api/goals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title,
                description,
                category,
                target_date
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                const modal = bootstrap.Modal.getInstance(document.getElementById('newGoalModal'));
                modal.hide();
                loadGoals();
            }
        });
    });
});

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
