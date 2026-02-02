/**
 * Editable Paragraph Component
 *
 * An editable paragraph that handles text editing, including:
 * - Contains editable runs
 * - Enter key splits paragraph
 * - Backspace at start merges with previous
 * - Delete at end merges with next
 * - Tracks cursor position
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import type {
  Paragraph as ParagraphType,
  ParagraphContent,
  Theme,
  Run as RunType,
  TextFormatting,
  TabStop,
  Hyperlink as HyperlinkType,
  Image as ImageType,
  Shape as ShapeType,
  TextBox as TextBoxType,
} from '../../types/document';
import { paragraphToStyle, textToStyle, mergeStyles } from '../../utils/formatToStyle';
import { twipsToPixels, formatPx } from '../../utils/units';
import { SELECTION_DATA_ATTRIBUTES } from '../../hooks/useSelection';
import { EditableRun, getEditableRunText, createTextRun, splitRunAtOffset, mergeRuns } from './EditableRun';
import { handleNavigationKey, isNavigationKey, parseNavigationAction } from '../../utils/keyboardNavigation';
import { Tab } from '../render/Tab';
import { Hyperlink } from '../render/Hyperlink';
import { Field } from '../render/Field';
import { DocImage } from '../render/DocImage';
import { Shape } from '../render/Shape';
import { TextBox } from '../render/TextBox';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Cursor position within a paragraph
 */
export interface CursorPosition {
  /** Index of the content item (run, hyperlink, etc.) */
  contentIndex: number;
  /** Character offset within the content item */
  offset: number;
}

/**
 * Paragraph split result
 */
export interface ParagraphSplitResult {
  /** The first paragraph (before cursor) */
  before: ParagraphType;
  /** The second paragraph (after cursor) */
  after: ParagraphType;
}

/**
 * Paragraph merge result
 */
export interface ParagraphMergeResult {
  /** The merged paragraph */
  merged: ParagraphType;
  /** Cursor position in the merged paragraph */
  cursorPosition: CursorPosition;
}

/**
 * Props for the EditableParagraph component
 */
