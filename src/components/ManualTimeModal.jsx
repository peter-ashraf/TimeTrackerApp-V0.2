import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';

function ManualTimeModal({ mode, onClose }) {
  const { setEntries, entries, formatDate, getCurrentPeriod, updateEntry } = useTimeTracker();
  const [applyMode, setApplyMode] = useState('today');
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [timeValue, setTimeValue] = useState('');

  const handleSave = () => {
    const dateToUse = applyMode === 'today' ? formatDate(new Date()) : selectedDate;
    
    if (!timeValue) {
      alert('Please enter a time');
      return;
    }

    // Ensure time has seconds
    const timeWithSeconds = timeValue.split(':').length === 2 ? timeValue + ':00' : timeValue;

    // Check if date is in current period
    const currentPeriod = getCurrentPeriod();
    if (currentPeriod && (dateToUse < currentPeriod.start || dateToUse > currentPeriod.end)) {
      const proceed = window.confirm(`Warning: ${dateToUse} is outside the current period (${currentPeriod.label}). Do you want to continue?`);
      if (!proceed) return;
    }

    const existingEntry = entries.find(e => e.date === dateToUse);

    if (mode === 'checkIn') {
      if (existingEntry) {
        const lastInterval = existingEntry.intervals?.[existingEntry.intervals.length - 1];
        if (lastInterval && !lastInterval.out) {
          alert('Already checked in');
          return;
        }
        
        // Add new check-in interval
        updateEntry(dateToUse, {
          intervals: [...existingEntry.intervals, { in: timeWithSeconds, out: null }]
        });
      } else {
        // Create new entry
        setEntries([...entries, {
          date: dateToUse,
          type: 'Regular',
          intervals: [{ in: timeWithSeconds, out: null }],
          hoursWorked: 0,
          extraHours: 0,
          extraHoursWithFactor: 0,
          hoursSpentOutside: 0
        }]);
      }
      alert(`Manually checked in at ${timeWithSeconds} on ${dateToUse}`);
    } else {
      // Check out
      if (!existingEntry || !existingEntry.intervals?.length) {
        alert('No active check-in found');
        return;
      }
      const lastInterval = existingEntry.intervals[existingEntry.intervals.length - 1];
      if (lastInterval.out) {
        alert('Already checked out');
        return;
      }
      
      // Update last interval with check-out time
      const updatedIntervals = existingEntry.intervals.map((interval, idx) =>
        idx === existingEntry.intervals.length - 1
          ? { ...interval, out: timeWithSeconds }
          : interval
      );

      updateEntry(dateToUse, {
        intervals: updatedIntervals
      });
      
      alert(`Manually checked out at ${timeWithSeconds} on ${dateToUse}`);
    }

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{mode === 'checkIn' ? 'Manual Check In' : 'Manual Check Out'}</h2>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Apply for</label>
            <select 
              className="form-control"
              value={applyMode}
              onChange={(e) => setApplyMode(e.target.value)}
            >
              <option value="today">Today ({formatDate(new Date())})</option>
              <option value="date">Specific date</option>
            </select>
          </div>

          {applyMode === 'date' && (
            <div className="form-group">
              <label className="form-label">Select date</label>
              <input
                type="date"
                className="form-control"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Time (HH:MM:SS)</label>
            <input
              type="time"
              step="1"
              className="form-control"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default ManualTimeModal;
