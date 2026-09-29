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
          <h2>Request Time Off / Add Day</h2>
        </div>
        <div className="modal-body bento-modal-grid" style={{ display: 'grid' }}>
          
          {/* Day Type Selection */}
          <div className="bento-modal-card" style={{ gridColumn: 'span 2' }}>
            <div className="bento-modal-card-label">🏖️ Day Type</div>
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
              className="bento-modal-card-input"
            />
          </div>

          {/* Calendar Selection (Full width for legibility) */}
          <div className="bento-modal-card full-width">
            <div className="bento-modal-card-label">📅 Select Dates</div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '16px', marginBottom: '16px' }}>
              <Calendar
                className="add-day-calendar bento-calendar"
                onClickDay={handleDateToggle}
                tileClassName={tileClassName}
                tileDisabled={tileDisabled}
              />
            </div>
            
            <div className="bento-modal-card-label">🎯 Selected Dates ({selectedDates.length})</div>
            <div className="selected-dates-summary" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {selectedDates.length > 0 ? (
                selectedDates.map((date) => (
                  <button
                    type="button"
                    key={date}
                    className="selected-date-chip"
                    onClick={() => setSelectedDates((currentDates) => currentDates.filter((selectedDate) => selectedDate !== date))}
                    title={`Remove ${date}`}
                    style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '16px', padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {date} ✕
                  </button>
                ))
              ) : (
                <span className="selected-dates-empty" style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No dates selected</span>
              )}
            </div>
          </div>

          {/* Notes (Moved to the bottom) */}
          <div className="bento-modal-card" style={{ gridColumn: 'span 2' }}>
            <div className="bento-modal-card-label">📝 Notes (optional)</div>
            <textarea
              className="bento-modal-card-input"
              placeholder="Add notes..."
              rows="2"
              value={dayNotes}
              onChange={(e) => setDayNotes(e.target.value)}
              style={{ resize: 'none' }}
            />
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={(e) => { const modal = e.target.closest('.bento-modal-overlay'); if (modal) { modal.classList.add('closing'); const content = modal.querySelector('.modal-content'); if (content) content.classList.add('closing'); } setTimeout(onClose, 350); }} disabled={isSaving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Adding...' : `Add ${selectedDates.length === 1 ? 'Day' : 'Days'}`}
          </button>
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
