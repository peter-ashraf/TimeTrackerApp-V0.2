import React, { useState } from 'react';
import ModalShell from './ModalShell';
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
    <ModalShell onClose={onClose} contentClassName="backup-reminder-modal">
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
        <select
          className="form-control"
          value={reminderInterval}
          onChange={(e) => setReminderInterval(e.target.value)}
        >
          <option value="1">1 day</option>
          <option value="3">3 days</option>
          <option value="7">1 week</option>
          <option value="14">2 weeks</option>
          <option value="custom">Custom...</option>
        </select>
        
        {reminderInterval === 'custom' && (
          <div className="custom-days-input">
            <input
              type="number"
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
    </ModalShell>
  );
}

export default BackupReminderModal;
