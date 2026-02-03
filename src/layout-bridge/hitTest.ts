/**
 * Hit Testing Utilities
 *
 * Maps click coordinates to pages, fragments, and document positions.
 * Used by the paged editor to translate user clicks into PM positions.
 */

import type {
  Layout,
  Page,
  Fragment,
  ParagraphFragment,
  TableFragment,
  FlowBlock,
  Measure,
  ParagraphBlock,
  ParagraphMeasure,
  TableBlock,
  TableMeasure,
  BlockId,
} from '../layout-engine/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * A 2D point in page coordinate space.
 */
export type Point = {
  x: number;
  y: number;
};

/**
 * Result of hit-testing to find which page contains a point.
 */
export type PageHit = {
  /** Index of the page (0-based). */
  pageIndex: number;
  /** The page that was hit. */
  page: Page;
  /** Y position relative to the page top. */
  pageY: number;
};

/**
 * Result of hit-testing to find which fragment contains a point.
 */
export type FragmentHit = {
  /** The fragment that was hit. */
  fragment: Fragment;
  /** The corresponding flow block. */
  block: FlowBlock;
  /** The corresponding measurement. */
  measure: Measure;
  /** Page index (0-based). */
  pageIndex: number;
  /** Y position relative to the fragment top. */
  localY: number;
  /** X position relative to the fragment left. */
  localX: number;
};

/**
 * Result of hit-testing a table to find the cell.
 */
export type TableCellHit = {
  /** The table fragment. */
  fragment: TableFragment;
  /** The table block. */
  block: TableBlock;
  /** The table measure. */
  measure: TableMeasure;
  /** Page index (0-based). */
  pageIndex: number;
  /** Row index (0-based). */
  rowIndex: number;
  /** Column index (0-based). */
  colIndex: number;
  /** Paragraph block within the cell (first one). */
  cellBlock?: ParagraphBlock;
  /** Paragraph measure within the cell. */
  cellMeasure?: ParagraphMeasure;
  /** X position relative to cell content area. */
  cellLocalX: number;
  /** Y position relative to cell content area. */
  cellLocalY: number;
};

// =============================================================================
// PAGE HIT TESTING
// =============================================================================

/**
 * Hit-test pages to find which page contains a given Y coordinate.
 *
 * Pages are stacked vertically with optional gaps between them.
 * If the point is in a gap, returns the nearest page.
 *
 * @param layout - The layout containing pages.
 * @param point - The point to test (only Y is used for page lookup).
 * @returns PageHit if a page was found, null otherwise.
 */
export function hitTestPage(layout: Layout, point: Point): PageHit | null {
  if (layout.pages.length === 0) {
    return null;
  }

  const pageGap = layout.pageGap ?? 0;
  let cursorY = 0;

  // Track nearest page for gap hits
  let nearestPageIndex: number | null = null;
  let nearestDistance = Infinity;

  for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex++) {
    const page = layout.pages[pageIndex];
    const pageHeight = page.size?.h ?? layout.pageSize.h;
    const pageTop = cursorY;
    const pageBottom = pageTop + pageHeight;

    // Check if point is within this page
    if (point.y >= pageTop && point.y < pageBottom) {
      return {
        pageIndex,
        page,
        pageY: point.y - pageTop,
      };
    }

    // Track nearest page by distance to page center
    const pageCenter = pageTop + pageHeight / 2;
    const distance = Math.abs(point.y - pageCenter);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPageIndex = pageIndex;
    }

    // Move to next page (add gap after)
    cursorY = pageBottom + pageGap;
  }

  // If point is in a gap or outside, return nearest page
  if (nearestPageIndex !== null) {
    const page = layout.pages[nearestPageIndex];
    const pageTop = getPageTop(layout, nearestPageIndex);
    return {
      pageIndex: nearestPageIndex,
      page,
      pageY: Math.max(0, Math.min(point.y - pageTop, page.size?.h ?? layout.pageSize.h)),
    };
  }

  return null;
}

/**
 * Calculate the Y offset of a page from the top of the document.
 */
export function getPageTop(layout: Layout, pageIndex: number): number {
  const pageGap = layout.pageGap ?? 0;
  let y = 0;

  for (let i = 0; i < pageIndex && i < layout.pages.length; i++) {
    const page = layout.pages[i];
    const pageHeight = page.size?.h ?? layout.pageSize.h;
    y += pageHeight + pageGap;
  }

  return y;
}

/**
 * Get the page index at a specific Y coordinate.
 * Returns null if the coordinate is outside all pages.
 */
