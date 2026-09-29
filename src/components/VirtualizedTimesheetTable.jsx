import React, { useMemo, useRef, useState, useEffect } from 'react';
import { List } from 'react-window';
import { TimesheetRow } from './Timesheet.jsx';

const VirtualizedTimesheetTable = ({ 
  periodEntries, 
  detailedView, 
  formatTime, 
  calculateHoursWorked, 
  calculateHoursSpentOutside, 
  onEdit, 
  onDelete,
  overtimeDetails 
}) => {
  const outerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure the available container width and update on resize
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.floor(entry.contentRect.width));
      }
    });
    observer.observe(el);
    setContainerWidth(Math.floor(el.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  // Memoize row data to prevent unnecessary re-renders
  const rowData = useMemo(() => {
    return periodEntries.map((entry, index) => ({
      index,
      entry,
      detailedView,
      formatTime,
      calculateHoursWorked,
      calculateHoursSpentOutside,
      onEdit,
      onDelete
    }));
  }, [periodEntries, detailedView, formatTime, calculateHoursWorked, calculateHoursSpentOutside, onEdit, onDelete]);

  // Row component for react-window
  const Row = ({ index, style }) => {
    const { entry } = rowData[index];
    return (
      <div style={style}>
        <TimesheetRow 
          key={entry.date}
          entry={entry}
          detailedView={detailedView}
          formatTime={formatTime}
          calculateHoursWorked={calculateHoursWorked}
          calculateHoursSpentOutside={calculateHoursSpentOutside}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    );
  };

  // Calculate column widths based on view
  const getColumnWidths = () => {
    if (detailedView) {
      return {
        date: 100,
        day: 80,
        checkIn: 120,
        checkOut: 120,
        hours: 120,
        extraHours: 130,
        extraHoursFactor: 180,
        type: 100,
        checkOutWithin: 180,
        checkInWithin: 180,
        hoursOutside: 160,
        actions: 120
      };
    } else {
      return {
        date: 100,
        day: 80,
        checkIn: 120,
        checkOut: 120,
        hours: 120,
        actions: 120
      };
    }
  };

  const columnWidths = getColumnWidths();
  const totalWidth = Object.values(columnWidths).reduce((sum, w) => sum + w, 0);
  const rowHeight = 60;

  // The List width is: if we have room, use containerWidth; otherwise use totalWidth
  // The outer container shows a scrollbar when totalWidth > containerWidth
  const listWidth = containerWidth > 0 ? Math.max(totalWidth, containerWidth) : totalWidth;
  const showScroll = containerWidth > 0 && totalWidth > containerWidth;

  const headerStyle = {
    display: 'flex',
    width: `${totalWidth}px`,
    minWidth: '100%',
    background: 'rgba(0,0,0,0.3)',
    borderBottom: '1px solid var(--border-light)',
    fontWeight: 700,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--text-secondary)',
  };

  const cellStyle = (width) => ({
    width: `${width}px`,
    minWidth: `${width}px`,
    padding: '12px 16px',
    flexShrink: 0,
  });

  const footerStyle = {
    display: 'flex',
    width: `${totalWidth}px`,
    minWidth: '100%',
    borderTop: '2px solid var(--accent-cyan)',
    background: 'rgba(99, 102, 241, 0.05)',
    fontWeight: 700,
    fontSize: '13px',
    color: 'var(--accent-cyan)',
  };

  return (
    /* Nuclear outer wrapper — all inline styles, zero CSS class dependency */
    <div
      ref={outerRef}
      style={{
        width: '100%',
        overflowX: showScroll ? 'auto' : 'hidden',
        overflowY: 'visible',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.2) transparent',
        borderRadius: '12px',
        border: '1px solid var(--border-light)',
        background: 'var(--bg-secondary)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        marginBottom: '24px',
      }}
    >
      {/* Header */}
      <div style={headerStyle}>
        <div style={cellStyle(columnWidths.date)}>DATE</div>
        <div style={cellStyle(columnWidths.day)}>DAY</div>
        <div style={cellStyle(columnWidths.checkIn)}>CHECK IN</div>
        <div style={cellStyle(columnWidths.checkOut)}>CHECK OUT</div>
        <div style={cellStyle(columnWidths.hours)}>HOURS SPENT</div>
        {detailedView && (
          <>
            <div style={cellStyle(columnWidths.extraHours)}>EXTRA HOURS</div>
            <div style={cellStyle(columnWidths.extraHoursFactor)}>EXTRA HOURS ×FACTOR</div>
            <div style={cellStyle(columnWidths.type)}>TYPE</div>
            <div style={cellStyle(columnWidths.checkOutWithin)}>CHECK OUT WITHIN DAY</div>
            <div style={cellStyle(columnWidths.checkInWithin)}>CHECK IN WITHIN DAY</div>
            <div style={cellStyle(columnWidths.hoursOutside)}>HOURS SPENT OUTSIDE</div>
          </>
        )}
        <div style={cellStyle(columnWidths.actions)}>ACTIONS</div>
      </div>

      {/* Body */}
      {periodEntries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          No entries found for this period.
        </div>
      ) : (
        <>
          {containerWidth > 0 && (
            <List
              height={Math.min(periodEntries.length * rowHeight, 500)}
              itemCount={periodEntries.length}
              itemSize={rowHeight}
              width={listWidth}
              overscanCount={5}
            >
              {Row}
            </List>
          )}

          {/* Totals Row */}
          <div style={footerStyle}>
            <div style={{ ...cellStyle(columnWidths.date) }}>Total</div>
            <div style={cellStyle(columnWidths.day)}></div>
            <div style={cellStyle(columnWidths.checkIn)}></div>
            <div style={cellStyle(columnWidths.checkOut)}></div>
            <div style={cellStyle(columnWidths.hours)}>
              {overtimeDetails.totalHoursWorked.toFixed(2)}h
            </div>
            {detailedView && (
              <>
                <div style={cellStyle(columnWidths.extraHours)}>
                  {overtimeDetails.totalExtraHours.toFixed(2)}h
                </div>
                <div style={cellStyle(columnWidths.extraHoursFactor)}>
                  {overtimeDetails.totalExtraHoursWithFactor.toFixed(2)}h
                </div>
                <div style={cellStyle(columnWidths.type)}></div>
                <div style={cellStyle(columnWidths.checkOutWithin)}></div>
                <div style={cellStyle(columnWidths.checkInWithin)}></div>
                <div style={cellStyle(columnWidths.hoursOutside)}></div>
              </>
            )}
            <div style={cellStyle(columnWidths.actions)}></div>
          </div>
        </>
      )}
    </div>
  );
};

export default VirtualizedTimesheetTable;
