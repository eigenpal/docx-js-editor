// One neutral document layout session shared by all exporters.

import {
  openHeadlessDocument,
  type HeadlessDocumentRejection,
  type HeadlessDocumentView,
  type ImageDecodePort,
  type ImageResourceState,
} from '@docx-editor.dev/core/store';
import {
  createDocumentFurnitureSource,
  createDocumentLinkProjectors,
  createDocumentStyleDependencies,
  createFieldLinkRegistry,
  forEachSemanticDrawing,
  TablePaginationError,
  type CreateDocumentFurnitureSourceOptions,
} from '../layout/index.ts';
import {
  layoutDocumentView,
  type LayoutDocumentViewOptions,
} from '../layout/document-layout-coordinator.ts';
import { createFixedMeasurer } from '../layout/fixed-measurer.ts';
import { createInlineDrawingLayoutBundle } from '../layout/inline-drawing-source.ts';
import { releasePageFieldProjectionState } from '../layout/field-page-furniture.ts';
import { createParagraphLayoutCache } from '../layout/layout-cache.ts';
import { createLayoutSession } from '../layout/layout-session.ts';
import { releaseOverflowPageShellState } from '../layout/page-furniture-insets.ts';
import type { AnchoredDrawingRecord, InlineDrawingRecord } from '../layout/drawing-layout.ts';
import type { SemanticLayout, TextMeasurer } from '../layout/semantic-records.ts';
import type { SemanticReviewArtifactRecord } from '../layout/review-artifact-records.ts';
import type { RevisionDisplayMode } from '../layout/revision-projection.ts';
import { DEFAULT_REVISION_DISPLAY_MODE } from '../layout/revision-projection.ts';
import {
  attachExportDocumentResources,
  type ExportDestinationGeometry,
  type ExportDocumentMetadata,
} from './export-document-resources.ts';
import {
  createNodeImageDecodePort,
  type PreservedImageConverter,
} from './node-image-decode-port.ts';
import { attachReviewArtifactGeometry } from './review-artifact-geometry.ts';
import { projectReviewArtifacts } from './review-artifact-projection.ts';
import { publishImmutableSemanticLayout } from './semantic-layout-publication.ts';

const EMPTY_REVIEW_ARTIFACTS = Object.freeze([]);

/** Source accepted by every exporter: untrusted bytes or an already-open live view. @public */
export type ExportDocumentSource = Uint8Array | HeadlessDocumentView;

/** Shared session options; translators add their own format-specific options. @public */
export interface OpenDocumentForExportOptions {
  /**
   * Revision projection applied before records reach an exporter. Default: `all-markup`.
   *
   * The safe reader default keeps every pending insertion and deletion visible. Choose
   * `proposed` or `original` explicitly only when a resolved view is intended.
   */
  readonly displayMode?: RevisionDisplayMode;
  /**
   * Text measurement used for line wrapping and pagination. Omit only when deterministic
   * approximate pagination is acceptable. Core then uses a fixed-width fallback that neither
   * resolves nor shapes the document's fonts, so line and page breaks can differ from Word.
   * Exporters promising physical-page fidelity must supply a font-backed measurer. For immutable
   * DOCX bytes with document-aware font origins, use {@link openFontBackedDocumentForExport};
   * {@link acquireSharedExportShaping} is for process-static prepared configurations or a live
   * host that already owns revision-stable shaping.
   */
  readonly measurer?: TextMeasurer;
  /**
   * Stable measurement implementation identity used by layout caches and diagnostics. Pair it
   * with the exact shaping policy behind `measurer`; it is not a substitute for matching metrics.
   */
  readonly producer?: string;
  /** Host image metadata decoder; omit for the bounded DOM-free Node decoder. */
  readonly imageDecodePort?: ImageDecodePort;
  /** Optional converter for preserved image formats the default decoder cannot inspect. */
  readonly convertPreservedImage?: PreservedImageConverter;
  /** Cancels resource waits and subsequent layouts. */
  readonly signal?: AbortSignal;
  /** Maximum time spent waiting for image resources in one layout call. Default: 60 seconds. */
  readonly resourceTimeoutMs?: number;
  /** Retain incremental state for a live view. Defaults to true for views and false for bytes. */
  readonly reuseAcrossRevisions?: boolean;
}

