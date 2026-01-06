import Phaser from "phaser";
import { MapManager } from "./managers/MapManager";
import { Player } from "./entities/Player";
import { MultiplayerPlayer } from "./entities/MultiplayerPlayer";
import { QuizManager } from "./managers/QuizManager";
import { CollisionManager } from "./managers/CollisionManager";
import { PlayerManager } from "./managers/PlayerManager";
import { NetworkManager } from "./managers/NetworkManager";
import { UIManager } from "./managers/UIManager";

export default class PlatformerScene extends Phaser.Scene {
    constructor() {
        super({ key: "PlatformerScene" });

        // Managers
        this.mapManager = null;
        this.collisionManager = null;
        this.playerManager = null;
        this.networkManager = null;
        this.uiManager = null;
        this.quizManager = null;

        // Game state
        this.score = 0;
        this.lives = 5;
        this.coinsCollected = 0;
        this.lastEmittedState = { lives: 5, coins: 0, playerName: 'Player' };

        // Multiplayer
        this.roomCoins = new Map();
        this.isMultiplayer = false;
        this.isPlayerReady = false;

        // Camera settings
        this.normalZoom = 3.5;
        this.quizZoom = 1.7;
        this.cameraZoom = this.normalZoom;

        // Backgrounds
        this.backgrounds = [];
        this.currentCoin = null;

        // NEW: Respawn system
        this.isRespawning = false;
        this.respawnTimer = 0;
        this.respawnTime = 10; // seconds
        this.respawnText = null;
        this.respawnCountdownText = null;
        this.deathEffect = null;

        // Teacher Mode
        this.isTeacher = false;
        this.teacherCameraSpeed = 10;
        this.cursors = null;
    }

    preload() {
        this.loadPlayerAnimations();
        this.createTextures();
        this.loadParallaxBackgrounds();

        // Initialize managers
        this.mapManager = new MapManager(this);
        this.quizManager = new QuizManager(this);

        this.mapManager.preload();
        this.quizManager.preload();
    }

    loadParallaxBackgrounds() {
        // Load background layers - you can replace these with your own assets
        this.load.image("parallax_background_1", "/assets/background_2.png");
        this.load.image("parallax_background_2", "/assets/background_3.png");

        // Fallback: create colored placeholder backgrounds if images don't exist
        if (!this.textures.exists("parallax_background_1")) {
            this.load.image("parallax_background_1", "/assets/background_2.png");
        }

        if (!this.textures.exists("parallax_background_2")) {
            this.load.image("parallax_background_2", "/assets/background_3.png");
        }

    }

    createParallaxPlaceholder(textureKey, color) {
        // Create a simple gradient-like background as placeholder
        const graphics = this.add.graphics();
        const width = 800; // Match game width
        const height = 600; // Match game height

        // Create gradient effect
        for (let y = 0; y < height; y += 2) {
            const alpha = 0.3 + (y / height) * 0.7;
            graphics.fillStyle(color, alpha);
            graphics.fillRect(0, y, width, 2);
        }

        // Add some stars for distant background
        if (color === 0x1a237e) {
            // Only for the farthest background
            graphics.fillStyle(0xffffff, 0.8);
            for (let i = 0; i < 50; i++) {
                const x = Phaser.Math.Between(0, width);
                const y = Phaser.Math.Between(0, height);
                const size = Phaser.Math.FloatBetween(0.5, 2);
                graphics.fillRect(x, y, size, size);
            }
        }

        graphics.generateTexture(textureKey, width, height);
        graphics.destroy();
    }

    loadPlayerAnimations() {
        // Use absolute paths from the public folder or correct relative paths
        const basePath = '/assets/sprites/nick/';

        // Load idle animation frames
        this.load.image('player_idle_1', `${basePath}idle/player_idle_1.png`);
        this.load.image('player_idle_2', `${basePath}idle/player_idle_2.png`);

        // Load run animation frames
        this.load.image('player_run_1', `${basePath}run/player_run_1.png`);
        this.load.image('player_run_2', `${basePath}run/player_run_2.png`);
        this.load.image('player_run_3', `${basePath}run/player_run_3.png`);
        this.load.image('player_run_4', `${basePath}run/player_run_4.png`);

        // Load jump animation frames
        this.load.image('player_jump_1', `${basePath}jump/player_jump_1.png`);
    }

