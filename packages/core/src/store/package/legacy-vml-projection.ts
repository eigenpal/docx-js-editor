import { WML_NAMESPACE_URI, type OoxmlElement, type OoxmlNode } from './ooxml-tree.ts';
import { isStandardVmlTemplate } from './legacy-vml-templates.ts';
import type {
  DrawingProjection,
  DrawingHorizontalReferenceFrame,
  DrawingVerticalReferenceFrame,
  DrawingWrapProjection,
} from './drawing-projection.ts';
import {
  legacyShapeFragment,
  type LegacyBox,
  type LegacyGraphicFragment,
} from './legacy-vml-shapes.ts';
import {
  attribute as a,
  boundedVml,
  children,
  element,
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
export type { LegacyGraphicProjection } from './legacy-vml-shapes.ts';

const emptyEdges = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });
const memo = new WeakMap<OoxmlNode, DrawingProjection | null>();
// Layer order is a signed CSS integer, not a geometric coordinate. Word routinely
// writes 251658240 here; the coordinate reader's one-million limit rejects that.
function layerOrder(raw = '0'): number {
  if (raw.toLowerCase() === 'auto') return 0;
  if (!/^[+-]?\d{1,10}$/.test(raw)) return NaN;
  const value = Number(raw);
  return value >= -2147483648 && value <= 2147483647 ? value : NaN;
}
const commonStyles = new Set([
  'position',
  'left',
  'top',
  'width',
  'height',
  'margin-left',
  'margin-top',
  'z-index',
  'flip',
  'mso-position-horizontal-relative',
  'mso-position-vertical-relative',
  'mso-wrap-distance-left',
  'mso-wrap-distance-top',
  'mso-wrap-distance-right',
  'mso-wrap-distance-bottom',
]);

function supportedStyle(node: OoxmlElement, root: boolean): ReadonlyMap<string, string> | null {
  const styles = styleOf(node);
  if (!styles || a(node, 'opacity') || a(node, 'href') || a(node, 'src')) return null;
  for (const key of styles.keys()) if (!commonStyles.has(key)) return null;
  if (styles.has('position') && !['absolute', 'relative'].includes(styles.get('position')!))
    return null;
  if (
    !root &&
    (styles.has('z-index') ||
      styles.has('margin-left') ||
      styles.has('margin-top') ||
      Array.from(styles.keys()).some((k) => k.startsWith('mso-')))
  )
    return null;
  if (styles.has('flip') && node.localName !== 'line' && a(node, 'type') !== '#_x0000_t32')
    return null;
  return styles;
}

function groupLayers(
  group: OoxmlElement,
  box: LegacyBox,
  out: LegacyGraphicFragment[],
  depth: number,
  canvas: LegacyBox = box
): boolean {
  if (depth > 8 || out.length >= 128 || !supportedStyle(group, depth === 0)) return false;
  const origin = pair(a(group, 'coordorigin') ?? '0,0'),
    size = pair(a(group, 'coordsize') ?? '21600,21600');
  if (!origin || !size || size.some((v) => v <= 0)) return false;
  for (const child of children(group)) {
    if (named(child, OFFICE, 'lock') || (depth === 0 && named(child, WORD_VML, 'wrap'))) continue;
    if (
      child.namespaceUri !== VML ||
      !['shape', 'rect', 'oval', 'line', 'group'].includes(child.localName)
    )
      return false;
    const style = supportedStyle(child, false);
    if (!style) return false;
    const left = numeric(style.get('left') ?? '0'),
      top = numeric(style.get('top') ?? '0');
    const width = numeric(style.get('width')),
      height = numeric(style.get('height'));
    const line = child.localName === 'line' || a(child, 'type') === '#_x0000_t32';
    if (
      ![left, top, width, height].every(Number.isFinite) ||
      (line ? width < 0 || height < 0 || width + height <= 0 : width <= 0 || height <= 0)
    )
      return false;
    const next = {
      x: box.x + ((left - origin[0]) * box.width) / size[0],
      y: box.y + ((top - origin[1]) * box.height) / size[1],
      width: (width * box.width) / size[0],
      height: (height * box.height) / size[1],
    };
    if (Object.values(next).some((v) => !Number.isFinite(v) || Math.abs(v) > 100_000)) return false;
    if (child.localName === 'group') {
      if (!groupLayers(child, next, out, depth + 1, canvas)) return false;
    } else {
      const fragment = legacyShapeFragment(child, next, canvas);
      if (fragment === null || out.length >= 128) return false;
      out.push(fragment);
    }
  }
  return true;
}

