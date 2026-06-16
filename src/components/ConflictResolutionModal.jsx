import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import '../styles/conflict-resolution-modal.css';

const ConflictResolutionModal = ({ conflicts, onResolve, onClose }) => {
  const [resolutions, setResolutions] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBulkControls, setShowBulkControls] = useState(false);

  useEffect(() => {
    setResolutions({});
    setCurrentIndex(0);
    setShowBulkControls(false);
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
    const dateOnlyMatch =
      typeof dateString === 'string'
        ? dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        : null;
    const date = dateOnlyMatch
      ? new Date(
          Number(dateOnlyMatch[1]),
          Number(dateOnlyMatch[2]) - 1,
          Number(dateOnlyMatch[3]),
        )
      : new Date(dateString);

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
      duration: formatDuration(entry),
      notes: entry?.notes?.trim?.() || ''
    };
  };

  const getDisplayRows = (localEntry, remoteEntry) => {
    const localDetails = getEntryDetails(localEntry);
    const remoteDetails = getEntryDetails(remoteEntry);

    return [
      {
        key: 'checkIn',
        label: 'Check-in',
        localValue: formatTime(localDetails.checkIn),
        remoteValue: formatTime(remoteDetails.checkIn),
      },
      {
        key: 'checkOut',
        label: 'Check-out',
        localValue: formatTime(localDetails.checkOut),
        remoteValue: formatTime(remoteDetails.checkOut),
      },
      {
        key: 'duration',
        label: 'Duration',
        localValue: localDetails.duration,
        remoteValue: remoteDetails.duration,
      },
      {
        key: 'notes',
        label: 'Notes',
        localValue: localDetails.notes || 'â€”',
        remoteValue: remoteDetails.notes || 'â€”',
      },
    ].map((row) => ({
      ...row,
      differs: row.localValue !== row.remoteValue,
    }));
  };

  const renderDisplayValue = (value) => {
    const text = value == null ? '' : String(value);
    const trimmed = text.trim();

    if (!trimmed) return '-';
    if (trimmed.length <= 12 && /[Ãâ]/.test(trimmed)) return '-';

    return trimmed;
  };

  const handleChoice = (conflict, choice) => {
    setResolutions((prev) => ({
      ...prev,
      [conflict.date]: choice
    }));
  };

  const handleBulkChoice = (choice) => {
    const next = {};
    conflicts.forEach((conflict) => {
      next[conflict.date] = choice;
    });
    setResolutions(next);
  };

  const allResolved = hasConflicts && conflicts.every((c) => resolutions[c.date]);
  const currentConflict = hasConflicts ? conflicts[currentIndex] : null;
  const currentChoice = currentConflict ? resolutions[currentConflict.date] : null;
  const resolvedCount = hasConflicts
    ? conflicts.filter((conflict) => resolutions[conflict.date]).length
    : 0;

  const goToPrevious = () => {
    setCurrentIndex((index) => Math.max(0, index - 1));
  };

  const goToNext = () => {
    setCurrentIndex((index) => Math.min(conflicts.length - 1, index + 1));
  };

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

  const displayRows = getDisplayRows(
    currentConflict.localEntry,
    currentConflict.remoteEntry,
  );

  const modalMarkup = (
    <div className="conflict-modal-overlay">
      <div className="conflict-modal">
        <div className="conflict-header">
          <div>
            <h2>Sync Conflicts Found</h2>
            <span className="conflict-count">{modalCountLabel}</span>
            <span className="conflict-progress">
              {resolvedCount} of {conflicts.length} selected
            </span>
          </div>

          <button
            type="button"
            className="conflict-close-btn"
            onClick={onClose}
            aria-label="Close conflict resolution modal"
          >
            ×
          </button>
          <button
            type="button"
            className="conflict-bulk-toggle"
            onClick={() => setShowBulkControls((value) => !value)}
            aria-expanded={showBulkControls}
          >
            {showBulkControls ? 'Hide bulk controls' : 'Show bulk controls'}
          </button>
        </div>

        {showBulkControls && (
          <div className="conflict-bulk-actions" aria-label="Bulk conflict choices">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleBulkChoice('local')}
            >
              Use All Local
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleBulkChoice('remote')}
            >
              Use All Online
            </button>
          </div>
        )}

        <div className="conflict-list">
          <div className="conflict-card">
            <div className="conflict-card-header">
              <div>
                <h3>{formatDate(currentConflict.date)}</h3>
                <span className="conflict-position">
                  Conflict {currentIndex + 1} of {conflicts.length}
                </span>
              </div>
              {currentChoice && <span className="resolved-badge">Selected</span>}
            </div>

            <div className="conflict-columns">
              <div className={`conflict-column ${currentChoice === 'local' ? 'selected' : ''}`}>
                <div className="column-header">Your Offline Edit</div>

                <div className="column-content">
                  {displayRows.map((row) => (
                    <div
                      key={`local-${row.key}`}
                      className={`field-row ${row.differs ? 'is-different' : ''}`}
                    >
                      <span className="field-label">
                        {row.label}
                        {row.differs && <span className="difference-badge">Different</span>}
                      </span>
                      <span className="field-value">{renderDisplayValue(row.localValue)}</span>
                    </div>
                  ))}

                  <button
                    className={`btn ${currentChoice === 'local' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleChoice(currentConflict, 'local')}
                  >
                    Keep My Edit
                  </button>
                </div>
              </div>

              <div className={`conflict-column ${currentChoice === 'remote' ? 'selected' : ''}`}>
                <div className="column-header">Online Version</div>

                <div className="column-content">
                  {displayRows.map((row) => (
                    <div
                      key={`remote-${row.key}`}
                      className={`field-row ${row.differs ? 'is-different' : ''}`}
                    >
                      <span className="field-label">
                        {row.label}
                        {row.differs && <span className="difference-badge">Different</span>}
                      </span>
                      <span className="field-value">{renderDisplayValue(row.remoteValue)}</span>
                    </div>
                  ))}

                  <button
                    className={`btn ${currentChoice === 'remote' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleChoice(currentConflict, 'remote')}
                  >
                    Use Online Version
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="conflict-footer">
          <div className="conflict-navigation">
            <button
              type="button"
              className="btn btn-secondary conflict-nav-btn"
              onClick={goToPrevious}
              disabled={currentIndex === 0}
            >
              <span aria-hidden="true">‹</span>
              <span className="conflict-nav-label">Back</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary conflict-nav-btn"
              onClick={goToNext}
              disabled={currentIndex === conflicts.length - 1}
            >
              <span className="conflict-nav-label">Next</span>
              <span aria-hidden="true">›</span>
            </button>
          </div>

          <div className="conflict-resolve-actions">
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>

            <button
              className="btn btn-primary btn-large"
              disabled={!allResolved}
              onClick={handleApply}
            >
              Resolve
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalMarkup, document.body);
};

export default ConflictResolutionModal;
