// client/src/components/Game/MultiplayerPlayer.js
export class MultiplayerPlayer {
    constructor(scene, playerData, isLocalPlayer = false) {
        this.scene = scene;
        this.playerData = playerData;
        this.isLocalPlayer = isLocalPlayer;
        this.sprite = null;
        this.nameText = null;

        // Enhanced interpolation variables
        this.targetPosition = { x: playerData.position.x, y: playerData.position.y };
        this.lastPosition = { x: playerData.position.x, y: playerData.position.y };
        this.lastUpdateTime = Date.now();
        this.interpolationDelay = 100; // ms of delay for interpolation
        this.interpolationSpeed = 0.3; // Lerp factor

        // Movement prediction
        this.velocity = { x: 0, y: 0 };
        this.lastTimestamp = Date.now();

        this.create();
    }

    // client/src/components/Game/MultiplayerPlayer.js - Update create method
    create() {
        console.log(`🎮 Creating player: ${this.playerData.name} at (${this.playerData.position.x}, ${this.playerData.position.y})`);

        if (!this.scene || !this.scene.physics) {
            console.error('❌ Scene or physics not available');
            return null;
        }

        try {
            const textureKey = this.scene.textures.exists('player_idle_1') ? 'player_idle_1' : 'player';

            this.sprite = this.scene.physics.add.sprite(
                this.playerData.position.x || 100,
                this.playerData.position.y || 200,
                textureKey
            );

            if (!this.sprite) {
                console.error('❌ Failed to create player sprite');
                return null;
            }

            // CRITICAL: Configure physics body
            if (this.sprite.body) {
                if (!this.isLocalPlayer) {
                    this.sprite.body.moves = false;
                } else {
                    this.sprite.setBounce(0.1);
                    this.sprite.setCollideWorldBounds(true);
                    this.sprite.body.enable = true;
                }
            }

            // Set player color for identification
            if (this.playerData.color) {
                this.sprite.setTint(this.playerData.color);
            }

            // Only create name labels for other players
            if (!this.isLocalPlayer) {
                this.nameText = this.scene.add.text(
                    this.sprite.x,
                    this.sprite.y - 20,
                    this.playerData.name,
                    {
                        fontSize: '8px',
                        fill: '#FFFFFF',
                        stroke: '#000000',
                        strokeThickness: 2
                    }
                );
                this.nameText.setOrigin(0.5);
                this.nameText.setDepth(1000);
            }

            // Start with idle animation if available
            if (this.scene.anims.exists('idle')) {
                this.sprite.play('idle');
            }

            console.log(`✅ Player ${this.playerData.name} created successfully with physics:`, {
                hasBody: !!this.sprite.body,
                bodyEnabled: this.sprite.body?.enable,
                isLocal: this.isLocalPlayer
            });
            return this.sprite;
        } catch (error) {
            console.error('❌ Error creating multiplayer player:', error);
            return null;
        }
    }


    update(playerData, timestamp = Date.now()) {
        if (!this.sprite || !this.sprite.active) return;

        this.playerData = playerData;

        if (!this.isLocalPlayer) {
            console.log(`🔄 Updating remote player ${this.playerData.name}:`, {
                from: { x: this.sprite.x, y: this.sprite.y },
                to: { x: playerData.position.x, y: playerData.position.y },
                animation: playerData.animation
            });

            // Store previous position for interpolation reference
            this.lastPosition.x = this.sprite.x;
            this.lastPosition.y = this.sprite.y;

            // Update target position immediately
            this.targetPosition = {
                x: playerData.position.x,
                y: playerData.position.y
            };

            // For large position differences, snap immediately to prevent lag
            const positionDiff = Math.abs(playerData.position.x - this.sprite.x) +
                Math.abs(playerData.position.y - this.sprite.y);

            if (positionDiff > 50) { // If more than 50 pixels difference, snap
                console.log(`⚡ Large position difference (${positionDiff}), snapping to target`);
                this.sprite.x = playerData.position.x;
                this.sprite.y = playerData.position.y;
            }

            // Calculate velocity for prediction
            const dt = Math.max(1, timestamp - this.lastTimestamp);
            this.velocity = {
                x: (playerData.position.x - this.sprite.x) / dt,
                y: (playerData.position.y - this.sprite.y) / dt
            };

            this.lastUpdateTime = timestamp;
            this.lastTimestamp = timestamp;

            // Immediate animation updates
            this.updateAnimation(playerData);

            // Update name position
            if (this.nameText) {
                this.nameText.x = this.sprite.x;
                this.nameText.y = this.sprite.y - 25;
            }
        }
    }


    updateAnimation(playerData) {
        if (!this.sprite || !this.sprite.anims) return;

        const currentAnim = this.sprite.anims.currentAnim?.key;
        const newAnim = playerData.animation || 'idle';

        // Only change animation if different and valid
        if (newAnim && currentAnim !== newAnim && this.scene.anims.exists(newAnim)) {
            this.sprite.play(newAnim, true);
        }

        // Handle sprite flipping based on velocity
        if (playerData.velocity) {
            if (playerData.velocity.x > 0) {
                this.sprite.setFlipX(false);
            } else if (playerData.velocity.x < 0) {
                this.sprite.setFlipX(true);
            }
        }
    }

    // Add interpolation update method
    interpolatePosition(delta, currentTime) {
        if (this.isLocalPlayer || !this.sprite || !this.sprite.active) return;

        const timeSinceUpdate = currentTime - this.lastUpdateTime;

        if (timeSinceUpdate < this.interpolationDelay * 2) {
            // Normal interpolation - smooth movement toward target
            const t = Math.min(1, (delta / 1000) * 60 * this.interpolationSpeed);

            this.sprite.x = Phaser.Math.Linear(this.sprite.x, this.targetPosition.x, t);
            this.sprite.y = Phaser.Math.Linear(this.sprite.y, this.targetPosition.y, t);

            // Add slight prediction based on velocity
            if (timeSinceUpdate > this.interpolationDelay) {
                const predictionFactor = (timeSinceUpdate - this.interpolationDelay) / 1000;
                this.sprite.x += this.velocity.x * predictionFactor;
                this.sprite.y += this.velocity.y * predictionFactor;
            }
        } else {
            // Data is stale, snap to position to prevent players getting stuck
            this.sprite.x = this.targetPosition.x;
            this.sprite.y = this.targetPosition.y;
        }
    }


    destroy() {
        if (this.sprite) {
            this.sprite.destroy();
        }
        if (this.nameText) {
            this.nameText.destroy();
        }
    }

    getSprite() {
        return this.sprite;
    }
}