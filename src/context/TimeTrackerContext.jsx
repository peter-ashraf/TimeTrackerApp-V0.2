import React, { createContext, useContext, useState, useEffect } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import BackupReminderModal from '../components/BackupReminderModal';

const TimeTrackerContext = createContext();

export const useTimeTracker = () => {
  const context = useContext(TimeTrackerContext);
  if (!context) {
    throw new Error('useTimeTracker must be used within TimeTrackerProvider');
  }
  return context;
};

export const TimeTrackerProvider = ({ children }) => {
  // Employee Data
  const [employee, setEmployee] = useState({
    name: localStorage.getItem('fullName') || '',
    salary: parseFloat(localStorage.getItem('salary')) || 0
  });

  // Leave Settings
  const [leaveSettings, setLeaveSettings] = useState({
    annualVacation: parseFloat(localStorage.getItem('annualVacation')) || 10,
    sickDays: parseFloat(localStorage.getItem('sickDays')) || 7
  });

  // Time Entries
  const [entries, setEntries] = useState(() => {
    const saved = localStorage.getItem('timeEntries');
    return saved ? JSON.parse(saved) : [];
  });

  // Pay Periods
  // ✅ FIXED: Load periods first, then set current period based on loaded periods
const [periods, setPeriods] = useState(() => {
  const saved = localStorage.getItem('payPeriods');
  const defaultPeriod = {
    id: 'period-default',
    label: '23 Jan - 20 Feb 2026',
    start: '2026-01-23',
    end: '2026-02-20'
  };

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return parsed.length > 0 ? parsed : [defaultPeriod];
    } catch (e) {
      console.error('Error parsing periods:', e);
      return [defaultPeriod];
    }
  }
  return [defaultPeriod];
});

const [currentPeriodId, setCurrentPeriodId] = useState(() => {
  const savedPeriods = localStorage.getItem('payPeriods');
  const savedCurrentId = localStorage.getItem('currentPeriodId');
  
  // Parse periods to get the actual first period ID
  let loadedPeriods = [];
  if (savedPeriods) {
    try {
      loadedPeriods = JSON.parse(savedPeriods);
    } catch (e) {
      console.error('Error parsing periods for currentPeriodId:', e);
    }
  }

  // If we have a saved current ID and it exists in periods, use it
  if (savedCurrentId && loadedPeriods.some(p => p.id === savedCurrentId)) {
    return savedCurrentId;
  }

  // Otherwise, use first period's ID
  if (loadedPeriods.length > 0) {
    return loadedPeriods[0].id;
  }

  // Fallback to default
  return 'period-default';
});


  // UI State
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

  // State Conrimation
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null
  });


  // Theme State
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    
    // Detect system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  // Backup reminder state
