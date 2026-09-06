// Story roots over the canonical tree (phase 2 of the legacy-lane retirement).
//
// A STORY is a flowable sequence of blocks: the body of the main document, the whole
// content of a header/footer part (`w:hdr`/`w:ftr` roots hold block content directly),
// or a single footnote/endnote node. This is the single place that knows which roots
// flow and how block-level content controls flatten — via shared `collectFlowBlocks`.
//
// SDT content flattens TRANSPARENTLY: the paragraphs and tables inside `w:sdtContent`
// join the flow in reading order (Word renders them in place), while the `w:sdt` wrapper
// itself stays structurally preserved for serialization. SDT chrome — placeholder text,
// locks, dropdown behaviour — is not modelled here.
//
// Note parts (`w:footnotes` / `w:endnotes`) are NOT story roots: each typed `w:footnote` /
// `w:endnote` child is its own story via {@link noteStoryBlocks}.

import type {
  OoxmlElement,
  OoxmlNode,
  OoxmlParagraphNode,
  OoxmlPart,
} from '@docx-editor.dev/core/store';
import { MAX_CONTENT_CONTROL_NESTING } from '../store/package/content-control-walk.ts';
import { blockStoryContainerChildren } from '../store/package/story-blocks.ts';
import { WML_NAMESPACE_URI } from '../store/package/ooxml-tree.ts';
import { paragraphOffsetIndex } from '../store/store/tree-op-segments.ts';
import { piecesOfParagraph } from './field-projection.ts';
import { createRecentRootCache } from '../store/store/recent-root-cache.ts';
import type { RevisionAuthorFilter, RevisionDisplayMode } from './revision-projection.ts';
import { cacheProjection } from './bounded-projection-cache.ts';
import { markRemovedInMode, revisionRemovesParagraph } from './revision-visibility.ts';

export { MAX_CONTENT_CONTROL_NESTING as MAX_SDT_NESTING } from '../store/package/content-control-walk.ts';

/** Roots whose children are block content: the body, and header/footer part roots. */
function storyRootOf(part: OoxmlPart): OoxmlElement | undefined {
  const root = part.root;
  if (root.localName === 'hdr' || root.localName === 'ftr') return root;
  const findBody = (node: OoxmlNode): OoxmlElement | undefined => {
    if (node.kind === 'textValue') return undefined;
    if (node.kind === 'body') return node;
    for (const child of node.children) {
      const found = findBody(child);
      if (found) return found;
    }
    return undefined;
  };
  return findBody(root);
}

function acceptStoryBlock(
  block: OoxmlElement,
  displayMode: RevisionDisplayMode,
  authorFilter?: RevisionAuthorFilter
): boolean {
  // A paragraph whose mark AND content a tracked revision deleted is not part of the
  // rendered document; without this it reaches pagination with no spans and still
  // claims a full line box.
  if (block.kind === 'paragraph' && revisionRemovesParagraph(block, displayMode, authorFilter))
    return false;
  return true;
}

/**
 * The paragraphs a merge group is built from, in order, with the survivor last.
 *
 * Published beside the synthetic paragraph rather than derived from it, because the identity
 * rewrite has to name the member a piece of content came from and a synthetic node has lost
 * that by construction.
 */
export interface ParagraphMergeGroup {
  /** The node layout lays out: the survivor's properties, every member's content. */
  readonly merged: OoxmlElement;
  /** Members in document order. The last one is the survivor whose mark stays. */
  readonly members: readonly OoxmlElement[];
}

/** Groups keyed by the synthetic node, so a caller holding one can ask what it came from. */
const mergeGroups = new WeakMap<OoxmlElement, ParagraphMergeGroup>();

/** The members a laid-out paragraph stands for, or null when it stands for itself. */
export function paragraphMergeGroupOf(paragraph: OoxmlElement): ParagraphMergeGroup | null {
  return mergeGroups.get(paragraph) ?? null;
}

/** One paragraph standing for several: the survivor's properties, every member's content. */
function mergedParagraph(members: readonly OoxmlElement[], survivor: OoxmlElement): OoxmlElement {
  const properties = survivor.children.filter((child) => isParagraphProperties(child));
  const content = members.flatMap((member) =>
    member.children.filter((child) => !isParagraphProperties(child))
  );
  const merged = { ...survivor, children: [...properties, ...content] } as OoxmlElement;
  mergeGroups.set(merged, { merged, members });
  return merged;
}

function isParagraphProperties(node: OoxmlNode): boolean {
  return (
    node.kind !== 'textValue' && (node.kind === 'paragraphProperties' || node.localName === 'pPr')
  );
}

