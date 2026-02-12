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
    this.conflictResolution = 'local_wins'; // or 'remote_wins', 'merge', 'prompt'
  }

  /**
   * Initialize the sync service
   */
  async init() {
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
        console.log(`📡 Master tab changed: ${status.isMaster ? 'we are master' : 'another tab is master'}`);
        break;
    }
  }

  /**
   * Handle data change from other tabs
   */
  async handleDataChangeFromOtherTab(data) {
    console.log(`📡 Processing data change from other tab: ${data.dataType}`);
    
    // Trigger a refresh to sync the data
    try {
      await this.performSync();
      this.notifyListeners('data_synced', { source: 'multi_tab', data });
    } catch (error) {
      console.error('❌ Failed to sync data from other tab:', error);
    }
  }

  /**
   * Handle refresh request from other tabs
   */
  async handleRefreshRequestFromOtherTab(data) {
    console.log(`📡 Refresh request from tab: ${data.requesterTabId}`);
    
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
    console.log(`📡 User logout from other tab: ${data.username}`);
    this.notifyListeners('user_logout', data);
  }

  /**
   * Handle sync completion from other tabs
   */
  handleSyncCompleteFromOtherTab(data) {
    console.log(`📡 Sync completion from other tab:`, data);
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
          console.warn(`⚠️ Unknown queue action: ${action}`);
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
      console.error('❌ Background sync failed:', error);
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
        console.error(`❌ Failed to sync ${key} to IndexedDB:`, error);
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
            console.log(`🔄 Restored ${key} from IndexedDB`);
          }
        } catch (error) {
          console.error(`❌ Failed to restore ${key} from IndexedDB:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Failed to sync IndexedDB to localStorage:', error);
    }
  }

  /**
   * Determine which data to use in case of conflict
   */
  shouldUseRemoteData(key, remoteData, localData) {
    // For now, prefer localStorage (local wins)
    // This could be enhanced with timestamps, version numbers, etc.
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
      
      console.log(`✅ Synced entry for ${data.date}`);
    } catch (error) {
      throw new Error(`Failed to sync entry: ${error.message}`);
    }
  }

  /**
   * Sync delete entry action
   */
  async syncDeleteEntry(data, username) {
    try {
      const entries = loadFromStorage('timeEntries', username) || [];
      const updatedEntries = entries.filter(e => e.date !== data.date);
      saveToStorage('timeEntries', updatedEntries, username);
      
      console.log(`✅ Synced deletion of entry for ${data.date}`);
    } catch (error) {
      throw new Error(`Failed to sync deletion: ${error.message}`);
    }
  }

  /**
   * Sync update settings action
   */
  async syncUpdateSettings(data, username) {
    try {
      const { type, value } = data;
      saveToStorage(type, value, username);
      
      console.log(`✅ Synced setting ${type} for ${username}`);
    } catch (error) {
      throw new Error(`Failed to sync settings: ${error.message}`);
    }
  }

  /**
   * Force immediate sync
   */
  async forceSync() {
    return await this.performSync();
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      queueStatus: offlineQueue.getStatus()
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
        console.error('❌ Sync listener error:', error);
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
    
    console.log('🔄 Background sync service destroyed');
  }
}

// Export singleton instance
export const backgroundSync = new BackgroundSync();

// Export class for testing
export { BackgroundSync };
