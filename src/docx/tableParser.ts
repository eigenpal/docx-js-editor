/**
 * Table Parser - Parse tables with full OOXML structure
 *
 * OOXML tables consist of:
 * - w:tbl - Table element
 * - w:tblPr - Table properties (width, borders, style)
 * - w:tblGrid - Column width definitions
 * - w:tr - Table rows
 * - w:trPr - Row properties (height, header)
 * - w:tc - Table cells
 * - w:tcPr - Cell properties (width, borders, merge)
 *
 * Cell merging:
 * - Horizontal: w:gridSpan (how many grid columns this cell spans)
 * - Vertical: w:vMerge (restart = start of merge, continue = continuation)
 *
 * OOXML Reference:
 * - w:tbl contains w:tblPr, w:tblGrid, and w:tr elements
 * - w:tr contains w:trPr and w:tc elements
 * - w:tc contains w:tcPr and content (paragraphs, tables)
 */

import type {
  Table,
  TableRow,
  TableCell,
  TableFormatting,
  TableRowFormatting,
  TableCellFormatting,
  TableMeasurement,
  TableWidthType,
  TableBorders,
  TableLook,
  CellMargins,
  FloatingTableProperties,
  ConditionalFormatStyle,
  Paragraph,
  Theme,
  BorderSpec,
  ShadingProperties,
  ColorValue,
  RelationshipMap,
  MediaFile,
} from '../types/document';
import type { StyleMap } from './styleParser';
import type { NumberingMap } from './numberingParser';
import { parseParagraph } from './paragraphParser';
import {
  findChild,
  findChildren,
  getAttribute,
  parseNumericAttribute,
  parseBooleanElement,
  parseColorElement,
  type XmlElement,
} from './xmlParser';

// ============================================================================
// TABLE MEASUREMENT PARSING
// ============================================================================

/**
 * Parse a table measurement (width, height, etc.)
 *
 * @param element - Element with w:w and w:type attributes
 * @returns Parsed measurement or undefined
 */
export function parseTableMeasurement(element: XmlElement | null): TableMeasurement | undefined {
  if (!element) return undefined;

  const value = parseNumericAttribute(element, 'w', 'w') ?? 0;
  const typeStr = getAttribute(element, 'w', 'type') ?? 'dxa';

  let type: TableWidthType = 'dxa';
  if (typeStr === 'auto' || typeStr === 'dxa' || typeStr === 'nil' || typeStr === 'pct') {
    type = typeStr;
  }

  return { value, type };
}

/**
 * Parse width from an element (shorthand for common case)
 */
function parseWidth(element: XmlElement | null): TableMeasurement | undefined {
  return parseTableMeasurement(element);
}

// ============================================================================
// BORDER PARSING
// ============================================================================

/**
 * Parse a single border specification
 *
 * @param element - Border element (w:top, w:bottom, etc.)
 * @returns Parsed border or undefined
 */
export function parseBorderSpec(element: XmlElement | null): BorderSpec | undefined {
  if (!element) return undefined;

  const styleStr = getAttribute(element, 'w', 'val') ?? 'none';
  const style = styleStr as BorderSpec['style'];

  const border: BorderSpec = { style };

  // Size in eighths of a point
  const sz = parseNumericAttribute(element, 'w', 'sz');
  if (sz !== undefined) {
    border.size = sz;
  }

  // Space from text in points
  const space = parseNumericAttribute(element, 'w', 'space');
  if (space !== undefined) {
    border.space = space;
  }

  // Color
  const colorData = parseColorElement(element);
  if (colorData) {
    border.color = {
      rgb: colorData.val,
      themeColor: colorData.themeColor as ColorValue['themeColor'],
      themeTint: colorData.themeTint,
      themeShade: colorData.themeShade,
    };
  }

  // Shadow effect
  const shadow = getAttribute(element, 'w', 'shadow');
  if (shadow === '1' || shadow === 'true') {
    border.shadow = true;
  }

  // Frame effect
  const frame = getAttribute(element, 'w', 'frame');
  if (frame === '1' || frame === 'true') {
    border.frame = true;
  }

  return border;
}

/**
 * Parse table borders (w:tblBorders or w:tcBorders)
 *
 * @param bordersElement - The borders container element
 * @returns Parsed borders or undefined
 */
