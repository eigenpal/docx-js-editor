/**
 * Font Picker Component
 *
 * A dropdown selector for choosing font families in the DOCX editor:
 * - Dropdown with available fonts
 * - Shows fonts in their own typeface
 * - Applies to selection
 * - Shows current font of selection
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { resolveFontFamily } from '../../utils/fontResolver';
import { loadFont, isFontLoaded } from '../../utils/fontLoader';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Font option for the picker
 */
export interface FontOption {
  /** Font family name (display name) */
  name: string;
  /** CSS font-family value */
  fontFamily: string;
  /** Whether font is loaded and available */
  loaded?: boolean;
  /** Google Font name to load (if any) */
  googleFont?: string | null;
  /** Category for grouping */
  category?: 'sans-serif' | 'serif' | 'monospace' | 'other';
}

/**
 * Props for the FontPicker component
 */
export interface FontPickerProps {
  /** Currently selected font family */
  value?: string;
  /** Callback when font is selected */
  onChange?: (fontFamily: string) => void;
  /** Custom font options (if not using defaults) */
  fonts?: FontOption[];
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Placeholder text when no font selected */
  placeholder?: string;
  /** Width of the dropdown */
  width?: number | string;
  /** Show font preview in dropdown items */
  showPreview?: boolean;
}

// ============================================================================
// DEFAULT FONTS
// ============================================================================

/**
 * Common fonts for documents
 */
const DEFAULT_FONTS: FontOption[] = [
  // Sans-serif fonts
  { name: 'Arial', fontFamily: 'Arial, Helvetica, sans-serif', category: 'sans-serif' },
  {
    name: 'Calibri',
    fontFamily: '"Carlito", "Calibri", Arial, sans-serif',
    googleFont: 'Carlito',
    category: 'sans-serif',
  },
  { name: 'Helvetica', fontFamily: 'Helvetica, Arial, sans-serif', category: 'sans-serif' },
  { name: 'Verdana', fontFamily: 'Verdana, Geneva, sans-serif', category: 'sans-serif' },
  { name: 'Tahoma', fontFamily: 'Tahoma, Geneva, sans-serif', category: 'sans-serif' },
  { name: 'Trebuchet MS', fontFamily: '"Trebuchet MS", sans-serif', category: 'sans-serif' },
  {
    name: 'Open Sans',
    fontFamily: '"Open Sans", sans-serif',
    googleFont: 'Open Sans',
    category: 'sans-serif',
  },
  {
    name: 'Roboto',
    fontFamily: 'Roboto, sans-serif',
    googleFont: 'Roboto',
    category: 'sans-serif',
  },
  { name: 'Lato', fontFamily: 'Lato, sans-serif', googleFont: 'Lato', category: 'sans-serif' },

  // Serif fonts
  { name: 'Times New Roman', fontFamily: '"Times New Roman", Times, serif', category: 'serif' },
  {
    name: 'Cambria',
    fontFamily: '"Caladea", "Cambria", Georgia, serif',
    googleFont: 'Caladea',
    category: 'serif',
  },
  { name: 'Georgia', fontFamily: 'Georgia, serif', category: 'serif' },
  {
    name: 'Palatino',
    fontFamily: '"Palatino Linotype", Palatino, Georgia, serif',
    category: 'serif',
  },
  {
    name: 'Garamond',
    fontFamily: 'Garamond, "EB Garamond", serif',
    googleFont: 'EB Garamond',
    category: 'serif',
  },
  { name: 'Book Antiqua', fontFamily: '"Book Antiqua", Palatino, serif', category: 'serif' },

  // Monospace fonts
  { name: 'Courier New', fontFamily: '"Courier New", Courier, monospace', category: 'monospace' },
  {
    name: 'Consolas',
    fontFamily: 'Consolas, "Inconsolata", monospace',
    googleFont: 'Inconsolata',
    category: 'monospace',
  },
  { name: 'Monaco', fontFamily: 'Monaco, "Courier New", monospace', category: 'monospace' },
  {
    name: 'Source Code Pro',
    fontFamily: '"Source Code Pro", monospace',
    googleFont: 'Source Code Pro',
    category: 'monospace',
  },
];

// ============================================================================
// STYLES
// ============================================================================

const PICKER_CONTAINER_STYLE: CSSProperties = {
  position: 'relative',
  display: 'inline-block',
};

const PICKER_BUTTON_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  minWidth: '140px',
  height: '32px',
  padding: '4px 8px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontSize: '13px',
  color: '#333',
  textAlign: 'left',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const PICKER_BUTTON_HOVER_STYLE: CSSProperties = {
  ...PICKER_BUTTON_STYLE,
  borderColor: '#0066cc',
};

