/**
 * Formatting Toolbar Component
 *
 * A toolbar with formatting controls for the DOCX editor:
 * - Font family picker
 * - Bold (Ctrl+B), Italic (Ctrl+I), Underline (Ctrl+U), Strikethrough
 * - Superscript, Subscript buttons
 * - Shows active state for current selection formatting
 * - Applies formatting to selection
 */

import React, { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { TextFormatting } from '../types/document';
import { FontPicker } from './ui/FontPicker';
import { FontSizePicker, halfPointsToPoints, pointsToHalfPoints } from './ui/FontSizePicker';
import { TextColorPicker, HighlightColorPicker } from './ui/ColorPicker';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Current formatting state of the selection
 */
export interface SelectionFormatting {
  /** Whether selected text is bold */
  bold?: boolean;
  /** Whether selected text is italic */
  italic?: boolean;
  /** Whether selected text is underlined */
  underline?: boolean;
  /** Whether selected text has strikethrough */
  strike?: boolean;
  /** Whether selected text is superscript */
  superscript?: boolean;
  /** Whether selected text is subscript */
  subscript?: boolean;
  /** Font family of selected text */
  fontFamily?: string;
  /** Font size of selected text (in half-points) */
  fontSize?: number;
  /** Text color */
  color?: string;
  /** Highlight color */
  highlight?: string;
}

/**
 * Formatting action types
 */
export type FormattingAction =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'superscript'
  | 'subscript'
  | 'clearFormatting'
  | { type: 'fontFamily'; value: string }
  | { type: 'fontSize'; value: number }
  | { type: 'textColor'; value: string }
  | { type: 'highlightColor'; value: string };

/**
 * Props for the Toolbar component
 */
export interface ToolbarProps {
  /** Current formatting of the selection */
  currentFormatting?: SelectionFormatting;
  /** Callback when a formatting action is triggered */
  onFormat?: (action: FormattingAction) => void;
  /** Callback for undo action */
  onUndo?: () => void;
  /** Callback for redo action */
  onRedo?: () => void;
  /** Whether undo is available */
  canUndo?: boolean;
  /** Whether redo is available */
  canRedo?: boolean;
  /** Whether the toolbar is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Whether to enable keyboard shortcuts (default: true) */
  enableShortcuts?: boolean;
  /** Ref to the editor container for keyboard events */
  editorRef?: React.RefObject<HTMLElement>;
  /** Custom toolbar items to render */
  children?: ReactNode;
  /** Whether to show font family picker (default: true) */
  showFontPicker?: boolean;
  /** Whether to show font size picker (default: true) */
  showFontSizePicker?: boolean;
  /** Whether to show text color picker (default: true) */
  showTextColorPicker?: boolean;
  /** Whether to show highlight color picker (default: true) */
  showHighlightColorPicker?: boolean;
}

/**
 * Props for individual toolbar buttons
 */
export interface ToolbarButtonProps {
  /** Whether the button is in active/pressed state */
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
  /** ARIA label for accessibility */
  ariaLabel?: string;
}

/**
 * Props for toolbar button groups
 */
export interface ToolbarGroupProps {
  /** Group label for accessibility */
  label?: string;
  /** Group content */
  children: ReactNode;
  /** Additional CSS class name */
  className?: string;
}

// ============================================================================
// STYLES
// ============================================================================

const TOOLBAR_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '8px 12px',
  backgroundColor: '#f8f9fa',
  borderBottom: '1px solid #e0e0e0',
  flexWrap: 'wrap',
  minHeight: '44px',
  boxSizing: 'border-box',
};

const TOOLBAR_GROUP_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  padding: '0 8px',
  borderRight: '1px solid #e0e0e0',
};

const TOOLBAR_BUTTON_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: '0',
  border: '1px solid transparent',
  borderRadius: '4px',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 'normal',
  color: '#333',
  transition: 'background-color 0.15s, border-color 0.15s',
};

const TOOLBAR_BUTTON_ACTIVE_STYLE: CSSProperties = {
  ...TOOLBAR_BUTTON_STYLE,
  backgroundColor: '#e3e8ed',
  borderColor: '#c0c8d0',
};

