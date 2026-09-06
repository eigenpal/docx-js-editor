// Table row and cell layout over the canonical tree.
//
// Row, cell, and nested-table flow operate on typed tree nodes with the injected
// TextMeasurer and emit semantic records:
//
//   - a row is laid out in TWO PASSES — every cell flows into a buffer while the tallest
//     bottom is tracked, then every cell box is emitted at the final row height;
//   - a vMerge continuation emits its box but no content, so text is never duplicated;
//   - after all rows of a fragment are placed, vertical merges expand the restart box,
//     vAlign shifts content, and collapsed borders resolve onto layout-owned edges;
//   - top-level table rows paginate with a real-height preflight: an unsplit row that does
//     not fit moves to the next page; a row taller than a fresh page fragments at
//     paragraph/line boundaries when splittable, or fails closed under w:cantSplit /
//     unsupported nested cuts;
//   - a NESTED table lays out with its own geometry inside the cell box, no pagination.
//
// All coordinates are points, relative to the page content box — exactly the space body
// paragraph fragments already live in. Cell paragraph breaks go through the shared
// `breakParagraph`, so they hit the same cache with keys at the cell's content width.

import type { OoxmlElement, OoxmlNode } from '@docx-editor.dev/core/store';
import { stripAnchorSinksForProbe } from './table-probe-deps.ts';
import {
  clipInlineDrawingRecordToRegion,
  publishAnchoredDrawingsForParagraph,
  shiftInlineDrawingRecord,
  type AnchoredDrawingRecord,
  type DrawingAnchorFrameContext,
} from './drawing-layout.ts';
import {
  exclusionLayoutToken,
  filterExclusionZonesForParagraphOrder,
  localizeExclusionZones,
  topAndBottomSkipBeforeLine,
} from './drawing-exclusion.ts';
import type {
  FieldLinkProjector,
  FieldPageContext,
  HyperlinkProjector,
} from './field-projection.ts';
import {
  paragraphLayoutKey,
  withDrawingContext,
  type ParagraphLayoutCache,
} from './layout-cache.ts';
import { alignDrawings, alignSpans, breakParagraph, type PendingLine } from './paragraph-flow.ts';
import { mergeBoundariesOf, remapMergedLines } from './merged-paragraph-ranges.ts';
import { isEmptyCellTerminator, paragraphMergeGroupOf } from './story-roots.ts';
import {
  publishDeferredRowAnchors,
  rowDepsForAnchors,
  type DeferredRowAnchor,
} from './table-anchor-republish.ts';
import {
  markRevisionFields,
  paragraphMarkMarkupVisible,
  visibleParagraphMarkRevisionsOf,
  type RevisionAuthorFilter,
  type RevisionDisplayMode,
} from './revision-projection.ts';
import {
  collapsedSpaceBefore,
  paragraphBorderExtentPt,
  paragraphBorderStrokeWidthPt,
} from './paragraph-style.ts';
import { tabStopsFingerprint, withDefaultTabInterval } from './paragraph-tabs.ts';
import { DEFAULT_RUN_STYLE } from './run-style.ts';
import {
  resolveParagraphLayoutInputs,
  cascadeRunProperties,
  type StyleCascadeTable,
  type TableCellStyleFormatting,
} from './style-cascade.ts';
import {
  neighbourBorderGroupKey,
  paragraphBorderGroupKey,
  rememberCellBorderGroupKey,
  type CellBorderGroupContext,
} from './cell-border-groups.ts';
import { paragraphShadingBox } from './ooxml-shading.ts';
import {
  MAX_TABLE_NESTING,
  readTableStructure,
  tableOriginX,
  type SemanticTableCell,
  type SemanticTableRow,
  type SemanticTableStructure,
} from './semantic-table.ts';
import type {
  BlockFragmentRecord,
  LineRecord,
  ParagraphBorderStrokeRecord,
  ParagraphBottomBorderRecord,
  ParagraphFragmentRecord,
  TableCellFragmentRecord,
  TableFragmentRecord,
  TableRowFragmentRecord,
  TextMeasurer,
  LayoutBox,
} from './semantic-records.ts';
import { firstLineShift, type ResolvedListItem } from './list-resolve.ts';
import { publishListMarker } from './list-marker.ts';
import { annotateTableFragmentGeometry } from './semantic-table-interaction.ts';
import type { TableBorderOwnershipBudget } from './table-borders.ts';
import { type TableVMergeResolveBudget } from './table-vmerge.ts';
import { acceptVMergeSpansAt, planTableVMergeHeights } from './table-vmerge-heights.ts';
import { contentInsets } from './table-cell-geometry.ts';
import { blockInlineRight } from './table-cell-text-direction.ts';
import { finalizeTableRows, shiftBlocks } from './table-fragment-finalize.ts';
export { finalizeTableRows } from './table-fragment-finalize.ts';
export { rowWithSplitBorders } from './table-cell-geometry.ts';
import type { RowVMergeLayoutOptions, VMergeRowHeights } from './table-vmerge-heights.ts';

export {
  createTableBorderOwnershipBudget,
  MAX_BORDER_OWNERSHIP_INTERVALS,
} from './table-borders.ts';

/** Walk top-level prepared blocks and table cell paragraphs in document order. */
export function paragraphDocumentOrderOf(
  prepared: readonly {
    readonly kind: 'paragraph' | 'table';
    readonly paragraph?: OoxmlElement;
    readonly table?: OoxmlElement;
  }[],
  contentWidth: number,
  styleCascade: StyleCascadeTable | undefined,
  displayMode: RevisionDisplayMode,
  authorFilter?: RevisionAuthorFilter
): ReadonlyMap<string, number> {
  const order = new Map<string, number>();
  let index = 0;
  const walkTable = (table: OoxmlElement): void => {
    const structure = readTableStructure(
      table,
      contentWidth,
      0,
      styleCascade,
      displayMode,
      authorFilter
    );
    if (!structure) return;
    for (const row of structure.rows) {
      for (const cell of row.cells) {
        for (const block of cell.blocks) {
          if (block.localName === 'p') {
            order.set(block.id, index++);
          } else if (block.localName === 'tbl') {
            walkTable(block);
          }
        }
      }
    }
  };
  for (const block of prepared) {
    if (block.kind === 'paragraph' && block.paragraph) {
      order.set(block.paragraph.id, index++);
    } else if (block.kind === 'table' && block.table) {
      walkTable(block.table);
    }
  }
  return order;
}

export {
  createTableVMergeResolveBudget,
  MAX_VMERGE_RESOLVE_CELLS,
  type TableVMergeResolveBudget,
} from './table-vmerge.ts';

/** Soft ceiling on fragments emitted for one authored row (hostile / runaway splits). */
export const MAX_TABLE_ROW_FRAGMENTS = 4096;

/** A cell box never narrows below this, however wide a `w:tblCellSpacing` gap is stated. */
const MIN_CELL_BOX_PT = 1;

/**
 * Why a table could not be paginated as authored.
 *
 * Each is a bound: a row taller than a page, a row that cannot be split, or a row producing more
 * fragments than the limit allows.
 */
export type TablePaginationErrorCode =
  | 'table-row-overheight'
  | 'table-row-split-unsupported'
  | 'table-row-fragment-limit';

/**
 * Bounded table pagination failure. Prefer this over emitting a fragment that overflows
 * the page content box.
 */
export class TablePaginationError extends Error {
  readonly code: TablePaginationErrorCode;
  constructor(code: TablePaginationErrorCode, message: string) {
    super(message);
    this.name = 'TablePaginationError';
    this.code = code;
  }
}

/** Coupled text-box layout and cache invalidation for a hosted-story table flow lane. */
export interface HostedStoryFlowDeps {
  readonly layoutTextboxStoryFor: (
    projection: import('../store/package/drawing-projection.ts').DrawingProjection
  ) => import('./textbox-story-layout.ts').TextboxStoryLayout | null;
  readonly hostedListTokenForParagraph: ((paragraph: OoxmlNode) => string) | null;
}