export function getPageIndexAtY(layout: Layout, y: number): number | null {
  const hit = hitTestPage(layout, { x: 0, y });
  return hit?.pageIndex ?? null;
}

// =============================================================================
// FRAGMENT HIT TESTING
// =============================================================================

/**
 * Find a block by its ID in the blocks array.
 */
function findBlockIndexById(blocks: FlowBlock[], blockId: BlockId): number {
  return blocks.findIndex((block) => block.id === blockId);
}

/**
 * Calculate the actual height of a paragraph fragment from its lines.
 */
function calculateParagraphFragmentHeight(
  fragment: ParagraphFragment,
  measure: ParagraphMeasure
): number {
  let height = 0;
  for (let i = fragment.fromLine; i < fragment.toLine && i < measure.lines.length; i++) {
    height += measure.lines[i].lineHeight;
  }
  return height;
}

/**
 * Hit-test fragments on a page to find which fragment contains a point.
 *
 * Fragments are checked in visual order (sorted by Y then X).
 * Only considers paragraph and table fragments (not images for now).
 *
 * @param pageHit - The page hit result from hitTestPage.
 * @param blocks - All flow blocks in the document.
 * @param measures - All measurements corresponding to blocks.
 * @param pagePoint - Point in page-relative coordinates.
 * @returns FragmentHit if a fragment was found, null otherwise.
 */
export function hitTestFragment(
  pageHit: PageHit,
  blocks: FlowBlock[],
  measures: Measure[],
  pagePoint: Point
): FragmentHit | null {
  // Sort fragments by Y, then X for consistent hit testing
  const sortedFragments = [...pageHit.page.fragments].sort((a, b) => {
    const dy = a.y - b.y;
    if (Math.abs(dy) > 0.5) return dy;
    return a.x - b.x;
  });

  for (const fragment of sortedFragments) {
    const blockIndex = findBlockIndexById(blocks, fragment.blockId);
    if (blockIndex === -1) continue;

    const block = blocks[blockIndex];
    const measure = measures[blockIndex];
    if (!block || !measure) continue;

    // Calculate fragment bounds based on type
    let fragmentHeight: number;

    if (fragment.kind === 'paragraph') {
      if (block.kind !== 'paragraph' || measure.kind !== 'paragraph') continue;
      fragmentHeight = calculateParagraphFragmentHeight(fragment, measure);
    } else if (fragment.kind === 'table') {
      fragmentHeight = fragment.height;
    } else if (fragment.kind === 'image') {
      fragmentHeight = fragment.height;
    } else {
      continue;
    }

    // Check if point is within fragment bounds
    const withinX = pagePoint.x >= fragment.x && pagePoint.x <= fragment.x + fragment.width;
    const withinY = pagePoint.y >= fragment.y && pagePoint.y <= fragment.y + fragmentHeight;

    if (withinX && withinY) {
      return {
        fragment,
        block,
        measure,
        pageIndex: pageHit.pageIndex,
        localX: pagePoint.x - fragment.x,
        localY: pagePoint.y - fragment.y,
      };
    }
  }

  return null;
}

/**
 * Hit-test to find image fragments (they may overlap other content).
 */
export function hitTestImageFragment(
  pageHit: PageHit,
  blocks: FlowBlock[],
  measures: Measure[],
  pagePoint: Point
): FragmentHit | null {
  for (const fragment of pageHit.page.fragments) {
    if (fragment.kind !== 'image') continue;

    const blockIndex = findBlockIndexById(blocks, fragment.blockId);
    if (blockIndex === -1) continue;

    const block = blocks[blockIndex];
    const measure = measures[blockIndex];
    if (!block || !measure) continue;

    const withinX = pagePoint.x >= fragment.x && pagePoint.x <= fragment.x + fragment.width;
    const withinY = pagePoint.y >= fragment.y && pagePoint.y <= fragment.y + fragment.height;

    if (withinX && withinY) {
      return {
        fragment,
        block,
        measure,
        pageIndex: pageHit.pageIndex,
        localX: pagePoint.x - fragment.x,
        localY: pagePoint.y - fragment.y,
      };
    }
  }

  return null;
}

// =============================================================================
// TABLE CELL HIT TESTING
// =============================================================================

/**
 * Hit-test within a table fragment to find the specific cell.
 *
 * @param pageHit - The page hit result.
 * @param blocks - All flow blocks.
 * @param measures - All measurements.
 * @param pagePoint - Point in page-relative coordinates.
 * @returns TableCellHit if a table cell was found, null otherwise.
 */
