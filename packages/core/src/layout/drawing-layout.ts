// Inline drawing measurement and placement (typed-drawings-and-images task 6).
//
// DOM-free points everywhere. `wp:extent` EMUs convert at this boundary; intrinsic pixel
// dimensions never resize layout. Paint and hit testing consume the published records only.

import type {
  DrawingAccessibility,
  DrawingHorizontalReferenceFrame,
  DrawingProjection,
  DrawingTransform,
  DrawingVerticalReferenceFrame,
  ImageWrapTarget,
  SourceCrop,
  VectorShapeProjection,
} from '../store/package/drawing-projection.ts';
import {
  drawingAccessibility,
  isRunLevelMcAlternateContent,
} from '../store/package/drawing-projection.ts';
import type { OoxmlNode, OoxmlParagraphNode } from '../store/package/ooxml-tree.ts';
import { paragraphOffsetIndex } from '../store/store/tree-op-segments.ts';
import { pageClipRegion } from './drawing-page-clip.ts';
export { pageClipRegion } from './drawing-page-clip.ts';
import type { ImageResourceState } from '../store/package/image-resources.ts';
import {
  DEFAULT_REVISION_DISPLAY_MODE,
  NO_REVISIONS,
  isRevisionWrapper,
  projectedRevisions,
  revisionAttributionOf,
  withRevision,
  type RevisionAttribution,
  type RevisionAuthorFilter,
  type RevisionDisplayMode,
} from './revision-projection.ts';
import { walkDrawingAtoms, walkDrawingRunContent } from './drawing-inline-walk.ts';
import { measureDisplayText } from './run-style.ts';
import { styleForFontSlot } from './script-itemization.ts';
import {
  drawingGeometryFromProjection,
  clipGeometryToRegion,
  type DrawingGeometry,
} from './drawing-geometry.ts';
import type { LayoutBox } from './semantic-records.ts';

export type { DrawingGeometry } from './drawing-geometry.ts';

// A Map, not an object literal: the key is a `graphicData@uri` out of the file, so a value
// of `__proto__` or `constructor` must answer undefined, not a prototype member.
const GRAPHIC_URI_KIND: ReadonlyMap<string, string> = new Map([
  ['http://schemas.openxmlformats.org/drawingml/2006/chart', 'chart'],
  ['http://schemas.openxmlformats.org/drawingml/2006/diagram', 'diagram'],
  ['http://schemas.microsoft.com/office/word/2010/wordprocessingGroup', 'group'],
  ['http://schemas.microsoft.com/office/word/2010/wordprocessingShape', 'textbox'],
  ['http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas', 'canvas'],
]);

const EMPTY_TRANSFORM: DrawingTransform = Object.freeze({
  rotationDegrees: 0,
  flipHorizontal: false,
  flipVertical: false,
  offsetEmu: Object.freeze({ x: 0, y: 0 }),
  extentEmu: Object.freeze({ cx: 0, cy: 0 }),
});

const EMPTY_CROP: SourceCrop = Object.freeze({ left: 0, top: 0, right: 0, bottom: 0 });

function drawingPaintFields(projection: DrawingProjection): {
  readonly hyperlinkHref: string | null;
  readonly effects: DrawingProjection['effects'];
  readonly crop: SourceCrop;
  readonly transform: DrawingTransform;
  readonly placeholderGraphicKind: string | null;
  readonly vectorShape: VectorShapeProjection | null;
} {
  const picture = projection.picture;
  let placeholderGraphicKind: string | null = null;
  if (!picture) {
    for (const diagnostic of projection.diagnostics) {
      if (diagnostic.code !== 'unsupported-graphic') continue;
      const uri = diagnostic.detail ?? '';
      placeholderGraphicKind = GRAPHIC_URI_KIND.get(uri) ?? 'graphic';
      break;
    }
    if (placeholderGraphicKind === null) placeholderGraphicKind = 'graphic';
  }
  return Object.freeze({
    hyperlinkHref: projection.hyperlinkHref,
    effects: projection.effects,
    crop: picture?.crop ?? EMPTY_CROP,
    transform: picture?.transform ?? EMPTY_TRANSFORM,
    placeholderGraphicKind: picture ? null : placeholderGraphicKind,
    vectorShape: projection.vectorShape,
  });
}

/** EMUs per point (914400 EMU = 72pt = 1in). */
export const EMU_PER_POINT = 12_700;

export function emuToPoints(emu: number): number {
  return emu / EMU_PER_POINT;
}

/** Convert EMU to layout points; returns null when the result is non-finite or unusably large. */
export function emuToPointsSafe(emu: number): number | null {
  if (!Number.isFinite(emu)) return null;
  if (Math.abs(emu) > 10_000 * EMU_PER_POINT * 72) return null;
  const points = emu / EMU_PER_POINT;
  return Number.isFinite(points) ? points : null;
}

export interface InlineDrawingMeasure {
  readonly distL: number;
  readonly distR: number;
  readonly distT: number;
  readonly distB: number;
  readonly effectL: number;
  readonly effectR: number;
  readonly effectT: number;
  readonly effectB: number;
  readonly width: number;
  readonly height: number;
  /** Horizontal advance on the line: distL + effectL + width + effectR + distR. */
  readonly totalWidth: number;
  /** Vertical contribution: distT + effectT + height + effectB + distB. */
  readonly lineContribution: number;
}

export function measureInlineDrawing(projection: DrawingProjection): InlineDrawingMeasure {
  const distL = emuToPoints(projection.inlineDistancesEmu.left);
  const distR = emuToPoints(projection.inlineDistancesEmu.right);
  const distT = emuToPoints(projection.inlineDistancesEmu.top);
  const distB = emuToPoints(projection.inlineDistancesEmu.bottom);
  const effectL = emuToPoints(projection.effectExtentEmu.left);
  const effectR = emuToPoints(projection.effectExtentEmu.right);
  const effectT = emuToPoints(projection.effectExtentEmu.top);
  const effectB = emuToPoints(projection.effectExtentEmu.bottom);
  const width = emuToPoints(projection.extentEmu.cx);
  const height = emuToPoints(projection.extentEmu.cy);
  return Object.freeze({
    distL,
    distR,
    distT,
    distB,
    effectL,
    effectR,
    effectT,
    effectB,
    width,
    height,
    totalWidth: distL + effectL + width + effectR + distR,
    lineContribution: distT + effectT + height + effectB + distB,
  });
}

export interface InlineDrawingVerticalLayout {
  /** Top of the extent box relative to the line top. */
  readonly extentTopY: number;
  /** Total line box height once for this drawing contribution. */
  readonly lineHeight: number;
  /** Text baseline within the line box — never double-counts distT. */
  readonly baseline: number;
}

