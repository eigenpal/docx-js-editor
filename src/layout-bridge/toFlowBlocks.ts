/**
 * ProseMirror to FlowBlock Converter
 *
 * Converts a ProseMirror document into FlowBlock[] for the layout engine.
 * Tracks pmStart/pmEnd positions for click-to-position mapping.
 */

import type { Node as PMNode, Mark } from 'prosemirror-model';
import type {
  FlowBlock,
  ParagraphBlock,
  TableBlock,
  TableRow,
  TableCell,
  CellBorders,
  CellBorderSpec,
  ImageBlock,
  PageBreakBlock,
  Run,
  TextRun,
  TabRun,
  ImageRun,
  LineBreakRun,
  RunFormatting,
  ParagraphAttrs,
} from '../layout-engine/types';
import type { ParagraphAttrs as PMParagraphAttrs } from '../prosemirror/schema/nodes';
import type {
  TextColorAttrs,
  UnderlineAttrs,
  FontSizeAttrs,
  FontFamilyAttrs,
} from '../prosemirror/schema/marks';

/**
 * Options for the conversion.
 */
export type ToFlowBlocksOptions = {
  /** Default font family. */
  defaultFont?: string;
  /** Default font size in points. */
  defaultSize?: number;
};

const DEFAULT_FONT = 'Calibri';
const DEFAULT_SIZE = 11; // points (Word 2007+ default)

/**
 * Convert twips to pixels (1 twip = 1/20 point, 1 point = 1.333px at 96 DPI).
 */
function twipsToPixels(twips: number): number {
  return Math.round((twips / 20) * 1.333);
}

/**
 * Generate a unique block ID.
 */
let blockIdCounter = 0;
function nextBlockId(): string {
  return `block-${++blockIdCounter}`;
}

/**
 * Reset the block ID counter (useful for testing).
 */
export function resetBlockIdCounter(): void {
  blockIdCounter = 0;
}

/**
 * Extract run formatting from ProseMirror marks.
 */
function extractRunFormatting(marks: readonly Mark[]): RunFormatting {
  const formatting: RunFormatting = {};

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
        if (attrs.style || attrs.color) {
          formatting.underline = {
            style: attrs.style,
            color: attrs.color?.rgb ? `#${attrs.color.rgb}` : undefined,
          };
        } else {
          formatting.underline = true;
        }
        break;
      }

      case 'strike':
        formatting.strike = true;
        break;

      case 'textColor': {
        const attrs = mark.attrs as TextColorAttrs;
        if (attrs.rgb) {
          formatting.color = `#${attrs.rgb}`;
        }
        break;
      }

      case 'highlight':
        formatting.highlight = mark.attrs.color as string;
        break;

      case 'fontSize': {
        const attrs = mark.attrs as FontSizeAttrs;
        // Convert half-points to points
        formatting.fontSize = attrs.size / 2;
        break;
      }

      case 'fontFamily': {
        const attrs = mark.attrs as FontFamilyAttrs;
        formatting.fontFamily = attrs.ascii || attrs.hAnsi;
        break;
      }

      case 'superscript':
        formatting.superscript = true;
        break;

      case 'subscript':
        formatting.subscript = true;
        break;
    }
  }

  return formatting;
}

/**
 * Convert a paragraph node to runs.
 */
function paragraphToRuns(node: PMNode, startPos: number, _options: ToFlowBlocksOptions): Run[] {
  const runs: Run[] = [];
  const offset = startPos + 1; // +1 for opening tag

  node.forEach((child, childOffset) => {
    const childPos = offset + childOffset;

    if (child.isText && child.text) {
      // Text node - create text run
      const formatting = extractRunFormatting(child.marks);
      const run: TextRun = {
        kind: 'text',
        text: child.text,
        ...formatting,
        pmStart: childPos,
        pmEnd: childPos + child.nodeSize,
      };
      runs.push(run);
    } else if (child.type.name === 'hardBreak') {
      // Line break
      const run: LineBreakRun = {
        kind: 'lineBreak',
        pmStart: childPos,
        pmEnd: childPos + child.nodeSize,
      };
      runs.push(run);
    } else if (child.type.name === 'tab') {
      // Tab character
      const formatting = extractRunFormatting(child.marks);
      const run: TabRun = {
        kind: 'tab',
        ...formatting,
        pmStart: childPos,
        pmEnd: childPos + child.nodeSize,
      };
      runs.push(run);
    } else if (child.type.name === 'image') {
      // Inline image
      const attrs = child.attrs;
      const run: ImageRun = {
        kind: 'image',
        src: attrs.src as string,
        width: (attrs.width as number) || 100,
        height: (attrs.height as number) || 100,
        alt: attrs.alt as string | undefined,
        pmStart: childPos,
        pmEnd: childPos + child.nodeSize,
      };
      runs.push(run);
    }
  });

  return runs;
}

