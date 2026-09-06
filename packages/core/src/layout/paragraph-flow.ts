// Paragraph measuring and breaking, shared between the body flow and table cells.
//
// Extracted from `semantic-layout.ts` unchanged so a cell paragraph breaks exactly like a
// body paragraph: same pieces, same word boundaries, same cache discipline. The BREAK is
// position-independent — span x offsets are relative to the paragraph origin — which is
// what lets one cached break serve the same content at any x (body or any cell).

import {
  PAGE_BREAK_CHAR,
  twips,
  twipsToPoints,
  type DocumentProperties,
  type OoxmlNode,
  type OoxmlProperty,
  type Twips,
} from '@docx-editor.dev/core/store';
import {
  piecesOfParagraph,
  propertiesOfRunContainer,
  type FieldAwarePiece,
  type FieldPageContext,
  type PositionalTab,
  type FieldLinkProjector,
  type HyperlinkProjector,
  type ModelRange,
  type RunPropertyCascader,
} from './field-projection.ts';
import {
  DEFAULT_REVISION_DISPLAY_MODE,
  revisionsVisible,
  type RevisionAttribution,
  type RevisionAuthorFilter,
  type RevisionDisplayMode,
} from './revision-projection.ts';
import type { ParagraphLayoutCache } from './layout-cache.ts';
import { cjkChopCutAllowedAt, lineOpenDecisionAt, wordBoundaries } from './cjk-line-break.ts';
import {
  EMPTY_TAB_STOPS,
  nextTabDestination,
  tabAdvanceWidth,
  TAB_LEADER_GLYPH,
  type ResolvedTabStops,
  type TabLeader,
} from './paragraph-tabs.ts';
import {
  SINGLE_LINE_SPACING,
  applyLineSpacing,
  type ParagraphLineSpacing,
} from './paragraph-style.ts';
import {
  DEFAULT_RUN_STYLE,
  displayText,
  measureDisplayText,
  resolveRunStyle,
  type ResolvedRunStyle,
  type ThemeFonts,
} from './run-style.ts';
import { styleForFontSlot } from './script-itemization.ts';
import { createLineExclusionClearance } from './line-exclusion-clearance.ts';
import type { LayoutBox, StyleSpanRecord, TextMeasurer } from './semantic-records.ts';
import {
  buildInlineDrawingRecord,
  inlineDrawingVerticalLayout,
  measureInlineDrawing,
  repositionInlineDrawingsForBaseline,
  shiftInlineDrawingRecord,
  anchoredDrawingAtomsInParagraph,
  drawingModelOffsetsInParagraph,
  type InlineDrawingLayoutContext,
  type InlineDrawingRecord,
} from './drawing-layout.ts';
import {
  mergeAvailableIntervalsAtY,
  remainingWidthAtX,
  snapXToAvailableInterval,
  synthesizeParagraphTopAndBottomZones,
  synthesizeParagraphWrapExclusionZones,
  type ExclusionZone,
} from './drawing-exclusion.ts';
import { createEquationLayouter } from './equation-layout.ts';
import { anchorLineStartsByModelOffset } from './anchor-line-probe.ts';
import { isCollapsibleLineEndWhitespace } from './line-end-whitespace.ts';
import { chopOversizedWord } from './oversized-word-break.ts';

/**
 * How far past the line's right edge a span may reach before it counts as overflow.
 *
 * A right/centre/decimal tab computes its advance in ABSOLUTE x — `destination - currentX -
 * segmentWidth` — while wrapping is decided in line-local width. Converting between the two
 * subtracts and re-adds the paragraph origin, so a segment the tab placed to end EXACTLY at
 * the edge lands a fraction of an ulp beyond it. Without a tolerance that hairline decides a
 * line break, and a right-aligned tab is built to reach the edge exactly. A thousandth of a
 * point is far below one device pixel, so nothing a reader could see wraps because of this.
 */
const OVERFLOW_TOLERANCE_PT = 0.001;

/**
 * Per-paragraph geometry the BREAK depends on, beyond width.
 *
 * Both change where lines start and how tall they are, so both belong in the caller's
 * cache key — a paragraph re-broken at a different line spacing is a different break.
 */
export interface ParagraphFlowOptions {
  readonly lineSpacing?: ParagraphLineSpacing;
  /** First-line offset from the paragraph indent: `w:firstLine` right, `w:hanging` left. */
  readonly firstLineOffset?: number;
  /** Re-break only the unplaced suffix when an unequal-width column follows. */
  readonly startOffset?: number;
  /**
   * The containing text column — the page content box, or a table cell's — in the same
   * coordinates as `indentLeft`.
   *
   * `w:ptab/@w:relativeTo="margin"` measures against THIS, not against the paragraph's own
   * indented column: a contents line inside an indented paragraph still puts its page
   * number at the margin. Absent, a positional tab falls back to the paragraph's column,
   * which is the same answer whenever the paragraph carries no indents.
   */
  readonly marginExtent?: { readonly left: number; readonly right: number };
  /**
   * Turns a typed `w:hyperlink` into the sanitized record its spans carry.
   *
   * Supplied by the document layout, which is the level that can see the package's
   * relationships. Absent means link runs still measure and paint — they simply carry no
   * link, which is what a table-cell or furniture pass without a resolver gets.
   */
  readonly projectLink?: HyperlinkProjector;
  /**
   * Turns a parsed HYPERLINK field instruction into the sanitized record its result carries.
   *
   * Same seam and same degradation as {@link projectLink}: absent, the field's cached result
   * still measures and paints — it simply is not a link.
   */
  readonly projectFieldLink?: FieldLinkProjector;
  /**
   * The document's parsed metadata, for document-property fields (TITLE, AUTHOR, …).
   *
   * Document-global rather than per-paragraph — the surface reads it once from the store and
   * hands the same object to every flow. Absent means such a field paints its cached result or
   * nothing, the same degradation as a furniture-only pass.
   */
  readonly documentProperties?: DocumentProperties;
  /**
   * True when this is BODY flow, whose PAGE/NUMPAGES/SECTIONPAGES fields are substituted at
   * document finalize (`substituteBodyPageFields`). Only then does an empty-cache page field
   * paint a placeholder digit; headers/footers, notes and text boxes leave it blank, keeping
   * their own live path or their deferral, so a placeholder is never stranded unsubstituted.
   */
  readonly bodyPageFields?: import('./field-page-furniture.ts').BodyPageFieldContext | false;
  /**
   * The story's resolved REF inputs (bookmark targets + numbering), for live REF results.
   *
   * Supplied by the body flow, whose block cache keys fold the resolved values — a flow that
   * threads this WITHOUT keying on those values would serve stale breaks after a renumbering
   * edit. Absent means REF fields paint their cached results, the safe degradation every
   * other story (headers/footers, notes, text boxes) currently takes.
   */
  readonly refFields?: import('./field-ref.ts').RefFieldContext;
  /**
   * Which revisions this break resolves away.
   *
   * A different mode is a different break — the proposed result drops deleted text, so lines
   * wrap elsewhere — so it belongs in the caller's cache key alongside line spacing.
   */
  readonly displayMode?: RevisionDisplayMode;
  /** Reviewers whose revisions project as accepted for this layout pass. */
  readonly revisionAuthorFilter?: RevisionAuthorFilter;
  /** Derived footnote/endnote marks for noteReference / noteRef projection. */
  readonly noteMarks?: import('./note-projection.ts').NoteMarkContext;
  /** Inline drawing projection + resource lookup for typed `w:drawing` nodes. */
  readonly inlineDrawingLayout?: InlineDrawingLayoutContext;
  /**
   * Left edge of the containing text column in paragraph-relative coordinates, for clipping
   * oversized inline extents at the content box without scaling them.
   */
  readonly contentLeft?: number;
  /** Right edge of the containing text column in paragraph-relative coordinates. */
  readonly contentRight?: number;
  /**
   * Horizontal origin of the active column within page-content coordinates.
   * Line x offsets are column-local; exclusion zones are page-wide.
   */
  readonly contentOriginX?: number;
  /** Page-content Y where this paragraph starts — for anchored wrap exclusion at break time. */
  readonly paragraphStartY?: number;
  /** Active exclusion zones on the current page while breaking. */
  readonly pageExclusionZones?: readonly ExclusionZone[];
  /** When breaking inside a table cell, the cell content box for anchored frame resolution. */
  readonly anchorCellBox?: LayoutBox | null;
  /**
   * Cross-paragraph TOC field begin/end paragraphs carry only `w:fldChar` / `w:instrText`
   * chrome with no measurable text. When set, an otherwise empty break returns no lines so
   * layout does not reserve the caret placeholder row ordinary empty paragraphs need.
   */
  readonly suppressEmptyPlaceholderLine?: boolean;
  /**
   * The theme's Latin typefaces, resolving `w:rFonts` theme references.
   *
   * A different theme measures every `+Body`/`+Headings` run in a different face, so it
   * belongs in the caller's cache key. The BODY lane has that: `semantic-layout` folds
   * `StyleCascadeTable.cacheToken` into its producer. The header/footer and note lanes pass
   * the raw surface producer instead, so their keys carry the cascaded `w:rFonts` property
   * but not the theme it resolves through. That is safe only because the theme is memoized
   * per session and every reload rebuilds the surface with a fresh cache — a live retheme
   * would need `cacheToken` folded into those producers too.
   */
  readonly themeFonts?: ThemeFonts;
  /** Stable measurement producer token for cross-break equation geometry reuse. */
  readonly equationCacheToken?: string;
  /**
   * Paragraph-mark cascade for empty-line metrics and last-line mark height.
   * When omitted, falls back to the content `inheritedRunProperties` argument.
   */
  readonly markRunProperties?: readonly OoxmlProperty[];
}