    createTextures() {
        // Only create textures if they don't exist
        const textures = this.textures;

        if (!textures.exists("player")) {
            const playerGraphics = this.add.graphics();
            playerGraphics.fillStyle(0xff0000, 1);
            playerGraphics.fillRect(0, 0, 16, 16);
            playerGraphics.generateTexture("player", 16, 16);
            playerGraphics.destroy();
        }

        if (!textures.exists("coin")) {
            const coinGraphics = this.add.graphics();
            coinGraphics.fillStyle(0xffff00, 1);
            coinGraphics.fillCircle(8, 8, 6);
            coinGraphics.generateTexture("coin", 16, 16);
            coinGraphics.destroy();
        }

        if (!textures.exists("spike")) {
            const spikeGraphics = this.add.graphics();
            spikeGraphics.fillStyle(0xff0000, 1);
            spikeGraphics.fillTriangle(0, 16, 8, 0, 16, 16);
            spikeGraphics.generateTexture("spike", 16, 16);
            spikeGraphics.destroy();
        }
    }

    create() {
        this.resetGameState();

        // Initialize managers
        this.collisionManager = new CollisionManager(this);
        this.playerManager = new PlayerManager(this);
        this.networkManager = new NetworkManager(this);
        this.uiManager = new UIManager(this);

        this.createParallaxBackgrounds();
        const mapDimensions = this.mapManager.create();
        this.createPlayerAnimations(); // Must create animations before initializing multiplayer

        // Check for teacher mode
        // IMPORTANT: Host is ALWAYS a teacher/observer - they don't play, they supervise
        const playerData = JSON.parse(localStorage.getItem('playerData') || '{}');
        this.isTeacher = playerData.isTeacher || playerData.isHost || false; // Host = Teacher
        console.log(`🎓 Teacher/Observer Mode: ${this.isTeacher} (isHost: ${playerData.isHost}, isTeacher: ${playerData.isTeacher})`);

        this.initializeMultiplayer();

        // Setup cursors for camera movement if teacher
        if (this.isTeacher) {
            this.cursors = this.input.keyboard.createCursorKeys();
        }

        // Store spawn area for respawning
        this.spawnArea = mapDimensions.spawnArea;

        // DEBUG: Check if coins were created
        console.log(`🔍 Map created with ${this.mapManager.getCoins().getLength()} coins`);
        console.log(`📍 Spawn area:`, this.spawnArea);

        // Set up camera
        this.cameras.main.setBounds(0, 0, mapDimensions.width, mapDimensions.height);
        this.cameras.main.setZoom(this.normalZoom);
        this.cameras.main.setLerp(0.5, 0.6);

        // Add debug key for testing
        this.input.keyboard.on('keydown-D', () => {
            console.log('🐛 DEBUG INFO:');
            console.log(`- Coins in scene: ${this.mapManager.getCoins().getLength()}`);
            console.log(`- Player position: (${this.playerManager.getLocalPlayer()?.getSprite()?.x}, ${this.playerManager.getLocalPlayer()?.getSprite()?.y})`);
            console.log(`- Coins collected: ${this.coinsCollected}`);
            console.log(`- Is multiplayer: ${this.isMultiplayer}`);
            console.log(`- Is respawning: ${this.isRespawning}`);
            console.log(`- Respawn timer: ${this.respawnTimer}`);
        });

        window.quizManager = this.quizManager;
        window.gameScene = this;
        console.log("PlatformerScene created, waiting for multiplayer connection...");
    }

    initializeMultiplayer() {
        this.isMultiplayer = true;
    }

