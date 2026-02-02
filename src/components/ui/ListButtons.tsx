/**
 * List Buttons Component
 *
 * A component for list formatting controls in the DOCX editor:
 * - Bullet list button
 * - Numbered list button
 * - Toggles list on/off for selection
 * - Indent/outdent for list levels
 */

import React, { useState, useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { NumberFormat } from '../../types/document';

// ============================================================================
// TYPES
// ============================================================================

/**
 * List type
 */
export type ListType = 'bullet' | 'numbered' | 'none';

/**
 * List state for the current selection
 */
export interface ListState {
  /** Type of list (bullet, numbered, or none) */
  type: ListType;
  /** Current list level (0-8) */
  level: number;
  /** Whether the selection is in a list */
  isInList: boolean;
  /** Numbering ID if in a list */
  numId?: number;
}

/**
 * Props for the ListButtons component
 */
export interface ListButtonsProps {
  /** Current list state of the selection */
  listState?: ListState;
  /** Callback when bullet list is toggled */
  onBulletList?: () => void;
  /** Callback when numbered list is toggled */
  onNumberedList?: () => void;
  /** Callback to increase list indent */
  onIndent?: () => void;
  /** Callback to decrease list indent */
  onOutdent?: () => void;
  /** Whether the buttons are disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Show indent/outdent buttons */
  showIndentButtons?: boolean;
  /** Compact mode (smaller buttons) */
  compact?: boolean;
}

/**
 * Props for individual list button
 */
export interface ListButtonProps {
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
  gap: '2px',
};

const BUTTON_GROUP_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2px',
  borderRadius: '4px',
  border: '1px solid #e0e0e0',
  padding: '2px',
  backgroundColor: '#fff',
};

const BUTTON_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  padding: '4px',
  border: 'none',
  borderRadius: '3px',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  transition: 'background-color 0.15s, color 0.15s',
  color: '#444',
};

const BUTTON_HOVER_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  backgroundColor: '#f0f0f0',
};

const BUTTON_ACTIVE_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  backgroundColor: '#e3f2fd',
  color: '#0066cc',
};

const BUTTON_DISABLED_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  cursor: 'not-allowed',
  opacity: 0.5,
};

const COMPACT_BUTTON_STYLE: CSSProperties = {
  width: '24px',
  height: '24px',
  padding: '2px',
};

const SEPARATOR_STYLE: CSSProperties = {
  width: '1px',
  height: '20px',
  backgroundColor: '#e0e0e0',
  margin: '0 4px',
};

// ============================================================================
// ICONS
// ============================================================================

const BulletListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="3" cy="4" r="1.5" />
    <rect x="6" y="3" width="8" height="2" />
    <circle cx="3" cy="8" r="1.5" />
    <rect x="6" y="7" width="8" height="2" />
    <circle cx="3" cy="12" r="1.5" />
    <rect x="6" y="11" width="8" height="2" />
  </svg>
);

const NumberedListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <text x="1" y="5" fontSize="5" fontFamily="sans-serif">
      1.
    </text>
    <rect x="6" y="3" width="8" height="2" />
    <text x="1" y="9" fontSize="5" fontFamily="sans-serif">
      2.
    </text>
    <rect x="6" y="7" width="8" height="2" />
    <text x="1" y="13" fontSize="5" fontFamily="sans-serif">
      3.
    </text>
    <rect x="6" y="11" width="8" height="2" />
  </svg>
);

const IndentIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="4" y="3" width="10" height="2" />
    <rect x="6" y="7" width="8" height="2" />
    <rect x="4" y="11" width="10" height="2" />
    <path d="M2 5L2 11L5 8L2 5Z" />
  </svg>
);

const OutdentIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="4" y="3" width="10" height="2" />
    <rect x="2" y="7" width="12" height="2" />
    <rect x="4" y="11" width="10" height="2" />
    <path d="M5 5L5 11L2 8L5 5Z" />
  </svg>
);

// ============================================================================
// LIST BUTTON COMPONENT
// ============================================================================

/**
 * Individual list button
 */
