import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console or error reporting service
    console.error('[ErrorBoundary] Caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center', 
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          margin: '1rem',
          color: '#dc2626'
        }}>
          <h2>🚨 Something went wrong</h2>
          <p>The application encountered an unexpected error.</p>
          <details style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            backgroundColor: '#ffffff',
            borderRadius: '4px',
            textAlign: 'left'
          }}>
            <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
              Error Details (Click to expand)
            </summary>
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              fontSize: '12px',
              overflow: 'auto',
              maxHeight: '200px'
            }}>
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <div style={{ marginTop: '1rem' }}>
            <button 
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '8px'
              }}
            >
              🔄 Reload Page
            </button>
            <button 
              onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🔁 Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;