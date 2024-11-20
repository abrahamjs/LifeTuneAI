class VoiceAssistant {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.listeningAnimation = document.getElementById('listeningAnimation');
        this.voiceError = document.getElementById('voiceError');
        
        // Initialize with error handling
        this.initialize().catch(error => {
            console.error('Error initializing voice assistant:', error);
            this.showError('Could not initialize voice assistant. Please check your browser permissions.');
        });
    }

    async initialize() {
        try {
            // Check browser support with better fallback handling
            if (!this.setupWebSpeechFallback() && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)) {
                throw new Error('Speech recognition is not supported in your browser');
            }
            
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                await this.setupSpeechRecognition();
            }
        } catch (error) {
            this.handleInitializationError(error);
        }
    }

    handleInitializationError(error) {
        console.error('Initialization error:', error);
        let errorMessage = 'Speech recognition initialization failed. ';
        
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Please grant microphone access permissions.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'No microphone was found on your device.';
        } else {
            errorMessage += 'Falling back to text input mode.';
        }
        
        this.showError(errorMessage);
        this.enableFallbackMode();
    }

    showError(message) {
        this.voiceError.textContent = message;
        this.voiceError.classList.add('show');
        this.listeningAnimation.classList.add('d-none');
    }

    enableFallbackMode() {
        // Add a text input fallback when voice input fails
        const voiceInterface = document.getElementById('voiceInterface');
        if (voiceInterface) {
            const fallbackHtml = `
                <div class="alert alert-warning">
                    <p>Voice input is not available. Please use text input instead:</p>
                    <div class="input-group">
                        <input type="text" class="form-control" id="textCommandInput" 
                               placeholder="Type your command (e.g., 'add task buy groceries')">
                        <button class="btn btn-outline-secondary" type="button" id="sendTextCommand">
                            Send
                        </button>
                    </div>
                </div>
            `;
            voiceInterface.insertAdjacentHTML('beforeend', fallbackHtml);
            
            document.getElementById('sendTextCommand')?.addEventListener('click', () => {
                const input = document.getElementById('textCommandInput');
                if (input && input.value) {
                    this.processVoiceCommand(input.value);
                    input.value = '';
                }
            });
        }
    }

    setupWebSpeechFallback() {
        try {
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
        } catch (error) {
            console.error('Error setting up Web Speech API:', error);
            return false;
        }
    }

    async setupSpeechRecognition() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('Microphone access granted');
            
            this.mediaRecorder = new MediaRecorder(stream);
            this.setupMediaRecorderHandlers();
        } catch (error) {
            throw new Error('Failed to access microphone: ' + error.message);
        }
    }

    setupMediaRecorderHandlers() {
        this.mediaRecorder.ondataavailable = (event) => {
            this.audioChunks.push(event.data);
        };

        this.mediaRecorder.onstop = async () => {
            try {
                console.log('Recording stopped, processing audio...');
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.audioChunks = [];
                await this.sendAudioToWhisper(audioBlob);
            } catch (error) {
                console.error('Error processing audio:', error);
                this.showError('Error processing audio. Please try again.');
            }
        };

        this.mediaRecorder.onerror = (error) => {
            console.error('MediaRecorder error:', error);
            this.showError('Error recording audio. Please try again.');
        };
    }

    setupRecognitionHandlers() {
        this.recognition.onresult = (event) => {
            try {
                const transcript = Array.from(event.results)
                    .map(result => result[0].transcript)
                    .join('');
                
                if (event.results[0].isFinal) {
                    this.processVoiceCommand(transcript);
                }
                
                document.getElementById('voiceText').textContent = transcript;
            } catch (error) {
                console.error('Error processing speech result:', error);
                this.showError('Error processing speech. Please try again.');
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.handleRecognitionError(event);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            document.getElementById('voiceButton')?.classList.remove('listening');
            this.listeningAnimation.classList.add('d-none');
        };
    }

    handleRecognitionError(event) {
        let errorMessage = 'Speech recognition error: ';
        switch (event.error) {
            case 'not-allowed':
                errorMessage += 'Microphone access denied.';
                break;
            case 'no-speech':
                errorMessage += 'No speech detected.';
                break;
            case 'network':
                errorMessage += 'Network error occurred.';
                break;
            default:
                errorMessage += event.error;
        }
        this.showError(errorMessage);
        this.enableFallbackMode();
    }

    async toggleListening() {
        try {
            if (this.isListening) {
                await this.stopListening();
            } else {
                await this.startListening();
            }
        } catch (error) {
            console.error('Error toggling listening state:', error);
            this.showError('Error toggling voice input. Please try again.');
        }
    }

    async startListening() {
        try {
            this.listeningAnimation.classList.remove('d-none');
            this.voiceError.classList.remove('show');
            document.getElementById('voiceButton')?.classList.add('listening');
            
            if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
                this.audioChunks = [];
                this.mediaRecorder.start();
                this.isListening = true;
            } else if (this.recognition) {
                await this.recognition.start();
                this.isListening = true;
            } else {
                throw new Error('No recording method available');
            }
        } catch (error) {
            console.error('Error starting listening:', error);
            this.showError('Failed to start listening. Please try again.');
            this.enableFallbackMode();
        }
    }

    async stopListening() {
        try {
            this.listeningAnimation.classList.add('d-none');
            document.getElementById('voiceButton')?.classList.remove('listening');
            
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
            } else if (this.recognition) {
                this.recognition.stop();
            }
            this.isListening = false;
        } catch (error) {
            console.error('Error stopping listening:', error);
            this.showError('Failed to stop listening. Please try again.');
        }
    }

    async sendAudioToWhisper(audioBlob) {
        try {
            const formData = new FormData();
            const audioFile = new File([audioBlob], 'audio.wav', {
                type: 'audio/wav'
            });
            formData.append('audio', audioFile);

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
            if (!transcript) {
                throw new Error('No transcription received');
            }

            document.getElementById('voiceText').textContent = transcript;
            await this.processVoiceCommand(transcript);
        } catch (error) {
            console.error('Error in Whisper transcription:', error);
            this.showError(`Speech recognition failed: ${error.message}. Falling back to browser recognition.`);
            
            if (this.recognition) {
                try {
                    await this.recognition.start();
                } catch (recognitionError) {
                    console.error('Failed to start browser recognition:', recognitionError);
                    this.enableFallbackMode();
                }
            } else {
                this.enableFallbackMode();
            }
        } finally {
            this.isListening = false;
            document.getElementById('voiceButton')?.classList.remove('listening');
        }
    }

    async processVoiceCommand(transcript) {
        try {
            const text = transcript.toLowerCase();
            
            if (text.includes('add task') || text.includes('create task')) {
                const taskTitle = text.replace(/add task|create task/i, '').trim();
                if (taskTitle) {
                    await this.createTask(taskTitle);
                    await this.speak(`Creating new task: ${taskTitle}`);
                }
            } else if (text.includes('add journal') || text.includes('create journal')) {
                const journalText = text.replace(/add journal|create journal/i, '').trim();
                if (journalText) {
                    await this.saveVoiceNote(journalText, 'journal');
                    await this.speak('Journal entry saved');
                }
            } else if (text.includes('list tasks') || text.includes('show tasks')) {
                await this.listTasks();
            } else {
                await this.speak("I didn't understand that command. Try saying 'add task', 'create journal', or 'list tasks'.");
            }
        } catch (error) {
            console.error('Error processing voice command:', error);
            this.showError('Error processing command. Please try again.');
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
            
            if (!response.ok) {
                throw new Error('Failed to create task');
            }
            
            if (typeof loadTasks === 'function') {
                await loadTasks();
            }
        } catch (error) {
            console.error('Error creating task:', error);
            await this.speak('Sorry, there was an error creating the task.');
            throw error;
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
            await this.speak('Sorry, there was an error saving your voice note.');
            throw error;
        }
    }

    async listTasks() {
        try {
            const response = await fetch('/api/tasks');
            if (!response.ok) {
                throw new Error('Failed to fetch tasks');
            }
            
            const tasks = await response.json();
            
            if (tasks.length === 0) {
                await this.speak('You have no tasks.');
                return;
            }
            
            const taskText = tasks
                .filter(task => !task.completed)
                .map(task => task.title)
                .join(', ');
                
            await this.speak(`Here are your tasks: ${taskText}`);
        } catch (error) {
            console.error('Error listing tasks:', error);
            await this.speak('Sorry, I could not retrieve your tasks.');
            throw error;
        }
    }

    async speak(text) {
        try {
            const utterance = new SpeechSynthesisUtterance(text);
            this.synthesis.speak(utterance);
            
            return new Promise((resolve, reject) => {
                utterance.onend = resolve;
                utterance.onerror = reject;
            });
        } catch (error) {
            console.error('Error in speech synthesis:', error);
            throw error;
        }
    }
}

// Initialize the voice assistant when the page loads
let voiceAssistant;
document.addEventListener('DOMContentLoaded', () => {
    try {
        voiceAssistant = new VoiceAssistant();
    } catch (error) {
        console.error('Error initializing voice assistant:', error);
    }
});
