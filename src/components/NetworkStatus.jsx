import React, { useState, useEffect } from 'react';
import '../styles/NetworkStatus.css';

const NetworkStatus = ({ onRefresh }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showStatus, setShowStatus] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing || !isOnline) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 3000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showStatus) return null;

  return (
    <div className={`network-status ${isOnline ? 'online' : 'offline'}`}>
      <div className="network-status-content">
        <div className="network-status-icon">
          {isRefreshing ? (
            <div className="refresh-spinner">⟳</div>
          ) : isOnline ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
              <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 1l22 22"/>
              <path d="M16.72 11.06A11 11 0 0 1 5 12.55"/>
              <path d="M5 12.55a11 11 0 0 1 11.06-6.72"/>
              <line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
          )}
        </div>
        <div className="network-status-text">
          {isRefreshing ? 'Syncing...' : isOnline ? 'Back online' : 'You\'re offline'}
        </div>
        {isOnline && (
          <button
            className="refresh-button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh data from server"
          >
            {isRefreshing ? (
              <div className="refresh-spinner">⟳</div>
            ) : (
              <span>⟳</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default NetworkStatus;
