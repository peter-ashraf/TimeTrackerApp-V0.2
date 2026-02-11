import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/login-screen.css';

const LoginScreen = () => {
  const { login, register, isLoading } = useAuth();
  const loginButtonRef = useRef(null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showError, setShowError] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [errorKey, setErrorKey] = useState(0);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setInputFocused(true);
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
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
        await login(formData.username, formData.password);
      } else {
        await register(formData.username, formData.password);
        // Switch to login mode after successful registration
        setIsLoginMode(true);
        setFormData({ username: formData.username, password: '', confirmPassword: '' });
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

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setErrors({});
    setFormData({ username: '', password: '', confirmPassword: '' });
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

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className={`form-input ${errors.username ? 'error' : ''}`}
              placeholder="Enter your username"
              autoComplete="username"
              required
            />
            {errors.username && (
              <span className="field-error">{errors.username}</span>
            )}
          </div>

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
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
