import { RELATIONSHIPS_NAMESPACE_URI, type OoxmlElement } from './ooxml-tree.ts';
import { legacyChromaKeyFilter } from './legacy-vml-chromakey.ts';
import {
  attribute as a,
  children,
  color,
  escapeXml as esc,
  named,
  numeric,
  off,
  OFFICE,
  pair,
  points,
  styleOf,
  VML,
  WORD_VML,
} from './legacy-vml-values.ts';

/** Only generated, escaped SVG and relationship slots; never authored markup. */
export type LegacyGraphicFragment =
  | string
  | Readonly<{ relationshipId: string; before: string; after: string }>;
export interface LegacyGraphicProjection {
  readonly width: number;
  readonly height: number;
  readonly fragments: readonly LegacyGraphicFragment[];
}
export interface LegacyBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function paint(
  node: OoxmlElement
): { fill: string; stroke: string; weight: number; strokeNode?: OoxmlElement } | null {
  const list = children(node);
  if (['fill', 'stroke', 'path'].some((name) => list.filter((n) => named(n, VML, name)).length > 1))
    return null;
  const fillNode = list.find((n) => named(n, VML, 'fill'));
  const strokeNode = list.find((n) => named(n, VML, 'stroke'));
  if (
    fillNode &&
    fillNode.attributes.some(
      (attr) => !['on', 'color', 'focussize'].includes(attr.localName) || attr.namespaceUri
    )
  )
    return null;
  if (
    strokeNode &&
    strokeNode.attributes.some(
      (attr) =>
        ![
          'on',
          'color',
          'weight',
          'joinstyle',
          'endarrow',
          'startarrow',
          'endarrowwidth',
          'endarrowlength',
          'startarrowwidth',
          'startarrowlength',
        ].includes(attr.localName) || attr.namespaceUri
    )
  )
    return null;
  const fill =
    off(a(node, 'filled')) || (fillNode && off(a(fillNode, 'on')))
      ? 'none'
      : color(
          fillNode ? (a(fillNode, 'color') ?? a(node, 'fillcolor')) : a(node, 'fillcolor'),
          '#ffffff'
        );
  const stroke =
    off(a(node, 'stroked')) || (strokeNode && off(a(strokeNode, 'on')))
      ? 'none'
      : color(
          strokeNode ? (a(strokeNode, 'color') ?? a(node, 'strokecolor')) : a(node, 'strokecolor'),
          '#000000'
        );
  const weight = points(
    (strokeNode ? a(strokeNode, 'weight') : undefined) ?? a(node, 'strokeweight') ?? '0.75pt'
  );
  return fill && stroke && Number.isFinite(weight) && weight >= 0 && weight <= 100
    ? { fill, stroke, weight, strokeNode }
    : null;
}

function wordArt(node: OoxmlElement, box: LegacyBox): string | null {
  if (a(node, 'type') !== '#_x0000_t136') return null;
  if (a(node, 'path') || (a(node, 'adj') && a(node, 'adj') !== '10800')) return null;
  const textNodes = children(node).filter((n) => named(n, VML, 'textpath'));
  if (textNodes.length !== 1) return null;
  const path = textNodes[0]!,
    style = styleOf(path),
    ink = paint(node);
  const text = a(path, 'string');
  if (
    !style ||
    !ink ||
    !text?.trim() ||
    text.length > 1024 ||
    /[\r\n]/.test(text) ||
    ['on', 'fitshape', 'fitpath'].some((key) => off(a(path, key)))
  )
    return null;
  for (const [key, value] of style) {
    if (
      ![
        'font-family',
        'font-size',
        'font-weight',
        'font-style',
        'v-text-align',
        'v-rotate-letters',
        'v-same-letter-heights',
      ].includes(key)
    )
      return null;
    if (key.startsWith('v-') && (key === 'v-text-align' ? value !== 'center' : !off(value)))
      return null;
  }
  const size = points(style.get('font-size')),
    face = style.get('font-family') ?? 'serif';
  const weight = style.get('font-weight') ?? 'normal',
    italic = style.get('font-style') ?? 'normal';
  if (
    !(size > 0 && size <= 400) ||
    face.length > 100 ||
    !['normal', 'bold', '400', '700'].includes(weight) ||
    !['normal', 'italic'].includes(italic)
  )
    return null;
  const span = Array.from(text).length * 1000;
  return `<svg x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" viewBox="0 -880 ${span} 1000" preserveAspectRatio="none"><text x="0" y="0" font-family="${esc(face)}" font-size="1000" font-weight="${weight}" font-style="${italic}" textLength="${span}" lengthAdjust="spacingAndGlyphs" fill="${ink.fill}" stroke="${ink.stroke}" stroke-width="${(ink.weight / size) * 1000}" stroke-linejoin="round">${esc(text)}</text></svg>`;
}

