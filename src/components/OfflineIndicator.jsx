import React, { useState, useEffect } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { backgroundSync } from '../utils/backgroundSync';
import '../styles/offline-indicator.css';

const OfflineIndicator = () => {
  const { isOnline, connectionType, isSlowConnection } = useNetworkStatus();
  const { queuedRequests, isSyncing, triggerSync, lastSyncTime } = useOfflineQueue();
  
  const [showFullBanner, setShowFullBanner] = useState(false);
  const [wasOnline, setWasOnline] = useState(true);

  // Handle offline state changes
  useEffect(() => {
    if (!isOnline && wasOnline) {
      // Just went offline - show full banner
      setShowFullBanner(true);
      
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        setShowFullBanner(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    } else if (isOnline && !wasOnline) {
      // Just came online - hide everything
      setShowFullBanner(false);
    }
    
    setWasOnline(isOnline);
  }, [isOnline, wasOnline]);

  // Handle force sync
  const handleForceSync = async () => {
    try {
      await backgroundSync.forceSync();
    } catch (error) {
      
    }
  };

  const getConnectionIcon = () => {
    if (!isOnline) return '📴';
    if (isSlowConnection) return '🐢';
    if (connectionType === '4g') return '🚀';
    if (connectionType === '3g') return '📶';
    return '🌐';
  };

  const getConnectionText = () => {
    if (!isOnline) return 'Offline';
    if (isSlowConnection) return 'Slow Connection';
    return 'Online';
  };

  const getConnectionClass = () => {
    if (!isOnline) return 'offline-status';
    if (isSlowConnection) return 'slow-connection-status';
    if (isSyncing) return 'syncing-status';
    return 'online-status';
  };

  return (
    <>
      {/* Header indicator - Now clickable */}
      <div 
        className={`offline-indicator ${getConnectionClass()}`}
        onClick={handleForceSync}
        title="Click to force sync"
        style={{ cursor: 'pointer' }}
      >
        <span className="connection-icon">{getConnectionIcon()}</span>
        <span className="connection-text">{getConnectionText()}</span>
        {queuedRequests > 0 && (
          <span className="queued-count">{queuedRequests}</span>
        )}
      </div>

      {/* Full Offline Banner */}
      {!isOnline && showFullBanner && (
        <div className="offline-banner">
          <div className="offline-banner-content">
            <span className="offline-banner-icon">📴</span>
            <div className="offline-banner-text">
              <strong>You're offline</strong>
              <p>
                {queuedRequests > 0 
                  ? `${queuedRequests} actions queued for sync`
                  : 'Data will sync when you reconnect'
                }
              </p>
            </div>
            {queuedRequests > 0 && (
              <button 
                className="sync-button" 
                onClick={handleForceSync}
                disabled={!isOnline || isSyncing}
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sync notification when coming back online with queued items */}
      {isOnline && queuedRequests > 0 && !isSyncing && (
        <div className="sync-notification">
          <div className="sync-notification-content">
            <span className="sync-icon">🔄</span>
            <div className="sync-text">
              <strong>{queuedRequests} actions to sync</strong>
              <p>Tap to sync your data</p>
            </div>
            <button 
              className="sync-button" 
              onClick={handleForceSync}
              disabled={isSyncing}
            >
              {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>
      )}

      {/* Syncing indicator */}
      {isSyncing && (
        <div className="syncing-indicator">
          <div className="syncing-content">
            <span className="syncing-icon">🔄</span>
            <div className="syncing-text">
              <strong>Syncing data...</strong>
              <p>Please wait while we sync your changes</p>
            </div>
          </div>
        </div>
      )}

      {/* Slow connection warning */}
      {isOnline && isSlowConnection && (
        <div className="slow-connection-warning">
          <div className="slow-connection-content">
            <span className="slow-connection-icon">🐢</span>
            <div className="slow-connection-text">
              <strong>Slow connection detected</strong>
              <p>Some features may be limited</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OfflineIndicator;