/**
 * Fold each run of mark-removed paragraphs into the paragraph that follows it.
 *
 * The shape matches `resolveRevisions` exactly: the SURVIVOR's `w:pPr` governs, and every
 * member's content arrives before it in document order. A trailing member with nothing to
 * merge into keeps itself, for the same reason the store refuses that case — its runs have no
 * paragraph to live in.
 */
function withMergedParagraphs(
  parented: readonly ParentedBlock[],
  displayMode: RevisionDisplayMode,
  authorFilter?: RevisionAuthorFilter
): OoxmlElement[] {
  if (displayMode === 'all-markup' && !authorFilter) return parented.map((entry) => entry.block);
  const out: OoxmlElement[] = [];
  let pendingMembers: OoxmlElement[] = [];
  let pendingParent: string | null = null;
  const endRun = (): void => {
    out.push(...mergedTrailingRun(pendingMembers));
    pendingMembers = [];
    pendingParent = null;
  };
  for (const { block, parentKey } of parented) {
    // A content control flattens into the flow, so its paragraphs are neighbours on the page
    // without being siblings in the tree. The store rebuilds one children array at a time and
    // never merges out of `w:sdtContent`; matching that keeps the two answers the same.
    if (pendingMembers.length > 0 && parentKey !== pendingParent) endRun();
    if (block.kind !== 'paragraph') {
      // A table between two mark-removed paragraphs is a container boundary too.
      endRun();
      out.push(block);
      continue;
    }
    const removed = markRemovedInMode(block, displayMode, authorFilter);
    // Measuring costs a walk of the paragraph, so it is asked ONLY where a merge could happen:
    // of a paragraph whose mark is removed, and of the survivor a pending run would merge into.
    // A document with no tracked marks answers `false` to the cheap question and stops, which
    // is every keystroke in the view the free engine renders by default.
    if (
      (removed || pendingMembers.length > 0) &&
      !memberIsAddressable(block, displayMode, authorFilter)
    ) {
      // Cannot be measured, so cannot be merged INTO either: a survivor whose own offsets do
      // not line up would take the previous members' characters at the wrong index.
      endRun();
      out.push(block);
      continue;
    }
    if (removed) {
      pendingMembers.push(block);
      pendingParent = parentKey;
      continue;
    }
    if (pendingMembers.length === 0) {
      out.push(block);
      continue;
    }
    const members = [...pendingMembers, block];
    pendingMembers = [];
    pendingParent = null;
    out.push(mergedParagraph(members, block));
  }
  // A TRAILING run, with no unmarked paragraph after it. Word cannot delete the last mark of a
  // story, so the last member keeps its own break and the ones before it still merge into it —
  // which is what `resolveRevisions` does, one member at a time, for the same reason.
  out.push(...mergedTrailingRun(pendingMembers));
  return out;
}

function mergedTrailingRun(members: readonly OoxmlElement[]): readonly OoxmlElement[] {
  if (members.length < 2) return members;
  const survivor = members[members.length - 1]!;
  return [mergedParagraph(members, survivor)];
}

/**
 * One container's blocks: flattened through content controls, merged, then filtered.
 *
 * MERGE FIRST, then drop. A mark-removed paragraph merges into the paragraph that follows it
 * IN THE TREE, which is the rule `resolveRevisions` follows; dropping the empty ones first
 * would hand a member the wrong survivor, and the survivor's properties govern the result.
 * After the merge the drop has little left to do: an absorbed member is gone already, and what
 * remains is a mark-removed paragraph with nothing after it to merge into.
 *
 * Every story collects its blocks through here — body, note, textbox and table cell — so a
 * container is a merge boundary by construction: a paragraph can only merge with one that
 * shares its parent, which is the same rule the store applies.
 */
export function mergedFlowBlocks(
  children: readonly OoxmlNode[],
  displayMode: RevisionDisplayMode,
  authorFilter?: RevisionAuthorFilter
): OoxmlElement[] {
  const merged = withMergedParagraphs(flowBlocksWithParent(children), displayMode, authorFilter);
  return merged.filter((block) => acceptStoryBlock(block, displayMode, authorFilter));
}

/**
 * The elements Word writes beside a cell-terminating `w:p` that paint nothing.
 *
 * Anything else — a run, a `w:ins`, a `w:hyperlink` — is content, and a paragraph holding
 * it keeps its line box wherever it sits.
 */
const CELL_TERMINATOR_MARKERS = new Set([
  'pPr',
  'bookmarkStart',
  'bookmarkEnd',
  'proofErr',
  'permStart',
  'permEnd',
]);

