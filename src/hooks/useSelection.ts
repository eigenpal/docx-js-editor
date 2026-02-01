/**
 * Selection manager hook for tracking and managing text selection
 *
 * Tracks DOM selection and converts it to document positions.
 * Works with contentEditable elements for WYSIWYG editing.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Position within the document
 */
export interface DocumentPosition {
  /** Index of the paragraph (0-based) */
  paragraphIndex: number;
  /** Index within paragraph content array (run, hyperlink, etc.) */
  contentIndex: number;
  /** Character offset within the content item */
  offset: number;
}

/**
 * Range within the document (start to end position)
 */
export interface DocumentRange {
  /** Start position of the selection */
  start: DocumentPosition;
  /** End position of the selection */
  end: DocumentPosition;
  /** Whether the selection is collapsed (cursor position only) */
  collapsed: boolean;
}

/**
 * Selection state returned by the hook
 */
export interface SelectionState {
  /** Currently selected text (empty string if collapsed) */
  selectedText: string;
  /** Document range of the selection */
  selectedRange: DocumentRange | null;
  /** Whether there is an active selection (not collapsed) */
  hasSelection: boolean;
  /** Whether the selection is within the editor container */
  isWithinEditor: boolean;
  /** The DOM Selection object */
  nativeSelection: Selection | null;
}

/**
 * Options for the useSelection hook
 */
export interface UseSelectionOptions {
  /** Reference to the editor container element */
  containerRef: React.RefObject<HTMLElement>;
  /** Callback when selection changes */
  onSelectionChange?: (state: SelectionState) => void;
  /** Whether to track selection (default: true) */
  enabled?: boolean;
}

/**
 * Data attributes used to identify document elements in the DOM
 */
export const SELECTION_DATA_ATTRIBUTES = {
  /** Attribute for paragraph index */
  PARAGRAPH_INDEX: 'data-paragraph-index',
  /** Attribute for content index within paragraph */
  CONTENT_INDEX: 'data-content-index',
  /** Attribute for run index (deprecated, use CONTENT_INDEX) */
  RUN_INDEX: 'data-run-index',
  /** Attribute for identifying the editor root */
  EDITOR_ROOT: 'data-docx-editor',
  /** Attribute for page number */
  PAGE_NUMBER: 'data-page-number',
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find the paragraph element containing a node
 */
function findParagraphElement(node: Node | null): HTMLElement | null {
  if (!node) return null;

  let current: Node | null = node;
  while (current) {
    if (current instanceof HTMLElement) {
      if (current.hasAttribute(SELECTION_DATA_ATTRIBUTES.PARAGRAPH_INDEX)) {
        return current;
      }
    }
    current = current.parentNode;
  }
  return null;
}

/**
 * Find the content element (run, hyperlink, etc.) containing a node
 */
function findContentElement(node: Node | null): HTMLElement | null {
  if (!node) return null;

  let current: Node | null = node;
  while (current) {
    if (current instanceof HTMLElement) {
      if (current.hasAttribute(SELECTION_DATA_ATTRIBUTES.CONTENT_INDEX) ||
          current.hasAttribute(SELECTION_DATA_ATTRIBUTES.RUN_INDEX)) {
        return current;
      }
      // Stop if we hit the paragraph level
      if (current.hasAttribute(SELECTION_DATA_ATTRIBUTES.PARAGRAPH_INDEX)) {
        break;
      }
    }
    current = current.parentNode;
  }
  return null;
}

/**
 * Calculate character offset within a content element
 */
function calculateOffset(container: Node, targetNode: Node, targetOffset: number): number {
  // If the target is directly the container, offset is the childNodes index
  if (container === targetNode) {
    // Walk text nodes up to the offset
    let total = 0;
    for (let i = 0; i < targetOffset && i < container.childNodes.length; i++) {
      const child = container.childNodes[i];
      if (child.nodeType === Node.TEXT_NODE) {
        total += child.textContent?.length ?? 0;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        total += (child as Element).textContent?.length ?? 0;
      }
    }
    return total;
  }

  // Walk the tree to find the offset
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );

  let offset = 0;
  let node = walker.nextNode();

  while (node) {
    if (node === targetNode) {
      return offset + targetOffset;
    }
    offset += node.textContent?.length ?? 0;
    node = walker.nextNode();
  }

  // If we didn't find the exact node, try parent matching
  if (targetNode.nodeType === Node.TEXT_NODE) {
    return offset + targetOffset;
  }

  return offset;
}

