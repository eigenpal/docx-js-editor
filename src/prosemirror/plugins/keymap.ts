/**
 * ProseMirror Keymap Plugin
 *
 * Defines keyboard shortcuts for the DOCX editor:
 * - Formatting: Ctrl+B (bold), Ctrl+I (italic), Ctrl+U (underline)
 * - Editing: Enter (split paragraph), Backspace/Delete
 * - Selection: Ctrl+A (select all)
 * - History: Ctrl+Z (undo), Ctrl+Y/Ctrl+Shift+Z (redo)
 */

import { keymap } from 'prosemirror-keymap';
import {
  baseKeymap,
  toggleMark,
  splitBlock,
  deleteSelection,
  joinBackward,
  joinForward,
  selectAll,
  selectParentNode,
} from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import type { Command } from 'prosemirror-state';
import type { Schema } from 'prosemirror-model';

/**
 * Create the full keymap for the DOCX editor
 */
export function createKeymap(schema: Schema) {
  const customKeymap: Record<string, Command> = {
    // History
    'Mod-z': undo,
    'Mod-y': redo,
    'Mod-Shift-z': redo,

    // Formatting
    'Mod-b': toggleMark(schema.marks.bold),
    'Mod-i': toggleMark(schema.marks.italic),
    'Mod-u': toggleMark(schema.marks.underline),

    // Selection
    'Mod-a': selectAll,

    // Editing
    Enter: splitBlock,
    Backspace: chainCommands(deleteSelection, joinBackward),
    Delete: chainCommands(deleteSelection, joinForward),

    // Navigation
    Escape: selectParentNode,
  };

  return keymap(customKeymap);
}

/**
 * Create the base keymap with default editing commands
 */
export function createBaseKeymap() {
  return keymap(baseKeymap);
}

/**
 * Chain multiple commands - try each in order until one succeeds
 */
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
 * Command to insert a hard break (Shift+Enter)
 */
export function insertHardBreak(schema: Schema): Command {
  const hardBreakType = schema.nodes.hardBreak;
  if (!hardBreakType) {
    return () => false;
  }

  return (state, dispatch) => {
    if (dispatch) {
      dispatch(state.tr.replaceSelectionWith(hardBreakType.create()).scrollIntoView());
    }
    return true;
  };
}

/**
 * Command to exit a list when pressing Enter on an empty list item
 */
export function exitListOnEmptyEnter(): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty) return false;

    // Check if we're in a list paragraph (has numPr)
    const paragraph = $from.parent;
    if (paragraph.type.name !== 'paragraph') return false;

    const numPr = paragraph.attrs.numPr;
    if (!numPr) return false;

    // Check if paragraph is empty
    if (paragraph.textContent.length > 0) return false;

    // Remove list formatting from this paragraph
    if (dispatch) {
      const tr = state.tr.setNodeMarkup($from.before(), undefined, {
        ...paragraph.attrs,
        numPr: null,
      });
      dispatch(tr);
    }
    return true;
  };
}

/**
 * Command to increase list indent (Tab in list)
 */
export function increaseListIndent(): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    const paragraph = $from.parent;

    if (paragraph.type.name !== 'paragraph') return false;

    const numPr = paragraph.attrs.numPr;
    if (!numPr) return false;

    const currentLevel = numPr.ilvl ?? 0;
    if (currentLevel >= 8) return false; // Max level

    if (dispatch) {
      const tr = state.tr.setNodeMarkup($from.before(), undefined, {
        ...paragraph.attrs,
        numPr: { ...numPr, ilvl: currentLevel + 1 },
      });
      dispatch(tr);
    }
    return true;
  };
}

/**
 * Command to decrease list indent (Shift+Tab in list)
 */
export function decreaseListIndent(): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    const paragraph = $from.parent;

    if (paragraph.type.name !== 'paragraph') return false;

    const numPr = paragraph.attrs.numPr;
    if (!numPr) return false;

    const currentLevel = numPr.ilvl ?? 0;
    if (currentLevel <= 0) {
      // At level 0, remove list entirely
      if (dispatch) {
        const tr = state.tr.setNodeMarkup($from.before(), undefined, {
          ...paragraph.attrs,
          numPr: null,
        });
        dispatch(tr);
      }
      return true;
    }

    if (dispatch) {
      const tr = state.tr.setNodeMarkup($from.before(), undefined, {
        ...paragraph.attrs,
        numPr: { ...numPr, ilvl: currentLevel - 1 },
      });
      dispatch(tr);
    }
    return true;
  };
}

/**
 * Create keymap with list-aware Tab handling
 */
export function createListKeymap() {
  return keymap({
    Tab: increaseListIndent(),
    'Shift-Tab': decreaseListIndent(),
    'Shift-Enter': () => false, // Let base keymap handle this
  });
}

/**
 * Create the complete keymap stack for the editor
 */
export function createEditorKeymaps(schema: Schema) {
  return [createListKeymap(), createKeymap(schema), createBaseKeymap()];
}
