// Semantic paragraph layout over the canonical tree (tasks 7.1, 7.3).
//
// Produces the revision-tagged records in `semantic-records.ts`: pages, paragraph fragments,
// lines and style spans, each carrying a stable source range. It reads the CANONICAL TREE
// and a measurement port, never the DOM and never ProseMirror.
//
// A paragraph that does not fit the remaining page height is FRAGMENTED rather than moved
// wholesale: the lines that fit stay, the rest continue on the next page under the same
// paragraph id. That is what makes a cross-page paragraph one paragraph for selection and
// two boxes for pagination.

import type {
  DocumentProperties,
  OoxmlElement,
  OoxmlNode,
  OoxmlPart,
  OoxmlProperty,
} from '@docx-editor.dev/core/store';
import { WML_MAIN_DOCUMENT_PART } from '../store/package/opc-names.ts';
import {
  finalizePageFieldProjection,
  summarizeFlushedPage,
  withPageFieldSources,
  type FieldLinkProjector,
  type HyperlinkProjector,
} from './field-projection.ts';
import {
  aggregateParagraphTokensForTableBlock,
  framedTokenJoin,
  listTokenForTableBlock,
  paragraphLayoutKey,
  registerTableCellBreakKeys,
  retainLiveBreakKeys,
  withDrawingContext,
  type ParagraphLayoutCache,
} from './layout-cache.ts';
import {
  alignSpans,
  alignDrawings,
  breakParagraph,
  pendingLineFlowExtentAtPlacement,
  type Alignment,
  type PendingLine,
} from './paragraph-flow.ts';
import {
  DEFAULT_REVISION_DISPLAY_MODE,
  markRevisionFields,
  visibleParagraphMarkRevisionsOf,
  type RevisionAuthorFilter,
  type RevisionDisplayMode,
} from './revision-projection.ts';
import {
  appliedSpaceBefore,
  paragraphBorderExtentPt,
  paragraphBorderStrokeWidthPt,
  collapsedSpaceBefore,
  paragraphBreaksBefore,
  type ParagraphBorders,
  type ParagraphLineSpacing,
  type ParagraphSpacing,
} from './paragraph-style.ts';
import { resolveParagraphBorders } from './paragraph-border-resolve.ts';
import {
  adjustedBreakIndex,
  composeFlowKeys,
  keepNextGroupHeight,
  paragraphKeeps,
  MAX_KEEP_NEXT_CHAIN,
  type ParagraphKeeps,
} from './pagination-keeps.ts';
import { DEFAULT_RUN_STYLE, resolveRunStyle } from './run-style.ts';
import {
  tabStopsFingerprint,
  withDefaultTabInterval,
  type ResolvedTabStops,
} from './paragraph-tabs.ts';
import {
  resolveParagraphLayoutInputs,
  cascadeRunProperties,
  type StyleCascadeTable,
} from './style-cascade.ts';
import { paragraphBorderGroupKey } from './cell-border-groups.ts';
import { paragraphShadingBox } from './ooxml-shading.ts';
import { type TableAnchorFrames } from './semantic-table.ts';
import * as tableFloat from './table-float-position.ts';
import { bodyAnchorFrameBase, paragraphPaintsNothing } from './body-flow-helpers.ts';
import {
  createTableBorderOwnershipBudget,
  createTableVMergeResolveBudget,
  paragraphDocumentOrderOf,
  type TableFlowDeps,
} from './semantic-table-layout.ts';
import { paginateTableInFlow, type TableFlowCursor } from './table-flow-pagination.ts';
import { mergeBoundariesOf, remapMergedLines } from './merged-paragraph-ranges.ts';
import { paragraphMergeGroupOf, storyBlocks } from './story-roots.ts';
import type { InlineDrawingLayoutContext } from './drawing-layout.ts';
import {
  clipInlineDrawingRecordToRegion,
  publishAnchoredDrawingsForParagraph,
  anchoredDrawingAtomsInParagraph,
  pageClipRegion,
  shiftAnchoredDrawingRecords,
  shiftInlineDrawingRecord,
  type AnchoredDrawingRecord,
} from './drawing-layout.ts';
import {
  collectExclusionZonesByPage,
  collectExclusionZonesByPageMemoized,
  DrawingExclusionConvergenceError,
  exclusionLayoutToken,
  exclusionMapsEqual,
  exclusionMapsToken,
  MAX_ANCHOR_PAGE_DEFERRALS,
  resolveOverlapDisplacement,
  shiftAnchoredDrawingY,
  sortDrawingsForPaint,
  synthesizeParagraphTopAndBottomZones,
  topAndBottomSkipBeforeLine,
  withAnchoredDrawingLayoutFallback,
  type ExclusionZone,
  MAX_DRAWING_EXCLUSION_REFLOW_PASSES,
} from './drawing-exclusion.ts';
import { drawingModelOffsetsInParagraph } from './drawing-layout.ts';
import { bodyLineId } from './body-line-id.ts';
import {
  drawingSourceOrderInPart,
  drawingTokenForTableBlockMemo,
} from './inline-drawing-source.ts';
import {
  emptyTocPlaceholderParagraphIds,
  emptyTocSuppressedResultParagraphIds,
  tocFieldChromeParagraphIds,
} from './toc-layout.ts';
import { furnitureLayoutContext, remapPage } from './hf-layout.ts';
import type { BodyPageFieldContext } from './field-page-furniture.ts';
import { createSectionPageFurniture } from './section-page-furniture.ts';
import {
  createPageContentInsets,
  registerOverflowPageShell,
  type PageFurniture,
} from './page-furniture-insets.ts';
import { convergenceTailShiftAllowed } from './page-reuse-guards.ts';
import {
  attachContentControlBoundaries,
  contentControlContextToken,
  withContentControlMetadata,
} from './content-control-boundary-layout.ts';
import {
  DEFAULT_SECTION_PROPERTIES,
  enumerateDocumentSectionsFromBlocks,
  geometryOfSection,
  paragraphSectionNode,
  type SectionColumns,
} from './section-properties.ts';
import { resolveSectionColumns } from './section-columns.ts';
import {
  inheritNotesLayoutInput,
  layoutSemanticDocumentWithNotes,
  notesReserveContextKey,
} from './note-pagination.ts';
import { passProducerOf, producerWithControlContext } from './pass-producer.ts';

let exclusionLayoutPassObserverForTest: (() => void) | null = null;

/** Observe exclusion-relay layout passes in deterministic tests. @internal */
export function observeExclusionLayoutPassesForTest(observer: () => void): () => void {
  exclusionLayoutPassObserverForTest = observer;
  return () => {
    if (exclusionLayoutPassObserverForTest === observer) exclusionLayoutPassObserverForTest = null;
  };
}
import {
  DEFAULT_PAGE_GEOMETRY,
  type BlockFragmentRecord,
  type LayoutBox,
  type LineRecord,
  type PageGeometry,
  type PageRecord,
  type ParagraphBorderStrokeRecord,
  type ParagraphBottomBorderRecord,
  type SemanticLayout,
  type TextMeasurer,
} from './semantic-records.ts';
import type { NumberingIndex } from './numbering-index.ts';
import {
  firstLineShift,
  withResolvedListItems,
  withResolvedListItemsForSession,
  type ResolvedListItem,
} from './list-resolve.ts';
import { noteRefNumberingFromNotes } from './field-noteref.ts';
import { refTokenForTableBlock, resolveStoryRefFieldsWithNoteNumbers } from './field-ref.ts';
import { publishListMarker } from './list-marker.ts';
import {
  NO_DEFERRED_DRAWINGS,
  NO_DEFER_COUNTS,
  sameAnchoredDrawings,
  sameDeferCounts,
  sameFragments,
} from './semantic-fragment-signature.ts';
import { createLayoutSession, type FlowCheckpoint, type LayoutSession } from './layout-session.ts';
import { replaceLayoutSession } from './layout-session.ts';
import { furnitureForSection, layoutMultiSectionDocument } from './multi-section-layout.ts';
import { hostedStoryFlowDeps, layoutTextboxStory } from './textbox-story-layout.ts';
import {
  layoutBlocksWithColumnBalance,
  type BlockLayoutOptions as ColumnBalanceBlockLayoutOptions,
  type BlockLayoutResult,
} from './column-balance-layout.ts';

/** Extra full-document layouts after the reflow pass budget to detect a stable 2-cycle. */
const MAX_DRAWING_EXCLUSION_STABILIZATION_PASSES = 2;
export {
  createLayoutSession,
  type LayoutSession,
  type LayoutSessionStats,
} from './layout-session.ts';
// Both types moved to `page-furniture-insets.ts` with the per-page resolution that reads them;
// they are re-exported here because this module is the import site every caller already has.
export { type HeaderFooterVariantName, type PageFurniture } from './page-furniture-insets.ts';

/**
 * Everything a layout pass needs beyond the document itself.
 *
 * `measurer` is the only required field — layout is DOM-free and measures through whatever is
 * injected here, which is what lets the same code paginate on a server and in a browser.
 */
export interface SemanticLayoutOptions {
  readonly geometry?: PageGeometry;
  readonly measurer: TextMeasurer;
  /**
   * Reuse of measured-and-broken paragraphs across revisions (task 9.2).
   *
   * Only the BREAK is cached. Placement — y, fragments, page cuts — is always redone, so
   * an edit high in the document still repaginates everything below it while paragraphs
   * nobody touched are never measured again.
   */
  readonly cache?: ParagraphLayoutCache<readonly PendingLine[]>;
  /**
   * Collector for the cache keys a pass wants retained, instead of retaining directly.
   * Supplied by the multi-section orchestrator, which retains once over the union —
   * retaining per section evicted every other section's entries. `false` skips retention
   * for this pass entirely (the orchestrator strides sweeps). See
   * {@link retainLiveBreakKeys}.
   */
  readonly retainKeys?: Set<string> | false;
  /**
   * Part-level drawing projection/resource epoch for the section prepass memo.
   *
   * Moves whenever any drawing projection or resource state in the part does, standing in
   * for the per-paragraph drawing tokens the memo would otherwise have to recompute to
   * validate. A caller that supplies `drawingTokenForParagraph` without this epoch keeps
   * the recompute path — the memo must never miss a token move it cannot see.
   */
  readonly drawingLayoutEpoch?: string;
  /** Part-level freshness signal for paragraph-local semantic projection tokens. */
  readonly projectionEpoch?: string;
  /**
   * Who produced the measurements, folded into every cache key.
   *
   * A font arriving after first paint changes every advance in the document while no
   * content changes; without this the cache would serve the pre-font layout forever.
   */
  readonly producer?: string;
  /**
   * Incremental placement across revisions (task 9.3).
   *
   * Holds the previous complete layout and a flow checkpoint per paragraph, so a pass can
   * resume just before the first affected paragraph instead of re-placing the document from
   * the top, and can stop early when the flow reconverges with the previous run.
   *
   * Multi-section documents keep per-section child sessions on {@link LayoutSession.multi}.
   */
  readonly session?: LayoutSession;
  /** Header/footer stories to attach per page; absent means no furniture. */
  readonly furniture?: PageFurniture;
  /**
   * Which tracked revisions this pass resolves away (ECMA-376 §17.13).
   *
   * `all-markup` (the default) lays out both halves of every change. `proposed` lays out what
   * the document becomes if every change is accepted; `original` what it was before any of
   * them. Both are LAYOUT INPUTS: neither applies a `TreeDocOp` nor publishes a `ModelChange`,
   * so a user who switches to the proposed result, saves, and sends the file has not silently
   * accepted every proposal in it.
   */
  readonly displayMode?: RevisionDisplayMode;
  /** Reviewers whose revisions render as their accepted projection. */
  readonly revisionAuthorFilter?: RevisionAuthorFilter;
  /**
   * Per-section furniture, index-aligned with `enumerateDocumentSections`.
   *
   * When present, multi-section layout attaches each section's own headers/footers (after
   * OOXML inheritance). `furniture` remains the single-section / last-section fallback.
   */
  readonly sectionFurniture?: readonly (PageFurniture | undefined)[];
  /** Authored column count/gap for anchored `relativeFrom="column"` frame resolution. */
  readonly sectionColumns?: SectionColumns;
  /**
   * Styles-part cascade table (docDefaults + `w:style` last-wins). Absent keeps direct
   * formatting only — the pre-cascade behaviour, used by unit tests that never open a
   * package.
   */
  readonly styleCascade?: StyleCascadeTable;
  /**
   * Projection of `/word/numbering.xml`. Absent keeps pre-list behaviour (no markers /
   * level indents). The index is immutable for a session; list counter state is derived
   * per layout pass from document order.
   */
  readonly numberingIndex?: NumberingIndex;
  /**
   * Optional precomputed list items for the body story. When absent and
   * {@link numberingIndex} is set, layout walks the full body (including table cells)
   * once so counters continue across section boundaries and table document order.
   */
  readonly listItems?: ReadonlyMap<string, ResolvedListItem>;
  /**
   * `w:settings/w:defaultTabStop` in points (ECMA-376 §17.15.1.25); absent keeps the 0.5"
   * schema default.
   *
   * It arrives as an option because the paragraph cascade cannot see `settings.xml`. A
   * metric-locale template declares 1134 twips (2cm) and every default-interval tab in the
   * document belongs on that grid. Constant for a session — the settings part is immutable
   * here — which is why the prepared-block memo does not key on it.
   */
  readonly defaultTabStopPt?: number;
  /** Explicit Word compatibility mode; absent retains existing geometry. */
  readonly compatibilityMode?: number;
  /**
   * Turns a typed `w:hyperlink` into the SANITIZED record its spans carry.
   *
   * An option because resolving `r:id` needs the package's relationships, which layout — a
   * per-part walk — cannot see. Absent means link runs still measure, break and paint;
   * they simply carry no link, so nothing is clickable and no text is lost. That is the
   * degradation a headless test or a furniture-only pass gets, and it is the safe one.
   */
  readonly projectLink?: HyperlinkProjector;
  /**
   * Turns a parsed HYPERLINK field instruction into the SANITIZED record its result carries.
   *
   * An option for the same reason as {@link projectLink}: the raw target must cross the
   * surface's href trust boundary, which layout cannot see. Absent means the field's cached
   * result still measures, breaks and paints — it simply is not clickable.
   */
  readonly projectFieldLink?: FieldLinkProjector;
  /**
   * The document's parsed metadata, for document-property fields (TITLE, AUTHOR, …). Read once
   * by the surface and shared across body, table, note and header/footer flows.
   */
  readonly documentProperties?: DocumentProperties;
  /**
   * Footnote/endnote layout input. When present, body layout projects note marks and a
   * post-pass attaches note areas (with bounded reflow for pageBottom reservation).
   */
  readonly notes?: import('./note-pagination.ts').NotesLayoutInput;
  /**
   * Per-page bottom reserves (points) subtracted from content height before line placement,
   * keyed by DOCUMENT page index. A section's pass reads its own slice through
   * `pageIndexStart`. Produced by the note reflow loop; absent means full content column.
   */
  readonly pageBottomReserves?: ReadonlyMap<number, number>;
  /** Derived note marks for body/note projection (provisional or final). */
  readonly noteMarks?: import('./note-projection.ts').NoteMarkContext;
  /** Inline drawing projection for typed `w:drawing` / `wp:inline` nodes. */
  readonly inlineDrawingLayout?: InlineDrawingLayoutContext;
  /** Per-paragraph drawing projection/resource token for break cache keys. */
  readonly drawingTokenForParagraph?: (paragraph: OoxmlNode) => string;
  /** Per-paragraph identity for projected links and live document-property text. */
  readonly projectionTokenForParagraph?: (paragraph: OoxmlNode) => string;
  /** Memoized aggregate projection identity for an immutable table subtree. */
  readonly projectionTokenForTable?: (table: OoxmlNode) => string;
  /** @deprecated Prefer {@link drawingTokenForParagraph}. */
  readonly drawingLayoutToken?: string;
  /** Internal: reflow pass index while wrap exclusions converge. */
  readonly drawingExclusionPass?: number;
  /** Internal: converged exclusion zones — skips the reflow loop when set with zones. */
  readonly drawingExclusionConverged?: boolean;
  /** Internal: exclusion zones from the prior reflow pass, keyed by page index. */
  readonly drawingExclusionZonesByPage?: ReadonlyMap<number, readonly ExclusionZone[]>;
  /** Canonical drawing traversal order within the owner story part. */
  readonly drawingSourceOrder?: ReadonlyMap<string, number>;
  /**
   * Cross-paragraph TOC field begin/end paragraph ids. Empty chrome on these ids suppresses
   * the caret placeholder line in layout while the tree nodes stay intact for refresh/save.
   */
  readonly tocFieldChromeParagraphIds?: ReadonlySet<string>;
  /**
   * Begin-paragraph ids of empty TOCs. These keep one layout line so paint can host an
   * identifiable empty-TOC furniture placeholder (overrides chrome suppression).
   */
  readonly emptyTocPlaceholderParagraphIds?: ReadonlySet<string>;
  /**
   * Empty result-paragraph ids inside empty TOCs. Suppressed like field chrome so blank
   * cached rows do not stack under the empty placeholder.
   */
  readonly emptyTocSuppressedResultParagraphIds?: ReadonlySet<string>;
}