/**
 * Convert PM paragraph attrs to layout engine paragraph attrs.
 */
function convertParagraphAttrs(pmAttrs: PMParagraphAttrs): ParagraphAttrs {
  const attrs: ParagraphAttrs = {};

  // Alignment - map DOCX values to CSS-compatible values
  // DOCX uses 'both' for justify, 'distribute' for distributed justify
  if (pmAttrs.alignment) {
    const align = pmAttrs.alignment;
    if (align === 'both' || align === 'distribute') {
      attrs.alignment = 'justify';
    } else if (align === 'left') {
      attrs.alignment = 'left';
    } else if (align === 'center') {
      attrs.alignment = 'center';
    } else if (align === 'right') {
      attrs.alignment = 'right';
    }
    // Other DOCX alignments (mediumKashida, highKashida, lowKashida, thaiDistribute, justify)
    // default to no alignment set (inherits from style or defaults to left)
  }

  // Spacing
  if (pmAttrs.spaceBefore != null || pmAttrs.spaceAfter != null || pmAttrs.lineSpacing != null) {
    attrs.spacing = {};
    if (pmAttrs.spaceBefore != null) {
      attrs.spacing.before = twipsToPixels(pmAttrs.spaceBefore);
    }
    if (pmAttrs.spaceAfter != null) {
      attrs.spacing.after = twipsToPixels(pmAttrs.spaceAfter);
    }
    if (pmAttrs.lineSpacing != null) {
      // Line spacing in twips - convert to multiplier or exact
      if (pmAttrs.lineSpacingRule === 'exact' || pmAttrs.lineSpacingRule === 'atLeast') {
        attrs.spacing.line = twipsToPixels(pmAttrs.lineSpacing);
        attrs.spacing.lineUnit = 'px';
        attrs.spacing.lineRule = pmAttrs.lineSpacingRule;
      } else {
        // Auto - line spacing is in 240ths of a line
        attrs.spacing.line = pmAttrs.lineSpacing / 240;
        attrs.spacing.lineUnit = 'multiplier';
        attrs.spacing.lineRule = 'auto';
      }
    }
  }

  // Indentation
  if (
    pmAttrs.indentLeft != null ||
    pmAttrs.indentRight != null ||
    pmAttrs.indentFirstLine != null
  ) {
    attrs.indent = {};
    if (pmAttrs.indentLeft != null) {
      attrs.indent.left = twipsToPixels(pmAttrs.indentLeft);
    }
    if (pmAttrs.indentRight != null) {
      attrs.indent.right = twipsToPixels(pmAttrs.indentRight);
    }
    if (pmAttrs.indentFirstLine != null) {
      if (pmAttrs.hangingIndent) {
        attrs.indent.hanging = twipsToPixels(pmAttrs.indentFirstLine);
      } else {
        attrs.indent.firstLine = twipsToPixels(pmAttrs.indentFirstLine);
      }
    }
  }

  // Style ID
  if (pmAttrs.styleId) {
    attrs.styleId = pmAttrs.styleId;
  }

  // Borders
  if (pmAttrs.borders) {
    const borders = pmAttrs.borders;
    attrs.borders = {};

    const convertBorder = (border: typeof borders.top) => {
      if (!border || border.style === 'none' || border.style === 'nil') {
        return undefined;
      }
      // Convert size from eighths of a point to pixels
      // 1 point = 1.333px at 96 DPI, size is in eighths of a point
      const widthPx = border.size ? Math.max(1, Math.ceil((border.size / 8) * 1.333)) : 1;
      // Convert color
      let color = '#000000';
      if (border.color?.rgb) {
        color = `#${border.color.rgb}`;
      }
      return {
        style: border.style || 'single',
        width: widthPx,
        color,
      };
    };

    if (borders.top) attrs.borders.top = convertBorder(borders.top);
    if (borders.bottom) attrs.borders.bottom = convertBorder(borders.bottom);
    if (borders.left) attrs.borders.left = convertBorder(borders.left);
    if (borders.right) attrs.borders.right = convertBorder(borders.right);

    // Only include if at least one border is set
    if (
      !attrs.borders.top &&
      !attrs.borders.bottom &&
      !attrs.borders.left &&
      !attrs.borders.right
    ) {
      delete attrs.borders;
    }
  }

  // Shading (background color)
  if (pmAttrs.shading?.fill?.rgb) {
    attrs.shading = `#${pmAttrs.shading.fill.rgb}`;
  }

  // Tab stops
  if (pmAttrs.tabs && pmAttrs.tabs.length > 0) {
    attrs.tabs = pmAttrs.tabs.map((tab) => ({
      val: mapTabAlignment(tab.alignment),
      pos: tab.position,
      leader: tab.leader as 'none' | 'dot' | 'hyphen' | 'underscore' | undefined,
    }));
  }

  // Page break control
  if (pmAttrs.pageBreakBefore) {
    attrs.pageBreakBefore = true;
  }
  if (pmAttrs.keepNext) {
    attrs.keepNext = true;
  }
  if (pmAttrs.keepLines) {
    attrs.keepLines = true;
  }

  // List properties
  if (pmAttrs.numPr) {
    attrs.numPr = {
      numId: pmAttrs.numPr.numId,
      ilvl: pmAttrs.numPr.ilvl,
    };
  }
  if (pmAttrs.listMarker) {
    attrs.listMarker = pmAttrs.listMarker;
  }
  if (pmAttrs.listIsBullet != null) {
    attrs.listIsBullet = pmAttrs.listIsBullet;
  }

  return attrs;
}

