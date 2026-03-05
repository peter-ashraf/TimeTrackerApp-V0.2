import React from 'react';
import '../styles/dashboard-skeleton.css';

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton-container">
      <h1>Dashboard</h1>

      {/* Employee Info Card Skeleton */}
      <div className="skeleton-card employee-card-skeleton">
        <div className="skeleton-header">
          <div className="skeleton-avatar skeleton-shimmer"></div>
          <div className="skeleton-title skeleton-shimmer"></div>
        </div>
        <div className="skeleton-info">
          <div className="skeleton-line skeleton-shimmer"></div>
          <div className="skeleton-line skeleton-shimmer"></div>
          <div className="skeleton-line skeleton-shimmer"></div>
        </div>
      </div>

      {/* Manual Time Actions Skeleton */}
      <div className="manual-time-actions">
        <div className="skeleton-button skeleton-shimmer"></div>
        <div className="skeleton-button skeleton-shimmer"></div>
        <div className="skeleton-button skeleton-shimmer"></div>
      </div>

      {/* Quick Actions Skeleton */}
      <div className="quick-actions">
        <div className="skeleton-button primary skeleton-shimmer"></div>
        <div className="skeleton-button primary skeleton-shimmer"></div>
        <div className="skeleton-button secondary skeleton-shimmer"></div>
        <div className="skeleton-button outline skeleton-shimmer"></div>
      </div>

      {/* Vacation Cards Skeleton */}
      <div className="vacation-cards">
        {/* Vacation Card Skeleton */}
        <div className="skeleton-card vacation-card-skeleton">
          <div className="vacation-top-section">
            <div className="skeleton-stat skeleton-shimmer"></div>
            <div className="skeleton-stat skeleton-shimmer"></div>
            <div className="skeleton-stat skeleton-shimmer"></div>
          </div>
          <div className="vacation-bottom-section">
            <div className="skeleton-balance skeleton-shimmer"></div>
          </div>
        </div>

        {/* Sick Days Card Skeleton */}
        <div className="skeleton-card vacation-card-skeleton">
          <div className="vacation-top-section double-stat">
            <div className="skeleton-stat skeleton-shimmer"></div>
            <div className="skeleton-stat skeleton-shimmer"></div>
          </div>
          <div className="vacation-bottom-section">
            <div className="skeleton-balance skeleton-shimmer"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardSkeleton;
