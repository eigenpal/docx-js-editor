/**
 * Text Selection Utilities
 *
 * Utilities for word-level and paragraph-level text selection.
 * Used for double-click (word) and triple-click (paragraph) selection.
 */

// ============================================================================
// WORD BOUNDARY DETECTION
// ============================================================================

/**
 * Regular expression for word characters.
 * Includes letters, numbers, and common word-internal punctuation (apostrophes, hyphens).
 */
const WORD_CHAR_REGEX = /[\p{L}\p{N}''\-]/u;

/**
 * Regular expression for whitespace characters
 */
const WHITESPACE_REGEX = /\s/;

/**
 * Check if a character is a word character
 */
export function isWordCharacter(char: string): boolean {
  if (!char || char.length === 0) return false;
  return WORD_CHAR_REGEX.test(char);
}

/**
 * Check if a character is whitespace
 */
export function isWhitespace(char: string): boolean {
  if (!char || char.length === 0) return false;
  return WHITESPACE_REGEX.test(char);
}

/**
 * Find word boundaries around a position in text
 * Returns [startIndex, endIndex] inclusive start, exclusive end
 */
export function findWordBoundaries(
  text: string,
  position: number
): [number, number] {
  if (!text || text.length === 0) {
    return [0, 0];
  }

  // Clamp position to valid range
  position = Math.max(0, Math.min(position, text.length - 1));

  const charAtPosition = text[position];

  // If on whitespace, select the whitespace run
  if (isWhitespace(charAtPosition)) {
    let start = position;
    let end = position;

    // Expand backwards through whitespace
    while (start > 0 && isWhitespace(text[start - 1])) {
      start--;
    }

    // Expand forwards through whitespace
    while (end < text.length && isWhitespace(text[end])) {
      end++;
    }

    return [start, end];
  }

  // If on a word character, find the word
  if (isWordCharacter(charAtPosition)) {
    let start = position;
    let end = position;

    // Expand backwards through word characters
    while (start > 0 && isWordCharacter(text[start - 1])) {
      start--;
    }

    // Expand forwards through word characters
    while (end < text.length && isWordCharacter(text[end])) {
      end++;
    }

    return [start, end];
  }

  // On punctuation or other non-word character, just select that character
  return [position, position + 1];
}

/**
 * Get the word at a position in text
 */
export function getWordAt(text: string, position: number): string {
  const [start, end] = findWordBoundaries(text, position);
  return text.slice(start, end);
}

/**
 * Word selection result
 */
export interface WordSelectionResult {
  /** The selected word */
  word: string;
  /** Start index in the text (inclusive) */
  startIndex: number;
  /** End index in the text (exclusive) */
  endIndex: number;
}

/**
 * Find the word at a position and return detailed info
 */
export function findWordAt(text: string, position: number): WordSelectionResult {
  const [start, end] = findWordBoundaries(text, position);
  return {
    word: text.slice(start, end),
    startIndex: start,
    endIndex: end,
  };
}

// ============================================================================
// DOM-BASED SELECTION
// ============================================================================

/**
 * Select a word at the current cursor position using the browser's native APIs.
 * This works reliably across different browsers and handles contentEditable well.
 */