    createParallaxBackgrounds() {
        // Clear any existing backgrounds
        this.backgrounds.forEach((bg) => {
            if (bg.sprite) {
                bg.sprite.destroy();
            }
        });
        this.backgrounds = [];

        // Define parallax layers with their properties
        const layers = [
            {
                key: "parallax_background_1",
                speed: 0.1,
                alpha: 1.0,
                depth: -100,
            },
            {
                key: "parallax_background_2",
                speed: 0.3,
                alpha: 0.9,
                depth: -50,
            },
        ];

        // Get screen dimensions
        const screenWidth = this.cameras.main.width;
        const screenHeight = this.cameras.main.height;

        console.log(`🖥️ Creating parallax backgrounds for screen: ${screenWidth}x${screenHeight}`);

        layers.forEach((layer) => {
            // Use REGULAR Sprite instead of TileSprite
            const bg = this.add.sprite(0, 0, layer.key);

            // Set origin to top-left
            bg.setOrigin(0, -0.2);

            // Set scroll factor for parallax effect
            bg.setScrollFactor(layer.speed);

            // Set depth
            bg.setDepth(layer.depth);

            // Set alpha
            bg.setAlpha(layer.alpha);

            // Scale the sprite to fill the entire screen
            bg.setDisplaySize(screenWidth, screenHeight);

            // Position at top-left corner
            bg.setPosition(0, 0);

            this.backgrounds.push({
                sprite: bg,
                speed: layer.speed,
            });

            console.log(`🎨 Created parallax layer: ${layer.key} (scaled to ${screenWidth}x${screenHeight})`);
        });
    }

    createPlayerAnimations() {
        // Create idle animation
        this.anims.create({
            key: "idle",
            frames: [
                { key: "player_idle_1" },
                { key: "player_idle_2" },
                { key: "player_idle_3" },
                { key: "player_idle_4" },
            ],
            frameRate: 5,
            repeat: -1,
        });

        // Create run animation
        this.anims.create({
            key: "run",
            frames: [
                { key: "player_run_1" },
                { key: "player_run_2" },
                { key: "player_run_3" },
                { key: "player_run_4" },
                { key: "player_run_5" },
                { key: "player_run_6" },
                { key: "player_run_7" },
                { key: "player_run_8" },
                { key: "player_run_9" },
                { key: "player_run_10" },
                { key: "player_run_11" },
                { key: "player_run_12" },
                { key: "player_run_13" },
                { key: "player_run_14" },
                { key: "player_run_15" },
                { key: "player_run_16" },
            ],
            frameRate: 10,
            repeat: -1,
        });

        // Create jump animation
        this.anims.create({
            key: "jump",
            frames: [
                { key: "player_jump_1" },
                { key: "player_jump_2" },
                { key: "player_jump_3" },
                { key: "player_jump_4" },
                { key: "player_jump_5" },
                { key: "player_jump_6" },
                { key: "player_jump_7" },
                { key: "player_jump_8" },
            ],
            frameRate: 10,
            repeat: 0,
        });
    }

    update(time, delta) {
        if (this.quizManager.isQuizActive()) {
            return;
        }

        // TEACHER MODE UPDATE LOOP
        if (this.isTeacher) {
            this.updateTeacherCamera();
            this.networkManager.update(time, delta); // Keep network alive for receiving updates
            this.playerManager.interpolateOtherPlayers(delta); // Interpolate students
            this.updateParallaxBackgrounds();
            return;
        }

        // Handle respawn countdown
        if (this.isRespawning) {
            this.updateRespawnTimer(delta);
            return; // Don't update game logic while respawning
        }

        // Emit game state to React component
        this.emitGameStateUpdate();

        // Update network and players
        this.networkManager.update(time, delta);
        this.playerManager.interpolateOtherPlayers(delta);

        // Update UI and backgrounds
        this.uiManager.updateHUD();
        this.uiManager.updateHUDPosition();
        this.updateParallaxBackgrounds();

        // this.debugPlayerNames();

        // NEW: Check for death and start respawn process
        if (this.lives <= 0 && !this.isRespawning) {
            this.handlePlayerDeath();
        }
    }

