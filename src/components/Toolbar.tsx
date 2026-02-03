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
import type { TextFormatting, ParagraphAlignment, Style, Theme } from '../types/document';
import { FontPicker } from './ui/FontPicker';
import { FontSizePicker, halfPointsToPoints, pointsToHalfPoints } from './ui/FontSizePicker';
import { TextColorPicker, HighlightColorPicker } from './ui/ColorPicker';
import { AlignmentButtons } from './ui/AlignmentButtons';
import { ListButtons, type ListState, createDefaultListState } from './ui/ListButtons';
import { LineSpacingPicker } from './ui/LineSpacingPicker';
import { StylePicker } from './ui/StylePicker';
import { MaterialSymbol } from './ui/MaterialSymbol';
import { ZoomControl } from './ui/ZoomControl';
import { Button } from './ui/Button';
import { Tooltip } from './ui/Tooltip';
import { cn } from '../lib/utils';

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
  /** Paragraph alignment */
  alignment?: ParagraphAlignment;
  /** List state of the current paragraph */
  listState?: ListState;
  /** Line spacing in twips (OOXML value, 240 = single spacing) */
  lineSpacing?: number;
  /** Paragraph style ID */
  styleId?: string;
  /** Paragraph left indentation in twips */
  indentLeft?: number;
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
  | 'bulletList'
  | 'numberedList'
  | 'indent'
  | 'outdent'
  | { type: 'fontFamily'; value: string }
  | { type: 'fontSize'; value: number }
  | { type: 'textColor'; value: string }
  | { type: 'highlightColor'; value: string }
  | { type: 'alignment'; value: ParagraphAlignment }
  | { type: 'lineSpacing'; value: number }
  | { type: 'applyStyle'; value: string };

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
  /** Whether to show alignment buttons (default: true) */
  showAlignmentButtons?: boolean;
  /** Whether to show list buttons (default: true) */
  showListButtons?: boolean;
  /** Whether to show line spacing picker (default: true) */
  showLineSpacingPicker?: boolean;
  /** Whether to show style picker (default: true) */
  showStylePicker?: boolean;
  /** Document styles for the style picker */
  documentStyles?: Style[];
  /** Theme for the style picker */
  theme?: Theme | null;
  /** Callback for print action */
  onPrint?: () => void;
  /** Whether to show print button (default: true) */
  showPrintButton?: boolean;
  /** Whether to show zoom control (default: true) */
  showZoomControl?: boolean;
  /** Current zoom level (1.0 = 100%) */
  zoom?: number;
  /** Callback when zoom changes */
  onZoomChange?: (zoom: number) => void;
  /** Callback to refocus the editor after toolbar interactions */
  onRefocusEditor?: () => void;
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

// Toolbar uses Tailwind classes now - see the component JSX for styling

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

/**
 * Individual toolbar button with shadcn styling
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
  // Generate testid from ariaLabel or title
  const testId =
    ariaLabel?.toLowerCase().replace(/\s+/g, '-') ||
    title
      ?.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/\([^)]*\)/g, '')
      .trim();

  // Prevent mousedown from stealing focus from the editor selection
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const button = (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn(
        'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80',
        active && 'bg-slate-900 text-white hover:bg-slate-800 hover:text-white',
        disabled && 'opacity-30 cursor-not-allowed',
        className
      )}
      onMouseDown={handleMouseDown}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel || title}
      data-testid={testId ? `toolbar-${testId}` : undefined}
    >
      {children}
    </Button>
  );

  if (title) {
    return <Tooltip content={title}>{button}</Tooltip>;
  }

  return button;
}

/**
 * Toolbar button group with modern styling
 */
export function ToolbarGroup({ label, children, className }: ToolbarGroupProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-0.5 px-1 border-r border-slate-200/50 last:border-r-0',
        className
      )}
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
  return <div className="w-px h-6 bg-slate-200 mx-1.5" role="separator" />;
}

