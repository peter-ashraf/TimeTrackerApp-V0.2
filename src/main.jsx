import '@fortawesome/fontawesome-free/css/all.min.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { useTimeTracker, TimeTrackerProvider } from './context/TimeTrackerContext';
import { TimeEntryProvider } from './context/TimeEntryContext';
import { UserPreferencesProvider } from './context/UserPreferencesContext';
import { PayPeriodProvider } from './context/PayPeriodContext';
import { SupabaseAuthProvider } from './context/SupabaseAuthContext';
import LoadingScreen from './components/LoadingScreen.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './styles/loading-screen.css';

const notifyAppUpdateAvailable = (registration) => {
  window.dispatchEvent(
    new CustomEvent('app-update-available', {
      detail: { registration },
    }),
  );
};

// Register Service Worker for offline support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/TimeTrackerApp-V0.2/sw.js', {
      scope: '/TimeTrackerApp-V0.2/'
    })
      .then(registration => {
        console.log('Service Worker registered successfully:', registration);

        if (registration.waiting && navigator.serviceWorker.controller) {
          notifyAppUpdateAvailable(registration);
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              notifyAppUpdateAvailable(registration);
            }
          });
        });
      })
      .catch(registrationError => {
        console.error('Service Worker registration failed:', registrationError);
      });
  });
}

// App loading state
const AppLoader = () => {
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // Load immediately after critical resources
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <HashRouter>
        <SupabaseAuthProvider>
          <TimeEntryProvider>
            <UserPreferencesProvider>
              <PayPeriodProvider>
                <TimeTrackerProvider>
                  <App />
                </TimeTrackerProvider>
              </PayPeriodProvider>
            </UserPreferencesProvider>
          </TimeEntryProvider>
        </SupabaseAuthProvider>
      </HashRouter>
    </ErrorBoundary>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppLoader />
  </React.StrictMode>,
);
