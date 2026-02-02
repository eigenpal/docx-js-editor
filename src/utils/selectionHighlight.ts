/**
 * Selection Highlight Utilities
 *
 * Provides visual highlighting for text selection across multiple runs.
 * Browsers handle ::selection pseudo-element differently, especially when
 * selection spans multiple elements with different backgrounds or styling.
 *
 * This module provides:
 * - Custom selection highlight rendering
 * - Programmatic selection range marking
 * - Visual feedback for selection across runs
 */

import type { CSSProperties } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Highlight rectangle representing a selected region
 */
export interface HighlightRect {
  /** Left position in pixels */
  left: number;
  /** Top position in pixels */
  top: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/**
 * Selection highlight configuration
 */
export interface SelectionHighlightConfig {
  /** Background color for selection */
  backgroundColor: string;
  /** Optional border color for selection */
  borderColor?: string;
  /** Optional border radius */
  borderRadius?: number;
  /** Z-index for overlay */
  zIndex?: number;
  /** Opacity for highlight */
  opacity?: number;
  /** Mix blend mode */
  mixBlendMode?: CSSProperties['mixBlendMode'];
}

/**
 * Selection range in document coordinates
 */
export interface SelectionRange {
  /** Start position */
  start: {
    paragraphIndex: number;
    contentIndex: number;
    offset: number;
  };
  /** End position */
  end: {
    paragraphIndex: number;
    contentIndex: number;
    offset: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default selection highlight style (matches Word/Google Docs)
 */
export const DEFAULT_SELECTION_STYLE: SelectionHighlightConfig = {
  backgroundColor: 'rgba(26, 115, 232, 0.3)',
  borderRadius: 0,
  zIndex: 0,
  opacity: 1,
  mixBlendMode: 'multiply',
};

/**
 * High contrast selection style
 */
export const HIGH_CONTRAST_SELECTION_STYLE: SelectionHighlightConfig = {
  backgroundColor: 'rgba(0, 120, 215, 0.4)',
  borderColor: 'rgba(0, 120, 215, 0.6)',
  borderRadius: 1,
  zIndex: 0,
  opacity: 1,
};

/**
 * Selection highlight CSS custom properties
 */
export const SELECTION_CSS_VARS = {
  backgroundColor: '--docx-selection-bg',
  borderColor: '--docx-selection-border',
  textColor: '--docx-selection-text',
} as const;

// ============================================================================
// SELECTION RECT CALCULATION
// ============================================================================

/**
 * Get all selection rectangles from the current DOM selection
 *
 * Uses getClientRects() to get accurate rectangles even when
 * selection spans multiple inline elements.
 */
export function getSelectionRects(containerElement?: HTMLElement | null): HighlightRect[] {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return [];
  }

  const range = selection.getRangeAt(0);

  // If container is specified, ensure selection is within it
  if (containerElement && !containerElement.contains(range.commonAncestorContainer)) {
    return [];
  }

  // Get all client rects
  const clientRects = range.getClientRects();
  const rects: HighlightRect[] = [];

  // Get container offset for relative positioning
  let offsetLeft = 0;
  let offsetTop = 0;

  if (containerElement) {
    const containerRect = containerElement.getBoundingClientRect();
    offsetLeft = containerRect.left + containerElement.scrollLeft;
    offsetTop = containerRect.top + containerElement.scrollTop;
  }

  for (let i = 0; i < clientRects.length; i++) {
    const rect = clientRects[i];

    // Skip zero-width rects (these can occur at line breaks)
    if (rect.width === 0 && rect.height === 0) {
      continue;
    }

    rects.push({
      left: rect.left - offsetLeft,
      top: rect.top - offsetTop,
      width: rect.width,
      height: rect.height,
    });
  }

  return rects;
}

/**
 * Merge adjacent or overlapping rectangles
 *
 * This reduces the number of highlight elements needed and creates
 * a cleaner visual appearance.
 */
export function mergeAdjacentRects(rects: HighlightRect[], tolerance: number = 2): HighlightRect[] {
  if (rects.length <= 1) {
    return rects;
  }

  // Sort by top, then left
  const sorted = [...rects].sort((a, b) => {
    if (Math.abs(a.top - b.top) < tolerance) {
      return a.left - b.left;
    }
    return a.top - b.top;
  });

  const merged: HighlightRect[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const rect = sorted[i];

    // Check if on same line (within tolerance) and adjacent/overlapping
    const sameLine = Math.abs(rect.top - current.top) < tolerance;
    const adjacent = rect.left <= current.left + current.width + tolerance;

    if (sameLine && adjacent) {
      // Merge with current rect
      const newRight = Math.max(current.left + current.width, rect.left + rect.width);
      current.width = newRight - current.left;
      // Use max height
      current.height = Math.max(current.height, rect.height);
    } else {
      // Start new rect
      merged.push(current);
      current = { ...rect };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Get selection rectangles with merging applied
 */
export function getMergedSelectionRects(containerElement?: HTMLElement | null): HighlightRect[] {
  const rects = getSelectionRects(containerElement);
  return mergeAdjacentRects(rects);
}

// ============================================================================
// HIGHLIGHT OVERLAY GENERATION
// ============================================================================

/**
 * Generate CSS styles for a highlight rectangle
 */
export function getHighlightRectStyle(
  rect: HighlightRect,
  config: SelectionHighlightConfig = DEFAULT_SELECTION_STYLE
): CSSProperties {
  return {
    position: 'absolute',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    backgroundColor: config.backgroundColor,
    borderRadius: config.borderRadius ? `${config.borderRadius}px` : undefined,
    border: config.borderColor ? `1px solid ${config.borderColor}` : undefined,
    zIndex: config.zIndex ?? 0,
    opacity: config.opacity ?? 1,
    mixBlendMode: config.mixBlendMode,
    pointerEvents: 'none',
    userSelect: 'none',
  };
}

/**
 * Generate inline CSS for selection pseudo-elements
 *
 * This is used to inject consistent selection styling
 * across all editable elements.
 */
export function generateSelectionCSS(
  selector: string,
  config: SelectionHighlightConfig = DEFAULT_SELECTION_STYLE
): string {
  const bgColor = config.backgroundColor;

  return `
    ${selector}::selection,
    ${selector} *::selection {
      background-color: ${bgColor} !important;
      color: inherit !important;
    }

    ${selector}::-moz-selection,
    ${selector} *::-moz-selection {
      background-color: ${bgColor} !important;
      color: inherit !important;
    }
  `;
}

// ============================================================================
// SELECTION STATE HELPERS
// ============================================================================

/**
 * Check if there is an active text selection (not collapsed)
 */
export function hasActiveSelection(): boolean {
  const selection = window.getSelection();
  return selection !== null && !selection.isCollapsed && selection.rangeCount > 0;
}

/**
 * Get the selected text
 */
export function getSelectedText(): string {
  const selection = window.getSelection();
  return selection ? selection.toString() : '';
}

/**
 * Check if selection is within a specific element
 */
export function isSelectionWithin(element: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  return element.contains(range.commonAncestorContainer);
}

/**
 * Get the bounding rect of the current selection
 */
export function getSelectionBoundingRect(): DOMRect | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  return range.getBoundingClientRect();
}

// ============================================================================
// PROGRAMMATIC SELECTION HIGHLIGHTING
// ============================================================================

/**
 * Create a selection highlight for a specific text range
 *
 * This is useful for find/replace highlighting, AI action previews, etc.
 */
export function highlightTextRange(
  _containerElement: HTMLElement,
  startNode: Node,
  startOffset: number,
  endNode: Node,
  endOffset: number
): Range | null {
  try {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    return range;
  } catch {
    return null;
  }
}

/**
 * Select a text range programmatically
 */
export function selectRange(range: Range): void {
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

/**
 * Clear the current selection
 */
export function clearSelection(): void {
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
  }
}

// ============================================================================
// SELECTION DIRECTION HELPERS
// ============================================================================

/**
 * Check if selection is backwards (focus before anchor)
 */
export function isSelectionBackwards(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  // Compare anchor and focus positions
  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;

  if (!anchorNode || !focusNode) {
    return false;
  }

  if (anchorNode === focusNode) {
    return selection.focusOffset < selection.anchorOffset;
  }

  // Compare positions in document order
  const position = anchorNode.compareDocumentPosition(focusNode);
  return (position & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
}

/**
 * Normalize selection to always be forward (start before end)
 */
export function normalizeSelectionDirection(): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !isSelectionBackwards()) {
    return;
  }

  // Get current range
  const range = selection.getRangeAt(0);

  // Re-apply in forward direction
  const newRange = document.createRange();
  newRange.setStart(range.startContainer, range.startOffset);
  newRange.setEnd(range.endContainer, range.endOffset);

  selection.removeAllRanges();
  selection.addRange(newRange);
}

// ============================================================================
// CSS INJECTION
// ============================================================================

let injectedStyleElement: HTMLStyleElement | null = null;

/**
 * Inject selection highlight CSS into document
 */
export function injectSelectionStyles(
  config: SelectionHighlightConfig = DEFAULT_SELECTION_STYLE
): void {
  // Remove existing if present
  removeSelectionStyles();

  const css = `
    /* DOCX Editor Selection Highlighting */

    /* Base selection style for all editable content */
    .docx-editor [contenteditable="true"]::selection,
    .docx-editor [contenteditable="true"] *::selection,
    .docx-run-editable::selection,
    .docx-run-editable *::selection {
      background-color: ${config.backgroundColor} !important;
      color: inherit !important;
    }

    /* Firefox selection */
    .docx-editor [contenteditable="true"]::-moz-selection,
    .docx-editor [contenteditable="true"] *::-moz-selection,
    .docx-run-editable::-moz-selection,
    .docx-run-editable *::-moz-selection {
      background-color: ${config.backgroundColor} !important;
      color: inherit !important;
    }

    /* Ensure selection is visible against all backgrounds */
    .docx-run-highlighted::selection,
    .docx-run-highlighted *::selection {
      /* For highlighted (yellow background) text, use darker selection */
      background-color: rgba(26, 115, 232, 0.5) !important;
    }

    .docx-run-highlighted::-moz-selection,
    .docx-run-highlighted *::-moz-selection {
      background-color: rgba(26, 115, 232, 0.5) !important;
    }

    /* Selection in dark text */
    .docx-run-dark-bg::selection,
    .docx-run-dark-bg *::selection {
      /* Use lighter selection for dark backgrounds */
      background-color: rgba(100, 181, 246, 0.5) !important;
    }

    .docx-run-dark-bg::-moz-selection,
    .docx-run-dark-bg *::-moz-selection {
      background-color: rgba(100, 181, 246, 0.5) !important;
    }

    /* Programmatic highlight class */
    .docx-selection-highlight {
      background-color: ${config.backgroundColor};
      ${config.borderRadius ? `border-radius: ${config.borderRadius}px;` : ''}
      ${config.mixBlendMode ? `mix-blend-mode: ${config.mixBlendMode};` : ''}
    }

    /* Find/replace highlight */
    .docx-find-highlight {
      background-color: rgba(255, 235, 59, 0.5);
      border-radius: 2px;
    }

    .docx-find-highlight-current {
      background-color: rgba(255, 152, 0, 0.6);
      border-radius: 2px;
      outline: 2px solid rgba(255, 152, 0, 0.8);
    }

    /* AI action selection preview */
    .docx-ai-selection-preview {
      background-color: rgba(156, 39, 176, 0.2);
      border-bottom: 2px dashed rgba(156, 39, 176, 0.6);
    }
  `;

  injectedStyleElement = document.createElement('style');
  injectedStyleElement.id = 'docx-selection-styles';
  injectedStyleElement.textContent = css;
  document.head.appendChild(injectedStyleElement);
}

/**
 * Remove injected selection styles
 */
export function removeSelectionStyles(): void {
  if (injectedStyleElement) {
    injectedStyleElement.remove();
    injectedStyleElement = null;
  }

  // Also try to remove by ID in case reference was lost
  const existing = document.getElementById('docx-selection-styles');
  if (existing) {
    existing.remove();
  }
}

/**
 * Check if selection styles are injected
 */
export function areSelectionStylesInjected(): boolean {
  return injectedStyleElement !== null || document.getElementById('docx-selection-styles') !== null;
}

// ============================================================================
// SELECTION HIGHLIGHTING HOOK HELPERS
// ============================================================================

/**
 * Create a selection change handler that updates highlight rects
 */
export function createSelectionChangeHandler(
  containerElement: HTMLElement | null,
  onRectsChange: (rects: HighlightRect[]) => void,
  merge: boolean = true
): () => void {
  return () => {
    if (!containerElement) {
      onRectsChange([]);
      return;
    }

    const rects = merge
      ? getMergedSelectionRects(containerElement)
      : getSelectionRects(containerElement);

    onRectsChange(rects);
  };
}

export default {
  DEFAULT_SELECTION_STYLE,
  HIGH_CONTRAST_SELECTION_STYLE,
  getSelectionRects,
  mergeAdjacentRects,
  getMergedSelectionRects,
  getHighlightRectStyle,
  generateSelectionCSS,
  hasActiveSelection,
  getSelectedText,
  isSelectionWithin,
  getSelectionBoundingRect,
  highlightTextRange,
  selectRange,
  clearSelection,
  isSelectionBackwards,
  normalizeSelectionDirection,
  injectSelectionStyles,
  removeSelectionStyles,
  areSelectionStylesInjected,
  createSelectionChangeHandler,
};
