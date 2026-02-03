/**
 * Font Size Picker Component (Google Docs Style)
 *
 * A font size control with minus/plus buttons and editable input.
 * Features:
 * - Minus button to decrease font size
 * - Plus button to increase font size
 * - Editable input for custom sizes
 * - Click input to show dropdown with preset sizes
 */

import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from './Button';
import { MaterialSymbol } from './MaterialSymbol';
import { cn } from '../../lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface FontSizePickerProps {
  value?: number;
  onChange?: (size: number) => void;
  sizes?: number[];
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  width?: number | string;
  minSize?: number;
  maxSize?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_SIZES: number[] = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];
const DEFAULT_MIN_SIZE = 1;
const DEFAULT_MAX_SIZE = 400;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert half-points to points (OOXML uses half-points for font sizes)
 */
export function halfPointsToPoints(halfPoints: number): number {
  return halfPoints / 2;
}

/**
 * Convert points to half-points
 */
export function pointsToHalfPoints(points: number): number {
  return points * 2;
}

/**
 * Find the next size in the preset list (going up)
 */
function getNextSize(currentSize: number, sizes: number[], maxSize: number): number {
  for (const size of sizes) {
    if (size > currentSize) {
      return size;
    }
  }
  // If current size is beyond preset list, increment by 1
  return Math.min(currentSize + 1, maxSize);
}

/**
 * Find the previous size in the preset list (going down)
 */
function getPrevSize(currentSize: number, sizes: number[], minSize: number): number {
  for (let i = sizes.length - 1; i >= 0; i--) {
    if (sizes[i] < currentSize) {
      return sizes[i];
    }
  }
  // If current size is below preset list, decrement by 1
  return Math.max(currentSize - 1, minSize);
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FontSizePicker({
  value,
  onChange,
  sizes = DEFAULT_SIZES,
  disabled = false,
  className,
  placeholder = '11',
  minSize = DEFAULT_MIN_SIZE,
  maxSize = DEFAULT_MAX_SIZE,
}: FontSizePickerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentValue = value ?? (parseInt(placeholder, 10) || 11);
  const displayValue = value !== undefined ? value.toString() : placeholder;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsEditing(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDropdownOpen]);

  // Handle decrease font size
  const handleDecrease = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (disabled) return;
      const newSize = getPrevSize(currentValue, sizes, minSize);
      onChange?.(newSize);
    },
    [currentValue, sizes, minSize, disabled, onChange]
  );

  // Handle increase font size
  const handleIncrease = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (disabled) return;
      const newSize = getNextSize(currentValue, sizes, maxSize);
      onChange?.(newSize);
    },
    [currentValue, sizes, maxSize, disabled, onChange]
  );

  // Handle input click - start editing
  const handleInputClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (disabled) return;
      setIsEditing(true);
      setInputValue(displayValue);
      setIsDropdownOpen(true);
      // Focus input after state update
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    },
    [disabled, displayValue]
  );

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  // Handle input blur - commit change
  const handleInputBlur = useCallback(() => {
    setIsEditing(false);
    const size = parseInt(inputValue, 10);
    if (!isNaN(size) && size >= minSize && size <= maxSize) {
      onChange?.(size);
    }
  }, [inputValue, minSize, maxSize, onChange]);

  // Handle input keydown
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleInputBlur();
        setIsDropdownOpen(false);
      } else if (e.key === 'Escape') {
        setIsEditing(false);
        setIsDropdownOpen(false);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newSize = getNextSize(currentValue, sizes, maxSize);
        setInputValue(newSize.toString());
        onChange?.(newSize);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newSize = getPrevSize(currentValue, sizes, minSize);
        setInputValue(newSize.toString());
        onChange?.(newSize);
      }
    },
    [handleInputBlur, currentValue, sizes, maxSize, minSize, onChange]
  );

  // Handle dropdown item click
  const handleSizeSelect = useCallback(
    (size: number) => {
      onChange?.(size);
      setIsDropdownOpen(false);
      setIsEditing(false);
    },
    [onChange]
  );

  // Prevent mousedown from stealing focus
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Allow input to receive focus
    if ((e.target as HTMLElement).tagName !== 'INPUT') {
      e.preventDefault();
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn('flex items-center', className)}
      onMouseDown={handleMouseDown}
    >
      {/* Decrease button */}
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          'h-7 w-7 text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 rounded-r-none',
          disabled && 'opacity-30 cursor-not-allowed'
        )}
        onMouseDown={handleDecrease}
        disabled={disabled || currentValue <= minSize}
        aria-label="Decrease font size"
        data-testid="font-size-decrease"
      >
        <MaterialSymbol name="remove" size={18} />
      </Button>

      {/* Font size input/display */}
      <div className="relative">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            className={cn(
              'h-7 w-10 text-center text-sm border border-slate-300 bg-white',
              'focus:outline-none focus:ring-1 focus:ring-slate-400',
              'rounded-none'
            )}
            aria-label="Font size"
            data-testid="font-size-input"
          />
        ) : (
          <button
            type="button"
            onClick={handleInputClick}
            className={cn(
              'h-7 w-10 text-center text-sm border border-slate-200 bg-white',
              'hover:border-slate-300 hover:bg-slate-50',
              'focus:outline-none focus:ring-1 focus:ring-slate-400',
              'rounded-none',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            disabled={disabled}
            aria-label="Font size"
            aria-haspopup="listbox"
            aria-expanded={isDropdownOpen}
            data-testid="font-size-display"
          >
            {displayValue}
          </button>
        )}

        {/* Dropdown */}
        {isDropdownOpen && (
          <div
            ref={dropdownRef}
            className={cn(
              'absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50',
              'bg-white border border-slate-200 rounded-md shadow-lg',
              'max-h-60 overflow-y-auto min-w-[60px]'
            )}
            role="listbox"
            aria-label="Font sizes"
          >
            {sizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => handleSizeSelect(size)}
                className={cn(
                  'w-full px-3 py-1.5 text-sm text-left',
                  'hover:bg-slate-100',
                  size === currentValue && 'bg-slate-100 font-medium'
                )}
                role="option"
                aria-selected={size === currentValue}
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Increase button */}
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          'h-7 w-7 text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 rounded-l-none',
          disabled && 'opacity-30 cursor-not-allowed'
        )}
        onMouseDown={handleIncrease}
        disabled={disabled || currentValue >= maxSize}
        aria-label="Increase font size"
        data-testid="font-size-increase"
      >
        <MaterialSymbol name="add" size={18} />
      </Button>
    </div>
  );
}
