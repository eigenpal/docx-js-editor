/**
 * Layout Engine - Main Entry Point
 *
 * Converts blocks + measures into positioned fragments on pages.
 */

import type {
  FlowBlock,
  Measure,
  Layout,
  LayoutOptions,
  PageMargins,
  ParagraphBlock,
  ParagraphMeasure,
  ParagraphFragment,
  TableBlock,
  TableMeasure,
  TableFragment,
  ImageBlock,
  ImageMeasure,
  ImageFragment,
} from './types';

import { createPaginator } from './paginator';
import {
  computeKeepNextChains,
  calculateChainHeight,
  getMidChainIndices,
  hasPageBreakBefore,
} from './keep-together';

// Default page size (US Letter in pixels at 96 DPI)
const DEFAULT_PAGE_SIZE = { w: 816, h: 1056 };

// Default margins (1 inch = 96 pixels)
const DEFAULT_MARGINS: PageMargins = {
  top: 96,
  right: 96,
  bottom: 96,
  left: 96,
};

/**
 * Get spacing before a paragraph block.
 */
function getSpacingBefore(block: ParagraphBlock): number {
  return block.attrs?.spacing?.before ?? 0;
}

/**
 * Get spacing after a paragraph block.
 */
function getSpacingAfter(block: ParagraphBlock): number {
  return block.attrs?.spacing?.after ?? 0;
}

/**
 * Layout a document: convert blocks + measures into pages with positioned fragments.
 *
 * Algorithm:
 * 1. Walk blocks in order with their corresponding measures
 * 2. For each block, create appropriate fragment(s)
 * 3. Use paginator to manage page/column state
 * 4. Handle page breaks, section breaks, and keepNext chains
 */
export function layoutDocument(
  blocks: FlowBlock[],
  measures: Measure[],
  options: LayoutOptions = {} as LayoutOptions
): Layout {
  // Validate input
  if (blocks.length !== measures.length) {
    throw new Error(
      `layoutDocument: expected one measure per block (blocks=${blocks.length}, measures=${measures.length})`
    );
  }

  // Set up options with defaults
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const baseMargins = {
    top: options.margins?.top ?? DEFAULT_MARGINS.top,
    right: options.margins?.right ?? DEFAULT_MARGINS.right,
    bottom: options.margins?.bottom ?? DEFAULT_MARGINS.bottom,
    left: options.margins?.left ?? DEFAULT_MARGINS.left,
    header: options.margins?.header ?? options.margins?.top ?? DEFAULT_MARGINS.top,
    footer: options.margins?.footer ?? options.margins?.bottom ?? DEFAULT_MARGINS.bottom,
  };

  // Calculate effective margins based on header/footer content heights
  // effectiveTopMargin = max(baseTopMargin, headerDistance + headerContentHeight)
  // effectiveBottomMargin = max(baseBottomMargin, footerDistance + footerContentHeight)
  const headerHeights = options.headerContentHeights ?? {};
  const footerHeights = options.footerContentHeights ?? {};
  // Options for per-page margin calculation (kept for future use)
  void options.titlePage;
  void options.evenAndOddHeaders;

  // Calculate maximum effective margins (conservative approach)
  // This ensures all pages have enough space for headers/footers
  // A more advanced implementation would use per-page margins
  const maxHeaderHeight = Math.max(
    headerHeights.default ?? 0,
    headerHeights.first ?? 0,
    headerHeights.even ?? 0,
    headerHeights.odd ?? 0
  );
  const maxFooterHeight = Math.max(
    footerHeights.default ?? 0,
    footerHeights.first ?? 0,
    footerHeights.even ?? 0,
    footerHeights.odd ?? 0
  );

  const effectiveTopMargin =
    maxHeaderHeight > 0
      ? Math.max(baseMargins.top, baseMargins.header + maxHeaderHeight)
      : baseMargins.top;

  const effectiveBottomMargin =
    maxFooterHeight > 0
      ? Math.max(baseMargins.bottom, baseMargins.footer + maxFooterHeight)
      : baseMargins.bottom;

  const margins = {
    ...baseMargins,
    top: effectiveTopMargin,
    bottom: effectiveBottomMargin,
  };

  // Calculate content width
  const contentWidth = pageSize.w - margins.left - margins.right;
  if (contentWidth <= 0) {
    throw new Error('layoutDocument: page size and margins yield no content area');
  }

  // Create paginator with effective margins
  const paginator = createPaginator({
    pageSize,
    margins,
    columns: options.columns,
  });

  // Pre-compute keepNext chains for pagination decisions
  const keepNextChains = computeKeepNextChains(blocks);
  const midChainIndices = getMidChainIndices(keepNextChains);

  // Process each block
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const measure = measures[i];

    // Handle pageBreakBefore on paragraphs
    if (hasPageBreakBefore(block)) {
      paginator.forcePageBreak();
    }

    // Handle keepNext chains - if this is a chain start, check if chain fits
    const chain = keepNextChains.get(i);
    if (chain && !midChainIndices.has(i)) {
      const chainHeight = calculateChainHeight(chain, blocks, measures);
      const state = paginator.getCurrentState();
      const availableHeight = paginator.getAvailableHeight();
      const pageContentHeight = state.contentBottom - state.topMargin;

      // Only move to new page if:
      // 1. Chain fits on a blank page (avoid infinite loop for oversized chains)
      // 2. Chain doesn't fit in current available space
      // 3. Current page already has content
      if (
        chainHeight <= pageContentHeight &&
        chainHeight > availableHeight &&
        state.page.fragments.length > 0
      ) {
        paginator.forcePageBreak();
      }
    }

    switch (block.kind) {
      case 'paragraph':
        layoutParagraph(block, measure as ParagraphMeasure, paginator, contentWidth);
        break;

      case 'table':
        layoutTable(block, measure as TableMeasure, paginator);
        break;

      case 'image':
        layoutImage(block, measure as ImageMeasure, paginator);
        break;

      case 'pageBreak':
        paginator.forcePageBreak();
        break;

      case 'columnBreak':
        paginator.forceColumnBreak();
        break;

      case 'sectionBreak':
        // Handle section break - may force page break depending on type
        handleSectionBreak(block, paginator);
        break;
    }
  }

  // Ensure at least one page exists
  if (paginator.pages.length === 0) {
    paginator.getCurrentState();
  }

  return {
    pageSize,
    pages: paginator.pages,
    columns: options.columns,
    pageGap: options.pageGap,
  };
}

