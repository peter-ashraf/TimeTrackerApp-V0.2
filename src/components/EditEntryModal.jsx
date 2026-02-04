import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';

function EditEntryModal({ entry, onClose }) {
  const { updateEntry } = useTimeTracker();
  
  // ✅ Convert HH:MM:SS to display format (keep seconds)
  const formatTimeForDisplay = (time) => {
    if (!time) return '';
    // If already HH:MM:SS, return as-is
    if (time.split(':').length === 3) return time;
    // If HH:MM, add :00
    return time + ':00';
  };

  const [editedEntry, setEditedEntry] = useState({
    ...entry,
    intervals: (entry.intervals || []).map(interval => ({
      in: formatTimeForDisplay(interval.in),
      out: formatTimeForDisplay(interval.out)
    }))
  });

  // ✅ Validate time format HH:MM:SS
  const isValidTime = (timeStr) => {
    if (!timeStr) return true; // Empty is valid (optional)
    
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/;
    return timeRegex.test(timeStr);
  };

  // ✅ Handle time picker input (now returns HH:MM:SS with step="1")
  const handleTimePickerChange = (index, field, value) => {
    // With step="1", time picker returns HH:MM:SS directly
    handleIntervalChange(index, field, value);
  };

  // ✅ Handle manual text input (expects HH:MM:SS)
  const handleIntervalChange = (index, field, value) => {
    const newIntervals = [...editedEntry.intervals];
    newIntervals[index] = { ...newIntervals[index], [field]: value };
    setEditedEntry({ ...editedEntry, intervals: newIntervals });
  };

  const addInterval = () => {
    setEditedEntry({
      ...editedEntry,
      intervals: [...editedEntry.intervals, { in: '', out: '' }]
    });
  };

  const removeInterval = (index) => {
    const newIntervals = editedEntry.intervals.filter((_, i) => i !== index);
    setEditedEntry({ ...editedEntry, intervals: newIntervals });
  };

  const handleSave = () => {
    // ✅ Validate all time formats
    for (let i = 0; i < editedEntry.intervals.length; i++) {
      const interval = editedEntry.intervals[i];
      
      if (interval.in && !isValidTime(interval.in)) {
        alert(`Invalid check-in time format in Interval ${i + 1}. Use HH:MM:SS (e.g., 08:30:00)`);
        return;
      }
      
      if (interval.out && !isValidTime(interval.out)) {
        alert(`Invalid check-out time format in Interval ${i + 1}. Use HH:MM:SS (e.g., 17:45:30)`);
        return;
      }
      
      // ✅ Validate check-out after check-in
      if (interval.in && interval.out && interval.in >= interval.out) {
        alert(`Check-out time must be after check-in time in Interval ${i + 1}`);
        return;
      }
    }

    // ✅ Clean up intervals (remove empty ones)
    const validIntervals = editedEntry.intervals.filter(interval => 
      interval.in || interval.out
    );

    if (editedEntry.type === 'Regular' && validIntervals.length === 0) {
      alert('Regular day must have at least one time interval');
      return;
    }

    // Update entry with all modified fields
    updateEntry(entry.date, {
      type: editedEntry.type,
      intervals: validIntervals,
      duration: editedEntry.duration,
      notes: editedEntry.notes,
      doubleHours: editedEntry.doubleHours
    });
    
    alert('Entry updated successfully!');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-entry-modal" onClick={(e) => e.stopPropagation()}>
        <h2>✏️ Edit Entry - {entry.date}</h2>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Type</label>
            <select 
              className="form-control"
              value={editedEntry.type}
              onChange={(e) => setEditedEntry({ ...editedEntry, type: e.target.value })}
            >
              <option value="Regular">Regular</option>
              <option value="Vacation">Vacation</option>
              <option value="Sick Leave">Sick Leave</option>
              <option value="Holiday">Holiday</option>
              <option value="Leave">Leave</option>
              <option value="To Be Added">To Be Added</option>
            </select>
          </div>

          {editedEntry.type === 'Regular' && (
            <>
              <h4>⏰ Time Intervals</h4>
              <p className="help-text">
                Use 24-hour format with seconds: <strong>HH:MM:SS</strong> (e.g., 08:30:00, 17:45:30)
                <br/>
                <small>💡 Tip: Click the clock icon to pick time with seconds</small>
              </p>
              
              {editedEntry.intervals.map((interval, index) => (
                <div key={index} className="form-group interval-group">
                  <label className="interval-label">
                    {index === 0 ? '🕐 Main Work Hours' : `☕ Break ${index}`}
                  </label>
                  <div className="interval-inputs">
                    {/* Check In */}
                    <div className="time-input-wrapper">
                      <label className="time-input-label">Check In</label>
                      <div className="time-input-with-picker">
                        <input
                          type="text"
                          className="form-control time-input-text"
                          placeholder="08:30:00"
                          value={interval.in || ''}
                          onChange={(e) => handleIntervalChange(index, 'in', e.target.value)}
                          maxLength="8"
                        />
                        <button
                          type="button"
                          className="time-picker-button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.currentTarget.nextElementSibling.showPicker();
                          }}
                          title="Pick time"
                        >
                          🕐
                        </button>
                        <input
                          type="time"
                          step="1"
                          className="time-picker-input"
                          value={interval.in || ''}
                          onChange={(e) => handleTimePickerChange(index, 'in', e.target.value)}
                          title="Pick time (HH:MM:SS)"
                        />
                      </div>
                    </div>

                    <span className="time-separator">→</span>

                    {/* Check Out */}
                    <div className="time-input-wrapper">
                      <label className="time-input-label">Check Out</label>
                      <div className="time-input-with-picker">
                        <input
                          type="text"
                          className="form-control time-input-text"
                          placeholder="17:45:00"
                          value={interval.out || ''}
                          onChange={(e) => handleIntervalChange(index, 'out', e.target.value)}
                          maxLength="8"
                        />
                        <button
                          type="button"
                          className="time-picker-button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.currentTarget.nextElementSibling.showPicker();
                          }}
                          title="Pick time"
                        >
                          🕐
                        </button>
                        <input
                          type="time"
                          step="1"
                          className="time-picker-input"
                          value={interval.out || ''}
                          onChange={(e) => handleTimePickerChange(index, 'out', e.target.value)}
                          title="Pick time (HH:MM:SS)"
                        />
                      </div>
                    </div>

                    {editedEntry.intervals.length > 1 && (
                      <button 
                        className="btn btn-sm btn-danger remove-interval-btn"
                        onClick={() => removeInterval(index)}
                        title="Remove interval"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {!isValidTime(interval.in) && interval.in && (
                    <small className="error-text">Invalid format. Use HH:MM:SS</small>
                  )}
                  {!isValidTime(interval.out) && interval.out && (
                    <small className="error-text">Invalid format. Use HH:MM:SS</small>
                  )}
                </div>
              ))}
              
              <button className="btn btn-secondary add-interval-btn" onClick={addInterval}>
                + Add Break Interval
              </button>
            </>
          )}

          {editedEntry.type !== 'Regular' && (
            <div className="form-group">
              <label className="form-label">Duration</label>
              <select 
                className="form-control"
                value={editedEntry.duration || 1}
                onChange={(e) => setEditedEntry({ ...editedEntry, duration: parseFloat(e.target.value) })}
              >
                <option value="0.5">Half Day</option>
                <option value="1">Full Day</option>
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-control"
              placeholder="Add notes (optional)"
              rows="3"
              value={editedEntry.notes || ''}
              onChange={(e) => setEditedEntry({ ...editedEntry, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>💾 Save Changes</button>
        </div>
      </div>
    </div>
  );
}

export default EditEntryModal;
