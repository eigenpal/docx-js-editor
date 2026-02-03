/**
 * Selection Rectangles
 *
 * Converts ProseMirror selection ranges into screen rectangles for rendering
 * selection highlights and the caret cursor.
 *
 * The main function `selectionToRects` takes a PM range and returns an array
 * of rectangles that cover the selected text across all pages and fragments.
 */

import type {
  Layout,
  FlowBlock,
  Measure,
  ParagraphBlock,
  ParagraphFragment,
  ParagraphMeasure,
  MeasuredLine,
  TableBlock,
  TableFragment,
  TableMeasure,
  TextRun,
  TabRun,
  BlockId,
} from '../layout-engine/types';

import { measureRun, type FontStyle } from './measuring/measureContainer';

import { getPageTop } from './hitTest';

// =============================================================================
// TYPES
// =============================================================================

/**
 * A rectangle representing part of a selection.
 */
export type SelectionRect = {
  /** X coordinate in container space. */
  x: number;
  /** Y coordinate in container space. */
  y: number;
  /** Width of the rectangle. */
  width: number;
  /** Height of the rectangle (typically line height). */
  height: number;
  /** Page index (0-based). */
  pageIndex: number;
};

/**
 * Caret position for collapsed selection.
 */
export type CaretPosition = {
  /** X coordinate in container space. */
  x: number;
  /** Y coordinate in container space. */
  y: number;
  /** Height of the caret (line height). */
  height: number;
  /** Page index (0-based). */
  pageIndex: number;
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
 * Find a block by its ID.
 */
function findBlockById(blocks: FlowBlock[], blockId: BlockId): number {
  return blocks.findIndex((block) => block.id === blockId);
}

/**
 * Calculate the PM range for a line.
 */
function computeLinePmRange(
  block: ParagraphBlock,
  line: MeasuredLine
): { pmStart: number | undefined; pmEnd: number | undefined } {
  const blockPmStart = block.pmStart ?? 0;

  // Calculate character offset to line start
  let charOffset = 0;
  let pmStart: number | undefined;

  for (let runIndex = 0; runIndex < block.runs.length && runIndex <= line.toRun; runIndex++) {
    const run = block.runs[runIndex];
    if (!run) continue;

    if (runIndex < line.fromRun) {
      if (run.kind === 'text') {
        charOffset += (run.text ?? '').length;
      } else {
        charOffset += 1;
      }
    } else if (runIndex === line.fromRun) {
      charOffset += line.fromChar;
      pmStart = blockPmStart + charOffset;
      break;
    }
  }

  if (pmStart === undefined) {
    pmStart = blockPmStart;
  }

  // Calculate line length
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
    } else {
      lineLength += 1;
    }
  }

  const pmEnd = pmStart + lineLength;
  return { pmStart, pmEnd };
}

/**
 * Find lines in a paragraph that intersect with a PM range.
 */
function findLinesInRange(
  block: ParagraphBlock,
  measure: ParagraphMeasure,
  from: number,
  to: number
): { line: MeasuredLine; index: number }[] {
  const result: { line: MeasuredLine; index: number }[] = [];

  for (let i = 0; i < measure.lines.length; i++) {
    const line = measure.lines[i];
    const range = computeLinePmRange(block, line);

    if (range.pmStart === undefined || range.pmEnd === undefined) continue;

    // Check if line overlaps with selection
    if (range.pmEnd > from && range.pmStart < to) {
      result.push({ line, index: i });
    }
  }

  return result;
}

/**
 * Convert a PM position to a character offset within a line.
 */
function pmPosToCharOffset(block: ParagraphBlock, line: MeasuredLine, pmPos: number): number {
  const range = computeLinePmRange(block, line);
  if (range.pmStart === undefined) return 0;

  return Math.max(0, pmPos - range.pmStart);
}

/**
 * Get the X coordinate for a character offset within a line.
 */
