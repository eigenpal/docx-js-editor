/**
 * PageNavigator Component
 *
 * Provides UI for navigating between pages in a paginated document.
 * Includes:
 * - Previous/Next page buttons
 * - Current page display (clickable to show input)
 * - Page number input for direct navigation
 * - Keyboard navigation support
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { CSSProperties } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Position options for the navigator
 */
export type PageNavigatorPosition =
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'top-left'
  | 'top-center'
  | 'top-right';

/**
 * Style variant for the navigator
 */
export type PageNavigatorVariant = 'default' | 'compact' | 'minimal';

/**
 * Props for PageNavigator
 */
export interface PageNavigatorProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Callback when page navigation is requested */
  onNavigate: (pageNumber: number) => void;
  /** Position of the navigator (default: 'bottom-center') */
  position?: PageNavigatorPosition;
  /** Style variant (default: 'default') */
  variant?: PageNavigatorVariant;
  /** Whether to show as floating overlay (default: true) */
  floating?: boolean;
  /** Whether to show previous/next buttons (default: true) */
  showButtons?: boolean;
  /** Whether the navigator is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
}

/**
 * Props for the page input popover
 */
interface PageInputPopoverProps {
  currentPage: number;
  totalPages: number;
  onNavigate: (pageNumber: number) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

// ============================================================================
// ICONS
// ============================================================================

function ChevronLeftIcon(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ChevronUpIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDownIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const BASE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: '13px',
  userSelect: 'none',
  transition: 'opacity 0.2s',
};

const FLOATING_STYLE: CSSProperties = {
  position: 'absolute',
  zIndex: 100,
  pointerEvents: 'auto',
};

const VARIANT_STYLES: Record<PageNavigatorVariant, CSSProperties> = {
  default: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    color: 'var(--doc-text)',
    padding: '4px 8px',
    borderRadius: '6px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    border: '1px solid rgba(0, 0, 0, 0.1)',
  },
  compact: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    color: 'var(--doc-text)',
    padding: '2px 4px',
    borderRadius: '4px',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.1)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    fontSize: '12px',
  },
  minimal: {
    backgroundColor: 'transparent',
    color: 'var(--doc-text-muted)',
    padding: '4px',
  },
};

const POSITION_STYLES: Record<PageNavigatorPosition, CSSProperties> = {
  'bottom-left': {
    bottom: '16px',
    left: '16px',
  },
  'bottom-center': {
    bottom: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
  },
  'bottom-right': {
    bottom: '16px',
    right: '16px',
  },
  'top-left': {
    top: '16px',
    left: '16px',
  },
  'top-center': {
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
  },
  'top-right': {
    top: '16px',
    right: '16px',
  },
};

const BUTTON_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  padding: 0,
  border: 'none',
  borderRadius: '4px',
  backgroundColor: 'transparent',
  color: 'var(--doc-text-muted)',
  cursor: 'pointer',
  transition: 'background-color 0.15s, color 0.15s',
};

const BUTTON_HOVER_STYLE: CSSProperties = {
  backgroundColor: 'var(--doc-bg-hover)',
  color: 'var(--doc-text)',
};

const BUTTON_DISABLED_STYLE: CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

const PAGE_DISPLAY_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 8px',
  borderRadius: '4px',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  transition: 'background-color 0.15s',
  minWidth: '80px',
  justifyContent: 'center',
};

const PAGE_DISPLAY_HOVER_STYLE: CSSProperties = {
  backgroundColor: 'rgba(0, 0, 0, 0.04)',
};

// ============================================================================
// PAGE INPUT POPOVER
// ============================================================================

/**
 * Popover with page number input
 */
