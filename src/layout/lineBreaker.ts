/**
 * Line Breaker
 *
 * Breaks paragraphs into lines based on available width.
 * Handles:
 * - Word boundary line breaking
 * - Multiple runs with different font sizes
 * - Tab stops and their alignment
 * - Non-breaking spaces and hyphens
 * - Soft hyphens
 */

import type { Paragraph, Run, TextFormatting, Theme, TabStop } from '../types/document';
import { measureTextWidth, getLineHeight } from '../utils/textMeasure';
import { twipsToPixels } from '../utils/units';
import { getNextTabStop, DEFAULT_TAB_INTERVAL_TWIPS } from '../docx/tabParser';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A fragment of content that can't be broken (word or inline element)
 */
export interface LineFragment {
  /** Type of fragment */
  type: 'text' | 'tab' | 'break' | 'image' | 'field' | 'symbol' | 'space';
  /** The content (text for text fragments) */
  content: string;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Baseline from top in pixels */
  baseline: number;
  /** Source run index */
  runIndex: number;
  /** Source content index within run */
  contentIndex: number;
  /** Character offset within text content (for text fragments) */
  charOffset?: number;
  /** Character count (for text fragments) */
  charCount?: number;
  /** Text formatting applied */
  formatting?: TextFormatting;
  /** Whether this is a break point */
  canBreakAfter: boolean;
  /** Whether this is a non-breaking element */
  nonBreaking?: boolean;
  /** Tab stop position (for tabs) */
  tabStopPosition?: number;
}

/**
 * A line of formatted text
 */
export interface Line {
  /** Fragments on this line */
  fragments: LineFragment[];
  /** Total width of the line */
  width: number;
  /** Height of the line (max of all fragments) */
  height: number;
  /** Baseline position from top */
  baseline: number;
  /** Y position from top of paragraph */
  y: number;
  /** Whether this is the last line of the paragraph */
  isLastLine: boolean;
  /** Whether this line ends with a hard break */
  hasHardBreak: boolean;
  /** Line number (0-indexed within paragraph) */
  lineNumber: number;
}

/**
 * Options for line breaking
 */
export interface LineBreakOptions {
  /** Maximum width for content */
  maxWidth: number;
  /** First line indent (positive = indent, negative = hanging) */
  firstLineIndent?: number;
  /** Tab stops defined for the paragraph */
  tabStops?: TabStop[];
  /** Theme for font resolution */
  theme?: Theme | null;
  /** Default formatting for the paragraph */
  defaultFormatting?: TextFormatting;
  /** Line height multiplier (default 1.0) */
  lineHeightMultiplier?: number;
  /** Minimum line height in pixels */
  minLineHeight?: number;
}

/**
 * Result of line breaking
 */
