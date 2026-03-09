import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';
import { useSupabaseAuth } from './SupabaseAuthContext';
import { supabaseData } from '../utils/supabaseData';
import { dataMigration } from '../utils/dataMigration';
import { backgroundSync } from '../utils/backgroundSync';
import { useTimeEntry } from './TimeEntryContext';
import { useUserPreferences } from './UserPreferencesContext';
import { usePayPeriod } from './PayPeriodContext';

// Lazy load modal components for better code splitting
const BackupReminderModal = React.lazy(() => import('../components/BackupReminderModal'));

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
  
  // Use the smaller contexts
  const timeEntryContext = useTimeEntry();
  const userPreferencesContext = useUserPreferences();
  const payPeriodContext = usePayPeriod();
  
  // ✅ CRITICAL: Don't load data until user is authenticated
  const [isContextReady, setIsContextReady] = useState(false);
  
  // State Confirmation
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null
  });
  
  // Backup reminder state
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  
  // Alert modal state
  const [alertModal, setAlertModal] = useState({ isOpen: false, message: '', type: 'info' });
  
  // Ref to track migration state
  const migrationRef = useRef(false);

  // Function to show alerts
  const showAlert = useCallback((message, type = 'info') => {
    setAlertModal({ isOpen: true, message, type });
  }, []);

  // Helper function to ensure time format includes seconds
  const ensureTimeSeconds = useCallback((timeStr) => {
    if (!timeStr) return timeStr;
    return timeStr.split(':').length === 2 ? timeStr + ':00' : timeStr;
  }, []);

  // Helper Functions
  const timeToSeconds = useCallback((timeStr) => {
    if (!timeStr || timeStr.trim() === '') return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 3600 + parts[1] * 60;
    }
    return 0;
  }, []);

  const secondsToTime = useCallback((totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, []);

  const secondsToHours = useCallback((seconds) => {
    return seconds / 3600;
  }, []);

  const formatTimeDisplay = useCallback((timeStr) => {
    if (!timeStr) return '-';
    if (timeStr.split(':').length === 3) return timeStr;
    return timeStr + ':00';
  }, []);

  const calculateHoursWorked = useCallback((intervals, date) => {
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
  }, [timeToSeconds, secondsToHours]);

  const calculateHoursSpentOutside = useCallback((intervals) => {
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
  }, [timeToSeconds, secondsToHours]);

  // Check-in functionality
  const checkIn = useCallback(async () => {
    if (!currentUser || !isAuthenticated) return;
    
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeString = ensureTimeSeconds(now.toTimeString().split(' ')[0]); // Format: HH:MM:SS
    
    try {
      // Check if there's already an entry for today
      const todayEntry = timeEntryContext.entries.find(e => e.date === today);
      
      if (todayEntry) {
        // Check if there's already an active check-in (interval without out time)
        const hasActiveCheckIn = todayEntry.intervals && 
          todayEntry.intervals.length > 0 && 
          todayEntry.intervals.some(interval => interval.in && !interval.out);
        
        if (hasActiveCheckIn) {
          showAlert('You are already checked in!', 'warning');
          return;
        }
        
        // If there's an entry but no active check-in, add new interval
        const updatedEntry = { ...todayEntry };
        updatedEntry.intervals = [...updatedEntry.intervals, { in: timeString, out: null }];
        updatedEntry.lastModified = now.toISOString();
        
        // Update entries locally first
        const updatedEntries = [updatedEntry, ...timeEntryContext.entries.filter(e => e.date !== today)];
        timeEntryContext.setEntries(updatedEntries);
        
        // Immediately save to storage with retry logic
        const saveResult = await timeEntryContext.saveTimeEntriesData(updatedEntry, showAlert);
        
        if (saveResult.success) {
          showAlert('Successfully checked in!', 'success');
        } else if (saveResult.savedTo === 'local') {
          showAlert('Checked in (saved locally)', 'success');
        }
        return;
      }
      
      // No entry exists for today, create new one
      const newEntry = {
        date: today,
        intervals: [{ in: timeString, out: null }],
        type: 'Regular',
        lastModified: now.toISOString()
      };
      
      // Update entries through time entry context locally first
      const updatedEntries = [newEntry, ...timeEntryContext.entries.filter(e => e.date !== today)];
      timeEntryContext.setEntries(updatedEntries);
      
      // Immediately save to storage with retry logic
      const saveResult = await timeEntryContext.saveTimeEntriesData(newEntry, showAlert);
      
      if (saveResult.success) {
        showAlert('Successfully checked in!', 'success');
      } else if (saveResult.savedTo === 'local') {
        showAlert('Checked in (saved locally)', 'success');
      }
    } catch (error) {
      console.error('Check-in failed:', error);
      showAlert('Failed to check in. Please try again.', 'error');
    }
  }, [currentUser, isAuthenticated, timeEntryContext, showAlert, ensureTimeSeconds]);

  // Check-out functionality
  const checkOut = useCallback(async () => {
    if (!currentUser || !isAuthenticated) return;
    
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeString = ensureTimeSeconds(now.toTimeString().split(' ')[0]); // Format: HH:MM:SS
    
    try {
      const todayEntry = timeEntryContext.entries.find(e => e.date === today);
      if (!todayEntry) {
        showAlert('No check-in found for today', 'error');
        return;
      }
      
      const updatedEntry = { ...todayEntry };
      const lastInterval = updatedEntry.intervals[updatedEntry.intervals.length - 1];
      if (lastInterval && !lastInterval.out) {
        lastInterval.out = timeString;
        updatedEntry.lastModified = now.toISOString();
      }
      
      // Update entries locally first
      const updatedEntries = timeEntryContext.entries.map(e => 
        e.date === today ? updatedEntry : e
      );
      timeEntryContext.setEntries(updatedEntries);
      
      // Immediately save to storage with retry logic
      const saveResult = await timeEntryContext.saveTimeEntriesData(updatedEntry, showAlert);
      
      if (saveResult.success) {
        showAlert('Successfully checked out!', 'success');
      } else if (saveResult.savedTo === 'local') {
        showAlert('Checked out (saved locally)', 'success');
      }
    } catch (error) {
      console.error('Check-out failed:', error);
      showAlert('Failed to check out. Please try again.', 'error');
    }
  }, [currentUser, isAuthenticated, timeEntryContext, showAlert, ensureTimeSeconds]);

  // Calculate overtime details
  const calculateOvertimeDetails = useCallback((entries, periodStart, periodEnd) => {
    const periodEntries = entries.filter(e => 
      e.date >= periodStart && 
      e.date <= periodEnd
    );
    
    let totalHoursWorked = 0;
    let totalExtraHours = 0;
    let totalExtraHoursWithFactor = 0;
    
    periodEntries.forEach((entry, index) => {
      // Skip entries without complete check-in/check-out data
      if (!entry.intervals || entry.intervals.length === 0) {
        return;
      }
      
      const allComplete = entry.intervals.every(interval => interval.in && interval.out);
      if (!allComplete) {
        return;
      }
      
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
          extraHoursWithFactor = extraHours > 0 ? extraHours * factor : extraHours;
        }
      }
      
      totalHoursWorked += actualHours;
      totalExtraHours += extraHours;
      totalExtraHoursWithFactor += extraHoursWithFactor;
    });
    
    return {
      totalHoursWorked,
      totalExtraHours,
      totalExtraHoursWithFactor
    };
  }, [calculateHoursWorked]);

  // Check for backup reminder
  useEffect(() => {
    if (!currentUser) return;
    
    const lastBackup = localStorage.getItem('lastBackupDate');
    const dismissedReminder = localStorage.getItem('dismissedBackupReminder');
    const reminderDate = localStorage.getItem('backupReminderDate');
    
    if (dismissedReminder === 'true') return;
    
    // If there's a reminder date set, check if it's time to show the modal again
    if (reminderDate) {
      const today = new Date();
      const reminderDateTime = new Date(reminderDate);
      
      if (today >= reminderDateTime) {
        // Clear the reminder date and show the modal
        localStorage.removeItem('backupReminderDate');
        setShowBackupReminder(true);
      }
      return;
    }
    
    const today = new Date();
    
    if (!lastBackup) {
      if (timeEntryContext.entries.length > 0) {
        const oldestEntry = timeEntryContext.entries.sort((a, b) => a.date.localeCompare(b.date))[0];
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
  }, [currentUser, timeEntryContext.entries.length]);

  // Migration effect - add calculated fields to entries
  useEffect(() => {
    if (!currentUser || !isContextReady || timeEntryContext.entries.length === 0) return;
    if (migrationRef.current) return;
    
    const needsMigration = timeEntryContext.entries.some(e => 
      e.hoursWorked === undefined || 
      e.extraHours === undefined ||
      e.hoursSpentOutside === undefined
    );
    
    if (needsMigration) {
      migrationRef.current = true;
      
      // Defer heavy migration calculations to improve startup performance
      const runMigration = () => {
        const migratedEntries = timeEntryContext.entries.map(entry => {
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
        
        timeEntryContext.setEntries(migratedEntries);
        
        setTimeout(() => {
          migrationRef.current = false;
        }, 100);
      };

      // Use requestIdleCallback or fallback to setTimeout for better startup performance
      if (window.requestIdleCallback) {
        window.requestIdleCallback(runMigration, { timeout: 2000 });
      } else {
        setTimeout(runMigration, 0);
      }
    }
  }, [timeEntryContext.entries.length, currentUser, isContextReady, calculateHoursWorked, calculateHoursSpentOutside]);

  // Initialize context when user is authenticated
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      setIsContextReady(true);
    } else {
      setIsContextReady(false);
    }
  }, [isAuthenticated, currentUser]);

  // Initialize background sync
  useEffect(() => {
    const initTimer = setTimeout(() => {
      backgroundSync.init().catch(error => {
        console.warn('Background sync init failed:', error);
      });
    }, 1000);
    return () => clearTimeout(initTimer);
  }, []);

  // Backup handlers
  const handleBackupNow = useCallback(() => {
    localStorage.setItem('lastBackupDate', new Date().toISOString());
    setShowBackupReminder(false);
    showAlert('Backup completed successfully!', 'success');
  }, [showAlert]);

  const handleBackupLater = useCallback((days) => {
    // Set a reminder date for when to show the modal again
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + days);
    localStorage.setItem('backupReminderDate', reminderDate.toISOString());
    setShowBackupReminder(false);
  }, []);

  const handleDismissBackup = useCallback(() => {
    setShowBackupReminder(false);
    localStorage.setItem('dismissedBackupReminder', 'true');
  }, []);

  const handleCloseBackup = useCallback(() => {
    setShowBackupReminder(false);
  }, []);

  const recalculateEntryFields = useCallback((entry) => {
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
    }, [calculateHoursWorked, calculateHoursSpentOutside]);
  
    const updateEntry = useCallback(async (date, updates) => {
      let changedEntry = null;
      const updatedEntries = timeEntryContext.entries.map(entry => {
        if (entry.date === date) {
          // Normalize intervals to ensure proper time format
          const normalizedUpdates = { ...updates };
          if (updates.intervals) {
            normalizedUpdates.intervals = updates.intervals.map(interval => ({
              ...interval,
              in: interval.in ? ensureTimeSeconds(interval.in) : null,
              out: interval.out ? ensureTimeSeconds(interval.out) : null
            }));
          }
          
          const updatedEntry = {
            ...entry,
            ...normalizedUpdates,
            lastModified: new Date().toISOString()
          };
          changedEntry = recalculateEntryFields(updatedEntry);
          return changedEntry;
        }
        return entry;
      });
      
      // Update entries locally first
      timeEntryContext.setEntries(updatedEntries);
      
      // Immediately save to storage with retry logic
      if (changedEntry) {
        const saveResult = await timeEntryContext.saveTimeEntriesData(changedEntry, showAlert);
        
        // Provide feedback for save failures
        if (!saveResult.success && saveResult.savedTo === 'local') {
          console.warn('Entry saved locally only due to connection issues');
        }
      }
    }, [timeEntryContext, recalculateEntryFields, showAlert, ensureTimeSeconds]);
  
    // Combine all context values
    const contextValue = useMemo(() => ({
      // From TimeEntryContext
      ...timeEntryContext,
      
      // From UserPreferencesContext
      ...userPreferencesContext,
      
      // From PayPeriodContext
      ...payPeriodContext,
      
      // TimeTracker specific functionality

      checkIn,
      checkOut,
      updateEntry,
      calculateOvertimeDetails,
      calculateHoursWorked,
      calculateHoursSpentOutside,
      timeToSeconds,
      secondsToTime,
      secondsToHours,
      formatTimeDisplay,
      ensureTimeSeconds,
      
      // State management
      isContextReady,
      showAlert,
      
      // Modal state
      confirmModal,
      setConfirmModal,
      alertModal,
      setAlertModal,
      showBackupReminder,
      setShowBackupReminder,
      
      // Backup handlers
      handleBackupNow,
      handleBackupLater,
      handleDismissBackup,
      handleCloseBackup
    }), [
      timeEntryContext,
      userPreferencesContext,
      payPeriodContext,
      checkIn,
      checkOut,
      updateEntry,
      calculateOvertimeDetails,
      calculateHoursWorked,
      calculateHoursSpentOutside,
      timeToSeconds,
      secondsToTime,
      secondsToHours,
      formatTimeDisplay,
      ensureTimeSeconds,
      isContextReady,
      showAlert,
      confirmModal,
      alertModal,
      showBackupReminder,
      handleBackupNow,
      handleBackupLater,
      handleDismissBackup,
      handleCloseBackup
    ]);
  
    return (
      <TimeTrackerContext.Provider value={contextValue}>
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
        <Suspense fallback={<div className="modal-loading-overlay">Loading...</div>}>
          <BackupReminderModal
            isOpen={showBackupReminder}
            onExport={handleBackupNow}
            onRemindLater={handleBackupLater}
            onDismiss={handleDismissBackup}
            onClose={handleCloseBackup}
          />
        </Suspense>
        <AlertModal
          isOpen={alertModal.isOpen}
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => setAlertModal({ isOpen: false, message: '', type: 'info' })}
        />
      </TimeTrackerContext.Provider>
    );
  };
