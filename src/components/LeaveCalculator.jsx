import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import ModalShell from './ModalShell';
import '../styles/leave-calculator.css';

const LeaveCalculator = ({ selectedDate, onClose }) => {
  const { entries, employee, getCurrentPeriod, calculateOvertimeDetails } = useTimeTracker();
  
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
      return parts[0] * 60 + parts[1];
    }
    return 0;
  }, []);

  // Helper: Convert minutes to time string (HH:MM)
  const minutesToTime = useCallback((minutes) => {
    if (minutes < 0) minutes = 0;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }, []);

  // Helper: Format minutes as hours and minutes (e.g., "2h 30m" or "-1h 15m")
  const formatMinutesAsHours = useCallback((minutes) => {
    const absMinutes = Math.abs(minutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;
    const sign = minutes < 0 ? '-' : '';
    if (hours > 0 && mins > 0) {
      return `${sign}${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${sign}${hours}h`;
    } else {
      return `${sign}${mins}m`;
    }
  }, []);

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
          breakMinutes += timeToMinutes(interval.out) - timeToMinutes(interval.in);
        }
      }
    }
    setLoadedBreakMinutes(breakMinutes);
    
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
    
    // Calculate current total overtime for the period (convert to integer minutes)
    const currentPeriod = getCurrentPeriod();
    if (currentPeriod && calculateOvertimeDetails) {
      const periodStart = currentPeriod.start_date || currentPeriod.start;
      const periodEnd = currentPeriod.end_date || currentPeriod.end;
      const overtimeDetails = calculateOvertimeDetails(entries, periodStart, periodEnd);
      // Convert decimal hours to integer minutes
      setCurrentTotalOvertimeMinutes(Math.round(overtimeDetails.totalExtraHoursWithFactor * 60));
    } else {
      setCurrentTotalOvertimeMinutes(0);
    }
    
    // Reset calculations
    setProjectedWorkedMinutes(0);
    setDailyBalanceMinutes(0);
    setProjectedTotalOvertimeMinutes(0);
    setValidationError('');
    
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
    
    // Calculate projected worked minutes
    const workedMinutes = leaveMinutes - checkInMinutes - loadedBreakMinutes;
    setProjectedWorkedMinutes(workedMinutes);
    
    // Calculate daily balance (integer minutes)
    const balanceMinutes = workedMinutes - requiredDailyMinutes;
    setDailyBalanceMinutes(balanceMinutes);
    
    // Calculate projected total overtime using the formula:
    // new_period_balance_minutes = current_period_balance_minutes - old_selected_day_contribution_minutes + new_daily_balance_minutes
    
    const existingEntry = entries.find(e => e.date === selectedDate);
    let oldDayContributionMinutes = 0;
    
    // Get old selected day contribution from raw storage (if complete entry exists)
    if (existingEntry && existingEntry.intervals?.[0]?.in && existingEntry.intervals?.[0]?.out) {
      // Calculate the existing entry's contribution using raw minute values
      const existingWorkMinutes = timeToMinutes(existingEntry.intervals[0].out) - timeToMinutes(existingEntry.intervals[0].in) - loadedBreakMinutes;
      oldDayContributionMinutes = existingWorkMinutes - requiredDailyMinutes;
    }
    
    // Apply formula: current - old + new
    const projectedTotal = currentTotalOvertimeMinutes - oldDayContributionMinutes + balanceMinutes;
    setProjectedTotalOvertimeMinutes(projectedTotal);
  }, [hasExistingCheckIn, loadedCheckIn, checkInTime, leaveTime, loadedBreakMinutes, requiredDailyMinutes, timeToMinutes, selectedDate, entries, currentTotalOvertimeMinutes]);

  // Perform reverse calculation
  const performReverseCalculation = useCallback(() => {
    setValidationError('');
    
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
      let oldDayContributionMinutes = 0;
      
      if (existingEntry && existingEntry.intervals?.[0]?.in && existingEntry.intervals?.[0]?.out) {
        const existingWorkMinutes = timeToMinutes(existingEntry.intervals[0].out) - timeToMinutes(existingEntry.intervals[0].in) - loadedBreakMinutes;
        oldDayContributionMinutes = existingWorkMinutes - requiredDailyMinutes;
      }
      
      // Apply formula
      targetDailyContributionMinutes = targetEndingTotalMinutes - currentTotalOvertimeMinutes + oldDayContributionMinutes;
    }
    
    // Calculate proposed leave time
    // proposedLeaveMinutes = checkInMinutes + breakMinutes + requiredDailyMinutes + targetDailyContributionMinutes
    const proposedLeaveMinutes = checkInMinutes + loadedBreakMinutes + requiredDailyMinutes + targetDailyContributionMinutes;
    
    // Validate leave time is after check-in
    if (proposedLeaveMinutes <= checkInMinutes) {
      setValidationError('Calculated leave time must be after check-in time');
      return;
    }
    
    setLeaveTime(minutesToTime(proposedLeaveMinutes));
    const targetWorkedMinutes = requiredDailyMinutes + targetDailyContributionMinutes;
    setProjectedWorkedMinutes(targetWorkedMinutes);
    setDailyBalanceMinutes(targetDailyContributionMinutes);
  }, [hasExistingCheckIn, loadedCheckIn, checkInTime, overtimeAmount, overtimeMode, requiredDailyMinutes, loadedBreakMinutes, timeToMinutes, minutesToTime, selectedDate, entries, currentTotalOvertimeMinutes]);

  // Auto-calculate when inputs change
  useEffect(() => {
    if (isLoading) return;
    
    if (calcMode === 'forward' && checkInTime && leaveTime) {
      performForwardCalculation();
    } else if (calcMode === 'reverse' && checkInTime && overtimeAmount) {
      performReverseCalculation();
    }
  }, [calcMode, checkInTime, leaveTime, overtimeAmount, overtimeMode, isLoading, performForwardCalculation, performReverseCalculation]);

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
    <ModalShell isOpen={true} onClose={onClose} title="Leave Time Calculator">
      <div className="leave-calculator">
        {/* Date Display */}
        <div className="calculator-section">
          <label className="calculator-label">Selected Date</label>
          <div className="calculator-value">{selectedDate}</div>
        </div>

        {/* Required Daily Duration */}
        <div className="calculator-section">
          <label className="calculator-label">Required Daily Duration</label>
          <div className="calculator-value">
            {formatMinutesAsHours(requiredDailyMinutes)}
            <span className="calculator-hint">
              {employee.employeeType === 'part-time' ? ' (Part-time)' : ' (Full-time)'}
            </span>
          </div>
        </div>

        {/* Break Duration */}
        <div className="calculator-section">
          <label className="calculator-label">Break Duration</label>
          <div className="calculator-value">
            {formatMinutesAsHours(loadedBreakMinutes)}
            {loadedBreakMinutes > 0 && (
              <span className="calculator-hint"> (Loaded from record)</span>
            )}
          </div>
        </div>

        {/* Check-in Time */}
        <div className="calculator-section">
          <label className="calculator-label">Check-in Time</label>
          {hasExistingCheckIn ? (
            <div className="calculator-value readonly">
              {loadedCheckIn}
              <span className="calculator-hint"> (Loaded from record)</span>
            </div>
          ) : (
            <>
              <input
                type="time"
                className="calculator-input"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                step="1"
              />
              {!checkInTime && (
                <div className="calculator-warning">⚠️ Check-in time is required</div>
              )}
            </>
          )}
        </div>

        {/* Calculation Mode Toggle */}
        <div className="calculator-section">
          <label className="calculator-label">Calculation Mode</label>
          <div className="calculator-toggle-group">
            <button
              className={`calculator-toggle ${calcMode === 'forward' ? 'active' : ''}`}
              onClick={() => setCalcMode('forward')}
            >
              Forward
            </button>
            <button
              className={`calculator-toggle ${calcMode === 'reverse' ? 'active' : ''}`}
              onClick={() => setCalcMode('reverse')}
            >
              Reverse
            </button>
          </div>
          <div className="calculator-hint">
            {calcMode === 'forward' 
              ? 'Enter leave time to see how it affects your total overtime' 
              : 'Enter desired overtime to calculate when to leave'}
          </div>
        </div>

        {/* Forward Mode: Leave Time Input */}
        {calcMode === 'forward' && (
          <div className="calculator-section">
            <label className="calculator-label">Expected Leave Time</label>
            <input
              type="time"
              className="calculator-input"
              value={leaveTime}
              onChange={(e) => setLeaveTime(e.target.value)}
              step="1"
            />
          </div>
        )}

        {/* Reverse Mode: Overtime Input */}
        {calcMode === 'reverse' && (
          <>
            <div className="calculator-section">
              <label className="calculator-label">Target Daily Overtime (hours)</label>
              <div className="calculator-input-group">
                <input
                  type="number"
                  className="calculator-input"
                  value={overtimeAmount}
                  onChange={(e) => setOvertimeAmount(e.target.value)}
                  step="0.25"
                  min="0"
                  placeholder="e.g., 1.5"
                />
                <button
                  className="btn btn-outline calculator-input-btn"
                  onClick={() => setOvertimeAmount((currentTotalOvertimeMinutes / 60).toFixed(2))}
                  title="Use current total overtime"
                >
                  Use Total
                </button>
              </div>
              <div className="calculator-hint">
                How much overtime do you want to have for this day?
                {currentTotalOvertimeMinutes > 0 && (
                  <span> (Current total: {(currentTotalOvertimeMinutes / 60).toFixed(2)}h)</span>
                )}
              </div>
            </div>
            <div className="calculator-section">
              <label className="calculator-label">Calculation Type</label>
              <div className="calculator-toggle-group">
                <button
                  className={`calculator-toggle ${overtimeMode === 'spend' ? 'active' : ''}`}
                  onClick={() => setOvertimeMode('spend')}
                >
                  Add to Required
                </button>
                <button
                  className={`calculator-toggle ${overtimeMode === 'keep' ? 'active' : ''}`}
                  onClick={() => setOvertimeMode('keep')}
                >
                  Total Target
                </button>
              </div>
              <div className="calculator-hint">
                {overtimeMode === 'spend' 
                  ? 'Work required hours + this overtime amount (e.g., 9h + 1.5h = 10.5h total)' 
                  : 'Work exactly this many hours total (e.g., 10.5h includes required hours)'}
              </div>
            </div>
          </>
        )}

        {/* Validation Error */}
        {validationError && (
          <div className="calculator-error">{validationError}</div>
        )}

        {/* Calculation Results */}
        {projectedWorkedMinutes > 0 && (
          <div className="calculator-results">
            <div className="calculator-result-row">
              <span className="result-label">Projected Work Time:</span>
              <span className="result-value">{formatMinutesAsHours(projectedWorkedMinutes)}</span>
            </div>
            <div className="calculator-result-row">
              <span className="result-label">Daily Balance:</span>
              <span className={`result-value ${dailyBalanceMinutes >= 0 ? 'positive' : 'negative'}`}>
                {formatMinutesAsHours(dailyBalanceMinutes)}
              </span>
            </div>
            {calcMode === 'forward' && (
              <>
                <div className="calculator-result-row">
                  <span className="result-label">Current Total Overtime:</span>
                  <span className="result-value">{formatMinutesAsHours(currentTotalOvertimeMinutes)}</span>
                </div>
                <div className="calculator-result-row">
                  <span className="result-label">Projected Total Overtime:</span>
                  <span className={`result-value ${projectedTotalOvertimeMinutes >= 0 ? 'positive' : 'negative'}`}>
                    {formatMinutesAsHours(projectedTotalOvertimeMinutes)}
                  </span>
                </div>
                <div className="calculator-result-row">
                  <span className="result-label">Overtime Change:</span>
                  <span className={`result-value ${projectedTotalOvertimeMinutes >= currentTotalOvertimeMinutes ? 'positive' : 'negative'}`}>
                    {projectedTotalOvertimeMinutes > currentTotalOvertimeMinutes ? '+' : ''}
                    {formatMinutesAsHours(projectedTotalOvertimeMinutes - currentTotalOvertimeMinutes)}
                  </span>
                </div>
              </>
            )}
            {calcMode === 'reverse' && leaveTime && (
              <div className="calculator-result-row">
                <span className="result-label">Calculated Leave Time:</span>
                <span className="result-value">{leaveTime}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="calculator-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {calcMode === 'forward' && leaveTime && !validationError && (
            <button className="btn btn-primary" onClick={handleSave}>
              Use This Leave Time
            </button>
          )}
          {calcMode === 'reverse' && leaveTime && !validationError && (
            <button className="btn btn-primary" onClick={handleSave}>
              Use Calculated Time
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
};

export default LeaveCalculator;