/**
 * Does this paragraph carry nothing but properties and structural markers?
 *
 * A `w:tc` must end with a `w:p` (17.4.66), so a cell whose last real block is a `w:tbl`
 * still carries one and Word writes it empty. Word and LibreOffice give that paragraph no
 * line box; charging one for it makes the cell — and with it the row — a full line taller
 * than either draws it. The paragraph stays in the flow so the caret and select-all can
 * still reach it, and only its HEIGHT collapses; see `placeCellParagraph`.
 *
 * A paragraph with content keeps its height, and so does an empty paragraph anywhere else
 * in the cell: the rule is about the terminator a trailing nested table forces.
 */
export function isEmptyCellTerminator(paragraph: OoxmlElement): boolean {
  for (const child of paragraph.children) {
    if (child.kind === 'textValue') {
      if (child.value.length > 0) return false;
      continue;
    }
    if (child.namespaceUri !== WML_NAMESPACE_URI) return false;
    if (!CELL_TERMINATOR_MARKERS.has(child.localName)) return false;
  }
  return true;
}

/** A block, and which children array it actually lives in. */
interface ParentedBlock {
  readonly block: OoxmlElement;
  /** Node id of the enclosing transparent wrapper, or `''` for the story root's own children. */
  readonly parentKey: string;
}

/** The walk `collectFlowBlocks` performs, remembering where each block CAME FROM. */
function flowBlocksWithParent(children: readonly OoxmlNode[]): readonly ParentedBlock[] {
  const blocks: ParentedBlock[] = [];
  const collect = (nodes: readonly OoxmlNode[], nest: number, parentKey: string): void => {
    for (const child of nodes) {
      if (child.kind === 'textValue') continue;
      if (child.kind === 'paragraph' || child.kind === 'table') {
        blocks.push({ block: child, parentKey });
        continue;
      }
      const nested = blockStoryContainerChildren(child);
      if (nested !== null && nest < MAX_CONTENT_CONTROL_NESTING) {
        collect(nested, nest + 1, child.id);
      }
    }
  };
  collect(children, 0, '');
  return blocks;
}

/**
 * Can this paragraph's content be addressed inside a merged one?
 *
 * ASK THE WALK, which is what the design called for. A member's characters are placed in the
 * merged paragraph at an offset taken from the STORE and read back out of spans the LAYOUT
 * walk produced, so the two have to agree about how long the member is. They agree for every
 * ordinary construct and part ways in two places: a field whose `w:fldChar begin` sits in one
 * member and whose `end` sits in the next — Word writes that for a TOC — closes across the
 * mark once the members share a paragraph and swallows the second member into one atomic
 * field; and content past a nesting cap counts differently on each side. Both publish one
 * member's text at another member's offsets, which is worse than the break this change exists
 * to remove, so a group that cannot be measured is not merged.
 *
 * A refusal is fail-visible, not fail-safe: the reader keeps a break the document says is
 * gone, and if the refused member carried `w:pPr/w:sectPr` they also keep a section break —
 * so the pages before it stay at their own paper size, where accepting the change would put
 * them on the next section's.
 */
/**
 * Memoized on the node, per mode. A paragraph is immutable — a transaction rebuilds the path
 * to what it edited and leaves every other paragraph object-identical — so the answer holds
 * until that paragraph itself changes. Without this the walk ran for every candidate on every
 * flush, and a document with hundreds of tracked marks paid it on each keystroke.
 */
const addressableByNode = new WeakMap<OoxmlElement, Map<string, boolean>>();

function memberIsAddressable(
  member: OoxmlElement,
  displayMode: RevisionDisplayMode,
  authorFilter?: RevisionAuthorFilter
): boolean {
  const key = `${displayMode}|${authorFilter?.cacheKey ?? ''}`;
  const perMode = addressableByNode.get(member);
  const cached = perMode?.get(key);
  if (cached !== undefined) return cached;
  const answer = measureMember(member, displayMode, authorFilter);
  if (perMode) cacheProjection(perMode, key, answer);
  else addressableByNode.set(member, new Map([[key, answer]]));
  return answer;
}

