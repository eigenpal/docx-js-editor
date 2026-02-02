/**
 * Document to ProseMirror Conversion
 *
 * Converts our Document type (from DOCX parsing) to a ProseMirror document.
 * Preserves all formatting attributes for round-trip fidelity.
 */

import type { Node as PMNode } from 'prosemirror-model';
import { schema } from '../schema';
import type { ParagraphAttrs } from '../schema/nodes';
import type {
  Document,
  Paragraph,
  Run,
  TextFormatting,
  RunContent,
  Hyperlink,
  Image,
} from '../../types/document';

/**
 * Convert a Document to a ProseMirror document
 */
export function toProseDoc(document: Document): PMNode {
  const paragraphs = document.package.document.content;
  const nodes: PMNode[] = [];

  for (const block of paragraphs) {
    if (block.type === 'paragraph') {
      const pmParagraph = convertParagraph(block);
      nodes.push(pmParagraph);
    }
    // Tables are not yet supported in PM - skip for now
  }

  // Ensure we have at least one paragraph
  if (nodes.length === 0) {
    nodes.push(schema.node('paragraph', {}, []));
  }

  return schema.node('doc', null, nodes);
}

/**
 * Convert a Paragraph to a ProseMirror paragraph node
 */
function convertParagraph(paragraph: Paragraph): PMNode {
  const attrs = paragraphFormattingToAttrs(paragraph);
  const inlineNodes: PMNode[] = [];

  for (const content of paragraph.content) {
    if (content.type === 'run') {
      const runNodes = convertRun(content);
      inlineNodes.push(...runNodes);
    } else if (content.type === 'hyperlink') {
      const linkNodes = convertHyperlink(content);
      inlineNodes.push(...linkNodes);
    }
    // Skip other content types for now (bookmarks, fields, etc.)
  }

  return schema.node('paragraph', attrs, inlineNodes);
}

/**
 * Convert ParagraphFormatting to ProseMirror paragraph attrs
 */
function paragraphFormattingToAttrs(paragraph: Paragraph): ParagraphAttrs {
  const formatting = paragraph.formatting;

  return {
    paraId: paragraph.paraId ?? undefined,
    textId: paragraph.textId ?? undefined,
    alignment: formatting?.alignment,
    spaceBefore: formatting?.spaceBefore,
    spaceAfter: formatting?.spaceAfter,
    lineSpacing: formatting?.lineSpacing,
    lineSpacingRule: formatting?.lineSpacingRule,
    indentLeft: formatting?.indentLeft,
    indentRight: formatting?.indentRight,
    indentFirstLine: formatting?.indentFirstLine,
    hangingIndent: formatting?.hangingIndent,
    numPr: formatting?.numPr,
    styleId: formatting?.styleId,
  };
}

/**
 * Convert a Run to ProseMirror text nodes with marks
 */
function convertRun(run: Run): PMNode[] {
  const nodes: PMNode[] = [];
  const marks = textFormattingToMarks(run.formatting);

  for (const content of run.content) {
    const contentNodes = convertRunContent(content, marks);
    nodes.push(...contentNodes);
  }

  return nodes;
}

/**
 * Convert RunContent to ProseMirror nodes
 */
function convertRunContent(content: RunContent, marks: ReturnType<typeof schema.mark>[]): PMNode[] {
  switch (content.type) {
    case 'text':
      if (content.text) {
        return [schema.text(content.text, marks)];
      }
      return [];

    case 'break':
      if (content.breakType === 'textWrapping' || !content.breakType) {
        return [schema.node('hardBreak')];
      }
      // Page breaks not supported in inline content
      return [];

    case 'tab':
      // Convert tabs to spaces for now
      return [schema.text('\t', marks)];

    case 'drawing':
      if (content.image) {
        return [convertImage(content.image)];
      }
      return [];

    default:
      return [];
  }
}

/**
 * Convert an Image to a ProseMirror image node
 */
function convertImage(image: Image): PMNode {
  return schema.node('image', {
    src: image.src || '',
    alt: image.alt,
    title: image.title,
    width: image.size?.width,
    height: image.size?.height,
    rId: image.rId,
  });
}

/**
 * Convert a Hyperlink to ProseMirror nodes with link mark
 */
function convertHyperlink(hyperlink: Hyperlink): PMNode[] {
  const nodes: PMNode[] = [];

  // Create link mark
  const linkMark = schema.mark('hyperlink', {
    href: hyperlink.href || hyperlink.anchor || '',
    tooltip: hyperlink.tooltip,
    rId: hyperlink.rId,
  });

  for (const child of hyperlink.children) {
    if (child.type === 'run') {
      const runMarks = textFormattingToMarks(child.formatting);
      // Add link mark to run marks
      const allMarks = [...runMarks, linkMark];

      for (const content of child.content) {
        if (content.type === 'text' && content.text) {
          nodes.push(schema.text(content.text, allMarks));
        }
      }
    }
  }

  return nodes;
}

/**
 * Convert TextFormatting to ProseMirror marks
 */
function textFormattingToMarks(
  formatting: TextFormatting | undefined
): ReturnType<typeof schema.mark>[] {
  if (!formatting) return [];

  const marks: ReturnType<typeof schema.mark>[] = [];

  // Bold
  if (formatting.bold) {
    marks.push(schema.mark('bold'));
  }

  // Italic
  if (formatting.italic) {
    marks.push(schema.mark('italic'));
  }

  // Underline
  if (formatting.underline && formatting.underline.style !== 'none') {
    marks.push(
      schema.mark('underline', {
        style: formatting.underline.style,
        color: formatting.underline.color,
      })
    );
  }

  // Strikethrough
  if (formatting.strike || formatting.doubleStrike) {
    marks.push(
      schema.mark('strike', {
        double: formatting.doubleStrike || false,
      })
    );
  }

  // Text color
  if (formatting.color && !formatting.color.auto) {
    marks.push(
      schema.mark('textColor', {
        rgb: formatting.color.rgb,
        themeColor: formatting.color.themeColor,
        themeTint: formatting.color.themeTint,
        themeShade: formatting.color.themeShade,
      })
    );
  }

  // Highlight
  if (formatting.highlight && formatting.highlight !== 'none') {
    marks.push(
      schema.mark('highlight', {
        color: formatting.highlight,
      })
    );
  }

  // Font size
  if (formatting.fontSize) {
    marks.push(
      schema.mark('fontSize', {
        size: formatting.fontSize,
      })
    );
  }

  // Font family
  if (formatting.fontFamily) {
    marks.push(
      schema.mark('fontFamily', {
        ascii: formatting.fontFamily.ascii,
        hAnsi: formatting.fontFamily.hAnsi,
        asciiTheme: formatting.fontFamily.asciiTheme,
      })
    );
  }

  // Superscript/Subscript
  if (formatting.vertAlign === 'superscript') {
    marks.push(schema.mark('superscript'));
  } else if (formatting.vertAlign === 'subscript') {
    marks.push(schema.mark('subscript'));
  }

  return marks;
}

/**
 * Create an empty ProseMirror document
 */
export function createEmptyDoc(): PMNode {
  return schema.node('doc', null, [schema.node('paragraph', {}, [])]);
}