    handlePlayerDeath() {
        console.log('💀 Player died! Starting respawn process...');

        this.isRespawning = true;
        this.respawnTimer = this.respawnTime;

        // Disable player controls and hide player
        const localPlayer = this.playerManager.getLocalPlayer();
        if (localPlayer && localPlayer.getSprite()) {
            localPlayer.getSprite().setVisible(false);
            localPlayer.getSprite().body.enable = false; // Disable physics
        }

        // Reset coins
        this.coinsCollected = 0;

        // Send death event to server to sync scoreboard
        if (this.isMultiplayer && window.multiplayerManager) {
            window.multiplayerManager.sendPlayerDeath();
        }

        // Create death effect
        this.createDeathEffect();

        // Create respawn UI
        this.createRespawnUI();

        // Stop camera from following player
        this.cameras.main.stopFollow();

        // Emit death state
        this.emitGameStateUpdate();
    }

    createDeathEffect() {
        const localPlayer = this.playerManager.getLocalPlayer();
        if (!localPlayer || !localPlayer.getSprite()) return;

        const playerX = localPlayer.getSprite().x;
        const playerY = localPlayer.getSprite().y;

        // Create explosion/particle effect
        this.deathEffect = this.add.particles(playerX, playerY, 'coin', {
            speed: { min: 50, max: 200 },
            scale: { start: 0.5, end: 0 },
            blendMode: 'ADD',
            lifespan: 1000,
            gravityY: 300,
            quantity: 10,
            emitting: false
        });

        // Emit particles once
        this.deathEffect.explode(10);

        // Screen shake for dramatic effect
        this.cameras.main.shake(500, 0.02);
    }

    createRespawnUI() {
        const centerX = this.cameras.main.worldView.x + this.cameras.main.width / 2;
        const centerY = this.cameras.main.worldView.y + this.cameras.main.height / 2;

        // Create respawn message
        this.respawnText = this.add.text(centerX, centerY - 30, 'You Died!', {
            fontSize: '32px',
            fill: '#ff0000',
            stroke: '#000000',
            strokeThickness: 4,
            fontFamily: 'Arial'
        });
        this.respawnText.setOrigin(0.5);
        this.respawnText.setScrollFactor(0);
        this.respawnText.setDepth(1000);

        // Create countdown text
        this.respawnCountdownText = this.add.text(centerX, centerY + 20, `Respawning in ${this.respawnTimer}...`, {
            fontSize: '24px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            fontFamily: 'Arial'
        });
        this.respawnCountdownText.setOrigin(0.5);
        this.respawnCountdownText.setScrollFactor(0);
        this.respawnCountdownText.setDepth(1000);
    }

    updateRespawnTimer(delta) {
        // Convert delta from milliseconds to seconds
        const deltaSeconds = delta / 1000;
        this.respawnTimer = Math.max(0, this.respawnTimer - deltaSeconds);

        // Update countdown text
        if (this.respawnCountdownText) {
            const secondsLeft = Math.ceil(this.respawnTimer);
            this.respawnCountdownText.setText(`Respawning in ${secondsLeft}...`);

            // Flash effect when getting close to respawn
            if (secondsLeft <= 3) {
                this.respawnCountdownText.setFill('#ffff00'); // Yellow for last 3 seconds
            }
        }

        // Check if respawn time is up
        if (this.respawnTimer <= 0) {
            this.respawnPlayer();
        }
    }

