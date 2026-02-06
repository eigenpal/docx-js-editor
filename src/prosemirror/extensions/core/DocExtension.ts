/**
 * Doc Extension — top-level document node
 */

import { createNodeExtension } from '../create';

export const DocExtension = createNodeExtension({
  name: 'doc',
  schemaNodeName: 'doc',
  nodeSpec: {
    content: '(paragraph | horizontalRule | table)+',
  },
});
