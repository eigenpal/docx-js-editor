/**
 * Small Caps Mark Extension (w:smallCaps)
 */

import { createMarkExtension } from '../create';

export const SmallCapsExtension = createMarkExtension({
  name: 'smallCaps',
  schemaMarkName: 'smallCaps',
  markSpec: {
    parseDOM: [
      {
        style: 'font-variant',
        getAttrs: (value) => (value === 'small-caps' ? {} : false),
      },
    ],
    toDOM() {
      return ['span', { style: 'font-variant: small-caps' }, 0];
    },
  },
});
