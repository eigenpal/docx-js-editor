/**
 * Run Consolidator - Merge consecutive runs with identical formatting
 *
 * DOCX files often contain many small runs with the same formatting,
 * created by Word for various reasons (spell checking, revision tracking,
 * cursor positioning, etc.). This causes:
 * - 252+ tiny <span> elements instead of a few
 * - Poor editing UX (cursor jumps between spans)
 * - Performance issues
 *
 * This module provides utilities to consolidate runs with identical
 * formatting into single runs, reducing fragmentation.
 */

import type {
  Run,
  RunContent,
  TextContent,
  TextFormatting,
  ParagraphContent,
  Paragraph,
  Hyperlink,
} from '../types/document';

/**
 * Check if two TextFormatting objects are equivalent
 *
 * Uses deep comparison of all properties to determine if runs
 * can be merged without losing formatting information.
 */
export function formattingEquals(
  a: TextFormatting | undefined,
  b: TextFormatting | undefined
): boolean {
  // Both undefined - equal
  if (!a && !b) return true;

  // One undefined - not equal
  if (!a || !b) return false;

  // Compare boolean properties
  if (a.bold !== b.bold) return false;
  if (a.boldCs !== b.boldCs) return false;
  if (a.italic !== b.italic) return false;
  if (a.italicCs !== b.italicCs) return false;
  if (a.strike !== b.strike) return false;
  if (a.doubleStrike !== b.doubleStrike) return false;
  if (a.smallCaps !== b.smallCaps) return false;
  if (a.allCaps !== b.allCaps) return false;
  if (a.hidden !== b.hidden) return false;
  if (a.emboss !== b.emboss) return false;
  if (a.imprint !== b.imprint) return false;
  if (a.outline !== b.outline) return false;
  if (a.shadow !== b.shadow) return false;
  if (a.rtl !== b.rtl) return false;
  if (a.cs !== b.cs) return false;

  // Compare numeric properties
  if (a.fontSize !== b.fontSize) return false;
  if (a.fontSizeCs !== b.fontSizeCs) return false;
  if (a.spacing !== b.spacing) return false;
  if (a.position !== b.position) return false;
  if (a.scale !== b.scale) return false;
  if (a.kerning !== b.kerning) return false;

  // Compare string properties
  if (a.vertAlign !== b.vertAlign) return false;
  if (a.highlight !== b.highlight) return false;
  if (a.effect !== b.effect) return false;
  if (a.emphasisMark !== b.emphasisMark) return false;
  if (a.styleId !== b.styleId) return false;

  // Compare underline (object with style and optional color)
  if (!underlineEquals(a.underline, b.underline)) return false;

  // Compare color (object with rgb, themeColor, etc.)
  if (!colorEquals(a.color, b.color)) return false;

  // Compare shading (object with color, fill, pattern)
  if (!shadingEquals(a.shading, b.shading)) return false;

  // Compare fontFamily (complex object with multiple properties)
  if (!fontFamilyEquals(a.fontFamily, b.fontFamily)) return false;

  return true;
}

/**
 * Compare underline settings
 */
function underlineEquals(
  a: TextFormatting['underline'],
  b: TextFormatting['underline']
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;

  if (a.style !== b.style) return false;
  return colorEquals(a.color, b.color);
}

/**
 * Compare color values
 */
function colorEquals(
  a: TextFormatting['color'],
  b: TextFormatting['color']
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;

  return (
    a.rgb === b.rgb &&
    a.auto === b.auto &&
    a.themeColor === b.themeColor &&
    a.themeTint === b.themeTint &&
    a.themeShade === b.themeShade
  );
}

/**
 * Compare shading properties
 */
function shadingEquals(
  a: TextFormatting['shading'],
  b: TextFormatting['shading']
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;

  if (a.pattern !== b.pattern) return false;
  if (!colorEquals(a.color, b.color)) return false;
  if (!colorEquals(a.fill, b.fill)) return false;

  return true;
}

/**
 * Compare font family settings
 */
function fontFamilyEquals(
  a: TextFormatting['fontFamily'],
  b: TextFormatting['fontFamily']
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;

  return (
    a.ascii === b.ascii &&
    a.hAnsi === b.hAnsi &&
    a.eastAsia === b.eastAsia &&
    a.cs === b.cs &&
    a.asciiTheme === b.asciiTheme &&
    a.hAnsiTheme === b.hAnsiTheme &&
    a.eastAsiaTheme === b.eastAsiaTheme &&
    a.csTheme === b.csTheme
  );
}

/**
 * Check if a run contains only text content
 * (runs with special content like images, fields, etc. should not be merged)
 */
export function isTextOnlyRun(run: Run): boolean {
  return run.content.every(
    (c) =>
      c.type === 'text' ||
      c.type === 'softHyphen' ||
      c.type === 'noBreakHyphen'
  );
}

/**
 * Check if run content can be merged (simple text types)
 */
function isMergeableContent(content: RunContent): boolean {
  return (
    content.type === 'text' ||
    content.type === 'softHyphen' ||
    content.type === 'noBreakHyphen'
  );
}

/**
 * Check if a run can be merged with another run
 * Runs with breaks, tabs, images, fields, etc. act as merge boundaries
 */