/**
 * Position an inline drawing against a text baseline without double-counting distT.
 *
 * The line box is `max(textLineHeight, extentTopY + height + distB)` where extentTopY is
 * `max(distT, baseline - height)` so distT is minimum clearance above the extent, not added
 * again to line height.
 */
export function inlineDrawingVerticalLayout(
  textBaseline: number,
  textLineHeight: number,
  measure: InlineDrawingMeasure
): InlineDrawingVerticalLayout {
  const extentTopY = Math.max(measure.distT + measure.effectT, textBaseline - measure.height);
  const lineHeight = Math.max(
    textLineHeight,
    extentTopY - measure.effectT + measure.height + measure.effectB + measure.distB
  );
  const drawingBottom = extentTopY + measure.height + measure.effectB;
  return Object.freeze({
    extentTopY,
    lineHeight,
    baseline: Math.max(textBaseline, drawingBottom),
  });
}

/** @deprecated Prefer {@link inlineDrawingVerticalLayout}. */
export function inlineDrawingTopY(baseline: number, measure: InlineDrawingMeasure): number {
  return inlineDrawingVerticalLayout(baseline, measure.lineContribution, measure).extentTopY;
}

function shiftGeometry(geometry: DrawingGeometry, dx: number, dy: number): DrawingGeometry {
  if (Math.abs(dx) < 0.000_1 && Math.abs(dy) < 0.000_1) return geometry;
  const shiftBox = (box: LayoutBox): LayoutBox =>
    Object.freeze({ ...box, x: box.x + dx, y: box.y + dy });
  const shiftPoint = (point: { readonly x: number; readonly y: number }) =>
    Object.freeze({ x: point.x + dx, y: point.y + dy });
  return Object.freeze({
    ...geometry,
    contentBounds: shiftBox(geometry.contentBounds),
    paintBounds: shiftBox(geometry.paintBounds),
    hitBounds: shiftBox(geometry.hitBounds),
    transformedCorners: Object.freeze(geometry.transformedCorners.map(shiftPoint)),
    clipPolygon: geometry.clipPolygon ? Object.freeze(geometry.clipPolygon.map(shiftPoint)) : null,
  });
}

/**
 * Translate a placed inline drawing rigidly by (dx, dy) — record origin, advance, paint/hit
 * boxes AND geometry move together. Paint derives the image frame and clip-path from
 * `geometry` relative to `paintBounds`, so shifting one without the other clips the image
 * out of its own box.
 */
export function shiftInlineDrawingRecord(
  drawing: InlineDrawingRecord,
  dx: number,
  dy: number
): InlineDrawingRecord {
  if (Math.abs(dx) < 0.000_1 && Math.abs(dy) < 0.000_1) return drawing;
  return Object.freeze({
    ...drawing,
    x: drawing.x + dx,
    y: drawing.y + dy,
    advanceStart: drawing.advanceStart + dx,
    advanceEnd: drawing.advanceEnd + dx,
    paintBounds: Object.freeze({
      ...drawing.paintBounds,
      x: drawing.paintBounds.x + dx,
      y: drawing.paintBounds.y + dy,
    }),
    hitBounds: Object.freeze({
      ...drawing.hitBounds,
      x: drawing.hitBounds.x + dx,
      y: drawing.hitBounds.y + dy,
    }),
    geometry: shiftGeometry(drawing.geometry, dx, dy),
  });
}

export function repositionInlineDrawingsForBaseline(
  drawings: readonly InlineDrawingRecord[],
  baseline: number
): readonly InlineDrawingRecord[] {
  if (drawings.length === 0) return drawings;
  return drawings.map((drawing) => {
    const effectB = drawing.geometry.effectInsets.bottom;
    const extentTopY = baseline - drawing.height - effectB;
    const dy = extentTopY - drawing.y;
    if (Math.abs(dy) < 0.000_1 && drawing.baselineOffset === baseline) return drawing;
    return Object.freeze({
      ...drawing,
      y: extentTopY,
      baselineOffset: baseline,
      geometry: shiftGeometry(drawing.geometry, 0, dy),
      paintBounds: Object.freeze({ ...drawing.paintBounds, y: drawing.paintBounds.y + dy }),
      hitBounds: Object.freeze({ ...drawing.hitBounds, y: drawing.hitBounds.y + dy }),
    });
  });
}

/** Clip `box` to a horizontal content band; preserves authored size, zeroes clipped axes. */
export function clipBoxHorizontally(
  box: LayoutBox,
  contentLeft: number,
  contentRight: number
): LayoutBox {
  const left = Math.max(box.x, contentLeft);
  const right = Math.min(box.x + box.width, contentRight);
  if (right <= left) {
    return Object.freeze({ x: left, y: box.y, width: 0, height: box.height });
  }
  return Object.freeze({
    x: left,
    y: box.y,
    width: right - left,
    height: box.height,
  });
}

/** Clip `box` to a rectangular region on both axes. */
export function clipBoxToRegion(box: LayoutBox, region: LayoutBox): LayoutBox {
  const x = Math.max(box.x, region.x);
  const y = Math.max(box.y, region.y);
  const right = Math.min(box.x + box.width, region.x + region.width);
  const bottom = Math.min(box.y + box.height, region.y + region.height);
  if (right <= x || bottom <= y) {
    return Object.freeze({ x, y, width: 0, height: 0 });
  }
  return Object.freeze({ x, y, width: right - x, height: bottom - y });
}

export interface InlineDrawingRecord {
  readonly kind: 'inlineDrawing';
  readonly drawingNodeId: string;
  readonly paragraphId: string;
  readonly ownerPartName: string;
  readonly start: number;
  /** Left edge of the extent box (slot + distL). */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly distL: number;
  readonly distR: number;
  readonly distT: number;
  readonly distB: number;
  /** Caret/hit advance start (slot left, before distL). */
  readonly advanceStart: number;
  /** Caret/hit advance end (slot + totalWidth). */
  readonly advanceEnd: number;
  readonly baselineOffset: number;
  readonly paintBounds: LayoutBox;
  readonly hitBounds: LayoutBox;
  readonly geometry: DrawingGeometry;
  readonly resource: ImageResourceState;
  readonly accessibility: DrawingAccessibility;
  /** Sanitized external hyperlink projection; inert until an explicit gesture activates it. */
  readonly hyperlinkHref: string | null;
  readonly effects: DrawingProjection['effects'];
  readonly crop: SourceCrop;
  readonly transform: DrawingTransform;
  /** Fixed non-picture graphic kind for refusal labels (`chart`, `group`, …); null for pictures. */
  readonly placeholderGraphicKind: string | null;
  /** Typed solid-geometry payload for a renderable `wps:wsp` shape; null otherwise. */
  readonly vectorShape: VectorShapeProjection | null;
  /**
   * The revision wrappers enclosing the owning run, outermost first — the same stack spans
   * carry, so paint and review chrome give a tracked picture the same cues as tracked text.
   * Absent when the drawing is untracked.
   */
  readonly revisions?: readonly RevisionAttribution[];
}

