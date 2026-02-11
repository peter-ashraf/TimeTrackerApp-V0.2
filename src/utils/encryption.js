import CryptoJS from 'crypto-js';

// Sensitive data fields that should be encrypted
const SENSITIVE_FIELDS = [
  'users',
  'currentUser',
  /^salary_.*/,
  /^fullName_.*/,
  /^timeEntries_.*/,
  /^payPeriods_.*/,
  /^annualVacation_.*/,
  /^sickDays_.*/,
  /^currentPeriodId_.*$/
];

// Non-sensitive fields that should remain unencrypted
const NON_SENSITIVE_FIELDS = [
  'theme',
  'use12HourFormat',
  'detailedView',
  'hideSalary',
  'migrationVersion',
  'lastBackupDate',
  'dismissedBackupReminder',
  'navigateToExport',
  'hapticFeedbackEnabled'
];

/**
 * Generate a secure encryption key based on user and device fingerprint
 */
export function generateEncryptionKey(username, useLegacyKey = false) {
  try {
    if (useLegacyKey) {
      // Legacy key generation for backward compatibility
      const fingerprint = [
        navigator.userAgent || '',
        navigator.language || '',
        navigator.platform || '',
        screen.width || '',
        screen.height || '',
        screen.colorDepth || '',
        new Date().getTimezoneOffset() || '',
        localStorage.getItem('theme') || '',
        localStorage.getItem('use12HourFormat') || ''
      ].join('|');

      const combinedSeed = `${username || 'anonymous'}@${fingerprint}`;
      const key = CryptoJS.SHA256(combinedSeed).toString();
      return key;
    }

    // Create a completely stable key that only depends on username and localStorage
    // This eliminates all browser-dependent properties that change between modes
    const stableFingerprint = [
      localStorage.getItem('theme') || 'default',
      localStorage.getItem('use12HourFormat') || 'false'
    ].join('|');

    // Use a consistent separator and format
    const combinedSeed = `${username}@stable:${stableFingerprint}`;
    
    // Generate a 256-bit (32 bytes) key using SHA-256
    const key = CryptoJS.SHA256(combinedSeed).toString();
    
    return key;
  } catch (error) {
    console.error('Error generating encryption key:', error);
    // Fallback to username-only key generation
    return CryptoJS.SHA256(`${username}@fallback`).toString();
  }
}

/**
 * Check if a localStorage key should be encrypted
 */
export function isSensitiveField(key) {
  // Check if key is in non-sensitive list (exact match)
  if (NON_SENSITIVE_FIELDS.includes(key)) {
    return false;
  }
  
  // Check if key matches any sensitive patterns
  return SENSITIVE_FIELDS.some(pattern => {
    if (typeof pattern === 'string') {
      return key === pattern;
    } else if (pattern instanceof RegExp) {
      return pattern.test(key);
    }
    return false;
  });
}

/**
 * Encrypt data using AES-256
 */
