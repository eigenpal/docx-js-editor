/**
 * @eigenpal/docx-editor
 *
 * A complete WYSIWYG DOCX editor with full Microsoft Word fidelity.
 *
 * Features:
 * - Full text and paragraph formatting
 * - Tables, images, shapes, text boxes
 * - Hyperlinks, bookmarks, fields
 * - Footnotes, lists, headers/footers
 * - Page layout with margins and columns
 * - DocumentAgent API for programmatic editing
 * - Template variable substitution
 * - AI-powered context menu
 *
 * CSS Styles:
 * For optimal cursor visibility and selection highlighting, import the editor styles:
 * ```
 * import '@eigenpal/docx-editor/styles/editor.css';
 * ```
 */

// ============================================================================
// VERSION
// ============================================================================

export const VERSION = '0.1.0';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export { DocxEditor, type DocxEditorProps, type DocxEditorRef } from './components/DocxEditor';
export { default } from './components/DocxEditor';

// ============================================================================
// AGENT API
// ============================================================================

export { DocumentAgent } from './agent/DocumentAgent';
export { executeCommand, type CommandResult } from './agent/executor';
export { getAgentContext, getDocumentSummary, type AgentContextOptions } from './agent/context';
export {
  buildSelectionContext,
  buildExtendedSelectionContext,
  type SelectionContextOptions,
  type ExtendedSelectionContext,
} from './agent/selectionContext';

// ============================================================================
// PARSER / SERIALIZER
// ============================================================================

export { parseDocx } from './docx/parser';
export { serializeDocx } from './docx/serializer';
export { processTemplate, type TemplateOptions } from './docx/templateProcessor';

// ============================================================================
// FONT LOADER
// ============================================================================

export {
  loadFont,
  loadFonts,
  loadFontFromBuffer,
  isFontLoaded,
  isLoading as isFontsLoading,
  getLoadedFonts,
  onFontsLoaded,
  canRenderFont,
  preloadCommonFonts,
} from './utils/fontLoader';

// ============================================================================
// UI COMPONENTS
// ============================================================================

export { Toolbar, type ToolbarProps, ToolbarButton, ToolbarGroup, ToolbarSeparator } from './components/Toolbar';
export { VariablePanel, type VariablePanelProps } from './components/VariablePanel';
export { Editor, type EditorProps, type EditorRef, type EditorState } from './components/Editor';
export { AIEditor, type AIEditorProps, type AIEditorRef, type AIRequestHandler, createMockAIHandler } from './components/AIEditor';
export { DocumentViewer, type DocumentViewerProps, scrollToPage, getVisiblePages, calculateFitWidthZoom, calculateFitPageZoom } from './components/DocumentViewer';
export { ContextMenu, type ContextMenuProps, useContextMenu, getActionShortcut, isActionAvailable, getDefaultActions, getAllActions } from './components/ContextMenu';
export { ResponsePreview, type ResponsePreviewProps, useResponsePreview, type ResponsePreviewState, createMockResponse, createErrorResponse } from './components/ResponsePreview';
export {
  TextContextMenu,
  type TextContextMenuProps,
  type TextContextAction,
  type TextContextMenuItem,
  type UseTextContextMenuOptions,
  type UseTextContextMenuReturn,
  useTextContextMenu,
  getTextActionLabel,
  getTextActionShortcut,
  getDefaultTextContextMenuItems,
  isTextActionAvailable,
} from './components/TextContextMenu';

// ============================================================================
// ERROR HANDLING
// ============================================================================

export {
  ErrorBoundary,
  type ErrorBoundaryProps,
  ErrorProvider,
  useErrorNotifications,
  type ErrorContextValue,
  type ErrorNotification,
  type ErrorSeverity,
  ParseErrorDisplay,
  type ParseErrorDisplayProps,
  UnsupportedFeatureWarning,
  type UnsupportedFeatureWarningProps,
  isParseError,
  getUserFriendlyMessage,
} from './components/ErrorBoundary';

// ============================================================================
// UI CONTROLS
// ============================================================================

