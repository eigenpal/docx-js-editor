/**
 * Editor Component
 *
 * Full WYSIWYG editor with state management for DOCX documents.
 * Handles:
 * - Renders editable pages/paragraphs
 * - Manages document state with immutable updates
 * - onChange callback on any edit
 * - Keyboard navigation between paragraphs
 */

import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  Document,
  DocumentBody,
  Paragraph as ParagraphType,
  Theme,
  SectionProperties,
  BlockContent,
  Image as ImageType,
  Shape as ShapeType,
  TextBox as TextBoxType,
} from '../types/document';
import {
  EditableParagraph,
  splitParagraphAt,
  mergeParagraphs,
  createEmptyParagraph,
  focusParagraphStart,
  focusParagraphEnd,
  type ParagraphSplitResult,
  type CursorPosition,
} from './edit/EditableParagraph';
import { DocTable } from './render/DocTable';
import { getDefaultSectionProperties } from '../docx/sectionParser';
import { twipsToPixels, formatPx } from '../utils/units';
import { SELECTION_DATA_ATTRIBUTES } from '../hooks/useSelection';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Editor state containing the document and selection
 */
export interface EditorState {
  /** The current document */
  document: Document;
  /** Current focus position */
  focusedParagraphIndex: number | null;
  /** Current cursor position within focused paragraph */
  cursorPosition: CursorPosition | null;
}

/**
 * Props for the Editor component
 */
export interface EditorProps {
  /** The document to edit */
  document: Document;
  /** Callback when document changes */
  onChange?: (document: Document) => void;
  /** Callback when selection changes */
  onSelectionChange?: (paragraphIndex: number | null, cursorPosition: CursorPosition | null) => void;
  /** Callback when editor receives focus */
  onFocus?: () => void;
  /** Callback when editor loses focus */
  onBlur?: () => void;
  /** Whether editing is enabled (default: true) */
  editable?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Zoom level (1.0 = 100%) */
  zoom?: number;
  /** Gap between pages in pixels */
  pageGap?: number;
  /** Whether to show page shadows */
  showPageShadows?: boolean;
  /** Whether to show page numbers */
  showPageNumbers?: boolean;
  /** Custom page renderer */
  renderPage?: (content: ReactNode, pageIndex: number, sectionProps: SectionProperties) => ReactNode;
  /** Custom image renderer */
  renderImage?: (image: ImageType, index: number) => ReactNode;
  /** Custom shape renderer */
  renderShape?: (shape: ShapeType, index: number) => ReactNode;
  /** Custom text box renderer */
  renderTextBox?: (textBox: TextBoxType, index: number) => ReactNode;
}

/**
 * Editor ref interface
 */
