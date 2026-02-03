/**
 * Section Breaks - Handle page layout changes at section boundaries
 *
 * Sections in DOCX can have different page sizes, margins, columns, and orientations.
 * This module manages the state transitions between sections during layout.
 */

import type { SectionBreakBlock, PageMargins, ColumnLayout } from './types';

/**
 * State tracking for sections during layout.
 * Uses active/pending pattern to schedule changes at page boundaries.
 */
export type SectionState = {
  /** Currently active top margin. */
  activeTopMargin: number;
  /** Currently active bottom margin. */
  activeBottomMargin: number;
  /** Currently active left margin. */
  activeLeftMargin: number;
  /** Currently active right margin. */
  activeRightMargin: number;
  /** Scheduled top margin for next page. */
  pendingTopMargin: number | null;
  /** Scheduled bottom margin for next page. */
  pendingBottomMargin: number | null;
  /** Scheduled left margin for next page. */
  pendingLeftMargin: number | null;
  /** Scheduled right margin for next page. */
  pendingRightMargin: number | null;
  /** Currently active page size. */
  activePageSize: { w: number; h: number };
  /** Scheduled page size for next page. */
  pendingPageSize: { w: number; h: number } | null;
  /** Currently active column layout. */
  activeColumns: ColumnLayout;
  /** Scheduled column layout for next page. */
  pendingColumns: ColumnLayout | null;
  /** Currently active orientation. */
  activeOrientation: 'portrait' | 'landscape' | null;
  /** Scheduled orientation for next page. */
  pendingOrientation: 'portrait' | 'landscape' | null;
  /** Whether any pages have been created yet. */
  hasAnyPages: boolean;
};

/**
 * Decision about what happens at a section break.
 */
export type BreakDecision = {
  /** Force a page break. */
  forcePageBreak: boolean;
  /** Force a mid-page region change (for column layout changes). */
  forceMidPageRegion: boolean;
  /** Required page parity (even or odd). */
  requiredParity?: 'even' | 'odd';
};

/**
 * Default single-column layout.
 */
const DEFAULT_COLUMNS: ColumnLayout = { count: 1, gap: 0 };

/**
 * Create initial section state from default options.
 */
export function createInitialSectionState(
  margins: PageMargins,
  pageSize: { w: number; h: number },
  columns?: ColumnLayout
): SectionState {
  return {
    activeTopMargin: margins.top,
    activeBottomMargin: margins.bottom,
    activeLeftMargin: margins.left,
    activeRightMargin: margins.right,
    pendingTopMargin: null,
    pendingBottomMargin: null,
    pendingLeftMargin: null,
    pendingRightMargin: null,
    activePageSize: { ...pageSize },
    pendingPageSize: null,
    activeColumns: columns ? { ...columns } : { ...DEFAULT_COLUMNS },
    pendingColumns: null,
    activeOrientation: null,
    pendingOrientation: null,
    hasAnyPages: false,
  };
}

/**
 * Check if column configuration is changing.
 */
function isColumnsChanging(
  newColumns: ColumnLayout | undefined,
  activeColumns: ColumnLayout
): boolean {
  if (newColumns) {
    return newColumns.count !== activeColumns.count || newColumns.gap !== activeColumns.gap;
  }
  // No columns specified = reset to single column (DOCX default)
  // This is only a change if currently in multi-column layout
  return activeColumns.count > 1;
}

/**
 * Get column configuration, defaulting to single column if not specified.
 */
function getColumnConfig(columns: ColumnLayout | undefined): ColumnLayout {
  return columns ? { count: columns.count, gap: columns.gap } : { ...DEFAULT_COLUMNS };
}

/**
 * Schedule section break effects by analyzing the break type and updating state.
 *
 * This determines what layout changes should occur (page break, column changes)
 * and schedules the new section properties to be applied at the appropriate boundary.
 */
