// Emergency data recovery script
// Run this in browser console to restore your encrypted data

// First, let's try to recover from browser cache/backup if possible
console.log('🚨 Emergency Data Recovery Started');

// Check if there's any backup data in localStorage
const backupKeys = ['backup_users', 'backup_timeEntries_peter_ashraf', 'backup_payPeriods_peter_ashraf'];
const recoveredData = {};

for (const key of backupKeys) {
    const data = localStorage.getItem(key);
    if (data) {
        recoveredData[key.replace('backup_', '')] = data;
        console.log(`✅ Found backup for: ${key}`);
    }
}

// If we have recovered data, restore it
if (Object.keys(recoveredData).length > 0) {
    console.log('🔄 Restoring data from backups...');
    for (const [key, value] of Object.entries(recoveredData)) {
        localStorage.setItem(key, value);
        console.log(`✅ Restored: ${key}`);
    }
    console.log('✅ Data recovery complete! Please refresh the page and try logging in again.');
} else {
    console.log('❌ No backup data found. Your data may be permanently lost.');
    console.log('💡 To prevent this in the future, please regularly backup your data using the app\'s backup feature.');
}

// Create a manual data entry prompt for critical user data
if (!localStorage.getItem('users')) {
    console.log('🔧 No users data found. You may need to re-register your account.');
    console.log('📝 If you remember your timesheet data, you can manually enter it after re-registering.');
}