export function encryptData(data, key) {
  try {
    if (!data || data === null || data === undefined) {
      return data;
    }

    // Convert data to string if it's not already
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Encrypt using AES-256
    const encrypted = CryptoJS.AES.encrypt(dataString, key).toString();
    
    // Add a prefix to identify encrypted data
    return `encrypted:${encrypted}`;
  } catch (error) {
    console.error('Error encrypting data:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data using AES-256
 */
export function decryptData(encryptedData, key) {
  try {
    if (!encryptedData || encryptedData === null || encryptedData === undefined) {
      return encryptedData;
    }

    // Check if data is encrypted
    if (typeof encryptedData !== 'string' || !encryptedData.startsWith('encrypted:')) {
      // Data is not encrypted, return as-is
      return encryptedData;
    }

    // Remove the encryption prefix
    const encrypted = encryptedData.substring(10); // Remove 'encrypted:'
    
    // Decrypt using AES-256
    const decrypted = CryptoJS.AES.decrypt(encrypted, key);
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedString) {
      throw new Error('Decryption failed - invalid key or corrupted data');
    }
    
    // Try to parse as JSON, fallback to string if parsing fails
    try {
      return JSON.parse(decryptedString);
    } catch (parseError) {
      return decryptedString;
    }
  } catch (error) {
    // Silently throw error to be caught by getEncryptedItem
    throw new Error('Malformed UTF-8 data');
  }
}

/**
 * Set encrypted data to localStorage
 */
export function setEncryptedItem(key, data, username) {
  try {
    if (isSensitiveField(key)) {
      const encryptionKey = generateEncryptionKey(username);
      const encryptedData = encryptData(data, encryptionKey);
      localStorage.setItem(key, encryptedData);
    } else {
      // Store non-sensitive data as-is
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      localStorage.setItem(key, dataString);
    }
    return true;
  } catch (error) {
    console.error('Error setting encrypted item:', error);
    return false;
  }
}

/**
 * Get and decrypt data from localStorage
 */
export function getEncryptedItem(key, username) {
  try {
    const data = localStorage.getItem(key);
    if (data === null) {
      return null;
    }

    if (isSensitiveField(key)) {
      // For sensitive data, username is required (except for 'users' key which we handle specially)
      if (!username && key !== 'users') {
        console.warn(`Username required for sensitive key: ${key}`);
        return null;
      }
      
      // Special handling for 'users' key - try multiple approaches
      if (key === 'users') {
        console.log('🔍 Special handling for users data...');
        
        // Try the provided username first
        if (username) {
          const newKey = generateEncryptionKey(username);
          try {
            const result = decryptData(data, newKey);
            if (result !== data) {
              console.log(`✅ Users data decrypted with username: ${username}`);
              return result;
            }
          } catch (decryptError) {
            console.log(`❌ Failed to decrypt users with ${username}`);
          }
          
          // Try legacy key for this username
          const legacyKey = generateEncryptionKey(username, true);
          try {
            const result = decryptData(data, legacyKey);
            if (result !== data) {
              console.log(`✅ Users data decrypted with legacy key for: ${username}`);
              // Re-encrypt with new key
              setEncryptedItem(key, result, username);
              return result;
            }
          } catch (legacyDecryptError) {
            console.log(`❌ Failed legacy key for ${username}`);
          }
        }
        
        // If username approach failed, try to find any user that can decrypt it
        const allKeys = Object.keys(localStorage);
        const userSpecificKeys = allKeys.filter(k => 
          k.includes('_') && !k.startsWith('__') && k !== 'users' && k !== 'currentUser'
        );
        
        const potentialUsernames = [...new Set(
          userSpecificKeys.map(k => {
            const parts = k.split('_');
            return parts.length > 1 ? parts.slice(1).join('_') : null;
          }).filter(Boolean)
        )];
        
        console.log('🔍 Trying usernames for users data:', potentialUsernames);
        
        for (const potentialUsername of potentialUsernames) {
          // Try new key first
          const newKey = generateEncryptionKey(potentialUsername);
          try {
            const result = decryptData(data, newKey);
            if (result !== data) {
              console.log(`✅ Users data decrypted with username: ${potentialUsername}`);
              // Re-encrypt with this username
              setEncryptedItem(key, result, potentialUsername);
              return result;
            }
          } catch (decryptError) {
            // Try legacy key
            const legacyKey = generateEncryptionKey(potentialUsername, true);
            try {
              const result = decryptData(data, legacyKey);
              if (result !== data) {
                console.log(`✅ Users data decrypted with legacy key for: ${potentialUsername}`);
                // Re-encrypt with new key
                setEncryptedItem(key, result, potentialUsername);
                return result;
              }
            } catch (legacyDecryptError) {
              continue;
            }
          }
        }
        
        console.log('❌ Could not decrypt users data with any available key');
        return null;
      }
      
      // Regular handling for other sensitive data
      // Try the new stable key first
      const newKey = generateEncryptionKey(username);
      try {
        const result = decryptData(data, newKey);
        if (result !== data) { // Successfully decrypted
          return result;
        }
      } catch (decryptError) {
        // New key failed, try legacy key
      }
      
      // Try legacy key for backward compatibility
      const legacyKey = generateEncryptionKey(username, true);
      try {
        const result = decryptData(data, legacyKey);
        if (result !== data) { // Successfully decrypted with legacy key
          console.log(`🔓 Successfully decrypted ${key} with legacy key, migrating to new key...`);
          // Re-encrypt with new key for future use
          setEncryptedItem(key, result, username);
          return result;
        }
      } catch (legacyDecryptError) {
        // Both keys failed
      }
      
      // Silently handle decryption errors - don't even log to console to avoid noise
      // This prevents corrupted data from breaking the login flow
      return null;
    } else {
      // Return non-sensitive data as-is, try to parse JSON
      try {
        return JSON.parse(data);
      } catch (parseError) {
        return data;
      }
    }
  } catch (error) {
    // Silently handle all errors
    return null;
  }
}

/**
 * Remove item from localStorage
 */
export function removeEncryptedItem(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Error removing encrypted item:', error);
    return false;
  }
}

/**
 * Migrate existing plain-text data to encrypted format
 */
export function migrateToEncrypted(username) {
  try {
    console.log('🔐 Starting migration to encrypted storage...');
    
    const encryptionKey = generateEncryptionKey(username);
    const migratedKeys = [];
    const failedKeys = [];

    // Get all localStorage keys
    const allKeys = Object.keys(localStorage);
    
    for (const key of allKeys) {
      // Skip non-sensitive fields and internal keys
      if (!isSensitiveField(key) || key.startsWith('__') || key.startsWith('encrypted:')) {
        continue;
      }

      try {
        const plainData = localStorage.getItem(key);
        
        if (plainData && plainData !== 'encrypted:') {
          // Encrypt the existing data
          const encryptedData = encryptData(plainData, encryptionKey);
          
          // Store encrypted version
          localStorage.setItem(key, encryptedData);
          
          migratedKeys.push(key);
          console.log(`✅ Migrated: ${key}`);
        }
      } catch (error) {
        console.error(`❌ Failed to migrate ${key}:`, error);
        failedKeys.push(key);
      }
    }

    // Set migration version to track that encryption has been applied
    localStorage.setItem('migrationVersion', '1.0.0');
    
    console.log(`🔐 Migration complete. Migrated ${migratedKeys.length} keys.`);
    if (failedKeys.length > 0) {
      console.warn(`⚠️ Failed to migrate ${failedKeys.length} keys:`, failedKeys);
    }
    
    return {
      success: true,
      migratedKeys,
      failedKeys,
      totalMigrated: migratedKeys.length
    };
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return {
      success: false,
      error: error.message,
      migratedKeys: [],
      failedKeys: [],
      totalMigrated: 0
    };
  }
}

/**
 * Check if data needs migration (is plain text)
 */
export function needsMigration(username) {
  try {
    if (!username) {
      // If no username provided, check if currentUser is plain text
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser && !currentUser.startsWith('encrypted:')) {
        return true;
      }
      return false;
    }

    const migrationVersion = localStorage.getItem('migrationVersion');
    if (migrationVersion === '1.0.0') {
      return false; // Already migrated
    }

    // Check if any sensitive data exists in plain text
    const allKeys = Object.keys(localStorage);
    
    for (const key of allKeys) {
      if (isSensitiveField(key)) {
        const data = localStorage.getItem(key);
        if (data && !data.startsWith('encrypted:')) {
          return true; // Found plain text sensitive data
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
}

/**
 * Utility function to get all sensitive keys for a user
 */
export function getSensitiveKeysForUser(username) {
  const userPrefix = `_${username}`;
  return Object.keys(localStorage).filter(key => 
    isSensitiveField(key) && (key.includes(userPrefix) || !key.includes('_'))
  );
}

/**
 * Reset encrypted data for a user when key mismatches occur (with backup)
 */
export function resetEncryptedDataForUser(username) {
  try {
    console.log(`🔄 Creating backup before resetting encrypted data for user: ${username}`);
    
    // First, create backups of all data
    const keysToBackup = [];
    const allKeys = Object.keys(localStorage);
    
    // Find all user-specific encrypted keys
    for (const key of allKeys) {
      if (key.includes(`_${username}`) || key === 'users') {
        const data = localStorage.getItem(key);
        if (data && data.startsWith('encrypted:')) {
          keysToBackup.push(key);
          // Create backup
          localStorage.setItem(`backup_${key}`, data);
          console.log(`💾 Backed up: ${key}`);
        }
      }
    }
    
    console.log(`💾 Created ${keysToBackup.length} backups`);
    
    // Now remove the problematic encrypted data
    for (const key of keysToBackup) {
      localStorage.removeItem(key);
      console.log(`🗑️ Removed encrypted key: ${key}`);
    }
    
    console.log(`✅ Reset complete. Removed ${keysToBackup.length} encrypted keys. Backups created with 'backup_' prefix.`);
    console.log(`🔄 To restore data, use: restoreFromBackup('${username}')`);
    return true;
  } catch (error) {
    console.error('Error resetting encrypted data:', error);
    return false;
  }
}

/**
 * Restore data from backups
 */
export function restoreFromBackup(username) {
  try {
    console.log(`🔄 Restoring data from backups for user: ${username}`);
    
    const allKeys = Object.keys(localStorage);
    const backupKeys = allKeys.filter(key => key.startsWith('backup_'));
    
    let restoredCount = 0;
    
    for (const backupKey of backupKeys) {
      const originalKey = backupKey.replace('backup_', '');
      const backupData = localStorage.getItem(backupKey);
      
      if (backupData) {
        localStorage.setItem(originalKey, backupData);
        console.log(`✅ Restored: ${originalKey}`);
        restoredCount++;
      }
    }
    
    console.log(`✅ Restore complete. Restored ${restoredCount} keys.`);
    return restoredCount > 0;
  } catch (error) {
    console.error('Error restoring from backup:', error);
    return false;
  }
}

/**
 * Validate encryption key by testing with existing data
 */
export function validateEncryptionKey(username, key) {
  try {
    // Try to decrypt a known sensitive field
    const testKeys = getSensitiveKeysForUser(username);
    
    if (testKeys.length === 0) {
      return true; // No sensitive data to test against
    }
    
    const testKey = testKeys[0];
    const encryptedData = localStorage.getItem(testKey);
    
    if (!encryptedData) {
      return true; // No data to test
    }
    
    // Try to decrypt
    const decrypted = decryptData(encryptedData, key);
    
    // If decryption returns the original encrypted data, key is invalid
    return decrypted !== encryptedData;
  } catch (error) {
    console.error('Error validating encryption key:', error);
    return false;
  }
}
