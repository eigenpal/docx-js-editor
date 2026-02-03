/**
 * ProseMirror Plugins
 *
 * Collection of plugins for the DOCX editor.
 */

export {
  createKeymap,
  createBaseKeymap,
  createListKeymap,
  createEditorKeymaps,
  insertHardBreak,
  exitListOnEmptyEnter,
  splitListItem,
  backspaceExitList,
  increaseListIndent,
  decreaseListIndent,
} from './keymap';

export {
  createSelectionTrackerPlugin,
  extractSelectionContext,
  getSelectionContext,
  selectionTrackerKey,
} from './selectionTracker';

export type { SelectionContext, SelectionChangeCallback } from './selectionTracker';
