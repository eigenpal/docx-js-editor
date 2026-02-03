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
  Style,
} from '../types/document';

// ============================================================================
// DEFAULT STYLES
// ============================================================================

/**
 * Get default paragraph styles (matching Google Docs defaults)
 *
 * Font sizes are in half-points (e.g., 22 = 11pt, 40 = 20pt)
 * Colors are RGB hex without # prefix
 */
function getDefaultStyles(): Style[] {
  return [
    // Normal - base style for body text (11pt Arial)
    {
      styleId: 'Normal',
      type: 'paragraph',
      name: 'Normal',
      default: true,
      qFormat: true,
      uiPriority: 0,
      rPr: {
        fontSize: 22, // 11pt
        fontFamily: {
          ascii: 'Arial',
          hAnsi: 'Arial',
        },
      },
      pPr: {
        lineSpacing: 276, // 1.15 spacing
      },
    },
    // Title - document title (26pt, bold)
    {
      styleId: 'Title',
      type: 'paragraph',
      name: 'Title',
      basedOn: 'Normal',
      next: 'Normal',
      qFormat: true,
      uiPriority: 10,
      rPr: {
        fontSize: 52, // 26pt
        bold: true,
        fontFamily: {
          ascii: 'Arial',
          hAnsi: 'Arial',
        },
      },
      pPr: {
        lineSpacing: 240, // Single spacing
      },
    },
    // Subtitle (15pt, gray)
    {
      styleId: 'Subtitle',
      type: 'paragraph',
      name: 'Subtitle',
      basedOn: 'Normal',
      next: 'Normal',
      qFormat: true,
      uiPriority: 11,
      rPr: {
        fontSize: 30, // 15pt
        color: { rgb: '666666' }, // Gray
        fontFamily: {
          ascii: 'Arial',
          hAnsi: 'Arial',
        },
      },
      pPr: {
        lineSpacing: 240,
      },
    },
    // Heading 1 (20pt, bold)
    {
      styleId: 'Heading1',
      type: 'paragraph',
      name: 'Heading 1',
      basedOn: 'Normal',
      next: 'Normal',
      qFormat: true,
      uiPriority: 9,
      rPr: {
        fontSize: 40, // 20pt
        bold: true,
        fontFamily: {
          ascii: 'Arial',
          hAnsi: 'Arial',
        },
      },
      pPr: {
        spaceBefore: 400, // 20pt before
        spaceAfter: 120, // 6pt after
        lineSpacing: 240,
      },
    },
    // Heading 2 (16pt, bold)
    {
      styleId: 'Heading2',
      type: 'paragraph',
      name: 'Heading 2',
      basedOn: 'Normal',
      next: 'Normal',
      qFormat: true,
      uiPriority: 9,
      rPr: {
        fontSize: 32, // 16pt
        bold: true,
        fontFamily: {
          ascii: 'Arial',
          hAnsi: 'Arial',
        },
      },
      pPr: {
        spaceBefore: 360, // 18pt before
        spaceAfter: 80, // 4pt after
        lineSpacing: 240,
      },
    },
    // Heading 3 (14pt, bold)
    {
      styleId: 'Heading3',
      type: 'paragraph',
      name: 'Heading 3',
      basedOn: 'Normal',
      next: 'Normal',
      qFormat: true,
      uiPriority: 9,
      rPr: {
        fontSize: 28, // 14pt
        bold: true,
        fontFamily: {
          ascii: 'Arial',
          hAnsi: 'Arial',
        },
      },
      pPr: {
        spaceBefore: 320, // 16pt before
        spaceAfter: 80, // 4pt after
        lineSpacing: 240,
      },
    },
    // Heading 4 (12pt, bold)
    {
      styleId: 'Heading4',
      type: 'paragraph',
      name: 'Heading 4',
      basedOn: 'Normal',
      next: 'Normal',
      qFormat: true,
      uiPriority: 9,
      rPr: {
        fontSize: 24, // 12pt
        bold: true,
        fontFamily: {
          ascii: 'Arial',
          hAnsi: 'Arial',
        },
      },
      pPr: {
        spaceBefore: 280, // 14pt before
        spaceAfter: 80, // 4pt after
        lineSpacing: 240,
      },
    },
  ];
}

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
      fontSize: 22, // 11pt (half-points) - Google Docs default
      fontFamily: {
        ascii: 'Arial',
        hAnsi: 'Arial',
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

  // Create package with default styles
  const docxPackage: DocxPackage = {
    document: documentBody,
    styles: {
      docDefaults: {
        rPr: {
          fontSize: 22, // 11pt (Google Docs default)
          fontFamily: {
            ascii: 'Arial',
            hAnsi: 'Arial',
          },
        },
        pPr: {
          lineSpacing: 276, // 1.15 line spacing
        },
      },
      styles: getDefaultStyles(),
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
