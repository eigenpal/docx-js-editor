/**
 * Additional Text Effect Mark Extensions
 *
 * Emboss (w:emboss), Imprint/Engrave (w:imprint), Text Shadow (w:shadow),
 * Emphasis Marks (w:em), Text Outline (w:outline)
 */

import { createMarkExtension } from '../create';

/**
 * Emboss — raised text effect via text-shadow
 */
export const EmbossExtension = createMarkExtension({
  name: 'emboss',
  schemaMarkName: 'emboss',
  markSpec: {
    parseDOM: [{ tag: 'span.docx-emboss' }],
    toDOM() {
      return [
        'span',
        {
          class: 'docx-emboss',
          style: 'text-shadow: 1px 1px 1px rgba(255,255,255,0.5), -1px -1px 1px rgba(0,0,0,0.3)',
        },
        0,
      ];
    },
  },
});

/**
 * Imprint/Engrave — engraved text effect via text-shadow
 */
export const ImprintExtension = createMarkExtension({
  name: 'imprint',
  schemaMarkName: 'imprint',
  markSpec: {
    parseDOM: [{ tag: 'span.docx-imprint' }],
    toDOM() {
      return [
        'span',
        {
          class: 'docx-imprint',
          style: '-1px -1px 1px rgba(255,255,255,0.5), 1px 1px 1px rgba(0,0,0,0.3)',
        },
        0,
      ];
    },
  },
});

/**
 * Text Shadow (w:shadow) — subtle drop shadow on text
 */
export const TextShadowExtension = createMarkExtension({
  name: 'textShadow',
  schemaMarkName: 'textShadow',
  markSpec: {
    parseDOM: [{ tag: 'span.docx-text-shadow' }],
    toDOM() {
      return [
        'span',
        {
          class: 'docx-text-shadow',
          style: 'text-shadow: 1px 1px 2px rgba(0,0,0,0.3)',
        },
        0,
      ];
    },
  },
});

/**
 * Emphasis Mark (w:em) — dot/circle/comma above/below text
 */
export const EmphasisMarkExtension = createMarkExtension({
  name: 'emphasisMark',
  schemaMarkName: 'emphasisMark',
  markSpec: {
    attrs: {
      type: { default: 'dot' },
    },
    parseDOM: [
      {
        tag: 'span.docx-emphasis-mark',
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          return { type: el.dataset.emType || 'dot' };
        },
      },
    ],
    toDOM(mark) {
      const emType = mark.attrs.type as string;
      // CSS text-emphasis for emphasis marks
      let emStyle = 'filled dot';
      switch (emType) {
        case 'dot':
          emStyle = 'filled dot';
          break;
        case 'comma':
          emStyle = 'filled sesame';
          break;
        case 'circle':
          emStyle = 'filled circle';
          break;
        case 'underDot':
          emStyle = 'filled dot';
          break;
      }
      const position = emType === 'underDot' ? 'under right' : 'over right';
      return [
        'span',
        {
          class: 'docx-emphasis-mark',
          'data-em-type': emType,
          style: `text-emphasis: ${emStyle}; text-emphasis-position: ${position}; -webkit-text-emphasis: ${emStyle}; -webkit-text-emphasis-position: ${position}`,
        },
        0,
      ];
    },
  },
});

/**
 * Text Outline (w:outline) — outlined text with no fill
 */
export const TextOutlineExtension = createMarkExtension({
  name: 'textOutline',
  schemaMarkName: 'textOutline',
  markSpec: {
    parseDOM: [{ tag: 'span.docx-text-outline' }],
    toDOM() {
      return [
        'span',
        {
          class: 'docx-text-outline',
          style: '-webkit-text-stroke: 1px currentColor; -webkit-text-fill-color: transparent',
        },
        0,
      ];
    },
  },
});
