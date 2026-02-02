/**
 * TableBorderPicker Component
 *
 * UI for changing table/cell border styling:
 * - Border style (none, single, double, dashed, dotted, etc.)
 * - Border color
 * - Border width
 * - Which borders to apply (all, top, bottom, left, right, inside, outside)
 */

import React, { useState, useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { BorderSpec } from '../../types/document';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Border style options (OOXML border styles)
 */
export type BorderStyleType =
  | 'none'
  | 'single'
  | 'double'
  | 'dotted'
  | 'dashed'
  | 'dashSmallGap'
  | 'dotDash'
  | 'dotDotDash'
  | 'triple'
  | 'thick'
  | 'thickThinSmallGap'
  | 'thinThickSmallGap';

/**
 * Border position options
 */
export type BorderPosition =
  | 'all'
  | 'outside'
  | 'inside'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'insideHorizontal'
  | 'insideVertical'
  | 'none';

/**
 * Border configuration
 */
export interface BorderConfig {
  style: BorderStyleType;
  color: string;
  width: number; // in eighths of a point
}

/**
 * Props for TableBorderPicker
 */
export interface TableBorderPickerProps {
  /** Current border configuration */
  currentBorder?: BorderConfig;
  /** Callback when border is applied */
  onApply?: (position: BorderPosition, config: BorderConfig) => void;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Compact mode */
  compact?: boolean;
}

// ============================================================================
// STYLES
// ============================================================================

const STYLES: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '8px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
    minWidth: '200px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  label: {
    fontSize: '12px',
    color: '#666',
    minWidth: '50px',
  },
  select: {
    flex: 1,
    padding: '4px 8px',
    border: '1px solid #d0d0d0',
    borderRadius: '3px',
    fontSize: '12px',
    backgroundColor: '#fff',
    cursor: 'pointer',
  },
  colorInput: {
    width: '32px',
    height: '24px',
    padding: '0',
    border: '1px solid #d0d0d0',
    borderRadius: '3px',
    cursor: 'pointer',
  },
  widthInput: {
    width: '50px',
    padding: '4px 8px',
    border: '1px solid #d0d0d0',
    borderRadius: '3px',
    fontSize: '12px',
    textAlign: 'right' as const,
  },
  positionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '4px',
  },
  positionButton: {
    padding: '4px',
    border: '1px solid #d0d0d0',
    borderRadius: '3px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '10px',
    transition: 'all 0.15s',
  },
  positionButtonActive: {
    backgroundColor: '#1a73e8',
    borderColor: '#1a73e8',
    color: '#fff',
  },
  applyButton: {
    padding: '6px 12px',
    border: 'none',
    borderRadius: '3px',
    backgroundColor: '#1a73e8',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'background-color 0.15s',
  },
  preview: {
    width: '60px',
    height: '40px',
    border: '1px solid #d0d0d0',
    borderRadius: '3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInner: {
    width: '40px',
    height: '24px',
    borderRadius: '2px',
  },
};

// ============================================================================
// ICONS
// ============================================================================

/**
 * Border All Icon
 */
function BorderAllIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="1"
        y="1"
        width="14"
        height="14"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" strokeWidth="1" />
      <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/**
 * Border Outside Icon
 */
function BorderOutsideIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}

/**
 * Border Inside Icon
 */
function BorderInsideIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="14" height="14" stroke="#ccc" strokeWidth="1" fill="none" />
      <line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5" />
      <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Border None Icon
 */
function BorderNoneIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="1"
        y="1"
        width="14"
        height="14"
        stroke="#ccc"
        strokeWidth="1"
        strokeDasharray="2 2"
        fill="none"
      />
    </svg>
  );
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Available border styles
 */
export const BORDER_STYLES: { value: BorderStyleType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'thick', label: 'Thick' },
  { value: 'triple', label: 'Triple' },
];

/**
 * Available border widths (in eighths of a point)
 */
export const BORDER_WIDTHS: { value: number; label: string }[] = [
  { value: 4, label: '½ pt' },
  { value: 8, label: '1 pt' },
  { value: 12, label: '1½ pt' },
  { value: 16, label: '2 pt' },
  { value: 24, label: '3 pt' },
  { value: 36, label: '4½ pt' },
  { value: 48, label: '6 pt' },
];

/**
 * Border position options
 */
export const BORDER_POSITIONS: { value: BorderPosition; label: string; icon: ReactNode }[] = [
  { value: 'all', label: 'All', icon: <BorderAllIcon /> },
  { value: 'outside', label: 'Outside', icon: <BorderOutsideIcon /> },
  { value: 'inside', label: 'Inside', icon: <BorderInsideIcon /> },
  { value: 'none', label: 'None', icon: <BorderNoneIcon /> },
];

/**
 * Default border configuration
 */
export const DEFAULT_BORDER_CONFIG: BorderConfig = {
  style: 'single',
  color: '#000000',
  width: 8, // 1 pt
};

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * TableBorderPicker - UI for styling table/cell borders
 */
