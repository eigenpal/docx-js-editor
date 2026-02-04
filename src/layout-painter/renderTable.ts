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

  // Store metadata
  tableEl.dataset.blockId = String(block.id);

  if (block.pmStart !== undefined) {
    tableEl.dataset.pmStart = String(block.pmStart);
  }
  if (block.pmEnd !== undefined) {
    tableEl.dataset.pmEnd = String(block.pmEnd);
  }

  // Render all rows
  let y = 0;
  for (let rowIndex = 0; rowIndex < block.rows.length; rowIndex++) {
    const row = block.rows[rowIndex];
    const rowMeasure = measure.rows[rowIndex];

    if (!row || !rowMeasure) continue;

    const rowEl = renderTableRow(row, rowMeasure, rowIndex, y, measure.columnWidths, context, doc);
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

  if (!border || border.style === 'none' || border.width === 0) {
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
  cellEl.style.padding = '2px 4px';

  // Apply borders - use cell borders if available, otherwise default
  if (cell.borders) {
    applyBorder(cellEl, 'top', cell.borders.top);
    applyBorder(cellEl, 'right', cell.borders.right);
    applyBorder(cellEl, 'bottom', cell.borders.bottom);
    applyBorder(cellEl, 'left', cell.borders.left);
  } else {
    // Default border if no borders specified
    cellEl.style.border = '1px solid #000';
  }

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
 * Render a table row
 */
function renderTableRow(
  row: TableBlock['rows'][number],
  rowMeasure: TableMeasure['rows'][number],
  rowIndex: number,
  y: number,
  columnWidths: number[],
  context: RenderContext,
  doc: Document
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

  // Render cells
  // Track actual column index separately from cell index
  // because cells with colSpan > 1 span multiple columns
  let x = 0;
  let columnIndex = 0;

  for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex++) {
    const cell = row.cells[cellIndex];
    const cellMeasure = rowMeasure.cells[cellIndex];

    if (!cell || !cellMeasure) continue;

    const cellEl = renderTableCell(cell, cellMeasure, x, rowMeasure.height, context, doc);
    cellEl.dataset.cellIndex = String(cellIndex);
    cellEl.dataset.columnIndex = String(columnIndex);
    rowEl.appendChild(cellEl);

    // Move x by the width of columns this cell spans
    const colSpan = cell.colSpan ?? 1;
    for (let c = 0; c < colSpan && columnIndex + c < columnWidths.length; c++) {
      x += columnWidths[columnIndex + c] ?? 0;
    }

    // Advance column index by colSpan
    columnIndex += colSpan;
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

  // Render rows from fragment.fromRow to fragment.toRow
  let y = 0;
  for (let rowIndex = fragment.fromRow; rowIndex < fragment.toRow; rowIndex++) {
    const row = block.rows[rowIndex];
    const rowMeasure = measure.rows[rowIndex];

    if (!row || !rowMeasure) continue;

    const rowEl = renderTableRow(row, rowMeasure, rowIndex, y, measure.columnWidths, context, doc);

    tableEl.appendChild(rowEl);
    y += rowMeasure.height;
  }

  return tableEl;
}
