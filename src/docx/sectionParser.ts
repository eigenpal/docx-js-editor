/**
 * Section Properties Parser - Parse section properties (w:sectPr)
 *
 * Section properties define page layout and settings for a section of the document.
 * They appear in two places:
 * 1. Within a paragraph's properties (w:p/w:pPr/w:sectPr) - marks end of a section
 * 2. At the end of the document body (w:body/w:sectPr) - final section properties
 *
 * OOXML Reference:
 * - w:pgSz: Page size (width, height, orientation)
 * - w:pgMar: Page margins (top, bottom, left, right, header, footer, gutter)
 * - w:cols: Column definitions
 * - w:type: Section start type
 * - w:vAlign: Vertical alignment
 * - w:headerReference, w:footerReference: Header/footer references
 * - w:titlePg: Different first page
 * - w:lnNumType: Line numbering
 * - w:pgBorders: Page borders
 * - w:docGrid: Document grid
 * - w:footnotePr, w:endnotePr: Footnote/endnote properties
 */

import type {
  SectionProperties,
  PageOrientation,
  SectionStart,
  VerticalAlign,
  LineNumberRestart,
  Column,
  BorderSpec,
  ColorValue,
  ThemeColorSlot,
  RelationshipMap,
} from '../types/document';
import {
  findChild,
  findChildren,
  getAttribute,
  parseNumericAttribute,
  parseBooleanElement,
  type XmlElement,
} from './xmlParser';
import { parseHeaderReference, parseFooterReference } from './headerFooterParser';
import { parseFootnoteProperties, parseEndnoteProperties } from './footnoteParser';

// ============================================================================
// HELPER PARSERS
// ============================================================================

/**
 * Parse a color element/attribute for page borders/background
 */
function parseColorValue(
  colorStr: string | null,
  themeColor: string | null,
  themeTint: string | null,
  themeShade: string | null
): ColorValue | undefined {
  if (!colorStr && !themeColor) return undefined;

  const color: ColorValue = {};

  if (colorStr && colorStr !== 'auto') {
    color.rgb = colorStr;
  } else if (colorStr === 'auto') {
    color.auto = true;
  }

  if (themeColor) {
    color.themeColor = themeColor as ThemeColorSlot;
  }
  if (themeTint) {
    color.themeTint = themeTint;
  }
  if (themeShade) {
    color.themeShade = themeShade;
  }

  return Object.keys(color).length > 0 ? color : undefined;
}

/**
 * Parse a border element for page borders
 */