/** One measurable piece of a paragraph: text carrying one property set. */
interface Piece {
  readonly text: string;
  readonly props: readonly OoxmlProperty[];
  /** Resolved once here, so nothing downstream re-derives it. */
  readonly style: ResolvedRunStyle;
  readonly start: number;
  readonly end: number;
  /** Live PAGE/NUMPAGES projection — model range covers suppressed cached result (or zero-width if empty). */
  readonly projected?: boolean;
  /** When set, measure this instead of `text` (note-mark width reservation). */
  readonly measureText?: string;
  /** Note citation / mark navigation for paint. */
  readonly noteNav?: {
    readonly scopeId: string;
    readonly direction: 'to-note' | 'to-body';
  };
  /** Zero-width `w:ptab` destination metadata. */
  readonly positionalTab?: PositionalTab;
  readonly breakKind?: FieldAwarePiece['breakKind'];
  /** Sanitized hyperlink this piece belongs to. */
  readonly link?: import('./semantic-records.ts').SpanLinkRecord;
  /** Typed inline drawing occupying one UTF-16 model unit. */
  readonly inlineDrawing?: import('./drawing-layout.ts').InlineDrawingLayoutInput;
  /** Bounded OMML equation occupying one UTF-16 model unit. */
  readonly equation?: FieldAwarePiece['equation'];
  /**
   * The `w:rFonts` slot this piece's text resolves its face through, from
   * `applyEastAsiaFontSlots`. `style` stays the run's real resolution; every measurement
   * below resolves the face with `styleForFontSlot`, and the slot is republished on the
   * span so paint and hit-testing resolve the same one.
   */
  readonly fontSlot?: FieldAwarePiece['fontSlot'];
}

export function propertiesOf(container: OoxmlNode | undefined): OoxmlProperty[] {
  return propertiesOfRunContainer(container);
}

/**
 * Measure text following a tab until the next tab or hard break, across mixed-style pieces.
 * Also reports the advance to the first decimal point for decimal-aligned stops.
 */
/**
 * Whether anything that occupies space still follows this tab on its own line.
 *
 * A TRAILING tab does not wrap in Word — same rule as a trailing space. Header lines are
 * routinely authored as `LEFT<tab><tab><tab>RIGHT<tab><tab>`, and treating the last tabs
 * as wrappable opened a new line per tab: the header grew by several lines, and because a
 * header's flow height sets the body's effective top margin, the body was pushed down the
 * page. Stops at a hard break, which ends the line anyway, and skips further tabs and
 * spaces, which are themselves trimmed at the line end.
 */
function placeableContentSuffixes(pieces: readonly Piece[]): readonly Uint8Array[] {
  const suffixes = new Array<Uint8Array>(pieces.length);
  let follows = false;
  for (let pieceIndex = pieces.length - 1; pieceIndex >= 0; pieceIndex -= 1) {
    const piece = pieces[pieceIndex]!;
    const suffix = new Uint8Array(piece.text.length + 1);
    suffix[piece.text.length] = follows ? 1 : 0;
    if (piece.inlineDrawing) {
      suffix.fill(1);
    } else {
      for (let cursor = piece.text.length - 1; cursor >= 0; cursor -= 1) {
        const ch = piece.text[cursor]!;
        if (ch === '\n' || ch === PAGE_BREAK_CHAR) suffix[cursor] = 0;
        else if (ch !== '\t' && !isCollapsibleLineEndWhitespace(ch)) suffix[cursor] = 1;
        else suffix[cursor] = suffix[cursor + 1]!;
      }
    }
    suffixes[pieceIndex] = suffix;
    follows = suffix[0] === 1;
  }
  return suffixes;
}

function measureFollowingTabSegment(
  pieces: readonly Piece[],
  pieceIndex: number,
  offsetInPiece: number,
  measurer: TextMeasurer
): { width: number; decimalOffset: number } {
  let width = 0;
  let decimalOffset = 0;
  let sawDecimal = false;
  for (let index = pieceIndex; index < pieces.length; index += 1) {
    const piece = pieces[index]!;
    const style = styleForFontSlot(piece.style, piece.fontSlot);
    const from = index === pieceIndex ? offsetInPiece : 0;
    for (let cursor = from; cursor < piece.text.length; ) {
      const ch = piece.text[cursor]!;
      if (ch === '\t' || ch === '\n' || ch === PAGE_BREAK_CHAR) {
        return { width, decimalOffset: sawDecimal ? decimalOffset : width };
      }
      // Walk one code unit; surrogate pairs measure as two units under the fixed measurer
      // contract (UTF-16), matching how source offsets are counted elsewhere.
      const next = cursor + 1;
      const glyph = piece.text.slice(cursor, next);
      const advance = measurer.measure(displayText(glyph, style), style);
      if (!sawDecimal && ch === '.') {
        sawDecimal = true;
        // Decimal point itself sits ON the stop — offset is the advance before it.
      } else if (!sawDecimal) {
        decimalOffset += advance;
      }
      width += advance;
      cursor = next;
    }
  }
  return { width, decimalOffset: sawDecimal ? decimalOffset : width };
}

/**
 * Where a `w:ptab` sends the caret, in the same shape `nextTabDestination` answers with.
 *
 * ECMA-376 §17.3.3.16: the position is stated by `w:alignment` against the reference
 * `w:relativeTo` names, rather than looked up in `w:tabs`.
 *
 * ONLY `w:alignment` is honoured here; the reference is always the paragraph's own text
 * column (`indentLeft`..`rightEdge`), which is what `w:relativeTo="margin"` — the value
 * every contents field Word generates carries — means. `indent` differs from it only for
 * an indented paragraph and `leftMargin` only for a ptab pointing backwards, both of which
 * the clamp in `tabAdvanceWidth` already resolves to no advance. `positionalTabOf` still
 * validates the attribute so a hostile value cannot reach geometry if that changes.
 */
function positionalTabDestination(
  positional: PositionalTab,
  indentLeft: number,
  rightEdge: number,
  marginExtent: { readonly left: number; readonly right: number } | undefined
): { positionPt: number; alignment: 'left' | 'center' | 'right' | 'decimal'; leader?: TabLeader } {
  // `indent` measures against the paragraph's own column; `margin` and `leftMargin` against
  // the containing one. They differ exactly when the paragraph is indented — which is where
  // reading `w:relativeTo` and then ignoring it put the page number short of the margin by
  // the width of the indent.
  const column =
    positional.relativeTo === 'indent' || !marginExtent
      ? { left: indentLeft, right: rightEdge }
      : marginExtent;
  const positionPt =
    positional.alignment === 'right'
      ? column.right
      : positional.alignment === 'center'
        ? (column.left + column.right) / 2
        : column.left;
  return {
    positionPt,
    alignment: positional.alignment,
    ...(positional.leader ? { leader: positional.leader } : {}),
  };
}

// The pending-line record and its budget/freeze helpers live in pending-line.ts;
// re-exported so every existing import through this module stays stable.
import {
  coalesceIdeographicSpans,
  frozenLine,
  pendingLineFlowExtent,
  pendingLineFlowExtentAtPlacement,
  type PendingLine,
} from './pending-line.ts';
export {
  coalesceIdeographicSpans,
  frozenLine,
  pendingLineFlowExtent,
  pendingLineFlowExtentAtPlacement,
  type PendingLine,
};

/**
 * Soft ceiling on an indent, in twips (31_680 ≈ 22"), matching the paragraph-spacing and
 * tab-position bounds. `w:ind` is attacker-controlled and flows straight into `rightEdge`
 * and the available line width, so an unbounded value reaches paint geometry.
 */
export const MAX_PARAGRAPH_INDENT_TWIPS = 31_680;

