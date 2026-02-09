import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import BackupReminderModal from '../components/BackupReminderModal';
import { useAuth } from './AuthContext';

const TimeTrackerContext = createContext();

export const useTimeTracker = () => {
  const context = useContext(TimeTrackerContext);
  if (!context) {
    throw new Error('useTimeTracker must be used within TimeTrackerProvider');
  }
  return context;
};

export const TimeTrackerProvider = ({ children }) => {
  const { currentUser, isAuthenticated, getUserData, saveUserData } = useAuth();
  
  // ✅ CRITICAL: Don't load data until user is authenticated
  const [isContextReady, setIsContextReady] = useState(false);
  
  // Employee Data - using getUserData/saveUserData from AuthContext
  const [employee, setEmployee] = useState({ name: '', salary: 0 });
  
  // Leave Settings
  const [leaveSettings, setLeaveSettings] = useState({ annualVacation: 10, sickDays: 7 });
  
  // Time Entries
  const [entries, setEntries] = useState([]);
  
  // Pay Periods
  const [periods, setPeriods] = useState([{
    id: 'period-default',
    label: '23 Jan - 20 Feb 2026',
    start: '2026-01-23',
    end: '2026-02-20'
  }]);
  
  const [currentPeriodId, setCurrentPeriodId] = useState('period-default');
  
  // UI State (these are NOT user-specific, they're app-wide preferences)
  const [hideSalary, setHideSalary] = useState(() => {
    return localStorage.getItem('hideSalary') === 'true';
  });
  
  const [lastSaved, setLastSaved] = useState(null);
  
  const [use12Hour, setUse12Hour] = useState(() => {
    return localStorage.getItem('use12HourFormat') !== 'false';
  });
  
  const [detailedView, setDetailedView] = useState(() => {
    return localStorage.getItem('detailedView') === 'true';
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
  
  // Ref to track migration state
  const migrationRef = useRef(false);
  
  // ✅ LOAD USER DATA WHEN USER CHANGES
  useEffect(() => {
    if (!currentUser) {
      // Reset to defaults if no user
      setEmployee({ name: '', salary: 0 });
      setLeaveSettings({ annualVacation: 10, sickDays: 7 });
      setEntries([]);
      setPeriods([{
        id: 'period-default',
        label: '23 Jan - 20 Feb 2026',
        start: '2026-01-23',
        end: '2026-02-20'
      }]);
      setCurrentPeriodId('period-default');
      setIsContextReady(false);
      return;
    }
    
    // Load user-specific data
    const loadedEmployee = {
      name: getUserData('fullName') || '',
      salary: parseFloat(getUserData('salary')) || 0
    };
    
    const loadedLeaveSettings = {
      annualVacation: parseFloat(getUserData('annualVacation')) || 10,
      sickDays: parseFloat(getUserData('sickDays')) || 7
    };
    
    const loadedEntries = getUserData('timeEntries') || [];
    const loadedPeriods = getUserData('payPeriods') || [{
      id: 'period-default',
      label: '23 Jan - 20 Feb 2026',
      start: '2026-01-23',
      end: '2026-02-20'
    }];
    
    const loadedCurrentPeriodId = getUserData('currentPeriodId') || (loadedPeriods[0]?.id || 'period-default');
    
    setEmployee(loadedEmployee);
    setLeaveSettings(loadedLeaveSettings);
    setEntries(loadedEntries);
    setPeriods(loadedPeriods);
    setCurrentPeriodId(loadedCurrentPeriodId);
    setIsContextReady(true);
    
    console.log(`✅ Loaded data for user: ${currentUser.username}`);
  }, [currentUser, getUserData]);
  
  // ✅ SAVE USER DATA WHEN IT CHANGES (using user-specific keys)
  useEffect(() => {
    if (!currentUser || !isContextReady) return;
    saveUserData('fullName', employee.name);
    saveUserData('salary', employee.salary);
  }, [employee, currentUser, saveUserData, isContextReady]);
  
  useEffect(() => {
    if (!currentUser || !isContextReady) return;
    saveUserData('annualVacation', leaveSettings.annualVacation);
    saveUserData('sickDays', leaveSettings.sickDays);
  }, [leaveSettings, currentUser, saveUserData, isContextReady]);
  
  useEffect(() => {
    if (!currentUser || !isContextReady) return;
    saveUserData('timeEntries', entries);
  }, [entries, currentUser, saveUserData, isContextReady]);
  
  useEffect(() => {
    if (!currentUser || !isContextReady) return;
    saveUserData('payPeriods', periods);
  }, [periods, currentUser, saveUserData, isContextReady]);
  
  useEffect(() => {
    if (!currentUser || !isContextReady) return;
    saveUserData('currentPeriodId', currentPeriodId);
  }, [currentPeriodId, currentUser, saveUserData, isContextReady]);
  
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
      console.log('🔄 Migrating entries for user:', currentUser.username);
      
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
          ...entry,
          hoursWorked,
          extraHours,
          extraHoursWithFactor,
          hoursSpentOutside
        };
      });
      
      setEntries(migratedEntries);
      console.log('✅ Migration complete for user:', currentUser.username);
      
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
    
    const found = periods.find(p => p.id === currentPeriodId);
    
    if (!found) {
      return periods[0];
    }
    
    return found;
  }, [periods, currentPeriodId]);
  
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
    setLastSaved(new Date().toISOString());
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
    breakIntervals.forEach(interval => {
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
        ...entry,
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
        const updatedEntry = { ...entry, ...updates };
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
      
      const updatedIntervals = [...(existingEntry.intervals || []), { in: time, out: null }];
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
  
  const deleteEntry = (date) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Entry',
      message: `Are you sure you want to delete the entry for ${date}? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      showCancel: true,
      onConfirm: () => {
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
      },
      onCancel: () => setConfirmModal({ ...confirmModal, isOpen: false })
    });
  };
  
  const clearCurrentDay = () => {
    if (window.confirm('Are you sure you want to clear data for today? This cannot be undone!')) {
      const today = formatDate(new Date());
      updateEntries(entries.filter(e => e.date !== today));
      alert('Today\'s data cleared!');
    }
  };
  
  const clearCurrentMonth = () => {
    const period = getCurrentPeriod();
    if (window.confirm(`Are you sure you want to clear all data for ${period.label}? This cannot be undone!`)) {
      updateEntries(entries.filter(e => e.date < period.start || e.date > period.end));
      alert(`Data for ${period.label} cleared!`);
    }
  };
  
  const clearAllData = () => {
    if (window.confirm('WARNING: This will delete ALL data (timesheet, settings, everything)! This cannot be undone.')) {
      const confirmation = window.prompt('Type DELETE ALL to confirm');
      if (confirmation === 'DELETE ALL') {
        // Clear only current user's data
        if (currentUser) {
          saveUserData('timeEntries', []);
          saveUserData('payPeriods', []);
          saveUserData('fullName', '');
          saveUserData('salary', 0);
          saveUserData('annualVacation', 10);
          saveUserData('sickDays', 7);
        }
        
        setEmployee({ name: '', salary: 0 });
        setLeaveSettings({ annualVacation: 10, sickDays: 7 });
        setEntries([]);
        setPeriods([]);
        alert('All data has been cleared!');
      } else {
        alert('Deletion cancelled');
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
    lastSaved,
    setEntries: updateEntries
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
    </TimeTrackerContext.Provider>
  );
};
