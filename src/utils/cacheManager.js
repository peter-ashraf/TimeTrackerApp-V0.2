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
      'timeEntries': 5 * 60 * 1000, // 5 minutes - fresh data
      'userProfile': 30 * 60 * 1000, // 30 minutes
      'payPeriods': 60 * 60 * 1000, // 1 hour
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
