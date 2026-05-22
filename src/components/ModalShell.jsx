import React from 'react';
import { createPortal } from 'react-dom';

function ModalShell({ onClose, children, contentClassName = '', closeOnOverlay = true, overlayClassName = '', showCloseButton = true }) {
  const handleOverlayClick = closeOnOverlay && onClose ? onClose : undefined;
  const contentClass = ['modal-content', contentClassName].filter(Boolean).join(' ');
  const overlayClass = ['modal-overlay', overlayClassName].filter(Boolean).join(' ');

  const modalContent = (
    <div
      className={overlayClass}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        className={contentClass}
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        {showCloseButton && onClose && (
          <button
            className="modal-close-button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: '1',
              opacity: '0.6',
              transition: 'opacity 0.2s',
              zIndex: '10'
            }}
            onMouseEnter={(e) => e.target.style.opacity = '1'}
            onMouseLeave={(e) => e.target.style.opacity = '0.6'}
          >
            ×
          </button>
        )}
        {children}
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
}

export default ModalShell;