/**
 * Map document TabStopAlignment to layout engine TabAlignment
 */
function mapTabAlignment(
  align: 'left' | 'center' | 'right' | 'decimal' | 'bar' | 'clear' | 'num'
): 'start' | 'end' | 'center' | 'decimal' | 'bar' | 'clear' {
  switch (align) {
    case 'left':
      return 'start';
    case 'right':
      return 'end';
    case 'center':
      return 'center';
    case 'decimal':
      return 'decimal';
    case 'bar':
      return 'bar';
    case 'clear':
      return 'clear';
    case 'num':
      return 'start'; // Number tab treated as left-aligned
    default:
      return 'start';
  }
}

/**
 * Convert a paragraph node to a ParagraphBlock.
 */
function convertParagraph(
  node: PMNode,
  startPos: number,
  options: ToFlowBlocksOptions
): ParagraphBlock {
  const pmAttrs = node.attrs as PMParagraphAttrs;
  const runs = paragraphToRuns(node, startPos, options);
  const attrs = convertParagraphAttrs(pmAttrs);

  return {
    kind: 'paragraph',
    id: nextBlockId(),
    runs,
    attrs,
    pmStart: startPos,
    pmEnd: startPos + node.nodeSize,
  };
}

/**
 * Convert border width from eighths of a point to pixels.
 * OOXML stores border widths in eighths of a point.
 */
function borderWidthToPixels(eighthsOfPoint: number): number {
  // 1 point = 1.333 pixels at 96 DPI
  // eighths of a point: divide by 8 first
  return Math.max(1, Math.round((eighthsOfPoint / 8) * 1.333));
}

/**
 * Extract cell borders from ProseMirror attributes.
 */
