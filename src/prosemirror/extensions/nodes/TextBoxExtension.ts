/**
 * TextBox Extension — editable text box node
 *
 * An isolating block node that contains paragraphs (and tables).
 * Rendered as a positioned container with optional fill, outline, and margins.
 * Supports inline and floating positioning.
 */

import { createNodeExtension } from '../create';

export interface TextBoxAttrs {
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Unique identifier */
  textBoxId?: string;
  /** Fill color as CSS color */
  fillColor?: string;
  /** Outline width in pixels */
  outlineWidth?: number;
  /** Outline color as CSS color */
  outlineColor?: string;
  /** Outline style */
  outlineStyle?: string;
  /** Internal margin top in pixels */
  marginTop?: number;
  /** Internal margin bottom in pixels */
  marginBottom?: number;
  /** Internal margin left in pixels */
  marginLeft?: number;
  /** Internal margin right in pixels */
  marginRight?: number;
  /** Vertical text alignment */
  verticalAlign?: string;
  /** Display mode */
  displayMode?: 'inline' | 'float' | 'block';
  /** CSS float direction */
  cssFloat?: 'left' | 'right' | 'none';
  /** Wrap type */
  wrapType?: string;
}

export const TextBoxExtension = createNodeExtension({
  name: 'textBox',
  schemaNodeName: 'textBox',
  nodeSpec: {
    group: 'block',
    content: '(paragraph | table)+',
    isolating: true,
    draggable: true,
    attrs: {
      width: { default: 200 },
      height: { default: null },
      textBoxId: { default: null },
      fillColor: { default: null },
      outlineWidth: { default: null },
      outlineColor: { default: null },
      outlineStyle: { default: null },
      marginTop: { default: 4 },
      marginBottom: { default: 4 },
      marginLeft: { default: 7 },
      marginRight: { default: 7 },
      verticalAlign: { default: null },
      displayMode: { default: 'inline' },
      cssFloat: { default: null },
      wrapType: { default: 'inline' },
    },
    parseDOM: [
      {
        tag: 'div.docx-textbox',
        getAttrs(dom): TextBoxAttrs {
          const el = dom as HTMLElement;
          return {
            width: el.dataset.width ? Number(el.dataset.width) : undefined,
            height: el.dataset.height ? Number(el.dataset.height) : undefined,
            textBoxId: el.dataset.textboxId || undefined,
            fillColor: el.dataset.fillColor || undefined,
            outlineWidth: el.dataset.outlineWidth ? Number(el.dataset.outlineWidth) : undefined,
            outlineColor: el.dataset.outlineColor || undefined,
            outlineStyle: el.dataset.outlineStyle || undefined,
            marginTop: el.dataset.marginTop ? Number(el.dataset.marginTop) : undefined,
            marginBottom: el.dataset.marginBottom ? Number(el.dataset.marginBottom) : undefined,
            marginLeft: el.dataset.marginLeft ? Number(el.dataset.marginLeft) : undefined,
            marginRight: el.dataset.marginRight ? Number(el.dataset.marginRight) : undefined,
            verticalAlign: el.dataset.verticalAlign || undefined,
            displayMode: (el.dataset.displayMode as TextBoxAttrs['displayMode']) || undefined,
            cssFloat: (el.dataset.cssFloat as TextBoxAttrs['cssFloat']) || undefined,
            wrapType: el.dataset.wrapType || undefined,
          };
        },
      },
    ],
    toDOM(node) {
      const attrs = node.attrs as TextBoxAttrs;
      const domAttrs: Record<string, string> = {
        class: 'docx-textbox',
      };

      // Data attributes for round-trip
      if (attrs.width) domAttrs['data-width'] = String(attrs.width);
      if (attrs.height) domAttrs['data-height'] = String(attrs.height);
      if (attrs.textBoxId) domAttrs['data-textbox-id'] = attrs.textBoxId;
      if (attrs.fillColor) domAttrs['data-fill-color'] = attrs.fillColor;
      if (attrs.outlineWidth) domAttrs['data-outline-width'] = String(attrs.outlineWidth);
      if (attrs.outlineColor) domAttrs['data-outline-color'] = attrs.outlineColor;
      if (attrs.outlineStyle) domAttrs['data-outline-style'] = attrs.outlineStyle;
      if (attrs.marginTop != null) domAttrs['data-margin-top'] = String(attrs.marginTop);
      if (attrs.marginBottom != null) domAttrs['data-margin-bottom'] = String(attrs.marginBottom);
      if (attrs.marginLeft != null) domAttrs['data-margin-left'] = String(attrs.marginLeft);
      if (attrs.marginRight != null) domAttrs['data-margin-right'] = String(attrs.marginRight);
      if (attrs.verticalAlign) domAttrs['data-vertical-align'] = attrs.verticalAlign;
      if (attrs.displayMode) domAttrs['data-display-mode'] = attrs.displayMode;
      if (attrs.cssFloat) domAttrs['data-css-float'] = attrs.cssFloat;
      if (attrs.wrapType) domAttrs['data-wrap-type'] = attrs.wrapType;

      // Build inline styles
      const styles: string[] = [];

      if (attrs.width) styles.push(`width: ${attrs.width}px`);
      if (attrs.height) styles.push(`min-height: ${attrs.height}px`);

      // Background
      if (attrs.fillColor) {
        styles.push(`background-color: ${attrs.fillColor}`);
      }

      // Border/outline
      if (attrs.outlineWidth && attrs.outlineWidth > 0) {
        const style = attrs.outlineStyle || 'solid';
        const color = attrs.outlineColor || '#000000';
        styles.push(`border: ${attrs.outlineWidth}px ${style} ${color}`);
      } else {
        // Default thin border for text boxes
        styles.push('border: 1px solid var(--doc-border, #d1d5db)');
      }

      // Internal margins/padding
      const mt = attrs.marginTop ?? 4;
      const mb = attrs.marginBottom ?? 4;
      const ml = attrs.marginLeft ?? 7;
      const mr = attrs.marginRight ?? 7;
      styles.push(`padding: ${mt}px ${mr}px ${mb}px ${ml}px`);

      // Vertical alignment
      if (attrs.verticalAlign === 'middle' || attrs.verticalAlign === 'center') {
        styles.push('display: flex');
        styles.push('flex-direction: column');
        styles.push('justify-content: center');
      } else if (attrs.verticalAlign === 'bottom') {
        styles.push('display: flex');
        styles.push('flex-direction: column');
        styles.push('justify-content: flex-end');
      }

      // Float/positioning
      if (attrs.displayMode === 'float' && attrs.cssFloat && attrs.cssFloat !== 'none') {
        styles.push(`float: ${attrs.cssFloat}`);
        styles.push('margin: 4px 8px');
      } else if (attrs.displayMode === 'block') {
        styles.push('margin-left: auto');
        styles.push('margin-right: auto');
      }

      // Box sizing
      styles.push('box-sizing: border-box');
      styles.push('overflow: hidden');
      styles.push('position: relative');

      domAttrs.style = styles.join('; ');

      return ['div', domAttrs, 0];
    },
  },
});
