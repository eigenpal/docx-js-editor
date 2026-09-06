import { textFormFieldForEdit } from './text-form-fields.ts';
import { coveredTextFormDefinitionRefusal } from './text-form-field-deletion.ts';
import { validateTextFormFieldDefault } from './tree-op-field-results.ts';
// Pre-application validation for tree ops (tree-ops seam).
//
// `validateTreeOp` runs BEFORE any tree work so a rejected op leaves the tree, revision
// and indexes exactly as they were. The op vocabulary lives in tree-op-types.ts; the
// segment model in tree-op-segments.ts; section addressing in tree-op-section-address.ts.
// Application lives in tree-op-apply.ts; public entry is tree-ops.ts.

import type { OoxmlNode, OoxmlParagraphNode, OoxmlPart } from '../package/ooxml-tree.ts';
import { findNode } from '../package/ooxml-edit.ts';
import { OFFICE_MATH_NAMESPACE_URI, parseLinearMath } from '../package/omml-equation.ts';
import { isValidXmlText } from '../package/sinks.ts';
import { isDangerousKey } from '../package/safe-record.ts';
import { isAuthorableDataBinding } from '../package/custom-node-payloads.ts';
import { validateDeleteBlock } from './tree-op-blocks.ts';
import {
  deleteBlockTouchesContentRestriction,
  holds,
  rejectContentEdit,
  nodeTouchesContentRestriction,
  validateRemoveContentControl,
  validateSetContentControlValue,
} from './tree-op-validate-controls.ts';
import {
  INSERTABLE_CONTENT_CONTROL_TYPES,
  contentControlBindingRefusal,
  contentControlLockRefusal,
  isWritableContentControlMetadata,
} from './tree-op-content-controls.ts';
import {
  effectiveContentLockAt,
  effectiveLockOf,
  innermostContentControlAround,
  isBoundAt,
  isTemporaryControl,
  paragraphPropertiesNodeOf,
} from './tree-op-nodes.ts';
import { scopedRevisionRoot } from './tree-op-revision-scope.ts';
import {
  validateTableRowOp,
  validateTableColumnOp,
  validateTableResizeOp,
  validateTableCellPropertyOp,
} from './tree-op-tables.ts';
import {
  bodyNodeOf,
  governingSectionOwnerId,
  isTableNested,
  metricsOfSection,
  plannedSectionDimensions,
  sectionBreakTypeOf,
  sectionChild,
  targetSectionNodes,
} from './tree-op-section-address.ts';
import { rangePartiallyOverlapsDrawingAtom } from '../package/drawing-projection.ts';
import { isDrawingTreeDocOp, validateDrawingOp } from './tree-op-drawings.ts';
import { validateInsertFragment } from './tree-op-fragment.ts';
import {
  indivisibleAt,
  isParagraph,
  paragraphLength,
  paragraphOffsetIndex,
  segmentsOf,
  splitsSurrogate,
} from './tree-op-segments.ts';
import {
  validateInsertToc,
  validateReplaceTocResult,
  validateRewriteTocPageNumbers,
} from './tree-op-toc.ts';
import { validateRefreshFieldResults } from './tree-op-field-results.ts';
import { validateInsertTable } from './tree-op-insert-table.ts';
import { validateReplaceStoryBlocks } from './tree-op-story-replace.ts';
import {
  ACCEPTED_PARAGRAPH_PROPERTIES,
  ACCEPTED_RUN_PROPERTIES,
  TREE_DOC_OP_KINDS,
  invalidRevisionAttribution,
  type OoxmlProperty,
  type TreeDocOp,
  type TreeOpRejection,
} from './tree-op-types.ts';

const RUN_PROPERTY_SET: ReadonlySet<string> = new Set(ACCEPTED_RUN_PROPERTIES);
const CONTENT_CONTROL_LOCKS: ReadonlySet<string> = new Set([
  'unlocked',
  'sdtLocked',
  'contentLocked',
  'sdtContentLocked',
]);
const PARAGRAPH_PROPERTY_SET: ReadonlySet<string> = new Set(ACCEPTED_PARAGRAPH_PROPERTIES);

function validateProperties(
  properties: readonly OoxmlProperty[],
  accepted: ReadonlySet<string>
): TreeOpRejection | null {
  for (const property of properties) {
    if (!accepted.has(property.localName)) return 'unsupported-property';
    for (const [name, value] of Object.entries(property.attributes ?? {})) {
      // Attribute names and values are written straight into XML on save, so both are
      // checked here rather than at the sink — a rejected op must never reach the tree.
      if (!/^[A-Za-z_][\w.-]*$/.test(name)) return 'invalid-property-value';
      if (typeof value !== 'string' || !isValidXmlText(value)) return 'invalid-property-value';
    }
  }
  return null;
}

/** Longest `r:id`, `w:anchor` or `w:tooltip` an op may write. */
const MAX_HYPERLINK_ATTRIBUTE_LENGTH = 512;

/** Longest `w:pStyle` value an op may write — the same ceiling the styles reader applies. */
const MAX_STYLE_ID_LENGTH = 128;

