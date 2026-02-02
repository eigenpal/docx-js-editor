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

export { useHistory } from './useHistory';
export type {
  HistoryState,
  HistoryAction,
  UseHistoryOptions,
} from './useHistory';

export { useTableSelection, TABLE_DATA_ATTRIBUTES } from './useTableSelection';
export type {
  TableSelectionState,
  UseTableSelectionReturn,
  UseTableSelectionOptions,
} from './useTableSelection';
