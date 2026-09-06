import { createTextFormFieldInteraction } from './surface-text-form-fields.ts';
import { formsProtectionEnabled, sectionProtectsForms } from '@docx-editor.dev/core/store';
// Engine-owned paginated paragraph surface (composition root).
// Painted pages are the editable surface; seams live in sibling surface-*.ts modules.

/* eslint-disable max-lines -- composition root; seams live in surface-*.ts */

import {
  openTreeSession,
  type TreeApplyResult,
  type TreeDocxSession,
} from '@docx-editor.dev/core/binding';
import {
  TOC_MAX_PAGE_PASSES,
  deepParagraphOrderOfPart,
  detectBodyTocs,
  findNode,
  isContentControl,
  ORIGIN_IDS,
  paragraphOffsetIndex,
  parentNodeOf,
  parseTocInstruction,
  planTocEntries,
  readViewSettings,
  resolveTocRowHeadings,
  validateTreeOp,
  type DetectedToc,
  type OoxmlElement,
  type OoxmlNode,
  type SelectionMark,
  type StoryScope,
  type TreeDocOp,
  type TreeModelChange,
} from '@docx-editor.dev/core/store';
import { resolveSelectedDrawingRecord } from './docx-editor-images.ts';
import { drawingSelectionPosition } from './surface-drawing-selection.ts';
import { syncActiveFieldShading } from './surface-field-shading.ts';
import {
  createLayoutScheduler,
  createLayoutSession,
  createParagraphLayoutCache,
  resolveDefaultSurfaceMeasurer,
  cellSelectionRects,
  keyedRangeRects,
  formatPageNumber,
  emptyTocPlaceholderParagraphIds,
  paragraphFragmentsOf,
  paragraphFragmentsOfBlocks,
  reviewItemKey,
  reviewItemsAt,
  reviewThreadRootOf,
  selectionRects,
  caretAt,
  cellSelectionText,
  contentControlAtSemantic,
  contentControlHoldingParagraph,
  contentControlRecordsInPart,
  contentControlsInLayout,
  createDocumentLinkProjectors,
  resolveNumberingLevel,
  positionPastDeletion,
  withNumberingStyleLinks,
  deletedTextBoundaries,
  wordBoundary,
  type CellSelection,
  type ContentControlBoundaryRecord,
  type KeyedRange,
  type LayoutScope,
  type NavigationCommand,
  type ReviewItem,
  type ReviewRevisionKind,
  type SemanticLayout,
  type SemanticPosition,
  type SemanticSelection,
} from '@docx-editor.dev/core/layout';
import { attachListResolveChangeEvidence } from '../layout/list-resolve.ts';
import { refreshSurfaceRefFieldResults } from './surface-ref-field-refresh.ts';
import {
  DEFAULT_REVISION_DISPLAY_MODE,
  type RevisionAuthorFilter,
  type RevisionDisplayMode,
} from '../layout/revision-projection.ts';
import { markRemovedInMode } from '../layout/revision-visibility.ts';
import {
  createRevisionAuthorVisibility,
  type RevisionAuthorVisibility,
} from './revision-author-visibility.ts';
import { PROPERTY_CHANGE_WRAPPER_OF_OP } from '../store/store/tree-op-tracked-properties.ts';
import { mergedPredecessorsOf } from '../layout/line-segments.ts';
import { mergedFlowBlocks } from '../layout/story-roots.ts';
import { selectionMarkRects } from '../layout/selection-rects.ts';
import { paintSelectionOverlay, type OverlayRect } from '@docx-editor.dev/core/output';
// By module path, like the roster walk below: dropping a retained paint is an engine
// internal for the IME lane, not something the output barrel should offer consumers.
import {
  discardRetainedPaint,
  paintSemanticLayoutWithAuthorSlots,
} from '../output/semantic-paint.ts';
// By module path: the roster walk is an engine internal, not part of the output barrel's
// public surface. See the note there.
import {
  createStableReviewAuthorSlots,
  type ReviewAuthorInfo,
  type StableReviewAuthorSlots,
} from '../output/revision-presentation.ts';
import { createSurfaceReviewAuthors, reviewItemAuthor } from './surface-review-authors.ts';
import { createPresenceColors } from './surface-presence-color.ts';
import {
  DEFAULT_DRAWING_PAINT_STRINGS,
  detachDrawingUrlRegistry,
  drawingPaintStringsCacheToken,
  type DrawingPaintStrings,
} from '../output/semantic-paint-drawings.ts';
import { tryCreateBrowserCanvasContext } from './browser-canvas-context.ts';
import {
  collaborationParagraphAt,
  localCollaborationSelection,
  paintRemoteSelections,
} from './surface-remote-selection.ts';
import type {
  ContentControlOps,
  DrawingSelectionIntent,
  OpenPaginatedResult,
  PaginatedSurface,
  PaginatedSurfaceOptions,
  PaginatedSurfaceState,
  RemoteCaretLabelHost,
  ReviewWriteIntent,
  SurfaceEditingMode,
} from './paginated-surface-contract.ts';
import type { ExecResult, SelectionPin, ViewScope } from '../contracts/editor.ts';
import type { TableCommandPlan } from './table-command-plan.ts';
import {
  clampedToDocument,
  collapsedAt,
  orderedRangeOf,
  selectedTextIn,
  type RangeDeletionPlan,
} from './surface-selection-ops.ts';
import {
  createBeforeInputHandler,
  createClipboardHandlers,
  createKeyDownHandler,
} from './surface-input.ts';
import { createSurfaceClipboardOps } from './surface-clipboard-ops.ts';
import { createSurfaceRangeEditOps } from './surface-range-edit.ts';
import { createNextStyleWrites } from './surface-next-style.ts';
import {
  createFurnitureSource,
  createSurfaceStyleDeps,
  equalPageSets,
  equalSurfaceExtents,
  surfaceExtent,
  surfaceScroller,
  visiblePageSet,
  viewportPage,
  type SurfaceExtent,
} from './surface-pages.ts';
import {
  tryCreateBrowserImageDecodePort,
  createHeadlessImageDecodePort,
} from './browser-image-decode-port.ts';
import { createBrowserPaintImageUrlPort } from './browser-paint-image-url-port.ts';
import { createInlineDrawingLayoutBundle } from '../layout/inline-drawing-source.ts';
import {
  layoutDocumentView,
  type LayoutDocumentViewOptions,
} from '../layout/document-layout-coordinator.ts';
import { createSurfaceCaret } from './surface-caret.ts';
import { defaultTableLabel, type TableInteractionLabelKey } from './table-chrome.ts';
import { createSurfaceTableInteraction } from './surface-table-interaction.ts';
import { createSurfaceFormat } from './surface-format.ts';
import { createSurfaceFormatPainter } from './surface-format-painter.ts';
import {
  authoredRunPropertiesAt,
  mergedProperties,
  mergedMultiSettingProperty,
  type SurfaceProperty,
} from './surface-formatting.ts';
import { createPointerController, type PointerController } from './surface-pointer.ts';
import { selectionsEqual } from './dom-selection.ts';
import { createSurfaceSelectionSync } from './surface-selection-sync.ts';
import { createSurfaceStructure } from './surface-structure.ts';
// Deep import, not the store barrel: re-exporting a bound from there pulls the whole store
// namespace into the published editor-api surface for one number.
import { MIN_TABLE_COLUMN_WIDTH_TWIPS } from '../store/store/table-constraints.ts';
import { createFieldLinkRegistry } from './surface-field-links.ts';
import { createHyperlinkOps } from './surface-hyperlinks.ts';
import { createEquationInteraction, createEquationOps } from './surface-equations.ts';
import { createSurfaceNavigation } from './surface-navigation.ts';
import { drawingLinkByIdFromLayout } from './drawing-link-index.ts';
import {
  furnitureCaretHost,
  navigateInActiveScope,
  noteCaretHost,
  pointerHeaderFooterState,
  scopedDocumentOrder,
  setEditingModeChrome,
  setHeaderFooterEditingChrome,
  storyScopeOf,
  partOfNodeId,
  storyScopeOfNodeId,
} from './surface-scope.ts';
import { createHeaderFooterOps } from './surface-hf-ops.ts';
import { createImageOps } from './surface-image-ops.ts';
import { createHeaderFooterScopeController } from './surface-hf-editing.ts';
import { createNoteOps } from './surface-note-ops.ts';
import { notePropertiesStateOf, notePreviewTextOf } from './surface-note-state.ts';
import { createDerivationPrewarmSteps, scheduleDerivationPrewarm } from './derivation-prewarm.ts';
import { runWithTransactionActor } from '../store/package/actor-scoped-ids.ts';
import { settingsPartOf } from '../store/package/note-properties.ts';
import { resolveNotesPart } from '../store/package/note-references.ts';
import type { OoxmlPart } from '../store/package/ooxml-tree.ts';

export type {
  ContentControlOps,
  ContentControlSurfaceState,
  DrawingSelectionIntent,
  OpenPaginatedResult,
  PaginatedSurface,
  PaginatedSurfaceOptions,
  PaginatedSurfacePerf,
  PaginatedSurfaceState,
  ParagraphFlags,
  SurfaceParagraphFormat,
  ParagraphPropertyEdit,
  ParagraphTabStop,
  RemoteCaretLabelAnchor,
  RemoteCaretLabelHost,
  SectionBreakInsertType,
  ReviewWriteIntent,
  SurfaceFormatting,
} from './paginated-surface-contract.ts';

type ScaleMutableSurface = PaginatedSurface & {
  setScale(nextScale: number): boolean;
  /**
   * The gated, attributed session write for command lanes that live OUTSIDE this file —
   * today the content-control commands. Same collaboration gate and actor attribution as
   * the typing lane (`applyJournaledOps`); the command's own mode/lock gate has already
   * run. Internal, reached by cast like `setScale` — see `applyGatedSurfaceTreeOps` in
   * `content-controls.ts` for the accessor.
   */
  applyGatedTreeOps(
    ops: readonly TreeDocOp[],
    selectionBefore?: SelectionMark | null,
    selectionAfter?: SelectionMark | null,
    scope?: StoryScope
  ): TreeApplyResult;
};

/**
 * The review writes a replica admits, and nothing else.
 *
 * FAIL CLOSED, including for an unnamed intent. Review writes reach the store directly instead of
 * through `applyTreeOps`, and the ones that graft a package and swap the shell record no primitive
 * effects, so they replicate as nothing at all — the peer keeps a `commentReference` naming a
 * comment it never got, which is a corrupt document produced silently. A refusal the user can see
 * is the better failure. Add an intent here only with a two-replica test behind it.
 *
 * Every named intent is admitted today. The set stays, and stays fail-closed, because it is what
 * makes the next review write declare itself before a replica carries it.
 */
const REPLICABLE_REVIEW_WRITES: ReadonlySet<ReviewWriteIntent> = new Set<ReviewWriteIntent>([
  'comment-add',
  'comment-delete',
  'comment-reply',
  'comment-resolve',
  'package-scoped',
  'revision-resolve',
]);

/**
 * Rescale a mounted surface in place, or report that this one cannot be.
 *
 * Reaches an internal member rather than widening the surface contract, so it has to answer
 * for a surface that does not carry one — a stub or a foreign implementation. `false`, not a
 * TypeError: the caller is a host asking for zoom, and "cannot" is an answer it can render.
 */
export function setPaginatedSurfaceScale(surface: PaginatedSurface, scale: number): boolean {
  const rescale = (surface as Partial<ScaleMutableSurface>).setScale;
  if (typeof rescale !== 'function') return false;
  return rescale.call(surface, scale);
}

/**
 * Mount a paginated surface over DOCX bytes.
 *
 * Returns a typed rejection rather than throwing: a failure here is a property of the file,
 * and a host must be able to tell "not a package" from "no body" without parsing an error
 * message.
 */