const PICKER_BUTTON_FOCUS_STYLE: CSSProperties = {
  ...PICKER_BUTTON_STYLE,
  borderColor: '#0066cc',
  boxShadow: '0 0 0 2px rgba(0, 102, 204, 0.2)',
};

const PICKER_BUTTON_DISABLED_STYLE: CSSProperties = {
  ...PICKER_BUTTON_STYLE,
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
  maxWidth: '300px',
  maxHeight: '300px',
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

const CATEGORY_HEADER_STYLE: CSSProperties = {
  padding: '6px 12px',
  fontSize: '11px',
  fontWeight: 600,
  color: '#666',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  backgroundColor: '#f9f9f9',
  borderTop: '1px solid #eee',
  borderBottom: '1px solid #eee',
  marginTop: '4px',
};

const FIRST_CATEGORY_HEADER_STYLE: CSSProperties = {
  ...CATEGORY_HEADER_STYLE,
  marginTop: 0,
  borderTop: 'none',
};

const CHEVRON_STYLE: CSSProperties = {
  width: '16px',
  height: '16px',
  marginLeft: '8px',
  color: '#666',
  flexShrink: 0,
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
 * Font family dropdown selector
 */
export function FontPicker({
  value,
  onChange,
  fonts = DEFAULT_FONTS,
  disabled = false,
  className,
  style,
  placeholder = 'Font',
  width = 160,
  showPreview = true,
}: FontPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [_loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Group fonts by category
  const fontsByCategory = useMemo(() => {
    const groups: Record<string, FontOption[]> = {
      'sans-serif': [],
      serif: [],
      monospace: [],
      other: [],
    };

    for (const font of fonts) {
      const category = font.category || 'other';
      groups[category].push(font);
    }

    return groups;
  }, [fonts]);

  // Create flat list for keyboard navigation
  const flatFontList = useMemo(() => {
    return [
      ...fontsByCategory['sans-serif'],
      ...fontsByCategory['serif'],
      ...fontsByCategory['monospace'],
      ...fontsByCategory['other'],
    ];
  }, [fontsByCategory]);

  // Get current font option
  const currentFont = useMemo(() => {
    if (!value) return null;
    const normalizedValue = value.toLowerCase();
    return fonts.find(
      (f) =>
        f.name.toLowerCase() === normalizedValue ||
        f.fontFamily.toLowerCase().includes(normalizedValue)
    );
  }, [value, fonts]);

  /**
   * Load Google Fonts on mount
   */
  useEffect(() => {
    const loadFonts = async () => {
      const loaded = new Set<string>();

      for (const font of fonts) {
        if (font.googleFont) {
          try {
            await loadFont(font.googleFont);
            loaded.add(font.name);
          } catch {
            // Font loading failed, that's ok
          }
        } else if (isFontLoaded(font.name)) {
          loaded.add(font.name);
        }
      }

      setLoadedFonts(loaded);
    };

    loadFonts();
  }, [fonts]);

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
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return;

      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (isOpen && focusedIndex >= 0) {
            const font = flatFontList[focusedIndex];
            if (font) {
              onChange?.(font.name);
              setIsOpen(false);
            }
          } else {
            setIsOpen(!isOpen);
          }
          break;

        case 'Escape':
          setIsOpen(false);
          buttonRef.current?.focus();
          break;

        case 'ArrowDown':
          event.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            setFocusedIndex(0);
          } else {
            setFocusedIndex((prev) => (prev < flatFontList.length - 1 ? prev + 1 : prev));
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
            setFocusedIndex(flatFontList.length - 1);
          }
          break;
      }
    },
    [disabled, isOpen, focusedIndex, flatFontList, onChange]
  );

  /**
   * Handle font selection
   */
  const handleSelect = useCallback(
    (font: FontOption) => {
      onChange?.(font.name);
      setIsOpen(false);
      buttonRef.current?.focus();
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
        // Reset focused index when opening
        const currentIndex = flatFontList.findIndex((f) => f.name === currentFont?.name);
        setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
      }
    }
  }, [disabled, isOpen, flatFontList, currentFont]);

  /**
   * Scroll focused item into view
   */
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-font-item]');
      const focusedItem = items[focusedIndex] as HTMLElement;
      if (focusedItem) {
        focusedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen, focusedIndex]);

  // Determine button style
  const buttonStyle: CSSProperties = disabled
    ? { ...PICKER_BUTTON_DISABLED_STYLE, width }
    : isFocused
      ? { ...PICKER_BUTTON_FOCUS_STYLE, width }
      : isHovered
        ? { ...PICKER_BUTTON_HOVER_STYLE, width }
        : { ...PICKER_BUTTON_STYLE, width };

  // Render category section
  const renderCategory = (
    category: string,
    categoryFonts: FontOption[],
    isFirst: boolean,
    startIndex: number
  ): ReactNode => {
    if (categoryFonts.length === 0) return null;

    const categoryLabels: Record<string, string> = {
      'sans-serif': 'Sans Serif',
      serif: 'Serif',
      monospace: 'Monospace',
      other: 'Other',
    };

    return (
      <React.Fragment key={category}>
        <div style={isFirst ? FIRST_CATEGORY_HEADER_STYLE : CATEGORY_HEADER_STYLE}>
          {categoryLabels[category] || category}
        </div>
        {categoryFonts.map((font, index) => {
          const globalIndex = startIndex + index;
          const isSelected = font.name === currentFont?.name;
          const isFocusedItem = globalIndex === focusedIndex;

          const itemStyle: CSSProperties = {
            ...(isSelected
              ? DROPDOWN_ITEM_SELECTED_STYLE
              : isFocusedItem
                ? DROPDOWN_ITEM_HOVER_STYLE
                : DROPDOWN_ITEM_STYLE),
            fontFamily: showPreview ? font.fontFamily : undefined,
          };

          return (
            <button
              key={font.name}
              type="button"
              data-font-item
              style={itemStyle}
              onClick={() => handleSelect(font)}
              onMouseEnter={() => setFocusedIndex(globalIndex)}
              role="option"
              aria-selected={isSelected}
            >
              {font.name}
            </button>
          );
        })}
      </React.Fragment>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`docx-font-picker ${className || ''}`}
      style={{ ...PICKER_CONTAINER_STYLE, ...style }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="docx-font-picker-button"
        style={buttonStyle}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select font family"
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: showPreview && currentFont ? currentFont.fontFamily : undefined,
          }}
        >
          {currentFont?.name || value || placeholder}
        </span>
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div
          ref={listRef}
          className="docx-font-picker-dropdown"
          style={DROPDOWN_STYLE}
          role="listbox"
          aria-label="Available fonts"
        >
          {renderCategory('sans-serif', fontsByCategory['sans-serif'], true, 0)}
          {renderCategory(
            'serif',
            fontsByCategory['serif'],
            false,
            fontsByCategory['sans-serif'].length
          )}
          {renderCategory(
            'monospace',
            fontsByCategory['monospace'],
            false,
            fontsByCategory['sans-serif'].length + fontsByCategory['serif'].length
          )}
          {renderCategory(
            'other',
            fontsByCategory['other'],
            false,
            fontsByCategory['sans-serif'].length +
              fontsByCategory['serif'].length +
              fontsByCategory['monospace'].length
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
 * Get default font options
 */
export function getDefaultFonts(): FontOption[] {
  return [...DEFAULT_FONTS];
}

/**
 * Create a font option from a font name
 */
export function createFontOption(fontName: string): FontOption {
  const resolved = resolveFontFamily(fontName);

  // Detect category from resolved font
  let category: FontOption['category'] = 'other';
  const lower = fontName.toLowerCase();

  if (lower.includes('mono') || lower.includes('courier') || lower.includes('consolas')) {
    category = 'monospace';
  } else if (
    lower.includes('times') ||
    lower.includes('georgia') ||
    lower.includes('serif') ||
    lower.includes('cambria') ||
    lower.includes('garamond')
  ) {
    category = 'serif';
  } else if (
    lower.includes('arial') ||
    lower.includes('helvetica') ||
    lower.includes('calibri') ||
    lower.includes('verdana') ||
    lower.includes('sans')
  ) {
    category = 'sans-serif';
  }

  return {
    name: fontName,
    fontFamily: resolved.cssFallback,
    googleFont: resolved.googleFont,
    category,
  };
}

/**
 * Merge custom fonts with default fonts
 */
export function mergeFontOptions(customFonts: FontOption[], includeDefaults = true): FontOption[] {
  if (!includeDefaults) {
    return customFonts;
  }

  const merged = [...DEFAULT_FONTS];
  const existingNames = new Set(merged.map((f) => f.name.toLowerCase()));

  for (const font of customFonts) {
    if (!existingNames.has(font.name.toLowerCase())) {
      merged.push(font);
      existingNames.add(font.name.toLowerCase());
    }
  }

  return merged;
}

/**
 * Check if a font is available
 */
export function isFontAvailable(fontName: string): boolean {
  return isFontLoaded(fontName);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default FontPicker;
