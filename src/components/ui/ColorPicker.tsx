/**
 * Color Picker Component
 *
 * A color picker for the DOCX editor supporting:
 * - Grid of common colors
 * - Text color button (foreground)
 * - Highlight color button (background)
 * - Shows current color of selection
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { CSSProperties, ReactNode, MouseEvent } from 'react';
import type { ColorValue, Theme } from '../../types/document';
import { resolveColor, resolveHighlightColor } from '../../utils/colorResolver';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Color option for the color grid
 */
export interface ColorOption {
  /** Display name for the color */
  name: string;
  /** Hex value (without #) */
  hex: string;
  /** Is this a theme color? */
  isTheme?: boolean;
  /** Theme color slot if applicable */
  themeSlot?: string;
}

/**
 * Props for the ColorPicker component
 */
export interface ColorPickerProps {
  /** Current color value */
  value?: string;
  /** Callback when color is selected */
  onChange?: (color: string) => void;
  /** Type of color picker */
  type?: 'text' | 'highlight';
  /** Theme for resolving theme colors */
  theme?: Theme | null;
  /** Custom colors to display */
  colors?: ColorOption[];
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Placeholder/tooltip text */
  title?: string;
  /** Custom button content */
  children?: ReactNode;
  /** Width of the dropdown */
  dropdownWidth?: number;
  /** Show "No Color" option */
  showNoColor?: boolean;
  /** Show "More Colors" option for custom input */
  showMoreColors?: boolean;
}

/**
 * Props for the ColorGrid component
 */
export interface ColorGridProps {
  /** Colors to display in the grid */
  colors: ColorOption[];
  /** Currently selected color (hex) */
  selectedColor?: string;
  /** Callback when a color is clicked */
  onSelect: (color: ColorOption) => void;
  /** Number of columns in the grid */
  columns?: number;
  /** Cell size in pixels */
  cellSize?: number;
}

// ============================================================================
// DEFAULT COLORS
// ============================================================================

/**
 * Standard Word text colors
 */
const TEXT_COLORS: ColorOption[] = [
  // Row 1: Theme colors (would be resolved from theme)
  { name: 'Black', hex: '000000' },
  { name: 'Dark Red', hex: '7F0000' },
  { name: 'Dark Orange', hex: 'FF6600' },
  { name: 'Dark Yellow', hex: '808000' },
  { name: 'Dark Green', hex: '006400' },
  { name: 'Dark Teal', hex: '008080' },
  { name: 'Dark Blue', hex: '000080' },
  { name: 'Dark Purple', hex: '4B0082' },
  { name: 'Dark Gray', hex: '404040' },
  { name: 'Gray', hex: '808080' },

  // Row 2: Standard colors
  { name: 'Red', hex: 'FF0000' },
  { name: 'Orange', hex: 'FF9900' },
  { name: 'Yellow', hex: 'FFFF00' },
  { name: 'Light Green', hex: '00FF00' },
  { name: 'Cyan', hex: '00FFFF' },
  { name: 'Light Blue', hex: '0066FF' },
  { name: 'Blue', hex: '0000FF' },
  { name: 'Purple', hex: '9900FF' },
  { name: 'Magenta', hex: 'FF00FF' },
  { name: 'Pink', hex: 'FF66FF' },

  // Row 3: Tints
  { name: 'Light Red', hex: 'FFCCCC' },
  { name: 'Light Orange', hex: 'FFE5CC' },
  { name: 'Light Yellow', hex: 'FFFFCC' },
  { name: 'Pale Green', hex: 'CCFFCC' },
  { name: 'Light Cyan', hex: 'CCFFFF' },
  { name: 'Sky Blue', hex: 'CCE5FF' },
  { name: 'Light Blue 2', hex: 'CCCCFF' },
  { name: 'Lavender', hex: 'E5CCFF' },
  { name: 'Light Magenta', hex: 'FFCCFF' },
  { name: 'White', hex: 'FFFFFF' },
];

/**
 * Standard Word highlight colors
 */
const HIGHLIGHT_COLORS: ColorOption[] = [
  { name: 'No Color', hex: '' },
  { name: 'Yellow', hex: 'FFFF00' },
  { name: 'Bright Green', hex: '00FF00' },
  { name: 'Cyan', hex: '00FFFF' },
  { name: 'Magenta', hex: 'FF00FF' },
  { name: 'Blue', hex: '0000FF' },
  { name: 'Red', hex: 'FF0000' },
  { name: 'Dark Blue', hex: '00008B' },
  { name: 'Teal', hex: '008080' },
  { name: 'Green', hex: '008000' },
  { name: 'Violet', hex: '800080' },
  { name: 'Dark Red', hex: '8B0000' },
  { name: 'Dark Yellow', hex: '808000' },
  { name: 'Gray 50%', hex: '808080' },
  { name: 'Gray 25%', hex: 'C0C0C0' },
  { name: 'Black', hex: '000000' },
];

