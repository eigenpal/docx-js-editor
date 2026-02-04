/**
 * Tab Width Calculator
 *
 * Computes tab widths based on position and tab stops.
 * Follows OOXML tab stop semantics:
 * - Default tab interval: 720 twips (0.5 inch, 48px at 96dpi)
 * - Tab stops can be start (left), end (right), center, decimal, or bar
 * - Explicit tab stops override default stops
 *
 * Based on ECMA-376 specification and clean-room understanding of tab layout.
 */

/**
 * Tab alignment types
 */
export type TabAlignment = 'start' | 'end' | 'center' | 'decimal' | 'bar' | 'clear';

/**
 * Tab leader (fill character) types
 */
export type TabLeader = 'none' | 'dot' | 'hyphen' | 'underscore' | 'middleDot' | 'heavy';

/**
 * Tab stop definition
 */
export interface TabStop {
  /** Tab alignment mode */
  val: TabAlignment;
  /** Position in twips from left margin */
  pos: number;
  /** Optional leader character */
  leader?: TabLeader;
}

/**
 * Context for tab calculations
 */
export interface TabContext {
  /** Explicit tab stops from paragraph or style */
  explicitStops?: TabStop[];
  /** Default tab interval in twips (default: 720 = 0.5 inch) */
  defaultTabInterval?: number;
  /** Left indent in twips */
  leftIndent?: number;
}

/**
 * Result of tab width calculation
 */
export interface TabWidthResult {
  /** Width of the tab in pixels */
  width: number;
  /** Leader character to render (if any) */
  leader?: TabLeader;
  /** Alignment that was applied */
  alignment: TabAlignment | 'default';
}

// Constants
/** Default tab interval: 720 twips = 0.5 inch */
export const DEFAULT_TAB_INTERVAL_TWIPS = 720;

/** Twips per inch */
export const TWIPS_PER_INCH = 1440;

/** Pixels per inch (96 dpi standard for CSS) */
export const PIXELS_PER_INCH = 96;

/**
 * Convert twips to pixels
 * @param twips - Value in twips (1/1440 inch)
 * @returns Value in pixels (at 96 dpi)
 */
export function twipsToPixels(twips: number): number {
  return (twips / TWIPS_PER_INCH) * PIXELS_PER_INCH;
}

/**
 * Convert pixels to twips
 * @param pixels - Value in pixels (at 96 dpi)
 * @returns Value in twips (1/1440 inch)
 */
export function pixelsToTwips(pixels: number): number {
  return (pixels / PIXELS_PER_INCH) * TWIPS_PER_INCH;
}

/**
 * Compute the list of effective tab stops for a paragraph
 *
 * Merges explicit stops with default stops at regular intervals.
 * Filters out stops that fall before the left indent.
 *
 * @param context - Tab context with explicit stops and settings
 * @returns Sorted array of tab stops in twips
 */
export function computeTabStops(context: TabContext): TabStop[] {
  const {
    explicitStops = [],
    defaultTabInterval = DEFAULT_TAB_INTERVAL_TWIPS,
    leftIndent = 0,
  } = context;

  // Filter out clear stops and those before left indent
  const validExplicitStops = explicitStops
    .filter((stop) => stop.val !== 'clear')
    .filter((stop) => stop.pos >= leftIndent);

  // Track cleared positions
  const clearPositions = explicitStops
    .filter((stop) => stop.val === 'clear')
    .map((stop) => stop.pos);

  // Find rightmost explicit stop
  const maxExplicit = validExplicitStops.reduce((max, stop) => Math.max(max, stop.pos), 0);

  // Build result starting with explicit stops
  const stops = [...validExplicitStops];

  // For hanging indent paragraphs (where leftIndent > 0 and no explicit stops before it),
  // add the leftIndent position as an implicit tab stop.
  // This is standard Word behavior: tabs jump to the left margin for alignment.
  if (leftIndent > 0 && !validExplicitStops.some((s) => s.pos <= leftIndent)) {
    const hasLeftIndentClear = clearPositions.some((p) => Math.abs(p - leftIndent) < 20);
    if (!hasLeftIndentClear) {
      stops.push({
        val: 'start',
        pos: leftIndent,
        leader: 'none',
      });
    }
  }

  // Generate default stops at regular intervals
  // Start from leftIndent and go up to ~10 inches
  const startPos = maxExplicit > 0 ? Math.max(maxExplicit, leftIndent) : leftIndent;
  let pos = startPos;
  const limitPos = leftIndent + 14400; // 14400 twips = 10 inches

  while (pos < limitPos) {
    pos += defaultTabInterval;

    // Skip if there's already an explicit stop at this position
    const hasExplicitStop = validExplicitStops.some((s) => Math.abs(s.pos - pos) < 20);
    // Skip if there's a clear stop at this position
    const hasClearStop = clearPositions.some((clearPos) => Math.abs(clearPos - pos) < 20);
    // Skip if at leftIndent (already added above)
    const isAtLeftIndent = leftIndent > 0 && Math.abs(pos - leftIndent) < 20;

    if (!hasExplicitStop && !hasClearStop && !isAtLeftIndent) {
      stops.push({
        val: 'start',
        pos,
        leader: 'none',
      });
    }
  }

  // Sort by position
  return stops.sort((a, b) => a.pos - b.pos);
}

