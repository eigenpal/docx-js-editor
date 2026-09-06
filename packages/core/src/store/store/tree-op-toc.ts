// TOC refresh TreeDocOps — replace result paragraphs / rewrite page-number runs.

import { detectBodyTocs, findDetectedToc, type DetectedToc } from '../package/toc-detect.ts';
import {
  bookmarkPairNodes,
  buildTocContentControl,
  buildTocEntryParagraph,
  type TocEntryPlan,
} from '../package/toc-build.ts';
import { parseTocInstruction, TOC_MAX_ENTRIES } from '../package/toc-instruction.ts';
import {
  createNodeIdAllocator,
  findNode,
  insertChildren,
  replaceChildren,
  type EditOptions,
} from '../package/ooxml-edit.ts';
import type { OoxmlElement, OoxmlNode, OoxmlPart } from '../package/ooxml-tree.ts';
import { MAX_INLINE_CONTAINER_DEPTH, nextInlineContainerDepth } from '../package/ooxml-shared.ts';
import {
  effectiveContentLockAt,
  effectiveLockOf,
  fromEdit,
  isBoundAt,
  isContentControlNode,
  ok,
  parentOf,
} from './tree-op-nodes.ts';
import { isValidXmlText } from '../package/sinks.ts';
import { nextBookmarkId } from './tree-op-bookmark-ids.ts';
import type { TreeDocOp, TreeOpEffect, TreeOpRejection, TreeOpResult } from './tree-op-types.ts';

export type ReplaceTocResultOp = Extract<TreeDocOp, { op: 'replaceTocResult' }>;
export type RewriteTocPageNumbersOp = Extract<TreeDocOp, { op: 'rewriteTocPageNumbers' }>;
export type InsertTocOp = Extract<TreeDocOp, { op: 'insertToc' }>;

function validateEntriesAndBookmarks(
  part: OoxmlPart,
  op: Pick<InsertTocOp, 'entries' | 'bookmarksToCreate'>
): TreeOpRejection | null {
  if (!Array.isArray(op.entries) || op.entries.length > TOC_MAX_ENTRIES) return 'invalidArgs';
  if (!Array.isArray(op.bookmarksToCreate) || op.bookmarksToCreate.length > TOC_MAX_ENTRIES) {
    return 'invalidArgs';
  }
  for (const entry of op.entries) {
    if (!Number.isInteger(entry.level) || entry.level < 0 || entry.level > 8) return 'invalidArgs';
    if (
      typeof entry.text !== 'string' ||
      entry.text.length > 200 ||
      !isValidXmlText(entry.text) ||
      typeof entry.headingParagraphId !== 'string' ||
      entry.headingParagraphId.length === 0 ||
      typeof entry.bookmarkName !== 'string' ||
      entry.bookmarkName.length === 0 ||
      entry.bookmarkName.length > 40 ||
      !isValidXmlText(entry.bookmarkName) ||
      typeof entry.pageNumberText !== 'string' ||
      entry.pageNumberText.length > 32 ||
      !isValidXmlText(entry.pageNumberText)
    ) {
      return 'invalidArgs';
    }
  }
  for (const bookmark of op.bookmarksToCreate) {
    if (
      typeof bookmark.paragraphId !== 'string' ||
      bookmark.paragraphId.length === 0 ||
      typeof bookmark.name !== 'string' ||
      bookmark.name.length === 0 ||
      bookmark.name.length > 40 ||
      !isValidXmlText(bookmark.name)
    ) {
      return 'invalidArgs';
    }
    const paragraph = findNode(part, bookmark.paragraphId);
    if (!paragraph || paragraph.kind !== 'paragraph') return 'unknown-paragraph';
    if (isBoundAt(part, bookmark.paragraphId)) return 'bound';
    if (effectiveContentLockAt(part, bookmark.paragraphId).content) return 'locked';
  }
  return null;
}

