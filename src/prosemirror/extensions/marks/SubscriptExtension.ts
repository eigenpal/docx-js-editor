/**
 * Subscript Mark Extension
 */

import { toggleMark } from 'prosemirror-commands';
import { createMarkExtension } from '../create';
import type { ExtensionContext, ExtensionRuntime } from '../types';

export const SubscriptExtension = createMarkExtension({
  name: 'subscript',
  schemaMarkName: 'subscript',
  markSpec: {
    excludes: 'superscript',
    parseDOM: [{ tag: 'sub' }],
    toDOM() {
      return ['sub', 0];
    },
  },
  onSchemaReady(ctx: ExtensionContext): ExtensionRuntime {
    return {
      commands: {
        toggleSubscript: () => toggleMark(ctx.schema.marks.subscript),
      },
    };
  },
});
