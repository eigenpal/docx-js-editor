/**
 * HiddenProseMirror Component
 *
 * A hidden ProseMirror editor that receives focus and keyboard input while being
 * visually off-screen. The actual visual rendering is handled by the layout engine
 * and DOM painter, while this hidden editor provides:
 *
 * - Keyboard input handling
 * - Selection state management
 * - Accessibility (semantic document structure for screen readers)
 * - ProseMirror transaction processing
 *
 * Key design decisions:
 * - Uses position:fixed + left:-9999px (not visibility:hidden which prevents focus)
 * - Uses opacity:0 + z-index:-1 to hide while keeping focusable
 * - Does NOT set aria-hidden (editor must remain accessible)
 * - Width matches document content width for proper text measurement
 */

import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, memo } from 'react';
import type { CSSProperties } from 'react';
import {
  EditorState,
  Transaction,
  TextSelection,
  type Command,
  type Plugin,
} from 'prosemirror-state';
import { EditorView, type DirectEditorProps } from 'prosemirror-view';
import { history, undo, redo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark } from 'prosemirror-commands';
import { columnResizing, tableEditing } from 'prosemirror-tables';

import { schema } from '../prosemirror/schema';
import { toProseDoc, createEmptyDoc } from '../prosemirror/conversion';
import { fromProseDoc } from '../prosemirror/conversion/fromProseDoc';
import { createListKeymap } from '../prosemirror/plugins/keymap';
import type { Document, Theme, StyleDefinitions } from '../types/document';

// Import ProseMirror CSS
import 'prosemirror-view/style/prosemirror.css';
import '../prosemirror/editor.css';

// ============================================================================
// TYPES
// ============================================================================

export interface HiddenProseMirrorProps {
  /** The document to edit */
  document: Document | null;
  /** Document styles for style resolution */
  styles?: StyleDefinitions | null;
  /** Theme for styling */
  theme?: Theme | null;
  /** Width in pixels (should match document content width) */
  widthPx?: number;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Callback when document changes via transaction */
  onTransaction?: (transaction: Transaction, newState: EditorState) => void;
  /** Callback when selection changes */
  onSelectionChange?: (state: EditorState) => void;
  /** External ProseMirror plugins */
  externalPlugins?: Plugin[];
  /** Callback when EditorView is ready */
  onEditorViewReady?: (view: EditorView) => void;
  /** Callback when EditorView is destroyed */
  onEditorViewDestroy?: () => void;
}

export interface HiddenProseMirrorRef {
  /** Get the ProseMirror EditorState */
  getState(): EditorState | null;
  /** Get the ProseMirror EditorView */
  getView(): EditorView | null;
  /** Get the current Document from PM state */
  getDocument(): Document | null;
  /** Focus the hidden editor */
  focus(): void;
  /** Blur the hidden editor */
  blur(): void;
  /** Check if focused */
  isFocused(): boolean;
  /** Dispatch a transaction */
  dispatch(tr: Transaction): void;
  /** Execute a ProseMirror command */
  executeCommand(command: Command): boolean;
  /** Undo */
  undo(): boolean;
  /** Redo */
  redo(): boolean;
  /** Check if undo is available */
  canUndo(): boolean;
  /** Check if redo is available */
  canRedo(): boolean;
  /** Set selection by PM position */
  setSelection(anchor: number, head?: number): void;
  /** Scroll the PM view to selection (no-op since hidden) */
  scrollToSelection(): void;
}

// ============================================================================
// STYLES
// ============================================================================

/**
 * Hidden host styles - visually hidden but focusable
 */
