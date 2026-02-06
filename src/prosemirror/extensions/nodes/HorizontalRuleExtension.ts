/**
 * Horizontal Rule Extension
 */

import { createNodeExtension } from '../create';

export const HorizontalRuleExtension = createNodeExtension({
  name: 'horizontalRule',
  schemaNodeName: 'horizontalRule',
  nodeSpec: {
    group: 'block',
    parseDOM: [{ tag: 'hr' }],
    toDOM() {
      return ['hr'];
    },
  },
});
