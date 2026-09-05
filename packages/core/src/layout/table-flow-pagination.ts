// Placing ONE top-level table into the body flow, row by row, across page breaks.
//
// Lifted out of the story loop because it is the one block kind whose placement is a loop of
// its own: a table advances the same cursor a paragraph does, but it decides per ROW whether
// to place, move, split or fail, and it re-emits repeated header rows on every page it runs
// onto. Keeping that beside paragraph fragmentation buried both.
//
// The flow it advances arrives as {@link TableFlowCursor}: the cursor itself, the geometry
// getters that answer where the column is and how much page is left, and the sinks a placed
// row publishes into. Everything the paginator needs to mutate is on that object, so the
// story loop keeps ownership of the cursor and this module keeps the row rules.

import type { OoxmlElement } from '@docx-editor.dev/core/store';
import {
  finalizeTableRows,
  initialCellCursors,
  layoutRowFragment,
  layoutRowFragmentBounded,
  measureRowHeight,
  MAX_TABLE_ROW_FRAGMENTS,
  rowWithSplitBorders,
  TablePaginationError,
  vMergePlanFor,
  type CellPlaceCursor,
  type TableFlowDeps,
} from './semantic-table-layout.ts';
import { probeRowFragmentProgress } from './table-row-progress-probe.ts';
import { admitVMergeSpansAt, type RowVMergeLayoutOptions } from './table-vmerge-heights.ts';
import { annotateTableFragmentGeometry } from './semantic-table-interaction.ts';
import {
  readTableStructure,
  tableFloatOriginX,
  tableOriginX,
  type SemanticTableRow,
  type TableAnchorFrames,
} from './semantic-table.ts';
import { tableFloatOriginY, type TableVerticalAnchorFrames } from './table-float-position.ts';
import { shiftBlocks } from './table-fragment-finalize.ts';
import type { StyleCascadeTable } from './style-cascade.ts';
import type { RevisionAuthorFilter, RevisionDisplayMode } from './revision-projection.ts';
import type {
  BlockFragmentRecord,
  TableFragmentRecord,
  TableRowFragmentRecord,
} from './semantic-records.ts';

/** The body flow a table is placed into: the cursor it moves, and what it publishes to. */
export interface TableFlowCursor {
  /** Points down the page content box. The paginator both reads and advances it. */
  cursorY: number;
  /** Width of the column being filled. */
  readonly columnWidth: () => number;
  /** Left edge of the column being filled, in page-content coordinates. */
  readonly columnLeft: () => number;
  /** Height available on the page being filled — note reserves already subtracted. */
  readonly contentHeight: () => number;
  /**
   * The same band with any footnote reserve IGNORED. Recovery seam for keep-together rows:
   * a `w:cantSplit` / `hRule=exact` row that exceeds the reserved band on a fresh page takes
   * the full band instead of aborting the layout. The reserve is advisory at this point —
   * the notes pass sizes its area from the body actually placed — so the overlap only
   * pushes that page's footnotes forward. Absent means the two bands are the same.
   */
  readonly unreservedContentHeight?: () => number;
  /** Move to the next column, or the next page when this was the last one. */
  readonly advanceColumn: () => void;
  /** Frames a `w:tblpPr` table positions against. */
  readonly anchorFrames: () => TableAnchorFrames;
  /** Vertical frames a `w:tblpPr` table positions against. */
  readonly verticalAnchorFrames: () => TableVerticalAnchorFrames;
  readonly styleCascade: StyleCascadeTable | undefined;
  readonly displayMode: RevisionDisplayMode;
  readonly revisionAuthorFilter?: RevisionAuthorFilter;
  readonly compatibilityMode?: number;
  readonly deps: TableFlowDeps;
  /**
   * Moves an anchored drawing already published by a placed row, when finalize shifts the
   * paragraph it belongs to. A callback for the same reason `publishFragment` is one: the
   * list it edits is replaced whenever a page completes.
   */
  readonly shiftAnchor: (paragraphId: string, dy: number) => void;
  /**
   * Publishes a finished table fragment onto the page being filled.
   *
   * A sink rather than the array itself: completing a page REPLACES the story loop's
   * fragment list, so a reference taken when the table started would collect the rest of
   * its fragments into an array nobody reads.
   */
  readonly publishFragment: (fragment: BlockFragmentRecord) => void;
}

