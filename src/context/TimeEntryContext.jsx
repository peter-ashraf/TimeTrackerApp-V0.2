import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseAuth } from './SupabaseAuthContext';
import { supabase } from './SupabaseAuthContext';
import { supabaseData } from '../utils/supabaseData';
import { setSimpleEncryptedItem, getSimpleEncryptedItem } from '../utils/simple-encryption';
import { multiTabSync } from '../utils/multiTabSync';
import { cacheManager } from '../utils/cacheManager';
import {
  clearPendingTimeEntrySync,
  markPendingTimeEntrySync
} from '../utils/timeEntrySyncStatus';
import { syncTimeEntryToCloud } from '../utils/timeEntrySyncManager';
import {
  buildTimeEntrySyncPlan,
  normalizeDateKey as normalizeSyncDateKey,
} from '../utils/timeEntrySyncPlanner';

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
  const [conflictResolver, setConflictResolver] = useState(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);

  // Refs to track state
  const isRefreshingRef = useRef(false);
  const isLoadingRef = useRef(false);
  const isInitialSyncRef = useRef(true);
  const initialSyncTimeoutRef = useRef(null);
  const entriesRef = useRef(entries);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

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

  const normalizeDateKey = useCallback(normalizeSyncDateKey, []);

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
              const repairedEntries = finalEntries.map(e =>
                normalizeDateKey(e.date) === normalizeDateKey(entriesToSave.date)
                  ? { ...e, ...returnedEntry }
                  : e
              );
              setEntries(repairedEntries);
              setSimpleEncryptedItem(entriesKey, repairedEntries, currentUser.username);
              try {
                cacheManager.setCachedData('timeEntries', repairedEntries);
              } catch (cacheError) {
                console.warn('Failed to cache saved entry with cloud id:', cacheError);
              }
            }

            if (returnedEntry?.id || Array.isArray(entriesToSave)) {
              clearPendingTimeEntrySync(currentUser.id, entriesToSave);
            } else {
              markPendingTimeEntrySync(currentUser.id, entriesToSave, 'missing_cloud_id');
            }
            setLastSaved(new Date().toISOString());
            return { success: true, savedTo: 'supabase' };
          } catch (saveError) {
            console.error('[Save] Supabase save failed:', saveError.message);
            // For intermittent issues, continue with local save and don't retry
            markPendingTimeEntrySync(currentUser.id, entriesToSave, 'connectivity_issue');
            setLastSaved(new Date().toISOString());
            return { success: true, savedTo: 'local', reason: 'connectivity_issue' };
          }
        } else {
          if (isAuthenticated && !currentUser.isLocalOnly) {
            markPendingTimeEntrySync(currentUser.id, entriesToSave, navigator.onLine ? 'local_only' : 'offline');
          }
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
  }, [currentUser, isAuthenticated, normalizeDateKey]);

  // Load time entries data
  const loadTimeEntriesData = useCallback(async (options = {}) => {
    const forceConflictCheck = options?.forceConflictCheck === true;
    const fetchTimeoutMs = options?.fetchTimeoutMs ?? (forceConflictCheck ? 30000 : 20000);

    if (!currentUser || !isAuthenticated) {
      return {
        success: false,
        reason: 'not_authenticated',
        message: 'You are not signed in.'
      };
    }

    if (isLoadingRef.current) {
      return {
        success: false,
        skipped: true,
        reason: 'already_loading',
        message: 'A sync is already running.'
      };
    }

    const sortEntries = (entryList) =>
      [...entryList].sort((a, b) => normalizeDateKey(b.date).localeCompare(normalizeDateKey(a.date)));

    const persistEntriesSnapshot = (entryList) => {
      if (!currentUser || !Array.isArray(entryList)) return;

      try {
        const entriesKey = `timeEntries_${currentUser.id}`;
        setSimpleEncryptedItem(entriesKey, entryList, currentUser.username);
      } catch (storageError) {
        console.warn('Failed to persist synced entries to local storage:', storageError);
      }

      try {
        cacheManager.setCachedData('timeEntries', entryList);
      } catch (cacheError) {
        console.warn('Failed to persist synced entries to cache:', cacheError);
      }
    };

    const syncResult = {
      success: true,
      source: navigator.onLine ? 'cloud' : 'local',
      localCount: 0,
      remoteCount: 0,
      mergedCount: 0,
      pulledCount: 0,
      uploadCount: 0,
      failedUploadCount: 0,
      conflictCount: 0,
      requiresResolution: false,
      message: ''
    };

    const uploadLocalEntries = async (entriesToUpload) => {
      if (!entriesToUpload.length) return { uploaded: 0, failed: 0 };

      console.log(`[Sync] Uploading ${entriesToUpload.length} local entries to Supabase...`);

      const uploadResults = await Promise.all(
        entriesToUpload.map(async (entry) => {
          const result = await syncTimeEntryToCloud({
            userId: currentUser.id,
            entry,
            saveTimeEntry: (userId, entryToSave) => supabaseData.saveTimeEntry(userId, entryToSave),
          });

          if (result.returnedEntry?.id) {
            setEntries(prev => prev.map(e =>
              normalizeDateKey(e.date) === normalizeDateKey(entry.date)
                ? { ...e, id: result.returnedEntry.id }
                : e
            ));
          }

          if (!result.success) {
            console.error(`[Sync] Failed to upload entry for ${entry.date}:`, result.error);
          }

          return result;
        })
      );

      return {
        uploaded: uploadResults.filter(result => result.success).length,
        failed: uploadResults.filter(result => !result.success).length,
        returnedEntries: uploadResults
          .filter(result => result.success && result.returnedEntry)
          .map(result => result.returnedEntry)
      };
    };

    try {
      isLoadingRef.current = true;

      let localEntries = [];

      if (forceConflictCheck) {
        localEntries = entriesRef.current || [];
      } else {
        // Try cacheManager first for instant loading
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

        setEntries(sortEntries(localEntries));
      }

      syncResult.localCount = localEntries.length;

      if (!navigator.onLine || currentUser.isLocalOnly || !currentUser) {
        syncResult.source = 'local';
        syncResult.mergedCount = localEntries.length;
        syncResult.message = currentUser.isLocalOnly
          ? 'Loaded local entries. This account is local only.'
          : 'Loaded local entries. Cloud sync will run when you are online.';
        return syncResult;
      }

      const entriesData = await supabaseData
        .getTimeEntries(currentUser.id, { timeoutMs: fetchTimeoutMs })
        .catch(err => {
          if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
            throw new Error('Session expired while fetching cloud entries.');
          }
          throw err;
        });
      syncResult.remoteCount = entriesData?.length || 0;

      const {
        entriesToUpload,
        finalEntries,
        conflicts,
        pulledCount,
      } = buildTimeEntrySyncPlan({
        localEntries,
        remoteEntries: entriesData || [],
      });

      syncResult.pulledCount = pulledCount;

      finalEntries.forEach((entry) => {
        if (entry?.id) {
          clearPendingTimeEntrySync(currentUser.id, entry);
        }
      });

      syncResult.conflictCount = conflicts.length;
      syncResult.uploadCount = entriesToUpload.length;

      if (conflicts.length > 0) {
        console.log(`[Sync] Found ${conflicts.length} conflicts, pausing sync for user resolution`);
        setPendingConflicts(conflicts);
        setIsConflictModalOpen(true);
        setConflictResolver(() => (resolutions) => {
          const resolutionMap = new Map(resolutions.map(r => [r.entryId || r.date, r.chosenEntry]));
          const mergedEntries = [...finalEntries];

          conflicts.forEach(conflict => {
            const chosen = resolutionMap.get(conflict.entryId || conflict.date);
            if (chosen) {
              const existingIndex = mergedEntries.findIndex(e => normalizeDateKey(e.date) === conflict.date);
              if (existingIndex >= 0) {
                mergedEntries[existingIndex] = chosen;
              } else {
                mergedEntries.push(chosen);
              }
            }
          });

          setEntries(sortEntries(mergedEntries));

          const toUpload = resolutions.filter(r => r.chosenEntry === r.localEntry);
          if (toUpload.length > 0) {
            uploadLocalEntries(toUpload.map(resolution => resolution.chosenEntry)).catch(err => {
              console.error('[Sync] Error uploading user-chosen entries:', err);
            });
          }

          setPendingConflicts([]);
          setConflictResolver(null);
          setIsConflictModalOpen(false);
        });

        syncResult.requiresResolution = true;
        syncResult.mergedCount = finalEntries.length;
        syncResult.message = `Found ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'}. Resolve the modal to finish syncing.`;
        return syncResult;
      }

      const sortedFinalEntries = sortEntries(finalEntries);
      setPendingConflicts([]);
      setConflictResolver(null);
      setIsConflictModalOpen(false);
      setEntries(sortedFinalEntries);
      persistEntriesSnapshot(sortedFinalEntries);
      syncResult.mergedCount = sortedFinalEntries.length;
      syncResult.mergedEntries = sortedFinalEntries;

      const uploadSummary = await uploadLocalEntries(entriesToUpload);
      syncResult.uploadCount = uploadSummary.uploaded;
      syncResult.failedUploadCount = uploadSummary.failed;

      if (uploadSummary.returnedEntries?.length) {
        const returnedByDate = new Map(
          uploadSummary.returnedEntries.map((entry) => [normalizeDateKey(entry.date), entry])
        );
        const postUploadEntries = sortEntries(
          sortedFinalEntries.map((entry) => {
            const returnedEntry = returnedByDate.get(normalizeDateKey(entry.date));
            return returnedEntry ? { ...entry, ...returnedEntry } : entry;
          })
        );

        setEntries(postUploadEntries);
        persistEntriesSnapshot(postUploadEntries);
        syncResult.mergedCount = postUploadEntries.length;
        syncResult.mergedEntries = postUploadEntries;
      }

      if (syncResult.failedUploadCount > 0) {
        syncResult.success = false;
        syncResult.message = `Cloud fetch worked, but ${syncResult.failedUploadCount} local entr${syncResult.failedUploadCount === 1 ? 'y' : 'ies'} could not upload.`;
      } else if (syncResult.pulledCount > 0 || syncResult.uploadCount > 0) {
        syncResult.message = `Sync completed. Pulled ${syncResult.pulledCount} cloud entr${syncResult.pulledCount === 1 ? 'y' : 'ies'} and uploaded ${syncResult.uploadCount} local entr${syncResult.uploadCount === 1 ? 'y' : 'ies'}.`;
      } else {
        syncResult.message = `Sync completed. ${syncResult.remoteCount} cloud entr${syncResult.remoteCount === 1 ? 'y' : 'ies'} checked.`;
      }

      return syncResult;
    } catch (error) {
      console.error('Failed to fetch from Supabase, staying with local data', error);
      return {
        ...syncResult,
        success: false,
        source: 'local',
        reason: 'cloud_fetch_failed',
        error,
        message: error.message || 'Failed to fetch cloud entries.'
      };
    } finally {
      isLoadingRef.current = false;
    }
  }, [currentUser, isAuthenticated, normalizeDateKey]);

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
      let onlineTimer = null;

      const handleOnline = () => {
        if (!currentUser || !isAuthenticated) return;

        if (onlineTimer) {
          clearTimeout(onlineTimer);
        }

        onlineTimer = setTimeout(() => {
          loadTimeEntriesData();
        }, 300);
      };

      window.addEventListener('online', handleOnline);

      return () => {
        window.removeEventListener('online', handleOnline);
        if (onlineTimer) {
          clearTimeout(onlineTimer);
        }
      };
    }, [currentUser, isAuthenticated, loadTimeEntriesData]);

    const closeConflictModal = useCallback(() => {
      setIsConflictModalOpen(false);
    }, []);

    const clearConflicts = useCallback(() => {
      setPendingConflicts([]);
      setConflictResolver(null);
      setIsConflictModalOpen(false);
    }, []);

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
    conflictResolver,
    isConflictModalOpen,

    // Helper functions
    formatDate,
    formatTime,

    // Data operations
    loadTimeEntriesData,
    saveTimeEntriesData,
    resolveConflict,
    clearConflicts,
    closeConflictModal,

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
