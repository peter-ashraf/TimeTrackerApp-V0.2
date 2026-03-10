import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import hapticFeedback from '../utils/hapticFeedback';
import { debounce } from '../utils/performanceUtils';
import ManualTimeModal from './ManualTimeModal';
import AddBreakModal from './AddBreakModal';
import EditEntryModal from './EditEntryModal';
import NoPeriodPrompt from './NoPeriodPrompt';
import VirtualizedTimesheetTable from './VirtualizedTimesheetTable';
import '../styles/performance-optimizations.css';

// Memoized individual row component to prevent unnecessary re-renders
const TimesheetRow = React.memo(({ 
  entry, 
  detailedView, 
  formatTime, 
  calculateHoursWorked, 
  calculateHoursSpentOutside, 
  onEdit, 
  onDelete 
}) => {
  // For incomplete entries, calculate fresh to avoid stored negative values
  const isComplete = entry.intervals && 
    entry.intervals.length > 0 && 
    entry.intervals.every(interval => interval.in && interval.out);
  
  const hoursWorked = entry.type === 'Regular' && entry.intervals && isComplete
    ? calculateHoursWorked(entry.intervals, entry.date) 
    : 0;
  
  const hoursSpentOutside = calculateHoursSpentOutside && entry.intervals && isComplete
    ? calculateHoursSpentOutside(entry.intervals)
    : 0;
  
  const dayOfWeek = new Date(entry.date).getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const standardHours = isWeekend ? 0 : 9;
  const extraHours = hoursWorked - standardHours;
  const useDoubleFactor = isWeekend || entry.type === 'Holiday' || entry.type === 'Vacation';
  const factor = useDoubleFactor ? 2 : 1.5;
  const extraHoursWithFactor = extraHours > 0 ? parseFloat((extraHours * factor).toFixed(4)) : extraHours;
  
  const firstIn = entry.intervals?.[0]?.in;
  const lastOut = entry.intervals?.[0]?.out;
  const breakIntervals = entry.intervals?.slice(1) || [];
  
  // Calculate day of week display
  const dayOfWeekDisplay = new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short' });

  return (
    <tr key={entry.date}>
      <td>{entry.date}</td>
      <td>{dayOfWeekDisplay}</td>
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
          onClick={() => {
            hapticFeedback.buttonClick();
            onEdit(entry);
          }}
        >✏️
          <span className="btn-text"> Edit</span>
        </button>
        <button 
          className="btn btn-sm btn-danger action-btn" 
          title="Delete"
          onClick={() => {
            hapticFeedback.error();
            onDelete(entry.date);
          }}
        >🗑️
          <span className="btn-text"> Delete</span>
        </button>
      </td>
    </tr>
  );
});

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
  const [showNoPeriodPrompt, setShowNoPeriodPrompt] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredEntries, setFilteredEntries] = useState([]);

  // Debounced search function
  const debouncedSearch = useMemo(
    () => debounce((term) => {
      if (!term.trim()) {
        setFilteredEntries([]);
      } else {
        const filtered = entries.filter(entry => 
          entry.date.includes(term) ||
          entry.type.toLowerCase().includes(term.toLowerCase()) ||
          (entry.notes && entry.notes.toLowerCase().includes(term.toLowerCase()))
        );
        setFilteredEntries(filtered);
      }
    }, 300),
    [entries]
  );

  // Handle search input change
  const handleSearchChange = useCallback((e) => {
    const term = e.target.value;
    setSearchTerm(term);
    debouncedSearch(term);
  }, [debouncedSearch]);

  // Get entries to display (filtered or all)
  const displayEntries = useMemo(() => {
    return searchTerm.trim() ? filteredEntries : entries;
  }, [searchTerm, filteredEntries, entries]);

  // Check if there are any periods
  const hasNoPeriods = periods.length === 0;

  // Use local state for viewing period (separate from "current" period)
  // Initialize with empty string instead of null to avoid React warning
  const [viewingPeriodId, setViewingPeriodId] = useState('');
  
  // Update viewing period when current period changes
  useEffect(() => {
    if (currentPeriodId && viewingPeriodId !== currentPeriodId) {
      setViewingPeriodId(currentPeriodId);
    }
  }, [currentPeriodId]);
  
  // Initialize on mount
  useEffect(() => {
    if (!viewingPeriodId && currentPeriodId) {
      setViewingPeriodId(currentPeriodId);
    }
  }, [currentPeriodId, viewingPeriodId]);
  
  const viewingPeriod = useMemo(() => {
    return periods.find(p => p.id === viewingPeriodId) || getCurrentPeriod();
  }, [periods, viewingPeriodId, getCurrentPeriod]);

  // Filter and sort entries for VIEWING period
  const periodEntries = useMemo(() => {
    const entriesToUse = displayEntries;
    
    if (!viewingPeriod) return [...entriesToUse].sort((a, b) => a.date.localeCompare(b.date));
    
    const periodStart = viewingPeriod.start_date || viewingPeriod.start;
    const periodEnd = viewingPeriod.end_date || viewingPeriod.end;
    
    return entriesToUse
      .filter(e => e.date >= periodStart && e.date <= periodEnd)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [displayEntries, viewingPeriod]);

  // Threshold for virtualization - use virtualized table for more than 50 entries
  const VIRTUALIZATION_THRESHOLD = 50;
  const shouldUseVirtualization = periodEntries.length > VIRTUALIZATION_THRESHOLD;

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
    
    const periodStart = viewingPeriod.start_date || viewingPeriod.start;
    const periodEnd = viewingPeriod.end_date || viewingPeriod.end;
    
    const result = calculateOvertimeDetails(entries, periodStart, periodEnd);
    
    return result;
  }, [entries, viewingPeriod, calculateOvertimeDetails]);

  // Helper function to group periods by year and sort chronologically
  const getGroupedPeriods = () => {
    if (!periods || periods.length === 0) return [];
    
    // Sort all periods by start date (oldest first) with null checks
    const sortedPeriods = [...periods].sort((a, b) => {
      const dateA = a.start_date || a.start || '';
      const dateB = b.start_date || b.start || '';
      return dateA.localeCompare(dateB);
    });
    
    // Group by year
    const grouped = {};
    sortedPeriods.forEach(period => {
      const dateStr = period.start_date || period.start || '';
      const year = new Date(dateStr).getFullYear();
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push(period);
    });
    
    // Convert to array and sort years in descending order (newest first)
    return Object.entries(grouped)
      .map(([year, yearPeriods]) => ({
        year: parseInt(year),
        periods: yearPeriods
      }))
      .sort((a, b) => b.year - a.year);
  };

  return (
    <main className="main-content">
      {hasNoPeriods ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2>⚠️ No Periods Found</h2>
          <p style={{ marginBottom: '20px' }}>
            You need to create a pay period to track your time entries.
          </p>
          <button
            onClick={() => setShowNoPeriodPrompt(true)}
            style={{
              padding: '12px 24px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Create Your First Period
          </button>
        </div>
      ) : (
        <>
          <h1>Timesheet</h1>

      {/* Timesheet Controls */}
      <div className="timesheet-controls">
                {/* ✅ UPDATED: Period Selector grouped by year */}
        <div className="month-selector">
          <label>Select Period:</label>
          <select 
            className="form-control"
            value={viewingPeriodId}
            onChange={(e) => setViewingPeriodId(e.target.value)}
          >
            {getGroupedPeriods().map(({ year, periods: yearPeriods }) => (
              <optgroup key={year} label={`${year}`}>
                {yearPeriods.map(period => (
                  <option key={period.id} value={period.id}>
                    {period.label} {period.is_current && '(Current)'}
                  </option>
                ))}
              </optgroup>
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

      {/* Search Input */}
        <div className="search-container"
            style={{ display: "flex", gap: "10px", width: '100%'}}>
          <input
            type="text"
            placeholder="Search by date, type, or notes..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="form-control search-input"
          />
          {searchTerm && (
            <button
              className="btn btn-sm btn-outline"
              onClick={() => {
                setSearchTerm('');
                setFilteredEntries([]);
              }}
              style={{ minWidth: '40px' }}
            >
              ✕
            </button>
          )}
        </div>

      

      {/* Manual Time Actions */}
      <div className="manual-time-actions">
        <button 
          className="btn btn-secondary manual-check-in-btn"
          onClick={() => {
            hapticFeedback.buttonClick();
            setShowManualIn(true);
          }}
        >
          👈 Manual In
        </button>
        <button 
          className="btn btn-secondary manual-check-out-btn"
          onClick={() => {
            hapticFeedback.buttonClick();
            setShowManualOut(true);
          }}
        >
          👉 Manual Out
        </button>
        <button 
          type="button" 
          className="btn btn-secondary add-break-btn"
          onClick={() => {
            hapticFeedback.buttonClick();
            setShowAddBreak(true);
          }}
        >
          + Add Break
        </button>
      </div>

      {/* Table Container */}
      <div id="tableContainer">
        {shouldUseVirtualization ? (
          <VirtualizedTimesheetTable
            periodEntries={displayEntries.filter(entry => {
              if (!viewingPeriod) return true;
              const periodStart = viewingPeriod.start_date || viewingPeriod.start;
              const periodEnd = viewingPeriod.end_date || viewingPeriod.end;
              return entry.date >= periodStart && entry.date <= periodEnd;
            })}
            detailedView={detailedView}
            formatTime={formatTime}
            calculateHoursWorked={calculateHoursWorked}
            calculateHoursSpentOutside={calculateHoursSpentOutside}
            onEdit={setEditingEntry}
            onDelete={deleteEntry}
            overtimeDetails={overtimeDetails}
          />
        ) : (
          <table className={`data-table ${detailedView ? 'detailed-view' : ''}`}>
            <thead>
              <tr>
                <th>DATE</th>
                <th>DAY</th>
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
                  <td colSpan={detailedView ? "12" : "6"} style={{textAlign: 'center', padding: '20px'}}>
                    No entries found for this period.
                  </td>
                </tr>
              ) : (
                <>
                  {periodEntries.map((entry) => (
                    <TimesheetRow 
                      key={entry.date}
                      entry={entry}
                      detailedView={detailedView}
                      formatTime={formatTime}
                      calculateHoursWorked={calculateHoursWorked}
                      calculateHoursSpentOutside={calculateHoursSpentOutside}
                      onEdit={setEditingEntry}
                      onDelete={deleteEntry}
                    />
                  ))}

                  {/* Totals Row */}
                  <tr className="totals-row">
                    <td><strong>Total</strong></td>
                    <td></td>
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
        )}
      </div>

      {/* Modals */}
      {showManualIn && <ManualTimeModal mode="checkIn" onClose={() => setShowManualIn(false)} />}
      {showManualOut && <ManualTimeModal mode="checkOut" onClose={() => setShowManualOut(false)} />}
      {showAddBreak && <AddBreakModal onClose={() => setShowAddBreak(false)} />}
      {editingEntry && <EditEntryModal entry={editingEntry} onClose={() => setEditingEntry(null)} />}
      {showNoPeriodPrompt && <NoPeriodPrompt onOpenSettings={() => {/* TODO: Open settings */}} onClose={() => setShowNoPeriodPrompt(false)} />}
        </>
      )}
    </main>
  );
}

export { TimesheetRow };
export default Timesheet;
