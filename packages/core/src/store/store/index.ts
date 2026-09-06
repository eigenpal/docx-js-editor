// Semantic document store — the canonical-tree lane (document-engine section 4).
// The legacy PackageModel store (DocOps, DocumentStore, history periphery) was deleted
// with the legacy editor pipeline; `TreeDocumentStore` over the ordered OOXML tree is
// the only store.
export {
  ACCEPTED_PARAGRAPH_PROPERTIES,
  ACCEPTED_RUN_PROPERTIES,
  applyTreeOp,
  inlineControlEndingAt,
  inlineControlStartingAt,
  paragraphOffsetIndex,
  paragraphTextOf,
  segmentsOf,
  validateTreeOp,
  TREE_DOC_OP_KINDS,
  type ImpactClass,
  type InlineControlSpan,
  type OffsetSpan,
  type OoxmlProperty,
  type TabStopWrite,
  type ParagraphOffsetIndex,
  type Segment,
  type TreeDocOp,
  type TreeDocOpKind,
  type DrawingTreeDocOp,
  type TreeOpEffect,
  type TreeOpRejection,
  type TreeOpResult,
} from './tree-ops.ts';
export {
  extractFragmentPackage,
  type FragmentCoverage,
  type FragmentExtractRejection,
  type FragmentExtractResult,
} from './clipboard-fragment-extract.ts';
export {
  mergeFragmentIntoPackage,
  type FragmentMergeRejection,
  type FragmentMergeResult,
} from './clipboard-fragment-merge.ts';
export {
  MAX_FRAGMENT_DECODED_BYTES,
  applyFragmentPaste,
  type FragmentPasteInput,
  type FragmentPasteResult,
} from './tree-package-fragment.ts';
export {
  TreeDocumentStore,
  type SelectionMark,
  type TransactionContext as TreeTransactionContext,
  type TransactOptions as TreeTransactOptions,
  type TransactResult as TreeTransactResult,
  type TreeDocumentStoreOptions,
  type TreeModelChange,
  type TreeStoryRef,
} from './tree-store.ts';
export {
  DEFAULT_MAX_EDITABLE_STORY_PARTS,
  TreePackageStore,
  type PackageTransactResult,
  type StoryResolveResult,
  type StoryScope,
  type StoryTargetRejection,
  type TreePackageStoreOptions,
} from './tree-package-store.ts';
export type { RemotePackageAttribution } from './tree-package-remote.ts';
export {
  addPackageComment,
  deletePackageComments,
  setPackageCommentResolved,
  type PackageCommentDelete,
} from './comment-package-write.ts';
export { insertPackageCustomNode, removePackageCustomNode } from './custom-node-package-write.ts';
export { nextCommentId } from './comment-id-mint.ts';
export {
  addComment,
  setCommentResolved,
  commentPartNameOf,
  commentsExtendedPartNameOf,
  hasCommentPart,
  type AddCommentRequest,
  type AddCommentResult,
  type CommentAnchorRequest,
  type SetCommentResolvedResult,
} from './comment-writes.ts';
export {
  MAX_CUSTOM_NODE_LABEL_LENGTH,
  MAX_CUSTOM_NODE_PAYLOAD_LENGTH,
  customNodePayloadsByControl,
  customNodePayloadsOf,
  insertCustomNodeWrite,
  removeCustomNodeWrite,
  sweepCustomNodePayloads,
  type CustomNodePayloadRead,
  type CustomNodePayloadWrite,
  type CustomNodeSweepOutcome,
  type CustomNodeSweepResult,
  type CustomNodeWriteRejection,
  type CustomNodeWriteResult,
  type InsertCustomNodeWrite,
} from './custom-node-writes.ts';
export {
  AUTHORABLE_PARAGRAPH_PROPERTIES,
  AUTHORABLE_RUN_PROPERTIES,
  authoredProperties,
  directParagraphMarkProperties,
  directParagraphProperties,
  formatOwnedRunIds,
  formattableRanges,
  isAuthorableRunProperty,
  mergedFontProperty,
  mergedMultiSettingProperty,
  mergedParagraphMarkProperties,
  mergedProperties,
  propertyContainer,
  runAddressRanges,
  runPropertyEdits,
  runsCovering,
  type RunPropertyEdit,
} from './direct-properties.ts';
export {
  DEFAULT_FORMATTING_DISPLAY_MODE,
  type FormattingDisplayMode,
  type FormattingRevisionAuthorFilter,
} from './formattable-runs.ts';
export { collectRevisionSites, type RevisionAddress } from './tree-op-revisions.ts';
export {
  commentAnchorsOfStory,
  commentsOfPart,
  threadStateOfPart,
  W15_NAMESPACE_URI,
  type CommentAnchor,
  type CommentPosition,
  type CommentRecord,
  type CommentThreadState,
} from './comment-reads.ts';
export {
  collectReviewItems,
  commentBodyText,
  commentInitials,
  commentItemsOf,
  deepParagraphOrderOfPart,
  linkRevisionReplies,
  locateSites,
  paragraphOrderOfPart,
  revisionItemsOf,
  type LinkableReviewItem,
} from './review-reads.ts';
export {
  firstReviewRange,
  reviewItemKey,
  reviewItemRanges,
  type ReviewCommentItem,
  type ReviewCustomItem,
  type ReviewItem,
  type ReviewModelInput,
  type ReviewPosition,
  type ReviewRange,
  type ReviewRevisionItem,
  type ReviewRevisionKind,
} from './review-items.ts';
export {
  SEARCH_MATCH_LIMIT,
  SEARCH_QUERY_MAX,
  findOccurrences,
  foldCase,
  isSearchableQuery,
  isWholeWord,
  type TextMatchOptions,
  type TextOccurrence,
  type TextOccurrences,
} from './text-match.ts';
export {
  drawingOpImpact,
  isDrawingTreeDocOp,
  validateDrawingOp,
  wrapTargetToAnchorSpec,
} from './tree-op-drawings.ts';
export {
  allocateDrawingPropertyId,
  withBinaryPart,
  withEmbeddedImage,
  withoutUnreferencedImagePart,
  type DrawingPropertyIdResult,
} from '../package/drawing-package-edit.ts';
export {
  IMAGE_WRAP_TARGETS,
  projectDrawing,
  type DrawingKind,
  type DrawingLocks,
  type DrawingPositionInput,
  type ImageWrapTarget,
  type SourceCrop,
} from '../package/drawing-projection.ts';
export type { ImageResourceState, SupportedImageMime } from '../package/image-resources.ts';

export { textFormFieldsOf, type TextFormFieldRange } from './text-form-fields.ts';

export { formsProtectionEnabled, sectionProtectsForms } from './tree-op-content-controls.ts';

export type { InsertTextOp, DeleteTextOp } from './text-edit-op-types.ts';
export type { SetTextFormFieldDefaultOp } from './text-form-fields.ts';
