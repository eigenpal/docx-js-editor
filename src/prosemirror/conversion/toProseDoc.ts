/**
 * Document to ProseMirror Conversion
 *
 * Converts our Document type (from DOCX parsing) to a ProseMirror document.
 * Preserves all formatting attributes for round-trip fidelity.
 *
 * Style Resolution:
 * When styles are provided, paragraph properties are resolved from the style chain:
 * - Document defaults (docDefaults)
 * - Normal style (if no explicit styleId)
 * - Style chain (basedOn inheritance)
 * - Inline properties (highest priority)
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
  StyleDefinitions,
  Table,
  TableRow,
  TableCell,
} from '../../types/document';
import { createStyleResolver, type StyleResolver } from '../styles';
import type { TableAttrs, TableRowAttrs, TableCellAttrs } from '../schema/nodes';

/**
 * Options for document conversion
 */
export interface ToProseDocOptions {
  /** Style definitions for resolving paragraph styles */
  styles?: StyleDefinitions;
}

/**
 * Convert a Document to a ProseMirror document
 *
 * @param document - The Document to convert
 * @param options - Conversion options including style definitions
 */
export function toProseDoc(document: Document, options?: ToProseDocOptions): PMNode {
  const paragraphs = document.package.document.content;
  const nodes: PMNode[] = [];

  // Create style resolver if styles are provided
  const styleResolver = options?.styles ? createStyleResolver(options.styles) : null;

  for (const block of paragraphs) {
    if (block.type === 'paragraph') {
      const pmParagraph = convertParagraph(block, styleResolver);
      nodes.push(pmParagraph);
    } else if (block.type === 'table') {
      const pmTable = convertTable(block, styleResolver);
      nodes.push(pmTable);
    }
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
function convertParagraph(paragraph: Paragraph, styleResolver: StyleResolver | null): PMNode {
  const attrs = paragraphFormattingToAttrs(paragraph, styleResolver);
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
 *
 * If a styleResolver is provided, resolves style-based formatting and merges
 * with inline formatting. Inline formatting takes precedence.
 */
function paragraphFormattingToAttrs(
  paragraph: Paragraph,
  styleResolver: StyleResolver | null
): ParagraphAttrs {
  const formatting = paragraph.formatting;
  const styleId = formatting?.styleId;

  // Start with base attrs
  const attrs: ParagraphAttrs = {
    paraId: paragraph.paraId ?? undefined,
    textId: paragraph.textId ?? undefined,
    styleId: styleId,
    numPr: formatting?.numPr,
  };

  // If we have a style resolver, resolve the style and get base properties
  if (styleResolver) {
    const resolved = styleResolver.resolveParagraphStyle(styleId);
    const stylePpr = resolved.paragraphFormatting;

    // Apply style-based values as defaults (inline overrides)
    attrs.alignment = formatting?.alignment ?? stylePpr?.alignment;
    attrs.spaceBefore = formatting?.spaceBefore ?? stylePpr?.spaceBefore;
    attrs.spaceAfter = formatting?.spaceAfter ?? stylePpr?.spaceAfter;
    attrs.lineSpacing = formatting?.lineSpacing ?? stylePpr?.lineSpacing;
    attrs.lineSpacingRule = formatting?.lineSpacingRule ?? stylePpr?.lineSpacingRule;
    attrs.indentLeft = formatting?.indentLeft ?? stylePpr?.indentLeft;
    attrs.indentRight = formatting?.indentRight ?? stylePpr?.indentRight;
    attrs.indentFirstLine = formatting?.indentFirstLine ?? stylePpr?.indentFirstLine;
    attrs.hangingIndent = formatting?.hangingIndent ?? stylePpr?.hangingIndent;
    attrs.borders = formatting?.borders ?? stylePpr?.borders;
    attrs.shading = formatting?.shading ?? stylePpr?.shading;
    attrs.tabs = formatting?.tabs ?? stylePpr?.tabs;

    // If style defines numPr but inline doesn't, use style's numPr
    if (!formatting?.numPr && stylePpr?.numPr) {
      attrs.numPr = stylePpr.numPr;
    }
  } else {
    // No style resolver - use inline formatting only
    attrs.alignment = formatting?.alignment;
    attrs.spaceBefore = formatting?.spaceBefore;
    attrs.spaceAfter = formatting?.spaceAfter;
    attrs.lineSpacing = formatting?.lineSpacing;
    attrs.lineSpacingRule = formatting?.lineSpacingRule;
    attrs.indentLeft = formatting?.indentLeft;
    attrs.indentRight = formatting?.indentRight;
    attrs.indentFirstLine = formatting?.indentFirstLine;
    attrs.hangingIndent = formatting?.hangingIndent;
    attrs.borders = formatting?.borders;
    attrs.shading = formatting?.shading;
    attrs.tabs = formatting?.tabs;
  }

  return attrs;
}

// ============================================================================
// TABLE CONVERSION
// ============================================================================

/**
 * Convert a Table to a ProseMirror table node
 */
function convertTable(table: Table, styleResolver: StyleResolver | null): PMNode {
  const attrs: TableAttrs = {
    styleId: table.formatting?.styleId,
    width: table.formatting?.width?.value,
    widthType: table.formatting?.width?.type,
    justification: table.formatting?.justification,
  };

  const rows = table.rows.map((row, rowIndex) =>
    convertTableRow(row, styleResolver, rowIndex === 0 && !!table.formatting?.look?.firstRow)
  );

  return schema.node('table', attrs, rows);
}

/**
 * Convert a TableRow to a ProseMirror table row node
 */
function convertTableRow(
  row: TableRow,
  styleResolver: StyleResolver | null,
  isHeaderRow: boolean
): PMNode {
  const attrs: TableRowAttrs = {
    height: row.formatting?.height?.value,
    heightRule: row.formatting?.heightRule,
    isHeader: isHeaderRow || row.formatting?.header,
  };

  const cells = row.cells.map((cell) => convertTableCell(cell, styleResolver, isHeaderRow));

  return schema.node('tableRow', attrs, cells);
}

/**
 * Convert a TableCell to a ProseMirror table cell node
 */
function convertTableCell(
  cell: TableCell,
  styleResolver: StyleResolver | null,
  isHeader: boolean
): PMNode {
  const formatting = cell.formatting;

  // Handle vertical merge - skip 'continue' cells, they're merged into 'restart'
  // For now, we just render them as regular cells since proper vMerge requires
  // tracking state across rows. A future enhancement could handle this properly.
  const rowspan = 1; // Would need to calculate from vMerge tracking

  const attrs: TableCellAttrs = {
    colspan: formatting?.gridSpan ?? 1,
    rowspan: rowspan,
    width: formatting?.width?.value,
    widthType: formatting?.width?.type,
    verticalAlign: formatting?.verticalAlign,
    backgroundColor: formatting?.shading?.fill?.rgb,
  };

  // Convert cell content (paragraphs and nested tables)
  const contentNodes: PMNode[] = [];
  for (const content of cell.content) {
    if (content.type === 'paragraph') {
      contentNodes.push(convertParagraph(content, styleResolver));
    } else if (content.type === 'table') {
      // Nested tables - recursively convert
      contentNodes.push(convertTable(content, styleResolver));
    }
  }

  // Ensure cell has at least one paragraph
  if (contentNodes.length === 0) {
    contentNodes.push(schema.node('paragraph', {}, []));
  }

  // Use tableHeader for header cells, tableCell otherwise
  const nodeType = isHeader ? 'tableHeader' : 'tableCell';
  return schema.node(nodeType, attrs, contentNodes);
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
      // Convert to tab node for proper rendering
      return [schema.node('tab')];

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
