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

/**
 * Backspace at the start of a paragraph clears first-line indent / hanging indent
 * before joining with the previous paragraph (matches Word behavior).
 */
const clearIndentOnBackspace: Command = (state, dispatch) => {
  const { $cursor } = state.selection as {
    $cursor?: {
      parentOffset: number;
      parent: { type: { name: string }; attrs: Record<string, unknown> };
      pos: number;
      before: () => number;
    };
  };
  if (!$cursor) return false;

  // Only at the very start of a paragraph
  if ($cursor.parentOffset !== 0) return false;
  if ($cursor.parent.type.name !== 'paragraph') return false;

  const attrs = $cursor.parent.attrs;
  const hasFirstLine = attrs.indentFirstLine != null && (attrs.indentFirstLine as number) > 0;
  const hasHanging = !!attrs.hangingIndent;
  const hasIndentLeft = attrs.indentLeft != null && (attrs.indentLeft as number) > 0;

  if (!hasFirstLine && !hasHanging && !hasIndentLeft) return false;

  if (dispatch) {
    const pos = $cursor.before();
    const tr = state.tr.setNodeMarkup(pos, undefined, {
      ...attrs,
      indentFirstLine: null,
      hangingIndent: null,
      indentLeft: null,
    });
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/**
 * Custom Enter handler that splits the block and clears paragraph borders
 * on the new paragraph. In Word, pressing Enter does NOT propagate paragraph
 * borders (w:pBdr) to the new paragraph. This matches that behavior.
 */
const splitBlockClearBorders: Command = (state, dispatch, view) => {
  // First, perform the standard split
  if (!splitBlock(state, dispatch, view)) {
    return false;
  }

  // After split, the cursor is in the new (second) paragraph.
  // We need to clear borders on it. Since splitBlock already dispatched,
  // we need to work with the updated state from the view.
  if (dispatch && view) {
    const newState = view.state;
    const { $from } = newState.selection;
    const paragraph = $from.parent;

    if (paragraph.type.name === 'paragraph' && paragraph.attrs.borders) {
      const pos = $from.before();
      const tr = newState.tr.setNodeMarkup(pos, undefined, {
        ...paragraph.attrs,
        borders: null,
      });
      dispatch(tr.scrollIntoView());
    }
  }

  return true;
};

export const BaseKeymapExtension = createExtension({
  name: 'baseKeymap',
  priority: Priority.Low,
  onSchemaReady(_ctx: ExtensionContext): ExtensionRuntime {
    return {
      keyboardShortcuts: {
        // Base keymap provides default editing commands
        ...baseKeymap,
        // Override some keys with better defaults
        Enter: splitBlockClearBorders,
        Backspace: chainCommands(deleteSelection, clearIndentOnBackspace, joinBackward),
        Delete: chainCommands(deleteSelection, joinForward),
        'Mod-a': selectAll,
        Escape: selectParentNode,
      },
    };
  },
});
