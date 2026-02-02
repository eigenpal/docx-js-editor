/**
 * DocxEditor Component
 *
 * Main component integrating all editor features:
 * - Toolbar for formatting
 * - Editor for content editing
 * - VariablePanel for template variables
 * - Context menu for AI actions
 * - Zoom control
 * - Error boundary
 * - Loading states
 */

import React, { useRef, useCallback, useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Document, Theme, TextFormatting, ParagraphFormatting } from '../types/document';
import type { AIAction, AIActionRequest, AgentResponse, SelectionContext } from '../types/agentApi';

import { Toolbar, type SelectionFormatting, type FormattingAction, getSelectionFormatting, applyFormattingAction } from './Toolbar';
import { AIEditor, type AIEditorRef, type AIEditorProps, type AIRequestHandler } from './AIEditor';
import { VariablePanel, type VariablePanelProps } from './VariablePanel';
import { ErrorBoundary, ErrorProvider, useErrorNotifications } from './ErrorBoundary';
import { ZoomControl } from './ui/ZoomControl';
import { TableToolbar, type TableContext, type TableAction } from './ui/TableToolbar';
import { PageNumberIndicator, type PageIndicatorPosition, type PageIndicatorVariant } from './ui/PageNumberIndicator';
import { PageNavigator, type PageNavigatorPosition, type PageNavigatorVariant } from './ui/PageNavigator';
import { DocumentAgent } from '../agent/DocumentAgent';
import { parseDocx } from '../docx/parser';
import { onFontsLoaded, isLoading as isFontsLoading } from '../utils/fontLoader';
import { executeCommand } from '../agent/executor';
import { useTableSelection } from '../hooks/useTableSelection';
import { useDocumentHistory } from '../hooks/useHistory';

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
  /** Handler for AI requests */
  onAgentRequest?: AIRequestHandler;
  /** Callback when document changes */
  onChange?: (document: Document) => void;
  /** Callback when selection changes */
  onSelectionChange?: (context: SelectionContext | null) => void;
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
  getEditorRef: () => AIEditorRef | null;
  /** Save the document to buffer */
  save: () => Promise<ArrayBuffer | null>;
  /** Set zoom level */
  setZoom: (zoom: number) => void;
  /** Get current zoom level */
  getZoom: () => number;
  /** Focus the editor */
  focus: () => void;
  /** Get current selection context */
  getSelectionContext: () => SelectionContext | null;
  /** Trigger an AI action */
  triggerAIAction: (action: AIAction, customPrompt?: string) => Promise<void>;
  /** Get current page number */
  getCurrentPage: () => number;
  /** Get total page count */
  getTotalPages: () => number;
  /** Scroll to a specific page */
  scrollToPage: (pageNumber: number) => void;
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
    onAgentRequest,
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
    showMarginGuides = false,
    marginGuideColor,
    initialZoom = 1.0,
    readOnly = false,
    toolbarExtra,
    variablePanelPosition = 'right',
    variableDescriptions,
    className = '',
    style,
    placeholder,
    loadingIndicator,
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
  });

  // History hook for undo/redo - start with null document
  const history = useDocumentHistory<Document | null>(initialDocument || null, {
    maxEntries: 100,
    groupingInterval: 500,
    enableKeyboardShortcuts: true,
  });

  // Refs
  const editorRef = useRef<AIEditorRef>(null);
  const agentRef = useRef<DocumentAgent | null>(null);

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

  // Listen for selection changes to update toolbar formatting
  useEffect(() => {
    const handleSelectionChangeEvent = () => {
      if (!editorRef.current) return;

      const context = editorRef.current.getSelectionContext();
      if (context && context.formatting) {
        setState((prev) => ({
          ...prev,
          selectionFormatting: getSelectionFormatting(context.formatting, context.paragraphFormatting),
        }));
      } else {
        setState((prev) => ({
          ...prev,
          selectionFormatting: {},
        }));
      }
      onSelectionChange?.(context);
    };

    // Listen for selection changes
    document.addEventListener('selectionchange', handleSelectionChangeEvent);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChangeEvent);
    };
  }, [onSelectionChange]);

  // Handle document change
  const handleDocumentChange = useCallback(
    (newDocument: Document) => {
      history.push(newDocument);
      onChange?.(newDocument);
    },
    [onChange, history]
  );

  // Table selection hook
  const tableSelection = useTableSelection({
    document: history.state,
    onChange: handleDocumentChange,
    onSelectionChange: (context) => {
      // Could notify parent of table selection changes
    },
  });

  // Handle table action from TableToolbar
  const handleTableAction = useCallback(
    (action: TableAction, context: TableContext) => {
      tableSelection.handleAction(action);
    },
    [tableSelection]
  );

  // Handle formatting action from toolbar
  const handleFormat = useCallback(
    (action: FormattingAction) => {
      if (!editorRef.current || !history.state) return;

      // Get current selection context
      const selectionContext = editorRef.current.getSelectionContext();
      if (!selectionContext || !selectionContext.range) return;

      const { range } = selectionContext;

      // Handle applyStyle action (paragraph-level - applies a named style)
      if (typeof action === 'object' && action.type === 'applyStyle') {
        // Apply style using applyStyle command
        const newDoc = executeCommand(history.state, {
          type: 'applyStyle',
          paragraphIndex: range.start.paragraphIndex,
          styleId: action.value,
        });

        handleDocumentChange(newDoc);

        // Update selection formatting state
        setState((prev) => ({
          ...prev,
          selectionFormatting: {
            ...prev.selectionFormatting,
            styleId: action.value,
          },
        }));
        return;
      }

      // Handle alignment action (paragraph-level formatting)
      if (typeof action === 'object' && action.type === 'alignment') {
        // Apply paragraph formatting using formatParagraph command
        const newDoc = executeCommand(history.state, {
          type: 'formatParagraph',
          paragraphIndex: range.start.paragraphIndex,
          formatting: { alignment: action.value },
        });

        handleDocumentChange(newDoc);

        // Update selection formatting state
        setState((prev) => ({
          ...prev,
          selectionFormatting: {
            ...prev.selectionFormatting,
            alignment: action.value,
          },
        }));
        return;
      }

      // Handle line spacing action (paragraph-level formatting)
      if (typeof action === 'object' && action.type === 'lineSpacing') {
        // Apply paragraph formatting using formatParagraph command
        // lineSpacing in OOXML uses 'auto' lineRule by default, value is in twips (240 = single)
        const newDoc = executeCommand(history.state, {
          type: 'formatParagraph',
          paragraphIndex: range.start.paragraphIndex,
          formatting: {
            lineSpacing: action.value,
            lineSpacingRule: 'auto',
          },
        });

        handleDocumentChange(newDoc);

        // Update selection formatting state
        setState((prev) => ({
          ...prev,
          selectionFormatting: {
            ...prev.selectionFormatting,
            lineSpacing: action.value,
          },
        }));
        return;
      }

      // Handle bullet list action (paragraph-level)
      if (action === 'bulletList') {
        const currentListState = state.selectionFormatting.listState;
        const isCurrentlyBulletList = currentListState?.type === 'bullet';

        // Toggle bullet list: if already bullet list, remove it; otherwise set it
        const newNumPr = isCurrentlyBulletList
          ? undefined // Remove list
          : { numId: 1, ilvl: 0 }; // Set to bullet list (numId 1 is typically bullets)

        const newDoc = executeCommand(history.state, {
          type: 'formatParagraph',
          paragraphIndex: range.start.paragraphIndex,
          formatting: { numPr: newNumPr },
        });

        handleDocumentChange(newDoc);

        // Update selection formatting state
        setState((prev) => ({
          ...prev,
          selectionFormatting: {
            ...prev.selectionFormatting,
            listState: newNumPr
              ? { type: 'bullet', level: 0, isInList: true, numId: 1 }
              : { type: 'none', level: 0, isInList: false },
          },
        }));
        return;
      }

      // Handle numbered list action (paragraph-level)
      if (action === 'numberedList') {
        const currentListState = state.selectionFormatting.listState;
        const isCurrentlyNumberedList = currentListState?.type === 'numbered';

        // Toggle numbered list: if already numbered list, remove it; otherwise set it
        const newNumPr = isCurrentlyNumberedList
          ? undefined // Remove list
          : { numId: 2, ilvl: 0 }; // Set to numbered list (numId 2 is typically numbered)

        const newDoc = executeCommand(history.state, {
          type: 'formatParagraph',
          paragraphIndex: range.start.paragraphIndex,
          formatting: { numPr: newNumPr },
        });

        handleDocumentChange(newDoc);

        // Update selection formatting state
        setState((prev) => ({
          ...prev,
          selectionFormatting: {
            ...prev.selectionFormatting,
            listState: newNumPr
              ? { type: 'numbered', level: 0, isInList: true, numId: 2 }
              : { type: 'none', level: 0, isInList: false },
          },
        }));
        return;
      }

      // Handle indent action (increase list level or paragraph indent)
      if (action === 'indent') {
        const currentListState = state.selectionFormatting.listState;
        const isInList = currentListState?.isInList;

        if (isInList && currentListState) {
          // For list items: increase the ilvl (max 8)
          const newLevel = Math.min((currentListState.level || 0) + 1, 8);
          const newNumPr = { numId: currentListState.numId || 1, ilvl: newLevel };

          const newDoc = executeCommand(history.state, {
            type: 'formatParagraph',
            paragraphIndex: range.start.paragraphIndex,
            formatting: { numPr: newNumPr },
          });

          handleDocumentChange(newDoc);

          // Update selection formatting state
          setState((prev) => ({
            ...prev,
            selectionFormatting: {
              ...prev.selectionFormatting,
              listState: {
                ...currentListState,
                level: newLevel,
              },
            },
          }));
        } else {
          // For regular paragraphs: increase left indent by 720 twips (0.5 inch)
          const currentIndent = selectionContext.paragraphFormatting?.indentLeft || 0;
          const newIndent = currentIndent + 720;

          const newDoc = executeCommand(history.state, {
            type: 'formatParagraph',
            paragraphIndex: range.start.paragraphIndex,
            formatting: { indentLeft: newIndent },
          });

          handleDocumentChange(newDoc);
        }
        return;
      }

      // Handle outdent action (decrease list level or paragraph indent)
      if (action === 'outdent') {
        const currentListState = state.selectionFormatting.listState;
        const isInList = currentListState?.isInList;

        if (isInList && currentListState) {
          // For list items: decrease the ilvl (min 0)
          const newLevel = Math.max((currentListState.level || 0) - 1, 0);
          const newNumPr = { numId: currentListState.numId || 1, ilvl: newLevel };

          const newDoc = executeCommand(history.state, {
            type: 'formatParagraph',
            paragraphIndex: range.start.paragraphIndex,
            formatting: { numPr: newNumPr },
          });

          handleDocumentChange(newDoc);

          // Update selection formatting state
          setState((prev) => ({
            ...prev,
            selectionFormatting: {
              ...prev.selectionFormatting,
              listState: {
                ...currentListState,
                level: newLevel,
              },
            },
          }));
        } else {
          // For regular paragraphs: decrease left indent by 720 twips (0.5 inch), minimum 0
          const currentIndent = selectionContext.paragraphFormatting?.indentLeft || 0;
          const newIndent = Math.max(currentIndent - 720, 0);

          const newDoc = executeCommand(history.state, {
            type: 'formatParagraph',
            paragraphIndex: range.start.paragraphIndex,
            formatting: { indentLeft: newIndent },
          });

          handleDocumentChange(newDoc);
        }
        return;
      }

      // Get the current formatting and apply the action
      const currentFormatting = selectionContext.formatting || {};
      const newFormatting = applyFormattingAction(currentFormatting, action);

      // Apply formatting to the selection using executeCommand
      const newDoc = executeCommand(history.state, {
        type: 'formatText',
        range,
        formatting: newFormatting,
      });

      handleDocumentChange(newDoc);

      // Update selection formatting state
      setState((prev) => ({
        ...prev,
        selectionFormatting: getSelectionFormatting(newFormatting, selectionContext.paragraphFormatting),
      }));
    },
    [history.state, handleDocumentChange, state.selectionFormatting.listState]
  );

  // Handle undo action
  const handleUndo = useCallback(() => {
    const previousState = history.undo();
    if (previousState) {
      onChange?.(previousState);
    }
  }, [history, onChange]);

  // Handle redo action
  const handleRedo = useCallback(() => {
    const nextState = history.redo();
    if (nextState) {
      onChange?.(nextState);
    }
  }, [history, onChange]);

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

  // Handle page change from editor
  const handlePageChange = useCallback((currentPage: number, totalPages: number) => {
    setState((prev) => ({ ...prev, currentPage, totalPages }));
  }, []);

  // Handle page navigation (from PageNavigator)
  const handlePageNavigate = useCallback((pageNumber: number) => {
    editorRef.current?.scrollToPage(pageNumber);
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
      getSelectionContext: () => editorRef.current?.getSelectionContext() || null,
      triggerAIAction: async (action: AIAction, customPrompt?: string) => {
        await editorRef.current?.triggerAIAction(action, customPrompt);
      },
      getCurrentPage: () => state.currentPage,
      getTotalPages: () => state.totalPages,
      scrollToPage: (pageNumber: number) => {
        editorRef.current?.scrollToPage(pageNumber);
      },
    }),
    [history.state, state.zoom, state.currentPage, state.totalPages, handleSave]
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
    overflow: 'auto',
    position: 'relative',
  };

  const variablePanelStyle: CSSProperties = {
    width: '300px',
    borderLeft: variablePanelPosition === 'right' ? '1px solid #e0e0e0' : undefined,
    borderRight: variablePanelPosition === 'left' ? '1px solid #e0e0e0' : undefined,
    overflow: 'auto',
    backgroundColor: '#fff',
  };

  const zoomControlStyle: CSSProperties = {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    zIndex: 100,
  };

  // Render loading state
  if (state.isLoading) {
    return (
      <div className={`docx-editor docx-editor-loading ${className}`} style={containerStyle}>
        {loadingIndicator || <DefaultLoadingIndicator />}
      </div>
    );
  }

  // Render error state
  if (state.parseError) {
    return (
      <div className={`docx-editor docx-editor-error ${className}`} style={containerStyle}>
        <ParseError message={state.parseError} />
      </div>
    );
  }

  // Render placeholder when no document
  if (!history.state) {
    return (
      <div className={`docx-editor docx-editor-empty ${className}`} style={containerStyle}>
        {placeholder || <DefaultPlaceholder />}
      </div>
    );
  }

  return (
    <ErrorProvider>
      <ErrorBoundary onError={handleEditorError}>
        <div className={`docx-editor ${className}`} style={containerStyle}>
          {/* Toolbar */}
          {showToolbar && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Toolbar
                currentFormatting={state.selectionFormatting}
                onFormat={handleFormat}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={history.canUndo}
                canRedo={history.canRedo}
                disabled={readOnly}
                documentStyles={history.state?.package.styles?.styles}
                theme={history.state?.package.theme || theme}
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
              <AIEditor
                ref={editorRef}
                document={history.state}
                onChange={handleDocumentChange}
                onAgentRequest={onAgentRequest}
                editable={!readOnly}
                zoom={state.zoom}
                showMarginGuides={showMarginGuides}
                marginGuideColor={marginGuideColor}
                onTableCellClick={tableSelection.handleCellClick}
                isTableCellSelected={tableSelection.isCellSelected}
                onPageChange={handlePageChange}
              />

              {/* Page navigation / indicator */}
              {showPageNumbers && state.totalPages > 0 && (
                enablePageNavigation ? (
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
                )
              )}

              {/* Zoom control */}
              {showZoomControl && (
                <div style={zoomControlStyle}>
                  <ZoomControl
                    value={state.zoom}
                    onChange={handleZoomChange}
                    minZoom={0.25}
                    maxZoom={3}
                  />
                </div>
              )}
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
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
