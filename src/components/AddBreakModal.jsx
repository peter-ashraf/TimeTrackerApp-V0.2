import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import ModalShell from './ModalShell';
import AlertModal from './AlertModal';

function AddBreakModal({ onClose }) {
  const { entries, formatDate, updateEntry } = useTimeTracker();
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [breakStart, setBreakStart] = useState('');
  const [breakEnd, setBreakEnd] = useState('');
  const [breakNotes, setBreakNotes] = useState('');
  const [alertModal, setAlertModal] = useState({ isOpen: false, message: '', type: 'info' });

  const showAlert = (message, type = 'info') => {
    setAlertModal({ isOpen: true, message, type });
  };

  const handleSave = async () => {
    if (!breakStart || !breakEnd) {
      showAlert('Please enter both break start and end times', 'warning');
      return;
    }

    if (breakStart >= breakEnd) {
      showAlert('Break end time must be after start time', 'warning');
      return;
    }

    const entry = entries.find(e => e.date === selectedDate);
    
    if (!entry) {
      showAlert('No check-in/out found for this date. Please add working hours first.', 'warning');
      return;
    }

    if (!entry.intervals || entry.intervals.length === 0) {
      showAlert('No working hours found for this date. Please add check-in/out times first.', 'warning');
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

    await updateEntry(selectedDate, {
      intervals: updatedIntervals
    });

    showAlert(`Break added for ${selectedDate}`, 'success');
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <>
      <ModalShell onClose={onClose} closeOnOverlay={false}>
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
    
    <AlertModal
      isOpen={alertModal.isOpen}
      message={alertModal.message}
      type={alertModal.type}
      onClose={() => setAlertModal({ isOpen: false, message: '', type: 'info' })}
    />
  </>
  );
}

export default AddBreakModal;
