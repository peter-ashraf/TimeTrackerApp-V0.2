import { useState, useEffect, useCallback } from 'react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';

export const useUsernameValidation = (username, debounceMs = 500) => {
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState(null);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const { checkUsernameAvailability } = useSupabaseAuth();

  const validateUsername = useCallback((username) => {
    if (!username || username.length < 3) {
      return { valid: false, error: 'Username must be at least 3 characters' };
    }
    if (username.length > 20) {
      return { valid: false, error: 'Username must be 20 characters or less' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
    }
    if (/^[0-9_]/.test(username)) {
      return { valid: false, error: 'Username must start with a letter' };
    }
    return { valid: true, error: null };
  }, []);

  useEffect(() => {
    // Reset state when username is cleared
    if (!username) {
      setIsAvailable(null);
      setError(null);
      setIsChecking(false);
      setLastChecked(null);
      return;
    }

    const trimmedUsername = username.trim();
    
    // Client-side validation first
    const validation = validateUsername(trimmedUsername);
    if (!validation.valid) {
      setIsAvailable(false);
      setError(validation.error);
      setIsChecking(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      setError(null);
      
      try {
        const result = await checkUsernameAvailability(trimmedUsername);
        setIsAvailable(result.available);
        setError(result.error);
        setLastChecked(Date.now());
      } catch (err) {
        setIsAvailable(false);
        setError(err.message || 'Failed to check username availability');
      } finally {
        setIsChecking(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [username, debounceMs, checkUsernameAvailability, validateUsername]);

  return { 
    isChecking, 
    isAvailable, 
    error, 
    lastChecked,
    validateUsername 
  };
};
