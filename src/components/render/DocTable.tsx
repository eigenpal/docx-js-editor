/**
 * DocTable Component
 *
 * Renders a complete table from DOCX documents with full styling.
 * Supports:
 * - Table-level styling (width, alignment, borders, cell margins)
 * - Row-level styling (height, header rows)
 * - Cell-level styling (borders, shading, vertical alignment, padding)
 * - Horizontal cell merging (gridSpan/colspan)
 * - Vertical cell merging (vMerge/rowspan)
 * - Nested tables
 */

import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  Table,
  TableRow,
  TableCell,
  TableFormatting,
  TableRowFormatting,
  TableCellFormatting,
  Theme,
  Paragraph,
} from '../../types/document';
import {
  tableCellToStyle,
  borderToStyle,
  resolveShadingFill,
} from '../../utils/formatToStyle';
import { twipsToPixels, formatPx } from '../../utils/units';
import {
  getTableColumnCount,
  getTableRowCount,
  isCellMergeContinuation,
  isCellMergeStart,
  hasHeaderRow,
} from '../../docx/tableParser';

/**
 * Props for the DocTable component
 */
export interface DocTableProps {
  /** The table data to render */
  table: Table;
  /** Theme for resolving colors and fonts */
  theme?: Theme | null;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Render function for paragraph content */
  renderParagraph?: (paragraph: Paragraph, index: number) => ReactNode;
  /** Render function for nested tables */
  renderTable?: (table: Table, index: number) => ReactNode;
  /** Index for key generation */
  index?: number;
}

/**
 * Default table style
 */
const DEFAULT_TABLE_STYLE: CSSProperties = {
  borderCollapse: 'collapse',
  width: 'auto',
  tableLayout: 'fixed',
};

/**
 * DocTable component - renders a complete table with all styling
 */
export function DocTable({
  table,
  theme,
  className,
  style: additionalStyle,
  renderParagraph,
  renderTable: renderNestedTable,
  index: tableIndex,
}: DocTableProps): React.ReactElement {
  // Calculate rowspans for vertical merges
  const rowspanMap = calculateRowspans(table);

  // Build class names
  const classNames: string[] = ['docx-table'];
  if (className) {
    classNames.push(className);
  }

  // Add style reference class if present
  if (table.formatting?.styleId) {
    classNames.push(`docx-table-style-${table.formatting.styleId}`);
  }

  // Add table layout class
  if (table.formatting?.layout === 'fixed') {
    classNames.push('docx-table-fixed');
  } else {
    classNames.push('docx-table-auto');
  }

  // Build table style
  const tableStyle = buildTableStyle(table.formatting, theme);
  const combinedStyle: CSSProperties = {
    ...DEFAULT_TABLE_STYLE,
    ...tableStyle,
    ...additionalStyle,
  };

  // Render colgroup for column widths if available
  const colgroup = table.columnWidths && table.columnWidths.length > 0 ? (
    <colgroup>
      {table.columnWidths.map((width, colIndex) => (
        <col
          key={`col-${colIndex}`}
          style={{ width: formatPx(twipsToPixels(width)) }}
        />
      ))}
    </colgroup>
  ) : null;

  // Separate header rows and body rows
  const headerRows = table.rows.filter((row) => row.formatting?.header === true);
  const bodyRows = table.rows.filter((row) => row.formatting?.header !== true);

  // If no explicit headers but we have rows, check if first row should be header
  // based on table look or style
  const effectiveHeaderRows = headerRows.length > 0 ? headerRows : [];
  const effectiveBodyRows = headerRows.length > 0 ? bodyRows : table.rows;

  return (
    <table
      className={classNames.join(' ')}
      style={combinedStyle}
      data-table-index={tableIndex}
    >
      {colgroup}
      {effectiveHeaderRows.length > 0 && (
        <thead className="docx-table-header">
          {effectiveHeaderRows.map((row, rowIndex) =>
            renderRow(
              row,
              rowIndex,
              rowspanMap,
              table,
              theme,
              renderParagraph,
              renderNestedTable
            )
          )}
        </thead>
      )}
      <tbody className="docx-table-body">
        {effectiveBodyRows.map((row, rowIndex) =>
          renderRow(
            row,
            headerRows.length + rowIndex,
            rowspanMap,
            table,
            theme,
            renderParagraph,
            renderNestedTable
          )
        )}
      </tbody>
    </table>
  );
}

/**
 * Render a table row
 */
