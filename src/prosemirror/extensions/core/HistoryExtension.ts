/**
 * History Extension — undo/redo via prosemirror-history
 */

import { history, undo, redo } from 'prosemirror-history';
import { createExtension } from '../create';
import type { ExtensionRuntime } from '../types';

export const HistoryExtension = createExtension<{ depth?: number; newGroupDelay?: number }>({
  name: 'history',
  defaultOptions: { depth: 100, newGroupDelay: 500 },
  onSchemaReady(_ctx, options): ExtensionRuntime {
    return {
      plugins: [
        history({
          depth: options.depth,
          newGroupDelay: options.newGroupDelay,
        }),
      ],
      commands: {
        undo: () => undo,
        redo: () => redo,
      },
      keyboardShortcuts: {
        'Mod-z': undo,
        'Mod-y': redo,
        'Mod-Shift-z': redo,
      },
    };
  },
});
