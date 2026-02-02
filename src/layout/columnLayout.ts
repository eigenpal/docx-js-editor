/**
 * Column Layout
 *
 * Handles multi-column sections:
 * - Distributes content across columns
 * - Handles column breaks
 * - Handles column widths and spacing
 */

import type { SectionProperties, Paragraph, Table, BlockContent, Theme } from '../types/document';
import { twipsToPixels } from '../utils/units';
import { breakIntoLines, type Line } from './lineBreaker';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Column definition
 */
export interface Column {
  /** Column index (0-indexed) */
  index: number;
  /** Width in pixels */
  widthPx: number;
  /** X offset from content area left */
  xPx: number;
  /** Available height in pixels */
  heightPx: number;
  /** Content in this column */
  content: ColumnContent[];
  /** Current Y position (filled height) */
  currentY: number;
}

/**
 * Content in a column
 */
export interface ColumnContent {
  /** Type of content */
  type: 'paragraph' | 'table';
  /** The original block */
  block: Paragraph | Table;
  /** Block index */
  blockIndex: number;
  /** Y position within column */
  y: number;
  /** Height of content */
  height: number;
  /** Lines for paragraphs */
  lines?: Line[];
  /** First line index if continuation */
  startLineIndex?: number;
  /** Whether this continues from previous column */
  isContinuation: boolean;
  /** Whether this continues on next column */
  continuesOnNextColumn: boolean;
}

/**
 * Result of column layout for one page
 */
export interface ColumnLayoutResult {
  /** All columns */
  columns: Column[];
  /** Number of columns */
  columnCount: number;
  /** Total width of all columns */
  totalWidthPx: number;
  /** Whether content overflows to next page */
  hasOverflow: boolean;
  /** Remaining content if overflow */
  overflowContent?: BlockContent[];
  /** Index where overflow starts */
  overflowStartIndex?: number;
}

/**
 * Options for column layout
 */
