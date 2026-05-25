import React, { useState } from 'react';
import '../styles/conflict-resolution-modal.css';

const ConflictResolutionModal = ({ conflicts, onResolve }) => {
  const [resolutions, setResolutions] = useState({});

  if (!conflicts || conflicts.length === 0) return null;

  const formatTime = (timeString) => {
    if (!timeString) return '—';
    const date = new Date(timeString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDuration = (entry) => {
    if (!entry?.intervals) return '—';
    // Only sum intervals that have both in AND out times
    const completedIntervals = entry.intervals.filter(i => i.in && i.out);
    if (completedIntervals.length === 0) return '—';
    // calculate total duration from completed intervals only
    const totalMs = completedIntervals.reduce((sum, i) => {
      return sum + (new Date(i.out) - new Date(i.in));
    }, 0);
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  const getEntryDetails = (entry) => {
    const intervals = entry.intervals || [];
    const checkIn = intervals[0]?.in || '--';
    const checkOut = intervals[0]?.out || '--';
    const notes = entry.notes || '';
    return { checkIn, checkOut, notes };
  };

  const handleChoice = (conflict, choice) => {
    setResolutions(prev => ({
      ...prev,
      [conflict.date]: choice
    }));
  };

  const handleBatchChoice = (choice) => {
    const newResolutions = {};
    conflicts.forEach(conflict => {
      newResolutions[conflict.date] = choice;
    });
    setResolutions(newResolutions);
  };

  const allResolved = conflicts.length > 0 && conflicts.every(c => resolutions[c.date]);

  const handleApply = () => {
    const resolutionArray = conflicts.map(conflict => ({
      entryId: conflict.entryId || conflict.date,
      chosenEntry: resolutions[conflict.date] === 'local' ? conflict.localEntry : conflict.remoteEntry
    }));
    onResolve(resolutionArray);
  };

  return (
    <div className="conflict-modal-overlay">
      <div className="conflict-modal">
        <div className="conflict-header">
          <h2>Sync Conflicts Found</h2>
          <span className="conflict-count">{conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}</span>
        </div>

        <div className="batch-actions">
          <button
            className="btn btn-secondary"
            onClick={() => handleBatchChoice('local')}
          >
            Keep All Mine
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleBatchChoice('remote')}
          >
            Use All Online
          </button>
        </div>

        <div className="conflict-list">
          {conflicts.map((conflict, index) => {
            const { date, localEntry, remoteEntry } = conflict;
            const localDetails = getEntryDetails(localEntry);
            const remoteDetails = getEntryDetails(remoteEntry);
            const choice = resolutions[date];

            return (
              <div key={date} className="conflict-card">
                <div className="conflict-card-header">
                  <h3>{formatDate(date)}</h3>
                  {choice && <span className="resolved-badge">Resolved</span>}
                </div>

                <div className="conflict-columns">
                  <div className={`conflict-column ${choice === 'local' ? 'selected' : ''}`}>
                    <div className="column-header">📱 Your Offline Edit</div>
                    <div className="column-content">
                      <div className="field-row">
                        <span className="field-label">Check-in:</span>
                        <span className="field-value">{formatTime(localDetails.checkIn)}</span>
                      </div>
                      <div className="field-row">
                        <span className="field-label">Check-out:</span>
                        <span className="field-value">{formatTime(localDetails.checkOut)}</span>
                      </div>
                      <div className="field-row">
                        <span className="field-label">Duration:</span>
                        <span className="field-value">{formatDuration(localEntry)}</span>
                      </div>
                      {localDetails.notes && (
                        <div className="field-row">
                          <span className="field-label">Notes:</span>
                          <span className="field-value">{localDetails.notes}</span>
                        </div>
                      )}
                    </div>
                    <button
                      className={`btn ${choice === 'local' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleChoice(conflict, 'local')}
                    >
                      Keep My Edit
                    </button>
                  </div>

                  <div className={`conflict-column ${choice === 'remote' ? 'selected' : ''}`}>
                    <div className="column-header">☁️ Online Version</div>
                    <div className="column-content">
                      <div className="field-row">
                        <span className="field-label">Check-in:</span>
                        <span className="field-value">{formatTime(remoteDetails.checkIn)}</span>
                      </div>
                      <div className="field-row">
                        <span className="field-label">Check-out:</span>
                        <span className="field-value">{formatTime(remoteDetails.checkOut)}</span>
                      </div>
                      <div className="field-row">
                        <span className="field-label">Duration:</span>
                        <span className="field-value">{formatDuration(remoteEntry)}</span>
                      </div>
                      {remoteDetails.notes && (
                        <div className="field-row">
                          <span className="field-label">Notes:</span>
                          <span className="field-value">{remoteDetails.notes}</span>
                        </div>
                      )}
                    </div>
                    <button
                      className={`btn ${choice === 'remote' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleChoice(conflict, 'remote')}
                    >
                      Use Online Version
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="conflict-footer">
          <button
            className="btn btn-primary btn-large"
            disabled={!allResolved}
            onClick={handleApply}
          >
            Apply All
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolutionModal;
