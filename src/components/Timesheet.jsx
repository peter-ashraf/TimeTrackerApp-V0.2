import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import hapticFeedback from '../utils/hapticFeedback';
import { debounce } from '../utils/performanceUtils';
import ManualTimeModal from './ManualTimeModal';
import AddBreakModal from './AddBreakModal';
import EditEntryModal from './EditEntryModal';
import TimesheetCompareModal from './TimesheetCompareModal';
import VirtualizedTimesheetTable from './VirtualizedTimesheetTable';
import CustomSelect from './CustomSelect';
import CalendarView from './CalendarView';
import '../styles/performance-optimizations.css';
import './bento-timesheet.css';

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
    <div className="stacked-row" key={entry.date}>
      <div className="stacked-top">
        <div className="stacked-date">
          <i className="fa-regular fa-calendar"></i>
          <strong>{dayOfWeekDisplay}, {entry.date}</strong>
        </div>
        <div className={`status-badge ${entry.type === 'Regular' ? 'status-normal' : entry.type === 'Vacation' ? 'status-vacation' : 'status-other'}`}>
          {entry.type}
        </div>
        <div className="stacked-actions">
          <button className="icon-btn" onClick={() => { hapticFeedback.buttonClick(); onEdit(entry); }}>
            <i className="fa-solid fa-pen"></i>
          </button>
          <button className="icon-btn delete-btn" onClick={() => { hapticFeedback.error(); onDelete(entry.date); }}>
            <i className="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>
      
      <div className="stacked-bottom">
        <div className="stacked-timeline" style={{width: '100%', display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {formatTime(firstIn)} &rarr; {formatTime(lastOut)}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', alignSelf: 'flex-end'}}>
              {entry.type === 'Regular' ? `${hoursWorked.toFixed(2)}h` : '-'}
          </div>
        </div>
        <div className="stacked-metrics">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            
            <div style={{ visibility: detailedView ? 'visible' : 'hidden', display: detailedView ? 'block' : 'none' }}>
              <span>
                Extra: {extraHours > 0 ? '+' : ''}{extraHours.toFixed(2)}h | Factor: {extraHoursWithFactor > 0 ? '+' : ''}{extraHoursWithFactor.toFixed(2)}h
              </span>
            </div>
            {breakIntervals.length > 0 && (
              <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                Breaks: {breakIntervals.map(b => `${formatTime(b.in)} \u2192 ${formatTime(b.out)}`).join(', ')} 
                {hoursSpentOutside > 0 ? ` (${hoursSpentOutside.toFixed(2)}h outside)` : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

function Timesheet({ setCurrentView }) {
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
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'calendar'

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
    return periods.find(p => String(p.id) === String(viewingPeriodId)) || getCurrentPeriod();
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
    <main className="main-content" style={{ minWidth: 0, maxWidth: '100%', padding: '0 20px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      {hasNoPeriods ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2>⚠️ No Periods Found</h2>
          <p style={{ marginBottom: '20px' }}>
            You need to create a pay period to track your time entries.
          </p>
          <button
            onClick={() => {
              hapticFeedback.buttonClick();
              localStorage.setItem('shouldOpenAddPeriod', 'true');
              setCurrentView?.('settings');
              window.dispatchEvent(new Event('open-add-period-settings'));
            }}
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

          {/* Period and Hero Action */}
          <div className="bento-grid" style={{ marginBottom: '24px' }}>
            {/* Period Selector (Hero Tile) */}
            <div className="bento-tile no-hover col-span-6" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'visible', zIndex: 10 }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>Period</label>
              <CustomSelect
                id="period-select"
                name="period"
                options={(() => {
                  const opts = [];
                  getGroupedPeriods().forEach(({ year, periods: yearPeriods }) => {
                    opts.push({ label: `--- ${year} ---`, value: `year-${year}`, disabled: true });
                    yearPeriods.forEach(period => {
                      opts.push({
                        label: `${period.label} ${String(period.id) === String(currentPeriodId) ? '(Current)' : ''}`,
                        value: period.id
                      });
                    });
                  });
                  return opts;
                })()}
                value={viewingPeriodId}
                onChange={(e) => setViewingPeriodId(e.target.value)}
              />
            </div>
          </div>

          {/* Display Controls above the Table */}
          <div className="bento-grid" style={{ marginBottom: '24px' }}>
            <div className="bento-action-grid">
              {/* Time Format Toggle */}
              <div className="bento-tile tile-action bento-action-btn" onClick={() => { hapticFeedback.buttonClick(); setUse12Hour(!use12Hour); }}>
                <i className="fa-regular fa-clock" style={{ fontSize: '24px' }}></i>
                <span style={{ fontSize: '13px', textAlign: 'center' }}>{use12Hour ? '12h Clock' : '24h Clock'}</span>
              </div>

              {/* Detail Mode Toggle */}
              <div className="bento-tile tile-action bento-action-btn" onClick={() => { hapticFeedback.buttonClick(); setDetailedView(!detailedView); }}>
                <i className={`fa-solid ${detailedView ? 'fa-list-check' : 'fa-list'}`} style={{ fontSize: '24px' }}></i>
                <span style={{ fontSize: '13px', textAlign: 'center' }}>{detailedView ? 'Detailed' : 'Simple'}</span>
              </div>

              {/* View Mode Toggle */}
              <div className="bento-tile tile-action bento-action-btn" onClick={() => { hapticFeedback.buttonClick(); setViewMode(viewMode === 'calendar' ? 'table' : 'calendar'); }}>
                <i className={`fa-solid ${viewMode === 'calendar' ? 'fa-calendar' : 'fa-table'}`} style={{ fontSize: '24px' }}></i>
                <span style={{ fontSize: '13px', textAlign: 'center' }}>{viewMode === 'calendar' ? 'Calendar' : 'Table'}</span>
              </div>
            </div>
          </div>

          {/* Table Container */}

          {/* Table Container */}
          <div className="bento-table-container" style={{ overflow: 'visible', display: 'block', boxSizing: 'border-box' }}>
            {viewMode === 'calendar' ? (
              <CalendarView
                entries={displayEntries}
                onDateClick={(dateStr) => {
                  console.log('Date clicked:', dateStr);
                }}
                onEntryClick={(entry) => {
                  setEditingEntry(entry);
                }}
              />
            ) : (
              <div className="stacked-list-container bento-tile" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="stacked-list stacked-list-scrollable">
                  {periodEntries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                      <i className="fa-regular fa-folder-open" style={{ fontSize: '32px', opacity: 0.5, marginBottom: '16px', display: 'block' }}></i>
                      <p>No entries found for this period.</p>
                    </div>
                  ) : (
                    periodEntries.map((entry) => (
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
                    ))
                  )}
                </div>
                
                {periodEntries.length > 0 && (
                  <div className="glass-table-footer" style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <i className="fa-solid fa-chart-pie" style={{ color: 'var(--accent-cyan)', fontSize: '20px' }}></i>
                        <span style={{ fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '14px' }}>Total</span>
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                        {overtimeDetails.totalHoursWorked.toFixed(2)}<span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: '800', marginLeft: '2px' }}>h</span>
                      </div>
                    </div>
                    
                    {detailedView && (
                      <div style={{ display: 'flex', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        <span>Extra: {(overtimeDetails.totalExtraHours > 0 ? '+' : '')}{overtimeDetails.totalExtraHours.toFixed(2)}h</span>
                        <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>|</span>
                        <span>Factor: {(overtimeDetails.totalExtraHoursWithFactor > 0 ? '+' : '')}{overtimeDetails.totalExtraHoursWithFactor.toFixed(2)}h</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls under the Table */}
          <div className="bento-grid" style={{ marginTop: '24px' }}>
            {/* Compare HR Data (Full width Hero Action) */}
            <div className="bento-tile tile-action col-span-6" onClick={() => { hapticFeedback.buttonClick(); setShowCompareModal(true); }}>
              <i className="fa-solid fa-code-compare" style={{ color: 'var(--accent-cyan)' }}></i>
              <span style={{ color: 'var(--text-primary)' }}>Compare HR Data</span>
            </div>

            <div className="bento-action-grid">
              <div className="bento-tile tile-action bento-action-btn" onClick={() => { hapticFeedback.buttonClick(); setShowManualIn(true); }}>
                <i className="fa-solid fa-clock" style={{ fontSize: '24px' }}></i>
                <span style={{ fontSize: '13px', textAlign: 'center' }}>Manual In</span>
              </div>
              
              <div className="bento-tile tile-action bento-action-btn" onClick={() => { hapticFeedback.buttonClick(); setShowManualOut(true); }}>
                <i className="fa-regular fa-clock" style={{ fontSize: '24px' }}></i>
                <span style={{ fontSize: '13px', textAlign: 'center' }}>Manual Out</span>
              </div>
              
              <div className="bento-tile tile-action bento-action-btn" onClick={() => { hapticFeedback.buttonClick(); setShowAddBreak(true); }}>
                <i className="fa-solid fa-mug-hot" style={{ fontSize: '24px' }}></i>
                <span style={{ fontSize: '13px', textAlign: 'center' }}>Add Break</span>
              </div>
            </div>
          </div>

          {/* Modals */}
          {showManualIn && <ManualTimeModal mode="checkIn" onClose={() => setShowManualIn(false)} />}
          {showManualOut && <ManualTimeModal mode="checkOut" onClose={() => setShowManualOut(false)} />}
          {showAddBreak && <AddBreakModal onClose={() => setShowAddBreak(false)} />}
          {showCompareModal && (
            <TimesheetCompareModal
              onClose={() => setShowCompareModal(false)}
              onEditEntry={setEditingEntry}
            />
          )}
          {editingEntry && <EditEntryModal entry={editingEntry} onClose={() => setEditingEntry(null)} />}
        </>
      )}
    </main>
  );
}

export { TimesheetRow };
export default Timesheet;
