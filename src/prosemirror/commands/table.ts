/**
 * ProseMirror Table Commands
 *
 * Commands for inserting and manipulating tables:
 * - Insert table
 * - Add/delete rows and columns
 * - Merge/split cells
 * - Table context detection
 */

import { TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import { Node as PMNode } from 'prosemirror-model';
import { schema } from '../schema';

// ============================================================================
// TABLE CONTEXT DETECTION
// ============================================================================

/**
 * Table context information
 */
export interface TableContextInfo {
  /** Whether the cursor is inside a table */
  isInTable: boolean;
  /** The table node (if in table) */
  table?: PMNode;
  /** Position of the table in the document */
  tablePos?: number;
  /** Current row index (0-based) */
  rowIndex?: number;
  /** Current column index (0-based) */
  columnIndex?: number;
  /** Total number of rows */
  rowCount?: number;
  /** Total number of columns */
  columnCount?: number;
  /** Whether multiple cells are selected */
  hasMultiCellSelection?: boolean;
  /** Whether current cell can be split */
  canSplitCell?: boolean;
}

/**
 * Check if the selection is inside a table
 */
export function isInTable(state: EditorState): boolean {
  const { $from } = state.selection;

  // Walk up the node tree to find a table
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'table') {
      return true;
    }
  }
  return false;
}

/**
 * Get table context information from the current selection
 */
export function getTableContext(state: EditorState): TableContextInfo {
  const { $from } = state.selection;

  // Walk up the node tree to find table structure
  let table: PMNode | undefined;
  let tablePos: number | undefined;
  let rowIndex: number | undefined;
  let columnIndex: number | undefined;
  let cellNode: PMNode | undefined;

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    const pos = $from.before(d);

    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      cellNode = node;
      // Find column index by counting siblings
      const rowNode = $from.node(d - 1);
      if (rowNode && rowNode.type.name === 'tableRow') {
        let colIdx = 0;
        let found = false;
        rowNode.forEach((child, _offset, idx) => {
          if (!found) {
            if (idx === $from.index(d - 1)) {
              columnIndex = colIdx;
              found = true;
            } else {
              colIdx += child.attrs.colspan || 1;
            }
          }
        });
      }
    } else if (node.type.name === 'tableRow') {
      // Find row index by counting siblings
      const tableNode = $from.node(d - 1);
      if (tableNode && tableNode.type.name === 'table') {
        rowIndex = $from.index(d - 1);
      }
    } else if (node.type.name === 'table') {
      table = node;
      tablePos = pos;
      break;
    }
  }

  if (!table) {
    return { isInTable: false };
  }

  // Count rows and columns
  let rowCount = 0;
  let columnCount = 0;

  table.forEach((row) => {
    if (row.type.name === 'tableRow') {
      rowCount++;
      let cols = 0;
      row.forEach((cell) => {
        cols += cell.attrs.colspan || 1;
      });
      columnCount = Math.max(columnCount, cols);
    }
  });

  // Check if cell can be split
  const canSplitCell =
    cellNode && ((cellNode.attrs.colspan || 1) > 1 || (cellNode.attrs.rowspan || 1) > 1);

  return {
    isInTable: true,
    table,
    tablePos,
    rowIndex,
    columnIndex,
    rowCount,
    columnCount,
    hasMultiCellSelection: false, // TODO: Detect multi-cell selection
    canSplitCell: !!canSplitCell,
  };
}

// ============================================================================
// INSERT TABLE
// ============================================================================

/**
 * Create an empty table with the specified dimensions
 * Sets equal width for all columns and borders with specified color
 *
 * @param rows - Number of rows
 * @param cols - Number of columns
 * @param borderColor - Border color in hex (without #), defaults to black '000000'
 */
