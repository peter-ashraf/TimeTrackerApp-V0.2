import React from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import ModalShell from './ModalShell';
import '../styles/view-hours-modal.css';
import { isWorkedDay } from '../utils/entryType';
import { parseIntervals } from '../utils/timeEntrySyncPlanner';

function ViewHoursModal({ onClose }) {
  const { entries, getCurrentPeriod, employee, calculateHoursWorked } = useTimeTracker();
  const currentPeriod = getCurrentPeriod();

  // Filter entries for current period
  const periodEntries = entries.filter(e => {
    if (!currentPeriod) return false;
    
    const periodStart = currentPeriod.start_date || currentPeriod.start;
    const periodEnd = currentPeriod.end_date || currentPeriod.end;
    
    return e.date >= periodStart && e.date <= periodEnd;
  });

  // Calculate hours for each entry
  const calculateHours = (rawIntervals, date) => {
    const intervals = parseIntervals(rawIntervals).filter(i => i?.in || i?.out);
    if (intervals.length === 0) return 0;
    if (intervals.some(i => i.in && !i.out)) return 0;
    return calculateHoursWorked ? calculateHoursWorked(intervals, date) : 0;
  };

  // Calculate totals
  const totalHours = periodEntries.reduce((sum, entry) => {
    if (isWorkedDay(entry)) {
      return sum + calculateHours(entry.intervals, entry.date);
    } else if (entry.type === 'Sick Leave' || entry.type === 'Holiday' || entry.type === 'Vacation') {
      // Each sick day, holiday, or vacation day counts as 8.5 hours (normal working day without half hour break)
      return sum + (8.5 * (entry.duration || 1));
    }
    return sum;
  }, 0);

  const expectedHours = employee.monthlyHours; // Employee-specific monthly hours
  const overtime = totalHours - expectedHours;

  return (
    <ModalShell onClose={onClose} closeOnOverlay={false} contentClassName="view-hours-modal">
      <div className="modal-header">
        <h2>Hours Summary - {currentPeriod?.label || 'Current Period'}</h2>
      </div>
      <div className="modal-body">
        <div className="hours-summary">
          <div className="summary-item">
            <span className="summary-label">Total Hours Worked:</span>
            <span className="summary-value">{totalHours.toFixed(2)}h</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Expected Hours:</span>
            <span className="summary-value">{expectedHours}h</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Overtime:</span>
            <span className="summary-value" style={{color: overtime >= 0 ? '#80FF00' : '#FF9696'}}>
              {overtime.toFixed(2)}h
            </span>
          </div>
        </div>

        <h3>Daily Breakdown</h3>
        <div className="table-wrapper">
          <div className="table-header">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Hours</th>
                </tr>
              </thead>
            </table>
          </div>
          <div className="table-container">
            <table className="data-table">
              <tbody>
                {periodEntries.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{textAlign: 'center'}}>No entries found</td>
                  </tr>
                ) : (
                  periodEntries.map(entry => (
                    <tr key={entry.date}>
                      <td>{entry.date}</td>
                      <td>{entry.type}</td>
                      <td>
                        {isWorkedDay(entry)
                          ? (parseIntervals(entry.intervals).some(i => i?.in && !i?.out)
                              ? 'Tracking…'
                              : calculateHours(entry.intervals, entry.date).toFixed(2) + 'h')
                          : (entry.type === 'Sick Leave' || entry.type === 'Holiday' || entry.type === 'Vacation')
                            ? (8.5 * (entry.duration || 1)).toFixed(2) + 'h'
                            : '-'
                        }
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="modal-footer">
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </ModalShell>
  );
}

export default ViewHoursModal;
