// IMMEDIATE DATA RECOVERY - Run this in browser console RIGHT NOW!
// This will restore your deleted data from the backups that were created

console.log('🚨 EMERGENCY DATA RECOVERY - Starting immediately...');

// Import the restore function (if available in window scope)
// If not available, we'll do it manually

const allKeys = Object.keys(localStorage);
const backupKeys = allKeys.filter(key => key.startsWith('backup_'));

console.log(`🔍 Found ${backupKeys.length} backup keys:`, backupKeys);

if (backupKeys.length === 0) {
    console.log('❌ No backup keys found. Data may be permanently lost.');
    console.log('💡 This happened because the reset function ran before backups were implemented.');
} else {
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
    
    console.log(`✅ RECOVERY COMPLETE! Restored ${restoredCount} keys.`);
    console.log('🔄 Please refresh the page and try logging in again.');
    
    // Show what was restored
    console.log('📋 Restored data summary:');
    for (const backupKey of backupKeys) {
        const originalKey = backupKey.replace('backup_', '');
        const data = localStorage.getItem(originalKey);
        if (data) {
            console.log(`  - ${originalKey}: ${data.substring(0, 50)}...`);
        }
    }
}

// Alternative: If no backups exist, try to recover from browser session storage
if (backupKeys.length === 0) {
    console.log('🔍 Checking sessionStorage for any cached data...');
    const sessionKeys = Object.keys(sessionStorage);
    console.log('SessionStorage keys:', sessionKeys);
    
    // Check if any app data might be in sessionStorage
    for (const key of sessionKeys) {
        if (key.includes('peter_ashraf') || key === 'users') {
            console.log(`Found potential data in sessionStorage: ${key}`);
            const data = sessionStorage.getItem(key);
            console.log('Data preview:', data ? data.substring(0, 100) + '...' : 'null');
        }
    }
}