/**
 * Calculate the width of a tab character
 *
 * Finds the next tab stop after the current position and computes
 * the width needed to reach it.
 *
 * @param currentXPx - Current horizontal position in pixels
 * @param context - Tab context with stops and settings
 * @param followingText - Text immediately after the tab (for center/end/decimal alignment)
 * @param measureText - Function to measure text width in pixels
 * @param decimalSeparator - Character used for decimal alignment (default: '.')
 * @returns Tab width result with width in pixels
 */
export function calculateTabWidth(
  currentXPx: number,
  context: TabContext,
  followingText = '',
  measureText?: (text: string) => number,
  decimalSeparator = '.'
): TabWidthResult {
  const { defaultTabInterval = DEFAULT_TAB_INTERVAL_TWIPS } = context;

  // Convert current position to twips
  const currentXTwips = pixelsToTwips(currentXPx);

  // Get computed tab stops
  const stops = computeTabStops(context);

  // Find next stop after current position
  const nextStop = stops.find((stop) => stop.pos > currentXTwips);

  // Fallback to default grid
  if (!nextStop) {
    const defaultTabPx = twipsToPixels(defaultTabInterval);
    let tabWidth = defaultTabPx - (currentXPx % defaultTabPx);
    if (tabWidth <= 0) tabWidth = defaultTabPx;
    return {
      width: tabWidth,
      alignment: 'default',
    };
  }

  // Calculate base width to next stop
  const nextStopPx = twipsToPixels(nextStop.pos);
  let width = nextStopPx - currentXPx;

  // Adjust for alignment types
  if (nextStop.val === 'center' || nextStop.val === 'end') {
    const textWidth = measureText ? measureText(followingText) : 0;
    if (nextStop.val === 'center') {
      width -= textWidth / 2;
    } else {
      width -= textWidth;
    }
  } else if (nextStop.val === 'decimal') {
    const decimalIndex = followingText.indexOf(decimalSeparator);
    if (decimalIndex >= 0 && measureText) {
      const before = followingText.slice(0, decimalIndex);
      const beforeWidth = measureText(before);
      width -= beforeWidth;
    }
  } else if (nextStop.val === 'bar') {
    // Bar tabs have zero width but render a vertical line
    return {
      width: 0,
      leader: nextStop.leader,
      alignment: 'bar',
    };
  }

  // Ensure minimum width
  if (width < 1) {
    const defaultTabPx = twipsToPixels(defaultTabInterval);
    let fallbackWidth = defaultTabPx - (currentXPx % defaultTabPx);
    if (fallbackWidth <= 0) fallbackWidth = defaultTabPx;
    return {
      width: fallbackWidth,
      alignment: 'default',
    };
  }

  return {
    width,
    leader: nextStop.leader,
    alignment: nextStop.val,
  };
}

/**
 * Calculate tab width with simple default stops
 *
 * Simplified version for basic tab rendering without explicit stops.
 * Uses the default 0.5 inch (48px) tab interval.
 *
 * @param currentXPx - Current horizontal position in pixels
 * @returns Width of the tab in pixels
 */
export function calculateSimpleTabWidth(currentXPx: number): number {
  const defaultTabPx = twipsToPixels(DEFAULT_TAB_INTERVAL_TWIPS);
  let tabWidth = defaultTabPx - (currentXPx % defaultTabPx);
  // Ensure minimum tab width of 1/4 of default (12px)
  if (tabWidth < defaultTabPx / 4) {
    tabWidth += defaultTabPx;
  }
  return tabWidth;
}