export type LineLayoutAtom =
  | {
      readonly kind: 'text';
      readonly start: number;
      readonly end: number;
      readonly width: number;
      readonly height: number;
    }
  | {
      readonly kind: 'inlineDrawing';
      readonly start: number;
      readonly width: number;
      readonly height: number;
      readonly drawingNodeId: string;
    };

/** Merge spans and inline drawings on one line into reading-order atoms for tests. */
export function lineLayoutAtoms(
  line: Readonly<{
    readonly range: { readonly start: number; readonly end: number };
    readonly spans: readonly {
      readonly range: { readonly start: number; readonly end: number };
      readonly box: LayoutBox;
    }[];
    readonly drawings?: readonly InlineDrawingRecord[];
  }>
): readonly LineLayoutAtom[] {
  const atoms: LineLayoutAtom[] = [];
  for (const span of line.spans) {
    if (span.range.end <= span.range.start) continue;
    atoms.push({
      kind: 'text',
      start: span.range.start,
      end: span.range.end,
      width: span.box.width,
      height: span.box.height,
    });
  }
  for (const drawing of line.drawings ?? []) {
    atoms.push({
      kind: 'inlineDrawing',
      start: drawing.start,
      width: drawing.width,
      height: drawing.height,
      drawingNodeId: drawing.drawingNodeId,
    });
  }
  atoms.sort((left, right) => left.start - right.start || (left.kind === 'text' ? -1 : 1));
  return Object.freeze(atoms);
}

export interface InlineDrawingLayoutInput {
  readonly drawingNodeId: string;
  readonly ownerPartName: string;
  readonly projection: DrawingProjection;
  readonly resource: ImageResourceState;
}

export interface InlineDrawingLayoutContext {
  readonly ownerPartName: string;
  /** Precomputed run-level atom id (`w:drawing` or MC wrapper) → projection. */
  readonly projectionForAtom?: (atomNodeId: string) => DrawingProjection | null;
  readonly project: (
    drawing: import('../store/package/ooxml-tree.ts').OoxmlDrawingNode
  ) => DrawingProjection | null;
  readonly resourceOf: (projection: DrawingProjection) => ImageResourceState;
}

export function clipInlineDrawingRecordVertically(
  drawing: InlineDrawingRecord,
  regionTop: number,
  regionBottom: number
): InlineDrawingRecord {
  return clipInlineDrawingRecordToRegion(
    drawing,
    Object.freeze({
      x: drawing.x,
      y: regionTop,
      width: drawing.width,
      height: Math.max(0, regionBottom - regionTop),
    })
  );
}

/** Clip paint/hit to `region` on both axes; authored `width`/`height` stay unchanged. */
export function clipInlineDrawingRecordToRegion(
  drawing: InlineDrawingRecord,
  region: LayoutBox
): InlineDrawingRecord {
  const paintBounds = clipBoxToRegion(drawing.paintBounds, region);
  const hitBounds =
    paintBounds.width > 0 && paintBounds.height > 0
      ? paintBounds
      : Object.freeze({ ...paintBounds });
  const dx = drawing.x - drawing.geometry.contentBounds.x;
  const dy = drawing.y - drawing.geometry.contentBounds.y;
  const shiftedGeometry = shiftGeometry(drawing.geometry, dx, dy);
  return Object.freeze({
    ...drawing,
    paintBounds,
    hitBounds,
    geometry: clipGeometryToRegion(shiftedGeometry, region),
  });
}

export type DrawingAnchorStoryKind = 'body' | 'header' | 'footer' | 'footnote' | 'endnote';

/** Named fallback when a positioning frame cannot be resolved (OpenSpec 4.6). */
export type AnchoredDrawingLayoutFallback = 'unresolvable-frame' | 'page-defer-exhausted';

const HORIZONTAL_FRAMES: ReadonlySet<string> = new Set([
  'character',
  'column',
  'insideMargin',
  'leftMargin',
  'margin',
  'outsideMargin',
  'page',
  'rightMargin',
]);

const VERTICAL_FRAMES: ReadonlySet<string> = new Set([
  'bottomMargin',
  'insideMargin',
  'line',
  'margin',
  'outsideMargin',
  'page',
  'paragraph',
  'topMargin',
]);

export interface DrawingAnchorFrameContext {
  readonly pageNumber: number;
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly marginLeft: number;
  readonly marginRight: number;
  /**
   * Authored `w:pgMar` bottom. The ONLY reader is the `bottomMargin` frame, whose origin is
   * the top edge of the bottom margin band — a page-setup landmark, so a footer taller than
   * that margin must not move it. The `topMargin` band needs no twin: its top edge is the
   * sheet edge, which {@link DrawingAnchorFrameContext.contentInsetTop} already gives.
   */
  readonly marginBottom: number;
  /**
   * Distance from the frame origin (the body content box top) up to the sheet top, and from
   * the content box bottom down to the sheet bottom. NOT the authored `w:pgMar` values: a
   * header taller than the top margin pushes the body content box down, and a page-relative
   * anchor resolved against the authored margin then lands that difference too low (#274).
   * HF stories keep authored page/landmark insets; attached pages supply effective margin frames.
   * Horizontal insets stay authored because nothing pushes the content box sideways; future
   * gutters or binding offsets need their own field.
   */
  readonly contentInsetTop: number;
  readonly contentInsetBottom: number;
  readonly contentWidth: number;
  readonly verticalMarginFrame?: { readonly top: number; readonly height: number };
  /** Body flow height on the current page (may shrink for notes/HF reserves). */
  readonly contentHeight: number;
  /** Content band between the insets: pageHeight − contentInsetTop − contentInsetBottom. */
  readonly contentBandHeight: number;
  readonly paragraphBox: LayoutBox;
  readonly anchorLineBox: LayoutBox;
  readonly anchorCharacterX: number;
  readonly columnBox: LayoutBox;
  readonly cellBox: LayoutBox | null;
  readonly layoutInCell: boolean;
  readonly ownerPartName: string;
  readonly storyKind: DrawingAnchorStoryKind;
  /**
   * Called whenever a frame or alignment resolution reads the parity of
   * {@link pageNumber}. Incremental layout listens so it knows a section's
   * geometry depends on where in the document its pages start.
   */
  readonly onPageParityRead?: () => void;
}

export interface ResolvedAnchoredPosition {
  readonly x: number;
  readonly y: number;
  readonly horizontalFrame: DrawingHorizontalReferenceFrame;
  readonly verticalFrame: DrawingVerticalReferenceFrame;
  /** Left edge of the horizontal reference frame in page-content coordinates. */
  readonly horizontalFrameOrigin: number;
  /** Top edge of the vertical reference frame in page-content coordinates. */
  readonly verticalFrameOrigin: number;
  readonly layoutFallback?: AnchoredDrawingLayoutFallback;
}

