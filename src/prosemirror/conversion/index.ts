/**
 * Document Conversion Utilities
 *
 * Bidirectional conversion between Document (DOCX) and ProseMirror document.
 */

export { toProseDoc, createEmptyDoc, headerFooterToProseDoc } from './toProseDoc';
export type { ToProseDocOptions } from './toProseDoc';
export { fromProseDoc, updateDocumentContent, proseDocToBlocks } from './fromProseDoc';