export interface TableFlowPlacementResult {
  /** True when the table paints on the anchor sheet without advancing the body cursor. */
  readonly outOfFlow: boolean;
}

/** Enough vertical room to lay a positioned table as one visual object on its anchor sheet. */
const POSITIONED_TABLE_LAYOUT_BOTTOM_PT = Number.MAX_SAFE_INTEGER / 1024;

/**
 * Lay out one top-level table with OOXML-aligned row pagination.
 *
 * Preflights the real unsplit row height (not a one-line estimate). A row that fits on a
 * fresh page but not the current remainder moves whole. A row taller than a fresh page
 * fragments at paragraph/line boundaries when splittable; `w:cantSplit` and unsafe nested
 * cuts fail closed via {@link TablePaginationError} instead of overflowing contentHeight().
 * Contiguous leading `w:tblHeader` rows form one atomic repeated group: preflighted and
 * placed together, moved whole when the remainder is too short, re-emitted complete atop
 * each continuation page where the pending row can advance, and treated as ordinary rows
 * when the authored group itself exceeds a fresh content page.
 */
export function paginateTableInFlow(
  table: OoxmlElement,
  flow: TableFlowCursor
): TableFlowPlacementResult {
  const {
    columnWidth,
    columnLeft,
    contentHeight: flowContentHeight,
    advanceColumn,
    anchorFrames,
    verticalAnchorFrames,
    styleCascade,
    displayMode,
    revisionAuthorFilter,
    deps: tableDeps,
    shiftAnchor,
    publishFragment,
  } = flow;
  const regionWidth = columnWidth();
  const structure = readTableStructure(
    table,
    regionWidth,
    0,
    styleCascade,
    displayMode,
    revisionAuthorFilter,
    flow.compatibilityMode
  );
  if (!structure || structure.rows.length === 0) return { outOfFlow: false };
  const outOfFlow =
    structure.float !== undefined &&
    structure.float.vertAnchor !== 'text' &&
    structure.float.ySpec !== 'inline';
  const bodyCursorY = flow.cursorY;
  const verticalFrames = outOfFlow ? verticalAnchorFrames() : undefined;
  const contentHeight = outOfFlow
    ? (): number => POSITIONED_TABLE_LAYOUT_BOTTOM_PT
    : flowContentHeight;
  // `w:tblInd` / `w:jc` place the table inside the text column, `w:tblpPr` against a wider
  // anchor box; every row and the fragment box share the one origin so cell geometry and
  // the reported box cannot drift apart.
  const tableWidthPt = structure.columnWidthsPt.reduce((sum, column) => sum + column, 0);
  const originX = (): number =>
    structure.float
      ? tableFloatOriginX(structure.float, tableWidthPt, anchorFrames())
      : columnLeft() + tableOriginX(structure, columnWidth());
  let tableLeft = originX();
  // A text anchor offsets the current body position. Page and margin anchors are sheet
  // positions, so the table uses a private cursor and the body cursor is restored below.
  if (structure.float && structure.float.vertAnchor === 'text' && !structure.float.ySpec) {
    flow.cursorY = Math.max(0, Math.min(flow.cursorY + structure.float.yPt, contentHeight()));
  } else if (outOfFlow && structure.float && verticalFrames) {
    // Alignment needs the final table height. Start at the frame origin, then shift the
    // complete fragment in closeTableFragment once that height is known.
    flow.cursorY = tableFloatOriginY(structure.float, 0, verticalFrames);
  }
  /** One row's natural height where the table stands now. `tableLeft` moves; this reads it. */
  const rowHeightOf = (probeRow: SemanticTableRow): number =>
    measureRowHeight(
      probeRow,
      structure.columnWidthsPt,
      tableLeft,
      0,
      tableDeps,
      structure.cellSpacingPt
    );
  const headerRows: SemanticTableRow[] = [];
  for (const row of structure.rows) {
    if (row.isHeader) headerRows.push(row);
    else break;
  }
  // Word treats a header prefix taller than a true fresh page as ordinary authored rows. A note
  // reservation only shrinks an advisory band and must never split an otherwise valid prefix.
  let headerGroupHeight = 0;
  for (const headerRow of headerRows) headerGroupHeight += rowHeightOf(headerRow);
  let initialHeaderGroupDegraded =
    headerGroupHeight > (flow.unreservedContentHeight?.() ?? contentHeight()) + 0.001;
  let repeatsEnabled = !initialHeaderGroupDegraded;
  let fragmentIndex = 0;
  let fragmentTop = flow.cursorY;
  let rows: TableRowFragmentRecord[] = [];
  const rowOrdinals = new Map<string, number>();
  // Authored rows backing the open fragment (includes header repeats) for finalize.
  let sourceRows: (typeof structure.rows)[number][] = [];
  const closeTableFragment = (): void => {
    if (rows.length === 0) return;
    const finalized = finalizeTableRows(
      rows,
      structure,
      sourceRows,
      tableDeps.borderOwnershipBudget,
      tableDeps.vMergeResolveBudget,
      undefined,
      shiftAnchor,
      tableDeps
    );
    const last = finalized[finalized.length - 1]!;
    const fragment = annotateTableFragmentGeometry(
      {
        kind: 'table',
        ...(outOfFlow ? { outOfFlow: true as const } : {}),
        id: `${table.id}#f${fragmentIndex}`,
        tableId: table.id,
        fragmentIndex,
        rows: finalized,
        box: {
          x: tableLeft,
          y: fragmentTop,
          width: structure.columnWidthsPt.reduce((sum, columnWidth) => sum + columnWidth, 0),
          height: last.box.y + last.box.height - fragmentTop,
        },
      },
      structure.columnWidthsPt,
      0,
      rowOrdinals
    );
    let positionedFragment: TableFragmentRecord = fragment;
    if (outOfFlow && structure.float && verticalFrames) {
      const top = tableFloatOriginY(structure.float, fragment.box.height, verticalFrames);
      const dy = top - fragment.box.y;
      positionedFragment = shiftBlocks([fragment], dy)[0] as TableFragmentRecord;
      if (Math.abs(dy) > 0.001) {
        const shiftParagraphAnchors = (blocks: readonly BlockFragmentRecord[]): void => {
          for (const block of blocks) {
            if (block.kind === 'paragraph') shiftAnchor(block.paragraphId, dy);
            else {
              for (const row of block.rows) {
                for (const cell of row.cells) shiftParagraphAnchors(cell.blocks);
              }
            }
          }
        };
        for (const row of fragment.rows) {
          for (const cell of row.cells) shiftParagraphAnchors(cell.blocks);
        }
      }
    }
    publishFragment(positionedFragment);
    fragmentIndex += 1;
    rows = [];
    sourceRows = [];
  };

  /**
   * Place the contiguous leading header rows as one group. Never splits the group across
   * pages; a continuation omits the repeat when it would leave its pending body row stuck.
   */
  const placeHeaderGroup = (
    asRepeat: boolean,
    admitsBodyAfter?: (bodyTop: number) => boolean
  ): void => {
    if (headerRows.length === 0) return;

    const groupHeight = headerGroupHeight;
    // `breakForContinuation` already advanced to the target region before asking for a repeat.
    // If that region cannot carry the group, keep it for the pending body row instead of skipping
    // a usable nonzero-origin continuous-section column.
    if (asRepeat && flow.cursorY + groupHeight > contentHeight() + 0.001) return;
    if (flow.cursorY + groupHeight > contentHeight() + 0.001 && flow.cursorY > 0) {
      closeTableFragment();
      advanceColumn();
      tableLeft = originX();
      // The cursor, not 0: a same-sheet column advance opens at the column REGION top
      // (a continuous section shares its sheet), and a fragment box anchored at 0 would
      // stretch over whatever the earlier section already painted above the region.
      fragmentTop = flow.cursorY;
    }

    // A footnote reserve is advisory when it is the only obstruction to the atomic authored
    // prefix. Use the full physical content band; the notes pass will carry displaced notes on.
    const placementBottom =
      !asRepeat && flow.cursorY + groupHeight > contentHeight() + 0.001
        ? (flow.unreservedContentHeight?.() ?? contentHeight())
        : contentHeight();
    if (!asRepeat && flow.cursorY + groupHeight > placementBottom + 0.001) {
      initialHeaderGroupDegraded = true;
      repeatsEnabled = false;
      return;
    }

    // A repeated header is furniture for the pending body row, not a reason to reject that row.
    // Probe at the exact post-header position before committing any repeated lines or drawings.
    // If the row cannot advance there, Word suppresses the repeat on this continuation page.
    if (asRepeat && admitsBodyAfter && !admitsBodyAfter(flow.cursorY + groupHeight)) return;

    for (const headerRow of headerRows) {
      const placed = layoutRowFragment(
        headerRow,
        structure.columnWidthsPt,
        tableLeft,
        flow.cursorY,
        asRepeat,
        0,
        tableDeps,
        structure.cellSpacingPt
      );
      if (placed.bottom > placementBottom + 0.001) {
        throw new TablePaginationError(
          'table-row-overheight',
          `Table header row ${headerRow.id} overflowed the page content box`
        );
      }
      rows.push(placed.record);
      sourceRows.push(headerRow);
      flow.cursorY = placed.bottom;
    }
  };

  const breakForContinuation = (admitsBodyAfter?: (bodyTop: number) => boolean): void => {
    closeTableFragment();
    advanceColumn();
    tableLeft = originX();
    // See placeHeaderGroup: the new fragment opens at the advanced cursor, which is the
    // column region top on a shared sheet and 0 only when a fresh page was opened.
    fragmentTop = flow.cursorY;
    if (repeatsEnabled) placeHeaderGroup(true, admitsBodyAfter);
  };

  // Initial authored header group (not repeats) — atomic with body-row pagination below.
  if (!initialHeaderGroupDegraded) placeHeaderGroup(false);

  // `w:vMerge` heights, planned over the BODY rows: a merged cell is as tall as the rows
  // it covers, so its own row must not swallow the whole merged height.
  const bodyRows = structure.rows.slice(initialHeaderGroupDegraded ? 0 : headerRows.length);
  // `tableLeft` is read through a getter, not captured: `placeHeaderGroup` and
  // `breakForContinuation` both re-derive it, and a positioned probe localizes wrap bands
  // against it — a stale left measures the head against a band that does not cross it.
  const vMergePlan = vMergePlanFor(structure, () => tableLeft, 0, tableDeps, bodyRows);
  let vMerge: RowVMergeLayoutOptions | undefined;
  let naturalHeight = 0;
  const admitSpans = (bodyRowIndex: number, probeRow?: SemanticTableRow): void => {
    vMerge = admitVMergeSpansAt(vMergePlan, bodyRowIndex, flow.cursorY, contentHeight());
    naturalHeight = vMerge?.heightFloorPt ?? (probeRow ? rowHeightOf(probeRow) : naturalHeight);
  };

  for (const [bodyRowIndex, row] of bodyRows.entries()) {
    if (initialHeaderGroupDegraded && bodyRowIndex >= headerRows.length) repeatsEnabled = true;
    admitSpans(bodyRowIndex, row);
    let cursors: CellPlaceCursor[] = initialCellCursors(row);
    let isContinuation = false;
    let fragmentsForRow = 0;
    let movedToFreshPage = false;

    // A row an accepted span covers does not take the whole-row MOVE: alone among the
    // breaks below, that one is an optimization rather than a recovery, and it ends the
    // fragment above merged content already flowed against this page. See the break-site
    // table in `table-vmerge-heights.ts` for why the others stay open to a covered row.
    const heldByOpenSpan =
      vMerge !== undefined && vMerge.detachedSpanHeightPtByCellId === undefined;

    /**
     * Repeating headers is admissible only when this exact row state can progress below them.
     * Explicitly atomic rows must fit whole; auto/atLeast and continued rows use the same bounded
     * placer as the commit path, but behind a side-effect-free probe. The callback receives the
     * real post-header top after any column advance.
     */
    const admitsRepeatedHeaders = (bodyTop: number): boolean => {
      const pageBottom = contentHeight();
      const remaining = pageBottom - bodyTop;
      if (remaining <= 0.001) return false;
      // The unsplit commit path consumes a complete row regardless of `fitted`: an empty row's
      // authored box is structural progress even though it places no text. Mirror that path before
      // asking the bounded probe, whose `fitted` flag deliberately means content progress.
      if (!isContinuation && naturalHeight <= remaining + 0.001) return true;
      if (!isContinuation && (row.cantSplit || row.height.rule === 'exact')) {
        return false;
      }
      return probeRowFragmentProgress(
        row,
        structure.columnWidthsPt,
        tableLeft,
        bodyTop,
        pageBottom,
        isContinuation,
        0,
        tableDeps,
        cursors,
        structure.cellSpacingPt
      );
    };

    // Whole-row move: fits a fresh page but not the remaining band.
    if (
      !heldByOpenSpan &&
      naturalHeight <= contentHeight() + 0.001 &&
      flow.cursorY + naturalHeight > contentHeight() + 0.001 &&
      flow.cursorY > 0
    ) {
      breakForContinuation(admitsRepeatedHeaders);
      movedToFreshPage = true;
      // A merge that did not fit the band it was offered in may fit this fresh page.
      admitSpans(bodyRowIndex);
    }

    for (;;) {
      fragmentsForRow += 1;
      if (fragmentsForRow > MAX_TABLE_ROW_FRAGMENTS) {
        throw new TablePaginationError(
          'table-row-fragment-limit',
          `Table row ${row.id} exceeded ${MAX_TABLE_ROW_FRAGMENTS} page fragments`
        );
      }

      const remaining = contentHeight() - flow.cursorY;
      if (remaining <= 0.001 && flow.cursorY > 0) {
        if (movedToFreshPage) {
          throw new TablePaginationError(
            'table-row-overheight',
            `Table row ${row.id} cannot fit after repeated header rows`
          );
        }
        breakForContinuation(admitsRepeatedHeaders);
        movedToFreshPage = true;
        admitSpans(bodyRowIndex);
        continue;
      }

      // Prefer an unsplit placement when the natural height fits the remaining band. The
      // page bottom goes in for the detached head, whose height this row does not carry
      // and whose overflow the `placed.bottom` check below therefore cannot see.
      if (!isContinuation && naturalHeight <= remaining + 0.001) {
        const placed = layoutRowFragment(
          row,
          structure.columnWidthsPt,
          tableLeft,
          flow.cursorY,
          false,
          0,
          tableDeps,
          structure.cellSpacingPt,
          vMerge,
          contentHeight()
        );
        if (placed.bottom > contentHeight() + 0.001) {
          throw new TablePaginationError(
            'table-row-overheight',
            `Table row ${row.id} overflowed the page content box after placement`
          );
        }
        // This placement is COMMITTED either way. It ran on the live deps, so it has
        // already published its anchored drawings and spent its line ids; throwing it away
        // to re-place would leave a float positioned by a layout that never happened.
        const hasMore = placed.remainder !== null;
        rows.push(placed.record);
        sourceRows.push(hasMore ? rowWithSplitBorders(row, isContinuation, true) : row);
        flow.cursorY = placed.bottom;
        if (!hasMore) break;
        // A detached head that reached the page bottom owes the rest to the next page.
        cursors = placed.remainder!;
        isContinuation = true;
        movedToFreshPage = false;
        breakForContinuation(admitsRepeatedHeaders);
        continue;
      }

      // Does not fit the remaining band.
      // Exact rows are atomic (Word clips overflow inside the fixed box; they do not
      // continue across pages). Same keep-together path as `w:cantSplit`.
      // Not on a CONTINUATION: this row already split, so `w:cantSplit` is a decision that
      // was made and lost an iteration ago. Re-taking it here reaches the throw below with
      // `cursorY === 0` — a fresh page the row was just moved to — and aborts a layout
      // nothing in `core` catches, on a path the module comment calls a recovery.
      if (!isContinuation && (row.cantSplit || row.height.rule === 'exact')) {
        if (flow.cursorY > 0 && !movedToFreshPage) {
          breakForContinuation(admitsRepeatedHeaders);
          movedToFreshPage = true;
          // Re-offered like every other break that retries this row: a merge starting on a
          // `w:cantSplit` row that did not fit the band it was offered in may fit the fresh
          // page it just moved to, which is the whole point of deciding where a row lands.
          admitSpans(bodyRowIndex);
          continue;
        }
        // A fresh page whose band is shrunk by a footnote reserve still owns the full
        // column underneath it. A keep-together row that fits THAT takes it rather than
        // aborting: the reserve is advisory here (the notes pass sizes its area from the
        // body actually placed, so this only pushes the page's footnotes forward), while
        // the throw below rejects the entire document for one row+reserve collision.
        const fullBand = flow.unreservedContentHeight?.() ?? contentHeight();
        if (
          fullBand > contentHeight() + 0.001 &&
          naturalHeight <= fullBand - flow.cursorY + 0.001
        ) {
          const placed = layoutRowFragment(
            row,
            structure.columnWidthsPt,
            tableLeft,
            flow.cursorY,
            false,
            0,
            tableDeps,
            structure.cellSpacingPt,
            vMerge,
            fullBand
          );
          if (placed.bottom <= fullBand + 0.001 && placed.remainder === null) {
            rows.push(placed.record);
            sourceRows.push(row);
            flow.cursorY = placed.bottom;
            break;
          }
        }
        throw new TablePaginationError(
          'table-row-overheight',
          row.height.rule === 'exact'
            ? `Table row ${row.id} has w:trHeight hRule=exact taller than the available page content`
            : `Table row ${row.id} has w:cantSplit and is taller than the available page content`
        );
      }

      const placed = layoutRowFragmentBounded(
        row,
        structure.columnWidthsPt,
        tableLeft,
        flow.cursorY,
        contentHeight(),
        false,
        isContinuation,
        0,
        tableDeps,
        cursors,
        structure.cellSpacingPt,
        vMerge
      );

      // First attempt on a non-empty page placed nothing useful → move to next page.
      if (!placed.fitted && flow.cursorY > 0 && !movedToFreshPage) {
        breakForContinuation(admitsRepeatedHeaders);
        movedToFreshPage = true;
        admitSpans(bodyRowIndex);
        continue;
      }

      // A note reservation can leave an otherwise valid page with less than one line of body
      // space. Do not reject a splittable row solely because that empty reserved band was the
      // table's first offer; advance once to the next physical page and retry under its band.
      const fullBand = flow.unreservedContentHeight?.() ?? contentHeight();
      if (
        !placed.fitted &&
        flow.cursorY <= 0.001 &&
        !movedToFreshPage &&
        fullBand > contentHeight() + 0.001
      ) {
        breakForContinuation(admitsRepeatedHeaders);
        movedToFreshPage = true;
        admitSpans(bodyRowIndex);
        continue;
      }

      if (!placed.fitted) {
        throw new TablePaginationError(
          placed.nestedSplitBlocked ? 'table-row-split-unsupported' : 'table-row-overheight',
          placed.nestedSplitBlocked
            ? `Table row ${row.id} contains a nested table taller than the page content box`
            : `Table row ${row.id} has content that cannot fit a page content box`
        );
      }

      if (placed.bottom > contentHeight() + 0.001) {
        throw new TablePaginationError(
          'table-row-overheight',
          `Table row ${row.id} overflowed the page content box`
        );
      }

      const hasMore = placed.remainder !== null;
      const source = rowWithSplitBorders(row, isContinuation, hasMore);
      rows.push(placed.record);
      sourceRows.push(source);
      flow.cursorY = placed.bottom;

      if (!hasMore) break;

      cursors = placed.remainder!;
      isContinuation = true;
      movedToFreshPage = false;
      breakForContinuation(admitsRepeatedHeaders);
    }
  }
  closeTableFragment();
  if (outOfFlow) flow.cursorY = bodyCursorY;
  return { outOfFlow };
}
