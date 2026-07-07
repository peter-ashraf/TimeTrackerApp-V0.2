/**
 * Background sync service for data reconciliation
 * Handles syncing between localStorage, IndexedDB, and potential server
 */

import { offlineStorage } from './offlineStorage.js';
import { offlineQueue } from './offlineQueue.js';
import { saveToStorage, loadFromStorage } from './storage.js';
import { setSimpleEncryptedItem, getSimpleEncryptedItem } from './simple-encryption.js';
import { multiTabSync } from './multiTabSync.js';

class BackgroundSync {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.lastSyncTime = null;
    this.listeners = [];
    this.syncInterval = null;
    this.initialized = false;
    this.conflictResolution = 'local_wins'; // or 'remote_wins', 'merge', 'prompt'
  }

  /**
   * Initialize the sync service
   */
  async init() {
    if (this.initialized) {
      return this.getStatus();
    }

    this.initialized = true;
    await offlineQueue.init();
    
    // Initialize multi-tab sync
    multiTabSync.init();
    
    // Set up multi-tab sync event listeners
    multiTabSync.addListener(this.handleMultiTabEvent.bind(this));
    
    // Set up network status monitoring
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Set up periodic sync (every 5 minutes when online)
    this.startPeriodicSync();
  }

  /**
   * Handle multi-tab sync events
   */
  handleMultiTabEvent(event, data, status) {
    switch (event) {
      case 'data_change':
        this.handleDataChangeFromOtherTab(data);
        break;
      case 'refresh_request':
        this.handleRefreshRequestFromOtherTab(data);
        break;
      case 'user_logout':
        this.handleUserLogoutFromOtherTab(data);
        break;
      case 'sync_complete':
        this.handleSyncCompleteFromOtherTab(data);
        break;
      case 'master_change':
        
        break;
    }
  }

  /**
   * Handle data change from other tabs
   */
  async handleDataChangeFromOtherTab(data) {
    
    
    // Trigger a refresh to sync the data
    try {
      await this.performSync();
      this.notifyListeners('data_synced', { source: 'multi_tab', data });
    } catch (error) {
      
    }
  }

  /**
   * Handle refresh request from other tabs
   */
  async handleRefreshRequestFromOtherTab(data) {
    
    
    // Only master tab should respond to refresh requests
    const syncStatus = multiTabSync.getStatus();
    if (syncStatus.isMaster) {
      try {
        await this.performSync();
        multiTabSync.notifySyncComplete({
          success: true,
          requesterTabId: data.requesterTabId,
          timestamp: Date.now()
        });
      } catch (error) {
        multiTabSync.notifySyncComplete({
          success: false,
          error: error.message,
          requesterTabId: data.requesterTabId,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Handle user logout from other tabs
   */
  handleUserLogoutFromOtherTab(data) {
    
    this.notifyListeners('user_logout', data);
  }

  /**
   * Handle sync completion from other tabs
   */
  handleSyncCompleteFromOtherTab(data) {
    
    this.notifyListeners('sync_complete', data);
  }

  /**
   * Handle coming back online
   */
  async handleOnline() {
    this.isOnline = true;
    this.notifyListeners('online');
    
    // Process any queued actions
    await this.processQueue();
    
    // Perform full sync
    await this.performSync();
  }

  /**
   * Handle going offline
   */
  handleOffline() {
    this.isOnline = false;
    this.notifyListeners('offline');
  }

  /**
   * Start periodic background sync
   */
  startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(async () => {
      if (this.isOnline && !this.syncInProgress) {
        await this.performSync();
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Process offline queue
   */
  async processQueue() {
    if (!this.isOnline) return;
    
    const processor = async (action, data, username) => {
      switch (action) {
        case 'save_entry':
          await this.syncSaveEntry(data, username);
          break;
        case 'delete_entry':
          await this.syncDeleteEntry(data, username);
          break;
        case 'update_settings':
          await this.syncUpdateSettings(data, username);
          break;
        default:
          
      }
    };
    
    return await offlineQueue.processQueue(processor);
  }

  /**
   * Perform full sync between storage systems
   */
  async performSync() {
    if (this.syncInProgress) {
      return;
    }
    
    this.syncInProgress = true;
    const syncStartTime = Date.now();
    
    try {
      // Sync from localStorage to IndexedDB (backup)
      await this.syncLocalStorageToIndexedDB();
      
      // Sync from IndexedDB to localStorage (restore)
      await this.syncIndexedDBToLocalStorage();
      
      // Process any queued actions
      if (this.isOnline) {
        await this.processQueue();
      }
      
      this.lastSyncTime = new Date().toISOString();
      
      const syncDuration = Date.now() - syncStartTime;
      
      this.notifyListeners('synced', { 
        duration: syncDuration,
        timestamp: this.lastSyncTime 
      });
      
    } catch (error) {
      
      this.notifyListeners('sync_error', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync localStorage data to IndexedDB (backup)
   */
  async syncLocalStorageToIndexedDB() {
    const keys = [
      'timeEntries', 'payPeriods', 'currentPeriodId',
      'fullName', 'salary', 'annualVacation', 'sickDays'
    ];
    
    for (const key of keys) {
      try {
        // For sensitive data, we need to get it differently
        let data;
        if (key === 'timeEntries' || key === 'payPeriods' || key === 'currentPeriodId') {
          // These are stored with encryption, skip for now to avoid JSON parse errors
          continue;
        } else {
          // Non-sensitive data can be loaded directly
          data = loadFromStorage(key);
        }
        
        if (data !== null) {
          // Store in IndexedDB as backup
          await offlineStorage.set(key, data, null, {
            source: 'localStorage',
            syncedAt: Date.now()
          });
        }
      } catch (error) {
        
      }
    }
  }

  /**
   * Sync IndexedDB data to localStorage (restore)
   */
  async syncIndexedDBToLocalStorage() {
    try {
      const allData = await offlineStorage.getAllForUser(null);
      
      for (const [key, data] of Object.entries(allData)) {
        try {
          // Check if localStorage has newer data
          const localData = loadFromStorage(key);
          
          if (localData === null || this.shouldUseRemoteData(key, data, localData)) {
            // Restore from IndexedDB
            saveToStorage(key, data);
            
          }
        } catch (error) {
          
        }
      }
    } catch (error) {
      
    }
  }

  /**
   * Determine which data to use in case of conflict
   */
  shouldUseRemoteData(key, remoteData, localData) {
    // If local data is null or undefined, use remote data
    if (localData === null || localData === undefined) {
      return true;
    }
    
    // If remote data is null or undefined, keep local data
    if (remoteData === null || remoteData === undefined) {
      return false;
    }
    
    // For time entries, check timestamps and data integrity
    if (key === 'timeEntries') {
      // If local data is empty array and remote has data, use remote
      if (Array.isArray(localData) && localData.length === 0 && 
          Array.isArray(remoteData) && remoteData.length > 0) {
        return true;
      }
      
      // If remote data is empty and local has data, keep local
      if (Array.isArray(remoteData) && remoteData.length === 0 && 
          Array.isArray(localData) && localData.length > 0) {
        return false;
      }
      
      // If both have data, we should ideally merge, but for this simple check
      // we prefer the one with the most recent entry modification
      if (Array.isArray(localData) && Array.isArray(remoteData)) {
        const getLatestTimestamp = (entries) => {
          if (!entries || entries.length === 0) return 0;
          return Math.max(...entries.map(entry => {
            const timestamp = entry.updated_at || entry.lastModified || entry.modifiedAt || entry.createdAt;
            return timestamp ? new Date(timestamp).getTime() : 0;
          }));
        };
        
        const localLatest = getLatestTimestamp(localData);
        const remoteLatest = getLatestTimestamp(remoteData);
        
        // Use remote only if it's strictly newer
        return remoteLatest > localLatest;
      }
    }
    
    // For other data types, implement similar logic
    if (key === 'payPeriods' && Array.isArray(localData) && Array.isArray(remoteData)) {
      // Prefer the dataset with more recent activity
      const getLatestPeriodTimestamp = (periods) => {
        if (!periods || periods.length === 0) return 0;
        return Math.max(...periods.map(period => {
          const timestamp = period.lastModified || period.modifiedAt || period.createdAt;
          return timestamp ? new Date(timestamp).getTime() : 0;
        }));
      };
      
      return getLatestPeriodTimestamp(remoteData) > getLatestPeriodTimestamp(localData);
    }
    
    // For simple data types, keep local (local wins strategy)
    return false;
  }

  /**
   * Sync save entry action
   */
  async syncSaveEntry(data, username) {
    try {
      // This would normally sync to a server
      // For now, just ensure it's saved locally
      const entries = loadFromStorage('timeEntries', username) || [];
      const updatedEntries = entries.filter(e => e.date !== data.date);
      updatedEntries.push(data);
      saveToStorage('timeEntries', updatedEntries, username);
      
      
    } catch (error) {
      throw new Error(`Failed to sync entry: ${error.message}`);
    }
  }

  /**
   * Sync delete entry action
   */
  async syncDeleteEntry(data, username) {
    try {
      // First, delete from localStorage
      const entries = loadFromStorage('timeEntries', username) || [];
      const updatedEntries = entries.filter(e => e.date !== data.date);
      saveToStorage('timeEntries', updatedEntries, username);
      
      // Then, try to delete from Supabase if online and user is not local-only
      if (this.isOnline) {
        try {
          // Import supabaseData dynamically to avoid circular dependencies
          const { supabaseData } = await import('./supabaseData.js');
          
          // Get current user to check if they're local-only
          const currentUserData = loadFromStorage('currentUser', username);
          
          if (currentUserData && !currentUserData.isLocalOnly && currentUserData.id) {
            await supabaseData.deleteTimeEntry({
              userId: currentUserData.id,
              date: data.date,
              id: data.id
            });
          }
        } catch (supabaseError) {
          console.warn(`Failed to delete entry ${data.date} from Supabase:`, supabaseError);
          // Entry is already deleted from localStorage, so we'll queue it for later sync
          await this.queueDeleteOperation(data, username);
        }
      } else {
        // Offline - queue the delete for later
        await this.queueDeleteOperation(data, username);
      }
      
    } catch (error) {
      throw new Error(`Failed to sync deletion: ${error.message}`);
    }
  }

  /**
   * Queue delete operation for offline sync
   */
  async queueDeleteOperation(data, username) {
    try {
      // Import offlineQueue dynamically
      const { offlineQueue } = await import('./offlineQueue.js');
      
      // Add delete operation to queue
      await offlineQueue.addAction('delete_entry', data, username);
    } catch (queueError) {
      console.warn(`Failed to queue delete operation:`, queueError);
    }
  }

  /**
   * Sync update settings action
   */
  async syncUpdateSettings(data, username) {
    try {
      const { type, value } = data;
      saveToStorage(type, value, username);
      
      
    } catch (error) {
      throw new Error(`Failed to sync settings: ${error.message}`);
    }
  }

  /**
   * Force immediate sync
   */
  async forceSync() {
    await this.performSync();
    return this.getStatus();
  }

  /**
   * Get sync status
   */
  getStatus() {
    const queueStatus = offlineQueue.getStatus();

    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      isSyncing: this.syncInProgress || !!queueStatus.isProcessing,
      lastSyncTime: this.lastSyncTime,
      queueStatus,
      queueLength: queueStatus.pending || queueStatus.queueLength || 0,
      pendingActions: []
    };
  }

  /**
   * Add event listener
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove event listener
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  /**
   * Notify listeners of sync events
   */
  notifyListeners(event, data = null) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data, this.getStatus());
      } catch (error) {
        
      }
    });
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
    
    // Cleanup multi-tab sync
    multiTabSync.destroy();
    this.initialized = false;
    
    
  }
}

// Export singleton instance
export const backgroundSync = new BackgroundSync();

// Export class for testing
export { BackgroundSync };
