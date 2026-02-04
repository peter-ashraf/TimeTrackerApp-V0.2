import React from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';

function ViewHoursModal({ onClose }) {
  const { entries, getCurrentPeriod } = useTimeTracker();
  const currentPeriod = getCurrentPeriod();

  // Filter entries for current period
  const periodEntries = entries.filter(e => {
    if (!currentPeriod) return false;
    return e.date >= currentPeriod.start && e.date <= currentPeriod.end;
  });

  // Calculate hours for each entry
  const calculateHours = (intervals) => {
    if (!intervals || intervals.length === 0) return 0;
    
    let totalMinutes = 0;
    intervals.forEach(interval => {
      if (interval.in && interval.out) {
        const [inH, inM] = interval.in.split(':').map(Number);
        const [outH, outM] = interval.out.split(':').map(Number);
        const inMinutes = inH * 60 + inM;
        const outMinutes = outH * 60 + outM;
        totalMinutes += outMinutes - inMinutes;
      }
    });
    
    return totalMinutes / 60;
  };

  // Calculate totals
  const totalHours = periodEntries.reduce((sum, entry) => {
    if (entry.type === 'Regular') {
      return sum + calculateHours(entry.intervals);
    }
    return sum;
  }, 0);

  const expectedHours = 187.5; // Standard monthly hours
  const overtime = totalHours - expectedHours;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Hours Summary - {currentPeriod?.label || 'Current Period'}</h2>
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

          <h3 style={{marginTop: '20px'}}>Daily Breakdown</h3>
          <table className="data-table" style={{marginTop: '10px'}}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Hours</th>
              </tr>
            </thead>
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
                    <td>{entry.type === 'Regular' ? calculateHours(entry.intervals).toFixed(2) + 'h' : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default ViewHoursModal;