export interface LineBreakResult {
  /** All lines */
  lines: Line[];
  /** Total height of all lines */
  totalHeight: number;
  /** Maximum line width */
  maxWidth: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Characters that allow line breaks after them
const BREAK_AFTER_CHARS = new Set([' ', '\t', '-', '\u00AD', '\u200B']);

// Characters that prevent breaks (non-breaking)
const NON_BREAKING_CHARS = new Set(['\u00A0', '\u2011']);

// Whitespace characters
const WHITESPACE_CHARS = new Set([
  ' ',
  '\t',
  '\u00A0',
  '\u200B',
  '\u2000',
  '\u2001',
  '\u2002',
  '\u2003',
]);

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Break a paragraph into lines based on available width
 *
 * @param paragraph - The paragraph to break
 * @param options - Line breaking options
 * @returns Array of lines
 */
export function breakIntoLines(paragraph: Paragraph, options: LineBreakOptions): LineBreakResult {
  const {
    maxWidth,
    firstLineIndent = 0,
    tabStops = [],
    theme,
    defaultFormatting,
    lineHeightMultiplier = 1.0,
    minLineHeight = 14,
  } = options;

  // Step 1: Convert paragraph content to fragments
  const fragments = paragraphToFragments(paragraph, theme, defaultFormatting);

  // Step 2: Break fragments into lines
  const lines: Line[] = [];
  let currentLine: LineFragment[] = [];
  let currentWidth = 0;
  let currentY = 0;
  let isFirstLine = true;
  let positionInTwips = 0; // Track horizontal position for tabs

  // Get effective max width (accounting for first line indent)
  const getEffectiveMaxWidth = () => {
    if (isFirstLine && firstLineIndent !== 0) {
      return maxWidth - firstLineIndent;
    }
    return maxWidth;
  };

  for (let i = 0; i < fragments.length; i++) {
    const fragment = fragments[i];
    const effectiveMaxWidth = getEffectiveMaxWidth();

    // Handle hard breaks
    if (fragment.type === 'break') {
      // Finalize current line
      const line = finalizeLine(
        currentLine,
        currentY,
        lines.length,
        true, // hasHardBreak
        lineHeightMultiplier,
        minLineHeight
      );
      lines.push(line);
      currentY += line.height;
      currentLine = [];
      currentWidth = 0;
      positionInTwips = 0;
      isFirstLine = false;
      continue;
    }

    // Handle tabs
    if (fragment.type === 'tab') {
      // Calculate tab width based on current position
      const tabWidth = calculateTabWidthForPosition(
        positionInTwips,
        tabStops,
        maxWidth,
        isFirstLine ? firstLineIndent : 0
      );
      fragment.width = tabWidth;
      positionInTwips += tabWidth * (1440 / 96); // Convert px to twips approximately

      // Check if tab fits on current line
      if (currentWidth + tabWidth > effectiveMaxWidth && currentLine.length > 0) {
        // Wrap to next line
        const line = finalizeLine(
          currentLine,
          currentY,
          lines.length,
          false,
          lineHeightMultiplier,
          minLineHeight
        );
        lines.push(line);
        currentY += line.height;
        currentLine = [];
        currentWidth = 0;
        positionInTwips = 0;
        isFirstLine = false;
      }

      currentLine.push(fragment);
      currentWidth += fragment.width;
      continue;
    }

    // Check if fragment fits on current line
    if (currentWidth + fragment.width <= effectiveMaxWidth) {
      // Fragment fits
      currentLine.push(fragment);
      currentWidth += fragment.width;
      positionInTwips += fragment.width * (1440 / 96);
    } else {
      // Fragment doesn't fit - need to break

      // If it's a text fragment, try to break at word boundary
      if (fragment.type === 'text' && fragment.content.length > 1) {
        const brokenParts = breakTextFragment(
          fragment,
          effectiveMaxWidth - currentWidth,
          effectiveMaxWidth,
          theme
        );

        for (let j = 0; j < brokenParts.length; j++) {
          const part = brokenParts[j];

          if (j === 0 && currentWidth + part.width <= effectiveMaxWidth) {
            // First part fits on current line
            currentLine.push(part);
            currentWidth += part.width;
          } else {
            // Need a new line
            if (currentLine.length > 0) {
              const line = finalizeLine(
                currentLine,
                currentY,
                lines.length,
                false,
                lineHeightMultiplier,
                minLineHeight
              );
              lines.push(line);
              currentY += line.height;
            }
            currentLine = [part];
            currentWidth = part.width;
            positionInTwips = part.width * (1440 / 96);
            isFirstLine = false;
          }
        }
      } else {
        // Non-text fragment or single character - wrap to next line
        if (currentLine.length > 0) {
          const line = finalizeLine(
            currentLine,
            currentY,
            lines.length,
            false,
            lineHeightMultiplier,
            minLineHeight
          );
          lines.push(line);
          currentY += line.height;
        }
        currentLine = [fragment];
        currentWidth = fragment.width;
        positionInTwips = fragment.width * (1440 / 96);
        isFirstLine = false;
      }
    }
  }

  // Finalize last line
  if (currentLine.length > 0) {
    const line = finalizeLine(
      currentLine,
      currentY,
      lines.length,
      false,
      lineHeightMultiplier,
      minLineHeight
    );
    line.isLastLine = true;
    lines.push(line);
    currentY += line.height;
  }

  // Mark last line
  if (lines.length > 0) {
    lines[lines.length - 1].isLastLine = true;
  }

  return {
    lines,
    totalHeight: currentY,
    maxWidth: Math.max(...lines.map((l) => l.width), 0),
  };
}

// ============================================================================
// FRAGMENT CREATION
// ============================================================================

/**
 * Convert paragraph content to line fragments
 */
function paragraphToFragments(
  paragraph: Paragraph,
  theme: Theme | null | undefined,
  defaultFormatting?: TextFormatting
): LineFragment[] {
  const fragments: LineFragment[] = [];

  for (let runIndex = 0; runIndex < paragraph.content.length; runIndex++) {
    const content = paragraph.content[runIndex];

    if (content.type === 'run') {
      const runFragments = runToFragments(content, runIndex, theme, defaultFormatting);
      fragments.push(...runFragments);
    } else if (content.type === 'hyperlink') {
      // Process hyperlink children (runs)
      for (const child of content.children) {
        if (child.type === 'run') {
          const runFragments = runToFragments(child, runIndex, theme, defaultFormatting);
          fragments.push(...runFragments);
        }
      }
    }
    // Other content types (bookmarks, fields) handled within runs
  }

  return fragments;
}

/**
 * Convert a run to fragments
 */
function runToFragments(
  run: Run,
  runIndex: number,
  theme: Theme | null | undefined,
  defaultFormatting?: TextFormatting
): LineFragment[] {
  const fragments: LineFragment[] = [];
  const formatting = { ...defaultFormatting, ...run.formatting };
  const themeOrUndefined = theme ?? undefined;

  // Get measurements for this formatting
  const lineHeight = getLineHeight(formatting, themeOrUndefined);
  const baseline = lineHeight * 0.8; // Approximate baseline

  for (let contentIndex = 0; contentIndex < run.content.length; contentIndex++) {
    const item = run.content[contentIndex];

    switch (item.type) {
      case 'text':
        // Split text into word fragments
        const textFragments = textToFragments(item.text, formatting, runIndex, contentIndex, theme);
        fragments.push(...textFragments);
        break;

      case 'tab':
        fragments.push({
          type: 'tab',
          content: '\t',
          width: 0, // Calculated during line breaking
          height: lineHeight,
          baseline,
          runIndex,
          contentIndex,
          formatting,
          canBreakAfter: true,
        });
        break;

      case 'break':
        const breakType = item.breakType || 'textWrapping';
        fragments.push({
          type: 'break',
          content: breakType === 'page' ? '\f' : '\n',
          width: 0,
          height: breakType === 'page' ? 0 : lineHeight,
          baseline,
          runIndex,
          contentIndex,
          formatting,
          canBreakAfter: false, // Hard break ends the line
        });
        break;

      case 'symbol':
        const symbolMeasure = measureTextWidth(item.char || '?', formatting, themeOrUndefined);
        fragments.push({
          type: 'symbol',
          content: item.char || '?',
          width: symbolMeasure,
          height: lineHeight,
          baseline,
          runIndex,
          contentIndex,
          formatting,
          canBreakAfter: true,
        });
        break;

      case 'drawing':
      case 'shape':
        // Placeholder for images/shapes
        // Width/height would come from the image/shape properties
        fragments.push({
          type: 'image',
          content: '',
          width: 100, // Placeholder
          height: 100, // Placeholder
          baseline: 100,
          runIndex,
          contentIndex,
          formatting,
          canBreakAfter: true,
        });
        break;

      case 'softHyphen':
        // Soft hyphen - potential break point
        fragments.push({
          type: 'text',
          content: '\u00AD',
          width: 0, // Zero width unless at line end
          height: lineHeight,
          baseline,
          runIndex,
          contentIndex,
          formatting,
          canBreakAfter: true,
        });
        break;

      case 'noBreakHyphen':
        const hyphenMeasure = measureTextWidth('-', formatting, themeOrUndefined);
        fragments.push({
          type: 'text',
          content: '-',
          width: hyphenMeasure,
          height: lineHeight,
          baseline,
          runIndex,
          contentIndex,
          formatting,
          canBreakAfter: false,
          nonBreaking: true,
        });
        break;

      // Handle field characters (complex fields)
      case 'fieldChar':
      case 'instrText':
        // Skip field internal content
        break;

      case 'footnoteRef':
      case 'endnoteRef':
        // Note references are small numbers
        const refText = `${item.id}`;
        const refMeasure = measureTextWidth(
          refText,
          { ...formatting, vertAlign: 'superscript' },
          themeOrUndefined
        );
        fragments.push({
          type: 'field',
          content: refText,
          width: refMeasure,
          height: lineHeight * 0.75, // Smaller for superscript
          baseline: baseline * 0.6,
          runIndex,
          contentIndex,
          formatting: { ...formatting, vertAlign: 'superscript' as const },
          canBreakAfter: true,
        });
        break;
    }
  }

  return fragments;
}

/**
 * Convert text content to word fragments
 */
function textToFragments(
  text: string,
  formatting: TextFormatting | undefined,
  runIndex: number,
  contentIndex: number,
  theme: Theme | null | undefined
): LineFragment[] {
  const fragments: LineFragment[] = [];
  const themeOrUndefined = theme ?? undefined;
  const lineHeight = getLineHeight(formatting, themeOrUndefined);
  const baseline = lineHeight * 0.8;

  // Split into words and spaces
  const parts = splitTextIntoWords(text);

  let charOffset = 0;
  for (const part of parts) {
    const isSpace = WHITESPACE_CHARS.has(part) || part === ' ';
    const isNonBreaking = part === '\u00A0' || part === '\u2011';

    const width = measureTextWidth(part, formatting, themeOrUndefined);

    fragments.push({
      type: isSpace ? 'space' : 'text',
      content: part,
      width,
      height: lineHeight,
      baseline,
      runIndex,
      contentIndex,
      charOffset,
      charCount: part.length,
      formatting,
      canBreakAfter:
        !isNonBreaking && (isSpace || BREAK_AFTER_CHARS.has(part.charAt(part.length - 1))),
      nonBreaking: isNonBreaking,
    });

    charOffset += part.length;
  }

  return fragments;
}

/**
 * Split text into words and whitespace
 */
function splitTextIntoWords(text: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inWhitespace = false;

  for (const char of text) {
    const isWS = WHITESPACE_CHARS.has(char);

    if (isWS !== inWhitespace) {
      if (current) {
        parts.push(current);
      }
      current = char;
      inWhitespace = isWS;
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

// ============================================================================
// LINE BREAKING HELPERS
// ============================================================================

/**
 * Break a text fragment at word boundaries
 */
function breakTextFragment(
  fragment: LineFragment,
  remainingWidth: number,
  lineWidth: number,
  theme: Theme | null | undefined
): LineFragment[] {
  const text = fragment.content;
  const formatting = fragment.formatting;
  const parts: LineFragment[] = [];
  const themeOrUndefined = theme ?? undefined;

  // Find break points in the text
  let currentPart = '';
  let currentWidth = 0;
  let isFirstPart = true;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const charWidth = measureTextWidth(char, formatting, themeOrUndefined);
    const maxWidth = isFirstPart ? remainingWidth : lineWidth;

    // Check if adding this character would overflow
    if (currentWidth + charWidth > maxWidth && currentPart.length > 0) {
      // Try to break at a word boundary
      const breakPoint = findBreakPoint(currentPart);

      if (breakPoint > 0) {
        // Break at word boundary
        const part1 = currentPart.substring(0, breakPoint);
        const part2 = currentPart.substring(breakPoint);

        parts.push(createTextFragment(part1, fragment, themeOrUndefined));
        currentPart = part2 + char;
        currentWidth = measureTextWidth(currentPart, formatting, themeOrUndefined);
      } else {
        // No good break point, break between characters
        parts.push(createTextFragment(currentPart, fragment, themeOrUndefined));
        currentPart = char;
        currentWidth = charWidth;
      }
      isFirstPart = false;
    } else {
      currentPart += char;
      currentWidth += charWidth;
    }
  }

  // Add remaining text
  if (currentPart) {
    parts.push(createTextFragment(currentPart, fragment, themeOrUndefined));
  }

  return parts;
}

/**
 * Find a break point in text (prefer after whitespace or hyphen)
 */
function findBreakPoint(text: string): number {
  // Look for break points from the end
  for (let i = text.length - 1; i >= 0; i--) {
    const char = text[i];
    if (BREAK_AFTER_CHARS.has(char) && !NON_BREAKING_CHARS.has(char)) {
      return i + 1;
    }
  }
  return 0;
}

/**
 * Create a text fragment from part of another fragment
 */
function createTextFragment(
  text: string,
  original: LineFragment,
  theme: Theme | undefined
): LineFragment {
  return {
    ...original,
    content: text,
    width: measureTextWidth(text, original.formatting, theme),
    charCount: text.length,
  };
}

/**
 * Calculate tab width for a given position
 */
function calculateTabWidthForPosition(
  positionTwips: number,
  tabStops: TabStop[],
  maxWidthPx: number,
  _indent: number
): number {
  const maxWidthTwips = maxWidthPx * (1440 / 96);
  const tabInfo = getNextTabStop(positionTwips, tabStops, maxWidthTwips);

  if (tabInfo) {
    return twipsToPixels(tabInfo.position - positionTwips);
  }

  // Default tab behavior
  const defaultTabTwips = DEFAULT_TAB_INTERVAL_TWIPS;
  const nextDefault = Math.ceil((positionTwips + 1) / defaultTabTwips) * defaultTabTwips;
  return Math.max(8, twipsToPixels(nextDefault - positionTwips));
}

// ============================================================================
// LINE FINALIZATION
// ============================================================================

/**
 * Finalize a line from fragments
 */
function finalizeLine(
  fragments: LineFragment[],
  y: number,
  lineNumber: number,
  hasHardBreak: boolean,
  lineHeightMultiplier: number,
  minLineHeight: number
): Line {
  // Calculate line metrics
  let totalWidth = 0;
  let maxHeight = minLineHeight;
  let maxBaseline = minLineHeight * 0.8;

  for (const fragment of fragments) {
    totalWidth += fragment.width;
    maxHeight = Math.max(maxHeight, fragment.height);
    maxBaseline = Math.max(maxBaseline, fragment.baseline);
  }

  // Apply line height multiplier
  const finalHeight = Math.max(minLineHeight, maxHeight * lineHeightMultiplier);

  return {
    fragments,
    width: totalWidth,
    height: finalHeight,
    baseline: maxBaseline,
    y,
    isLastLine: false,
    hasHardBreak,
    lineNumber,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the text content of a line
 */
export function getLineText(line: Line): string {
  return line.fragments.map((f) => f.content).join('');
}

/**
 * Get total character count for a line
 */
export function getLineCharCount(line: Line): number {
  return line.fragments.reduce((sum, f) => sum + (f.charCount ?? f.content.length), 0);
}

/**
 * Check if a line is empty (only whitespace)
 */
export function isLineEmpty(line: Line): boolean {
  return line.fragments.every(
    (f) => f.type === 'space' || f.type === 'break' || f.content.trim() === ''
  );
}

/**
 * Get fragments that contain a specific character offset
 */
export function getFragmentAtOffset(line: Line, offset: number): LineFragment | null {
  let currentOffset = 0;

  for (const fragment of line.fragments) {
    const fragmentLength = fragment.charCount ?? fragment.content.length;
    if (currentOffset + fragmentLength > offset) {
      return fragment;
    }
    currentOffset += fragmentLength;
  }

  return null;
}

/**
 * Calculate x position for a character offset within a line
 */
export function getXPositionForOffset(line: Line, offset: number): number {
  let x = 0;
  let currentOffset = 0;

  for (const fragment of line.fragments) {
    const fragmentLength = fragment.charCount ?? fragment.content.length;

    if (currentOffset + fragmentLength > offset) {
      // Offset is within this fragment
      if (fragment.type === 'text' || fragment.type === 'space') {
        // Calculate position within the text
        const charOffset = offset - currentOffset;
        // Note: This is approximate without actual measurement
        x += (fragment.width / fragmentLength) * charOffset;
      }
      return x;
    }

    x += fragment.width;
    currentOffset += fragmentLength;
  }

  return x;
}

/**
 * Get total line count from result
 */
export function getTotalLines(result: LineBreakResult): number {
  return result.lines.length;
}

/**
 * Check if paragraph needs more than one line
 */
export function isMultiLine(result: LineBreakResult): boolean {
  return result.lines.length > 1;
}

export default breakIntoLines;
