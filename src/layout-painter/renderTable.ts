/**
 * Table Renderer
 *
 * Renders table fragments to DOM. Handles:
 * - Multi-row tables split across pages
 * - Cell content (paragraphs within cells)
 * - Column widths and cell spans
 * - Basic cell styling (borders, backgrounds)
 */

import type {
  TableFragment,
  TableBlock,
  TableMeasure,
  TableCell,
  TableCellMeasure,
  ParagraphBlock,
  ParagraphMeasure,
  ParagraphFragment,
} from '../layout-engine/types';
import type { RenderContext } from './renderPage';
import { renderParagraphFragment } from './renderParagraph';

/**
 * CSS class names for table elements
 */
export const TABLE_CLASS_NAMES = {
  table: 'layout-table',
  row: 'layout-table-row',
  cell: 'layout-table-cell',
  cellContent: 'layout-table-cell-content',
  resizeHandle: 'layout-table-resize-handle',
  rowResizeHandle: 'layout-table-row-resize-handle',
  tableEdgeHandleBottom: 'layout-table-edge-handle-bottom',
  tableEdgeHandleRight: 'layout-table-edge-handle-right',
};

/**
 * Options for rendering a table fragment
 */
export interface RenderTableFragmentOptions {
  document?: Document;
}

/**
 * Render cell content (paragraphs and nested tables)
 */
function renderCellContent(
  cell: TableCell,
  cellMeasure: TableCellMeasure,
  context: RenderContext,
  doc: Document
): HTMLElement {
  const contentEl = doc.createElement('div');
  contentEl.className = TABLE_CLASS_NAMES.cellContent;
  contentEl.style.position = 'relative';
  contentEl.style.width = `${cellMeasure.width}px`;

  let cursorY = 0;

  for (let i = 0; i < cell.blocks.length; i++) {
    const block = cell.blocks[i];
    const measure = cellMeasure.blocks[i];

    if (block?.kind === 'paragraph' && measure?.kind === 'paragraph') {
      const paragraphBlock = block as ParagraphBlock;
      const paragraphMeasure = measure as ParagraphMeasure;

      // Create synthetic fragment for the paragraph
      const syntheticFragment: ParagraphFragment = {
        kind: 'paragraph',
        blockId: paragraphBlock.id,
        x: 0,
        y: cursorY,
        width: cellMeasure.width,
        height: paragraphMeasure.totalHeight,
        fromLine: 0,
        toLine: paragraphMeasure.lines.length,
        pmStart: paragraphBlock.pmStart,
        pmEnd: paragraphBlock.pmEnd,
      };

      const fragEl = renderParagraphFragment(
        syntheticFragment,
        paragraphBlock,
        paragraphMeasure,
        context,
        { document: doc }
      );

      fragEl.style.position = 'relative';
      contentEl.appendChild(fragEl);
      cursorY += paragraphMeasure.totalHeight;
    } else if (block?.kind === 'table' && measure?.kind === 'table') {
      // Nested table - render inline
      const tableBlock = block as TableBlock;
      const tableMeasure = measure as TableMeasure;

      const nestedTableEl = renderNestedTable(tableBlock, tableMeasure, context, doc);
      nestedTableEl.style.position = 'relative';
      nestedTableEl.style.marginTop = `${cursorY}px`;
      contentEl.appendChild(nestedTableEl);
      cursorY += tableMeasure.totalHeight;
    }
  }

  return contentEl;
}

/**
 * Render a nested table (within a cell)
 */
