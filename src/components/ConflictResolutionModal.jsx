import React, { useEffect, useMemo, useState } from 'react';
import '../styles/conflict-resolution-modal.css';

const ConflictResolutionModal = ({ conflicts, onResolve, onClose }) => {
  const [resolutions, setResolutions] = useState({});

  useEffect(() => {
    setResolutions({});
  }, [conflicts]);

  const hasConflicts = Array.isArray(conflicts) && conflicts.length > 0;

  const timeToSeconds = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;

    const normalized = timeStr.trim();
    if (!normalized) return null;

    const parts = normalized.split(':').map(Number);
    if (parts.some(Number.isNaN)) return null;

    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    if (parts.length === 2) {
      return parts[0] * 3600 + parts[1] * 60;
    }

    return null;
  };

  const formatTime = (timeString) => {
    if (!timeString || typeof timeString !== 'string') return '—';

    const trimmed = timeString.trim();
    if (!trimmed) return '—';

    if (trimmed.includes('T') || trimmed.includes('Z')) {
      const date = new Date(trimmed);
      if (isNaN(date.getTime())) return '—';

      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
    }

    const parts = trimmed.split(':').map(Number);
    if (parts.some(Number.isNaN) || (parts.length !== 2 && parts.length !== 3)) {
      return '—';
    }

    let hours = parts[0];
    const minutes = parts[1];
    const suffix = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    if (hours === 0) hours = 12;

    return `${hours}:${String(minutes).padStart(2, '0')} ${suffix}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString || 'Unknown Date';

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDuration = (entry) => {
    if (!entry?.intervals || !Array.isArray(entry.intervals)) return '—';

    const completedIntervals = entry.intervals.filter(
      (interval) => interval?.in && interval?.out
    );

    if (completedIntervals.length === 0) return '—';

    const totalSeconds = completedIntervals.reduce((sum, interval) => {
      const inSeconds = timeToSeconds(interval.in);
      const outSeconds = timeToSeconds(interval.out);

      if (inSeconds === null || outSeconds === null || outSeconds <= inSeconds) {
        return sum;
      }

      return sum + (outSeconds - inSeconds);
    }, 0);

    if (totalSeconds <= 0) return '—';

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours === 0 && minutes === 0) return '—';
    if (minutes === 0) return `${hours}h`;
    if (hours === 0) return `${minutes}m`;

    return `${hours}h ${minutes}m`;
  };

  const getEntryDetails = (entry) => {
    const intervals = Array.isArray(entry?.intervals) ? entry.intervals : [];
    const firstInterval = intervals[0] || null;

    return {
      checkIn: firstInterval?.in || null,
      checkOut: firstInterval?.out || null,
      notes: entry?.notes?.trim?.() || ''
    };
  };

  const handleChoice = (conflict, choice) => {
    setResolutions((prev) => ({
      ...prev,
      [conflict.date]: choice
    }));
  };

  const handleBatchChoice = (choice) => {
    const next = {};
    conflicts.forEach((conflict) => {
      next[conflict.date] = choice;
    });
    setResolutions(next);
  };

  const allResolved = hasConflicts && conflicts.every((c) => resolutions[c.date]);

  const handleApply = () => {
    const resolutionArray = conflicts.map((conflict) => ({
      entryId: conflict.entryId || conflict.date,
      date: conflict.date,
      choice: resolutions[conflict.date],
      localEntry: conflict.localEntry,
      remoteEntry: conflict.remoteEntry,
      chosenEntry:
        resolutions[conflict.date] === 'local'
          ? conflict.localEntry
          : conflict.remoteEntry
    }));

    onResolve(resolutionArray);
  };

  const modalCountLabel = useMemo(() => {
    if (!hasConflicts) return '';
    return `${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''}`;
  }, [conflicts, hasConflicts]);

  if (!hasConflicts) return null;

  return (
    <div className="conflict-modal-overlay">
      <div className="conflict-modal">
        <div className="conflict-header">
          <div>
            <h2>Sync Conflicts Found</h2>
            <span className="conflict-count">{modalCountLabel}</span>
          </div>

          <button
            type="button"
            className="conflict-close-btn"
            onClick={onClose}
            aria-label="Close conflict resolution modal"
          >
            ×
          </button>
        </div>

        <div className="batch-actions">
          <button className="btn btn-secondary" onClick={() => handleBatchChoice('local')}>
            Keep All Mine
          </button>
          <button className="btn btn-primary" onClick={() => handleBatchChoice('remote')}>
            Use All Online
          </button>
        </div>

        <div className="conflict-list">
          {conflicts.map((conflict) => {
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
                    <div className="column-header">Your Offline Edit</div>

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

                      <button
                        className={`btn ${choice === 'local' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleChoice(conflict, 'local')}
                      >
                        Keep My Edit
                      </button>
                    </div>
                  </div>

                  <div className={`conflict-column ${choice === 'remote' ? 'selected' : ''}`}>
                    <div className="column-header">Online Version</div>

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

                      <button
                        className={`btn ${choice === 'remote' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleChoice(conflict, 'remote')}
                      >
                        Use Online Version
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="conflict-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>

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