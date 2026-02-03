/**
 * Shared Text Utilities for Agent Module
 *
 * Common text extraction and manipulation utilities used by
 * context.ts, selectionContext.ts, and other agent-related code.
 *
 * Consolidates duplicated helper functions into a single location.
 */

import type {
  DocumentBody,
  Paragraph,
  Run,
  Hyperlink,
  Table,
  TextFormatting,
} from '../types/document';

import type { Position } from '../types/agentApi';

// ============================================================================
// TEXT EXTRACTION
// ============================================================================

/**
 * Get plain text from a paragraph
 */
export function getParagraphText(paragraph: Paragraph): string {
  const texts: string[] = [];

  for (const item of paragraph.content) {
    if (item.type === 'run') {
      texts.push(getRunText(item));
    } else if (item.type === 'hyperlink') {
      texts.push(getHyperlinkText(item));
    }
  }

  return texts.join('');
}

/**
 * Get plain text from a run
 */
export function getRunText(run: Run): string {
  return run.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { type: 'text'; text: string }).text)
    .join('');
}

/**
 * Get plain text from a hyperlink
 */
export function getHyperlinkText(hyperlink: Hyperlink): string {
  const texts: string[] = [];
  for (const child of hyperlink.children) {
    if (child.type === 'run') {
      texts.push(getRunText(child));
    }
  }
  return texts.join('');
}

/**
 * Get plain text from a table
 */
export function getTableText(table: Table): string {
  const texts: string[] = [];

  for (const row of table.rows) {
    for (const cell of row.cells) {
      for (const block of cell.content) {
        if (block.type === 'paragraph') {
          texts.push(getParagraphText(block));
        }
      }
    }
  }

  return texts.join('\t');
}

/**
 * Get plain text from document body
 */
export function getBodyText(body: DocumentBody): string {
  const texts: string[] = [];

  for (const block of body.content) {
    if (block.type === 'paragraph') {
      texts.push(getParagraphText(block));
    } else if (block.type === 'table') {
      texts.push(getTableText(block));
    }
  }

  return texts.join('\n');
}

// ============================================================================
// WORD COUNTING
// ============================================================================

/**
 * Count words in text
 */
export function countWords(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  return words.length;
}

/**
 * Count characters in text
 */
export function countCharacters(text: string, includeSpaces = true): number {
  if (includeSpaces) {
    return text.length;
  }
  return text.replace(/\s/g, '').length;
}

/**
 * Get word count from document body
 */
export function getBodyWordCount(body: DocumentBody): number {
  let count = 0;
  for (const block of body.content) {
    if (block.type === 'paragraph') {
      count += countWords(getParagraphText(block));
    } else if (block.type === 'table') {
      count += getTableWordCount(block);
    }
  }
  return count;
}

/**
 * Get word count from table
 */
export function getTableWordCount(table: Table): number {
  let count = 0;
  for (const row of table.rows) {
    for (const cell of row.cells) {
      for (const block of cell.content) {
        if (block.type === 'paragraph') {
          count += countWords(getParagraphText(block));
        }
      }
    }
  }
  return count;
}

/**
 * Get character count from document body
 */
export function getBodyCharacterCount(body: DocumentBody): number {
  let count = 0;
  for (const block of body.content) {
    if (block.type === 'paragraph') {
      count += getParagraphText(block).length;
    } else if (block.type === 'table') {
      count += getTableCharacterCount(block);
    }
  }
  return count;
}

/**
 * Get character count from table
 */
export function getTableCharacterCount(table: Table): number {
  let count = 0;
  for (const row of table.rows) {
    for (const cell of row.cells) {
      for (const block of cell.content) {
        if (block.type === 'paragraph') {
          count += getParagraphText(block).length;
        }
      }
    }
  }
  return count;
}

// ============================================================================
// CONTEXT EXTRACTION
// ============================================================================

/**
 * Get text before a position
 *
 * @param paragraphs - Array of paragraphs
 * @param position - Position to get text before
 * @param maxChars - Maximum characters to return
 * @returns Text before the position
 */
