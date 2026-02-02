/**
 * Selection Context Builder
 *
 * Builds rich context objects from document selections for AI operations.
 * Includes selected text, formatting, surrounding context, and suggested actions.
 */

import type {
  Document,
  DocumentBody,
  Paragraph,
  Table,
  Run,
  Hyperlink,
  TextFormatting,
  ParagraphFormatting,
  BlockContent,
} from '../types/document';

import type {
  SelectionContext,
  ParagraphContext,
  SuggestedAction,
  Range,
  Position,
  AIAction,
} from '../types/agentApi';

import { getAgentContext, getDocumentSummary } from './context';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for building selection context
 */
export interface SelectionContextOptions {
  /** Characters of context before selection (default: 200) */
  contextCharsBefore?: number;
  /** Characters of context after selection (default: 200) */
  contextCharsAfter?: number;
  /** Include suggested actions (default: true) */
  includeSuggestions?: boolean;
  /** Include document summary (default: true) */
  includeDocumentSummary?: boolean;
  /** Maximum suggested actions (default: 8) */
  maxSuggestions?: number;
}

/**
 * Extended selection context with additional details
 */
export interface ExtendedSelectionContext extends SelectionContext {
  /** Document summary for additional context */
  documentSummary?: string;
  /** Selection word count */
  wordCount?: number;
  /** Selection character count */
  characterCount?: number;
  /** Is selection multi-paragraph */
  isMultiParagraph?: boolean;
  /** Selected paragraph indices */
  paragraphIndices?: number[];
  /** Language detection hint */
  detectedLanguage?: string;
  /** Content type hints */
  contentType?: 'prose' | 'list' | 'heading' | 'table' | 'mixed';
}

/**
 * Selection formatting summary
 */
