/**
 * Enhanced background sync with proper PWA integration
 * Handles offline-to-online data synchronization
 */

class BackgroundSync {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncQueue = [];
    this.isSyncing = false;
    this.syncListeners = new Set();
    
    // Listen for network changes
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  /**
   * Initialize the sync system
   */
  async init() {
    console.log('Background sync initialized');
    
    // If online, process any pending syncs
    if (this.isOnline) {
      await this.processSyncQueue();
    }
  }

  /**
   * Handle coming online
   */
  async handleOnline() {
    console.log('Network connection restored');
    this.isOnline = true;
    
    // Wait a moment for stable connection
    setTimeout(() => {
      this.processSyncQueue();
    }, 1000);
    
    // Notify listeners
    this.notifyListeners('online');
  }

  /**
   * Handle going offline
   */
  handleOffline() {
    console.log('Network connection lost');
    this.isOnline = false;
    this.notifyListeners('offline');
  }

  /**
   * Add action to sync queue
   */
  queueAction(action) {
    const syncAction = {
      ...action,
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      retryCount: 0
    };
    
    this.syncQueue.push(syncAction);
    
    // Save to localStorage for persistence
    this.saveSyncQueue();
    
    // If online, try to process immediately
    if (this.isOnline) {
      setTimeout(() => this.processSyncQueue(), 100);
    }
  }

  /**
   * Process sync queue
   */
  async processSyncQueue() {
    if (!this.isOnline || this.isSyncing || this.syncQueue.length === 0) {
      return;
    }

    this.isSyncing = true;
    console.log(`Processing ${this.syncQueue.length} sync actions`);

    try {
      const actionsToProcess = [...this.syncQueue];
      
      for (const action of actionsToProcess) {
        try {
          await this.processAction(action);
          
          // Remove successful action from queue
          const index = this.syncQueue.findIndex(a => a.id === action.id);
          if (index > -1) {
            this.syncQueue.splice(index, 1);
          }
          
        } catch (error) {
          console.error('Failed to sync action:', error);
          
          // Increment retry count
          action.retryCount++;
          
          // Remove if max retries exceeded
          if (action.retryCount >= 3) {
            const index = this.syncQueue.findIndex(a => a.id === action.id);
            if (index > -1) {
              this.syncQueue.splice(index, 1);
              console.warn('Action removed after max retries:', action);
            }
          }
        }
      }
      
      // Save updated queue
      this.saveSyncQueue();
      
    } catch (error) {
      console.error('Sync process failed:', error);
    } finally {
      this.isSyncing = false;
      this.notifyListeners('sync-complete');
    }
  }

  /**
   * Process individual sync action
   */
  async processAction(action) {
    // This would integrate with your actual data sync logic
    console.log('Processing sync action:', action);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Return success (in real implementation, this would call your API)
    return true;
  }

  /**
   * Force sync all pending actions
   */
  async forceSync() {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }
    
    await this.processSyncQueue();
    return this.getStatus();
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      queueLength: this.syncQueue.length,
      pendingActions: [...this.syncQueue]
    };
  }

  /**
   * Save sync queue to localStorage
   */
  saveSyncQueue() {
    try {
      localStorage.setItem('tt_sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.warn('Failed to save sync queue:', error);
    }
  }

  /**
   * Load sync queue from localStorage
   */
  loadSyncQueue() {
    try {
      const saved = localStorage.getItem('tt_sync_queue');
      if (saved) {
        this.syncQueue = JSON.parse(saved);
        console.log(`Loaded ${this.syncQueue.length} pending sync actions`);
      }
    } catch (error) {
      console.warn('Failed to load sync queue:', error);
      this.syncQueue = [];
    }
  }

  /**
   * Clear sync queue
   */
  clearSyncQueue() {
    this.syncQueue = [];
    this.saveSyncQueue();
  }

  /**
   * Add sync event listener
   */
  addListener(callback) {
    this.syncListeners.add(callback);
  }

  /**
   * Remove sync event listener
   */
  removeListener(callback) {
    this.syncListeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  notifyListeners(event) {
    this.syncListeners.forEach(callback => {
      try {
        callback(event, this.getStatus());
      } catch (error) {
        console.error('Sync listener error:', error);
      }
    });
  }
}

// Create singleton instance
export const backgroundSync = new BackgroundSync();
export default backgroundSync;
