const CACHE_NAME = 'timetracker-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/css/styles.css',
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/context/TimeTrackerContext.jsx',
  '/src/hooks/useCalculations.js',
  '/src/hooks/useEntries.js',
  '/src/hooks/useLeaveSettings.js',
  '/src/hooks/usePeriods.js',
  '/src/components/Timesheet.jsx',
  '/src/components/ImportModal.jsx',
  '/src/components/ExportModal.jsx',
  '/src/components/AddEntryModal.jsx',
  '/src/components/EditEntryModal.jsx',
  '/src/components/AddBreakModal.jsx',
  '/src/components/ManualTimeModal.jsx',
  '/src/components/ModalShell.jsx',
  '/src/components/SettingsModal.jsx',
  '/src/components/LoadingScreen.jsx',
  '/src/styles/import-modal.css',
  '/src/styles/export-modal.css',
  '/src/styles/timesheet.css',
  '/src/styles/modal-shell.css',
  '/src/styles/settings-modal.css',
  '/src/styles/loading-screen.css',
  '/public/icons/adaptive-icon.png'
];

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch Event - Network first, then cache
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
      .catch(() => {
        // If both cache and network fail, return offline page for HTML requests
        if (event.request.destination === 'document') {
          return caches.match('/offline.html');
        }
      })
  );
});
