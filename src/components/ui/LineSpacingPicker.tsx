/**
 * Line Spacing Picker Component
 *
 * A dropdown selector for choosing line spacing values in the DOCX editor:
 * - Common line spacing values: 1.0, 1.15, 1.5, 2.0, 2.5, 3.0
 * - Shows current line spacing of selection
 * - Applies line spacing to paragraph formatting
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Line spacing option
 */
export interface LineSpacingOption {
  /** Display label */
  label: string;
  /** Line spacing multiplier value (1.0, 1.15, 1.5, etc.) */
  value: number;
  /** Internal OOXML value in twips (for 'auto' line rule: 240 = single spacing) */
  twipsValue: number;
}

/**
 * Props for the LineSpacingPicker component
 */
export interface LineSpacingPickerProps {
  /** Currently selected line spacing value (OOXML twips value, e.g., 240 = single) */
  value?: number;
  /** Callback when line spacing is selected, receives twips value */
  onChange?: (twipsValue: number) => void;
  /** Custom spacing options (if not using defaults) */
  options?: LineSpacingOption[];
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Width of the dropdown */
  width?: number | string;
  /** Title/tooltip */
  title?: string;
}

// ============================================================================
// DEFAULT OPTIONS
// ============================================================================

/**
 * Standard line spacing options
 * OOXML uses twips for line spacing when lineRule="auto"
 * 240 twips = 1.0 line spacing (single)
 */
const DEFAULT_OPTIONS: LineSpacingOption[] = [
  { label: '1.0', value: 1.0, twipsValue: 240 },
  { label: '1.15', value: 1.15, twipsValue: 276 },
  { label: '1.5', value: 1.5, twipsValue: 360 },
  { label: '2.0', value: 2.0, twipsValue: 480 },
  { label: '2.5', value: 2.5, twipsValue: 600 },
  { label: '3.0', value: 3.0, twipsValue: 720 },
];

// ============================================================================
// STYLES
// ============================================================================

const PICKER_CONTAINER_STYLE: CSSProperties = {
  position: 'relative',
  display: 'inline-block',
};

const PICKER_TRIGGER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '4px',
  height: '32px',
  padding: '4px 8px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  backgroundColor: '#fff',
  fontSize: '13px',
  color: '#333',
  cursor: 'pointer',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  minWidth: '80px',
};

const PICKER_TRIGGER_HOVER_STYLE: CSSProperties = {
  ...PICKER_TRIGGER_STYLE,
  borderColor: '#999',
};

const PICKER_TRIGGER_FOCUS_STYLE: CSSProperties = {
  ...PICKER_TRIGGER_STYLE,
  borderColor: '#0066cc',
  boxShadow: '0 0 0 2px rgba(0, 102, 204, 0.2)',
};

const PICKER_TRIGGER_DISABLED_STYLE: CSSProperties = {
  ...PICKER_TRIGGER_STYLE,
  backgroundColor: '#f5f5f5',
  color: '#999',
  cursor: 'not-allowed',
};

const DROPDOWN_STYLE: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  zIndex: 1000,
  minWidth: '100%',
  maxHeight: '200px',
  marginTop: '2px',
  padding: '4px 0',
  backgroundColor: '#fff',
  border: '1px solid #ccc',
  borderRadius: '4px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  overflowY: 'auto',
};

const DROPDOWN_ITEM_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  padding: '8px 12px',
  border: 'none',
  backgroundColor: 'transparent',
  textAlign: 'left',
  cursor: 'pointer',
  fontSize: '13px',
  color: '#333',
  transition: 'background-color 0.1s',
};

const DROPDOWN_ITEM_HOVER_STYLE: CSSProperties = {
  ...DROPDOWN_ITEM_STYLE,
  backgroundColor: '#f0f4f8',
};

const DROPDOWN_ITEM_SELECTED_STYLE: CSSProperties = {
  ...DROPDOWN_ITEM_STYLE,
  backgroundColor: '#e3f2fd',
  fontWeight: 500,
};

const ICON_STYLE: CSSProperties = {
  width: '16px',
  height: '16px',
  color: '#666',
  flexShrink: 0,
};

const CHEVRON_STYLE: CSSProperties = {
  width: '14px',
  height: '14px',
  color: '#666',
  flexShrink: 0,
};

// ============================================================================
// ICONS
// ============================================================================

/**
 * Line spacing icon (horizontal lines)
 */
export const LineSpacingIcon = () => (
  <svg style={ICON_STYLE} viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 3h12v1H2V3zm0 4h12v1H2V7zm0 4h12v1H2v-1z" />
    <path d="M14 2v12l-1.5-2h-1L14 2zm-12 0v12l1.5-2h1L2 2z" opacity="0.5" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg style={CHEVRON_STYLE} viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 6l4 4 4-4H4z" />
  </svg>
);

