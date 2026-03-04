import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  EuiEmptyPrompt,
  EuiButton,
  EuiCallOut,
  EuiSpacer,
  EuiText,
} from '@elastic/eui';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <EuiEmptyPrompt
          iconType="error"
          color="danger"
          title={<h2>Something went wrong</h2>}
          body={
            <>
              <EuiCallOut
                title={this.state.error?.message || 'An unexpected error occurred'}
                color="danger"
                iconType="error"
              >
                {this.state.errorInfo && (
                  <>
                    <EuiSpacer size="s" />
                    <EuiText size="xs">
                      <pre
                        style={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: '200px',
                          overflow: 'auto',
                        }}
                      >
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </EuiText>
                  </>
                )}
              </EuiCallOut>
            </>
          }
          actions={
            <EuiButton color="primary" fill onClick={this.handleReset}>
              Try again
            </EuiButton>
          }
        />
      );
    }

    return this.props.children;
  }
}
