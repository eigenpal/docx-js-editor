// Bounded table structure over the typed canonical tree.
//
// Reads `w:tbl`/`w:tr`/`w:tc` into the bounded structure consumed by table layout. All widths
// leave in POINTS, matching `geometryOfSection` and `paragraphIndent`.
//
// Every value is attacker-controlled. Clamp before allocation, and never spread or pass an
// attacker-sized collection as varargs: either can trigger unbounded allocation or arity failure.
//
// Width reconciliation lives in `table-widths.ts`: settling one column depends on every cell
// covering it across every row, not any one node visited here.
import {
  flattenContentControls,
  WML_NAMESPACE_URI,
  type OoxmlElement,
  type OoxmlNode,
} from '@docx-editor.dev/core/store';
import { shadingFillFromElement } from './ooxml-shading.ts';
import {
  revisionNodeProjectionMode,
  type RevisionAuthorFilter,
  type RevisionDisplayMode,
} from './revision-projection.ts';
import { mergedFlowBlocks } from './story-roots.ts';
import {
  EMPTY_TABLE_CELL_STYLE_FORMATTING,
  EMPTY_TABLE_FORMATTING,
  cascadeTableFormatting,
  tableStyleAffectsCells,
  tableCellStyleFormatting,
  type StyleCascadeTable,
  type TableCellStyleFormatting,
} from './style-cascade.ts';
import { mergeCellBorders, mergeTableBorders } from './table-border-cascade.ts';
import {
  EMPTY_CELL_BORDER_BOX,
  EMPTY_TABLE_BORDER_BOX,
  readCellBorders,
  readTableBorders,
  type CellBorderBox,
  type TableBorderBox,
} from './table-borders.ts';
import {
  AUTO_PREFERRED_WIDTH,
  MAX_TABLE_COLUMNS,
  gridColumnElements,
  preferredLengthPt,
  readPreferredWidth,
  resolveColumnWidthsPt,
  type CellWidthClaim,
  type PreferredWidth,
} from './table-widths.ts';
import {
  CELL_PAD,
  DEFAULT_CELL_MARGINS,
  MAX_CELL_MARGIN_PT,
  mergeMargins,
  readMarginSides,
  type CellMarginsPt,
} from './table-cell-margins.ts';
import { readCellTextDirection } from './table-cell-text-direction.ts';
import { readCellVerticalAlign, type CellVerticalAlign } from './table-cell-vertical-align.ts';
import { tableRowIsHeader } from './table-row-header-style.ts';
import { legacyRoundedCellClaims, legacyTableContentWidth } from './legacy-table-content-width.ts';
export { tableOriginX, tableFloatOriginX } from './table-origin.ts';
// Cell padding is its own unit (`table-cell-margins.ts`); re-exported here because this is
// where the published table surface lives.
export {
  CELL_PAD,
  DEFAULT_CELL_MARGINS,
  MAX_CELL_MARGIN_PT,
  mergeMargins,
  readMarginSides,
  type CellMarginsPt,
};

export {
  AUTO_PREFERRED_WIDTH,
  MAX_TABLE_COLUMNS,
  type PreferredWidth,
  type PreferredWidthType,
} from './table-widths.ts';
export type { CellVerticalAlign } from './table-cell-vertical-align.ts';

/**
 * Layout-time nesting ceiling. Parse-time depth (MAX_DEPTH = 256 XML levels) alone still
 * admits ~80 levels of `w:tbl` recursion into the layout walk; deeper tables render as an
 * empty cell box rather than recursing.
 */
export const MAX_TABLE_NESTING = 16;

/**
 * Soft ceiling on an authored `w:trHeight` (~22"). Hostile `w:val` otherwise becomes a
 * multi-page row that every pagination preflight and cell box inherits.
 */
export const MAX_TABLE_ROW_HEIGHT_PT = 31_680 / 20;

/**
 * `w:trPr/w:trHeight` (17.4.81) resolved for layout. Points leave the reader already —
 * twips convert once here, matching every other table geometry boundary.
 *
 * Word quirk (matches Form025U and Word's UI export): a present `@w:val` with an omitted
 * `@w:hRule` is treated as `atLeast`, not ECMA's `auto`. Explicit `auto` still ignores val.
 */
export type TableRowHeightRule = 'auto' | 'atLeast' | 'exact';

/**
 * `w:trHeight` — a row's height rule and its value.
 *
 * `auto` carries no value at all, which is why this is a union rather than a rule plus an
 * optional number.
 */
export type TableRowHeight =
  | { readonly rule: 'auto' }
  | { readonly rule: 'atLeast' | 'exact'; readonly valuePt: number };

/** Highest grid column a cell may start on; keeps a row's total span bounded. */
const LAST_GRID_COLUMN = MAX_TABLE_COLUMNS - 1;

/** Distinct conditional-format combinations memoized per table; see `styleFormattingFor`. */
const MAX_CELL_CONDITION_SETS = 256;

/** `w:tblPr/w:jc` (17.4.29, ST_JcTable): where the table sits within the text column. */
export type TableAlignment = 'left' | 'center' | 'right';

/**
 * Ceiling on `w:tblInd`, so a stated indent cannot push a table off the sheet. Read through
 * the same unsigned path as every other width here: a negative indent (Word pulls a table
 * into the margin with one) is rejected rather than applied.
 */
const MAX_TABLE_INDENT_PT = 31_680 / 20;

/** `w:tblPr/w:jc`, defaulting to left when absent or unrecognised. */
function readTableAlignment(container: OoxmlElement | undefined): TableAlignment | undefined {
  const jc = container && childNamed(container, 'jc');
  if (!jc) return undefined;
  const value = attributeValue(jc, 'val');
  // `start`/`end` are the strict-conformant spellings of `left`/`right`.
  if (value === 'center') return 'center';
  if (value === 'right' || value === 'end') return 'right';
  if (value === 'left' || value === 'start') return 'left';
  return undefined;
}

/**
 * `w:tblpPr/@w:horzAnchor` (17.4.58) and `@w:vertAnchor` (17.4.66): the box a floated
 * table's offsets are measured from. Absent means `text` for both.
 */