export interface EditableParagraphProps {
  /** The paragraph data to render */
  paragraph: ParagraphType;
  /** Index of this paragraph in the document */
  paragraphIndex: number;
  /** Theme for resolving colors and fonts */
  theme?: Theme | null;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Whether editing is enabled */
  editable?: boolean;
  /** Current page number (for PAGE fields) */
  pageNumber?: number;
  /** Total page count (for NUMPAGES fields) */
  totalPages?: number;
  /** Page width in twips (for tab calculations) */
  pageWidth?: number;
  /** Callback when paragraph content changes */
  onChange?: (newParagraph: ParagraphType, paragraphIndex: number) => void;
  /** Callback when Enter is pressed (split paragraph) */
  onSplit?: (splitResult: ParagraphSplitResult, paragraphIndex: number) => void;
  /** Callback when Backspace at start (merge with previous) */
  onMergeWithPrevious?: (paragraphIndex: number) => void;
  /** Callback when Delete at end (merge with next) */
  onMergeWithNext?: (paragraphIndex: number) => void;
  /** Callback when cursor moves within paragraph */
  onCursorChange?: (position: CursorPosition, paragraphIndex: number) => void;
  /** Callback when paragraph receives focus */
  onFocus?: (paragraphIndex: number) => void;
  /** Callback when paragraph loses focus */
  onBlur?: (paragraphIndex: number) => void;
  /** Callback when up arrow at first line */
  onNavigateUp?: (paragraphIndex: number) => void;
  /** Callback when down arrow at last line */
  onNavigateDown?: (paragraphIndex: number) => void;
  /** Callback when Ctrl+Home to go to document start */
  onNavigateToDocumentStart?: () => void;
  /** Callback when Ctrl+End to go to document end */
  onNavigateToDocumentEnd?: () => void;
  /** Callback when a bookmark link is clicked */
  onBookmarkClick?: (bookmarkName: string) => void;
  /** Whether to disable links */
  disableLinks?: boolean;
  /** Render function for images (optional override) */
  renderImage?: (image: ImageType, index: number) => ReactNode;
  /** Render function for shapes (optional override) */
  renderShape?: (shape: ShapeType, index: number) => ReactNode;
  /** Render function for text boxes (optional override) */
  renderTextBox?: (textBox: TextBoxType, index: number) => ReactNode;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the plain text content of a paragraph
 */
export function getParagraphPlainText(paragraph: ParagraphType): string {
  if (!paragraph.content || paragraph.content.length === 0) {
    return '';
  }

  return paragraph.content.map((content) => {
    if (content.type === 'run') {
      return getEditableRunText(content);
    }
    if (content.type === 'hyperlink') {
      return content.children
        .map((child) => {
          if (child.type === 'run') {
            return getEditableRunText(child);
          }
          return '';
        })
        .join('');
    }
    return '';
  }).join('');
}

/**
 * Get the total character count of a paragraph
 */
export function getParagraphCharCount(paragraph: ParagraphType): number {
  return getParagraphPlainText(paragraph).length;
}

/**
 * Check if cursor is at the start of the paragraph
 */
export function isCursorAtStart(position: CursorPosition): boolean {
  return position.contentIndex === 0 && position.offset === 0;
}

/**
 * Check if cursor is at the end of the paragraph
 */
export function isCursorAtEnd(paragraph: ParagraphType, position: CursorPosition): boolean {
  if (!paragraph.content || paragraph.content.length === 0) {
    return true;
  }

  const lastIndex = paragraph.content.length - 1;
  if (position.contentIndex < lastIndex) {
    return false;
  }

  const lastContent = paragraph.content[lastIndex];
  if (lastContent.type === 'run') {
    const runText = getEditableRunText(lastContent);
    return position.offset >= runText.length;
  }

  return position.contentIndex >= lastIndex;
}

/**
 * Get cursor position from DOM selection
 */
function getCursorPositionFromDOM(
  paragraphElement: HTMLElement
): CursorPosition | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!paragraphElement.contains(range.startContainer)) {
    return null;
  }

  // Find the content element containing the cursor
  let node: Node | null = range.startContainer;
  let contentIndex = -1;
  let offset = range.startOffset;

  while (node && node !== paragraphElement) {
    if (node instanceof HTMLElement) {
      const indexAttr = node.getAttribute(SELECTION_DATA_ATTRIBUTES.CONTENT_INDEX);
      if (indexAttr !== null) {
        contentIndex = parseInt(indexAttr, 10);
        break;
      }
    }
    node = node.parentNode;
  }

  if (contentIndex === -1) {
    return { contentIndex: 0, offset: 0 };
  }

  // Calculate actual text offset within the content
  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    // Offset is already correct for text nodes
  } else if (range.startContainer instanceof HTMLElement) {
    // Calculate offset from child nodes
    let textOffset = 0;
    for (let i = 0; i < range.startOffset; i++) {
      const child = range.startContainer.childNodes[i];
      textOffset += child.textContent?.length || 0;
    }
    offset = textOffset;
  }

  return { contentIndex, offset };
}

/**
 * Split a paragraph at the given cursor position
 */
export function splitParagraphAt(
  paragraph: ParagraphType,
  position: CursorPosition
): ParagraphSplitResult {
  const beforeContent: ParagraphContent[] = [];
  const afterContent: ParagraphContent[] = [];

  if (!paragraph.content || paragraph.content.length === 0) {
    // Empty paragraph - just create two empty paragraphs
    return {
      before: { ...paragraph, content: [] },
      after: { ...paragraph, content: [], paraId: undefined, textId: undefined },
    };
  }

  // Process each content item
  for (let i = 0; i < paragraph.content.length; i++) {
    const content = paragraph.content[i];

    if (i < position.contentIndex) {
      // Before the split point - add to before
      beforeContent.push(content);
    } else if (i > position.contentIndex) {
      // After the split point - add to after
      afterContent.push(content);
    } else {
      // At the split point - split this content
      if (content.type === 'run') {
        const [beforeRun, afterRun] = splitRunAtOffset(content, position.offset);
        if (beforeRun.content.length > 0) {
          beforeContent.push(beforeRun);
        }
        if (afterRun.content.length > 0) {
          afterContent.push(afterRun);
        }
      } else {
        // For non-run content (hyperlinks, fields, etc.), put in after
        afterContent.push(content);
      }
    }
  }

  return {
    before: {
      ...paragraph,
      content: beforeContent,
    },
    after: {
      ...paragraph,
      content: afterContent,
      paraId: undefined, // New paragraph gets new IDs
      textId: undefined,
    },
  };
}