function renderNestedTable(
  block: TableBlock,
  measure: TableMeasure,
  context: RenderContext,
  doc: Document
): HTMLElement {
  const tableEl = doc.createElement('div');
  tableEl.className = `${TABLE_CLASS_NAMES.table} layout-nested-table`;

  // Positioning (relative, not absolute)
  tableEl.style.position = 'relative';
  tableEl.style.width = `${measure.totalWidth}px`;
  tableEl.style.display = 'block';

  if (block.justification === 'center') {
    tableEl.style.marginLeft = 'auto';
    tableEl.style.marginRight = 'auto';
  } else if (block.justification === 'right') {
    tableEl.style.marginLeft = 'auto';
  }

  // Store metadata
  tableEl.dataset.blockId = String(block.id);

  if (block.pmStart !== undefined) {
    tableEl.dataset.pmStart = String(block.pmStart);
  }
  if (block.pmEnd !== undefined) {
    tableEl.dataset.pmEnd = String(block.pmEnd);
  }

  // Build row Y positions for rowSpan height calculation
  const rowYPositions: number[] = [];
  let yPos = 0;
  for (let i = 0; i < measure.rows.length; i++) {
    rowYPositions.push(yPos);
    yPos += measure.rows[i]?.height ?? 0;
  }
  rowYPositions.push(yPos);

  // Track spanning cells across rows
  const spanningCells = new Map<string, SpanningCell>();

  // Render all rows
  let y = 0;
  for (let rowIndex = 0; rowIndex < block.rows.length; rowIndex++) {
    const row = block.rows[rowIndex];
    const rowMeasure = measure.rows[rowIndex];

    if (!row || !rowMeasure) continue;

    const rowEl = renderTableRow(
      row,
      rowMeasure,
      rowIndex,
      y,
      measure.columnWidths,
      block.rows.length,
      context,
      doc,
      spanningCells,
      rowYPositions
    );
    tableEl.appendChild(rowEl);
    y += rowMeasure.height;
  }

  tableEl.style.height = `${y}px`;

  return tableEl;
}

/**
 * Apply a single border to an element.
 */
function applyBorder(
  el: HTMLElement,
  side: 'top' | 'right' | 'bottom' | 'left',
  border: { width?: number; color?: string; style?: string } | undefined
): void {
  const styleProp = `border${side.charAt(0).toUpperCase() + side.slice(1)}` as
    | 'borderTop'
    | 'borderRight'
    | 'borderBottom'
    | 'borderLeft';

  if (!border || border.style === 'none' || border.style === 'nil' || border.width === 0) {
    el.style[styleProp] = 'none';
  } else {
    const width = border.width ?? 1;
    const color = border.color ?? '#000000';
    const style = border.style ?? 'solid';
    el.style[styleProp] = `${width}px ${style} ${color}`;
  }
}

/**
 * Render a single table cell
 */
function renderTableCell(
  cell: TableCell,
  cellMeasure: TableCellMeasure,
  x: number,
  rowHeight: number,
  borderFlags: {
    isFirstRow: boolean;
    isLastRow: boolean;
    isFirstCol: boolean;
    isLastCol: boolean;
  },
  context: RenderContext,
  doc: Document
): HTMLElement {
  const cellEl = doc.createElement('div');
  cellEl.className = TABLE_CLASS_NAMES.cell;

  // Positioning
  cellEl.style.position = 'absolute';
  cellEl.style.left = `${x}px`;
  cellEl.style.top = '0';
  cellEl.style.width = `${cellMeasure.width}px`;
  cellEl.style.height = `${rowHeight}px`;
  cellEl.style.overflow = 'hidden';
  cellEl.style.boxSizing = 'border-box';
  // Use per-cell padding from DOCX margins, default to Word's default (0 top/bottom, 7px left/right)
  const padTop = cell.padding?.top ?? 0;
  const padRight = cell.padding?.right ?? 7;
  const padBottom = cell.padding?.bottom ?? 0;
  const padLeft = cell.padding?.left ?? 7;
  cellEl.style.padding = `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`;

  // Apply borders - use cell borders if available, otherwise no border
  if (cell.borders) {
    // Collapse shared borders to avoid double-thick lines.
    // Strategy: "bottom wins" for rows, "right wins" for columns.
    // Each cell's bottom border represents the shared edge with the row below.
    // Each cell's right border represents the shared edge with the column to its right.
    // Only the first row draws its top border (table's top edge).
    // Only the first column draws its left border (table's left edge).
    if (borderFlags.isFirstRow) {
      applyBorder(cellEl, 'top', cell.borders.top);
    }
    applyBorder(cellEl, 'right', cell.borders.right);
    applyBorder(cellEl, 'bottom', cell.borders.bottom);
    if (borderFlags.isFirstCol) applyBorder(cellEl, 'left', cell.borders.left);
  }
  // No default border - cells without explicit borders should be borderless

  // Background color
  if (cell.background) {
    cellEl.style.backgroundColor = cell.background;
  }

  // Vertical alignment
  if (cell.verticalAlign) {
    cellEl.style.display = 'flex';
    cellEl.style.flexDirection = 'column';
    switch (cell.verticalAlign) {
      case 'top':
        cellEl.style.justifyContent = 'flex-start';
        break;
      case 'center':
        cellEl.style.justifyContent = 'center';
        break;
      case 'bottom':
        cellEl.style.justifyContent = 'flex-end';
        break;
    }
  }

  // Render cell content
  const contentEl = renderCellContent(cell, cellMeasure, context, doc);
  cellEl.appendChild(contentEl);

  // Store PM positions for selection
  if (cell.blocks.length > 0) {
    const firstBlock = cell.blocks[0];
    const lastBlock = cell.blocks[cell.blocks.length - 1];
    if (firstBlock && 'pmStart' in firstBlock && firstBlock.pmStart !== undefined) {
      cellEl.dataset.pmStart = String(firstBlock.pmStart);
    }
    if (lastBlock && 'pmEnd' in lastBlock && lastBlock.pmEnd !== undefined) {
      cellEl.dataset.pmEnd = String(lastBlock.pmEnd);
    }
  }

  return cellEl;
}

