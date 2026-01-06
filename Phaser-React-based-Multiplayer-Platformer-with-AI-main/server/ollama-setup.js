const { exec } = require('child_process');
const axios = require('axios');

class OllamaManager {
    constructor() {
        this.baseURL = 'http://localhost:11434';
        this.isRunning = false;
    }

    async checkOllamaRunning() {
        try {
            const response = await axios.get(`${this.baseURL}/api/tags`, { timeout: 5000 });
            this.isRunning = true;
            console.log(' Ollama is running');
            return true;
        } catch (error) {
            console.log(' Ollama is not running');
            return false;
        }
    }

    async pullModel() {
        return new Promise((resolve, reject) => {
            console.log(' Pulling qwen2:0.5b model...');
            
            exec('ollama pull qwen2:0.5b', (error, stdout, stderr) => {
                if (error) {
                    console.error('Error pulling model:', error);
                    reject(error);
                    return;
                }
                
                console.log('✅ Model pulled successfully');
                console.log(stdout);
                resolve();
            });
        });
    }

    async startOllama() {
        console.log('Starting Ollama...');
        
        // This assumes Ollama is installed and in PATH
        exec('ollama serve', (error, stdout, stderr) => {
            if (error) {
                console.error('Error starting Ollama:', error);
                return;
            }
            console.log('Ollama output:', stdout);
        });

        // Wait for Ollama to start
        let attempts = 0;
        while (attempts < 10) {
            if (await this.checkOllamaRunning()) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;
        }
    }

    async ensureReady() {
        if (!await this.checkOllamaRunning()) {
            await this.startOllama();
        }
        
        // Check if model exists
        try {
            const response = await axios.get(`${this.baseURL}/api/tags`);
            const models = response.data.models || [];
            const hasModel = models.some(model => model.name.includes('qwen2:0.5b'));
            
            if (!hasModel) {
                await this.pullModel();
            } else {
                console.log(' qwen2:0.5b model is available');
            }
        } catch (error) {
            console.error('Error checking models:', error);
        }
    }
}

module.exports = OllamaManager;