/**
 * Document Conversion Utilities
 *
 * Bidirectional conversion between Document (DOCX) and ProseMirror document.
 */

export { toProseDoc, createEmptyDoc } from './toProseDoc';
export type { ToProseDocOptions } from './toProseDoc';
export { fromProseDoc, updateDocumentContent } from './fromProseDoc';
