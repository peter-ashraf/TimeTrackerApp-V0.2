import React, { useMemo } from 'react';
import ModalShell from './ModalShell';

function OvertimeHistoryModal({ isOpen, onClose, periods, entries, calculateOvertimeDetails, currentPeriodId }) {
  const periodOvertimes = useMemo(() => {
    if (!periods || !entries || !calculateOvertimeDetails) return [];
    
    return periods.map(period => {
      const periodStart = period.start_date || period.start;
      const periodEnd = period.end_date || period.end;
      const details = calculateOvertimeDetails(entries, periodStart, periodEnd);
      
      return {
        id: period.id,
        label: period.label || `${periodStart} to ${periodEnd}`,
        isCurrent: period.id === currentPeriodId || period.is_current,
        factorHours: details.totalExtraHoursWithFactor
      };
    });
  }, [periods, entries, calculateOvertimeDetails, currentPeriodId]);

  if (!isOpen) return null;

  return (
    <ModalShell onClose={onClose} contentClassName="overtime-history-modal" showCloseButton={false}>
      <div className="modal-header">
        <h2>Overtime History</h2>
      </div>
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 24px 24px 24px', overflowY: 'auto' }}>
        {periodOvertimes.length > 0 ? periodOvertimes.map(period => (
          <div 
            key={period.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: period.isCurrent ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
              border: period.isCurrent ? '1px solid var(--accent-cyan)' : '1px solid var(--border-light)'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: period.isCurrent ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                {period.label}
                {period.isCurrent && <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--accent-cyan)', color: '#000', padding: '2px 6px', borderRadius: '12px', marginLeft: '8px' }}>CURRENT</span>}
              </span>
            </div>
            <div style={{ 
              fontSize: '1.2rem', 
              fontWeight: 700, 
              color: period.factorHours > 0 ? 'var(--accent-green)' : period.factorHours < 0 ? 'var(--accent-rose)' : 'var(--text-primary)'
            }}>
              {period.factorHours > 0 ? '+' : ''}{period.factorHours.toFixed(2)}h
            </div>
          </div>
        )) : (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: '20px 0' }}>No periods available.</p>
        )}
      </div>
    </ModalShell>
  );
}

export default OvertimeHistoryModal;
