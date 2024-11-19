document.addEventListener('DOMContentLoaded', function() {
    loadAnalytics();
    loadInsights();
});

function loadAnalytics() {
    fetch('/api/analytics/insights')
        .then(response => response.json())
        .then(data => {
            updateInsightsList(data);
            generateCharts(data);
        });
}

function updateInsightsList(insights) {
    const insightsList = document.getElementById('insightsList');
    if (!insights.length) {
        insightsList.innerHTML = '<div class="alert alert-info">No insights available yet. Keep using the app to generate personalized insights!</div>';
        return;
    }

    insightsList.innerHTML = insights.map(insight => `
        <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <small class="text-muted">${new Date(insight.created_at).toLocaleDateString()}</small>
                <span class="badge bg-info">${insight.type}</span>
            </div>
            <p class="mb-1">${insight.content}</p>
            ${insight.recommendations ? `
                <div class="mt-2">
                    <strong>Recommendations:</strong>
                    <p class="mb-0 text-muted">${insight.recommendations}</p>
                </div>
            ` : ''}
            <button class="btn btn-sm btn-outline-secondary mt-2" 
                    onclick="acknowledgeInsight(${insight.id})">
                Mark as Read
            </button>
        </div>
    `).join('');
}

function acknowledgeInsight(insightId) {
    fetch(`/api/analytics/acknowledge-insight/${insightId}`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            loadAnalytics();
        }
    });
}

function generateCharts(data) {
    // Productivity Chart
    const productivityCtx = document.getElementById('productivityChart');
    new Chart(productivityCtx, {
        type: 'line',
        data: {
            labels: data.map(d => new Date(d.created_at).toLocaleDateString()),
            datasets: [{
                label: 'Productivity Score',
                data: data.map(d => d.productivity_score || 0),
                borderColor: 'rgba(var(--bs-info-rgb), 1)',
                tension: 0.4
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

    // Task Completion Chart
    const taskCtx = document.getElementById('taskCompletionChart');
    new Chart(taskCtx, {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Tasks Completed',
                data: data.slice(-7).map(d => d.tasks_completed || 0),
                backgroundColor: 'rgba(var(--bs-success-rgb), 0.5)'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });

    // Habit Streak Chart
    const habitCtx = document.getElementById('habitStreakChart');
    new Chart(habitCtx, {
        type: 'radar',
        data: {
            labels: data.map(d => new Date(d.created_at).toLocaleDateString()),
            datasets: [{
                label: 'Active Habits',
                data: data.map(d => d.active_habits || 0),
                borderColor: 'rgba(var(--bs-warning-rgb), 1)',
                backgroundColor: 'rgba(var(--bs-warning-rgb), 0.2)'
            }]
        },
        options: {
            responsive: true,
            scales: {
                r: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}
