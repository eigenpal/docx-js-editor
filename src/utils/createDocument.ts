/**
 * Create Document Utility
 *
 * Provides functions to create new documents programmatically.
 */

import type {
  Document,
  DocxPackage,
  DocumentBody,
  Paragraph,
  Run,
  TextContent,
  SectionProperties,
} from '../types/document';

// ============================================================================
// DEFAULT SECTION PROPERTIES
// ============================================================================

/**
 * Get default section properties (US Letter, 1 inch margins)
 */
function getDefaultSectionProperties(): SectionProperties {
  return {
    pageWidth: 12240, // 8.5 inches in twips
    pageHeight: 15840, // 11 inches in twips
    orientation: 'portrait',
    marginTop: 1440, // 1 inch
    marginBottom: 1440,
    marginLeft: 1440,
    marginRight: 1440,
    headerDistance: 720, // 0.5 inch
    footerDistance: 720,
    gutter: 0,
    columnCount: 1,
    columnSpace: 720,
    equalWidth: true,
    sectionStart: 'nextPage',
    verticalAlign: 'top',
  };
}

// ============================================================================
// EMPTY DOCUMENT
// ============================================================================

/**
 * Options for creating an empty document
 */
export interface CreateEmptyDocumentOptions {
  /** Page width in twips (default: 12240 = 8.5 inches) */
  pageWidth?: number;
  /** Page height in twips (default: 15840 = 11 inches) */
  pageHeight?: number;
  /** Page orientation (default: 'portrait') */
  orientation?: 'portrait' | 'landscape';
  /** Top margin in twips (default: 1440 = 1 inch) */
  marginTop?: number;
  /** Bottom margin in twips (default: 1440 = 1 inch) */
  marginBottom?: number;
  /** Left margin in twips (default: 1440 = 1 inch) */
  marginLeft?: number;
  /** Right margin in twips (default: 1440 = 1 inch) */
  marginRight?: number;
  /** Initial text content (default: empty string) */
  initialText?: string;
}

/**
 * Create an empty document with a single paragraph
 *
 * @param options - Optional configuration for the document
 * @returns A new empty Document object
 *
 * @example
 * ```ts
 * // Create a blank document
 * const doc = createEmptyDocument();
 *
 * // Create with custom margins
 * const doc = createEmptyDocument({
 *   marginTop: 720,  // 0.5 inch
 *   marginBottom: 720,
 * });
 *
 * // Create with initial text
 * const doc = createEmptyDocument({
 *   initialText: 'Hello, World!'
 * });
 * ```
 */
export function createEmptyDocument(options: CreateEmptyDocumentOptions = {}): Document {
  const sectionProps = getDefaultSectionProperties();

  // Apply custom options
  if (options.pageWidth !== undefined) sectionProps.pageWidth = options.pageWidth;
  if (options.pageHeight !== undefined) sectionProps.pageHeight = options.pageHeight;
  if (options.orientation !== undefined) sectionProps.orientation = options.orientation;
  if (options.marginTop !== undefined) sectionProps.marginTop = options.marginTop;
  if (options.marginBottom !== undefined) sectionProps.marginBottom = options.marginBottom;
  if (options.marginLeft !== undefined) sectionProps.marginLeft = options.marginLeft;
  if (options.marginRight !== undefined) sectionProps.marginRight = options.marginRight;

  // Create initial paragraph content
  const textContent: TextContent = {
    type: 'text',
    text: options.initialText || '',
  };

  const run: Run = {
    type: 'run',
    content: options.initialText ? [textContent] : [],
    formatting: {
      fontSize: 24, // 12pt (half-points)
      fontFamily: {
        ascii: 'Calibri',
        hAnsi: 'Calibri',
      },
    },
  };

  const paragraph: Paragraph = {
    type: 'paragraph',
    content: [run],
    formatting: {
      lineSpacing: 276, // 1.15 line spacing (default Word)
    },
  };

  // Create document body
  const documentBody: DocumentBody = {
    content: [paragraph],
    finalSectionProperties: sectionProps,
  };

  // Create package
  const docxPackage: DocxPackage = {
    document: documentBody,
    styles: {
      docDefaults: {
        rPr: {
          fontSize: 24,
          fontFamily: {
            ascii: 'Calibri',
            hAnsi: 'Calibri',
          },
        },
        pPr: {
          lineSpacing: 276,
        },
      },
      styles: [],
    },
  };

  // Create document
  const document: Document = {
    package: docxPackage,
    templateVariables: [],
    warnings: [],
  };

  return document;
}

/**
 * Create a document with a single paragraph containing the given text
 *
 * @param text - The text content for the document
 * @param options - Optional configuration for the document
 * @returns A new Document object with the specified text
 */
export function createDocumentWithText(
  text: string,
  options: Omit<CreateEmptyDocumentOptions, 'initialText'> = {}
): Document {
  return createEmptyDocument({ ...options, initialText: text });
}
