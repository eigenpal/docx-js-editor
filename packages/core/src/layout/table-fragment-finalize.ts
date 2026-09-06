// Turning a page fragment's placed rows into the rows that get painted.
//
// Everything here runs AFTER placement, on measured geometry: a vertically merged cell's box
// is the extent of the rows its span really covered, `w:vAlign` is re-applied over that box
// rather than over the head's own row, and collapsed borders are resolved once the whole
// grid of the fragment is known. Split out of row layout because the two answer different
// questions — row layout decides what fits, this decides what the result looks like — and
// because a row cannot know its merged neighbour's box until every row of the span is down.

import type { OoxmlElement } from '@docx-editor.dev/core/store';
import {
  anchoredDrawingAtomsInParagraph,
  publishAnchoredDrawingsForParagraph,
  shiftInlineDrawingRecord,
} from './drawing-layout.ts';
import { contentInsets, type CellContentInsets } from './table-cell-geometry.ts';
import {
  resolveTableCellBorderGrid,
  type BorderGridCell,
  type BorderGridGeometry,
  type TableBorderBox,
  type TableBorderOwnershipBudget,
} from './table-borders.ts';
import {
  resolveVMergeSpans,
  type TableVMergeResolveBudget,
  type TableVMergeResolveWork,
} from './table-vmerge.ts';
import type {
  SemanticTableCell,
  SemanticTableRow,
  SemanticTableStructure,
} from './semantic-table.ts';
import type { BlockFragmentRecord, LayoutBox, TableRowFragmentRecord } from './semantic-records.ts';
import type { TableFlowDeps } from './semantic-table-layout.ts';

function republishAnchoredParagraphsInBlocks(
  blocks: readonly BlockFragmentRecord[],
  authoredBlocks: readonly OoxmlElement[],
  cellBox: LayoutBox,
  deps: TableFlowDeps
): void {
  if (
    !deps.onAnchorRepublish ||
    !deps.inlineDrawingLayout ||
    !deps.anchorFrameBase ||
    !deps.pageContentClip
  ) {
    return;
  }
  for (const block of blocks) {
    if (block.kind !== 'paragraph') continue;
    const paragraph = authoredBlocks.find(
      (candidate) => candidate.kind === 'paragraph' && candidate.id === block.paragraphId
    );
    if (!paragraph || paragraph.kind !== 'paragraph') continue;
    const atoms = anchoredDrawingAtomsInParagraph(paragraph, deps.inlineDrawingLayout);
    if (atoms.length === 0) continue;
    deps.onAnchorRepublish(
      block.paragraphId,
      publishAnchoredDrawingsForParagraph({
        paragraph,
        paragraphId: block.paragraphId,
        paragraphBox: block.box,
        lines: block.lines,
        drawingLayout: deps.inlineDrawingLayout,
        frameBase: deps.anchorFrameBase(),
        columnBox: deps.columnBoxForParagraph?.(block.box) ?? block.box,
        cellBox,
        pageClip: deps.pageContentClip(),
        measurer: deps.measurer,
        ...(deps.hostedStory ? { layoutTextboxStory: deps.hostedStory.layoutTextboxStoryFor } : {}),
        ...(deps.displayMode ? { displayMode: deps.displayMode } : {}),
      })
    );
  }
}

