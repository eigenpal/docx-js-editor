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

// ============================================================================
// DIALOGS
// ============================================================================

export { FindReplaceDialog, type FindReplaceDialogProps, type FindReplaceOptions, useFindReplace } from './components/dialogs/FindReplaceDialog';
export { HyperlinkDialog, type HyperlinkDialogProps, type HyperlinkData, useHyperlinkDialog } from './components/dialogs/HyperlinkDialog';

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

// ============================================================================
// UTILITIES
// ============================================================================

export { twipsToPixels, pixelsToTwips, formatPx, parseEmu, emuToPixels, pointsToPixels, halfPointsToPixels } from './utils/units';
export { resolveThemeColor, getThemeColorName, resolveColor, hexToRgb, rgbToHex, colorWithOpacity, parseHighlightColor } from './utils/colors';
