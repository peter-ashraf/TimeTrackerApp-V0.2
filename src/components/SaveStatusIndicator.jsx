import React from 'react';
import '../styles/save-status-indicator.css';

const SaveStatusIndicator = ({ isSaving, saveStatus }) => {
  if (!isSaving && !saveStatus.message) return null;

  const getStatusIcon = () => {
    switch (saveStatus.type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return isSaving ? '💾' : 'ℹ️';
    }
  };

  return (
    <div className={`save-status-indicator ${saveStatus.type || 'info'}`}>
      <span className="status-icon">{getStatusIcon()}</span>
      <span className="status-message">{saveStatus.message}</span>
      {isSaving && <div className="saving-dots">
        <span>.</span><span>.</span><span>.</span>
      </div>}
    </div>
  );
};

export default SaveStatusIndicator;
