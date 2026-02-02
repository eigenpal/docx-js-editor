/**
 * useClipboard Hook
 *
 * React hook for managing clipboard operations in the editor with formatting preservation.
 *
 * Features:
 * - Copy: Copies selected runs/paragraphs to clipboard with formatting as HTML
 * - Cut: Copies and removes selected content
 * - Paste: Parses clipboard HTML/text and applies formatting
 * - Handles Word-pasted content (cleans Word-specific markup)
 * - Keyboard shortcuts (Ctrl+C, Ctrl+X, Ctrl+V)
 */

import { useCallback, useRef } from 'react';
import type { Run } from '../types/document';
import {
  copyRuns,
  handlePasteEvent,
  runsToClipboardContent,
  type ParsedClipboardContent,
} from '../utils/clipboard';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Selection data for clipboard operations
 */
export interface ClipboardSelection {
  /** Selected text (plain text) */
  text: string;
  /** Selected runs */
  runs: Run[];
  /** Start position */
  startParagraphIndex: number;
  startRunIndex: number;
  startOffset: number;
  /** End position */
  endParagraphIndex: number;
  endRunIndex: number;
  endOffset: number;
  /** Whether selection spans multiple paragraphs */
  isMultiParagraph: boolean;
}

/**
 * Options for useClipboard hook
 */
export interface UseClipboardOptions {
  /** Callback when content is copied */
  onCopy?: (selection: ClipboardSelection) => void;
  /** Callback when content is cut */
  onCut?: (selection: ClipboardSelection) => void;
  /** Callback when content is pasted */
  onPaste?: (content: ParsedClipboardContent, asPlainText: boolean) => void;
  /** Whether to clean Word-specific formatting */
  cleanWordFormatting?: boolean;
  /** Whether the editor is editable */
  editable?: boolean;
  /** Callback for errors */
  onError?: (error: Error) => void;
}

/**
 * Return value of useClipboard hook
 */
export interface UseClipboardReturn {
  /** Copy the current selection to clipboard */
  copy: (selection: ClipboardSelection) => Promise<boolean>;
  /** Cut the current selection to clipboard */
  cut: (selection: ClipboardSelection) => Promise<boolean>;
  /** Paste from clipboard */
  paste: (asPlainText?: boolean) => Promise<ParsedClipboardContent | null>;
  /** Handle copy event from DOM */
  handleCopy: (event: ClipboardEvent) => void;
  /** Handle cut event from DOM */
  handleCut: (event: ClipboardEvent) => void;
  /** Handle paste event from DOM */
  handlePaste: (event: ClipboardEvent) => void;
  /** Handle keyboard shortcuts */
  handleKeyDown: (event: KeyboardEvent) => void;
  /** Whether a clipboard operation is in progress */
  isProcessing: boolean;
  /** Last pasted content */
  lastPastedContent: ParsedClipboardContent | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get selected runs from the current DOM selection
 */
export function getSelectionRuns(): Run[] {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    return [];
  }

  const runs: Run[] = [];
  const range = selection.getRangeAt(0);

  // Find all run elements within the selection
  const container = range.commonAncestorContainer;
  const containerElement =
    container.nodeType === Node.ELEMENT_NODE ? (container as HTMLElement) : container.parentElement;

  if (!containerElement) return runs;

  // Get all docx-run elements within the range
  const runElements = containerElement.querySelectorAll('.docx-run');

  runElements.forEach((runEl) => {
    if (range.intersectsNode(runEl)) {
      // Extract text content and formatting from the run
      const text = getSelectedTextFromRun(runEl, range);
      if (text) {
        const formatting = extractFormattingFromElement(runEl as HTMLElement);
        runs.push({
          type: 'run',
          formatting,
          content: [{ type: 'text', text }],
        });
      }
    }
  });

  // If no runs found, just get the selected text
  if (runs.length === 0) {
    const selectedText = selection.toString();
    if (selectedText) {
      runs.push({
        type: 'run',
        content: [{ type: 'text', text: selectedText }],
      });
    }
  }

  return runs;
}

/**
 * Get selected text from a run element, considering partial selection
 */
