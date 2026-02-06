/**
 * Underline Mark Extension
 */

import { toggleMark } from 'prosemirror-commands';
import { createMarkExtension } from '../create';
import { setMark } from './markUtils';
import type { TextColorAttrs } from '../../schema/marks';
import type { UnderlineAttrs } from '../../schema/marks';
import type { ExtensionContext, ExtensionRuntime } from '../types';

export const UnderlineExtension = createMarkExtension({
  name: 'underline',
  schemaMarkName: 'underline',
  markSpec: {
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

      if (attrs.color?.rgb) {
        cssStyle.push(`text-decoration-color: #${attrs.color.rgb}`);
      }

      return ['span', { style: cssStyle.join('; ') }, 0];
    },
  },
  onSchemaReady(ctx: ExtensionContext): ExtensionRuntime {
    return {
      commands: {
        toggleUnderline: () => toggleMark(ctx.schema.marks.underline),
        setUnderlineStyle: (style: string, color?: TextColorAttrs) =>
          setMark(ctx.schema.marks.underline, { style, color }),
      },
      keyboardShortcuts: {
        'Mod-u': toggleMark(ctx.schema.marks.underline),
      },
    };
  },
});
