/**
 * TableQuickActions Component
 *
 * Floating quick action buttons that appear near tables (Google Sheets style):
 * - Grip handle for drag/selection
 * - Column/row select button
 * - Add row/column buttons
 */

import React, { useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { MaterialSymbol } from './MaterialSymbol';
import { cn } from '../../lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export type QuickAction =
  | 'selectTable'
  | 'selectColumn'
  | 'selectRow'
  | 'addRowAbove'
  | 'addRowBelow'
  | 'addColumnLeft'
  | 'addColumnRight';

export interface TableQuickActionsProps {
  /** Position relative to the table */
  position: 'top-left' | 'row-start' | 'column-top';
  /** Callback when an action is triggered */
  onAction?: (action: QuickAction) => void;
  /** Whether the actions are disabled */
  disabled?: boolean;
  /** Style to position the container */
  style?: CSSProperties;
  /** Additional CSS class */
  className?: string;
  /** Current row index (for row actions) */
  rowIndex?: number;
  /** Current column index (for column actions) */
  columnIndex?: number;
  /** Show add buttons */
  showAddButtons?: boolean;
}

// ============================================================================
// STYLES
// ============================================================================

const containerStyles: Record<string, CSSProperties> = {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    backgroundColor: 'white',
    borderRadius: '4px',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.15)',
    padding: '2px',
    zIndex: 100,
  },
  topLeft: {
    position: 'absolute',
    top: '-28px',
    left: '-8px',
  },
  rowStart: {
    position: 'absolute',
    left: '-32px',
    top: '50%',
    transform: 'translateY(-50%)',
  },
  columnTop: {
    position: 'absolute',
    top: '-28px',
    left: '50%',
    transform: 'translateX(-50%)',
  },
};

const buttonStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  border: 'none',
  borderRadius: '3px',
  backgroundColor: 'transparent',
  color: 'var(--doc-text-muted)',
  cursor: 'pointer',
  transition: 'background-color 0.15s, color 0.15s',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function TableQuickActions({
  position = 'top-left',
  onAction,
  disabled = false,
  style,
  className,
  showAddButtons = true,
}: TableQuickActionsProps): React.ReactElement {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const handleAction = useCallback(
    (action: QuickAction) => {
      if (!disabled && onAction) {
        onAction(action);
      }
    },
    [disabled, onAction]
  );

  const getButtonStyle = (buttonId: string): CSSProperties => ({
    ...buttonStyles,
    backgroundColor:
      hoveredButton === buttonId && !disabled ? 'var(--doc-bg-hover)' : 'transparent',
    color: disabled ? 'var(--doc-border)' : 'var(--doc-text-muted)',
    cursor: disabled ? 'not-allowed' : 'pointer',
  });

  const positionStyle =
    position === 'top-left'
      ? containerStyles.topLeft
      : position === 'row-start'
        ? containerStyles.rowStart
        : containerStyles.columnTop;

  return (
    <div
      className={cn('docx-table-quick-actions', className)}
      style={{
        ...containerStyles.base,
        ...positionStyle,
        ...style,
      }}
      role="toolbar"
      aria-label="Table quick actions"
    >
      {/* Grip handle / drag handle */}
      <button
        type="button"
        style={getButtonStyle('grip')}
        onMouseEnter={() => setHoveredButton('grip')}
        onMouseLeave={() => setHoveredButton(null)}
        onClick={() => handleAction('selectTable')}
        disabled={disabled}
        title="Select table"
        aria-label="Select table"
      >
        <MaterialSymbol name="drag_indicator" size={16} />
      </button>

      {/* Column/Row selector */}
      {position === 'top-left' && (
        <button
          type="button"
          style={getButtonStyle('select')}
          onMouseEnter={() => setHoveredButton('select')}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={() => handleAction('selectColumn')}
          disabled={disabled}
          title="Select column"
          aria-label="Select column"
        >
          <MaterialSymbol name="table_chart" size={16} />
        </button>
      )}

      {/* Add button */}
      {showAddButtons && (
        <button
          type="button"
          style={getButtonStyle('add')}
          onMouseEnter={() => setHoveredButton('add')}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={() =>
            handleAction(
              position === 'row-start'
                ? 'addRowAbove'
                : position === 'column-top'
                  ? 'addColumnLeft'
                  : 'addRowBelow'
            )
          }
          disabled={disabled}
          title={
            position === 'row-start'
              ? 'Add row'
              : position === 'column-top'
                ? 'Add column'
                : 'Add row or column'
          }
          aria-label="Add row or column"
        >
          <MaterialSymbol name="add" size={16} />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// ROW QUICK ACTIONS - Appears on row hover
// ============================================================================

export interface RowQuickActionsProps {
  /** Callback when an action is triggered */
  onAction?: (action: 'addRowAbove' | 'addRowBelow' | 'deleteRow' | 'selectRow') => void;
  /** Whether the actions are disabled */
  disabled?: boolean;
  /** Y position for the actions */
  top?: number;
  /** Additional CSS class */
  className?: string;
  /** Visible state */
  visible?: boolean;
}

export function RowQuickActions({
  onAction,
  disabled = false,
  top = 0,
  className,
  visible = false,
}: RowQuickActionsProps): React.ReactElement | null {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  if (!visible) return null;

  const handleAction = (action: 'addRowAbove' | 'addRowBelow' | 'deleteRow' | 'selectRow') => {
    if (!disabled && onAction) {
      onAction(action);
    }
  };

  const getButtonStyle = (buttonId: string): CSSProperties => ({
    ...buttonStyles,
    backgroundColor:
      hoveredButton === buttonId && !disabled ? 'var(--doc-bg-hover)' : 'transparent',
    color: disabled ? 'var(--doc-border)' : 'var(--doc-text-muted)',
    cursor: disabled ? 'not-allowed' : 'pointer',
  });

  return (
    <div
      className={cn('docx-row-quick-actions', className)}
      style={{
        ...containerStyles.base,
        position: 'absolute',
        left: '-36px',
        top: `${top}px`,
        transform: 'translateY(-50%)',
        flexDirection: 'column',
      }}
      role="toolbar"
      aria-label="Row quick actions"
    >
      <button
        type="button"
        style={getButtonStyle('addAbove')}
        onMouseEnter={() => setHoveredButton('addAbove')}
        onMouseLeave={() => setHoveredButton(null)}
        onClick={() => handleAction('addRowAbove')}
        disabled={disabled}
        title="Insert row above"
        aria-label="Insert row above"
      >
        <MaterialSymbol name="add" size={14} />
      </button>
    </div>
  );
}

// ============================================================================
// COLUMN QUICK ACTIONS - Appears on column hover
// ============================================================================

export interface ColumnQuickActionsProps {
  /** Callback when an action is triggered */
  onAction?: (action: 'addColumnLeft' | 'addColumnRight' | 'deleteColumn' | 'selectColumn') => void;
  /** Whether the actions are disabled */
  disabled?: boolean;
  /** X position for the actions */
  left?: number;
  /** Additional CSS class */
  className?: string;
  /** Visible state */
  visible?: boolean;
}

export function ColumnQuickActions({
  onAction,
  disabled = false,
  left = 0,
  className,
  visible = false,
}: ColumnQuickActionsProps): React.ReactElement | null {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  if (!visible) return null;

  const handleAction = (
    action: 'addColumnLeft' | 'addColumnRight' | 'deleteColumn' | 'selectColumn'
  ) => {
    if (!disabled && onAction) {
      onAction(action);
    }
  };

  const getButtonStyle = (buttonId: string): CSSProperties => ({
    ...buttonStyles,
    backgroundColor:
      hoveredButton === buttonId && !disabled ? 'var(--doc-bg-hover)' : 'transparent',
    color: disabled ? 'var(--doc-border)' : 'var(--doc-text-muted)',
    cursor: disabled ? 'not-allowed' : 'pointer',
  });

  return (
    <div
      className={cn('docx-column-quick-actions', className)}
      style={{
        ...containerStyles.base,
        position: 'absolute',
        top: '-28px',
        left: `${left}px`,
        transform: 'translateX(-50%)',
      }}
      role="toolbar"
      aria-label="Column quick actions"
    >
      <button
        type="button"
        style={getButtonStyle('addLeft')}
        onMouseEnter={() => setHoveredButton('addLeft')}
        onMouseLeave={() => setHoveredButton(null)}
        onClick={() => handleAction('addColumnLeft')}
        disabled={disabled}
        title="Insert column left"
        aria-label="Insert column left"
      >
        <MaterialSymbol name="add" size={14} />
      </button>
    </div>
  );
}

export default TableQuickActions;
