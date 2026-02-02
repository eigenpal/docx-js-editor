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
import { Selection, type Command } from 'prosemirror-state';
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
    Tab: chainCommands(goToNextCell(), increaseListIndent()),
    'Shift-Tab': chainCommands(goToPrevCell(), decreaseListIndent()),
    'Shift-Enter': () => false, // Let base keymap handle this
  });
}

// ============================================================================
// TABLE NAVIGATION COMMANDS
// ============================================================================

/**
 * Check if cursor is inside a table cell
 */
function isInTableCell(state: Parameters<Command>[0]): boolean {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      return true;
    }
  }
  return false;
}

/**
 * Find the table cell containing the cursor
 * Returns the depth and position of the cell
 */
function findCellInfo(
  state: Parameters<Command>[0]
): { cellDepth: number; cellPos: number; rowDepth: number; tableDepth: number } | null {
  const { $from } = state.selection;
  let cellDepth = -1;
  let rowDepth = -1;
  let tableDepth = -1;

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      cellDepth = d;
    } else if (node.type.name === 'tableRow') {
      rowDepth = d;
    } else if (node.type.name === 'table') {
      tableDepth = d;
      break;
    }
  }

  if (cellDepth === -1 || rowDepth === -1 || tableDepth === -1) {
    return null;
  }

  return {
    cellDepth,
    cellPos: $from.before(cellDepth),
    rowDepth,
    tableDepth,
  };
}

/**
 * Command to move to the next cell in a table (Tab key)
 */
export function goToNextCell(): Command {
  return (state, dispatch) => {
    if (!isInTableCell(state)) {
      return false;
    }

    const info = findCellInfo(state);
    if (!info) return false;

    const { $from } = state.selection;
    const table = $from.node(info.tableDepth);
    const row = $from.node(info.rowDepth);
    const cellIndex = $from.index(info.rowDepth);
    const rowIndex = $from.index(info.tableDepth);

    // Try to move to next cell in same row
    if (cellIndex < row.childCount - 1) {
      // Move to next cell
      const nextCellPos = info.cellPos + $from.node(info.cellDepth).nodeSize;
      if (dispatch) {
        // Position cursor at start of first paragraph in next cell
        const textPos = nextCellPos + 1 + 1; // +1 for cell, +1 for paragraph
        const tr = state.tr.setSelection(Selection.near(state.doc.resolve(textPos)));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    // Try to move to first cell of next row
    if (rowIndex < table.childCount - 1) {
      const rowPos = $from.before(info.rowDepth);
      const nextRowPos = rowPos + row.nodeSize;
      if (dispatch) {
        // Position cursor at start of first paragraph in first cell of next row
        const textPos = nextRowPos + 1 + 1 + 1; // +1 for row, +1 for cell, +1 for paragraph
        const tr = state.tr.setSelection(Selection.near(state.doc.resolve(textPos)));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    // At last cell of last row - don't handle (let other handlers take over)
    return false;
  };
}

/**
 * Command to move to the previous cell in a table (Shift+Tab key)
 */
export function goToPrevCell(): Command {
  return (state, dispatch) => {
    if (!isInTableCell(state)) {
      return false;
    }

    const info = findCellInfo(state);
    if (!info) return false;

    const { $from } = state.selection;
    const table = $from.node(info.tableDepth);
    const cellIndex = $from.index(info.rowDepth);
    const rowIndex = $from.index(info.tableDepth);

    // Try to move to previous cell in same row
    if (cellIndex > 0) {
      const row = $from.node(info.rowDepth);
      const prevCell = row.child(cellIndex - 1);
      const cellStartPos = info.cellPos - prevCell.nodeSize;
      if (dispatch) {
        // Position cursor at end of last paragraph in previous cell
        const textPos = cellStartPos + prevCell.nodeSize - 2; // -1 for cell end, -1 for paragraph end
        const tr = state.tr.setSelection(Selection.near(state.doc.resolve(textPos), -1));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    // Try to move to last cell of previous row
    if (rowIndex > 0) {
      const prevRow = table.child(rowIndex - 1);
      const rowPos = $from.before(info.rowDepth);
      const prevRowPos = rowPos - prevRow.nodeSize;
      if (dispatch) {
        // Position cursor at end of last paragraph in last cell of previous row
        const cellEndPos = prevRowPos + prevRow.nodeSize - 1; // -1 for row end
        const textPos = cellEndPos - 1; // -1 for cell end
        const tr = state.tr.setSelection(Selection.near(state.doc.resolve(textPos), -1));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    // At first cell of first row - don't handle
    return false;
  };
}

/**
 * Create the complete keymap stack for the editor
 */
export function createEditorKeymaps(schema: Schema) {
  return [createListKeymap(), createKeymap(schema), createBaseKeymap()];
}
