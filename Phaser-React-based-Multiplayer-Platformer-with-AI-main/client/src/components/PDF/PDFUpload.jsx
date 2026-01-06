import React, { useState, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import axios from 'axios';
import io from 'socket.io-client';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const PDFUpload = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { roomId } = useParams();

    const [numPages, setNumPages] = useState(null);
    const [pdfText, setPdfText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [generatedQuestions, setGeneratedQuestions] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [uploadError, setUploadError] = useState('');
    const fileInputRef = useRef(null);
    const dropAreaRef = useRef(null);

    // Get playerName from location state
    const playerName = location.state?.playerName;

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
    };

    const goToRoom = () => {
        const currentPlayerName = playerName || 'Host';
        const encodedName = encodeURIComponent(currentPlayerName);
        navigate(`/room/${roomId}?playerName=${encodedName}&isHost=true`);
    };

    // Improved file handling with drag and drop
    const handleFileSelect = (files) => {
        const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');

        if (pdfFiles.length === 0) {
            setUploadError('Please select PDF files only');
            return;
        }

        if (pdfFiles.length > 5) {
            setUploadError('Maximum 5 PDF files allowed');
            return;
        }

        setUploadError('');
        setUploadedFiles(pdfFiles);
        processFiles(pdfFiles);
    };

    const handleFileInputChange = (event) => {
        handleFileSelect(event.target.files);
    };

    const handleDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (dropAreaRef.current) {
            dropAreaRef.current.style.background = 'var(--notebook-yellow)';
        }

        const files = event.dataTransfer.files;
        handleFileSelect(files);
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (dropAreaRef.current) {
            dropAreaRef.current.style.background = 'var(--pixel-light)';
        }
    };

    const handleDragLeave = (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (dropAreaRef.current) {
            dropAreaRef.current.style.background = 'white';
        }
    };

    const processFiles = async (files) => {
        setIsProcessing(true);
        setGeneratedQuestions([]);
        setPdfText('');

        try {
            let combinedText = '';

            for (const file of files) {
                console.log(`Processing file: ${file.name}, size: ${file.size} bytes`);
                const text = await extractTextFromPDF(file);
                combinedText += `\n\n--- Document: ${file.name} ---\n\n${text}`;
            }

            setPdfText(combinedText);
            await generateQuestionsFromText(combinedText);
        } catch (error) {
            console.error('Error processing PDF:', error);
            setUploadError('Error processing PDF files. Please try again with a different PDF.');
        } finally {
            setIsProcessing(false);
        }
    };

    const extractTextFromPDF = async (file) => {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();

            fileReader.onload = async () => {
                try {
                    console.log(`Extracting text from PDF: ${file.name}`);
                    const typedArray = new Uint8Array(fileReader.result);

                    // Check file size
                    if (typedArray.length > 10 * 1024 * 1024) { // 10MB limit
                        reject(new Error('PDF file too large. Maximum size is 10MB.'));
                        return;
                    }

                    const pdf = await pdfjs.getDocument(typedArray).promise;
                    let fullText = '';

                    console.log(`PDF has ${pdf.numPages} pages`);

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(' ');
                        fullText += pageText + '\n';

                        // Limit to first 60 pages to avoid timeout
                        if (i >= 60) {
                            fullText += '\n[Content truncated after 60 pages]';
                            break;
                        }
                    }

                    console.log(`Extracted ${fullText.length} characters from PDF`);
                    resolve(fullText);
                } catch (error) {
                    console.error('PDF extraction error:', error);
                    reject(new Error('Failed to read PDF. The file may be corrupted or password protected.'));
                }
            };

            fileReader.onerror = (error) => {
                console.error('FileReader error:', error);
                reject(new Error('Failed to read file'));
            };

            fileReader.readAsArrayBuffer(file);
        });
    };

    const generateQuestionsFromText = async (text) => {
        try {
            // Clean and limit text - increased limit for more context
            const cleanText = text.replace(/[^\w\s.,!?;:'"-]/g, ' ').replace(/\s+/g, ' ').trim();
            const limitedText = cleanText.substring(0, 4000);

            console.log('Sending text to AI for question generation...');
            console.log('Text length:', limitedText.length, 'characters');

            // Improved prompt with strict instructions to use ONLY the provided text
            const response = await axios.post('http://localhost:11434/api/generate', {
                model: 'qwen3:8b',
                prompt: `/no_think
You are a quiz generator. Create 5-8 multiple-choice questions EXCLUSIVELY based on the following document text.

CRITICAL RULES:
- ONLY create questions about information that is EXPLICITLY stated in the text below
- Do NOT use any external knowledge or make assumptions
- Every question MUST be answerable using ONLY the provided text
- Each answer option must be plausible but only ONE correct based on the text
- Quote or paraphrase directly from the text when possible

DOCUMENT TEXT:
"""
${limitedText}
"""

TASK: Generate quiz questions that test the reader's understanding of THIS SPECIFIC document.

OUTPUT FORMAT - Return ONLY a valid JSON array, no markdown, no explanation:
[
  {
    "question": "According to the document, what is...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0
  }
]

Generate the JSON array now:`,
                stream: false
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 90000 // 90 second timeout for better responses
            });

            console.log('AI response received');

            // Parse the response
            const responseText = response.data.response;
            console.log('Raw AI response:', responseText);

            // Clean the response text before parsing
            let cleanResponse = responseText.trim();

            // Remove any markdown code blocks
            cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');

            // Extract JSON from the response
            let questions;
            try {
                questions = JSON.parse(cleanResponse);
            } catch (parseError) {
                console.log('First parse failed, trying to extract JSON...', parseError);
                // If that fails, try to extract JSON from the text
                const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    questions = JSON.parse(jsonMatch[0]);
                } else {
                    console.log('Could not parse JSON, using fallback questions');
                    throw new Error('Could not parse questions from AI response');
                }
            }

            // Validate and clean questions
            if (Array.isArray(questions) && questions.length > 0) {
                const validatedQuestions = questions.map((q, index) => {
                    // Ensure question is a string
                    const questionText = typeof q.question === 'string' ? q.question : `Question ${index + 1}`;

                    // Ensure options are valid
                    let options = ['Option A', 'Option B', 'Option C', 'Option D'];
                    if (Array.isArray(q.options) && q.options.length === 4) {
                        options = q.options.map(opt =>
                            typeof opt === 'string' && opt.length > 0 ? opt : `Option ${String.fromCharCode(65 + options.indexOf(opt))}`
                        );
                    }

                    // Ensure correct index is valid
                    const correct = typeof q.correct === 'number' && q.correct >= 0 && q.correct <= 3 ? q.correct : 0;

                    return {
                        question: questionText,
                        options: options,
                        correct: correct
                    };
                }).filter(q => q.question.length > 10); // Filter out very short questions

                console.log(`Generated ${validatedQuestions.length} validated questions`);

                if (validatedQuestions.length === 0) {
                    throw new Error('No valid questions generated');
                }

                setGeneratedQuestions(validatedQuestions);
            } else {
                throw new Error('Invalid questions format generated');
            }

        } catch (error) {
            console.error('Error generating questions:', error);

            // Enhanced fallback questions
            const fallbackQuestions = generateEnhancedFallbackQuestions();
            setGeneratedQuestions(fallbackQuestions);

            let errorMessage = 'AI generation failed. Using fallback questions.';
            if (error.code === 'ERR_NETWORK') {
                errorMessage = 'Could not connect to Ollama. Ensure it is running at http://localhost:11434.';
            } else if (error.response && error.response.status === 404) {
                errorMessage = 'Model "qwen3:8b" not found. Run "ollama pull qwen3:8b" in your terminal.';
            } else {
                errorMessage = 'AI generation had issues. Ensure Ollama is running with "qwen3:8b" model.';
            }

            setUploadError(errorMessage);
        }
    };

    const generateEnhancedFallbackQuestions = () => {
        return [
            {
                question: "Based on the document, what is the primary subject or main topic discussed?",
                options: [
                    "Scientific research methods and findings",
                    "Historical events and their significance",
                    "Technical processes and implementations",
                    "Theoretical concepts and their applications"
                ],
                correct: 0
            },
            {
                question: "Which methodology or approach was most emphasized in the text?",
                options: [
                    "Experimental analysis with controlled variables",
                    "Statistical analysis of large datasets",
                    "Case studies and qualitative observation",
                    "Theoretical modeling and simulation"
                ],
                correct: 1
            },
            {
                question: "What was identified as the key challenge or problem in the document?",
                options: [
                    "Limited data availability for analysis",
                    "Complexity of implementing solutions",
                    "Conflicting results from previous studies",
                    "Theoretical framework limitations"
                ],
                correct: 2
            },
            {
                question: "According to the text, what was the main conclusion or finding?",
                options: [
                    "A new methodology proved more effective than existing approaches",
                    "The research confirmed previously established theories",
                    "Unexpected results suggested new areas for investigation",
                    "Practical applications were successfully demonstrated"
                ],
                correct: 3
            },
            {
                question: "What recommendation was made for future work or additional research?",
                options: [
                    "Expand the study to include more diverse samples",
                    "Focus on theoretical foundations rather than applications",
                    "Replicate the study with different methodologies",
                    "Investigate related but distinct problem domains"
                ],
                correct: 0
            }
        ];
    };

    const handleUseQuestions = () => {
        if (generatedQuestions.length === 0) {
            alert('No questions generated yet. Please upload PDF files first.');
            return;
        }

        // Store questions in localStorage with room-specific key
        const roomQuestionsKey = `gameQuestions_${roomId}`;
        localStorage.setItem(roomQuestionsKey, JSON.stringify(generatedQuestions));

        // Also store in the general key for backward compatibility
        localStorage.setItem('gameQuestions', JSON.stringify(generatedQuestions));

        // Get player name from location state or use a default
        const currentPlayerName = playerName || 'Host';

        console.log('Navigating back to room with:', {
            roomId,
            playerName: currentPlayerName,
            questionCount: generatedQuestions.length
        });

        // Broadcast questions to server
        try {
            const socket = io('http://localhost:3001');
            socket.on('connect', () => {
                socket.emit('broadcast-questions', {
                    roomId,
                    questions: generatedQuestions
                });
                console.log('📤 Broadcasted questions to server');
                // Close connection after brief delay to ensure send
                setTimeout(() => socket.disconnect(), 1000);
            });
        } catch (error) {
            console.error('Failed to broadcast questions:', error);
        }

        // Navigate back to room with proper parameters
        navigate(`/room/${roomId}?playerName=${encodeURIComponent(currentPlayerName)}&isHost=true`, {
            state: {
                questionsGenerated: true,
                questionCount: generatedQuestions.length
            }
        });
    };


    const handleManualQuestions = () => {
        const manualQuestions = [
            {
                question: "What is 2 + 2?",
                options: ["3", "4", "5", "6"],
                correct: 1
            },
            {
                question: "What is the capital of France?",
                options: ["London", "Berlin", "Paris", "Madrid"],
                correct: 2
            },
            {
                question: "Which language runs in a web browser?",
                options: ["Java", "C", "Python", "JavaScript"],
                correct: 3
            },
            {
                question: "What is the largest planet in our solar system?",
                options: ["Earth", "Saturn", "Jupiter", "Neptune"],
                correct: 2
            },
            {
                question: "Who wrote 'Romeo and Juliet'?",
                options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"],
                correct: 1
            }
        ];

        setGeneratedQuestions(manualQuestions);
        setUploadError(''); // Clear any previous errors
    };

    const clearFiles = () => {
        setUploadedFiles([]);
        setPdfText('');
        setGeneratedQuestions([]);
        setUploadError('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const goBackToRoom = () => {
        goToRoom();
    };

    const triggerFileInput = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    return (
        <div className="pdf-upload-container">
            <div className="pdf-upload-header">
                <button onClick={goBackToRoom} className="back-button">
                    ← Back to Room {roomId}
                </button>
                <h1>PDF Question Generator</h1>
                <div className="room-info">
                    <span>Room: {roomId}</span>
                    {playerName && <span>Host: {playerName}</span>}
                </div>
            </div>

            <div className="upload-section">
                <h2>Upload PDF Files for Room {roomId}</h2>

                {uploadError && (
                    <div className="error-message">
                        {uploadError}
                    </div>
                )}

                <div
                    className="upload-area"
                    ref={dropAreaRef}
                    onClick={triggerFileInput}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    style={{ cursor: 'pointer' }}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileInputChange}
                        accept=".pdf"
                        multiple
                        disabled={isProcessing}
                        style={{ display: 'none' }}
                    />
                    <div className="upload-prompt">
                        <div className="upload-icon"></div>
                        <p>
                            {isProcessing ? 'Processing PDF...' : 'Click to select PDF files or drag and drop them here'}
                        </p>
                        <small>Supported: PDF files (max 5 files, 10MB each)</small>
                        <br />
                        <small>First 60 pages will be processed</small>
                    </div>
                </div>

                {uploadedFiles.length > 0 && (
                    <div className="file-list">
                        <h4>Selected Files ({uploadedFiles.length}):</h4>
                        {uploadedFiles.map((file, index) => (
                            <div key={index} className="file-item">
                                <span>{file.name}</span>
                                <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                            </div>
                        ))}
                        <button onClick={clearFiles} className="clear-files-button" disabled={isProcessing}>
                            Clear Files
                        </button>
                    </div>
                )}
            </div>

            {isProcessing && (
                <div className="processing-section">
                    <div className="loading-spinner"></div>
                    <p>Processing PDF files and generating questions... This may take a minute.</p>
                </div>
            )}

            {pdfText && !isProcessing && (
                <div className="text-preview-section">
                    <h3>Extracted Text Preview</h3>
                    <div className="text-preview">
                        {pdfText.substring(0, 500)}...
                        {pdfText.length > 500 && (
                            <div style={{ marginTop: '10px', fontStyle: 'italic' }}>
                                (Showing first 500 of {pdfText.length} characters)
                            </div>
                        )}
                    </div>
                </div>
            )}

            {generatedQuestions.length > 0 && (
                <div className="questions-section">
                    <div className="questions-header">
                        <h2>Generated Questions ({generatedQuestions.length})</h2>
                        <div className="questions-actions">
                            <button onClick={handleUseQuestions} className="use-questions-button">
                                Use These Questions in Room {roomId}
                            </button>
                            <button onClick={handleManualQuestions} className="manual-questions-button">
                                Use Sample Questions Instead
                            </button>
                        </div>
                    </div>

                    <div className="questions-list">
                        {generatedQuestions.map((question, index) => (
                            <div key={index} className="question-card">
                                <div className="question-header">
                                    <h4>Question {index + 1}</h4>
                                    <span className="correct-answer">
                                        Correct: Option {String.fromCharCode(65 + question.correct)}
                                    </span>
                                </div>
                                <p className="question-text">{question.question}</p>
                                <div className="options-grid">
                                    {question.options.map((option, optIndex) => (
                                        <div
                                            key={optIndex}
                                            className={`option ${optIndex === question.correct ? 'correct' : ''}`}
                                        >
                                            <span className="option-letter">
                                                {String.fromCharCode(65 + optIndex)}
                                            </span>
                                            <span className="option-text">{option}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!isProcessing && generatedQuestions.length === 0 && uploadedFiles.length === 0 && (
                <div className="manual-section">
                    <h3>Quick Start</h3>
                    <p>Don't have PDF files? Generate sample questions instead:</p>
                    <button onClick={handleManualQuestions} className="manual-questions-button">
                        Generate Sample Questions
                    </button>
                </div>
            )}
        </div>
    );
};

export default PDFUpload;