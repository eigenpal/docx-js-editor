/**
 * ProseMirror Mark Specifications
 *
 * Defines marks for text formatting:
 * - bold, italic, underline, strike - basic formatting
 * - textColor, highlight - color formatting
 * - fontSize, fontFamily - font properties
 * - superscript, subscript - vertical alignment
 * - hyperlink - links
 */

import type { MarkSpec } from 'prosemirror-model';
import type { UnderlineStyle, ThemeColorSlot } from '../../types/document';
import { textToStyle } from '../../utils/formatToStyle';

/**
 * Text color mark attributes
 */
export interface TextColorAttrs {
  rgb?: string;
  themeColor?: ThemeColorSlot;
  themeTint?: string;
  themeShade?: string;
}

/**
 * Underline mark attributes
 */
export interface UnderlineAttrs {
  style?: UnderlineStyle;
  color?: TextColorAttrs;
}

/**
 * Font size mark attributes
 */
export interface FontSizeAttrs {
  size: number; // in half-points (OOXML format)
}

/**
 * Font family mark attributes
 */
export interface FontFamilyAttrs {
  ascii?: string;
  hAnsi?: string;
  asciiTheme?: string;
}

/**
 * Hyperlink mark attributes
 */
export interface HyperlinkAttrs {
  href: string;
  tooltip?: string;
  rId?: string;
}

/**
 * Bold mark - simple toggle
 */
export const bold: MarkSpec = {
  parseDOM: [
    { tag: 'strong' },
    { tag: 'b' },
    {
      style: 'font-weight',
      getAttrs: (value) => (/^(bold(er)?|[5-9]\d{2})$/.test(value as string) ? null : false),
    },
  ],
  toDOM() {
    return ['strong', 0];
  },
};

/**
 * Italic mark - simple toggle
 */
export const italic: MarkSpec = {
  parseDOM: [
    { tag: 'i' },
    { tag: 'em' },
    {
      style: 'font-style',
      getAttrs: (value) => (value === 'italic' ? null : false),
    },
  ],
  toDOM() {
    return ['em', 0];
  },
};

/**
 * Underline mark - with style and color
 */
export const underline: MarkSpec = {
  attrs: {
    style: { default: 'single' },
    color: { default: null },
  },
  parseDOM: [
    { tag: 'u' },
    {
      style: 'text-decoration',
      getAttrs: (value) => ((value as string).includes('underline') ? {} : false),
    },
  ],
  toDOM(mark) {
    const attrs = mark.attrs as UnderlineAttrs;
    const cssStyle: string[] = ['text-decoration: underline'];

    // Map underline style to CSS
    if (attrs.style && attrs.style !== 'single') {
      const styleMap: Record<string, string> = {
        double: 'double',
        dotted: 'dotted',
        dash: 'dashed',
        wave: 'wavy',
      };
      const cssDecorationStyle = styleMap[attrs.style];
      if (cssDecorationStyle) {
        cssStyle.push(`text-decoration-style: ${cssDecorationStyle}`);
      }
    }

    // Add underline color if specified
    if (attrs.color?.rgb) {
      cssStyle.push(`text-decoration-color: #${attrs.color.rgb}`);
    }

    return ['span', { style: cssStyle.join('; ') }, 0];
  },
};

/**
 * Strikethrough mark
 */
export const strike: MarkSpec = {
  attrs: {
    double: { default: false },
  },
  parseDOM: [
    { tag: 's' },
    { tag: 'strike' },
    { tag: 'del' },
    {
      style: 'text-decoration',
      getAttrs: (value) => ((value as string).includes('line-through') ? {} : false),
    },
  ],
  toDOM() {
    return ['s', 0];
  },
};

/**
 * Text color mark
 */
export const textColor: MarkSpec = {
  attrs: {
    rgb: { default: null },
    themeColor: { default: null },
    themeTint: { default: null },
    themeShade: { default: null },
  },
  parseDOM: [
    {
      style: 'color',
      getAttrs: (value) => {
        const colorValue = value as string;
        // Extract hex color from CSS
        const hexMatch = colorValue.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
        if (hexMatch) {
          return { rgb: hexMatch[1].toUpperCase() };
        }
        return false;
      },
    },
  ],
  toDOM(mark) {
    const attrs = mark.attrs as TextColorAttrs;
    const style = textToStyle({ color: attrs });
    const cssString = style.color ? `color: ${style.color}` : '';
    return ['span', { style: cssString }, 0];
  },
};

/**
 * Highlight/background color mark
 */
export const highlight: MarkSpec = {
  attrs: {
    color: { default: 'yellow' },
  },
  parseDOM: [
    {
      tag: 'mark',
    },
    {
      style: 'background-color',
      getAttrs: (value) => {
        if (value && value !== 'transparent' && value !== 'inherit') {
          return { color: value };
        }
        return false;
      },
    },
  ],
  toDOM(mark) {
    const color = mark.attrs.color as string;
    return ['mark', { style: `background-color: ${color}` }, 0];
  },
};

/**
 * Font size mark - stores size in half-points for OOXML fidelity
 */
