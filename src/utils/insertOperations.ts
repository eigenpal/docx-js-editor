/**
 * Insert Operations Utility
 *
 * Utility functions for inserting content into the document.
 * Provides functions for inserting page breaks, horizontal rules, and other elements.
 */

import type { BreakContent, Run, Paragraph, RunContent, BlockContent, Document } from '../types/document';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Insert position in the document
 */
export interface InsertPosition {
  /** Paragraph index in the document body */
  paragraphIndex: number;
  /** Run index within the paragraph (optional) */
  runIndex?: number;
  /** Character offset within the run (optional) */
  offset?: number;
}

// ============================================================================
// PAGE BREAK
// ============================================================================

/**
 * Create a page break content element
 */
export function createPageBreak(): BreakContent {
  return {
    type: 'break',
    breakType: 'page',
  };
}

/**
 * Create a column break content element
 */
export function createColumnBreak(): BreakContent {
  return {
    type: 'break',
    breakType: 'column',
  };
}

/**
 * Create a text wrapping break (line break)
 */
export function createLineBreak(clear?: 'none' | 'left' | 'right' | 'all'): BreakContent {
  return {
    type: 'break',
    breakType: 'textWrapping',
    clear,
  };
}

/**
 * Create a run containing a page break
 */
export function createPageBreakRun(): Run {
  return {
    content: [createPageBreak()],
  };
}

/**
 * Create an empty paragraph with a page break before it
 */
export function createPageBreakParagraph(): Paragraph {
  return {
    type: 'paragraph',
    runs: [],
    formatting: {
      pageBreakBefore: true,
    },
  };
}

/**
 * Insert a page break at a position in the document
 * This inserts a new paragraph with pageBreakBefore: true
 */
export function insertPageBreak(
  doc: Document,
  position: InsertPosition
): Document {
  const { paragraphIndex } = position;
  const content = [...(doc.body.content || [])];

  // Create a new paragraph with page break before
  const pageBreakParagraph = createPageBreakParagraph();

  // Insert after the specified paragraph
  content.splice(paragraphIndex + 1, 0, pageBreakParagraph);

  return {
    ...doc,
    body: {
      ...doc.body,
      content,
    },
  };
}

// ============================================================================
// HORIZONTAL RULE
// ============================================================================

/**
 * Create a horizontal rule paragraph
 * Uses a paragraph with bottom border to simulate horizontal rule
 */
export function createHorizontalRule(): Paragraph {
  return {
    type: 'paragraph',
    runs: [],
    formatting: {
      borders: {
        bottom: {
          style: 'single',
          color: { rgb: '000000' },
          width: 12, // 1.5pt
          space: 1,
        },
      },
      spacing: {
        before: 120, // 6pt
        after: 120, // 6pt
      },
    },
  };
}

/**
 * Insert a horizontal rule at a position in the document
 */
export function insertHorizontalRule(
  doc: Document,
  position: InsertPosition
): Document {
  const { paragraphIndex } = position;
  const content = [...(doc.body.content || [])];

  // Create a horizontal rule paragraph
  const hrParagraph = createHorizontalRule();

  // Insert after the specified paragraph
  content.splice(paragraphIndex + 1, 0, hrParagraph);

  return {
    ...doc,
    body: {
      ...doc.body,
      content,
    },
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if content is a page break
 */
export function isPageBreak(content: RunContent): boolean {
  return content.type === 'break' && (content as BreakContent).breakType === 'page';
}

/**
 * Check if content is a column break
 */
export function isColumnBreak(content: RunContent): boolean {
  return content.type === 'break' && (content as BreakContent).breakType === 'column';
}

/**
 * Check if content is a line break
 */
export function isLineBreak(content: RunContent): boolean {
  return content.type === 'break' && (content as BreakContent).breakType === 'textWrapping';
}

/**
 * Check if content is any type of break
 */
export function isBreakContent(content: RunContent): content is BreakContent {
  return content.type === 'break';
}

/**
 * Check if a paragraph has pageBreakBefore
 */
export function hasPageBreakBefore(paragraph: Paragraph): boolean {
  return paragraph.formatting?.pageBreakBefore === true;
}

/**
 * Count page breaks in a document
 */
export function countPageBreaks(doc: Document): number {
  let count = 0;

  for (const block of doc.body.content || []) {
    if (block.type === 'paragraph') {
      const paragraph = block as Paragraph;

      // Check for pageBreakBefore
      if (hasPageBreakBefore(paragraph)) {
        count++;
      }

      // Check for page breaks in runs
      for (const run of paragraph.runs) {
        for (const content of run.content) {
          if (isPageBreak(content)) {
            count++;
          }
        }
      }
    }
  }

  return count;
}

/**
 * Find all page break positions in a document
 */
export function findPageBreaks(doc: Document): InsertPosition[] {
  const positions: InsertPosition[] = [];

  const content = doc.body.content || [];
  for (let paragraphIndex = 0; paragraphIndex < content.length; paragraphIndex++) {
    const block = content[paragraphIndex];

    if (block.type === 'paragraph') {
      const paragraph = block as Paragraph;

      // Check for pageBreakBefore
      if (hasPageBreakBefore(paragraph)) {
        positions.push({ paragraphIndex });
      }

      // Check for page breaks in runs
      for (let runIndex = 0; runIndex < paragraph.runs.length; runIndex++) {
        const run = paragraph.runs[runIndex];
        for (const content of run.content) {
          if (isPageBreak(content)) {
            positions.push({ paragraphIndex, runIndex });
          }
        }
      }
    }
  }

  return positions;
}

/**
 * Remove a page break at a specific position
 */
export function removePageBreak(
  doc: Document,
  position: InsertPosition
): Document {
  const { paragraphIndex, runIndex } = position;
  const content = [...(doc.body.content || [])];
  const block = content[paragraphIndex];

  if (block.type !== 'paragraph') {
    return doc;
  }

  const paragraph = block as Paragraph;

  // If pageBreakBefore, remove the formatting
  if (hasPageBreakBefore(paragraph) && runIndex === undefined) {
    content[paragraphIndex] = {
      ...paragraph,
      formatting: {
        ...paragraph.formatting,
        pageBreakBefore: false,
      },
    };

    return {
      ...doc,
      body: {
        ...doc.body,
        content,
      },
    };
  }

  // If page break in run, remove it
  if (runIndex !== undefined) {
    const runs = [...paragraph.runs];
    const run = runs[runIndex];
    const newContent = run.content.filter((c) => !isPageBreak(c));

    if (newContent.length === 0) {
      // Remove the entire run if empty
      runs.splice(runIndex, 1);
    } else {
      runs[runIndex] = { ...run, content: newContent };
    }

    content[paragraphIndex] = { ...paragraph, runs };

    return {
      ...doc,
      body: {
        ...doc.body,
        content,
      },
    };
  }

  return doc;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createPageBreak,
  createColumnBreak,
  createLineBreak,
  createPageBreakRun,
  createPageBreakParagraph,
  insertPageBreak,
  createHorizontalRule,
  insertHorizontalRule,
  isPageBreak,
  isColumnBreak,
  isLineBreak,
  isBreakContent,
  hasPageBreakBefore,
  countPageBreaks,
  findPageBreaks,
  removePageBreak,
};
