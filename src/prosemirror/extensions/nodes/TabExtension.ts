/**
 * Tab Extension — inline tab character node
 */

import { createNodeExtension } from '../create';

export const TabExtension = createNodeExtension({
  name: 'tab',
  schemaNodeName: 'tab',
  nodeSpec: {
    inline: true,
    group: 'inline',
    selectable: false,
    parseDOM: [
      {
        tag: 'span.docx-tab',
      },
    ],
    toDOM() {
      return [
        'span',
        {
          class: 'docx-tab',
          style: 'display: inline-block; min-width: 16px; white-space: pre;',
        },
        '\t',
      ];
    },
  },
});
