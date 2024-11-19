class VoiceAssistant {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.listeningAnimation = document.getElementById('listeningAnimation');
        this.voiceError = document.getElementById('voiceError');
        
        // Check browser support
        if (!this.setupWebSpeechFallback() && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)) {
            this.voiceError.textContent = 'Speech recognition is not supported in your browser. Please try using Chrome, Edge, or Safari.';
            this.voiceError.classList.add('show');
            return;
        }
        
        this.setupSpeechRecognition();
    }

    setupWebSpeechFallback() {
        // Check for both standard and webkit prefixed API
        if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            this.setupRecognitionHandlers();
            return true;
        }
        return false;
    }

    setupRecognitionHandlers() {
        this.recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0].transcript)
                .join('');
            
            if (event.results[0].isFinal) {
                this.processVoiceCommand(transcript);
            }
            
            document.getElementById('voiceText').textContent = transcript;
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.voiceError.textContent = 'Speech recognition error: ' + event.error;
            this.voiceError.classList.add('show');
            this.listeningAnimation.classList.add('d-none');
            this.isListening = false;
            document.getElementById('voiceButton').classList.remove('listening');
        };

        this.recognition.onend = () => {
            this.isListening = false;
            document.getElementById('voiceButton').classList.remove('listening');
            this.listeningAnimation.classList.add('d-none');
        };
    }

    setupSpeechRecognition() {
        // Setup for Whisper-based recording
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    this.mediaRecorder = new MediaRecorder(stream);
                    this.mediaRecorder.ondataavailable = (event) => {
                        this.audioChunks.push(event.data);
                    };
                    this.mediaRecorder.onstop = async () => {
                        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                        this.audioChunks = [];
                        await this.sendAudioToWhisper(audioBlob);
                    };
                })
                .catch(err => {
                    console.error('Error accessing microphone:', err);
                    this.setupWebSpeechFallback();
                });
        } else {
            this.setupWebSpeechFallback();
        }
    }

    async sendAudioToWhisper(audioBlob) {
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'audio.wav');

            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            const transcript = data.text;
            document.getElementById('voiceText').textContent = transcript;
            this.processVoiceCommand(transcript);
        } catch (error) {
            console.error('Error in Whisper transcription:', error);
            this.voiceError.textContent = 'Speech recognition failed. Please try again.';
            this.voiceError.classList.add('show');
            this.listeningAnimation.classList.add('d-none');
            
            // Try Web Speech API as fallback
            if (this.recognition) {
                this.recognition.start();
            } else {
                this.speak("Speech recognition failed. Please try again or use a supported browser.");
            }
        } finally {
            this.isListening = false;
            document.getElementById('voiceButton').classList.remove('listening');
        }
    }

    toggleListening() {
        if (this.isListening) {
            this.listeningAnimation.classList.add('d-none');
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
            } else if (this.recognition) {
                this.recognition.stop();
            }
            this.isListening = false;
        } else {
            this.listeningAnimation.classList.remove('d-none');
            this.voiceError.classList.remove('show');
            if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
                this.audioChunks = [];
                this.mediaRecorder.start();
                this.isListening = true;
                document.getElementById('voiceButton').classList.add('listening');
            } else if (this.recognition) {
                this.recognition.start();
                this.isListening = true;
                document.getElementById('voiceButton').classList.add('listening');
            } else {
                this.speak("Speech recognition is not supported in your browser.");
            }
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
                if (typeof loadTasks === 'function') {
                    loadTasks();
                }
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