function PageInputPopover({
  currentPage,
  totalPages,
  onNavigate,
  onClose,
  anchorRef,
}: PageInputPopoverProps): React.ReactElement {
  const [inputValue, setInputValue] = useState(String(currentPage));
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, anchorRef]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Validate and navigate
  const handleSubmit = useCallback(() => {
    const pageNum = parseInt(inputValue, 10);

    if (isNaN(pageNum)) {
      setError('Please enter a number');
      return;
    }

    if (pageNum < 1 || pageNum > totalPages) {
      setError(`Page must be 1-${totalPages}`);
      return;
    }

    onNavigate(pageNum);
    onClose();
  }, [inputValue, totalPages, onNavigate, onClose]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setError(null);
  };

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newValue = Math.min(parseInt(inputValue, 10) + 1 || 1, totalPages);
      setInputValue(String(newValue));
      setError(null);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newValue = Math.max(parseInt(inputValue, 10) - 1 || 1, 1);
      setInputValue(String(newValue));
      setError(null);
    }
  };

  // Quick navigation buttons
  const handleFirst = () => {
    onNavigate(1);
    onClose();
  };

  const handleLast = () => {
    onNavigate(totalPages);
    onClose();
  };

  const popoverStyle: CSSProperties = {
    position: 'absolute',
    bottom: 'calc(100% + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    padding: '12px',
    minWidth: '200px',
    zIndex: 1000,
  };

  const inputContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: error ? '4px' : '12px',
  };

  const inputStyle: CSSProperties = {
    flex: 1,
    padding: '8px 12px',
    fontSize: '14px',
    border: error ? '1px solid var(--doc-error)' : '1px solid var(--doc-border)',
    borderRadius: '4px',
    outline: 'none',
    textAlign: 'center',
    fontFamily: 'inherit',
  };

  const goButtonStyle: CSSProperties = {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: 'var(--doc-primary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  };

  const errorStyle: CSSProperties = {
    color: 'var(--doc-error)',
    fontSize: '12px',
    marginBottom: '8px',
  };

  const quickNavStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
  };

  const quickButtonStyle: CSSProperties = {
    flex: 1,
    padding: '6px 12px',
    fontSize: '12px',
    backgroundColor: 'var(--doc-bg-muted)',
    color: 'var(--doc-text)',
    border: '1px solid var(--doc-border-light)',
    borderRadius: '4px',
    cursor: 'pointer',
  };

  return (
    <div ref={popoverRef} style={popoverStyle} role="dialog" aria-label="Go to page">
      <div
        style={{
          fontSize: '12px',
          color: 'var(--doc-text-muted)',
          marginBottom: '8px',
          textAlign: 'center',
        }}
      >
        Go to page (1-{totalPages})
      </div>

      <div style={inputContainerStyle}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          style={inputStyle}
          aria-label="Page number"
          aria-invalid={!!error}
        />
        <button onClick={handleSubmit} style={goButtonStyle} type="button">
          Go
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={quickNavStyle}>
        <button
          onClick={handleFirst}
          style={quickButtonStyle}
          disabled={currentPage === 1}
          type="button"
        >
          First
        </button>
        <button
          onClick={handleLast}
          style={quickButtonStyle}
          disabled={currentPage === totalPages}
          type="button"
        >
          Last
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * PageNavigator - Navigation controls for paginated documents
 */
export function PageNavigator({
  currentPage,
  totalPages,
  onNavigate,
  position = 'bottom-center',
  variant = 'default',
  floating = true,
  showButtons = true,
  disabled = false,
  className = '',
  style,
}: PageNavigatorProps): React.ReactElement {
  const [showPopover, setShowPopover] = useState(false);
  const [prevHovered, setPrevHovered] = useState(false);
  const [nextHovered, setNextHovered] = useState(false);
  const [displayHovered, setDisplayHovered] = useState(false);
  const pageDisplayRef = useRef<HTMLButtonElement>(null);

  // Check if navigation is possible
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  // Handle previous page
  const handlePrev = useCallback(() => {
    if (canGoPrev && !disabled) {
      onNavigate(currentPage - 1);
    }
  }, [canGoPrev, disabled, currentPage, onNavigate]);

  // Handle next page
  const handleNext = useCallback(() => {
    if (canGoNext && !disabled) {
      onNavigate(currentPage + 1);
    }
  }, [canGoNext, disabled, currentPage, onNavigate]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Home') {
        e.preventDefault();
        onNavigate(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        onNavigate(totalPages);
      }
    },
    [disabled, handlePrev, handleNext, onNavigate, totalPages]
  );

  // Toggle popover
  const togglePopover = useCallback(() => {
    if (!disabled) {
      setShowPopover((prev) => !prev);
    }
  }, [disabled]);

  // Close popover
  const closePopover = useCallback(() => {
    setShowPopover(false);
  }, []);

  // Handle navigation from popover
  const handlePopoverNavigate = useCallback(
    (pageNumber: number) => {
      onNavigate(pageNumber);
      closePopover();
    },
    [onNavigate, closePopover]
  );

  // Combine styles
  const combinedStyle: CSSProperties = {
    ...BASE_STYLE,
    ...VARIANT_STYLES[variant],
    ...(floating ? FLOATING_STYLE : {}),
    ...(floating ? POSITION_STYLES[position] : {}),
    ...(disabled ? { opacity: 0.5, pointerEvents: 'none' } : {}),
    ...style,
  };

  const prevButtonStyle: CSSProperties = {
    ...BUTTON_STYLE,
    ...(variant === 'compact' ? { width: '24px', height: '24px' } : {}),
    ...(prevHovered && canGoPrev ? BUTTON_HOVER_STYLE : {}),
    ...(!canGoPrev ? BUTTON_DISABLED_STYLE : {}),
  };

  const nextButtonStyle: CSSProperties = {
    ...BUTTON_STYLE,
    ...(variant === 'compact' ? { width: '24px', height: '24px' } : {}),
    ...(nextHovered && canGoNext ? BUTTON_HOVER_STYLE : {}),
    ...(!canGoNext ? BUTTON_DISABLED_STYLE : {}),
  };

  const pageDisplayStyleCombined: CSSProperties = {
    ...PAGE_DISPLAY_STYLE,
    ...(variant === 'compact' ? { padding: '2px 6px', minWidth: '60px' } : {}),
    ...(displayHovered && !disabled ? PAGE_DISPLAY_HOVER_STYLE : {}),
    ...(disabled ? { cursor: 'not-allowed' } : {}),
  };

  return (
    <div
      className={`docx-page-navigator docx-page-navigator-${variant} ${className}`}
      style={combinedStyle}
      role="navigation"
      aria-label="Page navigation"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Previous button */}
      {showButtons && (
        <button
          onClick={handlePrev}
          disabled={!canGoPrev || disabled}
          style={prevButtonStyle}
          onMouseEnter={() => setPrevHovered(true)}
          onMouseLeave={() => setPrevHovered(false)}
          aria-label="Previous page"
          title="Previous page (←)"
          type="button"
        >
          <ChevronLeftIcon />
        </button>
      )}

      {/* Page display / toggle popover */}
      <div style={{ position: 'relative' }}>
        <button
          ref={pageDisplayRef}
          onClick={togglePopover}
          style={pageDisplayStyleCombined}
          onMouseEnter={() => setDisplayHovered(true)}
          onMouseLeave={() => setDisplayHovered(false)}
          aria-haspopup="dialog"
          aria-expanded={showPopover}
          aria-label={`Page ${currentPage} of ${totalPages}. Click to go to a specific page.`}
          title="Click to go to a specific page"
          disabled={disabled}
          type="button"
        >
          <span>
            Page <strong>{currentPage}</strong> of {totalPages}
          </span>
          {showPopover ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </button>

        {/* Page input popover */}
        {showPopover && (
          <PageInputPopover
            currentPage={currentPage}
            totalPages={totalPages}
            onNavigate={handlePopoverNavigate}
            onClose={closePopover}
            anchorRef={pageDisplayRef}
          />
        )}
      </div>

      {/* Next button */}
      {showButtons && (
        <button
          onClick={handleNext}
          disabled={!canGoNext || disabled}
          style={nextButtonStyle}
          onMouseEnter={() => setNextHovered(true)}
          onMouseLeave={() => setNextHovered(false)}
          aria-label="Next page"
          title="Next page (→)"
          type="button"
        >
          <ChevronRightIcon />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate page number from keyboard input
 */
export function parsePageInput(input: string): number | null {
  const trimmed = input.trim();
  const num = parseInt(trimmed, 10);
  return isNaN(num) ? null : num;
}

/**
 * Validate page number
 */
export function isValidPageNumber(page: number, totalPages: number): boolean {
  return Number.isInteger(page) && page >= 1 && page <= totalPages;
}

/**
 * Clamp page number to valid range
 */
export function clampPageNumber(page: number, totalPages: number): number {
  return Math.min(Math.max(1, Math.round(page)), totalPages);
}

/**
 * Get navigation info for keyboard shortcuts
 */
export function getNavigationShortcuts(): Array<{ key: string; description: string }> {
  return [
    { key: '← or PageUp', description: 'Previous page' },
    { key: '→ or PageDown', description: 'Next page' },
    { key: 'Home', description: 'First page' },
    { key: 'End', description: 'Last page' },
    { key: 'Enter (in input)', description: 'Go to page' },
  ];
}

/**
 * Format page range for display
 */
export function formatPageRange(start: number, end: number, total: number): string {
  if (start === end) {
    return `Page ${start} of ${total}`;
  }
  return `Pages ${start}-${end} of ${total}`;
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(current: number, total: number): number {
  if (total <= 1) return 100;
  return Math.round(((current - 1) / (total - 1)) * 100);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default PageNavigator;
