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

export {
  useClipboard,
  createSelectionFromDOM,
  getSelectionRuns,
} from './useClipboard';
export type {
  ClipboardSelection,
  UseClipboardOptions,
  UseClipboardReturn,
} from './useClipboard';

export {
  useAutoSave,
  formatLastSaveTime,
  getAutoSaveStatusLabel,
  getAutoSaveStorageSize,
  formatStorageSize,
  isAutoSaveSupported,
} from './useAutoSave';
export type {
  AutoSaveStatus,
  UseAutoSaveOptions,
  UseAutoSaveReturn,
  SavedDocumentData,
} from './useAutoSave';

export {
  useWheelZoom,
  getZoomPresets,
  findNearestZoomPreset,
  getNextZoomPreset,
  getPreviousZoomPreset,
  formatZoom,
  parseZoom,
  isZoomPreset,
  clampZoom,
  ZOOM_PRESETS,
} from './useWheelZoom';
export type {
  UseWheelZoomOptions,
  UseWheelZoomReturn,
} from './useWheelZoom';
