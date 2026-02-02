/**
 * Style Picker Component (Radix UI)
 *
 * A dropdown selector for applying named paragraph styles using Radix Select.
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
// DEFAULT STYLES
// ============================================================================

const DEFAULT_STYLES: StyleOption[] = [
  {
    styleId: 'Normal',
    name: 'Normal',
    type: 'paragraph',
    isDefault: true,
    priority: 0,
    qFormat: true,
  },
  { styleId: 'Heading1', name: 'Heading 1', type: 'paragraph', priority: 9, qFormat: true },
  { styleId: 'Heading2', name: 'Heading 2', type: 'paragraph', priority: 10, qFormat: true },
  { styleId: 'Heading3', name: 'Heading 3', type: 'paragraph', priority: 11, qFormat: true },
  { styleId: 'Title', name: 'Title', type: 'paragraph', priority: 10, qFormat: true },
  { styleId: 'Subtitle', name: 'Subtitle', type: 'paragraph', priority: 11, qFormat: true },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function StylePicker({
  value,
  onChange,
  styles,
  disabled = false,
  className,
  placeholder = 'Normal',
  width = 120,
  quickFormatOnly = true,
}: StylePickerProps) {
  // Convert document styles to options
  const styleOptions = React.useMemo(() => {
    if (!styles || styles.length === 0) {
      return DEFAULT_STYLES;
    }

    return styles
      .filter((s) => s.type === 'paragraph')
      .filter((s) => !quickFormatOnly || s.qFormat)
      .map((s) => ({
        styleId: s.styleId,
        name: s.name || s.styleId,
        type: s.type,
        isDefault: s.default,
        qFormat: s.qFormat,
        priority: s.uiPriority ?? 99,
      }))
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
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
      <SelectContent>
        {styleOptions.map((style) => (
          <SelectItem key={style.styleId} value={style.styleId}>
            {style.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
