import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { setSimpleEncryptedItem, getSimpleEncryptedItem } from '../utils/simple-encryption';

const SupabaseAuthContext = createContext();

// Supabase client initialization
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const useSupabaseAuth = () => {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
};

export const SupabaseAuthProvider = ({ children }) => {
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

  // Session management functions
  const updateLastActivity = useCallback(() => {
    const now = Date.now();
    setLastActivity(now);
    if (currentUser) {
      localStorage.setItem(`lastActivity_${currentUser.id}`, now.toString());
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
      // Show warning 5 minutes before session expires
      const warningTime = (sessionTimeout - 5) * 60 * 1000; // 5 minutes before expiry
      const warningTimerId = setTimeout(() => {
        const now = Date.now();
        const inactiveTime = now - lastActivityRef.current;
        const maxInactiveTime = sessionTimeout * 60 * 1000;
        
        // Only show warning if session hasn't been kept alive by activity
        const timeRemaining = maxInactiveTime - inactiveTime;
        if (timeRemaining <= 5 * 60 * 1000 && timeRemaining > 0) {
          setShowSessionWarning(true);
        }
      }, warningTime);
      setWarningTimer(warningTimerId);
      
      // For sessions <= 5 minutes, show warning immediately
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
          
          logout();
        }
      }, sessionTimeout * 60 * 1000);
      setSessionTimer(timer);
    }
  }, [clearAllTimers, currentUser, sessionTimeout]);

  // Initialize auth state on mount
  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          
          setIsLoading(false);
          return;
        }

        if (session?.user) {
          // Get user profile from profiles table
          try {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profileError) {
              
              // Set basic user info from auth session if profile fetch fails
              setCurrentUser({
                id: session.user.id,
                username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
                email: session.user.email,
                fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.username || 'User'
              });
              setIsAuthenticated(true);
            } else if (profile) {
              setCurrentUser({
                id: session.user.id,
                username: profile.username || session.user.email?.split('@')[0] || 'User',
                email: session.user.email,
                fullName: profile.full_name || profile.username || 'User',
                ...profile
              });
              setIsAuthenticated(true);
            }
          } catch (error) {
            
            // Set basic user info from auth session
            setCurrentUser({
              id: session.user.id,
              username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
              email: session.user.email,
              fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.username || 'User'
            });
            setIsAuthenticated(true);
          }
          
          // Load session settings
          const activity = localStorage.getItem(`lastActivity_${session.user.id}`);
          if (activity) {
            setLastActivity(parseInt(activity, 10));
          }
        }
      } catch (error) {
        
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        
        
        if (event === 'SIGNED_IN' && session?.user) {
          // Get user profile
          try {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profileError) {
              
              // Set basic user info from auth session
              setCurrentUser({
                id: session.user.id,
                username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
                email: session.user.email,
                fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.username || 'User'
              });
              setIsAuthenticated(true);
            } else if (profile) {
              setCurrentUser({
                id: session.user.id,
                username: profile.username || session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
                email: session.user.email,
                fullName: profile.full_name || profile.username || 'User',
                ...profile
              });
              setIsAuthenticated(true);
            }
          } catch (error) {
            
            // Set basic user info from auth session
            setCurrentUser({
              id: session.user.id,
              username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
              email: session.user.email,
              fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.username || 'User'
            });
            setIsAuthenticated(true);
          }
          
          updateLastActivity();
          
          // Trigger app loading animation
          setIsAppLoading(true);
          setTimeout(() => {
            setIsAppLoading(false);
          }, 2000);
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setIsAuthenticated(false);
          clearAllTimers();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Session management effect
  useEffect(() => {
    if (currentUser && isAuthenticated) {
      // Check if session is expired on mount
      const now = Date.now();
      const inactiveTime = now - lastActivityRef.current;
      const maxInactiveTime = sessionTimeout * 60 * 1000;
      
      if (sessionTimeout > 0 && inactiveTime > maxInactiveTime) {
        
        logout();
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
          localStorage.setItem(`lastActivity_${currentUser.id}`, now.toString());
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
          
          setShowSessionWarning(true);
        }
        
        if (sessionTimeout > 0 && inactiveTime > maxInactiveTime) {
          
          logout();
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
  }, [currentUser, isAuthenticated, sessionTimeout, showSessionWarning, immediateWarningShown]);

  // User registration
  const register = async (username, password, email, fullName) => {
    try {
      // Validate username (only check if it's not empty)
      if (!username.trim()) {
        throw new Error('Username is required');
      }

      // Validate password
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      // Sign up user with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            full_name: fullName,
          }
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      
      throw error;
    }
  };

  // User login
  const login = async (email, password, username) => {
    try {
      
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        
        throw new Error(error.message);
      }

      
      
      // Set basic user info immediately from auth data
      const basicUserInfo = {
        id: data.user.id,
        username: data.user.user_metadata?.username || username || data.user.email?.split('@')[0] || 'User',
        email: data.user.email,
        fullName: data.user.user_metadata?.full_name || data.user.user_metadata?.username || username || 'User'
      };
      
      setCurrentUser(basicUserInfo);
      setIsAuthenticated(true);
      updateLastActivity();
      
      
      
      // Trigger app loading animation
      setIsAppLoading(true);
      setTimeout(() => {
        setIsAppLoading(false);
      }, 2000);
      
      return true;
    } catch (error) {
      
      throw error;
    }
  };

  // User logout
  const logout = useCallback(async () => {
    const userId = currentUser?.id;
    const username = currentUser?.username;
    
    
    // Clear all timers and session data
    clearAllTimers();
    
    // Sign out from Supabase
    await supabase.auth.signOut();
    
    // Clear only local session activity data (NOT user data from Supabase)
    if (userId) {
      localStorage.removeItem(`lastActivity_${userId}`);
    }
    
    // Clear any remaining currentUser data from localStorage
    localStorage.removeItem('currentUser');
    
    setCurrentUser(null);
    setIsAuthenticated(false);
    
    // Force page reload to ensure clean state
    window.location.reload();
  }, [currentUser, clearAllTimers]);

  // Get user-specific data key
  const getUserDataKey = useCallback((dataType) => {
    return currentUser ? `${dataType}_${currentUser.id}` : dataType;
  }, [currentUser]);

  // Save user-specific data to localStorage (for temporary/cache data)
  const saveUserData = useCallback((dataType, data) => {
    if (!currentUser) return;
    
    const key = getUserDataKey(dataType);
    // Use encryption for sensitive data like salary
    setSimpleEncryptedItem(key, data, currentUser.username);
  }, [currentUser, getUserDataKey]);

  // Get user-specific data from localStorage
  const getUserData = useCallback((dataType) => {
    if (!currentUser) {
      // Return default values based on data type
      switch(dataType) {
        case 'timeEntries':
          return [];
        case 'payPeriods':
          return [];
        case 'currentPeriodId':
          return null;
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
          return [];
        case 'currentPeriodId':
          return null;
        case 'fullName':
          return currentUser?.username || '';
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

    // Return data as-is (already parsed by getSimpleEncryptedItem)
    return data;
  }, [currentUser, getUserDataKey]);

  // Update user profile
  const updateProfile = async (updates) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentUser.id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      setCurrentUser(prev => ({ ...prev, ...data }));
      return data;
    } catch (error) {
      
      throw error;
    }
  };

  // Update password
  const updatePassword = async (currentPassword, newPassword) => {
    try {
      // First verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      
      throw error;
    }
  };

  // Reset password
  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      
      throw error;
    }
  };

  // Save session settings
  const saveSessionSettings = (timeout) => {
    setSessionTimeout(timeout);
    // Timer will be restarted by the useEffect when sessionTimeout changes
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
    getUserData,
    saveUserData,
    updateProfile,
    updatePassword,
    resetPassword,
    saveSessionSettings,
    updateLastActivity,
    isSessionExpired,
    setSessionTimeout
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};