    respawnPlayer() {
        console.log('🔄 Respawning player...');

        // Clean up respawn UI
        if (this.respawnText) {
            this.respawnText.destroy();
            this.respawnText = null;
        }
        if (this.respawnCountdownText) {
            this.respawnCountdownText.destroy();
            this.respawnCountdownText = null;
        }

        // Clean up death effect
        if (this.deathEffect) {
            this.deathEffect.destroy();
            this.deathEffect = null;
        }

        // Reset lives and respawn state
        this.lives = 5;
        this.coinsCollected = 0;
        this.isRespawning = false;

        // Send death event to server if not already sent
        if (this.isMultiplayer && window.multiplayerManager) {
            window.multiplayerManager.sendPlayerDeath();
        }


        // GET SPAWN POSITION FROM MAP - UPDATED THIS PART
        const spawnPosition = this.mapManager.getSpawnPosition();
        console.log(`📍 Respawning at: (${spawnPosition.x}, ${spawnPosition.y})`);

        // Reset player position and state
        const localPlayer = this.playerManager.getLocalPlayer();
        if (localPlayer && localPlayer.getSprite()) {
            localPlayer.getSprite().setPosition(spawnPosition.x, spawnPosition.y);
            localPlayer.getSprite().setVisible(true);
            localPlayer.getSprite().body.enable = true; // Re-enable physics
            localPlayer.getSprite().setVelocity(0, 0); // Reset velocity

            // Reset any stun states
            if (localPlayer.isStunned) {
                localPlayer.isStunned = false;
                localPlayer.clearTint();
                localPlayer.getSprite().setAlpha(1);
            }
        }

        // Make camera follow player again
        this.cameras.main.startFollow(localPlayer.getSprite());

        console.log('✅ Player respawned!');

        // Emit state update
        this.emitGameStateUpdate();
    }

    respawnCoins() {
        const coins = this.mapManager.getCoins();
        coins.clear(true, true); // Clear existing coins

        // Recreate coins from map (you might need to call your coin creation method)
        // this.mapManager.createCoins(this.mapManager.map); // You'll need to adjust this based on your MapManager
    }

    emitGameStateUpdate() {
        const localPlayer = this.playerManager.getLocalPlayer();
        const playerName = localPlayer?.playerData?.name || 'Player';

        const currentState = {
            lives: this.lives,
            coins: this.coinsCollected,
            playerName: playerName // Use the actual player name from player data
        };

        if (JSON.stringify(currentState) !== JSON.stringify(this.lastEmittedState)) {
            window.dispatchEvent(new CustomEvent('gameStateUpdate', {
                detail: currentState
            }));
            this.lastEmittedState = currentState;
        }
    }

    updateParallaxBackgrounds() {
        const camera = this.cameras.main;
        const cameraX = camera.scrollX;

        this.backgrounds.forEach((background) => {
            // Update tile position for parallax effect
            background.sprite.tilePositionX = cameraX * background.speed;
        });
    }

    restartGame() {
        // NEW: Use respawn system instead of immediate restart
        if (this.lives <= 0 && !this.isRespawning) {
            this.handlePlayerDeath();
        }
    }
    // Quiz methods
    async handleSinglePlayerCoin(coin) {
        // Store the coin reference
        this.currentCoin = coin;

        // Temporarily disable the coin but don't destroy it yet
        coin.disableBody(true, true);

        // Zoom out camera for quiz
        await this.zoomCameraForQuiz();

        // Show quiz and wait for result
        const isCorrect = await this.quizManager.showQuiz();

        // Process quiz result
        this.processQuizResult(isCorrect, coin);

        // Zoom camera back to normal
        await this.zoomCameraBackToNormal();
    }

    async handleMultiplayerCoin(coin) {
        // Emit quiz start event
        window.dispatchEvent(new CustomEvent('quizStarted'));

        // Store the coin reference
        this.currentCoin = coin;

        // Temporarily disable the coin but don't destroy it yet
        coin.disableBody(true, true);

        // Zoom out camera for quiz
        await this.zoomCameraForQuiz();

        // Show quiz and wait for result
        const isCorrect = await this.quizManager.showQuiz();

        // Process quiz result
        this.processQuizResult(isCorrect, coin);

        // Zoom camera back to normal
        await this.zoomCameraBackToNormal();

        // Emit quiz end event
        window.dispatchEvent(new CustomEvent('quizEnded'));
    }

    processQuizResult(isCorrect, coin) {
        if (isCorrect) {
            // Correct answer - add coin
            this.score += coin.scoreValue;
        } else {
            // Incorrect answer - remove coin (minimum 0)
            this.coinsCollected = Math.max(0, this.coinsCollected - 1);
        }

        // Now destroy the coin
        if (coin && coin.active) {
            coin.destroy();
        }
    }

