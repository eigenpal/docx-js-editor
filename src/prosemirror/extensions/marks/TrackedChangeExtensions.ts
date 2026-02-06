/**
 * Tracked Change Mark Extensions — insertion and deletion marks
 *
 * Renders insertions with green underline and deletions with red strikethrough,
 * matching the standard MS Word display for tracked changes.
 */

import { createMarkExtension } from '../create';

/**
 * Insertion mark — text added in tracked changes
 * Renders with green color and underline.
 */
export const InsertionExtension = createMarkExtension({
  name: 'insertion',
  schemaMarkName: 'insertion',
  markSpec: {
    attrs: {
      revisionId: { default: 0 },
      author: { default: '' },
      date: { default: null },
    },
    inclusive: false,
    parseDOM: [
      {
        tag: 'span.docx-insertion',
        getAttrs(dom) {
          const el = dom as HTMLElement;
          return {
            revisionId: parseInt(el.dataset.revisionId || '0', 10),
            author: el.dataset.author || '',
            date: el.dataset.date || null,
          };
        },
      },
    ],
    toDOM(mark) {
      return [
        'span',
        {
          class: 'docx-insertion',
          'data-revision-id': String(mark.attrs.revisionId),
          'data-author': mark.attrs.author,
          ...(mark.attrs.date ? { 'data-date': mark.attrs.date } : {}),
          style: 'color: #2e7d32; text-decoration: underline; text-decoration-color: #2e7d32;',
        },
        0,
      ];
    },
  },
});

/**
 * Deletion mark — text removed in tracked changes
 * Renders with red color and strikethrough.
 */
export const DeletionExtension = createMarkExtension({
  name: 'deletion',
  schemaMarkName: 'deletion',
  markSpec: {
    attrs: {
      revisionId: { default: 0 },
      author: { default: '' },
      date: { default: null },
    },
    inclusive: false,
    parseDOM: [
      {
        tag: 'span.docx-deletion',
        getAttrs(dom) {
          const el = dom as HTMLElement;
          return {
            revisionId: parseInt(el.dataset.revisionId || '0', 10),
            author: el.dataset.author || '',
            date: el.dataset.date || null,
          };
        },
      },
    ],
    toDOM(mark) {
      return [
        'span',
        {
          class: 'docx-deletion',
          'data-revision-id': String(mark.attrs.revisionId),
          'data-author': mark.attrs.author,
          ...(mark.attrs.date ? { 'data-date': mark.attrs.date } : {}),
          style: 'color: #c62828; text-decoration: line-through; text-decoration-color: #c62828;',
        },
        0,
      ];
    },
  },
});
