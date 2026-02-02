/**
 * Font Size Picker Component
 *
 * A dropdown/input selector for choosing font sizes in the DOCX editor:
 * - Dropdown with common sizes (8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72)
 * - Also accepts custom input
 * - Shows current size of selection
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { CSSProperties, ChangeEvent, KeyboardEvent } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for the FontSizePicker component
 */
export interface FontSizePickerProps {
  /** Currently selected font size (in points) */
  value?: number;
  /** Callback when size is selected */
  onChange?: (size: number) => void;
  /** Custom size options (if not using defaults) */
  sizes?: number[];
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Placeholder text when no size selected */
  placeholder?: string;
  /** Width of the dropdown */
  width?: number | string;
  /** Minimum allowed size */
  minSize?: number;
  /** Maximum allowed size */
  maxSize?: number;
}

// ============================================================================
// DEFAULT SIZES
// ============================================================================

/**
 * Common font sizes in points
 */
const DEFAULT_SIZES: number[] = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];

/**
 * Size constraints
 */
const MIN_SIZE = 1;
const MAX_SIZE = 999;

// ============================================================================
// STYLES
// ============================================================================

const PICKER_CONTAINER_STYLE: CSSProperties = {
  position: 'relative',
  display: 'inline-block',
};

const PICKER_INPUT_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '60px',
  height: '32px',
  padding: '4px 8px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  backgroundColor: '#fff',
  fontSize: '13px',
  color: '#333',
  textAlign: 'center',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const PICKER_INPUT_FOCUS_STYLE: CSSProperties = {
  ...PICKER_INPUT_STYLE,
  borderColor: '#0066cc',
  boxShadow: '0 0 0 2px rgba(0, 102, 204, 0.2)',
};

const PICKER_INPUT_DISABLED_STYLE: CSSProperties = {
  ...PICKER_INPUT_STYLE,
  backgroundColor: '#f5f5f5',
  color: '#999',
  cursor: 'not-allowed',
};

const PICKER_WRAPPER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
};

const BUTTON_WRAPPER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '32px',
  marginLeft: '-1px',
  border: '1px solid #ccc',
  borderRadius: '0 4px 4px 0',
  backgroundColor: '#fff',
  cursor: 'pointer',
  padding: 0,
  transition: 'background-color 0.15s, border-color 0.15s',
};

const BUTTON_WRAPPER_HOVER_STYLE: CSSProperties = {
  ...BUTTON_WRAPPER_STYLE,
  backgroundColor: '#f5f5f5',
  borderColor: '#999',
};