/** Control characters, which no attribute value may carry into the saved XML. */
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/;

/**
 * A style id an op may name.
 *
 * The layout lane refuses the same three things over `styles.xml` — over-long, control
 * bearing, or a dangerous object key — and cannot be borrowed here, because `store` does
 * not depend on `layout`. Those three must not diverge: a value one side accepts and the
 * other drops writes a `w:pStyle` that resolves nowhere, so the paragraph reports a style
 * it does not render in. The fourth, `isValidXmlText`, is the store's alone and is meant to
 * be: this side is the one that serializes, and a caller hand-building a `TreeDocOp` is not
 * bounded by what an XML parser could have produced.
 */
function isStyleId(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_STYLE_ID_LENGTH &&
    !CONTROL_CHARACTERS.test(value) &&
    !isDangerousKey(value) &&
    isValidXmlText(value)
  );
}

function rangePartiallyOverlapsDrawing(
  paragraph: OoxmlParagraphNode,
  start: number,
  end: number
): boolean {
  return rangePartiallyOverlapsDrawingAtom(segmentsOf(paragraph), start, end);
}

/** Whether `[start, end)` overlaps any text already inside a `w:hyperlink`. */
function rangeTouchesHyperlink(paragraph: OoxmlParagraphNode, start: number, end: number): boolean {
  const segments = segmentsOf(paragraph);
  const linked = new Set<string>();
  const collect = (node: OoxmlNode, inside: boolean): void => {
    if (node.kind === 'textValue') return;
    const within = inside || node.kind === 'hyperlink';
    if (within && node.kind === 'run') linked.add(node.id);
    for (const child of node.children) collect(child, within);
  };
  for (const child of paragraph.children) collect(child, false);
  if (linked.size === 0) return false;
  return segments.some(
    (segment) => linked.has(segment.runId) && segment.start < end && segment.end > start
  );
}

/**
 * The target half of an insert or a retarget: EXACTLY ONE of relationship or anchor, and
 * every value legal in XML.
 *
 * Both at once is refused rather than resolved by precedence. In a FILE that pair means "a
 * bookmark inside another document", which the read side honours; as an authored op it means
 * the caller does not know which it wants, and admitting it would write a link whose
 * behaviour depends on a resolution rule the caller never saw.
 */
function validateHyperlinkTarget(op: {
  readonly relationshipId?: string;
  readonly anchor?: string;
  readonly tooltip?: string;
}): TreeOpRejection | null {
  const hasRelationship = op.relationshipId !== undefined;
  const hasAnchor = op.anchor !== undefined;
  if (hasRelationship === hasAnchor) return 'invalid-property-value';
  for (const value of [op.relationshipId, op.anchor, op.tooltip]) {
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length === 0) return 'invalid-property-value';
    if (value.length > MAX_HYPERLINK_ATTRIBUTE_LENGTH) return 'invalid-property-value';
    if (!isValidXmlText(value)) return 'invalid-property-value';
  }
  return null;
}

/**
 * Whether the control an insertion names is one it could actually be writing into.
 *
 * Three things have to hold, and each of them is a way in if it does not. The name must resolve
 * to a TYPED content control — a paragraph, a run, or a `w:sdt` the read demoted is not something
 * this engine can address as a field. The control and the addressed paragraph must be on one
 * ancestor line: a block control holds the paragraph, an inline control sits in it, and a control
 * somewhere else in the document is not the owner of this write however sincerely it is named.
 * And the offset must fall in the span the control covers IN THAT PARAGRAPH, so the write lands
 * where the name claims.
 *
 * The two kinds of control are constrained by the same rule rather than by two: a block control
 * covers the whole of a paragraph it holds, an inline one covers its own offsets, and "any offset
 * in an enclosed paragraph is fine" was a rule only one of them was ever checked against.
 */
export function namedOwnerRefusal(
  part: OoxmlPart,
  paragraphId: string,
  offset: number,
  inside: string
): TreeOpRejection | null {
  if (typeof inside !== 'string' || inside.length === 0) return 'invalidArgs';
  const owner = findNode(part, inside);
  if (!owner) return 'unknown-content-control';
  if (owner.kind !== 'contentControl') return 'not-a-content-control';
  const paragraph = findNode(part, paragraphId);
  if (!paragraph || !isParagraph(paragraph)) return null;
  const span = holds(owner, paragraphId)
    ? { start: 0, end: paragraphLength(paragraph) }
    : holds(paragraph, inside)
      ? paragraphOffsetIndex(paragraph).spanOf(owner)
      : null;
  if (!span) return 'unknown-content-control';
  if (!Number.isInteger(offset) || offset < span.start || offset > span.end) {
    return 'offset-out-of-range';
  }
  return null;
}