const HIDDEN_HOST_STYLES: CSSProperties = {
  // Position off-screen but in document flow for accessibility
  position: 'fixed',
  left: '-9999px',
  top: '0',
  // Hide visually but keep focusable (NOT visibility:hidden!)
  opacity: 0,
  zIndex: -1,
  // Prevent interaction with visual layer
  pointerEvents: 'none',
  // Prevent text selection in hidden area
  userSelect: 'none',
  // Prevent scroll anchoring issues
  overflowAnchor: 'none',
  // Don't set aria-hidden - editor must remain accessible to screen readers
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create ProseMirror state from document
 */
function createInitialState(
  document: Document | null,
  styles: StyleDefinitions | null | undefined,
  externalPlugins: Plugin[] = []
): EditorState {
  const doc = document ? toProseDoc(document, { styles: styles ?? undefined }) : createEmptyDoc();

  const plugins: Plugin[] = [
    history(),
    columnResizing({
      handleWidth: 5,
      cellMinWidth: 25,
      lastColumnResizable: true,
    }),
    tableEditing(),
    createListKeymap(),
    keymap({
      'Mod-z': undo,
      'Mod-y': redo,
      'Mod-Shift-z': redo,
      'Mod-b': toggleMark(schema.marks.bold),
      'Mod-i': toggleMark(schema.marks.italic),
      'Mod-u': toggleMark(schema.marks.underline),
    }),
    keymap(baseKeymap),
    ...externalPlugins,
  ];

  return EditorState.create({
    doc,
    schema,
    plugins,
  });
}

/**
 * Convert PM state to Document
 */
function stateToDocument(state: EditorState, originalDoc: Document | null): Document | null {
  if (!originalDoc) return null;

  // fromProseDoc preserves the base document structure when provided
  return fromProseDoc(state.doc, originalDoc);
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * HiddenProseMirror - Off-screen ProseMirror editor for keyboard input
 */
const HiddenProseMirrorComponent = forwardRef<HiddenProseMirrorRef, HiddenProseMirrorProps>(
  function HiddenProseMirror(props, ref) {
    const {
      document,
      styles,
      theme: _theme,
      widthPx = 612, // Default Letter width at 72dpi
      readOnly = false,
      onTransaction,
      onSelectionChange,
      externalPlugins = [],
      onEditorViewReady,
      onEditorViewDestroy,
    } = props;

    // Refs
    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const documentRef = useRef<Document | null>(document);
    const isDestroyingRef = useRef(false);
    // Track the document identity to detect truly external changes
    // vs changes that originated from editing (which get passed back through props)
    const lastDocumentIdRef = useRef<string | null>(null);
    // Track if we've initialized - first render needs to set up state
    const isInitializedRef = useRef(false);

    // Keep document ref in sync
    documentRef.current = document;

    // ========================================================================
    // EditorView Lifecycle
    // ========================================================================

    /**
     * Create EditorView with proper dispatch handling
     */
    const createView = useCallback(() => {
      if (!hostRef.current || isDestroyingRef.current) return;

      const initialState = createInitialState(document, styles, externalPlugins);

      const editorProps: DirectEditorProps = {
        state: initialState,
        editable: () => !readOnly,
        dispatchTransaction: (transaction: Transaction) => {
          if (!viewRef.current || isDestroyingRef.current) return;

          const newState = viewRef.current.state.apply(transaction);
          viewRef.current.updateState(newState);

          // Notify about transaction
          if (onTransaction) {
            onTransaction(transaction, newState);
          }

          // Notify about selection changes
          if (transaction.selectionSet || transaction.docChanged) {
            if (onSelectionChange) {
              onSelectionChange(newState);
            }
          }
        },
        // Prevent focus handling from interfering with visual layer
        handleDOMEvents: {
          focus: () => {
            // Let focus happen normally
            return false;
          },
          blur: () => {
            // Let blur happen normally
            return false;
          },
        },
      };

      viewRef.current = new EditorView(hostRef.current, editorProps);

      // Notify that view is ready
      if (onEditorViewReady) {
        onEditorViewReady(viewRef.current);
      }
    }, [
      document,
      styles,
      externalPlugins,
      readOnly,
      onTransaction,
      onSelectionChange,
      onEditorViewReady,
    ]);

    /**
     * Destroy EditorView
     */
    const destroyView = useCallback(() => {
      if (viewRef.current && !isDestroyingRef.current) {
        isDestroyingRef.current = true;

        if (onEditorViewDestroy) {
          onEditorViewDestroy();
        }

        viewRef.current.destroy();
        viewRef.current = null;
        isDestroyingRef.current = false;
      }
    }, [onEditorViewDestroy]);

    // Mount/unmount
    useEffect(() => {
      createView();
      return () => destroyView();
    }, []); // Only on mount/unmount

    // Update state when document changes externally (e.g., loading a new file)
    // This should NOT run when the document prop changes due to internal edits
    // being passed back through the parent component's state
    useEffect(() => {
      if (!viewRef.current || isDestroyingRef.current) return;

      // Generate a simple document identity based on its structure
      // This helps detect truly different documents vs the same doc passed back after editing
      const getDocumentId = (doc: Document | null): string => {
        if (!doc) return 'empty';
        // Use the document's package id or a hash of its structure
        // For simplicity, we compare based on whether it's a different document object
        // and whether it has different metadata
        const meta = doc.package?.properties;
        return `${meta?.created || ''}-${meta?.modified || ''}-${meta?.title || ''}`;
      };

      const currentDocId = getDocumentId(document);

      // Skip if this is the same document (likely passed back after internal edit)
      // Only reset state if:
      // 1. Not yet initialized (first mount)
      // 2. Document identity changed (truly external change like loading a new file)
      if (isInitializedRef.current && currentDocId === lastDocumentIdRef.current) {
        return;
      }

      // Update tracking refs
      isInitializedRef.current = true;
      lastDocumentIdRef.current = currentDocId;

      // Create new state from document
      const newState = createInitialState(document, styles, externalPlugins);
      viewRef.current.updateState(newState);

      if (onSelectionChange) {
        onSelectionChange(newState);
      }
    }, [document, styles, externalPlugins, onSelectionChange]);

    // Update editable state
    useEffect(() => {
      if (!viewRef.current) return;
      // EditorView will call editable() on each check, so we don't need to update
    }, [readOnly]);

    // ========================================================================
    // Imperative Handle
    // ========================================================================

    useImperativeHandle(
      ref,
      () => ({
        getState() {
          return viewRef.current?.state ?? null;
        },

        getView() {
          return viewRef.current ?? null;
        },

        getDocument() {
          if (!viewRef.current) return null;
          return stateToDocument(viewRef.current.state, documentRef.current);
        },

        focus() {
          viewRef.current?.focus();
        },

        blur() {
          if (viewRef.current?.hasFocus()) {
            (viewRef.current.dom as HTMLElement).blur();
          }
        },

        isFocused() {
          return viewRef.current?.hasFocus() ?? false;
        },

        dispatch(tr: Transaction) {
          if (viewRef.current && !isDestroyingRef.current) {
            viewRef.current.dispatch(tr);
          }
        },

        executeCommand(command: Command) {
          if (!viewRef.current) return false;
          return command(viewRef.current.state, viewRef.current.dispatch, viewRef.current);
        },

        undo() {
          if (!viewRef.current) return false;
          return undo(viewRef.current.state, viewRef.current.dispatch);
        },

        redo() {
          if (!viewRef.current) return false;
          return redo(viewRef.current.state, viewRef.current.dispatch);
        },

        canUndo() {
          if (!viewRef.current) return false;
          return undo(viewRef.current.state);
        },

        canRedo() {
          if (!viewRef.current) return false;
          return redo(viewRef.current.state);
        },

        setSelection(anchor: number, head?: number) {
          if (!viewRef.current) return;
          const { state, dispatch } = viewRef.current;
          const $anchor = state.doc.resolve(anchor);
          const $head = head !== undefined ? state.doc.resolve(head) : $anchor;
          const selection = TextSelection.between($anchor, $head);
          dispatch(state.tr.setSelection(selection));
        },

        scrollToSelection() {
          // No-op for hidden editor - visual scrolling handled by PagedEditor
        },
      }),
      []
    );

    // ========================================================================
    // Render
    // ========================================================================

    return (
      <div
        ref={hostRef}
        className="paged-editor__hidden-pm"
        style={{
          ...HIDDEN_HOST_STYLES,
          width: widthPx > 0 ? `${widthPx}px` : undefined,
        }}
        // DO NOT set aria-hidden - this editor provides semantic structure
      />
    );
  }
);

export const HiddenProseMirror = memo(HiddenProseMirrorComponent);

export default HiddenProseMirror;
