// client/src/components/Game/UIManager.js
export class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.hudContainer = null;
        this.livesText = null;
        this.coinsText = null;
        this.playerNameText = null;
    }

    createHUD() {
        console.log("Creating HUD as separate layer...");

        // Clear any existing HUD first
        if (this.hudContainer) {
            this.hudContainer.destroy();
            this.hudContainer = null;
        }

        try {
            // Create HUD container that's completely separate from the game camera
            this.hudContainer = this.scene.add.container(0, 0);

            // HUD background for better visibility - positioned in screen space
            const hudBackground = this.scene.add.rectangle(10, 10, 200, 60, 0x000000, 0.7);
            hudBackground.setOrigin(0, 0);
            hudBackground.setStrokeStyle(2, 0xffffff);

            // HUD style
            const style = {
                fontSize: "16px",
                fill: "#FFFFFF",
                fontFamily: "Arial, sans-serif",
                stroke: "#000000",
                strokeThickness: 3
            };

            // Create HUD text elements - positioned in screen coordinates
            this.livesText = this.scene.add.text(20, 15, "LIVES: 3", style);
            this.coinsText = this.scene.add.text(20, 40, "COINS: 0", style);

            // Player name display
            const playerName = this.scene.playerManager.getLocalPlayer()?.playerData?.name || 'Unknown';
            this.playerNameText = this.scene.add.text(220, 15, `Player: ${playerName}`, {
                ...style,
                fontSize: "14px"
            });

            // Add all elements to container
            this.hudContainer.add([hudBackground, this.livesText, this.coinsText, this.playerNameText]);

            // CRITICAL: Set extremely high depth to ensure HUD is on top of everything
            this.hudContainer.setDepth(10000);

            // CRITICAL: Make HUD completely ignore camera transformations
            this.hudContainer.setScrollFactor(0);

            // CRITICAL: Ensure HUD is not affected by camera zoom
            this.hudContainer.setScale(1);

            // CRITICAL: Make all HUD children also ignore camera
            this.hudContainer.getAll().forEach(child => {
                child.setScrollFactor(0);
                child.setScale(1);
            });

            console.log("HUD created as separate layer successfully");
        } catch (error) {
            console.error("Error creating HUD:", error);
        }
    }

    updateHUD() {
        if (this.livesText) {
            this.livesText.setText('LIVES: ' + this.scene.lives);
            this.coinsText.setText('COINS: ' + this.scene.coinsCollected);
        }
    }

    updateHUDPosition() {
        if (!this.hudContainer) return;

        // Keep HUD at fixed screen position regardless of camera
        this.hudContainer.setPosition(0, 0);

        // Ensure all HUD elements maintain their scale
        this.hudContainer.setScale(1);
        this.hudContainer.getAll().forEach(child => {
            child.setScale(1);
        });
    }

    destroy() {
        if (this.hudContainer) {
            this.hudContainer.destroy();
            this.hudContainer = null;
        }
        this.livesText = null;
        this.coinsText = null;
        this.playerNameText = null;
    }
}