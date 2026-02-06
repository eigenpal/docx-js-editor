/**
 * TableOptionsDropdown Component
 *
 * A dropdown menu for all table operations (Google Docs style):
 * - Insert row above/below
 * - Insert column left/right
 * - Delete row/column/table
 * - Border options with color picker
 * - Cell fill color
 * - Merge/Split cells
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Button } from './Button';
import { Tooltip } from './Tooltip';
import { MaterialSymbol } from './MaterialSymbol';
import { cn } from '../../lib/utils';
import type { TableAction } from './TableToolbar';

// ============================================================================
// TYPES
// ============================================================================

export interface TableOptionsDropdownProps {
  /** Callback when an action is triggered */
  onAction?: (action: TableAction) => void;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
  /** Table context for enabling/disabling actions */
  tableContext?: {
    rowCount?: number;
    columnCount?: number;
    canSplitCell?: boolean;
    hasMultiCellSelection?: boolean;
  };
  /** Additional CSS class */
  className?: string;
  /** Tooltip text */
  tooltip?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Common colors for quick selection
const QUICK_COLORS = [
  '#000000',
  '#434343',
  '#666666',
  '#999999',
  '#b7b7b7',
  '#cccccc',
  '#d9d9d9',
  '#efefef',
  '#f3f3f3',
  '#ffffff',
  '#980000',
  '#ff0000',
  '#ff9900',
  '#ffff00',
  '#00ff00',
  '#00ffff',
  '#4a86e8',
  '#0000ff',
  '#9900ff',
  '#ff00ff',
];

type SimpleAction =
  | 'addRowAbove'
  | 'addRowBelow'
  | 'addColumnLeft'
  | 'addColumnRight'
  | 'deleteRow'
  | 'deleteColumn'
  | 'deleteTable'
  | 'borderAll'
  | 'borderOutside'
  | 'borderInside'
  | 'borderNone'
  | 'borderTop'
  | 'borderBottom'
  | 'borderLeft'
  | 'borderRight'
  | 'mergeCells'
  | 'splitCell';

interface MenuItem {
  action: SimpleAction;
  label: string;
  icon: string;
  shortcut?: string;
  danger?: boolean;
  separator?: boolean;
  disabled?: (ctx: TableOptionsDropdownProps['tableContext']) => boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { action: 'addRowAbove', label: 'Insert row above', icon: 'add' },
  { action: 'addRowBelow', label: 'Insert row below', icon: 'add' },
  { action: 'addColumnLeft', label: 'Insert column left', icon: 'add' },
  { action: 'addColumnRight', label: 'Insert column right', icon: 'add', separator: true },
  {
    action: 'deleteRow',
    label: 'Delete row',
    icon: 'delete',
    danger: true,
    disabled: (ctx) => (ctx?.rowCount ?? 0) <= 1,
  },
  {
    action: 'deleteColumn',
    label: 'Delete column',
    icon: 'delete',
    danger: true,
    disabled: (ctx) => (ctx?.columnCount ?? 0) <= 1,
  },
  { action: 'deleteTable', label: 'Delete table', icon: 'delete', danger: true, separator: true },
  { action: 'borderAll', label: 'All borders', icon: 'border_all' },
  { action: 'borderOutside', label: 'Outside borders', icon: 'border_outer' },
  { action: 'borderInside', label: 'Inside borders', icon: 'border_inner' },
  { action: 'borderNone', label: 'Remove borders', icon: 'border_clear' },
  { action: 'borderTop', label: 'Top border', icon: 'border_top' },
  { action: 'borderBottom', label: 'Bottom border', icon: 'border_bottom' },
  { action: 'borderLeft', label: 'Left border', icon: 'border_left' },
  { action: 'borderRight', label: 'Right border', icon: 'border_right', separator: true },
  {
    action: 'mergeCells',
    label: 'Merge cells',
    icon: 'call_merge',
    disabled: (ctx) => !ctx?.hasMultiCellSelection,
  },
  {
    action: 'splitCell',
    label: 'Split cell',
    icon: 'call_split',
    disabled: (ctx) => !ctx?.canSplitCell,
  },
];

// ============================================================================
// STYLES
// ============================================================================

const dropdownStyles: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 4,
  backgroundColor: 'white',
  border: '1px solid var(--doc-border)',
  borderRadius: 8,
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
  padding: '4px 0',
  zIndex: 1000,
  minWidth: 220,
  maxHeight: '70vh',
  overflowY: 'auto',
};

const menuItemStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 16px',
  fontSize: 14,
  color: 'var(--doc-text)',
  cursor: 'pointer',
  border: 'none',
  backgroundColor: 'transparent',
  width: '100%',
  textAlign: 'left',
  transition: 'background-color 0.1s',
};

const separatorStyles: CSSProperties = {
  height: 1,
  backgroundColor: 'var(--doc-border)',
  margin: '4px 0',
};

const colorSwatchStyles: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 2,
  border: '1px solid var(--doc-border)',
  cursor: 'pointer',
};

const colorGridStyles: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(10, 1fr)',
  gap: 2,
  padding: '8px 12px',
};

// ============================================================================
// COLOR PICKER SUBCOMPONENT
// ============================================================================