function getSelectedTextFromRun(runEl: Node, range: Range): string {
  const runRange = document.createRange();
  runRange.selectNodeContents(runEl);

  // Check if the run is fully or partially selected
  const startInRun =
    range.compareBoundaryPoints(Range.START_TO_START, runRange) >= 0 &&
    range.compareBoundaryPoints(Range.START_TO_END, runRange) <= 0;
  const endInRun =
    range.compareBoundaryPoints(Range.END_TO_START, runRange) >= 0 &&
    range.compareBoundaryPoints(Range.END_TO_END, runRange) <= 0;

  if (startInRun && endInRun) {
    // Selection is entirely within this run
    return range.toString();
  } else if (startInRun) {
    // Selection starts in this run
    const tempRange = document.createRange();
    tempRange.setStart(range.startContainer, range.startOffset);
    tempRange.selectNodeContents(runEl);
    tempRange.setEnd(runRange.endContainer, runRange.endOffset);
    return tempRange.toString();
  } else if (endInRun) {
    // Selection ends in this run
    const tempRange = document.createRange();
    tempRange.selectNodeContents(runEl);
    tempRange.setEnd(range.endContainer, range.endOffset);
    tempRange.setStart(runRange.startContainer, runRange.startOffset);
    return tempRange.toString();
  } else if (range.intersectsNode(runEl)) {
    // Run is entirely within selection
    return runEl.textContent || '';
  }

  return '';
}

/**
 * Extract formatting from an HTML element's computed styles
 */
function extractFormattingFromElement(element: HTMLElement): Run['formatting'] {
  const style = window.getComputedStyle(element);
  const formatting: Run['formatting'] = {};

  // Bold
  if (style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 700) {
    formatting.bold = true;
  }

  // Italic
  if (style.fontStyle === 'italic') {
    formatting.italic = true;
  }

  // Underline
  const textDecoration = style.textDecoration || style.textDecorationLine;
  if (textDecoration && textDecoration.includes('underline')) {
    formatting.underline = { style: 'single' };
  }

  // Strikethrough
  if (textDecoration && textDecoration.includes('line-through')) {
    formatting.strike = true;
  }

  // Font size (convert px to half-points)
  const fontSize = parseFloat(style.fontSize);
  if (!isNaN(fontSize) && fontSize > 0) {
    // 1pt = 1.333px at 96dpi, font size in OOXML is in half-points
    formatting.fontSize = Math.round((fontSize / 1.333) * 2);
  }

  // Font family
  const fontFamily = style.fontFamily.replace(/["']/g, '').split(',')[0].trim();
  if (fontFamily) {
    formatting.fontFamily = { ascii: fontFamily };
  }

  // Color
  const color = style.color;
  if (color && color !== 'rgb(0, 0, 0)') {
    const hex = rgbToHex(color);
    if (hex) {
      formatting.color = { rgb: hex };
    }
  }

  // Background color
  const bgColor = style.backgroundColor;
  if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
    const hex = rgbToHex(bgColor);
    if (hex) {
      formatting.shading = { fill: { rgb: hex } };
    }
  }

  return Object.keys(formatting).length > 0 ? formatting : undefined;
}

/**
 * Convert RGB color string to hex
 */
function rgbToHex(color: string): string | null {
  if (!color || color === 'transparent' || color === 'inherit') {
    return null;
  }

  // Already hex
  if (color.startsWith('#')) {
    return color.slice(1).toUpperCase();
  }

  // RGB/RGBA
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return (r + g + b).toUpperCase();
  }

  return null;
}

/**
 * Create a selection object from the current DOM selection
 */
export function createSelectionFromDOM(): ClipboardSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    return null;
  }

  const runs = getSelectionRuns();
  if (runs.length === 0) {
    return null;
  }

  const text = selection.toString();

  // Find paragraph indices from data attributes
  const range = selection.getRangeAt(0);
  const startPara = findParagraphElement(range.startContainer);
  const endPara = findParagraphElement(range.endContainer);

  const startParagraphIndex = startPara
    ? parseInt(startPara.getAttribute('data-paragraph-index') || '0', 10)
    : 0;
  const endParagraphIndex = endPara
    ? parseInt(endPara.getAttribute('data-paragraph-index') || '0', 10)
    : 0;

  return {
    text,
    runs,
    startParagraphIndex,
    startRunIndex: 0,
    startOffset: range.startOffset,
    endParagraphIndex,
    endRunIndex: 0,
    endOffset: range.endOffset,
    isMultiParagraph: startParagraphIndex !== endParagraphIndex,
  };
}

/**
 * Find the paragraph element containing a node
 */
function findParagraphElement(node: Node): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as HTMLElement;
      if (element.hasAttribute('data-paragraph-index')) {
        return element;
      }
    }
    current = current.parentNode;
  }
  return null;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * React hook for clipboard operations
 */