export function selectWordAtCursor(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  // Get the current range (cursor position)
  const range = selection.getRangeAt(0);

  // The container node where the selection is
  const container = range.startContainer;

  // If we're in a text node, we can select the word
  if (container.nodeType === Node.TEXT_NODE) {
    const text = container.textContent || '';
    const position = range.startOffset;

    // Find word boundaries
    const [wordStart, wordEnd] = findWordBoundaries(text, position);

    // If we found a word, select it
    if (wordEnd > wordStart) {
      range.setStart(container, wordStart);
      range.setEnd(container, wordEnd);

      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    }
  }

  // For element nodes or other cases, try to find the text node
  if (container.nodeType === Node.ELEMENT_NODE) {
    // Try to get the text content and find the text node
    const element = container as Element;
    const textNodes = getTextNodesIn(element);

    if (textNodes.length > 0) {
      // Find which text node we're near
      const offset = range.startOffset;
      let targetNode: Text | null = null;
      let targetOffset = offset;

      // If offset is a child index, get that child's text node
      if (offset < element.childNodes.length) {
        const child = element.childNodes[offset];
        if (child.nodeType === Node.TEXT_NODE) {
          targetNode = child as Text;
          targetOffset = 0;
        } else if (child instanceof Element) {
          const childTextNodes = getTextNodesIn(child);
          if (childTextNodes.length > 0) {
            targetNode = childTextNodes[0];
            targetOffset = 0;
          }
        }
      }

      // Fallback to first text node
      if (!targetNode && textNodes.length > 0) {
        targetNode = textNodes[0];
        targetOffset = 0;
      }

      if (targetNode) {
        const text = targetNode.textContent || '';
        const [wordStart, wordEnd] = findWordBoundaries(text, targetOffset);

        if (wordEnd > wordStart) {
          const newRange = document.createRange();
          newRange.setStart(targetNode, wordStart);
          newRange.setEnd(targetNode, wordEnd);

          selection.removeAllRanges();
          selection.addRange(newRange);
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Select a word in a specific text node at the given offset
 */
export function selectWordInTextNode(
  textNode: Text,
  offset: number
): boolean {
  const selection = window.getSelection();
  if (!selection) return false;

  const text = textNode.textContent || '';
  const [wordStart, wordEnd] = findWordBoundaries(text, offset);

  if (wordEnd > wordStart) {
    const range = document.createRange();
    range.setStart(textNode, wordStart);
    range.setEnd(textNode, wordEnd);

    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  return false;
}

/**
 * Expand the current selection to word boundaries.
 * If there's a collapsed selection (cursor), selects the word at cursor.
 * If there's an existing selection, expands to include complete words.
 */
export function expandSelectionToWordBoundaries(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);

  // If collapsed, use selectWordAtCursor
  if (range.collapsed) {
    return selectWordAtCursor();
  }

  // For non-collapsed selections, expand both ends to word boundaries
  const startContainer = range.startContainer;
  const endContainer = range.endContainer;

  let newStartOffset = range.startOffset;
  let newEndOffset = range.endOffset;

  // Expand start to word boundary
  if (startContainer.nodeType === Node.TEXT_NODE) {
    const text = startContainer.textContent || '';
    const [wordStart] = findWordBoundaries(text, range.startOffset);
    newStartOffset = wordStart;
  }

  // Expand end to word boundary
  if (endContainer.nodeType === Node.TEXT_NODE) {
    const text = endContainer.textContent || '';
    const position = Math.max(0, range.endOffset - 1);
    const [, wordEnd] = findWordBoundaries(text, position);
    newEndOffset = wordEnd;
  }

  // Apply the expanded selection
  try {
    range.setStart(startContainer, newStartOffset);
    range.setEnd(endContainer, newEndOffset);

    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  } catch (e) {
    // Selection manipulation can throw in some edge cases
    console.warn('Could not expand selection to word boundaries:', e);
    return false;
  }
}

// ============================================================================
// PARAGRAPH SELECTION
// ============================================================================

/**
 * Select the entire paragraph containing the current selection.
 * Looks for the nearest element with [data-paragraph-index] attribute.
 */
export function selectParagraphAtCursor(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;

  // Find the paragraph element
  const paragraphElement = findParagraphElement(container);

  if (paragraphElement) {
    const newRange = document.createRange();
    newRange.selectNodeContents(paragraphElement);

    selection.removeAllRanges();
    selection.addRange(newRange);
    return true;
  }

  return false;
}

/**
 * Find the paragraph element containing a node.
 * Looks for elements with [data-paragraph-index] attribute.
 */
function findParagraphElement(node: Node | null): Element | null {
  if (!node) return null;

  let current: Node | null = node;
  while (current) {
    if (current instanceof Element) {
      if (current.hasAttribute('data-paragraph-index')) {
        return current;
      }
    }
    current = current.parentNode;
  }

  return null;
}

/**
 * Get all text nodes within an element
 */
function getTextNodesIn(element: Element): Text[] {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      textNodes.push(node as Text);
    }
  }

  return textNodes;
}

// ============================================================================
// DOUBLE/TRIPLE CLICK HANDLERS
// ============================================================================

/**
 * Track click count for double/triple click detection
 */
let clickCount = 0;
let clickTimer: ReturnType<typeof setTimeout> | null = null;
let lastClickTarget: EventTarget | null = null;

const MULTI_CLICK_TIMEOUT = 500; // ms

/**
 * Reset click count
 */
function resetClickCount(): void {
  clickCount = 0;
  lastClickTarget = null;
  if (clickTimer) {
    clearTimeout(clickTimer);
    clickTimer = null;
  }
}

/**
 * Handle click event for multi-click detection.
 * Call this in your click handler.
 * Returns the click count (1 = single, 2 = double, 3 = triple).
 */
export function handleClickForMultiClick(event: MouseEvent): number {
  // Reset if clicking different target
  if (event.target !== lastClickTarget) {
    resetClickCount();
  }

  clickCount++;
  lastClickTarget = event.target;

  // Reset timer
  if (clickTimer) {
    clearTimeout(clickTimer);
  }

  clickTimer = setTimeout(resetClickCount, MULTI_CLICK_TIMEOUT);

  // Cap at 3 clicks
  return Math.min(clickCount, 3);
}

/**
 * Create a double-click handler that selects words.
 * Returns a function that should be called on dblclick events.
 */
export function createDoubleClickWordSelector(): (event: MouseEvent) => void {
  return (event: MouseEvent) => {
    // Prevent default double-click behavior (which might be too aggressive)
    // We'll implement our own word selection

    // Don't interfere if user is holding modifiers
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    // Select the word at the click position
    selectWordAtCursor();
  };
}

/**
 * Create a triple-click handler that selects paragraphs.
 * This uses our custom click counting since browsers have inconsistent triple-click.
 */
export function createTripleClickParagraphSelector(): (event: MouseEvent) => void {
  return (event: MouseEvent) => {
    const clickNum = handleClickForMultiClick(event);

    if (clickNum === 3) {
      // Don't interfere with modifier keys
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      // Select the paragraph
      selectParagraphAtCursor();
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  isWordCharacter,
  isWhitespace,
  findWordBoundaries,
  getWordAt,
  findWordAt,
  selectWordAtCursor,
  selectWordInTextNode,
  expandSelectionToWordBoundaries,
  selectParagraphAtCursor,
  handleClickForMultiClick,
  createDoubleClickWordSelector,
  createTripleClickParagraphSelector,
};
