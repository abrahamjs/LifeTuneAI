class PomodoroTimer {
    constructor() {
        this.minutes = 25;
        this.seconds = 0;
        this.isRunning = false;
        this.timer = null;
        this.display = document.querySelector('#pomodoroTimer .display-4');
        this.startButton = document.getElementById('startTimer');
        this.resetButton = document.getElementById('resetTimer');
        
        this.initialize();
    }

    initialize() {
        this.startButton.addEventListener('click', () => this.toggleTimer());
        this.resetButton.addEventListener('click', () => this.resetTimer());
        this.updateDisplay();
    }

    toggleTimer() {
        if (this.isRunning) {
            this.pauseTimer();
            this.startButton.textContent = 'Start';
        } else {
            this.startTimer();
            this.startButton.textContent = 'Pause';
        }
    }

    startTimer() {
        this.isRunning = true;
        this.timer = setInterval(() => {
            if (this.seconds === 0) {
                if (this.minutes === 0) {
                    this.timerComplete();
                    return;
                }
                this.minutes--;
                this.seconds = 59;
            } else {
                this.seconds--;
            }
            this.updateDisplay();
        }, 1000);
    }

    pauseTimer() {
        this.isRunning = false;
        clearInterval(this.timer);
    }

    resetTimer() {
        this.pauseTimer();
        this.minutes = 25;
        this.seconds = 0;
        this.startButton.textContent = 'Start';
        this.updateDisplay();
    }

    timerComplete() {
        this.pauseTimer();
        this.resetTimer();
        this.showNotification();
    }

    updateDisplay() {
        this.display.textContent = `${String(this.minutes).padStart(2, '0')}:${String(this.seconds).padStart(2, '0')}`;
    }

    showNotification() {
        if (Notification.permission === 'granted') {
            new Notification('Pomodoro Complete!', {
                body: 'Time for a break!',
                icon: '/static/img/timer-icon.png'
            });
        }
    }
}

// Initialize Pomodoro Timer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('pomodoroTimer')) {
        const pomodoro = new PomodoroTimer();
    }
});
