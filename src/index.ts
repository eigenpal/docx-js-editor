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
export { FontPicker, type FontPickerProps, useFontSearch, type FontInfo } from './components/ui/FontPicker';
export { FontSizePicker, type FontSizePickerProps } from './components/ui/FontSizePicker';
export { ColorPicker, type ColorPickerProps, type ColorPreset } from './components/ui/ColorPicker';
export { StylePicker, type StylePickerProps, type StyleOption } from './components/ui/StylePicker';
export { AlignmentButtons, type AlignmentButtonsProps } from './components/ui/AlignmentButtons';
export { ListButtons, type ListButtonsProps } from './components/ui/ListButtons';

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
// UTILITIES
// ============================================================================

export { twipsToPixels, pixelsToTwips, formatPx, parseEmu, emuToPixels, pointsToPixels, halfPointsToPixels } from './utils/units';
export { resolveThemeColor, getThemeColorName, resolveColor, hexToRgb, rgbToHex, colorWithOpacity, parseHighlightColor } from './utils/colors';
