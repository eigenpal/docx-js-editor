/**
 * Loading Indicator Component
 *
 * Displays loading states for operations with configurable appearance.
 * Features:
 * - Multiple spinner styles (spinner, dots, bar, pulse)
 * - Overlay mode for blocking UI during operations
 * - Inline mode for subtle loading indication
 * - Progress bar variant
 * - Hook for managing loading states
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Loading indicator variant
 */
export type LoadingVariant = 'spinner' | 'dots' | 'bar' | 'pulse' | 'progress';

/**
 * Loading indicator size
 */
export type LoadingSize = 'small' | 'medium' | 'large';

/**
 * Loading indicator props
 */
export interface LoadingIndicatorProps {
  /** Whether loading is active */
  isLoading: boolean;
  /** Variant of the loading indicator */
  variant?: LoadingVariant;
  /** Size of the indicator */
  size?: LoadingSize;
  /** Loading message to display */
  message?: string;
  /** Whether to show as full-screen overlay */
  overlay?: boolean;
  /** Overlay background opacity (0-1) */
  overlayOpacity?: number;
  /** Progress percentage (0-100) for progress variant */
  progress?: number;
  /** Show progress percentage text */
  showProgressText?: boolean;
  /** Custom color */
  color?: string;
  /** Additional className */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/**
 * Options for useLoading hook
 */
export interface UseLoadingOptions {
  /** Initial loading state */
  initialLoading?: boolean;
  /** Minimum loading duration in ms (prevents flash) */
  minDuration?: number;
  /** Callback when loading starts */
  onStart?: () => void;
  /** Callback when loading ends */
  onEnd?: () => void;
}

/**
 * Return value of useLoading hook
 */
export interface UseLoadingReturn {
  /** Current loading state */
  isLoading: boolean;
  /** Current message */
  message: string | null;
  /** Current progress (0-100) */
  progress: number;
  /** Start loading with optional message */
  startLoading: (message?: string) => void;
  /** Stop loading */
  stopLoading: () => void;
  /** Update progress (0-100) */
  setProgress: (progress: number) => void;
  /** Update message */
  setMessage: (message: string | null) => void;
  /** Wrap an async operation with loading state */
  withLoading: <T>(operation: () => Promise<T>, message?: string) => Promise<T>;
}

/**
 * Loading operation state
 */
export interface LoadingOperation {
  id: string;
  message?: string;
  progress?: number;
  startTime: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SIZE_CONFIG: Record<LoadingSize, { size: number; strokeWidth: number; fontSize: number }> = {
  small: { size: 16, strokeWidth: 2, fontSize: 11 },
  medium: { size: 32, strokeWidth: 3, fontSize: 13 },
  large: { size: 48, strokeWidth: 4, fontSize: 14 },
};

const DEFAULT_COLOR = '#1a73e8';
const MIN_LOADING_DURATION = 300; // Minimum ms to show loading to prevent flash

// ============================================================================
// KEYFRAMES STYLES
// ============================================================================

const spinnerKeyframes = `
@keyframes docx-loading-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes docx-loading-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.95); }
}

@keyframes docx-loading-dots {
  0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

@keyframes docx-loading-bar {
  0% { left: -35%; right: 100%; }
  60% { left: 100%; right: -90%; }
  100% { left: 100%; right: -90%; }
}
`;

// ============================================================================
// SPINNER VARIANTS
// ============================================================================

const SpinnerVariant: React.FC<{ size: number; strokeWidth: number; color: string }> = ({
  size,
  strokeWidth,
  color,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        animation: 'docx-loading-spin 1s linear infinite',
      }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${circumference * 0.75} ${circumference}`}
        opacity={0.25}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${circumference * 0.25} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
};

const DotsVariant: React.FC<{ size: number; color: string }> = ({ size, color }) => {
  const dotSize = size / 4;
  const gap = dotSize / 2;

  return (
    <div style={{ display: 'flex', gap: `${gap}px` }}>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: color,
            animation: `docx-loading-dots 1.4s ease-in-out ${index * 0.16}s infinite both`,
          }}
        />
      ))}
    </div>
  );
};

const BarVariant: React.FC<{ size: number; color: string }> = ({ size, color }) => {
  return (
    <div
      style={{
        width: size * 3,
        height: size / 4,
        backgroundColor: `${color}20`,
        borderRadius: size / 8,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: color,
          borderRadius: size / 8,
          animation: 'docx-loading-bar 2.1s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite',
        }}
      />
    </div>
  );
};

const PulseVariant: React.FC<{ size: number; color: string }> = ({ size, color }) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        animation: 'docx-loading-pulse 1.5s ease-in-out infinite',
      }}
    />
  );
};

const ProgressVariant: React.FC<{
  size: number;
  color: string;
  progress: number;
  showText: boolean;
  fontSize: number;
}> = ({ size, color, progress, showText, fontSize }) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div
      style={{
        width: size * 3,
        height: size / 4,
        backgroundColor: `${color}20`,
        borderRadius: size / 8,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: `${clampedProgress}%`,
          backgroundColor: color,
          borderRadius: size / 8,
          transition: 'width 0.3s ease',
        }}
      />
      {showText && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize,
            fontWeight: 500,
            color: clampedProgress > 50 ? '#fff' : color,
          }}
        >
          {Math.round(clampedProgress)}%
        </div>
      )}
    </div>
  );
};

// ============================================================================
// LOADING INDICATOR COMPONENT
// ============================================================================

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  isLoading,
  variant = 'spinner',
  size = 'medium',
  message,
  overlay = false,
  overlayOpacity = 0.5,
  progress = 0,
  showProgressText = true,
  color = DEFAULT_COLOR,
  className = '',
  style,
}) => {
  const sizeConfig = SIZE_CONFIG[size];

  // Inject keyframes
  useEffect(() => {
    const styleId = 'docx-loading-keyframes';
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = spinnerKeyframes;
      document.head.appendChild(styleElement);
    }
  }, []);

  if (!isLoading) return null;

  const renderVariant = () => {
    switch (variant) {
      case 'spinner':
        return (
          <SpinnerVariant
            size={sizeConfig.size}
            strokeWidth={sizeConfig.strokeWidth}
            color={color}
          />
        );
      case 'dots':
        return <DotsVariant size={sizeConfig.size} color={color} />;
      case 'bar':
        return <BarVariant size={sizeConfig.size} color={color} />;
      case 'pulse':
        return <PulseVariant size={sizeConfig.size} color={color} />;
      case 'progress':
        return (
          <ProgressVariant
            size={sizeConfig.size}
            color={color}
            progress={progress}
            showText={showProgressText}
            fontSize={sizeConfig.fontSize}
          />
        );
      default:
        return null;
    }
  };

  const content = (
    <div
      className={`docx-loading-content ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        ...style,
      }}
    >
      {renderVariant()}
      {message && (
        <div
          style={{
            fontSize: sizeConfig.fontSize,
            color: overlay ? '#fff' : '#5f6368',
            textAlign: 'center',
          }}
        >
          {message}
        </div>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div
        className={`docx-loading-overlay ${className}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})`,
          zIndex: 10000,
          ...style,
        }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={variant === 'progress' ? progress : undefined}
        aria-busy="true"
        aria-label={message || 'Loading'}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={`docx-loading-inline ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        ...style,
      }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={variant === 'progress' ? progress : undefined}
      aria-busy="true"
      aria-label={message || 'Loading'}
    >
      {content}
    </div>
  );
};

// ============================================================================
// USE LOADING HOOK
// ============================================================================

/**
 * Hook to manage loading states
 */
export function useLoading(options: UseLoadingOptions = {}): UseLoadingReturn {
  const { initialLoading = false, minDuration = MIN_LOADING_DURATION, onStart, onEnd } = options;

  const [isLoading, setIsLoading] = useState(initialLoading);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const startTimeRef = useRef<number | null>(null);
  const minDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Start loading
   */
  const startLoading = useCallback(
    (msg?: string) => {
      startTimeRef.current = Date.now();
      setIsLoading(true);
      setMessage(msg || null);
      setProgress(0);
      onStart?.();
    },
    [onStart]
  );

  /**
   * Stop loading (respects minimum duration)
   */
  const stopLoading = useCallback(() => {
    const startTime = startTimeRef.current;
    const now = Date.now();
    const elapsed = startTime ? now - startTime : 0;
    const remaining = Math.max(0, minDuration - elapsed);

    if (remaining > 0) {
      minDurationTimeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        setMessage(null);
        setProgress(0);
        startTimeRef.current = null;
        onEnd?.();
      }, remaining);
    } else {
      setIsLoading(false);
      setMessage(null);
      setProgress(0);
      startTimeRef.current = null;
      onEnd?.();
    }
  }, [minDuration, onEnd]);

  /**
   * Wrap an async operation with loading state
   */
  const withLoading = useCallback(
    async <T,>(operation: () => Promise<T>, msg?: string): Promise<T> => {
      startLoading(msg);
      try {
        const result = await operation();
        stopLoading();
        return result;
      } catch (error) {
        stopLoading();
        throw error;
      }
    },
    [startLoading, stopLoading]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (minDurationTimeoutRef.current) {
        clearTimeout(minDurationTimeoutRef.current);
      }
    };
  }, []);

  return {
    isLoading,
    message,
    progress,
    startLoading,
    stopLoading,
    setProgress,
    setMessage,
    withLoading,
  };
}

// ============================================================================
// MULTIPLE LOADING OPERATIONS HOOK
// ============================================================================

/**
 * Hook to manage multiple concurrent loading operations
 */
export function useLoadingOperations() {
  const [operations, setOperations] = useState<Map<string, LoadingOperation>>(new Map());

  const startOperation = useCallback((id: string, message?: string) => {
    setOperations((prev) => {
      const next = new Map(prev);
      next.set(id, {
        id,
        message,
        startTime: Date.now(),
      });
      return next;
    });
  }, []);

  const updateOperation = useCallback((id: string, updates: Partial<LoadingOperation>) => {
    setOperations((prev) => {
      const existing = prev.get(id);
      if (!existing) return prev;
      const next = new Map(prev);
      next.set(id, { ...existing, ...updates });
      return next;
    });
  }, []);

  const endOperation = useCallback((id: string) => {
    setOperations((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isAnyLoading = operations.size > 0;
  const activeOperations = Array.from(operations.values());

  return {
    operations: activeOperations,
    isAnyLoading,
    startOperation,
    updateOperation,
    endOperation,
    getOperation: (id: string) => operations.get(id),
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get loading variant label
 */
export function getLoadingVariantLabel(variant: LoadingVariant): string {
  const labels: Record<LoadingVariant, string> = {
    spinner: 'Spinner',
    dots: 'Dots',
    bar: 'Bar',
    pulse: 'Pulse',
    progress: 'Progress',
  };
  return labels[variant];
}

/**
 * Get all loading variants
 */
export function getAllLoadingVariants(): LoadingVariant[] {
  return ['spinner', 'dots', 'bar', 'pulse', 'progress'];
}

/**
 * Get all loading sizes
 */
export function getAllLoadingSizes(): LoadingSize[] {
  return ['small', 'medium', 'large'];
}

/**
 * Create a delay promise for testing loading states
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// EXPORTS
// ============================================================================

export default LoadingIndicator;