export interface AnchoredDrawingRecord extends Omit<
  InlineDrawingRecord,
  'kind' | 'baselineOffset' | 'advanceStart' | 'advanceEnd' | 'distL' | 'distR' | 'distT' | 'distB'
> {
  readonly kind: 'anchoredDrawing';
  readonly anchorParagraphId: string;
  readonly horizontalFrame: DrawingHorizontalReferenceFrame;
  readonly verticalFrame: DrawingVerticalReferenceFrame;
  readonly horizontalFrameOrigin: number;
  readonly verticalFrameOrigin: number;
  readonly behindDocument: boolean;
  readonly allowOverlap: boolean;
  readonly layoutInCell: boolean;
  readonly relativeHeight: number;
  readonly wrap: Exclude<ImageWrapTarget, 'inline'>;
  readonly layoutFallback?: AnchoredDrawingLayoutFallback;
  /** Canonical document traversal index within the owner story part. */
  readonly sourceOrder?: number;
  /**
   * Laid-out textbox story for a `wps:txbx` drawing; paint renders it clipped inside the
   * extent instead of a placeholder. Absent when the drawing carries no story or the host
   * did not thread story layout (the record then degrades to the placeholder path).
   */
  readonly textboxStory?: import('./textbox-story-layout.ts').TextboxStoryLayout;
}

/** Every parity read goes through here so the host learns the layout depends on it. */
function isOddPageOf(ctx: DrawingAnchorFrameContext): boolean {
  ctx.onPageParityRead?.();
  return ctx.pageNumber % 2 === 1;
}

function usesCellLayoutBox(
  _frame: DrawingHorizontalReferenceFrame | DrawingVerticalReferenceFrame,
  ctx: DrawingAnchorFrameContext
): boolean {
  if (!ctx.layoutInCell || ctx.cellBox === null) return false;
  if (!Number.isFinite(ctx.cellBox.height) || ctx.cellBox.height <= 0) return false;
  if (!Number.isFinite(ctx.cellBox.width) || ctx.cellBox.width <= 0) return false;
  return true;
}

function horizontalEdges(
  frame: DrawingHorizontalReferenceFrame,
  ctx: DrawingAnchorFrameContext
): { readonly left: number; readonly right: number; readonly center: number } | null {
  if (usesCellLayoutBox(frame, ctx)) {
    const cellBox = ctx.cellBox;
    if (!cellBox) return null;
    const { x, width } = cellBox;
    switch (frame) {
      case 'page':
      case 'column':
      case 'margin':
      case 'leftMargin':
        return { left: x, right: x + width, center: x + width / 2 };
      case 'rightMargin':
        return { left: x, right: x + width, center: x + width / 2 };
      case 'character':
        return {
          left: ctx.anchorCharacterX,
          right: ctx.anchorCharacterX,
          center: ctx.anchorCharacterX,
        };
      case 'insideMargin':
        return isOddPageOf(ctx)
          ? { left: x, right: x + width, center: x + width / 2 }
          : { left: x + width, right: x + width, center: x + width };
      case 'outsideMargin':
        return isOddPageOf(ctx)
          ? { left: x + width, right: x + width, center: x + width }
          : { left: x, right: x + width, center: x + width / 2 };
      default:
        return null;
    }
  }

  const pageLeft = -ctx.marginLeft;
  const pageRight = ctx.contentWidth + ctx.marginRight;
  const contentLeft = 0;
  const contentRight = ctx.contentWidth;
  const columnLeft = ctx.columnBox.x;
  const columnRight = ctx.columnBox.x + ctx.columnBox.width;

  switch (frame) {
    case 'page':
      return { left: pageLeft, right: pageRight, center: (pageLeft + pageRight) / 2 };
    case 'margin':
      return { left: contentLeft, right: contentRight, center: contentLeft + ctx.contentWidth / 2 };
    case 'column':
      return { left: columnLeft, right: columnRight, center: columnLeft + ctx.columnBox.width / 2 };
    case 'character':
      return {
        left: ctx.anchorCharacterX,
        right: ctx.anchorCharacterX,
        center: ctx.anchorCharacterX,
      };
    case 'leftMargin':
      return { left: pageLeft, right: pageLeft, center: pageLeft };
    case 'rightMargin':
      return { left: pageRight, right: pageRight, center: pageRight };
    case 'insideMargin':
      return isOddPageOf(ctx)
        ? { left: contentLeft, right: contentLeft, center: contentLeft }
        : { left: contentRight, right: contentRight, center: contentRight };
    case 'outsideMargin':
      return isOddPageOf(ctx)
        ? { left: pageRight, right: pageRight, center: pageRight }
        : { left: pageLeft, right: pageLeft, center: pageLeft };
    default:
      return null;
  }
}

