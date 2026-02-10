import React, { useEffect, useState } from 'react';
import '../styles/refresh-indicator.css';

const RefreshIndicator = ({ lastRefreshed }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (lastRefreshed) {
      setShouldShow(true);
      setIsVisible(true);
      
      // Hide after 3 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 3000);
      
      // Clean up completely after animation
      const cleanupTimer = setTimeout(() => {
        setShouldShow(false);
      }, 3500);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(cleanupTimer);
      };
    }
  }, [lastRefreshed]);

  if (!shouldShow) return null;

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <div className={`refresh-indicator ${isVisible ? 'visible' : ''}`}>
      <div className="refresh-indicator-content">
        <div className="refresh-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </div>
        <div className="refresh-text">
          <div className="refresh-title">Refreshed</div>
          <div className="refresh-time">{formatTime(lastRefreshed)}</div>
        </div>
      </div>
    </div>
  );
};

export default RefreshIndicator;
