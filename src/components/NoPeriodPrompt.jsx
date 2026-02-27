import React from 'react';
import ModalShell from './ModalShell';

function NoPeriodPrompt({ onOpenSettings, onClose }) {
  return (
    <ModalShell isOpen={true} onClose={onClose}>
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '15px', color: '#e74c3c' }}>⚠️ No Period Found</h2>
        <p style={{ marginBottom: '20px', lineHeight: '1.5' }}>
          You don't have any pay periods created yet. You need to create a period to:
        </p>
        <ul style={{ textAlign: 'left', marginBottom: '20px', paddingLeft: '20px' }}>
          <li>Track your time entries</li>
          <li>View your timesheet</li>
          <li>Calculate overtime</li>
          <li>Generate reports</li>
        </ul>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Create Period
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export default NoPeriodPrompt;