export function parseTableBorders(bordersElement: XmlElement | null): TableBorders | undefined {
  if (!bordersElement) return undefined;

  const borders: TableBorders = {};

  const top = parseBorderSpec(findChild(bordersElement, 'w', 'top'));
  if (top) borders.top = top;

  const bottom = parseBorderSpec(findChild(bordersElement, 'w', 'bottom'));
  if (bottom) borders.bottom = bottom;

  const left = parseBorderSpec(
    findChild(bordersElement, 'w', 'left') ?? findChild(bordersElement, 'w', 'start')
  );
  if (left) borders.left = left;

  const right = parseBorderSpec(
    findChild(bordersElement, 'w', 'right') ?? findChild(bordersElement, 'w', 'end')
  );
  if (right) borders.right = right;

  const insideH = parseBorderSpec(findChild(bordersElement, 'w', 'insideH'));
  if (insideH) borders.insideH = insideH;

  const insideV = parseBorderSpec(findChild(bordersElement, 'w', 'insideV'));
  if (insideV) borders.insideV = insideV;

  // Return undefined if no borders were parsed
  if (Object.keys(borders).length === 0) return undefined;

  return borders;
}

// ============================================================================
// CELL MARGINS PARSING
// ============================================================================

/**
 * Parse cell margins (w:tblCellMar or w:tcMar)
 *
 * @param marginsElement - The margins container element
 * @returns Parsed margins or undefined
 */
export function parseCellMargins(marginsElement: XmlElement | null): CellMargins | undefined {
  if (!marginsElement) return undefined;

  const margins: CellMargins = {};

  const top = parseWidth(findChild(marginsElement, 'w', 'top'));
  if (top) margins.top = top;

  const bottom = parseWidth(findChild(marginsElement, 'w', 'bottom'));
  if (bottom) margins.bottom = bottom;

  const left = parseWidth(
    findChild(marginsElement, 'w', 'left') ?? findChild(marginsElement, 'w', 'start')
  );
  if (left) margins.left = left;

  const right = parseWidth(
    findChild(marginsElement, 'w', 'right') ?? findChild(marginsElement, 'w', 'end')
  );
  if (right) margins.right = right;

  if (Object.keys(margins).length === 0) return undefined;

  return margins;
}

// ============================================================================
// SHADING PARSING
// ============================================================================

/**
 * Parse shading properties (w:shd)
 *
 * @param shdElement - The w:shd element
 * @returns Parsed shading or undefined
 */
export function parseShading(shdElement: XmlElement | null): ShadingProperties | undefined {
  if (!shdElement) return undefined;

  const shading: ShadingProperties = {};

  // Fill color (background)
  const fillStr = getAttribute(shdElement, 'w', 'fill');
  if (fillStr && fillStr !== 'auto') {
    shading.fill = { rgb: fillStr };
  }

  // Theme fill
  const themeFill = getAttribute(shdElement, 'w', 'themeFill');
  if (themeFill) {
    shading.fill = { themeColor: themeFill as any };

    const themeFillTint = getAttribute(shdElement, 'w', 'themeFillTint');
    if (themeFillTint && shading.fill) {
      shading.fill.themeTint = themeFillTint;
    }

    const themeFillShade = getAttribute(shdElement, 'w', 'themeFillShade');
    if (themeFillShade && shading.fill) {
      shading.fill.themeShade = themeFillShade;
    }
  }

  // Pattern color
  const colorStr = getAttribute(shdElement, 'w', 'color');
  if (colorStr && colorStr !== 'auto') {
    shading.color = { rgb: colorStr };
  }

  // Pattern value
  const pattern = getAttribute(shdElement, 'w', 'val');
  if (pattern) {
    shading.pattern = pattern as ShadingProperties['pattern'];
  }

  if (Object.keys(shading).length === 0) return undefined;

  return shading;
}

// ============================================================================
// TABLE LOOK PARSING
// ============================================================================

/**
 * Parse table look flags (w:tblLook)
 *
 * @param lookElement - The w:tblLook element
 * @returns Parsed table look or undefined
 */