export type TableFloatAnchor = 'text' | 'margin' | 'page';

/** `w:tblpPr/@w:tblpXSpec` (17.4.63, ST_XAlign). */
export type TableFloatXSpec = 'left' | 'center' | 'right' | 'inside' | 'outside';

/** `w:tblpPr/@w:tblpYSpec` (17.4.65, ST_YAlign). */
export type TableFloatYSpec = 'inline' | 'top' | 'center' | 'bottom' | 'inside' | 'outside';

/**
 * `w:tblPr/w:tblpPr` (17.4.57) — a table positioned against an anchor box rather than at
 * the point in the text where it was authored.
 *
 * A spec (`tblpXSpec`/`tblpYSpec`) supersedes the matching offset when both are present:
 * 17.4.57 states the alignment outright, and the offset only answers "how far from the
 * anchor" for the case where no alignment was stated.
 */
export interface TableFloatPosition {
  readonly horzAnchor: TableFloatAnchor;
  readonly vertAnchor: TableFloatAnchor;
  readonly xSpec?: TableFloatXSpec;
  /** `w:tblpX` in points; signed, so a table can be pulled into the margin. */
  readonly xPt: number;
  readonly ySpec?: TableFloatYSpec;
  /** `w:tblpY` in points; signed. */
  readonly yPt: number;
}

/** One anchor box, in the same coordinates layout reports fragment boxes in. */
export interface TableAnchorFrame {
  readonly left: number;
  readonly width: number;
}

/** The three boxes `w:horzAnchor` can name, resolved for the region being laid out. */
export interface TableAnchorFrames {
  /** The text column the table was authored in. */
  readonly text: TableAnchorFrame;
  /** The page's text area between the left and right margins. */
  readonly margin: TableAnchorFrame;
  /** The whole sheet, margins included. */
  readonly page: TableAnchorFrame;
}

/**
 * Ceiling on a `w:tblpX`/`w:tblpY` offset (~22"), matching the other bounded geometry
 * reads here. Both are signed, so the clamp is two-sided.
 */
const MAX_TABLE_FLOAT_OFFSET_PT = 31_680 / 20;

/**
 * One cell in the resolved table structure.
 *
 * `gridSpan` is clamped at READ time and layout never re-derives it — the value comes from a file
 * and would otherwise be a loop bound an attacker controls.
 */
export interface SemanticTableCell {
  readonly id: string;
  /** Derived content-edge geometry for a verified legacy full-width parent table. */
  readonly legacyContentAlignment?: true;
  /** Clamped to [1, MAX_TABLE_COLUMNS] at read time; layout never re-derives it. */
  readonly gridSpan: number;
  /**
   * Absolute grid column this cell starts on, after `w:gridBefore` and every preceding
   * span. Structural conditional formats and cell geometry both key on this, never on the
   * cell's position in the row: one `gridSpan` cell otherwise shifts firstCol/lastCol and
   * the vertical bands for every cell after it.
   */
  readonly gridColumn: number;
  /** Canonical `w:gridCol` node id for this cell's start column, when the grid is authored. */
  readonly gridColumnId?: string;
  /** A vMerge cell that is not the restart continues the cell above: box, no content. */
  readonly vMergeContinue: boolean;
  /** `w:vAlign` — defaults to top when omitted/unrecognised. */
  readonly vAlign: CellVerticalAlign;
  /** `w:textDirection`; unsupported values keep horizontal layout. */
  readonly textDirection: 'horizontal' | 'btLr';
  /** Resolved per-side margins (tcMar over tblCellMar over the table style over Word's default). */
  readonly margins: CellMarginsPt;
  /** Three-state authored `tcBorders` (omitted / none / edge). */
  readonly borders: CellBorderBox;
  /** Validated 6-hex shading fill, absent for none/auto. */
  readonly shading?: string;
  /**
   * `w:tcW` — the width this cell asked for, as authored.
   *
   * Published for consumers that need the cell's own statement (a column-resize handle has
   * to write back to it). Column geometry is NOT derived from this field: the resolver works
   * from a flat claim list built in the same pass, because resolving a column means looking
   * at every cell that covers it across every row, not at one cell at a time. Read
   * `columnWidthsPt` for what the table actually laid out.
   */
  readonly preferredWidth: PreferredWidth;
  /**
   * What the table style says about this cell's paragraphs and runs (17.7.6.6) — a header
   * row's bold and centring live here, not in the cell's own properties.
   */
  readonly styleFormatting: TableCellStyleFormatting;
  /** Block children in reading order, with content-control wrappers flattened. */
  readonly blocks: readonly OoxmlElement[];
}

/** One row in the resolved structure: its cells, its height rule, and any row-level revision. */
export interface SemanticTableRow {
  readonly id: string;
  /** Pending Word row insertion/deletion authored in `w:trPr`. */
  readonly revisionKind?: 'insert' | 'delete';
  /**
   * The `w:trPr/w:ins|w:del` attribution, carried with the kind so a painted row can say
   * WHOSE pending decision it is — the review model addresses the decision by exactly this
   * `(id, author, date)` triple, and a surface with only the kind could highlight the row
   * but never open its card.
   */
  readonly revisionId?: string;
  readonly revisionAuthor?: string;
  readonly revisionDate?: string;
  /** `w:trPr/w:tblHeader` — the row repeats atop each page the table continues onto. */
  readonly isHeader: boolean;
  /**
   * `w:trPr/w:cantSplit` — the row must stay on one page. When it cannot fit a fresh page,
   * layout fails closed rather than fragmenting or overflowing the content box.
   */
  readonly cantSplit: boolean;
  /** `w:trPr/w:trHeight` — auto / atLeast floor / exact (clipped) row height. */
  readonly height: TableRowHeight;
  readonly cells: readonly SemanticTableCell[];
}

/**
 * A table resolved into a rectangular grid: column widths, rows, and the widths it asked for.
 *
 * The grid is normalized here so layout never has to reconcile `w:gridCol` against actual cell
 * spans — vertical merges and column spans are already accounted for.
 */
