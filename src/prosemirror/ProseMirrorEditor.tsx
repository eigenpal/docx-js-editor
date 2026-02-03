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
import { columnResizing, tableEditing } from 'prosemirror-tables';

import { schema } from './schema';
import { toProseDoc, createEmptyDoc } from './conversion';
import { fromProseDoc } from './conversion/fromProseDoc';
import { createListKeymap } from './plugins/keymap';
import { textFormattingToMarks } from './commands/formatting';
import type {
  Document,
  Theme,
  TextFormatting,
  ParagraphFormatting,
  SectionProperties,
} from '../types/document';
import type { SelectionContext } from '../types/agentApi';
import { twipsToPixels } from '../utils/units';

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
  /** Current paragraph style ID (e.g., 'Heading1', 'Normal') */
  styleId: string | null;
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
  /** Section properties for page layout (margins, size) */
  sectionProperties?: SectionProperties | null;
  /** Zoom level (1.0 = 100%) */
  zoom?: number;
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
  /** External ProseMirror plugins to add (from PluginHost or other sources) */
  externalPlugins?: import('prosemirror-state').Plugin[];
  /** Callback when the EditorView is ready */
  onEditorViewReady?: (view: EditorView) => void;
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
function createEditorState(
  document: Document | null,
  _readOnly: boolean,
  externalPlugins: import('prosemirror-state').Plugin[] = []
): EditorState {
  // Pass styles to toProseDoc for style resolution
  const doc = document
    ? toProseDoc(document, { styles: document.package.styles })
    : createEmptyDoc();

  const plugins = [
    history(),
    // Table plugins - column resizing and table editing features
    columnResizing({
      handleWidth: 5, // Width of the resize handle in pixels
      cellMinWidth: 25, // Minimum cell width in pixels
      lastColumnResizable: true, // Allow resizing the last column
    }),
    tableEditing(), // Provides table-related key bindings and selection handling
    createListKeymap(), // Tab handling for lists, tables, and regular text
    keymap({
      'Mod-z': undo,
      'Mod-y': redo,
      'Mod-Shift-z': redo,
      'Mod-b': toggleMark(schema.marks.bold),
      'Mod-i': toggleMark(schema.marks.italic),
      'Mod-u': toggleMark(schema.marks.underline),
    }),
    keymap(baseKeymap),
    // Add external plugins (from PluginHost or other sources)
    ...externalPlugins,
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
  let textFormatting: TextFormatting = {};

  // Check paragraph for default text formatting (for empty paragraphs)
  const paragraph = $from.parent;
  const isEmptyParagraph =
    paragraph.type.name === 'paragraph' && paragraph.textContent.length === 0;
  const paragraphDefaultFormatting = paragraph.attrs?.defaultTextFormatting as
    | TextFormatting
    | undefined;

  // For empty selection (cursor), use stored marks or marks at cursor position
  // For non-empty selection, check marks at the start of selection
  const marks = state.storedMarks || selection.$from.marks();

  // If in empty paragraph with no marks but has defaultTextFormatting, use that
  if (isEmptyParagraph && marks.length === 0 && paragraphDefaultFormatting) {
    textFormatting = { ...paragraphDefaultFormatting };
  }

  // Override with actual marks if present
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

  // Get paragraph formatting and styleId from current paragraph
  const paragraphFormatting: ParagraphFormatting = {};
  let styleId: string | null = null;
  // Note: paragraph is already defined above
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
    if (paragraph.attrs.styleId) {
      styleId = paragraph.attrs.styleId;
    }
  }

  return {
    hasSelection: !empty,
    isMultiParagraph: startParagraphIndex !== endParagraphIndex,
    textFormatting,
    paragraphFormatting,
    styleId,
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
// Default page dimensions in twips (Letter size: 8.5" x 11")
const DEFAULT_PAGE_WIDTH = 12240; // 8.5 inches
const DEFAULT_PAGE_HEIGHT = 15840; // 11 inches
const DEFAULT_MARGIN = 1440; // 1 inch

export const ProseMirrorEditor = memo(
  forwardRef<ProseMirrorEditorRef, ProseMirrorEditorProps>(function ProseMirrorEditor(
    {
      document,
      theme: _theme,
      sectionProperties,
      zoom = 1,
      onChange,
      onSelectionChange,
      readOnly = false,
      placeholder,
      className = '',
      autoFocus = false,
      externalPlugins = [],
      onEditorViewReady,
    },
    ref
  ) {
    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const documentRef = useRef<Document | null>(document);

    // Track document version to prevent circular updates
    const lastDocVersionRef = useRef<number>(0);

    // Calculate page dimensions from section properties
    const pageWidth = twipsToPixels(sectionProperties?.pageWidth ?? DEFAULT_PAGE_WIDTH) * zoom;
    const pageHeight = twipsToPixels(sectionProperties?.pageHeight ?? DEFAULT_PAGE_HEIGHT) * zoom;
    const marginTop = twipsToPixels(sectionProperties?.marginTop ?? DEFAULT_MARGIN) * zoom;
    const marginBottom = twipsToPixels(sectionProperties?.marginBottom ?? DEFAULT_MARGIN) * zoom;
    const marginLeft = twipsToPixels(sectionProperties?.marginLeft ?? DEFAULT_MARGIN) * zoom;
    const marginRight = twipsToPixels(sectionProperties?.marginRight ?? DEFAULT_MARGIN) * zoom;

    // Helper to convert marks to TextFormatting for saving
    const marksToFormatting = useCallback(
      (marks: readonly import('prosemirror-model').Mark[]): TextFormatting => {
        const formatting: TextFormatting = {};
        for (const mark of marks) {
          switch (mark.type.name) {
            case 'bold':
              formatting.bold = true;
              break;
            case 'italic':
              formatting.italic = true;
              break;
            case 'underline':
              formatting.underline = { style: mark.attrs.style || 'single' };
              break;
            case 'strike':
              formatting.strike = true;
              break;
            case 'textColor':
              formatting.color = mark.attrs;
              break;
            case 'highlight':
              formatting.highlight = mark.attrs.color;
              break;
            case 'fontSize':
              formatting.fontSize = mark.attrs.size;
              break;
            case 'fontFamily':
              formatting.fontFamily = { ascii: mark.attrs.ascii, hAnsi: mark.attrs.hAnsi };
              break;
            case 'superscript':
              formatting.vertAlign = 'superscript';
              break;
            case 'subscript':
              formatting.vertAlign = 'subscript';
              break;
          }
        }
        return formatting;
      },
      []
    );

    // Create dispatch transaction handler
    const dispatchTransaction = useCallback(
      (tr: Transaction) => {
        const view = viewRef.current;
        if (!view) return;

        const oldState = view.state;

        // Apply transaction to get new state
        let newState = view.state.apply(tr);

        // Check if stored marks changed (for toolbar updates when setting formatting without selection)
        const storedMarksChanged = oldState.storedMarks !== newState.storedMarks;

        // When cursor is in an empty paragraph with saved formatting, restore stored marks
        // This handles both: 1) navigating to empty paragraph, 2) deleting all text
        const shouldRestoreMarks = tr.selectionSet || tr.docChanged;
        if (shouldRestoreMarks) {
          const { $from } = newState.selection;
          const paragraph = $from.parent;

          if (
            paragraph.type.name === 'paragraph' &&
            paragraph.textContent.length === 0 &&
            paragraph.attrs?.defaultTextFormatting
          ) {
            // Only restore if there are no current stored marks
            const currentMarks = newState.storedMarks || $from.marks();
            if (currentMarks.length === 0) {
              const restoredMarks = textFormattingToMarks(
                paragraph.attrs.defaultTextFormatting as TextFormatting
              );
              if (restoredMarks.length > 0) {
                // Create a new transaction to set stored marks
                const marksTr = newState.tr.setStoredMarks(restoredMarks);
                newState = newState.apply(marksTr);
              }
            }
          }
        }

        // When stored marks change on an empty paragraph, save to paragraph attrs
        if (storedMarksChanged && !tr.docChanged) {
          const { $from } = newState.selection;
          const paragraph = $from.parent;

          if (paragraph.type.name === 'paragraph' && paragraph.textContent.length === 0) {
            const marks = newState.storedMarks || [];
            const defaultTextFormatting = marks.length > 0 ? marksToFormatting(marks) : null;

            // Only save if formatting actually changed
            const currentFormatting = paragraph.attrs?.defaultTextFormatting;
            const formattingChanged =
              JSON.stringify(defaultTextFormatting) !== JSON.stringify(currentFormatting);

            if (formattingChanged) {
              // Preserve stored marks when saving to paragraph attrs
              const saveTr = newState.tr
                .setNodeMarkup($from.before(), undefined, {
                  ...paragraph.attrs,
                  defaultTextFormatting,
                })
                .setStoredMarks(marks.length > 0 ? marks : null);
              newState = newState.apply(saveTr);
            }
          }
        }

        view.updateState(newState);

        // Notify selection changes (including stored marks changes for immediate toolbar feedback)
        if (tr.selectionSet || tr.docChanged || storedMarksChanged) {
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
      [onChange, onSelectionChange, marksToFormatting]
    );

    // Initialize/cleanup EditorView
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      // Create initial state with external plugins
      const state = createEditorState(document, readOnly, externalPlugins);

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

      // Notify that editor view is ready (for plugin system)
      onEditorViewReady?.(view);

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
      const newDoc = toProseDoc(document, { styles: document.package.styles });

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

    // CSS custom properties for page layout
    const cssVariables = {
      '--page-width': `${pageWidth}px`,
      '--page-height': `${pageHeight}px`,
      '--margin-top': `${marginTop}px`,
      '--margin-bottom': `${marginBottom}px`,
      '--margin-left': `${marginLeft}px`,
      '--margin-right': `${marginRight}px`,
      '--zoom': zoom,
    } as React.CSSProperties;

    return (
      <div
        ref={containerRef}
        className={`prosemirror-editor ${className}`}
        data-placeholder={placeholder}
        style={{
          minHeight: '200px',
          outline: 'none',
          ...cssVariables,
        }}
      />
    );
  })
);

export default ProseMirrorEditor;
