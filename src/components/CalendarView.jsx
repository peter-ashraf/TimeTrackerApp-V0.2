import React, { useState, useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import '../styles/calendar-view.css';

function CalendarView({ entries, onDateClick, onEntryClick }) {
  const [value, onChange] = useState(new Date());

  // Create a map of dates to entries for quick lookup
  const entriesByDate = useMemo(() => {
    const map = {};
    entries.forEach(entry => {
      if (entry.date) {
        map[entry.date] = entry;
      }
    });
    return map;
  }, [entries]);

  // Function to get the color based on entry type
  const getEntryColor = (entry) => {
    if (!entry) return null;
    switch (entry.type) {
      case 'Regular':
        return 'var(--color-success)';
      case 'Vacation':
        return '#9b59b6'; // Purple
      case 'Sick Leave':
        return 'var(--color-error)';
      case 'Holiday':
        return 'var(--color-warning)';
      case 'Leave':
        return 'var(--color-info)';
      case 'To Be Added':
        return 'var(--color-text-secondary)';
      default:
        return 'var(--color-text)';
    }
  };

  // Function to get the entry summary for a date
  const getEntrySummary = (date) => {
    // Fix timezone issue by using local date components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const entry = entriesByDate[dateStr];
    if (!entry) return null;

    if (entry.type === 'Regular' && entry.intervals) {
      const hours = entry.intervals.reduce((total, interval) => {
        if (interval.in && interval.out) {
          const inTime = new Date(`2000-01-01T${interval.in}`);
          const outTime = new Date(`2000-01-01T${interval.out}`);
          return total + (outTime - inTime) / (1000 * 60 * 60);
        }
        return total;
      }, 0);
      return `${hours.toFixed(2)}h`;
    }

    return entry.type;
  };

  // Custom tile content to show entry indicators
  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      // Fix timezone issue by using local date components
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const entry = entriesByDate[dateStr];
      
      if (entry) {
        const color = getEntryColor(entry);
        const summary = getEntrySummary(date);
        
        return (
          <div className="calendar-entry-indicator" style={{ borderColor: color }}>
            <span className="calendar-entry-summary" style={{ color }}>
              {summary}
            </span>
          </div>
        );
      }
    }
    return null;
  };

  // Custom tile class for styling
  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      // Fix timezone issue by using local date components
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const entry = entriesByDate[dateStr];
      
      if (entry) {
        return `calendar-tile-with-entry calendar-tile-${entry.type.toLowerCase().replace(' ', '-')}`;
      }
    }
    return null;
  };

  const handleDateClick = (date) => {
    // Fix timezone issue by using local date components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const entry = entriesByDate[dateStr];
    
    if (entry && onEntryClick) {
      onEntryClick(entry);
    } else if (onDateClick) {
      onDateClick(dateStr);
    }
  };

  return (
    <div className="calendar-view-container">
      <div className="calendar-header">
        <h3>📅 Calendar View</h3>
        <div className="calendar-legend">
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: 'var(--color-success)' }}></span>
            <span className="legend-label">Regular</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#9b59b6' }}></span>
            <span className="legend-label">Vacation</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: 'var(--color-error)' }}></span>
            <span className="legend-label">Sick Leave</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: 'var(--color-warning)' }}></span>
            <span className="legend-label">Holiday</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: 'var(--color-info)' }}></span>
            <span className="legend-label">Leave</span>
          </div>
        </div>
      </div>
      
      <div className="calendar-wrapper">
        <Calendar
          onChange={onChange}
          value={value}
          tileContent={tileContent}
          tileClassName={tileClassName}
          onClickDay={handleDateClick}
        />
      </div>
      
      <div className="calendar-info">
        <p className="calendar-help-text">
          💡 Click on a date to view or edit its time entry
        </p>
      </div>
    </div>
  );
}

export default CalendarView;
