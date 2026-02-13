/**
 * Comment Parser - Parse comments.xml and commentsExtensible.xml
 *
 * Parses OOXML comments (w:comment) from comments.xml file.
 * Cross-references with commentsExtensible.xml (or commentsExtended.xml)
 * to obtain reliable UTC timestamps via w16cex:dateUtc.
 *
 * Note: Microsoft Word stores w:date as local time WITHOUT timezone offset,
 * which is ambiguous. The reliable UTC timestamp lives in the separate
 * commentsExtensible.xml part (Word 2016+).
 *
 * OOXML Reference:
 * - Comments: w:comments
 * - Comment: w:comment (w:id, w:author, w:date, w:initials)
 * - Comment content: child w:p elements
 */

import type { Comment, Paragraph, Theme, RelationshipMap, MediaFile } from '../types/document';
import type { StyleMap } from './styleParser';
import { parseXml, findChild, getChildElements, getAttribute } from './xmlParser';
import { parseParagraph } from './paragraphParser';

/**
 * Build a lookup from paraId → dateUtc from commentsExtensible.xml
 *
 * The XML structure is:
 * <w16cex:commentsExtensible>
 *   <w16cex:comment w16cex:paraId="..." w16cex:dateUtc="2024-02-10T14:30:45Z"/>
 * </w16cex:commentsExtensible>
 */
function parseCommentsExtensible(xml: string): Map<string, string> {
  const dateUtcByParaId = new Map<string, string>();

  const root = parseXml(xml);
  if (!root) return dateUtcByParaId;

  // Find the root element (may be w16cex:commentsExtensible or similar)
  const container = findChild(root, 'w16cex', 'commentsExtensible') ?? root;
  for (const child of getChildElements(container)) {
    const localName = child.name?.replace(/^.*:/, '') ?? '';
    if (localName !== 'comment') continue;

    // Try multiple namespace prefixes since they vary between Word versions
    const paraId =
      getAttribute(child, 'w16cex', 'paraId') ??
      getAttribute(child, 'w15', 'paraId') ??
      child.attributes?.['w16cex:paraId'] ??
      child.attributes?.['w15:paraId'];

    const dateUtc =
      getAttribute(child, 'w16cex', 'dateUtc') ??
      getAttribute(child, 'w15', 'dateUtc') ??
      child.attributes?.['w16cex:dateUtc'] ??
      child.attributes?.['w15:dateUtc'];

    if (paraId && dateUtc) {
      dateUtcByParaId.set(String(paraId).toUpperCase(), String(dateUtc));
    }
  }

  return dateUtcByParaId;
}

/**
 * Parse comments.xml into an array of Comment objects.
 *
 * If commentsExtensibleXml is provided, UTC timestamps are cross-referenced
 * via paraId and preferred over the ambiguous w:date local time.
 */
export function parseComments(
  commentsXml: string | null,
  styles: StyleMap | null,
  theme: Theme | null,
  rels: RelationshipMap,
  media: Map<string, MediaFile>,
  commentsExtensibleXml?: string | null
): Comment[] {
  if (!commentsXml) return [];

  const root = parseXml(commentsXml);
  if (!root) return [];

  // Build UTC date lookup from extended comments (if available)
  const dateUtcByParaId = commentsExtensibleXml
    ? parseCommentsExtensible(commentsExtensibleXml)
    : new Map<string, string>();

  const commentsEl = findChild(root, 'w', 'comments') ?? root;
  const children = getChildElements(commentsEl);
  const comments: Comment[] = [];

  for (const child of children) {
    const localName = child.name?.replace(/^.*:/, '') ?? '';
    if (localName !== 'comment') continue;

    const id = parseInt(getAttribute(child, 'w', 'id') ?? '0', 10);
    const author = getAttribute(child, 'w', 'author') ?? 'Unknown';
    const rawInitials = getAttribute(child, 'w', 'initials');
    const initials = rawInitials != null ? String(rawInitials) : undefined;
    const rawDate = getAttribute(child, 'w', 'date');
    const localDate = rawDate != null ? String(rawDate) : undefined;

    // Try to find the UTC date from commentsExtensible.xml via paraId
    const paraId =
      getAttribute(child, 'w14', 'paraId') ??
      child.attributes?.['w14:paraId'] ??
      getAttribute(child, 'w', 'paraId');
    const dateUtc = paraId ? dateUtcByParaId.get(String(paraId).toUpperCase()) : undefined;

    // Prefer UTC date over ambiguous local date
    const date = dateUtc ?? localDate;

    // Parse comment content (paragraphs)
    const paragraphs: Paragraph[] = [];
    for (const contentChild of getChildElements(child)) {
      const contentName = contentChild.name?.replace(/^.*:/, '') ?? '';
      if (contentName === 'p') {
        const paragraph = parseParagraph(contentChild, styles, theme, null, rels, media);
        paragraphs.push(paragraph);
      }
    }

    comments.push({
      id,
      author,
      initials,
      date,
      content: paragraphs,
    });
  }

  return comments;
}