type BlockLayoutOptions = ColumnBalanceBlockLayoutOptions<SemanticLayoutOptions>;

/** Prepass results by block node, valid while the width and producer both hold. */
type PreparedBlock =
  | {
      readonly kind: 'paragraph';
      readonly paragraph: OoxmlElement;
      readonly props: OoxmlProperty[];
      readonly indent: { left: number; right: number; hanging: number; firstLine: number };
      readonly available: number;
      readonly alignment: Alignment;
      readonly spacing: ParagraphSpacing;
      readonly lineSpacing: ParagraphLineSpacing;
      readonly contextualSpacing: boolean;
      readonly styleId: string | null;
      readonly outlineLevel: number | null;
      readonly borders: ParagraphBorders;
      /**
       * Border identity + indent, for the `w:between` group rule.
       *
       * Indent participates because a group whose members sit at different indents would need
       * a stepped outline; splitting the group there gives each member its own closed box,
       * which is the near miss rather than a rule drawn through the text.
       */
      readonly borderGroupKey: string;
      readonly shading: string | undefined;
      readonly inheritedRunProperties: readonly OoxmlProperty[];
      readonly markRunProperties: readonly OoxmlProperty[];
      readonly tabStops: ResolvedTabStops;
      /** `w:widowControl` / `w:keepNext` / `w:keepLines`, after the style cascade. */
      readonly keeps: ParagraphKeeps;
      readonly listItem?: ResolvedListItem;
      readonly key: string;
    }
  | { readonly kind: 'table'; readonly table: OoxmlElement; readonly key: string };

interface PreparedBlockMemo {
  readonly contentWidth: number;
  readonly producer: string;
  readonly drawingToken: string;
  readonly projectionToken: string;
  /**
   * The resolved list item this entry was prepared under, by its own cache token.
   *
   * The entry embeds the item's indent, its available width and its break-cache key, and none
   * of the other three validators can see a numbering change. The producer used to carry the
   * item COUNT, which hid this by going cold on any list edit — and by re-laying out every
   * paragraph in the document for one Enter in a list. With the count gone, this is the guard
   * that has to be right.
   */
  readonly listToken: string;
  /**
   * The resolved REF values this block paints, for the same reason {@link listToken} is
   * here: a renumbering or bookmark edit moves a REF's painted text while the block's node,
   * width and producer all stay identical. `''` for the common REF-free block.
   */
  readonly refToken: string;
  /**
   * Whether the inline-drawing context was present. Pass-constant, but the memo lives
   * across passes, so it must be compared here for {@link PreparedBlock.key} (which folds
   * it via `withDrawingContext`) to stay current when a caller toggles the context.
   */
  readonly drawingContext: boolean;
  readonly entry: PreparedBlock;
}

const preparedBlocks = new WeakMap<OoxmlNode, PreparedBlockMemo>();

/** The three TOC id sets {@link tocFieldFlowKeys} folds, as one argument. */
interface TocIdSets {
  readonly chrome: ReadonlySet<string> | undefined;
  readonly placeholder: ReadonlySet<string> | undefined;
  readonly suppressed: ReadonlySet<string> | undefined;
}

/**
 * A CONTENT token for one TOC id set, memoized per set object.
 *
 * The prepass memo needs to know when the sets moved, and identity cannot answer that: the
 * sets are derived per `OoxmlPart` and every edit publishes a new part, so a set is a new
 * object after every keystroke while holding exactly the same ids. Comparing by identity
 * would rebuild the prepass of every section that holds a TOC paragraph on every keystroke.
 *
 * Content is what the verdicts actually read, and it is cheap: a set holds a TOC's begin, end
 * and result paragraph ids — dozens, not thousands — and the token is computed once per set
 * object, so a whole pass over a many-section document pays for it once. Iteration order is
 * document order out of `detectBodyTocs`, and node ids survive an edit, so the token is
 * stable exactly while the TOCs are.
 *
 * `''` for an absent or empty set, which is every set of every document with no TOC.
 */
const tocIdSetTokens = new WeakMap<ReadonlySet<string>, string>();
function tocIdSetToken(ids: ReadonlySet<string> | undefined): string {
  if (ids === undefined || ids.size === 0) return '';
  const cached = tocIdSetTokens.get(ids);
  if (cached !== undefined) return cached;
  const token = [...ids].join(',');
  tocIdSetTokens.set(ids, token);
  return token;
}

/**
 * One token for all three sets, or `''` when the part holds no TOC at all.
 *
 * Compared WHOLE by the prepass memo rather than per section, which is what makes the
 * straddling case work in BOTH directions. A TOC field can span a section break, so a
 * section's own blocks can sit still while a paragraph in it gains or loses a verdict
 * decided in another section — and a section that reads the sets today may have read
 * nothing yesterday. Keying the check on whether THIS section currently reads them closes
 * only the first of those; keying it on the part's whole TOC shape closes both.
 *
 * The conservative half of that trade is that a real TOC change invalidates every section's
 * prepass. Ordinary typing does not move the token — the ids are the same paragraphs — so
 * what pays is a refresh or an insert, which rewrites the body anyway.
 */
function tocIdsToken(ids: TocIdSets): string {
  const chrome = tocIdSetToken(ids.chrome);
  const placeholder = tocIdSetToken(ids.placeholder);
  const suppressed = tocIdSetToken(ids.suppressed);
  if (chrome === '' && placeholder === '' && suppressed === '') return '';
  return `${chrome}|${placeholder}|${suppressed}`;
}

/**
 * One section's whole prepass — prepared entries, cache keys, flow keys and document
 * order — kept on the section's {@link LayoutSession} and reused verbatim while every
 * input it derives from is unchanged. Stored through the session's opaque `prepass` slot.
 */
export interface SectionPrepass {
  readonly bodies: readonly OoxmlElement[];
  readonly producer: string;
  readonly contentWidth: number;
  readonly styleCascade: StyleCascadeTable | undefined;
  readonly listItems: ReadonlyMap<string, ResolvedListItem> | undefined;
  /**
   * The numbering index `hostedTextboxListToken` reads. Compared by IDENTITY: a story with
   * no numbered paragraphs of its own can host a text box whose list a numbering edit
   * renumbers, and then `listItems` is the same (empty) map while every hosted token in
   * `entry.key` is stale.
   */
  readonly numberingIndex: NumberingIndex | undefined;
  readonly drawingEpoch: string;
  readonly projectionEpoch: string;
  readonly prepared: PreparedBlock[];
  readonly keys: string[];
  readonly paragraphDocumentOrder: ReadonlyMap<string, number>;
  readonly keepsNext: boolean[];
  readonly markerTexts: (string | undefined)[];
  readonly tocToken: string;
  /**
   * The story-wide REF values token. Compared WHOLE, like {@link tocToken} and for the same
   * shape of reason: a renumbering edit in one section moves a REF value painted in another
   * whose blocks and list map are identity-unchanged, so no per-section input sees it.
   */
  readonly refToken: string;
  readonly flowKeys: string[];
}

/**
 * One paragraph's three raw TOC id-set memberships, as {@link tocFieldFlowKeys} folds them.
 *
 * Raw membership rather than the two booleans `breakBlock` derives from them, so the fold
 * stays correct if the derivation changes. `''` means no TOC touches this paragraph.
 */
function tocVerdictFor(paragraphId: string, ids: TocIdSets): string {
  const chrome = ids.chrome?.has(paragraphId) ?? false;
  const placeholder = ids.placeholder?.has(paragraphId) ?? false;
  const suppressed = ids.suppressed?.has(paragraphId) ?? false;
  if (!chrome && !placeholder && !suppressed) return '';
  return `${chrome ? 1 : 0}${placeholder ? 1 : 0}${suppressed ? 1 : 0}`;
}
/**
 * Lay one story part out into pages.
 *
 * The engine's layout entry point. Walks body, header, footer and note roots, flattens block
 * SDTs, paginates tables with header-row repeats and vertical merges, and resolves every
 * paragraph through the style cascade.
 *
 * Incremental when given a {@link LayoutSession}: per-block cache keys plus flow checkpoints mean
 * a pass that changes nothing returns the previous pages by identity.
 */
export function layoutSemanticDocument(
  part: OoxmlPart,
  revision: number,
  options: SemanticLayoutOptions
): SemanticLayout {
  // ONE revision projection for both. Section block ranges index this exact list; using a
  // different display mode or author predicate maps filtered blocks to the wrong geometry.
  const displayMode = options.displayMode ?? DEFAULT_REVISION_DISPLAY_MODE;
  const authorFilter = options.revisionAuthorFilter;
  const blocks = storyBlocks(part, displayMode, authorFilter);
  const sections = enumerateDocumentSectionsFromBlocks(part, blocks).sections;
  // Wrapper-only metadata (alias/tag/lock/…) lives outside flattened paragraph nodes. Fold a
  // fingerprint into the producer so incremental identity reuse cannot keep stale boundaries.
  const controlToken = contentControlContextToken(part);
  const optionsWithControlContext: SemanticLayoutOptions = {
    ...options,
    displayMode,
    producer: producerWithControlContext(options.producer, controlToken),
    tocFieldChromeParagraphIds:
      options.tocFieldChromeParagraphIds ?? tocFieldChromeParagraphIds(part),
    emptyTocPlaceholderParagraphIds:
      options.emptyTocPlaceholderParagraphIds ?? emptyTocPlaceholderParagraphIds(part),
    emptyTocSuppressedResultParagraphIds:
      options.emptyTocSuppressedResultParagraphIds ?? emptyTocSuppressedResultParagraphIds(part),
  };
  // Full-body list resolve so counters continue across sections and table cells.
  let drawingSourceOrder = options.drawingSourceOrder;
  if (!drawingSourceOrder && options.inlineDrawingLayout) {
    drawingSourceOrder = drawingSourceOrderInPart(part, options.inlineDrawingLayout);
  }
  const optionsWithLists = options.session
    ? withResolvedListItemsForSession(
        drawingSourceOrder
          ? {
              ...optionsWithControlContext,
              drawingSourceOrder,
            }
          : optionsWithControlContext,
        blocks,
        options.session
      )
    : withResolvedListItems(
        drawingSourceOrder
          ? {
              ...optionsWithControlContext,
              drawingSourceOrder,
            }
          : optionsWithControlContext,
        blocks
      );

  // REF cross-references resolve against the document's bookmarks and resolved numbering,
  // so the context is built here — the one place that sees both — and rides the options
  // spreads into every section pass. Note stories join the context (their REF fields cite
  // body targets), so paint agrees across stories. Null for the common REF-free document.
  // NOTEREF fields number against THIS walk's section bounds paired with the notes input's
  // per-section properties — the pairing `attachNotesToLayout` numbers the note areas with,
  // so field and area agree by construction.
  const refFields = resolveStoryRefFieldsWithNoteNumbers(
    blocks,
    optionsWithLists.listItems,
    options.notes
      ? { footnotesPart: options.notes.footnotesPart, endnotesPart: options.notes.endnotesPart }
      : undefined,
    options.notes ? noteRefNumberingFromNotes(options.notes, sections) : undefined,
    displayMode,
    authorFilter
  );
  const optionsForBody = refFields === null ? optionsWithLists : { ...optionsWithLists, refFields };

  const runBody = (opts: SemanticLayoutOptions): SemanticLayout => {
    if (sections.length > 1) {
      return layoutMultiSectionDocument(blocks, sections, revision, opts, layoutBlocksWithGeometry);
    }

    const section = sections[0];
    const geometry =
      opts.geometry ?? (section ? geometryOfSection(section.properties) : DEFAULT_PAGE_GEOMETRY);
    const furniture = furnitureForSection(opts, 0, sections.length) ?? opts.furniture;
    const sectionNumbering = section?.properties.pageNumbering;
    const laid = layoutBlocksWithGeometry(blocks, revision, {
      ...opts,
      geometry,
      furniture,
      sectionColumns: section?.properties.columns ?? DEFAULT_SECTION_PROPERTIES.columns,
      ...(sectionNumbering?.fmt ? { bodyPageNumberFormat: sectionNumbering.fmt } : {}),
    });
    const numbering = sectionNumbering;
    // Carry boundary metadata through field annotation so a no-change resume still early-exits
    // in `attachContentControlBoundaries` instead of allocating a fresh `pages` array.
    const annotated: SemanticLayout = withContentControlMetadata(
      {
        revision: laid.layout.revision,
        pages: withPageFieldSources(
          laid.pages,
          numbering?.start ?? 1,
          laid.pages.length,
          numbering?.fmt
        ),
      },
      laid.layout
    );
    const finalized = finalizePageFieldProjection(annotated);
    // The notes pass mints overflow sheets from this layout; publish what index they land at.
    registerOverflowPageShell(finalized, (_sectionAnchorIndex, documentPageIndex, box) =>
      laid.overflowShellAt(documentPageIndex, box)
    );
    if (opts.session) {
      opts.session.multi = null;
      opts.session.previous = finalized;
    }
    return finalized;
  };
  const finish = (layout: SemanticLayout): SemanticLayout => {
    let projected = layout;
    if (layout.displayMode !== displayMode) {
      const { contentControls, controlContextToken, ...base } = layout;
      projected = {
        ...base,
        displayMode,
        ...(contentControls !== undefined ? { contentControls } : {}),
        ...(controlContextToken !== undefined ? { controlContextToken } : {}),
      };
    }
    const withBoundaries = attachContentControlBoundaries(projected, part, controlToken);
    if (options.session) {
      options.session.previous = withBoundaries;
    }
    return withBoundaries;
  };

  if (!options.notes) {
    if (options.session) {
      options.session.notes = null;
      options.session.notePageBottomReserves = null;
    }
    return finish(runBody(optionsForBody));
  }

  // Notes inherit the body's projector seams and document properties (link, field link, doc
  // props) unless the notes input pinned its own — see `inheritNotesLayoutInput`. The REF
  // context rides along the same way: the note flow folds each paragraph's resolved values
  // into its break key and the notes-pass fingerprint folds the values token, so a
  // renumbering edit repaints the notes that cite the renumbered target.
  const notesInput = inheritNotesLayoutInput(
    options.notes,
    refFields ? { ...options, refFields } : options
  );
  return finish(
    layoutSemanticDocumentWithNotes(part, sections, optionsForBody, notesInput, runBody)
  );
}

