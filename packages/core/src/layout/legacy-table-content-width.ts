// A deliberately narrow compatibility projection, not a rewrite of authored table XML.
// Older Word layouts can align the CONTENT of an inline table with the text margins:
// its outer grid edges extend by the first/last cell margins. Only use that reference
// box when a complete authored grid independently confirms it. Other legacy table
// placements (implicit/nonzero indent, RTL, floating, nested, separated cells) retain
// the existing algorithm until their geometry has independent coverage.
import { WML_NAMESPACE_URI, type OoxmlElement } from '@docx-editor.dev/core/store';
import type { SemanticTableRow, TableAlignment } from './semantic-table.ts';
import { MAX_TABLE_COLUMNS, type CellWidthClaim, type PreferredWidth } from './table-widths.ts';
import { hasSupportedLegacyTableMargins } from './legacy-table-margins.ts';

const MAX_WIDTH_PT = 31_680 / 20;
const EPSILON_PT = 0.001;

/** Reconcile the precision of legacy fiftieth-percent preferences with a verified twip grid. */
export function legacyRoundedCellClaims(
  claims: readonly CellWidthClaim[],
  gridCols: readonly OoxmlElement[],
  tableWidthPt: number
): readonly CellWidthClaim[] {
  // A rounded fiftieth-percent can exceed the same width rounded to a twip by this
  // amount. Growing that column and then rescaling the whole table steals space from
  // unrelated columns. Only suppress that representational difference, not a wider
  // cell preference. This runs only AFTER the complete legacy grid has been verified.
  const tolerance = tableWidthPt / 10_000 + 0.025;
  return claims.map((claim) => {
    if (claim.span !== 1 || claim.preferred.type !== 'pct') return claim;
    const units = claim.preferred.value * 50;
    if (Math.abs(units - Math.round(units)) > 1e-8) return claim;
    const raw = attr(gridCols[claim.start], 'w');
    if (raw === undefined || !/^\d{1,9}$/.test(raw)) return claim;
    const gridWidth = Number(raw) / 20;
    const delta = (tableWidthPt * claim.preferred.value) / 100 - gridWidth;
    return delta > 0 && delta <= tolerance + EPSILON_PT
      ? { ...claim, preferred: { type: 'dxa', value: gridWidth } }
      : claim;
  });
}

function child(node: OoxmlElement, name: string): OoxmlElement | undefined {
  let found: OoxmlElement | undefined;
  for (const item of node.children) {
    if (item.kind === 'textValue' || item.localName !== name) continue;
    if (found || item.namespaceUri !== WML_NAMESPACE_URI) return undefined;
    found = item;
  }
  return found;
}

function attr(node: OoxmlElement | undefined, name: string): string | undefined {
  const matches = node?.attributes.filter((item) => item.localName === name);
  return matches?.length === 1 && matches[0]!.namespaceUri === WML_NAMESPACE_URI
    ? matches[0]!.value
    : undefined;
}

export function legacyTableContentWidth(input: {
  readonly table: OoxmlElement;
  readonly propertyNodes: readonly OoxmlElement[];
  readonly rows: readonly SemanticTableRow[];
  readonly columnCount: number;
  readonly contentWidthPt: number;
  readonly compatibilityMode: number | undefined;
  readonly depth: number;
  readonly tableWidth: PreferredWidth;
  readonly layoutFixed: boolean;
  readonly alignment: TableAlignment;
  readonly indentPt: number;
  readonly cellSpacingPt: number;
  readonly floating: boolean;
}): number | undefined {
  const { compatibilityMode: mode, contentWidthPt, table, rows, columnCount } = input;
  if (
    (mode !== 11 && mode !== 12 && mode !== 14) ||
    input.depth !== 0 ||
    input.floating ||
    input.layoutFixed ||
    input.alignment !== 'left' ||
    input.indentPt !== 0 ||
    input.cellSpacingPt !== 0 ||
    input.tableWidth.type !== 'pct' ||
    input.tableWidth.value !== 100 ||
    !Number.isFinite(contentWidthPt) ||
    contentWidthPt <= 0 ||
    contentWidthPt > MAX_WIDTH_PT ||
    columnCount < 1 ||
    columnCount > MAX_TABLE_COLUMNS
  )
    return undefined;

  const properties = child(table, 'tblPr');
  if (!properties) return undefined;
  const width = child(properties, 'tblW');
  const indent = child(properties, 'tblInd');
  const rawWidth = attr(width, 'w');
  if (
    attr(width, 'type') !== 'pct' ||
    (rawWidth !== '5000' && rawWidth !== '100%') ||
    attr(indent, 'type') !== 'dxa' ||
    attr(indent, 'w') !== '0' ||
    attr(child(properties, 'tblLayout'), 'type') !== 'autofit'
  )
    return undefined;

  for (const node of [...input.propertyNodes, properties]) {
    for (const item of node.children) {
      if (item.kind === 'textValue') continue;
      if (
        ['jc', 'tblCellSpacing'].includes(item.localName) &&
        item.namespaceUri !== WML_NAMESPACE_URI
      )
        return undefined;
      // Reject ambiguous/unsupported placement rather than treating invalid values as left.
      if (item.localName === 'tblpPr' || item.localName === 'bidiVisual') return undefined;
      if (item.localName === 'jc' && !['left', 'start'].includes(attr(item, 'val') ?? '')) {
        return undefined;
      }
      if (
        item.localName === 'tblCellSpacing' &&
        (attr(item, 'type') !== 'dxa' || attr(item, 'w') !== '0')
      )
        return undefined;
    }
  }

  const first = rows[0]?.cells[0];
  const last = rows[0]?.cells.at(-1);
  if (!first || !last) return undefined;
  if (!hasSupportedLegacyTableMargins(table, input.propertyNodes)) return undefined;
  const left = first.margins.left;
  const right = last.margins.right;
  const target = contentWidthPt + left + right;
  if (
    !Number.isFinite(target) ||
    left < 0 ||
    right < 0 ||
    left + right <= 0 ||
    target > MAX_WIDTH_PT
  )
    return undefined;
  for (const row of rows) {
    const leading = row.cells[0];
    const trailing = row.cells.at(-1);
    if (
      !leading ||
      !trailing ||
      leading.gridColumn !== 0 ||
      trailing.gridColumn + trailing.gridSpan !== columnCount ||
      leading.margins.left !== left ||
      trailing.margins.right !== right
    )
      return undefined;
  }

  const grid = child(table, 'tblGrid');
  if (!grid) return undefined;
  let count = 0;
  let total = 0;
  for (const col of grid.children) {
    if (col.kind === 'textValue') continue;
    if (col.localName !== 'gridCol' || col.namespaceUri !== WML_NAMESPACE_URI) return undefined;
    const raw = attr(col, 'w');
    if (raw === undefined || !/^\d{1,9}$/.test(raw)) return undefined;
    const pt = Number(raw) / 20;
    if (pt < 1 || pt > MAX_WIDTH_PT || ++count > MAX_TABLE_COLUMNS) return undefined;
    total += pt;
  }
  return count === columnCount && Math.abs(total - target) < EPSILON_PT ? target : undefined;
}