export function hitTestTableCell(
  pageHit: PageHit,
  blocks: FlowBlock[],
  measures: Measure[],
  pagePoint: Point
): TableCellHit | null {
  for (const fragment of pageHit.page.fragments) {
    if (fragment.kind !== 'table') continue;

    const tableFragment = fragment as TableFragment;

    // Check if point is within table bounds
    const withinX =
      pagePoint.x >= tableFragment.x && pagePoint.x <= tableFragment.x + tableFragment.width;
    const withinY =
      pagePoint.y >= tableFragment.y && pagePoint.y <= tableFragment.y + tableFragment.height;
    if (!withinX || !withinY) continue;

    const blockIndex = findBlockIndexById(blocks, tableFragment.blockId);
    if (blockIndex === -1) continue;

    const block = blocks[blockIndex];
    const measure = measures[blockIndex];
    if (!block || block.kind !== 'table' || !measure || measure.kind !== 'table') continue;

    const tableBlock = block as TableBlock;
    const tableMeasure = measure as TableMeasure;

    // Calculate local position within table
    const localX = pagePoint.x - tableFragment.x;
    const localY = pagePoint.y - tableFragment.y;

    // Find row at localY
    let rowY = 0;
    let rowIndex = -1;

    if (tableMeasure.rows.length === 0 || tableBlock.rows.length === 0) continue;

    for (
      let r = tableFragment.fromRow;
      r < tableFragment.toRow && r < tableMeasure.rows.length;
      r++
    ) {
      const rowMeasure = tableMeasure.rows[r];
      if (localY >= rowY && localY < rowY + rowMeasure.height) {
        rowIndex = r;
        break;
      }
      rowY += rowMeasure.height;
    }

    // If no row found, use last row
    if (rowIndex === -1) {
      rowIndex = Math.min(tableFragment.toRow - 1, tableMeasure.rows.length - 1);
      if (rowIndex < tableFragment.fromRow) continue;
    }

    const rowMeasure = tableMeasure.rows[rowIndex];
    const row = tableBlock.rows[rowIndex];
    if (!rowMeasure || !row) continue;

    // Find column at localX
    let colX = 0;
    let colIndex = -1;

    if (rowMeasure.cells.length === 0 || row.cells.length === 0) continue;

    for (let c = 0; c < rowMeasure.cells.length; c++) {
      const cellMeasure = rowMeasure.cells[c];
      if (localX >= colX && localX < colX + cellMeasure.width) {
        colIndex = c;
        break;
      }
      colX += cellMeasure.width;
    }

    // If no column found, use last column
    if (colIndex === -1) {
      colIndex = rowMeasure.cells.length - 1;
      if (colIndex < 0) continue;
    }

    const cellMeasure = rowMeasure.cells[colIndex];
    const cell = row.cells[colIndex];
    if (!cellMeasure || !cell) continue;

    // Find the cumulative row Y for the found row
    let rowTop = 0;
    for (let r = tableFragment.fromRow; r < rowIndex; r++) {
      rowTop += tableMeasure.rows[r]?.height ?? 0;
    }

    // Find the cumulative column X for the found column
    let colLeft = 0;
    for (let c = 0; c < colIndex; c++) {
      colLeft += rowMeasure.cells[c]?.width ?? 0;
    }

    // Get first paragraph in cell
    let cellBlock: ParagraphBlock | undefined;
    let cellBlockMeasure: ParagraphMeasure | undefined;

    if (cell.blocks && cell.blocks.length > 0) {
      const firstBlock = cell.blocks[0];
      const firstMeasure = cellMeasure.blocks[0];
      if (firstBlock.kind === 'paragraph' && firstMeasure?.kind === 'paragraph') {
        cellBlock = firstBlock as ParagraphBlock;
        cellBlockMeasure = firstMeasure as ParagraphMeasure;
      }
    }

    // Calculate position within cell (rough - doesn't account for padding)
    const cellLocalX = localX - colLeft;
    const cellLocalY = localY - rowTop;

    return {
      fragment: tableFragment,
      block: tableBlock,
      measure: tableMeasure,
      pageIndex: pageHit.pageIndex,
      rowIndex,
      colIndex,
      cellBlock,
      cellMeasure: cellBlockMeasure,
      cellLocalX: Math.max(0, cellLocalX),
      cellLocalY: Math.max(0, cellLocalY),
    };
  }

  return null;
}

// =============================================================================
// COMBINED HIT TESTING
// =============================================================================

/**
 * Combined result of all hit testing.
 */
export type HitTestResult = {
  /** Page that was hit. */
  pageHit: PageHit | null;
  /** Fragment that was hit (if any). */
  fragmentHit: FragmentHit | null;
  /** Table cell that was hit (if fragment is a table). */
  tableCellHit: TableCellHit | null;
};

