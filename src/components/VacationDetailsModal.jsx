import React from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import ModalShell from './ModalShell';

function VacationDetailsModal({ type, onClose }) {
  const { entries, getCurrentPeriod, leaveSettings } = useTimeTracker();
  const currentPeriod = getCurrentPeriod();

  // Filter entries based on type
  const getFilteredEntries = () => {
    const periodEntries = entries.filter(e => {
      if (!currentPeriod) return false;
      return e.date >= currentPeriod.start && e.date <= currentPeriod.end;
    });

    switch(type) {
      case 'vacation-taken':
        return periodEntries.filter(e => e.type === 'Vacation');
      case 'vacation-to-be-added':
        return periodEntries.filter(e => e.type === 'To Be Added');
      case 'sick-used':
        return periodEntries.filter(e => e.type === 'Sick Leave');
      default:
        return [];
    }
  };

  const filteredEntries = getFilteredEntries();

  // Calculate total days
  const totalDays = filteredEntries.reduce((sum, entry) => {
    return sum + (entry.duration || 1);
  }, 0);

  // Get title and description
  const getTitle = () => {
    switch(type) {
      case 'vacation-taken':
        return 'Vacation Days Taken';
      case 'vacation-to-be-added':
        return 'Days To Be Added';
      case 'sick-used':
        return 'Sick Days Used';
      default:
        return 'Details';
    }
  };

  const getDescription = () => {
    switch(type) {
      case 'vacation-taken':
        return `You have taken ${totalDays} vacation day(s) this period.`;
      case 'vacation-to-be-added':
        return `You have ${totalDays} day(s) marked as "To Be Added" - these will be added to your vacation balance.`;
      case 'sick-used':
        return `You have used ${totalDays} sick day(s) this period.`;
      default:
        return '';
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <h2>{getTitle()}</h2>
      <p>{getDescription()}</p>
      
      <div className="modal-body">
        {filteredEntries.length === 0 ? (
          <p style={{textAlign: 'center', padding: '20px'}}>No entries found for this period.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Duration</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map(entry => (
                <tr key={entry.date}>
                  <td>{entry.date}</td>
                  <td>{entry.type}</td>
                  <td>{entry.duration === 0.5 ? 'Half Day' : 'Full Day'}</td>
                  <td>{entry.notes || '-'}</td>
                </tr>
              ))}
              <tr className="totals-row">
                <td colSpan="2"><strong>Total</strong></td>
                <td><strong>{totalDays} day(s)</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose}>Close</button>
      </div>
    </ModalShell>
  );
}

export default VacationDetailsModal;
