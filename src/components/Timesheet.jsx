import React, { useState, useMemo, useCallback } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import ManualTimeModal from './ManualTimeModal';
import AddBreakModal from './AddBreakModal';
import EditEntryModal from './EditEntryModal';

function Timesheet() {
  const { 
    entries, 
    periods,
    currentPeriodId,
    setCurrentPeriodId,
    deleteEntry, 
    getCurrentPeriod,
    use12Hour,
    setUse12Hour,
    detailedView,
    setDetailedView,
    calculateHoursWorked,
    calculateHoursSpentOutside,
    calculateOvertimeDetails
  } = useTimeTracker();

  const [showManualIn, setShowManualIn] = useState(false);
  const [showManualOut, setShowManualOut] = useState(false);
  const [showAddBreak, setShowAddBreak] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  // Use local state for viewing period (separate from "current" period)
  const [viewingPeriodId, setViewingPeriodId] = useState(currentPeriodId);
  const viewingPeriod = useMemo(() => {
    return periods.find(p => p.id === viewingPeriodId) || getCurrentPeriod();
  }, [periods, viewingPeriodId, getCurrentPeriod]);

  // Filter and sort entries for VIEWING period
  const periodEntries = useMemo(() => {
    if (!viewingPeriod) return [...entries].sort((a, b) => a.date.localeCompare(b.date));
    
    return entries
      .filter(e => e.date >= viewingPeriod.start && e.date <= viewingPeriod.end)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, viewingPeriod]);

  // Convert 24h to 12h format
  const formatTime = useCallback((time24) => {
    if (!time24) return '-';
    if (!use12Hour) return time24;
    
    try {
      const parts = time24.split(':');
      const hours = parseInt(parts[0]);
      const minutes = parts[1];
      const seconds = parts[2] || '00';
      const period = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${h12}:${minutes}:${seconds} ${period}`;
    } catch (e) {
      return time24;
    }
  }, [use12Hour]);

  // Calculate totals for VIEWING period
  const overtimeDetails = useMemo(() => {
    if (!calculateOvertimeDetails || !viewingPeriod) {
      return { totalHoursWorked: 0, totalExtraHours: 0, totalExtraHoursWithFactor: 0 };
    }
    
    const result = calculateOvertimeDetails(entries, viewingPeriod.start, viewingPeriod.end);
    
    return result;
  }, [entries, viewingPeriod, calculateOvertimeDetails]);

  return (
    <main className="main-content">
      <h1>Timesheet</h1>

      {/* Timesheet Controls */}
      <div className="timesheet-controls">
        {/* ✅ FIXED: Period Selector with ALL periods */}
        <div className="month-selector">
          <label>Select Period:</label>
          <select 
            className="form-control"
            value={viewingPeriodId}
            onChange={(e) => setViewingPeriodId(e.target.value)}
          >
            {periods.map(period => (
              <option key={period.id} value={period.id}>
                {period.label} {period.id === currentPeriodId && '(Current)'}
              </option>
            ))}
          </select>
        </div>

        {/* Toggle Group */}
        <div className="toggle-group">
          {/* Detailed View Toggle */}
          <div className="time-format-toggle">
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={detailedView}
                onChange={(e) => setDetailedView(e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">{detailedView ? 'Detailed' : 'Simple'}</span>
            </label>
          </div>

          {/* Time Format Toggle */}
          <div className="time-format-toggle">
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={use12Hour}
                onChange={(e) => setUse12Hour(e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">{use12Hour ? '12h' : '24h'}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Manual Time Actions */}
      <div className="manual-time-actions">
        <button 
          className="btn btn-secondary manual-check-in-btn"
          onClick={() => setShowManualIn(true)}
        >
          👈 Manual In
        </button>
        <button 
          className="btn btn-secondary manual-check-out-btn"
          onClick={() => setShowManualOut(true)}
        >
          👉 Manual Out
        </button>
        <button 
          type="button" 
          className="btn btn-secondary add-break-btn"
          onClick={() => setShowAddBreak(true)}
        >
          + Add Break
        </button>
      </div>

      {/* Table Container */}
      <div id="tableContainer">
        <table className={`data-table ${detailedView ? 'detailed-view' : ''}`}>
          <thead>
            <tr>
              <th>DATE</th>
              <th>CHECK IN</th>
              <th>CHECK OUT</th>
              <th>HOURS SPENT</th>
              {detailedView && (
                <>
                  <th className="hide-mobile">EXTRA HOURS</th>
                  <th className="hide-mobile">EXTRA HOURS xFACTOR</th>
                  <th className="hide-mobile">TYPE</th>
                  <th className="hide-mobile">CHECK OUT WITHIN DAY</th>
                  <th className="hide-mobile">CHECK IN WITHIN DAY</th>
                  <th className="hide-mobile">HOURS SPENT OUTSIDE</th>
                </>
              )}
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {periodEntries.length === 0 ? (
              <tr>
                <td colSpan={detailedView ? "11" : "5"} style={{textAlign: 'center', padding: '20px'}}>
                  No entries found for this period.
                </td>
              </tr>
            ) : (
              <>
                {periodEntries.map((entry) => {
                  // For incomplete entries, calculate fresh to avoid stored negative values
                  const isComplete = entry.intervals && 
                    entry.intervals.length > 0 && 
                    entry.intervals.every(interval => interval.in && interval.out);
                  
                  const hoursWorked = entry.type === 'Regular' && entry.intervals && isComplete
                    ? calculateHoursWorked(entry.intervals, entry.date) 
                    : 0;
                  
                  // hoursSpentOutside is informational (portion of break outside allowed window)
                  // Calculate fresh to update when intervals change
                  const hoursSpentOutside = calculateHoursSpentOutside && entry.intervals && isComplete
                    ? calculateHoursSpentOutside(entry.intervals)
                    : 0;
                  
                  // Calculate extra hours based on hoursWorked (already net)
                  const dayOfWeek = new Date(entry.date).getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const standardHours = isWeekend ? 0 : 9;
                  const extraHours = hoursWorked - standardHours;
                  // Use same logic as useCalculations: 2x for weekends/holidays, 1.5x for regular days
                  const useDoubleFactor = isWeekend || entry.type === 'Holiday' || entry.type === 'Vacation';
                  const factor = useDoubleFactor ? 2 : 1.5;
                  // Match Excel logic: only apply factor to positive extra hours
                  const extraHoursWithFactor = extraHours > 0 ? parseFloat((extraHours * factor).toFixed(4)) : extraHours;
                  
                  const firstIn = entry.intervals?.[0]?.in;
                  const lastOut = entry.intervals?.[0]?.out; // First interval is the work period
                  
                  const breakIntervals = entry.intervals?.slice(1) || [];

                  return (
                    <tr key={entry.date}>
                      <td>{entry.date}</td>
                      <td>{formatTime(firstIn)}</td>
                      <td>{formatTime(lastOut)}</td>
                      <td>
                        {entry.type === 'Regular' 
                          ? `${hoursWorked.toFixed(2)}h` 
                          : entry.type
                        }
                      </td>
                      {detailedView && (
                        <>
                          <td className="hide-mobile">
                            {entry.type === 'Regular' ? `${extraHours.toFixed(2)}h` : '-'}
                          </td>
                          <td className="hide-mobile">
                            {entry.type === 'Regular' ? `${extraHoursWithFactor.toFixed(2)}h` : '-'}
                          </td>
                          <td className="hide-mobile">{entry.type}</td>
                          <td className="hide-mobile">
                            {breakIntervals.length > 0 
                              ? breakIntervals.map(b => formatTime(b.in)).join(', ')
                              : '-'
                            }
                          </td>
                          <td className="hide-mobile">
                            {breakIntervals.length > 0 
                              ? breakIntervals.map(b => formatTime(b.out)).join(', ')
                              : '-'
                            }
                          </td>
                          <td className="hide-mobile">
                            {entry.type === 'Regular' && hoursSpentOutside !== undefined && hoursSpentOutside !== null && hoursSpentOutside > 0
                              ? `${hoursSpentOutside.toFixed(2)}h` 
                              : '-'
                            }
                          </td>
                        </>
                      )}
                      <td className="actions-cell">
                        <button 
                          className="btn btn-sm btn-outline action-btn" 
                          title="Edit"
                          onClick={() => setEditingEntry(entry)}
                        >✏️
                          <span className="btn-text"> Edit</span>
                        </button>
                        <button 
                          className="btn btn-sm btn-danger action-btn" 
                          title="Delete"
                          onClick={() => deleteEntry(entry.date)}
                        >🗑️
                          <span className="btn-text"> Delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Totals Row */}
                <tr className="totals-row">
                  <td><strong>Total</strong></td>
                  <td colSpan="2"></td>
                  <td><strong>{overtimeDetails.totalHoursWorked.toFixed(2)}h</strong></td>
                  {detailedView && (
                    <>
                      <td className="hide-mobile"><strong>{overtimeDetails.totalExtraHours.toFixed(2)}h</strong></td>
                      <td className="hide-mobile"><strong>{overtimeDetails.totalExtraHoursWithFactor.toFixed(2)}h</strong></td>
                      <td className="hide-mobile" colSpan="4"></td>
                    </>
                  )}
                  <td></td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showManualIn && <ManualTimeModal mode="checkIn" onClose={() => setShowManualIn(false)} />}
      {showManualOut && <ManualTimeModal mode="checkOut" onClose={() => setShowManualOut(false)} />}
      {showAddBreak && <AddBreakModal onClose={() => setShowAddBreak(false)} />}
      {editingEntry && <EditEntryModal entry={editingEntry} onClose={() => setEditingEntry(null)} />}
    </main>
  );
}

export default Timesheet;
