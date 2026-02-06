/**
 * ProseMirror Table Commands — thin re-exports from extension system
 *
 * Table context detection, insert/delete operations, borders, cell styling.
 * All implementations live in extensions/nodes/TableExtension.ts; this file
 * re-exports for backward compatibility.
 */

import type { EditorState, Transaction } from 'prosemirror-state';
import { singletonManager } from '../schema';

// Re-export types and query helpers from TableExtension
export type { TableContextInfo, BorderPreset } from '../extensions/nodes/TableExtension';
export { getTableContext, isInTable } from '../extensions/nodes/TableExtension';

// ============================================================================
// COMMANDS — delegated to singleton extension manager
// ============================================================================

const cmds = singletonManager.getCommands();

// Table creation
export function insertTable(
  rows: number,
  cols: number
): (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean {
  return cmds.insertTable(rows, cols);
}

// Row operations
export function addRowAbove(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  return cmds.addRowAbove()(state, dispatch);
}
export function addRowBelow(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  return cmds.addRowBelow()(state, dispatch);
}
export function deleteRow(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  return cmds.deleteRow()(state, dispatch);
}

// Column operations
export function addColumnLeft(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  return cmds.addColumnLeft()(state, dispatch);
}
export function addColumnRight(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  return cmds.addColumnRight()(state, dispatch);
}
export function deleteColumn(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  return cmds.deleteColumn()(state, dispatch);
}

// Table deletion
export function deleteTable(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  return cmds.deleteTable()(state, dispatch);
}

// Merge/Split (stubs — full implementation requires prosemirror-tables)
export function mergeCells(_state: EditorState, _dispatch?: (tr: Transaction) => void): boolean {
  return false;
}
export function splitCell(_state: EditorState, _dispatch?: (tr: Transaction) => void): boolean {
  return false;
}

// Borders
export function setTableBorders(
  preset: import('../extensions/nodes/TableExtension').BorderPreset
): (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean {
  return cmds.setTableBorders(preset);
}
export function removeTableBorders(
  state: EditorState,
  dispatch?: (tr: Transaction) => void
): boolean {
  return cmds.removeTableBorders()(state, dispatch);
}
export function setAllTableBorders(
  state: EditorState,
  dispatch?: (tr: Transaction) => void
): boolean {
  return cmds.setAllTableBorders()(state, dispatch);
}
export function setOutsideTableBorders(
  state: EditorState,
  dispatch?: (tr: Transaction) => void
): boolean {
  return cmds.setOutsideTableBorders()(state, dispatch);
}
export function setInsideTableBorders(
  state: EditorState,
  dispatch?: (tr: Transaction) => void
): boolean {
  return cmds.setInsideTableBorders()(state, dispatch);
}

// Cell styling
export function setCellFillColor(
  color: string | null
): (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean {
  return cmds.setCellFillColor(color);
}
export function setTableBorderColor(
  color: string
): (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean {
  return cmds.setTableBorderColor(color);
}
