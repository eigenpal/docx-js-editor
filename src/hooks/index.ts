/**
 * Hooks Index
 *
 * Export all hooks for public API.
 */

export { useSelection, SELECTION_DATA_ATTRIBUTES } from './useSelection';
export type {
  DocumentPosition,
  DocumentRange,
  SelectionState,
  UseSelectionOptions,
} from './useSelection';

export { useHistory, useAutoHistory, useDocumentHistory, HistoryManager } from './useHistory';
export type {
  HistoryEntry,
  UseHistoryOptions,
  UseHistoryReturn,
} from './useHistory';

export { useTableSelection, TABLE_DATA_ATTRIBUTES } from './useTableSelection';
export type {
  TableSelectionState,
  UseTableSelectionReturn,
  UseTableSelectionOptions,
} from './useTableSelection';

export { useSelectionHighlight, generateOverlayElements } from './useSelectionHighlight';
export type {
  UseSelectionHighlightOptions,
  UseSelectionHighlightReturn,
  SelectionOverlayProps,
} from './useSelectionHighlight';
