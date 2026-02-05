import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import ModalShell from './ModalShell';

function AddBreakModal({ onClose }) {
  const { entries, formatDate, updateEntry } = useTimeTracker();
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [breakStart, setBreakStart] = useState('');
  const [breakEnd, setBreakEnd] = useState('');
  const [breakNotes, setBreakNotes] = useState('');

  const handleSave = () => {
    if (!breakStart || !breakEnd) {
      alert('Please enter both break start and end times');
      return;
    }

    if (breakStart >= breakEnd) {
      alert('Break end time must be after start time');
      return;
    }

    const entry = entries.find(e => e.date === selectedDate);
    
    if (!entry) {
      alert('No check-in/out found for this date. Please add working hours first.');
      return;
    }

    if (!entry.intervals || entry.intervals.length === 0) {
      alert('No working hours found for this date. Please add check-in/out times first.');
      return;
    }

    // Ensure times have seconds
    const breakStartWithSeconds = breakStart.split(':').length === 2 ? breakStart + ':00' : breakStart;
    const breakEndWithSeconds = breakEnd.split(':').length === 2 ? breakEnd + ':00' : breakEnd;

    // Add break as a new interval
    const updatedIntervals = [
      ...entry.intervals,
      { 
        in: breakStartWithSeconds, 
        out: breakEndWithSeconds,
        notes: breakNotes || undefined
      }
    ];

    updateEntry(selectedDate, {
      intervals: updatedIntervals
    });

    alert(`Break added for ${selectedDate}`);
    onClose();
  };

  return (
    <ModalShell onClose={onClose}>
      <h2>Add Break</h2>
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">Date</label>
          <input
            type="date"
            className="form-control"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <div className="form-group interval-group">
          <label>Break Times</label>
          <div className="interval-inputs">
            <input
              type="time"
              className="form-control"
              placeholder="Break Start"
              value={breakStart}
              onChange={(e) => setBreakStart(e.target.value)}
            />
            <input
              type="time"
              className="form-control"
              placeholder="Break End"
              value={breakEnd}
              onChange={(e) => setBreakEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notes (optional)</label>
          <textarea
            className="form-control"
            placeholder="Add notes about this break (optional)"
            rows="3"
            value={breakNotes}
            onChange={(e) => setBreakNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave}>Add Break</button>
      </div>
    </ModalShell>
  );
}

export default AddBreakModal;