export function parseTableLook(lookElement: XmlElement | null): TableLook | undefined {
  if (!lookElement) return undefined;

  const look: TableLook = {};

  // Parse individual flags
  const firstRow = getAttribute(lookElement, 'w', 'firstRow');
  if (firstRow === '1' || firstRow === 'true') look.firstRow = true;

  const lastRow = getAttribute(lookElement, 'w', 'lastRow');
  if (lastRow === '1' || lastRow === 'true') look.lastRow = true;

  const firstColumn = getAttribute(lookElement, 'w', 'firstColumn');
  if (firstColumn === '1' || firstColumn === 'true') look.firstColumn = true;

  const lastColumn = getAttribute(lookElement, 'w', 'lastColumn');
  if (lastColumn === '1' || lastColumn === 'true') look.lastColumn = true;

  const noHBand = getAttribute(lookElement, 'w', 'noHBand');
  if (noHBand === '1' || noHBand === 'true') look.noHBand = true;

  const noVBand = getAttribute(lookElement, 'w', 'noVBand');
  if (noVBand === '1' || noVBand === 'true') look.noVBand = true;

  // Also check for the val attribute (hexadecimal flags)
  const val = getAttribute(lookElement, 'w', 'val');
  if (val) {
    const flags = parseInt(val, 16);
    if (!isNaN(flags)) {
      if (flags & 0x0020) look.firstRow = true;
      if (flags & 0x0040) look.lastRow = true;
      if (flags & 0x0080) look.firstColumn = true;
      if (flags & 0x0100) look.lastColumn = true;
      if (flags & 0x0200) look.noHBand = true;
      if (flags & 0x0400) look.noVBand = true;
    }
  }

  if (Object.keys(look).length === 0) return undefined;

  return look;
}

// ============================================================================
// FLOATING TABLE PROPERTIES
// ============================================================================

/**
 * Parse floating table properties (w:tblpPr)
 *
 * @param tblpPrElement - The w:tblpPr element
 * @returns Parsed floating properties or undefined
 */
export function parseFloatingTableProperties(
  tblpPrElement: XmlElement | null
): FloatingTableProperties | undefined {
  if (!tblpPrElement) return undefined;

  const floating: FloatingTableProperties = {};

  // Horizontal anchor
  const horzAnchor = getAttribute(tblpPrElement, 'w', 'horzAnchor');
  if (horzAnchor === 'margin' || horzAnchor === 'page' || horzAnchor === 'text') {
    floating.horzAnchor = horzAnchor;
  }

  // Vertical anchor
  const vertAnchor = getAttribute(tblpPrElement, 'w', 'vertAnchor');
  if (vertAnchor === 'margin' || vertAnchor === 'page' || vertAnchor === 'text') {
    floating.vertAnchor = vertAnchor;
  }

  // Horizontal position
  const tblpX = parseNumericAttribute(tblpPrElement, 'w', 'tblpX');
  if (tblpX !== undefined) floating.tblpX = tblpX;

  const tblpXSpec = getAttribute(tblpPrElement, 'w', 'tblpXSpec');
  if (tblpXSpec) {
    floating.tblpXSpec = tblpXSpec as FloatingTableProperties['tblpXSpec'];
  }

  // Vertical position
  const tblpY = parseNumericAttribute(tblpPrElement, 'w', 'tblpY');
  if (tblpY !== undefined) floating.tblpY = tblpY;

  const tblpYSpec = getAttribute(tblpPrElement, 'w', 'tblpYSpec');
  if (tblpYSpec) {
    floating.tblpYSpec = tblpYSpec as FloatingTableProperties['tblpYSpec'];
  }

  // Distance from text
  const topFromText = parseNumericAttribute(tblpPrElement, 'w', 'topFromText');
  if (topFromText !== undefined) floating.topFromText = topFromText;

  const bottomFromText = parseNumericAttribute(tblpPrElement, 'w', 'bottomFromText');
  if (bottomFromText !== undefined) floating.bottomFromText = bottomFromText;

  const leftFromText = parseNumericAttribute(tblpPrElement, 'w', 'leftFromText');
  if (leftFromText !== undefined) floating.leftFromText = leftFromText;

  const rightFromText = parseNumericAttribute(tblpPrElement, 'w', 'rightFromText');
  if (rightFromText !== undefined) floating.rightFromText = rightFromText;

  if (Object.keys(floating).length === 0) return undefined;

  return floating;
}

