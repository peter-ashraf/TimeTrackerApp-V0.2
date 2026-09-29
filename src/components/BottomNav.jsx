import React from 'react';
import './BottomNav.css';

function BottomNav({ currentView, setCurrentView }) {
  const handleNavClick = (view, event) => {
    setCurrentView(view);
    if (event && event.currentTarget) {
      event.currentTarget.blur();
    }
  };

  return (
    <nav className="bento-bottom-nav">
      <div className="bento-nav-container">
        <button
          className={`bento-nav-btn ${currentView === "dashboard" ? "active" : ""}`}
          onClick={(event) => handleNavClick("dashboard", event)}
          aria-label="Dashboard"
        >
          <i className="fa-solid fa-house"></i>
          <span className="bento-nav-label">Dashboard</span>
        </button>
        <button
          className={`bento-nav-btn ${currentView === "timesheet" ? "active" : ""}`}
          onClick={(event) => handleNavClick("timesheet", event)}
          aria-label="Timesheet"
        >
          <i className="fa-solid fa-table"></i>
          <span className="bento-nav-label">Timesheet</span>
        </button>
        <button
          className={`bento-nav-btn ${currentView === "settings" ? "active" : ""}`}
          onClick={(event) => handleNavClick("settings", event)}
          aria-label="Settings"
        >
          <i className="fa-solid fa-gear"></i>
          <span className="bento-nav-label">Settings</span>
        </button>
      </div>
    </nav>
  );
}

export default BottomNav;