export interface TableFlowDeps {
  readonly measurer: TextMeasurer;
  readonly cache?: ParagraphLayoutCache<readonly PendingLine[]> | undefined;
  readonly producer: string;
  /** Produces a stable id from the paragraph-local line identity. */
  readonly nextLineId: (
    paragraphId: string,
    start: number,
    lineIndex: number,
    occurrence?: string
  ) => string;
  /** Stable visual occurrence for repeated header rows on the current page. */
  readonly pageOccurrenceKey?: () => string;
  readonly styleCascade?: StyleCascadeTable;
  /** When set (header/footer page projection), PAGE/NUMPAGES resolve against this context. */
  readonly pageContext?: FieldPageContext;
  /** Derived footnote/endnote marks for noteReference / noteRef projection. */
  readonly noteMarks?: import('./note-projection.ts').NoteMarkContext;
  /**
   * Precomputed body-story list items (including cell paragraphs). Absent for header/footer
   * stories that do not share the body counter stream.
   */
  readonly listItems?: ReadonlyMap<string, ResolvedListItem>;
  /** Text-box story layout and its host break-key invalidation, structurally inseparable. */
  readonly hostedStory?: HostedStoryFlowDeps;
  /**
   * `w:settings/w:defaultTabStop` in points; absent keeps the 0.5" schema default. A cell
   * paragraph tabs on the same document-wide grid as a body paragraph.
   */
  readonly defaultTabStopPt?: number;
  /**
   * Turns a typed `w:hyperlink` into the sanitized record its spans carry. A link in a
   * table cell is an ordinary link; without this it would paint its text and be dead.
   */
  readonly projectLink?: HyperlinkProjector;
  /** Same seam for HYPERLINK fields: a field in a table cell is an ordinary field. */
  readonly projectFieldLink?: FieldLinkProjector;
  /** Document properties for document-property fields; the same object every flow shares. */
  readonly documentProperties?: import('@docx-editor.dev/core/store').DocumentProperties;
  /**
   * True when this table is in BODY flow, whose page fields are substituted at document finalize.
   * Propagates to every cell paragraph so a body-table PAGE field paints a placeholder; a table
   * in a header/footer keeps this false and its own live page path.
   */
  readonly bodyPageFields?: import('./field-page-furniture.ts').BodyPageFieldContext | false;
  /**
   * The story's resolved REF inputs — a REF field in a table cell is an ordinary field.
   * Present only in body flow, which folds the resolved values into every cell break key.
   */
  readonly refFields?: import('./field-ref.ts').RefFieldContext;
  readonly inlineDrawingLayout?: import('./drawing-layout.ts').InlineDrawingLayoutContext;
  /** Per-paragraph drawing projection/resource token for break cache keys. */
  readonly drawingTokenForParagraph?: (paragraph: OoxmlNode) => string;
  /** Per-paragraph semantic projection identity for cached cell lines. */
  readonly projectionTokenForParagraph?: (paragraph: OoxmlNode) => string;
  /** @deprecated Prefer {@link drawingTokenForParagraph}. */
  readonly drawingLayoutToken?: string;
  /**
   * Shared sparse ownership-interval budget for border finalize across nested tables in
   * one layout pass. Created once per flow; omit only in isolated unit tests.
   */
  readonly borderOwnershipBudget?: TableBorderOwnershipBudget;
  /**
   * Shared cell-visit budget for vMerge span resolve across nested tables in one layout
   * pass. Exhaustion fails soft (remaining restarts keep rowSpan 1).
   */
  readonly vMergeResolveBudget?: TableVMergeResolveBudget;
  /**
   * This layout is a MEASUREMENT, not a placement: nothing it produces is painted.
   *
   * A probe of one row lays out every nested table inside it, and planning merge heights in
   * those tables means probing THEIR rows, which lays out the tables below them again. That
   * multiplies rather than adds — a merge at each level of a nest a file controls ran three
   * times slower per level and took minutes at `MAX_TABLE_NESTING`. So a probe measures
   * nested tables unplanned, which is the height they had before this module existed.
   *
   * Erring tall is the safe direction: the caller reserves more room than the real
   * placement needs, which can move a row to a fresh page early but can never overflow the
   * page it was admitted onto.
   */
  readonly measuringOnly?: boolean;
  /**
   * Which tracked revisions this pass resolves away. A cell paragraph must resolve the same
   * mode as a body paragraph, or one table would show the proposed result while the text
   * around it showed the original.
   */
  readonly displayMode?: RevisionDisplayMode;
  readonly revisionAuthorFilter?: RevisionAuthorFilter;
  readonly anchorFrameBase?: () => Omit<
    DrawingAnchorFrameContext,
    'paragraphBox' | 'anchorLineBox' | 'anchorCharacterX' | 'columnBox' | 'cellBox' | 'layoutInCell'
  >;
  readonly pageContentClip?: () => import('./semantic-records.ts').LayoutBox;
  readonly collectAnchoredDrawings?: (drawings: readonly AnchoredDrawingRecord[]) => void;
  /** Root anchor sink — preserved when row defer strips {@link collectAnchoredDrawings}. */
  readonly publishAnchoredDrawings?: (drawings: readonly AnchoredDrawingRecord[]) => void;
  readonly columnBoxForParagraph?: (
    paragraphBox: import('./semantic-records.ts').LayoutBox
  ) => import('./semantic-records.ts').LayoutBox;
  readonly deferAnchoredDrawings?: (pending: {
    readonly paragraph: OoxmlNode;
    readonly paragraphId: string;
    readonly paragraphBox: LayoutBox;
    readonly lines: readonly LineRecord[];
    readonly cellOriginX: number;
    readonly cellContentWidth: number;
  }) => void;
  readonly onAnchorShift?: (paragraphId: string, dy: number) => void;
  readonly onAnchorRepublish?: (
    paragraphId: string,
    drawings: readonly AnchoredDrawingRecord[]
  ) => void;
  /** When true, row finalize forwards deferred anchors without publishing them. */
  readonly anchorDeferOnly?: boolean;
  /** Body-page wrap exclusion zones active while breaking cell paragraphs. */
  readonly pageExclusionZones?: () => readonly import('./drawing-exclusion.ts').ExclusionZone[];
  /** Document-order index for filtering wrap zones to earlier anchors only. */
  readonly paragraphOrderIndex?: (paragraphId: string) => number | undefined;
  /**
   * Reports every break-cache key a cell paragraph is cached under, so the host's
   * cache retention can name a table's cell entries without laying the table out.
   */
  readonly onCellBreakKey?: (key: string) => void;
}

/**
 * Per-cell progress through a row that may span pages. Indices are into the authored
 * cell.blocks list and the paragraph's broken lines — never DOM geometry.
 */
export interface CellPlaceCursor {
  readonly blockIndex: number;
  readonly lineIndex: number;
  readonly previousSpaceAfter: number;
  readonly paragraphFragmentIndex: number;
  /**
   * Did the block before `blockIndex` actually PUT a table on the page?
   *
   * Carried rather than re-derived, because the only thing left to re-derive it from is the
   * source node's kind — and a `w:tbl` past the nesting ceiling, or one with no `w:tr` at
   * all, is a table that emits nothing. Reading the kind on a continuation would let the
   * terminator collapse behind a table that never appeared on that page.
   */
  readonly precededByEmittedTable: boolean;
}

export function initialCellCursors(row: SemanticTableRow): CellPlaceCursor[] {
  return row.cells.map(() => ({
    blockIndex: 0,
    lineIndex: 0,
    previousSpaceAfter: 0,
    paragraphFragmentIndex: 0,
    precededByEmittedTable: false,
  }));
}

function sumCols(cols: readonly number[], from: number, to: number): number {
  let sum = 0;
  for (let index = from; index < to && index < cols.length; index += 1) sum += cols[index]!;
  return sum;
}

/**
 * Place one paragraph's broken lines sequentially from `top`, producing a single fragment.
 *
 * The pending spans carry x offsets relative to the PARAGRAPH origin (that is what makes
 * the break cacheable across positions); placement shifts them by `originX` and stamps y,
 * exactly as body placement stamps `cursorY`.
 *
 * When `lineStart`/`maxBottom` are set, only lines that fit below `maxBottom` are placed and
 * the remainder line index is returned so a later page can continue the same paragraph.
 */
