// User data recovery script
// Run this in the browser console to recover your encrypted user data

function recoverUserData() {
  console.log('🔧 Starting user data recovery...');
  
  // Import encryption functions (they should be available globally)
  const { generateEncryptionKey, decryptData } = window;
  
  if (!generateEncryptionKey || !decryptData) {
    console.error('❌ Encryption functions not available. Make sure encryption.js is loaded.');
    return false;
  }
  
  try {
    // Get the encrypted currentUser data
    const encryptedCurrentUser = localStorage.getItem('currentUser');
    if (!encryptedCurrentUser) {
      console.log('❌ No currentUser data found in localStorage');
      return false;
    }
    
    console.log('📝 Found encrypted currentUser data');
    
    // Extract potential usernames from localStorage keys
    const allKeys = Object.keys(localStorage);
    const userSpecificKeys = allKeys.filter(key => 
      key.includes('_') && !key.startsWith('__') && key !== 'currentUser'
    );
    
    console.log('🔍 Found user-specific keys:', userSpecificKeys);
    
    // Extract potential usernames from keys
    const potentialUsernames = [...new Set(
      userSpecificKeys.map(key => {
        const parts = key.split('_');
        return parts.length > 1 ? parts.slice(1).join('_') : null;
      }).filter(Boolean)
    )];
    
    console.log('👤 Potential usernames:', potentialUsernames);
    
    // Try each potential username to decrypt currentUser
    let recoveredUser = null;
    let correctUsername = null;
    
    for (const username of potentialUsernames) {
      try {
        console.log(`🔐 Trying username: ${username}`);
        
        const key = generateEncryptionKey(username);
        const decrypted = decryptData(encryptedCurrentUser, key);
        
        if (decrypted && typeof decrypted === 'object' && decrypted.username) {
          console.log(`✅ Successfully decrypted currentUser for user: ${username}`);
          console.log('👤 User data:', decrypted);
          
          recoveredUser = decrypted;
          correctUsername = username;
          break;
        }
      } catch (decryptError) {
        console.log(`❌ Failed to decrypt with username: ${username}`);
        continue;
      }
    }
    
    if (!recoveredUser) {
      console.error('❌ Could not decrypt currentUser data with any known username');
      console.log('💡 You may need to manually clear localStorage and re-login');
      return false;
    }
    
    // Test if we can decrypt other user data with the same username
    console.log('\n🔍 Testing other user data decryption...');
    
    const testDataKeys = userSpecificKeys.filter(key => key.includes(`_${correctUsername}`));
    let successfulDecryptions = 0;
    
    for (const key of testDataKeys.slice(0, 3)) { // Test first 3 keys
      try {
        const encryptedData = localStorage.getItem(key);
        const keyForDecryption = generateEncryptionKey(correctUsername);
        const decrypted = decryptData(encryptedData, keyForDecryption);
        
        if (decrypted) {
          console.log(`✅ Successfully decrypted ${key}`);
          successfulDecryptions++;
        }
      } catch (error) {
        console.log(`❌ Failed to decrypt ${key}`);
      }
    }
    
    console.log(`\n📊 Recovery Summary:`);
    console.log(`✅ Successfully recovered user: ${correctUsername}`);
    console.log(`✅ User data decrypted: ${recoveredUser.username}`);
    console.log(`✅ Other data decryption success rate: ${successfulDecryptions}/${Math.min(3, testDataKeys.length)}`);
    
    // Store the recovered user data in plain text temporarily so the app can load
    localStorage.setItem('currentUser', JSON.stringify(recoveredUser));
    console.log('\n💾 Stored recovered user data in plain text for app loading');
    console.log('🔄 Refresh the page to login with your recovered account');
    
    return {
      success: true,
      username: correctUsername,
      userData: recoveredUser,
      message: 'User data recovered successfully! Refresh the page to login.'
    };
    
  } catch (error) {
    console.error('❌ Recovery failed:', error);
    return {
      success: false,
      error: error.message,
      message: 'Recovery failed. You may need to clear localStorage and re-login.'
    };
  }
}

// Alternative recovery function for manual username input
function recoverWithUsername(username) {
  console.log(`🔧 Attempting recovery with username: ${username}`);
  
  const { generateEncryptionKey, decryptData } = window;
  
  if (!generateEncryptionKey || !decryptData) {
    console.error('❌ Encryption functions not available');
    return false;
  }
  
  try {
    const encryptedCurrentUser = localStorage.getItem('currentUser');
    if (!encryptedCurrentUser) {
      console.log('❌ No currentUser data found');
      return false;
    }
    
    const key = generateEncryptionKey(username);
    const decrypted = decryptData(encryptedCurrentUser, key);
    
    if (decrypted && typeof decrypted === 'object' && decrypted.username) {
      console.log(`✅ Successfully decrypted currentUser for user: ${username}`);
      console.log('👤 User data:', decrypted);
      
      // Store in plain text for app loading
      localStorage.setItem('currentUser', JSON.stringify(decrypted));
      console.log('💾 Stored recovered user data. Refresh the page to login.');
      
      return {
        success: true,
        username,
        userData: decrypted
      };
    } else {
      console.log(`❌ Failed to decrypt with username: ${username}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Recovery failed:', error);
    return false;
  }
}

// Clear all data function (last resort)
function clearAllData() {
  console.warn('⚠️ This will delete ALL app data including your encrypted data!');
  const confirmed = confirm('Are you sure you want to delete ALL app data? This cannot be undone.');
  
  if (confirmed) {
    localStorage.clear();
    console.log('🗑️ All localStorage data cleared. You will need to re-register.');
    return true;
  } else {
    console.log('❌ Data clearing cancelled');
    return false;
  }
}

// Make functions available globally
window.recoverUserData = recoverUserData;
window.recoverWithUsername = recoverWithUsername;
window.clearAllData = clearAllData;

console.log('🔧 User recovery tools loaded!');
console.log('📝 Available commands:');
console.log('  recoverUserData() - Automatically recover your user data');
console.log('  recoverWithUsername("username") - Try specific username');
console.log('  clearAllData() - Clear all data (last resort)');

// Auto-run recovery
console.log('\n🚀 Auto-running recovery...');
const result = recoverUserData();

if (result && result.success) {
  console.log('\n🎉 Recovery successful! Please refresh the page to login.');
} else {
  console.log('\n❌ Auto-recovery failed. You can try manual recovery:');
  console.log('  recoverWithUsername("your_username")');
  console.log('  clearAllData() (as last resort)');
}
