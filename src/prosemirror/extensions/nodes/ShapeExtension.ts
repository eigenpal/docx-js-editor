/**
 * Shape Extension — inline shape node
 *
 * Renders basic shapes (rect, ellipse, line, etc.) as inline SVG elements.
 * Supports fill color, outline, transforms, and selection.
 */

import { createNodeExtension } from '../create';

export interface ShapeAttrs {
  /** Shape type preset */
  shapeType?: string;
  /** Unique identifier */
  shapeId?: string;
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Fill color as CSS color */
  fillColor?: string;
  /** Fill type: none, solid, gradient */
  fillType?: string;
  /** Gradient type: linear, radial, rectangular, path */
  gradientType?: string;
  /** Gradient angle in degrees (for linear) */
  gradientAngle?: number;
  /** Gradient stops as JSON string: [{position, color}] */
  gradientStops?: string;
  /** Outline width in pixels */
  outlineWidth?: number;
  /** Outline color as CSS color */
  outlineColor?: string;
  /** Outline style */
  outlineStyle?: string;
  /** CSS transform */
  transform?: string;
  /** Display mode */
  displayMode?: 'inline' | 'float' | 'block';
  /** CSS float */
  cssFloat?: 'left' | 'right' | 'none';
  /** Wrap type */
  wrapType?: string;
  /** Shadow color as CSS color */
  shadowColor?: string;
  /** Shadow blur radius in pixels */
  shadowBlur?: number;
  /** Shadow X offset in pixels */
  shadowOffsetX?: number;
  /** Shadow Y offset in pixels */
  shadowOffsetY?: number;
  /** Glow color as CSS color */
  glowColor?: string;
  /** Glow radius in pixels */
  glowRadius?: number;
}

/**
 * Build SVG path for a shape type
 */
function getShapeSVG(type: string, w: number, h: number): string {
  switch (type) {
    case 'ellipse':
    case 'oval':
      return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" />`;
    case 'roundRect':
      return `<rect x="0" y="0" width="${w}" height="${h}" rx="${Math.min(w, h) * 0.1}" />`;
    case 'triangle':
    case 'isosTriangle':
      return `<polygon points="${w / 2},0 ${w},${h} 0,${h}" />`;
    case 'diamond':
      return `<polygon points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}" />`;
    case 'line':
    case 'straightConnector1':
      return `<line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" />`;
    case 'rect':
    default:
      return `<rect x="0" y="0" width="${w}" height="${h}" />`;
  }
}

/**
 * Build SVG gradient <defs> content from shape attrs
 */
function buildSVGGradientDef(gradId: string, attrs: ShapeAttrs): string {
  let stops = '';
  try {
    const parsed = JSON.parse(attrs.gradientStops || '[]') as Array<{
      position: number;
      color: string;
    }>;
    stops = parsed
      .map((s) => `<stop offset="${Math.round(s.position / 1000)}%" stop-color="${s.color}" />`)
      .join('');
  } catch {
    return '';
  }

  const gType = attrs.gradientType || 'linear';

  if (gType === 'radial' || gType === 'rectangular' || gType === 'path') {
    return `<radialGradient id="${gradId}" cx="50%" cy="50%" r="50%">${stops}</radialGradient>`;
  }

  // Linear gradient — convert angle to SVG coordinates
  const angle = attrs.gradientAngle || 0;
  const rad = ((angle - 90) * Math.PI) / 180;
  const x1 = Math.round(50 + 50 * Math.cos(rad + Math.PI));
  const y1 = Math.round(50 + 50 * Math.sin(rad + Math.PI));
  const x2 = Math.round(50 + 50 * Math.cos(rad));
  const y2 = Math.round(50 + 50 * Math.sin(rad));

  return `<linearGradient id="${gradId}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stops}</linearGradient>`;
}

