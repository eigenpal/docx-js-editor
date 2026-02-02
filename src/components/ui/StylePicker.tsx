/**
 * Style Picker Component
 *
 * A dropdown selector for applying named styles (Heading 1, Normal, etc.) in the DOCX editor:
 * - Dropdown with available styles from document
 * - Shows style name in its formatting
 * - Shows current style of selection
 * - Applies style to paragraph
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  Style,
  StyleType,
  Theme,
  TextFormatting,
  ParagraphFormatting,
} from '../../types/document';
import { textToStyle } from '../../utils/formatToStyle';
import { halfPointsToPixels } from '../../utils/units';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Style option for the picker
 */
export interface StyleOption {
  /** Style ID (used when applying) */
  styleId: string;
  /** Display name */
  name: string;
  /** Style type */
  type: StyleType;
  /** Whether style is default */
  isDefault?: boolean;
  /** Preview formatting */
  textFormatting?: TextFormatting;
  paragraphFormatting?: ParagraphFormatting;
  /** UI sort priority (lower = higher) */
  priority?: number;
  /** Is quick format style */
  qFormat?: boolean;
}

/**
 * Props for the StylePicker component
 */
export interface StylePickerProps {
  /** Currently selected style ID */
  value?: string;
  /** Callback when style is selected */
  onChange?: (styleId: string) => void;
  /** Available styles from document */
  styles?: Style[];
  /** Document theme for color resolution */
  theme?: Theme | null;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Placeholder text when no style selected */
  placeholder?: string;
  /** Width of the dropdown */
  width?: number | string;
  /** Show style preview in dropdown items */
  showPreview?: boolean;
  /** Filter to only show certain style types */
  styleTypes?: StyleType[];
  /** Only show quick format (qFormat) styles */
  quickFormatOnly?: boolean;
}

// ============================================================================
// DEFAULT STYLES
// ============================================================================

/**
 * Default paragraph styles when no document styles available
 */
