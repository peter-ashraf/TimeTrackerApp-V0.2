import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { TimeTrackerProvider } from './context/TimeTrackerContext';



ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TimeTrackerProvider>
      <App />
    </TimeTrackerProvider>
  </React.StrictMode>,
);
