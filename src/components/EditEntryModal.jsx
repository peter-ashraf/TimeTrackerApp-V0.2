import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import ModalShell from './ModalShell';
import CustomSelect from './CustomSelect';
import AlertModal from './AlertModal';
import '../styles/edit-entry-modal.css';

function EditEntryModal({ entry, onClose }) {
  const { updateEntry } = useTimeTracker();

  // Track if user made any modifications
  const [hasModifications, setHasModifications] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: 'Alert',
    message: '',
    type: 'info',
    closeParentOnClose: false
  });

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

  // Track modifications
  React.useEffect(() => {
    const originalEntry = {
      ...entry,
      intervals: (entry.intervals || []).map(interval => ({
        in: formatTimeForDisplay(interval.in),
        out: formatTimeForDisplay(interval.out)
      }))
    };

    const hasChanges = JSON.stringify(editedEntry) !== JSON.stringify(originalEntry);
    setHasModifications(hasChanges);
  }, [entry, editedEntry]);

  // ✅ Validate time format HH:MM:SS
  const isValidTime = (timeStr) => {
    if (!timeStr) return true; // Empty is valid (optional)

    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/;
    return timeRegex.test(timeStr);
  };

  // ✅ Handle time picker input (now returns HH:MM(::SS) properly)
  const handleTimePickerChange = (index, field, value) => {
    // value from time picker is already valid HH:MM or HH:MM:SS
    const newIntervals = [...editedEntry.intervals];
    newIntervals[index] = { ...newIntervals[index], [field]: value };
    setEditedEntry({ ...editedEntry, intervals: newIntervals });
  };
  const showValidationError = (title, message, type = 'warning') => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type,
      closeParentOnClose: false
    });
  };

  // ✅ Show success modal
  const showSuccessModal = () => {
    setAlertModal({
      isOpen: true,
      title: 'Success',
      message: 'Entry updated successfully!',
      type: 'success',
      closeParentOnClose: true
    });
  };

  const closeAlertModal = () => {
    const shouldCloseParent = alertModal.closeParentOnClose;
    setAlertModal({
      isOpen: false,
      title: 'Alert',
      message: '',
      type: 'info',
      closeParentOnClose: false
    });

    if (shouldCloseParent) {
      onClose();
    }
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

  const handleSave = async () => {
    if (isSaving) return;

    // Check if user made any modifications
    if (!hasModifications) {
      showValidationError(
        'ℹ️ No Changes Made',
        'No modifications were made to this entry.\n\nMake some changes or click Cancel to close.',
        'warning'
      );
      return;
    }

    // ✅ Validate all time formats
    for (let i = 0; i < editedEntry.intervals.length; i++) {
      const interval = editedEntry.intervals[i];

      if (interval.in && !isValidTime(interval.in)) {
        showValidationError(
          '⚠️ Invalid Time Format',
          `Invalid check-in time format in Interval ${i + 1}.\n\nUse HH:MM:SS format (e.g., 08:30:00)`,
          'warning'
        );
        return;
      }

      if (interval.out && !isValidTime(interval.out)) {
        showValidationError(
          '⚠️ Invalid Time Format',
          `Invalid check-out time format in Interval ${i + 1}.\n\nUse HH:MM:SS format (e.g., 17:45:30)`,
          'warning'
        );
        return;
      }

      // ✅ Validate check-out after check-in
      if (interval.in && interval.out && interval.in >= interval.out) {
        showValidationError(
          '⚠️ Invalid Time Logic',
          `Check-out time must be after check-in time in Interval ${i + 1}.\n\nPlease correct the time values.`,
          'danger'
        );
        return;
      }
    }

    // ✅ Clean up intervals (remove empty ones and convert empty strings to null)
    const validIntervals = editedEntry.intervals
      .filter(interval => interval.in || interval.out) // Remove completely empty intervals
      .map(interval => ({
        ...interval,
        in: interval.in || null, // Convert empty strings to null
        out: interval.out || null  // Convert empty strings to null
      }));

    if (editedEntry.type === 'Regular' && validIntervals.length === 0) {
      showValidationError(
        '⚠️ Missing Time Data',
        'Regular day must have at least one time interval.\n\nPlease add check-in and check-out times.',
        'warning'
      );
      return;
    }

    // Update entry with all modified fields
    try {
      setIsSaving(true);
      await updateEntry(entry.date, {
        type: editedEntry.type,
        intervals: validIntervals,
        duration: editedEntry.duration,
        notes: editedEntry.notes,
        doubleHours: editedEntry.doubleHours
      });

      setIsSaving(false);
      showSuccessModal();
    } catch (error) {
      console.error('[Update] Failed to update entry:', error);
      showValidationError('Save Failed', 'Failed to save changes. Please try again.', 'danger');
      setIsSaving(false);
    }
  };

  return (
    <>
    <ModalShell onClose={isSaving ? undefined : onClose} contentClassName="edit-entry-modal" closeOnOverlay={false}>
      <div className="modal-header">
        <h2>✏️ Edit Entry - {entry.date}</h2>
      </div>
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">Type</label>
          <CustomSelect
            id="entry-type-select"
            name="type"
            value={editedEntry.type}
            onChange={(e) => setEditedEntry({ ...editedEntry, type: e.target.value })}
            options={[
              { label: 'Regular', value: 'Regular' },
              { label: 'Vacation', value: 'Vacation' },
              { label: 'Sick Leave', value: 'Sick Leave' },
              { label: 'Holiday', value: 'Holiday' },
              { label: 'Leave', value: 'Leave' },
              { label: 'To Be Added', value: 'To Be Added' }
            ]}
          />
        </div>

        {editedEntry.type === 'Regular' && (
          <>
            <h4>⏰ Time Intervals</h4>
            <p className="help-text">
              Use 24-hour format with seconds: <strong>HH:MM:SS</strong> (e.g., 08:30:00, 17:45:30)
              <br />
              <small>💡 Tip: Click the clock icon to pick time with seconds</small>
            </p>

            {editedEntry.intervals.map((interval, index) => {
              const isMainWork = index === 0;
              // SWAPPED LABELS: Main is In/Out, Breaks are Out/In
              const firstLabel = isMainWork ? 'CHECK IN' : 'CHECK OUT';
              const secondLabel = isMainWork ? 'CHECK OUT' : 'CHECK IN';

              return (
                <div key={index} className="form-group interval-group">
                  <label className="interval-label">
                    {index === 0 ? '🕐 Main Work Hours' : `☕ Break ${index}`}
                  </label>
                  
                  {/* Check In */}
                  <div className="time-input-wrapper">
                    <label className="time-input-label">{firstLabel}</label>
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
                        value={
                          isValidTime(interval.in) ||
                            /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(interval.in)
                            ? interval.in
                            : ''
                        }
                        onChange={(e) => handleTimePickerChange(index, 'in', e.target.value)}
                        title="Pick time (HH:MM:SS)"
                      />
                    </div>
                  </div>

                  {/* Check Out */}
                  <div className="time-input-wrapper">
                    <label className="time-input-label">{secondLabel}</label>
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
                        value={
                          isValidTime(interval.out) ||
                            /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(interval.out)
                            ? interval.out
                            : ''
                        }
                        onChange={(e) => handleTimePickerChange(index, 'out', e.target.value)}
                        title="Pick time (HH:MM:SS)"
                      />
                    </div>
                  </div>
                  {!isValidTime(interval.in) && interval.in && (
                    <small className="error-text">Invalid format. Use HH:MM:SS</small>
                  )}
                  {!isValidTime(interval.out) && interval.out && (
                    <small className="error-text">Invalid format. Use HH:MM:SS</small>
                  )}
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
              )
            })}

            <button className="btn btn-secondary add-interval-btn" onClick={addInterval}>
              + Add Break Interval
            </button>
          </>
        )}

        {editedEntry.type !== 'Regular' && (
          <div className="form-group">
            <label className="form-label">Duration</label>
            <CustomSelect
              id="entry-duration-select"
              name="duration"
              value={editedEntry.duration || 1}
              onChange={(e) => setEditedEntry({ ...editedEntry, duration: parseFloat(e.target.value) })}
              options={[
                { label: 'Half Day', value: 0.5 },
                { label: 'Full Day', value: 1 }
              ]}
            />
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

      <div className="modal-footer">
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </ModalShell>
    <AlertModal
      isOpen={alertModal.isOpen}
      title={alertModal.title}
      message={alertModal.message}
      type={alertModal.type}
      onClose={closeAlertModal}
    />
    </>
  );
}

export default EditEntryModal;
