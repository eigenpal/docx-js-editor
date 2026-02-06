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
  TabContent,
  DrawingContent,
  Image,
  Hyperlink,
  ParagraphContent,
  Table,
  TableRow,
  TableCell,
  TableFormatting,
  TableRowFormatting,
  TableCellFormatting,
  ShapeContent,
  Shape,
} from '../../types/document';
import type {
  ParagraphAttrs,
  ImageAttrs,
  TableAttrs,
  TableRowAttrs,
  TableCellAttrs,
} from '../schema/nodes';
import type { TextColorAttrs, UnderlineAttrs, FontFamilyAttrs } from '../schema/marks';

/**
 * Convert a ProseMirror document to our Document type
 */
export function fromProseDoc(pmDoc: PMNode, baseDocument?: Document): Document {
  const blocks = extractBlocks(pmDoc);

  // Preserve section properties (margins, headers, footers) from base document
  const documentBody: DocumentBody = {
    content: blocks,
    finalSectionProperties: baseDocument?.package.document.finalSectionProperties,
    sections: baseDocument?.package.document.sections,
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
 * Extract blocks (paragraphs and tables) from ProseMirror document
 */
function extractBlocks(pmDoc: PMNode): (Paragraph | Table)[] {
  const blocks: (Paragraph | Table)[] = [];

  pmDoc.forEach((node) => {
    if (node.type.name === 'paragraph') {
      blocks.push(convertPMParagraph(node));
    } else if (node.type.name === 'table') {
      blocks.push(convertPMTable(node));
    } else if (node.type.name === 'textBox') {
      // Convert text box back to a paragraph containing a shape with text body
      blocks.push(convertPMTextBox(node));
    }
  });

  return blocks;
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
    attrs.styleId ||
    attrs.borders ||
    attrs.shading ||
    attrs.tabs;

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
    borders: attrs.borders || undefined,
    shading: attrs.shading || undefined,
    tabs: attrs.tabs || undefined,
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
    } else if (node.type.name === 'tab') {
      // Tab ends current run
      if (currentRun) {
        content.push(currentRun);
        currentRun = null;
        currentMarksKey = null;
      }
      content.push(createTabRun());
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
 * Create a Run containing a tab
 */
function createTabRun(): Run {
  const tabContent: TabContent = {
    type: 'tab',
  };

  return {
    type: 'run',
    content: [tabContent],
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

  // Round-trip border/outline
  if (attrs.borderWidth && attrs.borderWidth > 0) {
    const cssToOoxmlStyle: Record<string, string> = {
      solid: 'solid',
      dotted: 'dot',
      dashed: 'dash',
      double: 'solid',
      groove: 'solid',
      ridge: 'solid',
      inset: 'solid',
      outset: 'solid',
    };
    image.outline = {
      // Convert pixels back to EMU (1 px = 914400/96 EMU)
      width: Math.round(attrs.borderWidth * (914400 / 96)),
      color: attrs.borderColor ? { rgb: attrs.borderColor.replace('#', '') } : undefined,
      style: attrs.borderStyle
        ? (cssToOoxmlStyle[
            attrs.borderStyle
          ] as import('../../types/content').ShapeOutline['style']) || 'solid'
        : 'solid',
    };
  }

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

      case 'allCaps':
        formatting.allCaps = true;
        break;

      case 'smallCaps':
        formatting.smallCaps = true;
        break;

      // hyperlink is handled separately
    }
  }

  return formatting;
}

// ============================================================================
// TABLE CONVERSION
// ============================================================================

/**
 * Convert a ProseMirror table node to our Table type
 */
function convertPMTable(node: PMNode): Table {
  const attrs = node.attrs as TableAttrs;
  const rows: TableRow[] = [];

  node.forEach((rowNode) => {
    if (rowNode.type.name === 'tableRow') {
      rows.push(convertPMTableRow(rowNode));
    }
  });

  return {
    type: 'table',
    formatting: tableAttrsToFormatting(attrs),
    rows,
  };
}

/**
 * Convert ProseMirror table attrs to TableFormatting
 */
function tableAttrsToFormatting(attrs: TableAttrs): TableFormatting | undefined {
  const hasFormatting = attrs.styleId || attrs.width || attrs.justification;

  if (!hasFormatting) {
    return undefined;
  }

  return {
    styleId: attrs.styleId || undefined,
    width: attrs.width
      ? {
          value: attrs.width,
          type: (attrs.widthType as 'auto' | 'dxa' | 'pct' | 'nil') || 'dxa',
        }
      : undefined,
    justification: attrs.justification || undefined,
  };
}

/**
 * Convert a ProseMirror table row node to our TableRow type
 */
function convertPMTableRow(node: PMNode): TableRow {
  const attrs = node.attrs as TableRowAttrs;
  const cells: TableCell[] = [];

  node.forEach((cellNode) => {
    if (cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader') {
      cells.push(convertPMTableCell(cellNode));
    }
  });

  return {
    type: 'tableRow',
    formatting: tableRowAttrsToFormatting(attrs),
    cells,
  };
}

/**
 * Convert ProseMirror table row attrs to TableRowFormatting
 */
function tableRowAttrsToFormatting(attrs: TableRowAttrs): TableRowFormatting | undefined {
  const hasFormatting = attrs.height || attrs.isHeader;

  if (!hasFormatting) {
    return undefined;
  }

  return {
    height: attrs.height
      ? {
          value: attrs.height,
          type: 'dxa',
        }
      : undefined,
    heightRule: (attrs.heightRule as 'auto' | 'atLeast' | 'exact') || undefined,
    header: attrs.isHeader || undefined,
  };
}

/**
 * Convert a ProseMirror table cell node to our TableCell type
 */
function convertPMTableCell(node: PMNode): TableCell {
  const attrs = node.attrs as TableCellAttrs;
  const content: (Paragraph | Table)[] = [];

  // Extract cell content (paragraphs and nested tables)
  node.forEach((contentNode) => {
    if (contentNode.type.name === 'paragraph') {
      content.push(convertPMParagraph(contentNode));
    } else if (contentNode.type.name === 'table') {
      content.push(convertPMTable(contentNode));
    }
  });

  return {
    type: 'tableCell',
    formatting: tableCellAttrsToFormatting(attrs),
    content,
  };
}

/**
 * Convert ProseMirror table cell attrs to TableCellFormatting
 * Borders are stored as full BorderSpec objects — no conversion needed.
 */
function tableCellAttrsToFormatting(attrs: TableCellAttrs): TableCellFormatting | undefined {
  const hasFormatting =
    attrs.colspan > 1 ||
    attrs.rowspan > 1 ||
    attrs.width ||
    attrs.verticalAlign ||
    attrs.backgroundColor ||
    attrs.borders ||
    attrs.margins ||
    attrs.textDirection;

  if (!hasFormatting) {
    return undefined;
  }

  // Convert margins (twips values) back to TableMeasurement objects
  let margins: TableCellFormatting['margins'];
  if (attrs.margins) {
    const m = attrs.margins;
    margins = {};
    if (m.top != null) margins.top = { value: m.top, type: 'dxa' };
    if (m.bottom != null) margins.bottom = { value: m.bottom, type: 'dxa' };
    if (m.left != null) margins.left = { value: m.left, type: 'dxa' };
    if (m.right != null) margins.right = { value: m.right, type: 'dxa' };
  }

  return {
    gridSpan: attrs.colspan > 1 ? attrs.colspan : undefined,
    width: attrs.width
      ? {
          value: attrs.width,
          type: (attrs.widthType as 'auto' | 'dxa' | 'pct' | 'nil') || 'dxa',
        }
      : undefined,
    verticalAlign: attrs.verticalAlign || undefined,
    textDirection: (attrs.textDirection as TableCellFormatting['textDirection']) || undefined,
    shading: attrs.backgroundColor
      ? {
          fill: { rgb: attrs.backgroundColor },
        }
      : undefined,
    borders: attrs.borders as TableCellFormatting['borders'],
    margins,
  };
}

// ============================================================================
// TEXT BOX CONVERSION
// ============================================================================

/**
 * Convert a ProseMirror textBox node back to a Paragraph wrapping a ShapeContent run.
 * The text box content becomes a Shape with textBody.
 */
function convertPMTextBox(node: PMNode): Paragraph {
  const attrs = node.attrs as import('../extensions/nodes/TextBoxExtension').TextBoxAttrs;

  // Extract child paragraphs from the text box content
  const childParagraphs: Paragraph[] = [];
  node.forEach((child) => {
    if (child.type.name === 'paragraph') {
      childParagraphs.push(convertPMParagraph(child));
    }
    // Tables inside text boxes are currently not round-tripped
  });

  // Build shape with text body
  const shape: Shape = {
    type: 'shape',
    shapeType: 'rect',
    id: attrs.textBoxId || undefined,
    size: {
      width: attrs.width ? Math.round(attrs.width * (914400 / 96)) : 0,
      height: attrs.height ? Math.round(attrs.height * (914400 / 96)) : 0,
    },
    textBody: {
      content: childParagraphs.length > 0 ? childParagraphs : [{ type: 'paragraph', content: [] }],
      margins: {
        top: attrs.marginTop != null ? Math.round(attrs.marginTop * (914400 / 96)) : undefined,
        bottom:
          attrs.marginBottom != null ? Math.round(attrs.marginBottom * (914400 / 96)) : undefined,
        left: attrs.marginLeft != null ? Math.round(attrs.marginLeft * (914400 / 96)) : undefined,
        right:
          attrs.marginRight != null ? Math.round(attrs.marginRight * (914400 / 96)) : undefined,
      },
    },
  };

  // Convert fill color back
  if (attrs.fillColor) {
    shape.fill = {
      type: 'solid',
      color: { rgb: attrs.fillColor.replace('#', '') },
    };
  }

  // Convert outline back
  if (attrs.outlineWidth && attrs.outlineWidth > 0) {
    const cssToOoxmlOutline: Record<string, string> = {
      solid: 'solid',
      dotted: 'dot',
      dashed: 'dash',
    };
    shape.outline = {
      width: Math.round(attrs.outlineWidth * (914400 / 96)),
      color: attrs.outlineColor ? { rgb: attrs.outlineColor.replace('#', '') } : undefined,
      style: attrs.outlineStyle
        ? (cssToOoxmlOutline[
            attrs.outlineStyle
          ] as import('../../types/content').ShapeOutline['style']) || 'solid'
        : 'solid',
    };
  }

  // Wrap the shape in a paragraph with a run containing ShapeContent
  const shapeContent: ShapeContent = { type: 'shape', shape };
  const run: Run = { type: 'run', content: [shapeContent] };

  return {
    type: 'paragraph',
    content: [run],
  };
}

/**
 * Update a Document with content from a ProseMirror document
 * Preserves all non-content parts of the original document
 */
export function updateDocumentContent(originalDocument: Document, pmDoc: PMNode): Document {
  return fromProseDoc(pmDoc, originalDocument);
}