export const ShapeExtension = createNodeExtension({
  name: 'shape',
  schemaNodeName: 'shape',
  nodeSpec: {
    inline: true,
    group: 'inline',
    draggable: true,
    atom: true,
    attrs: {
      shapeType: { default: 'rect' },
      shapeId: { default: null },
      width: { default: 100 },
      height: { default: 80 },
      fillColor: { default: null },
      fillType: { default: 'solid' },
      gradientType: { default: null },
      gradientAngle: { default: null },
      gradientStops: { default: null },
      outlineWidth: { default: 1 },
      outlineColor: { default: '#000000' },
      outlineStyle: { default: 'solid' },
      transform: { default: null },
      displayMode: { default: 'inline' },
      cssFloat: { default: null },
      wrapType: { default: 'inline' },
      shadowColor: { default: null },
      shadowBlur: { default: null },
      shadowOffsetX: { default: null },
      shadowOffsetY: { default: null },
      glowColor: { default: null },
      glowRadius: { default: null },
    },
    parseDOM: [
      {
        tag: 'span.docx-shape',
        getAttrs(dom): ShapeAttrs {
          const el = dom as HTMLElement;
          return {
            shapeType: el.dataset.shapeType || 'rect',
            shapeId: el.dataset.shapeId || undefined,
            width: el.dataset.width ? Number(el.dataset.width) : undefined,
            height: el.dataset.height ? Number(el.dataset.height) : undefined,
            fillColor: el.dataset.fillColor || undefined,
            fillType: el.dataset.fillType || 'solid',
            gradientType: el.dataset.gradientType || undefined,
            gradientAngle: el.dataset.gradientAngle ? Number(el.dataset.gradientAngle) : undefined,
            gradientStops: el.dataset.gradientStops || undefined,
            outlineWidth: el.dataset.outlineWidth ? Number(el.dataset.outlineWidth) : undefined,
            outlineColor: el.dataset.outlineColor || undefined,
            outlineStyle: el.dataset.outlineStyle || undefined,
            transform: el.dataset.transform || undefined,
            displayMode: (el.dataset.displayMode as ShapeAttrs['displayMode']) || undefined,
            cssFloat: (el.dataset.cssFloat as ShapeAttrs['cssFloat']) || undefined,
            wrapType: el.dataset.wrapType || undefined,
            shadowColor: el.dataset.shadowColor || undefined,
            shadowBlur: el.dataset.shadowBlur ? Number(el.dataset.shadowBlur) : undefined,
            shadowOffsetX: el.dataset.shadowOffsetX ? Number(el.dataset.shadowOffsetX) : undefined,
            shadowOffsetY: el.dataset.shadowOffsetY ? Number(el.dataset.shadowOffsetY) : undefined,
            glowColor: el.dataset.glowColor || undefined,
            glowRadius: el.dataset.glowRadius ? Number(el.dataset.glowRadius) : undefined,
          };
        },
      },
    ],
    toDOM(node) {
      const attrs = node.attrs as ShapeAttrs;
      const w = attrs.width || 100;
      const h = attrs.height || 80;

      const domAttrs: Record<string, string> = {
        class: 'docx-shape',
        'data-shape-type': attrs.shapeType || 'rect',
      };

      // Data attributes for round-trip
      if (attrs.shapeId) domAttrs['data-shape-id'] = attrs.shapeId;
      domAttrs['data-width'] = String(w);
      domAttrs['data-height'] = String(h);
      if (attrs.fillColor) domAttrs['data-fill-color'] = attrs.fillColor;
      if (attrs.fillType) domAttrs['data-fill-type'] = attrs.fillType;
      if (attrs.gradientType) domAttrs['data-gradient-type'] = attrs.gradientType;
      if (attrs.gradientAngle != null)
        domAttrs['data-gradient-angle'] = String(attrs.gradientAngle);
      if (attrs.gradientStops) domAttrs['data-gradient-stops'] = attrs.gradientStops;
      if (attrs.outlineWidth) domAttrs['data-outline-width'] = String(attrs.outlineWidth);
      if (attrs.outlineColor) domAttrs['data-outline-color'] = attrs.outlineColor;
      if (attrs.outlineStyle) domAttrs['data-outline-style'] = attrs.outlineStyle;
      if (attrs.transform) domAttrs['data-transform'] = attrs.transform;
      if (attrs.displayMode) domAttrs['data-display-mode'] = attrs.displayMode;
      if (attrs.cssFloat) domAttrs['data-css-float'] = attrs.cssFloat;
      if (attrs.wrapType) domAttrs['data-wrap-type'] = attrs.wrapType;
      if (attrs.shadowColor) domAttrs['data-shadow-color'] = attrs.shadowColor;
      if (attrs.shadowBlur != null) domAttrs['data-shadow-blur'] = String(attrs.shadowBlur);
      if (attrs.shadowOffsetX != null)
        domAttrs['data-shadow-offset-x'] = String(attrs.shadowOffsetX);
      if (attrs.shadowOffsetY != null)
        domAttrs['data-shadow-offset-y'] = String(attrs.shadowOffsetY);
      if (attrs.glowColor) domAttrs['data-glow-color'] = attrs.glowColor;
      if (attrs.glowRadius != null) domAttrs['data-glow-radius'] = String(attrs.glowRadius);

      // Build styles
      const styles: string[] = [
        'display: inline-block',
        `width: ${w}px`,
        `height: ${h}px`,
        'vertical-align: middle',
        'line-height: 0',
      ];

      if (attrs.transform) {
        styles.push(`transform: ${attrs.transform}`);
      }

      if (attrs.displayMode === 'float' && attrs.cssFloat && attrs.cssFloat !== 'none') {
        styles.push(`float: ${attrs.cssFloat}`);
        styles.push('margin: 4px 8px');
      } else if (attrs.displayMode === 'block') {
        styles.push('display: block');
        styles.push('margin: 4px auto');
      }

      // Shadow via CSS box-shadow on the container
      if (attrs.shadowColor) {
        const sx = attrs.shadowOffsetX || 2;
        const sy = attrs.shadowOffsetY || 2;
        const sb = attrs.shadowBlur || 4;
        styles.push(`filter: drop-shadow(${sx}px ${sy}px ${sb}px ${attrs.shadowColor})`);
      }

      // Glow via CSS filter
      if (attrs.glowColor && attrs.glowRadius) {
        const existingFilter = styles.find((s) => s.startsWith('filter:'));
        const glowFilter = `drop-shadow(0 0 ${attrs.glowRadius}px ${attrs.glowColor})`;
        if (existingFilter) {
          // Append glow to existing filter
          const idx = styles.indexOf(existingFilter);
          styles[idx] = existingFilter + ' ' + glowFilter;
        } else {
          styles.push(`filter: ${glowFilter}`);
        }
      }

      domAttrs.style = styles.join('; ');

      // Build SVG gradient defs if needed
      let svgDefs = '';
      let fill: string;

      if (attrs.fillType === 'gradient' && attrs.gradientStops) {
        const gradId = `grad-${attrs.shapeId || Math.random().toString(36).slice(2, 8)}`;
        fill = `url(#${gradId})`;
        svgDefs = buildSVGGradientDef(gradId, attrs);
      } else {
        fill = attrs.fillType === 'none' ? 'none' : attrs.fillColor || '#ffffff';
      }

      const strokeWidth = attrs.outlineWidth || 1;
      const strokeColor = attrs.outlineColor || '#000000';
      const strokeDash =
        attrs.outlineStyle === 'dashed'
          ? ' stroke-dasharray="8 4"'
          : attrs.outlineStyle === 'dotted'
            ? ' stroke-dasharray="2 2"'
            : '';

      const svgContent = getShapeSVG(attrs.shapeType || 'rect', w, h);

      // Create SVG element as innerHTML
      const svgHtml =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ` +
        `style="fill:${fill};stroke:${strokeColor};stroke-width:${strokeWidth}${strokeDash}">` +
        (svgDefs ? `<defs>${svgDefs}</defs>` : '') +
        svgContent +
        `</svg>`;

      // Use a span wrapper with innerHTML
      // ProseMirror will handle this as an atom node
      const span = document.createElement('span');
      Object.entries(domAttrs).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
      span.innerHTML = svgHtml;

      return { dom: span };
    },
  },
});