/**
 * Layout a paragraph block onto pages.
 */
function layoutParagraph(
  block: ParagraphBlock,
  measure: ParagraphMeasure,
  paginator: ReturnType<typeof createPaginator>,
  contentWidth: number
): void {
  if (measure.kind !== 'paragraph') {
    throw new Error(`layoutParagraph: expected paragraph measure`);
  }

  const lines = measure.lines;
  if (lines.length === 0) {
    // Empty paragraph - still takes up space based on spacing
    const spaceBefore = getSpacingBefore(block);
    const spaceAfter = getSpacingAfter(block);
    const state = paginator.getCurrentState();

    // Create minimal fragment
    const fragment: ParagraphFragment = {
      kind: 'paragraph',
      blockId: block.id,
      x: paginator.getColumnX(state.columnIndex),
      y: state.cursorY + spaceBefore,
      width: contentWidth,
      height: 0,
      fromLine: 0,
      toLine: 0,
      pmStart: block.pmStart,
      pmEnd: block.pmEnd,
    };

    paginator.addFragment(fragment, 0, spaceBefore, spaceAfter);
    return;
  }

  const spaceBefore = getSpacingBefore(block);
  const spaceAfter = getSpacingAfter(block);

  // Try to fit all lines on current page/column
  let currentLineIndex = 0;

  while (currentLineIndex < lines.length) {
    const state = paginator.getCurrentState();
    const availableHeight = paginator.getAvailableHeight();

    // Calculate how many lines fit
    let linesHeight = 0;
    let fittingLines = 0;

    for (let j = currentLineIndex; j < lines.length; j++) {
      const lineHeight = lines[j].lineHeight;
      const totalWithLine = linesHeight + lineHeight;

      // Add space before only for first fragment
      const withSpacing =
        currentLineIndex === 0 && j === currentLineIndex
          ? totalWithLine + spaceBefore
          : totalWithLine;

      if (withSpacing <= availableHeight || fittingLines === 0) {
        linesHeight = totalWithLine;
        fittingLines++;
      } else {
        break;
      }
    }

    // Create fragment for these lines
    const isFirstFragment = currentLineIndex === 0;
    const isLastFragment = currentLineIndex + fittingLines >= lines.length;
    const effectiveSpaceBefore = isFirstFragment ? spaceBefore : 0;
    const effectiveSpaceAfter = isLastFragment ? spaceAfter : 0;

    const fragment: ParagraphFragment = {
      kind: 'paragraph',
      blockId: block.id,
      x: paginator.getColumnX(state.columnIndex),
      y: 0, // Will be set by addFragment
      width: contentWidth,
      height: linesHeight,
      fromLine: currentLineIndex,
      toLine: currentLineIndex + fittingLines,
      pmStart: block.pmStart,
      pmEnd: block.pmEnd,
      continuesFromPrev: !isFirstFragment,
      continuesOnNext: !isLastFragment,
    };

    const result = paginator.addFragment(
      fragment,
      linesHeight,
      effectiveSpaceBefore,
      effectiveSpaceAfter
    );
    fragment.y = result.y;

    currentLineIndex += fittingLines;

    // If more lines remain, advance to next column/page
    if (currentLineIndex < lines.length) {
      paginator.ensureFits(lines[currentLineIndex].lineHeight);
    }
  }
}

/**
 * Layout a table block onto pages.
 */
