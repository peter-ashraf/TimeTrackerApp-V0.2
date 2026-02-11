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
 * Simple get encrypted item
 */
export function getSimpleEncryptedItem(key, username) {
  try {
    const data = localStorage.getItem(key);
    if (data === null) {
      return null;
    }

    if (data.startsWith('encrypted:')) {
      return simpleDecrypt(data, username);
    } else {
      // Return non-encrypted data as-is
      try {
        return JSON.parse(data);
      } catch (parseError) {
        return data;
      }
    }
  } catch (error) {
    console.error('Error getting encrypted item:', error);
    return null;
  }
}
