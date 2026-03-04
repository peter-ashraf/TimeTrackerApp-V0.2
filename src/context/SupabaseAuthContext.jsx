import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { createClient } from "@supabase/supabase-js";
import {
  setSimpleEncryptedItem,
  getSimpleEncryptedItem,
} from "../utils/simple-encryption";

const SupabaseAuthContext = createContext();

// Supabase client initialization
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase configuration. Please check your .env file.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const useSupabaseAuth = () => {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error(
      "useSupabaseAuth must be used within a SupabaseAuthProvider",
    );
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
  const [rememberMe, setRememberMe] = useState(false);
  const lastActivityRef = useRef(lastActivity);

  // Session management constants
  const REMEMBERED_SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  const NORMAL_SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  // Session refresh for remembered users
  const setupSessionRefresh = useCallback(() => {
    if (!rememberMe) return null;

    const refreshInterval = setInterval(async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          clearInterval(refreshInterval);
          await logout();
          return;
        }

        // Extend session expiry for remembered users
        const sessionExpiry = localStorage.getItem("sessionExpiry");
        if (sessionExpiry) {
          localStorage.setItem(
            "sessionExpiry",
            new Date(Date.now() + REMEMBERED_SESSION_DURATION).toISOString(),
          );
        }
      } catch (error) {
        console.error("Session refresh error:", error);
        clearInterval(refreshInterval);
      }
    }, SESSION_CHECK_INTERVAL);

    return refreshInterval;
  }, [rememberMe]);

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

      const timer = setTimeout(
        () => {
          // Check session expiration directly here and logout inline
          if (!currentUser || sessionTimeout === 0) return;
          const now = Date.now();
          const inactiveTime = now - lastActivityRef.current;
          const maxInactiveTime = sessionTimeout * 60 * 1000;
          if (inactiveTime > maxInactiveTime) {
            window.location.reload();
          }
        },
        sessionTimeout * 60 * 1000,
      );
      setSessionTimer(timer);
    }
  }, [clearAllTimers, currentUser, sessionTimeout]);

  // Initialize auth state on mount
  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      // Fail-safe timeout: Ensure loading state is cleared even if Supabase/network hangs
      const failSafeTimeout = setTimeout(() => {
        setIsLoading(prev => {
          if (prev) {
            console.warn("Supabase initialization timed out (10s), clearing loading flag.");
            return false;
          }
          return prev;
        });
      }, 10000);

      try {
        // Check for remember me state first
        const rememberMeState = localStorage.getItem("rememberMe") === "true";
        const sessionExpiry = localStorage.getItem("sessionExpiry");
        const cachedUser = localStorage.getItem("cached_currentUser");
        const cachedProfile = localStorage.getItem("cached_userProfile");

        // Validate session expiry if offline
        const isOffline = !navigator.onLine;

        // Force cleanup if session truly expired
        if (sessionExpiry && new Date(sessionExpiry) <= new Date()) {
          localStorage.removeItem("rememberMe");
          localStorage.removeItem("rememberedUsername");
          localStorage.removeItem("sessionExpiry");
          localStorage.removeItem("cached_currentUser");
          localStorage.removeItem("cached_userProfile");
          setRememberMe(false);
        }

        let sessionData = null;
        let sessionError = null;

        try {
          const { data, error } = await supabase.auth.getSession();
          sessionData = data;
          sessionError = error;
        } catch (e) {
          sessionError = e;
        }

        if (sessionError || !sessionData?.session) {
          // If offline and we have a cached user/profile, use them
          if (isOffline && cachedUser && rememberMeState) {
            try {
              const decodedUser = JSON.parse(cachedUser);
              const decodedProfile = cachedProfile
                ? JSON.parse(cachedProfile)
                : null;

              setCurrentUser({
                ...decodedUser,
                ...(decodedProfile || {}),
              });
              setIsAuthenticated(true);
              setRememberMe(true);
              setSessionTimeout(30 * 24 * 60);
              return;
            } catch (e) {
              console.error("Failed to parse cached session", e);
            }
          }

          return;
        }

        const session = sessionData.session;

        if (session?.user) {
          // Cache the user object for offline access
          localStorage.setItem(
            "cached_currentUser",
            JSON.stringify({
              id: session.user.id,
              email: session.user.email,
              user_metadata: session.user.user_metadata,
            }),
          );

          // Validate session expiry if remember me was used
          if (rememberMeState && sessionExpiry) {
            if (new Date(sessionExpiry) <= new Date()) {
              await logout();
              return;
            }
            setRememberMe(true);
            setSessionTimeout(30 * 24 * 60);
          } else {
            setRememberMe(false);
            setSessionTimeout(30);
          }

          // Get user profile from profiles table
          try {
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .single();

            if (profileError) {
              // Set basic user info from auth session if profile fetch fails
              const basicUser = {
                id: session.user.id,
                username:
                  session.user.user_metadata?.username ||
                  session.user.email?.split("@")[0] ||
                  "User",
                email: session.user.email,
                fullName:
                  session.user.user_metadata?.full_name ||
                  session.user.user_metadata?.username ||
                  "User",
                displayName:
                  localStorage.getItem("userDisplayName") ||
                  session.user.user_metadata?.full_name ||
                  session.user.user_metadata?.username ||
                  "User",
              };
              setCurrentUser(basicUser);
              setIsAuthenticated(true);
            } else if (profile) {
              const fullUser = {
                id: session.user.id,
                username:
                  profile.username ||
                  session.user.user_metadata?.username ||
                  session.user.email?.split("@")[0] ||
                  "User",
                email: session.user.email,
                fullName: profile.full_name || profile.username || "User",
                displayName:
                  localStorage.getItem("userDisplayName") ||
                  profile.full_name ||
                  profile.username ||
                  "User",
                ...profile,
              };
              setCurrentUser(fullUser);
              setIsAuthenticated(true);

              // Cache profile for offline use
              localStorage.setItem(
                "cached_userProfile",
                JSON.stringify(profile),
              );
            }
          } catch (error) {
            // Set basic user info from auth session
            const basicUser = {
              id: session.user.id,
              username:
                session.user.user_metadata?.username ||
                session.user.email?.split("@")[0] ||
                "User",
              email: session.user.email,
              fullName:
                session.user.user_metadata?.full_name ||
                session.user.user_metadata?.username ||
                "User",
              displayName:
                localStorage.getItem("userDisplayName") ||
                session.user.user_metadata?.full_name ||
                session.user.user_metadata?.username ||
                "User",
            };
            setCurrentUser(basicUser);
            setIsAuthenticated(true);
          }

          // Load session settings
          const activity = localStorage.getItem(
            `lastActivity_${session.user.id}`,
          );
          if (activity) {
            setLastActivity(parseInt(activity, 10));
          }
        }
      } catch (error) {
        console.error("getInitialSession error:", error);
      } finally {
        clearTimeout(failSafeTimeout);
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        // Cache the user object for offline access
        localStorage.setItem(
          "cached_currentUser",
          JSON.stringify({
            id: session.user.id,
            email: session.user.email,
            user_metadata: session.user.user_metadata,
          }),
        );

        // Get user profile from profiles table
        try {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (profileError) {
            // Set basic user info from auth session
            setCurrentUser({
              id: session.user.id,
              username:
                session.user.user_metadata?.username ||
                session.user.email?.split("@")[0] ||
                "User",
              email: session.user.email,
              fullName:
                session.user.user_metadata?.full_name ||
                session.user.user_metadata?.username ||
                "User",
              displayName:
                localStorage.getItem("userDisplayName") ||
                session.user.user_metadata?.full_name ||
                session.user.user_metadata?.username ||
                "User",
            });
            setIsAuthenticated(true);
          } else if (profile) {
            setCurrentUser({
              id: session.user.id,
              username:
                profile.username ||
                session.user.user_metadata?.username ||
                session.user.email?.split("@")[0] ||
                "User",
              email: session.user.email,
              fullName: profile.full_name || profile.username || "User",
              displayName:
                localStorage.getItem("userDisplayName") ||
                profile.full_name ||
                profile.username ||
                "User",
              ...profile,
            });
            setIsAuthenticated(true);

            // Cache profile for offline use
            localStorage.setItem("cached_userProfile", JSON.stringify(profile));
          }
        } catch (error) {
          // Set basic user info from auth session
          setCurrentUser({
            id: session.user.id,
            username:
              session.user.user_metadata?.username ||
              session.user.email?.split("@")[0] ||
              "User",
            email: session.user.email,
            fullName:
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.username ||
              "User",
            displayName:
              localStorage.getItem("userDisplayName") ||
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.username ||
              "User",
          });
          setIsAuthenticated(true);
        }

        updateLastActivity();

        // Trigger app loading animation
        setIsAppLoading(true);
        setTimeout(() => {
          setIsAppLoading(false);
        }, 2000);
      } else if (event === "SIGNED_OUT") {
        setCurrentUser(null);
        setIsAuthenticated(false);
        clearAllTimers();
        localStorage.removeItem("cached_currentUser");
        localStorage.removeItem("cached_userProfile");
      }
    });

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
          localStorage.setItem(
            `lastActivity_${currentUser.id}`,
            now.toString(),
          );
        }
        startSessionTimer(); // Restart timer on activity
      };

      // Monitor various user activities
      const events = [
        "mousedown",
        "mousemove",
        "keypress",
        "scroll",
        "touchstart",
        "click",
      ];
      events.forEach((event) => {
        document.addEventListener(event, handleActivity);
      });

      // Check session expiration periodically
      const checkInterval = setInterval(() => {
        const now = Date.now();
        const inactiveTime = now - lastActivityRef.current;
        const maxInactiveTime = sessionTimeout * 60 * 1000;
        const timeRemaining = maxInactiveTime - inactiveTime;

        // Show warning when 5 minutes or less remaining
        if (
          timeRemaining <= 5 * 60 * 1000 &&
          timeRemaining > 0 &&
          !showSessionWarning
        ) {
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
        events.forEach((event) => {
          document.removeEventListener(event, handleActivity);
        });
        clearInterval(checkInterval);
      };
    } else {
      clearSessionTimer();
      clearWarningTimer();
      setShowSessionWarning(false);
    }
  }, [
    currentUser,
    isAuthenticated,
    sessionTimeout,
    showSessionWarning,
    immediateWarningShown,
  ]);

  // Start session refresh for remembered users
  useEffect(() => {
    if (isAuthenticated && rememberMe) {
      const refreshInterval = setupSessionRefresh();

      return () => {
        if (refreshInterval) {
          clearInterval(refreshInterval);
        }
      };
    }
  }, [isAuthenticated, rememberMe, setupSessionRefresh]);

  // User registration
  const register = async (username, password, email, fullName) => {
    try {
      // Validate username
      if (!username || !username.trim()) {
        throw new Error("Username is required");
      }
      if (username.trim().length < 3) {
        throw new Error("Username must be at least 3 characters");
      }
      if (username.trim().length > 20) {
        throw new Error("Username must be 20 characters or less");
      }
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(username.trim())) {
        throw new Error(
          "Username must start with a letter and contain only letters, numbers, and underscores",
        );
      }

      // Check username availability
      const availabilityCheck = await checkUsernameAvailability(
        username.trim(),
      );
      if (!availabilityCheck.available) {
        throw new Error(availabilityCheck.error || "Username is already taken");
      }

      // Validate password
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      // Validate email
      if (!email || !email.trim()) {
        throw new Error("Email is required");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Please enter a valid email address");
      }

      // Sign up user with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim(),
            full_name: fullName,
          },
        },
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
      // Clear any existing cache for this username to ensure fresh check
      const cacheKey = username.trim().toLowerCase();
      localStorage.removeItem(`username_cache_${cacheKey}`);

      // Input validation
      if (!username || username.trim().length < 3) {
        return {
          available: false,
          error: "Username must be at least 3 characters",
        };
      }

      const trimmedUsername = username.trim();

      // Username format validation
      if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
        return {
          available: false,
          error: "Username can only contain letters, numbers, and underscores",
        };
      }

      if (/^[0-9_]/.test(trimmedUsername)) {
        return { available: false, error: "Username must start with a letter" };
      }

      // Try using RPC function to bypass RLS
      try {
        // First try RPC function (most reliable way to bypass RLS)
        const { data, error } = await supabase.rpc(
          "check_username_availability",
          {
            username_to_check: trimmedUsername,
          },
        );

        if (!error && data !== null) {
          // RPC function should return true if available, false if taken
          const result = { available: data, error: null };
          return result;
        }
      } catch (rpcError) {
        // RPC function not available, fall back to direct query
      }

      // Fallback: Try direct query (might be blocked by RLS)
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", trimmedUsername);

      // If direct query fails due to RLS, we'll need to create the RPC function
      if (error) {
        return {
          available: true,
          error:
            "Username check temporarily unavailable - please contact support",
        };
      }

      // If data array has any entries, username is taken (not available)
      const result = {
        available: !data || data.length === 0,
        error: error?.message,
      };

      return result;
    } catch (error) {
      return { available: false, error: error.message };
    }
  };

  // Clear username cache
  const clearUsernameCache = () => {
    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith("username_cache_"),
    );
    keys.forEach((key) => localStorage.removeItem(key));
  };

  // User login
  const login = async (username, password, rememberMe = false) => {
    try {
      // Input validation
      if (!username || !username.trim()) {
        throw new Error("Username is required");
      }
      if (!password || !password.trim()) {
        throw new Error("Password is required");
      }

      // Rate limiting check
      const rateLimitKey = `login_attempt_${username}`;
      const attempts = localStorage.getItem(rateLimitKey) || 0;
      if (attempts >= 5) {
        throw new Error("Too many login attempts. Please try again later.");
      }

      // Find user by username to get email
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email, id")
        .eq("username", username.trim())
        .single();

      // ✅ FAIL-SAFE: If profile lookup fails, try direct auth with username as email
      if (profileError || !profile) {
        // Increment failed attempt counter
        localStorage.setItem(rateLimitKey, parseInt(attempts) + 1);

        // Try direct auth using username as email (for users with email = username@domain)
        try {
          const { data: directAuthData, error: directAuthError } =
            await supabase.auth.signInWithPassword({
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
              fullName:
                directAuthData.user.user_metadata?.full_name ||
                username ||
                "User",
              displayName:
                localStorage.getItem("userDisplayName") ||
                directAuthData.user.user_metadata?.full_name ||
                username ||
                "User",
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
          console.log("Fail-safe auth also failed:", failSafeError.message);
        }

        throw new Error("Invalid username or password");
      }

      // CRITICAL FIX: Handle null email case
      if (!profile.email || profile.email === "") {
        // Try to get email from Supabase auth metadata as fallback
        const {
          data: { sessions },
        } = await supabase.auth.getSessions();
        let fallbackEmail = null;

        if (sessions && sessions.length > 0) {
          const userSession = sessions.find((session) => session.user?.email);
          if (userSession?.user?.email) {
            fallbackEmail = userSession.user.email;

            // Update the profile with the email from auth
            await supabase
              .from("profiles")
              .update({ email: fallbackEmail })
              .eq("id", profile.id);
          }
        }

        if (!fallbackEmail) {
          throw new Error(
            "Account configuration issue. Please contact support.",
          );
        }

        // Use fallback email for Supabase auth
        const { data, error } = await supabase.auth.signInWithPassword({
          email: fallbackEmail,
          password,
        });

        if (error) {
          // Increment failed attempt counter
          localStorage.setItem(rateLimitKey, parseInt(attempts) + 1);
          throw new Error("Invalid username or password");
        }

        // Set basic user info immediately from auth data
        const basicUserInfo = {
          id: data.user.id,
          username: username.trim(),
          email: fallbackEmail,
          fullName: data.user.user_metadata?.full_name || username || "User",
          displayName:
            localStorage.getItem("userDisplayName") ||
            data.user.user_metadata?.full_name ||
            username ||
            "User",
        };

        console.log("Login user info set:", {
          username: username.trim(),
          displayName: basicUserInfo.displayName,
          localStorageDisplayName: localStorage.getItem("userDisplayName"),
        });

        setCurrentUser(basicUserInfo);
        setIsAuthenticated(true);
        updateLastActivity();

        // Handle remember me functionality for fallback auth
        if (rememberMe) {
          localStorage.setItem("rememberMe", "true");
          localStorage.setItem("rememberedUsername", username.trim());
          localStorage.setItem(
            "sessionExpiry",
            new Date(Date.now() + REMEMBERED_SESSION_DURATION).toISOString(),
          );
          // Set session timeout to a very large value (30 days in minutes)
          setSessionTimeout(30 * 24 * 60); // 30 days in minutes
          setRememberMe(true);
        } else {
          localStorage.removeItem("rememberMe");
          localStorage.removeItem("rememberedUsername");
          localStorage.setItem(
            "sessionExpiry",
            new Date(Date.now() + NORMAL_SESSION_DURATION).toISOString(),
          );
          // Reset to normal session timeout (24 hours in minutes)
          setSessionTimeout(24 * 60); // 24 hours in minutes
          setRememberMe(false);
        }

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
        // Increment failed attempt counter
        localStorage.setItem(rateLimitKey, parseInt(attempts) + 1);
        throw new Error("Invalid username or password");
      }

      // Clear failed Attempts on successful login
      localStorage.removeItem(rateLimitKey);

      // Handle remember me functionality
      if (rememberMe) {
        localStorage.setItem("rememberMe", "true");
        localStorage.setItem("rememberedUsername", username.trim());
        localStorage.setItem(
          "sessionExpiry",
          new Date(Date.now() + REMEMBERED_SESSION_DURATION).toISOString(),
        );
        // Set session timeout to a very large value (30 days in minutes)
        setSessionTimeout(30 * 24 * 60); // 30 days in minutes
        setRememberMe(true);
      } else {
        localStorage.removeItem("rememberMe");
        localStorage.removeItem("rememberedUsername");
        localStorage.setItem(
          "sessionExpiry",
          new Date(Date.now() + NORMAL_SESSION_DURATION).toISOString(),
        );
        // Reset to normal session timeout (24 hours in minutes)
        setSessionTimeout(24 * 60); // 24 hours in minutes
        setRememberMe(false);
      }

      // Set basic user info immediately from auth data
      const basicUserInfo = {
        id: data.user.id,
        username: username.trim(),
        email: profile.email,
        fullName: data.user.user_metadata?.full_name || username || "User",
        displayName:
          localStorage.getItem("userDisplayName") ||
          data.user.user_metadata?.full_name ||
          username ||
          "User",
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

    // Clear username cache for this user
    if (username) {
      clearUsernameCache(username);
    }

    // Clear remember me data
    localStorage.removeItem("rememberMe");
    localStorage.removeItem("rememberedUsername");
    localStorage.removeItem("sessionExpiry");
    setRememberMe(false);

    // Clear any remaining currentUser data from localStorage
    localStorage.removeItem("currentUser");

    setCurrentUser(null);
    setIsAuthenticated(false);

    // Force page reload to ensure clean state
    window.location.reload();
  }, [currentUser, clearAllTimers]);

  // Get user-specific data key
  const getUserDataKey = useCallback(
    (dataType) => {
      return currentUser ? `${dataType}_${currentUser.id}` : dataType;
    },
    [currentUser],
  );

  // Save user-specific data to localStorage (for temporary/cache data)
  const saveUserData = useCallback(
    (dataType, data) => {
      if (!currentUser) return;

      const key = getUserDataKey(dataType);
      // Use encryption for sensitive data
      setSimpleEncryptedItem(key, data, currentUser.username);
    },
    [currentUser, getUserDataKey],
  );

  // Get user-specific data from localStorage
  const getUserData = useCallback(
    (dataType) => {
      if (!currentUser) {
        // Return default values based on data type
        switch (dataType) {
          case "timeEntries":
            return [];
          case "payPeriods":
            return [];
          case "currentPeriodId":
            return null;
          case "fullName":
            return "";
          case "salary":
            return 0;
          case "annualVacation":
            return 10;
          case "sickDays":
            return 7;
          default:
            return null;
        }
      }

      const key = getUserDataKey(dataType);
      const data = getSimpleEncryptedItem(key, currentUser.username);

      if (!data) {
        // Return default values if no data exists
        switch (dataType) {
          case "timeEntries":
            return [];
          case "payPeriods":
            return [];
          case "currentPeriodId":
            return null;
          case "fullName":
            return currentUser?.username || "";
          case "salary":
            return 0;
          case "annualVacation":
            return 10;
          case "sickDays":
            return 7;
          default:
            return null;
        }
      }

      // Return data as-is (already parsed by getSimpleEncryptedItem)
      return data;
    },
    [currentUser, getUserDataKey],
  );

  // Update user profile
  const updateProfile = async (updates) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", currentUser.id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      setCurrentUser((prev) => ({ ...prev, ...data }));
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
        throw new Error("Current password is incorrect");
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      throw error;
    }
  };

  // Reset password with rate limiting
  const resetPassword = async (emailOrUsername) => {
    try {
      // Rate limiting check - prevent spam
      const rateLimitKey = `pwd_reset_${emailOrUsername.toLowerCase()}`;
      const lastAttempt = localStorage.getItem(rateLimitKey);
      const now = Date.now();
      const RATE_LIMIT_DURATION = 5 * 60 * 1000; // 5 minutes
      const MAX_ATTEMPTS = 3;

      // Get current attempts
      const attemptsData = localStorage.getItem(`${rateLimitKey}_attempts`);
      const attempts = attemptsData ? JSON.parse(attemptsData) : { count: 0, timestamps: [] };

      // Clean old attempts (older than 1 hour)
      const oneHourAgo = now - (60 * 60 * 1000);
      const recentAttempts = attempts.timestamps.filter(timestamp => timestamp > oneHourAgo);

      // Check if rate limited
      if (recentAttempts.length >= MAX_ATTEMPTS) {
        const oldestRecentAttempt = Math.min(...recentAttempts);
        const timeUntilReset = RATE_LIMIT_DURATION - (now - oldestRecentAttempt);
        const minutesRemaining = Math.ceil(timeUntilReset / (60 * 1000));
        
        throw new Error(`Too many reset attempts. Please try again in ${minutesRemaining} minutes.`);
      }

      // Check if input is email or username
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOrUsername);

      let targetEmail = emailOrUsername;

      if (!isEmail) {
        // Input is username, find the associated email
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("email")
          .eq("username", emailOrUsername.trim())
          .single();

        if (profileError || !profile) {
          // Don't reveal if username exists or not - security measure
          throw new Error(
            "If this username exists, a password reset link will be sent to the associated email.",
          );
        }

        targetEmail = profile.email;
      }

      // Validate email
      if (!targetEmail || !targetEmail.trim()) {
        throw new Error("Email is required for password reset");
      }

      // Calculate correct redirect URL for HashRouter and GitHub Pages
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      // Ensure we have a proper base path for GH Pages, but handle root path for dev
      const basePath = pathname.endsWith("/")
        ? pathname
        : pathname.split("/").slice(0, -1).join("/") + "/";
      
      // IMPORTANT: For HashRouter, the route must come AFTER the hash.
      // Supabase will append tokens as query params/fragments, so we need a stable base.
      const redirectTo = `${origin}${basePath}#/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: redirectTo,
      });

      if (error) {
        // Record failed attempt
        const updatedAttempts = {
          count: recentAttempts.length + 1,
          timestamps: [...recentAttempts, now]
        };
        localStorage.setItem(`${rateLimitKey}_attempts`, JSON.stringify(updatedAttempts));
        
        throw new Error(error.message);
      }

      // Clear successful attempts
      localStorage.removeItem(`${rateLimitKey}_attempts`);

      return true;
    } catch (error) {
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
    rememberMe,
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
    clearUsernameCache,
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};
