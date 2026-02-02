/**
 * Font Size Picker Component (Radix UI)
 *
 * A dropdown selector for choosing font sizes using Radix Select.
 */

import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './Select';
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
  width = 60,
}: FontSizePickerProps) {
  const displayValue = value !== undefined ? value.toString() : placeholder;

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      const size = parseInt(newValue, 10);
      if (!isNaN(size)) {
        onChange?.(size);
      }
    },
    [onChange]
  );

  return (
    <Select value={displayValue} onValueChange={handleValueChange} disabled={disabled}>
      <SelectTrigger
        className={cn('h-8 text-sm', className)}
        style={{ minWidth: typeof width === 'number' ? `${width}px` : width }}
        aria-label="Select font size"
      >
        <SelectValue placeholder={placeholder}>{displayValue}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {sizes.map((size) => (
          <SelectItem key={size} value={size.toString()}>
            {size}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
