/**
 * DocxEditor Component
 *
 * Main component integrating all editor features:
 * - Toolbar for formatting
 * - ProseMirror-based editor for content editing
 * - VariablePanel for template variables
 * - Zoom control
 * - Error boundary
 * - Loading states
 */

import {
  useRef,
  useCallback,
  useState,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Document, Theme, HeaderFooter } from '../types/document';

import { Toolbar, type SelectionFormatting, type FormattingAction } from './Toolbar';
import { pointsToHalfPoints } from './ui/FontSizePicker';
import { VariablePanel } from './VariablePanel';
import { ErrorBoundary, ErrorProvider } from './ErrorBoundary';
import type { TableAction } from './ui/TableToolbar';
import {
  PageNumberIndicator,
  type PageIndicatorPosition,
  type PageIndicatorVariant,
} from './ui/PageNumberIndicator';
import {
  PageNavigator,
  type PageNavigatorPosition,
  type PageNavigatorVariant,
} from './ui/PageNavigator';
import { HorizontalRuler } from './ui/HorizontalRuler';
import { VerticalRuler } from './ui/VerticalRuler';
import { type PrintOptions } from './ui/PrintPreview';
import {
  FindReplaceDialog,
  useFindReplace,
  findInDocument,
  scrollToMatch,
  type FindMatch,
  type FindOptions,
  type FindResult,
} from './dialogs/FindReplaceDialog';
import { HyperlinkDialog, useHyperlinkDialog, type HyperlinkData } from './dialogs/HyperlinkDialog';
import { DocumentAgent } from '../agent/DocumentAgent';
import {
  DefaultLoadingIndicator,
  DefaultPlaceholder,
  ParseError,
  extractVariableNames,
  extractVariables,
} from './DocxEditorHelpers';
import { parseDocx } from '../docx/parser';
import { onFontsLoaded, loadDocumentFonts } from '../utils/fontLoader';
import { executeCommand } from '../agent/executor';
import { useTableSelection } from '../hooks/useTableSelection';
import { useDocumentHistory } from '../hooks/useHistory';

// ProseMirror editor
import {
  type SelectionState,
  TextSelection,
  extractSelectionState,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrike,
  toggleSuperscript,
  toggleSubscript,
  setTextColor,
  setHighlight,
  setFontSize,
  setFontFamily,
  setAlignment,
  setLineSpacing,
  toggleBulletList,
  toggleNumberedList,
  increaseIndent,
  decreaseIndent,
  increaseListLevel,
  decreaseListLevel,
  clearFormatting,
  applyStyle,
  createStyleResolver,
  // Hyperlink commands
  getHyperlinkAttrs,
  getSelectedText,
  setHyperlink,
  removeHyperlink,
  insertHyperlink,
  // Table commands
  getTableContext,
  insertTable,
  addRowAbove,
  addRowBelow,
  deleteRow as pmDeleteRow,
  addColumnLeft,
  addColumnRight,
  deleteColumn as pmDeleteColumn,
  deleteTable as pmDeleteTable,
  removeTableBorders,
  setAllTableBorders,
  setOutsideTableBorders,
  setInsideTableBorders,
  setCellFillColor,
  setTableBorderColor,
  type TableContextInfo,
} from '../prosemirror';

// Paginated editor
import { PagedEditor, type PagedEditorRef } from '../paged-editor/PagedEditor';

// Plugin API types
import type { RenderedDomContext } from '../plugin-api/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * DocxEditor props
 */
export interface DocxEditorProps {
  /** Document buffer (ArrayBuffer from file read) */
  documentBuffer?: ArrayBuffer | null;
  /** Pre-parsed document (alternative to documentBuffer) */
  document?: Document | null;
  /** Callback when document is saved */
  onSave?: (buffer: ArrayBuffer) => void;
  /** Callback when document changes */
  onChange?: (document: Document) => void;
  /** Callback when selection changes */
  onSelectionChange?: (state: SelectionState | null) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Callback when fonts are loaded */
  onFontsLoaded?: () => void;
  /** External ProseMirror plugins (from PluginHost) */
  externalPlugins?: import('prosemirror-state').Plugin[];
  /** Callback when editor view is ready (for PluginHost) */
  onEditorViewReady?: (view: import('prosemirror-view').EditorView) => void;
  /** Theme for styling */
  theme?: Theme | null;
  /** Whether to show toolbar (default: true) */
  showToolbar?: boolean;
  /** Whether to show variable panel (default: true) */
  showVariablePanel?: boolean;
  /** Whether to show zoom control (default: true) */
  showZoomControl?: boolean;
  /** Whether to show page number indicator (default: true) */
  showPageNumbers?: boolean;
  /** Whether to enable interactive page navigation (default: true) */
  enablePageNavigation?: boolean;
  /** Position of page number indicator (default: 'bottom-center') */
  pageNumberPosition?: PageIndicatorPosition | PageNavigatorPosition;
  /** Variant of page number indicator (default: 'default') */
  pageNumberVariant?: PageIndicatorVariant | PageNavigatorVariant;
  /** Whether to show page margin guides/boundaries (default: false) */
  showMarginGuides?: boolean;
  /** Color for margin guides (default: '#c0c0c0') */
  marginGuideColor?: string;
  /** Whether to show horizontal ruler (default: false) */
  showRuler?: boolean;
  /** Unit for ruler display (default: 'inch') */
  rulerUnit?: 'inch' | 'cm';
  /** Initial zoom level (default: 1.0) */
  initialZoom?: number;
  /** Whether the editor is read-only. When true, hides toolbar, rulers, and variable panel */
  readOnly?: boolean;
  /** Custom toolbar actions */
  toolbarExtra?: ReactNode;
  /** Variable panel position (default: 'right') */
  variablePanelPosition?: 'left' | 'right';
  /** Variable descriptions */
  variableDescriptions?: Record<string, string>;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Placeholder when no document */
  placeholder?: ReactNode;
  /** Loading indicator */
  loadingIndicator?: ReactNode;
  /** Whether to show print button in toolbar (default: true) */
  showPrintButton?: boolean;
  /** Print options for print preview */
  printOptions?: PrintOptions;
  /** Callback when print is triggered */
  onPrint?: () => void;
  /** Callback when content is copied */
  onCopy?: () => void;
  /** Callback when content is cut */
  onCut?: () => void;
  /** Callback when content is pasted */
  onPaste?: () => void;
  /**
   * Callback when rendered DOM context is ready (for plugin overlays).
   * Used by PluginHost to get access to the rendered page DOM for positioning.
   */
  onRenderedDomContextReady?: (context: RenderedDomContext) => void;
  /**
   * Plugin overlays to render inside the editor viewport.
   * Passed from PluginHost to render plugin-specific overlays.
   */
  pluginOverlays?: ReactNode;
}

