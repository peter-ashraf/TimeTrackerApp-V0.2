import { useState, useEffect, useRef, useCallback } from 'react';

export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  maxPull = 120,
  debounceMs = 500
} = {}) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shouldRefresh, setShouldRefresh] = useState(false);
  
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const isPullingRef = useRef(false);
  const containerRef = useRef(null);
  const lastRefreshRef = useRef(0);
  const handlersRef = useRef(null);
  
  // Check if element is scrollable and at top
  const isAtTop = useCallback((element) => {
    if (!element) return false;
    return element.scrollTop === 0;
  }, []);
  
  // Trigger haptic feedback if available and user has interacted
  const triggerHaptic = useCallback((type = 'light') => {
    // Only vibrate if user has previously interacted with the page
    if ('vibrate' in navigator && document.hasStoredUserInteraction) {
      try {
        switch (type) {
          case 'light':
            navigator.vibrate(10);
            break;
          case 'medium':
            navigator.vibrate(25);
            break;
          case 'heavy':
            navigator.vibrate(50);
            break;
          case 'success':
            navigator.vibrate([10, 50, 10]);
            break;
          default:
            navigator.vibrate(10);
        }
      } catch (error) {
        // Silently fail if vibration is blocked
      }
    }
  }, []);
  
  // Handle touch start
  const handleTouchStart = useCallback((e) => {
    if (isRefreshing) return;
    
    const touch = e.touches[0];
    startYRef.current = touch.clientY;
    currentYRef.current = touch.clientY;
    setShouldRefresh(false);
    
    // Only enable pull-to-refresh if we're at the top of a scrollable container
    const target = e.target;
    const scrollableParent = target.closest('.main-content, .view-container, [data-scrollable]');
    
    if (scrollableParent && isAtTop(scrollableParent)) {
      isPullingRef.current = true;
    }
  }, [isRefreshing, isAtTop]);
  
  // Handle touch move
  const handleTouchMove = useCallback((e) => {
    if (!isPullingRef.current || isRefreshing) return;
    
    const touch = e.touches[0];
    currentYRef.current = touch.clientY;
    const deltaY = currentYRef.current - startYRef.current;
    
    // Only allow pulling down (positive deltaY)
    if (deltaY <= 0) return;
    
    // Check if we're still at the top of the scrollable container
    const target = e.target;
    const scrollableParent = target.closest('.main-content, .view-container, [data-scrollable]');
    
    if (!scrollableParent || !isAtTop(scrollableParent)) {
      isPullingRef.current = false;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }
    
    // Calculate pull distance with resistance
    const resistance = 0.5;
    const pullDistance = Math.min(deltaY * resistance, maxPull);
    
    setPullDistance(pullDistance);
    setIsPulling(true);
    
    // Prevent default scrolling when pulling - only if event is cancelable and we have significant pull
    if (pullDistance > 10 && e.cancelable) {
      e.preventDefault();
    }
    
    // Haptic feedback at threshold
    if (pullDistance >= threshold && !shouldRefresh) {
      triggerHaptic('medium');
      setShouldRefresh(true);
    } else if (pullDistance < threshold && shouldRefresh) {
      setShouldRefresh(false);
    }
  }, [isRefreshing, isAtTop, maxPull, threshold, shouldRefresh, triggerHaptic]);
  
  // Handle touch end
  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    
    isPullingRef.current = false;
    
    // Debounce refresh calls
    const now = Date.now();
    if (now - lastRefreshRef.current < debounceMs) {
      setPullDistance(0);
      setIsPulling(false);
      setShouldRefresh(false);
      return;
    }
    
    if (shouldRefresh && onRefresh) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      
      try {
        await onRefresh();
        triggerHaptic('success');
        lastRefreshRef.current = Date.now();
      } catch (error) {
        
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        setIsPulling(false);
        setShouldRefresh(false);
      }
    } else {
      // Animate back to position
      setPullDistance(0);
      setIsPulling(false);
      setShouldRefresh(false);
    }
  }, [shouldRefresh, onRefresh, threshold, debounceMs, triggerHaptic]);
  
  // Store handlers in ref to avoid recreating event listeners
  handlersRef.current = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
  
  // Setup native event listeners to avoid React's passive event issue
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const options = { passive: false, capture: true };
    
    const handleStart = (e) => handlersRef.current?.onTouchStart(e);
    const handleMove = (e) => handlersRef.current?.onTouchMove(e);
    const handleEnd = (e) => handlersRef.current?.onTouchEnd(e);
    
    container.addEventListener('touchstart', handleStart, options);
    container.addEventListener('touchmove', handleMove, options);
    container.addEventListener('touchend', handleEnd, options);
    
    return () => {
      container.removeEventListener('touchstart', handleStart, options);
      container.removeEventListener('touchmove', handleMove, options);
      container.removeEventListener('touchend', handleEnd, options);
    };
  }, []);
  
  // Reset state on window resize
  useEffect(() => {
    const handleResize = () => {
      setPullDistance(0);
      setIsPulling(false);
      setShouldRefresh(false);
      isPullingRef.current = false;
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isPullingRef.current = false;
    };
  }, []);
  
  return {
    isPulling,
    pullDistance,
    isRefreshing,
    shouldRefresh,
    pullProgress: Math.min(pullDistance / threshold, 1),
    containerRef,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    }
  };
};
