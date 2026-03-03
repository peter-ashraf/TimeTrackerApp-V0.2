import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';
import BackupReminderModal from '../components/BackupReminderModal';
import { useSupabaseAuth } from './SupabaseAuthContext';
import { supabaseData } from '../utils/supabaseData';
import { dataMigration } from '../utils/dataMigration';
import { setSimpleEncryptedItem, getSimpleEncryptedItem } from '../utils/simple-encryption';
import { multiTabSync } from '../utils/multiTabSync';

const TimeTrackerContext = createContext();

export const useTimeTracker = () => {
  const context = useContext(TimeTrackerContext);
  if (!context) {
    throw new Error('useTimeTracker must be used within TimeTrackerProvider');
  }
  return context;
};

export const TimeTrackerProvider = ({ children }) => {
  const { currentUser, isAuthenticated, getUserData, saveUserData } = useSupabaseAuth();
  
  // ✅ CRITICAL: Don't load data until user is authenticated
  const [isContextReady, setIsContextReady] = useState(false);
  
  // Employee Data - using getUserData/saveUserData from SupabaseAuth
  const [employee, setEmployee] = useState({ 
    name: '', 
    salary: 0,
    employeeType: 'full-time',
    dailyHours: 9,
    monthlyHours: 187,
    workDaysPerWeek: 5
  });
  
  // Leave Settings
  const [leaveSettings, setLeaveSettings] = useState({ annualVacation: 10, sickDays: 7 });
  
  // Time Entries
  const [entries, setEntries] = useState([]);
  
  // Pay Periods
  const [periods, setPeriods] = useState([]);
  
  const [currentPeriodId, setCurrentPeriodId] = useState(null);
  
  // UI State (these are NOT user-specific, they're app-wide preferences)
  const [hideSalary, setHideSalary] = useState(() => {
    const saved = localStorage.getItem('hideSalary');
    return saved === 'true';
  });
  
  const [lastSaved, setLastSaved] = useState(null);
  
  const [lastRefreshed, setLastRefreshed] = useState(null);
  
  const [use12Hour, setUse12Hour] = useState(() => {
    const saved = localStorage.getItem('use12HourFormat');
    return saved !== 'false';
  });
  
  const [detailedView, setDetailedView] = useState(() => {
    const saved = localStorage.getItem('detailedView');
    return saved === 'true';
  });
  
  // State Confirmation
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null
  });
  
  // Theme State (app-wide)
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });
  
  // Backup reminder state
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  
  // Alert modal state
  const [alertModal, setAlertModal] = useState({ isOpen: false, message: '', type: 'info' });
  
  // Ref to track migration state
  const migrationRef = useRef(false);
  
  // Ref to track when we're refreshing (to prevent save updates)
  const isRefreshingRef = useRef(false);

  const isLoadingRef = useRef(false);  // ← ADD near other refs

  const isSavingPeriodsRef = useRef(false);  // ← ADD near other refs
  
  // Load user-specific data from Supabase (now re-enabled after RLS fix)
  const loadData = useCallback(async () => {
    if (!currentUser || !isAuthenticated) {
      
      return;
    }

    if (isLoadingRef.current) return;  // ← ADD: prevent double load
    
    try {
      
      isLoadingRef.current = true;
      
      // Load data from Supabase in parallel
      const [profileData, entriesData, leaveSettingsData, periodsData, currentPeriodData] = await Promise.all([
        supabaseData.getUserProfile(currentUser.id),
        supabaseData.getTimeEntries(currentUser.id),
        supabaseData.getLeaveSettings(currentUser.id),
        supabaseData.getPayPeriods(currentUser.id),
        supabaseData.getCurrentPayPeriod(currentUser.id)
      ]);
      
      // Set loaded data with null checks - salary from localStorage only
      const salaryKey = `salary_${currentUser.id}`;
      
      // Try both encrypted and plain localStorage for salary
      let localSalary = getSimpleEncryptedItem(salaryKey, currentUser.username) || 0;
      
      if (localSalary === 0) {
        // Fallback to plain localStorage
        const plainSalary = localStorage.getItem(salaryKey);
        if (plainSalary && !plainSalary.startsWith('encrypted:')) {
          localSalary = parseFloat(plainSalary) || 0;
        } else if (plainSalary && plainSalary.startsWith('encrypted:')) {
          // If it's encrypted data, try to decrypt it
          try {
            const encryptedData = plainSalary.replace('encrypted:', '');
            localSalary = getSimpleEncryptedItem(salaryKey, currentUser.username) || 0;
          } catch (error) {
            localSalary = 0;
          }
        }
      }
      
      // Migration logic: if new fields don't exist in profile, default to full-time
      const migratedEmployeeData = {
        name: localStorage.getItem('userDisplayName') || profileData?.full_name || profileData?.username || currentUser.username || 'User',
        salary: localSalary,
        employeeType: profileData?.employee_type || 'full-time',
        dailyHours: profileData?.daily_hours || 9,
        monthlyHours: profileData?.monthly_hours || 187,
        workDaysPerWeek: profileData?.work_days_per_week || 5
      };
      
      setEmployee(migratedEmployeeData);
      
      setEntries(entriesData || []);
      setLeaveSettings({
        annualVacation: leaveSettingsData?.annual_vacation || leaveSettingsData?.annualVacation || 10,
        sickDays: leaveSettingsData?.sick_days || leaveSettingsData?.sickDays || 7,
        personalDays: leaveSettingsData?.personal_days || leaveSettingsData?.personalDays || 2,
        usedVacationDays: leaveSettingsData?.used_vacation_days || leaveSettingsData?.usedVacationDays || 0,
        usedSickDays: leaveSettingsData?.used_sick_days || leaveSettingsData?.usedSickDays || 0,
        usedPersonalDays: leaveSettingsData?.used_personal_days || leaveSettingsData?.usedPersonalDays || 0
      });
      
      // Only set periods if we have data from Supabase
      if (periodsData && periodsData.length > 0) {
        setPeriods(periodsData);
        
        // Handle current period logic
        if (currentPeriodData) {
          // We have a current period set in database
          setCurrentPeriodId(currentPeriodData.id);
          
        } else {
          // No current period set, try to auto-set one
          
          try {
            await supabaseData.autoSetCurrentPayPeriod(currentUser.id);
            // Try to get the current period again
            const updatedCurrentPeriod = await supabaseData.getCurrentPayPeriod(currentUser.id);
            if (updatedCurrentPeriod) {
              setCurrentPeriodId(updatedCurrentPeriod.id);
              
            } else {
              
              // Set to first period as fallback
              setCurrentPeriodId(periodsData[0].id);
            }
          } catch (error) {
            
            // Set to first period as fallback
            setCurrentPeriodId(periodsData[0].id);
          }
        }
      } else {
        // Check if we have entries but no periods - prompt user to create periods
        if (entriesData && entriesData.length > 0) {
          
          // Don't auto-create periods, let user handle it manually
          setConfirmModal({
            isOpen: true,
            title: 'No Pay Periods Found',
            message: `You have ${entriesData.length} time entries but no pay periods. Please create pay periods in Settings to organize your timesheet data.`,
            type: 'warning',
            confirmText: 'Go to Settings',
            cancelText: 'Later',
            onConfirm: () => {
              setConfirmModal({ ...confirmModal, isOpen: false });
              // TODO: Navigate to Settings tab
              window.location.hash = '#settings';
            },
            onCancel: () => setConfirmModal({ ...confirmModal, isOpen: false })
          });
        } else {
          
        }
      }
      
      
      setIsContextReady(true);
      isLoadingRef.current = false;
      
    } catch (error) {
      
      // Fallback to encrypted localStorage if Supabase fails
      
      
      const salaryKey = `salary_${currentUser.id}`;
      const entriesKey = `timeEntries_${currentUser.id}`;
      const leaveSettingsKey = `leaveSettings_${currentUser.id}`;
      const periodsKey = `payPeriods_${currentUser.id}`;
      
      // Try both encrypted and plain localStorage for salary
      let savedSalary = getSimpleEncryptedItem(salaryKey, currentUser.username) || 0;
      if (savedSalary === 0) {
        // Fallback to plain localStorage
        const plainSalary = localStorage.getItem(salaryKey);
        if (plainSalary) {
          savedSalary = parseFloat(plainSalary) || 0;
        }
      }
      const savedEntries = getSimpleEncryptedItem(entriesKey, currentUser.username) || [];
      const savedLeaveSettings = getSimpleEncryptedItem(leaveSettingsKey, currentUser.username) || {
        annualVacation: 10,
        sickDays: 7
      };
      const savedPeriods = getSimpleEncryptedItem(periodsKey, currentUser.username);
      
      // Only use saved periods, never create defaults
      const periodsToSet = savedPeriods || [];
      
      setEmployee({
        name: localStorage.getItem('userDisplayName') || currentUser.username || currentUser.email?.split('@')[0] || 'User',
        salary: savedSalary,
        employeeType: 'full-time',
        dailyHours: 9,
        monthlyHours: 187,
        workDaysPerWeek: 5
      });
      
      setEntries(savedEntries);
      setLeaveSettings({
        annualVacation: savedLeaveSettings.annualVacation || 10,
        sickDays: savedLeaveSettings.sickDays || 7
      });
      
      setPeriods(periodsToSet);
      
      
      setIsContextReady(true);
    }
  }, [currentUser, isAuthenticated]);
  
  // ✅ LOAD USER DATA WHEN USER CHANGES
  useEffect(() => {
    if (!currentUser) {
      // Reset to defaults if no user
      setEmployee({ 
        name: '', 
        salary: 0,
        employeeType: 'full-time',
        dailyHours: 9,
        monthlyHours: 187,
        workDaysPerWeek: 5
      });
      setLeaveSettings({ annualVacation: 10, sickDays: 7 });
      setEntries([]);
      setPeriods([]);
      setCurrentPeriodId(null);
      setIsContextReady(false);
      return;
    }
    
    // Async function to handle migrations and data loading
    const initializeUserData = async () => {
      try {
        // Check if data migration is needed
        const dataMigrationNeeded = dataMigration.isMigrationNeeded(currentUser.id, currentUser.username);
        
        if (dataMigrationNeeded) {
          // Migration needed for user
          
          // Perform migrations in parallel
          const migrationPromises = [];
          
          if (dataMigrationNeeded) {
            migrationPromises.push(
              dataMigration.migrateUserData(currentUser.id, currentUser.username)
                .then(result => ({ type: 'data', result }))
                .catch(error => ({ type: 'data', error }))
            );
          }
          
          // Wait for all migrations to complete
          Promise.allSettled(migrationPromises)
            .then((results) => {
              results.forEach((result) => {
                if (result.status === 'fulfilled') {
                  
                } else {
                  
                }
              });
              
              // Load data after migrations
              loadData();
            })
            .catch((error) => {
              
              // Still load data even if migration fails
              loadData();
            });
        } else {
          // Load data normally
          loadData();
        }
      } catch (error) {
        
        // Still load data even if initialization fails
        loadData();
      }
    };
    
    initializeUserData();
  }, [currentUser, loadData]);
  
  // ✅ SAVE USER DATA WHEN IT CHANGES (using Supabase with localStorage fallback)
  useEffect(() => {
    if (!currentUser || !isContextReady) return;
    
    const saveEmployeeData = async () => {
      try {
        // Save employee type fields to Supabase (exclude username - it should never change!)
        await supabaseData.saveUserProfile(currentUser.id, {
          // ❌ REMOVED: username: employee.name - Display name should NOT update username
          full_name: employee.name,
          employee_type: employee.employeeType,
          daily_hours: employee.dailyHours,
          monthly_hours: employee.monthlyHours,
          work_days_per_week: employee.workDaysPerWeek
        });
        
        // Save salary to encrypted localStorage only
        const salaryKey = `salary_${currentUser.id}`;
        setSimpleEncryptedItem(salaryKey, employee.salary, currentUser.username);
        
        
      } catch (error) {
        
        
        // Fallback - save salary to localStorage only (name already handled by Supabase sync)
        const salaryKey = `salary_${currentUser.id}`;
        setSimpleEncryptedItem(salaryKey, employee.salary, currentUser.username);
        
      }
    };
    
    saveEmployeeData();
    
    // Notify other tabs of data change
    multiTabSync.notifyDataChange('employee', employee, currentUser.username);
  }, [employee, currentUser, isContextReady]);
  
  useEffect(() => {
    if (!currentUser || !isContextReady) return;
    
    const saveLeaveSettingsData = async () => {
      try {
        // Save to Supabase
        await supabaseData.saveLeaveSettings(currentUser.id, {
          annual_vacation: leaveSettings.annualVacation,
          sick_days: leaveSettings.sickDays,
          personal_days: leaveSettings.personalDays,
          used_vacation_days: leaveSettings.usedVacationDays,
          used_sick_days: leaveSettings.usedSickDays,
          used_personal_days: leaveSettings.usedPersonalDays
        });
        
        
      } catch (error) {
        
        
        // Fallback to localStorage
        const leaveSettingsKey = `leaveSettings_${currentUser.id}`;
        setSimpleEncryptedItem(leaveSettingsKey, leaveSettings, currentUser.username);
        
      }
    };
    
    saveLeaveSettingsData();
    
    // Notify other tabs of data change
    multiTabSync.notifyDataChange('leaveSettings', leaveSettings, currentUser.username);
  }, [leaveSettings, currentUser, isContextReady]);
  
  useEffect(() => {
    if (!currentUser || !isContextReady) return;
    if (isRefreshingRef.current) return;
    
    const saveTimeEntriesData = async () => {
      try {
        // Save each entry to Supabase
        for (const entry of entries) {
          await supabaseData.saveTimeEntry(currentUser.id, entry);
        }
        
      } catch (error) {
        console.error('Failed to save entries to Supabase:', error);
        
        // Fallback to localStorage
        const entriesKey = `timeEntries_${currentUser.id}`;
        setSimpleEncryptedItem(entriesKey, entries, currentUser.username);
      }
    };
    
    saveTimeEntriesData();
    
    // Notify other tabs of data change
    multiTabSync.notifyDataChange('timeEntries', entries, currentUser.username);
  }, [entries, currentUser, isContextReady, isRefreshingRef]);

  // Pay periods are now user-specific
  useEffect(() => {
  if (!currentUser || !isContextReady || isRefreshingRef.current) return;
  if (isSavingPeriodsRef.current) return;  // ← blocks re-entry

  const savePayPeriodsData = async () => {
    isSavingPeriodsRef.current = true;  // ← lock
    try {
      const updatedPeriods = [];
      for (const period of periods) {
        const saved = await supabaseData.savePayPeriod(currentUser.id, period);
        // Merge: keep local fields, update with Supabase-returned id
        updatedPeriods.push({ ...period, id: saved.id });
      }

      // Only update state if ids actually changed (avoids re-trigger)
      const idsChanged = updatedPeriods.some(
        (p, i) => p.id !== periods[i]?.id
      );
      if (idsChanged) {
        setPeriods(updatedPeriods);  // ← only fires if UUIDs changed
      }

      
    } catch (error) {
      
      const periodsKey = `payPeriods_${currentUser.id}`;
      setSimpleEncryptedItem(periodsKey, periods, currentUser.username);
      
    } finally {
      isSavingPeriodsRef.current = false;  // ← always unlock
    }
  };

  savePayPeriodsData();
  multiTabSync.notifyDataChange('payPeriods', periods, currentUser.username);
}, [periods, currentUser, isContextReady]);


  
  // Persist UI preferences (app-wide, not user-specific)
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  
  useEffect(() => {
    localStorage.setItem('hideSalary', hideSalary);
  }, [hideSalary]);
  
  useEffect(() => {
    localStorage.setItem('use12HourFormat', use12Hour);
  }, [use12Hour]);
  
  useEffect(() => {
    localStorage.setItem('detailedView', detailedView);
  }, [detailedView]);
  
  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleThemeChange = (e) => {
      const savedTheme = localStorage.getItem('theme');
      if (!savedTheme) {
        const newTheme = e.matches ? 'dark' : 'light';
        setTheme(newTheme);
      }
    };
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleThemeChange);
      return () => mediaQuery.removeEventListener('change', handleThemeChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleThemeChange);
      return () => mediaQuery.removeListener(handleThemeChange);
    }
  }, []);
  
  // Check for backup reminder (run once on mount)
  useEffect(() => {
    if (!currentUser) return;
    
    const lastBackup = localStorage.getItem('lastBackupDate');
    const dismissedReminder = localStorage.getItem('dismissedBackupReminder');
    
    if (dismissedReminder === 'true') return;
    
    const today = new Date();
    
    if (!lastBackup) {
      if (entries.length > 0) {
        const oldestEntry = entries.sort((a, b) => a.date.localeCompare(b.date))[0];
        const oldestDate = new Date(oldestEntry.date);
        const daysSinceFirst = Math.floor((today - oldestDate) / (1000 * 60 * 60 * 24));
        
        if (daysSinceFirst >= 7) {
          setShowBackupReminder(true);
        }
      }
    } else {
      const lastBackupDate = new Date(lastBackup);
      const daysSinceBackup = Math.floor((today - lastBackupDate) / (1000 * 60 * 60 * 24));
      
      if (daysSinceBackup >= 14) {
        setShowBackupReminder(true);
      }
    }
  }, [currentUser, entries.length]);
  
  // Migration effect - add calculated fields to entries
  useEffect(() => {
    if (!currentUser || !isContextReady || entries.length === 0) return;
    if (migrationRef.current) return;
    
    const needsMigration = entries.some(e => 
      e.hoursWorked === undefined || 
      e.extraHours === undefined ||
      e.hoursSpentOutside === undefined
    );
    
    if (needsMigration) {
      migrationRef.current = true;
      
      
      const migratedEntries = entries.map(entry => {
        if (
          entry.hoursWorked !== undefined && 
          entry.extraHours !== undefined &&
          entry.hoursSpentOutside !== undefined
        ) {
          return entry;
        }
        
        const hoursWorked = calculateHoursWorked(entry.intervals, entry.date);
        const dayOfWeek = new Date(entry.date).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isSpecialDay = entry.type === 'Holiday' || entry.type === 'Vacation';
        const useDoubleFactor = isWeekend || isSpecialDay;
        
        const isHalfDaySpecial = (entry.duration === 0.5) &&
          (entry.type === 'Vacation' || entry.type === 'Sick Leave' || entry.type === 'To Be Added');
        
        const isFullDaySpecial = (entry.duration === 1) &&
          (entry.type === 'Vacation' || entry.type === 'Sick Leave' || entry.type === 'To Be Added');
        
        let extraHours = 0;
        let extraHoursWithFactor = 0;
        
        if (isFullDaySpecial) {
          extraHours = 0;
          extraHoursWithFactor = 0;
        } else if (isHalfDaySpecial) {
          const halfDayBaseline = 4.5;
          extraHours = hoursWorked - halfDayBaseline;
          extraHoursWithFactor = extraHours > 0 ? extraHours * 1.5 : extraHours;
        } else if (entry.doubleHours) {
          extraHours = hoursWorked;
          extraHoursWithFactor = hoursWorked * 2;
        } else if (useDoubleFactor && entry.type !== 'Regular') {
          extraHours = hoursWorked;
          extraHoursWithFactor = hoursWorked * 2;
        } else {
          const standardHours = isWeekend ? 0 : 9;
          extraHours = hoursWorked - standardHours;
          const factor = useDoubleFactor ? 2 : 1.5;
          extraHoursWithFactor = extraHours > 0 ? extraHours * factor : extraHours;
        }
        
        const hoursSpentOutside = calculateHoursSpentOutside(entry.intervals);
        
        return {
          id: entry.id,
          date: entry.date,
          intervals: entry.intervals,
          type: entry.type,
          duration: entry.duration,
          doubleHours: entry.doubleHours,
          notes: entry.notes,
          hoursWorked,
          extraHours,
          extraHoursWithFactor,
          hoursSpentOutside
        };
      });
      
      setEntries(migratedEntries);
      
      
      setTimeout(() => {
        migrationRef.current = false;
      }, 100);
    }
  }, [entries.length, currentUser, isContextReady]);
  
  // Helper Functions
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

  // Ref to track when we're setting current period to prevent duplicates
  const isSettingCurrentRef = useRef(false);
  const refreshKeyRef = useRef(0);

  const setCurrentPeriod = async (periodId) => {
    if (!currentUser || !periodId || isSettingCurrentRef.current) return;
    
    isSettingCurrentRef.current = true;
    
    try {
      
      
      await supabaseData.setCurrentPayPeriod(currentUser.id, periodId);
      
      // Add delay to ensure database trigger completes
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force complete refresh of user data
      
      const [profileData, entriesData, leaveSettingsData, periodsData] = await Promise.all([
        supabaseData.getUserProfile(currentUser.id),
        supabaseData.getTimeEntries(currentUser.id),
        supabaseData.getLeaveSettings(currentUser.id),
        supabaseData.getPayPeriods(currentUser.id)
      ]);
      
      // Update all context data - salary from localStorage only
      const salaryKey = `salary_${currentUser.id}`;
      const localSalary = getSimpleEncryptedItem(salaryKey, currentUser.username) || 0;
      
      setEmployee({
        name: localStorage.getItem('userDisplayName') || profileData?.full_name || profileData?.username || currentUser.username || 'User',
        salary: localSalary
      });
      
      setEntries(entriesData || []);
      setLeaveSettings({
        annualVacation: leaveSettingsData?.annual_vacation || leaveSettingsData?.annualVacation || 10,
        sickDays: leaveSettingsData?.sick_days || leaveSettingsData?.sickDays || 7,
        personalDays: leaveSettingsData?.personal_days || leaveSettingsData?.personalDays || 2,
        usedVacationDays: leaveSettingsData?.used_vacation_days || leaveSettingsData?.usedVacationDays || 0,
        usedSickDays: leaveSettingsData?.used_sick_days || leaveSettingsData?.usedSickDays || 0,
        usedPersonalDays: leaveSettingsData?.used_personal_days || leaveSettingsData?.usedPersonalDays || 0
      });
      
      setPeriods(periodsData || []);
      setCurrentPeriodId(periodId);
      
      // Increment refresh key to trigger Timesheet re-render
      refreshKeyRef.current += 1;
      
      
      
      
      
    } catch (error) {
      
    } finally {
      isSettingCurrentRef.current = false;
    }
  };
  
  const formatDate = (date) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };
  
  const formatTime = (date) => {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };
  
  const updateEntries = (newEntries) => {
    setEntries(newEntries);
    // Only update lastSaved if we're not refreshing
    if (!isRefreshingRef.current) {
      setLastSaved(new Date().toISOString());
    }
  };
  
  const timeToSeconds = (timeStr) => {
    if (!timeStr || timeStr.trim() === '') return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 3600 + parts[1] * 60;
    }
    return 0;
  };
  
  const secondsToTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };
  
  const secondsToHours = (seconds) => {
    return seconds / 3600;
  };
  
  const formatTimeDisplay = (timeStr) => {
    if (!timeStr) return '-';
    if (timeStr.split(':').length === 3) return timeStr;
    return timeStr + ':00';
  };
  
  const calculateHoursWorked = (intervals, date) => {
    if (!intervals || intervals.length === 0) {
      return 0;
    }
    
    const validIntervals = intervals.filter(interval => interval.in && interval.out);
    if (validIntervals.length === 0) return 0;
    
    const mainInterval = validIntervals[0];
    const firstInSeconds = timeToSeconds(mainInterval.in);
    const lastOutSeconds = timeToSeconds(mainInterval.out);
    
    const grossSeconds = lastOutSeconds - firstInSeconds;
    
    const ALLOWED_START = 13 * 3600;
    const ALLOWED_END = 13 * 3600 + 30 * 60;
    
    let deductedBreakSeconds = 0;
    
    for (let i = 1; i < validIntervals.length; i++) {
      const breakInterval = validIntervals[i];
      const breakStartSeconds = timeToSeconds(breakInterval.in);
      const breakEndSeconds = timeToSeconds(breakInterval.out);
      const breakDuration = breakEndSeconds - breakStartSeconds;
      
      const isAllowedBreak =
        breakStartSeconds >= ALLOWED_START &&
        breakStartSeconds <= ALLOWED_END &&
        breakEndSeconds >= ALLOWED_START &&
        breakEndSeconds <= ALLOWED_END;
      
      if (!isAllowedBreak) {
        deductedBreakSeconds += breakDuration;
      }
    }
    
    const netSeconds = Math.max(0, grossSeconds - deductedBreakSeconds);
    return secondsToHours(netSeconds);
  };
  
  const calculateHoursSpentOutside = (intervals) => {
    if (!intervals || intervals.length <= 1) return 0;
    
    const breakIntervals = intervals.slice(1);
    const ALLOWED_START = 13 * 3600;
    const ALLOWED_END = 13 * 3600 + 30 * 60;
    
    let hoursSpentOutside = 0;
    breakIntervals.forEach((interval, index) => {
      if (interval.in && interval.out) {
        const breakStartSeconds = timeToSeconds(interval.in);
        const breakEndSeconds = timeToSeconds(interval.out);
        const breakDuration = breakEndSeconds - breakStartSeconds;
        
        const isAllowedBreak =
          breakStartSeconds >= ALLOWED_START &&
          breakStartSeconds <= ALLOWED_END &&
          breakEndSeconds >= ALLOWED_START &&
          breakEndSeconds <= ALLOWED_END;
        
        if (!isAllowedBreak) {
          hoursSpentOutside += secondsToHours(breakDuration);
        }
      }
    });
    
    return hoursSpentOutside;
  };
  
  const calculateOvertimeDetails = (entries, periodStart, periodEnd) => {
    const periodEntries = entries.filter(e => 
      e.date >= periodStart && 
      e.date <= periodEnd
    );
    
    let totalHoursWorked = 0;
    let totalExtraHours = 0;
    let totalExtraHoursWithFactor = 0;
    
    periodEntries.forEach(entry => {
      if (!entry.intervals || entry.intervals.length === 0) return;
      
      const allComplete = entry.intervals.every(interval => interval.in && interval.out);
      if (!allComplete) return;
      
      let actualHours, extraHours, extraHoursWithFactor;
      
      if (
        entry.hoursWorked !== undefined && 
        entry.hoursWorked !== null &&
        entry.extraHours !== undefined && 
        entry.extraHours !== null &&
        entry.extraHoursWithFactor !== undefined &&
        entry.extraHoursWithFactor !== null
      ) {
        actualHours = entry.hoursWorked;
        extraHours = entry.extraHours;
        extraHoursWithFactor = entry.extraHoursWithFactor;
      } else {
        actualHours = calculateHoursWorked(entry.intervals, entry.date);
        
        const dayOfWeek = new Date(entry.date).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isSpecialDay = entry.type === 'Holiday' || entry.type === 'Vacation';
        const useDoubleFactor = isWeekend || isSpecialDay;
        
        const isHalfDaySpecial = (entry.duration === 0.5) &&
          (entry.type === 'Vacation' || entry.type === 'Sick Leave' || entry.type === 'To Be Added');
        
        const isFullDaySpecial = (entry.duration === 1) &&
          (entry.type === 'Vacation' || entry.type === 'Sick Leave' || entry.type === 'To Be Added');
        
        if (isFullDaySpecial) {
          extraHours = 0;
          extraHoursWithFactor = 0;
        } else if (isHalfDaySpecial) {
          const halfDayBaseline = 4.5;
          extraHours = actualHours - halfDayBaseline;
          extraHoursWithFactor = extraHours > 0 ? extraHours * 1.5 : extraHours;
        } else if (entry.doubleHours) {
          extraHours = actualHours;
          extraHoursWithFactor = actualHours * 2;
        } else if (useDoubleFactor && entry.type !== 'Regular') {
          extraHours = actualHours;
          extraHoursWithFactor = actualHours * 2;
        } else {
          const standardHours = isWeekend ? 0 : 9;
          extraHours = actualHours - standardHours;
          
          const factor = useDoubleFactor ? 2 : 1.5;
          if (extraHours > 0) {
            extraHoursWithFactor = extraHours * factor;
          } else {
            extraHoursWithFactor = extraHours;
          }
        }
      }
      
      if (entry.type === 'Regular') {
        totalHoursWorked += actualHours;
      }
      
      totalExtraHours += extraHours;
      totalExtraHoursWithFactor += extraHoursWithFactor;
    });
    
    return {
      totalHoursWorked,
      totalExtraHours,
      totalExtraHoursWithFactor
    };
  };
  
  const recalculateEntryFields = (entry) => {
    if (!entry.intervals || entry.intervals.length === 0) {
      return {
        id: entry.id,
        date: entry.date,
        intervals: entry.intervals,
        type: entry.type,
        duration: entry.duration,
        doubleHours: entry.doubleHours,
        notes: entry.notes,
        hoursWorked: 0,
        extraHours: 0,
        extraHoursWithFactor: 0,
        hoursSpentOutside: 0
      };
    }
    
    const hoursWorked = calculateHoursWorked(entry.intervals, entry.date);
    const dayOfWeek = new Date(entry.date).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isSpecialDay = entry.type === 'Holiday' || entry.type === 'Vacation';
    const useDoubleFactor = isWeekend || isSpecialDay;
    
    const isHalfDaySpecial = (entry.duration === 0.5) &&
      (entry.type === 'Vacation' || entry.type === 'Sick Leave' || entry.type === 'To Be Added');
    
    const isFullDaySpecial = (entry.duration === 1) &&
      (entry.type === 'Vacation' || entry.type === 'Sick Leave' || entry.type === 'To Be Added');
    
    let extraHours = 0;
    let extraHoursWithFactor = 0;
    
    if (isFullDaySpecial) {
      extraHours = 0;
      extraHoursWithFactor = 0;
    } else if (isHalfDaySpecial) {
      const halfDayBaseline = 4.5;
      extraHours = hoursWorked - halfDayBaseline;
      extraHoursWithFactor = extraHours > 0 ? extraHours * 1.5 : extraHours;
    } else if (entry.doubleHours) {
      extraHours = hoursWorked;
      extraHoursWithFactor = hoursWorked * 2;
    } else if (useDoubleFactor && entry.type !== 'Regular') {
      extraHours = hoursWorked;
      extraHoursWithFactor = hoursWorked * 2;
    } else {
      const standardHours = isWeekend ? 0 : 9;
      extraHours = hoursWorked - standardHours;
      const factor = useDoubleFactor ? 2 : 1.5;
      extraHoursWithFactor = extraHours > 0 ? extraHours * factor : extraHours;
    }
    
    const hoursSpentOutside = calculateHoursSpentOutside(entry.intervals);
    
    return {
      ...entry,
      hoursWorked,
      extraHours,
      extraHoursWithFactor,
      hoursSpentOutside
    };
  };
  
  const updateEntry = (date, updates) => {
    updateEntries(entries.map(entry => {
      if (entry.date === date) {
        const updatedEntry = {
          id: entry.id,
          date: entry.date,
          intervals: Array.isArray(entry.intervals) ? [...entry.intervals] : [],
          type: entry.type,
          duration: entry.duration,
          doubleHours: entry.doubleHours,
          notes: entry.notes,
          hoursWorked: entry.hoursWorked,
          extraHours: entry.extraHours,
          extraHoursWithFactor: entry.extraHoursWithFactor,
          hoursSpentOutside: entry.hoursSpentOutside,
          ...updates
        };
        return recalculateEntryFields(updatedEntry);
      }
      return entry;
    }));
  };
  
  const showConfirm = (title, message, type, onConfirmCallback) => {
    return new Promise((resolve) => {
      setConfirmModal({
        isOpen: true,
        title,
        message,
        type,
        onConfirm: () => {
          onConfirmCallback();
          setConfirmModal({ ...confirmModal, isOpen: false });
          resolve(true);
        }
      });
    });
  };
  
  const calculateOvertime = (entries, periodStart, periodEnd) => {
    const details = calculateOvertimeDetails(entries, periodStart, periodEnd);
    return details.totalExtraHoursWithFactor;
  };

  // Employee type validation functions
  const validateEmployeeType = (employeeData) => {
    const errors = [];
    
    // Validate employee type
    if (!employeeData.employeeType || !['full-time', 'part-time'].includes(employeeData.employeeType)) {
      errors.push('Employee type must be either full-time or part-time');
    }
    
    // Validate daily hours
    if (employeeData.employeeType === 'part-time') {
      if (!employeeData.dailyHours || employeeData.dailyHours < 6 || employeeData.dailyHours > 9) {
        errors.push('Part-time daily hours must be between 6 and 9');
      }
    } else {
      if (employeeData.dailyHours && employeeData.dailyHours !== 9) {
        errors.push('Full-time daily hours must be 9');
      }
    }
  
    // Validate work days per week
    if (employeeData.employeeType === 'part-time') {
      if (!employeeData.workDaysPerWeek || employeeData.workDaysPerWeek < 3 || employeeData.workDaysPerWeek > 5) {
        errors.push('Part-time work days must be between 3 and 5');
      }
    } else {
      if (employeeData.workDaysPerWeek && employeeData.workDaysPerWeek !== 5) {
        errors.push('Full-time work days must be 5');
      }
    }
    
    // Note: Monthly hours validation removed for part-time employees since it's calculated based on actual hours worked per period
      
    return errors;
  };

  const calculateMonthlyHours = (employeeType, dailyHours, workDaysPerWeek) => {
    if (employeeType === 'full-time') {
      return 187;
    }
    // For part-time, return 0 as it will be calculated based on actual hours worked
    return 0;
  };

  // Calculate actual monthly hours worked for part-time employees based on entries in a period
  const calculateActualMonthlyHours = (entries, periodStart, periodEnd) => {
    if (employee.employeeType === 'full-time') {
      return 187;
    }
    
    // Filter entries within the period
    const periodEntries = entries.filter(entry => 
      entry.date >= periodStart && entry.date <= periodEnd
    );
    
    // Calculate total hours worked (excluding leave days)
    const totalHours = periodEntries.reduce((sum, entry) => {
      if (entry.type === 'Work Day' && entry.hoursWorked) {
        return sum + entry.hoursWorked;
      }
      return sum;
    }, 0);
    
    return totalHours;
  };

  const checkIn = () => {
    const today = formatDate(new Date());
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    const existingEntry = entries.find(e => e.date === today);
    
    if (existingEntry) {
      const lastInterval = existingEntry.intervals?.[existingEntry.intervals.length - 1];
      
      if (lastInterval && !lastInterval.out) {
        setConfirmModal({
          isOpen: true,
          title: 'Already Checked In',
          message: 'You are already checked in. Please check out first.',
          type: 'info',
          confirmText: 'OK',
          showCancel: false,
          onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
        });
        return;
      }
      
      const updatedIntervals = [...(Array.isArray(existingEntry.intervals) ? existingEntry.intervals : []), { in: time, out: null }];
      updateEntries(entries.map(e =>
        e.date === today
          ? { ...e, intervals: updatedIntervals }
          : e
      ));
    } else {
      updateEntries([...entries, {
        date: today,
        type: 'Regular',
        intervals: [{ in: time, out: null }],
        hoursWorked: 0,
        extraHours: 0,
        extraHoursWithFactor: 0,
        hoursSpentOutside: 0
      }]);
    }
    
    setConfirmModal({
      isOpen: true,
      title: '✓ Checked In Successfully',
      message: `Checked in at ${time}`,
      type: 'success',
      confirmText: 'OK',
      showCancel: false,
      onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
    });
  };
  
  const checkOut = () => {
    const today = formatDate(new Date());
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    const existingEntry = entries.find(e => e.date === today);
    
    if (!existingEntry || !existingEntry.intervals?.length) {
      setConfirmModal({
        isOpen: true,
        title: 'No Check-In Found',
        message: 'You need to check in first before checking out.',
        type: 'warning',
        confirmText: 'OK',
        showCancel: false,
        onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
      });
      return;
    }
    
    const lastInterval = existingEntry.intervals[existingEntry.intervals.length - 1];
    
    if (lastInterval.out) {
      setConfirmModal({
        isOpen: true,
        title: 'Already Checked Out',
        message: 'You are already checked out. Check in again to start a new session.',
        type: 'info',
        confirmText: 'OK',
        showCancel: false,
        onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
      });
      return;
    }
    
    const updatedIntervals = existingEntry.intervals.map((interval, idx) =>
      idx === existingEntry.intervals.length - 1
        ? { ...interval, out: time }
        : interval
    );
    
    const hoursWorked = calculateHoursWorked(updatedIntervals, today);
    const dayOfWeek = new Date(today).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const standardHours = isWeekend ? 0 : 9;
    const extraHours = hoursWorked - standardHours;
    const extraHoursWithFactor = extraHours > 0 ? extraHours * 1.5 : extraHours;
    const hoursSpentOutside = calculateHoursSpentOutside(updatedIntervals);
    
    updateEntries(entries.map(e =>
      e.date === today
        ? {
            ...e,
            intervals: updatedIntervals,
            hoursWorked,
            extraHours,
            extraHoursWithFactor,
            hoursSpentOutside
          }
        : e
    ));
    
    setConfirmModal({
      isOpen: true,
      title: '✓ Checked Out Successfully',
      message: `Checked out at ${time}\n\nHours worked today: ${hoursWorked.toFixed(2)}h`,
      type: 'success',
      confirmText: 'OK',
      showCancel: false,
      onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
    });
  };
  
  const deleteEntry = async (date) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Entry',
      message: `Are you sure you want to delete the entry for ${date}? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      showCancel: true,
      onConfirm: async () => {
        try {
          // Delete from Supabase first
          if (currentUser && isAuthenticated) {
            await supabaseData.deleteTimeEntry(currentUser.id, date);
          }
          
          // Update local state
          updateEntries(entries.filter(e => e.date !== date));
          
          setConfirmModal({
            isOpen: true,
            title: 'Entry Deleted',
            message: 'Entry deleted successfully!',
            type: 'success',
            confirmText: 'OK',
            showCancel: false,
            onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
          });
        } catch (error) {
          console.error('Failed to delete entry:', error);
          
          // Still delete from local state even if Supabase fails
          updateEntries(entries.filter(e => e.date !== date));
          
          setConfirmModal({
            isOpen: true,
            title: 'Entry Deleted (Local Only)',
            message: 'Entry deleted locally but there was an error deleting from the cloud. Your local data is safe.',
            type: 'warning',
            confirmText: 'OK',
            showCancel: false,
            onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
          });
        }
      },
      onCancel: () => setConfirmModal({ ...confirmModal, isOpen: false })
    });
  };
  
  const clearCurrentDay = () => {
    if (window.confirm('Are you sure you want to clear data for today? This cannot be undone!')) {
      const today = formatDate(new Date());
      updateEntries(entries.filter(e => e.date !== today));
      showAlert('Today\'s data cleared!', 'success');
    }
  };
  
  const clearCurrentMonth = () => {
    const period = getCurrentPeriod();
    if (!period) return;
    
    const periodStart = period.start_date || period.start;
    const periodEnd = period.end_date || period.end;
    
    if (window.confirm(`Are you sure you want to clear all data for ${period.label}? This cannot be undone!`)) {
      updateEntries(entries.filter(e => e.date < periodStart || e.date > periodEnd));
      showAlert(`${period.label} data cleared!`, 'success');
    }
  };
  
  const clearAllData = () => {
    if (window.confirm('WARNING: This will delete ALL your timesheet data! This cannot be undone.')) {
      const confirmation = window.prompt('Type DELETE ALL to confirm');
      if (confirmation === 'DELETE ALL') {
        updateEntries([]);
        showAlert('All data has been cleared!', 'success');
      } else {
        showAlert('Deletion cancelled', 'info');
      }
    }
  };
  
  const updateEmployee = (data) => {
    setEmployee(data);
  };
  
  const updateLeaveSettings = (data) => {
    setLeaveSettings(data);
  };
  
  const handleBackupNow = () => {
    localStorage.setItem('lastBackupDate', new Date().toISOString());
    setShowBackupReminder(false);
    localStorage.setItem('navigateToExport', 'true');
    window.location.hash = '#settings';
  };
  
  const handleBackupLater = (days = 3) => {
    const futureDate = new Date();
    const daysAgo = 14 - days;
    futureDate.setDate(futureDate.getDate() - daysAgo);
    localStorage.setItem('lastBackupDate', futureDate.toISOString());
    setShowBackupReminder(false);
  };
  
  const handleDismissBackup = () => {
    localStorage.setItem('dismissedBackupReminder', 'true');
    setShowBackupReminder(false);
  };
  
  const handleCloseBackup = () => {
    setShowBackupReminder(false);
  };
  
  // Function to show alerts
  const showAlert = (message, type = 'info') => {
    setAlertModal({ isOpen: true, message, type });
  };
  
  // Function to set refresh flag (to prevent save updates during refresh)
  const setRefreshing = (isRefreshing) => {
    isRefreshingRef.current = isRefreshing;
  };

  const setActivePayPeriod = async (periodId) => {
  try {
    // Update all periods locally - deactivate all, activate selected
    const updatedPeriods = periods.map(p => ({
      ...p,
      is_active: p.id === periodId
    }));

    // Save each updated period to Supabase
    for (const period of updatedPeriods) {
      await supabaseData.savePayPeriod(currentUser.id, period);
    }

    // Update local state
    setPeriods(updatedPeriods);
    setCurrentPeriodId(periodId);
  } catch (error) {
    
    throw error;
  }
};

  const savePayPeriod = async (period) => {
    try {
      // Save to Supabase
      await supabaseData.savePayPeriod(currentUser.id, period);
      
      // Update local state
      const existingIndex = periods.findIndex(p => p.id === period.id);
      if (existingIndex >= 0) {
        // Update existing period
        const updatedPeriods = [...periods];
        updatedPeriods[existingIndex] = period;
        setPeriods(updatedPeriods);
      } else {
        // Add new period
        setPeriods([...periods, period]);
      }
      
      
    } catch (error) {
      
      throw error;
    }
  };

  const deletePayPeriod = async (periodId) => {
    try {
      // Delete from Supabase first
      await supabaseData.deletePayPeriod(currentUser.id, periodId);
      
      // Update local state
      const newPeriods = periods.filter(p => p.id !== periodId);
      setPeriods(newPeriods);

      // If deleting current period, switch to first available
      if (currentPeriodId === periodId) {
        setCurrentPeriodId(newPeriods[0]?.id || null);
      }
      
      
    } catch (error) {
      
      throw error;
    }
  };

  
  const value = {
    employee,
    leaveSettings,
    entries,
    periods,
    currentPeriodId,
    hideSalary,
    use12Hour,
    detailedView,
    theme,
    updateEmployee,
    updateLeaveSettings,
    setHideSalary,
    setUse12Hour,
    setDetailedView,
    setTheme,
    checkIn,
    checkOut,
    deleteEntry,
    clearCurrentDay,
    clearCurrentMonth,
    clearAllData,
    getCurrentPeriod,
    setCurrentPeriod,
    formatDate,
    formatTime,
    setPeriods,
    setCurrentPeriodId,
    calculateHoursWorked,
    calculateHoursSpentOutside,
    calculateOvertime,
    calculateOvertimeDetails,
    timeToSeconds,
    secondsToTime,
    secondsToHours,
    formatTimeDisplay,
    recalculateEntryFields,
    updateEntry,
    confirmModal,
    setConfirmModal,
    showConfirm,
    showBackupReminder,
    handleBackupNow,
    handleBackupLater,
    handleDismissBackup,
    handleCloseBackup,
    setRefreshing,
    lastSaved,
    lastRefreshed,
    setLastRefreshed,
    setEntries: updateEntries,
    savePayPeriod,      
    deletePayPeriod,    
    setActivePayPeriod,
    showAlert,
    validateEmployeeType,
    calculateMonthlyHours,
    calculateActualMonthlyHours,
  };
  
  return (
    <TimeTrackerContext.Provider value={value}>
      {children}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText || 'Confirm'}
        cancelText={confirmModal.cancelText || 'Cancel'}
        showCancel={confirmModal.showCancel !== false}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
      <BackupReminderModal
        isOpen={showBackupReminder}
        onExport={handleBackupNow}
        onRemindLater={handleBackupLater}
        onDismiss={handleDismissBackup}
        onClose={handleCloseBackup}
      />
      <AlertModal
        isOpen={alertModal.isOpen}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ isOpen: false, message: '', type: 'info' })}
      />
    </TimeTrackerContext.Provider>
  );
};