/**
 * Merge two paragraphs
 */
export function mergeParagraphs(
  first: ParagraphType,
  second: ParagraphType
): ParagraphMergeResult {
  const firstContent = first.content || [];
  const secondContent = second.content || [];

  // Calculate cursor position (at the end of first paragraph content)
  let cursorContentIndex = firstContent.length > 0 ? firstContent.length - 1 : 0;
  let cursorOffset = 0;

  if (firstContent.length > 0) {
    const lastContent = firstContent[firstContent.length - 1];
    if (lastContent.type === 'run') {
      cursorOffset = getEditableRunText(lastContent).length;
    }
  }

  // Try to merge adjacent runs with same formatting
  let mergedContent: ParagraphContent[] = [...firstContent];

  for (const content of secondContent) {
    const lastMerged = mergedContent[mergedContent.length - 1];

    if (
      lastMerged &&
      lastMerged.type === 'run' &&
      content.type === 'run'
    ) {
      // Try to merge the runs
      const merged = mergeRuns(lastMerged, content);
      if (merged) {
        mergedContent[mergedContent.length - 1] = merged;
        continue;
      }
    }

    mergedContent.push(content);
  }

  return {
    merged: {
      ...first,
      content: mergedContent,
    },
    cursorPosition: {
      contentIndex: cursorContentIndex,
      offset: cursorOffset,
    },
  };
}

/**
 * Create an empty paragraph with optional formatting
 */
export function createEmptyParagraph(formatting?: ParagraphType['formatting']): ParagraphType {
  return {
    type: 'paragraph',
    content: [],
    formatting,
  };
}

/**
 * Build class names for the paragraph element
 */
function buildClassNames(
  paragraph: ParagraphType,
  additionalClassName?: string
): string {
  const classNames: string[] = ['docx-paragraph', 'docx-paragraph-editable'];

  if (additionalClassName) {
    classNames.push(additionalClassName);
  }

  const formatting = paragraph.formatting;
  if (formatting) {
    // Alignment
    if (formatting.alignment) {
      classNames.push(`docx-align-${formatting.alignment}`);
    }

    // Direction
    if (formatting.bidi) {
      classNames.push('docx-rtl');
    }

    // Style reference
    if (formatting.styleId) {
      classNames.push(`docx-style-${formatting.styleId}`);
    }

    // Page break controls
    if (formatting.pageBreakBefore) {
      classNames.push('docx-page-break-before');
    }
    if (formatting.keepNext) {
      classNames.push('docx-keep-next');
    }
    if (formatting.keepLines) {
      classNames.push('docx-keep-lines');
    }
  }

  // List item
  if (paragraph.listRendering) {
    classNames.push('docx-list-item');
    classNames.push(`docx-list-level-${paragraph.listRendering.level}`);
    if (paragraph.listRendering.isBullet) {
      classNames.push('docx-list-bullet');
    } else {
      classNames.push('docx-list-numbered');
    }
  }

  // Empty paragraph
  if (!paragraph.content || paragraph.content.length === 0) {
    classNames.push('docx-paragraph-empty');
  }

  return classNames.join(' ');
}

/**
 * Get style for list marker indentation
 */
function getListMarkerStyle(level: number): CSSProperties {
  return {
    display: 'inline-block',
    minWidth: '1.5em',
    marginRight: '0.5em',
    textAlign: 'right' as const,
    marginLeft: `${level * 36}px`,
  };
}

/**
 * Default style for empty paragraphs (line break)
 */
const EMPTY_PARAGRAPH_STYLE: CSSProperties = {
  minHeight: '1em',
};

/**
 * Base style for editable paragraphs to ensure cursor visibility
 */
