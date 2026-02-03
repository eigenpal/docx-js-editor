/**
 * Paginator - manages page state during layout
 *
 * Tracks the current page, cursor position, and available space.
 * Creates new pages when content doesn't fit.
 */

import type { Page, PageMargins, Fragment, ColumnLayout } from './types';

/**
 * Current state of a page being laid out.
 */
export type PageState = {
  /** The page being built. */
  page: Page;
  /** Current Y position (cursor) from page top. */
  cursorY: number;
  /** Current column index (0-based). */
  columnIndex: number;
  /** Top margin of content area. */
  topMargin: number;
  /** Bottom boundary of content area (page height - bottom margin). */
  contentBottom: number;
  /** Accumulated trailing spacing (space after previous block). */
  trailingSpacing: number;
};

/**
 * Options for creating a paginator.
 */
export type PaginatorOptions = {
  /** Page size (width, height). */
  pageSize: { w: number; h: number };
  /** Page margins. */
  margins: PageMargins;
  /** Column configuration (optional). */
  columns?: ColumnLayout;
  /** Callback when a new page is created. */
  onNewPage?: (state: PageState) => void;
};

/**
 * Calculate the width of a single column.
 */
function calculateColumnWidth(
  pageWidth: number,
  leftMargin: number,
  rightMargin: number,
  columns: ColumnLayout
): number {
  const contentWidth = pageWidth - leftMargin - rightMargin;
  const totalGaps = (columns.count - 1) * columns.gap;
  return (contentWidth - totalGaps) / columns.count;
}

/**
 * Creates a paginator for managing page layout state.
 */
export function createPaginator(options: PaginatorOptions) {
  const { pageSize, margins, columns = { count: 1, gap: 0 } } = options;

  const pages: Page[] = [];
  const states: PageState[] = [];

  // Calculate content boundaries
  const topMargin = margins.top;
  const contentBottom = pageSize.h - margins.bottom;
  const contentHeight = contentBottom - topMargin;

  if (contentHeight <= 0) {
    throw new Error('Paginator: page size and margins yield no content area');
  }

  // Calculate column width
  const columnWidth = calculateColumnWidth(pageSize.w, margins.left, margins.right, columns);

  /**
   * Get X position for a given column index.
   */
  function getColumnX(columnIndex: number): number {
    return margins.left + columnIndex * (columnWidth + columns.gap);
  }

  /**
   * Create a new page and add it to the list.
   */
  function createNewPage(): PageState {
    const pageNumber = pages.length + 1;

    const page: Page = {
      number: pageNumber,
      fragments: [],
      margins: { ...margins },
      size: { ...pageSize },
    };

    const state: PageState = {
      page,
      cursorY: topMargin,
      columnIndex: 0,
      topMargin,
      contentBottom,
      trailingSpacing: 0,
    };

    pages.push(page);
    states.push(state);

    if (options.onNewPage) {
      options.onNewPage(state);
    }

    return state;
  }

  /**
   * Get the current page state, creating one if none exists.
   */
  function getCurrentState(): PageState {
    if (states.length === 0) {
      return createNewPage();
    }
    return states[states.length - 1];
  }

  /**
   * Get available height remaining on the current column.
   */
  function getAvailableHeight(state: PageState): number {
    return state.contentBottom - state.cursorY;
  }

  /**
   * Check if the given height fits in the current column.
   */
  function fits(height: number, state?: PageState): boolean {
    const s = state || getCurrentState();
    return getAvailableHeight(s) >= height;
  }

  /**
   * Advance to the next column, or create a new page if no more columns.
   */
  function advanceColumn(state: PageState): PageState {
    // Check if there are more columns on this page
    if (state.columnIndex < columns.count - 1) {
      state.columnIndex += 1;
      state.cursorY = state.topMargin;
      state.trailingSpacing = 0;
      return state;
    }

    // No more columns, create new page
    return createNewPage();
  }

  /**
   * Ensure content of given height can fit.
   * Advances column or creates new page if needed.
   * Returns the state to use for placement.
   */
  function ensureFits(height: number): PageState {
    let state = getCurrentState();

    // Keep advancing until we have space
    while (!fits(height, state)) {
      state = advanceColumn(state);
    }

    return state;
  }

  /**
   * Add a fragment to the current page at the cursor position.
   * Updates cursor position after placement.
   */
  function addFragment(
    fragment: Fragment,
    height: number,
    spaceBefore: number = 0,
    spaceAfter: number = 0
  ): { state: PageState; x: number; y: number } {
    // Collapse space before with trailing spacing from previous block
    const effectiveSpaceBefore = Math.max(spaceBefore, getCurrentState().trailingSpacing);
    const totalHeight = effectiveSpaceBefore + height;

    // Ensure we have space
    const state = ensureFits(totalHeight);

    // If we moved to a new page/column, no space before needed
    const isAtTop = state.cursorY === state.topMargin;
    const actualSpaceBefore = isAtTop ? 0 : effectiveSpaceBefore;

    // Calculate position
    const x = getColumnX(state.columnIndex);
    const y = state.cursorY + actualSpaceBefore;

    // Position the fragment
    fragment.x = x;
    fragment.y = y;

    // Add to page
    state.page.fragments.push(fragment);

    // Update cursor
    state.cursorY = y + height;
    state.trailingSpacing = spaceAfter;

    return { state, x, y };
  }

  /**
   * Force a page break - move to a new page.
   */
  function forcePageBreak(): PageState {
    return createNewPage();
  }

  /**
   * Force a column break - move to next column or new page.
   */
  function forceColumnBreak(): PageState {
    const state = getCurrentState();
    return advanceColumn(state);
  }

  return {
    /** All pages created so far. */
    pages,
    /** All page states. */
    states,
    /** Column width in pixels. */
    columnWidth,
    /** Get current state. */
    getCurrentState,
    /** Get available height in current column. */
    getAvailableHeight: () => getAvailableHeight(getCurrentState()),
    /** Check if height fits in current column. */
    fits: (height: number) => fits(height),
    /** Ensure height fits, advancing if needed. */
    ensureFits,
    /** Add a fragment to current page. */
    addFragment,
    /** Force a page break. */
    forcePageBreak,
    /** Force a column break. */
    forceColumnBreak,
    /** Get X position for column. */
    getColumnX,
  } as const;
}

export type Paginator = ReturnType<typeof createPaginator>;
