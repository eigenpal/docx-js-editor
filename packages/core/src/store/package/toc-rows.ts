// Resolve a cached TOC result row back to the heading it stands for.
//
// A refresh that only rewrites page numbers must not assume the cached rows line up with the
// current outline: the whole reason the command exists is that they may not. Word matches a
// row to its heading through the row's own `PAGEREF`, so this reads the row's identity from
// the row — its hyperlink anchor first, its title text second — and never from its position.

import { buildBookmarkIndex } from './bookmarks.ts';
import { hyperlinkAnchorOf } from './hyperlink.ts';
import { findNode } from './ooxml-edit.ts';
import type { OoxmlNode, OoxmlPart } from './ooxml-tree.ts';
import { MAX_INLINE_CONTAINER_DEPTH, nextInlineContainerDepth } from './ooxml-shared.ts';
import { tocEntryText, type TocOutlineHeading } from './toc-build.ts';
import type { DetectedToc } from './toc-detect.ts';

/** The anchor of the first `w:hyperlink` in a row, or undefined for a plain row. */
function rowAnchor(paragraph: OoxmlNode, depth = 0): string | undefined {
  if (paragraph.kind === 'textValue') return undefined;
  if (depth >= MAX_INLINE_CONTAINER_DEPTH) return undefined;
  if (paragraph.kind === 'hyperlink') {
    const anchor = hyperlinkAnchorOf(paragraph);
    if (anchor !== undefined && anchor.length > 0) return anchor;
  }
  const childDepth = nextInlineContainerDepth(paragraph, depth);
  for (const child of paragraph.children) {
    if (child.kind === 'textValue') continue;
    const nested = rowAnchor(child, childDepth);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

/**
 * A row's title: the text before the tab that carries the page number.
 *
 * Everything from the first tab or `w:ptab` on is leader and page number, which say nothing
 * about which heading the row names.
 */
function rowTitle(paragraph: OoxmlNode): string {
  let title = '';
  let done = false;
  const walk = (node: OoxmlNode, depth: number): void => {
    if (done || node.kind === 'textValue') return;
    if (depth >= MAX_INLINE_CONTAINER_DEPTH) return;
    if (node.kind === 'tab' || node.localName === 'ptab' || node.localName === 'tab') {
      done = true;
      return;
    }
    if (node.kind === 'text' || node.localName === 't') {
      for (const child of node.children) {
        if (child.kind === 'textValue') title += child.value;
      }
      return;
    }
    const childDepth = nextInlineContainerDepth(node, depth);
    for (const child of node.children) walk(child, childDepth);
  };
  walk(paragraph, 0);
  return tocEntryText(title);
}

/**
 * The heading each cached result row stands for, aligned with `toc.resultParagraphIds`.
 *
 * `null` for a row that names no heading this document still has — a stale row, or the
 * chrome/blank paragraphs a cached result can carry. Callers leave those alone rather than
 * writing another row's number into them.
 */
export function resolveTocRowHeadings(
  part: OoxmlPart,
  toc: DetectedToc,
  outline: readonly TocOutlineHeading[],
  excludeParagraphIds: ReadonlySet<string>
): readonly (string | null)[] {
  const candidates = outline.filter((heading) => {
    if (excludeParagraphIds.has(heading.blockId)) return false;
    const oneBased = heading.level + 1;
    return oneBased >= toc.instruction.outlineStart && oneBased <= toc.instruction.outlineEnd;
  });
  const byParagraphId = new Set(candidates.map((heading) => heading.blockId));

  const bookmarks = buildBookmarkIndex(part);
  // Titles are matched in document order and consumed as they are used, so two headings that
  // share a title still resolve to distinct rows.
  const unusedByTitle = new Map<string, string[]>();
  for (const heading of candidates) {
    const key = tocEntryText(heading.text);
    const bucket = unusedByTitle.get(key);
    if (bucket) bucket.push(heading.blockId);
    else unusedByTitle.set(key, [heading.blockId]);
  }

  return toc.resultParagraphIds.map((paragraphId) => {
    const paragraph = findNode(part, paragraphId);
    if (!paragraph || paragraph.kind === 'textValue') return null;

    const anchor = rowAnchor(paragraph);
    const anchored = anchor === undefined ? undefined : bookmarks.get(anchor);
    if (anchored && byParagraphId.has(anchored.paragraphId)) {
      const bucket = unusedByTitle.get(
        tocEntryText(
          candidates.find((heading) => heading.blockId === anchored.paragraphId)?.text ?? ''
        )
      );
      const at = bucket?.indexOf(anchored.paragraphId) ?? -1;
      if (bucket && at >= 0) bucket.splice(at, 1);
      return anchored.paragraphId;
    }

    const title = rowTitle(paragraph);
    if (title.length === 0) return null;
    const bucket = unusedByTitle.get(title);
    if (!bucket || bucket.length === 0) return null;
    return bucket.shift() ?? null;
  });
}
