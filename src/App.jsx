import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTimeTracker } from './context/TimeTrackerContext';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Timesheet from './components/Timesheet';
import Settings from './components/Settings';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  
  const { theme } = useTimeTracker();
  const containerRef = useRef(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const views = ['dashboard', 'timesheet', 'settings'];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const isMobile = () => window.innerWidth <= 768;

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
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isMobile()) return;
    if (!e.touches || e.touches.length === 0) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - startXRef.current;
    const deltaY = currentY - startYRef.current;

    // Detect direction on first significant move
    if (swipeDirection === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      // Check if touch is inside a table or scrollable container
      const target = e.target.closest('.data-table, .table-container, table, [data-no-swipe]');
      
      if (target && Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe inside table - block screen swipe
        console.log('🚫 Horizontal swipe inside table - blocking screen swipe');
        setSwipeDirection('blocked');
        return;
      }
      
      // Determine swipe direction
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        setSwipeDirection('horizontal');
        setIsSwiping(true);
      } else {
        setSwipeDirection('vertical');
      }
    }

    // Only apply screen swipe if direction is horizontal and not blocked
    if (swipeDirection === 'horizontal') {
      const clampedOffset = Math.max(-120, Math.min(120, deltaX));
      setSwipeOffset(clampedOffset);
    }
  }, [swipeDirection]);

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
  }, [isSwiping, swipeOffset, getNextView, swipeDirection]);

  useEffect(() => {
    const handleResize = () => {
      setIsSwiping(false);
      setSwipeOffset(0);
      setSwipeDirection(null);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // SCROLL DETECTION FOR HEADER COLLAPSE
  useEffect(() => {
  let lastScrollY = window.scrollY;
  let ticking = false;

  const handleScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;

        // 1. INSTANT COLLAPSE: 
        // If current position is greater than last (scrolling down) 
        // AND we are not at the very top (to avoid glitching at 0)
        if (currentScrollY > lastScrollY && currentScrollY > 10) {
          setIsHeaderCollapsed(true);
        } 
        
        // 2. DELAYED EXPANSION:
        // Only expand when the user actually reaches the top area
        else if (currentScrollY <= 30) {
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
      </div>
    </div>
  );
}

export default App;