export function validateInsertToc(part: OoxmlPart, op: InsertTocOp): TreeOpRejection | null {
  if (
    typeof op.beforeParagraphId !== 'string' ||
    op.beforeParagraphId.length === 0 ||
    typeof op.alias !== 'string' ||
    op.alias.length === 0 ||
    op.alias.length > 128 ||
    !isValidXmlText(op.alias)
  ) {
    return 'invalidArgs';
  }
  if (!parseTocInstruction(op.instruction)) return 'invalidArgs';
  const paragraph = findNode(part, op.beforeParagraphId);
  if (!paragraph || paragraph.kind !== 'paragraph') return 'unknown-paragraph';
  const parent = parentOf(part, paragraph.id);
  if (!parent || parent.localName !== 'body') return 'not-a-block';
  if (isBoundAt(part, paragraph.id)) return 'bound';
  if (effectiveContentLockAt(part, paragraph.id).content) return 'locked';
  return validateEntriesAndBookmarks(part, op);
}

function tocRestriction(part: OoxmlPart, toc: DetectedToc): TreeOpRejection | null {
  for (const nodeId of [toc.beginParagraphId, ...toc.resultParagraphIds, toc.endParagraphId]) {
    if (isBoundAt(part, nodeId)) return 'bound';
    if (effectiveContentLockAt(part, nodeId).content) return 'locked';
  }
  if (toc.contentControlId) {
    const control = findNode(part, toc.contentControlId);
    if (control && isContentControlNode(control)) {
      const lock = effectiveLockOf(part, control);
      if (lock.content) return 'locked';
      if (isBoundAt(part, toc.contentControlId)) return 'bound';
    }
  }
  return null;
}

export function validateReplaceTocResult(
  part: OoxmlPart,
  op: ReplaceTocResultOp
): TreeOpRejection | null {
  if (typeof op.tocId !== 'string' || op.tocId.length === 0) return 'invalidArgs';
  const input = validateEntriesAndBookmarks(part, op);
  if (input) return input;
  const toc = findDetectedToc(detectBodyTocs(part), op.tocId);
  if (!toc) return 'unknown-block';
  return tocRestriction(part, toc);
}

export function validateRewriteTocPageNumbers(
  part: OoxmlPart,
  op: RewriteTocPageNumbersOp
): TreeOpRejection | null {
  if (typeof op.tocId !== 'string' || op.tocId.length === 0) return 'invalidArgs';
  if (!Array.isArray(op.updates) || op.updates.length > TOC_MAX_ENTRIES) return 'invalidArgs';
  for (const update of op.updates) {
    if (typeof update.paragraphId !== 'string' || update.paragraphId.length === 0) {
      return 'invalidArgs';
    }
    if (
      typeof update.pageNumberText !== 'string' ||
      update.pageNumberText.length > 32 ||
      !isValidXmlText(update.pageNumberText)
    ) {
      return 'invalidArgs';
    }
  }
  const toc = findDetectedToc(detectBodyTocs(part), op.tocId);
  if (!toc) return 'unknown-block';
  if (op.updates.some((update) => !toc.resultParagraphIds.includes(update.paragraphId))) {
    return 'invalidArgs';
  }
  return tocRestriction(part, toc);
}

function insertBookmarks(
  part: OoxmlPart,
  bookmarks: readonly { paragraphId: string; name: string }[],
  options?: EditOptions
): TreeOpResult {
  let current = part;
  const mint = createNodeIdAllocator(current);
  const mintBookmarkId = nextBookmarkId(current);
  const dirty: string[] = [];
  for (const bookmark of bookmarks) {
    const paragraph = findNode(current, bookmark.paragraphId);
    if (!paragraph || paragraph.kind === 'textValue') {
      return { ok: false, reason: 'unknown-paragraph' };
    }
    const bookmarkId = mintBookmarkId();
    const pair = bookmarkPairNodes(mint, bookmark.name, bookmarkId);
    // Place start at front (after pPr if any), end at end.
    const children = [...paragraph.children];
    let insertAt = 0;
    if (children[0] && children[0].kind !== 'textValue' && children[0].localName === 'pPr') {
      insertAt = 1;
    }
    children.splice(insertAt, 0, pair.start);
    children.push(pair.end);
    const replaced = replaceChildren(current, paragraph.id, children, options);
    if (!replaced.ok) return { ok: false, reason: 'tree-invariant', detail: 'bookmark-insert' };
    current = replaced.part;
    dirty.push(paragraph.id);
  }
  return ok(current, {
    dirty,
    created: [],
    deleted: [],
    dependencyKeys: dirty,
    impact: 'flow-structural',
  });
}

