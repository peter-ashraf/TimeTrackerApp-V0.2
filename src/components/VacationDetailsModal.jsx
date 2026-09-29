import React from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import ModalShell from './ModalShell';
import '../styles/vacation-details-modal.css';

function VacationDetailsModal({ type, onClose }) {
  const { entries, getCurrentPeriod, leaveSettings } = useTimeTracker();
  const currentPeriod = getCurrentPeriod();

  // Filter entries based on type
  const getFilteredEntries = () => {
    const currentYear = new Date().getFullYear().toString();
    const yearlyEntries = entries.filter(e => {
      return e.date.startsWith(currentYear);
    });

    switch (type) {
      case 'vacation-taken':
        return yearlyEntries.filter(e => e.type === 'Vacation');
      case 'vacation-to-be-added':
        return yearlyEntries.filter(e => e.type === 'To Be Added');
      case 'sick-used':
        return yearlyEntries.filter(e => e.type === 'Sick Leave');
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
    switch (type) {
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
    switch (type) {
      case 'vacation-taken':
        return `You have taken ${totalDays} vacation day(s) this year.`;
      case 'vacation-to-be-added':
        return `You have ${totalDays} day(s) marked as "To Be Added" - these will be added to your vacation balance.`;
      case 'sick-used':
        return `You have used ${totalDays} sick day(s) this year.`;
      default:
        return '';
    }
  };

  return (
    <ModalShell onClose={onClose} closeOnOverlay={false} contentClassName="vacation-details-modal">
      <div className="modal-header">
        <h2>{getTitle()}</h2>
      </div>
      <div className="modal-description">
        <p>{getDescription()}</p>
      </div>
      <div className="modal-body" style={{ padding: '0', background: 'transparent' }}>
        {filteredEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            <i className="fa-regular fa-folder-open" style={{ fontSize: '32px', opacity: 0.5, marginBottom: '16px', display: 'block' }}></i>
            <p>No entries found for this period.</p>
          </div>
        ) : (
          <div className="stacked-list-container" style={{ padding: 0 }}>
            <div className="stacked-list">
              {filteredEntries.map(entry => (
                <div className="stacked-row" key={entry.date}>
                  <div className="stacked-top">
                    <div className="stacked-date">
                      <i className="fa-regular fa-calendar"></i>
                      <strong>{entry.date}</strong>
                    </div>
                    <div className="status-badge status-other">
                      {entry.type}
                    </div>
                    <div className="stacked-actions">
                      <span className="stacked-total">{entry.duration === 0.5 ? 'Half Day' : 'Full Day'}</span>
                    </div>
                  </div>
                  {entry.notes && (
                    <div className="stacked-bottom">
                      <div className="stacked-detail">
                        <span className="detail-label">Notes:</span>
                        <span className="detail-value">{entry.notes}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="modal-footer" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="glass-table-footer" style={{ minHeight: '76px', padding: '16px 24px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <i className="fa-solid fa-chart-pie" style={{ color: 'var(--accent-cyan)', fontSize: '20px' }}></i>
            <span style={{ fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '14px' }}>Total</span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
            {totalDays} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '400' }}>days</span>
          </div>
        </div>
        <div className="modal-actions" style={{ width: '100%' }}>
          <button className="btn-primary bento-modal-btn-glow" style={{ width: '100%' }} onClick={(e) => { const modal = e.target.closest('.bento-modal-overlay'); if (modal) { modal.classList.add('closing'); const content = modal.querySelector('.modal-content'); if (content) content.classList.add('closing'); } setTimeout(onClose, 350); }}>Close</button>
        </div>
      </div>
    </ModalShell>
  );
}

export default VacationDetailsModal;