function placeCellParagraph(
  paragraph: OoxmlElement,
  originX: number,
  cellContentWidth: number,
  top: number,
  deps: TableFlowDeps,
  previousSpaceAfter: number,
  options?: {
    readonly lineStart?: number;
    readonly fragmentIndex?: number;
    readonly maxBottom?: number;
    /** When false, omit trailing paragraph spacing (more content follows on a later page). */
    readonly includeAfter?: boolean;
    /** When false, omit the bottom border (paragraph continues). */
    readonly includeBottomBorder?: boolean;
    /**
     * The empty `w:p` a cell must end with when its content ends with a `w:tbl`: placed at
     * `top` so it stays addressable, but charged nothing — no spacing, no rules, no line
     * box. Word and LibreOffice both draw it that way.
     */
    readonly collapseHeight?: boolean;
    /**
     * How much flowed content sits above the collapse point inside this cell.
     *
     * The caret for a collapsed terminator is drawn upward from the collapse point, sized off
     * the line's published `baseline`. That ascent comes from the paragraph MARK's own
     * `w:rPr` and has nothing to do with the rows above it, so a 36 pt mark over a 6 pt
     * nested row — or any terminator in a cell shorter than its own ascent — drew a caret
     * that started above the page. Only the caller knows the band, so it passes it and the
     * published baseline is clamped into it.
     */
    readonly collapseBandAbove?: number;
    /** What the table style says about this cell's paragraphs (17.7.6.6). */
    readonly tableCellStyle?: TableCellStyleFormatting;
    /**
     * The blocks either side of this one, for the `w:between` group rule (§17.3.1.24).
     *
     * Passed as NODES rather than resolved keys: a paragraph with no borders of its own is in
     * no group, so it never asks either neighbour anything, and that is nearly every
     * paragraph in a document. Reading them from the block list rather than tracking a
     * running key also keeps the answer right when a row splits across a page and the
     * neighbour was placed on the previous one.
     */
    readonly borderNeighbours?: {
      readonly previous: OoxmlElement | undefined;
      readonly next: OoxmlElement | undefined;
    };
  }
): {
  readonly fragment: ParagraphFragmentRecord | null;
  readonly bottom: number;
  readonly spaceAfter: number;
  readonly nextLineIndex: number;
  readonly complete: boolean;
  readonly fitted: boolean;
} {
  const paragraphId = paragraph.id;
  const keyFor = deps.cache?.keyFor?.bind(deps.cache) ?? paragraphLayoutKey;
  const listItem = deps.listItems?.get(paragraphId);
  const layoutInputs = resolveParagraphLayoutInputs(
    paragraph,
    cellContentWidth,
    deps.styleCascade,
    listItem,
    options?.tableCellStyle,
    true
  );
  const {
    props,
    indent,
    available,
    alignment,
    styleId,
    outlineLevel,
    spacing,
    lineSpacing,
    bottomBorder,
    borders,
    shading,
    inheritedRunProperties,
    markRunProperties,
    tabStops: cascadedTabStops,
    tabStopsCacheToken: cascadedTabStopsCacheToken,
  } = layoutInputs;
  // `w:between` (§17.3.1.24): consecutive paragraphs with IDENTICAL border settings are ONE
  // bordered block — the box opens above the first and closes below the last, and each
  // interior boundary carries `w:between` or nothing. This is the cell twin of the body
  // flow's rule, so one document cannot draw the same callout two ways depending on whether
  // it sits in a `w:tc`.
  const borderGroupContext: CellBorderGroupContext = {
    styleCascade: deps.styleCascade,
    tableCellStyle: options?.tableCellStyle,
    listItems: deps.listItems,
  };
  const borderGroupKey = paragraphBorderGroupKey(layoutInputs);
  rememberCellBorderGroupKey(paragraph, borderGroupContext, borderGroupKey);
  const inSameBorderGroup = (block: OoxmlElement | undefined): boolean =>
    borderGroupKey !== '' && neighbourBorderGroupKey(block, borderGroupContext) === borderGroupKey;
  const continuesAbove = inSameBorderGroup(options?.borderNeighbours?.previous);
  const continuesBelow = inSameBorderGroup(options?.borderNeighbours?.next);
  const topEdge = continuesAbove ? undefined : borders.top;
  // What closes the paragraph: the bottom rule, or the `between` rule when the block runs on.
  const closingEdge = continuesBelow ? borders.between : bottomBorder;
  // `w:defaultTabStop` lives in settings.xml, which the paragraph cascade never reads.
  const tabStops = withDefaultTabInterval(cascadedTabStops, deps.defaultTabStopPt);
  const tabStopsCacheToken =
    tabStops === cascadedTabStops ? cascadedTabStopsCacheToken : tabStopsFingerprint(tabStops);
  // A cell paragraph breaks like a body paragraph: same line spacing, same first-line
  // offset. Contextual spacing is a body-flow question (it compares document neighbours),
  // so it is not applied per cell.
  // A NUMBERED/BULLETED paragraph's first-line slot belongs to the MARKER: `listMarkerBox`
  // places it at `left - hanging` (or at `left + firstLine` for a positive-firstLine
  // level), and Word's `w:suff` puts the text back at `left` — or after the marker, or at
  // the next tab stop past an overflowing one (§17.9.30).
  const firstLineOffset = firstLineShift(listItem, indent, deps.measurer, tabStops, available);
  const rawZones = deps.pageExclusionZones?.() ?? Object.freeze([]);
  const paragraphOrder = deps.paragraphOrderIndex?.(paragraphId) ?? Number.MAX_SAFE_INTEGER;
  const filtered = deps.paragraphOrderIndex
    ? filterExclusionZonesForParagraphOrder(rawZones, paragraphOrder, (id) =>
        deps.paragraphOrderIndex?.(id)
      )
    : rawZones;
  const pageZones = localizeExclusionZones(filtered, originX, 0, {
    left: 0,
    right: indent.left + available + indent.right,
  });
  // Zone geometry alone does NOT identify the break: these zones stay in page-content Y
  // (only x is localized to the cell), so which band a line crosses depends on where the
  // paragraph starts. Two cells of the same text and width under the same float would
  // otherwise share a cache entry and the one that sits clear of the picture would inherit
  // the wrapped break of the one that does not.
  const exclusionToken = exclusionLayoutToken(pageZones);
  const positionedExclusionToken = exclusionToken ? `${top.toFixed(3)}|${exclusionToken}` : '';
  // The cell paragraph's resolved REF values, keyed exactly as the body flow keys them: a
  // renumbering edit moves the painted reference while the cell's subtree stays identical.
  const refToken = deps.refFields?.tokenForParagraph(paragraphId) ?? '';
  // The list state of any hosted text-box story, keyed as the body flow keys it: its own
  // `txbxList` property. A numbering edit moves only this property while the host's
  // subtree stays byte-identical; box-free paragraphs keep their pre-existing key shape.
  const hostedListToken = deps.hostedStory?.hostedListTokenForParagraph?.(paragraph) ?? '';
  const key = keyFor({
    paragraph,
    properties: [
      ...props,
      ...inheritedRunProperties,
      ...markRunProperties,
      { localName: 'tabStops', attributes: { token: tabStopsCacheToken } },
      ...(listItem ? [{ localName: 'list', attributes: { token: listItem.cacheToken } }] : []),
      ...(hostedListToken
        ? [{ localName: 'txbxList', attributes: { token: hostedListToken } }]
        : []),
      ...(refToken ? [{ localName: 'refFields', attributes: { token: refToken } }] : []),
    ],
    width: available,
    producer: deps.producer,
    // The inline-drawing CONTEXT joins the token exactly as it does in the body flow: the
    // context changes how a paragraph breaks (drawings become measured atoms), so a
    // token-less pass with the context may not share cell entries with one without it.
    // `||`, not `??`: a per-paragraph callback answering `''` falls through to the
    // document-wide token, as it always has.
    drawingToken: withDrawingContext(
      deps.drawingTokenForParagraph?.(paragraph) || deps.drawingLayoutToken || '',
      deps.inlineDrawingLayout !== undefined
    ),
    projectionToken: deps.projectionTokenForParagraph?.(paragraph) ?? '',
    ...(positionedExclusionToken ? { exclusionToken: positionedExclusionToken } : {}),
  });
  if (deps.cache) deps.onCellBreakKey?.(key);
  const lines = breakParagraph(
    paragraph,
    paragraphId,
    indent.left,
    available,
    deps.measurer,
    deps.cache,
    deps.cache ? key : null,
    inheritedRunProperties,
    tabStops,
    deps.pageContext,
    deps.styleCascade
      ? (inherited, direct) => cascadeRunProperties(inherited, direct, deps.styleCascade)
      : undefined,
    {
      lineSpacing,
      equationCacheToken: deps.producer,
      firstLineOffset,
      // A cell's own content box is the column a positional tab measures against.
      marginExtent: { left: 0, right: indent.left + available + indent.right },
      ...(deps.projectLink ? { projectLink: deps.projectLink } : {}),
      ...(deps.projectFieldLink ? { projectFieldLink: deps.projectFieldLink } : {}),
      ...(deps.documentProperties ? { documentProperties: deps.documentProperties } : {}),
      ...(deps.bodyPageFields ? { bodyPageFields: deps.bodyPageFields } : {}),
      ...(deps.refFields ? { refFields: deps.refFields } : {}),
      displayMode: deps.displayMode,
      ...(deps.revisionAuthorFilter ? { revisionAuthorFilter: deps.revisionAuthorFilter } : {}),
      ...(deps.noteMarks ? { noteMarks: deps.noteMarks } : {}),
      ...(deps.inlineDrawingLayout ? { inlineDrawingLayout: deps.inlineDrawingLayout } : {}),
      contentLeft: 0,
      contentRight: indent.left + available + indent.right,
      paragraphStartY: top,
      anchorCellBox: Object.freeze({
        x: 0,
        y: 0,
        width: indent.left + available + indent.right,
        height: Math.max(1, available),
      }),
      ...(pageZones.length > 0 ? { pageExclusionZones: pageZones } : {}),
      ...(deps.styleCascade ? { themeFonts: deps.styleCascade.themeFonts } : {}),
      markRunProperties,
    }
  );

  const lineStart = options?.lineStart ?? 0;
  const fragmentIndex = options?.fragmentIndex ?? 0;
  const maxBottom = options?.maxBottom ?? Number.POSITIVE_INFINITY;
  const includeAfter = options?.includeAfter ?? true;
  const includeBottomBorder = options?.includeBottomBorder ?? true;
  // ONE question, asked once, so the next kind of furniture is caught by construction rather
  // than arriving as the third late special case. The caller settles POSITION — last block of
  // a cell, behind a table that actually emitted, structurally empty. What decides whether
  // the collapse is SAFE is resolved here, and the line runs between two kinds of thing:
  //
  //   sized OFF the line box   borders, shading — a zero box paints a zero band, which is
  //                            what "occupies no space" should look like. These collapse.
  //   own intrinsic size       a list marker glyph, and the pilcrow and change bar a tracked
  //                            `w:ins`/`w:del` on the paragraph MARK publishes. A zero box
  //                            does not hide these, it MISPLACES them — paint centres the
  //                            marker half a line above its row and drops the change bar
  //                            entirely. These block the collapse.
  //
  // The mark revisions are read only in All Markup — that is the only view where the pilcrow
  // and the change bar exist. In the resolved or original view a terminator whose mark is
  // tracked-INSERTED publishes neither, so blocking there would keep a line Word's accept-all
  // output does not have. (A tracked DELETE is a different case and never reaches here: the
  // resolved view merges that paragraph away upstream.)
  // Called behind the position gate: every paragraph is scanned on every placement pass,
  // including trial rows and continuations; `||` cannot skip the `w:pPr`/`w:rPr` scan because
  // `listItem` is undefined for the non-list paragraphs that are the overwhelming majority.
  // The same pair of calls further down is gated on `showsMarkup` for exactly this reason.
  const publishesPlacedGlyphs = (): boolean =>
    listItem !== undefined ||
    (deps.displayMode === 'all-markup' &&
      paragraphMarkMarkupVisible(paragraph, 'all-markup', deps.revisionAuthorFilter));
  const collapseHeight = (options?.collapseHeight ?? false) && !publishesPlacedGlyphs();

  const appliedBefore =
    lineStart === 0 && !collapseHeight
      ? collapsedSpaceBefore(spacing.before, previousSpaceAfter)
      : 0;
  const fragmentX = originX + indent.left;
  // The top rule and its gap are flow height above the first line, exactly as the bottom rule
  // is flow height below the last — so the cell's content band has to reserve it or a boxed
  // paragraph's frame paints over the cell's own top border. Reserved on the FIRST fragment
  // only: a paragraph continued onto the next page opens once, the way it closes once.
  const topExtent = lineStart === 0 && !collapseHeight ? paragraphBorderExtentPt(topEdge) : 0;
  const rawRecords: LineRecord[] = [];
  let y = top + appliedBefore + topExtent;
  let nextLineIndex = lineStart;
  let fitted = false;

  for (let lineIndex = lineStart; lineIndex < lines.length; lineIndex += 1) {
    const pendingLine = lines[lineIndex]!;
    const isLastLine = lineIndex === lines.length - 1;
    const borderExtra =
      isLastLine && includeBottomBorder && closingEdge && !collapseHeight
        ? paragraphBorderExtentPt(closingEdge)
        : 0;
    const afterExtra = isLastLine && includeAfter && !collapseHeight ? spacing.after : 0;
    const skipBefore = collapseHeight
      ? 0
      : Math.max(
          pageZones.length > 0 ? topAndBottomSkipBeforeLine(y, pendingLine.height, pageZones) : 0,
          pendingLine.exclusionSkipBefore ?? 0
        );
    const lineBottom = collapseHeight
      ? y
      : y + skipBefore + pendingLine.height + borderExtra + afterExtra;
    if (lineBottom > maxBottom + 0.001) {
      break;
    }
    y += skipBefore;
    const lineIndent = originX + indent.left + (lineIndex === 0 ? firstLineOffset : 0);
    const lineAvailableWidth = Math.max(1, available - (lineIndex === 0 ? firstLineOffset : 0));
    const placedSpans = pendingLine.spans.map((span) => ({
      ...span,
      range: { ...span.range, paragraphId },
      box: { ...span.box, x: span.box.x + originX, y },
    }));
    const alignedSpans = alignSpans(
      placedSpans,
      deps.measurer,
      lineIndent,
      lineAvailableWidth,
      alignment,
      isLastLine,
      alignment === 'center' || alignment === 'right' ? pendingLine.width : undefined
    );
    // Empty lines align too — see the body-flow twin in `semantic-layout.ts`.
    const alignOffset =
      placedSpans.length > 0 && alignedSpans.length > 0
        ? alignedSpans[0]!.box.x - placedSpans[0]!.box.x
        : alignment !== 'left' && alignment !== 'both'
          ? (() => {
              const slack = lineAvailableWidth - pendingLine.width;
              if (slack <= 0) return 0;
              return alignment === 'center' ? slack / 2 : slack;
            })()
          : 0;
    const cellClip = Object.freeze({
      x: originX,
      y: top,
      width: cellContentWidth,
      height: Math.max(0, maxBottom - top),
    });
    const alignedDrawings = alignDrawings(
      pendingLine.drawings.map((drawing) =>
        clipInlineDrawingRecordToRegion(
          Object.freeze({
            ...shiftInlineDrawingRecord(drawing, originX, y),
            paragraphId,
          }),
          cellClip
        )
      ),
      alignOffset
    );
    rawRecords.push({
      id: deps.nextLineId(paragraphId, pendingLine.start, lineIndex),
      range: { paragraphId, start: pendingLine.start, end: pendingLine.end },
      spans: alignedSpans,
      ...(alignedDrawings.length > 0 ? { drawings: alignedDrawings } : {}),
      box: {
        x: originX + indent.left,
        y,
        width: available,
        // ZERO-height, not just zero flow: selection bands, `paragraphShadingBox` and
        // `caretBoxOnLine` all read this box, so a line that keeps its height while the cell
        // stops at `y` paints caret and highlight below the row. It costs the terminator its
        // caret until something is typed into it, which un-collapses it.
        height: collapseHeight ? 0 : pendingLine.height,
      },
      contentX: alignedSpans[0]?.box.x ?? lineIndent + alignOffset,
      baseline: collapseHeight
        ? Math.max(0, Math.min(pendingLine.baseline, options?.collapseBandAbove ?? 0))
        : pendingLine.baseline,
      leading: collapseHeight ? 0 : pendingLine.leading,
      trailingSpacing: collapseHeight ? 0 : pendingLine.trailingSpacing,
      ...(pendingLine.deletedRanges ? { deletedRanges: pendingLine.deletedRanges } : {}),
      ...(pendingLine.anchorRevisions ? { anchorRevisions: pendingLine.anchorRevisions } : {}),
    });
    if (!collapseHeight) y += pendingLine.height;
    nextLineIndex = lineIndex + 1;
    fitted = true;
  }

  if (!fitted) {
    return {
      fragment: null,
      bottom: top,
      spaceAfter: previousSpaceAfter,
      nextLineIndex: lineStart,
      complete: false,
      fitted: false,
    };
  }

  const complete = nextLineIndex >= lines.length;
  const linesTop = rawRecords[0]!.box.y;
  const linesBottom = y;
  // Every `w:pBdr` edge, in the paint order body flow publishes: open, close, sides, bar.
  // `topEdge` and `closingEdge` already carry the `w:between` group decision.
  const strokes: ParagraphBorderStrokeRecord[] = [];
  let bottomBorderRecord: ParagraphBottomBorderRecord | undefined;
  let contentTop = linesTop;
  let contentBottom = linesBottom;
  // THE FOUR EDGES ARE ONE BOX — the same rule the body flow follows, and it has to be the
  // same here or one document paints the identical callout two ways depending on whether it
  // sits in a table cell or a header. The side rules stand outside the text column by their
  // own `w:space`, so horizontals drawn only across the column leave the frame open.
  // Stroke thickness uses the inflated compound band for `double`/etc. (shared with body).
  const leftStroke = borders.left ? paragraphBorderStrokeWidthPt(borders.left) : 0;
  const rightStroke = borders.right ? paragraphBorderStrokeWidthPt(borders.right) : 0;
  const boxLeft = borders.left ? fragmentX - borders.left.spacePt - leftStroke : fragmentX;
  const boxRight = borders.right
    ? fragmentX + available + borders.right.spacePt + rightStroke
    : fragmentX + available;
  const boxWidth = Math.max(boxRight - boxLeft, 0);
  if (topExtent > 0 && topEdge) {
    const topStroke = paragraphBorderStrokeWidthPt(topEdge);
    const ruleY = linesTop - topEdge.spacePt - topStroke;
    strokes.push({
      side: 'top',
      edge: topEdge,
      box: { x: boxLeft, y: ruleY, width: boxWidth, height: topStroke },
    });
    contentTop = ruleY;
  }
  // Gated on `collapseHeight` exactly as the fit test is: charging the rule here after the
  // fit test charged nothing grows `contentBottom` past the row, and past `maxBottom` on a
  // page's last row. `topExtent` drops the top rule for the same reason, and the two edges
  // have to agree or a boxed terminator paints half its frame.
  if (complete && includeBottomBorder && closingEdge && !collapseHeight) {
    const closeStroke = paragraphBorderStrokeWidthPt(closingEdge);
    const ruleY = linesBottom + closingEdge.spacePt;
    const box = {
      x: boxLeft,
      y: ruleY,
      width: boxWidth,
      height: closeStroke,
    };
    // `bottomBorder` stays the BOTTOM rule alone: a `between` rule closing a grouped
    // paragraph is a different edge, and a consumer reading it as the box's bottom would
    // draw the block's frame at every interior boundary.
    if (!continuesBelow) bottomBorderRecord = { edge: closingEdge, box };
    strokes.push({ side: continuesBelow ? 'between' : 'bottom', edge: closingEdge, box });
    contentBottom = ruleY + closeStroke;
  }
  const appliedAfter = complete && includeAfter && !collapseHeight ? spacing.after : 0;
  // Side rules run corner to corner of THIS fragment's frame. Horizontally they are
  // publish-only: Word draws them outside the text column and never re-breaks the lines for
  // them, which is why `available` above is untouched by a box.
  //
  // Inside a `w:between` group they run THROUGH the inter-paragraph gap instead, so the box
  // reads as one outline rather than a ladder — the body flow's rule, in the cell lane.
  const sideTop = continuesAbove && lineStart === 0 ? top : contentTop;
  const sideBottom = continuesBelow && complete ? contentBottom + appliedAfter : contentBottom;
  const sideHeight = Math.max(sideBottom - sideTop, 0);
  if (borders.left) {
    strokes.push({
      side: 'left',
      edge: borders.left,
      box: {
        x: fragmentX - borders.left.spacePt - leftStroke,
        y: sideTop,
        width: leftStroke,
        height: sideHeight,
      },
    });
  }
  if (borders.right) {
    strokes.push({
      side: 'right',
      edge: borders.right,
      box: {
        x: fragmentX + available + borders.right.spacePt,
        y: sideTop,
        width: rightStroke,
        height: sideHeight,
      },
    });
  }
  // `w:bar` is the change-bar rule beside the paragraph, not part of the frame — it runs the
  // text only and adds no flow height, so a barred cell paragraph is exactly as tall as a
  // bare one.
  if (borders.bar) {
    const barStroke = paragraphBorderStrokeWidthPt(borders.bar);
    strokes.push({
      side: 'bar',
      edge: borders.bar,
      box: {
        x: fragmentX - borders.bar.spacePt - barStroke,
        y: linesTop,
        width: barStroke,
        height: Math.max(linesBottom - linesTop, 0),
      },
    });
  }
  const bottom = contentBottom + appliedAfter;
  // Shading fills the FRAME when there is one (a side rule is what makes it a box), and the
  // line area otherwise — the body flow's rule, stated once more for the cell lane.
  const shadingBox =
    shading === undefined
      ? undefined
      : borders.left || borders.right
        ? {
            x: boxLeft,
            y: contentTop,
            width: boxWidth,
            height: Math.max(contentBottom - contentTop, 0),
          }
        : paragraphShadingBox(rawRecords, fragmentX, available);
  // The paragraph MARK, on the fragment that finishes the paragraph — the cell lane publishes
  // it for the same reason the body lane does, and until it did, a tracked split or merge
  // inside a `w:tc` drew nothing at all: no pilcrow, no margin rule, no review card.
  //
  // Read only when this fragment will carry it. Placement runs for trial rows and for every
  // continuation, and the projection walks `w:pPr/w:rPr` each time it is asked.
  // EXPLICIT, not defaulted. A lane that does not say which view it is drawing does not get
  // attribution: note stories pass no mode and mean the resolved one, so defaulting to
  // `all-markup` here lit up markup inside footnotes in the very view that must show none.
  // The lanes that do mean All Markup say so — the body always has, and furniture does now.
  const showsMarkup = complete && deps.displayMode === 'all-markup';
  const markProjection = showsMarkup
    ? visibleParagraphMarkRevisionsOf(paragraph, 'all-markup', deps.revisionAuthorFilter)
    : null;
  const markRevisions = markProjection?.revisions ?? [];
  const markFormatRevision = markProjection?.formatRevision ?? null;
  const marker =
    lineStart === 0
      ? publishListMarker(
          listItem,
          deps.measurer,
          rawRecords[0] ? { y: rawRecords[0].box.y, height: rawRecords[0].box.height } : undefined,
          originX
        )
      : undefined;

  // A cell is a story, so a resolved view merges inside it too — and the identity of the
  // merged half has to come back the same way it does in the body flow.
  const mergeGroup = paragraphMergeGroupOf(paragraph);
  const records = mergeGroup
    ? remapMergedLines(rawRecords, mergeBoundariesOf(mergeGroup))
    : rawRecords;
  const fragment = {
    kind: 'paragraph' as const,
    id: `${paragraphId}#f${fragmentIndex}`,
    paragraphId,
    fragmentIndex,
    range: {
      paragraphId,
      start: records[0]!.range.start,
      end: records[records.length - 1]!.range.end,
    },
    props,
    styleId,
    outlineLevel,
    alignment,
    spacing: { before: appliedBefore, after: appliedAfter },
    indent,
    tabStops,
    ...(bottomBorderRecord ? { bottomBorder: bottomBorderRecord } : {}),
    ...(strokes.length > 0 ? { borders: strokes } : {}),
    ...(shading === undefined ? {} : { shading }),
    ...(shadingBox === undefined ? {} : { shadingBox }),
    ...(marker ? { marker } : {}),
    ...markRevisionFields(markRevisions, markFormatRevision),
    lines: records,
    box: {
      x: fragmentX,
      y: top,
      width: available,
      height: bottom - top,
    },
  };

  if (deps.inlineDrawingLayout && deps.anchorFrameBase && deps.pageContentClip) {
    const cellBox = Object.freeze({
      x: originX,
      y: top,
      width: cellContentWidth,
      height: Math.max(0, maxBottom - top),
    });
    const paragraphBox = fragment.box;
    const publication = {
      paragraph,
      paragraphId,
      paragraphBox,
      lines: records,
    };
    if (deps.deferAnchoredDrawings) {
      deps.deferAnchoredDrawings({
        ...publication,
        cellOriginX: originX,
        cellContentWidth,
      });
    } else if (deps.collectAnchoredDrawings) {
      deps.collectAnchoredDrawings(
        publishAnchoredDrawingsForParagraph({
          paragraph,
          paragraphId,
          paragraphBox,
          lines: records,
          drawingLayout: deps.inlineDrawingLayout,
          frameBase: deps.anchorFrameBase(),
          columnBox: deps.columnBoxForParagraph?.(paragraphBox) ?? paragraphBox,
          cellBox,
          pageClip: deps.pageContentClip(),
          measurer: deps.measurer,
          ...(deps.hostedStory
            ? { layoutTextboxStory: deps.hostedStory.layoutTextboxStoryFor }
            : {}),
          ...(deps.displayMode ? { displayMode: deps.displayMode } : {}),
          ...(deps.revisionAuthorFilter ? { revisionAuthorFilter: deps.revisionAuthorFilter } : {}),
        })
      );
    }
  }

  return {
    fragment,
    bottom,
    spaceAfter: appliedAfter,
    nextLineIndex,
    complete,
    fitted: true,
  };
}