function verticalEdges(
  frame: DrawingVerticalReferenceFrame,
  ctx: DrawingAnchorFrameContext
): { readonly top: number; readonly bottom: number; readonly center: number } | null {
  if (usesCellLayoutBox(frame, ctx)) {
    const cellBox = ctx.cellBox;
    if (!cellBox) return null;
    const { y, height } = cellBox;
    switch (frame) {
      case 'page':
      case 'margin':
      case 'topMargin':
      case 'bottomMargin':
        return { top: y, bottom: y + height, center: y + height / 2 };
      case 'paragraph':
        return {
          top: ctx.paragraphBox.y,
          bottom: ctx.paragraphBox.y + ctx.paragraphBox.height,
          center: ctx.paragraphBox.y + ctx.paragraphBox.height / 2,
        };
      case 'line':
        return {
          top: ctx.anchorLineBox.y,
          bottom: ctx.anchorLineBox.y + ctx.anchorLineBox.height,
          center: ctx.anchorLineBox.y + ctx.anchorLineBox.height / 2,
        };
      case 'insideMargin':
        return isOddPageOf(ctx)
          ? { top: y, bottom: y + height, center: y + height / 2 }
          : { top: y + height, bottom: y + height, center: y + height };
      case 'outsideMargin':
        return isOddPageOf(ctx)
          ? { top: y + height, bottom: y + height, center: y + height }
          : { top: y, bottom: y + height, center: y + height / 2 };
      default:
        return null;
    }
  }

  const pageTop = -ctx.contentInsetTop;
  const contentBandHeight = ctx.contentBandHeight;
  /**
   * Top edge of the bottom margin band, off the AUTHORED margin.
   *
   * Deriving it from the content band instead would let an oversized footer drag it up with
   * the shrinking text area, which is the same class of bug as #274 read backwards: the
   * margin frames exist so an anchor does NOT follow the furniture.
   */
  const pageBottomInner = pageTop + ctx.pageHeight - ctx.marginBottom;
  /** Physical sheet bottom above the outer page edge. */
  const pageBottomSheet = contentBandHeight + ctx.contentInsetBottom;
  const contentTop = 0;
  const contentBottom = ctx.contentHeight;
  const marginTop = ctx.verticalMarginFrame?.top ?? contentTop;
  const marginBottom = marginTop + (ctx.verticalMarginFrame?.height ?? ctx.contentHeight);

  switch (frame) {
    case 'page':
      return { top: pageTop, bottom: pageBottomSheet, center: (pageTop + pageBottomSheet) / 2 };
    case 'margin':
      return { top: marginTop, bottom: marginBottom, center: (marginTop + marginBottom) / 2 };
    case 'paragraph':
      return {
        top: ctx.paragraphBox.y,
        bottom: ctx.paragraphBox.y + ctx.paragraphBox.height,
        center: ctx.paragraphBox.y + ctx.paragraphBox.height / 2,
      };
    case 'line':
      return {
        top: ctx.anchorLineBox.y,
        bottom: ctx.anchorLineBox.y + ctx.anchorLineBox.height,
        center: ctx.anchorLineBox.y + ctx.anchorLineBox.height / 2,
      };
    case 'topMargin':
      return { top: pageTop, bottom: pageTop, center: pageTop };
    case 'bottomMargin':
      return { top: pageBottomInner, bottom: pageBottomInner, center: pageBottomInner };
    case 'insideMargin':
      return isOddPageOf(ctx)
        ? { top: contentTop, bottom: contentTop, center: contentTop }
        : { top: contentBottom, bottom: contentBottom, center: contentBottom };
    case 'outsideMargin':
      return isOddPageOf(ctx)
        ? { top: pageBottomSheet, bottom: pageBottomSheet, center: pageBottomSheet }
        : { top: pageTop, bottom: pageTop, center: pageTop };
    default:
      return null;
  }
}

function axisOffsetPoints(offsetEmu: number | null): number | null {
  if (offsetEmu === null) return 0;
  return emuToPointsSafe(offsetEmu);
}

function resolveInsideOutsideHorizontalAlign(
  align: string,
  objectWidth: number,
  ctx: DrawingAnchorFrameContext
): number | null {
  const odd = isOddPageOf(ctx);
  if (
    ctx.layoutInCell &&
    ctx.cellBox &&
    Number.isFinite(ctx.cellBox.width) &&
    ctx.cellBox.width > 0
  ) {
    const { x, width } = ctx.cellBox;
    if (align === 'inside') return odd ? x : x + width - objectWidth;
    if (align === 'outside') return odd ? x + width - objectWidth : x;
    return null;
  }
  if (align === 'inside') return odd ? 0 : ctx.contentWidth - objectWidth;
  if (align === 'outside') return odd ? ctx.contentWidth - objectWidth : 0;
  return null;
}

function resolveInsideOutsideVerticalAlign(
  align: string,
  objectHeight: number,
  ctx: DrawingAnchorFrameContext
): number | null {
  const odd = isOddPageOf(ctx);
  // THE TEXT AREA, deliberately — the opposite choice from `pageBottomInner` two functions up.
  // `inside`/`outside` align WITHIN a band rather than measuring from a page landmark, so on an
  // odd page `inside` is the content box top and `outside` puts the object on the content box
  // bottom. Reading the flow height here instead would differ only on a page carrying a note
  // reserve, and would shrink the band the notes took away from the text.
  const bandHeight = ctx.contentBandHeight;
  if (
    ctx.layoutInCell &&
    ctx.cellBox &&
    Number.isFinite(ctx.cellBox.height) &&
    ctx.cellBox.height > 0
  ) {
    const { y, height } = ctx.cellBox;
    if (align === 'inside') return odd ? y : y + height - objectHeight;
    if (align === 'outside') return odd ? y + height - objectHeight : y;
    return null;
  }
  if (align === 'inside') return odd ? 0 : bandHeight - objectHeight;
  if (align === 'outside') return odd ? bandHeight - objectHeight : 0;
  return null;
}

function positionFromHorizontal(
  frame: DrawingHorizontalReferenceFrame,
  align: string | null,
  offsetEmu: number | null,
  objectWidth: number,
  ctx: DrawingAnchorFrameContext
): number | null {
  const edges = horizontalEdges(frame, ctx);
  if (!edges) return null;
  const offset = axisOffsetPoints(offsetEmu);
  if (offset === null) return null;
  if (align === 'left') return edges.left + offset;
  if (align === 'center') return edges.center - objectWidth / 2 + offset;
  if (align === 'right') return edges.right - objectWidth + offset;
  if (align === 'inside' || align === 'outside') {
    const resolved = resolveInsideOutsideHorizontalAlign(align, objectWidth, ctx);
    if (resolved !== null) return resolved + offset;
  }
  return edges.left + offset;
}

function positionFromVertical(
  frame: DrawingVerticalReferenceFrame,
  align: string | null,
  offsetEmu: number | null,
  objectHeight: number,
  ctx: DrawingAnchorFrameContext
): number | null {
  const edges = verticalEdges(frame, ctx);
  if (!edges) return null;
  const offset = axisOffsetPoints(offsetEmu);
  if (offset === null) return null;
  if (align === 'top') return edges.top + offset;
  if (align === 'center') return edges.center - objectHeight / 2 + offset;
  if (align === 'bottom') return edges.bottom - objectHeight + offset;
  if (align === 'inside' || align === 'outside') {
    const resolved = resolveInsideOutsideVerticalAlign(align, objectHeight, ctx);
    if (resolved !== null) return resolved + offset;
  }
  return edges.top + offset;
}

