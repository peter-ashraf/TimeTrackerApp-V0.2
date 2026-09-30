import React, { useState, useEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import '../styles/bento-modals.css'; // Injecting Bento modal overrides globally
import '../styles/bento-modals-grid.css'; // Grid architecture

// Context so any child can call the animated close without needing a prop chain
export const SheetCloseContext = createContext(() => {});

// Convenience hook for consuming the animated close inside modal children
export function useSheetClose() {
  return useContext(SheetCloseContext);
}

function ModalShell({ onClose, children, contentClassName = '', closeOnOverlay = true, overlayClassName = '', showCloseButton = true }) {
  const [isClosing, setIsClosing] = useState(false);
  const [startY, setStartY] = useState(null);

  useEffect(() => {
    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      if (onClose) onClose();
    }, 350); // Wait for animation to finish
  };

  const handleOverlayClick = closeOnOverlay ? handleClose : undefined;
  
  const handleTouchStart = (e) => {
    setStartY(e.touches[0].clientY);
  };
  
  const handleTouchMove = (e) => {
    if (!startY) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    
    // Swipe down threshold
    if (diff > 40) {
      setStartY(null);
      handleClose();
    }
  };

  const handleTouchEnd = () => {
    setStartY(null);
  };
  
  const contentClass = ['modal-content', contentClassName, isClosing ? 'closing' : ''].filter(Boolean).join(' ');
  const overlayClass = ['modal-overlay', 'bento-modal-overlay', overlayClassName, isClosing ? 'closing' : ''].filter(Boolean).join(' ');

  const modalContent = (
    <div
      id="bento-modal-overlay-id"
      className={overlayClass}
      style={{ zIndex: 9999999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={handleOverlayClick}
    >
      <div
        className={contentClass}
        style={{ backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflow: 'hidden', overscrollBehavior: 'contain', borderTopLeftRadius: '32px', borderTopRightRadius: '32px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="sheet-handle-container" 
          onClick={handleClose}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="sheet-handle"></div>
        </div>
        {showCloseButton && onClose && (
          <button
            className="sheet-close-btn"
            onClick={handleClose}
            aria-label="Close modal"
          >
            Done
          </button>
        )}
        {/* Provide animated close to all descendants */}
        <SheetCloseContext.Provider value={handleClose}>
          {children}
        </SheetCloseContext.Provider>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
}

export default ModalShell;
