import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import CryptoJS from 'crypto-js';
import { setSimpleEncryptedItem, getSimpleEncryptedItem } from '../utils/simple-encryption';
import { multiTabSync } from '../utils/multiTabSync';

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
  const [sessionTimeout, setSessionTimeout] = useState(30); // Default 30 minutes
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [sessionTimer, setSessionTimer] = useState(null);
  const [warningTimer, setWarningTimer] = useState(null);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [immediateWarningShown, setImmediateWarningShown] = useState(false);
  const lastActivityRef = useRef(lastActivity);
  
  // Update ref when lastActivity changes
  useEffect(() => {
    lastActivityRef.current = lastActivity;
  }, [lastActivity]);

  // Password encryption
  const hashPassword = (password) => {
    return CryptoJS.SHA256(password).toString();
  };

  // Session management functions
  const updateLastActivity = useCallback(() => {
    const now = Date.now();
    setLastActivity(now);
    if (currentUser) {
      localStorage.setItem(`lastActivity_${currentUser.username}`, now.toString());
    }
  }, [currentUser]);

  const isSessionExpired = useCallback(() => {
    if (!currentUser || sessionTimeout === 0) return false; // 0 means never expire
    const now = Date.now();
    const inactiveTime = now - lastActivity;
    const maxInactiveTime = sessionTimeout * 60 * 1000; // Convert minutes to milliseconds
    return inactiveTime > maxInactiveTime;
  }, [currentUser, sessionTimeout, lastActivity]);

  const clearSessionTimer = useCallback(() => {
    if (sessionTimer) {
      clearTimeout(sessionTimer);
      setSessionTimer(null);
    }
  }, [sessionTimer]);

  const clearWarningTimer = useCallback(() => {
    if (warningTimer) {
      clearTimeout(warningTimer);
      setWarningTimer(null);
    }
  }, [warningTimer]);

  const clearAllTimers = useCallback(() => {
    clearSessionTimer();
    clearWarningTimer();
    setShowSessionWarning(false);
    setImmediateWarningShown(false); // Reset flag
  }, [clearSessionTimer, clearWarningTimer]);

  const startSessionTimer = useCallback(() => {
    clearAllTimers();
    
    if (currentUser && sessionTimeout > 0) {
      // Show warning 5 minutes before session expires (for any session with timeout)
      const warningTime = (sessionTimeout - 5) * 60 * 1000; // 5 minutes before expiry
      const warningTimerId = setTimeout(() => {
        const now = Date.now();
        const inactiveTime = now - lastActivityRef.current;
        const maxInactiveTime = sessionTimeout * 60 * 1000;
        
        // Only show warning if session hasn't been kept alive by activity
        // and exactly 5 minutes remaining
        const timeRemaining = maxInactiveTime - inactiveTime;
        if (timeRemaining <= 5 * 60 * 1000 && timeRemaining > 0) {
          
          setShowSessionWarning(true);
        }
      }, warningTime);
      setWarningTimer(warningTimerId);
      
      // For sessions <= 5 minutes, show warning immediately after a short delay
      if (sessionTimeout <= 5) {
        setTimeout(() => {
          
          setShowSessionWarning(true);
        }, 1500); // Wait 1.5 seconds for UI to settle
      }
      
      const timer = setTimeout(() => {
        // Check session expiration directly here and logout inline
        if (!currentUser || sessionTimeout === 0) return;
        const now = Date.now();
        const inactiveTime = now - lastActivityRef.current;
        const maxInactiveTime = sessionTimeout * 60 * 1000;
        if (inactiveTime > maxInactiveTime) {
          console.log('Session expired, logging out user');
          const username = currentUser?.username;
          clearSessionTimer();
          clearWarningTimer();
          setShowSessionWarning(false);
          setCurrentUser(null);
          setIsAuthenticated(false);
          localStorage.removeItem('currentUser');
          if (username) {
            localStorage.removeItem(`lastActivity_${username}`);
            multiTabSync.notifyUserLogout(username);
          }
        }
      }, sessionTimeout * 60 * 1000);
      setSessionTimer(timer);
    }
  }, [clearAllTimers, currentUser, sessionTimeout]);

  const loadSessionSettings = (username) => {
    if (!username) return;
    
    try {
      const settings = getSimpleEncryptedItem(`sessionSettings_${username}`, username);
      if (settings && settings.timeout !== undefined) {
        setSessionTimeout(settings.timeout);
      }
      
      const activity = localStorage.getItem(`lastActivity_${username}`);
      if (activity) {
        setLastActivity(parseInt(activity, 10));
      }
    } catch (error) {
      console.error('Error loading session settings:', error);
    }
  };

  const saveSessionSettings = (timeout) => {
    if (!currentUser) return;
    
    try {
      const settings = { timeout };
      setSimpleEncryptedItem(`sessionSettings_${currentUser.username}`, settings, currentUser.username);
      setSessionTimeout(timeout);
      // Timer will be restarted by the useEffect when sessionTimeout changes
    } catch (error) {
      console.error('Error saving session settings:', error);
    }
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
        
        // Try simple decryption first - we need username but we don't have it yet
        // Let's try to get it from existing session data
        const allKeys = Object.keys(localStorage);
        const sessionKeys = allKeys.filter(key => key.includes('lastActivity_'));
        
        if (sessionKeys.length > 0) {
          // Extract username from lastActivity key
          const activityKey = sessionKeys[0];
          const username = activityKey.replace('lastActivity_', '');
          
          try {
            savedUser = getSimpleEncryptedItem('currentUser', username);
            if (savedUser && savedUser.username) {
              console.log(`✅ Successfully decrypted user: ${savedUser.username}`);
            }
          } catch (decryptError) {
            console.log('❌ Decryption failed with username:', username);
          }
        }
        
        // If still no user, try all possible usernames from user data
        if (!savedUser) {
          try {
            const usersData = localStorage.getItem('users');
            if (usersData && usersData.startsWith('encrypted:')) {
              // Try to find any user that can decrypt the data
              const userKeys = allKeys.filter(key => key.includes('_') && !key.startsWith('__') && key !== 'users' && key !== 'currentUser');
              const possibleUsernames = [...new Set(
                userKeys.map(key => {
                  const parts = key.split('_');
                  return parts.length > 1 ? parts.slice(1).join('_') : null;
                }).filter(Boolean)
              )];
              
              for (const username of possibleUsernames) {
                try {
                  savedUser = getSimpleEncryptedItem('currentUser', username);
                  if (savedUser && savedUser.username) {
                    console.log(`✅ Successfully decrypted with username: ${username}`);
                    break;
                  }
                } catch (error) {
                  continue;
                }
              }
            }
          } catch (error) {
            console.log('Failed to get users data');
          }
        }
      } else {
        // Plain text data, parse it
        try {
          savedUser = JSON.parse(rawData);
          console.log(`✅ Loaded plain text user: ${savedUser.username}`);
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
      // Get session settings synchronously FIRST
      let timeout = 30; // default
      let activity = null;
      
      try {
        const settings = getSimpleEncryptedItem(`sessionSettings_${savedUser.username}`, savedUser.username);
        if (settings && settings.timeout !== undefined) {
          timeout = settings.timeout;
        }
        
        activity = localStorage.getItem(`lastActivity_${savedUser.username}`);
      } catch (error) {
        console.error('Error loading session settings:', error);
      }
      
      // Now check if session has expired
      const now = Date.now();
      const lastAct = activity ? parseInt(activity, 10) : now;
      const inactiveTime = now - lastAct;
      const maxInactiveTime = timeout * 60 * 1000;
      
      if (timeout > 0 && inactiveTime > maxInactiveTime) {
        console.log('Session expired on mount, logging out');
        const username = savedUser?.username;
        clearAllTimers();
        setCurrentUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('currentUser');
        if (username) {
          localStorage.removeItem(`lastActivity_${username}`);
          multiTabSync.notifyUserLogout(username);
        }
        savedUser = null;
      } else {
        console.log(`✅ Session valid for user: ${savedUser.username}, timeout: ${timeout} minutes`);
        // Set state after validation
        setSessionTimeout(timeout);
        if (activity) {
          setLastActivity(parseInt(activity, 10));
        }
        setCurrentUser(savedUser);
        setIsAuthenticated(true);
      }
    }
    
    setIsLoading(false);
  }, []);

  // Session management effect
  useEffect(() => {
    if (currentUser && isAuthenticated) {
      // Check if session is expired on mount
      const now = Date.now();
      const inactiveTime = now - lastActivityRef.current;
      const maxInactiveTime = sessionTimeout * 60 * 1000;
      
      if (sessionTimeout > 0 && inactiveTime > maxInactiveTime) {
        console.log('Session expired on mount, logging out');
        const username = currentUser?.username;
        clearSessionTimer();
        clearWarningTimer();
        setShowSessionWarning(false);
        setCurrentUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('currentUser');
        if (username) {
          localStorage.removeItem(`lastActivity_${username}`);
          multiTabSync.notifyUserLogout(username);
        }
        return;
      }
      
      // Start session timer
      startSessionTimer();
      
      // Set up activity monitoring
      const handleActivity = () => {
        const now = Date.now();
        setLastActivity(now);
        setShowSessionWarning(false); // Hide warning on any activity
        if (currentUser) {
          localStorage.setItem(`lastActivity_${currentUser.username}`, now.toString());
        }
        startSessionTimer(); // Restart timer on activity
      };
      
      // Monitor various user activities
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
      events.forEach(event => {
        document.addEventListener(event, handleActivity);
      });
      
      // Check session expiration periodically
      const checkInterval = setInterval(() => {
        const now = Date.now();
        const inactiveTime = now - lastActivityRef.current;
        const maxInactiveTime = sessionTimeout * 60 * 1000;
        const timeRemaining = maxInactiveTime - inactiveTime;
        
        // Show warning when 5 minutes or less remaining
        if (timeRemaining <= 5 * 60 * 1000 && timeRemaining > 0 && !showSessionWarning) {
          console.log('⏰ 5 minutes or less remaining - showing warning');
          console.log('Time remaining:', timeRemaining / 1000 / 60, 'minutes');
          setShowSessionWarning(true);
        }
        
        if (sessionTimeout > 0 && inactiveTime > maxInactiveTime) {
          console.log('Session expired during check, logging out');
          const username = currentUser?.username;
          clearAllTimers();
          setCurrentUser(null);
          setIsAuthenticated(false);
          localStorage.removeItem('currentUser');
          if (username) {
            localStorage.removeItem(`lastActivity_${username}`);
            multiTabSync.notifyUserLogout(username);
          }
        }
      }, 10000); // Check every 10 seconds for more precise timing
      
      return () => {
        // Cleanup
        clearSessionTimer();
        clearWarningTimer();
        setShowSessionWarning(false);
        events.forEach(event => {
          document.removeEventListener(event, handleActivity);
        });
        clearInterval(checkInterval);
      };
    } else {
      clearSessionTimer();
      clearWarningTimer();
      setShowSessionWarning(false);
    }
  }, [currentUser, isAuthenticated, sessionTimeout, showSessionWarning, immediateWarningShown]); // Added all dependencies

  // Listen for multi-tab authentication events
  useEffect(() => {
    const handleMultiTabAuthEvent = (event, data) => {
      switch (event) {
        case 'data_change':
          if (data.dataType === 'user_login') {
            // Another tab logged in, refresh our state
            if (data.data && data.data.username) {
              setCurrentUser(data.data);
              setIsAuthenticated(true);
              console.log(`📡 User logged in from another tab: ${data.data.username}`);
            }
          }
          break;
        case 'user_logout':
          // Another tab logged out, log out here too
          if (data.username === currentUser?.username) {
            setCurrentUser(null);
            setIsAuthenticated(false);
            console.log(`📡 User logged out from another tab: ${data.username}`);
          }
          break;
      }
    };

    multiTabSync.addListener(handleMultiTabAuthEvent);
    
    return () => {
      multiTabSync.removeListener(handleMultiTabAuthEvent);
    };
  }, [currentUser]);

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
          // Users data is encrypted, try to decrypt with ALL possible usernames to find existing users
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
          
          // Try all possible usernames to decrypt existing users
          for (const potentialUsername of potentialUsernames) {
            try {
              const decryptedUsers = getSimpleEncryptedItem('users', potentialUsername) || {};
              if (decryptedUsers && typeof decryptedUsers === 'object' && Object.keys(decryptedUsers).length > 0) {
                console.log(`✅ Successfully decrypted existing users with username: ${potentialUsername}`);
                users = decryptedUsers;
                break;
              }
            } catch (error) {
              continue;
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

    // Save merged users data with current username as key
    // This preserves existing users while adding the new one
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
            // First try with current username
            users = getSimpleEncryptedItem('users', username) || {};
            
            // If that fails, try all possible usernames from localStorage
            if (Object.keys(users).length === 0) {
              console.log('🔄 Current username failed, trying all possible usernames...');
              const allKeys = Object.keys(localStorage);
              const userKeys = allKeys.filter(key => key.includes('_') && !key.startsWith('__') && key !== 'users' && key !== 'currentUser');
              const possibleUsernames = [...new Set(
                userKeys.map(key => {
                  const parts = key.split('_');
                  return parts.length > 1 ? parts.slice(1).join('_') : null;
                }).filter(Boolean)
              )];
              
              // Add common variations and case-insensitive matches
              const allVariations = [];
              possibleUsernames.forEach(username => {
                if (username) {
                  allVariations.push(username);
                  allVariations.push(username.toLowerCase());
                  allVariations.push(username.toUpperCase());
                  // Remove common suffixes/prefixes
                  const baseUsername = username.replace(/_t$/, '');
                  allVariations.push(baseUsername);
                  allVariations.push(baseUsername.toLowerCase());
                  allVariations.push(baseUsername.toUpperCase());
                }
              });
              
              const uniqueUsernames = [...new Set(allVariations)];
              
              for (const tryUsername of uniqueUsernames) {
                try {
                  users = getSimpleEncryptedItem('users', tryUsername) || {};
                  if (users && typeof users === 'object' && Object.keys(users).length > 0) {
                    console.log(`✅ Successfully decrypted users with username: ${tryUsername}`);
                    console.log('👥 Decrypted users object:', JSON.stringify(users, null, 2));
                    console.log('👥 User keys found:', Object.keys(users));
                    Object.keys(users).forEach(username => {
                      console.log(`👤 User ${username}:`, users[username]);
                    });
                    break;
                  }
                } catch (error) {
                  continue;
                }
              }
            }
            
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
    
    // Load session settings and update activity
    loadSessionSettings(username);
    updateLastActivity();
    
    // Notify other tabs of login
    multiTabSync.notifyDataChange('user_login', userData, username);
    
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
  const logout = useCallback(() => {
    const username = currentUser?.username;
    console.log(`✅ User logged out: ${username}`);
    
    // Clear all timers and session data
    clearAllTimers();
    
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('currentUser');
    
    // Clear session activity data
    if (username) {
      localStorage.removeItem(`lastActivity_${username}`);
    }
    
    // Notify other tabs of logout
    if (username) {
      multiTabSync.notifyUserLogout(username);
    }
  }, [currentUser, clearAllTimers]);

  // Get user-specific data key
  const getUserDataKey = useCallback((dataType) => {
    return currentUser ? `${dataType}_${currentUser.username}` : dataType;
  }, [currentUser]);

  // ✅ FIXED: Save user-specific data (handle both string and object)
  const saveUserData = useCallback((dataType, data) => {
    if (!currentUser) return;
    
    const key = getUserDataKey(dataType);
    
    // Use encryption for sensitive data
    setSimpleEncryptedItem(key, data, currentUser.username);
  }, [currentUser, getUserDataKey]);

  // Get user-specific data
  const getUserData = useCallback((dataType) => {
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
  }, [currentUser, getUserDataKey]);

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

  // Update username
  const updateUsername = async (newUsername, currentPassword) => {
    if (!currentUser) {
      throw new Error('No user is currently logged in');
    }

    // Validate current password
    const users = getSimpleEncryptedItem('users', currentUser.username) || {};
    const user = users[currentUser.username];

    if (!user) {
      throw new Error('User not found');
    }

    const passwordHash = hashPassword(currentPassword);
    if (user.passwordHash !== passwordHash) {
      throw new Error('Current password is incorrect');
    }

    // Validate new username
    if (newUsername.length < 3) {
      throw new Error('Username must be at least 3 characters');
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      throw new Error('Username can only contain letters, numbers, and underscores');
    }

    if (newUsername === currentUser.username) {
      throw new Error('New username must be different from current username');
    }

    // Check if new username already exists
    if (users[newUsername]) {
      throw new Error('Username already exists');
    }

    // Update user data with new username as encryption key
    const updatedUser = {
      ...user,
      username: newUsername
    };

    // Add new user entry
    users[newUsername] = updatedUser;
    
    // Remove old user entry
    delete users[currentUser.username];

    // Save updated users data with new username as key
    setSimpleEncryptedItem('users', users, newUsername);

    // Migrate all user data to new username
    const allKeys = Object.keys(localStorage);
    const userKeys = allKeys.filter(key => key.includes(`_${currentUser.username}`));

    for (const oldKey of userKeys) {
      const data = getSimpleEncryptedItem(oldKey, currentUser.username);
      if (data !== null) {
        const newKey = oldKey.replace(`_${currentUser.username}`, `_${newUsername}`);
        setSimpleEncryptedItem(newKey, data, newUsername);
        localStorage.removeItem(oldKey);
      }
    }

    // Update current user session
    const userData = { username: newUsername, createdAt: user.createdAt };
    setCurrentUser(userData);
    setSimpleEncryptedItem('currentUser', userData, newUsername);

    // Notify other tabs
    multiTabSync.notifyDataChange('user_login', userData, newUsername);

    console.log(`✅ Username updated from ${currentUser.username} to ${newUsername}`);
    return true;
  };

  // Update password
  const updatePassword = async (currentPassword, newPassword) => {
    if (!currentUser) {
      throw new Error('No user is currently logged in');
    }

    // Get users data
    const users = getSimpleEncryptedItem('users', currentUser.username) || {};
    const user = users[currentUser.username];

    if (!user) {
      throw new Error('User not found');
    }

    // Validate current password
    const currentPasswordHash = hashPassword(currentPassword);
    if (user.passwordHash !== currentPasswordHash) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    if (newPassword === currentPassword) {
      throw new Error('New password must be different from current password');
    }

    // Update password
    const newPasswordHash = hashPassword(newPassword);
    users[currentUser.username] = {
      ...user,
      passwordHash: newPasswordHash,
      updatedAt: new Date().toISOString()
    };

    // Save updated users data
    setSimpleEncryptedItem('users', users, currentUser.username);

    console.log(`✅ Password updated for user: ${currentUser.username}`);
    return true;
  };

  const value = {
    currentUser,
    isAuthenticated,
    isLoading,
    isAppLoading,
    sessionTimeout,
    showSessionWarning,
    setShowSessionWarning,
    register,
    login,
    logout,
    deleteUser,
    getUserData,
    saveUserData,
    getUserDataKey,
    updateUsername,
    updatePassword,
    saveSessionSettings,
    updateLastActivity
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
