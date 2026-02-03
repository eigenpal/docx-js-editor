/**
 * Unsaved Changes Indicator Component
 *
 * Visual indicator that shows when document has unsaved changes.
 * Features:
 * - Configurable appearance (dot, badge, text)
 * - Pulse animation option for visibility
 * - Hook for tracking changes
 * - Browser beforeunload warning
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Document } from '../../types/document';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Indicator variant type
 */
export type IndicatorVariant = 'dot' | 'badge' | 'text' | 'icon';

/**
 * Indicator position type
 */
export type IndicatorPosition = 'inline' | 'absolute-top-right' | 'absolute-top-left';

/**
 * Unsaved indicator props
 */
export interface UnsavedIndicatorProps {
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Variant of the indicator */
  variant?: IndicatorVariant;
  /** Position of the indicator */
  position?: IndicatorPosition;
  /** Whether to show pulse animation */
  showPulse?: boolean;
  /** Custom label for text variant */
  label?: string;
  /** Custom saved label for text variant */
  savedLabel?: string;
  /** Whether to show indicator when saved (always show) */
  showWhenSaved?: boolean;
  /** Custom color for unsaved state */
  unsavedColor?: string;
  /** Custom color for saved state */
  savedColor?: string;
  /** Size in pixels (for dot/icon) */
  size?: number;
  /** Additional className */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Click handler */
  onClick?: () => void;
  /** Title/tooltip text */
  title?: string;
}

/**
 * Hook options for tracking unsaved changes
 */
export interface UseUnsavedChangesOptions {
  /** The document to track */
  document?: Document | null;
  /** Whether to warn before leaving page */
  warnBeforeLeave?: boolean;
  /** Custom warning message */
  warningMessage?: string;
  /** Whether tracking is enabled */
  enabled?: boolean;
  /** Callback when changes status changes */
  onChangeStatusChange?: (hasChanges: boolean) => void;
}

/**
 * Hook return value
 */
export interface UseUnsavedChangesReturn {
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Mark the document as saved (resets change tracking) */
  markAsSaved: () => void;
  /** Mark the document as changed */
  markAsChanged: () => void;
  /** Reset tracking (resets baseline) */
  resetTracking: (newDocument?: Document | null) => void;
  /** The last saved document snapshot */
  lastSavedDocument: Document | null;
  /** Number of changes since last save */
  changeCount: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_UNSAVED_COLOR = 'var(--doc-error)'; // Unsaved state
const DEFAULT_SAVED_COLOR = 'var(--doc-success)'; // Saved state
const DEFAULT_WARNING_MESSAGE = 'You have unsaved changes. Are you sure you want to leave?';

// ============================================================================
// ICONS
// ============================================================================

const SaveIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 2h8l2 2v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5 2v4h5V2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5 14v-4h6v4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const UnsavedIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="8" cy="11" r="0.5" fill="currentColor" />
  </svg>
);

// ============================================================================
// STYLES
// ============================================================================

const pulseKeyframes = `
@keyframes docx-unsaved-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
`;

const getIndicatorStyles = (
  variant: IndicatorVariant,
  position: IndicatorPosition,
  hasUnsavedChanges: boolean,
  showPulse: boolean,
  unsavedColor: string,
  savedColor: string,
  size: number
): React.CSSProperties => {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    animation:
      hasUnsavedChanges && showPulse ? 'docx-unsaved-pulse 2s ease-in-out infinite' : 'none',
  };

  // Position styles
  if (position === 'absolute-top-right') {
    baseStyles.position = 'absolute';
    baseStyles.top = '4px';
    baseStyles.right = '4px';
  } else if (position === 'absolute-top-left') {
    baseStyles.position = 'absolute';
    baseStyles.top = '4px';
    baseStyles.left = '4px';
  }

  // Variant-specific styles
  switch (variant) {
    case 'dot':
      return {
        ...baseStyles,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundColor: hasUnsavedChanges ? unsavedColor : savedColor,
      };

    case 'badge':
      return {
        ...baseStyles,
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '11px',
        fontWeight: 500,
        backgroundColor: hasUnsavedChanges ? unsavedColor : savedColor,
        color: 'white',
      };

    case 'text':
      return {
        ...baseStyles,
        fontSize: '12px',
        color: hasUnsavedChanges ? unsavedColor : savedColor,
        fontWeight: 500,
      };

    case 'icon':
      return {
        ...baseStyles,
        color: hasUnsavedChanges ? unsavedColor : savedColor,
      };

    default:
      return baseStyles;
  }
};

