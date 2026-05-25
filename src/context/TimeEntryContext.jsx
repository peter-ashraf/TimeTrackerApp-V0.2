import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseAuth } from './SupabaseAuthContext';
import { supabase } from './SupabaseAuthContext';
import { supabaseData } from '../utils/supabaseData';
import { setSimpleEncryptedItem, getSimpleEncryptedItem } from '../utils/simple-encryption';
import { multiTabSync } from '../utils/multiTabSync';
import { cacheManager } from '../utils/cacheManager';

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
  const [pendingConflicts, setPendingConflicts] = useState([]);

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
        let finalEntries;
        if (Array.isArray(entriesToSave)) {
          setSimpleEncryptedItem(entriesKey, entriesToSave, currentUser.username);
          setEntries(entriesToSave);
          finalEntries = entriesToSave;
        } else {
          // Use functional update to avoid stale closure issues and minimize dependency changes
          setEntries(prev => {
            const updatedEntries = prev.filter(e => e.date !== entriesToSave.date);
            updatedEntries.unshift(entriesToSave);

            // Sync to local storage within the update or right after
            setSimpleEncryptedItem(entriesKey, updatedEntries, currentUser.username);
            return updatedEntries;
          });
          // Get the updated entries for caching
          finalEntries = [entriesToSave, ...entries.filter(e => e.date !== entriesToSave.date)];
        }

        // Also save to cacheManager for offline access
        try {
          const allEntries = Array.isArray(entriesToSave) ? entriesToSave : finalEntries;
          cacheManager.setCachedData('timeEntries', allEntries);
        } catch (cacheError) {
          console.warn('Failed to save to cacheManager:', cacheError);
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
            const returnedEntry = Array.isArray(savedData) ? savedData[0] : savedData;
            if (returnedEntry?.id && !Array.isArray(entriesToSave)) {
              setEntries(prev => prev.map(e =>
                e.date === entriesToSave.date ? { ...e, id: returnedEntry.id } : e
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

      // Try cacheManager first for instant loading
      let localEntries = [];
      try {
        const cachedEntries = await cacheManager.getCachedData('timeEntries', null);
        if (cachedEntries && cachedEntries.length > 0) {
          localEntries = cachedEntries;
        }
      } catch (cacheError) {
        console.warn('CacheManager failed, falling back to localStorage:', cacheError);
      }

      // Fallback to encrypted localStorage if cacheManager fails or returns empty
      if (localEntries.length === 0) {
        const entriesKey = `timeEntries_${currentUser.id}`;
        localEntries = getSimpleEncryptedItem(entriesKey, currentUser.username) || [];
      }

      setEntries(localEntries);

      // Immediate Supabase sync if online
      if (navigator.onLine && currentUser) {
        try {
          const fetchWithTimeout = Promise.race([
            supabaseData.getTimeEntries(currentUser.id).catch(err => {
              if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
                console.warn('Session expired during time entries fetch in TimeEntryContext');
                return []; // Return empty array to not break the app
              }
              throw err;
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Supabase fetch timed out')), 8000)
            )
          ]);
          const entriesData = await fetchWithTimeout;

          // If online and Supabase returned empty, check if we have offline-created entries
          if (navigator.onLine && entriesData && entriesData.length === 0) {
            const unsyncedLocal = localEntries.filter(e => !e.id);
            if (unsyncedLocal.length > 0) {
              setEntries(unsyncedLocal.sort((a, b) => b.date.localeCompare(a.date)));
              console.log(`[Sync] Supabase returned empty, but uploading ${unsyncedLocal.length} offline-created entries...`);
              Promise.all(
                unsyncedLocal.map(async (entry) => {
                  try {
                    const saved = await supabaseData.saveTimeEntry(currentUser.id, entry);
                    const returnedEntry = Array.isArray(saved) ? saved[0] : saved;
                    if (returnedEntry?.id) {
                      setEntries(prev => prev.map(e =>
                        e.date === entry.date ? { ...e, id: returnedEntry.id } : e
                      ));
                    }
                  } catch (err) {
                    console.error(`[Sync] Failed to upload entry for ${entry.date}:`, err);
                  }
                })
              );
            } else {
              setEntries([]);
            }
            return;
          }

          if (entriesData && entriesData.length > 0) {
            const localMap = new Map(localEntries.map(e => [e.date, e]));
            const remoteMap = new Map(entriesData.map(e => [e.date, e]));

            const entriesToUpload = [];
            const finalEntries = [];
            const conflicts = [];

            // 1. Process all remote entries
            for (const [date, remoteEntry] of remoteMap) {
              const localEntry = localMap.get(date);

              if (!localEntry) {
                // Only on remote -> pull remote
                finalEntries.push(remoteEntry);
              } else {
                // On both -> compare fields
                const localType = localEntry.type || 'Regular';
                const remoteType = remoteEntry.type || 'Regular';

                const localIntervals = JSON.stringify(localEntry.intervals || []);
                const remoteIntervals = JSON.stringify(remoteEntry.intervals || []);

                const localNotes = (localEntry.notes || '').trim();
                const remoteNotes = (remoteEntry.notes || '').trim();

                const localDuration = localEntry.duration || 1;
                const remoteDuration = remoteEntry.duration || 1;

                const localDouble = !!(localEntry.doubleHours || localEntry.double_hours);
                const remoteDouble = !!(remoteEntry.doubleHours || remoteEntry.double_hours);

                const isDifferent =
                  localType !== remoteType ||
                  localIntervals !== remoteIntervals ||
                  localNotes !== remoteNotes ||
                  localDuration !== remoteDuration ||
                  localDouble !== remoteDouble;

                if (isDifferent) {
                  const localTime = Date.parse(localEntry.lastModified || localEntry.updated_at || 0);
                  const remoteTime = Date.parse(remoteEntry.updated_at || remoteEntry.lastModified || 0);

                  if (localTime > remoteTime + 2000) {
                    // Local is newer -> upload local to Supabase
                    entriesToUpload.push({
                      ...localEntry,
                      id: remoteEntry.id // Keep remote ID
                    });
                    finalEntries.push({
                      ...localEntry,
                      id: remoteEntry.id
                    });
                  } else if (remoteTime > localTime + 2000) {
                    // Remote is newer -> use remote
                    finalEntries.push(remoteEntry);
                  } else {
                    // Conflict! (within 2s threshold)
                    conflicts.push({ date, local: localEntry, remote: remoteEntry });
                    finalEntries.push(remoteEntry);
                  }
                } else {
                  // Identical raw data -> keep local to preserve computed/derived math
                  finalEntries.push({
                    ...localEntry,
                    id: remoteEntry.id
                  });
                }
              }
            }

            // 2. Process local-only entries
            for (const [date, localEntry] of localMap) {
              if (!remoteMap.has(date)) {
                if (!localEntry.id) {
                  // Created offline -> upload to Supabase
                  entriesToUpload.push(localEntry);
                  finalEntries.push(localEntry);
                } else {
                  // Deleted on remote -> do not add to finalEntries
                  console.log(`[Sync] Entry for ${date} was deleted on remote. Removing locally.`);
                }
              }
            }

            // Update local state immediately with auto-reconciled list
            setPendingConflicts(conflicts);
            setEntries(finalEntries.sort((a, b) => b.date.localeCompare(a.date)));

            // Trigger background upload for unsynced/newer local entries
            if (entriesToUpload.length > 0) {
              console.log(`[Sync] Uploading ${entriesToUpload.length} local/edited entries to Supabase...`);
              Promise.all(
                entriesToUpload.map(async (entry) => {
                  try {
                    const saved = await supabaseData.saveTimeEntry(currentUser.id, entry);
                    const returnedEntry = Array.isArray(saved) ? saved[0] : saved;
                    if (returnedEntry?.id) {
                      setEntries(prev => prev.map(e =>
                        e.date === entry.date ? { ...e, id: returnedEntry.id } : e
                      ));
                    }
                  } catch (err) {
                    console.error(`[Sync] Failed to upload entry for ${entry.date}:`, err);
                  }
                })
              ).catch(err => {
                console.error('[Sync] Error uploading unsynced entries:', err);
              });
            }
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
      // Also save to cacheManager, but only if data is not empty
      if (entries.length > 0) {
        try {
          cacheManager.setCachedData('timeEntries', entries);
        } catch (cacheError) {
          console.warn('Failed to save to cacheManager in useEffect:', cacheError);
        }
      }
      return;
    }

    // Always store to local encrypted storage instantly for offline access
    const entriesKey = `timeEntries_${currentUser.id}`;
    setSimpleEncryptedItem(entriesKey, entries, currentUser.username);
    multiTabSync.notifyDataChange('timeEntries', entries, currentUser.username);
    // Also save to cacheManager, but only if data is not empty
    if (entries.length > 0) {
      try {
        cacheManager.setCachedData('timeEntries', entries);
      } catch (cacheError) {
        console.warn('Failed to save to cacheManager in useEffect:', cacheError);
      }
    }
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

  // Trigger conflict detection when device comes online
  useEffect(() => {
    const handleOnline = () => {
      if (currentUser && isAuthenticated) {
        // Small delay to let connection stabilize
        setTimeout(() => {
          loadTimeEntriesData();
        }, 2000);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [currentUser, isAuthenticated, loadTimeEntriesData]);

  const resolveConflict = useCallback((date, chosenEntry) => {
    // 1. Update entries state
    setEntries(current => {
      const updated = current.filter(e => e.date !== date);
      updated.push(chosenEntry);
      return updated.sort((a, b) => b.date.localeCompare(a.date));
    });

    // 2. Remove from pending conflicts
    setPendingConflicts(prev => prev.filter(c => c.date !== date));

    // 3. Save to Supabase — wrap in setTimeout to run after state settles
    setTimeout(() => {
      saveTimeEntriesData(chosenEntry);
    }, 0);
  }, [saveTimeEntriesData]);

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
    pendingConflicts,

    // Helper functions
    formatDate,
    formatTime,

    // Data operations
    loadTimeEntriesData,
    saveTimeEntriesData,
    resolveConflict,

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