function readProjection(node: OoxmlElement): DrawingProjection | null {
  if (!boundedVml(node)) return null;
  const roots = children(node).filter((child) => !named(child, VML, 'shapetype'));
  if (roots.length !== 1) return null;
  // Built-in templates are metadata, not a second drawing. Unknown custom
  // templates may redefine geometry and are outside this bounded subset.
  if (
    children(node).some((child) => named(child, VML, 'shapetype') && !isStandardVmlTemplate(child))
  )
    return null;
  const root = roots[0]!;
  if (
    root.namespaceUri !== VML ||
    !['shape', 'rect', 'oval', 'line', 'group'].includes(root.localName)
  )
    return null;
  const style = supportedStyle(root, true);
  if (!style) return null;
  const width = points(style.get('width')),
    height = points(style.get('height'));
  if (![width, height].every((n) => Number.isFinite(n) && n > 0 && n <= 10_000)) return null;
  const fragments: LegacyGraphicFragment[] = [];
  const box = { x: 0, y: 0, width, height };
  if (root.localName === 'group') {
    if (!groupLayers(root, box, fragments, 0) || !fragments.length) return null;
  } else {
    const fragment = legacyShapeFragment(root, box);
    if (fragment === null) return null;
    fragments.push(fragment);
  }
  const floating =
    style.get('position') === 'absolute' ||
    style.has('mso-position-horizontal-relative') ||
    style.has('mso-position-vertical-relative');
  const horizontal = new Map<string, DrawingHorizontalReferenceFrame>([
    ['text', 'column'],
    ['char', 'character'],
    ['page', 'page'],
    ['margin', 'margin'],
    ['left-margin-area', 'leftMargin'],
    ['right-margin-area', 'rightMargin'],
  ]).get(style.get('mso-position-horizontal-relative') ?? 'text');
  const vertical = new Map<string, DrawingVerticalReferenceFrame>([
    ['text', 'paragraph'],
    ['line', 'line'],
    ['page', 'page'],
    ['margin', 'margin'],
    ['top-margin-area', 'topMargin'],
    ['bottom-margin-area', 'bottomMargin'],
  ]).get(style.get('mso-position-vertical-relative') ?? 'text');
  const left = points(style.get('margin-left') ?? style.get('left') ?? '0'),
    top = points(style.get('margin-top') ?? style.get('top') ?? '0');
  const z = layerOrder(style.get('z-index'));
  if (
    !horizontal ||
    !vertical ||
    ![left, top, z].every(Number.isFinite) ||
    Math.abs(left) > 100_000 ||
    Math.abs(top) > 100_000
  )
    return null;
  const wrapNodes = children(root).filter((n) => named(n, WORD_VML, 'wrap'));
  if (wrapNodes.length > 1) return null;
  const wrapNode = wrapNodes[0],
    wrap = wrapNode ? (a(wrapNode, 'type') ?? 'none') : 'none';
  if (
    !['none', 'square', 'topAndBottom', 'tight'].includes(wrap) ||
    (wrapNode &&
      wrapNode.attributes.some(
        (attr) => !['type', 'side'].includes(attr.localName) || attr.namespaceUri
      ))
  )
    return null;
  const side = wrapNode ? (a(wrapNode, 'side') ?? 'both') : 'both';
  const textSide = new Map<string, DrawingWrapProjection['textSide']>([
    ['both', 'bothSides'],
    ['left', 'left'],
    ['right', 'right'],
    ['largest', 'largest'],
  ]).get(side);
  if (!textSide) return null;
  const polygon: { x: number; y: number }[] = [];
  if (wrap === 'tight') {
    const raw = (a(root, 'wrapcoords') ?? '').trim().split(/[\s,]+/);
    if (raw.length < 6 || raw.length > 256 || raw.length % 2) return null;
    const coords = raw.map(numeric);
    if (coords.some((n) => !Number.isFinite(n) || Math.abs(n) > 216_000)) return null;
    for (let i = 0; i < coords.length; i += 2)
      polygon.push(Object.freeze({ x: coords[i]!, y: coords[i + 1]! }));
  }
  const distances: Record<'top' | 'right' | 'bottom' | 'left', number> = { ...emptyEdges };
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const value = points(style.get('mso-wrap-distance-' + side) ?? '0');
    if (!Number.isFinite(value) || value < 0 || value > 1000) return null;
    distances[side] = Math.round(value * 12700);
  }
  return Object.freeze({
    drawingNodeId: node.id,
    ownerPartName: '',
    kind: floating ? 'anchored' : 'inline',
    relationshipId: null,
    docPrId: null,
    name: a(root, 'id') ?? 'Legacy graphic',
    title: a(root, 'title') ?? '',
    description: a(root, 'alt') ?? '',
    hyperlinkHref: null,
    hidden: false,
    extentEmu: Object.freeze({ cx: Math.round(width * 12700), cy: Math.round(height * 12700) }),
    effectExtentEmu: emptyEdges,
    inlineDistancesEmu: emptyEdges,
    wrap: floating
      ? wrap === 'none'
        ? z < 0
          ? 'behind'
          : 'inFront'
        : wrap === 'tight'
          ? 'tight'
          : wrap === 'topAndBottom'
            ? 'topAndBottom'
            : textSide === 'left'
              ? 'squareLeft'
              : textSide === 'right'
                ? 'squareRight'
                : 'square'
      : 'inline',
    wrapGeometry: floating
      ? Object.freeze({
          element: wrap as DrawingWrapProjection['element'],
          textSide,
          distancesEmu: Object.freeze(distances),
          polygon: Object.freeze(polygon),
        })
      : null,
    position: floating
      ? Object.freeze({
          simplePosition: Object.freeze({ xEmu: 0, yEmu: 0 }),
          horizontal: Object.freeze({
            relativeFrom: horizontal,
            align: null,
            offsetEmu: Math.round(left * 12700),
          }),
          vertical: Object.freeze({
            relativeFrom: vertical,
            align: null,
            offsetEmu: Math.round(top * 12700),
          }),
        })
      : null,
    anchor: floating
      ? Object.freeze({
          simplePos: false,
          // Behind-text drawings have their own paint layer; retain their signed order
          // in its non-negative rank instead of collapsing every negative value to zero.
          relativeHeight: z < 0 ? z + 2147483648 : z,
          behindDocument: z < 0,
          layoutInCell: !off(a(root, 'allowincell', OFFICE)),
          allowOverlap: true,
        })
      : null,
    picture: null,
    vectorShape: null,
    textboxStory: null,
    legacyGraphic: Object.freeze({ width, height, fragments: Object.freeze(fragments) }),
    locks: Object.freeze({ select: true, move: true, resize: true, changeAspect: true }),
    effects: Object.freeze({ grayscale: false, brightness: 0, contrast: 0 }),
    compatibilityBranchNodeId: null,
    diagnostics: Object.freeze([]),
  });
}

/** Supported standalone w:pict is one read-only drawing atom. Dead MC fallbacks are not visited. */
export function isLegacyVmlAtom(node: OoxmlNode): boolean {
  if (!named(node, WML_NAMESPACE_URI, 'pict') || !element(node)) return false;
  if (!memo.has(node)) memo.set(node, readProjection(node));
  return memo.get(node) !== null;
}
export function projectLegacyVml(node: OoxmlNode, ownerPartName: string): DrawingProjection | null {
  if (!isLegacyVmlAtom(node)) return null;
  return Object.freeze({ ...memo.get(node)!, ownerPartName });
}