const EDITABLE_PARAGRAPH_STYLE: CSSProperties = {
  // Show text cursor when hovering over paragraph
  cursor: 'text',
  // Ensure paragraph has clickable area
  minHeight: '1em',
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * EditableParagraph component - an editable paragraph with full editing support
 */
export function EditableParagraph({
  paragraph,
  paragraphIndex,
  theme,
  className,
  style: additionalStyle,
  editable = true,
  pageNumber,
  totalPages,
  pageWidth,
  onChange,
  onSplit,
  onMergeWithPrevious,
  onMergeWithNext,
  onCursorChange,
  onFocus,
  onBlur,
  onNavigateUp,
  onNavigateDown,
  onNavigateToDocumentStart,
  onNavigateToDocumentEnd,
  onBookmarkClick,
  disableLinks = false,
  renderImage,
  renderShape,
  renderTextBox,
}: EditableParagraphProps): React.ReactElement {
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({ contentIndex: 0, offset: 0 });
  const [isFocused, setIsFocused] = useState(false);

  // Get CSS styles from paragraph formatting
  const formattingStyle = paragraphToStyle(paragraph.formatting, theme);

  // Apply default run properties if present
  const defaultRunStyle = paragraph.formatting?.runProperties
    ? textToStyle(paragraph.formatting.runProperties, theme)
    : {};

  // Combine styles
  const combinedStyle = mergeStyles(formattingStyle, additionalStyle, defaultRunStyle);

  /**
   * Handle run content change
   */
  const handleRunChange = useCallback(
    (newRun: RunType, runIndex: number) => {
      if (!onChange) return;

      const newContent = [...(paragraph.content || [])];

      // Find the actual content index (runs might be at different positions)
      let contentIndex = 0;
      let runCount = 0;
      for (let i = 0; i < paragraph.content.length; i++) {
        if (paragraph.content[i].type === 'run') {
          if (runCount === runIndex) {
            contentIndex = i;
            break;
          }
          runCount++;
        }
      }

      newContent[contentIndex] = newRun;

      onChange(
        { ...paragraph, content: newContent },
        paragraphIndex
      );
    },
    [paragraph, paragraphIndex, onChange]
  );

  /**
   * Handle key down in runs
   */
  const handleRunKeyDown = useCallback(
    (event: KeyboardEvent<HTMLSpanElement>, runIndex: number) => {
      const key = event.key;

      // Get current cursor position
      const currentPosition = getCursorPositionFromDOM(paragraphRef.current!);
      if (currentPosition) {
        setCursorPosition(currentPosition);
      }

      // Handle keyboard navigation (Ctrl+Arrow, Home/End)
      if (isNavigationKey(event.nativeEvent)) {
        const action = parseNavigationAction(event.nativeEvent);

        // Document-level navigation (Ctrl+Home/End)
        if (action && action.unit === 'document') {
          if (action.direction === 'left' && onNavigateToDocumentStart) {
            event.preventDefault();
            onNavigateToDocumentStart();
            return;
          }
          if (action.direction === 'right' && onNavigateToDocumentEnd) {
            event.preventDefault();
            onNavigateToDocumentEnd();
            return;
          }
        }

        // Word and line navigation - let handleNavigationKey handle it
        if (action && (action.unit === 'word' || action.unit === 'line')) {
          handleNavigationKey(event.nativeEvent);
          return;
        }
      }

      // Enter key - split paragraph
      if (key === 'Enter' && !event.shiftKey && onSplit) {
        event.preventDefault();
        const pos = currentPosition || cursorPosition;
        const splitResult = splitParagraphAt(paragraph, pos);
        onSplit(splitResult, paragraphIndex);
        return;
      }

      // Backspace at start - merge with previous
      if (key === 'Backspace' && onMergeWithPrevious) {
        const pos = currentPosition || cursorPosition;
        if (isCursorAtStart(pos)) {
          event.preventDefault();
          onMergeWithPrevious(paragraphIndex);
          return;
        }
      }

      // Delete at end - merge with next
      if (key === 'Delete' && onMergeWithNext) {
        const pos = currentPosition || cursorPosition;
        if (isCursorAtEnd(paragraph, pos)) {
          event.preventDefault();
          onMergeWithNext(paragraphIndex);
          return;
        }
      }

      // Arrow up at first line
      if (key === 'ArrowUp' && onNavigateUp) {
        // Simplified check - if at first line, navigate up
        // Real implementation would check actual line position
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const paragraphRect = paragraphRef.current?.getBoundingClientRect();

          if (paragraphRect && rect.top <= paragraphRect.top + 20) {
            onNavigateUp(paragraphIndex);
          }
        }
      }

      // Arrow down at last line
      if (key === 'ArrowDown' && onNavigateDown) {
        // Simplified check - if at last line, navigate down
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const paragraphRect = paragraphRef.current?.getBoundingClientRect();

          if (paragraphRect && rect.bottom >= paragraphRect.bottom - 20) {
            onNavigateDown(paragraphIndex);
          }
        }
      }
    },
    [
      paragraph,
      paragraphIndex,
      cursorPosition,
      onSplit,
      onMergeWithPrevious,
      onMergeWithNext,
      onNavigateUp,
      onNavigateDown,
      onNavigateToDocumentStart,
      onNavigateToDocumentEnd,
    ]
  );

  /**
   * Handle run focus
   */
  const handleRunFocus = useCallback(
    (runIndex: number) => {
      if (!isFocused) {
        setIsFocused(true);
        onFocus?.(paragraphIndex);
      }
    },
    [paragraphIndex, isFocused, onFocus]
  );

  /**
   * Handle run blur
   */
  const handleRunBlur = useCallback(
    (runIndex: number) => {
      // Delay to check if focus moved to another run in the same paragraph
      setTimeout(() => {
        if (paragraphRef.current && !paragraphRef.current.contains(document.activeElement)) {
          setIsFocused(false);
          onBlur?.(paragraphIndex);
        }
      }, 0);
    },
    [paragraphIndex, onBlur]
  );

  /**
   * Handle selection change within run
   */
  const handleRunSelectionChange = useCallback(
    (offset: number, runIndex: number) => {
      const newPosition: CursorPosition = { contentIndex: runIndex, offset };
      setCursorPosition(newPosition);
      onCursorChange?.(newPosition, paragraphIndex);
    },
    [paragraphIndex, onCursorChange]
  );

  // Check if paragraph is empty
  const isEmpty = !paragraph.content || paragraph.content.length === 0;

  // Handle empty paragraphs
  if (isEmpty) {
    // Create a single empty run for cursor positioning
    const emptyRun: RunType = {
      type: 'run',
      content: [],
      formatting: paragraph.formatting?.runProperties,
    };

    return (
      <p
        ref={paragraphRef}
        className={buildClassNames(paragraph, className)}
        style={mergeStyles(EDITABLE_PARAGRAPH_STYLE, combinedStyle, EMPTY_PARAGRAPH_STYLE)}
        id={paragraph.paraId}
        data-text-id={paragraph.textId}
        {...{ [SELECTION_DATA_ATTRIBUTES.PARAGRAPH_INDEX]: paragraphIndex }}
      >
        <EditableRun
          run={emptyRun}
          runIndex={0}
          paragraphIndex={paragraphIndex}
          theme={theme}
          editable={editable}
          onChange={handleRunChange}
          onKeyDown={handleRunKeyDown}
          onFocus={handleRunFocus}
          onBlur={handleRunBlur}
          onSelectionChange={handleRunSelectionChange}
        />
      </p>
    );
  }

  // Collect tab stops from formatting
  const tabStops: TabStop[] = paragraph.formatting?.tabs || [];

  // Track position for tab width calculation
  let currentPosition = 0;
  let runIndex = 0;

  // Render paragraph content
  const children: ReactNode[] = [];

  // Add list marker if this is a list item
  if (paragraph.listRendering) {
    children.push(
      <span
        key="list-marker"
        className="docx-list-marker"
        style={getListMarkerStyle(paragraph.listRendering.level)}
        contentEditable={false}
      >
        {paragraph.listRendering.marker}
      </span>
    );
  }

  // Render each content item
  paragraph.content.forEach((content, contentIndex) => {
    const key = `content-${contentIndex}`;

    switch (content.type) {
      case 'run':
        children.push(
          <EditableRun
            key={key}
            run={content}
            runIndex={contentIndex}
            paragraphIndex={paragraphIndex}
            theme={theme}
            editable={editable}
            onChange={handleRunChange}
            onKeyDown={handleRunKeyDown}
            onFocus={handleRunFocus}
            onBlur={handleRunBlur}
            onSelectionChange={handleRunSelectionChange}
          />
        );
        runIndex++;
        break;

      case 'hyperlink':
        children.push(
          <Hyperlink
            key={key}
            hyperlink={content}
            theme={theme}
            onBookmarkClick={onBookmarkClick}
            disabled={disableLinks}
          />
        );
        break;

      case 'bookmarkStart':
        children.push(
          <span
            key={key}
            id={content.name}
            className="docx-bookmark-start"
            data-bookmark-id={content.id}
            data-bookmark-name={content.name}
          />
        );
        break;

      case 'bookmarkEnd':
        children.push(
          <span
            key={key}
            className="docx-bookmark-end"
            data-bookmark-id={content.id}
          />
        );
        break;

      case 'simpleField':
      case 'complexField':
        children.push(
          <Field
            key={key}
            field={content}
            theme={theme}
            pageNumber={pageNumber}
            totalPages={totalPages}
          />
        );
        break;
    }
  });

  return (
    <p
      ref={paragraphRef}
      className={buildClassNames(paragraph, className)}
      style={mergeStyles(EDITABLE_PARAGRAPH_STYLE, combinedStyle)}
      id={paragraph.paraId}
      data-text-id={paragraph.textId}
      {...{ [SELECTION_DATA_ATTRIBUTES.PARAGRAPH_INDEX]: paragraphIndex }}
    >
      {children}
    </p>
  );
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Set cursor position within a paragraph element
 */
