import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseAuth } from './SupabaseAuthContext';
import { supabase } from './SupabaseAuthContext';
import { supabaseData } from '../utils/supabaseData';
import { setSimpleEncryptedItem, getSimpleEncryptedItem } from '../utils/simple-encryption';
import { multiTabSync } from '../utils/multiTabSync';

const TimeEntryContext = createContext();

export const useTimeEntry = () => {
  const context = useContext(TimeEntryContext);
  if (!context) {
    throw new Error('useTimeEntry must be used within TimeEntryProvider');
  }
  return context;
};

export const TimeEntryProvider = ({ children }) => {
  const { currentUser, isAuthenticated, getUserData, saveUserData } = useSupabaseAuth();
  
  // Time Entries State
  const [entries, setEntries] = useState([]);
  const [lastSaved, setLastSaved] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ message: '', type: '' });
  
  // Refs to track state
  const isRefreshingRef = useRef(false);
  const isLoadingRef = useRef(false);
  const isInitialSyncRef = useRef(true);
  const initialSyncTimeoutRef = useRef(null);

  // Helper functions
  const formatDate = useCallback((date) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }, []);

  const formatTime = useCallback((date) => {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }, []);

  // Update entries function
  const updateEntries = useCallback((newEntries) => {
    setEntries(newEntries);
    if (!isRefreshingRef.current) {
      setLastSaved(new Date().toISOString());
    }
  }, []);

  // Save time entries data with enhanced retry logic and user feedback
  const saveTimeEntriesData = useCallback(async (entriesToSave, showAlert = null) => {
    if (!currentUser) return;

    setIsSaving(true);
    setSaveStatus({ message: 'Saving...', type: 'info' });

    let retryCount = 0;
    const maxRetries = 5;
    const baseRetryDelay = 1000;
    
    const attemptSave = async () => {
      try {
        // Always save to local storage first as backup
        const entriesKey = `timeEntries_${currentUser.id}`;
        if (Array.isArray(entriesToSave)) {
          setSimpleEncryptedItem(entriesKey, entriesToSave, currentUser.username);
        } else {
          // For single entry, get current entries and update
          const currentEntries = getSimpleEncryptedItem(entriesKey, currentUser.username) || [];
          const updatedEntries = currentEntries.filter(e => e.date !== entriesToSave.date);
          updatedEntries.unshift(entriesToSave);
          setSimpleEncryptedItem(entriesKey, updatedEntries, currentUser.username);
          
          // sync React state with the updated entries
          setEntries(updatedEntries);
        }

        // Try to save to Supabase if online, authenticated, and not local-only
        if (currentUser && isAuthenticated && !currentUser.isLocalOnly && navigator.onLine) {
          try {
            // Add timeout to handle intermittent connectivity issues
            const savePromise = Array.isArray(entriesToSave) 
              ? Promise.all(entriesToSave.map(entry => supabaseData.saveTimeEntry(currentUser.id, entry)))
              : supabaseData.saveTimeEntry(currentUser.id, entriesToSave);
            
            const savedData = await savePromise;
            
            // ✅ ADD THIS — merge returned Supabase id back into local state
            if (savedData?.id && !Array.isArray(entriesToSave)) {
              setEntries(prev => prev.map(e =>
                e.date === entriesToSave.date ? { ...e, id: savedData.id } : e
              ));
            }
            
            setLastSaved(new Date().toISOString());
            return { success: true, savedTo: 'supabase' };
          } catch (saveError) {
            console.error('[Save] Supabase save failed:', saveError.message);
            // For intermittent issues, continue with local save and don't retry
            setLastSaved(new Date().toISOString());
            return { success: true, savedTo: 'local', reason: 'connectivity_issue' };
          }
        } else {
          setLastSaved(new Date().toISOString());
          return { success: true, savedTo: 'local' };
        }
      } catch (error) {
        console.error(`Save attempt ${retryCount + 1} failed:`, error);
        
        // Handle auth-related errors - don't retry these
        if (error.status === 401 || error.status === 406 || (error.message && (error.message.includes('401') || error.message.includes('406')))) {
          if (showAlert) {
            showAlert('Authentication issue. Data saved locally only.', 'warning');
          }
          return { success: false, error: 'auth', savedTo: 'local' };
        }

        // Handle network errors with exponential backoff
        if (retryCount < maxRetries) {
          retryCount++;
          const exponentialDelay = baseRetryDelay * Math.pow(2, retryCount - 1);
          const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter
          const delay = exponentialDelay + jitter;
          
          if (showAlert && retryCount === 2) {
            showAlert('Connection issues. Retrying save...', 'info');
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return attemptSave();
        } else {
          // Max retries reached - data is already saved locally
          if (showAlert) {
            showAlert('Failed to save to server. Data saved locally.', 'error');
          }
          return { success: false, error: 'max_retries', savedTo: 'local' };
        }
      }
    };

    try {
      const result = await attemptSave();
      return result;
    } finally {
      // Clear save status after a delay
      setTimeout(() => {
        setIsSaving(false);
        setSaveStatus({ message: '', type: '' });
      }, 2000);
    }
  }, [currentUser, isAuthenticated]);

  // Load time entries data
  const loadTimeEntriesData = useCallback(async () => {
    if (!currentUser || !isAuthenticated) {
      return;
    }
    if (isLoadingRef.current) {
      return;
    }
    
    try {
      isLoadingRef.current = true;
      
      // Load from local storage immediately
      const entriesKey = `timeEntries_${currentUser.id}`;
      const localEntries = getSimpleEncryptedItem(entriesKey, currentUser.username) || [];
      setEntries(localEntries);
      
      // Immediate Supabase sync if online
      if (navigator.onLine && currentUser && !currentUser.isLocalOnly) {
        try {
          const entriesData = await supabaseData.getTimeEntries(currentUser.id);
          if (entriesData && entriesData.length > 0) {
            // Smart merge entries
            setEntries(prev => {
              const prevMap = new Map(prev.map(e => [e.date, e]));
              entriesData.forEach(entry => {
                const existing = prevMap.get(entry.date);
                if (!existing || new Date(entry.updated_at || 0) > new Date(existing.lastModified || 0)) {
                  prevMap.set(entry.date, entry);
                }
              });
              return Array.from(prevMap.values()).sort((a, b) => b.date.localeCompare(a.date));
            });
          }
        } catch (onlineError) {
          console.error('Failed to fetch from Supabase, staying with local data', onlineError);
        }
      }
      
    } catch (error) {
      console.error('loadTimeEntriesData critical error:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, [currentUser, isAuthenticated]);

  // Only save local storage heavily on array change.
  // We remove the cloud save from here to prevent loops on 100 items.
  useEffect(() => {
    if (!currentUser || !entries) return;
    if (isRefreshingRef.current) return;
    
    // Skip save status updates during initial sync
    const isInitialSync = isInitialSyncRef.current;
    if (isInitialSync) {
      // Just save to localStorage without triggering save status
      const entriesKey = `timeEntries_${currentUser.id}`;
      setSimpleEncryptedItem(entriesKey, entries, currentUser.username);
      multiTabSync.notifyDataChange('timeEntries', entries, currentUser.username);
      return;
    }
    
    // Always store to local encrypted storage instantly for offline access
    const entriesKey = `timeEntries_${currentUser.id}`;
    setSimpleEncryptedItem(entriesKey, entries, currentUser.username);
    multiTabSync.notifyDataChange('timeEntries', entries, currentUser.username);
  }, [entries, currentUser]);

  // Load entries when user changes
  useEffect(() => {
    if (currentUser && isAuthenticated) {
      loadTimeEntriesData();
      // Clear initial sync flag after 3 seconds to prevent save status
      if (initialSyncTimeoutRef.current) {
        clearTimeout(initialSyncTimeoutRef.current);
      }
      initialSyncTimeoutRef.current = setTimeout(() => {
        isInitialSyncRef.current = false;
      }, 3000);
    } else {
      setEntries([]);
      isInitialSyncRef.current = true; // Reset flag for next login
      if (initialSyncTimeoutRef.current) {
        clearTimeout(initialSyncTimeoutRef.current);
      }
    }
  }, [currentUser, isAuthenticated, loadTimeEntriesData]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (initialSyncTimeoutRef.current) {
        clearTimeout(initialSyncTimeoutRef.current);
      }
    };
  }, []);

  const contextValue = {
    // State
    entries,
    setEntries: updateEntries,
    lastSaved,
    setLastSaved,
    lastRefreshed,
    setLastRefreshed,
    isSaving,
    saveStatus,
    
    // Helper functions
    formatDate,
    formatTime,
    
    // Data operations
    loadTimeEntriesData,
    saveTimeEntriesData,
    
    // Ref management
    setRefreshing: (isRefreshing) => {
      isRefreshingRef.current = isRefreshing;
    }
  };

  return (
    <TimeEntryContext.Provider value={contextValue}>
      {children}
    </TimeEntryContext.Provider>
  );
};
