import type {
  SemanticTableStructure,
  TableAnchorFrames,
  TableFloatPosition,
} from './semantic-table.ts';

/**
 * Where a table's left edge sits inside the box that contains it.
 *
 * Ordinary left-aligned tables start at their indent; centered/right-aligned tables
 * use the remaining width. A verified legacy content-aligned table instead aligns
 * the leading cell's content edge with the text column, without changing its indent.
 */
export function tableOriginX(structure: SemanticTableStructure, containerWidthPt: number): number {
  if (structure.legacyContentAlignment) return -(structure.rows[0]?.cells[0]?.margins.left ?? 0);
  const width = structure.columnWidthsPt.reduce((sum, column) => sum + column, 0);
  const slack = containerWidthPt - width;
  if (!Number.isFinite(slack) || slack <= 0) return 0;
  if (structure.alignment === 'center') return slack / 2;
  if (structure.alignment === 'right') return slack;
  return Math.min(structure.indentPt, slack);
}

/**
 * Where a floated table's left edge sits, in the coordinates layout reports boxes in.
 *
 * `w:tblpXSpec` aligns the table inside its anchor box; `w:tblpX` offsets it from that
 * box's leading edge instead. `inside`/`outside` are the mirrored-margin spellings of
 * `left`/`right` and render as those — the odd/even page flip they ask for only exists in
 * a document with mirrored margins, which this layout does not model.
 *
 * The result keeps the table's leading edge on the sheet whatever the file states, so a
 * hostile offset moves the table rather than painting it off the page entirely.
 */
export function tableFloatOriginX(
  float: TableFloatPosition,
  tableWidthPt: number,
  frames: TableAnchorFrames
): number {
  const frame = frames[float.horzAnchor];
  const slack = frame.width - tableWidthPt;
  let x: number;
  if (float.xSpec === 'center') x = frame.left + slack / 2;
  else if (float.xSpec === 'right' || float.xSpec === 'outside') x = frame.left + slack;
  else if (float.xSpec) x = frame.left;
  else x = frame.left + float.xPt;
  if (!Number.isFinite(x)) return frame.left;
  const pageRight = frames.page.left + frames.page.width;
  return Math.max(frames.page.left, Math.min(x, pageRight));
}
