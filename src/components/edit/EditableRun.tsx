/**
 * Editable Run Component
 *
 * An editable version of the Run component that allows text editing.
 * Uses contentEditable span and syncs changes to the document model.
 *
 * Features:
 * - contentEditable span for text input
 * - Syncs text changes via onChange callback
 * - Preserves formatting during edits
 * - Handles text-only content (tabs, breaks, images handled by parent)
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { CSSProperties, KeyboardEvent, FormEvent } from 'react';
import type { Run as RunType, RunContent, TextContent, TextFormatting, Theme } from '../../types/document';
import { textToStyle, mergeStyles } from '../../utils/formatToStyle';
import { SELECTION_DATA_ATTRIBUTES } from '../../hooks/useSelection';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for the EditableRun component
 */
export interface EditableRunProps {
  /** The run data to render */
  run: RunType;
  /** Index of this run in parent content array */
  runIndex: number;
  /** Index of the parent paragraph */
  paragraphIndex: number;
  /** Theme for resolving colors and fonts */
  theme?: Theme | null;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Whether editing is enabled */
  editable?: boolean;
  /** Callback when run content changes */
  onChange?: (newRun: RunType, runIndex: number) => void;
  /** Callback when a key is pressed (for handling special keys) */
  onKeyDown?: (event: KeyboardEvent<HTMLSpanElement>, runIndex: number) => void;
  /** Callback when the run receives focus */
  onFocus?: (runIndex: number) => void;
  /** Callback when the run loses focus */
  onBlur?: (runIndex: number) => void;
  /** Callback when cursor moves within run */
  onSelectionChange?: (offset: number, runIndex: number) => void;
}

/**
 * Result of text change event
 */
export interface TextChangeEvent {
  /** The new text content */
  newText: string;
  /** The updated run */
  newRun: RunType;
  /** Index of the run */
  runIndex: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if text contains template variables
 */
function containsTemplateVariable(text: string): boolean {
  return /\{\{[^}]+\}\}/.test(text);
}

/**
 * Style for template variables
 */
const TEMPLATE_VARIABLE_STYLE: CSSProperties = {
  backgroundColor: 'rgba(255, 223, 128, 0.5)',
  borderRadius: '2px',
  padding: '0 2px',
  fontFamily: 'monospace',
  color: '#8B4513',
};

/**
 * Base styles for contentEditable elements to ensure visible cursor/caret
 */
const EDITABLE_BASE_STYLE: CSSProperties = {
  // Ensure cursor is always visible - black for light backgrounds
  caretColor: '#000',
  // Remove default focus outline for clean WYSIWYG appearance
  outline: 'none',
  // Minimum height to ensure cursor visibility in empty runs
  minHeight: '1em',
};

/**
 * Get plain text from run content
 */
function getRunText(run: RunType): string {
  return run.content
    .map((content) => {
      switch (content.type) {
        case 'text':
          return content.text;
        case 'tab':
          return '\t';
        case 'break':
          return content.breakType === 'textWrapping' ? '\n' : '';
        case 'symbol':
          return String.fromCharCode(parseInt(content.char, 16));
        case 'softHyphen':
          return '\u00AD';
        case 'noBreakHyphen':
          return '\u2011';
        default:
          return '';
      }
    })
    .join('');
}

/**
 * Check if run has only text content (no images, shapes, complex fields)
 */
function hasOnlyTextContent(run: RunType): boolean {
  return run.content.every((content) => {
    return ['text', 'tab', 'break', 'symbol', 'softHyphen', 'noBreakHyphen'].includes(content.type);
  });
}

/**
 * Create a new run with updated text
 * Preserves formatting and replaces all text content with new text
 */
