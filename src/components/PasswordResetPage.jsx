import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../context/SupabaseAuthContext';
import '../styles/login-screen.css';

const PasswordResetPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verify the reset token
    const verifyToken = async () => {
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      
      if (!accessToken || !refreshToken) {
        setErrors({ general: 'Invalid or expired password reset link.' });
        setIsLoading(false);
        return;
      }

      try {
        // Set the session with the tokens
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          setErrors({ general: 'Invalid or expired password reset link.' });
        }
      } catch (error) {
        setErrors({ general: 'Invalid or expired password reset link.' });
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [searchParams]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.password) {
      newErrors.password = 'New password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.password
      });

      if (error) {
        setErrors({ general: error.message });
      } else {
        setIsSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (error) {
      setErrors({ general: 'An error occurred while resetting your password.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="login-screen">
        <div className="login-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Verifying reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="login-screen">
        <div className="login-container">
          <div className="login-header">
            <div className="app-icon">🎉</div>
            <h1>Password Reset Successful!</h1>
            <p className="app-subtitle">Your password has been updated</p>
          </div>
          
          <div className="success-message">
            <p>Your password has been successfully reset.</p>
            <p>You will be redirected to the login page in a few seconds...</p>
          </div>
          
          <button
            className="btn btn-primary login-btn"
            onClick={() => navigate('/login')}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-header">
          <div className="app-icon">🔒</div>
          <h1>Reset Password</h1>
          <p className="app-subtitle">Enter your new password</p>
        </div>

        {errors.general && (
          <div className="error-message show animate">
            <div className="error-content">
              <div className="error-icon">⚠️</div>
              <div className="error-text">
                <strong>Error</strong>
                <p>{errors.general}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className={`form-input ${errors.password ? 'error' : ''}`}
              placeholder="Enter new password"
              autoComplete="new-password"
              disabled={isSubmitting}
              required
            />
            {errors.password && (
              <span className="field-error">{errors.password}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
              placeholder="Confirm new password"
              autoComplete="new-password"
              disabled={isSubmitting}
              required
            />
            {errors.confirmPassword && (
              <span className="field-error">{errors.confirmPassword}</span>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="btn-spinner"></span>
                Resetting Password...
              </>
            ) : (
              <>
                <span className="btn-icon">🔒</span>
                Reset Password
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>
            <button
              type="button"
              className="link-btn"
              onClick={() => navigate('/login')}
            >
              Back to Login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PasswordResetPage;
