/**
 * ProseMirror Node Specifications
 *
 * Defines node types for the DOCX editor:
 * - doc: Top-level document node
 * - paragraph: Block-level paragraph with formatting attrs
 * - hardBreak: Line break within a paragraph
 * - image: Inline image
 */

import type { NodeSpec } from 'prosemirror-model';
import type {
  ParagraphAlignment,
  LineSpacingRule,
  BorderSpec,
  ShadingProperties,
  TabStop,
  TextFormatting,
  NumberFormat,
} from '../../types/document';
import { paragraphToStyle } from '../../utils/formatToStyle';

/**
 * Paragraph node attributes - maps to ParagraphFormatting
 */
export interface ParagraphAttrs {
  // Identity
  paraId?: string;
  textId?: string;

  // Alignment
  alignment?: ParagraphAlignment;

  // Spacing (in twips)
  spaceBefore?: number;
  spaceAfter?: number;
  lineSpacing?: number;
  lineSpacingRule?: LineSpacingRule;

  // Indentation (in twips)
  indentLeft?: number;
  indentRight?: number;
  indentFirstLine?: number;
  hangingIndent?: boolean;

  // List properties
  numPr?: {
    numId?: number;
    ilvl?: number;
  };
  /** List number format (decimal, lowerRoman, upperRoman, etc.) for CSS counter styling */
  listNumFmt?: NumberFormat;
  /** Whether this is a bullet list */
  listIsBullet?: boolean;
  /** Computed list marker text (e.g., "1.", "1.1.", "•") */
  listMarker?: string;

  // Style reference
  styleId?: string;

  // Borders
  borders?: {
    top?: BorderSpec;
    bottom?: BorderSpec;
    left?: BorderSpec;
    right?: BorderSpec;
    between?: BorderSpec;
    bar?: BorderSpec;
  };

  // Background/Shading
  shading?: ShadingProperties;

  // Tab stops
  tabs?: TabStop[];

  // Page break control
  pageBreakBefore?: boolean;
  keepNext?: boolean;
  keepLines?: boolean;

  // Default text formatting for empty paragraphs (persists when navigating away)
  // Maps to OOXML pPr/rPr (paragraph's default run properties)
  defaultTextFormatting?: TextFormatting;
}

/**
 * Image position for floating images (horizontal and vertical positioning)
 */
export interface ImagePositionAttrs {
  horizontal?: {
    relativeTo?: string;
    posOffset?: number; // In EMU
    align?: string;
  };
  vertical?: {
    relativeTo?: string;
    posOffset?: number; // In EMU
    align?: string;
  };
}

/**
 * Image node attributes
 */
export interface ImageAttrs {
  src: string;
  alt?: string;
  title?: string;
  /** Width in pixels (already converted from EMU) */
  width?: number;
  /** Height in pixels (already converted from EMU) */
  height?: number;
  rId?: string;
  /** Wrap type from DOCX: inline, square, tight, through, topAndBottom, behind, inFront */
  wrapType?: 'inline' | 'square' | 'tight' | 'through' | 'topAndBottom' | 'behind' | 'inFront';
  /** Display mode for CSS: inline (flows with text), float (left/right float), block (centered) */
  displayMode?: 'inline' | 'float' | 'block';
  /** CSS float direction for floating images */
  cssFloat?: 'left' | 'right' | 'none';
  /** CSS transform string (rotation, flip) */
  transform?: string;
  /** Distance from text above (pixels) */
  distTop?: number;
  /** Distance from text below (pixels) */
  distBottom?: number;
  /** Distance from text left (pixels) */
  distLeft?: number;
  /** Distance from text right (pixels) */
  distRight?: number;
  /** Position for floating images (horizontal and vertical alignment) */
  position?: ImagePositionAttrs;
}

/**
 * Helper to convert paragraph attrs to DOM style
 */
