const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for your Vite dev server (usually localhost:5173 or 3000)
const io = socketIo(server, {
    cors: {
        origin: [ "http://localhost:3000",
                    "http://localhost:5173"
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(cors());
app.use(express.json());

// Store active rooms
const rooms = new Map();

// Room-specific scoreboard update function
// In server.js - Fix the updateRoomScoreboard function
function updateRoomScoreboard(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;

    // DEBUG: Log the current room state
    console.log(`🔍 DEBUG Room ${roomId} state:`);
    console.log(`- Players in room:`, room.players.map(p => ({ id: p.id, name: p.name, coins: p.coins, isHost: p.isHost })));
    console.log(`- Scoreboard entries:`, Array.from(room.scoreboard.entries()).map(([id, data]) => ({ id, name: data.name, coins: data.coins })));

    // Get host player IDs to exclude from scoreboard
    const hostIds = new Set(room.players.filter(p => p.isHost).map(p => p.id));

    // Get all players from scoreboard, EXCLUDE HOSTS, sort by coins (descending)
    const playersArray = Array.from(room.scoreboard.values())
        .filter(player => player && player.name && !hostIds.has(player.id)) // Filter out invalid entries AND hosts
        .sort((a, b) => b.coins - a.coins)
        .slice(0, 50); // Increased limit to show all students

    console.log(`📊 Room ${roomId} scoreboard updated:`, playersArray.map(p => ({
        id: p.id,
        name: p.name,
        coins: p.coins
    })));

    // Broadcast to all players in THIS ROOM ONLY
    io.to(roomId).emit('scoreboard-update', playersArray);
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (data) => {
        // Properly handle the join-room event by calling the same logic
        const { roomId, playerName, isHost } = data;

        if (!rooms.has(roomId)) {
            if (!isHost) {
                socket.emit('join-error', 'Room does not exist');
                return;
            }
            rooms.set(roomId, {
                players: [],
                gameStarted: false,
                coins: [],
                createdAt: new Date(),
                questions: [], // Store room questions
                scoreboard: new Map() // Room-specific scoreboard
            });
        }

        const room = rooms.get(roomId);
        // Call join-game with the same data
        socket.emit('join-game', data);
    });

    socket.on('join-game', (data) => {
        const { roomId, playerName, isHost, isTeacher } = data;

        console.log(`🎮 JOIN-GAME REQUEST:`, {
            socketId: socket.id,
            playerName,
            isHost,
            roomId
        });

        // Create room if it doesn't exist (allow host to create)
        if (!rooms.has(roomId)) {
            if (!isHost) {
                socket.emit('join-error', 'Room does not exist');
                console.log(`❌ Room ${roomId} doesn't exist and player is not host`);
                return;
            }
            rooms.set(roomId, {
                players: [],
                gameStarted: false,
                coins: [],
                questions: [], // Store room questions
                createdAt: new Date(),
                scoreboard: new Map()
            });
            console.log(` Room ${roomId} created by host`);

            // Clear any previous questions when creating new room
            console.log(` Server: New room ${roomId} created - previous questions should be cleared`);
        }

        const room = rooms.get(roomId);
        console.log(` Room ${roomId} currently has ${room.players.length} players`);

        room.players.forEach((p, index) => {
            console.log(`  Player ${index}: ${p.name} (${p.id}) - Host: ${p.isHost}`);
        });

        // Check if this socket is already in the room (reconnection case)
        const existingPlayerIndex = room.players.findIndex(p => p.id === socket.id);

        if (existingPlayerIndex !== -1) {
            const oldPlayer = room.players[existingPlayerIndex];

            console.log(`🔄 Player ${oldPlayer.name} reconnecting to room ${roomId} (was ${playerName})`);

            // CRITICAL: Preserve the original name, don't allow name changes on reconnect
            // Only update non-name properties
            room.players[existingPlayerIndex] = {
                ...oldPlayer,
                // DON'T update the name: keep the original name
                isHost: isHost, // You might want to preserve this too
                position: { x: 100, y: 200 },
                velocity: { x: 0, y: 0 },
                animation: 'idle'
            };

            // Scoreboard should also keep the original name
            // Don't update the scoreboard name on reconnect

            // Send player assignment with ORIGINAL name
            socket.emit('player-assigned', {
                playerId: socket.id,
                isHost: oldPlayer.isHost, // Use original host status too
                playerName: oldPlayer.name // Include the original name
            });

            // Send current game state to the reconnecting player
            socket.emit('game-state', {
                players: room.players.map(p => ({
                    id: p.id,
                    name: p.name, // This will have the original names
                    isHost: p.isHost,
                    isTeacher: p.isTeacher,
                    position: p.position,
                    velocity: p.velocity,
                    animation: p.animation,
                    color: p.color,
                    coins: p.coins
                })),
                coins: room.coins,
                questions: room.questions || [] // Send current questions
            });

            // Send current scoreboard for this room only
            updateRoomScoreboard(roomId);

            // Notify other players about reconnection
            socket.to(roomId).emit('player-reconnected', room.players[existingPlayerIndex]);

            // Send updated player list to ALL players in the room
            io.to(roomId).emit('players-updated', room.players);

            console.log(`✅ Player ${playerName} reconnected to room ${roomId}`);
            return;
        }

        // FIXED: Handle name conflicts by adding suffix instead of rejecting
        let finalPlayerName = playerName;
        let nameCounter = 1;

        const nameExists = room.players.some(p => p.name === finalPlayerName && p.id !== socket.id);
        if (nameExists) {
            // Find a unique name by adding numbers
            while (room.players.some(p => p.name === finalPlayerName)) {
                finalPlayerName = `${playerName} ${nameCounter}`;
                nameCounter++;
                console.log(`🔄 Name conflict, trying: ${finalPlayerName}`);
            }
            console.log(`🔄 Resolved name conflict: "${playerName}" -> "${finalPlayerName}"`);
        }

        if (finalPlayerName !== playerName) {
            console.log(`🔄 Resolved name conflict: "${playerName}" -> "${finalPlayerName}"`);
        }

        // Check if host already exists
        if (isHost && room.players.some(p => p.isHost)) {
            const existingHost = room.players.find(p => p.isHost);
            console.log(`❌ HOST CONFLICT: Room ${roomId} already has host: ${existingHost.name} (${existingHost.id})`);
            socket.emit('join-error', 'Room already has a host');
            return;
        }

        const player = {
            id: socket.id,
            name: finalPlayerName, // Use the final resolved name
            isHost: isHost,
            isTeacher: isTeacher || false,
            ready: false,
            coins: 0,
            position: { x: 100, y: 200 },
            velocity: { x: 0, y: 0 },
            animation: 'idle',
            color: getRandomPlayerColor(),
            joinedAt: new Date()
        };

        // DEBUG: Log the player being created
        console.log(`👤 CREATING PLAYER:`, {
            id: player.id,
            name: player.name,
            isHost: player.isHost,
            color: player.color.toString(16)
        });

        room.players.push(player);
        socket.join(roomId);

        console.log(`✅ Player ${player.name} added to room ${roomId}`);

        // Initialize player in ROOM scoreboard (not global)
        // IMPORTANT: Hosts and teachers are NOT added to scoreboard - they are observers only
        if (!isTeacher && !isHost) {
            room.scoreboard.set(socket.id, {
                id: socket.id,
                name: finalPlayerName, // Use the actual final player name
                coins: 0,
                lastActive: new Date()
            });
            console.log(`📊 Player ${finalPlayerName} added to scoreboard`);
        } else {
            console.log(`👑 Host/Teacher ${finalPlayerName} NOT added to scoreboard (observer only)`);
        }

        // Send player assignment
        socket.emit('player-assigned', {
            playerId: socket.id,
            isHost: isHost
        });

        // Send current game state to the new player
        socket.emit('game-state', {
            players: room.players,
            coins: room.coins,
            questions: room.questions || [] // Send current questions
        });

        // Send current scoreboard for this room only
        updateRoomScoreboard(roomId);

        // Notify other players in the room
        socket.to(roomId).emit('player-joined', {
            id: player.id,
            name: player.name, // Use the actual player name
            position: player.position,
            velocity: player.velocity,
            animation: player.animation,
            position: player.position,
            velocity: player.velocity,
            animation: player.animation,
            color: player.color,
            isTeacher: player.isTeacher
        });

        // Send updated player list to ALL players in the room (including the new one)
        io.to(roomId).emit('players-updated', room.players);

        console.log(`🎉 Player ${player.name} joined game in room ${roomId}`);
        console.log(`👥 Room ${roomId} now has ${room.players.length} players`);
        console.log(`📋 Current players in room:`, room.players.map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.isHost
        })));
    });
    // Player movement
    socket.on('player-move', (data) => {
        const room = rooms.get(data.roomId);
        if (room) {
            const player = room.players.find(p => p.id === data.playerId);
            if (player) {
                // console.log(`🎯 Processing move from ${player.name} (${data.playerId}):`, {
                //     position: data.position,
                //     animation: data.animation,
                //     roomPlayers: room.players.length
                // });

                // Update player state with client position
                player.position = data.position;
                player.velocity = data.velocity;
                player.animation = data.animation;
                player.lastUpdate = Date.now();

                // Broadcast to ALL other players immediately WITH PLAYER NAME
                socket.to(data.roomId).emit('player-moved', {
                    playerId: data.playerId,
                    playerName: player.name, // CRITICAL: Include the actual player name
                    position: data.position,
                    velocity: data.velocity,
                    animation: data.animation,
                    timestamp: Date.now()
                });

                // console.log(`✅ Broadcast complete for ${player.name}`);
            } else {
                console.log(`❌ Player ${data.playerId} not found in room ${data.roomId}`);
            }
        } else {
            console.log(`❌ Room ${data.roomId} not found`);
        }
    });

    socket.on('request-sync', (data) => {
        const room = rooms.get(data.roomId);
        if (room) {
            const player = room.players.find(p => p.id === data.playerId);
            if (player) {
                // Send current game state for synchronization
                socket.emit('game-state', {
                    players: room.players,
                    coins: room.coins,
                    questions: room.questions || [],
                    sync: true // Flag this as a sync response
                });
            }
        }
    });

    // Handle questions broadcast from host/teacher
    socket.on('broadcast-questions', ({ roomId, questions }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.questions = questions;
            // Broadcast to all players in the room
            io.to(roomId).emit('questions-updated', questions);
            console.log(`📝 Questions updated for room ${roomId}: ${questions.length} questions`);
        }
    });

    // Teacher supervision events
    socket.on('teacher-update-settings', (data) => {
        const { roomId, settings } = data;
        // Verify sender is host/teacher
        const room = rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player && player.isHost) {
                io.to(roomId).emit('game-settings-updated', settings);
            }
        }
    });

    // Coin collection
    socket.on('collect-coin', (data) => {
        const room = rooms.get(data.roomId);
        if (room && room.coins) {
            // Remove the coin from the room's available coins
            room.coins = room.coins.filter(coin => coin.id !== data.coinId);

            // Update player coins
            const player = room.players.find(p => p.id === data.playerId);
            if (player) {
                player.coins += 1;

                // UPDATE ROOM SCOREBOARD - FIXED: Ensure name is properly set
                let scoreboardPlayer = room.scoreboard.get(data.playerId);
                if (scoreboardPlayer) {
                    // Update existing player - SYNC NAME FROM PLAYER OBJECT
                    scoreboardPlayer.name = player.name; // CRITICAL: Sync the name
                    scoreboardPlayer.coins = player.coins;
                    scoreboardPlayer.lastActive = new Date();
                    console.log(`💰 Scoreboard: ${scoreboardPlayer.name} now has ${scoreboardPlayer.coins} coins`);
                } else {
                    // Create scoreboard entry if it doesn't exist
                    scoreboardPlayer = {
                        id: data.playerId,
                        name: player.name, // Use player's actual name
                        coins: player.coins,
                        lastActive: new Date()
                    };
                    room.scoreboard.set(data.playerId, scoreboardPlayer);
                    console.log(`➕ Created new scoreboard entry for ${player.name}`);
                }

                // Broadcast updated scoreboard to THIS ROOM ONLY
                updateRoomScoreboard(data.roomId);

                // Broadcast coin collection to all players in the room
                io.to(data.roomId).emit('coin-collected', {
                    playerId: data.playerId,
                    playerName: player.name,
                    coinId: data.coinId,
                    newCoinCount: player.coins
                });

                // Also send individual coin updates
                io.to(data.roomId).emit('player-coins-updated', {
                    playerId: data.playerId,
                    playerName: player.name,
                    coins: player.coins
                });

                console.log(`💰 ${player.name} collected coin, now has ${player.coins} coins`);
            }
        }
    });

    // Start game
    // In server.js - Fix the start-game handler
    socket.on('start-game', (roomId) => {
        const room = rooms.get(roomId);
        if (room) {
            room.gameStarted = true;
            room.coins = generateCoinsFromMap();

            // RESET ALL PLAYER COINS AND SCOREBOARD FOR NEW GAME
            room.players.forEach(player => {
                player.coins = 0;
            });

            // Reset the room scoreboard WITH PROPER NAMES
            // IMPORTANT: Exclude hosts from scoreboard - they are observers only
            room.scoreboard.clear();
            room.players.forEach(player => {
                // Only add non-host players to scoreboard
                if (!player.isHost && !player.isTeacher) {
                    room.scoreboard.set(player.id, {
                        id: player.id,
                        name: player.name, // Use actual player name
                        coins: 0,
                        lastActive: new Date()
                    });
                    console.log(`📊 Added ${player.name} to scoreboard`);
                } else {
                    console.log(`👑 Skipped host/teacher ${player.name} from scoreboard`);
                }
            });

            console.log(`🎮 Game started in room ${roomId} with ${room.players.length} players - scores reset`);
            console.log(`👥 Players:`, room.players.map(p => p.name));

            // Update scoreboard with reset scores
            updateRoomScoreboard(roomId);

            // Tell ALL players to navigate to the game
            io.to(roomId).emit('navigate-to-game', {
                roomId: roomId
            });

            console.log(`📢 Sent navigate-to-game to ${room.players.length} players`);
        }
    });
    // Add periodic game state sync for large rooms
    setInterval(() => {
        rooms.forEach((room, roomId) => {
            if (room.players.length > 10) { // Only sync large rooms periodically
                io.to(roomId).emit('game-state-sync', {
                    players: room.players.map(p => ({
                        id: p.id,
                        position: p.position,
                        velocity: p.velocity,
                        animation: p.animation
                    }))
                });
            }
        });
    }, 2000); // Sync every 2 seconds for large rooms

    // Quiz results
    // In server.js - Fix the quiz-result handler
    socket.on('quiz-result', (data) => {
        const room = rooms.get(data.roomId);
        if (room) {
            const player = room.players.find(p => p.id === data.playerId);
            if (player) {
                const coinChange = data.isCorrect ? 1 : -1;
                player.coins += coinChange;
                player.coins = Math.max(0, player.coins);

                // UPDATE ROOM SCOREBOARD - FIXED: Ensure name is properly set
                let scoreboardPlayer = room.scoreboard.get(data.playerId);
                if (scoreboardPlayer) {
                    // Update existing player - SYNC NAME FROM PLAYER OBJECT
                    scoreboardPlayer.name = player.name; // CRITICAL: Sync the name
                    scoreboardPlayer.coins = player.coins;
                    scoreboardPlayer.lastActive = new Date();
                    console.log(`❓ Quiz: ${scoreboardPlayer.name} ${data.isCorrect ? 'gained' : 'lost'} coin, now has ${scoreboardPlayer.coins} coins`);
                } else {
                    // Create scoreboard entry if it doesn't exist
                    scoreboardPlayer = {
                        id: data.playerId,
                        name: player.name, // Use player's actual name
                        coins: player.coins,
                        lastActive: new Date()
                    };
                    room.scoreboard.set(data.playerId, scoreboardPlayer);
                }

                // Broadcast updated scoreboard to THIS ROOM ONLY
                updateRoomScoreboard(data.roomId);

                // Send coin update to all clients (especially host)
                io.to(data.roomId).emit('player-coins-updated', {
                    playerId: data.playerId,
                    playerName: player.name,
                    coins: player.coins,
                    isCorrect: data.isCorrect
                });

                console.log(`Player ${player.name} now has ${player.coins} coins`);
            }
        }
    });

    // In server.js - Fix the request-scoreboard handler
    socket.on('request-scoreboard', () => {
        console.log(`📊 Scoreboard requested by ${socket.id}`);

        // Find which room the player is in
        let playerRoomId = null;
        for (const [roomId, room] of rooms.entries()) {
            if (room.players.some(p => p.id === socket.id)) {
                playerRoomId = roomId;
                break;
            }
        }

        if (playerRoomId) {
            const room = rooms.get(playerRoomId);

            // DEBUG: Log the current state
            console.log(`🔍 DEBUG for request-scoreboard in room ${playerRoomId}:`);
            console.log(`- Players:`, room.players.map(p => ({ id: p.id, name: p.name, coins: p.coins, isHost: p.isHost })));
            console.log(`- Scoreboard:`, Array.from(room.scoreboard.entries()).map(([id, data]) => ({ id, name: data.name, coins: data.coins })));

            // Get host player IDs to exclude from scoreboard
            const hostIds = new Set(room.players.filter(p => p.isHost).map(p => p.id));

            const playersArray = Array.from(room.scoreboard.values())
                .filter(player => player && player.name && !hostIds.has(player.id)) // Filter out invalid entries AND hosts
                .sort((a, b) => b.coins - a.coins)
                .slice(0, 50);

            socket.emit('scoreboard-update', playersArray);
        } else {
            socket.emit('scoreboard-update', []);
        }
    });

    // Player ready status
    socket.on('player-ready', (roomId, isReady) => {
        const room = rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.ready = isReady;
                io.to(roomId).emit('players-updated', room.players);
            }
        }
    });


    socket.on('player-died', (data) => {
        const room = rooms.get(data.roomId);
        if (room) {
            const player = room.players.find(p => p.id === data.playerId);
            if (player) {
                console.log(`💀 Player ${player.name} died, resetting coins to 0`);

                // Reset player coins
                player.coins = 0;

                // Update scoreboard to reflect the reset
                const scoreboardPlayer = room.scoreboard.get(data.playerId);
                if (scoreboardPlayer) {
                    scoreboardPlayer.coins = 0; // Reset scoreboard coins to match player
                    console.log(`📊 Scoreboard: ${scoreboardPlayer.name} coins reset to 0 after death`);
                }

                // Update scoreboard for everyone
                updateRoomScoreboard(data.roomId);

                // Notify about coin reset
                io.to(data.roomId).emit('player-coins-updated', {
                    playerId: data.playerId,
                    playerName: player.name,
                    coins: 0,
                    reason: 'death'
                });
            }
        }
    });

    // Leave room
    socket.on('leave-game', (roomId) => {
        leaveRoom(socket, roomId);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Clean up all rooms this user was in
        for (const [roomId, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                // Remove from players but keep in scoreboard (they can rejoin)
                const player = room.players[playerIndex];
                room.players.splice(playerIndex, 1);

                console.log(`📊 Player ${player.name} disconnected from room ${roomId} but kept in scoreboard`);

                // Update scoreboard to reflect player left
                updateRoomScoreboard(roomId);

                // Notify other players
                socket.to(roomId).emit('player-left', socket.id);
                io.to(roomId).emit('players-updated', room.players);
            }
        }
    });

    function leaveRoom(socket, roomId) {
        const room = rooms.get(roomId)
        if (room) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id)
            if (playerIndex !== -1) {
                const player = room.players[playerIndex]
                room.players.splice(playerIndex, 1)

                // Player leaves but their score remains in the room scoreboard
                console.log(`Player ${player.name} left room ${roomId} (score preserved)`);

                socket.to(roomId).emit('player-left', socket.id)
                io.to(roomId).emit('players-updated', room.players)

                // Update scoreboard
                updateRoomScoreboard(roomId);

                // DON'T delete room immediately - wait a bit for reconnection
                if (room.players.length === 0) {
                    setTimeout(() => {
                        const roomStillEmpty = rooms.get(roomId)?.players.length === 0
                        if (roomStillEmpty) {
                            rooms.delete(roomId)
                            console.log(`Room ${roomId} deleted (empty)`)
                        }
                    }, 5000) // Wait 5 seconds before deleting empty room
                }
            }
        }
        socket.leave(roomId)
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        activeRooms: rooms.size,
        totalPlayers: Array.from(rooms.values()).reduce((acc, room) => acc + room.players.length, 0)
    });
});

// Get room info endpoint
app.get('/room/:roomId', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (room) {
        res.json({
            exists: true,
            players: room.players.length,
            gameStarted: room.gameStarted
        });
    } else {
        res.json({ exists: false });
    }
});

// Helper functions
function getRandomPlayerColor() {
    const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xfeca57, 0xff9ff3];
    return colors[Math.floor(Math.random() * colors.length)];
}

function generateCoinsFromMap() {
    // This should match your map.json coin positions
    // For now, return some default positions
    return [
        { id: 'coin_1', x: 250, y: 400 },
        { id: 'coin_2', x: 550, y: 330 },
        { id: 'coin_3', x: 350, y: 250 },
        { id: 'coin_4', x: 650, y: 200 },
        { id: 'coin_5', x: 450, y: 500 },
        { id: 'coin_6', x: 150, y: 350 }
    ].map(coin => ({ ...coin, collected: false }));
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Multiplayer server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
});