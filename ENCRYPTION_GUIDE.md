# TimeTracker App - Encryption Implementation Guide

## Overview

This document explains the AES-256 encryption implementation for protecting sensitive user data in the TimeTracker App. All sensitive data stored in localStorage is now encrypted using the CryptoJS library.

## 🔐 What Gets Encrypted

### Sensitive Data (Encrypted):
- `users` - Contains usernames, password hashes, and creation dates
- `currentUser` - Current user session information
- `salary_[username]` - User salary information
- `fullName_[username]` - User full name
- `timeEntries_[username]` - All time tracking entries
- `payPeriods_[username]` - Pay period configurations
- `annualVacation_[username]` - Annual vacation days
- `sickDays_[username]` - Sick days allocation
- `currentPeriodId_[username]` - Current selected pay period

### Non-Sensitive Data (Plain Text):
- `theme` - UI theme preference
- `use12HourFormat` - Time format preference
- `detailedView` - View preference
- `hideSalary` - Salary visibility toggle
- `migrationVersion` - Migration tracking
- `lastBackupDate` - Last backup timestamp
- `dismissedBackupReminder` - Backup reminder preference

## 🛠️ Implementation Details

### Encryption Algorithm
- **Algorithm**: AES-256
- **Library**: CryptoJS v4.2.0
- **Key Generation**: SHA-256 hash of username + device fingerprint
- **Data Format**: Base64 encoded with "encrypted:" prefix

### Key Generation
The encryption key is generated using:
```javascript
const fingerprint = [
  navigator.userAgent,
  navigator.language,
  navigator.platform,
  screen.width,
  screen.height,
  screen.colorDepth,
  timezoneOffset,
  localStorage.getItem('theme'),
  localStorage.getItem('use12HourFormat')
].join('|');

const key = CryptoJS.SHA256(`${username}@${fingerprint}`).toString();
```

This ensures:
- Keys are unique per user
- Keys are unique per device/browser
- Same user on different devices has different keys
- Keys are deterministic (same for same user/device combo)

### Data Storage Format
Encrypted data is stored with the prefix `encrypted:` to identify it:
```
encrypted:U2FsdGVkX1+vupppZksvRf5pq5g5XjFRIipRkwB0K1Y96Psv...
```

## 📁 File Structure

```
src/
├── utils/
│   ├── encryption.js          # Core encryption utilities
│   ├── encryption.test.js     # Test suite
│   └── storage.js            # Updated storage utilities
├── context/
│   ├── AuthContext.jsx       # Updated with encryption
│   └── TimeTrackerContext.jsx # Updated with encryption
```

## 🔄 Migration Process

### Automatic Migration
When a user logs in, the system automatically:
1. Checks if migration is needed (`needsMigration()`)
2. Migrates existing plain-text data to encrypted format (`migrateToEncrypted()`)
3. Sets `migrationVersion` to prevent re-migration

### Migration Steps
1. Identify all sensitive localStorage keys
2. Read existing plain-text data
3. Encrypt data using user-specific key
4. Store encrypted data back to localStorage
5. Remove plain-text data

## 🧪 Testing

### Running Tests
In the browser console:
```javascript
// Run all tests
runAllTests();

// Run specific tests
runEncryptionTests();
testEncryptionPerformance();
```

### Test Coverage
- ✅ Encryption key generation
- ✅ Sensitive field detection
- ✅ Data encryption/decryption
- ✅ localStorage operations
- ✅ Migration detection
- ✅ Non-sensitive data handling
- ✅ Performance benchmarks

## 🚀 Usage Examples

### Encrypting Data
```javascript
import { setEncryptedItem, getEncryptedItem } from './utils/encryption';

// Save sensitive data
setEncryptedItem('salary_john', 75000, 'john');

// Retrieve sensitive data
const salary = getEncryptedItem('salary_john', 'john');
```

### Using Updated Storage Utils
```javascript
import { saveToStorage, loadFromStorage } from './utils/storage';

// Automatically encrypts if sensitive
saveToStorage('timeEntries_john', entries, 'john');

// Automatically decrypts if sensitive
const entries = loadFromStorage('timeEntries_john', 'john');
```

## 🔒 Security Considerations

### Key Security
- Keys are derived from user + device fingerprint
- Keys are not stored anywhere
- Keys are generated deterministically
- Different devices = different keys

### Data Protection
- All sensitive data is encrypted at rest
- Password hashes remain SHA-256 encrypted
- Data is only decrypted when needed
- Failed decryption returns original data (prevents loss)

### Limitations
- Client-side encryption only (protects against local access)
- Keys can be derived by anyone with device access
- Not a replacement for server-side security
- Browser developer tools can still access data

## 📊 Performance

### Benchmarks
- Encryption: ~1-5ms for typical data
- Decryption: ~1-3ms for typical data
- Large datasets (100+ entries): ~10-20ms
- Negligible impact on user experience

### Optimization
- Encryption only for sensitive data
- Non-sensitive data remains fast
- Cached key generation
- Efficient JSON parsing

## 🔄 Backward Compatibility

### Existing Data
- Automatically detected and migrated
- No data loss during migration
- Seamless transition for users
- Migration version tracking

### API Compatibility
- Existing `saveUserData()`/`getUserData()` work unchanged
- Storage utilities updated transparently
- No breaking changes for components

## 🛠️ Maintenance

### Adding New Sensitive Fields
Update `SENSITIVE_FIELDS` array in `encryption.js`:
```javascript
const SENSITIVE_FIELDS = [
  'users',
  'currentUser',
  /^salary_.*/,
  // Add new patterns here
];
```

### Changing Encryption Parameters
- Update key generation in `generateEncryptionKey()`
- Update algorithm in `encryptData()`/`decryptData()`
- Increment `migrationVersion` to force re-migration

## 🚨 Troubleshooting

### Common Issues

#### Data Not Decrypting
```javascript
// Check if key is correct
const key = generateEncryptionKey(username);
const isValid = validateEncryptionKey(username, key);
```

#### Migration Issues
```javascript
// Check migration status
const needsMigrate = needsMigration(username);

// Force migration
const result = migrateToEncrypted(username);
console.log('Migration result:', result);
```

#### Performance Issues
```javascript
// Test performance
const perf = testEncryptionPerformance();
console.log('Performance:', perf);
```

### Debug Mode
Add to console for debugging:
```javascript
// View all sensitive keys
const keys = getSensitiveKeysForUser('username');
console.log('Sensitive keys:', keys);

// Check encryption status
Object.keys(localStorage).forEach(key => {
  const value = localStorage.getItem(key);
  const isEncrypted = value.startsWith('encrypted:');
  console.log(`${key}: ${isEncrypted ? 'encrypted' : 'plain'}`);
});
```

## 📝 Version History

### v1.0.0 (Current)
- Initial AES-256 encryption implementation
- Automatic migration from plain-text
- Per-user/device key generation
- Comprehensive test suite
- Performance optimization

## 🔮 Future Enhancements

### Potential Improvements
- Web Crypto API integration
- Key rotation support
- Additional encryption algorithms
- Server-side key management
- Hardware security module integration

### Security Hardening
- Memory protection for keys
- Secure key derivation functions
- Tamper detection
- Audit logging

---

**Note**: This encryption protects against unauthorized local access to localStorage data. For comprehensive security, combine with proper authentication, HTTPS, and server-side security measures.
