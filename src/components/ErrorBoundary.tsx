/**
 * Error Boundary Component
 *
 * Catches render errors and displays fallback UI.
 * Also provides error toast/notification system.
 */

import React, { Component, createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode, ErrorInfo, CSSProperties } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Error severity levels
 */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * Error notification
 */
export interface ErrorNotification {
  id: string;
  message: string;
  severity: ErrorSeverity;
  details?: string;
  timestamp: number;
  dismissed?: boolean;
}

/**
 * Error context value
 */
export interface ErrorContextValue {
  /** Current notifications */
  notifications: ErrorNotification[];
  /** Show an error notification */
  showError: (message: string, details?: string) => void;
  /** Show a warning notification */
  showWarning: (message: string, details?: string) => void;
  /** Show an info notification */
  showInfo: (message: string, details?: string) => void;
  /** Dismiss a notification */
  dismissNotification: (id: string) => void;
  /** Clear all notifications */
  clearNotifications: () => void;
}

/**
 * Error boundary props
 */
export interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Custom fallback UI */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to show error details */
  showDetails?: boolean;
}

/**
 * Error boundary state
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ErrorContext = createContext<ErrorContextValue | null>(null);

/**
 * Hook to use error notifications
 */
export function useErrorNotifications(): ErrorContextValue {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useErrorNotifications must be used within an ErrorProvider');
  }
  return context;
}

// ============================================================================
// ERROR PROVIDER
// ============================================================================

/**
 * Error notification provider
 */
export function ErrorProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<ErrorNotification[]>([]);
  const idCounter = useRef(0);

  const addNotification = useCallback(
    (message: string, severity: ErrorSeverity, details?: string) => {
      const id = `error-${++idCounter.current}-${Date.now()}`;
      const notification: ErrorNotification = {
        id,
        message,
        severity,
        details,
        timestamp: Date.now(),
      };

      setNotifications((prev) => [...prev, notification]);

      // Auto-dismiss after 5 seconds for info/warning
      if (severity !== 'error') {
        setTimeout(() => {
          dismissNotification(id);
        }, 5000);
      }

      return id;
    },
    []
  );

  const showError = useCallback(
    (message: string, details?: string) => {
      addNotification(message, 'error', details);
    },
    [addNotification]
  );

  const showWarning = useCallback(
    (message: string, details?: string) => {
      addNotification(message, 'warning', details);
    },
    [addNotification]
  );

  const showInfo = useCallback(
    (message: string, details?: string) => {
      addNotification(message, 'info', details);
    },
    [addNotification]
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, dismissed: true } : n)));

    // Remove from list after animation
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 300);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const value: ErrorContextValue = {
    notifications,
    showError,
    showWarning,
    showInfo,
    dismissNotification,
    clearNotifications,
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
      <NotificationContainer notifications={notifications} onDismiss={dismissNotification} />
    </ErrorContext.Provider>
  );
}

// ============================================================================
// NOTIFICATION CONTAINER
// ============================================================================

interface NotificationContainerProps {
  notifications: ErrorNotification[];
  onDismiss: (id: string) => void;
}

