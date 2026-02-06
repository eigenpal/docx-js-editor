/**
 * Font Family Mark Extension
 */

import { createMarkExtension } from '../create';
import { setMark, removeMark } from './markUtils';
import type { FontFamilyAttrs } from '../../schema/marks';
import type { ExtensionContext, ExtensionRuntime } from '../types';

export const FontFamilyExtension = createMarkExtension({
  name: 'fontFamily',
  schemaMarkName: 'fontFamily',
  markSpec: {
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
      const quotedFont = fontName.includes(' ') ? `"${fontName}"` : fontName;
      return ['span', { style: `font-family: ${quotedFont}, sans-serif` }, 0];
    },
  },
  onSchemaReady(ctx: ExtensionContext): ExtensionRuntime {
    return {
      commands: {
        setFontFamily: (fontName: string) =>
          setMark(ctx.schema.marks.fontFamily, { ascii: fontName, hAnsi: fontName }),
        clearFontFamily: () => removeMark(ctx.schema.marks.fontFamily),
      },
    };
  },
});
