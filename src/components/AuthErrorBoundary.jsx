import React, { Component } from 'react';
import PropTypes from 'prop-types';

class AuthErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    
    // Log error to monitoring service
    console.error('Auth Error Boundary caught an error:', error, errorInfo);
    
    // Send to error reporting service
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: false
      });
    }

    // Send to Sentry if available
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        tags: {
          component: 'AuthErrorBoundary',
          feature: 'authentication'
        },
        extra: {
          errorInfo,
          retryCount: this.state.retryCount
        }
      });
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < 3) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="auth-error-fallback" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '500px',
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{
              color: '#dc3545',
              marginBottom: '1rem',
              fontSize: '1.5rem'
            }}>
              Authentication Error
            </h2>
            
            <p style={{
              color: '#6c757d',
              marginBottom: '1.5rem',
              lineHeight: '1.5'
            }}>
              Something went wrong with the authentication process. This could be due to a network issue or a temporary system error.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                textAlign: 'left'
              }}>
                <summary style={{
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  marginBottom: '0.5rem'
                }}>
                  Error Details (Development Only)
                </summary>
                <pre style={{
                  fontSize: '0.875rem',
                  overflow: 'auto',
                  maxHeight: '200px',
                  margin: 0
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={this.handleRetry}
                disabled={this.state.retryCount >= 3}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: this.state.retryCount >= 3 ? '#6c757d' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: this.state.retryCount >= 3 ? 'not-allowed' : 'pointer',
                  fontSize: '1rem'
                }}
              >
                {this.state.retryCount >= 3 ? 'Max Retries Reached' : `Try Again (${this.state.retryCount}/3)`}
              </button>
              
              <button
                onClick={this.handleRefresh}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                Refresh Page
              </button>
            </div>

            {this.state.retryCount >= 3 && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '4px',
                color: '#856404'
              }}>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>
                  <strong>Still having trouble?</strong> Please contact support or try again later. 
                  You can also clear your browser cache and cookies.
                </p>
              </div>
            )}

            <div style={{
              marginTop: '1.5rem',
              fontSize: '0.875rem',
              color: '#6c757d'
            }}>
              <p style={{ margin: 0 }}>
                Error ID: {Date.now().toString(36)}
              </p>
              <p style={{ margin: 0 }}>
                If this problem persists, please reference this error ID when contacting support.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

AuthErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired
};

export default AuthErrorBoundary;
