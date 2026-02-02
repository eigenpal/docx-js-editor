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
  Table as TableType,
  Theme,
  SectionProperties,
  BlockContent,
  Image as ImageType,
  Shape as ShapeType,
  TextBox as TextBoxType,
  HeaderFooter,
  HeaderFooterType,
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
import { Paragraph } from './render/Paragraph';
import { getDefaultSectionProperties } from '../docx/sectionParser';
import { twipsToPixels, formatPx } from '../utils/units';
import { SELECTION_DATA_ATTRIBUTES } from '../hooks/useSelection';
import { calculatePages, type PageLayoutResult, type Page as PageData, type PageContent } from '../layout/pageLayout';
import { selectWordAtCursor } from '../utils/textSelection';

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
  /** Whether to show page margin guides/boundaries */
  showMarginGuides?: boolean;
  /** Color for margin guides (default: #c0c0c0) */
  marginGuideColor?: string;
  /** Whether to enable pagination (default: true) - renders content across multiple pages */
  enablePagination?: boolean;
  /** Custom page renderer */
  renderPage?: (content: ReactNode, pageIndex: number, sectionProps: SectionProperties) => ReactNode;
  /** Custom image renderer */
  renderImage?: (image: ImageType, index: number) => ReactNode;
  /** Custom shape renderer */
  renderShape?: (shape: ShapeType, index: number) => ReactNode;
  /** Custom text box renderer */
  renderTextBox?: (textBox: TextBoxType, index: number) => ReactNode;
  /** Callback when a table cell is clicked */
  onTableCellClick?: (tableIndex: number, rowIndex: number, columnIndex: number) => void;
  /** Check if a table cell is selected */
  isTableCellSelected?: (tableIndex: number, rowIndex: number, columnIndex: number) => boolean;
  /** Callback when page layout changes (current page, total pages) */
  onPageChange?: (currentPage: number, totalPages: number) => void;
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
  /** Scroll to a specific page (1-indexed) */
  scrollToPage: (pageNumber: number) => void;
  /** Get current page number (1-indexed) */
  getCurrentPage: () => number;
  /** Get total page count */
  getTotalPages: () => number;
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
    showMarginGuides = false,
    marginGuideColor,
    enablePagination = true,
    renderPage,
    renderImage,
    renderShape,
    renderTextBox,
    onTableCellClick,
    isTableCellSelected,
    onPageChange,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const paragraphRefs = useRef<Map<number, HTMLParagraphElement>>(new Map());
  const lastPageChangeRef = useRef<{ current: number; total: number } | null>(null);

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

  // Build headers map for layout engine from document package
  const headersForLayout = useMemo(() => {
    const result = new Map<number, Map<HeaderFooterType, HeaderFooter>>();
    const docHeaders = doc.package?.headers;
    const docBody = doc.package?.body;

    if (!docHeaders || docHeaders.size === 0) {
      return result;
    }

    // For now, all headers go to section 0 (most documents have one section)
    // We need to determine header types from the sectPr references
    const sectionHeadersMap = new Map<HeaderFooterType, HeaderFooter>();

    // Get section properties to determine header types
    const sectProps = docBody?.sectionProperties;
    const headerRefs = sectProps?.headerReferences || [];

    // Match headers from docHeaders (keyed by rId) to their types from sectPr
    for (const ref of headerRefs) {
      const header = docHeaders.get(ref.rId);
      if (header) {
        // Update the header's type from the reference
        const typedHeader: HeaderFooter = {
          ...header,
          hdrFtrType: ref.type,
        };
        sectionHeadersMap.set(ref.type, typedHeader);
      }
    }

    // If we have headers, add them to section 0
    if (sectionHeadersMap.size > 0) {
      result.set(0, sectionHeadersMap);
    }

    return result;
  }, [doc.package?.headers, doc.package?.body?.sectionProperties]);

  // Build footers map for layout engine from document package
  const footersForLayout = useMemo(() => {
    const result = new Map<number, Map<HeaderFooterType, HeaderFooter>>();
    const docFooters = doc.package?.footers;
    const docBody = doc.package?.body;

    if (!docFooters || docFooters.size === 0) {
      return result;
    }

    // For now, all footers go to section 0 (most documents have one section)
    // We need to determine footer types from the sectPr references
    const sectionFootersMap = new Map<HeaderFooterType, HeaderFooter>();

    // Get section properties to determine footer types
    const sectProps = docBody?.sectionProperties;
    const footerRefs = sectProps?.footerReferences || [];

    // Match footers from docFooters (keyed by rId) to their types from sectPr
    for (const ref of footerRefs) {
      const footer = docFooters.get(ref.rId);
      if (footer) {
        // Update the footer's type from the reference
        const typedFooter: HeaderFooter = {
          ...footer,
          hdrFtrType: ref.type,
        };
        sectionFootersMap.set(ref.type, typedFooter);
      }
    }

    // If we have footers, add them to section 0
    if (sectionFootersMap.size > 0) {
      result.set(0, sectionFootersMap);
    }

    return result;
  }, [doc.package?.footers, doc.package?.body?.sectionProperties]);

  // Calculate page layout when pagination is enabled
  const pageLayout = useMemo<PageLayoutResult | null>(() => {
    if (!enablePagination || !doc) return null;

    try {
      return calculatePages(doc, {
        theme,
        headers: headersForLayout.size > 0 ? headersForLayout : undefined,
        footers: footersForLayout.size > 0 ? footersForLayout : undefined,
      });
    } catch (error) {
      console.error('Error calculating page layout:', error);
      return null;
    }
  }, [doc, theme, enablePagination, headersForLayout, footersForLayout]);

  // Notify page changes on layout calculation and scroll
  useEffect(() => {
    const totalPages = pageLayout?.totalPages || 1;

    // Notify initial page info
    if (onPageChange) {
      const last = lastPageChangeRef.current;
      if (!last || last.total !== totalPages) {
        lastPageChangeRef.current = { current: 1, total: totalPages };
        onPageChange(1, totalPages);
      }
    }

    // Set up scroll handler to track current page
    const container = containerRef.current;
    if (!container || !pageLayout || !onPageChange) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const pageGapPx = pageGap;

      // Calculate which page is currently visible based on scroll position
      let accumulatedHeight = 0;
      let currentPage = 1;

      for (let i = 0; i < pageLayout.pages.length; i++) {
        const page = pageLayout.pages[i];
        const pageHeight = page.heightPx * zoom;
        const pageMiddle = accumulatedHeight + pageHeight / 2;

        if (scrollTop < pageMiddle) {
          currentPage = i + 1;
          break;
        }

        accumulatedHeight += pageHeight + pageGapPx;
        currentPage = i + 1;
      }

      // Only notify if page changed
      const last = lastPageChangeRef.current;
      if (!last || last.current !== currentPage || last.total !== totalPages) {
        lastPageChangeRef.current = { current: currentPage, total: totalPages };
        onPageChange(currentPage, totalPages);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [pageLayout, zoom, pageGap, onPageChange]);

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
   * Handle double-click to select word
   * Uses native browser selection APIs for reliable word selection
   */
  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      // Don't interfere with modifier keys (user might want different behavior)
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return;
      }

      // Only handle double-clicks on editable content
      if (!editable) {
        return;
      }

      // Let the browser's native selection happen first, then enhance it
      // The browser's native double-click selection is usually good for single text nodes,
      // but we want to ensure consistent word boundary detection across our document
      setTimeout(() => {
        selectWordAtCursor();
      }, 0);
    },
    [editable]
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
      scrollToPage: (pageNumber: number) => {
        if (!containerRef.current || !pageLayout) return;
        if (pageNumber < 1 || pageNumber > pageLayout.pages.length) return;

        // Calculate scroll position for the target page
        let scrollTop = 0;
        for (let i = 0; i < pageNumber - 1; i++) {
          scrollTop += pageLayout.pages[i].heightPx * zoom + pageGap;
        }

        containerRef.current.scrollTo({
          top: scrollTop,
          behavior: 'smooth',
        });
      },
      getCurrentPage: () => lastPageChangeRef.current?.current || 1,
      getTotalPages: () => pageLayout?.totalPages || 1,
    }),
    [doc, focusedParagraphIndex, paragraphCount, pageLayout, zoom, pageGap]
  );

  /**
   * Render a single block (paragraph or table) with its index
   */
  const renderBlock = useCallback(
    (block: BlockContent, blockIndex: number, globalParagraphIndex: number) => {
      if (block.type === 'paragraph') {
        return (
          <EditableParagraph
            key={`para-${blockIndex}`}
            ref={(el) => setParagraphRef(el as HTMLParagraphElement, globalParagraphIndex)}
            paragraph={block}
            paragraphIndex={globalParagraphIndex}
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
      } else if (block.type === 'table') {
        // Get the table index for this table
        let currentTableIndex = 0;
        if (doc.package?.body?.content) {
          for (let i = 0; i < blockIndex; i++) {
            if (doc.package.body.content[i].type === 'table') {
              currentTableIndex++;
            }
          }
        }

        return (
          <DocTable
            key={`table-${blockIndex}`}
            table={block}
            theme={theme}
            index={currentTableIndex}
            onCellClick={onTableCellClick}
            isCellSelected={isTableCellSelected}
          />
        );
      }
      return null;
    },
    [
      theme, editable, handleParagraphChange, handleParagraphSplit,
      handleMergeWithPrevious, handleMergeWithNext, handleCursorChange,
      handleParagraphFocus, handleParagraphBlur, handleNavigateUp,
      handleNavigateDown, renderImage, renderShape, renderTextBox,
      onTableCellClick, isTableCellSelected, setParagraphRef, doc.package?.body?.content
    ]
  );

  /**
   * Render content for a single page (used with pagination)
   */
  const renderPageContent = useCallback(
    (page: PageData) => {
      if (!doc.package?.body) return null;

      return page.content.map((pageContent, contentIndex) => {
        const block = pageContent.block;

        // Calculate global paragraph index
        let globalParagraphIndex = 0;
        if (doc.package?.body?.content) {
          for (let i = 0; i < pageContent.blockIndex; i++) {
            if (doc.package.body.content[i].type === 'paragraph') {
              globalParagraphIndex++;
            }
          }
        }

        // Create a unique key that includes continuation info
        const continuationKey = pageContent.isContinuation ? '-cont' : '';
        const key = `page-${page.pageNumber}-block-${pageContent.blockIndex}${continuationKey}`;

        return (
          <div
            key={key}
            className="docx-page-block"
            style={{
              // Position absolutely within the page content area
              marginBottom: contentIndex < page.content.length - 1 ? '0' : undefined,
            }}
          >
            {renderBlock(block, pageContent.blockIndex, globalParagraphIndex)}
          </div>
        );
      });
    },
    [doc.package?.body, renderBlock]
  );

  /**
   * Render all content without pagination (single page mode)
   */
  const renderAllContent = useCallback(() => {
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
        content.push(renderBlock(block, blockIndex, paragraphIndex));
        paragraphIndex++;
      } else if (block.type === 'table') {
        content.push(renderBlock(block, blockIndex, paragraphIndex));
      }
    }

    return content;
  }, [doc.package?.body, renderBlock]);

  /**
   * Render a single page with its content
   */
  const renderSinglePage = useCallback(
    (page: PageData, totalPages: number) => {
      const pageWidthPx = page.widthPx * zoom;
      const pageHeightPx = page.heightPx * zoom;
      const marginTop = twipsToPixels(page.sectionProps.pageMargins?.top ?? 1440) * zoom;
      const marginBottom = twipsToPixels(page.sectionProps.pageMargins?.bottom ?? 1440) * zoom;
      const marginLeft = twipsToPixels(page.sectionProps.pageMargins?.left ?? 1440) * zoom;
      const marginRight = twipsToPixels(page.sectionProps.pageMargins?.right ?? 1440) * zoom;

      const pageStyle: CSSProperties = {
        width: formatPx(pageWidthPx),
        height: formatPx(pageHeightPx),
        backgroundColor: '#ffffff',
        boxShadow: showPageShadows ? '0 2px 10px rgba(0, 0, 0, 0.2)' : 'none',
        position: 'relative',
        boxSizing: 'border-box',
        overflow: 'hidden',
      };

      const contentAreaStyle: CSSProperties = {
        position: 'absolute',
        top: formatPx(marginTop),
        left: formatPx(marginLeft),
        right: formatPx(marginRight),
        bottom: formatPx(marginBottom),
        overflow: 'hidden',
      };

      const pageContent = renderPageContent(page);

      // Use custom page renderer if provided
      if (renderPage) {
        return renderPage(pageContent, page.pageNumber - 1, page.sectionProps);
      }

      // Calculate header area style
      const headerDistance = twipsToPixels(page.sectionProps.pageMargins?.header ?? 720) * zoom;
      const headerAreaStyle: CSSProperties = {
        position: 'absolute',
        top: formatPx(headerDistance),
        left: formatPx(marginLeft),
        right: formatPx(marginRight),
        height: formatPx(marginTop - headerDistance),
        overflow: 'hidden',
        boxSizing: 'border-box',
      };

      // Render header content
      const renderHeaderContent = (header: HeaderFooter) => {
        return header.content.map((block, index) => {
          if (block.type === 'paragraph') {
            return (
              <Paragraph
                key={`header-para-${index}`}
                paragraph={block}
                theme={theme}
                pageNumber={page.pageNumber}
                totalPages={totalPages}
              />
            );
          } else if (block.type === 'table') {
            return (
              <DocTable
                key={`header-table-${index}`}
                table={block}
                theme={theme}
              />
            );
          }
          return null;
        });
      };

      // Calculate footer area style
      const footerDistance = twipsToPixels(page.sectionProps.pageMargins?.footer ?? 720) * zoom;
      const footerAreaStyle: CSSProperties = {
        position: 'absolute',
        bottom: formatPx(footerDistance),
        left: formatPx(marginLeft),
        right: formatPx(marginRight),
        height: formatPx(marginBottom - footerDistance),
        overflow: 'hidden',
        boxSizing: 'border-box',
      };

      // Render footer content
      const renderFooterContent = (footer: HeaderFooter) => {
        return footer.content.map((block, index) => {
          if (block.type === 'paragraph') {
            return (
              <Paragraph
                key={`footer-para-${index}`}
                paragraph={block}
                theme={theme}
                pageNumber={page.pageNumber}
                totalPages={totalPages}
              />
            );
          } else if (block.type === 'table') {
            return (
              <DocTable
                key={`footer-table-${index}`}
                table={block}
                theme={theme}
              />
            );
          }
          return null;
        });
      };

      return (
        <div
          key={`page-${page.pageNumber}`}
          className={`docx-editor-page ${page.isFirstPageOfSection ? 'docx-page-first-of-section' : ''}`}
          style={pageStyle}
          data-page-number={page.pageNumber}
        >
          {/* Header area */}
          {page.header && (
            <div
              className="docx-page-header-area"
              style={headerAreaStyle}
              role="region"
              aria-label="Page header"
            >
              {renderHeaderContent(page.header)}
            </div>
          )}

          {/* Content area */}
          <div className="docx-page-content-area" style={contentAreaStyle}>
            {pageContent}
          </div>

          {/* Footer area */}
          {page.footer && (
            <div
              className="docx-page-footer-area"
              style={footerAreaStyle}
              role="region"
              aria-label="Page footer"
            >
              {renderFooterContent(page.footer)}
            </div>
          )}

          {/* Margin guides */}
          {showMarginGuides && (
            <div
              className="docx-page-margin-guides"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none',
                overflow: 'hidden',
              }}
            >
              {/* Top margin line */}
              <div
                className="docx-margin-guide docx-margin-guide-top"
                style={{
                  position: 'absolute',
                  top: formatPx(marginTop),
                  left: 0,
                  right: 0,
                  height: 0,
                  borderTop: `1px dashed ${marginGuideColor || '#c0c0c0'}`,
                  pointerEvents: 'none',
                }}
              />
              {/* Bottom margin line */}
              <div
                className="docx-margin-guide docx-margin-guide-bottom"
                style={{
                  position: 'absolute',
                  bottom: formatPx(marginBottom),
                  left: 0,
                  right: 0,
                  height: 0,
                  borderTop: `1px dashed ${marginGuideColor || '#c0c0c0'}`,
                  pointerEvents: 'none',
                }}
              />
              {/* Left margin line */}
              <div
                className="docx-margin-guide docx-margin-guide-left"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: formatPx(marginLeft),
                  width: 0,
                  borderLeft: `1px dashed ${marginGuideColor || '#c0c0c0'}`,
                  pointerEvents: 'none',
                }}
              />
              {/* Right margin line */}
              <div
                className="docx-margin-guide docx-margin-guide-right"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  right: formatPx(marginRight),
                  width: 0,
                  borderLeft: `1px dashed ${marginGuideColor || '#c0c0c0'}`,
                  pointerEvents: 'none',
                }}
              />
            </div>
          )}
        </div>
      );
    },
    [zoom, showPageShadows, showMarginGuides, marginGuideColor, renderPageContent, renderPage, theme]
  );

  /**
   * Render all pages with pagination
   */
  const renderPaginatedPages = () => {
    if (!pageLayout || pageLayout.pages.length === 0) {
      // Fall back to single page rendering if no layout
      return (
        <div
          className="docx-editor-page"
          style={getPageStyle(sectionProps, zoom, showPageShadows)}
        >
          {renderAllContent()}
        </div>
      );
    }

    return pageLayout.pages.map((page) => (
      <div
        key={`page-wrapper-${page.pageNumber}`}
        className="docx-editor-page-wrapper"
        style={{ position: 'relative' }}
      >
        {renderSinglePage(page, pageLayout.totalPages)}
        {showPageNumbers && (
          <div
            className="docx-editor-page-number"
            style={{
              textAlign: 'center',
              marginTop: '10px',
              marginBottom: pageGap > 20 ? '0' : `${pageGap}px`,
              color: '#666',
              fontSize: '12px',
            }}
          >
            Page {page.pageNumber} of {pageLayout.totalPages}
          </div>
        )}
      </div>
    ));
  };

  // Determine what to render based on pagination setting
  const renderedPages = useMemo(() => {
    if (enablePagination && pageLayout && pageLayout.pages.length > 0) {
      return renderPaginatedPages();
    }

    // Single page fallback
    const pageContent = renderAllContent();

    // Calculate margins for margin guides
    const marginTop = twipsToPixels(sectionProps.marginTop) * zoom;
    const marginBottom = twipsToPixels(sectionProps.marginBottom) * zoom;
    const marginLeft = twipsToPixels(sectionProps.marginLeft) * zoom;
    const marginRight = twipsToPixels(sectionProps.marginRight) * zoom;

    const renderedPage = renderPage
      ? renderPage(pageContent, 0, sectionProps)
      : (
        <div
          className="docx-editor-page"
          style={{ ...getPageStyle(sectionProps, zoom, showPageShadows), position: 'relative' }}
        >
          {pageContent}

          {/* Margin guides for single page mode */}
          {showMarginGuides && (
            <div
              className="docx-page-margin-guides"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none',
                overflow: 'hidden',
              }}
            >
              {/* Top margin line */}
              <div
                className="docx-margin-guide docx-margin-guide-top"
                style={{
                  position: 'absolute',
                  top: formatPx(marginTop),
                  left: 0,
                  right: 0,
                  height: 0,
                  borderTop: `1px dashed ${marginGuideColor || '#c0c0c0'}`,
                  pointerEvents: 'none',
                }}
              />
              {/* Bottom margin line */}
              <div
                className="docx-margin-guide docx-margin-guide-bottom"
                style={{
                  position: 'absolute',
                  bottom: formatPx(marginBottom),
                  left: 0,
                  right: 0,
                  height: 0,
                  borderTop: `1px dashed ${marginGuideColor || '#c0c0c0'}`,
                  pointerEvents: 'none',
                }}
              />
              {/* Left margin line */}
              <div
                className="docx-margin-guide docx-margin-guide-left"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: formatPx(marginLeft),
                  width: 0,
                  borderLeft: `1px dashed ${marginGuideColor || '#c0c0c0'}`,
                  pointerEvents: 'none',
                }}
              />
              {/* Right margin line */}
              <div
                className="docx-margin-guide docx-margin-guide-right"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  right: formatPx(marginRight),
                  width: 0,
                  borderLeft: `1px dashed ${marginGuideColor || '#c0c0c0'}`,
                  pointerEvents: 'none',
                }}
              />
            </div>
          )}
        </div>
      );

    return (
      <>
        {renderedPage}
        {showPageNumbers && (
          <div className="docx-editor-page-number" style={{ textAlign: 'center', marginTop: '10px', color: '#666' }}>
            Page 1
          </div>
        )}
      </>
    );
  }, [enablePagination, pageLayout, renderAllContent, renderPage, sectionProps, zoom, showPageShadows, showPageNumbers, showMarginGuides, marginGuideColor, pageGap]);

  return (
    <div
      ref={containerRef}
      className={`docx-editor ${className || ''}`}
      style={{ ...EDITOR_CONTAINER_STYLE, ...style }}
      onDoubleClick={handleDoubleClick}
      {...{ [SELECTION_DATA_ATTRIBUTES.EDITOR_ROOT]: 'true' }}
    >
      <div
        className="docx-editor-pages"
        style={{
          ...PAGE_CONTAINER_STYLE,
          gap: `${pageGap}px`,
        }}
      >
        {renderedPages}
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
