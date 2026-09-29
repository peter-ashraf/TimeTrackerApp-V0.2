import React from 'react';
import '../styles/dashboard-skeleton.css';

function DashboardSkeleton() {
  return (
    <main className="bento-main">
      <div className="bento-header-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="skeleton-shimmer" style={{ width: '250px', height: '42px', borderRadius: '4px' }}></div>
        <div className="skeleton-shimmer" style={{ width: '150px', height: '16px', borderRadius: '4px' }}></div>
      </div>

      <div className="bento-grid">
        {/* Massive Hero Check-In Tile */}
        <div className="bento-tile tile-hero col-span-4 row-span-2 skeleton-card">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="skeleton-shimmer" style={{ width: '64px', height: '64px', borderRadius: '50%', marginBottom: '16px' }}></div>
            <div className="skeleton-shimmer" style={{ width: '120px', height: '24px', borderRadius: '4px' }}></div>
          </div>
        </div>

        {/* Overtime Tile */}
        <div className="bento-tile col-span-2 row-span-1 mobile-square skeleton-card">
          <div className="mobile-center-content">
            <div className="bento-label skeleton-shimmer" style={{ width: '60px', height: '12px', borderRadius: '4px' }}></div>
            <div className="bento-value skeleton-shimmer" style={{ width: '80px', height: '32px', borderRadius: '4px', marginTop: '8px' }}></div>
          </div>
        </div>

        {/* Salary Tile */}
        <div className="bento-tile col-span-2 row-span-1 mobile-square skeleton-card">
          <div className="mobile-center-content">
            <div className="bento-label skeleton-shimmer" style={{ width: '70px', height: '12px', borderRadius: '4px' }}></div>
            <div className="bento-value skeleton-shimmer" style={{ width: '60px', height: '32px', borderRadius: '4px', marginTop: '8px' }}></div>
          </div>
        </div>

        {/* Leave Balances */}
        <div className="bento-tile col-span-3 flex-row-between mobile-square skeleton-card">
          <div className="mobile-center-content">
            <div className="bento-label skeleton-shimmer" style={{ width: '60px', height: '12px', borderRadius: '4px' }}></div>
            <div className="bento-value skeleton-shimmer" style={{ width: '40px', height: '32px', borderRadius: '4px', marginTop: '8px' }}></div>
          </div>
        </div>
        
        <div className="bento-tile col-span-3 flex-row-between mobile-square skeleton-card">
          <div className="mobile-center-content">
            <div className="bento-label skeleton-shimmer" style={{ width: '50px', height: '12px', borderRadius: '4px' }}></div>
            <div className="bento-value skeleton-shimmer" style={{ width: '40px', height: '32px', borderRadius: '4px', marginTop: '8px' }}></div>
          </div>
        </div>

        {/* Action Row */}
        <div className="bento-tile tile-action col-span-2 skeleton-card">
          <div className="skeleton-shimmer" style={{ width: '28px', height: '28px', borderRadius: '50%' }}></div>
          <div className="skeleton-shimmer" style={{ width: '60px', height: '14px', borderRadius: '4px', marginTop: '8px' }}></div>
        </div>
        <div className="bento-tile tile-action col-span-2 skeleton-card">
          <div className="skeleton-shimmer" style={{ width: '28px', height: '28px', borderRadius: '50%' }}></div>
          <div className="skeleton-shimmer" style={{ width: '70px', height: '14px', borderRadius: '4px', marginTop: '8px' }}></div>
        </div>
        <div className="bento-tile tile-action col-span-2 skeleton-card">
          <div className="skeleton-shimmer" style={{ width: '28px', height: '28px', borderRadius: '50%' }}></div>
          <div className="skeleton-shimmer" style={{ width: '50px', height: '14px', borderRadius: '4px', marginTop: '8px' }}></div>
        </div>

        {/* Check Out Tile */}
        <div className="bento-tile tile-danger col-span-4 skeleton-card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <div className="skeleton-shimmer" style={{ width: '28px', height: '28px', borderRadius: '50%' }}></div>
          <div className="skeleton-shimmer" style={{ width: '120px', height: '20px', borderRadius: '4px' }}></div>
        </div>

        {/* Insights Tile */}
        <div className="bento-tile tile-action col-span-2 skeleton-card">
          <div className="skeleton-shimmer" style={{ width: '28px', height: '28px', borderRadius: '50%' }}></div>
          <div className="skeleton-shimmer" style={{ width: '60px', height: '14px', borderRadius: '4px', marginTop: '8px' }}></div>
        </div>

        {/* Bottom Actions */}
        <div className="bento-tile tile-action col-span-3 flex-row-between skeleton-card">
          <div className="skeleton-shimmer" style={{ width: '80px', height: '18px', borderRadius: '4px' }}></div>
          <div className="skeleton-shimmer" style={{ width: '24px', height: '24px', borderRadius: '50%' }}></div>
        </div>
        <div className="bento-tile tile-action col-span-3 flex-row-between skeleton-card">
          <div className="skeleton-shimmer" style={{ width: '90px', height: '18px', borderRadius: '4px' }}></div>
          <div className="skeleton-shimmer" style={{ width: '24px', height: '24px', borderRadius: '50%' }}></div>
        </div>
      </div>
    </main>
  );
}

export default DashboardSkeleton;
