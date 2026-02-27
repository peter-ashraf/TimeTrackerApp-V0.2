import { useState, useEffect } from 'react';

export const useOfflineQueue = () => {
  const [queuedRequests, setQueuedRequests] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  useEffect(() => {
    // Listen for messages from service worker
    const handleMessage = (event) => {
      if (event.data.type === 'SYNC_COMPLETE') {
        setIsSyncing(false);
        setLastSyncTime(new Date());
        // Refresh queued requests count
        getQueuedRequestsCount();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  const getQueuedRequestsCount = async () => {
    try {
      if ('serviceWorker' in navigator && 'indexedDB' in window) {
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open('offlineQueueDB', 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });

        if (db.objectStoreNames.contains('offline-requests')) {
          const transaction = db.transaction(['offline-requests'], 'readonly');
          const store = transaction.objectStore('offline-requests');
          const count = await new Promise((resolve, reject) => {
            const countRequest = store.count();
            countRequest.onsuccess = () => resolve(countRequest.result);
            countRequest.onerror = () => reject(countRequest.error);
          });
          setQueuedRequests(count);
        }
      }
    } catch (error) {
      
    }
  };

  const triggerSync = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if ('sync' in registration) {
        try {
          setIsSyncing(true);
          await registration.sync.register('sync-offline-requests');
        } catch (error) {
          
          setIsSyncing(false);
        }
      }
    }
  };

  const clearQueuedRequests = async () => {
    try {
      if ('indexedDB' in window) {
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open('offlineQueueDB', 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });

        if (db.objectStoreNames.contains('offline-requests')) {
          const transaction = db.transaction(['offline-requests'], 'readwrite');
          const store = transaction.objectStore('offline-requests');
          await new Promise((resolve, reject) => {
            const clearRequest = store.clear();
            clearRequest.onsuccess = () => resolve();
            clearRequest.onerror = () => reject(clearRequest.error);
          });
          setQueuedRequests(0);
        }
      }
    } catch (error) {
      
    }
  };

  useEffect(() => {
    getQueuedRequestsCount();
  }, []);

  return {
    queuedRequests,
    isSyncing,
    lastSyncTime,
    triggerSync,
    clearQueuedRequests,
    refreshQueue: getQueuedRequestsCount
  };
};