export const fontSize: MarkSpec = {
  attrs: {
    size: { default: 24 }, // 12pt default (24 half-points)
  },
  parseDOM: [
    {
      style: 'font-size',
      getAttrs: (value) => {
        const sizeStr = value as string;
        // Convert px/pt to half-points
        const pxMatch = sizeStr.match(/^([\d.]+)px$/);
        if (pxMatch) {
          const px = parseFloat(pxMatch[1]);
          const pt = px * 0.75; // Approximate px to pt
          return { size: Math.round(pt * 2) };
        }
        const ptMatch = sizeStr.match(/^([\d.]+)pt$/);
        if (ptMatch) {
          return { size: Math.round(parseFloat(ptMatch[1]) * 2) };
        }
        return false;
      },
    },
  ],
  toDOM(mark) {
    const size = mark.attrs.size as number;
    const pt = size / 2;
    // Word uses 1.15x line-height for single line spacing
    const lineHeight = (pt * 1.15).toFixed(2);
    return ['span', { style: `font-size: ${pt}pt; line-height: ${lineHeight}pt` }, 0];
  },
};

/**
 * Font family mark
 */
export const fontFamily: MarkSpec = {
  attrs: {
    ascii: { default: null },
    hAnsi: { default: null },
    asciiTheme: { default: null },
  },
  parseDOM: [
    {
      style: 'font-family',
      getAttrs: (value) => {
        const fontValue = value as string;
        // Extract first font from font-family list
        const firstFont = fontValue.split(',')[0].trim().replace(/['"]/g, '');
        if (firstFont) {
          return { ascii: firstFont };
        }
        return false;
      },
    },
  ],
  toDOM(mark) {
    const attrs = mark.attrs as FontFamilyAttrs;
    const fontName = attrs.ascii || attrs.hAnsi;
    if (!fontName) {
      return ['span', 0];
    }
    // Quote font names with spaces
    const quotedFont = fontName.includes(' ') ? `"${fontName}"` : fontName;
    return ['span', { style: `font-family: ${quotedFont}, sans-serif` }, 0];
  },
};

/**
 * Superscript mark
 */
export const superscript: MarkSpec = {
  excludes: 'subscript',
  parseDOM: [{ tag: 'sup' }],
  toDOM() {
    return ['sup', 0];
  },
};

/**
 * Subscript mark
 */
export const subscript: MarkSpec = {
  excludes: 'superscript',
  parseDOM: [{ tag: 'sub' }],
  toDOM() {
    return ['sub', 0];
  },
};

/**
 * Hyperlink mark
 */
export const hyperlink: MarkSpec = {
  attrs: {
    href: {},
    tooltip: { default: null },
    rId: { default: null },
  },
  inclusive: false,
  parseDOM: [
    {
      tag: 'a[href]',
      getAttrs: (dom) => {
        const element = dom as HTMLAnchorElement;
        return {
          href: element.getAttribute('href') || '',
          tooltip: element.getAttribute('title') || undefined,
        };
      },
    },
  ],
  toDOM(mark) {
    const attrs = mark.attrs as HyperlinkAttrs;
    const domAttrs: Record<string, string> = {
      href: attrs.href,
      target: '_blank',
      rel: 'noopener noreferrer',
    };
    if (attrs.tooltip) {
      domAttrs.title = attrs.tooltip;
    }
    return ['a', domAttrs, 0];
  },
};

/**
 * All caps mark (w:caps) - transforms text to uppercase
 */
export const allCaps: MarkSpec = {
  parseDOM: [
    {
      style: 'text-transform',
      getAttrs: (value) => (value === 'uppercase' ? {} : false),
    },
  ],
  toDOM() {
    return ['span', { style: 'text-transform: uppercase' }, 0];
  },
};

/**
 * Small caps mark (w:smallCaps) - displays lowercase as smaller capitals
 */
export const smallCaps: MarkSpec = {
  parseDOM: [
    {
      style: 'font-variant',
      getAttrs: (value) => (value === 'small-caps' ? {} : false),
    },
  ],
  toDOM() {
    return ['span', { style: 'font-variant: small-caps' }, 0];
  },
};

/**
 * Footnote reference mark - displays as superscript number
 */
export const footnoteRef: MarkSpec = {
  attrs: {
    id: {},
    noteType: { default: 'footnote' }, // 'footnote' or 'endnote'
  },
  parseDOM: [
    {
      tag: 'sup.docx-footnote-ref',
      getAttrs: (dom) => {
        const element = dom as HTMLElement;
        return {
          id: element.dataset.id || '',
          noteType: element.dataset.noteType || 'footnote',
        };
      },
    },
  ],
  toDOM(mark) {
    const attrs = mark.attrs as { id: string; noteType: string };
    return [
      'sup',
      {
        class: `docx-${attrs.noteType}-ref`,
        'data-id': attrs.id,
        'data-note-type': attrs.noteType,
      },
      0,
    ];
  },
};

/**
 * All mark specifications
 */
export const marks = {
  bold,
  italic,
  underline,
  strike,
  textColor,
  highlight,
  fontSize,
  fontFamily,
  superscript,
  subscript,
  allCaps,
  smallCaps,
  hyperlink,
  footnoteRef,
};
