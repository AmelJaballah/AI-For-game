export class QuizManager {
    constructor(scene) {
        this.scene = scene;
        this.quizActive = false;
        this.quizContainer = null;
        this.optionButtons = [];
        this.currentQuestion = null;

        // Load questions from localStorage or use defaults
        this.questions = this.loadQuestions();
    }

    loadQuestions() {
        try {
            // Get roomId from playerData
            const playerData = JSON.parse(localStorage.getItem('playerData') || '{}');
            const roomId = playerData.roomId;

            // Try room-specific questions first
            if (roomId) {
                const roomQuestionsKey = `gameQuestions_${roomId}`;
                const roomQuestions = localStorage.getItem(roomQuestionsKey);
                if (roomQuestions) {
                    const questions = JSON.parse(roomQuestions);
                    console.log(`📝 Loaded ${questions.length} questions for room ${roomId}`);
                    return questions;
                }
            }

            // Fallback to general questions
            const storedQuestions = localStorage.getItem('gameQuestions');
            if (storedQuestions) {
                const questions = JSON.parse(storedQuestions);
                console.log(`📝 Loaded ${questions.length} questions from general storage`);
                return questions;
            }
        } catch (error) {
            console.error('Error loading questions:', error);
        }

        // Fallback to default questions
        console.log('⚠️ No questions found, using default questions');
        return [
            {
                question: "What is 2 + 2?",
                options: ["3", "4", "5", "6"],
                correct: 1
            },
            {
                question: "What is the capital of France?",
                options: ["London", "Berlin", "Paris", "Madrid"],
                correct: 2
            }
        ];
    }

    preload() {
        // No need to load graphics assets anymore
    }

    create() {
        // No Phaser UI creation needed
    }

    showQuiz() {
        this.quizActive = true;

        // Pause game physics
        this.scene.physics.pause();

        // Get random question from the loaded questions
        if (this.questions.length === 0) {
            console.warn('No questions available!');
            this.quizActive = false;
            this.scene.physics.resume();
            return Promise.resolve(true); // Default to correct if no questions
        }

        this.currentQuestion = Phaser.Math.RND.pick(this.questions);

        // Dispatch custom event to show React quiz
        const quizEvent = new CustomEvent('showQuiz', {
            detail: {
                question: this.currentQuestion.question,
                options: this.currentQuestion.options,
                correctIndex: this.currentQuestion.correct
            }
        });
        window.dispatchEvent(quizEvent);

        return new Promise((resolve) => {
            this.quizResolve = resolve;
        });
    }

    handleQuizAnswer(isCorrect) {
        if (this.quizResolve) {
            this.quizResolve(isCorrect);
        }
        this.quizActive = false;

        // Resume game physics
        this.scene.physics.resume();
    }

    isQuizActive() {
        return this.quizActive;
    }

    addQuestion(question) {
        this.questions.push(question);
    }

    getQuestionCount() {
        return this.questions.length;
    }

    // Method to update questions dynamically
    updateQuestions(newQuestions) {
        this.questions = newQuestions;
        console.log(`🔄 Updated QuizManager with ${newQuestions.length} questions`);
    }

    setQuestions(questions) {
        this.updateQuestions(questions);
    }

    getQuestions() {
        return this.questions;
    }
}