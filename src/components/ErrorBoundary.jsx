import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {


    this.setState({
      hasError: true,
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text)',
          fontFamily: 'inherit',
          textAlign: 'center'
        }}>
          <div className="error-card" style={{
            maxWidth: '500px',
            width: '100%',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '16px',
            padding: '40px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
            border: '1px solid var(--color-border)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>
              Oops! Something went wrong
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              The application encountered an unexpected error. Don't worry, your data is likely safe in local storage.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '32px' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s'
                }}
              >
                🔄 Refresh Page
              </button>
              <button
                onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text)',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {this.state.showDetails ? 'Hide Details' : 'Show Details'}
              </button>
            </div>

            {this.state.showDetails && (
              <div style={{ textAlign: 'left', marginTop: '20px' }}>
                <pre style={{
                  backgroundColor: 'var(--color-bg-alt, #f5f5f5)',
                  padding: '16px',
                  borderRadius: '8px',
                  overflow: 'auto',
                  fontSize: '12px',
                  color: '#d63031',
                  maxHeight: '200px'
                }}>
                  {this.state.error && this.state.error.toString()}
                  {"\n"}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </div>
            )}

            <div style={{
              marginTop: '20px',
              padding: '16px',
              backgroundColor: 'var(--color-warning-light, #fffbe6)',
              borderRadius: '12px',
              fontSize: '13px',
              textAlign: 'left',
              color: '#856404',
              border: '1px solid #ffe58f'
            }}>
              <strong>💡 Pro Tip:</strong> If refreshing doesn't work, try clearing your browser cache or logging out and back in.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
