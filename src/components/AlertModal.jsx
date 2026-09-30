import React from 'react';
import ModalShell from './ModalShell';

const TYPE_CONFIG = {
  success: { icon: 'fa-circle-check', color: '#39ff14', bg: 'rgba(57,255,20,0.08)', border: 'rgba(57,255,20,0.2)' },
  warning: { icon: 'fa-triangle-exclamation', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  danger:  { icon: 'fa-circle-xmark', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
  error:   { icon: 'fa-circle-xmark', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
  info:    { icon: 'fa-circle-info', color: 'var(--accent-cyan)', bg: 'rgba(0,240,255,0.06)', border: 'rgba(0,240,255,0.15)' },
};

function AlertModal({
  isOpen,
  message,
  title = 'Alert',
  type = 'info',
  onClose,
  buttonText = 'OK'
}) {
  if (!isOpen) return null;

  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;

  return (
    <ModalShell onClose={onClose} closeOnOverlay={false} showCloseButton={false}>
      <div style={{ padding: '28px 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Icon badge */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: cfg.bg, border: `1px solid ${cfg.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, alignSelf: 'center',
        }}>
          <i className={`fa-solid ${cfg.icon}`} style={{ fontSize: '1.6rem', color: cfg.color }} />
        </div>

        {/* Text */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{message}</p>
        </div>

        {/* Button */}
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '14px',
            borderRadius: '16px', border: 'none', cursor: 'pointer',
            background: type === 'danger' || type === 'error' ? '#ef4444' : 'var(--accent-cyan)',
            color: type === 'danger' || type === 'error' ? '#fff' : '#000',
            fontWeight: 700, fontSize: '1rem',
            boxShadow: type === 'danger' || type === 'error'
              ? '0 4px 16px rgba(239,68,68,0.3)'
              : '0 4px 16px rgba(0,240,255,0.25)',
          }}
        >
          {buttonText}
        </button>
      </div>
    </ModalShell>
  );
}

export default AlertModal;
