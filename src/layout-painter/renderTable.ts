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
 * Render cell content (paragraphs, etc.)
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
    }
  }

  return contentEl;
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

  // Default cell styling (can be overridden by cell properties)
  cellEl.style.border = '1px solid #000';
  cellEl.style.boxSizing = 'border-box';
  cellEl.style.padding = '2px 4px';

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
  let x = 0;
  for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex++) {
    const cell = row.cells[cellIndex];
    const cellMeasure = rowMeasure.cells[cellIndex];

    if (!cell || !cellMeasure) continue;

    const cellEl = renderTableCell(cell, cellMeasure, x, rowMeasure.height, context, doc);
    cellEl.dataset.cellIndex = String(cellIndex);
    rowEl.appendChild(cellEl);

    // Move x by cell width (accounting for colSpan)
    const colSpan = cell.colSpan ?? 1;
    for (let c = 0; c < colSpan && cellIndex + c < columnWidths.length; c++) {
      x += columnWidths[cellIndex + c] ?? 0;
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
