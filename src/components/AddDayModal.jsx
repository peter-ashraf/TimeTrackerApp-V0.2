import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';

function AddDayModal({ onClose }) {
  const { setEntries, entries, formatDate } = useTimeTracker();
  const [dayType, setDayType] = useState('Vacation Full Day');
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [dayNotes, setDayNotes] = useState('');

  const parseSpecialDayLabel = (label) => {
    if (label.includes('Half')) {
      const type = label.replace(' Half Day', '');
      return { type, duration: 0.5 };
    } else {
      const type = label.replace(' Full Day', '');
      return { type, duration: 1 };
    }
  };

  const handleSave = () => {
    if (!dayType || !selectedDate) {
      alert('Please select day type and date');
      return;
    }

    const { type, duration } = parseSpecialDayLabel(dayType);

    // Check for duplicates
    const exists = entries.some(e => 
      e.date === selectedDate && e.type === type && e.duration === duration
    );

    if (exists) {
      alert('This day type already exists for the selected date');
      return;
    }

    setEntries([...entries, {
      date: selectedDate,
      type: type,
      duration: duration,
      intervals: [],
      notes: dayNotes
    }]);

    alert(`${dayType} added for ${selectedDate}`);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Add Special Day</h2>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Day Type</label>
            <select 
              className="form-control"
              value={dayType}
              onChange={(e) => setDayType(e.target.value)}
            >
              <option value="Vacation Full Day">Vacation Full Day</option>
              <option value="Vacation Half Day">Vacation Half Day</option>
              <option value="Sick Leave Full Day">Sick Leave Full Day</option>
              <option value="Sick Leave Half Day">Sick Leave Half Day</option>
              <option value="Holiday Full Day">Holiday Full Day</option>
              <option value="Leave Full Day">Leave Full Day</option>
              <option value="To Be Added Full Day">To Be Added Full Day</option>
              <option value="To Be Added Half Day">To Be Added Half Day</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-control"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea
              className="form-control"
              placeholder="Add notes (optional)"
              rows="3"
              value={dayNotes}
              onChange={(e) => setDayNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Add Day</button>
        </div>
      </div>
    </div>
  );
}

export default AddDayModal;
