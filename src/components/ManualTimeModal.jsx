import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import ModalShell from './ModalShell';
import ConfirmModal from './ConfirmModal';

function ManualTimeModal({ mode, onClose }) {
  const { setEntries, entries, formatDate, getCurrentPeriod, updateEntry, setConfirmModal, confirmModal, timeEntryContext, showAlert } = useTimeTracker();
  const [applyMode, setApplyMode] = useState('today');
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [timeValue, setTimeValue] = useState('');

  const handleSave = async () => {
    const dateToUse = applyMode === 'today' ? formatDate(new Date()) : selectedDate;
    
    if (!timeValue) {
      setConfirmModal({
        isOpen: true,
        title: 'Missing Time',
        message: 'Please enter a time',
        type: 'warning',
        confirmText: 'OK',
        showCancel: false,
        onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
      });
      return;
    }

    // Ensure time has seconds
    const timeWithSeconds = timeValue.split(':').length === 2 ? timeValue + ':00' : timeValue;

    // Check if date is in current period
    const currentPeriod = getCurrentPeriod();
    if (currentPeriod) {
      const periodStart = currentPeriod.start_date || currentPeriod.start;
      const periodEnd = currentPeriod.end_date || currentPeriod.end;
      
      if (dateToUse < periodStart || dateToUse > periodEnd) {
        const proceed = window.confirm(`Warning: ${dateToUse} is outside the current period (${currentPeriod.label}). Do you want to continue?`);
        if (!proceed) return;
      }
    }

    const existingEntry = entries.find(e => e.date === dateToUse);

    if (mode === 'checkIn') {
      if (existingEntry) {
        const lastInterval = existingEntry.intervals?.[existingEntry.intervals.length - 1];
        if (lastInterval && !lastInterval.out) {
          setConfirmModal({
            isOpen: true,
            title: 'Already Checked In',
            message: 'You are already checked in. Please check out first.',
            type: 'info',
            confirmText: 'OK',
            showCancel: false,
            onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
          });
          return;
        }
        
        // Add new check-in interval
        await updateEntry(dateToUse, {
          intervals: [...existingEntry.intervals, { in: timeWithSeconds, out: null }]
        });
      } else {
        // Create new entry with proper structure
        const newEntry = {
          date: dateToUse,
          type: 'Regular',
          intervals: [{ in: timeWithSeconds, out: null }],
          lastModified: new Date().toISOString(),
          hoursWorked: 0,
          extraHours: 0,
          extraHoursWithFactor: 0,
          hoursSpentOutside: 0
        };
        
        // Update entries locally first
        const updatedEntries = [newEntry, ...entries.filter(e => e.date !== dateToUse)];
        setEntries(updatedEntries);
        
        // Save to Supabase with retry logic
        await timeEntryContext.saveTimeEntriesData(newEntry, showAlert);
      }
      setConfirmModal({
        isOpen: true,
        title: '✓ Manually Checked In Successfully',
        message: `Manually checked in at ${timeWithSeconds} on ${dateToUse}`,
        type: 'success',
        confirmText: 'OK',
        showCancel: false,
        onConfirm: () => {
          setConfirmModal({ ...confirmModal, isOpen: false });
          onClose();
        }
      });
      return;
    } else {
      // Check out
      if (!existingEntry || !existingEntry.intervals?.length) {
        setConfirmModal({
          isOpen: true,
          title: 'No Active Check-In Found',
          message: 'No active check-in found for this date.',
          type: 'warning',
          confirmText: 'OK',
          showCancel: false,
          onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
        });
        return;
      }
      const lastInterval = existingEntry.intervals[existingEntry.intervals.length - 1];
      if (lastInterval.out) {
        setConfirmModal({
          isOpen: true,
          title: 'Already Checked Out',
          message: 'You are already checked out. Check in again to start a new session.',
          type: 'info',
          confirmText: 'OK',
          showCancel: false,
          onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
        });
        return;
      }
      
      // Update last interval with check-out time
      const updatedIntervals = existingEntry.intervals.map((interval, idx) =>
        idx === existingEntry.intervals.length - 1
          ? { ...interval, out: timeWithSeconds }
          : interval
      );

      await updateEntry(dateToUse, {
        intervals: updatedIntervals
      });
      
      setConfirmModal({
        isOpen: true,
        title: '✓ Manually Checked Out Successfully',
        message: `Manually checked out at ${timeWithSeconds} on ${dateToUse}`,
        type: 'success',
        confirmText: 'OK',
        showCancel: false,
        onConfirm: () => {
          setConfirmModal({ ...confirmModal, isOpen: false });
          onClose();
        }
      });
      return;
    }
  };

  return (
    <>
      <ModalShell onClose={onClose} closeOnOverlay={false}>
        <h2>{mode === 'checkIn' ? 'Manual Check In' : 'Manual Check Out'}</h2>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Apply for</label>
            <select 
              className="form-control"
              value={applyMode}
              onChange={(e) => setApplyMode(e.target.value)}
            >
              <option value="today">Today ({formatDate(new Date())})</option>
              <option value="date">Specific date</option>
            </select>
          </div>

          {applyMode === 'date' && (
            <div className="form-group">
              <label className="form-label">Select date</label>
              <input
                type="date"
                className="form-control"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Time (HH:MM:SS)</label>
            <input
              type="time"
              step="1"
              className="form-control"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </ModalShell>
      
      <ConfirmModal
        isOpen={confirmModal?.isOpen}
        title={confirmModal?.title}
        message={confirmModal?.message}
        type={confirmModal?.type}
        confirmText={confirmModal?.confirmText || 'OK'}
        cancelText={confirmModal?.cancelText || 'Cancel'}
        showCancel={confirmModal?.showCancel !== false}
        onConfirm={confirmModal?.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </>
  );
}

export default ManualTimeModal;
