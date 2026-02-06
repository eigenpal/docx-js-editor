/**
 * Hard Break Extension — Shift+Enter line break
 */

import { createNodeExtension } from '../create';
import type { ExtensionContext, ExtensionRuntime } from '../types';

export const HardBreakExtension = createNodeExtension({
  name: 'hardBreak',
  schemaNodeName: 'hardBreak',
  nodeSpec: {
    inline: true,
    group: 'inline',
    selectable: false,
    parseDOM: [{ tag: 'br' }],
    toDOM() {
      return ['br'];
    },
  },
  onSchemaReady(ctx: ExtensionContext): ExtensionRuntime {
    const hardBreakType = ctx.schema.nodes.hardBreak;

    return {
      keyboardShortcuts: {
        'Shift-Enter': (state, dispatch) => {
          if (dispatch) {
            dispatch(state.tr.replaceSelectionWith(hardBreakType.create()).scrollIntoView());
          }
          return true;
        },
      },
    };
  },
});
