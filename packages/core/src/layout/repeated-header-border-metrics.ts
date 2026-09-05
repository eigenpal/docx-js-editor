// A repeated header and its first complete body row share one measured boundary.
// These insets belong to one page occurrence. The authored borders never change.

import type { OoxmlNode } from '@docx-editor.dev/core/store';
import { borderExtentPt, resolveTableCellBorderGrid } from './table-borders.ts';
import { contentInsets, type CellContentInsets } from './table-cell-geometry.ts';
import { stripAnchorSinksForProbe } from './table-probe-deps.ts';
import { layoutRowFragment, type TableFlowDeps } from './semantic-table-layout.ts';
import {
  MAX_TABLE_COLUMNS,
  type SemanticTableRow,
  type SemanticTableStructure,
} from './semantic-table.ts';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MAX_CANDIDATE_NODES = 8192;
const MAX_CANDIDATE_DEPTH = 32;
const MAX_HEADER_ROWS = 64;
// Resolved structures are immutable. Do not scan a large table again on every page.
const mergePresence = new WeakMap<SemanticTableStructure, boolean>();
function hasMerge(structure: SemanticTableStructure): boolean {
  const known = mergePresence.get(structure);
  if (known !== undefined) return known;
  const present = structure.rows.some((row) => row.cells.some((cell) => cell.vMergeContinue));
  mergePresence.set(structure, present);
  return present;
}
const CONTENT_ELEMENTS = new Set([
  'p',
  'r',
  't',
  'tab',
  'br',
  'cr',
  'noBreakHyphen',
  'softHyphen',
  'hyperlink',
  'fldSimple',
  'fldChar',
  'instrText',
  'bookmarkStart',
  'bookmarkEnd',
  'proofErr',
  'pPr',
  'rPr',
]);

/** Text-only rows keep the candidate probe independent of drawing and note publication. */
function simpleRows(rows: readonly SemanticTableRow[], columns: number): boolean {
  let visited = 0;
  for (const row of rows) {
    let end = 0;
    for (const cell of row.cells) {
      if (cell.vMergeContinue || cell.textDirection !== 'horizontal' || cell.gridColumn !== end)
        return false;
      end += cell.gridSpan;
      if (end > columns) return false;
      for (const block of cell.blocks) {
        if (block.kind !== 'paragraph') return false;
        const stack: { node: OoxmlNode; depth: number; properties: boolean }[] = [
          { node: block, depth: 0, properties: false },
        ];
        while (stack.length > 0) {
          const { node, depth, properties } = stack.pop()!;
          if (++visited > MAX_CANDIDATE_NODES || depth > MAX_CANDIDATE_DEPTH) return false;
          if (node.kind === 'textValue') continue;
          if (node.namespaceUri !== W || (!properties && !CONTENT_ELEMENTS.has(node.localName)))
            return false;
          if (
            node.localName === 'br' &&
            node.attributes.some(
              (attribute) => attribute.localName === 'type' && attribute.value !== 'textWrapping'
            )
          )
            return false;
          // Drawing, nested story and merge markup are not paragraph/run formatting.
          if (
            ['drawing', 'pict', 'object', 'txbxContent', 'tbl', 'vMerge', 'framePr'].includes(
              node.localName
            )
          )
            return false;
          if (visited + stack.length + node.children.length > MAX_CANDIDATE_NODES) return false;
          const childProperties =
            properties || node.localName === 'pPr' || node.localName === 'rPr';
          for (const child of node.children)
            stack.push({ node: child, depth: depth + 1, properties: childProperties });
        }
      }
    }
    if (end !== columns) return false;
  }
  return true;
}

export interface RepeatedHeaderBorderPlan {
  readonly bodyRowId: string;
  readonly headerHeight: number;
  readonly bodyHeight: number;
  readonly deps: TableFlowDeps;
}

/**
 * Undefined retains the existing complex-row path. Null omits this repeat.
 * A plan guarantees that the complete candidate fits before any live placement.
 */
