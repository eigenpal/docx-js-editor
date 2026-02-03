/**
 * PageNumberIndicator Component
 *
 * Displays the current page number and total page count.
 * Can be used as a floating indicator or status bar element.
 */

import React, { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Position options for the indicator
 */
export type PageIndicatorPosition =
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'top-left'
  | 'top-center'
  | 'top-right';

/**
 * Style variant for the indicator
 */
export type PageIndicatorVariant = 'default' | 'minimal' | 'badge' | 'pill';

/**
 * Props for PageNumberIndicator
 */
export interface PageNumberIndicatorProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Position of the indicator (default: 'bottom-center') */
  position?: PageIndicatorPosition;
  /** Style variant (default: 'default') */
  variant?: PageIndicatorVariant;
  /** Whether to show as floating overlay (default: true) */
  floating?: boolean;
  /** Whether to show "Page" prefix (default: true) */
  showPrefix?: boolean;
  /** Custom format function for the display text */
  formatText?: (current: number, total: number) => string;
  /** Callback when page number is clicked (for navigation) */
  onClick?: () => void;
  /** Whether the indicator is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Custom content (overrides default display) */
  children?: ReactNode;
}

// ============================================================================
// STYLES
// ============================================================================

const BASE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: '13px',
  userSelect: 'none',
  transition: 'opacity 0.2s, transform 0.2s',
};

const FLOATING_STYLE: CSSProperties = {
  position: 'absolute',
  zIndex: 100,
  pointerEvents: 'auto',
};

const VARIANT_STYLES: Record<PageIndicatorVariant, CSSProperties> = {
  default: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    color: 'var(--doc-text)',
    padding: '6px 12px',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    border: '1px solid rgba(0, 0, 0, 0.1)',
  },
  minimal: {
    backgroundColor: 'transparent',
    color: 'var(--doc-text-muted)',
    padding: '4px 8px',
  },
  badge: {
    backgroundColor: 'var(--doc-primary)',
    color: 'white',
    padding: '4px 10px',
    borderRadius: '4px',
    fontWeight: 500,
    fontSize: '12px',
  },
  pill: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    padding: '6px 14px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: 500,
  },
};

const POSITION_STYLES: Record<PageIndicatorPosition, CSSProperties> = {
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

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PageNumberIndicator - Displays current page and total pages
 */
export function PageNumberIndicator({
  currentPage,
  totalPages,
  position = 'bottom-center',
  variant = 'default',
  floating = true,
  showPrefix = true,
  formatText,
  onClick,
  disabled = false,
  className = '',
  style,
  children,
}: PageNumberIndicatorProps): React.ReactElement {
  // Calculate display text
  const displayText = useMemo(() => {
    if (formatText) {
      return formatText(currentPage, totalPages);
    }
    if (showPrefix) {
      return `Page ${currentPage} of ${totalPages}`;
    }
    return `${currentPage} / ${totalPages}`;
  }, [currentPage, totalPages, formatText, showPrefix]);

  // Combine styles
  const combinedStyle: CSSProperties = {
    ...BASE_STYLE,
    ...VARIANT_STYLES[variant],
    ...(floating ? FLOATING_STYLE : {}),
    ...(floating ? POSITION_STYLES[position] : {}),
    ...(onClick && !disabled ? { cursor: 'pointer' } : {}),
    ...(disabled ? { opacity: 0.5, pointerEvents: 'none' } : {}),
    ...style,
  };

  // Handle click
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  return (
    <div
      className={`docx-page-indicator docx-page-indicator-${variant} ${className}`}
      style={combinedStyle}
      onClick={handleClick}
      role={onClick ? 'button' : 'status'}
      aria-label={`Page ${currentPage} of ${totalPages}`}
      aria-live="polite"
      tabIndex={onClick && !disabled ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && !disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {children || displayText}
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format page number with ordinal suffix (1st, 2nd, 3rd, etc.)
 */
export function formatPageOrdinal(page: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = page % 100;
  return page + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

/**
 * Create a custom format function
 */
export function createPageFormat(template: string): (current: number, total: number) => string {
  return (current: number, total: number) => {
    return template
      .replace('{current}', String(current))
      .replace('{total}', String(total))
      .replace('{ordinal}', formatPageOrdinal(current));
  };
}

/**
 * Get percentage progress through document
 */
export function getPageProgress(current: number, total: number): number {
  if (total <= 1) return 100;
  return Math.round(((current - 1) / (total - 1)) * 100);
}

/**
 * Check if at first page
 */
export function isFirstPage(current: number): boolean {
  return current === 1;
}

/**
 * Check if at last page
 */
export function isLastPage(current: number, total: number): boolean {
  return current === total;
}

/**
 * Calculate which page is visible given scroll position
 */
export function calculateVisiblePage(
  scrollTop: number,
  pageHeights: number[],
  pageGap: number = 20
): number {
  let accumulatedHeight = 0;

  for (let i = 0; i < pageHeights.length; i++) {
    const pageStart = accumulatedHeight;
    const pageEnd = accumulatedHeight + pageHeights[i];
    const pageMiddle = (pageStart + pageEnd) / 2;

    // Consider a page "visible" when its middle is in view
    if (scrollTop < pageMiddle) {
      return i + 1; // 1-indexed
    }

    accumulatedHeight = pageEnd + pageGap;
  }

  return pageHeights.length; // Return last page if scrolled past all
}

/**
 * Calculate scroll position to center a page
 */
export function calculateScrollToPage(
  pageNumber: number,
  pageHeights: number[],
  containerHeight: number,
  pageGap: number = 20
): number {
  if (pageNumber < 1 || pageNumber > pageHeights.length) {
    return 0;
  }

  let scrollTop = 0;

  for (let i = 0; i < pageNumber - 1; i++) {
    scrollTop += pageHeights[i] + pageGap;
  }

  // Center the page if possible
  const pageHeight = pageHeights[pageNumber - 1];
  const offset = Math.max(0, (containerHeight - pageHeight) / 2);

  return Math.max(0, scrollTop - offset);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default PageNumberIndicator;
