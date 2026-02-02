/**
 * ProseMirror Schema for DOCX Editor
 *
 * Combines node and mark specifications into a complete schema.
 * This schema supports:
 * - Paragraphs with full OOXML formatting (alignment, spacing, indentation, lists)
 * - Text with all formatting marks (bold, italic, underline, colors, fonts)
 * - Images and line breaks
 * - Hyperlinks
 */

import { Schema } from 'prosemirror-model';
import { nodes } from './nodes';
import { marks } from './marks';

export { nodes } from './nodes';
export { marks } from './marks';

export type {
  ParagraphAttrs,
  ImageAttrs,
  TableAttrs,
  TableRowAttrs,
  TableCellAttrs,
} from './nodes';
export type {
  TextColorAttrs,
  UnderlineAttrs,
  FontSizeAttrs,
  FontFamilyAttrs,
  HyperlinkAttrs,
} from './marks';

/**
 * The complete ProseMirror schema for the DOCX editor
 */
export const schema = new Schema({
  nodes,
  marks,
});

/**
 * Export types for convenience
 */
export type DocxSchema = typeof schema;
export type DocxNode = ReturnType<typeof schema.node>;
export type DocxMark = ReturnType<typeof schema.mark>;
