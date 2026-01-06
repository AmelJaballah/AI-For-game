import React, { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import './Scoreboard.css';

const Scoreboard = ({ isTeacher }) => {
    const [isVisible, setIsVisible] = useState(isTeacher || false);
    const [topPlayers, setTopPlayers] = useState([]);
    const [isHovered, setIsHovered] = useState(false);
    const { socket } = useSocket();

    useEffect(() => {
        if (isTeacher) {
            setIsVisible(true);
        }
    }, [isTeacher]);

    useEffect(() => {
        if (!socket) return;

        // Listen for scoreboard updates
        socket.on('scoreboard-update', (players) => {
            console.log('📊 Scoreboard update received:', players);
            setTopPlayers(players);
        });

        // Request initial scoreboard data
        socket.emit('request-scoreboard');

        // Periodic refresh (every 3 seconds) to ensure sync
        const interval = setInterval(() => {
            if (socket.connected) {
                socket.emit('request-scoreboard');
            }
        }, 3000);

        return () => {
            socket.off('scoreboard-update');
            clearInterval(interval);
        };
    }, [socket]);

    const toggleVisibility = () => {
        setIsVisible(!isVisible);
    };

    const getRankClass = (index) => {
        if (index === 0) return 'rank-1';
        if (index === 1) return 'rank-2';
        if (index === 2) return 'rank-3';
        return '';
    };

    const getRankIcon = (index) => {
        if (index === 0) return '🥇';
        if (index === 1) return '🥈';
        if (index === 2) return '🥉';
        return `#${index + 1}`;
    };

    return (
        <>
            {/* Toggle Button - Always visible */}
            <button
                className={`scoreboard-toggle ${isHovered ? 'hovered' : ''}`}
                onClick={toggleVisibility}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                title={isVisible ? 'Hide Scoreboard' : 'Show Scoreboard'}
            >
                <img src="/assets/sprites/crown.png" alt="Scoreboard" />
            </button>

            {/* Scoreboard Content */}
            {isVisible && (
                <div className="scoreboard-container">
                    {/* Spiral Binding */}
                    <div className="scoreboard-spiral"></div>

                    {/* Header */}
                    <div className="scoreboard-header">
                        <img src="/assets/sprites/crown.png" alt="Scoreboard" />
                        <br />
                        Leaderboard
                    </div>

                    {/* Players List */}
                    <div className="scoreboard-players-list scoreboard-scrollbar">
                        {topPlayers.length === 0 ? (
                            <div className="scoreboard-no-players">No players yet</div>
                        ) : (
                            topPlayers.map((player, index) => (
                                <div
                                    key={player.id || index}
                                    className={`scoreboard-player-row ${getRankClass(index)}`}
                                >
                                    <div className="scoreboard-rank">
                                        {getRankIcon(index)}
                                    </div>
                                    <div className="scoreboard-player-name" title={player.name}>
                                        {player.name}
                                    </div>
                                    <div className="scoreboard-coins">
                                        {player.coins} {player.coins === 1 ? 'coin' : 'coins'}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default Scoreboard;