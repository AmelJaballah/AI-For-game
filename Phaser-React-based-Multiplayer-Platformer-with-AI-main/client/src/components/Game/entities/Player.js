export class Player {
    constructor(scene, x, y) {
        this.scene = scene;
        this.sprite = null;

        // ORIGINAL MOVEMENT VALUES - no scaling
        this.speed = 160; // Original speed
        this.jumpForce = 330; // Original jump force


        this.cursors = null;
        this.wasdKeys = null;
        this.spaceKey = null;

        // Animation state
        this.isGrounded = false;
        this.isMoving = false;
        this.facingRight = true;

        // Coyote time variables
        this.coyoteTime = 0;
        this.coyoteTimeThreshold = 100;
        this.wasGrounded = false;

        // Jump buffer variables
        this.jumpBuffer = 0;
        this.jumpBufferThreshold = 150;

        this.create(x, y);
    }

    // client/src/components/Game/Player.js - Update create method
    create(x, y) {
        // Create player sprite using the first idle frame
        this.sprite = this.scene.physics.add.sprite(x, y, 'player_idle_1');

        // CRITICAL: Ensure physics body is properly configured
        if (this.sprite.body) {
            this.sprite.setBounce(0.1);
            this.sprite.setCollideWorldBounds(true);

            // ORIGINAL PHYSICS BODY - no scaling
            this.sprite.setSize(16, 16);

            // Enable physics
            this.sprite.body.enable = true;
        }

        // Set up input - both arrow keys and WASD
        this.cursors = this.scene.input.keyboard.createCursorKeys();

        // Set up WASD keys
        this.wasdKeys = this.scene.input.keyboard.addKeys('W,A,S,D');

        // Set up spacebar key
        this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Start with idle animation
        this.sprite.play('idle');

        console.log('✅ Player created with input controls and physics body');
        return this.sprite;
    }

    isReady() {
        return this.sprite && this.sprite.active && this.sprite.body && this.sprite.body.enable;
    }


    destroy() {
        if (this.sprite) {
            this.sprite.destroy();
            this.sprite = null;
        }
        // Clean up input references
        this.cursors = null;
        this.wasdKeys = null;
        this.spaceKey = null;
    }

    update(time, delta) {
        // Only update if sprite exists and is active AND has a physics body
        if (!this.sprite || !this.sprite.active || !this.sprite.body) {
            console.warn('Player sprite or physics body not ready');
            return;
        }

        if (this.scene.isRespawning) {
            return;
        }

        // If player is stunned, skip input processing but continue physics
        if (this.isStunned) {
            // Still update animations based on current state
            this.updateAnimations();
            return;
        }

        // Rest of your existing update code...
        this.wasGrounded = this.isGrounded;
        this.isGrounded = this.sprite.body.touching.down;

        // Update coyote time
        if (this.isGrounded) {
            this.coyoteTime = this.coyoteTimeThreshold;
        } else if (this.wasGrounded && !this.isGrounded) {
            this.coyoteTime = this.coyoteTimeThreshold;
        } else {
            this.coyoteTime = Math.max(0, this.coyoteTime - delta);
        }

        // Update jump buffer
        const jumpPressed = this.cursors.up.isDown || this.wasdKeys.W.isDown || this.spaceKey.isDown;
        if (jumpPressed) {
            this.jumpBuffer = this.jumpBufferThreshold;
        } else {
            this.jumpBuffer = Math.max(0, this.jumpBuffer - delta);
        }

        // Reset horizontal movement (only if not stunned)
        this.sprite.setVelocityX(0);

        // Horizontal movement - check both arrow keys and WASD
        const leftPressed = this.cursors.left.isDown || this.wasdKeys.A.isDown;
        const rightPressed = this.cursors.right.isDown || this.wasdKeys.D.isDown;

        this.isMoving = false;

        if (leftPressed) {
            this.sprite.setVelocityX(-this.speed);
            this.isMoving = true;
            this.facingRight = false;
        } else if (rightPressed) {
            this.sprite.setVelocityX(this.speed);
            this.isMoving = true;
            this.facingRight = true;
        }

        // Update sprite flip based on direction
        this.sprite.setFlipX(!this.facingRight);

        // Handle jumping with coyote time and jump buffering
        this.handleJump();

        // Update animations based on player state
        this.updateAnimations();
    }


    getNetworkAnimation() {
        if (!this.sprite || !this.sprite.active) return 'idle';

        // More precise animation detection for networking
        if (!this.isGrounded) {
            return 'jump';
        } else if (this.isMoving) {
            return 'run';
        } else {
            return 'idle';
        }
    }

    handleJump() {
        // Ensure sprite and body exist
        if (!this.sprite || !this.sprite.body) return;

        const canJump = this.isGrounded || this.coyoteTime > 0;

        if (this.jumpBuffer > 0 && canJump) {
            this.sprite.setVelocityY(-this.jumpForce);
            this.jumpBuffer = 0; // Consume the jump buffer
            this.coyoteTime = 0; // Consume the coyote time
        }
    }

    updateAnimations() {
        if (!this.sprite || !this.sprite.active) return;

        // If player is in the air
        if (!this.isGrounded) {
            if (this.sprite.anims.currentAnim?.key !== 'jump') {
                this.sprite.play('jump', true);
            }
        }
        // If player is moving on ground
        else if (this.isMoving) {
            if (this.sprite.anims.currentAnim?.key !== 'run') {
                this.sprite.play('run', true);
            }
        }
        // Player is idle on ground
        else {
            if (this.sprite.anims.currentAnim?.key !== 'idle') {
                this.sprite.play('idle', true);
            }
        }
    }

    getSprite() {
        return this.sprite;
    }

    setTint(color) {
        if (this.sprite && this.sprite.active) {
            this.sprite.setTint(color);
        }
    }

    clearTint() {
        if (this.sprite && this.sprite.active) {
            this.sprite.clearTint();
        }
    }

    // Enhanced takeDamage method with directional knockback
    takeDamage(damageSource = null) {
        if (!this.sprite || !this.sprite.active) return;

        console.log('💥 Player taking damage with directional knockback!');

        const knockbackForce = 300;
        const horizontalForce = 150;

        let knockbackDirection = this.facingRight ? -1 : 1;

        // If we have info about what caused the damage, use it for direction
        if (damageSource && damageSource.x !== undefined) {
            // Knock player away from the damage source
            knockbackDirection = this.sprite.x < damageSource.x ? -1 : 1;
        }

        this.sprite.setVelocityX(knockbackDirection * horizontalForce);
        this.sprite.setVelocityY(-knockbackForce);

        // Visual and state effects
        this.setTint(0xff0000);
        this.sprite.setAlpha(0.8);
        this.isStunned = true;

        this.scene.time.delayedCall(500, () => {
            this.isStunned = false;
            this.clearTint();
            this.sprite.setAlpha(1);
        });

        this.scene.cameras.main.shake(200, 0.02);
    }

}