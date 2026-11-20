import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { extractBreaksFromIntervals, calculateHoursWorkedFromIntervals } from '../hooks/useCalculations';
import ModalShell from './ModalShell';
import '../styles/leave-calculator.css';
import CustomSelect from './CustomSelect';

const LeaveCalculator = ({ selectedDate, onClose }) => {
  const { entries, employee, getCurrentPeriod, calculateOvertimeDetails } = useTimeTracker();

  const handleCancel = (e) => {
    if (e && e.target && e.target.closest) {
      const modal = e.target.closest('.bento-modal-overlay');
      if (modal) {
        modal.classList.add('closing');
        const content = modal.querySelector('.modal-content');
        if (content) content.classList.add('closing');
      }
      setTimeout(onClose, 350);
    } else {
      onClose();
    }
  };
  
  // Calculator mode: 'forward' (check-in + leave time → balance) or 'reverse' (overtime → leave time)
  const [calcMode, setCalcMode] = useState('forward');
  
  // Data loaded from existing records
  const [loadedCheckIn, setLoadedCheckIn] = useState(null);
  const [loadedBreakMinutes, setLoadedBreakMinutes] = useState(0);
  
  // User inputs
  const [checkInTime, setCheckInTime] = useState('');
  const [leaveTime, setLeaveTime] = useState('');
  const [overtimeAmount, setOvertimeAmount] = useState('');
  const [overtimeMode, setOvertimeMode] = useState('spend'); // 'spend' or 'keep'
  const [userBreakMinutes, setUserBreakMinutes] = useState(0);
  const [plannedBreakStartTime, setPlannedBreakStartTime] = useState('13:00');
  const [showBreakDetails, setShowBreakDetails] = useState(false);
  const [hasExistingCheckIn, setHasExistingCheckIn] = useState(false);

  // Helper: Convert time string (HH:MM:SS or HH:MM or HH) to minutes since midnight
  const timeToMinutes = useCallback((timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length >= 2) {
      let minutes = (parts[0] || 0) * 60 + (parts[1] || 0);
      if (parts.length >= 3 && !isNaN(parts[2])) {
        minutes += parts[2] / 60;
      }
      return minutes;
    }
    if (parts.length === 1 && !isNaN(parts[0])) {
      return (parts[0] || 0) * 60;
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

  // Required daily duration from employee settings
  const requiredDailyMinutes = useMemo(() => {
    if (!selectedDate) return 540;
    const existingEntry = entries.find(e => e.date === selectedDate);
    const dayOfWeek = new Date(selectedDate).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (existingEntry) {
      if (existingEntry.duration === 0.5) return 270;
      if (['Holiday', 'Vacation', 'Sick Leave'].includes(existingEntry.type)) return 0;
    } else {
      if (employee?.employeeType === 'part-time') return (employee.dailyHours || 8) * 60;
      if (employee?.employeeType === 'full-time') return (employee.dailyHours || 9) * 60;
      if (isWeekend && !employee?.weekendWorkHours) return 0;
    }
    return 540;
  }, [selectedDate, entries, employee]);

  // Current total overtime for the period
  const currentTotalOvertimeMinutes = useMemo(() => {
    const currentPeriod = getCurrentPeriod?.();
    if (currentPeriod && calculateOvertimeDetails) {
      const periodStart = currentPeriod.start_date || currentPeriod.start;
      const periodEnd = currentPeriod.end_date || currentPeriod.end;
      const overtimeDetails = calculateOvertimeDetails(entries, periodStart, periodEnd);
      return (overtimeDetails.totalExtraHoursWithFactor || 0) * 60;
    }
    return 0;
  }, [getCurrentPeriod, calculateOvertimeDetails, entries]);

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

  // Load initial data only once per selectedDate
  const prevDateRef = useRef(null);
  useEffect(() => {
    if (!selectedDate || prevDateRef.current === selectedDate) return;
    prevDateRef.current = selectedDate;

    // Find existing entry for the selected date
    const existingEntry = entries.find(e => e.date === selectedDate);
    
    // Load check-in time if exists
    let effectiveIn = '';
    if (existingEntry?.intervals?.[0]?.in) {
      setLoadedCheckIn(existingEntry.intervals[0].in);
      setCheckInTime(existingEntry.intervals[0].in);
      setHasExistingCheckIn(true);
      effectiveIn = existingEntry.intervals[0].in;
    } else {
      setLoadedCheckIn(null);
      setCheckInTime('');
      setHasExistingCheckIn(false);
    }
    
    // Load break duration from existing intervals
    let breakMinutes = 0;
    if (existingEntry?.intervals && existingEntry.intervals.length > 1) {
      const extractedBreaks = extractBreaksFromIntervals(existingEntry.intervals);
      for (const b of extractedBreaks) {
        if (b.in && b.out) {
          const inMins = timeToMinutes(b.in);
          const outMins = timeToMinutes(b.out);
          const isAllowedBreak = 
            inMins >= allowedBreakStartMins &&
            inMins <= allowedBreakEndMins &&
            outMins >= allowedBreakStartMins &&
            outMins <= allowedBreakEndMins;
            
          if (!isAllowedBreak) {
            breakMinutes += Math.max(0, outMins - inMins);
          }
        }
      }
    }
    setLoadedBreakMinutes(breakMinutes);
    setUserBreakMinutes(breakMinutes);

    // Initial leave time population
    if (existingEntry?.intervals?.[existingEntry.intervals.length - 1]?.out) {
      setLeaveTime(existingEntry.intervals[existingEntry.intervals.length - 1].out);
    } else if (effectiveIn) {
      const inMinutes = timeToMinutes(effectiveIn);
      const targetLeaveMinutes = inMinutes + requiredDailyMinutes + breakMinutes;
      setLeaveTime(minutesToTime(targetLeaveMinutes));
    } else {
      setLeaveTime('18:00:00');
    }
  }, [selectedDate, entries, allowedBreakStartMins, allowedBreakEndMins, timeToMinutes, requiredDailyMinutes, minutesToTime]);

  // Derived calculation results - Pure useMemo to eliminate re-render loops and flicker
  const calculationResults = useMemo(() => {
    const effectiveCheckIn = hasExistingCheckIn ? loadedCheckIn : checkInTime;
    if (!effectiveCheckIn) {
      return { error: 'Check-in time is required', isValid: false, projectedWorkedMinutes: 0, dailyBalanceMinutes: 0 };
    }

    const checkInMinutes = timeToMinutes(effectiveCheckIn);
    const plannedStartMins = timeToMinutes(plannedBreakStartTime);
    const plannedEndMins = plannedStartMins + (userBreakMinutes || 0);
    const isAllowedPlannedBreak =
      plannedStartMins >= allowedBreakStartMins &&
      plannedStartMins <= allowedBreakEndMins &&
      plannedEndMins >= allowedBreakStartMins &&
      plannedEndMins <= allowedBreakEndMins;

    const effectiveUserBreakMinutes = isAllowedPlannedBreak ? 0 : (userBreakMinutes || 0);

    const existingEntry = entries.find(e => e.date === selectedDate);
    const dayOfWeek = new Date(selectedDate).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const entryType = existingEntry?.type || 'Regular';
    const useDoubleFactor = isWeekend || entryType === 'Holiday' || entryType === 'Vacation';
    const factor = useDoubleFactor ? 2 : 1.5;

    let oldDayContributionMinutes = 0;
    const validIntervals = (existingEntry?.intervals || []).filter(i => i?.in && i?.out);
    if (existingEntry && validIntervals.length > 0) {
      const existingWorkMinutes = Math.round(calculateHoursWorkedFromIntervals(validIntervals, employee?.breakStartTime || '13:00') * 60);
      const rawOldDayContribution = existingWorkMinutes - requiredDailyMinutes;
      oldDayContributionMinutes = rawOldDayContribution > 0 ? rawOldDayContribution * factor : rawOldDayContribution;
    }

    if (calcMode === 'forward') {
      if (!leaveTime) {
        return { isValid: false, projectedWorkedMinutes: 0, dailyBalanceMinutes: 0, error: '' };
      }

      const leaveMinutes = timeToMinutes(leaveTime);
      if (leaveMinutes <= checkInMinutes) {
        return { error: 'Leave time must be after check-in time', isValid: false, projectedWorkedMinutes: 0, dailyBalanceMinutes: 0 };
      }

      const workedMinutes = leaveMinutes - checkInMinutes - effectiveUserBreakMinutes;
      const balanceMinutes = workedMinutes - requiredDailyMinutes;
      const factoredBalanceMinutes = balanceMinutes > 0 ? balanceMinutes * factor : balanceMinutes;
      const projectedTotal = currentTotalOvertimeMinutes - oldDayContributionMinutes + factoredBalanceMinutes;

      return {
        isValid: true,
        projectedWorkedMinutes: workedMinutes,
        dailyBalanceMinutes: balanceMinutes,
        projectedTotalOvertimeMinutes: projectedTotal,
        overtimeChange: projectedTotal - currentTotalOvertimeMinutes,
        error: ''
      };
    } else {
      // Reverse mode
      if (!overtimeAmount || isNaN(parseFloat(overtimeAmount))) {
        return { isValid: false, projectedWorkedMinutes: 0, dailyBalanceMinutes: 0, error: '' };
      }

      const targetEndingTotalMinutes = Math.round(parseFloat(overtimeAmount) * 60);
      let targetDailyContributionMinutes;

      if (overtimeMode === 'spend') {
        targetDailyContributionMinutes = targetEndingTotalMinutes;
      } else {
        targetDailyContributionMinutes = targetEndingTotalMinutes - currentTotalOvertimeMinutes + oldDayContributionMinutes;
      }

      let rawDailyContributionMinutes = targetDailyContributionMinutes;
      if (targetDailyContributionMinutes > 0) {
        rawDailyContributionMinutes = targetDailyContributionMinutes / factor;
      }

      const proposedLeaveMinutes = checkInMinutes + effectiveUserBreakMinutes + requiredDailyMinutes + rawDailyContributionMinutes;
      if (proposedLeaveMinutes <= checkInMinutes) {
        return { error: 'Calculated leave time must be after check-in time', isValid: false, projectedWorkedMinutes: 0, dailyBalanceMinutes: 0 };
      }

      const calculatedLeaveTimeStr = minutesToTime(proposedLeaveMinutes);
      const targetWorkedMinutes = requiredDailyMinutes + rawDailyContributionMinutes;

      return {
        isValid: true,
        calculatedLeaveTime: calculatedLeaveTimeStr,
        projectedWorkedMinutes: targetWorkedMinutes,
        dailyBalanceMinutes: rawDailyContributionMinutes,
        projectedTotalOvertimeMinutes: currentTotalOvertimeMinutes + targetDailyContributionMinutes,
        overtimeChange: targetDailyContributionMinutes,
        error: ''
      };
    }
  }, [
    calcMode,
    hasExistingCheckIn,
    loadedCheckIn,
    checkInTime,
    leaveTime,
    overtimeAmount,
    overtimeMode,
    userBreakMinutes,
    plannedBreakStartTime,
    allowedBreakStartMins,
    allowedBreakEndMins,
    requiredDailyMinutes,
    currentTotalOvertimeMinutes,
    selectedDate,
    entries,
    employee,
    timeToMinutes,
    minutesToTime
  ]);

  const handleSave = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <ModalShell isOpen={true} onClose={handleCancel} contentClassName="leave-calculator-modal" title="Leave Calculator">
      <div className="modal-header">
        <h2>{calcMode === 'forward' ? 'Calculate Leave Time' : 'Calculate Overtime Target'}</h2>
      </div>
      
      <div className="modal-body leave-calculator" style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0, overflowY: 'auto' }}>
        
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
              <small style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>{employee?.employeeType === 'part-time' ? 'PT' : 'FT'}</small>
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
                type="tel"
                placeholder="HH:MM:SS"
                className="bento-modal-card-input"
                value={checkInTime || ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  let res = '';
                  if (val.length > 0) res += val.substring(0, 2);
                  if (val.length > 2) res += ':' + val.substring(2, 4);
                  if (val.length > 4) res += ':' + val.substring(4, 6);
                  setCheckInTime(res);
                }}
                onBlur={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (!val) return;
                  let res = '';
                  if (val.length === 1) res = `0${val}:00:00`;
                  else if (val.length === 2) res = `${val}:00:00`;
                  else if (val.length === 3) res = `${val.substring(0,2)}:0${val.substring(2,3)}:00`;
                  else if (val.length === 4) res = `${val.substring(0,2)}:${val.substring(2,4)}:00`;
                  else if (val.length === 5) res = `${val.substring(0,2)}:${val.substring(2,4)}:0${val.substring(4,5)}`;
                  else if (val.length >= 6) res = `${val.substring(0,2)}:${val.substring(2,4)}:${val.substring(4,6)}`;
                  setCheckInTime(res);
                }}
                style={{ width: '100%', marginTop: 'auto', textAlign: 'center' }}
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

        {/* Collapsible Break Details Panel */}
        {showBreakDetails && (
          <div className="bento-modal-card" style={{ gap: '16px', background: 'rgba(0,0,0,0.2)' }}>
            {hasExistingCheckIn && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Logged Break Duration</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{loadedBreakMinutes} min</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Expected Break Duration</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    className="bento-modal-card-input"
                    value={userBreakMinutes === 0 ? '' : userBreakMinutes}
                    onChange={(e) => setUserBreakMinutes(e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)}
                    min="0"
                    placeholder="0"
                    style={{ width: '80px', padding: '6px 10px', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>min</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[0, 15, 30, 45, 60].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setUserBreakMinutes(mins)}
                    style={{ flex: 1, padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: userBreakMinutes === mins ? '#00f0ff' : 'rgba(255,255,255,0.05)', color: userBreakMinutes === mins ? 'black' : 'white', fontWeight: 600, fontSize: '0.75rem' }}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Planned Break Start</label>
              <input
                type="time"
                className="bento-modal-card-input"
                value={plannedBreakStartTime}
                onChange={(e) => setPlannedBreakStartTime(e.target.value)}
                style={{ width: 'auto', padding: '6px 10px' }}
              />
            </div>
            
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
              ℹ️ Standard unpaid break: {employee?.breakStartTime || '13:00'} to {allowedBreakEndMins ? minutesToTime(allowedBreakEndMins).substring(0, 5) : '13:30'} (30m). Breaks taken strictly within this window are not deducted from your hours worked.
            </div>
          </div>
        )}

        {/* ROW 3: Mode Selection */}
        <div className="bento-modal-card">
          <div className="bento-modal-card-label">⚙ Mode</div>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '4px', gap: '4px' }}>
            <button 
              type="button"
              style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: calcMode === 'forward' ? 'rgba(255,255,255,0.1)' : 'transparent', color: calcMode === 'forward' ? 'white' : 'var(--text-secondary)', fontWeight: 600, transition: 'all 0.2s', fontSize: '0.9rem', cursor: 'pointer' }}
              onClick={() => setCalcMode('forward')}
            >
              Target Leave Time
            </button>
            <button 
              type="button"
              style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: calcMode === 'reverse' ? 'rgba(255,255,255,0.1)' : 'transparent', color: calcMode === 'reverse' ? 'white' : 'var(--text-secondary)', fontWeight: 600, transition: 'all 0.2s', fontSize: '0.9rem', cursor: 'pointer' }}
              onClick={() => setCalcMode('reverse')}
            >
              Target Overtime
            </button>
          </div>
        </div>

        {calcMode === 'forward' ? (
          <>
            <div className="bento-modal-card" style={{ border: '1px solid rgba(0, 240, 255, 0.3)', background: 'rgba(0, 240, 255, 0.05)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="bento-modal-card-label" style={{ marginBottom: 0, color: '#00f0ff' }}>🎯 Expected Leave Time</div>
              <input
                type="tel"
                placeholder="HH:MM:SS"
                className="bento-modal-card-input"
                value={leaveTime || ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  let res = '';
                  if (val.length > 0) res += val.substring(0, 2);
                  if (val.length > 2) res += ':' + val.substring(2, 4);
                  if (val.length > 4) res += ':' + val.substring(4, 6);
                  setLeaveTime(res);
                }}
                onBlur={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (!val) return;
                  let res = '';
                  if (val.length === 1) res = `0${val}:00:00`;
                  else if (val.length === 2) res = `${val}:00:00`;
                  else if (val.length === 3) res = `${val.substring(0,2)}:0${val.substring(2,3)}:00`;
                  else if (val.length === 4) res = `${val.substring(0,2)}:${val.substring(2,4)}:00`;
                  else if (val.length === 5) res = `${val.substring(0,2)}:${val.substring(2,4)}:0${val.substring(4,5)}`;
                  else if (val.length >= 6) res = `${val.substring(0,2)}:${val.substring(2,4)}:${val.substring(4,6)}`;
                  setLeaveTime(res);
                }}
                style={{ width: 'auto', marginTop: 0, background: 'rgba(0,0,0,0.5)', borderColor: '#00f0ff', textAlign: 'center' }}
              />
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            <div className="bento-modal-card" style={{ flex: 1 }}>
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
                  type="button"
                  className="btn-secondary"
                  onClick={() => setOvertimeAmount((currentTotalOvertimeMinutes / 60).toFixed(2))}
                  style={{ borderRadius: '12px', padding: '6px', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                >
                  Use Max
                </button>
              </div>
            </div>
            <div className="bento-modal-card" style={{ flex: 1 }}>
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
          </div>
        )}

        {calculationResults.error && (
          <div className="bento-modal-card" style={{ border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.05)' }}>
            <div style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{calculationResults.error}</div>
          </div>
        )}

        {calculationResults.isValid && (
          <div className="bento-modal-card" style={{ marginBottom: '16px' }}>
            <div className="bento-modal-card-label">📈 Calculation Results</div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Projected Work Time</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatMinutesAsHours(calculationResults.projectedWorkedMinutes)}</div>
              </div>
              
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Daily Balance</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: calculationResults.dailyBalanceMinutes > 0 ? '#10b981' : calculationResults.dailyBalanceMinutes < 0 ? '#ff0080' : 'var(--text-primary)' }}>
                  {calculationResults.dailyBalanceMinutes > 0 ? '+' : ''}{formatMinutesAsHours(calculationResults.dailyBalanceMinutes)}
                </div>
              </div>

              {calcMode === 'forward' && (
                <>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Total Overtime Change</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: calculationResults.overtimeChange > 0 ? '#10b981' : calculationResults.overtimeChange < 0 ? '#ff0080' : 'var(--text-primary)' }}>
                      {calculationResults.overtimeChange > 0 ? '+' : ''}
                      {formatMinutesAsHours(calculationResults.overtimeChange, true)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>New Total Overtime</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: calculationResults.projectedTotalOvertimeMinutes > 0 ? '#10b981' : calculationResults.projectedTotalOvertimeMinutes < 0 ? '#ff0080' : 'var(--text-primary)' }}>
                      {formatMinutesAsHours(calculationResults.projectedTotalOvertimeMinutes, true)}
                    </div>
                  </div>
                </>
              )}
              
              {calcMode === 'reverse' && calculationResults.calculatedLeaveTime && (
                <div style={{ gridColumn: 'span 2', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-success)', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Required Leave Time</div>
                  <div className="bento-modal-huge-value" style={{ margin: 0, fontSize: '1.6rem' }}>{calculationResults.calculatedLeaveTime}</div>
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
        {calculationResults.isValid && !calculationResults.error && (
          <button className="btn btn-primary" onClick={handleSave}>
            Use Calculated Time
          </button>
        )}
      </div>
    </ModalShell>
  );
};

export default LeaveCalculator;
