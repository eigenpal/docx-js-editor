// Pointer gestures over the painted pages.
//
// The surface owns this rather than each host, so React, Vue and a plain page get identical
// behaviour instead of three hand-written pointer handlers that drift.
//
// WHY THE ENGINE CLAIMS THE GESTURE. Left to itself the browser can only place a caret where
// it finds an inline box, and the painted pages are a stack of shrink-to-fit line boxes: the
// left indent, the right margin, the leading between two lines and a cell's padding are all
// outside every box it knows about. Clicks there — which is where people aim when they want
// the start or the end of a line — landed wherever its own fallback chose. Resolving the
// point against the layout records instead answers all of them the way a word processor does,
// and answers them the same way headlessly.
//
// Geometry still comes from ONE place. The only thing measured here is where the pages layer
// sits on screen, which is the one fact the records cannot carry; every position, band and
// clamp comes from `semantic-hit-test.ts`.

import { cellSelectionBetween, type CellSelection } from '../layout/semantic-cell-selection.ts';
import {
  contentControlAtPoint,
  hitTestFragments,
  hitTestPage,
  pageAtY,
  type SemanticHit,
  type TableCellAddress,
} from '../layout/semantic-hit-test.ts';
import {
  documentOrder,
  deletedTextBoundaries,
  paragraphTextFromLayout,
  type SemanticPosition,
  type SemanticSelection,
} from '../layout/semantic-interaction.ts';
import { wordRangeAt } from './surface-selection-ops.ts';
import type {
  BlockFragmentRecord,
  ContentControlBoundaryRecord,
  LayoutBox,
  ParagraphFragmentRecord,
  SemanticLayout,
  TextMeasurer,
} from '../layout/semantic-records.ts';
import { MAX_TABLE_NESTING } from '../layout/semantic-table.ts';
import {
  findEmptyFurnitureBandAtSheetPoint,
  findNoteAtSheetPoint,
  findStoryAtSheetPoint,
  hitTestStoryAtLocalPoint,
  isBodyContentPoint,
  scopedDocumentOrder,
  storyMatchesBinding,
  type HeaderFooterScopeBinding,
} from './surface-scope.ts';

/** Active header/footer scope as seen by the pointer layer. */
export interface ActiveHeaderFooterPointerState {
  readonly rId: string;
  readonly pageIndex: number;
  readonly kind: 'header' | 'footer';
  readonly partName: string;
  readonly variant: 'default' | 'first' | 'even';
}

/** Request to enter a header/footer editing scope from a pointer gesture. */
export interface EnterHeaderFooterPointerRequest extends ActiveHeaderFooterPointerState {
  readonly position?: SemanticPosition;
}

/** What the controller needs from the surface it drives. */
export interface PointerHost {
  readonly pagesLayer: HTMLElement;
  readonly container: HTMLElement;
  /**
   * Points to CSS pixels, read per gesture rather than captured.
   *
   * A getter, not a value: a surface that ever rescales in place would otherwise leave this
   * transform silently converting with a stale factor, and every click would be wrong by the
   * ratio between the two.
   */
  scale(): number;
  /**
   * The horizontal offset the painter drew a page at, beyond its record position.
   *
   * Pages of differing width are centred individually, so on a mixed-orientation document a
   * page's painted x is not the x its record carries. The transform has to undo that or every
   * point on such a page resolves shifted.
   */
  pageOffsetX(pageIndex: number): number;
  layout(): SemanticLayout;
  measurer(): TextMeasurer | undefined;
  selection(): SemanticSelection;
  setSelection(next: SemanticSelection): void;
  cellSelection(): CellSelection | null;
  setCellSelection(next: CellSelection | null): void;
  focus(): void;
  /** When a header/footer scope is open, the story the pointer should resolve against. */
  activeHeaderFooter?(): ActiveHeaderFooterPointerState | null;
  /** When a footnote/endnote scope is open, the note the pointer should resolve against. */
  activeNote?(): { readonly scopeId: string; readonly pageIndex: number | null } | null;
  /** Double-click enter on painted furniture. */
  enterHeaderFooter?(info: EnterHeaderFooterPointerRequest): void;
  /**
   * Double-click in the blank header/footer margin band of a page with no story there.
   *
   * The host decides what that means — typically create the part and open it for editing,
   * refusing in view mode. The pointer only reports the gesture.
   */
  enterEmptyHeaderFooter?(kind: 'header' | 'footer', pageIndex: number): void;
  /** Enter a painted note story for scoped editing. */
  enterNote?(
    scopeId: string,
    position?: { paragraphId: string; offset: number },
    pageIndex?: number
  ): void;
  /** Leave note scope; when true the host restores the saved body selection. */
  exitNote?(restoreBody?: boolean): void;
  /** Leave furniture scope; when true the host restores the saved body selection. */
  exitHeaderFooter?(restoreBody?: boolean): void;
  /**
   * Activate an engine-level content-control widget (dropdown / combo / date / checkbox).
   *
   * Called after mousedown is prevented so the caret is not stolen.
   */
  onContentControlWidget?(controlId: string, kind: string): void;
  /** Options interaction on a legacy text form, before ordinary word selection. */
  onTextFormDoubleClick?(event: PointerEvent): boolean;
  /**
   * A pointer selection gesture has settled — the press, drag and release are over and the
   * model selection is final.
   *
   * The format painter is what needs it: an armed painter paints the selection the user just
   * MADE, and every earlier point in the gesture is a selection still being dragged. Reported
   * rather than acted on here, because the pointer lane owns geometry and nothing else.
   */
  onSelectionSettled?(): void;
  /** Generated navigation paragraphs refuse caret placement and text selection. */
  isReadOnlyParagraph?(paragraphId: string): boolean;
  /**
   * Select a content control's full addressable content atomically.
   *
   * Preferred for `w:showingPlcHdr` presses when the host already owns
   * `selectControlContent` (form-fill). When absent, the pointer expands from layout
   * boundary geometry alone.
   */
  selectContentControl?(controlId: string): boolean;
}