export function createTable(rows: number, cols: number, borderColor: string = '000000'): PMNode {
  const tableRows: PMNode[] = [];
  // Calculate equal width percentage for each column
  const colWidthPercent = Math.floor(100 / cols);

  // Default borders for all cells (all sides enabled)
  const defaultBorders = { top: true, bottom: true, left: true, right: true };

  for (let r = 0; r < rows; r++) {
    const cells: PMNode[] = [];
    for (let c = 0; c < cols; c++) {
      // Each cell contains at least one paragraph
      const paragraph = schema.nodes.paragraph.create();
      // Set width on first row cells to define column widths
      // All cells get borders with the specified color
      const cellAttrs: any = {
        colspan: 1,
        rowspan: 1,
        borders: defaultBorders,
        borderColor: borderColor,
      };
      if (r === 0) {
        cellAttrs.width = colWidthPercent;
        cellAttrs.widthType = 'pct';
      }
      cells.push(schema.nodes.tableCell.create(cellAttrs, paragraph));
    }
    tableRows.push(schema.nodes.tableRow.create(null, cells));
  }

  return schema.nodes.table.create(null, tableRows);
}

/**
 * Insert a table at the current selection
 * Also inserts an empty paragraph after the table to ensure cursor can be placed after it
 * Uses the current text color (from toolbar) for table borders
 */
export function insertTable(
  rows: number,
  cols: number
): (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean {
  return (state, dispatch) => {
    const { $from } = state.selection;

    // Get current text color from stored marks or selection marks
    // This allows table borders to match the current text color in toolbar
    let borderColor = '000000'; // Default to black
    const marks = state.storedMarks || $from.marks();
    for (const mark of marks) {
      if (mark.type.name === 'textColor' && mark.attrs.rgb) {
        borderColor = mark.attrs.rgb;
        break;
      }
    }

    // Find a position where we can insert a block
    let insertPos = $from.pos;

    // If we're in a table, insert after the table
    const tableContext = getTableContext(state);
    if (tableContext.isInTable && tableContext.tablePos !== undefined && tableContext.table) {
      insertPos = tableContext.tablePos + tableContext.table.nodeSize;
    } else {
      // Find the end of the current block
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.spec.group === 'block' || d === 1) {
          insertPos = $from.after(d);
          break;
        }
      }
    }

    if (dispatch) {
      const table = createTable(rows, cols, borderColor);
      // Create an empty paragraph to place after the table
      // This ensures the cursor can always be positioned after the table
      const emptyParagraph = schema.nodes.paragraph.create();

      // Insert both table and trailing paragraph
      const tr = state.tr.insert(insertPos, [table, emptyParagraph]);

      // Set selection to the first cell of the new table
      // Table starts at insertPos, first row at insertPos+1, first cell at insertPos+2
      // Inside the cell, the paragraph is at +1, so cursor position is insertPos+3
      const tableStartPos = insertPos + 1; // Inside table
      const firstCellPos = tableStartPos + 1; // Inside first row
      const firstCellContentPos = firstCellPos + 1; // Inside first cell (paragraph)
      tr.setSelection(TextSelection.create(tr.doc, firstCellContentPos));

      dispatch(tr.scrollIntoView());
    }

    return true;
  };
}

// ============================================================================
// ROW OPERATIONS
// ============================================================================

/**
 * Add a row above the current row
 */
export function addRowAbove(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const context = getTableContext(state);
  if (
    !context.isInTable ||
    context.rowIndex === undefined ||
    !context.table ||
    context.tablePos === undefined
  ) {
    return false;
  }

  if (dispatch) {
    const tr = state.tr;

    // Find the row to copy structure from
    const rowNode = context.table.child(context.rowIndex);

    // Create new row with empty cells matching the structure
    const cells: PMNode[] = [];
    rowNode.forEach((cell) => {
      const paragraph = schema.nodes.paragraph.create();
      cells.push(
        schema.nodes.tableCell.create({ colspan: cell.attrs.colspan || 1, rowspan: 1 }, paragraph)
      );
    });
    const newRow = schema.nodes.tableRow.create(null, cells);

    // Calculate position to insert
    let rowPos = context.tablePos + 1; // +1 for the table node itself
    for (let i = 0; i < context.rowIndex; i++) {
      rowPos += context.table.child(i).nodeSize;
    }

    tr.insert(rowPos, newRow);
    dispatch(tr.scrollIntoView());
  }

  return true;
}

