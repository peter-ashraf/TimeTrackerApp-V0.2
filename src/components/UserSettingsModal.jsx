import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTimeTracker } from '../context/TimeTrackerContext';
import ModalShell from './ModalShell';
import '../styles/user-settings-modal.css';


function UserSettingsModal({ isOpen, onClose, defaultTab = 'username' }) {
  const { currentUser, updateUsername, updatePassword, sessionTimeout, saveSessionSettings } = useAuth();
  const { setConfirmModal } = useTimeTracker();
  
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
      `Are you sure you want to set your session to ${timeoutText}?\n\n${
        timeout === 0 
          ? 'You will stay logged in until you manually log out.' 
          : 'You will be automatically logged out after the specified period of inactivity.'
      }`,
      async () => {
        setIsSubmitting(true);
        try {
          await saveSessionSettings(timeout);
          showSuccessModal(
            '✅ Session Settings Updated!',
            `Your session will now ${timeoutText}.\n\n${
              timeout === 0 
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
      `Are you sure you want to change your username from "${currentUser.username}" to "${formData.newUsername}"?\n\nThis will migrate all your data to the new username.`,
      async () => {
        setIsSubmitting(true);
        try {
          await updateUsername(formData.newUsername, formData.currentPassword);
          showSuccessModal(
            '✅ Username Updated Successfully!',
            `Your username has been changed to "${formData.newUsername}".\n\nAll your data has been migrated to your new username.`
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

      <div className="user-settings-tabs">
        <button
          className={`tab-btn ${activeTab === 'username' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('username')}
        >
          <span className="tab-icon">👤</span>
          <span className="tab-label">Username</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'password' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('password')}
        >
          <span className="tab-icon">🔒</span>
          <span className="tab-label">Password</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'session' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('session')}
        >
          <span className="tab-icon">⏱️</span>
          <span className="tab-label">Session</span>
        </button>
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

            <div className="form-actions">
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
              <select
                name="sessionTimeout"
                className={`form-control ${errors.sessionTimeout ? 'error' : ''}`}
                value={formData.sessionTimeout}
                onChange={handleInputChange}
                disabled={isSubmitting}
              >
                <option value="0">Never expire (stay logged in)</option>
                <option value="5">5 minutes</option>
                <option value="10">10 minutes</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes (default)</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
                <option value="240">4 hours</option>
                <option value="480">8 hours</option>
              </select>
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

            <div className="form-actions">
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

            <div className="form-actions">
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
            </div>
          </form>
        )}
      </div>
    </ModalShell>
  );
}

export default UserSettingsModal;