/**
 * Convert a DOM selection anchor/focus to a DocumentPosition
 */
function domToDocumentPosition(
  node: Node | null,
  offset: number,
  containerElement: HTMLElement
): DocumentPosition | null {
  if (!node) return null;

  // Check if the selection is within the container
  if (!containerElement.contains(node)) {
    return null;
  }

  // Find the paragraph element
  const paragraphEl = findParagraphElement(node);
  if (!paragraphEl) {
    return null;
  }

  // Get paragraph index
  const paragraphIndexAttr = paragraphEl.getAttribute(SELECTION_DATA_ATTRIBUTES.PARAGRAPH_INDEX);
  if (paragraphIndexAttr === null) {
    return null;
  }
  const paragraphIndex = parseInt(paragraphIndexAttr, 10);
  if (isNaN(paragraphIndex)) {
    return null;
  }

  // Find content element (run, hyperlink, etc.)
  const contentEl = findContentElement(node);
  if (!contentEl) {
    // Might be at paragraph level, default to first content item
    return {
      paragraphIndex,
      contentIndex: 0,
      offset: 0,
    };
  }

  // Get content index
  const contentIndexAttr = contentEl.getAttribute(SELECTION_DATA_ATTRIBUTES.CONTENT_INDEX) ??
                           contentEl.getAttribute(SELECTION_DATA_ATTRIBUTES.RUN_INDEX);
  if (contentIndexAttr === null) {
    return {
      paragraphIndex,
      contentIndex: 0,
      offset: 0,
    };
  }
  const contentIndex = parseInt(contentIndexAttr, 10);
  if (isNaN(contentIndex)) {
    return {
      paragraphIndex,
      contentIndex: 0,
      offset: 0,
    };
  }

  // Calculate offset within the content element
  const charOffset = calculateOffset(contentEl, node, offset);

  return {
    paragraphIndex,
    contentIndex,
    offset: charOffset,
  };
}

/**
 * Compare two document positions
 * Returns negative if a < b, positive if a > b, 0 if equal
 */
function comparePositions(a: DocumentPosition, b: DocumentPosition): number {
  if (a.paragraphIndex !== b.paragraphIndex) {
    return a.paragraphIndex - b.paragraphIndex;
  }
  if (a.contentIndex !== b.contentIndex) {
    return a.contentIndex - b.contentIndex;
  }
  return a.offset - b.offset;
}

/**
 * Check if a selection is within a container
 */
