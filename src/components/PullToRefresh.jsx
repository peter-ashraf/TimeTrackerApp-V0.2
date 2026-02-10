import React from 'react';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

const PullToRefresh = ({ 
  children, 
  onRefresh, 
  threshold = 80,
  maxPull = 120,
  className = '',
  disabled = false
}) => {
  const {
    isPulling,
    pullDistance,
    isRefreshing,
    shouldRefresh,
    pullProgress,
    containerRef,
    handlers
  } = usePullToRefresh({
    onRefresh,
    threshold,
    maxPull
  });

  if (disabled) {
    return <div className={`pull-to-refresh-container ${className}`}>{children}</div>;
  }

  return (
    <div 
      className={`pull-to-refresh-container ${isPulling ? 'pulling' : ''} ${isRefreshing ? 'refreshing' : ''} ${className}`}
      ref={containerRef}
    >
      {/* Pull indicator with circle progress */}
      <div 
        className="pull-to-refresh-indicator"
        style={{
          transform: `translateY(${Math.min(pullDistance, threshold)}px) scale(${pullProgress})`,
          opacity: pullProgress
        }}
      >
        <div className="pull-to-refresh-icon">
          {isRefreshing ? (
            <div className="refresh-spinner">
              <svg width="40" height="40" viewBox="0 0 40 40">
                <circle
                  cx="20"
                  cy="20"
                  r="18"
                  fill="none"
                  stroke="rgba(59, 130, 246, 0.2)"
                  strokeWidth="3"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="18"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  strokeDashoffset={`${2 * Math.PI * 18 * 0.25}`}
                  className="spinner-circle"
                />
              </svg>
            </div>
          ) : (
            <div className="pull-progress-circle">
              <svg width="40" height="40" viewBox="0 0 40 40">
                {/* Background circle */}
                <circle
                  cx="20"
                  cy="20"
                  r="18"
                  fill="none"
                  stroke={shouldRefresh ? "rgba(34, 197, 94, 0.2)" : "rgba(59, 130, 246, 0.2)"}
                  strokeWidth="3"
                />
                {/* Progress circle */}
                <circle
                  cx="20"
                  cy="20"
                  r="18"
                  fill="none"
                  stroke={shouldRefresh ? "#22c55e" : "#3b82f6"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  strokeDashoffset={`${2 * Math.PI * 18 * (1 - pullProgress)}`}
                  className="progress-circle"
                  style={{
                    transform: `rotate(-90deg)`,
                    transformOrigin: 'center',
                    transition: 'stroke-dashoffset 0.2s ease-out'
                  }}
                />
                {/* Center dot */}
                <circle
                  cx="20"
                  cy="20"
                  r="2"
                  fill={shouldRefresh ? "#22c55e" : "#3b82f6"}
                  className="center-dot"
                />
              </svg>
            </div>
          )}
        </div>
        <div className="pull-to-refresh-text">
          {isRefreshing ? 'Refreshing...' : shouldRefresh ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      </div>

      {/* Content */}
      <div 
        className="pull-to-refresh-content"
        style={{
          transform: isPulling ? `translateY(${Math.min(pullDistance, threshold)}px)` : 'translateY(0)',
          transition: isPulling ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }}
      >
        {children}
      </div>

      {/* Loading overlay during refresh */}
      {isRefreshing && (
        <div className="pull-to-refresh-overlay">
          <div className="refresh-loading">
            <div className="loading-spinner">
              <div className="spinner"></div>
            </div>
            <div className="loading-text">Updating data...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PullToRefresh;
