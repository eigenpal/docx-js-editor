// The broken-but-unplaced line: the record breakParagraph accumulates and pagination
// budgets, before placement publishes a LineRecord from it. Extracted from paragraph-flow
// so the flow module stays under its line budget; paragraph-flow re-exports everything here.

import { isIdeographicForLineBreak, lastCodePointOf } from './cjk-line-break.ts';
import type { RevisionAttribution } from './revision-projection.ts';
import type { StyleSpanRecord } from './semantic-records.ts';
import type { InlineDrawingRecord } from './drawing-layout.ts';
import { topAndBottomSkipBeforeLine, type ExclusionZone } from './drawing-exclusion.ts';
import type { ModelRange } from './field-pieces.ts';

export interface PendingLine {
  readonly spans: StyleSpanRecord[];
  readonly drawings: InlineDrawingRecord[];
  readonly start: number;
  end: number;
  width: number;
  height: number;
  baseline: number;
  /**
   * Space ABOVE the glyph band inside {@link height}.
   *
   * Exact spacing can center the glyphs and move the baseline. Auto/atLeast spacing leaves
   * this at zero and puts its extra depth below instead.
   */
  leading: number;
  /**
   * Auto/atLeast line-spacing depth below the painted glyph band.
   *
   * Word lets this external depth cross the bottom text margin when the glyphs themselves
   * still fit. Pagination therefore budgets {@link height} minus this amount at a page
   * bottom, while paint keeps the full box and padding.
   */
  trailingSpacing: number;
  /** When true, layout must start a new page after this line is placed. */
  pageBreakAfter?: boolean;
  /** When true, layout must advance to the next authored section column. */
  columnBreakAfter?: boolean;
  /** Model ranges on this line covering deleted content; see {@link LineRecord.deletedRanges}. */
  deletedRanges?: readonly ModelRange[];
  /** Vertical gap inserted before this line to clear a drawing exclusion band. */
  exclusionSkipBefore?: number;
  /** Tracked anchored-drawing attributions on this line; see {@link LineRecord.anchorRevisions}. */
  anchorRevisions?: readonly RevisionAttribution[];
}

/**
 * Every {@link StyleSpanRecord} field outside range, text and box, as a checked record:
 * a new field fails to compile here until it is added (blocking the merge below when it
 * differs) or consciously exempted beside range/text/box in the `Exclude`.
 */
const SPAN_DECORATIONS: Record<Exclude<keyof StyleSpanRecord, 'range' | 'text' | 'box'>, true> = {
  props: true,
  style: true,
  fontSlot: true,
  caretEdges: true,
  tabLeader: true,
  tabLeaderAdvancePt: true,
  link: true,
  wrapAdvanceBefore: true,
  revisions: true,
  fieldAtom: true,
  projected: true,
  equation: true,
  noteNav: true,
  lineEndWhitespace: true,
};

const SPAN_DECORATION_KEYS = Object.keys(SPAN_DECORATIONS) as readonly (keyof StyleSpanRecord)[];

/**
 * Everything outside a span's range, text and box, compared by reference.
 *
 * Two spans that share every decoration share the objects, because they come from one run's
 * one resolution — placement passes `piece.revisions`, `piece.link` and the rest through
 * without copying. Reference equality is therefore the exact test; the span-count tests in
 * `cjk-line-breaking.test.ts` pin a revised and a linked run so a future defensive copy on
 * that path cannot silently return CJK to one span per ideograph.
 */
function decorationsMatch(previous: StyleSpanRecord, current: StyleSpanRecord): boolean {
  for (const key of SPAN_DECORATION_KEYS) {
    if (previous[key] !== current[key]) return false;
  }
  return true;
}

/** Whether one ideographic seam between two closed spans carries no information. */
function seamIsMergeable(previous: StyleSpanRecord, current: StyleSpanRecord): boolean {
  // `caretEdges` is measured against a span's own text, so a merge would invalidate it.
  // Placement attaches it AFTER this runs; the guard keeps that ordering from being load-bearing.
  if (previous.caretEdges !== undefined || current.caretEdges !== undefined) return false;
  const before = lastCodePointOf(previous.text);
  const after = current.text.codePointAt(0);
  if (before === undefined || after === undefined) return false;
  if (!isIdeographicForLineBreak(before) || !isIdeographicForLineBreak(after)) return false;
  if (previous.range.paragraphId !== current.range.paragraphId) return false;
  if (previous.range.end !== current.range.start) return false;
  if (Math.abs(previous.box.x + previous.box.width - current.box.x) > 0.01) return false;
  if (previous.box.height !== current.box.height) return false;
  return decorationsMatch(previous, current);
}

