/**
 * Hyperlink Component
 *
 * Renders a clickable hyperlink with proper styling and behavior.
 * Handles both external links (opening in new tab) and internal
 * bookmark links (scrolling to target).
 *
 * Features:
 * - External links open in new tab with rel="noopener noreferrer"
 * - Internal bookmark links scroll to target element
 * - Tooltip display on hover
 * - Contains Run children for link text with formatting
 * - CSS classes for styling hooks
 */

import React, { useCallback } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import type { Hyperlink as HyperlinkType, Theme } from '../../types/document';
import { Run } from './Run';
import {
  isExternalLink,
  isInternalLink,
  getHyperlinkText,
  getHyperlinkUrl,
} from '../../docx/hyperlinkParser';

/**
 * Props for the Hyperlink component
 */
export interface HyperlinkProps {
  /** The hyperlink data to render */
  hyperlink: HyperlinkType;
  /** Theme for resolving colors and fonts */
  theme?: Theme | null;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Callback when an internal bookmark link is clicked */
  onBookmarkClick?: (bookmarkName: string) => void;
  /** Whether links are disabled/non-interactive */
  disabled?: boolean;
}

/**
 * Default hyperlink style (standard blue underlined link)
 */
const DEFAULT_LINK_STYLE: CSSProperties = {
  color: '#0563C1',
  textDecoration: 'underline',
  cursor: 'pointer',
};

/**
 * Style for disabled/non-interactive links
 */
const DISABLED_LINK_STYLE: CSSProperties = {
  color: '#0563C1',
  textDecoration: 'underline',
  cursor: 'default',
};

/**
 * Hyperlink component - renders clickable links
 *
 * External links (http://, mailto:, tel:, etc.) open in a new tab.
 * Internal bookmark links (#bookmark_name) trigger the onBookmarkClick callback
 * or attempt to scroll to the element with that ID.
 */
export function Hyperlink({
  hyperlink,
  theme,
  className,
  style: additionalStyle,
  onBookmarkClick,
  disabled = false,
}: HyperlinkProps): React.ReactElement {
  const href = getHyperlinkUrl(hyperlink);
  const isExternal = isExternalLink(hyperlink);
  const isInternal = isInternalLink(hyperlink);

  /**
   * Handle click for internal bookmark links
   */
  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (disabled) {
        e.preventDefault();
        return;
      }

      if (isInternal && hyperlink.anchor) {
        e.preventDefault();

        // Call the callback if provided
        if (onBookmarkClick) {
          onBookmarkClick(hyperlink.anchor);
        } else {
          // Default behavior: try to scroll to element with bookmark ID
          const targetId = hyperlink.anchor;
          const targetElement = document.getElementById(targetId);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
      // For external links, let the browser handle it (opens in new tab via target="_blank")
    },
    [disabled, isInternal, hyperlink.anchor, onBookmarkClick]
  );

  // Build class names
  const classNames: string[] = ['docx-hyperlink'];
  if (className) {
    classNames.push(className);
  }
  if (isExternal) {
    classNames.push('docx-hyperlink-external');
  }
  if (isInternal) {
    classNames.push('docx-hyperlink-internal');
  }
  if (disabled) {
    classNames.push('docx-hyperlink-disabled');
  }

  // Combine styles
  const baseStyle = disabled ? DISABLED_LINK_STYLE : DEFAULT_LINK_STYLE;
  const combinedStyle: CSSProperties = {
    ...baseStyle,
    ...additionalStyle,
  };

  // Render children (runs and bookmarks)
  const children = hyperlink.children.map((child, index) => {
    if (child.type === 'run') {
      return (
        <Run
          key={index}
          run={child}
          theme={theme}
          // Don't apply default link color to runs if they have their own color
          style={child.formatting?.color ? undefined : { color: 'inherit' }}
        />
      );
    }
    // BookmarkStart and BookmarkEnd are markers, not rendered visually
    if (child.type === 'bookmarkStart') {
      return (
        <span
          key={index}
          id={child.name}
          className="docx-bookmark-start"
          data-bookmark-id={child.id}
          data-bookmark-name={child.name}
        />
      );
    }
    if (child.type === 'bookmarkEnd') {
      return <span key={index} className="docx-bookmark-end" data-bookmark-id={child.id} />;
    }
    return null;
  });

  // Determine link attributes
  const linkProps: React.AnchorHTMLAttributes<HTMLAnchorElement> = {
    href: disabled ? undefined : href,
    className: classNames.join(' '),
    style: combinedStyle,
    onClick: handleClick,
  };

  // External links open in new tab with security attributes
  if (isExternal && !disabled) {
    linkProps.target = hyperlink.target || '_blank';
    linkProps.rel = 'noopener noreferrer';
  }

  // Add tooltip if present
  if (hyperlink.tooltip) {
    linkProps.title = hyperlink.tooltip;
  }

  // Add aria attributes for accessibility
  if (isExternal) {
    linkProps['aria-label'] = `${getHyperlinkText(hyperlink)} (opens in new tab)`;
  }

  return <a {...linkProps}>{children}</a>;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the display text of a hyperlink (re-exported from parser for convenience)
 */
export { getHyperlinkText };

/**
 * Get the resolved URL of a hyperlink (re-exported from parser for convenience)
 */
export { getHyperlinkUrl };

/**
 * Check if a hyperlink is external (re-exported from parser for convenience)
 */
export { isExternalLink };

/**
 * Check if a hyperlink is internal (re-exported from parser for convenience)
 */
export { isInternalLink };

/**
 * Check if a hyperlink has any visible content
 *
 * @param hyperlink - The hyperlink to check
 * @returns true if the hyperlink has child runs with content
 */
export function hasVisibleContent(hyperlink: HyperlinkType): boolean {
  return hyperlink.children.some((child) => {
    if (child.type === 'run') {
      return child.content.some((content) => {
        switch (content.type) {
          case 'text':
            return content.text.length > 0;
          case 'drawing':
          case 'shape':
          case 'symbol':
            return true;
          default:
            return false;
        }
      });
    }
    return false;
  });
}

/**
 * Get the bookmark name this hyperlink points to (if internal)
 *
 * @param hyperlink - The hyperlink to check
 * @returns Bookmark name or undefined
 */
export function getTargetBookmark(hyperlink: HyperlinkType): string | undefined {
  return hyperlink.anchor;
}

/**
 * Check if hyperlink is empty (no href and no anchor)
 *
 * @param hyperlink - The hyperlink to check
 * @returns true if the hyperlink has no destination
 */
export function isEmptyHyperlink(hyperlink: HyperlinkType): boolean {
  return !hyperlink.href && !hyperlink.anchor && !hyperlink.rId;
}

/**
 * Get all text content from hyperlink for search/accessibility
 *
 * @param hyperlink - The hyperlink to extract text from
 * @returns Plain text content
 */
export function getHyperlinkAccessibleText(hyperlink: HyperlinkType): string {
  const text = getHyperlinkText(hyperlink);
  const url = getHyperlinkUrl(hyperlink);

  if (isExternalLink(hyperlink)) {
    return `${text} (link to ${url})`;
  }
  if (isInternalLink(hyperlink)) {
    return `${text} (link to section ${hyperlink.anchor})`;
  }
  return text;
}

export default Hyperlink;