function replaceResultParagraphs(
  part: OoxmlPart,
  toc: DetectedToc,
  entries: readonly TocEntryPlan[],
  options?: EditOptions
): TreeOpResult {
  const container = findNode(part, toc.containerId);
  if (!container || container.kind === 'textValue') {
    return { ok: false, reason: 'unknown-block' };
  }
  const beginIdx = container.children.findIndex((child) => child.id === toc.beginParagraphId);
  const endIdx = container.children.findIndex((child) => child.id === toc.endParagraphId);
  if (beginIdx < 0 || endIdx < 0 || endIdx <= beginIdx) {
    return { ok: false, reason: 'invalidArgs' };
  }

  // Word commonly stores TOC geometry directly on each cached result paragraph even when a
  // TOC1…TOC9 style is also present. Preserve one template per level so refresh does not
  // discard document-specific tabs, indents, spacing, or bidi settings. Fresh ids are minted
  // by the builder; only the formatting shape is reused.
  const propertiesByStyle = new Map<string, OoxmlNode>();
  for (const paragraphId of toc.resultParagraphIds) {
    const paragraph = findNode(part, paragraphId);
    if (!paragraph || paragraph.kind === 'textValue') continue;
    const properties = paragraph.children.find(
      (child) => child.kind !== 'textValue' && child.localName === 'pPr'
    );
    if (!properties || properties.kind === 'textValue') continue;
    const style = properties.children.find(
      (child) => child.kind !== 'textValue' && child.localName === 'pStyle'
    );
    if (style?.kind === 'textValue') continue;
    const styleId = style?.attributes.find((attribute) => attribute.localName === 'val')?.value;
    if (styleId?.startsWith('TOC') && !propertiesByStyle.has(styleId)) {
      propertiesByStyle.set(styleId, properties);
    }
  }
  const mint = createNodeIdAllocator(part);
  const newEntries = entries.map((entry) => {
    const styleId = `TOC${Math.min(entry.level + 1, 9)}`;
    return buildTocEntryParagraph(mint, entry, toc.instruction, propertiesByStyle.get(styleId));
  });
  const nextChildren = [
    ...container.children.slice(0, beginIdx + 1),
    ...newEntries,
    ...container.children.slice(endIdx),
  ];
  const deleted = toc.resultParagraphIds;
  const created = newEntries.map((node) => node.id);
  const replaced = replaceChildren(part, container.id, nextChildren, options);
  if (!replaced.ok) return { ok: false, reason: 'tree-invariant' };
  const effect: TreeOpEffect = {
    dirty: [toc.beginParagraphId, toc.endParagraphId, ...created],
    created,
    deleted,
    dependencyKeys: [toc.containerId],
    impact: 'flow-structural',
  };
  return fromEdit(replaced, effect);
}

export function applyInsertToc(
  part: OoxmlPart,
  op: InsertTocOp,
  options?: EditOptions
): TreeOpResult {
  let current = part;
  if (op.bookmarksToCreate.length > 0) {
    const booked = insertBookmarks(current, op.bookmarksToCreate, options);
    if (!booked.ok || !booked.part) return booked;
    current = booked.part;
  }
  const instruction = parseTocInstruction(op.instruction);
  const paragraph = findNode(current, op.beforeParagraphId);
  if (!instruction || !paragraph || paragraph.kind !== 'paragraph') {
    return { ok: false, reason: 'invalidArgs' };
  }
  const parent = parentOf(current, paragraph.id);
  if (!parent || parent.localName !== 'body') return { ok: false, reason: 'not-a-block' };
  const index = parent.children.findIndex((child) => child.id === paragraph.id);
  if (index < 0) return { ok: false, reason: 'tree-invariant' };
  const mint = createNodeIdAllocator(current);
  const control = buildTocContentControl(mint, op.entries, instruction, op.alias);
  const inserted = insertChildren(current, parent.id, index, [control], options);
  return fromEdit(inserted, {
    dirty: [parent.id, ...op.entries.map((entry) => entry.headingParagraphId)],
    created: [control.id],
    deleted: [],
    dependencyKeys: [parent.id],
    impact: 'flow-structural',
  });
}

