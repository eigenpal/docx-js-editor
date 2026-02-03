/**
 * TableGridPicker Component
 *
 * A compact grid picker dropdown for inserting tables.
 * Similar to SuperDoc/Google Docs style table insert:
 * - Hover over grid cells to select dimensions
 * - Click to insert table with selected dimensions
 * - Shows preview of selected dimensions
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Button } from './Button';
import { Tooltip } from './Tooltip';
import { MaterialSymbol } from './MaterialSymbol';
import { cn } from '../../lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface TableGridPickerProps {
  /** Callback when table dimensions are selected */
  onInsert: (rows: number, columns: number) => void;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Grid dimensions (default 5x5) */
  gridRows?: number;
  gridColumns?: number;
  /** Additional CSS class */
  className?: string;
  /** Tooltip text */
  tooltip?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_GRID_ROWS = 5;
const DEFAULT_GRID_COLUMNS = 5;
const CELL_SIZE = 18;
const CELL_GAP = 2;

// ============================================================================
// STYLES
// ============================================================================

const dropdownStyle: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 4,
  backgroundColor: 'white',
  border: '1px solid var(--doc-border)',
  borderRadius: 6,
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
  padding: 8,
  zIndex: 1000,
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gap: CELL_GAP,
};

const cellStyle: CSSProperties = {
  width: CELL_SIZE,
  height: CELL_SIZE,
  backgroundColor: 'white',
  border: '1px solid var(--doc-border)',
  borderRadius: 2,
  transition: 'background-color 0.1s, border-color 0.1s',
  cursor: 'pointer',
};

const cellSelectedStyle: CSSProperties = {
  ...cellStyle,
  backgroundColor: 'var(--doc-primary)',
  borderColor: 'var(--doc-primary)',
};

const labelStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--doc-text)',
  textAlign: 'center',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TableGridPicker({
  onInsert,
  disabled = false,
  gridRows = DEFAULT_GRID_ROWS,
  gridColumns = DEFAULT_GRID_COLUMNS,
  className,
  tooltip = 'Insert table',
}: TableGridPickerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [hoverRows, setHoverRows] = useState(0);
  const [hoverCols, setHoverCols] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Handle cell hover
  const handleCellHover = useCallback((row: number, col: number) => {
    setHoverRows(row);
    setHoverCols(col);
  }, []);

  // Handle cell click - insert table
  const handleCellClick = useCallback(() => {
    if (hoverRows > 0 && hoverCols > 0) {
      onInsert(hoverRows, hoverCols);
      setIsOpen(false);
      setHoverRows(0);
      setHoverCols(0);
    }
  }, [hoverRows, hoverCols, onInsert]);

  // Handle toggle dropdown
  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsOpen((prev) => !prev);
      }
    },
    [disabled]
  );

  // Reset hover state when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setHoverRows(0);
      setHoverCols(0);
    }
  }, [isOpen]);

  // Generate grid cells
  const gridCells: React.ReactElement[] = [];
  for (let row = 1; row <= gridRows; row++) {
    for (let col = 1; col <= gridColumns; col++) {
      const isSelected = row <= hoverRows && col <= hoverCols;
      gridCells.push(
        <div
          key={`${row}-${col}`}
          style={isSelected ? cellSelectedStyle : cellStyle}
          onMouseEnter={() => handleCellHover(row, col)}
          onClick={handleCellClick}
          role="gridcell"
          aria-selected={isSelected}
        />
      );
    }
  }

  const gridLabel = hoverRows > 0 && hoverCols > 0 ? `${hoverCols} × ${hoverRows}` : 'Select size';

  const button = (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn(
        'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80',
        isOpen && 'bg-slate-100',
        disabled && 'opacity-30 cursor-not-allowed',
        className
      )}
      onMouseDown={handleToggle}
      disabled={disabled}
      aria-label={tooltip}
      aria-expanded={isOpen}
      aria-haspopup="grid"
      data-testid="toolbar-insert-table"
    >
      <MaterialSymbol name="grid_on" size={20} />
    </Button>
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button}

      {isOpen && !disabled && (
        <div
          className="docx-table-grid-picker-dropdown"
          style={dropdownStyle}
          role="grid"
          aria-label="Table size selector"
        >
          <div
            className="docx-table-grid"
            style={{
              ...gridStyle,
              gridTemplateColumns: `repeat(${gridColumns}, ${CELL_SIZE}px)`,
            }}
            onMouseLeave={() => {
              setHoverRows(0);
              setHoverCols(0);
            }}
          >
            {gridCells}
          </div>
          <div className="docx-table-grid-label" style={labelStyle}>
            {gridLabel}
          </div>
        </div>
      )}
    </div>
  );
}

export default TableGridPicker;
