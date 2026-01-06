import { MultiplayerPlayer } from "../entities/MultiplayerPlayer";
import { Player } from "../entities/Player";

// client/src/components/Game/PlayerManager.js
export class PlayerManager {
    constructor(scene) {
        this.scene = scene;
        this.localPlayer = null;
        this.otherPlayers = new Map();
        this.otherPlayerUpdateTimes = new Map();
        this.maxPlayers = 50;
    }

    setLocalPlayer(playerData) {
        console.log('🎯 Setting local player:', playerData);

        if (!playerData || !playerData.position) {
            console.error('❌ Invalid player data received:', playerData);

            // USE SPAWN AREA FOR DEFAULT POSITION
            const spawnPosition = this.scene.mapManager.getSpawnPosition();

            playerData = {
                id: 'local-player',
                name: 'Player',
                position: spawnPosition, // Use spawn area position
                velocity: { x: 0, y: 0 },
                animation: 'idle',
                color: 0xff6b6b
            };
        }

        // TEACHER MODE: Don't create a physical player
        if (this.scene.isTeacher) {
            console.log('🎓 Teacher Mode: Skipping physical player creation');

            // Create a dummy local player object to satisfy checks without a sprite
            this.localPlayer = {
                playerData: playerData,
                getSprite: () => null, // No sprite
                destroy: () => { },
                update: () => { }
            };

            // Center camera on spawn
            this.scene.cameras.main.scrollX = playerData.position.x - this.scene.cameras.main.width / 2;
            this.scene.cameras.main.scrollY = playerData.position.y - this.scene.cameras.main.height / 2;

            this.scene.isPlayerReady = true;
            return;
        }

        // Create local player as MultiplayerPlayer first
        this.localPlayer = new MultiplayerPlayer(this.scene, playerData, true);

        if (!this.localPlayer.getSprite()) {
            console.error('❌ Failed to create player sprite');
            return;
        }

        // Set up collisions for local player
        this.scene.collisionManager.setupPlayerCollisions(this.localPlayer);

        // Make camera follow local player
        this.scene.cameras.main.startFollow(this.localPlayer.getSprite());

        // Convert to controlled player for input handling
        this.convertToControlledPlayer();

        // MARK PLAYER AS READY
        this.scene.isPlayerReady = true;

        console.log('✅ Local player setup complete');
    }

    convertToControlledPlayer() {
        if (!this.localPlayer) return;

        const sprite = this.localPlayer.getSprite();
        const playerData = this.localPlayer.playerData;

        // Store the current position
        const currentX = sprite.x;
        const currentY = sprite.y;

        this.localPlayer.destroy();

        // Create controlled player at the same position
        this.localPlayer = new Player(this.scene, currentX, currentY);
        this.localPlayer.playerData = playerData;

        // Set up collisions again
        this.scene.collisionManager.setupPlayerCollisions(this.localPlayer);

        // Make camera follow new player
        this.scene.cameras.main.startFollow(this.localPlayer.getSprite());

        // Ensure physics body is enabled
        if (this.localPlayer.getSprite() && this.localPlayer.getSprite().body) {
            this.localPlayer.getSprite().body.enable = true;
        }
    }


    updateOtherPlayer(data) {
        const { playerId, position, velocity, animation, timestamp, playerName, isTeacher } = data; // Add playerName, isTeacher

        if (playerId === this.localPlayer?.playerData?.id) {
            return; // Don't update local player from network
        }

        // Don't render teachers
        if (isTeacher) {
            return;
        }

        let otherPlayer = this.otherPlayers.get(playerId);

        if (!otherPlayer) {
            // Create new remote player with pooling consideration
            if (this.otherPlayers.size >= this.maxPlayers) {
                console.warn(`Player limit reached (${this.maxPlayers}), cannot create new player`);
                return;
            }

            // Use provided position or default to spawn area
            const spawnPosition = this.scene.mapManager.getSpawnPosition();

            const playerData = {
                id: playerId,
                name: playerName || `Player${this.generateUniqueSuffix(playerId)}`, // Use provided name or generate unique
                position: position || spawnPosition,
                velocity: velocity,
                animation: animation,
                color: this.getPlayerColor(playerId)
            };

            otherPlayer = new MultiplayerPlayer(this.scene, playerData, false);
            this.otherPlayers.set(playerId, otherPlayer);

            console.log(`👥 Created remote player ${playerData.name} (${playerId}) at (${playerData.position.x}, ${playerData.position.y})`);
        } else {
            // Update existing player name if provided and different
            if (playerName && otherPlayer.playerData.name !== playerName) {
                console.log(`🔄 Updating player ${playerId} name from "${otherPlayer.playerData.name}" to "${playerName}"`);
                otherPlayer.playerData.name = playerName;

                // Update the name text display
                if (otherPlayer.nameText) {
                    otherPlayer.nameText.setText(playerName);
                }
            }
        }

        // Store update time for interpolation
        this.otherPlayerUpdateTimes.set(playerId, {
            timestamp: timestamp || Date.now(),
            position: position,
            velocity: velocity
        });

        // Update player with new data
        otherPlayer.update({
            ...otherPlayer.playerData,
            position,
            velocity,
            animation
        }, timestamp || Date.now());
    }

    // Add helper method for unique suffix generation
    generateUniqueSuffix(playerId) {
        // Use last 4 characters for more variety
        return playerId.slice(-4);
    }
    getPlayerColor(playerId) {
        const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xfeca57, 0xff9ff3, 0x54a0ff, 0x5f27cd, 0x00d2d3, 0xff9f43];
        let hash = 0;
        for (let i = 0; i < playerId.length; i++) {
            hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    removePlayer(playerId) {
        const player = this.otherPlayers.get(playerId);
        if (player) {
            player.destroy();
            this.otherPlayers.delete(playerId);
            this.otherPlayerUpdateTimes.delete(playerId);
            console.log(`🗑️ Removed player ${playerId}`);
        }
    }

    interpolateOtherPlayers(delta) {
        const now = Date.now();

        this.otherPlayers.forEach((player, playerId) => {
            if (!player.interpolatePosition) return;

            const updateData = this.otherPlayerUpdateTimes.get(playerId);
            if (!updateData) return;

            // Use delta time for smooth interpolation
            player.interpolatePosition(delta, now);
        });
    }

    getLocalPlayer() {
        return this.localPlayer;
    }

    getOtherPlayers() {
        return this.otherPlayers;
    }
}