/**
 * Track cells that span multiple rows
 */
type SpanningCell = {
  cell: TableCell;
  cellMeasure: TableCellMeasure;
  columnIndex: number;
  startRow: number;
  rowSpan: number;
  colSpan: number;
  x: number;
  totalHeight: number;
};

/**
 * Render a table row with rowSpan support
 */
function renderTableRow(
  row: TableBlock['rows'][number],
  rowMeasure: TableMeasure['rows'][number],
  rowIndex: number,
  y: number,
  columnWidths: number[],
  totalRows: number,
  context: RenderContext,
  doc: Document,
  spanningCells?: Map<string, SpanningCell>,
  rowYPositions?: number[]
): HTMLElement {
  const rowEl = doc.createElement('div');
  rowEl.className = TABLE_CLASS_NAMES.row;

  // Positioning
  rowEl.style.position = 'absolute';
  rowEl.style.left = '0';
  rowEl.style.top = `${y}px`;
  rowEl.style.width = '100%';
  rowEl.style.height = `${rowMeasure.height}px`;

  // Data attributes
  rowEl.dataset.rowIndex = String(rowIndex);

  // Build set of columns occupied by spanning cells from previous rows
  const occupiedColumns = new Set<number>();
  if (spanningCells) {
    for (const [, spanCell] of spanningCells) {
      // Check if this spanning cell covers the current row
      if (spanCell.startRow < rowIndex && spanCell.startRow + spanCell.rowSpan > rowIndex) {
        for (let c = 0; c < spanCell.colSpan; c++) {
          occupiedColumns.add(spanCell.columnIndex + c);
        }
      }
    }
  }

  // Render cells
  // Track actual column index separately from cell index
  // because cells with colSpan > 1 span multiple columns
  let x = 0;
  let columnIndex = 0;

  // Skip columns occupied by spanning cells
  while (occupiedColumns.has(columnIndex)) {
    x += columnWidths[columnIndex] ?? 0;
    columnIndex++;
  }

  for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex++) {
    const cell = row.cells[cellIndex];
    const cellMeasure = rowMeasure.cells[cellIndex];

    if (!cell || !cellMeasure) continue;

    const colSpan = cell.colSpan ?? 1;
    const rowSpan = cell.rowSpan ?? 1;

    // Calculate cell height - for spanning cells, use total height of spanned rows
    let cellHeight = rowMeasure.height;
    if (rowSpan > 1 && rowYPositions) {
      cellHeight = 0;
      for (let r = rowIndex; r < rowIndex + rowSpan && r < rowYPositions.length - 1; r++) {
        cellHeight += (rowYPositions[r + 1] ?? 0) - (rowYPositions[r] ?? 0);
      }
      // Fallback if rowYPositions doesn't have enough entries
      if (cellHeight === 0) {
        cellHeight = rowMeasure.height * rowSpan;
      }
    }

    const isFirstRow = rowIndex === 0;
    const isLastRow = rowIndex + rowSpan >= totalRows;
    const isFirstCol = columnIndex === 0;
    const isLastCol = columnIndex + colSpan >= columnWidths.length;

    const cellEl = renderTableCell(
      cell,
      cellMeasure,
      x,
      cellHeight,
      { isFirstRow, isLastRow, isFirstCol, isLastCol },
      context,
      doc
    );
    cellEl.dataset.cellIndex = String(cellIndex);
    cellEl.dataset.columnIndex = String(columnIndex);

    // Store rowSpan info for styling
    if (rowSpan > 1) {
      cellEl.dataset.rowSpan = String(rowSpan);
    }

    rowEl.appendChild(cellEl);

    // Track this cell as spanning if it spans multiple rows
    if (rowSpan > 1 && spanningCells) {
      const key = `${rowIndex}-${columnIndex}`;
      spanningCells.set(key, {
        cell,
        cellMeasure,
        columnIndex,
        startRow: rowIndex,
        rowSpan,
        colSpan,
        x,
        totalHeight: cellHeight,
      });
    }

    // Move x by the width of columns this cell spans
    for (let c = 0; c < colSpan && columnIndex + c < columnWidths.length; c++) {
      x += columnWidths[columnIndex + c] ?? 0;
    }

    // Advance column index by colSpan
    columnIndex += colSpan;

    // Skip columns occupied by spanning cells
    while (occupiedColumns.has(columnIndex)) {
      x += columnWidths[columnIndex] ?? 0;
      columnIndex++;
    }
  }

  return rowEl;
}