function extractCellBorders(attrs: Record<string, unknown>): CellBorders | undefined {
  const borders = attrs.borders as Record<string, boolean> | null;
  const borderColors = attrs.borderColors as Record<string, string> | null;
  const borderWidths = attrs.borderWidths as Record<string, number> | null;

  if (!borders && !borderColors && !borderWidths) {
    return undefined;
  }

  const result: CellBorders = {};
  const sides = ['top', 'bottom', 'left', 'right'] as const;

  for (const side of sides) {
    // Check if border is explicitly set (default to true if colors/widths are specified)
    const hasBorder = borders?.[side] !== false;
    const color = borderColors?.[side];
    const width = borderWidths?.[side];

    if (hasBorder && (color || width)) {
      const spec: CellBorderSpec = {
        style: 'solid',
      };
      if (color) spec.color = color.startsWith('#') ? color : `#${color}`;
      if (width) spec.width = borderWidthToPixels(width);
      result[side] = spec;
    } else if (borders?.[side] === false) {
      // Explicitly no border
      result[side] = { width: 0, style: 'none' };
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Convert a table cell node.
 */
function convertTableCell(node: PMNode, startPos: number, options: ToFlowBlocksOptions): TableCell {
  const blocks: FlowBlock[] = [];
  let offset = startPos + 1; // +1 for opening tag

  node.forEach((child) => {
    if (child.type.name === 'paragraph') {
      blocks.push(convertParagraph(child, offset, options));
    } else if (child.type.name === 'table') {
      blocks.push(convertTable(child, offset, options));
    }
    offset += child.nodeSize;
  });

  const attrs = node.attrs;
  return {
    id: nextBlockId(),
    blocks,
    colSpan: attrs.colspan as number,
    rowSpan: attrs.rowspan as number,
    width: attrs.width ? twipsToPixels(attrs.width as number) : undefined,
    verticalAlign: attrs.verticalAlign as 'top' | 'center' | 'bottom' | undefined,
    background: attrs.backgroundColor ? `#${attrs.backgroundColor}` : undefined,
    borders: extractCellBorders(attrs as Record<string, unknown>),
  };
}

/**
 * Convert a table row node.
 */
function convertTableRow(node: PMNode, startPos: number, options: ToFlowBlocksOptions): TableRow {
  const cells: TableCell[] = [];
  let offset = startPos + 1; // +1 for opening tag

  node.forEach((child) => {
    if (child.type.name === 'tableCell' || child.type.name === 'tableHeader') {
      cells.push(convertTableCell(child, offset, options));
    }
    offset += child.nodeSize;
  });

  const attrs = node.attrs;
  return {
    id: nextBlockId(),
    cells,
    height: attrs.height ? twipsToPixels(attrs.height as number) : undefined,
    isHeader: attrs.isHeader as boolean | undefined,
  };
}

/**
 * Convert a table node to a TableBlock.
 */
function convertTable(node: PMNode, startPos: number, options: ToFlowBlocksOptions): TableBlock {
  const rows: TableRow[] = [];
  let offset = startPos + 1; // +1 for opening tag

  node.forEach((child) => {
    if (child.type.name === 'tableRow') {
      rows.push(convertTableRow(child, offset, options));
    }
    offset += child.nodeSize;
  });

  // Extract columnWidths from node attributes and convert from twips to pixels
  const columnWidthsTwips = node.attrs.columnWidths as number[] | undefined;
  const columnWidths = columnWidthsTwips?.map(twipsToPixels);

  return {
    kind: 'table',
    id: nextBlockId(),
    rows,
    columnWidths,
    pmStart: startPos,
    pmEnd: startPos + node.nodeSize,
  };
}

/**
 * Convert an image node to an ImageBlock.
 */
function convertImage(node: PMNode, startPos: number): ImageBlock {
  const attrs = node.attrs;

  return {
    kind: 'image',
    id: nextBlockId(),
    src: attrs.src as string,
    width: (attrs.width as number) || 100,
    height: (attrs.height as number) || 100,
    alt: attrs.alt as string | undefined,
    anchor:
      attrs.wrapType !== 'inline'
        ? {
            isAnchored: true,
            offsetH: attrs.distLeft as number | undefined,
            offsetV: attrs.distTop as number | undefined,
            behindDoc: attrs.wrapType === 'behind',
          }
        : undefined,
    pmStart: startPos,
    pmEnd: startPos + node.nodeSize,
  };
}

/**
 * Convert a ProseMirror document to FlowBlock array.
 *
 * Walks the document tree, converting each node to the appropriate block type.
 * Tracks pmStart/pmEnd positions for each block for click-to-position mapping.
 */
export function toFlowBlocks(doc: PMNode, options: ToFlowBlocksOptions = {}): FlowBlock[] {
  const opts: ToFlowBlocksOptions = {
    defaultFont: options.defaultFont ?? DEFAULT_FONT,
    defaultSize: options.defaultSize ?? DEFAULT_SIZE,
  };

  const blocks: FlowBlock[] = [];
  const offset = 0; // Start at document beginning

  doc.forEach((node, nodeOffset) => {
    const pos = offset + nodeOffset;

    switch (node.type.name) {
      case 'paragraph':
        blocks.push(convertParagraph(node, pos, opts));
        break;

      case 'table':
        blocks.push(convertTable(node, pos, opts));
        break;

      case 'image':
        // Standalone image block (if not inline)
        blocks.push(convertImage(node, pos));
        break;

      case 'horizontalRule':
        // Could be treated as a page break or separator
        const pageBreak: PageBreakBlock = {
          kind: 'pageBreak',
          id: nextBlockId(),
          pmStart: pos,
          pmEnd: pos + node.nodeSize,
        };
        blocks.push(pageBreak);
        break;
    }
  });

  return blocks;
}
