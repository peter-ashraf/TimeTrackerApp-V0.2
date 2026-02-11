// IMMEDIATE CLEANUP - Run this in browser console RIGHT NOW!
// This will clear all old encrypted data so you can start fresh

console.log('🚨 IMMEDIATE CLEANUP - Clearing all old encrypted data...');

// Clear ALL encrypted data
const allKeys = Object.keys(localStorage);
const encryptedKeys = allKeys.filter(key => {
  const value = localStorage.getItem(key);
  return value && value.startsWith('encrypted:');
});

console.log(`🔍 Found ${encryptedKeys.length} encrypted keys to remove:`, encryptedKeys);

// Remove all encrypted keys
encryptedKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log(`🗑️ Removed: ${key}`);
});

// Also remove any problematic keys
const problematicKeys = ['users', 'currentUser'];
problematicKeys.forEach(key => {
  if (localStorage.getItem(key)) {
    localStorage.removeItem(key);
    console.log(`🗑️ Removed problematic key: ${key}`);
  }
});

console.log('✅ CLEANUP COMPLETE! All old encrypted data removed.');
console.log('🔄 Refresh the page and register a fresh account.');

// Show what's left
const remainingKeys = Object.keys(localStorage);
console.log('📋 Remaining keys:', remainingKeys);