export interface SemanticTableStructure {
  readonly columnWidthsPt: readonly number[];
  readonly rows: readonly SemanticTableRow[];
  /** Verified pre-2013 content-aligned full-width inline table; derived, never serialized. */
  readonly legacyContentAlignment?: true;
  /** `w:tblPr/w:tblW` — the width the table asked for. */
  readonly tableWidth: PreferredWidth;
  /**
   * `w:tblInd` (17.4.50) in points — "this indentation should shift the table into the text
   * margin by the specified amount". Applies to a left-aligned table; `w:jc` decides the
   * placement outright for the other two.
   */
  readonly indentPt: number;
  /** `w:tblPr/w:jc` (17.4.29) — where the table sits in the text column. */
  readonly alignment: TableAlignment;
  /**
   * `w:tblPr/w:tblpPr` (17.4.57) — present when the table is positioned against an anchor
   * box. Placement then comes from {@link tableFloatOriginX} rather than `w:jc`/`w:tblInd`.
   */
  readonly float?: TableFloatPosition;
  /**
   * `w:tblCellSpacing` (17.4.45) in points: the gap between adjacent cell edges. Applied as
   * a half-gap inset on each side of every cell, so cells separate visually without the grid
   * itself moving. Word ALSO grows the table's overall width by the spacing it adds around
   * the outside; that part is not modelled, so a spaced table is laid out on the same grid
   * its file states rather than a wider one.
   */
  readonly cellSpacingPt: number;
  /**
   * `w:tblPr/w:tblLayout/@w:type="fixed"` (17.4.52 — 17.4.53 is the `w:tblPrEx` exception
   * variant, not this element). Fixed layout takes the grid as final;
   * anything else is autofit, which in Word never renders wider than the text column.
   */
  readonly layoutFixed: boolean;
  /** Table-level `tblBorders` (three-state, including insideH/insideV). */
  readonly tableBorders: TableBorderBox;
  /** Table-level `tblCellMar` defaults (per-side, Word's own default when a side is omitted). */
  readonly defaultMargins: CellMarginsPt;
}

function childNamed(node: OoxmlElement, localName: string): OoxmlElement | undefined {
  for (const child of node.children) {
    if (child.kind !== 'textValue' && child.localName === localName) return child;
  }
  return undefined;
}

function attributeValue(node: OoxmlElement, localName: string): string | undefined {
  return node.attributes.find((attribute) => attribute.localName === localName)?.value;
}

function wmlRevisionChild(
  node: OoxmlElement,
  localName: 'trPr' | 'ins' | 'del'
): OoxmlElement | undefined {
  for (const child of node.children) {
    if (
      child.kind !== 'textValue' &&
      child.namespaceUri === WML_NAMESPACE_URI &&
      child.localName === localName
    ) {
      return child;
    }
  }
  return undefined;
}

function wmlRevisionAttribute(node: OoxmlElement, localName: string): string | undefined {
  return node.attributes.find(
    (attribute) => attribute.namespaceUri === WML_NAMESPACE_URI && attribute.localName === localName
  )?.value;
}

function readGridSpan(cellProperties: OoxmlElement | undefined): number {
  const raw = cellProperties && childNamed(cellProperties, 'gridSpan');
  const value = raw && attributeValue(raw, 'val');
  if (!value || !/^\d{1,7}$/.test(value)) return 1;
  const span = Number(value);
  return Number.isInteger(span) && span > 1 ? Math.min(span, MAX_TABLE_COLUMNS) : 1;
}

/** `w:gridBefore` / `w:gridAfter` (17.4.14 / 17.4.13): grid columns the row leaves empty. */
function readGridSkip(rowProperties: OoxmlElement | undefined, localName: string): number {
  const raw = rowProperties && childNamed(rowProperties, localName);
  const value = raw && attributeValue(raw, 'val');
  if (!value || !/^\d{1,7}$/.test(value)) return 0;
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? Math.min(count, MAX_TABLE_COLUMNS) : 0;
}

function readVMergeContinue(cellProperties: OoxmlElement | undefined): boolean {
  const vMerge = cellProperties && childNamed(cellProperties, 'vMerge');
  if (!vMerge) return false;
  // Explicit "continue" or a bare <w:vMerge/> continues; only "restart" starts a cell.
  return attributeValue(vMerge, 'val') !== 'restart';
}

function readShading(cellProperties: OoxmlElement | undefined): string | undefined {
  return shadingFillFromElement(cellProperties && childNamed(cellProperties, 'shd'));
}

/**
 * A `w:trPr` toggle (`w:tblHeader`, `w:cantSplit`), absent meaning off.
 *
 * `off` is an off value (§17.17.4), like `0` and `false` — the `onOff` helper below already
 * accepts all three. Missing it here meant `<w:tblHeader w:val="off"/>` read as ON, and the
 * row repeated as a header on every page of a long table.
 */
function readFlag(container: OoxmlElement | undefined, localName: string): boolean {
  const flag = container && childNamed(container, localName);
  if (!flag) return false;
  const value = attributeValue(flag, 'val');
  return value === undefined || (value !== '0' && value !== 'false' && value !== 'off');
}

const AUTO_ROW_HEIGHT: TableRowHeight = Object.freeze({ rule: 'auto' });

/**
 * Read `w:trHeight` (17.4.81). Hostile / unreadable values demote to auto so layout still
 * sizes from content rather than inventing geometry.
 */