export function setCursorPosition(
  paragraphElement: HTMLElement,
  position: CursorPosition
): void {
  const selection = window.getSelection();
  if (!selection) return;

  // Find the content element at the given index
  const contentElements = paragraphElement.querySelectorAll(
    `[${SELECTION_DATA_ATTRIBUTES.CONTENT_INDEX}="${position.contentIndex}"]`
  );

  if (contentElements.length === 0) return;

  const contentElement = contentElements[0];

  // Create a tree walker to find the text node at the offset
  const walker = document.createTreeWalker(
    contentElement,
    NodeFilter.SHOW_TEXT,
    null
  );

  let currentOffset = 0;
  let node = walker.nextNode();

  while (node) {
    const nodeLength = node.textContent?.length || 0;

    if (currentOffset + nodeLength >= position.offset) {
      // Found the text node - set selection
      const range = document.createRange();
      range.setStart(node, position.offset - currentOffset);
      range.collapse(true);

      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }

    currentOffset += nodeLength;
    node = walker.nextNode();
  }

  // If we didn't find the exact position, put cursor at end
  if (contentElement) {
    const range = document.createRange();
    range.selectNodeContents(contentElement);
    range.collapse(false);

    selection.removeAllRanges();
    selection.addRange(range);
  }
}

/**
 * Focus the first editable run in a paragraph
 */
export function focusParagraphStart(paragraphElement: HTMLElement): void {
  const firstEditable = paragraphElement.querySelector('[contenteditable="true"]');
  if (firstEditable instanceof HTMLElement) {
    firstEditable.focus();

    // Move cursor to start
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(firstEditable);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}

/**
 * Focus the last editable run in a paragraph
 */
export function focusParagraphEnd(paragraphElement: HTMLElement): void {
  const editables = paragraphElement.querySelectorAll('[contenteditable="true"]');
  const lastEditable = editables[editables.length - 1];

  if (lastEditable instanceof HTMLElement) {
    lastEditable.focus();

    // Move cursor to end
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(lastEditable);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}

/**
 * Check if a paragraph element contains the current focus
 */
export function isParagraphFocused(paragraphElement: HTMLElement): boolean {
  return paragraphElement.contains(document.activeElement);
}

export default EditableParagraph;