export function TableBorderPicker({
  currentBorder = DEFAULT_BORDER_CONFIG,
  onApply,
  disabled = false,
  className,
  style: additionalStyle,
  compact = false,
}: TableBorderPickerProps): React.ReactElement {
  const [borderConfig, setBorderConfig] = useState<BorderConfig>(currentBorder);
  const [selectedPosition, setSelectedPosition] = useState<BorderPosition>('all');

  // Handle style change
  const handleStyleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setBorderConfig((prev) => ({ ...prev, style: e.target.value as BorderStyleType }));
  }, []);

  // Handle color change
  const handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBorderConfig((prev) => ({ ...prev, color: e.target.value }));
  }, []);

  // Handle width change
  const handleWidthChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setBorderConfig((prev) => ({ ...prev, width: parseInt(e.target.value, 10) }));
  }, []);

  // Handle position selection
  const handlePositionClick = useCallback((position: BorderPosition) => {
    setSelectedPosition(position);
  }, []);

  // Handle apply
  const handleApply = useCallback(() => {
    onApply?.(selectedPosition, borderConfig);
  }, [onApply, selectedPosition, borderConfig]);

  // Generate preview style
  const previewStyle: CSSProperties = {
    ...STYLES.previewInner,
    border:
      borderConfig.style === 'none'
        ? '1px dashed #ccc'
        : `${borderConfig.width / 8}pt ${mapStyleToCss(borderConfig.style)} ${borderConfig.color}`,
  };

  const containerStyle: CSSProperties = {
    ...STYLES.container,
    ...additionalStyle,
  };

  const classNames = ['docx-table-border-picker'];
  if (className) classNames.push(className);
  if (compact) classNames.push('docx-table-border-picker-compact');

  return (
    <div className={classNames.join(' ')} style={containerStyle}>
      {/* Border Style */}
      <div style={STYLES.row}>
        <span style={STYLES.label}>Style:</span>
        <select
          value={borderConfig.style}
          onChange={handleStyleChange}
          disabled={disabled}
          style={STYLES.select}
        >
          {BORDER_STYLES.map((style) => (
            <option key={style.value} value={style.value}>
              {style.label}
            </option>
          ))}
        </select>
      </div>

      {/* Border Color */}
      <div style={STYLES.row}>
        <span style={STYLES.label}>Color:</span>
        <input
          type="color"
          value={borderConfig.color}
          onChange={handleColorChange}
          disabled={disabled}
          style={STYLES.colorInput}
        />
        <span style={{ fontSize: '11px', color: '#666' }}>{borderConfig.color}</span>
      </div>

      {/* Border Width */}
      <div style={STYLES.row}>
        <span style={STYLES.label}>Width:</span>
        <select
          value={borderConfig.width}
          onChange={handleWidthChange}
          disabled={disabled}
          style={STYLES.select}
        >
          {BORDER_WIDTHS.map((width) => (
            <option key={width.value} value={width.value}>
              {width.label}
            </option>
          ))}
        </select>
      </div>

      {/* Border Position */}
      <div style={STYLES.row}>
        <span style={STYLES.label}>Apply to:</span>
        <div style={STYLES.positionGrid}>
          {BORDER_POSITIONS.map((pos) => (
            <button
              key={pos.value}
              type="button"
              onClick={() => handlePositionClick(pos.value)}
              disabled={disabled}
              style={{
                ...STYLES.positionButton,
                ...(selectedPosition === pos.value ? STYLES.positionButtonActive : {}),
              }}
              title={pos.label}
              aria-label={pos.label}
              aria-pressed={selectedPosition === pos.value}
            >
              {pos.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Preview and Apply */}
      <div style={{ ...STYLES.row, justifyContent: 'space-between', marginTop: '4px' }}>
        <div style={STYLES.preview}>
          <div style={previewStyle} />
        </div>
        <button
          type="button"
          onClick={handleApply}
          disabled={disabled}
          style={{
            ...STYLES.applyButton,
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          Apply Border
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Map OOXML border style to CSS border-style
 */
export function mapStyleToCss(style: BorderStyleType): string {
  const mapping: Record<BorderStyleType, string> = {
    none: 'none',
    single: 'solid',
    double: 'double',
    dotted: 'dotted',
    dashed: 'dashed',
    dashSmallGap: 'dashed',
    dotDash: 'dashed',
    dotDotDash: 'dashed',
    triple: 'double',
    thick: 'solid',
    thickThinSmallGap: 'double',
    thinThickSmallGap: 'double',
  };
  return mapping[style] || 'solid';
}

/**
 * Create BorderSpec from BorderConfig
 */
export function createBorderSpec(config: BorderConfig): BorderSpec {
  return {
    style: config.style as BorderSpec['style'],
    color: { rgb: config.color.replace('#', '') },
    size: config.width,
    space: 0,
  };
}

/**
 * Create BorderConfig from BorderSpec
 */
export function createBorderConfig(spec: BorderSpec | undefined): BorderConfig {
  if (!spec || spec.style === 'none' || spec.style === 'nil') {
    return { ...DEFAULT_BORDER_CONFIG, style: 'none' };
  }
  return {
    style: (spec.style as BorderStyleType) || 'single',
    color: spec.color?.rgb ? `#${spec.color.rgb}` : '#000000',
    width: spec.size ?? 8,
  };
}

/**
 * Get border position label
 */
export function getBorderPositionLabel(position: BorderPosition): string {
  const labels: Record<BorderPosition, string> = {
    all: 'All Borders',
    outside: 'Outside Borders',
    inside: 'Inside Borders',
    top: 'Top Border',
    bottom: 'Bottom Border',
    left: 'Left Border',
    right: 'Right Border',
    insideHorizontal: 'Inside Horizontal',
    insideVertical: 'Inside Vertical',
    none: 'No Borders',
  };
  return labels[position];
}

/**
 * Get available border styles
 */
export function getAvailableBorderStyles(): typeof BORDER_STYLES {
  return BORDER_STYLES;
}

/**
 * Get available border widths
 */
export function getAvailableBorderWidths(): typeof BORDER_WIDTHS {
  return BORDER_WIDTHS;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default TableBorderPicker;