export interface EditorRef {
  /** Focus the editor */
  focus: () => void;
  /** Blur the editor */
  blur: () => void;
  /** Get current document */
  getDocument: () => Document;
  /** Get focused paragraph index */
  getFocusedParagraphIndex: () => number | null;
  /** Focus a specific paragraph */
  focusParagraph: (index: number, atEnd?: boolean) => void;
  /** Get paragraph element by index */
  getParagraphElement: (index: number) => HTMLElement | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all paragraphs from document body
 */
function getAllParagraphs(body: DocumentBody): ParagraphType[] {
  const paragraphs: ParagraphType[] = [];

  for (const block of body.content) {
    if (block.type === 'paragraph') {
      paragraphs.push(block);
    }
    // Note: Tables contain paragraphs but we handle them separately
  }

  return paragraphs;
}

/**
 * Get the flattened index of a paragraph in the document
 */
function getFlattenedParagraphIndex(body: DocumentBody, blockIndex: number): number {
  let index = 0;
  for (let i = 0; i < blockIndex && i < body.content.length; i++) {
    if (body.content[i].type === 'paragraph') {
      index++;
    }
  }
  return index;
}

/**
 * Update a paragraph in the document body
 */
function updateParagraphInBody(
  body: DocumentBody,
  paragraphIndex: number,
  newParagraph: ParagraphType
): DocumentBody {
  let currentIndex = 0;
  const newContent = body.content.map((block) => {
    if (block.type === 'paragraph') {
      if (currentIndex === paragraphIndex) {
        currentIndex++;
        return newParagraph;
      }
      currentIndex++;
    }
    return block;
  });

  return { ...body, content: newContent };
}

/**
 * Insert a paragraph after another in the document body
 */
function insertParagraphAfter(
  body: DocumentBody,
  paragraphIndex: number,
  newParagraph: ParagraphType
): DocumentBody {
  let currentIndex = 0;
  const newContent: BlockContent[] = [];

  for (const block of body.content) {
    newContent.push(block);

    if (block.type === 'paragraph') {
      if (currentIndex === paragraphIndex) {
        newContent.push(newParagraph);
      }
      currentIndex++;
    }
  }

  return { ...body, content: newContent };
}

/**
 * Remove a paragraph from the document body
 */
function removeParagraph(
  body: DocumentBody,
  paragraphIndex: number
): DocumentBody {
  let currentIndex = 0;
  const newContent = body.content.filter((block) => {
    if (block.type === 'paragraph') {
      const shouldRemove = currentIndex === paragraphIndex;
      currentIndex++;
      return !shouldRemove;
    }
    return true;
  });

  return { ...body, content: newContent };
}

/**
 * Get paragraph at index from document body
 */
function getParagraphAt(body: DocumentBody, paragraphIndex: number): ParagraphType | null {
  let currentIndex = 0;
  for (const block of body.content) {
    if (block.type === 'paragraph') {
      if (currentIndex === paragraphIndex) {
        return block;
      }
      currentIndex++;
    }
  }
  return null;
}

/**
 * Count paragraphs in document body
 */
function countParagraphs(body: DocumentBody): number {
  return body.content.filter((block) => block.type === 'paragraph').length;
}

/**
 * Default styles for editor container
 */
const EDITOR_CONTAINER_STYLE: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'auto',
  backgroundColor: '#f0f0f0',
};

/**
 * Default styles for page container
 */
const PAGE_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '20px',
};

/**
 * Default styles for page
 */