function readRowHeight(rowProperties: OoxmlElement | undefined): TableRowHeight {
  const node = rowProperties && childNamed(rowProperties, 'trHeight');
  if (!node) return AUTO_ROW_HEIGHT;
  const rawRule = attributeValue(node, 'hRule');
  const rule: TableRowHeightRule | undefined =
    rawRule === 'auto' || rawRule === 'exact' || rawRule === 'atLeast' ? rawRule : undefined;
  if (rule === 'auto') return AUTO_ROW_HEIGHT;

  const rawVal = attributeValue(node, 'val');
  if (rawVal === undefined || !/^\d{1,9}$/.test(rawVal)) return AUTO_ROW_HEIGHT;
  const twips = Number(rawVal);
  if (!Number.isFinite(twips) || twips <= 0) return AUTO_ROW_HEIGHT;
  const valuePt = Math.min(twips / 20, MAX_TABLE_ROW_HEIGHT_PT);
  if (!(valuePt > 0)) return AUTO_ROW_HEIGHT;

  // Omitted hRule + present val → atLeast (Word), not ECMA's auto-with-ignored-val.
  const effective: 'atLeast' | 'exact' = rule === 'exact' ? 'exact' : 'atLeast';
  return { rule: effective, valuePt };
}

function readFloatAnchor(raw: string | undefined): TableFloatAnchor | undefined {
  if (raw === 'page') return 'page';
  if (raw === 'margin') return 'margin';
  if (raw === 'text') return 'text';
  return undefined;
}

function readSignedTwipsPt(raw: string | undefined): number | undefined {
  if (raw === undefined || !/^-?\d{1,9}$/.test(raw)) return undefined;
  const twips = Number(raw);
  if (!Number.isFinite(twips)) return undefined;
  const pt = twips / 20;
  return Math.max(-MAX_TABLE_FLOAT_OFFSET_PT, Math.min(MAX_TABLE_FLOAT_OFFSET_PT, pt));
}

/**
 * Read `w:tblpPr`. Absent anchors default to `text` (17.4.58/17.4.66); an unrecognised
 * spec is dropped rather than guessed at, which leaves the offset to place the table.
 */
function readTableFloatPosition(
  container: OoxmlElement | undefined
): TableFloatPosition | undefined {
  const tblpPr = container && childNamed(container, 'tblpPr');
  if (!tblpPr) return undefined;
  const rawXSpec = attributeValue(tblpPr, 'tblpXSpec');
  const xSpec: TableFloatXSpec | undefined =
    rawXSpec === 'left' ||
    rawXSpec === 'center' ||
    rawXSpec === 'right' ||
    rawXSpec === 'inside' ||
    rawXSpec === 'outside'
      ? rawXSpec
      : undefined;
  const rawYSpec = attributeValue(tblpPr, 'tblpYSpec');
  const ySpec: TableFloatYSpec | undefined =
    rawYSpec === 'inline' ||
    rawYSpec === 'top' ||
    rawYSpec === 'center' ||
    rawYSpec === 'bottom' ||
    rawYSpec === 'inside' ||
    rawYSpec === 'outside'
      ? rawYSpec
      : undefined;
  return {
    horzAnchor: readFloatAnchor(attributeValue(tblpPr, 'horzAnchor')) ?? 'text',
    vertAnchor: readFloatAnchor(attributeValue(tblpPr, 'vertAnchor')) ?? 'text',
    ...(xSpec ? { xSpec } : {}),
    xPt: readSignedTwipsPt(attributeValue(tblpPr, 'tblpX')) ?? 0,
    ...(ySpec ? { ySpec } : {}),
    yPt: readSignedTwipsPt(attributeValue(tblpPr, 'tblpY')) ?? 0,
  };
}

/**
 * `w:tblLook` (17.4.56): which conditional formats of the table style are live.
 *
 * Word writes both the modern attributes (`w:firstRow="1"`) and the legacy `w:val`
 * bitmask, and older producers write only the bitmask. Both are read; an attribute wins
 * where the two disagree, because that is the newer statement.
 */
interface TableLook {
  readonly firstRow: boolean;
  readonly lastRow: boolean;
  readonly firstColumn: boolean;
  readonly lastColumn: boolean;
  readonly rowBanding: boolean;
  readonly columnBanding: boolean;
}

/**
 * No `w:tblLook` at all says exactly what an empty `<w:tblLook/>` says. `noHBand`/`noVBand`
 * are NEGATIVE flags and the legacy bitmask defaults to `0000`, so 17.4.56's default is to
 * apply row and column banding but neither the first/last row nor the first/last column
 * format. Reading the absent element as "nothing is live" made the same semantic state
 * render two different ways depending on whether the producer wrote the empty tag.
 */
const DEFAULT_TABLE_LOOK: TableLook = Object.freeze({
  firstRow: false,
  lastRow: false,
  firstColumn: false,
  lastColumn: false,
  rowBanding: true,
  columnBanding: true,
});

function onOff(node: OoxmlElement, name: string): boolean | undefined {
  const raw = attributeValue(node, name);
  if (raw === undefined) return undefined;
  return raw !== '0' && raw !== 'false' && raw !== 'off';
}

/**
 * `w:tblLook` is read from the TABLE's own `w:tblPr` only, never cascaded from the style it
 * names. The schema admits `w:tblLook` inside a table style's `w:tblPr`, but the look is
 * Word's per-table "Table Style Options" checkbox set — a property of this table's use of
 * the style, not of the style — and Word writes one on every table it creates.
 */
function readTableLook(tblPr: OoxmlElement | undefined): TableLook {
  const look = tblPr && childNamed(tblPr, 'tblLook');
  if (!look) return DEFAULT_TABLE_LOOK;
  // The legacy bitmask: 0x0020 firstRow, 0x0040 lastRow, 0x0080 firstColumn,
  // 0x0100 lastColumn, 0x0200 NO row banding, 0x0400 NO column banding.
  const rawVal = attributeValue(look, 'val');
  const mask = rawVal && /^[0-9A-Fa-f]{1,4}$/.test(rawVal) ? Number.parseInt(rawVal, 16) : 0;
  return {
    firstRow: onOff(look, 'firstRow') ?? (mask & 0x0020) !== 0,
    lastRow: onOff(look, 'lastRow') ?? (mask & 0x0040) !== 0,
    firstColumn: onOff(look, 'firstColumn') ?? (mask & 0x0080) !== 0,
    lastColumn: onOff(look, 'lastColumn') ?? (mask & 0x0100) !== 0,
    rowBanding:
      onOff(look, 'noHBand') === undefined ? (mask & 0x0200) === 0 : !onOff(look, 'noHBand'),
    columnBanding:
      onOff(look, 'noVBand') === undefined ? (mask & 0x0400) === 0 : !onOff(look, 'noVBand'),
  };
}

