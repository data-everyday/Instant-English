import { questionsByMode } from './data.js';

class App {
    constructor() {
        this.currentMode = 'easy'; // Default mode
        this.baseQuestions = { ...questionsByMode };
        this.currentIndex = 0;
        this.isPlaying = false;
        this.timer = null;
        this.mascotTimer = null;
        this.voices = [];
        this.selectedVoice = null;
        this.isSpeechReady = false;

        this.loadQuestions();

        // DOM Elements
        this.jpEl = document.getElementById('question-jp');
        this.enEl = document.getElementById('answer-en');
        this.timerContainer = document.getElementById('timer-container');
        this.timerBar = document.getElementById('timer-bar');
        this.startBtn = document.getElementById('start-btn');
        this.answerBtn = document.getElementById('answer-btn'); // New Answer Button
        this.nextBtn = document.getElementById('next-btn');
        this.progressEl = document.getElementById('progress-text');

        // Form Elements
        this.addForm = document.getElementById('add-form');
        this.inputJp = document.getElementById('input-jp');
        this.inputEn = document.getElementById('input-en');

        // Mascot Elements
        this.mascotSpeech = document.getElementById('mascot-speech');

        // Config & List Elements
        this.delayInput = document.getElementById('delay-input');
        this.questionList = document.getElementById('question-list');
        this.listCount = document.getElementById('list-count');
        this.modeButtons = document.querySelectorAll('.mode-btn'); // Mode Buttons

        // Speech Recognition Setup
        this.recognition = null;
        this.setupRecognition();

        this.init();
    }

    setupRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'en-US';
            this.recognition.interimResults = false;
            this.recognition.maxAlternatives = 1;

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript.toLowerCase().trim();
                this.checkAnswer(transcript);
            };

            this.recognition.onerror = (event) => {
                console.warn('Speech recognition error', event.error);
            };
        } else {
            console.warn("Speech Recognition API not supported in this browser.");
        }
    }

    checkAnswer(spokenText) {
        if (!this.isPlaying) return;

        const currentQ = this.questions[this.currentIndex];
        // simple normalization: remove punctuation and lower case
        const normalize = (str) => str.toLowerCase().replace(/[.,?!]/g, '').trim();

        if (normalize(spokenText) === normalize(currentQ.en)) {
            // Correct answer
            this.showMascotMessage("大正解！すごい！", 3000);

            // Auto advance immediately
            clearTimeout(this.timer);
            if (this.recognition) this.recognition.stop();
            this.showAnswerAndSpeak(true); // force skip delay
        }
    }

    loadQuestions() {
        const saved = localStorage.getItem(`flashQuestions_${this.currentMode}`);
        if (saved) {
            try {
                this.questions = JSON.parse(saved);
            } catch (e) {
                this.questions = [...this.baseQuestions[this.currentMode]];
            }
        } else {
            this.questions = [...this.baseQuestions[this.currentMode]];
        }

        // Ensure at least one question exists
        if (this.questions.length === 0) {
            this.questions = [{ jp: "データがありません", en: "No data." }];
        }

        this.currentIndex = 0;
    }

    saveQuestions() {
        localStorage.setItem(`flashQuestions_${this.currentMode}`, JSON.stringify(this.questions));
        this.renderList();
    }

    init() {
        this.setupSpeechSynthesis();
        this.updateProgress();
        this.renderQuestion(false); // Initial render without playing

        // Event Listeners
        this.startBtn.addEventListener('click', () => this.togglePlay());

        this.nextBtn.addEventListener('click', () => {
            if (this.questions.length > 0) this.nextQuestion();
        });

        this.answerBtn.addEventListener('click', () => {
            if (this.isPlaying && this.timerContainer.classList.contains('active')) {
                clearTimeout(this.timer);
                if (this.recognition) this.recognition.stop();
                this.showAnswerAndSpeak(true); // force ignore generic cheer
            }
        });

        this.addForm.addEventListener('submit', (e) => this.handleAddQuestion(e));

        // Mode Toggles Setup
        this.modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.isPlaying) this.togglePlay(); // Pause and reset state if playing

                this.modeButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                this.currentMode = e.target.dataset.mode;
                this.loadQuestions();
                this.updateProgress();
                this.renderQuestion(false);
                this.renderList();
            });
        });

        // Initial render list
        this.renderList();

        // Initial mascot greeting
        setTimeout(() => this.showMascotMessage("準備はいい？<br>がんばろう！", 3000), 500);
    }

    setupSpeechSynthesis() {
        const synth = window.speechSynthesis;

        const loadVoices = () => {
            this.voices = synth.getVoices();
            // Try to find a good English voice (e.g., Google US English or default native)
            this.selectedVoice =
                this.voices.find(v => v.name.includes('Google US English')) ||
                this.voices.find(v => v.lang === 'en-US' && v.localService) ||
                this.voices.find(v => v.lang.startsWith('en'));

            if (this.voices.length > 0) {
                this.isSpeechReady = true;
            }
        };

        loadVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = loadVoices;
        }
    }

    speak(text) {
        if (!this.isSpeechReady) return;

        window.speechSynthesis.cancel(); // Stop any currently playing audio

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
        }
        utterance.lang = 'en-US';
        utterance.rate = 0.9; // Slightly slower for clarity

        window.speechSynthesis.speak(utterance);
    }

    showMascotMessage(text, duration = 2000) {
        this.mascotSpeech.innerHTML = text;
        this.mascotSpeech.classList.add('show');

        clearTimeout(this.mascotTimer);
        this.mascotTimer = setTimeout(() => {
            this.mascotSpeech.classList.remove('show');
        }, duration);
    }

    renderQuestion(autoStart = true) {
        const currentQ = this.questions[this.currentIndex];

        // Reset state
        this.enEl.classList.remove('visible');
        this.timerContainer.classList.remove('active');
        this.timerBar.classList.remove('animating');

        // Ensure DOM updates before triggering reflow for animation
        void this.timerBar.offsetWidth;

        // Set content
        this.jpEl.textContent = currentQ.jp;
        this.enEl.textContent = currentQ.en;
        this.updateProgress();

        if (autoStart && this.isPlaying) {
            this.startTimer();
        }
    }

    startTimer() {
        // Read delay input value
        let waitTime = parseInt(this.delayInput.value, 10);
        if (isNaN(waitTime) || waitTime < 1) waitTime = 4;

        this.timerContainer.classList.add('active');

        // Dynamically set animation duration based on input
        this.timerBar.style.animationDuration = `${waitTime}s`;
        this.timerBar.classList.add('animating');

        // Show Answer Button
        this.answerBtn.style.display = 'flex';
        this.nextBtn.style.display = 'none';

        // Start listening
        if (this.recognition) {
            try {
                this.recognition.start();
            } catch (e) {
                // already started
            }
        }

        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            if (this.recognition) this.recognition.stop();
            this.showAnswerAndSpeak();
        }, waitTime * 1000); // Dynamic delay before showing answer
    }

    showAnswerAndSpeak(isEarly = false) {
        this.enEl.classList.add('visible');
        this.timerContainer.classList.remove('active');
        this.timerBar.classList.remove('animating');

        // Hide Answer Button
        this.answerBtn.style.display = 'none';
        this.nextBtn.style.display = 'flex';

        const currentQ = this.questions[this.currentIndex];
        this.speak(currentQ.en);

        // Mascot cheer (only if not already cheered by correct answer)
        if (!isEarly) {
            const cheers = ["Nice!", "Great job!", "その調子！", "Good!"];
            this.showMascotMessage(cheers[Math.floor(Math.random() * cheers.length)], 2000);
        }

        if (this.isPlaying) {
            // Get user configured delay, default to 4 sec if invalid
            let waitTime = parseInt(this.delayInput.value, 10) * 1000;
            if (isNaN(waitTime) || waitTime < 1000) waitTime = 4000;

            this.timer = setTimeout(() => {
                this.nextQuestion();
            }, waitTime);
        }
    }

    nextQuestion() {
        // Stop speech if speaking
        window.speechSynthesis.cancel();
        clearTimeout(this.timer);
        if (this.recognition) {
            this.recognition.stop();
        }

        this.currentIndex = (this.currentIndex + 1) % this.questions.length;
        this.renderQuestion(this.isPlaying);
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;

        if (this.isPlaying) {
            // Re-trigger voices load logic just in case user interacted first
            if (!this.selectedVoice) this.setupSpeechSynthesis();

            // Unlock audio on iOS/Safari by speaking an empty string on direct user interaction
            const unlock = new SpeechSynthesisUtterance('');
            window.speechSynthesis.speak(unlock);

            this.startBtn.innerHTML = `
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                Pause Session
            `;
            this.showMascotMessage("スタート！<br>集中しよう！", 2000);
            this.startBtn.classList.remove('btn-primary');
            this.renderQuestion(true);
        } else {
            this.showMascotMessage("休憩中...", 3000);
            this.startBtn.innerHTML = `
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg>
                Start Training
            `;
            this.startBtn.classList.add('btn-primary');

            // Pause current execution
            clearTimeout(this.timer);
            window.speechSynthesis.cancel();
            if (this.recognition) this.recognition.stop();
            this.timerContainer.classList.remove('active');
            this.timerBar.classList.remove('animating');

            // Hide Answer Button on Pause
            this.answerBtn.style.display = 'none';
            this.nextBtn.style.display = 'flex';
        }
    }

    updateProgress() {
        this.progressEl.textContent = `${this.currentIndex + 1} / ${this.questions.length}`;
    }

    handleAddQuestion(e) {
        e.preventDefault();
        const jp = this.inputJp.value.trim();
        const en = this.inputEn.value.trim();
        if (jp && en) {
            this.questions.push({ jp, en });
            this.saveQuestions();
            this.updateProgress();

            // Reset form
            this.inputJp.value = '';
            this.inputEn.value = '';

            this.showMascotMessage("問題を追加したよ！<br>えらい！", 3000);
        }
    }

    renderList() {
        this.questionList.innerHTML = '';
        this.listCount.textContent = `(${this.questions.length})`;

        this.questions.forEach((q, index) => {
            const li = document.createElement('li');
            li.className = 'question-item';

            const content = document.createElement('div');
            content.className = 'question-content';
            content.innerHTML = `
                <span class="q-jp">${q.jp}</span>
                <span class="q-en">${q.en}</span>
            `;

            const delBtn = document.createElement('button');
            delBtn.className = 'btn-delete';
            delBtn.innerHTML = '&times;';
            delBtn.onclick = () => this.deleteQuestion(index);

            li.appendChild(content);
            li.appendChild(delBtn);
            this.questionList.appendChild(li);
        });
    }

    deleteQuestion(index) {
        if (this.questions.length <= 1) {
            alert("最低1つの問題が必要です！");
            return;
        }

        this.questions.splice(index, 1);
        if (this.currentIndex >= this.questions.length) {
            this.currentIndex = 0;
        }

        this.saveQuestions();
        this.updateProgress();

        if (!this.isPlaying) {
            this.renderQuestion(false);
        }
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