export function scheduleSectionBreak(
  block: SectionBreakBlock,
  state: SectionState,
  _baseMargins: PageMargins
): { decision: BreakDecision; state: SectionState } {
  const next = { ...state };

  // Extract section break properties
  const sectionType = block.type ?? 'continuous';
  const sectionMargins = block.margins;
  const sectionPageSize = block.pageSize;
  const sectionOrientation = block.orientation;

  // Schedule margin changes
  if (sectionMargins) {
    if (typeof sectionMargins.top === 'number') {
      next.pendingTopMargin = Math.max(0, sectionMargins.top);
    }
    if (typeof sectionMargins.bottom === 'number') {
      next.pendingBottomMargin = Math.max(0, sectionMargins.bottom);
    }
    if (typeof sectionMargins.left === 'number') {
      next.pendingLeftMargin = Math.max(0, sectionMargins.left);
    }
    if (typeof sectionMargins.right === 'number') {
      next.pendingRightMargin = Math.max(0, sectionMargins.right);
    }
  }

  // Schedule page size change
  if (sectionPageSize) {
    next.pendingPageSize = { w: sectionPageSize.w, h: sectionPageSize.h };
  }

  // Schedule orientation change
  if (sectionOrientation) {
    next.pendingOrientation = sectionOrientation;
  }

  // Detect column changes
  const columnsChanging = isColumnsChanging(
    block.margins ? undefined : undefined, // columns would come from block if we support them
    next.activeColumns
  );

  // Determine break decision based on section type
  switch (sectionType) {
    case 'nextPage':
      next.pendingColumns = getColumnConfig(undefined);
      return {
        decision: { forcePageBreak: true, forceMidPageRegion: false },
        state: next,
      };

    case 'evenPage':
      next.pendingColumns = getColumnConfig(undefined);
      return {
        decision: { forcePageBreak: true, forceMidPageRegion: false, requiredParity: 'even' },
        state: next,
      };

    case 'oddPage':
      next.pendingColumns = getColumnConfig(undefined);
      return {
        decision: { forcePageBreak: true, forceMidPageRegion: false, requiredParity: 'odd' },
        state: next,
      };

    case 'continuous':
    default:
      if (columnsChanging) {
        // Mid-page column layout change
        next.pendingColumns = getColumnConfig(undefined);
        return {
          decision: { forcePageBreak: false, forceMidPageRegion: true },
          state: next,
        };
      }
      // No changes needed
      return {
        decision: { forcePageBreak: false, forceMidPageRegion: false },
        state: next,
      };
  }
}

/**
 * Apply pending section state to active state at a page boundary.
 * Transfers all pending values to active and clears pending.
 */
export function applyPendingToActive(state: SectionState): SectionState {
  const next = { ...state };

  // Apply pending margins
  if (next.pendingTopMargin !== null) {
    next.activeTopMargin = next.pendingTopMargin;
    next.pendingTopMargin = null;
  }
  if (next.pendingBottomMargin !== null) {
    next.activeBottomMargin = next.pendingBottomMargin;
    next.pendingBottomMargin = null;
  }
  if (next.pendingLeftMargin !== null) {
    next.activeLeftMargin = next.pendingLeftMargin;
    next.pendingLeftMargin = null;
  }
  if (next.pendingRightMargin !== null) {
    next.activeRightMargin = next.pendingRightMargin;
    next.pendingRightMargin = null;
  }

  // Apply pending page size
  if (next.pendingPageSize !== null) {
    next.activePageSize = next.pendingPageSize;
    next.pendingPageSize = null;
  }

  // Apply pending columns
  if (next.pendingColumns !== null) {
    next.activeColumns = next.pendingColumns;
    next.pendingColumns = null;
  }

  // Apply pending orientation
  if (next.pendingOrientation !== null) {
    next.activeOrientation = next.pendingOrientation;
    next.pendingOrientation = null;
  }

  return next;
}

/**
 * Get the effective margins for the current section state.
 * Returns active margins, or pending if scheduled.
 */
export function getEffectiveMargins(state: SectionState): PageMargins {
  return {
    top: state.pendingTopMargin ?? state.activeTopMargin,
    bottom: state.pendingBottomMargin ?? state.activeBottomMargin,
    left: state.pendingLeftMargin ?? state.activeLeftMargin,
    right: state.pendingRightMargin ?? state.activeRightMargin,
  };
}

/**
 * Get the effective page size for the current section state.
 */
export function getEffectivePageSize(state: SectionState): { w: number; h: number } {
  return state.pendingPageSize ?? state.activePageSize;
}

/**
 * Get the effective columns for the current section state.
 */
export function getEffectiveColumns(state: SectionState): ColumnLayout {
  return state.pendingColumns ?? state.activeColumns;
}