/**
 * Perform complete hit testing from document coordinates to the most specific element.
 *
 * @param layout - The layout containing pages.
 * @param blocks - All flow blocks.
 * @param measures - All measurements.
 * @param point - Point in document coordinates (Y is cumulative from document top).
 * @returns Complete hit test result.
 */
export function hitTest(
  layout: Layout,
  blocks: FlowBlock[],
  measures: Measure[],
  point: Point
): HitTestResult {
  const result: HitTestResult = {
    pageHit: null,
    fragmentHit: null,
    tableCellHit: null,
  };

  // First, find the page
  result.pageHit = hitTestPage(layout, point);
  if (!result.pageHit) {
    return result;
  }

  // Convert to page-relative coordinates
  const pageTop = getPageTop(layout, result.pageHit.pageIndex);
  const pagePoint: Point = {
    x: point.x,
    y: point.y - pageTop,
  };

  // Find the fragment
  result.fragmentHit = hitTestFragment(result.pageHit, blocks, measures, pagePoint);

  // If fragment is a table, find the cell
  if (result.fragmentHit?.fragment.kind === 'table') {
    result.tableCellHit = hitTestTableCell(result.pageHit, blocks, measures, pagePoint);
  }

  return result;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get the total document height (all pages + gaps).
 */
export function getTotalDocumentHeight(layout: Layout): number {
  if (layout.pages.length === 0) return 0;

  const pageGap = layout.pageGap ?? 0;
  let height = 0;

  for (let i = 0; i < layout.pages.length; i++) {
    const page = layout.pages[i];
    height += page.size?.h ?? layout.pageSize.h;
    if (i < layout.pages.length - 1) {
      height += pageGap;
    }
  }

  return height;
}

/**
 * Get Y coordinate to scroll to for a specific page.
 */
export function getScrollYForPage(layout: Layout, pageIndex: number): number {
  return getPageTop(layout, pageIndex);
}

/**
 * Get page bounds (top and bottom Y coordinates).
 */
export function getPageBounds(
  layout: Layout,
  pageIndex: number
): { top: number; bottom: number } | null {
  if (pageIndex < 0 || pageIndex >= layout.pages.length) {
    return null;
  }

  const top = getPageTop(layout, pageIndex);
  const page = layout.pages[pageIndex];
  const height = page.size?.h ?? layout.pageSize.h;

  return {
    top,
    bottom: top + height,
  };
}

/**
 * Check if a point is within the content area of a page (inside margins).
 */
export function isPointInContentArea(_layout: Layout, pageHit: PageHit, pagePoint: Point): boolean {
  const page = pageHit.page;
  const margins = page.margins;

  const contentLeft = margins.left;
  const contentRight = page.size.w - margins.right;
  const contentTop = margins.top;
  const contentBottom = page.size.h - margins.bottom;

  return (
    pagePoint.x >= contentLeft &&
    pagePoint.x <= contentRight &&
    pagePoint.y >= contentTop &&
    pagePoint.y <= contentBottom
  );
}

/**
 * Find the nearest fragment to a point on a page.
 * Useful when the click is in whitespace.
 */
export function findNearestFragment(
  pageHit: PageHit,
  blocks: FlowBlock[],
  measures: Measure[],
  pagePoint: Point
): FragmentHit | null {
  let nearestHit: FragmentHit | null = null;
  let nearestDistance = Infinity;

  for (const fragment of pageHit.page.fragments) {
    const blockIndex = findBlockIndexById(blocks, fragment.blockId);
    if (blockIndex === -1) continue;

    const block = blocks[blockIndex];
    const measure = measures[blockIndex];
    if (!block || !measure) continue;

    // Calculate fragment height
    let height: number;
    if (fragment.kind === 'paragraph' && measure.kind === 'paragraph') {
      height = calculateParagraphFragmentHeight(fragment, measure);
    } else if (fragment.kind === 'table' || fragment.kind === 'image') {
      height = fragment.height;
    } else {
      continue;
    }

    // Calculate distance to fragment center
    const centerX = fragment.x + fragment.width / 2;
    const centerY = fragment.y + height / 2;
    const distance = Math.sqrt(
      Math.pow(pagePoint.x - centerX, 2) + Math.pow(pagePoint.y - centerY, 2)
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestHit = {
        fragment,
        block,
        measure,
        pageIndex: pageHit.pageIndex,
        localX: Math.max(0, Math.min(pagePoint.x - fragment.x, fragment.width)),
        localY: Math.max(0, Math.min(pagePoint.y - fragment.y, height)),
      };
    }
  }

  return nearestHit;
}