function charOffsetToX(
  block: ParagraphBlock,
  line: MeasuredLine,
  charOffset: number,
  _availableWidth: number
): number {
  // Walk through runs measuring up to the character offset
  let x = 0;
  let charsProcessed = 0;

  for (
    let runIndex = line.fromRun;
    runIndex <= line.toRun && runIndex < block.runs.length;
    runIndex++
  ) {
    const run = block.runs[runIndex];
    if (!run) continue;

    if (run.kind === 'tab') {
      const tabWidth = run.width ?? 48;
      if (charsProcessed + 1 >= charOffset) {
        if (charOffset <= charsProcessed) return x;
        return x + tabWidth;
      }
      x += tabWidth;
      charsProcessed += 1;
      continue;
    }

    if (run.kind === 'image') {
      const imageWidth = run.width;
      if (charsProcessed + 1 >= charOffset) {
        if (charOffset <= charsProcessed) return x;
        return x + imageWidth;
      }
      x += imageWidth;
      charsProcessed += 1;
      continue;
    }

    if (run.kind === 'lineBreak') {
      if (charOffset <= charsProcessed) return x;
      charsProcessed += 1;
      continue;
    }

    if (run.kind === 'text') {
      const text = run.text ?? '';

      // Get portion of text for this line
      const isFirstRun = runIndex === line.fromRun;
      const isLastRun = runIndex === line.toRun;
      const start = isFirstRun ? line.fromChar : 0;
      const end = isLastRun ? line.toChar : text.length;
      const lineText = text.slice(start, end);

      if (charsProcessed + lineText.length >= charOffset) {
        // Target character is in this run
        const charInRun = charOffset - charsProcessed;
        const style = runToFontStyle(run);
        const measurement = measureRun(lineText.slice(0, charInRun), style);
        return x + measurement.width;
      }

      const style = runToFontStyle(run);
      const measurement = measureRun(lineText, style);
      x += measurement.width;
      charsProcessed += lineText.length;
    }
  }

  return x;
}

/**
 * Calculate cumulative line height before a given line index.
 */
