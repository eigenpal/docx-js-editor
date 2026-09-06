// Shared drawing walks for anchor collection and UTF-16 model positions.
// Visibility affects published anchors, never the canonical model's offsets.

import {
  isRunLevelMcAlternateContent,
  type DrawingProjection,
} from '../store/package/drawing-projection.ts';
import { isLegacyVmlAtom } from '../store/package/legacy-vml-projection.ts';
import type { OoxmlNode } from '../store/package/ooxml-tree.ts';
import type { InlineDrawingLayoutContext } from './drawing-layout.ts';
import { runPropertiesOf } from './field-run-text.ts';
import { resolveRunStyle } from './run-style.ts';
import {
  NO_REVISIONS,
  isRevisionWrapper,
  revisionAttributionOf,
  withRevision,
  type RevisionAttribution,
} from './revision-projection.ts';

const directRunHidden = new WeakMap<OoxmlNode, boolean>();

function isDirectlyHiddenRun(node: OoxmlNode): boolean {
  if (node.kind !== 'run') return false;
  let hidden = directRunHidden.get(node);
  if (hidden === undefined) {
    // This context has no style-cascade reader. Match the shared direct-property
    // resolver, including explicit w:vanish w:val="0", without guessing inheritance.
    hidden = resolveRunStyle(runPropertiesOf(node, [])).hidden;
    directRunHidden.set(node, hidden);
  }
  return hidden;
}

/** Run-level drawing / MC atoms carrying anchored projections in one paragraph. */
export function anchoredDrawingAtomsInParagraph(
  paragraph: OoxmlNode,
  context: InlineDrawingLayoutContext
): readonly {
  readonly atomId: string;
  readonly projection: DrawingProjection;
  /** Enclosing revision wrappers, outermost first — the stack spans carry (see #479). */
  readonly revisions: readonly RevisionAttribution[];
}[] {
  if (paragraph.kind !== 'paragraph') return [];
  const atoms: {
    atomId: string;
    projection: DrawingProjection;
    revisions: readonly RevisionAttribution[];
  }[] = [];
  const visit = (node: OoxmlNode, revisions: readonly RevisionAttribution[]): void => {
    // Every anchor consumer uses this walk. Hidden runs cannot add wrapping,
    // paint, or page bounds, but the separate model-offset walk still counts them.
    if (isDirectlyHiddenRun(node)) return;
    if (node.kind === 'drawing') {
      const projection =
        context.projectionForAtom?.(node.id) ??
        context.project(node as import('../store/package/ooxml-tree.ts').OoxmlDrawingNode);
      if (projection?.kind === 'anchored') atoms.push({ atomId: node.id, projection, revisions });
      return;
    }
    if (isRunLevelMcAlternateContent(node) || isLegacyVmlAtom(node)) {
      const projection = context.projectionForAtom?.(node.id) ?? null;
      if (projection?.kind === 'anchored') atoms.push({ atomId: node.id, projection, revisions });
      return;
    }
    if ('children' in node) {
      const attribution = isRevisionWrapper(node) ? revisionAttributionOf(node) : null;
      const enclosing = attribution ? withRevision(revisions, attribution) : revisions;
      for (const child of node.children) visit(child, enclosing);
    }
  };
  for (const child of paragraph.children) visit(child, NO_REVISIONS);
  return Object.freeze(atoms);
}

export function drawingModelOffsetsInParagraph(paragraph: OoxmlNode): ReadonlyMap<string, number> {
  const offsets = new Map<string, number>();
  if (paragraph.kind !== 'paragraph') return offsets;
  let offset = 0;
  const visitRunContent = (node: OoxmlNode): void => {
    if (node.kind === 'drawing' || isRunLevelMcAlternateContent(node) || isLegacyVmlAtom(node)) {
      offsets.set(node.id, offset);
      offset += 1;
      return;
    }
    if (node.kind === 'textValue') {
      offset += node.value.length;
      return;
    }
    if ('children' in node) {
      for (const child of node.children) visitRunContent(child);
    }
  };
  // Descends hyperlinks and revision wrappers in either order: a `w:ins` wraps runs and
  // hyperlinks the model still counts, so skipping it left every drawing after (or inside)
  // the wrapper at a stale offset and an anchored drawing in a tracked insertion invisible.
  const visitInlineChild = (child: OoxmlNode): void => {
    if (child.kind === 'run') {
      for (const grand of child.children) visitRunContent(grand);
      return;
    }
    if (child.kind === 'hyperlink' || isRevisionWrapper(child)) {
      for (const grand of child.children) visitInlineChild(grand);
    }
  };
  for (const child of paragraph.children) visitInlineChild(child);
  return offsets;
}