const [showBackupReminder, setShowBackupReminder] = useState(false);

  // Persist to localStorage and apply to document
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleThemeChange = (e) => {
      // Only auto-switch if user hasn't manually set a theme
      const savedTheme = localStorage.getItem('theme');
      if (!savedTheme) {
        const newTheme = e.matches ? 'dark' : 'light';
        console.log('🎨 System theme changed to:', newTheme);
        setTheme(newTheme);
      }
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleThemeChange);
      return () => mediaQuery.removeEventListener('change', handleThemeChange);
    }
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleThemeChange);
      return () => mediaQuery.removeListener(handleThemeChange);
    }
  }, []);

  // Check for backup reminder (run once on mount)
  useEffect(() => {
    const lastBackup = localStorage.getItem('lastBackupDate');
    const dismissedReminder = localStorage.getItem('dismissedBackupReminder');
    
    // If user permanently dismissed, don't show
    if (dismissedReminder === 'true') return;
    
    const today = new Date();
    
    if (!lastBackup) {
      // First time user - check if they have entries older than 7 days
      if (entries.length > 0) {
        const oldestEntry = entries.sort((a, b) => a.date.localeCompare(b.date))[0];
        const oldestDate = new Date(oldestEntry.date);
        const daysSinceFirst = Math.floor((today - oldestDate) / (1000 * 60 * 60 * 24));
        
        if (daysSinceFirst >= 7) {
          setShowBackupReminder(true);
        }
      }
    } else {
      // Check if 14 days since last backup
      const lastBackupDate = new Date(lastBackup);
      const daysSinceBackup = Math.floor((today - lastBackupDate) / (1000 * 60 * 60 * 24));
      
      if (daysSinceBackup >= 14) {
        setShowBackupReminder(true);
      }
    }
  }, []); 


  useEffect(() => {
    localStorage.setItem('fullName', employee.name);
    localStorage.setItem('salary', employee.salary);
  }, [employee]);

  useEffect(() => {
    localStorage.setItem('annualVacation', leaveSettings.annualVacation);
    localStorage.setItem('sickDays', leaveSettings.sickDays);
  }, [leaveSettings]);

  useEffect(() => {
    localStorage.setItem('timeEntries', JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem('payPeriods', JSON.stringify(periods));
  }, [periods]);

  useEffect(() => {
    if (currentPeriodId) {
      localStorage.setItem('currentPeriodId', currentPeriodId);
    }
  }, [currentPeriodId]);

  useEffect(() => {
    localStorage.setItem('hideSalary', hideSalary);
  }, [hideSalary]);

  useEffect(() => {
    localStorage.setItem('use12HourFormat', use12Hour);
  }, [use12Hour]);

  useEffect(() => {
    localStorage.setItem('detailedView', detailedView);
  }, [detailedView]);

  // Add calculated fields to existing entries (ONLY RUNS ONCE)
  useEffect(() => {
    const needsMigration = entries.some(e => 
      e.hoursWorked === undefined || 
      e.extraHours === undefined ||
      e.hoursSpentOutside === undefined
    );

    if (needsMigration && entries.length > 0) {
      console.log('🔄 Migrating entries to include calculated fields...');
      
      const migratedEntries = entries.map(entry => {
        // If already has all calculated fields, skip
        if (
          entry.hoursWorked !== undefined && 
          entry.extraHours !== undefined &&
          entry.hoursSpentOutside !== undefined
        ) {
          return entry;
        }

        // Calculate values using existing functions
        const hoursWorked = calculateHoursWorked(entry.intervals, entry.date);

        // Calculate extra hours based on day type
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

        // Full Day Special - No extra hours
        if (isFullDaySpecial) {
          extraHours = 0;
          extraHoursWithFactor = 0;
        }
        // Half Day Special - 4.5h baseline
        else if (isHalfDaySpecial) {
          const halfDayBaseline = 4.5;
          extraHours = hoursWorked - halfDayBaseline;
          extraHoursWithFactor = extraHours > 0 ? extraHours * 1.5 : extraHours;
        }
        // Double Hours flag
        else if (entry.doubleHours) {
          extraHours = hoursWorked;
          extraHoursWithFactor = hoursWorked * 2;
        }
        // Vacation/holiday worked
        else if (useDoubleFactor && entry.type !== 'Regular') {
          extraHours = hoursWorked;
          extraHoursWithFactor = hoursWorked * 2;
        }
        // Regular day or weekend
        else {
          const standardHours = isWeekend ? 0 : 9;
          extraHours = hoursWorked - standardHours;
          const factor = useDoubleFactor ? 2 : 1.5;
          extraHoursWithFactor = extraHours > 0 ? extraHours * factor : extraHours;
        }

        // Calculate hours spent outside (break duration OUTSIDE allowed window)
        const breakIntervals = entry.intervals?.slice(1) || [];
        const ALLOWED_START = 13 * 3600; // 13:00:00
        const ALLOWED_END = 13 * 3600 + 30 * 60; // 13:30:00

        let hoursSpentOutside = 0;
        breakIntervals.forEach(interval => {
          if (interval.in && interval.out) {
            const breakStartSeconds = timeToSeconds(interval.in);
            const breakEndSeconds = timeToSeconds(interval.out);
            const breakDuration = breakEndSeconds - breakStartSeconds;

            // Check if break falls within allowed window
            const isAllowedBreak =
              breakStartSeconds >= ALLOWED_START &&
              breakStartSeconds <= ALLOWED_END &&
              breakEndSeconds >= ALLOWED_START &&
              breakEndSeconds <= ALLOWED_END;

            // Only count breaks OUTSIDE the allowed window
            if (!isAllowedBreak) {
              hoursSpentOutside += secondsToHours(breakDuration);
            }
          }
        });

        return {
          ...entry,
          hoursWorked,
          extraHours,
          extraHoursWithFactor,
          hoursSpentOutside
        };
      });

      setEntries(migratedEntries);
      console.log('✅ Migration complete!');
    }
  }, []); // Run only once on mount

  // Data integrity check on load
  useEffect(() => {
    const checkDataIntegrity = () => {
      try {
        // Check if entries are properly formatted
        const invalidEntries = entries.filter(e => 
          !e.date || !e.type || !Array.isArray(e.intervals)
        );

        if (invalidEntries.length > 0) {
          console.warn('Found invalid entries:', invalidEntries);
          
          // Attempt to fix
          const fixedEntries = entries.filter(e => 
            e.date && e.type && Array.isArray(e.intervals)
          );
          
          if (fixedEntries.length < entries.length) {
            setEntries(fixedEntries);
            console.log(`Removed ${entries.length - fixedEntries.length} invalid entries`);
          }
        }

        // Check for duplicate dates in same period
        const dateMap = new Map();
        entries.forEach(e => {
          if (dateMap.has(e.date)) {
            console.warn('Duplicate date found:', e.date);
          }
          dateMap.set(e.date, e);
        });

      } catch (err) {
        console.error('Data integrity check failed:', err);
      }
    };

    if (entries.length > 0) {
      checkDataIntegrity();
    }
  }, []); // Run once on mount


  // Helper Functions
 // Memoize and avoid console spam
const getCurrentPeriod = () => {
  if (!periods || periods.length === 0) {
    return null;
  }
  
  const found = periods.find(p => p.id === currentPeriodId);
  
  // If current period not found, silently return first period
  if (!found) {
    return periods[0];
  }
  
  return found;
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

  //  Wrapper for setEntries with auto-save notification
  const updateEntries = (newEntries) => {
    setEntries(newEntries);
    setLastSaved(new Date().toISOString());
  };

  // Helper: Convert time string (HH:MM or HH:MM:SS) to total seconds
  const timeToSeconds = (timeStr) => {
    if (!timeStr || timeStr.trim() === '') return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
      // HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      // HH:MM
      return parts[0] * 3600 + parts[1] * 60;
    }
    return 0;
  };

  // Helper: Convert seconds to HH:MM:SS format
  const secondsToTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Helper: Convert seconds to decimal hours with precision
  const secondsToHours = (seconds) => {
    return seconds / 3600;
  };

  // Helper: Format time for display (handles both HH:MM and HH:MM:SS)
  const formatTimeDisplay = (timeStr) => {
    if (!timeStr) return '-';
    // If already has seconds, return as is
    if (timeStr.split(':').length === 3) return timeStr;
    // If only HH:MM, add :00
    return timeStr + ':00';
  };

  // Helper: Calculate hours worked from intervals (WITH SECONDS)
  const calculateHoursWorked = (intervals, date) => {
    if (!intervals || intervals.length === 0) {
      return 0;
    }

    // Filter out intervals with missing check-in or check-out times
    const validIntervals = intervals.filter(interval => interval.in && interval.out);
    if (validIntervals.length === 0) return 0;

    // FIRST interval is main working hours
    const mainInterval = validIntervals[0];
    const firstInSeconds = timeToSeconds(mainInterval.in);
    const lastOutSeconds = timeToSeconds(mainInterval.out);

    // Calculate gross seconds (main interval span)
    const grossSeconds = lastOutSeconds - firstInSeconds;

    // Permitted break window: 13:00:00 - 13:30:00
    const ALLOWED_START = 13 * 3600; // 13:00:00
    const ALLOWED_END = 13 * 3600 + 30 * 60; // 13:30:00

    let deductedBreakSeconds = 0;

    // Process BREAKS (intervals 2+)
    for (let i = 1; i < validIntervals.length; i++) {
      const breakInterval = validIntervals[i];
      const breakStartSeconds = timeToSeconds(breakInterval.in);
      const breakEndSeconds = timeToSeconds(breakInterval.out);
      const breakDuration = breakEndSeconds - breakStartSeconds;

      // Check if break falls within allowed window
      const isAllowedBreak =
        breakStartSeconds >= ALLOWED_START &&
        breakStartSeconds <= ALLOWED_END &&
        breakEndSeconds >= ALLOWED_START &&
        breakEndSeconds <= ALLOWED_END;

      // Only deduct breaks OUTSIDE the allowed window
      if (!isAllowedBreak) {
        deductedBreakSeconds += breakDuration;
      }
    }

    // Net working seconds
    const netSeconds = Math.max(0, grossSeconds - deductedBreakSeconds);
    return secondsToHours(netSeconds); // Convert to hours
  };

  // Helper: Calculate overtime WITH PROPER TOTALS

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

    // Check if all intervals are complete
    const allComplete = entry.intervals.every(interval => interval.in && interval.out);
    if (!allComplete) return;

    // ✅ FIXED: Always calculate if stored values are missing or undefined
    let actualHours, extraHours, extraHoursWithFactor;

    if (
      entry.hoursWorked !== undefined && 
      entry.hoursWorked !== null &&
      entry.extraHours !== undefined && 
      entry.extraHours !== null &&
      entry.extraHoursWithFactor !== undefined &&
      entry.extraHoursWithFactor !== null
    ) {
      // Use stored values
      actualHours = entry.hoursWorked;
      extraHours = entry.extraHours;
      extraHoursWithFactor = entry.extraHoursWithFactor;
    } else {
      // ✅ CALCULATE if not stored (fallback)
      actualHours = calculateHoursWorked(entry.intervals, entry.date);
      
      // Check if day is weekend/holiday/vacation
      const dayOfWeek = new Date(entry.date).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isSpecialDay = entry.type === 'Holiday' || entry.type === 'Vacation';
      const useDoubleFactor = isWeekend || isSpecialDay;

      // Check if it's a half day special
      const isHalfDaySpecial = (entry.duration === 0.5) &&
        (entry.type === 'Vacation' || entry.type === 'Sick Leave' || entry.type === 'To Be Added');

      // Check if it's a full day special
      const isFullDaySpecial = (entry.duration === 1) &&
        (entry.type === 'Vacation' || entry.type === 'Sick Leave' || entry.type === 'To Be Added');

      // Full Day Special - No extra hours
      if (isFullDaySpecial) {
        extraHours = 0;
        extraHoursWithFactor = 0;
      }
      // Half Day Special - 4.5h baseline
      else if (isHalfDaySpecial) {
        const halfDayBaseline = 4.5;
        extraHours = actualHours - halfDayBaseline;
        extraHoursWithFactor = extraHours > 0 ? extraHours * 1.5 : extraHours;
      }
      // Check if "Double Hours" flag is set
      else if (entry.doubleHours) {
        extraHours = actualHours;
        extraHoursWithFactor = actualHours * 2;
      }
      // For vacation/holiday worked, ALL hours are extra with 2x
      else if (useDoubleFactor && entry.type !== 'Regular') {
        extraHours = actualHours;
        extraHoursWithFactor = actualHours * 2;
      }
      // Regular day or weekend
      else {
        const standardHours = isWeekend ? 0 : 9; // 9h regular, 0h weekend
        extraHours = actualHours - standardHours;
        
        const factor = useDoubleFactor ? 2 : 1.5;
        if (extraHours > 0) {
          extraHoursWithFactor = extraHours * factor;
        } else {
          extraHoursWithFactor = extraHours; // Negative hours no factor
        }
      }
    }
    
    // Only count Regular working days in total hours
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


// Helper to recalculate all fields for an entry
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

  // Calculate hours worked
  const hoursWorked = calculateHoursWorked(entry.intervals, entry.date);

  // Calculate extra hours based on day type
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

  // Full Day Special - No extra hours
  if (isFullDaySpecial) {
    extraHours = 0;
    extraHoursWithFactor = 0;
  }
  // Half Day Special - 4.5h baseline
  else if (isHalfDaySpecial) {
    const halfDayBaseline = 4.5;
    extraHours = hoursWorked - halfDayBaseline;
    extraHoursWithFactor = extraHours > 0 ? extraHours * 1.5 : extraHours;
  }
  // Double Hours flag
  else if (entry.doubleHours) {
    extraHours = hoursWorked;
    extraHoursWithFactor = hoursWorked * 2;
  }
  // Vacation/holiday worked
  else if (useDoubleFactor && entry.type !== 'Regular') {
    extraHours = hoursWorked;
    extraHoursWithFactor = hoursWorked * 2;
  }
  // Regular day or weekend
  else {
    const standardHours = isWeekend ? 0 : 9;
    extraHours = hoursWorked - standardHours;
    const factor = useDoubleFactor ? 2 : 1.5;
    extraHoursWithFactor = extraHours > 0 ? extraHours * factor : extraHours;
  }

  // Calculate hours spent outside (break duration OUTSIDE allowed window)
  const breakIntervals = entry.intervals.slice(1);
  const ALLOWED_START = 13 * 3600; // 13:00:00
  const ALLOWED_END = 13 * 3600 + 30 * 60; // 13:30:00

  let hoursSpentOutside = 0;
  breakIntervals.forEach(interval => {
    if (interval.in && interval.out) {
      const breakStartSeconds = timeToSeconds(interval.in);
      const breakEndSeconds = timeToSeconds(interval.out);
      const breakDuration = breakEndSeconds - breakStartSeconds;

      // Check if break falls within allowed window
      const isAllowedBreak =
        breakStartSeconds >= ALLOWED_START &&
        breakStartSeconds <= ALLOWED_END &&
        breakEndSeconds >= ALLOWED_START &&
        breakEndSeconds <= ALLOWED_END;

      // Only count breaks OUTSIDE the allowed window
      if (!isAllowedBreak) {
        hoursSpentOutside += secondsToHours(breakDuration);
      }
    }
  });

  return {
    ...entry,
    hoursWorked,
    extraHours,
    extraHoursWithFactor,
    hoursSpentOutside
  };
};

