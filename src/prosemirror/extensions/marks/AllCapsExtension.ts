/**
 * All Caps Mark Extension (w:caps)
 */

import { createMarkExtension } from '../create';

export const AllCapsExtension = createMarkExtension({
  name: 'allCaps',
  schemaMarkName: 'allCaps',
  markSpec: {
    parseDOM: [
      {
        style: 'text-transform',
        getAttrs: (value) => (value === 'uppercase' ? {} : false),
      },
    ],
    toDOM() {
      return ['span', { style: 'text-transform: uppercase' }, 0];
    },
  },
});
