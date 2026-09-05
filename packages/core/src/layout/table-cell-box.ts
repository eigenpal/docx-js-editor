// A cell's content box: what the padding and the rules leave for text, and what happens to
// the rules when a page cut runs through the row.
//
// Both halves of one question. A cell is a border box — the rules shrink the text column
// rather than paint over it — so the inset a paragraph flows inside is the margin plus the
// rule, and a row that continues onto the next page has to drop the rule it did not close
// before that inset is computed again for the continuation.

import type { CellBorderBox } from './table-borders.ts';
import { contentInsets as sharedContentInsets } from './table-cell-geometry.ts';
import type { CellMarginsPt } from './table-cell-margins.ts';
import type { SemanticTableCell, SemanticTableRow } from './semantic-table.ts';

/** Per-side inset from the cell's edge to its text column. */
export interface CellContentInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** Shared inset policy, including the narrowly admitted legacy collapsed-table case. */
export function contentInsets(
  margins: CellMarginsPt,
  borders: SemanticTableCell['borders'],
  legacyCollapsedContentAlignment = false
): CellContentInsets {
  return sharedContentInsets(margins, borders, legacyCollapsedContentAlignment);
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