export function mountPaginatedSurface(
  container: HTMLElement,
  bytes: Uint8Array,
  options: PaginatedSurfaceOptions = {}
): OpenPaginatedResult {
  const runtimeOptions = options as PaginatedSurfaceOptions & {
    readonly onTrackedChange?: () => void;
    readonly reviewAuthorSlots?: StableReviewAuthorSlots;
    readonly revisionAuthorVisibility?: RevisionAuthorVisibility;
    /**
     * Start with this drawing-selection intent. The facade's font-load remount carries the
     * old surface's intent through here, because its caret restore is a same-position
     * `setSelection` whenever the saved caret sits at the mount default — which must stay
     * `none` for a plain open, and so cannot restore a genuinely selected drawing.
     */
    readonly initialDrawingSelectionIntent?: DrawingSelectionIntent;
  };
  const opened = openTreeSession(
    bytes,
    options.reviewModel ? { reviewModel: options.reviewModel } : {}
  );
  if (!opened.ok) {
    return {
      ok: false,
      reason: opened.reason,
      ...(opened.detail ? { detail: opened.detail } : {}),
    };
  }
  const session = opened.session;
  const collaborationSession = options.collaborationModel?.session;
  let author = options.author;
  let scale = options.scale ?? 96 / 72;
  const tableLabelState = {
    resolve:
      options.tableInteractionLabel ?? ((key: TableInteractionLabelKey) => defaultTableLabel(key)),
  };
  const VIEWING_REFUSAL = 'the document is open for viewing';
  /** Document protection, as opposed to the reversible mode — the wording `gateCommand` uses. */
  const READ_ONLY_REFUSAL = 'the document is read-only';
  const TOC_READ_ONLY_REFUSAL = 'the table of contents is generated and read-only';
  /** Separates a decision's key from its per-range index. A NUL cannot occur in either. */
  const RANGE_SUFFIX = '\u0000range\u0000';
  /** One timestamp per edit. The clock is the host's; the store never reads one. */
  // SECONDS precision, like Word. Milliseconds are valid `xsd:dateTime` but no other editor
  // writes them, and two revisions differing only in milliseconds never group.
  const trackedDate = (): string => `${new Date().toISOString().slice(0, 19)}Z`;
  // Editor seam creates the canvas; layout only consumes the injected context.
  let defaults = options.measurer
    ? null
    : resolveDefaultSurfaceMeasurer(scale, {
        context: tryCreateBrowserCanvasContext(container.ownerDocument),
        // Measure with the same face paint draws with.
        ...(options.fontAlias ? { fontAlias: options.fontAlias } : {}),
      });
  let measurer = options.measurer ?? defaults!.measurer;
  // Incremental layout machinery — without these every keystroke re-lays out the document.
  const layoutCache = createParagraphLayoutCache<never>();
  const layoutSession = createLayoutSession();
  /**
   * Measurer identity, folded into every layout cache key so a later font resolution cannot
   * serve stale layout.
   *
   * A HOST measurer answers in POINTS, so it means the same thing at every zoom: its identity
   * is stable, and suffixing it with the scale re-measured the whole document on every zoom
   * click while telling the cache two identical answers differed. The DEFAULT measurer is
   * resolved AT a scale — the canvas one rounds against device pixels — so its identity
   * carries that scale, and it is read from the resolution currently in force rather than from
   * whichever one mount happened to get.
   */
  function producerIdentity(): string {
    if (options.measurer) return options.producer ?? 'host-measurer';
    return `${options.producer ?? defaults?.producer ?? 'fixed-measurer'}@scale:${scale}`;
  }
  let producer = producerIdentity();
  const document = container.ownerDocument;

  const pagesLayer = document.createElement('div');
  pagesLayer.className = 'docx-pages';
  pagesLayer.style.position = 'relative';

  // THE PAINTED PAGES ARE THE EDITABLE SURFACE.
  //
  // An offscreen input host cannot coexist with a selection on the page: a document has one
  // selection, so focusing the host destroys the page's, and a contenteditable host holding
  // focus with no selection inside it stops firing `beforeinput` at all — typing and
  // Backspace simply stopped working. Putting focus on the pages themselves gives the
  // browser one place for selection, caret, highlight, keystrokes and IME.
  //
  // The DOM is still a PICTURE: every mutation the browser proposes is prevented and
  // translated into a tree op, and each commit repaints from layout records, so a stray
  // edit cannot survive. Geometry still comes only from layout.
  pagesLayer.contentEditable = 'true';
  pagesLayer.spellcheck = false;
  pagesLayer.setAttribute('role', 'textbox');
  pagesLayer.setAttribute('aria-multiline', 'true');
  pagesLayer.style.outline = 'none';

  // The one highlight the browser cannot draw. A SIBLING of the pages, never a child: the
  // page painter sweeps anything it did not paint out of its own subtree, and a stray child
  // of a contenteditable is editable content a keystroke could land in.
  const overlayLayer = document.createElement('div');
  overlayLayer.className = 'docx-selection-overlay';
  overlayLayer.contentEditable = 'false';
  overlayLayer.setAttribute('aria-hidden', 'true');
  overlayLayer.style.position = 'absolute';
  overlayLayer.style.left = '0';
  overlayLayer.style.top = '0';
  overlayLayer.style.pointerEvents = 'none';

  // Commented text, highlighted the way Word highlights it. Its own layer OVER the pages —
  // under them the band is invisible, because a page paints an opaque sheet — and the band
  // multiplies rather than covers, which is what a real highlighter does: the yellow darkens
  // the paper and leaves the black glyphs black.
  const commentLayer = document.createElement('div');
  commentLayer.className = 'docx-comment-overlay';
  commentLayer.contentEditable = 'false';
  commentLayer.setAttribute('aria-hidden', 'true');
  commentLayer.style.position = 'absolute';
  commentLayer.style.left = '0';
  commentLayer.style.top = '0';
  commentLayer.style.pointerEvents = 'none';

  const remoteSelectionLayer = document.createElement('div');
  remoteSelectionLayer.className = 'docx-remote-selection-overlay';
  remoteSelectionLayer.contentEditable = 'false';
  remoteSelectionLayer.setAttribute('aria-hidden', 'true');
  remoteSelectionLayer.style.position = 'absolute';
  remoteSelectionLayer.style.left = '0';
  remoteSelectionLayer.style.top = '0';
  remoteSelectionLayer.style.pointerEvents = 'none';

  const tableFurnitureLayer = document.createElement('div');
  tableFurnitureLayer.className = 'docx-table-furniture';
  tableFurnitureLayer.contentEditable = 'false';
  tableFurnitureLayer.style.position = 'absolute';
  tableFurnitureLayer.style.left = '0';
  tableFurnitureLayer.style.top = '0';
  tableFurnitureLayer.style.pointerEvents = 'none';

  container.style.position = 'relative';
  container.replaceChildren(
    pagesLayer,
    tableFurnitureLayer,
    commentLayer,
    remoteSelectionLayer,
    overlayLayer
  );

  const caret = createSurfaceCaret(
    pagesLayer,
    () => scale,
    () => {
      const active = hfScope?.getActive() ?? null;
      const activeNote = noteOps?.activeNoteScope() ?? null;
      const notePageIndex = noteOps?.activeNotePageIndex() ?? null;
      const scopedHost = active
        ? furnitureCaretHost(pagesLayer, active.pageIndex)
        : activeNote
          ? noteCaretHost(pagesLayer, activeNote.id, notePageIndex)
          : null;
      return {
        layout: currentLayout,
        selection,
        measurer,
        ...(active
          ? { preferredPageIndex: active.pageIndex }
          : notePageIndex !== null
            ? { preferredPageIndex: notePageIndex }
            : selectionSync.selectionPageIndex() !== undefined
              ? { preferredPageIndex: selectionSync.selectionPageIndex() }
              : {}),
        scopedHost,
        ...(active
          ? { scopedHostKind: 'headerFooter' as const }
          : activeNote
            ? { scopedHostKind: 'note' as const }
            : {}),
      };
    }
  );

  const initialTocParagraphs = new Set(
    detectBodyTocs(session.part()).flatMap((toc) => [
      toc.beginParagraphId,
      ...toc.resultParagraphIds,
      toc.endParagraphId,
    ])
  );
  const paragraphIds = session.paragraphIds();
  const firstParagraph =
    paragraphIds.find((paragraphId) => !initialTocParagraphs.has(paragraphId)) ??
    paragraphIds[0] ??
    '';
  let selection: SemanticSelection = {
    anchor: { paragraphId: firstParagraph, offset: 0 },
    head: { paragraphId: firstParagraph, offset: 0 },
  };
  /**
   * How the current selection came to address a drawing — Word's object-selection rule.
   *
   * A caret at a drawing's anchor offset is a TEXT caret unless something selected the
   * object: a pointer press on the painted drawing (`pointer`, carrying its id), or an
   * explicit host selection write that moved the caret (`programmatic`). Typing, caret keys,
   * and a press on anything else return it to `none`, so typing beside an anchored image
   * never rings it — and a fresh mount starts at `none`, so a document whose first run
   * anchors a drawing at offset zero does not open with the image selected.
   */
  let drawingIntent: DrawingSelectionIntent = runtimeOptions.initialDrawingSelectionIntent ?? {
    kind: 'none',
  };
  /** Move the intent and report once when it changes — the flip is observable state. */
  function setDrawingIntent(next: DrawingSelectionIntent, report: boolean): void {
    if (
      next.kind === drawingIntent.kind &&
      (next.kind !== 'pointer' ||
        (drawingIntent.kind === 'pointer' && next.drawingNodeId === drawingIntent.drawingNodeId))
    ) {
      return;
    }
    drawingIntent = next;
    // Some transitions land on the exact offsets the selection already holds — a press on
    // the drawing at the untouched mount caret adopts an equal selection and publishes
    // nothing — so the flip must report itself for hosts to show or hide the ring.
    if (report) options.onChange?.(currentState());
  }
  /** Sibling of `selection`: rectangle of table cells, or null for ordinary text. */
  let cellSelection: CellSelection | null = null;
  let lastRejection: string | null = null;
  /** Show-all content-control boundary chrome — surface furniture, never a layout input. */
  let showAllContentControls = false;
  /** Form-fill Tab navigation between editable controls. */
  let formFillMode = false;

  /**
   * A range pinned to stay VISIBLY selected while the focus is somewhere else.
   *
   * A document has one selection. The moment a panel focuses an input of its own, the browser
   * moves that selection into the input and the text the user highlighted stops looking
   * highlighted — which is exactly when they most need to see what the panel is about to act
   * on. Word and Google Docs both keep the range lit; this is how.
   *
   * It is a SIBLING of `selection`, not a replacement: the model selection is untouched, so
   * the op the panel finally runs still addresses the same characters. This only decides what
   * the overlay draws, and how long the panel is entitled to stay open.
   */
  let retainedSelection: SemanticSelection | null = null;
  const retainedSelections = new Map<SelectionPin, SemanticSelection>();

  function restoreLatestRetainedSelection(): void {
    retainedSelection = null;
    for (const retained of retainedSelections.values()) retainedSelection = retained;
  }

  /** Document-order comparison of two positions: negative, zero or positive. */
  function comparePositions(a: SemanticPosition, b: SemanticPosition): number {
    if (a.paragraphId === b.paragraphId) return a.offset - b.offset;
    const order = paragraphOrder();
    return order.indexOf(a.paragraphId) - order.indexOf(b.paragraphId);
  }

  /**
   * Drop the retained range once the caret leaves it.
   *
   * "Leaves" is inclusive of both edges, so clicking at either end of your own selection is
   * still inside it. A COLLAPSED retained position (Ctrl+K with nothing selected) is left the
   * moment the caret moves at all, which is the same rule with a zero-width range.
   */
  function releaseRetainedIfEscaped(next: SemanticSelection): void {
    if (!retainedSelection) return;
    const { from, to } = orderedRangeOf(currentLayout, retainedSelection);
    const head = next.head;
    if (comparePositions(head, from) >= 0 && comparePositions(head, to) <= 0) return;
    retainedSelections.clear();
    retainedSelection = null;
  }

  /**
   * The armed typing format: what was pressed (`properties`) over the face the caret had
   * when it was pressed (`base`). The base is CAPTURED AT ARM TIME, Word's rule — delete
   * the run beside the caret and the next characters still come out in the face you armed,
   * not in whatever run the caret drifted against.
   */
  interface ArmedFormat {
    readonly properties: readonly SurfaceProperty[];
    readonly base: readonly SurfaceProperty[];
  }

  /**
   * The stored-marks lane: run properties armed at a collapsed caret, applied to the next
   * characters typed there (Word's pending-format behavior — Bold at a caret, then type).
   *
   * Anchored to the position it was armed at: a selection change away from it discards it,
   * the caret-preserving edits (Backspace, Delete, Enter) re-anchor it, and `type()` or
   * the IME readback consumes it. The anchor is double-checked at consumption so a missed
   * clearing path degrades to "the format is forgotten", never "the wrong text is styled".
   */
  let pendingFormats: ({ readonly position: SemanticPosition } & ArmedFormat) | null = null;

  /** The armed pending properties, if the selection still sits where they were armed. */
  function pendingAtCaret(): readonly SurfaceProperty[] | null {
    return armedAtCaret()?.properties ?? null;
  }

  /** The full armed state — properties AND captured base — anchored at the current caret. */
  function armedAtCaret(): ArmedFormat | null {
    if (!pendingFormats) return null;
    const at = pendingFormats.position;
    const collapsedThere = (position: SemanticPosition): boolean =>
      position.paragraphId === at.paragraphId && position.offset === at.offset;
    return collapsedThere(selection.anchor) && collapsedThere(selection.head)
      ? pendingFormats
      : null;
  }

  /** Discard pending caret formatting when `next` is not collapsed at its anchor. */
  function reconcilePendingWith(next: SemanticSelection): void {
    if (!pendingFormats) return;
    const at = pendingFormats.position;
    const stays =
      next.anchor.paragraphId === at.paragraphId &&
      next.anchor.offset === at.offset &&
      next.head.paragraphId === at.paragraphId &&
      next.head.offset === at.offset;
    if (!stays) pendingFormats = null;
  }

  /**
   * Apply an insertion together with the armed caret format, and — if the store refuses the
   * combined transaction — apply the insertion ALONE.
   *
   * THE KEYSTROKE IS NOT THE FORMAT'S HOSTAGE. The armed op rides the insert's transaction
   * so the two are one undo step, which means a property the store rejects would take the
   * typed characters down with it, silently, on every keystroke until the caret moved. Arm
   * time already refuses names outside the vocabulary; this covers everything it cannot see
   * — a malformed attribute value, a store rule that only fails against this document — and
   * degrades to "the format is forgotten", which is the promise this lane makes.
   */
  function withoutPendingOnRejection(
    withFormat: readonly TreeDocOp[],
    withoutFormat: readonly TreeDocOp[],
    mark: ReturnType<typeof selectionMark>,
    redoMark?: { paragraphId: string; start: number; end: number }
  ): ReturnType<TreeDocxSession['applyTreeOps']> {
    const result = applyOps([...withFormat], mark, redoMark);
    if (withFormat.length === withoutFormat.length || !result.rejected) return result;
    return applyOps([...withoutFormat], mark, redoMark);
  }

  function consumePendingFormatOps(
    paragraphId: string,
    offset: number,
    length: number,
    /** The range the insert REPLACES, when the caller's insert stands in for one. */
    replacing?: { readonly start: number; readonly end: number }
  ): TreeDocOp[] {
    const armed = armedAtCaret();
    if (!armed || length === 0) return [];
    // The insert this format rides RELOCATES past a deletion the caret rests in — the rule
    // `rangeDeletionPlan` applies through `positionPastDeletion`. The armed anchor must
    // follow the same relocation, or the two positions disagree by construction and the
    // armed ops silently vanish: bold armed inside a `w:del`, then a character typed there,
    // landed correctly and unbold. Identity everywhere else, so the exact-position check
    // still guards a consumer that aims somewhere the caret never was.
    //
    // A REPLACEMENT relocates further: `replacementOffset` also subtracts this author's own
    // retracted insertion, so an anchor sitting anywhere in the replaced range must map
    // through the SAME rule the caller's landing came from. The IME readback composes over
    // the caret's own pending text — the anchor sat at the range end, the landing did not,
    // and the armed format silently dropped on every composed replacement.
    const anchor = pendingFormats!.position;
    const at =
      replacing &&
      anchor.paragraphId === paragraphId &&
      anchor.offset >= replacing.start &&
      anchor.offset <= replacing.end
        ? {
            paragraphId,
            offset: replacementOffset(
              { paragraphId, offset: replacing.start },
              { paragraphId, offset: replacing.end }
            ),
          }
        : positionPastDeletion(currentLayout, anchor);
    if (at.paragraphId !== paragraphId || at.offset !== offset) return [];
    return [
      {
        op: 'setRunProperties',
        paragraphId,
        start: offset,
        end: offset + length,
        // Merged per attribute for the multi-setting properties, exactly as the selection
        // path does: a font armed at a caret and then typed must keep the run's other font
        // slots, or the two halves of one feature disagree.
        properties: armed.properties.reduce(
          (merged, property) =>
            mergedProperties(merged, mergedMultiSettingProperty(merged, property)),
          [...armed.base]
        ),
      },
    ];
  }

  /** Filled once selection sync exists; enter/exit need its noteModelMoved/mirror helpers. */
  let hfScope: ReturnType<typeof createHeaderFooterScopeController> | null = null;
  let noteOps: ReturnType<typeof createNoteOps> | null = null;
  /**
   * Memo for `notePropertiesState`, keyed on the COMPLETE read set of
   * {@link notePropertiesStateOf}. `packageRevision` covers every publishing
   * mutation (story transact, lifecycle ops, undo/redo, `publishStoryWrite`
   * all bump it), but two kinds of input move without one. The open
   * header/footer occurrence is UI state: inheritance lets one part serve
   * several sections, so re-entering it from another section changes the
   * answer while the revision and the caret paragraph both stand still. And
   * shell installs (`replacePackageShell`, `installPackageSnapshot`) can swap
   * parts without a bump, so the parts the computation walks — body for
   * `w:sectPr` and note references, settings for `w:footnotePr`/`w:endnotePr`,
   * the notes parts for a note caret's citing paragraph — join by object
   * identity, for the same reason `currentPackage()` keys on identity rather
   * than revision. The selection OFFSET is deliberately absent: the
   * computation reads only the head paragraph id, and section membership
   * cannot change within one paragraph (pinned in
   * `__tests__/note-properties-section.test.ts`).
   */
  let notePropertiesCache: {
    readonly packageRevision: number;
    readonly paragraphId: string;
    readonly bodyPart: OoxmlPart;
    readonly settingsPart: OoxmlPart | null;
    readonly footnotesPart: OoxmlPart | null;
    readonly endnotesPart: OoxmlPart | null;
    readonly headerFooterOpen: boolean;
    readonly headerFooterRId: string | null;
    readonly headerFooterSectionIndex: number | null;
    readonly result: ReturnType<typeof notePropertiesStateOf>;
  } | null = null;
  const storyScope = () =>
    storyScopeOf(hfScope?.getActive() ?? null, noteOps?.activeNoteScope() ?? null);
  const noteScopeId = () => noteOps?.activeNoteScope()?.id ?? null;
  /**
   * The section a page belongs to, and where that section starts.
   *
   * A page is the only thing a pointer entry knows, and a header belongs to a SECTION: one
   * header may be referenced by several, and their page geometry can differ. Without this the
   * entry defaulted to section 0, so double-clicking the header on a landscape page answered
   * with the first section's portrait width — which is the ruler's clamp and the grid width
   * `insertTableOp` divides.
   *
   * A single-section document has no spans and every page belongs to section 0.
   */
  const sectionAtPage = (pageIndex: number): { sectionIndex: number; sectionStart: number } => {
    const spans = layoutSession.multi?.spans;
    let sectionIndex = 0;
    let sectionStart = 0;
    if (spans && spans.length > 0) {
      for (let index = 0; index < spans.length; index += 1) {
        const span = spans[index]!;
        sectionIndex = index;
        sectionStart = span.startIndex;
        if (pageIndex < span.startIndex + span.pageCount) break;
      }
    }
    return { sectionIndex, sectionStart };
  };

  const paragraphOrder = () =>
    scopedDocumentOrder(currentLayout, hfScope?.getActive() ?? null, noteScopeId());
  // Phase timers, one slot per phase rather than a log: the state reports the LAST pass,
  // and a host that wants history samples `onChange`. `performance.now()` where the host
  // has one — monotonic, sub-millisecond — and wall clock where it does not (a bare test
  // runtime), which is fine for numbers only ever read by a human.
  const now = (): number => globalThis.performance?.now() ?? Date.now();
  let lastLayoutMs = 0;
  let lastPaintMs = 0;
  let lastSelectionMs = 0;

  // Style and numbering indexes are identity-memoized and shared by every story.
  const { styleCascade, numberingIndex, defaultTabStopPt } = createSurfaceStyleDeps(session);
  // Word's "style for following paragraph". Its own lane, because it is a question about
  // `styles.xml` rather than about the selection an Enter is standing in.
  const nextStyle = createNextStyleWrites({
    styleCascade,
    // A pure read: `partOfNodeId`, never `partFor`, which would permanently retain a story
    // store just to answer what style a paragraph is in.
    partOf: (paragraphId) => partOfNodeId(session, paragraphId) ?? session.part(),
  });
  let onDrawingResourcesChanged: (() => void) | null = null;
  const decodePort =
    options.imageDecodePort ??
    tryCreateBrowserImageDecodePort(document) ??
    createHeadlessImageDecodePort();
  const drawingBundle = createInlineDrawingLayoutBundle({
    session,
    decodePort,
    onResourcesChanged: () => onDrawingResourcesChanged?.(),
  });
  let drawingStrings: DrawingPaintStrings = options.drawingStrings ?? DEFAULT_DRAWING_PAINT_STRINGS;
  let tocLabels = options.tocLabels;
  /**
   * The insertion point, or null when the selection is not collapsed — a range has two ends
   * and is not "inside" anything, and a second background under one of them would read as a
   * second selection.
   *
   * Collapsed-ness ONLY. Focus and IME composition are the painted caret's own state, held in
   * `surface-caret.ts`, and are not consulted here — so field shading stays lit across a blur
   * and through a composition, which is what Word does with a field the caret is in.
   */
  const collapsedCaretPosition = (): { paragraphId: string; offset: number } | null => {
    if (
      selection.anchor.paragraphId !== selection.head.paragraphId ||
      selection.anchor.offset !== selection.head.offset
    ) {
      return null;
    }
    return { paragraphId: selection.head.paragraphId, offset: selection.head.offset };
  };
  /**
   * `w:doNotShadeFormData`, memoized per package revision.
   *
   * Read on every paint otherwise, and paint runs far more often than `settings.xml` changes —
   * the same reason every other settings read in the engine is revision-keyed.
   */
  let formFieldShadingRevision = -1;
  let formFieldShading = true;
  const shadeFormFields = (): boolean => {
    const revision = session.packageRevision();
    if (formFieldShadingRevision !== revision) {
      formFieldShadingRevision = revision;
      // Inverted at the read: the setting says what NOT to do, the painter wants what to do.
      formFieldShading = !readViewSettings(session.settingsRoot()).doNotShadeFormData;
    }
    return formFieldShading;
  };
  const paintImageUrlPort = createBrowserPaintImageUrlPort({
    mintValidatedBytes: (handle, expectedContentId) =>
      drawingBundle.mintValidatedBytes(handle, expectedContentId),
  });
  /**
   * Which revision halves this surface is SHOWING — the one answer every lane asks for.
   *
   * Layout, furniture and the FORMATTING walks read it: a write must not restyle text the
   * view hides, because the store offsets cover every revision half whatever the view does
   * with them (#497). A function rather than a constant so a future
   * `setRevisionDisplayMode` moves every reader at once.
   */
  const revisionDisplayMode = (): RevisionDisplayMode =>
    options.revisionDisplayMode ?? DEFAULT_REVISION_DISPLAY_MODE;
  const revisionAuthorVisibility =
    runtimeOptions.revisionAuthorVisibility ??
    createRevisionAuthorVisibility(options.hiddenRevisionAuthors);
  const revisionFilter = (): RevisionAuthorFilter | undefined =>
    revisionAuthorVisibility.filterForSession(session);
  const paragraphMarkVisible = (paragraphId: string): boolean => {
    const part = partOfNodeId(session, paragraphId) ?? session.part();
    const paragraph = findNode(part, paragraphId);
    if (paragraph?.kind !== 'paragraph') return false;
    const displayMode = revisionDisplayMode();
    const authorFilter = revisionFilter();
    if (!markRemovedInMode(paragraph, displayMode, authorFilter)) return true;
    const parent = parentNodeOf(part, paragraphId);
    if (!parent) return false;
    return mergedFlowBlocks(parent.children, displayMode, authorFilter).some(
      (block) => block.kind === 'paragraph' && block.id === paragraphId
    );
  };

  let furnitureSource: ReturnType<typeof createFurnitureSource>;

  /**
   * The engine's ONE hyperlink trust boundary, handed to layout.
   *
   * The resolver reads the session's live relationships, so a link inserted this session
   * resolves immediately rather than only after a save and reopen. `hyperlinkTargetOf`
   * produces the sanitized projection; everything downstream — paint, click routing, the
   * popover, the clipboard — consumes only that.
   */
  const linkProjectors = createDocumentLinkProjectors(session);

  /**
   * The SAME boundary for HYPERLINK fields: the raw instruction target crosses
   * `sanitizeHref` inside the registry, which also remembers every minted record so a click
   * on the painted anchor resolves through `linkById` like a typed link's does.
   */
  const fieldLinks = createFieldLinkRegistry();
  type SurfaceFurnitureOptions = Parameters<typeof createFurnitureSource>[0];
  const createCurrentFurnitureSource = (
    authorFilter?: RevisionAuthorFilter
  ): ReturnType<typeof createFurnitureSource> =>
    createFurnitureSource({
      session,
      measurer,
      producer,
      cache: layoutCache,
      styleCascade,
      numberingIndex,
      defaultTabStopPt,
      // Furniture answers the document's display mode, like the body does — and it is named
      // even when it is the default, because a lane that says nothing is treated as saying
      // "not All Markup", which is what keeps markup out of the resolved views.
      displayMode: revisionDisplayMode(),
      revisionAuthorFilter: authorFilter,
      inlineDrawingLayoutForPart: (partName) => drawingBundle.contextForPart(partName),
      drawingLayoutTokenForPart: (partName) => drawingBundle.cacheTokenForPart(partName),
      drawingTokenForParagraphForPart: (partName, paragraph) =>
        drawingBundle.drawingTokenForParagraph(paragraph, partName),
      linkProjectors,
      projectFieldLink: (spec) => fieldLinks.project(spec),
    } satisfies SurfaceFurnitureOptions & Record<keyof SurfaceFurnitureOptions, unknown>);
  furnitureSource = createCurrentFurnitureSource(revisionFilter());

  interface LayoutDocumentContext {
    readonly authorFilter?: RevisionAuthorFilter;
    readonly layoutSession: ReturnType<typeof createLayoutSession>;
    readonly furnitureSource: ReturnType<typeof createCurrentFurnitureSource>;
  }

  /**
   * The session as every lane sees it: the mode rules applied to `applyTreeOps`.
   *
   * Gating one function inside this file was not enough. Breaks, lists, indent, section
   * properties, formatting, hyperlinks and the IME readback are their own lanes over the
   * SAME session, and each called `applyTreeOps` on it directly — so a "read-only" document
   * still took Ctrl-B, a page-orientation change and a bullet toggle, and suggesting mode
   * wrote an untracked tab or line break while the user believed they were proposing.
   * Wrapping the session is the only place that covers a lane nobody has written yet.
   */
  const gatedSession: TreeDocxSession = {
    ...session,
    // The SCOPE has to travel. `applyOps` defaults it to the open story, so dropping the
    // argument here silently rewrote every caller that named one — and the one caller that
    // needs to is section geometry, which pins `{ kind: 'body' }` because `w:sectPr` lives on
    // the body story and nowhere else. A header store has no `w:body`, so with the caret in a
    // header every page-setup write was refused as `tree-invariant`: the ruler snapped back and
    // Page Setup's Apply did nothing, with the dialog still reading the right section.
    applyTreeOps: (ops, before, after, scope) => applyOps(ops, before, after, scope),
    // List definitions mint `numId` on the package before the paragraph op names it, so
    // the typing transaction never binds an actor for that scan. Same wrap the hyperlink
    // mint uses.
    ensureListDefinition: (kind) =>
      runWithTransactionActor(collaborationSession?.identity.actorId, () =>
        session.ensureListDefinition(kind)
      ),
    applyPmDoc: (doc) => {
      if (editingMode === 'view') {
        return { committed: false, rejected: true, opCount: 0, reason: VIEWING_REFUSAL };
      }
      // Not "text-only" — replication carries the whole package. This path derives ordinary tree
      // ops and commits them through the same journaled transaction `applyTreeOps` uses, so the
      // mechanism is the proven one. What is unproven is the DERIVATION: no host in this repo
      // drives the editor through a ProseMirror doc, so no two-replica test covers a diff that
      // refuses or under-describes an edit. Admitting it would ship a replicated path nothing
      // exercises. Prove it, then lift it.
      if (collaborationSession) {
        return {
          committed: false,
          rejected: true,
          opCount: 0,
          reason: 'collaboration-pm-doc-unproven',
        };
      }
      if (selectionTouchesToc()) {
        return { committed: false, rejected: true, opCount: 0, reason: TOC_READ_ONLY_REFUSAL };
      }
      return session.applyPmDoc(doc);
    },
  };

  let currentLayout = layoutOnce();
  // Declared before the first paint can run — `render` reads it.
  let revisionStyles = options.revisionStyles;
  // The facade owns this across internal remounts of the SAME attached document. A direct
  // surface mount has no facade session, so it correctly starts a fresh assignment here.
  const stableAuthorSlots = runtimeOptions.reviewAuthorSlots ?? createStableReviewAuthorSlots();
  const reviewAuthors = createSurfaceReviewAuthors({
    layout: () => currentLayout,
    items: () => session.reviewItems(),
    styles: () => revisionStyles,
    slots: stableAuthorSlots,
  });
  // Structural edits — breaks, lists, indent, sections — are their own lane over the same
  // session and commit path.
  /**
   * Arm, replace, or clear the typing format at the caret (Word's stored marks).
   *
   * A named function rather than an inline dep because TWO lanes drive it: the formatting
   * lane, when a toggle or a picker lands on a collapsed caret, and the format painter,
   * when a paint lands on one. A second arming path would be a second place the base is
   * captured and a second place the caret-move rule could be forgotten.
   */
  function setPendingFormats(next: readonly SurfaceProperty[] | null): void {
    if (next === null || next.length === 0) {
      if (!pendingFormats) return;
      pendingFormats = null;
    } else {
      // Armed only at a collapsed caret — a range selection formats directly. The base
      // is captured on the FIRST arm at this caret and kept across further presses:
      // it is the face the user saw when they started pressing buttons.
      const { anchor, head } = selection;
      if (anchor.paragraphId !== head.paragraphId || anchor.offset !== head.offset) return;
      const base =
        armedAtCaret()?.base ??
        authoredRunPropertiesAt(
          session.partFor(storyScope()) ?? session.part(),
          head.paragraphId,
          head.offset,
          revisionDisplayMode(),
          revisionFilter()
        );
      pendingFormats = { position: head, properties: next, base };
    }
    // Not document state, but observable state: the toolbar's Bold must light up NOW,
    // and the snapshot cache invalidates on this report.
    options.onChange?.(currentState());
  }

  const format = createSurfaceFormat({
    session: gatedSession,
    storyScope,
    paragraphOrder,
    layout: () => currentLayout,
    selection: () => selection,
    displayMode: () => revisionDisplayMode(),
    authorFilter: revisionFilter,
    paragraphMarkVisible,
    commit: (run, nextSelection, options) => commit(run, nextSelection, options),
    orderedRange: () => orderedRange(),
    selectionMark: () => selectionMark(),
    textOf: (paragraphId) => textOf(paragraphId),
    selectedCells: () => cellSelection?.cellIds,
    defaultParagraphStyleId: () => styleCascade()?.defaultParagraphStyleId ?? null,
    defaultFontFamily: () => options.defaultFontFamily ?? null,
    pendingFormats: () => pendingAtCaret(),
    setPendingFormats,
  });
  const formatPainter = createSurfaceFormatPainter({
    session: gatedSession,
    storyScope,
    layout: () => currentLayout,
    selection: () => selection,
    displayMode: () => revisionDisplayMode(),
    authorFilter: revisionFilter,
    paragraphMarkVisible,
    commit: (run, nextSelection, commitOptions) => commit(run, nextSelection, commitOptions),
    orderedRange: () => orderedRange(),
    selectionMark: () => selectionMark(),
    textOf: (paragraphId) => textOf(paragraphId),
    paragraphOrder,
    selectedCells: () => cellSelection?.cellIds,
    // The painter's collapsed-caret lane IS the stored-marks lane — no second arming path,
    // so a caret-painted format is discarded by a caret move like any other armed one.
    armPendingFormats: (properties) => setPendingFormats(properties),
    now,
    publish: () => {
      // The armed cursor is the ONLY thing on screen that says the next drag will paint,
      // and it lives on the pages layer rather than on a class the host owns — a host that
      // renders no toolbar still gets the affordance.
      const armed = formatPainter.state().mode !== 'off';
      if (armed) pagesLayer.dataset['formatPainter'] = '';
      else delete pagesLayer.dataset['formatPainter'];
      options.onChange?.(currentState());
    },
  });
  const structure = createSurfaceStructure({
    session: gatedSession,
    storyScope,
    headerFooterSectionIndex: () => hfScope?.getActive()?.sectionIndex,
    revisionDisplayMode,
    revisionAuthorFilter: revisionFilter,
    paragraphOrder,
    // A rectangle is not the range it stands in for — the same question `createSurfaceFormat`
    // asks. Without it, bulleting or indenting one selected column also hit the cells between
    // its corners in document order.
    selectedCells: () => cellSelection?.cellIds,
    editingMode: () => editingMode,
    publishRefusal: (reason) => {
      lastRejection = reason;
      // Published like every other early-return refusal in this file. It does not EMIT: the
      // facade treats a publish that moves neither the selection nor the pending format as
      // quiet, which a refusal is. What it does do is invalidate the version-cached
      // `snapshot()`, so the reason is there the moment anyone reads it. Stored alone it was
      // not — the snapshot kept its stale value until an unrelated tick bumped the version,
      // and then delivered a section break's message on a caret move.
      options.onChange?.(currentState());
    },
    // RAW, on purpose: `orderedRange()` flushes pending input, and this is asked from `can`.
    caretParagraphId: () =>
      selection.anchor.paragraphId === selection.head.paragraphId &&
      selection.anchor.offset === selection.head.offset
        ? selection.head.paragraphId
        : null,
    layout: () => currentLayout,
    // Structural edits at the caret KEEP the armed typing format, the way Word does: a
    // Shift+Enter line break, a Tab, a page break or turning the paragraph into a list item
    // all leave the user typing at a new caret in the face they armed. Captured before the
    // ops run, re-anchored at the post-edit caret.
    commit: (run, nextSelection, options) =>
      commit(run, nextSelection, {
        rearmPending: armedAtCaret() ?? undefined,
        ...(options?.keepCellSelection ? { keepCellSelection: true } : {}),
      }),
    orderedStart: () => orderedStart(),
    orderedRange: () => orderedRange(),
    selectionMark: () => selectionMark(),
    collapsedAt: (position) => collapsedAt(position),
    deleteSelectionPlan: () => deleteSelectionPlan(),
    paragraphTextOf: (paragraphId) => textOf(paragraphId),
    // Resolved through `w:numStyleLink` the way LAYOUT resolves markers (§17.9.21):
    // against the raw index a delegating definition has no levels of its own, so every
    // level of Word's List Bullet / List Number styles read as missing and a plain
    // `setListLevel` was refused where layout would have rendered the marker fine.
    numberingLevelExists: (numId, level) =>
      resolveNumberingLevel(
        withNumberingStyleLinks(numberingIndex(), styleCascade()),
        numId,
        level
      ) !== null,
  });
  /** The contract's `replacementLanding`; the hyperlink lane reads the same rule. */
  function replacementLanding(paragraphId: string, start: number, end: number): number | null {
    if (editingMode !== 'suggest') return null;
    // A POSITIONAL READ, and it does not settle anything itself: flushing here would commit
    // buffered typing in the middle of a caller that had already captured the offsets it
    // builds ops from. Both callers settle first — the hyperlink lane through
    // `orderedRange()`, an automation batch at its own entry — which is where a flush belongs.
    return replacementOffset({ paragraphId, offset: start }, { paragraphId, offset: end });
  }

  const hyperlinks = createHyperlinkOps({
    session: gatedSession,
    // A HYPERLINK field is not a tree node, so its link resolves from the layout projection
    // plus the field-link registry rather than the typed tree walk.
    layout: () => currentLayout,
    fieldLinkById: (linkId) => fieldLinks.linkById(linkId),
    // Asked BEFORE the relationship is minted. The gated session refuses the ops in viewing mode
    // either way, but the mint is a package write that the refusal does not roll back — Ctrl+K in a
    // document open for reading left its target declared in `.rels`.
    refusesWrite: () => writeRefusal(true) !== null,
    withMintActor: (mint) => runWithTransactionActor(collaborationSession?.identity.actorId, mint),
    storyScope,
    // Non-null exactly when suggesting: the link lane then replaces with tracked ops.
    replacementLanding,
    insertionLanding: (paragraphId, offset) =>
      positionPastDeletion(currentLayout, { paragraphId, offset }).offset,
    selection: () => selection,
    orderedRange: () => orderedRange(),
    selectionMark: () => selectionMark(),
    textOf: (paragraphId) => textOf(paragraphId),
    commit: (run, selectionAfter) => commit(run, selectionAfter),
  });
  const equations = createEquationOps({
    session: gatedSession,
    storyScope,
    editingMode: () => editingMode,
    writeRefusal: (op) => writeRefusal(true, [op]),
    selection: () => selection,
    selectionMark: () => selectionMark(),
    commit: (run, selectionAfter) => commit(run, selectionAfter),
  });
  /**
   * Put the surface in the story that holds `paragraphId`, for a JUMP.
   *
   * A bookmark or an internal link can name a paragraph in any story, and moving the caret
   * there while the scope stayed on the body left the two disagreeing: `activeScope` said
   * body, the caret sat on a paragraph the body store has never heard of, and every keystroke
   * after it was refused with nothing said. False means the story could not be opened, and the
   * caller must not jump anyway.
   */
  const enterStoryHolding = (paragraphId: string): boolean => {
    const scope = storyScopeOfNodeId(session, paragraphId, { kind: 'body' });
    if (scope.kind === 'body') {
      // Leaving is unconditional here, unlike entering: a body target is not somewhere
      // staying in the open story could help.
      noteOps?.exitNote();
      hfScope?.exitHeaderFooter();
      return true;
    }
    if (scope.kind === 'headerFooter') {
      const active = hfScope?.activeScope();
      if (active?.kind === 'headerFooter' && active.rId === scope.rId) return true;
      noteOps?.exitNote();
      return hfScope?.enterHeaderFooter({ rId: scope.rId }) ?? false;
    }
    // A notes PART holds every note, so the scope has to name the NOTE the paragraph is in,
    // and only the painted layout knows which one that is.
    const scopeId = noteScopeIdHolding(paragraphId);
    if (!scopeId) return false;
    if (noteOps?.activeNoteScope()?.id === scopeId) return true;
    hfScope?.exitHeaderFooter();
    return noteOps?.enterNote(scopeId) ?? false;
  };

  /** The note whose painted fragments hold this paragraph, or null. */
  const noteScopeIdHolding = (paragraphId: string): string | null => {
    for (const page of currentLayout.pages) {
      for (const area of [page.footnotes, page.endnotes]) {
        if (!area) continue;
        for (const note of area.notes) {
          for (const fragment of paragraphFragmentsOfBlocks(note.fragments)) {
            if (fragment.paragraphId === paragraphId) return note.scopeId;
          }
        }
      }
    }
    return null;
  };

  const navigation = createSurfaceNavigation({
    pagesLayer,
    container,
    scale: () => scale,
    layout: () => currentLayout,
    bookmarks: () => session.bookmarks(),
    // Field-derived ids first: they are a closed `field-hyperlink:` namespace, and the typed
    // lane's tree walk could never answer for them.
    linkById: (linkId) => fieldLinks.linkById(linkId) ?? hyperlinks.linkById(linkId),
    drawingLinkById: (drawingNodeId) => drawingLinkByIdFromLayout(currentLayout, drawingNodeId),
    setSelection: (position) => setSelection(collapsedAt(position)),
    enterStoryFor: (paragraphId) => enterStoryHolding(paragraphId),
    isCollapsedSelection: () =>
      selection.anchor.paragraphId === selection.head.paragraphId &&
      selection.anchor.offset === selection.head.offset,
    onScrolled: () => rematerialize(),
    ...(options.onHyperlinkPopover ? { onPopover: options.onHyperlinkPopover } : {}),
  });
  const equationInteraction = createEquationInteraction({
    pagesLayer,
    equationById: (equationId) => equations.equationById(equationId),
    setSelection,
    ...(options.onEquationPopover ? { onPopover: options.onEquationPopover } : {}),
  });
  pagesLayer.addEventListener('contextmenu', onTocContextMenu);
  pagesLayer.addEventListener('click', onTocRowClick);
  pagesLayer.addEventListener('pointermove', onTocPointerMove);
  pagesLayer.addEventListener('pointerleave', onTocPointerLeave);
  let desiredX: number | null = null;
  function layoutDocument(
    revision: number,
    scope?: LayoutScope,
    context?: LayoutDocumentContext
  ): SemanticLayout {
    const activeAuthorFilter = context ? context.authorFilter : revisionFilter();
    const activeLayoutSession = context?.layoutSession ?? layoutSession;
    const activeFurnitureSource = context?.furnitureSource ?? furnitureSource;
    if (scope) attachListResolveChangeEvidence(activeLayoutSession, scope);
    drawingBundle.sync(session);
    return layoutDocumentView({
      view: session,
      revision,
      measurer,
      cache: layoutCache,
      session: activeLayoutSession,
      producer,
      styleCascade,
      defaultTabStopPt,
      numberingIndex,
      furniture: activeFurnitureSource,
      linkProjectors,
      projectFieldLink: (spec) => fieldLinks.project(spec),
      inlineDrawingLayout: drawingBundle.bodyContext,
      inlineDrawingLayoutForPart: (partName) => drawingBundle.contextForPart(partName),
      drawingTokenForParagraph: (paragraph) =>
        drawingBundle.drawingTokenForParagraph(paragraph, session.part().name),
      drawingTokenForParagraphForPart: (partName, paragraph) =>
        drawingBundle.drawingTokenForParagraph(paragraph, partName),
      // The part-level epoch that lets the section prepass memo trust the tokens above
      // without re-asking every paragraph on every pass.
      drawingLayoutEpoch: drawingBundle.cacheTokenForPart(session.part().name),
      drawingLayoutEpochForPart: (partName) => drawingBundle.cacheTokenForPart(partName),
      // The layout context key already folds the mode in (`|rev:<mode>`), so a surface
      // constructed `proposed` never shares cached pages with an `all-markup` one.
      displayMode: revisionDisplayMode(),
      revisionAuthorFilter: activeAuthorFilter,
    } satisfies LayoutDocumentViewOptions & Record<keyof LayoutDocumentViewOptions, unknown>);
  }

  /** Build save-time PAGEREF numbers without mutating the active filtered layout. */
  function canonicalUnfilteredLayoutForSave(): SemanticLayout {
    return layoutDocument(session.packageRevision(), undefined, {
      layoutSession: createLayoutSession(),
      furnitureSource: createCurrentFurnitureSource(undefined),
    });
  }

  function layoutOnce(): SemanticLayout {
    const began = now();
    const layout = layoutDocument(session.packageRevision());
    lastLayoutMs = now() - began;
    return layout;
  }

  let deferredPublishRender: ReturnType<typeof setTimeout> | null = null;

  // Armed once, after the first published render: the derivations a structural edit reads
  // populate their per-node memos in idle tasks instead of inside the first Enter. An edit
  // before the warm finishes stops it (the edit's own reads populate the new root), and
  // view mode never warms (nothing structural can be typed there).
  let cancelDerivationPrewarm: (() => void) | null = null;
  let derivationPrewarmArmed = false;

  function armDerivationPrewarmOnce(): void {
    if (derivationPrewarmArmed) return;
    derivationPrewarmArmed = true;
    const revisionAtArm = session.packageRevision();
    cancelDerivationPrewarm = scheduleDerivationPrewarm({
      steps: createDerivationPrewarmSteps(() => session.part()),
      shouldRun: () =>
        editingMode !== 'view' && session.editable && session.packageRevision() === revisionAtArm,
      hasPendingInput: hasPendingBrowserInput,
    });
  }

  /**
   * `includeContinuous` folds mousemove/wheel into the answer. Paint deferral wants that
   * (any input beats a repaint); the commit-tail LAYOUT deferral must not — a moving
   * pointer over a large document would otherwise defer every toolbar op, paste and
   * programmatic write, so that gate asks for discrete input (keys, clicks) only.
   */
  function hasPendingBrowserInput(includeContinuous = true): boolean {
    const scheduling = (
      container.ownerDocument.defaultView?.navigator as
        | (Navigator & {
            scheduling?: {
              isInputPending?: (options?: { includeContinuous?: boolean }) => boolean;
            };
          })
        | undefined
    )?.scheduling;
    return scheduling?.isInputPending?.({ includeContinuous }) ?? false;
  }

  function renderPublishedLayout(): void {
    if (!hasPendingBrowserInput()) {
      // `render()` retires any armed deferred publish render itself.
      render();
      armDerivationPrewarmOnce();
      return;
    }
    // Paint and DOM selection do not need to run once per event already waiting in the
    // browser's input queue. One task catches the view up to the newest published layout;
    // ordinary isolated edits still render synchronously through the branch above.
    if (deferredPublishRender !== null) return;
    deferredPublishRender = setTimeout(() => {
      deferredPublishRender = null;
      // Superseded: a newer commit is already pending, so this layout is not the one the
      // user will see — its own publish paints and reports. Painting here anyway spent one
      // full render per flush batch on a frame one commit behind, and mirrored the newer
      // model selection into the older spans.
      if (scheduler.pending() !== null) return;
      render();
      armDerivationPrewarmOnce();
    }, 0);
  }

  // ---- Batched typing ----------------------------------------------------
  //
  // A keystroke burst used to pay one commit + one synchronous layout PER
  // CHARACTER, so a backlog of N queued keys blocked the main thread for
  // N × flush. The DOM input pathway now appends plain `insertText` data here
  // and lands the whole buffer through ONE `type()` call — one transaction,
  // one tracked `w:ins`, one undo step, one layout flush. The flush task is a
  // plain `setTimeout(0)`: queued input events outrank timers, so every key
  // already waiting appends before the timer fires, and an isolated keystroke
  // still lands within the same event-loop turn.
  //
  // The buffer holds TEXT ONLY, no position: `type()` resolves the model
  // selection at flush time, and every other way the selection or document can
  // move flushes the buffer first (`commit` head-flush plus the explicit
  // flushes on selection, undo/redo, geometry reads, composition, save and
  // teardown), so the selection at flush time is the selection the first
  // buffered key saw.
  let typeBuffer = '';
  let typeFlushTimer: ReturnType<typeof setTimeout> | null = null;
  let flushingTypeBuffer = false;

  function flushTypeBuffer(): void {
    // Reentrancy first, timer second: a reentrant call (host code inside the
    // flush's own onChange enqueuing more text) must not clear the fresh timer
    // that new text just armed, or it would sit unflushed until an unrelated
    // flush point.
    if (flushingTypeBuffer) return;
    if (typeFlushTimer !== null) {
      clearTimeout(typeFlushTimer);
      typeFlushTimer = null;
    }
    if (typeBuffer.length === 0) return;
    const text = typeBuffer;
    typeBuffer = '';
    flushingTypeBuffer = true;
    try {
      // `surface` is assigned below; a flush can only run once a caller holds it.
      surface.type(text);
    } catch (error) {
      // A throwing commit must not eat the keystrokes: put them back (ahead of
      // anything enqueued meanwhile, preserving order) for the next flush point.
      typeBuffer = text + typeBuffer;
      throw error;
    } finally {
      flushingTypeBuffer = false;
    }
  }

  function enqueueType(text: string): void {
    typeBuffer += text;
    if (typeFlushTimer !== null) return;
    typeFlushTimer = setTimeout(() => {
      typeFlushTimer = null;
      flushTypeBuffer();
    }, 0);
  }

  function commitProposedTextChange(
    kind: 'insertion' | 'deletion' | 'replacement',
    text: string,
    authorOverride?: string
  ): boolean {
    flushTypeBuffer();
    const writer = authorOverride?.trim() || author?.trim();
    if (!writer) {
      lastRejection = 'tracked changes need a non-empty author';
      options.onChange?.(currentState());
      return false;
    }
    // Empty text would commit a phantom `w:ins` holding nothing — a tracked change the
    // review pane must carry with no content to show. A replacement that only removes is
    // a deletion. A newline is not a paragraph mark: written into `w:t` it renders as
    // whitespace while claiming to be a break. The facade's support gate refuses the same
    // SHAPES (docx-editor-support.ts), so the automation `can` and this `exec` agree; the
    // messages differ only in naming the kind versus the command.
    if (kind !== 'deletion' && text.length === 0) {
      lastRejection = `${kind} requires non-empty text`;
      options.onChange?.(currentState());
      return false;
    }
    if (kind !== 'deletion' && /[\r\n\v\f\u2028\u2029]/.test(text)) {
      lastRejection = `${kind} requires text without a paragraph mark`;
      options.onChange?.(currentState());
      return false;
    }
    const revision = { author: writer, date: trackedDate() };
    const range = orderedRange();
    const collapsed =
      range.from.paragraphId === range.to.paragraphId && range.from.offset === range.to.offset;
    // A rectangle over a single EMPTY cell mirrors a collapsed text range, but it still
    // covers a cell the user selected — the keyboard replaces over it, so automation must.
    // REPLACEMENT only: it always carries its insert op. A deletion over an all-empty
    // rectangle would commit zero ops, so it keeps the refusal `can` gives it.
    if (kind !== 'insertion' && collapsed && !(kind === 'replacement' && cellSelection)) {
      lastRejection = `${kind} needs a non-collapsed selection`;
      options.onChange?.(currentState());
      return false;
    }
    // The deletion is tracked whatever the surface's editing mode is, so the plan computes
    // `replaceAt` as suggesting would — for THIS author, who may not be the configured one.
    // An insertion aimed INSIDE an existing deletion relocates past it in the store; the
    // caret math maps the same way here, or the next proposal lands before this one.
    const plan: RangeDeletionPlan =
      kind === 'insertion'
        ? {
            ops: [] as readonly TreeDocOp[],
            collapseTo: positionPastDeletion(currentLayout, range.from),
          }
        : deleteSelectionPlan(writer);
    const ops = attributeTrackedOps(plan.ops, revision, formattingTracked());
    let caret = plan.collapseTo;
    if (kind === 'insertion' || kind === 'replacement') {
      // The plan's `replaceAt` owns the landing rule — after the struck words, in the last
      // surviving paragraph of the range — so the automation object model and the keyboard
      // agree, spanning selections included.
      const target = kind === 'replacement' ? (plan.replaceAt ?? plan.collapseTo) : plan.collapseTo;
      ops.push({
        op: 'insertText',
        paragraphId: target.paragraphId,
        offset: target.offset,
        text,
        revision,
      });
      caret = { paragraphId: target.paragraphId, offset: target.offset + text.length };
    }

    let committed = false;
    commit(
      () => {
        const result = applyOps(ops, selectionMark(), caretMark(caret));
        committed = result.committed;
        return result;
      },
      () => collapsedAt(caret)
    );
    return committed;
  }

  const scheduler = createLayoutScheduler({
    // The DOCUMENT's geometry, exactly as the first paint uses. Omitting it meant the first
    // paint honoured A4 and the first committed edit silently repaginated onto Letter — every
    // layout after the first comes through here rather than through `layoutOnce`.
    run: (scope: LayoutScope) => {
      const began = now();
      const layout = layoutDocument(scope.revision, scope);
      lastLayoutMs = now() - began;
      return layout;
    },
    currentRevision: () => session.packageRevision(),
    // THE BACKSTOP, not the normal route. Every edit this surface makes still lays out
    // synchronously inside `commit`, because the next edit has to read current geometry —
    // and `flush` cancels whatever this armed, so the ordinary keystroke pays one timer
    // arm and one cancel, never a second pass.
    //
    // What it buys is the two cases that reach the scheduler without a synchronous flush
    // behind them. A commit from OUTSIDE this surface (undo, or another editor sharing the
    // store) only ever reached the screen through `publish`, and with nothing armed it
    // simply never got there: the model moved and the painted pages kept the old revision
    // for good. And when `flush` abandons a pass — stale, or cancelled mid-flight — it
    // carries the scope forward and re-arms, which was a no-op, so the surface sat on a
    // stale paint until some unrelated call happened to flush. That second one is how the
    // header caret bug stayed invisible: a paint one revision behind is exactly what makes
    // the post-edit caret unwritable.
    //
    // A timer rather than an animation frame, like the rest of this file: rAF does not fire
    // in a background tab, and a document that stops repainting when the tab is hidden is
    // the same stale-paint failure by another route.
    schedule: (run) => {
      const handle = setTimeout(run, 0);
      return () => clearTimeout(handle);
    },
    publish: (layout) => {
      // Release the previous layout BEFORE the new one replaces it: the roster cache held
      // it by strong reference, and a 200-page graph kept alive beside the live one is tens
      // of megabytes of retained records. `layout: null` means "recompute on the next read"
      // while keeping the map itself, which that read compares against to decide whether
      // the author set actually moved.
      // The review queue is released with it, for the same reason and by the same rule.
      reviewAuthors.releaseLayout();
      currentLayout = layout;
      // Repaint from HERE, so a commit that never went through this surface — undo, or
      // another editor sharing the store — still reaches the screen. Otherwise the painted
      // pages keep showing a revision the model has already left.
      renderPublishedLayout();
    },
  });

  // A settled image resource must reach the screen on its own — nothing else may ever
  // touch the document (a letterhead the user only reads). The flush is queued, not
  // immediate, so a burst of settles (every image of a page decoding) lays out once; after
  // destroy the scheduler is cancelled and the queued flush finds nothing pending.
  let resourceFlushQueued = false;
  onDrawingResourcesChanged = () => {
    scheduler.invalidateAll(session.packageRevision(), 'drawing-resources');
    if (resourceFlushQueued) return;
    resourceFlushQueued = true;
    setTimeout(() => {
      resourceFlushQueued = false;
      flushLayout();
    }, 0);
  };

  // Every committed transaction, whatever produced it — this surface, undo, or another
  // editor sharing the store — reaches layout the same way.
  const unsubscribe = session.subscribe((modelChange) => {
    // Before anything downstream can read the index against the new revision.
    retainReviewOrderIndex(modelChange);
    // A commit from OUTSIDE this surface retires the armed typing format: the tree it was
    // armed against has moved, and the offsets it is anchored to no longer mean what they
    // did. This surface's own commits already cleared it before running their ops (and
    // re-arm afterwards, which happens after this fires), so this is only ever the
    // external case.
    pendingFormats = null;
    scheduler.notify(modelChange);
  });
  const collaborationPort = collaborationSession
    ? session.collaborationPort(collaborationSession.documentId)
    : null;
  // Attach happens at the END of mount, not here.
  //
  // A replica publishes shared state into the store synchronously on attach, which fires the
  // subscriber above, which reads bindings this function declares much further down. Attaching
  // at this point threw a temporal-dead-zone `ReferenceError` before the room could open, so
  // every session came up in `error` and the dialog never left "Reconnecting".
  let detachCollaboration: () => void = () => {};
  let unsubscribeCollaborationStatus: () => void = () => {};
  let remoteSelectionRenderingReady = false;
  // The host that renders its own remote-caret label content, when one registered. Part of
  // the painter's memo key by identity, so setting or clearing it rebuilds the labels.
  let remoteCaretLabelHost: RemoteCaretLabelHost | null = null;
  /**
   * The last payload handed to the session, so an unchanged caret publishes once.
   *
   * `null` means nothing has been published yet, which is distinct from the empty string a
   * WITHDRAWN selection hashes to — the first withdrawal has to reach the room. Declared with
   * the rest of the collaboration state, above every commit path that reads it: a commit
   * reaching a `let` further down would throw a temporal-dead-zone `ReferenceError` out of an
   * edit, which is how attaching the replica too early used to break the room.
   */
  let publishedCollaborationSelection: string | null = null;
  const unsubscribeRemoteSelections = collaborationSession
    ? collaborationSession.subscribeRemoteSelections(() => {
        if (remoteSelectionRenderingReady) renderRemoteSelections();
      })
    : () => {};

  function visiblePages(): ReadonlySet<number> | undefined {
    const set = visiblePageSet(container, currentLayout, selection, scale);
    const extra = hfScope?.getActive()?.pageIndex ?? selectionSync.selectionPageIndex();
    if (extra === undefined || set === undefined || set.has(extra)) return set;
    return new Set([...set, extra]);
  }

  /** Publish any pending layout. Returns whether it did, so callers can avoid a double paint. */
  function flushLayout(): boolean {
    // Nothing pending means nothing committed since the last pass, so the layout in hand is
    // already current and re-running it would be pure waste.
    return scheduler.pending() ? scheduler.flush() : false;
  }

  /**
   * Above this, a commit that finds queued browser input hands layout to the scheduler's
   * own task instead of flushing synchronously. Below it, deferral buys nothing: the pass
   * is cheaper than the task split, and an isolated keystroke must keep today's fully
   * synchronous commit → layout → paint chain.
   */
  const INPUT_PRESSURE_LAYOUT_DEFER_MS = 8;

  /**
   * The commit tail: publish this commit's layout, synchronously on the common path.
   *
   * Under input pressure the flush used to be one unyielding task — transact, layout and
   * paint — so a keystroke arriving mid-flush waited for all three. When the browser already
   * holds queued DISCRETE input (a key, a click — never a mere mousemove) AND the previous
   * pass was expensive, layout is left to the scheduler's `setTimeout(0)` backstop (armed by
   * the commit's own `notify`), which runs layout+publish as its own task;
   * `renderPublishedLayout` may defer paint to a third. Every synchronous reader regains
   * current geometry through `flushLayout` at its own seam, and the deferred pass reads the
   * model as it is when it runs, so no pass is ever published stale.
   *
   * A REFUSED commit never defers, whatever the scheduler holds: the accumulator is shared
   * (a prior deferred commit, an external commit, a drawing-resource invalidation can all
   * have filled it), and the `render()` below is the one report of the refusal the host
   * gets — deferring it delayed `lastRejection`, or lost it to a later commit entirely.
   */
  function publishAfterCommit(rejected: boolean): void {
    if (
      !rejected &&
      scheduler.pending() !== null &&
      lastLayoutMs > INPUT_PRESSURE_LAYOUT_DEFER_MS &&
      hasPendingBrowserInput(false)
    ) {
      return;
    }
    if (!flushLayout()) render();
  }

  /**
   * Land queued typing AND any deferred layout pass, so the caller reads current geometry.
   *
   * The one seam every synchronous reader shares — selection reads, navigation, geometry,
   * scope flips, the contract's `flushPendingInput`. Both halves are no-ops when nothing is
   * pending, so the common case costs two cheap checks.
   */
  function flushPendingInputAndLayout(): void {
    flushTypeBuffer();
    flushLayout();
  }

  /**
   * Land queued typing, any deferred layout pass AND any deferred paint. Returns whether a
   * paint happened, so a caller that must ALWAYS leave a fresh paint (the IME readback's
   * discarded-paint rebuild) can render once instead of twice.
   *
   * For lanes that are about to hand the painted DOM over or read it back — the IME: a
   * composition writes into whatever is on screen, and the readback diffs the painted text
   * against the model, so both must describe the committed revision before it starts.
   */
  function flushToPaint(): boolean {
    flushTypeBuffer();
    const published = flushLayout();
    // The flushes above render on their own synchronous paths; what can remain is only a
    // paint deferred under input pressure, and that is exactly what must land now.
    // `render()` retires the deferred timer itself.
    if (deferredPublishRender !== null) {
      render();
      armDerivationPrewarmOnce();
      return true;
    }
    // Published with nothing deferred means `renderPublishedLayout` painted synchronously.
    return published;
  }

  /** TOC chrome is hover-projected; never sticky from caret/click. */
  let hoveredTocControlId: string | null = null;

  function tocControlIdOf(toc: ReturnType<typeof detectBodyTocs>[number]): string {
    return toc.contentControlId ?? `toc:${toc.id}`;
  }

  function tocContainingParagraph(paragraphId: string) {
    return detectBodyTocs(session.part()).find(
      (toc) =>
        toc.beginParagraphId === paragraphId ||
        toc.endParagraphId === paragraphId ||
        toc.resultParagraphIds.includes(paragraphId)
    );
  }

  /**
   * Hover retints the chrome ALREADY PAINTED — it must never repaint the document.
   *
   * Chrome sends `mousedown` and then `contextmenu` for one right-click. Repainting on the
   * pointermove that enters a TOC replaced the node the gesture started on, and the
   * `contextmenu` that followed fired on a detached element, so it never bubbled to this
   * layer and the first right-click on a TOC did nothing at all. Painted DOM identity is
   * therefore stable across a hover change, and the attributes move instead.
   */
  function applyTocHoverChrome(): void {
    for (const chrome of pagesLayer.querySelectorAll<HTMLElement>(
      '.docx-content-control-chrome[data-docx-toc]'
    )) {
      if (chrome.getAttribute('data-docx-content-control') === hoveredTocControlId) {
        chrome.dataset.hover = '';
        chrome.dataset.boundaryVisible = '';
        continue;
      }
      delete chrome.dataset.hover;
      // Show-all keeps every boundary visible on its own account; only the hover-owned
      // visibility goes back off here.
      if (!showAllContentControls) delete chrome.dataset.boundaryVisible;
    }
  }

  function setHoveredTocControlId(next: string | null): void {
    if (hoveredTocControlId === next) return;
    hoveredTocControlId = next;
    applyTocHoverChrome();
  }

  function onTocPointerMove(event: PointerEvent): void {
    const paragraph = (event.target as Element | null)?.closest<HTMLElement>('[data-paragraph-id]');
    const paragraphId = paragraph?.dataset.paragraphId;
    const toc = paragraphId ? tocContainingParagraph(paragraphId) : null;
    setHoveredTocControlId(toc ? tocControlIdOf(toc) : null);
  }

  /**
   * The paragraph a click or right-click landed on, resolved without trusting the target.
   *
   * A gesture that begins on a node some other pass then replaces arrives with a target
   * that is no longer in the tree, so `closest` finds nothing worth acting on. Hit-testing
   * the live tree at the same point keeps the gesture rather than dropping it.
   */
  function gestureParagraphId(event: MouseEvent): string | undefined {
    const target = event.target as Element | null;
    const direct = target?.isConnected
      ? target.closest<HTMLElement>('[data-paragraph-id]')
      : undefined;
    if (direct) return direct.dataset.paragraphId;
    const view = pagesLayer.ownerDocument;
    if (typeof view.elementFromPoint !== 'function') return undefined;
    const hit = view.elementFromPoint(event.clientX, event.clientY);
    return hit?.closest<HTMLElement>('[data-paragraph-id]')?.dataset.paragraphId;
  }

  function onTocPointerLeave(): void {
    setHoveredTocControlId(null);
  }

  function contentControlChromeOptions():
    | {
        readonly showAll?: boolean;
        readonly activeIds?: ReadonlySet<string>;
        readonly hoverIds?: ReadonlySet<string>;
        readonly checkedIds?: ReadonlySet<string>;
        readonly additionalBoundaries?: readonly ContentControlBoundaryRecord[];
        readonly tocControlIds?: ReadonlySet<string>;
        readonly suppressedIds?: ReadonlySet<string>;
        readonly readOnly?: boolean;
      }
    | undefined {
    const active = contentControlAtCaret();
    const emptyTocBeginIds = emptyTocPlaceholderParagraphIds(session.part());
    const tocs = detectBodyTocs(session.part());
    const tocBoundaries = tocs
      .map((toc) => {
        const entry = tocBoundary(toc);
        return entry ? { ...entry, empty: emptyTocBeginIds.has(toc.beginParagraphId) } : null;
      })
      .filter((entry) => entry !== null);
    const tocControlIds = new Set(tocBoundaries.map((entry) => entry.boundary.id));
    // An empty TOC is identified by its own placeholder box, which is the ONE box the
    // region gets: a second boundary rectangle and a label chip over an empty region read
    // as a rendering fault rather than as chrome.
    const suppressedIds = new Set(
      tocBoundaries.filter((entry) => entry.empty).map((entry) => entry.boundary.id)
    );
    // TOC regions never project caret-active chrome — hoverIds own their visibility.
    const activeIds = active && !tocControlIds.has(active.id) ? new Set([active.id]) : undefined;
    const hoverIds = hoveredTocControlId ? new Set([hoveredTocControlId]) : undefined;
    const checkedIds = new Set(
      contentControlsInLayout(currentLayout)
        .filter((control) => control.controlType === 'checkbox' && checkboxChecked(control.id))
        .map((control) => control.id)
    );
    const additionalBoundaries = tocBoundaries
      .filter((entry) => entry.additional && !entry.empty)
      .map((entry) => entry.boundary);
    // Read-only is a REASON to emit chrome, not a detail of it: with no chrome object the
    // painter still paints every widget, and an unchecked checkbox on a viewing-mode
    // document produced no other chrome to carry the flag.
    const readOnly = contentControlRefusal() !== null;
    if (
      !showAllContentControls &&
      !activeIds &&
      !hoverIds &&
      !readOnly &&
      checkedIds.size === 0 &&
      additionalBoundaries.length === 0 &&
      tocControlIds.size === 0
    ) {
      return undefined;
    }
    return {
      ...(readOnly ? { readOnly: true } : {}),
      ...(showAllContentControls ? { showAll: true } : {}),
      ...(activeIds ? { activeIds } : {}),
      ...(hoverIds ? { hoverIds } : {}),
      ...(checkedIds.size > 0 ? { checkedIds } : {}),
      ...(additionalBoundaries.length > 0 ? { additionalBoundaries } : {}),
      ...(tocControlIds.size > 0 ? { tocControlIds } : {}),
      ...(suppressedIds.size > 0 ? { suppressedIds } : {}),
    };
  }

  function tocBoundary(toc: ReturnType<typeof detectBodyTocs>[number]): {
    readonly tocId: string;
    readonly boundary: ContentControlBoundaryRecord;
    readonly additional: boolean;
  } | null {
    const existing = toc.contentControlId
      ? contentControlsInLayout(currentLayout).find(
          (control) => control.id === toc.contentControlId
        )
      : undefined;
    if (existing) return { tocId: toc.id, boundary: existing, additional: false };

    const paragraphIds = new Set([
      toc.beginParagraphId,
      ...toc.resultParagraphIds,
      toc.endParagraphId,
    ]);
    const fragments = currentLayout.pages.flatMap((page) => {
      const boxes = paragraphFragmentsOf(page)
        .filter((fragment) => paragraphIds.has(fragment.paragraphId))
        .map((fragment) => fragment.box);
      if (boxes.length === 0) return [];
      const left = Math.min(...boxes.map((box) => box.x));
      const top = Math.min(...boxes.map((box) => box.y));
      const right = Math.max(...boxes.map((box) => box.x + box.width));
      const bottom = Math.max(...boxes.map((box) => box.y + box.height));
      return [
        {
          pageIndex: page.index,
          box: { x: left, y: top, width: right - left, height: bottom - top },
        },
      ];
    });
    if (fragments.length === 0) return null;
    return {
      tocId: toc.id,
      additional: true,
      boundary: {
        id: `toc:${toc.id}`,
        controlType: 'richText',
        lock: 'unlocked',
        effectiveLock: 'unlocked',
        placeholder: false,
        bound: false,
        nestingDepth: 0,
        level: 'block',
        fragments,
      },
    };
  }

  /** Innermost layout boundary under the caret, or null outside every control. */
  /**
   * The content control the caret is inside, or null.
   *
   * Two resolutions, because the boundary records the fast one needs exist for the body
   * alone. In the body, geometry: a paragraph can hold several inline controls and only the
   * caret's x/y says which. Anywhere else, the caret's own PARAGRAPH, walked in that story's
   * part — which is the honest answer where no records exist, and is what a block control
   * needs in any case.
   *
   * The story check is not an optimisation. Page-content coordinates mean nothing without
   * knowing whose box they are in: a header caret's y lands in the top band of the BODY
   * content box, so the geometry path answered with whichever body control sat there, and
   * `setValue` and `remove` then rewrote and deleted body content while the reader was
   * editing a header.
   */
  /**
   * Single-slot memo for the body branch of {@link contentControlAtCaret}.
   *
   * `state()` resolves the active control on every read, and hosts read state repeatedly
   * between changes, so the geometry hit-test ran again and again against an unchanged layout
   * and selection. Both inputs are replaced, never mutated, so identity is a sound key: a
   * commit republishes the layout, a caret move reassigns the selection, and a zoom relayouts.
   * The story branch stays unmemoized — it reads the live part, which neither key covers.
   */
  let contentControlAtCaretMemo: {
    readonly layout: SemanticLayout;
    readonly selection: SemanticSelection;
    readonly result: ContentControlBoundaryRecord | null;
  } | null = null;
  function contentControlAtCaret(): ContentControlBoundaryRecord | null {
    const scope = storyScope();
    if (scope.kind !== 'body') return contentControlInStoryAtCaret(scope);
    if (
      contentControlAtCaretMemo &&
      contentControlAtCaretMemo.layout === currentLayout &&
      contentControlAtCaretMemo.selection === selection
    ) {
      return contentControlAtCaretMemo.result;
    }
    const result = resolveBodyContentControlAtCaret();
    contentControlAtCaretMemo = { layout: currentLayout, selection, result };
    return result;
  }

  function resolveBodyContentControlAtCaret(): ContentControlBoundaryRecord | null {
    const caret = caretAt(currentLayout, selection.head, measurer);
    if (!caret) return null;
    const found = contentControlAtSemantic(currentLayout, {
      x: caret.x,
      y: caret.y + caret.height / 2,
      pageIndex: caret.pageIndex,
    });
    // Belt and braces: the records are the body's, so a match from another part is a bug in
    // the index rather than an answer, and must not become a write.
    if (!found) return null;
    return partNameOfNodeId(found.id) === session.part().name ? found : null;
  }

  /** The part name a node id names, or '' when it names none. */
  function partNameOfNodeId(id: string): string {
    const hash = id.indexOf('#');
    return hash === -1 ? '' : id.slice(0, hash);
  }

  /**
   * The innermost control holding the caret's paragraph, in the open story's own part.
   *
   * Deepest wins, matching the geometry path's innermost-by-nesting rule: a control inside a
   * control is the one the caret is actually in.
   */
  function contentControlInStoryAtCaret(scope: StoryScope): ContentControlBoundaryRecord | null {
    const part = session.partFor(scope);
    if (!part) return null;
    return contentControlHoldingParagraph(part, selection.head.paragraphId);
  }

  function contentLockedOrBound(control: ContentControlBoundaryRecord): string | null {
    if (control.bound) return 'bound';
    if (control.effectiveLock === 'contentLocked' || control.effectiveLock === 'sdtContentLocked') {
      return 'locked';
    }
    return null;
  }

  function removalLocked(control: ContentControlBoundaryRecord): string | null {
    if (control.effectiveLock === 'sdtLocked' || control.effectiveLock === 'sdtContentLocked') {
      return 'locked';
    }
    return null;
  }

  function isContentControlElement(node: OoxmlNode): node is OoxmlElement {
    // Shared walk predicate: typed `contentControl`, or generic WML `sdt` only.
    // Foreign-namespace `<x:sdt>` stays opaque and is never treated as a Word control.
    return isContentControl(node);
  }

  /**
   * The control a given id names, in whichever story owns it.
   *
   * Looked up in the part the ID names, not in the body. Every read built on this — the lock
   * and binding gates, the tab index, a checkbox's state, a dropdown's items — answered as if
   * a control outside the body did not exist, so `disabledReason` refused every verb on one
   * with `notFound` while the control was plainly on screen.
   */
  function findControl(controlId: string): OoxmlElement | null {
    // From the PACKAGE, never `partFor`: this backs the lock and binding gates, the tab index,
    // a checkbox's state and a dropdown's items, all of them reads, and `partFor` would spend
    // one of the 64 story-store slots per part touched and never give it back.
    const part = partOfNodeId(session, controlId);
    const node = findNode(part ?? session.part(), controlId);
    if (!node || !isContentControlElement(node)) return null;
    return node;
  }

  function tabIndexOfControl(controlId: string): number | null {
    const control = findControl(controlId);
    if (!control) return null;
    for (const child of control.children) {
      if (child.kind === 'textValue') continue;
      if (
        (child as { kind?: string }).kind === 'contentControlProperties' ||
        child.localName === 'sdtPr'
      ) {
        for (const prop of child.children) {
          if (prop.kind === 'textValue' || prop.localName !== 'tabIndex') continue;
          const raw = prop.attributes.find((a) => a.localName === 'val')?.value;
          if (raw === undefined) return null;
          const n = Number(raw);
          return Number.isFinite(n) ? n : null;
        }
      }
    }
    return null;
  }

  /**
   * The controls Tab cycles, in the OPEN story.
   *
   * Built from the layout for the body, where the records carry document order, and from the
   * story's own part otherwise. Against the body's list a furniture caret's own control was
   * never in the roster, so its index was always -1 and 'next' landed unconditionally on the
   * first control in the document body — moving the caret out of the story while the scope
   * still said it was open, which refuses every keystroke after it.
   */
  function editableControlsInOrder(): ContentControlBoundaryRecord[] {
    const scope = storyScope();
    const storyPart = scope.kind === 'body' ? null : session.partFor(scope);
    // A notes PART holds every note in the document, so its controls are not one story's.
    // Rostered whole, Tab walked out of the open footnote and into the next one — the same
    // escape this roster was scoped to stop, one level down — and the keystrokes after it
    // landed in a note the reader was not in. `paragraphOrder()` is already bounded to the
    // open note, so it is what bounds this.
    const withinNote = scope.kind === 'notesPart' ? new Set(paragraphOrder()) : undefined;
    const controls = storyPart
      ? [...contentControlRecordsInPart(storyPart, withinNote)]
      : [...contentControlsInLayout(currentLayout)];
    return controls
      .filter((control) => contentLockedOrBound(control) === null)
      .sort((a, b) => {
        const ta = tabIndexOfControl(a.id);
        const tb = tabIndexOfControl(b.id);
        if (ta !== null && tb !== null && ta !== tb) return ta - tb;
        if (ta !== null && tb === null) return -1;
        if (ta === null && tb !== null) return 1;
        return 0; // document order already from layout
      });
  }

  function contentChildrenOf(control: OoxmlElement): readonly OoxmlNode[] {
    for (const child of control.children) {
      if (child.kind === 'textValue') continue;
      if (
        (child as { kind: string }).kind === 'contentControlContent' ||
        child.localName === 'sdtContent'
      ) {
        return child.children;
      }
    }
    return [];
  }

  /** Select the control's addressable content for form-fill replacement. */
  function selectControlContent(controlId: string): boolean {
    const control = findControl(controlId);
    if (!control) return false;
    const content = contentChildrenOf(control);
    const paragraphs: { id: string; length: number }[] = [];
    const collectParagraphs = (nodes: readonly OoxmlNode[]): void => {
      for (const node of nodes) {
        if (node.kind === 'paragraph') {
          paragraphs.push({ id: node.id, length: paragraphOffsetIndex(node).length });
          continue;
        }
        if (node.kind === 'textValue') continue;
        const kind = (node as { kind: string }).kind;
        if (kind === 'contentControl') {
          collectParagraphs(contentChildrenOf(node as OoxmlElement));
          continue;
        }
        collectParagraphs(node.children);
      }
    };
    collectParagraphs(content);

    if (paragraphs.length > 0) {
      const first = paragraphs[0]!;
      const last = paragraphs[paragraphs.length - 1]!;
      setSelection({
        anchor: { paragraphId: first.id, offset: 0 },
        head: { paragraphId: last.id, offset: last.length },
      });
      return true;
    }

    // Inline control: locate the parent paragraph and UTF-16 range.
    let hostParagraphId: string | null = null;
    let start = 0;
    let end = 0;
    const scanParagraphs = (nodes: readonly OoxmlNode[]): boolean => {
      for (const node of nodes) {
        if (node.kind === 'paragraph') {
          const span = paragraphOffsetIndex(node).spanOf(control);
          if (!span) continue;
          hostParagraphId = node.id;
          start = span.start;
          end = span.end;
          return true;
        }
        if (node.kind === 'textValue') {
          continue;
        }
        if (scanParagraphs(node.children)) return true;
      }
      return false;
    };
    scanParagraphs(
      (session.partFor(storyScopeOfNodeId(session, controlId, storyScope())) ?? session.part()).root
        .children
    );
    if (!hostParagraphId) return false;
    setSelection({
      anchor: { paragraphId: hostParagraphId, offset: start },
      head: { paragraphId: hostParagraphId, offset: end },
    });
    return true;
  }

  function listItemsOfControl(
    controlId: string
  ): readonly { displayText: string; value: string }[] {
    const control = findControl(controlId);
    if (!control) return [];
    for (const child of control.children) {
      if (child.kind === 'textValue') continue;
      if (
        (child as { kind?: string }).kind !== 'contentControlProperties' &&
        child.localName !== 'sdtPr'
      ) {
        continue;
      }
      for (const prop of child.children) {
        if (prop.kind === 'textValue') continue;
        if (prop.localName !== 'dropDownList' && prop.localName !== 'comboBox') continue;
        const items: { displayText: string; value: string }[] = [];
        for (const item of prop.children) {
          if (item.kind === 'textValue' || item.localName !== 'listItem') continue;
          const value = item.attributes.find((a) => a.localName === 'value')?.value ?? '';
          const displayText =
            item.attributes.find((a) => a.localName === 'displayText')?.value ?? value;
          items.push({ displayText, value });
        }
        return items;
      }
    }
    return [];
  }

  function checkboxChecked(controlId: string): boolean {
    const control = findControl(controlId);
    if (!control) return false;
    for (const child of control.children) {
      if (child.kind === 'textValue') continue;
      if (
        (child as { kind?: string }).kind !== 'contentControlProperties' &&
        child.localName !== 'sdtPr'
      ) {
        continue;
      }
      for (const prop of child.children) {
        if (prop.kind !== 'contentControlCheckbox') continue;
        for (const state of prop.children) {
          if (state.kind !== 'contentControlChecked') continue;
          const val = state.attributes.find((a) => a.localName === 'val')?.value;
          return !(val === '0' || val === 'false' || val === 'off');
        }
      }
    }
    return false;
  }

  function dateValueOfControl(controlId: string): string | undefined {
    const control = findControl(controlId);
    if (!control) return undefined;
    for (const child of control.children) {
      if (child.kind !== 'contentControlProperties') continue;
      for (const property of child.children) {
        if (property.kind !== 'contentControlDate') continue;
        return property.attributes.find((attribute) => attribute.localName === 'fullDate')?.value;
      }
    }
    return undefined;
  }

  function setContentControlWidgetOpen(controlId: string, open: boolean): void {
    for (const chrome of pagesLayer.querySelectorAll<HTMLElement>('[data-docx-content-control]')) {
      if (chrome.getAttribute('data-docx-content-control') !== controlId) continue;
      if (open) chrome.dataset.open = '';
      else delete chrome.dataset.open;
    }
  }

  function closeContentControlMenu(menu: HTMLElement): void {
    const controlId = menu.dataset.docxCcId;
    menu.remove();
    if (controlId) setContentControlWidgetOpen(controlId, false);
  }

  function removeExistingContentControlMenu(): void {
    const existing = pagesLayer.querySelector<HTMLElement>('.docx-content-control-menu');
    if (existing) closeContentControlMenu(existing);
  }

  /**
   * Record which TOC a right-click landed on, and otherwise LET IT THROUGH.
   *
   * The engine paints no menu of its own. A host's context menu is one primitive with one
   * set of rows, icons, shortcut column and keyboard model; a second panel painted here
   * would be a second place for all of that to drift, and it looked like one too. What the
   * engine owns is the part a host cannot work out for itself: a right-click does not move
   * the caret, and a TOC refuses the caret entirely, so nothing in `selection` says which
   * table of contents is under the pointer. That is what this publishes.
   */
  function onTocContextMenu(event: MouseEvent): void {
    const paragraphId = gestureParagraphId(event);
    const toc = paragraphId ? tocContainingParagraph(paragraphId) : undefined;
    setContextTocId(toc && canRefreshToc(toc.id) ? toc.id : null);
  }

  /** The TOC the last right-click addressed. Cleared by a right-click anywhere else. */
  let contextTocId: string | null = null;

  function setContextTocId(next: string | null): void {
    if (contextTocId === next) return;
    contextTocId = next;
    options.onChange?.(currentState());
  }

  function onTocRowClick(event: MouseEvent): void {
    if (event.button !== 0 || (event.target as Element | null)?.closest('a.docx-hyperlink')) return;
    if (
      selection.anchor.paragraphId !== selection.head.paragraphId ||
      selection.anchor.offset !== selection.head.offset
    ) {
      return;
    }
    const paragraphId = gestureParagraphId(event);
    if (!paragraphId) return;
    const toc = detectBodyTocs(session.part()).find((candidate) =>
      candidate.resultParagraphIds.includes(paragraphId)
    );
    if (!toc) return;
    // The row names its own target through its anchor or its title. Reading the outline entry
    // that sits at the row's INDEX sends a click to the wrong heading the moment the cached
    // rows and the outline disagree, which is the normal state of a TOC that needs refreshing.
    const headings = resolveTocRowHeadings(
      session.part(),
      toc,
      session.documentOutline(),
      tocRegionOf(toc)
    );
    const headingParagraphId = headings[toc.resultParagraphIds.indexOf(paragraphId)];
    if (!headingParagraphId) return;
    event.preventDefault();
    navigation.goToPosition({ paragraphId: headingParagraphId, offset: 0 });
  }

  function openContentControlWidget(controlId: string, kind: string): void {
    const reason = contentControlsOps.disabledReason(controlId, 'edit');
    if (reason) {
      lastRejection = reason;
      options.onChange?.(currentState());
      return;
    }
    if (kind === 'checkbox') {
      contentControlsOps.setValue(controlId, checkboxChecked(controlId) ? 'false' : 'true');
      return;
    }
    if (kind === 'dropdown' || kind === 'comboBox') {
      const items = listItemsOfControl(controlId);
      if (items.length === 0 && kind === 'dropdown') return;
      // Engine-level menu: no hardcoded English — displayText comes from the file.
      removeExistingContentControlMenu();
      const menu = document.createElement('div');
      menu.className = 'docx-content-control-menu';
      menu.dataset.docxMarker = '';
      menu.dataset.docxCcId = controlId;
      menu.setAttribute('contenteditable', 'false');
      menu.setAttribute('role', 'listbox');
      menu.style.position = 'absolute';
      menu.style.zIndex = '20';
      menu.style.pointerEvents = 'auto';
      menu.addEventListener('pointerdown', (event) => event.stopPropagation());
      const record = contentControlsInLayout(currentLayout).find((c) => c.id === controlId);
      const frag = record?.fragments[0];
      if (frag) {
        const page = currentLayout.pages[frag.pageIndex];
        const offsetX = materializedExtent?.pageOffsetX.get(frag.pageIndex) ?? 0;
        if (page) {
          const contentLeft = page.contentBox.x - page.box.x;
          const contentTop = page.contentBox.y - page.box.y;
          menu.style.left = `${(page.box.x + offsetX + contentLeft + frag.box.x + frag.box.width) * scale}px`;
          menu.style.top = `${(page.box.y + contentTop + frag.box.y + frag.box.height) * scale}px`;
          menu.style.transform = 'translateX(-100%)';
        }
      }
      for (const item of items) {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'docx-content-control-menu-item';
        option.dataset.docxMarker = '';
        option.setAttribute('contenteditable', 'false');
        option.setAttribute('role', 'option');
        option.textContent = item.displayText;
        option.addEventListener('mousedown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          closeContentControlMenu(menu);
          contentControlsOps.setValue(controlId, item.value);
        });
        menu.append(option);
      }
      if (kind === 'comboBox') {
        const free = document.createElement('input');
        free.type = 'text';
        free.className = 'docx-content-control-menu-input';
        free.dataset.docxMarker = '';
        free.setAttribute('contenteditable', 'false');
        free.addEventListener('mousedown', (event) => event.stopPropagation());
        free.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          closeContentControlMenu(menu);
          contentControlsOps.setValue(controlId, free.value);
        });
        menu.append(free);
      }
      pagesLayer.append(menu);
      setContentControlWidgetOpen(controlId, true);
      const dismiss = (event: Event): void => {
        if (menu.contains(event.target as Node)) return;
        closeContentControlMenu(menu);
        document.removeEventListener('mousedown', dismiss, true);
      };
      document.addEventListener('mousedown', dismiss, true);
      return;
    }
    if (kind === 'date') {
      removeExistingContentControlMenu();
      const menu = document.createElement('div');
      menu.className = 'docx-content-control-menu';
      menu.dataset.docxMarker = '';
      menu.dataset.docxCcId = controlId;
      menu.setAttribute('contenteditable', 'false');
      menu.style.position = 'absolute';
      menu.style.zIndex = '20';
      menu.style.pointerEvents = 'auto';
      menu.addEventListener('pointerdown', (event) => event.stopPropagation());
      const record = contentControlsInLayout(currentLayout).find((c) => c.id === controlId);
      const frag = record?.fragments[0];
      if (frag) {
        const page = currentLayout.pages[frag.pageIndex];
        const offsetX = materializedExtent?.pageOffsetX.get(frag.pageIndex) ?? 0;
        if (page) {
          const contentLeft = page.contentBox.x - page.box.x;
          const contentTop = page.contentBox.y - page.box.y;
          menu.style.left = `${(page.box.x + offsetX + contentLeft + frag.box.x + frag.box.width) * scale}px`;
          menu.style.top = `${(page.box.y + contentTop + frag.box.y + frag.box.height) * scale}px`;
          menu.style.transform = 'translateX(-100%)';
        }
      }
      menu.classList.add('docx-content-control-calendar');
      const authoredDate = dateValueOfControl(controlId);
      const parsedDate = authoredDate ? new Date(authoredDate) : new Date();
      const selectedDate = Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
      const initialDate = selectedDate ?? new Date();
      let viewYear = initialDate.getFullYear();
      let viewMonth = initialDate.getMonth();
      const monthFormatter = new Intl.DateTimeFormat(undefined, {
        month: 'long',
        year: 'numeric',
      });
      const dayFormatter = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' });
      const isoDate = (date: Date): string =>
        `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1)
          .toString()
          .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
      const sameDay = (left: Date, right: Date): boolean =>
        left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate();
      let commitPendingManualDate: (() => boolean) | null = null;
      const renderCalendar = (): void => {
        const manual = document.createElement('input');
        manual.type = 'date';
        manual.className = 'docx-content-control-calendar-input';
        manual.value = selectedDate ? isoDate(selectedDate) : '';
        const initialManualValue = manual.value;
        if (record?.alias) manual.setAttribute('aria-label', record.alias);
        const commitManualDate = (): boolean => {
          if (!manual.value || manual.value === initialManualValue) return false;
          const value = manual.value;
          closeContentControlMenu(menu);
          contentControlsOps.setValue(controlId, value);
          return true;
        };
        commitPendingManualDate = commitManualDate;
        manual.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          if (!commitManualDate()) closeContentControlMenu(menu);
        });
        manual.addEventListener('blur', () => {
          queueMicrotask(() => {
            if (!menu.isConnected || menu.contains(document.activeElement)) return;
            if (!commitManualDate()) closeContentControlMenu(menu);
          });
        });
        const header = document.createElement('div');
        header.className = 'docx-content-control-calendar-header';
        const previous = document.createElement('button');
        previous.type = 'button';
        previous.className = 'docx-content-control-calendar-nav';
        previous.textContent = '‹';
        const previousMonth = new Date(viewYear, viewMonth - 1, 1);
        previous.setAttribute('aria-label', monthFormatter.format(previousMonth));
        const title = document.createElement('div');
        title.className = 'docx-content-control-calendar-title';
        title.textContent = monthFormatter.format(new Date(viewYear, viewMonth, 1));
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'docx-content-control-calendar-nav';
        next.textContent = '›';
        const nextMonth = new Date(viewYear, viewMonth + 1, 1);
        next.setAttribute('aria-label', monthFormatter.format(nextMonth));
        previous.addEventListener('mousedown', (event) => event.stopPropagation());
        next.addEventListener('mousedown', (event) => event.stopPropagation());
        previous.addEventListener('click', () => {
          viewMonth -= 1;
          if (viewMonth < 0) {
            viewMonth = 11;
            viewYear -= 1;
          }
          renderCalendar();
        });
        next.addEventListener('click', () => {
          viewMonth += 1;
          if (viewMonth > 11) {
            viewMonth = 0;
            viewYear += 1;
          }
          renderCalendar();
        });
        header.append(previous, title, next);

        const weekdays = document.createElement('div');
        weekdays.className = 'docx-content-control-calendar-weekdays';
        for (let index = 0; index < 7; index += 1) {
          const weekday = document.createElement('span');
          weekday.textContent = weekdayFormatter.format(new Date(2024, 0, 1 + index));
          weekdays.append(weekday);
        }

        const grid = document.createElement('div');
        grid.className = 'docx-content-control-calendar-grid';
        grid.setAttribute('role', 'grid');
        const firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
        const today = new Date();
        for (let index = 0; index < 42; index += 1) {
          const date = new Date(viewYear, viewMonth, index - firstWeekday + 1);
          const day = document.createElement('button');
          day.type = 'button';
          day.className = 'docx-content-control-calendar-day';
          day.textContent = String(date.getDate());
          day.setAttribute('role', 'gridcell');
          day.setAttribute('aria-label', dayFormatter.format(date));
          if (date.getMonth() !== viewMonth) day.dataset.otherMonth = '';
          if (selectedDate && sameDay(date, selectedDate)) {
            day.dataset.selected = '';
            day.setAttribute('aria-selected', 'true');
          }
          if (sameDay(date, today)) day.dataset.today = '';
          day.addEventListener('mousedown', (event) => event.stopPropagation());
          day.addEventListener('click', () => {
            closeContentControlMenu(menu);
            contentControlsOps.setValue(controlId, isoDate(date));
          });
          grid.append(day);
        }
        menu.replaceChildren(manual, header, weekdays, grid);
      };
      renderCalendar();
      pagesLayer.append(menu);
      setContentControlWidgetOpen(controlId, true);
      const dismiss = (event: Event): void => {
        if (menu.contains(event.target as Node)) return;
        if (!commitPendingManualDate?.()) closeContentControlMenu(menu);
        document.removeEventListener('mousedown', dismiss, true);
      };
      document.addEventListener('mousedown', dismiss, true);
      menu
        .querySelector<HTMLElement>(
          '[data-selected], [data-today], .docx-content-control-calendar-day'
        )
        ?.focus({ preventScroll: true });
    }
  }

  const contentControlsOps: ContentControlOps = {
    setShowAll(show) {
      if (showAllContentControls === show) return;
      showAllContentControls = show;
      // Furniture-only: rebuild paint without a layout pass.
      render();
    },
    setFormFill(active) {
      if (formFillMode === active) return;
      formFillMode = active;
      options.onChange?.(currentState());
    },
    showAll: () => showAllContentControls,
    formFill: () => formFillMode,
    atCaret: () => contentControlAtCaret(),
    navigate(direction) {
      const editable = editableControlsInOrder();
      if (editable.length === 0) return false;
      const current = contentControlAtCaret();
      let index = current ? editable.findIndex((c) => c.id === current.id) : -1;
      if (direction === 'next') {
        index = index < 0 ? 0 : (index + 1) % editable.length;
      } else {
        index = index < 0 ? editable.length - 1 : (index - 1 + editable.length) % editable.length;
      }
      const target = editable[index]!;
      return selectControlContent(target.id);
    },
    setValue(controlId, value) {
      const reason = contentControlsOps.disabledReason(controlId, 'edit');
      if (reason) {
        lastRejection = reason;
        options.onChange?.(currentState());
        return false;
      }
      let committed = false;
      commit(() => {
        // `applyOps`, not `session.applyTreeOps`: this lane wrote straight past the mode
        // rules, so a checkbox in a document open for viewing still toggled and committed.
        // No selection check, because a control op names the control it edits: where the
        // reader's caret sits is a different question, and `contentControlRefusal` above
        // judges the write on exactly these terms.
        //
        // The STORY comes from the control's own id, not from the open scope and not from a
        // constant. Pinned to the body, this wrote body content while the reader was editing
        // a header, and a control in that header could never be written at all.
        const result = applyOps(
          [{ op: 'setContentControlValue', controlId, value }],
          selectionMark(),
          undefined,
          storyScopeOfNodeId(session, controlId, storyScope()),
          false
        );
        committed = result.committed;
        return result;
      });
      return committed;
    },
    remove(controlId) {
      const id = controlId ?? contentControlAtCaret()?.id;
      if (!id) {
        lastRejection = 'notFound';
        options.onChange?.(currentState());
        return false;
      }
      const reason = contentControlsOps.disabledReason(id, 'remove');
      if (reason) {
        lastRejection = reason;
        options.onChange?.(currentState());
        return false;
      }
      let committed = false;
      commit(() => {
        const result = applyOps(
          [{ op: 'removeContentControl', controlId: id }],
          selectionMark(),
          undefined,
          storyScopeOfNodeId(session, id, storyScope()),
          false
        );
        committed = result.committed;
        return result;
      });
      return committed;
    },
    disabledReason(controlId, action) {
      // The MODE outranks every per-control property. Asked first because this one answer
      // reaches everything: the painted widget disables itself on it, the pointer lane skips
      // a widget carrying it, and the toolbar's remove row reports it.
      const refusal = contentControlRefusal();
      if (refusal !== null) return refusal;
      const record = contentControlsInLayout(currentLayout).find((c) => c.id === controlId);
      if (record) {
        return action === 'remove' ? removalLocked(record) : contentLockedOrBound(record);
      }
      const control = findControl(controlId);
      if (!control) return 'notFound';
      // Layout has not published a boundary yet — refuse conservatively from tree props.
      for (const child of control.children) {
        if (child.kind === 'textValue') continue;
        if (
          (child as { kind?: string }).kind !== 'contentControlProperties' &&
          child.localName !== 'sdtPr'
        ) {
          continue;
        }
        if (child.children.some((c) => c.kind !== 'textValue' && c.localName === 'dataBinding')) {
          if (action === 'edit') return 'bound';
        }
        for (const prop of child.children) {
          if (prop.kind === 'textValue' || prop.localName !== 'lock') continue;
          const val = prop.attributes.find((a) => a.localName === 'val')?.value;
          if (action === 'remove') {
            if (val === 'sdtLocked' || val === 'sdtContentLocked') return 'locked';
          } else if (val === 'contentLocked' || val === 'sdtContentLocked') {
            return 'locked';
          }
        }
      }
      return null;
    },
  };

  /**
   * The pages layer's `contenteditable` / `aria-readonly`, from the host's wish AND the mode.
   *
   * These were two independent writes of one state, reconciled only by the facade calling
   * both. A host driving `mountPaginatedSurface` itself and switching to viewing kept a
   * writable pages layer — a blinking caret, an IME that opens on composition, and a screen
   * reader told the document accepts input, on a document that refuses every write.
   */
  function applyEditableChrome(): void {
    const editable = hostEditable && editingMode !== 'view';
    pagesLayer.contentEditable = editable ? 'true' : 'false';
    pagesLayer.setAttribute('aria-readonly', editable ? 'false' : 'true');
  }

  function currentState(): PaginatedSurfaceState {
    return {
      revision: session.packageRevision(),
      pageCount: currentLayout.pages.length,
      selection,
      cellSelection,
      canUndo: collaborationSession?.canUndo() ?? session.canUndo(),
      canRedo: collaborationSession?.canRedo() ?? session.canRedo(),
      collaborationStatus: collaborationSession?.status() ?? 'inactive',
      lastRejection,
      // Reference-stable while unchanged: `pendingAtCaret` hands back the stored array,
      // so a host can compare states to see whether the armed format moved.
      pendingFormat: pendingAtCaret(),
      contentControls: {
        showAll: showAllContentControls,
        formFill: formFillMode,
        activeControlId: contentControlAtCaret()?.id ?? null,
      },
      contextTocId,
      formatPainter: formatPainter.state(),
      perf: {
        layoutMs: lastLayoutMs,
        paintMs: lastPaintMs,
        selectionMs: lastSelectionMs,
        placed: layoutSession.stats.placed,
        total: layoutSession.stats.total,
        reusedPages: layoutSession.stats.reusedPages,
        fullPasses: layoutSession.stats.fullPasses,
        staleDiscards: scheduler.staleDiscards,
        cancelledRuns: scheduler.cancelledRuns,
      },
    };
  }

  /** The set the current paint was built with, so a scroll can tell whether it must repaint. */
  let materializedSet: ReadonlySet<number> | undefined;
  /** Sizing the last paint used, so scroll can re-centre when the visible width band moves. */
  let materializedExtent: SurfaceExtent | undefined;
  /** Last body page occupied by the focused collapsed caret. */
  let lastCaretPageIndex: number | null = null;
  /** An edit may move the caret within the same page without going through `setSelection`. */
  let caretFollowPending = false;
  /**
   * The scroller whose SIZE is being watched, and the observer watching it.
   *
   * Declared here, above the paint that re-checks them, so `watchScrollerSize` can never be
   * reached before its own state exists — the wiring below runs late, and a temporal dead
   * zone would be a ReferenceError thrown out of a repaint.
   */
  let viewportObserver: ResizeObserver | null = null;
  let observedScroller: HTMLElement | null = null;

  function applyPageOffsets(extent: SurfaceExtent): void {
    for (const page of currentLayout.pages) {
      // The painter reconciles page children in record order, including virtual shells.
      // Indexing that retained list is O(1); a selector here used to make one DOM query for
      // every page on every keystroke (hundreds of queries in a long document).
      const element = pagesLayer.children.item(page.index) as HTMLElement | null;
      if (element?.dataset.pageIndex !== String(page.index)) continue;
      const offsetX = extent.pageOffsetX.get(page.index) ?? 0;
      element.style.left = `${(page.box.x + offsetX) * scale}px`;
    }
  }

  function render(notifyChange = true): void {
    // Any render catches the screen up to `currentLayout`, so a paint deferred under input
    // pressure is performed BY this one rather than repeated a task later — a scroll repaint
    // during a deferral used to paint the same layout twice. The deferred render was also
    // the commit's only state report, so this render inherits its notify duty.
    if (deferredPublishRender !== null) {
      clearTimeout(deferredPublishRender);
      deferredPublishRender = null;
      notifyChange = true;
    }
    // Reading the DOM selection BEFORE the paint replaces the nodes it lives in is what makes
    // a repaint carry a gesture the queued `selectionchange` has not delivered yet, rather
    // than erase it — see `adoptBeforePaint`.
    const adopted = selectionSync.adoptBeforePaint();
    const paintBegan = now();
    materializedSet = visiblePages();
    // Shared furniture: keep the visual occurrence on a built page before paint marks
    // `data-docx-hf-active`, so scroll cannot leave the caret host on a dematerialized sheet.
    hfScope?.reconcileOccurrence();
    const activeHf = hfScope?.getActive() ?? null;
    const contentControlChrome = contentControlChromeOptions();
    const emptyTocIds = emptyTocPlaceholderParagraphIds(session.part());
    paintSemanticLayoutWithAuthorSlots(
      pagesLayer,
      currentLayout,
      {
        scale,
        readOnlyParagraphIds: tocParagraphIds(),
        ...(emptyTocIds.size > 0 ? { emptyTocPlaceholderIds: emptyTocIds } : {}),
        ...(options.fontAlias ? { fontAlias: options.fontAlias } : {}),
        ...(options.defaultFontFamily ? { defaultFontFamily: options.defaultFontFamily } : {}),
        materialize: materializedSet,
        ariaHidden: false,
        drawingStrings,
        ...(options.fieldShading ? { fieldShading: options.fieldShading } : {}),
        ...(revisionStyles !== undefined ? { revisionStyles } : {}),
        shadeFormFields: shadeFormFields(),
        ...(paintImageUrlPort ? { imageUrlPort: paintImageUrlPort } : {}),
        ...(activeHf
          ? {
              activeHeaderFooterRId: activeHf.scope.rId,
              activeHeaderFooterPageIndex: activeHf.pageIndex,
            }
          : {}),
        ...(contentControlChrome ? { contentControlChrome } : {}),
      },
      reviewAuthors.get().value
    );
    // Paint just rebuilt every span, so the caret's field lost its mark with the old DOM.
    syncActiveFieldShading(pagesLayer, collapsedCaretPosition(), { domReplaced: true });
    setHeaderFooterEditingChrome(container, pagesLayer, activeHf != null);
    // Viewing mode hides write affordances the painter cannot know about — today the
    // blank header/footer "double-click to add" band.
    setEditingModeChrome(container, editingMode);
    // The pages are absolutely positioned, so the layer has no intrinsic size and the
    // surface would collapse to zero — pages then escape whatever centres or scrolls it.
    // Size it from the records, which is the only place the extent is known.
    materializedExtent = surfaceExtent(currentLayout, materializedSet);
    applyPageOffsets(materializedExtent);
    pagesLayer.style.width = `${materializedExtent.width * scale}px`;
    pagesLayer.style.height = `${materializedExtent.height * scale}px`;
    container.style.width = `${materializedExtent.width * scale}px`;
    container.style.height = `${materializedExtent.height * scale}px`;
    overlayLayer.style.width = `${materializedExtent.width * scale}px`;
    overlayLayer.style.height = `${materializedExtent.height * scale}px`;
    commentLayer.style.width = overlayLayer.style.width;
    commentLayer.style.height = overlayLayer.style.height;
    remoteSelectionLayer.style.width = overlayLayer.style.width;
    remoteSelectionLayer.style.height = overlayLayer.style.height;
    tableFurnitureLayer.style.width = overlayLayer.style.width;
    tableFurnitureLayer.style.height = overlayLayer.style.height;
    tableInteraction.update();
    // Sizing included: the style writes above invalidate layout, and the selection sync
    // right after is what forces the browser to resolve it. Splitting the timer here would
    // book the paint's own cost to the selection phase.
    lastPaintMs = now() - paintBegan;
    renderOverlay();
    renderRemoteSelections();
    renderCommentHighlights(true);
    // The surface may only now have been wrapped in its viewport, so the size watcher
    // re-resolves its target here rather than trusting what existed at mount.
    watchScrollerSize();
    selectionSync.mirrorToDom();
    followCaretIntoView(caretFollowPending);
    caretFollowPending = false;
    // A scroll reports nothing — nothing about the document or the selection moved. Taking up
    // a pending gesture DID move the selection, so that pass has to report after all.
    if (notifyChange || adopted) options.onChange?.(currentState());
  }

  /**
   * Follow the viewport: scrolling must reveal BUILT pages, not shells.
   *
   * Materialization is decided at paint time, and without this it was only ever decided on a
   * COMMIT — scrolling a long document showed blank sheets until the next keystroke. A
   * scroll repaints only when the set of pages worth building actually changed, and it does
   * not report a state change: nothing about the document, selection or revision moved.
   */
  function rematerialize(): void {
    // The scroll-driven repaint can adopt a pending DOM gesture (adoptBeforePaint),
    // which moves the selection without passing `setSelection`'s buffer guard;
    // landing queued typing here first closes that window. The layout flush rides
    // along so the page set is chosen against current geometry when a commit
    // deferred its pass. Safe: this runs from a scheduled frame, never inside a
    // render.
    flushPendingInputAndLayout();
    const nextSet = visiblePages();
    const nextExtent = surfaceExtent(currentLayout, nextSet);
    if (
      materializedExtent &&
      equalPageSets(nextSet, materializedSet) &&
      equalSurfaceExtents(nextExtent, materializedExtent)
    ) {
      return;
    }
    render(false);
  }

  /**
   * Keep the focused body caret inside the viewport without snapping an already-visible line.
   *
   * Geometry comes from layout because the destination page may still be virtualized. A
   * plain scroll repaint must not pull the reader back to an unchanged caret, so an ordinary
   * render follows only when layout moved the caret to another page; selection/edit paths can
   * force the same nearest-edge check for movement within one page.
   */
  function followCaretIntoView(force = false): void {
    if (hfScope?.getActive() || noteOps?.activeNoteScope()) return;
    if (
      selection.anchor.paragraphId !== selection.head.paragraphId ||
      selection.anchor.offset !== selection.head.offset
    ) {
      return;
    }
    const active = document.activeElement;
    if (active !== pagesLayer && (!active || !pagesLayer.contains(active))) return;

    const geometry = caretAt(currentLayout, selection.head, {
      measurer,
      ...(selectionSync.selectionPageIndex() !== undefined
        ? { preferredPageIndex: selectionSync.selectionPageIndex() }
        : {}),
    });
    if (!geometry) return;
    const changedPage = lastCaretPageIndex !== null && lastCaretPageIndex !== geometry.pageIndex;
    lastCaretPageIndex = geometry.pageIndex;
    if (!force && !changedPage) return;

    const page = currentLayout.pages[geometry.pageIndex];
    const scroller = surfaceScroller(container);
    if (!page || !scroller || scroller.clientHeight <= 0) return;

    const padding = 24;
    const contentTop = page.contentBox.y - page.box.y;
    const top = (page.box.y + contentTop + geometry.y) * scale + container.offsetTop;
    const bottom = top + geometry.height * scale;
    const viewportTop = scroller.scrollTop;
    const viewportBottom = viewportTop + scroller.clientHeight;
    let target = viewportTop;
    if (top < viewportTop + padding) {
      target = top - padding;
    } else if (bottom > viewportBottom - padding) {
      target = bottom + padding - scroller.clientHeight;
    } else {
      return;
    }

    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const next = Math.max(0, Math.min(target, maxScroll));
    if (Math.abs(next - scroller.scrollTop) < 0.5) return;
    scroller.scrollTop = next;
    // The destination may have been only a shell. Build it in the next frame rather than
    // recursively repainting from inside the paint that detected the movement.
    scheduleRematerialize();
  }

  let editingMode: SurfaceEditingMode = options.editingMode ?? 'edit';
  /** The host's own `setEditable` wish, kept apart from the mode's — see `applyEditableChrome`. */
  let hostEditable = true;

  /** The main story. Named once so the automation entry cannot drift from the session default. */
  const BODY_STORY: StoryScope = Object.freeze({ kind: 'body' as const });
  let collaborationOperationCounter = 0;

  /**
   * Commit ops, attributing them when the surface is suggesting.
   *
   * ONE interception point rather than an argument threaded through a dozen emit sites: the
   * ops are built all over this file, and a site that forgot to pass the attribution would
   * silently write an untracked edit in suggesting mode — the failure nobody notices until
   * the document has already lost the proposal.
   */
  let textFormInteraction: ReturnType<typeof createTextFormFieldInteraction> | null = null;
  function applyOps(
    ops: readonly TreeDocOp[],
    selectionBefore?: Parameters<TreeDocxSession['applyTreeOps']>[1],
    selectionAfter?: Parameters<TreeDocxSession['applyTreeOps']>[2],
    // Defaulted, and therefore evaluated per call: every input path wants the story the
    // reader is in. Only a caller that ALREADY knows which story its ops address — an
    // automation handle names one — passes this, and then the reader's position is irrelevant.
    scope: StoryScope = storyScope(),
    checkSelection = true
  ): ReturnType<TreeDocxSession['applyTreeOps']> {
    // Every live lane reaches here inside `commit`, whose head-flush already ran, so this
    // is a defensive no-op — kept so a future direct caller still lands buffered typing
    // before its ops address the document.
    flushTypeBuffer();
    const refusal = writeRefusal(ops.some(isDocumentEdit), ops, checkSelection);
    if (refusal !== null) return { committed: false, rejected: true, opCount: 0, reason: refusal };
    // The scope resolves to `storyScope()` unless the caller named one, so an edit inside a
    // header, a footer or a note is applied to that story rather than to the body.
    const attributed = trackedOps(
      checkSelection && textFormInteraction ? textFormInteraction.annotate(ops) : ops
    );
    const result = applyJournaledOps(attributed, selectionBefore, selectionAfter, scope);
    if (result.committed && attributed.some(isTrackedEdit)) {
      runtimeOptions.onTrackedChange?.();
    }
    return result;
  }

  /**
   * Gate and attribute a write the way typing does, without the TOC-read-only rule.
   *
   * Refresh rewrites TOC result paragraphs, so `applyOps` would refuse the write that
   * exists to update them. The collaboration gate and the actor still apply.
   */
  function applyJournaledOps(
    ops: readonly TreeDocOp[],
    selectionBefore?: Parameters<TreeDocxSession['applyTreeOps']>[1],
    selectionAfter?: Parameters<TreeDocxSession['applyTreeOps']>[2],
    scope: StoryScope = storyScope()
  ): ReturnType<TreeDocxSession['applyTreeOps']> {
    const collaborationRefusal = collaborationSession?.gateOperations(ops, scope);
    if (collaborationRefusal) {
      return {
        committed: false,
        rejected: true,
        opCount: 0,
        reason: collaborationRefusal,
      };
    }
    collaborationOperationCounter += 1;
    return session.applyTreeOps(
      ops,
      selectionBefore,
      selectionAfter,
      scope,
      collaborationSession
        ? {
            origin: ORIGIN_IDS.mutationHuman,
            actorId: collaborationSession.identity.actorId,
            operationId: `${collaborationSession.identity.actorId}:${collaborationSession.sessionId}:browser:${collaborationOperationCounter}`,
            recordsHistory: false,
          }
        : undefined
    );
  }

  /**
   * Why a write would be refused right now, or null when it would be allowed.
   *
   * ONE statement of the mode rules, asked by `applyOps` for every lane and asked once more by the
   * automation path — which has to know the answer BEFORE it builds its ops, because building them
   * can mint a hyperlink relationship, and a relationship survives a refusal. `edits` says whether
   * the write changes the document, which is the only thing the second rule needs from the ops.
   */
  function writeRefusal(
    edits: boolean,
    ops: readonly TreeDocOp[] = [],
    checkSelection = true
  ): string | null {
    // VIEWING refuses every write here rather than only at the facade. The keymap and
    // `beforeinput` are wired to this surface, not to `Editor.exec`, so a facade-only gate
    // left the document fully typeable while the toolbar reported it read-only.
    if (editingMode === 'view') return VIEWING_REFUSAL;
    if (
      edits &&
      ((checkSelection && selectionTouchesToc()) || ops.some((op) => opTouchesToc(op)))
    ) {
      return TOC_READ_ONLY_REFUSAL;
    }
    // SUGGESTING with no author cannot write `CT_TrackChange`, and the fallback of writing
    // an untracked edit is only tolerable when nothing is destroyed. A deletion in that
    // state removes text the reviewer was promised they could get back.
    // EVERY edit, not just the destructive ones. Letting insertions through wrote permanent
    // changes to someone else's document while the pill said Suggesting and the review pane
    // stayed empty — half the keyboard proposing and half editing outright.
    if (editingMode === 'suggest' && !author?.trim() && edits) {
      return 'suggesting needs an author before it can propose a change';
    }
    // Deleting a note is a package-level removal with no tracked form: the reference and
    // the body go outright, with no `w:del` and no card, while every insertion around it
    // is a proposal. Striking the reference (Backspace over it) IS the tracked deletion —
    // the body follows when the strike is accepted — so the outright lane is refused
    // rather than left as a silent destructive edit in suggesting mode. Note CONVERSION
    // and note properties stay direct on purpose: they destroy nothing, OOXML has no
    // revision markup for them, and Word applies them the same way with tracking on.
    if (editingMode === 'suggest' && ops.some((op) => op.op === 'deleteNote')) {
      return 'suggesting cannot delete a note outright; strike its reference to propose the deletion';
    }
    return null;
  }

  /**
   * Why a content-control interaction is refused right now, or null.
   *
   * The widget is chrome the ENGINE paints, so the mode has to reach it here rather than at
   * a host's discretion. No selection or op list to judge: a control write is aimed at a
   * control id, so the TOC rules — which are about where the caret is — do not apply, and
   * refusing a form field because the caret happens to sit in a table of contents would be
   * an answer to a different question.
   */
  function contentControlRefusal(): string | null {
    const refusal = writeRefusal(true, [], false);
    if (refusal !== null) return refusal;
    return session.editable ? null : READ_ONLY_REFUSAL;
  }

  /** Ops that change the DOCUMENT, as opposed to reading or resolving it. */
  function isDocumentEdit(op: TreeDocOp): boolean {
    return (
      op.op !== 'acceptRevision' &&
      op.op !== 'rejectRevision' &&
      op.op !== 'acceptAllRevisions' &&
      op.op !== 'rejectAllRevisions'
    );
  }

  /** Ops that create or extend a reviewable proposal. */
  /**
   * The ops that carry per-op revision attribution, spelled ONCE.
   *
   * `attributeTrackedOps` stamps exactly these and `isTrackedEdit` reports exactly these, so
   * a new revision-capable op added to one list but not the other would either write
   * untracked in suggesting mode — the #458 failure — or stop `onTrackedChange` firing.
   * Tabs and breaks are members because they are insertions too: passed through
   * unattributed, they serialized as a plain run beside the strike — an edit the review
   * pane could neither accept nor reject, in a document whose author believed everything
   * they did was a proposal. A page field and a note citation are members for the same
   * reason: the field's runs go into ONE `w:ins`, and the note's reference run is wrapped
   * while its body stays plain (rejecting the reference sweeps the body).
   *
   * `insertHyperlink` is deliberately NOT a member. The wrap carries no content of its
   * own; in suggesting mode the link lane replaces the selection with tracked ops first,
   * so the `w:hyperlink` only ever wraps this author's own `w:ins` — which is the
   * reviewable unit.
   *
   * The three PROPERTY ops are members for the reason the tabs and breaks are: passed
   * through unattributed they rewrote a `w:rPr` outright, so a suggester's Bold press was a
   * permanent edit with no card, nothing to reject, and — once formatting learned to reach
   * tracked text — a silent rewrite of another author's pending insertion (#495).
   */
  type RevisionCapableOp = Extract<
    TreeDocOp,
    {
      op:
        | 'insertText'
        | 'deleteText'
        | 'insertTab'
        | 'insertHardBreak'
        | 'insertPageBreak'
        | 'insertPageField'
        | 'insertNote'
        | 'insertTableRow'
        | 'deleteTableRow'
        | 'setRunProperties'
        | 'setParagraphProperties'
        | 'setParagraphMarkProperties';
    }
  >;
  const REVISION_CAPABLE_OPS: ReadonlySet<TreeDocOp['op']> = new Set<RevisionCapableOp['op']>([
    'insertText',
    'deleteText',
    'insertTab',
    'insertHardBreak',
    'insertPageBreak',
    'insertPageField',
    'insertNote',
    'insertTableRow',
    'deleteTableRow',
    'setRunProperties',
    'setParagraphProperties',
    'setParagraphMarkProperties',
  ]);

  /**
   * Whether this op's tracked form is a PROPERTY CHANGE record.
   *
   * Asked because `w:doNotTrackFormatting` (§17.15.1.50) turns exactly those off: a document
   * may ask for its formatting changes to be applied without a `w:rPrChange` while its text
   * edits stay tracked. That is a producer instruction, so it gates the WRITE and never how an
   * existing record is read.
   *
   * Read from the STORE's own table rather than restated here — the store shares one `@w:id`
   * per wrapper name for the same set, and two lists of it would drift.
   */
  const isPropertyChangeOp = (op: TreeDocOp['op']): boolean =>
    PROPERTY_CHANGE_WRAPPER_OF_OP.has(op);

  /** Whether this document wants its formatting changes recorded at all. */
  const formattingTracked = (): boolean => !session.trackingSettings().doNotTrackFormatting;
  function isRevisionCapable(op: TreeDocOp): op is RevisionCapableOp {
    return REVISION_CAPABLE_OPS.has(op.op);
  }

  function isTrackedEdit(op: TreeDocOp): boolean {
    if (isRevisionCapable(op)) return op.revision !== undefined;
    switch (op.op) {
      case 'setParagraphMarkRevision':
      case 'proposeParagraphMerge':
        return true;
      // Paste proposes its breaks through the op itself, so a paste of newlines alone is a
      // tracked edit with no `insertText` beside it to report for it.
      case 'splitParagraphMany':
        return op.revision !== undefined;
      default:
        return false;
    }
  }

  function attributeTrackedOps(
    ops: readonly TreeDocOp[],
    revision: import('../store/store/tree-op-types.ts').RevisionAttributionInput,
    trackFormatting: boolean
  ): TreeDocOp[] {
    return ops.flatMap((op): TreeDocOp[] => {
      // Already-attributed ops pass through untouched — a caller that named an author keeps it.
      if (isRevisionCapable(op)) {
        if (!trackFormatting && isPropertyChangeOp(op.op)) return [op];
        return [op.revision !== undefined ? op : { ...op, revision }];
      }
      // A SPLIT becomes a real split plus a proposed mark on the first paragraph: the text
      // is already in two paragraphs, and what is being proposed is the break between them.
      // §17.13.5 puts the new mark on the FIRST paragraph, and rejecting it runs the two
      // back together.
      // Paste cuts its pasted text into paragraphs with ONE op, so the proposal rides on the
      // op itself: the store mints the paragraphs, so only the store can address their marks.
      if (op.op === 'splitParagraphMany') return [{ ...op, revision }];
      if (op.op === 'splitParagraph') {
        return [
          op,
          {
            op: 'setParagraphMarkRevision' as const,
            paragraphId: op.paragraphId,
            kind: 'ins' as const,
            revision,
          },
        ];
      }
      // A JOIN becomes a proposal to remove the mark BETWEEN the paragraphs, which belongs
      // to the first — and the paragraphs stay where they are. Joining them outright made
      // rejecting restore the words but not the boundary, so the original was unrecoverable.
      if (op.op === 'joinParagraphs') {
        // Addressed by the SECOND paragraph: the mark being proposed away belongs to
        // whichever paragraph precedes it, and a multi-paragraph delete emits a join per
        // paragraph with `firstId` pinned to the group head — so naming the first stamped
        // one paragraph N times and left the rest untouched.
        return [{ op: 'proposeParagraphMerge' as const, paragraphId: op.secondId, revision }];
      }
      return [op];
    });
  }

  /**
   * The author this edit will be attributed to, or undefined when it lands untracked.
   *
   * `CT_TrackChange` makes `@w:author` required, so with no author there is nothing valid
   * to write. The edit lands untracked rather than being refused: losing the user's typing
   * to a missing configuration value would be the worse failure. ONE answer, because a
   * lane that decides what to write by re-deriving this condition drifts from the lane
   * that decides how to attribute it.
   */
  function trackedAuthorOrNone(): string | undefined {
    const writer = author?.trim();
    return editingMode === 'suggest' && writer ? writer : undefined;
  }

  /** Suggesting attributes text and structural row edits as Word tracked changes. */
  function trackedOps(ops: readonly TreeDocOp[]): TreeDocOp[] {
    const author = trackedAuthorOrNone();
    if (author === undefined) return [...ops];
    return attributeTrackedOps(ops, { author, date: trackedDate() }, formattingTracked());
  }

  /**
   * The history mark for a caret, which is what REDO restores.
   *
   * `applyOps` takes it as its third argument and the store records it on the entry. Only
   * `type()` ever supplied one, so redo put the caret back where the edit STARTED — after
   * redoing Enter the next character went into the paragraph above the one it belonged to.
   */
  /**
   * A selection carried across a change to ONE paragraph's text.
   *
   * The two strings are all this needs: what survives at the front stays put, what survives
   * at the back moves by the length difference, and an offset inside the part that changed
   * collapses to where the change began — which is where the words the caret was in used to
   * be. Resolving a revision under the caret is the case: the offsets are still legal, so
   * nothing clamps them, and they now address different characters.
   */
  function mappedAcrossTextChange(
    current: SemanticSelection,
    paragraphId: string,
    beforeText: string
  ): SemanticSelection {
    const afterText = textOf(paragraphId);
    if (afterText === beforeText) return current;
    let prefix = 0;
    while (
      prefix < beforeText.length &&
      prefix < afterText.length &&
      beforeText[prefix] === afterText[prefix]
    ) {
      prefix += 1;
    }
    let suffix = 0;
    while (
      suffix < beforeText.length - prefix &&
      suffix < afterText.length - prefix &&
      beforeText[beforeText.length - 1 - suffix] === afterText[afterText.length - 1 - suffix]
    ) {
      suffix += 1;
    }
    const delta = afterText.length - beforeText.length;
    const move = (position: SemanticPosition): SemanticPosition => {
      if (position.paragraphId !== paragraphId) return position;
      if (position.offset <= prefix) return position;
      if (position.offset >= beforeText.length - suffix) {
        return { ...position, offset: position.offset + delta };
      }
      return { ...position, offset: prefix };
    };
    return { anchor: move(current.anchor), head: move(current.head) };
  }

  /**
   * Whether two paragraphs are siblings in the same container, so a join is even expressible.
   *
   * `paragraphOrder()` is flat document order: the paragraph before the one after a table is
   * inside the table's last cell, and the paragraph before the first cell's is outside it.
   * Neither pair can be joined, and the store says so — but only after the op is built and
   * the whole transaction refused.
   */
  function joinableSiblings(firstId: string, secondId: string): boolean {
    const part = session.partFor(storyScope()) ?? session.part();
    const firstParent = parentNodeOf(part, firstId);
    const secondParent = parentNodeOf(part, secondId);
    return firstParent !== null && secondParent !== null && firstParent.id === secondParent.id;
  }

  function caretMark(position: { paragraphId: string; offset: number }): {
    paragraphId: string;
    start: number;
    end: number;
  } {
    return { paragraphId: position.paragraphId, start: position.offset, end: position.offset };
  }

  function commit(
    run: () => ReturnType<TreeDocxSession['applyPmDoc']> | boolean,
    selectionAfter?: () => SemanticSelection | null,
    options:
      | {
          readonly keepCellSelection?: boolean;
          /**
           * Re-anchor this armed typing format at the POST-edit caret instead of retiring
           * it. Word's rule: Backspace, Delete and Enter keep the typing format — bold
           * pressed at a caret survives deleting a character or opening a new paragraph,
           * and applies to whatever is typed next there.
           */
          readonly rearmPending?: ArmedFormat;
        }
      | undefined = {}
  ): void {
    // Any batched typing lands first as its own transaction, so this edit sees
    // the document and selection the user saw. Reentrancy-guarded: the flush
    // itself commits through here with an empty buffer.
    flushTypeBuffer();
    // An edit invalidates the rectangle: its cells' content has changed, and the collapsed
    // DOM selection it installed still points at the PRE-edit anchor. Left standing it kept
    // painting a highlight over text that had moved, kept suppressing selection adoption, and
    // kept feeding a stale cell list to the toolbar. Formatting is the one caller that
    // legitimately keeps it — Word leaves cells selected after Bold.
    if (!options?.keepCellSelection) cellSelection = null;
    // A committed edit retires the stored caret format unless the caller re-arms it below:
    // the consumers (`type()`, the IME readback) capture the properties BEFORE calling here,
    // and the caret-preserving edits (Backspace, Delete, Enter) pass `rearmPending`.
    pendingFormats = null;
    // Whatever the DOM selection holds, it was made against the text BEFORE this edit, so its
    // offsets stop meaning the same thing the moment the ops land. The render below must
    // write the model's selection out, never read the stale one back.
    selectionSync.noteModelMoved();
    // Ops go through the session, so the tree stays the only state. A refusal is surfaced
    // rather than silently dropped: the view is repainted from what the model actually
    // holds, so the user never keeps looking at an edit that will not be saved.
    const result = run();
    const rejection = typeof result === 'boolean' || !result.rejected ? null : result;
    if (rejection) {
      lastRejection = String(rejection.reason ?? 'rejected');
    } else {
      lastRejection = null;
      // The post-edit selection is installed BEFORE the paint, so the single render below
      // paints the new pages, mirrors the new caret into the DOM and reports one state
      // change. Committing first and calling `setSelection` afterwards wrote the superseded
      // caret into the fresh DOM, wrote the browser selection twice, and reported every
      // edit twice — the second-largest cost of a keystroke after layout, because a host
      // re-derives toolbar formatting from each report. Supplied as a THUNK evaluated after
      // the ops: a caret landing in a `w:p` the commit minted cannot be computed before the
      // commit runs.
      const next = selectionAfter?.();
      if (next) {
        retireActivationPin();
        selection = next;
        // An edit placed a TEXT caret — typing beside an anchored image must not ring it.
        // Image property edits commit with no selectionAfter, so a resize or move drag
        // keeps its object selection, exactly as Word does.
        setDrawingIntent({ kind: 'none' }, false);
        desiredX = null;
        caretFollowPending = true;
      }
      // Re-anchor AFTER the post-edit caret is installed, so the armed format follows the
      // edit (Backspace moves it one left, Enter moves it into the new paragraph). Only a
      // collapsed caret can hold one — the same invariant arming enforces.
      const rearm = options?.rearmPending;
      if (rearm && rearm.properties.length > 0) {
        const { anchor, head } = selection;
        if (anchor.paragraphId === head.paragraphId && anchor.offset === head.offset) {
          // The new anchor LAST: `armedAtCaret()` hands back the full armed record, and
          // its stale position must not override where the edit just put the caret.
          pendingFormats = { properties: rearm.properties, base: rearm.base, position: head };
        }
      }
    }
    // An edit moves the caret, and a caret move is presence. Published HERE rather than from
    // the paint: under input pressure `publishAfterCommit` hands layout to a later task, and
    // a remote caret must not wait on this author's repaint to stop pointing at a position
    // they have left.
    publishLocalCollaborationSelection();
    // A committed edit repaints through the scheduler's publish; a REFUSED one commits
    // nothing, so the surface still has to refresh the state it just changed. Under input
    // pressure the publish may hand layout+paint to the scheduler's own task — see
    // `publishAfterCommit`.
    publishAfterCommit(rejection !== null);
  }

  /**
   * Whether every page the CURRENT selection touches has been built.
   *
   * Read from `materializedSet` rather than recomputed: deciding this from the viewport
   * would read `scrollTop`, and forcing a layout on a path that runs for every arrow key is
   * the kind of cost that does not show up until a long document is open. `undefined` means
   * nothing is virtualized and every page is built, which is the safe reading everywhere
   * else too.
   */
  function selectionPagesBuilt(): boolean {
    if (!materializedSet) return true;
    for (const position of [selection.anchor, selection.head]) {
      const caret = caretAt(currentLayout, position);
      if (caret && !materializedSet.has(caret.pageIndex)) return false;
    }
    return true;
  }

  /**
   * Publish this author's caret to the room.
   *
   * EVERY caret move calls this, an edit's post-edit caret included. Presence used to be
   * published only by the paths that move the caret on purpose — a click, an arrow key,
   * entering a header — and never by a commit, which is how typing moves it. So a remote
   * caret did not lag behind a typing burst, it STOPPED: awareness still held the position
   * of the last click, every keystroke after it published nothing, and the peer painted that
   * stale position for as long as the author kept typing. A remote caret nobody is at is
   * worse than none, so an endpoint this surface cannot address publishes `null` — which
   * withdraws the caret at every peer — rather than leaving the last one standing.
   *
   * Addressing is two node-index lookups, not a document walk (see `paragraph-addresses.ts`),
   * and typing reaches this once per COMMIT, which the type buffer already coalesces.
   */
  function publishLocalCollaborationSelection(): void {
    const collaboration = collaborationSession;
    if (!collaboration) return;
    const next = collaborationPort
      ? localCollaborationSelection(
          cellSelection?.text ?? selection,
          (nodeId) => {
            const part = partOfNodeId(session, nodeId) ?? session.part();
            return collaborationParagraphAt(part, nodeId);
          },
          cellSelection ? 'cells' : undefined
        )
      : null;
    const key = next
      ? `${next.anchor.paragraphId}:${next.anchor.offset}|${next.head.paragraphId}:${next.head.offset}|${next.kind ?? ''}`
      : '';
    if (key === publishedCollaborationSelection) return;
    publishedCollaborationSelection = key;
    collaboration.setLocalSelection(next);
  }

  function setSelection(next: SemanticSelection, keepDesiredX = false): void {
    // Compared BEFORE the flush below, which can itself move the caret.
    const moved = !selectionsEqual(next, selection);
    // Buffered typing lands at the OLD caret before a MOVE takes effect —
    // typing then clicking must not teleport the typed text to the click. A
    // same-position set (the selection mirror re-adopting the caret it painted,
    // which a browser echoes after every keystroke) is not a move and must not
    // break the batch.
    if (typeBuffer.length > 0 && moved) {
      flushTypeBuffer();
    }
    // Moving the caret discards a stored caret format — Word's rule. Landing back on the
    // exact armed position (the mirror re-adopting the same caret) keeps it.
    reconcilePendingWith(next);
    releaseRetainedIfEscaped(next);
    const previousActive = contentControlAtCaret()?.id ?? null;
    const previousToc = tocIdAtParagraph(selection.head.paragraphId);
    retireActivationPin();
    selection = next;
    // Any plain selection cancels a rectangle. A caret placed by a click, a keystroke or an
    // edit is a text selection by definition, and leaving the rectangle behind would keep
    // painting cells that are no longer chosen.
    cellSelection = null;
    if (!keepDesiredX) desiredX = null;
    // THE MIRROR NEEDS NODES TO WRITE INTO, AND AN UNBUILT PAGE HAS NONE.
    //
    // A selection can land on a page virtualization has not built — an outline jump, a
    // search hit, any host driving the caret — and that is precisely the page it lands on,
    // since the reason to move the caret there is that the user is not looking at it yet.
    // The mirror then wrote into nodes that do not exist, which fails silently; the caret
    // stayed where it was, and the next repaint read the STALE DOM selection back and
    // overwrote the navigation entirely. Building the page first is what makes the write
    // land: `visiblePageSet` pins the pages the selection touches, so this paint brings the
    // target into existence wherever it is.
    if (!selectionPagesBuilt()) {
      // The MODEL is the newer of the two until that write lands, so this repaint must not
      // adopt the DOM selection it is about to replace — which is the very stale value the
      // navigation is trying to leave behind.
      selectionSync.noteModelMoved();
      render(false);
    }
    // SETTLED, not moved: this mirrors into the DOM on the next line, so the two agree before
    // any render can read them back — including a move raised earlier that no render has
    // carried out. `restoreSelection` raises the flag and only `flushLayout` takes it down, so
    // `undo` on an empty history left it up and disarmed the NEXT repaint, whenever it came.
    selectionSync.noteSelectionSettled();
    // CLAIMED: this is the programmatic entry point — a host's `setSelection`, an opened
    // review card, an outline jump. The plain write refuses whenever the browser's selection
    // sits outside these pages, which is exactly the case when the request came from the
    // host's own chrome (a rail card takes focus on mousedown), and the range the caller
    // asked to SHOW then highlighted nothing at all. A pointer or keyboard move already owns
    // the selection, so claiming changes nothing for them. Focus is never moved.
    selectionSync.mirrorToDom(true);
    followCaretIntoView(true);
    renderOverlay();
    // A dismissal is dismissed for where the caret WAS; any move re-asks the question, which
    // is how the reader reopens an item — by clicking back into its text.
    dismissedReviewKeys.clear();
    // The caret decides which item is OPEN, so a move re-classifies the bands. The rectangles
    // themselves are cached against the layout and are not recomputed here.
    renderCommentHighlights();
    // Content-control caret chrome is furniture keyed on the active control id. A caret move
    // into / out of a control must rebuild paint without a layout pass.
    const nextActive = contentControlAtCaret()?.id ?? null;
    const nextToc = tocIdAtParagraph(selection.head.paragraphId);
    if (previousActive !== nextActive || previousToc !== nextToc) {
      render(false);
    }
    publishLocalCollaborationSelection();
    options.onChange?.(currentState());
  }

  /**
   * The two-way selection mirror and the IME lane.
   *
   * Created HERE, after the commit path it drives and before the listeners it answers: every
   * function it is handed is a hoisted declaration, and nothing renders until the mount paint
   * at the end of this factory.
   */
  const selectionSync = createSurfaceSelectionSync({
    session,
    storyScope,
    document,
    pagesLayer,
    selection: () => selection,
    setSelection: (next) => setSelection(next),
    // The raw take-up, without the mirror or the report `setSelection` performs: the render
    // this runs inside is about to do both.
    adoptSelection: (next) => {
      reconcilePendingWith(next);
      releaseRetainedIfEscaped(next);
      retireActivationPin();
      selection = next;
      desiredX = null;
      caretFollowPending = true;
      // A gesture the queued `selectionchange` had not delivered still MOVED this caret, so
      // the room hears about it here too. The render around this one reports state and
      // repaints; presence is not part of either.
      publishLocalCollaborationSelection();
    },
    commit: (run) => commit(run),
    // The composition readback writes through the SAME lane as every other edit. Calling the
    // session directly skipped `trackedOps` and `writeRefusal`, so IME text in suggesting
    // mode landed untracked — the reviewer proposing a change was editing the document —
    // and forms protection and content-control locks did not apply to it either.
    applyOps: (ops, mark, scope) => applyOps(ops, mark, undefined, scope),
    hasPendingInput: () => typeBuffer.length > 0,
    replacementOffset: (paragraphId, from, to) =>
      replacementOffset({ paragraphId, offset: from }, { paragraphId, offset: to }),
    render: () => render(),
    flushLayout: () => flushLayout(),
    flushToPaint: () => flushToPaint(),
    updateCaret: () => {
      caret.update();
      syncActiveFieldShading(pagesLayer, collapsedCaretPosition());
    },
    textOf: (paragraphId) => textOf(paragraphId),
    pendingFormatOps: (paragraphId, offset, length, replacing) =>
      consumePendingFormatOps(paragraphId, offset, length, replacing),
    selectionMark: () => selectionMark(),
    now,
    recordSelectionMs: (ms) => {
      lastSelectionMs = ms;
    },
    isGesturing: () => pointer?.dragging() ?? false,
    domSelection: () => (cellSelection ? collapsedAt(cellSelection.text.anchor) : selection),
    holdsCellSelection: () => cellSelection !== null,
    // `surface` is assigned below; a composition can only end once a caller holds it.
    replaceSelectionWith: (text) => surface.type(text),
    discardPaint: () => discardRetainedPaint(pagesLayer),
  });

  hfScope = createHeaderFooterScopeController({
    session,
    layout: () => currentLayout,
    sectionAtPage,
    revisionDisplayMode,
    revisionAuthorFilter: revisionFilter,
    selection: () => selection,
    setScopeSelection: (next) => {
      // Entering or leaving a header/footer moves the caret ACROSS STORIES;
      // buffered body keystrokes must land in the body first, not the header.
      flushTypeBuffer();
      retireActivationPin();
      // The rest of what a caret move means, which this second entry point used to skip: an
      // armed typing format belongs to the position it was armed at, and a review card the
      // reader dismissed at one caret is not dismissed at the next. A round trip through a
      // header rearmed Bold on re-entry and left a card that would not reopen.
      reconcilePendingWith(next);
      dismissedReviewKeys.clear();
      selection = next;
      cellSelection = null;
      desiredX = null;
      publishLocalCollaborationSelection();
    },
    noteModelMoved: () => selectionSync.noteModelMoved(),
    render: () => render(),
    mirrorToDom: () => selectionSync.mirrorToDom(),
    notify: () => options.onChange?.(currentState()),
    materializedPages: () => materializedSet,
    entryRefused: () => editingMode === 'view',
    leaveOtherStories: () => noteOps?.exitNote(),
  });

  noteOps = createNoteOps({
    session,
    exitHeaderFooter: () => hfScope?.exitHeaderFooter(),
    applyOps,
    commit,
    selection: () => selection,
    selectionMark: () => selectionMark(),
    orderedStart: () => orderedStart(),
    deleteSelectionPlan: () => deleteSelectionPlan(),
    undo: () => surface.undo(),
    activeScope: () => {
      const note = noteOps?.activeNoteScope();
      if (note) return note;
      return hfScope?.activeScope() ?? { kind: 'body' };
    },
    setActiveScopeBodyOrHf: (scope) => hfScope!.setActiveScope(scope),
    setSelection: (next) => setSelection(next),
    noteModelMoved: () => selectionSync.noteModelMoved(),
    // Flushed first: note ops render right after their own commit, whose pass may have
    // deferred under input pressure — the render must show the note it just created. The
    // publish paints on its own, so the explicit render only covers the nothing-pending case.
    render: () => {
      if (!flushLayout()) render();
    },
    revealNote: (scopeId) => {
      // The note just inserted only exists in the post-commit layout, which the commit
      // may have deferred under input pressure.
      flushLayout();
      for (const page of currentLayout.pages) {
        const note = [...(page.footnotes?.notes ?? []), ...(page.endnotes?.notes ?? [])].find(
          (candidate) => candidate.scopeId === scopeId
        );
        if (!note) continue;
        scrollToContentY(note.box.y, note.box.height, {
          block: 'nearest',
          offsetPx: 48,
        });
        return page.index;
      }
      return null;
    },
    notify: () => options.onChange?.(currentState()),
    lastRejection: () => lastRejection,
    setLastRejection: (reason) => {
      lastRejection = reason;
    },
  });

  function setCellSelection(next: CellSelection | null): void {
    // A rectangle installs its own text selection; queued typing lands at the
    // caret it was typed at first.
    if (next) flushTypeBuffer();
    cellSelection = next;
    if (next) {
      reconcilePendingWith(next.text);
      retireActivationPin();
      selection = next.text;
    }
    desiredX = null;
    // Settled, not moved: the mirror on the next line makes the two agree before any render
    // can read them back — the same reason `setSelection` says so.
    selectionSync.noteSelectionSettled();
    selectionSync.mirrorToDom();
    renderOverlay();
    // A dismissal is dismissed for where the caret WAS; any move re-asks the question, which
    // is how the reader reopens an item — by clicking back into its text.
    dismissedReviewKeys.clear();
    // The caret decides which item is OPEN, so a move re-classes the bands. The rectangles
    // themselves are cached against the layout and are not recomputed here.
    renderCommentHighlights();
    publishLocalCollaborationSelection();
    options.onChange?.(currentState());
  }

  /**
   * Comment bands, computed ONCE per layout and re-classed on a caret move.
   *
   * The rectangles depend only on the layout and the comment ranges, so recomputing them
   * because the caret moved would re-walk the document on every arrow key. What the caret
   * changes is which band is the active one, and that is a class.
   */
  let commentRectCache: {
    layout: SemanticLayout;
    revision: number;
    pages: ReadonlySet<number> | undefined;
    rects: readonly (OverlayRect & { key: string })[];
  } | null = null;

  /**
   * A small window around the caret, for when the real visible set is unknown.
   *
   * Not a guess at what is on screen — a bound. A band outside it is not drawn, and the next
   * paint with a real scroller draws it.
   */
  function caretPageWindow(): ReadonlySet<number> {
    const caret = caretAt(currentLayout, selection.head);
    const centre = caret?.pageIndex ?? 0;
    const window_ = new Set<number>();
    for (let page = centre - 1; page <= centre + 1; page += 1) {
      if (page >= 0 && page < currentLayout.pages.length) window_.add(page);
    }
    return window_;
  }

  /** Paragraph id to the page it starts on, built once per layout. */
  const paragraphPageCache = new WeakMap<SemanticLayout, Map<string, number>>();
  function paragraphPagesOf(layout: SemanticLayout): Map<string, number> {
    const cached = paragraphPageCache.get(layout);
    if (cached) return cached;
    const index = new Map<string, number>();
    for (const page of layout.pages) {
      for (const fragment of paragraphFragmentsOf(page)) {
        if (!index.has(fragment.paragraphId)) index.set(fragment.paragraphId, page.index);
      }
    }
    paragraphPageCache.set(layout, index);
    return index;
  }

  function commentRects(): readonly (OverlayRect & { key: string })[] {
    const revision = session.revision();
    // When the scroller is unknown — before mount, in a hidden container, in a host that is
    // not the packaged viewport — `materializedSet` is undefined, and "measure every band on
    // every page" is 30ms per keystroke on exactly the documents that can least afford it.
    // The caret's page and its neighbours are a bound that is always available.
    const pages = materializedSet ?? caretPageWindow();
    if (
      commentRectCache?.layout === currentLayout &&
      commentRectCache.revision === revision &&
      equalPageSets(commentRectCache.pages, pages)
    ) {
      return commentRectCache.rects;
    }
    const paragraphPages = paragraphPagesOf(currentLayout);
    /** Skip an item that cannot be on screen, before measuring anything about it. */
    const onScreen = (from: string, to: string): boolean => {
      if (!pages) return true;
      // EITHER end. Testing only the start dropped the band for a comment spanning pages
      // 1–5 the moment page 1 scrolled away, so the highlight vanished from the middle of
      // its own range. `keyedRangeRects` clips to the visible pages anyway; this is only a
      // pre-filter, and a false keep costs one range's measurement.
      const start = paragraphPages.get(from);
      const end = paragraphPages.get(to);
      if (start === undefined || end === undefined) return true;
      for (let page = Math.min(start, end); page <= Math.max(start, end); page += 1) {
        if (pages.has(page)) return true;
      }
      return false;
    };
    const ranges: KeyedRange[] = [];
    for (const item of visibleReviewItems()) {
      if (item.kind === 'comment') {
        if (item.range === null) continue;
        if (!onScreen(item.range.start.paragraphId, item.range.end.paragraphId)) continue;
        ranges.push({
          key: reviewItemKey(item),
          from: { paragraphId: item.range.start.paragraphId, offset: item.range.start.offset },
          to: { paragraphId: item.range.end.paragraphId, offset: item.range.end.offset },
        });
        continue;
      }
      // Revisions are measured in the SAME pass and drawn only when active: tracked text
      // already carries an underline, a strike and a margin bar, so banding all of it would
      // repeat what the decoration says and leave a page of edits as one solid wash.
      // Custom-node cards take the same treatment — the chip tint already marks the node
      // persistently, so its band appears only while its card is open.
      const key = reviewItemKey(item);
      const itemRanges = item.kind === 'revision' ? item.ranges : item.range ? [item.range] : [];
      for (const [index, range] of itemRanges.entries()) {
        if (!onScreen(range.start.paragraphId, range.end.paragraphId)) continue;
        ranges.push({
          key: itemRanges.length === 1 ? key : `${key}${RANGE_SUFFIX}${index}`,
          from: { paragraphId: range.start.paragraphId, offset: range.start.offset },
          to: { paragraphId: range.end.paragraphId, offset: range.end.offset },
        });
      }
    }
    const byKey = keyedRangeRects(currentLayout, ranges, pages, measurer);
    const rects: (OverlayRect & { key: string })[] = [];
    for (const [key, found] of byKey) for (const rect of found) rects.push({ ...rect, key });
    commentRectCache = { layout: currentLayout, revision, pages, rects };
    return rects;
  }

  /**
   * Paragraph id to document position over EVERY story the review queue lists — body
   * first, then each furniture part — memoized per package revision and body root.
   *
   * Deliberately NOT the open story's scoped order: `rangeCovers` looks the caret's and an
   * item's paragraphs up here, and an id the index cannot see is an item that can never
   * become active. Scoping to the open story made every header item unactivatable from
   * the body, every body item unactivatable while a header was open, and every textbox
   * item unactivatable always (the shallow order stops at the host paragraph) — the DEEP
   * order descends into `w:txbxContent`. Containment only ever compares positions within
   * one story, and furniture ranks after the body, so the merge cannot invent a cover.
   */
  let reviewOrderIndexCache: {
    readonly packageRevision: number;
    readonly bodyRoot: object;
    readonly index: Map<string, number>;
  } | null = null;
  /**
   * Carry the index across a commit that cannot reorder paragraphs.
   *
   * The key is (package revision, body root) and a keystroke moves both, so without this the
   * memo guaranteed exactly one whole-document rebuild per keystroke — the #391 shape, in the
   * render path. A text-local commit with no created, deleted, split or joined paragraphs
   * preserves every paragraph id and their order in every story, so the index is re-stamped
   * to the values the next read will key on. Anything wider drops it, and commits that bypass
   * the subscription (a package-shell edit) leave a stale key the read-side check rebuilds —
   * the safe direction.
   */
  function retainReviewOrderIndex(change: TreeModelChange): void {
    if (!reviewOrderIndexCache) return;
    if (
      change.impact === 'text-local' &&
      change.created.length === 0 &&
      change.deleted.length === 0 &&
      change.splitJoin.length === 0
    ) {
      reviewOrderIndexCache = {
        packageRevision: session.packageRevision(),
        bodyRoot: session.part().root,
        index: reviewOrderIndexCache.index,
      };
    } else {
      reviewOrderIndexCache = null;
    }
  }
  function reviewOrderIndex(): Map<string, number> {
    const packageRevision = session.packageRevision();
    const bodyRoot = session.part().root;
    if (
      reviewOrderIndexCache &&
      reviewOrderIndexCache.packageRevision === packageRevision &&
      reviewOrderIndexCache.bodyRoot === bodyRoot
    ) {
      return reviewOrderIndexCache.index;
    }
    const index = new Map<string, number>();
    const append = (order: ReadonlyMap<string, number>): void => {
      const base = index.size;
      for (const [id, position] of order) {
        if (!index.has(id)) index.set(id, base + position);
      }
    };
    append(deepParagraphOrderOfPart(session.part()));
    const seenParts = new Set<unknown>([session.part()]);
    for (const section of session.headerFooterPartsBySection()) {
      for (const slots of [section.headers, section.footers]) {
        for (const part of slots.values()) {
          if (seenParts.has(part)) continue;
          seenParts.add(part);
          append(deepParagraphOrderOfPart(part));
        }
      }
    }
    // Note stories too, now that their revisions reach the queue: a paragraph missing from
    // this index is an item `rangeCovers` can never match, so a footnote card listed but
    // could never become the ACTIVE one — and the rail gates its reply box on that.
    for (const noteKind of ['footnote', 'endnote'] as const) {
      const part = session.partFor({ kind: 'notesPart', noteKind });
      if (!part || seenParts.has(part)) continue;
      seenParts.add(part);
      append(deepParagraphOrderOfPart(part));
    }
    reviewOrderIndexCache = { packageRevision, bodyRoot, index };
    return index;
  }

  /** Which comment the caret is in, so its band reads as the open one. */
  /**
   * The items dismissed at THIS caret position, until the caret next moves.
   *
   * Lives HERE rather than in a host, because the band and the card must agree: the surface
   * paints one and publishes the other, and a copy of this flag on either side of that line
   * is a copy that can disagree.
   *
   * A SET, not one slot. Several cards can cover one position — `w:ins` wrapping `w:del` gives
   * an insertion and a deletion one identical range — and with a single slot closing the open
   * one simply promoted its twin: the reader pressed close, the other card opened, pressed
   * close again, and the first came back. It alternated forever, and the only way out was to
   * move the caret off the change. Closing a card now closes it, and the next one down is
   * offered exactly once.
   */
  const dismissedReviewKeys = new Set<string>();

  /**
   * Revision kinds the caret must not activate — the host rail's own exclusion filter,
   * mirrored here so the band and the visible cards stay one answer. Null means none.
   */
  let reviewActivationExclusions: ReadonlySet<ReviewRevisionKind> | null = null;

  /**
   * The item a host opened BY KEY, with the selection that opening it installed.
   *
   * The caret cannot name a card when two cards cover exactly the same characters, and OOXML
   * writes that shape routinely: `w:ins` wrapping `w:del` is content one reviewer added and
   * another struck, and the insertion and the deletion share one identical range. Classifying
   * by position picked whichever the queue listed first, so clicking either card lit up the
   * same one and the other was unreachable.
   *
   * Checked against the LIVE selection AND retired by any selection write that is not
   * activation's own. The value check alone was enough while the pin held a RANGE — no
   * click can reproduce two distinct positions, so a moved caret invalidated it by
   * inspection. A pin holding a CARET is exactly what a click produces, so a reader
   * returning to that offset would revive it, and the pin outranks the caret rule: an
   * ordinary click on the left edge of a nested change reopened the outer card instead of
   * the inner one it should classify to.
   */
  let activatedReview: {
    readonly key: string;
    readonly anchor: SemanticPosition;
    readonly head: SemanticPosition;
  } | null = null;

  /**
   * Set only while {@link activateReview} installs its own caret, so the write below does
   * not retire the pin it was just asked to raise.
   */
  let activationSelectionWrite = false;

  /** Any selection the reader (or an edit) moves retires the pin. See {@link activatedReview}. */
  function retireActivationPin(): void {
    if (!activationSelectionWrite) activatedReview = null;
  }

  /** The pinned item, while its own selection is still the live one. */
  function activatedReviewItem(): ReviewItem | null {
    const pin = activatedReview;
    if (!pin || !selection) return null;
    const same = (a: SemanticPosition, b: SemanticPosition): boolean =>
      a.paragraphId === b.paragraphId && a.offset === b.offset;
    if (!same(selection.anchor, pin.anchor) || !same(selection.head, pin.head)) return null;
    const found = visibleReviewItems().find((item) => reviewItemKey(item) === pin.key);
    if (!found) return null;
    // Explicit activation can inspect a resolved comment. The caret path below still ignores
    // resolved comments, so they never reopen from ordinary document navigation.
    if (
      found.kind === 'revision' &&
      reviewActivationExclusions !== null &&
      reviewActivationExclusions.has(found.revisionKind)
    ) {
      return null;
    }
    return found;
  }

  function activeReviewAtCaret(): ReviewItem | null {
    // An explicit activation outranks the caret's own reading of where it landed.
    const pinned = activatedReviewItem();
    if (pinned) return resolveReviewThread(pinned);
    const at = selection?.head;
    if (!at) return null;
    // An empty queue still builds the order index. NOT gated: the index's `partFor` reads are
    // what durably open the note stores on first render, and skipping them moved paraId
    // minting into the first note edit — where undo can no longer unwind it to opening bytes
    // (`story-parity-scope-transitions.test.ts`). The retention above makes the build a
    // once-per-structural-change cost rather than a per-keystroke one, which is the part that
    // was worth having.
    // The covering items, innermost first, minus the one the reader dismissed. Returning
    // null for a dismissed innermost item hid every item under it too: dismissing a comment
    // that wraps a revision meant the revision could never become active either.
    const covering = reviewItemsAt(visibleReviewItems(), at, reviewOrderIndex()).filter(
      (item) =>
        !(item.kind === 'comment' && item.resolved) &&
        !dismissedReviewKeys.has(reviewItemKey(item)) &&
        // Kinds the host's rail hides must not become active from a click: the band
        // would light a card nothing on screen renders (see the contract note on
        // `setReviewActivationExclusions`).
        !(
          item.kind === 'revision' &&
          reviewActivationExclusions !== null &&
          reviewActivationExclusions.has(item.revisionKind)
        )
    );
    const found = covering[0];
    if (!found) return null;
    return resolveReviewThread(found);
  }

  /**
   * A REPLY resolves to the card it renders inside — the comment it answers, or the tracked
   * change it answers. It has no card of its own, so returning it opened an item nothing on
   * screen was drawing: the reply box vanished from the very thing that had just been replied
   * to. Comment threads survived that by accident (the parent comes first in `comments.xml`
   * order and won the tie); a revision does not, because a comment outranks one outright at
   * equal width.
   *
   * Shared by the caret path and the pinned one: a host can activate a reply's key too, and
   * resolving it in only one of the two would have opened a card nothing draws.
   */
  function resolveReviewThread(found: ReviewItem): ReviewItem | null {
    if (found.kind !== 'comment') return found;
    const root = reviewThreadRootOf(visibleReviewItems(), found);
    // A root the reader DISMISSED takes its whole thread with it. Falling back to the reply
    // here painted the band active over a card that is not drawn — a reply renders inside its
    // root, so dismissing the root leaves nothing on screen to be active — and the reader who
    // closed the card watched the text stay highlighted as though it were still open.
    return dismissedReviewKeys.has(reviewItemKey(root)) ? null : root;
  }

  function visibleReviewItems(): readonly ReviewItem[] {
    return revisionAuthorVisibility.filterItems(session.reviewItems());
  }

  // Both presence-colour answers, and why they rank differently: see the module.
  const presenceColors = createPresenceColors({
    roster: reviewAuthors.get,
    styles: () => revisionStyles,
    slots: stableAuthorSlots,
  });
  const remotePresenceColor = presenceColors.forAuthor;
  const declaredPresenceColor = presenceColors.declaredFor;

  /** The class a band draws in, or null when this range should not be drawn at all. */
  function bandClassFor(
    key: string,
    active: ReviewItem | null,
    byKey: ReadonlyMap<string, ReviewItem>
  ): string | null {
    // A revision's key is suffixed per range when one decision covers several sites, so the
    // active test compares the DECISION, not the site. Split on NUL, which an author name
    // cannot contain — `#` can, and an author called `A#b` never saw their band light up.
    const parts = key.split(RANGE_SUFFIX);
    const decision = parts[0]!;
    const isActive = active !== null && decision === reviewItemKey(active);
    if (key.startsWith('comment-')) {
      const item = byKey.get(decision);
      const resolved = item?.kind === 'comment' && item.resolved;
      if (resolved && !isActive) return null;
      return isActive
        ? `docx-comment-band docx-comment-band--active${resolved ? ' docx-comment-band--resolved-active' : ''}`
        : 'docx-comment-band';
    }
    // A custom node's band only while its card is open: the chip tint already marks the
    // node persistently, and the comment band is the right weight for "this is the one".
    if (key.startsWith('custom-')) {
      return isActive ? 'docx-comment-band docx-comment-band--active' : null;
    }
    const item = byKey.get(decision);
    if (!item || item.kind !== 'revision') return null;
    // In the revision's OWN colour — green for text arriving, red for text leaving — so the
    // band never contradicts the decoration beneath it. A REPLACEMENT is one decision in two
    // colours: its leading ranges are the struck half, the rest is what took their place, and
    // painting the pair one neutral grey said "something changed here" about an edit whose
    // two halves the page is already colouring.
    const index = parts.length > 1 ? Number(parts[1]) : 0;
    const kindOf = (revisionKind: ReviewRevisionKind): 'delete' | 'insert' | 'other' => {
      if (revisionKind === 'delete' || revisionKind === 'moveFrom') return 'delete';
      if (revisionKind === 'insert' || revisionKind === 'moveTo') return 'insert';
      if (revisionKind === 'replace' && item.replacedRangeCount !== undefined) {
        return index < item.replacedRangeCount ? 'delete' : 'insert';
      }
      return 'other';
    };
    const kind = kindOf(item.revisionKind);
    // Every pending change carries a band, faint until it is the open one. A tracked page
    // with no tint at all made "which of these is selected" a question about a 1px margin
    // bar; a page where only the active one tints made the others look resolved.
    return `docx-revision-band docx-revision-band--${kind}${isActive ? ' docx-revision-band--active' : ''}`;
  }

  let commentHighlightLayout: SemanticLayout | null = null;
  let commentHighlightActiveKey: string | null | undefined;
  let commentHighlightAuthors: ReadonlyMap<string, ReviewAuthorInfo> | null = null;

  function renderCommentHighlights(force = false): void {
    const active = activeReviewAtCaret();
    const activeKey = active ? reviewItemKey(active) : null;
    // The roster is part of what these bands DRAW, so it belongs in what decides they can be
    // left alone. A full `render` forces this layer anyway, which is how a live colour change
    // reaches it today — but the unforced callers below (activation, exclusions) would happily
    // reuse bands resolved against a roster that had moved underneath them.
    const roster = reviewAuthors.get();
    if (
      !force &&
      commentHighlightLayout === currentLayout &&
      commentHighlightActiveKey === activeKey &&
      commentHighlightAuthors === roster.resolved
    ) {
      return;
    }
    // Once per paint, not once per rect: a decision spanning many lines asked the same
    // question for every one of them.
    const byKey = new Map<string, ReviewItem>();
    for (const item of visibleReviewItems()) byKey.set(reviewItemKey(item), item);
    const bands: OverlayRect[] = [];
    for (const rect of commentRects()) {
      const className = bandClassFor(rect.key, active, byKey);
      if (!className) continue;
      // WHOSE band, for CSS to key on. The rect's key is suffixed per range for a revision
      // covering several sites, so the author comes from the decision, as the class does.
      const item = byKey.get(rect.key.split(RANGE_SUFFIX)[0]!);
      const name = item ? reviewItemAuthor(item) : null;
      const reviewAuthor = name === null || name === '' ? undefined : roster.resolved.get(name);
      bands.push({ ...rect, className, ...(reviewAuthor ? { reviewAuthor } : {}) });
    }
    paintSelectionOverlay(commentLayer, currentLayout, bands, {
      scale,
      ...(materializedExtent ? { pageOffsetX: materializedExtent.pageOffsetX } : {}),
    });
    commentHighlightLayout = currentLayout;
    commentHighlightActiveKey = activeKey;
    commentHighlightAuthors = roster.resolved;
  }

  /** Draw selected cells, retained text, or paragraph marks native selection cannot show. */
  function renderOverlay(): void {
    const rects = cellSelection
      ? cellSelectionRects(currentLayout, cellSelection.cellIds)
      : retainedSelection
        ? selectionRects(currentLayout, retainedSelection, paragraphOrder(), measurer)
        : selectionMarkRects(currentLayout, selection, paragraphOrder(), measurer);
    paintSelectionOverlay(
      overlayLayer,
      currentLayout,
      rects,
      // Pages of differing width are centred individually, so the overlay has to carry the
      // same per-page offset the painter applied or a highlight in a landscape section would
      // sit beside the cells it describes.
      {
        scale,
        pageOffsetX: materializedExtent?.pageOffsetX,
        ...(cellSelection
          ? {}
          : {
              className: retainedSelection
                ? 'docx-retained-selection-rect'
                : 'docx-selection-mark-rect',
            }),
      }
    );
  }

  /** Draw ephemeral remote selections from semantic layout geometry. */
  function renderRemoteSelections(): void {
    if (!remoteSelectionRenderingReady) {
      remoteSelectionLayer.replaceChildren();
      return;
    }
    const collaboration = collaborationSession;
    if (!collaboration) {
      remoteSelectionLayer.replaceChildren();
      return;
    }
    paintRemoteSelections(remoteSelectionLayer, currentLayout, collaboration.remoteSelections(), {
      scale,
      pageOffsetX: materializedExtent?.pageOffsetX,
      ...(materializedSet ? { pages: materializedSet } : {}),
      // The review roster's answer, resolved per painted author. The painter folds what
      // this returns into its memo key, so a roster move repaints presence on the next
      // pass without a second invalidation channel.
      colorForAuthor: remotePresenceColor,
      declaredColorFor: declaredPresenceColor,
      labelHost: remoteCaretLabelHost,
      measurer,
    });
  }

  function targetToc(tocId?: string) {
    const tocs = detectBodyTocs(session.part());
    if (tocId) return tocs.find((toc) => toc.id === tocId) ?? null;
    // The right-click target first: a menu row carries no id, and in a document with two
    // tables of contents the caret cannot disambiguate them — it is never inside either.
    const pointed = contextTocId ? tocs.find((toc) => toc.id === contextTocId) : undefined;
    if (pointed) return pointed;
    const paragraphId = selection.head.paragraphId;
    return (
      tocs.find(
        (toc) =>
          toc.beginParagraphId === paragraphId ||
          toc.endParagraphId === paragraphId ||
          toc.resultParagraphIds.includes(paragraphId)
      ) ?? (tocs.length === 1 ? tocs[0]! : null)
    );
  }

  function tocIdAtParagraph(paragraphId: string): string | null {
    const toc = detectBodyTocs(session.part()).find(
      (candidate) =>
        candidate.beginParagraphId === paragraphId ||
        candidate.endParagraphId === paragraphId ||
        candidate.resultParagraphIds.includes(paragraphId)
    );
    return toc?.id ?? null;
  }

  function selectionTouchesToc(): boolean {
    return (
      tocIdAtParagraph(selection.anchor.paragraphId) !== null ||
      tocIdAtParagraph(selection.head.paragraphId) !== null
    );
  }

  function opTouchesToc(op: TreeDocOp): boolean {
    const ids = tocParagraphIds();
    const inspect = (value: unknown, key = ''): boolean => {
      if (typeof value === 'string') {
        return /(?:Id|Ids)$/.test(key) && ids.has(value);
      }
      if (Array.isArray(value)) return value.some((entry) => inspect(entry, key));
      if (!value || typeof value !== 'object') return false;
      return Object.entries(value).some(([nestedKey, nested]) => inspect(nested, nestedKey));
    };
    return inspect(op);
  }

  function tocParagraphIds(): ReadonlySet<string> {
    return new Set(
      detectBodyTocs(session.part()).flatMap((toc) => [
        toc.beginParagraphId,
        ...toc.resultParagraphIds,
        toc.endParagraphId,
      ])
    );
  }

  /** Every paragraph one TOC owns. Re-read per pass: a replace mints new result ids. */
  function tocRegionOf(toc: DetectedToc): ReadonlySet<string> {
    return new Set([toc.beginParagraphId, toc.endParagraphId, ...toc.resultParagraphIds]);
  }

  /** Painted lines the TOC regions occupy, which bounds the caret's escape from one. */
  function tocRegionLineCount(paragraphIds: ReadonlySet<string>): number {
    let lines = 0;
    for (const page of currentLayout.pages) {
      for (const fragment of paragraphFragmentsOf(page)) {
        if (paragraphIds.has(fragment.paragraphId)) lines += fragment.lines.length;
      }
    }
    return lines;
  }

  function pageNumbersFor(
    layout: SemanticLayout,
    paragraphIds: readonly string[]
  ): ReadonlyMap<string, string> {
    const wanted = new Set(paragraphIds);
    const result = new Map<string, string>();
    for (const page of layout.pages) {
      for (const fragment of paragraphFragmentsOf(page)) {
        if (!wanted.has(fragment.paragraphId) || result.has(fragment.paragraphId)) continue;
        const source = page.pageFieldSource;
        result.set(
          fragment.paragraphId,
          formatPageNumber(source?.pageNumber ?? page.index + 1, source?.format)
        );
      }
    }
    return result;
  }

  function canRefreshToc(tocId?: string): boolean {
    if (editingMode === 'view' || !session.editable) return false;
    const toc = targetToc(tocId);
    if (!toc) return false;
    return (
      validateTreeOp(session.part(), {
        op: 'rewriteTocPageNumbers',
        tocId: toc.id,
        updates: [],
      }) === null
    );
  }

  /**
   * The op behind Insert › Table, or null when the size is not one this engine authors.
   *
   * Column width is the caret SECTION's content width divided evenly, not the document's:
   * in a mixed-orientation document the table is about to live on the caret's page, and a
   * grid sized for another section's width is a table that overhangs its own margin.
   */
  function insertTableOp(rows: number, cols: number) {
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) return null;
    const section = structure.sectionPropertiesAt(selection.head.paragraphId);
    const contentWidth =
      section.pageSize.widthTwips -
      section.margins.leftTwips -
      section.margins.rightTwips -
      section.margins.gutterTwips;
    // A section whose margins swallow the page still gets a usable table rather than a
    // refusal: the floor is the same minimum a column resize may drag to.
    const columnWidthTwips = Math.max(
      MIN_TABLE_COLUMN_WIDTH_TWIPS,
      Math.floor(contentWidth / cols)
    );
    return {
      op: 'insertTable' as const,
      beforeParagraphId: selection.head.paragraphId,
      rows,
      cols,
      columnWidthTwips,
    };
  }

  function canInsertTable(rows: number, cols: number): boolean {
    if (editingMode === 'view' || !session.editable) return false;
    const op = insertTableOp(rows, cols);
    // Validated against the part the CARET is in, the same part `applyOps` will write to.
    // Against the body part, a caret in a header named a paragraph that part has never heard
    // of, so the op was refused as `unknown-paragraph` before it was ever applied — and the
    // refusal reached the toolbar as a message about where tables may go.
    const part = session.partFor(storyScope()) ?? session.part();
    return op !== null && validateTreeOp(part, op) === null;
  }

  function insertTable(rows: number, cols: number): boolean {
    if (!canInsertTable(rows, cols)) return false;
    const op = insertTableOp(rows, cols);
    if (!op) return false;
    // The op publishes the first cell's paragraph as its caret hint, and that hint is the
    // whole point of the gesture — Word leaves you typing in cell one. Adopting it needs the
    // committed-caret subscription, the same way a table command plan does: without it the
    // pre-edit selection mark is restored and the caret stays in the anchor paragraph
    // BELOW the new table.
    let committedCaret: { readonly paragraphId: string; readonly start: number } | null = null;
    const unsubscribe = session.subscribe((change) => {
      if (change.caret) committedCaret = change.caret;
    });
    let committed = false;
    try {
      commit(
        () => {
          const applied = applyOps([op], selectionMark());
          if (!applied.committed) {
            lastRejection = applied.reason ?? 'the table could not be inserted here';
          }
          committed = applied.committed;
          return applied;
        },
        () => {
          const caret = committedCaret;
          return caret
            ? collapsedAt({ paragraphId: caret.paragraphId, offset: caret.start })
            : null;
        }
      );
    } finally {
      unsubscribe();
    }
    return committed;
  }

  const INSERT_TOC_INSTRUCTION = 'TOC \\o "1-3" \\h';

  function insertTocOp() {
    const instruction = parseTocInstruction(INSERT_TOC_INSTRUCTION);
    if (!instruction) return null;
    const outline = session.documentOutline();
    const plan = planTocEntries(
      session.part(),
      outline,
      instruction,
      pageNumbersFor(
        surface.layout(),
        outline.map((entry) => entry.blockId)
      ),
      tocParagraphIds(),
      // Planning runs BEFORE the transaction, so no ambient actor is bound yet. Passed
      // explicitly, the `_Toc` names two peers mint concurrently land in separate stripes
      // instead of colliding on one name that then anchors both hyperlinks.
      collaborationSession?.identity.actorId
    );
    return {
      op: 'insertToc' as const,
      beforeParagraphId: selection.head.paragraphId,
      instruction: INSERT_TOC_INSTRUCTION,
      alias: tocLabels?.title ?? 'TOC',
      entries: plan.entries,
      bookmarksToCreate: plan.bookmarksToCreate,
    };
  }

  function canInsertToc(): boolean {
    if (editingMode === 'view' || !session.editable || selectionTouchesToc()) return false;
    const op = insertTocOp();
    return op !== null && validateTreeOp(session.part(), op) === null;
  }

  function insertToc(): boolean {
    if (!canInsertToc()) return false;
    const op = insertTocOp();
    if (!op) return false;
    const existing = new Set(detectBodyTocs(session.part()).map((toc) => toc.id));
    const inserted = applyJournaledOps([op], undefined, undefined, BODY_STORY);
    if (!inserted.committed) {
      lastRejection = inserted.reason ?? 'the table of contents could not be inserted';
      return false;
    }
    const created = detectBodyTocs(session.part()).find((toc) => !existing.has(toc.id));
    return created ? refreshToc(created.id, 'pageNumbers') : true;
  }

  function refreshToc(tocId?: string, mode: 'entire' | 'pageNumbers' = 'entire'): boolean {
    let toc = targetToc(tocId);
    if (!toc || !canRefreshToc(toc.id)) return false;

    let layout = surface.layout();
    const outline = session.documentOutline();
    const outlineBlockIds = outline.map((entry) => entry.blockId);

    if (mode === 'entire') {
      const plan = planTocEntries(
        session.part(),
        outline,
        toc.instruction,
        pageNumbersFor(layout, outlineBlockIds),
        tocRegionOf(toc),
        collaborationSession?.identity.actorId
      );
      const replaced = applyJournaledOps(
        [
          {
            op: 'replaceTocResult',
            tocId: toc.id,
            entries: plan.entries,
            bookmarksToCreate: plan.bookmarksToCreate,
          },
        ],
        undefined,
        undefined,
        BODY_STORY
      );
      if (!replaced.committed) {
        lastRejection = replaced.reason ?? 'the table of contents could not be refreshed';
        return false;
      }
      layout = surface.layout();
      toc = targetToc(toc.id);
      if (!toc) return true;
    }

    let previousSignature = '';
    for (let pass = 0; pass < TOC_MAX_PAGE_PASSES; pass += 1) {
      const numbers = pageNumbersFor(layout, outlineBlockIds);
      // Each row is rewritten from the heading IT names, read from the row's own anchor or
      // title. Pairing rows with plan entries by POSITION looks equivalent right after a full
      // replace and is wrong everywhere else: one heading added or removed since the cache was
      // written shifts every page number by one, silently, which is the exact state that
      // "update page numbers only" exists to repair.
      const headings = resolveTocRowHeadings(session.part(), toc, outline, tocRegionOf(toc));
      const updates = toc.resultParagraphIds.flatMap((paragraphId, index) => {
        const headingId = headings[index];
        const pageNumberText = headingId ? numbers.get(headingId) : undefined;
        return pageNumberText === undefined ? [] : [{ paragraphId, pageNumberText }];
      });
      if (updates.length === 0) break;
      const signature = updates
        .map((update) => `${update.paragraphId}\u0000${update.pageNumberText}`)
        .join('\u0001');
      if (signature === previousSignature) break;
      previousSignature = signature;
      const rewritten = applyJournaledOps(
        [{ op: 'rewriteTocPageNumbers', tocId: toc.id, updates }],
        undefined,
        undefined,
        BODY_STORY
      );
      if (!rewritten.committed) {
        if (rewritten.rejected) {
          lastRejection = rewritten.reason ?? 'the table of contents page numbers were refused';
          return false;
        }
        break;
      }
      layout = surface.layout();
      toc = targetToc(toc.id) ?? toc;
    }

    return true;
  }

  /**
   * Rewrite stale REF field results in the body and note stories, so a save exports what
   * the pages paint. Planning is read-only — the note parts are read from the package,
   * never through `partFor`, which would durably open a notes store — so a document whose
   * results are already fresh commits no transaction, bumps no revision and adds no undo
   * entry. Every stale story commits together as ONE transaction and ONE undo unit
   * (`applyTreeOpsAtomic`): a refusal anywhere rolls the whole refresh back, so the saved
   * file can never mix refreshed and stale values, and a single undo restores the exact
   * pre-save document. Viewing and a non-editable session write nothing.
   *
   * COLLABORATIVE SESSIONS SKIP THE REFRESH: the collaboration gate admits only body
   * insert/delete text ops, so the rewrite cannot journal to peers. The save then exports
   * the cached results (the pre-refresh behavior; Word refreshes fields on open), and the
   * `false` return says so rather than claiming freshness.
   */
  function refreshRefFieldResults(): boolean {
    return refreshSurfaceRefFieldResults({
      session,
      editingMode,
      collaborationActive: collaborationSession !== undefined,
      reviewerFilterActive: revisionFilter() !== undefined,
      layout: surface.layout(),
      canonicalUnfilteredLayout: canonicalUnfilteredLayoutForSave,
      styleCascade: styleCascade(),
      numberingIndex: numberingIndex(),
      displayMode: revisionDisplayMode(),
    });
  }

  // Which range a destructive or replacing gesture acts on, and where content replacing it
  // lands once a tracked strike has had its say. Wired ABOVE the surface object on purpose:
  // `createHeaderFooterOps` and `createImageOps` below take `deleteSelectionOps`,
  // `orderedStart` and `selectionMark` BY REFERENCE, eagerly, so these bindings have to
  // exist by the time that object literal is evaluated.
  const {
    selectionMark,
    orderedRange,
    orderedStart,
    textOf,
    inlineControlBeside,
    splitEndsTheParagraph,
    deleteSelectionPlan,
    deleteSelectionOps,
    replacementOffset,
  } = createSurfaceRangeEditOps({
    session,
    layout: () => currentLayout,
    selection: () => selection,
    cellSelection: () => cellSelection,
    editingMode: () => editingMode,
    author: () => author,
    trackedDate,
    storyScope,
    paragraphOrder,
    flushPendingInputAndLayout,
    trackedAuthorOrNone,
    atParagraphEnd: (paragraphId, offset) => nextStyle.atParagraphEnd(paragraphId, offset),
  });

  // Clipboard glue over the payload builder and the paste router. Also above the surface
  // object: `insertPlainText` is handed to `createBeforeInputHandler` by reference.
  const { insertPlainText, copyFlavoursNow, pasteRichNow, armForcePlainPaste } =
    createSurfaceClipboardOps({
      session,
      layout: () => currentLayout,
      cellSelection: () => cellSelection,
      editingMode: () => editingMode,
      storyScope,
      paragraphOrder,
      actorId: () => collaborationSession?.identity.actorId,
      collaborationGate: (ops, scope) => collaborationSession?.gateOperations(ops, scope) ?? null,
      now,
      flushPendingInputAndLayout,
      orderedRange,
      selectionMark,
      deleteSelectionPlan,
      consumePendingFormatOps,
      withoutPendingOnRejection,
      caretMark,
      commit,
    });

  function applyRevisionAuthorVisibility(moved: boolean): void {
    if (!moved) return;
    notePropertiesCache = null;
    flushPendingInputAndLayout();
    furnitureSource = createCurrentFurnitureSource(revisionFilter());
    scheduler.invalidateAll(session.packageRevision(), 'tracked-change-filter');
    scheduler.flush();
    options.onChange?.(currentState());
  }

  const surface: ScaleMutableSurface = {
    session,
    // The internal gated write — see the `ScaleMutableSurface` note. The content-control
    // commands wrote `session.applyTreeOps` directly, which skipped the collaboration gate
    // and actor binding every other lane goes through.
    applyGatedTreeOps: (ops, before, after, scope) =>
      applyJournaledOps(ops, before, after, scope ?? storyScope()),
    storyScope,
    imageDecodePort: () => decodePort,
    // Flushes first: a commit made straight on the session — undo, or another editor
    // sharing the store — must not leave a caller reading geometry for a revision the model
    // has left behind. Nothing pending makes this a plain read.
    layout: () => {
      flushPendingInputAndLayout();
      return currentLayout;
    },
    state: currentState,
    currentPage: (mode = 'caret') => {
      flushPendingInputAndLayout();
      if (mode === 'viewport') {
        const page = viewportPage(container, currentLayout, scale);
        if (page !== null) return page;
      }
      const caret = caretAt(currentLayout, selection.head);
      return caret ? caret.pageIndex + 1 : 1;
    },

    setScale(nextScale) {
      if (!(nextScale > 0) || !Number.isFinite(nextScale)) return false;
      if (nextScale === scale) return true;

      const previous = { scale, defaults, measurer, producer, furnitureSource };

      // TOTAL by construction: a zoom click gets an answer, never an exception. Everything a
      // rescale touches — the anchor read, the measurer resolution, layout, paint — is inside
      // the guard, and the rollback carries its own.
      try {
        const scroller = surfaceScroller(container);
        // The anchor is kept in LAYOUT coordinates, the frame `visiblePageSet` and
        // `viewportPage` read. The scroller is not the surface's offset parent in a real host —
        // toolbar and ruler chrome sit above it — so the container's own offset comes out
        // before the divide and goes back in on the way out, or the page under the viewport
        // centre changes as the scale does.
        const anchor = scroller
          ? {
              x: (scroller.scrollLeft - container.offsetLeft + scroller.clientWidth / 2) / scale,
              y: (scroller.scrollTop - container.offsetTop + scroller.clientHeight / 2) / scale,
            }
          : null;
        scale = nextScale;
        if (!options.measurer) {
          defaults = resolveDefaultSurfaceMeasurer(scale, {
            context: tryCreateBrowserCanvasContext(container.ownerDocument),
            ...(options.fontAlias ? { fontAlias: options.fontAlias } : {}),
          });
          measurer = defaults.measurer;
        }
        // Read from the resolution just made, not from mount's: a canvas that is available at
        // mount and gone by the next zoom resolves to the fixed grid, and the identity has to
        // say so.
        producer = producerIdentity();
        // EVERY input the mount-time source is given, not a subset. Rebuilt without the three
        // drawing hooks, a header's inline pictures lost their layout context for the rest of
        // the session the first time the user zoomed.
        furnitureSource = createCurrentFurnitureSource(revisionFilter());
        // Dropped rather than trusted: both describe a paint made at the OLD scale, and a
        // flush that publishes nothing (a revision already superseded) would otherwise leave
        // the overlay painting against them.
        materializedSet = undefined;
        materializedExtent = undefined;
        commentRectCache = null;
        scheduler.invalidateAll(session.packageRevision(), 'zoom');
        scheduler.flush();
        if (scroller && anchor) {
          const targetLeft = Math.max(
            0,
            anchor.x * scale + container.offsetLeft - scroller.clientWidth / 2
          );
          const targetTop = Math.max(
            0,
            anchor.y * scale + container.offsetTop - scroller.clientHeight / 2
          );
          const maxLeft = Number.isFinite(scroller.scrollWidth)
            ? Math.max(0, scroller.scrollWidth - scroller.clientWidth)
            : null;
          const maxTop = Number.isFinite(scroller.scrollHeight)
            ? Math.max(0, scroller.scrollHeight - scroller.clientHeight)
            : null;
          scroller.scrollLeft = maxLeft === null ? targetLeft : Math.min(targetLeft, maxLeft);
          scroller.scrollTop = maxTop === null ? targetTop : Math.min(targetTop, maxTop);
          // The paint above chose its pages for the scroll offset the viewport had BEFORE the
          // restore. Building the destination band here keeps the zoom to one turn; leaving it
          // to the scroll listener showed the user shells for a frame.
          rematerialize();
        }
        return true;
      } catch {
        ({ scale, defaults, measurer, producer, furnitureSource } = previous);
        materializedSet = undefined;
        materializedExtent = undefined;
        commentRectCache = null;
        // NESTED, because the rollback lays out too: whatever failed the rescale can fail the
        // recovery, and the caller still has to be told "no". The previous paint stands, and
        // the next commit or scroll repaints it.
        try {
          scheduler.invalidateAll(session.packageRevision(), 'zoom-rollback');
          scheduler.flush();
        } catch {
          /* nothing left to try; the answer below is the whole contract */
        }
        return false;
      }
    },

    enqueueType,
    flushPendingInput: flushPendingInputAndLayout,

    type(text) {
      // Insert at the selection's START, not at its head. Deleting a selection removes the
      // range beginning at the start, so inserting at the head — which may be the far end —
      // puts the text where the removed characters used to be rather than where the user
      // was typing.
      const plan = deleteSelectionPlan();
      // In SUGGESTING the deletion keeps the characters it strikes, so the replacement goes
      // after them — only then are the two halves adjacent, which is what lets the pane
      // fold them into one `Replaced "x" with "y"` card. The plan's `replaceAt` owns that
      // rule for every replacing lane, including where the range spans paragraph marks.
      const target = plan.replaceAt ?? plan.collapseTo;
      // Consume the stored caret format (armed only at a collapsed caret, so it cannot
      // coexist with the delete ops below): the typed range gets the caret run's own
      // properties plus the armed ones, in the SAME transaction — one undo step.
      const pendingOps = consumePendingFormatOps(target.paragraphId, target.offset, text.length);
      const insertOps: TreeDocOp[] = [
        ...plan.ops,
        { op: 'insertText', paragraphId: target.paragraphId, offset: target.offset, text },
      ];
      const redoMark = {
        paragraphId: target.paragraphId,
        start: target.offset + text.length,
        end: target.offset + text.length,
      };
      commit(
        () =>
          withoutPendingOnRejection(
            [...insertOps, ...pendingOps],
            insertOps,
            selectionMark(),
            redoMark
          ),
        () => collapsedAt({ paragraphId: target.paragraphId, offset: target.offset + text.length })
      );
    },
    proposeTextChange: (kind, text, author) => commitProposedTextChange(kind, text, author),

    // The newline-aware sibling of `type`, declared below in this same scope. On the
    // contract because text arriving from OUTSIDE the editor — a paste from the clipboard,
    // whether the browser's own event delivered it or a menu row did — is not a lane the
    // input handlers should own privately.
    insertPlainText: (text: string) => insertPlainText(text),

    deleteBackward() {
      const plan = deleteSelectionPlan();
      if (plan.ops.length > 0) {
        commit(
          () => applyOps(plan.ops, selectionMark(), caretMark(plan.collapseTo)),
          () => collapsedAt(plan.collapseTo)
        );
        return;
      }
      // Word keeps the typing format across Backspace: bold armed at a caret survives
      // deleting the character before it, re-anchored where the caret lands.
      const armed = armedAtCaret() ?? undefined;
      const position = selection.head;
      if (position.offset === 0) {
        // Backspace at the start of a paragraph pulls it into the previous one. Refusing
        // here made the key look broken: a caret at the paragraph start is where a user
        // presses Backspace precisely because they want the paragraphs merged.
        // A break the reader cannot SEE is not a break they can delete. In a resolved display
        // mode a tracked paragraph mark is already merged away on the page, so Backspace at
        // the start of a later member takes the character before it — the one under the
        // caret's left edge — instead of joining two paragraphs and carrying a mark revision
        // onto a paragraph nobody edited.
        for (const member of mergedPredecessorsOf(currentLayout, position.paragraphId)) {
          const text = textOf(member);
          if (text.length === 0) continue;
          commit(
            () =>
              applyOps(
                [
                  {
                    op: 'deleteText',
                    paragraphId: member,
                    start: text.length - 1,
                    end: text.length,
                  },
                ],
                selectionMark(),
                caretMark({ paragraphId: member, offset: text.length - 1 })
              ),
            () => collapsedAt({ paragraphId: member, offset: text.length - 1 }),
            { rearmPending: armed }
          );
          return;
        }
        const order = paragraphOrder();
        const index = order.indexOf(position.paragraphId);
        const previous = order[index - 1];
        if (!previous) return;
        // ONLY A SIBLING CAN BE JOINED. Document order walks straight into the last cell of a
        // table, so Backspace at the start of the paragraph after one built a join the store
        // is guaranteed to refuse — the key did nothing AND left `not-adjacent-siblings` on
        // the surface, where a host that surfaces refusals reported an error for an ordinary
        // Backspace. Word moves the caret into the last cell instead; doing nothing is the
        // half of that this lane can honestly promise.
        if (!joinableSiblings(previous, position.paragraphId)) {
          setSelection(collapsedAt({ paragraphId: previous, offset: textOf(previous).length }));
          return;
        }
        const joinAt = textOf(previous).length;
        commit(
          () =>
            applyOps(
              [{ op: 'joinParagraphs', firstId: previous, secondId: position.paragraphId }],
              selectionMark(),
              caretMark({ paragraphId: previous, offset: joinAt })
            ),
          () => collapsedAt({ paragraphId: previous, offset: joinAt }),
          { rearmPending: armed }
        );
        return;
      }
      // Backspace at a chip's outer edge takes the WHOLE node — see `inlineControlBeside`.
      // A wrapper-locked control refuses the op and the key does nothing, which is the
      // lock doing its job rather than a bug.
      const chip = inlineControlBeside(position, 'before');
      if (chip) {
        commit(
          () =>
            applyOps(
              [{ op: 'removeContentControl', controlId: chip.controlId, keepContent: false }],
              selectionMark(),
              caretMark({ paragraphId: position.paragraphId, offset: chip.start })
            ),
          () => collapsedAt({ paragraphId: position.paragraphId, offset: chip.start }),
          { rearmPending: armed }
        );
        return;
      }
      commit(
        () =>
          applyOps(
            [
              {
                op: 'deleteText',
                paragraphId: position.paragraphId,
                start: position.offset - 1,
                end: position.offset,
              },
            ],
            selectionMark(),
            caretMark({ ...position, offset: position.offset - 1 })
          ),
        () => collapsedAt({ ...position, offset: position.offset - 1 }),
        { rearmPending: armed }
      );
    },

    splitParagraph() {
      // Enter REPLACES a selection, like every other insertion — splitting at the head left
      // the selected text in place and cut the paragraph at whichever end the user happened
      // to drag to. `replaceAt` puts the break AFTER the words a suggestion strikes, so the
      // strike and the proposed break read as one decision instead of two.
      const plan = deleteSelectionPlan();
      const position = plan.replaceAt ?? plan.collapseTo;
      const before = new Set(session.paragraphIdsIn(storyScope()));
      // Word carries the typing format across Enter: bold armed before the split applies
      // to the first characters typed in the new paragraph.
      const armed = armedAtCaret() ?? undefined;
      // Word's `w:next`: Enter at the END of a paragraph starts one in the style that
      // paragraph's style names as its follower, which is what stops a heading from being
      // followed by a second heading.
      const tailStyleId = splitEndsTheParagraph(position)
        ? nextStyle.followerStyleId(position.paragraphId)
        : undefined;
      commit(
        () =>
          applyOps(
            [
              ...plan.ops,
              {
                op: 'splitParagraph',
                paragraphId: position.paragraphId,
                offset: position.offset,
                tailStyleId,
              },
            ],
            selectionMark()
          ),
        () => {
          // The tail is the id the store minted that was not there before.
          const tail = session.paragraphIdsIn(storyScope()).find((id) => !before.has(id));
          return tail ? collapsedAt({ paragraphId: tail, offset: 0 }) : null;
        },
        { rearmPending: armed }
      );
    },

    navigate(command, extend = false) {
      // Arrow keys move from the caret AFTER the typed text, over the layout
      // that includes it.
      flushPendingInputAndLayout();
      if (
        !extend &&
        (command === 'left' || command === 'right') &&
        (selection.anchor.paragraphId !== selection.head.paragraphId ||
          selection.anchor.offset !== selection.head.offset)
      ) {
        // A plain horizontal arrow collapses a range to that arrow's edge. Starting a
        // navigation step at `selection.head` moved one character beyond that edge, or one
        // character from the wrong edge when the range was selected backwards.
        const range = orderedRange();
        desiredX = null;
        setSelection(collapsedAt(command === 'left' ? range.from : range.to), true);
        return;
      }
      let moved = navigateInActiveScope(
        currentLayout,
        selection.head,
        command,
        desiredX,
        hfScope?.getActive() ?? null,
        noteScopeId(),
        measurer
      );
      if (!moved) return;
      const tocIds = tocParagraphIds();
      if (tocIds.has(moved.position.paragraphId)) {
        if (extend) return;
        const backwards = new Set<NavigationCommand>([
          'left',
          'wordLeft',
          'lineStart',
          'up',
          'pageUp',
        ]);
        // The escape steps by LINE, never by character. A character step inside a row that
        // has any text at all lands in the same paragraph, and the loop's own "we did not
        // change paragraph" bail then fired on the first iteration: the caret could neither
        // enter the region nor cross it, so everything past a table of contents was
        // unreachable from the keyboard. A line step always leaves the row it starts on.
        const escape: NavigationCommand = backwards.has(command) ? 'up' : 'down';
        // One iteration per line the region occupies, plus slack for the landing line. The
        // loop breaks the moment it is outside, so an over-generous bound costs nothing.
        const limit = tocRegionLineCount(tocIds) + 4;
        for (let step = 0; step < limit; step += 1) {
          const next = navigateInActiveScope(
            currentLayout,
            moved.position,
            escape,
            moved.desiredX,
            hfScope?.getActive() ?? null,
            noteScopeId(),
            measurer
          );
          // Only a position that does not move at all is a dead end. Comparing paragraph ids
          // alone treats ordinary movement within a row as one.
          if (
            !next ||
            (next.position.paragraphId === moved.position.paragraphId &&
              next.position.offset === moved.position.offset)
          ) {
            return;
          }
          moved = next;
          if (!tocIds.has(moved.position.paragraphId)) break;
        }
        if (tocIds.has(moved.position.paragraphId)) return;
      }
      desiredX = moved.desiredX;
      // Note continuations share one EditorScope across pages: retarget the visual
      // occurrence before selection/caret paint so the DOM host follows geometry.
      if (
        noteOps?.activeNoteScope() &&
        moved.pageIndex !== undefined &&
        Number.isInteger(moved.pageIndex)
      ) {
        noteOps.setActiveNotePageIndex(moved.pageIndex);
      }
      setSelection(
        { anchor: extend ? selection.anchor : moved.position, head: moved.position },
        true
      );
    },

    deleteWordBackward() {
      if (surface.deleteSelection()) return;
      const head = selection.head;
      // Stopped at a struck half's edge, like every other word walk: Ctrl+Backspace at the
      // end of a replacement's new text must not reach back through the old text with it.
      const target = wordBoundary(
        textOf(head.paragraphId),
        head.offset,
        -1,
        deletedTextBoundaries(currentLayout, head.paragraphId)
      );
      if (target === head.offset) {
        surface.deleteBackward();
        return;
      }
      commit(
        () =>
          applyOps(
            [{ op: 'deleteText', paragraphId: head.paragraphId, start: target, end: head.offset }],
            selectionMark()
          ),
        () => collapsedAt({ ...head, offset: target }),
        { rearmPending: armedAtCaret() ?? undefined }
      );
    },

    deleteWordForward() {
      if (surface.deleteSelection()) return;
      const head = selection.head;
      const target = wordBoundary(
        textOf(head.paragraphId),
        head.offset,
        1,
        deletedTextBoundaries(currentLayout, head.paragraphId)
      );
      if (target === head.offset) {
        surface.deleteForward();
        return;
      }
      commit(
        () =>
          applyOps(
            [{ op: 'deleteText', paragraphId: head.paragraphId, start: head.offset, end: target }],
            selectionMark()
          ),
        undefined,
        { rearmPending: armedAtCaret() ?? undefined }
      );
    },

    deleteForward() {
      if (surface.deleteSelection()) return;
      // Delete keeps the typing format like Backspace does — the caret does not move, so
      // the armed format re-anchors in place.
      const armed = armedAtCaret() ?? undefined;
      const position = selection.head;
      const text = textOf(position.paragraphId);
      if (position.offset < text.length) {
        // Delete at a chip's leading edge takes the WHOLE node — the forward mirror of
        // the Backspace rule above.
        const chip = inlineControlBeside(position, 'after');
        if (chip) {
          commit(
            () =>
              applyOps(
                [{ op: 'removeContentControl', controlId: chip.controlId, keepContent: false }],
                selectionMark()
              ),
            () => collapsedAt(position),
            { rearmPending: armed }
          );
          return;
        }
        commit(
          () =>
            applyOps(
              [
                {
                  op: 'deleteText',
                  paragraphId: position.paragraphId,
                  start: position.offset,
                  end: position.offset + 1,
                },
              ],
              selectionMark()
            ),
          undefined,
          { rearmPending: armed }
        );
        return;
      }
      // At the end of a paragraph, Delete pulls the NEXT one up — the mirror of Backspace at
      // offset zero, and the reason a document can be flattened without reaching for a mouse.
      const order = paragraphOrder();
      const next = order[order.indexOf(position.paragraphId) + 1];
      if (!next) return;
      // Unless the break is one a resolved view already merged away. The reader sees one
      // paragraph, so Delete takes the next CHARACTER, exactly as Backspace does at the other
      // side of the same invisible break — joining here would resolve a tracked decision the
      // keypress never named, and take the paragraph after it as well.
      if (mergedPredecessorsOf(currentLayout, next).includes(position.paragraphId)) {
        const following = textOf(next);
        if (following.length === 0) return;
        commit(
          () =>
            applyOps([{ op: 'deleteText', paragraphId: next, start: 0, end: 1 }], selectionMark()),
          () => collapsedAt(position),
          { rearmPending: armed }
        );
        return;
      }
      commit(
        () =>
          applyOps(
            [{ op: 'joinParagraphs', firstId: position.paragraphId, secondId: next }],
            selectionMark()
          ),
        () => collapsedAt(position),
        { rearmPending: armed }
      );
    },

    ...structure,
    ...format,

    setSelection: (next) => {
      // An explicit host write that MOVES the caret is an intentional selection — a test or
      // an automation host addressing a drawing's anchor means the drawing. A same-position
      // write stays inert: the font-load remount restores the saved caret through here
      // during a plain open, and that restore must not select a drawing the user never did
      // (the carried initialDrawingSelectionIntent already preserves a real one).
      if (!selectionsEqual(next, selection)) setDrawingIntent({ kind: 'programmatic' }, false);
      setSelection(next);
    },

    selectDrawing(drawingNodeId, hostParagraphId) {
      flushLayout();
      const at = drawingSelectionPosition(currentLayout, drawingNodeId, hostParagraphId);
      if (!at) return false;
      const next = collapsedAt(at);
      setDrawingIntent({ kind: 'pointer', drawingNodeId }, selectionsEqual(next, selection));
      setSelection(next);
      return resolveSelectedDrawingRecord(surface)?.drawingNodeId === drawingNodeId;
    },

    revealPage(pageIndex, options) {
      // Flushed like its siblings below: a page the deferred pass creates is not findable
      // in the superseded layout, and "false" must mean "no such page", not "not yet".
      flushLayout();
      const page = currentLayout.pages.find((entry) => entry.index === pageIndex);
      return page ? scrollToContentY(page.box.y, page.box.height, options) : false;
    },

    revealParagraph(paragraphId, options) {
      flushLayout();
      // The paragraph's own line, not the top of its page: a heading two thirds down a
      // page is the thing the caller asked to see.
      const caret = caretAt(currentLayout, { paragraphId, offset: 0 });
      if (!caret) return false;
      const page = currentLayout.pages.find((entry) => entry.index === caret.pageIndex);
      if (!page) return false;
      // `contentBox`, not `box`: caret geometry is CONTENT-BOX relative — the painter parents
      // the caret into `.docx-page-content`, which starts one top margin down the sheet.
      // Against `box.y` every reveal undershot by exactly that margin (72pt on a 1" page), so
      // the target landed just under the fold and the reader had to scroll to see what they
      // had just jumped to.
      return scrollToContentY(page.contentBox.y + caret.y, caret.height, options);
    },

    revealPosition(position, options) {
      flushLayout();
      const caret = caretAt(currentLayout, position);
      if (!caret) return false;
      const page = currentLayout.pages.find((entry) => entry.index === caret.pageIndex);
      if (!page) return false;
      // 'nearest' by default: callers reveal on every activation, and a target already in
      // view must not yank the viewport.
      return scrollToContentY(page.contentBox.y + caret.y, caret.height, {
        block: 'nearest',
        ...options,
      });
    },

    setEditable(editable) {
      // The DOM affordance, not the document's own editability: `session.editable` says
      // whether the FILE can be round-tripped, and this says whether the user may type into
      // it right now. Both have to be true for an edit to land.
      hostEditable = editable;
      applyEditableChrome();
    },

    selectAll() {
      const ids = paragraphOrder();
      const first = ids[0];
      const last = ids[ids.length - 1];
      if (!first || !last) return;
      setSelection({
        anchor: { paragraphId: first, offset: 0 },
        head: { paragraphId: last, offset: textOf(last).length },
      });
    },

    hyperlinks,
    equations,
    contentControls: contentControlsOps,
    formatPainter,
    canInsertTable,
    insertTable,
    canInsertToc,
    insertToc,
    canRefreshToc,
    refreshToc,
    refreshRefFieldResults,
    isInsideToc: (paragraphId) =>
      detectBodyTocs(session.part()).some(
        (toc) =>
          toc.beginParagraphId === paragraphId ||
          toc.endParagraphId === paragraphId ||
          toc.resultParagraphIds.includes(paragraphId)
      ),
    retainSelection: () => {
      const pin = Symbol('selection-pin');
      retainedSelections.set(pin, selection);
      retainedSelection = selection;
      renderOverlay();
      return pin;
    },
    releaseSelection: (pin) => {
      if (!retainedSelections.delete(pin)) return;
      restoreLatestRetainedSelection();
      renderOverlay();
    },
    retainedSelection: () => retainedSelection,

    publishedLayout: () => currentLayout,

    drawingSelectionIntent: () => drawingIntent,

    overlayCoordinates: () =>
      Object.freeze({
        paintScale: scale,
        pageOffsetX: materializedExtent?.pageOffsetX ?? new Map<number, number>(),
      }),

    commitReviewOps: (run, intent) => {
      // The text the caret's paragraph held BEFORE the resolution, so the caret can be mapped
      // across what Accept or Reject removed. Clamping alone only fires when the paragraph
      // ends up shorter than the offset; a caret in the MIDDLE of a paragraph that shrank
      // silently re-points at different characters, and the next thing typed lands there.
      // The baseline is read from the LAYOUT, so buffered typing and a deferred pass must
      // land first or the diff runs against text the resolution never saw.
      flushPendingInputAndLayout();
      const caretParagraph = selection.head.paragraphId;
      const beforeText = textOf(caretParagraph);
      return commit(
        // Reported as a RESULT, not a boolean: `commit` reads the refusal reason off it, and
        // a boolean made every refused accept clear `lastRejection` instead of setting it.
        () => {
          // Resolving a revision or writing a comment is a WRITE, so viewing refuses it here
          // too. These paths reach the store through the session directly rather than
          // through `applyOps`, so the lane gate above never sees them.
          if (editingMode === 'view') {
            return { committed: false, rejected: true, opCount: 0, reason: VIEWING_REFUSAL };
          }
          if (
            collaborationSession &&
            (intent === undefined || !REPLICABLE_REVIEW_WRITES.has(intent))
          ) {
            return {
              committed: false,
              rejected: true,
              opCount: 0,
              reason: 'experimental-collaboration-body-text-only',
            };
          }
          // The READINESS gate the typing lane asks (`applyJournaledOps`). Review writes
          // reach the store past `applyOps`, so without this a disconnected replica still
          // committed a comment locally and never replicated it. The ops are opaque here —
          // the callback builds them — so the gate sees an empty batch: its readiness and
          // attachment ladder still answers, which is the half this lane was missing.
          if (collaborationSession) {
            const collaborationRefusal = collaborationSession.gateOperations([], storyScope());
            if (collaborationRefusal) {
              return { committed: false, rejected: true, opCount: 0, reason: collaborationRefusal };
            }
          }
          // Bound to the collaboration actor: review writes mint comment and content-control
          // ids outside `applyOps`, so nothing else would bind one. Two peers commenting on
          // the same snapshot would otherwise both take `w:id="${highest + 1}"`.
          const result = runWithTransactionActor(collaborationSession?.identity.actorId, run);
          return {
            committed: result.committed,
            rejected: !result.committed,
            opCount: 0,
            ...(typeof result.reason === 'string' ? { reason: result.reason } : {}),
          };
        },
        () => {
          // The layout is FLUSHED first, because the clamp needs post-edit lengths and this
          // thunk runs before the repaint. Resolving a revision can remove the very characters
          // the caret was in; an offset left past the end refuses every keystroke that follows
          // it, which is what made the document look frozen after an Accept.
          flushLayout();
          // Raise the flag AGAIN. It is one-shot, `commit` raised it before this thunk ran,
          // and the flush above consumed it — so the render that follows read the stale DOM
          // selection back over the clamp and the caret jumped to the paragraph start.
          selectionSync.noteModelMoved();
          // Clamped within the story the READER is in, for the reason `applyAutomationOps`
          // states below: the body's paragraph list is the wrong ruler while a header or a
          // note is open, and clamping to it moved the caret into the document while the
          // scope stayed on the furniture — after which every keystroke was refused as
          // `unknown-paragraph`. Accepting a header card is exactly that situation.
          const order = paragraphOrder();
          if (order.length === 0) return null;
          const mapped = mappedAcrossTextChange(selection, caretParagraph, beforeText);
          return clampedToDocument(currentLayout, order, mapped);
        }
      );
    },

    revisionDisplayMode,
    replacementLanding,
    applyAutomationOps: (staged, scope) => {
      // THE SAME PATH A KEYSTROKE TAKES, minus the keystroke. `applyOps` is where viewing
      // refuses and where suggesting turns an edit into a proposal, and `commit` is where the
      // refusal is recorded, the caret is re-clamped and the pages are repainted. A host that
      // reached `session.applyTreeOps` instead — as this one did — typed into a document open
      // for viewing and wrote permanent text while the chrome said Suggesting.
      //
      // The scope comes from the CALLER, because the handle named a story. It defaults to the
      // body rather than to the reader's story: the input path follows the reader into a
      // header, and a scripted edit must not, or an object model holding a body paragraph
      // would write into whatever furniture happened to be open.
      let result: ReturnType<TreeDocxSession['applyTreeOps']> = {
        committed: false,
        rejected: false,
        opCount: 0,
      };
      const story = scope ?? BODY_STORY;
      commit(
        () => {
          // THE GATE BEFORE THE OPS EXIST. Building them mints the relationship an external
          // hyperlink names, which changes the PACKAGE — outside the transaction, outside the undo
          // stack, and left behind by a refusal. Viewing is asked first, so a document open for
          // reading comes out of this byte-identical; `edits: false` keeps the question to the rule
          // that holds for every op, because a batch of tracked-change DECISIONS is not an edit and
          // `applyOps` below judges it on its own ops.
          const viewing = writeRefusal(false);
          if (viewing !== null) {
            return (result = { committed: false, rejected: true, opCount: 0, reason: viewing });
          }
          // The mint carries the edit rule with it: it IS an edit, so a mode that would refuse one
          // must refuse it, and refusing here means the relationship is never written.
          let refused: string | null = null;
          const ops = staged((url) => {
            const refusal = writeRefusal(true, [], false);
            // Bound to the collaboration actor for the same reason the mint is called out above:
            // it lands on the package outside the transaction, so nothing else would bind one, and
            // two peers linking at once would otherwise agree on `rId${max + 1}`.
            if (refusal === null) {
              return runWithTransactionActor(collaborationSession?.identity.actorId, () =>
                session.ensureHyperlinkRelationship(url, story)
              );
            }
            refused = refusal;
            return null;
          });
          if (ops === null) {
            return (result = {
              committed: false,
              rejected: true,
              opCount: 0,
              reason: refused ?? 'this engine will not author that hyperlink target',
            });
          }
          return (result = applyOps(ops, undefined, undefined, story, false));
        },
        () => {
          // Flushed before the clamp for the same reason `commitReviewOps` does it: the clamp
          // needs post-edit lengths, and this thunk runs before the repaint.
          flushLayout();
          selectionSync.noteModelMoved();
          // Clamped within the story the READER is in, which is not necessarily the story that
          // was just written. Clamping against the body's paragraphs while a header or a
          // footnote was open moved the caret into the document while the scope stayed on the
          // furniture, and the next keystroke — applied to the furniture story with a body
          // paragraph id — was refused as `unknown-paragraph`: the reader typed and nothing
          // happened. An empty order means the story is not painted yet; leaving the caret
          // alone is right there, because a clamp with nothing to clamp to is a caret reset.
          const order = paragraphOrder();
          if (order.length === 0) return null;
          return clampedToDocument(currentLayout, order, selection);
        }
      );
      return result;
    },

    editingMode: () => editingMode,
    setAuthor: (nextAuthor) => {
      if (author === nextAuthor) return;
      flushTypeBuffer();
      author = nextAuthor;
    },
    setDrawingStrings: (strings) => {
      if (drawingStrings === strings) return;
      if (drawingPaintStringsCacheToken(drawingStrings) === drawingPaintStringsCacheToken(strings))
        return;
      drawingStrings = strings;
      flushPendingInputAndLayout();
      render(false);
    },
    setTocLabels: (labels) => {
      tocLabels = labels;
    },
    setEditingMode: (mode) => {
      // Text typed under the OLD mode commits under it — a buffered edit must
      // not silently become a suggestion (or a viewing-mode refusal). The layout
      // flush rides along so the mode repaint below is not one commit behind.
      flushPendingInputAndLayout();
      // A host wiring a mode control re-sends the value it already has — a controlled prop
      // re-synced in an effect, a dropdown re-picking the current row. Repainting every
      // materialized page for a mode that did not move is the cost `setRevisionStyles`
      // guards against for the same reason. The notify below still runs: a caller asking
      // for a mode is entitled to hear the state back.
      const moved = editingMode !== mode;
      editingMode = mode;
      // Viewing has no furniture EDITING scope. Switching while a header was open left the
      // body dimmed and inert under an active band and its whole options bar — a write UI
      // over a document that now refuses writes. Exiting repaints, so this runs first.
      if (moved && mode === 'view') hfScope?.exitHeaderFooter();
      // An armed format painter is a write surface too, and a more misleading one: the pages
      // keep the paint cursor and every release goes on building ops the session then
      // refuses. Released rather than left standing, so the affordance and the answer agree.
      if (moved && mode === 'view') formatPainter.disarm();
      // An open widget menu is a WRITE surface: a date picker left standing across the
      // switch still offered a value the new mode refuses. Nothing else closes it.
      removeExistingContentControlMenu();
      applyEditableChrome();
      // A mode change moves no content, so nothing else here repaints. The chrome class
      // still has to follow immediately: without this the blank header/footer band kept
      // inviting a double-click to add a story that viewing mode then refused.
      setEditingModeChrome(container, editingMode);
      // Painted chrome reads the mode too — content-control widgets disable themselves on
      // it, and table furniture re-derives from it — so the pages have to be rebuilt even
      // though not one character moved.
      if (moved) render(false);
      // The old refusal described the old mode. Left standing, a host rendering it showed
      // "the document is open for viewing" over a document that had just become editable.
      lastRejection = null;
      options.onChange?.(currentState());
    },

    revisionAuthors: () => reviewAuthors.get().value,
    hiddenRevisionAuthors: () => revisionAuthorVisibility.hiddenAuthors,
    setRevisionAuthorVisible(author, visible) {
      applyRevisionAuthorVisibility(revisionAuthorVisibility.setVisible(author, visible));
    },
    setAllRevisionAuthorsVisible(visible) {
      applyRevisionAuthorVisibility(
        revisionAuthorVisibility.setAllVisible(reviewAuthors.get().value.keys(), visible)
      );
    },
    showAllRevisionAuthors() {
      applyRevisionAuthorVisibility(revisionAuthorVisibility.showAll());
    },
    setTrackedChangesFilter(predicate, mode) {
      applyRevisionAuthorVisibility(revisionAuthorVisibility.setPredicate(predicate, mode));
    },
    collaborationSession: () => collaborationSession ?? null,
    remotePresenceColor,
    setRevisionStyles: (colors) => {
      if (colors === revisionStyles) return;
      revisionStyles = colors;
      // BEFORE the repaint, as `rematerialize` does: `render` adopts a pending DOM gesture,
      // which moves the selection without passing `setSelection`'s buffer guard. A style
      // change can land mid-typing-burst — a colour picker is a live control — and buffered
      // characters are still destined for the old selection. The layout flush rides along
      // so the repaint below shows the burst it just landed rather than the pre-burst pages.
      flushPendingInputAndLayout();
      // Paint-level only: the reuse key moves with the resolved styles, so the pages
      // repaint in the new colours without a layout pass.
      render(false);
    },

    setRemoteCaretLabelHost: (host) => {
      if (host === remoteCaretLabelHost) return;
      remoteCaretLabelHost = host;
      // Registration and unregistration both repaint: the first publish must fire without
      // waiting for awareness to move, and clearing the host restores the default name
      // labels. The painter keys its memo on the host's identity, so this is a rebuild,
      // never a skip — and a skipped paint later never re-publishes.
      renderRemoteSelections();
    },

    setReviewActivationExclusions(kinds) {
      reviewActivationExclusions = kinds === null ? null : new Set(kinds);
      // The active answer may have just changed with no caret move: repaint the bands and
      // tell the host, exactly as dismissing does.
      renderCommentHighlights();
      options.onChange?.(currentState());
    },

    activeReviewKey: () => {
      const active = activeReviewAtCaret();
      return active ? reviewItemKey(active) : null;
    },
    activateReview: (key, next) => {
      // Reopening a card the reader dismissed has to clear the dismissal: activation can leave
      // the caret exactly where it already was, so nothing else would take it down and the card
      // would refuse to reopen however many times it was clicked.
      dismissedReviewKeys.clear();
      // The pin goes up BEFORE the selection is published, which is why the selection comes
      // through here rather than in a `setSelection` of the caller's own. Installed the other
      // way round, `setSelection` repainted the bands and fired `onChange` while the caret was
      // still the only evidence — so a host saw the WRONG twin reported active for one frame
      // and then a correction. One publish, one answer.
      activatedReview = next
        ? { key, anchor: next.anchor, head: next.head }
        : { key, anchor: selection.anchor, head: selection.head };
      if (next) {
        activationSelectionWrite = true;
        try {
          setSelection(next);
        } finally {
          activationSelectionWrite = false;
        }
        return;
      }
      renderCommentHighlights();
      options.onChange?.(currentState());
    },
    /** The card {@link activateReview} pinned, while its own selection is still live. */
    activatedReviewKey: () =>
      activatedReviewItem() === null ? null : (activatedReview?.key ?? null),
    dismissActiveReview: () => {
      const active = activeReviewAtCaret();
      if (!active) return;
      dismissedReviewKeys.add(reviewItemKey(active));
      // The pin outranks the caret, so leaving it up meant a dismissed card reopened itself
      // on the very next read.
      activatedReview = null;
      renderCommentHighlights();
      options.onChange?.(currentState());
    },

    navigation,

    bookmarks: () => session.bookmarks(),

    selectedText() {
      // A rectangle copies as a grid — tabs between cells, newlines between rows — because
      // the text range it stands in for would paste back as one run with the grid gone.
      if (cellSelection) return cellSelectionText(currentLayout, cellSelection);
      const { from, to } = orderedRange();
      return selectedTextIn(currentLayout, from, to, paragraphOrder());
    },

    copyFlavours: () => copyFlavoursNow(),
    pasteRich: (text: string, html: string | null) => pasteRichNow(text, html),
    armForcePlainPaste,

    deleteSelection() {
      const plan = deleteSelectionPlan();
      if (plan.ops.length === 0) return false;
      commit(
        () => applyOps(plan.ops, selectionMark(), caretMark(plan.collapseTo)),
        () => collapsedAt(plan.collapseTo)
      );
      return true;
    },

    setCellSelection,
    layoutSession: () => layoutSession,

    undo: () => {
      // Undo is a WRITE. It reached the session directly, so a document the toolbar called
      // read-only silently rewound under the reader's hands — the one lane that walked past
      // `applyOps`, `applyPmDoc` and `commitReviewOps` alike.
      if (editingMode === 'view') {
        lastRejection = VIEWING_REFUSAL;
        options.onChange?.(currentState());
        return;
      }
      // Batched typing becomes its own undo step BEFORE the rewind, so undo
      // first removes what was just typed rather than skipping past it.
      flushTypeBuffer();
      if (collaborationSession) {
        if (collaborationSession.undo()) restoreSelection(null);
        return;
      }
      restoreSelection(session.undo());
    },
    redo: () => {
      if (editingMode === 'view') {
        lastRejection = VIEWING_REFUSAL;
        options.onChange?.(currentState());
        return;
      }
      flushTypeBuffer();
      if (collaborationSession) {
        if (collaborationSession.redo()) restoreSelection(null);
        return;
      }
      restoreSelection(session.redo());
    },
    sectionAtPage,
    activeScope: () => {
      const note = noteOps?.activeNoteScope();
      if (note) return note;
      return hfScope!.activeScope();
    },
    setActiveScope: (scope: ViewScope) => {
      // Buffered typing belongs to the story it was typed in: it must land
      // BEFORE the active scope flips. A flush after the flip commits the burst
      // into the wrong story, or gets refused and silently drops it. Scope
      // entry resolves geometry from the layout, so a deferred pass lands too.
      flushPendingInputAndLayout();
      if (scope.kind === 'note') return noteOps!.enterNote(scope.id);
      // REFUSED BEFORE ANYTHING IS LEFT. A scope this surface does not open — `frame`, or
      // anything a later contract adds — used to fall through to the exit below and only
      // then report false: the call failed AND closed the note the reader had open.
      if (scope.kind !== 'body' && scope.kind !== 'headerFooter') return false;
      noteOps?.exitNote();
      return hfScope!.setActiveScope(scope);
    },
    insertNote: (noteKind) => {
      // Inserting a note ENTERS its story; same scope-flip rule as setActiveScope.
      flushPendingInputAndLayout();
      return noteOps!.insertNote(noteKind);
    },
    deleteNote: (noteKind, noteId) => noteOps!.deleteNote(noteKind, noteId),
    convertNote: (fromKind, noteId) => noteOps!.convertNote(fromKind, noteId),
    convertAllNotes: (fromKind) => noteOps!.convertAllNotes(fromKind),
    setNoteProperties: (args) => noteOps!.setNoteProperties(args),
    enterNote: (scopeId, position) => {
      flushPendingInputAndLayout();
      return noteOps!.enterNote(scopeId, position);
    },
    exitNote: () => {
      flushPendingInputAndLayout();
      return noteOps!.exitNote();
    },
    notePropertiesState: () => {
      // See notePropertiesCache for why each field is in the key.
      const paragraphId = surface.state().selection.head.paragraphId;
      const packageRevision = session.packageRevision();
      const pkg = session.currentPackage();
      const bodyPart = session.part();
      const settingsPart = settingsPartOf(pkg);
      const footnotesPart = resolveNotesPart(pkg, 'footnote');
      const endnotesPart = resolveNotesPart(pkg, 'endnote');
      const headerFooterOpen = surface.activeScope().kind === 'headerFooter';
      const hfState = surface.headerFooterState();
      const headerFooterRId = hfState?.rId ?? null;
      const headerFooterSectionIndex = hfState?.sectionIndex ?? null;
      const cached = notePropertiesCache;
      if (
        cached &&
        cached.packageRevision === packageRevision &&
        cached.paragraphId === paragraphId &&
        cached.bodyPart === bodyPart &&
        cached.settingsPart === settingsPart &&
        cached.footnotesPart === footnotesPart &&
        cached.endnotesPart === endnotesPart &&
        cached.headerFooterOpen === headerFooterOpen &&
        cached.headerFooterRId === headerFooterRId &&
        cached.headerFooterSectionIndex === headerFooterSectionIndex
      ) {
        return cached.result;
      }
      const result = notePropertiesStateOf(surface, revisionFilter());
      notePropertiesCache = {
        packageRevision,
        paragraphId,
        bodyPart,
        settingsPart,
        footnotesPart,
        endnotesPart,
        headerFooterOpen,
        headerFooterRId,
        headerFooterSectionIndex,
        result,
      };
      return result;
    },
    notePreviewText: (scopeId) => notePreviewTextOf(session, scopeId),
    applyTableCommandPlan(plan: TableCommandPlan): ExecResult {
      if (!plan.ok) {
        return { ok: false, code: plan.code, reason: plan.reason };
      }
      let committedCaret: {
        readonly paragraphId: string;
        readonly start: number;
        readonly end: number;
      } | null = null;
      const unsub = session.subscribe((change) => {
        if (change.caret) {
          committedCaret = change.caret;
        }
      });
      try {
        const selectionBefore = selectionMark();
        const adoptCaret = plan.selection.kind === 'adoptCommittedCaret';
        commit(
          () => applyOps(plan.ops, selectionBefore),
          adoptCaret
            ? () => {
                const caret = committedCaret;
                if (!caret) return null;
                return collapsedAt({
                  paragraphId: caret.paragraphId,
                  offset: caret.start,
                });
              }
            : undefined,
          plan.selection.kind === 'preserveSelection' ? { keepCellSelection: true } : undefined
        );
      } finally {
        unsub();
      }
      if (lastRejection) {
        return { ok: false, code: 'invalidArgs', reason: lastRejection };
      }
      return { ok: true, changed: true };
    },
    enterHeaderFooter: (args) => {
      // Land buffered body typing in the BODY before the scope flips to a
      // header/footer story (see setActiveScope). The band scroll below reads
      // the layout, so a deferred pass lands with it.
      flushPendingInputAndLayout();
      const entered = hfScope!.enterHeaderFooter(args);
      if (!entered) return entered;
      // A PROGRAMMATIC enter (review card, automation) must bring the band into view —
      // `followCaretIntoView` deliberately sits out while a furniture scope is open, and
      // the pointer path enters from a double-click that is by definition already on
      // screen. 'nearest' makes this a no-op in that already-visible case.
      const active = hfScope!.getActive();
      const page = active ? currentLayout.pages[active.pageIndex] : undefined;
      if (active && page) {
        const story = active.kind === 'header' ? page.header : page.footer;
        const bandY =
          story?.box.y ??
          (active.kind === 'header' ? page.box.y : page.box.y + page.box.height - 1);
        const bandHeight = story?.box.height ?? 1;
        scrollToContentY(bandY, bandHeight, { block: 'nearest' });
      }
      return entered;
    },
    exitHeaderFooter: () => {
      // Escape from a header lands buffered HEADER typing in the header first.
      flushPendingInputAndLayout();
      return hfScope!.exitHeaderFooter();
    },
    headerFooterState: () => hfScope!.headerFooterStateStable(session.packageRevision()),
    ...createHeaderFooterOps({
      applyOps,
      commit,
      deleteSelectionOps,
      deleteSelectionPlan: () => deleteSelectionPlan(),
      orderedStart,
      selectionMark,
      collapsedAt,
      isHeaderFooterOpen: () => hfScope?.getActive() !== null,
      lastRejection: () => lastRejection,
    }),
    ...createImageOps({
      session,
      applyOps,
      commit,
      storyScope,
      selectionMark,
      editingMode: () => editingMode,
      author: () => author,
      trackedDate,
      decodePort: () => decodePort,
      actorId: () => collaborationSession?.identity.actorId,
    }),

    // `preventScroll`: the pages layer is the WHOLE document tall, and focusing it scrolls
    // it into view — to its top. The first click anywhere in a long document therefore
    // threw the reader back to page 1 before the caret it had just placed could be seen.
    // The caret is positioned from layout regardless, so nothing needs the browser's scroll.
    focus: () => pagesLayer.focus({ preventScroll: true }),
    setTableInteractionLabel(resolver) {
      tableLabelState.resolve = resolver;
    },
    refreshTableInteractionLabels() {
      tableInteraction.refreshLabels();
    },
    destroy() {
      // Typed-but-unflushed text lands before teardown, so a detach-then-save
      // flow keeps the last keystrokes — all the way to a paint and its state
      // report: the final commit's `onChange` used to come from the synchronous
      // commit tail, and a deferral swallowed by `scheduler.cancel()` below
      // would silence the last keystrokes for an onChange-driven host.
      flushToPaint();
      document.removeEventListener('selectionchange', onSelectionChange);
      pagesLayer.removeEventListener('pointerdown', onDrawingPointerGesture, { capture: true });
      pagesLayer.removeEventListener('keydown', onDrawingKeyGesture, { capture: true });
      pagesLayer.removeEventListener('beforeinput', onDrawingKeyGesture, { capture: true });
      pagesLayer.removeEventListener('keydown', onKeyDown);
      pagesLayer.removeEventListener('beforeinput', onBeforeInput as EventListener);
      pagesLayer.removeEventListener('copy', onCopy as EventListener);
      pagesLayer.removeEventListener('cut', onCut as EventListener);
      pagesLayer.removeEventListener('paste', onPaste as EventListener);
      pagesLayer.removeEventListener('compositionstart', onCompositionStart);
      pagesLayer.removeEventListener('compositionend', onCompositionEnd);
      document.removeEventListener('scroll', onScroll, { capture: true });
      container.ownerDocument.defaultView?.removeEventListener('resize', onViewportResize);
      viewportObserver?.disconnect();
      observedScroller = null;
      textFormInteraction?.destroy();
      pointer?.destroy();
      tableInteraction.destroy();
      navigation.destroy();
      equationInteraction.destroy();
      selectionSync.destroy();
      pagesLayer.removeEventListener('contextmenu', onTocContextMenu);
      pagesLayer.removeEventListener('click', onTocRowClick);
      pagesLayer.removeEventListener('pointermove', onTocPointerMove);
      pagesLayer.removeEventListener('pointerleave', onTocPointerLeave);
      // Drop pending layout work and stop listening BEFORE the DOM goes, or a commit from
      // another editor sharing this store would paint into a detached container.
      scheduler.cancel();
      if (deferredPublishRender !== null) clearTimeout(deferredPublishRender);
      deferredPublishRender = null;
      if (cancelDerivationPrewarm) cancelDerivationPrewarm();
      cancelDerivationPrewarm = null;
      drawingBundle.dispose();
      detachDrawingUrlRegistry(pagesLayer);
      caret.destroy();
      unsubscribeRemoteSelections();
      unsubscribeCollaborationStatus();
      detachCollaboration();
      unsubscribe();
      container.replaceChildren();
    },
  };

  /**
   * Put the caret back where a reversed history entry left it.
   *
   * `null` means nothing moved — either the stack was empty or the entry recorded no
   * selection — so the caret stays where the user left it rather than jumping to the top.
   */
  function restoreSelection(
    mark: { paragraphId: string; start: number; end: number } | null
  ): void {
    // Undo and redo go straight to the session rather than through `commit`, so the armed
    // typing format is retired here. Word discards it on undo, and a history entry can
    // restore the caret to the exact position it was armed at — which would otherwise leave
    // it armed against a tree the undo has already replaced.
    pendingFormats = null;
    // The tree about to be published is not the one the DOM selection was made against, so
    // the flush below must not read it back: offsets in the reverted tree do not correspond
    // to offsets in the one that replaced it.
    selectionSync.noteModelMoved();
    flushLayout();
    if (!mark) {
      // No recorded mark — a cross-paragraph edit records none, because a mark addresses one
      // paragraph. The caret must still be CLAMPED to the tree undo just restored: leaving it
      // pointed past the end of a shortened paragraph, or at a paragraph the undo removed,
      // and every later keystroke was refused. Select All, type, undo froze the editor.
      setSelection(clampedToDocument(currentLayout, paragraphOrder(), selection));
      return;
    }
    // CLAMPED LIKE THE BRANCH ABOVE. A mark addresses one paragraph of whatever story the
    // edit was made in, and the reader may be somewhere else by the time they press Ctrl+Z:
    // edit the header, click into the body, undo, and the caret was installed on a header
    // paragraph while the body was the active story. The DOM caret then landed in furniture
    // that is `contenteditable="false"`, and every keystroke after it was refused as
    // `unknown-paragraph` — the editor looked dead until the user clicked.
    const restored = {
      anchor: { paragraphId: mark.paragraphId, offset: mark.start },
      head: { paragraphId: mark.paragraphId, offset: mark.end },
    };
    // A MARK FROM ANOTHER STORY IS NOT AN ADDRESS HERE. It names one paragraph of whatever
    // story the edit was made in, and the reader may be somewhere else by the time they press
    // Ctrl+Z: edit the header, click into the body, undo, and the caret was installed on a
    // header paragraph while the body was the active story. The DOM caret then landed in
    // furniture that is `contenteditable="false"` and every keystroke after it was refused as
    // `unknown-paragraph` — the editor looked dead until the user clicked. Clamped exactly
    // like the no-mark branch above; a mark the active story does hold is installed verbatim,
    // which is what keeps an ordinary undo on the offset it recorded.
    setSelection(
      paragraphOrder().includes(mark.paragraphId)
        ? restored
        : clampedToDocument(currentLayout, paragraphOrder(), restored)
    );
  }

  /**
   * Scroll the surface's container so a band of CONTENT space is in view.
   *
   * Layout coordinates, scaled here — never element measurement. The page a reveal is
   * asked for is usually one that has not been materialized yet, so it has no element to
   * read a position from; the records always know where it is.
   */
  function scrollToContentY(
    contentY: number,
    contentHeight: number,
    options?: {
      block?: 'start' | 'center' | 'centerIfNeeded' | 'nearest';
      offsetPx?: number;
      behavior?: ScrollBehavior;
    }
  ): boolean {
    const scroller = surfaceScroller(container);
    if (!scroller || scroller.clientHeight === 0) return false;
    const top = contentY * scale + container.offsetTop;
    const height = contentHeight * scale;
    const padding = options?.offsetPx ?? 24;
    const block = options?.block ?? 'start';
    const viewport = scroller.clientHeight;
    if (block === 'nearest' || block === 'centerIfNeeded') {
      const above = top < scroller.scrollTop;
      const below = top + height > scroller.scrollTop + viewport;
      if (!above && !below) return true;
    }
    const target =
      block === 'center' || block === 'centerIfNeeded'
        ? top - Math.max(0, (viewport - height) / 2)
        : block === 'nearest' && top > scroller.scrollTop
          ? top + height + padding - viewport
          : top - padding;
    const maxScroll = Math.max(0, scroller.scrollHeight - viewport);
    scroller.scrollTo({
      top: Math.max(0, Math.min(target, maxScroll)),
      behavior: options?.behavior ?? 'auto',
    });
    // Materialization follows the scroller, and a programmatic scroll fires `scroll`
    // asynchronously — repaint now so the revealed page is BUILT rather than a blank
    // sheet the caller has to scroll again to fill.
    rematerialize();
    return true;
  }

  // Event wiring lives HERE rather than in each host, so React, Vue and a plain page get
  // identical behaviour instead of three hand-written keymaps that drift. The handlers
  // themselves are factories over the surface interface: keys, clipboard and `beforeinput` in
  // surface-input.ts, the selection mirror and the IME lane in surface-selection-sync.ts.
  const { onSelectionChange, onCompositionEnd } = selectionSync;
  // The IME owns the DOM from compositionstart on; buffered plain typing must
  // be in the document before that handover, not woven into the readback. The
  // handover is of the PAINTED DOM, so a layout pass or paint a commit deferred
  // under input pressure must land too: the readback at compositionend diffs the
  // painted text against the model, and a composition that began over a stale
  // paint would read the missing edit back as the IME's own.
  //
  // The pending USER selection is taken up FIRST, exactly as `onKeyDown` does.
  // The flush's render mirrors the model selection into the DOM — over the
  // user's still-unadopted range — and its `applyingSelection` echo guard is
  // still up (it clears on a microtask) when `onCompositionStart` performs its
  // own mandatory adoption, which would skip it: the #383 lane choice would
  // again be made from a selection the user no longer has.
  const onCompositionStart: typeof selectionSync.onCompositionStart = (...args) => {
    selectionSync.adoptBeforeInput();
    flushToPaint();
    selectionSync.onCompositionStart(...args);
  };

  /**
   * The pointer lane's handle, assigned once the surface it drives exists.
   *
   * Read by the selection mirror: the browser keeps reporting its own idea of the selection
   * while a gesture runs, and adopting one of those mid-drag snaps the caret back to whatever
   * the DOM guessed.
   */
  let pointer: PointerController | null = null;
  textFormInteraction = createTextFormFieldInteraction({
    pagesLayer,
    container,
    part: () => partOfNodeId(session, selection.head.paragraphId) ?? session.part(),
    protected: (paragraphId = selection.head.paragraphId) =>
      formsProtectionEnabled(session.settingsRoot()) &&
      sectionProtectsForms(partOfNodeId(session, paragraphId) ?? session.part(), paragraphId),
    selection: () => selection,
    select: (next) => setSelection(next),
    editable: () => editingMode === 'edit',
    apply: (op) => {
      let applied = false;
      commit(() => {
        const result = applyOps([op]);
        applied = result.committed;
        return result;
      });
      return applied;
    },
  });
  const dispatchKeyDown = createKeyDownHandler(
    surface,
    options.onRequestHyperlink ? { onRequestHyperlink: options.onRequestHyperlink } : {}
  );
  const onKeyDown = (event: KeyboardEvent): void => {
    // The browser may have moved its caret without delivering the queued `selectionchange`
    // yet. Close that window before a command resolves its TreeDocOp from model selection.
    if (!event.defaultPrevented) selectionSync.adoptBeforeInput();
    if (!textFormInteraction?.keydown(event)) dispatchKeyDown(event);
  };
  const { onCopy, onCut, onPaste } = createClipboardHandlers(surface);
  const dispatchBeforeInput = createBeforeInputHandler(surface, {
    isComposing: () => selectionSync.isComposing(),
    insertPlainText,
    // The browser parked its own selection over the text a substitution replaced. Rewrite
    // the DOM selection now for a park that already happened, and flag the queued echo for
    // one that has not.
    onBrowserSelectionFixup: () => {
      selectionSync.mirrorToDom();
      selectionSync.noteBrowserSelectionFixup();
    },
  });
  const onBeforeInput = (event: InputEvent): void => {
    selectionSync.adoptBeforeInput();
    dispatchBeforeInput(event);
  };

  // Selection lives on the document, so this is where the browser reports it changing —
  // whatever produced it: a drag, a double-click, Select All, or a caret move.
  document.addEventListener('selectionchange', onSelectionChange);
  // Word's object-selection gestures. A primary press on a painted drawing selects THAT
  // drawing; a primary press anywhere else deselects. Only this listener can tell a click
  // ON the drawing from the untouched mount caret at the same offsets. A key that moves or
  // types (including Escape, which deselects an object in Word) returns the intent to
  // `none`; a lone modifier or ContextMenu leaves an existing selection alone — Word keeps
  // the object selected under its context menu. `beforeinput` covers virtual keyboards
  // that type without a keydown.
  const NON_DESELECTING_KEYS = new Set([
    'Shift',
    'Control',
    'Alt',
    'Meta',
    'CapsLock',
    'NumLock',
    'ScrollLock',
    'ContextMenu',
  ]);
  const onDrawingPointerGesture = (event: Event): void => {
    if (event instanceof PointerEvent && event.button !== 0) return;
    const element = event.target instanceof Element ? event.target : null;
    const drawingId = element
      ?.closest<HTMLElement>('[data-drawing-node-id]')
      ?.getAttribute('data-drawing-node-id');
    setDrawingIntent(
      drawingId ? { kind: 'pointer', drawingNodeId: drawingId } : { kind: 'none' },
      true
    );
  };
  const onDrawingKeyGesture = (event: Event): void => {
    if (event instanceof KeyboardEvent && NON_DESELECTING_KEYS.has(event.key)) return;
    // Delete/Backspace ON a selected drawing deletes THE DRAWING — Word's object gesture.
    // Without this the key fell through to the text keymap at a collapsed caret, where a
    // Delete beside the picture read as a paragraph JOIN: in suggesting mode that proposed
    // a "deleted paragraph break" while the selected picture stayed untouched. Handled
    // here, in the same capture listener that owns the intent, because it must consume the
    // key BEFORE the text keymap on this element sees it. The host overlay's own handler
    // (when the overlay is focused) never reaches this listener at all.
    const deleteKey =
      (event instanceof KeyboardEvent &&
        (event.key === 'Delete' || event.key === 'Backspace') &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey) ||
      (event instanceof InputEvent &&
        (event.inputType === 'deleteContentBackward' ||
          event.inputType === 'deleteContentForward'));
    if (deleteKey && drawingIntent.kind === 'pointer') {
      const target = resolveSelectedDrawingRecord(surface);
      if (target !== null) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setDrawingIntent({ kind: 'none' }, true);
        surface.deleteImage(target.drawingNodeId);
        return;
      }
    }
    setDrawingIntent({ kind: 'none' }, true);
  };
  pagesLayer.addEventListener('pointerdown', onDrawingPointerGesture, { capture: true });
  pagesLayer.addEventListener('keydown', onDrawingKeyGesture, { capture: true });
  pagesLayer.addEventListener('beforeinput', onDrawingKeyGesture, { capture: true });
  pagesLayer.addEventListener('keydown', onKeyDown);
  pagesLayer.addEventListener('beforeinput', onBeforeInput as EventListener);
  pagesLayer.addEventListener('copy', onCopy as EventListener);
  pagesLayer.addEventListener('cut', onCut as EventListener);
  pagesLayer.addEventListener('paste', onPaste as EventListener);
  pagesLayer.addEventListener('compositionstart', onCompositionStart);
  pagesLayer.addEventListener('compositionend', onCompositionEnd);

  // Attached at mount, when the host's chrome — including the scroll container — already
  // exists. Coalesced to a frame: a wheel fires far more scroll events than there are
  // frames, and each repaint costs the same whether one event asked for it or twenty.
  // BOUND TO THE DOCUMENT, RESOLVED PER EVENT. `scroll` does not bubble, but it does fire
  // in the CAPTURE phase on every ancestor, and that is the only binding that survives the
  // mount order: a host attaches the surface and only then wraps it in its viewport, so a
  // scroller captured with `closest` at mount time is routinely null — and a null one meant
  // no listener at all, so scrolling never built the pages it revealed. Every page past the
  // first screenful stayed blank until some unrelated commit forced a repaint.
  // Also covers StrictMode / provider-first attach before the Content node sits under the
  // scroll container (footnotes and later sheets must rematerialize).
  let rematerializeScheduled = false;
  /** Coalesce to a frame: twenty events and one event cost the same repaint. */
  function scheduleRematerialize(): void {
    if (rematerializeScheduled) return;
    rematerializeScheduled = true;
    const raf = container.ownerDocument.defaultView?.requestAnimationFrame;
    const run = (): void => {
      rematerializeScheduled = false;
      rematerialize();
    };
    if (raf) raf(run);
    else queueMicrotask(run);
  }

  const onScroll = (event: Event): void => {
    const scroller = surfaceScroller(container);
    if (!scroller || event.target !== scroller) return;
    scheduleRematerialize();
  };
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });

  // WHICH PAGES ARE VISIBLE DEPENDS ON THE VIEWPORT'S SIZE, NOT ONLY ON ITS SCROLL OFFSET.
  //
  // `visiblePageSet` reads `clientHeight`, so a viewport that grows reveals pages the last
  // paint had no reason to build — and a resize fires no `scroll`. Nothing asked for a
  // repaint, so the newly uncovered sheets stayed blank until the user scrolled or typed:
  // maximizing the window, closing a side panel, rotating a tablet, or the browser chrome
  // collapsing on scroll-up all land there.
  const onViewportResize = (): void => {
    scheduleRematerialize();
  };
  const view = container.ownerDocument.defaultView;
  view?.addEventListener('resize', onViewportResize, { passive: true });
  // The window event covers a resized window; an observer covers everything that changes
  // the scroller WITHOUT one — a collapsing panel, a wrapping toolbar, a CSS change. The
  // scroller is resolved lazily for the same reason the scroll listener binds to the
  // document: at mount the host has routinely not wrapped the surface in its viewport yet.
  viewportObserver =
    typeof view?.ResizeObserver === 'function' ? new view.ResizeObserver(onViewportResize) : null;
  function watchScrollerSize(): void {
    if (!viewportObserver) return;
    const scroller = surfaceScroller(container);
    if (scroller === observedScroller) return;
    viewportObserver.disconnect();
    observedScroller = scroller;
    if (scroller) viewportObserver.observe(scroller);
  }
  watchScrollerSize();

  pointer = createPointerController(
    {
      onTextFormDoubleClick: (event) => textFormInteraction?.doubleClick(event) ?? false,
      pagesLayer,
      container,
      scale: () => scale,
      // Pages of differing width are centred individually, so a landscape page among
      // portrait ones is painted at an x its record does not carry. Without this the
      // transform reads every point on such a page shifted by that offset.
      pageOffsetX: (pageIndex) => materializedExtent?.pageOffsetX.get(pageIndex) ?? 0,
      // Flushed: the pointer maps a client point to a MODEL offset, and a pass a commit
      // deferred under input pressure would hand it the pre-edit offsets — a click during
      // a burst then wrote a caret shifted by the inserted length. Only ever a real pass
      // right after a deferring commit; every other call is a cheap no-op check. This is
      // an event-handler-only dep — no render path reads it — so it cannot re-enter paint.
      layout: () => {
        flushLayout();
        return currentLayout;
      },
      measurer: () => measurer,
      selection: () => selection,
      setSelection: (next) => setSelection(next),
      cellSelection: () => cellSelection,
      setCellSelection: (next) => setCellSelection(next),
      // `preventScroll`: the pages layer is the WHOLE document tall, and focusing it scrolls
      // it into view — to its top. The first click anywhere in a long document therefore
      // threw the reader back to page 1 before the caret it had just placed could be seen.
      // The caret is positioned from layout regardless, so nothing needs the browser's scroll.
      focus: () => pagesLayer.focus({ preventScroll: true }),
      // An armed format painter paints the selection the gesture just produced. Word's
      // gesture exactly: arm, then drag over the text that should take the formatting.
      onSelectionSettled: () => formatPainter.applyIfArmed(),
      activeHeaderFooter: () => pointerHeaderFooterState(hfScope?.getActive() ?? null),
      activeNote: () => {
        const scope = noteOps?.activeNoteScope();
        return scope
          ? { scopeId: scope.id, pageIndex: noteOps?.activeNotePageIndex() ?? null }
          : null;
      },
      enterHeaderFooter: (info) => {
        // Viewing refuses this — in `createHeaderFooterScopeController`, which every entry
        // lane goes through, not here where only the pointer would be covered.
        // The pointer lane flips story scope too: land buffered typing first
        // (see setActiveScope).
        flushPendingInputAndLayout();
        hfScope?.enterHeaderFooter({
          rId: info.rId,
          pageIndex: info.pageIndex,
          // The section this PAGE is in. Omitted, the scope bound section 0, and every read
          // that resolves geometry from the open story answered for the wrong page.
          sectionIndex: sectionAtPage(info.pageIndex).sectionIndex,
          kind: info.kind,
          ...(info.position ? { position: info.position } : {}),
        });
      },
      enterNote: (scopeId, position, pageIndex) => {
        flushPendingInputAndLayout();
        noteOps?.enterNote(scopeId, position, pageIndex);
      },
      exitNote: (restoreBody) => {
        flushPendingInputAndLayout();
        noteOps?.exitNote(restoreBody);
      },
      exitHeaderFooter: () => {
        flushPendingInputAndLayout();
        return hfScope?.exitHeaderFooter();
      },
      enterEmptyHeaderFooter: (kind, pageIndex) => {
        // Creating the part is a WRITE — viewing mode refuses it like every other lane.
        if (editingMode === 'view') return;
        flushPendingInputAndLayout();
        // Which section owns the page, from the multi-section spans; a single-section
        // document has no spans and every page belongs to section 0.
        const { sectionIndex, sectionStart } = sectionAtPage(pageIndex);
        const bySection = session.headerFooterResolutionBySection();
        const section = bySection[Math.min(sectionIndex, Math.max(0, bySection.length - 1))];
        // The variant this page would DISPLAY, which is the one Word creates on a blank
        // double-click: `even` on an even page only when the document separates them,
        // `first` on a section's first page only when it declares a title page.
        const pageNumber =
          currentLayout.pages[pageIndex]?.pageFieldSource?.pageNumber ?? pageIndex + 1;
        const variant: 'default' | 'first' | 'even' =
          section?.evenAndOddHeaders && pageNumber % 2 === 0
            ? 'even'
            : section?.titlePage && pageIndex === sectionStart
              ? 'first'
              : 'default';
        const slotsOf = (resolution: typeof bySection) => {
          const target = resolution[Math.min(sectionIndex, Math.max(0, resolution.length - 1))];
          return kind === 'header' ? target?.headers : target?.footers;
        };
        let rId = slotsOf(bySection)?.get(variant)?.rId;
        if (!rId) {
          const created = surface.applyHeaderFooterLifecycle?.({
            op: 'createHeaderFooter',
            sectionIndex,
            kind,
            variant,
            ...(variant === 'first' ? { titlePage: true } : {}),
            ...(variant === 'even' ? { evenAndOddHeaders: true } : {}),
          });
          if (!created?.ok) return;
          rId = slotsOf(session.headerFooterResolutionBySection())?.get(variant)?.rId;
          // The band only exists in the post-create layout, and the create's commit may
          // have deferred its pass — the same reason `revealNote` flushes.
          flushLayout();
        }
        if (!rId) return;
        hfScope?.enterHeaderFooter({ rId, pageIndex, sectionIndex, kind, variant });
      },
      onContentControlWidget: (controlId, kind) => openContentControlWidget(controlId, kind),
      isReadOnlyParagraph: (paragraphId) => tocIdAtParagraph(paragraphId) !== null,
    },
    options.pointer ? { mode: options.pointer } : {}
  );

  const tableInteraction = createSurfaceTableInteraction({
    pagesLayer,
    furnitureLayer: tableFurnitureLayer,
    scale: () => scale,
    pageOffsetX: (pageIndex) => materializedExtent?.pageOffsetX.get(pageIndex) ?? 0,
    read: () => ({
      layout: currentLayout,
      storeRevision: session.packageRevision(),
      selection,
      cellSelection,
      editingMode,
      themeColors: session.documentThemeColors(),
    }),
    session: () => session,
    applyTableCommandPlan: (plan) => surface.applyTableCommandPlan(plan),
    label: (key) => tableLabelState.resolve(key),
  });

  render();
  remoteSelectionRenderingReady = true;
  renderRemoteSelections();
  // The surface is fully constructed, so shared state can now be published through it.
  if (collaborationSession) {
    unsubscribeCollaborationStatus = collaborationSession.subscribeStatus(() => {
      options.onChange?.(currentState());
    });
  }
  if (collaborationSession && collaborationPort) {
    // `attach` runs inside the host's mount, so a session that throws here takes the whole editor
    // with it and the reader gets a blank page instead of a document. Destroying the session moves
    // it to `destroyed`, which hosts already render as out of sync — an honest "reload to rejoin"
    // beats both a blank page and a room that says it is connecting forever.
    try {
      detachCollaboration = collaborationSession.attach(collaborationPort);
    } catch {
      try {
        collaborationSession.destroy();
      } catch {
        // Already unusable; the surface still opens without a replica.
      }
    }
  }
  publishLocalCollaborationSelection();
  // The pages layer is created `contenteditable` unconditionally, so a surface OPENED in
  // viewing came up writable — a caret, an IME and a screen reader told the document takes
  // input. `setEditingMode` was the only path that re-derived it; opening is the other one.
  applyEditableChrome();
  // `setEditingMode` used to be wrapped here to append `tableInteraction.update()`, because
  // the setter did not repaint. It does now, and `render` updates the table furniture — so
  // the wrapper only hid the coupling from the setter that owns it.
  surface.setTableInteractionLabel = (resolver) => {
    tableLabelState.resolve = resolver;
    tableInteraction.refreshLabels();
  };
  surface.refreshTableInteractionLabels = () => {
    tableInteraction.refreshLabels();
  };
  return { ok: true, surface };
}
