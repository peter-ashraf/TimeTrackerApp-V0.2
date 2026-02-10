import React from "react";
import { useTimeTracker } from "../context/TimeTrackerContext";
import { useAuth } from "../context/AuthContext";
import OfflineIndicator from "./OfflineIndicator";

function Header({ currentView, setCurrentView, isHeaderCollapsed }) {
  const { theme, setTheme } = useTimeTracker();
  const { currentUser, logout } = useAuth();

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  const handleNavClick = (view, event) => {
    setCurrentView(view);
    if (event && event.currentTarget) {
      event.currentTarget.blur();
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
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
          <OfflineIndicator />
          <button
            id="themeToggle"
            className="btn-theme"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            <i className={`fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"}`}></i>
          </button>
          {currentUser && (
            <div className="user-info">
              <span className="username-display">👤 {currentUser.username}</span>
              <button
                className="logout-btn"
                onClick={handleLogout}
                title="Logout"
              >
                🚪
              </button>
            </div>
          )}
        </div>
      </div>
      <nav className="tab-navigation">
        <button
          className={`tab-btn ${currentView === "dashboard" ? "active" : ""}`}
          onClick={(event) => handleNavClick("dashboard", event)}
        >
          <span className="tab-icon">📊</span>
          <span className="tab-label">Dashboard</span>
        </button>
        <button
          className={`tab-btn ${currentView === "timesheet" ? "active" : ""}`}
          onClick={(event) => handleNavClick("timesheet", event)}
        >
          <span className="tab-icon">📋</span>
          <span className="tab-label">Timesheet</span>
        </button>
        <button
          className={`tab-btn ${currentView === "settings" ? "active" : ""}`}
          onClick={(event) => handleNavClick("settings", event)}
        >
          <span className="tab-icon">⚙️</span>
          <span className="tab-label">Settings</span>
        </button>
      </nav>
    </header>
  );
}

export default Header;
