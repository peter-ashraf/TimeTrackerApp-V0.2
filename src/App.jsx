import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTimeTracker } from './context/TimeTrackerContext';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Timesheet from './components/Timesheet';
import Settings from './components/Settings';
import LoginScreen from './components/LoginScreen';
import AutoSaveIndicator from './components/AutoSaveIndicator';
import RefreshIndicator from './components/RefreshIndicator';
import ConfirmModal from './components/ConfirmModal';
import PullToRefresh from './components/PullToRefresh';
import './styles/pull-to-refresh.css';
import './styles/refresh-indicator.css';
import './styles/app-transitions.css';


function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const { lastSaved, lastRefreshed, entries, theme, setEntries, setLastRefreshed, setRefreshing } = useTimeTracker();
  const { isAuthenticated, isLoading, currentUser, logout, getUserData, saveUserData } = useAuth();
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const containerRef = useRef(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const views = ['dashboard', 'timesheet', 'settings'];

  const [showTest, setShowTest] = useState(false);

  // ✅ MOVE ALL CALLBACKS HERE - BEFORE ANY CONDITIONAL RETURNS
  const isMobile = useCallback(() => window.innerWidth <= 768, []);

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
    
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    setSwipeDirection(null);
    setSwipeOffset(0);
  }, [isMobile]);

  const handleTouchMove = useCallback((e) => {
    if (!isMobile()) return;
    if (!e.touches || e.touches.length === 0) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - startXRef.current;
    const deltaY = currentY - startYRef.current;

    if (swipeDirection === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      const target = e.target.closest('.data-table, .table-container, table, [data-no-swipe], .modal-content, input, textarea, select, button, [contenteditable="true"]');
      
      if (target && Math.abs(deltaX) > Math.abs(deltaY)) {
        console.log('🚫 Horizontal swipe inside table - blocking screen swipe');
        setSwipeDirection('blocked');
        return;
      }
      
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        setSwipeDirection('horizontal');
        setIsSwiping(true);
      } else {
        setSwipeDirection('vertical');
      }
    }

    if (swipeDirection === 'horizontal') {
      const clampedOffset = Math.max(-120, Math.min(120, deltaX));
      setSwipeOffset(clampedOffset);
    }
  }, [swipeDirection, isMobile]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile()) return;
    
    if (swipeDirection === 'blocked' || swipeDirection === 'vertical') {
      setIsSwiping(false);
      setSwipeOffset(0);
      setSwipeDirection(null);
      return;
    }

    if (!isSwiping || swipeDirection !== 'horizontal') {
      setIsSwiping(false);
      setSwipeOffset(0);
      setSwipeDirection(null);
      return;
    }

    const threshold = 70;
    if (swipeOffset > threshold) {
      handleViewChange(getNextView('right'));
    } else if (swipeOffset < -threshold) {
      handleViewChange(getNextView('left'));
    }
    
    setIsSwiping(false);
    setSwipeOffset(0);
    setSwipeDirection(null);
  }, [isSwiping, swipeOffset, getNextView, swipeDirection, isMobile]);

  // Refresh data function for pull-to-refresh
  const refreshData = useCallback(async () => {
    if (!currentUser || !isAuthenticated) return;
    
    try {
      // Set refresh flag to prevent save updates
      setRefreshing(true);
      
      // Reload user data from storage
      const loadedEmployee = {
        name: getUserData('fullName') || '',
        salary: parseFloat(getUserData('salary')) || 0
      };
      
      const loadedLeaveSettings = {
        annualVacation: parseFloat(getUserData('annualVacation')) || 10,
        sickDays: parseFloat(getUserData('sickDays')) || 7
      };
      
      const loadedEntries = getUserData('timeEntries') || [];
      const loadedPeriods = getUserData('payPeriods') || [{
        id: 'period-default',
        label: '23 Jan - 20 Feb 2026',
        start: '2026-01-23',
        end: '2026-02-20'
      }];
      
      const loadedCurrentPeriodId = getUserData('currentPeriodId') || (loadedPeriods[0]?.id || 'period-default');
      
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
  }, [currentUser, isAuthenticated, getUserData, setEntries, setLastRefreshed, setRefreshing]);

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
    const handleResize = () => {
      setIsSwiping(false);
      setSwipeOffset(0);
      setSwipeDirection(null);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  return (
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
        >
          <Header 
            currentView={currentView} 
            setCurrentView={setCurrentView} 
            isHeaderCollapsed={isHeaderCollapsed} 
          />
          <div
            className="main-content"
            data-scrollable
            style={{
              transform: isSwiping && isMobile() && swipeDirection === 'horizontal' 
                ? `translateX(${swipeOffset}px)` 
                : 'none',
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
  );
}

export default App;
