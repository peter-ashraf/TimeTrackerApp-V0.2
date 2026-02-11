// Clear old encrypted data and start fresh
// Run this in browser console to clean up the old encryption mess

console.log('🧹 Cleaning up old encrypted data for fresh start...');

// Get all localStorage keys
const allKeys = Object.keys(localStorage);
const encryptedKeys = allKeys.filter(key => {
  const value = localStorage.getItem(key);
  return value && value.startsWith('encrypted:');
});

console.log(`Found ${encryptedKeys.length} encrypted keys to clear:`, encryptedKeys);

// Clear all encrypted data
let clearedCount = 0;
for (const key of encryptedKeys) {
  localStorage.removeItem(key);
  console.log(`🗑️ Cleared: ${key}`);
  clearedCount++;
}

console.log(`✅ Cleanup complete! Cleared ${clearedCount} encrypted keys.`);
console.log('🔄 You can now register a fresh account with the new simple encryption system.');

// Keep only non-encrypted settings
const settingsToKeep = ['theme', 'use12HourFormat', 'detailedView', 'hideSalary', 'hapticFeedbackEnabled'];
const remainingKeys = Object.keys(localStorage).filter(key => !settingsToKeep.includes(key));

console.log('📋 Remaining localStorage keys:', remainingKeys);