export function ListButton({
  active = false,
  disabled = false,
  title,
  onClick,
  children,
  className,
  style,
}: ListButtonProps) {
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

  return (
    <button
      type="button"
      className={`docx-list-button ${active ? 'docx-list-button-active' : ''} ${
        disabled ? 'docx-list-button-disabled' : ''
      } ${className || ''}`}
      style={buttonStyle}
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
 * List buttons component for bullet/numbered list controls
 */
export function ListButtons({
  listState,
  onBulletList,
  onNumberedList,
  onIndent,
  onOutdent,
  disabled = false,
  className,
  style,
  showIndentButtons = true,
  compact = false,
}: ListButtonsProps) {
  /**
   * Get button style with compact option
   */
  const getButtonStyle = useCallback(
    (): CSSProperties => (compact ? { ...COMPACT_BUTTON_STYLE } : {}),
    [compact]
  );

  const isBulletList = listState?.type === 'bullet';
  const isNumberedList = listState?.type === 'numbered';
  const isInList = listState?.isInList || isBulletList || isNumberedList;
  const canOutdent = isInList && (listState?.level ?? 0) > 0;

  return (
    <div
      className={`docx-list-buttons ${className || ''}`}
      style={{ ...CONTAINER_STYLE, ...style }}
      role="group"
      aria-label="List formatting"
    >
      {/* List type buttons */}
      <div style={BUTTON_GROUP_STYLE} role="group" aria-label="List type">
        <ListButton
          active={isBulletList}
          disabled={disabled}
          title="Bullet List"
          onClick={onBulletList}
          style={getButtonStyle()}
        >
          <BulletListIcon />
        </ListButton>

        <ListButton
          active={isNumberedList}
          disabled={disabled}
          title="Numbered List"
          onClick={onNumberedList}
          style={getButtonStyle()}
        >
          <NumberedListIcon />
        </ListButton>
      </div>

      {/* Indent/Outdent buttons */}
      {showIndentButtons && (
        <>
          <div style={SEPARATOR_STYLE} role="separator" />
          <div style={BUTTON_GROUP_STYLE} role="group" aria-label="List indentation">
            <ListButton
              active={false}
              disabled={disabled || !canOutdent}
              title="Decrease Indent"
              onClick={onOutdent}
              style={getButtonStyle()}
            >
              <OutdentIcon />
            </ListButton>

            <ListButton
              active={false}
              disabled={disabled}
              title="Increase Indent"
              onClick={onIndent}
              style={getButtonStyle()}
            >
              <IndentIcon />
            </ListButton>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a default list state (not in a list)
 */
export function createDefaultListState(): ListState {
  return {
    type: 'none',
    level: 0,
    isInList: false,
  };
}

/**
 * Create a bullet list state
 */
export function createBulletListState(level: number = 0, numId?: number): ListState {
  return {
    type: 'bullet',
    level,
    isInList: true,
    numId,
  };
}

/**
 * Create a numbered list state
 */
export function createNumberedListState(level: number = 0, numId?: number): ListState {
  return {
    type: 'numbered',
    level,
    isInList: true,
    numId,
  };
}

/**
 * Check if a list state represents a bullet list
 */
export function isBulletListState(state: ListState | undefined): boolean {
  return state?.type === 'bullet';
}

/**
 * Check if a list state represents a numbered list
 */
export function isNumberedListState(state: ListState | undefined): boolean {
  return state?.type === 'numbered';
}

/**
 * Check if a list state represents any list
 */
export function isAnyListState(state: ListState | undefined): boolean {
  return state?.isInList === true;
}

/**
 * Get the next indent level (max 8)
 */
export function getNextIndentLevel(currentLevel: number): number {
  return Math.min(currentLevel + 1, 8);
}

/**
 * Get the previous indent level (min 0)
 */
export function getPreviousIndentLevel(currentLevel: number): number {
  return Math.max(currentLevel - 1, 0);
}

/**
 * Toggle between list types
 */
export function toggleListType(state: ListState | undefined, targetType: ListType): ListState {
  // If already that type, remove list
  if (state?.type === targetType) {
    return createDefaultListState();
  }

  // Otherwise, set to the target type (preserving level if coming from another list)
  const level = state?.isInList ? state.level : 0;

  if (targetType === 'bullet') {
    return createBulletListState(level);
  } else if (targetType === 'numbered') {
    return createNumberedListState(level);
  } else {
    return createDefaultListState();
  }
}

/**
 * Get CSS for list indent
 */
export function getListIndentCss(level: number): CSSProperties {
  const baseIndent = 36; // ~0.5 inch per level
  return {
    marginLeft: `${baseIndent * (level + 1)}px`,
    textIndent: `-${baseIndent * 0.5}px`,
  };
}

/**
 * Get default bullet character for a level
 */
export function getDefaultBulletForLevel(level: number): string {
  const bullets = ['•', '○', '▪', '•', '○', '▪', '•', '○', '▪'];
  return bullets[level % bullets.length];
}

/**
 * Get default number format for a level
 */
export function getDefaultNumberFormatForLevel(level: number): NumberFormat {
  const formats: NumberFormat[] = [
    'decimal',
    'lowerLetter',
    'lowerRoman',
    'decimal',
    'lowerLetter',
    'lowerRoman',
    'decimal',
    'lowerLetter',
    'lowerRoman',
  ];
  return formats[level % formats.length];
}

/**
 * Handle keyboard shortcut for list operations
 * Returns the action to perform, or undefined if no match
 */
export function handleListShortcut(
  event: KeyboardEvent | React.KeyboardEvent
): 'bullet' | 'numbered' | 'indent' | 'outdent' | undefined {
  // Tab for indent, Shift+Tab for outdent
  if (event.key === 'Tab') {
    if (event.shiftKey) {
      return 'outdent';
    }
    return 'indent';
  }

  // Check for Ctrl/Cmd shortcuts (not commonly used for lists, but some editors support them)
  if (event.ctrlKey || event.metaKey) {
    if (event.shiftKey && event.key.toLowerCase() === 'l') {
      return 'bullet';
    }
    // Note: Ctrl+Shift+L is often bullet in Word-like editors
  }

  return undefined;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ListButtons;

// Also export individual icons for use elsewhere
export { BulletListIcon, NumberedListIcon, IndentIcon, OutdentIcon };
