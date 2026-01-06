import React, { useState, useEffect } from 'react';

const PlayerStats = () => {
    const [lives, setLives] = useState(5);
    const [coins, setCoins] = useState(0);
    const [playerName, setPlayerName] = useState('Player');
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Listen for game state updates from the Phaser scene
        const handleGameStateUpdate = (event) => {
            const { lives, coins, playerName } = event.detail;
            if (lives !== undefined) setLives(lives);
            if (coins !== undefined) setCoins(coins);
            if (playerName !== undefined) setPlayerName(playerName);
        };

        // Listen for player data from localStorage
        const updateFromLocalStorage = () => {
            const storedData = JSON.parse(localStorage.getItem('playerData') || '{}');
            if (storedData.playerName) {
                setPlayerName(storedData.playerName);
            }
        };

        // Listen for quiz events to hide/show stats
        const handleQuizStart = () => setIsVisible(false);
        const handleQuizEnd = () => setIsVisible(true);

        window.addEventListener('gameStateUpdate', handleGameStateUpdate);
        window.addEventListener('storage', updateFromLocalStorage);
        window.addEventListener('quizStarted', handleQuizStart);
        window.addEventListener('quizEnded', handleQuizEnd);
        
        // Initial load from localStorage
        updateFromLocalStorage();

        return () => {
            window.removeEventListener('gameStateUpdate', handleGameStateUpdate);
            window.removeEventListener('storage', updateFromLocalStorage);
            window.removeEventListener('quizStarted', handleQuizStart);
            window.removeEventListener('quizEnded', handleQuizEnd);
        };
    }, []);

    if (!isVisible) return null;

    const containerStyle = {
        position: 'fixed',
        top: '20px',
        left: '20px',
        backgroundColor: 'var(--notebook-yellow)',
        color: 'var(--pixel-dark)',
        padding: '20px 25px 20px 45px',
        borderRadius: '0',
        border: '4px solid var(--pixel-border)',
        fontFamily: '"VT323", monospace',
        zIndex: 10000,
        minWidth: '220px',
        boxShadow: '8px 8px 0 var(--pixel-dark), inset 0 0 0 2px white',
        // Notebook lines background
        backgroundImage: `repeating-linear-gradient(
            transparent 0px,
            transparent 23px,
            var(--notebook-line) 24px
        )`,
        lineHeight: '24px'
    };

    // Spiral binding effect
    const spiralStyle = {
        position: 'absolute',
        left: '15px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '25px',
        height: '100px',
        background: `
            radial-gradient(circle at 12px 15px, var(--pixel-border) 3px, transparent 4px),
            radial-gradient(circle at 12px 35px, var(--pixel-border) 3px, transparent 4px),
            radial-gradient(circle at 12px 55px, var(--pixel-border) 3px, transparent 4px),
            radial-gradient(circle at 12px 75px, var(--pixel-border) 3px, transparent 4px),
            radial-gradient(circle at 12px 95px, var(--pixel-border) 3px, transparent 4px)
        `,
        pointerEvents: 'none'
    };
    const statRowStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        fontSize: '1.3rem'
    };

    const labelStyle = {
        fontWeight: 'bold',
        color: 'var(--pixel-blue)',
        textShadow: '1px 1px 0 var(--notebook-shadow)'
    };

    const valueStyle = {
        fontWeight: 'bold',
        color: 'var(--pixel-dark)',
        textShadow: '1px 1px 0 var(--notebook-shadow)'
    };

    const livesContainerStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    };

    const heartStyle = {
        fontSize: '1.5rem',
        filter: 'drop-shadow(1px 1px 0 var(--notebook-shadow))'
    };

    const coinContainerStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    };

    const coinStyle = {
        fontSize: '1.5rem',
        filter: 'drop-shadow(1px 1px 0 var(--notebook-shadow))'
    };

    const playerNameStyle = {
        textAlign: 'center',
        fontSize: '1.2rem',
        color: '#555',
        marginTop: '15px',
        paddingTop: '10px',
        borderTop: '1px dashed var(--notebook-line)'
    };

    return (
        <div style={containerStyle}>
            {/* Spiral Binding */}
            <div style={spiralStyle}></div>
            
            {/* Lives */}
            <div style={statRowStyle}>
                <span style={labelStyle}>LIVES:</span>
                <div style={livesContainerStyle}>
                    {Array.from({ length: 5 }, (_, index) => (
                        <span 
                            key={index} 
                            style={{
                                ...heartStyle,
                                opacity: index < lives ? 1 : 0.3,
                                color: index < lives ? '#ff5252' : '#ccc'
                            }}
                        >
                            ♥
                        </span>
                    ))}
                    <span style={valueStyle}>({lives})</span>
                </div>
            </div>
            
            {/* Coins */}
            <div style={statRowStyle}>
                <span style={labelStyle}>COINS:</span>
                <div style={coinContainerStyle}>
                    <span style={{...coinStyle, color: '#ffd700'}}>🪙</span>
                    <span style={valueStyle}>{coins}</span>
                </div>
            </div>
            
            {/* Player Name */}
            <div style={playerNameStyle}>
                {playerName}
            </div>
        </div>
    );
};

export default PlayerStats;