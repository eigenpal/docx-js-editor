/**
 * TableMoreDropdown - Compact dropdown for less-used table actions
 *
 * Contains: delete row/column/table, vertical alignment, header row,
 * distribute columns, auto-fit, table alignment, cell margins,
 * text direction, no-wrap, row height, table properties.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { Button } from './Button';
import { Tooltip } from './Tooltip';
import { MaterialSymbol } from './MaterialSymbol';
import { cn } from '../../lib/utils';
import type { TableAction } from './TableToolbar';

export interface TableMoreDropdownProps {
  onAction: (action: TableAction) => void;
  disabled?: boolean;
  tableContext?: {
    isInTable: boolean;
    rowCount?: number;
    columnCount?: number;
    canSplitCell?: boolean;
    hasMultiCellSelection?: boolean;
    table?: { attrs?: { justification?: string } };
  } | null;
}

const menuItemStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '7px 14px',
  fontSize: 13,
  color: 'var(--doc-text)',
  cursor: 'pointer',
  border: 'none',
  backgroundColor: 'transparent',
  width: '100%',
  textAlign: 'left',
};

const separatorStyles: CSSProperties = {
  height: 1,
  backgroundColor: 'var(--doc-border)',
  margin: '4px 0',
};

const sectionLabelStyles: CSSProperties = {
  padding: '6px 14px 2px',
  fontSize: 11,
  color: 'var(--doc-text-muted)',
  fontWeight: 500,
};

export function TableMoreDropdown({
  onAction,
  disabled = false,
  tableContext,
}: TableMoreDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentJustification =
    (tableContext?.table?.attrs?.justification as 'left' | 'center' | 'right' | null | undefined) ??
    'left';

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
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

  const handleAction = useCallback(
    (action: TableAction) => {
      onAction(action);
      setIsOpen(false);
    },
    [onAction]
  );

  const menuItem = (
    id: string,
    icon: string,
    label: string,
    action: TableAction,
    opts?: { danger?: boolean; itemDisabled?: boolean }
  ) => {
    const isItemDisabled = disabled || opts?.itemDisabled;
    return (
      <button
        key={id}
        type="button"
        role="menuitem"
        style={{
          ...menuItemStyles,
          backgroundColor:
            hoveredItem === id && !isItemDisabled ? 'var(--doc-bg-hover)' : 'transparent',
          color: isItemDisabled
            ? 'var(--doc-text-muted)'
            : opts?.danger
              ? 'var(--doc-error)'
              : 'var(--doc-text)',
          cursor: isItemDisabled ? 'not-allowed' : 'pointer',
        }}
        onClick={() => !isItemDisabled && handleAction(action)}
        onMouseEnter={() => setHoveredItem(id)}
        onMouseLeave={() => setHoveredItem(null)}
        disabled={isItemDisabled}
      >
        <MaterialSymbol
          name={icon}
          size={16}
          className={opts?.danger && !isItemDisabled ? 'text-red-600' : ''}
        />
        <span style={{ flex: 1 }}>{label}</span>
      </button>
    );
  };

  const button = (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn(
        'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80',
        isOpen && 'bg-slate-100',
        disabled && 'opacity-30 cursor-not-allowed'
      )}
      onMouseDown={handleMouseDown}
      onClick={() => !disabled && setIsOpen((prev) => !prev)}
      disabled={disabled}
      aria-label="More table options"
      aria-expanded={isOpen}
      aria-haspopup="menu"
      data-testid="toolbar-table-more"
    >
      <MaterialSymbol name="more_vert" size={20} />
    </Button>
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {!isOpen ? <Tooltip content="More table options">{button}</Tooltip> : button}

      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            backgroundColor: 'white',
            border: '1px solid var(--doc-border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
            padding: '4px 0',
            zIndex: 1000,
            minWidth: 200,
            maxHeight: '70vh',
            overflowY: 'auto',
          }}
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Insert actions */}
          {menuItem('addRowAbove', 'add', 'Insert row above', 'addRowAbove')}
          {menuItem('addRowBelow', 'add', 'Insert row below', 'addRowBelow')}
          {menuItem('addColumnLeft', 'add', 'Insert column left', 'addColumnLeft')}
          {menuItem('addColumnRight', 'add', 'Insert column right', 'addColumnRight')}

          <div style={separatorStyles} role="separator" />

          {/* Merge/Split */}
          {menuItem('mergeCells', 'call_merge', 'Merge cells', 'mergeCells', {
            itemDisabled: !tableContext?.hasMultiCellSelection,
          })}
          {menuItem('splitCell', 'call_split', 'Split cell', 'splitCell', {
            itemDisabled: !tableContext?.canSplitCell,
          })}

          <div style={separatorStyles} role="separator" />

          {/* Delete actions */}
          {menuItem('deleteRow', 'delete', 'Delete row', 'deleteRow', {
            danger: true,
            itemDisabled: (tableContext?.rowCount ?? 0) <= 1,
          })}
          {menuItem('deleteColumn', 'delete', 'Delete column', 'deleteColumn', {
            danger: true,
            itemDisabled: (tableContext?.columnCount ?? 0) <= 1,
          })}
          {menuItem('deleteTable', 'delete', 'Delete table', 'deleteTable', { danger: true })}

          <div style={separatorStyles} role="separator" />

          {/* Vertical alignment */}
          <div style={sectionLabelStyles}>Vertical alignment</div>
          <div style={{ display: 'flex', gap: 4, padding: '4px 14px' }}>
            {(['top', 'center', 'bottom'] as const).map((align) => {
              const icons = {
                top: 'vertical_align_top',
                center: 'vertical_align_center',
                bottom: 'vertical_align_bottom',
              };
              const labels = { top: 'Top', center: 'Middle', bottom: 'Bottom' };
              return (
                <button
                  key={align}
                  type="button"
                  title={labels[align]}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 28,
                    border: '1px solid var(--doc-border)',
                    borderRadius: 4,
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      'var(--doc-bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                  onClick={() => handleAction({ type: 'cellVerticalAlign', align })}
                >
                  <MaterialSymbol name={icons[align]} size={16} />
                </button>
              );
            })}
          </div>

          <div style={separatorStyles} role="separator" />

          {/* Table alignment */}
          <div style={sectionLabelStyles}>Table alignment</div>
          <div style={{ display: 'flex', gap: 4, padding: '4px 14px' }}>
            {(['left', 'center', 'right'] as const).map((align) => {
              const icons = {
                left: 'format_align_left',
                center: 'format_align_center',
                right: 'format_align_right',
              };
              const isActive = currentJustification === align;
              return (
                <button
                  key={align}
                  type="button"
                  title={`Align table ${align}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 28,
                    border: '1px solid var(--doc-border)',
                    borderRadius: 4,
                    backgroundColor: isActive ? 'var(--doc-primary-light)' : 'transparent',
                    borderColor: isActive ? 'var(--doc-primary)' : 'var(--doc-border)',
                    color: isActive ? 'var(--doc-primary)' : 'var(--doc-text)',
                    cursor: 'pointer',
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    handleAction({ type: 'tableProperties', props: { justification: align } })
                  }
                >
                  <MaterialSymbol name={icons[align]} size={16} />
                </button>
              );
            })}
          </div>

          <div style={separatorStyles} role="separator" />

          {/* Other options */}
          {menuItem('headerRow', 'table_rows', 'Toggle header row', { type: 'toggleHeaderRow' })}
          {menuItem('distribute', 'view_column', 'Distribute columns evenly', {
            type: 'distributeColumns',
          })}
          {menuItem('autoFit', 'fit_width', 'Auto-fit to contents', { type: 'autoFitContents' })}
          {menuItem('noWrap', 'wrap_text', 'Toggle no-wrap', { type: 'toggleNoWrap' })}

          <div style={separatorStyles} role="separator" />

          {menuItem('properties', 'settings', 'Table properties...', {
            type: 'openTableProperties',
          })}
        </div>
      )}
    </div>
  );
}

export default TableMoreDropdown;