/**
 * Flow blocks within [left, right] from `top`; returns the fragments and the bottom y.
 * No pagination — blocks stack. Used for table cells and for header/footer stories,
 * which is exactly what makes a header break like a cell: same breaker, same records.
 */
export function flowBlocksInBox(
  blocks: readonly OoxmlElement[],
  left: number,
  right: number,
  top: number,
  depth: number,
  deps: TableFlowDeps
): { readonly blocks: BlockFragmentRecord[]; readonly bottom: number } {
  const bounded = flowBlocksInBoxBounded(
    blocks,
    left,
    right,
    top,
    Number.POSITIVE_INFINITY,
    depth,
    deps,
    {
      blockIndex: 0,
      lineIndex: 0,
      previousSpaceAfter: 0,
      paragraphFragmentIndex: 0,
      precededByEmittedTable: false,
    }
  );
  return { blocks: bounded.blocks, bottom: bounded.bottom };
}

function flowBlocksInBoxBounded(
  blocks: readonly OoxmlElement[],
  left: number,
  right: number,
  top: number,
  maxBottom: number,
  depth: number,
  deps: TableFlowDeps,
  cursor: CellPlaceCursor,
  tableCellStyle?: TableCellStyleFormatting,
  /** True for a `w:tc`: its last block may be the empty terminator a nested table forces. */
  inTableCell = false
): {
  readonly blocks: BlockFragmentRecord[];
  readonly bottom: number;
  readonly cursor: CellPlaceCursor;
  readonly complete: boolean;
  readonly fitted: boolean;
  readonly nestedSplitBlocked: boolean;
} {
  const fragments: BlockFragmentRecord[] = [];
  let y = top;
  let previousSpaceAfter = cursor.previousSpaceAfter;
  let blockIndex = cursor.blockIndex;
  let lineIndex = cursor.lineIndex;
  let paragraphFragmentIndex = cursor.paragraphFragmentIndex;
  let fitted = false;
  let nestedSplitBlocked = false;
  // Carried across page cuts by the cursor; never re-derived from the source node's kind.
  let lastEmittedTable = cursor.precededByEmittedTable;

  while (blockIndex < blocks.length) {
    const block = blocks[blockIndex]!;
    if (block.kind === 'table') {
      if (lineIndex !== 0) {
        // Should not happen — tables are whole blocks.
        lineIndex = 0;
      }
      previousSpaceAfter = 0;
      // Nested tables are atomic across row splits: place wholly or stop before them.
      const nested = emitNestedTable(block, left, right, y, depth + 1, deps);
      if (!nested) {
        lastEmittedTable = false;
        blockIndex += 1;
        continue;
      }
      if (nested.bottom > maxBottom + 0.001) {
        // Stop before the nested table. If nothing fitted yet on a fresh band, the caller
        // treats this as an unsplittable overheight once page moves are exhausted.
        nestedSplitBlocked = !fitted;
        break;
      }
      fragments.push(nested.fragment);
      y = nested.bottom;
      fitted = true;
      lastEmittedTable = true;
      blockIndex += 1;
      lineIndex = 0;
      continue;
    }
    if (block.kind !== 'paragraph') {
      lastEmittedTable = false;
      blockIndex += 1;
      lineIndex = 0;
      continue;
    }

    // POSITION only. Whether this paragraph may actually collapse is one question about what
    // it would publish, and `placeCellParagraph` is where every answer to it already lives —
    // see `publishesPlacedGlyphs` there. Deciding it in two places is how the list marker and
    // the tracked paragraph mark each arrived as their own late special case.
    //
    // `lastEmittedTable` rather than the source node's kind: `emitNestedTable` returns null
    // for a `w:tbl` past the nesting ceiling and for one with no `w:tr` at all (schema-valid,
    // `EG_ContentRowContent` is minOccurs=0), and the walk simply steps over it. Collapsing
    // behind a table that produced nothing leaves the row with no content and no terminator,
    // which paints as a hairline.
    const collapsible =
      inTableCell &&
      blockIndex === blocks.length - 1 &&
      lastEmittedTable &&
      isEmptyCellTerminator(block);
    const placed = placeCellParagraph(
      block,
      left,
      Math.max(1, right - left),
      y,
      deps,
      previousSpaceAfter,
      {
        lineStart: lineIndex,
        fragmentIndex: paragraphFragmentIndex,
        maxBottom,
        includeAfter: true,
        includeBottomBorder: true,
        collapseHeight: collapsible,
        collapseBandAbove: y - top,
        ...(tableCellStyle ? { tableCellStyle } : {}),
        borderNeighbours: {
          previous: blockIndex > 0 ? blocks[blockIndex - 1] : undefined,
          next: blocks[blockIndex + 1],
        },
      }
    );
    if (!placed.fitted || !placed.fragment) {
      break;
    }
    fragments.push(placed.fragment);
    y = placed.bottom;
    fitted = true;
    if (placed.complete) {
      previousSpaceAfter = placed.spaceAfter;
      lastEmittedTable = false;
      blockIndex += 1;
      lineIndex = 0;
      paragraphFragmentIndex = 0;
    } else {
      // Paragraph continues on the next page.
      return {
        blocks: fragments,
        bottom: y,
        cursor: {
          blockIndex,
          lineIndex: placed.nextLineIndex,
          previousSpaceAfter: 0,
          paragraphFragmentIndex: paragraphFragmentIndex + 1,
          precededByEmittedTable: lastEmittedTable,
        },
        complete: false,
        fitted: true,
        nestedSplitBlocked: false,
      };
    }
  }

  return {
    blocks: fragments,
    bottom: y,
    cursor: {
      blockIndex,
      lineIndex,
      previousSpaceAfter,
      paragraphFragmentIndex,
      precededByEmittedTable: lastEmittedTable,
    },
    complete: blockIndex >= blocks.length,
    fitted,
    nestedSplitBlocked,
  };
}

