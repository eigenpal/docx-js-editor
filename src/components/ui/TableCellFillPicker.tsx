/**
 * TableCellFillPicker - Paint bucket icon with color dropdown
 *
 * Reuses the color grid pattern for cell shading color selection.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { Button } from './Button';
import { Tooltip } from './Tooltip';
import { MaterialSymbol } from './MaterialSymbol';
import { cn } from '../../lib/utils';
import type { TableAction } from './TableToolbar';

export interface TableCellFillPickerProps {
  onAction: (action: TableAction) => void;
  disabled?: boolean;
}

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

const swatchStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 2,
  border: '1px solid var(--doc-border)',
  cursor: 'pointer',
  padding: 0,
  backgroundColor: 'transparent',
};

export function TableCellFillPicker({ onAction, disabled = false }: TableCellFillPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentColor, setCurrentColor] = useState<string | null>(null);
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

  const handleColorSelect = useCallback(
    (color: string) => {
      setCurrentColor(color);
      onAction({ type: 'cellFillColor', color });
      setIsOpen(false);
    },
    [onAction]
  );

  const handleNoColor = useCallback(() => {
    setCurrentColor(null);
    onAction({ type: 'cellFillColor', color: null });
    setIsOpen(false);
  }, [onAction]);

  const button = (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn(
        'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 flex-col gap-0 !p-0.5',
        isOpen && 'bg-slate-100',
        disabled && 'opacity-30 cursor-not-allowed'
      )}
      onMouseDown={handleMouseDown}
      onClick={() => !disabled && setIsOpen((prev) => !prev)}
      disabled={disabled}
      aria-label="Cell fill color"
      aria-expanded={isOpen}
      aria-haspopup="true"
      data-testid="toolbar-table-cell-fill"
    >
      <MaterialSymbol name="format_color_fill" size={18} />
      <div
        style={{
          width: 16,
          height: 3,
          backgroundColor: currentColor || 'transparent',
          borderRadius: 0,
          marginTop: -2,
          border: currentColor ? 'none' : '1px solid var(--doc-border)',
        }}
      />
    </Button>
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {!isOpen ? <Tooltip content="Cell fill color">{button}</Tooltip> : button}

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
            padding: 8,
            zIndex: 1000,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 1fr)',
              gap: 2,
            }}
          >
            {QUICK_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                style={{
                  ...swatchStyle,
                  backgroundColor: color,
                  outline: currentColor === color ? '2px solid var(--doc-primary)' : 'none',
                  outlineOffset: 1,
                }}
                title={color}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleColorSelect(color)}
              />
            ))}
          </div>
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 6,
              padding: '4px 8px',
              width: '100%',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--doc-text-muted)',
              borderRadius: 4,
            }}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--doc-bg-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
            onClick={handleNoColor}
          >
            <MaterialSymbol name="format_color_reset" size={14} />
            <span>No fill</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default TableCellFillPicker;