// ============================================================================
// TABLE PROPERTIES PARSING (w:tblPr)
// ============================================================================

/**
 * Parse table properties (w:tblPr)
 *
 * @param tblPrElement - The w:tblPr element
 * @returns Parsed table formatting
 */
export function parseTableProperties(tblPrElement: XmlElement | null): TableFormatting | undefined {
  if (!tblPrElement) return undefined;

  const formatting: TableFormatting = {};

  // Table width (w:tblW)
  const width = parseWidth(findChild(tblPrElement, 'w', 'tblW'));
  if (width) formatting.width = width;

  // Table justification (w:jc)
  const jcElement = findChild(tblPrElement, 'w', 'jc');
  if (jcElement) {
    const jcVal = getAttribute(jcElement, 'w', 'val');
    if (jcVal === 'left' || jcVal === 'center' || jcVal === 'right' || jcVal === 'start') {
      formatting.justification = jcVal === 'start' ? 'left' : jcVal;
    }
  }

  // Cell spacing (w:tblCellSpacing)
  const cellSpacing = parseWidth(findChild(tblPrElement, 'w', 'tblCellSpacing'));
  if (cellSpacing) formatting.cellSpacing = cellSpacing;

  // Table indent (w:tblInd)
  const indent = parseWidth(findChild(tblPrElement, 'w', 'tblInd'));
  if (indent) formatting.indent = indent;

  // Table borders (w:tblBorders)
  const borders = parseTableBorders(findChild(tblPrElement, 'w', 'tblBorders'));
  if (borders) formatting.borders = borders;

  // Default cell margins (w:tblCellMar)
  const cellMargins = parseCellMargins(findChild(tblPrElement, 'w', 'tblCellMar'));
  if (cellMargins) formatting.cellMargins = cellMargins;

  // Table layout (w:tblLayout)
  const layoutElement = findChild(tblPrElement, 'w', 'tblLayout');
  if (layoutElement) {
    const layoutVal = getAttribute(layoutElement, 'w', 'type');
    if (layoutVal === 'fixed' || layoutVal === 'autofit') {
      formatting.layout = layoutVal;
    }
  }

  // Table style (w:tblStyle)
  const styleElement = findChild(tblPrElement, 'w', 'tblStyle');
  if (styleElement) {
    const styleId = getAttribute(styleElement, 'w', 'val');
    if (styleId) formatting.styleId = styleId;
  }

  // Table look (w:tblLook)
  const look = parseTableLook(findChild(tblPrElement, 'w', 'tblLook'));
  if (look) formatting.look = look;

  // Shading (w:shd)
  const shading = parseShading(findChild(tblPrElement, 'w', 'shd'));
  if (shading) formatting.shading = shading;

  // Table overlap (w:tblOverlap)
  const overlapElement = findChild(tblPrElement, 'w', 'tblOverlap');
  if (overlapElement) {
    const overlapVal = getAttribute(overlapElement, 'w', 'val');
    if (overlapVal === 'never' || overlapVal === 'overlap') {
      formatting.overlap = overlapVal;
    }
  }

  // Floating table (w:tblpPr)
  const floating = parseFloatingTableProperties(findChild(tblPrElement, 'w', 'tblpPr'));
  if (floating) formatting.floating = floating;

  // Bidirectional (w:bidiVisual)
  const bidi = parseBooleanElement(findChild(tblPrElement, 'w', 'bidiVisual'));
  if (bidi) formatting.bidi = true;

  if (Object.keys(formatting).length === 0) return undefined;

  return formatting;
}

// ============================================================================
// TABLE ROW PROPERTIES PARSING (w:trPr)
// ============================================================================

/**
 * Parse table row properties (w:trPr)
 *
 * @param trPrElement - The w:trPr element
 * @returns Parsed row formatting
 */