export interface PointerControllerOptions {
  /**
   * `'engine'` resolves points from the layout records; `'native'` binds nothing and leaves
   * the browser's own caret placement in charge.
   *
   * A switch on the primary input path, so a host that hits trouble in a browser this could
   * not be tested in has somewhere to go that is not "downgrade the package".
   */
  readonly mode?: 'engine' | 'native';
}

export interface PointerController {
  /**
   * True while a gesture owns the selection.
   *
   * The surface's `selectionchange` listener reads this: the browser keeps reporting its own
   * idea of the selection during a drag, and adopting those would fight the gesture halfway
   * through it.
   */
  dragging(): boolean;
  destroy(): void;
}

/** How long after a click a second one still counts as a double. */
const MULTI_CLICK_MS = 500;
/** How far it may move and still count — a click, not a tiny drag. */
const MULTI_CLICK_SLOP_PX = 4;
/** How close to the scroller's edge a drag must reach before the view starts following it. */
const AUTO_SCROLL_EDGE_PX = 40;
/** Fastest the view follows, per frame. */
const AUTO_SCROLL_MAX_PX = 12;

type Granularity = 'character' | 'word' | 'paragraph';

interface PositionRange {
  readonly from: SemanticPosition;
  readonly to: SemanticPosition;
}

interface Gesture {
  readonly pointerId: number;
  readonly granularity: Granularity;
  /** What the press itself selected — a caret, a word, or a paragraph. */
  readonly anchorRange: PositionRange;
  /** The cell the press landed in, or null outside a table. */
  readonly anchorCell: TableCellAddress | null;
  /** Set once the drag leaves the cell it started in, and never unset before the release. */
  cellDragging: boolean;
  /** Last client point, so autoscroll can keep extending while the pointer is still. */
  clientX: number;
  clientY: number;
}

function overlapArea(a: LayoutBox, b: LayoutBox): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  if (x1 <= x0 || y1 <= y0) return 0;
  return (x1 - x0) * (y1 - y0);
}

/** True when boxes share area, or a zero-width control box sits on `inner`. */
function boxesTouch(outer: LayoutBox, inner: LayoutBox): boolean {
  if (overlapArea(outer, inner) > 0) return true;
  if (outer.width === 0) {
    return (
      inner.x <= outer.x &&
      outer.x <= inner.x + inner.width &&
      !(outer.y + outer.height < inner.y || inner.y + inner.height < outer.y)
    );
  }
  return false;
}

function comparePositions(
  layout: SemanticLayout,
  a: SemanticPosition,
  b: SemanticPosition
): number {
  const order = documentOrder(layout);
  const rankA = order.indexOf(a.paragraphId);
  const rankB = order.indexOf(b.paragraphId);
  if (rankA !== rankB) return rankA - rankB;
  return a.offset - b.offset;
}

/**
 * Document-order paragraph walk that descends table rows/cells within {@link MAX_TABLE_NESTING}.
 *
 * Header-repeat rows are skipped so each caret stop is considered once. Nested tables inside
 * cells share the same bound layout already uses when refusing deeper nesting.
 */
function visitParagraphBlocks(
  blocks: readonly BlockFragmentRecord[],
  depth: number,
  visit: (paragraph: ParagraphFragmentRecord) => void
): void {
  if (depth > MAX_TABLE_NESTING) return;
  for (const block of blocks) {
    if (block.kind === 'paragraph') {
      visit(block);
      continue;
    }
    if (depth >= MAX_TABLE_NESTING) continue;
    for (const row of block.rows) {
      if (row.isHeaderRepeat) continue;
      for (const cell of row.cells) visitParagraphBlocks(cell.blocks, depth + 1, visit);
    }
  }
}

/**
 * Full addressable range of a placeholder control from layout-published boundary geometry.
 *
 * Block / row / cell controls cover whole paragraphs whose boxes touch a fragment (including
 * paragraphs nested under tables and nested block-control content that flattened into the
 * flow). Inline controls take the UTF-16 span of every painted span that touches a fragment.
 */
