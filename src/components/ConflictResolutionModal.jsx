import React, { useState, useEffect } from 'react';
import '../styles/conflict-resolution.css';

const ConflictResolutionModal = ({ conflicts, onResolve, onResolveAll }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(prev => Math.min(prev, Math.max(0, conflicts.length - 1)));
  }, [conflicts.length]);

  if (!conflicts || conflicts.length === 0) return null;

  const conflict = conflicts[currentIndex] || conflicts;
  if (!conflict) return null;
  const { date, local: localEntry, remote: remoteEntry } = conflict;

  console.log('CONFLICT_DEBUG:', JSON.stringify(conflict));

  const normalizeEntry = (entry) => {
    // If the entry format uses a generic start/end instead of intervals, try to support it
    const intervals = entry.intervals || [];
    const checkIn = intervals[0]?.in || '--:--:--';
    // For checkOut, sometimes the first interval holds the checkOut, occasionally the last one does.
    // In our app, intervals[0] is typically the full duration check in / out.
    const checkOut = intervals[0]?.out || '--:--:--';
    const breaks = intervals.slice(1);

    return {
      ...entry,
      checkIn,
      checkOut,
      breaks,
      hours: entry.hoursWorked ?? entry.hours_worked ?? 0,
    };
  };

  const localNorm = normalizeEntry(localEntry);
  const remoteNorm = normalizeEntry(remoteEntry);

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

  const formatBreaks = (breaks) => {
    if (!breaks || breaks.length === 0) return 'No breaks';
    return breaks.map((b, i) => `${formatTime(b.out)} - ${formatTime(b.in)}`).join(', ');
  };

  const isBreakDifferent = (localBreaks, remoteBreaks) => {
    if ((!localBreaks || localBreaks.length === 0) && (!remoteBreaks || remoteBreaks.length === 0)) return false;
    return JSON.stringify(localBreaks) !== JSON.stringify(remoteBreaks);
  };

  return (
    <div className="conflict-modal-overlay">
      <div className="conflict-modal">
        <div className="conflict-header">
          <h2>Resolve Data Conflict</h2>
        </div>

        {conflicts.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <button
              onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              style={{ opacity: currentIndex === 0 ? 0.3 : 1 }}
            >
              ← Prev
            </button>
            <span>Conflict {currentIndex + 1} of {conflicts.length}</span>
            <button
              onClick={() => setCurrentIndex(i => Math.min(conflicts.length - 1, i + 1))}
              disabled={currentIndex === conflicts.length - 1}
              style={{ opacity: currentIndex === conflicts.length - 1 ? 0.3 : 1 }}
            >
              Next →
            </button>
          </div>
        )}

        <div className="conflict-date">
          <strong>{formatDate(date)}</strong>
        </div>

        <div className="conflict-content">
          <div className="conflict-card local-card">
            <h3>Local Version</h3>
            <div className="card-content">
              <FieldValue
                label="Check In"
                value={formatTime(localNorm.checkIn)}
                isDifferent={isFieldDifferent(
                  localNorm.checkIn,
                  remoteNorm.checkIn
                )}
              />
              <FieldValue
                label="Check Out"
                value={formatTime(localNorm.checkOut)}
                isDifferent={isFieldDifferent(
                  localNorm.checkOut,
                  remoteNorm.checkOut
                )}
              />
              <FieldValue
                label="Breaks"
                value={formatBreaks(localNorm.breaks)}
                isDifferent={isBreakDifferent(
                  localNorm.breaks,
                  remoteNorm.breaks
                )}
              />
              <FieldValue
                label="Hours"
                value={formatHours(localNorm.hours)}
                isDifferent={isFieldDifferent(
                  localNorm.hours,
                  remoteNorm.hours
                )}
              />
            </div>
          </div>

          <div className="conflict-card remote-card">
            <h3>Remote Version</h3>
            <div className="card-content">
              <FieldValue
                label="Check In"
                value={formatTime(remoteNorm.checkIn)}
                isDifferent={isFieldDifferent(
                  localNorm.checkIn,
                  remoteNorm.checkIn
                )}
              />
              <FieldValue
                label="Check Out"
                value={formatTime(remoteNorm.checkOut)}
                isDifferent={isFieldDifferent(
                  localNorm.checkOut,
                  remoteNorm.checkOut
                )}
              />
              <FieldValue
                label="Breaks"
                value={formatBreaks(remoteNorm.breaks)}
                isDifferent={isBreakDifferent(
                  localNorm.breaks,
                  remoteNorm.breaks
                )}
              />
              <FieldValue
                label="Hours"
                value={formatHours(remoteNorm.hours)}
                isDifferent={isFieldDifferent(
                  localNorm.hours,
                  remoteNorm.hours
                )}
              />
            </div>
          </div>
        </div>

        <div className="conflict-actions">
          <div className="individual-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                onResolve(conflict.date, conflict.local);
                // Adjust index if needed after resolving
                if (currentIndex >= conflicts.length - 1) {
                  setCurrentIndex(Math.max(0, currentIndex - 1));
                }
              }}
            >
              Keep Local
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                onResolve(conflict.date, conflict.remote);
                // Adjust index if needed after resolving
                if (currentIndex >= conflicts.length - 1) {
                  setCurrentIndex(Math.max(0, currentIndex - 1));
                }
              }}
            >
              Use Remote
            </button>
          </div>

          {conflicts.length > 1 && (
            <div className="bulk-actions">
              <button
                className="btn"
                style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none' }}
                onClick={() => onResolveAll('local')}
              >
                Keep All Local
              </button>
              <button
                className="btn"
                style={{ backgroundColor: '#14b8a6', color: 'white', border: 'none' }}
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