export function parseTableRowProperties(
  trPrElement: XmlElement | null
): TableRowFormatting | undefined {
  if (!trPrElement) return undefined;

  const formatting: TableRowFormatting = {};

  // Row height (w:trHeight)
  const heightElement = findChild(trPrElement, 'w', 'trHeight');
  if (heightElement) {
    const height = parseWidth(heightElement);
    if (height) formatting.height = height;

    const hRule = getAttribute(heightElement, 'w', 'hRule');
    if (hRule === 'auto' || hRule === 'atLeast' || hRule === 'exact') {
      formatting.heightRule = hRule;
    }
  }

  // Header row (w:tblHeader)
  const header = parseBooleanElement(findChild(trPrElement, 'w', 'tblHeader'));
  if (header) formatting.header = true;

  // Can't split (w:cantSplit)
  const cantSplit = parseBooleanElement(findChild(trPrElement, 'w', 'cantSplit'));
  if (cantSplit) formatting.cantSplit = true;

  // Row justification (w:jc)
  const jcElement = findChild(trPrElement, 'w', 'jc');
  if (jcElement) {
    const jcVal = getAttribute(jcElement, 'w', 'val');
    if (jcVal === 'left' || jcVal === 'center' || jcVal === 'right') {
      formatting.justification = jcVal;
    }
  }

  // Hidden row (w:hidden)
  const hidden = parseBooleanElement(findChild(trPrElement, 'w', 'hidden'));
  if (hidden) formatting.hidden = true;

  if (Object.keys(formatting).length === 0) return undefined;

  return formatting;
}

// ============================================================================
// TABLE CELL PROPERTIES PARSING (w:tcPr)
// ============================================================================

/**
 * Parse conditional format style (for table style conditional formatting)
 *
 * @param cnfElement - The w:cnfStyle element
 * @returns Parsed conditional format or undefined
 */
export function parseConditionalFormatStyle(
  cnfElement: XmlElement | null
): ConditionalFormatStyle | undefined {
  if (!cnfElement) return undefined;

  const style: ConditionalFormatStyle = {};

  // Parse individual flags
  const firstRow = getAttribute(cnfElement, 'w', 'firstRow');
  if (firstRow === '1' || firstRow === 'true') style.firstRow = true;

  const lastRow = getAttribute(cnfElement, 'w', 'lastRow');
  if (lastRow === '1' || lastRow === 'true') style.lastRow = true;

  const firstColumn = getAttribute(cnfElement, 'w', 'firstColumn');
  if (firstColumn === '1' || firstColumn === 'true') style.firstColumn = true;

  const lastColumn = getAttribute(cnfElement, 'w', 'lastColumn');
  if (lastColumn === '1' || lastColumn === 'true') style.lastColumn = true;

  const oddHBand = getAttribute(cnfElement, 'w', 'oddHBand');
  if (oddHBand === '1' || oddHBand === 'true') style.oddHBand = true;

  const evenHBand = getAttribute(cnfElement, 'w', 'evenHBand');
  if (evenHBand === '1' || evenHBand === 'true') style.evenHBand = true;

  const oddVBand = getAttribute(cnfElement, 'w', 'oddVBand');
  if (oddVBand === '1' || oddVBand === 'true') style.oddVBand = true;

  const evenVBand = getAttribute(cnfElement, 'w', 'evenVBand');
  if (evenVBand === '1' || evenVBand === 'true') style.evenVBand = true;

  // Corner cells
  const nwCell = getAttribute(cnfElement, 'w', 'firstRowFirstColumn');
  if (nwCell === '1' || nwCell === 'true') style.nwCell = true;

  const neCell = getAttribute(cnfElement, 'w', 'firstRowLastColumn');
  if (neCell === '1' || neCell === 'true') style.neCell = true;

  const swCell = getAttribute(cnfElement, 'w', 'lastRowFirstColumn');
  if (swCell === '1' || swCell === 'true') style.swCell = true;

  const seCell = getAttribute(cnfElement, 'w', 'lastRowLastColumn');
  if (seCell === '1' || seCell === 'true') style.seCell = true;

  // Also check for the val attribute (binary flags string)
  const val = getAttribute(cnfElement, 'w', 'val');
  if (val && val.length === 12) {
    // Binary string format: XXXXXXXXXXXXXX
    // Position meanings from left to right
    if (val[0] === '1') style.firstRow = true;
    if (val[1] === '1') style.lastRow = true;
    if (val[2] === '1') style.firstColumn = true;
    if (val[3] === '1') style.lastColumn = true;
    if (val[4] === '1') style.oddVBand = true;
    if (val[5] === '1') style.evenVBand = true;
    if (val[6] === '1') style.oddHBand = true;
    if (val[7] === '1') style.evenHBand = true;
    if (val[8] === '1') style.nwCell = true;
    if (val[9] === '1') style.neCell = true;
    if (val[10] === '1') style.swCell = true;
    if (val[11] === '1') style.seCell = true;
  }

  if (Object.keys(style).length === 0) return undefined;

  return style;
}

