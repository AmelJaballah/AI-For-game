import React, { useState, useEffect } from 'react';

const QuizPopup = ({ 
  isVisible, 
  question, 
  options, 
  correctIndex, 
  onAnswer 
}) => {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setSelectedIndex(null);
      setShowResult(false);
    }
  }, [isVisible]);

  const handleAnswer = (index) => {
    if (showResult) return;
    
    setSelectedIndex(index);
    setShowResult(true);
    
    setTimeout(() => {
      onAnswer(index === correctIndex);
    }, 1500);
  };

  const getButtonClass = (index) => {
    if (!showResult) return `option-button option-${index}`;
    
    if (index === correctIndex) {
      return `option-button option-${index} correct`;
    } else if (index === selectedIndex && index !== correctIndex) {
      return `option-button option-${index} incorrect`;
    } else {
      return `option-button option-${index} disabled`;
    }
  };

  if (!isVisible) return null;

  return (
    <div className="quiz-overlay">
      <div className="quiz-popup">
        <div className="quiz-header">
          <h2> Quiz Challenge!</h2>
        </div>
        
        <div className="quiz-question">
          <p>{question}</p>
        </div>
        
        <div className="options-grid">
          {options.map((option, index) => (
            <button
              key={index}
              className={getButtonClass(index)}
              onClick={() => handleAnswer(index)}
              disabled={showResult}
            >
              <span className="option-shape">
                {['🔴', '🟡', '🟢', '🔵'][index]}
              </span>
              <span className="option-text">{option}</span>
            </button>
          ))}
        </div>
        
        {showResult && (
          <div className="result-feedback">
            {selectedIndex === correctIndex ? (
              <div className="correct-feedback"> Correct! +1 Coin</div>
            ) : (
              <div className="incorrect-feedback"> Wrong! -1 Coin</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizPopup;