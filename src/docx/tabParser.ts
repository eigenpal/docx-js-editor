/**
 * Tab Parser - Parse and handle tab stops in DOCX documents
 *
 * Tab stops define positions where the cursor jumps when the user presses Tab.
 * They can have different alignments (left, center, right, decimal) and
 * leader characters (dots, dashes, underscores).
 *
 * OOXML Reference:
 * - Tab stops container: w:tabs
 * - Individual tab stop: w:tab
 * - Tab character in runs: w:tab (different from tab stop definition)
 *
 * Attributes of w:tab in w:tabs:
 * - w:val - alignment type (left, center, right, decimal, bar, clear, num)
 * - w:pos - position in twips from left margin
 * - w:leader - leader character (none, dot, hyphen, underscore, heavy, middleDot)
 */

import type { TabStop, TabStopAlignment, TabLeader } from '../types/document';
import {
  findChild,
  findChildren,
  getAttribute,
  parseNumericAttribute,
  type XmlElement,
} from './xmlParser';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default tab stop interval in twips (0.5 inches = 720 twips at 1440 twips/inch)
 * Word uses this when no explicit tab stops are defined
 */
export const DEFAULT_TAB_INTERVAL_TWIPS = 720;

/**
 * Default tab alignment
 */
export const DEFAULT_TAB_ALIGNMENT: TabStopAlignment = 'left';

/**
 * Default tab leader
 */
export const DEFAULT_TAB_LEADER: TabLeader = 'none';

// ============================================================================
// TAB STOP PARSING
// ============================================================================

/**
 * Parse a single tab stop element (w:tab within w:tabs)
 *
 * @param tab - The w:tab XML element
 * @returns Parsed TabStop or null if invalid
 */
export function parseTabStop(tab: XmlElement): TabStop | null {
  const pos = parseNumericAttribute(tab, 'w', 'pos');
  const val = getAttribute(tab, 'w', 'val');

  // Both position and alignment are required for a valid tab stop
  if (pos === undefined || !val) {
    return null;
  }

  const tabStop: TabStop = {
    position: pos,
    alignment: val as TabStopAlignment,
  };

  // Parse optional leader character
  const leader = getAttribute(tab, 'w', 'leader');
  if (leader) {
    tabStop.leader = leader as TabLeader;
  }

  return tabStop;
}

/**
 * Parse tab stops container (w:tabs)
 *
 * @param tabs - The w:tabs XML element
 * @returns Array of TabStop objects, sorted by position
 */
export function parseTabStops(tabs: XmlElement | null): TabStop[] {
  if (!tabs) return [];

  const tabElements = findChildren(tabs, 'w', 'tab');
  if (tabElements.length === 0) return [];

  const result: TabStop[] = [];

  for (const tab of tabElements) {
    const tabStop = parseTabStop(tab);
    if (tabStop) {
      result.push(tabStop);
    }
  }

  // Sort by position (ascending)
  result.sort((a, b) => a.position - b.position);

  return result;
}

/**
 * Parse tab stops from paragraph properties element
 *
 * @param pPr - The w:pPr XML element
 * @returns Array of TabStop objects or undefined if none
 */
export function parseTabStopsFromParagraphProperties(
  pPr: XmlElement | null
): TabStop[] | undefined {
  if (!pPr) return undefined;

  const tabs = findChild(pPr, 'w', 'tabs');
  const tabStops = parseTabStops(tabs);

  return tabStops.length > 0 ? tabStops : undefined;
}

// ============================================================================
// TAB STOP RESOLUTION
// ============================================================================

/**
 * Merge tab stops from different sources (style, direct formatting)
 *
 * Direct formatting tab stops override style tab stops at the same position.
 * "clear" alignment removes a tab stop from the style.
 *
 * @param styleTabs - Tab stops from style
 * @param directTabs - Tab stops from direct formatting (w:pPr in paragraph)
 * @returns Merged and filtered tab stops
 */
export function mergeTabStops(
  styleTabs: TabStop[] | undefined,
  directTabs: TabStop[] | undefined
): TabStop[] {
  if (!styleTabs && !directTabs) return [];
  if (!styleTabs) return directTabs ?? [];
  if (!directTabs) return [...styleTabs];

  // Create a map of positions to tab stops, starting with style tabs
  const tabMap = new Map<number, TabStop>();

  for (const tab of styleTabs) {
    tabMap.set(tab.position, tab);
  }

  // Apply direct tabs (override or clear)
  for (const tab of directTabs) {
    if (tab.alignment === 'clear') {
      // Clear removes the tab at this position
      tabMap.delete(tab.position);
    } else {
      // Override the tab at this position
      tabMap.set(tab.position, tab);
    }
  }

  // Convert back to array and sort by position
  const result = Array.from(tabMap.values());
  result.sort((a, b) => a.position - b.position);

  return result;
}

/**
 * Get the next tab stop position for a given current position
 *
 * @param currentPosition - Current position in twips from left margin
 * @param tabStops - Defined tab stops
 * @param pageWidth - Page content width in twips (for boundary)
 * @returns The next tab stop or a default position
 */
export function getNextTabStop(
  currentPosition: number,
  tabStops: TabStop[],
  pageWidth: number
): TabStop {
  // Find the first tab stop after current position
  for (const tab of tabStops) {
    if (tab.position > currentPosition && tab.alignment !== 'clear') {
      return tab;
    }
  }

  // No defined tab stop found, use default interval
  const defaultPosition =
    Math.ceil((currentPosition + 1) / DEFAULT_TAB_INTERVAL_TWIPS) * DEFAULT_TAB_INTERVAL_TWIPS;

  // Don't exceed page width
  if (defaultPosition > pageWidth) {
    return {
      position: pageWidth,
      alignment: DEFAULT_TAB_ALIGNMENT,
    };
  }

  return {
    position: defaultPosition,
    alignment: DEFAULT_TAB_ALIGNMENT,
  };
}

/**
 * Find a tab stop at a specific position
 *
 * @param position - Position to look for (in twips)
 * @param tabStops - Array of tab stops
 * @param tolerance - Position tolerance in twips (default 10)
 * @returns TabStop at that position or undefined
 */
export function findTabStopAtPosition(
  position: number,
  tabStops: TabStop[],
  tolerance: number = 10
): TabStop | undefined {
  return tabStops.find(
    (tab) => Math.abs(tab.position - position) <= tolerance && tab.alignment !== 'clear'
  );
}

// ============================================================================
// TAB WIDTH CALCULATION
// ============================================================================

/**
 * Calculate the width needed for a tab at a given position
 *
 * @param currentPosition - Current position in twips
 * @param tabStops - Defined tab stops
 * @param pageWidth - Page content width in twips
 * @returns Width in twips that the tab should span
 */
export function calculateTabWidth(
  currentPosition: number,
  tabStops: TabStop[],
  pageWidth: number
): number {
  const nextTab = getNextTabStop(currentPosition, tabStops, pageWidth);
  return Math.max(0, nextTab.position - currentPosition);
}

/**
 * Calculate tab width considering alignment
 *
 * For non-left alignments (center, right, decimal), the width depends on
 * the content that follows the tab.
 *
 * @param currentPosition - Current position in twips
 * @param tabStops - Defined tab stops
 * @param pageWidth - Page content width in twips
 * @param followingContentWidth - Width of content after the tab (for alignment)
 * @returns Width in twips
 */
export function calculateTabWidthWithAlignment(
  currentPosition: number,
  tabStops: TabStop[],
  pageWidth: number,
  followingContentWidth: number = 0
): { width: number; alignment: TabStopAlignment } {
  const nextTab = getNextTabStop(currentPosition, tabStops, pageWidth);
  let width: number;

  switch (nextTab.alignment) {
    case 'right':
      // Content ends at tab position
      width = Math.max(0, nextTab.position - currentPosition - followingContentWidth);
      break;

    case 'center':
      // Content is centered at tab position
      width = Math.max(0, nextTab.position - currentPosition - followingContentWidth / 2);
      break;

    case 'decimal':
      // For decimal tabs, alignment happens at the decimal point
      // This is handled similarly to right alignment for the tab width itself
      width = Math.max(0, nextTab.position - currentPosition - followingContentWidth);
      break;

    case 'bar':
      // Bar tab draws a vertical line at the position
      // Width calculation is same as left
      width = Math.max(0, nextTab.position - currentPosition);
      break;

    case 'left':
    case 'num':
    default:
      // Content starts at tab position
      width = Math.max(0, nextTab.position - currentPosition);
      break;
  }

  return { width, alignment: nextTab.alignment };
}