/** Bit positions of `w:cnfStyle/@w:val` (17.4.7 row, 17.4.8 cell), most significant first. */
const CNF_BITS = [
  'firstRow',
  'lastRow',
  'firstCol',
  'lastCol',
  'band1Vert',
  'band2Vert',
  'band1Horz',
  'band2Horz',
  'nwCell',
  'neCell',
  'swCell',
  'seCell',
] as const;

/** The same twelve conditions as named `w:cnfStyle` attributes (CT_Cnf), in bit order. */
const CNF_ATTRIBUTES = [
  'firstRow',
  'lastRow',
  'firstColumn',
  'lastColumn',
  'oddVBand',
  'evenVBand',
  'oddHBand',
  'evenHBand',
  'firstRowFirstColumn',
  'firstRowLastColumn',
  'lastRowFirstColumn',
  'lastRowLastColumn',
] as const;

/**
 * `w:cnfStyle`: the producer stating which conditions a row or cell is under.
 *
 * Read like `w:tblLook`, from both encodings — the legacy `w:val` bitmask and the named
 * attributes, which are all a strict-conformant producer writes.
 */
function readCnfStyle(container: OoxmlElement | undefined, into: Set<string>): void {
  const cnf = container && childNamed(container, 'cnfStyle');
  if (!cnf) return;
  const raw = attributeValue(cnf, 'val');
  if (raw && /^[01]{1,12}$/.test(raw)) {
    for (let index = 0; index < raw.length && index < CNF_BITS.length; index += 1) {
      if (raw[index] === '1') into.add(CNF_BITS[index]!);
    }
  }
  for (let index = 0; index < CNF_ATTRIBUTES.length; index += 1) {
    if (onOff(cnf, CNF_ATTRIBUTES[index]!) === true) into.add(CNF_BITS[index]!);
  }
}

/**
 * Word layers a table style's conditional formats weakest first: the whole table, then the
 * bands, then first/last column, then first/last row, then the four corners (17.7.6). Both
 * the derived and the stated conditions emit through this one order — `w:cnfStyle` lists
 * its conditions in BIT order, which puts the bands last and let a banding fill overwrite
 * the shading of a styled header row.
 */
const CONDITION_PRECEDENCE = [
  'band1Vert',
  'band2Vert',
  'band1Horz',
  'band2Horz',
  'firstCol',
  'lastCol',
  'firstRow',
  'lastRow',
  'nwCell',
  'neCell',
  'swCell',
  'seCell',
] as const;

/**
 * Which of the style's conditional formats apply to one cell, weakest first.
 *
 * A `w:cnfStyle` is added to the derivation rather than replacing it: it is a cache the
 * producer wrote, and a row that states "I am the header" is still in whichever column and
 * band the grid puts it in. Structural conditions key on the GRID COLUMN the cell occupies,
 * so a `gridSpan` or a `w:gridBefore` earlier in the row cannot shift them.
 */
function conditionalTypesFor(input: {
  readonly look: TableLook;
  readonly rowIndex: number;
  readonly rowCount: number;
  readonly gridColumn: number;
  readonly gridSpan: number;
  readonly columnCount: number;
  readonly rowProperties: OoxmlElement | undefined;
  readonly cellProperties: OoxmlElement | undefined;
}): readonly string[] {
  const active = new Set<string>();
  readCnfStyle(input.rowProperties, active);
  readCnfStyle(input.cellProperties, active);

  const { look, rowIndex, rowCount, gridColumn, gridSpan, columnCount } = input;
  const isFirstRow = active.has('firstRow') || (look.firstRow && rowIndex === 0);
  const isLastRow = active.has('lastRow') || (look.lastRow && rowIndex === rowCount - 1);
  const isFirstColumn = active.has('firstCol') || (look.firstColumn && gridColumn === 0);
  const isLastColumn =
    active.has('lastCol') || (look.lastColumn && gridColumn + gridSpan >= columnCount);

  const statedVBand = active.has('band1Vert') || active.has('band2Vert');
  if (!statedVBand && look.columnBanding && !isFirstColumn && !isLastColumn) {
    const band = gridColumn - (look.firstColumn ? 1 : 0);
    active.add(band % 2 === 0 ? 'band1Vert' : 'band2Vert');
  }
  const statedHBand = active.has('band1Horz') || active.has('band2Horz');
  if (!statedHBand && look.rowBanding && !isFirstRow && !isLastRow) {
    const band = rowIndex - (look.firstRow ? 1 : 0);
    active.add(band % 2 === 0 ? 'band1Horz' : 'band2Horz');
  }
  if (isFirstColumn) active.add('firstCol');
  if (isLastColumn) active.add('lastCol');
  if (isFirstRow) active.add('firstRow');
  if (isLastRow) active.add('lastRow');
  if (isFirstRow && isFirstColumn) active.add('nwCell');
  if (isFirstRow && isLastColumn) active.add('neCell');
  if (isLastRow && isFirstColumn) active.add('swCell');
  if (isLastRow && isLastColumn) active.add('seCell');

  const ordered: string[] = [];
  for (const condition of CONDITION_PRECEDENCE) if (active.has(condition)) ordered.push(condition);
  return ordered;
}

interface TableStructureMemo {
  readonly contentWidthPt: number;
  readonly depth: number;
  readonly styleCascade: StyleCascadeTable | undefined;
  readonly displayMode: RevisionDisplayMode;
  readonly authorFilter: RevisionAuthorFilter | undefined;
  readonly compatibilityMode: number | undefined;
  readonly structure: SemanticTableStructure | null;
}

/** The last unfiltered structure for each immutable table node. */
const tableStructureMemos = new WeakMap<object, TableStructureMemo>();

/**
 * The last filtered structure for each immutable table node. A separate cache lets save-time
 * canonical layout keep both projections warm without slowing the common unfiltered lookup.
 */
