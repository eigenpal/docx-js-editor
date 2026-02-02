/**
 * Tab Component
 *
 * Renders tab characters with proper spacing based on tab stop definitions.
 * Handles:
 * - Tab width calculation based on current position and tab stops
 * - Leader characters (dots, dashes, underscores)
 * - Tab alignment (left, center, right, decimal)
 * - Default tab stops when no explicit stops defined
 */

import React from 'react';
import type { CSSProperties } from 'react';
import type { TabStop, TabLeader, TabStopAlignment } from '../../types/document';
import { twipsToPixels } from '../../utils/units';
import {
  getNextTabStop,
  calculateTabWidth,
  getLeaderCharacter,
  hasVisibleLeader,
  DEFAULT_TAB_INTERVAL_TWIPS,
} from '../../docx/tabParser';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default page width in twips (8.5 inches - 1 inch margins on each side = 6.5 inches)
 */
const DEFAULT_PAGE_WIDTH_TWIPS = 6.5 * 1440;

/**
 * Approximate character width in pixels for leader calculation
 */
const APPROX_CHAR_WIDTH_PX = 8;

/**
 * Minimum tab width in pixels to ensure some spacing
 */
const MIN_TAB_WIDTH_PX = 8;

// ============================================================================
// PROPS
// ============================================================================

/**
 * Props for the Tab component
 */
export interface TabProps {
  /** Current horizontal position in twips from left margin */
  currentPosition?: number;
  /** Defined tab stops for this paragraph */
  tabStops?: TabStop[];
  /** Page content width in twips */
  pageWidth?: number;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Index for key generation when rendering multiple tabs */
  index?: number;
}

/**
 * Result of tab rendering calculation
 */
export interface TabRenderInfo {
  /** Width of the tab in pixels */
  width: number;
  /** Tab stop alignment */
  alignment: TabStopAlignment;
  /** Leader character if any */
  leader: TabLeader | undefined;
  /** Position of the tab stop in twips */
  tabStopPosition: number;
  /** Whether the tab has a visible leader */
  hasLeader: boolean;
  /** Leader string to display */
  leaderString: string;
}

// ============================================================================
// CALCULATION UTILITIES
// ============================================================================

/**
 * Calculate tab rendering information
 *
 * @param currentPosition - Current position in twips
 * @param tabStops - Defined tab stops
 * @param pageWidth - Page width in twips
 * @returns Tab render information
 */
export function calculateTabRenderInfo(
  currentPosition: number = 0,
  tabStops: TabStop[] = [],
  pageWidth: number = DEFAULT_PAGE_WIDTH_TWIPS
): TabRenderInfo {
  // Get the next tab stop
  const nextTab = getNextTabStop(currentPosition, tabStops, pageWidth);

  // Calculate width in twips then convert to pixels
  const widthTwips = calculateTabWidth(currentPosition, tabStops, pageWidth);
  const widthPx = Math.max(MIN_TAB_WIDTH_PX, twipsToPixels(widthTwips));

  // Calculate leader string if needed
  const hasLeader = hasVisibleLeader(nextTab.leader);
  let leaderString = '';

  if (hasLeader) {
    const leaderChar = getLeaderCharacter(nextTab.leader);
    // Estimate how many characters fit in the width
    const charCount = Math.floor(widthPx / APPROX_CHAR_WIDTH_PX);
    leaderString = leaderChar.repeat(Math.max(0, charCount));
  }

  return {
    width: widthPx,
    alignment: nextTab.alignment,
    leader: nextTab.leader,
    tabStopPosition: nextTab.position,
    hasLeader,
    leaderString,
  };
}

/**
 * Get CSS styles for a tab based on its render info
 */