/**
 * Parse table cell properties (w:tcPr)
 *
 * @param tcPrElement - The w:tcPr element
 * @returns Parsed cell formatting
 */
export function parseTableCellProperties(
  tcPrElement: XmlElement | null
): TableCellFormatting | undefined {
  if (!tcPrElement) return undefined;

  const formatting: TableCellFormatting = {};

  // Cell width (w:tcW)
  const width = parseWidth(findChild(tcPrElement, 'w', 'tcW'));
  if (width) formatting.width = width;

  // Cell borders (w:tcBorders)
  const borders = parseTableBorders(findChild(tcPrElement, 'w', 'tcBorders'));
  if (borders) formatting.borders = borders;

  // Cell margins (w:tcMar)
  const margins = parseCellMargins(findChild(tcPrElement, 'w', 'tcMar'));
  if (margins) formatting.margins = margins;

  // Shading (w:shd)
  const shading = parseShading(findChild(tcPrElement, 'w', 'shd'));
  if (shading) formatting.shading = shading;

  // Vertical alignment (w:vAlign)
  const vAlignElement = findChild(tcPrElement, 'w', 'vAlign');
  if (vAlignElement) {
    const vAlign = getAttribute(vAlignElement, 'w', 'val');
    if (vAlign === 'top' || vAlign === 'center' || vAlign === 'bottom') {
      formatting.verticalAlign = vAlign;
    }
  }

  // Text direction (w:textDirection)
  const textDirElement = findChild(tcPrElement, 'w', 'textDirection');
  if (textDirElement) {
    const textDir = getAttribute(textDirElement, 'w', 'val');
    if (textDir) {
      formatting.textDirection = textDir as TableCellFormatting['textDirection'];
    }
  }

  // Grid span (horizontal merge) (w:gridSpan)
  const gridSpanElement = findChild(tcPrElement, 'w', 'gridSpan');
  if (gridSpanElement) {
    const gridSpan = parseNumericAttribute(gridSpanElement, 'w', 'val');
    if (gridSpan !== undefined && gridSpan > 1) {
      formatting.gridSpan = gridSpan;
    }
  }

  // Vertical merge (w:vMerge)
  const vMergeElement = findChild(tcPrElement, 'w', 'vMerge');
  if (vMergeElement) {
    const vMergeVal = getAttribute(vMergeElement, 'w', 'val');
    if (vMergeVal === 'restart') {
      formatting.vMerge = 'restart';
    } else {
      // No val attribute or val="continue" means continuation
      formatting.vMerge = 'continue';
    }
  }

  // Fit text (w:tcFitText)
  const fitText = parseBooleanElement(findChild(tcPrElement, 'w', 'tcFitText'));
  if (fitText) formatting.fitText = true;

  // No wrap (w:noWrap)
  const noWrap = parseBooleanElement(findChild(tcPrElement, 'w', 'noWrap'));
  if (noWrap) formatting.noWrap = true;

  // Hide mark (w:hideMark)
  const hideMark = parseBooleanElement(findChild(tcPrElement, 'w', 'hideMark'));
  if (hideMark) formatting.hideMark = true;

  // Conditional format style (w:cnfStyle)
  const conditionalFormat = parseConditionalFormatStyle(findChild(tcPrElement, 'w', 'cnfStyle'));
  if (conditionalFormat) formatting.conditionalFormat = conditionalFormat;

  if (Object.keys(formatting).length === 0) return undefined;

  return formatting;
}

// ============================================================================
// CELL CONTENT PARSING
// ============================================================================

/**
 * Parse table cell content (paragraphs, nested tables)
 *
 * @param tcElement - The w:tc element
 * @param styles - Style definitions
 * @param theme - Theme for color/font resolution
 * @param numbering - Numbering definitions for lists
 * @param rels - Relationships for hyperlinks
 * @param media - Media files for images
 * @returns Array of content blocks
 */
