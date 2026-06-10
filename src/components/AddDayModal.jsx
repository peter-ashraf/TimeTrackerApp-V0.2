import React, { useMemo, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { useTimeEntry } from '../context/TimeEntryContext';
import ModalShell from './ModalShell';
import AlertModal from './AlertModal';
import CustomSelect from './CustomSelect';
import '../styles/add-day-modal.css';

function AddDayModal({ onClose }) {
  const { entries, showAlert } = useTimeTracker();
  const timeEntryContext = useTimeEntry();
  const [dayType, setDayType] = useState('Vacation Full Day');
  const [selectedDates, setSelectedDates] = useState([]);
  const [dayNotes, setDayNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, message: '', type: 'info' });

  const existingDates = useMemo(() => {
    return new Set(entries.filter(entry => entry?.date).map(entry => entry.date));
  }, [entries]);

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

  const sortDates = (dates) => {
    return [...dates].sort((a, b) => a.localeCompare(b));
  };

  const handleDateToggle = (date) => {
    const dateString = formatLocalDate(date);

    if (existingDates.has(dateString)) {
      showAlert(`An entry already exists for ${dateString}`, 'warning');
      return;
    }

    setSelectedDates((currentDates) => {
      if (currentDates.includes(dateString)) {
        return currentDates.filter((selectedDate) => selectedDate !== dateString);
      }

      return sortDates([...currentDates, dateString]);
    });
  };

  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return null;

    const dateString = formatLocalDate(date);
    const classes = [];

    if (selectedDates.includes(dateString)) {
      classes.push('add-day-calendar-selected');
    }

    if (existingDates.has(dateString)) {
      classes.push('add-day-calendar-existing');
    }

    return classes.length > 0 ? classes.join(' ') : null;
  };

  const tileDisabled = ({ date, view }) => {
    if (view !== 'month') return false;
    return existingDates.has(formatLocalDate(date));
  };

  const handleSave = async () => {
    if (isSaving) return;

    if (!dayType || selectedDates.length === 0) {
      showAlert('Please select day type and at least one date', 'warning');
      return;
    }

    const targetDates = sortDates(selectedDates);

    const { type, duration } = parseSpecialDayLabel(dayType);

    // Check for duplicates again in case entries changed while the modal was open.
    const duplicateDates = targetDates.filter(date =>
      entries.some(e => e.date === date)
    );

    if (duplicateDates.length > 0) {
      showAlert(`Entries already exist for: ${duplicateDates.join(', ')}`, 'warning');
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

    const dayLabel = targetDates.length === 1 ? targetDates[0] : targetDates.join(', ');
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
            <label className="form-label">Dates</label>
            <Calendar
              className="add-day-calendar"
              onClickDay={handleDateToggle}
              tileClassName={tileClassName}
              tileDisabled={tileDisabled}
            />
            <div className="selected-dates-summary">
              {selectedDates.length > 0 ? (
                selectedDates.map((date) => (
                  <button
                    type="button"
                    key={date}
                    className="selected-date-chip"
                    onClick={() => setSelectedDates((currentDates) => currentDates.filter((selectedDate) => selectedDate !== date))}
                    title={`Remove ${date}`}
                  >
                    {date}
                  </button>
                ))
              ) : (
                <span className="selected-dates-empty">No dates selected</span>
              )}
            </div>
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
              {isSaving ? 'Adding...' : `Add ${selectedDates.length === 1 ? 'Day' : 'Days'}`}
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