// ============================================================================
// STYLES
// ============================================================================

const PICKER_CONTAINER_STYLE: CSSProperties = {
  position: 'relative',
  display: 'inline-block',
};

const BUTTON_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: '4px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  backgroundColor: '#fff',
  cursor: 'pointer',
  transition: 'border-color 0.15s, background-color 0.15s',
};

const BUTTON_HOVER_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  borderColor: '#999',
  backgroundColor: '#f5f5f5',
};

const BUTTON_ACTIVE_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  borderColor: '#0066cc',
  backgroundColor: '#e3f2fd',
};

const BUTTON_DISABLED_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  backgroundColor: '#f5f5f5',
  cursor: 'not-allowed',
  opacity: 0.6,
};

const COLOR_INDICATOR_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2px',
};

const COLOR_BAR_STYLE: CSSProperties = {
  width: '18px',
  height: '3px',
  borderRadius: '1px',
};

const DROPDOWN_STYLE: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  zIndex: 1000,
  marginTop: '2px',
  padding: '8px',
  backgroundColor: '#fff',
  border: '1px solid #ccc',
  borderRadius: '4px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
};

const GRID_STYLE: CSSProperties = {
  display: 'grid',
  gap: '2px',
};

const GRID_CELL_STYLE: CSSProperties = {
  width: '20px',
  height: '20px',
  border: '1px solid #ccc',
  borderRadius: '2px',
  cursor: 'pointer',
  transition: 'transform 0.1s, border-color 0.1s',
  padding: 0,
};

const GRID_CELL_HOVER_STYLE: CSSProperties = {
  ...GRID_CELL_STYLE,
  transform: 'scale(1.1)',
  borderColor: '#333',
  zIndex: 1,
};

const GRID_CELL_SELECTED_STYLE: CSSProperties = {
  ...GRID_CELL_STYLE,
  borderWidth: '2px',
  borderColor: '#0066cc',
  boxShadow: '0 0 0 1px #0066cc',
};

const NO_COLOR_CELL_STYLE: CSSProperties = {
  ...GRID_CELL_STYLE,
  position: 'relative',
  backgroundColor: '#fff',
};

const NO_COLOR_LINE_STYLE: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '-2px',
  right: '-2px',
  height: '2px',
  backgroundColor: '#ff0000',
  transform: 'rotate(-45deg)',
};

const SECTION_LABEL_STYLE: CSSProperties = {
  fontSize: '11px',
  color: '#666',
  marginBottom: '4px',
  marginTop: '8px',
};

const CUSTOM_COLOR_SECTION_STYLE: CSSProperties = {
  marginTop: '8px',
  paddingTop: '8px',
  borderTop: '1px solid #eee',
};

const CUSTOM_COLOR_INPUT_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const HEX_INPUT_STYLE: CSSProperties = {
  width: '70px',
  height: '24px',
  padding: '2px 6px',
  border: '1px solid #ccc',
  borderRadius: '3px',
  fontSize: '12px',
};

const APPLY_BUTTON_STYLE: CSSProperties = {
  height: '24px',
  padding: '0 8px',
  border: '1px solid #ccc',
  borderRadius: '3px',
  backgroundColor: '#f5f5f5',
  fontSize: '12px',
  cursor: 'pointer',
};

// ============================================================================
// ICONS
// ============================================================================

const TextColorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.5 12L6.5 4h3l3 8h-2l-.5-1.5H6L5.5 12h-2zm3-3.5h3L8.25 5h-.5L6.5 8.5z" />
  </svg>
);

const HighlightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M11.5 2.5l2 2-6 6-3 1 1-3 6-6zm-7.5 9.5h8v1h-8v-1z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
    <path d="M1 2.5l3 3 3-3H1z" />
  </svg>
);

// ============================================================================
// COLOR GRID COMPONENT
// ============================================================================

/**
 * Color grid for displaying selectable colors
 */