/** Resolve anchored x/y in page-content coordinates. */
export function resolveAnchoredDrawingPosition(
  projection: DrawingProjection,
  ctx: DrawingAnchorFrameContext
): ResolvedAnchoredPosition {
  const measure = measureInlineDrawing(projection);
  const position = projection.position;
  const anchorMeta = projection.anchor;
  const fallbackFrameH: DrawingHorizontalReferenceFrame = 'page';
  const fallbackFrameV: DrawingVerticalReferenceFrame = 'page';

  if (!position || !anchorMeta) {
    return Object.freeze({
      x: 0,
      y: 0,
      horizontalFrame: fallbackFrameH,
      verticalFrame: fallbackFrameV,
      horizontalFrameOrigin: 0,
      verticalFrameOrigin: 0,
      layoutFallback: 'unresolvable-frame',
    });
  }

  if (anchorMeta.simplePos) {
    const xPoints = emuToPointsSafe(position.simplePosition.xEmu);
    const yPoints = emuToPointsSafe(position.simplePosition.yEmu);
    if (xPoints === null || yPoints === null) {
      return Object.freeze({
        x: 0,
        y: 0,
        horizontalFrame: position.horizontal.relativeFrom,
        verticalFrame: position.vertical.relativeFrom,
        horizontalFrameOrigin: 0,
        verticalFrameOrigin: 0,
        layoutFallback: 'unresolvable-frame',
      });
    }
    return Object.freeze({
      x: xPoints - ctx.marginLeft,
      y: yPoints - ctx.contentInsetTop,
      horizontalFrame: position.horizontal.relativeFrom,
      verticalFrame: position.vertical.relativeFrom,
      horizontalFrameOrigin: 0,
      verticalFrameOrigin: 0,
    });
  }

  const horizontalFrame = position.horizontal.relativeFrom;
  const verticalFrame = position.vertical.relativeFrom;
  const horizontalEdgesResolved = horizontalEdges(horizontalFrame, ctx);
  const verticalEdgesResolved = verticalEdges(verticalFrame, ctx);
  const horizontalFrameOrigin = horizontalEdgesResolved?.left ?? 0;
  const verticalFrameOrigin = verticalEdgesResolved?.top ?? 0;
  if (!HORIZONTAL_FRAMES.has(horizontalFrame) || !VERTICAL_FRAMES.has(verticalFrame)) {
    return Object.freeze({
      x: 0,
      y: 0,
      horizontalFrame: HORIZONTAL_FRAMES.has(horizontalFrame) ? horizontalFrame : fallbackFrameH,
      verticalFrame: VERTICAL_FRAMES.has(verticalFrame) ? verticalFrame : fallbackFrameV,
      horizontalFrameOrigin,
      verticalFrameOrigin,
      layoutFallback: 'unresolvable-frame',
    });
  }

  const x = positionFromHorizontal(
    horizontalFrame,
    position.horizontal.align,
    position.horizontal.offsetEmu,
    measure.width,
    ctx
  );
  const y = positionFromVertical(
    verticalFrame,
    position.vertical.align,
    position.vertical.offsetEmu,
    measure.height,
    ctx
  );
  if (x === null || y === null) {
    return Object.freeze({
      x: 0,
      y: 0,
      horizontalFrame,
      verticalFrame,
      horizontalFrameOrigin,
      verticalFrameOrigin,
      layoutFallback: 'unresolvable-frame',
    });
  }

  return Object.freeze({
    x,
    y,
    horizontalFrame,
    verticalFrame,
    horizontalFrameOrigin,
    verticalFrameOrigin,
  });
}

export function clipAnchoredDrawingRecordToRegion(
  drawing: AnchoredDrawingRecord,
  region: LayoutBox
): AnchoredDrawingRecord {
  const extentBox = Object.freeze({
    x: drawing.x,
    y: drawing.y,
    width: drawing.width,
    height: drawing.height,
  });
  const paintBounds = clipBoxToRegion(extentBox, region);
  const hitBounds =
    paintBounds.width > 0 && paintBounds.height > 0
      ? paintBounds
      : Object.freeze({ ...paintBounds });
  return Object.freeze({
    ...drawing,
    paintBounds,
    hitBounds,
    geometry: clipGeometryToRegion(drawing.geometry, region),
  });
}

export function buildAnchoredDrawingRecord(options: {
  readonly input: InlineDrawingLayoutInput;
  readonly anchorParagraphId: string;
  readonly start: number;
  readonly resolved: ResolvedAnchoredPosition;
  readonly clipRegion?: LayoutBox;
  readonly sourceOrder?: number;
  readonly textboxStory?: import('./textbox-story-layout.ts').TextboxStoryLayout | null;
  readonly revisions?: readonly RevisionAttribution[];
}): AnchoredDrawingRecord {
  const projection = options.input.projection;
  const anchorMeta = projection.anchor;
  const measure = measureInlineDrawing(projection);
  const geometry = drawingGeometryFromProjection({
    projection,
    anchorX: options.resolved.x,
    anchorY: options.resolved.y,
    extentWidth: measure.width,
    extentHeight: measure.height,
  });
  const paintBounds = options.clipRegion
    ? clipBoxToRegion(geometry.paintBounds, options.clipRegion)
    : geometry.paintBounds;
  const hitBounds =
    paintBounds.width > 0 && paintBounds.height > 0
      ? paintBounds
      : Object.freeze({ ...paintBounds });
  return Object.freeze({
    kind: 'anchoredDrawing',
    drawingNodeId: options.input.drawingNodeId,
    paragraphId: options.anchorParagraphId,
    anchorParagraphId: options.anchorParagraphId,
    ownerPartName: options.input.ownerPartName,
    start: options.start,
    x: options.resolved.x,
    y: options.resolved.y,
    width: measure.width,
    height: measure.height,
    horizontalFrame: options.resolved.horizontalFrame,
    verticalFrame: options.resolved.verticalFrame,
    horizontalFrameOrigin: options.resolved.horizontalFrameOrigin,
    verticalFrameOrigin: options.resolved.verticalFrameOrigin,
    behindDocument: anchorMeta?.behindDocument ?? false,
    allowOverlap: anchorMeta?.allowOverlap ?? true,
    layoutInCell: anchorMeta?.layoutInCell ?? true,
    relativeHeight: anchorMeta?.relativeHeight ?? 0,
    wrap: projection.wrap === 'inline' ? 'inFront' : projection.wrap,
    ...(options.sourceOrder !== undefined ? { sourceOrder: options.sourceOrder } : {}),
    ...(options.resolved.layoutFallback ? { layoutFallback: options.resolved.layoutFallback } : {}),
    ...(options.textboxStory ? { textboxStory: options.textboxStory } : {}),
    ...(options.revisions && options.revisions.length > 0 ? { revisions: options.revisions } : {}),
    paintBounds,
    hitBounds,
    geometry: options.clipRegion ? clipGeometryToRegion(geometry, options.clipRegion) : geometry,
    resource: options.input.resource,
    accessibility: drawingAccessibility(projection),
    ...drawingPaintFields(projection),
  });
}

