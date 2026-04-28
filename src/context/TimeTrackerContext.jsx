import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';
import { useSupabaseAuth } from './SupabaseAuthContext';
import { supabase } from './SupabaseAuthContext';
import { supabaseData } from '../utils/supabaseData';
import { dataMigration } from '../utils/dataMigration';
import { backgroundSync } from '../utils/backgroundSync';
import { useTimeEntry } from './TimeEntryContext';
import { useUserPreferences } from './UserPreferencesContext';
import { usePayPeriod } from './PayPeriodContext';
import { setSimpleEncryptedItem, getSimpleEncryptedItem } from '../utils/simple-encryption';

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

  const timeEntryContext = useTimeEntry();
  const userPreferencesContext = useUserPreferences();
  const payPeriodContext = usePayPeriod();

  const [isContextReady, setIsContextReady] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null
  });

  const [showBackupReminder, setShowBackupReminder] = useState(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, message: '', type: 'info' });

  const migrationRef = useRef(false);
  const backupCheckedUserRef = useRef(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      // Tab visibility change handled
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const showAlert = useCallback((message, type = 'info') => {
    setAlertModal({ isOpen: true, message, type });
  }, []);

  const ensureTimeSeconds = useCallback((timeStr) => {
    if (!timeStr) return timeStr;
    return timeStr.split(':').length === 2 ? `${timeStr}:00` : timeStr;
  }, []);

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
    return `${timeStr}:00`;
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
    breakIntervals.forEach((interval) => {
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

  const checkIn = useCallback(async () => {
    if (!currentUser || !isAuthenticated) return;

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeString = ensureTimeSeconds(now.toTimeString().split(' ')[0]);

    try {
      const todayEntry = timeEntryContext.entries.find(e => e.date === today);

      if (todayEntry) {
        const hasActiveCheckIn = todayEntry.intervals &&
          todayEntry.intervals.length > 0 &&
          todayEntry.intervals.some(interval => interval.in && !interval.out);

        if (hasActiveCheckIn) {
          showAlert('You are already checked in!', 'warning');
          return;
        }

        const updatedEntry = { ...todayEntry };
        updatedEntry.intervals = [...updatedEntry.intervals, { in: timeString, out: null }];
        updatedEntry.lastModified = now.toISOString();

        const saveResult = await timeEntryContext.saveTimeEntriesData(updatedEntry, showAlert);

        if (saveResult.success) {
          showAlert('Successfully checked in!', 'success');
        } else if (saveResult.savedTo === 'local') {
          showAlert('Checked in (saved locally)', 'success');
        }
        return;
      }

      const newEntry = {
        date: today,
        intervals: [{ in: timeString, out: null }],
        type: 'Regular',
        lastModified: now.toISOString()
      };

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

  const checkOut = useCallback(async () => {
    if (!currentUser || !isAuthenticated) return;

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeString = ensureTimeSeconds(now.toTimeString().split(' ')[0]);

    try {
      const todayEntry = timeEntryContext.entries.find(e => e.date === today);
      if (!todayEntry) {
        showAlert('No check-in found for today', 'error');
        return;
      }

      // Immutable update of intervals
      const updatedIntervals = todayEntry.intervals.map((interval, index) => {
        if (index === todayEntry.intervals.length - 1 && !interval.out) {
          return { ...interval, out: timeString };
        }
        return interval;
      });

      const updatedEntry = {
        ...todayEntry,
        intervals: updatedIntervals,
        lastModified: now.toISOString()
      };

      // Recalculate computed fields now that checkout time is set
      const recalculated = recalculateEntryFields(updatedEntry);

      const saveResult = await timeEntryContext.saveTimeEntriesData(recalculated, showAlert);

      if (saveResult.success) {
        showAlert('Successfully checked out!', 'success');
      } else if (saveResult.savedTo === 'local') {
        showAlert('Checked out (saved locally)', 'success');
      }
    } catch (error) {
      console.error('Check-out failed:', error);
      showAlert('Failed to check out. Please try again.', 'error');
    }
  }, [currentUser, isAuthenticated, timeEntryContext, showAlert, ensureTimeSeconds, recalculateEntryFields]);

  const calculateOvertimeDetails = useCallback((entries, periodStart, periodEnd) => {
    const periodEntries = entries.filter(e =>
      e.date >= periodStart &&
      e.date <= periodEnd
    );

    let totalHoursWorked = 0;
    let totalExtraHours = 0;
    let totalExtraHoursWithFactor = 0;

    periodEntries.forEach((entry) => {
      if (!entry.intervals || entry.intervals.length === 0) {
        return;
      }

      const allComplete = entry.intervals.every(interval => interval.in && interval.out);
      if (!allComplete) {
        return;
      }

      let actualHours, extraHours, extraHoursWithFactor;

      // Always recalculate from intervals to avoid stale pre-computed values
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

  useEffect(() => {
    if (!currentUser) {
      backupCheckedUserRef.current = null;
      return;
    }

    if (backupCheckedUserRef.current === currentUser.id) return;
    if (timeEntryContext.entries.length === 0) return; // Wait to have entries before evaluating

    // Setting the ref so it only evaluates once per user session
    backupCheckedUserRef.current = currentUser.id;

    const lastBackup = localStorage.getItem('lastBackupDate');
    const dismissedReminder = localStorage.getItem('dismissedBackupReminder');
    const reminderDate = localStorage.getItem('backupReminderDate');

    if (dismissedReminder === 'true') return;

    if (reminderDate) {
      const today = new Date();
      const reminderDateTime = new Date(reminderDate);

      if (today >= reminderDateTime) {
        localStorage.removeItem('backupReminderDate');
        setShowBackupReminder(true);
      }
      return;
    }

    const today = new Date();

    if (!lastBackup) {
      if (timeEntryContext.entries.length > 0) {
        const oldestEntry = [...timeEntryContext.entries].sort((a, b) => a.date.localeCompare(b.date))[0];
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
  }, [currentUser, timeEntryContext.entries]);

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
            ...entry,
            id: entry.id ?? null,
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

      if (window.requestIdleCallback) {
        window.requestIdleCallback(runMigration, { timeout: 2000 });
      } else {
        setTimeout(runMigration, 0);
      }
    }
  }, [timeEntryContext.entries, currentUser, isContextReady, calculateHoursWorked, calculateHoursSpentOutside, timeEntryContext]);

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      setIsContextReady(true);
    } else {
      setIsContextReady(false);
    }
  }, [isAuthenticated, currentUser]);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      backgroundSync.init().catch(error => {
        console.warn('Background sync init failed:', error);
      });
    }, 1000);
    return () => clearTimeout(initTimer);
  }, []);

  const handleBackupNow = useCallback(() => {
    localStorage.setItem('lastBackupDate', new Date().toISOString());
    setShowBackupReminder(false);
    showAlert('Backup completed successfully!', 'success');
  }, [showAlert]);

  const handleBackupLater = useCallback((days) => {
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

  const updateEntry = useCallback(async (date, updates) => {
    if (!date || !updates) return;

    try {
      const existingEntry = timeEntryContext.entries.find(e => e.date === date);
      if (!existingEntry) {
        console.log('[Update] Entry not found for date:', date);
        return;
      }

      let normalizedUpdates = { ...updates };
      if (updates.intervals) {
        normalizedUpdates.intervals = updates.intervals.map(interval => ({
          ...interval,
          in: interval.in ? ensureTimeSeconds(interval.in) : null,
          out: interval.out ? ensureTimeSeconds(interval.out) : null
        }));
      }

      const updatedEntry = {
        ...existingEntry,
        ...normalizedUpdates,
        lastModified: new Date().toISOString()
      };

      await timeEntryContext.saveTimeEntriesData(updatedEntry, showAlert);
    } catch (error) {
      console.error('Error updating entry:', error);
      showAlert('Failed to update entry', 'error');
    }
  }, [timeEntryContext, ensureTimeSeconds, showAlert]);

  const deleteEntry = useCallback(async (date) => {
    if (!date) return;

    if (window._deletingEntry === date) {
      console.warn('[Delete] Delete guard already active for:', date);
      return;
    }

    window._deletingEntry = date;

    setConfirmModal({
      isOpen: true,
      title: '⚠️ Confirm Delete Entry',
      message: `Are you sure you want to delete the entry for ${date}? This action cannot be undone and will remove the entry from the database.`,
      type: 'warning',
      confirmText: 'Delete Entry',
      cancelText: 'Cancel',
      showCancel: true,
      onConfirm: async () => {
        try {
          const entryToDelete = timeEntryContext.entries.find(entry => entry.date === date);

          if (!entryToDelete) {
            console.error('[Delete] Entry not found in local state for date:', date);
            showAlert('Entry not found', 'error');
            return;
          }

          if (navigator.onLine && currentUser && !currentUser.isLocalOnly) {
            try {
              let deleteSuccess = false;
              let lastError = null;

              for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                  let entryId = entryToDelete?.id ?? null;

                  if (!entryId && currentUser?.id && date) {
                    console.warn('[Delete] Entry id missing locally, resolving from server for date:', date);

                    try {
                      let resolveToken = null;
                      for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (k && k.includes('auth-token')) {
                          const raw = localStorage.getItem(k);
                          const parsed = raw ? JSON.parse(raw) : null;
                          if (parsed?.access_token) { resolveToken = parsed.access_token; break; }
                        }
                      }

                      if (resolveToken) {
                        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
                        const resolveRes = await fetch(
                          `${supabaseUrl}/rest/v1/time_entries?user_id=eq.${currentUser.id}&date=eq.${date}&select=id`,
                          {
                            headers: {
                              'apikey': supabaseKey,
                              'Authorization': `Bearer ${resolveToken}`
                            }
                          }
                        );
                        const resolveData = await resolveRes.json();
                        entryId = resolveData?.[0]?.id ?? null;
                      }
                    } catch (resolveError) {
                      console.error('[Delete] Failed to resolve entry id before delete:', resolveError);
                    }
                  }

                  const result = await supabaseData.deleteTimeEntry({
                    id: entryId,
                    userId: currentUser.id,
                    date
                  });

                  if (result?.success) {
                    timeEntryContext.setEntries(prev => prev.filter(e => e.date !== date));

                    const entriesKey = `timeEntries_${currentUser.id}`;
                    const currentEntries = getSimpleEncryptedItem(entriesKey, currentUser.username) || [];
                    setSimpleEncryptedItem(
                      entriesKey,
                      currentEntries.filter(e => e.date !== date),
                      currentUser.username
                    );

                    deleteSuccess = true;
                    break;
                  } else if (result?.reason === 'missing_id') {
                    showAlert('Delete failed because this entry lost its database ID. Please refresh and try again.', 'error');
                    break;
                  } else if (result?.reason === 'no_auth_token') {
                    showAlert('Delete failed: session expired. Please refresh the page and try again.', 'error');
                    break;
                  } else if (result?.reason === 'fetch_error') {
                    if (attempt < 2) {
                      console.warn('[Delete] Attempt', attempt, 'timed out, retrying...');
                      showAlert('Delete failed. Retrying automatically...', 'warning');
                      await new Promise(resolve => setTimeout(resolve, 4000));
                    } else {
                      showAlert('Delete failed after retry. Please try again.', 'error');
                      break;
                    }
                  } else if (result?.reason === 'timeout_or_permission') {
                    if (attempt < 2) {
                      showAlert('Delete timed out after tab switch. Retrying automatically...', 'warning');
                      console.warn('[Delete] Attempt', attempt, 'timed out, retrying...');
                      await new Promise(resolve => setTimeout(resolve, 4000));
                    } else {
                      showAlert(
                        'Delete failed after retry. Please try again.',
                        'error'
                      );
                      break;
                    }
                  } else {
                    showAlert('Delete failed. Entry was not removed. Please try again.', 'error');
                    break;
                  }
                } catch (attemptError) {
                  console.error('[Delete] Error:', attemptError);
                  lastError = attemptError;

                  if (
                    attemptError.message?.includes('timeout') ||
                    attemptError.message?.includes('not found') ||
                    attemptError.code === 'PGRST116'
                  ) {
                    break;
                  }

                  if (attempt < 2) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                }
              }

              if (deleteSuccess) {
                showAlert('Entry deleted successfully from database', 'success');
              } else if (lastError) {
                console.error('[Delete] Failed after all attempts for date:', date);
                showAlert('Delete failed. Entry was kept locally.', 'error');
              }
            } catch (supabaseError) {
              console.error('[Delete] Error:', supabaseError);
              showAlert('Delete failed. Entry was kept locally.', 'error');
            }
          } else {
            console.warn('[Delete] Offline — delete blocked');
            showAlert('You are offline. Delete is disabled until connection is restored.', 'warning');
          }

          setConfirmModal({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });
        } catch (error) {
          console.error('[Delete] Error:', error);
          showAlert('Failed to delete entry', 'error');
          setConfirmModal({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });
        } finally {
          delete window._deletingEntry;
        }
      },
      onCancel: () => {
        setConfirmModal({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });
        delete window._deletingEntry;
      }
    });
  }, [timeEntryContext, currentUser, showAlert]);

  useEffect(() => {
    return () => {
      if (window._deletingEntry) {
        delete window._deletingEntry;
      }
    };
  }, []);

  const contextValue = useMemo(() => ({
    ...timeEntryContext,
    ...userPreferencesContext,
    ...payPeriodContext,
    checkIn,
    checkOut,
    updateEntry,
    deleteEntry,
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
    setConfirmModal,
    alertModal,
    setAlertModal,
    showBackupReminder,
    setShowBackupReminder,
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
    deleteEntry,
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
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
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
