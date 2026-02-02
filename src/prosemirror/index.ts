/**
 * ProseMirror Integration for DOCX Editor
 *
 * This module provides ProseMirror-based editing:
 * - Schema for DOCX document structure
 * - Bidirectional conversion between Document and PM
 * - React wrapper component
 * - Plugins for keymap and selection tracking
 * - Commands for formatting
 */

// Schema
export { schema, nodes, marks } from './schema';
export type {
  ParagraphAttrs,
  ImageAttrs,
  TextColorAttrs,
  UnderlineAttrs,
  FontSizeAttrs,
  FontFamilyAttrs,
  HyperlinkAttrs,
} from './schema';

// Conversion
export { toProseDoc, createEmptyDoc, fromProseDoc, updateDocumentContent } from './conversion';

// Editor component
export { ProseMirrorEditor } from './ProseMirrorEditor';
export type {
  ProseMirrorEditorProps,
  ProseMirrorEditorRef,
  SelectionState,
} from './ProseMirrorEditor';

// Plugins
export {
  createKeymap,
  createBaseKeymap,
  createListKeymap,
  createEditorKeymaps,
  createSelectionTrackerPlugin,
  extractSelectionContext,
  getSelectionContext,
  selectionTrackerKey,
} from './plugins';
export type { SelectionContext, SelectionChangeCallback } from './plugins';

// Commands
export {
  // Text formatting
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrike,
  toggleSuperscript,
  toggleSubscript,
  setTextColor,
  clearTextColor,
  setHighlight,
  clearHighlight,
  setFontSize,
  clearFontSize,
  setFontFamily,
  clearFontFamily,
  clearFormatting,
  isMarkActive,
  getMarkAttr,
  // Paragraph formatting
  setAlignment,
  alignLeft,
  alignCenter,
  alignRight,
  alignJustify,
  setLineSpacing,
  increaseIndent,
  decreaseIndent,
  toggleBulletList,
  toggleNumberedList,
  increaseListLevel,
  decreaseListLevel,
  removeList,
  getParagraphAlignment,
  isInList,
  getListInfo,
  applyStyle,
  clearStyle,
  getStyleId,
} from './commands';
