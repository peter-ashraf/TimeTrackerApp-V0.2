import React, { useMemo, useState } from 'react';
import ModalShell from './ModalShell';
import CustomSelect from './CustomSelect';
import { useTimeTracker } from '../context/TimeTrackerContext';
import {
  buildEntryUpdateFromHrRow,
  compareHrTimesheetToEntries,
  createBlankDayOffRow,
  createBlankWorkRow,
  emptyHrTimesheetData,
  parseHrTimesheetText
} from '../utils/hrTimesheetCompare';
import '../styles/timesheet-compare-modal.css';

const STEP_LABELS = {
  source: 'Source',
  review: 'Review OCR Data',
  results: 'Compare'
};

const isValidWorkRow = (row) => row.date && row.checkIn && row.checkOut;
const isValidDayOffRow = (row) => row.date && row.type;

function TimesheetCompareModal({ onClose, onEditEntry }) {
  const {
    entries,
    periods,
    currentPeriodId,
    setEntries,
    saveTimeEntriesData,
    calculateHoursWorked,
    showAlert
  } = useTimeTracker();

  const [step, setStep] = useState('source');
  const [selectedPeriodId, setSelectedPeriodId] = useState(currentPeriodId || periods[0]?.id || '');
  const [ocrData, setOcrData] = useState(emptyHrTimesheetData());
  const [ocrStatus, setOcrStatus] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [comparisons, setComparisons] = useState([]);
  const [rowActions, setRowActions] = useState({});
  const [isApplying, setIsApplying] = useState(false);

  const selectedPeriod = useMemo(
    () => periods.find(period => String(period.id) === String(selectedPeriodId)) || periods[0],
    [periods, selectedPeriodId]
  );

  const periodEntries = useMemo(() => {
    if (!selectedPeriod) return entries;
    const start = selectedPeriod.start_date || selectedPeriod.start;
    const end = selectedPeriod.end_date || selectedPeriod.end;
    return entries.filter(entry => entry.date >= start && entry.date <= end);
  }, [entries, selectedPeriod]);

  const hasReviewData = useMemo(
    () =>
      ocrData.workRows.some(isValidWorkRow) ||
      ocrData.dayOffRows.some(isValidDayOffRow),
    [ocrData]
  );

  const periodOptions = periods.map(period => ({
    label: `${period.label}${String(period.id) === String(currentPeriodId) ? ' (Current)' : ''}`,
    value: period.id
  }));

  const formatDay = (date) => {
    if (!date) return '-';
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const formatAppRow = (entry, date) => {
    if (!entry) {
      return {
        source: 'App',
        day: formatDay(date),
        checkIn: '-',
        checkOut: '-',
        hours: 'Missing',
        type: 'Missing'
      };
    }

    const interval = entry.intervals?.[0] || {};
    const isComplete = entry.type === 'Regular' && interval.in && interval.out;
    const hours = isComplete
      ? `${calculateHoursWorked(entry.intervals, entry.date).toFixed(2)}h`
      : entry.type === 'Regular'
        ? '0.00h'
        : entry.type;

    return {
      source: 'App',
      day: formatDay(entry.date),
      checkIn: interval.in || '-',
      checkOut: interval.out || '-',
      hours,
      type: entry.type || 'Regular'
    };
  };

  const formatHrRow = (row, date) => {
    if (!row) {
      return {
        source: 'HR Sheet',
        day: formatDay(date),
        checkIn: '-',
        checkOut: '-',
        hours: 'Missing',
        type: 'Missing'
      };
    }

    return {
      source: 'HR Sheet',
      day: row.day || formatDay(row.date),
      checkIn: row.checkIn || '-',
      checkOut: row.checkOut || '-',
      hours: row.type === 'Regular' ? row.hrDuration || '-' : row.type,
      type: row.type
    };
  };

  const getCellClass = (item, field) => {
    if (!item.issues.length) return '';
    if (item.issues.includes('App missing entry') || item.issues.includes('HR missing entry')) return 'compare-cell-different';
    if ((field === 'checkIn' || field === 'checkOut') && item.issues.includes('Time mismatch')) return 'compare-cell-different';
    if (field === 'hours' && item.issues.includes('Duration mismatch')) return 'compare-cell-different';
    return '';
  };

  const updateWorkRow = (id, field, value) => {
    setOcrData(prev => ({
      ...prev,
      workRows: prev.workRows.map(row => (
        row.id === id ? { ...row, [field]: value } : row
      ))
    }));
  };

  const updateDayOffRow = (id, field, value) => {
    setOcrData(prev => ({
      ...prev,
      dayOffRows: prev.dayOffRows.map(row => (
        row.id === id ? { ...row, [field]: value } : row
      ))
    }));
  };

  const handleImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImagePreview(URL.createObjectURL(file));
    setIsReading(true);
    setOcrStatus('Reading image...');
    setOcrProgress(0);

    try {
      const Tesseract = await import('tesseract.js');
      const recognize = Tesseract.recognize || Tesseract.default?.recognize;
      if (!recognize) {
        throw new Error('Tesseract OCR engine is unavailable.');
      }

      const result = await recognize(file, 'eng', {
        logger: (message) => {
          if (message.status) setOcrStatus(message.status);
          if (typeof message.progress === 'number') {
            setOcrProgress(Math.round(message.progress * 100));
          }
        }
      });

      const parsed = parseHrTimesheetText(result?.data?.text || '', {
        confidence: result?.data?.confidence ?? null
      });

      setOcrData(parsed);
      setStep('review');
      setOcrStatus('Review extracted data before comparing.');
    } catch (error) {
      console.error('OCR failed:', error);
      setOcrStatus('Could not read this image. Try another photo or a clearer crop.');
    } finally {
      setIsReading(false);
      event.target.value = '';
    }
  };

  const startComparison = () => {
    const reviewedData = {
      ...ocrData,
      workRows: ocrData.workRows.filter(isValidWorkRow),
      dayOffRows: ocrData.dayOffRows.filter(isValidDayOffRow)
    };
    const nextComparisons = compareHrTimesheetToEntries(reviewedData, periodEntries, selectedPeriod);
    setComparisons(nextComparisons);
    setRowActions({});
    setStep('results');
  };

  const setAction = (id, action) => {
    setRowActions(prev => ({ ...prev, [id]: action }));
  };

  const applySelectedChanges = async () => {
    const rowsToApply = comparisons.filter(item => rowActions[item.id] === 'apply' && item.hrRow);
    if (rowsToApply.length === 0) {
      showAlert('No HR changes selected to apply.', 'info');
      return;
    }

    setIsApplying(true);

    try {
      const updatesByDate = new Map();
      rowsToApply.forEach(item => {
        updatesByDate.set(
          item.hrRow.date,
          {
            ...buildEntryUpdateFromHrRow(item.hrRow, item.appEntry || {}),
            lastModified: new Date().toISOString()
          }
        );
      });

      const nextEntries = entries
        .filter(entry => !updatesByDate.has(entry.date))
        .concat(Array.from(updatesByDate.values()))
        .sort((a, b) => b.date.localeCompare(a.date));

      setEntries(nextEntries);

      const timeoutMs = 10000;
      const saveResult = await Promise.race([
        saveTimeEntriesData(nextEntries, showAlert),
        new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), timeoutMs))
      ]);

      if (saveResult?.timedOut) {
        showAlert(`${rowsToApply.length} change${rowsToApply.length === 1 ? '' : 's'} applied locally. Cloud sync is still catching up.`, 'warning');
      } else {
        showAlert(`${rowsToApply.length} HR timesheet change${rowsToApply.length === 1 ? '' : 's'} applied.`, 'success');
      }

      onClose();
    } catch (error) {
      console.error('Failed to apply HR comparison changes:', error);
      showAlert('Failed to apply selected HR changes.', 'error');
    } finally {
      setIsApplying(false);
    }
  };

  const handleManualEdit = (entry) => {
    if (!entry || !onEditEntry) return;
    onClose();
    onEditEntry(entry);
  };

  return (
    <ModalShell onClose={onClose} closeOnOverlay={false} contentClassName="timesheet-compare-modal">
      <div className="modal-header">
        <h2>Compare HR Timesheet</h2>
        <div className="compare-step-pills">
          {Object.entries(STEP_LABELS).map(([id, label]) => (
            <span key={id} className={`compare-step-pill ${step === id ? 'active' : ''}`}>
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="modal-body">
        {step === 'source' && (
          <section className="compare-section">
            <div className="form-group">
              <label className="form-label">App period to compare</label>
              <CustomSelect
                id="hr-compare-period"
                name="hrComparePeriod"
                value={selectedPeriodId}
                onChange={(event) => setSelectedPeriodId(event.target.value)}
                options={periodOptions}
              />
            </div>

            <div className="compare-upload-grid">
              <label className="compare-upload-option">
                <input type="file" accept="image/*" capture="environment" onChange={handleImage} />
                <span>Take Photo</span>
              </label>
              <label className="compare-upload-option">
                <input type="file" accept="image/*" onChange={handleImage} />
                <span>Choose Image</span>
              </label>
            </div>

            {imagePreview && (
              <img className="compare-image-preview" src={imagePreview} alt="Selected HR timesheet" />
            )}

            {isReading && (
              <div className="compare-progress">
                <span>{ocrStatus || 'Reading image...'}</span>
                <div className="compare-progress-track">
                  <div className="compare-progress-fill" style={{ width: `${ocrProgress}%` }} />
                </div>
              </div>
            )}

            {!isReading && ocrStatus && <p className="compare-status">{ocrStatus}</p>}
          </section>
        )}

        {step === 'review' && (
          <section className="compare-section">
            <div className="compare-review-header">
              <div>
                <h3>Review Extracted Data</h3>
                <p>Correct OCR mistakes before comparison starts.</p>
              </div>
              <button type="button" className="btn btn-outline" onClick={() => setStep('source')}>
                Use Another Image
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Total overtime hours</label>
              <input
                type="number"
                inputMode="decimal"
                className="form-control"
                value={ocrData.totalOvertime}
                onChange={(event) => setOcrData(prev => ({ ...prev, totalOvertime: event.target.value }))}
                placeholder="0.98"
                step="0.01"
              />
            </div>

            <div className="compare-review-toolbar">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setOcrData(prev => ({ ...prev, workRows: [...prev.workRows, createBlankWorkRow()] }))}
              >
                Add Work Row
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setOcrData(prev => ({ ...prev, dayOffRows: [...prev.dayOffRows, createBlankDayOffRow()] }))}
              >
                Add Day Off
              </button>
            </div>

            <h4>Work Rows</h4>
            <div className="compare-table-wrap">
              <table className="compare-data-table compare-review-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Hours Spent</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ocrData.workRows.map(row => (
                    <tr key={row.id} className="compare-hr-row">
                      <td>
                        <input className="form-control" type="date" value={row.date} onChange={(event) => updateWorkRow(row.id, 'date', event.target.value)} />
                      </td>
                      <td>
                        <input className="form-control" value={row.day} onChange={(event) => updateWorkRow(row.id, 'day', event.target.value)} placeholder="Day" />
                      </td>
                      <td>
                        <input className="form-control" type="time" step="1" value={row.checkIn} onChange={(event) => updateWorkRow(row.id, 'checkIn', event.target.value)} />
                      </td>
                      <td>
                        <input className="form-control" type="time" step="1" value={row.checkOut} onChange={(event) => updateWorkRow(row.id, 'checkOut', event.target.value)} />
                      </td>
                      <td>
                        <input className="form-control" value={row.hrDuration} onChange={(event) => updateWorkRow(row.id, 'hrDuration', event.target.value)} placeholder="Time" />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => setOcrData(prev => ({ ...prev, workRows: prev.workRows.filter(item => item.id !== row.id) }))}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {ocrData.workRows.length === 0 && (
                    <tr>
                      <td colSpan="6" className="compare-empty-cell">No work rows found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <h4>Days Off</h4>
            <div className="compare-table-wrap">
              <table className="compare-data-table compare-review-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Hours Spent</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ocrData.dayOffRows.map(row => (
                    <tr key={row.id} className="compare-hr-row">
                      <td>
                        <input className="form-control" type="date" value={row.date} onChange={(event) => updateDayOffRow(row.id, 'date', event.target.value)} />
                      </td>
                      <td>
                        <input className="form-control" value={row.day} onChange={(event) => updateDayOffRow(row.id, 'day', event.target.value)} placeholder="Day" />
                      </td>
                      <td>-</td>
                      <td>-</td>
                      <td>
                        <CustomSelect
                          id={`day-off-type-${row.id}`}
                          name={`dayOffType-${row.id}`}
                          value={row.type}
                          onChange={(event) => updateDayOffRow(row.id, 'type', event.target.value)}
                          options={[
                            { label: 'Holiday', value: 'Holiday' },
                            { label: 'Sick Leave', value: 'Sick Leave' },
                            { label: 'Vacation', value: 'Vacation' },
                            { label: 'Leave', value: 'Leave' }
                          ]}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => setOcrData(prev => ({ ...prev, dayOffRows: prev.dayOffRows.filter(item => item.id !== row.id) }))}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {ocrData.dayOffRows.length === 0 && (
                    <tr>
                      <td colSpan="6" className="compare-empty-cell">No days off found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {step === 'results' && (
          <section className="compare-section">
            <div className="compare-results-summary">
              <strong>{comparisons.filter(item => item.issues.length > 0).length}</strong> differences found
              <span>{comparisons.filter(item => item.issues.length === 0).length} matches</span>
            </div>

            <div className="compare-table-wrap">
              <table className="compare-data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Hours Spent</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map(item => {
                    const appRow = formatAppRow(item.appEntry, item.date);
                    const hrRow = formatHrRow(item.hrRow, item.date);
                    const hasDiff = item.issues.length > 0;

                    return (
                      <React.Fragment key={item.id}>
                        <tr className={`compare-pair-row compare-app-row ${hasDiff ? 'has-diff' : 'match'}`}>
                          <td className="compare-date-cell">
                            <strong>{item.date}</strong>
                            <span className="compare-source-pill source-app">{appRow.source}</span>
                          </td>
                          <td>{appRow.day}</td>
                          <td className={getCellClass(item, 'checkIn')}>{appRow.checkIn}</td>
                          <td className={getCellClass(item, 'checkOut')}>{appRow.checkOut}</td>
                          <td className={getCellClass(item, 'hours')}>{appRow.hours}</td>
                          <td rowSpan="2" className="compare-action-cell">
                            <div className="compare-status-text">
                              {hasDiff ? item.issues.join(', ') : 'Match'}
                            </div>
                            {hasDiff && (
                              <div className="compare-result-actions">
                                <CustomSelect
                                  id={`compare-action-${item.id}`}
                                  name={`compareAction-${item.id}`}
                                  value={rowActions[item.id] || 'none'}
                                  onChange={(event) => setAction(item.id, event.target.value)}
                                  options={[
                                    { label: 'Do nothing', value: 'none' },
                                    ...(item.hrRow ? [{ label: 'Apply HR value to app', value: 'apply' }] : []),
                                    ...(item.appEntry ? [{ label: 'Edit app entry manually', value: 'manual' }] : [])
                                  ]}
                                />
                                {rowActions[item.id] === 'manual' && item.appEntry && (
                                  <button type="button" className="btn btn-sm btn-outline" onClick={() => handleManualEdit(item.appEntry)}>
                                    Open Edit
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                        <tr className={`compare-pair-row compare-hr-row ${hasDiff ? 'has-diff' : 'match'}`}>
                          <td className="compare-date-cell">
                            <strong>{item.date}</strong>
                            <span className="compare-source-pill source-hr">{hrRow.source}</span>
                          </td>
                          <td>{hrRow.day}</td>
                          <td className={getCellClass(item, 'checkIn')}>{hrRow.checkIn}</td>
                          <td className={getCellClass(item, 'checkOut')}>{hrRow.checkOut}</td>
                          <td className={getCellClass(item, 'hours')}>{hrRow.hours}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <div className="modal-footer">
        <div className="modal-actions">
          {step === 'review' && (
            <button type="button" className="btn btn-primary" disabled={!hasReviewData} onClick={startComparison}>
              Start Comparison
            </button>
          )}
          {step === 'results' && (
            <>
              <button type="button" className="btn btn-outline" onClick={() => setStep('review')}>
                Back to Review
              </button>
              <button type="button" className="btn btn-primary" disabled={isApplying} onClick={applySelectedChanges}>
                {isApplying ? 'Applying...' : 'Apply Selected'}
              </button>
            </>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export default TimesheetCompareModal;
