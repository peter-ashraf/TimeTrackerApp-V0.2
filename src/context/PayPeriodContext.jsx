import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseAuth } from './SupabaseAuthContext';
import { supabaseData } from '../utils/supabaseData';
import { setSimpleEncryptedItem, getSimpleEncryptedItem } from '../utils/simple-encryption';
import { multiTabSync } from '../utils/multiTabSync';

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
      // Load from local storage immediately
      const periodsKey = `payPeriods_${currentUser.id}`;
      const currentPeriodIdKey = `currentPeriodId_${currentUser.id}`;
      
      const localPeriods = getSimpleEncryptedItem(periodsKey, currentUser.username) || [];
      const localCurrentPeriodId = localStorage.getItem(currentPeriodIdKey);
      
      setPeriods(localPeriods);
      if (localCurrentPeriodId) setCurrentPeriodId(localCurrentPeriodId);
      
      // Defer Supabase sync
      setTimeout(async () => {
        if (navigator.onLine && currentUser && !currentUser.isLocalOnly) {
          try {
            const [periodsData, currentPeriodData] = await Promise.all([
              supabaseData.getPayPeriods(currentUser.id),
              supabaseData.getCurrentPayPeriod(currentUser.id)
            ]);
            
            if (periodsData && periodsData.length > 0) {
              setPeriods(periodsData);
              if (currentPeriodData) {
                setCurrentPeriodId(currentPeriodData.id);
                localStorage.setItem(currentPeriodIdKey, currentPeriodData.id);
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
        const updatedPeriods = [];
        for (const period of periods) {
          const saved = await supabaseData.savePayPeriod(currentUser.id, period);
          updatedPeriods.push({ ...period, id: saved.id });
        }

        // Only update state if ids actually changed
        const idsChanged = updatedPeriods.some(
          (p, i) => p.id !== periods[i]?.id
        );
        if (idsChanged) {
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
    const found = periods.find(p => p.id === currentPeriodId);
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