const TOOLBAR_BUTTON_DISABLED_STYLE: CSSProperties = {
  ...TOOLBAR_BUTTON_STYLE,
  opacity: 0.5,
  cursor: 'not-allowed',
};

const TOOLBAR_BUTTON_HOVER_STYLE: CSSProperties = {
  backgroundColor: '#e9ecef',
};

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

/**
 * Individual toolbar button
 */
export function ToolbarButton({
  active = false,
  disabled = false,
  title,
  onClick,
  children,
  className,
  ariaLabel,
}: ToolbarButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const buttonStyle: CSSProperties = disabled
    ? TOOLBAR_BUTTON_DISABLED_STYLE
    : active
    ? TOOLBAR_BUTTON_ACTIVE_STYLE
    : isHovered
    ? { ...TOOLBAR_BUTTON_STYLE, ...TOOLBAR_BUTTON_HOVER_STYLE }
    : TOOLBAR_BUTTON_STYLE;

  return (
    <button
      type="button"
      className={`docx-toolbar-button ${active ? 'active' : ''} ${disabled ? 'disabled' : ''} ${className || ''}`}
      style={buttonStyle}
      title={title}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel || title}
    >
      {children}
    </button>
  );
}

/**
 * Toolbar button group with separator
 */
export function ToolbarGroup({ label, children, className }: ToolbarGroupProps) {
  return (
    <div
      className={`docx-toolbar-group ${className || ''}`}
      style={TOOLBAR_GROUP_STYLE}
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  );
}

/**
 * Toolbar separator
 */
export function ToolbarSeparator() {
  return (
    <div
      className="docx-toolbar-separator"
      style={{
        width: '1px',
        height: '24px',
        backgroundColor: '#e0e0e0',
        margin: '0 4px',
      }}
      role="separator"
    />
  );
}

// ============================================================================
// ICONS (Simple SVG icons)
// ============================================================================

const BoldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 2h4.5a3 3 0 0 1 2.17 5.04A3.5 3.5 0 0 1 8.5 14H4V2zm2 5h2.5a1 1 0 0 0 0-2H6v2zm0 2v3h2.5a1.5 1.5 0 0 0 0-3H6z" />
  </svg>
);

const ItalicIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M6 2h6v2h-2l-3 8h2v2H3v-2h2l3-8H6V2z" />
  </svg>
);

const UnderlineIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 2v6a4 4 0 0 0 8 0V2h-2v6a2 2 0 0 1-4 0V2H4zm-1 12h10v-2H3v2z" />
  </svg>
);

const StrikethroughIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 7h12v2H2V7z" />
    <path d="M8 3c-2.2 0-3.5 1.2-3.5 2.5 0 .4.1.8.3 1.1h2.1c-.2-.2-.4-.5-.4-.9 0-.6.6-1.2 1.5-1.2.9 0 1.5.5 1.5 1.2 0 .4-.2.8-.5 1h2.1c.3-.4.4-.8.4-1.2C11.5 4.1 10.2 3 8 3zm0 10c2.2 0 3.5-1.2 3.5-2.5 0-.4-.1-.8-.3-1.1H9.1c.2.2.4.5.4.9 0 .6-.6 1.2-1.5 1.2-.9 0-1.5-.5-1.5-1.2 0-.4.2-.8.5-1H4.9c-.3.4-.4.8-.4 1.2C4.5 11.9 5.8 13 8 13z" />
  </svg>
);

const SuperscriptIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2.5 14L6 8.5 2.5 3h2.7l2.3 3.5L9.8 3h2.7L9 8.5l3.5 5.5h-2.7L7.5 10.5 5.2 14H2.5z" />
    <path d="M12 2h2v1h-2v1h3V1h-3V0h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-3V2z" transform="scale(0.8) translate(4, 0)" />
  </svg>
);

const SubscriptIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2.5 12L6 6.5 2.5 1h2.7l2.3 3.5L9.8 1h2.7L9 6.5l3.5 5.5h-2.7L7.5 8.5 5.2 12H2.5z" />
    <path d="M12 11h2v1h-2v1h3v-3h-3v-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-3v-2z" transform="scale(0.8) translate(4, 4)" />
  </svg>
);

const UndoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 1 0-.908-.418A6 6 0 1 0 8 2v1z" />
    <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L4.23 3.308a.25.25 0 0 0 0 .384l3.36 2.966A.25.25 0 0 0 8 6.466V4.466z" />
  </svg>
);

const RedoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 1 1 .908-.418A6 6 0 1 1 8 2v1z" />
    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l3.36 2.966a.25.25 0 0 1 0 .384l-3.36 2.966A.25.25 0 0 1 8 6.466V4.466z" />
  </svg>
);

const ClearFormattingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.5 3l2.5 4-2.5 4h2l1.5-2.5 1.5 2.5h2l-2.5-4 2.5-4h-2L7 5.5 5.5 3h-2z" />
    <path d="M12 11l2 2m0-2l-2 2" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Formatting toolbar with all controls
 */
export function Toolbar({
  currentFormatting = {},
  onFormat,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  disabled = false,
  className,
  style,
  enableShortcuts = true,
  editorRef,
  children,
  showFontPicker = true,
  showFontSizePicker = true,
  showTextColorPicker = true,
  showHighlightColorPicker = true,
}: ToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  /**
   * Handle formatting action
   */
  const handleFormat = useCallback(
    (action: FormattingAction) => {
      if (!disabled && onFormat) {
        onFormat(action);
      }
    },
    [disabled, onFormat]
  );

  /**
   * Handle undo
   */
  const handleUndo = useCallback(() => {
    if (!disabled && canUndo && onUndo) {
      onUndo();
    }
  }, [disabled, canUndo, onUndo]);

  /**
   * Handle redo
   */
  const handleRedo = useCallback(() => {
    if (!disabled && canRedo && onRedo) {
      onRedo();
    }
  }, [disabled, canRedo, onRedo]);

  /**
   * Handle font family change
   */
  const handleFontFamilyChange = useCallback(
    (fontFamily: string) => {
      if (!disabled && onFormat) {
        onFormat({ type: 'fontFamily', value: fontFamily });
      }
    },
    [disabled, onFormat]
  );

  /**
   * Handle font size change
   */
  const handleFontSizeChange = useCallback(
    (sizeInPoints: number) => {
      if (!disabled && onFormat) {
        onFormat({ type: 'fontSize', value: sizeInPoints });
      }
    },
    [disabled, onFormat]
  );

  /**
   * Handle text color change
   */
  const handleTextColorChange = useCallback(
    (color: string) => {
      if (!disabled && onFormat) {
        onFormat({ type: 'textColor', value: color });
      }
    },
    [disabled, onFormat]
  );

  /**
   * Handle highlight color change
   */
  const handleHighlightColorChange = useCallback(
    (color: string) => {
      if (!disabled && onFormat) {
        onFormat({ type: 'highlightColor', value: color });
      }
    },
    [disabled, onFormat]
  );

  /**
   * Keyboard shortcuts handler
   */
  useEffect(() => {
    if (!enableShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only process if editor has focus or toolbar has focus
      const target = event.target as HTMLElement;
      const editorContainer = editorRef?.current;
      const toolbarContainer = toolbarRef.current;

      const isInEditor = editorContainer?.contains(target);
      const isInToolbar = toolbarContainer?.contains(target);

      if (!isInEditor && !isInToolbar) return;

      const isCtrl = event.ctrlKey || event.metaKey;

      if (isCtrl && !event.altKey) {
        switch (event.key.toLowerCase()) {
          case 'b':
            event.preventDefault();
            handleFormat('bold');
            break;
          case 'i':
            event.preventDefault();
            handleFormat('italic');
            break;
          case 'u':
            event.preventDefault();
            handleFormat('underline');
            break;
          case '=':
            // Ctrl+= for subscript (common shortcut)
            if (event.shiftKey) {
              event.preventDefault();
              handleFormat('superscript');
            } else {
              event.preventDefault();
              handleFormat('subscript');
            }
            break;
          // Undo/Redo handled by useHistory hook
        }
      }
    };

    // Add listener to document
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enableShortcuts, handleFormat, editorRef]);

  return (
    <div
      ref={toolbarRef}
      className={`docx-toolbar ${className || ''}`}
      style={{ ...TOOLBAR_STYLE, ...style }}
      role="toolbar"
      aria-label="Formatting toolbar"
    >
      {/* Undo/Redo Group */}
      <ToolbarGroup label="History">
        <ToolbarButton
          onClick={handleUndo}
          disabled={disabled || !canUndo}
          title="Undo (Ctrl+Z)"
          ariaLabel="Undo"
        >
          <UndoIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleRedo}
          disabled={disabled || !canRedo}
          title="Redo (Ctrl+Y)"
          ariaLabel="Redo"
        >
          <RedoIcon />
        </ToolbarButton>
      </ToolbarGroup>

      {/* Font Family and Size Pickers */}
      {(showFontPicker || showFontSizePicker) && (
        <ToolbarGroup label="Font">
          {showFontPicker && (
            <FontPicker
              value={currentFormatting.fontFamily}
              onChange={handleFontFamilyChange}
              disabled={disabled}
              width={140}
              placeholder="Font"
            />
          )}
          {showFontSizePicker && (
            <FontSizePicker
              value={currentFormatting.fontSize !== undefined
                ? halfPointsToPoints(currentFormatting.fontSize)
                : undefined}
              onChange={handleFontSizeChange}
              disabled={disabled}
              width={70}
              placeholder="Size"
            />
          )}
        </ToolbarGroup>
      )}

      {/* Text Formatting Group */}
      <ToolbarGroup label="Text formatting">
        <ToolbarButton
          onClick={() => handleFormat('bold')}
          active={currentFormatting.bold}
          disabled={disabled}
          title="Bold (Ctrl+B)"
          ariaLabel="Bold"
        >
          <BoldIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => handleFormat('italic')}
          active={currentFormatting.italic}
          disabled={disabled}
          title="Italic (Ctrl+I)"
          ariaLabel="Italic"
        >
          <ItalicIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => handleFormat('underline')}
          active={currentFormatting.underline}
          disabled={disabled}
          title="Underline (Ctrl+U)"
          ariaLabel="Underline"
        >
          <UnderlineIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => handleFormat('strikethrough')}
          active={currentFormatting.strike}
          disabled={disabled}
          title="Strikethrough"
          ariaLabel="Strikethrough"
        >
          <StrikethroughIcon />
        </ToolbarButton>
        {showTextColorPicker && (
          <TextColorPicker
            value={currentFormatting.color?.replace(/^#/, '')}
            onChange={handleTextColorChange}
            disabled={disabled}
            title="Font Color"
          />
        )}
        {showHighlightColorPicker && (
          <HighlightColorPicker
            value={currentFormatting.highlight}
            onChange={handleHighlightColorChange}
            disabled={disabled}
            title="Text Highlight Color"
          />
        )}
      </ToolbarGroup>

      {/* Superscript/Subscript Group */}
      <ToolbarGroup label="Script">
        <ToolbarButton
          onClick={() => handleFormat('superscript')}
          active={currentFormatting.superscript}
          disabled={disabled}
          title="Superscript (Ctrl+Shift+=)"
          ariaLabel="Superscript"
        >
          <SuperscriptIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => handleFormat('subscript')}
          active={currentFormatting.subscript}
          disabled={disabled}
          title="Subscript (Ctrl+=)"
          ariaLabel="Subscript"
        >
          <SubscriptIcon />
        </ToolbarButton>
      </ToolbarGroup>

      {/* Clear Formatting */}
      <ToolbarButton
        onClick={() => handleFormat('clearFormatting')}
        disabled={disabled}
        title="Clear formatting"
        ariaLabel="Clear formatting"
      >
        <ClearFormattingIcon />
      </ToolbarButton>

      {/* Custom toolbar items */}
      {children}
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Map hex color to OOXML highlight color name
 * OOXML uses named colors for highlights (yellow, green, cyan, etc.)
 */
const HIGHLIGHT_HEX_TO_NAME: Record<string, string> = {
  'FFFF00': 'yellow',
  '00FF00': 'green',
  '00FFFF': 'cyan',
  'FF00FF': 'magenta',
  '0000FF': 'blue',
  'FF0000': 'red',
  '00008B': 'darkBlue',
  '008080': 'darkCyan',
  '008000': 'darkGreen',
  '800080': 'darkMagenta',
  '8B0000': 'darkRed',
  '808000': 'darkYellow',
  '808080': 'darkGray',
  'C0C0C0': 'lightGray',
  '000000': 'black',
  'FFFFFF': 'white',
};

function mapHexToHighlightName(hex: string): string | null {
  const normalized = hex.replace(/^#/, '').toUpperCase();
  return HIGHLIGHT_HEX_TO_NAME[normalized] || null;
}

/**
 * Extract formatting state from TextFormatting object
 */
export function getSelectionFormatting(formatting?: TextFormatting): SelectionFormatting {
  if (!formatting) {
    return {};
  }

  return {
    bold: formatting.bold,
    italic: formatting.italic,
    underline: formatting.underline?.style !== 'none' && formatting.underline?.style !== undefined,
    strike: formatting.strike,
    superscript: formatting.vertAlign === 'superscript',
    subscript: formatting.vertAlign === 'subscript',
    fontFamily: formatting.fontFamily?.ascii || formatting.fontFamily?.hAnsi,
    fontSize: formatting.fontSize,
    // Color would need theme resolution, simplified here
    color: formatting.color?.rgb ? `#${formatting.color.rgb}` : undefined,
    highlight: formatting.highlight !== 'none' ? formatting.highlight : undefined,
  };
}

/**
 * Apply a formatting action to existing formatting, returning new formatting
 */
export function applyFormattingAction(
  currentFormatting: TextFormatting,
  action: FormattingAction
): TextFormatting {
  const newFormatting = { ...currentFormatting };

  // Handle object-type actions (fontFamily, fontSize, textColor, etc.)
  if (typeof action === 'object') {
    switch (action.type) {
      case 'fontFamily':
        newFormatting.fontFamily = {
          ...currentFormatting.fontFamily,
          ascii: action.value,
          hAnsi: action.value,
        };
        return newFormatting;
      case 'fontSize':
        // Convert points to half-points for OOXML
        newFormatting.fontSize = pointsToHalfPoints(action.value);
        return newFormatting;
      case 'textColor':
        // Set text color as RGB value (without #)
        newFormatting.color = {
          rgb: action.value.replace(/^#/, '').toUpperCase(),
        };
        return newFormatting;
      case 'highlightColor':
        // Set highlight color - empty string means "no highlight"
        if (action.value === '' || action.value === 'none') {
          newFormatting.highlight = 'none';
        } else {
          // Highlight color is stored as a name in OOXML (yellow, green, etc.)
          // But we receive hex values from the picker, so map them
          newFormatting.highlight = mapHexToHighlightName(action.value) || 'yellow';
        }
        return newFormatting;
    }
  }

  // Handle string-type actions
  switch (action) {
    case 'bold':
      newFormatting.bold = !currentFormatting.bold;
      break;
    case 'italic':
      newFormatting.italic = !currentFormatting.italic;
      break;
    case 'underline':
      if (currentFormatting.underline?.style && currentFormatting.underline.style !== 'none') {
        newFormatting.underline = undefined;
      } else {
        newFormatting.underline = { style: 'single' };
      }
      break;
    case 'strikethrough':
      newFormatting.strike = !currentFormatting.strike;
      break;
    case 'superscript':
      newFormatting.vertAlign = currentFormatting.vertAlign === 'superscript' ? 'baseline' : 'superscript';
      break;
    case 'subscript':
      newFormatting.vertAlign = currentFormatting.vertAlign === 'subscript' ? 'baseline' : 'subscript';
      break;
    case 'clearFormatting':
      return {}; // Return empty formatting
  }

  return newFormatting;
}

/**
 * Check if formatting has any active styles
 */
export function hasActiveFormatting(formatting?: SelectionFormatting): boolean {
  if (!formatting) return false;
  return !!(
    formatting.bold ||
    formatting.italic ||
    formatting.underline ||
    formatting.strike ||
    formatting.superscript ||
    formatting.subscript
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Toolbar;
