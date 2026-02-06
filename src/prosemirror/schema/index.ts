/**
 * ProseMirror Schema for DOCX Editor
 *
 * Singleton ExtensionManager that builds the schema and initializes runtime.
 * Legacy code imports `schema` and commands from here; new code should use
 * ExtensionManager directly.
 */

import { createStarterKit } from '../extensions/StarterKit';
import { ExtensionManager } from '../extensions/ExtensionManager';

// Re-export type interfaces (used by toProseDoc, fromProseDoc, and other modules)
export type {
  ParagraphAttrs,
  ImageAttrs,
  ImagePositionAttrs,
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
 * Singleton ExtensionManager — builds schema + initializes runtime (plugins, commands, keymaps)
 */
const mgr = new ExtensionManager(createStarterKit());
mgr.buildSchema();
mgr.initializeRuntime();

export const singletonManager = mgr;
export const schema = mgr.getSchema();

/**
 * Export types for convenience
 */
export type DocxSchema = typeof schema;
export type DocxNode = ReturnType<typeof schema.node>;
export type DocxMark = ReturnType<typeof schema.mark>;
