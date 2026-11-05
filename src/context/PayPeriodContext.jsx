import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseAuth } from './SupabaseAuthContext';
import { supabaseData } from '../utils/supabaseData';
import { setSimpleEncryptedItem, getSimpleEncryptedItem } from '../utils/simple-encryption';
import { multiTabSync } from '../utils/multiTabSync';
import { cacheManager } from '../utils/cacheManager';

const PayPeriodContext = createContext();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A period exists in the cloud only once it has a real UUID (temp ids are 'period-…' / legacy 'local-…')
const isCloudId = (id) => !!id && UUID_RE.test(String(id));

export const usePayPeriod = () => {
  const context = useContext(PayPeriodContext);
  if (!context) {
    throw new Error('usePayPeriod must be used within PayPeriodProvider');
  }
  return context;
};

export const PayPeriodProvider = ({ children }) => {
  const { currentUser, isAuthenticated } = useSupabaseAuth();
  
  // Pay Periods State
  const [periods, setPeriods] = useState([]);
  const [currentPeriodId, setCurrentPeriodId] = useState(null);
  
  // Refs to track state
  const isSavingPeriodsRef = useRef(false);
  const isSettingCurrentRef = useRef(false);
  const refreshKeyRef = useRef(0);
  // Tracks real-ID periods that were modified and need to be synced to Supabase
  const dirtyPeriodIdsRef = useRef(new Set());
  // Cloud ids deleted locally that still need deleting in Supabase
  const pendingDeletesRef = useRef(new Set());

  const normalizeCurrentFlags = useCallback((periodList, selectedId) => {
    if (!Array.isArray(periodList)) return [];

    const validSelectedId = selectedId && selectedId !== 'undefined' && selectedId !== 'null'
      ? String(selectedId)
      : null;
    const fallbackCurrent = !validSelectedId
      ? periodList.find(period => period?.is_current === true)
      : null;
    const currentId = validSelectedId || (fallbackCurrent ? String(fallbackCurrent.id) : null);

    return periodList.map(period => ({
      ...period,
      is_current: currentId ? String(period.id) === currentId : !!period.is_current
    }));
  }, []);

  const persistCurrentPeriodId = useCallback((periodId, periodList = []) => {
    if (!currentUser || !periodId) return;

    const currentPeriodIdKey = `currentPeriodId_${currentUser.id}`;
    localStorage.setItem(currentPeriodIdKey, periodId);

    try {
      cacheManager.setCachedData('currentPeriod', periodId);
      if (Array.isArray(periodList) && periodList.length > 0) {
        cacheManager.setCachedData('payPeriods', periodList);
      }
    } catch (cacheError) {
      console.warn('Failed to persist current period cache:', cacheError);
    }
  }, [currentUser]);

  // Load pay periods data
  const loadPayPeriodsData = useCallback(async () => {
    if (!currentUser || !isAuthenticated) return;

    try {
      // Define keys for localStorage
      const periodsKey = `payPeriods_${currentUser.id}`;
      const currentPeriodIdKey = `currentPeriodId_${currentUser.id}`;

      // Try cacheManager first for instant loading
      let localPeriods = [];
      let localCurrentPeriodId = null;

      try {
        const cachedPeriods = await cacheManager.getCachedData('payPeriods', null);
        if (cachedPeriods && cachedPeriods.length > 0) {
          localPeriods = cachedPeriods;
        }
        const cachedCurrentPeriodId = await cacheManager.getCachedData('currentPeriod', null);
        if (cachedCurrentPeriodId) {
          localCurrentPeriodId = cachedCurrentPeriodId;
        }
      } catch (cacheError) {
        console.warn('CacheManager failed, falling back to localStorage:', cacheError);
      }

      // Fallback to encrypted localStorage if cacheManager fails or returns empty
      if (localPeriods.length === 0) {
        localPeriods = getSimpleEncryptedItem(periodsKey, currentUser.username) || [];
        localCurrentPeriodId = localStorage.getItem(currentPeriodIdKey);
      }

      const normalizedLocalPeriods = normalizeCurrentFlags(localPeriods, localCurrentPeriodId);
      setPeriods(normalizedLocalPeriods);
      if (localCurrentPeriodId && localCurrentPeriodId !== 'undefined' && localCurrentPeriodId !== 'null') {
        setCurrentPeriodId(localCurrentPeriodId);
      }

      // Defer Supabase sync
      setTimeout(async () => {
        if (navigator.onLine && currentUser && !currentUser.isLocalOnly) {
          try {
            let [periodsData, currentPeriodData] = await Promise.all([
              supabaseData.getPayPeriods(currentUser.id).catch(err => {
                if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
                  console.warn('Session expired during pay periods fetch in PayPeriodContext');
                  return [];
                }
                throw err;
              }),
              supabaseData.getCurrentPayPeriod(currentUser.id).catch(err => {
                if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
                  console.warn('Session expired during current pay period fetch in PayPeriodContext');
                  return null;
                }
                throw err;
              })
            ]);

            // Merge instead of replace: keep local periods not yet in the cloud, honour
            // pending deletes, and keep local versions of edited-but-unsynced periods.
            const cloudList = (periodsData || []).filter(p => !pendingDeletesRef.current.has(String(p.id)));
            const unsyncedLocal = (localPeriods || []).filter(p => !isCloudId(p.id));
            periodsData = cloudList.map(cp => {
              if (dirtyPeriodIdsRef.current.has(String(cp.id))) {
                const lp = (localPeriods || []).find(p => String(p.id) === String(cp.id));
                return lp ? { ...cp, ...lp } : cp;
              }
              return cp;
            }).concat(unsyncedLocal);

            if (periodsData && periodsData.length > 0) {
              let selectedId = localCurrentPeriodId;
              if (currentPeriodData) {
                const pId = currentPeriodData.id || currentPeriodData;
                if (pId && pId !== 'undefined' && pId !== 'null') {
                  selectedId = pId;
                }
              }

              const normalizedPeriodsData = normalizeCurrentFlags(periodsData, selectedId);
              setPeriods(normalizedPeriodsData);

              if (selectedId && selectedId !== 'undefined' && selectedId !== 'null') {
                setCurrentPeriodId(selectedId);
                persistCurrentPeriodId(selectedId, normalizedPeriodsData);
              }
            }
          } catch (onlineError) {
            console.error('Failed to fetch pay periods from Supabase, staying with local data', onlineError);
          }
        }
      }, 400);
      
    } catch (error) {
      console.error('loadPayPeriodsData critical error:', error);
    }
  }, [currentUser, isAuthenticated, normalizeCurrentFlags, persistCurrentPeriodId]);

  // Persist dirty ids + pending deletes so a reload/crash doesn't lose queued cloud work
  const pendingKey = currentUser ? `payPeriodsPending_${currentUser.id}` : null;
  const persistPending = useCallback(() => {
    if (!pendingKey) return;
    try {
      localStorage.setItem(pendingKey, JSON.stringify({
        dirty: [...dirtyPeriodIdsRef.current],
        deletes: [...pendingDeletesRef.current]
      }));
    } catch (_) { /* ignore */ }
  }, [pendingKey]);

  useEffect(() => {
    dirtyPeriodIdsRef.current = new Set();
    pendingDeletesRef.current = new Set();
    if (!pendingKey) return;
    try {
      const raw = JSON.parse(localStorage.getItem(pendingKey) || 'null');
      if (raw) {
        (raw.dirty || []).forEach(id => dirtyPeriodIdsRef.current.add(String(id)));
        (raw.deletes || []).forEach(id => pendingDeletesRef.current.add(String(id)));
      }
    } catch (_) { /* ignore */ }
  }, [pendingKey]);

  // Mark a real-ID period as dirty (modified) so the sync will push it
  const markPeriodDirty = useCallback((periodId) => {
    if (periodId && isCloudId(periodId)) {
      dirtyPeriodIdsRef.current.add(String(periodId));
      persistPending();
    }
  }, [persistPending]);

  const periodsRef = useRef(periods);
  periodsRef.current = periods;
  const retryTimerRef = useRef(null);
  const retryAttemptRef = useRef(0);
  const rerunRequestedRef = useRef(false);
  const syncFnRef = useRef(null);

  // Push all unsynced period changes (creates, edits, deletes) to Supabase immediately.
  // On failure the work stays queued (temp id / dirty set / pending deletes, persisted in
  // localStorage) and is retried with exponential backoff, on 'online', and on next load.
  // Previously a failed insert renamed the period to 'local-…', which was never retried again.
  const syncPeriodsToCloud = useCallback(async () => {
    if (!currentUser || currentUser.isLocalOnly) return;
    if (isSavingPeriodsRef.current) { rerunRequestedRef.current = true; return; }
    if (!navigator.onLine) return;

    const periodsKey = `payPeriods_${currentUser.id}`;
    isSavingPeriodsRef.current = true;
    rerunRequestedRef.current = false;
    let hadFailure = false;
    try {
      // 1) Deletes
      for (const id of [...pendingDeletesRef.current]) {
        try {
          await supabaseData.deletePayPeriod(currentUser.id, id);
          pendingDeletesRef.current.delete(id);
        } catch (err) {
          hadFailure = true;
          console.error(`Failed to delete pay period ${id} from cloud (will retry):`, err);
        }
      }

      // 2) Creates (non-UUID ids) and edits (dirty real ids)
      const snapshot = periodsRef.current || [];
      const needSync = snapshot.filter(p =>
        !isCloudId(p.id) || dirtyPeriodIdsRef.current.has(String(p.id))
      );
      const savedMap = new Map();
      for (const period of needSync) {
        const key = String(period.id);
        try {
          const saved = await supabaseData.savePayPeriod(currentUser.id, period);
          if (!saved || !saved.id) throw new Error('savePayPeriod returned no row');
          dirtyPeriodIdsRef.current.delete(key);
          savedMap.set(key, saved);
        } catch (err) {
          hadFailure = true;
          console.error(`Failed to sync pay period ${period.id} (will retry):`, err);
        }
      }
      persistPending();

      if (savedMap.size > 0) {
        setPeriods(prev => {
          const next = prev.map(p => {
            const saved = savedMap.get(String(p.id));
            if (!saved) return p;
            // Adopt cloud id/timestamps, keep any local edits made during the save
            return { ...p, id: saved.id, user_id: saved.user_id, created_at: saved.created_at, updated_at: saved.updated_at };
          });
          setSimpleEncryptedItem(periodsKey, next, currentUser.username);
          try { cacheManager.setCachedData('payPeriods', next); } catch (_) { /* ignore */ }
          return next;
        });
        // If the selected period just received its real id, persist it and mark it current in the cloud
        const currentKey = `currentPeriodId_${currentUser.id}`;
        const storedCurrent = localStorage.getItem(currentKey);
        const savedCurrent = storedCurrent ? savedMap.get(String(storedCurrent)) : null;
        setCurrentPeriodId(prevId => {
          const s = prevId ? savedMap.get(String(prevId)) : null;
          return s ? s.id : prevId;
        });
        if (savedCurrent) {
          localStorage.setItem(currentKey, savedCurrent.id);
          try { cacheManager.setCachedData('currentPeriod', savedCurrent.id); } catch (_) { /* ignore */ }
          supabaseData.setCurrentPayPeriod(currentUser.id, savedCurrent.id)
            .catch(err => console.warn('Failed to mark synced period current in cloud:', err));
        }
      }
    } finally {
      isSavingPeriodsRef.current = false;
    }

    clearTimeout(retryTimerRef.current);
    if (hadFailure) {
      retryAttemptRef.current += 1;
      const delay = Math.min(60000, 2000 * 2 ** (retryAttemptRef.current - 1));
      retryTimerRef.current = setTimeout(() => { syncFnRef.current?.(); }, delay);
    } else {
      retryAttemptRef.current = 0;
    }
    if (rerunRequestedRef.current) {
      rerunRequestedRef.current = false;
      setTimeout(() => { syncFnRef.current?.(); }, 0);
    }
  }, [currentUser, persistPending]);
  syncFnRef.current = syncPeriodsToCloud;

  // Delete a period locally and queue the cloud delete (retried until it succeeds)
  const deletePeriod = useCallback((periodId) => {
    if (periodId && isCloudId(periodId)) {
      pendingDeletesRef.current.add(String(periodId));
      dirtyPeriodIdsRef.current.delete(String(periodId));
      persistPending();
    }
    setPeriods(prev => prev.filter(p => String(p.id) !== String(periodId)));
  }, [persistPending]);

  // Persist locally on every change, then push pending work to the cloud immediately
  useEffect(() => {
    if (!currentUser || !periods) return;
    if (isSettingCurrentRef.current) return;

    const periodsKey = `payPeriods_${currentUser.id}`;
    setSimpleEncryptedItem(periodsKey, periods, currentUser.username);
    if (periods.length > 0) {
      try {
        cacheManager.setCachedData('payPeriods', periods);
        if (currentPeriodId) cacheManager.setCachedData('currentPeriod', currentPeriodId);
      } catch (cacheError) {
        console.warn('Failed to save to cacheManager:', cacheError);
      }
    }
    multiTabSync.notifyDataChange('payPeriods', periods, currentUser.username);

    const hasWork = pendingDeletesRef.current.size > 0 || periods.some(p =>
      !isCloudId(p.id) || dirtyPeriodIdsRef.current.has(String(p.id))
    );
    if (hasWork) syncPeriodsToCloud();
  }, [periods, currentUser, currentPeriodId, syncPeriodsToCloud]);

  useEffect(() => () => clearTimeout(retryTimerRef.current), []);

  // Get current period
  const getCurrentPeriod = useCallback(() => {
    if (!periods || periods.length === 0) {
      return null;
    }
    
    // The selected local id is the source of truth. Database flags can be stale.
    const found = periods.find(p => String(p.id) === String(currentPeriodId));
    if (found) {
      return found;
    }

    const currentFromDb = periods.find(p => p.is_current === true);
    if (currentFromDb) {
      return currentFromDb;
    }
    
    // Final fallback to first period
    return periods[0];
  }, [periods, currentPeriodId]);

  // Set current period
  const setCurrentPeriod = async (periodId) => {
    if (!currentUser || !periodId || isSettingCurrentRef.current) {
      return { success: false, cloudSynced: false, error: 'Current period update is already running.' };
    }

    const selectedPeriod = periods.find(p => String(p.id) === String(periodId));
    if (!selectedPeriod) {
      return { success: false, cloudSynced: false, error: 'Selected period was not found.' };
    }

    isSettingCurrentRef.current = true;
    const optimisticPeriods = normalizeCurrentFlags(periods, periodId);

    try {
      setCurrentPeriodId(periodId);
      setPeriods(optimisticPeriods);
      persistCurrentPeriodId(periodId, optimisticPeriods);

      let cloudSynced = false;

      if (navigator.onLine && !currentUser.isLocalOnly && !String(periodId).startsWith('period-')) {
        const updatedCurrent = await supabaseData.setCurrentPayPeriod(currentUser.id, periodId);
        cloudSynced = !!updatedCurrent;

        try {
          const periodsData = await supabaseData.getPayPeriods(currentUser.id);
          if (periodsData && periodsData.length > 0) {
            const normalizedPeriodsData = normalizeCurrentFlags(periodsData, periodId);
            setPeriods(normalizedPeriodsData);
            persistCurrentPeriodId(periodId, normalizedPeriodsData);
          }
        } catch (refreshError) {
          console.warn('Current period changed locally, but cloud refresh failed:', refreshError);
        }
      }

      refreshKeyRef.current += 1;
      return { success: true, cloudSynced, error: null };

    } catch (error) {
      console.error('Failed to set current period:', error);
      refreshKeyRef.current += 1;
      return {
        success: true,
        cloudSynced: false,
        error: error?.message || 'Current period changed locally, but cloud sync failed.'
      };
    } finally {
      isSettingCurrentRef.current = false;
    }
  };

  // Load periods when user changes
  useEffect(() => {
    if (currentUser && isAuthenticated) {
      loadPayPeriodsData();
    } else {
      setPeriods([]);
      setCurrentPeriodId(null);
    }
  }, [currentUser, isAuthenticated, loadPayPeriodsData]);

  // Trigger refresh when device comes online
  useEffect(() => {
    const handleOnline = () => {
      if (currentUser && isAuthenticated) {
        // Small delay to let connection stabilize
        setTimeout(() => {
          syncPeriodsToCloud();
          loadPayPeriodsData();
        }, 2000);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [currentUser, isAuthenticated, loadPayPeriodsData, syncPeriodsToCloud]);

  const contextValue = {
    // State
    periods,
    setPeriods,
    currentPeriodId,
    setCurrentPeriodId,
    
    // Helper functions
    getCurrentPeriod,
    setCurrentPeriod,
    markPeriodDirty,
    deletePeriod,
    syncPeriodsToCloud,

    // Refresh key for component updates
    refreshKey: refreshKeyRef.current
  };

  return (
    <PayPeriodContext.Provider value={contextValue}>
      {children}
    </PayPeriodContext.Provider>
  );
};