function NotificationContainer({ notifications, onDismiss }: NotificationContainerProps) {
  const visibleNotifications = notifications.filter((n) => !n.dismissed);

  if (visibleNotifications.length === 0) {
    return null;
  }

  const containerStyle: CSSProperties = {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: 10001,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxWidth: '400px',
  };

  return (
    <div className="docx-notification-container" style={containerStyle}>
      {visibleNotifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={() => onDismiss(notification.id)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// NOTIFICATION TOAST
// ============================================================================

interface NotificationToastProps {
  notification: ErrorNotification;
  onDismiss: () => void;
}

function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getColors = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'error':
        return {
          bg: 'var(--doc-error-bg)',
          border: '#f5c6cb',
          text: 'var(--doc-error)',
          icon: 'var(--doc-error)',
        };
      case 'warning':
        return {
          bg: 'var(--doc-warning-bg)',
          border: '#ffeeba',
          text: '#856404',
          icon: 'var(--doc-warning)',
        };
      case 'info':
        return { bg: '#e8f4fd', border: '#b8daff', text: '#0c5460', icon: 'var(--doc-primary)' };
    }
  };

  const colors = getColors(notification.severity);

  const toastStyle: CSSProperties = {
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    padding: '12px 16px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    animation: 'slideIn 0.3s ease-out',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  };

  const iconStyle: CSSProperties = {
    color: colors.icon,
    flexShrink: 0,
  };

  const contentStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const messageStyle: CSSProperties = {
    color: colors.text,
    fontSize: '14px',
    fontWeight: 500,
    wordBreak: 'break-word',
  };

  const detailsStyle: CSSProperties = {
    marginTop: '8px',
    padding: '8px',
    background: 'rgba(0, 0, 0, 0.05)',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: colors.text,
    maxHeight: '200px',
    overflow: 'auto',
  };

  const buttonStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.text,
  };

  const getIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'error':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M10 6v5M10 13v1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 3L18 17H2L10 3z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M10 8v4M10 14v1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );
      case 'info':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M10 9v5M10 6v1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );
    }
  };

  return (
    <div
      className={`docx-notification-toast docx-notification-${notification.severity}`}
      style={toastStyle}
    >
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}
      </style>
      <div style={headerStyle}>
        <span style={iconStyle}>{getIcon(notification.severity)}</span>
        <div style={contentStyle}>
          <div style={messageStyle}>{notification.message}</div>
          {notification.details && (
            <>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                  ...buttonStyle,
                  marginTop: '4px',
                  fontSize: '12px',
                  padding: '2px 8px',
                }}
              >
                {isExpanded ? 'Hide details' : 'Show details'}
              </button>
              {isExpanded && <div style={detailsStyle}>{notification.details}</div>}
            </>
          )}
        </div>
        <button type="button" onClick={onDismiss} style={buttonStyle} title="Dismiss">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

/**
 * Error Boundary class component
 *
 * Catches render errors in child components and displays fallback UI.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
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

    // Log error
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { fallback, showDetails = true } = this.props;
      const { error, errorInfo } = this.state;

      // Custom fallback
      if (fallback) {
        if (typeof fallback === 'function') {
          return fallback(error!, this.resetError);
        }
        return fallback;
      }

      // Default fallback UI
      return (
        <DefaultErrorFallback
          error={error!}
          errorInfo={errorInfo}
          showDetails={showDetails}
          onReset={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// DEFAULT ERROR FALLBACK
// ============================================================================

interface DefaultErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  onReset: () => void;
}

function DefaultErrorFallback({
  error,
  errorInfo,
  showDetails,
  onReset,
}: DefaultErrorFallbackProps): React.ReactElement {
  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    textAlign: 'center',
    minHeight: '200px',
    background: 'white',
    borderRadius: '8px',
    border: '1px solid var(--doc-border)',
    margin: '20px',
  };

  const iconStyle: CSSProperties = {
    color: 'var(--doc-error)',
    marginBottom: '16px',
  };

  const titleStyle: CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--doc-text)',
    marginBottom: '8px',
  };

  const messageStyle: CSSProperties = {
    fontSize: '14px',
    color: 'var(--doc-text-muted)',
    marginBottom: '16px',
    maxWidth: '400px',
  };

  const detailsStyle: CSSProperties = {
    width: '100%',
    maxWidth: '600px',
    marginBottom: '16px',
    padding: '12px',
    background: 'var(--doc-error-bg)',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    textAlign: 'left',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '200px',
    overflow: 'auto',
  };

  const buttonStyle: CSSProperties = {
    padding: '10px 20px',
    background: 'var(--doc-primary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
  };

  return (
    <div className="docx-error-fallback" style={containerStyle}>
      <div style={iconStyle}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" />
          <path d="M24 14v12M24 30v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <h2 style={titleStyle}>Something went wrong</h2>
      <p style={messageStyle}>
        An error occurred while rendering this component. Please try again or contact support if the
        problem persists.
      </p>
      {showDetails && (
        <div style={detailsStyle}>
          <strong>Error:</strong> {error.message}
          {errorInfo && (
            <>
              {'\n\n'}
              <strong>Component Stack:</strong>
              {errorInfo.componentStack}
            </>
          )}
        </div>
      )}
      <button type="button" onClick={onReset} style={buttonStyle}>
        Try Again
      </button>
    </div>
  );
}

// ============================================================================
// PARSE ERROR DISPLAY
// ============================================================================

export interface ParseErrorDisplayProps {
  message: string;
  details?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Parse error display component
 *
 * Shows a helpful message for DOCX parsing errors.
 */
