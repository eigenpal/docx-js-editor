/**
 * ListItem Component
 *
 * Renders list items (bulleted or numbered) with proper markers.
 * Handles:
 * - Bullet markers with various characters (•, ◦, ▪, ○, etc.)
 * - Numbered markers with all formats (1, a, A, i, I, etc.)
 * - Multi-level list indentation
 * - Proper spacing and alignment
 */

import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  Paragraph as ParagraphType,
  ListRendering,
  ListLevel,
  Theme,
  NumberFormat,
  Image as ImageType,
  Shape as ShapeType,
  TextBox as TextBoxType,
} from '../../types/document';
import { textToStyle, mergeStyles } from '../../utils/formatToStyle';
import { twipsToPixels, formatPx } from '../../utils/units';
import { formatNumber, getBulletCharacter } from '../../docx/numberingParser';
import { Paragraph } from './Paragraph';

/**
 * Props for the ListItem component
 */
export interface ListItemProps {
  /** The paragraph data to render as list item */
  paragraph: ParagraphType;
  /** Theme for resolving colors and fonts */
  theme?: Theme | null;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Level definition from numbering (optional, for detailed styling) */
  levelDefinition?: ListLevel | null;
  /** Counter value for numbered lists */
  counterValue?: number;
  /** Array of counter values for multi-level lists (for rendering %1.%2.%3 patterns) */
  allCounters?: number[];
  /** Array of number formats for each level (for multi-level patterns) */
  allFormats?: NumberFormat[];
  /** Current page number (for PAGE fields) */
  pageNumber?: number;
  /** Total page count (for NUMPAGES fields) */
  totalPages?: number;
  /** Page width in twips (for tab calculations) */
  pageWidth?: number;
  /** Callback when a bookmark link is clicked */
  onBookmarkClick?: (bookmarkName: string) => void;
  /** Whether to disable links */
  disableLinks?: boolean;
  /** Render function for images (optional override) */
  renderImage?: (image: ImageType, index: number) => ReactNode;
  /** Render function for shapes (optional override) */
  renderShape?: (shape: ShapeType, index: number) => ReactNode;
  /** Render function for text boxes (optional override) */
  renderTextBox?: (textBox: TextBoxType, index: number) => ReactNode;
  /** Index for key generation */
  index?: number;
}

/**
 * Default bullet characters by level
 * Follows common Word default patterns
 */
const DEFAULT_BULLETS: string[] = [
  '•', // Level 0: Solid bullet
  '○', // Level 1: Circle
  '▪', // Level 2: Square
  '•', // Level 3: Solid bullet
  '○', // Level 4: Circle
  '▪', // Level 5: Square
  '•', // Level 6: Solid bullet
  '○', // Level 7: Circle
  '▪', // Level 8: Square
];

/**
 * Map of special Unicode characters used in OOXML bullets
 */
const BULLET_CHAR_MAP: Record<string, string> = {
  // Wingdings characters
  F0A7: '●', // Black circle (Wingdings)
  F0B7: '●', // Another bullet
  F0FC: '✓', // Checkmark
  F06C: '❖', // Diamond
  F076: '●', // Filled circle
  F0A8: '▪', // Small square
  F0D8: '→', // Arrow
  F0E0: '◆', // Diamond
  // Symbol characters
  '2022': '•', // Standard bullet
  '25CB': '○', // White circle
  '25A0': '■', // Black square
  '25AA': '▪', // Small black square
  '25CF': '●', // Black circle
  '2013': '–', // En dash
  '2014': '—', // Em dash
  '203A': '›', // Single right angle quote
  '2192': '→', // Right arrow
  '25BA': '►', // Right pointer
};

/**
 * Base indentation per level in pixels
 */
const INDENT_PER_LEVEL = 36; // About 0.5 inch

/**
 * Marker width in pixels
 */
const MARKER_WIDTH = 24;

/**
 * Gap between marker and content
 */
const MARKER_GAP = 6;

/**
 * ListItem component - renders a paragraph as a list item
 */