interface ColorPickerRowProps {
  label: string;
  icon: string;
  currentColor?: string;
  onColorSelect: (color: string) => void;
  onNoColor?: () => void;
}

function ColorPickerRow({
  label,
  icon,
  currentColor,
  onColorSelect,
  onNoColor,
}: ColorPickerRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        style={{
          ...menuItemStyles,
          backgroundColor: hoveredItem === 'main' ? 'var(--doc-bg-hover)' : 'transparent',
        }}
        onMouseEnter={() => setHoveredItem('main')}
        onMouseLeave={() => setHoveredItem(null)}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <MaterialSymbol name={icon} size={18} />
        <span style={{ flex: 1 }}>{label}</span>
        {currentColor && (
          <div
            style={{
              ...colorSwatchStyles,
              backgroundColor: currentColor,
            }}
          />
        )}
        <MaterialSymbol name={isExpanded ? 'expand_less' : 'expand_more'} size={18} />
      </button>

      {isExpanded && (
        <div
          style={{
            backgroundColor: 'var(--doc-bg-muted)',
            borderTop: '1px solid var(--doc-border)',
            borderBottom: '1px solid var(--doc-border)',
          }}
        >
          <div style={colorGridStyles}>
            {QUICK_COLORS.map((color) => (
              <div
                key={color}
                style={{
                  ...colorSwatchStyles,
                  backgroundColor: color,
                  outline: currentColor === color ? '2px solid var(--doc-primary)' : 'none',
                  outlineOffset: 1,
                }}
                onClick={() => {
                  onColorSelect(color);
                  setIsExpanded(false);
                }}
                title={color}
              />
            ))}
          </div>
          {onNoColor && (
            <button
              type="button"
              style={{
                ...menuItemStyles,
                padding: '6px 12px',
                fontSize: 12,
                color: 'var(--doc-text-muted)',
                backgroundColor: hoveredItem === 'nocolor' ? 'var(--doc-bg-hover)' : 'transparent',
              }}
              onMouseEnter={() => setHoveredItem('nocolor')}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={() => {
                onNoColor();
                setIsExpanded(false);
              }}
            >
              <MaterialSymbol name="format_color_reset" size={16} />
              <span>No color</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TableOptionsDropdown({
  onAction,
  disabled = false,
  tableContext,
  className,
  tooltip = 'Table options',
}: TableOptionsDropdownProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  const handleAction = useCallback(
    (action: TableAction) => {
      onAction?.(action);
      setIsOpen(false);
    },
    [onAction]
  );

  const handleBorderColor = useCallback(
    (color: string) => {
      onAction?.({ type: 'borderColor', color });
    },
    [onAction]
  );

  const handleCellFillColor = useCallback(
    (color: string | null) => {
      onAction?.({ type: 'cellFillColor', color });
    },
    [onAction]
  );

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
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      disabled={disabled}
      aria-label={tooltip}
      aria-expanded={isOpen}
      aria-haspopup="menu"
      data-testid="toolbar-table-options"
    >
      <MaterialSymbol name="table" size={20} />
      <MaterialSymbol name="arrow_drop_down" size={16} className="-ml-1" />
    </Button>
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {tooltip && !isOpen ? <Tooltip content={tooltip}>{button}</Tooltip> : button}

      {isOpen && !disabled && (
        <div
          className="docx-table-options-dropdown"
          style={dropdownStyles}
          role="menu"
          aria-label="Table options menu"
        >
          {/* Regular menu items */}
          {MENU_ITEMS.map((item, index) => {
            const isDisabled = disabled || item.disabled?.(tableContext);
            const isHovered = hoveredItem === item.action && !isDisabled;

            return (
              <React.Fragment key={item.action}>
                <button
                  type="button"
                  role="menuitem"
                  style={{
                    ...menuItemStyles,
                    backgroundColor: isHovered ? 'var(--doc-bg-hover)' : 'transparent',
                    color: isDisabled
                      ? 'var(--doc-text-muted)'
                      : item.danger
                        ? 'var(--doc-error)'
                        : 'var(--doc-text)',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => !isDisabled && handleAction(item.action)}
                  onMouseEnter={() => setHoveredItem(item.action)}
                  onMouseLeave={() => setHoveredItem(null)}
                  disabled={isDisabled}
                  aria-disabled={isDisabled}
                >
                  <MaterialSymbol
                    name={item.icon}
                    size={18}
                    className={item.danger && !isDisabled ? 'text-red-600' : ''}
                  />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.shortcut && (
                    <span style={{ fontSize: 12, color: 'var(--doc-text-muted)' }}>
                      {item.shortcut}
                    </span>
                  )}
                </button>
                {item.separator && index < MENU_ITEMS.length - 1 && (
                  <div style={separatorStyles} role="separator" />
                )}
              </React.Fragment>
            );
          })}

          {/* Color pickers section */}
          <div style={separatorStyles} role="separator" />

          <ColorPickerRow
            label="Border color"
            icon="border_color"
            onColorSelect={handleBorderColor}
          />

          <ColorPickerRow
            label="Cell fill color"
            icon="format_color_fill"
            onColorSelect={(color) => handleCellFillColor(color)}
            onNoColor={() => handleCellFillColor(null)}
          />
        </div>
      )}
    </div>
  );
}

export default TableOptionsDropdown;