export function prepareRepeatedHeaderBorderPlan(
  structure: SemanticTableStructure,
  headers: readonly SemanticTableRow[],
  body: SemanticTableRow,
  left: number,
  top: number,
  bottom: number,
  baselineHeaderHeight: number,
  baselineBodyHeight: number,
  deps: TableFlowDeps
): RepeatedHeaderBorderPlan | null | undefined {
  if (
    structure.cellSpacingPt > 0 ||
    structure.float ||
    headers.length === 0 ||
    headers.length > MAX_HEADER_ROWS ||
    structure.columnWidthsPt.length > MAX_TABLE_COLUMNS ||
    ![left, top, bottom, baselineHeaderHeight, baselineBodyHeight].every(Number.isFinite) ||
    hasMerge(structure) ||
    (deps.pageExclusionZones?.().length ?? 0) > 0 ||
    !simpleRows([...headers, body], structure.columnWidthsPt.length)
  )
    return undefined;
  const boundaryCells = headers.reduce((sum, row) => sum + row.cells.length, body.cells.length);
  if (deps.borderOwnershipBudget && deps.borderOwnershipBudget.intervalsRemaining < boundaryCells)
    return undefined;
  // This lane does not change existing split-row pagination. Only an atomic row, or
  // a row that previously fit complete, takes the shared-boundary transaction.
  if (
    !body.cantSplit &&
    body.height.rule !== 'exact' &&
    baselineBodyHeight > bottom - top - baselineHeaderHeight + 0.001
  )
    return undefined;

  const lastHeader = headers[headers.length - 1]!;
  // The existing resolver owns fallback, explicit nil and style/color tie rules.
  // This two-row view is safe only because merges and sparse ownership were excluded.
  const resolved = resolveTableCellBorderGrid(
    [lastHeader.cells, body.cells],
    structure.tableBorders,
    structure.columnWidthsPt.length
  )[0]!;
  const insets = new Map<string, CellContentInsets>();
  const intervals: { start: number; end: number; extent: number }[] = [];
  for (const [index, cell] of lastHeader.cells.entries()) {
    let extent = 0;
    for (const segment of resolved[index]!.edgeSegments ?? []) {
      if (segment.side !== 'bottom') continue;
      const width = borderExtentPt(segment.edge);
      extent = Math.max(extent, width);
      intervals.push({ start: segment.gridStart, end: segment.gridEnd, extent: width });
    }
    insets.set(cell.id, {
      ...contentInsets(cell.margins, cell.borders),
      bottom: cell.margins.bottom + extent,
    });
  }
  let intervalIndex = 0;
  for (const cell of body.cells) {
    let extent = 0;
    const end = cell.gridColumn + cell.gridSpan;
    while (intervalIndex < intervals.length && intervals[intervalIndex]!.end <= cell.gridColumn)
      intervalIndex++;
    for (
      let index = intervalIndex;
      index < intervals.length && intervals[index]!.start < end;
      index++
    ) {
      extent = Math.max(extent, intervals[index]!.extent);
    }
    insets.set(cell.id, {
      ...contentInsets(cell.margins, cell.borders),
      top: cell.margins.top + extent,
    });
  }
  if (
    [lastHeader, body].every((row) =>
      row.cells.every((cell) => {
        const before = contentInsets(cell.margins, cell.borders);
        const after = insets.get(cell.id)!;
        return before.top === after.top && before.bottom === after.bottom;
      })
    )
  )
    return undefined;
  let line = 0;
  const probeDeps: TableFlowDeps = {
    ...stripAnchorSinksForProbe(deps),
    cache: undefined,
    borderOwnershipBudget: undefined,
    vMergeResolveBudget: undefined,
    onCellBreakKey: undefined,
    cellContentInsets: insets,
    nextLineId: () => `probe-header-border-${line++}`,
  };
  let cursor = top;
  for (const row of headers) {
    const placed = layoutRowFragment(
      row,
      structure.columnWidthsPt,
      left,
      cursor,
      true,
      0,
      probeDeps
    );
    cursor = placed.bottom;
    if (placed.remainder !== null || cursor > bottom + 0.001) return null;
  }
  const headerHeight = cursor - top;
  const placed = layoutRowFragment(
    body,
    structure.columnWidthsPt,
    left,
    cursor,
    false,
    0,
    probeDeps
  );
  if (placed.remainder !== null || placed.bottom > bottom + 0.001) return null;
  return {
    bodyRowId: body.id,
    headerHeight,
    bodyHeight: placed.bottom - cursor,
    deps: { ...deps, cellContentInsets: insets },
  };
}
