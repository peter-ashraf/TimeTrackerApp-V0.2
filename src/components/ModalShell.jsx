import React from 'react';
import { createPortal } from 'react-dom';

function ModalShell({ onClose, children, contentClassName = '', closeOnOverlay = true, overlayClassName = '' }) {
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div className={contentClass} onClick={(e) => e.stopPropagation()}>
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
