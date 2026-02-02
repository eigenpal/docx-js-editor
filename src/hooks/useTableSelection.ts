/**
 * useTableSelection Hook
 *
 * Tracks table selection state based on user clicks.
 * Provides:
 * - Current table context when clicking in a table cell
 * - Methods to handle table actions (add row, delete column, etc.)
 * - Clears selection when clicking outside tables
 */

import { useState, useCallback } from 'react';
import type { Document, Table } from '../types/document';
import type { TableContext, TableSelection, TableAction } from '../components/ui/TableToolbar';
import {
  createTableContext,
  addRow,
  deleteRow,
  addColumn,
  deleteColumn,
  mergeCells,
  splitCell,
  getColumnCount,
} from '../components/ui/TableToolbar';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Table selection state
 */
export interface TableSelectionState {
  /** Current table context (null if not in a table) */
  context: TableContext | null;
  /** The selected table */
  table: Table | null;
  /** Index of the table in the document */
  tableIndex: number | null;
  /** Row index */
  rowIndex: number | null;
  /** Column index */
  columnIndex: number | null;
}

/**
 * Return type for useTableSelection hook
 */
export interface UseTableSelectionReturn {
  /** Current table selection state */
  state: TableSelectionState;
  /** Handle click on a table cell */
  handleCellClick: (tableIndex: number, rowIndex: number, columnIndex: number) => void;
  /** Handle table action */
  handleAction: (action: TableAction) => void;
  /** Clear the selection */
  clearSelection: () => void;
  /** Check if a cell is selected */
  isCellSelected: (tableIndex: number, rowIndex: number, columnIndex: number) => boolean;
  /** The table context for the TableToolbar */
  tableContext: TableContext | null;
}

/**
 * Options for useTableSelection
 */
export interface UseTableSelectionOptions {
  /** The document being edited */
  document: Document | null;
  /** Callback when document changes */
  onChange?: (document: Document) => void;
  /** Callback when table selection changes */
  onSelectionChange?: (context: TableContext | null) => void;
}

// ============================================================================
// DATA ATTRIBUTES
// ============================================================================

/**
 * Data attributes for table elements
 */