function measureMember(
  member: OoxmlElement,
  displayMode: RevisionDisplayMode,
  authorFilter?: RevisionAuthorFilter
): boolean {
  if (!fieldCharsBalanced(member)) return false;
  const pieces = piecesOfParagraph(
    member,
    [],
    undefined,
    undefined,
    undefined,
    undefined,
    displayMode,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    authorFilter
  );
  let published = 0;
  for (const piece of pieces) published = Math.max(published, piece.end);
  // Published LESS than the store holds is ordinary: a resolved view hides content it has
  // resolved away, and the walk still counts those characters in its offsets. Published MORE
  // is the failure — it means the walk reached content the store cannot address, so a member
  // placed after it would be read back at offsets that belong to no paragraph.
  return published <= paragraphOffsetIndex(member as OoxmlParagraphNode).length;
}

/**
 * Does every field this paragraph opens also close inside it?
 *
 * `w:fldChar begin` in one paragraph and `end` in the next is ordinary Word output — a TOC is
 * written that way. Two such paragraphs laid out as ONE close the field across the mark, and
 * the field projection then covers the whole of the second member with a single atomic offset:
 * every character of it published inside the first member's range, and the paragraph itself
 * unreachable. Merging is refused rather than made to look right.
 */
function fieldCharsBalanced(paragraph: OoxmlElement): boolean {
  let open = 0;
  let underflowed = false;
  const visit = (node: OoxmlNode): void => {
    if (node.kind === 'textValue') return;
    if (node.namespaceUri === WML_NAMESPACE_URI && node.localName === 'fldChar') {
      const type = node.attributes.find(
        (attribute) => attribute.localName === 'fldCharType'
      )?.value;
      if (type === 'begin') open += 1;
      else if (type === 'end') {
        open -= 1;
        // An `end` with no `begin` in this paragraph closes a field that started in an
        // earlier one. Counting a net would let it cancel a later `begin` and call the
        // paragraph balanced, which is the case this guard exists to catch.
        if (open < 0) underflowed = true;
      }
    }
    for (const child of node.children) visit(child);
  };
  visit(paragraph);
  return open === 0 && !underflowed;
}

/**
 * Memoized per part identity: parts are immutable (edits publish a new part object), so
 * the block list is a pure function of `(part, displayMode)`. Every keystroke flush asks
 * for the body's blocks from several callers — layout, section enumeration, furniture,
 * note pagination — and this walk ran fresh for each of them. A bounded WeakRef ring
 * rather than a plain WeakMap because undo history retains package snapshots by
 * reference; 16 slots cover one flush's parts (body + header/footer variants + notes).
 * Callers treat the result as read-only, so a shared array is safe to hand out.
 */
const storyBlocksCache = createRecentRootCache<Map<string, OoxmlElement[]>>(16);

/**
 * The story's blocks — paragraphs and tables — in document order, flattening through
 * block-level content-control wrappers under the shared nesting budget.
 *
 * Repeated calls with the same part and display mode return the SAME array instance,
 * shared by every caller — treat it as read-only; mutating it corrupts later callers.
 */
export function storyBlocks(
  part: OoxmlPart,
  displayMode: RevisionDisplayMode = 'all-markup',
  authorFilter?: RevisionAuthorFilter
): OoxmlElement[] {
  const key = `${displayMode}|${authorFilter?.cacheKey ?? ''}`;
  const perMode = storyBlocksCache.get(part);
  const cached = perMode?.get(key);
  if (cached) return cached;
  const root = storyRootOf(part);
  const blocks = root ? mergedFlowBlocks(root.children, displayMode, authorFilter) : [];
  if (perMode) cacheProjection(perMode, key, blocks);
  else storyBlocksCache.set(part, new Map([[key, blocks]]));
  return blocks;
}

/**
 * Blocks of one typed footnote/endnote node — a separate semantic story root.
 *
 * The footnotes/endnotes part root is never a story; each note is laid out independently
 * so line ids and incremental convergence stay namespaced by note identity.
 */
export function noteStoryBlocks(
  note: OoxmlNode,
  displayMode: RevisionDisplayMode = 'all-markup',
  authorFilter?: RevisionAuthorFilter
): OoxmlElement[] {
  if (note.kind !== 'note') return [];
  return mergedFlowBlocks(note.children, displayMode, authorFilter);
}

/**
 * Blocks of one `w:txbxContent` node — the story inside a text-box drawing.
 *
 * Like a note, a textbox is its own story root laid out independently of the part that
 * hosts the drawing, so line ids and incremental convergence stay namespaced by drawing
 * identity.
 */
export function textboxStoryBlocks(
  content: OoxmlNode,
  displayMode: RevisionDisplayMode = 'all-markup',
  authorFilter?: RevisionAuthorFilter
): OoxmlElement[] {
  if (content.kind === 'textValue') return [];
  return mergedFlowBlocks(content.children, displayMode, authorFilter);
}