/**
 * Export-ready semantic snapshot. Core guarantees normalized review artifacts for every session,
 * including an empty immutable array when the source has none. A resolved snapshot is recursively
 * immutable and remains traversable after its producer session is disposed; disposal only revokes
 * session-owned work and capabilities such as {@link ExportSession.validatedImageBytes}.
 * @public
 */
export interface ExportSemanticLayout extends SemanticLayout {
  readonly reviewArtifacts: readonly SemanticReviewArtifactRecord[];
  readonly documentMetadata?: ExportDocumentMetadata;
  readonly destinations?: readonly ExportDestinationGeometry[];
}

/** Bounded failure from a headless export session. @public */
export class ExportResourceError extends Error {
  constructor(
    readonly code:
      | 'aborted'
      | 'timedOut'
      | 'nonConvergent'
      | 'disposed'
      | 'layoutInvariant'
      | 'layoutFailed',
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ExportResourceError';
  }
}

function safelyIsExportResourceError(error: unknown): error is ExportResourceError {
  try {
    return error instanceof ExportResourceError;
  } catch {
    return false;
  }
}

function safelyIsTablePaginationError(error: unknown): error is TablePaginationError {
  try {
    return error instanceof TablePaginationError;
  } catch {
    return false;
  }
}

function safeErrorMessage(error: unknown): string | null {
  try {
    if (!(error instanceof Error)) return null;
    return typeof error.message === 'string' && error.message.length > 0 ? error.message : null;
  } catch {
    return null;
  }
}

function normalizedLayoutFailure(error: unknown): ExportResourceError {
  if (safelyIsExportResourceError(error)) return error;
  const invariant = safelyIsTablePaginationError(error);
  const message = safeErrorMessage(error);
  const detail = message ? `: ${message}` : '';
  const normalized = new ExportResourceError(
    invariant ? 'layoutInvariant' : 'layoutFailed',
    invariant
      ? `Authored geometry could not be represented within the bounded page model${detail}`
      : `Export layout failed${detail}`
  );
  Object.defineProperty(normalized, 'cause', {
    configurable: true,
    value: error,
  });
  return normalized;
}

/**
 * A single semantic-layout substrate reusable by Markdown and later exporters. Pagination
 * fidelity is determined by the session's measurer; core's default is deterministic, not
 * font-accurate.
 * @public
 */
export interface ExportSession {
  /** Settle resources and return the default revision projection. */
  layout(): Promise<ExportSemanticLayout>;
  /** Settle resources and cache one explicit revision projection. */
  layoutFor(displayMode: RevisionDisplayMode): Promise<ExportSemanticLayout>;
  /** Mint a defensive copy only for a ready drawing from this session. */
  validatedImageBytes(drawing: InlineDrawingRecord | AnchoredDrawingRecord): Uint8Array | null;
  /**
   * Release per-document caches, pending resource work, and image-byte capabilities. Idempotent.
   * Previously resolved layout snapshots remain immutable and traversable after disposal.
   */
  dispose(): void;
}

/** Typed refusal for bytes that cannot become a document view, or an already-aborted open. @public */
export type OpenDocumentForExportResult =
  | { readonly ok: true; readonly session: ExportSession }
  | {
      readonly ok: false;
      readonly reason: HeadlessDocumentRejection | 'aborted';
      readonly detail?: string;
    };

function normalizedResourceTimeout(value: number | undefined): number {
  if (value === undefined) return 60_000;
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError('resourceTimeoutMs must be a positive finite number');
  }
  return Math.max(1, value);
}

function normalizedDisplayMode(value: unknown): RevisionDisplayMode {
  if (value === 'all-markup' || value === 'proposed' || value === 'original') return value;
  throw new RangeError('displayMode must be all-markup, proposed, or original');
}

const REVISION_POLL_INTERVAL_MS = 50;

/**
 * Bound on image-quiescence layout passes AND on live-view revision restarts: one budget,
 * because both loops guard the same non-convergence (a document that never stops moving).
 */
