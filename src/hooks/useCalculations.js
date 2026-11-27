import { useCallback } from 'react';
import { isWorkedDay } from '../utils/entryType.js';
import { parseIntervals } from '../utils/timeEntrySyncPlanner.js';

export const timeToSeconds = (timeStr) => {
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

export const secondsToHours = (seconds) => seconds / 3600;

// Helper function to validate interval structure
export const validateIntervalStructure = (intervals) => {
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

// Helper to extract breaks from intervals (supports both sequential work sessions and legacy nested format)
export function extractBreaksFromIntervals(rawIntervals) {
  const intervals = parseIntervals(rawIntervals);
  if (intervals.length <= 1) return [];

  // Check if legacy nested format where interval[1] is inside interval[0]
  if (
    intervals[0]?.out &&
    intervals[1]?.in &&
    timeToSeconds(intervals[1].in) < timeToSeconds(intervals[0].out)
  ) {
    return intervals.slice(1).filter((b) => b?.in && b?.out);
  }

  // Sequential work sessions: breaks are gaps between sessions
  const breaks = [];
  for (let i = 0; i < intervals.length - 1; i++) {
    const prevOut = intervals[i]?.out;
    const nextIn = intervals[i + 1]?.in;
    if (prevOut && nextIn && timeToSeconds(nextIn) > timeToSeconds(prevOut)) {
      breaks.push({ in: prevOut, out: nextIn });
    }
  }
  return breaks;
}

// Helper to apply/insert a break into work intervals
export function applyBreakToIntervals(intervals, breakStart, breakEnd) {
  if (!Array.isArray(intervals) || intervals.length === 0) {
    return [{ in: breakEnd, out: null }];
  }

  const breakStartSec = timeToSeconds(breakStart);
  const breakEndSec = timeToSeconds(breakEnd);

  const newIntervals = [];
  let breakApplied = false;

  for (const interval of intervals) {
    const inSec = interval.in ? timeToSeconds(interval.in) : 0;
    const outSec = interval.out ? timeToSeconds(interval.out) : Infinity;

    if (!breakApplied && inSec <= breakStartSec && breakEndSec <= outSec) {
      newIntervals.push({ ...interval, out: breakStart });
      newIntervals.push({ ...interval, in: breakEnd, out: interval.out || null });
      breakApplied = true;
    } else if (!breakApplied && inSec <= breakStartSec && interval.out === null) {
      newIntervals.push({ ...interval, out: breakStart });
      newIntervals.push({ ...interval, in: breakEnd, out: null });
      breakApplied = true;
    } else {
      newIntervals.push(interval);
    }
  }

  if (!breakApplied) {
    newIntervals.length = 0;
    intervals.forEach((i) => {
      const inSec = timeToSeconds(i.in);
      const outSec = i.out ? timeToSeconds(i.out) : Infinity;
      if (outSec <= breakStartSec) {
        newIntervals.push(i);
      } else if (inSec >= breakEndSec) {
        newIntervals.push(i);
      } else {
        if (inSec < breakStartSec) newIntervals.push({ ...i, out: breakStart });
        if (outSec > breakEndSec) newIntervals.push({ ...i, in: breakEnd, out: i.out || null });
      }
    });
    if (newIntervals.length === 0) {
      newIntervals.push({ in: breakEnd, out: null });
    }
  }

  return newIntervals;
}

export function calculateHoursWorkedFromIntervals(rawIntervals, breakStartTimeStr = "13:00") {
  const intervals = parseIntervals(rawIntervals);
  if (intervals.length === 0) return 0;

  const hasIncompleteInterval = intervals.some(interval =>
    !interval.in || !interval.out
  );
  if (hasIncompleteInterval) return 0;

  const sorted = [...intervals].sort((a, b) => timeToSeconds(a.in) - timeToSeconds(b.in));

  // Check if legacy nested format: intervals[1].in < intervals[0].out
  const isLegacyNested = sorted.length > 1 &&
    sorted[0].out &&
    sorted[1].in &&
    timeToSeconds(sorted[1].in) < timeToSeconds(sorted[0].out);

  if (isLegacyNested) {
    const workInterval = sorted[0];
    const workStartSeconds = timeToSeconds(workInterval.in);
    const workEndSeconds = timeToSeconds(workInterval.out);
    const workDuration = workEndSeconds - workStartSeconds;

    if (workDuration <= 0 || workDuration > 24 * 3600) return 0;

    let totalBreakSeconds = 0;
    const allowedBreakStart = timeToSeconds(breakStartTimeStr);
    const allowedBreakEnd = allowedBreakStart + 30 * 60;

    for (let i = 1; i < sorted.length; i++) {
      const breakInterval = sorted[i];
      if (breakInterval.in && breakInterval.out) {
        const breakStartSeconds = timeToSeconds(breakInterval.in);
        const breakEndSeconds = timeToSeconds(breakInterval.out);
        const breakDuration = breakEndSeconds - breakStartSeconds;

        if (breakDuration > 0 && breakDuration <= 2 * 3600) {
          const isAllowedBreak =
            breakStartSeconds >= allowedBreakStart &&
            breakStartSeconds <= allowedBreakEnd &&
            breakEndSeconds >= allowedBreakStart &&
            breakEndSeconds <= allowedBreakEnd;

          if (!isAllowedBreak) {
            totalBreakSeconds += breakDuration;
          }
        }
      }
    }

    return secondsToHours(Math.max(0, workDuration - totalBreakSeconds));
  }

  // Standard sequential work sessions: sum of completed sessions + paid allowed break window
  const allowedBreakStart = timeToSeconds(breakStartTimeStr);
  const allowedBreakEnd = allowedBreakStart + 30 * 60;
  let totalWorkSeconds = 0;
  for (const interval of sorted) {
    const inSec = timeToSeconds(interval.in);
    const outSec = timeToSeconds(interval.out);
    const dur = outSec - inSec;
    if (dur > 0 && dur <= 24 * 3600) {
      totalWorkSeconds += dur;
    }
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStart = timeToSeconds(sorted[i].out);
    const gapEnd = timeToSeconds(sorted[i + 1].in);
    const gapDuration = gapEnd - gapStart;

    if (gapDuration > 0 && gapDuration <= 2 * 3600) {
      const isAllowedBreak =
        gapStart >= allowedBreakStart &&
        gapStart <= allowedBreakEnd &&
        gapEnd >= allowedBreakStart &&
        gapEnd <= allowedBreakEnd;

      if (isAllowedBreak) {
        totalWorkSeconds += gapDuration;
      }
    }
  }

  return secondsToHours(totalWorkSeconds);
}

export function calculateHoursSpentOutsideFromIntervals(rawIntervals, breakStartTimeStr = "13:00") {
  const intervals = parseIntervals(rawIntervals);
  if (intervals.length < 2) return 0;

  const allowedBreakStart = timeToSeconds(breakStartTimeStr);
  const allowedBreakEnd = allowedBreakStart + 30 * 60;

  // Check if legacy nested format
  const isLegacyNested = intervals[0]?.out && intervals[1]?.in &&
    timeToSeconds(intervals[1].in) < timeToSeconds(intervals[0].out);

  if (isLegacyNested) {
    const breakIntervals = intervals.slice(1);
    let hoursSpentOutside = 0;

    breakIntervals.forEach(interval => {
      if (interval.in && interval.out) {
        const breakStartSeconds = timeToSeconds(interval.in);
        const breakEndSeconds = timeToSeconds(interval.out);
        const breakDuration = breakEndSeconds - breakStartSeconds;

        if (breakDuration > 0 && breakDuration <= 2 * 3600) {
          const isAllowedBreak =
            breakStartSeconds >= allowedBreakStart &&
            breakStartSeconds <= allowedBreakEnd &&
            breakEndSeconds >= allowedBreakStart &&
            breakEndSeconds <= allowedBreakEnd;

          if (!isAllowedBreak) {
            hoursSpentOutside += secondsToHours(breakDuration);
          }
        }
      }
    });

    return hoursSpentOutside;
  }

  // Sequential work sessions: check gaps between sessions (including before an open session)
  let totalOutsideSeconds = 0;
  const sorted = [...intervals].filter(i => i?.in).sort((a, b) => timeToSeconds(a.in) - timeToSeconds(b.in));

  for (let i = 0; i < sorted.length - 1; i++) {
    if (!sorted[i].out || !sorted[i + 1].in) continue;
    const gapStart = timeToSeconds(sorted[i].out);
    const gapEnd = timeToSeconds(sorted[i + 1].in);
    const gapDuration = gapEnd - gapStart;

    if (gapDuration > 0) {
      const isAllowedBreak =
        gapStart >= allowedBreakStart &&
        gapStart <= allowedBreakEnd &&
        gapEnd >= allowedBreakStart &&
        gapEnd <= allowedBreakEnd;

      if (!isAllowedBreak) {
        totalOutsideSeconds += gapDuration;
      }
    }
  }

  return secondsToHours(totalOutsideSeconds);
}

export function calculateOvertimeDetailsForEntries(entries, periodStart, periodEnd, breakStartTimeStr = "13:00") {
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
    const intervals = parseIntervals(entry.intervals);
    if (isWorkedDay(entry) && intervals.length > 0) {
      const isComplete = intervals.every(interval => interval.in && interval.out);
      if (!isComplete) return;

      const hoursWorked = calculateHoursWorkedFromIntervals(intervals, breakStartTimeStr);
      totalHoursWorked += hoursWorked;

      const dayOfWeek = new Date(entry.date).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const standardHours = isWeekend ? 0 : 9;

      const extraHours = hoursWorked - standardHours;
      const useDoubleFactor = isWeekend || entry.type === 'Holiday' || entry.type === 'Vacation';
      const factor = useDoubleFactor ? 2 : 1.5;
      const extraHoursWithFactor = extraHours > 0 ? parseFloat((extraHours * factor).toFixed(4)) : extraHours;

      totalExtraHours += extraHours;
      totalExtraHoursWithFactor += extraHoursWithFactor;
    }
  });

  return { totalHoursWorked, totalExtraHours, totalExtraHoursWithFactor };
}

export function useCalculations(breakStartTimeStr = "13:00") {
  // Calculate total work time: first interval is work, rest are breaks
  const calculateHoursWorked = useCallback((intervals, date) => {
    return calculateHoursWorkedFromIntervals(intervals, breakStartTimeStr);
  }, [breakStartTimeStr]);

  const calculateHoursSpentOutside = useCallback((intervals) => {
    return calculateHoursSpentOutsideFromIntervals(intervals, breakStartTimeStr);
  }, [breakStartTimeStr]);

  const calculateOvertimeDetails = useCallback((entries, periodStart, periodEnd) => {
    return calculateOvertimeDetailsForEntries(entries, periodStart, periodEnd, breakStartTimeStr);
  }, [breakStartTimeStr]);

  return { calculateHoursWorked, calculateHoursSpentOutside, calculateOvertimeDetails, timeToSeconds, secondsToHours };
}
