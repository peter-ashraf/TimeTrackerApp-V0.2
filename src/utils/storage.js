import { setEncryptedItem, getEncryptedItem, removeEncryptedItem, isSensitiveField } from './encryption.js';

/**
 * Save data to localStorage (with encryption for sensitive data)
 */
export function saveToStorage(key, data, username = null) {
  try {
    if (isSensitiveField(key) && username) {
      return setEncryptedItem(key, data, username);
    } else {
      const jsonData = JSON.stringify(data);
      localStorage.setItem(key, jsonData);
      return true;
    }
  } catch (error) {
    
    return false;
  }
}

/**
 * Load data from localStorage (with decryption for sensitive data)
 */
export function loadFromStorage(key, username = null) {
  try {
    if (isSensitiveField(key) && username) {
      return getEncryptedItem(key, username);
    } else {
      const jsonData = localStorage.getItem(key);
      if (!jsonData) return null;
      return JSON.parse(jsonData);
    }
  } catch (error) {
    
    return null;
  }
}

/**
 * Remove data from localStorage
 */
export function removeFromStorage(key) {
  try {
    removeEncryptedItem(key);
    return true;
  } catch (error) {
    
    return false;
  }
}

/**
 * Clear all app data from localStorage
 */
export function clearAllStorage() {
  try {
    const keys = ['timeEntries', 'appConfig', 'currentPeriod'];
    keys.forEach(key => localStorage.removeItem(key));
    return true;
  } catch (error) {
    
    return false;
  }
}

/**
 * Check if localStorage is available
 */
export function isStorageAvailable() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get storage size (approximate in bytes)
 */
export function getStorageSize() {
  let total = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length;
    }
  }
  return total;
}