export interface FormattingSummary {
  /** Predominant formatting */
  predominant: Partial<TextFormatting>;
  /** Is formatting consistent across selection */
  isConsistent: boolean;
  /** All formatting found */
  allFormatting: Partial<TextFormatting>[];
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Build selection context for AI operations
 *
 * @param doc - The parsed document
 * @param range - The selected range
 * @param options - Selection context options
 * @returns SelectionContext object
 */
export function buildSelectionContext(
  doc: Document,
  range: Range,
  options: SelectionContextOptions = {}
): SelectionContext {
  const {
    contextCharsBefore = 200,
    contextCharsAfter = 200,
    includeSuggestions = true,
  } = options;

  const body = doc.package.document;
  const paragraphs = body.content.filter(
    (block): block is Paragraph => block.type === 'paragraph'
  );

  // Validate range
  if (range.start.paragraphIndex >= paragraphs.length) {
    throw new Error(`Invalid start paragraph index: ${range.start.paragraphIndex}`);
  }

  const startParagraph = paragraphs[range.start.paragraphIndex];
  const endParagraph = paragraphs[range.end.paragraphIndex] || startParagraph;

  // Extract selected text
  const selectedText = extractSelectedText(paragraphs, range);

  // Get context before and after
  const textBefore = getTextBefore(paragraphs, range.start, contextCharsBefore);
  const textAfter = getTextAfter(paragraphs, range.end, contextCharsAfter);

  // Get formatting at selection start
  const formatting = getFormattingAtPosition(startParagraph, range.start.offset);
  const paragraphFormatting = startParagraph.formatting || {};

  // Build paragraph context
  const paragraphContext: ParagraphContext = {
    index: range.start.paragraphIndex,
    fullText: getParagraphText(startParagraph),
    style: startParagraph.formatting?.styleId,
    wordCount: countWords(getParagraphText(startParagraph)),
  };

  // Check special contexts
  const inTable = isPositionInTable(body, range.start);
  const inHyperlink = isPositionInHyperlink(startParagraph, range.start.offset);

  // Build suggested actions
  const suggestedActions = includeSuggestions
    ? getSuggestedActions(selectedText, formatting, paragraphContext)
    : [];

  return {
    selectedText,
    range,
    formatting,
    paragraphFormatting,
    textBefore,
    textAfter,
    paragraph: paragraphContext,
    inTable,
    inHyperlink,
    suggestedActions,
  };
}

/**
 * Build extended selection context with additional details
 *
 * @param doc - The parsed document
 * @param range - The selected range
 * @param options - Selection context options
 * @returns ExtendedSelectionContext object
 */
export function buildExtendedSelectionContext(
  doc: Document,
  range: Range,
  options: SelectionContextOptions = {}
): ExtendedSelectionContext {
  const baseContext = buildSelectionContext(doc, range, options);

  const { includeDocumentSummary = true } = options;

  const body = doc.package.document;
  const paragraphs = body.content.filter(
    (block): block is Paragraph => block.type === 'paragraph'
  );

  // Calculate additional stats
  const wordCount = countWords(baseContext.selectedText);
  const characterCount = baseContext.selectedText.length;
  const isMultiParagraph = range.start.paragraphIndex !== range.end.paragraphIndex;

  // Get paragraph indices
  const paragraphIndices: number[] = [];
  for (let i = range.start.paragraphIndex; i <= range.end.paragraphIndex; i++) {
    paragraphIndices.push(i);
  }

  // Detect content type
  const contentType = detectContentType(paragraphs, range);

  // Get document summary if requested
  const documentSummary = includeDocumentSummary ? getDocumentSummary(doc) : undefined;

  // Detect language (simple heuristic)
  const detectedLanguage = detectLanguage(baseContext.selectedText);

  return {
    ...baseContext,
    documentSummary,
    wordCount,
    characterCount,
    isMultiParagraph,
    paragraphIndices,
    detectedLanguage,
    contentType,
  };
}

/**
 * Get formatting summary for a selection
 *
 * @param doc - The parsed document
 * @param range - The selected range
 * @returns FormattingSummary object
 */
export function getSelectionFormattingSummary(
  doc: Document,
  range: Range
): FormattingSummary {
  const body = doc.package.document;
  const paragraphs = body.content.filter(
    (block): block is Paragraph => block.type === 'paragraph'
  );

  const allFormatting: Partial<TextFormatting>[] = [];

  for (let paraIdx = range.start.paragraphIndex; paraIdx <= range.end.paragraphIndex; paraIdx++) {
    const paragraph = paragraphs[paraIdx];
    if (!paragraph) continue;

    const startOffset = paraIdx === range.start.paragraphIndex ? range.start.offset : 0;
    const endOffset = paraIdx === range.end.paragraphIndex ? range.end.offset : Infinity;

    collectFormattingInRange(paragraph, startOffset, endOffset, allFormatting);
  }

  // Check if formatting is consistent
  const isConsistent = allFormatting.length <= 1 ||
    allFormatting.every((f) => formatEqual(f, allFormatting[0]));

  // Get predominant formatting (first one or merge)
  const predominant = allFormatting.length > 0 ? allFormatting[0] : {};

  return {
    predominant,
    isConsistent,
    allFormatting,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract selected text from paragraphs
 */
function extractSelectedText(paragraphs: Paragraph[], range: Range): string {
  if (range.start.paragraphIndex === range.end.paragraphIndex) {
    const paragraph = paragraphs[range.start.paragraphIndex];
    if (!paragraph) return '';
    const text = getParagraphText(paragraph);
    return text.slice(range.start.offset, range.end.offset);
  }

  const texts: string[] = [];
  for (let i = range.start.paragraphIndex; i <= range.end.paragraphIndex; i++) {
    const paragraph = paragraphs[i];
    if (!paragraph) continue;
    const text = getParagraphText(paragraph);

    if (i === range.start.paragraphIndex) {
      texts.push(text.slice(range.start.offset));
    } else if (i === range.end.paragraphIndex) {
      texts.push(text.slice(0, range.end.offset));
    } else {
      texts.push(text);
    }
  }

  return texts.join('\n');
}

/**
 * Get text before a position
 */
function getTextBefore(
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
 */
function getTextAfter(
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

/**
 * Get formatting at a specific position
 */
function getFormattingAtPosition(
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
 * Collect formatting in a range within a paragraph
 */
function collectFormattingInRange(
  paragraph: Paragraph,
  startOffset: number,
  endOffset: number,
  result: Partial<TextFormatting>[]
): void {
  let currentOffset = 0;

  for (const item of paragraph.content) {
    if (item.type === 'run') {
      const text = getRunText(item);
      const runStart = currentOffset;
      const runEnd = currentOffset + text.length;

      // Check if run overlaps with range
      if (runEnd > startOffset && runStart < endOffset) {
        if (item.formatting) {
          result.push({ ...item.formatting });
        }
      }

      currentOffset = runEnd;
    } else if (item.type === 'hyperlink') {
      const text = getHyperlinkText(item);
      const linkStart = currentOffset;
      const linkEnd = currentOffset + text.length;

      if (linkEnd > startOffset && linkStart < endOffset) {
        for (const child of item.children) {
          if (child.type === 'run' && child.formatting) {
            result.push({ ...child.formatting });
          }
        }
      }

      currentOffset = linkEnd;
    }
  }
}

/**
 * Check if position is in a table
 */
function isPositionInTable(body: DocumentBody, position: Position): boolean {
  // Tables are block-level, so position in a table would be in cell paragraphs
  // For now, return false - full implementation would track paragraph sources
  return false;
}

/**
 * Check if position is in a hyperlink
 */
function isPositionInHyperlink(paragraph: Paragraph, offset: number): boolean {
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
 * Get suggested actions based on selection
 */
function getSuggestedActions(
  selectedText: string,
  formatting: Partial<TextFormatting>,
  paragraphContext: ParagraphContext
): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  if (!selectedText || selectedText.trim().length === 0) {
    return actions;
  }

  // Basic actions for any text
  actions.push(
    { id: 'askAI', label: 'Ask AI', description: 'Ask AI about this text', priority: 11 },
    { id: 'rewrite', label: 'Rewrite', description: 'Rewrite this text differently', priority: 10 }
  );

  // Length-based suggestions
  const wordCount = countWords(selectedText);

  if (wordCount > 50) {
    actions.push({
      id: 'summarize',
      label: 'Summarize',
      description: 'Create a shorter version',
      priority: 9,
    });
  }

  if (wordCount < 20) {
    actions.push({
      id: 'expand',
      label: 'Expand',
      description: 'Add more details',
      priority: 9,
    });
  }

  // Always useful
  actions.push(
    { id: 'fixGrammar', label: 'Fix Grammar', description: 'Fix grammar and spelling', priority: 7 },
    { id: 'translate', label: 'Translate', description: 'Translate to another language', priority: 6 },
    { id: 'explain', label: 'Explain', description: 'Explain what this means', priority: 5 }
  );

  // Tone adjustments
  actions.push(
    { id: 'makeFormal', label: 'Make Formal', description: 'Use formal tone', priority: 4 },
    { id: 'makeCasual', label: 'Make Casual', description: 'Use casual tone', priority: 3 }
  );

  // Sort by priority
  actions.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  return actions;
}

/**
 * Detect content type of selection
 */
function detectContentType(
  paragraphs: Paragraph[],
  range: Range
): 'prose' | 'list' | 'heading' | 'table' | 'mixed' {
  const types = new Set<string>();

  for (let i = range.start.paragraphIndex; i <= range.end.paragraphIndex; i++) {
    const para = paragraphs[i];
    if (!para) continue;

    if (para.listRendering?.isListItem) {
      types.add('list');
    } else if (para.formatting?.styleId?.toLowerCase().includes('heading')) {
      types.add('heading');
    } else {
      types.add('prose');
    }
  }

  if (types.size > 1) return 'mixed';
  if (types.has('list')) return 'list';
  if (types.has('heading')) return 'heading';
  return 'prose';
}

/**
 * Simple language detection
 */
function detectLanguage(text: string): string | undefined {
  // Very simple heuristic - in practice use a library
  if (/[а-яА-ЯёЁ]/.test(text)) return 'ru';
  if (/[一-龯]/.test(text)) return 'zh';
  if (/[ひらがなカタカナ]/.test(text) || /[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja';
  if (/[가-힣]/.test(text)) return 'ko';
  if (/[àâäéèêëïîôùûüç]/i.test(text)) return 'fr';
  if (/[äöüß]/i.test(text)) return 'de';
  if (/[áéíóúñ]/i.test(text)) return 'es';
  return 'en'; // Default
}

/**
 * Get plain text from paragraph
 */
function getParagraphText(paragraph: Paragraph): string {
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
 * Get plain text from run
 */
function getRunText(run: Run): string {
  return run.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { type: 'text'; text: string }).text)
    .join('');
}

/**
 * Get plain text from hyperlink
 */
function getHyperlinkText(hyperlink: Hyperlink): string {
  const texts: string[] = [];
  for (const child of hyperlink.children) {
    if (child.type === 'run') {
      texts.push(getRunText(child));
    }
  }
  return texts.join('');
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Check if two formatting objects are equal
 */
function formatEqual(
  a: Partial<TextFormatting>,
  b: Partial<TextFormatting>
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) => {
    const valA = (a as Record<string, unknown>)[key];
    const valB = (b as Record<string, unknown>)[key];
    return valA === valB;
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  buildSelectionContext as default,
  extractSelectedText,
  getTextBefore,
  getTextAfter,
  getFormattingAtPosition,
  getSuggestedActions,
  detectContentType,
  detectLanguage,
  countWords,
};
