/**
 * IndexedDB storage utility for offline data persistence
 * Provides reliable storage that survives browser restarts and works offline
 */

const DB_NAME = 'TimeTrackerOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'timeTrackerData';

class OfflineStorage {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.initPromise = null;
  }

  /**
   * Initialize IndexedDB database
   */
  async init() {
    if (this.isInitialized) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('✅ IndexedDB initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object store for time tracker data
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('username', 'username', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('✅ Created IndexedDB object store');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Store data with metadata
   */
  async set(key, data, username = null, metadata = {}) {
    try {
      await this.init();
      
      const item = {
        key,
        data,
        username,
        timestamp: Date.now(),
        ...metadata
      };

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(item);

        request.onsuccess = () => {
          console.log(`✅ Stored ${key} in IndexedDB`);
          resolve(true);
        };

        request.onerror = () => {
          console.error(`❌ Failed to store ${key}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('❌ IndexedDB set error:', error);
      throw error;
    }
  }

  /**
   * Retrieve data by key
   */
  async get(key, username = null) {
    try {
      await this.init();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            // If username is specified, only return data for that user
            if (username && result.username !== username) {
              resolve(null);
              return;
            }
            resolve(result.data);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error(`❌ Failed to get ${key}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('❌ IndexedDB get error:', error);
      return null;
    }
  }

  /**
   * Get all data for a specific user
   */
  async getAllForUser(username) {
    try {
      await this.init();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('username');
        const request = index.getAll(username);

        request.onsuccess = () => {
          const results = request.result;
          const data = {};
          results.forEach(item => {
            data[item.key] = item.data;
          });
          resolve(data);
        };

        request.onerror = () => {
          console.error(`❌ Failed to get all data for ${username}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('❌ IndexedDB getAllForUser error:', error);
      return {};
    }
  }

  /**
   * Delete data by key
   */
  async delete(key) {
    try {
      await this.init();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => {
          console.log(`✅ Deleted ${key} from IndexedDB`);
          resolve(true);
        };

        request.onerror = () => {
          console.error(`❌ Failed to delete ${key}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('❌ IndexedDB delete error:', error);
      throw error;
    }
  }

  /**
   * Clear all data for a user
   */
  async clearUserData(username) {
    try {
      await this.init();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('username');
        const request = index.openCursor(IDBKeyRange.only(username));

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            console.log(`✅ Cleared all data for ${username}`);
            resolve(true);
          }
        };

        request.onerror = () => {
          console.error(`❌ Failed to clear data for ${username}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('❌ IndexedDB clearUserData error:', error);
      throw error;
    }
  }

  /**
   * Get storage size estimate
   */
  async getStorageSize() {
    try {
      await this.init();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          const results = request.result;
          const size = JSON.stringify(results).length;
          resolve(size);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('❌ IndexedDB getStorageSize error:', error);
      return 0;
    }
  }

  /**
   * Check if IndexedDB is available
   */
  static isSupported() {
    return 'indexedDB' in window && indexedDB !== null;
  }
}

// Export singleton instance
export const offlineStorage = new OfflineStorage();

// Export class for testing
export { OfflineStorage };