function createUpdatedRun(run: RunType, newText: string): RunType {
  // If original run had simple text content, create simple text content
  const textContentItems = run.content.filter((c): c is TextContent => c.type === 'text');

  // Create new content array
  const newContent: RunContent[] = [];

  // If new text is empty, return run with empty content
  if (newText.length === 0) {
    return {
      ...run,
      content: [],
    };
  }

  // If original had non-text elements at specific positions, try to preserve structure
  // For now, simplify to single text content
  newContent.push({
    type: 'text',
    text: newText,
    // Preserve space settings from original if present
    preserveSpace: textContentItems[0]?.preserveSpace,
  });

  return {
    ...run,
    content: newContent,
  };
}

/**
 * Normalize contentEditable HTML to plain text
 */
function normalizeHtmlToText(html: string): string {
  // Create a temporary element to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Get text content, preserving line breaks
  function extractText(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName.toLowerCase();

      // Handle line breaks
      if (tagName === 'br') {
        return '\n';
      }

      // Block elements add newlines
      if (['div', 'p'].includes(tagName)) {
        const children = Array.from(node.childNodes).map(extractText).join('');
        return children + (children.endsWith('\n') ? '' : '\n');
      }

      // Inline elements
      return Array.from(node.childNodes).map(extractText).join('');
    }
    return '';
  }

  let text = extractText(temp);

  // Remove trailing newline if present
  if (text.endsWith('\n')) {
    text = text.slice(0, -1);
  }

  return text;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * EditableRun component - an editable text run with formatting
 */