export { ZoomControl, type ZoomControlProps } from './components/ui/ZoomControl';
export {
  PageNumberIndicator,
  type PageNumberIndicatorProps,
  type PageIndicatorPosition,
  type PageIndicatorVariant,
  formatPageOrdinal,
  createPageFormat,
  getPageProgress,
  isFirstPage,
  isLastPage,
  calculateVisiblePage,
  calculateScrollToPage,
} from './components/ui/PageNumberIndicator';
export {
  PageNavigator,
  type PageNavigatorProps,
  type PageNavigatorPosition,
  type PageNavigatorVariant,
  parsePageInput,
  isValidPageNumber,
  clampPageNumber,
  getNavigationShortcuts,
  formatPageRange,
  calculateProgress,
} from './components/ui/PageNavigator';
export { FontPicker, type FontPickerProps, type FontOption } from './components/ui/FontPicker';
export { FontSizePicker, type FontSizePickerProps } from './components/ui/FontSizePicker';
export { LineSpacingPicker, type LineSpacingPickerProps, type LineSpacingOption } from './components/ui/LineSpacingPicker';
export { ColorPicker, type ColorPickerProps, type ColorPreset } from './components/ui/ColorPicker';
export { StylePicker, type StylePickerProps, type StyleOption } from './components/ui/StylePicker';
export { AlignmentButtons, type AlignmentButtonsProps } from './components/ui/AlignmentButtons';
export { ListButtons, type ListButtonsProps, type ListState, createDefaultListState } from './components/ui/ListButtons';
export {
  TableToolbar,
  type TableToolbarProps,
  type TableContext,
  type TableSelection,
  type TableAction,
  createTableContext,
  addRow,
  deleteRow,
  addColumn,
  deleteColumn,
  mergeCells,
  splitCell,
  getColumnCount,
  getCellAt,
} from './components/ui/TableToolbar';
export {
  HorizontalRuler,
  type HorizontalRulerProps,
  getRulerDimensions,
  getMarginInUnits,
  parseMarginFromUnits,
  positionToMargin,
} from './components/ui/HorizontalRuler';
export {
  PrintPreview,
  type PrintPreviewProps,
  PrintButton,
  type PrintButtonProps,
  PrintStyles,
  type PrintOptions,
  triggerPrint,
  openPrintWindow,
  getDefaultPrintOptions,
  parsePageRange,
  formatPageRange as formatPrintPageRange,
  isPrintSupported,
} from './components/ui/PrintPreview';
export {
  TableBorderPicker,
  type TableBorderPickerProps,
  type BorderConfig,
  type BorderPosition,
  type BorderStyleType,
  createBorderSpec,
  createBorderConfig,
  getBorderPositionLabel,
  getAvailableBorderStyles,
  getAvailableBorderWidths,
  mapStyleToCss,
  BORDER_STYLES,
  BORDER_WIDTHS,
  BORDER_POSITIONS,
  DEFAULT_BORDER_CONFIG,
} from './components/ui/TableBorderPicker';
export {
  CellBackgroundPicker,
  type CellBackgroundPickerProps,
  type CellColorOption,
  getDefaultCellColors,
  createCellColorOption,
  isDefaultCellColor,
  getCellColorName,
  createShadingFromColor,
  getColorFromShading,
  getContrastingTextColor,
  DEFAULT_CELL_COLORS,
} from './components/ui/CellBackgroundPicker';
export {
  UnsavedIndicator,
  type UnsavedIndicatorProps,
  type IndicatorVariant,
  type IndicatorPosition,
  type UseUnsavedChangesOptions,
  type UseUnsavedChangesReturn,
  useUnsavedChanges,
  getVariantLabel,
  getAllVariants as getAllIndicatorVariants,
  getAllPositions as getAllIndicatorPositions,
  createChangeTracker,
} from './components/ui/UnsavedIndicator';
export {
  LoadingIndicator,
  type LoadingIndicatorProps,
  type LoadingVariant,
  type LoadingSize,
  type UseLoadingOptions,
  type UseLoadingReturn,
  type LoadingOperation,
  useLoading,
  useLoadingOperations,
  getLoadingVariantLabel,
  getAllLoadingVariants,
  getAllLoadingSizes,
  delay,
} from './components/ui/LoadingIndicator';

// ============================================================================
// DIALOGS
// ============================================================================