const MAX_CONVERGENCE_PASSES = 64;

function resourceIsPending(resource: ImageResourceState): boolean {
  switch (resource.kind) {
    case 'pending':
      return true;
    case 'ready':
    case 'unrenderable':
    case 'external':
    case 'missing':
      return false;
    default:
      return resource satisfies never;
  }
}

function layoutHasPendingImages(layout: SemanticLayout): boolean {
  let pending = false;
  forEachSemanticDrawing(layout, ({ drawing }) => {
    if (resourceIsPending(drawing.resource)) pending = true;
  });
  return pending;
}

function isDocumentView(source: ExportDocumentSource): source is HeadlessDocumentView {
  return !ArrayBuffer.isView(source);
}

/** Open bytes or a live neutral view into one reusable layout session. @public */
export function openDocumentForExport(
  source: ExportDocumentSource,
  options: OpenDocumentForExportOptions = {}
): OpenDocumentForExportResult {
  if (options.signal?.aborted) {
    // A session whose every method already throws is `ok: true` in shape only; answer the
    // typed refusal the caller can branch on instead.
    return { ok: false, reason: 'aborted' };
  }
  const displayMode = normalizedDisplayMode(options.displayMode ?? DEFAULT_REVISION_DISPLAY_MODE);
  const sourceIsView = isDocumentView(source);
  const opened = isDocumentView(source)
    ? { ok: true as const, view: source }
    : openHeadlessDocument(source);
  if (!opened.ok) return opened;

  const initialView = opened.view;
  const reuseAcrossRevisions = options.reuseAcrossRevisions ?? sourceIsView;
  const timeoutMs = normalizedResourceTimeout(options.resourceTimeoutMs);
  const initialMeasurer = options.measurer ?? createFixedMeasurer();
  const producer =
    options.producer ?? (options.measurer ? 'host-export-measurer' : 'export-fixed-measurer');
  // Byte exports are immutable one-shot snapshots. Their break cache exists only to share work
  // inside the pass, so release entries after placement instead of retaining them across revisions.
  const initialParagraphCache = createParagraphLayoutCache<never>({
    retainAcrossPasses: reuseAcrossRevisions,
  });
  let resourceEpoch = 0;
  const waiters = new Set<() => void>();
  const resourcesChanged = (): void => {
    resourceEpoch += 1;
    for (const resolve of waiters) resolve();
    waiters.clear();
  };
  const initialDrawingBundle = createInlineDrawingLayoutBundle({
    session: initialView,
    decodePort:
      options.imageDecodePort ??
      createNodeImageDecodePort(
        options.convertPreservedImage
          ? { convertPreserved: options.convertPreservedImage }
          : undefined
      ),
    onResourcesChanged: resourcesChanged,
  });
  let activeState: {
    readonly view: HeadlessDocumentView;
    readonly measurer: TextMeasurer;
    readonly paragraphCache: ReturnType<typeof createParagraphLayoutCache<never>>;
    readonly sessions: Map<RevisionDisplayMode, ReturnType<typeof createLayoutSession>>;
    readonly completed: Map<
      RevisionDisplayMode,
      {
        readonly revision: number;
        readonly pkg: ReturnType<HeadlessDocumentView['currentPackage']>;
        readonly internal: SemanticLayout;
        readonly published: ExportSemanticLayout;
      }
    >;
    readonly inFlight: Map<RevisionDisplayMode, Promise<ExportSemanticLayout>>;
    readonly styles: ReturnType<typeof createDocumentStyleDependencies>;
    readonly fieldLinks: Map<
      RevisionDisplayMode,
      {
        readonly revision: number;
        readonly pkg: ReturnType<HeadlessDocumentView['currentPackage']>;
        readonly registry: ReturnType<typeof createFieldLinkRegistry>;
      }
    >;
    readonly links: ReturnType<typeof createDocumentLinkProjectors>;
    readonly drawingBundle: ReturnType<typeof createInlineDrawingLayoutBundle>;
    readonly furniture: Map<RevisionDisplayMode, ReturnType<typeof createDocumentFurnitureSource>>;
  } | null = {
    view: initialView,
    measurer: initialMeasurer,
    paragraphCache: initialParagraphCache,
    sessions: new Map(),
    completed: new Map(),
    inFlight: new Map(),
    styles: createDocumentStyleDependencies(initialView),
    fieldLinks: new Map(),
    links: createDocumentLinkProjectors(initialView),
    drawingBundle: initialDrawingBundle,
    furniture: new Map(),
  };
  const resourceAbort = new AbortController();
  const callerSignal = options.signal;
  let callerAborted = false;
  const unavailableError = (): ExportResourceError =>
    callerAborted
      ? new ExportResourceError('aborted', 'Export resource settlement was aborted')
      : new ExportResourceError('disposed', 'Export session has been disposed');
  const abortFromCaller = (): void => {
    callerAborted = true;
    disposeSession();
  };
  function disposeSession(): void {
    const state = activeState;
    if (!state) return;
    activeState = null;
    callerSignal?.removeEventListener('abort', abortFromCaller);
    resourceAbort.abort(callerSignal?.reason);
    state.drawingBundle.dispose();
    state.paragraphCache.clear();
    for (const completed of state.completed.values()) {
      releasePageFieldProjectionState(completed.internal);
      releaseOverflowPageShellState(completed.internal);
    }
    for (const fieldLinks of state.fieldLinks.values()) fieldLinks.registry.clear();
    state.fieldLinks.clear();
    state.completed.clear();
    state.inFlight.clear();
    state.furniture.clear();
    state.sessions.clear();
    resourcesChanged();
  }
  callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  if (callerSignal?.aborted) abortFromCaller();
  const assertActive = (): void => {
    if (!activeState) throw unavailableError();
    if (resourceAbort.signal.aborted) {
      throw new ExportResourceError('aborted', 'Export resource settlement was aborted');
    }
  };

  const waitForResourceChange = (
    observedEpoch: number,
    observedRevision: number,
    observedPackage: ReturnType<HeadlessDocumentView['currentPackage']>,
    deadline: number
  ): Promise<void> => {
    if (
      resourceEpoch !== observedEpoch ||
      activeState?.view.packageRevision() !== observedRevision ||
      activeState?.view.currentPackage() !== observedPackage
    ) {
      return Promise.resolve();
    }
    assertActive();
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (error?: ExportResourceError): void => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        waiters.delete(changed);
        resourceAbort.signal.removeEventListener('abort', aborted);
        if (error) reject(error);
        else resolve();
      };
      const changed = (): void => finish();
      const aborted = (): void =>
        finish(new ExportResourceError('aborted', 'Export resource settlement was aborted'));
      const pollRevision = (): void => {
        if (
          activeState?.view.packageRevision() !== observedRevision ||
          activeState?.view.currentPackage() !== observedPackage
        ) {
          finish();
          return;
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          finish(
            new ExportResourceError(
              'timedOut',
              `Image resources did not settle within ${timeoutMs}ms`
            )
          );
          return;
        }
        timer = setTimeout(pollRevision, Math.min(REVISION_POLL_INTERVAL_MS, remaining));
      };
      waiters.add(changed);
      resourceAbort.signal.addEventListener('abort', aborted, { once: true });
      // Close the registration window. A custom live view or host resource callback can advance
      // either source between the outer precheck and waiter installation.
      if (
        resourceEpoch !== observedEpoch ||
        activeState?.view.packageRevision() !== observedRevision ||
        activeState?.view.currentPackage() !== observedPackage
      ) {
        finish();
        return;
      }
      pollRevision();
    });
  };

  const runLayout = async (
    mode: RevisionDisplayMode,
    revisionRestarts = 0,
    absoluteDeadline = Date.now() + timeoutMs
  ): Promise<ExportSemanticLayout> => {
    assertActive();
    if (Date.now() >= absoluteDeadline) {
      throw new ExportResourceError(
        'timedOut',
        `Export layout did not stabilize within ${timeoutMs}ms`
      );
    }
    const state = activeState!;
    const deadline = absoluteDeadline;
    const revision = state.view.packageRevision();
    const pkg = state.view.currentPackage();
    const cached = state.completed.get(mode);
    if (cached && cached.revision === revision && cached.pkg === pkg) return cached.published;

    // One rule for every drift check below: a live view that moved mid-pass restarts the
    // whole layout against the new package, up to the shared convergence bound.
    const restartOnRevisionDrift = (): Promise<ExportSemanticLayout> | null => {
      if (state.view.packageRevision() === revision && state.view.currentPackage() === pkg) {
        return null;
      }
      if (revisionRestarts >= MAX_CONVERGENCE_PASSES - 1) {
        throw new ExportResourceError(
          'nonConvergent',
          'Document revision did not stabilize during export layout'
        );
      }
      return runLayout(mode, revisionRestarts + 1, deadline);
    };

    let fieldLinkState = state.fieldLinks.get(mode);
    if (!fieldLinkState || fieldLinkState.revision !== revision || fieldLinkState.pkg !== pkg) {
      // Cached paragraph lines can survive a live-view revision. Keep the registry's monotonic
      // id counter alive with them: recycling `field-hyperlink:1` could otherwise give an
      // unchanged cached link and a newly laid-out link the same semantic identity.
      const registry = fieldLinkState?.registry ?? createFieldLinkRegistry();
      registry.clear();
      fieldLinkState = { revision, pkg, registry };
      state.fieldLinks.set(mode, fieldLinkState);
      // Furniture captures its mode/revision registry. A live-view edit must not reuse it.
      state.furniture.delete(mode);
    }
    const fieldLinks = fieldLinkState.registry;

    const session = state.sessions.get(mode) ?? createLayoutSession();
    state.sessions.set(mode, session);
    let source = state.furniture.get(mode);
    if (!source) {
      source = createDocumentFurnitureSource({
        view: state.view,
        measurer: state.measurer,
        producer,
        cache: state.paragraphCache,
        styleCascade: state.styles.styleCascade,
        numberingIndex: state.styles.numberingIndex,
        defaultTabStopPt: state.styles.defaultTabStopPt,
        displayMode: mode,
        revisionAuthorFilter: undefined,
        inlineDrawingLayoutForPart: (partName) => state.drawingBundle.contextForPart(partName),
        drawingLayoutTokenForPart: (partName) => state.drawingBundle.cacheTokenForPart(partName),
        drawingTokenForParagraphForPart: (partName, paragraph) =>
          state.drawingBundle.drawingTokenForParagraph(paragraph, partName),
        linkProjectors: state.links,
        projectFieldLink: (spec) => fieldLinks.project(spec),
      } satisfies CreateDocumentFurnitureSourceOptions &
        Record<keyof CreateDocumentFurnitureSourceOptions, unknown>);
      state.furniture.set(mode, source);
    }

    for (let pass = 0; pass < MAX_CONVERGENCE_PASSES; pass += 1) {
      const observedEpoch = resourceEpoch;
      state.drawingBundle.sync(state.view);
      const restartedBeforeLayout = restartOnRevisionDrift();
      if (restartedBeforeLayout) return restartedBeforeLayout;
      const layout = layoutDocumentView({
        view: state.view,
        revision: state.view.packageRevision(),
        measurer: state.measurer,
        cache: state.paragraphCache,
        session,
        producer,
        styleCascade: state.styles.styleCascade,
        defaultTabStopPt: state.styles.defaultTabStopPt,
        numberingIndex: state.styles.numberingIndex,
        furniture: source,
        compatibilityMode: state.styles.compatibilityMode,
        linkProjectors: state.links,
        projectFieldLink: (spec) => fieldLinks.project(spec),
        inlineDrawingLayout: state.drawingBundle.bodyContext,
        inlineDrawingLayoutForPart: (partName) => state.drawingBundle.contextForPart(partName),
        drawingTokenForParagraph: (paragraph) =>
          state.drawingBundle.drawingTokenForParagraph(paragraph, state.view.part().name),
        drawingTokenForParagraphForPart: (partName, paragraph) =>
          state.drawingBundle.drawingTokenForParagraph(paragraph, partName),
        drawingLayoutEpoch: state.drawingBundle.cacheTokenForPart(state.view.part().name),
        drawingLayoutEpochForPart: (partName) => state.drawingBundle.cacheTokenForPart(partName),
        displayMode: mode,
        revisionAuthorFilter: undefined,
      } satisfies LayoutDocumentViewOptions & Record<keyof LayoutDocumentViewOptions, unknown>);
      if (!layoutHasPendingImages(layout)) {
        const restartedBeforePublish = restartOnRevisionDrift();
        if (restartedBeforePublish) return restartedBeforePublish;
        if (!reuseAcrossRevisions) {
          // Byte exports cannot relayout against a new revision. Drop construction-only caches
          // before review projection and immutable publication so large serverless exports do
          // not hold construction state while walking the package and published record graph.
          releasePageFieldProjectionState(layout);
          releaseOverflowPageShellState(layout);
          state.paragraphCache.clear();
          state.sessions.delete(mode);
          state.furniture.delete(mode);
        }
        const projected = projectReviewArtifacts(layout, pkg);
        const reviewArtifacts =
          projected.length === 0
            ? EMPTY_REVIEW_ARTIFACTS
            : Object.freeze(attachReviewArtifactGeometry(layout, projected));
        const resources = attachExportDocumentResources(state.view, layout);
        const enrichedLayout: ExportSemanticLayout = {
          ...layout,
          ...resources,
          reviewArtifacts,
        };
        const published = publishImmutableSemanticLayout(enrichedLayout);
        state.completed.set(mode, { revision, pkg, internal: layout, published });
        return published;
      }
      // One pass discovers every image referenced by the laid-out stories. Await the whole
      // discovered batch before laying the document out again; relayout on each individual
      // decode made 65 valid staggered images hit the 64-pass convergence guard.
      let settlementEpoch = observedEpoch;
      while (state.drawingBundle.pendingResourceCount() > 0) {
        await waitForResourceChange(settlementEpoch, revision, pkg, deadline);
        settlementEpoch = resourceEpoch;
        assertActive();
        const restartedDuringWait = restartOnRevisionDrift();
        if (restartedDuringWait) return restartedDuringWait;
      }
      assertActive();
      const restartedAfterWait = restartOnRevisionDrift();
      if (restartedAfterWait) return restartedAfterWait;
    }
    throw new ExportResourceError(
      'nonConvergent',
      `Image resources did not reach quiescence after ${MAX_CONVERGENCE_PASSES} layout passes`
    );
  };

  const layoutFor = (mode: RevisionDisplayMode): Promise<ExportSemanticLayout> => {
    let normalizedMode: RevisionDisplayMode;
    try {
      normalizedMode = normalizedDisplayMode(mode);
    } catch (error) {
      return Promise.reject(error);
    }
    if (!activeState) {
      return Promise.reject(unavailableError());
    }
    const state = activeState;
    const existing = state.inFlight.get(normalizedMode);
    if (existing) return existing;
    // Layout engines fail closed when authored geometry cannot satisfy a bounded page. Keep those
    // internal invariant types behind one exporter-neutral error contract so every current and
    // future exporter can handle untrusted documents without importing layout implementation
    // details. Preserve session lifecycle/resource failures and retain the original error as the
    // standard non-enumerable `cause` for diagnostics.
    const promise = runLayout(normalizedMode)
      .catch((error: unknown) => {
        throw normalizedLayoutFailure(error);
      })
      .finally(() => state.inFlight.delete(normalizedMode));
    state.inFlight.set(normalizedMode, promise);
    return promise;
  };

  const exportSession: ExportSession = {
    layout: () => layoutFor(displayMode),
    layoutFor,
    validatedImageBytes(drawing) {
      const state = activeState;
      if (!state || drawing.resource.kind !== 'ready') return null;
      return (
        state.drawingBundle
          .mintValidatedBytes(drawing.resource.validatedHandle, drawing.resource.contentId)
          ?.slice() ?? null
      );
    },
    dispose: disposeSession,
  };
  return { ok: true, session: exportSession };
}