// ============================================================================
// ICON SIZE CONSTANT
// ============================================================================

const ICON_SIZE = 20;

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
  showAlignmentButtons = true,
  showListButtons = true,
  showLineSpacingPicker = true,
  showStylePicker = true,
  documentStyles,
  theme,
  onPrint,
  showPrintButton = true,
  showZoomControl = true,
  zoom,
  onZoomChange,
  onRefocusEditor,
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
   * Handle alignment change
   */
  const handleAlignmentChange = useCallback(
    (alignment: ParagraphAlignment) => {
      if (!disabled && onFormat) {
        onFormat({ type: 'alignment', value: alignment });
      }
    },
    [disabled, onFormat]
  );

  /**
   * Handle bullet list toggle
   */
  const handleBulletList = useCallback(() => {
    if (!disabled && onFormat) {
      onFormat('bulletList');
    }
  }, [disabled, onFormat]);

  /**
   * Handle numbered list toggle
   */
  const handleNumberedList = useCallback(() => {
    if (!disabled && onFormat) {
      onFormat('numberedList');
    }
  }, [disabled, onFormat]);

  /**
   * Handle indent (increase paragraph indent or list level)
   */
  const handleIndent = useCallback(() => {
    if (!disabled && onFormat) {
      onFormat('indent');
    }
  }, [disabled, onFormat]);

  /**
   * Handle outdent (decrease paragraph indent or list level)
   */
  const handleOutdent = useCallback(() => {
    if (!disabled && onFormat) {
      onFormat('outdent');
    }
  }, [disabled, onFormat]);

  /**
   * Handle line spacing change
   */
  const handleLineSpacingChange = useCallback(
    (twipsValue: number) => {
      if (!disabled && onFormat) {
        onFormat({ type: 'lineSpacing', value: twipsValue });
      }
    },
    [disabled, onFormat]
  );

  /**
   * Handle style change
   */
  const handleStyleChange = useCallback(
    (styleId: string) => {
      if (!disabled && onFormat) {
        onFormat({ type: 'applyStyle', value: styleId });
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
          // Alignment shortcuts
          case 'l':
            event.preventDefault();
            handleAlignmentChange('left');
            break;
          case 'e':
            event.preventDefault();
            handleAlignmentChange('center');
            break;
          case 'r':
            event.preventDefault();
            handleAlignmentChange('right');
            break;
          case 'j':
            event.preventDefault();
            handleAlignmentChange('both');
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

  // Prevent toolbar clicks from stealing focus and refocus editor
  const handleToolbarMouseDown = useCallback((e: React.MouseEvent) => {
    // Allow clicks on input elements to work normally
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

    if (!isInput) {
      // Prevent the mousedown from stealing focus
      e.preventDefault();
    }
  }, []);

  // Refocus editor after toolbar click (called on mouseup)
  const handleToolbarMouseUp = useCallback(() => {
    // Use requestAnimationFrame to ensure the click action completes first
    requestAnimationFrame(() => {
      onRefocusEditor?.();
    });
  }, [onRefocusEditor]);

  return (
    <div
      ref={toolbarRef}
      className={cn(
        'flex items-center gap-0 px-2 py-2 bg-white border-b border-slate-100 flex-wrap min-h-[44px]',
        className
      )}
      style={style}
      role="toolbar"
      aria-label="Formatting toolbar"
      data-testid="toolbar"
      onMouseDown={handleToolbarMouseDown}
      onMouseUp={handleToolbarMouseUp}
    >
      {/* Undo/Redo/Print Group */}
      <ToolbarGroup label="History">
        <ToolbarButton
          onClick={handleUndo}
          disabled={disabled || !canUndo}
          title="Undo (Ctrl+Z)"
          ariaLabel="Undo"
        >
          <MaterialSymbol name="undo" size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleRedo}
          disabled={disabled || !canRedo}
          title="Redo (Ctrl+Y)"
          ariaLabel="Redo"
        >
          <MaterialSymbol name="redo" size={ICON_SIZE} />
        </ToolbarButton>
        {showPrintButton && (
          <ToolbarButton
            onClick={onPrint}
            disabled={disabled || !onPrint}
            title="Print (Ctrl+P)"
            ariaLabel="Print"
          >
            <MaterialSymbol name="print" size={ICON_SIZE} />
          </ToolbarButton>
        )}
      </ToolbarGroup>

      {/* Zoom Control */}
      {showZoomControl && (
        <ToolbarGroup label="Zoom">
          <ZoomControl
            value={zoom}
            onChange={onZoomChange}
            minZoom={0.5}
            maxZoom={2}
            disabled={disabled}
            compact
            showButtons={false}
          />
        </ToolbarGroup>
      )}

      {/* Style Picker */}
      {showStylePicker && (
        <ToolbarGroup label="Styles">
          <StylePicker
            value={currentFormatting.styleId || 'Normal'}
            onChange={handleStyleChange}
            styles={documentStyles}
            theme={theme}
            disabled={disabled}
            width={90}
            placeholder="Normal"
            showPreview={true}
            quickFormatOnly={true}
          />
        </ToolbarGroup>
      )}

      {/* Font Family and Size Pickers */}
      {(showFontPicker || showFontSizePicker) && (
        <ToolbarGroup label="Font">
          {showFontPicker && (
            <FontPicker
              value={currentFormatting.fontFamily || 'Arial'}
              onChange={handleFontFamilyChange}
              disabled={disabled}
              width={85}
              placeholder="Arial"
            />
          )}
          {showFontSizePicker && (
            <FontSizePicker
              value={
                currentFormatting.fontSize !== undefined
                  ? halfPointsToPoints(currentFormatting.fontSize)
                  : 11
              }
              onChange={handleFontSizeChange}
              disabled={disabled}
              width={50}
              placeholder="11"
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
          <MaterialSymbol name="format_bold" size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => handleFormat('italic')}
          active={currentFormatting.italic}
          disabled={disabled}
          title="Italic (Ctrl+I)"
          ariaLabel="Italic"
        >
          <MaterialSymbol name="format_italic" size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => handleFormat('underline')}
          active={currentFormatting.underline}
          disabled={disabled}
          title="Underline (Ctrl+U)"
          ariaLabel="Underline"
        >
          <MaterialSymbol name="format_underlined" size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => handleFormat('strikethrough')}
          active={currentFormatting.strike}
          disabled={disabled}
          title="Strikethrough"
          ariaLabel="Strikethrough"
        >
          <MaterialSymbol name="strikethrough_s" size={ICON_SIZE} />
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
          <MaterialSymbol name="superscript" size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => handleFormat('subscript')}
          active={currentFormatting.subscript}
          disabled={disabled}
          title="Subscript (Ctrl+=)"
          ariaLabel="Subscript"
        >
          <MaterialSymbol name="subscript" size={ICON_SIZE} />
        </ToolbarButton>
      </ToolbarGroup>

      {/* Alignment Group */}
      {showAlignmentButtons && (
        <ToolbarGroup label="Paragraph alignment">
          <AlignmentButtons
            value={currentFormatting.alignment || 'left'}
            onChange={handleAlignmentChange}
            disabled={disabled}
            compact
          />
        </ToolbarGroup>
      )}

      {/* List Buttons and Line Spacing */}
      {(showListButtons || showLineSpacingPicker) && (
        <ToolbarGroup label="List formatting">
          {showListButtons && (
            <ListButtons
              listState={currentFormatting.listState || createDefaultListState()}
              onBulletList={handleBulletList}
              onNumberedList={handleNumberedList}
              onIndent={handleIndent}
              onOutdent={handleOutdent}
              disabled={disabled}
              showIndentButtons={true}
              compact
              hasIndent={(currentFormatting.indentLeft ?? 0) > 0}
            />
          )}
          {showLineSpacingPicker && (
            <LineSpacingPicker
              value={currentFormatting.lineSpacing}
              onChange={handleLineSpacingChange}
              disabled={disabled}
              width={80}
            />
          )}
        </ToolbarGroup>
      )}

      {/* Clear Formatting */}
      <ToolbarButton
        onClick={() => handleFormat('clearFormatting')}
        disabled={disabled}
        title="Clear formatting"
        ariaLabel="Clear formatting"
      >
        <MaterialSymbol name="format_clear" size={ICON_SIZE} />
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
  FFFF00: 'yellow',
  '00FF00': 'green',
  '00FFFF': 'cyan',
  FF00FF: 'magenta',
  '0000FF': 'blue',
  FF0000: 'red',
  '00008B': 'darkBlue',
  '008080': 'darkCyan',
  '008000': 'darkGreen',
  '800080': 'darkMagenta',
  '8B0000': 'darkRed',
  '808000': 'darkYellow',
  '808080': 'darkGray',
  C0C0C0: 'lightGray',
  '000000': 'black',
  FFFFFF: 'white',
};

function mapHexToHighlightName(hex: string): string | null {
  const normalized = hex.replace(/^#/, '').toUpperCase();
  return HIGHLIGHT_HEX_TO_NAME[normalized] || null;
}

/**
 * Extract formatting state from TextFormatting and ParagraphFormatting objects
 */
export function getSelectionFormatting(
  formatting?: Partial<TextFormatting>,
  paragraphFormatting?: Partial<import('../types/document').ParagraphFormatting>
): SelectionFormatting {
  const result: SelectionFormatting = {};

  if (formatting) {
    result.bold = formatting.bold;
    result.italic = formatting.italic;
    result.underline =
      formatting.underline?.style !== 'none' && formatting.underline?.style !== undefined;
    result.strike = formatting.strike;
    result.superscript = formatting.vertAlign === 'superscript';
    result.subscript = formatting.vertAlign === 'subscript';
    result.fontFamily = formatting.fontFamily?.ascii || formatting.fontFamily?.hAnsi;
    result.fontSize = formatting.fontSize;
    // Color would need theme resolution, simplified here
    result.color = formatting.color?.rgb ? `#${formatting.color.rgb}` : undefined;
    result.highlight = formatting.highlight !== 'none' ? formatting.highlight : undefined;
  }

  if (paragraphFormatting) {
    result.alignment = paragraphFormatting.alignment;

    // Extract line spacing
    if (paragraphFormatting.lineSpacing !== undefined) {
      result.lineSpacing = paragraphFormatting.lineSpacing;
    }

    // Extract paragraph style ID
    if (paragraphFormatting.styleId) {
      result.styleId = paragraphFormatting.styleId;
    }

    // Extract list state from numPr
    if (paragraphFormatting.numPr) {
      const { numId, ilvl } = paragraphFormatting.numPr;
      // We need to determine if it's bullet or numbered - for now we'll use a heuristic
      // numId 1 is typically bullet, numId 2 is typically numbered in Word defaults
      // This is a simplification - proper implementation would check the numbering definitions
      const isBullet = numId === 1;
      result.listState = {
        type: isBullet ? 'bullet' : 'numbered',
        level: ilvl ?? 0,
        isInList: true,
        numId,
      };
    } else {
      result.listState = createDefaultListState();
    }
  }

  return result;
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
          newFormatting.highlight = (mapHexToHighlightName(action.value) ||
            'yellow') as TextFormatting['highlight'];
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
      newFormatting.vertAlign =
        currentFormatting.vertAlign === 'superscript' ? 'baseline' : 'superscript';
      break;
    case 'subscript':
      newFormatting.vertAlign =
        currentFormatting.vertAlign === 'subscript' ? 'baseline' : 'subscript';
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
