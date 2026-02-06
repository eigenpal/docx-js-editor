/**
 * Comment Parser - Parse comments.xml
 *
 * Parses OOXML comments (w:comment) from comments.xml file.
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
 * Parse comments.xml into an array of Comment objects
 */
export function parseComments(
  commentsXml: string | null,
  styles: StyleMap | null,
  theme: Theme | null,
  rels: RelationshipMap,
  media: Map<string, MediaFile>
): Comment[] {
  if (!commentsXml) return [];

  const root = parseXml(commentsXml);
  if (!root) return [];

  const commentsEl = findChild(root, 'w', 'comments') ?? root;
  const children = getChildElements(commentsEl);
  const comments: Comment[] = [];

  for (const child of children) {
    const localName = child.name?.replace(/^.*:/, '') ?? '';
    if (localName !== 'comment') continue;

    const id = parseInt(getAttribute(child, 'w', 'id') ?? '0', 10);
    const author = getAttribute(child, 'w', 'author') ?? 'Unknown';
    const initials = getAttribute(child, 'w', 'initials') ?? undefined;
    const date = getAttribute(child, 'w', 'date') ?? undefined;

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
