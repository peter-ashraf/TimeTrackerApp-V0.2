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

      setPeriods(localPeriods);
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
              setPeriods(periodsData);
              if (currentPeriodData) {
                const pId = currentPeriodData.id || currentPeriodData;
                if (pId && pId !== 'undefined' && pId !== 'null') {
                  setCurrentPeriodId(pId);
                  localStorage.setItem(currentPeriodIdKey, pId);
                }
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
  }, [currentUser, isAuthenticated]);

  // Save pay periods data
  useEffect(() => {
    if (!currentUser || !periods) return;
    if (isSavingPeriodsRef.current) return;

    const savePayPeriodsData = async () => {
      isSavingPeriodsRef.current = true;
      try {
        // Always save to localStorage first for offline access
        const periodsKey = `payPeriods_${currentUser.id}`;
        setSimpleEncryptedItem(periodsKey, periods, currentUser.username);

        // Also save to cacheManager for offline access
        try {
          cacheManager.setCachedData('payPeriods', periods);
          if (currentPeriodId) {
            cacheManager.setCachedData('currentPeriod', currentPeriodId);
          }
        } catch (cacheError) {
          console.warn('Failed to save to cacheManager:', cacheError);
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
    
    // First try to find the period marked as current in the database
    const currentFromDb = periods.find(p => p.is_current === true);
    if (currentFromDb) {
      return currentFromDb;
    }
    
    // Fallback to currentPeriodId state
    const found = periods.find(p => String(p.id) === String(currentPeriodId));
    if (found) {
      return found;
    }
    
    // Final fallback to first period
    return periods[0];
  }, [periods, currentPeriodId]);

  // Set current period
  const setCurrentPeriod = async (periodId) => {
    if (!currentUser || !periodId || isSettingCurrentRef.current) return;

    isSettingCurrentRef.current = true;

    try {
      await supabaseData.setCurrentPayPeriod(currentUser.id, periodId);

      // Add delay to ensure database trigger completes
      await new Promise(resolve => setTimeout(resolve, 500));

      // Force refresh of pay periods data
      const periodsData = await supabaseData.getPayPeriods(currentUser.id);
      if (periodsData && periodsData.length > 0) {
        setPeriods(periodsData);
        setCurrentPeriodId(periodId);

        const currentPeriodIdKey = `currentPeriodId_${currentUser.id}`;
        localStorage.setItem(currentPeriodIdKey, periodId);

        // Also save to cacheManager
        try {
          cacheManager.setCachedData('currentPeriod', periodId);
          cacheManager.setCachedData('payPeriods', periodsData);
        } catch (cacheError) {
          console.warn('Failed to save to cacheManager in setCurrentPeriod:', cacheError);
        }
      }

      // Increment refresh key to trigger component re-renders
      refreshKeyRef.current += 1;

    } catch (error) {
      console.error('Failed to set current period:', error);
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
