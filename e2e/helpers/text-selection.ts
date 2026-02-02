/**
 * Text Selection Utilities for Playwright Tests
 *
 * Handles text selection in contenteditable elements via JavaScript evaluation.
 * These utilities are designed to work with the editor's DOM structure.
 */

import { Page } from '@playwright/test';

/**
 * Position within a text node
 */
export interface TextPosition {
  /** Paragraph index (data-paragraph-index) */
  paragraphIndex: number;
  /** Character offset within the paragraph */
  offset: number;
}

/**
 * A range of text selection
 */
export interface TextRange {
  start: TextPosition;
  end: TextPosition;
}

/**
 * Selection information returned from the page
 */
export interface SelectionInfo {
  /** The selected text */
  text: string;
  /** Whether there's an active selection (not collapsed) */
  hasSelection: boolean;
  /** Start position of selection */
  startOffset: number;
  /** End position of selection */
  endOffset: number;
  /** Paragraph index where selection starts */
  startParagraphIndex: number | null;
  /** Paragraph index where selection ends */
  endParagraphIndex: number | null;
}

/**
 * Get current selection information from the page
 */
export async function getSelectionInfo(page: Page): Promise<SelectionInfo> {
  return await page.evaluate(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return {
        text: '',
        hasSelection: false,
        startOffset: 0,
        endOffset: 0,
        startParagraphIndex: null,
        endParagraphIndex: null,
      };
    }

    const range = selection.getRangeAt(0);
    const text = selection.toString();

    // Find paragraph indices
    const findParagraphIndex = (node: Node | null): number | null => {
      let current = node;
      while (current) {
        if (current instanceof HTMLElement && current.hasAttribute('data-paragraph-index')) {
          return parseInt(current.getAttribute('data-paragraph-index') || '0', 10);
        }
        current = current.parentNode;
      }
      return null;
    };

    return {
      text,
      hasSelection: !range.collapsed,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      startParagraphIndex: findParagraphIndex(range.startContainer),
      endParagraphIndex: findParagraphIndex(range.endContainer),
    };
  });
}

/**
 * Select text by searching for it in the document
 * Returns true if text was found and selected
 */
export async function selectTextBySearch(page: Page, searchText: string): Promise<boolean> {
  return await page.evaluate((text) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const content = node.textContent || '';
      const index = content.indexOf(text);
      if (index !== -1) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + text.length);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        return true;
      }
    }
    return false;
  }, searchText);
}

/**
 * Select all text within a specific paragraph
 */
export async function selectParagraph(page: Page, paragraphIndex: number): Promise<boolean> {
  return await page.evaluate((pIndex) => {
    const paragraph = document.querySelector(`[data-paragraph-index="${pIndex}"]`);
    if (!paragraph) return false;

    const range = document.createRange();
    range.selectNodeContents(paragraph);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return true;
  }, paragraphIndex);
}

/**
 * Select a range of text within a paragraph by character offsets
 */
export async function selectRangeInParagraph(
  page: Page,
  paragraphIndex: number,
  startOffset: number,
  endOffset: number
): Promise<boolean> {
  return await page.evaluate(
    ({ pIndex, start, end }) => {
      const paragraph = document.querySelector(`[data-paragraph-index="${pIndex}"]`);
      if (!paragraph) return false;

      // Walk through text nodes to find the correct positions
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT, null);

      let currentOffset = 0;
      let startNode: Node | null = null;
      let startNodeOffset = 0;
      let endNode: Node | null = null;
      let endNodeOffset = 0;

      let textNode: Text | null;
      while ((textNode = walker.nextNode() as Text | null)) {
        const nodeLength = textNode.textContent?.length || 0;

        // Find start position
        if (!startNode && currentOffset + nodeLength > start) {
          startNode = textNode;
          startNodeOffset = start - currentOffset;
        }

        // Find end position
        if (!endNode && currentOffset + nodeLength >= end) {
          endNode = textNode;
          endNodeOffset = end - currentOffset;
          break;
        }

        currentOffset += nodeLength;
      }

      if (!startNode || !endNode) return false;

      const range = document.createRange();
      range.setStart(startNode, startNodeOffset);
      range.setEnd(endNode, endNodeOffset);

      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return true;
    },
    { pIndex: paragraphIndex, start: startOffset, end: endOffset }
  );
}

/**
 * Select text across multiple paragraphs
 */
export async function selectAcrossParagraphs(
  page: Page,
  startParagraph: number,
  startOffset: number,
  endParagraph: number,
  endOffset: number
): Promise<boolean> {
  return await page.evaluate(
    ({ startP, startOff, endP, endOff }) => {
      const startParagraphEl = document.querySelector(`[data-paragraph-index="${startP}"]`);
      const endParagraphEl = document.querySelector(`[data-paragraph-index="${endP}"]`);

      if (!startParagraphEl || !endParagraphEl) return false;

      // Helper to find text node at offset
      const findNodeAtOffset = (
        container: Element,
        offset: number
      ): { node: Node; offset: number } | null => {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);

        let currentOffset = 0;
        let textNode: Text | null;

        while ((textNode = walker.nextNode() as Text | null)) {
          const nodeLength = textNode.textContent?.length || 0;
          if (currentOffset + nodeLength >= offset) {
            return {
              node: textNode,
              offset: offset - currentOffset,
            };
          }
          currentOffset += nodeLength;
        }

        return null;
      };

      const startInfo = findNodeAtOffset(startParagraphEl, startOff);
      const endInfo = findNodeAtOffset(endParagraphEl, endOff);

      if (!startInfo || !endInfo) return false;

      const range = document.createRange();
      range.setStart(startInfo.node, startInfo.offset);
      range.setEnd(endInfo.node, endInfo.offset);

      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return true;
    },
    { startP: startParagraph, startOff: startOffset, endP: endParagraph, endOff: endOffset }
  );
}