/**
 * Add a row below the current row
 */
export function addRowBelow(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const context = getTableContext(state);
  if (
    !context.isInTable ||
    context.rowIndex === undefined ||
    !context.table ||
    context.tablePos === undefined
  ) {
    return false;
  }

  if (dispatch) {
    const tr = state.tr;

    // Find the row to copy structure from
    const rowNode = context.table.child(context.rowIndex);

    // Create new row with empty cells matching the structure
    const cells: PMNode[] = [];
    rowNode.forEach((cell) => {
      const paragraph = schema.nodes.paragraph.create();
      cells.push(
        schema.nodes.tableCell.create({ colspan: cell.attrs.colspan || 1, rowspan: 1 }, paragraph)
      );
    });
    const newRow = schema.nodes.tableRow.create(null, cells);

    // Calculate position to insert (after current row)
    let rowPos = context.tablePos + 1;
    for (let i = 0; i <= context.rowIndex; i++) {
      rowPos += context.table.child(i).nodeSize;
    }

    tr.insert(rowPos, newRow);
    dispatch(tr.scrollIntoView());
  }

  return true;
}

/**
 * Delete the current row
 */
export function deleteRow(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const context = getTableContext(state);
  if (
    !context.isInTable ||
    context.rowIndex === undefined ||
    !context.table ||
    context.tablePos === undefined ||
    (context.rowCount || 0) <= 1
  ) {
    return false;
  }

  if (dispatch) {
    const tr = state.tr;

    // Calculate row position
    let rowStart = context.tablePos + 1;
    for (let i = 0; i < context.rowIndex; i++) {
      rowStart += context.table.child(i).nodeSize;
    }
    const rowEnd = rowStart + context.table.child(context.rowIndex).nodeSize;

    tr.delete(rowStart, rowEnd);
    dispatch(tr.scrollIntoView());
  }

  return true;
}

// ============================================================================
// COLUMN OPERATIONS
// ============================================================================

/**
 * Add a column to the left of the current column
 * Recalculates column widths to maintain equal distribution
 */
export function addColumnLeft(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const context = getTableContext(state);
  if (
    !context.isInTable ||
    context.columnIndex === undefined ||
    !context.table ||
    context.tablePos === undefined
  ) {
    return false;
  }

  if (dispatch) {
    let tr = state.tr;

    // Calculate new column count and width
    const newColumnCount = (context.columnCount || 1) + 1;
    const newColWidthPercent = Math.floor(100 / newColumnCount);

    // Insert a cell in each row at the column position
    let rowPos = context.tablePos + 1;
    let rowIndex = 0;

    context.table.forEach((row) => {
      if (row.type.name === 'tableRow') {
        // Find position within row for the new cell
        let cellPos = rowPos + 1; // +1 for the row node
        let colIdx = 0;

        row.forEach((cell) => {
          if (colIdx === context.columnIndex) {
            // Insert new cell here
            const paragraph = schema.nodes.paragraph.create();
            const cellAttrs: any = { colspan: 1, rowspan: 1 };
            if (rowIndex === 0) {
              cellAttrs.width = newColWidthPercent;
              cellAttrs.widthType = 'pct';
            }
            const newCell = schema.nodes.tableCell.create(cellAttrs, paragraph);
            tr = tr.insert(cellPos, newCell);
          }
          cellPos += cell.nodeSize;
          colIdx += cell.attrs.colspan || 1;
        });

        // If column index is at the end, insert after last cell
        if (colIdx <= context.columnIndex!) {
          const paragraph = schema.nodes.paragraph.create();
          const cellAttrs: any = { colspan: 1, rowspan: 1 };
          if (rowIndex === 0) {
            cellAttrs.width = newColWidthPercent;
            cellAttrs.widthType = 'pct';
          }
          const newCell = schema.nodes.tableCell.create(cellAttrs, paragraph);
          tr = tr.insert(cellPos, newCell);
        }

        rowIndex++;
      }
      rowPos += row.nodeSize;
    });

    // Update existing cells in first row to have new widths
    const updatedTable = tr.doc.nodeAt(context.tablePos);
    if (updatedTable && updatedTable.type.name === 'table') {
      const firstRow = updatedTable.child(0);
      if (firstRow && firstRow.type.name === 'tableRow') {
        let cellPos = context.tablePos + 2; // +1 for table, +1 for row
        firstRow.forEach((cell) => {
          if (cell.type.name === 'tableCell' || cell.type.name === 'tableHeader') {
            tr = tr.setNodeMarkup(cellPos, undefined, {
              ...cell.attrs,
              width: newColWidthPercent,
              widthType: 'pct',
            });
          }
          cellPos += cell.nodeSize;
        });
      }
    }

    dispatch(tr.scrollIntoView());
  }

  return true;
}

