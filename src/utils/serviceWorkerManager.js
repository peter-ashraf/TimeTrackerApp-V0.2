/**
 * Service Worker Manager for TimeTracker App
 * Handles registration, updates, and communication
 */

class ServiceWorkerManager {
  constructor() {
    this.swRegistration = null;
    this.isSupported = 'serviceWorker' in navigator;
    this.listeners = new Map();
  }

  /**
   * Register the service worker
   */
  async register() {
    if (!this.isSupported) {
      console.warn('Service Worker not supported');
      return false;
    }

    try {
      // Check if service worker file exists before registering
      const swUrl = '/sw.js';
      
      // Test if service worker file is accessible
      try {
        const response = await fetch(swUrl, { method: 'HEAD' });
        if (!response.ok) {
          console.warn('Service Worker file not accessible, skipping registration');
          return false;
        }
      } catch (fetchError) {
        console.warn('Service Worker file not found, skipping registration:', fetchError);
        return false;
      }

      this.swRegistration = await navigator.serviceWorker.register(swUrl, {
        scope: '/'
      });

      console.log('Service Worker registered:', this.swRegistration);

      // Listen for updates
      this.swRegistration.addEventListener('updatefound', () => {
        const newWorker = this.swRegistration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            this.notifyListeners('update_available', { newWorker });
          }
        });
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event);
      });

      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  /**
   * Handle messages from service worker
   */
  handleServiceWorkerMessage(event) {
    const { type, data } = event.data;

    switch (type) {
      case 'SYNC_COMPLETE':
        this.notifyListeners('sync_complete', data);
        break;
      case 'CACHE_UPDATED':
        this.notifyListeners('cache_updated', data);
        break;
      default:
        console.log('Unknown message type:', type);
    }
  }

  /**
   * Trigger background sync
   */
  async triggerSync(tag = 'sync-offline-requests') {
    if (!this.swRegistration) return false;

    try {
      await this.swRegistration.sync.register(tag);
      console.log('Background sync triggered:', tag);
      return true;
    } catch (error) {
      console.error('Background sync failed:', error);
      return false;
    }
  }

  /**
   * Check for service worker updates
   */
  async checkForUpdates() {
    if (!this.swRegistration) return false;

    try {
      await this.swRegistration.update();
      return true;
    } catch (error) {
      console.error('Service Worker update check failed:', error);
      return false;
    }
  }

  /**
   * Skip waiting and activate new service worker
   */
  async activateNewWorker() {
    if (!this.swRegistration || !this.swRegistration.waiting) return false;

    try {
      this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      return true;
    } catch (error) {
      console.error('Failed to activate new worker:', error);
      return false;
    }
  }

  /**
   * Get current service worker state
   */
  getState() {
    if (!this.swRegistration) {
      return { installed: false, active: false, waiting: false };
    }

    return {
      installed: true,
      active: !!this.swRegistration.active,
      waiting: !!this.swRegistration.waiting,
      installing: !!this.swRegistration.installing
    };
  }

  /**
   * Add event listener
   */
  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  removeListener(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Notify all listeners of an event
   */
  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Listener error:', error);
        }
      });
    }
  }

  /**
   * Clear all caches
   */
  async clearCaches() {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('All caches cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear caches:', error);
      return false;
    }
  }

  /**
   * Get cache size
   */
  async getCacheSize() {
    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        for (const request of requests) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
      }

      return {
        bytes: totalSize,
        formatted: this.formatBytes(totalSize)
      };
    } catch (error) {
      console.error('Failed to get cache size:', error);
      return { bytes: 0, formatted: '0 B' };
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Unregister service worker
   */
  async unregister() {
    if (!this.swRegistration) return true;

    try {
      await this.swRegistration.unregister();
      this.swRegistration = null;
      console.log('Service Worker unregistered');
      return true;
    } catch (error) {
      console.error('Failed to unregister service worker:', error);
      return false;
    }
  }
}

export const swManager = new ServiceWorkerManager();
export default swManager;