export function ListItem({
  paragraph,
  theme,
  className,
  style: additionalStyle,
  levelDefinition,
  counterValue = 1,
  allCounters,
  allFormats,
  pageNumber,
  totalPages,
  pageWidth,
  onBookmarkClick,
  disableLinks = false,
  renderImage,
  renderShape,
  renderTextBox,
  index,
}: ListItemProps): React.ReactElement {
  // Get list rendering info from paragraph
  const listRendering = paragraph.listRendering;

  if (!listRendering) {
    // Not a list item - render as regular paragraph
    return (
      <Paragraph
        paragraph={paragraph}
        theme={theme}
        className={className}
        style={additionalStyle}
        pageNumber={pageNumber}
        totalPages={totalPages}
        pageWidth={pageWidth}
        onBookmarkClick={onBookmarkClick}
        disableLinks={disableLinks}
        renderImage={renderImage}
        renderShape={renderShape}
        renderTextBox={renderTextBox}
        index={index}
      />
    );
  }

  // Compute the marker text
  const marker = computeMarker(
    listRendering,
    levelDefinition,
    counterValue,
    allCounters,
    allFormats
  );

  // Get styles
  const containerStyle = getContainerStyle(listRendering, levelDefinition, additionalStyle);
  const markerStyle = getMarkerStyle(listRendering, levelDefinition, theme);
  const contentStyle = getContentStyle(listRendering, levelDefinition);

  // Build class names
  const classNames = buildClassNames(listRendering, className);

  // Create a modified paragraph without list rendering for content rendering
  // (we handle the marker ourselves)
  const contentParagraph: ParagraphType = {
    ...paragraph,
    listRendering: undefined, // Remove to prevent Paragraph from adding its own marker
  };

  return (
    <div className={classNames} style={containerStyle}>
      {/* List marker */}
      <span className="docx-list-marker" style={markerStyle} aria-hidden="true">
        {marker}
      </span>

      {/* List content */}
      <div className="docx-list-content" style={contentStyle}>
        <Paragraph
          paragraph={contentParagraph}
          theme={theme}
          pageNumber={pageNumber}
          totalPages={totalPages}
          pageWidth={pageWidth}
          onBookmarkClick={onBookmarkClick}
          disableLinks={disableLinks}
          renderImage={renderImage}
          renderShape={renderShape}
          renderTextBox={renderTextBox}
          index={index}
        />
      </div>
    </div>
  );
}

/**
 * Compute the marker text for display
 */
function computeMarker(
  listRendering: ListRendering,
  levelDefinition?: ListLevel | null,
  counterValue: number = 1,
  allCounters?: number[],
  allFormats?: NumberFormat[]
): string {
  // If we already have a computed marker from parsing, use it
  if (listRendering.marker) {
    return listRendering.marker;
  }

  // For bullets, get the bullet character
  if (listRendering.isBullet) {
    if (levelDefinition) {
      return getBulletCharacter(levelDefinition);
    }
    return DEFAULT_BULLETS[listRendering.level % DEFAULT_BULLETS.length];
  }

  // For numbered lists, format the number
  if (levelDefinition) {
    const lvlText = levelDefinition.lvlText || '%1.';
    const numFmt = levelDefinition.numFmt || 'decimal';

    // Check if we have a multi-level pattern (e.g., %1.%2.%3)
    if (lvlText.includes('%') && allCounters && allFormats) {
      return renderMultiLevelMarker(lvlText, allCounters, allFormats);
    }

    // Single level pattern
    const formatted = formatNumber(counterValue, numFmt);
    return lvlText.replace('%1', formatted);
  }

  // Default numbered format
  return `${counterValue}.`;
}

/**
 * Render a multi-level marker pattern (e.g., "1.2.3")
 */
function renderMultiLevelMarker(
  lvlText: string,
  counters: number[],
  formats: NumberFormat[]
): string {
  let result = lvlText;

  // Replace %1 through %9 with formatted counter values
  for (let i = 1; i <= 9; i++) {
    const placeholder = `%${i}`;
    if (result.includes(placeholder)) {
      const counterIndex = i - 1;
      const counter = counters[counterIndex] ?? 1;
      const format = formats[counterIndex] ?? 'decimal';
      const formatted = formatNumber(counter, format);
      result = result.replace(new RegExp(placeholder, 'g'), formatted);
    }
  }

  return result;
}

/**
 * Get container styles for the list item
 */
function getContainerStyle(
  listRendering: ListRendering,
  levelDefinition?: ListLevel | null,
  additionalStyle?: CSSProperties
): CSSProperties {
  const level = listRendering.level;

  // Calculate indentation
  let indent = level * INDENT_PER_LEVEL;

  // Use level definition indentation if available
  if (levelDefinition?.pPr?.indentLeft !== undefined) {
    indent = twipsToPixels(levelDefinition.pPr.indentLeft);
  }

  const style: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    marginLeft: formatPx(indent),
    position: 'relative',
  };

  return mergeStyles(style, additionalStyle);
}

/**
 * Get marker styles
 */
function getMarkerStyle(
  _listRendering: ListRendering,
  levelDefinition?: ListLevel | null,
  theme?: Theme | null
): CSSProperties {
  const style: CSSProperties = {
    display: 'inline-block',
    minWidth: formatPx(MARKER_WIDTH),
    marginRight: formatPx(MARKER_GAP),
    textAlign: 'right',
    flexShrink: 0,
    userSelect: 'none',
  };

  // Apply run properties from level definition for marker styling
  if (levelDefinition?.rPr) {
    const markerFormatting = textToStyle(levelDefinition.rPr, theme);
    Object.assign(style, markerFormatting);
  }

  // Handle justification
  if (levelDefinition?.lvlJc) {
    switch (levelDefinition.lvlJc) {
      case 'left':
        style.textAlign = 'left';
        break;
      case 'center':
        style.textAlign = 'center';
        break;
      case 'right':
        style.textAlign = 'right';
        break;
    }
  }

  // Handle hanging indent (marker width based on hanging indent)
  if (
    levelDefinition?.pPr?.indentFirstLine !== undefined &&
    levelDefinition.pPr.indentFirstLine < 0
  ) {
    const hangingWidth = Math.abs(twipsToPixels(levelDefinition.pPr.indentFirstLine));
    style.minWidth = formatPx(Math.max(hangingWidth, MARKER_WIDTH));
  }

  return style;
}

