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

import React, {
  useRef,
  useCallback,
  useState,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Document, Theme } from '../types/document';

import { Toolbar, type SelectionFormatting, type FormattingAction } from './Toolbar';
import { VariablePanel } from './VariablePanel';
import { ErrorBoundary, ErrorProvider } from './ErrorBoundary';
import { TableToolbar, type TableContext, type TableAction } from './ui/TableToolbar';
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
import { PrintPreview, type PrintOptions } from './ui/PrintPreview';
import {
  FindReplaceDialog,
  useFindReplace,
  findInDocument,
  scrollToMatch,
  type FindMatch,
  type FindOptions,
  type FindResult,
} from './dialogs/FindReplaceDialog';
import { DocumentAgent } from '../agent/DocumentAgent';
import { parseDocx } from '../docx/parser';
import { onFontsLoaded } from '../utils/fontLoader';
import { executeCommand } from '../agent/executor';
import { useTableSelection } from '../hooks/useTableSelection';
import { useDocumentHistory } from '../hooks/useHistory';

// ProseMirror editor
import {
  ProseMirrorEditor,
  type ProseMirrorEditorRef,
  type SelectionState,
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
} from '../prosemirror';

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
  /** Whether the editor is read-only */
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
}

/**
 * DocxEditor ref interface
 */