export function ParseErrorDisplay({
  message,
  details,
  onRetry,
  className = '',
}: ParseErrorDisplayProps): React.ReactElement {
  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    textAlign: 'center',
    background: 'white',
    borderRadius: '8px',
    border: '1px solid var(--doc-border-light)',
  };

  const iconStyle: CSSProperties = {
    color: 'var(--doc-error)',
    marginBottom: '16px',
  };

  const titleStyle: CSSProperties = {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--doc-text)',
    marginBottom: '8px',
  };

  const messageStyle: CSSProperties = {
    fontSize: '14px',
    color: 'var(--doc-text-muted)',
    marginBottom: '16px',
    maxWidth: '400px',
  };

  const detailsStyle: CSSProperties = {
    marginBottom: '16px',
    padding: '12px',
    background: 'var(--doc-bg)',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    maxWidth: '100%',
    overflow: 'auto',
    textAlign: 'left',
  };

  const buttonStyle: CSSProperties = {
    padding: '8px 16px',
    background: 'var(--doc-primary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
  };

  return (
    <div className={`docx-parse-error ${className}`} style={containerStyle}>
      <div style={iconStyle}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <path d="M10 10h20v20H10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path
            d="M25 10l-10 20M15 10l10 20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h3 style={titleStyle}>Unable to Parse Document</h3>
      <p style={messageStyle}>{message}</p>
      {details && <div style={detailsStyle}>{details}</div>}
      {onRetry && (
        <button type="button" onClick={onRetry} style={buttonStyle}>
          Try Again
        </button>
      )}
    </div>
  );
}

// ============================================================================
// UNSUPPORTED FEATURE WARNING
// ============================================================================

export interface UnsupportedFeatureWarningProps {
  feature: string;
  description?: string;
  className?: string;
}

/**
 * Unsupported feature warning component
 *
 * Shows a non-blocking warning for unsupported features.
 */
export function UnsupportedFeatureWarning({
  feature,
  description,
  className = '',
}: UnsupportedFeatureWarningProps): React.ReactElement {
  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'var(--doc-warning-bg)',
    border: '1px solid #ffeeba',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#856404',
  };

  const iconStyle: CSSProperties = {
    flexShrink: 0,
    color: 'var(--doc-warning)',
  };

  return (
    <div className={`docx-unsupported-warning ${className}`} style={containerStyle}>
      <span style={iconStyle}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 2l7 12H1L8 2z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M8 6v4M8 12v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <span>
        <strong>{feature}</strong>
        {description && `: ${description}`}
      </span>
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if an error is a parse error
 */
export function isParseError(error: Error): boolean {
  return (
    error.message.includes('parse') ||
    error.message.includes('Parse') ||
    error.message.includes('XML') ||
    error.message.includes('DOCX') ||
    error.message.includes('Invalid')
  );
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: Error): string {
  const message = error.message.toLowerCase();

  if (message.includes('network') || message.includes('fetch')) {
    return 'Network error. Please check your internet connection and try again.';
  }

  if (message.includes('parse') || message.includes('xml') || message.includes('invalid')) {
    return 'The document could not be parsed. It may be corrupted or in an unsupported format.';
  }

  if (message.includes('permission') || message.includes('access')) {
    return 'Access denied. You may not have permission to access this file.';
  }

  if (message.includes('not found') || message.includes('404')) {
    return 'The requested file was not found.';
  }

  if (message.includes('timeout')) {
    return 'The operation timed out. Please try again.';
  }

  return 'An unexpected error occurred. Please try again.';
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ErrorBoundary;
