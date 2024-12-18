document.addEventListener('DOMContentLoaded', function() {
    loadAnalytics();
    
    // Refresh data every 5 minutes
    setInterval(() => {
        loadAnalytics();
    }, 300000);
});

// Reset and reload all data
function resetAndReloadData() {
    fetch('/api/reset-data', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                window.location.reload();
            }
        });
}

function loadAnalytics() {
    Promise.all([
        fetch('/api/analytics/insights').then(response => response.json()),
        fetch('/api/analytics/trends').then(response => response.json())
    ])
    .then(([insights, trends]) => {
        updateInsightsList(insights);
        updateProductivityChart(trends);
        updateTaskCompletionChart(trends);
        updateHabitStreakChart(trends);
        updateAdvancedMetricsChart(trends);
        updatePredictionsChart(trends);
    })
    .catch(error => {
        console.error('Error loading analytics:', error);
        document.getElementById('insightsList').innerHTML = 
            '<div class="alert alert-danger">Error loading analytics data. Please try again later.</div>';
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
                <span class="badge bg-${getInsightTypeBadgeClass(insight.type)}">${insight.type}</span>
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

function getInsightTypeBadgeClass(type) {
    switch(type.toLowerCase()) {
        case 'productivity': return 'info';
        case 'efficiency': return 'warning';
        case 'goals': return 'success';
        case 'habits': return 'primary';
        default: return 'secondary';
    }
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

function updateProductivityChart(data) {
    const productivityCtx = document.getElementById('productivityChart');
    if (!productivityCtx) return;

    new Chart(productivityCtx, {
        type: 'line',
        data: {
            labels: data.productivity.dates,
            datasets: [{
                label: 'Productivity Score',
                data: data.productivity.productivity_scores,
                borderColor: 'rgba(var(--bs-info-rgb), 1)',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(var(--bs-info-rgb), 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Productivity Trend'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

function updateTaskCompletionChart(data) {
    const taskCtx = document.getElementById('taskCompletionChart');
    if (!taskCtx) return;

    new Chart(taskCtx, {
        type: 'bar',
        data: {
            labels: data.productivity.dates.slice(-7),
            datasets: [{
                label: 'Tasks Completed',
                data: data.productivity.tasks_completed.slice(-7),
                backgroundColor: 'rgba(var(--bs-success-rgb), 0.5)',
                borderColor: 'rgba(var(--bs-success-rgb), 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function updateHabitStreakChart(data) {
    const habitCtx = document.getElementById('habitStreakChart');
    if (!habitCtx) return;

    new Chart(habitCtx, {
        type: 'radar',
        data: {
            labels: ['Active Habits', 'Focus Time', 'Habit Impact'],
            datasets: [{
                label: 'Current Performance',
                data: [
                    data.productivity.active_habits.slice(-1)[0],
                    data.productivity.focus_time.slice(-1)[0] / 240 * 100,
                    data.productivity.habit_impact.slice(-1)[0]
                ],
                borderColor: 'rgba(var(--bs-warning-rgb), 1)',
                backgroundColor: 'rgba(var(--bs-warning-rgb), 0.2)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20
                    }
                }
            }
        }
    });
}

function updateAdvancedMetricsChart(data) {
    const metricsCtx = document.getElementById('advancedMetricsChart');
    if (!metricsCtx) return;

    new Chart(metricsCtx, {
        type: 'line',
        data: {
            labels: data.productivity.dates,
            datasets: [
                {
                    label: 'Task Efficiency',
                    data: data.productivity.task_efficiency,
                    borderColor: 'rgba(var(--bs-primary-rgb), 1)',
                    backgroundColor: 'rgba(var(--bs-primary-rgb), 0.1)',
                    fill: true
                },
                {
                    label: 'Habit Impact',
                    data: data.productivity.habit_impact,
                    borderColor: 'rgba(var(--bs-success-rgb), 1)',
                    backgroundColor: 'rgba(var(--bs-success-rgb), 0.1)',
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Score'
                    }
                }
            }
        }
    });
}

function updatePredictionsChart(data) {
    const predictionsCtx = document.getElementById('predictionsChart');
    if (!predictionsCtx) return;

    new Chart(predictionsCtx, {
        type: 'line',
        data: {
            labels: data.productivity.dates,
            datasets: [{
                label: 'Goal Completion Prediction',
                data: data.productivity.goal_predictions,
                borderColor: 'rgba(var(--bs-info-rgb), 1)',
                backgroundColor: 'rgba(var(--bs-info-rgb), 0.1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Probability (%)'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Probability: ${context.raw.toFixed(1)}%`;
                        }
                    }
                }
            }
        }
    });
}
