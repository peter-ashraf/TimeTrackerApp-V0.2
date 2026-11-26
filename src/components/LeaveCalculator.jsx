import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { extractBreaksFromIntervals, calculateHoursWorkedFromIntervals } from '../hooks/useCalculations';
import hapticFeedback from '../utils/hapticFeedback';
import ModalShell, { useSheetClose } from './ModalShell';
import '../styles/leave-calculator.css';

const getCurrentTimeStr = () => {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const formatTimeInputTyping = (rawValue) => {
  const val = rawValue.replace(/\D/g, '');
  let res = '';
  if (val.length > 0) res += val.substring(0, 2);
  if (val.length > 2) res += ':' + val.substring(2, 4);
  if (val.length > 4) res += ':' + val.substring(4, 6);
  return res;
};

const formatTimeInputBlur = (rawValue) => {
  const val = rawValue.replace(/\D/g, '');
  if (!val) return '';
  if (val.length === 1) return `0${val}:00:00`;
  if (val.length === 2) return `${val}:00:00`;
  if (val.length === 3) return `${val.substring(0, 2)}:0${val.substring(2, 3)}:00`;
  if (val.length === 4) return `${val.substring(0, 2)}:${val.substring(2, 4)}:00`;
  if (val.length === 5) return `${val.substring(0, 2)}:${val.substring(2, 4)}:0${val.substring(4, 5)}`;
  return `${val.substring(0, 2)}:${val.substring(2, 4)}:${val.substring(4, 6)}`;
};

const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const SheetCloseOrb = () => {
  const closeSheet = useSheetClose();
  return (
    <button
      type="button"
      className="ios-calc-close-orb"
      onClick={() => {
        hapticFeedback.buttonClick();
        closeSheet();
      }}
      aria-label="Close calculator"
    >
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M2.2 2.2L11.8 11.8M11.8 2.2L2.2 11.8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
};

const LeaveCalculator = ({ selectedDate, onClose }) => {
  const { entries, employee, getCurrentPeriod, calculateOvertimeDetails } = useTimeTracker();

  // Calculator mode: 'forward' (check-in + leave time -> balance) or 'reverse' (overtime -> leave time)
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

  // Convert time string (HH:MM:SS or HH:MM or HH) to minutes since midnight
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

  const allowedBreakStartMins = useMemo(
    () => (employee?.breakStartTime ? timeToMinutes(employee.breakStartTime) : 13 * 60),
    [employee?.breakStartTime, timeToMinutes],
  );
  const allowedBreakEndMins = useMemo(() => allowedBreakStartMins + 30, [allowedBreakStartMins]);

  // Format time (HH:MM or HH:MM:SS) to 12-hour format string
  const formatTime12Hour = useCallback((timeStr, withSeconds = false) => {
    if (!timeStr) return '—';
    const parts = timeStr.split(':');
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return '—';
    const seconds = withSeconds && parts[2] ? `:${parts[2]}` : '';
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')}${seconds} ${period}`;
  }, []);

  // Convert minutes to time string (HH:MM:SS)
  const minutesToTime = useCallback((minutes) => {
    if (minutes < 0) minutes = 0;
    const totalSeconds = Math.round(minutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  // Format minutes as hours and minutes (e.g., "2h 30m" or "-1h 15m")
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
      const decSign = decimalValue < 0 && Math.abs(decimalValue) >= 0.005 ? '-' : '';
      result += ` (${decSign}${decimalString}h)`;
    }

    return result;
  }, []);

  // Required daily duration from employee settings
  const requiredDailyMinutes = useMemo(() => {
    if (!selectedDate) return 540;
    const existingEntry = entries.find((e) => e.date === selectedDate);
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

  // Exact minimum leave time to fulfill daily required hours
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

    const effectiveUserBreakMinutes = isAllowedPlannedBreak ? 0 : userBreakMinutes || 0;
    const leaveMinutes = checkInMinutes + requiredDailyMinutes + effectiveUserBreakMinutes;
    return minutesToTime(leaveMinutes);
  }, [
    hasExistingCheckIn,
    loadedCheckIn,
    checkInTime,
    plannedBreakStartTime,
    userBreakMinutes,
    allowedBreakStartMins,
    allowedBreakEndMins,
    requiredDailyMinutes,
    timeToMinutes,
    minutesToTime,
  ]);

  // Load initial data once per selectedDate
  const prevDateRef = useRef(null);
  useEffect(() => {
    if (!selectedDate || prevDateRef.current === selectedDate) return;
    prevDateRef.current = selectedDate;

    const existingEntry = entries.find((e) => e.date === selectedDate);

    if (existingEntry?.intervals?.[0]?.in) {
      setLoadedCheckIn(existingEntry.intervals[0].in);
      setCheckInTime(existingEntry.intervals[0].in);
      setHasExistingCheckIn(true);
    } else {
      setLoadedCheckIn(null);
      setCheckInTime('');
      setHasExistingCheckIn(false);
    }

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

    // Default leave time: existing checkout if logged, otherwise current time ("Now")
    const existingOut = existingEntry?.intervals?.[existingEntry.intervals.length - 1]?.out;
    setLeaveTime(existingOut || getCurrentTimeStr());
  }, [selectedDate, entries, allowedBreakStartMins, allowedBreakEndMins, timeToMinutes]);

  const handleSetNow = useCallback(() => {
    hapticFeedback.buttonClick();
    setLeaveTime(getCurrentTimeStr());
  }, []);

  const handleSetCheckInNow = useCallback(() => {
    hapticFeedback.buttonClick();
    setCheckInTime(getCurrentTimeStr());
  }, []);

  // Synchronous memoized calculation results
  const calculationResults = useMemo(() => {
    const effectiveCheckIn = hasExistingCheckIn ? loadedCheckIn : checkInTime;
    if (!effectiveCheckIn) {
      return {
        error: 'Enter check-in time to calculate',
        isValid: false,
        projectedWorkedMinutes: 0,
        dailyBalanceMinutes: 0,
      };
    }

    const checkInMinutes = timeToMinutes(effectiveCheckIn);
    const plannedStartMins = timeToMinutes(plannedBreakStartTime);
    const plannedEndMins = plannedStartMins + (userBreakMinutes || 0);
    const isAllowedPlannedBreak =
      plannedStartMins >= allowedBreakStartMins &&
      plannedStartMins <= allowedBreakEndMins &&
      plannedEndMins >= allowedBreakStartMins &&
      plannedEndMins <= allowedBreakEndMins;

    const effectiveUserBreakMinutes = isAllowedPlannedBreak ? 0 : userBreakMinutes || 0;

    const existingEntry = entries.find((e) => e.date === selectedDate);
    const dayOfWeek = new Date(selectedDate).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const entryType = existingEntry?.type || 'Regular';
    const useDoubleFactor = isWeekend || entryType === 'Holiday' || entryType === 'Vacation';
    const factor = useDoubleFactor ? 2 : 1.5;

    let oldDayContributionMinutes = 0;
    const isComplete = Boolean(
      existingEntry?.intervals &&
        existingEntry.intervals.length > 0 &&
        existingEntry.intervals.every((i) => i?.in && i?.out),
    );
    if (isComplete) {
      const existingWorkMinutes = Math.round(
        calculateHoursWorkedFromIntervals(existingEntry.intervals, employee?.breakStartTime || '13:00') * 60,
      );
      const rawOldDayContribution = existingWorkMinutes - requiredDailyMinutes;
      oldDayContributionMinutes = rawOldDayContribution > 0 ? rawOldDayContribution * factor : rawOldDayContribution;
    }

    if (calcMode === 'forward') {
      if (!leaveTime) {
        return {
          isValid: false,
          projectedWorkedMinutes: 0,
          dailyBalanceMinutes: 0,
          error: 'Enter expected leave time or tap Now',
        };
      }

      const leaveMinutes = timeToMinutes(leaveTime);
      if (leaveMinutes <= checkInMinutes) {
        return {
          error: 'Leave time must be after check-in',
          isValid: false,
          projectedWorkedMinutes: 0,
          dailyBalanceMinutes: 0,
        };
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
        error: '',
      };
    } else {
      if (!overtimeAmount || isNaN(parseFloat(overtimeAmount))) {
        return {
          isValid: false,
          projectedWorkedMinutes: 0,
          dailyBalanceMinutes: 0,
          error: 'Enter target overtime hours',
        };
      }

      const targetEndingTotalMinutes = Math.round(parseFloat(overtimeAmount) * 60);
      let targetDailyContributionMinutes;

      if (overtimeMode === 'spend') {
        targetDailyContributionMinutes = targetEndingTotalMinutes;
      } else {
        targetDailyContributionMinutes =
          targetEndingTotalMinutes - currentTotalOvertimeMinutes + oldDayContributionMinutes;
      }

      let rawDailyContributionMinutes = targetDailyContributionMinutes;
      if (targetDailyContributionMinutes > 0) {
        rawDailyContributionMinutes = targetDailyContributionMinutes / factor;
      }

      const proposedLeaveMinutes =
        checkInMinutes + effectiveUserBreakMinutes + requiredDailyMinutes + rawDailyContributionMinutes;
      if (proposedLeaveMinutes <= checkInMinutes) {
        return {
          error: 'Calculated leave time must be after check-in',
          isValid: false,
          projectedWorkedMinutes: 0,
          dailyBalanceMinutes: 0,
        };
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
        error: '',
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
    minutesToTime,
  ]);

  const getSemanticClass = (minutes) => {
    if (minutes > 0.5) return 'is-positive';
    if (minutes < -0.5) return 'is-negative';
    return '';
  };

  const formatSignedHours = (minutes, showDecimal = false) => {
    const formatted = formatMinutesAsHours(minutes, showDecimal);
    if (minutes > 0.5 && !formatted.startsWith('+')) {
      return `+${formatted}`;
    }
    return formatted;
  };

  return (
    <ModalShell
      onClose={onClose}
      contentClassName="leave-calculator-modal"
      overlayClassName="leave-calculator-overlay"
      showCloseButton={false}
    >
      <div className="modal-header ios-calc-nav">
        <span className="ios-calc-nav-spacer" aria-hidden="true" />
        <h2 className="ios-calc-title">Leave Calculator</h2>
        <SheetCloseOrb />
      </div>

      <div className="modal-body leave-calculator">
        {/* Native iOS Segmented Capsule */}
        <div className="ios-calc-segmented" role="tablist" aria-label="Calculation mode">
          <button
            type="button"
            role="tab"
            aria-selected={calcMode === 'forward'}
            className={`ios-calc-seg-btn ${calcMode === 'forward' ? 'active' : ''}`}
            onClick={() => {
              hapticFeedback.buttonClick();
              setCalcMode('forward');
            }}
          >
            Leave Time
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={calcMode === 'reverse'}
            className={`ios-calc-seg-btn ${calcMode === 'reverse' ? 'active' : ''}`}
            onClick={() => {
              hapticFeedback.buttonClick();
              setCalcMode('reverse');
            }}
          >
            Overtime Target
          </button>
        </div>

        {/* Group 1: Top Results (.insetGrouped) */}
        <div className="ios-inset-group">
          {calculationResults.isValid ? (
            <>
              <div className="ios-hero-block">
                <div className="ios-hero-stat">
                  <span className="ios-hero-label">
                    {calcMode === 'forward' ? 'Worked Today' : 'Required Leave'}
                  </span>
                  <span className="ios-hero-value">
                    {calcMode === 'forward'
                      ? formatMinutesAsHours(calculationResults.projectedWorkedMinutes)
                      : formatTime12Hour(calculationResults.calculatedLeaveTime)}
                  </span>
                </div>
                <div className="ios-hero-stat align-right">
                  <span className="ios-hero-label">Daily Balance</span>
                  <span className={`ios-hero-value ${getSemanticClass(calculationResults.dailyBalanceMinutes)}`}>
                    {formatSignedHours(calculationResults.dailyBalanceMinutes)}
                  </span>
                </div>
              </div>

              <div className="ios-inset-sep" />

              {calcMode === 'forward' ? (
                <div className="ios-inset-row">
                  <span className="ios-row-label">Minimum Leave</span>
                  <span className="ios-row-value is-accent">
                    {fulfillmentLeaveTime ? formatTime12Hour(fulfillmentLeaveTime) : '—'}
                  </span>
                </div>
              ) : (
                <div className="ios-inset-row">
                  <span className="ios-row-label">Projected Work</span>
                  <span className="ios-row-value">
                    {formatMinutesAsHours(calculationResults.projectedWorkedMinutes)}
                  </span>
                </div>
              )}

              <div className="ios-inset-sep" />

              <div className="ios-inset-row">
                <span className="ios-row-label">Overtime Change</span>
                <span className={`ios-row-value ${getSemanticClass(calculationResults.overtimeChange)}`}>
                  {formatSignedHours(calculationResults.overtimeChange, true)}
                </span>
              </div>

              <div className="ios-inset-sep" />

              <div className="ios-inset-row">
                <span className="ios-row-label">Period Total</span>
                <span className={`ios-row-value ${getSemanticClass(calculationResults.projectedTotalOvertimeMinutes)}`}>
                  {formatSignedHours(calculationResults.projectedTotalOvertimeMinutes, true)}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="ios-inset-row ios-status-row">
                <span className="ios-row-label">Status</span>
                <span className="ios-row-value ios-status-msg">{calculationResults.error}</span>
              </div>
              {fulfillmentLeaveTime && (
                <>
                  <div className="ios-inset-sep" />
                  <div className="ios-inset-row">
                    <span className="ios-row-label">Minimum Leave</span>
                    <span className="ios-row-value is-accent">{formatTime12Hour(fulfillmentLeaveTime)}</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Group 2: Shift & Inputs (.insetGrouped) */}
        <div className="ios-inset-group">
          <div className="ios-inset-row">
            <span className="ios-row-label">Check-in</span>
            {hasExistingCheckIn ? (
              <span className="ios-row-value">
                {formatShortDate(selectedDate)} · {formatTime12Hour(loadedCheckIn)}
              </span>
            ) : (
              <div className="ios-inline-controls">
                <input
                  type="tel"
                  placeholder="HH:MM:SS"
                  className="ios-time-pill-input"
                  value={checkInTime || ''}
                  onChange={(e) => setCheckInTime(formatTimeInputTyping(e.target.value))}
                  onBlur={(e) => {
                    const formatted = formatTimeInputBlur(e.target.value);
                    if (formatted) setCheckInTime(formatted);
                  }}
                />
                <button
                  type="button"
                  className="ios-now-glass-btn"
                  onClick={handleSetCheckInNow}
                >
                  Now
                </button>
              </div>
            )}
          </div>

          <div className="ios-inset-sep" />

          {calcMode === 'forward' ? (
            <div className="ios-inset-row is-tall">
              <span className="ios-row-label">Expected Leave</span>
              <div className="ios-inline-controls">
                <input
                  type="tel"
                  placeholder="HH:MM:SS"
                  className="ios-time-pill-input"
                  aria-label="Expected leave time"
                  value={leaveTime || ''}
                  onChange={(e) => setLeaveTime(formatTimeInputTyping(e.target.value))}
                  onBlur={(e) => {
                    const formatted = formatTimeInputBlur(e.target.value);
                    if (formatted) setLeaveTime(formatted);
                  }}
                />
                <button
                  type="button"
                  className="ios-now-glass-btn"
                  onClick={handleSetNow}
                >
                  Now
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="ios-inset-row is-tall">
                <span className="ios-row-label">Target Hours</span>
                <div className="ios-inline-controls">
                  <input
                    type="number"
                    className="ios-number-pill-input"
                    value={overtimeAmount}
                    onChange={(e) => setOvertimeAmount(e.target.value)}
                    step="0.25"
                    min="0"
                    placeholder="0.00"
                    aria-label="Target overtime hours"
                  />
                  <button
                    type="button"
                    className="ios-now-glass-btn"
                    onClick={() => {
                      hapticFeedback.buttonClick();
                      setOvertimeAmount(Math.max(0, currentTotalOvertimeMinutes / 60).toFixed(2));
                    }}
                  >
                    Max
                  </button>
                </div>
              </div>
              <div className="ios-inset-sep" />
              <div className="ios-inset-row">
                <span className="ios-row-label">Apply As</span>
                <div className="ios-inline-seg">
                  <button
                    type="button"
                    className={`ios-inline-seg-btn ${overtimeMode === 'spend' ? 'active' : ''}`}
                    onClick={() => setOvertimeMode('spend')}
                  >
                    Add Today
                  </button>
                  <button
                    type="button"
                    className={`ios-inline-seg-btn ${overtimeMode === 'keep' ? 'active' : ''}`}
                    onClick={() => setOvertimeMode('keep')}
                  >
                    Period Total
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="ios-inset-sep" />

          <button
            type="button"
            className="ios-inset-row ios-disclosure-btn"
            onClick={() => {
              hapticFeedback.buttonClick();
              setShowBreakDetails((prev) => !prev);
            }}
            aria-expanded={showBreakDetails}
          >
            <span className="ios-row-label">Break</span>
            <span className="ios-row-value">
              <span>{userBreakMinutes} min</span>
              <svg
                width="7"
                height="12"
                viewBox="0 0 8 14"
                fill="none"
                className={`ios-chevron ${showBreakDetails ? 'is-open' : ''}`}
                aria-hidden="true"
              >
                <path
                  d="M1.5 1.5L6.5 7L1.5 12.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>

          {showBreakDetails && (
            <div className="ios-break-drawer">
              {hasExistingCheckIn && loadedBreakMinutes > 0 && (
                <div className="ios-break-meta">
                  <span>Logged non-standard break</span>
                  <strong>{loadedBreakMinutes} min</strong>
                </div>
              )}

              <div className="ios-break-presets">
                {[0, 15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    className={`ios-break-preset-btn ${userBreakMinutes === mins ? 'active' : ''}`}
                    onClick={() => setUserBreakMinutes(mins)}
                  >
                    {mins}m
                  </button>
                ))}
              </div>

              <div className="ios-break-fields">
                <label className="ios-break-field">
                  <span>Custom (min)</span>
                  <input
                    type="number"
                    className="ios-number-pill-input"
                    value={userBreakMinutes === 0 ? '' : userBreakMinutes}
                    onChange={(e) =>
                      setUserBreakMinutes(e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)
                    }
                    min="0"
                    placeholder="0"
                  />
                </label>

                <label className="ios-break-field">
                  <span>Planned Start</span>
                  <input
                    type="time"
                    className="ios-time-pill-input is-short"
                    value={plannedBreakStartTime}
                    onChange={(e) => setPlannedBreakStartTime(e.target.value)}
                  />
                </label>
              </div>

              <p className="ios-break-note">
                Breaks strictly within {employee?.breakStartTime || '13:00'}–
                {allowedBreakEndMins ? minutesToTime(allowedBreakEndMins).substring(0, 5) : '13:30'} (30m) aren&apos;t deducted.
              </p>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
};

export default LeaveCalculator;
