import { segmentsOf } from '../store/tree-op-segments.ts';
// Lightweight text-box story enumeration for search and other read-only derivations.

import { MAX_XML_DEPTH, schemaAttributeValue } from './ooxml-drawing-rules.ts';
import {
  anchorHidesDrawing,
  emptyNamespaceScope,
  isMcAlternateContent,
  namespaceScopeForNode,
  resolveRunLevelMcAtom,
  DEFAULT_DRAWING_PROJECTION_LIMITS,
  DEFAULT_SUPPORTED_MC_REQUIRES,
  MAX_PART_SCAN_ELEMENTS,
} from './drawing-projection.ts';
import { findDirectChild } from './drawing-shape-projection.ts';
import { findDirectKind, isElement } from './drawing-projection-walk.ts';
import { WML_NAMESPACE_URI } from './ooxml-shared.ts';
import {
  DRAWINGML_MAIN_NAMESPACE_URI,
  WP_NAMESPACE_URI,
  type OoxmlDrawingNode,
  type OoxmlElement,
  type OoxmlNode,
  type OoxmlPart,
} from './ooxml-tree.ts';

const WPS_NAMESPACE_URI = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape';
const WPS_GRAPHIC_DATA_URI = WPS_NAMESPACE_URI;

/** One searchable text-box story and the drawing location that can reveal it. */
export interface TextboxStoryRoot {
  /** The `w:txbxContent` story root. */
  readonly root: OoxmlElement;
  /** Layout atom id used to select the drawing, including an MC wrapper when present. */
  readonly drawingNodeId: string;
  /** Canonical node id of the paragraph that anchors the drawing. */
  readonly hostParagraphId: string;
}

function compatibleDirectChild(
  parent: OoxmlElement,
  typedKind: string,
  namespaceUri: string,
  localName: string
): OoxmlElement | null {
  return (
    findDirectKind(parent.children, typedKind) ??
    findDirectChild(parent.children, { namespaceUri, localName })
  );
}

/**
 * Read only the direct WPS path that holds a drawing's text-box story.
 *
 * ANCHORED only. Layout carries a text-box story on an anchored drawing record alone, so an
 * inline box paints as a placeholder with its text nowhere on the page. Listing one would
 * report a match the reader cannot see.
 */
function textboxContentOf(drawing: OoxmlDrawingNode): OoxmlElement | null {
  let anchor: OoxmlElement | null = null;
  for (const child of drawing.children) {
    if (!isElement(child)) continue;
    if (
      child.kind === 'anchoredDrawing' ||
      (child.namespaceUri === WP_NAMESPACE_URI && child.localName === 'anchor')
    ) {
      anchor = child;
      break;
    }
  }
  if (!anchor) return null;
  // Selection is the point of this list, so a drawing layout never paints has no story to
  // offer: the match would be reported and then refuse to select.
  if (anchorHidesDrawing(anchor, true)) return null;
  const graphic = compatibleDirectChild(
    anchor,
    'drawingGraphic',
    DRAWINGML_MAIN_NAMESPACE_URI,
    'graphic'
  );
  if (!graphic) return null;
  const data = compatibleDirectChild(
    graphic,
    'drawingGraphicData',
    DRAWINGML_MAIN_NAMESPACE_URI,
    'graphicData'
  );
  if (!data || schemaAttributeValue(data.attributes, 'uri') !== WPS_GRAPHIC_DATA_URI) return null;
  const wsp = findDirectChild(data.children, {
    namespaceUri: WPS_NAMESPACE_URI,
    localName: 'wsp',
  });
  const txbx = wsp
    ? findDirectChild(wsp.children, { namespaceUri: WPS_NAMESPACE_URI, localName: 'txbx' })
    : null;
  return txbx
    ? findDirectChild(txbx.children, {
        namespaceUri: WML_NAMESPACE_URI,
        localName: 'txbxContent',
      })
    : null;
}

interface WalkFrame {
  readonly node: OoxmlNode;
  readonly paragraphId: string | null;
  readonly namespaceScope: ReadonlyMap<string, string>;
  readonly depth: number;
  readonly paragraphAtoms: ReadonlySet<string> | null;
}

const textboxStoriesCache = new WeakMap<OoxmlElement, readonly TextboxStoryRoot[]>();

function appendTextboxStory(
  stories: TextboxStoryRoot[],
  drawing: OoxmlDrawingNode,
  drawingNodeId: string,
  hostParagraphId: string | null
): void {
  if (!hostParagraphId) return;
  const root = textboxContentOf(drawing);
  if (!root) return;
  stories.push(Object.freeze({ root, drawingNodeId, hostParagraphId }));
}

/**
 * List the text-box stories in one part, in document order.
 *
 * The bounded walk stops at drawings. It does not project pictures, shape geometry, or story
 * content. Results are memoized by immutable part-root identity.
 */
export function textboxStoriesInPart(part: OoxmlPart): readonly TextboxStoryRoot[] {
  const cached = textboxStoriesCache.get(part.root);
  if (cached) return cached;
  const stories: TextboxStoryRoot[] = [];
  const stack: WalkFrame[] = [
    {
      node: part.root,
      paragraphId: null,
      namespaceScope: emptyNamespaceScope(),
      depth: 0,
      paragraphAtoms: null,
    },
  ];
  let visited = 0;
  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (!isElement(frame.node)) continue;
    visited += 1;
    if (visited > MAX_PART_SCAN_ELEMENTS) break;
    if (frame.depth > MAX_XML_DEPTH) continue;
    const scope = namespaceScopeForNode(frame.namespaceScope, frame.node);
    const paragraphId = frame.node.kind === 'paragraph' ? frame.node.id : frame.paragraphId;
    const paragraphAtoms =
      frame.node.kind === 'paragraph'
        ? new Set(segmentsOf(frame.node).map((segment) => segment.node.id))
        : frame.paragraphAtoms;
    if (frame.node.kind === 'drawing') {
      if (!paragraphAtoms?.has(frame.node.id)) continue;
      appendTextboxStory(stories, frame.node, frame.node.id, paragraphId);
      continue;
    }
    if (isMcAlternateContent(frame.node)) {
      if (!paragraphAtoms?.has(frame.node.id)) continue;
      const resolved = resolveRunLevelMcAtom(
        frame.node,
        scope,
        DEFAULT_SUPPORTED_MC_REQUIRES,
        DEFAULT_DRAWING_PROJECTION_LIMITS
      );
      if (resolved.drawing) {
        appendTextboxStory(stories, resolved.drawing, resolved.segmentNode.id, paragraphId);
      }
      // Layout treats the wrapper as one atom, even when its selected branch is unsupported.
      continue;
    }
    if (frame.depth >= MAX_XML_DEPTH) continue;
    for (let index = frame.node.children.length - 1; index >= 0; index -= 1) {
      const child = frame.node.children[index];
      if (!isElement(child)) continue;
      stack.push({
        node: child,
        paragraphId,
        namespaceScope: scope,
        depth: frame.depth + 1,
        paragraphAtoms,
      });
    }
  }
  const frozen = Object.freeze(stories);
  textboxStoriesCache.set(part.root, frozen);
  return frozen;
}
