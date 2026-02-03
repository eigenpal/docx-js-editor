/**
 * Insert Table Dialog Component
 *
 * Modal dialog for inserting a new table into the document.
 * Provides a visual grid selector for choosing rows and columns.
 *
 * Features:
 * - Visual grid selector (hover to select dimensions)
 * - Manual row/column input
 * - Preview of table dimensions
 * - Quick insert with default sizes
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Table configuration for insertion
 */
export interface TableConfig {
  /** Number of rows */
  rows: number;
  /** Number of columns */
  columns: number;
}

/**
 * Props for InsertTableDialog
 */
export interface InsertTableDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when table is inserted */
  onInsert: (config: TableConfig) => void;
  /** Maximum rows in grid selector (default: 8) */
  maxGridRows?: number;
  /** Maximum columns in grid selector (default: 10) */
  maxGridColumns?: number;
  /** Maximum allowed rows (default: 100) */
  maxRows?: number;
  /** Maximum allowed columns (default: 20) */
  maxColumns?: number;
  /** Additional CSS class */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
}

// ============================================================================
// STYLES
// ============================================================================

const DIALOG_OVERLAY_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
};

const DIALOG_CONTENT_STYLE: CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '8px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  minWidth: '320px',
  maxWidth: '400px',
  width: '100%',
  margin: '20px',
};

const DIALOG_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 20px',
  borderBottom: '1px solid var(--doc-border)',
};

const DIALOG_TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 600,
  color: 'var(--doc-text)',
};

const CLOSE_BUTTON_STYLE: CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '20px',
  cursor: 'pointer',
  color: 'var(--doc-text-muted)',
  padding: '4px 8px',
  lineHeight: 1,
};

const DIALOG_BODY_STYLE: CSSProperties = {
  padding: '20px',
};

const GRID_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginBottom: '16px',
};

const GRID_STYLE: CSSProperties = {
  display: 'grid',
  gap: '2px',
  padding: '4px',
  backgroundColor: 'var(--doc-bg-hover)',
  borderRadius: '4px',
  cursor: 'pointer',
};

const GRID_CELL_STYLE: CSSProperties = {
  width: '24px',
  height: '24px',
  backgroundColor: 'white',
  border: '1px solid var(--doc-border-dark)',
  borderRadius: '2px',
  transition: 'background-color 0.1s, border-color 0.1s',
};

const GRID_CELL_SELECTED_STYLE: CSSProperties = {
  ...GRID_CELL_STYLE,
  backgroundColor: 'var(--doc-primary)',
  borderColor: 'var(--doc-primary)',
};

const GRID_LABEL_STYLE: CSSProperties = {
  marginTop: '8px',
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--doc-text)',
};

const SEPARATOR_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  margin: '16px 0',
  color: 'var(--doc-text-muted)',
  fontSize: '12px',
};

const SEPARATOR_LINE_STYLE: CSSProperties = {
  flex: 1,
  height: '1px',
  backgroundColor: 'var(--doc-border)',
};

const INPUT_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '12px',
};

const LABEL_STYLE: CSSProperties = {
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--doc-text)',
  minWidth: '80px',
};

const INPUT_STYLE: CSSProperties = {
  width: '80px',
  padding: '8px 12px',
  border: '1px solid var(--doc-border-input)',
  borderRadius: '4px',
  fontSize: '14px',
  textAlign: 'center',
};

const DIALOG_FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  padding: '16px 20px',
  borderTop: '1px solid var(--doc-border)',
};

const BUTTON_BASE_STYLE: CSSProperties = {
  padding: '10px 20px',
  borderRadius: '4px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
};

const PRIMARY_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: 'var(--doc-primary)',
  color: 'white',
};

const SECONDARY_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: 'var(--doc-bg-hover)',
  color: 'var(--doc-text)',
  border: '1px solid var(--doc-border-input)',
};

const DISABLED_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: 'var(--doc-border-input)',
  color: 'var(--doc-text-muted)',
  cursor: 'not-allowed',
};

// ============================================================================
// ICONS
// ============================================================================

/**
 * Table Icon
 */
function TableIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="2"
        y="2"
        width="16"
        height="16"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        rx="1"
      />
      <line x1="2" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="1.5" />
      <line x1="2" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8" y1="2" x2="8" y2="18" stroke="currentColor" strokeWidth="1.5" />
      <line x1="13" y1="2" x2="13" y2="18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * InsertTableDialog - Modal for inserting tables with visual grid selector
 */
export function InsertTableDialog({
  isOpen,
  onClose,
  onInsert,
  maxGridRows = 8,
  maxGridColumns = 10,
  maxRows = 100,
  maxColumns = 20,
  className,
  style,
}: InsertTableDialogProps): React.ReactElement | null {
  // State for grid hover selection
  const [hoverRows, setHoverRows] = useState(0);
  const [hoverCols, setHoverCols] = useState(0);

  // State for manual input
  const [inputRows, setInputRows] = useState(3);
  const [inputCols, setInputCols] = useState(3);

  // Refs
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setHoverRows(0);
      setHoverCols(0);
      setInputRows(3);
      setInputCols(3);
    }
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
    }
  }, [isOpen]);

  /**
   * Handle grid cell hover
   */
  const handleCellHover = useCallback((row: number, col: number) => {
    setHoverRows(row);
    setHoverCols(col);
  }, []);

  /**
   * Handle grid cell click - insert table with selected dimensions
   */
  const handleCellClick = useCallback(() => {
    if (hoverRows > 0 && hoverCols > 0) {
      onInsert({ rows: hoverRows, columns: hoverCols });
    }
  }, [hoverRows, hoverCols, onInsert]);

  /**
   * Handle manual input insert
   */
  const handleManualInsert = useCallback(() => {
    const rows = Math.min(Math.max(1, inputRows), maxRows);
    const cols = Math.min(Math.max(1, inputCols), maxColumns);
    onInsert({ rows, columns: cols });
  }, [inputRows, inputCols, maxRows, maxColumns, onInsert]);

  /**
   * Handle keyboard events
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleManualInsert();
      }
    },
    [onClose, handleManualInsert]
  );

  /**
   * Handle overlay click (close dialog)
   */
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  /**
   * Handle row input change
   */
  const handleRowsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value)) {
        setInputRows(Math.min(Math.max(1, value), maxRows));
      } else if (e.target.value === '') {
        setInputRows(1);
      }
    },
    [maxRows]
  );

  /**
   * Handle column input change
   */
  const handleColsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value)) {
        setInputCols(Math.min(Math.max(1, value), maxColumns));
      } else if (e.target.value === '') {
        setInputCols(1);
      }
    },
    [maxColumns]
  );

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  // Generate grid cells
  const gridCells: React.ReactElement[] = [];
  for (let row = 1; row <= maxGridRows; row++) {
    for (let col = 1; col <= maxGridColumns; col++) {
      const isSelected = row <= hoverRows && col <= hoverCols;
      gridCells.push(
        <div
          key={`${row}-${col}`}
          style={isSelected ? GRID_CELL_SELECTED_STYLE : GRID_CELL_STYLE}
          onMouseEnter={() => handleCellHover(row, col)}
          onClick={handleCellClick}
          role="gridcell"
          aria-selected={isSelected}
        />
      );
    }
  }

  const canInsert = inputRows >= 1 && inputCols >= 1;
  const gridLabel =
    hoverRows > 0 && hoverCols > 0 ? `${hoverCols} x ${hoverRows} Table` : 'Hover to select size';

  return (
    <div
      className={`docx-insert-table-dialog-overlay ${className || ''}`}
      style={{ ...DIALOG_OVERLAY_STYLE, ...style }}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="insert-table-dialog-title"
    >
      <div
        ref={dialogRef}
        className="docx-insert-table-dialog"
        style={DIALOG_CONTENT_STYLE}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="docx-insert-table-dialog-header" style={DIALOG_HEADER_STYLE}>
          <h2 id="insert-table-dialog-title" style={DIALOG_TITLE_STYLE}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TableIcon />
              Insert Table
            </span>
          </h2>
          <button
            type="button"
            className="docx-insert-table-dialog-close"
            style={CLOSE_BUTTON_STYLE}
            onClick={onClose}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="docx-insert-table-dialog-body" style={DIALOG_BODY_STYLE}>
          {/* Grid selector */}
          <div className="docx-insert-table-grid-container" style={GRID_CONTAINER_STYLE}>
            <div
              className="docx-insert-table-grid"
              style={{
                ...GRID_STYLE,
                gridTemplateColumns: `repeat(${maxGridColumns}, 1fr)`,
              }}
              onMouseLeave={() => {
                setHoverRows(0);
                setHoverCols(0);
              }}
              role="grid"
              aria-label="Table size selector"
            >
              {gridCells}
            </div>
            <div className="docx-insert-table-grid-label" style={GRID_LABEL_STYLE}>
              {gridLabel}
            </div>
          </div>

          {/* Separator */}
          <div className="docx-insert-table-separator" style={SEPARATOR_STYLE}>
            <div style={SEPARATOR_LINE_STYLE} />
            <span>or specify size</span>
            <div style={SEPARATOR_LINE_STYLE} />
          </div>

          {/* Manual input */}
          <div className="docx-insert-table-inputs">
            <div style={INPUT_ROW_STYLE}>
              <label htmlFor="insert-table-rows" style={LABEL_STYLE}>
                Rows:
              </label>
              <input
                id="insert-table-rows"
                type="number"
                min={1}
                max={maxRows}
                value={inputRows}
                onChange={handleRowsChange}
                style={INPUT_STYLE}
              />
            </div>
            <div style={INPUT_ROW_STYLE}>
              <label htmlFor="insert-table-cols" style={LABEL_STYLE}>
                Columns:
              </label>
              <input
                id="insert-table-cols"
                type="number"
                min={1}
                max={maxColumns}
                value={inputCols}
                onChange={handleColsChange}
                style={INPUT_STYLE}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="docx-insert-table-dialog-footer" style={DIALOG_FOOTER_STYLE}>
          <button
            type="button"
            className="docx-insert-table-dialog-cancel"
            style={SECONDARY_BUTTON_STYLE}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="docx-insert-table-dialog-insert"
            style={canInsert ? PRIMARY_BUTTON_STYLE : DISABLED_BUTTON_STYLE}
            onClick={handleManualInsert}
            disabled={!canInsert}
          >
            Insert Table
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for managing Insert Table dialog state
 */
export function useInsertTableDialog(): {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
} {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return { isOpen, open, close, toggle };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a default TableConfig
 */
export function createDefaultTableConfig(rows = 3, columns = 3): TableConfig {
  return { rows, columns };
}

/**
 * Validate TableConfig
 */
export function isValidTableConfig(config: TableConfig, maxRows = 100, maxColumns = 20): boolean {
  return (
    config.rows >= 1 &&
    config.rows <= maxRows &&
    config.columns >= 1 &&
    config.columns <= maxColumns
  );
}

/**
 * Clamp TableConfig to valid range
 */
export function clampTableConfig(config: TableConfig, maxRows = 100, maxColumns = 20): TableConfig {
  return {
    rows: Math.min(Math.max(1, config.rows), maxRows),
    columns: Math.min(Math.max(1, config.columns), maxColumns),
  };
}

/**
 * Format table dimensions for display
 */
export function formatTableDimensions(config: TableConfig): string {
  return `${config.columns} x ${config.rows}`;
}

/**
 * Get common table presets
 */
export function getTablePresets(): { label: string; config: TableConfig }[] {
  return [
    { label: '2 x 2', config: { rows: 2, columns: 2 } },
    { label: '3 x 3', config: { rows: 3, columns: 3 } },
    { label: '4 x 4', config: { rows: 4, columns: 4 } },
    { label: '2 x 4', config: { rows: 2, columns: 4 } },
    { label: '4 x 2', config: { rows: 4, columns: 2 } },
    { label: '5 x 5', config: { rows: 5, columns: 5 } },
  ];
}

// ============================================================================
// EXPORTS
// ============================================================================

export default InsertTableDialog;
