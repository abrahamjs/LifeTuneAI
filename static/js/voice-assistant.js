class VoiceAssistant {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.setupSpeechRecognition();
    }

    setupSpeechRecognition() {
        if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0].transcript)
                    .join('');
                
                if (event.results[0].isFinal) {
                    this.processVoiceCommand(transcript);
                }
                
                document.getElementById('voiceText').textContent = transcript;
            };

            this.recognition.onend = () => {
                this.isListening = false;
                document.getElementById('voiceButton').classList.remove('listening');
            };
        }
    }

    toggleListening() {
        if (!this.recognition) {
            this.speak("Speech recognition is not supported in your browser.");
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
            this.isListening = false;
        } else {
            this.recognition.start();
            this.isListening = true;
            document.getElementById('voiceButton').classList.add('listening');
        }
    }

    processVoiceCommand(transcript) {
        const text = transcript.toLowerCase();
        
        // Add new task command
        if (text.includes('add task') || text.includes('create task')) {
            const taskTitle = text.replace(/add task|create task/i, '').trim();
            if (taskTitle) {
                this.createTask(taskTitle);
                this.speak(`Creating new task: ${taskTitle}`);
            }
        }
        // Add journal entry
        else if (text.includes('add journal') || text.includes('create journal')) {
            const journalText = text.replace(/add journal|create journal/i, '').trim();
            if (journalText) {
                this.saveVoiceNote(journalText, 'journal');
                this.speak('Journal entry saved');
            }
        }
        // List tasks command
        else if (text.includes('list tasks') || text.includes('show tasks')) {
            this.listTasks();
        }
        else {
            this.speak("I didn't understand that command. Try saying 'add task', 'create journal', or 'list tasks'.");
        }
    }

    async createTask(title) {
        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: title,
                    description: 'Created via voice command',
                    priority: 'normal',
                    due_date: new Date().toISOString().split('T')[0]
                })
            });
            
            if (response.ok) {
                loadTasks();  // Refresh the tasks list
            }
        } catch (error) {
            console.error('Error creating task:', error);
            this.speak('Sorry, there was an error creating the task.');
        }
    }

    async saveVoiceNote(transcription, noteType) {
        try {
            const response = await fetch('/api/voice-notes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transcription: transcription,
                    note_type: noteType
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to save voice note');
            }
        } catch (error) {
            console.error('Error saving voice note:', error);
            this.speak('Sorry, there was an error saving your voice note.');
        }
    }

    async listTasks() {
        try {
            const response = await fetch('/api/tasks');
            const tasks = await response.json();
            
            if (tasks.length === 0) {
                this.speak('You have no tasks.');
                return;
            }
            
            const taskText = tasks
                .filter(task => !task.completed)
                .map(task => task.title)
                .join(', ');
                
            this.speak(`Here are your tasks: ${taskText}`);
        } catch (error) {
            console.error('Error listing tasks:', error);
            this.speak('Sorry, I could not retrieve your tasks.');
        }
    }

    speak(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        this.synthesis.speak(utterance);
    }
}

// Initialize the voice assistant when the page loads
let voiceAssistant;
document.addEventListener('DOMContentLoaded', () => {
    voiceAssistant = new VoiceAssistant();
});