export function EditableRun({
  run,
  runIndex,
  paragraphIndex,
  theme,
  className,
  style: additionalStyle,
  editable = true,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  onSelectionChange,
}: EditableRunProps): React.ReactElement | null {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const lastTextRef = useRef<string>(getRunText(run));

  // Get CSS styles from formatting
  const formattingStyle = textToStyle(run.formatting, theme);

  // Merge with additional styles
  const combinedStyle = mergeStyles(formattingStyle, additionalStyle);

  // Update ref when run changes externally
  useEffect(() => {
    lastTextRef.current = getRunText(run);
  }, [run]);

  /**
   * Handle input events (text changes)
   */
  const handleInput = useCallback(
    (e: FormEvent<HTMLSpanElement>) => {
      if (isComposing) return;

      const element = e.currentTarget;
      const newText = element.textContent || '';

      // Only trigger change if text actually changed
      if (newText !== lastTextRef.current) {
        lastTextRef.current = newText;

        if (onChange) {
          const newRun = createUpdatedRun(run, newText);
          onChange(newRun, runIndex);
        }
      }
    },
    [run, runIndex, onChange, isComposing]
  );

  /**
   * Handle composition start (IME input)
   */
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  /**
   * Handle composition end (IME input)
   */
  const handleCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLSpanElement>) => {
      setIsComposing(false);

      // Handle the input after composition
      const element = e.currentTarget;
      const newText = element.textContent || '';

      if (newText !== lastTextRef.current) {
        lastTextRef.current = newText;

        if (onChange) {
          const newRun = createUpdatedRun(run, newText);
          onChange(newRun, runIndex);
        }
      }
    },
    [run, runIndex, onChange]
  );

  /**
   * Handle key down events
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLSpanElement>) => {
      if (onKeyDown) {
        onKeyDown(e, runIndex);
      }
    },
    [onKeyDown, runIndex]
  );

  /**
   * Handle focus
   */
  const handleFocus = useCallback(() => {
    if (onFocus) {
      onFocus(runIndex);
    }
  }, [onFocus, runIndex]);

  /**
   * Handle blur
   */
  const handleBlur = useCallback(() => {
    if (onBlur) {
      onBlur(runIndex);
    }
  }, [onBlur, runIndex]);

  /**
   * Handle selection change within the run
   */
  const handleSelect = useCallback(() => {
    if (!onSelectionChange || !spanRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    // Check if selection is within this run
    if (!spanRef.current.contains(range.startContainer)) return;

    // Calculate offset within the run
    let offset = 0;
    const walker = document.createTreeWalker(
      spanRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node = walker.nextNode();
    while (node && node !== range.startContainer) {
      offset += node.textContent?.length || 0;
      node = walker.nextNode();
    }

    offset += range.startOffset;
    onSelectionChange(offset, runIndex);
  }, [onSelectionChange, runIndex]);

  // Set up selection change listener
  useEffect(() => {
    if (!onSelectionChange) return;

    document.addEventListener('selectionchange', handleSelect);
    return () => {
      document.removeEventListener('selectionchange', handleSelect);
    };
  }, [handleSelect, onSelectionChange]);

  // Handle empty runs
  if (!run.content || run.content.length === 0) {
    // Return empty editable span for cursor positioning
    if (editable) {
      return (
        <span
          ref={spanRef}
          className={buildClassName(run.formatting, className, false)}
          style={mergeStyles(EDITABLE_BASE_STYLE, combinedStyle)}
          contentEditable={true}
          suppressContentEditableWarning={true}
          data-run-index={runIndex}
          {...{ [SELECTION_DATA_ATTRIBUTES.CONTENT_INDEX]: runIndex }}
          {...{ [SELECTION_DATA_ATTRIBUTES.PARAGRAPH_INDEX]: paragraphIndex }}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
        />
      );
    }
    return null;
  }

  // Check if this run can be edited (only text content)
  const canEdit = editable && hasOnlyTextContent(run);

  // Get text content for display
  const displayText = getRunText(run);

  // Check for template variables
  const hasVariables = containsTemplateVariable(displayText);

  // Build class name
  const finalClassName = buildClassName(run.formatting, className, hasVariables);

  // For non-text content (images, shapes), render as non-editable
  if (!canEdit) {
    return (
      <span
        className={finalClassName}
        style={combinedStyle}
        data-run-index={runIndex}
        {...{ [SELECTION_DATA_ATTRIBUTES.CONTENT_INDEX]: runIndex }}
        {...{ [SELECTION_DATA_ATTRIBUTES.PARAGRAPH_INDEX]: paragraphIndex }}
      >
        {renderNonEditableContent(run)}
      </span>
    );
  }

  // Editable text run
  return (
    <span
      ref={spanRef}
      className={finalClassName}
      style={mergeStyles(EDITABLE_BASE_STYLE, combinedStyle)}
      contentEditable={true}
      suppressContentEditableWarning={true}
      spellCheck={true}
      data-run-index={runIndex}
      {...{ [SELECTION_DATA_ATTRIBUTES.CONTENT_INDEX]: runIndex }}
      {...{ [SELECTION_DATA_ATTRIBUTES.PARAGRAPH_INDEX]: paragraphIndex }}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
    >
      {hasVariables ? renderTextWithVariables(displayText) : displayText}
    </span>
  );
}

// ============================================================================
// HELPER RENDER FUNCTIONS
// ============================================================================

/**
 * Build class name for the run span
 */
function buildClassName(
  formatting: TextFormatting | undefined,
  additionalClassName: string | undefined,
  hasVariables: boolean
): string {
  const classNames: string[] = ['docx-run', 'docx-run-editable'];

  if (additionalClassName) {
    classNames.push(additionalClassName);
  }

  if (formatting) {
    if (formatting.bold) classNames.push('docx-run-bold');
    if (formatting.italic) classNames.push('docx-run-italic');
    if (formatting.underline) classNames.push('docx-run-underline');
    if (formatting.strike || formatting.doubleStrike) classNames.push('docx-run-strike');
    if (formatting.vertAlign === 'superscript') classNames.push('docx-run-superscript');
    if (formatting.vertAlign === 'subscript') classNames.push('docx-run-subscript');
    if (formatting.smallCaps) classNames.push('docx-run-small-caps');
    if (formatting.allCaps) classNames.push('docx-run-all-caps');
    if (formatting.highlight && formatting.highlight !== 'none') {
      classNames.push('docx-run-highlighted');
    }
    if (formatting.hidden) classNames.push('docx-run-hidden');
  }

  if (hasVariables) {
    classNames.push('docx-run-has-variable');
  }

  return classNames.join(' ');
}

/**
 * Render text content, highlighting template variables
 */
function renderTextWithVariables(text: string): React.ReactNode {
  if (!containsTemplateVariable(text)) {
    return text;
  }

  // Split text by template variables, keeping the delimiters
  const parts: React.ReactNode[] = [];
  const regex = /(\{\{[^}]+\}\})/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // Add the template variable with special styling
    parts.push(
      <span key={match.index} style={TEMPLATE_VARIABLE_STYLE} contentEditable={false}>
        {match[0]}
      </span>
    );
    lastIndex = regex.lastIndex;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

/**
 * Render non-editable content (images, shapes, etc.)
 */
function renderNonEditableContent(run: RunType): React.ReactNode {
  return run.content.map((content, index) => {
    switch (content.type) {
      case 'text':
        return <React.Fragment key={index}>{content.text}</React.Fragment>;

      case 'tab':
        return (
          <span key={index} className="docx-tab" style={{ whiteSpace: 'pre' }}>
            {'\t'}
          </span>
        );

      case 'break':
        if (content.breakType === 'textWrapping' || !content.breakType) {
          return <br key={index} />;
        }
        return <span key={index} className={`docx-${content.breakType}-break`} />;

      case 'symbol':
        return (
          <span key={index} className="docx-symbol" style={{ fontFamily: content.font }}>
            {String.fromCharCode(parseInt(content.char, 16))}
          </span>
        );

      case 'drawing':
        return (
          <span key={index} className="docx-drawing-placeholder">
            [Image]
          </span>
        );

      case 'shape':
        return (
          <span key={index} className="docx-shape-placeholder">
            [Shape]
          </span>
        );

      case 'footnoteRef':
      case 'endnoteRef':
        return (
          <sup key={index} className={`docx-${content.type}`}>
            [{content.id}]
          </sup>
        );

      default:
        return null;
    }
  });
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Check if a run can be edited (has only text content)
 */
export function isEditableRun(run: RunType): boolean {
  return hasOnlyTextContent(run);
}

/**
 * Get the plain text content of a run
 */
export function getEditableRunText(run: RunType): string {
  return getRunText(run);
}

/**
 * Create a new run with the specified text, preserving formatting
 */
export function updateRunText(run: RunType, newText: string): RunType {
  return createUpdatedRun(run, newText);
}

/**
 * Create an empty run with the specified formatting
 */
export function createEmptyRun(formatting?: TextFormatting): RunType {
  return {
    type: 'run',
    formatting,
    content: [],
  };
}

/**
 * Create a text run with the specified content
 */
export function createTextRun(text: string, formatting?: TextFormatting): RunType {
  return {
    type: 'run',
    formatting,
    content: text ? [{ type: 'text', text }] : [],
  };
}

/**
 * Merge two runs with the same formatting
 */
export function mergeRuns(run1: RunType, run2: RunType): RunType | null {
  // Only merge if formatting is the same (simplified check)
  const format1 = JSON.stringify(run1.formatting || {});
  const format2 = JSON.stringify(run2.formatting || {});

  if (format1 !== format2) {
    return null;
  }

  // Merge text content
  const text1 = getRunText(run1);
  const text2 = getRunText(run2);

  return createTextRun(text1 + text2, run1.formatting);
}

/**
 * Split a run at the specified offset
 */
export function splitRunAtOffset(run: RunType, offset: number): [RunType, RunType] {
  const text = getRunText(run);

  if (offset <= 0) {
    return [createEmptyRun(run.formatting), { ...run }];
  }

  if (offset >= text.length) {
    return [{ ...run }, createEmptyRun(run.formatting)];
  }

  const text1 = text.slice(0, offset);
  const text2 = text.slice(offset);

  return [
    createTextRun(text1, run.formatting),
    createTextRun(text2, run.formatting),
  ];
}

export default EditableRun;
