import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseAuth } from './SupabaseAuthContext';
import { supabaseData } from '../utils/supabaseData';
import { setSimpleEncryptedItem, getSimpleEncryptedItem } from '../utils/simple-encryption';
import { multiTabSync } from '../utils/multiTabSync';
import cacheManager from '../utils/cacheManager';

const UserPreferencesContext = createContext();

export const useUserPreferences = () => {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error('useUserPreferences must be used within UserPreferencesProvider');
  }
  return context;
};

export const UserPreferencesProvider = ({ children }) => {
  const { currentUser, isAuthenticated, getUserData, saveUserData } = useSupabaseAuth();

  // Theme State (app-wide)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'system';
  });

  // Helper to get active theme (light or dark)
  const getActiveTheme = useCallback((baseTheme) => {
    if (baseTheme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return baseTheme;
  }, []);

  const [activeTheme, setActiveTheme] = useState(() => getActiveTheme(theme));

  // UI Preferences
  const [hideSalary, setHideSalary] = useState(() => {
    const saved = localStorage.getItem('hideSalary');
    return saved === 'true';
  });

  const [use12Hour, setUse12Hour] = useState(() => {
    const saved = localStorage.getItem('use12HourFormat');
    return saved !== 'false';
  });

  const [detailedView, setDetailedView] = useState(() => {
    const saved = localStorage.getItem('detailedView');
    return saved === 'true';
  });

  // Employee Data
  const [employee, setEmployee] = useState({
    name: '',
    salary: 0,
    employeeType: 'full-time',
    dailyHours: 9,
    monthlyHours: 187,
    workDaysPerWeek: 5
  });

  // Leave Settings
  const [leaveSettings, setLeaveSettings] = useState({
    annualVacation: 10,
    sickDays: 7,
    personalDays: 2,
    usedVacationDays: 0,
    usedSickDays: 0,
    usedPersonalDays: 0
  });

  const isInitialSyncCompleted = useRef(false);

  // Load user preferences
  const loadUserPreferences = useCallback(async () => {
    if (!currentUser || !isAuthenticated) return;

    try {
      // Load from local storage immediately
      const salaryKey = `salary_${currentUser.id}`;
      const leaveSettingsKey = `leaveSettings_${currentUser.id}`;

      let localSalary = getSimpleEncryptedItem(salaryKey, currentUser.username) ?? 0;

      // Try cacheManager first for instant loading
      let localLeaveSettings = null;
      try {
        const cachedLeaveSettings = await cacheManager.getCachedData('leaveSettings', null);
        if (cachedLeaveSettings) {
          localLeaveSettings = cachedLeaveSettings;
        }
      } catch (cacheError) {
        console.warn('CacheManager failed for leaveSettings, falling back to localStorage:', cacheError);
      }

      // Fallback to encrypted localStorage if cacheManager fails or returns empty
      if (!localLeaveSettings) {
        localLeaveSettings = getSimpleEncryptedItem(leaveSettingsKey, currentUser.username) ?? {
          annualVacation: 10,
          sickDays: 7,
          personalDays: 2,
          usedVacationDays: 0,
          usedSickDays: 0,
          usedPersonalDays: 0
        };
      }

      setEmployee(prev => ({
        ...prev,
        name: localStorage.getItem('userDisplayName') ?? currentUser.fullName ?? currentUser.username ?? 'User',
        salary: localSalary ?? 0
      }));
      setLeaveSettings(localLeaveSettings);

      // Defer Supabase sync
      setTimeout(async () => {
        if (navigator.onLine && currentUser && !currentUser.isLocalOnly) {
          try {
            const [profileData, leaveSettingsData] = await Promise.all([
              supabaseData.getUserProfile(currentUser.id).catch(err => {
                if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
                  console.warn('Session expired during profile fetch in UserPreferencesContext');
                  return null;
                }
                throw err;
              }),
              supabaseData.getLeaveSettings(currentUser.id).catch(err => {
                if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
                  console.warn('Session expired during leave settings fetch in UserPreferencesContext');
                  return null;
                }
                throw err;
              })
            ]);

            if (profileData) {
              // Check if user recently changed name locally (within last 5 seconds)
              const lastNameChange = localStorage.getItem('userDisplayNameTimestamp');
              const recentlyChanged = lastNameChange && (Date.now() - parseInt(lastNameChange)) < 5000;

              setEmployee(prev => ({
                ...prev,
                // Don't overwrite local name if user just changed it
                name: recentlyChanged ? prev.name : (profileData.full_name ?? prev.name),
                employeeType: profileData.employee_type ?? 'full-time',
                dailyHours: profileData.daily_hours ?? 9,
                monthlyHours: profileData.monthly_hours ?? 187,
                workDaysPerWeek: profileData.work_days_per_week ?? 5
              }));
            }

            if (leaveSettingsData) {
              setLeaveSettings({
                annualVacation: leaveSettingsData.annual_vacation ?? leaveSettingsData.annualVacation ?? 10,
                sickDays: leaveSettingsData.sick_days ?? leaveSettingsData.sickDays ?? 7,
                personalDays: leaveSettingsData.personal_days ?? leaveSettingsData.personalDays ?? 2,
                usedVacationDays: leaveSettingsData.used_vacation_days ?? leaveSettingsData.usedVacationDays ?? 0,
                usedSickDays: leaveSettingsData.used_sick_days ?? leaveSettingsData.usedSickDays ?? 0,
                usedPersonalDays: leaveSettingsData.used_personal_days ?? leaveSettingsData.usedPersonalDays ?? 0
              });
            } else {
              // If no settings exist on Supabase, initialize the DB record with local/default data
              const leaveSettingsKey = `leaveSettings_${currentUser.id}`;
              const currentLocal = getSimpleEncryptedItem(leaveSettingsKey, currentUser.username) ?? {
                annualVacation: 10,
                sickDays: 7,
                personalDays: 2,
                usedVacationDays: 0,
                usedSickDays: 0,
                usedPersonalDays: 0
              };
              
              try {
                await supabaseData.saveLeaveSettings(currentUser.id, {
                  annual_vacation: currentLocal.annualVacation ?? 10,
                  sick_days: currentLocal.sickDays ?? 7,
                  personal_days: currentLocal.personalDays ?? 2,
                  used_vacation_days: currentLocal.usedVacationDays ?? 0,
                  used_sick_days: currentLocal.usedSickDays ?? 0,
                  used_personal_days: currentLocal.usedPersonalDays ?? 0
                });
              } catch (saveError) {
                console.error('Failed to initialize leave settings on Supabase:', saveError);
              }
            }
          } catch (onlineError) {
            console.error('Failed to fetch user preferences from Supabase, staying with local data', onlineError);
          } finally {
            isInitialSyncCompleted.current = true;
          }
        } else {
          isInitialSyncCompleted.current = true;
        }
      }, 300);

    } catch (error) {
      console.error('loadUserPreferences critical error:', error);
      isInitialSyncCompleted.current = true;
    }
  }, [currentUser, isAuthenticated]);

  // Save employee data
  useEffect(() => {
    if (!currentUser || !isInitialSyncCompleted.current) return;

    const saveEmployeeData = async () => {
      // Save salary to encrypted localStorage immediately
      const salaryKey = `salary_${currentUser.id}`;
      setSimpleEncryptedItem(salaryKey, employee.salary, currentUser.username);

      try {
        // Only save employee type fields to Supabase - NEVER save full_name automatically!
        // full_name should only be updated when user explicitly changes it in Settings
        await supabaseData.saveUserProfile(currentUser.id, {
          // ❌ CRITICAL: Never save full_name automatically - it overwrites database!
          // full_name: employee.name, // REMOVED - this was overwriting the database!
          employee_type: employee.employeeType,
          daily_hours: employee.dailyHours,
          monthly_hours: employee.monthlyHours,
          work_days_per_week: employee.workDaysPerWeek
        });
      } catch (error) {
        console.error('Failed to save employee data:', error);
      }
    };

    saveEmployeeData();
    multiTabSync.notifyDataChange('employee', employee, currentUser.username);
  }, [employee, currentUser]);

  // Save leave settings
  useEffect(() => {
    if (!currentUser || !isInitialSyncCompleted.current) return;

    const saveLeaveSettingsData = async () => {
      // Always save to localStorage immediately to keep local cache sync'd
      const leaveSettingsKey = `leaveSettings_${currentUser.id}`;
      setSimpleEncryptedItem(leaveSettingsKey, leaveSettings, currentUser.username);

      // Also save to cacheManager for offline access
      try {
        cacheManager.setCachedData('leaveSettings', leaveSettings);
      } catch (cacheError) {
        console.warn('Failed to save leaveSettings to cacheManager:', cacheError);
      }

      try {
        await supabaseData.saveLeaveSettings(currentUser.id, {
          annual_vacation: leaveSettings.annualVacation,
          sick_days: leaveSettings.sickDays,
          personal_days: leaveSettings.personalDays,
          used_vacation_days: leaveSettings.usedVacationDays,
          used_sick_days: leaveSettings.usedSickDays,
          used_personal_days: leaveSettings.usedPersonalDays
        });
      } catch (error) {
        console.error('Failed to save leave settings:', error);
      }
    };

    saveLeaveSettingsData();
    multiTabSync.notifyDataChange('leaveSettings', leaveSettings, currentUser.username);
  }, [leaveSettings, currentUser]);

  // Update theme-color meta tag for PWA and iOS status bar
  const updateThemeColorMeta = useCallback((currentActiveTheme) => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.getElementsByTagName('head')[0].appendChild(meta);
    }

    // Exact colors from public/css/styles.css
    // Light: var(--color-background) -> #fcfcf9 (Cream 50)
    // Dark: var(--color-background) -> #1f2121 (Charcoal 700)
    const color = currentActiveTheme === 'dark' ? '#1f2121' : '#fcfcf9';
    meta.setAttribute('content', color);
  }, []);

  // Persist UI preferences and handle theme changes
  useEffect(() => {
    localStorage.setItem('theme', theme);

    const handleThemeChange = () => {
      const newActiveTheme = getActiveTheme(theme);
      setActiveTheme(newActiveTheme);
      document.documentElement.setAttribute('data-theme', newActiveTheme);
      updateThemeColorMeta(newActiveTheme);
    };

    handleThemeChange();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', handleThemeChange);
      return () => mediaQuery.removeEventListener('change', handleThemeChange);
    }
  }, [theme, getActiveTheme, updateThemeColorMeta]);

  useEffect(() => {
    localStorage.setItem('hideSalary', hideSalary);
  }, [hideSalary]);

  useEffect(() => {
    localStorage.setItem('use12HourFormat', use12Hour);
  }, [use12Hour]);

  useEffect(() => {
    localStorage.setItem('detailedView', detailedView);
  }, [detailedView]);

  // Load preferences when user changes
  useEffect(() => {
    if (currentUser && isAuthenticated) {
      loadUserPreferences();
    } else {
      // Reset to defaults
      setEmployee({
        name: '',
        salary: 0,
        employeeType: 'full-time',
        dailyHours: 9,
        monthlyHours: 187,
        workDaysPerWeek: 5
      });
      setLeaveSettings({
        annualVacation: 10,
        sickDays: 7,
        personalDays: 2,
        usedVacationDays: 0,
        usedSickDays: 0,
        usedPersonalDays: 0
      });
      isInitialSyncCompleted.current = false;
    }
  }, [currentUser, isAuthenticated, loadUserPreferences]);

  const contextValue = {
    // Employee data
    employee,
    setEmployee,

    // Leave settings
    leaveSettings,
    setLeaveSettings,

    // UI preferences
    theme,
    setTheme,
    activeTheme,
    hideSalary,
    setHideSalary,
    use12Hour,
    setUse12Hour,
    detailedView,
    setDetailedView,

    // Data operations
    loadUserPreferences
  };

  return (
    <UserPreferencesContext.Provider value={contextValue}>
      {children}
    </UserPreferencesContext.Provider>
  );
};
