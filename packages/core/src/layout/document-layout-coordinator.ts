// Canonical document-view composition root shared by browser and exporter hosts.

import type { HeadlessDocumentView, OoxmlNode } from '@docx-editor.dev/core/store';
import type { InlineDrawingLayoutContext } from './drawing-layout.ts';
import type { DocumentLinkProjectors } from './document-link-projector.ts';
import type { FieldLinkProjector } from './field-pieces.ts';
import {
  createDocumentNotesInput,
  type CreateDocumentNotesInputOptions,
} from './document-notes-input.ts';
import type { DocumentFurnitureSource } from './document-furniture-source.ts';
import type { LayoutSession } from './layout-session.ts';
import type { NumberingIndex } from './numbering-index.ts';
import type { ParagraphLayoutCache } from './layout-cache.ts';
import type { PendingLine } from './pending-line.ts';
import type { RevisionAuthorFilter, RevisionDisplayMode } from './revision-projection.ts';
import { layoutSemanticDocument, type SemanticLayoutOptions } from './semantic-layout.ts';
import type { SemanticLayout, TextMeasurer } from './semantic-records.ts';
import type { StyleCascadeTable } from './style-cascade.ts';

type SemanticLayoutOptionRole =
  | 'document-coordinator'
  | 'low-level-test-override'
  | 'layout-internal';

/**
 * Evolution ratchet for the low-level layout call.
 *
 * Adding an option to `SemanticLayoutOptions` must classify it here. Document hosts then have
 * one composition root to update instead of independent browser and exporter call sites.
 */
export const SEMANTIC_LAYOUT_OPTION_ROLES = Object.freeze({
  geometry: 'low-level-test-override',
  measurer: 'document-coordinator',
  cache: 'document-coordinator',
  retainKeys: 'layout-internal',
  drawingLayoutEpoch: 'document-coordinator',
  projectionEpoch: 'document-coordinator',
  producer: 'document-coordinator',
  session: 'document-coordinator',
  furniture: 'document-coordinator',
  displayMode: 'document-coordinator',
  revisionAuthorFilter: 'document-coordinator',
  sectionFurniture: 'document-coordinator',
  sectionColumns: 'layout-internal',
  styleCascade: 'document-coordinator',
  numberingIndex: 'document-coordinator',
  listItems: 'layout-internal',
  defaultTabStopPt: 'document-coordinator',
  compatibilityMode: 'document-coordinator',
  projectLink: 'document-coordinator',
  projectFieldLink: 'document-coordinator',
  documentProperties: 'document-coordinator',
  notes: 'document-coordinator',
  pageBottomReserves: 'layout-internal',
  noteMarks: 'layout-internal',
  inlineDrawingLayout: 'document-coordinator',
  drawingTokenForParagraph: 'document-coordinator',
  projectionTokenForParagraph: 'document-coordinator',
  projectionTokenForTable: 'document-coordinator',
  drawingLayoutToken: 'layout-internal',
  drawingExclusionPass: 'layout-internal',
  drawingExclusionConverged: 'layout-internal',
  drawingExclusionZonesByPage: 'layout-internal',
  drawingSourceOrder: 'layout-internal',
  tocFieldChromeParagraphIds: 'layout-internal',
  emptyTocPlaceholderParagraphIds: 'layout-internal',
  emptyTocSuppressedResultParagraphIds: 'layout-internal',
} satisfies Readonly<Record<keyof SemanticLayoutOptions, SemanticLayoutOptionRole>>);

type SemanticOptionsWithRole<Role extends SemanticLayoutOptionRole> = {
  [Key in keyof typeof SEMANTIC_LAYOUT_OPTION_ROLES]: (typeof SEMANTIC_LAYOUT_OPTION_ROLES)[Key] extends Role
    ? Key
    : never;
}[keyof typeof SEMANTIC_LAYOUT_OPTION_ROLES];

type DocumentCoordinatedSemanticOption = SemanticOptionsWithRole<'document-coordinator'>;

/** Inputs owned by the shared document composition root. @internal */
export interface LayoutDocumentViewOptions {
  readonly view: HeadlessDocumentView;
  readonly revision: number;
  readonly measurer: TextMeasurer;
  readonly cache: ParagraphLayoutCache<readonly PendingLine[]>;
  readonly session: LayoutSession;
  readonly producer: string;
  readonly styleCascade?: () => StyleCascadeTable | undefined;
  readonly numberingIndex?: () => NumberingIndex;
  readonly defaultTabStopPt?: () => number;
  readonly compatibilityMode?: () => number | undefined;
  readonly furniture: DocumentFurnitureSource;
  /** Body/story projection paired with every cache identity it requires. */
  readonly linkProjectors: DocumentLinkProjectors;
  readonly projectFieldLink?: FieldLinkProjector;
  readonly inlineDrawingLayout?: InlineDrawingLayoutContext;
  readonly inlineDrawingLayoutForPart?: (
    partName: string
  ) => InlineDrawingLayoutContext | undefined;
  readonly drawingTokenForParagraph?: (paragraph: OoxmlNode) => string;
  readonly drawingTokenForParagraphForPart?: (partName: string, paragraph: OoxmlNode) => string;
  readonly drawingLayoutEpoch?: string;
  readonly drawingLayoutEpochForPart?: (partName: string) => string;
  readonly displayMode?: RevisionDisplayMode;
  readonly revisionAuthorFilter?: RevisionAuthorFilter;
}

type LayoutDocumentViewSink = 'notes' | 'semantic-layout' | 'both';