const filteredTableStructureMemos = new WeakMap<object, TableStructureMemo>();

/**
 * Read one typed table node into a bounded structure, or null when the node is not a
 * typed table or sits beyond the nesting ceiling.
 */
export function readTableStructure(
  table: OoxmlNode,
  contentWidthPt: number,
  depth: number,
  styleCascade?: StyleCascadeTable,
  /** Which revisions the view resolves away; only the proposed result performs the join. */
  displayMode: RevisionDisplayMode = 'all-markup',
  authorFilter?: RevisionAuthorFilter,
  compatibilityMode?: number
): SemanticTableStructure | null {
  const memoStore = authorFilter ? filteredTableStructureMemos : tableStructureMemos;
  const memo = memoStore.get(table);
  if (
    memo &&
    memo.contentWidthPt === contentWidthPt &&
    memo.depth === depth &&
    // Identity compare is sound because a cascade table is built once per styles part and
    // never mutated; a fresh-but-equal cascade only misses the memo, never lies to it.
    memo.styleCascade === styleCascade &&
    memo.displayMode === displayMode &&
    memo.authorFilter === authorFilter &&
    memo.compatibilityMode === compatibilityMode
  ) {
    return memo.structure;
  }
  const structure = readTableStructureUncached(
    table,
    contentWidthPt,
    depth,
    styleCascade,
    displayMode,
    authorFilter,
    compatibilityMode
  );
  const entry: TableStructureMemo = {
    contentWidthPt,
    depth,
    styleCascade,
    displayMode,
    authorFilter,
    compatibilityMode,
    structure,
  };
  memoStore.set(table, entry);
  return structure;
}

