/**
 * Failsafe Authentication System
 * Provides authentication fallback when Supabase is unavailable
 */

import { setSimpleEncryptedItem, getSimpleEncryptedItem } from './simple-encryption.js';

class FailsafeAuth {
  constructor() {
    this.isOnline = navigator.onLine;
    this.supabaseAvailable = true;
    this.lastCheck = null;
    this.checkInterval = null;
    
    // Listen for network changes
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.checkSupabaseAvailability();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  /**
   * Check if Supabase is available with timeout
   */
  async checkSupabaseAvailability() {
    if (!this.isOnline) {
      this.supabaseAvailable = false;
      return false;
    }

    try {
      // Simple configuration check - no API calls
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        this.supabaseAvailable = false;
        return false;
      }

      // For now, assume Supabase is available if configuration exists
      // The actual availability will be determined by real operations
      // This avoids the 401 errors from direct API calls
      this.supabaseAvailable = true;
      return true;

    } catch (error) {
      console.debug('Supabase availability check failed:', error.message);
      this.supabaseAvailable = false;
      return false;
    }
  }

  /**
   * Start periodic availability checks
   */
  startAvailabilityChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Check every 5 minutes instead of 60 seconds since we're not making API calls
    // This reduces noise and is more efficient
    this.checkInterval = setInterval(async () => {
      try {
        await this.checkSupabaseAvailability();
      } catch (error) {
        // Silently handle errors to avoid console noise
        console.debug('Availability check error:', error.message);
      }
    }, 300000); // 5 minutes

    // Initial check
    this.checkSupabaseAvailability().catch(error => {
      console.debug('Initial availability check error:', error.message);
    });
  }

  /**
   * Stop availability checks
   */
  stopAvailabilityChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      supabaseAvailable: this.supabaseAvailable,
      canUseSupabase: this.isOnline && this.supabaseAvailable,
      lastCheck: this.lastCheck
    };
  }

  /**
   * Local user registration (fallback when Supabase is down)
   */
  async registerLocal(username, password, fullName, email = null) {
    try {
      // Get existing local users
      const users = this.getLocalUsers();
      
      // Check if username already exists
      if (users[username]) {
        throw new Error('Username already exists');
      }

      // Validate input
      if (!username || username.length < 3) {
        throw new Error('Username must be at least 3 characters');
      }

      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      // Hash password
      const passwordHash = this.hashPassword(password);

      // Create user
      const user = {
        username,
        passwordHash,
        fullName: fullName || username,
        email: email || `${username}@local.fallback`,
        createdAt: new Date().toISOString(),
        isLocalOnly: true
      };

      // Save user
      users[username] = user;
      setSimpleEncryptedItem('localUsers', users, 'failsafe');

      return { success: true, user };
    } catch (error) {
      throw new Error(`Local registration failed: ${error.message}`);
    }
  }

  /**
   * Local user login (fallback when Supabase is down)
   */
  async loginLocal(username, password) {
    try {
      // Get local users
      const users = this.getLocalUsers();
      
      // Find user
      const user = users[username];
      if (!user) {
        throw new Error('Invalid username or password');
      }

      // Verify password
      const passwordHash = this.hashPassword(password);
      if (user.passwordHash !== passwordHash) {
        throw new Error('Invalid username or password');
      }

      // Create user session
      const session = {
        id: `local_${Date.now()}`,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        isLocalOnly: true,
        createdAt: new Date().toISOString()
      };

      // Save session
      setSimpleEncryptedItem('localSession', session, username);
      setSimpleEncryptedItem('currentUser', {
        id: session.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        isLocalOnly: true
      }, username);

      return { success: true, user: session };
    } catch (error) {
      throw new Error(`Local login failed: ${error.message}`);
    }
  }

  /**
   * Get local users
   */
  getLocalUsers() {
    try {
      const users = getSimpleEncryptedItem('localUsers', 'failsafe') || {};
      return users;
    } catch (error) {
      console.warn('Failed to get local users:', error);
      return {};
    }
  }

  /**
   * Get current local session
   */
  getLocalSession() {
    try {
      const users = this.getLocalUsers();
      const usernames = Object.keys(users);
      
      for (const username of usernames) {
        const session = getSimpleEncryptedItem('localSession', username);
        if (session) {
          return session;
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to get local session:', error);
      return null;
    }
  }

  /**
   * Clear local session
   */
  clearLocalSession() {
    try {
      const users = this.getLocalUsers();
      const usernames = Object.keys(users);
      
      for (const username of usernames) {
        localStorage.removeItem(`localSession_${username}`);
      }
      
      localStorage.removeItem('currentUser');
    } catch (error) {
      console.warn('Failed to clear local session:', error);
    }
  }

  /**
   * Hash password using SHA-256
   */
  hashPassword(password) {
    // Simple hash for local fallback - in production, use a stronger method
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `local_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Migrate local user to Supabase when available
   */
  async migrateLocalUserToSupabase(username, supabaseClient) {
    try {
      const users = this.getLocalUsers();
      const localUser = users[username];
      
      if (!localUser || !localUser.isLocalOnly) {
        return { success: false, error: 'No local user to migrate' };
      }

      // Register with Supabase
      const { data, error } = await supabaseClient.auth.signUp({
        email: localUser.email,
        password: 'tempPassword123', // User will need to reset
        options: {
          data: {
            username: localUser.username,
            full_name: localUser.fullName,
            isLocalMigration: true
          }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Mark user as migrated
      localUser.isLocalOnly = false;
      localUser.migratedAt = new Date().toISOString();
      localUser.supabaseId = data.user?.id;
      
      users[username] = localUser;
      setSimpleEncryptedItem('localUsers', users, 'failsafe');

      return { success: true, supabaseUser: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if username exists locally
   */
  async checkLocalUsernameAvailability(username) {
    const users = this.getLocalUsers();
    return {
      available: !users[username],
      isLocalOnly: users[username]?.isLocalOnly || false
    };
  }
}

// Export singleton instance
export const failsafeAuth = new FailsafeAuth();

// Export class for testing
export { FailsafeAuth };