/** Every coordinator input must declare—and then enter—each sink that consumes it. */
const _LAYOUT_DOCUMENT_VIEW_OPTION_SINKS = {
  view: 'both',
  revision: 'semantic-layout',
  measurer: 'both',
  cache: 'both',
  session: 'semantic-layout',
  producer: 'both',
  styleCascade: 'both',
  numberingIndex: 'both',
  defaultTabStopPt: 'both',
  compatibilityMode: 'semantic-layout',
  furniture: 'semantic-layout',
  linkProjectors: 'both',
  projectFieldLink: 'both',
  inlineDrawingLayout: 'semantic-layout',
  inlineDrawingLayoutForPart: 'notes',
  drawingTokenForParagraph: 'semantic-layout',
  drawingTokenForParagraphForPart: 'notes',
  drawingLayoutEpoch: 'semantic-layout',
  drawingLayoutEpochForPart: 'notes',
  displayMode: 'both',
  revisionAuthorFilter: 'both',
} as const satisfies Readonly<Record<keyof LayoutDocumentViewOptions, LayoutDocumentViewSink>>;

type CoordinatorInputsFor<Sink extends Exclude<LayoutDocumentViewSink, 'both'>> = {
  [Key in keyof typeof _LAYOUT_DOCUMENT_VIEW_OPTION_SINKS]: (typeof _LAYOUT_DOCUMENT_VIEW_OPTION_SINKS)[Key] extends
    | Sink
    | 'both'
    ? Key
    : never;
}[keyof typeof _LAYOUT_DOCUMENT_VIEW_OPTION_SINKS];

/**
 * Lay out one neutral document view with the complete browser/exporter dependency set.
 *
 * Resource scheduling remains host-specific; semantic composition does not.
 * @internal
 */
export function layoutDocumentView(options: LayoutDocumentViewOptions): SemanticLayout {
  const defaultTabStopPt = options.defaultTabStopPt?.();
  const bodyPartName = options.view.part().name;
  const noteOptions = {
    view: options.view,
    measurer: options.measurer,
    producer: options.producer,
    cache: options.cache,
    styleCascade: options.styleCascade,
    numberingIndex: options.numberingIndex,
    defaultTabStopPt,
    inlineDrawingLayoutForPart: options.inlineDrawingLayoutForPart,
    drawingTokenForParagraphForPart: options.drawingTokenForParagraphForPart,
    drawingLayoutEpochForPart: options.drawingLayoutEpochForPart,
    linkProjectors: options.linkProjectors,
    projectFieldLink: options.projectFieldLink,
    displayMode: options.displayMode,
    revisionAuthorFilter: options.revisionAuthorFilter,
  } satisfies CreateDocumentNotesInputOptions &
    Record<keyof CreateDocumentNotesInputOptions, unknown> &
    Record<CoordinatorInputsFor<'notes'>, unknown>;
  const notes = createDocumentNotesInput(noteOptions);
  const semanticInputs = {
    view: options.view,
    revision: options.revision,
    measurer: options.measurer,
    cache: options.cache,
    session: options.session,
    producer: options.producer,
    styleCascade: options.styleCascade,
    numberingIndex: options.numberingIndex,
    defaultTabStopPt,
    furniture: options.furniture,
    compatibilityMode: options.compatibilityMode,
    linkProjectors: options.linkProjectors,
    projectFieldLink: options.projectFieldLink,
    inlineDrawingLayout: options.inlineDrawingLayout,
    drawingTokenForParagraph: options.drawingTokenForParagraph,
    drawingLayoutEpoch: options.drawingLayoutEpoch,
    displayMode: options.displayMode,
    revisionAuthorFilter: options.revisionAuthorFilter,
  } satisfies Record<CoordinatorInputsFor<'semantic-layout'>, unknown>;
  const semanticOptions = {
    measurer: semanticInputs.measurer,
    cache: semanticInputs.cache,
    session: semanticInputs.session,
    producer: semanticInputs.producer,
    styleCascade: semanticInputs.styleCascade?.(),
    defaultTabStopPt: semanticInputs.defaultTabStopPt,
    compatibilityMode: semanticInputs.compatibilityMode?.(),
    numberingIndex: semanticInputs.numberingIndex?.(),
    sectionFurniture: semanticInputs.furniture.sectionFurniture(),
    furniture: semanticInputs.furniture.furniture(),
    projectLink: semanticInputs.linkProjectors.projectLink,
    projectFieldLink: semanticInputs.projectFieldLink,
    documentProperties: semanticInputs.view.documentProperties(),
    inlineDrawingLayout: semanticInputs.inlineDrawingLayout,
    drawingTokenForParagraph: semanticInputs.drawingTokenForParagraph,
    drawingLayoutEpoch: semanticInputs.drawingLayoutEpoch,
    projectionTokenForParagraph: (paragraph: OoxmlNode) =>
      semanticInputs.linkProjectors.tokenForParagraphForPart(bodyPartName, paragraph),
    projectionTokenForTable: (table: OoxmlNode) =>
      semanticInputs.linkProjectors.tokenForTableForPart(bodyPartName, table),
    projectionEpoch: semanticInputs.linkProjectors.epochForPart(bodyPartName),
    notes,
    displayMode: semanticInputs.displayMode,
    revisionAuthorFilter: semanticInputs.revisionAuthorFilter,
  } satisfies SemanticLayoutOptions & Record<DocumentCoordinatedSemanticOption, unknown>;
  return layoutSemanticDocument(
    semanticInputs.view.part(),
    semanticInputs.revision,
    semanticOptions
  );
}