// Update entry and recalculate fields
  const updateEntry = (date, updates) => {
  updateEntries(prevEntries => {
    return prevEntries.map(entry => {
      if (entry.date === date) {
        // Merge updates with existing entry
        const updatedEntry = { ...entry, ...updates };
        
        // Recalculate all fields
        return recalculateEntryFields(updatedEntry);
      }
      return entry;
    });
  });
};

// Helper to show confirmation modal
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



// Backward compatible calculateOvertime
const calculateOvertime = (entries, periodStart, periodEnd) => {
  const details = calculateOvertimeDetails(entries, periodStart, periodEnd);
  return details.totalExtraHoursWithFactor;
};

  // ✅ UPDATED: Check In WITH CALCULATED FIELDS
const checkIn = () => {
  const today = formatDate(new Date());
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const existingEntry = entries.find(e => e.date === today);

  if (existingEntry) {
    const lastInterval = existingEntry.intervals?.[existingEntry.intervals.length - 1];

    if (lastInterval && !lastInterval.out) {
      // ERROR: Already checked in - INFO ONLY (no cancel needed)
      
      setConfirmModal({
        isOpen: true,
        title: 'Already Checked In',
        message: 'You are already checked in. Please check out first.',
        type: 'info',
        confirmText: 'OK',
        showCancel: false, // Only show OK button
        onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
      });
      return;
    }

    const updatedIntervals = [...(existingEntry.intervals || []), { in: time, out: null }];
    updateEntries(entries.map(e =>
      e.date === today
        ? {
            ...e,
            intervals: updatedIntervals
            // Don't recalculate until checkout
          }
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

  // SUCCESS: Checked in - INFO ONLY (no cancel needed)
  setConfirmModal({
    isOpen: true,
    title: '✓ Checked In Successfully',
    message: `Checked in at ${time}`,
    type: 'success',
    confirmText: 'OK',
    showCancel: false, // Only show OK button
    onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
  });
};

  // ✅ UPDATED: Check Out WITH CALCULATED FIELDS
  const checkOut = () => {
    const today = formatDate(new Date());
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const existingEntry = entries.find(e => e.date === today);

    if (!existingEntry || !existingEntry.intervals?.length) {
      // ERROR: No check-in found - INFO ONLY (no cancel needed)
      setConfirmModal({
        isOpen: true,
        title: 'No Check-In Found',
        message: 'You need to check in first before checking out.',
        type: 'warning',
        confirmText: 'OK',
        showCancel: false, // Only show OK button
        onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
      });
      return;
    }

    const lastInterval = existingEntry.intervals[existingEntry.intervals.length - 1];

    if (lastInterval.out) {
      // ERROR: Already checked out - INFO ONLY (no cancel needed)
      setConfirmModal({
        isOpen: true,
        title: 'Already Checked Out',
        message: 'You are already checked out. Check in again to start a new session.',
        type: 'info',
        confirmText: 'OK',
        showCancel: false, // Only show OK button
        onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
      });
      return;
    }

    // Update intervals with checkout time
    const updatedIntervals = existingEntry.intervals.map((interval, idx) =>
      idx === existingEntry.intervals.length - 1
        ? { ...interval, out: time }
        : interval
    );

    // ✅ RECALCULATE ALL FIELDS
    const hoursWorked = calculateHoursWorked(updatedIntervals, today);
    const dayOfWeek = new Date(today).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const standardHours = isWeekend ? 0 : 9;
    const extraHours = hoursWorked - standardHours;
    const extraHoursWithFactor = extraHours > 0 ? extraHours * 1.5 : extraHours;

    // Calculate hours spent outside
    const breakIntervals = updatedIntervals.slice(1);
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

    // SUCCESS: Checked out - INFO ONLY (no cancel needed)
    setConfirmModal({
      isOpen: true,
      title: '✓ Checked Out Successfully',
      message: `Checked out at ${time}\n\nHours worked today: ${hoursWorked.toFixed(2)}h`,
      type: 'success',
      confirmText: 'OK',
      showCancel: false, // Only show OK button
      onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
    });
  };


  // Delete Entry
  // Delete Entry
  const deleteEntry = (date) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Entry',
      message: `Are you sure you want to delete the entry for ${date}? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      showCancel: true, // Show both buttons for confirmation
      onConfirm: () => {
        updateEntries(entries.filter(e => e.date !== date));
        
        // After deletion, show success with ONLY OK button
        setConfirmModal({
          isOpen: true,
          title: 'Entry Deleted',
          message: 'Entry deleted successfully!',
          type: 'success',
          confirmText: 'OK',
          showCancel: false, // ← ONLY OK BUTTON
          onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
        });
      },
      onCancel: () => setConfirmModal({ ...confirmModal, isOpen: false }) // Add this for cancel
    });
  };

  // Clear Functions
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
        localStorage.clear();
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

  // Update Employee
  const updateEmployee = (data) => {
    setEmployee(data);
    
  };

  // Update Leave Settings
  const updateLeaveSettings = (data) => {
    setLeaveSettings(data);
    
  };

  // Backup reminder handlers
  const handleBackupNow = () => {
    localStorage.setItem('lastBackupDate', new Date().toISOString());
    setShowBackupReminder(false);
    // This will be handled by navigating to export in Settings

    localStorage.setItem('navigateToExport', 'true');
    window.location.hash = '#settings';
  };

  const handleBackupLater = (days = 3) => {
    // Set reminder to show again after specified days
    // We calculate: 14 (total interval) - days = days ago to set
    const futureDate = new Date();
    const daysAgo = 14 - days;
    futureDate.setDate(futureDate.getDate() - daysAgo);
    localStorage.setItem('lastBackupDate', futureDate.toISOString());
    setShowBackupReminder(false);
  };


  const handleDismissBackup = () => {
    // Permanently dismiss backup reminders
    localStorage.setItem('dismissedBackupReminder', 'true');
    setShowBackupReminder(false);
  };

  const handleCloseBackup = () => {
    // Just close without changing anything
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
      confirmText={confirmModal.confirmText || 'Confirm'}  // ADD THIS
      cancelText={confirmModal.cancelText || 'Cancel'}      // ADD THIS
      showCancel={confirmModal.showCancel !== false}        // ADD THIS (important!)
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