// ============================================================================
// UNSAVED INDICATOR COMPONENT
// ============================================================================

export const UnsavedIndicator: React.FC<UnsavedIndicatorProps> = ({
  hasUnsavedChanges,
  variant = 'dot',
  position = 'inline',
  showPulse = true,
  label = 'Unsaved',
  savedLabel = 'Saved',
  showWhenSaved = false,
  unsavedColor = DEFAULT_UNSAVED_COLOR,
  savedColor = DEFAULT_SAVED_COLOR,
  size = 8,
  className = '',
  style,
  onClick,
  title,
}) => {
  // Inject keyframes if pulse is enabled - must be before early return
  useEffect(() => {
    if (!showPulse || !hasUnsavedChanges) return;

    const styleId = 'docx-unsaved-pulse-keyframes';
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = pulseKeyframes;
      document.head.appendChild(styleElement);
    }
  }, [showPulse, hasUnsavedChanges]);

  // Don't render if saved and showWhenSaved is false
  if (!hasUnsavedChanges && !showWhenSaved) {
    return null;
  }

  const indicatorStyles = getIndicatorStyles(
    variant,
    position,
    hasUnsavedChanges,
    showPulse,
    unsavedColor,
    savedColor,
    size
  );

  const combinedStyles: React.CSSProperties = {
    ...indicatorStyles,
    ...style,
    cursor: onClick ? 'pointer' : undefined,
  };

  const defaultTitle = hasUnsavedChanges ? 'Document has unsaved changes' : 'All changes saved';

  const renderContent = () => {
    switch (variant) {
      case 'dot':
        return null; // Just the styled element

      case 'badge':
        return hasUnsavedChanges ? label : savedLabel;

      case 'text':
        return hasUnsavedChanges ? label : savedLabel;

      case 'icon':
        return hasUnsavedChanges ? <UnsavedIcon size={size} /> : <SaveIcon size={size} />;

      default:
        return null;
    }
  };

  return (
    <span
      className={`docx-unsaved-indicator docx-unsaved-indicator-${variant} ${hasUnsavedChanges ? 'docx-unsaved' : 'docx-saved'} ${className}`}
      style={combinedStyles}
      onClick={onClick}
      title={title ?? defaultTitle}
      role={onClick ? 'button' : 'status'}
      aria-label={hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'}
    >
      {renderContent()}
    </span>
  );
};

// ============================================================================
// USE UNSAVED CHANGES HOOK
// ============================================================================

/**
 * Hook to track unsaved changes in a document
 */
