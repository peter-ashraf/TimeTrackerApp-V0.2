import React from 'react';
import ModalShell from './ModalShell';
import '../styles/validation-modal.css';

const ValidationModal = ({ isOpen, onClose, title, message, type = 'warning' }) => {
  const getModalIcon = () => {
    switch (type) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'success':
        return '✅';
      default:
        return 'ℹ️';
    }
  };

  const getModalClass = () => {
    return `validation-modal validation-modal-${type}`;
  };

  if (!isOpen) return null;

  return (
    <ModalShell 
      isOpen={isOpen} 
      onClose={onClose} 
      contentClassName={getModalClass()}
    >
      <div className="validation-modal-content">
        <div className="validation-modal-icon">
          {getModalIcon()}
        </div>
        <h3 className="validation-modal-title">{title}</h3>
        <div className="validation-modal-message">
          {message.split('\n').map((line, index) => (
            <p key={index} className="validation-modal-line">
              {line}
            </p>
          ))}
        </div>
        <div className="validation-modal-actions">
          <button 
            className="btn btn-primary validation-modal-button"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export default ValidationModal;