export function ColorGrid({
  colors,
  selectedColor,
  onSelect,
  columns = 10,
  cellSize = 20,
}: ColorGridProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const gridStyle: CSSProperties = {
    ...GRID_STYLE,
    gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
  };

  return (
    <div style={gridStyle} className="docx-color-grid" role="grid">
      {colors.map((color, index) => {
        const isSelected = selectedColor?.toUpperCase() === color.hex.toUpperCase();
        const isHovered = hoveredIndex === index;
        const isNoColor = color.hex === '';

        let cellStyle: CSSProperties = {
          ...(isSelected ? GRID_CELL_SELECTED_STYLE : isHovered ? GRID_CELL_HOVER_STYLE : GRID_CELL_STYLE),
          width: `${cellSize}px`,
          height: `${cellSize}px`,
        };

        if (!isNoColor) {
          cellStyle.backgroundColor = `#${color.hex}`;
        }

        return (
          <button
            key={`${color.hex}-${index}`}
            type="button"
            style={isNoColor ? { ...NO_COLOR_CELL_STYLE, ...cellStyle } : cellStyle}
            onClick={() => onSelect(color)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            title={color.name}
            role="gridcell"
            aria-label={color.name}
            aria-selected={isSelected}
          >
            {isNoColor && <span style={NO_COLOR_LINE_STYLE} />}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Color picker component with dropdown grid
 */
export function ColorPicker({
  value,
  onChange,
  type = 'text',
  theme,
  colors,
  disabled = false,
  className,
  style,
  title,
  children,
  dropdownWidth = 230,
  showNoColor = true,
  showMoreColors = true,
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [customHex, setCustomHex] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  // Get default colors based on type
  const defaultColors = useMemo(() => {
    if (type === 'highlight') {
      return HIGHLIGHT_COLORS;
    }
    const baseColors = [...TEXT_COLORS];
    if (showNoColor) {
      // Add "Automatic" option at the beginning for text color
      baseColors.unshift({ name: 'Automatic', hex: '000000' });
    }
    return baseColors;
  }, [type, showNoColor]);

  const displayColors = colors || defaultColors;

  // Resolve current color for display
  const resolvedColor = useMemo(() => {
    if (!value) {
      return type === 'text' ? '#000000' : 'transparent';
    }
    // If value is already a hex color
    if (value.startsWith('#')) {
      return value;
    }
    // If it's a highlight color name
    if (type === 'highlight') {
      const resolved = resolveHighlightColor(value);
      return resolved || 'transparent';
    }
    // Otherwise treat as hex without #
    return `#${value}`;
  }, [value, type]);

  /**
   * Close dropdown when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      const mouseEvent = event as unknown as { target: Node };
      if (
        containerRef.current &&
        !containerRef.current.contains(mouseEvent.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Handle color selection from grid
   */
  const handleColorSelect = useCallback(
    (color: ColorOption) => {
      onChange?.(color.hex);
      setIsOpen(false);
    },
    [onChange]
  );

  /**
   * Handle custom color input
   */
  const handleCustomColorApply = useCallback(() => {
    const hex = customHex.replace(/^#/, '').toUpperCase();
    if (/^[0-9A-F]{6}$/i.test(hex)) {
      onChange?.(hex);
      setIsOpen(false);
      setCustomHex('');
    }
  }, [customHex, onChange]);

  /**
   * Toggle dropdown
   */
  const toggleDropdown = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  // Determine button style
  const buttonStyle: CSSProperties = disabled
    ? BUTTON_DISABLED_STYLE
    : isOpen
    ? BUTTON_ACTIVE_STYLE
    : isHovered
    ? BUTTON_HOVER_STYLE
    : BUTTON_STYLE;

  const defaultTitle = type === 'text' ? 'Font Color' : 'Text Highlight Color';

  return (
    <div
      ref={containerRef}
      className={`docx-color-picker docx-color-picker-${type} ${className || ''}`}
      style={{ ...PICKER_CONTAINER_STYLE, ...style }}
    >
      <button
        type="button"
        className="docx-color-picker-button"
        style={buttonStyle}
        onClick={toggleDropdown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={disabled}
        title={title || defaultTitle}
        aria-label={title || defaultTitle}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {children || (
          <div style={COLOR_INDICATOR_STYLE}>
            {type === 'text' ? <TextColorIcon /> : <HighlightIcon />}
            <div
              style={{
                ...COLOR_BAR_STYLE,
                backgroundColor: resolvedColor === 'transparent' ? '#fff' : resolvedColor,
                border: resolvedColor === 'transparent' ? '1px solid #ccc' : 'none',
              }}
            />
          </div>
        )}
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div
          className="docx-color-picker-dropdown"
          style={{ ...DROPDOWN_STYLE, width: dropdownWidth }}
          role="dialog"
          aria-label={`${type === 'text' ? 'Font' : 'Highlight'} color picker`}
        >
          {type === 'highlight' && (
            <div style={SECTION_LABEL_STYLE}>Highlight Colors</div>
          )}

          <ColorGrid
            colors={displayColors}
            selectedColor={value}
            onSelect={handleColorSelect}
            columns={type === 'highlight' ? 8 : 10}
          />

          {showMoreColors && type === 'text' && (
            <div style={CUSTOM_COLOR_SECTION_STYLE}>
              <div style={SECTION_LABEL_STYLE}>Custom Color</div>
              <div style={CUSTOM_COLOR_INPUT_STYLE}>
                <span style={{ fontSize: '12px', color: '#666' }}>#</span>
                <input
                  type="text"
                  style={HEX_INPUT_STYLE}
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCustomColorApply();
                    }
                  }}
                  placeholder="FF0000"
                  maxLength={6}
                  aria-label="Custom hex color"
                />
                <button
                  type="button"
                  style={APPLY_BUTTON_STYLE}
                  onClick={handleCustomColorApply}
                  disabled={!/^[0-9A-Fa-f]{6}$/.test(customHex)}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SPECIALIZED COMPONENTS
// ============================================================================

/**
 * Text color picker (font color)
 */
export function TextColorPicker(props: Omit<ColorPickerProps, 'type'>) {
  return <ColorPicker {...props} type="text" />;
}

/**
 * Highlight color picker (background color)
 */
export function HighlightColorPicker(props: Omit<ColorPickerProps, 'type'>) {
  return <ColorPicker {...props} type="highlight" showMoreColors={false} />;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get default text colors
 */
export function getTextColors(): ColorOption[] {
  return [...TEXT_COLORS];
}

/**
 * Get default highlight colors
 */
export function getHighlightColors(): ColorOption[] {
  return [...HIGHLIGHT_COLORS];
}

/**
 * Create a color option from hex
 */
export function createColorOption(hex: string, name?: string): ColorOption {
  const normalizedHex = hex.replace(/^#/, '').toUpperCase();
  return {
    hex: normalizedHex,
    name: name || `#${normalizedHex}`,
  };
}

/**
 * Check if a color is in the color list
 */
export function isColorInList(hex: string, colors: ColorOption[]): boolean {
  const normalizedHex = hex.replace(/^#/, '').toUpperCase();
  return colors.some((c) => c.hex.toUpperCase() === normalizedHex);
}

/**
 * Get color name from hex
 */
export function getColorName(hex: string, colors: ColorOption[] = TEXT_COLORS): string | null {
  const normalizedHex = hex.replace(/^#/, '').toUpperCase();
  const found = colors.find((c) => c.hex.toUpperCase() === normalizedHex);
  return found?.name || null;
}

/**
 * Parse color value from various formats
 */
export function parseColorValue(color: string | ColorValue | undefined | null): string {
  if (!color) return '';

  if (typeof color === 'string') {
    return color.replace(/^#/, '').toUpperCase();
  }

  if (color.rgb) {
    return color.rgb.toUpperCase();
  }

  if (color.themeColor) {
    // Would need theme to resolve, return placeholder
    return '';
  }

  return '';
}

/**
 * Check if a hex color is valid
 */
export function isValidHexColor(hex: string): boolean {
  const normalized = hex.replace(/^#/, '');
  return /^[0-9A-Fa-f]{6}$/.test(normalized);
}

/**
 * Get contrasting text color for a background
 */
export function getContrastColor(bgHex: string): string {
  const hex = bgHex.replace(/^#/, '');
  if (hex.length !== 6) return '#000000';

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Get theme colors for picker
 */
export function getThemeColorsForPicker(theme: Theme | null | undefined): ColorOption[] {
  if (!theme?.colorScheme) {
    return [];
  }

  const slots: Array<{ slot: string; name: string }> = [
    { slot: 'dk1', name: 'Dark 1' },
    { slot: 'lt1', name: 'Light 1' },
    { slot: 'dk2', name: 'Dark 2' },
    { slot: 'lt2', name: 'Light 2' },
    { slot: 'accent1', name: 'Accent 1' },
    { slot: 'accent2', name: 'Accent 2' },
    { slot: 'accent3', name: 'Accent 3' },
    { slot: 'accent4', name: 'Accent 4' },
    { slot: 'accent5', name: 'Accent 5' },
    { slot: 'accent6', name: 'Accent 6' },
  ];

  return slots
    .filter((s) => theme.colorScheme![s.slot as keyof typeof theme.colorScheme])
    .map((s) => ({
      name: s.name,
      hex: theme.colorScheme![s.slot as keyof typeof theme.colorScheme] || '',
      isTheme: true,
      themeSlot: s.slot,
    }));
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ColorPicker;