function renderRow(
  row: TableRow,
  rowIndex: number,
  rowspanMap: Map<string, number>,
  table: Table,
  theme: Theme | null | undefined,
  renderParagraph?: (paragraph: Paragraph, index: number) => ReactNode,
  renderNestedTable?: (table: Table, index: number) => ReactNode
): React.ReactElement {
  const rowStyle = buildRowStyle(row.formatting, theme);

  // Build row class names
  const rowClassNames: string[] = ['docx-table-row'];
  if (row.formatting?.header) {
    rowClassNames.push('docx-table-row-header');
  }
  if (row.formatting?.cantSplit) {
    rowClassNames.push('docx-table-row-cantsplit');
  }

  // Track actual column position (accounting for colspans)
  let colIndex = 0;

  return (
    <tr
      key={`row-${rowIndex}`}
      className={rowClassNames.join(' ')}
      style={rowStyle}
    >
      {row.cells.map((cell, cellIndex) => {
        // Check if this cell should be skipped due to vMerge continuation
        if (isCellMergeContinuation(cell)) {
          // Skip this cell in rendering - it's covered by a rowspan above
          colIndex += cell.formatting?.gridSpan ?? 1;
          return null;
        }

        // Get rowspan from pre-calculated map
        const cellKey = `${rowIndex}-${colIndex}`;
        const rowspan = rowspanMap.get(cellKey) || 1;

        // Get colspan from gridSpan
        const colspan = cell.formatting?.gridSpan ?? 1;

        const rendered = renderCell(
          cell,
          rowIndex,
          cellIndex,
          colIndex,
          colspan,
          rowspan,
          table,
          theme,
          renderParagraph,
          renderNestedTable
        );

        // Advance column position
        colIndex += colspan;

        return rendered;
      })}
    </tr>
  );
}

/**
 * Render a table cell
 */
function renderCell(
  cell: TableCell,
  rowIndex: number,
  cellIndex: number,
  colIndex: number,
  colspan: number,
  rowspan: number,
  table: Table,
  theme: Theme | null | undefined,
  renderParagraph?: (paragraph: Paragraph, index: number) => ReactNode,
  renderNestedTable?: (table: Table, index: number) => ReactNode
): React.ReactElement {
  // Build cell style
  const cellStyle = buildCellStyle(cell.formatting, table.formatting, theme);

  // Build cell class names
  const cellClassNames: string[] = ['docx-table-cell'];
  if (cell.formatting?.verticalAlign) {
    cellClassNames.push(`docx-cell-valign-${cell.formatting.verticalAlign}`);
  }
  if (cell.formatting?.vMerge === 'restart') {
    cellClassNames.push('docx-cell-vmerge-start');
  }
  if (colspan > 1) {
    cellClassNames.push('docx-cell-colspan');
  }
  if (rowspan > 1) {
    cellClassNames.push('docx-cell-rowspan');
  }

  // Render cell content
  const content = cell.content.map((item, contentIndex) => {
    if (item.type === 'paragraph') {
      if (renderParagraph) {
        return (
          <React.Fragment key={`cell-${rowIndex}-${cellIndex}-content-${contentIndex}`}>
            {renderParagraph(item, contentIndex)}
          </React.Fragment>
        );
      }
      // Default: just show placeholder
      return (
        <div key={`cell-${rowIndex}-${cellIndex}-content-${contentIndex}`} className="docx-cell-paragraph">
          {getParagraphTextContent(item)}
        </div>
      );
    } else if (item.type === 'table') {
      // Nested table
      if (renderNestedTable) {
        return (
          <React.Fragment key={`cell-${rowIndex}-${cellIndex}-table-${contentIndex}`}>
            {renderNestedTable(item, contentIndex)}
          </React.Fragment>
        );
      }
      // Default: render nested table
      return (
        <DocTable
          key={`cell-${rowIndex}-${cellIndex}-table-${contentIndex}`}
          table={item}
          theme={theme}
          className="docx-table-nested"
          renderParagraph={renderParagraph}
          renderTable={renderNestedTable}
          index={contentIndex}
        />
      );
    }
    return null;
  });

  // Use th for header cells, td for regular cells
  const isHeaderRow = rowIndex < (table.rows.filter(r => r.formatting?.header).length);
  const CellTag = isHeaderRow ? 'th' : 'td';

  return (
    <CellTag
      key={`cell-${rowIndex}-${cellIndex}`}
      className={cellClassNames.join(' ')}
      style={cellStyle}
      colSpan={colspan > 1 ? colspan : undefined}
      rowSpan={rowspan > 1 ? rowspan : undefined}
      data-row={rowIndex}
      data-col={colIndex}
    >
      {content}
    </CellTag>
  );
}

/**
 * Build CSS styles for the table
 */
