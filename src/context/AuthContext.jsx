import React, { createContext, useContext, useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import { setSimpleEncryptedItem, getSimpleEncryptedItem } from '../utils/simple-encryption';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAppLoading, setIsAppLoading] = useState(false);

  // Password encryption
  const hashPassword = (password) => {
    return CryptoJS.SHA256(password).toString();
  };

  // Initialize auth state on mount
  useEffect(() => {
    // Simple approach - try to decrypt with simple encryption, ignore old encrypted data
    let savedUser = null;
    
    try {
      const rawData = localStorage.getItem('currentUser');
      if (!rawData) {
        console.log('No user data found in localStorage');
        setIsLoading(false);
        return;
      }
      
      if (rawData.startsWith('encrypted:')) {
        console.log('Found encrypted currentUser, attempting to decrypt with simple encryption...');
        
        // Try simple decryption first
        try {
          // We need to extract username from localStorage to try decryption
          const allKeys = Object.keys(localStorage);
          const userKeys = allKeys.filter(key => key.includes('_peter_ashraf') || key === 'users');
          
          if (userKeys.length > 0) {
            // Try with peter_ashraf username first (most likely)
            const decryptedData = getSimpleEncryptedItem('currentUser', 'peter_ashraf');
            if (decryptedData && decryptedData.username) {
              savedUser = decryptedData;
              console.log(`Successfully decrypted user: ${savedUser.username}`);
            }
          }
        } catch (decryptError) {
          console.log('Simple decryption failed, treating as fresh start');
        }
      } else {
        // Plain text data, parse it
        try {
          savedUser = JSON.parse(rawData);
          console.log(`Loaded plain text user: ${savedUser.username}`);
        } catch (parseError) {
          console.log('Failed to parse as plain text, treating as fresh start');
          savedUser = null;
        }
      }
    } catch (error) {
      console.error('Error loading currentUser:', error);
      savedUser = null;
    }
    
    if (savedUser) {
      setCurrentUser(savedUser);
      setIsAuthenticated(true);
    }
    
    setIsLoading(false);
  }, []);

  // Check and migrate existing data for new users
  const checkAndMigrateExistingData = (username) => {
    // Check if there's old-format data (without user prefix)
    const oldEntries = localStorage.getItem('timeEntries');
    const oldPeriods = localStorage.getItem('payPeriods');
    const oldEmployee = localStorage.getItem('fullName');
    const oldSalary = localStorage.getItem('salary');
    const oldLeaveSettings = localStorage.getItem('annualVacation');
    const oldSickDays = localStorage.getItem('sickDays');

    // Check if current user has user-specific data
    const hasUserSpecificData = localStorage.getItem(`timeEntries_${username}`) ||
      localStorage.getItem(`payPeriods_${username}`) ||
      localStorage.getItem(`fullName_${username}`) ||
      localStorage.getItem(`salary_${username}`) ||
      localStorage.getItem(`annualVacation_${username}`) ||
      localStorage.getItem(`sickDays_${username}`);

    // If user has no data but old data exists, offer migration
    if (!hasUserSpecificData && (oldEntries || oldPeriods || oldEmployee || oldSalary || oldLeaveSettings || oldSickDays)) {
      const userChoice = confirm(
        'Existing data found!\n\n' +
        'We found previous timesheet data in old format.\n\n' +
        'Would you like to:\n' +
        '• OK: Assign existing data to your account\n' +
        '• Cancel: Start with fresh data\n\n' +
        'Your choice will affect all users.'
      );

      if (userChoice) {
        // User chose to assign existing data
        try {
          if (oldEntries) {
            setSimpleEncryptedItem(`timeEntries_${username}`, oldEntries, username);
            localStorage.removeItem('timeEntries');
          }

          if (oldPeriods) {
            setSimpleEncryptedItem(`payPeriods_${username}`, oldPeriods, username);
            localStorage.removeItem('payPeriods');
          }

          if (oldEmployee) {
            setSimpleEncryptedItem(`fullName_${username}`, oldEmployee, username);
            localStorage.removeItem('fullName');
          }

          if (oldSalary) {
            setSimpleEncryptedItem(`salary_${username}`, oldSalary, username);
            localStorage.removeItem('salary');
          }

          if (oldLeaveSettings) {
            setSimpleEncryptedItem(`annualVacation_${username}`, oldLeaveSettings, username);
            localStorage.removeItem('annualVacation');
          }

          if (oldSickDays) {
            setSimpleEncryptedItem(`sickDays_${username}`, oldSickDays, username);
            localStorage.removeItem('sickDays');
          }

          console.log(`✅ Migrated existing data to user: ${username}`);
          return true;
        } catch (error) {
          console.error('Error migrating data:', error);
        }
      } else {
        // User chose to start fresh - remove old data
        try {
          localStorage.removeItem('timeEntries');
          localStorage.removeItem('payPeriods');
          localStorage.removeItem('fullName');
          localStorage.removeItem('salary');
          localStorage.removeItem('annualVacation');
          localStorage.removeItem('sickDays');
          console.log(`✅ User chose to start fresh - old data removed`);
          return false;
        } catch (error) {
          console.error('Error removing old data:', error);
        }
      }
    }

    // CRITICAL: Clean up any remaining old-format data to prevent sharing
    if (oldEntries) localStorage.removeItem('timeEntries');
    if (oldPeriods) localStorage.removeItem('payPeriods');
    if (oldEmployee) localStorage.removeItem('fullName');
    if (oldSalary) localStorage.removeItem('salary');
    if (oldLeaveSettings) localStorage.removeItem('annualVacation');
    if (oldSickDays) localStorage.removeItem('sickDays');
    
    return false;
  };

  // User registration
  const register = (username, password) => {
    // Get existing users (handle both encrypted and plain text)
    let users = {};
    
    try {
      const usersRaw = localStorage.getItem('users');
      if (usersRaw) {
        if (usersRaw.startsWith('encrypted:')) {
          // Users data is encrypted, try to decrypt with the new username
          try {
            users = getSimpleEncryptedItem('users', username) || {};
          } catch (decryptError) {
            // If that fails, try to find any existing user that can decrypt it
            console.log('🔐 Trying to decrypt users data for registration...');
            
            const allKeys = Object.keys(localStorage);
            const userSpecificKeys = allKeys.filter(key => 
              key.includes('_') && !key.startsWith('__') && key !== 'users' && key !== 'currentUser'
            );
            
            const potentialUsernames = [...new Set(
              userSpecificKeys.map(key => {
                const parts = key.split('_');
                return parts.length > 1 ? parts.slice(1).join('_') : null;
              }).filter(Boolean)
            )];
            
            for (const potentialUsername of potentialUsernames) {
              try {
                users = getSimpleEncryptedItem('users', potentialUsername) || {};
                if (users && typeof users === 'object' && Object.keys(users).length > 0) {
                  console.log(`✅ Successfully decrypted users data with username: ${potentialUsername}`);
                  break;
                }
              } catch (error) {
                continue;
              }
            }
          }
        } else {
          // Plain text users data
          try {
            users = JSON.parse(usersRaw);
          } catch (parseError) {
            console.log('Failed to parse users data as plain text, treating as empty');
            users = {};
          }
        }
      }
    } catch (error) {
      console.error('Error loading users data for registration:', error);
      users = {};
    }

    // Check if username already exists
    if (users[username]) {
      throw new Error('Username already exists');
    }

    // Validate username
    if (username.length < 3) {
      throw new Error('Username must be at least 3 characters');
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new Error('Username can only contain letters, numbers, and underscores');
    }

    // Validate password
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // Store new user with hashed password
    users[username] = {
      username,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };

    setSimpleEncryptedItem('users', users, username);
    return true;
  };

  // User login
  const login = (username, password) => {
    // Simple, reliable approach - no complex key generation
    let users = {};
    
    try {
      const usersRaw = localStorage.getItem('users');
      console.log('🔍 Raw users data:', usersRaw ? usersRaw.substring(0, 50) + '...' : 'null');
      
      if (usersRaw) {
        if (usersRaw.startsWith('encrypted:')) {
          console.log('🔐 Users data is encrypted, trying to decrypt...');
          try {
            users = getSimpleEncryptedItem('users', username) || {};
            console.log('🔑 Decrypted users data:', Object.keys(users).length, 'users');
          } catch (decryptError) {
            console.log('❌ Failed to decrypt users data:', decryptError.message);
            // If decryption fails, treat as no users
            users = {};
          }
        } else {
          // Plain text users data
          try {
            users = JSON.parse(usersRaw);
            console.log('📄 Loaded plain text users data:', Object.keys(users).length, 'users');
          } catch (parseError) {
            console.log('Failed to parse users data as plain text, treating as empty');
            users = {};
          }
        }
      }
    } catch (error) {
      console.error('Error loading users data:', error);
      users = {};
    }
    
    const user = users[username];

    if (!user) {
      throw new Error('Invalid username or password');
    }

    const passwordHash = hashPassword(password);
    if (user.passwordHash !== passwordHash) {
      throw new Error('Invalid username or password');
    }

    // Set current user session with simple encryption
    const userData = { username, createdAt: user.createdAt };
    setCurrentUser(userData);
    setIsAuthenticated(true);
    setSimpleEncryptedItem('currentUser', userData, username);
    
    console.log(`✅ User logged in: ${username}`);
    
    // Trigger app loading animation
    setIsAppLoading(true);
    
    // Simulate app loading data
    setTimeout(() => {
      setIsAppLoading(false);
    }, 2000); // 2 seconds loading animation
    
    return true;
  };

  // User logout
  const logout = () => {
    console.log(`✅ User logged out: ${currentUser?.username}`);
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('currentUser');
  };

  // Get user-specific data key
  const getUserDataKey = (dataType) => {
    return currentUser ? `${dataType}_${currentUser.username}` : dataType;
  };

  // ✅ FIXED: Save user-specific data (handle both string and object)
  const saveUserData = (dataType, data) => {
    if (!currentUser) return;
    
    const key = getUserDataKey(dataType);
    
    // Use encryption for sensitive data
    setSimpleEncryptedItem(key, data, currentUser.username);
  };

  // Get user-specific data
  const getUserData = (dataType) => {
    if (!currentUser) {
      // Return default values based on data type
      switch(dataType) {
        case 'timeEntries':
          return [];
        case 'payPeriods':
          return [{
            id: 'period-default',
            label: '23 Jan - 20 Feb 2026',
            start: '2026-01-23',
            end: '2026-02-20'
          }];
        case 'currentPeriodId':
          return 'period-default';
        case 'fullName':
          return '';
        case 'salary':
          return 0;
        case 'annualVacation':
          return 10;
        case 'sickDays':
          return 7;
        default:
          return null;
      }
    }

    const key = getUserDataKey(dataType);
    const data = getSimpleEncryptedItem(key, currentUser.username);

    if (!data) {
      // Return default values if no data exists
      switch(dataType) {
        case 'timeEntries':
          return [];
        case 'payPeriods':
          return [{
            id: 'period-default',
            label: '23 Jan - 20 Feb 2026',
            start: '2026-01-23',
            end: '2026-02-20'
          }];
        case 'currentPeriodId':
          return 'period-default';
        case 'fullName':
          return '';
        case 'salary':
          return 0;
        case 'annualVacation':
          return 10;
        case 'sickDays':
          return 7;
        default:
          return null;
      }
    }

    // Try to return data as-is (already parsed by getSimpleEncryptedItem)
    return data;
  };

  // Delete user account
  const deleteUser = (username) => {
    const users = getSimpleEncryptedItem('users', username) || {};

    if (!users[username]) {
      throw new Error('User not found');
    }

    // Delete user data
    Object.keys(localStorage).forEach(key => {
      if (key.includes(`_${username}`)) {
        localStorage.removeItem(key);
      }
    });

    // Delete user account
    delete users[username];
    setSimpleEncryptedItem('users', users, username);

    // Logout if deleting current user
    if (currentUser && currentUser.username === username) {
      logout();
    }
  };

  const value = {
    currentUser,
    isAuthenticated,
    isLoading,
    isAppLoading,
    register,
    login,
    logout,
    deleteUser,
    getUserData,
    saveUserData,
    getUserDataKey
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