function parseCellContent(
  tcElement: XmlElement,
  styles: StyleMap | null,
  theme: Theme | null,
  numbering: NumberingMap | null,
  rels: RelationshipMap | null,
  media: Map<string, MediaFile> | null
): (Paragraph | Table)[] {
  const content: (Paragraph | Table)[] = [];

  // Get all child elements
  const elements = tcElement.elements || [];

  for (const child of elements) {
    if (!child.name) continue;

    const localName = child.name.split(':').pop();

    if (localName === 'p') {
      // Parse paragraph
      const para = parseParagraph(child, styles, theme, numbering, rels, media);
      content.push(para);
    } else if (localName === 'tbl') {
      // Parse nested table (recursive)
      const table = parseTable(child, styles, theme, numbering, rels, media);
      content.push(table);
    }
    // Other content types in cells are rare but could be added
  }

  // Ensure at least one empty paragraph (Word requires this)
  if (content.length === 0) {
    content.push({
      type: 'paragraph',
      content: [],
    });
  }

  return content;
}

// ============================================================================
// TABLE CELL PARSING
// ============================================================================

/**
 * Parse a table cell (w:tc)
 *
 * @param tcElement - The w:tc element
 * @param styles - Style definitions
 * @param theme - Theme for color/font resolution
 * @param numbering - Numbering definitions for lists
 * @param rels - Relationships for hyperlinks
 * @param media - Media files for images
 * @returns Parsed table cell
 */
export function parseTableCell(
  tcElement: XmlElement,
  styles: StyleMap | null,
  theme: Theme | null,
  numbering: NumberingMap | null,
  rels: RelationshipMap | null,
  media: Map<string, MediaFile> | null
): TableCell {
  const cell: TableCell = {
    type: 'tableCell',
    content: [],
  };

  // Parse cell properties (w:tcPr)
  const formatting = parseTableCellProperties(findChild(tcElement, 'w', 'tcPr'));
  if (formatting) {
    cell.formatting = formatting;
  }

  // Parse content
  cell.content = parseCellContent(tcElement, styles, theme, numbering, rels, media);

  return cell;
}

// ============================================================================
// TABLE ROW PARSING
// ============================================================================

/**
 * Parse a table row (w:tr)
 *
 * @param trElement - The w:tr element
 * @param styles - Style definitions
 * @param theme - Theme for color/font resolution
 * @param numbering - Numbering definitions for lists
 * @param rels - Relationships for hyperlinks
 * @param media - Media files for images
 * @returns Parsed table row
 */
export function parseTableRow(
  trElement: XmlElement,
  styles: StyleMap | null,
  theme: Theme | null,
  numbering: NumberingMap | null,
  rels: RelationshipMap | null,
  media: Map<string, MediaFile> | null
): TableRow {
  const row: TableRow = {
    type: 'tableRow',
    cells: [],
  };

  // Parse row properties (w:trPr)
  const formatting = parseTableRowProperties(findChild(trElement, 'w', 'trPr'));
  if (formatting) {
    row.formatting = formatting;
  }

  // Parse cells
  const cells = findChildren(trElement, 'w', 'tc');
  for (const cellElement of cells) {
    const cell = parseTableCell(cellElement, styles, theme, numbering, rels, media);
    row.cells.push(cell);
  }

  return row;
}

// ============================================================================
// TABLE GRID PARSING
// ============================================================================

/**
 * Parse table grid (w:tblGrid) for column widths
 *
 * @param tblGridElement - The w:tblGrid element
 * @returns Array of column widths in twips
 */
export function parseTableGrid(tblGridElement: XmlElement | null): number[] | undefined {
  if (!tblGridElement) return undefined;

  const widths: number[] = [];

  const gridCols = findChildren(tblGridElement, 'w', 'gridCol');
  for (const col of gridCols) {
    const width = parseNumericAttribute(col, 'w', 'w') ?? 0;
    widths.push(width);
  }

  return widths.length > 0 ? widths : undefined;
}

// ============================================================================
// MAIN TABLE PARSING
// ============================================================================

/**
 * Parse a table element (w:tbl)
 *
 * @param tblElement - The w:tbl element
 * @param styles - Style definitions
 * @param theme - Theme for color/font resolution
 * @param numbering - Numbering definitions for lists
 * @param rels - Relationships for hyperlinks
 * @param media - Media files for images
 * @returns Parsed table
 */
