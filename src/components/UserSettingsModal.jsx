import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTimeTracker } from '../context/TimeTrackerContext';
import ModalShell from './ModalShell';
import '../styles/user-settings-modal.css';


function UserSettingsModal({ isOpen, onClose }) {
  const { currentUser, updateUsername, updatePassword } = useAuth();
  const { setConfirmModal } = useTimeTracker();
  
  if (!isOpen) return null;
  
  const [formData, setFormData] = useState({
    newUsername: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState('username');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    // Reset form data and errors when switching tabs
    setFormData({
      newUsername: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
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
    <ModalShell onClose={onClose} contentClassName="user-settings-modal" closeOnOverlay={!isSubmitting}>
      <div className="user-settings-header">
        <div className="user-settings-icon">⚙️ User Settings</div>
                <p className="user-settings-subtitle">Manage your account credentials</p>
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
