/**
 * TableBorderWidthPicker - Popover with border width options
 *
 * Shows 5 width options as horizontal lines at that thickness.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './Button';
import { Tooltip } from './Tooltip';
import { MaterialSymbol } from './MaterialSymbol';
import { cn } from '../../lib/utils';
import type { TableAction } from './TableToolbar';

export interface TableBorderWidthPickerProps {
  onAction: (action: TableAction) => void;
  disabled?: boolean;
}

const WIDTH_OPTIONS: { size: number; label: string; thickness: number }[] = [
  { size: 4, label: '0.5 pt', thickness: 0.5 },
  { size: 8, label: '1 pt', thickness: 1 },
  { size: 12, label: '1.5 pt', thickness: 1.5 },
  { size: 16, label: '2 pt', thickness: 2 },
  { size: 24, label: '3 pt', thickness: 3 },
];

export function TableBorderWidthPicker({
  onAction,
  disabled = false,
}: TableBorderWidthPickerProps) {
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

  const handleSelect = useCallback(
    (size: number) => {
      onAction({ type: 'borderWidth', size });
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
      aria-label="Border width"
      aria-expanded={isOpen}
      aria-haspopup="true"
      data-testid="toolbar-table-border-width"
    >
      <MaterialSymbol name="line_weight" size={20} />
      <MaterialSymbol name="arrow_drop_down" size={14} className="-ml-1" />
    </Button>
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {!isOpen ? <Tooltip content="Border width">{button}</Tooltip> : button}

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
            padding: '4px 0',
            zIndex: 1000,
            minWidth: 120,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {WIDTH_OPTIONS.map(({ size, label, thickness }) => (
            <button
              key={size}
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 12px',
                width: '100%',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: 12,
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
              onClick={() => handleSelect(size)}
            >
              <div
                style={{
                  width: 50,
                  height: Math.max(thickness, 1),
                  backgroundColor: '#000',
                  borderRadius: thickness > 2 ? 1 : 0,
                }}
              />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default TableBorderWidthPicker;
