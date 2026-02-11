// Test file for encryption utilities
// This file can be run in the browser console to test encryption functionality

import {
  generateEncryptionKey,
  isSensitiveField,
  encryptData,
  decryptData,
  setEncryptedItem,
  getEncryptedItem,
  needsMigration,
  migrateToEncrypted
} from './encryption.js';

// Test data
const testUsername = 'testuser';
const testData = {
  username: 'testuser',
  passwordHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
  createdAt: '2024-01-01T00:00:00.000Z',
  salary: 50000,
  fullName: 'Test User',
  timeEntries: [
    {
      date: '2024-01-01',
      type: 'Regular',
      intervals: [{ in: '09:00:00', out: '17:00:00' }]
    }
  ]
};

/**
 * Run encryption tests
 */
export function runEncryptionTests() {
  console.log('🔐 Starting encryption tests...');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: Generate encryption key
  try {
    const key1 = generateEncryptionKey(testUsername);
    const key2 = generateEncryptionKey(testUsername);
    
    const keyConsistent = key1 === key2;
    const keyLength = key1.length === 64; // SHA256 produces 64 hex chars
    
    results.tests.push({
      name: 'Encryption Key Generation',
      passed: keyConsistent && keyLength,
      details: {
        consistent: keyConsistent,
        correctLength: keyLength,
        keyLength: key1.length
      }
    });
    
    if (keyConsistent && keyLength) {
      results.passed++;
    } else {
      results.failed++;
    }
  } catch (error) {
    results.tests.push({
      name: 'Encryption Key Generation',
      passed: false,
      error: error.message
    });
    results.failed++;
  }

  // Test 2: Sensitive field detection
  try {
    const sensitiveTests = [
      { key: 'users', expected: true },
      { key: 'currentUser', expected: true },
      { key: 'salary_testuser', expected: true },
      { key: 'fullName_testuser', expected: true },
      { key: 'timeEntries_testuser', expected: true },
      { key: 'payPeriods_testuser', expected: true },
      { key: 'theme', expected: false },
      { key: 'use12HourFormat', expected: false },
      { key: 'detailedView', expected: false },
      { key: 'hideSalary', expected: false }
    ];
    
    let allPassed = true;
    sensitiveTests.forEach(test => {
      const isSensitive = isSensitiveField(test.key);
      if (isSensitive !== test.expected) {
        allPassed = false;
        console.error(`❌ Field detection failed for ${test.key}: expected ${test.expected}, got ${isSensitive}`);
      }
    });
    
    results.tests.push({
      name: 'Sensitive Field Detection',
      passed: allPassed,
      details: { tests: sensitiveTests }
    });
    
    if (allPassed) {
      results.passed++;
    } else {
      results.failed++;
    }
  } catch (error) {
    results.tests.push({
      name: 'Sensitive Field Detection',
      passed: false,
      error: error.message
    });
    results.failed++;
  }

  // Test 3: Data encryption/decryption
  try {
    const key = generateEncryptionKey(testUsername);
    
    // Test string encryption
    const testString = 'Hello World';
    const encryptedString = encryptData(testString, key);
    const decryptedString = decryptData(encryptedString, key);
    
    // Test object encryption
    const testObject = { name: 'Test', value: 123 };
    const encryptedObject = encryptData(testObject, key);
    const decryptedObject = decryptData(encryptedObject, key);
    
    const stringCorrect = testString === decryptedString;
    const objectCorrect = JSON.stringify(testObject) === JSON.stringify(decryptedObject);
    const hasPrefix = encryptedString.startsWith('encrypted:');
    
    results.tests.push({
      name: 'Data Encryption/Decryption',
      passed: stringCorrect && objectCorrect && hasPrefix,
      details: {
        stringCorrect,
        objectCorrect,
        hasPrefix,
        originalString: testString,
        decryptedString,
        originalObject: testObject,
        decryptedObject
      }
    });
    
    if (stringCorrect && objectCorrect && hasPrefix) {
      results.passed++;
    } else {
      results.failed++;
    }
  } catch (error) {
    results.tests.push({
      name: 'Data Encryption/Decryption',
      passed: false,
      error: error.message
    });
    results.failed++;
  }

  // Test 4: localStorage encryption
  try {
    const testKey = `testData_${testUsername}`;
    
    // Store encrypted data
    const storeSuccess = setEncryptedItem(testKey, testData, testUsername);
    
    // Retrieve and decrypt data
    const retrievedData = getEncryptedItem(testKey, testUsername);
    
    const dataMatches = JSON.stringify(testData) === JSON.stringify(retrievedData);
    
    // Cleanup
    localStorage.removeItem(testKey);
    
    results.tests.push({
      name: 'LocalStorage Encryption',
      passed: storeSuccess && dataMatches,
      details: {
        storeSuccess,
        dataMatches,
        originalData: testData,
        retrievedData
      }
    });
    
    if (storeSuccess && dataMatches) {
      results.passed++;
    } else {
      results.failed++;
    }
  } catch (error) {
    results.tests.push({
      name: 'LocalStorage Encryption',
      passed: false,
      error: error.message
    });
    results.failed++;
  }

  // Test 5: Migration detection
  try {
    // Store some plain text data
    const plainKey = `plainData_${testUsername}`;
    localStorage.setItem(plainKey, JSON.stringify(testData));
    
    const needsMigrate = needsMigration(testUsername);
    
    // Cleanup
    localStorage.removeItem(plainKey);
    
    results.tests.push({
      name: 'Migration Detection',
      passed: needsMigrate,
      details: {
        needsMigrate,
        testData: testData
      }
    });
    
    if (needsMigrate) {
      results.passed++;
    } else {
      results.failed++;
    }
  } catch (error) {
    results.tests.push({
      name: 'Migration Detection',
      passed: false,
      error: error.message
    });
    results.failed++;
  }

  // Test 6: Non-sensitive data handling
  try {
    const nonSensitiveKey = 'theme';
    const nonSensitiveData = 'dark';
    
    // Store non-sensitive data (should not be encrypted)
    const storeSuccess = setEncryptedItem(nonSensitiveKey, nonSensitiveData, testUsername);
    const storedValue = localStorage.getItem(nonSensitiveKey);
    
    // Should be stored as plain text
    const isPlain = storedValue === nonSensitiveData;
    
    // Retrieve non-sensitive data
    const retrievedData = getEncryptedItem(nonSensitiveKey, testUsername);
    const dataMatches = nonSensitiveData === retrievedData;
    
    // Cleanup
    localStorage.removeItem(nonSensitiveKey);
    
    results.tests.push({
      name: 'Non-Sensitive Data Handling',
      passed: storeSuccess && isPlain && dataMatches,
      details: {
        storeSuccess,
        isPlain,
        dataMatches,
        originalData: nonSensitiveData,
        storedValue,
        retrievedData
      }
    });
    
    if (storeSuccess && isPlain && dataMatches) {
      results.passed++;
    } else {
      results.failed++;
    }
  } catch (error) {
    results.tests.push({
      name: 'Non-Sensitive Data Handling',
      passed: false,
      error: error.message
    });
    results.failed++;
  }

  // Print results
  console.log('🔐 Encryption Test Results:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total: ${results.passed + results.failed}`);
  
  results.tests.forEach(test => {
    const status = test.passed ? '✅' : '❌';
    console.log(`${status} ${test.name}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
    if (test.details) {
      console.log('   Details:', test.details);
    }
  });

  return results;
}

/**
 * Test performance of encryption/decryption
 */
export function testEncryptionPerformance() {
  console.log('⚡ Testing encryption performance...');
  
  const key = generateEncryptionKey(testUsername);
  const largeData = {
    entries: Array(100).fill(0).map((_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      type: 'Regular',
      intervals: [
        { in: '09:00:00', out: '12:00:00' },
        { in: '13:00:00', out: '17:00:00' }
      ],
      notes: 'This is a test entry with some additional text to simulate real data'
    }))
  };
  
  // Test encryption performance
  const encryptStart = performance.now();
  const encrypted = encryptData(largeData, key);
  const encryptEnd = performance.now();
  const encryptTime = encryptEnd - encryptStart;
  
  // Test decryption performance
  const decryptStart = performance.now();
  const decrypted = decryptData(encrypted, key);
  const decryptEnd = performance.now();
  const decryptTime = decryptEnd - decryptStart;
  
  console.log('📊 Performance Results:');
  console.log(`🔒 Encryption: ${encryptTime.toFixed(2)}ms`);
  console.log(`🔓 Decryption: ${decryptTime.toFixed(2)}ms`);
  console.log(`⏱️  Total: ${(encryptTime + decryptTime).toFixed(2)}ms`);
  console.log(`📏 Data size: ${JSON.stringify(largeData).length} chars`);
  
  return {
    encryptTime,
    decryptTime,
    totalTime: encryptTime + decryptTime,
    dataSize: JSON.stringify(largeData).length
  };
}

/**
 * Run all tests
 */
export function runAllTests() {
  console.log('🚀 Running comprehensive encryption tests...\n');
  
  const encryptionResults = runEncryptionTests();
  console.log('\n');
  const performanceResults = testEncryptionPerformance();
  
  return {
    encryption: encryptionResults,
    performance: performanceResults
  };
}

// Auto-run tests if this file is executed directly
if (typeof window !== 'undefined') {
  // Make functions available globally for easy testing in browser console
  window.runEncryptionTests = runEncryptionTests;
  window.testEncryptionPerformance = testEncryptionPerformance;
  window.runAllTests = runAllTests;
  
  console.log('🔐 Encryption test utilities loaded!');
  console.log('Run runAllTests() in the console to test encryption functionality.');
}
