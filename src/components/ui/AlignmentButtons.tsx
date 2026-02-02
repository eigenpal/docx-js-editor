/**
 * Alignment Buttons Component
 *
 * A component for paragraph alignment controls in the DOCX editor:
 * - Left, Center, Right, Justify buttons
 * - Shows active state for current paragraph alignment
 * - Applies alignment to current paragraph(s)
 */

import React, { useState, useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { ParagraphAlignment } from '../../types/document';
import { MaterialSymbol } from './MaterialSymbol';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Alignment option for the buttons
 */
export interface AlignmentOption {
  /** Alignment value */
  value: ParagraphAlignment;
  /** Display label */
  label: string;
  /** Icon to display */
  icon: ReactNode;
  /** Keyboard shortcut hint */
  shortcut?: string;
}

/**
 * Props for the AlignmentButtons component
 */
export interface AlignmentButtonsProps {
  /** Current alignment value */
  value?: ParagraphAlignment;
  /** Callback when alignment is changed */
  onChange?: (alignment: ParagraphAlignment) => void;
  /** Whether the buttons are disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Show labels next to icons */
  showLabels?: boolean;
  /** Compact mode (smaller buttons) */
  compact?: boolean;
}

/**
 * Props for individual alignment button
 */
export interface AlignmentButtonProps {
  /** Whether the button is active/selected */
  active?: boolean;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Button title/tooltip */
  title?: string;
  /** Click handler */
  onClick?: () => void;
  /** Button content */
  children: ReactNode;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
}

// ============================================================================
// STYLES
// ============================================================================

const CONTAINER_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
};

const BUTTON_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: '4px',
  border: 'none',
  borderRadius: '4px',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  transition: 'background-color 0.1s',
  color: '#5f6368',
};

const BUTTON_HOVER_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  backgroundColor: 'rgba(0, 0, 0, 0.06)',
};

const BUTTON_ACTIVE_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  backgroundColor: '#e8f0fe',
  color: '#1967d2',
};

const BUTTON_DISABLED_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  cursor: 'default',
  opacity: 0.38,
};

const COMPACT_BUTTON_STYLE: CSSProperties = {
  width: '28px',
  height: '28px',
  padding: '2px',
};

// ============================================================================
// ICON SIZE CONSTANT
// ============================================================================

const ICON_SIZE = 20;

// ============================================================================
// ALIGNMENT OPTIONS
// ============================================================================

const ALIGNMENT_OPTIONS: AlignmentOption[] = [
  {
    value: 'left',
    label: 'Align Left',
    icon: <MaterialSymbol name="format_align_left" size={ICON_SIZE} />,
    shortcut: 'Ctrl+L',
  },
  {
    value: 'center',
    label: 'Center',
    icon: <MaterialSymbol name="format_align_center" size={ICON_SIZE} />,
    shortcut: 'Ctrl+E',
  },
  {
    value: 'right',
    label: 'Align Right',
    icon: <MaterialSymbol name="format_align_right" size={ICON_SIZE} />,
    shortcut: 'Ctrl+R',
  },
  {
    value: 'both',
    label: 'Justify',
    icon: <MaterialSymbol name="format_align_justify" size={ICON_SIZE} />,
    shortcut: 'Ctrl+J',
  },
];

// ============================================================================
// ALIGNMENT BUTTON COMPONENT
// ============================================================================

/**
 * Individual alignment button
 */
