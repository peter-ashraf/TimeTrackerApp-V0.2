import { useState, useEffect } from 'react';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState('unknown');

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    const updateConnectionType = () => {
      if (navigator.connection) {
        setConnectionType(navigator.connection.effectiveType || 'unknown');
      }
    };

    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Listen for connection changes if available
    if (navigator.connection) {
      navigator.connection.addEventListener('change', updateConnectionType);
      updateConnectionType(); // Set initial connection type
    }

    // Initial status
    updateOnlineStatus();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      
      if (navigator.connection) {
        navigator.connection.removeEventListener('change', updateConnectionType);
      }
    };
  }, []);

  return {
    isOnline,
    connectionType,
    isSlowConnection: connectionType === 'slow-2g' || connectionType === '2g'
  };
};
