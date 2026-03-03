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
                fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.username || 'User',
                displayName: localStorage.getItem('userDisplayName') || session.user.user_metadata?.full_name || session.user.user_metadata?.username || 'User'
              });
              setIsAuthenticated(true);
            } else if (profile) {
              setCurrentUser({
                id: session.user.id,
                username: profile.username || session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
                email: session.user.email,
                fullName: profile.full_name || profile.username || 'User',
                displayName: localStorage.getItem('userDisplayName') || profile.full_name || profile.username || 'User',
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
              fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.username || 'User',
              displayName: localStorage.getItem('userDisplayName') || session.user.user_metadata?.full_name || session.user.user_metadata?.username || 'User'
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
          // Get user profile from profiles table
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
                fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.username || 'User',
                displayName: localStorage.getItem('userDisplayName') || session.user.user_metadata?.full_name || session.user.user_metadata?.username || 'User'
              });
              setIsAuthenticated(true);
            } else if (profile) {
              setCurrentUser({
                id: session.user.id,
                username: profile.username || session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
                email: session.user.email,
                fullName: profile.full_name || profile.username || 'User',
                displayName: localStorage.getItem('userDisplayName') || profile.full_name || profile.username || 'User',
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
              fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.username || 'User',
              displayName: localStorage.getItem('userDisplayName') || session.user.user_metadata?.full_name || session.user.user_metadata?.username || 'User'
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
      // Validate username
      if (!username || !username.trim()) {
        throw new Error('Username is required');
      }
      if (username.trim().length < 3) {
        throw new Error('Username must be at least 3 characters');
      }
      if (username.trim().length > 20) {
        throw new Error('Username must be 20 characters or less');
      }
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(username.trim())) {
        throw new Error('Username must start with a letter and contain only letters, numbers, and underscores');
      }

      // Check username availability
      const availabilityCheck = await checkUsernameAvailability(username.trim());
      if (!availabilityCheck.available) {
        throw new Error(availabilityCheck.error || 'Username is already taken');
      }

      // Validate password
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      // Validate email
      if (!email || !email.trim()) {
        throw new Error('Email is required');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      // Sign up user with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim(),
            full_name: fullName,
          }
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Clear username cache since it's now taken
      const cacheKey = username.trim().toLowerCase();
      localStorage.removeItem(`username_cache_${cacheKey}`);

      return true;
    } catch (error) {
      
      throw error;
    }
  };

  // Username availability check with caching
  const checkUsernameAvailability = async (username) => {
    try {
      // Input validation
      if (!username || username.trim().length < 3) {
        return { available: false, error: 'Username must be at least 3 characters' };
      }
      
      const trimmedUsername = username.trim();
      
      // Username format validation
      if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
        return { available: false, error: 'Username can only contain letters, numbers, and underscores' };
      }
      
      if (/^[0-9_]/.test(trimmedUsername)) {
        return { available: false, error: 'Username must start with a letter' };
      }
      
      // Check cache first (simple in-memory cache)
      const cacheKey = trimmedUsername.toLowerCase();
      const cached = localStorage.getItem(`username_cache_${cacheKey}`);
      if (cached) {
        const cachedData = JSON.parse(cached);
        if (Date.now() - cachedData.timestamp < 5 * 60 * 1000) { // 5 minutes
          return cachedData.result;
        }
      }
      
      // Database check
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', trimmedUsername)
        .single();
      
      const result = { available: !data, error: error?.message };
      
      // Cache the result
      localStorage.setItem(`username_cache_${cacheKey}`, JSON.stringify({
        result,
        timestamp: Date.now()
      }));
      
      return result;
    } catch (error) {
      return { available: false, error: error.message };
    }
  };

  // Clear username cache
  const clearUsernameCache = () => {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('username_cache_'));
    keys.forEach(key => localStorage.removeItem(key));
  };

  // User login
  const login = async (username, password, rememberMe = false) => {
    try {
      
      // Input validation
      if (!username || !username.trim()) {
        throw new Error('Username is required');
      }
      if (!password || !password.trim()) {
        throw new Error('Password is required');
      }

      // Rate limiting check
      const rateLimitKey = `login_attempt_${username}`;
      
      // ✅ BYPASS: Skip rate limiting for peter_ashraf
      if (username.trim() !== 'peter_ashraf') {
        const attempts = localStorage.getItem(rateLimitKey) || 0;
        if (attempts >= 5) {
          throw new Error('Too many login attempts. Please try again later.');
        }
      }

      // ✅ DIRECT BYPASS: For peter_ashraf, skip profile lookup entirely
      if (username.trim() === 'peter_ashraf') {
        // Try direct authentication with known email formats
        const emailAttempts = [
          'peter.ashraf16@gmail.com',  // Try real email first
          'peter_ashraf@gmail.com',    // Alternative format
          'peter_ashraf@timetracker.local'  // Local format last
        ];
        
        for (const email of emailAttempts) {
          try {
            const { data: directAuthData, error: directAuthError } = await supabase.auth.signInWithPassword({
              email: email,
              password,
            });

            if (!directAuthError && directAuthData.user) {
              // Set basic user info
              const basicUserInfo = {
                id: directAuthData.user.id,
                username: username.trim(),
                email: email,
                fullName: directAuthData.user.user_metadata?.full_name || username || 'User',
                displayName: localStorage.getItem('userDisplayName') || directAuthData.user.user_metadata?.full_name || username || 'User'
              };
              
              setCurrentUser(basicUserInfo);
              setIsAuthenticated(true);
              updateLastActivity();
              
              // Trigger app loading animation
              setIsAppLoading(true);
              setTimeout(() => {
                setIsAppLoading(false);
              }, 2000);
              
              return { success: true, user: directAuthData.user, profile: null };
            }
          } catch (attemptError) {
            console.log('Email attempt failed:', email, attemptError.message);
            continue;
          }
        }
        
        throw new Error('Unable to authenticate with known email addresses. Please contact support.');
      }

      // Find user by username to get email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email, id')
        .eq('username', username.trim())
        .single();
      
      // ✅ FAIL-SAFE: If profile lookup fails, try direct auth with username as email
      if (profileError || !profile) {
        // ✅ BYPASS: Don't increment failed attempts for peter_ashraf
        if (username.trim() !== 'peter_ashraf') {
          // Increment failed attempt counter
          localStorage.setItem(rateLimitKey, parseInt(attempts) + 1);
        }
        
        // Try direct auth using username as email (for users with email = username@domain)
        try {
          const { data: directAuthData, error: directAuthError } = await supabase.auth.signInWithPassword({
            email: `${username.trim()}@timetracker.local`, // Try the local email format
            password,
          });

          if (!directAuthError && directAuthData.user) {
            // Clear failed attempts on successful direct auth
            localStorage.removeItem(rateLimitKey);
            
            // Set basic user info
            const basicUserInfo = {
              id: directAuthData.user.id,
              username: username.trim(),
              email: `${username.trim()}@timetracker.local`,
              fullName: directAuthData.user.user_metadata?.full_name || username || 'User',
              displayName: localStorage.getItem('userDisplayName') || directAuthData.user.user_metadata?.full_name || username || 'User'
            };
            
            setCurrentUser(basicUserInfo);
            setIsAuthenticated(true);
            updateLastActivity();
            
            // Trigger app loading animation
            setIsAppLoading(true);
            setTimeout(() => {
              setIsAppLoading(false);
            }, 2000);
            
            return { success: true, user: directAuthData.user, profile: null };
          }
        } catch (failSafeError) {
          console.log('Fail-safe auth also failed:', failSafeError.message);
        }
        
        throw new Error('Invalid username or password');
      }

      // CRITICAL FIX: Handle null email case
      if (!profile.email || profile.email === '') {
        // Try to get email from Supabase auth metadata as fallback
        const { data: { sessions } } = await supabase.auth.getSessions();
        let fallbackEmail = null;
        
        if (sessions && sessions.length > 0) {
          const userSession = sessions.find(session => session.user?.email);
          if (userSession?.user?.email) {
            fallbackEmail = userSession.user.email;
            
            // Update the profile with the email from auth
            await supabase
              .from('profiles')
              .update({ email: fallbackEmail })
              .eq('id', profile.id);
          }
        }
        
        if (!fallbackEmail) {
          throw new Error('Account configuration issue. Please contact support.');
        }
        
        // Use fallback email for Supabase auth
        const { data, error } = await supabase.auth.signInWithPassword({
          email: fallbackEmail,
          password,
        });

        if (error) {
          // ✅ BYPASS: Don't increment failed attempts for peter_ashraf
          if (username.trim() !== 'peter_ashraf') {
            // Increment failed attempt counter
            localStorage.setItem(rateLimitKey, parseInt(attempts) + 1);
          }
          throw new Error('Invalid username or password');
        }

        // Set basic user info immediately from auth data
        const basicUserInfo = {
          id: data.user.id,
          username: username.trim(),
          email: fallbackEmail,
          fullName: data.user.user_metadata?.full_name || username || 'User',
          displayName: localStorage.getItem('userDisplayName') || data.user.user_metadata?.full_name || username || 'User'
        };
        
        console.log('Login user info set:', {
          username: username.trim(),
          displayName: basicUserInfo.displayName,
          localStorageDisplayName: localStorage.getItem('userDisplayName')
        });
        
        setCurrentUser(basicUserInfo);
        setIsAuthenticated(true);
        updateLastActivity();
        
        // Trigger app loading animation
        setIsAppLoading(true);
        setTimeout(() => {
          setIsAppLoading(false);
        }, 2000);
        
        return { success: true, user: data.user, profile };
      }

      // Use email for Supabase auth (normal case)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password,
      });

      if (error) {
        // ✅ BYPASS: Don't increment failed attempts for peter_ashraf
        if (username.trim() !== 'peter_ashraf') {
          // Increment failed attempt counter
          localStorage.setItem(rateLimitKey, parseInt(attempts) + 1);
        }
        throw new Error('Invalid username or password');
      }

      // Clear failed Attempts on successful login
      localStorage.removeItem(rateLimitKey);
      
      // Set basic user info immediately from auth data
      const basicUserInfo = {
        id: data.user.id,
        username: username.trim(),
        email: profile.email,
        fullName: data.user.user_metadata?.full_name || username || 'User',
        displayName: localStorage.getItem('userDisplayName') || data.user.user_metadata?.full_name || username || 'User'
      };
      
      setCurrentUser(basicUserInfo);
      setIsAuthenticated(true);
      updateLastActivity();
      
      // Trigger app loading animation
      setIsAppLoading(true);
      setTimeout(() => {
        setIsAppLoading(false);
      }, 2000);
      
      return { success: true, user: data.user, profile };
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
  const resetPassword = async (emailOrUsername) => {
    console.log('resetPassword called with:', emailOrUsername);
    
    try {
      // Check if input is email or username
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOrUsername);
      
      let targetEmail = emailOrUsername;
      
      if (!isEmail) {
        // Input is username, find the associated email
        console.log('Input is username, looking up email for:', emailOrUsername);
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', emailOrUsername.trim())
          .single();
        
        if (profileError || !profile) {
          console.log('Profile lookup failed:', profileError);
          // Don't reveal if username exists or not - security measure
          throw new Error('If this username exists, a password reset link will be sent to the associated email.');
        }
        
        console.log('Found profile with email:', profile.email);
        targetEmail = profile.email;
      }
      
      // Validate email
      if (!targetEmail || !targetEmail.trim()) {
        console.log('Email validation failed');
        throw new Error('Email is required for password reset');
      }

      console.log('Attempting to send reset email to:', targetEmail);
      
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      console.log('Reset password result:', { error: error?.message });

      if (error) {
        console.log('Reset password failed:', error.message);
        throw new Error(error.message);
      }

      console.log('Reset password successful');
      return true;
    } catch (error) {
      console.log('Reset password catch block:', error.message);
      throw error;
    }
  };

  // Save session settings
  const saveSessionSettings = async (timeout) => {
    try {
      setSessionTimeout(timeout);
      // Timer will be restarted by the useEffect when sessionTimeout changes
      return Promise.resolve();
    } catch (error) {
      throw error;
    }
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
    setSessionTimeout,
    checkUsernameAvailability,
    clearUsernameCache
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};
