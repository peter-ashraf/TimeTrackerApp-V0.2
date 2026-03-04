import React, { useMemo } from 'react';
import { List } from 'react-window';
import TimesheetRow from './Timesheet';

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
        checkIn: 120,
        checkOut: 120,
        hours: 100,
        extraHours: 100,
        extraHoursFactor: 120,
        type: 100,
        checkOutWithin: 140,
        checkInWithin: 140,
        hoursOutside: 120,
        actions: 120
      };
    } else {
      return {
        date: 100,
        checkIn: 120,
        checkOut: 120,
        hours: 100,
        actions: 120
      };
    }
  };

  const columnWidths = getColumnWidths();
  const totalWidth = Object.values(columnWidths).reduce((sum, width) => sum + width, 0);
  const rowHeight = 50; // Height of each row

  return (
    <div className="virtualized-table-container">
      {/* Header */}
      <div className="virtualized-table-header" style={{ display: 'flex', width: `${totalWidth}px` }}>
        <div style={{ width: `${columnWidths.date}px`, padding: '8px', fontWeight: 'bold' }}>DATE</div>
        <div style={{ width: `${columnWidths.checkIn}px`, padding: '8px', fontWeight: 'bold' }}>CHECK IN</div>
        <div style={{ width: `${columnWidths.checkOut}px`, padding: '8px', fontWeight: 'bold' }}>CHECK OUT</div>
        <div style={{ width: `${columnWidths.hours}px`, padding: '8px', fontWeight: 'bold' }}>HOURS SPENT</div>
        {detailedView && (
          <>
            <div style={{ width: `${columnWidths.extraHours}px`, padding: '8px', fontWeight: 'bold' }} className="hide-mobile">EXTRA HOURS</div>
            <div style={{ width: `${columnWidths.extraHoursFactor}px`, padding: '8px', fontWeight: 'bold' }} className="hide-mobile">EXTRA HOURS xFACTOR</div>
            <div style={{ width: `${columnWidths.type}px`, padding: '8px', fontWeight: 'bold' }} className="hide-mobile">TYPE</div>
            <div style={{ width: `${columnWidths.checkOutWithin}px`, padding: '8px', fontWeight: 'bold' }} className="hide-mobile">CHECK OUT WITHIN DAY</div>
            <div style={{ width: `${columnWidths.checkInWithin}px`, padding: '8px', fontWeight: 'bold' }} className="hide-mobile">CHECK IN WITHIN DAY</div>
            <div style={{ width: `${columnWidths.hoursOutside}px`, padding: '8px', fontWeight: 'bold' }} className="hide-mobile">HOURS SPENT OUTSIDE</div>
          </>
        )}
        <div style={{ width: `${columnWidths.actions}px`, padding: '8px', fontWeight: 'bold' }}>ACTIONS</div>
      </div>

      {/* Virtualized List */}
      {periodEntries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', width: '100%' }}>
          No entries found for this period.
        </div>
      ) : (
        <>
          <List
            height={400} // Fixed height for the virtualized container
            itemCount={periodEntries.length}
            itemSize={rowHeight}
            width={totalWidth}
            overscanCount={5} // Render 5 extra rows above/below for smoother scrolling
          >
            {Row}
          </List>
          
          {/* Totals Row */}
          <div className="virtualized-table-footer" style={{ display: 'flex', width: `${totalWidth}px`, borderTop: '2px solid #ddd' }}>
            <div style={{ width: `${columnWidths.date}px`, padding: '8px', fontWeight: 'bold' }}>Total</div>
            <div style={{ width: `${columnWidths.checkIn}px`, padding: '8px' }}></div>
            <div style={{ width: `${columnWidths.checkOut}px`, padding: '8px' }}></div>
            <div style={{ width: `${columnWidths.hours}px`, padding: '8px', fontWeight: 'bold' }}>
              {overtimeDetails.totalHoursWorked.toFixed(2)}h
            </div>
            {detailedView && (
              <>
                <div style={{ width: `${columnWidths.extraHours}px`, padding: '8px', fontWeight: 'bold' }} className="hide-mobile">
                  {overtimeDetails.totalExtraHours.toFixed(2)}h
                </div>
                <div style={{ width: `${columnWidths.extraHoursFactor}px`, padding: '8px', fontWeight: 'bold' }} className="hide-mobile">
                  {overtimeDetails.totalExtraHoursWithFactor.toFixed(2)}h
                </div>
                <div style={{ width: `${columnWidths.type}px`, padding: '8px' }} className="hide-mobile"></div>
                <div style={{ width: `${columnWidths.checkOutWithin}px`, padding: '8px' }} className="hide-mobile"></div>
                <div style={{ width: `${columnWidths.checkInWithin}px`, padding: '8px' }} className="hide-mobile"></div>
                <div style={{ width: `${columnWidths.hoursOutside}px`, padding: '8px' }} className="hide-mobile"></div>
              </>
            )}
            <div style={{ width: `${columnWidths.actions}px`, padding: '8px' }}></div>
          </div>
        </>
      )}
    </div>
  );
};

export default VirtualizedTimesheetTable;