/**
 * Merge a closed line's ideographic span seams back into one span per style run.
 *
 * Ideographic word boundaries make every character a placement candidate, so the placement
 * loop emits one span per ideograph. The break decisions are right, but a clause that used
 * to paint as a single span now paints and hit-tests as dozens. Once the line is closed
 * those seams carry no information, so they merge back.
 *
 * Latin word seams are deliberately left alone: their trailing spaces are where
 * justification stretches, and their span shape predates ideographic breaking.
 */
export function coalesceIdeographicSpans(line: PendingLine): void {
  if (line.spans.length < 2) return;
  const merged: StyleSpanRecord[] = [];
  for (let index = 0; index < line.spans.length; ) {
    // Scan the whole mergeable group first, then build ONE span from it — merging into a
    // growing accumulator re-copied every seam, an O(m²) cost per group. Adjacent-pair
    // seams test the same conditions the accumulator did: the decoration and height
    // checks are transitive, and the x-abutment check against the true neighbour is
    // tighter than against an accumulated width.
    let groupEnd = index;
    while (
      groupEnd + 1 < line.spans.length &&
      seamIsMergeable(line.spans[groupEnd]!, line.spans[groupEnd + 1]!)
    ) {
      groupEnd += 1;
    }
    const first = line.spans[index]!;
    if (groupEnd === index) {
      merged.push(first);
      index += 1;
      continue;
    }
    const parts: string[] = [];
    // The merged width is the SUM of the per-ideograph advances the line was broken and
    // justified against, not a re-measure of the joined text: paint must fill exactly the
    // box the line reserved, and a face that kerned across ideograph seams would make the
    // two disagree. CJK faces advance ideographs uniformly, so the sum is also the shape.
    let width = 0;
    for (let cursor = index; cursor <= groupEnd; cursor += 1) {
      parts.push(line.spans[cursor]!.text);
      width += line.spans[cursor]!.box.width;
    }
    merged.push({
      ...first,
      range: { ...first.range, end: line.spans[groupEnd]!.range.end },
      text: parts.join(''),
      box: { ...first.box, width },
    });
    index = groupEnd + 1;
  }
  if (merged.length === line.spans.length) return;
  line.spans.length = 0;
  for (const span of merged) line.spans.push(span);
}

/** Vertical extent of a pending line for flow/pagination budget checks (skip + box + optional tail). */
export function pendingLineFlowExtent(
  line: Pick<PendingLine, 'height' | 'trailingSpacing' | 'exclusionSkipBefore'>,
  tail = 0
): number {
  return (line.exclusionSkipBefore ?? 0) + Math.max(0, line.height - line.trailingSpacing) + tail;
}

/** Recompute topAndBottom skip at placement time from live page zones and absolute line top. */
export function pendingLineFlowExtentAtPlacement(
  lineTopY: number,
  line: Pick<PendingLine, 'height' | 'trailingSpacing' | 'exclusionSkipBefore'>,
  zones: readonly ExclusionZone[],
  tail = 0
): number {
  const skip = Math.max(
    zones.length > 0 ? topAndBottomSkipBeforeLine(lineTopY, line.height, zones) : 0,
    line.exclusionSkipBefore ?? 0
  );
  return skip + Math.max(0, line.height - line.trailingSpacing) + tail;
}

/**
 * A cached line, safe to hand back on every later hit.
 *
 * Placement copies span boxes rather than mutating them, but a cache entry outlives the
 * layout that produced it — freezing means a future change to the placement path cannot
 * quietly corrupt every subsequent reuse.
 */
export function frozenLine(line: PendingLine): PendingLine {
  return Object.freeze({
    spans: line.spans.map((span) =>
      Object.freeze({ ...span, box: Object.freeze({ ...span.box }) })
    ),
    drawings: line.drawings.map((drawing) =>
      Object.freeze({
        ...drawing,
        paintBounds: Object.freeze({ ...drawing.paintBounds }),
        hitBounds: Object.freeze({ ...drawing.hitBounds }),
      })
    ),
    start: line.start,
    end: line.end,
    width: line.width,
    height: line.height,
    baseline: line.baseline,
    leading: line.leading,
    trailingSpacing: line.trailingSpacing,
    ...(line.pageBreakAfter ? { pageBreakAfter: true } : {}),
    ...(line.columnBreakAfter ? { columnBreakAfter: true } : {}),
    ...(line.deletedRanges ? { deletedRanges: Object.freeze(line.deletedRanges) } : {}),
    ...(line.exclusionSkipBefore ? { exclusionSkipBefore: line.exclusionSkipBefore } : {}),
    ...(line.anchorRevisions ? { anchorRevisions: Object.freeze(line.anchorRevisions) } : {}),
  }) as PendingLine;
}