export {
  FindReplaceDialog,
  type FindReplaceDialogProps,
  type FindReplaceOptions,
  type FindOptions,
  type FindMatch,
  type FindResult,
  type FindReplaceState,
  type UseFindReplaceReturn,
  useFindReplace,
  findInDocument,
  findInParagraph,
  findAllMatches,
  scrollToMatch,
  createDefaultFindOptions,
  createSearchPattern,
  replaceAllInContent,
  replaceFirstInContent,
  getMatchCountText,
  isEmptySearch,
  escapeRegexString,
  getDefaultHighlightOptions,
  type HighlightOptions,
} from './components/dialogs/FindReplaceDialog';
export { HyperlinkDialog, type HyperlinkDialogProps, type HyperlinkData, useHyperlinkDialog } from './components/dialogs/HyperlinkDialog';
export {
  InsertTableDialog,
  type InsertTableDialogProps,
  type TableConfig,
  useInsertTableDialog,
  createDefaultTableConfig,
  isValidTableConfig,
  clampTableConfig,
  formatTableDimensions,
  getTablePresets,
} from './components/dialogs/InsertTableDialog';
export {
  InsertImageDialog,
  type InsertImageDialogProps,
  type ImageData,
  useInsertImageDialog,
  isValidImageFile,
  getSupportedImageExtensions,
  getImageAcceptString,
  calculateFitDimensions,
  dataUrlToBlob,
  getImageDimensions,
  formatFileSize,
} from './components/dialogs/InsertImageDialog';
export {
  InsertSymbolDialog,
  type InsertSymbolDialogProps,
  type SymbolCategory,
  useInsertSymbolDialog,
  getSymbolCategories,
  getSymbolsByCategory,
  getSymbolInfo as getSymbolUnicodeInfo,
  searchSymbols,
  symbolFromCodePoint,
  SYMBOL_CATEGORIES,
} from './components/dialogs/InsertSymbolDialog';
export {
  PasteSpecialDialog,
  type PasteSpecialDialogProps,
  type PasteOption,
  type UsePasteSpecialReturn,
  type UsePasteSpecialOptions,
  usePasteSpecial,
  getPasteOption,
  getAllPasteOptions,
  getDefaultPasteOption,
  isPasteSpecialShortcut,
} from './components/dialogs/PasteSpecialDialog';
export {
  KeyboardShortcutsDialog,
  type KeyboardShortcutsDialogProps,
  type KeyboardShortcut,
  type ShortcutCategory,
  type UseKeyboardShortcutsDialogOptions,
  type UseKeyboardShortcutsDialogReturn,
  useKeyboardShortcutsDialog,
  getDefaultShortcuts,
  getShortcutsByCategory,
  getCommonShortcuts,
  getCategoryLabel,
  getAllCategories,
  formatShortcutKeys,
} from './components/dialogs/KeyboardShortcutsDialog';

// ============================================================================
// TYPES
// ============================================================================

// Document types
export type {
  Document,
  DocumentPackage,
  DocumentBody,
  BlockContent,
  Paragraph,
  Run,
  RunContent,
  TextContent,
  Table,
  TableRow,
  TableCell,
  Image,
  Shape,
  TextBox,
  Hyperlink,
  Bookmark,
  Field,
  Theme,
  ThemeColors,
  ThemeFonts,
  Styles,
  Style,
  TextFormatting,
  ParagraphFormatting,
  SectionProperties,
  PageMargins,
  PageSize,
  HeaderFooter,
  FootnoteReference,
  EndnoteReference,
  Footnote,
  Endnote,
  ListNumbering,
  NumberingLevel,
  Relationship,
} from './types/document';

// Agent API types
export type {
  AIAction,
  AIActionRequest,
  AgentResponse,
  AgentContext,
  SelectionContext,
  Range,
  Position,
  ParagraphContext,
  SuggestedAction,
  AgentCommand,
  InsertTextCommand,
  ReplaceTextCommand,
  DeleteRangeCommand,
  ApplyFormattingCommand,
  InsertTableCommand,
  InsertImageCommand,
  InsertHyperlinkCommand,
  SetVariableCommand,
  ApplyStyleCommand,
} from './types/agentApi';

// ============================================================================
// HOOKS
// ============================================================================

export {
  useTableSelection,
  TABLE_DATA_ATTRIBUTES,
  type TableSelectionState,
  type UseTableSelectionReturn,
  type UseTableSelectionOptions,
} from './hooks/useTableSelection';

export {
  useAutoSave,
  formatLastSaveTime,
  getAutoSaveStatusLabel,
  getAutoSaveStorageSize,
  formatStorageSize,
  isAutoSaveSupported,
  type AutoSaveStatus,
  type UseAutoSaveOptions,
  type UseAutoSaveReturn,
  type SavedDocumentData,
} from './hooks/useAutoSave';

