/**
 * ProseMirror Editor React Component
 *
 * A React wrapper around ProseMirror's EditorView that:
 * - Mounts/unmounts the EditorView lifecycle properly
 * - Syncs document changes with parent component
 * - Provides selection context for toolbar state
 * - Exposes commands via ref for external control
 */

import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, memo } from 'react';
import { EditorState, Transaction, type Command } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history, undo, redo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark } from 'prosemirror-commands';

import { schema } from './schema';
import { toProseDoc, createEmptyDoc } from './conversion';
import { fromProseDoc } from './conversion/fromProseDoc';
import type { Document, Theme, TextFormatting, ParagraphFormatting } from '../types/document';
import type { SelectionContext } from '../types/agentApi';

// Import ProseMirror CSS
import 'prosemirror-view/style/prosemirror.css';
import './editor.css';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Selection state for toolbar integration
 */
export interface SelectionState {
  /** Whether there's an active selection (not just cursor) */
  hasSelection: boolean;
  /** Whether selection spans multiple paragraphs */
  isMultiParagraph: boolean;
  /** Current text formatting at selection/cursor */
  textFormatting: TextFormatting;
  /** Current paragraph formatting */
  paragraphFormatting: ParagraphFormatting;
  /** Start paragraph index */
  startParagraphIndex: number;
  /** End paragraph index */
  endParagraphIndex: number;
}

/**
 * Props for ProseMirrorEditor
 */
export interface ProseMirrorEditorProps {
  /** The document to edit */
  document: Document | null;
  /** Theme for styling */
  theme?: Theme | null;
  /** Callback when document changes */
  onChange?: (document: Document) => void;
  /** Callback when selection changes */
  onSelectionChange?: (state: SelectionState | null) => void;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Additional CSS class */
  className?: string;
  /** Whether to auto-focus on mount */
  autoFocus?: boolean;
}

/**
 * Ref interface for external control
 */