function readTableStructureUncached(
  table: OoxmlNode,
  contentWidthPt: number,
  depth: number,
  styleCascade: StyleCascadeTable | undefined,
  displayMode: RevisionDisplayMode,
  authorFilter?: RevisionAuthorFilter,
  compatibilityMode?: number
): SemanticTableStructure | null {
  if (depth >= MAX_TABLE_NESTING) return null;
  if (table.kind !== 'table') return null;

  const tblPr = childNamed(table, 'tblPr');
  // A table's appearance mostly lives in its STYLE. Word writes
  // `<w:tblStyle w:val="TableGrid"/>` and keeps the grid in styles.xml, so reading the
  // table's own `w:tblPr` alone draws a borderless table where Word draws a full grid.
  const styleId =
    tblPr && childNamed(tblPr, 'tblStyle')
      ? attributeValue(childNamed(tblPr, 'tblStyle')!, 'val')
      : undefined;
  const tableStyle = styleCascade
    ? cascadeTableFormatting(styleCascade, styleId)
    : EMPTY_TABLE_FORMATTING;
  const look = readTableLook(tblPr);

  let styleMargins = DEFAULT_CELL_MARGINS;
  let styleBorders = EMPTY_TABLE_BORDER_BOX;
  for (const node of tableStyle.tablePropertyNodes) {
    styleMargins = mergeMargins(styleMargins, readMarginSides(childNamed(node, 'tblCellMar')));
    styleBorders = mergeTableBorders(styleBorders, readTableBorders(node));
  }
  const defaultMargins = mergeMargins(
    styleMargins,
    readMarginSides(tblPr && childNamed(tblPr, 'tblCellMar'))
  );
  const tableBorders = mergeTableBorders(
    styleBorders,
    tblPr ? readTableBorders(tblPr) : EMPTY_TABLE_BORDER_BOX
  );

  // Cells under the same conditions resolve to the same paragraph/run material, and a table
  // has few distinct condition sets. Memoized per table so a 10k-cell table flattens the
  // style chain a handful of times, not once per cell. A hostile `w:cnfStyle` can still name
  // up to 4096 distinct sets, so the memo stops growing at the ceiling and later cells simply
  // resolve unmemoized — same bounded per-cell work either way.
  const styleByConditions = new Map<string, TableCellStyleFormatting>();
  // Word's `TableNormal` states `w:tblPr` and nothing else, and every table now resolves it,
  // so the identity check against `EMPTY_TABLE_FORMATTING` that used to short-circuit here
  // stopped firing — every cell of every unstyled table flattened a chain that could only
  // ever answer "nothing". Ask what the style actually contributes to a CELL instead.
  const cellStyleMaterial = tableStyleAffectsCells(tableStyle);
  const styleFormattingFor = (conditions: readonly string[]): TableCellStyleFormatting => {
    if (!cellStyleMaterial) return EMPTY_TABLE_CELL_STYLE_FORMATTING;
    const key = conditions.join('|');
    const cached = styleByConditions.get(key);
    if (cached) return cached;
    const resolved = tableCellStyleFormatting(tableStyle, conditions);
    if (styleByConditions.size < MAX_CELL_CONDITION_SETS) styleByConditions.set(key, resolved);
    return resolved;
  };

  // Grid pass. Every cell's absolute grid column, and the table's column count, are settled
  // before any conditional format is derived — both key on the grid, not on cell order. A
  // cell may start no later than the last column and may not span past it, which is what
  // bounds a ROW's total span: per-cell `w:gridSpan` is already clamped, but a row of
  // thousands of maximum-span cells would otherwise walk millions of grid intervals in the
  // border pass. Fails closed like the ownership and vMerge budgets: the overflow cells
  // pile onto the last column instead of extending the grid.
  interface RowPlan {
    readonly node: OoxmlElement;
    readonly revision: OoxmlElement | undefined;
    /** The row's cells with any `CT_SdtCell` wrapper unwrapped, so both passes see one list. */
    readonly cells: readonly OoxmlNode[];
    readonly properties: OoxmlElement | undefined;
    readonly starts: readonly number[];
    readonly spans: readonly number[];
    readonly preferred: readonly PreferredWidth[];
    readonly gridColumns: number;
  }
  const plans: RowPlan[] = [];
  const claims: CellWidthClaim[] = [];
  let derivedColumns = 1;
  // A content control may sit between the table and its rows (`CT_SdtRow`) or between a row and
  // its cells (`CT_SdtCell`). It is a label on that row or cell, not a box around it, so it is
  // unwrapped HERE — before the kind filter — and the grid pass, the cell pass and pagination all
  // see the same row and cell lists they would see in a table that carried no controls at all.
  for (const rowNode of flattenContentControls(table.children)) {
    if (rowNode.kind !== 'tableRow') continue;
    const properties = wmlRevisionChild(rowNode, 'trPr');
    const authoredRevision = properties
      ? (wmlRevisionChild(properties, 'ins') ?? wmlRevisionChild(properties, 'del'))
      : undefined;
    const revisionKind = authoredRevision?.localName;
    const revisionAuthor = authoredRevision
      ? (wmlRevisionAttribute(authoredRevision, 'author') ?? '')
      : undefined;
    const projectedMode =
      authoredRevision && revisionAuthor !== undefined && authorFilter
        ? revisionNodeProjectionMode(authorFilter, authoredRevision.id, revisionAuthor, displayMode)
        : displayMode;
    if (
      (projectedMode === 'proposed' && revisionKind === 'del') ||
      (projectedMode === 'original' && revisionKind === 'ins')
    ) {
      continue;
    }
    const revision = projectedMode === 'all-markup' ? authoredRevision : undefined;
    const starts: number[] = [];
    const spans: number[] = [];
    const preferred: PreferredWidth[] = [];
    const gridBefore = Math.min(readGridSkip(properties, 'gridBefore'), LAST_GRID_COLUMN);
    // 17.18.87: "the initial number of grid units before the row starts is skipped. The
    // width of the skipped grid columns is set using the wBefore property." Without this the
    // skipped band is a column nothing states, and it absorbs the leftover as a phantom
    // gutter wider than the cells it precedes.
    if (gridBefore > 0) {
      claims.push({
        start: 0,
        span: gridBefore,
        preferred: readPreferredWidth(properties && childNamed(properties, 'wBefore')),
      });
    }
    let cursor = gridBefore;
    const rowCells = flattenContentControls(rowNode.children);
    for (const cellNode of rowCells) {
      if (cellNode.kind !== 'tableCell') continue;
      const cellPr = childNamed(cellNode, 'tcPr');
      const start = Math.min(cursor, LAST_GRID_COLUMN);
      const span = Math.min(
        readGridSpan(cellPr),
        MAX_TABLE_COLUMNS - start // ≥ 1: `start` never exceeds the last column
      );
      const width = readPreferredWidth(cellPr && childNamed(cellPr, 'tcW'));
      starts.push(start);
      spans.push(span);
      preferred.push(width);
      claims.push({ start, span, preferred: width });
      cursor = start + span;
    }
    const gridAfter = readGridSkip(properties, 'gridAfter');
    const gridColumns = Math.min(cursor + gridAfter, MAX_TABLE_COLUMNS);
    // 17.4.85, the trailing counterpart of `w:wBefore`.
    if (gridAfter > 0 && cursor < MAX_TABLE_COLUMNS) {
      claims.push({
        start: cursor,
        span: Math.min(gridAfter, MAX_TABLE_COLUMNS - cursor),
        preferred: readPreferredWidth(properties && childNamed(properties, 'wAfter')),
      });
    }
    if (gridColumns > derivedColumns) derivedColumns = gridColumns;
    plans.push({
      node: rowNode,
      revision,
      cells: rowCells,
      properties,
      starts,
      spans,
      preferred,
      gridColumns,
    });
  }

  const gridCols = gridColumnElements(table);
  const columnCount = gridCols.length > 0 ? gridCols.length : derivedColumns;
  const bodyRows = plans.length;

  const rows: SemanticTableRow[] = [];
  for (let rowIndex = 0; rowIndex < plans.length; rowIndex += 1) {
    const plan = plans[rowIndex]!;
    const rowNode = plan.node;
    const rowProperties = plan.properties;
    const rowConditions = conditionalTypesFor({
      look,
      rowIndex,
      rowCount: bodyRows,
      gridColumn: 0,
      gridSpan: Math.max(1, columnCount),
      columnCount: Math.max(1, columnCount),
      rowProperties,
      cellProperties: undefined,
    });
    const isHeader = tableRowIsHeader(tableStyle, rowConditions, rowProperties);
    let cellIndex = 0;
    const cells: SemanticTableCell[] = [];
    for (const cellNode of plan.cells) {
      if (cellNode.kind !== 'tableCell') continue;
      const cellProperties = childNamed(cellNode, 'tcPr');
      const gridColumn = plan.starts[cellIndex]!;
      const gridSpan = plan.spans[cellIndex]!;
      // Read alongside its siblings, before `cellIndex` moves on — the plan loop and this
      // one skip the same non-cell children, and the indices must stay in lockstep.
      const preferredWidth = plan.preferred[cellIndex] ?? AUTO_PREFERRED_WIDTH;
      const conditions = conditionalTypesFor({
        look,
        rowIndex,
        rowCount: bodyRows,
        gridColumn,
        gridSpan,
        columnCount,
        // A producer may state the conditions itself rather than leave them to be derived.
        rowProperties,
        cellProperties,
      });
      cellIndex += 1;
      let conditionalShading: string | undefined;
      let conditionalBorders = EMPTY_CELL_BORDER_BOX;
      for (const conditionType of conditions) {
        const format = tableStyle.conditional.get(conditionType);
        if (!format) continue;
        const conditionTcPr = childNamed(format, 'tcPr');
        conditionalShading = readShading(conditionTcPr) ?? conditionalShading;
        conditionalBorders = mergeCellBorders(conditionalBorders, readCellBorders(conditionTcPr));
      }
      const shading = readShading(cellProperties) ?? conditionalShading;
      const cellMargins = mergeMargins(
        defaultMargins,
        readMarginSides(cellProperties && childNamed(cellProperties, 'tcMar'))
      );
      // Content controls inside a cell flatten transparently — same rule as body
      // `storyBlocks`. Without this a `w:sdt` wrapping the cell's paragraphs leaves the
      // cell empty in layout while the tree still holds the text.
      // Through the shared collector: a cell is a story like any other, so a tracked mark
      // merges inside it and a paragraph a revision removed leaves no blank line behind.
      const blocks = mergedFlowBlocks(cellNode.children, displayMode, authorFilter);
      cells.push({
        id: cellNode.id,
        gridSpan,
        gridColumn,
        ...(gridCols[gridColumn]?.id ? { gridColumnId: gridCols[gridColumn]!.id } : {}),
        vMergeContinue: readVMergeContinue(cellProperties),
        vAlign: readCellVerticalAlign(cellProperties),
        textDirection: readCellTextDirection(cellProperties),
        margins: cellMargins,
        borders: mergeCellBorders(
          conditionalBorders,
          cellProperties ? readCellBorders(cellProperties) : EMPTY_CELL_BORDER_BOX
        ),
        ...(shading === undefined ? {} : { shading }),
        preferredWidth,
        styleFormatting: styleFormattingFor(conditions),
        blocks,
      });
    }
    const rowRevision = plan.revision;
    const rowRevisionKind = rowRevision
      ? rowRevision.localName === 'ins'
        ? ('insert' as const)
        : ('delete' as const)
      : undefined;
    const rowRevisionId = rowRevision && wmlRevisionAttribute(rowRevision, 'id');
    const rowRevisionAuthor = rowRevision && wmlRevisionAttribute(rowRevision, 'author');
    const rowRevisionDate = rowRevision && wmlRevisionAttribute(rowRevision, 'date');
    rows.push({
      id: rowNode.id,
      ...(rowRevisionKind ? { revisionKind: rowRevisionKind } : {}),
      ...(rowRevisionId !== undefined ? { revisionId: rowRevisionId } : {}),
      ...(rowRevisionAuthor !== undefined ? { revisionAuthor: rowRevisionAuthor } : {}),
      ...(rowRevisionDate !== undefined ? { revisionDate: rowRevisionDate } : {}),
      isHeader,
      cantSplit: readFlag(rowProperties, 'cantSplit'),
      height: readRowHeight(rowProperties),
      cells,
    });
  }

  // `w:tblW` and `w:tblLayout` both live in CT_TblPrBase, which is what a table STYLE's
  // `w:tblPr` carries — the same reason `tblCellMar` and `tblBorders` cascade above. A style
  // that states "AutoFit to Window" or fixed layout is stating it for every table that names
  // it. 17.4.52: an absent `w:tblLayout` means autofit.
  let styleTableWidth = AUTO_PREFERRED_WIDTH;
  let styleLayoutFixed: boolean | undefined;
  let styleIndentPt: number | undefined;
  let styleAlignment: TableAlignment | undefined;
  let styleCellSpacingPt: number | undefined;
  let styleFloat: TableFloatPosition | undefined;
  for (const node of tableStyle.tablePropertyNodes) {
    const styleW = childNamed(node, 'tblW');
    if (styleW) styleTableWidth = readPreferredWidth(styleW);
    const styleLayout = childNamed(node, 'tblLayout');
    if (styleLayout) styleLayoutFixed = attributeValue(styleLayout, 'type') === 'fixed';
    styleIndentPt =
      preferredLengthPt(childNamed(node, 'tblInd'), MAX_TABLE_INDENT_PT) ?? styleIndentPt;
    styleAlignment = readTableAlignment(node) ?? styleAlignment;
    styleCellSpacingPt =
      preferredLengthPt(childNamed(node, 'tblCellSpacing'), MAX_CELL_MARGIN_PT) ??
      styleCellSpacingPt;
    styleFloat = readTableFloatPosition(node) ?? styleFloat;
  }
  const ownTblW = tblPr && childNamed(tblPr, 'tblW');
  const tableWidth = ownTblW ? readPreferredWidth(ownTblW) : styleTableWidth;
  const tblLayout = tblPr && childNamed(tblPr, 'tblLayout');
  const layoutFixed = tblLayout
    ? attributeValue(tblLayout, 'type') === 'fixed'
    : (styleLayoutFixed ?? false);
  const indentPt =
    preferredLengthPt(tblPr && childNamed(tblPr, 'tblInd'), MAX_TABLE_INDENT_PT) ??
    styleIndentPt ??
    0;
  const alignment = readTableAlignment(tblPr) ?? styleAlignment ?? 'left';
  // A nested table's position is stated against its cell, not the page — `w:tblpPr` inside
  // one is honoured by Word only for the top-level table, so deeper tables stay in flow.
  const float = depth === 0 ? (readTableFloatPosition(tblPr) ?? styleFloat) : undefined;
  const cellSpacingPt =
    preferredLengthPt(tblPr && childNamed(tblPr, 'tblCellSpacing'), MAX_CELL_MARGIN_PT) ??
    styleCellSpacingPt ??
    0;

  const legacyWidth = legacyTableContentWidth({
    table,
    propertyNodes: tableStyle.tablePropertyNodes,
    rows,
    columnCount,
    contentWidthPt,
    compatibilityMode,
    depth,
    tableWidth,
    layoutFixed,
    alignment,
    indentPt,
    cellSpacingPt,
    floating: float !== undefined,
  });

  return {
    columnWidthsPt: resolveColumnWidthsPt({
      gridCols,
      claims:
        legacyWidth === undefined ? claims : legacyRoundedCellClaims(claims, gridCols, legacyWidth),
      columnCount,
      contentWidthPt: legacyWidth ?? contentWidthPt,
      tableWidth,
      layoutFixed,
    }),
    rows:
      legacyWidth === undefined
        ? rows
        : rows.map((row) => ({
            ...row,
            cells: row.cells.map((cell) => ({ ...cell, legacyContentAlignment: true as const })),
          })),
    ...(legacyWidth === undefined ? {} : { legacyContentAlignment: true as const }),
    tableWidth,
    layoutFixed,
    indentPt,
    alignment,
    ...(float ? { float } : {}),
    cellSpacingPt,
    tableBorders,
    defaultMargins,
  };
}