// ============================================================================
// LEADER CHARACTER UTILITIES
// ============================================================================

/**
 * Get the character used for a tab leader
 *
 * @param leader - Tab leader type
 * @returns The character to use for filling
 */
export function getLeaderCharacter(leader: TabLeader | undefined): string {
  switch (leader) {
    case 'dot':
      return '.';
    case 'hyphen':
      return '-';
    case 'underscore':
      return '_';
    case 'heavy':
      return '_'; // Heavy underscore (rendered thicker in CSS)
    case 'middleDot':
      return '·'; // Middle dot (U+00B7)
    case 'none':
    default:
      return ' ';
  }
}

/**
 * Check if a leader type requires visible filling
 *
 * @param leader - Tab leader type
 * @returns true if the leader needs visible characters
 */
export function hasVisibleLeader(leader: TabLeader | undefined): boolean {
  return leader !== undefined && leader !== 'none';
}

/**
 * Generate leader string for a tab of given width
 *
 * @param leader - Tab leader type
 * @param widthInChars - Approximate number of characters to fill
 * @returns String of leader characters
 */
export function generateLeaderString(leader: TabLeader | undefined, widthInChars: number): string {
  if (!hasVisibleLeader(leader)) {
    return '';
  }

  const char = getLeaderCharacter(leader);
  const count = Math.max(0, Math.floor(widthInChars));

  return char.repeat(count);
}

// ============================================================================
// VALIDATION AND TYPE GUARDS
// ============================================================================

/**
 * Check if a value is a valid tab alignment
 */
export function isValidTabAlignment(value: string): value is TabStopAlignment {
  const validAlignments: TabStopAlignment[] = [
    'left',
    'center',
    'right',
    'decimal',
    'bar',
    'clear',
    'num',
  ];
  return validAlignments.includes(value as TabStopAlignment);
}

/**
 * Check if a value is a valid tab leader
 */
export function isValidTabLeader(value: string): value is TabLeader {
  const validLeaders: TabLeader[] = ['none', 'dot', 'hyphen', 'underscore', 'heavy', 'middleDot'];
  return validLeaders.includes(value as TabLeader);
}

// ============================================================================
// DEFAULT TAB STOPS
// ============================================================================

/**
 * Generate default tab stops for a given page width
 *
 * Word creates implicit tab stops at regular intervals when no explicit
 * tab stops are defined.
 *
 * @param pageWidth - Page content width in twips
 * @param interval - Tab interval in twips (default: 720 = 0.5 inches)
 * @returns Array of default tab stops
 */
export function generateDefaultTabStops(
  pageWidth: number,
  interval: number = DEFAULT_TAB_INTERVAL_TWIPS
): TabStop[] {
  const tabStops: TabStop[] = [];
  let position = interval;

  while (position < pageWidth) {
    tabStops.push({
      position,
      alignment: 'left',
    });
    position += interval;
  }

  return tabStops;
}

/**
 * Get effective tab stops, combining explicit and default
 *
 * @param explicitTabs - Explicitly defined tab stops
 * @param pageWidth - Page content width in twips
 * @returns Combined tab stops with defaults filling gaps
 */
export function getEffectiveTabStops(
  explicitTabs: TabStop[] | undefined,
  pageWidth: number
): TabStop[] {
  if (!explicitTabs || explicitTabs.length === 0) {
    return generateDefaultTabStops(pageWidth);
  }

  // Start with explicit tabs
  const result = [...explicitTabs];

  // Get the highest explicit tab position
  const maxExplicitPosition = Math.max(...explicitTabs.map((t) => t.position));

  // Add default tabs after the last explicit tab
  let position =
    Math.ceil((maxExplicitPosition + 1) / DEFAULT_TAB_INTERVAL_TWIPS) * DEFAULT_TAB_INTERVAL_TWIPS;

  while (position < pageWidth) {
    // Only add if there's no explicit tab near this position
    const hasExplicit = explicitTabs.some(
      (t) => Math.abs(t.position - position) < 50 // 50 twips tolerance
    );

    if (!hasExplicit) {
      result.push({
        position,
        alignment: 'left',
      });
    }

    position += DEFAULT_TAB_INTERVAL_TWIPS;
  }

  // Sort by position
  result.sort((a, b) => a.position - b.position);

  return result;
}
