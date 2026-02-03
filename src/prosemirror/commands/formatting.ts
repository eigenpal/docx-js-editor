/**
 * Text Formatting Commands
 *
 * ProseMirror commands for toggling and setting text formatting marks:
 * - Toggle marks: bold, italic, underline, strike
 * - Set marks: text color, highlight, font size, font family
 * - Clear formatting
 */

import { toggleMark } from 'prosemirror-commands';
import type { Command, EditorState, Transaction } from 'prosemirror-state';
import type { MarkType, Mark } from 'prosemirror-model';
import { schema } from '../schema';
import type { TextColorAttrs } from '../schema';
import type { TextFormatting } from '../../types/document';

// Helper type for mark attributes
type MarkAttrs = Record<string, unknown>;

// ============================================================================
// PARAGRAPH DEFAULT FORMATTING HELPERS
// ============================================================================

/**
 * Convert marks array to TextFormatting object
 */
function marksToTextFormatting(marks: readonly Mark[]): TextFormatting {
  const formatting: TextFormatting = {};

  for (const mark of marks) {
    switch (mark.type.name) {
      case 'bold':
        formatting.bold = true;
        break;
      case 'italic':
        formatting.italic = true;
        break;
      case 'underline':
        formatting.underline = { style: mark.attrs.style || 'single' };
        break;
      case 'strike':
        formatting.strike = true;
        break;
      case 'textColor':
        formatting.color = mark.attrs;
        break;
      case 'highlight':
        formatting.highlight = mark.attrs.color;
        break;
      case 'fontSize':
        formatting.fontSize = mark.attrs.size;
        break;
      case 'fontFamily':
        formatting.fontFamily = {
          ascii: mark.attrs.ascii,
          hAnsi: mark.attrs.hAnsi,
        };
        break;
      case 'superscript':
        formatting.vertAlign = 'superscript';
        break;
      case 'subscript':
        formatting.vertAlign = 'subscript';
        break;
    }
  }

  return formatting;
}

/**
 * Convert TextFormatting object to an array of marks
 * Used to restore stored marks when entering an empty paragraph with saved formatting
 */
export function textFormattingToMarks(formatting: TextFormatting): Mark[] {
  const marks: Mark[] = [];

  if (formatting.bold) {
    marks.push(schema.marks.bold.create());
  }
  if (formatting.italic) {
    marks.push(schema.marks.italic.create());
  }
  if (formatting.underline) {
    marks.push(
      schema.marks.underline.create({
        style: formatting.underline.style || 'single',
        color: formatting.underline.color,
      })
    );
  }
  if (formatting.strike) {
    marks.push(schema.marks.strike.create());
  }
  if (formatting.doubleStrike) {
    marks.push(schema.marks.strike.create({ double: true }));
  }
  if (formatting.color) {
    marks.push(
      schema.marks.textColor.create({
        rgb: formatting.color.rgb,
        themeColor: formatting.color.themeColor,
        themeTint: formatting.color.themeTint,
        themeShade: formatting.color.themeShade,
      })
    );
  }
  if (formatting.highlight) {
    marks.push(schema.marks.highlight.create({ color: formatting.highlight }));
  }
  if (formatting.fontSize) {
    marks.push(schema.marks.fontSize.create({ size: formatting.fontSize }));
  }
  if (formatting.fontFamily) {
    marks.push(
      schema.marks.fontFamily.create({
        ascii: formatting.fontFamily.ascii,
        hAnsi: formatting.fontFamily.hAnsi,
        asciiTheme: formatting.fontFamily.asciiTheme,
      })
    );
  }
  if (formatting.vertAlign === 'superscript') {
    marks.push(schema.marks.superscript.create());
  }
  if (formatting.vertAlign === 'subscript') {
    marks.push(schema.marks.subscript.create());
  }

  return marks;
}

/**
 * Save stored marks to paragraph's defaultTextFormatting
 * Called when formatting is set on an empty paragraph
 */
