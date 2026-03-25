/**
 * Multi-tab synchronization using BroadcastChannel API
 * Keeps data consistent across multiple browser tabs
 */

import { backgroundSync } from './backgroundSync.js';

class MultiTabSync {
  constructor() {
    this.channel = null;
    this.isSupported = 'BroadcastChannel' in window;
    this.tabId = this.generateTabId();
    this.listeners = [];
    this.isMaster = false;
    this.heartbeatInterval = null;
    this.lastHeartbeat = {};
  }

  /**
   * Initialize multi-tab sync
   */
  init() {
    if (!this.isSupported) {
      return;
    }

    try {
      this.channel = new BroadcastChannel('timetracker_sync');
      this.setupEventListeners();
      this.startHeartbeat();
      this.announceTab();
    } catch (error) {
      
    }
  }

  /**
   * Generate unique tab ID
   */
  generateTabId() {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup event listeners for broadcast channel
   */
  setupEventListeners() {
    this.channel.onmessage = (event) => {
      const { type, data, senderTabId, timestamp } = event.data;
      
      // Ignore messages from self
      if (senderTabId === this.tabId) return;
      
      this.handleMessage(type, data, senderTabId, timestamp);
    };
  }

  /**
   * Handle incoming broadcast messages
   */
  handleMessage(type, data, senderTabId, timestamp) {
    switch (type) {
      case 'tab_announce':
        this.handleTabAnnounce(senderTabId, timestamp);
        break;
      case 'heartbeat':
        this.handleHeartbeat(senderTabId, timestamp);
        break;
      case 'data_change':
        this.handleDataChange(data, senderTabId);
        break;
      case 'refresh_request':
        this.handleRefreshRequest(senderTabId);
        break;
      case 'user_logout':
        this.handleUserLogout(data, senderTabId);
        break;
      case 'sync_complete':
        this.handleSyncComplete(data, senderTabId);
        break;
      default:
        
    }
  }

  /**
   * Announce this tab to other tabs
   */
  announceTab() {
    this.broadcast('tab_announce', {
      tabId: this.tabId,
      timestamp: Date.now()
    });
  }

  /**
   * Start heartbeat to detect active tabs
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.broadcast('heartbeat', {
        tabId: this.tabId,
        timestamp: Date.now()
      });
      
      // Clean up old heartbeats
      this.cleanupOldHeartbeats();
      
      // Determine if this tab should be master
      this.updateMasterStatus();
    }, 5000); // Every 5 seconds
  }

  /**
   * Handle tab announcement
   */
  handleTabAnnounce(senderTabId, timestamp) {
    this.lastHeartbeat[senderTabId] = timestamp;
    
    // Announce back to establish two-way communication
    this.broadcast('tab_announce', {
      tabId: this.tabId,
      timestamp: Date.now()
    });
  }

  /**
   * Handle heartbeat from other tabs
   */
  handleHeartbeat(senderTabId, timestamp) {
    this.lastHeartbeat[senderTabId] = timestamp;
  }

  /**
   * Clean up old heartbeats (tabs that are no longer active)
   */
  cleanupOldHeartbeats() {
    const now = Date.now();
    const timeout = 15000; // 15 seconds
    
    Object.keys(this.lastHeartbeat).forEach(tabId => {
      if (now - this.lastHeartbeat[tabId] > timeout) {
        delete this.lastHeartbeat[tabId];
      }
    });
  }

  /**
   * Update master status (oldest tab becomes master)
   */
  updateMasterStatus() {
    const allTabs = [this.tabId, ...Object.keys(this.lastHeartbeat)];
    const oldestTab = allTabs.sort()[0];
    const wasMaster = this.isMaster;
    this.isMaster = oldestTab === this.tabId;
    
    if (this.isMaster !== wasMaster) {
      this.notifyListeners('master_change', { isMaster: this.isMaster });
    }
  }

  /**
   * Broadcast message to other tabs
   */
  broadcast(type, data) {
    if (!this.channel) return;
    
    try {
      this.channel.postMessage({
        type,
        data,
        senderTabId: this.tabId,
        timestamp: Date.now()
      });
    } catch (error) {
      
    }
  }

  /**
   * Notify other tabs of data change
   */
  notifyDataChange(dataType, data, username) {
    this.broadcast('data_change', {
      dataType,
      data,
      username,
      timestamp: Date.now()
    });
  }

  /**
   * Handle data change from other tabs
   */
  handleDataChange(data, senderTabId) {
    this.handleDataChangeFromOtherTab(data, senderTabId);
  }

  /**
   * Handle data change from other tabs
   */
  handleDataChangeFromOtherTab(data, senderTabId) {
    // Trigger a refresh to sync data
    try {
      this.notifyListeners('data_synced', { source: 'multi_tab', data });
    } catch (error) {
      
    }
  }

  /**
   * Request refresh from other tabs
   */
  requestRefresh() {
    this.broadcast('refresh_request', {
      requesterTabId: this.tabId
    });
  }

  /**
   * Handle refresh request from other tabs
   */
  handleRefreshRequest(senderTabId) {
    this.handleRefreshRequestFromOtherTab(senderTabId);
  }

  /**
   * Handle refresh request from other tabs
   */
  async handleRefreshRequestFromOtherTab(senderTabId) {
    // Only master tab should respond to refresh requests
    const syncStatus = this.getStatus();
    if (syncStatus.isMaster) {
      try {
        await backgroundSync.performSync();
        this.notifySyncComplete({
          success: true,
          requesterTabId: senderTabId,
          timestamp: Date.now()
        });
      } catch (error) {
        this.notifySyncComplete({
          success: false,
          error: error.message,
          requesterTabId: senderTabId,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Notify other tabs of user logout
   */
  notifyUserLogout(username) {
    this.broadcast('user_logout', {
      username,
      timestamp: Date.now()
    });
  }

  /**
   * Handle user logout from other tabs
   */
  handleUserLogout(data, senderTabId) {
    this.handleUserLogoutFromOtherTab(data, senderTabId);
  }

  /**
   * Handle user logout from other tabs
   */
  handleUserLogoutFromOtherTab(data, senderTabId) {
    this.notifyListeners('user_logout', data);
  }

  /**
   * Notify other tabs of sync completion
   */
  notifySyncComplete(syncResult) {
    this.broadcast('sync_complete', {
      syncResult,
      tabId: this.tabId
    });
  }

  /**
   * Handle sync completion from other tabs
   */
  handleSyncComplete(data, senderTabId) {
    this.notifyListeners('sync_complete', data);
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isSupported: this.isSupported,
      tabId: this.tabId,
      isMaster: this.isMaster,
      activeTabs: Object.keys(this.lastHeartbeat).length + 1, // +1 for this tab
      lastHeartbeats: { ...this.lastHeartbeat }
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
  notifyListeners(event, data) {
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
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.channel) {
      this.channel.close();
    }
  }
}

// Export singleton instance
export const multiTabSync = new MultiTabSync();

// Export class for testing
export { MultiTabSync };
