import React from 'react';
import '../styles/confirm-modal.css';

function ConfirmModal({ 
  isOpen, 
  message, 
  title = 'Confirm Action',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning', // 'warning', 'danger', 'info', 'success'
  onConfirm, 
  onCancel,
  showCancel = true // NEW: Controls whether Cancel button appears
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
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
        
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
          {showCancel && (
            <button 
              className="btn btn-secondary" 
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}
          <button 
            className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