function layoutTable(
  block: TableBlock,
  measure: TableMeasure,
  paginator: ReturnType<typeof createPaginator>
): void {
  if (measure.kind !== 'table') {
    throw new Error(`layoutTable: expected table measure`);
  }

  const rows = measure.rows;
  if (rows.length === 0) {
    return;
  }

  let currentRowIndex = 0;

  while (currentRowIndex < rows.length) {
    const state = paginator.getCurrentState();
    const availableHeight = paginator.getAvailableHeight();

    // Calculate how many rows fit
    let rowsHeight = 0;
    let fittingRows = 0;

    for (let j = currentRowIndex; j < rows.length; j++) {
      const rowHeight = rows[j].height;
      const totalWithRow = rowsHeight + rowHeight;

      if (totalWithRow <= availableHeight || fittingRows === 0) {
        rowsHeight = totalWithRow;
        fittingRows++;
      } else {
        break;
      }
    }

    // Create fragment for these rows
    const isFirstFragment = currentRowIndex === 0;
    const isLastFragment = currentRowIndex + fittingRows >= rows.length;

    const fragment: TableFragment = {
      kind: 'table',
      blockId: block.id,
      x: paginator.getColumnX(state.columnIndex),
      y: 0, // Will be set by addFragment
      width: measure.totalWidth,
      height: rowsHeight,
      fromRow: currentRowIndex,
      toRow: currentRowIndex + fittingRows,
      pmStart: block.pmStart,
      pmEnd: block.pmEnd,
      continuesFromPrev: !isFirstFragment,
      continuesOnNext: !isLastFragment,
    };

    const result = paginator.addFragment(fragment, rowsHeight, 0, 0);
    fragment.y = result.y;

    currentRowIndex += fittingRows;

    // If more rows remain, advance to next column/page
    if (currentRowIndex < rows.length) {
      paginator.ensureFits(rows[currentRowIndex].height);
    }
  }
}

/**
 * Layout an image block onto pages.
 */
function layoutImage(
  block: ImageBlock,
  measure: ImageMeasure,
  paginator: ReturnType<typeof createPaginator>
): void {
  if (measure.kind !== 'image') {
    throw new Error(`layoutImage: expected image measure`);
  }

  // Handle anchored images differently
  if (block.anchor?.isAnchored) {
    layoutAnchoredImage(block, measure, paginator);
    return;
  }

  // Inline image - ensure it fits
  const state = paginator.ensureFits(measure.height);

  const fragment: ImageFragment = {
    kind: 'image',
    blockId: block.id,
    x: paginator.getColumnX(state.columnIndex),
    y: 0, // Will be set by addFragment
    width: measure.width,
    height: measure.height,
    pmStart: block.pmStart,
    pmEnd: block.pmEnd,
  };

  const result = paginator.addFragment(fragment, measure.height, 0, 0);
  fragment.y = result.y;
}

/**
 * Layout an anchored (floating) image.
 */
function layoutAnchoredImage(
  block: ImageBlock,
  measure: ImageMeasure,
  paginator: ReturnType<typeof createPaginator>
): void {
  const state = paginator.getCurrentState();
  const anchor = block.anchor!;

  // Position based on anchor offsets
  const x = anchor.offsetH ?? paginator.getColumnX(state.columnIndex);
  const y = anchor.offsetV ?? state.cursorY;

  const fragment: ImageFragment = {
    kind: 'image',
    blockId: block.id,
    x,
    y,
    width: measure.width,
    height: measure.height,
    pmStart: block.pmStart,
    pmEnd: block.pmEnd,
    isAnchored: true,
    zIndex: anchor.behindDoc ? -1 : 1,
  };

  // Add directly to page without affecting cursor
  state.page.fragments.push(fragment);
}

/**
 * Handle a section break block.
 */
function handleSectionBreak(
  block: { type?: 'continuous' | 'nextPage' | 'evenPage' | 'oddPage' },
  paginator: ReturnType<typeof createPaginator>
): void {
  const breakType = block.type ?? 'continuous';

  switch (breakType) {
    case 'nextPage':
      paginator.forcePageBreak();
      break;

    case 'evenPage': {
      const state = paginator.forcePageBreak();
      // If landed on odd page, add another page
      if (state.page.number % 2 !== 0) {
        paginator.forcePageBreak();
      }
      break;
    }

    case 'oddPage': {
      const state = paginator.forcePageBreak();
      // If landed on even page, add another page
      if (state.page.number % 2 === 0) {
        paginator.forcePageBreak();
      }
      break;
    }

    case 'continuous':
      // No page break, content continues
      break;
  }
}

// Re-export types
export * from './types';
export { createPaginator } from './paginator';
export type { PageState, PaginatorOptions, Paginator } from './paginator';
export {
  computeKeepNextChains,
  calculateChainHeight,
  getMidChainIndices,
  hasKeepLines,
  hasPageBreakBefore,
} from './keep-together';
export type { KeepNextChain } from './keep-together';
export {
  scheduleSectionBreak,
  applyPendingToActive,
  createInitialSectionState,
  getEffectiveMargins,
  getEffectivePageSize,
  getEffectiveColumns,
} from './section-breaks';
export type { SectionState, BreakDecision } from './section-breaks';
