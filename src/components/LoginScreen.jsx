import React, { useState, useEffect, useRef } from 'react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { useUsernameValidation } from '../hooks/useUsernameValidation';
import RecoveryModal from './RecoveryModal';
import '../styles/login-screen.css';

const LoginScreen = () => {
  const { login, register, resetPassword, isLoading } = useSupabaseAuth();
  const loginButtonRef = useRef(null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    fullName: '',
    password: '',
    confirmPassword: '',
    rememberMe: false
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showError, setShowError] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [errorKey, setErrorKey] = useState(0);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Username validation hook - only used in registration mode
  const usernameValidation = useUsernameValidation(
    !isLoginMode ? formData.username : '',
    500
  );

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Handle checkboxes differently than text inputs
    const fieldValue = type === 'checkbox' ? checked : value;

    setFormData(prev => ({ ...prev, [name]: fieldValue }));
    setInputFocused(true);
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Email validation only for registration
    if (!isLoginMode) {
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    // Username validation (required for both login and registration)
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.trim().length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (formData.username.trim().length > 20) {
      newErrors.username = 'Username must be 20 characters or less';
    } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(formData.username.trim())) {
      newErrors.username = 'Username must start with a letter and contain only letters, numbers, and underscores';
    }

    // For registration, check if username is available
    if (!isLoginMode && usernameValidation.isAvailable === false) {
      newErrors.username = usernameValidation.error || 'Username is not available';
    }

    // Full name only required for registration
    if (!isLoginMode) {
      if (!formData.fullName.trim()) {
        newErrors.fullName = 'Full name is required';
      }
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!isLoginMode && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isLoginMode) {
        await login(formData.username, formData.password, formData.rememberMe);
      } else {
        await register(formData.username, formData.password, formData.email, formData.fullName);
        // Switch to login mode after successful registration
        setIsLoginMode(true);
        setFormData(prev => ({
          ...prev,
          fullName: '',
          password: '',
          confirmPassword: ''
        }));
      }
    } catch (error) {
      // Force animation on every error by incrementing key
      setErrorKey(prev => prev + 1);
      setErrors({ general: error.message });
      setShowError(true);
    } finally {
      setIsSubmitting(false);
      // Force button blur immediately using ref
      if (loginButtonRef.current) {
        loginButtonRef.current.blur();
      }
      // Also clear any document focus
      if (document.activeElement) {
        document.activeElement.blur();
      }
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) {
      setErrors({ reset: 'Username or email is required for password reset' });
      return;
    }

    // Check if input is email
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail);

    if (isEmail) {
      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
        setErrors({ reset: 'Please enter a valid email address' });
        return;
      }
    } else {
      // Validate username format
      if (resetEmail.length < 3) {
        setErrors({ reset: 'Username must be at least 3 characters' });
        return;
      }
      if (resetEmail.length > 20) {
        setErrors({ reset: 'Username must be 20 characters or less' });
        return;
      }
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(resetEmail)) {
        setErrors({ reset: 'Username must start with a letter and contain only letters, numbers, and underscores' });
        return;
      }
    }

    setIsResetting(true);
    setErrors({});

    try {
      await resetPassword(resetEmail);

      // Clear specific reset errors
      setErrors({});

      // Delay closing modal slightly for better UX
      setTimeout(() => {
        setShowPasswordReset(false);
        setResetEmail('');
        // Show success message in the main form
        setErrors({ general: '✅ Password reset link sent! Check your inbox.' });
        setShowError(true);
      }, 500);
    } catch (error) {
      setErrors({ reset: error.message });
    } finally {
      setIsResetting(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setErrors({});
    setFormData(prev => ({
      ...prev,
      fullName: '',
      password: '',
      confirmPassword: '',
      // Clear email only when switching to login mode
      email: isLoginMode ? prev.email : ''
    }));
    setShowError(false); // Hide error when switching modes
    setInputFocused(false);
    setErrorKey(0); // Reset error key when switching modes
  };

  if (isLoading) {
    return (
      <div className="login-screen">
        <div className="login-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-header">
          <div className="app-icon">🕐</div>
          <h1>TimeTracker</h1>
          <p className="app-subtitle">Professional Time Management</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {errors.general && (
            <div
              className={`error-message show animate`}
              key={errorKey}
            >
              <div className="error-content">
                <div className="error-icon">⚠️</div>
                <div className="error-text">
                  <strong>Login Error</strong>
                  <p>{errors.general}</p>
                </div>
              </div>
            </div>
          )}

          {/* Email field - only shown in registration mode */}
          {!isLoginMode && (
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`form-input ${errors.email ? 'error' : ''}`}
                placeholder="Enter your email"
                autoComplete="email"
                required
              />
              {errors.email && (
                <span className="field-error">{errors.email}</span>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">
              {isLoginMode ? 'Username' : 'Username (Display Name)'}
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className={`form-input ${errors.username ? 'error' : ''} ${!isLoginMode && usernameValidation.isChecking ? 'checking' : ''} ${!isLoginMode && usernameValidation.isAvailable === true ? 'available' : ''} ${!isLoginMode && usernameValidation.isAvailable === false ? 'unavailable' : ''}`}
              placeholder={isLoginMode ? "Enter your username" : "Choose a username"}
              autoComplete="username"
              required
            />
            {errors.username && (
              <span className="field-error">{errors.username}</span>
            )}
            {!isLoginMode && !errors.username && formData.username && (
              <div className="username-status">
                {usernameValidation.isChecking && (
                  <span className="checking-status">Checking availability...</span>
                )}
                {usernameValidation.isAvailable === true && (
                  <span className="available-status">✓ Username is available</span>
                )}
                {usernameValidation.isAvailable === false && (
                  <span className="unavailable-status">✗ {usernameValidation.error || 'Username is not available'}</span>
                )}
              </div>
            )}
          </div>

          {!isLoginMode && (
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                className={`form-input ${errors.fullName ? 'error' : ''}`}
                placeholder="Enter your full name"
                autoComplete="name"
                required
              />
              {errors.fullName && (
                <span className="field-error">{errors.fullName}</span>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className={`form-input ${errors.password ? 'error' : ''}`}
              placeholder="Enter your password"
              autoComplete={isLoginMode ? 'current-password' : 'new-password'}
              required
            />
            {errors.password && (
              <span className="field-error">{errors.password}</span>
            )}
          </div>

          {isLoginMode && (
            <div className="form-group remember-me-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleInputChange}
                  className="checkbox-input"
                />
                <span className="checkbox-text">Remember me for 30 days</span>
              </label>
            </div>
          )}

          {!isLoginMode && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                placeholder="Confirm your password"
                autoComplete="new-password"
                required
              />
              {errors.confirmPassword && (
                <span className="field-error">{errors.confirmPassword}</span>
              )}
            </div>
          )}

          <button
            ref={loginButtonRef}
            type="submit"
            className="btn btn-primary login-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="btn-spinner"></span>
                {isLoginMode ? 'Logging in...' : 'Creating account...'}
              </>
            ) : (
              isLoginMode ? '🔓 Login' : '👤 Create Account'
            )}
          </button>

          {!isLoginMode && (
            <button
              type="button"
              className="btn btn-secondary back-btn"
              onClick={toggleMode}
              disabled={isSubmitting}
            >
              ← Back to Login
            </button>
          )}
        </form>

        <div className="login-footer">
          <p>
            {isLoginMode ? "Don't have an account?" : "Already have an account?"}
            <button
              type="button"
              className="link-btn"
              onClick={toggleMode}
            >
              {isLoginMode ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
          {isLoginMode && (
            <p className="forgot-password">
              <button
                type="button"
                className="link-btn forgot-link"
                onClick={() => setShowPasswordReset(true)}
              >
                Forgot Password?
              </button>
              <span className="recovery-link">
                <button
                  type="button"
                  className="link-btn recovery-link-btn"
                  onClick={() => setShowRecoveryModal(true)}
                >
                  Recover Data
                </button>
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Recovery Modal */}
      {showRecoveryModal && (
        <RecoveryModal onClose={() => setShowRecoveryModal(false)} />
      )}

      {/* Password Reset Modal */}
      {showPasswordReset && (
        <div className="modal-overlay">
          <div className="modal password-reset-modal">
            <div className="modal-header">
              <h3>🔒 Reset Password</h3>
              <button
                className="modal-close-btn"
                onClick={() => {
                  setShowPasswordReset(false);
                  setResetEmail('');
                  setErrors({});
                }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p className="reset-instructions">
                Enter your username or email address and we'll send you a link to reset your password.
              </p>

              {errors.reset && (
                <div className="error-message">
                  <span className="error-icon">⚠️</span>
                  {errors.reset}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="reset-email">Username or Email Address</label>
                <input
                  type="text"
                  id="reset-email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className={`form-input ${errors.reset ? 'error' : ''}`}
                  placeholder="Enter your username or email"
                  autoComplete="username"
                  disabled={isResetting}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowPasswordReset(false);
                  setResetEmail('');
                  setErrors({});
                }}
                disabled={isResetting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleResetPassword}
                disabled={isResetting}
              >
                {isResetting ? (
                  <>
                    <span className="btn-spinner"></span>
                    Sending...
                  </>
                ) : (
                  <>
                    <span className="btn-icon">📧</span>
                    Send Reset Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginScreen;
