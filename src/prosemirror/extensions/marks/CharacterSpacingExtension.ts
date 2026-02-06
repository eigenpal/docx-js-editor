/**
 * Character Spacing Mark Extension
 *
 * Handles: character spacing (w:spacing), position/raise-lower (w:position),
 * horizontal scale (w:w), and kerning (w:kern).
 *
 * Single mark with multiple attributes to avoid mark explosion.
 */

import { createMarkExtension } from '../create';
import { twipsToPixels, formatPx } from '../../../utils/units';

function halfPointsToPixels(halfPoints: number): number {
  return (halfPoints / 2) * (96 / 72);
}

export const CharacterSpacingExtension = createMarkExtension({
  name: 'characterSpacing',
  schemaMarkName: 'characterSpacing',
  markSpec: {
    attrs: {
      spacing: { default: null }, // twips
      position: { default: null }, // half-points (raise/lower)
      scale: { default: null }, // percentage
      kerning: { default: null }, // half-points
    },
    parseDOM: [
      {
        tag: 'span.docx-char-spacing',
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          return {
            spacing: el.dataset.spacing ? Number(el.dataset.spacing) : null,
            position: el.dataset.position ? Number(el.dataset.position) : null,
            scale: el.dataset.scale ? Number(el.dataset.scale) : null,
            kerning: el.dataset.kerning ? Number(el.dataset.kerning) : null,
          };
        },
      },
    ],
    toDOM(mark) {
      const attrs = mark.attrs as {
        spacing: number | null;
        position: number | null;
        scale: number | null;
        kerning: number | null;
      };

      const styles: string[] = [];
      const dataAttrs: Record<string, string> = {
        class: 'docx-char-spacing',
      };

      if (attrs.spacing != null && attrs.spacing !== 0) {
        styles.push(`letter-spacing: ${formatPx(twipsToPixels(attrs.spacing))}`);
        dataAttrs['data-spacing'] = String(attrs.spacing);
      }

      if (attrs.position != null && attrs.position !== 0) {
        const px = halfPointsToPixels(attrs.position);
        styles.push(`vertical-align: ${formatPx(px)}`);
        dataAttrs['data-position'] = String(attrs.position);
      }

      if (attrs.scale != null && attrs.scale !== 100) {
        styles.push(`transform: scaleX(${attrs.scale / 100})`);
        styles.push('display: inline-block');
        dataAttrs['data-scale'] = String(attrs.scale);
      }

      if (attrs.kerning != null) {
        dataAttrs['data-kerning'] = String(attrs.kerning);
      }

      if (styles.length > 0) {
        dataAttrs.style = styles.join('; ');
      }

      return ['span', dataAttrs, 0];
    },
  },
});
