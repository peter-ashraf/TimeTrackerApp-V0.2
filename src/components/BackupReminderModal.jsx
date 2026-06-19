import React, { useState } from 'react';
import ModalShell from './ModalShell';
import CustomSelect from './CustomSelect';
import '../styles/backup-reminder.css';

function BackupReminderModal({ isOpen, onExport, onRemindLater, onDismiss, onClose }) {
  const [reminderInterval, setReminderInterval] = useState('3');
  const [customDays, setCustomDays] = useState(3);

  if (!isOpen) return null;

  const handleRemindLater = () => {
    const days = reminderInterval === 'custom' ? customDays : parseInt(reminderInterval);
    onRemindLater(days);
  };

  return (
    <ModalShell onClose={onClose} closeOnOverlay={false} contentClassName="backup-reminder-modal" overlayClassName="backup-reminder-overlay">
      <div className="backup-reminder-modal-content">
        <div className="backup-icon">💾</div>
        <h3>Time to Back Up Your Data!</h3>
        <p className="backup-message">
          It's been a while since your last backup. Your timesheet data is only stored locally in your browser.
        </p>
        <div className="backup-warning">
          <strong>⚠️ Important:</strong> Clearing browser data or switching devices will erase all your timesheets.
        </div>
        <p className="backup-recommendation">We recommend backing up your data regularly.</p>

        {/* Dropdown for Reminder Interval */}
        <div className="form-group">
          <label className="form-label">Remind me again in:</label>
          <CustomSelect
            id="reminder-interval-select"
            name="reminderInterval"
            value={reminderInterval}
            onChange={(e) => setReminderInterval(e.target.value)}
            options={[
              { label: '1 day', value: '1' },
              { label: '3 days', value: '3' },
              { label: '1 week', value: '7' },
              { label: '2 weeks', value: '14' },
              { label: 'Custom...', value: 'custom' }
            ]}
          />

          {reminderInterval === 'custom' && (
            <div className="custom-days-input">
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="30"
                value={customDays}
                onChange={(e) => setCustomDays(parseInt(e.target.value) || 1)}
                className="form-control"
                placeholder="Enter days"
              />
              <span>days</span>
            </div>
          )}
        </div>

        <div className="modal-actions backup-actions">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-secondary btn-sm btn-dismiss" onClick={onDismiss}>
            Don't remind me
          </button>
          <button className="btn btn-secondary" onClick={handleRemindLater}>
            Remind Later
          </button>
          <button className="btn btn-primary" onClick={onExport}>
            <span>📤</span> Export Now
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export default BackupReminderModal;
