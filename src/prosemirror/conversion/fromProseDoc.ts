/**
 * ProseMirror to Document Conversion
 *
 * Converts a ProseMirror document back to our Document type.
 * This enables round-trip editing: DOCX -> Document -> PM -> Document -> DOCX
 *
 * Key responsibilities:
 * - Coalesce consecutive text with same marks into single Runs
 * - Preserve paragraph attributes (paraId, textId, formatting)
 * - Handle marks -> TextFormatting conversion
 */

import type { Node as PMNode, Mark } from 'prosemirror-model';
import type {
  Document,
  DocumentBody,
  Paragraph,
  Run,
  TextFormatting,
  ParagraphFormatting,
  TextContent,
  BreakContent,
  DrawingContent,
  Image,
  Hyperlink,
  ParagraphContent,
} from '../../types/document';
import type { ParagraphAttrs, ImageAttrs } from '../schema/nodes';
import type { TextColorAttrs, UnderlineAttrs, FontFamilyAttrs } from '../schema/marks';

/**
 * Convert a ProseMirror document to our Document type
 */
export function fromProseDoc(pmDoc: PMNode, baseDocument?: Document): Document {
  const paragraphs = extractParagraphs(pmDoc);

  const documentBody: DocumentBody = {
    content: paragraphs,
  };

  // If we have a base document, preserve its package structure
  if (baseDocument) {
    return {
      ...baseDocument,
      package: {
        ...baseDocument.package,
        document: documentBody,
      },
    };
  }

  // Create a minimal document structure
  return {
    package: {
      document: documentBody,
    },
  };
}

/**
 * Extract paragraphs from ProseMirror document
 */
function extractParagraphs(pmDoc: PMNode): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  pmDoc.forEach((node) => {
    if (node.type.name === 'paragraph') {
      paragraphs.push(convertPMParagraph(node));
    }
  });

  return paragraphs;
}

/**
 * Convert a ProseMirror paragraph node to our Paragraph type
 */
function convertPMParagraph(node: PMNode): Paragraph {
  const attrs = node.attrs as ParagraphAttrs;
  const content = extractParagraphContent(node);

  return {
    type: 'paragraph',
    paraId: attrs.paraId || undefined,
    textId: attrs.textId || undefined,
    formatting: paragraphAttrsToFormatting(attrs),
    content,
  };
}

/**
 * Convert ProseMirror paragraph attrs to ParagraphFormatting
 */
function paragraphAttrsToFormatting(attrs: ParagraphAttrs): ParagraphFormatting | undefined {
  // Check if any formatting is present
  const hasFormatting =
    attrs.alignment ||
    attrs.spaceBefore ||
    attrs.spaceAfter ||
    attrs.lineSpacing ||
    attrs.indentLeft ||
    attrs.indentRight ||
    attrs.indentFirstLine ||
    attrs.numPr ||
    attrs.styleId;

  if (!hasFormatting) {
    return undefined;
  }

  return {
    alignment: attrs.alignment || undefined,
    spaceBefore: attrs.spaceBefore || undefined,
    spaceAfter: attrs.spaceAfter || undefined,
    lineSpacing: attrs.lineSpacing || undefined,
    lineSpacingRule: attrs.lineSpacingRule || undefined,
    indentLeft: attrs.indentLeft || undefined,
    indentRight: attrs.indentRight || undefined,
    indentFirstLine: attrs.indentFirstLine || undefined,
    hangingIndent: attrs.hangingIndent || undefined,
    numPr: attrs.numPr || undefined,
    styleId: attrs.styleId || undefined,
  };
}

/**
 * Extract paragraph content (runs, hyperlinks) from ProseMirror paragraph
 *
 * Coalesces consecutive text with the same marks into single Runs
 * for efficient DOCX representation.
 */
function extractParagraphContent(paragraph: PMNode): ParagraphContent[] {
  const content: ParagraphContent[] = [];

  // Track current run being built
  let currentRun: Run | null = null;
  let currentMarksKey: string | null = null;
  let currentHyperlink: Hyperlink | null = null;

  paragraph.forEach((node) => {
    // Check for hyperlink mark
    const linkMark = node.marks.find((m) => m.type.name === 'hyperlink');

    if (linkMark) {
      // Start or continue hyperlink
      const linkKey = getLinkKey(linkMark);

      if (currentHyperlink && currentHyperlink.href === linkKey) {
        // Continue current hyperlink
        addNodeToHyperlink(currentHyperlink, node);
      } else {
        // Finish previous content
        if (currentRun) {
          content.push(currentRun);
          currentRun = null;
          currentMarksKey = null;
        }
        if (currentHyperlink) {
          content.push(currentHyperlink);
        }

        // Start new hyperlink
        currentHyperlink = createHyperlink(linkMark);
        addNodeToHyperlink(currentHyperlink, node);
      }
      return;
    }

    // Not in hyperlink - finish any current hyperlink
    if (currentHyperlink) {
      content.push(currentHyperlink);
      currentHyperlink = null;
    }

    // Handle node types
    if (node.isText) {
      const marksKey = getMarksKey(node.marks);

      if (currentRun && currentMarksKey === marksKey) {
        // Append to current run
        appendTextToRun(currentRun, node.text || '');
      } else {
        // Start new run
        if (currentRun) {
          content.push(currentRun);
        }
        currentRun = createRunFromText(node.text || '', node.marks);
        currentMarksKey = marksKey;
      }
    } else if (node.type.name === 'hardBreak') {
      // Hard break ends current run
      if (currentRun) {
        content.push(currentRun);
        currentRun = null;
        currentMarksKey = null;
      }
      content.push(createBreakRun());
    } else if (node.type.name === 'image') {
      // Image ends current run
      if (currentRun) {
        content.push(currentRun);
        currentRun = null;
        currentMarksKey = null;
      }
      content.push(createImageRun(node));
    }
  });

  // Don't forget the last run/hyperlink
  if (currentRun) {
    content.push(currentRun);
  }
  if (currentHyperlink) {
    content.push(currentHyperlink);
  }

  return content;
}

