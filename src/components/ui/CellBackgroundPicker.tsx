/**
 * CellBackgroundPicker Component
 *
 * UI for changing table cell background/shading color.
 * Provides a color grid similar to the text highlight picker but
 * optimized for table cell backgrounds.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { ShadingProperties } from '../../types/document';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Color option for the picker
 */
export interface CellColorOption {
  /** Hex color value */
  hex: string;
  /** Display name */
  name: string;
}

/**
 * Props for CellBackgroundPicker
 */
export interface CellBackgroundPickerProps {
  /** Current background color (hex) */
  value?: string | null;
  /** Callback when color is selected */
  onChange?: (color: string | null) => void;
  /** Custom color options */
  colors?: CellColorOption[];
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Show "No Fill" option (default: true) */
  showNoFill?: boolean;
  /** Show custom color input (default: true) */
  showCustomColor?: boolean;
  /** Compact mode for toolbar */
  compact?: boolean;
}

// ============================================================================
// STYLES
// ============================================================================

const STYLES: Record<string, CSSProperties> = {
  container: {
    position: 'relative',
    display: 'inline-block',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 8px',
    border: '1px solid #d0d0d0',
    borderRadius: '3px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    gap: '4px',
    minWidth: '32px',
    height: '28px',
    transition: 'background-color 0.15s, border-color 0.15s',
  },
  buttonHover: {
    borderColor: '#1a73e8',
    backgroundColor: '#f0f7ff',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  colorIndicator: {
    width: '16px',
    height: '16px',
    border: '1px solid #ccc',
    borderRadius: '2px',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: '0',
    marginTop: '4px',
    padding: '8px',
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    zIndex: 1000,
    minWidth: '180px',
  },
  colorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '4px',
    marginBottom: '8px',
  },
  colorCell: {
    width: '24px',
    height: '24px',
    border: '1px solid #ccc',
    borderRadius: '2px',
    cursor: 'pointer',
    transition: 'transform 0.1s, box-shadow 0.1s',
  },
  colorCellHover: {
    transform: 'scale(1.1)',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  },
  colorCellSelected: {
    border: '2px solid #1a73e8',
  },
  noFillButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '6px 8px',
    border: 'none',
    borderRadius: '3px',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#333',
    transition: 'background-color 0.15s',
  },
  noFillButtonHover: {
    backgroundColor: '#f0f0f0',
  },
  noFillIcon: {
    width: '16px',
    height: '16px',
    border: '1px solid #ccc',
    borderRadius: '2px',
    position: 'relative',
    backgroundColor: '#fff',
  },
  separator: {
    height: '1px',
    backgroundColor: '#e0e0e0',
    margin: '8px 0',
  },
  customColorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  customColorInput: {
    width: '40px',
    height: '28px',
    padding: '0',
    border: '1px solid #ccc',
    borderRadius: '3px',
    cursor: 'pointer',
  },
  customColorLabel: {
    fontSize: '11px',
    color: '#666',
  },
};

// ============================================================================
// ICONS
// ============================================================================

/**
 * Cell Fill Icon - Paint bucket
 */
function CellFillIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2 12L6.5 2.5L11 7L7 11H13V13H2V12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      <circle cx="13" cy="10" r="2" fill="currentColor" />
    </svg>
  );
}

/**
 * No Fill Icon - Diagonal line through cell
 */
function NoFillIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="12" height="12" stroke="#ccc" strokeWidth="1" fill="none" />
      <line x1="2" y1="14" x2="14" y2="2" stroke="#d32f2f" strokeWidth="1.5" />
    </svg>
  );
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default cell background colors
 * Common colors for table cell backgrounds
 */
export const DEFAULT_CELL_COLORS: CellColorOption[] = [
  // Row 1: Light colors
  { hex: '#FFFFFF', name: 'White' },
  { hex: '#F2F2F2', name: 'Light Gray 1' },
  { hex: '#D9D9D9', name: 'Light Gray 2' },
  { hex: '#BFBFBF', name: 'Gray' },
  { hex: '#808080', name: 'Dark Gray' },
  { hex: '#000000', name: 'Black' },
  // Row 2: Blues
  { hex: '#E6F3FF', name: 'Light Blue 1' },
  { hex: '#CCE5FF', name: 'Light Blue 2' },
  { hex: '#99CCFF', name: 'Light Blue 3' },
  { hex: '#4DA6FF', name: 'Blue' },
  { hex: '#0066CC', name: 'Dark Blue' },
  { hex: '#003366', name: 'Navy' },
  // Row 3: Greens
  { hex: '#E6FFE6', name: 'Light Green 1' },
  { hex: '#CCFFCC', name: 'Light Green 2' },
  { hex: '#99FF99', name: 'Light Green 3' },
  { hex: '#33CC33', name: 'Green' },
  { hex: '#009900', name: 'Dark Green' },
  { hex: '#006600', name: 'Forest' },
  // Row 4: Yellows/Oranges
  { hex: '#FFFFCC', name: 'Light Yellow' },
  { hex: '#FFFF99', name: 'Yellow' },
  { hex: '#FFE066', name: 'Gold' },
  { hex: '#FFCC00', name: 'Orange Yellow' },
  { hex: '#FF9900', name: 'Orange' },
  { hex: '#CC6600', name: 'Dark Orange' },
  // Row 5: Reds/Pinks
  { hex: '#FFE6E6', name: 'Light Pink' },
  { hex: '#FFCCCC', name: 'Pink' },
  { hex: '#FF9999', name: 'Light Red' },
  { hex: '#FF6666', name: 'Red' },
  { hex: '#CC0000', name: 'Dark Red' },
  { hex: '#660000', name: 'Maroon' },
  // Row 6: Purples
  { hex: '#F2E6FF', name: 'Light Purple 1' },
  { hex: '#E6CCFF', name: 'Light Purple 2' },
  { hex: '#CC99FF', name: 'Light Purple 3' },
  { hex: '#9933FF', name: 'Purple' },
  { hex: '#6600CC', name: 'Dark Purple' },
  { hex: '#330066', name: 'Indigo' },
];

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * CellBackgroundPicker - Color picker for table cell backgrounds
 */
