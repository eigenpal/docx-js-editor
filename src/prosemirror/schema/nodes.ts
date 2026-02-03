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

  // Default text formatting for empty paragraphs (persists when navigating away)
  // Maps to OOXML pPr/rPr (paragraph's default run properties)
  defaultTextFormatting?: TextFormatting;
}

/**
 * Image node attributes
 */
export interface ImageAttrs {
  src: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
  rId?: string;
}

/**
 * Helper to convert paragraph attrs to DOM style
 */
function paragraphAttrsToDOMStyle(attrs: ParagraphAttrs): string {
  const formatting = {
    alignment: attrs.alignment,
    spaceBefore: attrs.spaceBefore,
    spaceAfter: attrs.spaceAfter,
    lineSpacing: attrs.lineSpacing,
    lineSpacingRule: attrs.lineSpacingRule,
    indentLeft: attrs.indentLeft,
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
 * Get CSS class for list styling
 */
function getListClass(numPr?: ParagraphAttrs['numPr']): string {
  if (!numPr?.numId) return '';

  // Check if it's a bullet list (numId 1 is typically bullets in our system)
  // This is simplified - real implementation would check numbering definitions
  const isBullet = numPr.numId === 1;
  const level = numPr.ilvl ?? 0;

  return isBullet
    ? `docx-list-bullet docx-list-level-${level}`
    : `docx-list-numbered docx-list-level-${level}`;
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

    // Style reference
    styleId: { default: null },

    // Borders
    borders: { default: null },

    // Background/Shading
    shading: { default: null },

    // Tab stops
    tabs: { default: null },

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
    const listClass = getListClass(attrs.numPr);

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
 * Image node - inline image
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
        };
      },
    },
  ],
  toDOM(node) {
    const attrs = node.attrs as ImageAttrs;
    const domAttrs: Record<string, string> = {
      src: attrs.src,
    };

    if (attrs.alt) domAttrs.alt = attrs.alt;
    if (attrs.title) domAttrs.title = attrs.title;
    if (attrs.width) domAttrs.width = String(attrs.width);
    if (attrs.height) domAttrs.height = String(attrs.height);
    if (attrs.rId) domAttrs['data-rid'] = attrs.rId;

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

    // Apply table width style
    const styles: string[] = ['border-collapse: collapse', 'width: 100%', 'table-layout: fixed'];
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
    borderColor: { default: null },
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
    const styles: string[] = [
      'padding: 4px 8px',
      'word-wrap: break-word',
      'overflow-wrap: break-word',
      'overflow: hidden',
    ];

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

    // Handle borders - default to black borders like Word
    const borderColor = (attrs as any).borderColor ? `#${(attrs as any).borderColor}` : '#000000';
    const borders = (attrs as any).borders;
    if (borders) {
      // Individual border control
      styles.push(`border-top: ${borders.top ? '1px solid ' + borderColor : 'none'}`);
      styles.push(`border-bottom: ${borders.bottom ? '1px solid ' + borderColor : 'none'}`);
      styles.push(`border-left: ${borders.left ? '1px solid ' + borderColor : 'none'}`);
      styles.push(`border-right: ${borders.right ? '1px solid ' + borderColor : 'none'}`);
    } else {
      // Default: all borders with black color (like Word)
      styles.push(`border: 1px solid ${borderColor}`);
    }

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
    borderColor: { default: null },
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
    // Text wrapping and overflow control are critical for table-layout: fixed
    const styles: string[] = [
      'padding: 4px 8px',
      'font-weight: bold',
      'word-wrap: break-word',
      'overflow-wrap: break-word',
      'overflow: hidden',
    ];

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

    // Handle borders - default to black borders like Word
    const borderColor = (attrs as any).borderColor ? `#${(attrs as any).borderColor}` : '#000000';
    const borders = (attrs as any).borders;
    if (borders) {
      // Individual border control
      styles.push(`border-top: ${borders.top ? '1px solid ' + borderColor : 'none'}`);
      styles.push(`border-bottom: ${borders.bottom ? '1px solid ' + borderColor : 'none'}`);
      styles.push(`border-left: ${borders.left ? '1px solid ' + borderColor : 'none'}`);
      styles.push(`border-right: ${borders.right ? '1px solid ' + borderColor : 'none'}`);
    } else {
      // Default: all borders with black color (like Word)
      styles.push(`border: 1px solid ${borderColor}`);
    }

    if (attrs.verticalAlign) {
      domAttrs['data-valign'] = attrs.verticalAlign;
      styles.push(`vertical-align: ${attrs.verticalAlign}`);
    }

    // Background color - default to light gray for headers
    if (attrs.backgroundColor) {
      domAttrs['data-bgcolor'] = attrs.backgroundColor;
      styles.push(`background-color: #${attrs.backgroundColor}`);
    } else {
      styles.push('background-color: #f5f5f5');
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