export function AlignmentButton({
  active = false,
  disabled = false,
  title,
  onClick,
  children,
  className,
  style,
}: AlignmentButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const buttonStyle: CSSProperties = {
    ...(disabled
      ? BUTTON_DISABLED_STYLE
      : active
        ? BUTTON_ACTIVE_STYLE
        : isHovered
          ? BUTTON_HOVER_STYLE
          : BUTTON_STYLE),
    ...style,
  };

  // Prevent mousedown from stealing focus/selection from the editor
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <button
      type="button"
      className={`docx-alignment-button ${active ? 'docx-alignment-button-active' : ''} ${
        disabled ? 'docx-alignment-button-disabled' : ''
      } ${className || ''}`}
      style={buttonStyle}
      onMouseDown={handleMouseDown}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      role="button"
    >
      {children}
    </button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Alignment buttons component for paragraph alignment controls
 */
export function AlignmentButtons({
  value = 'left',
  onChange,
  disabled = false,
  className,
  style,
  showLabels = false,
  compact = false,
}: AlignmentButtonsProps) {
  /**
   * Handle alignment change
   */
  const handleAlignmentChange = useCallback(
    (alignment: ParagraphAlignment) => {
      if (!disabled) {
        onChange?.(alignment);
      }
    },
    [disabled, onChange]
  );

  /**
   * Get button style with compact option
   */
  const getButtonStyle = useCallback(
    (): CSSProperties => (compact ? { ...COMPACT_BUTTON_STYLE } : {}),
    [compact]
  );

  return (
    <div
      className={`docx-alignment-buttons ${className || ''}`}
      style={{ ...CONTAINER_STYLE, ...style }}
      role="group"
      aria-label="Paragraph alignment"
    >
      {ALIGNMENT_OPTIONS.map((option) => (
        <AlignmentButton
          key={option.value}
          active={value === option.value}
          disabled={disabled}
          title={`${option.label}${option.shortcut ? ` (${option.shortcut})` : ''}`}
          onClick={() => handleAlignmentChange(option.value)}
          style={getButtonStyle()}
        >
          {option.icon}
          {showLabels && (
            <span style={{ marginLeft: '4px', fontSize: '12px' }}>{option.label}</span>
          )}
        </AlignmentButton>
      ))}
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get default alignment options
 */
export function getAlignmentOptions(): AlignmentOption[] {
  return [...ALIGNMENT_OPTIONS];
}

/**
 * Check if an alignment value is valid
 */
export function isValidAlignment(value: string): value is ParagraphAlignment {
  return ['left', 'center', 'right', 'both', 'distribute'].includes(value);
}

/**
 * Get alignment label from value
 */
export function getAlignmentLabel(value: ParagraphAlignment): string {
  const option = ALIGNMENT_OPTIONS.find((opt) => opt.value === value);
  return option?.label || 'Left';
}

/**
 * Get alignment icon from value
 */
export function getAlignmentIcon(value: ParagraphAlignment): ReactNode {
  const option = ALIGNMENT_OPTIONS.find((opt) => opt.value === value);
  return option?.icon || <MaterialSymbol name="format_align_left" size={ICON_SIZE} />;
}

/**
 * Get alignment shortcut from value
 */
export function getAlignmentShortcut(value: ParagraphAlignment): string | undefined {
  const option = ALIGNMENT_OPTIONS.find((opt) => opt.value === value);
  return option?.shortcut;
}

/**
 * Get CSS text-align value from OOXML alignment
 */
export function alignmentToCss(alignment: ParagraphAlignment): string {
  switch (alignment) {
    case 'left':
      return 'left';
    case 'center':
      return 'center';
    case 'right':
      return 'right';
    case 'both':
    case 'distribute':
      return 'justify';
    default:
      return 'left';
  }
}

/**
 * Get OOXML alignment value from CSS text-align
 */
export function cssToAlignment(textAlign: string): ParagraphAlignment {
  switch (textAlign) {
    case 'left':
    case 'start':
      return 'left';
    case 'center':
      return 'center';
    case 'right':
    case 'end':
      return 'right';
    case 'justify':
      return 'both';
    default:
      return 'left';
  }
}

/**
 * Cycle to next alignment (left -> center -> right -> justify -> left)
 */
export function cycleAlignment(current: ParagraphAlignment): ParagraphAlignment {
  const order: ParagraphAlignment[] = ['left', 'center', 'right', 'both'];
  const currentIndex = order.indexOf(current);
  const nextIndex = (currentIndex + 1) % order.length;
  return order[nextIndex];
}

/**
 * Handle keyboard shortcut for alignment
 * Returns the alignment if matched, undefined otherwise
 */
export function handleAlignmentShortcut(
  event: KeyboardEvent | React.KeyboardEvent
): ParagraphAlignment | undefined {
  if (!event.ctrlKey && !event.metaKey) {
    return undefined;
  }

  const key = event.key.toLowerCase();

  switch (key) {
    case 'l':
      return 'left';
    case 'e':
      return 'center';
    case 'r':
      return 'right';
    case 'j':
      return 'both';
    default:
      return undefined;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default AlignmentButtons;