export function canMergeRun(run: Run): boolean {
  // Empty runs can be merged
  if (run.content.length === 0) return true;

  // Runs with only text/hyphen content can be merged
  return run.content.every(isMergeableContent);
}

/**
 * Merge the content of two runs into a single content array
 */
function mergeRunContent(content1: RunContent[], content2: RunContent[]): RunContent[] {
  // Combine all content
  const result: RunContent[] = [];

  // Add all from first run
  for (const c of content1) {
    result.push(c);
  }

  // Merge text at boundary if possible
  if (
    result.length > 0 &&
    content2.length > 0 &&
    result[result.length - 1].type === 'text' &&
    content2[0].type === 'text'
  ) {
    // Merge the two text nodes
    const lastText = result[result.length - 1] as TextContent;
    const firstText = content2[0] as TextContent;

    result[result.length - 1] = {
      type: 'text',
      text: lastText.text + firstText.text,
      preserveSpace: lastText.preserveSpace || firstText.preserveSpace || undefined,
    };

    // Add rest of content2
    for (let i = 1; i < content2.length; i++) {
      result.push(content2[i]);
    }
  } else {
    // Just append all of content2
    for (const c of content2) {
      result.push(c);
    }
  }

  return result;
}

/**
 * Consolidate an array of runs by merging consecutive runs with identical formatting
 *
 * @param runs - Array of runs to consolidate
 * @returns Consolidated array with fewer, larger runs
 */
export function consolidateRuns(runs: Run[]): Run[] {
  if (runs.length <= 1) return runs;

  const result: Run[] = [];
  let current: Run | null = null;

  for (const run of runs) {
    // Skip empty runs
    if (run.content.length === 0) continue;

    // If no current run, start with this one
    if (current === null) {
      current = { ...run, content: [...run.content] };
      continue;
    }

    // Check if we can merge this run with current
    if (
      canMergeRun(current) &&
      canMergeRun(run) &&
      formattingEquals(current.formatting, run.formatting)
    ) {
      // Merge the runs
      current = {
        type: 'run',
        formatting: current.formatting,
        content: mergeRunContent(current.content, run.content),
      };
    } else {
      // Can't merge - save current and start new
      result.push(current);
      current = { ...run, content: [...run.content] };
    }
  }

  // Don't forget the last run
  if (current !== null) {
    result.push(current);
  }

  return result;
}

/**
 * Consolidate runs within a paragraph content array
 *
 * This handles the full paragraph structure, consolidating runs while
 * preserving hyperlinks, bookmarks, and fields as merge boundaries.
 */
export function consolidateParagraphContent(
  content: ParagraphContent[]
): ParagraphContent[] {
  if (content.length <= 1) return content;

  const result: ParagraphContent[] = [];
  const pendingRuns: Run[] = [];

  function flushRuns(): void {
    if (pendingRuns.length > 0) {
      const consolidated = consolidateRuns(pendingRuns);
      result.push(...consolidated);
      pendingRuns.length = 0;
    }
  }

  for (const item of content) {
    if (item.type === 'run') {
      pendingRuns.push(item);
    } else {
      // Non-run content acts as a merge boundary
      flushRuns();

      // Handle hyperlinks - consolidate their internal runs
      if (item.type === 'hyperlink') {
        const hyperlink: Hyperlink = {
          ...item,
          children: consolidateParagraphContent(item.children) as Hyperlink['children'],
        };
        result.push(hyperlink);
      } else {
        result.push(item);
      }
    }
  }

  // Flush any remaining runs
  flushRuns();

  return result;
}

/**
 * Consolidate all runs within a paragraph
 *
 * @param paragraph - Paragraph to consolidate
 * @returns New paragraph with consolidated runs
 */
export function consolidateParagraph(paragraph: Paragraph): Paragraph {
  if (!paragraph.content || paragraph.content.length === 0) {
    return paragraph;
  }

  return {
    ...paragraph,
    content: consolidateParagraphContent(paragraph.content),
  };
}

/**
 * Get the number of runs in a paragraph (for debugging/metrics)
 */
export function countRuns(paragraph: Paragraph): number {
  let count = 0;

  function countInContent(content: ParagraphContent[]): void {
    for (const item of content) {
      if (item.type === 'run') {
        count++;
      } else if (item.type === 'hyperlink') {
        countInContent(item.children);
      }
    }
  }

  if (paragraph.content) {
    countInContent(paragraph.content);
  }

  return count;
}

/**
 * Calculate the consolidation ratio (reduction in number of runs)
 * Useful for debugging and metrics
 */
export function getConsolidationStats(
  originalParagraphs: Paragraph[],
  consolidatedParagraphs: Paragraph[]
): {
  originalRunCount: number;
  consolidatedRunCount: number;
  reductionPercentage: number;
} {
  const originalCount = originalParagraphs.reduce((sum, p) => sum + countRuns(p), 0);
  const consolidatedCount = consolidatedParagraphs.reduce((sum, p) => sum + countRuns(p), 0);

  const reduction = originalCount > 0
    ? ((originalCount - consolidatedCount) / originalCount) * 100
    : 0;

  return {
    originalRunCount: originalCount,
    consolidatedRunCount: consolidatedCount,
    reductionPercentage: Math.round(reduction * 10) / 10,
  };
}
