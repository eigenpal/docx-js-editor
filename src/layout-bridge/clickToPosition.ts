/**
 * Click-to-Position Mapping
 *
 * Maps click coordinates within a layout to ProseMirror document positions.
 * Uses geometry-based calculation with canvas text measurement for accuracy.
 *
 * The main entry point `clickToPosition` takes fragment hit data and local
 * coordinates and returns the PM position at the click point.
 */

import type {
  ParagraphBlock,
  ParagraphFragment,
  ParagraphMeasure,
  MeasuredLine,
  Run,
  TextRun,
  TabRun,
} from '../layout-engine/types';

import type { FragmentHit, TableCellHit } from './hitTest';

import {
  measureRun,
  findCharacterAtX as findCharAtX,
  type FontStyle,
} from './measuring/measureContainer';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of click-to-position mapping.
 */
export type PositionResult = {
  /** ProseMirror document position. */
  pmPosition: number;
  /** Character offset within the line (for debugging). */
  charOffset: number;
  /** Line index within the paragraph. */
  lineIndex: number;
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract FontStyle from a run for measurement.
 */
function runToFontStyle(run: TextRun | TabRun): FontStyle {
  return {
    fontFamily: run.fontFamily ?? 'Arial',
    fontSize: run.fontSize ?? 12,
    bold: run.bold,
    italic: run.italic,
    letterSpacing: run.letterSpacing,
  };
}

/**
 * Slice the runs that are part of a specific line.
 * Returns only the text portions that belong to the line.
 */
function sliceRunsForLine(block: ParagraphBlock, line: MeasuredLine): Run[] {
  const result: Run[] = [];

  for (
    let runIndex = line.fromRun;
    runIndex <= line.toRun && runIndex < block.runs.length;
    runIndex++
  ) {
    const run = block.runs[runIndex];
    if (!run) continue;

    // Handle non-text runs as atomic units
    if (run.kind === 'tab' || run.kind === 'image' || run.kind === 'lineBreak') {
      result.push(run);
      continue;
    }

    // Handle text runs - may need to slice
    if (run.kind === 'text') {
      const text = run.text ?? '';
      const isFirstRun = runIndex === line.fromRun;
      const isLastRun = runIndex === line.toRun;

      if (isFirstRun || isLastRun) {
        const start = isFirstRun ? line.fromChar : 0;
        const end = isLastRun ? line.toChar : text.length;
        const slice = text.slice(start, end);

        if (slice.length > 0) {
          result.push({
            ...run,
            text: slice,
          });
        }
      } else {
        // Middle runs are included entirely
        result.push(run);
      }
    }
  }

  return result;
}

/**
 * Calculate the PM position range for a line.
 */
function computeLinePmRange(
  block: ParagraphBlock,
  line: MeasuredLine
): { pmStart: number | undefined; pmEnd: number | undefined } {
  // Walk through runs to find PM positions
  let pmStart: number | undefined;
  let pmEnd: number | undefined;

  // Get block's PM start as base
  const blockPmStart = block.pmStart ?? 0;

  // Calculate character offset to line start
  let charOffset = 0;
  for (let runIndex = 0; runIndex < block.runs.length && runIndex <= line.toRun; runIndex++) {
    const run = block.runs[runIndex];
    if (!run) continue;

    if (runIndex < line.fromRun) {
      // Before the line - count all characters
      if (run.kind === 'text') {
        charOffset += (run.text ?? '').length;
      } else if (run.kind === 'tab' || run.kind === 'lineBreak') {
        charOffset += 1;
      } else if (run.kind === 'image') {
        charOffset += 1;
      }
    } else if (runIndex === line.fromRun) {
      // First run of line - add fromChar offset
      charOffset += line.fromChar;
      pmStart = blockPmStart + charOffset;

      // Continue to find pmEnd
      if (run.kind === 'text') {
        charOffset = line.fromChar;
      }
    }
  }

  // Calculate pmEnd
  if (pmStart !== undefined) {
    let lineLength = 0;
    for (
      let runIndex = line.fromRun;
      runIndex <= line.toRun && runIndex < block.runs.length;
      runIndex++
    ) {
      const run = block.runs[runIndex];
      if (!run) continue;

      if (run.kind === 'text') {
        const text = run.text ?? '';
        const start = runIndex === line.fromRun ? line.fromChar : 0;
        const end = runIndex === line.toRun ? line.toChar : text.length;
        lineLength += end - start;
      } else if (run.kind === 'tab' || run.kind === 'lineBreak') {
        lineLength += 1;
      } else if (run.kind === 'image') {
        lineLength += 1;
      }
    }
    pmEnd = pmStart + lineLength;
  }

  return { pmStart, pmEnd };
}

/**
 * Find which line contains a Y coordinate within a fragment.
 *
 * @param measure - The paragraph measure with lines.
 * @param localY - Y coordinate relative to fragment top.
 * @param fromLine - First line index in the fragment.
 * @param toLine - Last line index (exclusive) in the fragment.
 * @returns Line index, or null if not found.
 */
function findLineAtY(
  measure: ParagraphMeasure,
  localY: number,
  fromLine: number,
  toLine: number
): number | null {
  let y = 0;

  for (
    let lineIndex = fromLine;
    lineIndex < toLine && lineIndex < measure.lines.length;
    lineIndex++
  ) {
    const line = measure.lines[lineIndex];
    const lineHeight = line.lineHeight;

    if (localY >= y && localY < y + lineHeight) {
      return lineIndex;
    }

    y += lineHeight;
  }

  // If Y is beyond all lines, return the last line
  if (toLine > fromLine) {
    return Math.min(toLine - 1, measure.lines.length - 1);
  }

  return null;
}

/**
 * Find the character position at an X coordinate within a line.
 *
 * Uses canvas text measurement for pixel-perfect accuracy.
 *
 * @param block - The paragraph block.
 * @param line - The measured line.
 * @param x - X coordinate relative to the line's start position.
 * @param availableWidth - Available width for alignment calculations.
 * @returns Character offset and PM position.
 */
function findCharacterInLine(
  block: ParagraphBlock,
  line: MeasuredLine,
  x: number,
  availableWidth: number
): { charOffset: number; pmPosition: number } {
  const { pmStart, pmEnd } = computeLinePmRange(block, line);

  if (pmStart === undefined || pmEnd === undefined) {
    return { charOffset: 0, pmPosition: block.pmStart ?? 0 };
  }

  // Calculate alignment offset
  const alignment = block.attrs?.alignment ?? 'left';
  let alignmentOffset = 0;

  if (alignment === 'center') {
    alignmentOffset = Math.max(0, (availableWidth - line.width) / 2);
  } else if (alignment === 'right') {
    alignmentOffset = Math.max(0, availableWidth - line.width);
  }
  // For 'justify', text is stretched to fill width - no offset needed

  // Adjust X for alignment
  const adjustedX = Math.max(0, x - alignmentOffset);

  // If X is before content, return start position
  if (adjustedX <= 0) {
    return { charOffset: 0, pmPosition: pmStart };
  }

  // Get runs for this line
  const runs = sliceRunsForLine(block, line);

  if (runs.length === 0) {
    return { charOffset: 0, pmPosition: pmStart };
  }

  // Walk through runs measuring each one
  let currentX = 0;
  let currentCharOffset = 0;

  for (const run of runs) {
    // Handle tab runs
    if (run.kind === 'tab') {
      const tabWidth = run.width ?? 48; // Default tab width
      const runEndX = currentX + tabWidth;

      if (adjustedX <= runEndX) {
        // Click is within this tab
        const midpoint = currentX + tabWidth / 2;
        if (adjustedX < midpoint) {
          return { charOffset: currentCharOffset, pmPosition: pmStart + currentCharOffset };
        } else {
          return { charOffset: currentCharOffset + 1, pmPosition: pmStart + currentCharOffset + 1 };
        }
      }

      currentX = runEndX;
      currentCharOffset += 1;
      continue;
    }

    // Handle image runs
    if (run.kind === 'image') {
      const imageWidth = run.width;
      const runEndX = currentX + imageWidth;

      if (adjustedX <= runEndX) {
        // Click is on or before the image
        const midpoint = currentX + imageWidth / 2;
        if (adjustedX < midpoint) {
          return { charOffset: currentCharOffset, pmPosition: pmStart + currentCharOffset };
        } else {
          return { charOffset: currentCharOffset + 1, pmPosition: pmStart + currentCharOffset + 1 };
        }
      }

      currentX = runEndX;
      currentCharOffset += 1;
      continue;
    }

    // Handle line break runs
    if (run.kind === 'lineBreak') {
      // Line breaks have no visual width but take up a position
      if (adjustedX >= currentX) {
        return { charOffset: currentCharOffset, pmPosition: pmStart + currentCharOffset };
      }
      currentCharOffset += 1;
      continue;
    }

    // Handle text runs
    if (run.kind === 'text') {
      const text = run.text ?? '';
      if (text.length === 0) continue;

      const style = runToFontStyle(run);
      const measurement = measureRun(text, style);
      const runEndX = currentX + measurement.width;

      if (adjustedX <= runEndX) {
        // Click is within this run - find exact character
        const localX = adjustedX - currentX;
        const charInRun = findCharAtX(localX, measurement.charWidths);
        const charOffset = currentCharOffset + charInRun;
        return { charOffset, pmPosition: pmStart + charOffset };
      }

      currentX = runEndX;
      currentCharOffset += text.length;
    }
  }

  // X is past all content - return end position
  const finalOffset = pmEnd - pmStart;
  return { charOffset: finalOffset, pmPosition: pmEnd };
}

// =============================================================================
// MAIN ENTRY POINTS
// =============================================================================

/**
 * Map a click within a paragraph fragment to a PM position.
 *
 * @param fragmentHit - The fragment hit result from hitTestFragment.
 * @returns Position result, or null if mapping fails.
 */
export function clickToPositionInParagraph(fragmentHit: FragmentHit): PositionResult | null {
  const { fragment, block, measure, localX, localY } = fragmentHit;

  // Validate types
  if (fragment.kind !== 'paragraph') return null;
  if (block.kind !== 'paragraph') return null;
  if (measure.kind !== 'paragraph') return null;

  const paragraphFragment = fragment as ParagraphFragment;
  const paragraphBlock = block as ParagraphBlock;
  const paragraphMeasure = measure as ParagraphMeasure;

  // Find which line contains the click
  const lineIndex = findLineAtY(
    paragraphMeasure,
    localY,
    paragraphFragment.fromLine,
    paragraphFragment.toLine
  );

  if (lineIndex === null) return null;

  const line = paragraphMeasure.lines[lineIndex];
  if (!line) return null;

  // Calculate Y offset from line top
  let lineY = 0;
  for (let i = paragraphFragment.fromLine; i < lineIndex; i++) {
    lineY += paragraphMeasure.lines[i]?.lineHeight ?? 0;
  }

  // Calculate available width (accounting for indentation)
  const indent = paragraphBlock.attrs?.indent;
  const indentLeft = indent?.left ?? 0;
  const indentRight = indent?.right ?? 0;
  const availableWidth = Math.max(0, fragment.width - indentLeft - indentRight);

  // Adjust X for left indent
  const adjustedX = localX - indentLeft;

  // Find character at X position
  const { charOffset, pmPosition } = findCharacterInLine(
    paragraphBlock,
    line,
    adjustedX,
    availableWidth
  );

  return {
    pmPosition,
    charOffset,
    lineIndex,
  };
}

/**
 * Map a click within a table cell to a PM position.
 *
 * @param tableCellHit - The table cell hit result from hitTestTableCell.
 * @returns PM position, or null if mapping fails.
 */
export function clickToPositionInTableCell(tableCellHit: TableCellHit): number | null {
  const { cellBlock, cellMeasure, cellLocalX, cellLocalY } = tableCellHit;

  if (!cellBlock || !cellMeasure) return null;

  // Create a synthetic fragment hit for the cell's paragraph
  const syntheticHit: FragmentHit = {
    fragment: {
      kind: 'paragraph',
      blockId: cellBlock.id,
      x: 0,
      y: 0,
      width: cellMeasure.lines.reduce((max, line) => Math.max(max, line.width), 100),
      fromLine: 0,
      toLine: cellMeasure.lines.length,
      height: cellMeasure.totalHeight,
    },
    block: cellBlock,
    measure: cellMeasure,
    pageIndex: tableCellHit.pageIndex,
    localX: cellLocalX,
    localY: cellLocalY,
  };

  const result = clickToPositionInParagraph(syntheticHit);
  return result?.pmPosition ?? null;
}

/**
 * Main entry point: Map a click to a PM position.
 *
 * This function takes the result of hit testing and returns the PM position.
 *
 * @param fragmentHit - Fragment hit from hitTestFragment.
 * @param tableCellHit - Optional table cell hit from hitTestTableCell.
 * @returns PM position, or null if mapping fails.
 */
export function clickToPosition(
  fragmentHit: FragmentHit | null,
  tableCellHit?: TableCellHit | null
): number | null {
  // Handle table cells first (more specific)
  if (tableCellHit) {
    return clickToPositionInTableCell(tableCellHit);
  }

  // Handle regular fragments
  if (!fragmentHit) return null;

  const { fragment } = fragmentHit;

  if (fragment.kind === 'paragraph') {
    const result = clickToPositionInParagraph(fragmentHit);
    return result?.pmPosition ?? null;
  }

  if (fragment.kind === 'image') {
    // For images, return the start position (select the image)
    return fragment.pmStart ?? null;
  }

  // Tables are handled via tableCellHit above
  return null;
}

/**
 * Map a PM position to X coordinates within a line (for caret positioning).
 *
 * @param block - The paragraph block.
 * @param measure - The paragraph measure.
 * @param pmPosition - The PM position to map.
 * @param fragmentWidth - Width of the fragment.
 * @returns X coordinate relative to fragment start, or null if not found.
 */
export function positionToX(
  block: ParagraphBlock,
  measure: ParagraphMeasure,
  pmPosition: number,
  _fragmentWidth: number
): { x: number; lineIndex: number } | null {
  const blockPmStart = block.pmStart ?? 0;
  const blockPmEnd = block.pmEnd ?? blockPmStart;

  // Check if position is within this block
  if (pmPosition < blockPmStart || pmPosition > blockPmEnd) {
    return null;
  }

  const positionOffset = pmPosition - blockPmStart;

  // Find which line contains this position
  for (let lineIndex = 0; lineIndex < measure.lines.length; lineIndex++) {
    const line = measure.lines[lineIndex];
    const { pmStart: linePmStart, pmEnd: linePmEnd } = computeLinePmRange(block, line);

    if (linePmStart === undefined || linePmEnd === undefined) continue;

    const lineStartOffset = linePmStart - blockPmStart;
    const lineEndOffset = linePmEnd - blockPmStart;

    if (positionOffset >= lineStartOffset && positionOffset <= lineEndOffset) {
      // Position is within this line
      const offsetInLine = positionOffset - lineStartOffset;

      // Calculate X by walking through runs
      const runs = sliceRunsForLine(block, line);
      let x = 0;
      let charsProcessed = 0;

      for (const run of runs) {
        if (run.kind === 'tab') {
          if (offsetInLine <= charsProcessed + 1) {
            if (offsetInLine <= charsProcessed) return { x, lineIndex };
            return { x: x + (run.width ?? 48), lineIndex };
          }
          x += run.width ?? 48;
          charsProcessed += 1;
        } else if (run.kind === 'image') {
          if (offsetInLine <= charsProcessed + 1) {
            if (offsetInLine <= charsProcessed) return { x, lineIndex };
            return { x: x + run.width, lineIndex };
          }
          x += run.width;
          charsProcessed += 1;
        } else if (run.kind === 'lineBreak') {
          if (offsetInLine <= charsProcessed) {
            return { x, lineIndex };
          }
          charsProcessed += 1;
        } else if (run.kind === 'text') {
          const text = run.text ?? '';
          if (offsetInLine <= charsProcessed + text.length) {
            const charInRun = offsetInLine - charsProcessed;
            const style = runToFontStyle(run);
            const measurement = measureRun(text.slice(0, charInRun), style);
            return { x: x + measurement.width, lineIndex };
          }
          const style = runToFontStyle(run);
          const measurement = measureRun(text, style);
          x += measurement.width;
          charsProcessed += text.length;
        }
      }

      // Position is at end of line
      return { x, lineIndex };
    }
  }

  return null;
}

/**
 * Get the bounding rect for a PM position (for caret rendering).
 */
export function getPositionRect(
  block: ParagraphBlock,
  measure: ParagraphMeasure,
  pmPosition: number,
  fragmentX: number,
  fragmentY: number,
  fragmentWidth: number,
  fromLine: number
): { x: number; y: number; height: number } | null {
  const result = positionToX(block, measure, pmPosition, fragmentWidth);
  if (!result) return null;

  // Calculate alignment offset
  const alignment = block.attrs?.alignment ?? 'left';
  const indent = block.attrs?.indent;
  const indentLeft = indent?.left ?? 0;
  const indentRight = indent?.right ?? 0;
  const availableWidth = Math.max(0, fragmentWidth - indentLeft - indentRight);

  const line = measure.lines[result.lineIndex];
  if (!line) return null;

  let alignmentOffset = 0;
  if (alignment === 'center') {
    alignmentOffset = Math.max(0, (availableWidth - line.width) / 2);
  } else if (alignment === 'right') {
    alignmentOffset = Math.max(0, availableWidth - line.width);
  }

  // Calculate Y position of the line
  let lineY = 0;
  for (let i = fromLine; i < result.lineIndex; i++) {
    lineY += measure.lines[i]?.lineHeight ?? 0;
  }

  return {
    x: fragmentX + indentLeft + alignmentOffset + result.x,
    y: fragmentY + lineY,
    height: line.lineHeight,
  };
}