/**
 * Get content styles
 */
function getContentStyle(
  _listRendering: ListRendering,
  _levelDefinition?: ListLevel | null
): CSSProperties {
  return {
    flex: 1,
    minWidth: 0, // Allow content to shrink
  };
}

/**
 * Build CSS class names for list item
 */
function buildClassNames(listRendering: ListRendering, additionalClass?: string): string {
  const classNames: string[] = ['docx-list-item'];

  if (additionalClass) {
    classNames.push(additionalClass);
  }

  // Level class
  classNames.push(`docx-list-level-${listRendering.level}`);

  // Type class
  if (listRendering.isBullet) {
    classNames.push('docx-list-bullet');
  } else {
    classNames.push('docx-list-numbered');
  }

  return classNames.join(' ');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert a Unicode code point string to its character
 */
export function unicodeToChar(codePoint: string): string {
  // Check our map first
  const mapped = BULLET_CHAR_MAP[codePoint.toUpperCase()];
  if (mapped) {
    return mapped;
  }

  // Try to parse as hex
  try {
    const code = parseInt(codePoint, 16);
    if (!isNaN(code) && code > 0) {
      return String.fromCodePoint(code);
    }
  } catch {
    // Fall through
  }

  return '•'; // Default bullet
}

/**
 * Check if a paragraph should be rendered as a list item
 */
export function isListItemParagraph(paragraph: ParagraphType): boolean {
  return (
    paragraph.listRendering !== undefined ||
    (paragraph.formatting?.numPr?.numId !== undefined && paragraph.formatting?.numPr?.numId !== 0)
  );
}

/**
 * Get the default bullet for a level
 */
export function getDefaultBullet(level: number): string {
  return DEFAULT_BULLETS[level % DEFAULT_BULLETS.length];
}

/**
 * Format a number according to its format type
 * Re-exported from numberingParser for convenience
 */
export { formatNumber } from '../../docx/numberingParser';

/**
 * Format number to Roman numerals (uppercase)
 */
export function toUpperRoman(num: number): string {
  return formatNumber(num, 'upperRoman');
}

/**
 * Format number to Roman numerals (lowercase)
 */
export function toLowerRoman(num: number): string {
  return formatNumber(num, 'lowerRoman');
}

/**
 * Format number to letter (uppercase)
 */
export function toUpperLetter(num: number): string {
  return formatNumber(num, 'upperLetter');
}

/**
 * Format number to letter (lowercase)
 */
export function toLowerLetter(num: number): string {
  return formatNumber(num, 'lowerLetter');
}

/**
 * Get marker for a specific format and value
 */
export function getMarkerForFormat(
  value: number,
  format: NumberFormat,
  lvlText: string = '%1.'
): string {
  if (format === 'bullet' || format === 'none') {
    return DEFAULT_BULLETS[0];
  }

  const formatted = formatNumber(value, format);
  return lvlText.replace('%1', formatted);
}

/**
 * Calculate total list indent in pixels for a level
 */
export function getListIndent(level: number, levelDefinition?: ListLevel | null): number {
  if (levelDefinition?.pPr?.indentLeft !== undefined) {
    return twipsToPixels(levelDefinition.pPr.indentLeft);
  }
  return level * INDENT_PER_LEVEL;
}

/**
 * Get the hanging indent for a list level
 */
export function getHangingIndent(levelDefinition?: ListLevel | null): number {
  if (
    levelDefinition?.pPr?.indentFirstLine !== undefined &&
    levelDefinition.pPr.indentFirstLine < 0
  ) {
    return Math.abs(twipsToPixels(levelDefinition.pPr.indentFirstLine));
  }
  return MARKER_WIDTH + MARKER_GAP;
}

/**
 * Check if a number format represents a bullet list
 */
export function isBulletFormat(format: NumberFormat): boolean {
  return format === 'bullet' || format === 'none';
}

/**
 * Get common bullet characters for UI selection
 */
export function getCommonBulletChars(): string[] {
  return ['•', '○', '▪', '■', '◆', '→', '✓', '★'];
}

/**
 * Get common number formats for UI selection
 */
export function getCommonNumberFormats(): {
  format: NumberFormat;
  label: string;
  example: string;
}[] {
  return [
    { format: 'decimal', label: 'Numbers', example: '1, 2, 3' },
    { format: 'lowerLetter', label: 'Lowercase letters', example: 'a, b, c' },
    { format: 'upperLetter', label: 'Uppercase letters', example: 'A, B, C' },
    { format: 'lowerRoman', label: 'Lowercase Roman', example: 'i, ii, iii' },
    { format: 'upperRoman', label: 'Uppercase Roman', example: 'I, II, III' },
    { format: 'ordinal', label: 'Ordinal', example: '1st, 2nd, 3rd' },
  ];
}

export default ListItem;
