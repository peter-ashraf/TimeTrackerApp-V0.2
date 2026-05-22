import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { useTimeEntry } from '../context/TimeEntryContext';
import ModalShell from './ModalShell';
import AlertModal from './AlertModal';
import CustomSelect from './CustomSelect';
import '../styles/add-day-modal.css';

function AddDayModal({ onClose }) {
  const { setEntries, entries, formatDate, showAlert } = useTimeTracker();
  const timeEntryContext = useTimeEntry();
  const [dayType, setDayType] = useState('Vacation Full Day');
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [dayNotes, setDayNotes] = useState('');
  const [alertModal, setAlertModal] = useState({ isOpen: false, message: '', type: 'info' });

  const parseSpecialDayLabel = (label) => {
    if (label.includes('Half')) {
      const type = label.replace(' Half Day', '');
      return { type, duration: 0.5 };
    } else {
      const type = label.replace(' Full Day', '');
      return { type, duration: 1 };
    }
  };

  const handleSave = async () => {
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

    const newEntry = {
      date: selectedDate,
      type: type,
      duration: duration,
      intervals: [],
      notes: dayNotes,
      lastModified: new Date().toISOString(),
      hoursWorked: 0,
      extraHours: 0,
      extraHoursWithFactor: 0,
      hoursSpentOutside: 0
    };

    // Save using unified save mechanism
    try {
      console.log('[Save] Saving entry...');
      // Create a simple update operation that will trigger the unified save
      await timeEntryContext.saveTimeEntriesData(newEntry, showAlert);
      console.log('[Save] Entry saved successfully');
    } catch (saveError) {
      console.error('[Save] Failed to save special day:', saveError);
      showAlert('Special day added locally only. Will sync when online.', 'warning');
    }

    showAlert(`${dayType} added for ${selectedDate}`, 'success');
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <>
      <ModalShell onClose={onClose} closeOnOverlay={false} contentClassName="add-day-modal">
        <div className="modal-header">
          <h2>Add Special Day</h2>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Day Type</label>
            <CustomSelect
              id="add-day-type-select"
              name="dayType"
              value={dayType}
              onChange={(e) => setDayType(e.target.value)}
              options={[
                { label: 'Vacation Full Day', value: 'Vacation Full Day' },
                { label: 'Vacation Half Day', value: 'Vacation Half Day' },
                { label: 'Sick Leave Full Day', value: 'Sick Leave Full Day' },
                { label: 'Sick Leave Half Day', value: 'Sick Leave Half Day' },
                { label: 'Holiday Full Day', value: 'Holiday Full Day' },
                { label: 'Leave Full Day', value: 'Leave Full Day' },
                { label: 'To Be Added Full Day', value: 'To Be Added Full Day' }
              ]}
            />
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

        <div className="modal-footer">
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Add Day</button>
          </div>
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
