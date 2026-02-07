/**
 * Base Keymap Extension — wraps prosemirror-commands baseKeymap
 *
 * Priority: Low (150) — must be the last keymap so other extensions can override keys
 */

import {
  baseKeymap,
  splitBlock,
  deleteSelection,
  joinBackward,
  joinForward,
  selectAll,
  selectParentNode,
} from 'prosemirror-commands';
import { createExtension } from '../create';
import { Priority } from '../types';
import type { ExtensionRuntime, ExtensionContext } from '../types';
import type { Command } from 'prosemirror-state';

function chainCommands(...commands: Command[]): Command {
  return (state, dispatch, view) => {
    for (const cmd of commands) {
      if (cmd(state, dispatch, view)) {
        return true;
      }
    }
    return false;
  };
}

export const BaseKeymapExtension = createExtension({
  name: 'baseKeymap',
  priority: Priority.Low,
  onSchemaReady(_ctx: ExtensionContext): ExtensionRuntime {
    return {
      keyboardShortcuts: {
        // Base keymap provides default editing commands
        ...baseKeymap,
        // Override some keys with better defaults
        Enter: splitBlock,
        Backspace: chainCommands(deleteSelection, joinBackward),
        Delete: chainCommands(deleteSelection, joinForward),
        'Mod-a': selectAll,
        Escape: selectParentNode,
      },
    };
  },
});
