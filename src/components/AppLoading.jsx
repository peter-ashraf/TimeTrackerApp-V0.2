import React from 'react';
import '../styles/app-loading.css';

const AppLoading = () => {
  return (
    <div className="app-loading">
      <div className="loading-container">
        <div className="loading-content">
          <div className="app-logo">
            <div className="logo-icon">🕐</div>
            <h1>TimeTracker</h1>
          </div>
          
          <div className="loading-animation">
            <div className="loading-spinner">
              <div className="spinner-ring"></div>
            </div>
            <div className="loading-text">
              <h2>Loading your workspace...</h2>
              <div className="loading-steps">
                <div className="loading-step active">
                  <span className="step-icon">🔐</span>
                  <span className="step-text">Authenticating user</span>
                </div>
                <div className="loading-step">
                  <span className="step-icon">📊</span>
                  <span className="step-text">Loading time entries</span>
                </div>
                <div className="loading-step">
                  <span className="step-icon">💰</span>
                  <span className="step-text">Calculating payroll data</span>
                </div>
                <div className="loading-step">
                  <span className="step-icon">🎯</span>
                  <span className="step-text">Preparing dashboard</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="loading-progress">
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
            <p className="progress-text">Initializing your time tracking experience...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppLoading;