/** Run-level drawing / MC atoms carrying anchored projections in one paragraph. */
export function anchoredDrawingAtomsInParagraph(
  paragraph: OoxmlNode,
  context: InlineDrawingLayoutContext
): readonly {
  readonly atomId: string;
  readonly projection: DrawingProjection;
  /** Enclosing revision wrappers, outermost first — the stack spans carry (see #479). */
  readonly revisions: readonly RevisionAttribution[];
}[] {
  if (paragraph.kind !== 'paragraph') return [];
  const atoms: {
    atomId: string;
    projection: DrawingProjection;
    revisions: readonly RevisionAttribution[];
  }[] = [];
  walkDrawingAtoms(paragraph, (node, containers) => {
    let revisions: readonly RevisionAttribution[] = NO_REVISIONS;
    for (const container of containers) {
      const attribution = isRevisionWrapper(container) ? revisionAttributionOf(container) : null;
      if (attribution) revisions = withRevision(revisions, attribution);
    }
    if (node.kind === 'drawing') {
      const projection =
        context.projectionForAtom?.(node.id) ??
        context.project(node as import('../store/package/ooxml-tree.ts').OoxmlDrawingNode);
      if (projection?.kind === 'anchored') atoms.push({ atomId: node.id, projection, revisions });
      return;
    }
    if (isRunLevelMcAlternateContent(node)) {
      const projection = context.projectionForAtom?.(node.id) ?? null;
      if (projection?.kind === 'anchored') atoms.push({ atomId: node.id, projection, revisions });
    }
  });
  return Object.freeze(atoms);
}

export function drawingModelOffsetsInParagraph(paragraph: OoxmlNode): ReadonlyMap<string, number> {
  const offsets = new Map<string, number>();
  if (paragraph.kind !== 'paragraph') return offsets;
  // Offsets come from the paragraph offset index — THE authority — not a private counter.
  // Counting only text and drawings put a drawing after a `w:br` at the break's offset, so
  // the anchor attached to the wrong line: every modeled atom occupies its own unit.
  // Text-only paragraphs need no drawing offsets. Keeping their full indexes alive
  // inflated large export layouts past the constrained Node heap.
  let index: ReturnType<typeof paragraphOffsetIndex> | undefined;
  walkDrawingRunContent(paragraph, (node) => {
    if (node.kind !== 'drawing' && !isRunLevelMcAlternateContent(node)) return;
    const span = (index ??= paragraphOffsetIndex(paragraph as OoxmlParagraphNode)).spanOf(node);
    if (span) offsets.set(node.id, span.start);
  });
  return offsets;
}

export function anchorCharacterXOnLine(
  line: {
    readonly range: { readonly start: number; readonly end: number };
    readonly box: LayoutBox;
    readonly spans: readonly {
      readonly range: { readonly start: number; readonly end: number };
      readonly box: LayoutBox;
      readonly text?: string;
      readonly style?: import('./run-style.ts').ResolvedRunStyle;
      readonly fontSlot?: import('./script-itemization.ts').FontSlot;
    }[];
  },
  modelOffset: number,
  measurer?: import('./semantic-records.ts').TextMeasurer
): number {
  // As drawn: the span's font slot decides the face this prefix measures in.
  const measured = (
    text: string,
    style: import('./run-style.ts').ResolvedRunStyle,
    slot: import('./script-itemization.ts').FontSlot | undefined
  ): number => measureDisplayText(text, styleForFontSlot(style, slot), measurer!);
  for (const span of line.spans) {
    if (modelOffset < span.range.start) break;
    if (modelOffset < span.range.end) {
      if (measurer && span.text !== undefined && span.style !== undefined) {
        const within = modelOffset - span.range.start;
        return span.box.x + measured(span.text.slice(0, within), span.style, span.fontSlot);
      }
      const spanLength = span.range.end - span.range.start;
      if (spanLength <= 0) return span.box.x;
      const within = modelOffset - span.range.start;
      return span.box.x + (span.box.width * within) / spanLength;
    }
    if (modelOffset === span.range.end) {
      if (measurer && span.text !== undefined && span.style !== undefined) {
        return span.box.x + measured(span.text, span.style, span.fontSlot);
      }
      return span.box.x + span.box.width;
    }
  }
  let trailing: (typeof line.spans)[number] | undefined;
  for (const span of line.spans) {
    if (span.range.end <= modelOffset) trailing = span;
  }
  if (trailing) {
    if (measurer && trailing.text !== undefined && trailing.style !== undefined) {
      return trailing.box.x + measured(trailing.text, trailing.style, trailing.fontSlot);
    }
    return trailing.box.x + trailing.box.width;
  }
  return line.box.x;
}

/** Model offset for a character-relative anchor — last text boundary before the drawing atom. */
export function anchorCharacterFrameOffset(
  line: {
    readonly range: { readonly start: number; readonly end: number };
    readonly spans: readonly { readonly range: { readonly start: number; readonly end: number } }[];
  },
  modelStart: number
): number {
  let textEnd = line.range.start;
  for (const span of line.spans) {
    if (span.range.end <= modelStart) textEnd = span.range.end;
  }
  return textEnd;
}

/** Column content box for one column of a multi-column section. */
export function columnBoxForSection(options: {
  readonly contentWidth: number;
  readonly paragraphY: number;
  readonly paragraphHeight: number;
  readonly columnCount: number;
  readonly columnGapPt: number;
  readonly columnIndex?: number;
}): LayoutBox {
  const count = Math.max(1, options.columnCount);
  const gap = count > 1 ? options.columnGapPt : 0;
  const columnWidth =
    count > 1 ? (options.contentWidth - gap * (count - 1)) / count : options.contentWidth;
  const index = Math.max(0, Math.min(count - 1, options.columnIndex ?? 0));
  const x = index * (columnWidth + gap);
  return Object.freeze({
    x,
    y: options.paragraphY,
    width: columnWidth,
    height: options.paragraphHeight,
  });
}
export function shiftAnchoredDrawingRecords(
  drawings: AnchoredDrawingRecord[],
  paragraphId: string,
  dy: number
): void {
  if (Math.abs(dy) <= 0.001) return;
  for (let index = 0; index < drawings.length; index += 1) {
    const drawing = drawings[index]!;
    if (drawing.anchorParagraphId !== paragraphId) continue;
    if (!drawing.layoutInCell && !['paragraph', 'line'].includes(drawing.verticalFrame)) continue;
    drawings[index] = Object.freeze({
      ...drawing,
      y: drawing.y + dy,
      geometry: shiftGeometry(drawing.geometry, 0, dy),
      paintBounds: Object.freeze({ ...drawing.paintBounds, y: drawing.paintBounds.y + dy }),
      hitBounds: Object.freeze({ ...drawing.hitBounds, y: drawing.hitBounds.y + dy }),
    });
  }
}