/**
 * Create a unique key for a link mark
 */
function getLinkKey(mark: Mark): string {
  return mark.attrs.href || '';
}

/**
 * Create a unique key for a set of marks (excluding hyperlink)
 */
function getMarksKey(marks: readonly Mark[]): string {
  const nonLinkMarks = marks.filter((m) => m.type.name !== 'hyperlink');
  if (nonLinkMarks.length === 0) return '';

  return nonLinkMarks
    .map((m) => `${m.type.name}:${JSON.stringify(m.attrs)}`)
    .sort()
    .join('|');
}

/**
 * Create a Hyperlink from a link mark
 */
function createHyperlink(linkMark: Mark): Hyperlink {
  return {
    type: 'hyperlink',
    href: linkMark.attrs.href,
    tooltip: linkMark.attrs.tooltip || undefined,
    rId: linkMark.attrs.rId || undefined,
    children: [],
  };
}

/**
 * Add a node to a hyperlink
 */
function addNodeToHyperlink(hyperlink: Hyperlink, node: PMNode): void {
  if (node.isText && node.text) {
    const nonLinkMarks = node.marks.filter((m) => m.type.name !== 'hyperlink');
    const run = createRunFromText(node.text, nonLinkMarks);
    hyperlink.children.push(run);
  }
}

/**
 * Create a Run from text and marks
 */
function createRunFromText(text: string, marks: readonly Mark[]): Run {
  const formatting = marksToTextFormatting(marks);
  const textContent: TextContent = {
    type: 'text',
    text,
  };

  return {
    type: 'run',
    formatting: Object.keys(formatting).length > 0 ? formatting : undefined,
    content: [textContent],
  };
}

/**
 * Append text to an existing run
 */
function appendTextToRun(run: Run, text: string): void {
  const lastContent = run.content[run.content.length - 1];
  if (lastContent && lastContent.type === 'text') {
    lastContent.text += text;
  } else {
    run.content.push({ type: 'text', text });
  }
}

/**
 * Create a Run containing a line break
 */
function createBreakRun(): Run {
  const breakContent: BreakContent = {
    type: 'break',
    breakType: 'textWrapping',
  };

  return {
    type: 'run',
    content: [breakContent],
  };
}

/**
 * Create a Run containing an image
 */
function createImageRun(node: PMNode): Run {
  const attrs = node.attrs as ImageAttrs;

  const image: Image = {
    type: 'image',
    rId: attrs.rId || '',
    src: attrs.src,
    alt: attrs.alt || undefined,
    title: attrs.title || undefined,
    size: {
      width: attrs.width || 0,
      height: attrs.height || 0,
    },
    wrap: { type: 'inline' },
  };

  const drawingContent: DrawingContent = {
    type: 'drawing',
    image,
  };

  return {
    type: 'run',
    content: [drawingContent],
  };
}

/**
 * Convert ProseMirror marks to TextFormatting
 */
function marksToTextFormatting(marks: readonly Mark[]): TextFormatting {
  const formatting: TextFormatting = {};

  for (const mark of marks) {
    switch (mark.type.name) {
      case 'bold':
        formatting.bold = true;
        break;

      case 'italic':
        formatting.italic = true;
        break;

      case 'underline': {
        const attrs = mark.attrs as UnderlineAttrs;
        formatting.underline = {
          style: attrs.style || 'single',
          color: attrs.color,
        };
        break;
      }

      case 'strike':
        if (mark.attrs.double) {
          formatting.doubleStrike = true;
        } else {
          formatting.strike = true;
        }
        break;

      case 'textColor': {
        const attrs = mark.attrs as TextColorAttrs;
        formatting.color = {
          rgb: attrs.rgb,
          themeColor: attrs.themeColor,
          themeTint: attrs.themeTint,
          themeShade: attrs.themeShade,
        };
        break;
      }

      case 'highlight':
        formatting.highlight = mark.attrs.color;
        break;

      case 'fontSize':
        formatting.fontSize = mark.attrs.size;
        break;

      case 'fontFamily': {
        const attrs = mark.attrs as FontFamilyAttrs;
        formatting.fontFamily = {
          ascii: attrs.ascii,
          hAnsi: attrs.hAnsi,
          // asciiTheme needs to be cast to the proper type or undefined
          asciiTheme: attrs.asciiTheme as
            | 'majorAscii'
            | 'majorHAnsi'
            | 'majorEastAsia'
            | 'majorBidi'
            | 'minorAscii'
            | 'minorHAnsi'
            | 'minorEastAsia'
            | 'minorBidi'
            | undefined,
        };
        break;
      }

      case 'superscript':
        formatting.vertAlign = 'superscript';
        break;

      case 'subscript':
        formatting.vertAlign = 'subscript';
        break;

      // hyperlink is handled separately
    }
  }

  return formatting;
}

/**
 * Update a Document with content from a ProseMirror document
 * Preserves all non-content parts of the original document
 */
export function updateDocumentContent(originalDocument: Document, pmDoc: PMNode): Document {
  return fromProseDoc(pmDoc, originalDocument);
}