export function indentTwips(raw: string | undefined): Twips | null {
  // Up to 9 digits so an oversized authored value reaches the clamp rather than being read
  // as a measurement; a longer digit string is garbage, and `Number` turns enough of them
  // into `Infinity`, which then poisons every width derived from it.
  if (raw === undefined || !/^-?\d{1,9}$/.test(raw)) return null;
  const authored = Number(raw);
  if (!Number.isFinite(authored)) return null;
  if (authored > MAX_PARAGRAPH_INDENT_TWIPS) return twips(MAX_PARAGRAPH_INDENT_TWIPS);
  if (authored < -MAX_PARAGRAPH_INDENT_TWIPS) return twips(-MAX_PARAGRAPH_INDENT_TWIPS);
  return twips(authored);
}

export function paragraphIndent(props: readonly OoxmlProperty[]): {
  left: number;
  right: number;
} {
  let left = 0;
  let right = 0;
  for (const property of props) {
    if (property.localName !== 'ind') continue;
    // `w:start`/`w:end` are the ISO 29500 Strict spellings of `w:left`/`w:right`; the
    // physical name wins where a producer writes both.
    const rawLeft = property.attributes?.left ?? property.attributes?.start;
    const rawRight = property.attributes?.right ?? property.attributes?.end;
    const twipsLeft = indentTwips(rawLeft);
    const twipsRight = indentTwips(rawRight);
    if (twipsLeft !== null) left = twipsToPoints(twipsLeft);
    if (twipsRight !== null) right = twipsToPoints(twipsRight);
  }
  return { left, right };
}

/** Horizontal alignment of a paragraph (`w:jc`, ECMA-376 §17.3.1.13). */
export type Alignment = 'left' | 'center' | 'right' | 'both';

export function paragraphAlignment(props: readonly OoxmlProperty[]): Alignment {
  let alignment: Alignment = 'left';
  for (const property of props) {
    if (property.localName !== 'jc') continue;
    switch (property.attributes?.val) {
      // `start`/`end` are the direction-relative spellings; this lane is left-to-right only,
      // so they resolve to left/right rather than being ignored as unknown.
      case 'center':
        alignment = 'center';
        break;
      case 'right':
      case 'end':
        alignment = 'right';
        break;
      case 'both':
      case 'distribute':
        alignment = 'both';
        break;
      default:
        alignment = 'left';
    }
  }
  return alignment;
}

/**
 * True when this span's trailing U+0020 is an inter-word slot Word can stretch.
 *
 * Paint reapplies justification as CSS `word-spacing` on those same spaces. Inserting layout
 * slack at every style-span boundary (tabs, run splits mid-phrase) put gaps where paint has
 * none and shifted every later span — caret mid-word drifted by a multiple of the step while
 * the highlight (DOM) stayed on the glyphs.
 */
function endsWithExpandableSpace(text: string): boolean {
  return text.endsWith(' ');
}

/**
 * Shift a line's spans to satisfy the paragraph alignment.
 *
 * Layout is the only geometry authority: hit testing and the caret read published span boxes
 * and measure intra-span prefixes on demand. Paint starts the line at `LineRecord.contentX` —
 * the first span's x whenever there is one — and flows inline, so justification slack must
 * land on the same inter-word spaces `word-spacing` expands, not on every style-span boundary.
 *
 * A line with NO spans returns unchanged; its alignment is published as `contentX` by the
 * callers, which is the only place an empty paragraph's caret x can come from.
 */
export function alignSpans(
  spans: readonly StyleSpanRecord[],
  measurer: TextMeasurer,
  indentLeft: number,
  available: number,
  alignment: Alignment,
  isLastLine: boolean,
  lineUsedWidth?: number
): readonly StyleSpanRecord[] {
  if (spans.length === 0) return spans;
  if (alignment === 'left') return spans;

  let trailingEnd = spans.length;
  while (
    trailingEnd > 0 &&
    spans[trailingEnd - 1]!.box.width === 0 &&
    (spans[trailingEnd - 1]!.text === '\n' || spans[trailingEnd - 1]!.text === PAGE_BREAK_CHAR)
  ) {
    trailingEnd -= 1;
  }
  let trailingStart = trailingEnd;
  while (trailingStart > 0 && spans[trailingStart - 1]!.lineEndWhitespace) {
    trailingStart -= 1;
  }
  const lastContentSpan = spans[trailingEnd - 1];
  const spansReachLineEnd =
    lineUsedWidth !== undefined &&
    lastContentSpan !== undefined &&
    Math.abs(lastContentSpan.box.x + lastContentSpan.box.width - indentLeft - lineUsedWidth) <=
      OVERFLOW_TOLERANCE_PT;
  if (
    trailingStart < trailingEnd &&
    spansReachLineEnd &&
    (alignment === 'center' || alignment === 'right')
  ) {
    const used = spans[trailingStart]!.box.x - indentLeft;
    const slack = available - used;
    if (slack <= 0) return spans;
    const offset = alignment === 'center' ? slack / 2 : slack;
    const clipsAtMargin = (lineUsedWidth ?? 0) >= available - OVERFLOW_TOLERANCE_PT;
    let fillX = spans[trailingStart]!.box.x + offset;
    return spans.map((span, index) => {
      if (index < trailingStart) return { ...span, box: { ...span.box, x: span.box.x + offset } };
      if (!clipsAtMargin) return { ...span, box: { ...span.box, x: span.box.x + offset } };
      const width = Math.min(span.box.width, Math.max(0, indentLeft + available - fillX));
      const aligned = { ...span, box: { ...span.box, x: fillX, width } };
      fillX += width;
      return aligned;
    });
  }

  // Trailing whitespace hangs into the margin rather than pushing the text off-centre, which
  // is what Word does and what stops a line ending in a space from looking misaligned.
  const last = spans[spans.length - 1]!;
  const visible = last.text.replace(/\s+$/, '');
  // `box.width` was reserved from the DRAWN text, so the visible part has to be measured the
  // same way: the difference is what the trailing whitespace measures, and mixing a drawn
  // total with a source-measured visible part reports nearly the whole span as whitespace.
  // Centre and right pass `lineUsedWidth` and never read this; the path that does is a
  // JUSTIFIED non-last line, where an over-reported `trailing` inflates `slack` and
  // over-stretches the line.
  const trailing =
    visible === last.text
      ? 0
      : last.box.width -
        measureDisplayText(visible, styleForFontSlot(last.style, last.fontSlot), measurer);
  const used = lineUsedWidth ?? last.box.x - indentLeft + last.box.width - trailing;
  const slack = available - used;
  if (slack <= 0) return spans;

  // The last line of a justified paragraph is set flush left, never stretched.
  if (alignment === 'both') {
    if (isLastLine) return spans;
    // Only boundaries after an expandable space receive slack — the same slots paint stretches
    // with `word-spacing`. A uniform step across every span pair invented gaps before tabs and
    // run splits and drifted every later caret by N×step.
    const gapBefore: number[] = [];
    for (let index = 1; index < spans.length; index += 1) {
      if (endsWithExpandableSpace(spans[index - 1]!.text)) gapBefore.push(index);
    }
    if (gapBefore.length === 0) return spans;
    const step = slack / gapBefore.length;
    const gapSet = new Set(gapBefore);
    let shift = 0;
    return spans.map((span, index) => {
      if (gapSet.has(index)) shift += step;
      return shift === 0 ? span : { ...span, box: { ...span.box, x: span.box.x + shift } };
    });
  }

  const offset = alignment === 'center' ? slack / 2 : slack;
  return spans.map((span) => ({ ...span, box: { ...span.box, x: span.box.x + offset } }));
}

/** Shift inline drawing boxes for paragraph alignment the same way {@link alignSpans} does. */
export function alignDrawings(
  drawings: readonly InlineDrawingRecord[],
  offset: number
): readonly InlineDrawingRecord[] {
  if (offset === 0 || drawings.length === 0) return drawings;
  return drawings.map((drawing) => shiftInlineDrawingRecord(drawing, offset, 0));
}

/**
 * Measure and break one paragraph into pending lines at `available` width.
 *
 * Verbatim behaviour of the pre-extraction main-loop body: cache hit short-circuits the
 * measurement entirely; a miss measures pieces, breaks greedily at word boundaries, and
 * stores the frozen result under `cacheKey`. Span x offsets are relative to the paragraph
 * origin (`indentLeft` from the paragraph's own properties), never to the page.
 */
