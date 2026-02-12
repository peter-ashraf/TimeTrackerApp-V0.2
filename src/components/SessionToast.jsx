import React, { useState, useEffect } from 'react';
import '../styles/session-toast.css';

const SessionToast = ({ isVisible, message, onClose, onToastClick }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [isVisible]);

  if (!isVisible && !isAnimating) return null;

  return (
    <div 
      className={`session-toast ${isVisible ? 'show' : 'hide'}`}
      onClick={onToastClick}
      role="alert"
      aria-live="polite"
    >
      <div className="toast-content">
        <span className="toast-icon">⏰</span>
        <span className="toast-message">{message}</span>
        <button 
          className="toast-close-btn"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default SessionToast;
