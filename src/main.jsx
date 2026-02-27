// Force cache bust to ensure updated code loads


import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { TimeTrackerProvider } from './context/TimeTrackerContext';
import { SupabaseAuthProvider } from './context/SupabaseAuthContext';
import LoadingScreen from './components/LoadingScreen.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './styles/loading-screen.css';

// Register Service Worker for offline support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/TimeTrackerApp-V0.2/sw.js', {
      scope: '/TimeTrackerApp-V0.2/'
    })
      .then(registration => {
        
      })
      .catch(registrationError => {
        
      });
  });
}

// App loading state
const AppLoader = () => {
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // Simulate loading time or wait for app to be ready
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000); // 2 seconds loading time

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <SupabaseAuthProvider>
          <TimeTrackerProvider>
            <App />
          </TimeTrackerProvider>
        </SupabaseAuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppLoader />
  </React.StrictMode>,
);
