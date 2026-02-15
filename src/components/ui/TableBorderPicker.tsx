/**
 * TableBorderPicker - Google Docs-style border preset popover
 *
 * Shows a grid of border preset buttons: All, Outside, Inside,
 * Top, Bottom, Left, Right, and Clear.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './Button';
import { Tooltip } from './Tooltip';
import { MaterialSymbol } from './MaterialSymbol';
import { cn } from '../../lib/utils';
import type { TableAction } from './TableToolbar';

export interface TableBorderPickerProps {
  onAction: (action: TableAction) => void;
  disabled?: boolean;
}

const BORDER_PRESETS: { action: TableAction; icon: string; label: string }[] = [
  { action: 'borderAll', icon: 'border_all', label: 'All borders' },
  { action: 'borderOutside', icon: 'border_outer', label: 'Outside borders' },
  { action: 'borderInside', icon: 'border_inner', label: 'Inside borders' },
  { action: 'borderTop', icon: 'border_top', label: 'Top border' },
  { action: 'borderBottom', icon: 'border_bottom', label: 'Bottom border' },
  { action: 'borderLeft', icon: 'border_left', label: 'Left border' },
  { action: 'borderRight', icon: 'border_right', label: 'Right border' },
  { action: 'borderNone', icon: 'border_clear', label: 'No borders' },
];

export function TableBorderPicker({ onAction, disabled = false }: TableBorderPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handlePreset = useCallback(
    (action: TableAction) => {
      onAction(action);
      setIsOpen(false);
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
        disabled && 'opacity-30 cursor-not-allowed'
      )}
      onMouseDown={handleMouseDown}
      onClick={() => !disabled && setIsOpen((prev) => !prev)}
      disabled={disabled}
      aria-label="Border style"
      aria-expanded={isOpen}
      aria-haspopup="true"
      data-testid="toolbar-table-borders"
    >
      <MaterialSymbol name="border_all" size={20} />
      <MaterialSymbol name="arrow_drop_down" size={14} className="-ml-1" />
    </Button>
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {!isOpen ? <Tooltip content="Borders">{button}</Tooltip> : button}

      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            backgroundColor: 'white',
            border: '1px solid var(--doc-border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
            padding: 6,
            zIndex: 1000,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 2,
            }}
          >
            {BORDER_PRESETS.map(({ action, icon, label }) => (
              <button
                key={typeof action === 'string' ? action : action.type}
                type="button"
                title={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  border: '1px solid transparent',
                  borderRadius: 4,
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--doc-text)',
                }}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'var(--doc-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
                onClick={() => handlePreset(action)}
              >
                <MaterialSymbol name={icon} size={18} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TableBorderPicker;
