import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

/**
 * ErrorBoundary component to catch and gracefully handle React errors
 *
 * Prevents white screen of death by showing a fallback UI when errors occur.
 * Logs errors for debugging and can integrate with error tracking services.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('ErrorBoundary caught error:', error);
      console.error('Error info:', errorInfo);
      console.error('Component stack:', errorInfo.componentStack);
    }

    // Call custom error handler if provided (for error tracking services like Sentry)
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Store errorInfo in state for fallback UI
    this.setState({ errorInfo });
  }

  handleRefresh = () => {
    // Reset error state and reload page
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    window.location.reload();
  };

  handleGoHome = () => {
    // Reset error state and navigate to homepage
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI with DaisyUI styling
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-base-200">
          <div className="card bg-error text-error-content max-w-lg w-full shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl">Oops! Something went wrong</h2>
              <p className="text-base opacity-90">
                We&apos;re sorry, but something unexpected happened. This error has been logged and we&apos;ll look into it.
              </p>

              {/* Show error details in development only */}
              {process.env.NODE_ENV !== 'production' && this.state.error && (
                <div className="mt-4 p-4 bg-base-100 text-base-content rounded-lg">
                  <p className="font-bold text-sm mb-2">Error Details (dev only):</p>
                  <p className="text-xs font-mono break-words">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-semibold">
                        Component Stack
                      </summary>
                      <pre className="text-xs mt-2 overflow-auto max-h-64">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="card-actions justify-end mt-4 gap-2">
                <button
                  className="btn btn-ghost"
                  onClick={this.handleGoHome}
                >
                  Go to Homepage
                </button>
                <button
                  className="btn btn-primary"
                  onClick={this.handleRefresh}
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
