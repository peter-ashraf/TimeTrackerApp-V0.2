import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext-optimized';
import ModalShell from './ModalShell';
import AlertModal from './AlertModal';

function AddDayModal({ onClose }) {
  const { setEntries, entries, formatDate } = useTimeTracker();
  const [dayType, setDayType] = useState('Vacation Full Day');
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [dayNotes, setDayNotes] = useState('');
  const [alertModal, setAlertModal] = useState({ isOpen: false, message: '', type: 'info' });

  const showAlert = (message, type = 'info') => {
    setAlertModal({ isOpen: true, message, type });
  };

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
      showAlert('Please select day type and date', 'warning');
      return;
    }

    const { type, duration } = parseSpecialDayLabel(dayType);

    // Check for duplicates
    const exists = entries.some(e => 
      e.date === selectedDate && e.type === type && e.duration === duration
    );

    if (exists) {
      showAlert('This day type already exists for the selected date', 'warning');
      return;
    }

    setEntries([...entries, {
      date: selectedDate,
      type: type,
      duration: duration,
      intervals: [],
      notes: dayNotes
    }]);

    showAlert(`${dayType} added for ${selectedDate}`, 'success');
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <>
      <ModalShell onClose={onClose} closeOnOverlay={false}>
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

export default AddDayModal;
