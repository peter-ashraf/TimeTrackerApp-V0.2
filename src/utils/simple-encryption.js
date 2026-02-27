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

      try {

        const decryptedData = simpleDecrypt(data, username);

        // Additional validation for salary data

        if (key.includes('salary')) {

          return validateSalaryData(decryptedData);

        }

        return decryptedData;

      } catch (decryptError) {

        

        // Return default values for known data types instead of throwing error

        if (key.includes('timeEntries')) return [];

        if (key.includes('payPeriods')) return [];

        if (key.includes('sickDays')) return 7;

        if (key.includes('currentPeriodId')) return null;

        if (key.includes('annualVacation')) return 10;

        if (key.includes('sickDays')) return 7;

        if (key.includes('salary')) return 0; // Default salary

        return null;

      }

    } else {

      // Return non-encrypted data as-is

      try {

        const parsedData = JSON.parse(data);

        // Additional validation for salary data

        if (key.includes('salary')) {

          return validateSalaryData(parsedData);

        }

        return parsedData;

      } catch (parseError) {

        // For salary, validate even if not JSON

        if (key.includes('salary')) {

          return validateSalaryData(data);

        }

        return data;

      }

    }

  } catch (error) {

    

    return null;

  }

}



/**

 * Validate salary data integrity

 */

function validateSalaryData(salary) {

  if (salary === null || salary === undefined) return 0;

  const numSalary = Number(salary);

  // Check if it's a valid number

  if (isNaN(numSalary)) {

    

    return 0;

  }

  // Check for reasonable salary bounds

  if (numSalary < 0) {

    

    return 0;

  }

  if (numSalary > 10000000) {

    

    return 0;

  }

  return numSalary;

}
