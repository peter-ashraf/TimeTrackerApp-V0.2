import React from 'react';
import '../styles/conflict-resolution.css';

const ConflictResolutionModal = ({ conflicts, onResolve, onResolveAll }) => {
  if (!conflicts || conflicts.length === 0) return null;

  const currentConflict = conflicts[0];
  const { date, local: localEntry, remote: remoteEntry } = currentConflict;

  const formatTime = (timeString) => {
    if (!timeString) return '--:--:--';
    if (typeof timeString === 'string' && timeString.includes(':')) {
      return timeString;
    }
    const date = new Date(timeString);
    return date.toLocaleTimeString();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatHours = (hours) => {
    if (!hours) return '0.00';
    return typeof hours === 'number' ? hours.toFixed(2) : hours;
  };

  const isFieldDifferent = (localValue, remoteValue) => {
    if (localValue === remoteValue) return false;
    if (!localValue || !remoteValue) return true;
    return String(localValue) !== String(remoteValue);
  };

  const FieldValue = ({ label, value, isDifferent }) => (
    <div className="field-row">
      <span className="field-label">{label}:</span>
      <span className={`field-value ${isDifferent ? 'different' : ''}`}>
        {value}
      </span>
    </div>
  );

  return (
    <div className="conflict-modal-overlay">
      <div className="conflict-modal">
        <div className="conflict-header">
          <h2>Resolve Data Conflict</h2>
          <div className="conflict-counter">
            {conflicts.length > 1 && `Conflict 1 of ${conflicts.length}`}
          </div>
        </div>

        <div className="conflict-date">
          <strong>{formatDate(date)}</strong>
        </div>

        <div className="conflict-content">
          <div className="conflict-card local-card">
            <h3>Local Version</h3>
            <div className="card-content">
              <FieldValue 
                label="Check In" 
                value={formatTime(localEntry.checkIn || localEntry.check_in)}
                isDifferent={isFieldDifferent(
                  localEntry.checkIn || localEntry.check_in, 
                  remoteEntry.checkIn || remoteEntry.check_in
                )}
              />
              <FieldValue 
                label="Check Out" 
                value={formatTime(localEntry.checkOut || localEntry.check_out)}
                isDifferent={isFieldDifferent(
                  localEntry.checkOut || localEntry.check_out, 
                  remoteEntry.checkOut || remoteEntry.check_out
                )}
              />
              <FieldValue 
                label="Hours" 
                value={formatHours(localEntry.hours || localEntry.hours_worked)}
                isDifferent={isFieldDifferent(
                  localEntry.hours || localEntry.hours_worked, 
                  remoteEntry.hours || remoteEntry.hours_worked
                )}
              />
            </div>
          </div>

          <div className="conflict-card remote-card">
            <h3>Remote Version</h3>
            <div className="card-content">
              <FieldValue 
                label="Check In" 
                value={formatTime(remoteEntry.checkIn || remoteEntry.check_in)}
                isDifferent={isFieldDifferent(
                  localEntry.checkIn || localEntry.check_in, 
                  remoteEntry.checkIn || remoteEntry.check_in
                )}
              />
              <FieldValue 
                label="Check Out" 
                value={formatTime(remoteEntry.checkOut || remoteEntry.check_out)}
                isDifferent={isFieldDifferent(
                  localEntry.checkOut || localEntry.check_out, 
                  remoteEntry.checkOut || remoteEntry.check_out
                )}
              />
              <FieldValue 
                label="Hours" 
                value={formatHours(remoteEntry.hours || remoteEntry.hours_worked)}
                isDifferent={isFieldDifferent(
                  localEntry.hours || localEntry.hours_worked, 
                  remoteEntry.hours || remoteEntry.hours_worked
                )}
              />
            </div>
          </div>
        </div>

        <div className="conflict-actions">
          <div className="individual-actions">
            <button 
              className="btn btn-secondary"
              onClick={() => onResolve(date, localEntry)}
            >
              Keep Local
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => onResolve(date, remoteEntry)}
            >
              Use Remote
            </button>
          </div>

          {conflicts.length > 1 && (
            <div className="bulk-actions">
              <button 
                className="btn btn-outline"
                onClick={() => onResolveAll('local')}
              >
                Keep All Local
              </button>
              <button 
                className="btn btn-outline"
                onClick={() => onResolveAll('remote')}
              >
                Use All Remote
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConflictResolutionModal;
