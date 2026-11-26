import React, { useState, useEffect, useRef } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { useTimeEntry } from '../context/TimeEntryContext';
import { backgroundSync } from '../utils/backgroundSync';
import {
  getPendingTimeEntrySyncStatus,
  getPendingTimeEntryDeletesStatus,
} from '../utils/timeEntrySyncStatus';
import '../styles/offline-indicator.css';

const SYNC_STATUS_EVENT = 'time-entry-sync-status-changed';

const OfflineIndicator = ({
  onRefresh,
  onSyncToCloud,
  onSyncFromCloud,
  isRefreshing,
  syncAction = null,
}) => {
  const { isOnline, connectionType, isSlowConnection } = useNetworkStatus();
  const { queuedRequests, isSyncing } = useOfflineQueue();
  const { currentUser } = useSupabaseAuth();
  const { lastRefreshed } = useTimeEntry();

  const [showFullBanner, setShowFullBanner] = useState(false);
  const [wasOnline, setWasOnline] = useState(true);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [showSyncPopover, setShowSyncPopover] = useState(false);
  const [pendingLocalCount, setPendingLocalCount] = useState(0);
  const statusContainerRef = useRef(null);

  useEffect(() => {
    const refreshPendingCount = () => {
      if (!currentUser?.id) {
        setPendingLocalCount(0);
        return;
      }
      const syncPending = getPendingTimeEntrySyncStatus(currentUser.id).pending || 0;
      const deletePending = getPendingTimeEntryDeletesStatus(currentUser.id).pending || 0;
      setPendingLocalCount(syncPending + deletePending);
    };

    refreshPendingCount();
    window.addEventListener(SYNC_STATUS_EVENT, refreshPendingCount);
    return () => window.removeEventListener(SYNC_STATUS_EVENT, refreshPendingCount);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!showSyncPopover) return undefined;
    const handleOutside = (e) => {
      if (statusContainerRef.current && !statusContainerRef.current.contains(e.target)) {
        setShowSyncPopover(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setShowSyncPopover(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showSyncPopover]);

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
      // Just came online - show "Back Online" flash
      setShowBackOnline(true);
      setShowFullBanner(false);

      // Hide "Back Online" flash after 3 seconds
      const timer = setTimeout(() => {
        setShowBackOnline(false);
      }, 3000);

      return () => clearTimeout(timer);
    }

    setWasOnline(isOnline);
  }, [isOnline, wasOnline]);

  // Toggle Sync Popover when header status pill is clicked
  const handleStatusPillClick = () => {
    if (onSyncToCloud || onSyncFromCloud) {
      setShowSyncPopover((prev) => !prev);
      return;
    }
    if (onRefresh && !isRefreshing) {
      onRefresh();
    }
  };

  // Handle force sync (Push local queue & entries to cloud)
  const handleForceSync = async () => {
    try {
      await backgroundSync.forceSync();
      if (onSyncToCloud) {
        await onSyncToCloud();
      } else if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.warn('Force sync failed:', error);
    }
  };

  const handlePopoverSyncToCloud = async () => {
    setShowSyncPopover(false);
    if (isRefreshing) return;
    try {
      await backgroundSync.forceSync();
    } catch (err) {
      console.warn('Background queue flush failed:', err);
    }
    if (onSyncToCloud) {
      await onSyncToCloud();
    }
  };

  const handlePopoverSyncFromCloud = async () => {
    setShowSyncPopover(false);
    if (isRefreshing) return;
    if (onSyncFromCloud) {
      await onSyncFromCloud();
    } else if (onRefresh) {
      await onRefresh();
    }
  };

  const totalPendingBadge = (queuedRequests || 0) + pendingLocalCount;

  const formatLastSynced = () => {
    if (!lastRefreshed) return 'Not pulled yet';
    const diffSec = Math.max(0, Math.floor((Date.now() - new Date(lastRefreshed).getTime()) / 1000));
    if (diffSec < 60) return 'Synced just now';
    if (diffSec < 3600) return `Synced ${Math.floor(diffSec / 60)}m ago`;
    return `Synced ${Math.floor(diffSec / 3600)}h ago`;
  };

  const getConnectionIcon = () => {
    if (isRefreshing) return '🔄'; // Spinning icon when refreshing
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
      {/* Header indicator - Opens Sync Popover */}
      <div className="bento-status-anchor" ref={statusContainerRef}>
        <div
          className="bento-status"
          onClick={handleStatusPillClick}
          title="Sync options"
          style={{ cursor: 'pointer' }}
        >
          {isRefreshing ? (
            <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--text-secondary)' }}></i>
          ) : (
            <span className={`status-dot ${isOnline ? 'online' : 'offline'} ${isSlowConnection ? 'slow' : ''}`}></span>
          )}
          <span className="status-text">
            {isRefreshing
              ? (syncAction === 'push' ? 'Uploading' : syncAction === 'pull' ? 'Pulling' : 'Syncing')
              : (isOnline ? 'Online' : 'Offline')}
          </span>
          {totalPendingBadge > 0 && (
            <span className="status-queued">{totalPendingBadge}</span>
          )}
        </div>

        {showSyncPopover && (
          <div className="sync-popover" role="menu" aria-label="Cloud sync actions">
            <div className="sync-popover-header">
              <span>{isOnline ? 'Cloud Sync' : 'Offline'}</span>
              <span className="sync-popover-meta">
                {pendingLocalCount > 0 ? `${pendingLocalCount} pending` : formatLastSynced()}
              </span>
            </div>

            <button
              type="button"
              className="sync-popover-btn"
              onClick={handlePopoverSyncToCloud}
              disabled={!isOnline || isRefreshing}
              role="menuitem"
            >
              <span className="sync-popover-icon">
                <i className="fa-solid fa-cloud-arrow-up"></i>
              </span>
              <span className="sync-popover-copy">
                <strong>Sync to Cloud</strong>
                <small>Upload local entries &amp; changes</small>
              </span>
              {totalPendingBadge > 0 && (
                <span className="sync-popover-badge">{totalPendingBadge}</span>
              )}
            </button>

            <button
              type="button"
              className="sync-popover-btn"
              onClick={handlePopoverSyncFromCloud}
              disabled={!isOnline || isRefreshing}
              role="menuitem"
            >
              <span className="sync-popover-icon">
                <i className="fa-solid fa-cloud-arrow-down"></i>
              </span>
              <span className="sync-popover-copy">
                <strong>Sync from Cloud</strong>
                <small>Pull latest data to device</small>
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Back Online Flash */}
      {showBackOnline && (
        <div className="back-online-flash">
          <div className="back-online-content">
            <span className="back-online-icon">✅</span>
            <div className="back-online-text">
              <strong>Back Online</strong>
              <p>Your data has been synced</p>
            </div>
          </div>
        </div>
      )}

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