    async zoomCameraForQuiz() {
        return new Promise((resolve) => {
            this.cameras.main.zoomTo(this.quizZoom, 500, "Power2");
            this.cameras.main.once("camerazoomcomplete", () => {
                resolve();
            });
        });
    }

    async zoomCameraBackToNormal() {
        return new Promise((resolve) => {
            this.cameras.main.zoomTo(this.normalZoom, 500, "Power2");
            this.cameras.main.once("camerazoomcomplete", () => {
                resolve();
            });
        });
    }

    debugPlayerNames() {
        console.log('🎯 CURRENT PLAYER NAMES DEBUG:');
        console.log(`- Local Player: ${this.playerManager.getLocalPlayer()?.playerData?.name || 'Unknown'}`);

        const otherPlayers = this.playerManager.getOtherPlayers();
        console.log(`- Other Players (${otherPlayers.size}):`);

        otherPlayers.forEach((player, id) => {
            console.log(`  - ${id}: "${player.playerData.name}"`);
        });
    }


    resetGameState() {
        this.score = 0;
        this.lives = 5;
        this.coinsCollected = 0;

        // NEW: Reset respawn system
        this.isRespawning = false;
        this.respawnTimer = 0;

        // Clean up any existing respawn UI
        if (this.respawnText) {
            this.respawnText.destroy();
            this.respawnText = null;
        }
        if (this.respawnCountdownText) {
            this.respawnCountdownText.destroy();
            this.respawnCountdownText = null;
        }
        if (this.deathEffect) {
            this.deathEffect.destroy();
            this.deathEffect = null;
        }

        // Reset managers
        if (this.uiManager) {
            this.uiManager.destroy();
        }

        // Clear backgrounds
        this.backgrounds.forEach(background => {
            if (background.sprite) {
                background.sprite.destroy();
            }
        });
        this.backgrounds = [];

        // Reinitialize UI manager
        this.uiManager = new UIManager(this);
    }

    // Delegate methods to managers
    setLocalPlayer(playerData) {
        // Override position with spawn area position if not specified
        const spawnPosition = this.mapManager.getSpawnPosition();

        const playerDataWithSpawn = {
            ...playerData,
            position: {
                x: spawnPosition.x,
                y: spawnPosition.y
            }
        };

        this.playerManager.setLocalPlayer(playerDataWithSpawn);
    }


    updateOtherPlayer(data) {
        this.playerManager.updateOtherPlayer(data);
    }

    removePlayer(playerId) {
        this.playerManager.removePlayer(playerId);
    }

    handleGameStateSync(data) {
        this.networkManager.handleGameStateSync(data);
    }

    updatePlayerCoins(data) {
        console.log(`💰 Player ${data.playerName} now has ${data.coins} coins`);

        // If this is our local player, update the coins
        if (data.playerId === this.playerManager.getLocalPlayer()?.playerData?.id) {
            this.coinsCollected = data.coins;
        }
    }

    updateTeacherCamera() {
        if (!this.cursors) return;

        const camera = this.cameras.main;

        if (this.cursors.left.isDown) {
            camera.scrollX -= this.teacherCameraSpeed;
        } else if (this.cursors.right.isDown) {
            camera.scrollX += this.teacherCameraSpeed;
        }

        if (this.cursors.up.isDown) {
            camera.scrollY -= this.teacherCameraSpeed;
        } else if (this.cursors.down.isDown) {
            camera.scrollY += this.teacherCameraSpeed;
        }

        // Zoom controls
        if (this.input.keyboard.checkDown(this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q), 100)) { // Zoom out
            camera.setZoom(Math.max(0.5, camera.zoom - 0.1));
        }
        if (this.input.keyboard.checkDown(this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E), 100)) { // Zoom in
            camera.setZoom(Math.min(3.0, camera.zoom + 0.1));
        }

        // Clamp to map bounds
        // (Optional: assuming mapManager stores width/height)
    }
}