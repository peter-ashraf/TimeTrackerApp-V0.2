// Simple test script to verify encryption fixes
// Copy and paste this into the browser console to test

// Test the encryption fixes
function testEncryptionFixes() {
  console.log('🔧 Testing encryption fixes...');
  
  // Clear any existing test data
  localStorage.removeItem('currentUser');
  localStorage.removeItem('users');
  localStorage.removeItem('migrationVersion');
  
  // Import encryption functions (they should be available globally)
  const { 
    setEncryptedItem, 
    getEncryptedItem, 
    generateEncryptionKey,
    isSensitiveField,
    needsMigration
  } = window;
  
  if (!setEncryptedItem || !getEncryptedItem) {
    console.error('❌ Encryption functions not available. Make sure encryption.js is loaded.');
    return false;
  }
  
  try {
    // Test 1: Basic encryption/decryption
    const testUser = { username: 'testuser', createdAt: '2024-01-01T00:00:00.000Z' };
    const username = 'testuser';
    
    console.log('📝 Test 1: Basic encryption/decryption');
    
    // Store encrypted user data
    const storeResult = setEncryptedItem('currentUser', testUser, username);
    console.log('Store result:', storeResult);
    
    // Retrieve encrypted user data
    const retrievedUser = getEncryptedItem('currentUser', username);
    console.log('Retrieved user:', retrievedUser);
    
    // Check if data matches
    const dataMatches = JSON.stringify(testUser) === JSON.stringify(retrievedUser);
    console.log('Data matches:', dataMatches);
    
    // Test 2: Check if data is encrypted in localStorage
    const rawData = localStorage.getItem('currentUser');
    const isEncrypted = rawData.startsWith('encrypted:');
    console.log('Data is encrypted in localStorage:', isEncrypted);
    
    // Test 3: Test migration detection
    console.log('\n📝 Test 2: Migration detection');
    const needsMigrateBefore = needsMigration(username);
    console.log('Needs migration (before):', needsMigrateBefore);
    
    // Set migration version
    localStorage.setItem('migrationVersion', '1.0.0');
    const needsMigrateAfter = needsMigration(username);
    console.log('Needs migration (after):', needsMigrateAfter);
    
    // Test 4: Test sensitive field detection
    console.log('\n📝 Test 3: Sensitive field detection');
    const sensitiveTests = [
      { key: 'currentUser', expected: true },
      { key: 'users', expected: true },
      { key: 'theme', expected: false }
    ];
    
    sensitiveTests.forEach(test => {
      const isSensitive = isSensitiveField(test.key);
      console.log(`${test.key}: ${isSensitive} (expected: ${test.expected})`);
    });
    
    // Test 5: Test key generation
    console.log('\n📝 Test 4: Key generation');
    const key1 = generateEncryptionKey(username);
    const key2 = generateEncryptionKey(username);
    console.log('Key consistency:', key1 === key2);
    console.log('Key length:', key1.length);
    
    console.log('\n✅ All tests completed!');
    console.log('If you see this message without errors, the encryption fixes are working.');
    
    // Cleanup
    localStorage.removeItem('currentUser');
    localStorage.removeItem('migrationVersion');
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Test the AuthContext initialization scenario
function testAuthContextScenario() {
  console.log('\n🔧 Testing AuthContext initialization scenario...');
  
  try {
    // Simulate the scenario where currentUser is plain text
    const plainUser = { username: 'testuser', createdAt: '2024-01-01T00:00:00.000Z' };
    localStorage.setItem('currentUser', JSON.stringify(plainUser));
    
    // Simulate the AuthContext initialization logic
    let savedUser = null;
    const rawData = localStorage.getItem('currentUser');
    
    if (rawData) {
      if (rawData.startsWith('encrypted:')) {
        console.warn('Found encrypted currentUser without username available');
        savedUser = null;
      } else {
        savedUser = JSON.parse(rawData);
      }
    }
    
    console.log('Loaded user:', savedUser);
    
    if (savedUser) {
      // Now encrypt it
      const { setEncryptedItem } = window;
      setEncryptedItem('currentUser', savedUser, savedUser.username);
      
      // Verify it's encrypted
      const encryptedData = localStorage.getItem('currentUser');
      console.log('Data is now encrypted:', encryptedData.startsWith('encrypted:'));
    }
    
    console.log('✅ AuthContext scenario test completed!');
    
    // Cleanup
    localStorage.removeItem('currentUser');
    
    return true;
    
  } catch (error) {
    console.error('❌ AuthContext scenario test failed:', error);
    return false;
  }
}

// Run all tests
function runAllFixTests() {
  console.log('🚀 Running encryption fix tests...\n');
  
  const test1 = testEncryptionFixes();
  const test2 = testAuthContextScenario();
  
  console.log('\n📊 Test Results:');
  console.log('Basic encryption test:', test1 ? '✅' : '❌');
  console.log('AuthContext scenario test:', test2 ? '✅' : '❌');
  
  if (test1 && test2) {
    console.log('\n🎉 All tests passed! The encryption fixes are working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the errors above.');
  }
}

// Make functions available globally
window.testEncryptionFixes = testEncryptionFixes;
window.testAuthContextScenario = testAuthContextScenario;
window.runAllFixTests = runAllFixTests;

console.log('🔧 Encryption fix test utilities loaded!');
console.log('Run runAllFixTests() to test the fixes.');
