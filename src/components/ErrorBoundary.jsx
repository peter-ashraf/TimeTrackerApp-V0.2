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
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      hasError: true,
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '8px',
          margin: '20px',
          fontFamily: 'Arial, sans-serif'
        }}>
          <h2 style={{ color: '#d63031', margin: '0 0 10px 0' }}>
            ⚠️ Application Error
          </h2>
          <details style={{ marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              {this.state.error.toString()}
            </summary>
            <div style={{ marginTop: '10px', fontSize: '14px', lineHeight: '1.5' }}>
              <strong>Error Details:</strong>
              <pre style={{ 
                backgroundColor: '#f8f8f', 
                padding: '10px', 
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '12px'
              }}>
                {this.state.error && this.state.error.stack}
              </pre>
            </div>
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
              <strong>🔧 Recommended Actions:</strong>
              <ul style={{ margin: '0', paddingLeft: '20px' }}>
                <li>1. Save your current work and refresh the page</li>
                <li>2. Clear browser cache and restart the development server</li>
                <li>3. Check the React DevTools console for specific error details</li>
                <li>4. If the problem persists, the authentication system may need to be temporarily disabled</li>
              </ul>
            </div>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
