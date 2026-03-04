import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseAuth } from './SupabaseAuthContext';
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
  
  // Refs to track state
  const isRefreshingRef = useRef(false);
  const isLoadingRef = useRef(false);

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

  // Save time entries data
  const saveTimeEntriesData = useCallback(async (entries) => {
    if (!currentUser) return;

    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000;

    const attemptSave = async () => {
      try {
        if (currentUser && isAuthenticated && !currentUser.isLocalOnly) {
          for (const entry of entries) {
            await supabaseData.saveTimeEntry(currentUser.id, entry);
          }
        }
      } catch (error) {
        console.error('Failed to save time entries to Supabase:', error);
        
        // Handle auth-related errors
        if (error.status === 401 || error.status === 406 || (error.message && (error.message.includes('401') || error.message.includes('406')))) {
          const entriesKey = `timeEntries_${currentUser.id}`;
          setSimpleEncryptedItem(entriesKey, entries, currentUser.username);
          return;
        }

        // Check if it's a Navigator Lock Manager timeout
        if (error.message && error.message.includes('Navigator LockManager')) {
          if (retryCount < maxRetries) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return attemptSave();
          }
        }
        
        // Fallback to localStorage for any other error
        const entriesKey = `timeEntries_${currentUser.id}`;
        setSimpleEncryptedItem(entriesKey, entries, currentUser.username);
      }
    };

    await attemptSave();
  }, [currentUser, isAuthenticated]);

  // Load time entries data
  const loadTimeEntriesData = useCallback(async () => {
    if (!currentUser || !isAuthenticated) return;
    if (isLoadingRef.current) return;
    
    try {
      isLoadingRef.current = true;
      
      // Load from local storage immediately
      const entriesKey = `timeEntries_${currentUser.id}`;
      const localEntries = getSimpleEncryptedItem(entriesKey, currentUser.username) || [];
      setEntries(localEntries);
      
      // Defer Supabase sync
      setTimeout(async () => {
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
      }, 500);
      
    } catch (error) {
      console.error('loadTimeEntriesData critical error:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, [currentUser, isAuthenticated]);

  // Save entries when they change
  useEffect(() => {
    if (!currentUser || !entries) return;
    if (isRefreshingRef.current) return;
    
    saveTimeEntriesData(entries);
    multiTabSync.notifyDataChange('timeEntries', entries, currentUser.username);
  }, [entries, currentUser, saveTimeEntriesData]);

  // Load entries when user changes
  useEffect(() => {
    if (currentUser && isAuthenticated) {
      loadTimeEntriesData();
    } else {
      setEntries([]);
    }
  }, [currentUser, isAuthenticated, loadTimeEntriesData]);

  const contextValue = {
    // State
    entries,
    setEntries: updateEntries,
    lastSaved,
    setLastSaved,
    lastRefreshed,
    setLastRefreshed,
    
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