function parseBorderSpec(element: XmlElement | null): BorderSpec | undefined {
  if (!element) return undefined;

  const styleStr = getAttribute(element, 'w', 'val') ?? 'none';
  const style = styleStr as BorderSpec['style'];

  const border: BorderSpec = { style };

  // Size in eighths of a point
  const sz = parseNumericAttribute(element, 'w', 'sz');
  if (sz !== undefined) {
    border.size = sz;
  }

  // Space from text/page edge in points
  const space = parseNumericAttribute(element, 'w', 'space');
  if (space !== undefined) {
    border.space = space;
  }

  // Color
  const colorVal = getAttribute(element, 'w', 'color');
  const themeColor = getAttribute(element, 'w', 'themeColor');
  const themeTint = getAttribute(element, 'w', 'themeTint');
  const themeShade = getAttribute(element, 'w', 'themeShade');
  const color = parseColorValue(colorVal, themeColor, themeTint, themeShade);
  if (color) {
    border.color = color;
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
 * Parse page orientation
 */
function parseOrientation(orient: string | null): PageOrientation | undefined {
  switch (orient) {
    case 'landscape':
      return 'landscape';
    case 'portrait':
      return 'portrait';
    default:
      return undefined;
  }
}

/**
 * Parse section start type
 */
function parseSectionStart(type: string | null): SectionStart | undefined {
  switch (type) {
    case 'continuous':
      return 'continuous';
    case 'nextPage':
      return 'nextPage';
    case 'oddPage':
      return 'oddPage';
    case 'evenPage':
      return 'evenPage';
    case 'nextColumn':
      return 'nextColumn';
    default:
      return undefined;
  }
}

/**
 * Parse vertical alignment
 */
function parseVerticalAlign(align: string | null): VerticalAlign | undefined {
  switch (align) {
    case 'top':
      return 'top';
    case 'center':
      return 'center';
    case 'both':
      return 'both';
    case 'bottom':
      return 'bottom';
    default:
      return undefined;
  }
}

/**
 * Parse line number restart type
 */
function parseLineNumberRestart(restart: string | null): LineNumberRestart | undefined {
  switch (restart) {
    case 'continuous':
      return 'continuous';
    case 'newPage':
      return 'newPage';
    case 'newSection':
      return 'newSection';
    default:
      return undefined;
  }
}

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse section properties (w:sectPr)
 *
 * @param sectPr - The w:sectPr element
 * @param rels - Optional relationships for resolving header/footer references
 * @returns SectionProperties object
 */
export function parseSectionProperties(
  sectPr: XmlElement | null,
  _rels?: RelationshipMap | null
): SectionProperties {
  const props: SectionProperties = {};

  if (!sectPr) return props;

  // ============================================================================
  // PAGE SIZE (w:pgSz)
  // ============================================================================
  const pgSz = findChild(sectPr, 'w', 'pgSz');
  if (pgSz) {
    // Width in twips
    const w = parseNumericAttribute(pgSz, 'w', 'w');
    if (w !== undefined) {
      props.pageWidth = w;
    }

    // Height in twips
    const h = parseNumericAttribute(pgSz, 'w', 'h');
    if (h !== undefined) {
      props.pageHeight = h;
    }

    // Orientation
    const orient = getAttribute(pgSz, 'w', 'orient');
    const orientation = parseOrientation(orient);
    if (orientation) {
      props.orientation = orientation;
    }
  }

  // ============================================================================
  // PAGE MARGINS (w:pgMar)
  // ============================================================================
  const pgMar = findChild(sectPr, 'w', 'pgMar');
  if (pgMar) {
    // Top margin in twips
    const top = parseNumericAttribute(pgMar, 'w', 'top');
    if (top !== undefined) {
      props.marginTop = top;
    }

    // Bottom margin in twips
    const bottom = parseNumericAttribute(pgMar, 'w', 'bottom');
    if (bottom !== undefined) {
      props.marginBottom = bottom;
    }

    // Left margin in twips
    const left = parseNumericAttribute(pgMar, 'w', 'left');
    if (left !== undefined) {
      props.marginLeft = left;
    }

    // Right margin in twips
    const right = parseNumericAttribute(pgMar, 'w', 'right');
    if (right !== undefined) {
      props.marginRight = right;
    }

    // Header distance from top in twips
    const header = parseNumericAttribute(pgMar, 'w', 'header');
    if (header !== undefined) {
      props.headerDistance = header;
    }

    // Footer distance from bottom in twips
    const footer = parseNumericAttribute(pgMar, 'w', 'footer');
    if (footer !== undefined) {
      props.footerDistance = footer;
    }

    // Gutter margin in twips
    const gutter = parseNumericAttribute(pgMar, 'w', 'gutter');
    if (gutter !== undefined) {
      props.gutter = gutter;
    }
  }

  // ============================================================================
  // COLUMNS (w:cols)
  // ============================================================================
  const cols = findChild(sectPr, 'w', 'cols');
  if (cols) {
    // Number of columns
    const num = parseNumericAttribute(cols, 'w', 'num');
    if (num !== undefined) {
      props.columnCount = num;
    }

    // Space between columns in twips
    const space = parseNumericAttribute(cols, 'w', 'space');
    if (space !== undefined) {
      props.columnSpace = space;
    }

    // Equal width
    const equalWidth = getAttribute(cols, 'w', 'equalWidth');
    if (equalWidth === '1' || equalWidth === 'true') {
      props.equalWidth = true;
    } else if (equalWidth === '0' || equalWidth === 'false') {
      props.equalWidth = false;
    }

    // Separator line between columns
    const sep = getAttribute(cols, 'w', 'sep');
    if (sep === '1' || sep === 'true') {
      props.separator = true;
    }

    // Individual column definitions (w:col)
    const colElements = findChildren(cols, 'w', 'col');
    if (colElements.length > 0) {
      props.columns = [];
      for (const colEl of colElements) {
        const column: Column = {};

        const colWidth = parseNumericAttribute(colEl, 'w', 'w');
        if (colWidth !== undefined) {
          column.width = colWidth;
        }

        const colSpace = parseNumericAttribute(colEl, 'w', 'space');
        if (colSpace !== undefined) {
          column.space = colSpace;
        }

        props.columns.push(column);
      }
    }
  }

  // ============================================================================
  // SECTION TYPE (w:type)
  // ============================================================================
  const typeEl = findChild(sectPr, 'w', 'type');
  if (typeEl) {
    const val = getAttribute(typeEl, 'w', 'val');
    const sectionStart = parseSectionStart(val);
    if (sectionStart) {
      props.sectionStart = sectionStart;
    }
  }

  // ============================================================================
  // VERTICAL ALIGNMENT (w:vAlign)
  // ============================================================================
  const vAlign = findChild(sectPr, 'w', 'vAlign');
  if (vAlign) {
    const val = getAttribute(vAlign, 'w', 'val');
    const verticalAlign = parseVerticalAlign(val);
    if (verticalAlign) {
      props.verticalAlign = verticalAlign;
    }
  }

  // ============================================================================
  // BIDIRECTIONAL (w:bidi)
  // ============================================================================
  const bidi = findChild(sectPr, 'w', 'bidi');
  if (bidi) {
    props.bidi = parseBooleanElement(bidi);
  }

  // ============================================================================
  // HEADER REFERENCES (w:headerReference)
  // ============================================================================
  const headerRefs = findChildren(sectPr, 'w', 'headerReference');
  if (headerRefs.length > 0) {
    props.headerReferences = headerRefs.map((el) => parseHeaderReference(el));
  }

  // ============================================================================
  // FOOTER REFERENCES (w:footerReference)
  // ============================================================================
  const footerRefs = findChildren(sectPr, 'w', 'footerReference');
  if (footerRefs.length > 0) {
    props.footerReferences = footerRefs.map((el) => parseFooterReference(el));
  }

  // ============================================================================
  // TITLE PAGE / DIFFERENT FIRST PAGE (w:titlePg)
  // ============================================================================
  const titlePg = findChild(sectPr, 'w', 'titlePg');
  if (titlePg) {
    props.titlePg = parseBooleanElement(titlePg);
  }

  // ============================================================================
  // DIFFERENT ODD/EVEN HEADERS (w:evenAndOddHeaders)
  // Note: This is typically in settings.xml, but can also be in sectPr
  // ============================================================================
  const evenAndOddHeaders = findChild(sectPr, 'w', 'evenAndOddHeaders');
  if (evenAndOddHeaders) {
    props.evenAndOddHeaders = parseBooleanElement(evenAndOddHeaders);
  }

  // ============================================================================
  // LINE NUMBERS (w:lnNumType)
  // ============================================================================
  const lnNumType = findChild(sectPr, 'w', 'lnNumType');
  if (lnNumType) {
    props.lineNumbers = {};

    const start = parseNumericAttribute(lnNumType, 'w', 'start');
    if (start !== undefined) {
      props.lineNumbers.start = start;
    }

    const countBy = parseNumericAttribute(lnNumType, 'w', 'countBy');
    if (countBy !== undefined) {
      props.lineNumbers.countBy = countBy;
    }

    const distance = parseNumericAttribute(lnNumType, 'w', 'distance');
    if (distance !== undefined) {
      props.lineNumbers.distance = distance;
    }

    const restart = getAttribute(lnNumType, 'w', 'restart');
    const restartValue = parseLineNumberRestart(restart);
    if (restartValue) {
      props.lineNumbers.restart = restartValue;
    }
  }

  // ============================================================================
  // PAGE BORDERS (w:pgBorders)
  // ============================================================================
  const pgBorders = findChild(sectPr, 'w', 'pgBorders');
  if (pgBorders) {
    props.pageBorders = {};

    // Top border
    const topBorder = parseBorderSpec(findChild(pgBorders, 'w', 'top'));
    if (topBorder) {
      props.pageBorders.top = topBorder;
    }

    // Bottom border
    const bottomBorder = parseBorderSpec(findChild(pgBorders, 'w', 'bottom'));
    if (bottomBorder) {
      props.pageBorders.bottom = bottomBorder;
    }

    // Left border
    const leftBorder = parseBorderSpec(findChild(pgBorders, 'w', 'left'));
    if (leftBorder) {
      props.pageBorders.left = leftBorder;
    }

    // Right border
    const rightBorder = parseBorderSpec(findChild(pgBorders, 'w', 'right'));
    if (rightBorder) {
      props.pageBorders.right = rightBorder;
    }

    // Display setting (allPages, firstPage, notFirstPage)
    const display = getAttribute(pgBorders, 'w', 'display');
    if (display === 'allPages' || display === 'firstPage' || display === 'notFirstPage') {
      props.pageBorders.display = display;
    }

    // Offset from (page or text)
    const offsetFrom = getAttribute(pgBorders, 'w', 'offsetFrom');
    if (offsetFrom === 'page' || offsetFrom === 'text') {
      props.pageBorders.offsetFrom = offsetFrom;
    }

    // Z-order (front or back)
    const zOrder = getAttribute(pgBorders, 'w', 'zOrder');
    if (zOrder === 'front' || zOrder === 'back') {
      props.pageBorders.zOrder = zOrder;
    }
  }

  // ============================================================================
  // PAGE BACKGROUND (w:background)
  // Note: Background is usually at document level, but checking here too
  // ============================================================================
  const background = findChild(sectPr, 'w', 'background');
  if (background) {
    props.background = {};

    const colorVal = getAttribute(background, 'w', 'color');
    if (colorVal && colorVal !== 'auto') {
      props.background.color = { rgb: colorVal };
    }

    const themeColor = getAttribute(background, 'w', 'themeColor');
    if (themeColor) {
      props.background.themeColor = themeColor as ThemeColorSlot;
    }

    const themeTint = getAttribute(background, 'w', 'themeTint');
    if (themeTint) {
      props.background.themeTint = themeTint;
    }

    const themeShade = getAttribute(background, 'w', 'themeShade');
    if (themeShade) {
      props.background.themeShade = themeShade;
    }
  }

  // ============================================================================
  // FOOTNOTE PROPERTIES (w:footnotePr)
  // ============================================================================
  const footnotePr = findChild(sectPr, 'w', 'footnotePr');
  if (footnotePr) {
    const fnProps = parseFootnoteProperties(footnotePr);
    if (Object.keys(fnProps).length > 0) {
      props.footnotePr = fnProps;
    }
  }

  // ============================================================================
  // ENDNOTE PROPERTIES (w:endnotePr)
  // ============================================================================
  const endnotePr = findChild(sectPr, 'w', 'endnotePr');
  if (endnotePr) {
    const enProps = parseEndnoteProperties(endnotePr);
    if (Object.keys(enProps).length > 0) {
      props.endnotePr = enProps;
    }
  }

  // ============================================================================
  // DOCUMENT GRID (w:docGrid)
  // ============================================================================
  const docGrid = findChild(sectPr, 'w', 'docGrid');
  if (docGrid) {
    props.docGrid = {};

    const gridType = getAttribute(docGrid, 'w', 'type');
    if (
      gridType === 'default' ||
      gridType === 'lines' ||
      gridType === 'linesAndChars' ||
      gridType === 'snapToChars'
    ) {
      props.docGrid.type = gridType;
    }

    const linePitch = parseNumericAttribute(docGrid, 'w', 'linePitch');
    if (linePitch !== undefined) {
      props.docGrid.linePitch = linePitch;
    }

    const charSpace = parseNumericAttribute(docGrid, 'w', 'charSpace');
    if (charSpace !== undefined) {
      props.docGrid.charSpace = charSpace;
    }
  }

  // ============================================================================
  // PAPER SOURCE (w:paperSrc)
  // ============================================================================
  const paperSrc = findChild(sectPr, 'w', 'paperSrc');
  if (paperSrc) {
    const first = parseNumericAttribute(paperSrc, 'w', 'first');
    if (first !== undefined) {
      props.paperSrcFirst = first;
    }

    const other = parseNumericAttribute(paperSrc, 'w', 'other');
    if (other !== undefined) {
      props.paperSrcOther = other;
    }
  }

  return props;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get page width in pixels (96 DPI)
 *
 * @param props - Section properties
 * @param defaultWidth - Default width in twips (default: 12240 = 8.5 inches)
 * @returns Width in pixels
 */
export function getPageWidthPixels(props: SectionProperties, defaultWidth: number = 12240): number {
  const twips = props.pageWidth ?? defaultWidth;
  // 1 inch = 1440 twips, 1 inch = 96 pixels at 96 DPI
  return Math.round((twips / 1440) * 96);
}

/**
 * Get page height in pixels (96 DPI)
 *
 * @param props - Section properties
 * @param defaultHeight - Default height in twips (default: 15840 = 11 inches)
 * @returns Height in pixels
 */
export function getPageHeightPixels(
  props: SectionProperties,
  defaultHeight: number = 15840
): number {
  const twips = props.pageHeight ?? defaultHeight;
  return Math.round((twips / 1440) * 96);
}

/**
 * Get content width (page width minus margins) in pixels
 *
 * @param props - Section properties
 * @returns Content width in pixels
 */
export function getContentWidthPixels(props: SectionProperties): number {
  const pageWidth = props.pageWidth ?? 12240;
  const marginLeft = props.marginLeft ?? 1440; // 1 inch default
  const marginRight = props.marginRight ?? 1440;
  const twips = pageWidth - marginLeft - marginRight;
  return Math.round((twips / 1440) * 96);
}

/**
 * Get content height (page height minus margins) in pixels
 *
 * @param props - Section properties
 * @returns Content height in pixels
 */
export function getContentHeightPixels(props: SectionProperties): number {
  const pageHeight = props.pageHeight ?? 15840;
  const marginTop = props.marginTop ?? 1440;
  const marginBottom = props.marginBottom ?? 1440;
  const twips = pageHeight - marginTop - marginBottom;
  return Math.round((twips / 1440) * 96);
}

/**
 * Get margins in pixels
 *
 * @param props - Section properties
 * @returns Object with all margins in pixels
 */
export function getMarginsPixels(props: SectionProperties): {
  top: number;
  bottom: number;
  left: number;
  right: number;
  header: number;
  footer: number;
  gutter: number;
} {
  const twipsToPixels = (twips: number | undefined, defaultTwips: number) => {
    return Math.round(((twips ?? defaultTwips) / 1440) * 96);
  };

  return {
    top: twipsToPixels(props.marginTop, 1440),
    bottom: twipsToPixels(props.marginBottom, 1440),
    left: twipsToPixels(props.marginLeft, 1440),
    right: twipsToPixels(props.marginRight, 1440),
    header: twipsToPixels(props.headerDistance, 720), // 0.5 inch default
    footer: twipsToPixels(props.footerDistance, 720),
    gutter: twipsToPixels(props.gutter, 0),
  };
}

/**
 * Check if section has different first page header/footer
 */
export function hasDifferentFirstPage(props: SectionProperties): boolean {
  return props.titlePg === true;
}

/**
 * Check if section has different odd/even page headers/footers
 */
export function hasDifferentOddEven(props: SectionProperties): boolean {
  return props.evenAndOddHeaders === true;
}

/**
 * Get effective column count (minimum 1)
 */
export function getColumnCount(props: SectionProperties): number {
  return Math.max(1, props.columnCount ?? 1);
}

/**
 * Check if section is landscape
 */
export function isLandscape(props: SectionProperties): boolean {
  return props.orientation === 'landscape';
}

/**
 * Check if section has page borders
 */
export function hasPageBorders(props: SectionProperties): boolean {
  if (!props.pageBorders) return false;
  return !!(
    props.pageBorders.top ||
    props.pageBorders.bottom ||
    props.pageBorders.left ||
    props.pageBorders.right
  );
}

/**
 * Check if section has line numbers
 */
export function hasLineNumbers(props: SectionProperties): boolean {
  return !!props.lineNumbers;
}

/**
 * Get default section properties (US Letter size, 1 inch margins)
 */
export function getDefaultSectionProperties(): SectionProperties {
  return {
    pageWidth: 12240, // 8.5 inches
    pageHeight: 15840, // 11 inches
    orientation: 'portrait',
    marginTop: 1440, // 1 inch
    marginBottom: 1440,
    marginLeft: 1440,
    marginRight: 1440,
    headerDistance: 720, // 0.5 inch
    footerDistance: 720,
    gutter: 0,
    columnCount: 1,
    columnSpace: 720, // 0.5 inch
    equalWidth: true,
    sectionStart: 'nextPage',
    verticalAlign: 'top',
  };
}

/**
 * Merge section properties (later values override earlier)
 *
 * @param base - Base properties
 * @param override - Override properties
 * @returns Merged properties
 */
export function mergeSectionProperties(
  base: SectionProperties,
  override: SectionProperties
): SectionProperties {
  const result: SectionProperties = { ...base };

  // Simple properties - override if present
  if (override.pageWidth !== undefined) result.pageWidth = override.pageWidth;
  if (override.pageHeight !== undefined) result.pageHeight = override.pageHeight;
  if (override.orientation !== undefined) result.orientation = override.orientation;
  if (override.marginTop !== undefined) result.marginTop = override.marginTop;
  if (override.marginBottom !== undefined) result.marginBottom = override.marginBottom;
  if (override.marginLeft !== undefined) result.marginLeft = override.marginLeft;
  if (override.marginRight !== undefined) result.marginRight = override.marginRight;
  if (override.headerDistance !== undefined) result.headerDistance = override.headerDistance;
  if (override.footerDistance !== undefined) result.footerDistance = override.footerDistance;
  if (override.gutter !== undefined) result.gutter = override.gutter;
  if (override.columnCount !== undefined) result.columnCount = override.columnCount;
  if (override.columnSpace !== undefined) result.columnSpace = override.columnSpace;
  if (override.equalWidth !== undefined) result.equalWidth = override.equalWidth;
  if (override.separator !== undefined) result.separator = override.separator;
  if (override.columns !== undefined) result.columns = override.columns;
  if (override.sectionStart !== undefined) result.sectionStart = override.sectionStart;
  if (override.verticalAlign !== undefined) result.verticalAlign = override.verticalAlign;
  if (override.bidi !== undefined) result.bidi = override.bidi;
  if (override.headerReferences !== undefined) result.headerReferences = override.headerReferences;
  if (override.footerReferences !== undefined) result.footerReferences = override.footerReferences;
  if (override.titlePg !== undefined) result.titlePg = override.titlePg;
  if (override.evenAndOddHeaders !== undefined)
    result.evenAndOddHeaders = override.evenAndOddHeaders;
  if (override.lineNumbers !== undefined) result.lineNumbers = override.lineNumbers;
  if (override.pageBorders !== undefined) result.pageBorders = override.pageBorders;
  if (override.background !== undefined) result.background = override.background;
  if (override.footnotePr !== undefined) result.footnotePr = override.footnotePr;
  if (override.endnotePr !== undefined) result.endnotePr = override.endnotePr;
  if (override.docGrid !== undefined) result.docGrid = override.docGrid;
  if (override.paperSrcFirst !== undefined) result.paperSrcFirst = override.paperSrcFirst;
  if (override.paperSrcOther !== undefined) result.paperSrcOther = override.paperSrcOther;

  return result;
}