export interface DocxEditorRef {
  /** Get the DocumentAgent for programmatic access */
  getAgent: () => DocumentAgent | null;
  /** Get the current document */
  getDocument: () => Document | null;
  /** Get the ProseMirror editor ref */
  getEditorRef: () => ProseMirrorEditorRef | null;
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
  /** Whether print preview is open */
  isPrintPreviewOpen: boolean;
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
    printOptions,
    onPrint,
    onCopy: _onCopy,
    onCut: _onCut,
    onPaste: _onPaste,
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
    isPrintPreviewOpen: false,
  });

  // History hook for undo/redo - start with null document
  const history = useDocumentHistory<Document | null>(initialDocument || null, {
    maxEntries: 100,
    groupingInterval: 500,
    enableKeyboardShortcuts: true,
  });

  // Refs
  const editorRef = useRef<ProseMirrorEditorRef>(null);
  const agentRef = useRef<DocumentAgent | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find/Replace hook
  const findReplace = useFindReplace();

  // Parse document buffer
  useEffect(() => {
    if (!documentBuffer) {
      if (initialDocument) {
        history.reset(initialDocument);
        setState((prev) => ({ ...prev, isLoading: false }));
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
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [findReplace]);

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
      if (!selectionState) {
        setState((prev) => ({
          ...prev,
          selectionFormatting: {},
        }));
        return;
      }

      // Update toolbar formatting from ProseMirror selection
      const formatting: SelectionFormatting = {
        bold: selectionState.textFormatting.bold,
        italic: selectionState.textFormatting.italic,
        underline: !!selectionState.textFormatting.underline,
        strike: selectionState.textFormatting.strike,
        alignment: selectionState.paragraphFormatting.alignment,
        styleId: selectionState.styleId ?? undefined,
      };
      setState((prev) => ({
        ...prev,
        selectionFormatting: formatting,
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

  // Handle table action from TableToolbar
  const handleTableAction = useCallback(
    (action: TableAction, _context: TableContext) => {
      tableSelection.handleAction(action);
    },
    [tableSelection]
  );

  // Handle formatting action from toolbar
  const handleFormat = useCallback((action: FormattingAction) => {
    const view = editorRef.current?.getView();
    if (!view) return;

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
          setFontSize(action.value)(view.state, view.dispatch);
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

  // Handle opening print preview
  const handleOpenPrintPreview = useCallback(() => {
    setState((prev) => ({ ...prev, isPrintPreviewOpen: true }));
  }, []);

  // Handle closing print preview
  const handleClosePrintPreview = useCallback(() => {
    setState((prev) => ({ ...prev, isPrintPreviewOpen: false }));
  }, []);

  // Handle print action
  const handlePrint = useCallback(() => {
    onPrint?.();
  }, [onPrint]);

  // Handle direct print (opens system print dialog for current view)
  const handleDirectPrint = useCallback(() => {
    window.print();
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
      getEditorRef: () => editorRef.current,
      save: handleSave,
      setZoom: (zoom: number) => setState((prev) => ({ ...prev, zoom })),
      getZoom: () => state.zoom,
      focus: () => editorRef.current?.focus(),
      getCurrentPage: () => state.currentPage,
      getTotalPages: () => state.totalPages,
      scrollToPage: (_pageNumber: number) => {
        // TODO: Implement page navigation in ProseMirror
      },
      openPrintPreview: handleOpenPrintPreview,
      print: handleDirectPrint,
    }),
    [
      history.state,
      state.zoom,
      state.currentPage,
      state.totalPages,
      handleSave,
      handleOpenPrintPreview,
      handleDirectPrint,
    ]
  );

  // Get detected variables from document
  const detectedVariables = useMemo(() => {
    if (!history.state) return [];
    return extractVariableNames(history.state);
  }, [history.state]);

  // Container styles
  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    ...style,
  };

  const mainContentStyle: CSSProperties = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    flexDirection: variablePanelPosition === 'left' ? 'row-reverse' : 'row',
  };

  const editorContainerStyle: CSSProperties = {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  };

  const variablePanelStyle: CSSProperties = {
    width: '300px',
    borderLeft: variablePanelPosition === 'right' ? '1px solid #e0e0e0' : undefined,
    borderRight: variablePanelPosition === 'left' ? '1px solid #e0e0e0' : undefined,
    overflow: 'auto',
    backgroundColor: '#fff',
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
          {/* Toolbar */}
          {showToolbar && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Toolbar
                currentFormatting={state.selectionFormatting}
                onFormat={handleFormat}
                onUndo={() => editorRef.current?.undo()}
                onRedo={() => editorRef.current?.redo()}
                canUndo={true}
                canRedo={true}
                disabled={readOnly}
                documentStyles={history.state?.package.styles?.styles}
                theme={history.state?.package.theme || theme}
                showPrintButton={showPrintButton}
                onPrint={handleOpenPrintPreview}
                showZoomControl={showZoomControl}
                zoom={state.zoom}
                onZoomChange={handleZoomChange}
              >
                {toolbarExtra}
              </Toolbar>

              {/* Table Toolbar - shows when a table cell is selected */}
              {tableSelection.tableContext && (
                <TableToolbar
                  context={tableSelection.tableContext}
                  onAction={handleTableAction}
                  disabled={readOnly}
                  compact
                />
              )}
            </div>
          )}

          {/* Main content area */}
          <div style={mainContentStyle}>
            {/* Editor */}
            <div style={editorContainerStyle}>
              {/* Horizontal Ruler */}
              {showRuler && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    backgroundColor: '#f0f0f0',
                    padding: '4px 20px',
                    borderBottom: '1px solid #d0d0d0',
                    overflow: 'auto',
                    flexShrink: 0,
                  }}
                >
                  <HorizontalRuler
                    sectionProps={history.state?.package.document?.finalSectionProperties}
                    zoom={state.zoom}
                    unit={rulerUnit}
                    editable={false}
                  />
                </div>
              )}

              <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
                <ProseMirrorEditor
                  ref={editorRef}
                  document={history.state}
                  onChange={handleDocumentChange}
                  onSelectionChange={handleSelectionChange}
                  readOnly={readOnly}
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

            {/* Variable panel */}
            {showVariablePanel && detectedVariables.length > 0 && (
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

          {/* Print Preview Modal */}
          {state.isPrintPreviewOpen && (
            <PrintPreview
              document={history.state}
              theme={history.state?.package.theme || theme}
              options={printOptions}
              isOpen={state.isPrintPreviewOpen}
              onClose={handleClosePrintPreview}
              onPrint={handlePrint}
            />
          )}

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
        </div>
      </ErrorBoundary>
    </ErrorProvider>
  );
});

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

/**
 * Default loading indicator
 */
function DefaultLoadingIndicator(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#666',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e0e0e0',
          borderTop: '3px solid #1a73e8',
          borderRadius: '50%',
          animation: 'docx-spin 1s linear infinite',
        }}
      />
      <style>
        {`
          @keyframes docx-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={{ marginTop: '16px' }}>Loading document...</div>
    </div>
  );
}

/**
 * Default placeholder
 */
function DefaultPlaceholder(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#999',
      }}
    >
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <div style={{ marginTop: '16px' }}>No document loaded</div>
    </div>
  );
}

/**
 * Parse error display
 */
function ParseError({ message }: { message: string }): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '20px',
        textAlign: 'center',
      }}
    >
      <div style={{ color: '#c5221f', marginBottom: '16px' }}>
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16v.01" />
        </svg>
      </div>
      <h3 style={{ color: '#c5221f', marginBottom: '8px' }}>Failed to Load Document</h3>
      <p style={{ color: '#666', maxWidth: '400px' }}>{message}</p>
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract variable names from document
 */
function extractVariableNames(doc: Document): string[] {
  const variables = new Set<string>();
  const regex = /\{\{([^}]+)\}\}/g;

  const extractFromParagraph = (paragraph: any) => {
    for (const item of paragraph.content || []) {
      if (item.type === 'run') {
        for (const content of item.content || []) {
          if (content.type === 'text') {
            let match;
            while ((match = regex.exec(content.text)) !== null) {
              variables.add(match[1].trim());
            }
          }
        }
      }
    }
  };

  const body = doc.package.document;
  for (const block of body.content || []) {
    if (block.type === 'paragraph') {
      extractFromParagraph(block);
    }
  }

  return Array.from(variables);
}

/**
 * Extract current variable values (placeholders with current text)
 */
function extractVariables(doc: Document): Record<string, string> {
  const values: Record<string, string> = {};
  const names = extractVariableNames(doc);

  for (const name of names) {
    values[name] = ''; // Default empty
  }

  return values;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default DocxEditor;