const CheckIcon = () => (
  <svg style={{ ...ICON_STYLE, color: '#1a73e8' }} viewBox="0 0 16 16" fill="currentColor">
    <path d="M6.5 12L2 7.5l1.4-1.4 3.1 3.1 6.1-6.1L14 4.5 6.5 12z" />
  </svg>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Line spacing dropdown selector
 */
export function LineSpacingPicker({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  disabled = false,
  className,
  style,
  width = 100,
  title = 'Line Spacing',
}: LineSpacingPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [isHovered, setIsHovered] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Find current option by twips value
  const currentOption = useMemo(() => {
    if (value === undefined) return undefined;
    return options.find((opt) => opt.twipsValue === value);
  }, [value, options]);

  // Get current option index
  const currentIndex = useMemo(() => {
    if (!currentOption) return -1;
    return options.indexOf(currentOption);
  }, [currentOption, options]);

  /**
   * Close dropdown when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Handle option selection
   */
  const handleSelect = useCallback(
    (option: LineSpacingOption) => {
      onChange?.(option.twipsValue);
      setIsOpen(false);
    },
    [onChange]
  );

  /**
   * Toggle dropdown
   */
  const toggleDropdown = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
      if (!isOpen) {
        const idx = currentIndex >= 0 ? currentIndex : 0;
        setFocusedIndex(idx);
      }
    }
  }, [disabled, isOpen, currentIndex]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;

      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (isOpen && focusedIndex >= 0) {
            const option = options[focusedIndex];
            if (option) {
              handleSelect(option);
            }
          } else {
            toggleDropdown();
          }
          break;

        case 'Escape':
          setIsOpen(false);
          break;

        case 'ArrowDown':
          event.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            const idx = currentIndex >= 0 ? currentIndex : 0;
            setFocusedIndex(idx);
          } else {
            setFocusedIndex((prev) =>
              prev < options.length - 1 ? prev + 1 : prev
            );
          }
          break;

        case 'ArrowUp':
          event.preventDefault();
          if (isOpen) {
            setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          }
          break;

        case 'Home':
          if (isOpen) {
            event.preventDefault();
            setFocusedIndex(0);
          }
          break;

        case 'End':
          if (isOpen) {
            event.preventDefault();
            setFocusedIndex(options.length - 1);
          }
          break;
      }
    },
    [disabled, isOpen, focusedIndex, options, handleSelect, toggleDropdown, currentIndex]
  );

  /**
   * Scroll focused item into view
   */
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-spacing-item]');
      const focusedItem = items[focusedIndex] as HTMLElement;
      if (focusedItem) {
        focusedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen, focusedIndex]);

  // Determine trigger style
  const triggerStyle: CSSProperties = disabled
    ? { ...PICKER_TRIGGER_DISABLED_STYLE, width }
    : isOpen
    ? { ...PICKER_TRIGGER_FOCUS_STYLE, width }
    : isHovered
    ? { ...PICKER_TRIGGER_HOVER_STYLE, width }
    : { ...PICKER_TRIGGER_STYLE, width };

  // Display value
  const displayValue = currentOption?.label || '1.0';

  return (
    <div
      ref={containerRef}
      className={`docx-line-spacing-picker ${className || ''}`}
      style={{ ...PICKER_CONTAINER_STYLE, ...style }}
    >
      <button
        type="button"
        className="docx-line-spacing-picker-trigger"
        style={triggerStyle}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={disabled}
        title={title}
        aria-label={title}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <LineSpacingIcon />
        <span style={{ flex: 1, textAlign: 'center' }}>{displayValue}</span>
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div
          ref={listRef}
          className="docx-line-spacing-picker-dropdown"
          style={DROPDOWN_STYLE}
          role="listbox"
          aria-label="Line spacing options"
        >
          {options.map((option, index) => {
            const isSelected = option.twipsValue === value;
            const isFocusedItem = index === focusedIndex;

            const itemStyle: CSSProperties = isSelected
              ? DROPDOWN_ITEM_SELECTED_STYLE
              : isFocusedItem
              ? DROPDOWN_ITEM_HOVER_STYLE
              : DROPDOWN_ITEM_STYLE;

            return (
              <button
                key={option.value}
                type="button"
                data-spacing-item
                style={itemStyle}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setFocusedIndex(index)}
                role="option"
                aria-selected={isSelected}
              >
                <span style={{ width: '16px' }}>
                  {isSelected && <CheckIcon />}
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get default line spacing options
 */
export function getDefaultLineSpacingOptions(): LineSpacingOption[] {
  return [...DEFAULT_OPTIONS];
}

/**
 * Convert line spacing multiplier to OOXML twips value
 * For 'auto' lineRule: 240 twips = 1.0 (single) line spacing
 */
export function lineSpacingMultiplierToTwips(multiplier: number): number {
  return Math.round(multiplier * 240);
}

/**
 * Convert OOXML twips value to line spacing multiplier
 * For 'auto' lineRule: 240 twips = 1.0 (single) line spacing
 */
export function twipsToLineSpacingMultiplier(twips: number): number {
  return twips / 240;
}

/**
 * Get the display label for a line spacing value
 */
export function getLineSpacingLabel(twips: number): string {
  const option = DEFAULT_OPTIONS.find((opt) => opt.twipsValue === twips);
  if (option) return option.label;

  // Calculate the multiplier and format it
  const multiplier = twipsToLineSpacingMultiplier(twips);
  return multiplier.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Check if a twips value corresponds to a standard line spacing
 */
export function isStandardLineSpacing(twips: number): boolean {
  return DEFAULT_OPTIONS.some((opt) => opt.twipsValue === twips);
}

/**
 * Get the nearest standard line spacing option
 */
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

/**
 * Create a custom line spacing option
 */
export function createLineSpacingOption(multiplier: number): LineSpacingOption {
  const twipsValue = lineSpacingMultiplierToTwips(multiplier);
  const label = multiplier.toFixed(2).replace(/\.?0+$/, '');
  return { label, value: multiplier, twipsValue };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default LineSpacingPicker;
