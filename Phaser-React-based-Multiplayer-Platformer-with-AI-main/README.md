# The Notebook
## Educational Multiplayer Platformer

EduPlatformer is an engaging educational platformer game that combines classic 2D platforming mechanics with interactive quiz challenges. Players explore vibrant levels, collect coins, and test their knowledge through integrated quizzes.

## Core Gameplay
- Classic Platformer Mechanics: Run, jump, and navigate through carefully designed levels
- Interactive Quizzes: Encounter coins that trigger educational questions
- Progressive Difficulty: Challenging obstacles and increasingly difficult questions
- Score System: Earn points for correct answers and coin collection

## Multiplayer Experience
- Real-time Multiplayer: Play with friends in synchronized game sessions
- Room-based System: Create or join game rooms with unique codes
- Live Player Interzaction: See other players move in real-time
- Competitive Scoring: Compete for high scores with other players

## Multiplayer Mode
- Create or join a game room
- Wait for players to join the session
- Explore together in the same game world
- Compete or collaborate to answer quiz questions
- Track progress with real-time score updates

---

# Technical Architecture
## Frontend
- Phaser 3: Game engine for rendering and physics
- React: UI framework for menus and lobby system
- Socket.io Client: Real-time multiplayer communication

## Backend
- Node.js & Express: Server runtime and API
- Socket.io: WebSocket connections for real-time features
- Room Management: Dynamic game session handling

## Key Systems
- Map Management: Tiled map integration with custom object layers
- Player Physics: Custom collision detection and movement
- Quiz System: Dynamic question loading and validation
- Network Synchronization: Smooth multiplayer interpolation
- State Management: Game progress and player data persistence

## Educational Value
Transforms learning into an engaging adventure by:
- Making Learning Fun: Gamified approach to education
- Instant Feedback: Immediate results for quiz answers
- Progressive Challenges: Questions adapt to player performance
- Collaborative Learning: Multiplayer encourages teamwork

# Getting Started

## Prerequisites
- Node.js (v14 or higher)
- Modern web browser with JavaScript enabled

## Installation
1. Clone the repository
2. Navigate to the client directory
3. Install dependencies: `npm install`
4. Start the development server: `npm run dev`
5. Open your browser to `http://localhost:3000`
6. To deploy the multiplayer server go to the server directory
7. Install dependencies: `npm install`
8. Start the development server: `node server.js`

## Project Structure
```
the_notebook/
├── client/                 
│   └──  src/
│         └── components/
│                 └── Game/      
│                 └── Home/   
│                 └── Quiz/   
│                 └── Room/   
└──  server/               
        └── server.js              
```

# Adding New Levels
- Create maps using Tiled map editor
- Export as JSON to client/public/assets/maps/
- Define custom objects for coins, spawn areas, and obstacles

## Acknowledgments
- Phaser 3 for the powerful game framework
- Tiled for excellent map editing capabilities
- Socket.io for seamless real-time communication
T- he educational gaming community for inspiration