/** Structural validation, run before any tree work so a rejection changes nothing. */
export function validateTreeOp(part: OoxmlPart, op: TreeDocOp): TreeOpRejection | null {
  if (!TREE_DOC_OP_KINDS.includes(op.op)) return 'unknown-op';
  if (
    (op.op === 'insertText' || op.op === 'deleteText') &&
    op.textFormFieldId !== undefined &&
    !textFormFieldForEdit(part, op)
  )
    return 'invalidArgs';
  if (isDrawingTreeDocOp(op)) {
    const drawingRefusal = validateDrawingOp(part, op);
    if (drawingRefusal) return drawingRefusal;
  }
  if (op.op === 'replaceStoryBlocks') {
    return validateReplaceStoryBlocks(part, op.storyRootId, op.paragraphs);
  }

  // A NAMED OWNER IS AN ASSERTION ABOUT THE DOCUMENT, so it is checked before anything acts on
  // it. `inside` decides where the text goes AND what the refusals are resolved against — a name
  // that is not a control the write lands in would classify the op as filling in a field, which
  // is the one thing forms protection lets through.
  if (op.op === 'insertText' && op.inside !== undefined) {
    const owner = namedOwnerRefusal(part, op.paragraphId, op.offset, op.inside);
    if (owner) return owner;
  }

  if (op.op !== 'deleteBlock') {
    const lockRefusal = contentControlLockRefusal(part, op);
    if (lockRefusal) return lockRefusal;
  }

  // A binding is the same shape of refusal from the other direction: not "you may not change
  // this" but "this engine cannot change it without desyncing the part it mirrors". Checked here
  // so every content mutation meets it, not only the value write that names the control.
  const bindingRefusal = contentControlBindingRefusal(part, op);
  if (bindingRefusal) return bindingRefusal;
  if (isDrawingTreeDocOp(op)) return null;

  if (
    op.op === 'setContentControlProperties' ||
    (op.op === 'setContentControlValue' && typeof op.value !== 'string') ||
    (op.op === 'removeContentControl' && op.keepContent !== undefined)
  ) {
    const control = findNode(part, op.controlId);
    if (!control) return 'unknown-content-control';
    if (control.kind !== 'contentControl') return 'not-a-content-control';
    if (op.op === 'setContentControlProperties') {
      if (op.tag === undefined && op.alias === undefined && op.lock === undefined) {
        return 'invalidArgs';
      }
      for (const value of [op.tag, op.alias]) {
        if (!isWritableContentControlMetadata(value)) return 'invalid-property-value';
      }
      if (op.lock !== undefined && !CONTENT_CONTROL_LOCKS.has(op.lock)) return 'invalidArgs';
    }
    return null;
  }
  if (op.op === 'insertContentControl') {
    if (!INSERTABLE_CONTENT_CONTROL_TYPES.includes(op.type)) return 'invalidArgs';
    for (const value of [op.tag, op.alias]) {
      if (!isWritableContentControlMetadata(value)) return 'invalid-property-value';
    }
    if (op.lock !== undefined && !CONTENT_CONTROL_LOCKS.has(op.lock)) return 'invalidArgs';
    if (!Number.isInteger(op.start) || !Number.isInteger(op.end)) return 'invalid-range';
    const paragraph = findNode(part, op.paragraphId);
    if (!paragraph) return 'unknown-paragraph';
    if (!isParagraph(paragraph)) return 'not-a-paragraph';
    if (op.start < 0 || op.end > paragraphLength(paragraph) || op.start > op.end) {
      return 'invalid-range';
    }
    if (splitsSurrogate(paragraph, op.start) || splitsSurrogate(paragraph, op.end)) {
      return 'splits-surrogate-pair';
    }
    // BOTH EDGES, and here rather than in the applier: a control is a sibling of runs, so an
    // edge strictly inside a hyperlink, an inline control or an atomic field is not a place one
    // can start or stop. The applier refused these too, but only after `can` had already told a
    // caller the command was live — a disabled button that runs, or an enabled one that fails.
    if (indivisibleAt(paragraph, op.start) || indivisibleAt(paragraph, op.end)) {
      return 'indivisible-content';
    }
    // The same restriction check every other range op runs: a locked or bound control the span
    // touches, and forms protection. The applier answered it, so the write was refused — but
    // only after `can` had already told chrome the command was live, on exactly the document
    // class this verb is for.
    return rejectContentEdit(part, paragraph, op.start, op.end);
  }

  // Package-level furniture ops cannot run against a single part. Shape-check here so
  // applyTreeOp refuses them; TreePackageStore.applyLifecycleOp is the commit path.
  if (
    op.op === 'createHeaderFooter' ||
    op.op === 'deleteHeaderFooter' ||
    op.op === 'linkToPrevious' ||
    op.op === 'unlinkFromPrevious'
  ) {
    if (!Number.isInteger(op.sectionIndex) || op.sectionIndex < 0) return 'invalidArgs';
    if (op.kind !== 'header' && op.kind !== 'footer') return 'invalidArgs';
    if (op.variant !== 'default' && op.variant !== 'first' && op.variant !== 'even') {
      return 'invalidArgs';
    }
    return 'invalidArgs';
  }
  if (op.op === 'setSectionFurnitureOptions') {
    const empty =
      op.titlePage === undefined &&
      op.evenAndOddHeaders === undefined &&
      op.headerDistanceTwips === undefined &&
      op.footerDistanceTwips === undefined;
    if (empty) return 'invalidArgs';
    for (const value of [op.headerDistanceTwips, op.footerDistanceTwips]) {
      if (value === undefined) continue;
      if (!Number.isInteger(value) || value < 0 || value > 31680) return 'invalidArgs';
    }
    if (
      op.sectionIndex !== undefined &&
      (!Number.isInteger(op.sectionIndex) || op.sectionIndex < 0)
    ) {
      return 'invalidArgs';
    }
    return 'invalidArgs';
  }
  if (
    op.op === 'insertNote' ||
    op.op === 'deleteNote' ||
    op.op === 'convertNote' ||
    op.op === 'convertAllNotes' ||
    op.op === 'setNoteProperties'
  ) {
    return 'invalidArgs';
  }

  if (op.op === 'addRepeatingSectionItem' || op.op === 'removeRepeatingSectionItem') {
    return 'unsupported';
  }

  if (op.op === 'setContentControlValue') {
    if (typeof op.value !== 'string') return 'typeMismatch';
    return validateSetContentControlValue(part, op.controlId, op.value);
  }

  if (op.op === 'removeContentControl') {
    return validateRemoveContentControl(part, op.controlId);
  }

  if (op.op === 'insertFragment') {
    return validateInsertFragment(part, op);
  }

  if (op.op === 'insertTable') {
    return validateInsertTable(part, op);
  }

  if (op.op === 'insertToc') {
    return validateInsertToc(part, op);
  }
  if (op.op === 'replaceTocResult') {
    return validateReplaceTocResult(part, op);
  }
  if (op.op === 'rewriteTocPageNumbers') {
    return validateRewriteTocPageNumbers(part, op);
  }
  if (op.op === 'setTextFormFieldDefault') return validateTextFormFieldDefault(part, op);
  if (op.op === 'refreshFieldResults') {
    return validateRefreshFieldResults(part, op);
  }

  if (op.op === 'setSectionProperties') {
    const dims = [op.pageWidthTwips, op.pageHeightTwips];
    const margins = [
      op.marginTopTwips,
      op.marginRightTwips,
      op.marginBottomTwips,
      op.marginLeftTwips,
    ];
    if (
      dims.every((value) => value === undefined) &&
      margins.every((value) => value === undefined) &&
      op.orientation === undefined
    ) {
      return 'invalid-property-value';
    }
    for (const value of dims) {
      // The same bound the read side clamps to: a page dimension is a pagination loop
      // bound, so the write path must not admit what the read path would refuse.
      if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > 63360)) {
        return 'invalid-property-value';
      }
    }
    for (const value of margins) {
      // Stricter than the read side, which tolerates authored negative margins: the write
      // path is a dialog or a ruler drag, and neither means "bleed into the margin".
      if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 31680)) {
        return 'invalid-property-value';
      }
    }
    if (
      op.orientation !== undefined &&
      op.orientation !== 'portrait' &&
      op.orientation !== 'landscape'
    ) {
      return 'invalid-property-value';
    }
    if (op.anchorParagraphId !== undefined) {
      const anchor = findNode(part, op.anchorParagraphId);
      if (!anchor) return 'unknown-paragraph';
      if (!isParagraph(anchor)) return 'not-a-paragraph';
    }
    if (!bodyNodeOf(part)) return 'tree-invariant';
    // EVERY section the op will write must keep a positive content area — checked against
    // the same planned values apply writes, so a value the check approved is exactly the
    // value written. The read side falls back to default geometry when margins swallow
    // the page; a WRITE that would trip that fallback is refused instead, so the user
    // sees a rejection rather than a document that silently snaps to Letter.
    for (const section of targetSectionNodes(part, op.anchorParagraphId)) {
      const current = metricsOfSection(section);
      const { widthTwips, heightTwips } = plannedSectionDimensions(current, op);
      const top = op.marginTopTwips ?? current.topTwips;
      const right = op.marginRightTwips ?? current.rightTwips;
      const bottom = op.marginBottomTwips ?? current.bottomTwips;
      const left = op.marginLeftTwips ?? current.leftTwips;
      if (widthTwips - left - current.gutterTwips - right <= 0 || heightTwips - top - bottom <= 0) {
        return 'invalid-property-value';
      }
    }
    return null;
  }

  if (op.op === 'deleteBlock') {
    const block = findNode(part, op.blockId);
    if (block && block.kind !== 'textValue') {
      const restriction = deleteBlockTouchesContentRestriction(part, block);
      if (restriction) return restriction;
    }
    return validateDeleteBlock(part, op.blockId);
  }
  if (op.op === 'insertTableRow' || op.op === 'deleteTableRow') return validateTableRowOp(part, op);
  if (op.op === 'insertTableColumn' || op.op === 'deleteTableColumn')
    return validateTableColumnOp(part, op);
  if (
    op.op === 'setTableColumnWidths' ||
    op.op === 'setTableRightEdgeWidth' ||
    op.op === 'setTableRowHeight'
  ) {
    return validateTableResizeOp(part, op);
  }
  if (
    op.op === 'setTableCellBorders' ||
    op.op === 'setTableCellFill' ||
    op.op === 'setTableCellVerticalAlignment'
  ) {
    return validateTableCellPropertyOp(part, op);
  }

  if (op.op === 'joinParagraphs') {
    const first = findNode(part, op.firstId);
    const second = findNode(part, op.secondId);
    if (!first || !second) return 'unknown-paragraph';
    if (!isParagraph(first) || !isParagraph(second)) return 'not-a-paragraph';
    if (isBoundAt(part, op.firstId) || isBoundAt(part, op.secondId)) return 'bound';
    if (
      effectiveContentLockAt(part, op.firstId).content ||
      effectiveContentLockAt(part, op.secondId).content
    ) {
      return 'locked';
    }
    // A join is a content edit for any temporary control enclosing either paragraph;
    // refuse when the required unwrap is blocked by an effective wrapper lock.
    for (const paragraphId of [op.firstId, op.secondId]) {
      const control = innermostContentControlAround(part, paragraphId);
      if (control && isTemporaryControl(control) && effectiveLockOf(part, control).wrapper) {
        return 'locked';
      }
    }
    return null;
  }

  if (op.op === 'setHyperlinkTarget' || op.op === 'removeHyperlink') {
    const link = findNode(part, op.linkId);
    if (!link) return 'unknown-paragraph';
    if (link.kind !== 'hyperlink') return 'not-a-paragraph';
    {
      const restriction = nodeTouchesContentRestriction(part, op.linkId);
      if (restriction) return restriction;
    }
    if (op.op === 'setHyperlinkTarget') return validateHyperlinkTarget(op);
    return null;
  }

  if (op.op === 'setMathEquation' || op.op === 'removeMathEquation') {
    const equation = findNode(part, op.equationId);
    if (!equation) return 'unknown-paragraph';
    if (
      equation.kind === 'textValue' ||
      equation.kind !== 'generic' ||
      equation.namespaceUri !== OFFICE_MATH_NAMESPACE_URI ||
      equation.localName !== 'oMath'
    ) {
      return 'not-a-paragraph';
    }
    const restriction = nodeTouchesContentRestriction(part, op.equationId);
    if (restriction) return restriction;
    if (op.op === 'setMathEquation' && !parseLinearMath(op.linear).ok) {
      return 'invalid-property-value';
    }
    return null;
  }

  if (op.op === 'insertCommentMarker') {
    const paragraph = findNode(part, op.paragraphId);
    if (!paragraph) return 'unknown-paragraph';
    if (!isParagraph(paragraph)) return 'not-a-paragraph';
    if (!Number.isInteger(op.offset) || op.offset < 0 || op.offset > paragraphLength(paragraph)) {
      return 'offset-out-of-range';
    }
    if (typeof op.commentId !== 'string' || !/^\d+$/.test(op.commentId)) {
      return 'invalid-property-value';
    }
    return null;
  }

  if (
    op.op === 'acceptRevision' ||
    op.op === 'rejectRevision' ||
    op.op === 'acceptAllRevisions' ||
    op.op === 'rejectAllRevisions'
  ) {
    if (op.op === 'acceptRevision' || op.op === 'rejectRevision') {
      const address = op.revision;
      if (typeof address?.id !== 'string' || address.id.length === 0)
        return 'invalid-property-value';
      // The schema makes `@w:author` required, so an address without one could not match a
      // well-formed revision and is a caller error rather than a miss.
      if (typeof address.author !== 'string') return 'invalid-property-value';
      if (address.date !== undefined && typeof address.date !== 'string') {
        return 'invalid-property-value';
      }
    } else if (op.scopeRootId !== undefined) {
      if (typeof op.scopeRootId !== 'string' || op.scopeRootId.length === 0) {
        return 'invalid-property-value';
      }
      // Scoped all-decisions exist only for a story root in a shared notes part. Accepting an
      // arbitrary subtree would invent public mutation semantics no caller has agreed to.
      if (scopedRevisionRoot(part, op.scopeRootId) === null) return 'invalid-property-value';
    }
    // Presence and resolvability are decided by the same walk that applies the op, so they
    // are checked there rather than duplicated into a second traversal that could disagree.
    return null;
  }

  const paragraph = findNode(part, op.paragraphId);
  if (!paragraph) return 'unknown-paragraph';
  if (!isParagraph(paragraph)) return 'not-a-paragraph';
  const length = paragraphLength(paragraph);

  switch (op.op) {
    case 'insertText': {
      if (!Number.isInteger(op.offset) || op.offset < 0 || op.offset > length) {
        return 'offset-out-of-range';
      }
      if (typeof op.text !== 'string' || !isValidXmlText(op.text)) return 'invalid-text';
      if (splitsSurrogate(paragraph, op.offset)) return 'splits-surrogate-pair';
      if (op.bias !== undefined && op.bias !== 'left' && op.bias !== 'right') return 'invalidArgs';
      // A named automation insertion was already resolved against that owner's exact landing
      // site above. Re-resolving the raw caret with editor boundary bias can select a sibling.
      if (op.inside !== undefined) return null;
      return rejectContentEdit(part, paragraph, op.offset, op.offset, op.bias);
    }
    case 'setListLevel': {
      if (!Number.isInteger(op.level) || op.level < 0 || op.level > 8) return 'invalid-range';
      if (isBoundAt(part, op.paragraphId)) return 'bound';
      if (effectiveContentLockAt(part, op.paragraphId).content) return 'locked';
      return null;
    }
    case 'proposeParagraphMerge': {
      if (op.revision === undefined || invalidRevisionAttribution(op.revision)) {
        return 'invalid-property-value';
      }
      return null;
    }
    case 'setParagraphMarkRevision': {
      if (op.kind !== 'ins' && op.kind !== 'del') return 'invalid-range';
      // `CT_TrackChange` makes `@w:author` required, so a mark with none is invalid XML.
      if (op.revision === undefined || invalidRevisionAttribution(op.revision)) {
        return 'invalid-property-value';
      }
      return null;
    }
    case 'setParagraphMarkProperties':
      if (!Array.isArray(op.properties)) return 'invalid-range';
      // The MARK is a run property container (CT_ParaRPr), so it takes the same boundary
      // `setRunProperties` does. Checking only that the argument was an array let an op
      // MINT any element name into `w:pPr/w:rPr` — `<w:rPr><w:sectPr/></w:rPr>` applied
      // clean and serialized — and skipped the attribute-name/value checks every other
      // property op runs before a value reaches the XML sink.
      {
        const propertiesRejection = validateProperties(op.properties, RUN_PROPERTY_SET);
        if (propertiesRejection) return propertiesRejection;
      }
      if (op.revision !== undefined && invalidRevisionAttribution(op.revision)) {
        return 'invalid-property-value';
      }
      if (isBoundAt(part, op.paragraphId)) return 'bound';
      if (effectiveContentLockAt(part, op.paragraphId).content) return 'locked';
      return null;
    case 'setParagraphTabStops': {
      // Bounded here because nothing downstream is: `w:pos` is a layout dimension, and a
      // file-supplied count becomes an element count. Word's own dialog tops out well
      // inside both.
      if (!Array.isArray(op.stops) || op.stops.length > 64) return 'invalid-range';
      for (const stop of op.stops) {
        // Refused, not thrown: this op is reachable from untyped JS, and validation is the
        // layer that says no.
        if (typeof stop !== 'object' || stop === null) return 'invalid-range';
        // Not `Math.abs`: `clampPositionTwips` drops anything below zero, so a negative
        // position writes markup the engine then reports as no stop at all. The command
        // layer refuses it; a direct `TreeDocOp` caller — who these bounds exist for — must
        // get the same answer.
        if (
          !Number.isInteger(stop.positionTwips) ||
          stop.positionTwips < 0 ||
          stop.positionTwips > 31680
        ) {
          return 'invalid-range';
        }
        if (!['left', 'center', 'right', 'decimal', 'bar'].includes(stop.alignment)) {
          return 'invalid-range';
        }
        if (
          stop.leader !== undefined &&
          !['none', 'dot', 'hyphen', 'underscore', 'heavy', 'middleDot'].includes(stop.leader)
        ) {
          return 'invalid-range';
        }
      }
      // Two stops at one position is markup Word never writes, and the reader keeps only
      // the last — so accepting it would mean the file says one thing and the editor
      // another. The dialog dedupes already; this covers the public command.
      if (
        new Set(op.stops.map((stop) => Math.round(stop.positionTwips))).size !== op.stops.length
      ) {
        return 'invalid-range';
      }
      // Bounded on the same terms: a clear is an element too, and both lists are
      // file-derived once a document round-trips through the editor.
      if (op.inForcePositionsTwips !== undefined) {
        if (!Array.isArray(op.inForcePositionsTwips) || op.inForcePositionsTwips.length > 64) {
          return 'invalid-range';
        }
        for (const position of op.inForcePositionsTwips) {
          if (!Number.isInteger(position) || Math.abs(position) > 31680) return 'invalid-range';
        }
      }
      if (isBoundAt(part, op.paragraphId)) return 'bound';
      if (effectiveContentLockAt(part, op.paragraphId).content) return 'locked';
      return null;
    }
    case 'setListNumbering': {
      const level = op.level ?? 0;
      if (!Number.isInteger(level) || level < 0 || level > 8) return 'invalid-range';
      // A numId is file-addressable and becomes an attribute value: digits only.
      if (op.numId !== null && !/^\d{1,9}$/.test(op.numId)) return 'invalid-range';
      if (isBoundAt(part, op.paragraphId)) return 'bound';
      if (effectiveContentLockAt(part, op.paragraphId).content) return 'locked';
      return null;
    }
    case 'insertTab':
    case 'insertHardBreak':
    case 'insertPageBreak': {
      if (!Number.isInteger(op.offset) || op.offset < 0 || op.offset > length) {
        return 'offset-out-of-range';
      }
      // `CT_TrackChange` makes `@w:author` required, so a tracked variant with an empty one
      // would serialize a proposal no reader can attribute or resolve.
      if (op.revision !== undefined && invalidRevisionAttribution(op.revision)) {
        return 'invalid-property-value';
      }
      if (splitsSurrogate(paragraph, op.offset)) return 'splits-surrogate-pair';
      return rejectContentEdit(part, paragraph, op.offset, op.offset);
    }
    case 'insertPageField': {
      if (!Number.isInteger(op.offset) || op.offset < 0 || op.offset > length) {
        return 'offset-out-of-range';
      }
      if (splitsSurrogate(paragraph, op.offset)) return 'splits-surrogate-pair';
      if (
        op.field !== 'PAGE' &&
        op.field !== 'NUMPAGES' &&
        op.field !== 'SECTIONPAGES' &&
        op.field !== 'PAGE_X_OF_Y'
      ) {
        return 'invalidArgs';
      }
      // `CT_TrackChange` makes `@w:author` required, so a tracked variant with an empty one
      // would serialize a proposal no reader can attribute or resolve.
      if (op.revision !== undefined && invalidRevisionAttribution(op.revision)) {
        return 'invalid-property-value';
      }
      return rejectContentEdit(part, paragraph, op.offset, op.offset);
    }
    case 'splitParagraph': {
      if (!Number.isInteger(op.offset) || op.offset < 0 || op.offset > length) {
        return 'offset-out-of-range';
      }
      // A style id becomes a `w:pStyle` attribute. Bound and character-check it here rather
      // than at the writer: `TreeDocOp` is public, so the op is a trust boundary of its own.
      if (op.tailStyleId !== undefined && op.tailStyleId !== null && !isStyleId(op.tailStyleId)) {
        return 'invalid-property-value';
      }
      if (splitsSurrogate(paragraph, op.offset)) return 'splits-surrogate-pair';
      if (rangePartiallyOverlapsDrawing(paragraph, op.offset, op.offset + 1)) {
        return 'invalid-range';
      }
      // The reach classifier above distinguishes a split beside an inline control from one
      // inside it; reclassifying the zero-width point as text would move that boundary.
      return null;
    }
    case 'splitParagraphMany': {
      if (!Array.isArray(op.offsets) || op.offsets.length === 0) return 'invalid-range';
      let previous = -1;
      for (const offset of op.offsets) {
        if (!Number.isInteger(offset) || offset < 0 || offset > length) {
          return 'offset-out-of-range';
        }
        // Non-decreasing: unordered offsets have no single sequential reading, but a
        // REPEATED offset does — it is how an empty paragraph is expressed, and a paste
        // with a blank line carries exactly that.
        if (offset < previous) return 'invalid-range';
        previous = offset;
        if (splitsSurrogate(paragraph, offset)) return 'splits-surrogate-pair';
        const restriction = rejectContentEdit(part, paragraph, offset, offset);
        if (restriction) return restriction;
        if (rangePartiallyOverlapsDrawing(paragraph, offset, offset + 1)) return 'invalid-range';
      }
      return null;
    }
    case 'deleteText': {
      if (!Number.isInteger(op.start) || !Number.isInteger(op.end)) return 'invalid-range';
      if (op.start < 0 || op.end > length) return 'offset-out-of-range';
      if (op.start >= op.end) return 'invalid-range';
      if (splitsSurrogate(paragraph, op.start) || splitsSurrogate(paragraph, op.end)) {
        return 'splits-surrogate-pair';
      }
      if (rangePartiallyOverlapsDrawing(paragraph, op.start, op.end)) return 'invalid-range';
      if (!op.revision) {
        const refusal = coveredTextFormDefinitionRefusal(part, paragraph, op.start, op.end);
        if (refusal) return refusal;
      }
      return rejectContentEdit(part, paragraph, op.start, op.end);
    }
    case 'setRunProperties': {
      if (!Number.isInteger(op.start) || !Number.isInteger(op.end)) return 'invalid-range';
      if (op.start < 0 || op.end > length) return 'offset-out-of-range';
      if (op.start >= op.end) return 'invalid-range';
      {
        const propertiesRejection = validateProperties(op.properties, RUN_PROPERTY_SET);
        if (propertiesRejection) return propertiesRejection;
      }
      if (op.revision !== undefined && invalidRevisionAttribution(op.revision)) {
        return 'invalid-property-value';
      }
      return rejectContentEdit(part, paragraph, op.start, op.end);
    }
    case 'setParagraphProperties': {
      const propertiesRejection = validateProperties(op.properties, PARAGRAPH_PROPERTY_SET);
      if (propertiesRejection) return propertiesRejection;
      if (op.revision !== undefined && invalidRevisionAttribution(op.revision)) {
        return 'invalid-property-value';
      }
      if (isBoundAt(part, op.paragraphId)) return 'bound';
      if (effectiveContentLockAt(part, op.paragraphId).content) return 'locked';
      return null;
    }
    case 'insertInlineContentControl': {
      if (!Number.isInteger(op.offset)) return 'invalid-range';
      if (op.offset < 0 || op.offset > length) return 'offset-out-of-range';
      if (splitsSurrogate(paragraph, op.offset)) return 'splits-surrogate-pair';
      // The tag is the node's IDENTITY and Word caps `w:tag` at 64 characters;
      // writing a longer one authors a control Word will refuse to keep.
      if (typeof op.tag !== 'string' || op.tag.length === 0 || op.tag.length > 64) {
        return 'invalid-property-value';
      }
      if (typeof op.text !== 'string' || op.text.length === 0) return 'invalid-property-value';
      // Inside another control's content the wrapper nests; inside a LINK it is
      // not a shape Word writes — reuse the link-nesting refusal.
      if (rangeTouchesHyperlink(paragraph, op.offset, op.offset)) {
        return 'invalid-property-value';
      }
      if (op.dataBinding !== undefined && !isAuthorableDataBinding(op.dataBinding)) {
        return 'invalid-property-value';
      }
      return null;
    }
    case 'insertHyperlink': {
      if (!Number.isInteger(op.start) || !Number.isInteger(op.end)) return 'invalid-range';
      if (op.start < 0 || op.end > length) return 'offset-out-of-range';
      // A collapsed range would produce a link with no text: markup with nothing to click,
      // and nothing for a later unlink to give back.
      if (op.start >= op.end) return 'invalid-range';
      if (splitsSurrogate(paragraph, op.start) || splitsSurrogate(paragraph, op.end)) {
        return 'splits-surrogate-pair';
      }
      // Nested links are not a shape Word writes and not one this engine reads: the inner
      // link's runs would resolve through the outer one's target on every walk that stops
      // at the first `w:hyperlink` it finds.
      if (rangeTouchesHyperlink(paragraph, op.start, op.end)) return 'invalid-property-value';
      if (op.styleId !== undefined) {
        // Written straight into an attribute, so it is checked here rather than at the sink.
        if (typeof op.styleId !== 'string' || op.styleId.length === 0) {
          return 'invalid-property-value';
        }
        if (op.styleId.length > MAX_HYPERLINK_ATTRIBUTE_LENGTH || !isValidXmlText(op.styleId)) {
          return 'invalid-property-value';
        }
      }
      {
        const restriction = rejectContentEdit(part, paragraph, op.start, op.end);
        if (restriction) return restriction;
      }
      return validateHyperlinkTarget(op);
    }
    case 'setSectionMark': {
      if (
        op.breakType !== undefined &&
        op.breakType !== 'nextPage' &&
        op.breakType !== 'continuous'
      ) {
        return 'invalid-property-value';
      }
      const pPr = paragraphPropertiesNodeOf(paragraph);
      // A paragraph already ending a section cannot end two.
      if (pPr && sectionChild(pPr, 'sectPr')) return 'invalid-property-value';
      // A section cannot end inside a table cell: Word never writes one there, and the
      // read side would ignore it — a committed no-op the user cannot see.
      if (isTableNested(part, op.paragraphId)) return 'invalid-property-value';
      if (isBoundAt(part, op.paragraphId)) return 'bound';
      if (effectiveContentLockAt(part, op.paragraphId).content) return 'locked';
      // The break type is written on the section that STARTS at the mark, which hangs on a
      // DIFFERENT paragraph — one that can sit inside a locked or bound content control the
      // marked paragraph is nowhere near. Guarding only `op.paragraphId` let a caret outside
      // the control rewrite the section inside it. A body-level section has no owning
      // paragraph and no control can wrap it, so it needs no second check.
      if (op.breakType !== undefined) {
        const governing = targetSectionNodes(part, op.paragraphId)[0] ?? null;
        const owner =
          sectionBreakTypeOf(governing) === op.breakType
            ? null
            : governingSectionOwnerId(part, op.paragraphId);
        if (owner !== null) {
          if (isBoundAt(part, owner)) return 'bound';
          if (effectiveContentLockAt(part, owner).content) return 'locked';
        }
      }
      return null;
    }
    default:
      return 'unknown-op';
  }
}

