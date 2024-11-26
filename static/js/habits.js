document.addEventListener('DOMContentLoaded', function() {
    loadHabits();

    // Handle new habit form submission
    document.getElementById('saveHabit').addEventListener('click', function() {
        const title = document.getElementById('habitTitle').value;
        const description = document.getElementById('habitDescription').value;
        const frequency = document.getElementById('habitFrequency').value;

        fetch('/api/habits', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title,
                description,
                frequency
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                const modal = bootstrap.Modal.getInstance(document.getElementById('newHabitModal'));
                modal.hide();
                loadHabits();
            }
        });
    });
});

function loadHabits() {
    fetch('/api/habits')
        .then(response => response.json())
        .then(habits => {
            const habitsList = document.getElementById('habitsList');
            habitsList.innerHTML = habits.map(habit => `
                <div class="habit-streak mb-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h6 class="mb-0">${habit.title}</h6>
                        <div>
                            <span class="badge bg-success me-2">${habit.current_streak} day streak</span>
                            <span class="badge bg-info">Best: ${habit.best_streak} days</span>
                        </div>
                    </div>
                    <div class="progress">
                        <div class="progress-bar bg-info" role="progressbar" 
                             style="width: ${(habit.current_streak/Math.max(habit.best_streak, 1))*100}%">
                        </div>
                    </div>
                </div>
            `).join('');
        });
}