function saveStoredMarksToParagraph(state: EditorState, tr: Transaction): Transaction {
  const { $from } = state.selection;
  const paragraph = $from.parent;

  if (paragraph.type.name !== 'paragraph') return tr;
  if (paragraph.textContent.length > 0) return tr; // Only for empty paragraphs

  const marks = tr.storedMarks || state.storedMarks || [];
  if (marks.length === 0) {
    // Clear defaultTextFormatting if no marks
    return tr.setNodeMarkup($from.before(), undefined, {
      ...paragraph.attrs,
      defaultTextFormatting: null,
    });
  }

  const defaultTextFormatting = marksToTextFormatting(marks);

  return tr.setNodeMarkup($from.before(), undefined, {
    ...paragraph.attrs,
    defaultTextFormatting,
  });
}

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

        let tr = state.tr.setStoredMarks([...marks, mark]);
        // Also save to paragraph's defaultTextFormatting for persistence
        tr = saveStoredMarksToParagraph(state, tr);
        dispatch(tr);
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
        let tr = state.tr.setStoredMarks(marks);
        // Also save to paragraph's defaultTextFormatting for persistence
        tr = saveStoredMarksToParagraph(state, tr);
        dispatch(tr);
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

// ============================================================================
// HYPERLINK COMMANDS
// ============================================================================

/**
 * Check if a hyperlink mark is active in the current selection
 */
export function isHyperlinkActive(state: EditorState): boolean {
  return isMarkActive(state, schema.marks.hyperlink);
}

/**
 * Get current hyperlink attributes if cursor is in a hyperlink
 */
export function getHyperlinkAttrs(state: EditorState): { href: string; tooltip?: string } | null {
  const { empty, $from, from, to } = state.selection;

  if (empty) {
    const marks = state.storedMarks || $from.marks();
    for (const mark of marks) {
      if (mark.type === schema.marks.hyperlink) {
        return {
          href: mark.attrs.href,
          tooltip: mark.attrs.tooltip,
        };
      }
    }
    return null;
  }

  // Get from first text node in selection
  let attrs: { href: string; tooltip?: string } | null = null;
  state.doc.nodesBetween(from, to, (node) => {
    if (node.isText && attrs === null) {
      const mark = schema.marks.hyperlink.isInSet(node.marks);
      if (mark) {
        attrs = {
          href: mark.attrs.href,
          tooltip: mark.attrs.tooltip,
        };
        return false;
      }
    }
    return true;
  });

  return attrs;
}

/**
 * Get the selected text as a string
 */
export function getSelectedText(state: EditorState): string {
  const { from, to, empty } = state.selection;
  if (empty) return '';
  return state.doc.textBetween(from, to, '');
}

/**
 * Set hyperlink on selection
 */
export function setHyperlink(href: string, tooltip?: string): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;

    if (empty) {
      // Cannot add hyperlink without selection
      return false;
    }

    if (dispatch) {
      const mark = schema.marks.hyperlink.create({
        href,
        tooltip: tooltip || null,
      });
      dispatch(state.tr.addMark(from, to, mark).scrollIntoView());
    }

    return true;
  };
}

/**
 * Remove hyperlink from selection
 */
export const removeHyperlink: Command = (state, dispatch) => {
  const { from, to, empty } = state.selection;

  if (empty) {
    // Find the extent of the hyperlink at cursor
    const $pos = state.selection.$from;
    const marks = $pos.marks();
    const linkMark = marks.find((m) => m.type === schema.marks.hyperlink);

    if (!linkMark) return false;

    // Find start and end of this hyperlink
    let start = $pos.pos;
    let end = $pos.pos;

    // Search within the parent text node
    const parent = $pos.parent;
    parent.forEach((node, offset) => {
      if (node.isText) {
        const nodeStart = $pos.start() + offset;
        const nodeEnd = nodeStart + node.nodeSize;

        if (nodeStart <= $pos.pos && $pos.pos <= nodeEnd) {
          const hasLink = node.marks.some((m) => m.type === schema.marks.hyperlink);
          if (hasLink) {
            start = Math.min(start, nodeStart);
            end = Math.max(end, nodeEnd);
          }
        }
      }
    });

    if (dispatch) {
      dispatch(state.tr.removeMark(start, end, schema.marks.hyperlink).scrollIntoView());
    }
    return true;
  }

  if (dispatch) {
    dispatch(state.tr.removeMark(from, to, schema.marks.hyperlink).scrollIntoView());
  }

  return true;
};

/**
 * Insert text with hyperlink (when no text is selected)
 */
export function insertHyperlink(text: string, href: string, tooltip?: string): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const mark = schema.marks.hyperlink.create({
        href,
        tooltip: tooltip || null,
      });
      const textNode = state.schema.text(text, [mark]);
      dispatch(state.tr.replaceSelectionWith(textNode, false).scrollIntoView());
    }
    return true;
  };
}
