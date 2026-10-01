import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import ModalShell from './ModalShell';
import AlertModal from './AlertModal';
import '../styles/add-break-modal.css';

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
      <ModalShell onClose={onClose} closeOnOverlay={false} contentClassName="add-break-modal" title="Add Break">
        <div className="modal-header">
          <h2>Add Break</h2>
        </div>
        <div className="modal-body bento-modal-grid">
          
          <div className="bento-modal-card full-width">
            <div className="bento-modal-card-label">📅 Date</div>
            <input
              type="date"
              className="bento-modal-card-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="bento-modal-card">
            <div className="bento-modal-card-label">☕ Break Start</div>
            <input
              type="tel"
              placeholder="HH:MM:SS"
              className="bento-modal-card-input"
              value={breakStart || ''}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                let res = '';
                if (val.length > 0) res += val.substring(0, 2);
                if (val.length > 2) res += ':' + val.substring(2, 4);
                if (val.length > 4) res += ':' + val.substring(4, 6);
                setBreakStart(res);
              }}
              onBlur={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                if (!val) return;
                let res = '';
                if (val.length === 1) res = `0${val}:00:00`;
                else if (val.length === 2) res = `${val}:00:00`;
                else if (val.length === 3) res = `${val.substring(0,2)}:0${val.substring(2,3)}:00`;
                else if (val.length === 4) res = `${val.substring(0,2)}:${val.substring(2,4)}:00`;
                else if (val.length === 5) res = `${val.substring(0,2)}:${val.substring(2,4)}:0${val.substring(4,5)}`;
                else if (val.length >= 6) res = `${val.substring(0,2)}:${val.substring(2,4)}:${val.substring(4,6)}`;
                setBreakStart(res);
              }}
              style={{ textAlign: 'center' }}
            />
          </div>

          <div className="bento-modal-card">
            <div className="bento-modal-card-label">✅ Break End</div>
            <input
              type="tel"
              placeholder="HH:MM:SS"
              className="bento-modal-card-input"
              value={breakEnd || ''}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                let res = '';
                if (val.length > 0) res += val.substring(0, 2);
                if (val.length > 2) res += ':' + val.substring(2, 4);
                if (val.length > 4) res += ':' + val.substring(4, 6);
                setBreakEnd(res);
              }}
              onBlur={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                if (!val) return;
                let res = '';
                if (val.length === 1) res = `0${val}:00:00`;
                else if (val.length === 2) res = `${val}:00:00`;
                else if (val.length === 3) res = `${val.substring(0,2)}:0${val.substring(2,3)}:00`;
                else if (val.length === 4) res = `${val.substring(0,2)}:${val.substring(2,4)}:00`;
                else if (val.length === 5) res = `${val.substring(0,2)}:${val.substring(2,4)}:0${val.substring(4,5)}`;
                else if (val.length >= 6) res = `${val.substring(0,2)}:${val.substring(2,4)}:${val.substring(4,6)}`;
                setBreakEnd(res);
              }}
              style={{ textAlign: 'center' }}
            />
          </div>

          <div className="bento-modal-card full-width">
            <div className="bento-modal-card-label">📝 Notes</div>
            <input
              type="text"
              className="bento-modal-card-input"
              placeholder="e.g. Lunch"
              value={breakNotes}
              onChange={(e) => setBreakNotes(e.target.value)}
            />
          </div>
          
        </div>
        <div className="modal-footer">
          <button className="btn-secondary bento-modal-btn-outline" onClick={(e) => { const modal = e.target.closest('.bento-modal-overlay'); if (modal) { modal.classList.add('closing'); const content = modal.querySelector('.modal-content'); if (content) content.classList.add('closing'); } setTimeout(onClose, 350); }}>
            Cancel
          </button>
          <button className="btn-primary bento-modal-btn-glow" onClick={handleSave}>
            Save Break
          </button>
        </div>
      </ModalShell>
      {alertModal.isOpen && (
        <AlertModal
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        />
      )}
    </>
  );
}

export default AddBreakModal;