/**
 * Lay out one row at `rowTop`: flow every cell, size the row to its tallest cell, emit
 * every cell box at that height. `left` is the table's left edge (page-content-relative),
 * threaded through directly so nested content never needs shifting after the fact.
 * Returns the record and the row's bottom y.
 */
export function layoutRowFragment(
  row: SemanticTableRow,
  cols: readonly number[],
  left: number,
  rowTop: number,
  isHeaderRepeat: boolean,
  depth: number,
  deps: TableFlowDeps,
  cellSpacingPt = 0,
  vMerge?: RowVMergeLayoutOptions,
  pageBottomPt = Number.POSITIVE_INFINITY
): LayoutRowBoundedResult {
  // The row itself is unbounded — callers here place it and then compare `bottom` against
  // the page, which is how an overheight row fails closed. A DETACHED head is the one cell
  // that comparison cannot see, because it is kept out of the row's height on purpose, so
  // the page reaches it through `pageBottomPt` instead. A caller with no page (the probe,
  // a nested table) leaves it infinite and nothing changes.
  return layoutRowFragmentBounded(
    row,
    cols,
    left,
    rowTop,
    Number.POSITIVE_INFINITY,
    isHeaderRepeat,
    false,
    depth,
    deps,
    initialCellCursors(row),
    cellSpacingPt,
    vMerge,
    pageBottomPt
  );
}