const BUTTON_WRAPPER_DISABLED_STYLE: CSSProperties = {
  ...BUTTON_WRAPPER_STYLE,
  backgroundColor: '#f5f5f5',
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
  display: 'block',
  width: '100%',
  padding: '6px 12px',
  border: 'none',
  backgroundColor: 'transparent',
  textAlign: 'center',
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

const CHEVRON_STYLE: CSSProperties = {
  width: '14px',
  height: '14px',
  color: '#666',
};

// ============================================================================
// ICONS
// ============================================================================

const ChevronDownIcon = () => (
  <svg style={CHEVRON_STYLE} viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 6l4 4 4-4H4z" />
  </svg>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Font size dropdown/input selector
 */
export function FontSizePicker({
  value,
  onChange,
  sizes = DEFAULT_SIZES,
  disabled = false,
  className,
  style,
  placeholder = '',
  width = 80,
  minSize = MIN_SIZE,
  maxSize = MAX_SIZE,
}: FontSizePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [inputValue, setInputValue] = useState<string>(value?.toString() || '');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Update input value when prop changes
  useEffect(() => {
    if (!isInputFocused) {
      setInputValue(value?.toString() || '');
    }
  }, [value, isInputFocused]);

  // Get current size index in the sizes array
  const currentSizeIndex = useMemo(() => {
    if (value === undefined) return -1;
    return sizes.indexOf(value);
  }, [value, sizes]);

  /**
   * Close dropdown when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Validate and apply size
   */
  const applySize = useCallback(
    (sizeStr: string) => {
      const parsed = parseFloat(sizeStr);
      if (!isNaN(parsed)) {
        // Clamp to valid range
        const clamped = Math.min(Math.max(parsed, minSize), maxSize);
        // Round to one decimal place
        const rounded = Math.round(clamped * 10) / 10;
        onChange?.(rounded);
        setInputValue(rounded.toString());
      } else {
        // Revert to previous value
        setInputValue(value?.toString() || '');
      }
    },
    [onChange, value, minSize, maxSize]
  );

  /**
   * Handle input change
   */
  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Allow empty, numbers, and decimal point
    if (newValue === '' || /^\d*\.?\d*$/.test(newValue)) {
      setInputValue(newValue);
    }
  }, []);

  /**
   * Handle input blur
   */
  const handleInputBlur = useCallback(() => {
    setIsInputFocused(false);
    if (inputValue.trim()) {
      applySize(inputValue);
    } else {
      setInputValue(value?.toString() || '');
    }
  }, [inputValue, applySize, value]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement | HTMLButtonElement>) => {
      if (disabled) return;

      switch (event.key) {
        case 'Enter':
          event.preventDefault();
          if (isOpen && focusedIndex >= 0) {
            const size = sizes[focusedIndex];
            if (size !== undefined) {
              onChange?.(size);
              setInputValue(size.toString());
              setIsOpen(false);
            }
          } else if (!isOpen && inputValue.trim()) {
            applySize(inputValue);
          }
          break;

        case 'Escape':
          setIsOpen(false);
          setInputValue(value?.toString() || '');
          break;

        case 'ArrowDown':
          event.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            const idx = currentSizeIndex >= 0 ? currentSizeIndex : 0;
            setFocusedIndex(idx);
          } else {
            setFocusedIndex((prev) => (prev < sizes.length - 1 ? prev + 1 : prev));
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
            setFocusedIndex(sizes.length - 1);
          }
          break;
      }
    },
    [
      disabled,
      isOpen,
      focusedIndex,
      sizes,
      onChange,
      inputValue,
      applySize,
      value,
      currentSizeIndex,
    ]
  );

  /**
   * Handle size selection from dropdown
   */
  const handleSelect = useCallback(
    (size: number) => {
      onChange?.(size);
      setInputValue(size.toString());
      setIsOpen(false);
      inputRef.current?.focus();
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
        const idx = currentSizeIndex >= 0 ? currentSizeIndex : 0;
        setFocusedIndex(idx);
      }
    }
  }, [disabled, isOpen, currentSizeIndex]);

  /**
   * Scroll focused item into view
   */
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-size-item]');
      const focusedItem = items[focusedIndex] as HTMLElement;
      if (focusedItem) {
        focusedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen, focusedIndex]);

  // Determine styles
  const inputStyle: CSSProperties = disabled
    ? {
        ...PICKER_INPUT_DISABLED_STYLE,
        width: typeof width === 'number' ? width - 20 : 'calc(' + width + ' - 20px)',
        borderRadius: '4px 0 0 4px',
      }
    : isInputFocused
      ? {
          ...PICKER_INPUT_FOCUS_STYLE,
          width: typeof width === 'number' ? width - 20 : 'calc(' + width + ' - 20px)',
          borderRadius: '4px 0 0 4px',
        }
      : {
          ...PICKER_INPUT_STYLE,
          width: typeof width === 'number' ? width - 20 : 'calc(' + width + ' - 20px)',
          borderRadius: '4px 0 0 4px',
        };

  const buttonStyle: CSSProperties = disabled
    ? BUTTON_WRAPPER_DISABLED_STYLE
    : isButtonHovered
      ? BUTTON_WRAPPER_HOVER_STYLE
      : BUTTON_WRAPPER_STYLE;

  return (
    <div
      ref={containerRef}
      className={`docx-font-size-picker ${className || ''}`}
      style={{ ...PICKER_CONTAINER_STYLE, ...style }}
    >
      <div style={PICKER_WRAPPER_STYLE}>
        <input
          ref={inputRef}
          type="text"
          className="docx-font-size-picker-input"
          style={inputStyle}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            setIsInputFocused(true);
            inputRef.current?.select();
          }}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Font size"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        />
        <button
          type="button"
          className="docx-font-size-picker-button"
          style={buttonStyle}
          onClick={toggleDropdown}
          onKeyDown={handleKeyDown}
          onMouseEnter={() => setIsButtonHovered(true)}
          onMouseLeave={() => setIsButtonHovered(false)}
          disabled={disabled}
          aria-label="Select font size"
          tabIndex={-1}
        >
          <ChevronDownIcon />
        </button>
      </div>

      {isOpen && (
        <div
          ref={listRef}
          className="docx-font-size-picker-dropdown"
          style={DROPDOWN_STYLE}
          role="listbox"
          aria-label="Available font sizes"
        >
          {sizes.map((size, index) => {
            const isSelected = size === value;
            const isFocusedItem = index === focusedIndex;

            const itemStyle: CSSProperties = isSelected
              ? DROPDOWN_ITEM_SELECTED_STYLE
              : isFocusedItem
                ? DROPDOWN_ITEM_HOVER_STYLE
                : DROPDOWN_ITEM_STYLE;

            return (
              <button
                key={size}
                type="button"
                data-size-item
                style={itemStyle}
                onClick={() => handleSelect(size)}
                onMouseEnter={() => setFocusedIndex(index)}
                role="option"
                aria-selected={isSelected}
              >
                {size}
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
 * Get default font size options
 */
export function getDefaultSizes(): number[] {
  return [...DEFAULT_SIZES];
}

/**
 * Check if a font size is valid
 */
export function isValidFontSize(size: number, min = MIN_SIZE, max = MAX_SIZE): boolean {
  return !isNaN(size) && size >= min && size <= max;
}

/**
 * Clamp a font size to valid range
 */
export function clampFontSize(size: number, min = MIN_SIZE, max = MAX_SIZE): number {
  return Math.min(Math.max(size, min), max);
}

/**
 * Convert half-points to points (OOXML uses half-points)
 */
export function halfPointsToPoints(halfPoints: number): number {
  return halfPoints / 2;
}

/**
 * Convert points to half-points (OOXML uses half-points)
 */
export function pointsToHalfPoints(points: number): number {
  return points * 2;
}

/**
 * Format a font size for display
 */
export function formatFontSize(size: number): string {
  // Remove trailing zeros after decimal point
  const formatted = size.toFixed(1);
  return formatted.endsWith('.0') ? size.toString() : formatted;
}

/**
 * Parse a font size from string input
 */
export function parseFontSize(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parsed = parseFloat(trimmed);
  if (isNaN(parsed)) return null;

  return parsed;
}

/**
 * Get common size presets grouped by category
 */
export function getSizePresets(): Record<string, number[]> {
  return {
    small: [8, 9, 10, 11],
    normal: [12, 14, 16],
    large: [18, 20, 24],
    heading: [28, 36, 48, 72],
  };
}

/**
 * Find the nearest standard size
 */
export function nearestStandardSize(size: number, standardSizes = DEFAULT_SIZES): number {
  if (standardSizes.length === 0) return size;

  let nearest = standardSizes[0];
  let minDiff = Math.abs(size - nearest);

  for (const stdSize of standardSizes) {
    const diff = Math.abs(size - stdSize);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = stdSize;
    }
  }

  return nearest;
}

/**
 * Get the next larger standard size
 */
export function nextLargerSize(currentSize: number, standardSizes = DEFAULT_SIZES): number {
  for (const size of standardSizes) {
    if (size > currentSize) {
      return size;
    }
  }
  return currentSize;
}

/**
 * Get the next smaller standard size
 */
export function nextSmallerSize(currentSize: number, standardSizes = DEFAULT_SIZES): number {
  for (let i = standardSizes.length - 1; i >= 0; i--) {
    if (standardSizes[i] < currentSize) {
      return standardSizes[i];
    }
  }
  return currentSize;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default FontSizePicker;