export function useUnsavedChanges(options: UseUnsavedChangesOptions = {}): UseUnsavedChangesReturn {
  const {
    document: currentDocument,
    warnBeforeLeave = true,
    warningMessage = DEFAULT_WARNING_MESSAGE,
    enabled = true,
    onChangeStatusChange,
  } = options;

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [changeCount, setChangeCount] = useState(0);
  const [lastSavedDocument, setLastSavedDocument] = useState<Document | null>(null);
  const previousDocumentRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  /**
   * Serialize document for comparison
   * Uses JSON stringify for deep comparison
   */
  const serializeDocument = useCallback((doc: Document | null | undefined): string | null => {
    if (!doc) return null;
    try {
      // Serialize only the package content for comparison, excluding buffer
      return JSON.stringify(doc.package);
    } catch {
      return null;
    }
  }, []);

  /**
   * Mark document as saved
   */
  const markAsSaved = useCallback(() => {
    if (!enabled) return;

    setHasUnsavedChanges(false);
    setChangeCount(0);
    setLastSavedDocument(currentDocument ?? null);
    previousDocumentRef.current = serializeDocument(currentDocument);
  }, [enabled, currentDocument, serializeDocument]);

  /**
   * Mark document as changed
   */
  const markAsChanged = useCallback(() => {
    if (!enabled) return;

    if (!hasUnsavedChanges) {
      setHasUnsavedChanges(true);
      onChangeStatusChange?.(true);
    }
    setChangeCount((prev) => prev + 1);
  }, [enabled, hasUnsavedChanges, onChangeStatusChange]);

  /**
   * Reset tracking with optional new document
   */
  const resetTracking = useCallback(
    (newDocument?: Document | null) => {
      const docToUse = newDocument !== undefined ? newDocument : currentDocument;
      setHasUnsavedChanges(false);
      setChangeCount(0);
      setLastSavedDocument(docToUse ?? null);
      previousDocumentRef.current = serializeDocument(docToUse);
      initializedRef.current = true;
    },
    [currentDocument, serializeDocument]
  );

  // Initialize on first document
  useEffect(() => {
    if (!enabled || !currentDocument || initializedRef.current) return;
    resetTracking(currentDocument);
  }, [enabled, currentDocument, resetTracking]);

  // Track document changes
  useEffect(() => {
    if (!enabled || !currentDocument || !initializedRef.current) return;

    const currentSerialized = serializeDocument(currentDocument);
    const previousSerialized = previousDocumentRef.current;

    // If document content changed
    if (currentSerialized !== previousSerialized) {
      // Check if it's different from last saved state
      const lastSavedSerialized = serializeDocument(lastSavedDocument);

      if (currentSerialized !== lastSavedSerialized) {
        if (!hasUnsavedChanges) {
          setHasUnsavedChanges(true);
          onChangeStatusChange?.(true);
        }
        setChangeCount((prev) => prev + 1);
      } else {
        // Document matches saved state
        if (hasUnsavedChanges) {
          setHasUnsavedChanges(false);
          onChangeStatusChange?.(false);
        }
      }

      previousDocumentRef.current = currentSerialized;
    }
  }, [
    enabled,
    currentDocument,
    lastSavedDocument,
    hasUnsavedChanges,
    serializeDocument,
    onChangeStatusChange,
  ]);

  // Warn before leaving page
  useEffect(() => {
    if (!enabled || !warnBeforeLeave || !hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = warningMessage;
      return warningMessage;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, warnBeforeLeave, hasUnsavedChanges, warningMessage]);

  return {
    hasUnsavedChanges,
    markAsSaved,
    markAsChanged,
    resetTracking,
    lastSavedDocument,
    changeCount,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get indicator variant label
 */
export function getVariantLabel(variant: IndicatorVariant): string {
  const labels: Record<IndicatorVariant, string> = {
    dot: 'Dot',
    badge: 'Badge',
    text: 'Text',
    icon: 'Icon',
  };
  return labels[variant];
}

/**
 * Get all indicator variants
 */
export function getAllVariants(): IndicatorVariant[] {
  return ['dot', 'badge', 'text', 'icon'];
}

/**
 * Get all indicator positions
 */
export function getAllPositions(): IndicatorPosition[] {
  return ['inline', 'absolute-top-right', 'absolute-top-left'];
}

/**
 * Create a document change tracker
 * Simple utility for external change tracking
 */
export function createChangeTracker() {
  let changeCount = 0;
  let lastSaveTime: Date | null = null;
  let hasUnsavedChanges = false;

  return {
    markChanged: () => {
      changeCount++;
      hasUnsavedChanges = true;
    },
    markSaved: () => {
      hasUnsavedChanges = false;
      lastSaveTime = new Date();
    },
    getState: () => ({
      changeCount,
      lastSaveTime,
      hasUnsavedChanges,
    }),
    reset: () => {
      changeCount = 0;
      lastSaveTime = null;
      hasUnsavedChanges = false;
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default UnsavedIndicator;
