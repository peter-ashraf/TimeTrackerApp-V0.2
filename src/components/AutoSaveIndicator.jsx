import React, { useState, useEffect } from 'react';
import '../styles/auto-save.css';

function AutoSaveIndicator({ lastSaved }) {
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    if (lastSaved) {
      setShowIndicator(true);
      const timer = setTimeout(() => {
        setShowIndicator(false);
      }, 3000); // Show for 3 seconds

      return () => clearTimeout(timer);
    }
  }, [lastSaved]);

  if (!showIndicator) return null;

  return (
    <div className="auto-save-indicator">
      <span className="save-icon">✓</span>
      <span className="save-text">Saved</span>
    </div>
  );
}

export default AutoSaveIndicator;