// ============================================================================
// UTILITIES
// ============================================================================

export { twipsToPixels, pixelsToTwips, formatPx, parseEmu, emuToPixels, pointsToPixels, halfPointsToPixels } from './utils/units';
export { resolveThemeColor, getThemeColorName, resolveColor, hexToRgb, rgbToHex, colorWithOpacity, parseHighlightColor } from './utils/colors';
export {
  createPageBreak,
  createColumnBreak,
  createLineBreak,
  createPageBreakRun,
  createPageBreakParagraph,
  insertPageBreak,
  createHorizontalRule,
  insertHorizontalRule,
  isPageBreak,
  isColumnBreak,
  isLineBreak,
  isBreakContent,
  hasPageBreakBefore,
  countPageBreaks,
  findPageBreaks,
  removePageBreak,
  type InsertPosition,
} from './utils/insertOperations';

// Selection highlighting
export {
  useSelectionHighlight,
  generateOverlayElements,
  type UseSelectionHighlightOptions,
  type UseSelectionHighlightReturn,
  type SelectionOverlayProps,
} from './hooks/useSelectionHighlight';

export {
  DEFAULT_SELECTION_STYLE,
  HIGH_CONTRAST_SELECTION_STYLE,
  SELECTION_CSS_VARS,
  getSelectionRects,
  mergeAdjacentRects,
  getMergedSelectionRects,
  getHighlightRectStyle,
  generateSelectionCSS,
  hasActiveSelection,
  getSelectedText,
  isSelectionWithin,
  getSelectionBoundingRect,
  highlightTextRange,
  selectRange,
  clearSelection,
  isSelectionBackwards,
  normalizeSelectionDirection,
  injectSelectionStyles,
  removeSelectionStyles,
  areSelectionStylesInjected,
  createSelectionChangeHandler,
  type HighlightRect,
  type SelectionHighlightConfig,
  type SelectionRange,
} from './utils/selectionHighlight';

// Text selection utilities for word/paragraph selection
export {
  isWordCharacter,
  isWhitespace,
  findWordBoundaries,
  getWordAt,
  findWordAt,
  selectWordAtCursor,
  selectWordInTextNode,
  expandSelectionToWordBoundaries,
  selectParagraphAtCursor,
  handleClickForMultiClick,
  createDoubleClickWordSelector,
  createTripleClickParagraphSelector,
  type WordSelectionResult,
} from './utils/textSelection';

// Keyboard navigation
export {
  // Types
  type NavigationDirection,
  type NavigationUnit,
  type NavigationAction,
  type KeyboardShortcut,
  // Word boundary detection
  isWordCharacter as isWordChar,
  isWhitespace as isWhitespaceChar,
  isPunctuation,
  findWordStart,
  findWordEnd,
  findNextWordStart,
  findPreviousWordStart,
  // Line boundary detection
  findVisualLineStart,
  findVisualLineEnd,
  // DOM selection utilities
  getSelectionInfo,
  setSelectionPosition,
  extendSelectionTo,
  moveByWord,
  moveToLineEdge,
  // Keyboard event handling
  parseNavigationAction,
  handleNavigationKey,
  isNavigationKey,
  // Selection word expansion
  expandSelectionToWord,
  getWordAtCursor,
  // Keyboard shortcut utilities
  matchesShortcut,
  NAVIGATION_SHORTCUTS,
  describeShortcut,
  getNavigationShortcutDescriptions,
} from './utils/keyboardNavigation';

// Clipboard utilities
export {
  useClipboard,
  createSelectionFromDOM,
  getSelectionRuns,
  type ClipboardSelection,
  type UseClipboardOptions,
  type UseClipboardReturn,
} from './hooks/useClipboard';

export {
  copyRuns,
  copyParagraphs,
  readFromClipboard,
  handlePasteEvent,
  htmlToRuns,
  cleanWordHtml,
  isWordHtml,
  isEditorHtml,
  createClipboardHandlers,
  runsToClipboardContent,
  paragraphsToClipboardContent,
  writeToClipboard,
  parseClipboardHtml,
  INTERNAL_CLIPBOARD_TYPE,
  CLIPBOARD_TYPES,
  type ClipboardContent,
  type ParsedClipboardContent,
  type ClipboardOptions,
} from './utils/clipboard';
