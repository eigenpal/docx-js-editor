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
import type { ParagraphAlignment, LineSpacingRule } from '../../types/document';
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
  content: '(paragraph | horizontalRule)+',
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
    // Render as a span with fixed minimum width (0.5 inch = 48px default tab stop)
    return [
      'span',
      {
        class: 'docx-tab',
        style: 'display: inline-block; min-width: 48px; white-space: pre;',
      },
      '\t',
    ];
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
};