export interface ProseMirrorEditorRef {
  /** Focus the editor */
  focus: () => void;
  /** Blur the editor */
  blur: () => void;
  /** Get the current ProseMirror state */
  getState: () => EditorState | null;
  /** Get the current ProseMirror view */
  getView: () => EditorView | null;
  /** Undo the last change */
  undo: () => boolean;
  /** Redo the last undone change */
  redo: () => boolean;
  /** Check if undo is available */
  canUndo: () => boolean;
  /** Check if redo is available */
  canRedo: () => boolean;
  /** Execute a ProseMirror command */
  executeCommand: (command: Command) => boolean;
  /** Toggle bold mark */
  toggleBold: () => boolean;
  /** Toggle italic mark */
  toggleItalic: () => boolean;
  /** Toggle underline mark */
  toggleUnderline: () => boolean;
  /** Get the current Document from PM state */
  getDocument: () => Document | null;
  /** Get selection context for AI features */
  getSelectionContext: () => SelectionContext | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create initial editor state from document
 */
function createEditorState(document: Document | null, _readOnly: boolean): EditorState {
  const doc = document ? toProseDoc(document) : createEmptyDoc();

  const plugins = [
    history(),
    keymap({
      'Mod-z': undo,
      'Mod-y': redo,
      'Mod-Shift-z': redo,
      'Mod-b': toggleMark(schema.marks.bold),
      'Mod-i': toggleMark(schema.marks.italic),
      'Mod-u': toggleMark(schema.marks.underline),
    }),
    keymap(baseKeymap),
  ];

  return EditorState.create({
    doc,
    schema,
    plugins,
  });
}

/**
 * Extract selection state from editor state
 */
function extractSelectionState(state: EditorState): SelectionState | null {
  const { selection, doc } = state;
  const { from, to, empty } = selection;

  // Find containing paragraphs
  const $from = doc.resolve(from);

  // Get paragraph indices
  let startParagraphIndex = 0;
  let endParagraphIndex = 0;

  doc.forEach((_node, offset, index) => {
    if (offset <= from) {
      startParagraphIndex = index;
    }
    if (offset <= to) {
      endParagraphIndex = index;
    }
  });

  // Get current text formatting from marks at selection
  const textFormatting: TextFormatting = {};
  // For empty selection (cursor), use stored marks or marks at cursor position
  // For non-empty selection, check marks at the start of selection
  const marks = state.storedMarks || selection.$from.marks();

  for (const mark of marks) {
    switch (mark.type.name) {
      case 'bold':
        textFormatting.bold = true;
        break;
      case 'italic':
        textFormatting.italic = true;
        break;
      case 'underline':
        textFormatting.underline = {
          style: mark.attrs.style || 'single',
          color: mark.attrs.color,
        };
        break;
      case 'strike':
        if (mark.attrs.double) {
          textFormatting.doubleStrike = true;
        } else {
          textFormatting.strike = true;
        }
        break;
      case 'textColor':
        textFormatting.color = {
          rgb: mark.attrs.rgb,
          themeColor: mark.attrs.themeColor,
        };
        break;
      case 'highlight':
        textFormatting.highlight = mark.attrs.color;
        break;
      case 'fontSize':
        textFormatting.fontSize = mark.attrs.size;
        break;
      case 'fontFamily':
        textFormatting.fontFamily = {
          ascii: mark.attrs.ascii,
          hAnsi: mark.attrs.hAnsi,
        };
        break;
      case 'superscript':
        textFormatting.vertAlign = 'superscript';
        break;
      case 'subscript':
        textFormatting.vertAlign = 'subscript';
        break;
    }
  }

  // Get paragraph formatting from current paragraph
  const paragraphFormatting: ParagraphFormatting = {};
  const paragraph = $from.parent;
  if (paragraph.type.name === 'paragraph') {
    if (paragraph.attrs.alignment) {
      paragraphFormatting.alignment = paragraph.attrs.alignment;
    }
    if (paragraph.attrs.lineSpacing) {
      paragraphFormatting.lineSpacing = paragraph.attrs.lineSpacing;
      paragraphFormatting.lineSpacingRule = paragraph.attrs.lineSpacingRule;
    }
    if (paragraph.attrs.numPr) {
      paragraphFormatting.numPr = paragraph.attrs.numPr;
    }
    if (paragraph.attrs.indentLeft) {
      paragraphFormatting.indentLeft = paragraph.attrs.indentLeft;
    }
  }

  return {
    hasSelection: !empty,
    isMultiParagraph: startParagraphIndex !== endParagraphIndex,
    textFormatting,
    paragraphFormatting,
    startParagraphIndex,
    endParagraphIndex,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ProseMirror Editor Component
 */
export const ProseMirrorEditor = memo(
  forwardRef<ProseMirrorEditorRef, ProseMirrorEditorProps>(function ProseMirrorEditor(
    {
      document,
      theme: _theme,
      onChange,
      onSelectionChange,
      readOnly = false,
      placeholder,
      className = '',
      autoFocus = false,
    },
    ref
  ) {
    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const documentRef = useRef<Document | null>(document);

    // Track document version to prevent circular updates
    const lastDocVersionRef = useRef<number>(0);

    // Create dispatch transaction handler
    const dispatchTransaction = useCallback(
      (tr: Transaction) => {
        const view = viewRef.current;
        if (!view) return;

        // Apply transaction to get new state
        const newState = view.state.apply(tr);
        view.updateState(newState);

        // Notify selection changes
        if (tr.selectionSet || tr.docChanged) {
          const selectionState = extractSelectionState(newState);
          onSelectionChange?.(selectionState);
        }

        // Notify document changes
        if (tr.docChanged && documentRef.current) {
          lastDocVersionRef.current++;
          const newDocument = fromProseDoc(newState.doc, documentRef.current);
          documentRef.current = newDocument;
          onChange?.(newDocument);
        }
      },
      [onChange, onSelectionChange]
    );

    // Initialize/cleanup EditorView
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      // Create initial state
      const state = createEditorState(document, readOnly);

      // Create view
      const view = new EditorView(container, {
        state,
        editable: () => !readOnly,
        dispatchTransaction,
        attributes: {
          class: 'prosemirror-editor-content',
        },
      });

      viewRef.current = view;
      documentRef.current = document;

      // Initial selection state
      const selectionState = extractSelectionState(state);
      onSelectionChange?.(selectionState);

      // Auto-focus if requested
      if (autoFocus) {
        view.focus();
      }

      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, []); // Only run on mount

    // Update document when it changes externally
    useEffect(() => {
      const view = viewRef.current;
      if (!view || !document) return;

      // Avoid circular updates
      if (documentRef.current === document) return;

      documentRef.current = document;
      const newDoc = toProseDoc(document);

      // Only update if doc is actually different
      if (!view.state.doc.eq(newDoc)) {
        const newState = EditorState.create({
          doc: newDoc,
          schema,
          plugins: view.state.plugins,
        });
        view.updateState(newState);
      }
    }, [document]);

    // Update readOnly state
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;

      // ProseMirror handles editable state via the editable prop in view update
      view.setProps({
        editable: () => !readOnly,
      });
    }, [readOnly]);

    // Expose ref methods
    useImperativeHandle(
      ref,
      () => ({
        focus: () => viewRef.current?.focus(),
        blur: () => viewRef.current?.dom.blur(),
        getState: () => viewRef.current?.state ?? null,
        getView: () => viewRef.current,

        undo: () => {
          const view = viewRef.current;
          if (!view) return false;
          return undo(view.state, view.dispatch);
        },

        redo: () => {
          const view = viewRef.current;
          if (!view) return false;
          return redo(view.state, view.dispatch);
        },

        canUndo: () => {
          const view = viewRef.current;
          if (!view) return false;
          return undo(view.state);
        },

        canRedo: () => {
          const view = viewRef.current;
          if (!view) return false;
          return redo(view.state);
        },

        executeCommand: (command: Command) => {
          const view = viewRef.current;
          if (!view) return false;
          return command(view.state, view.dispatch, view);
        },

        toggleBold: () => {
          const view = viewRef.current;
          if (!view) return false;
          return toggleMark(schema.marks.bold)(view.state, view.dispatch);
        },

        toggleItalic: () => {
          const view = viewRef.current;
          if (!view) return false;
          return toggleMark(schema.marks.italic)(view.state, view.dispatch);
        },

        toggleUnderline: () => {
          const view = viewRef.current;
          if (!view) return false;
          return toggleMark(schema.marks.underline)(view.state, view.dispatch);
        },

        getDocument: () => {
          const view = viewRef.current;
          if (!view || !documentRef.current) return null;
          return fromProseDoc(view.state.doc, documentRef.current);
        },

        getSelectionContext: () => {
          const view = viewRef.current;
          if (!view) return null;

          const selectionState = extractSelectionState(view.state);
          if (!selectionState) return null;

          // Build SelectionContext for AI features
          const { from, to, $from } = view.state.selection;
          const selectedText = view.state.doc.textBetween(from, to, '\n');

          // Get text before and after selection
          const paragraphStart = $from.start($from.depth);
          const paragraphEnd = $from.end($from.depth);
          const textBefore = view.state.doc.textBetween(paragraphStart, from, '');
          const textAfter = view.state.doc.textBetween(to, paragraphEnd, '');

          // Get full paragraph text
          const fullParagraphText = view.state.doc.textBetween(paragraphStart, paragraphEnd, '');

          // Count words
          const wordCount = fullParagraphText
            .trim()
            .split(/\s+/)
            .filter((w) => w.length > 0).length;

          return {
            range: {
              start: {
                paragraphIndex: selectionState.startParagraphIndex,
                offset: from - paragraphStart,
              },
              end: {
                paragraphIndex: selectionState.endParagraphIndex,
                offset: to - paragraphStart,
              },
              collapsed: !selectionState.hasSelection,
            },
            selectedText,
            formatting: selectionState.textFormatting,
            paragraphFormatting: selectionState.paragraphFormatting,
            textBefore,
            textAfter,
            paragraph: {
              index: selectionState.startParagraphIndex,
              fullText: fullParagraphText,
              wordCount,
            },
          };
        },
      }),
      []
    );

    return (
      <div
        ref={containerRef}
        className={`prosemirror-editor ${className}`}
        data-placeholder={placeholder}
        style={{
          minHeight: '200px',
          outline: 'none',
        }}
      />
    );
  })
);

export default ProseMirrorEditor;