export function placeholderSelectionRange(
  layout: SemanticLayout,
  control: ContentControlBoundaryRecord
): PositionRange | null {
  if (!control.placeholder || control.fragments.length === 0) return null;

  let from: SemanticPosition | null = null;
  let to: SemanticPosition | null = null;

  const consider = (start: SemanticPosition, end: SemanticPosition): void => {
    if (!from || comparePositions(layout, start, from) < 0) from = start;
    if (!to || comparePositions(layout, end, to) > 0) to = end;
  };

  // Non-inline placeholders select whole paragraphs — row/cell wrappers are structural units
  // the same way block wrappers are, so a mid-cell partial range must still absorb.
  const wholeParagraphs = control.level !== 'inline';

  for (const fragment of control.fragments) {
    const page = layout.pages[fragment.pageIndex];
    if (!page) continue;
    visitParagraphBlocks(page.fragments, 0, (block) => {
      if (!boxesTouch(fragment.box, block.box)) return;

      if (wholeParagraphs) {
        const length = paragraphTextFromLayout(layout, block.paragraphId).length;
        consider(
          { paragraphId: block.paragraphId, offset: 0 },
          { paragraphId: block.paragraphId, offset: length }
        );
        return;
      }

      for (const line of block.lines) {
        for (const span of line.spans) {
          if (!boxesTouch(fragment.box, span.box)) continue;
          consider(
            { paragraphId: span.range.paragraphId, offset: span.range.start },
            { paragraphId: span.range.paragraphId, offset: span.range.end }
          );
        }
      }
    });
  }

  if (!from || !to) return null;
  return { from, to };
}

function controlById(
  layout: SemanticLayout,
  controlId: string
): ContentControlBoundaryRecord | null {
  return (layout.contentControls ?? []).find((control) => control.id === controlId) ?? null;
}

function placeholderAtHit(
  layout: SemanticLayout,
  hit: SemanticHit
): ContentControlBoundaryRecord | null {
  const id = hit.contentControlId;
  if (!id) {
    // Hit records may omit the id when resolved through a scoped story path — fall back to
    // geometry so placeholder expansion still works inside headers/notes.
    const point = { x: hit.caret.x, y: hit.caret.y + hit.caret.height / 2 };
    const control = contentControlAtPoint(layout, hit.pageIndex, point);
    return control?.placeholder ? control : null;
  }
  const control = controlById(layout, id);
  return control?.placeholder ? control : null;
}

/**
 * Expand a selection so every `w:showingPlcHdr` control it touches is selected as a unit.
 *
 * Used by pointer drag / shift-click, and exported so keyboard extend paths can share the
 * same atomic rule without duplicating geometry walks.
 */
export function absorbPlaceholderControls(
  layout: SemanticLayout,
  selection: SemanticSelection
): SemanticSelection {
  const controls = layout.contentControls ?? [];
  if (controls.length === 0) return selection;

  let from =
    comparePositions(layout, selection.anchor, selection.head) <= 0
      ? selection.anchor
      : selection.head;
  let to =
    comparePositions(layout, selection.anchor, selection.head) <= 0
      ? selection.head
      : selection.anchor;

  let changed = true;
  while (changed) {
    changed = false;
    for (const control of controls) {
      if (!control.placeholder) continue;
      const range = placeholderSelectionRange(layout, control);
      if (!range) continue;
      const collapsed = comparePositions(layout, from, to) === 0;
      const intersects = collapsed
        ? comparePositions(layout, from, range.from) >= 0 &&
          comparePositions(layout, from, range.to) < 0
        : comparePositions(layout, from, range.to) < 0 &&
          comparePositions(layout, to, range.from) > 0;
      if (!intersects) continue;
      if (comparePositions(layout, range.from, from) < 0) {
        from = range.from;
        changed = true;
      }
      if (comparePositions(layout, range.to, to) > 0) {
        to = range.to;
        changed = true;
      }
    }
  }

  // Preserve which end the user is dragging (head) relative to the original orientation.
  const headIsEnd = comparePositions(layout, selection.anchor, selection.head) <= 0;
  return headIsEnd ? { anchor: from, head: to } : { anchor: to, head: from };
}

