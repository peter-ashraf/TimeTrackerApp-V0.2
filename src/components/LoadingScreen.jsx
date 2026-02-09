import React from 'react';
import '../styles/loading-screen.css';

const LoadingScreen = () => {
  return (
    <div className="loading-screen">
      <div className="loading-container">
        <div className="loading-icon">
          <div className="clock-loader">
            <div className="clock-hand hour-hand"></div>
            <div className="clock-hand minute-hand"></div>
            <div className="clock-center"></div>
          </div>
        </div>
        <h1 className="loading-title">TimeTracker</h1>
        <p className="loading-subtitle">Loading your timesheet...</p>
        <div className="loading-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