export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const { onCopy, onCut, onPaste, cleanWordFormatting = true, editable = true, onError } = options;

  const isProcessingRef = useRef<boolean>(false);
  const lastPastedContentRef = useRef<ParsedClipboardContent | null>(null);

  /**
   * Copy selection to clipboard
   */
  const copy = useCallback(
    async (selection: ClipboardSelection): Promise<boolean> => {
      if (isProcessingRef.current) return false;

      isProcessingRef.current = true;
      try {
        const success = await copyRuns(selection.runs, { onError });
        if (success) {
          onCopy?.(selection);
        }
        return success;
      } finally {
        isProcessingRef.current = false;
      }
    },
    [onCopy, onError]
  );

  /**
   * Cut selection to clipboard
   */
  const cut = useCallback(
    async (selection: ClipboardSelection): Promise<boolean> => {
      if (isProcessingRef.current || !editable) return false;

      isProcessingRef.current = true;
      try {
        const success = await copyRuns(selection.runs, { onError });
        if (success) {
          onCut?.(selection);
        }
        return success;
      } finally {
        isProcessingRef.current = false;
      }
    },
    [onCut, editable, onError]
  );

  /**
   * Paste from clipboard
   */
  const paste = useCallback(
    async (asPlainText = false): Promise<ParsedClipboardContent | null> => {
      if (isProcessingRef.current || !editable) return null;

      isProcessingRef.current = true;
      try {
        // Try to read from clipboard
        if (navigator.clipboard && navigator.clipboard.read) {
          const items = await navigator.clipboard.read();
          let html = '';
          let plainText = '';

          for (const item of items) {
            if (item.types.includes('text/html')) {
              const blob = await item.getType('text/html');
              html = await blob.text();
            }
            if (item.types.includes('text/plain')) {
              const blob = await item.getType('text/plain');
              plainText = await blob.text();
            }
          }

          // If paste as plain text requested, only use plain text
          if (asPlainText) {
            html = '';
          }

          const content = parseClipboardContent(html, plainText, cleanWordFormatting);
          lastPastedContentRef.current = content;
          onPaste?.(content, asPlainText);
          return content;
        }

        return null;
      } catch (error) {
        onError?.(error as Error);
        return null;
      } finally {
        isProcessingRef.current = false;
      }
    },
    [editable, cleanWordFormatting, onPaste, onError]
  );

  /**
   * Handle copy event from DOM
   */
  const handleCopy = useCallback(
    (event: ClipboardEvent) => {
      const selection = createSelectionFromDOM();
      if (!selection) return;

      event.preventDefault();

      const content = runsToClipboardContent(selection.runs);

      if (event.clipboardData) {
        event.clipboardData.setData('text/plain', content.plainText);
        event.clipboardData.setData('text/html', content.html);
        if (content.internal) {
          event.clipboardData.setData('application/x-docx-editor', content.internal);
        }
      }

      onCopy?.(selection);
    },
    [onCopy]
  );

  /**
   * Handle cut event from DOM
   */
  const handleCut = useCallback(
    (event: ClipboardEvent) => {
      if (!editable) return;

      const selection = createSelectionFromDOM();
      if (!selection) return;

      event.preventDefault();

      const content = runsToClipboardContent(selection.runs);

      if (event.clipboardData) {
        event.clipboardData.setData('text/plain', content.plainText);
        event.clipboardData.setData('text/html', content.html);
        if (content.internal) {
          event.clipboardData.setData('application/x-docx-editor', content.internal);
        }
      }

      onCut?.(selection);
    },
    [editable, onCut]
  );

  /**
   * Handle paste event from DOM
   */
  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      if (!editable) return;

      event.preventDefault();

      const content = handlePasteEvent(event, { cleanWordFormatting });
      if (content) {
        lastPastedContentRef.current = content;
        const asPlainText = (event as unknown as KeyboardEvent).shiftKey ?? false; // Shift+V = paste as plain text
        onPaste?.(content, asPlainText);
      }
    },
    [editable, cleanWordFormatting, onPaste]
  );

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const isCtrlOrMeta = event.ctrlKey || event.metaKey;
    if (!isCtrlOrMeta) return;

    // Note: We let the native copy/cut/paste events handle the actual clipboard
    // operations. This function is for cases where we need to manually trigger.
  }, []);

  return {
    copy,
    cut,
    paste,
    handleCopy,
    handleCut,
    handlePaste,
    handleKeyDown,
    isProcessing: isProcessingRef.current,
    lastPastedContent: lastPastedContentRef.current,
  };
}

/**
 * Parse clipboard content (helper for async paste)
 */
function parseClipboardContent(
  html: string,
  plainText: string,
  cleanWordFormatting: boolean
): ParsedClipboardContent {
  const { parseClipboardHtml } = require('../utils/clipboard');
  return parseClipboardHtml(html, plainText, cleanWordFormatting);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default useClipboard;