export function shiftBlocks(
  blocks: readonly BlockFragmentRecord[],
  dy: number
): BlockFragmentRecord[] {
  if (dy === 0) return [...blocks];
  return blocks.map((block) => {
    if (block.kind === 'table') {
      return {
        ...block,
        box: { ...block.box, y: block.box.y + dy },
        rows: block.rows.map((row) => ({
          ...row,
          box: { ...row.box, y: row.box.y + dy },
          cells: row.cells.map((cell) => ({
            ...cell,
            box: { ...cell.box, y: cell.box.y + dy },
            blocks: shiftBlocks(cell.blocks, dy),
          })),
        })),
      };
    }
    return {
      ...block,
      box: { ...block.box, y: block.box.y + dy },
      ...(block.shadingBox
        ? { shadingBox: { ...block.shadingBox, y: block.shadingBox.y + dy } }
        : {}),
      ...(block.bottomBorder
        ? {
            bottomBorder: {
              ...block.bottomBorder,
              box: { ...block.bottomBorder.box, y: block.bottomBorder.box.y + dy },
            },
          }
        : {}),
      // Every `w:pBdr` stroke, not only the bottom one. vAlign moves the whole paragraph
      // down its cell; a frame left at the pre-shift y would sit above the text it encloses.
      ...(block.borders
        ? {
            borders: block.borders.map((strokeRecord) => ({
              ...strokeRecord,
              box: { ...strokeRecord.box, y: strokeRecord.box.y + dy },
            })),
          }
        : {}),
      ...(block.marker
        ? {
            marker: {
              ...block.marker,
              box: { ...block.marker.box, y: block.marker.box.y + dy },
            },
          }
        : {}),
      lines: block.lines.map((line) => ({
        ...line,
        box: { ...line.box, y: line.box.y + dy },
        spans: line.spans.map((span) => ({
          ...span,
          box: { ...span.box, y: span.box.y + dy },
        })),
        ...(line.drawings
          ? {
              drawings: line.drawings.map((drawing) => shiftInlineDrawingRecord(drawing, 0, dy)),
            }
          : {}),
      })),
    };
  });
}

/**
 * After all rows of a table fragment are placed: expand vMerge restart boxes, re-apply
 * vAlign over the full span, and publish collapsed border edges.
 */
