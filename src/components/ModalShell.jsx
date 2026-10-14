import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import '../styles/bento-modals.css'; // Injecting Bento modal overrides globally
import '../styles/bento-modals-grid.css'; // Grid architecture
import { attachSheetDrag } from '../utils/sheetDrag';

// Context so any child can call the animated close without needing a prop chain
export const SheetCloseContext = createContext(() => {});

// Convenience hook for consuming the animated close inside modal children
export function useSheetClose() {
  return useContext(SheetCloseContext);
}

function ModalShell({ onClose, children, contentClassName = '', closeOnOverlay = true, overlayClassName = '', showCloseButton = true, maxWidth = '700px' }) {
  const [isClosing, setIsClosing] = useState(false);
  const overlayRef = useRef(null);
  const sheetRef = useRef(null);
  const handleRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    // Lock body scroll
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
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
  
  // Drag the sheet down from the grey pill or the header to dismiss it, like iOS
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return undefined;
    return attachSheetDrag({
      sheet,
      handles: [handleRef.current, sheet.querySelector('.modal-header')],
      backdrop: overlayRef.current,
      onDismiss: () => { if (onCloseRef.current) onCloseRef.current(); },
    });
  }, []);

  const contentClass = ['modal-content', contentClassName, isClosing ? 'closing' : ''].filter(Boolean).join(' ');
  const overlayClass = ['modal-overlay', 'bento-modal-overlay', overlayClassName, isClosing ? 'closing' : ''].filter(Boolean).join(' ');

  const modalContent = (
    <div
      id="bento-modal-overlay-id"
      ref={overlayRef}
      className={overlayClass}
      style={{ zIndex: 9999999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={handleOverlayClick}
    >
      <div
        ref={sheetRef}
        className={contentClass}
        style={{ backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: maxWidth, maxHeight: '90vh', overflow: 'hidden', overscrollBehavior: 'contain', borderTopLeftRadius: '32px', borderTopRightRadius: '32px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          ref={handleRef}
          className="sheet-handle-container"
          onClick={handleClose}
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
