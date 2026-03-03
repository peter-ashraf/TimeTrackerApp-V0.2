import React from 'react';
import ModalShell from './ModalShell';
import '../styles/logout-modal.css';

const LogoutModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <ModalShell onClose={onClose} contentClassName="logout-modal" closeOnOverlay={false}>
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
    </ModalShell>
  );
};

export default LogoutModal;