export function getTabStyle(info: TabRenderInfo, additionalStyle?: CSSProperties): CSSProperties {
  const baseStyle: CSSProperties = {
    display: 'inline-block',
    minWidth: `${info.width}px`,
    width: `${info.width}px`,
    whiteSpace: 'pre',
    // Prevent tab from breaking
    overflow: 'hidden',
    verticalAlign: 'baseline',
  };

  // Add leader-specific styles
  if (info.hasLeader) {
    switch (info.leader) {
      case 'heavy':
        // Heavy underscore - use thicker underline styling
        baseStyle.textDecoration = 'underline';
        baseStyle.textDecorationStyle = 'solid';
        baseStyle.textDecorationThickness = '2px';
        break;
      case 'underscore':
        // Regular underscore via text
        baseStyle.textDecoration = 'none';
        break;
      case 'dot':
      case 'hyphen':
      case 'middleDot':
        // These are rendered as text content
        baseStyle.textAlign = 'left';
        baseStyle.letterSpacing = '0';
        break;
    }
  }

  // Merge with additional styles
  if (additionalStyle) {
    return { ...baseStyle, ...additionalStyle };
  }

  return baseStyle;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Tab component - renders a tab character with proper spacing and leader
 */
export function Tab({
  currentPosition = 0,
  tabStops = [],
  pageWidth = DEFAULT_PAGE_WIDTH_TWIPS,
  className,
  style,
  index,
}: TabProps): React.ReactElement {
  // Calculate tab rendering information
  const info = calculateTabRenderInfo(currentPosition, tabStops, pageWidth);

  // Get combined styles
  const combinedStyle = getTabStyle(info, style);

  // Build class names
  const classNames: string[] = ['docx-tab'];
  if (className) {
    classNames.push(className);
  }
  if (info.hasLeader) {
    classNames.push(`docx-tab-leader-${info.leader}`);
  }
  classNames.push(`docx-tab-align-${info.alignment}`);

  // Determine content
  let content: string;
  if (info.hasLeader && info.leaderString) {
    content = info.leaderString;
  } else {
    // Use a non-breaking space to maintain the width
    content = '\u00A0';
  }

  return (
    <span
      key={index}
      className={classNames.join(' ')}
      style={combinedStyle}
      data-tab-position={info.tabStopPosition}
      data-tab-alignment={info.alignment}
    >
      {content}
    </span>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate the position after a tab at a given position
 *
 * @param currentPosition - Current position in twips
 * @param tabStops - Defined tab stops
 * @param pageWidth - Page width in twips
 * @returns New position in twips after the tab
 */
export function getPositionAfterTab(
  currentPosition: number,
  tabStops: TabStop[] = [],
  pageWidth: number = DEFAULT_PAGE_WIDTH_TWIPS
): number {
  const nextTab = getNextTabStop(currentPosition, tabStops, pageWidth);
  return nextTab.position;
}

/**
 * Get default tab width in pixels when no tab stops are defined
 *
 * Uses the default tab interval (0.5 inches)
 */
export function getDefaultTabWidthPx(): number {
  return twipsToPixels(DEFAULT_TAB_INTERVAL_TWIPS);
}

/**
 * Estimate the width of content following a tab (for alignment calculation)
 *
 * @param text - Text following the tab
 * @param fontSize - Font size in pixels
 * @returns Estimated width in twips
 */
export function estimateFollowingContentWidth(text: string, fontSize: number = 12): number {
  // Rough estimate: average character width is about 0.5 * font size
  const avgCharWidth = fontSize * 0.5;
  const widthPx = text.length * avgCharWidth;
  // Convert pixels to twips (1 inch = 96 pixels = 1440 twips)
  return (widthPx / 96) * 1440;
}

/**
 * Check if a tab stop position is at a default interval
 *
 * @param position - Position in twips
 * @returns true if at a default tab stop position
 */
export function isDefaultTabPosition(position: number): boolean {
  return position > 0 && position % DEFAULT_TAB_INTERVAL_TWIPS === 0;
}

/**
 * Get the leader character CSS content for a tab leader
 *
 * @param leader - Tab leader type
 * @returns CSS content string or null
 */
export function getLeaderCssContent(leader: TabLeader | undefined): string | null {
  if (!hasVisibleLeader(leader)) {
    return null;
  }

  const char = getLeaderCharacter(leader);
  // Escape for CSS content property
  return `"${char}"`;
}

/**
 * Create a simple tab element without position calculation
 * (useful when exact width is already known)
 *
 * @param widthPx - Width in pixels
 * @param leader - Optional leader character
 * @param className - Optional class name
 * @returns Tab element
 */
export function createSimpleTab(
  widthPx: number,
  leader?: TabLeader,
  className?: string
): React.ReactElement {
  const hasLeader = hasVisibleLeader(leader);
  const leaderChar = getLeaderCharacter(leader);
  const charCount = Math.floor(widthPx / APPROX_CHAR_WIDTH_PX);
  const leaderString = hasLeader ? leaderChar.repeat(Math.max(0, charCount)) : '\u00A0';

  const style: CSSProperties = {
    display: 'inline-block',
    width: `${widthPx}px`,
    minWidth: `${widthPx}px`,
    whiteSpace: 'pre',
    overflow: 'hidden',
  };

  const classNames = ['docx-tab'];
  if (className) {
    classNames.push(className);
  }
  if (hasLeader && leader) {
    classNames.push(`docx-tab-leader-${leader}`);
  }

  return (
    <span className={classNames.join(' ')} style={style}>
      {leaderString}
    </span>
  );
}

/**
 * Render a bar tab (vertical line at position)
 *
 * @param position - Position in twips
 * @param height - Height of the bar in pixels
 * @param color - Bar color (default: black)
 * @returns Bar tab element
 */
export function createBarTab(
  position: number,
  height: number = 16,
  color: string = '#000'
): React.ReactElement {
  const positionPx = twipsToPixels(position);

  const style: CSSProperties = {
    position: 'absolute',
    left: `${positionPx}px`,
    top: 0,
    width: '1px',
    height: `${height}px`,
    backgroundColor: color,
  };

  return <span className="docx-tab-bar" style={style} />;
}

export default Tab;
