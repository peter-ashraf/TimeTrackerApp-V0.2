import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import ModalShell from './ModalShell';
import CustomSelect from './CustomSelect';
import AlertModal from './AlertModal';
import '../styles/edit-entry-modal.css';

function EditEntryModal({ entry, onClose }) {
  const { updateEntry } = useTimeTracker();
  const activeSaveRef = React.useRef(0);
  const SAVE_UI_TIMEOUT_MS = 10000;

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

  const showLocalSaveFallbackModal = () => {
    setAlertModal({
      isOpen: true,
      title: 'Saved Locally',
      message: 'Your edit was saved in the app. Cloud sync is taking longer than expected and will continue in the background.',
      type: 'warning',
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
      const saveAttempt = activeSaveRef.current + 1;
      activeSaveRef.current = saveAttempt;
      setIsSaving(true);
      const saveResult = await Promise.race([
        updateEntry(entry.date, {
          type: editedEntry.type,
          intervals: validIntervals,
          duration: editedEntry.duration,
          notes: editedEntry.notes,
          doubleHours: editedEntry.doubleHours
        }),
        new Promise(resolve => {
          setTimeout(() => {
            resolve({ success: true, savedTo: 'local', timedOut: true });
          }, SAVE_UI_TIMEOUT_MS);
        })
      ]);

      if (activeSaveRef.current !== saveAttempt) return;

      setIsSaving(false);
      if (saveResult?.timedOut) {
        showLocalSaveFallbackModal();
      } else if (saveResult?.success === false && saveResult?.savedTo !== 'local') {
        showValidationError('Save Failed', 'Failed to save changes. Please try again.', 'danger');
      } else {
        showSuccessModal();
      }
    } catch (error) {
      console.error('[Update] Failed to update entry:', error);
      showValidationError('Save Failed', 'Failed to save changes. Please try again.', 'danger');
      setIsSaving(false);
    }
  };

  return (
    <>
    <ModalShell onClose={onClose} closeOnOverlay={false} contentClassName="edit-entry-modal">
      <div className="modal-header">
        <h2>Edit Entry: {entry.date}</h2>
      </div>
      <div className="modal-body bento-modal-grid">
        
        {/* Entry Type */}
        <div className="bento-modal-card full-width">
          <div className="bento-modal-card-label">📁 Entry Type</div>
          <CustomSelect
            id="entry-type-select"
            name="type"
            value={editedEntry.type || 'Regular'}
            onChange={(e) => setEditedEntry({ ...editedEntry, type: e.target.value })}
            options={[
              { label: 'Regular', value: 'Regular' },
              { label: 'Vacation', value: 'Vacation' },
              { label: 'Sick Leave', value: 'Sick Leave' },
              { label: 'Holiday', value: 'Holiday' },
              { label: 'Leave', value: 'Leave' },
              { label: 'To Be Added', value: 'To Be Added' }
            ]}
            className="bento-modal-card-input"
          />
        </div>

        {editedEntry.type === 'Regular' && (
          <div className="bento-modal-card full-width">
            <div className="bento-modal-card-label">⏱️ Time Intervals</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {editedEntry.intervals.map((interval, index) => {
                const isFirst = index === 0;
                const firstLabel = isFirst ? 'Check In' : 'Break End';
                const secondLabel = isFirst ? 'Check Out (or Break Start)' : 'Check Out';

                return (
                  <div key={index} style={{ background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                    
                    <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                      {/* Check In */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{firstLabel}</div>
                        <input
                          type="time"
                          step="1"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="bento-modal-card-input"
                          value={isValidTime(interval.in) || /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(interval.in) ? interval.in : ''}
                          onChange={(e) => handleTimePickerChange(index, 'in', e.target.value)}
                          style={{ margin: 0, width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>

                      {/* Check Out */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{secondLabel}</div>
                        <input
                          type="time"
                          step="1"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="bento-modal-card-input"
                          value={isValidTime(interval.out) || /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(interval.out) ? interval.out : ''}
                          onChange={(e) => handleTimePickerChange(index, 'out', e.target.value)}
                          style={{ margin: 0, width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                    
                    {editedEntry.intervals.length > 1 && (
                      <button
                        onClick={() => removeInterval(index)}
                        style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '12px' }}
                        title="Remove interval"
                      >✕</button>
                    )}
                  </div>
                )
              })}
            </div>
            
            <button className="btn-secondary" onClick={addInterval} style={{ marginTop: '16px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px dashed rgba(255,255,255,0.2)', padding: '12px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', width: '100%', fontWeight: 600 }}>
              + Add Break Interval
            </button>
          </div>
        )}

        {editedEntry.type !== 'Regular' && (
          <div className="bento-modal-card full-width">
            <div className="bento-modal-card-label">⏳ Duration</div>
            <CustomSelect
              id="entry-duration-select"
              name="duration"
              value={editedEntry.duration || 1}
              onChange={(e) => setEditedEntry({ ...editedEntry, duration: parseFloat(e.target.value) })}
              options={[
                { label: 'Half Day', value: 0.5 },
                { label: 'Full Day', value: 1 }
              ]}
              className="bento-modal-card-input"
            />
          </div>
        )}

        {/* Notes */}
        <div className="bento-modal-card full-width">
          <div className="bento-modal-card-label">📝 Notes</div>
          <textarea
            className="bento-modal-card-input"
            placeholder="Add notes..."
            rows="3"
            value={editedEntry.notes || ''}
            onChange={(e) => setEditedEntry({ ...editedEntry, notes: e.target.value })}
            style={{ resize: 'none' }}
          />
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn-secondary bento-modal-btn-outline" onClick={(e) => { const modal = e.target.closest('.bento-modal-overlay'); if (modal) { modal.classList.add('closing'); const content = modal.querySelector('.modal-content'); if (content) content.classList.add('closing'); } setTimeout(onClose, 350); }}>Cancel</button>
        <button className="btn-primary bento-modal-btn-glow" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
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
