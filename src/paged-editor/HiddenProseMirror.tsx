/**
 * HiddenProseMirror Component
 *
 * Off-screen ProseMirror instance that owns all keyboard input and state
 * while the paginated layout engine handles visual output. Responsibilities:
 *
 * - Keyboard input handling
 * - Selection state management
 * - Accessibility (semantic document structure for screen readers)
 * - ProseMirror transaction processing
 *
 * Visibility approach: The editor is moved off-viewport with position:fixed
 * and rendered transparent so it can still receive focus and remain part of
 * the accessibility tree. Content width is kept in sync with the document
 * so that ProseMirror's internal measurements stay valid.
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
import { undo, redo } from 'prosemirror-history';

import { schema } from '../prosemirror/schema';
import { toProseDoc, createEmptyDoc } from '../prosemirror/conversion';
import { fromProseDoc } from '../prosemirror/conversion/fromProseDoc';
import type { ExtensionManager } from '../prosemirror/extensions/ExtensionManager';
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
  /** Extension manager for plugins/schema/commands (optional — falls back to default) */
  extensionManager?: ExtensionManager;
  /** Callback when EditorView is ready */
  onEditorViewReady?: (view: EditorView) => void;
  /** Callback when EditorView is destroyed */
  onEditorViewDestroy?: () => void;
  /** Intercept key events before ProseMirror processes them. Return true to prevent PM handling. */
  onKeyDown?: (view: EditorView, event: KeyboardEvent) => boolean;
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
 *
 * When an ExtensionManager is provided, it supplies the schema and plugins.
 * Otherwise falls back to the default singleton schema with no extension plugins.
 */
function createInitialState(
  document: Document | null,
  styles: StyleDefinitions | null | undefined,
  manager?: ExtensionManager,
  externalPlugins: Plugin[] = []
): EditorState {
  const activeSchema = manager?.getSchema() ?? schema;
  const doc = document ? toProseDoc(document, { styles: styles ?? undefined }) : createEmptyDoc();

  const plugins: Plugin[] = [...(manager?.getPlugins() ?? []), ...externalPlugins];

  return EditorState.create({
    doc,
    schema: activeSchema,
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
      extensionManager,
      onEditorViewReady,
      onEditorViewDestroy,
      onKeyDown,
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

    // Store callbacks in refs to avoid dependency array issues that cause infinite loops
    // when the parent component passes unstable callback references
    const onTransactionRef = useRef(onTransaction);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const onEditorViewReadyRef = useRef(onEditorViewReady);
    const onEditorViewDestroyRef = useRef(onEditorViewDestroy);
    const onKeyDownRef = useRef(onKeyDown);

    // Keep refs in sync
    onTransactionRef.current = onTransaction;
    onSelectionChangeRef.current = onSelectionChange;
    onEditorViewReadyRef.current = onEditorViewReady;
    onEditorViewDestroyRef.current = onEditorViewDestroy;
    onKeyDownRef.current = onKeyDown;

    // Keep document ref in sync
    documentRef.current = document;

    // ========================================================================
    // EditorView Lifecycle
    // ========================================================================

    /**
     * Create EditorView with proper dispatch handling
     * Uses refs for callbacks to avoid infinite re-render loops
     */
    const createView = useCallback(() => {
      if (!hostRef.current || isDestroyingRef.current) return;

      const initialState = createInitialState(document, styles, extensionManager, externalPlugins);

      const editorProps: DirectEditorProps = {
        state: initialState,
        editable: () => !readOnly,
        dispatchTransaction: (transaction: Transaction) => {
          if (!viewRef.current || isDestroyingRef.current) return;

          const newState = viewRef.current.state.apply(transaction);
          viewRef.current.updateState(newState);

          // Notify about transaction (use ref to avoid dependency issues)
          onTransactionRef.current?.(transaction, newState);

          // Notify about selection changes (use ref to avoid dependency issues)
          if (transaction.selectionSet || transaction.docChanged) {
            onSelectionChangeRef.current?.(newState);
          }
        },
        // Intercept key events before ProseMirror processes them
        handleKeyDown: (view: EditorView, event: KeyboardEvent): boolean => {
          return onKeyDownRef.current?.(view, event) ?? false;
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

      // Notify that view is ready (use ref to avoid dependency issues)
      onEditorViewReadyRef.current?.(viewRef.current);
    }, [
      document,
      styles,
      externalPlugins,
      extensionManager,
      readOnly,
      // Callbacks removed from dependencies - accessed via refs
    ]);

    /**
     * Destroy EditorView
     */
    const destroyView = useCallback(() => {
      if (viewRef.current && !isDestroyingRef.current) {
        isDestroyingRef.current = true;

        // Use ref to avoid dependency issues
        onEditorViewDestroyRef.current?.();

        viewRef.current.destroy();
        viewRef.current = null;
        isDestroyingRef.current = false;
      }
    }, []);

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
      const newState = createInitialState(document, styles, extensionManager, externalPlugins);
      viewRef.current.updateState(newState);

      // Use ref to avoid infinite loop when callback is unstable
      onSelectionChangeRef.current?.(newState);
    }, [document, styles, extensionManager, externalPlugins]);
    // NOTE: onSelectionChange removed from dependencies - accessed via ref to prevent infinite loops

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