export function getTextBefore(
  paragraphs: Paragraph[],
  position: Position,
  maxChars: number
): string {
  const texts: string[] = [];
  let totalChars = 0;

  // Text before offset in current paragraph
  const currentPara = paragraphs[position.paragraphIndex];
  if (currentPara) {
    const text = getParagraphText(currentPara);
    const beforeText = text.slice(0, position.offset);
    texts.unshift(beforeText);
    totalChars += beforeText.length;
  }

  // Text from previous paragraphs
  for (let i = position.paragraphIndex - 1; i >= 0 && totalChars < maxChars; i--) {
    const para = paragraphs[i];
    if (!para) continue;
    const text = getParagraphText(para);
    texts.unshift(text);
    totalChars += text.length;
  }

  const combined = texts.join('\n');
  if (combined.length > maxChars) {
    return '...' + combined.slice(-maxChars);
  }
  return combined;
}

/**
 * Get text after a position
 *
 * @param paragraphs - Array of paragraphs
 * @param position - Position to get text after
 * @param maxChars - Maximum characters to return
 * @returns Text after the position
 */
export function getTextAfter(
  paragraphs: Paragraph[],
  position: Position,
  maxChars: number
): string {
  const texts: string[] = [];
  let totalChars = 0;

  // Text after offset in current paragraph
  const currentPara = paragraphs[position.paragraphIndex];
  if (currentPara) {
    const text = getParagraphText(currentPara);
    const afterText = text.slice(position.offset);
    texts.push(afterText);
    totalChars += afterText.length;
  }

  // Text from following paragraphs
  for (let i = position.paragraphIndex + 1; i < paragraphs.length && totalChars < maxChars; i++) {
    const para = paragraphs[i];
    if (!para) continue;
    const text = getParagraphText(para);
    texts.push(text);
    totalChars += text.length;
  }

  const combined = texts.join('\n');
  if (combined.length > maxChars) {
    return combined.slice(0, maxChars) + '...';
  }
  return combined;
}

// ============================================================================
// FORMATTING QUERIES
// ============================================================================

/**
 * Get formatting at a specific position in a paragraph
 *
 * @param paragraph - The paragraph to check
 * @param offset - Character offset in the paragraph
 * @returns Formatting at that position
 */
export function getFormattingAtPosition(
  paragraph: Paragraph,
  offset: number
): Partial<TextFormatting> {
  let currentOffset = 0;

  for (const item of paragraph.content) {
    if (item.type === 'run') {
      const text = getRunText(item);
      const runEnd = currentOffset + text.length;

      if (offset >= currentOffset && offset < runEnd) {
        return item.formatting || {};
      }

      currentOffset = runEnd;
    } else if (item.type === 'hyperlink') {
      const text = getHyperlinkText(item);
      const linkEnd = currentOffset + text.length;

      if (offset >= currentOffset && offset < linkEnd) {
        // Return formatting from first child run
        for (const child of item.children) {
          if (child.type === 'run') {
            return child.formatting || {};
          }
        }
      }

      currentOffset = linkEnd;
    }
  }

  return {};
}

/**
 * Check if position is within a hyperlink
 *
 * @param paragraph - The paragraph to check
 * @param offset - Character offset in the paragraph
 * @returns True if position is in a hyperlink
 */
export function isPositionInHyperlink(paragraph: Paragraph, offset: number): boolean {
  let currentOffset = 0;

  for (const item of paragraph.content) {
    if (item.type === 'run') {
      const text = getRunText(item);
      currentOffset += text.length;
    } else if (item.type === 'hyperlink') {
      const text = getHyperlinkText(item);
      const linkStart = currentOffset;
      const linkEnd = currentOffset + text.length;

      if (offset >= linkStart && offset < linkEnd) {
        return true;
      }

      currentOffset = linkEnd;
    }
  }

  return false;
}

/**
 * Get hyperlink at position
 *
 * @param paragraph - The paragraph to check
 * @param offset - Character offset in the paragraph
 * @returns The hyperlink at that position, or undefined
 */
