import { useCallback } from 'react';

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

export function useCalculations() {
  const calculateHoursWorked = useCallback((intervals, date) => {
    if (!intervals || intervals.length === 0) return 0;
    
    let totalSeconds = 0;
    intervals.forEach(interval => {
      if (interval.in && interval.out) {
        const inSeconds = timeToSeconds(interval.in);
        const outSeconds = timeToSeconds(interval.out);
        if (outSeconds > inSeconds) {
          totalSeconds += outSeconds - inSeconds;
        }
      }
    });
    
    return secondsToHours(totalSeconds);
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
        const hoursWorked = calculateHoursWorked(entry.intervals, entry.date);
        totalHoursWorked += hoursWorked;
        
        const dayOfWeek = new Date(entry.date).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const standardHours = isWeekend ? 0 : 9;
        
        const extraHours = hoursWorked - standardHours;
        if (extraHours > 0) {
          totalExtraHours += extraHours;
          totalExtraHoursWithFactor += extraHours * 1.5;
        }
      }
    });
    
    return { totalHoursWorked, totalExtraHours, totalExtraHoursWithFactor };
  }, [calculateHoursWorked]);

  return { calculateHoursWorked, calculateOvertimeDetails, timeToSeconds, secondsToHours };
}