export interface LayoutRowBoundedResult {
  readonly record: TableRowFragmentRecord;
  readonly bottom: number;
  /** Remaining cell cursors when the row did not finish; null when complete. */
  readonly remainder: CellPlaceCursor[] | null;
  /** True when at least one cell placed a line or nested block in this fragment. */
  readonly fitted: boolean;
  /**
   * True when a nested table blocked a safe split (would need to cut through nested
   * geometry). Callers must fail closed rather than overflow.
   */
  readonly nestedSplitBlocked: boolean;
}

/**
 * Height-budgeted row layout for pagination. Content stays at or above `rowTop` and at or
 * below `maxBottom`. Cells that cannot place anything leave empty boxes; callers decide
 * whether to move the row, continue splitting, or fail closed.
 *
 * `w:trHeight` (17.4.81):
 * - `auto` — content-sized (no invented floor);
 * - `atLeast` — floor the finished fragment to the authored minimum when it fits the
 *   budget; mid-row page splits stay content-driven so the floor cannot overflow the page;
 * - `exact` — fixed height, content clipped (Word 17.18.37). Overflow is not continued.
 *
 * `vMerge` is what a vertical merge does here (17.4.85): a head covering later rows paints
 * from this row bounded by its span, DETACHED from the row's own height.
 */
