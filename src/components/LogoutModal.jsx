import React from 'react';
import ModalShell from './ModalShell';

const LogoutModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <ModalShell onClose={onClose} closeOnOverlay={false} showCloseButton={false}>
      <div style={{ padding: '28px 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Icon badge */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          alignSelf: 'center', flexShrink: 0,
        }}>
          <i className="fa-solid fa-right-from-bracket" style={{ fontSize: '1.5rem', color: '#ef4444' }} />
        </div>

        {/* Text */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>Sign out?</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Any unsaved changes will be lost.
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={onConfirm}
            style={{
              width: '100%', padding: '14px',
              borderRadius: '16px', border: 'none', cursor: 'pointer',
              background: '#ef4444', color: '#fff',
              fontWeight: 700, fontSize: '1rem',
              boxShadow: '0 4px 16px rgba(239,68,68,0.3)',
            }}
          >
            Sign Out
          </button>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '14px',
              borderRadius: '16px', cursor: 'pointer',
              background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
              border: '1px solid var(--border-light)',
              fontWeight: 600, fontSize: '1rem',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export default LogoutModal;
