import { toggleMark } from 'prosemirror-commands';
import { MarkType } from 'prosemirror-model';
import { EditorState, Command } from 'prosemirror-state';
import { schema } from './schema';

/**
 * Create a command to toggle a mark on the current selection
 */
export function toggleMarkCommand(markType: MarkType): Command {
  return toggleMark(markType);
}

/**
 * Check if a mark is active in the current selection
 */
export function isMarkActive(state: EditorState, markType: MarkType): boolean {
  const { from, $from, to, empty } = state.selection;

  if (empty) {
    return !!markType.isInSet(state.storedMarks || $from.marks());
  }

  return state.doc.rangeHasMark(from, to, markType);
}

/**
 * Toggle bold mark
 */
export const toggleBold: Command = toggleMark(schema.marks.bold);

/**
 * Toggle italic mark
 */
export const toggleItalic: Command = toggleMark(schema.marks.italic);

/**
 * Toggle underline mark
 */
export const toggleUnderline: Command = toggleMark(schema.marks.underline);

/**
 * Toggle strikethrough mark
 */
export const toggleStrikethrough: Command = toggleMark(schema.marks.strikethrough);

/**
 * Build the formatting keymap
 */
export function buildFormattingKeymap() {
  return {
    'Mod-b': toggleBold,
    'Mod-B': toggleBold,
    'Mod-i': toggleItalic,
    'Mod-I': toggleItalic,
    'Mod-u': toggleUnderline,
    'Mod-U': toggleUnderline,
  };
}