export function getHyperlinkAtPosition(
  paragraph: Paragraph,
  offset: number
): Hyperlink | undefined {
  let currentOffset = 0;

  for (const item of paragraph.content) {
    if (item.type === 'run') {
      const text = getRunText(item);
      currentOffset += text.length;
    } else if (item.type === 'hyperlink') {
      const text = getHyperlinkText(item);
      const linkStart = currentOffset;
      const linkEnd = currentOffset + text.length;

      if (offset >= linkStart && offset < linkEnd) {
        return item;
      }

      currentOffset = linkEnd;
    }
  }

  return undefined;
}

// ============================================================================
// STYLE HELPERS
// ============================================================================

/**
 * Check if style ID represents a heading
 *
 * @param styleId - Style ID to check
 * @returns True if it's a heading style
 */
export function isHeadingStyle(styleId?: string): boolean {
  if (!styleId) return false;
  return styleId.toLowerCase().includes('heading');
}

/**
 * Parse heading level from style ID
 *
 * @param styleId - Style ID to parse
 * @returns Heading level (1-9) or undefined
 */
export function parseHeadingLevel(styleId?: string): number | undefined {
  if (!styleId) return undefined;
  const match = styleId.match(/heading\s*(\d)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return undefined;
}

// ============================================================================
// DOCUMENT QUERIES
// ============================================================================

/**
 * Check if document body has images
 *
 * @param body - Document body to check
 * @returns True if contains images
 */
export function hasImages(body: DocumentBody): boolean {
  for (const block of body.content) {
    if (block.type === 'paragraph') {
      for (const item of block.content) {
        if (item.type === 'run') {
          for (const content of item.content) {
            if (content.type === 'drawing') {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

/**
 * Check if document body has hyperlinks
 *
 * @param body - Document body to check
 * @returns True if contains hyperlinks
 */
export function hasHyperlinks(body: DocumentBody): boolean {
  for (const block of body.content) {
    if (block.type === 'paragraph') {
      for (const item of block.content) {
        if (item.type === 'hyperlink') {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Check if document body has tables
 *
 * @param body - Document body to check
 * @returns True if contains tables
 */
export function hasTables(body: DocumentBody): boolean {
  return body.content.some((block) => block.type === 'table');
}

// ============================================================================
// PARAGRAPH HELPERS
// ============================================================================

/**
 * Get all paragraphs from document body
 *
 * @param body - Document body
 * @returns Array of paragraphs
 */
export function getParagraphs(body: DocumentBody): Paragraph[] {
  return body.content.filter((block): block is Paragraph => block.type === 'paragraph');
}

/**
 * Get paragraph at index from document body
 *
 * @param body - Document body
 * @param index - Paragraph index (0-indexed)
 * @returns Paragraph or undefined
 */
export function getParagraphAtIndex(body: DocumentBody, index: number): Paragraph | undefined {
  const paragraphs = getParagraphs(body);
  return paragraphs[index];
}

/**
 * Get block index for a paragraph index
 *
 * @param body - Document body
 * @param paragraphIndex - Paragraph index
 * @returns Block index or -1 if not found
 */
export function getBlockIndexForParagraph(body: DocumentBody, paragraphIndex: number): number {
  let currentParagraphIndex = 0;
  for (let i = 0; i < body.content.length; i++) {
    if (body.content[i].type === 'paragraph') {
      if (currentParagraphIndex === paragraphIndex) {
        return i;
      }
      currentParagraphIndex++;
    }
  }
  return -1;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getParagraphText,
  getRunText,
  getHyperlinkText,
  getTableText,
  getBodyText,
  countWords,
  countCharacters,
  getBodyWordCount,
  getBodyCharacterCount,
  getTextBefore,
  getTextAfter,
  getFormattingAtPosition,
  isPositionInHyperlink,
  getHyperlinkAtPosition,
  isHeadingStyle,
  parseHeadingLevel,
  hasImages,
  hasHyperlinks,
  hasTables,
  getParagraphs,
  getParagraphAtIndex,
  getBlockIndexForParagraph,
};
