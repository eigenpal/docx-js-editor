/**
 * Insert Operations Utility
 *
 * Utility functions for inserting content into the document.
 * Provides functions for inserting page breaks, horizontal rules, and other elements.
 */

import type {
  BreakContent,
  Run,
  Paragraph,
  Document,
  ParagraphContent,
  RunContent,
} from '../types/document';

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
    type: 'run',
    content: [createPageBreak()],
  };
}

/**
 * Create an empty paragraph with a page break before it
 */
export function createPageBreakParagraph(): Paragraph {
  return {
    type: 'paragraph',
    content: [],
    formatting: {
      pageBreakBefore: true,
    },
  };
}

/**
 * Get runs from paragraph content
 */
function getParagraphRuns(paragraph: Paragraph): Run[] {
  return paragraph.content.filter((item): item is Run => item.type === 'run');
}

/**
 * Insert a page break at a position in the document
 * This inserts a new paragraph with pageBreakBefore: true
 */
export function insertPageBreak(doc: Document, position: InsertPosition): Document {
  const { paragraphIndex } = position;
  const content = [...(doc.package.document.content || [])];

  // Create a new paragraph with page break before
  const pageBreakParagraph = createPageBreakParagraph();

  // Insert after the specified paragraph
  content.splice(paragraphIndex + 1, 0, pageBreakParagraph);

  return {
    ...doc,
    package: {
      ...doc.package,
      document: {
        ...doc.package.document,
        content,
      },
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
    content: [],
    formatting: {
      borders: {
        bottom: {
          style: 'single',
          color: { rgb: '000000' },
          size: 12, // 1.5pt
          space: 1,
        },
      },
      spaceBefore: 120, // 6pt
      spaceAfter: 120, // 6pt
    },
  };
}

/**
 * Insert a horizontal rule at a position in the document
 */
export function insertHorizontalRule(doc: Document, position: InsertPosition): Document {
  const { paragraphIndex } = position;
  const content = [...(doc.package.document.content || [])];

  // Create a horizontal rule paragraph
  const hrParagraph = createHorizontalRule();

  // Insert after the specified paragraph
  content.splice(paragraphIndex + 1, 0, hrParagraph);

  return {
    ...doc,
    package: {
      ...doc.package,
      document: {
        ...doc.package.document,
        content,
      },
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

  for (const block of doc.package.document.content || []) {
    if (block.type === 'paragraph') {
      const paragraph = block as Paragraph;

      // Check for pageBreakBefore
      if (hasPageBreakBefore(paragraph)) {
        count++;
      }

      // Check for page breaks in runs
      const runs = getParagraphRuns(paragraph);
      for (const run of runs) {
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

  const content = doc.package.document.content || [];
  for (let paragraphIndex = 0; paragraphIndex < content.length; paragraphIndex++) {
    const block = content[paragraphIndex];

    if (block.type === 'paragraph') {
      const paragraph = block as Paragraph;

      // Check for pageBreakBefore
      if (hasPageBreakBefore(paragraph)) {
        positions.push({ paragraphIndex });
      }

      // Check for page breaks in runs
      const runs = getParagraphRuns(paragraph);
      for (let runIndex = 0; runIndex < runs.length; runIndex++) {
        const run = runs[runIndex];
        for (const runContent of run.content) {
          if (isPageBreak(runContent)) {
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
export function removePageBreak(doc: Document, position: InsertPosition): Document {
  const { paragraphIndex, runIndex } = position;
  const content = [...(doc.package.document.content || [])];
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
      package: {
        ...doc.package,
        document: {
          ...doc.package.document,
          content,
        },
      },
    };
  }

  // If page break in run, remove it
  if (runIndex !== undefined) {
    const newParagraphContent: ParagraphContent[] = [];
    let currentRunIndex = 0;

    for (const item of paragraph.content) {
      if (item.type === 'run') {
        if (currentRunIndex === runIndex) {
          const newRunContent = item.content.filter((c: RunContent) => !isPageBreak(c));

          if (newRunContent.length > 0) {
            newParagraphContent.push({ ...item, content: newRunContent });
          }
        } else {
          newParagraphContent.push(item);
        }
        currentRunIndex++;
      } else {
        newParagraphContent.push(item);
      }
    }

    content[paragraphIndex] = { ...paragraph, content: newParagraphContent };

    return {
      ...doc,
      package: {
        ...doc.package,
        document: {
          ...doc.package.document,
          content,
        },
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