function paragraphAttrsToDOMStyle(attrs: ParagraphAttrs): string {
  // For list items, use explicit indentation from numbering definition if available,
  // otherwise fall back to calculated indentation based on level
  let indentLeft = attrs.indentLeft;
  if (attrs.numPr?.numId && indentLeft == null) {
    // Fallback: calculate indentation based on level
    // Each level indents 0.5 inch (720 twips) more
    const level = attrs.numPr.ilvl ?? 0;
    // Base indentation: 0.5 inch (720 twips) per level
    // Level 0 = 720 twips (48px), Level 1 = 1440 twips (96px), etc.
    indentLeft = (level + 1) * 720;
  }

  const formatting = {
    alignment: attrs.alignment,
    spaceBefore: attrs.spaceBefore,
    spaceAfter: attrs.spaceAfter,
    lineSpacing: attrs.lineSpacing,
    lineSpacingRule: attrs.lineSpacingRule,
    indentLeft: indentLeft,
    indentRight: attrs.indentRight,
    indentFirstLine: attrs.indentFirstLine,
    hangingIndent: attrs.hangingIndent,
    borders: attrs.borders,
    shading: attrs.shading,
  };

  const style = paragraphToStyle(formatting);
  return Object.entries(style)
    .map(([key, value]) => {
      // Convert camelCase to kebab-case
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${value}`;
    })
    .join('; ');
}

/**
 * Map OOXML numFmt to CSS counter style class
 */
function numFmtToClass(numFmt: NumberFormat | undefined): string {
  switch (numFmt) {
    case 'upperRoman':
      return 'docx-list-upper-roman';
    case 'lowerRoman':
      return 'docx-list-lower-roman';
    case 'upperLetter':
      return 'docx-list-upper-alpha';
    case 'lowerLetter':
      return 'docx-list-lower-alpha';
    case 'decimal':
    case 'decimalZero':
    default:
      return 'docx-list-decimal';
  }
}

/**
 * Get CSS class for list styling
 */
function getListClass(
  numPr?: ParagraphAttrs['numPr'],
  listIsBullet?: boolean,
  listNumFmt?: NumberFormat
): string {
  if (!numPr?.numId) return '';

  const level = numPr.ilvl ?? 0;

  if (listIsBullet) {
    return `docx-list-bullet docx-list-level-${level}`;
  }

  const formatClass = numFmtToClass(listNumFmt);
  return `docx-list-numbered ${formatClass} docx-list-level-${level}`;
}

/**
 * Document node - top level container
 */
export const doc: NodeSpec = {
  content: '(paragraph | horizontalRule | table)+',
};

/**
 * Paragraph node - block-level text container
 */
export const paragraph: NodeSpec = {
  content: 'inline*',
  group: 'block',
  attrs: {
    // Identity
    paraId: { default: null },
    textId: { default: null },

    // Alignment
    alignment: { default: null },

    // Spacing
    spaceBefore: { default: null },
    spaceAfter: { default: null },
    lineSpacing: { default: null },
    lineSpacingRule: { default: null },

    // Indentation
    indentLeft: { default: null },
    indentRight: { default: null },
    indentFirstLine: { default: null },
    hangingIndent: { default: false },

    // List properties
    numPr: { default: null },
    listNumFmt: { default: null },
    listIsBullet: { default: null },
    listMarker: { default: null },

    // Style reference
    styleId: { default: null },

    // Borders
    borders: { default: null },

    // Background/Shading
    shading: { default: null },

    // Tab stops
    tabs: { default: null },

    // Page break control
    pageBreakBefore: { default: null },
    keepNext: { default: null },
    keepLines: { default: null },

    // Default text formatting for empty paragraphs (persists when navigating away)
    defaultTextFormatting: { default: null },
  },
  parseDOM: [
    {
      tag: 'p',
      getAttrs(dom): ParagraphAttrs {
        const element = dom as HTMLElement;
        return {
          paraId: element.dataset.paraId || undefined,
          alignment: element.dataset.alignment as ParagraphAlignment | undefined,
          styleId: element.dataset.styleId || undefined,
        };
      },
    },
  ],
  toDOM(node) {
    const attrs = node.attrs as ParagraphAttrs;
    const style = paragraphAttrsToDOMStyle(attrs);
    const listClass = getListClass(attrs.numPr, attrs.listIsBullet, attrs.listNumFmt);

    const domAttrs: Record<string, string> = {};

    if (style) {
      domAttrs.style = style;
    }

    if (listClass) {
      domAttrs.class = listClass;
    }

    if (attrs.paraId) {
      domAttrs['data-para-id'] = attrs.paraId;
    }

    if (attrs.alignment) {
      domAttrs['data-alignment'] = attrs.alignment;
    }

    if (attrs.styleId) {
      domAttrs['data-style-id'] = attrs.styleId;
    }

    // Add list marker as data attribute for CSS to use
    if (attrs.listMarker) {
      domAttrs['data-list-marker'] = attrs.listMarker;
    }

    return ['p', domAttrs, 0];
  },
};

/**
 * Hard break node - line break within a paragraph
 */
export const hardBreak: NodeSpec = {
  inline: true,
  group: 'inline',
  selectable: false,
  parseDOM: [{ tag: 'br' }],
  toDOM() {
    return ['br'];
  },
};

/**
 * Image node - inline or floating image
 *
 * DOCX images can be:
 * - Inline (wp:inline): Flow with text like a character
 * - Floating/Anchored (wp:anchor) with wrap types:
 *   - Square/Tight/Through: Text wraps around image using CSS float
 *   - TopAndBottom: Image on own line, text above/below only
 *   - None/Behind/InFront: Positioned image (rendered as block)
 *
 * For proper Word-like rendering:
 * - Width/height in pixels (converted from EMUs)
 * - Floating images use CSS float: left/right
 * - Block images use display:block + margin:auto for centering
 * - max-width prevents overflow beyond page bounds
 */
export const image: NodeSpec = {
  inline: true,
  group: 'inline',
  draggable: true,
  attrs: {
    src: {},
    alt: { default: null },
    title: { default: null },
    width: { default: null },
    height: { default: null },
    rId: { default: null },
    wrapType: { default: 'inline' },
    displayMode: { default: 'inline' },
    cssFloat: { default: null },
    transform: { default: null },
    distTop: { default: null },
    distBottom: { default: null },
    distLeft: { default: null },
    distRight: { default: null },
    position: { default: null },
  },
  parseDOM: [
    {
      tag: 'img[src]',
      getAttrs(dom): ImageAttrs {
        const element = dom as HTMLImageElement;
        return {
          src: element.getAttribute('src') || '',
          alt: element.getAttribute('alt') || undefined,
          title: element.getAttribute('title') || undefined,
          width: element.width || undefined,
          height: element.height || undefined,
          rId: element.dataset.rid || undefined,
          wrapType: (element.dataset.wrapType as ImageAttrs['wrapType']) || 'inline',
          displayMode: (element.dataset.displayMode as ImageAttrs['displayMode']) || 'inline',
          cssFloat: (element.dataset.cssFloat as ImageAttrs['cssFloat']) || undefined,
          transform: element.dataset.transform || undefined,
        };
      },
    },
  ],
  toDOM(node) {
    const attrs = node.attrs as ImageAttrs;
    const domAttrs: Record<string, string> = {
      src: attrs.src,
      class: 'docx-image',
    };

    if (attrs.alt) domAttrs.alt = attrs.alt;
    if (attrs.title) domAttrs.title = attrs.title;
    if (attrs.rId) domAttrs['data-rid'] = attrs.rId;
    if (attrs.wrapType) domAttrs['data-wrap-type'] = attrs.wrapType;
    if (attrs.displayMode) domAttrs['data-display-mode'] = attrs.displayMode;
    if (attrs.cssFloat) domAttrs['data-css-float'] = attrs.cssFloat;
    if (attrs.transform) domAttrs['data-transform'] = attrs.transform;

    // Build inline styles for proper sizing and layout
    const styles: string[] = [];

    // Set explicit dimensions if available
    if (attrs.width) {
      domAttrs.width = String(attrs.width);
      styles.push(`width: ${attrs.width}px`);
    }
    if (attrs.height) {
      domAttrs.height = String(attrs.height);
      styles.push(`height: ${attrs.height}px`);
    }

    // Constrain to page width to prevent overflow
    styles.push('max-width: 100%');

    // Maintain aspect ratio when constrained
    if (attrs.width && attrs.height) {
      styles.push('object-fit: contain');
    } else {
      styles.push('height: auto');
    }

    // Apply display mode and float
    if (attrs.displayMode === 'float' && attrs.cssFloat && attrs.cssFloat !== 'none') {
      // Floating image - use CSS float for text wrapping
      styles.push(`float: ${attrs.cssFloat}`);
      domAttrs.class += ` docx-image-float docx-image-float-${attrs.cssFloat}`;

      // Add margins based on wrap distances
      const marginTop = attrs.distTop ?? 0;
      const marginBottom = attrs.distBottom ?? 0;
      const marginLeft = attrs.distLeft ?? 0;
      const marginRight = attrs.distRight ?? 0;

      // Add spacing around floated image
      if (attrs.cssFloat === 'left') {
        styles.push(
          `margin: ${marginTop}px ${marginRight || 12}px ${marginBottom}px ${marginLeft}px`
        );
      } else {
        styles.push(
          `margin: ${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft || 12}px`
        );
      }
    } else if (attrs.displayMode === 'block') {
      // Block image (TopAndBottom or centered) - centered on own line
      styles.push('display: block');
      styles.push('margin-left: auto');
      styles.push('margin-right: auto');
      domAttrs.class += ' docx-image-block';

      // Add vertical margins
      const marginTop = attrs.distTop ?? 8;
      const marginBottom = attrs.distBottom ?? 8;
      styles.push(`margin-top: ${marginTop}px`);
      styles.push(`margin-bottom: ${marginBottom}px`);
    }
    // Inline images (default) - no special styling needed

    // Apply transform if present (rotation, flip)
    if (attrs.transform) {
      styles.push(`transform: ${attrs.transform}`);
    }

    domAttrs.style = styles.join('; ');

    return ['img', domAttrs];
  },
};

/**
 * Text node - implicit in ProseMirror, just configure how it's grouped
 */
export const text: NodeSpec = {
  group: 'inline',
};

/**
 * Horizontal rule node - for document separators
 */
export const horizontalRule: NodeSpec = {
  group: 'block',
  parseDOM: [{ tag: 'hr' }],
  toDOM() {
    return ['hr'];
  },
};

/**
 * Tab node - inline tab character with proper width
 * Renders as a span with minimum width to simulate tab stops
 */
export const tab: NodeSpec = {
  inline: true,
  group: 'inline',
  selectable: false,
  parseDOM: [
    {
      tag: 'span.docx-tab',
    },
  ],
  toDOM() {
    // Render as a span with minimum width for visual tab spacing
    // Using 16px as a reasonable default that matches typical Word tab appearance
    return [
      'span',
      {
        class: 'docx-tab',
        style: 'display: inline-block; min-width: 16px; white-space: pre;',
      },
      '\t',
    ];
  },
};

// ============================================================================
// TABLE NODES
// ============================================================================

/**
 * Table node attributes
 */
export interface TableAttrs {
  /** Table style ID */
  styleId?: string;
  /** Table width (in twips) */
  width?: number;
  /** Table width type ('auto', 'pct', 'dxa') */
  widthType?: string;
  /** Table justification/alignment */
  justification?: 'left' | 'center' | 'right';
  /** Column widths (in twips) from w:tblGrid */
  columnWidths?: number[];
}

/**
 * Table row attributes
 */
export interface TableRowAttrs {
  /** Row height (in twips) */
  height?: number;
  /** Height rule ('auto', 'exact', 'atLeast') */
  heightRule?: string;
  /** Is header row */
  isHeader?: boolean;
}

/**
 * Table cell attributes
 */
export interface TableCellAttrs {
  /** Column span */
  colspan: number;
  /** Row span */
  rowspan: number;
  /** Column widths for prosemirror-tables resizing (array of pixel widths) */
  colwidth?: number[] | null;
  /** Cell width (in twips) */
  width?: number;
  /** Cell width type */
  widthType?: string;
  /** Vertical alignment */
  verticalAlign?: 'top' | 'center' | 'bottom';
  /** Background color (RGB hex) */
  backgroundColor?: string;
  /** No text wrapping in cell */
  noWrap?: boolean;
  /** Which borders are visible */
  borders?: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean };
  /** Per-side border colors (RGB hex) */
  borderColors?: { top?: string; bottom?: string; left?: string; right?: string };
  /** Per-side border widths (in eighths of a point) */
  borderWidths?: { top?: number; bottom?: number; left?: number; right?: number };
}

/**
 * Table node - block-level table container
 */
export const table: NodeSpec = {
  content: 'tableRow+',
  group: 'block',
  tableRole: 'table',
  isolating: true,
  attrs: {
    styleId: { default: null },
    width: { default: null },
    widthType: { default: null },
    justification: { default: null },
    columnWidths: { default: null },
  },
  parseDOM: [
    {
      tag: 'table',
      getAttrs(dom): TableAttrs {
        const element = dom as HTMLTableElement;
        return {
          styleId: element.dataset.styleId || undefined,
          justification: element.dataset.justification as TableAttrs['justification'] | undefined,
        };
      },
    },
  ],
  toDOM(node) {
    const attrs = node.attrs as TableAttrs;
    const domAttrs: Record<string, string> = {
      class: 'docx-table',
    };

    if (attrs.styleId) {
      domAttrs['data-style-id'] = attrs.styleId;
    }

    // Apply table width style - use auto layout for natural sizing
    const styles: string[] = ['border-collapse: collapse', 'table-layout: auto'];

    // Only set explicit width if specified in DOCX
    if (attrs.width && attrs.widthType === 'pct') {
      styles.push(`width: ${attrs.width / 50}%`); // DOCX pct is in 50ths of a percent
    } else if (attrs.width && attrs.widthType === 'dxa') {
      // Convert twips to pixels
      const widthPx = Math.round((attrs.width / 20) * 1.333);
      styles.push(`width: ${widthPx}px`);
    }
    // If no width specified, let table size naturally based on content

    if (attrs.justification === 'center') {
      styles.push('margin-left: auto', 'margin-right: auto');
    } else if (attrs.justification === 'right') {
      styles.push('margin-left: auto');
    }
    domAttrs.style = styles.join('; ');

    return ['table', domAttrs, ['tbody', 0]];
  },
};

/**
 * Table row node
 */
export const tableRow: NodeSpec = {
  content: '(tableCell | tableHeader)+',
  tableRole: 'row',
  attrs: {
    height: { default: null },
    heightRule: { default: null },
    isHeader: { default: false },
  },
  parseDOM: [{ tag: 'tr' }],
  toDOM(node) {
    const attrs = node.attrs as TableRowAttrs;
    const domAttrs: Record<string, string> = {};

    if (attrs.height) {
      // Convert twips to pixels (1 twip = 1/20 point, 1 point = 1.333 px at 96 dpi)
      const heightPx = Math.round((attrs.height / 20) * 1.333);
      domAttrs.style = `height: ${heightPx}px`;
    }

    return ['tr', domAttrs, 0];
  },
};

/**
 * Table cell node - regular cell
 * Content allows paragraphs and nested tables (valid in OOXML)
 */
export const tableCell: NodeSpec = {
  content: '(paragraph | table)+',
  tableRole: 'cell',
  isolating: true,
  attrs: {
    colspan: { default: 1 },
    rowspan: { default: 1 },
    colwidth: { default: null }, // Required for prosemirror-tables column resizing
    width: { default: null },
    widthType: { default: null },
    verticalAlign: { default: null },
    backgroundColor: { default: null },
    borders: { default: null }, // { top?: boolean, bottom?: boolean, left?: boolean, right?: boolean }
    borderColors: { default: null }, // { top?: string, bottom?: string, left?: string, right?: string }
    borderWidths: { default: null }, // { top?: number, bottom?: number, left?: number, right?: number } in eighths of a point
    noWrap: { default: false },
  },
  parseDOM: [
    {
      tag: 'td',
      getAttrs(dom): TableCellAttrs {
        const element = dom as HTMLTableCellElement;
        return {
          colspan: element.colSpan || 1,
          rowspan: element.rowSpan || 1,
          verticalAlign: element.dataset.valign as TableCellAttrs['verticalAlign'] | undefined,
          backgroundColor: element.dataset.bgcolor || undefined,
        };
      },
    },
  ],
  toDOM(node) {
    const attrs = node.attrs as TableCellAttrs;
    const domAttrs: Record<string, string> = {
      class: 'docx-table-cell',
    };

    if (attrs.colspan > 1) {
      domAttrs.colspan = String(attrs.colspan);
    }
    if (attrs.rowspan > 1) {
      domAttrs.rowspan = String(attrs.rowspan);
    }

    // Build style - text wrapping and overflow control are critical for table-layout: fixed
    const styles: string[] = ['padding: 4px 8px'];

    // Handle text wrapping - noWrap prevents text from wrapping in the cell
    if ((attrs as TableCellAttrs).noWrap) {
      styles.push('white-space: nowrap');
    } else {
      styles.push('word-wrap: break-word');
      styles.push('overflow-wrap: break-word');
      styles.push('overflow: hidden');
    }

    // Handle cell width - colwidth takes priority (set by prosemirror-tables resizing)
    if (attrs.colwidth && attrs.colwidth.length > 0) {
      // colwidth is array of pixel widths for each column in the cell span
      const totalWidth = attrs.colwidth.reduce((sum, w) => sum + w, 0);
      styles.push(`width: ${totalWidth}px`);
    } else if (attrs.width && attrs.widthType === 'pct') {
      styles.push(`width: ${attrs.width}%`);
    } else if (attrs.width) {
      // Assume twips if not percentage
      const widthPx = Math.round((attrs.width / 20) * 1.333);
      styles.push(`width: ${widthPx}px`);
    }

    // Handle borders - support per-side colors and widths
    const borders = (attrs as TableCellAttrs).borders;
    const borderColors = (attrs as TableCellAttrs).borderColors;
    const borderWidths = (attrs as TableCellAttrs).borderWidths;

    // Helper to convert DOCX border size (eighths of a point) to CSS pixels
    const toBorderWidth = (size?: number): string => {
      if (!size) return '1px';
      // 1 point = 1.333px at 96 DPI, size is in eighths of a point
      // Use Math.ceil to ensure thin borders are visible
      const px = Math.max(1, Math.ceil((size / 8) * 1.333));
      return `${px}px`;
    };

    if (borders) {
      // Individual border control with per-side colors and widths
      const topColor = borderColors?.top ? `#${borderColors.top}` : '#000000';
      const bottomColor = borderColors?.bottom ? `#${borderColors.bottom}` : '#000000';
      const leftColor = borderColors?.left ? `#${borderColors.left}` : '#000000';
      const rightColor = borderColors?.right ? `#${borderColors.right}` : '#000000';
      const topWidth = toBorderWidth(borderWidths?.top);
      const bottomWidth = toBorderWidth(borderWidths?.bottom);
      const leftWidth = toBorderWidth(borderWidths?.left);
      const rightWidth = toBorderWidth(borderWidths?.right);
      styles.push(`border-top: ${borders.top ? topWidth + ' solid ' + topColor : 'none'}`);
      styles.push(
        `border-bottom: ${borders.bottom ? bottomWidth + ' solid ' + bottomColor : 'none'}`
      );
      styles.push(`border-left: ${borders.left ? leftWidth + ' solid ' + leftColor : 'none'}`);
      styles.push(`border-right: ${borders.right ? rightWidth + ' solid ' + rightColor : 'none'}`);
    }
    // If no borders specified, don't add any default borders

    if (attrs.verticalAlign) {
      domAttrs['data-valign'] = attrs.verticalAlign;
      styles.push(`vertical-align: ${attrs.verticalAlign}`);
    }
    if (attrs.backgroundColor) {
      domAttrs['data-bgcolor'] = attrs.backgroundColor;
      styles.push(`background-color: #${attrs.backgroundColor}`);
    }
    domAttrs.style = styles.join('; ');

    return ['td', domAttrs, 0];
  },
};

