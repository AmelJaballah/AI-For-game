import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../../context/SocketContext'

const Home = () => {
    const [playerName, setPlayerName] = useState('')
    const [roomId, setRoomId] = useState('')
    const [isCreatingRoom, setIsCreatingRoom] = useState(false)
    const [isJoiningRoom, setIsJoiningRoom] = useState(false)
    const [error, setError] = useState('')
    const [recentRooms, setRecentRooms] = useState([])
    const [showNameModal, setShowNameModal] = useState(false)
    const [actionType, setActionType] = useState('') // 'create' or 'join'

    const navigate = useNavigate()
    const { socket } = useSocket()

    useEffect(() => {
        // Load recent rooms from localStorage
        const savedRooms = localStorage.getItem('recentRooms')
        if (savedRooms) {
            setRecentRooms(JSON.parse(savedRooms))
        }

        if (!socket) {
            console.log('Waiting for socket connection...')
            return
        }

        // Socket connection events for debugging
        socket.on('connect', () => {
            console.log('Connected to server from Home')
        })

        socket.on('disconnect', () => {
            console.log('Disconnected from server from Home')
        })

        socket.on('connect_error', (error) => {
            console.error('Connection error:', error)
            setError('Failed to connect to server. Please refresh the page.')
        })

        return () => {
            if (socket) {
                socket.off('connect')
                socket.off('disconnect')
                socket.off('connect_error')
            }
        }
    }, [socket])

    const generateRoomId = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase()
    }

    const handleCreateRoomClick = () => {
        setActionType('create')
        setShowNameModal(true)
    }

    const handleJoinRoomClick = () => {
        setActionType('join')
        setShowNameModal(true)
    }

    const handleNameSubmit = () => {
        if (!playerName.trim()) {
            setError('Please enter your name')
            return
        }

        setShowNameModal(false)
        setError('')

        if (actionType === 'create') {
            createRoom()
        } else {
            joinRoom()
        }
    }

    const createRoom = () => {
        if (!socket) {
            setError('Not connected to server. Please wait...')
            return
        }

        setIsCreatingRoom(true)

        const newRoomId = generateRoomId()
        const encodedName = encodeURIComponent(playerName.trim())

        // Add to recent rooms
        const newRecentRoom = {
            roomId: newRoomId,
            playerName: playerName.trim(),
            isHost: true,
            timestamp: new Date().toISOString()
        }
        
        const updatedRooms = [newRecentRoom, ...recentRooms.filter(room => room.roomId !== newRoomId)].slice(0, 5)
        setRecentRooms(updatedRooms)
        localStorage.setItem('recentRooms', JSON.stringify(updatedRooms))

        // Clear any previous questions for this room when creating new room
        const roomQuestionsKey = `gameQuestions_${newRoomId}`;
        localStorage.removeItem(roomQuestionsKey);
        localStorage.removeItem('gameQuestions'); // Clear general questions too

        console.log(`🧹 Cleared previous questions for new room: ${newRoomId}`);

        // Navigate to PDF uploader first for host
        navigate(`/pdf-upload/${newRoomId}`, {
            state: {
                roomId: newRoomId,
                playerName: playerName.trim(),
                isHost: true
            }
        })
    }

    const joinRoom = () => {
        if (!roomId.trim()) {
            setError('Please enter a room ID')
            setShowNameModal(true)
            return
        }

        if (!socket) {
            setError('Not connected to server. Please wait...')
            return
        }

        setIsJoiningRoom(true)

        const encodedName = encodeURIComponent(playerName.trim())
        const cleanRoomId = roomId.trim().toUpperCase()

        // Add to recent rooms
        const newRecentRoom = {
            roomId: cleanRoomId,
            playerName: playerName.trim(),
            isHost: false,
            timestamp: new Date().toISOString()
        }
        
        const updatedRooms = [newRecentRoom, ...recentRooms.filter(room => room.roomId !== cleanRoomId)].slice(0, 5)
        setRecentRooms(updatedRooms)
        localStorage.setItem('recentRooms', JSON.stringify(updatedRooms))

        // Navigate to room as player (players don't go to PDF uploader)
        navigate(`/room/${cleanRoomId}?playerName=${encodedName}&isHost=false`)
    }

    const joinRecentRoom = (recentRoom) => {
        setPlayerName(recentRoom.playerName)
        setRoomId(recentRoom.roomId)
        
        const encodedName = encodeURIComponent(recentRoom.playerName)
        
        if (recentRoom.isHost) {
            // Host goes to PDF uploader
            navigate(`/pdf-upload/${recentRoom.roomId}`, {
                state: {
                    roomId: recentRoom.roomId,
                    playerName: recentRoom.playerName,
                    isHost: true
                }
            })
        } else {
            // Player goes directly to room
            navigate(`/room/${recentRoom.roomId}?playerName=${encodedName}&isHost=false`)
        }
    }

    const removeRecentRoom = (roomIdToRemove, e) => {
        e.stopPropagation()
        const updatedRooms = recentRooms.filter(room => room.roomId !== roomIdToRemove)
        setRecentRooms(updatedRooms)
        localStorage.setItem('recentRooms', JSON.stringify(updatedRooms))
    }

    return (
        <div className="home-container">
            <div className="home-content">
                {/* Header Section */}
                <div className="hero-section">
                    <h1 className="home-title">QUIZ PLATFORMER</h1>
                    <p className="tagline">Collect coins, answer questions, and compete with friends!</p>
                </div>

                {/* Main Action Buttons */}
                <div className="main-actions">
                    <div className="action-card create-card">
                        <div className="action-icon"></div>
                        <h3>HOST GAME</h3>
                        <p>Create a new room and generate questions from PDFs</p>
                        <button 
                            onClick={handleCreateRoomClick}
                            className="host-button pixel-button"
                        >
                            CREATE ROOM
                        </button>
                    </div>

                    <div className="action-card join-card">
                        <div className="action-icon"></div>
                        <h3>JOIN GAME</h3>
                        <p>Enter a room ID to join an existing game</p>
                        <button 
                            onClick={handleJoinRoomClick}
                            className="join-button pixel-button"
                        >
                            JOIN ROOM
                        </button>
                    </div>
                </div>

                {/* Name Input Modal */}
                {showNameModal && (
                    <div className="modal-overlay">
                        <div className="name-modal pixel-card">
                            <h3 className="modal-title">
                                {actionType === 'create' ? 'CREATE ROOM' : 'JOIN ROOM'}
                            </h3>
                            
                            <div className="input-group">
                                <label className="input-label">YOUR NAME</label>
                                <input
                                    type="text"
                                    placeholder="Enter your name..."
                                    value={playerName}
                                    onChange={(e) => setPlayerName(e.target.value)}
                                    className="name-input-full"
                                    maxLength={20}
                                    autoFocus
                                />
                            </div>

                            {actionType === 'join' && (
                                <div className="input-group">
                                    <label className="input-label">ROOM ID</label>
                                    <input
                                        type="text"
                                        placeholder="Enter room ID..."
                                        value={roomId}
                                        onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                                        className="room-input"
                                        maxLength={6}
                                    />
                                </div>
                            )}

                            {error && (
                                <div className="error-message">
                                    {error}
                                </div>
                            )}

                            <div className="modal-actions">
                                <button 
                                    onClick={() => setShowNameModal(false)}
                                    className="cancel-button pixel-button"
                                >
                                    CANCEL
                                </button>
                                <button 
                                    onClick={handleNameSubmit}
                                    className="confirm-button pixel-button"
                                    disabled={!playerName.trim() || (actionType === 'join' && !roomId.trim())}
                                >
                                    {actionType === 'create' ? 'CREATE' : 'JOIN'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading States */}
                {(isCreatingRoom || isJoiningRoom) && (
                    <div className="loading-overlay">
                        <div className="loading-content">
                            <div className="loading-spinner"></div>
                            <p>{isCreatingRoom ? 'Creating Room...' : 'Joining Room...'}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Home
