// Cell-box geometry shared by row layout and fragment finalize: where a cell's content box
// sits inside its border box, and which rules a mid-row page cut suppresses.

import { borderExtentPt, type CellBorderBox } from './table-borders.ts';
import type { CellMarginsPt, SemanticTableCell, SemanticTableRow } from './semantic-table.ts';

/** Per-side content inset: authored margins plus the extent of the rule on that side. */
export interface CellContentInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export function contentInsets(
  margins: CellMarginsPt,
  borders: SemanticTableCell['borders'],
  cellSpacingPt = 0
): CellContentInsets {
  // A collapsed horizontal rule is centered on the shared row boundary.
  // Separated cells retain the full rule inside each cell's content inset.
  const verticalFactor = Number.isFinite(cellSpacingPt) && cellSpacingPt > 0 ? 1 : 0.5;
  return {
    top: margins.top + borderExtentPt(borders.top) * verticalFactor,
    right: margins.right + borderExtentPt(borders.right),
    bottom: margins.bottom + borderExtentPt(borders.bottom) * verticalFactor,
    left: margins.left + borderExtentPt(borders.left),
  };
}

function suppressSplitBorders(
  borders: CellBorderBox,
  omitTop: boolean,
  omitBottom: boolean
): CellBorderBox {
  return {
    top: omitTop ? { state: 'none' } : borders.top,
    left: borders.left,
    bottom: omitBottom ? { state: 'none' } : borders.bottom,
    right: borders.right,
  };
}

/** Clone a structure row with top/bottom borders suppressed for mid-row page cuts. */
export function rowWithSplitBorders(
  row: SemanticTableRow,
  omitTop: boolean,
  omitBottom: boolean
): SemanticTableRow {
  if (!omitTop && !omitBottom) return row;
  return {
    ...row,
    cells: row.cells.map((cell) => ({
      ...cell,
      borders: suppressSplitBorders(cell.borders, omitTop, omitBottom),
    })),
  };
}
