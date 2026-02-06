/**
 * Comment Mark Extension — highlights text that has comments
 *
 * Applied to text ranges between commentRangeStart and commentRangeEnd.
 * The comment ID links to the Comment object in the document model.
 */

import { createMarkExtension } from '../create';

export const CommentExtension = createMarkExtension({
  name: 'comment',
  schemaMarkName: 'comment',
  markSpec: {
    attrs: {
      /** Comment ID (matches Comment.id) */
      commentId: { default: 0 },
    },
    inclusive: false,
    parseDOM: [
      {
        tag: 'span.docx-comment',
        getAttrs(dom) {
          const el = dom as HTMLElement;
          return {
            commentId: parseInt(el.dataset.commentId || '0', 10),
          };
        },
      },
    ],
    toDOM(mark) {
      return [
        'span',
        {
          class: 'docx-comment',
          'data-comment-id': String(mark.attrs.commentId),
          style:
            'background-color: rgba(255, 212, 0, 0.25); border-bottom: 2px solid rgba(255, 212, 0, 0.6);',
        },
        0,
      ];
    },
  },
});