function isSelectionWithinContainer(
  selection: Selection | null,
  container: HTMLElement | null
): boolean {
  if (!selection || !container || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  return container.contains(range.commonAncestorContainer);
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Hook to track and manage text selection within a DOCX editor
 *
 * @param options - Configuration options
 * @returns Selection state and control functions
 */
export function useSelection(options: UseSelectionOptions) {
  const { containerRef, onSelectionChange, enabled = true } = options;

  const [selectionState, setSelectionState] = useState<SelectionState>({
    selectedText: '',
    selectedRange: null,
    hasSelection: false,
    isWithinEditor: false,
    nativeSelection: null,
  });

  // Keep track of whether we're currently updating selection programmatically
  const isUpdatingSelection = useRef(false);

  /**
   * Process the current DOM selection and convert to document positions
   */
  const processSelection = useCallback(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) {
      setSelectionState({
        selectedText: '',
        selectedRange: null,
        hasSelection: false,
        isWithinEditor: false,
        nativeSelection: null,
      });
      return;
    }

    const selection = window.getSelection();
    if (!selection) {
      setSelectionState({
        selectedText: '',
        selectedRange: null,
        hasSelection: false,
        isWithinEditor: false,
        nativeSelection: null,
      });
      return;
    }

    const isWithinEditor = isSelectionWithinContainer(selection, container);

    if (!isWithinEditor || selection.rangeCount === 0) {
      setSelectionState({
        selectedText: '',
        selectedRange: null,
        hasSelection: false,
        isWithinEditor,
        nativeSelection: selection,
      });
      return;
    }

    // Convert anchor and focus to document positions
    const anchorPos = domToDocumentPosition(
      selection.anchorNode,
      selection.anchorOffset,
      container
    );
    const focusPos = domToDocumentPosition(
      selection.focusNode,
      selection.focusOffset,
      container
    );

    if (!anchorPos || !focusPos) {
      setSelectionState({
        selectedText: selection.toString(),
        selectedRange: null,
        hasSelection: !selection.isCollapsed,
        isWithinEditor,
        nativeSelection: selection,
      });
      return;
    }

    // Determine start and end (selection can be backwards)
    const comparison = comparePositions(anchorPos, focusPos);
    const start = comparison <= 0 ? anchorPos : focusPos;
    const end = comparison <= 0 ? focusPos : anchorPos;

    const range: DocumentRange = {
      start,
      end,
      collapsed: selection.isCollapsed,
    };

    const newState: SelectionState = {
      selectedText: selection.toString(),
      selectedRange: range,
      hasSelection: !selection.isCollapsed,
      isWithinEditor,
      nativeSelection: selection,
    };

    setSelectionState(newState);
  }, [containerRef, enabled]);

  /**
   * Set the selection to a specific document range
   */
  const setSelection = useCallback((range: DocumentRange | null) => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    if (!range) {
      // Clear selection
      window.getSelection()?.removeAllRanges();
      processSelection();
      return;
    }

    isUpdatingSelection.current = true;

    try {
      // Find DOM elements for start and end positions
      const startElement = findElementAtPosition(container, range.start);
      const endElement = range.collapsed
        ? startElement
        : findElementAtPosition(container, range.end);

      if (!startElement || !endElement) {
        console.warn('Could not find DOM elements for selection range');
        return;
      }

      // Find text nodes and offsets
      const startPoint = findTextNodeAtOffset(startElement.element, startElement.offset);
      const endPoint = range.collapsed
        ? startPoint
        : findTextNodeAtOffset(endElement.element, endElement.offset);

      if (!startPoint || !endPoint) {
        console.warn('Could not find text nodes for selection');
        return;
      }

      // Create and apply the selection
      const domRange = document.createRange();
      domRange.setStart(startPoint.node, startPoint.offset);
      domRange.setEnd(endPoint.node, endPoint.offset);

      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(domRange);
      }
    } finally {
      isUpdatingSelection.current = false;
      processSelection();
    }
  }, [containerRef, enabled, processSelection]);

  /**
   * Collapse selection to start or end
   */
  const collapseSelection = useCallback((toStart: boolean = true) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      if (toStart) {
        selection.collapseToStart();
      } else {
        selection.collapseToEnd();
      }
      processSelection();
    }
  }, [processSelection]);

  /**
   * Select all content within the editor
   */
  const selectAll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const domRange = document.createRange();
    domRange.selectNodeContents(container);

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(domRange);
    }
    processSelection();
  }, [containerRef, processSelection]);

  // Listen for selection changes
  useEffect(() => {
    if (!enabled) return;

    const handleSelectionChange = () => {
      if (!isUpdatingSelection.current) {
        processSelection();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    // Initial processing
    processSelection();

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [enabled, processSelection]);

  // Notify on selection change
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectionState);
    }
  }, [selectionState, onSelectionChange]);

  return {
    // State
    ...selectionState,

    // Actions
    setSelection,
    collapseSelection,
    selectAll,
    processSelection,
  };
}

