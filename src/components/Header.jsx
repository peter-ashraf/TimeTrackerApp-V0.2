import React, { useState, Suspense } from "react";

import { useTimeTracker } from "../context/TimeTrackerContext-optimized";

import { useSupabaseAuth } from "../context/SupabaseAuthContext";

import OfflineIndicator from "./OfflineIndicator";

import LogoutModal from "./LogoutModal";

import SessionToast from "./SessionToast";

import '../styles/fixed-header.css';



// Lazy load modal components for better code splitting

const UserSettingsModal = React.lazy(() => import("./UserSettingsModal"));



function Header({ currentView, setCurrentView, isHeaderCollapsed, onRefresh }) {

  const { theme, setTheme } = useTimeTracker();

  const { currentUser, logout, showSessionWarning, setShowSessionWarning } = useSupabaseAuth();

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [showUserSettingsModal, setShowUserSettingsModal] = useState(false);

  const [userSettingsDefaultTab, setUserSettingsDefaultTab] = useState('username');

  const [isRefreshing, setIsRefreshing] = useState(false);



  const { employee } = useTimeTracker();



  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh();
      // Keep spinning for 2 seconds total even if refresh is fast
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setIsRefreshing(false);
    }
  };

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

    setShowLogoutModal(true);

  };



  const confirmLogout = () => {

    logout();

    setShowLogoutModal(false);

  };



  const cancelLogout = () => {

    setShowLogoutModal(false);

  };



  const handleUserSettings = (defaultTab = 'username') => {

    setUserSettingsDefaultTab(defaultTab);

    setShowUserSettingsModal(true);

  };



  const closeUserSettings = () => {

    setShowUserSettingsModal(false);

  };



  const handleToastClick = () => {

    

    setShowSessionWarning(false);

    handleUserSettings('session');

  };



  const handleToastClose = () => {

    setShowSessionWarning(false);

  };



  return (

    <>

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

                <button 

                  className="username-display clickable" 

                  onClick={handleUserSettings}

                  title="Click to change username or password"

                >

                  👤 {employee.name}

                </button>

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

        

        <LogoutModal

          isOpen={showLogoutModal}

          onClose={cancelLogout}

          onConfirm={confirmLogout}

        />

        <Suspense fallback={<div className="modal-loading-overlay">Loading...</div>}>

          <UserSettingsModal

            isOpen={showUserSettingsModal}

            onClose={closeUserSettings}

            defaultTab={userSettingsDefaultTab}

          />

        </Suspense>

        <SessionToast

          isVisible={showSessionWarning}

          message="You will be logged out in 5 minutes, click here to modify the session time"

          onClose={handleToastClose}

          onToastClick={handleToastClick}

        />

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

    </>

  );

}



export default Header;