/**
 * Add a column to the right of the current column
 * Recalculates column widths to maintain equal distribution
 */
export function addColumnRight(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const context = getTableContext(state);
  if (
    !context.isInTable ||
    context.columnIndex === undefined ||
    !context.table ||
    context.tablePos === undefined
  ) {
    return false;
  }

  if (dispatch) {
    let tr = state.tr;

    // Calculate new column count and width
    const newColumnCount = (context.columnCount || 1) + 1;
    const newColWidthPercent = Math.floor(100 / newColumnCount);

    // Insert a cell in each row after the current column
    let rowPos = context.tablePos + 1;
    let rowIndex = 0;

    context.table.forEach((row) => {
      if (row.type.name === 'tableRow') {
        let cellPos = rowPos + 1;
        let colIdx = 0;
        let inserted = false;

        row.forEach((cell) => {
          cellPos += cell.nodeSize;
          colIdx += cell.attrs.colspan || 1;

          if (!inserted && colIdx > context.columnIndex!) {
            // Insert new cell after this cell
            const paragraph = schema.nodes.paragraph.create();
            const cellAttrs: any = { colspan: 1, rowspan: 1 };
            if (rowIndex === 0) {
              cellAttrs.width = newColWidthPercent;
              cellAttrs.widthType = 'pct';
            }
            const newCell = schema.nodes.tableCell.create(cellAttrs, paragraph);
            tr = tr.insert(cellPos, newCell);
            inserted = true;
          }
        });

        // If no cell was after the column, insert at end
        if (!inserted) {
          const paragraph = schema.nodes.paragraph.create();
          const cellAttrs: any = { colspan: 1, rowspan: 1 };
          if (rowIndex === 0) {
            cellAttrs.width = newColWidthPercent;
            cellAttrs.widthType = 'pct';
          }
          const newCell = schema.nodes.tableCell.create(cellAttrs, paragraph);
          tr = tr.insert(cellPos, newCell);
        }

        rowIndex++;
      }
      rowPos += row.nodeSize;
    });

    // Update existing cells in first row to have new widths
    const updatedTable = tr.doc.nodeAt(context.tablePos);
    if (updatedTable && updatedTable.type.name === 'table') {
      const firstRow = updatedTable.child(0);
      if (firstRow && firstRow.type.name === 'tableRow') {
        let cellPos = context.tablePos + 2; // +1 for table, +1 for row
        firstRow.forEach((cell) => {
          if (cell.type.name === 'tableCell' || cell.type.name === 'tableHeader') {
            tr = tr.setNodeMarkup(cellPos, undefined, {
              ...cell.attrs,
              width: newColWidthPercent,
              widthType: 'pct',
            });
          }
          cellPos += cell.nodeSize;
        });
      }
    }

    dispatch(tr.scrollIntoView());
  }

  return true;
}