const DEFAULT_STYLES: StyleOption[] = [
  {
    styleId: 'Normal',
    name: 'Normal',
    type: 'paragraph',
    isDefault: true,
    priority: 0,
    qFormat: true,
    textFormatting: { fontSize: 22 }, // 11pt
  },
  {
    styleId: 'Heading1',
    name: 'Heading 1',
    type: 'paragraph',
    priority: 9,
    qFormat: true,
    textFormatting: { fontSize: 32, bold: true }, // 16pt bold
    paragraphFormatting: { spaceBefore: 240 }, // 12pt before
  },
  {
    styleId: 'Heading2',
    name: 'Heading 2',
    type: 'paragraph',
    priority: 9,
    qFormat: true,
    textFormatting: { fontSize: 26, bold: true }, // 13pt bold
    paragraphFormatting: { spaceBefore: 200 },
  },
  {
    styleId: 'Heading3',
    name: 'Heading 3',
    type: 'paragraph',
    priority: 9,
    qFormat: true,
    textFormatting: { fontSize: 24, bold: true }, // 12pt bold
    paragraphFormatting: { spaceBefore: 160 },
  },
  {
    styleId: 'Title',
    name: 'Title',
    type: 'paragraph',
    priority: 10,
    qFormat: true,
    textFormatting: { fontSize: 56 }, // 28pt
  },
  {
    styleId: 'Subtitle',
    name: 'Subtitle',
    type: 'paragraph',
    priority: 11,
    qFormat: true,
    textFormatting: { fontSize: 28, italic: true }, // 14pt italic
  },
  {
    styleId: 'Quote',
    name: 'Quote',
    type: 'paragraph',
    priority: 29,
    qFormat: true,
    textFormatting: { italic: true },
    paragraphFormatting: { indentLeft: 720 }, // 0.5 inch
  },
  {
    styleId: 'IntenseQuote',
    name: 'Intense Quote',
    type: 'paragraph',
    priority: 30,
    qFormat: true,
    textFormatting: { bold: true, italic: true },
    paragraphFormatting: { indentLeft: 720, indentRight: 720 },
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
  minWidth: '120px',
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
  maxHeight: '350px',
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
  color: '#333',
  transition: 'background-color 0.1s',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const DROPDOWN_ITEM_HOVER_STYLE: CSSProperties = {
  ...DROPDOWN_ITEM_STYLE,
  backgroundColor: '#f0f4f8',
};

const DROPDOWN_ITEM_SELECTED_STYLE: CSSProperties = {
  ...DROPDOWN_ITEM_STYLE,
  backgroundColor: '#e3f2fd',
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
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert Style to StyleOption
 */
function styleToOption(style: Style): StyleOption {
  return {
    styleId: style.styleId,
    name: style.name || style.styleId,
    type: style.type,
    isDefault: style.default,
    textFormatting: style.rPr,
    paragraphFormatting: style.pPr,
    priority: style.uiPriority ?? 99,
    qFormat: style.qFormat,
  };
}

/**
 * Get preview CSS for a style option
 */
function getPreviewStyle(option: StyleOption, theme: Theme | null | undefined): CSSProperties {
  const result: CSSProperties = {};

  // Apply text formatting
  if (option.textFormatting) {
    const textStyle = textToStyle(option.textFormatting, theme || undefined);

    // Copy relevant text styles for preview
    if (textStyle.fontWeight) result.fontWeight = textStyle.fontWeight;
    if (textStyle.fontStyle) result.fontStyle = textStyle.fontStyle;
    if (textStyle.textDecoration) result.textDecoration = textStyle.textDecoration;
    if (textStyle.color) result.color = textStyle.color;

    // Scale font size for preview (don't use full size)
    if (option.textFormatting.fontSize) {
      const originalSize = halfPointsToPixels(option.textFormatting.fontSize);
      // Scale to fit dropdown - max 16px, min 12px
      const scaledSize = Math.min(16, Math.max(12, originalSize * 0.75));
      result.fontSize = `${scaledSize}px`;
    }
  }

  // Apply some paragraph formatting hints
  if (option.paragraphFormatting) {
    // Can't really show alignment/spacing in dropdown, but could hint at indentation
    if (option.paragraphFormatting.indentLeft) {
      result.paddingLeft = '8px';
    }
  }

  return result;
}

/**
 * Get style category label
 */
function getStyleCategory(option: StyleOption): string {
  const nameLower = option.name.toLowerCase();

  if (nameLower.startsWith('heading') || nameLower === 'title' || nameLower === 'subtitle') {
    return 'Headings';
  }
  if (nameLower.includes('quote') || nameLower.includes('citation')) {
    return 'Quotes';
  }
  if (nameLower.includes('list') || nameLower.includes('toc') || nameLower.includes('contents')) {
    return 'Lists & TOC';
  }
  return 'Paragraph';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Style dropdown selector
 */
export function StylePicker({
  value,
  onChange,
  styles,
  theme,
  disabled = false,
  className,
  style,
  placeholder = 'Style',
  width = 140,
  showPreview = true,
  styleTypes = ['paragraph'],
  quickFormatOnly = false,
}: StylePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Convert styles to options
  const styleOptions = useMemo((): StyleOption[] => {
    if (!styles || styles.length === 0) {
      return DEFAULT_STYLES.filter((s) => styleTypes.includes(s.type));
    }

    let options = styles
      .filter((s) => styleTypes.includes(s.type))
      .filter((s) => !s.hidden && !s.semiHidden)
      .map(styleToOption);

    if (quickFormatOnly) {
      options = options.filter((o) => o.qFormat);
    }

    // Sort by priority then name
    options.sort((a, b) => {
      const priorityDiff = (a.priority ?? 99) - (b.priority ?? 99);
      if (priorityDiff !== 0) return priorityDiff;
      return (a.name || '').localeCompare(b.name || '');
    });

    return options;
  }, [styles, styleTypes, quickFormatOnly]);

  // Group styles by category
  const stylesByCategory = useMemo(() => {
    const groups: Record<string, StyleOption[]> = {};

    for (const option of styleOptions) {
      const category = getStyleCategory(option);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(option);
    }

    return groups;
  }, [styleOptions]);

  // Category order
  const categoryOrder = ['Headings', 'Paragraph', 'Quotes', 'Lists & TOC'];

  // Create flat list for keyboard navigation
  const flatStyleList = useMemo(() => {
    const result: StyleOption[] = [];
    for (const category of categoryOrder) {
      if (stylesByCategory[category]) {
        result.push(...stylesByCategory[category]);
      }
    }
    // Add any categories not in order
    for (const [category, options] of Object.entries(stylesByCategory)) {
      if (!categoryOrder.includes(category)) {
        result.push(...options);
      }
    }
    return result;
  }, [stylesByCategory]);

  // Get current style option
  const currentStyle = useMemo(() => {
    if (!value) return null;
    return styleOptions.find((o) => o.styleId === value) || null;
  }, [value, styleOptions]);

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
            const styleOption = flatStyleList[focusedIndex];
            if (styleOption) {
              onChange?.(styleOption.styleId);
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
            setFocusedIndex((prev) => (prev < flatStyleList.length - 1 ? prev + 1 : prev));
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
            setFocusedIndex(flatStyleList.length - 1);
          }
          break;
      }
    },
    [disabled, isOpen, focusedIndex, flatStyleList, onChange]
  );

  /**
   * Handle style selection
   */
  const handleSelect = useCallback(
    (option: StyleOption) => {
      onChange?.(option.styleId);
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
        const currentIndex = flatStyleList.findIndex((o) => o.styleId === currentStyle?.styleId);
        setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
      }
    }
  }, [disabled, isOpen, flatStyleList, currentStyle]);

  /**
   * Scroll focused item into view
   */
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-style-item]');
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

  // Get display text style if preview enabled
  const displayTextStyle: CSSProperties =
    showPreview && currentStyle ? getPreviewStyle(currentStyle, theme) : {};

  // Render category section
  const renderCategory = (
    category: string,
    categoryStyles: StyleOption[],
    isFirst: boolean,
    startIndex: number
  ): ReactNode => {
    if (!categoryStyles || categoryStyles.length === 0) return null;

    return (
      <React.Fragment key={category}>
        <div style={isFirst ? FIRST_CATEGORY_HEADER_STYLE : CATEGORY_HEADER_STYLE}>{category}</div>
        {categoryStyles.map((option, index) => {
          const globalIndex = startIndex + index;
          const isSelected = option.styleId === currentStyle?.styleId;
          const isFocusedItem = globalIndex === focusedIndex;

          const itemBaseStyle = isSelected
            ? DROPDOWN_ITEM_SELECTED_STYLE
            : isFocusedItem
              ? DROPDOWN_ITEM_HOVER_STYLE
              : DROPDOWN_ITEM_STYLE;

          const previewStyle = showPreview ? getPreviewStyle(option, theme) : {};

          const itemStyle: CSSProperties = {
            ...itemBaseStyle,
            ...previewStyle,
          };

          return (
            <button
              key={option.styleId}
              type="button"
              data-style-item
              style={itemStyle}
              onClick={() => handleSelect(option)}
              onMouseEnter={() => setFocusedIndex(globalIndex)}
              role="option"
              aria-selected={isSelected}
            >
              {option.name}
              {option.isDefault && (
                <span style={{ marginLeft: '8px', fontSize: '10px', color: '#999' }}>
                  (default)
                </span>
              )}
            </button>
          );
        })}
      </React.Fragment>
    );
  };

  // Calculate starting indices for each category
  const getCategoryStartIndex = (targetCategory: string): number => {
    let index = 0;
    for (const category of categoryOrder) {
      if (category === targetCategory) return index;
      if (stylesByCategory[category]) {
        index += stylesByCategory[category].length;
      }
    }
    return index;
  };

  return (
    <div
      ref={containerRef}
      className={`docx-style-picker ${className || ''}`}
      style={{ ...PICKER_CONTAINER_STYLE, ...style }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="docx-style-picker-button"
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
        aria-label="Select paragraph style"
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            ...displayTextStyle,
          }}
        >
          {currentStyle?.name || value || placeholder}
        </span>
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div
          ref={listRef}
          className="docx-style-picker-dropdown"
          style={DROPDOWN_STYLE}
          role="listbox"
          aria-label="Available styles"
        >
          {categoryOrder.map((category, catIndex) => {
            const categoryStyles = stylesByCategory[category];
            if (!categoryStyles || categoryStyles.length === 0) return null;
            return renderCategory(
              category,
              categoryStyles,
              catIndex === 0 ||
                !categoryOrder.slice(0, catIndex).some((c) => stylesByCategory[c]?.length),
              getCategoryStartIndex(category)
            );
          })}
          {/* Render any categories not in order */}
          {Object.entries(stylesByCategory)
            .filter(([category]) => !categoryOrder.includes(category))
            .map(([category, options], _extraIndex) => {
              const startIndex = flatStyleList.length - options.length;
              return renderCategory(category, options, false, startIndex);
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
 * Get default style options
 */
export function getDefaultStyles(): StyleOption[] {
  return [...DEFAULT_STYLES];
}

/**
 * Create style options from document styles
 */
export function createStyleOptions(
  styles: Style[],
  options?: {
    types?: StyleType[];
    quickFormatOnly?: boolean;
    includeHidden?: boolean;
  }
): StyleOption[] {
  const { types, quickFormatOnly = false, includeHidden = false } = options || {};

  let filtered = styles;

  if (types && types.length > 0) {
    filtered = filtered.filter((s) => types.includes(s.type));
  }

  if (!includeHidden) {
    filtered = filtered.filter((s) => !s.hidden && !s.semiHidden);
  }

  let result = filtered.map(styleToOption);

  if (quickFormatOnly) {
    result = result.filter((o) => o.qFormat);
  }

  // Sort by priority then name
  result.sort((a, b) => {
    const priorityDiff = (a.priority ?? 99) - (b.priority ?? 99);
    if (priorityDiff !== 0) return priorityDiff;
    return (a.name || '').localeCompare(b.name || '');
  });

  return result;
}

/**
 * Find style by ID
 */
export function findStyleById(styles: Style[], styleId: string): Style | undefined {
  return styles.find((s) => s.styleId === styleId);
}

/**
 * Find style by name
 */
export function findStyleByName(styles: Style[], name: string): Style | undefined {
  const nameLower = name.toLowerCase();
  return styles.find(
    (s) => s.name?.toLowerCase() === nameLower || s.styleId.toLowerCase() === nameLower
  );
}

/**
 * Get paragraph styles
 */
export function getParagraphStyles(styles: Style[]): Style[] {
  return styles.filter((s) => s.type === 'paragraph');
}

/**
 * Get character styles
 */
export function getCharacterStyles(styles: Style[]): Style[] {
  return styles.filter((s) => s.type === 'character');
}

/**
 * Get table styles
 */
export function getTableStyles(styles: Style[]): Style[] {
  return styles.filter((s) => s.type === 'table');
}

/**
 * Get quick format styles (shown in style gallery)
 */
export function getQuickFormatStyles(styles: Style[]): Style[] {
  return styles.filter((s) => s.qFormat);
}

/**
 * Get default paragraph style (usually "Normal")
 */
export function getDefaultParagraphStyle(styles: Style[]): Style | undefined {
  return (
    styles.find((s) => s.type === 'paragraph' && s.default) ||
    styles.find((s) => s.styleId === 'Normal' || s.name === 'Normal')
  );
}

/**
 * Check if style is a heading style
 */
export function isHeadingStyle(style: Style): boolean {
  const name = (style.name || style.styleId).toLowerCase();
  return name.startsWith('heading') || name === 'title' || name === 'subtitle';
}

/**
 * Get heading level from style (1-9, or 0 if not a heading)
 */
export function getHeadingLevel(style: Style): number {
  const name = (style.name || style.styleId).toLowerCase();
  if (name === 'title') return 0; // Title is above Heading 1
  if (name === 'subtitle') return 0;

  const match = name.match(/heading\s*(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 0;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default StylePicker;
