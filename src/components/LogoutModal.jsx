import React from 'react';
import '../styles/logout-modal.css';

const LogoutModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="logout-modal-overlay" onClick={onClose}>
      <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="logout-modal-header">
          <div className="logout-icon">🚪</div>
          <h2>Confirm Logout</h2>
        </div>
        
        <div className="logout-modal-body">
          <p>Are you sure you want to logout?</p>
          <p className="logout-subtitle">Any unsaved changes will be lost.</p>
        </div>
        
        <div className="logout-modal-footer">
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={onConfirm}
          >
            🚪 Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;
