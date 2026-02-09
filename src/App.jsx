import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTimeTracker } from './context/TimeTrackerContext';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Timesheet from './components/Timesheet';
import Settings from './components/Settings';
import LoginScreen from './components/LoginScreen';
import AutoSaveIndicator from './components/AutoSaveIndicator';
import ConfirmModal from './components/ConfirmModal';


function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const { lastSaved, entries, theme } = useTimeTracker();
  const { isAuthenticated, isLoading, currentUser, logout } = useAuth();
  
  const containerRef = useRef(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const views = ['dashboard', 'timesheet', 'settings'];

  const [showTest, setShowTest] = useState(false);

  // ✅ MOVE ALL CALLBACKS HERE - BEFORE ANY CONDITIONAL RETURNS
  const isMobile = useCallback(() => window.innerWidth <= 768, []);

  const getNextView = useCallback((direction) => {
    const currentIndex = views.indexOf(currentView);
    if (direction === 'left') {
      return views[(currentIndex + 1) % views.length];
    }
    return views[(currentIndex - 1 + views.length) % views.length];
  }, [currentView]);

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
      setCurrentView(getNextView('right'));
    } else if (swipeOffset < -threshold) {
      setCurrentView(getNextView('left'));
    }
    
    setIsSwiping(false);
    setSwipeOffset(0);
    setSwipeDirection(null);
  }, [isSwiping, swipeOffset, getNextView, swipeDirection, isMobile]);

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
        style={{
          transform: isSwiping && isMobile() && swipeDirection === 'horizontal' 
            ? `translateX(${swipeOffset}px)` 
            : 'none',
        }}
      >
        <div className={`view-container dashboard-container ${currentView === 'dashboard' ? 'active' : ''}`}>
          <Dashboard />
        </div>
        <div className={`view-container timesheet-container ${currentView === 'timesheet' ? 'active' : ''}`}>
          <Timesheet />
        </div>
        <div className={`view-container settings-container ${currentView === 'settings' ? 'active' : ''}`}>
          <Settings />
        </div>

        <AutoSaveIndicator lastSaved={lastSaved} />
      </div>
    </div>
  );
}

export default App;