function arrow(
  pointsList: readonly [number, number][],
  start: boolean,
  stroke: OoxmlElement | undefined,
  color: string,
  weight: number
): string | null {
  const prefix = start ? 'startarrow' : 'endarrow';
  const type = stroke ? (a(stroke, prefix) ?? 'none') : 'none';
  if (type === 'none' || color === 'none') return '';
  if (!['block', 'classic', 'open'].includes(type)) return null;
  const widths = new Map([
    ['narrow', 2],
    ['medium', 3],
    ['wide', 5],
  ]);
  const lengths = new Map([
    ['short', 2],
    ['medium', 3],
    ['long', 5],
  ]);
  const w = widths.get(a(stroke!, prefix + 'width') ?? 'medium');
  const h = lengths.get(a(stroke!, prefix + 'length') ?? 'medium');
  if (!w || !h) return null;
  if (weight === 0) return '';
  const tip = pointsList[start ? 0 : pointsList.length - 1]!;
  const previous = pointsList[start ? 1 : pointsList.length - 2]!;
  const dx = previous[0] - tip[0],
    dy = previous[1] - tip[1],
    distance = Math.hypot(dx, dy);
  if (!distance) return '';
  const ux = dx / distance,
    uy = dy / distance,
    len = h * weight,
    half = (w * weight) / 2;
  const left = [tip[0] + ux * len - uy * half, tip[1] + uy * len + ux * half];
  const right = [tip[0] + ux * len + uy * half, tip[1] + uy * len - ux * half];
  const d = `M${left.join(',')} L${tip.join(',')} L${right.join(',')}`;
  const notch =
    type === 'classic' ? ` L${tip[0] + ux * len * 0.75},${tip[1] + uy * len * 0.75}` : '';
  return `<path d="${d}${notch}${type === 'open' ? '' : ' Z'}" fill="${type === 'open' ? 'none' : color}" stroke="${color}" stroke-width="${weight}" stroke-linejoin="round"/>`;
}

function pathPoints(node: OoxmlElement, box: LegacyBox): [number, number][] | null {
  const style = styleOf(node)!;
  let coords: [number, number][];
  const source = a(node, 'path');
  if (source) {
    // One move followed by explicit line segments. Curves, formulas, relative
    // commands and multiple subpaths remain opaque rather than an incomplete chart.
    const tokens = source.match(/[mlxez]|-?(?:\d+(?:\.\d*)?|\.\d+)/gi) ?? [];
    if (
      tokens.join('').toLowerCase() !== source.replace(/[,\s]/g, '').toLowerCase() ||
      tokens.length > 256 ||
      tokens[0]?.toLowerCase() !== 'm'
    )
      return null;
    coords = [];
    let i = 1;
    while (i < tokens.length) {
      const command = tokens[i]!.toLowerCase();
      if (command === 'l') {
        i++;
        continue;
      }
      if (command === 'e') {
        if (i !== tokens.length - 1) return null;
        break;
      }
      const x = numeric(tokens[i]),
        y = numeric(tokens[i + 1]);
      if (![x, y].every(Number.isFinite)) return null;
      coords.push([x, y]);
      i += 2;
    }
    const size = pair(a(node, 'coordsize') ?? '21600,21600'),
      origin = pair(a(node, 'coordorigin') ?? '0,0');
    if (!size || !origin || size.some((v) => v <= 0) || coords.length < 2) return null;
    coords = coords.map(([x, y]) => [
      ((x - origin[0]) * box.width) / size[0],
      ((y - origin[1]) * box.height) / size[1],
    ]);
  } else {
    if (a(node, 'from') || a(node, 'to')) return null;
    coords = [
      [0, 0],
      [box.width, box.height],
    ];
  }
  const flip = style.get('flip')?.split(/\s+/) ?? [];
  if (flip.some((v) => v !== 'x' && v !== 'y')) return null;
  return coords.map(([x, y]) => [
    box.x + (flip.includes('x') ? box.width - x : x),
    box.y + (flip.includes('y') ? box.height - y : y),
  ]);
}

