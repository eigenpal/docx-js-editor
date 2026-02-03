/**
 * Line Spacing Picker Component (Radix UI)
 *
 * A dropdown selector for choosing line spacing values using Radix Select.
 * Styled like Google Docs with options: Single, 1.15, 1.5, Double
 */

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from './Select';
import { MaterialSymbol } from './MaterialSymbol';
import { cn } from '../../lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface LineSpacingOption {
  label: string;
  value: number;
  twipsValue: number;
}

export interface LineSpacingPickerProps {
  value?: number;
  onChange?: (twipsValue: number) => void;
  options?: LineSpacingOption[];
  disabled?: boolean;
  className?: string;
  width?: number | string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Standard line spacing options (Google Docs style)
 * OOXML uses twips for line spacing when lineRule="auto"
 * 240 twips = 1.0 line spacing (single)
 */
const DEFAULT_OPTIONS: LineSpacingOption[] = [
  { label: 'Single', value: 1.0, twipsValue: 240 },
  { label: '1.15', value: 1.15, twipsValue: 276 },
  { label: '1.5', value: 1.5, twipsValue: 360 },
  { label: 'Double', value: 2.0, twipsValue: 480 },
];

// ============================================================================
// ICONS
// ============================================================================

const LineSpacingIcon = () => (
  <MaterialSymbol name="format_line_spacing" size={16} className="text-muted-foreground" />
);

// ============================================================================
// COMPONENT
// ============================================================================

export function LineSpacingPicker({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  disabled = false,
  className,
  width = 90,
}: LineSpacingPickerProps) {
  // Find current option by twips value
  const currentOption = React.useMemo(() => {
    if (value === undefined) return options[0]; // Default to Single
    return options.find((opt) => opt.twipsValue === value) || options[0];
  }, [value, options]);

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      const twips = parseInt(newValue, 10);
      if (!isNaN(twips)) {
        onChange?.(twips);
      }
    },
    [onChange]
  );

  return (
    <Select
      value={currentOption.twipsValue.toString()}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn('h-8 text-sm gap-1', className)}
        style={{ minWidth: typeof width === 'number' ? `${width}px` : width }}
        aria-label="Line spacing"
      >
        <LineSpacingIcon />
        <SelectValue placeholder="Single">
          {currentOption.value === 1.0
            ? '1.0'
            : currentOption.value === 2.0
              ? '2.0'
              : currentOption.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.twipsValue} value={option.twipsValue.toString()}>
            {option.label}
          </SelectItem>
        ))}
        <SelectSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground">Paragraph spacing</div>
      </SelectContent>
    </Select>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getDefaultLineSpacingOptions(): LineSpacingOption[] {
  return [...DEFAULT_OPTIONS];
}

export function lineSpacingMultiplierToTwips(multiplier: number): number {
  return Math.round(multiplier * 240);
}

export function twipsToLineSpacingMultiplier(twips: number): number {
  return twips / 240;
}

export function getLineSpacingLabel(twips: number): string {
  const option = DEFAULT_OPTIONS.find((opt) => opt.twipsValue === twips);
  if (option) return option.label;
  const multiplier = twipsToLineSpacingMultiplier(twips);
  return multiplier.toFixed(2).replace(/\.?0+$/, '');
}

export function isStandardLineSpacing(twips: number): boolean {
  return DEFAULT_OPTIONS.some((opt) => opt.twipsValue === twips);
}

export function nearestStandardLineSpacing(twips: number): LineSpacingOption {
  let nearest = DEFAULT_OPTIONS[0];
  let minDiff = Math.abs(twips - nearest.twipsValue);

  for (const option of DEFAULT_OPTIONS) {
    const diff = Math.abs(twips - option.twipsValue);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = option;
    }
  }

  return nearest;
}

export function createLineSpacingOption(multiplier: number): LineSpacingOption {
  const twipsValue = lineSpacingMultiplierToTwips(multiplier);
  const label = multiplier.toFixed(2).replace(/\.?0+$/, '');
  return { label, value: multiplier, twipsValue };
}

export default LineSpacingPicker;
