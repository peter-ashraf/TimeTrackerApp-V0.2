/**
 * Hook for instant data loading with cache-first strategy
 * Provides immediate UI with cached data while refreshing in background
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cacheManager } from '../utils/cacheManager';
import { supabaseData } from '../utils/supabaseData';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';

export const useInstantData = () => {
  const { currentUser, isAuthenticated } = useSupabaseAuth();
  const [data, setData] = useState({
    timeEntries: [],
    userProfile: null,
    payPeriods: [],
    leaveSettings: null,
    loading: true,
    refreshing: false,
    lastRefresh: null
  });
  
  const [cacheStatus, setCacheStatus] = useState({});
  const refreshTimeoutRef = useRef(null);

  /**
   * Load data instantly from cache, then refresh in background
   */
  const loadInstantData = useCallback(async () => {
    if (!currentUser) return;

    try {
      // Clear any corrupted cache first
      cacheManager.clearOldVersionCache();
      
      // Load from cache instantly
      const cachedData = await cacheManager.preloadEssentialData(currentUser.id);
      
      setData(prev => ({
        ...prev,
        ...cachedData,
        loading: false
      }));

      // Update cache status
      setCacheStatus(cacheManager.getCacheStatus());

      // If online, refresh data in background with delay to avoid conflicts
      if (navigator.onLine) {
        setTimeout(() => {
          refreshDataInBackground();
        }, 500);
      }
    } catch (error) {
      console.error('Failed to load instant data:', error);
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [currentUser]);

  /**
   * Refresh data in background without blocking UI
   */
  const refreshDataInBackground = useCallback(async () => {
    if (!currentUser || !navigator.onLine) return;

    setData(prev => ({ ...prev, refreshing: true }));

    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network timeout')), 15000)
      );

      // Parallel fetch of all data with timeout
      const dataPromise = Promise.all([
        supabaseData.getTimeEntries(currentUser.id),
        supabaseData.getUserProfile(currentUser.id),
        supabaseData.getPayPeriods(currentUser.id),
        supabaseData.getLeaveSettings(currentUser.id)
      ]);

      const [timeEntries, userProfile, payPeriods, leaveSettings] = await Promise.race([dataPromise, timeoutPromise]);

      // Update cache with fresh data
      cacheManager.setCachedData('timeEntries', timeEntries);
      cacheManager.setCachedData('userProfile', userProfile);
      cacheManager.setCachedData('payPeriods', payPeriods);
      cacheManager.setCachedData('leaveSettings', leaveSettings);

      // Update state with fresh data
      setData(prev => ({
        ...prev,
        timeEntries,
        userProfile,
        payPeriods,
        leaveSettings,
        refreshing: false,
        lastRefresh: new Date().toISOString()
      }));

      setCacheStatus(cacheManager.getCacheStatus());
    } catch (error) {
      console.error('Background refresh failed:', error);
      setData(prev => ({ ...prev, refreshing: false }));
      
      // If network fails, try to use cached data
      if (error.message === 'Network timeout') {
        console.log('Network timeout, using cached data');
      }
    }
  }, [currentUser]);

  /**
   * Manual refresh with loading state
   */
  const forceRefresh = useCallback(async () => {
    if (!currentUser) return;

    setData(prev => ({ ...prev, refreshing: true }));
    
    try {
      await refreshDataInBackground();
    } catch (error) {
      console.error('Force refresh failed:', error);
      setData(prev => ({ ...prev, refreshing: false }));
    }
  }, [currentUser, refreshDataInBackground]);

  /**
   * Handle network changes
   */
  useEffect(() => {
    const handleOnline = () => {
      // Debounced refresh when coming online
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      refreshTimeoutRef.current = setTimeout(() => {
        refreshDataInBackground();
      }, 1000); // Wait 1 second after coming online
    };

    const handleOffline = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [refreshDataInBackground]);

  /**
   * Initialize data when user changes
   */
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      loadInstantData();
    } else {
      // Clear data when logged out
      setData({
        timeEntries: [],
        userProfile: null,
        payPeriods: [],
        leaveSettings: null,
        loading: false,
        refreshing: false,
        lastRefresh: null
      });
    }
  }, [isAuthenticated, currentUser, loadInstantData]);

  /**
   * Periodic refresh when online
   */
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    const interval = setInterval(() => {
      if (navigator.onLine) {
        refreshDataInBackground();
      }
    }, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => clearInterval(interval);
  }, [isAuthenticated, currentUser, refreshDataInBackground]);

  return {
    data,
    cacheStatus,
    forceRefresh,
    isOnline: navigator.onLine
  };
};
