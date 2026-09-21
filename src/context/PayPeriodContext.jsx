import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseAuth } from './SupabaseAuthContext';
import { supabaseData } from '../utils/supabaseData';
import { setSimpleEncryptedItem, getSimpleEncryptedItem } from '../utils/simple-encryption';
import { multiTabSync } from '../utils/multiTabSync';
import { cacheManager } from '../utils/cacheManager';

const PayPeriodContext = createContext();

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
            const [periodsData, currentPeriodData] = await Promise.all([
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

  // Mark a real-ID period as dirty (modified) so the save effect will sync it
  const markPeriodDirty = useCallback((periodId) => {
    if (periodId && !String(periodId).startsWith('period-')) {
      dirtyPeriodIdsRef.current.add(String(periodId));
    }
  }, []);

  // Save pay periods data.
  // Syncs: (1) new periods with temp 'period-' IDs, (2) existing periods explicitly marked dirty.
  // Previously re-saved ALL periods on every state change — caused slow sequential awaits
  // and a stuck "Saving..." state if any call hung or errored.
  useEffect(() => {
    if (!currentUser || !periods) return;
    if (isSavingPeriodsRef.current) return;
    if (isSettingCurrentRef.current) return;

    const periodsKey = `payPeriods_${currentUser.id}`;

    // Always persist locally immediately
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

    // Sync new (temp-ID) periods + explicitly dirty (modified) real-ID periods
    const periodsNeedingSync = periods.filter(p =>
      !p.id ||
      String(p.id).startsWith('period-') ||
      dirtyPeriodIdsRef.current.has(String(p.id))
    );
    if (!navigator.onLine || currentUser.isLocalOnly || periodsNeedingSync.length === 0) return;

    const savePeriods = async () => {
      isSavingPeriodsRef.current = true;
      // Snapshot dirty IDs to clear after save (new mutations during save stay dirty)
      const savedDirtyIds = new Set(dirtyPeriodIdsRef.current);
      try {
        let changed = false;
        const updatedPeriods = [...periods];

        for (const period of periodsNeedingSync) {
          try {
            const saved = await supabaseData.savePayPeriod(currentUser.id, period);
            if (saved?.id) {
              const idx = updatedPeriods.findIndex(p => String(p.id) === String(period.id));
              if (idx >= 0) {
                updatedPeriods[idx] = { ...updatedPeriods[idx], ...saved };
                changed = true;
              }
              // Clear dirty flag only for successfully saved real-ID periods
              savedDirtyIds.delete(String(saved.id));
            }
          } catch (periodError) {
            console.error(`Failed to save period ${period.id}:`, periodError);
          }
        }

        // Remove successfully saved IDs from the dirty set
        savedDirtyIds.forEach(id => dirtyPeriodIdsRef.current.delete(id));

        if (changed) {
          setPeriods(updatedPeriods);
          setSimpleEncryptedItem(periodsKey, updatedPeriods, currentUser.username);
          try { cacheManager.setCachedData('payPeriods', updatedPeriods); } catch (_) {}
        }
      } finally {
        isSavingPeriodsRef.current = false;
      }
    };

    savePeriods();
  }, [periods, currentUser, currentPeriodId]);

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
          loadPayPeriodsData();
        }, 2000);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [currentUser, isAuthenticated, loadPayPeriodsData]);

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
    
    // Refresh key for component updates
    refreshKey: refreshKeyRef.current
  };

  return (
    <PayPeriodContext.Provider value={contextValue}>
      {children}
    </PayPeriodContext.Provider>
  );
};
