/**
 * Aggressive caching manager for instant app loading
 * Implements cache-first strategy with intelligent background refresh
 */

class CacheManager {
  constructor() {
    this.cacheVersion = '2.0.0';
    this.cachePrefix = 'tt_cache_';
    this.isOnline = navigator.onLine;
    this.refreshQueue = new Map();
    this.lastCacheUpdate = null;
    
    // Clear old version cache on initialization
    this.clearOldVersionCache();
    
    // Listen for network changes
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processRefreshQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  /**
   * Get cached data with instant fallback
   */
  async getCachedData(key, fallbackData = null) {
    try {
      const cacheKey = `${this.cachePrefix}${key}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) {
        return fallbackData;
      }

      const { data, timestamp, version } = JSON.parse(cached);
      
      // Check if cache is valid (same version, not too old)
      const maxAge = this.getMaxAge(key);
      const isExpired = Date.now() - timestamp > maxAge;
      
      if (version !== this.cacheVersion) {
        // Cache version mismatch, clear and use fallback
        console.log(`Cache version mismatch for ${key}: expected ${this.cacheVersion}, got ${version}`);
        localStorage.removeItem(cacheKey);
        return fallbackData;
      }

      // Return cached data immediately, queue refresh if expired
      if (isExpired && this.isOnline) {
        this.queueRefresh(key);
      }

      return data;
    } catch (error) {
      console.warn(`Cache error for ${key}:`, error);
      return fallbackData;
    }
  }

  /**
   * Set cached data with metadata
   */
  setCachedData(key, data) {
    try {
      const cacheKey = `${this.cachePrefix}${key}`;
      const cacheData = {
        data,
        timestamp: Date.now(),
        version: this.cacheVersion
      };

      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      this.lastCacheUpdate = Date.now();
    } catch (error) {
      console.warn(`Failed to cache ${key}:`, error);
    }
  }

  /**
   * Get maximum age for different cache types
   */
  getMaxAge(key) {
    const ages = {
      'timeEntries': 24 * 60 * 60 * 1000, // 24 hours - for offline access
      'userProfile': 30 * 60 * 1000, // 30 minutes
      'payPeriods': 7 * 24 * 60 * 60 * 1000, // 7 days - for offline access
      'currentPeriod': Number.MAX_SAFE_INTEGER, // Never expire - refresh only when online
      'currentPeriodEntries': Number.MAX_SAFE_INTEGER, // Never expire - refresh only when online
      'periodEntries': 60 * 60 * 1000, // 1 hour - for non-current period entries
      'leaveSettings': 60 * 60 * 1000, // 1 hour
      'dashboardStats': 5 * 60 * 1000, // 5 minutes
      'default': 24 * 60 * 60 * 1000 // 24 hours
    };

    return ages[key] || ages.default;
  }

  /**
   * Queue data for background refresh
   */
  queueRefresh(key) {
    if (!this.refreshQueue.has(key)) {
      this.refreshQueue.set(key, {
        timestamp: Date.now(),
        retryCount: 0
      });
    }
  }

  /**
   * Process refresh queue when online
   */
  async processRefreshQueue() {
    if (!this.isOnline) return;

    for (const [key, metadata] of this.refreshQueue.entries()) {
      try {
        await this.refreshData(key);
        this.refreshQueue.delete(key);
      } catch (error) {
        metadata.retryCount++;
        if (metadata.retryCount >= 3) {
          this.refreshQueue.delete(key);
        }
      }
    }
  }

  /**
   * Refresh specific data type
   */
  async refreshData(key) {
    // This will be implemented by the calling context
    // The cache manager just provides the framework
    console.log(`Refreshing ${key}...`);
  }

  /**
   * Preload essential data for instant UI
   */
  async preloadEssentialData(userId) {
    const essentialKeys = [
      'timeEntries',
      'userProfile', 
      'payPeriods',
      'leaveSettings'
    ];

    const preloadPromises = essentialKeys.map(key => 
      this.getCachedData(key, this.getDefaultData(key))
    );

    try {
      const results = await Promise.all(preloadPromises);
      return essentialKeys.reduce((acc, key, index) => {
        acc[key] = results[index];
        return acc;
      }, {});
    } catch (error) {
      console.warn('Preload failed:', error);
      return {};
    }
  }

  /**
   * Get default data for fallback
   */
  getDefaultData(key) {
    const defaults = {
      'timeEntries': [],
      'userProfile': { fullName: '', salary: 0 },
      'payPeriods': [],
      'leaveSettings': { annualVacation: 10, sickDays: 7 },
      'dashboardStats': { totalHours: 0, totalEntries: 0 }
    };
    
    return defaults[key] || null;
  }

  /**
   * Clear old version cache to prevent conflicts
   */
  clearOldVersionCache() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.cachePrefix)) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const { version } = JSON.parse(cached);
            if (version !== this.cacheVersion) {
              console.log(`Clearing old cache version: ${key}`);
              localStorage.removeItem(key);
            }
          }
        } catch (error) {
          // Remove corrupted cache entries
          localStorage.removeItem(key);
        }
      }
    });
  }

  /**
   * Intelligent data sync with differential updates
   */
  async intelligentSync(key, newData, options = {}) {
    const { forceUpdate = false, mergeStrategy = 'smart' } = options;
    
    try {
      const cacheKey = `${this.cachePrefix}${key}`;
      const existing = this.getCachedData(key);
      
      if (!forceUpdate && existing && this.shouldSkipSync(key, existing, newData)) {
        console.log(`Skipping sync for ${key} - data unchanged`);
        return existing;
      }

      const mergedData = this.mergeData(existing, newData, mergeStrategy);
      this.setCachedData(key, mergedData);
      
      return mergedData;
    } catch (error) {
      console.warn(`Intelligent sync failed for ${key}:`, error);
      return newData;
    }
  }

  /**
   * Determine if sync can be skipped based on data comparison
   */
  shouldSkipSync(key, existing, newData) {
    if (!existing || !newData) return false;
    
    // For arrays (like timeEntries), compare length and last modified
    if (Array.isArray(existing) && Array.isArray(newData)) {
      if (existing.length !== newData.length) return false;
      
      // Compare last items (assuming sorted by date)
      const lastExisting = existing[existing.length - 1];
      const lastNew = newData[newData.length - 1];
      
      if (lastExisting?.updated_at === lastNew?.updated_at) {
        return true;
      }
    }
    
    // For objects, compare version/timestamp fields
    if (typeof existing === 'object' && typeof newData === 'object') {
      if (existing.updated_at === newData.updated_at ||
          existing.version === newData.version ||
          existing.lastModified === newData.lastModified) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Merge data based on strategy
   */
  mergeData(existing, newData, strategy) {
    switch (strategy) {
      case 'replace':
        return newData;
        
      case 'merge':
        if (Array.isArray(existing) && Array.isArray(newData)) {
          // Merge arrays, removing duplicates
          const merged = [...existing];
          newData.forEach(item => {
            const existingIndex = merged.findIndex(existingItem => 
              existingItem.id === item.id
            );
            if (existingIndex >= 0) {
              merged[existingIndex] = item;
            } else {
              merged.push(item);
            }
          });
          return merged.sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        return { ...existing, ...newData };
        
      case 'smart':
      default:
        if (Array.isArray(existing) && Array.isArray(newData)) {
          // Smart merge: only update changed items
          return this.smartMergeArrays(existing, newData);
        }
        return this.smartMergeObjects(existing, newData);
    }
  }

  /**
   * Smart merge for arrays (timeEntries, etc.)
   */
  smartMergeArrays(existing, newData) {
    const merged = [...existing];
    
    newData.forEach(newItem => {
      const existingIndex = merged.findIndex(existingItem => 
        existingItem.id === newItem.id
      );
      
      if (existingIndex >= 0) {
        // Only update if data has actually changed
        if (this.hasItemChanged(merged[existingIndex], newItem)) {
          merged[existingIndex] = newItem;
        }
      } else {
        // Add new items
        merged.push(newItem);
      }
    });
    
    // Sort by date (newest first)
    return merged.sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || b.created_at));
  }

  /**
   * Smart merge for objects
   */
  smartMergeObjects(existing, newData) {
    const merged = { ...existing };
    
    Object.keys(newData).forEach(key => {
      if (existing[key] !== newData[key]) {
        merged[key] = newData[key];
      }
    });
    
    return merged;
  }

  /**
   * Check if an item has meaningful changes
   */
  hasItemChanged(existing, newItem) {
    const fieldsToCompare = ['updated_at', 'status', 'hours', 'notes', 'date'];
    return fieldsToCompare.some(field => existing[field] !== newItem[field]);
  }

  /**
   * Clear all cache (for logout)
   */
  clearCache() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.cachePrefix)) {
        localStorage.removeItem(key);
      }
    });
    this.refreshQueue.clear();
  }

  /**
   * Get cache status
   */
  getCacheStatus() {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(this.cachePrefix)
    );
    
    return {
      cacheCount: keys.length,
      lastUpdate: this.lastCacheUpdate,
      queueSize: this.refreshQueue.size,
      isOnline: this.isOnline
    };
  }
}

export const cacheManager = new CacheManager();
export default cacheManager;
