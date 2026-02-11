import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTimeTracker } from './context/TimeTrackerContext';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Timesheet from './components/Timesheet';
import Settings from './components/Settings';
import LoginScreen from './components/LoginScreen';
import AppLoading from './components/AppLoading';
import AutoSaveIndicator from './components/AutoSaveIndicator';
import RefreshIndicator from './components/RefreshIndicator';
import ConfirmModal from './components/ConfirmModal';
import PullToRefresh from './components/PullToRefresh';
import { loadFromStorage } from './utils/storage';
import './styles/pull-to-refresh.css';
import './styles/refresh-indicator.css';
import './styles/app-transitions.css';
import './styles/fixed-header.css';


function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isHidingScrollTop, setIsHidingScrollTop] = useState(false);
  const swipeTimeoutRef = useRef(null);
  const { lastSaved, lastRefreshed, entries, theme, setEntries, setLastRefreshed, setRefreshing } = useTimeTracker();
  const { currentUser, isAuthenticated, isAppLoading } = useAuth();
  const [refreshing, setRefreshingState] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const containerRef = useRef(null);

  // Apply fixed header styles directly to document
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      #header {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 9999 !important;
        background: var(--color-surface) !important;
        border-bottom: 1px solid var(--color-border) !important;
        width: 100% !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Scroll to top button functionality
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      
      if (scrollY > 90) {
        if (!showScrollTop && !isHidingScrollTop) {
          setShowScrollTop(true);
          setIsHidingScrollTop(false);
        }
      } else {
        if (showScrollTop && !isHidingScrollTop) {
          setIsHidingScrollTop(true);
          setTimeout(() => {
            setShowScrollTop(false);
            setIsHidingScrollTop(false);
          }, 300); // Match fade-out duration
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showScrollTop, isHidingScrollTop]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const views = ['dashboard', 'timesheet', 'settings'];

  const [showTest, setShowTest] = useState(false);

  // ✅ MOVE ALL CALLBACKS HERE - BEFORE ANY CONDITIONAL RETURNS
  const isMobile = useCallback(() => {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  }, []);

  const handleViewChange = useCallback((newView) => {
    if (newView === currentView || isTransitioning) return;
    
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentView(newView);
      setTimeout(() => {
        setIsTransitioning(false);
      }, 100);
    }, 50);
  }, [currentView, isTransitioning]);

  const getNextView = useCallback((direction) => {
    const currentIndex = views.indexOf(currentView);
    if (direction === 'left') {
      return views[(currentIndex + 1) % views.length];
    }
    return views[(currentIndex - 1 + views.length) % views.length];
  }, [currentView]);

  const handleNavClick = useCallback((view, event) => {
    handleViewChange(view);
    if (event && event.currentTarget) {
      event.currentTarget.blur();
    }
  }, [handleViewChange]);

  const handleTouchStart = useCallback((e) => {
    if (!isMobile()) return;
    if (!e.touches || e.touches.length === 0) return;
    
    // Clear any existing timeout
    if (swipeTimeoutRef.current) {
      clearTimeout(swipeTimeoutRef.current);
    }
    
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    setSwipeDirection(null);
    setSwipeOffset(0);
    setIsSwiping(false); // Reset swiping state
  }, [isMobile]);

  const handleTouchMove = useCallback((e) => {
    if (!isMobile()) return;
    if (!e.touches || e.touches.length === 0) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - startXRef.current;
    const deltaY = currentY - startYRef.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const swipeThreshold = 15;

    if (swipeDirection === null) {
      if (absDeltaX > swipeThreshold || absDeltaY > swipeThreshold) {
        const target = e.target.closest('.data-table, .table-container, table, [data-no-swipe], .modal-content, input, textarea, select, button, [contenteditable="true"], .form-group, .entry-form');
        
        if (target && absDeltaX > absDeltaY) {
          console.log('🚫 Horizontal swipe inside interactive element - blocking screen swipe');
          setSwipeDirection('blocked');
          return;
        }
        
        if (absDeltaX > absDeltaY && absDeltaX > swipeThreshold) {
          setSwipeDirection('horizontal');
          setIsSwiping(true);
          // Don't preventDefault - let it scroll but track the swipe
        } else if (absDeltaY > swipeThreshold) {
          setSwipeDirection('vertical');
        }
      }
    }

    if (swipeDirection === 'horizontal') {
      // Don't preventDefault - just track the swipe
      const clampedOffset = Math.max(-120, Math.min(120, deltaX));
      setSwipeOffset(clampedOffset);
      console.log(`Swiping: offset=${clampedOffset}`);
    }
  }, [swipeDirection, isMobile]);

  const handleTouchEnd = useEffect(() => {
    const handleResize = () => {
      console.log('Resize - Resetting swipe state');
      
      // IMPORTANT: Don't reset authentication during resize
      // Only reset UI-related state, not authentication state
      setIsSwiping(false);
      setSwipeOffset(0);
      setSwipeDirection(null);
      
      // Clear any existing timeout
      if (swipeTimeoutRef.current) {
        clearTimeout(swipeTimeoutRef.current);
        swipeTimeoutRef.current = null;
      }
    }
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      // Clear timeout on cleanup
      if (swipeTimeoutRef.current) {
        clearTimeout(swipeTimeoutRef.current);
      }
    };
  }, []);

  // Refresh data function for pull-to-refresh
  const refreshData = useCallback(async () => {
    if (!currentUser || !isAuthenticated) return;
    
    try {
      // Set refresh flag to prevent save updates
      setRefreshing(true);
      
      // Reload user data from storage
      const loadedEmployee = {
        name: loadFromStorage('fullName') || '',
        salary: parseFloat(loadFromStorage('salary')) || 0
      };
      
      const loadedLeaveSettings = {
        annualVacation: parseFloat(loadFromStorage('annualVacation')) || 10,
        sickDays: parseFloat(loadFromStorage('sickDays')) || 7
      };
      
      const loadedEntries = loadFromStorage('timeEntries') || [];
      const loadedPeriods = loadFromStorage('payPeriods') || [{
        id: 'period-default',
        label: '23 Jan - 20 Feb 2026',
        start: '2026-01-23',
        end: '2026-02-20'
      }];
      
      const loadedCurrentPeriodId = loadFromStorage('currentPeriodId') || (loadedPeriods[0]?.id || 'period-default');
      
      // Update context with fresh data
      setEntries(loadedEntries);
      
      // Set refresh timestamp for feedback
      setLastRefreshed(new Date().toISOString());
      
      console.log('✅ Data refreshed successfully for user:', currentUser.username);
      
      return Promise.resolve();
    } catch (error) {
      console.error('❌ Error refreshing data:', error);
      throw error;
    } finally {
      // Clear refresh flag
      setRefreshing(false);
    }
  }, [currentUser, isAuthenticated, loadFromStorage, setEntries, setLastRefreshed, setRefreshing]);

  // ✅ ALL EFFECTS HERE
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    
    const shouldNavigateToExport = localStorage.getItem('navigateToExport');
    if (shouldNavigateToExport === 'true') {
      localStorage.removeItem('navigateToExport');
      setCurrentView('settings');
      setTimeout(() => {
        const exportBtn = document.querySelector('[data-export-btn]');
        if (exportBtn) exportBtn.click();
      }, 100);
    }
  }, [theme, setCurrentView]);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          if (currentScrollY > lastScrollY && currentScrollY > 10) {
            setIsHeaderCollapsed(true);
          } else if (currentScrollY <= 30) {
            setIsHeaderCollapsed(false);
          }

          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const today = new Date().toISOString().split('T')[0];
      const todayEntry = entries.find(e => e.date === today);
      
      if (todayEntry && todayEntry.intervals && todayEntry.intervals.length > 0) {
        const lastInterval = todayEntry.intervals[todayEntry.intervals.length - 1];
        
        if (lastInterval.in && !lastInterval.out) {
          e.preventDefault();
          e.returnValue = '';
          return '';
        }
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [entries]);

  // ✅ NOW CONDITIONAL RENDERING IS SAFE - ALL HOOKS ARE ABOVE
  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (isAppLoading) {
    return <AppLoading />;
  }

  return (
    <>
      <PullToRefresh 
        onRefresh={refreshData}
        threshold={80}
        maxPull={120}
        className="app-pull-to-refresh"
      >
        <div
          className={`app ${isSwiping ? 'swiping' : ''}`}
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Header 
            currentView={currentView} 
            setCurrentView={setCurrentView} 
            isHeaderCollapsed={isHeaderCollapsed}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 1000,
              background: 'var(--color-surface)',
              borderBottom: '1px solid var(--color-border)'
            }}
          />
          <div
            className="main-content"
            data-scrollable
            style={{
              paddingTop: '140px',
              flex: 1,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <div className={`view-container dashboard-container ${currentView === 'dashboard' ? 'active' : ''}`} data-scrollable>
              <Dashboard />
            </div>
            <div className={`view-container timesheet-container ${currentView === 'timesheet' ? 'active' : ''}`} data-scrollable>
              <Timesheet />
            </div>
            <div className={`view-container settings-container ${currentView === 'settings' ? 'active' : ''}`} data-scrollable>
              <Settings />
            </div>

            <AutoSaveIndicator lastSaved={lastSaved} />
            <RefreshIndicator lastRefreshed={lastRefreshed} />
          </div>
        </div>
      </PullToRefresh>
      
      {/* Scroll to Top Button - Completely outside all containers */}
      {(showScrollTop || isHidingScrollTop) && (
        <button
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.3s ease, opacity 0.3s ease',
            zIndex: 1000,
            opacity: isHidingScrollTop ? 0 : 0.5,
            transform: isHidingScrollTop ? 'translateY(20px)' : 'translateY(0)',
            animation: !isHidingScrollTop ? 'fadeIn 0.3s ease-in' : 'none',
            pointerEvents: isHidingScrollTop ? 'none' : 'auto'
          }}
          onMouseEnter={(e) => {
            if (!isHidingScrollTop) {
              e.target.style.transform = 'scale(1.1)';
              e.target.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)';
              e.target.style.opacity = '0.8';
            }
          }}
          onMouseLeave={(e) => {
            if (!isHidingScrollTop) {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
              e.target.style.opacity = '0.5';
            }
          }}
          aria-label="Scroll to top"
        >
          ↑
        </button>
      )}
      
      {/* Add fade-in and fade-out animation styles */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 0.5;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

export default App;