export const TABLE_DATA_ATTRIBUTES = {
  /** Attribute for table index */
  TABLE_INDEX: 'data-table-index',
  /** Attribute for row index */
  ROW_INDEX: 'data-row',
  /** Attribute for column index */
  COLUMN_INDEX: 'data-col',
  /** Attribute marking a table cell */
  TABLE_CELL: 'data-table-cell',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find the table element and indices from a click event target
 */
export function findTableFromClick(
  target: EventTarget | null,
  containerRef?: React.RefObject<HTMLElement>
): { tableIndex: number; rowIndex: number; columnIndex: number } | null {
  if (!(target instanceof Element)) return null;

  // Find the cell (td or th)
  let current: Element | null = target;
  while (current && current !== containerRef?.current) {
    if (current.tagName === 'TD' || current.tagName === 'TH') {
      const rowAttr = current.getAttribute(TABLE_DATA_ATTRIBUTES.ROW_INDEX);
      const colAttr = current.getAttribute(TABLE_DATA_ATTRIBUTES.COLUMN_INDEX);

      if (rowAttr !== null && colAttr !== null) {
        // Find the parent table
        let tableElement: Element | null = current;
        while (tableElement && tableElement !== containerRef?.current) {
          if (tableElement.tagName === 'TABLE') {
            const tableIndexAttr = tableElement.getAttribute(TABLE_DATA_ATTRIBUTES.TABLE_INDEX);
            if (tableIndexAttr !== null) {
              return {
                tableIndex: parseInt(tableIndexAttr, 10),
                rowIndex: parseInt(rowAttr, 10),
                columnIndex: parseInt(colAttr, 10),
              };
            }
            break;
          }
          tableElement = tableElement.parentElement;
        }
      }
      break;
    }
    current = current.parentElement;
  }

  return null;
}

/**
 * Get a table from the document by index
 */
export function getTableFromDocument(doc: Document, tableIndex: number): Table | null {
  if (!doc.package?.document?.content) return null;

  let currentTableIndex = 0;
  for (const block of doc.package.document.content) {
    if (block.type === 'table') {
      if (currentTableIndex === tableIndex) {
        return block;
      }
      currentTableIndex++;
    }
  }

  return null;
}

/**
 * Update a table in the document
 */
export function updateTableInDocument(
  doc: Document,
  tableIndex: number,
  newTable: Table
): Document {
  if (!doc.package?.document?.content) return doc;

  let currentTableIndex = 0;
  const newContent = doc.package.document.content.map((block) => {
    if (block.type === 'table') {
      if (currentTableIndex === tableIndex) {
        currentTableIndex++;
        return newTable;
      }
      currentTableIndex++;
    }
    return block;
  });

  return {
    ...doc,
    package: {
      ...doc.package,
      document: {
        ...doc.package.document,
        content: newContent,
      },
    },
  };
}

/**
 * Delete a table from the document
 */
export function deleteTableFromDocument(doc: Document, tableIndex: number): Document {
  if (!doc.package?.document?.content) return doc;

  let currentTableIndex = 0;
  const newContent = doc.package.document.content.filter((block) => {
    if (block.type === 'table') {
      const shouldDelete = currentTableIndex === tableIndex;
      currentTableIndex++;
      return !shouldDelete;
    }
    return true;
  });

  return {
    ...doc,
    package: {
      ...doc.package,
      document: {
        ...doc.package.document,
        content: newContent,
      },
    },
  };
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for tracking and managing table selection
 */
export function useTableSelection({
  document: doc,
  onChange,
  onSelectionChange,
}: UseTableSelectionOptions): UseTableSelectionReturn {
  // State
  const [state, setState] = useState<TableSelectionState>({
    context: null,
    table: null,
    tableIndex: null,
    rowIndex: null,
    columnIndex: null,
  });

  /**
   * Handle click on a table cell
   */
  const handleCellClick = useCallback(
    (tableIndex: number, rowIndex: number, columnIndex: number) => {
      if (!doc) return;

      const table = getTableFromDocument(doc, tableIndex);
      if (!table) {
        setState({
          context: null,
          table: null,
          tableIndex: null,
          rowIndex: null,
          columnIndex: null,
        });
        return;
      }

      const selection: TableSelection = {
        tableIndex,
        rowIndex,
        columnIndex,
      };

      const context = createTableContext(table, selection);

      setState({
        context,
        table,
        tableIndex,
        rowIndex,
        columnIndex,
      });

      onSelectionChange?.(context);
    },
    [doc, onSelectionChange]
  );

  /**
   * Clear the selection
   */
  const clearSelection = useCallback(() => {
    setState({
      context: null,
      table: null,
      tableIndex: null,
      rowIndex: null,
      columnIndex: null,
    });
    onSelectionChange?.(null);
  }, [onSelectionChange]);

  /**
   * Handle table action
   */
  const handleAction = useCallback(
    (action: TableAction) => {
      if (
        !doc ||
        !state.context ||
        state.tableIndex === null ||
        state.rowIndex === null ||
        state.columnIndex === null
      ) {
        return;
      }

      const table = state.table;
      if (!table) return;

      let newTable: Table | null = null;
      let newDoc: Document | null = null;
      let newRowIndex = state.rowIndex;
      let newColumnIndex = state.columnIndex;

      switch (action) {
        case 'addRowAbove':
          newTable = addRow(table, state.rowIndex, 'before');
          // Adjust row index since we added above
          newRowIndex = state.rowIndex + 1;
          break;

        case 'addRowBelow':
          newTable = addRow(table, state.rowIndex, 'after');
          break;

        case 'addColumnLeft':
          newTable = addColumn(table, state.columnIndex, 'before');
          // Adjust column index since we added to the left
          newColumnIndex = state.columnIndex + 1;
          break;

        case 'addColumnRight':
          newTable = addColumn(table, state.columnIndex, 'after');
          break;

        case 'deleteRow':
          if (table.rows.length > 1) {
            newTable = deleteRow(table, state.rowIndex);
            // Adjust row index if we deleted the last row
            if (newRowIndex >= newTable.rows.length) {
              newRowIndex = newTable.rows.length - 1;
            }
          }
          break;

        case 'deleteColumn': {
          const colCount = getColumnCount(table);
          if (colCount > 1) {
            newTable = deleteColumn(table, state.columnIndex);
            // Adjust column index if we deleted the last column
            const newColCount = getColumnCount(newTable);
            if (newColumnIndex >= newColCount) {
              newColumnIndex = newColCount - 1;
            }
          }
          break;
        }

        case 'mergeCells':
          if (state.context.selection.selectedCells) {
            newTable = mergeCells(table, state.context.selection);
          }
          break;

        case 'splitCell':
          if (state.context.canSplitCell) {
            newTable = splitCell(table, state.rowIndex, state.columnIndex);
          }
          break;

        case 'deleteTable':
          newDoc = deleteTableFromDocument(doc, state.tableIndex);
          clearSelection();
          onChange?.(newDoc);
          return;
      }

      if (newTable) {
        newDoc = updateTableInDocument(doc, state.tableIndex, newTable);
        onChange?.(newDoc);

        // Update selection with new position
        if (newDoc) {
          handleCellClick(state.tableIndex, newRowIndex, newColumnIndex);
        }
      }
    },
    [doc, state, onChange, clearSelection, handleCellClick]
  );

  /**
   * Check if a cell is selected
   */
  const isCellSelected = useCallback(
    (tableIndex: number, rowIndex: number, columnIndex: number): boolean => {
      return (
        state.tableIndex === tableIndex &&
        state.rowIndex === rowIndex &&
        state.columnIndex === columnIndex
      );
    },
    [state]
  );

  return {
    state,
    handleCellClick,
    handleAction,
    clearSelection,
    isCellSelected,
    tableContext: state.context,
  };
}

export default useTableSelection;
