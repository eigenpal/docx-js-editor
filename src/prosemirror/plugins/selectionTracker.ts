/**
 * Selection Tracker Plugin
 *
 * Tracks selection changes and emits events for toolbar state updates.
 * Provides the current selection context including:
 * - Text formatting at cursor/selection
 * - Paragraph formatting
 * - Selection range information
 */

import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { TextFormatting, ParagraphFormatting } from '../../types/document';

/**
 * Selection context for toolbar state
 */
export interface SelectionContext {
  /** Whether there's a non-collapsed selection */
  hasSelection: boolean;
  /** Whether selection spans multiple paragraphs */
  isMultiParagraph: boolean;
  /** Current text formatting at cursor/selection */
  textFormatting: TextFormatting;
  /** Current paragraph formatting */
  paragraphFormatting: ParagraphFormatting;
  /** Start paragraph index */
  startParagraphIndex: number;
  /** End paragraph index */
  endParagraphIndex: number;
  /** Whether cursor is in a list */
  inList: boolean;
  /** List type if in list */
  listType?: 'bullet' | 'numbered';
  /** List level (0-8) */
  listLevel?: number;
}

/**
 * Plugin key for accessing selection tracker state
 */
export const selectionTrackerKey = new PluginKey<SelectionContext>('selectionTracker');

/**
 * Callback type for selection changes
 */
export type SelectionChangeCallback = (context: SelectionContext) => void;

/**
 * Extract selection context from editor state
 */
export function extractSelectionContext(state: EditorState): SelectionContext {
  const { selection, doc } = state;
  const { from, to, empty } = selection;
  const $from = doc.resolve(from);

  // Find paragraph indices
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

  // Extract text formatting from marks
  const textFormatting = extractTextFormatting(state);

  // Extract paragraph formatting
  const paragraph = $from.parent;
  const paragraphFormatting: ParagraphFormatting = {};

  if (paragraph.type.name === 'paragraph') {
    if (paragraph.attrs.alignment) {
      paragraphFormatting.alignment = paragraph.attrs.alignment;
    }
    if (paragraph.attrs.lineSpacing) {
      paragraphFormatting.lineSpacing = paragraph.attrs.lineSpacing;
      paragraphFormatting.lineSpacingRule = paragraph.attrs.lineSpacingRule;
    }
    if (paragraph.attrs.indentLeft) {
      paragraphFormatting.indentLeft = paragraph.attrs.indentLeft;
    }
    if (paragraph.attrs.numPr) {
      paragraphFormatting.numPr = paragraph.attrs.numPr;
    }
  }

  // List detection
  const numPr = paragraph.attrs?.numPr;
  const inList = !!numPr?.numId;
  const listType = numPr?.numId === 1 ? 'bullet' : numPr?.numId ? 'numbered' : undefined;
  const listLevel = numPr?.ilvl;

  return {
    hasSelection: !empty,
    isMultiParagraph: startParagraphIndex !== endParagraphIndex,
    textFormatting,
    paragraphFormatting,
    startParagraphIndex,
    endParagraphIndex,
    inList,
    listType,
    listLevel,
  };
}

/**
 * Extract text formatting from current selection/cursor marks
 */
function extractTextFormatting(state: EditorState): TextFormatting {
  const { selection } = state;
  const { empty, $from } = selection;

  // Get marks: stored marks take precedence, then marks at cursor
  const marks = state.storedMarks || (empty ? $from.marks() : []);
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
        formatting.underline = {
          style: mark.attrs.style || 'single',
          color: mark.attrs.color,
        };
        break;
      case 'strike':
        if (mark.attrs.double) {
          formatting.doubleStrike = true;
        } else {
          formatting.strike = true;
        }
        break;
      case 'textColor':
        formatting.color = {
          rgb: mark.attrs.rgb,
          themeColor: mark.attrs.themeColor,
          themeTint: mark.attrs.themeTint,
          themeShade: mark.attrs.themeShade,
        };
        break;
      case 'highlight':
        formatting.highlight = mark.attrs.color;
        break;
      case 'fontSize':
        formatting.fontSize = mark.attrs.size;
        break;
      case 'fontFamily':
        formatting.fontFamily = {
          ascii: mark.attrs.ascii,
          hAnsi: mark.attrs.hAnsi,
          asciiTheme: mark.attrs.asciiTheme,
        };
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
}

/**
 * Create selection tracker plugin
 */
export function createSelectionTrackerPlugin(onSelectionChange?: SelectionChangeCallback): Plugin {
  return new Plugin({
    key: selectionTrackerKey,

    state: {
      init(_, state) {
        return extractSelectionContext(state);
      },

      apply(tr, prevContext, _, newState) {
        // Only recalculate if selection or doc changed
        if (!tr.selectionSet && !tr.docChanged) {
          return prevContext;
        }

        const newContext = extractSelectionContext(newState);

        // Notify callback if context changed
        if (onSelectionChange && !contextsEqual(prevContext, newContext)) {
          // Defer to next tick to avoid dispatch during dispatch
          setTimeout(() => onSelectionChange(newContext), 0);
        }

        return newContext;
      },
    },

    view() {
      return {
        update(view: EditorView, prevState: EditorState) {
          // Only emit on selection/doc changes
          if (view.state.selection.eq(prevState.selection) && view.state.doc.eq(prevState.doc)) {
            return;
          }

          const context = extractSelectionContext(view.state);
          if (onSelectionChange) {
            onSelectionChange(context);
          }
        },
      };
    },
  });
}

/**
 * Compare two selection contexts for equality
 */
function contextsEqual(a: SelectionContext, b: SelectionContext): boolean {
  return (
    a.hasSelection === b.hasSelection &&
    a.isMultiParagraph === b.isMultiParagraph &&
    a.startParagraphIndex === b.startParagraphIndex &&
    a.endParagraphIndex === b.endParagraphIndex &&
    a.inList === b.inList &&
    a.listType === b.listType &&
    a.listLevel === b.listLevel &&
    JSON.stringify(a.textFormatting) === JSON.stringify(b.textFormatting) &&
    JSON.stringify(a.paragraphFormatting) === JSON.stringify(b.paragraphFormatting)
  );
}

/**
 * Get current selection context from editor state
 */
export function getSelectionContext(state: EditorState): SelectionContext | null {
  return selectionTrackerKey.getState(state) || null;
}
