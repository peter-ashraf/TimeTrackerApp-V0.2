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

      // If online, refresh data in background immediately
      if (navigator.onLine) {
        refreshDataInBackground();
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
      // Remove timeout to prevent hanging - let the calls complete naturally
      // Parallel fetch of all data
      const [timeEntries, userProfile, payPeriods, leaveSettings] = await Promise.all([
        supabaseData.getTimeEntries(currentUser.id).catch(err => {
          if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
            console.warn('Session expired during time entries fetch');
            return []; // Return empty array to not break the app
          }
          throw err;
        }),
        supabaseData.getUserProfile(currentUser.id).catch(err => {
          if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
            console.warn('Session expired during profile fetch');
            return null;
          }
          throw err;
        }),
        supabaseData.getPayPeriods(currentUser.id).catch(err => {
          if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
            console.warn('Session expired during pay periods fetch');
            return [];
          }
          throw err;
        }),
        supabaseData.getLeaveSettings(currentUser.id).catch(err => {
          if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
            console.warn('Session expired during leave settings fetch');
            return null;
          }
          throw err;
        })
      ]);

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
      
      // If successful and we have a profile with full_name, save it to localStorage for cross-device sync
      if (userProfile && userProfile.full_name) {
        localStorage.setItem('userDisplayName', userProfile.full_name);
      }
      
      // Process any queued database saves now that connectivity is restored
      const queue = JSON.parse(localStorage.getItem('dbSaveQueue') || '[]');
      if (queue.length > 0) {
        console.log('Processing queued database saves:', queue.length, 'items');
        
        for (const queuedSave of queue) {
          try {
            if (queuedSave.type === 'userProfile' && currentUser) {
              await supabaseData.saveUserProfile(currentUser.id, queuedSave.data);
              console.log('Queued save processed successfully:', queuedSave);
            }
          } catch (error) {
            console.error('Failed to process queued save:', queuedSave, error);
          }
        }
        
        // Clear the queue after processing
        localStorage.removeItem('dbSaveQueue');
      }
      
    } catch (error) {
      console.error('Background refresh failed:', error);
      setData(prev => ({ ...prev, refreshing: false }));
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