/**
 * Delete the current column
 * Recalculates column widths to maintain equal distribution
 */
export function deleteColumn(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const context = getTableContext(state);
  if (
    !context.isInTable ||
    context.columnIndex === undefined ||
    !context.table ||
    context.tablePos === undefined ||
    (context.columnCount || 0) <= 1
  ) {
    return false;
  }

  if (dispatch) {
    let tr = state.tr;

    // Calculate new column width after deletion
    const newColumnCount = (context.columnCount || 2) - 1;
    const newColWidthPercent = Math.floor(100 / newColumnCount);

    // Delete cell at column index from each row (process in reverse to maintain positions)
    const deleteOps: { start: number; end: number }[] = [];

    let rowPos = context.tablePos + 1;

    context.table.forEach((row) => {
      if (row.type.name === 'tableRow') {
        let cellPos = rowPos + 1;
        let colIdx = 0;

        row.forEach((cell) => {
          const cellStart = cellPos;
          const cellEnd = cellPos + cell.nodeSize;
          const cellColspan = cell.attrs.colspan || 1;

          // Check if this cell spans the column to delete
          if (colIdx <= context.columnIndex! && context.columnIndex! < colIdx + cellColspan) {
            if (cellColspan > 1) {
              // Reduce colspan instead of deleting
              // For now, just delete - TODO: handle colspan reduction
              deleteOps.push({ start: cellStart, end: cellEnd });
            } else {
              deleteOps.push({ start: cellStart, end: cellEnd });
            }
          }

          cellPos = cellEnd;
          colIdx += cellColspan;
        });
      }
      rowPos += row.nodeSize;
    });

    // Apply deletes in reverse order to maintain positions
    deleteOps.reverse().forEach(({ start, end }) => {
      tr = tr.delete(start, end);
    });

    // Update remaining cells in first row to have new widths
    const updatedTable = tr.doc.nodeAt(context.tablePos);
    if (updatedTable && updatedTable.type.name === 'table') {
      const firstRow = updatedTable.child(0);
      if (firstRow && firstRow.type.name === 'tableRow') {
        let cellPos = context.tablePos + 2; // +1 for table, +1 for row
        firstRow.forEach((cell) => {
          if (cell.type.name === 'tableCell' || cell.type.name === 'tableHeader') {
            tr = tr.setNodeMarkup(cellPos, undefined, {
              ...cell.attrs,
              width: newColWidthPercent,
              widthType: 'pct',
            });
          }
          cellPos += cell.nodeSize;
        });
      }
    }

    dispatch(tr.scrollIntoView());
  }

  return true;
}

// ============================================================================
// TABLE DELETION
// ============================================================================

/**
 * Delete the entire table
 */
export function deleteTable(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const context = getTableContext(state);
  if (!context.isInTable || context.tablePos === undefined || !context.table) {
    return false;
  }

  if (dispatch) {
    const tr = state.tr;
    tr.delete(context.tablePos, context.tablePos + context.table.nodeSize);
    dispatch(tr.scrollIntoView());
  }

  return true;
}

// ============================================================================
// MERGE/SPLIT (SIMPLIFIED)
// ============================================================================

/**
 * Merge selected cells (simplified - for now just returns false)
 * Full implementation would require prosemirror-tables
 */
export function mergeCells(_state: EditorState, _dispatch?: (tr: Transaction) => void): boolean {
  // TODO: Implement proper cell merging with prosemirror-tables
  return false;
}

/**
 * Split the current cell (simplified - for now just returns false)
 * Full implementation would require prosemirror-tables
 */
export function splitCell(_state: EditorState, _dispatch?: (tr: Transaction) => void): boolean {
  // TODO: Implement proper cell splitting with prosemirror-tables
  return false;
}

// ============================================================================
// CELL BORDERS
// ============================================================================

export type BorderPreset = 'all' | 'outside' | 'inside' | 'none';

