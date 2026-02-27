import React from 'react';
import '../styles/confirm-modal.css';
import ModalShell from './ModalShell';

function AlertModal({ 
  isOpen, 
  message, 
  title = 'Alert',
  type = 'info', // 'warning', 'danger', 'info', 'success'
  onClose,
  buttonText = 'OK'
}) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch(type) {
      case 'danger': return '⚠️';
      case 'warning': return '⚡';
      case 'success': return '✅';
      case 'info': return 'ℹ️';
      default: return 'ℹ️';
    }
  };

  return (
    <ModalShell onClose={onClose} closeOnOverlay={false} contentClassName="confirm-modal">
      {/* Icon and Title Container */}
      <div className="confirm-header">
        <div className={`confirm-icon confirm-icon-${type}`}>
          {getIcon()}
        </div>
        <h3>{title}</h3>
      </div>
      
      <p className="confirm-message" style={{ whiteSpace: 'pre-line' }}>
        {message}
      </p>
      
      <div className="modal-actions">
        <button 
          className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
          onClick={onClose}
        >
          {buttonText}
        </button>
      </div>
    </ModalShell>
  );
}

export default AlertModal;