function buildTableStyle(
  formatting: TableFormatting | undefined,
  theme: Theme | null | undefined
): CSSProperties {
  if (!formatting) {
    return {};
  }

  const style: CSSProperties = {};

  // Table width
  if (formatting.width) {
    if (formatting.width.type === 'pct') {
      // Percentage: value is in 50ths of a percent
      style.width = `${formatting.width.value / 50}%`;
    } else if (formatting.width.type === 'dxa' && formatting.width.value > 0) {
      style.width = formatPx(twipsToPixels(formatting.width.value));
    }
    // 'auto' and 'nil' use default width
  }

  // Table alignment/justification
  if (formatting.justification) {
    switch (formatting.justification) {
      case 'center':
        style.marginLeft = 'auto';
        style.marginRight = 'auto';
        break;
      case 'right':
        style.marginLeft = 'auto';
        break;
      case 'left':
      default:
        style.marginRight = 'auto';
        break;
    }
  }

  // Table indent
  if (formatting.indent && formatting.indent.type === 'dxa') {
    style.marginLeft = formatPx(twipsToPixels(formatting.indent.value));
  }

  // Cell spacing (border-spacing in CSS)
  if (formatting.cellSpacing && formatting.cellSpacing.type === 'dxa') {
    style.borderCollapse = 'separate';
    style.borderSpacing = formatPx(twipsToPixels(formatting.cellSpacing.value));
  }

  // Table background/shading
  if (formatting.shading) {
    const bgColor = resolveShadingFill(formatting.shading, theme);
    if (bgColor) {
      style.backgroundColor = bgColor;
    }
  }

  // Table borders (applied to all cells by default, can be overridden)
  if (formatting.borders) {
    // For table-level borders, we set them as CSS variables or apply to specific cells
    // Border-collapse tables require borders on cells, not the table
    // We'll handle this in cell styles
  }

  // Right-to-left table
  if (formatting.bidi) {
    style.direction = 'rtl';
  }

  return style;
}

/**
 * Build CSS styles for a table row
 */
function buildRowStyle(
  formatting: TableRowFormatting | undefined,
  theme: Theme | null | undefined
): CSSProperties {
  if (!formatting) {
    return {};
  }

  const style: CSSProperties = {};

  // Row height
  if (formatting.height && formatting.height.type === 'dxa') {
    const heightPx = twipsToPixels(formatting.height.value);
    if (formatting.heightRule === 'exact') {
      style.height = formatPx(heightPx);
    } else {
      // 'atLeast' or default
      style.minHeight = formatPx(heightPx);
    }
  }

  // Hidden row
  if (formatting.hidden) {
    style.display = 'none';
  }

  return style;
}

/**
 * Build CSS styles for a table cell
 */
function buildCellStyle(
  formatting: TableCellFormatting | undefined,
  tableFormatting: TableFormatting | undefined,
  theme: Theme | null | undefined
): CSSProperties {
  // Start with base cell style from formatToStyle utility
  const baseStyle = tableCellToStyle(formatting, theme);
  const style: CSSProperties = { ...baseStyle };

  // Cell width
  if (formatting?.width) {
    if (formatting.width.type === 'pct') {
      style.width = `${formatting.width.value / 50}%`;
    } else if (formatting.width.type === 'dxa' && formatting.width.value > 0) {
      style.width = formatPx(twipsToPixels(formatting.width.value));
    }
  }

  // Apply table-level default cell margins if cell doesn't have its own
  if (!formatting?.margins && tableFormatting?.cellMargins) {
    const margins = tableFormatting.cellMargins;
    if (margins.top?.value) {
      style.paddingTop = formatPx(twipsToPixels(margins.top.value));
    }
    if (margins.bottom?.value) {
      style.paddingBottom = formatPx(twipsToPixels(margins.bottom.value));
    }
    if (margins.left?.value) {
      style.paddingLeft = formatPx(twipsToPixels(margins.left.value));
    }
    if (margins.right?.value) {
      style.paddingRight = formatPx(twipsToPixels(margins.right.value));
    }
  }

  // Apply table-level default borders if cell doesn't have its own
  if (!formatting?.borders && tableFormatting?.borders) {
    const borders = tableFormatting.borders;
    // Apply inside borders to non-edge cells and outside borders to edge cells
    // For simplicity, apply all borders (in a real implementation, we'd check position)
    if (borders.insideH) {
      Object.assign(style, borderToStyle(borders.insideH, 'Top', theme));
      Object.assign(style, borderToStyle(borders.insideH, 'Bottom', theme));
    }
    if (borders.insideV) {
      Object.assign(style, borderToStyle(borders.insideV, 'Left', theme));
      Object.assign(style, borderToStyle(borders.insideV, 'Right', theme));
    }
    if (borders.top) {
      Object.assign(style, borderToStyle(borders.top, 'Top', theme));
    }
    if (borders.bottom) {
      Object.assign(style, borderToStyle(borders.bottom, 'Bottom', theme));
    }
    if (borders.left) {
      Object.assign(style, borderToStyle(borders.left, 'Left', theme));
    }
    if (borders.right) {
      Object.assign(style, borderToStyle(borders.right, 'Right', theme));
    }
  }

  // No wrap
  if (formatting?.noWrap) {
    style.whiteSpace = 'nowrap';
  }

  // Fit text
  if (formatting?.fitText) {
    style.overflow = 'hidden';
    style.textOverflow = 'ellipsis';
  }

  return style;
}