// ============================================================================
// HELPER FUNCTIONS FOR setSelection
// ============================================================================

interface ElementAtPosition {
  element: HTMLElement;
  offset: number;
}

/**
 * Find the DOM element at a document position
 */
function findElementAtPosition(
  container: HTMLElement,
  position: DocumentPosition
): ElementAtPosition | null {
  // Find paragraph by index
  const paragraphs = container.querySelectorAll(
    `[${SELECTION_DATA_ATTRIBUTES.PARAGRAPH_INDEX}="${position.paragraphIndex}"]`
  );

  if (paragraphs.length === 0) {
    return null;
  }

  const paragraph = paragraphs[0] as HTMLElement;

  // Find content element by index
  const contentSelector = `[${SELECTION_DATA_ATTRIBUTES.CONTENT_INDEX}="${position.contentIndex}"], [${SELECTION_DATA_ATTRIBUTES.RUN_INDEX}="${position.contentIndex}"]`;
  const contentElements = paragraph.querySelectorAll(contentSelector);

  if (contentElements.length === 0) {
    // Fall back to paragraph
    return { element: paragraph, offset: position.offset };
  }

  return {
    element: contentElements[0] as HTMLElement,
    offset: position.offset,
  };
}

interface TextNodeAtOffset {
  node: Node;
  offset: number;
}

/**
 * Find the text node at a character offset within an element
 */
function findTextNodeAtOffset(
  element: HTMLElement,
  offset: number
): TextNodeAtOffset | null {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );

  let currentOffset = 0;
  let node = walker.nextNode();

  while (node) {
    const nodeLength = node.textContent?.length ?? 0;

    if (currentOffset + nodeLength >= offset) {
      return {
        node,
        offset: offset - currentOffset,
      };
    }

    currentOffset += nodeLength;
    node = walker.nextNode();
  }

  // If we couldn't find the exact position, use the last text node
  const lastNode = walker.currentNode;
  if (lastNode && lastNode.nodeType === Node.TEXT_NODE) {
    return {
      node: lastNode,
      offset: lastNode.textContent?.length ?? 0,
    };
  }

  // Fall back to the element itself
  return {
    node: element,
    offset: 0,
  };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Check if two document positions are equal
 */
export function positionsEqual(a: DocumentPosition, b: DocumentPosition): boolean {
  return a.paragraphIndex === b.paragraphIndex &&
         a.contentIndex === b.contentIndex &&
         a.offset === b.offset;
}

/**
 * Check if two document ranges are equal
 */
export function rangesEqual(a: DocumentRange | null, b: DocumentRange | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;

  return positionsEqual(a.start, b.start) &&
         positionsEqual(a.end, b.end) &&
         a.collapsed === b.collapsed;
}

/**
 * Create a collapsed range at a position (cursor position)
 */
export function createCollapsedRange(position: DocumentPosition): DocumentRange {
  return {
    start: position,
    end: position,
    collapsed: true,
  };
}

/**
 * Create a range from start to end positions
 */
export function createRange(start: DocumentPosition, end: DocumentPosition): DocumentRange {
  const comparison = comparePositions(start, end);
  const actualStart = comparison <= 0 ? start : end;
  const actualEnd = comparison <= 0 ? end : start;

  return {
    start: actualStart,
    end: actualEnd,
    collapsed: comparison === 0,
  };
}

/**
 * Get the length of a range in terms of character count
 * Note: This is approximate as it doesn't account for content boundaries
 */
export function getRangeLength(range: DocumentRange): number {
  if (range.collapsed) return 0;

  // Same content element
  if (range.start.paragraphIndex === range.end.paragraphIndex &&
      range.start.contentIndex === range.end.contentIndex) {
    return range.end.offset - range.start.offset;
  }

  // Different elements - return a rough estimate
  // Actual length calculation would require document content
  return -1; // Indicates spanning multiple content elements
}

export default useSelection;