export function breakParagraph(
  paragraph: OoxmlNode,
  paragraphId: string,
  indentLeft: number,
  available: number,
  measurer: TextMeasurer,
  cache: ParagraphLayoutCache<readonly PendingLine[]> | undefined,
  cacheKey: string | null,
  inheritedRunProperties: readonly OoxmlProperty[] = [],
  tabStops: ResolvedTabStops = EMPTY_TAB_STOPS,
  pageContext?: FieldPageContext,
  cascadeRuns?: RunPropertyCascader,
  flow?: ParagraphFlowOptions
): readonly PendingLine[] {
  const cached = cacheKey !== null && cache ? cache.get(cacheKey) : undefined;
  if (cached) return cached;

  const lineSpacing = flow?.lineSpacing ?? SINGLE_LINE_SPACING;
  // The first line starts `firstLineOffset` from the paragraph's left indent — right for
  // `w:firstLine`, left (negative) for `w:hanging`. Every later line starts at the indent.
  const firstLineOffset = flow?.firstLineOffset ?? 0;

  // Model ranges the caret must step over. Collected during the piece walk rather than derived
  // from the emitted spans, because in the proposed result a deletion produces no span at all
  // and its offsets would otherwise look like ordinary empty positions.
  const deletedRanges: { start: number; end: number }[] = [];
  const allPieces = piecesOfParagraph(
    paragraph,
    inheritedRunProperties,
    pageContext,
    cascadeRuns,
    flow?.projectLink,
    flow?.noteMarks,
    flow?.displayMode ?? DEFAULT_REVISION_DISPLAY_MODE,
    deletedRanges,
    flow?.inlineDrawingLayout,
    flow?.themeFonts,
    flow?.projectFieldLink,
    flow?.documentProperties,
    flow?.bodyPageFields ?? false,
    flow?.refFields,
    flow?.revisionAuthorFilter
  );
  const startOffset = Math.max(0, flow?.startOffset ?? 0);
  const pieces = allPieces.flatMap((piece): FieldAwarePiece[] => {
    if (piece.end <= startOffset) return [];
    if (piece.start >= startOffset) return [piece];
    const trim = startOffset - piece.start;
    return [
      {
        ...piece,
        text: piece.projected ? piece.text : piece.text.slice(trim),
        start: startOffset,
      },
    ];
  });
  const placeableSuffixes = placeableContentSuffixes(pieces);
  const layoutEquation = createEquationLayouter(measurer, flow?.equationCacheToken);
  const equationLayoutOf = (piece: FieldAwarePiece) =>
    piece.equation ? layoutEquation(piece.equation, piece.style) : null;
  if (pieces.length === 0 && flow?.suppressEmptyPlaceholderLine) {
    return [];
  }
  /** Carried onto every span so paint and the review surface read one attribution. */
  const revisionsOf = (
    piece: FieldAwarePiece
  ): {
    revisions?: readonly RevisionAttribution[];
    fieldAtom?: FieldAwarePiece['fieldAtom'];
  } => ({
    ...(piece.revisions === undefined ? {} : { revisions: piece.revisions }),
    // Rides the same carrier for the same reason: only the paragraph walk knows an atom was a
    // field, and by paint time its result is indistinguishable from ordinary text.
    ...(piece.fieldAtom === undefined ? {} : { fieldAtom: piece.fieldAtom }),
  });
  // Mark face (CT_PPr/rPr), not content inheritance — a taller mark grows the last line
  // without shrinking BodyText runs that only inherit the paragraph style.
  const markProps = flow?.markRunProperties ?? inheritedRunProperties;
  const emptyStyle =
    markProps.length === 0 ? DEFAULT_RUN_STYLE : resolveRunStyle(markProps, flow?.themeFonts);
  const rightEdge = indentLeft + available;
  const contentLeft = flow?.contentLeft ?? indentLeft;
  const contentRight = flow?.contentRight ?? rightEdge;
  const contentOriginX = flow?.contentOriginX ?? 0;
  const lines: PendingLine[] = [];
  let line: PendingLine = {
    spans: [],
    start: startOffset,
    end: startOffset,
    drawings: [],
    width: 0,
    height: 0,
    baseline: 0,
    leading: 0,
    trailingSpacing: 0,
  };
  const anchorLineTopByModelStart = new Map<number, number>();

  // The break-time wrap synthesis follows the published records: a drawing the display mode
  // resolves away publishes no record, so it must reserve no line top and carve no hole.
  const anchorDisplayMode = flow?.displayMode ?? DEFAULT_REVISION_DISPLAY_MODE;

  const topAndBottomAnchorStarts = (() => {
    const starts = new Set<number>();
    if (!flow?.inlineDrawingLayout) return starts;
    const offsets = drawingModelOffsetsInParagraph(paragraph);
    for (const atom of anchoredDrawingAtomsInParagraph(paragraph, flow.inlineDrawingLayout)) {
      if (!revisionsVisible(atom.revisions, anchorDisplayMode, flow?.revisionAuthorFilter))
        continue;
      if (atom.projection.wrap !== 'topAndBottom') continue;
      const modelStart = offsets.get(atom.atomId);
      if (modelStart !== undefined) starts.add(modelStart);
    }
    return starts;
  })();

  const wrapAnchorStarts = (() => {
    const starts = new Set<number>();
    if (!flow?.inlineDrawingLayout) return starts;
    const offsets = drawingModelOffsetsInParagraph(paragraph);
    for (const atom of anchoredDrawingAtomsInParagraph(paragraph, flow.inlineDrawingLayout)) {
      if (!revisionsVisible(atom.revisions, anchorDisplayMode, flow?.revisionAuthorFilter))
        continue;
      if (atom.projection.anchor?.behindDocument) continue;
      if (
        atom.projection.wrap === 'topAndBottom' ||
        atom.projection.wrap === 'inline' ||
        atom.projection.wrap === 'behind' ||
        atom.projection.wrap === 'inFront'
      ) {
        continue;
      }
      const modelStart = offsets.get(atom.atomId);
      if (modelStart !== undefined) starts.add(modelStart);
    }
    return starts;
  })();

  const sameParagraphAnchorStarts = [
    ...(flow?.pageExclusionZones ?? [])
      .filter((zone) => zone.anchorParagraphId === paragraphId)
      .map((zone) => zone.anchorModelStart),
    ...topAndBottomAnchorStarts,
    ...wrapAnchorStarts,
  ];

  const anchorLineStartByOffset = anchorLineStartsByModelOffset({
    pieces,
    measurer,
    available,
    firstLineOffset,
    anchorStarts: sameParagraphAnchorStarts,
    equationLayoutOf,
  });

  for (const start of wrapAnchorStarts) {
    const lineStart = anchorLineStartByOffset.get(start);
    if (lineStart !== undefined) anchorLineTopByModelStart.set(start, lineStart);
  }

  const zoneApplies = (zone: ExclusionZone): boolean => {
    if (zone.anchorParagraphId !== paragraphId) return true;
    const anchorLineStart = anchorLineStartByOffset.get(zone.anchorModelStart);
    if (anchorLineStart !== undefined && line.start >= anchorLineStart) return true;
    if (line.end >= zone.anchorModelStart) return true;
    return false;
  };

  const activeExclusionZones = (): readonly ExclusionZone[] => {
    const pageZones =
      flow?.pageExclusionZones?.filter((zone) => {
        if (!zoneApplies(zone)) return false;
        // Anchor paragraph uses break-time synthesis; page zones are for inherited bands only.
        if (zone.anchorParagraphId === paragraphId) {
          if (zone.input.mode === 'topAndBottom') return false;
          if (flow?.anchorCellBox != null) return false;
        }
        return true;
      }) ?? [];
    const synthesizedWrap =
      flow?.inlineDrawingLayout && flow.anchorCellBox != null && anchorLineTopByModelStart.size > 0
        ? synthesizeParagraphWrapExclusionZones({
            paragraph,
            paragraphId,
            drawingLayout: flow.inlineDrawingLayout,
            contentLeft,
            contentRight,
            paragraphStartY: flow.paragraphStartY ?? 0,
            anchorLineTopByModelStart,
            anchorCellBox: flow.anchorCellBox,
            displayMode: anchorDisplayMode,
            ...(flow.revisionAuthorFilter
              ? { revisionAuthorFilter: flow.revisionAuthorFilter }
              : {}),
          })
        : Object.freeze([]);
    const synthesized =
      flow?.inlineDrawingLayout && anchorLineTopByModelStart.size > 0
        ? synthesizeParagraphTopAndBottomZones({
            paragraph,
            paragraphId,
            drawingLayout: flow.inlineDrawingLayout,
            contentLeft,
            contentRight,
            paragraphStartY: flow?.paragraphStartY ?? 0,
            anchorLineTopByModelStart,
            displayMode: anchorDisplayMode,
            ...(flow.revisionAuthorFilter
              ? { revisionAuthorFilter: flow.revisionAuthorFilter }
              : {}),
          })
        : Object.freeze([]);
    return Object.freeze([...pageZones, ...synthesizedWrap, ...synthesized]);
  };

  // Where the line being built starts, and how much room it has. Only the first differs.
  const lineOffset = (): number => (lines.length === 0 ? firstLineOffset : 0);
  const lineOrigin = (): number => contentOriginX + indentLeft + lineOffset();
  const baseLineAvailable = (): number => Math.max(1, available - lineOffset());

  const priorLineExtent = (): number =>
    lines.reduce((sum, prior) => sum + prior.height + (prior.exclusionSkipBefore ?? 0), 0);

  const currentLineTopY = (): number => (flow?.paragraphStartY ?? 0) + priorLineExtent();

  const recordTopAndBottomAnchorLineTop = (modelStart: number): void => {
    if (topAndBottomAnchorStarts.has(modelStart)) {
      anchorLineTopByModelStart.set(modelStart, priorLineExtent());
    }
  };

  const {
    applyTopAndBottomSkipIfNeeded,
    applyNarrowWrapSkipIfNeeded,
    finalizeTopAndBottomClearance,
  } = createLineExclusionClearance({
    line: () => line,
    top: currentLineTopY,
    zones: activeExclusionZones,
    left: () => Math.max(contentLeft, lineOrigin()),
    right: contentRight,
    emptyStyle,
    measurer,
    lineSpacing,
  });

  // Where the line will actually sit. A band that pushed this line down has already been
  // recorded on it, so probing must ask about the shifted position — probing the unshifted
  // top reports the line as still inside the band it just cleared, which leaves it with no
  // room and strands its first character on a line of its own.
  const exclusionProbeY = (): number => currentLineTopY() + (line.exclusionSkipBefore ?? 0) + 0.001;

  const snapLineToAvailableInterval = (): boolean => {
    const zones = activeExclusionZones();
    if (zones.length === 0) return true;
    applyTopAndBottomSkipIfNeeded();
    const intervals = mergeAvailableIntervalsAtY(
      exclusionProbeY(),
      zones,
      contentLeft,
      contentRight
    );
    const currentX = lineOrigin() + line.width;
    const snap = snapXToAvailableInterval(currentX, intervals);
    if (!snap) return false;
    if (snap.x > currentX + 0.001) {
      line.width = snap.x - lineOrigin();
    }
    return true;
  };

  /**
   * Total capacity of the line being built, in the same units as `line.width` — how far the
   * pen may travel from `lineOrigin()`, not how much room is left from where it stands.
   *
   * Callers compare `line.width + width` against this, so it MUST stay a capacity. Returning
   * the room remaining ahead of the pen makes the test `line.width + width > remaining`, which
   * halves the usable width of every line on a page that carries any exclusion zone.
   */
  const lineAvailable = (): number => {
    const base = baseLineAvailable();
    const zones = activeExclusionZones();
    if (zones.length === 0) return base;
    applyTopAndBottomSkipIfNeeded();
    if (!snapLineToAvailableInterval()) return 0;
    const intervals = mergeAvailableIntervalsAtY(
      exclusionProbeY(),
      zones,
      contentLeft,
      contentRight
    );
    const origin = lineOrigin() + line.width;
    const remaining = remainingWidthAtX(origin, intervals);
    if (remaining <= 0.001) return 0;
    return Math.min(base, line.width + remaining);
  };

  /** Room left ahead of the pen on the current line. */
  const remainingLineWidth = (): number => Math.max(0, lineAvailable() - line.width);

  const tryAdvanceToNextPassage = (): boolean => {
    const zones = activeExclusionZones();
    if (zones.length === 0) return false;
    // A float anchored in an EARLIER paragraph has no offset in this one to be "past" — its
    // zone applies to every line here. Requiring a same-paragraph anchor left those lines
    // stranded in the first passage: they stopped at the picture's near edge and broke,
    // never resuming in the column beside it.
    const zoneIsOpen = zones.some(
      (zone) => zone.anchorParagraphId !== paragraphId || line.end > zone.anchorModelStart
    );
    if (!zoneIsOpen) return false;
    const intervals = mergeAvailableIntervalsAtY(
      exclusionProbeY(),
      zones,
      contentLeft,
      contentRight
    );
    const currentX = lineOrigin() + line.width;
    let foundCurrent = false;
    for (const interval of intervals) {
      if (!foundCurrent) {
        if (currentX >= interval.start - 0.000_001 && currentX < interval.end - 0.000_001) {
          foundCurrent = true;
        }
        continue;
      }
      if (interval.end - interval.start > 0.001) {
        line.width = interval.start - lineOrigin();
        return true;
      }
    }
    return false;
  };

  const advancePastAnchorExclusionForPlacement = (modelStart: number): void => {
    if (
      sameParagraphAnchorStarts.length === 0 ||
      modelStart < Math.min(...sameParagraphAnchorStarts)
    ) {
      return;
    }
    const zones = activeExclusionZones().filter(
      (zone) => zone.anchorParagraphId === paragraphId && modelStart >= zone.anchorModelStart
    );
    if (zones.length === 0) return;
    applyTopAndBottomSkipIfNeeded();
    const intervals = mergeAvailableIntervalsAtY(
      exclusionProbeY(),
      zones,
      contentLeft,
      contentRight
    );
    const currentX = lineOrigin() + line.width;
    let containingIndex = -1;
    for (let index = 0; index < intervals.length; index += 1) {
      const interval = intervals[index]!;
      if (currentX >= interval.start - 0.001 && currentX < interval.end - 0.001) {
        containingIndex = index;
        break;
      }
    }
    // Only move a pen standing INSIDE the picture. Skipping to the next passage whenever one
    // existed emptied the near column of a centred float: every word after the anchor hopped
    // the picture, so the space beside it took one word per line and the rest piled up on the
    // far side. Filling the near passage first, then advancing on overflow, is what Word does.
    if (containingIndex >= 0) return;
    const snap = snapXToAvailableInterval(currentX, intervals);
    if (snap && snap.x > currentX + 0.001) {
      line.width = snap.x - lineOrigin();
    }
  };

  const closeForTopAndBottomAfterAnchor = (modelStart: number): void => {
    const zones = activeExclusionZones().filter(
      (zone) =>
        zone.input.mode === 'topAndBottom' &&
        zone.anchorParagraphId === paragraphId &&
        modelStart >= zone.anchorModelStart
    );
    if (zones.length === 0) return;
    if (line.spans.length > 0 || line.drawings.length > 0) closeLine();
    applyTopAndBottomSkipIfNeeded();
  };

  const ensurePlacementWidth = (width: number, depth = 0): boolean => {
    if (depth > 64) return remainingLineWidth() >= width;
    applyTopAndBottomSkipIfNeeded();
    if (!snapLineToAvailableInterval()) {
      if (line.spans.length > 0 || line.drawings.length > 0) {
        closeLine();
        return ensurePlacementWidth(width, depth + 1);
      }
      return true;
    }
    if (width <= remainingLineWidth() + 0.001) return true;
    if (line.spans.length > 0 || line.drawings.length > 0) {
      if (tryAdvanceToNextPassage() && width <= remainingLineWidth() + 0.001) return true;
      closeLine();
      return ensurePlacementWidth(width, depth + 1);
    }
    // An EMPTY line that cannot hold the word may still have room beside the float. A picture
    // offset a few points from the margin leaves a sliver of a passage in front of it; without
    // this the word was chopped at the character to fill that sliver, one letter per line,
    // while the usable column to its right stayed empty.
    if (tryAdvanceToNextPassage()) return ensurePlacementWidth(width, depth + 1);
    // Nowhere wider left on this line — place anyway (overflow) rather than stacking blanks.
    return true;
  };

  /** The deleted ranges overlapping one line, clipped to it. */
  const deletedWithin = (start: number, end: number): ModelRange[] =>
    deletedRanges
      .filter((range) => range.start < end && range.end > start)
      .map((range) => ({ start: Math.max(range.start, start), end: Math.min(range.end, end) }));

  /**
   * Where the word currently being placed started on this line.
   *
   * A word can span RUNS — `<w:del>which</w:del><w:ins>that</w:ins>` is one word, so is
   * `<w:r><w:b/>un</w:r><w:r>breakable</w:r>` — and a run boundary is not a break opportunity.
   * Breaking there put half a word at the end of one line and half at the start of the next,
   * which no word processor does and which changed where every following line broke.
   *
   * `-1` means the line has no partial word: the next span may legally start a line.
   */
  let wordStartSpan = -1;
  let wordStartWidth = 0;
  let wordStartEnd = 0;
  /** The last character emitted, which decides whether the NEXT span may open a line. */
  let lastEmitted = '';

  const growLineMetricsForDrawing = (
    style: ResolvedRunStyle,
    measure: ReturnType<typeof measureInlineDrawing>
  ): { extentTopY: number } => {
    const textMetrics = measurer.lineMetrics(style);
    const layout = inlineDrawingVerticalLayout(
      textMetrics.baseline,
      line.height || textMetrics.height,
      measure
    );
    if (line.height === 0) {
      line.height = layout.lineHeight;
      line.baseline = layout.baseline;
    } else if (layout.lineHeight > line.height) {
      line.height = layout.lineHeight;
      line.baseline = Math.max(line.baseline, layout.baseline);
    } else {
      line.baseline = Math.max(line.baseline, layout.baseline);
    }
    return { extentTopY: layout.extentTopY };
  };

  const syncDrawingBaselinesBeforeSpacing = (): void => {
    if (line.drawings.length === 0) return;
    if (line.spans.length === 0) {
      line.baseline = Math.max(
        line.baseline,
        ...line.drawings.map((drawing) => drawing.y + drawing.height)
      );
    }
    const repositioned = repositionInlineDrawingsForBaseline(line.drawings, line.baseline);
    (line.drawings as InlineDrawingRecord[]).splice(0, line.drawings.length, ...repositioned);
    line.baseline = Math.max(
      line.baseline,
      ...line.drawings.map((drawing) => drawing.y + drawing.height)
    );
  };

  const repositionDrawingsToFinalBaseline = (): void => {
    if (line.drawings.length === 0) return;
    const repositioned = repositionInlineDrawingsForBaseline(line.drawings, line.baseline);
    (line.drawings as InlineDrawingRecord[]).splice(0, line.drawings.length, ...repositioned);
  };

  /**
   * Height of the line's text band alone — the span an `auto` multiple scales.
   *
   * Recomputed from the spans rather than tracked alongside `line.height`, because it is only
   * read on a line that also carries a drawing or equation with its own physical extent.
   */
  const textBandHeight = (fallback: number): number => {
    let height = 0;
    for (const span of line.spans) {
      height = Math.max(
        height,
        measurer.lineMetrics(styleForFontSlot(span.style, span.fontSlot)).height
      );
    }
    return height > 0 ? height : fallback;
  };

  const growLineHeightForDrawingExtent = (): void => {
    if (line.drawings.length === 0) return;
    const drawingExtent = Math.max(
      0,
      ...line.drawings.map((drawing) => drawing.y + drawing.height + drawing.distB)
    );
    line.height = Math.max(line.height, drawingExtent);
  };

  const finalizeDrawingGeometry = (): void => {
    syncDrawingBaselinesBeforeSpacing();
    growLineHeightForDrawingExtent();
  };

  /**
   * Record the jumps a float's wrap zone forced between this line's spans.
   *
   * Spans are laid contiguously as the pen advances, so at close time the ONLY horizontal
   * gaps between them are advances the pen skipped: an inline drawing's own reserved slot,
   * which paint already fills, and a wrap exclusion the line stepped over to resume in the
   * next passage. Justification has not run yet, so nothing here can be confused with slack.
   */
  const markWrapAdvances = (): void => {
    if (line.spans.length < 2) return;
    for (let index = 1; index < line.spans.length; index += 1) {
      const previous = line.spans[index - 1]!;
      const current = line.spans[index]!;
      const gap = current.box.x - (previous.box.x + previous.box.width);
      if (gap <= 0.001) continue;
      const drawingFillsGap = line.drawings.some(
        (drawing) => drawing.start >= previous.range.end && drawing.start < current.range.start
      );
      if (drawingFillsGap) continue;
      line.spans[index] = { ...current, wrapAdvanceBefore: gap };
    }
  };

  const closeLine = (options?: { readonly includeParagraphMark?: boolean }): void => {
    const metrics = measurer.lineMetrics(emptyStyle);
    // Baseline of the visible glyph band before mark / spacing. Paint's padding-top is
    // `spaced.baseline - glyphBaseline` (space above); auto extras grow BELOW instead.
    let glyphBaseline = line.baseline;
    if (line.height === 0) {
      line.height = metrics.height;
      line.baseline = metrics.baseline;
      glyphBaseline = metrics.baseline;
    } else if (options?.includeParagraphMark) {
      // Paragraph mark `w:sz` (CT_PPr/rPr) can be taller than the visible runs. Grow the
      // line box to the mark height but keep the glyph baseline — the spare depth sits
      // below the text, matching Word's cover-page party-name rhythm. Pushing the baseline
      // down (max-ascent) made "between"/"MERIDIAN" clump while inflating other gaps.
      line.height = Math.max(line.height, metrics.height);
    }
    finalizeDrawingGeometry();
    // Line spacing applies to the finished box, once, so a paragraph's rule governs every
    // line it produced regardless of which run happened to be tallest.
    const naturalHeight = line.height;
    // `auto` scales the TEXT band, not a tall inline drawing or equation. The atom remains
    // a floor, while a larger text multiple can still win (ECMA-376 17.3.1.33).
    const hasUnscaledInlineExtent =
      line.drawings.length > 0 || line.spans.some((span) => span.equation !== undefined);
    const scalesTextBandOnly = lineSpacing.rule === 'auto' && hasUnscaledInlineExtent;
    const spacingBase = scalesTextBandOnly ? textBandHeight(metrics.height) : naturalHeight;
    const spaced = applyLineSpacing(lineSpacing, spacingBase, line.baseline);
    if (!scalesTextBandOnly) line.baseline = spaced.baseline;
    // Space ABOVE the glyph band only (exact centering, not auto/atLeast). Never negative.
    line.leading = Math.max(0, line.baseline - glyphBaseline);
    line.height = scalesTextBandOnly ? Math.max(spaced.height, naturalHeight) : spaced.height;
    // Baseline shifts from line spacing must move inline drawings too, or authored distT/distB
    // and the text baseline drift apart. For `exact`, keep the authored box — tall drawings
    // clip/overflow per content-clip policy; auto/atLeast still grow to contain distB.
    repositionDrawingsToFinalBaseline();
    if (lineSpacing.rule !== 'exact') growLineHeightForDrawingExtent();
    line.trailingSpacing =
      line.drawings.length === 0 && lineSpacing.rule !== 'exact'
        ? Math.max(0, spaced.height - naturalHeight)
        : 0;
    finalizeTopAndBottomClearance();
    // Before `markWrapAdvances`, so wrap-advance marking sees the merged shape — which is
    // the shape paint gets.
    coalesceIdeographicSpans(line);
    markWrapAdvances();
    const deleted = deletedWithin(line.start, line.end);
    if (deleted.length > 0) line.deletedRanges = deleted;
    lines.push(line);
    wordStartSpan = -1;
    wordStartWidth = 0;
    line = {
      spans: [],
      drawings: [],
      start: line.end,
      end: line.end,
      width: 0,
      height: 0,
      baseline: 0,
      leading: 0,
      trailingSpacing: 0,
    };
    applyTopAndBottomSkipIfNeeded();
  };

  /** Whether the last thing placed was a line break, so the paragraph ends on a fresh line. */
  let trailingLineBreak = false;

  for (let pieceIndex = 0; pieceIndex < pieces.length; pieceIndex += 1) {
    const piece = pieces[pieceIndex]!;
    if (piece.breakKind === 'column') {
      const breakMetrics = measurer.lineMetrics(piece.style);
      line.spans.push({
        range: { paragraphId, start: piece.start, end: piece.end },
        text: piece.text,
        props: piece.props,
        style: piece.style,
        box: { x: lineOrigin() + line.width, y: 0, width: 0, height: breakMetrics.height },
        ...(piece.link ? { link: piece.link } : {}),
        ...revisionsOf(piece),
      });
      line.height = Math.max(line.height, breakMetrics.height);
      line.baseline = Math.max(line.baseline, breakMetrics.baseline);
      line.end = piece.end;
      closeLine();
      lines[lines.length - 1]!.columnBreakAfter = true;
      // Like a trailing hard break, NOT like a page break: Word still lays out the
      // paragraph's remainder after the column advance. The common authoring form
      // `<w:p><w:r><w:br w:type="column"/></w:r></w:p>` therefore opens one empty line
      // at the top of the next column before the following block — the paragraph mark
      // after the break. Suppressing that remainder put "After Column Break" flush with
      // the prior column's first line.
      trailingLineBreak = true;
      continue;
    }
    if (piece.equation) {
      const equation = equationLayoutOf(piece)!;
      const atomWidth = equation.geometry.box.width;
      const hasContent = line.spans.length > 0 || line.drawings.length > 0;
      if (hasContent && line.width + atomWidth > lineAvailable()) closeLine();
      if (!ensurePlacementWidth(atomWidth)) continue;
      const priorDescent = Math.max(0, line.height - line.baseline);
      const equationDescent = Math.max(
        0,
        equation.geometry.box.height - equation.geometry.baseline
      );
      line.baseline = Math.max(line.baseline, equation.geometry.baseline);
      line.height = line.baseline + Math.max(priorDescent, equationDescent);
      line.spans.push({
        range: { paragraphId, start: piece.start, end: piece.end },
        text: '\uFFFC',
        props: piece.props,
        style: piece.style,
        box: {
          x: lineOrigin() + line.width,
          y: 0,
          width: atomWidth,
          height: equation.geometry.box.height,
        },
        projected: true,
        equation,
        ...revisionsOf(piece),
      });
      line.width += atomWidth;
      line.end = piece.end;
      wordStartSpan = -1;
      lastEmitted = '';
      continue;
    }
    if (piece.projected && !piece.inlineDrawing && piece.text === '\uFFFC') {
      recordTopAndBottomAnchorLineTop(piece.start);
      // A tracked anchored drawing paints from the page layer and leaves no span on its
      // anchor line, so the line records the attribution itself \u2014 that is all the margin
      // change bar has to read. Gated exactly like the published record: a drawing the
      // display mode resolves away must cue no bar.
      if (
        piece.anchoredAtom &&
        piece.revisions !== undefined &&
        revisionsVisible(piece.revisions, anchorDisplayMode, flow?.revisionAuthorFilter)
      ) {
        line.anchorRevisions = [...(line.anchorRevisions ?? []), ...piece.revisions];
      }
      line.end = piece.end;
      continue;
    }
    if (piece.inlineDrawing) {
      recordTopAndBottomAnchorLineTop(piece.start);
      const measure = measureInlineDrawing(piece.inlineDrawing.projection);
      const atomWidth = measure.totalWidth;
      const hasContent = line.spans.length > 0 || line.drawings.length > 0;
      if (hasContent && line.width + atomWidth > lineAvailable()) closeLine();
      if (!ensurePlacementWidth(atomWidth)) continue;
      const { extentTopY } = growLineMetricsForDrawing(piece.style, measure);
      const slotX = lineOrigin() + line.width;
      line.drawings.push(
        buildInlineDrawingRecord({
          input: piece.inlineDrawing,
          paragraphId,
          start: piece.start,
          slotX,
          y: extentTopY,
          baseline: line.baseline,
          contentLeft: contentOriginX,
          contentRight: contentOriginX + rightEdge,
          ...(piece.revisions ? { revisions: piece.revisions } : {}),
        })
      );
      line.width += atomWidth;
      line.end = piece.end;
      wordStartSpan = -1;
      lastEmitted = '';
      continue;
    }
    if (piece.text === PAGE_BREAK_CHAR) {
      const breakMetrics = measurer.lineMetrics(piece.style);
      line.spans.push({
        range: { paragraphId, start: piece.start, end: piece.end },
        text: PAGE_BREAK_CHAR,
        props: piece.props,
        style: piece.style,
        box: { x: lineOrigin() + line.width, y: 0, width: 0, height: breakMetrics.height },
        ...(piece.link ? { link: piece.link } : {}),
        ...revisionsOf(piece),
      });
      line.height = Math.max(line.height, breakMetrics.height);
      line.baseline = Math.max(line.baseline, breakMetrics.baseline);
      line.end = piece.end;
      closeLine();
      lines[lines.length - 1]!.pageBreakAfter = true;
      // NOT `trailingLineBreak`, unlike the hard break / column break above. An empty
      // remainder publishes no line on the page the break opened: Word Online puts the
      // following block flush at the top of that page, which `paragraph-spacing-borders`
      // and `section-aware-pagination` pin against the comprehensive fixture. The caret
      // after such a break therefore has nowhere to go on the new page, which is why the
      // click that lands in the blank space beside the mark resolves BEFORE it — see
      // `hitTestSemantic`.
      trailingLineBreak = false;
      continue;
    }
    if (piece.text === '\n') {
      // A hard break ends the line without ending the paragraph — and it OCCUPIES a model
      // offset. Emitting no span for it meant the text reconstructed from the records was
      // shorter than the model: Select All stopped short and left residue, a copied break
      // came back as a space, and Delete before a trailing break merged the next paragraph
      // instead of removing the break. A zero-width span keeps the two in step.
      const breakMetrics = measurer.lineMetrics(piece.style);
      line.spans.push({
        range: { paragraphId, start: piece.start, end: piece.end },
        text: '\n',
        props: piece.props,
        style: piece.style,
        box: { x: lineOrigin() + line.width, y: 0, width: 0, height: breakMetrics.height },
        ...(piece.link ? { link: piece.link } : {}),
        ...revisionsOf(piece),
      });
      line.height = Math.max(line.height, breakMetrics.height);
      line.baseline = Math.max(line.baseline, breakMetrics.baseline);
      line.end = piece.end;
      closeLine();
      trailingLineBreak = true;
      continue;
    }
    trailingLineBreak = false;
    closeForTopAndBottomAfterAnchor(piece.start);
    if (
      sameParagraphAnchorStarts.length > 0 &&
      piece.start >= Math.min(...sameParagraphAnchorStarts)
    ) {
      advancePastAnchorExclusionForPlacement(piece.start);
    }
    // The face this piece MEASURES in. Spans keep `piece.style` — the run's real
    // resolution — plus the slot, and re-resolve through the same helper.
    const faceStyle = styleForFontSlot(piece.style, piece.fontSlot);
    const metrics = measurer.lineMetrics(faceStyle);
    // Projected PAGE/NUMPAGES digits publish the suppressed cached-result model range (or a
    // zero-width insertion point when the cache was empty) so surrounding source offsets
    // stay aligned with binding / paragraphTextOf.
    // A projected field publishes the model range it stands in for; a `w:ptab` publishes
    // its ZERO-WIDTH insertion point, because it contributes no text to the paragraph.
    // Defensive: any piece whose display length disagrees with its model range is also
    // layout-owned (inert DATE/TOC/REF/… cache before `projected` was set).
    // Layout-owned pieces get no ideographic boundaries: they are documented below as
    // staying whole, and a per-ideograph split wrapped a CJK field result mid-text with
    // every span claiming the same model range.
    const layoutOwned =
      Boolean(piece.projected) ||
      Boolean(piece.positionalTab) ||
      piece.end - piece.start !== piece.text.length;
    let consumed = 0;
    for (const boundary of wordBoundaries(piece.text, !layoutOwned)) {
      const candidate = piece.text.slice(consumed, boundary);
      if (candidate.length === 0) continue;
      const spanRange = layoutOwned
        ? { paragraphId, start: piece.start, end: piece.end }
        : { paragraphId, start: piece.start + consumed, end: piece.start + boundary };

      if (candidate === '\t') {
        // A tab that cannot advance on this line wraps first, then reapplies — matching
        // Word's "tab past the right margin starts a new line" behaviour. Unless it is
        // TRAILING: a tab with nothing placeable after it ends the line rather than
        // starting one, exactly as a trailing space does.
        if (
          (line.spans.length > 0 || line.drawings.length > 0) &&
          line.width >= lineAvailable() &&
          placeableSuffixes[pieceIndex]![boundary] === 1
        )
          closeLine();
        const currentX = lineOrigin() + line.width;
        const segment = measureFollowingTabSegment(pieces, pieceIndex, boundary, measurer);
        // A `w:ptab` states its own destination and leader, so it does NOT consult the
        // paragraph's tab stops — a table-of-contents line authored with one has none.
        // A positional tab whose destination is at or behind the caret cannot advance —
        // a left-aligned one almost never can, and it is also the fallback for a malformed
        // `w:alignment`. Falling back to the ordinary stop rule keeps the glyphs apart
        // instead of reproducing the very run-together text this element exists to prevent.
        const positional = piece.positionalTab
          ? positionalTabDestination(piece.positionalTab, indentLeft, rightEdge, flow?.marginExtent)
          : null;
        const destination =
          positional === null
            ? nextTabDestination(tabStops, currentX, rightEdge)
            : positional.positionPt > currentX
              ? positional
              : {
                  // The stop changes; the LEADER is the element's own and survives it.
                  ...nextTabDestination(tabStops, currentX, rightEdge),
                  ...(positional.leader ? { leader: positional.leader } : {}),
                };
        const width = tabAdvanceWidth(
          destination.alignment,
          currentX,
          destination.positionPt,
          segment.width,
          segment.decimalOffset
        );
        line.spans.push({
          range: spanRange,
          text: '\t',
          props: piece.props,
          style: piece.style,
          box: { x: currentX, y: 0, width, height: metrics.height },
          // The leader belongs to the stop that was REACHED, so it is resolved here with the
          // destination rather than re-derived from the paragraph at paint time — and its
          // glyph is MEASURED here too, in this run's own face, because paint has no
          // measurer and a guessed advance cannot space the dots the way typing them would.
          ...(destination.leader
            ? {
                tabLeader: destination.leader,
                tabLeaderAdvancePt: measurer.measure(
                  TAB_LEADER_GLYPH.get(destination.leader) ?? '.',
                  piece.style
                ),
              }
            : {}),
          ...(piece.link ? { link: piece.link } : {}),
          // destination rather than re-derived from the paragraph at paint time.
          ...(destination.leader ? { tabLeader: destination.leader } : {}),
          ...(layoutOwned && !piece.positionalTab ? { projected: true as const } : {}),
          ...(piece.noteNav ? { noteNav: piece.noteNav } : {}),
          ...revisionsOf(piece),
        });
        line.width += width;
        line.height = Math.max(line.height, metrics.height);
        line.baseline = Math.max(line.baseline, metrics.baseline);
        line.end = layoutOwned ? piece.end : piece.start + boundary;
        // A tab is a break opportunity, so whatever follows it may open a line. Leaving the
        // previous word recorded here made the following text a CONTINUATION of it, and an
        // overflow then took the mid-word path: the word before the tab was carried onto the
        // next line together with the tab, whose advance was re-laid unchanged and no longer
        // reached its stop — a heading split mid-phrase with its page number stranded in the
        // middle of the line.
        lastEmitted = '\t';
        consumed = boundary;
        continue;
      }

      // Measured as DRAWN: `w:caps` changes the glyphs, so measuring the source text
      // would size the line for characters the reader never sees. Note marks may reserve
      // a wider measureText (eachPage) while painting the real digits.
      const measureSource = piece.measureText ?? candidate;
      let width = measurer.measure(displayText(measureSource, faceStyle), faceStyle);
      // A candidate may open a line only at a real break opportunity — the shared
      // decision in `lineOpenDecisionAt`, which the anchor-line probe above consumes too.
      const openDecision = lineOpenDecisionAt(lastEmitted, candidate, consumed > 0);
      const opensWord = openDecision === 'opens';
      if (opensWord) {
        wordStartSpan = line.spans.length;
        wordStartWidth = line.width;
        wordStartEnd = line.end;
      }
      advancePastAnchorExclusionForPlacement(piece.start + consumed);
      applyNarrowWrapSkipIfNeeded(candidate, faceStyle);
      // Trailing fill spaces occupy the remaining band but never open continuation lines.
      const lineEndWhitespace =
        isCollapsibleLineEndWhitespace(candidate) && placeableSuffixes[pieceIndex]![boundary] !== 1;
      if (lineEndWhitespace) {
        width = Math.min(width, Math.max(0, lineAvailable() - line.width));
      }
      if (
        line.width + width > lineAvailable() + OVERFLOW_TOLERANCE_PT &&
        (line.spans.length > 0 || line.drawings.length > 0)
      ) {
        if (openDecision === 'forbidden' && wordStartSpan <= 0) {
          // The group starts this line and a rule forbids opening before it: a kinsoku seam,
          // or one inside a grapheme cluster split across pieces. There is nothing to carry
          // down, and chopping is the very break the rule forbids, so it is pushed out past
          // the measure — Word's kinsoku push-out, and what the chop below reaches by itself
          // when no accepted cut is left. `wordBoundaries` already cut at the next legal seam
          // inside the piece, so what overflows is one protected group, not the clause.
        } else if (!opensWord && wordStartSpan === 0) {
          // Prefer a later float passage; otherwise fill this one's remainder in the chop below.
          tryAdvanceToNextPassage();
        } else if (opensWord || wordStartSpan < 0) {
          if (tryAdvanceToNextPassage() && line.width + width <= lineAvailable() + 0.001) {
            // carry on in the next horizontal passage on this line
          } else {
            closeLine();
            if (!ensurePlacementWidth(width)) continue;
            wordStartSpan = 0;
            wordStartWidth = 0;
            wordStartEnd = line.end;
          }
        } else {
          // Mid-word overflow: carry the whole word to the next line rather than splitting it
          // at a run boundary. The spans already placed for it are lifted off this line, the
          // line is closed without them, and they are re-laid at the new origin.
          const carried = line.spans.splice(wordStartSpan);
          line.width = wordStartWidth;
          line.end = wordStartEnd;
          line.height = 0;
          line.baseline = 0;
          for (const span of line.spans) {
            const spanMetrics = measurer.lineMetrics(styleForFontSlot(span.style, span.fontSlot));
            line.height = Math.max(line.height, spanMetrics.height);
            line.baseline = Math.max(line.baseline, spanMetrics.baseline);
          }
          closeLine();
          for (const span of carried) {
            const spanMetrics = measurer.lineMetrics(styleForFontSlot(span.style, span.fontSlot));
            line.spans.push({
              ...span,
              box: { ...span.box, x: lineOrigin() + line.width },
            });
            line.width += span.box.width;
            line.height = Math.max(line.height, spanMetrics.height);
            line.baseline = Math.max(line.baseline, spanMetrics.baseline);
            line.end = span.range.end;
          }
          wordStartSpan = 0;
          wordStartWidth = 0;
        }
      } else if (
        line.spans.length === 0 &&
        line.drawings.length === 0 &&
        width > lineAvailable() + 0.001
      ) {
        if (!ensurePlacementWidth(width)) continue;
      }
      // Layout-owned and measureText pieces have ranges or widths that cannot be sliced.
      let remaining = candidate;
      let remainingStart = piece.start + consumed;
      let remainingWidth = width;
      const canChopWord = !layoutOwned && piece.measureText === undefined;
      if (
        canChopWord &&
        (line.spans.length === 0 ||
          (!opensWord && wordStartSpan === 0 && openDecision !== 'forbidden')) &&
        width > remainingLineWidth() + OVERFLOW_TOLERANCE_PT
      ) {
        const chopped = chopOversizedWord(candidate, remainingStart, width, {
          remainingLineWidth,
          lineHasText: () => line.spans.length > 0,
          measureText: (text) => measurer.measure(displayText(text, faceStyle), faceStyle),
          appendPrefix: (prefix) => {
            line.spans.push({
              range: {
                paragraphId,
                start: prefix.modelStart,
                end: prefix.modelStart + prefix.text.length,
              },
              text: prefix.text,
              props: piece.props,
              style: piece.style,
              box: {
                x: lineOrigin() + line.width,
                y: 0,
                width: prefix.width,
                height: metrics.height,
              },
              ...(piece.link ? { link: piece.link } : {}),
              ...(piece.noteNav ? { noteNav: piece.noteNav } : {}),
              ...(piece.fontSlot ? { fontSlot: piece.fontSlot } : {}),
              ...revisionsOf(piece),
            });
            line.width += prefix.width;
            line.height = Math.max(line.height, metrics.height);
            line.baseline = Math.max(line.baseline, metrics.baseline);
            line.end = prefix.modelStart + prefix.text.length;
          },
          closeLine,
          overflowTolerancePt: OVERFLOW_TOLERANCE_PT,
          // The measured fit knows nothing about kinsoku: at a one-character measure
          // 天。地。人。 chopped every other line onto a leading 。.
          cutAllowedAt: cjkChopCutAllowedAt,
        });
        remaining = chopped.text;
        remainingStart = chopped.modelStart;
        remainingWidth = chopped.width;
        if (chopped.brokeLine) {
          wordStartSpan = 0;
          wordStartWidth = 0;
          wordStartEnd = line.end;
        }
      }
      // A kinsoku push-out can consume the whole candidate (天。 at a one-character measure):
      // the chop emitted it as one overflowing line and left nothing for this placement.
      if (remaining.length > 0) {
        line.spans.push({
          range: layoutOwned
            ? spanRange
            : { paragraphId, start: remainingStart, end: piece.start + boundary },
          text: remaining,
          props: piece.props,
          style: piece.style,
          box: {
            x: lineOrigin() + line.width,
            y: 0,
            width: remainingWidth,
            height: metrics.height,
          },
          ...(piece.link ? { link: piece.link } : {}),
          ...(layoutOwned && !piece.positionalTab ? { projected: true as const } : {}),
          ...(piece.noteNav ? { noteNav: piece.noteNav } : {}),
          ...(piece.fontSlot ? { fontSlot: piece.fontSlot } : {}),
          ...(lineEndWhitespace ? { lineEndWhitespace: true as const } : {}),
          ...revisionsOf(piece),
        });
        line.width += remainingWidth;
        line.height = Math.max(line.height, metrics.height);
        line.baseline = Math.max(line.baseline, metrics.baseline);
        line.end = layoutOwned ? piece.end : piece.start + boundary;
      }
      lastEmitted = candidate;
      consumed = boundary;
    }
  }
  // An empty paragraph still occupies one line, or it would have no caret target. So does
  // the line a TRAILING hard break opens: Shift+Enter at the end of a paragraph moves the
  // caret onto a new, empty line in Word, and without this the break closed the only line
  // there was and left nothing after it — the caret fell back to the end of the line the
  // break had just terminated, sitting a break's width to the right of the last glyph,
  // and the new line only appeared once something was typed into it.
  // Only this final close includes the paragraph mark: intermediate wraps must not inherit
  // a tall mark size onto every line of a multi-line paragraph.
  if (line.spans.length > 0 || line.drawings.length > 0 || lines.length === 0 || trailingLineBreak)
    closeLine({ includeParagraphMark: true });
  if (cacheKey !== null && cache)
    cache.set(cacheKey, cache.retainAcrossPasses === false ? lines : lines.map(frozenLine));
  return lines;
}
