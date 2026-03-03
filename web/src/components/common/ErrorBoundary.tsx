// Error boundary components for graceful error handling
import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import {
  EuiEmptyPrompt,
  EuiButton,
  EuiCode,
  EuiAccordion,
  EuiText,
  EuiCallOut,
  EuiSpacer,
} from '@elastic/eui';

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

// Main error boundary for the entire app
export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Report to error tracking service
    console.error('Uncaught error:', error, errorInfo);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleRefresh = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <EuiEmptyPrompt
          iconType="alert"
          iconColor="danger"
          title={<h2>Something went wrong</h2>}
          body={
            <>
              <EuiText>
                <p>An unexpected error occurred. Please try refreshing the page.</p>
              </EuiText>
              
              {this.state.error && (
                <>
                  <EuiSpacer size="m" />
                  <EuiAccordion
                    id="error-details"
                    buttonContent="Error details"
                    paddingSize="m"
                  >
                    <EuiCode>
                      {this.state.error.message}
                    </EuiCode>
                    {this.state.errorInfo?.componentStack && (
                      <>
                        <EuiSpacer size="s" />
                        <EuiText size="xs" color="subdued">
                          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '10px' }}>
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </EuiText>
                      </>
                    )}
                  </EuiAccordion>
                </>
              )}
            </>
          }
          actions={[
            <EuiButton
              key="refresh"
              color="primary"
              fill
              onClick={this.handleRefresh}
            >
              Refresh page
            </EuiButton>,
            <EuiButton
              key="retry"
              color="primary"
              onClick={this.handleRetry}
            >
              Try again
            </EuiButton>,
          ]}
        />
      );
    }

    return this.props.children;
  }
}

// Error boundary for individual page sections
interface SectionErrorBoundaryProps extends Props {
  title?: string;
}

export class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, State> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('Section error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <EuiCallOut
          title={this.props.title || 'Error loading section'}
          color="danger"
          iconType="alert"
        >
          <EuiText size="s">
            <p>{this.state.error?.message || 'An error occurred'}</p>
          </EuiText>
          <EuiSpacer size="s" />
          <EuiButton size="s" onClick={this.handleRetry}>
            Retry
          </EuiButton>
        </EuiCallOut>
      );
    }

    return this.props.children;
  }
}

// Async error boundary for React Query/Suspense
export function QueryErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary?: () => void;
}): JSX.Element {
  return (
    <EuiCallOut
      title="Failed to load data"
      color="danger"
      iconType="alert"
    >
      <EuiText size="s">
        <p>{error.message}</p>
      </EuiText>
      {resetErrorBoundary && (
        <>
          <EuiSpacer size="s" />
          <EuiButton size="s" onClick={resetErrorBoundary}>
            Retry
          </EuiButton>
        </>
      )}
    </EuiCallOut>
  );
}

// Not found error component
export function NotFoundError({
  title = 'Resource not found',
  message = 'The requested resource could not be found.',
  backUrl = '/',
  backLabel = 'Go back',
}: {
  title?: string;
  message?: string;
  backUrl?: string;
  backLabel?: string;
}): JSX.Element {
  return (
    <EuiEmptyPrompt
      iconType="searchProfilerApp"
      iconColor="subdued"
      title={<h2>{title}</h2>}
      body={
        <EuiText>
          <p>{message}</p>
        </EuiText>
      }
      actions={
        <EuiButton href={backUrl}>{backLabel}</EuiButton>
      }
    />
  );
}

// Permission denied error component
export function PermissionDeniedError({
  resource,
  action = 'access',
}: {
  resource?: string;
  action?: string;
}): JSX.Element {
  return (
    <EuiEmptyPrompt
      iconType="lock"
      iconColor="warning"
      title={<h2>Permission denied</h2>}
      body={
        <EuiText>
          <p>
            You don&apos;t have permission to {action}
            {resource ? ` this ${resource}` : ' this resource'}.
          </p>
          <p>Contact your administrator if you believe this is an error.</p>
        </EuiText>
      }
      actions={
        <EuiButton href="/">Return to home</EuiButton>
      }
    />
  );
}
