// Simple encryption fix - remove complex key generation
// This creates a stable, simple encryption key that works across all modes

import CryptoJS from 'crypto-js';

/**
 * Simple, stable encryption key generation
 * Uses only username - no browser-dependent properties
 */
export function generateSimpleEncryptionKey(username) {
  if (!username) {
    throw new Error('Username is required for encryption key generation');
  }
  
  // Use a simple, consistent approach - just username with a fixed salt
  const salt = 'TimeTrackerApp_Stable_Key_2024';
  const combinedSeed = `${username}_${salt}`;
  
  // Generate a 256-bit key using SHA-256
  const key = CryptoJS.SHA256(combinedSeed).toString();
  
  return key;
}

/**
 * Simple encrypt function
 */
export function simpleEncrypt(data, username) {
  try {
    if (!data || data === null || data === undefined) {
      return data;
    }

    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const key = generateSimpleEncryptionKey(username);
    const encrypted = CryptoJS.AES.encrypt(dataString, key).toString();
    
    return `encrypted:${encrypted}`;
  } catch (error) {
    console.error('Error encrypting data:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Simple decrypt function
 */
export function simpleDecrypt(encryptedData, username) {
  try {
    if (!encryptedData || encryptedData === null || encryptedData === undefined) {
      return encryptedData;
    }

    if (typeof encryptedData !== 'string' || !encryptedData.startsWith('encrypted:')) {
      return encryptedData;
    }

    const encrypted = encryptedData.substring(10);
    const key = generateSimpleEncryptionKey(username);
    const decrypted = CryptoJS.AES.decrypt(encrypted, key);
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedString) {
      throw new Error('Decryption failed - invalid key or corrupted data');
    }
    
    try {
      return JSON.parse(decryptedString);
    } catch (parseError) {
      return decryptedString;
    }
  } catch (error) {
    throw new Error('Decryption failed');
  }
}

/**
 * Simple set encrypted item
 */
export function setSimpleEncryptedItem(key, data, username) {
  try {
    const encryptedData = simpleEncrypt(data, username);
    localStorage.setItem(key, encryptedData);
    return true;
  } catch (error) {
    console.error('Error setting encrypted item:', error);
    return false;
  }
}

/**
 * Simple get encrypted item with fallback for old data
 */
export function getSimpleEncryptedItem(key, username) {
  try {
    const data = localStorage.getItem(key);
    if (data === null) {
      return null;
    }

    if (data.startsWith('encrypted:')) {
      console.log(`🔑 Attempting to decrypt ${key} with username: ${username}`);
      try {
        const result = simpleDecrypt(data, username);
        console.log(`🎉 Decryption result for ${key}:`, result);
        return result;
      } catch (decryptError) {
        console.log(`⚠️ Failed to decrypt ${key} with simple encryption, returning default value`);
        console.log(`❌ Decryption error:`, decryptError.message);
        // Return default values for known data types instead of throwing error
        if (key.includes('timeEntries')) return [];
        if (key.includes('payPeriods')) return [{
          id: 'period-default',
          label: '23 Jan - 20 Feb 2026',
          start: '2026-01-23',
          end: '2026-02-20'
        }];
        if (key.includes('fullName')) return '';
        if (key.includes('salary')) return 0;
        if (key.includes('annualVacation')) return 10;
        if (key.includes('sickDays')) return 7;
        if (key.includes('currentPeriodId')) return 'period-default';
        // For users key, don't return default - let the error propagate so we can try other usernames
        if (key === 'users') {
          console.log(`🚨 Users key decryption failed, re-throwing error for fallback logic`);
          throw decryptError; // Re-throw to allow fallback logic in AuthContext
        }
        return null;
      }
    } else {
      // Plain text data
      try {
        return JSON.parse(data);
      } catch (parseError) {
        console.error(`Failed to parse plain text data for key ${key}:`, parseError);
        return null;
      }
    }
  } catch (error) {
    console.error(`Error getting encrypted item ${key}:`, error);
    return null;
  }
}