/**
 * Set borders on the current cell
 * - 'all': show all 4 borders
 * - 'outside': show all 4 borders (same as 'all' for single cell)
 * - 'inside': hide all borders (no "inside" for single cell)
 * - 'none': hide all borders
 */
export function setTableBorders(
  preset: BorderPreset
): (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean {
  return (state, dispatch) => {
    const context = getTableContext(state);
    if (!context.isInTable || context.tablePos === undefined || !context.table) {
      return false;
    }

    if (dispatch) {
      const tr = state.tr;
      const { $from } = state.selection;

      // Find the current cell and update its borders
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
          const pos = $from.before(d);

          // Determine which borders to show based on preset
          let borders: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean };

          switch (preset) {
            case 'all':
            case 'outside': // For single cell, outside = all
              borders = { top: true, bottom: true, left: true, right: true };
              break;
            case 'inside': // For single cell, no inside borders
            case 'none':
              borders = { top: false, bottom: false, left: false, right: false };
              break;
          }

          const newAttrs = {
            ...node.attrs,
            borders,
          };
          tr.setNodeMarkup(pos, undefined, newAttrs);
          dispatch(tr.scrollIntoView());
          return true;
        }
      }
    }

    return true;
  };
}

/**
 * Remove all borders from the table
 */
export function removeTableBorders(
  state: EditorState,
  dispatch?: (tr: Transaction) => void
): boolean {
  return setTableBorders('none')(state, dispatch);
}

/**
 * Set all borders on the table
 */
export function setAllTableBorders(
  state: EditorState,
  dispatch?: (tr: Transaction) => void
): boolean {
  return setTableBorders('all')(state, dispatch);
}

/**
 * Set outside borders only
 */
export function setOutsideTableBorders(
  state: EditorState,
  dispatch?: (tr: Transaction) => void
): boolean {
  return setTableBorders('outside')(state, dispatch);
}

/**
 * Set inside borders only
 */
export function setInsideTableBorders(
  state: EditorState,
  dispatch?: (tr: Transaction) => void
): boolean {
  return setTableBorders('inside')(state, dispatch);
}

// ============================================================================
// CELL STYLING (FILL COLOR, BORDER COLOR)
// ============================================================================

/**
 * Set cell background/fill color
 */
export function setCellFillColor(
  color: string | null
): (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean {
  return (state, dispatch) => {
    const context = getTableContext(state);
    if (!context.isInTable || context.tablePos === undefined || !context.table) {
      return false;
    }

    if (dispatch) {
      const tr = state.tr;

      // Find the current cell and update its fill color
      const { $from } = state.selection;

      // Walk up to find the cell
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
          const pos = $from.before(d);
          // Strip # from color if present and convert to hex without #
          const bgColor = color ? color.replace(/^#/, '') : null;
          const newAttrs = {
            ...node.attrs,
            backgroundColor: bgColor,
          };
          tr.setNodeMarkup(pos, undefined, newAttrs);
          dispatch(tr.scrollIntoView());
          return true;
        }
      }
    }

    return true;
  };
}

/**
 * Set cell border color (applies to current cell only)
 */
export function setTableBorderColor(
  color: string
): (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean {
  return (state, dispatch) => {
    const context = getTableContext(state);
    if (!context.isInTable || context.tablePos === undefined || !context.table) {
      return false;
    }

    if (dispatch) {
      const tr = state.tr;

      // Find the current cell and update its border color
      const { $from } = state.selection;

      // Walk up to find the cell
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
          const pos = $from.before(d);
          const newAttrs = {
            ...node.attrs,
            borderColor: color,
            // Ensure borders are visible when setting color
            borders: node.attrs.borders || { top: true, bottom: true, left: true, right: true },
          };
          tr.setNodeMarkup(pos, undefined, newAttrs);
          dispatch(tr.scrollIntoView());
          return true;
        }
      }
    }

    return true;
  };
}
