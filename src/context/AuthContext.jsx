import React, { createContext, useContext, useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';

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

  // Password encryption
  const hashPassword = (password) => {
    return CryptoJS.SHA256(password).toString();
  };

  // Initialize auth state on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setIsAuthenticated(true);
      
      // Check for existing data that needs migration
      checkAndMigrateExistingData(user.username);
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
            localStorage.setItem(`timeEntries_${username}`, oldEntries);
            localStorage.removeItem('timeEntries');
          }

          if (oldPeriods) {
            localStorage.setItem(`payPeriods_${username}`, oldPeriods);
            localStorage.removeItem('payPeriods');
          }

          if (oldEmployee) {
            localStorage.setItem(`fullName_${username}`, oldEmployee);
            localStorage.removeItem('fullName');
          }

          if (oldSalary) {
            localStorage.setItem(`salary_${username}`, oldSalary);
            localStorage.removeItem('salary');
          }

          if (oldLeaveSettings) {
            localStorage.setItem(`annualVacation_${username}`, oldLeaveSettings);
            localStorage.removeItem('annualVacation');
          }

          if (oldSickDays) {
            localStorage.setItem(`sickDays_${username}`, oldSickDays);
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
    // Get existing users
    const users = JSON.parse(localStorage.getItem('users') || '{}');

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

    localStorage.setItem('users', JSON.stringify(users));
    return true;
  };

  // User login
  const login = (username, password) => {
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    const user = users[username];

    if (!user) {
      throw new Error('Invalid username or password');
    }

    const passwordHash = hashPassword(password);
    if (user.passwordHash !== passwordHash) {
      throw new Error('Invalid username or password');
    }

    // Set current user session
    const userData = { username, createdAt: user.createdAt };
    setCurrentUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('currentUser', JSON.stringify(userData));
    
    console.log(`✅ User logged in: ${username}`);
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
    
    // Handle different data types
    if (typeof data === 'string' || typeof data === 'number') {
      localStorage.setItem(key, String(data));
    } else {
      localStorage.setItem(key, JSON.stringify(data));
    }
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
    const data = localStorage.getItem(key);

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

    // Try to parse as JSON, fallback to raw string
    try {
      return JSON.parse(data);
    } catch (e) {
      // If parsing fails, return as is (for string/number values)
      return data;
    }
  };

  // Delete user account
  const deleteUser = (username) => {
    const users = JSON.parse(localStorage.getItem('users') || '{}');

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
    localStorage.setItem('users', JSON.stringify(users));

    // Logout if deleting current user
    if (currentUser && currentUser.username === username) {
      logout();
    }
  };

  const value = {
    currentUser,
    isAuthenticated,
    isLoading,
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
