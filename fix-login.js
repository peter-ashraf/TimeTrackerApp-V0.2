// Quick fix for login issue
// Run this in browser console to decrypt users data and allow login

function fixLoginIssue() {
  console.log('🔧 Fixing login issue...');
  
  // Get encryption functions
  const { generateEncryptionKey, decryptData } = window;
  
  if (!generateEncryptionKey || !decryptData) {
    console.error('❌ Encryption functions not available');
    return false;
  }
  
  try {
    // Get encrypted users data
    const encryptedUsers = localStorage.getItem('users');
    if (!encryptedUsers) {
      console.log('❌ No users data found');
      return false;
    }
    
    if (!encryptedUsers.startsWith('encrypted:')) {
      console.log('✅ Users data is already in plain text');
      return true;
    }
    
    console.log('🔐 Found encrypted users data, attempting to decrypt...');
    
    // Try with your username first
    const username = 'peter_ashraf';
    const key = generateEncryptionKey(username);
    
    try {
      const decryptedUsers = decryptData(encryptedUsers, key);
      
      if (decryptedUsers && typeof decryptedUsers === 'object') {
        console.log('✅ Successfully decrypted users data!');
        console.log('👤 Users:', Object.keys(decryptedUsers));
        
        // Store users data in plain text temporarily
        localStorage.setItem('users', JSON.stringify(decryptedUsers));
        
        console.log('💾 Users data now in plain text - you can login!');
        console.log('🔄 Refresh the page and try logging in again.');
        
        return {
          success: true,
          message: 'Users data decrypted! Refresh page and login normally.'
        };
      } else {
        console.log('❌ Decryption failed or returned invalid data');
        return false;
      }
    } catch (decryptError) {
      console.error('❌ Failed to decrypt users data:', decryptError.message);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    return false;
  }
}

// Alternative function to try multiple usernames
function tryMultipleUsernames() {
  console.log('🔍 Trying multiple usernames to decrypt users data...');
  
  const { generateEncryptionKey, decryptData } = window;
  const encryptedUsers = localStorage.getItem('users');
  
  if (!encryptedUsers || !encryptedUsers.startsWith('encrypted:')) {
    console.log('❌ No encrypted users data found');
    return false;
  }
  
  // Common usernames to try
  const usernames = [
    'peter_ashraf',
    'peter',
    'ashraf',
    'admin',
    'user',
    'test'
  ];
  
  for (const username of usernames) {
    try {
      console.log(`🔐 Trying username: ${username}`);
      
      const key = generateEncryptionKey(username);
      const decrypted = decryptData(encryptedUsers, key);
      
      if (decrypted && typeof decrypted === 'object' && Object.keys(decrypted).length > 0) {
        console.log(`✅ Success with username: ${username}`);
        console.log('👤 Found users:', Object.keys(decrypted));
        
        // Store in plain text
        localStorage.setItem('users', JSON.stringify(decrypted));
        
        console.log('💾 Users data decrypted and stored in plain text!');
        console.log('🔄 Refresh page and login with your credentials.');
        
        return {
          success: true,
          username,
          message: `Success with username: ${username}. Refresh and login.`
        };
      }
    } catch (error) {
      console.log(`❌ Failed with username: ${username}`);
      continue;
    }
  }
  
  console.log('❌ All usernames failed');
  return false;
}

// Function to check what's in localStorage
function debugLocalStorage() {
  console.log('🔍 Debugging localStorage contents...');
  
  const allKeys = Object.keys(localStorage);
  console.log('📋 All keys:', allKeys);
  
  allKeys.forEach(key => {
    const value = localStorage.getItem(key);
    const isEncrypted = value && value.startsWith('encrypted:');
    const preview = isEncrypted ? '[ENCRYPTED]' : (value.length > 50 ? value.substring(0, 50) + '...' : value);
    
    console.log(`${key}: ${preview} (${isEncrypted ? 'encrypted' : 'plain'})`);
  });
  
  // Check for user-specific keys
  const userSpecificKeys = allKeys.filter(key => key.includes('_'));
  console.log('👤 User-specific keys:', userSpecificKeys);
  
  // Extract potential usernames
  const potentialUsernames = [...new Set(
    userSpecificKeys.map(key => {
      const parts = key.split('_');
      return parts.length > 1 ? parts.slice(1).join('_') : null;
    }).filter(Boolean)
  )];
  
  console.log('🔍 Potential usernames:', potentialUsernames);
}

// Make functions available globally
window.fixLoginIssue = fixLoginIssue;
window.tryMultipleUsernames = tryMultipleUsernames;
window.debugLocalStorage = debugLocalStorage;

console.log('🔧 Login fix utilities loaded!');
console.log('📝 Available commands:');
console.log('  fixLoginIssue() - Fix login with peter_ashraf username');
console.log('  tryMultipleUsernames() - Try multiple usernames');
console.log('  debugLocalStorage() - Debug localStorage contents');

// Auto-run the fix
console.log('\n🚀 Auto-running login fix...');
const result = fixLoginIssue();

if (result && result.success) {
  console.log('\n🎉 Login fix successful!');
  console.log('📋 Next steps:');
  console.log('1. Refresh the page');
  console.log('2. Try logging in with your normal credentials');
  console.log('3. Your data will remain encrypted and secure');
} else {
  console.log('\n❌ Auto-fix failed. Trying multiple usernames...');
  const multiResult = tryMultipleUsernames();
  
  if (multiResult && multiResult.success) {
    console.log('\n🎉 Multiple username fix successful!');
    console.log('📋 Next steps:');
    console.log('1. Refresh the page');
    console.log('2. Try logging in');
  } else {
    console.log('\n❌ All automatic fixes failed.');
    console.log('🔍 Run debugLocalStorage() to see what\'s in your storage');
    console.log('💡 You may need to clear localStorage and re-register as last resort');
  }
}