export function layoutRowFragmentBounded(
  row: SemanticTableRow,
  cols: readonly number[],
  left: number,
  rowTop: number,
  maxBottom: number,
  isHeaderRepeat: boolean,
  isContinuation: boolean,
  depth: number,
  deps: TableFlowDeps,
  cursors: readonly CellPlaceCursor[],
  cellSpacingPt = 0,
  vMerge?: RowVMergeLayoutOptions,
  detachedBottomPt = maxBottom
): LayoutRowBoundedResult {
  const detachedSpans = vMerge?.detachedSpanHeightPtByCellId;
  const total = sumCols(cols, 0, cols.length);
  // `w:tblCellSpacing`: each cell gives up half of every gap it shares with a neighbour.
  // `w:tblCellSpacing` (17.4.45) separates ADJACENT cell edges, so each of the two cells
  // sharing a gap gives up half of it. Applied inside the grid slot rather than by widening
  // the table, which keeps every column boundary, border interval and hit box where the
  // resolved grid put it.
  const gap = Number.isFinite(cellSpacingPt) && cellSpacingPt > 0 ? cellSpacingPt / 2 : 0;
  const defaultLineHeight = deps.measurer.lineMetrics(DEFAULT_RUN_STYLE).height;
  const heightRule = row.height;
  const exactHeightPt = heightRule.rule === 'exact' ? heightRule.valuePt : undefined;
  const atLeastHeightPt = heightRule.rule === 'atLeast' ? heightRule.valuePt : undefined;
  const deferredRowAnchors: DeferredRowAnchor[] = [];
  const { rowDeps, flushDeferred } = rowDepsForAnchors(deps, deferredRowAnchors);
  const flowDeps: TableFlowDeps =
    isHeaderRepeat && deps.pageOccurrenceKey
      ? {
          ...rowDeps,
          nextLineId: (paragraphId, start, lineIndex) =>
            rowDeps.nextLineId(paragraphId, start, lineIndex, deps.pageOccurrenceKey!()),
        }
      : rowDeps;
  // Exact rows clip to their authored box; never flow past it even when the page allows more.
  const flowMaxBottom =
    exactHeightPt === undefined
      ? maxBottom
      : Math.min(maxBottom, rowTop + Math.max(0, exactHeightPt));

  interface FlowedCell {
    readonly cell: SemanticTableCell;
    readonly x: number;
    readonly width: number;
    readonly gridColumn: number;
    readonly blocks: readonly BlockFragmentRecord[];
    readonly contentTop: number;
    readonly contentBottom: number;
    readonly physicalBottom: number;
    readonly insets: { top: number; right: number; bottom: number; left: number };
    readonly nextCursor: CellPlaceCursor;
    readonly complete: boolean;
    readonly fitted: boolean;
    readonly nestedSplitBlocked: boolean;
  }
  const flowed: FlowedCell[] = [];
  let anyFitted = false;
  let anyNestedBlocked = false;
  // Grow from the row top. Empty / vMerge-continue cells contribute one default line plus
  // THEIR authored insets below; fitted cells contribute measured content only. Seeding with
  // `defaultLineHeight + 2 * pad` used to force ~20pt rows even when tcMar was tighter
  // and the cell's own line was shorter — nested tables picked that up as blank bottom pad.
  let rowBottom = rowTop;

  for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex += 1) {
    const cell = row.cells[cellIndex]!;
    // Keep this typed: otherwise TypeScript can hide a missing cursor member.
    // a `boolean`, and the collapse would silently never fire for that cell.
    const cursor: CellPlaceCursor = cursors[cellIndex] ?? {
      blockIndex: 0,
      lineIndex: 0,
      previousSpaceAfter: 0,
      paragraphFragmentIndex: 0,
      precededByEmittedTable: false,
    };
    // The grid column is decided once, at read time, where `w:gridBefore` is known and the
    // row's TOTAL span is bounded (a row of maximum-span cells would otherwise walk millions
    // of grid intervals in the border pass). Never re-derived by accumulating spans here.
    const span = cell.gridSpan;
    const gridColumn = cell.gridColumn;
    const slotX = left + sumCols(cols, 0, gridColumn);
    const slotW = sumCols(cols, gridColumn, Math.min(gridColumn + span, cols.length)) || total;
    // Never let the gap consume the cell: a spacing wider than the column keeps a hairline.
    const inset = Math.min(gap, Math.max((slotW - MIN_CELL_BOX_PT) / 2, 0));
    const cellX = slotX + inset;
    const cellW = Math.max(slotW - 2 * inset, MIN_CELL_BOX_PT);
    const insets = contentInsets(cell.margins, cell.borders, cellSpacingPt);
    const topInset = isContinuation ? insets.top - cell.margins.top : insets.top;
    // Always reserve bottom inset so the fragment never paints into the margin/border band.
    // A detached head answers to the page and to its own SPAN, and to nothing about this
    // row: `hRule="exact"` fixes the height of the ROW (17.18.37) while the merged content
    // goes on through the rows below it. The span arrives as a HEIGHT and becomes a bottom
    // here, against the row top being placed, so it cannot outlive a move to another page —
    // and a head that outruns either bound hands back a remainder rather than losing a line.
    const spanHeightPt = detachedSpans?.get(cell.id);
    const isDetached = spanHeightPt !== undefined;
    const cellMaxBottom = isDetached
      ? Math.min(detachedBottomPt, rowTop + spanHeightPt)
      : flowMaxBottom;
    const vertical = cell.textDirection === 'btLr';
    const flowLeft = vertical ? cellX + insets.bottom : cellX + insets.left;
    const flowRight = vertical
      ? cellX + Math.max(0, cellMaxBottom - rowTop) - topInset
      : cellX + cellW - insets.right;
    const contentTop = vertical ? rowTop + insets.left : rowTop + topInset;
    const contentMaxBottom = vertical
      ? rowTop + cellW - insets.right
      : cellMaxBottom - insets.bottom;

    let blocks: readonly BlockFragmentRecord[] = [];
    let contentBottom = contentTop;
    let nextCursor = cursor;
    let complete = true;
    let fitted = false;
    let nestedSplitBlocked = false;

    if (!cell.vMergeContinue) {
      if (contentMaxBottom < contentTop + 0.001) {
        complete = cursor.blockIndex >= cell.blocks.length;
      } else {
        const flow = flowBlocksInBoxBounded(
          cell.blocks,
          flowLeft,
          flowRight,
          contentTop,
          contentMaxBottom,
          depth,
          flowDeps,
          cursor,
          cell.styleFormatting,
          true
        );
        blocks = flow.blocks;
        contentBottom = flow.bottom;
        nextCursor = flow.cursor;
        complete = flow.complete;
        fitted = flow.fitted;
        nestedSplitBlocked = flow.nestedSplitBlocked;
        if (fitted) anyFitted = true;
        if (nestedSplitBlocked) anyNestedBlocked = true;
      }
    }

    // Fitted content owns the height (including its final paragraph's spaceAfter). Do not
    // re-floor with defaultLineHeight — that invented bottom pad when the measured line was
    // shorter than the DEFAULT_RUN_STYLE line. Empty / continue cells still need one line.
    const cellBottom = Math.min(
      cellMaxBottom,
      vertical && fitted
        ? rowTop + topInset + (blockInlineRight(blocks, flowLeft) - flowLeft) + insets.bottom
        : fitted
          ? contentBottom + insets.bottom
          : rowTop + topInset + defaultLineHeight + insets.bottom
    );
    if (cellBottom > rowBottom && !isDetached) rowBottom = cellBottom;

    flowed.push({
      cell,
      x: cellX,
      width: cellW,
      gridColumn,
      blocks,
      contentTop,
      contentBottom,
      physicalBottom: cellBottom,
      insets: { ...insets, top: topInset },
      nextCursor,
      complete: cell.vMergeContinue ? true : complete,
      fitted,
      nestedSplitBlocked,
    });
  }

  rowBottom = Math.min(flowMaxBottom, Math.max(rowBottom, rowTop));
  for (const entry of flowed) {
    if (detachedSpans?.has(entry.cell.id) === true) continue;
    const needed = entry.physicalBottom;
    if (needed > rowBottom && needed <= flowMaxBottom + 0.001) {
      rowBottom = needed;
    }
  }
  // A row whose ONLY cells are detached merge heads has had nothing raise it: the two passes
  // above skip detached cells on purpose, and a head row has no continuation cell to
  // contribute the empty-cell line the way a covered row does. Word still draws that row a
  // line tall, so floor it there rather than collapsing it onto the row below.
  if (rowBottom <= rowTop + 0.001 && flowed.length > 0) {
    let lineBottom = rowTop;
    for (const entry of flowed) {
      const line = rowTop + entry.insets.top + defaultLineHeight + entry.insets.bottom;
      if (line > lineBottom) lineBottom = line;
    }
    rowBottom = Math.min(flowMaxBottom, lineBottom);
  }
  rowBottom = Math.min(flowMaxBottom, rowBottom);

  // Exact: force the authored height (clamped to the page budget) and clip leftover content.
  // atLeast: floor a finished fragment when the minimum fits; never push past maxBottom.
  let clipExact = false;
  if (exactHeightPt !== undefined) {
    const exactBottom = rowTop + exactHeightPt;
    if (exactBottom <= maxBottom + 0.001) {
      rowBottom = exactBottom;
      clipExact = true;
    } else {
      // Exact taller than remaining band — keep content-sized clamp; pagination fails closed.
      rowBottom = Math.min(maxBottom, rowBottom);
    }
  } else {
    // Two floors, same rule: the authored `atLeast` minimum and the height a vMerge span
    // assigned this row. Neither applies to a continuation fragment — a mid-row split is
    // content-driven, and flooring both halves counts the span twice — or past the budget.
    const spanFloorPt = isContinuation ? 0 : (vMerge?.heightFloorPt ?? 0);
    const minBottom = rowTop + Math.max(atLeastHeightPt ?? 0, spanFloorPt);
    const floors = minBottom > rowBottom && minBottom <= maxBottom + 0.001;
    if (floors && flowed.every((entry) => entry.complete)) rowBottom = minBottom;
  }
  rowBottom = Math.min(maxBottom, rowBottom);
  const rowHeight = Math.max(0, rowBottom - rowTop);

  const cells: TableCellFragmentRecord[] = flowed.map((entry) => {
    let blocks = entry.blocks;
    // vAlign only when the cell finished on this fragment (no more continuation).
    const cellComplete = clipExact ? true : entry.complete;
    if (
      !entry.cell.vMergeContinue &&
      cellComplete &&
      entry.cell.vAlign !== 'top' &&
      blocks.length > 0
    ) {
      const contentHeight = entry.contentBottom - entry.contentTop;
      const available =
        entry.cell.textDirection === 'btLr'
          ? entry.width - entry.insets.left - entry.insets.right - contentHeight
          : rowHeight - entry.insets.top - entry.insets.bottom - contentHeight;
      if (available > 0) {
        const dy = entry.cell.vAlign === 'center' ? available / 2 : available;
        blocks = shiftBlocks(blocks, dy);
      }
    }
    return {
      id: entry.cell.id,
      gridColumn: entry.gridColumn,
      ...(entry.cell.gridColumnId ? { gridColumnId: entry.cell.gridColumnId } : {}),
      gridSpan: entry.cell.gridSpan,
      vMergeContinue: entry.cell.vMergeContinue,
      ...(entry.cell.vMergeContinue ? { paintInert: true as const } : {}),
      rowSpan: 1,
      ...(entry.cell.shading === undefined ? {} : { shading: entry.cell.shading }),
      ...(entry.cell.textDirection === 'btLr' ? { textDirection: 'btLr' as const } : {}),
      blocks,
      box: { x: entry.x, y: rowTop, width: entry.width, height: rowHeight },
    };
  });

  // Exact clips: leftover cell content is not continued onto the next page (17.18.37).
  const remainderCursors = clipExact
    ? null
    : flowed.every((entry) => entry.complete)
      ? null
      : flowed.map((entry) => entry.nextCursor);
  const complete = clipExact || flowed.every((entry) => entry.complete);

  flushDeferred(cells, rowTop, rowHeight);

  return {
    record: {
      id: row.id,
      ...(row.revisionKind ? { revisionKind: row.revisionKind } : {}),
      ...(row.revisionId !== undefined ? { revisionId: row.revisionId } : {}),
      ...(row.revisionAuthor !== undefined ? { revisionAuthor: row.revisionAuthor } : {}),
      ...(row.revisionDate !== undefined ? { revisionDate: row.revisionDate } : {}),
      rowIndex: 0,
      isHeaderRow: row.isHeader,
      isHeaderRepeat,
      ...(isContinuation ? { isContinuation: true as const } : {}),
      cells,
      box: { x: left, y: rowTop, width: total, height: rowHeight },
    },
    bottom: rowBottom,
    remainder: complete ? null : remainderCursors,
    fitted: anyFitted || row.cells.every((cell) => cell.vMergeContinue) || clipExact,
    nestedSplitBlocked: anyNestedBlocked,
  };
}