function lineHeightBefore(measure: ParagraphMeasure, lineIndex: number): number {
  let height = 0;
  for (let i = 0; i < lineIndex && i < measure.lines.length; i++) {
    height += measure.lines[i].lineHeight;
  }
  return height;
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Convert a ProseMirror selection range to screen rectangles.
 *
 * @param layout - The document layout.
 * @param blocks - All flow blocks.
 * @param measures - All measurements.
 * @param from - Start PM position.
 * @param to - End PM position.
 * @returns Array of rectangles covering the selection.
 */
export function selectionToRects(
  layout: Layout,
  blocks: FlowBlock[],
  measures: Measure[],
  from: number,
  to: number
): SelectionRect[] {
  // Empty selection
  if (from === to) {
    return [];
  }

  // Ensure from < to
  const selFrom = Math.min(from, to);
  const selTo = Math.max(from, to);

  const rects: SelectionRect[] = [];

  // Walk through all pages and fragments
  for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex++) {
    const page = layout.pages[pageIndex];
    const pageTopY = getPageTop(layout, pageIndex);

    for (const fragment of page.fragments) {
      // Handle paragraph fragments
      if (fragment.kind === 'paragraph') {
        const blockIndex = findBlockById(blocks, fragment.blockId);
        if (blockIndex === -1) continue;

        const block = blocks[blockIndex];
        const measure = measures[blockIndex];
        if (!block || block.kind !== 'paragraph') continue;
        if (!measure || measure.kind !== 'paragraph') continue;

        const paragraphBlock = block as ParagraphBlock;
        const paragraphMeasure = measure as ParagraphMeasure;
        const paragraphFragment = fragment as ParagraphFragment;

        // Find lines that intersect with selection
        const intersectingLines = findLinesInRange(
          paragraphBlock,
          paragraphMeasure,
          selFrom,
          selTo
        );

        for (const { line, index } of intersectingLines) {
          // Skip lines not in this fragment
          if (index < paragraphFragment.fromLine || index >= paragraphFragment.toLine) {
            continue;
          }

          const range = computeLinePmRange(paragraphBlock, line);
          if (range.pmStart === undefined || range.pmEnd === undefined) continue;

          // Calculate overlap with selection
          const sliceFrom = Math.max(range.pmStart, selFrom);
          const sliceTo = Math.min(range.pmEnd, selTo);
          if (sliceFrom >= sliceTo) continue;

          // Convert PM positions to character offsets
          const charOffsetFrom = pmPosToCharOffset(paragraphBlock, line, sliceFrom);
          const charOffsetTo = pmPosToCharOffset(paragraphBlock, line, sliceTo);

          // Calculate indentation
          const indent = paragraphBlock.attrs?.indent;
          const indentLeft = indent?.left ?? 0;
          const indentRight = indent?.right ?? 0;
          const availableWidth = Math.max(0, fragment.width - indentLeft - indentRight);

          // Get X coordinates for selection bounds
          const startX = charOffsetToX(paragraphBlock, line, charOffsetFrom, availableWidth);
          const endX = charOffsetToX(paragraphBlock, line, charOffsetTo, availableWidth);

          // Calculate alignment offset
          const alignment = paragraphBlock.attrs?.alignment ?? 'left';
          let alignmentOffset = 0;
          if (alignment === 'center') {
            alignmentOffset = Math.max(0, (availableWidth - line.width) / 2);
          } else if (alignment === 'right') {
            alignmentOffset = Math.max(0, availableWidth - line.width);
          }

          // Calculate line Y offset within fragment
          const lineOffset =
            lineHeightBefore(paragraphMeasure, index) -
            lineHeightBefore(paragraphMeasure, paragraphFragment.fromLine);

          // Create selection rectangle
          const rectX = fragment.x + indentLeft + alignmentOffset + Math.min(startX, endX);
          const rectWidth = Math.max(1, Math.abs(endX - startX));
          const rectY = fragment.y + lineOffset;

          rects.push({
            x: rectX,
            y: rectY + pageTopY,
            width: rectWidth,
            height: line.lineHeight,
            pageIndex,
          });
        }
      }

      // Handle table fragments
      if (fragment.kind === 'table') {
        const blockIndex = findBlockById(blocks, fragment.blockId);
        if (blockIndex === -1) continue;

        const block = blocks[blockIndex];
        const measure = measures[blockIndex];
        if (!block || block.kind !== 'table') continue;
        if (!measure || measure.kind !== 'table') continue;

        const tableBlock = block as TableBlock;
        const tableMeasure = measure as TableMeasure;
        const tableFragment = fragment as TableFragment;

        // Walk through visible rows
        let rowY = 0;
        for (
          let rowIndex = tableFragment.fromRow;
          rowIndex < tableFragment.toRow && rowIndex < tableBlock.rows.length;
          rowIndex++
        ) {
          const row = tableBlock.rows[rowIndex];
          const rowMeasure = tableMeasure.rows[rowIndex];
          if (!row || !rowMeasure) continue;

          // Walk through cells
          let cellX = 0;
          for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex++) {
            const cell = row.cells[cellIndex];
            const cellMeasure = rowMeasure.cells[cellIndex];
            if (!cell || !cellMeasure) continue;

            // Check each paragraph in the cell
            for (let blockIdx = 0; blockIdx < cell.blocks.length; blockIdx++) {
              const cellBlock = cell.blocks[blockIdx];
              const cellBlockMeasure = cellMeasure.blocks[blockIdx];

              if (!cellBlock || cellBlock.kind !== 'paragraph') continue;
              if (!cellBlockMeasure || cellBlockMeasure.kind !== 'paragraph') continue;

              const paragraphBlock = cellBlock as ParagraphBlock;
              const paragraphMeasure = cellBlockMeasure as ParagraphMeasure;

              // Find lines that intersect with selection
              const intersectingLines = findLinesInRange(
                paragraphBlock,
                paragraphMeasure,
                selFrom,
                selTo
              );

              let blockY = 0;
              for (const { line, index } of intersectingLines) {
                const range = computeLinePmRange(paragraphBlock, line);
                if (range.pmStart === undefined || range.pmEnd === undefined) continue;

                const sliceFrom = Math.max(range.pmStart, selFrom);
                const sliceTo = Math.min(range.pmEnd, selTo);
                if (sliceFrom >= sliceTo) continue;

                const charOffsetFrom = pmPosToCharOffset(paragraphBlock, line, sliceFrom);
                const charOffsetTo = pmPosToCharOffset(paragraphBlock, line, sliceTo);

                const startX = charOffsetToX(
                  paragraphBlock,
                  line,
                  charOffsetFrom,
                  cellMeasure.width
                );
                const endX = charOffsetToX(paragraphBlock, line, charOffsetTo, cellMeasure.width);

                const lineY = lineHeightBefore(paragraphMeasure, index);

                rects.push({
                  x: tableFragment.x + cellX + Math.min(startX, endX),
                  y: tableFragment.y + rowY + blockY + lineY + pageTopY,
                  width: Math.max(1, Math.abs(endX - startX)),
                  height: line.lineHeight,
                  pageIndex,
                });
              }

              blockY += paragraphMeasure.totalHeight;
            }

            cellX += cellMeasure.width;
          }

          rowY += rowMeasure.height;
        }
      }

      // Handle image fragments
      if (fragment.kind === 'image') {
        const blockPmStart = fragment.pmStart ?? 0;
        const blockPmEnd = fragment.pmEnd ?? blockPmStart + 1;

        // Check if image overlaps with selection
        if (blockPmEnd > selFrom && blockPmStart < selTo) {
          rects.push({
            x: fragment.x,
            y: fragment.y + pageTopY,
            width: fragment.width,
            height: fragment.height,
            pageIndex,
          });
        }
      }
    }
  }

  return rects;
}