export function createPointerController(
  host: PointerHost,
  options: PointerControllerOptions = {}
): PointerController {
  if (options.mode === 'native') {
    return { dragging: () => false, destroy: () => {} };
  }

  const { pagesLayer, container } = host;
  const document = pagesLayer.ownerDocument;
  const view = document.defaultView;

  let gesture: Gesture | null = null;
  /** Cached for the life of one gesture, and dropped whenever the page can have moved. */
  let layerRect: { left: number; top: number } | null = null;
  let clickCount = 0;
  let lastClickAt = 0;
  let lastClickX = 0;
  let lastClickY = 0;
  let autoScrollHandle: number | null = null;

  // ---------------------------------------------------------------------------------
  // Client pixels to model points
  // ---------------------------------------------------------------------------------

  /**
   * The pages layer's own top-left IS the sheet origin — every page is painted at its record
   * position inside it — so one rect read converts a client point for the whole document, and
   * keeps working over a gutter, beside a page, or past the last one.
   */
  function sheetPoint(clientX: number, clientY: number): { x: number; y: number } {
    if (!layerRect) {
      const rect = pagesLayer.getBoundingClientRect();
      layerRect = { left: rect.left, top: rect.top };
    }
    const scale = host.scale() || 1;
    return { x: (clientX - layerRect.left) / scale, y: (clientY - layerRect.top) / scale };
  }

  function scopeBinding(active: ActiveHeaderFooterPointerState): HeaderFooterScopeBinding {
    return {
      scope: { kind: 'headerFooter', rId: active.rId },
      pageIndex: active.pageIndex,
      kind: active.kind,
      partName: active.partName,
      variant: active.variant,
    };
  }

  function resolveBody(clientX: number, clientY: number): SemanticHit | null {
    const layout = host.layout();
    const sheet = sheetPoint(clientX, clientY);
    const pageIndex = pageAtY(layout, sheet.y);
    const page = layout.pages[pageIndex];
    if (!page) return null;
    const measurer = host.measurer();
    return hitTestPage(
      layout,
      pageIndex,
      {
        x: sheet.x - page.contentBox.x - host.pageOffsetX(pageIndex),
        y: sheet.y - page.contentBox.y,
      },
      measurer ? { measurer } : {}
    );
  }

  function resolve(clientX: number, clientY: number): SemanticHit | null {
    const activeNote = host.activeNote?.() ?? null;
    if (activeNote) {
      const layout = host.layout();
      const noteHit = findNoteAtSheetPoint(layout, sheetPoint(clientX, clientY), host.pageOffsetX);
      if (!noteHit || noteHit.scopeId !== activeNote.scopeId) return null;
      const measurer = host.measurer();
      return hitTestFragments(layout, noteHit.pageIndex, noteHit.fragments, noteHit.local, {
        ...(measurer ? { measurer } : {}),
      });
    }
    const active = host.activeHeaderFooter?.() ?? null;
    if (!active) return resolveBody(clientX, clientY);

    const layout = host.layout();
    const sheet = sheetPoint(clientX, clientY);
    const storyHit = findStoryAtSheetPoint(layout, sheet, host.pageOffsetX);
    if (storyHit && storyMatchesBinding(storyHit.story, scopeBinding(active))) {
      const measurer = host.measurer();
      return hitTestStoryAtLocalPoint(
        layout,
        storyHit.pageIndex,
        storyHit.story,
        storyHit.local,
        measurer ? { measurer } : {}
      );
    }
    // Open furniture scope: only the active story is a valid hit target during a gesture.
    return null;
  }

  function enterRequestFromStoryHit(
    storyHit: NonNullable<ReturnType<typeof findStoryAtSheetPoint>>,
    position?: SemanticPosition
  ): EnterHeaderFooterPointerRequest {
    const { story, pageIndex, kind } = storyHit;
    return {
      rId: story.rId!,
      pageIndex,
      kind,
      partName: story.partName,
      variant: story.variant,
      ...(position ? { position } : {}),
    };
  }

  function positionInStory(
    storyHit: NonNullable<ReturnType<typeof findStoryAtSheetPoint>>
  ): SemanticPosition | undefined {
    const measurer = host.measurer();
    return (
      hitTestStoryAtLocalPoint(
        host.layout(),
        storyHit.pageIndex,
        storyHit.story,
        storyHit.local,
        measurer ? { measurer } : {}
      )?.position ?? undefined
    );
  }

  // ---------------------------------------------------------------------------------
  // Ordering and granularity
  // ---------------------------------------------------------------------------------

  const orderCache = new WeakMap<SemanticLayout, Map<string, number>>();

  function paragraphRank(layout: SemanticLayout, paragraphId: string): number {
    const activeNote = host.activeNote?.();
    if (activeNote) {
      const order = scopedDocumentOrder(layout, null, activeNote.scopeId);
      const at = order.indexOf(paragraphId);
      return at === -1 ? -1 : at;
    }
    const active = host.activeHeaderFooter?.();
    if (active) {
      const order = scopedDocumentOrder(layout, scopeBinding(active));
      const at = order.indexOf(paragraphId);
      return at === -1 ? -1 : at;
    }
    let index = orderCache.get(layout);
    if (!index) {
      index = new Map(documentOrder(layout).map((id, at) => [id, at]));
      orderCache.set(layout, index);
    }
    return index.get(paragraphId) ?? -1;
  }

  function isBefore(layout: SemanticLayout, a: SemanticPosition, b: SemanticPosition): boolean {
    const rankA = paragraphRank(layout, a.paragraphId);
    const rankB = paragraphRank(layout, b.paragraphId);
    if (rankA !== rankB) return rankA < rankB;
    return a.offset < b.offset;
  }

  /** The range one press selects, at the granularity the click count asked for. */
  function rangeAt(
    layout: SemanticLayout,
    position: SemanticPosition,
    granularity: Granularity
  ): PositionRange {
    if (granularity === 'character') return { from: position, to: position };
    const id = position.paragraphId;
    if (granularity === 'paragraph') {
      const text = paragraphTextFromLayout(layout, id);
      return { from: { paragraphId: id, offset: 0 }, to: { paragraphId: id, offset: text.length } };
    }
    // A word stops at a struck half's edge: a replacement paints the old text and the new
    // with nothing between them, so without this a double-click on either took both.
    return wordRangeAt(layout, position, deletedTextBoundaries(layout, id));
  }

  /** Anchor range plus the range under the pointer, oriented so the head follows the drag. */
  function extend(
    layout: SemanticLayout,
    anchorRange: PositionRange,
    head: SemanticPosition,
    granularity: Granularity,
    hit?: SemanticHit
  ): SemanticSelection {
    const placeholder = hit ? placeholderAtHit(layout, hit) : null;
    const headRange = placeholder
      ? (placeholderSelectionRange(layout, placeholder) ?? rangeAt(layout, head, granularity))
      : rangeAt(layout, head, granularity);
    const raw = isBefore(layout, headRange.from, anchorRange.from)
      ? { anchor: anchorRange.to, head: headRange.from }
      : { anchor: anchorRange.from, head: headRange.to };
    return absorbPlaceholderControls(layout, raw);
  }

  // ---------------------------------------------------------------------------------
  // Autoscroll
  // ---------------------------------------------------------------------------------

  /**
   * The element the `scroll` listener is REGISTERED on, captured once.
   *
   * `destroy()` used to look the scroller up again, and `closest` returns null once the
   * container has been unparented — so the listener stayed attached to an element that then
   * retained the whole surface through this closure.
   */
  const scrollHost: HTMLElement | null = container.closest('.docx-editor__scroll-container');

  /**
   * The scroller to FOLLOW during a drag, looked up live.
   *
   * Deliberately not `scrollHost`: a host is free to build its chrome after mounting, so the
   * scroll container may not exist yet when the controller is constructed. Autoscroll has to
   * find it whenever the drag actually happens. Invalidation is covered regardless, by the
   * capture-phase listener on the window below.
   */
  function scroller(): HTMLElement | null {
    return container.closest('.docx-editor__scroll-container');
  }

  /** How far the view should move this frame, from how deep into the edge zone the drag is. */
  function autoScrollDelta(top: number, bottom: number, clientY: number): number {
    if (clientY < top + AUTO_SCROLL_EDGE_PX) {
      const depth = Math.max(0, top + AUTO_SCROLL_EDGE_PX - clientY);
      return -Math.min(AUTO_SCROLL_MAX_PX, (depth / AUTO_SCROLL_EDGE_PX) * AUTO_SCROLL_MAX_PX);
    }
    if (clientY > bottom - AUTO_SCROLL_EDGE_PX) {
      const depth = Math.max(0, clientY - (bottom - AUTO_SCROLL_EDGE_PX));
      return Math.min(AUTO_SCROLL_MAX_PX, (depth / AUTO_SCROLL_EDGE_PX) * AUTO_SCROLL_MAX_PX);
    }
    return 0;
  }

  function stopAutoScroll(): void {
    if (autoScrollHandle === null) return;
    view?.cancelAnimationFrame(autoScrollHandle);
    autoScrollHandle = null;
  }

  /**
   * Follow the drag past the edge of the view.
   *
   * The selection is re-extended at the LAST pointer position every frame, not only when the
   * pointer moves: holding still at the bottom of the window has to keep selecting, and a
   * stationary pointer produces no events at all.
   */
  function tickAutoScroll(): void {
    autoScrollHandle = null;
    const active = gesture;
    const element = scroller();
    if (!active || !element || !view) return;
    const rect = element.getBoundingClientRect();
    const delta = autoScrollDelta(rect.top, rect.bottom, active.clientY);
    if (delta === 0) return;
    element.scrollTop += delta;
    // The layer moved under the pointer, so the cached transform is stale by exactly the
    // amount just scrolled. Drop it rather than correcting it: one rect read is cheaper than
    // a second source of truth for where the pages are.
    layerRect = null;
    extendTo(active.clientX, active.clientY);
    autoScrollHandle = view.requestAnimationFrame(tickAutoScroll);
  }

  function maybeAutoScroll(): void {
    if (autoScrollHandle !== null || !view || !gesture) return;
    const element = scroller();
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (autoScrollDelta(rect.top, rect.bottom, gesture.clientY) === 0) return;
    autoScrollHandle = view.requestAnimationFrame(tickAutoScroll);
  }

  // ---------------------------------------------------------------------------------
  // Gesture
  // ---------------------------------------------------------------------------------

  function extendTo(clientX: number, clientY: number): void {
    const active = gesture;
    if (!active) return;
    const hit = resolve(clientX, clientY);
    // An unresolvable move is a no-op, never a collapse: a pointer that has left the document
    // should leave the selection where it last was rather than throwing it away.
    if (!hit) return;
    if (host.isReadOnlyParagraph?.(hit.position.paragraphId)) return;
    if (extendCells(active, hit)) return;
    host.setSelection(
      extend(host.layout(), active.anchorRange, hit.position, active.granularity, hit)
    );
  }

  /**
   * Promote a drag that has crossed into another cell, and keep it promoted.
   *
   * Leaving a cell is the whole signal — no pixel threshold, because a threshold would make
   * the same gesture mean different things depending on how the cells happen to be sized. Once
   * promoted it STAYS promoted for the rest of the drag: dragging back into the cell it
   * started in gives a one-cell rectangle, not a text selection, so the gesture cannot flip
   * type under the pointer.
   */
  function extendCells(active: Gesture, hit: SemanticHit): boolean {
    const anchorCell = active.anchorCell;
    if (!anchorCell) return false;
    if (!hit.cell || hit.cell.tableId !== anchorCell.tableId) {
      // The pointer has left the table. A promoted gesture KEEPS what it has: sweeping a
      // couple of cells and letting the pointer stray past the last column or below the last
      // row is an ordinary way to select them, and dropping back to a text selection there
      // would throw the whole rectangle away at the moment of release.
      return active.cellDragging;
    }
    if (!active.cellDragging && hit.cell.cellId === anchorCell.cellId) return false;
    const next = cellSelectionBetween(host.layout(), anchorCell, hit.cell);
    if (!next) return active.cellDragging;
    active.cellDragging = true;
    host.setCellSelection(next);
    return true;
  }

  function countClick(event: PointerEvent): number {
    // ONE clock. `event.timeStamp` is relative to the document's time origin and `Date.now()`
    // is absolute, so falling back between them produces a delta of about minus 1.7e12 — and
    // a negative number is `<= 500`, which made every press after it count as a double click
    // for the rest of the session. No sub-millisecond precision is needed for a 500ms window.
    const now = Date.now();
    const since = now - lastClickAt;
    const near =
      Math.abs(event.clientX - lastClickX) <= MULTI_CLICK_SLOP_PX &&
      Math.abs(event.clientY - lastClickY) <= MULTI_CLICK_SLOP_PX;
    // Counted here rather than read off `detail`, which browsers disagree about on
    // `pointerdown` — some report the click count, some report zero.
    clickCount = near && since >= 0 && since <= MULTI_CLICK_MS ? clickCount + 1 : 1;
    lastClickAt = now;
    lastClickX = event.clientX;
    lastClickY = event.clientY;
    return clickCount;
  }

  const GRANULARITIES: readonly Granularity[] = ['character', 'word', 'paragraph'];

  const onPointerDown = (event: PointerEvent): void => {
    // Anything but the primary button keeps its native behaviour: a right-click must reach the
    // context menu with the existing selection intact, not move the caret out from under it.
    if (event.button !== 0) return;
    // Content-control widgets: prevent mousedown so chrome does not steal the caret, then
    // dispatch the engine-level interaction (checkbox toggle, dropdown menu, date picker).
    // (Furniture clicks continue below into the scoped header/footer / note enter paths.)
    const widget = (event.target as Element | null)?.closest?.(
      '[data-docx-cc-widget]'
    ) as HTMLElement | null;
    if (widget) {
      event.preventDefault();
      event.stopPropagation();
      if (widget.hasAttribute('disabled') || widget.dataset.disabledReason) return;
      const controlId = widget.dataset.docxCcId;
      const kind = widget.dataset.docxCcWidget;
      if (controlId && kind) host.onContentControlWidget?.(controlId, kind);
      return;
    }
    // Touch keeps the browser's own panning: claiming the gesture would stop the page
    // scrolling under a finger, which is a much worse trade than a less exact caret.
    if (event.pointerType === 'touch') return;
    // A second pointer arriving mid-gesture used to overwrite the slot, stranding the first
    // one's capture and its listeners — and `dragging()` then stayed true forever, which
    // silently disabled selection adoption for the rest of the surface's life.
    if (gesture) endGesture();

    layerRect = null;
    const layout = host.layout();
    const sheet = sheetPoint(event.clientX, event.clientY);
    const active = host.activeHeaderFooter?.() ?? null;
    const activeNote = host.activeNote?.() ?? null;
    const storyHit = findStoryAtSheetPoint(layout, sheet, host.pageOffsetX);
    const noteHit = findNoteAtSheetPoint(layout, sheet, host.pageOffsetX);
    const furnitureDom = (event.target as Element | null)?.closest('[data-docx-hf]');
    const onFurniture = Boolean(furnitureDom || storyHit);
    const target = event.target as Element | null;
    const noteRefEl = target?.closest<HTMLElement>('[data-docx-note-ref]');
    const noteMarkBackEl = target?.closest<HTMLElement>('[data-docx-note-mark-back]');
    let pressClickCount: number | null = null;
    const clicks = (): number => (pressClickCount ??= countClick(event));

    // Body citation → note; note mark → body (DOM attrs from paint, not React-only).
    if (noteRefEl?.dataset.docxNoteScope) {
      event.preventDefault();
      host.focus();
      host.enterNote?.(noteRefEl.dataset.docxNoteScope);
      return;
    }
    if (noteMarkBackEl) {
      event.preventDefault();
      host.focus();
      host.exitNote?.(true);
      return;
    }

    // Clicking a painted note body enters its editing scope (not HF furniture).
    if (noteHit && !onFurniture) {
      const measurer = host.measurer?.();
      const hit = hitTestFragments(layout, noteHit.pageIndex, noteHit.fragments, noteHit.local, {
        ...(measurer ? { measurer } : {}),
      });
      if (!activeNote || activeNote.scopeId !== noteHit.scopeId) {
        event.preventDefault();
        host.focus();
        host.enterNote?.(
          noteHit.scopeId,
          hit ? { paragraphId: hit.position.paragraphId, offset: hit.position.offset } : undefined,
          noteHit.pageIndex
        );
        return;
      }
      if (activeNote.pageIndex !== noteHit.pageIndex) {
        event.preventDefault();
        host.focus();
        host.enterNote?.(
          noteHit.scopeId,
          hit ? { paragraphId: hit.position.paragraphId, offset: hit.position.offset } : undefined,
          noteHit.pageIndex
        );
        return;
      }
      // The active note uses the ordinary gesture lane below: drag, shift-click and
      // multi-click must behave like body text rather than reopening the scope each time.
    } else if (activeNote) {
      if (!isBodyContentPoint(layout, sheet, host.pageOffsetX)) return;
      // Clicking body text leaves the note and places a fresh body selection at the click,
      // rather than restoring the citation selection first and requiring a second click.
      host.exitNote?.(false);
      host.focus();
    }

    if (active) {
      if (storyHit && storyMatchesBinding(storyHit.story, scopeBinding(active))) {
        // Same shared part on another sheet: retarget the visual occurrence (pageIndex /
        // caret host) without opening a second scope. EditorScope rId stays equal.
        if (storyHit.pageIndex !== active.pageIndex) {
          host.enterHeaderFooter?.(enterRequestFromStoryHit(storyHit, positionInStory(storyHit)));
        }
        // Fall through to the ordinary gesture path for drag / multi-click.
      } else if (storyHit && storyHit.story.rId) {
        // Whole-band hit (whitespace included): switch to that story on any click.
        event.preventDefault();
        host.focus();
        host.enterHeaderFooter?.(enterRequestFromStoryHit(storyHit, positionInStory(storyHit)));
        return;
      } else if (isBodyContentPoint(layout, sheet, host.pageOffsetX)) {
        event.preventDefault();
        host.exitHeaderFooter?.(true);
        host.focus();
        return;
      } else {
        // While a header is open, double-clicking the blank footer band (or vice versa)
        // creates and opens that story — Word's behaviour — instead of swallowing the press.
        const empty =
          clicks() >= 2
            ? findEmptyFurnitureBandAtSheetPoint(layout, sheet, host.pageOffsetX)
            : null;
        if (empty) {
          event.preventDefault();
          host.focus();
          host.enterEmptyHeaderFooter?.(empty.kind, empty.pageIndex);
        }
        return;
      }
    } else if (onFurniture && clicks() >= 2) {
      // Match Word's activation model: an inactive header/footer takes a double click.
      // A single press in page-margin whitespace must not dim and lock the body — fall
      // through to body hit-testing below instead.
      // Enter from the activation band / story box (semantic furniture record). When the
      // DOM hit the painted `[data-docx-hf]` but sheet geometry missed (stale offset, etc.),
      // fall back to the painted relationship id so the press is never a silent no-op.
      if (storyHit?.story.rId) {
        event.preventDefault();
        host.focus();
        host.enterHeaderFooter?.(enterRequestFromStoryHit(storyHit, positionInStory(storyHit)));
      } else if (furnitureDom instanceof HTMLElement) {
        const rId = furnitureDom.dataset.docxRId;
        const kindAttr = furnitureDom.dataset.docxHf;
        const pageAttr = furnitureDom.closest('[data-page-index]')?.getAttribute('data-page-index');
        const pageIndex = pageAttr != null ? Number(pageAttr) : NaN;
        if ((kindAttr === 'header' || kindAttr === 'footer') && Number.isInteger(pageIndex)) {
          if (rId) {
            const page = layout.pages[pageIndex];
            const story = page?.[kindAttr];
            event.preventDefault();
            host.focus();
            host.enterHeaderFooter?.({
              rId,
              pageIndex,
              kind: kindAttr,
              partName: story?.partName ?? '',
              variant: story?.variant ?? 'default',
            });
          } else if (!layout.pages[pageIndex]?.[kindAttr]) {
            // The painted PLACEHOLDER band: `data-docx-hf` with no relationship id marks a
            // page with no story of that kind — create and open it.
            event.preventDefault();
            host.focus();
            host.enterEmptyHeaderFooter?.(kindAttr, pageIndex);
          }
        }
      }
      return;
    } else if (clicks() >= 2) {
      // No painted furniture under the press: a double click in the blank header/footer
      // margin band creates that story and opens it, matching Word. Single presses keep
      // falling through to body hit-testing — a click in the top margin still just places
      // the caret in the nearest body line.
      const empty = findEmptyFurnitureBandAtSheetPoint(layout, sheet, host.pageOffsetX);
      if (empty) {
        event.preventDefault();
        host.focus();
        host.enterEmptyHeaderFooter?.(empty.kind, empty.pageIndex);
        return;
      }
    }

    const hit = resolve(event.clientX, event.clientY);
    if (!hit) return;
    if (host.isReadOnlyParagraph?.(hit.position.paragraphId)) {
      event.preventDefault();
      return;
    }

    if (clicks() === 2 && host.onTextFormDoubleClick?.(event)) return;

    event.preventDefault();
    // Preventing the default cancels the browser's own focus transfer, and the surface only
    // writes the caret into the DOM when it owns the selection — so focus has to be taken
    // explicitly, and BEFORE the selection is set.
    host.focus();

    // Before the first `setSelection`: publishing a selection runs the host's own `onChange`,
    // and a host that throws there used to strand the gesture with no `pointerup` listener —
    // `dragging()` stayed true and killed selection adoption until the next successful press.
    try {
      pagesLayer.setPointerCapture(event.pointerId);
    } catch {
      // Capture is an optimisation, not a requirement — the document listeners below see the
      // rest of the gesture wherever the pointer goes.
    }
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);

    const count = clicks();
    const granularity = event.shiftKey
      ? 'character'
      : GRANULARITIES[(count - 1) % GRANULARITIES.length]!;

    const placeholder = placeholderAtHit(layout, hit);
    if (placeholder && !event.shiftKey) {
      // Prefer the host's atomic select when wired (form-fill / selectControlContent); otherwise
      // expand from layout boundary geometry so placeholder presses never land mid-prompt.
      if (host.selectContentControl?.(placeholder.id)) {
        const selected = host.selection();
        const ordered =
          isBefore(layout, selected.anchor, selected.head) ||
          (selected.anchor.paragraphId === selected.head.paragraphId &&
            selected.anchor.offset === selected.head.offset)
            ? { from: selected.anchor, to: selected.head }
            : { from: selected.head, to: selected.anchor };
        gesture = {
          pointerId: event.pointerId,
          granularity: 'character',
          anchorRange: ordered,
          anchorCell: hit.cell,
          cellDragging: false,
          clientX: event.clientX,
          clientY: event.clientY,
        };
        return;
      }
      const unit = placeholderSelectionRange(layout, placeholder);
      if (unit) {
        gesture = {
          pointerId: event.pointerId,
          granularity: 'character',
          anchorRange: unit,
          anchorCell: hit.cell,
          cellDragging: false,
          clientX: event.clientX,
          clientY: event.clientY,
        };
        publish(() => host.setSelection({ anchor: unit.from, head: unit.to }));
        return;
      }
    }

    if (event.shiftKey) {
      // Extend from the anchor the existing selection already has, so shift-clicking on the
      // far side of a range pivots around the end the user did not place.
      const current = host.selection();
      gesture = {
        pointerId: event.pointerId,
        granularity,
        anchorRange: { from: current.anchor, to: current.anchor },
        anchorCell: hit.cell,
        cellDragging: false,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      publish(() =>
        host.setSelection(
          extend(
            layout,
            { from: current.anchor, to: current.anchor },
            hit.position,
            granularity,
            hit
          )
        )
      );
    } else {
      const anchorRange = rangeAt(layout, hit.position, granularity);
      gesture = {
        pointerId: event.pointerId,
        granularity,
        anchorRange,
        anchorCell: hit.cell,
        cellDragging: false,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      publish(() =>
        host.setSelection(
          absorbPlaceholderControls(layout, { anchor: anchorRange.from, head: anchorRange.to })
        )
      );
    }
  };

  /** Publish a selection without letting a throwing host strand the gesture. */
  function publish(write: () => void): void {
    try {
      write();
    } catch (error) {
      endGesture();
      throw error;
    }
  }

  const onPointerMove = (event: PointerEvent): void => {
    const active = gesture;
    if (!active || event.pointerId !== active.pointerId) return;
    event.preventDefault();
    active.clientX = event.clientX;
    active.clientY = event.clientY;
    extendTo(event.clientX, event.clientY);
    maybeAutoScroll();
  };

  const onPointerUp = (event: PointerEvent): void => {
    const active = gesture;
    if (!active || event.pointerId !== active.pointerId) return;
    endGesture();
    try {
      pagesLayer.releasePointerCapture(active.pointerId);
    } catch {
      // Already released, or never captured.
    }
    // One last assertion of the model's selection over whatever the browser settled on while
    // the gesture was running, now that the drag guard has been lifted. A rectangle has to be
    // re-asserted as a rectangle, or writing the plain selection would collapse it back to
    // the text range it stands in for.
    const cells = host.cellSelection();
    if (cells) host.setCellSelection(cells);
    else host.setSelection(host.selection());
    // Only a real RELEASE settles the selection. `pointercancel` is the browser taking the
    // gesture away — a system touch gesture, a device change — and the range under the
    // pointer at that moment is not one the user chose. Reporting it settled let an armed
    // format painter paint a half-finished drag and then stand down.
    //
    // AFTER the re-assertion above, so anything acting on the settled selection sees the
    // model's answer rather than whatever the browser left behind mid-drag.
    if (event.type === 'pointerup') host.onSelectionSettled?.();
  };

  function endGesture(): void {
    if (gesture) {
      try {
        pagesLayer.releasePointerCapture(gesture.pointerId);
      } catch {
        // Already released, or never captured.
      }
    }
    gesture = null;
    layerRect = null;
    stopAutoScroll();
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
  }

  // A scroll moves the pages under the pointer, so anything cached about where they are is
  // stale. Passive: this only invalidates, it never blocks the scroll.
  const onScroll = (): void => {
    layerRect = null;
  };

  pagesLayer.addEventListener('pointerdown', onPointerDown);
  scrollHost?.addEventListener('scroll', onScroll, { passive: true });
  // Anything that can move the layer under a live pointer invalidates the cached origin, not
  // only the scroller this surface sits in: an ancestor or the window can scroll, and a
  // resize re-centres the page stack. Capture phase, because a scroll on an inner element
  // does not bubble.
  view?.addEventListener('scroll', onScroll, { capture: true, passive: true });
  view?.addEventListener('resize', onScroll, { passive: true });

  return {
    dragging: () => gesture !== null,
    destroy() {
      endGesture();
      pagesLayer.removeEventListener('pointerdown', onPointerDown);
      scrollHost?.removeEventListener('scroll', onScroll);
      view?.removeEventListener('scroll', onScroll, { capture: true });
      view?.removeEventListener('resize', onScroll);
    },
  };
}
