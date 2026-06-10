import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { useTimeEntry } from '../context/TimeEntryContext';
import ModalShell from './ModalShell';
import AlertModal from './AlertModal';
import CustomSelect from './CustomSelect';
import '../styles/add-day-modal.css';

function AddDayModal({ onClose }) {
  const { entries, formatDate, showAlert } = useTimeTracker();
  const timeEntryContext = useTimeEntry();
  const [dayType, setDayType] = useState('Vacation Full Day');
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [dayCount, setDayCount] = useState(1);
  const [dayNotes, setDayNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
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

  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTargetDates = (startDate, count) => {
    const parsedCount = Number(count);
    const safeCount = Number.isInteger(parsedCount) ? parsedCount : 0;
    const start = new Date(`${startDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || safeCount < 1 || safeCount > 31) {
      return [];
    }

    return Array.from({ length: safeCount }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return formatLocalDate(date);
    });
  };

  const handleSave = async () => {
    if (isSaving) return;

    if (!dayType || !selectedDate) {
      showAlert('Please select day type and start date', 'warning');
      return;
    }

    const targetDates = getTargetDates(selectedDate, dayCount);

    if (targetDates.length === 0) {
      showAlert('Please enter a number of days between 1 and 31', 'warning');
      return;
    }

    const { type, duration } = parseSpecialDayLabel(dayType);

    // Check for duplicates
    const duplicateDates = targetDates.filter(date =>
      entries.some(e => e.date === date && e.type === type && e.duration === duration)
    );

    if (duplicateDates.length > 0) {
      showAlert(`This day type already exists for: ${duplicateDates.join(', ')}`, 'warning');
      return;
    }

    const timestamp = new Date().toISOString();
    const newEntries = targetDates.map(date => ({
      date,
      type: type,
      duration: duration,
      intervals: [],
      notes: dayNotes,
      lastModified: timestamp,
      hoursWorked: 0,
      extraHours: 0,
      extraHoursWithFactor: 0,
      hoursSpentOutside: 0
    }));

    // Save using unified save mechanism
    try {
      setIsSaving(true);
      for (const entry of newEntries) {
        await timeEntryContext.saveTimeEntriesData(entry, showAlert);
      }
    } catch (saveError) {
      console.error('[Save] Failed to save special day:', saveError);
      showAlert('Some special days may have been saved locally only. Please refresh when online.', 'warning');
      setIsSaving(false);
      return;
    }

    const dayLabel = targetDates.length === 1 ? targetDates[0] : `${targetDates[0]} through ${targetDates[targetDates.length - 1]}`;
    showAlert(`${dayType} added for ${targetDates.length} day${targetDates.length > 1 ? 's' : ''}: ${dayLabel}`, 'success');
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
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-control"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Number of Days</label>
            <input
              type="number"
              className="form-control"
              min="1"
              max="31"
              step="1"
              value={dayCount}
              onChange={(e) => setDayCount(e.target.value)}
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
            <button className="btn btn-secondary" onClick={onClose} disabled={isSaving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Adding...' : `Add ${Number(dayCount) === 1 ? 'Day' : 'Days'}`}
            </button>
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
