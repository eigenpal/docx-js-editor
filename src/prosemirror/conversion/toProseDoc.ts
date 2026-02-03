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
 *
 * Resolves style-based text formatting and passes it to runs so that
 * paragraph styles (like Heading1) apply their font size, color, etc.
 */
function convertParagraph(paragraph: Paragraph, styleResolver: StyleResolver | null): PMNode {
  const attrs = paragraphFormattingToAttrs(paragraph, styleResolver);
  const inlineNodes: PMNode[] = [];

  // Get style-based text formatting (font size, bold, color, etc.)
  // This comes from the paragraph's style (e.g., Heading1 defines fontSize: 28pt, bold: true)
  let styleRunFormatting: TextFormatting | undefined;
  if (styleResolver) {
    const resolved = styleResolver.resolveParagraphStyle(paragraph.formatting?.styleId);
    styleRunFormatting = resolved.runFormatting;
  }

  for (const content of paragraph.content) {
    if (content.type === 'run') {
      const runNodes = convertRun(content, styleRunFormatting);
      inlineNodes.push(...runNodes);
    } else if (content.type === 'hyperlink') {
      const linkNodes = convertHyperlink(content, styleRunFormatting);
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
 *
 * Handles column widths from w:tblGrid - if cell widths aren't specified,
 * we use the grid column widths to set cell widths. This ensures tables
 * preserve their layout when opened from DOCX files.
 */
function convertTable(table: Table, styleResolver: StyleResolver | null): PMNode {
  const attrs: TableAttrs = {
    styleId: table.formatting?.styleId,
    width: table.formatting?.width?.value,
    widthType: table.formatting?.width?.type,
    justification: table.formatting?.justification,
  };

  // Calculate total width from columnWidths if available (for percentage calculation)
  const columnWidths = table.columnWidths;
  const totalWidth = columnWidths?.reduce((sum, w) => sum + w, 0) ?? 0;

  const rows = table.rows.map((row, rowIndex) =>
    convertTableRow(
      row,
      styleResolver,
      rowIndex === 0 && !!table.formatting?.look?.firstRow,
      columnWidths,
      totalWidth
    )
  );

  return schema.node('table', attrs, rows);
}

/**
 * Convert a TableRow to a ProseMirror table row node
 */
function convertTableRow(
  row: TableRow,
  styleResolver: StyleResolver | null,
  isHeaderRow: boolean,
  columnWidths?: number[],
  totalWidth?: number
): PMNode {
  const attrs: TableRowAttrs = {
    height: row.formatting?.height?.value,
    heightRule: row.formatting?.heightRule,
    isHeader: isHeaderRow || row.formatting?.header,
  };

  // Track column index for mapping to columnWidths (accounting for colspan)
  let colIndex = 0;
  const cells = row.cells.map((cell) => {
    const colspan = cell.formatting?.gridSpan ?? 1;
    // Calculate the width for this cell from columnWidths if cell doesn't have own width
    let gridWidth: number | undefined;
    if (columnWidths && totalWidth && totalWidth > 0) {
      // Sum widths for all columns this cell spans
      let cellWidthTwips = 0;
      for (let i = 0; i < colspan && colIndex + i < columnWidths.length; i++) {
        cellWidthTwips += columnWidths[colIndex + i];
      }
      // Convert to percentage of total table width
      gridWidth = Math.round((cellWidthTwips / totalWidth) * 100);
    }
    colIndex += colspan;
    return convertTableCell(cell, styleResolver, isHeaderRow, gridWidth);
  });

  return schema.node('tableRow', attrs, cells);
}

/**
 * Convert a TableCell to a ProseMirror table cell node
 */
function convertTableCell(
  cell: TableCell,
  styleResolver: StyleResolver | null,
  isHeader: boolean,
  gridWidthPercent?: number
): PMNode {
  const formatting = cell.formatting;

  // Handle vertical merge - skip 'continue' cells, they're merged into 'restart'
  // For now, we just render them as regular cells since proper vMerge requires
  // tracking state across rows. A future enhancement could handle this properly.
  const rowspan = 1; // Would need to calculate from vMerge tracking

  // Determine width: prefer cell's own width, fall back to grid width
  let width = formatting?.width?.value;
  let widthType = formatting?.width?.type;

  // If cell doesn't have its own width, use the grid-calculated percentage
  if (width === undefined && gridWidthPercent !== undefined) {
    width = gridWidthPercent;
    widthType = 'pct';
  }

  const attrs: TableCellAttrs = {
    colspan: formatting?.gridSpan ?? 1,
    rowspan: rowspan,
    width: width,
    widthType: widthType,
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
 *
 * @param run - The run to convert
 * @param styleFormatting - Text formatting from the paragraph's style (e.g., Heading1's font size/color)
 */
function convertRun(run: Run, styleFormatting?: TextFormatting): PMNode[] {
  const nodes: PMNode[] = [];

  // Merge style formatting with run's inline formatting
  // Inline formatting takes precedence over style formatting
  const mergedFormatting = mergeTextFormatting(styleFormatting, run.formatting);
  const marks = textFormattingToMarks(mergedFormatting);

  for (const content of run.content) {
    const contentNodes = convertRunContent(content, marks);
    nodes.push(...contentNodes);
  }

  return nodes;
}

/**
 * Merge two TextFormatting objects (source overrides target)
 */
function mergeTextFormatting(
  target: TextFormatting | undefined,
  source: TextFormatting | undefined
): TextFormatting | undefined {
  if (!source && !target) return undefined;
  if (!source) return target;
  if (!target) return source;

  // Start with target (style formatting), then overlay source (inline formatting)
  const result: TextFormatting = { ...target };

  // Merge each property - source (inline) takes precedence
  if (source.bold !== undefined) result.bold = source.bold;
  if (source.italic !== undefined) result.italic = source.italic;
  if (source.underline !== undefined) result.underline = source.underline;
  if (source.strike !== undefined) result.strike = source.strike;
  if (source.doubleStrike !== undefined) result.doubleStrike = source.doubleStrike;
  if (source.color !== undefined) result.color = source.color;
  if (source.highlight !== undefined) result.highlight = source.highlight;
  if (source.fontSize !== undefined) result.fontSize = source.fontSize;
  if (source.fontFamily !== undefined) result.fontFamily = source.fontFamily;
  if (source.vertAlign !== undefined) result.vertAlign = source.vertAlign;

  return result;
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
 *
 * @param hyperlink - The hyperlink to convert
 * @param styleFormatting - Text formatting from the paragraph's style
 */
function convertHyperlink(hyperlink: Hyperlink, styleFormatting?: TextFormatting): PMNode[] {
  const nodes: PMNode[] = [];

  // Create link mark
  const linkMark = schema.mark('hyperlink', {
    href: hyperlink.href || hyperlink.anchor || '',
    tooltip: hyperlink.tooltip,
    rId: hyperlink.rId,
  });

  for (const child of hyperlink.children) {
    if (child.type === 'run') {
      // Merge style formatting with run's inline formatting
      const mergedFormatting = mergeTextFormatting(styleFormatting, child.formatting);
      const runMarks = textFormattingToMarks(mergedFormatting);
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
