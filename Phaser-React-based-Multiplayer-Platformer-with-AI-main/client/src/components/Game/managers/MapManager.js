export class MapManager {
    constructor(scene) {
        this.scene = scene;
        this.groundLayer = null;
        this.collisionObjects = null;
        this.coins = null;
        this.spikes = null;
        this.spawnArea = null; // ADD THIS
    }

    preload() {
        // Use correct paths for your new structure
        const mapsPath = '/assets/maps/';
        const spritesPath = '/assets/sprites/';

        this.scene.load.tilemapTiledJSON('map', `${mapsPath}map_3.json`);
        this.scene.load.image('tiles', `${spritesPath}world_tileset.png`);
    }

    create() {
        // Create tilemap
        const map = this.scene.make.tilemap({ key: 'map' });

        // Use the correct tileset name
        const tileset = map.addTilesetImage('tileset', 'tiles');

        // NO SCALING - remove setScale
        this.groundLayer = map.createLayer('Ground', tileset, 0, 0);

        // Set up physics - ORIGINAL map size
        const width = 120 * 16; // Original width
        const height = 80 * 16; // Original height
        this.scene.physics.world.setBounds(0, 0, width, height);

        // Create collision objects, coins, spikes - NO SCALING
        this.createCollisionObjects(map);
        this.createCoins(map);
        this.createSpikes(map);

        // EXTRACT SPAWN AREA - ADD THIS
        this.extractSpawnArea(map);

        return {
            width: width,
            height: height,
            spawnArea: this.spawnArea // Return spawn area info
        };
    }


    createCollisionObjects(map) {
        this.collisionObjects = this.scene.physics.add.staticGroup();
        const solidLayer = map.getObjectLayer('solid');
        if (solidLayer && solidLayer.objects) {
            solidLayer.objects.forEach(obj => {
                if (obj.properties) {
                    const collidable = obj.properties.find(prop => prop.name === 'collidable' && prop.value);
                    if (collidable) {
                        const collider = this.collisionObjects.create(
                            obj.x + obj.width / 2, // NO SCALING
                            obj.y + obj.height / 2, // NO SCALING
                            null
                        );
                        collider.setSize(
                            obj.width, // NO SCALING
                            obj.height // NO SCALING
                        );
                        collider.setVisible(false);
                    }
                }
            });
        }
    }

     extractSpawnArea(map) {
        const entityLayer = map.getObjectLayer('entity');
        
        if (entityLayer && entityLayer.objects) {
            entityLayer.objects.forEach(obj => {
                if (obj.type === 'spawnArea' || obj.class === 'spawnArea') {
                    console.log('🎯 Found spawn area:', obj);
                    
                    this.spawnArea = {
                        x: obj.x,
                        y: obj.y,
                        width: obj.width || 0,
                        height: obj.height || 0,
                        isPoint: obj.point || false
                    };
                    
                    // If it's a point object, we'll use it as the exact spawn point
                    if (this.spawnArea.isPoint) {
                        console.log(`📍 Spawn point at (${this.spawnArea.x}, ${this.spawnArea.y})`);
                    } else {
                        console.log(`📍 Spawn area at (${this.spawnArea.x}, ${this.spawnArea.y}) size: ${this.spawnArea.width}x${this.spawnArea.height}`);
                    }
                }
            });
        }
         // Fallback to default spawn if no spawn area found
        if (!this.spawnArea) {
            console.warn('⚠️ No spawn area found in map, using default position');
            this.spawnArea = {
                x: 100,
                y: 200,
                isPoint: true
            };
        }
    }

    getSpawnPosition() {
        if (!this.spawnArea) {
            return { x: 100, y: 200 }; // Default fallback
        }

        if (this.spawnArea.isPoint) {
            // For point spawn, return exact position
            return {
                x: this.spawnArea.x,
                y: this.spawnArea.y
            };
        } else {
            // For area spawn, return random position within the area
            return {
                x: this.spawnArea.x + Math.random() * (this.spawnArea.width || 50),
                y: this.spawnArea.y + Math.random() * (this.spawnArea.height || 50)
            };
        }
    }

    createCoins(map) {
        this.coins = this.scene.physics.add.staticGroup();
        const entityLayer = map.getObjectLayer('entity');

        if (entityLayer && entityLayer.objects) {
            console.log(`🗺️ Found ${entityLayer.objects.length} entities in map`);
            let coinCount = 0;

            entityLayer.objects.forEach(obj => {
                if (obj.type === 'coin') {
                    const coin = this.coins.create(
                        obj.x + obj.width / 2,
                        obj.y + obj.height / 2,
                        'coin'
                    );

                    // CRITICAL: Set up physics body for coin
                    coin.setSize(16, 16);
                    coin.body.updateFromGameObject(); // Ensure physics body matches sprite

                    coin.scoreValue = 10;
                    coinCount++;

                    console.log(`🪙 Created coin ${coinCount} at (${obj.x}, ${obj.y})`);
                }
            });

            console.log(`✅ Created ${coinCount} coins total`);
        } else {
            console.warn('❌ No entity layer or objects found in map');
        }
    }

    createSpikes(map) {
        this.spikes = this.scene.physics.add.staticGroup();
        const entityLayer = map.getObjectLayer('entity');
        if (entityLayer && entityLayer.objects) {
            entityLayer.objects.forEach(obj => {
                if (obj.type === 'spikes') {
                    const spike = this.spikes.create(
                        obj.x + obj.width / 2, // NO SCALING
                        obj.y + obj.height / 2, // NO SCALING
                        'spike'
                    );
                    // spike.setScale(this.SCALE_FACTOR); // REMOVE THIS
                    spike.setSize(16, 8); // Original size
                    spike.body.setOffset(0, 8); // Original offset
                    spike.damage = 1;
                }
            });
        }
    }
    getCollisionObjects() {
        return this.collisionObjects;
    }

    getCoins() {
        return this.coins;
    }

    getSpikes() {
        return this.spikes;
    }
}