export function parseTable(
  tblElement: XmlElement,
  styles: StyleMap | null,
  theme: Theme | null,
  numbering: NumberingMap | null,
  rels: RelationshipMap | null,
  media: Map<string, MediaFile> | null
): Table {
  const table: Table = {
    type: 'table',
    rows: [],
  };

  // Parse table properties (w:tblPr)
  const formatting = parseTableProperties(findChild(tblElement, 'w', 'tblPr'));
  if (formatting) {
    table.formatting = formatting;
  }

  // Parse table grid (w:tblGrid)
  const columnWidths = parseTableGrid(findChild(tblElement, 'w', 'tblGrid'));
  if (columnWidths) {
    table.columnWidths = columnWidths;
  }

  // Parse rows
  const rows = findChildren(tblElement, 'w', 'tr');
  for (const rowElement of rows) {
    const row = parseTableRow(rowElement, styles, theme, numbering, rels, media);
    table.rows.push(row);
  }

  return table;
}

// ============================================================================
// TABLE UTILITIES
// ============================================================================

/**
 * Get the number of columns in a table
 *
 * Uses the table grid if available, otherwise counts cells in first row.
 *
 * @param table - The table to measure
 * @returns Number of columns
 */
export function getTableColumnCount(table: Table): number {
  if (table.columnWidths && table.columnWidths.length > 0) {
    return table.columnWidths.length;
  }

  if (table.rows.length === 0) return 0;

  // Count cells in first row, accounting for grid span
  return table.rows[0].cells.reduce((count, cell) => {
    return count + (cell.formatting?.gridSpan ?? 1);
  }, 0);
}

/**
 * Get the number of rows in a table
 *
 * @param table - The table to measure
 * @returns Number of rows
 */
export function getTableRowCount(table: Table): number {
  return table.rows.length;
}

/**
 * Check if a cell is part of a vertical merge
 *
 * @param cell - The cell to check
 * @returns true if cell continues a vertical merge
 */
export function isCellMergeContinuation(cell: TableCell): boolean {
  return cell.formatting?.vMerge === 'continue';
}

/**
 * Check if a cell starts a vertical merge
 *
 * @param cell - The cell to check
 * @returns true if cell starts a vertical merge
 */
export function isCellMergeStart(cell: TableCell): boolean {
  return cell.formatting?.vMerge === 'restart';
}

/**
 * Check if a cell spans multiple columns
 *
 * @param cell - The cell to check
 * @returns true if cell spans multiple columns
 */
export function isCellHorizontallyMerged(cell: TableCell): boolean {
  return (cell.formatting?.gridSpan ?? 1) > 1;
}

/**
 * Get the plain text content of a table
 *
 * @param table - The table to extract text from
 * @returns Plain text content
 */
export function getTableText(table: Table): string {
  const rows: string[] = [];

  for (const row of table.rows) {
    const cells: string[] = [];

    for (const cell of row.cells) {
      const cellText = cell.content
        .filter((c): c is Paragraph => c.type === 'paragraph')
        .map((p) => getParagraphText(p))
        .join('\n');
      cells.push(cellText);
    }

    rows.push(cells.join('\t'));
  }

  return rows.join('\n');
}

/**
 * Helper to get paragraph text (simplified)
 */
function getParagraphText(para: Paragraph): string {
  return para.content
    .filter((c) => 'content' in c)
    .flatMap((run) => {
      if (!('content' in run)) return [];
      return (run as any).content.filter((c: any) => c.type === 'text').map((c: any) => c.text);
    })
    .join('');
}

/**
 * Check if table has header row
 *
 * @param table - The table to check
 * @returns true if first row is marked as header
 */
export function hasHeaderRow(table: Table): boolean {
  if (table.rows.length === 0) return false;
  return table.rows[0].formatting?.header === true;
}

/**
 * Get all header rows from a table
 *
 * @param table - The table to search
 * @returns Array of header rows
 */
export function getHeaderRows(table: Table): TableRow[] {
  return table.rows.filter((row) => row.formatting?.header === true);
}

/**
 * Check if table is a floating table
 *
 * @param table - The table to check
 * @returns true if table has floating properties
 */
export function isFloatingTable(table: Table): boolean {
  return table.formatting?.floating !== undefined;
}