export function publishAnchoredDrawingsForParagraph(options: {
  readonly paragraph: OoxmlNode;
  readonly paragraphId: string;
  readonly paragraphBox: LayoutBox;
  readonly fragmentRange?: { readonly start: number; readonly end: number };
  readonly lines: readonly {
    readonly range: { readonly start: number; readonly end: number };
    readonly box: LayoutBox;
    readonly spans: readonly {
      readonly range: { readonly start: number; readonly end: number };
      readonly box: LayoutBox;
      readonly text?: string;
      readonly style?: import('./run-style.ts').ResolvedRunStyle;
    }[];
  }[];
  readonly drawingLayout: InlineDrawingLayoutContext;
  readonly frameBase: Omit<
    DrawingAnchorFrameContext,
    'paragraphBox' | 'anchorLineBox' | 'anchorCharacterX' | 'columnBox' | 'cellBox' | 'layoutInCell'
  >;
  readonly columnBox: LayoutBox;
  readonly cellBox: LayoutBox | null;
  readonly pageClip: LayoutBox;
  readonly measurer?: import('./semantic-records.ts').TextMeasurer;
  readonly sourceOrderOf?: (drawingNodeId: string) => number | undefined;
  /**
   * Which revisions are resolved before publishing. A deleted anchor survives `all-markup`
   * (marked, like deleted text) and disappears from the proposed result; an inserted one
   * disappears from the original. Defaults to `all-markup`, which shows everything.
   */
  readonly displayMode?: RevisionDisplayMode;
  readonly revisionAuthorFilter?: RevisionAuthorFilter;
  /**
   * Lays out a textbox drawing's story (host-supplied closure over flow deps and the page
   * context). Absent hosts degrade textbox drawings to the placeholder path.
   */
  readonly layoutTextboxStory?: (
    projection: DrawingProjection
  ) => import('./textbox-story-layout.ts').TextboxStoryLayout | null;
}): readonly AnchoredDrawingRecord[] {
  const atoms = anchoredDrawingAtomsInParagraph(options.paragraph, options.drawingLayout);
  if (atoms.length === 0) return [];
  const offsets = drawingModelOffsetsInParagraph(options.paragraph);
  const displayMode = options.displayMode ?? DEFAULT_REVISION_DISPLAY_MODE;
  const records: AnchoredDrawingRecord[] = [];
  for (const atom of atoms) {
    const projection = atom.projection;
    if (projection.hidden) continue;
    const revisions = projectedRevisions(atom.revisions, displayMode, options.revisionAuthorFilter);
    if (revisions === null) continue;
    const start = offsets.get(atom.atomId);
    if (start === undefined) continue;
    if (
      options.fragmentRange &&
      (start < options.fragmentRange.start || start >= options.fragmentRange.end)
    ) {
      continue;
    }
    const anchorLine = options.lines.find(
      (line) => start >= line.range.start && start < line.range.end
    );
    if (!anchorLine) continue;
    const layoutInCell = projection.anchor?.layoutInCell ?? true;
    const horizontalFrame = projection.position?.horizontal.relativeFrom;
    const characterFrameOffset =
      horizontalFrame === 'character' ? anchorCharacterFrameOffset(anchorLine, start) : start;
    const frameContext: DrawingAnchorFrameContext = Object.freeze({
      ...options.frameBase,
      paragraphBox: options.paragraphBox,
      anchorLineBox: anchorLine.box,
      anchorCharacterX: anchorCharacterXOnLine(anchorLine, characterFrameOffset, options.measurer),
      columnBox: options.columnBox,
      cellBox: options.cellBox,
      layoutInCell,
    });
    const resolved = resolveAnchoredDrawingPosition(projection, frameContext);
    const clipToCell =
      projection.wrap !== 'inFront' &&
      projection.wrap !== 'behind' &&
      layoutInCell &&
      options.cellBox !== null &&
      Number.isFinite(options.cellBox.height) &&
      options.cellBox.height > 0 &&
      Number.isFinite(options.cellBox.width) &&
      options.cellBox.width > 0;
    const pageClip =
      projection.position?.vertical.relativeFrom === 'margin'
        ? options.pageClip
        : pageClipRegion(options.frameBase);
    const clipRegion = clipToCell ? options.cellBox! : pageClip;
    const record = buildAnchoredDrawingRecord({
      input: Object.freeze({
        drawingNodeId: atom.atomId,
        ownerPartName: options.drawingLayout.ownerPartName,
        projection,
        resource: options.drawingLayout.resourceOf(projection),
      }),
      anchorParagraphId: options.paragraphId,
      start: characterFrameOffset,
      resolved,
      clipRegion,
      revisions,
      ...(options.sourceOrderOf
        ? { sourceOrder: options.sourceOrderOf(projection.drawingNodeId) }
        : {}),
      ...(projection.textboxStory && options.layoutTextboxStory
        ? { textboxStory: options.layoutTextboxStory(projection) }
        : {}),
    });
    records.push(record);
  }
  return Object.freeze(records);
}

export function buildInlineDrawingRecord(options: {
  readonly input: InlineDrawingLayoutInput;
  readonly paragraphId: string;
  readonly start: number;
  readonly slotX: number;
  readonly y: number;
  readonly baseline: number;
  readonly contentLeft: number;
  readonly contentRight: number;
  readonly contentTop?: number;
  readonly contentBottom?: number;
  readonly revisions?: readonly RevisionAttribution[];
}): InlineDrawingRecord {
  const measure = measureInlineDrawing(options.input.projection);
  const extentX = options.slotX + measure.distL + measure.effectL;
  const geometry = drawingGeometryFromProjection({
    projection: options.input.projection,
    anchorX: extentX,
    anchorY: options.y,
    extentWidth: measure.width,
    extentHeight: measure.height,
  });
  const clipRegion =
    options.contentTop !== undefined && options.contentBottom !== undefined
      ? Object.freeze({
          x: options.contentLeft,
          y: options.contentTop,
          width: Math.max(0, options.contentRight - options.contentLeft),
          height: Math.max(0, options.contentBottom - options.contentTop),
        })
      : Object.freeze({
          x: options.contentLeft,
          y: geometry.paintBounds.y,
          width: Math.max(0, options.contentRight - options.contentLeft),
          height: geometry.paintBounds.height,
        });
  const paintBounds = clipBoxToRegion(geometry.paintBounds, clipRegion);
  const hitBounds =
    paintBounds.width > 0 && paintBounds.height > 0
      ? paintBounds
      : Object.freeze({ ...paintBounds });
  return Object.freeze({
    kind: 'inlineDrawing',
    drawingNodeId: options.input.drawingNodeId,
    paragraphId: options.paragraphId,
    ownerPartName: options.input.ownerPartName,
    start: options.start,
    x: extentX,
    y: options.y,
    width: measure.width,
    height: measure.height,
    distL: measure.distL,
    distR: measure.distR,
    distT: measure.distT,
    distB: measure.distB,
    advanceStart: options.slotX,
    advanceEnd: options.slotX + measure.totalWidth,
    baselineOffset: options.baseline,
    paintBounds,
    hitBounds,
    geometry: clipGeometryToRegion(geometry, clipRegion),
    resource: options.input.resource,
    accessibility: drawingAccessibility(options.input.projection),
    ...drawingPaintFields(options.input.projection),
    ...(options.revisions && options.revisions.length > 0 ? { revisions: options.revisions } : {}),
  });
}