/**
 * Render a table fragment to DOM
 *
 * @param fragment - The table fragment to render
 * @param block - The full table block
 * @param measure - The full table measure
 * @param context - Rendering context
 * @param options - Rendering options
 * @returns The table DOM element
 */
export function renderTableFragment(
  fragment: TableFragment,
  block: TableBlock,
  measure: TableMeasure,
  context: RenderContext,
  options: RenderTableFragmentOptions = {}
): HTMLElement {
  const doc = options.document ?? document;

  const tableEl = doc.createElement('div');
  tableEl.className = TABLE_CLASS_NAMES.table;

  // Basic table styling
  tableEl.style.position = 'absolute';
  tableEl.style.width = `${fragment.width}px`;
  tableEl.style.height = `${fragment.height}px`;
  tableEl.style.overflow = 'hidden';

  // Store metadata
  tableEl.dataset.blockId = String(fragment.blockId);
  tableEl.dataset.fromRow = String(fragment.fromRow);
  tableEl.dataset.toRow = String(fragment.toRow);

  if (fragment.pmStart !== undefined) {
    tableEl.dataset.pmStart = String(fragment.pmStart);
  }
  if (fragment.pmEnd !== undefined) {
    tableEl.dataset.pmEnd = String(fragment.pmEnd);
  }

  // Add column resize handles at each column boundary
  let handleX = 0;
  for (let col = 0; col < measure.columnWidths.length - 1; col++) {
    handleX += measure.columnWidths[col] ?? 0;
    const handle = doc.createElement('div');
    handle.className = TABLE_CLASS_NAMES.resizeHandle;
    handle.style.position = 'absolute';
    handle.style.left = `${handleX - 3}px`;
    handle.style.top = '0';
    handle.style.width = '6px';
    handle.style.height = '100%';
    handle.style.cursor = 'col-resize';
    handle.style.zIndex = '10';
    handle.dataset.columnIndex = String(col);
    handle.dataset.tableBlockId = String(fragment.blockId);
    if (fragment.pmStart !== undefined) {
      handle.dataset.tablePmStart = String(fragment.pmStart);
    }
    tableEl.appendChild(handle);
  }

  // Build row Y positions for rowSpan height calculation
  const rowYPositions: number[] = [];
  let yPos = 0;
  for (let i = 0; i < measure.rows.length; i++) {
    rowYPositions.push(yPos);
    yPos += measure.rows[i]?.height ?? 0;
  }
  rowYPositions.push(yPos); // Add final position for height calculation

  // Track spanning cells across rows
  const spanningCells = new Map<string, SpanningCell>();

  // Render rows from fragment.fromRow to fragment.toRow
  let y = 0;
  for (let rowIndex = fragment.fromRow; rowIndex < fragment.toRow; rowIndex++) {
    const row = block.rows[rowIndex];
    const rowMeasure = measure.rows[rowIndex];

    if (!row || !rowMeasure) continue;

    const rowEl = renderTableRow(
      row,
      rowMeasure,
      rowIndex,
      y,
      measure.columnWidths,
      block.rows.length,
      context,
      doc,
      spanningCells,
      rowYPositions
    );

    tableEl.appendChild(rowEl);
    y += rowMeasure.height;
  }

  // Add row resize handles at each row boundary (between consecutive rows)
  let handleY = 0;
  for (let rowIdx = fragment.fromRow; rowIdx < fragment.toRow; rowIdx++) {
    handleY += measure.rows[rowIdx]?.height ?? 0;

    // Don't add a handle after the last row in this fragment (unless it's the table's last row — that's the bottom edge)
    if (rowIdx < fragment.toRow - 1) {
      const rowHandle = doc.createElement('div');
      rowHandle.className = TABLE_CLASS_NAMES.rowResizeHandle;
      rowHandle.style.position = 'absolute';
      rowHandle.style.left = '0';
      rowHandle.style.top = `${handleY - 3}px`;
      rowHandle.style.width = '100%';
      rowHandle.style.height = '6px';
      rowHandle.style.cursor = 'row-resize';
      rowHandle.style.zIndex = '10';
      rowHandle.dataset.rowIndex = String(rowIdx);
      rowHandle.dataset.tableBlockId = String(fragment.blockId);
      if (fragment.pmStart !== undefined) {
        rowHandle.dataset.tablePmStart = String(fragment.pmStart);
      }
      tableEl.appendChild(rowHandle);
    }
  }

  // Bottom edge handle (only on fragments containing the last row)
  if (fragment.toRow === block.rows.length) {
    const bottomHandle = doc.createElement('div');
    bottomHandle.className = TABLE_CLASS_NAMES.tableEdgeHandleBottom;
    bottomHandle.style.position = 'absolute';
    bottomHandle.style.left = '0';
    bottomHandle.style.top = `${handleY - 3}px`;
    bottomHandle.style.width = '100%';
    bottomHandle.style.height = '6px';
    bottomHandle.style.cursor = 'row-resize';
    bottomHandle.style.zIndex = '10';
    bottomHandle.dataset.rowIndex = String(block.rows.length - 1);
    bottomHandle.dataset.tableBlockId = String(fragment.blockId);
    bottomHandle.dataset.isEdge = 'bottom';
    if (fragment.pmStart !== undefined) {
      bottomHandle.dataset.tablePmStart = String(fragment.pmStart);
    }
    tableEl.appendChild(bottomHandle);
  }

  // Right edge handle (only on fragments containing the last row)
  if (fragment.toRow === block.rows.length) {
    const totalWidth = measure.columnWidths.reduce((w, cw) => w + cw, 0);
    const rightHandle = doc.createElement('div');
    rightHandle.className = TABLE_CLASS_NAMES.tableEdgeHandleRight;
    rightHandle.style.position = 'absolute';
    rightHandle.style.left = `${totalWidth - 3}px`;
    rightHandle.style.top = '0';
    rightHandle.style.width = '6px';
    rightHandle.style.height = '100%';
    rightHandle.style.cursor = 'col-resize';
    rightHandle.style.zIndex = '10';
    rightHandle.dataset.columnIndex = String(measure.columnWidths.length - 1);
    rightHandle.dataset.tableBlockId = String(fragment.blockId);
    rightHandle.dataset.isEdge = 'right';
    if (fragment.pmStart !== undefined) {
      rightHandle.dataset.tablePmStart = String(fragment.pmStart);
    }
    tableEl.appendChild(rightHandle);
  }

  return tableEl;
}