export function CellBackgroundPicker({
  value,
  onChange,
  colors = DEFAULT_CELL_COLORS,
  disabled = false,
  className,
  style: additionalStyle,
  showNoFill = true,
  showCustomColor = true,
  compact = false,
}: CellBackgroundPickerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);
  const [noFillHovered, setNoFillHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle toggle
  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  // Handle color selection
  const handleColorSelect = useCallback(
    (color: string) => {
      onChange?.(color);
      setIsOpen(false);
    },
    [onChange]
  );

  // Handle no fill
  const handleNoFill = useCallback(() => {
    onChange?.(null);
    setIsOpen(false);
  }, [onChange]);

  // Handle custom color
  const handleCustomColor = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e.target.value);
    },
    [onChange]
  );

  // Button style
  const buttonStyle: CSSProperties = {
    ...STYLES.button,
    ...(isHovered && !disabled ? STYLES.buttonHover : {}),
    ...(disabled ? STYLES.buttonDisabled : {}),
    ...(compact ? { padding: '2px 4px', minWidth: '28px', height: '24px' } : {}),
  };

  // Color indicator style
  const indicatorStyle: CSSProperties = {
    ...STYLES.colorIndicator,
    backgroundColor: value || 'transparent',
    ...(value === null ? { background: 'repeating-linear-gradient(45deg, #fff, #fff 2px, #f0f0f0 2px, #f0f0f0 4px)' } : {}),
  };

  const classNames = ['docx-cell-background-picker'];
  if (className) classNames.push(className);
  if (compact) classNames.push('docx-cell-background-picker-compact');

  return (
    <div
      ref={containerRef}
      className={classNames.join(' ')}
      style={{ ...STYLES.container, ...additionalStyle }}
    >
      <button
        type="button"
        style={buttonStyle}
        onClick={handleToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={disabled}
        title="Cell Background Color"
        aria-label="Cell Background Color"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <CellFillIcon />
        <div style={indicatorStyle} />
      </button>

      {isOpen && (
        <div style={STYLES.dropdown}>
          {/* No Fill option */}
          {showNoFill && (
            <>
              <button
                type="button"
                style={{
                  ...STYLES.noFillButton,
                  ...(noFillHovered ? STYLES.noFillButtonHover : {}),
                }}
                onClick={handleNoFill}
                onMouseEnter={() => setNoFillHovered(true)}
                onMouseLeave={() => setNoFillHovered(false)}
              >
                <NoFillIcon />
                <span>No Fill</span>
              </button>
              <div style={STYLES.separator} />
            </>
          )}

          {/* Color grid */}
          <div style={STYLES.colorGrid}>
            {colors.map((color) => (
              <button
                key={color.hex}
                type="button"
                style={{
                  ...STYLES.colorCell,
                  backgroundColor: color.hex,
                  ...(hoveredColor === color.hex ? STYLES.colorCellHover : {}),
                  ...(value === color.hex ? STYLES.colorCellSelected : {}),
                }}
                onClick={() => handleColorSelect(color.hex)}
                onMouseEnter={() => setHoveredColor(color.hex)}
                onMouseLeave={() => setHoveredColor(null)}
                title={color.name}
                aria-label={color.name}
              />
            ))}
          </div>

          {/* Custom color */}
          {showCustomColor && (
            <>
              <div style={STYLES.separator} />
              <div style={STYLES.customColorRow}>
                <input
                  type="color"
                  value={value || '#FFFFFF'}
                  onChange={handleCustomColor}
                  style={STYLES.customColorInput}
                  title="Custom Color"
                />
                <span style={STYLES.customColorLabel}>Custom color</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get default cell colors
 */
export function getDefaultCellColors(): CellColorOption[] {
  return DEFAULT_CELL_COLORS;
}

/**
 * Create a color option
 */
export function createCellColorOption(hex: string, name?: string): CellColorOption {
  return {
    hex: hex.toUpperCase(),
    name: name || hex,
  };
}

/**
 * Check if color is in the default palette
 */
export function isDefaultCellColor(hex: string): boolean {
  return DEFAULT_CELL_COLORS.some((c) => c.hex.toUpperCase() === hex.toUpperCase());
}

/**
 * Get color name from hex
 */
export function getCellColorName(hex: string): string {
  const color = DEFAULT_CELL_COLORS.find((c) => c.hex.toUpperCase() === hex.toUpperCase());
  return color?.name || hex;
}

/**
 * Create ShadingProperties from color
 */
export function createShadingFromColor(color: string | null): ShadingProperties | undefined {
  if (!color) {
    return undefined;
  }
  return {
    fill: { rgb: color.replace('#', '') },
    pattern: 'clear',
  };
}

/**
 * Get color from ShadingProperties
 */
export function getColorFromShading(shading: ShadingProperties | undefined): string | null {
  if (!shading || !shading.fill) {
    return null;
  }
  if (shading.fill.rgb) {
    return `#${shading.fill.rgb}`;
  }
  return null;
}

/**
 * Parse hex color to RGB
 */
export function hexToRgbValues(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Get contrasting text color (black or white) for a background
 */
export function getContrastingTextColor(bgHex: string): string {
  const rgb = hexToRgbValues(bgHex);
  if (!rgb) return '#000000';

  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

// ============================================================================
// EXPORTS
// ============================================================================

export default CellBackgroundPicker;