// Backward-compatible re-exports: callers that imported vocabulary/segmentation/section
// helpers from this module keep resolving here. Canonical homes are the modules above.
export {
  ACCEPTED_PARAGRAPH_PROPERTIES,
  ACCEPTED_RUN_PROPERTIES,
  TREE_DOC_OP_KINDS,
  type AcceptedParagraphProperty,
  type AcceptedRunProperty,
  type ImpactClass,
  type OoxmlProperty,
  type RevisionAddress,
  type RevisionAttributionInput,
  type TreeDocOp,
  type TreeDocOpKind,
  type DrawingTreeDocOp,
  type TreeOpEffect,
  type TreeOpRejection,
  type TreeOpResult,
} from './tree-op-types.ts';
export {
  inlineControlEndingAt,
  inlineControlStartingAt,
  isParagraph,
  paragraphOffsetIndex,
  runsUnder,
  segmentsOf,
  type InlineControlSpan,
  type OffsetSpan,
  type ParagraphOffsetIndex,
  type Segment,
} from './tree-op-segments.ts';
export {
  allSectionNodes,
  bodyNodeOf,
  bodySectionOf,
  currentSectionMetrics,
  isTableNested,
  metricsOfSection,
  plannedSectionDimensions,
  sectionAttribute,
  sectionChild,
  targetSectionNodes,
  type SectionMetrics,
} from './tree-op-section-address.ts';

export { contentControlAtCaret } from './tree-op-validate-controls.ts';