/**
 * Calculate rowspans for vertical merges
 *
 * Scans the table and creates a map of cell positions to rowspan values.
 * Cells with vMerge="restart" get the calculated rowspan.
 */
function calculateRowspans(table: Table): Map<string, number> {
  const rowspanMap = new Map<string, number>();

  // For each column, track where vertical merges start
  const colCount = getTableColumnCount(table);

  // Track for each column: the row where merge started
  const mergeStartRows: (number | null)[] = new Array(colCount).fill(null);

  for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
    const row = table.rows[rowIndex];
    let colIndex = 0;

    for (const cell of row.cells) {
      const colspan = cell.formatting?.gridSpan ?? 1;

      if (isCellMergeStart(cell)) {
        // This cell starts a vertical merge
        for (let c = 0; c < colspan; c++) {
          mergeStartRows[colIndex + c] = rowIndex;
        }
      } else if (isCellMergeContinuation(cell)) {
        // This cell continues a merge - do nothing special here
      } else {
        // Regular cell - if there was an active merge, finalize it
        for (let c = 0; c < colspan; c++) {
          const startRow = mergeStartRows[colIndex + c];
          if (startRow !== null) {
            // Calculate rowspan for the starting cell
            const key = `${startRow}-${colIndex + c}`;
            const currentRowspan = rowspanMap.get(key) || 1;
            rowspanMap.set(key, rowIndex - startRow);
            mergeStartRows[colIndex + c] = null;
          }
        }
      }

      colIndex += colspan;
    }
  }

  // Finalize any remaining merges at the end of the table
  for (let c = 0; c < colCount; c++) {
    const startRow = mergeStartRows[c];
    if (startRow !== null) {
      const key = `${startRow}-${c}`;
      rowspanMap.set(key, table.rows.length - startRow);
    }
  }

  return rowspanMap;
}

/**
 * Get plain text content from a paragraph (simplified)
 */
function getParagraphTextContent(paragraph: Paragraph): string {
  const parts: string[] = [];

  for (const content of paragraph.content) {
    if (content.type === 'run') {
      for (const item of content.content) {
        if (item.type === 'text') {
          parts.push(item.text);
        }
      }
    }
  }

  return parts.join('') || '\u00A0'; // Use non-breaking space for empty cells
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the number of columns in a table
 */
export { getTableColumnCount };

/**
 * Get the number of rows in a table
 */
export { getTableRowCount };

/**
 * Check if table has header row(s)
 */
export { hasHeaderRow };

/**
 * Check if a cell is empty
 *
 * @param cell - The cell to check
 * @returns true if cell has no content
 */
export function isCellEmpty(cell: TableCell): boolean {
  if (cell.content.length === 0) return true;

  return cell.content.every((item) => {
    if (item.type === 'paragraph') {
      return item.content.length === 0 || item.content.every((c) => {
        if (c.type === 'run') {
          return c.content.length === 0 || c.content.every(
            (rc) => rc.type === 'text' && rc.text.trim() === ''
          );
        }
        return true;
      });
    }
    return false;
  });
}

/**
 * Get the plain text content of a table
 *
 * @param table - The table to extract text from
 * @returns Plain text with tabs between cells and newlines between rows
 */
export function getTableTextContent(table: Table): string {
  const rows: string[] = [];

  for (const row of table.rows) {
    const cells: string[] = [];
    for (const cell of row.cells) {
      const cellText = cell.content
        .filter((c): c is Paragraph => c.type === 'paragraph')
        .map(getParagraphTextContent)
        .join('\n');
      cells.push(cellText);
    }
    rows.push(cells.join('\t'));
  }

  return rows.join('\n');
}

/**
 * Check if table is a simple grid (no merged cells)
 *
 * @param table - The table to check
 * @returns true if no cells are merged
 */
export function isSimpleGrid(table: Table): boolean {
  for (const row of table.rows) {
    for (const cell of row.cells) {
      if ((cell.formatting?.gridSpan ?? 1) > 1) return false;
      if (cell.formatting?.vMerge) return false;
    }
  }
  return true;
}

/**
 * Get table dimensions
 *
 * @param table - The table to measure
 * @returns Object with rows and columns count
 */
export function getTableDimensions(table: Table): { rows: number; columns: number } {
  return {
    rows: getTableRowCount(table),
    columns: getTableColumnCount(table),
  };
}

export default DocTable;