/**
 * DocxEditor ref interface
 */
export interface DocxEditorRef {
  /** Get the DocumentAgent for programmatic access */
  getAgent: () => DocumentAgent | null;
  /** Get the current document */
  getDocument: () => Document | null;
  /** Get the editor ref */
  getEditorRef: () => PagedEditorRef | null;
  /** Save the document to buffer */
  save: () => Promise<ArrayBuffer | null>;
  /** Set zoom level */
  setZoom: (zoom: number) => void;
  /** Get current zoom level */
  getZoom: () => number;
  /** Focus the editor */
  focus: () => void;
  /** Get current page number */
  getCurrentPage: () => number;
  /** Get total page count */
  getTotalPages: () => number;
  /** Scroll to a specific page */
  scrollToPage: (pageNumber: number) => void;
  /** Open print preview */
  openPrintPreview: () => void;
  /** Print the document directly */
  print: () => void;
}

/**
 * Editor internal state
 */
interface EditorState {
  isLoading: boolean;
  parseError: string | null;
  zoom: number;
  variableValues: Record<string, string>;
  isApplyingVariables: boolean;
  /** Current selection formatting for toolbar */
  selectionFormatting: SelectionFormatting;
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total page count */
  totalPages: number;
  /** ProseMirror table context (for showing table toolbar) */
  pmTableContext: TableContextInfo | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * DocxEditor - Complete DOCX editor component
 */
export const DocxEditor = forwardRef<DocxEditorRef, DocxEditorProps>(function DocxEditor(
  {
    documentBuffer,
    document: initialDocument,
    onSave,
    onChange,
    onSelectionChange,
    onError,
    onFontsLoaded: onFontsLoadedCallback,
    theme,
    showToolbar = true,
    showVariablePanel = true,
    showZoomControl = true,
    showPageNumbers = true,
    enablePageNavigation = true,
    pageNumberPosition = 'bottom-center',
    pageNumberVariant = 'default',
    showMarginGuides: _showMarginGuides = false,
    marginGuideColor: _marginGuideColor,
    showRuler = false,
    rulerUnit = 'inch',
    initialZoom = 1.0,
    readOnly = false,
    toolbarExtra,
    variablePanelPosition = 'right',
    variableDescriptions,
    className = '',
    style,
    placeholder,
    loadingIndicator,
    showPrintButton = true,
    printOptions: _printOptions,
    onPrint,
    onCopy: _onCopy,
    onCut: _onCut,
    onPaste: _onPaste,
    externalPlugins,
    onEditorViewReady,
    onRenderedDomContextReady,
    pluginOverlays,
  },
  ref
) {
  // State
  const [state, setState] = useState<EditorState>({
    isLoading: !!documentBuffer,
    parseError: null,
    zoom: initialZoom,
    variableValues: {},
    isApplyingVariables: false,
    selectionFormatting: {},
    currentPage: 1,
    totalPages: 1,
    pmTableContext: null,
  });

  // History hook for undo/redo - start with null document
  const history = useDocumentHistory<Document | null>(initialDocument || null, {
    maxEntries: 100,
    groupingInterval: 500,
    enableKeyboardShortcuts: true,
  });

  // Refs
  const pagedEditorRef = useRef<PagedEditorRef>(null);
  const agentRef = useRef<DocumentAgent | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Save the last known selection for restoring after toolbar interactions
  const lastSelectionRef = useRef<{ from: number; to: number } | null>(null);

  // Helper to get the active editor's view
  const getActiveEditorView = useCallback(() => {
    return pagedEditorRef.current?.getView();
  }, []);

  // Helper to focus the active editor
  const focusActiveEditor = useCallback(() => {
    pagedEditorRef.current?.focus();
  }, []);

  // Helper to undo in the active editor
  const undoActiveEditor = useCallback(() => {
    pagedEditorRef.current?.undo();
  }, []);

  // Helper to redo in the active editor
  const redoActiveEditor = useCallback(() => {
    pagedEditorRef.current?.redo();
  }, []);

  // Find/Replace hook
  const findReplace = useFindReplace();

  // Hyperlink dialog hook
  const hyperlinkDialog = useHyperlinkDialog();

  // Parse document buffer
  useEffect(() => {
    if (!documentBuffer) {
      if (initialDocument) {
        history.reset(initialDocument);
        setState((prev) => ({ ...prev, isLoading: false }));
        // Load fonts for initial document
        loadDocumentFonts(initialDocument).catch((err) => {
          console.warn('Failed to load document fonts:', err);
        });
      }
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, parseError: null }));

    const parseDocument = async () => {
      try {
        const doc = await parseDocx(documentBuffer);
        // Reset history with parsed document (clears undo/redo stacks)
        history.reset(doc);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          parseError: null,
        }));

        // Extract initial variable values
        if (doc.package.document) {
          const variables = extractVariables(doc);
          setState((prev) => ({ ...prev, variableValues: variables }));
        }

        // Load fonts used in the document from Google Fonts
        loadDocumentFonts(doc).catch((err) => {
          console.warn('Failed to load document fonts:', err);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to parse document';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          parseError: message,
        }));
        onError?.(error instanceof Error ? error : new Error(message));
      }
    };

    parseDocument();
  }, [documentBuffer, initialDocument, onError]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update document when initialDocument changes
  useEffect(() => {
    if (initialDocument && !documentBuffer) {
      history.reset(initialDocument);
    }
  }, [initialDocument, documentBuffer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Create/update agent when document changes
  useEffect(() => {
    if (history.state) {
      agentRef.current = new DocumentAgent(history.state);
    } else {
      agentRef.current = null;
    }
  }, [history.state]);

  // Listen for font loading
  useEffect(() => {
    const cleanup = onFontsLoaded(() => {
      onFontsLoadedCallback?.();
    });
    return cleanup;
  }, [onFontsLoadedCallback]);

  // Keyboard shortcuts for Find/Replace (Ctrl+F, Ctrl+H)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+F (Find) or Ctrl+H (Replace)
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && !e.shiftKey && !e.altKey) {
        if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          // Get selected text if any
          const selection = window.getSelection();
          const selectedText = selection && !selection.isCollapsed ? selection.toString() : '';
          findReplace.openFind(selectedText);
        } else if (e.key.toLowerCase() === 'h') {
          e.preventDefault();
          // Get selected text if any
          const selection = window.getSelection();
          const selectedText = selection && !selection.isCollapsed ? selection.toString() : '';
          findReplace.openReplace(selectedText);
        } else if (e.key.toLowerCase() === 'k') {
          e.preventDefault();
          // Open hyperlink dialog
          const view = pagedEditorRef.current?.getView();
          if (view) {
            const selectedText = getSelectedText(view.state);
            const existingLink = getHyperlinkAttrs(view.state);
            if (existingLink) {
              hyperlinkDialog.openEdit({
                url: existingLink.href,
                displayText: selectedText,
                tooltip: existingLink.tooltip,
              });
            } else {
              hyperlinkDialog.openInsert(selectedText);
            }
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [findReplace, hyperlinkDialog]);

  // Handle document change
  const handleDocumentChange = useCallback(
    (newDocument: Document) => {
      history.push(newDocument);
      onChange?.(newDocument);
    },
    [onChange, history]
  );

  // Handle selection changes from ProseMirror
  const handleSelectionChange = useCallback(
    (selectionState: SelectionState | null) => {
      // Save selection for restoring after toolbar interactions
      const view = getActiveEditorView();
      if (view) {
        const { from, to } = view.state.selection;
        // Only save non-empty selections (when text is actually selected)
        if (from !== to) {
          lastSelectionRef.current = { from, to };
        }
      }

      // Also check table context from ProseMirror
      let pmTableCtx: TableContextInfo | null = null;
      if (view) {
        pmTableCtx = getTableContext(view.state);
        if (!pmTableCtx.isInTable) {
          pmTableCtx = null;
        }
      }

      if (!selectionState) {
        setState((prev) => ({
          ...prev,
          selectionFormatting: {},
          pmTableContext: pmTableCtx,
        }));
        return;
      }

      // Update toolbar formatting from ProseMirror selection
      const { textFormatting, paragraphFormatting } = selectionState;

      // Extract font family (prefer ascii, fall back to hAnsi)
      const fontFamily = textFormatting.fontFamily?.ascii || textFormatting.fontFamily?.hAnsi;

      // Extract text color as hex string
      const textColor = textFormatting.color?.rgb ? `#${textFormatting.color.rgb}` : undefined;

      // Build list state from numPr
      const numPr = paragraphFormatting.numPr;
      const listState = numPr
        ? {
            type: (numPr.numId === 1 ? 'bullet' : 'numbered') as 'bullet' | 'numbered',
            level: numPr.ilvl ?? 0,
            isInList: true,
            numId: numPr.numId,
          }
        : undefined;

      const formatting: SelectionFormatting = {
        bold: textFormatting.bold,
        italic: textFormatting.italic,
        underline: !!textFormatting.underline,
        strike: textFormatting.strike,
        superscript: textFormatting.vertAlign === 'superscript',
        subscript: textFormatting.vertAlign === 'subscript',
        fontFamily,
        fontSize: textFormatting.fontSize,
        color: textColor,
        highlight: textFormatting.highlight,
        alignment: paragraphFormatting.alignment,
        lineSpacing: paragraphFormatting.lineSpacing,
        listState,
        styleId: selectionState.styleId ?? undefined,
        indentLeft: paragraphFormatting.indentLeft,
      };
      setState((prev) => ({
        ...prev,
        selectionFormatting: formatting,
        pmTableContext: pmTableCtx,
      }));

      // Notify parent
      onSelectionChange?.(selectionState);
    },
    [onSelectionChange]
  );

  // Table selection hook
  const tableSelection = useTableSelection({
    document: history.state,
    onChange: handleDocumentChange,
    onSelectionChange: (_context) => {
      // Could notify parent of table selection changes
    },
  });

  // Handle table insert from toolbar
  const handleInsertTable = useCallback(
    (rows: number, columns: number) => {
      const view = getActiveEditorView();
      if (!view) return;
      insertTable(rows, columns)(view.state, view.dispatch);
      focusActiveEditor();
    },
    [getActiveEditorView, focusActiveEditor]
  );

  // Handle table action from Toolbar - use ProseMirror commands
  const handleTableAction = useCallback(
    (action: TableAction) => {
      const view = getActiveEditorView();
      if (!view) return;

      switch (action) {
        case 'addRowAbove':
          addRowAbove(view.state, view.dispatch);
          break;
        case 'addRowBelow':
          addRowBelow(view.state, view.dispatch);
          break;
        case 'addColumnLeft':
          addColumnLeft(view.state, view.dispatch);
          break;
        case 'addColumnRight':
          addColumnRight(view.state, view.dispatch);
          break;
        case 'deleteRow':
          pmDeleteRow(view.state, view.dispatch);
          break;
        case 'deleteColumn':
          pmDeleteColumn(view.state, view.dispatch);
          break;
        case 'deleteTable':
          pmDeleteTable(view.state, view.dispatch);
          break;
        // Border actions
        case 'borderAll':
          setAllTableBorders(view.state, view.dispatch);
          break;
        case 'borderOutside':
          setOutsideTableBorders(view.state, view.dispatch);
          break;
        case 'borderInside':
          setInsideTableBorders(view.state, view.dispatch);
          break;
        case 'borderNone':
          removeTableBorders(view.state, view.dispatch);
          break;
        default:
          // Handle complex actions (with parameters)
          if (typeof action === 'object') {
            if (action.type === 'cellFillColor') {
              setCellFillColor(action.color)(view.state, view.dispatch);
            } else if (action.type === 'borderColor') {
              setTableBorderColor(action.color)(view.state, view.dispatch);
            }
          } else {
            // Fallback to legacy table selection handler for other actions
            tableSelection.handleAction(action);
          }
      }

      focusActiveEditor();
    },
    [tableSelection, getActiveEditorView, focusActiveEditor]
  );

  // Handle formatting action from toolbar
  const handleFormat = useCallback((action: FormattingAction) => {
    const view = pagedEditorRef.current?.getView();
    if (!view) return;

    // Focus editor first to ensure we can dispatch commands
    view.focus();

    // Restore selection if it was lost during toolbar interaction
    // This happens when user clicks on dropdown menus (font picker, style picker, etc.)
    const { from, to } = view.state.selection;
    const isEmptySelection = from === to;
    const savedSelection = lastSelectionRef.current;

    if (isEmptySelection && savedSelection && savedSelection.from !== savedSelection.to) {
      // Selection was lost - restore it before applying the format
      try {
        const tr = view.state.tr.setSelection(
          TextSelection.create(view.state.doc, savedSelection.from, savedSelection.to)
        );
        view.dispatch(tr);
      } catch (e) {
        // If restoration fails (e.g., positions are invalid after doc change), continue with current selection
        console.warn('Could not restore selection:', e);
      }
    }

    // Handle simple toggle actions
    if (action === 'bold') {
      toggleBold(view.state, view.dispatch);
      return;
    }
    if (action === 'italic') {
      toggleItalic(view.state, view.dispatch);
      return;
    }
    if (action === 'underline') {
      toggleUnderline(view.state, view.dispatch);
      return;
    }
    if (action === 'strikethrough') {
      toggleStrike(view.state, view.dispatch);
      return;
    }
    if (action === 'superscript') {
      toggleSuperscript(view.state, view.dispatch);
      return;
    }
    if (action === 'subscript') {
      toggleSubscript(view.state, view.dispatch);
      return;
    }
    if (action === 'bulletList') {
      toggleBulletList(view.state, view.dispatch);
      return;
    }
    if (action === 'numberedList') {
      toggleNumberedList(view.state, view.dispatch);
      return;
    }
    if (action === 'indent') {
      // Try list indent first, then paragraph indent
      if (!increaseListLevel(view.state, view.dispatch)) {
        increaseIndent()(view.state, view.dispatch);
      }
      return;
    }
    if (action === 'outdent') {
      // Try list outdent first, then paragraph outdent
      if (!decreaseListLevel(view.state, view.dispatch)) {
        decreaseIndent()(view.state, view.dispatch);
      }
      return;
    }
    if (action === 'clearFormatting') {
      clearFormatting(view.state, view.dispatch);
      return;
    }
    if (action === 'insertLink') {
      // Get the selected text for the hyperlink dialog
      const selectedText = getSelectedText(view.state);
      // Check if we're editing an existing link
      const existingLink = getHyperlinkAttrs(view.state);
      if (existingLink) {
        hyperlinkDialog.openEdit({
          url: existingLink.href,
          displayText: selectedText,
          tooltip: existingLink.tooltip,
        });
      } else {
        hyperlinkDialog.openInsert(selectedText);
      }
      return;
    }

    // Handle object-based actions
    if (typeof action === 'object') {
      switch (action.type) {
        case 'alignment':
          setAlignment(action.value)(view.state, view.dispatch);
          break;
        case 'textColor':
          // action.value can be a string like "#FF0000" or a color name
          setTextColor({ rgb: action.value.replace('#', '') })(view.state, view.dispatch);
          break;
        case 'highlightColor':
          setHighlight(action.value)(view.state, view.dispatch);
          break;
        case 'fontSize':
          // Convert points to half-points (OOXML uses half-points for font sizes)
          setFontSize(pointsToHalfPoints(action.value))(view.state, view.dispatch);
          break;
        case 'fontFamily':
          setFontFamily(action.value)(view.state, view.dispatch);
          break;
        case 'lineSpacing':
          setLineSpacing(action.value)(view.state, view.dispatch);
          break;
        case 'applyStyle': {
          // Resolve style to get its formatting properties
          const styleResolver = history.state?.package.styles
            ? createStyleResolver(history.state.package.styles)
            : null;

          if (styleResolver) {
            const resolved = styleResolver.resolveParagraphStyle(action.value);
            applyStyle(action.value, {
              paragraphFormatting: resolved.paragraphFormatting,
              runFormatting: resolved.runFormatting,
            })(view.state, view.dispatch);
          } else {
            // No styles available, just set the styleId
            applyStyle(action.value)(view.state, view.dispatch);
          }
          break;
        }
      }
    }
  }, []);

  // Handle variable values change
  const handleVariableValuesChange = useCallback((values: Record<string, string>) => {
    setState((prev) => ({ ...prev, variableValues: values }));
  }, []);

  // Handle apply variables
  const handleApplyVariables = useCallback(
    async (values: Record<string, string>) => {
      if (!agentRef.current) return;

      setState((prev) => ({ ...prev, isApplyingVariables: true }));

      try {
        const newDoc = agentRef.current.setVariables(values).getDocument();
        handleDocumentChange(newDoc);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to apply variables'));
      } finally {
        setState((prev) => ({ ...prev, isApplyingVariables: false }));
      }
    },
    [handleDocumentChange, onError]
  );

  // Handle zoom change
  const handleZoomChange = useCallback((zoom: number) => {
    setState((prev) => ({ ...prev, zoom }));
  }, []);

  // Handle hyperlink dialog submit
  const handleHyperlinkSubmit = useCallback(
    (data: HyperlinkData) => {
      const view = getActiveEditorView();
      if (!view) return;

      const url = data.url || '';
      const tooltip = data.tooltip;

      // Check if we have a selection
      const { empty } = view.state.selection;

      if (empty && data.displayText) {
        // No selection but display text provided - insert new linked text
        insertHyperlink(data.displayText, url, tooltip)(view.state, view.dispatch);
      } else if (!empty) {
        // Have selection - apply hyperlink to it
        setHyperlink(url, tooltip)(view.state, view.dispatch);
      } else if (data.displayText) {
        // Empty selection but display text provided
        insertHyperlink(data.displayText, url, tooltip)(view.state, view.dispatch);
      }

      hyperlinkDialog.close();
      focusActiveEditor();
    },
    [hyperlinkDialog, getActiveEditorView, focusActiveEditor]
  );

  // Handle hyperlink removal
  const handleHyperlinkRemove = useCallback(() => {
    const view = getActiveEditorView();
    if (!view) return;

    removeHyperlink(view.state, view.dispatch);
    hyperlinkDialog.close();
    focusActiveEditor();
  }, [hyperlinkDialog, getActiveEditorView, focusActiveEditor]);

  // Handle margin changes from rulers
  const createMarginHandler = useCallback(
    (property: 'marginLeft' | 'marginRight' | 'marginTop' | 'marginBottom') =>
      (marginTwips: number) => {
        if (!history.state || readOnly) return;
        const newDoc = {
          ...history.state,
          package: {
            ...history.state.package,
            document: {
              ...history.state.package.document,
              finalSectionProperties: {
                ...history.state.package.document.finalSectionProperties,
                [property]: marginTwips,
              },
            },
          },
        };
        handleDocumentChange(newDoc);
      },
    [history.state, readOnly, handleDocumentChange]
  );

  const handleLeftMarginChange = useMemo(
    () => createMarginHandler('marginLeft'),
    [createMarginHandler]
  );
  const handleRightMarginChange = useMemo(
    () => createMarginHandler('marginRight'),
    [createMarginHandler]
  );
  const handleTopMarginChange = useMemo(
    () => createMarginHandler('marginTop'),
    [createMarginHandler]
  );
  const handleBottomMarginChange = useMemo(
    () => createMarginHandler('marginBottom'),
    [createMarginHandler]
  );

  // Handle page navigation (from PageNavigator)
  // TODO: Implement page navigation in ProseMirror
  const handlePageNavigate = useCallback((_pageNumber: number) => {
    // Page navigation not yet implemented for ProseMirror
  }, []);

  // Handle save
  const handleSave = useCallback(async (): Promise<ArrayBuffer | null> => {
    if (!agentRef.current) return null;

    try {
      const buffer = await agentRef.current.toBuffer();
      onSave?.(buffer);
      return buffer;
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to save document'));
      return null;
    }
  }, [onSave, onError]);

  // Handle error from editor
  const handleEditorError = useCallback(
    (error: Error) => {
      onError?.(error);
    },
    [onError]
  );

  const handleDirectPrint = useCallback(() => {
    // Find the pages container and clone its content into a clean print window
    const pagesEl = containerRef.current?.querySelector('.paged-editor__pages');
    if (!pagesEl) {
      window.print();
      onPrint?.();
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // Popup blocked — fall back to window.print()
      window.print();
      onPrint?.();
      return;
    }

    // Collect all @font-face rules from the current page
    const fontFaceRules: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSFontFaceRule) {
            fontFaceRules.push(rule.cssText);
          }
        }
      } catch {
        // Cross-origin stylesheets can't be read — skip
      }
    }

    // Clone pages and remove transforms/shadows
    const pagesClone = pagesEl.cloneNode(true) as HTMLElement;
    pagesClone.style.cssText = 'display: block; margin: 0; padding: 0;';
    for (const page of Array.from(pagesClone.querySelectorAll('.layout-page'))) {
      const el = page as HTMLElement;
      el.style.boxShadow = 'none';
      el.style.margin = '0';
    }

    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Print</title>
