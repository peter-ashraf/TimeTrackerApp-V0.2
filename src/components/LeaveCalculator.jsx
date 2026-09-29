import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import ModalShell from './ModalShell';
import '../styles/leave-calculator.css';
import CustomSelect from './CustomSelect';

const LeaveCalculator = ({ selectedDate, onClose }) => {
  const { entries, employee, getCurrentPeriod, calculateOvertimeDetails } = useTimeTracker();

  const handleCancel = (e) => {
    const modal = e.target.closest('.bento-modal-overlay');
    if (modal) {
      modal.classList.add('closing');
      const content = modal.querySelector('.modal-content');
      if (content) content.classList.add('closing');
    }
    setTimeout(onClose, 350);
  };
  
  // Calculator mode: 'forward' (check-in + leave time → balance) or 'reverse' (overtime → leave time)
  const [calcMode, setCalcMode] = useState('forward');
  
  // Data loaded from existing records
  const [loadedCheckIn, setLoadedCheckIn] = useState(null);
  const [loadedBreakMinutes, setLoadedBreakMinutes] = useState(0);
  const [requiredDailyMinutes, setRequiredDailyMinutes] = useState(540); // Default 9 hours
  
  // User inputs
  const [checkInTime, setCheckInTime] = useState('');
  const [leaveTime, setLeaveTime] = useState('');
  const [overtimeAmount, setOvertimeAmount] = useState('');
  const [overtimeMode, setOvertimeMode] = useState('spend'); // 'spend' or 'keep'
  const [userBreakMinutes, setUserBreakMinutes] = useState(0);
  const [plannedBreakStartTime, setPlannedBreakStartTime] = useState('13:00');
  const [showBreakDetails, setShowBreakDetails] = useState(false);
  
  // Calculation results
  const [projectedWorkedMinutes, setProjectedWorkedMinutes] = useState(0);
  const [dailyBalanceMinutes, setDailyBalanceMinutes] = useState(0);
  const [currentTotalOvertimeMinutes, setCurrentTotalOvertimeMinutes] = useState(0);
  const [projectedTotalOvertimeMinutes, setProjectedTotalOvertimeMinutes] = useState(0);
  
  // Validation and UI state
  const [hasExistingCheckIn, setHasExistingCheckIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [validationError, setValidationError] = useState('');

  // Helper: Convert time string (HH:MM:SS or HH:MM) to minutes since midnight
  const timeToMinutes = useCallback((timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length >= 2) {
      let minutes = parts[0] * 60 + parts[1];
      if (parts.length >= 3 && !isNaN(parts[2])) {
        minutes += parts[2] / 60;
      }
      return minutes;
    }
    return 0;
  }, []);

  const allowedBreakStartMins = useMemo(() => employee?.breakStartTime ? timeToMinutes(employee.breakStartTime) : (13 * 60), [employee?.breakStartTime, timeToMinutes]);
  const allowedBreakEndMins = useMemo(() => allowedBreakStartMins + 30, [allowedBreakStartMins]);

  // Format time (HH:MM or HH:MM:SS) to 12-hour format string (e.g. "1:00 PM" or "1:00:30 PM")
  const formatTime12Hour = useCallback((timeStr) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    const seconds = parts[2] ? `:${parts[2]}` : '';
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')}${seconds} ${period}`;
  }, []);

  // Helper: Convert minutes to time string (HH:MM:SS)
  const minutesToTime = useCallback((minutes) => {
    if (minutes < 0) minutes = 0;
    const totalSeconds = Math.round(minutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  // Helper: Format minutes as hours and minutes (e.g., "2h 30m" or "-1h 15m")
  const formatMinutesAsHours = useCallback((minutes, showDecimal = false) => {
    const absMinutes = Math.abs(minutes);
    const roundedMinutes = Math.round(absMinutes);
    const hours = Math.floor(roundedMinutes / 60);
    const mins = roundedMinutes % 60;
    
    const sign = minutes < 0 && roundedMinutes > 0 ? '-' : '';
    
    let result = '';
    if (hours > 0 && mins > 0) {
      result = `${sign}${hours}h ${mins}m`;
    } else if (hours > 0) {
      result = `${sign}${hours}h`;
    } else {
      result = `${sign}${mins}m`;
    }
    
    if (showDecimal) {
      const decimalValue = minutes / 60;
      const decimalString = Math.abs(decimalValue).toFixed(2);
      const decSign = decimalValue < 0 ? '-' : '';
      result += ` (${decSign}${decimalString}h)`;
    }
    
    return result;
  }, []);

  // Calculate Exact Minimum Leave Time to fulfill the day
  const fulfillmentLeaveTime = useMemo(() => {
    const effectiveCheckIn = hasExistingCheckIn ? loadedCheckIn : checkInTime;
    if (!effectiveCheckIn) return null;

    const checkInMinutes = timeToMinutes(effectiveCheckIn);
    const plannedStartMins = timeToMinutes(plannedBreakStartTime);
    const plannedEndMins = plannedStartMins + (userBreakMinutes || 0);
    
    const isAllowedPlannedBreak =
      plannedStartMins >= allowedBreakStartMins &&
      plannedStartMins <= allowedBreakEndMins &&
      plannedEndMins >= allowedBreakStartMins &&
      plannedEndMins <= allowedBreakEndMins;
      
    const effectiveUserBreakMinutes = isAllowedPlannedBreak ? 0 : (userBreakMinutes || 0);

    const leaveMinutes = checkInMinutes + requiredDailyMinutes + effectiveUserBreakMinutes;
    return minutesToTime(leaveMinutes);
  }, [hasExistingCheckIn, loadedCheckIn, checkInTime, plannedBreakStartTime, userBreakMinutes, allowedBreakStartMins, allowedBreakEndMins, requiredDailyMinutes, timeToMinutes, minutesToTime]);

  // Load data when selected date changes
  useEffect(() => {
    if (!selectedDate) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    // Find existing entry for the selected date
    const existingEntry = entries.find(e => e.date === selectedDate);
    
    // Load check-in time if exists
    if (existingEntry?.intervals?.[0]?.in) {
      setLoadedCheckIn(existingEntry.intervals[0].in);
      setCheckInTime(existingEntry.intervals[0].in);
      setHasExistingCheckIn(true);
    } else {
      setLoadedCheckIn(null);
      setCheckInTime('');
      setHasExistingCheckIn(false);
    }
    
    // Load break duration from existing intervals
    let breakMinutes = 0;
    if (existingEntry?.intervals && existingEntry.intervals.length > 1) {
      // Calculate total break time from intervals after the first work interval
      for (let i = 1; i < existingEntry.intervals.length; i++) {
        const interval = existingEntry.intervals[i];
        if (interval.in && interval.out) {
          const inMins = timeToMinutes(interval.in);
          const outMins = timeToMinutes(interval.out);
          const isAllowedBreak = 
            inMins >= allowedBreakStartMins &&
            inMins <= allowedBreakEndMins &&
            outMins >= allowedBreakStartMins &&
            outMins <= allowedBreakEndMins;
            
          if (!isAllowedBreak) {
            breakMinutes += outMins - inMins;
          }
        }
      }
    }
    setLoadedBreakMinutes(breakMinutes);
    setUserBreakMinutes(breakMinutes);
    
    // Load required daily duration from employee settings
    // Support for: normal workdays, half-days, special schedules, days off, user-specific schedules
    const dayOfWeek = new Date(selectedDate).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    let dailyMinutes = 540; // Default 9 hours
    
    // Check for existing entry with special type (half-day, vacation, sick leave, holiday)
    if (existingEntry) {
      if (existingEntry.duration === 0.5) {
        // Half-day special entry
        dailyMinutes = 270; // 4.5 hours
      } else if (existingEntry.type === 'Holiday' || existingEntry.type === 'Vacation' || existingEntry.type === 'Sick Leave') {
        // Special day types - 0 required hours
        dailyMinutes = 0;
      }
    } else {
      // No existing entry, use employee settings
      if (employee.employeeType === 'part-time') {
        dailyMinutes = (employee.dailyHours || 8) * 60;
      } else if (employee.employeeType === 'full-time') {
        dailyMinutes = (employee.dailyHours || 9) * 60;
      }
      
      // Weekend has 0 required hours unless specified otherwise
      if (isWeekend && !employee.weekendWorkHours) {
        dailyMinutes = 0;
      }
    }
    
    setRequiredDailyMinutes(dailyMinutes);
    
    // Calculate current total overtime for the period (keep exact float for accuracy)
    const currentPeriod = getCurrentPeriod();
    if (currentPeriod && calculateOvertimeDetails) {
      const periodStart = currentPeriod.start_date || currentPeriod.start;
      const periodEnd = currentPeriod.end_date || currentPeriod.end;
      const overtimeDetails = calculateOvertimeDetails(entries, periodStart, periodEnd);
      // Keep as float minutes to avoid rounding issues that mismatch with the dashboard
      setCurrentTotalOvertimeMinutes(overtimeDetails.totalExtraHoursWithFactor * 60);
    } else {
      setCurrentTotalOvertimeMinutes(0);
    }
    
    // Reset calculations
    setProjectedWorkedMinutes(0);
    setDailyBalanceMinutes(0);
    setProjectedTotalOvertimeMinutes(0);
    setValidationError('');
    
    // Calculate effective user break minutes based on planned start time
    const plannedStartMins = timeToMinutes(plannedBreakStartTime);
    const plannedEndMins = plannedStartMins + userBreakMinutes;
    const isAllowedPlannedBreak =
      plannedStartMins >= allowedBreakStartMins &&
      plannedStartMins <= allowedBreakEndMins &&
      plannedEndMins >= allowedBreakStartMins &&
      plannedEndMins <= allowedBreakEndMins;
      
    const effectiveUserBreakMinutes = isAllowedPlannedBreak ? 0 : userBreakMinutes;
    
    setIsLoading(false);
  }, [selectedDate, entries, employee, timeToMinutes, getCurrentPeriod, calculateOvertimeDetails]);

  // Perform forward calculation
  const performForwardCalculation = useCallback(() => {
    setValidationError('');
    
    // Validate check-in time
    const effectiveCheckIn = hasExistingCheckIn ? loadedCheckIn : checkInTime;
    if (!effectiveCheckIn) {
      setValidationError('Check-in time is required');
      return;
    }
    
    // Validate leave time
    if (!leaveTime) {
      setValidationError('Leave time is required for forward calculation');
      return;
    }
    
    const checkInMinutes = timeToMinutes(effectiveCheckIn);
    const leaveMinutes = timeToMinutes(leaveTime);
    
    if (leaveMinutes <= checkInMinutes) {
      setValidationError('Leave time must be after check-in time');
      return;
    }
    
    // Calculate effective user break minutes based on planned start time
    const plannedStartMins = timeToMinutes(plannedBreakStartTime);
    const plannedEndMins = plannedStartMins + userBreakMinutes;
    const isAllowedPlannedBreak =
      plannedStartMins >= allowedBreakStartMins &&
      plannedStartMins <= allowedBreakEndMins &&
      plannedEndMins >= allowedBreakStartMins &&
      plannedEndMins <= allowedBreakEndMins;
      
    const effectiveUserBreakMinutes = isAllowedPlannedBreak ? 0 : userBreakMinutes;

    // Calculate projected worked minutes
    const workedMinutes = leaveMinutes - checkInMinutes - effectiveUserBreakMinutes;
    setProjectedWorkedMinutes(workedMinutes);
    
    // Calculate daily balance (integer minutes)
    const balanceMinutes = workedMinutes - requiredDailyMinutes;
    setDailyBalanceMinutes(balanceMinutes);
    
    // Calculate projected total overtime using the formula:
    // new_period_balance_minutes = current_period_balance_minutes - old_selected_day_contribution_minutes + new_daily_balance_minutes
    
    const existingEntry = entries.find(e => e.date === selectedDate);
    const dayOfWeek = new Date(selectedDate).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const entryType = existingEntry?.type || 'Regular';
    const useDoubleFactor = isWeekend || entryType === 'Holiday' || entryType === 'Vacation';
    const factor = useDoubleFactor ? 2 : 1.5;

    let oldDayContributionMinutes = 0;
    
    // Get old selected day contribution from raw storage (if complete entry exists)
    if (existingEntry && existingEntry.intervals?.[0]?.in && existingEntry.intervals?.[0]?.out) {
      // Calculate the existing entry's contribution using raw minute values
      const existingWorkMinutes = timeToMinutes(existingEntry.intervals[0].out) - timeToMinutes(existingEntry.intervals[0].in) - loadedBreakMinutes;
      const rawOldDayContribution = existingWorkMinutes - requiredDailyMinutes;
      oldDayContributionMinutes = rawOldDayContribution > 0 ? rawOldDayContribution * factor : rawOldDayContribution;
    }
    
    const factoredBalanceMinutes = balanceMinutes > 0 ? balanceMinutes * factor : balanceMinutes;
    
    // Apply formula: current - old + new
    const projectedTotal = currentTotalOvertimeMinutes - oldDayContributionMinutes + factoredBalanceMinutes;
    setProjectedTotalOvertimeMinutes(projectedTotal);
  }, [hasExistingCheckIn, loadedCheckIn, checkInTime, leaveTime, loadedBreakMinutes, userBreakMinutes, plannedBreakStartTime, requiredDailyMinutes, timeToMinutes, selectedDate, entries, currentTotalOvertimeMinutes]);

  // Perform reverse calculation
  const performReverseCalculation = useCallback(() => {
    setValidationError('');
    
    // Calculate effective user break minutes based on planned start time
    const plannedStartMins = timeToMinutes(plannedBreakStartTime);
    const plannedEndMins = plannedStartMins + userBreakMinutes;
    const isAllowedPlannedBreak =
      plannedStartMins >= allowedBreakStartMins &&
      plannedStartMins <= allowedBreakEndMins &&
      plannedEndMins >= allowedBreakStartMins &&
      plannedEndMins <= allowedBreakEndMins;
      
    const effectiveUserBreakMinutes = isAllowedPlannedBreak ? 0 : userBreakMinutes;
    
    // Validate check-in time
    const effectiveCheckIn = hasExistingCheckIn ? loadedCheckIn : checkInTime;
    if (!effectiveCheckIn) {
      setValidationError('Check-in time is required');
      return;
    }
    
    // Validate overtime amount
    if (!overtimeAmount || isNaN(parseFloat(overtimeAmount))) {
      setValidationError('Overtime amount is required');
      return;
    }
    
    const checkInMinutes = timeToMinutes(effectiveCheckIn);
    const targetEndingTotalMinutes = Math.round(parseFloat(overtimeAmount) * 60);
    
    let targetDailyContributionMinutes;
    
    if (overtimeMode === 'spend') {
      // Add to Required: target daily overtime is the user input
      targetDailyContributionMinutes = targetEndingTotalMinutes;
    } else {
      // Total Target: solve for daily contribution to achieve target period total
      // Formula: targetDailyContributionMinutes = targetEndingTotalMinutes - currentTotalBalanceMinutes + oldSelectedDayContributionMinutes
      
      // Get old selected day contribution from raw storage
      const existingEntry = entries.find(e => e.date === selectedDate);
      const dayOfWeek = new Date(selectedDate).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const entryType = existingEntry?.type || 'Regular';
      const useDoubleFactor = isWeekend || entryType === 'Holiday' || entryType === 'Vacation';
      const factor = useDoubleFactor ? 2 : 1.5;
      
      let oldDayContributionMinutes = 0;
      
      if (existingEntry && existingEntry.intervals?.[0]?.in && existingEntry.intervals?.[0]?.out) {
        const existingWorkMinutes = timeToMinutes(existingEntry.intervals[0].out) - timeToMinutes(existingEntry.intervals[0].in) - loadedBreakMinutes;
        const rawOldDayContribution = existingWorkMinutes - requiredDailyMinutes;
        oldDayContributionMinutes = rawOldDayContribution > 0 ? rawOldDayContribution * factor : rawOldDayContribution;
      }
      
      // Apply formula
      targetDailyContributionMinutes = targetEndingTotalMinutes - currentTotalOvertimeMinutes + oldDayContributionMinutes;
    }
    
    const dayOfWeek = new Date(selectedDate).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const existingEntry = entries.find(e => e.date === selectedDate);
    const entryType = existingEntry?.type || 'Regular';
    const useDoubleFactor = isWeekend || entryType === 'Holiday' || entryType === 'Vacation';
    const factor = useDoubleFactor ? 2 : 1.5;

    let rawDailyContributionMinutes = targetDailyContributionMinutes;
    if (targetDailyContributionMinutes > 0) {
      rawDailyContributionMinutes = targetDailyContributionMinutes / factor;
    }
    
    // Calculate proposed leave time
    // proposedLeaveMinutes = checkInMinutes + effectiveUserBreakMinutes + requiredDailyMinutes + rawDailyContributionMinutes
    const proposedLeaveMinutes = checkInMinutes + effectiveUserBreakMinutes + requiredDailyMinutes + rawDailyContributionMinutes;
    
    // Validate leave time is after check-in
    if (proposedLeaveMinutes <= checkInMinutes) {
      setValidationError('Calculated leave time must be after check-in time');
      return;
    }
    
    setLeaveTime(minutesToTime(proposedLeaveMinutes));
    const targetWorkedMinutes = requiredDailyMinutes + rawDailyContributionMinutes;
    setProjectedWorkedMinutes(targetWorkedMinutes);
    setDailyBalanceMinutes(rawDailyContributionMinutes);
  }, [hasExistingCheckIn, loadedCheckIn, checkInTime, overtimeAmount, overtimeMode, requiredDailyMinutes, loadedBreakMinutes, userBreakMinutes, plannedBreakStartTime, timeToMinutes, minutesToTime, selectedDate, entries, currentTotalOvertimeMinutes]);

  // Auto-calculate when inputs change
  useEffect(() => {
    if (isLoading) return;
    
    if (calcMode === 'forward' && checkInTime && leaveTime) {
      performForwardCalculation();
    } else if (calcMode === 'reverse' && checkInTime && overtimeAmount) {
      performReverseCalculation();
    }
  }, [calcMode, checkInTime, leaveTime, overtimeAmount, overtimeMode, userBreakMinutes, plannedBreakStartTime, isLoading, performForwardCalculation, performReverseCalculation]);

  const handleSave = useCallback(() => {
    // This would save the calculated leave time as a check-out
    // For now, just close the modal
    onClose();
  }, [onClose]);

  if (isLoading) {
    return (
      <ModalShell isOpen={true} onClose={onClose} title="Leave Calculator">
        <div className="calculator-loading">Loading calculator...</div>
      </ModalShell>
    );
  }

  return (
    <ModalShell isOpen={true} onClose={onClose} title="Leave Calculator">
      <div className="modal-header">
        <h2>{calcMode === 'forward' ? 'Calculate Leave Time' : 'Calculate Overtime Target'}</h2>
      </div>
      
      <div className="modal-body leave-calculator" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* ROW 1: Date & Required */}
        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          {/* Date Selection */}
          <div className="bento-modal-card" style={{ flex: 1 }}>
            <div className="bento-modal-card-label">📅 Date</div>
            <div className="bento-modal-huge-value" style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0, textAlign: 'left' }}>
              {selectedDate}
            </div>
          </div>

          {/* Required Duration */}
          <div className="bento-modal-card" style={{ flex: 1 }}>
            <div className="bento-modal-card-label">⏱ Required</div>
            <div className="bento-modal-huge-value" style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0, textAlign: 'left', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              {formatMinutesAsHours(requiredDailyMinutes)}
              <small style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>{employee.employeeType === 'part-time' ? 'PT' : 'FT'}</small>
            </div>
          </div>
        </div>

        {/* ROW 2: Check-in Time & Min Fulfillment */}
        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          {/* Check-in Time */}
          <div className="bento-modal-card" style={{ flex: 1, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div className="bento-modal-card-label" style={{ marginBottom: 0 }}>🕒 Check-in Time</div>
            {hasExistingCheckIn ? (
              <div className="bento-modal-huge-value" style={{ fontSize: '1.4rem', color: '#00f0ff', margin: 0, marginTop: 'auto' }}>
                {loadedCheckIn}
              </div>
            ) : (
              <input
                type="time"
                className="bento-modal-card-input"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                step="1"
                style={{ width: '100%', marginTop: 'auto' }}
              />
            )}
          </div>

          {/* Minimum Required Leave Time */}
          {fulfillmentLeaveTime ? (
            <div className="bento-modal-card" style={{ flex: 1, border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div className="bento-modal-card-label" style={{ color: '#10b981', marginBottom: 0 }}>✅ Min Fulfillment</div>
              <div className="bento-modal-huge-value" style={{ margin: 0, textShadow: 'none', fontSize: '1.4rem', color: '#10b981', marginTop: 'auto' }}>
                {formatTime12Hour(fulfillmentLeaveTime)}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1 }}></div>
          )}
        </div>

        {/* Break Details Toggle */}
        <div className="bento-modal-card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setShowBreakDetails(!showBreakDetails)}>
          <div className="bento-modal-card-label" style={{ marginBottom: 0 }}>☕ Break Settings</div>
          <div style={{ display: 'flex', alignItems: 'center', background: showBreakDetails ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255,255,255,0.1)', borderRadius: '20px', padding: '4px', width: '44px', transition: 'all 0.3s' }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: showBreakDetails ? '#00f0ff' : '#94a3b8', transform: showBreakDetails ? 'translateX(18px)' : 'translateX(0)', transition: 'all 0.3s' }} />
          </div>
        </div>

        {/* Break Details Content */}
        {showBreakDetails && (
          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            <div className="bento-modal-card" style={{ flex: 1 }}>
              <div className="bento-modal-card-label">☕ Break Start</div>
              <input
                type="time"
                className="bento-modal-card-input"
                value={plannedBreakStartTime}
                onChange={(e) => setPlannedBreakStartTime(e.target.value)}
              />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                Paid: {formatTime12Hour(minutesToTime(allowedBreakStartMins).substring(0,5))}
              </div>
            </div>
            
            <div className="bento-modal-card" style={{ flex: 1 }}>
              <div className="bento-modal-card-label">⏳ Duration (m)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
                <input
                  type="number"
                  className="bento-modal-card-input"
                  value={userBreakMinutes === 0 ? '' : userBreakMinutes}
                  onChange={(e) => setUserBreakMinutes(e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)}
                  min="0" step="5" placeholder="e.g., 60"
                  style={{ marginTop: 0 }}
                />
                {loadedBreakMinutes > 0 && userBreakMinutes !== loadedBreakMinutes && (
                  <button className="btn-secondary" onClick={() => setUserBreakMinutes(loadedBreakMinutes)} style={{ borderRadius: '12px', padding: '6px', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }}>
                    Use Logged ({loadedBreakMinutes}m)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="bento-modal-card" style={{ gridColumn: 'span 2' }}>
          <div className="bento-modal-card-label">⚙️ Mode</div>
          <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '16px' }}>
            <button 
              style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: calcMode === 'forward' ? 'rgba(255,255,255,0.1)' : 'transparent', color: calcMode === 'forward' ? 'white' : 'var(--text-secondary)', fontWeight: 600, transition: 'all 0.2s', fontSize: '0.9rem' }}
              onClick={() => setCalcMode('forward')}
            >
              Target Leave Time
            </button>
            <button 
              style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: calcMode === 'reverse' ? 'rgba(255,255,255,0.1)' : 'transparent', color: calcMode === 'reverse' ? 'white' : 'var(--text-secondary)', fontWeight: 600, transition: 'all 0.2s', fontSize: '0.9rem' }}
              onClick={() => setCalcMode('reverse')}
            >
              Target Overtime
            </button>
          </div>
        </div>



        {calcMode === 'forward' ? (
          <>
            <div className="bento-modal-card" style={{ gridColumn: 'span 2', border: '1px solid rgba(0, 240, 255, 0.3)', background: 'rgba(0, 240, 255, 0.05)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="bento-modal-card-label" style={{ marginBottom: 0, color: '#00f0ff' }}>🎯 Expected Leave Time</div>
              <input
                type="time"
                className="bento-modal-card-input"
                value={leaveTime}
                onChange={(e) => setLeaveTime(e.target.value)}
                step="1"
                style={{ width: 'auto', marginTop: 0, background: 'rgba(0,0,0,0.5)', borderColor: '#00f0ff' }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="bento-modal-card" style={{ gridColumn: 'span 1' }}>
              <div className="bento-modal-card-label">🎯 Target Overtime</div>
              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', marginTop: 'auto' }}>
                <input
                  type="number"
                  className="bento-modal-card-input"
                  value={overtimeAmount}
                  onChange={(e) => setOvertimeAmount(e.target.value)}
                  step="0.25" min="0" placeholder="e.g., 1.5"
                  style={{ marginTop: 0 }}
                />
                <button
                  className="btn-secondary"
                  onClick={() => setOvertimeAmount((currentTotalOvertimeMinutes / 60).toFixed(2))}
                  style={{ borderRadius: '12px', padding: '6px', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                >
                  Use Max
                </button>
              </div>
            </div>
            <div className="bento-modal-card" style={{ gridColumn: 'span 1' }}>
              <div className="bento-modal-card-label">📊 Logic</div>
              <CustomSelect
                id="overtime-logic-select"
                className="bento-modal-card-input"
                value={overtimeMode}
                onChange={(e) => setOvertimeMode(e.target.value)}
                dropUp={true}
                options={[
                  { value: 'spend', label: 'Add to Required' },
                  { value: 'keep', label: 'Total Target' }
                ]}
              />
            </div>
          </>
        )}

        {validationError && (
          <div className="bento-modal-card" style={{ gridColumn: 'span 2', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.05)' }}>
            <div style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{validationError}</div>
          </div>
        )}

        {projectedWorkedMinutes > 0 && (
          <div className="bento-modal-card" style={{ gridColumn: 'span 2' }}>
            <div className="bento-modal-card-label">📈 Calculation Results</div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Projected Work Time</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatMinutesAsHours(projectedWorkedMinutes)}</div>
              </div>
              
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Daily Balance</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: dailyBalanceMinutes > 0 ? '#10b981' : dailyBalanceMinutes < 0 ? '#ff0080' : 'var(--text-primary)' }}>
                  {dailyBalanceMinutes > 0 ? '+' : ''}{formatMinutesAsHours(dailyBalanceMinutes)}
                </div>
              </div>

              {calcMode === 'forward' && (
                <>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Total Overtime Change</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: (projectedTotalOvertimeMinutes - currentTotalOvertimeMinutes) > 0 ? '#10b981' : (projectedTotalOvertimeMinutes - currentTotalOvertimeMinutes) < 0 ? '#ff0080' : 'var(--text-primary)' }}>
                      {(projectedTotalOvertimeMinutes - currentTotalOvertimeMinutes) > 0 ? '+' : ''}
                      {formatMinutesAsHours(projectedTotalOvertimeMinutes - currentTotalOvertimeMinutes, true)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>New Total Overtime</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: projectedTotalOvertimeMinutes > 0 ? '#10b981' : projectedTotalOvertimeMinutes < 0 ? '#ff0080' : 'var(--text-primary)' }}>
                      {formatMinutesAsHours(projectedTotalOvertimeMinutes, true)}
                    </div>
                  </div>
                </>
              )}
              
              {calcMode === 'reverse' && leaveTime && (
                <div style={{ gridColumn: 'span 2', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-success)', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Required Leave Time</div>
                  <div className="bento-modal-huge-value" style={{ margin: 0, fontSize: '1.6rem' }}>{leaveTime}</div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={handleCancel}>
          Cancel
        </button>
        {((calcMode === 'forward' && leaveTime) || (calcMode === 'reverse' && leaveTime)) && !validationError && (
          <button className="btn btn-primary" onClick={handleSave}>
            Use Calculated Time
          </button>
        )}
      </div>
    </ModalShell>
  );
};

export default LeaveCalculator;