/**
 * The row's height on its own, with no page position — what the caller compares against a
 * fresh content box to decide whether the row fits where it stands or has to move.
 *
 * The probe places the row at y=0 because that height must not depend on where the row
 * currently sits. Wrap exclusions are the opposite: they are page-content bands, so at y=0
 * a float near the top of the page covers a row that really sits far below it, and every
 * cell paragraph breaks around a picture it never touches. The probe therefore measures
 * free of them — the placing pass runs at the row's true top and applies whichever bands
 * actually cross it.
 */
export function measureRowHeight(
  row: SemanticTableRow,
  cols: readonly number[],
  left: number,
  depth: number,
  deps: TableFlowDeps,
  cellSpacingPt = 0,
  vMerge?: RowVMergeLayoutOptions,
  atYPt?: number
): number {
  let lineCounter = 0;
  // `atYPt` measures the row WHERE IT IS GOING, wrap bands included — the one thing the
  // position-free probe above cannot do. A merge deciding how tall its span must be passes
  // it; everyone else keeps the position-free probe and the bands it must not see.
  const positioned = atYPt !== undefined;
  const probeDeps: TableFlowDeps = {
    ...stripAnchorSinksForProbe(deps),
    ...(positioned ? {} : { pageExclusionZones: undefined }),
    nextLineId: () => `probe-${lineCounter++}`,
  };
  // `vMerge` reaches the probe so a detached head is detached HERE too. Emptying its blocks
  // instead still charged the row the empty-cell line below, and that phantom line became a
  // floor the placement never asked for.
  const placed = layoutRowFragment(
    row,
    cols,
    left,
    atYPt ?? 0,
    false,
    depth,
    probeDeps,
    cellSpacingPt,
    vMerge
  );
  return placed.record.box.height;
}

/**
 * One row of a table placed in ONE PASS, where there is no next fragment to carry a
 * remainder to — a nested table, a header/footer story.
 *
 * A merged head is bounded by its span, so it CAN come back owing more than it placed, and
 * these callers have nowhere to put what it owes. Dropping it would break the one rule this
 * module does not bend: nothing discards content to stay inside a box. So the row is placed
 * again with the merge unplanned, which puts the head back to sizing its own row and holding
 * all of it — the shape this file had before any of it planned heights.
 *
 * `rollback` undoes what the discarded attempt published AND withdraws the merge from the
 * plan. The first is why the paginator refuses to re-place at all: an attempt on live deps
 * has already emitted its anchored drawings, and re-placing without taking them back leaves
 * a float positioned by a layout that never happened. The second matters just as much —
 * un-planning the ROW alone leaves the span accepted, so the surplus it put below is still
 * handed out while the head sizes its own row again, reserving the merged height twice.
 *
 * A caller with no sink it can undo must not pass a `vMerge` at all.
 */
function layoutOnePassRow(
  row: SemanticTableRow,
  structure: SemanticTableStructure,
  left: number,
  y: number,
  depth: number,
  deps: TableFlowDeps,
  isHeaderRepeat: boolean,
  vMerge: RowVMergeLayoutOptions | undefined,
  rollback: () => void
): LayoutRowBoundedResult {
  const place = (options: RowVMergeLayoutOptions | undefined): LayoutRowBoundedResult =>
    layoutRowFragment(
      row,
      structure.columnWidthsPt,
      left,
      y,
      isHeaderRepeat,
      depth,
      deps,
      structure.cellSpacingPt,
      options
    );
  const placed = place(vMerge);
  if (placed.remainder === null || vMerge === undefined) return placed;
  rollback();
  return place(undefined);
}

/**
 * The vMerge plan for one table, probed by row layout. `rows` narrows it to the rows the
 * caller actually places — the paginator plans over the BODY rows, so a merge is never
 * planned against a repeated header copy.
 */
export const vMergePlanFor = (
  structure: SemanticTableStructure,
  left: number | (() => number),
  depth: number,
  deps: TableFlowDeps,
  rows?: readonly SemanticTableRow[]
): VMergeRowHeights | null =>
  deps.measuringOnly === true
    ? null
    : planTableVMergeHeights(
        rows ? { ...structure, rows } : structure,
        left,
        depth,
        deps,
        measureRowHeight
      );

/**
 * A nested table inside a cell: laid out with its own geometry, no pagination, one
 * fragment. Returns null past the nesting ceiling — the cell renders empty rather than
 * recursing without bound.
 */
function emitNestedTable(
  table: OoxmlElement,
  left: number,
  right: number,
  top: number,
  depth: number,
  deps: TableFlowDeps
): { readonly fragment: TableFragmentRecord; readonly bottom: number } | null {
  if (depth >= MAX_TABLE_NESTING) return null;
  const containerWidth = Math.max(1, right - left);
  const structure = readTableStructure(
    table,
    containerWidth,
    depth,
    deps.styleCascade,
    deps.displayMode,
    deps.revisionAuthorFilter
  );
  if (!structure || structure.rows.length === 0) return null;
  const nestedDeferred: DeferredRowAnchor[] = [];
  const nestedFlowDeps: TableFlowDeps = {
    ...deps,
    publishAnchoredDrawings: undefined,
    collectAnchoredDrawings: undefined,
    anchorDeferOnly: true,
    deferAnchoredDrawings: (pending) => {
      nestedDeferred.push(pending);
    },
  };
  // A nested table is placed inside its CELL's content box by the same rules a top-level one
  // is placed inside the text column.
  const tableLeft = left + tableOriginX(structure, containerWidth);
  const vMergePlan = vMergePlanFor(structure, tableLeft, depth, nestedFlowDeps);
  const rawRows: TableRowFragmentRecord[] = [];
  let y = top;
  for (const [rowIndex, row] of structure.rows.entries()) {
    // Anchors this row defers are taken back if its placement is discarded, so a retry
    // cannot publish a drawing twice.
    const deferredBefore = nestedDeferred.length;
    const placed = layoutOnePassRow(
      row,
      structure,
      tableLeft,
      y,
      depth,
      nestedFlowDeps,
      false,
      acceptVMergeSpansAt(vMergePlan, rowIndex, y),
      () => {
        nestedDeferred.length = deferredBefore;
        vMergePlan?.withdrawAt(rowIndex);
      }
    );
    rawRows.push(placed.record);
    y = placed.bottom;
  }
  const rows = finalizeTableRows(
    rawRows,
    structure,
    structure.rows,
    deps.borderOwnershipBudget,
    deps.vMergeResolveBudget,
    undefined,
    undefined,
    undefined
  );
  for (const pending of nestedDeferred) {
    for (const row of rows) {
      const hostsParagraph = row.cells.some((cell) =>
        cell.blocks.some(
          (block) => block.kind === 'paragraph' && block.paragraphId === pending.paragraphId
        )
      );
      if (!hostsParagraph) continue;
      publishDeferredRowAnchors([pending], row.cells, row.box.y, row.box.height, deps);
      break;
    }
  }
  const width = sumCols(structure.columnWidthsPt, 0, structure.columnWidthsPt.length);
  const rowOrdinals = new Map<string, number>();
  return {
    fragment: annotateTableFragmentGeometry(
      {
        kind: 'table',
        id: `${table.id}#f0`,
        tableId: table.id,
        fragmentIndex: 0,
        rows,
        box: { x: tableLeft, y: top, width, height: y - top },
      },
      structure.columnWidthsPt,
      depth,
      rowOrdinals
    ),
    bottom: y,
  };
}

/** Lay out every row of a structure (no pagination) and finalize merges/borders. */
export function layoutTableFragment(
  structure: SemanticTableStructure,
  left: number,
  top: number,
  fragmentIndex: number,
  tableId: string,
  depth: number,
  deps: TableFlowDeps,
  isHeaderRepeat: (row: SemanticTableRow) => boolean = () => false
): { readonly fragment: TableFragmentRecord; readonly bottom: number } {
  // No merge planning here, deliberately. Planning gives a head a bound it can hand a
  // remainder back against, and the only lossless answer to that is to place the row again —
  // which needs a sink the discarded attempt's anchored drawings can be taken back from.
  // This function publishes straight through the `deps` it is handed and has none, so it
  // sizes merged heads the way this file did before it planned anything. A caller that wants
  // the planning has to bring a rollback-able sink with it, as `emitNestedTable` does.
  const rawRows: TableRowFragmentRecord[] = [];
  let y = top;
  for (const row of structure.rows) {
    const placed = layoutRowFragment(
      row,
      structure.columnWidthsPt,
      left,
      y,
      isHeaderRepeat(row),
      depth,
      deps,
      structure.cellSpacingPt
    );
    rawRows.push(placed.record);
    y = placed.bottom;
  }
  const rows = finalizeTableRows(
    rawRows,
    structure,
    structure.rows,
    deps.borderOwnershipBudget,
    deps.vMergeResolveBudget
  );
  const width = sumCols(structure.columnWidthsPt, 0, structure.columnWidthsPt.length);
  const rowOrdinals = new Map<string, number>();
  return {
    fragment: annotateTableFragmentGeometry(
      {
        kind: 'table',
        id: `${tableId}#f${fragmentIndex}`,
        tableId,
        fragmentIndex,
        rows,
        box: { x: left, y: top, width, height: y - top },
      },
      structure.columnWidthsPt,
      depth,
      rowOrdinals
    ),
    bottom: y,
  };
}
