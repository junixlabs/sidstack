import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="w-16 h-16 mb-4 text-[var(--text-secondary)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Something went wrong</h2>
          <p className="text-sm text-[var(--text-muted)] mb-4 max-w-md">
            An unexpected error occurred. Please try again or refresh the application.
          </p>
          {this.state.error && (
            <details className="mb-4 text-left w-full max-w-md">
              <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)]">
                Technical details
              </summary>
              <pre className="mt-2 p-3 bg-[var(--surface-2)] rounded text-xs text-[var(--text-secondary)] overflow-auto max-h-32">
                {this.state.error.message}
                {this.state.errorInfo?.componentStack && (
                  <span className="text-[var(--text-muted)]">{this.state.errorInfo.componentStack}</span>
                )}
              </pre>
            </details>
          )}
          <div className="flex gap-2">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-[var(--surface-3)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] text-sm rounded"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] text-sm rounded"
            >
              Refresh App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Smaller error boundary for individual components
export function ComponentErrorBoundary({
  children,
  componentName = "Component",
}: {
  children: ReactNode;
  componentName?: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center justify-center p-4 text-center">
          <div className="text-sm text-[var(--text-muted)]">
            <span className="text-[var(--text-secondary)]">Error loading {componentName}</span>
            <button
              onClick={() => window.location.reload()}
              className="ml-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
            >
              Refresh
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
