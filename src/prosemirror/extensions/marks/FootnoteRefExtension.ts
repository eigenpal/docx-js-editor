/**
 * Footnote Reference Mark Extension
 */

import { createMarkExtension } from '../create';

export const FootnoteRefExtension = createMarkExtension({
  name: 'footnoteRef',
  schemaMarkName: 'footnoteRef',
  markSpec: {
    attrs: {
      id: {},
      noteType: { default: 'footnote' },
    },
    parseDOM: [
      {
        tag: 'sup.docx-footnote-ref',
        getAttrs: (dom) => {
          const element = dom as HTMLElement;
          return {
            id: element.dataset.id || '',
            noteType: element.dataset.noteType || 'footnote',
          };
        },
      },
    ],
    toDOM(mark) {
      const attrs = mark.attrs as { id: string; noteType: string };
      return [
        'sup',
        {
          class: `docx-${attrs.noteType}-ref`,
          'data-id': attrs.id,
          'data-note-type': attrs.noteType,
        },
        0,
      ];
    },
  },
});
