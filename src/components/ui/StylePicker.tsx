/**
 * Style Picker Component (Radix UI)
 *
 * A dropdown selector for applying named paragraph styles using Radix Select.
 * Shows each style with its visual appearance (font size, bold, color).
 */

import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './Select';
import { cn } from '../../lib/utils';
import type { Style, StyleType, Theme } from '../../types/document';

// ============================================================================
// TYPES
// ============================================================================

export interface StyleOption {
  styleId: string;
  name: string;
  type: StyleType;
  isDefault?: boolean;
  qFormat?: boolean;
  priority?: number;
  /** Font size in half-points for visual preview */
  fontSize?: number;
  /** Bold styling */
  bold?: boolean;
  /** Italic styling */
  italic?: boolean;
  /** Text color (RGB hex) */
  color?: string;
}

export interface StylePickerProps {
  value?: string;
  onChange?: (styleId: string) => void;
  styles?: Style[];
  theme?: Theme | null;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  width?: number | string;
  showPreview?: boolean;
  styleTypes?: StyleType[];
  quickFormatOnly?: boolean;
}

// ============================================================================
// DEFAULT STYLES (matching Google Docs order and appearance)
// ============================================================================

const DEFAULT_STYLES: StyleOption[] = [
  {
    styleId: 'Normal',
    name: 'Normal text',
    type: 'paragraph',
    isDefault: true,
    priority: 0,
    qFormat: true,
    fontSize: 22, // 11pt
  },
  {
    styleId: 'Title',
    name: 'Title',
    type: 'paragraph',
    priority: 1,
    qFormat: true,
    fontSize: 52, // 26pt
    bold: true,
  },
  {
    styleId: 'Subtitle',
    name: 'Subtitle',
    type: 'paragraph',
    priority: 2,
    qFormat: true,
    fontSize: 30, // 15pt
    color: '666666', // Gray
  },
  {
    styleId: 'Heading1',
    name: 'Heading 1',
    type: 'paragraph',
    priority: 3,
    qFormat: true,
    fontSize: 40, // 20pt
    bold: true,
  },
  {
    styleId: 'Heading2',
    name: 'Heading 2',
    type: 'paragraph',
    priority: 4,
    qFormat: true,
    fontSize: 32, // 16pt
    bold: true,
  },
  {
    styleId: 'Heading3',
    name: 'Heading 3',
    type: 'paragraph',
    priority: 5,
    qFormat: true,
    fontSize: 28, // 14pt
    bold: true,
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Get inline styles for a style option's visual preview
 */
function getStylePreviewCSS(style: StyleOption): React.CSSProperties {
  const css: React.CSSProperties = {};

  // Font size - convert half-points to pixels (rough approximation for preview)
  // Scale down for dropdown display
  if (style.fontSize) {
    // Map style font sizes to reasonable dropdown preview sizes
    const ptSize = style.fontSize / 2;
    if (ptSize >= 20) {
      css.fontSize = '20px'; // Large (Title, Heading 1)
    } else if (ptSize >= 16) {
      css.fontSize = '16px'; // Medium (Heading 2)
    } else if (ptSize >= 14) {
      css.fontSize = '14px'; // Small-medium (Heading 3)
    } else {
      css.fontSize = '13px'; // Normal
    }
  }

  // Bold
  if (style.bold) {
    css.fontWeight = 'bold';
  }

  // Italic
  if (style.italic) {
    css.fontStyle = 'italic';
  }

  // Color
  if (style.color) {
    css.color = `#${style.color}`;
  }

  return css;
}

export function StylePicker({
  value,
  onChange,
  styles,
  disabled = false,
  className,
  placeholder = 'Normal text',
  width = 120,
  quickFormatOnly = true,
}: StylePickerProps) {
  // Convert document styles to options with visual info
  const styleOptions = React.useMemo(() => {
    if (!styles || styles.length === 0) {
      return DEFAULT_STYLES;
    }

    // Build options from document styles
    const docStyles = styles
      .filter((s) => s.type === 'paragraph')
      .filter((s) => !quickFormatOnly || s.qFormat)
      .map((s) => ({
        styleId: s.styleId,
        name: s.name || s.styleId,
        type: s.type,
        isDefault: s.default,
        qFormat: s.qFormat,
        priority: s.uiPriority ?? 99,
        // Extract visual properties from rPr
        fontSize: s.rPr?.fontSize,
        bold: s.rPr?.bold,
        italic: s.rPr?.italic,
        color: s.rPr?.color?.rgb,
      }));

    // Merge with defaults to ensure visual info is available
    const merged = docStyles.map((ds) => {
      const defaultStyle = DEFAULT_STYLES.find((d) => d.styleId === ds.styleId);
      return {
        ...defaultStyle,
        ...ds,
        // Use default visual props if not in document style
        fontSize: ds.fontSize ?? defaultStyle?.fontSize,
        bold: ds.bold ?? defaultStyle?.bold,
        italic: ds.italic ?? defaultStyle?.italic,
        color: ds.color ?? defaultStyle?.color,
      };
    });

    // Sort by priority
    return merged.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  }, [styles, quickFormatOnly]);

  // Find current style name for display
  const displayValue = React.useMemo(() => {
    if (!value) return placeholder;
    const style = styleOptions.find((s) => s.styleId === value);
    return style?.name || value;
  }, [value, styleOptions, placeholder]);

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      onChange?.(newValue);
    },
    [onChange]
  );

  return (
    <Select value={value || 'Normal'} onValueChange={handleValueChange} disabled={disabled}>
      <SelectTrigger
        className={cn('h-8 text-sm', className)}
        style={{ minWidth: typeof width === 'number' ? `${width}px` : width }}
        aria-label="Select paragraph style"
      >
        <SelectValue placeholder={placeholder}>{displayValue}</SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[200px]">
        {styleOptions.map((style) => (
          <SelectItem key={style.styleId} value={style.styleId} className="py-2">
            <span style={getStylePreviewCSS(style)}>{style.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