/**
 * Table header cell node
 * Content allows paragraphs and nested tables (valid in OOXML)
 */
export const tableHeader: NodeSpec = {
  content: '(paragraph | table)+',
  tableRole: 'header_cell',
  isolating: true,
  attrs: {
    colspan: { default: 1 },
    rowspan: { default: 1 },
    colwidth: { default: null }, // Required for prosemirror-tables column resizing
    width: { default: null },
    widthType: { default: null },
    verticalAlign: { default: null },
    backgroundColor: { default: null },
    borders: { default: null },
    borderColors: { default: null },
    borderWidths: { default: null },
    noWrap: { default: false },
  },
  parseDOM: [
    {
      tag: 'th',
      getAttrs(dom): TableCellAttrs {
        const element = dom as HTMLTableCellElement;
        return {
          colspan: element.colSpan || 1,
          rowspan: element.rowSpan || 1,
          verticalAlign: element.dataset.valign as TableCellAttrs['verticalAlign'] | undefined,
          backgroundColor: element.dataset.bgcolor || undefined,
        };
      },
    },
  ],
  toDOM(node) {
    const attrs = node.attrs as TableCellAttrs;
    const domAttrs: Record<string, string> = {
      class: 'docx-table-header',
    };

    if (attrs.colspan > 1) {
      domAttrs.colspan = String(attrs.colspan);
    }
    if (attrs.rowspan > 1) {
      domAttrs.rowspan = String(attrs.rowspan);
    }

    // Build style - headers get bold and centered by default
    const styles: string[] = ['padding: 4px 8px', 'font-weight: bold'];

    // Handle text wrapping - noWrap prevents text from wrapping in the cell
    if ((attrs as TableCellAttrs).noWrap) {
      styles.push('white-space: nowrap');
    } else {
      styles.push('word-wrap: break-word');
      styles.push('overflow-wrap: break-word');
      styles.push('overflow: hidden');
    }

    // Handle cell width - colwidth takes priority (set by prosemirror-tables resizing)
    if (attrs.colwidth && attrs.colwidth.length > 0) {
      // colwidth is array of pixel widths for each column in the cell span
      const totalWidth = attrs.colwidth.reduce((sum, w) => sum + w, 0);
      styles.push(`width: ${totalWidth}px`);
    } else if (attrs.width && (attrs as any).widthType === 'pct') {
      styles.push(`width: ${attrs.width}%`);
    } else if (attrs.width) {
      // Assume twips if not percentage
      const widthPx = Math.round((attrs.width / 20) * 1.333);
      styles.push(`width: ${widthPx}px`);
    }

    // Handle borders - support per-side colors and widths
    const borders = (attrs as TableCellAttrs).borders;
    const borderColors = (attrs as TableCellAttrs).borderColors;
    const borderWidths = (attrs as TableCellAttrs).borderWidths;

    // Helper to convert DOCX border size (eighths of a point) to CSS pixels
    const toBorderWidth = (size?: number): string => {
      if (!size) return '1px';
      // Use Math.ceil to ensure thin borders are visible
      const px = Math.max(1, Math.ceil((size / 8) * 1.333));
      return `${px}px`;
    };

    if (borders) {
      // Individual border control with per-side colors and widths
      const topColor = borderColors?.top ? `#${borderColors.top}` : '#000000';
      const bottomColor = borderColors?.bottom ? `#${borderColors.bottom}` : '#000000';
      const leftColor = borderColors?.left ? `#${borderColors.left}` : '#000000';
      const rightColor = borderColors?.right ? `#${borderColors.right}` : '#000000';
      const topWidth = toBorderWidth(borderWidths?.top);
      const bottomWidth = toBorderWidth(borderWidths?.bottom);
      const leftWidth = toBorderWidth(borderWidths?.left);
      const rightWidth = toBorderWidth(borderWidths?.right);
      styles.push(`border-top: ${borders.top ? topWidth + ' solid ' + topColor : 'none'}`);
      styles.push(
        `border-bottom: ${borders.bottom ? bottomWidth + ' solid ' + bottomColor : 'none'}`
      );
      styles.push(`border-left: ${borders.left ? leftWidth + ' solid ' + leftColor : 'none'}`);
      styles.push(`border-right: ${borders.right ? rightWidth + ' solid ' + rightColor : 'none'}`);
    }
    // If no borders specified, don't add any default borders

    if (attrs.verticalAlign) {
      domAttrs['data-valign'] = attrs.verticalAlign;
      styles.push(`vertical-align: ${attrs.verticalAlign}`);
    }

    // Background color - only apply if explicitly set
    if (attrs.backgroundColor) {
      domAttrs['data-bgcolor'] = attrs.backgroundColor;
      styles.push(`background-color: #${attrs.backgroundColor}`);
    }

    domAttrs.style = styles.join('; ');

    return ['th', domAttrs, 0];
  },
};

/**
 * All node specifications
 */
export const nodes = {
  doc,
  paragraph,
  text,
  hardBreak,
  image,
  horizontalRule,
  tab,
  table,
  tableRow,
  tableCell,
  tableHeader,
};
