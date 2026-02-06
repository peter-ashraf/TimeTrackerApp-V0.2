import { useCallback } from 'react';

// Constants for break time validation
const ALLOWED_BREAK_START = 13 * 3600; // 13:00:00
const ALLOWED_BREAK_END = 13 * 3600 + 30 * 60; // 13:30:00

const timeToSeconds = (timeStr) => {
  if (!timeStr || timeStr.trim() === '') return 0;
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 3600 + parts[1] * 60;
  }
  return 0;
};

const secondsToHours = (seconds) => seconds / 3600;

// Helper function to validate interval structure
const validateIntervalStructure = (intervals) => {
  if (!intervals || intervals.length === 0) return false;
  
  // Check if intervals follow expected pattern: work, break, work, break...
  // Even indices (0, 2, 4...) should be work periods
  // Odd indices (1, 3, 5...) should be break periods
  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    if (!interval.in || !interval.out) return false;
    
    const isBreakPeriod = i % 2 === 1;
    
    // Basic validation: break periods shouldn't be excessively long (more than 2 hours)
    if (isBreakPeriod) {
      const breakStartSeconds = timeToSeconds(interval.in);
      const breakEndSeconds = timeToSeconds(interval.out);
      const breakDuration = breakEndSeconds - breakStartSeconds;
      
      // Validate break duration is positive and reasonable
      if (breakDuration <= 0 || breakDuration > 2 * 3600) return false;
    }
  }
  
  return true;
};

export function useCalculations() {
  // Calculate total work time: first interval is work, rest are breaks
  const calculateHoursWorked = useCallback((intervals, date) => {
    if (!intervals || intervals.length === 0) return 0;
    
    // Check if any interval is incomplete (missing in or out)
    const hasIncompleteInterval = intervals.some(interval => 
      !interval.in || !interval.out
    );
    if (hasIncompleteInterval) return 0;
    
    // First interval is the main work period
    const workInterval = intervals[0];
    if (!workInterval.in || !workInterval.out) return 0;
    
    const workStartSeconds = timeToSeconds(workInterval.in);
    const workEndSeconds = timeToSeconds(workInterval.out);
    const workDuration = workEndSeconds - workStartSeconds;
    
    // Validate work duration
    if (workDuration <= 0 || workDuration > 24 * 3600) return 0;
    
    // Subtract break durations (all other intervals are breaks)
    let totalBreakSeconds = 0;
    for (let i = 1; i < intervals.length; i++) {
      const breakInterval = intervals[i];
      if (breakInterval.in && breakInterval.out) {
        const breakStartSeconds = timeToSeconds(breakInterval.in);
        const breakEndSeconds = timeToSeconds(breakInterval.out);
        const breakDuration = breakEndSeconds - breakStartSeconds;
        
        // Validate break duration
        if (breakDuration > 0 && breakDuration <= 2 * 3600) {
          totalBreakSeconds += breakDuration;
        }
      }
    }
    
    // Return net work time (work minus breaks)
    return secondsToHours(Math.max(0, workDuration - totalBreakSeconds));
  }, []);

  const calculateHoursSpentOutside = useCallback((intervals) => {
    if (!intervals || intervals.length < 2) return 0;
    
    const breakIntervals = intervals.slice(1);
    let hoursSpentOutside = 0;
    
    breakIntervals.forEach(interval => {
      if (interval.in && interval.out) {
        const breakStartSeconds = timeToSeconds(interval.in);
        const breakEndSeconds = timeToSeconds(interval.out);
        const breakDuration = breakEndSeconds - breakStartSeconds;
        
        // Validate that break duration is positive and reasonable
        if (breakDuration > 0 && breakDuration <= 2 * 3600) { // Max 2 hours
          const isAllowedBreak =
            breakStartSeconds >= ALLOWED_BREAK_START &&
            breakStartSeconds <= ALLOWED_BREAK_END &&
            breakEndSeconds >= ALLOWED_BREAK_START &&
            breakEndSeconds <= ALLOWED_BREAK_END;
          
          if (!isAllowedBreak) {
            hoursSpentOutside += secondsToHours(breakDuration);
          }
        }
      }
    });
    
    return hoursSpentOutside;
  }, []);

  const calculateOvertimeDetails = useCallback((entries, periodStart, periodEnd) => {
    if (!entries || entries.length === 0) {
      return { totalHoursWorked: 0, totalExtraHours: 0, totalExtraHoursWithFactor: 0 };
    }
    
    const periodEntries = entries.filter(e => 
      e.date >= periodStart && e.date <= periodEnd
    );
    
    
    
    let totalHoursWorked = 0;
    let totalExtraHours = 0;
    let totalExtraHoursWithFactor = 0;
    
    periodEntries.forEach(entry => {
      if (entry.type === 'Regular' && entry.intervals) {
        // Check if entry is complete (all intervals have in and out)
        const isComplete = entry.intervals.every(interval => interval.in && interval.out);
        
        
        
        // Skip incomplete entries
        if (!isComplete) return;
        
        // Use same calculation as Timesheet
        const hoursWorked = calculateHoursWorked(entry.intervals, entry.date);
        
        // hoursWorked is already net (work minus breaks), use it directly
        totalHoursWorked += hoursWorked;
        
        const dayOfWeek = new Date(entry.date).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const standardHours = isWeekend ? 0 : 9;
        
        const extraHours = hoursWorked - standardHours;
        const useDoubleFactor = isWeekend || entry.type === 'Holiday' || entry.type === 'Vacation';
        const factor = useDoubleFactor ? 2 : 1.5;
        // Match Excel logic: only apply factor to positive extra hours
        const extraHoursWithFactor = extraHours > 0 ? parseFloat((extraHours * factor).toFixed(4)) : extraHours;
        
        
        
        totalExtraHours += extraHours;
        totalExtraHoursWithFactor += extraHoursWithFactor;
      }
    });
    
    
    
    return { totalHoursWorked, totalExtraHours, totalExtraHoursWithFactor };
  }, [calculateHoursWorked]);

  return { calculateHoursWorked, calculateHoursSpentOutside, calculateOvertimeDetails, timeToSeconds, secondsToHours };
}
