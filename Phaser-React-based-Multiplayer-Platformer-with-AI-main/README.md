# EduPlatformer: Multiplayer AI-Powered Platformer

EduPlatformer is an engaging educational platformer that combines classic 2D mechanics with **AI-generated quiz challenges**. Players explore levels, collect coins, and answer questions generated in real-time from **uploaded PDF documents**.

## 🚀 Core Features

### 🎮 Gameplay
- **Classic Platforming**: Run, jump, and wall-jump through pixel-art levels.
- **Multiplayer**: Real-time synchronization of movement and states using Socket.io. 
- **Roles**: 
    - **Student**: Plays the game, collects coins, answers questions.
    - **Teacher/Host**: Orchestrates the game, uploads study materials (PDFs), supervizes the lobby.

### 🧠 AI-Powered Learning
- **PDF-to-Quiz**: Upload any educational PDF (textbook, notes).
- **On-Demand Generation**: The system uses a local LLM (**Ollama/Qwen**) to read the PDF and generate relevant multiple-choice questions automatically.
- **in-Game Integration**: Questions appear dynamically when players collect "Quiz Coins".

---

## 🏗️ Technical Architecture

### Frontend (Client)
- **React**: Handles the UI overlay, Lobby system, PDF upload interface, and State management.
- **Phaser 3**: dedicated game engine for rendering, physics (Arcade), and inputs.
- **Socket.io-Client**: Syncs player coordinates (`x`, `y`, `velocity`), animations, and events.

### Backend (Server)
- **Node.js + Express**: Serves API and health checks.
- **Socket.io**: 
    - Manages Rooms and connections.
    - Authoritative source for Coin states and Scoreboards.
    - Broadcasts AI-generated questions to all room members.

### AI Service
- **Ollama**: Local AI runner.
- **Model**: `qwen3:8b` (optimized for instruction following).
- **Flow**: Browser extracts PDF text -> Sends to local Ollama API -> Returns JSON formatted questions -> React broadcasts to Server.

---

## 🛠️ Getting Started

### Prerequisites
1.  **Node.js** (v16+)
2.  **Ollama**: [Download here](https://ollama.com/)
    - **Important**: You must pull the model used by the app.
    - Run: `ollama pull qwen3:8b`
    - Ensure Ollama is running (`ollama serve` or via desktop app) at `http://localhost:11434`.

### Installation

**1. Client (Game & UI)**
```bash
cd client
npm install
npm run dev
# Runs on http://localhost:3000
```

**2. Server (Multiplayer Logic)**
```bash
cd server
npm install
node server.js
# Runs on http://localhost:3001
```

### How to Run a Session
1.  **Start Server & Client**.
2.  **Open Browser**: Go to `http://localhost:3000`.
3.  **Host**: Select "Host Game" (Teacher).
    - **Upload PDF**: In the lobby, click "Upload PDF".
    - Select a file -> Wait for AI processing -> Click "Use Questions".
    - Share the **Room ID** with students.
4.  **Students**: Join via `http://localhost:3000` using the Room ID.
5.  **Play**: Host starts the game. Students jump and solve quizzes!

---

## 📂 Project Structure

```
root/
├── client/                 
│   └── src/
│       ├── components/
│       │   ├── Game/          # Phaser + React Game Logic
│       │   │   ├── entities/  # Player class, sync logic
│       │   │   └── scenes/    # Phaser Scenes
│       │   ├── PDF/           # PDF extraction & AI integration
│       │   └── Room/          # Lobby & Join logic
│       └── ...
└── server/               
    └── server.js              # Socket.io events & Room handling
```

## 🤝 Contributing
- **Maps**: Create new levels using **Tiled** and export to `client/public/assets/maps`.
- **AI**: Tweaking the prompt in `PDFUpload.jsx` can change the difficulty/style of questions.