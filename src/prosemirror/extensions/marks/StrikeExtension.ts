/**
 * Strikethrough Mark Extension
 */

import { toggleMark } from 'prosemirror-commands';
import { createMarkExtension } from '../create';
import type { ExtensionContext, ExtensionRuntime } from '../types';

export const StrikeExtension = createMarkExtension({
  name: 'strike',
  schemaMarkName: 'strike',
  markSpec: {
    attrs: {
      double: { default: false },
    },
    parseDOM: [
      { tag: 's' },
      { tag: 'strike' },
      { tag: 'del' },
      {
        style: 'text-decoration',
        getAttrs: (value) => ((value as string).includes('line-through') ? {} : false),
      },
    ],
    toDOM() {
      return ['s', 0];
    },
  },
  onSchemaReady(ctx: ExtensionContext): ExtensionRuntime {
    return {
      commands: {
        toggleStrike: () => toggleMark(ctx.schema.marks.strike),
      },
    };
  },
});
