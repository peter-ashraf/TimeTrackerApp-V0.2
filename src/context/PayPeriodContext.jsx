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

  // Save pay periods data
  useEffect(() => {
    if (!currentUser || !periods) return;
    if (isSavingPeriodsRef.current) return;
    if (isSettingCurrentRef.current) return;

    const savePayPeriodsData = async () => {
      isSavingPeriodsRef.current = true;
      try {
        // Always save to localStorage first for offline access
        const periodsKey = `payPeriods_${currentUser.id}`;
        setSimpleEncryptedItem(periodsKey, periods, currentUser.username);

        // Also save to cacheManager for offline access, but only if data is not empty
        if (periods.length > 0) {
          try {
            cacheManager.setCachedData('payPeriods', periods);
            if (currentPeriodId) {
              cacheManager.setCachedData('currentPeriod', currentPeriodId);
            }
          } catch (cacheError) {
            console.warn('Failed to save to cacheManager:', cacheError);
          }
        }

        // Deduplicate periods by normalizing dates to avoid conflicts
        const uniquePeriods = [];
        const seenPeriods = new Map();
        
        for (const period of periods) {
          // Normalize dates to ISO format for consistent comparison
          const startDate = new Date(period.startDate || period.start_date).toISOString().split('T')[0];
          const endDate = new Date(period.endDate || period.end_date).toISOString().split('T')[0];
          const key = `${startDate}_${endDate}`;
          
          if (!seenPeriods.has(key)) {
            seenPeriods.set(key, period);
            uniquePeriods.push(period);
          } else {
            // If we find a duplicate, keep the one with an ID (database version) over client-generated one
            const existing = seenPeriods.get(key);
            if (period.id && !existing.id?.startsWith('period-')) {
              // Replace client-generated with database version
              const index = uniquePeriods.indexOf(existing);
              uniquePeriods[index] = period;
              seenPeriods.set(key, period);
            }
          }
        }

        const updatedPeriods = [];
        for (const period of uniquePeriods) {
          
          const saved = await supabaseData.savePayPeriod(currentUser.id, period);
          if (saved) {
            updatedPeriods.push({ ...period, id: saved.id });
          } else {
            // If save failed, keep original period with existing id
            updatedPeriods.push(period);
          }
        }

        // Only update state if periods actually changed
        if (updatedPeriods.length !== periods.length || 
            updatedPeriods.some((p, i) => p.id !== periods[i]?.id)) {
          setPeriods(updatedPeriods);
        }
        
      } catch (error) {
        console.error('Failed to save pay periods:', error);
        const periodsKey = `payPeriods_${currentUser.id}`;
        setSimpleEncryptedItem(periodsKey, periods, currentUser.username);
      } finally {
        isSavingPeriodsRef.current = false;
      }
    };

    savePayPeriodsData();
    multiTabSync.notifyDataChange('payPeriods', periods, currentUser.username);
  }, [periods, currentUser]);

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
    
    // Refresh key for component updates
    refreshKey: refreshKeyRef.current
  };

  return (
    <PayPeriodContext.Provider value={contextValue}>
      {children}
    </PayPeriodContext.Provider>
  );
};
