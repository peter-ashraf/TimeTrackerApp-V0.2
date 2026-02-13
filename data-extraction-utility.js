// Timesheet Data Recovery Utility
// This utility helps extract user timesheet data when credentials are forgotten
// It can decrypt data using possible usernames and export it for import into a new account

import CryptoJS from 'crypto-js';

/**
 * Simple encryption key generation (matches the app's implementation)
 */
function generateSimpleEncryptionKey(username) {
  if (!username) {
    throw new Error('Username is required for encryption key generation');
  }
  
  const salt = 'TimeTrackerApp_Stable_Key_2024';
  const combinedSeed = `${username}_${salt}`;
  const key = CryptoJS.SHA256(combinedSeed).toString();
  
  return key;
}

/**
 * Decrypt data using username
 */
function simpleDecrypt(encryptedData, username) {
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
 * Extract all possible usernames from localStorage
 */
function extractPotentialUsernames() {
  const allKeys = Object.keys(localStorage);
  const userSpecificKeys = allKeys.filter(key => 
    key.includes('_') && !key.startsWith('__') && key !== 'currentUser' && key !== 'users'
  );
  
  const potentialUsernames = [...new Set(
    userSpecificKeys.map(key => {
      const parts = key.split('_');
      return parts.length > 1 ? parts.slice(1).join('_') : null;
    }).filter(Boolean)
  )];
  
  return potentialUsernames;
}

/**
 * Try to decrypt data with a given username
 */
function tryDecryptWithUsername(username) {
  const results = {
    username,
    success: false,
    decryptedData: {},
    errors: []
  };

  try {
    // Get all user-specific keys for this username
    const allKeys = Object.keys(localStorage);
    const userKeys = allKeys.filter(key => 
      key.includes(`_${username}`) || key === 'currentUser' || key === 'users'
    );

    for (const key of userKeys) {
      try {
        const encryptedData = localStorage.getItem(key);
        if (encryptedData && encryptedData.startsWith('encrypted:')) {
          const decrypted = simpleDecrypt(encryptedData, username);
          results.decryptedData[key] = decrypted;
          results.success = true;
        }
      } catch (error) {
        results.errors.push(`Failed to decrypt ${key}: ${error.message}`);
      }
    }
  } catch (error) {
    results.errors.push(`General error for username ${username}: ${error.message}`);
  }

  return results;
}

/**
 * Main recovery function - tries all possible usernames
 */
function recoverAllUserData() {
  console.log('🔧 Starting comprehensive data recovery...');
  
  const potentialUsernames = extractPotentialUsernames();
  console.log('👤 Potential usernames found:', potentialUsernames);
  
  const recoveryResults = [];
  
  for (const username of potentialUsernames) {
    console.log(`🔐 Trying username: ${username}`);
    const result = tryDecryptWithUsername(username);
    recoveryResults.push(result);
    
    if (result.success) {
      console.log(`✅ Successfully recovered data for user: ${username}`);
      console.log('📊 Decrypted data keys:', Object.keys(result.decryptedData));
    }
  }
  
  return recoveryResults;
}

/**
 * Export recovered data in a format that can be imported
 */
function exportUserDataForImport(recoveryResult) {
  if (!recoveryResult.success) {
    throw new Error('No successful recovery data to export');
  }

  const exportData = {
    username: recoveryResult.username,
    exportDate: new Date().toISOString(),
    data: {}
  };

  // Map the decrypted data to import-friendly format
  const decryptedData = recoveryResult.decryptedData;
  
  // Extract timesheet entries
  if (decryptedData[`timeEntries_${recoveryResult.username}`]) {
    exportData.data.timeEntries = decryptedData[`timeEntries_${recoveryResult.username}`];
  }
  
  // Extract pay periods
  if (decryptedData[`payPeriods_${recoveryResult.username}`]) {
    exportData.data.payPeriods = decryptedData[`payPeriods_${recoveryResult.username}`];
  }
  
  // Extract current period ID
  if (decryptedData[`currentPeriodId_${recoveryResult.username}`]) {
    exportData.data.currentPeriodId = decryptedData[`currentPeriodId_${recoveryResult.username}`];
  }
  
  // Extract user settings
  if (decryptedData[`fullName_${recoveryResult.username}`]) {
    exportData.data.fullName = decryptedData[`fullName_${recoveryResult.username}`];
  }
  
  if (decryptedData[`salary_${recoveryResult.username}`]) {
    exportData.data.salary = decryptedData[`salary_${recoveryResult.username}`];
  }
  
  if (decryptedData[`annualVacation_${recoveryResult.username}`]) {
    exportData.data.annualVacation = decryptedData[`annualVacation_${recoveryResult.username}`];
  }
  
  if (decryptedData[`sickDays_${recoveryResult.username}`]) {
    exportData.data.sickDays = decryptedData[`sickDays_${recoveryResult.username}`];
  }

  return exportData;
}

/**
 * Create downloadable JSON file for the user
 */
function downloadRecoveryData(exportData) {
  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `timetracker_backup_${exportData.username}_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  console.log(`📁 Downloaded backup file: timetracker_backup_${exportData.username}_${new Date().toISOString().split('T')[0]}.json`);
}

/**
 * Main recovery workflow
 */
function performDataRecovery() {
  console.log('🚀 Starting Timesheet Data Recovery...');
  
  try {
    // Step 1: Recover all user data
    const recoveryResults = recoverAllUserData();
    
    // Step 2: Filter successful recoveries
    const successfulRecoveries = recoveryResults.filter(result => result.success);
    
    if (successfulRecoveries.length === 0) {
      console.error('❌ No user data could be recovered. You may need to:');
      console.log('1. Try to remember your username');
      console.log('2. Check if you have any backup files');
      console.log('3. Contact support if this is critical data');
      return { success: false, message: 'No data could be recovered' };
    }
    
    console.log(`✅ Found data for ${successfulRecoveries.length} user(s):`);
    successfulRecoveries.forEach(result => {
      console.log(`  - ${result.username}: ${Object.keys(result.decryptedData).length} data items`);
    });
    
    // Step 3: Export data for each successful recovery
    const exportResults = [];
    
    for (const recovery of successfulRecoveries) {
      try {
        const exportData = exportUserDataForImport(recovery);
        exportResults.push(exportData);
        
        // Step 4: Download the backup file
        downloadRecoveryData(exportData);
        
        console.log(`✅ Successfully exported data for user: ${recovery.username}`);
      } catch (error) {
        console.error(`❌ Failed to export data for ${recovery.username}:`, error.message);
      }
    }
    
    return {
      success: true,
      message: `Successfully recovered and exported data for ${exportResults.length} user(s)`,
      users: exportResults.map(e => e.username),
      instructions: `
📋 Next Steps:
1. Check your Downloads folder for the backup file(s)
2. Create a new account in the TimeTracker app
3. Use the Import feature to restore your timesheet data
4. The backup file contains all your time entries, pay periods, and settings

💡 Important: Keep the backup file safe as it contains your timesheet data!
      `
    };
    
  } catch (error) {
    console.error('❌ Recovery process failed:', error);
    return {
      success: false,
      error: error.message,
      message: 'Recovery process failed. Please try again or contact support.'
    };
  }
}

/**
 * Try recovery with a specific username (if user remembers partial username)
 */
function trySpecificUsername(username) {
  console.log(`🔍 Trying recovery with specific username: ${username}`);
  
  const result = tryDecryptWithUsername(username);
  
  if (result.success) {
    try {
      const exportData = exportUserDataForImport(result);
      downloadRecoveryData(exportData);
      
      return {
        success: true,
        username,
        message: `Successfully recovered and exported data for ${username}`,
        instructions: `
✅ Data recovered for ${username}!
📁 Check your Downloads folder for the backup file
📋 Create a new account and use the Import feature to restore your data
        `
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Found data for ${username} but failed to export it`
      };
    }
  } else {
    return {
      success: false,
      message: `No data could be recovered with username: ${username}`,
      suggestions: [
        'Check if the username is spelled correctly',
        'Try variations of your username',
        'Use the automatic recovery instead'
      ]
    };
  }
}

// Make functions available globally for browser console usage
window.performDataRecovery = performDataRecovery;
window.trySpecificUsername = trySpecificUsername;
window.recoverAllUserData = recoverAllUserData;

console.log('🔧 Timesheet Data Recovery Utility loaded!');
console.log('📝 Available commands:');
console.log('  performDataRecovery() - Automatically recover and export all user data');
console.log('  trySpecificUsername("username") - Try recovery with a specific username');
console.log('  recoverAllUserData() - Show what data can be recovered (no export)');

// Auto-run basic analysis
console.log('\n🔍 Analyzing localStorage for recoverable data...');
const potentialUsernames = extractPotentialUsernames();
console.log(`Found ${potentialUsernames.length} potential username(s):`, potentialUsernames);

if (potentialUsernames.length > 0) {
  console.log('\n💡 Ready to recover! Run performDataRecovery() to extract and download your data.');
} else {
  console.log('\n❌ No user data found in localStorage.');
}
