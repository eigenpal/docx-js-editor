// Cell-box geometry shared by row layout and fragment finalize: where a cell's content box
// sits inside its border box, and which rules a mid-row page cut suppresses.

import { borderExtentPt, type CellBorderBox } from './table-borders.ts';
import type { CellMarginsPt, SemanticTableCell, SemanticTableRow } from './semantic-table.ts';

/** Per-side content inset, including the applicable border clearance. */
export interface CellContentInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export function contentInsets(
  margins: CellMarginsPt,
  borders: SemanticTableCell['borders'],
  legacyCollapsedContentAlignment = false
): CellContentInsets {
  const leftExtent = borderExtentPt(borders.left);
  const rightExtent = borderExtentPt(borders.right);
  const simpleRules = [borders.left, borders.right].every(
    (edge) => edge.state !== 'edge' || edge.style === 'single' || edge.style === 'thick'
  );
  // The admitted legacy table's margins already start at the collapsed grid lines. Only
  // reuse that budget when BOTH margins clear their half-strokes; thick/asymmetric cases
  // keep the existing conservative inset. This is not a general Word border-box model.
  const marginCoversRules =
    legacyCollapsedContentAlignment &&
    simpleRules &&
    margins.left >= leftExtent / 2 &&
    margins.right >= rightExtent / 2;
  return {
    top: margins.top + borderExtentPt(borders.top),
    right: margins.right + (marginCoversRules ? 0 : rightExtent),
    bottom: margins.bottom + borderExtentPt(borders.bottom),
    left: margins.left + (marginCoversRules ? 0 : leftExtent),
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