export function legacyShapeFragment(
  node: OoxmlElement,
  box: LegacyBox,
  canvas: LegacyBox = box
): LegacyGraphicFragment | null {
  const inside = (x: number, y: number, padding = 0) =>
    x - padding >= canvas.x &&
    y - padding >= canvas.y &&
    x + padding <= canvas.x + canvas.width &&
    y + padding <= canvas.y + canvas.height;
  if (!inside(box.x, box.y) || !inside(box.x + box.width, box.y + box.height)) return null;
  const list = children(node);
  if (
    list.some(
      (n) =>
        !(
          n.namespaceUri === VML &&
          ['imagedata', 'textpath', 'fill', 'stroke', 'path'].includes(n.localName)
        ) &&
        !named(n, OFFICE, 'lock') &&
        !named(n, WORD_VML, 'wrap') &&
        !(named(n, WORD_VML, 'anchorlock') && n.attributes.length === 0)
    )
  )
    return null;
  if (list.some((n) => children(n).length)) return null;
  const data = list.filter((n) => named(n, VML, 'imagedata'));
  if (data.length > 1) return null;
  const type = a(node, 'type');
  if (type === '#_x0000_t136') {
    if (
      data.some((n) => n.attributes.some((attr) => attr.localName !== 'title' || attr.value !== ''))
    )
      return null;
    return wordArt(node, box);
  }
  if (list.some((n) => named(n, VML, 'textpath'))) return null;
  if (data.length) {
    if (type && type !== '#_x0000_t75') return null;
    // Do not silently drop picture outlines or custom geometry/fills.
    if (
      a(node, 'path') ||
      (a(node, 'stroked') && !off(a(node, 'stroked'))) ||
      list.some((n) => {
        if (named(n, VML, 'path')) return n.attributes.length !== 0;
        if (named(n, VML, 'fill')) {
          return (
            !off(a(n, 'on') ?? a(node, 'filled')) ||
            n.attributes.some(
              (attr) =>
                attr.namespaceUri ||
                !['on', 'focussize'].includes(attr.localName) ||
                (attr.localName === 'focussize' && attr.value !== '0,0')
            )
          );
        }
        if (named(n, VML, 'stroke')) {
          return (
            !off(a(n, 'on') ?? a(node, 'stroked')) ||
            n.attributes.some((attr) => attr.namespaceUri || attr.localName !== 'on')
          );
        }
        return false;
      })
    )
      return null;
    const image = data[0]!,
      id = a(image, 'id', RELATIONSHIPS_NAMESPACE_URI);
    if (
      !id ||
      image.attributes.some(
        (attr) =>
          !(
            (attr.namespaceUri === RELATIONSHIPS_NAMESPACE_URI && attr.localName === 'id') ||
            (attr.localName === 'title' && attr.namespaceUri === OFFICE) ||
            (!attr.namespaceUri &&
              ['cropleft', 'croptop', 'cropright', 'cropbottom', 'chromakey'].includes(
                attr.localName
              ))
          )
      )
    )
      return null;
    const key = a(image, 'chromakey');
    const keyColor = key === undefined ? undefined : color(key, '');
    if (keyColor === null) return null;
    const filter = keyColor ? legacyChromaKeyFilter(keyColor) : undefined;
    const crop = ['cropleft', 'croptop', 'cropright', 'cropbottom'].map((key) => {
      const raw = a(image, key) ?? '0';
      return raw.endsWith('f') ? numeric(raw.slice(0, -1)) / 65536 : numeric(raw);
    });
    const [left, top, right, bottom] = crop as [number, number, number, number];
    if (
      crop.some((v) => !Number.isFinite(v) || v < 0 || v >= 1) ||
      left + right >= 1 ||
      top + bottom >= 1
    )
      return null;
    const width = box.width / (1 - left - right),
      height = box.height / (1 - top - bottom);
    if (![width, height].every((value) => Number.isFinite(value) && value <= 100_000)) return null;
    return Object.freeze({
      relationshipId: id,
      before: `<svg x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" viewBox="0 0 ${box.width} ${box.height}" overflow="hidden">${filter?.definition ?? ''}<image x="${-left * width}" y="${-top * height}" width="${width}" height="${height}" preserveAspectRatio="none"${filter ? ` filter="url(#${filter.id})"` : ''} href="`,
      after: '"/></svg>',
    });
  }
  const ink = paint(node);
  if (!ink) return null;
  const padding = ink.stroke === 'none' ? 0 : ink.weight / 2;
  if (
    ['rect', 'oval'].includes(node.localName) &&
    (!inside(box.x, box.y, padding) || !inside(box.x + box.width, box.y + box.height, padding))
  )
    return null;
  if (node.localName === 'rect')
    return `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="${ink.fill}" stroke="${ink.stroke}" stroke-width="${ink.weight}"/>`;
  if (node.localName === 'oval')
    return `<ellipse cx="${box.x + box.width / 2}" cy="${box.y + box.height / 2}" rx="${box.width / 2}" ry="${box.height / 2}" fill="${ink.fill}" stroke="${ink.stroke}" stroke-width="${ink.weight}"/>`;
  if (node.localName !== 'line' && type !== '#_x0000_t32' && !a(node, 'path')) return null;
  const path = pathPoints(node, box);
  if (!path || path.some((p) => p.some((v) => !Number.isFinite(v) || Math.abs(v) > 1_000_000)))
    return null;
  if (a(node, 'connectortype', OFFICE) && a(node, 'connectortype', OFFICE) !== 'straight')
    return null;
  if (path.some(([x, y]) => !inside(x, y, padding))) return null;
  if (ink.strokeNode && ink.stroke !== 'none') {
    for (const [key, index] of [
      ['startarrow', 0],
      ['endarrow', path.length - 1],
    ] as const) {
      if (
        a(ink.strokeNode, key) &&
        a(ink.strokeNode, key) !== 'none' &&
        !inside(path[index]![0], path[index]![1], ink.weight * 6)
      )
        return null;
    }
  }
  const start = arrow(path, true, ink.strokeNode, ink.stroke, ink.weight),
    end = arrow(path, false, ink.strokeNode, ink.stroke, ink.weight);
  if (start === null || end === null) return null;
  return `<polyline points="${path.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${ink.stroke}" stroke-width="${ink.weight}"/>${start}${end}`;
}