export function applyReplaceTocResult(
  part: OoxmlPart,
  op: ReplaceTocResultOp,
  options?: EditOptions
): TreeOpResult {
  const toc = findDetectedToc(detectBodyTocs(part), op.tocId);
  if (!toc) return { ok: false, reason: 'unknown-block' };

  let current = part;
  if (op.bookmarksToCreate.length > 0) {
    const booked = insertBookmarks(current, op.bookmarksToCreate, options);
    if (!booked.ok || !booked.part) return booked;
    current = booked.part;
  }

  // Re-detect after bookmark inserts (ids stable for TOC chrome).
  const tocAfter = findDetectedToc(detectBodyTocs(current), op.tocId);
  if (!tocAfter) return { ok: false, reason: 'unknown-block' };

  const entries: TocEntryPlan[] = op.entries.map((entry) => ({
    level: entry.level,
    text: entry.text,
    headingParagraphId: entry.headingParagraphId,
    bookmarkName: entry.bookmarkName,
    pageNumberText: entry.pageNumberText,
  }));

  return replaceResultParagraphs(current, tocAfter, entries, options);
}

/** Walk a TOC entry paragraph and rewrite the last text run that looks like a page number. */
function rewritePageNumberInParagraph(
  paragraph: OoxmlElement,
  pageNumberText: string,
  mint: () => string
): OoxmlElement | null {
  // Find text nodes inside hyperlink or direct runs; replace the last w:t.
  const texts: OoxmlNode[] = [];
  let hasPageTab = false;
  const walk = (node: OoxmlNode, depth: number): void => {
    if (depth >= MAX_INLINE_CONTAINER_DEPTH) return;
    if (node.kind === 'tab' || (node.kind !== 'textValue' && node.localName === 'ptab')) {
      hasPageTab = true;
    }
    if (node.kind === 'text' || (node.kind !== 'textValue' && node.localName === 't')) {
      texts.push(node);
      return;
    }
    if (node.kind === 'textValue') return;
    const childDepth = nextInlineContainerDepth(node, depth);
    for (const child of node.children) walk(child, childDepth);
  };
  walk(paragraph, 0);
  if (!hasPageTab || texts.length < 2) return null;
  const target = texts[texts.length - 1]!;
  if (target.kind === 'textValue') return null;
  const targetId = target.id;
  let currentText = '';
  for (const child of target.children) {
    if (child.kind === 'textValue') currentText += child.value;
  }
  if (currentText === pageNumberText) return null;
  const rewrite = (node: OoxmlNode): OoxmlNode => {
    if (node.kind === 'textValue') return node;
    if (node.id === targetId) {
      return {
        ...node,
        children: [{ id: mint(), kind: 'textValue', value: pageNumberText }],
      } as OoxmlNode;
    }
    const children = node.children.map(rewrite);
    return children.some((child, index) => child !== node.children[index])
      ? ({ ...node, children } as OoxmlNode)
      : node;
  };
  return rewrite(paragraph) as OoxmlElement;
}

export function applyRewriteTocPageNumbers(
  part: OoxmlPart,
  op: RewriteTocPageNumbersOp,
  options?: EditOptions
): TreeOpResult {
  const toc = findDetectedToc(detectBodyTocs(part), op.tocId);
  if (!toc) return { ok: false, reason: 'unknown-block' };

  let current = part;
  const mint = createNodeIdAllocator(current);
  const dirty: string[] = [];

  for (const update of op.updates) {
    if (!toc.resultParagraphIds.includes(update.paragraphId)) continue;
    const paragraph = findNode(current, update.paragraphId);
    if (!paragraph || paragraph.kind === 'textValue') continue;
    const rewritten = rewritePageNumberInParagraph(
      paragraph as OoxmlElement,
      update.pageNumberText,
      mint
    );
    if (!rewritten) continue;
    const parent = parentOf(current, paragraph.id);
    if (!parent) return { ok: false, reason: 'unknown-block' };
    const siblings = parent.children.map((child) =>
      child.id === paragraph.id ? rewritten : child
    );
    const replaced = replaceChildren(current, parent.id, siblings, options);
    if (!replaced.ok) return { ok: false, reason: 'tree-invariant' };
    current = replaced.part;
    dirty.push(update.paragraphId);
  }

  if (dirty.length === 0) {
    return ok(current, {
      dirty: [],
      created: [],
      deleted: [],
      dependencyKeys: [],
      impact: 'text-local',
    });
  }

  return ok(current, {
    dirty,
    created: [],
    deleted: [],
    dependencyKeys: dirty,
    impact: 'text-local',
  });
}