/**
 * Get caret position for a collapsed selection.
 *
 * @param layout - The document layout.
 * @param blocks - All flow blocks.
 * @param measures - All measurements.
 * @param pmPosition - The PM position.
 * @returns Caret position, or null if not found.
 */
export function getCaretPosition(
  layout: Layout,
  blocks: FlowBlock[],
  measures: Measure[],
  pmPosition: number
): CaretPosition | null {
  // Search through pages and fragments to find the position
  for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex++) {
    const page = layout.pages[pageIndex];
    const pageTopY = getPageTop(layout, pageIndex);

    for (const fragment of page.fragments) {
      if (fragment.kind === 'paragraph') {
        const blockIndex = findBlockById(blocks, fragment.blockId);
        if (blockIndex === -1) continue;

        const block = blocks[blockIndex];
        const measure = measures[blockIndex];
        if (!block || block.kind !== 'paragraph') continue;
        if (!measure || measure.kind !== 'paragraph') continue;

        const paragraphBlock = block as ParagraphBlock;
        const paragraphMeasure = measure as ParagraphMeasure;
        const paragraphFragment = fragment as ParagraphFragment;

        const blockPmStart = paragraphBlock.pmStart ?? 0;
        const blockPmEnd = paragraphBlock.pmEnd ?? blockPmStart;

        // Check if position is in this block
        if (pmPosition < blockPmStart || pmPosition > blockPmEnd) continue;

        // Find which line contains this position
        for (
          let lineIndex = paragraphFragment.fromLine;
          lineIndex < paragraphFragment.toLine;
          lineIndex++
        ) {
          const line = paragraphMeasure.lines[lineIndex];
          if (!line) continue;

          const range = computeLinePmRange(paragraphBlock, line);
          if (range.pmStart === undefined || range.pmEnd === undefined) continue;

          if (pmPosition >= range.pmStart && pmPosition <= range.pmEnd) {
            // Position is in this line
            const charOffset = pmPosToCharOffset(paragraphBlock, line, pmPosition);

            // Calculate indentation
            const indent = paragraphBlock.attrs?.indent;
            const indentLeft = indent?.left ?? 0;
            const indentRight = indent?.right ?? 0;
            const availableWidth = Math.max(0, fragment.width - indentLeft - indentRight);

            const x = charOffsetToX(paragraphBlock, line, charOffset, availableWidth);

            // Calculate alignment offset
            const alignment = paragraphBlock.attrs?.alignment ?? 'left';
            let alignmentOffset = 0;
            if (alignment === 'center') {
              alignmentOffset = Math.max(0, (availableWidth - line.width) / 2);
            } else if (alignment === 'right') {
              alignmentOffset = Math.max(0, availableWidth - line.width);
            }

            // Calculate Y offset
            const lineOffset =
              lineHeightBefore(paragraphMeasure, lineIndex) -
              lineHeightBefore(paragraphMeasure, paragraphFragment.fromLine);

            return {
              x: fragment.x + indentLeft + alignmentOffset + x,
              y: fragment.y + lineOffset + pageTopY,
              height: line.lineHeight,
              pageIndex,
            };
          }
        }
      }

      // Check images
      if (fragment.kind === 'image') {
        const fragPmStart = fragment.pmStart ?? 0;
        const fragPmEnd = fragment.pmEnd ?? fragPmStart + 1;

        if (pmPosition >= fragPmStart && pmPosition <= fragPmEnd) {
          const xOffset = pmPosition === fragPmStart ? 0 : fragment.width;
          return {
            x: fragment.x + xOffset,
            y: fragment.y + pageTopY,
            height: fragment.height,
            pageIndex,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Check if a selection spans multiple pages.
 *
 * @param rects - Selection rectangles.
 * @returns True if selection spans multiple pages.
 */
export function isMultiPageSelection(rects: SelectionRect[]): boolean {
  if (rects.length <= 1) return false;

  const pageIndices = new Set(rects.map((r) => r.pageIndex));
  return pageIndices.size > 1;
}

/**
 * Get selection rectangles grouped by page.
 *
 * @param rects - Selection rectangles.
 * @returns Map of page index to rectangles on that page.
 */
export function groupRectsByPage(rects: SelectionRect[]): Map<number, SelectionRect[]> {
  const map = new Map<number, SelectionRect[]>();

  for (const rect of rects) {
    const pageRects = map.get(rect.pageIndex) ?? [];
    pageRects.push(rect);
    map.set(rect.pageIndex, pageRects);
  }

  return map;
}