export function finalizeTableRows(
  rows: readonly TableRowFragmentRecord[],
  structure: SemanticTableStructure,
  sourceRows: readonly SemanticTableRow[],
  ownershipBudget?: TableBorderOwnershipBudget,
  vMergeBudget?: TableVMergeResolveBudget,
  vMergeWork?: TableVMergeResolveWork,
  onAnchorShift?: (paragraphId: string, dy: number) => void,
  anchorDeps?: TableFlowDeps,
  occurrenceInsets?: ReadonlyMap<TableRowFragmentRecord, ReadonlyMap<string, CellContentInsets>>
): TableRowFragmentRecord[] {
  if (rows.length === 0) return [];

  // Map laid-out cells back to authored structure cells (same order within each row).
  const authoredById = new Map<string, SemanticTableCell>();
  for (const row of sourceRows) {
    for (const cell of row.cells) authoredById.set(cell.id, cell);
  }

  // One-pass column-keyed merge spans — O(cells), not O(rows × columns²). These rows are
  // one PAGE FRAGMENT: a merge whose restart was placed on an earlier page is headed here
  // by its continuation copy, which is why that copy comes back keyed in the span map.
  const mergeSpanById = resolveVMergeSpans(rows, vMergeWork, vMergeBudget, {
    pageFragment: true,
  });

  // Expand restart heights and shift content for vAlign over the full span.
  const expanded: TableRowFragmentRecord[] = rows.map((row, rowIndex) => ({
    ...row,
    cells: row.cells.map((cell) => {
      const resolvedSpan = mergeSpanById.get(cell.id);
      if (cell.vMergeContinue && resolvedSpan === undefined) {
        return { ...cell, paintInert: true, rowSpan: 1, borders: {}, blocks: [] };
      }
      // A carried-in continuation paints like the restart it continues: Word draws the
      // merged cell's rules, fill and box on every page the merge crosses. Its content
      // stayed with the restart on the earlier page, so `blocks` is empty either way.
      const carried = cell.vMergeContinue;
      const span = resolvedSpan ?? 1;
      let height = cell.box.height;
      if (span > 1) {
        const last = rows[rowIndex + span - 1]!;
        height = last.box.y + last.box.height - cell.box.y;
      }
      const authored = authoredById.get(cell.id);
      let blocks = cell.blocks;
      if (authored && authored.vAlign !== 'top' && blocks.length > 0) {
        const insets =
          occurrenceInsets?.get(row)?.get(cell.id) ??
          contentInsets(authored.margins, authored.borders);
        // Content was placed relative to the first row; measure current content band.
        let contentTop = Number.POSITIVE_INFINITY;
        let contentBottom = Number.NEGATIVE_INFINITY;
        for (const block of blocks) {
          contentTop = Math.min(contentTop, block.box.y);
          contentBottom = Math.max(contentBottom, block.box.y + block.box.height);
        }
        if (Number.isFinite(contentTop) && Number.isFinite(contentBottom)) {
          const vertical = authored.textDirection === 'btLr';
          const available =
            (vertical
              ? cell.box.width - insets.left - insets.right
              : height - insets.top - insets.bottom) -
            (contentBottom - contentTop);
          // Reset any per-row shift by measuring from cell top + inset.
          const desiredTop =
            cell.box.y +
            (vertical ? insets.left : insets.top) +
            (available > 0 ? (authored.vAlign === 'center' ? available / 2 : available) : 0);
          const dy = desiredTop - contentTop;
          if (Math.abs(dy) > 0.001) {
            blocks = shiftBlocks(blocks, dy);
            for (const block of blocks) {
              if (block.kind === 'paragraph') onAnchorShift?.(block.paragraphId, dy);
            }
          }
        }
      }
      const finalizedCellBox = Object.freeze({
        x: cell.box.x,
        y: cell.box.y,
        width: cell.box.width,
        height,
      });
      if (
        authored &&
        anchorDeps &&
        (span > 1 || (authored.vAlign !== 'top' && blocks.length > 0))
      ) {
        republishAnchoredParagraphsInBlocks(blocks, authored.blocks, finalizedCellBox, anchorDeps);
      }
      return {
        ...cell,
        ...(carried ? { vMergeContinue: false, paintInert: false } : {}),
        rowSpan: span,
        blocks,
        box: { ...cell.box, height },
      };
    }),
  }));

  // Border grid from authored structure (same row/cell order as laid-out fragment rows).
  // Header repeats use the same authored header row; match by cell id.
  const gridRows: BorderGridCell[][] = expanded.map((row) =>
    row.cells.map((cell) => {
      const authored = authoredById.get(cell.id);
      return {
        gridColumn: cell.gridColumn,
        gridSpan: cell.gridSpan,
        vMergeContinue: cell.vMergeContinue,
        borders: authored?.borders ?? {
          top: { state: 'omitted' as const },
          left: { state: 'omitted' as const },
          bottom: { state: 'omitted' as const },
          right: { state: 'omitted' as const },
        },
        mergeRowSpan: cell.rowSpan ?? 1,
      };
    })
  );

  const columnCount = structure.columnWidthsPt.length;
  const tableBorders: TableBorderBox = structure.tableBorders;
  const geometry: BorderGridGeometry = {
    columnWidthsPt: structure.columnWidthsPt,
    rowBands: expanded.map((row) => ({ y: row.box.y, height: row.box.height })),
    cellBoxes: expanded.map((row) =>
      row.cells.map((cell) => ({ width: cell.box.width, height: cell.box.height }))
    ),
  };
  const resolved = resolveTableCellBorderGrid(
    gridRows,
    tableBorders,
    columnCount,
    geometry,
    undefined,
    ownershipBudget
  );

  return expanded.map((row, rowIndex) => ({
    ...row,
    cells: row.cells.map((cell, cellIndex) => {
      const borders = resolved[rowIndex]![cellIndex]!;
      if (cell.paintInert || cell.vMergeContinue) {
        return { ...cell, borders: {}, paintInert: true };
      }
      return { ...cell, borders };
    }),
  }));
}