<style>
${fontFaceRules.join('\n')}
* { margin: 0; padding: 0; }
body { background: white; }
.layout-page { break-after: page; }
.layout-page:last-child { break-after: auto; }
@page { margin: 0; size: auto; }
</style>
</head><body>${pagesClone.outerHTML}</body></html>`);
    printWindow.document.close();

    // Wait for fonts/images then print
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };

    // Fallback if onload doesn't fire (some browsers)
    setTimeout(() => {
      if (!printWindow.closed) {
        printWindow.print();
        printWindow.close();
      }
    }, 1000);

    onPrint?.();
  }, [onPrint]);

  // ============================================================================
  // FIND/REPLACE HANDLERS
  // ============================================================================

  // Store the current find result for navigation
  const findResultRef = useRef<FindResult | null>(null);

  // Handle find operation
  const handleFind = useCallback(
    (searchText: string, options: FindOptions): FindResult | null => {
      if (!history.state || !searchText.trim()) {
        findResultRef.current = null;
        return null;
      }

      const matches = findInDocument(history.state, searchText, options);
      const result: FindResult = {
        matches,
        totalCount: matches.length,
        currentIndex: 0,
      };

      findResultRef.current = result;
      findReplace.setMatches(matches, 0);

      // Scroll to first match
      if (matches.length > 0 && containerRef.current) {
        scrollToMatch(containerRef.current, matches[0]);
      }

      return result;
    },
    [history.state, findReplace]
  );

  // Handle find next
  const handleFindNext = useCallback((): FindMatch | null => {
    if (!findResultRef.current || findResultRef.current.matches.length === 0) {
      return null;
    }

    const newIndex = findReplace.goToNextMatch();
    const match = findResultRef.current.matches[newIndex];

    // Scroll to the match
    if (match && containerRef.current) {
      scrollToMatch(containerRef.current, match);
    }

    return match || null;
  }, [findReplace]);

  // Handle find previous
  const handleFindPrevious = useCallback((): FindMatch | null => {
    if (!findResultRef.current || findResultRef.current.matches.length === 0) {
      return null;
    }

    const newIndex = findReplace.goToPreviousMatch();
    const match = findResultRef.current.matches[newIndex];

    // Scroll to the match
    if (match && containerRef.current) {
      scrollToMatch(containerRef.current, match);
    }

    return match || null;
  }, [findReplace]);

  // Handle replace current match
  const handleReplace = useCallback(
    (replaceText: string): boolean => {
      if (!history.state || !findResultRef.current || findResultRef.current.matches.length === 0) {
        return false;
      }

      const currentMatch = findResultRef.current.matches[findResultRef.current.currentIndex];
      if (!currentMatch) return false;

      // Execute replace command
      try {
        const newDoc = executeCommand(history.state, {
          type: 'replaceText',
          range: {
            start: {
              paragraphIndex: currentMatch.paragraphIndex,
              offset: currentMatch.startOffset,
            },
            end: {
              paragraphIndex: currentMatch.paragraphIndex,
              offset: currentMatch.endOffset,
            },
          },
          text: replaceText,
        });

        handleDocumentChange(newDoc);
        return true;
      } catch (error) {
        console.error('Replace failed:', error);
        return false;
      }
    },
    [history.state, handleDocumentChange]
  );

  // Handle replace all matches
  const handleReplaceAll = useCallback(
    (searchText: string, replaceText: string, options: FindOptions): number => {
      if (!history.state || !searchText.trim()) {
        return 0;
      }

      // Find all matches first
      const matches = findInDocument(history.state, searchText, options);
      if (matches.length === 0) return 0;

      // Replace from end to start to maintain correct indices
      let doc = history.state;
      const sortedMatches = [...matches].sort((a, b) => {
        if (a.paragraphIndex !== b.paragraphIndex) {
          return b.paragraphIndex - a.paragraphIndex;
        }
        return b.startOffset - a.startOffset;
      });

      for (const match of sortedMatches) {
        try {
          doc = executeCommand(doc, {
            type: 'replaceText',
            range: {
              start: {
                paragraphIndex: match.paragraphIndex,
                offset: match.startOffset,
              },
              end: {
                paragraphIndex: match.paragraphIndex,
                offset: match.endOffset,
              },
            },
            text: replaceText,
          });
        } catch (error) {
          console.error('Replace failed for match:', match, error);
        }
      }

      handleDocumentChange(doc);
      findResultRef.current = null;
      findReplace.setMatches([], 0);

      return matches.length;
    },
    [history.state, handleDocumentChange, findReplace]
  );

  // Expose ref methods
  useImperativeHandle(
    ref,
    () => ({
      getAgent: () => agentRef.current,
      getDocument: () => history.state,
      getEditorRef: () => pagedEditorRef.current,
      save: handleSave,
      setZoom: (zoom: number) => setState((prev) => ({ ...prev, zoom })),
      getZoom: () => state.zoom,
      focus: () => {
        pagedEditorRef.current?.focus();
      },
      getCurrentPage: () => state.currentPage,
      getTotalPages: () => state.totalPages,
      scrollToPage: (_pageNumber: number) => {
        // TODO: Implement page navigation in ProseMirror
      },
      openPrintPreview: handleDirectPrint,
      print: handleDirectPrint,
    }),
    [history.state, state.zoom, state.currentPage, state.totalPages, handleSave, handleDirectPrint]
  );

  // Get detected variables from document
  const detectedVariables = useMemo(() => {
    if (!history.state) return [];
    return extractVariableNames(history.state);
  }, [history.state]);

  // Get header and footer content from document
  const { headerContent, footerContent } = useMemo<{
    headerContent: HeaderFooter | null;
    footerContent: HeaderFooter | null;
  }>(() => {
    if (!history.state?.package) {
      return { headerContent: null, footerContent: null };
    }

    const pkg = history.state.package;
    const sectionProps = pkg.document?.finalSectionProperties;
    const headers = pkg.headers;
    const footers = pkg.footers;

    let header: HeaderFooter | null = null;
    let footer: HeaderFooter | null = null;

    // Get default header from section references
    if (headers && sectionProps?.headerReferences) {
      const defaultRef = sectionProps.headerReferences.find((r) => r.type === 'default');
      if (defaultRef?.rId) {
        header = headers.get(defaultRef.rId) ?? null;
      }
    }

    // Get default footer from section references
    if (footers && sectionProps?.footerReferences) {
      const defaultRef = sectionProps.footerReferences.find((r) => r.type === 'default');
      if (defaultRef?.rId) {
        footer = footers.get(defaultRef.rId) ?? null;
      }
    }

    return { headerContent: header, footerContent: footer };
  }, [history.state]);

  // Container styles - using overflow: auto so sticky toolbar works
  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    backgroundColor: 'var(--doc-bg-subtle)',
    ...style,
  };

  const mainContentStyle: CSSProperties = {
    display: 'flex',
    flex: 1,
    minHeight: 0, // Allow flex item to shrink below content size
    flexDirection: variablePanelPosition === 'left' ? 'row-reverse' : 'row',
  };

  const editorContainerStyle: CSSProperties = {
    flex: 1,
    overflow: 'auto', // This is the scroll container - sticky toolbar will stick to this
    position: 'relative',
  };

  const variablePanelStyle: CSSProperties = {
    width: '300px',
    borderLeft: variablePanelPosition === 'right' ? '1px solid var(--doc-border)' : undefined,
    borderRight: variablePanelPosition === 'left' ? '1px solid var(--doc-border)' : undefined,
    overflow: 'auto',
    backgroundColor: 'white',
  };

  // Render loading state
  if (state.isLoading) {
    return (
      <div
        className={`docx-editor docx-editor-loading ${className}`}
        style={containerStyle}
        data-testid="docx-editor"
      >
        {loadingIndicator || <DefaultLoadingIndicator />}
      </div>
    );
  }

  // Render error state
  if (state.parseError) {
    return (
      <div
        className={`docx-editor docx-editor-error ${className}`}
        style={containerStyle}
        data-testid="docx-editor"
      >
        <ParseError message={state.parseError} />
      </div>
    );
  }

  // Render placeholder when no document
  if (!history.state) {
    return (
      <div
        className={`docx-editor docx-editor-empty ${className}`}
        style={containerStyle}
        data-testid="docx-editor"
      >
        {placeholder || <DefaultPlaceholder />}
      </div>
    );
  }

  return (
    <ErrorProvider>
      <ErrorBoundary onError={handleEditorError}>
        <div
          ref={containerRef}
          className={`docx-editor ${className}`}
          style={containerStyle}
          data-testid="docx-editor"
        >
          {/* Main content area */}
          <div style={mainContentStyle}>
            {/* Editor container - this is the scroll container */}
            <div style={editorContainerStyle}>
              {/* Toolbar - sticky at top of scroll container */}
              {/* Hide toolbar in read-only mode unless explicitly requested */}
              {showToolbar && !readOnly && (
                <div className="sticky top-0 z-50 flex flex-col gap-0 bg-white shadow-sm">
                  <Toolbar
                    currentFormatting={state.selectionFormatting}
                    onFormat={handleFormat}
                    onUndo={undoActiveEditor}
                    onRedo={redoActiveEditor}
                    canUndo={true}
                    canRedo={true}
                    disabled={readOnly}
                    documentStyles={history.state?.package.styles?.styles}
                    theme={history.state?.package.theme || theme}
                    showPrintButton={showPrintButton}
                    onPrint={handleDirectPrint}
                    showZoomControl={showZoomControl}
                    zoom={state.zoom}
                    onZoomChange={handleZoomChange}
                    onRefocusEditor={focusActiveEditor}
                    onInsertTable={handleInsertTable}
                    showTableInsert={true}
                    tableContext={state.pmTableContext}
                    onTableAction={handleTableAction}
                  >
                    {toolbarExtra}
                  </Toolbar>

                  {/* Horizontal Ruler - sticky with toolbar */}
                  {showRuler && (
                    <div className="flex justify-center px-5 py-1 overflow-x-auto flex-shrink-0 bg-doc-bg">
                      <HorizontalRuler
                        sectionProps={history.state?.package.document?.finalSectionProperties}
                        zoom={state.zoom}
                        unit={rulerUnit}
                        editable={!readOnly}
                        onLeftMarginChange={handleLeftMarginChange}
                        onRightMarginChange={handleRightMarginChange}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Vertical Ruler - fixed on left edge (hidden in read-only mode) */}
              {showRuler && !readOnly && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    paddingTop: 20,
                    zIndex: 10,
                  }}
                >
                  <VerticalRuler
                    sectionProps={history.state?.package.document?.finalSectionProperties}
                    zoom={state.zoom}
                    unit={rulerUnit}
                    editable={!readOnly}
                    onTopMarginChange={handleTopMarginChange}
                    onBottomMarginChange={handleBottomMarginChange}
                  />
                </div>
              )}

              {/* Editor content area */}
              <div
                style={{ position: 'relative' }}
                onMouseDown={(e) => {
                  // Focus editor when clicking on the background area (not the editor itself)
                  // Using mouseDown for immediate response before focus can be lost
                  if (e.target === e.currentTarget) {
                    e.preventDefault();
                    pagedEditorRef.current?.focus();
                  }
                }}
              >
                <PagedEditor
                  ref={pagedEditorRef}
                  document={history.state}
                  styles={history.state?.package.styles}
                  theme={history.state?.package.theme || theme}
                  sectionProperties={history.state?.package.document?.finalSectionProperties}
                  headerContent={headerContent}
                  footerContent={footerContent}
                  zoom={state.zoom}
                  readOnly={readOnly}
                  onDocumentChange={handleDocumentChange}
                  onSelectionChange={(_from, _to) => {
                    // Extract full selection state from PM and use the standard handler
                    const view = pagedEditorRef.current?.getView();
                    if (view) {
                      const selectionState = extractSelectionState(view.state);
                      handleSelectionChange(selectionState);
                    } else {
                      handleSelectionChange(null);
                    }
                  }}
                  externalPlugins={externalPlugins}
                  onReady={(ref) => {
                    onEditorViewReady?.(ref.getView()!);
                  }}
                  onRenderedDomContextReady={onRenderedDomContextReady}
                  pluginOverlays={pluginOverlays}
                />

                {/* Page navigation / indicator */}
                {showPageNumbers &&
                  state.totalPages > 0 &&
                  (enablePageNavigation ? (
                    <PageNavigator
                      currentPage={state.currentPage}
                      totalPages={state.totalPages}
                      onNavigate={handlePageNavigate}
                      position={pageNumberPosition as PageNavigatorPosition}
                      variant={pageNumberVariant as PageNavigatorVariant}
                      floating
                    />
                  ) : (
                    <PageNumberIndicator
                      currentPage={state.currentPage}
                      totalPages={state.totalPages}
                      position={pageNumberPosition as PageIndicatorPosition}
                      variant={pageNumberVariant as PageIndicatorVariant}
                      floating
                    />
                  ))}
              </div>
            </div>

            {/* Variable panel (hidden in read-only mode) */}
            {showVariablePanel && !readOnly && detectedVariables.length > 0 && (
              <div style={variablePanelStyle}>
                <VariablePanel
                  variables={detectedVariables}
                  values={state.variableValues}
                  onValuesChange={handleVariableValuesChange}
                  onApply={handleApplyVariables}
                  isApplying={state.isApplyingVariables}
                  descriptions={variableDescriptions}
                  disabled={readOnly}
                />
              </div>
            )}
          </div>

          {/* Find/Replace Dialog */}
          <FindReplaceDialog
            isOpen={findReplace.state.isOpen}
            onClose={findReplace.close}
            onFind={handleFind}
            onFindNext={handleFindNext}
            onFindPrevious={handleFindPrevious}
            onReplace={handleReplace}
            onReplaceAll={handleReplaceAll}
            initialSearchText={findReplace.state.searchText}
            replaceMode={findReplace.state.replaceMode}
            currentResult={findResultRef.current}
          />

          {/* Hyperlink Dialog */}
          <HyperlinkDialog
            isOpen={hyperlinkDialog.state.isOpen}
            onClose={hyperlinkDialog.close}
            onSubmit={handleHyperlinkSubmit}
            onRemove={hyperlinkDialog.state.isEditing ? handleHyperlinkRemove : undefined}
            initialData={hyperlinkDialog.state.initialData}
            selectedText={hyperlinkDialog.state.selectedText}
            isEditing={hyperlinkDialog.state.isEditing}
          />
        </div>
      </ErrorBoundary>
    </ErrorProvider>
  );
});

// ============================================================================
// EXPORTS
// ============================================================================

export default DocxEditor;
