import React, { useState, Suspense } from "react";
import { useTimeTracker } from '../context/TimeTrackerContext';
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import OfflineIndicator from "./OfflineIndicator";
import LogoutModal from "./LogoutModal";
import SessionToast from "./SessionToast";
import './bento-header.css';

// Lazy load modal components for better code splitting
const UserSettingsModal = React.lazy(() => import("./UserSettingsModal"));

function Header({ currentView, setCurrentView, isHeaderCollapsed, onRefresh }) {
  const { theme, setTheme, activeTheme, employee } = useTimeTracker();
  const { currentUser, logout, showSessionWarning, setShowSessionWarning } = useSupabaseAuth();
  
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showUserSettingsModal, setShowUserSettingsModal] = useState(false);
  const [userSettingsDefaultTab, setUserSettingsDefaultTab] = useState('username');
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    let nextTheme;
    if (theme === 'light') nextTheme = 'dark';
    else if (theme === 'dark') nextTheme = 'system';
    else nextTheme = 'light';
    setTheme(nextTheme);
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
      <header className={`bento-header ${isHeaderCollapsed ? "collapsed" : ""}`}>
        <div className="bento-header-left">
          <div className="bento-logo">
            <i className="fa-regular fa-clock"></i>
            <span>TimeTracker</span>
          </div>
        </div>

        <div className="bento-header-right">
          <OfflineIndicator onRefresh={handleRefresh} isRefreshing={isRefreshing} />

          <button
            className="bento-theme-btn"
            onClick={toggleTheme}
            title="Toggle theme"
          >
            <i className={`fa-solid ${theme === 'system' ? 'fa-circle-half-stroke' : theme === 'dark' ? 'fa-moon' : 'fa-sun'}`}></i>
          </button>

          {currentUser && (
            <button
              className="bento-theme-btn"
              onClick={handleLogout}
              title="Logout"
            >
              <i className="fa-solid fa-arrow-right-from-bracket"></i>
            </button>
          )}

          {currentUser && (
            <button 
              className="bento-avatar-btn" 
              onClick={handleUserSettings}
              title="Settings & Profile"
            >
              <div className="avatar-circle">
                {employee?.name ? employee.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'PR'}
              </div>
            </button>
          )}
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
      </header>
    </>
  );
}

export default Header;
