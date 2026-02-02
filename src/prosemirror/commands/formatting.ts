/**
 * Text Formatting Commands
 *
 * ProseMirror commands for toggling and setting text formatting marks:
 * - Toggle marks: bold, italic, underline, strike
 * - Set marks: text color, highlight, font size, font family
 * - Clear formatting
 */

import { toggleMark } from 'prosemirror-commands';
import type { Command, EditorState } from 'prosemirror-state';
import type { MarkType } from 'prosemirror-model';
import { schema } from '../schema';
import type { TextColorAttrs } from '../schema';

// Helper type for mark attributes
type MarkAttrs = Record<string, unknown>;

// ============================================================================
// TOGGLE MARKS (simple on/off)
// ============================================================================

/**
 * Toggle bold mark
 */
export const toggleBold: Command = toggleMark(schema.marks.bold);

/**
 * Toggle italic mark
 */
export const toggleItalic: Command = toggleMark(schema.marks.italic);

/**
 * Toggle underline mark (default style)
 */
export const toggleUnderline: Command = toggleMark(schema.marks.underline);

/**
 * Toggle strikethrough mark
 */
export const toggleStrike: Command = toggleMark(schema.marks.strike);

/**
 * Toggle superscript mark
 */
export const toggleSuperscript: Command = toggleMark(schema.marks.superscript);

/**
 * Toggle subscript mark
 */
export const toggleSubscript: Command = toggleMark(schema.marks.subscript);

// ============================================================================
// SET MARKS (with attributes)
// ============================================================================

/**
 * Set text color
 */
export function setTextColor(attrs: TextColorAttrs): Command {
  return (state, dispatch) => {
    if (!attrs.rgb && !attrs.themeColor) {
      // Remove color mark if no color specified
      return removeMark(schema.marks.textColor)(state, dispatch);
    }

    return setMark(schema.marks.textColor, attrs as MarkAttrs)(state, dispatch);
  };
}

/**
 * Clear text color (restore to default)
 */
export const clearTextColor: Command = removeMark(schema.marks.textColor);

/**
 * Set highlight/background color
 */
export function setHighlight(color: string): Command {
  return (state, dispatch) => {
    if (!color || color === 'none') {
      return removeMark(schema.marks.highlight)(state, dispatch);
    }

    return setMark(schema.marks.highlight, { color })(state, dispatch);
  };
}

/**
 * Clear highlight
 */
export const clearHighlight: Command = removeMark(schema.marks.highlight);

/**
 * Set font size (in half-points for OOXML compatibility)
 */
export function setFontSize(size: number): Command {
  return setMark(schema.marks.fontSize, { size } as MarkAttrs);
}

/**
 * Clear font size (restore to default)
 */
export const clearFontSize: Command = removeMark(schema.marks.fontSize);

/**
 * Set font family
 */
export function setFontFamily(fontName: string): Command {
  return setMark(schema.marks.fontFamily, {
    ascii: fontName,
    hAnsi: fontName,
  } as MarkAttrs);
}

/**
 * Clear font family (restore to default)
 */
export const clearFontFamily: Command = removeMark(schema.marks.fontFamily);

/**
 * Set underline with specific style
 */
export function setUnderlineStyle(style: string, color?: TextColorAttrs): Command {
  return setMark(schema.marks.underline, {
    style,
    color,
  } as MarkAttrs);
}

// ============================================================================
// COMPOSITE COMMANDS
// ============================================================================

/**
 * Clear all text formatting (remove all marks)
 */
export const clearFormatting: Command = (state, dispatch) => {
  const { from, to, empty } = state.selection;

  if (empty) {
    // Clear stored marks when no selection
    if (dispatch) {
      dispatch(state.tr.setStoredMarks([]));
    }
    return true;
  }

  if (dispatch) {
    let tr = state.tr;

    // Remove all marks from selection
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.isText && node.marks.length > 0) {
        const start = Math.max(from, pos);
        const end = Math.min(to, pos + node.nodeSize);
        for (const mark of node.marks) {
          tr = tr.removeMark(start, end, mark.type);
        }
      }
    });

    dispatch(tr.scrollIntoView());
  }

  return true;
};

/**
 * Check if a mark is active in the current selection
 */
export function isMarkActive(
  state: EditorState,
  markType: MarkType,
  attrs?: Record<string, unknown>
): boolean {
  const { from, to, empty } = state.selection;

  if (empty) {
    // Check stored marks or marks at cursor
    const marks = state.storedMarks || state.selection.$from.marks();
    return marks.some((mark) => {
      if (mark.type !== markType) return false;
      if (!attrs) return true;
      return Object.entries(attrs).every(([key, value]) => mark.attrs[key] === value);
    });
  }

  // Check if mark is active across the entire selection
  let hasMark = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (node.isText) {
      const mark = markType.isInSet(node.marks);
      if (mark) {
        if (!attrs) {
          hasMark = true;
          return false; // Stop iteration
        }
        const attrsMatch = Object.entries(attrs).every(([key, value]) => mark.attrs[key] === value);
        if (attrsMatch) {
          hasMark = true;
          return false;
        }
      }
    }
    return true;
  });

  return hasMark;
}

/**
 * Get the current value of a mark attribute
 */
export function getMarkAttr(state: EditorState, markType: MarkType, attr: string): unknown | null {
  const { empty, $from, from, to } = state.selection;

  if (empty) {
    const marks = state.storedMarks || $from.marks();
    for (const mark of marks) {
      if (mark.type === markType) {
        return mark.attrs[attr];
      }
    }
    return null;
  }

  // Get from first text node in selection
  let value: unknown = null;
  state.doc.nodesBetween(from, to, (node) => {
    if (node.isText && value === null) {
      const mark = markType.isInSet(node.marks);
      if (mark) {
        value = mark.attrs[attr];
        return false;
      }
    }
    return true;
  });

  return value;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Set a mark with specific attributes
 */
function setMark(markType: MarkType, attrs: Record<string, unknown>): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    const mark = markType.create(attrs);

    if (empty) {
      // Store mark for future typing
      if (dispatch) {
        const marks = markType.isInSet(state.storedMarks || state.selection.$from.marks())
          ? (state.storedMarks || state.selection.$from.marks()).filter((m) => m.type !== markType)
          : state.storedMarks || state.selection.$from.marks();

        dispatch(state.tr.setStoredMarks([...marks, mark]));
      }
      return true;
    }

    if (dispatch) {
      dispatch(state.tr.addMark(from, to, mark).scrollIntoView());
    }

    return true;
  };
}

/**
 * Remove a mark
 */
function removeMark(markType: MarkType): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;

    if (empty) {
      // Remove from stored marks
      if (dispatch) {
        const marks = (state.storedMarks || state.selection.$from.marks()).filter(
          (m) => m.type !== markType
        );
        dispatch(state.tr.setStoredMarks(marks));
      }
      return true;
    }

    if (dispatch) {
      dispatch(state.tr.removeMark(from, to, markType).scrollIntoView());
    }

    return true;
  };
}

/**
 * Create a command that sets a mark on the selection
 * If the selection is empty, it sets stored marks for future typing
 */
export function createSetMarkCommand(markType: MarkType, attrs?: Record<string, unknown>): Command {
  return setMark(markType, attrs || {});
}

/**
 * Create a command that removes a mark from the selection
 */
export function createRemoveMarkCommand(markType: MarkType): Command {
  return removeMark(markType);
}
