import React, { useState, useMemo, useEffect } from 'react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { useUserPreferences } from '../context/UserPreferencesContext';
import ModalShell from './ModalShell';
import CustomSelect from './CustomSelect';
import '../styles/user-settings-modal.css';


function UserSettingsModal({ isOpen, onClose, defaultTab = 'username' }) {
  const { currentUser, updateProfile, updatePassword, sessionTimeout, setSessionTimeout, saveSessionSettings } = useSupabaseAuth();
  const { setConfirmModal } = useTimeTracker();
  const { theme, setTheme, activeTheme } = useUserPreferences();

  const [formData, setFormData] = useState({
    newUsername: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    sessionTimeout: sessionTimeout
  });

  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter tabs based on search query
  const tabs = [
    { id: 'username', icon: '👤', label: 'Username', keywords: ['username', 'name', 'profile', 'account'] },
    { id: 'password', icon: '🔒', label: 'Password', keywords: ['password', 'security', 'login', 'auth'] },
    { id: 'session', icon: '⏱️', label: 'Session', keywords: ['session', 'timeout', 'logout', 'auto'] },
    { id: 'appearance', icon: '✨', label: 'Appearance', keywords: ['appearance', 'theme', 'dark', 'light', 'color'] }
  ];

  const filteredTabs = useMemo(() => {
    if (!searchQuery.trim()) return tabs;
    
    const query = searchQuery.toLowerCase();
    return tabs.filter(tab => 
      tab.label.toLowerCase().includes(query) ||
      tab.keywords.some(keyword => keyword.includes(query))
    );
  }, [searchQuery, tabs]);

  // Auto-switch to first matching tab when searching
  useEffect(() => {
    if (searchQuery.trim() && filteredTabs.length > 0) {
      const firstMatch = filteredTabs[0];
      if (firstMatch.id !== activeTab) {
        setActiveTab(firstMatch.id);
      }
    }
  }, [searchQuery, filteredTabs, activeTab]);

  if (!isOpen) return null;

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    // Reset form data and errors when switching tabs
    setFormData({
      newUsername: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      sessionTimeout: sessionTimeout
    });
    setErrors({});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear errors for this field and any submit errors when user starts typing
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[name];
      delete newErrors.submit;
      return newErrors;
    });
  };

  const showConfirmationModal = (title, message, onConfirm, type = 'warning') => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      type,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      showCancel: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await onConfirm();
      },
      onCancel: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const showSuccessModal = (title, message) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      type: 'success',
      confirmText: 'Great!',
      showCancel: false,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        onClose();
      }
    });
  };

  const validateUsernameForm = () => {
    const newErrors = {};

    if (!formData.newUsername.trim()) {
      newErrors.newUsername = 'New username is required';
    } else if (formData.newUsername.length < 3) {
      newErrors.newUsername = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.newUsername)) {
      newErrors.newUsername = 'Username can only contain letters, numbers, and underscores';
    } else if (formData.newUsername === currentUser.username) {
      newErrors.newUsername = 'New username must be different from current username';
    }

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePasswordForm = () => {
    const newErrors = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    } else if (formData.newPassword === formData.currentPassword) {
      newErrors.newPassword = 'New password must be different from current password';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSessionForm = () => {
    const newErrors = {};

    const timeout = parseInt(formData.sessionTimeout);
    if (isNaN(timeout) || timeout < 0) {
      newErrors.sessionTimeout = 'Session timeout must be a positive number or 0';
    } else if (timeout > 480) { // Max 8 hours
      newErrors.sessionTimeout = 'Session timeout cannot exceed 480 minutes (8 hours)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSessionSubmit = async (e) => {
    e.preventDefault();

    if (!validateSessionForm()) return;

    const timeout = parseInt(formData.sessionTimeout);
    const timeoutText = timeout === 0 ? 'never expire' : `expire after ${timeout} minute${timeout !== 1 ? 's' : ''}`;

    showConfirmationModal(
      '⏱️ Confirm Session Settings',
      `Are you sure you want to set your session to ${timeoutText}?\n\n${timeout === 0
        ? 'You will stay logged in until you manually log out.'
        : 'You will be automatically logged out after the specified period of inactivity.'
      }`,
      async () => {
        setIsSubmitting(true);
        try {
          await saveSessionSettings(timeout);
          showSuccessModal(
            '✅ Session Settings Updated!',
            `Your session will now ${timeoutText}.\n\n${timeout === 0
              ? 'You will stay logged in until you manually log out.'
              : 'Make sure to save your work before leaving your desk.'
            }`
          );
        } catch (error) {
          setErrors({ submit: error.message });
        } finally {
          setIsSubmitting(false);
        }
      }
    );
  };

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();

    if (!validateUsernameForm()) return;

    showConfirmationModal(
      '🔄 Confirm Username Change',
      `Are you sure you want to change your username from "${currentUser.username}" to "${formData.newUsername}"?\n\nThis will update your profile information.`,
      async () => {
        setIsSubmitting(true);
        try {
          await updateProfile({ username: formData.newUsername });
          showSuccessModal(
            '✅ Username Updated Successfully!',
            `Your username has been changed to "${formData.newUsername}".`
          );
        } catch (error) {
          setErrors({ submit: error.message });
        } finally {
          setIsSubmitting(false);
        }
      }
    );
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (!validatePasswordForm()) return;

    showConfirmationModal(
      '🔒 Confirm Password Change',
      'Are you sure you want to change your password?\n\nYou will need to use your new password for future logins.',
      async () => {
        setIsSubmitting(true);
        try {
          await updatePassword(formData.currentPassword, formData.newPassword);
          showSuccessModal(
            '✅ Password Updated Successfully!',
            'Your password has been changed.\n\nPlease use your new password for future logins.'
          );
        } catch (error) {
          setErrors({ submit: error.message });
        } finally {
          setIsSubmitting(false);
        }
      }
    );
  };

  return (
    <ModalShell onClose={onClose} contentClassName="user-settings-modal" closeOnOverlay={false}>
      <div className="user-settings-header">
        <div className="user-settings-icon">⚙️ User Settings</div>
        <p className="user-settings-subtitle">Manage your account credentials and session</p>
      </div>

      {/* Search Bar */}
      <div className="settings-search">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="user-settings-tabs">
        {filteredTabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabSwitch(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {errors.submit && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {errors.submit}
        </div>
      )}

      <div className="form-container">
        {activeTab === 'username' && (
          <form onSubmit={handleUsernameSubmit} className="user-settings-form">
            <div className="current-info-card">
              <div className="info-label">Current Username</div>
              <div className="info-value">{currentUser.username}</div>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">👤</span>
                New Username
              </label>
              <input
                type="text"
                name="newUsername"
                className={`form-control ${errors.newUsername ? 'error' : ''}`}
                value={formData.newUsername}
                onChange={handleInputChange}
                placeholder="Enter new username"
                autoComplete="username"
                disabled={isSubmitting}
              />
              {errors.newUsername && (
                <div className="error-feedback">
                  <span className="error-icon">⚠️</span>
                  {errors.newUsername}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">🔐</span>
                Current Password
              </label>
              <input
                type="password"
                name="currentPassword"
                className={`form-control ${errors.currentPassword ? 'error' : ''}`}
                value={formData.currentPassword}
                onChange={handleInputChange}
                placeholder="Enter current password"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              {errors.currentPassword && (
                <div className="error-feedback">
                  <span className="error-icon">⚠️</span>
                  {errors.currentPassword}
                </div>
              )}
            </div>
          </form>
        )}

        {activeTab === 'session' && (
          <form onSubmit={handleSessionSubmit} className="user-settings-form">
            <div className="current-info-card">
              <div className="info-label">Current Session Timeout</div>
              <div className="info-value">
                {sessionTimeout === 0 ? 'Never expires' : `${sessionTimeout} minute${sessionTimeout !== 1 ? 's' : ''}`}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">⏱️</span>
                Session Timeout (minutes)
              </label>
              <CustomSelect
                id="session-timeout-select"
                name="sessionTimeout"
                value={formData.sessionTimeout}
                onChange={handleInputChange}
                disabled={isSubmitting}
                options={[
                  { label: 'Never expire (stay logged in)', value: "0" },
                  { label: '5 minutes', value: "5" },
                  { label: '10 minutes', value: "10" },
                  { label: '15 minutes', value: "15" },
                  { label: '30 minutes (default)', value: "30" },
                  { label: '1 hour', value: "60" },
                  { label: '2 hours', value: "120" },
                  { label: '4 hours', value: "240" },
                  { label: '8 hours', value: "480" }
                ]}
              />
              {errors.sessionTimeout && (
                <div className="error-feedback">
                  <span className="error-icon">⚠️</span>
                  {errors.sessionTimeout}
                </div>
              )}
            </div>

            <div className="info-card">
              <div className="info-title">
                <span className="info-icon">ℹ️</span>
                About Session Management
              </div>
              <div className="info-content">
                <p><strong>Session timeout</strong> determines how long you stay logged in after your last activity.</p>
                <ul>
                  <li><strong>Activity includes:</strong> Clicking, typing, scrolling, or touching the screen</li>
                  <li><strong>When expired:</strong> You'll be automatically logged out and need to sign in again</li>
                  <li><strong>Never expire:</strong> You stay logged in until you manually log out</li>
                  <li><strong>Tab refresh:</strong> Your session persists across browser refreshes</li>
                </ul>
                <p className="security-note">
                  <strong>Security Tip:</strong> For public computers, consider using a shorter timeout period.
                </p>
              </div>
            </div>
          </form>
        )}

        {activeTab === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="user-settings-form">
            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">🔐</span>
                Current Password
              </label>
              <input
                type="password"
                name="currentPassword"
                className={`form-control ${errors.currentPassword ? 'error' : ''}`}
                value={formData.currentPassword}
                onChange={handleInputChange}
                placeholder="Enter current password"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              {errors.currentPassword && (
                <div className="error-feedback">
                  <span className="error-icon">⚠️</span>
                  {errors.currentPassword}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">🔑</span>
                New Password
              </label>
              <input
                type="password"
                name="newPassword"
                className={`form-control ${errors.newPassword ? 'error' : ''}`}
                value={formData.newPassword}
                onChange={handleInputChange}
                placeholder="Enter new password"
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              {errors.newPassword && (
                <div className="error-feedback">
                  <span className="error-icon">⚠️</span>
                  {errors.newPassword}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">🔑</span>
                Confirm New Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                className={`form-control ${errors.confirmPassword ? 'error' : ''}`}
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm new password"
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              {errors.confirmPassword && (
                <div className="error-feedback">
                  <span className="error-icon">⚠️</span>
                  {errors.confirmPassword}
                </div>
              )}
            </div>
          </form>
        )}
        {activeTab === 'appearance' && (
          <div className="user-settings-form">
            <div className="current-info-card">
              <div className="info-label">Active Theme</div>
              <div className="info-value" style={{ textTransform: 'capitalize' }}>
                {theme} {theme === 'system' ? `(${activeTheme})` : ''}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">🎨</span>
                Application Theme
              </label>
              <div className="theme-preview-grid">
                <div
                  className={`theme-preview-card ${theme === 'light' ? 'selected' : ''}`}
                  onClick={() => setTheme('light')}
                >
                  <div className="theme-preview-header light">
                    <span>☀️</span>
                    <span>Light</span>
                  </div>
                  <div className="theme-preview-body">
                    <div className="theme-preview-skeleton light"></div>
                    <div className="theme-preview-skeleton light" style={{ width: '60%' }}></div>
                  </div>
                  <div className="theme-preview-label">Light Mode</div>
                  <div className="theme-preview-description">Bright and clean</div>
                </div>
                <div
                  className={`theme-preview-card ${theme === 'dark' ? 'selected' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  <div className="theme-preview-header dark">
                    <span>🌙</span>
                    <span>Dark</span>
                  </div>
                  <div className="theme-preview-body">
                    <div className="theme-preview-skeleton dark"></div>
                    <div className="theme-preview-skeleton dark" style={{ width: '60%' }}></div>
                  </div>
                  <div className="theme-preview-label">Dark Mode</div>
                  <div className="theme-preview-description">Easy on the eyes</div>
                </div>
                <div
                  className={`theme-preview-card ${theme === 'system' ? 'selected' : ''}`}
                  onClick={() => setTheme('system')}
                >
                  <div className="theme-preview-header system">
                    <span>🖥️</span>
                    <span>System</span>
                  </div>
                  <div className="theme-preview-body">
                    <div className="theme-preview-skeleton system"></div>
                    <div className="theme-preview-skeleton system" style={{ width: '60%' }}></div>
                  </div>
                  <div className="theme-preview-label">System Theme</div>
                  <div className="theme-preview-description">Follows your device</div>
                </div>
              </div>
            </div>

            <div className="info-card">
              <div className="info-title">
                <span className="info-icon">ℹ️</span>
                Theme Selection
              </div>
              <div className="info-content">
                <p>Choose the color scheme that works best for you:</p>
                <ul>
                  <li><strong>Light:</strong> A bright, clean interface with high legibility.</li>
                  <li><strong>Dark:</strong> Reduces eye strain in low-light environments.</li>
                  <li><strong>System:</strong> Automatically follows your device's theme settings.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Form Actions - Fixed at bottom */}
      <div className="form-actions">
        {activeTab === 'username' && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              onClick={handleUsernameSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner"></span>
                  Updating...
                </>
              ) : (
                <>
                  <span className="btn-icon">🔄</span>
                  Update Username
                </>
              )}
            </button>
          </>
        )}
        {activeTab === 'session' && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              onClick={handleSessionSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner"></span>
                  Updating...
                </>
              ) : (
                <>
                  <span className="btn-icon">⏱️</span>
                  Update Session
                </>
              )}
            </button>
          </>
        )}
        {activeTab === 'password' && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              onClick={handlePasswordSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner"></span>
                  Updating...
                </>
              ) : (
                <>
                  <span className="btn-icon">🔒</span>
                  Update Password
                </>
              )}
            </button>
          </>
        )}
        {activeTab === 'appearance' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
          >
            Done
          </button>
        )}
      </div>
    </ModalShell>
  );
}

export default UserSettingsModal;