function getPageStyle(
  sectionProps: SectionProperties,
  zoom: number,
  showShadow: boolean
): CSSProperties {
  const pageWidth = twipsToPixels(sectionProps.pageWidth) * zoom;
  const pageHeight = twipsToPixels(sectionProps.pageHeight) * zoom;
  const marginTop = twipsToPixels(sectionProps.marginTop) * zoom;
  const marginBottom = twipsToPixels(sectionProps.marginBottom) * zoom;
  const marginLeft = twipsToPixels(sectionProps.marginLeft) * zoom;
  const marginRight = twipsToPixels(sectionProps.marginRight) * zoom;

  return {
    width: `${pageWidth}px`,
    minHeight: `${pageHeight}px`,
    backgroundColor: '#ffffff',
    boxShadow: showShadow ? '0 2px 10px rgba(0, 0, 0, 0.2)' : 'none',
    padding: `${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px`,
    boxSizing: 'border-box',
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Editor component - full WYSIWYG editor with state management
 */
export const Editor = React.forwardRef<EditorRef, EditorProps>(function Editor(
  {
    document: initialDocument,
    onChange,
    onSelectionChange,
    onFocus,
    onBlur,
    editable = true,
    className,
    style,
    zoom = 1,
    pageGap = 20,
    showPageShadows = true,
    showPageNumbers = false,
    renderPage,
    renderImage,
    renderShape,
    renderTextBox,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const paragraphRefs = useRef<Map<number, HTMLParagraphElement>>(new Map());

  // Document state
  const [doc, setDoc] = useState<Document>(initialDocument);
  const [focusedParagraphIndex, setFocusedParagraphIndex] = useState<number | null>(null);
  const [cursorPosition, setCursorPosition] = useState<CursorPosition | null>(null);

  // Sync with external document changes
  useEffect(() => {
    setDoc(initialDocument);
  }, [initialDocument]);

  // Get theme and section properties
  const theme = doc.package?.theme || null;
  const sectionProps = doc.package?.body?.sectionProperties || getDefaultSectionProperties();

  // Get paragraph count
  const paragraphCount = useMemo(() => {
    return doc.package?.body ? countParagraphs(doc.package.body) : 0;
  }, [doc.package?.body]);

  /**
   * Update document and notify parent
   */
  const updateDocument = useCallback(
    (newDoc: Document) => {
      setDoc(newDoc);
      onChange?.(newDoc);
    },
    [onChange]
  );

  /**
   * Handle paragraph change
   */
  const handleParagraphChange = useCallback(
    (newParagraph: ParagraphType, paragraphIndex: number) => {
      if (!doc.package?.body) return;

      const newBody = updateParagraphInBody(doc.package.body, paragraphIndex, newParagraph);
      const newDoc: Document = {
        ...doc,
        package: {
          ...doc.package,
          body: newBody,
        },
      };

      updateDocument(newDoc);
    },
    [doc, updateDocument]
  );

  /**
   * Handle paragraph split (Enter key)
   */
  const handleParagraphSplit = useCallback(
    (splitResult: ParagraphSplitResult, paragraphIndex: number) => {
      if (!doc.package?.body) return;

      // Update the current paragraph with the "before" content
      let newBody = updateParagraphInBody(doc.package.body, paragraphIndex, splitResult.before);

      // Insert the "after" content as a new paragraph
      newBody = insertParagraphAfter(newBody, paragraphIndex, splitResult.after);

      const newDoc: Document = {
        ...doc,
        package: {
          ...doc.package,
          body: newBody,
        },
      };

      updateDocument(newDoc);

      // Focus the new paragraph after render
      setTimeout(() => {
        const newParaElement = paragraphRefs.current.get(paragraphIndex + 1);
        if (newParaElement) {
          focusParagraphStart(newParaElement);
        }
      }, 0);
    },
    [doc, updateDocument]
  );

  /**
   * Handle merge with previous paragraph (Backspace at start)
   */
  const handleMergeWithPrevious = useCallback(
    (paragraphIndex: number) => {
      if (!doc.package?.body || paragraphIndex === 0) return;

      const currentPara = getParagraphAt(doc.package.body, paragraphIndex);
      const prevPara = getParagraphAt(doc.package.body, paragraphIndex - 1);

      if (!currentPara || !prevPara) return;

      // Merge the paragraphs
      const { merged, cursorPosition: newCursorPos } = mergeParagraphs(prevPara, currentPara);

      // Update the previous paragraph with merged content
      let newBody = updateParagraphInBody(doc.package.body, paragraphIndex - 1, merged);

      // Remove the current paragraph
      newBody = removeParagraph(newBody, paragraphIndex);

      const newDoc: Document = {
        ...doc,
        package: {
          ...doc.package,
          body: newBody,
        },
      };

      updateDocument(newDoc);

      // Focus the merged paragraph at the cursor position
      setTimeout(() => {
        const mergedParaElement = paragraphRefs.current.get(paragraphIndex - 1);
        if (mergedParaElement) {
          focusParagraphEnd(mergedParaElement);
        }
      }, 0);
    },
    [doc, updateDocument]
  );

  /**
   * Handle merge with next paragraph (Delete at end)
   */
  const handleMergeWithNext = useCallback(
    (paragraphIndex: number) => {
      if (!doc.package?.body) return;

      const paragraphCount = countParagraphs(doc.package.body);
      if (paragraphIndex >= paragraphCount - 1) return;

      const currentPara = getParagraphAt(doc.package.body, paragraphIndex);
      const nextPara = getParagraphAt(doc.package.body, paragraphIndex + 1);

      if (!currentPara || !nextPara) return;

      // Merge the paragraphs
      const { merged, cursorPosition: newCursorPos } = mergeParagraphs(currentPara, nextPara);

      // Update the current paragraph with merged content
      let newBody = updateParagraphInBody(doc.package.body, paragraphIndex, merged);

      // Remove the next paragraph
      newBody = removeParagraph(newBody, paragraphIndex + 1);

      const newDoc: Document = {
        ...doc,
        package: {
          ...doc.package,
          body: newBody,
        },
      };

      updateDocument(newDoc);
    },
    [doc, updateDocument]
  );

  /**
   * Handle cursor position change
   */
  const handleCursorChange = useCallback(
    (position: CursorPosition, paragraphIndex: number) => {
      setCursorPosition(position);
      onSelectionChange?.(paragraphIndex, position);
    },
    [onSelectionChange]
  );

  /**
   * Handle paragraph focus
   */
  const handleParagraphFocus = useCallback(
    (paragraphIndex: number) => {
      setFocusedParagraphIndex(paragraphIndex);
      onSelectionChange?.(paragraphIndex, cursorPosition);
      onFocus?.();
    },
    [cursorPosition, onSelectionChange, onFocus]
  );

  /**
   * Handle paragraph blur
   */
  const handleParagraphBlur = useCallback(
    (paragraphIndex: number) => {
      // Check if focus moved to another paragraph
      setTimeout(() => {
        if (!containerRef.current?.contains(document.activeElement)) {
          setFocusedParagraphIndex(null);
          setCursorPosition(null);
          onSelectionChange?.(null, null);
          onBlur?.();
        }
      }, 0);
    },
    [onSelectionChange, onBlur]
  );

  /**
   * Handle navigate up from paragraph
   */
  const handleNavigateUp = useCallback(
    (paragraphIndex: number) => {
      if (paragraphIndex > 0) {
        const prevParaElement = paragraphRefs.current.get(paragraphIndex - 1);
        if (prevParaElement) {
          focusParagraphEnd(prevParaElement);
        }
      }
    },
    []
  );

  /**
   * Handle navigate down from paragraph
   */
  const handleNavigateDown = useCallback(
    (paragraphIndex: number) => {
      const nextParaElement = paragraphRefs.current.get(paragraphIndex + 1);
      if (nextParaElement) {
        focusParagraphStart(nextParaElement);
      }
    },
    []
  );

  /**
   * Store paragraph ref
   */
  const setParagraphRef = useCallback(
    (element: HTMLParagraphElement | null, index: number) => {
      if (element) {
        paragraphRefs.current.set(index, element);
      } else {
        paragraphRefs.current.delete(index);
      }
    },
    []
  );

  // Expose ref methods
  React.useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        if (paragraphCount > 0) {
          const firstPara = paragraphRefs.current.get(0);
          if (firstPara) {
            focusParagraphStart(firstPara);
          }
        }
      },
      blur: () => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      },
      getDocument: () => doc,
      getFocusedParagraphIndex: () => focusedParagraphIndex,
      focusParagraph: (index: number, atEnd = false) => {
        const paraElement = paragraphRefs.current.get(index);
        if (paraElement) {
          if (atEnd) {
            focusParagraphEnd(paraElement);
          } else {
            focusParagraphStart(paraElement);
          }
        }
      },
      getParagraphElement: (index: number) => paragraphRefs.current.get(index) || null,
    }),
    [doc, focusedParagraphIndex, paragraphCount]
  );

  // Render document content
  const renderContent = () => {
    if (!doc.package?.body) {
      return (
        <div className="docx-editor-empty">
          No document loaded
        </div>
      );
    }

    const content: ReactNode[] = [];
    let paragraphIndex = 0;

    for (let blockIndex = 0; blockIndex < doc.package.body.content.length; blockIndex++) {
      const block = doc.package.body.content[blockIndex];

      if (block.type === 'paragraph') {
        const currentIndex = paragraphIndex;
        content.push(
          <EditableParagraph
            key={`para-${blockIndex}`}
            ref={(el) => setParagraphRef(el as HTMLParagraphElement, currentIndex)}
            paragraph={block}
            paragraphIndex={currentIndex}
            theme={theme}
            editable={editable}
            onChange={handleParagraphChange}
            onSplit={handleParagraphSplit}
            onMergeWithPrevious={handleMergeWithPrevious}
            onMergeWithNext={handleMergeWithNext}
            onCursorChange={handleCursorChange}
            onFocus={handleParagraphFocus}
            onBlur={handleParagraphBlur}
            onNavigateUp={handleNavigateUp}
            onNavigateDown={handleNavigateDown}
            renderImage={renderImage}
            renderShape={renderShape}
            renderTextBox={renderTextBox}
          />
        );
        paragraphIndex++;
      } else if (block.type === 'table') {
        content.push(
          <DocTable
            key={`table-${blockIndex}`}
            table={block}
            theme={theme}
          />
        );
      }
    }

    return content;
  };

  // Page content
  const pageContent = renderContent();

  // Wrap in page if custom renderer provided
  const renderedPage = renderPage
    ? renderPage(pageContent, 0, sectionProps)
    : (
      <div
        className="docx-editor-page"
        style={getPageStyle(sectionProps, zoom, showPageShadows)}
      >
        {pageContent}
      </div>
    );

  return (
    <div
      ref={containerRef}
      className={`docx-editor ${className || ''}`}
      style={{ ...EDITOR_CONTAINER_STYLE, ...style }}
      {...{ [SELECTION_DATA_ATTRIBUTES.EDITOR_ROOT]: 'true' }}
    >
      <div
        className="docx-editor-pages"
        style={{
          ...PAGE_CONTAINER_STYLE,
          gap: `${pageGap}px`,
        }}
      >
        {renderedPage}
        {showPageNumbers && (
          <div className="docx-editor-page-number" style={{ textAlign: 'center', marginTop: '10px', color: '#666' }}>
            Page 1
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Create an empty document for the editor
 */
export function createEmptyDocument(): Document {
  return {
    package: {
      body: {
        content: [createEmptyParagraph()],
        sectionProperties: getDefaultSectionProperties(),
      },
    },
    originalBuffer: null as any,
    templateVariables: [],
  };
}

/**
 * Check if a document is empty
 */
export function isDocumentEmpty(doc: Document): boolean {
  if (!doc.package?.body?.content) return true;
  if (doc.package.body.content.length === 0) return true;

  // Check if all paragraphs are empty
  return doc.package.body.content.every((block) => {
    if (block.type === 'paragraph') {
      return !block.content || block.content.length === 0;
    }
    return false;
  });
}

/**
 * Get word count of document
 */
export function getDocumentWordCount(doc: Document): number {
  if (!doc.package?.body?.content) return 0;

  let count = 0;
  for (const block of doc.package.body.content) {
    if (block.type === 'paragraph') {
      const text = block.content
        ?.map((c) => (c.type === 'run' ? c.content.map((rc) => (rc.type === 'text' ? rc.text : '')).join('') : ''))
        .join('') || '';
      count += text.split(/\s+/).filter((word) => word.length > 0).length;
    }
  }
  return count;
}

/**
 * Get character count of document
 */
export function getDocumentCharacterCount(doc: Document, includeSpaces = true): number {
  if (!doc.package?.body?.content) return 0;

  let count = 0;
  for (const block of doc.package.body.content) {
    if (block.type === 'paragraph') {
      const text = block.content
        ?.map((c) => (c.type === 'run' ? c.content.map((rc) => (rc.type === 'text' ? rc.text : '')).join('') : ''))
        .join('') || '';
      count += includeSpaces ? text.length : text.replace(/\s/g, '').length;
    }
  }
  return count;
}

export default Editor;
