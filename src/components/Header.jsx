import React from "react";
import { useTimeTracker } from "../context/TimeTrackerContext";

function Header({ currentView, setCurrentView, isHeaderCollapsed }) {
  const { theme, setTheme } = useTimeTracker();

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  const handleNavClick = (view) => {
    setCurrentView(view);
    if (event && event.currentTarget) {
      event.currentTarget.blur();
    }
  };

  return (
    <header id="header" className={isHeaderCollapsed ? "collapsed" : ""}>
      <div className="header-title-content">
        <div id="appTitle">
          <span id="appIcon">⏰</span>
          <h1 id="appName">TimeTracker</h1>
        </div>
        <div id="headerButtons">
          <button
            id="themeToggle"
            className="btn-theme"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            <i className={`fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"}`}></i>
          </button>
        </div>
      </div>
      <nav className="tab-navigation">
        <button
          className={`tab-btn ${currentView === "dashboard" ? "active" : ""}`}
          onClick={() => handleNavClick("dashboard")}
        >
          <span className="tab-icon">📊</span>
          <span className="tab-label">Dashboard</span>
        </button>
        <button
          className={`tab-btn ${currentView === "timesheet" ? "active" : ""}`}
          onClick={() => handleNavClick("timesheet")}
        >
          <span className="tab-icon">📋</span>
          <span className="tab-label">Timesheet</span>
        </button>
        <button
          className={`tab-btn ${currentView === "settings" ? "active" : ""}`}
          onClick={() => handleNavClick("settings")}
        >
          <span className="tab-icon">⚙️</span>
          <span className="tab-label">Settings</span>
        </button>
      </nav>
    </header>
  );
}

export default Header;