export interface ColumnLayoutOptions {
  /** Section properties with column info */
  sectionProps: SectionProperties;
  /** Content area height in pixels */
  contentHeightPx: number;
  /** Content area width in pixels */
  contentWidthPx: number;
  /** Theme for font resolution */
  theme?: Theme | null;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Layout content across columns
 *
 * @param content - Content blocks to layout
 * @param options - Layout options
 * @returns Column layout result
 */
export function layoutColumns(
  content: BlockContent[],
  options: ColumnLayoutOptions
): ColumnLayoutResult {
  const { sectionProps, contentHeightPx, contentWidthPx, theme } = options;

  // Get column configuration
  const colConfig = getColumnConfiguration(sectionProps, contentWidthPx);

  // Initialize columns
  const columns: Column[] = colConfig.columns.map((col, index) => ({
    index,
    widthPx: col.widthPx,
    xPx: col.xPx,
    heightPx: contentHeightPx,
    content: [],
    currentY: 0,
  }));

  // Current column index
  let currentColumnIndex = 0;

  // Process each content block
  for (let blockIndex = 0; blockIndex < content.length; blockIndex++) {
    const block = content[blockIndex];

    // Check for column break in paragraph formatting
    if (block.type === 'paragraph' && hasColumnBreak(block)) {
      // Move to next column
      currentColumnIndex++;
      if (currentColumnIndex >= columns.length) {
        // Overflow to next page
        return {
          columns,
          columnCount: columns.length,
          totalWidthPx: contentWidthPx,
          hasOverflow: true,
          overflowContent: content.slice(blockIndex),
          overflowStartIndex: blockIndex,
        };
      }
      continue;
    }

    // Layout block in current column
    const result = layoutBlockInColumn(block, blockIndex, columns[currentColumnIndex], theme);

    if (result.fits) {
      // Block fits in current column
      columns[currentColumnIndex] = result.column;
    } else {
      // Block doesn't fit - try next column or overflow
      if (result.partialContent) {
        // Add partial content to current column
        columns[currentColumnIndex] = result.column;
      }

      // Move to next column
      currentColumnIndex++;

      if (currentColumnIndex >= columns.length) {
        // Overflow to next page
        const remainingBlocks = result.partialContent
          ? [createPartialBlock(block, result.remainingLines)]
          : [block];

        return {
          columns,
          columnCount: columns.length,
          totalWidthPx: contentWidthPx,
          hasOverflow: true,
          overflowContent: [...remainingBlocks, ...content.slice(blockIndex + 1)],
          overflowStartIndex: blockIndex,
        };
      }

      // Layout remaining content in next column
      if (result.remainingLines && block.type === 'paragraph') {
        const continuationResult = layoutLinesInColumn(
          result.remainingLines,
          block,
          blockIndex,
          columns[currentColumnIndex],
          true
        );
        columns[currentColumnIndex] = continuationResult.column;
      } else {
        // Re-layout entire block in new column
        const newResult = layoutBlockInColumn(
          block,
          blockIndex,
          columns[currentColumnIndex],
          theme
        );
        columns[currentColumnIndex] = newResult.column;
      }
    }
  }

  return {
    columns,
    columnCount: columns.length,
    totalWidthPx: contentWidthPx,
    hasOverflow: false,
  };
}

// ============================================================================
// COLUMN CONFIGURATION
// ============================================================================

/**
 * Column configuration from section properties
 */
interface ColumnConfig {
  count: number;
  columns: Array<{ widthPx: number; xPx: number }>;
  spacingPx: number;
  equalWidth: boolean;
}

/**
 * Get column configuration from section properties
 */
function getColumnConfiguration(
  sectionProps: SectionProperties,
  contentWidthPx: number
): ColumnConfig {
  const columnDefs = sectionProps.columns;
  const count = sectionProps.columnCount ?? 1;

  // Default: single column
  if (count <= 1) {
    return {
      count: 1,
      columns: [{ widthPx: contentWidthPx, xPx: 0 }],
      spacingPx: 0,
      equalWidth: true,
    };
  }

  const spacingPx = sectionProps.columnSpace ? twipsToPixels(sectionProps.columnSpace) : 36; // Default ~0.5"
  const equalWidth = sectionProps.equalWidth !== false;

  // Calculate columns
  const columns: Array<{ widthPx: number; xPx: number }> = [];

  if (equalWidth || !columnDefs || columnDefs.length === 0) {
    // Equal width columns
    const totalSpacing = spacingPx * (count - 1);
    const columnWidth = (contentWidthPx - totalSpacing) / count;

    for (let i = 0; i < count; i++) {
      columns.push({
        widthPx: columnWidth,
        xPx: i * (columnWidth + spacingPx),
      });
    }
  } else {
    // Custom column widths
    let currentX = 0;

    for (let i = 0; i < count; i++) {
      const def = columnDefs[i];
      const widthPx = def?.width ? twipsToPixels(def.width) : contentWidthPx / count;
      const colSpacing = def?.space ? twipsToPixels(def.space) : spacingPx;

      columns.push({
        widthPx,
        xPx: currentX,
      });

      currentX += widthPx + (i < count - 1 ? colSpacing : 0);
    }
  }

  return {
    count,
    columns,
    spacingPx,
    equalWidth,
  };
}

// ============================================================================
// BLOCK LAYOUT
// ============================================================================

/**
 * Result of laying out a block in a column
 */
interface BlockLayoutResult {
  /** Updated column */
  column: Column;
  /** Whether block fits entirely */
  fits: boolean;
  /** Whether partial content was added */
  partialContent: boolean;
  /** Remaining lines if split */
  remainingLines?: Line[];
}

/**
 * Layout a block in a column
 */
function layoutBlockInColumn(
  block: BlockContent,
  blockIndex: number,
  column: Column,
  theme: Theme | null | undefined
): BlockLayoutResult {
  if (block.type === 'paragraph') {
    return layoutParagraphInColumn(block, blockIndex, column, theme);
  } else if (block.type === 'table') {
    return layoutTableInColumn(block, blockIndex, column);
  }

  return { column, fits: true, partialContent: false };
}

/**
 * Layout a paragraph in a column
 */
function layoutParagraphInColumn(
  paragraph: Paragraph,
  blockIndex: number,
  column: Column,
  theme: Theme | null | undefined
): BlockLayoutResult {
  const remainingHeight = column.heightPx - column.currentY;

  // Break paragraph into lines
  const lineResult = breakIntoLines(paragraph, {
    maxWidth: column.widthPx,
    firstLineIndent: paragraph.formatting?.indentFirstLine
      ? twipsToPixels(paragraph.formatting.indentFirstLine)
      : 0,
    tabStops: paragraph.formatting?.tabs,
    theme,
    defaultFormatting: paragraph.formatting?.runProperties,
  });

  // Calculate spacing
  const spaceBefore = paragraph.formatting?.spaceBefore
    ? twipsToPixels(paragraph.formatting.spaceBefore)
    : 0;
  const spaceAfter = paragraph.formatting?.spaceAfter
    ? twipsToPixels(paragraph.formatting.spaceAfter)
    : 0;

  const totalHeight = spaceBefore + lineResult.totalHeight + spaceAfter;

  // Check if paragraph fits entirely
  if (totalHeight <= remainingHeight) {
    // Fits entirely
    const content: ColumnContent = {
      type: 'paragraph',
      block: paragraph,
      blockIndex,
      y: column.currentY + spaceBefore,
      height: totalHeight,
      lines: lineResult.lines,
      isContinuation: false,
      continuesOnNextColumn: false,
    };

    return {
      column: {
        ...column,
        content: [...column.content, content],
        currentY: column.currentY + totalHeight,
      },
      fits: true,
      partialContent: false,
    };
  }

  // Paragraph doesn't fit entirely - split it
  const linesToFit: Line[] = [];
  let heightUsed = spaceBefore;

  for (const line of lineResult.lines) {
    if (heightUsed + line.height <= remainingHeight) {
      linesToFit.push(line);
      heightUsed += line.height;
    } else {
      break;
    }
  }

  if (linesToFit.length === 0) {
    // No lines fit - move entire paragraph to next column
    return { column, fits: false, partialContent: false };
  }

  // Add partial content
  const content: ColumnContent = {
    type: 'paragraph',
    block: paragraph,
    blockIndex,
    y: column.currentY + spaceBefore,
    height: heightUsed,
    lines: linesToFit,
    isContinuation: false,
    continuesOnNextColumn: true,
  };

  const remainingLines = lineResult.lines.slice(linesToFit.length);

  return {
    column: {
      ...column,
      content: [...column.content, content],
      currentY: column.currentY + heightUsed,
    },
    fits: false,
    partialContent: true,
    remainingLines,
  };
}

/**
 * Layout lines in a column (for continuation)
 */
function layoutLinesInColumn(
  lines: Line[],
  paragraph: Paragraph,
  blockIndex: number,
  column: Column,
  isContinuation: boolean
): BlockLayoutResult {
  const remainingHeight = column.heightPx - column.currentY;

  const linesToFit: Line[] = [];
  let heightUsed = 0;

  for (const line of lines) {
    if (heightUsed + line.height <= remainingHeight) {
      linesToFit.push(line);
      heightUsed += line.height;
    } else {
      break;
    }
  }

  if (linesToFit.length === 0) {
    return { column, fits: false, partialContent: false };
  }

  const content: ColumnContent = {
    type: 'paragraph',
    block: paragraph,
    blockIndex,
    y: column.currentY,
    height: heightUsed,
    lines: linesToFit,
    startLineIndex: isContinuation ? lines.length - linesToFit.length : 0,
    isContinuation,
    continuesOnNextColumn: linesToFit.length < lines.length,
  };

  const remainingLines = lines.slice(linesToFit.length);

  return {
    column: {
      ...column,
      content: [...column.content, content],
      currentY: column.currentY + heightUsed,
    },
    fits: linesToFit.length >= lines.length,
    partialContent: true,
    remainingLines: remainingLines.length > 0 ? remainingLines : undefined,
  };
}

/**
 * Layout a table in a column
 */
function layoutTableInColumn(table: Table, blockIndex: number, column: Column): BlockLayoutResult {
  const remainingHeight = column.heightPx - column.currentY;

  // Estimate table height
  const estimatedRowHeight = 30;
  const estimatedHeight = table.rows.length * estimatedRowHeight;

  if (estimatedHeight <= remainingHeight) {
    // Table fits
    const content: ColumnContent = {
      type: 'table',
      block: table,
      blockIndex,
      y: column.currentY,
      height: estimatedHeight,
      isContinuation: false,
      continuesOnNextColumn: false,
    };

    return {
      column: {
        ...column,
        content: [...column.content, content],
        currentY: column.currentY + estimatedHeight,
      },
      fits: true,
      partialContent: false,
    };
  }

  // Table doesn't fit - don't split tables (simplified)
  return { column, fits: false, partialContent: false };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if a paragraph has a column break
 */
function hasColumnBreak(paragraph: Paragraph): boolean {
  for (const content of paragraph.content) {
    if (content.type === 'run') {
      for (const item of content.content) {
        if (item.type === 'break' && item.breakType === 'column') {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Create a partial block for overflow (placeholder)
 */
function createPartialBlock(block: BlockContent, _remainingLines?: Line[]): BlockContent {
  // In a real implementation, this would create a new paragraph
  // with only the remaining content
  return block;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get column count from section properties
 */
export function getColumnCount(sectionProps: SectionProperties): number {
  return sectionProps.columnCount ?? 1;
}

/**
 * Check if section has multiple columns
 */
export function isMultiColumn(sectionProps: SectionProperties): boolean {
  return getColumnCount(sectionProps) > 1;
}

/**
 * Get column widths in pixels
 */
export function getColumnWidths(sectionProps: SectionProperties, contentWidthPx: number): number[] {
  const config = getColumnConfiguration(sectionProps, contentWidthPx);
  return config.columns.map((c) => c.widthPx);
}

/**
 * Get column spacing in pixels
 */
export function getColumnSpacing(sectionProps: SectionProperties): number {
  return sectionProps.columnSpace ? twipsToPixels(sectionProps.columnSpace) : 36;
}

/**
 * Check if columns have separator line
 */
export function hasColumnSeparator(sectionProps: SectionProperties): boolean {
  return sectionProps.separator ?? false;
}

/**
 * Get column at X position
 */
export function getColumnAtX(result: ColumnLayoutResult, x: number): Column | null {
  for (const column of result.columns) {
    if (x >= column.xPx && x < column.xPx + column.widthPx) {
      return column;
    }
  }
  return null;
}

/**
 * Get content at position within columns
 */
export function getContentAtPosition(
  result: ColumnLayoutResult,
  x: number,
  y: number
): ColumnContent | null {
  const column = getColumnAtX(result, x);
  if (!column) return null;

  for (const content of column.content) {
    if (y >= content.y && y < content.y + content.height) {
      return content;
    }
  }

  return null;
}

export default layoutColumns;