function layoutBlocksPass(
  bodies: readonly OoxmlElement[],
  revision: number,
  options: BlockLayoutOptions
): BlockLayoutResult {
  const geometry = options.geometry;
  const keyFor = options.cache?.keyFor?.bind(options.cache) ?? paragraphLayoutKey;
  const contentWidthForReflow = geometry.width - geometry.margin.left - geometry.margin.right;
  const columns = resolveSectionColumns(
    options.sectionColumns ?? DEFAULT_SECTION_PROPERTIES.columns,
    contentWidthForReflow
  );
  if (
    options.inlineDrawingLayout &&
    options.drawingExclusionPass === undefined &&
    !options.drawingExclusionConverged
  ) {
    const sourceOrderOf = (drawingNodeId: string): number | undefined => {
      const projectedId =
        options.inlineDrawingLayout?.projectionForAtom?.(drawingNodeId)?.drawingNodeId ??
        drawingNodeId;
      return options.drawingSourceOrder?.get(projectedId);
    };
    const exclusionColumnLayout = Object.freeze({
      columnCount: columns.count,
      columnGapPt: columns.gaps[0] ?? 0,
      contentWidth: contentWidthForReflow,
      columnLefts: columns.lefts,
      columnWidths: columns.widths,
    });
    let zonesByPage: ReadonlyMap<number, readonly ExclusionZone[]> = new Map();
    let result: BlockLayoutResult | null = null;
    let converged = false;
    const seenZoneTokens = new Set<string>();
    const layoutExclusionCandidate = (candidateOptions: BlockLayoutOptions): BlockLayoutResult => {
      exclusionLayoutPassObserverForTest?.();
      return layoutBlocksWithGeometry(bodies, revision, candidateOptions);
    };
    const previousPages = options.session?.previous?.pages;
    if (previousPages) {
      zonesByPage = collectExclusionZonesByPageMemoized(
        previousPages,
        options.inlineDrawingLayout,
        options.drawingLayoutEpoch,
        contentWidthForReflow,
        options.drawingSourceOrder,
        exclusionColumnLayout
      );
      result = layoutExclusionCandidate({
        ...options,
        drawingExclusionPass: 0,
        drawingExclusionZonesByPage: zonesByPage,
      });
      // A pass that hands the previous pages back BY IDENTITY was laid under `zonesByPage`
      // and re-collecting from the same page records under the same inputs reproduces the
      // same zones — the equality below is true by construction. Every no-change section of
      // a multi-section document takes this path on every keystroke.
      if (result.pages === previousPages) return result;
      const nextZones = collectExclusionZonesByPageMemoized(
        result.pages,
        options.inlineDrawingLayout,
        options.drawingLayoutEpoch,
        contentWidthForReflow,
        options.drawingSourceOrder,
        exclusionColumnLayout
      );
      if (exclusionMapsEqual(zonesByPage, nextZones)) return result;
      zonesByPage = new Map(nextZones);
      seenZoneTokens.add(exclusionMapsToken(nextZones));
    }
    // The common document has an image-layout port but no exclusion-producing anchors. Build
    // pass zero with a disposable session so that, when its collected zone map is empty, that
    // very pass is publishable and can seed the caller's incremental state. Previously the
    // engine retained this complete probe while constructing an identical final layout.
    const publishCandidate = (
      candidate: BlockLayoutResult,
      candidateSession: LayoutSession | undefined
    ): BlockLayoutResult => {
      if (options.session && candidateSession)
        replaceLayoutSession(options.session, candidateSession);
      return candidate;
    };
    const publishConverged = (
      zones: ReadonlyMap<number, readonly ExclusionZone[]>
    ): BlockLayoutResult => {
      // The caller's session still owns pre-relay pages; resuming it could replay the seeded
      // geometry. Build the converged result cold, then replace the session atomically.
      const candidateSession = options.session ? createLayoutSession() : undefined;
      return publishCandidate(
        layoutExclusionCandidate({
          ...options,
          session: candidateSession,
          drawingExclusionConverged: true,
          drawingExclusionZonesByPage: zones,
        }),
        candidateSession
      );
    };
    for (let pass = 0; pass < MAX_DRAWING_EXCLUSION_REFLOW_PASSES; pass += 1) {
      const candidateSession = options.session ? createLayoutSession() : undefined;
      result = layoutExclusionCandidate({
        ...options,
        session: candidateSession,
        drawingExclusionPass: pass,
        drawingExclusionZonesByPage: zonesByPage,
      });
      const nextZones = collectExclusionZonesByPage(
        result.pages,
        options.inlineDrawingLayout,
        contentWidthForReflow,
        sourceOrderOf,
        exclusionColumnLayout
      );
      if (nextZones.size === 0) {
        // A candidate laid under seeded zones cannot publish merely because it collected none.
        if (pass === 0 && zonesByPage.size === 0) {
          return publishCandidate(result, candidateSession);
        }
        return publishConverged(nextZones);
      }
      if (exclusionMapsEqual(zonesByPage, nextZones)) {
        // This candidate was already laid under the exact stable zone map. Check before
        // cycle detection: a stable token is necessarily in `seenZoneTokens`, but stability
        // can publish this very pass while treating it as a cycle constructs one cold twin.
        return publishCandidate(result, candidateSession);
      }
      const nextToken = exclusionMapsToken(nextZones);
      if (seenZoneTokens.has(nextToken)) {
        converged = true;
        zonesByPage = nextZones;
        break;
      }
      seenZoneTokens.add(nextToken);
      zonesByPage = new Map(nextZones);
    }
    if (!converged) {
      for (
        let stab = 0;
        stab < MAX_DRAWING_EXCLUSION_STABILIZATION_PASSES && !converged;
        stab += 1
      ) {
        const candidateSession = options.session ? createLayoutSession() : undefined;
        result = layoutExclusionCandidate({
          ...options,
          session: candidateSession,
          drawingExclusionPass: MAX_DRAWING_EXCLUSION_REFLOW_PASSES + stab,
          drawingExclusionZonesByPage: zonesByPage,
        });
        const nextZones = collectExclusionZonesByPage(
          result.pages,
          options.inlineDrawingLayout,
          contentWidthForReflow,
          sourceOrderOf,
          exclusionColumnLayout
        );
        const nextToken = exclusionMapsToken(nextZones);
        if (exclusionMapsEqual(zonesByPage, nextZones)) {
          return publishCandidate(result, candidateSession);
        }
        if (seenZoneTokens.has(nextToken)) {
          converged = true;
          zonesByPage = nextZones;
          break;
        }
        seenZoneTokens.add(nextToken);
        zonesByPage = new Map(nextZones);
      }
    }
    if (!converged) {
      throw new DrawingExclusionConvergenceError(
        `wrap exclusion reflow did not converge within ${MAX_DRAWING_EXCLUSION_REFLOW_PASSES} passes`
      );
    }
    return publishConverged(zonesByPage);
  }

  const measurer = options.measurer;
  const cache = options.cache;
  // Defaults to a constant deliberately NAMED for the risk: fonts resolve asynchronously, so
  // a caller that swaps the measurer without changing this is served the pre-font layout for
  // the rest of the session. The style-cascade token is folded in so a different styles part
  // cannot reuse breaks measured under another inheritance table.
  const styleCascade = options.styleCascade;
  const listItems = options.listItems;
  const refFields = options.refFields;
  // The default-tab interval moves every default-interval tab, and the prepared-block memo
  // is keyed by producer — so it belongs here rather than only in the per-paragraph token.
  const defaultTabStopPt = options.defaultTabStopPt;
  const displayMode = options.displayMode ?? DEFAULT_REVISION_DISPLAY_MODE;
  const authorFilter = options.revisionAuthorFilter;
  const showsMarkup = displayMode === 'all-markup';
  const tocChromeParagraphIds = options.tocFieldChromeParagraphIds;
  const emptyTocPlaceholderIds = options.emptyTocPlaceholderParagraphIds;
  const emptyTocSuppressedResultIds = options.emptyTocSuppressedResultParagraphIds;
  const tocIds: TocIdSets = {
    chrome: tocChromeParagraphIds,
    placeholder: emptyTocPlaceholderIds,
    suppressed: emptyTocSuppressedResultIds,
  };
  /** `''` for a part with no TOC, which skips the per-block verdict scan entirely. */
  const tocToken = tocIdsToken(tocIds);
  // In `producer`, not beside it in the section context: a note mark is measured INTO the
  // broken lines, so the break cache holds the citation's width under a key built from
  // this. Keying only the section left a warm cache serving `1`-wide slots to roman marks.
  //
  // NOT THE NUMBER OF LIST ITEMS. `producer` is in the session context, in every paragraph's
  // break-cache key and in the prepared-block memo, so folding a COUNT in meant one Enter in
  // a list re-measured every paragraph in the document and rebuilt every page — while two
  // different numbering states with the same count still hashed the same. What a numbering
  // change actually affects is each list paragraph, and each one carries its own
  // `listItem.cacheToken` in its key and in the memo above.
  const producer = passProducerOf(
    options.producer,
    styleCascade,
    options.noteMarks,
    defaultTabStopPt,
    displayMode,
    authorFilter,
    options.bodyPageNumberFormat,
    options.compatibilityMode
  );

  // Prepass and incremental keys use the first region. Placement re-prepares a block when it
  // enters an unequal-width later column; multi-column passes conservatively skip resume.
  const contentWidth = columns.widths[0]!;

  // PAGE FURNITURE. A header taller than the top-margin remainder pushes that page's content
  // area down (Word's behaviour), and the header a page shows is the one its OWN variant
  // resolves to — see `page-furniture-insets.ts` for why the worst case over the variants is
  // not the same thing.
  const furniture = options.furniture;
  const headerDistance = geometry.headerDistance ?? 36;
  const footerDistance = geometry.footerDistance ?? 36;
  const pageBottomReserves = options.pageBottomReserves;
  const session = options.session;
  const lineCounterStart = options.lineCounterStart ?? 0;
  const furnitureContext = furnitureLayoutContext(furniture, headerDistance, footerDistance);
  const flowStartY = options.flowStartY ?? 0;
  const spaceBeforeCarry = options.spaceBeforeCarry ?? 0;
  // Where this section's first sheet lands in the DOCUMENT. Even/odd header selection
  // alternates by page number, so it is not a section-local question.
  const pageIndexStart = options.pageIndexStart ?? 0;
  const insetsFor = createPageContentInsets({
    ...(furniture ? { furniture } : {}),
    pageHeight: geometry.height,
    marginTop: geometry.margin.top,
    marginBottom: geometry.margin.bottom,
    headerDistance,
    footerDistance,
    pageIndexStart,
    ...(options.continuedPageInsets ? { continuedPageInsets: options.continuedPageInsets } : {}),
  });
  /**
   * What the body flow measures a page-field placeholder against.
   *
   * The section's `w:pgNumType/@w:fmt` rides along because the placeholder and the value that
   * replaces it have to agree about whether a `\#` picture applies — see
   * {@link numericPictureApplies}. A section is one format, so this is fixed for the pass.
   */
  const bodyPageFieldContext: BodyPageFieldContext = Object.freeze(
    options.bodyPageNumberFormat !== undefined ? { format: options.bodyPageNumberFormat } : {}
  );

  // Only the reserve entries THIS pass can read belong in its context key. The pass reads
  // reserves at `pageIndexStart` plus consecutive local page slots as it opens pages, so a
  // bound of "the page count the previous pass produced, plus one" covers every slot an
  // input-identical replay can touch — and keeps a reserve on another section's pages from
  // invalidating this one. A fresh session has no such bound and folds every entry from
  // `pageIndexStart` on (conservative, one full pass).
  const reserveKeyBound = session?.previous ? session.previous.pages.length + 1 : Infinity;
  const columnRegionBottom = options.columnRegionBottom;
  const columnsContext = `|cols:${columns.widths.join(',')};${columns.gaps.join(',')};${columns.separator ? 1 : 0}${columnRegionBottom !== undefined ? `;bal:${columnRegionBottom}` : ''}`;
  // Body line ids are paragraph-local, so a changed line count in an earlier section does
  // not invalidate this section. Geometry and flow start still do. The document page index
  // is deliberately NOT here — numbers re-project at finalize and shells renumber at remap;
  // keying on it re-laid every section below an Enter that added one page. The one real
  // dependence, page PARITY, is checked by `comparable` through the session parity fields.
  //
  // The producer is compared BESIDE the context (`session.producer`), not embedded in it:
  // it carries the control token, which runs to kilobytes on a control-heavy document, and
  // embedding it copied that token into every section's context string on every pass.
  const continuedInsets = options.continuedPageInsets;
  // The host sheet's box is an INPUT to this section's flow, so a host whose own variant moved
  // must not let this section resume a flow measured against the box it used to have.
  const continuedContext = continuedInsets
    ? `|cont:${continuedInsets.top},${continuedInsets.height}`
    : '';
  const contextFor = (notesReserveKey: string): string =>
    `${geometry.width}x${geometry.height}|${geometry.margin.top},${geometry.margin.right},${geometry.margin.bottom},${geometry.margin.left}|fs:${flowStartY},${spaceBeforeCarry}${continuedContext}${furnitureContext}${notesReserveKey}${columnsContext}`;
  const context = contextFor(
    notesReserveContextKey(pageBottomReserves, pageIndexStart, reserveKeyBound)
  );
  const startPageParity = pageIndexStart & 1;
  /** Set when this pass places an anchored drawing whose geometry reads page parity. */
  let usedPageParity = false;
  /** Cell break keys of the table currently laying out, for the retention registry. */
  let collectingCellBreakKeys: string[] | null = null;
  const markPageParityRead = (): void => {
    usedPageParity = true;
  };

  const pages: PageRecord[] = [];
  // Built HERE, above the unchanged-pass early return below, not beside the flow that uses it.
  // `overflowShellAt` is handed to the notes pass by that return, and a closure over a `const`
  // declared after it would sit in its temporal dead zone forever — the body's later statements
  // never run on that path.
  const sectionFurniture = createSectionPageFurniture({
    ...(furniture ? { furniture } : {}),
    geometry,
    headerDistance,
    footerDistance,
    pageIndexStart,
    contentWidth: contentWidthForReflow,
    insetsFor,
    pageCount: () => pages.length,
  });
  const { pageBox, furnitureFor, overflowShellAt } = sectionFurniture;

  /**
   * Available body height on the page currently being filled (`pages.length`).
   *
   * A balance-search limit binds the FIRST page only: content pushed past it lands on a
   * full-height overflow page, so a block taller than the limit still terminates, and the
   * search reads "produced a second page" as "does not fit".
   */
  const contentHeightOf = (reservedPt: number): number => {
    const base = Math.max(1, insetsFor(pages.length).height - reservedPt);
    return columnRegionBottom !== undefined && pages.length === 0
      ? Math.max(1, Math.min(base, columnRegionBottom))
      : base;
  };
  const contentHeight = (): number =>
    // Reserves are keyed by DOCUMENT page index (computeFootnoteReserves); this pass fills
    // the document page at `pageIndexStart + pages.length`. A continuous section's local
    // page 0 IS the previous section's last sheet: both passes read the same document slot,
    // so every flow sharing the sheet stops above the same note area.
    contentHeightOf(pageBottomReserves?.get(pageIndexStart + pages.length) ?? 0);
  /** The same band with the footnote reserve ignored — the table paginator's recovery. */
  const unreservedContentHeight = (): number => contentHeightOf(0);

  // Prepass: everything needed to KEY a paragraph, before any of them is placed. Resuming
  // means knowing where the first change is, and that cannot be discovered while walking.
  //
  // Memoized on NODE IDENTITY: a paragraph the commit did not touch is the same object, and
  // its properties, indents and key derive from nothing but the node, the available width
  // and the producer. Recomputing the key — a serialization of the paragraph's subtree —
  // for every paragraph on every pass made the prepass, not placement, the cost of an
  // incremental layout: a one-character edit re-keyed the entire document.
  // Constant per pass. `withDrawingContext` folds it into EVERY per-block drawing token
  // and into the prepass epoch below, so key namespacing and memo validity can never
  // disagree about which context minted a key — including a caller that supplies tokens
  // while toggling the context, which a fallback-only namespace could not separate.
  const hasInlineDrawingContext = options.inlineDrawingLayout !== undefined;
  // Body textbox stories flow without a page-field context: body PAGE projection stays
  // deferred, so a PAGE field inside a body text box contributes only its cached result,
  // consistent with direct body fields today.
  const layoutTextboxStoryForBody = (
    projection: import('../store/package/drawing-projection.ts').DrawingProjection
  ) =>
    layoutTextboxStory(projection, {
      measurer,
      producer,
      cache,
      styleCascade,
      ...(defaultTabStopPt !== undefined ? { defaultTabStopPt } : {}),
      ...(displayMode ? { displayMode } : {}),
      ...(authorFilter ? { revisionAuthorFilter: authorFilter } : {}),
      ...(options.documentProperties ? { documentProperties: options.documentProperties } : {}),
      ...(options.projectLink ? { projectLink: options.projectLink } : {}),
      ...(options.projectFieldLink ? { projectFieldLink: options.projectFieldLink } : {}),
      ...(options.numberingIndex ? { numberingIndex: options.numberingIndex } : {}),
      inlineDrawingLayout: options.inlineDrawingLayout,
      drawingTokenForParagraph: options.drawingTokenForParagraph,
      projectionTokenForParagraph: options.projectionTokenForParagraph,
      projectionTokenForTable: options.projectionTokenForTable,
    });
  // ONE capability for every hosted-story fold of this flow. The prepass block fold and
  // the cell lane below therefore cannot drift to different numbering inputs, and a future
  // lane cannot publish hosted stories without carrying the invalidation provider too.
  const hostedStory = hasInlineDrawingContext
    ? hostedStoryFlowDeps(
        layoutTextboxStoryForBody,
        options.numberingIndex,
        styleCascade,
        displayMode,
        authorFilter
      )
    : undefined;
  const prepareBlock = (block: OoxmlElement, availableWidth: number): PreparedBlock => {
    // The RAW token, compared by the memo below so a table's kilobyte aggregate keeps its
    // identity fast path; the context joins only when a key is actually built. `||`, not
    // `??`, matching the cell lane: a per-paragraph callback answering `''` falls through
    // to the document-wide token.
    const paragraphDrawingToken =
      block.kind === 'paragraph'
        ? options.drawingTokenForParagraph?.(block) || options.drawingLayoutToken || ''
        : block.kind === 'table' && options.drawingTokenForParagraph
          ? drawingTokenForTableBlockMemo(
              block,
              options.drawingLayoutEpoch,
              options.drawingTokenForParagraph
            ) ||
            options.drawingLayoutToken ||
            ''
          : options.drawingLayoutToken || '';
    const projectionToken =
      block.kind === 'paragraph'
        ? (options.projectionTokenForParagraph?.(block) ?? '')
        : block.kind === 'table' && options.projectionTokenForParagraph
          ? (options.projectionTokenForTable?.(block) ??
            aggregateParagraphTokensForTableBlock(block, options.projectionTokenForParagraph))
          : '';
    // A TABLE'S LIST STATE IS ITS CELLS'. `listItems` is keyed by PARAGRAPH, and a numbered
    // list that continues inside a table cell has its markers there — so reading the table's
    // own id gave an empty token, and a renumbering that left the table's flow key untouched
    // reused the cell markers verbatim. The drawing token aggregates the same way, for the
    // same reason.
    // The list state of any text-box story this block hosts, for the same reason the drawing
    // token aggregates hosted-story atoms: a box's markers come from `numbering.xml`, and a
    // numbering edit moves nothing else in this block's key.
    const hostedListToken = hostedStory?.hostedListTokenForParagraph?.(block) ?? '';
    // Length-framed pair: both sides embed file-influenced marker text (and the table
    // aggregate itself contains NULs), so no separator join stays injective.
    const ownListToken =
      block.kind === 'table'
        ? listTokenForTableBlock(block, listItems)
        : (listItems?.get(block.id)?.cacheToken ?? '');
    const listToken =
      ownListToken === '' && hostedListToken === ''
        ? ''
        : framedTokenJoin([ownListToken, hostedListToken]);
    // The RESOLVED VALUES this block's REF fields paint. The block's own subtree is identical
    // after a renumbering edit elsewhere, so only this token can invalidate its memo and key.
    const refToken =
      refFields === undefined
        ? ''
        : block.kind === 'table'
          ? refTokenForTableBlock(block, refFields)
          : refFields.tokenForParagraph(block.id);
    const memo = preparedBlocks.get(block);
    if (
      memo &&
      memo.contentWidth === availableWidth &&
      memo.producer === producer &&
      memo.drawingToken === paragraphDrawingToken &&
      memo.projectionToken === projectionToken &&
      memo.listToken === listToken &&
      memo.refToken === refToken &&
      memo.drawingContext === hasInlineDrawingContext
    ) {
      return memo.entry;
    }
    const keyedDrawingToken = withDrawingContext(paragraphDrawingToken, hasInlineDrawingContext);
    let entry: PreparedBlock;
    if (block.kind === 'table') {
      // `nodeToken` hashes the whole subtree, so one key covers every cell edit. The list
      // token is the CELL aggregate plus any hosted text-box stories: a renumbering that
      // only moves ordinals inside a cell leaves the subtree byte-identical, and this token
      // is the only thing that can move the key with it.
      entry = {
        kind: 'table',
        table: block,
        key: keyFor({
          paragraph: block,
          properties: [
            ...(listToken ? [{ localName: 'list', attributes: { token: listToken } }] : []),
            ...(refToken ? [{ localName: 'refFields', attributes: { token: refToken } }] : []),
          ],
          width: availableWidth,
          producer,
          drawingToken: keyedDrawingToken,
          projectionToken,
        }),
      };
    } else {
      const listItem = listItems?.get(block.id);
      const preparedParagraph = resolveParagraphLayoutInputs(
        block,
        availableWidth,
        styleCascade,
        listItem
      );
      const {
        props,
        indent,
        available,
        alignment,
        spacing,
        lineSpacing,
        contextualSpacing,
        styleId,
        outlineLevel,
        shading,
        inheritedRunProperties,
        markRunProperties,
      } = preparedParagraph;
      const borders = resolveParagraphBorders(
        block.children.find((child) => child.kind === 'paragraphProperties'),
        styleCascade
      );
      // `w:defaultTabStop` lives in settings.xml, which the paragraph cascade never reads.
      const tabStops = withDefaultTabInterval(preparedParagraph.tabStops, defaultTabStopPt);
      const tabStopsCacheToken =
        tabStops === preparedParagraph.tabStops
          ? preparedParagraph.tabStopsCacheToken
          : tabStopsFingerprint(tabStops);
      entry = {
        kind: 'paragraph',
        paragraph: block,
        props,
        indent,
        available,
        alignment,
        spacing,
        lineSpacing,
        contextualSpacing,
        styleId,
        outlineLevel,
        borders,
        // The box's own INSETS, not its resolved edges. `available` is
        // `contentWidth - indent.left - indent.right`, so keying on `indent.left + available`
        // folded the CONTENT WIDTH into the group's identity — and a multi-column section
        // prepares the prepass at column 0's width while placing each block at the width of
        // the column it lands in. With unequal columns those two never agreed, so grouping
        // collapsed outside column 0 and every paragraph there drew its own box. Which
        // column a paragraph lands in is a layout outcome; the group is an authored
        // relationship between neighbours, and only the authored insets may decide it.
        borderGroupKey: paragraphBorderGroupKey({ borders, indent }),
        shading,
        inheritedRunProperties,
        markRunProperties,
        tabStops,
        keeps: paragraphKeeps(props),
        ...(listItem ? { listItem } : {}),
        key: keyFor({
          paragraph: block,
          properties: [
            ...props,
            ...inheritedRunProperties,
            ...markRunProperties,
            { localName: 'tabStops', attributes: { token: tabStopsCacheToken } },
            ...(listItem
              ? [{ localName: 'list', attributes: { token: listItem.cacheToken } }]
              : []),
            ...(hostedListToken
              ? [{ localName: 'txbxList', attributes: { token: hostedListToken } }]
              : []),
            ...(refToken ? [{ localName: 'refFields', attributes: { token: refToken } }] : []),
          ],
          width: available,
          producer,
          drawingToken: keyedDrawingToken,
          projectionToken,
        }),
      };
    }
    preparedBlocks.set(block, {
      contentWidth: availableWidth,
      producer,
      drawingToken: paragraphDrawingToken,
      projectionToken,
      listToken,
      refToken,
      drawingContext: hasInlineDrawingContext,
      entry,
    });
    return entry;
  };
  // SECTION PREPASS MEMO. Everything derived below is a pure function of the block list
  // plus the inputs the memo compares, and on a typing pass in a many-section document
  // every section but the edited one has an IDENTICAL block list — while rebuilding these
  // arrays anyway made the prepass, not placement, the floor cost of a keystroke.
  // `drawingLayoutEpoch` stands in for the per-block drawing tokens (the epoch moves
  // whenever any drawing projection or resource in the part does); a caller that threads
  // per-paragraph drawing tokens WITHOUT an epoch keeps the recompute path (null), because
  // the memo could not see a token move. The inline-drawing context joins the epoch
  // exactly as it joins every per-block token, so a session that toggles the context
  // between passes is never served the other context's keys.
  const drawingEpoch =
    (options.drawingTokenForParagraph !== undefined || options.drawingLayoutToken !== undefined) &&
    options.drawingLayoutEpoch === undefined
      ? null
      : withDrawingContext(options.drawingLayoutEpoch ?? '', hasInlineDrawingContext);
  const projectionEpoch =
    options.projectionTokenForParagraph !== undefined && options.projectionEpoch === undefined
      ? null
      : (options.projectionEpoch ?? '');
  const prepassMemo = session?.prepass as SectionPrepass | null | undefined;
  const prepassValid =
    prepassMemo != null &&
    drawingEpoch !== null &&
    projectionEpoch !== null &&
    prepassMemo.drawingEpoch === drawingEpoch &&
    prepassMemo.projectionEpoch === projectionEpoch &&
    prepassMemo.producer === producer &&
    prepassMemo.contentWidth === contentWidth &&
    prepassMemo.styleCascade === styleCascade &&
    prepassMemo.listItems === listItems &&
    prepassMemo.numberingIndex === options.numberingIndex &&
    prepassMemo.tocToken === tocToken &&
    prepassMemo.refToken === (refFields?.valuesToken ?? '') &&
    prepassMemo.bodies.length === bodies.length &&
    prepassMemo.bodies.every((block, index) => block === bodies[index]);
  const prepass: SectionPrepass = prepassValid ? prepassMemo : buildSectionPrepass();
  function buildSectionPrepass(): SectionPrepass {
    const prepared = bodies.map((block) => prepareBlock(block, contentWidth));
    const keys = prepared.map((entry) => entry.key);
    const keepsNext = prepared.map((entry) => entry.kind === 'paragraph' && entry.keeps.keepNext);
    const markerTexts = prepared.map((entry) =>
      entry.kind === 'paragraph' ? listItems?.get(entry.paragraph.id)?.markerText : undefined
    );
    // The two inputs `w:contextualSpacing` reads from the blocks on either side. A table
    // answers null, which is what `sameStyleAs` means by "not a paragraph of this style".
    const contextualSpacings = prepared.map(
      (entry) => entry.kind === 'paragraph' && entry.contextualSpacing
    );
    const styleIds = prepared.map((entry) => (entry.kind === 'paragraph' ? entry.styleId : null));
    // A paragraph's bottom edge belongs to its border GROUP, which the block after it can
    // join or leave. A table never groups, and neither does a paragraph with no borders.
    const borderGroupKeys = prepared.map((entry) =>
      entry.kind === 'paragraph' ? entry.borderGroupKey : ''
    );
    // Which lines a TOC field's paragraphs emit at all, decided by the OTHER paragraphs of
    // the same field. A part with no TOC skips the scan outright rather than asking three
    // empty sets about every block it holds.
    const tocVerdicts =
      tocToken === ''
        ? []
        : prepared.map((entry) =>
            entry.kind === 'paragraph' ? tocVerdictFor(entry.paragraph.id, tocIds) : ''
          );

    // FLOW keys — what incremental resume compares. The composition, its fold order and
    // the argument for that order live with the folds in `pagination-keeps.ts`, where the
    // order is testable.
    const flow = composeFlowKeys(keys, {
      contextualSpacingAt: (index) => contextualSpacings[index]!,
      styleIdAt: (index) => styleIds[index] ?? null,
      borderGroupKeyAt: (index) => borderGroupKeys[index]!,
      tocVerdicts,
      markerTextAt: (index) => markerTexts[index],
      keepsNextAt: (index) => keepsNext[index]!,
    });

    return {
      bodies,
      producer,
      contentWidth,
      styleCascade,
      listItems,
      numberingIndex: options.numberingIndex,
      drawingEpoch: drawingEpoch ?? '',
      projectionEpoch: projectionEpoch ?? '',
      prepared,
      keys,
      paragraphDocumentOrder: paragraphDocumentOrderOf(
        prepared,
        contentWidth,
        styleCascade,
        displayMode,
        authorFilter
      ),
      keepsNext,
      markerTexts,
      tocToken,
      refToken: refFields?.valuesToken ?? '',
      flowKeys: flow,
    };
  }
  if (session && drawingEpoch !== null && projectionEpoch !== null && !prepassValid) {
    session.prepass = prepass;
  }
  const { prepared, keys, paragraphDocumentOrder, keepsNext, flowKeys } = prepass;
  /** Retain the whole document's live keys — block keys plus recorded table-cell keys. */
  const publishRetainedKeys = (): void => {
    // `false` is the orchestrator saying this pass skips the sweep; a standalone pass asks
    // its own cache's stride.
    if (options.retainKeys === false) return;
    if (options.retainKeys === undefined && cache && !(cache.retentionPassDue?.() ?? true)) {
      return;
    }
    retainLiveBreakKeys(
      cache,
      options.retainKeys,
      keys,
      prepared.flatMap((entry) => (entry.kind === 'table' ? [entry.table] : []))
    );
  };
  const previous = session?.previous ?? null;
  // A geometry or producer change invalidates every checkpoint, because it moves every
  // break; resuming from one would place new content against a stale flow. A parity flip
  // only matters when the previous pass actually read parity (even/odd headers or an
  // inside/outside-anchored drawing).
  const comparable =
    previous !== null &&
    session !== undefined &&
    session.context === context &&
    session.producer === producer &&
    (!session.parityDependent || session.startPageParity === startPageParity);
  const resumable = columns.count === 1 && comparable;

  /** The first paragraph whose layout inputs differ from the previous pass. */
  let firstChanged = 0;
  if (comparable) {
    const limit = Math.min(flowKeys.length, session.keys.length);
    while (firstChanged < limit && flowKeys[firstChanged] === session.keys[firstChanged]) {
      firstChanged += 1;
    }
  }

  /**
   * How many trailing paragraphs are unchanged.
   *
   * Where the flow may reconverge: everything after an edit can only be reused verbatim if
   * it is the same content AND lands in the same place, and this bounds the first half of
   * that question.
   */
  let commonSuffix = 0;
  if (resumable) {
    const maxSuffix = Math.min(flowKeys.length, session.keys.length) - firstChanged;
    while (
      commonSuffix < maxSuffix &&
      flowKeys[flowKeys.length - 1 - commonSuffix] ===
        session.keys[session.keys.length - 1 - commonSuffix]
    ) {
      commonSuffix += 1;
    }
  }

  // NOTHING CHANGED. Every key matches and the document is the same length, so the previous
  // layout still describes it exactly — re-placing it would allocate a second set of
  // identical records and destroy the identity a consumer uses to skip repainting.
  if (comparable && firstChanged === prepared.length && prepared.length === session.keys.length) {
    // Keep prior content-control boundaries: `finish` re-attaches them and must see the same
    // token/list to return `pages` by identity rather than mapping a twin array.
    const unchanged: SemanticLayout = withContentControlMetadata(
      { revision, pages: previous!.pages },
      previous!
    );
    const translatedEndLineCounter =
      lineCounterStart + (session.endLineCounter - session.startLineCounter);
    session.previous = unchanged;
    session.startLineCounter = lineCounterStart;
    session.endLineCounter = translatedEndLineCounter;
    // `comparable` already required parity equality whenever the session depends on it.
    session.startPageParity = startPageParity;
    session.stats = {
      placed: 0,
      total: prepared.length,
      reusedPages: previous!.pages.length,
      fullPasses: session.stats.fullPasses,
    };
    publishRetainedKeys();
    return {
      layout: unchanged,
      pages: unchanged.pages,
      lineCounter: translatedEndLineCounter,
      endCursorY: session.endCursorY,
      endSpaceAfter: session.endSpaceAfter,
      endsOpenPage: session.endsOpenPage,
      overflowShellAt,
    };
  }

  const positionedTables = tableFloat.positionedTableAnchors(
    prepared,
    contentWidth,
    styleCascade,
    displayMode,
    authorFilter
  );
  const positionedTableIds = new Set(positionedTables.map(({ table }) => table.id));
  const positionedFlow = tableFloat.positionedTableFlow(positionedTables, flowKeys);
  let pageFragments: BlockFragmentRecord[] = [];
  let columnIndex = 0;
  let regionFragmentStart = 0;
  const columnLeft = (): number => columns.lefts[columnIndex]!;
  const columnWidth = (): number => columns.widths[columnIndex]!;
  const anchorFrames = (): TableAnchorFrames => ({
    text: { left: columnLeft(), width: columnWidth() },
    margin: { left: 0, width: contentWidthForReflow },
    page: { left: -geometry.margin.left, width: geometry.width },
  });
  const regionHasFragments = (): boolean =>
    tableFloat.hasFlowFragments(pageFragments, regionFragmentStart);
  let pendingAnchoredDrawings: AnchoredDrawingRecord[] = [];
  let deferredAnchoredDrawings: AnchoredDrawingRecord[] = [];
  const anchorPageDeferCounts = new Map<string, number>();
  const pendingFloatIds = new Set<string>();
  const floatSignals: tableFloat.PositionedTableAnchorSignal[] = [];
  // A continuous section resumes the previous section's column rather than opening a
  // sheet, so its first block starts at that column's used height and its first paragraph
  // is NOT at a page top — page-top space-before suppression must not apply to it, and the
  // preceding paragraph's space-after still collapses against its space-before.
  let cursorY = flowStartY;
  // A continuous section can open its column region below content already on the sheet.
  let columnRegionTop = flowStartY;
  let flowColumnIndex = 0;
  let lineCounter = lineCounterStart;
  let previousSpaceAfter = spaceBeforeCarry;
  const checkpoints: FlowCheckpoint[] = [];
  /** The flow as it stands: what a later pass resumes from and converges against. The
   * deferred anchor state is copied only when there is some — this runs once per block. */
  const checkpointNow = (): FlowCheckpoint => ({
    pageCount: pages.length,
    pageFragments: [...pageFragments],
    pendingAnchoredDrawings: [...pendingAnchoredDrawings],
    deferredAnchoredDrawings:
      deferredAnchoredDrawings.length > 0 ? [...deferredAnchoredDrawings] : NO_DEFERRED_DRAWINGS,
    anchorPageDeferCounts:
      anchorPageDeferCounts.size > 0 ? new Map(anchorPageDeferCounts) : NO_DEFER_COUNTS,
    ...positionedFlow.checkpoint(pendingFloatIds, floatSignals),
    cursorY,
    lineCounter,
    previousSpaceAfter,
    flowColumnIndex,
  });
  let startIndex = 0;
  let placed = 0;
  let reusedPages = 0;
  let firstParagraphOfSection = flowStartY === 0;

  // RESUME. The checkpoint before the first changed paragraph describes a flow the new
  // document still agrees with, so the pages completed by then are carried over by
  // REFERENCE — unchanged pages keep their identity, which is what lets a consumer skip
  // repainting them (task 9.4).
  if (resumable && firstChanged > 0 && firstChanged < session.checkpoints.length) {
    const checkpoint = session.checkpoints[firstChanged]!;
    pages.push(...previous!.pages.slice(0, checkpoint.pageCount));
    pageFragments = [...checkpoint.pageFragments];
    pendingAnchoredDrawings = [...checkpoint.pendingAnchoredDrawings];
    deferredAnchoredDrawings = [...checkpoint.deferredAnchoredDrawings];
    anchorPageDeferCounts.clear();
    for (const [id, n] of checkpoint.anchorPageDeferCounts) anchorPageDeferCounts.set(id, n);
    cursorY = checkpoint.cursorY;
    flowColumnIndex = checkpoint.flowColumnIndex;
    columnIndex = checkpoint.flowColumnIndex;
    lineCounter = checkpoint.lineCounter;
    previousSpaceAfter = checkpoint.previousSpaceAfter;
    positionedFlow.restore(checkpoint, pendingFloatIds, floatSignals);
    startIndex = firstChanged;
    firstParagraphOfSection = false;
    reusedPages = pages.length;
    checkpoints.push(...session.checkpoints.slice(0, firstChanged));
  }

  const columnCount = columns.count;
  const columnOffsetX = columnLeft;

  const anchorColumnBox = (_paragraphBox: LayoutBox): LayoutBox =>
    Object.freeze({
      x: columns.lefts[flowColumnIndex] ?? 0,
      y: _paragraphBox.y,
      width: columns.widths[flowColumnIndex] ?? contentWidth,
      height: _paragraphBox.height,
    });

  const anchorFrameBase = () =>
    bodyAnchorFrameBase({
      pageNumber: pageIndexStart + pages.length + 1,
      onPageParityRead: markPageParityRead,
      geometry,
      insets: insetsFor(pages.length),
      contentWidth,
      contentHeight: contentHeight(),
      ownerPartName: options.inlineDrawingLayout?.ownerPartName ?? WML_MAIN_DOCUMENT_PART,
    });

  const pageContentClip = (): LayoutBox => pageClipRegion(anchorFrameBase());

  const sourceOrderOf = (drawingNodeId: string): number | undefined => {
    const projectedId =
      options.inlineDrawingLayout?.projectionForAtom?.(drawingNodeId)?.drawingNodeId ??
      drawingNodeId;
    return options.drawingSourceOrder?.get(projectedId);
  };

  const collectAnchoredDrawings = (drawings: readonly AnchoredDrawingRecord[]): void => {
    if (drawings.length === 0) return;
    for (const drawing of drawings) {
      if (
        pendingAnchoredDrawings.some((existing) => existing.drawingNodeId === drawing.drawingNodeId)
      ) {
        continue;
      }
      pendingAnchoredDrawings.push(
        drawing.sourceOrder === undefined && sourceOrderOf(drawing.drawingNodeId) !== undefined
          ? Object.freeze({ ...drawing, sourceOrder: sourceOrderOf(drawing.drawingNodeId) })
          : drawing
      );
    }
    if (!options.inlineDrawingLayout) return;
    const resolved = resolveOverlapDisplacement(pendingAnchoredDrawings, {
      pageBottom: contentHeight(),
    });
    pendingAnchoredDrawings.splice(0, pendingAnchoredDrawings.length, ...resolved.drawings);
    if (resolved.deferred.length > 0) {
      for (const drawing of resolved.deferred) {
        const count = (anchorPageDeferCounts.get(drawing.drawingNodeId) ?? 0) + 1;
        anchorPageDeferCounts.set(drawing.drawingNodeId, count);
        if (count >= MAX_ANCHOR_PAGE_DEFERRALS) {
          pendingAnchoredDrawings.push(
            withAnchoredDrawingLayoutFallback(drawing, 'page-defer-exhausted')
          );
        } else {
          deferredAnchoredDrawings.push(drawing);
        }
      }
    }
  };

  const carryDeferredToNextPage = (): void => {
    if (deferredAnchoredDrawings.length === 0) return;
    const carried = deferredAnchoredDrawings.map((drawing) =>
      shiftAnchoredDrawingY(drawing, cursorY - drawing.y)
    );
    deferredAnchoredDrawings = [];
    collectAnchoredDrawings(carried);
  };

  let publishPositionedTablesForPage = (): void => undefined;
  const flushPage = (): void => {
    publishPositionedTablesForPage();
    const index = pages.length;
    const box = pageBox(index);
    const header = furnitureFor('header', index, box);
    const footer = furnitureFor('footer', index, box);
    const { usedBottom, hasBodyPageFields } = summarizeFlushedPage(pageFragments, columnRegionTop);
    const insets = insetsFor(index);
    pages.push({
      id: `page-${index}`,
      index,
      box,
      contentBox: {
        x: box.x + geometry.margin.left,
        y: box.y + insets.top,
        width: contentWidthForReflow,
        height: insets.height,
      },
      fragments: pageFragments,
      hasBodyPageFields,
      ...(columns.separator
        ? {
            columnSeparators: columns.gaps.map((gap, separatorIndex) => ({
              x: columns.lefts[separatorIndex]! + columns.widths[separatorIndex]! + gap / 2 - 0.375,
              y: columnRegionTop,
              width: 0.75,
              height: Math.max(0, usedBottom - columnRegionTop),
            })),
          }
        : {}),
      ...(pendingAnchoredDrawings.length > 0
        ? { anchoredDrawings: sortDrawingsForPaint(pendingAnchoredDrawings) }
        : {}),
      ...(header ? { header } : {}),
      ...(footer ? { footer } : {}),
    });
    pageFragments = [];
    pendingAnchoredDrawings = [];
    cursorY = 0;
    columnIndex = 0;
    flowColumnIndex = 0;
    columnRegionTop = 0;
    regionFragmentStart = 0;
  };

  const paintsNothing = (entry: PreparedBlock, lines: readonly PendingLine[]): boolean =>
    entry.kind === 'paragraph' && paragraphPaintsNothing(entry, lines, options.inlineDrawingLayout);

  const advanceColumn = (): void => {
    if (columnIndex + 1 < columns.count) {
      columnIndex += 1;
      flowColumnIndex = columnIndex;
      cursorY = columnRegionTop;
      previousSpaceAfter = 0;
      regionFragmentStart = pageFragments.length;
      return;
    }
    flushPage();
    carryDeferredToNextPage();
  };

  // Table layout shares the flow's line count, paragraph cache, and precomputed list items
  // (counters already advanced in document order, including cell paragraphs).
  // Border ownership intervals and vMerge cell visits are budgeted once per pass so nested
  // finalize cannot amplify past the shared ceilings.
  const tableDeps: TableFlowDeps = {
    measurer,
    cache,
    producer,
    // Recorded per table node, so retention can name cell entries of tables a later
    // resumed pass never places.
    onCellBreakKey: (key) => void collectingCellBreakKeys?.push(key),
    nextLineId: (paragraphId, start, lineIndex, occurrence) => {
      lineCounter += 1;
      return bodyLineId(paragraphId, start, lineIndex, occurrence);
    },
    // SECTION-LOCAL page index: the occurrence only disambiguates the same header row
    // across this section's own pages, and an absolute index went stale on any remap.
    pageOccurrenceKey: () => String(pages.length),
    styleCascade,
    listItems,
    ...(defaultTabStopPt !== undefined ? { defaultTabStopPt } : {}),
    ...(options.projectLink ? { projectLink: options.projectLink } : {}),
    ...(options.projectFieldLink ? { projectFieldLink: options.projectFieldLink } : {}),
    ...(options.documentProperties ? { documentProperties: options.documentProperties } : {}),
    // Body flow: page fields in table cells paint a placeholder for document finalize to fill.
    bodyPageFields: bodyPageFieldContext,
    ...(refFields ? { refFields } : {}),
    ...(options.noteMarks ? { noteMarks: options.noteMarks } : {}),
    // `!== undefined`, matching how every key lane derives the context bit, so the cell
    // lane's namespace can never disagree with the body's about whether a context exists.
    ...(options.inlineDrawingLayout !== undefined
      ? { inlineDrawingLayout: options.inlineDrawingLayout }
      : {}),
    ...(options.drawingTokenForParagraph
      ? { drawingTokenForParagraph: options.drawingTokenForParagraph }
      : options.drawingLayoutToken
        ? { drawingLayoutToken: options.drawingLayoutToken }
        : {}),
    ...(options.projectionTokenForParagraph
      ? { projectionTokenForParagraph: options.projectionTokenForParagraph }
      : {}),
    ...(options.inlineDrawingLayout
      ? {
          anchorFrameBase,
          pageContentClip,
          hostedStory,
          publishAnchoredDrawings: collectAnchoredDrawings,
          collectAnchoredDrawings,
          columnBoxForParagraph: anchorColumnBox,
          pageExclusionZones: () =>
            options.drawingExclusionZonesByPage?.get(pages.length) ?? Object.freeze([]),
          paragraphOrderIndex: (paragraphId) => paragraphDocumentOrder.get(paragraphId),
          onAnchorShift: (paragraphId, dy) =>
            shiftAnchoredDrawingRecords(pendingAnchoredDrawings, paragraphId, dy),
          onAnchorRepublish: (paragraphId, drawings) => {
            for (let index = pendingAnchoredDrawings.length - 1; index >= 0; index -= 1) {
              if (pendingAnchoredDrawings[index]!.anchorParagraphId === paragraphId) {
                pendingAnchoredDrawings.splice(index, 1);
              }
            }
            pendingAnchoredDrawings.push(...drawings);
          },
        }
      : {}),
    borderOwnershipBudget: createTableBorderOwnershipBudget(),
    vMergeResolveBudget: createTableVMergeResolveBudget(),
    displayMode,
    ...(authorFilter ? { revisionAuthorFilter: authorFilter } : {}),
  };

  type PreparedParagraph = Extract<PreparedBlock, { kind: 'paragraph' }>;

  // Current-pass list map first, so marker ordinals stay fresh when the memo reuses inputs.
  const firstLineOffsetOf = (entry: PreparedParagraph): number =>
    firstLineShift(
      listItems?.get(entry.paragraph.id) ?? entry.listItem,
      entry.indent,
      measurer,
      entry.tabStops,
      entry.available
    );

  // A one-shot cache releases a paragraph only after its final placement. This preserves
  // keep-with-next lookahead hits without retaining a second document-sized line tree beside
  // the published layout. Live caches implement `release` as a no-op.
  const breakKeysByParagraph = new Map<string, Set<string>>();
  const rememberBreakKey = (paragraphId: string, key: string): void => {
    let keys = breakKeysByParagraph.get(paragraphId);
    if (!keys) {
      keys = new Set();
      breakKeysByParagraph.set(paragraphId, keys);
    }
    keys.add(key);
  };
  const releasePlacedBreaks = (paragraphId: string): void => {
    const keys = breakKeysByParagraph.get(paragraphId);
    if (!keys || !cache) return;
    for (const key of keys) cache.release?.(key);
    breakKeysByParagraph.delete(paragraphId);
  };

  // Shared by placement and by the `w:keepNext` lookahead, which needs the height of the
  // blocks it keeps WITH. Both read the same cache entry, so the lookahead re-measures nothing.
  const breakBlock = (entry: PreparedParagraph, entryIndex: number, startOffset = 0) => {
    const paragraphId = entry.paragraph.id;
    const keepEmptyTocPlaceholder = emptyTocPlaceholderIds?.has(paragraphId) ?? false;
    const suppressChrome =
      !keepEmptyTocPlaceholder &&
      ((tocChromeParagraphIds?.has(paragraphId) ?? false) ||
        (emptyTocSuppressedResultIds?.has(paragraphId) ?? false));
    const available = entry.available;
    const columnX = columnOffsetX();
    const allPageZones =
      options.drawingExclusionZonesByPage?.get(pages.length) ?? Object.freeze([]);
    const pageZones = allPageZones.filter((zone) => {
      const entryOrder = paragraphDocumentOrder.get(entry.paragraph.id);
      const anchorOrder = paragraphDocumentOrder.get(zone.anchorParagraphId);
      if (entryOrder !== undefined && anchorOrder !== undefined) {
        if (anchorOrder > entryOrder) return false;
      } else {
        const anchorIndex = prepared.findIndex(
          (block) => block.kind === 'paragraph' && block.paragraph.id === zone.anchorParagraphId
        );
        if (anchorIndex < 0 || anchorIndex > entryIndex) return false;
      }
      if (columnCount > 1 && zone.columnIndex !== flowColumnIndex) return false;
      return true;
    });
    const exclusionToken = exclusionLayoutToken(pageZones);
    // `entry.key` already folds the content, the cascade props, the tab stops, and the
    // list/textbox/drawing/REF tokens — `prepareBlock` memo-validates each per pass, and
    // `refFields` is one frozen projection per pass, so nothing here can drift from the
    // prepass. This used to rebuild from `entry.props` whenever a drawing token was
    // present, which dropped the list token: a renumbered ordinal that crossed its tab
    // stop kept its pre-renumber first line and the wider marker painted over it. Only
    // what varies per PLACEMENT joins below; the common path must stay `entry.key` BY
    // IDENTITY, because retention names the prepass keys (suffixed and off-prepass-width
    // keys are transient by design) and V8 caches the shared string's hash.
    // A new placement-varying input joins BOTH this suffix chain and the cell path's
    // `paragraphLayoutKey` call in `semantic-table-layout.ts` — the roles map in
    // `layout-cache.ts` guards only the typed inputs, not these suffixes.
    let cacheKey: string | null = null;
    if (cache && !suppressChrome) {
      // `cursorY` belongs in the key: the zones are page-content bands, so the same text at
      // the same width breaks differently depending on where down the page it starts. Keying
      // on zone geometry alone lets a paragraph clear of the float reuse the wrapped break
      // of an identical one that crosses it. NUL-framed: XML text cannot carry U+0000, so
      // no file-derived token can forge a suffix boundary.
      cacheKey = entry.key;
      if (exclusionToken) {
        cacheKey += `\0excl:${flowColumnIndex}|${cursorY.toFixed(3)}|${exclusionToken}`;
      }
      if (startOffset > 0) cacheKey += `\0from:${startOffset}`;
      rememberBreakKey(paragraphId, cacheKey);
    }
    const usePageColumnCoords = columnCount > 1;
    return breakParagraph(
      entry.paragraph,
      paragraphId,
      entry.indent.left,
      available,
      measurer,
      cache,
      cacheKey,
      entry.inheritedRunProperties,
      entry.tabStops,
      undefined,
      styleCascade
        ? (inherited: readonly OoxmlProperty[], direct: readonly OoxmlProperty[]) =>
            cascadeRunProperties(inherited, direct, styleCascade)
        : undefined,
      {
        lineSpacing: entry.lineSpacing,
        equationCacheToken: producer,
        firstLineOffset: startOffset === 0 ? firstLineOffsetOf(entry) : 0,
        startOffset,
        marginExtent: { left: 0, right: entry.indent.left + available + entry.indent.right },
        ...(options.projectLink ? { projectLink: options.projectLink } : {}),
        ...(options.projectFieldLink ? { projectFieldLink: options.projectFieldLink } : {}),
        ...(options.documentProperties ? { documentProperties: options.documentProperties } : {}),
        // Body flow: an empty-cache page field paints a placeholder finalize substitutes per page.
        bodyPageFields: bodyPageFieldContext,
        ...(refFields ? { refFields } : {}),
        displayMode,
        ...(authorFilter ? { revisionAuthorFilter: authorFilter } : {}),
        ...(options.noteMarks ? { noteMarks: options.noteMarks } : {}),
        ...(options.inlineDrawingLayout
          ? { inlineDrawingLayout: options.inlineDrawingLayout }
          : {}),
        contentLeft: usePageColumnCoords ? columnX : 0,
        contentRight: usePageColumnCoords
          ? columnX + columnWidth()
          : entry.indent.left + available + entry.indent.right,
        paragraphStartY: cursorY,
        ...(pageZones.length > 0 ? { pageExclusionZones: pageZones } : {}),
        ...(suppressChrome ? { suppressEmptyPlaceholderLine: true } : {}),
        ...(styleCascade ? { themeFonts: styleCascade.themeFonts } : {}),
        markRunProperties: entry.markRunProperties,
      }
    );
  };

  const pageExclusionZonesForEntry = (
    entry: PreparedParagraph,
    entryIndex: number
  ): readonly ExclusionZone[] => {
    const allPageZones =
      options.drawingExclusionZonesByPage?.get(pages.length) ?? Object.freeze([]);
    return allPageZones.filter((zone) => {
      const entryOrder = paragraphDocumentOrder.get(entry.paragraph.id);
      const anchorOrder = paragraphDocumentOrder.get(zone.anchorParagraphId);
      if (entryOrder !== undefined && anchorOrder !== undefined) {
        if (anchorOrder > entryOrder) return false;
      } else {
        const anchorIndex = prepared.findIndex(
          (block) => block.kind === 'paragraph' && block.paragraph.id === zone.anchorParagraphId
        );
        if (anchorIndex < 0 || anchorIndex > entryIndex) return false;
      }
      if (columnCount > 1 && zone.columnIndex !== flowColumnIndex) return false;
      if (zone.anchorParagraphId === entry.paragraph.id && zone.input.mode === 'topAndBottom') {
        return false;
      }
      return true;
    });
  };

  const placementZonesForLine = (
    entry: PreparedParagraph,
    entryIndex: number,
    brokenLines: readonly PendingLine[],
    lineIndex: number,
    fragmentFirstLine: number,
    fragmentParagraphStartY: number,
    appliedSkipByLineIndex: ReadonlyMap<number, number>
  ): readonly ExclusionZone[] => {
    const pageZones = pageExclusionZonesForEntry(entry, entryIndex);
    if (!options.inlineDrawingLayout || lineIndex <= fragmentFirstLine) return pageZones;
    const offsets = drawingModelOffsetsInParagraph(entry.paragraph);
    const anchorLineTopByModelStart = new Map<number, number>();
    let extent = 0;
    for (let index = fragmentFirstLine; index < lineIndex; index += 1) {
      const brokenLine = brokenLines[index]!;
      for (const modelStart of offsets.values()) {
        if (modelStart >= brokenLine.start && modelStart < brokenLine.end) {
          anchorLineTopByModelStart.set(modelStart, extent);
        }
      }
      const skip =
        appliedSkipByLineIndex.get(index) ?? brokenLines[index]!.exclusionSkipBefore ?? 0;
      extent += skip + brokenLines[index]!.height;
    }
    if (anchorLineTopByModelStart.size === 0) return pageZones;
    const usePageColumnCoords = columnCount > 1;
    const available = entry.available;
    const columnX = columnOffsetX();
    const synthesized = synthesizeParagraphTopAndBottomZones({
      paragraph: entry.paragraph,
      paragraphId: entry.paragraph.id,
      drawingLayout: options.inlineDrawingLayout,
      contentLeft: usePageColumnCoords ? columnX : 0,
      contentRight: usePageColumnCoords
        ? columnX + columnWidth()
        : entry.indent.left + available + entry.indent.right,
      paragraphStartY: fragmentParagraphStartY,
      anchorLineTopByModelStart,
      columnIndex: flowColumnIndex,
      displayMode,
      ...(authorFilter ? { revisionAuthorFilter: authorFilter } : {}),
    });
    return Object.freeze([...pageZones, ...synthesized]);
  };

  const placementSkipBefore = (
    entry: PreparedParagraph,
    entryIndex: number,
    brokenLines: readonly PendingLine[],
    lineIndex: number,
    fragmentFirstLine: number,
    fragmentParagraphStartY: number,
    pendingLine: PendingLine,
    appliedSkipByLineIndex: ReadonlyMap<number, number>
  ): number => {
    if (options.inlineDrawingLayout) {
      const anchorStarts = [...drawingModelOffsetsInParagraph(entry.paragraph).values()];
      if (anchorStarts.length > 0) {
        const firstAnchor = Math.min(...anchorStarts);
        if (pendingLine.end <= firstAnchor) return 0;
        if (
          anchorStarts.some((start) => start >= pendingLine.start && start < pendingLine.end) &&
          pendingLine.end <= firstAnchor + 1
        ) {
          return 0;
        }
      }
    }
    const zones = placementZonesForLine(
      entry,
      entryIndex,
      brokenLines,
      lineIndex,
      fragmentFirstLine,
      fragmentParagraphStartY,
      appliedSkipByLineIndex
    );
    const live =
      zones.length > 0 ? topAndBottomSkipBeforeLine(cursorY, pendingLine.height, zones) : 0;
    const breakSkip = pendingLine.exclusionSkipBefore ?? 0;
    return live > 0.001 ? live : breakSkip;
  };

  const layoutTableInFlow = (table: OoxmlElement): boolean => {
    // The paginator owns the cursor. The adapter syncs it around each story-flow advance.
    const flow: TableFlowCursor = {
      cursorY,
      columnWidth,
      columnLeft,
      contentHeight,
      unreservedContentHeight,
      advanceColumn: () => {
        cursorY = flow.cursorY;
        advanceColumn();
        flow.cursorY = cursorY;
      },
      anchorFrames,
      verticalAnchorFrames: () =>
        tableFloat.bodyTableVerticalAnchorFrames(anchorFrameBase(), cursorY, geometry.margin.top),
      styleCascade,
      displayMode,
      ...(authorFilter ? { revisionAuthorFilter: authorFilter } : {}),
      deps: tableDeps,
      compatibilityMode: options.compatibilityMode,
      shiftAnchor: (paragraphId, dy) =>
        shiftAnchoredDrawingRecords(pendingAnchoredDrawings, paragraphId, dy),
      // A sink, not the array: completing a page replaces `pageFragments`, and a reference
      // taken when the table started would collect its later fragments into a dead array.
      publishFragment: (fragment) => pageFragments.push(fragment),
    };
    const result = paginateTableInFlow(table, flow);
    cursorY = flow.cursorY;
    return result.outOfFlow;
  };

  publishPositionedTablesForPage = (): void =>
    tableFloat.publishPositionedTablesOnPage(
      positionedTables,
      pendingFloatIds,
      pageFragments,
      floatSignals,
      (table, anchorColumn) => {
        const savedColumn = columnIndex;
        const savedFlowColumn = flowColumnIndex;
        columnIndex = anchorColumn;
        flowColumnIndex = anchorColumn;
        collectingCellBreakKeys = [];
        try {
          layoutTableInFlow(table);
          registerTableCellBreakKeys(table, collectingCellBreakKeys);
        } finally {
          collectingCellBreakKeys = null;
          columnIndex = savedColumn;
          flowColumnIndex = savedFlowColumn;
        }
      }
    );
  let converged = false;
  let convergedAt = prepared.length;
  /** Whole pages the convergence tail moved by; reused checkpoints shift with it. */
  let convergedPageDelta = 0;
  for (let index = startIndex; index < prepared.length; index += 1) {
    const entry = prepareBlock(bodies[index]!, columnWidth());

    // The flow as it stands BEFORE this block: what a later pass resumes from.
    checkpoints[index] = checkpointNow();

    // CONVERGENCE. Once inside the unchanged tail, if the IN-PAGE flow returns to exactly
    // the state the previous pass was in at this same paragraph — cursor, pending fragments
    // (compared structurally), anchor state — everything after lays out identically, and the
    // rest of the previous layout is reused: verbatim when the completed page count also
    // matches, remapped whole sheets over when it does not.
    //
    // Tested at EVERY paragraph of the unchanged tail, not just its first: an edit puts the
    // flow out of step for the rest of the page it lands on, and the state only comes back
    // into line once the page it disturbed has been completed.
    if (resumable && commonSuffix > 0 && index >= prepared.length - commonSuffix) {
      const mark = session.checkpoints[index + (session.keys.length - prepared.length)];
      if (
        mark &&
        mark.cursorY === cursorY &&
        mark.previousSpaceAfter === previousSpaceAfter &&
        mark.flowColumnIndex === flowColumnIndex &&
        sameFragments(mark.pageFragments, pageFragments) &&
        sameAnchoredDrawings(mark.pendingAnchoredDrawings, pendingAnchoredDrawings) &&
        // A flow that still owes the next page a drawing is not one that owes it nothing.
        sameAnchoredDrawings(mark.deferredAnchoredDrawings, deferredAnchoredDrawings) &&
        sameDeferCounts(mark.anchorPageDeferCounts, anchorPageDeferCounts) &&
        positionedFlow.same(
          mark.pendingPositionedTableTokens,
          mark.positionedTableAnchorSignals,
          pendingFloatIds,
          floatSignals
        )
      ) {
        // The in-page flow matches. At delta 0 the previous pages are appended by identity;
        // at a nonzero delta the tail is identical content `delta` sheets away and is reused
        // through `remapPage`, gated by `convergenceTailShiftAllowed`.
        const delta = pages.length - mark.pageCount;
        const shiftable = convergenceTailShiftAllowed({
          delta,
          titlePage: furniture?.titlePage === true,
          evenAndOddHeaders: furniture?.evenAndOddHeaders === true,
          parityDependent: session.parityDependent,
          usedPageParity,
          markPageCount: mark.pageCount,
          continuedInsets: continuedInsets !== undefined,
          hasNoteReserves: pageBottomReserves !== undefined,
          hasExclusionZones: (options.drawingExclusionZonesByPage?.size ?? 0) > 0,
        });
        if (shiftable) {
          const tail =
            delta === 0
              ? previous!.pages.slice(mark.pageCount)
              : previous!.pages
                  .slice(mark.pageCount)
                  .map((page, offset) =>
                    remapPage(page, pages.length + offset, pageBox(pages.length + offset).y)
                  );
          pages.push(...tail);
          reusedPages += tail.length;
          converged = true;
          convergedAt = index;
          convergedPageDelta = delta;
          // Line ids are paragraph-local, so a changed line count before this join does not
          // invalidate the tail. Still carry the tail's line COUNT so a multi-section
          // orchestrator receives the correct terminal count for this revision.
          lineCounter += session.endLineCounter - mark.lineCounter;
          break;
        }
      }
    }

    placed += 1;

    if (entry.kind === 'table') {
      if (positionedTableIds.has(entry.table.id)) {
        pendingFloatIds.add(entry.table.id);
        continue;
      }
      collectingCellBreakKeys = [];
      try {
        const outOfFlow = layoutTableInFlow(entry.table);
        if (!outOfFlow) previousSpaceAfter = 0;
        registerTableCellBreakKeys(entry.table, collectingCellBreakKeys);
      } finally {
        collectingCellBreakKeys = null;
      }
      continue;
    }

    const {
      paragraph,
      props,
      spacing: authoredSpacing,
      contextualSpacing,
      styleId,
      borders,
      shading,
      keeps,
    } = entry;
    let { indent, alignment, markRunProperties } = entry;
    let available = entry.available;
    // `w:contextualSpacing` (17.3.1.9) drops the gap between paragraphs of the SAME style.
    // Word's own ListParagraph sets it, so without this every Word-authored list carries a
    // paragraph gap between its items.
    const previousEntry = index > 0 ? prepared[index - 1] : undefined;
    const nextEntry = prepared[index + 1];
    const sameStyleAs = (other: PreparedBlock | undefined): boolean =>
      other?.kind === 'paragraph' && other.styleId === styleId && styleId !== null;
    const spacing: ParagraphSpacing = contextualSpacing
      ? {
          before: sameStyleAs(previousEntry) ? 0 : authoredSpacing.before,
          after: sameStyleAs(nextEntry) ? 0 : authoredSpacing.after,
        }
      : authoredSpacing;
    const listItem = listItems?.get(paragraph.id) ?? entry.listItem;
    // `w:firstLine` moves the first line right of the indent, `w:hanging` moves it left.
    // The schema treats them as mutually exclusive; where a producer writes both, hanging
    // wins, which is how Word reads it.
    // A NUMBERED/BULLETED paragraph's first-line slot belongs to the MARKER: `listMarkerBox`
    // places it at `left - hanging` (or at `left + firstLine` for a positive-firstLine
    // level), and Word's `w:suff` puts the text back at `left` — or after the marker, or at
    // the next tab stop past an overflowing one (§17.9.30).
    let firstLineOffset = firstLineOffsetOf(entry);
    const paragraphId = paragraph.id;
    // `w:between` (§17.3.1.24): consecutive paragraphs with IDENTICAL border settings are ONE
    // bordered block in Word — the box opens above the first and closes below the last, and
    // each interior boundary carries `w:between` or nothing. Applying a box to three selected
    // paragraphs in Word draws one box, not three, and this is why.
    const borderGroupKey = entry.borderGroupKey;
    const inSameBorderGroup = (other: PreparedBlock | undefined): boolean =>
      borderGroupKey !== '' &&
      other?.kind === 'paragraph' &&
      other.borderGroupKey === borderGroupKey;
    const continuesAbove = inSameBorderGroup(previousEntry);
    const continuesBelow = inSameBorderGroup(nextEntry);
    const topEdge = continuesAbove ? undefined : borders.top;
    // What closes the paragraph: the bottom rule, or the `between` rule when the block runs on.
    const closingEdge = continuesBelow ? borders.between : borders.bottom;
    const topExtent = paragraphBorderExtentPt(topEdge);
    const borderExtent = paragraphBorderExtentPt(closingEdge);

    if (paragraphBreaksBefore(props) && (pageFragments.length > 0 || pages.length === 0)) {
      flushPage();
      previousSpaceAfter = 0;
    }

    let lines = breakBlock(entry, index);
    if (lines.length === 0) {
      // Cross-paragraph TOC field chrome: tree preserved, no painted row or flow height.
      releasePlacedBreaks(paragraphId);
      positionedFlow.note(floatSignals, paragraph.id, flowColumnIndex, pageFragments.length);
      continue;
    }
    // A blank paragraph-level `w:sectPr` is the section break, not content. It cannot open a
    // sheet merely because its line misses the bottom; the next section's break owns that.
    const marksSectionBreak =
      paragraphSectionNode(paragraph) !== undefined && paintsNothing(entry, lines);
    const holdsSheet = (): boolean =>
      marksSectionBreak && columnRegionBottom === undefined && columnIndex + 1 >= columns.count;
    const rebreakInCurrentColumn = (startOffset: number): void => {
      const next = prepareBlock(paragraph, columnWidth());
      if (next.kind !== 'paragraph') return;
      indent = next.indent;
      alignment = next.alignment;
      available = next.available;
      markRunProperties = next.markRunProperties;
      firstLineOffset = startOffset === 0 ? firstLineOffsetOf(next) : 0;
      lines = [...breakBlock(next, index, startOffset)];
    };

    // Fit uses unsuppressed lead; top-of-page suppression applies after any flush below.
    {
      const lead = collapsedSpaceBefore(spacing.before, previousSpaceAfter);
      const emptyStyle =
        markRunProperties.length === 0
          ? DEFAULT_RUN_STYLE
          : resolveRunStyle(markRunProperties, styleCascade?.themeFonts);
      // Spacing-after never decides its own line's fit (§17.3.1.33): Word fits the LINE box,
      // and trailing space that crosses the page boundary clips at the break. Only the closing
      // border rule is real painted content below the last line, so only it joins the budget.
      // An oversized `w:after` — the signature-block idiom — otherwise mints blank pages.
      const firstTail = lines.length <= 1 ? borderExtent : 0;
      const prospectiveFirstTop = cursorY + lead + topExtent;
      const firstZones = placementZonesForLine(
        entry,
        index,
        lines,
        0,
        0,
        prospectiveFirstTop,
        new Map()
      );
      const firstExtent = lines[0]
        ? pendingLineFlowExtentAtPlacement(prospectiveFirstTop, lines[0], firstZones, firstTail)
        : measurer.lineMetrics(emptyStyle).height + firstTail;
      let needed = lead + topExtent + firstExtent;
      // `w:keepNext` (§17.3.1.15): this paragraph may not be the last thing on its page. Priced
      // ONCE per chain, at its head — a member whose predecessor keeps too already moved with
      // the group. A chain that cannot fit a page of its own is abandoned.
      if (keeps.keepNext && !keepsNext[index - 1]) {
        // Members are measured at THIS column's width, not the `prepared` entries': the
        // prepass builds at column 0's width, and a section with unequal explicit column
        // widths would otherwise price a group placed into a narrower or wider column with
        // the wrong line breaks, landing the keep break on the wrong block. Equal-width
        // sections re-prepare into a memo hit, so the lookahead still re-measures nothing.
        const group = keepNextGroupHeight(prepared, index, previousSpaceAfter, (at) => {
          const member = prepareBlock(bodies[at]!, columnWidth());
          return member.kind === 'paragraph' ? breakBlock(member, at).map((l) => l.height) : [];
        });
        if (group !== null && group + topExtent <= contentHeight()) {
          needed = Math.max(needed, group + topExtent);
        }
      }
      if (cursorY + needed > contentHeight() && cursorY > 0 && !holdsSheet()) {
        advanceColumn();
        previousSpaceAfter = 0;
        rebreakInCurrentColumn(0);
      }
    }

    const atTopOfPage = cursorY === 0 && !regionHasFragments();
    const appliedBefore = appliedSpaceBefore(
      spacing.before,
      previousSpaceAfter,
      atTopOfPage,
      firstParagraphOfSection
    );
    if (appliedBefore > 0) cursorY += appliedBefore;
    // The top rule and its gap are flow height above the first line, exactly as the bottom
    // rule is flow height below the last — pagination has to see both or a boxed paragraph
    // overhangs the bottom margin by the height of its own frame.
    if (topExtent > 0) cursorY += topExtent;
    firstParagraphOfSection = false;

    // Place the lines, fragmenting at page boundaries.
    let fragmentIndex = 0;
    let pending: LineRecord[] = [];
    let fragmentStart = lines[0]?.start ?? 0;
    let fragmentBefore = appliedBefore;
    // Reserved above the FIRST fragment only: a paragraph continued onto the next page opens
    // once, the same way it closes once.
    let fragmentTopExtent = topExtent;
    let endedWithPageBreak = false;
    let fragmentParagraphStartY = cursorY;
    /** Clearance applied above the fragment's first placed line, for anchor framing. */
    let fragmentFirstLineSkip = 0;
    const appliedSkipByLineIndex = new Map<number, number>();
    previousSpaceAfter = 0;
    const paragraphHasAnchors =
      options.inlineDrawingLayout !== undefined &&
      anchoredDrawingAtomsInParagraph(entry.paragraph, options.inlineDrawingLayout).length > 0;
    let paragraphAnchorsPublished = false;
    let paragraphAnchorOrigin: Readonly<{
      columnX: number;
      columnWidth: number;
      startY: number;
    }> | null = null;

    const { revisions: markRevisions, formatRevision: markFormatRevision } =
      visibleParagraphMarkRevisionsOf(entry.paragraph, displayMode, authorFilter);
    const mergeGroup = paragraphMergeGroupOf(entry.paragraph);
    const mergeBoundaries = mergeGroup ? mergeBoundariesOf(mergeGroup) : null;

    /**
     * How much of the first placed line's topAndBottom skip this paragraph's own anchor caused.
     *
     * The placement skip mixes two sources: bands inherited from earlier paragraphs, which
     * genuinely move this paragraph down the page, and a band from an anchor inside it, which
     * only moves its text away from a picture pinned to the paragraph origin. Re-running the
     * clearance with the inherited zones alone isolates the second.
     */
    const ownTopAndBottomSkipOnFirstLine = (): number => {
      const firstLine = pending[0];
      if (!firstLine) return 0;
      const applied = fragmentFirstLineSkip;
      if (applied <= 0.001) return 0;
      const inherited = topAndBottomSkipBeforeLine(
        fragmentParagraphStartY,
        firstLine.box.height,
        pageExclusionZonesForEntry(entry, index)
      );
      return Math.max(0, applied - inherited);
    };

    const flushFragment = (isLast: boolean): void => {
      if (pending.length === 0) return;
      const regionX = columnLeft();
      const columnX = columnOffsetX();
      const linesTop = pending[0]!.box.y;
      const top = linesTop - fragmentBefore - fragmentTopExtent;
      const linesBottom =
        pending[pending.length - 1]!.box.y + pending[pending.length - 1]!.box.height;
      const appliedAfter = isLast ? spacing.after : 0;
      const strokes: ParagraphBorderStrokeRecord[] = [];
      let bottomBorderRecord: ParagraphBottomBorderRecord | undefined;
      let contentTop = linesTop;
      let contentBottom = linesBottom;
      // THE FOUR EDGES ARE ONE BOX. The side rules sit outside the text column by their own
      // `w:space`, so a top rule drawn only across the column stops short of them and the
      // frame reads as two horizontal rules with two detached vertical bars beside it —
      // which is what a callout looked like. Word closes the rectangle, so the horizontal
      // rules span from the left rule's outer edge to the right rule's.
      // Stroke thickness uses the inflated compound band for `double`/etc. so thin authored
      // doubles still publish a box paint can draw as two lines (shared with table borders).
      const leftStroke = borders.left ? paragraphBorderStrokeWidthPt(borders.left) : 0;
      const rightStroke = borders.right ? paragraphBorderStrokeWidthPt(borders.right) : 0;
      const boxLeft = borders.left
        ? regionX + indent.left - borders.left.spacePt - leftStroke
        : regionX + indent.left;
      const boxRight = borders.right
        ? regionX + indent.left + available + borders.right.spacePt + rightStroke
        : regionX + indent.left + available;
      const boxWidth = Math.max(boxRight - boxLeft, 0);
      if (fragmentTopExtent > 0 && topEdge) {
        const topStroke = paragraphBorderStrokeWidthPt(topEdge);
        const ruleY = linesTop - topEdge.spacePt - topStroke;
        strokes.push({
          side: 'top',
          edge: topEdge,
          box: { x: boxLeft, y: ruleY, width: boxWidth, height: topStroke },
        });
        contentTop = ruleY;
      }
      if (isLast && closingEdge) {
        const closeStroke = paragraphBorderStrokeWidthPt(closingEdge);
        const ruleY = linesBottom + closingEdge.spacePt;
        const box = {
          x: boxLeft,
          y: ruleY,
          width: boxWidth,
          height: closeStroke,
        };
        strokes.push({ side: continuesBelow ? 'between' : 'bottom', edge: closingEdge, box });
        // `bottomBorder` stays the BOTTOM rule alone: a `between` rule closing a grouped
        // paragraph is a different edge, and a consumer reading it as the box's bottom would
        // draw the block's frame at every interior boundary.
        if (!continuesBelow) bottomBorderRecord = { edge: closingEdge, box };
        contentBottom = ruleY + closeStroke;
      }
      if (isLast) cursorY = Math.max(cursorY, contentBottom + appliedAfter);
      const height = Math.max(contentBottom + appliedAfter - top, 0);
      // Side rules run the height of the bordered block, and inside a group they run THROUGH
      // the inter-paragraph gap so the box reads as one outline rather than a ladder.
      const sideTop = continuesAbove && fragmentIndex === 0 ? top : contentTop;
      const sideBottom = continuesBelow && isLast ? top + height : contentBottom;
      const sideHeight = Math.max(sideBottom - sideTop, 0);
      if (borders.left) {
        strokes.push({
          side: 'left',
          edge: borders.left,
          box: {
            x: regionX + indent.left - borders.left.spacePt - leftStroke,
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
            x: regionX + indent.left + available + borders.right.spacePt,
            y: sideTop,
            width: rightStroke,
            height: sideHeight,
          },
        });
      }
      // `w:bar` is the change-bar rule beside the paragraph. It belongs to the paragraph, not
      // to the block, so it neither opens nor closes with the group.
      if (borders.bar) {
        const barStroke = paragraphBorderStrokeWidthPt(borders.bar);
        strokes.push({
          side: 'bar',
          edge: borders.bar,
          box: {
            x: regionX + indent.left - borders.bar.spacePt - barStroke,
            y: linesTop,
            width: barStroke,
            height: Math.max(linesBottom - linesTop, 0),
          },
        });
      }
      // A resolved view lays a run of paragraphs out as one. The layout is what the document
      // becomes; the identity has to stay what the document HAS, or an edit in the merged half
      // addresses a position the store does not hold.
      const mergedLines = mergeBoundaries ? remapMergedLines(pending, mergeBoundaries) : null;
      const rawMarker =
        fragmentIndex === 0
          ? publishListMarker(
              listItem,
              measurer,
              pending[0] ? { y: pending[0].box.y, height: pending[0].box.height } : undefined
            )
          : undefined;
      const marker = rawMarker
        ? { ...rawMarker, box: { ...rawMarker.box, x: rawMarker.box.x + regionX } }
        : undefined;
      if (fragmentIndex === 0) {
        positionedFlow.note(floatSignals, paragraphId, flowColumnIndex, pageFragments.length);
      }
      pageFragments.push({
        kind: 'paragraph',
        id: `${paragraphId}#f${fragmentIndex}`,
        paragraphId,
        fragmentIndex,
        range: mergedLines
          ? // A merged fragment holds more than one paragraph and this field holds one range,
            // so it cannot be the fragment's extent. It takes the one its LAST line reports —
            // where the fragment ENDS — and everything that resolves a position reads spans
            // instead, which name their own paragraphs. `pushLineCaretStops` reads `start`
            // from here only to dedupe a continuation line's first stop, and a merged
            // fragment's lines are compared against their own segment starts anyway.
            mergedLines[mergedLines.length - 1]!.range
          : {
              paragraphId,
              start: fragmentStart,
              end: pending[pending.length - 1]!.range.end,
            },
        props,
        styleId: entry.styleId,
        outlineLevel: entry.outlineLevel,
        alignment: entry.alignment,
        spacing: { before: fragmentBefore, after: appliedAfter },
        indent,
        ...(bottomBorderRecord ? { bottomBorder: bottomBorderRecord } : {}),
        ...(strokes.length > 0 ? { borders: strokes } : {}),
        ...(shading === undefined
          ? {}
          : {
              shading,
              // A BORDERED paragraph is shaded across the whole frame, not just the text
              // band: Word fills the box its borders draw, `w:space` padding included, so a
              // fill that stopped at the line area left a pale stripe floating inside an
              // empty rectangle. Unbordered shading keeps the line area, which is what Word
              // fills there. Borders paint after this, so the frame is never covered.
              // Gated on a real FRAME — a side rule is what makes the fill a box. A heading
              // with only `w:bottom` is the common single-edge case, and widening its fill
              // down to the rule would be a silent change in the opposite direction.
              shadingBox:
                borders.left || borders.right
                  ? {
                      x: boxLeft,
                      y: contentTop,
                      width: boxWidth,
                      height: Math.max(contentBottom - contentTop, 0),
                    }
                  : paragraphShadingBox(pending, regionX + indent.left, available)!,
            }),
        tabStops: entry.tabStops,
        ...(marker ? { marker } : {}),
        // Final fragment only — a paragraph split across pages must not draw two pilcrows —
        // and `all-markup` only, as Word draws attribution in All Markup alone. The record's
        // own declaration carries the rest of the reasoning.
        ...(isLast && showsMarkup ? markRevisionFields(markRevisions, markFormatRevision) : {}),
        lines: mergedLines ?? pending,
        box: { x: columnX + indent.left, y: top, width: available, height },
      });
      if (options.inlineDrawingLayout && paragraphHasAnchors && !paragraphAnchorsPublished) {
        paragraphAnchorsPublished = true;
        const anchorOffsets = [...drawingModelOffsetsInParagraph(entry.paragraph).values()];
        const pendingCoversAnchors =
          anchorOffsets.length > 0 &&
          anchorOffsets.every((offset) =>
            pending.some((line) => offset >= line.range.start && offset < line.range.end)
          );
        let publishLines: typeof pending;
        let publishParagraphBox: LayoutBox;
        let publishColumnBox: LayoutBox;
        if (pendingCoversAnchors) {
          // A `wrapTopAndBottom` anchor pushed its OWN paragraph's lines down to clear the
          // band. Framing the anchor against those lines chases the displacement it caused —
          // the picture lands on the text it just moved. `positionV relativeFrom="paragraph"`
          // means where the paragraph would begin without its own band, so that skip comes
          // back off here. A band inherited from an earlier paragraph is NOT removed: it
          // moved this paragraph for real, and the anchor travels with it.
          const anchorTop = top - ownTopAndBottomSkipOnFirstLine();
          publishLines = pending;
          publishParagraphBox = {
            x: columnX + indent.left,
            y: anchorTop,
            width: available,
            height,
          };
          publishColumnBox = anchorColumnBox({
            x: columnX + indent.left,
            y: anchorTop,
            width: available,
            height,
          });
        } else {
          const origin = paragraphAnchorOrigin ?? {
            columnX,
            columnWidth: columnWidth(),
            startY: top,
          };
          let syntheticY = origin.startY;
          publishLines = lines.map((brokenLine, brokenIndex) => {
            const lineRecord = {
              id: `anchor-line-${brokenIndex}`,
              range: { paragraphId, start: brokenLine.start, end: brokenLine.end },
              box: {
                x: origin.columnX + indent.left,
                y: syntheticY,
                width: available,
                height: brokenLine.height,
              },
              // Synthetic frame geometry only — these lines are never aligned, painted or
              // caret-tested, so the content origin is just where their spans were placed.
              contentX:
                brokenLine.spans.length > 0
                  ? brokenLine.spans[0]!.box.x + origin.columnX
                  : origin.columnX + indent.left,
              baseline: brokenLine.baseline,
              leading: brokenLine.leading,
              trailingSpacing: brokenLine.trailingSpacing,
              spans: brokenLine.spans.map((span) => ({
                ...span,
                box: { ...span.box, x: span.box.x + origin.columnX, y: syntheticY },
              })),
            };
            syntheticY += brokenLine.height + (brokenLine.exclusionSkipBefore ?? 0);
            return lineRecord;
          });
          const paragraphTop = origin.startY;
          publishParagraphBox = {
            x: origin.columnX + indent.left,
            y: paragraphTop,
            width: available,
            height: Math.max(syntheticY - paragraphTop, pending[0]?.box.height ?? 0),
          };
          publishColumnBox = anchorColumnBox(publishParagraphBox);
        }
        collectAnchoredDrawings(
          publishAnchoredDrawingsForParagraph({
            paragraph: entry.paragraph,
            paragraphId,
            paragraphBox: publishParagraphBox,
            lines: publishLines,
            drawingLayout: options.inlineDrawingLayout,
            frameBase: anchorFrameBase(),
            columnBox: publishColumnBox,
            cellBox: null,
            pageClip: pageContentClip(),
            measurer,
            sourceOrderOf,
            // The drawing-context guard above is the same predicate that creates this bundle.
            layoutTextboxStory: hostedStory!.layoutTextboxStoryFor,
            displayMode,
            ...(authorFilter ? { revisionAuthorFilter: authorFilter } : {}),
          })
        );
      }
      fragmentIndex += 1;
      fragmentStart = pending[pending.length - 1]!.range.end;
      pending = [];
      fragmentBefore = 0;
      fragmentTopExtent = 0;
    };

    // First line of this paragraph on the CURRENT page: the anchor a keep rule retreats to.
    // Not always 0 — a paragraph already cut by a page boundary keeps what it kept. Each
    // retreat moves a line onto a later page, so the walk terminates; `maxRetreats` guards a
    // future rule that could cycle, and fails OPEN at the natural break rather than throwing.
    let fragmentFirstLine = 0;
    let retreats = 0;
    let maxRetreats = lines.length + MAX_KEEP_NEXT_CHAIN;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const pendingLine = lines[lineIndex]!;
      const isLastLine = lineIndex === lines.length - 1;
      // Spacing-after stays out of the fit budget (see the firstTail note above): it moves
      // where the NEXT paragraph starts, never whether this line fits, and it clips at the
      // page boundary rather than carrying over.
      const tail = isLastLine ? borderExtent : 0;
      if (lineIndex === fragmentFirstLine) {
        fragmentParagraphStartY = cursorY;
        if (paragraphHasAnchors && paragraphAnchorOrigin === null && fragmentIndex === 0) {
          paragraphAnchorOrigin = Object.freeze({
            columnX: columnOffsetX(),
            columnWidth: columnWidth(),
            startY: fragmentParagraphStartY,
          });
        }
      }
      const skipBefore = placementSkipBefore(
        entry,
        index,
        lines,
        lineIndex,
        fragmentFirstLine,
        fragmentParagraphStartY,
        pendingLine,
        appliedSkipByLineIndex
      );
      // Word can let auto/atLeast spacing below the glyph band cross the bottom text
      // margin. The painted line keeps its full box; only the pagination budget drops that
      // trailing external depth.
      const lineExtent =
        skipBefore + Math.max(0, pendingLine.height - pendingLine.trailingSpacing) + tail;
      const overflowsPage =
        cursorY + lineExtent > contentHeight() &&
        !holdsSheet() &&
        (pending.length > 0 || pageFragments.length > 0 || pages.length > 0);
      if (overflowsPage) {
        // `w:widowControl` (§17.3.1.44) / `w:keepLines` (§17.3.1.16) change where a paragraph
        // may be CUT, not where it fits: retreat off a stranded line, or off keepLines whole.
        const alone = !regionHasFragments();
        const breakAt =
          retreats < maxRetreats
            ? adjustedBreakIndex(lineIndex, fragmentFirstLine, lines.length, keeps, alone)
            : lineIndex;
        const retreated = breakAt < lineIndex;
        // Un-placing hands line ids BACK: a line re-placed on the next page must carry the id
        // it already took, or every id below it is out of step with a clean pass.
        for (let back = lineIndex; back > breakAt; back -= 1) {
          pending.pop();
          const removedPending = lines[back - 1]!;
          const removedSkip =
            appliedSkipByLineIndex.get(back - 1) ?? removedPending.exclusionSkipBefore ?? 0;
          appliedSkipByLineIndex.delete(back - 1);
          cursorY -= removedPending.height + removedSkip;
          lineCounter -= 1;
        }
        // Moving WHOLE means it now OPENS a page: space-before drops, the top rule travels.
        const movesWhole = retreated && pending.length === 0 && fragmentIndex === 0;
        const nextOffset = lines[breakAt]!.start;
        const priorColumnWidth = columnWidth();
        flushFragment(false);
        advanceColumn();
        fragmentBefore = 0;
        if (movesWhole) cursorY = fragmentTopExtent;
        else fragmentTopExtent = 0;
        if (columnWidth() !== priorColumnWidth) {
          rebreakInCurrentColumn(nextOffset);
          maxRetreats = Math.max(maxRetreats, lines.length + MAX_KEEP_NEXT_CHAIN);
          fragmentFirstLine = 0;
          if (retreated) retreats += 1;
          lineIndex = -1;
          continue;
        }
        fragmentFirstLine = breakAt;
        fragmentParagraphStartY = cursorY;
        if (retreated) {
          retreats += 1;
          lineIndex = breakAt - 1;
          continue;
        }
      }
      const columnX = columnOffsetX();
      appliedSkipByLineIndex.set(lineIndex, skipBefore);
      cursorY += skipBefore;
      const lineIndent = columnX + indent.left + (lineIndex === 0 ? firstLineOffset : 0);
      const lineAvailableWidth = Math.max(1, available - (lineIndex === 0 ? firstLineOffset : 0));
      const placedSpans = pendingLine.spans.map((span) => ({
        ...span,
        range: { ...span.range, paragraphId },
        box: { ...span.box, x: span.box.x + columnX, y: cursorY },
      }));
      const alignedSpans = alignSpans(
        placedSpans,
        measurer,
        lineIndent,
        lineAvailableWidth,
        alignment,
        isLastLine,
        alignment === 'center' || alignment === 'right' ? pendingLine.width : undefined
      );
      // A line with no spans still aligns: an empty centred paragraph puts its (zero width)
      // content — and so the caret — at the middle of the measure, not at the left edge.
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
      const pageClip = Object.freeze({
        x: 0,
        y: 0,
        // Inline records are already placed in page-content coordinates. In a multi-column
        // section `contentWidth` is only column zero; clipping to it erases later columns.
        width: contentWidthForReflow,
        height: contentHeight(),
      });
      const placedDrawings = pendingLine.drawings.map((drawing) => {
        const placed = Object.freeze({
          ...shiftInlineDrawingRecord(drawing, columnX, cursorY),
          paragraphId,
        });
        return clipInlineDrawingRecordToRegion(placed, pageClip);
      });
      const alignedDrawings = alignDrawings(placedDrawings, alignOffset);
      const record: LineRecord = {
        id: bodyLineId(paragraph.id, pendingLine.start, lineIndex),
        range: { paragraphId, start: pendingLine.start, end: pendingLine.end },
        spans: alignedSpans,
        box: {
          x: columnOffsetX() + indent.left,
          y: cursorY,
          width: available,
          height: pendingLine.height,
        },
        contentX: alignedSpans[0]?.box.x ?? lineIndent + alignOffset,
        baseline: pendingLine.baseline,
        leading: pendingLine.leading,
        trailingSpacing: pendingLine.trailingSpacing,
        ...(pendingLine.deletedRanges ? { deletedRanges: pendingLine.deletedRanges } : {}),
        ...(alignedDrawings.length > 0 ? { drawings: alignedDrawings } : {}),
        ...(pendingLine.anchorRevisions ? { anchorRevisions: pendingLine.anchorRevisions } : {}),
      };
      lineCounter += 1;
      if (pending.length === 0) fragmentFirstLineSkip = skipBefore;
      pending.push(record);
      cursorY += pendingLine.height;
      if (pendingLine.columnBreakAfter) {
        const priorColumnWidth = columnWidth();
        flushFragment(isLastLine);
        advanceColumn();
        fragmentBefore = 0;
        fragmentTopExtent = 0;
        endedWithPageBreak = true;
        if (!isLastLine && columnWidth() !== priorColumnWidth) {
          rebreakInCurrentColumn(pendingLine.end);
          maxRetreats = Math.max(maxRetreats, lines.length + MAX_KEEP_NEXT_CHAIN);
          fragmentFirstLine = 0;
          lineIndex = -1;
          continue;
        }
        fragmentFirstLine = lineIndex + 1;
      } else if (pendingLine.pageBreakAfter) {
        flushFragment(isLastLine);
        flushPage();
        fragmentBefore = 0;
        fragmentTopExtent = 0;
        endedWithPageBreak = true;
        // An explicit break is the author's cut; the keep rules apply afresh after it.
        fragmentFirstLine = lineIndex + 1;
      }
    }
    flushFragment(true);
    releasePlacedBreaks(paragraphId);
    previousSpaceAfter = endedWithPageBreak ? 0 : spacing.after;
  }

  // A TERMINAL checkpoint, describing the flow after the last paragraph. Without it,
  // appending a paragraph gives `firstChanged === paragraphCount` — "resume after the end" —
  // for which nothing was stored, so the most ordinary edit there is, typing at the bottom of
  // a document and pressing Enter, re-placed everything.
  if (!converged) {
    checkpoints[prepared.length] = checkpointNow();
  }

  // Captured BEFORE the terminal flush, which zeroes the cursor. A converged pass stopped
  // early and never walked the tail, so its end state is the one the previous pass stored.
  const endCursorY = converged && session ? session.endCursorY : cursorY;
  const endSpaceAfter = converged && session ? session.endSpaceAfter : previousSpaceAfter;
  // The terminal flush closes the page the flow was still filling. When it does NOT run,
  // the last page was already closed by a page break and the cursor sits at the top of a
  // sheet that was never opened — nothing may be appended to what is in `pages`.
  const flushesOpenPage =
    !converged && (pageFragments.length > 0 || floatSignals.length > 0 || pages.length === 0);
  const endsOpenPage = converged && session ? session.endsOpenPage : flushesOpenPage;

  if (flushesOpenPage) flushPage();
  let terminalFlushAttempts = 0;
  const maxTerminalFlushAttempts = MAX_ANCHOR_PAGE_DEFERRALS * 4 + 8;
  while (
    (pendingAnchoredDrawings.length > 0 || deferredAnchoredDrawings.length > 0) &&
    terminalFlushAttempts < maxTerminalFlushAttempts
  ) {
    terminalFlushAttempts += 1;
    if (pendingAnchoredDrawings.length === 0) carryDeferredToNextPage();
    flushPage();
  }
  if (deferredAnchoredDrawings.length > 0) {
    pendingAnchoredDrawings.push(
      ...deferredAnchoredDrawings.map((drawing) =>
        withAnchoredDrawingLayoutFallback(drawing, 'page-defer-exhausted')
      )
    );
    deferredAnchoredDrawings = [];
    flushPage();
  }
  // Entries for paragraphs this pass never asked for are gone from the document, or their
  // context changed; holding them would let the cache grow with the session rather than
  // with the document.
  // Retain by the keys of every paragraph in the DOCUMENT, not just those this pass
  // re-placed: a resumed pass never visits the prefix, and evicting its entries would make
  // the next full pass measure the whole document again.
  publishRetainedKeys();
  const layout: SemanticLayout = {
    revision,
    pages,
    ...(options.displayMode ? { displayMode: options.displayMode } : {}),
  };
  if (session) {
    session.previous = layout;
    // A converged pass stops early, so the tail's checkpoints were never recomputed. The
    // previous pass's remain valid precisely because the flow matched at the join — with
    // their completed-page counts moved by however many sheets the reused tail moved.
    session.checkpoints = converged
      ? [
          ...checkpoints.slice(0, convergedAt),
          ...session.checkpoints
            .slice(convergedAt + (session.keys.length - prepared.length))
            .map((checkpoint) =>
              convergedPageDelta === 0
                ? checkpoint
                : { ...checkpoint, pageCount: checkpoint.pageCount + convergedPageDelta }
            ),
        ]
      : checkpoints;
    session.keys = flowKeys;
    // Re-sliced with the page count THIS pass produced: a pass that grew past the start-time
    // bound read reserve slots the start-time key never folded, and the next comparison must
    // see them. An input-identical replay produces the same count, so its start-time bound
    // (previous count + 1) rebuilds this exact string. When the counts agree the start-time
    // string IS that string — reuse it by identity so the next pass's context check is a
    // pointer compare, not a rebuild plus memcmp.
    session.context =
      pages.length + 1 === reserveKeyBound
        ? context
        : contextFor(notesReserveContextKey(pageBottomReserves, pageIndexStart, pages.length + 1));
    session.producer = producer;
    // Sticky whenever any part of the previous layout was reused: a resumed pass never
    // re-places the prefix and a converged pass never re-places the tail, so their
    // parity-reading anchors could not fire `onPageParityRead` this pass. Only a pass that
    // placed EVERYTHING (full start, no convergence) may clear the flag.
    const passParityDependent = usedPageParity || furniture?.evenAndOddHeaders === true;
    session.parityDependent =
      startIndex === 0 && !converged
        ? passParityDependent
        : session.parityDependent || passParityDependent;
    session.startPageParity = startPageParity;
    session.startLineCounter = lineCounterStart;
    session.endLineCounter = lineCounter;
    session.endCursorY = endCursorY;
    session.endSpaceAfter = endSpaceAfter;
    session.endsOpenPage = endsOpenPage;
    session.stats = {
      placed,
      total: prepared.length,
      reusedPages,
      fullPasses: session.stats.fullPasses + (startIndex === 0 ? 1 : 0),
    };
  }
  return {
    layout,
    pages,
    lineCounter,
    endCursorY,
    endSpaceAfter,
    endsOpenPage,
    overflowShellAt,
  };
}

function layoutBlocksWithGeometry(
  bodies: readonly OoxmlElement[],
  revision: number,
  options: BlockLayoutOptions
): BlockLayoutResult {
  return layoutBlocksWithColumnBalance(bodies, revision, options, layoutBlocksPass);
}

export { createFixedMeasurer } from './fixed-measurer.ts';

// Boundary records moved to their own module; re-exported here because the editor facade
// and the tests import them from the layout entry they always did.
export {
  attachContentControlBoundaries,
  contentControlContextToken,
  type ContentControlBoundaryWork,
} from './content-control-boundary-layout.ts';
