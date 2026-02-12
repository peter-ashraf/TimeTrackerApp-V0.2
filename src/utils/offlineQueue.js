/**
 * Offline queue for pending network requests
 * Stores actions that need to be synced when back online
 */

import { offlineStorage } from './offlineStorage.js';

const QUEUE_KEY = 'offlineQueue';
const MAX_QUEUE_SIZE = 1000;

class OfflineQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.listeners = [];
  }

  /**
   * Initialize the queue from storage
   */
  async init() {
    try {
      const stored = await offlineStorage.get(QUEUE_KEY);
      this.queue = stored || [];
      console.log(`📋 Loaded ${this.queue.length} items from offline queue`);
    } catch (error) {
      console.error('❌ Failed to initialize offline queue:', error);
      this.queue = [];
    }
  }

  /**
   * Add an action to the queue
   */
  async addAction(action, data, username = null, priority = 'normal') {
    const queueItem = {
      id: this.generateId(),
      action,
      data,
      username,
      priority,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 3,
      status: 'pending'
    };

    // Add to queue based on priority
    if (priority === 'high') {
      this.queue.unshift(queueItem);
    } else {
      this.queue.push(queueItem);
    }

    // Limit queue size
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
    }

    await this.saveQueue();
    this.notifyListeners('added', queueItem);
    
    console.log(`➕ Added to queue: ${action} (ID: ${queueItem.id})`);
    return queueItem.id;
  }

  /**
   * Process the queue when online
   */
  async processQueue(processor) {
    if (this.isProcessing || this.queue.length === 0) {
      return { processed: 0, failed: 0 };
    }

    this.isProcessing = true;
    let processed = 0;
    let failed = 0;

    console.log(`🔄 Processing ${this.queue.length} queued actions...`);

    try {
      const pendingItems = this.queue.filter(item => item.status === 'pending');
      
      for (const item of pendingItems) {
        try {
          item.status = 'processing';
          await this.saveQueue();

          await processor(item.action, item.data, item.username);
          
          // Mark as completed
          item.status = 'completed';
          item.completedAt = Date.now();
          processed++;
          
          console.log(`✅ Processed: ${item.action} (ID: ${item.id})`);
          
        } catch (error) {
          item.retries++;
          item.lastError = error.message;
          
          if (item.retries >= item.maxRetries) {
            item.status = 'failed';
            failed++;
            console.error(`❌ Failed permanently: ${item.action} (ID: ${item.id})`, error);
          } else {
            item.status = 'pending';
            console.warn(`⚠️ Retry ${item.retries}/${item.maxRetries}: ${item.action} (ID: ${item.id})`);
          }
        }

        await this.saveQueue();
        this.notifyListeners('processed', item);
      }

      // Clean up completed items older than 1 hour
      await this.cleanup();

    } finally {
      this.isProcessing = false;
    }

    console.log(`🏁 Queue processing complete: ${processed} processed, ${failed} failed`);
    return { processed, failed };
  }

  /**
   * Get queue status
   */
  getStatus() {
    const pending = this.queue.filter(item => item.status === 'pending').length;
    const processing = this.queue.filter(item => item.status === 'processing').length;
    const completed = this.queue.filter(item => item.status === 'completed').length;
    const failed = this.queue.filter(item => item.status === 'failed').length;

    return {
      total: this.queue.length,
      pending,
      processing,
      completed,
      failed,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Get pending items for a specific user
   */
  getPendingForUser(username) {
    return this.queue.filter(item => 
      item.username === username && item.status === 'pending'
    );
  }

  /**
   * Clear completed items
   */
  async clearCompleted() {
    this.queue = this.queue.filter(item => item.status !== 'completed');
    await this.saveQueue();
    console.log('🧹 Cleared completed items from queue');
  }

  /**
   * Retry failed items
   */
  async retryFailed() {
    const failedItems = this.queue.filter(item => item.status === 'failed');
    failedItems.forEach(item => {
      item.status = 'pending';
      item.retries = 0;
      item.lastError = null;
    });
    await this.saveQueue();
    console.log(`🔄 Reset ${failedItems.length} failed items to pending`);
  }

  /**
   * Save queue to storage
   */
  async saveQueue() {
    try {
      await offlineStorage.set(QUEUE_KEY, this.queue);
    } catch (error) {
      console.error('❌ Failed to save queue:', error);
    }
  }

  /**
   * Clean up old completed items
   */
  async cleanup() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const originalLength = this.queue.length;
    
    this.queue = this.queue.filter(item => {
      if (item.status === 'completed' && item.completedAt) {
        return item.completedAt > oneHourAgo;
      }
      return true;
    });

    if (this.queue.length !== originalLength) {
      await this.saveQueue();
      console.log(`🧹 Cleaned up ${originalLength - this.queue.length} old completed items`);
    }
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
   * Notify listeners of queue events
   */
  notifyListeners(event, item) {
    this.listeners.forEach(callback => {
      try {
        callback(event, item, this.getStatus());
      } catch (error) {
        console.error('❌ Queue listener error:', error);
      }
    });
  }

  /**
   * Generate unique ID for queue items
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export queue for debugging
   */
  exportQueue() {
    return {
      items: [...this.queue],
      status: this.getStatus()
    };
  }

  /**
   * Clear entire queue (for debugging/reset)
   */
  async clearQueue() {
    this.queue = [];
    await this.saveQueue();
    console.log('🗑️ Cleared entire queue');
  }
}

// Export singleton instance
export const offlineQueue = new OfflineQueue();

// Export class for testing
export { OfflineQueue };
