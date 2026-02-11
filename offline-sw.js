// Custom service worker for offline queuing functionality
// This extends the generated Workbox service worker

const OFFLINE_QUEUE_NAME = 'offline-requests';
const SYNC_QUEUE_NAME = 'sync-queue';

// Queue for storing failed requests when offline
class OfflineQueue {
  constructor() {
    this.dbName = 'offlineQueueDB';
    this.dbVersion = 1;
    this.db = null;
    this.initDB();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(OFFLINE_QUEUE_NAME)) {
          db.createObjectStore(OFFLINE_QUEUE_NAME, { autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(SYNC_QUEUE_NAME)) {
          db.createObjectStore(SYNC_QUEUE_NAME, { autoIncrement: true });
        }
      };
    });
  }

  async addRequest(request) {
    if (!this.db) await this.initDB();
    
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([OFFLINE_QUEUE_NAME], 'readwrite');
      const store = transaction.objectStore(OFFLINE_QUEUE_NAME);
      const addRequest = store.add(requestData);
      
      addRequest.onsuccess = () => resolve(addRequest.result);
      addRequest.onerror = () => reject(addRequest.error);
    });
  }

  async getQueuedRequests() {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([OFFLINE_QUEUE_NAME], 'readonly');
      const store = transaction.objectStore(OFFLINE_QUEUE_NAME);
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  }

  async removeRequest(id) {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([OFFLINE_QUEUE_NAME], 'readwrite');
      const store = transaction.objectStore(OFFLINE_QUEUE_NAME);
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => resolve(deleteRequest.result);
      deleteRequest.onerror = () => reject(deleteRequest.error);
    });
  }

  async clearQueue() {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([OFFLINE_QUEUE_NAME], 'readwrite');
      const store = transaction.objectStore(OFFLINE_QUEUE_NAME);
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => resolve(clearRequest.result);
      clearRequest.onerror = () => reject(clearRequest.error);
    });
  }
}

const offlineQueue = new OfflineQueue();

// Intercept fetch requests and queue them if offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only queue API requests, not static assets
  if (url.pathname.startsWith('/api/') || url.pathname.includes('timesheet')) {
    event.respondWith(
      fetch(event.request).catch(async (error) => {
        console.log('Network request failed, queuing for later:', event.request.url);
        
        // Queue the request for when we're back online
        await offlineQueue.addRequest(event.request.clone());
        
        // Return a cached response or offline fallback
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Request queued for when you\'re back online',
            queued: true 
          }),
          {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
  }
});

// Sync queued requests when we come back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-requests') {
    event.waitUntil(syncQueuedRequests());
  }
});

// Handle background sync for queued requests
async function syncQueuedRequests() {
  try {
    const queuedRequests = await offlineQueue.getQueuedRequests();
    
    for (const request of queuedRequests) {
      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body
        });

        if (response.ok) {
          await offlineQueue.removeRequest(request.id);
          console.log('Successfully synced queued request:', request.url);
        } else {
          console.warn('Failed to sync queued request:', request.url, response.status);
        }
      } catch (error) {
        console.error('Error syncing queued request:', request.url, error);
      }
    }

    // Notify clients about sync completion
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        success: true
      });
    });

  } catch (error) {
    console.error('Error during sync:', error);
  }
}

// Listen for online/offline events
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ONLINE_STATUS_CHANGE') {
    if (event.data.isOnline) {
      // Trigger sync when we come back online
      self.registration.sync.register('sync-offline-requests');
    }
  }
});

// Periodic sync for pending requests
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'periodic-sync') {
    event.waitUntil(syncQueuedRequests());
  }
});

// Handle push notifications for sync status
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    if (data.type === 'SYNC_STATUS') {
      event.waitUntil(
        self.registration.showNotification('TimeTracker Sync', {
          body: data.message,
          icon: '/icons/icon.png',
          badge: '/icons/badge.png'
        })
      );
    }
  }
});

// Install event
self.addEventListener('install', (event) => {
  console.log('Offline service worker installing');
  event.waitUntil(self.skipWaiting());
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Offline service worker activating');
  event.waitUntil(self.clients.claim());
});