/**
 * Clear the current selection
 */
export async function clearSelection(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.getSelection()?.removeAllRanges();
  });
}

/**
 * Collapse selection to start
 */
export async function collapseToStart(page: Page): Promise<void> {
  await page.evaluate(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selection.collapseToStart();
    }
  });
}

/**
 * Collapse selection to end
 */
export async function collapseToEnd(page: Page): Promise<void> {
  await page.evaluate(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selection.collapseToEnd();
    }
  });
}

/**
 * Move cursor to the start of a paragraph
 */
export async function moveCursorToStart(page: Page, paragraphIndex: number): Promise<boolean> {
  return await page.evaluate((pIndex) => {
    const paragraph = document.querySelector(`[data-paragraph-index="${pIndex}"]`);
    if (!paragraph) return false;

    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT, null);

    const firstTextNode = walker.nextNode();
    if (!firstTextNode) return false;

    const range = document.createRange();
    range.setStart(firstTextNode, 0);
    range.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return true;
  }, paragraphIndex);
}

/**
 * Move cursor to the end of a paragraph
 */
export async function moveCursorToEnd(page: Page, paragraphIndex: number): Promise<boolean> {
  return await page.evaluate((pIndex) => {
    const paragraph = document.querySelector(`[data-paragraph-index="${pIndex}"]`);
    if (!paragraph) return false;

    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT, null);

    let lastTextNode: Text | null = null;
    let textNode: Text | null;
    while ((textNode = walker.nextNode() as Text | null)) {
      lastTextNode = textNode;
    }

    if (!lastTextNode) return false;

    const range = document.createRange();
    range.setStart(lastTextNode, lastTextNode.textContent?.length || 0);
    range.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return true;
  }, paragraphIndex);
}

/**
 * Move cursor to a specific offset within a paragraph
 */
export async function moveCursorToOffset(
  page: Page,
  paragraphIndex: number,
  offset: number
): Promise<boolean> {
  return await selectRangeInParagraph(page, paragraphIndex, offset, offset);
}

/**
 * Extend selection by word (Shift+Ctrl+Right/Left)
 */
export async function extendSelectionByWord(
  page: Page,
  direction: 'left' | 'right'
): Promise<void> {
  const modifier = process.platform === 'darwin' ? 'Alt' : 'Control';
  await page.keyboard.press(`Shift+${modifier}+Arrow${direction === 'left' ? 'Left' : 'Right'}`);
}

/**
 * Extend selection by character (Shift+Right/Left)
 */
export async function extendSelectionByCharacter(
  page: Page,
  direction: 'left' | 'right',
  count: number = 1
): Promise<void> {
  for (let i = 0; i < count; i++) {
    await page.keyboard.press(`Shift+Arrow${direction === 'left' ? 'Left' : 'Right'}`);
  }
}

/**
 * Extend selection by line (Shift+Up/Down)
 */
export async function extendSelectionByLine(
  page: Page,
  direction: 'up' | 'down',
  count: number = 1
): Promise<void> {
  for (let i = 0; i < count; i++) {
    await page.keyboard.press(`Shift+Arrow${direction === 'up' ? 'Up' : 'Down'}`);
  }
}

/**
 * Select word at cursor (double-click equivalent)
 */
export async function selectWordAtCursor(page: Page): Promise<void> {
  await page.evaluate(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!range.collapsed) return;

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent || '';
    let start = range.startOffset;
    let end = range.startOffset;

    // Find word boundaries
    while (start > 0 && /\w/.test(text[start - 1])) start--;
    while (end < text.length && /\w/.test(text[end])) end++;

    const newRange = document.createRange();
    newRange.setStart(node, start);
    newRange.setEnd(node, end);

    selection.removeAllRanges();
    selection.addRange(newRange);
  });
}

/**
 * Triple-click to select paragraph
 */
export async function tripleClick(page: Page, selector: string): Promise<void> {
  await page.locator(selector).click({ clickCount: 3 });
}

/**
 * Double-click to select word
 */
export async function doubleClick(page: Page, selector: string): Promise<void> {
  await page.locator(selector).dblclick();
}

/**
 * Get paragraph text content
 */
export async function getParagraphText(page: Page, paragraphIndex: number): Promise<string> {
  return await page.evaluate((pIndex) => {
    const paragraph = document.querySelector(`[data-paragraph-index="${pIndex}"]`);
    return paragraph?.textContent || '';
  }, paragraphIndex);
}

/**
 * Get the count of paragraphs in the document
 */
export async function getParagraphCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    return document.querySelectorAll('[data-paragraph-index]').length;
  });
}

/**
 * Check if a text range has specific formatting
 */
export async function checkFormattingAtSelection(page: Page): Promise<{
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  fontFamily: string;
  fontSize: string;
  color: string;
}> {
  return await page.evaluate(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return {
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        fontFamily: '',
        fontSize: '',
        color: '',
      };
    }

    const range = selection.getRangeAt(0);
    let element = range.commonAncestorContainer;
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement!;
    }

    const style = window.getComputedStyle(element as Element);

    return {
      bold: style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 700,
      italic: style.fontStyle === 'italic',
      underline: style.textDecoration.includes('underline'),
      strikethrough: style.textDecoration.includes('line-through'),
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      color: style.color,
    };
  });
}
