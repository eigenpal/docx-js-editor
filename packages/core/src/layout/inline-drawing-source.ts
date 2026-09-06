// Package-backed inline drawing layout source (typed-drawings-and-images task 6).
//
// Precomputes run-level drawing / MC atom projections from a bounded part traversal with
// ancestor xmlns bindings. Field projection consumes the atom-id map; it never re-walks MC
// with an empty namespace scope.

import type {
  OoxmlDrawingNode,
  OoxmlGenericElementNode,
  OoxmlNode,
  OoxmlParagraphNode,
  OoxmlPart,
} from '../store/package/ooxml-tree.ts';
import {
  createDrawingRelationshipResolver,
  DEFAULT_DRAWING_PROJECTION_LIMITS,
  indexInlineDrawingProjectionsInPart,
  isRunLevelMcAlternateContent,
  MAX_PART_SCAN_ELEMENTS,
  projectDrawingsInPart,
  type DrawingProjection,
} from '../store/package/drawing-projection.ts';
import {
  createOwnedImageResourceLookup,
  type ImageDecodePort,
  type ImageResourceLookup,
  type ImageResourceState,
  type ValidatedImageBytesHandle,
} from '../store/package/image-resources.ts';
import {
  mintValidatedImageBytes,
  releaseValidatedImageBytesToken,
  retainValidatedImageBytes,
  type ValidatedImageBytesReleaseToken,
} from '../store/package/validated-image-bytes.ts';
import { createPackageShapeThemeResolvers } from '../store/package/theme-color-resolution.ts';
import type { OoxmlPackage } from '../store/package/ooxml-package.ts';
import type { InlineDrawingLayoutContext } from './drawing-layout.ts';
import { walkDrawingAtoms } from './drawing-inline-walk.ts';
import { aggregateParagraphTokensForTableBlock, framedTokenJoin } from './layout-cache.ts';

/** Layout-owned read surface for inline drawing package state (no binding/session lane). */
export interface InlineDrawingPackageReader {
  packageRevision(): number;
  currentPackage(): OoxmlPackage;
  part(): OoxmlPart;
}

export interface InlineDrawingLayoutBundle {
  get bodyContext(): InlineDrawingLayoutContext;
  contextForPart(ownerPartName: string): InlineDrawingLayoutContext;
  /** Per-part resource epoch — only drawings owned by that part. */
  cacheTokenForPart(ownerPartName: string): string;
  drawingTokenForParagraph(paragraph: OoxmlNode, ownerPartName: string): string;
  /** Number of discovered image decodes that have not settled yet. */
  pendingResourceCount(): number;
  /** Mint validated bytes for a ready handle when contentId matches; null on stale/mismatch. */
  mintValidatedBytes(
    handle: ValidatedImageBytesHandle,
    expectedContentId: string
  ): Uint8Array | null;
  sync(reader: InlineDrawingPackageReader): void;
  dispose(): void;
}

export interface CreateInlineDrawingLayoutBundleOptions {
  readonly session: InlineDrawingPackageReader;
  readonly decodePort: ImageDecodePort;
  readonly onResourcesChanged: () => void;
  /** Test-only override; production creates one independently disposable lookup per bundle. */
  readonly resourceLookup?: ImageResourceLookup;
}

function pendingResourceKey(projection: DrawingProjection): string {
  const picture = projection.picture;
  if (picture?.embeddedRelationshipId) {
    return `embed:${projection.ownerPartName}:${picture.embeddedRelationshipId}`;
  }
  if (picture?.linkedRelationshipId) {
    return `link:${projection.ownerPartName}:${picture.linkedRelationshipId}`;
  }
  return `nonpicture:${projection.drawingNodeId}`;
}

interface PartDrawingContextSlot {
  readonly context: InlineDrawingLayoutContext;
  readonly cacheTokenForPart: () => string;
  readonly drawingTokenForParagraph: (paragraph: OoxmlNode) => string;
  readonly isCompatibleWith: (part: OoxmlPart, pkg: OoxmlPackage) => boolean;
  readonly pendingResourceCount: () => number;
  readonly dispose: () => void;
}

/**
 * One immutable subtree's drawing-atom facts, memoized per node so a keystroke's fresh
 * part re-uses every shared block instead of re-walking the whole document (this runs on
 * the drawing bundle's per-commit compatibility check).
 */
interface SubtreeDrawingAtoms {
  /** Atom id → node for drawings in this subtree (usually empty). */
  readonly atoms: ReadonlyMap<string, OoxmlNode>;
  /** Nodes a flat walk of this subtree visits, for the global element budget. */
  readonly visited: number;
  /** Deepest visited node, relative to the subtree root (0 = the root itself). */
  readonly deepest: number;
}
const subtreeDrawingAtomMemos = new WeakMap<OoxmlNode, SubtreeDrawingAtoms>();
const EMPTY_ATOMS: ReadonlyMap<string, OoxmlNode> = new Map();
/** Containers at least this wide compose from child memos instead of being one entry. */
const ATOM_COMPOSE_CHILD_THRESHOLD = 16;
const MAX_ATOM_COMPOSE_DEPTH = 32;

function subtreeDrawingAtoms(node: OoxmlNode, composeDepth: number): SubtreeDrawingAtoms {
  const cached = subtreeDrawingAtomMemos.get(node);
  if (cached) return cached;
  let result: SubtreeDrawingAtoms;
  if (node.kind === 'drawing' || isRunLevelMcAlternateContent(node)) {
    result = { atoms: new Map([[node.id, node]]), visited: 1, deepest: 0 };
  } else if (!('children' in node) || node.children.length === 0) {
    result = { atoms: EMPTY_ATOMS, visited: 1, deepest: 0 };
  } else if (
    // The spine above the block level (document → body) is NARROW; composing it anyway is
    // what routes the memoization down to the per-block subtrees. Below that, only wide
    // containers earn their own composition.
    (composeDepth < 2 || node.children.length >= ATOM_COMPOSE_CHILD_THRESHOLD) &&
    composeDepth < MAX_ATOM_COMPOSE_DEPTH
  ) {
    let atoms: Map<string, OoxmlNode> | null = null;
    let visited = 1;
    let deepest = 0;
    for (const child of node.children) {
      const entry = subtreeDrawingAtoms(child, composeDepth + 1);
      visited += entry.visited;
      if (entry.deepest + 1 > deepest) deepest = entry.deepest + 1;
      if (entry.atoms.size > 0) {
        if (!atoms) atoms = new Map();
        for (const [id, atom] of entry.atoms) atoms.set(id, atom);
      }
    }
    result = { atoms: atoms ?? EMPTY_ATOMS, visited, deepest };
  } else {
    const atoms = new Map<string, OoxmlNode>();
    let visited = 0;
    let deepest = 0;
    const stack: { readonly node: OoxmlNode; readonly depth: number }[] = [{ node, depth: 0 }];
    while (stack.length > 0) {
      const frame = stack.pop()!;
      visited += 1;
      // Defense-in-depth like the flat walk this replaces: past the global element budget
      // the walk stops and the saturated count makes the caller answer null.
      if (visited > MAX_PART_SCAN_ELEMENTS) break;
      if (frame.depth > deepest) deepest = frame.depth;
      const current = frame.node;
      if (current.kind === 'drawing' || isRunLevelMcAlternateContent(current)) {
        atoms.set(current.id, current);
        continue;
      }
      if (!('children' in current)) continue;
      for (let index = current.children.length - 1; index >= 0; index -= 1) {
        stack.push({ node: current.children[index]!, depth: frame.depth + 1 });
      }
    }
    result = { atoms: atoms.size > 0 ? atoms : EMPTY_ATOMS, visited, deepest };
  }
  subtreeDrawingAtomMemos.set(node, result);
  return result;
}

/** @internal Exposed for bounded traversal regression tests. */
export function drawingAtomIdentities(part: OoxmlPart): ReadonlyMap<string, OoxmlNode> | null {
  // Same bounds as the flat walk this replaces: over the element budget or past the
  // drawing depth limit answers null ("cannot verify"), never a partial map.
  const facts = subtreeDrawingAtoms(part.root, 0);
  if (facts.visited > MAX_PART_SCAN_ELEMENTS) return null;
  if (facts.deepest > DEFAULT_DRAWING_PROJECTION_LIMITS.maxDrawingDepth) return null;
  return facts.atoms;
}

const drawingSourceOrdersByRoot = new WeakMap<
  OoxmlNode,
  WeakMap<InlineDrawingLayoutContext, ReadonlyMap<string, number>>
>();

/**
 * Canonical drawing traversal order for one immutable story root.
 *
 * The drawing layout context can remain compatible across a copy-on-write paragraph reorder:
 * projections and atom objects are unchanged, but collision, exclusion, and paint order are not.
 * Keying this fact by the current root makes that reorder observable; keying it again by context
 * keeps MC branch selection honest. An MC wrapper owns the paragraph atom id while its selected
 * projection publishes the inner drawing id, so ordered atoms are mapped through the context
 * before becoming lookup keys. The ordered identity walk composes from immutable subtree memos,
 * so an ordinary edit reuses every untouched block instead of rescanning the complete part. The
 * bounded projection walk is only a defensive fallback when the identity walk refuses an
 * over-limit tree.
 * @internal
 */
export function drawingSourceOrderInPart(
  part: OoxmlPart,
  context: InlineDrawingLayoutContext
): ReadonlyMap<string, number> {
  let byContext = drawingSourceOrdersByRoot.get(part.root);
  const cached = byContext?.get(context);
  if (cached) return cached;
  const identities = drawingAtomIdentities(part);
  const order = new Map<string, number>();
  let index = 0;
  if (identities) {
    for (const atomId of identities.keys()) {
      const drawingId = context.projectionForAtom?.(atomId)?.drawingNodeId ?? atomId;
      order.set(drawingId, index);
      index += 1;
    }
  } else {
    for (const projection of projectDrawingsInPart(part)) {
      order.set(projection.drawingNodeId, index);
      index += 1;
    }
  }
  if (!byContext) {
    byContext = new WeakMap();
    drawingSourceOrdersByRoot.set(part.root, byContext);
  }
  byContext.set(context, order);
  return order;
}

// Scratch view used to fold a coordinate in by its exact IEEE-754 bits. Coordinates are not
// integers once a group transform has scaled them, so rounding would fold real geometry
// changes together.
const COORDINATE_SCRATCH = new Float64Array(1);
const COORDINATE_BITS = new Uint32Array(COORDINATE_SCRATCH.buffer);

/**
 * Digest of one vector shape's geometry and chrome, for the layout reuse token.
 *
 * Deliberately NOT a serialization. `JSON.stringify` of a shape at the 1024-point budget is
 * ~48 KB and ~230 us, and `isCompatibleWith` reads this token twice per atom whenever the
 * atom-identity fast path misses, so the serialization dominated a document full of shapes.
 * Every other field in the enclosing token is a cheap scalar join; this one folds the point
 * stream into two 32-bit FNV-1a accumulators and joins the scalars verbatim. The shape of
 * the component list (its length, and each subpath's length) is joined literally rather than
 * hashed, so a structural change can never hide inside the digest.
 *
 * This is a cache key, NOT a security primitive. FNV-1a is trivially invertible — its round
 * is `h = (h ^ d) * p` with an odd, hence modularly invertible, `p` — so a chosen last
 * coordinate can drive both accumulators to any target in closed form. That buys nothing
 * here, because forging a collision needs two shapes under the same `drawingNodeId` in two
 * revisions of one document, and the payoff is a stale repaint. Do not reuse this digest
 * anywhere an attacker profits from a collision.
 */
export function vectorShapeLayoutToken(
  vector: NonNullable<DrawingProjection['vectorShape']>
): string {
  HASH_SCRATCH[0] = 0x811c_9dc5;
  HASH_SCRATCH[1] = 0x1000_0193;
  const scalars: string[] = [];
  for (const component of vector.components) {
    scalars.push(
      component.fillHex ?? '',
      String(component.fillAlpha),
      component.strokeHex ?? '',
      String(component.strokeAlpha),
      String(component.strokeWidthEmu),
      String(component.subpathsEmu.length)
    );
    const subpaths = component.subpathsEmu;
    for (let index = 0; index < subpaths.length; index += 1) {
      const subpath = subpaths[index]!;
      // An omitted close flag paints closed, exactly like `true`; only `false` leaves the
      // path open, so that is the one value that must separate two otherwise equal shapes.
      scalars.push(String(subpath.length), component.subpathsClosed?.[index] === false ? '0' : '1');
      foldPointsInto(subpath, HASH_SCRATCH);
    }
    // Line-end triangles are generated geometry the painter fills separately, so a changed
    // `a:headEnd`/`a:tailEnd` moves nothing in the subpath stream. Their vertices join the
    // same accumulators, framed by their counts, so the token cannot reuse a stale record.
    const arrowheads = component.arrowheadsEmu;
    scalars.push(String(arrowheads?.length ?? 0));
    if (arrowheads) {
      for (const arrowhead of arrowheads) {
        scalars.push(String(arrowhead.length));
        foldPointsInto(arrowhead, HASH_SCRATCH);
      }
    }
  }
  return [
    String(vector.extentEmu.cx),
    String(vector.extentEmu.cy),
    String(vector.components.length),
    scalars.join(','),
    HASH_SCRATCH[0]!.toString(36),
    HASH_SCRATCH[1]!.toString(36),
  ].join(';');
}

/** The two FNV-1a accumulators {@link vectorShapeLayoutToken} folds every point stream into. */
const HASH_SCRATCH = new Uint32Array(2);

type EmuPoints = readonly Readonly<{ x: number; y: number }>[];

/** A standalone digest of one point list, for the wrap polygon. */
function pointsDigest(points: EmuPoints): string {
  HASH_SCRATCH[0] = 0x811c_9dc5;
  HASH_SCRATCH[1] = 0x1000_0193;
  foldPointsInto(points, HASH_SCRATCH);
  return `${HASH_SCRATCH[0]!.toString(36)}:${HASH_SCRATCH[1]!.toString(36)}`;
}

/** One fold shared by subpaths, line ends and wrap polygons, so all hash the same way. */
function foldPointsInto(points: EmuPoints, hash: Uint32Array): void {
  let hashA = hash[0]!;
  let hashB = hash[1]!;
  for (const point of points) {
    COORDINATE_SCRATCH[0] = point.x;
    hashA = Math.imul(hashA ^ COORDINATE_BITS[0]!, 0x0100_0193);
    hashB = Math.imul(hashB ^ COORDINATE_BITS[1]!, 0x0100_01b3);
    COORDINATE_SCRATCH[0] = point.y;
    hashA = Math.imul(hashA ^ COORDINATE_BITS[1]!, 0x0100_0193);
    hashB = Math.imul(hashB ^ COORDINATE_BITS[0]!, 0x0100_01b3);
  }
  hash[0] = hashA;
  hash[1] = hashB;
}

// A story root is immutable. Identity detects text and formatting edits without walking
// the entire hosted story each time a drawing token is requested.
const textboxContentIdentities = new WeakMap<OoxmlNode, number>();
let textboxContentIdentityCounter = 0;

function textboxLayoutToken(story: NonNullable<DrawingProjection['textboxStory']>): string {
  let identity = textboxContentIdentities.get(story.content);
  if (identity === undefined) {
    identity = ++textboxContentIdentityCounter;
    textboxContentIdentities.set(story.content, identity);
  }
  return framedTokenJoin([
    String(identity),
    story.contentNodeId,
    String(story.insetsEmu.top),
    String(story.insetsEmu.right),
    String(story.insetsEmu.bottom),
    String(story.insetsEmu.left),
    story.verticalAnchor,
    story.autofit,
    story.fillHex ?? '',
    story.strokeHex ?? '',
    String(story.strokeWidthEmu),
  ]);
}

function drawingProjectionLayoutToken(projection: DrawingProjection): string {
  const position = projection.position;
  const anchor = projection.anchor;
  const picture = projection.picture;
  const wrap = projection.wrapGeometry;
  const vector = projection.vectorShape;
  // Length-framed (`framedTokenJoin`): relationship ids, part names, and preset geometry
  // are verbatim file values, so a printable field separator would let two different
  // picture references serialize to one token — and `isCompatibleWith` compares
  // projections by this token alone when the resource substrate is unchanged.
  // This also validates retained projections used by paint and drawing controls. Every
  // top-level field needs a token decision, including diagnostics used for placeholders.
  const fields = {
    drawingNodeId: projection.drawingNodeId,
    ownerPartName: projection.ownerPartName,
    kind: projection.kind,
    diagnostics: framedTokenJoin(
      projection.diagnostics.map((diagnostic) =>
        framedTokenJoin([diagnostic.code, diagnostic.nodeId, diagnostic.detail ?? ''])
      )
    ),
    relationshipId: projection.relationshipId ?? '',
    docPrId: String(projection.docPrId ?? ''),
    name: projection.name,
    title: projection.title,
    description: projection.description,
    hyperlinkHref: projection.hyperlinkHref ?? '',
    hidden: String(projection.hidden),
    extentEmu: framedTokenJoin([String(projection.extentEmu.cx), String(projection.extentEmu.cy)]),
    effectExtentEmu: framedTokenJoin([
      String(projection.effectExtentEmu.top),
      String(projection.effectExtentEmu.right),
      String(projection.effectExtentEmu.bottom),
      String(projection.effectExtentEmu.left),
    ]),
    inlineDistancesEmu: framedTokenJoin([
      String(projection.inlineDistancesEmu.top),
      String(projection.inlineDistancesEmu.right),
      String(projection.inlineDistancesEmu.bottom),
      String(projection.inlineDistancesEmu.left),
    ]),
    wrap: projection.wrap,
    textboxStory: projection.textboxStory ? textboxLayoutToken(projection.textboxStory) : '',
    compatibilityBranchNodeId: projection.compatibilityBranchNodeId ?? '',
    anchor: anchor
      ? framedTokenJoin([
          String(anchor.simplePos),
          String(anchor.relativeHeight),
          String(anchor.layoutInCell),
          String(anchor.allowOverlap),
          String(anchor.behindDocument),
        ])
      : '',
    locks: framedTokenJoin([
      String(projection.locks.select),
      String(projection.locks.move),
      String(projection.locks.resize),
      String(projection.locks.changeAspect),
    ]),
    effects: framedTokenJoin([
      String(projection.effects.grayscale),
      String(projection.effects.brightness),
      String(projection.effects.contrast),
      String(projection.effects.bilevel ?? ''),
    ]),
    picture: picture
      ? framedTokenJoin([
          String(picture.crop.left),
          String(picture.crop.top),
          String(picture.crop.right),
          String(picture.crop.bottom),
          String(picture.transform.rotationDegrees),
          String(picture.transform.flipHorizontal),
          String(picture.transform.flipVertical),
          String(picture.transform.offsetEmu.x),
          String(picture.transform.offsetEmu.y),
          String(picture.transform.extentEmu.cx),
          String(picture.transform.extentEmu.cy),
          picture.embeddedRelationshipId ?? '',
          picture.linkedRelationshipId ?? '',
          picture.presetGeometry ?? '',
          picture.fillMode,
        ])
      : '',
    vectorShape: vector ? vectorShapeLayoutToken(vector) : '',
    wrapGeometry: wrap
      ? framedTokenJoin([
          wrap.element,
          wrap.textSide,
          String(wrap.distancesEmu.top),
          String(wrap.distancesEmu.right),
          String(wrap.distancesEmu.bottom),
          String(wrap.distancesEmu.left),
          String(wrap.polygon.length),
          pointsDigest(wrap.polygon),
        ])
      : '',
    position: position
      ? framedTokenJoin([
          position.horizontal.relativeFrom,
          position.horizontal.align ?? '',
          String(position.horizontal.offsetEmu ?? ''),
          position.vertical.relativeFrom,
          position.vertical.align ?? '',
          String(position.vertical.offsetEmu ?? ''),
          String(position.simplePosition.xEmu),
          String(position.simplePosition.yEmu),
        ])
      : '',
  } satisfies Record<keyof DrawingProjection, string>;
  return framedTokenJoin(Object.values(fields));
}

// Length-framed where a field embeds file text (resource keys carry relationship ids and
// part names verbatim), so no crafted id can shift a field boundary.
function drawingResourceLayoutToken(resource: ImageResourceState): string {
  switch (resource.kind) {
    case 'ready':
      return framedTokenJoin([
        'ready',
        resource.resourceKey,
        resource.contentId,
        `${resource.pixelWidth}x${resource.pixelHeight}`,
      ]);
    case 'pending':
      return framedTokenJoin(['pending', resource.resourceKey]);
    case 'external':
      return framedTokenJoin(['external', resource.relationshipId, resource.sinkSafe ? '1' : '0']);
    case 'missing':
      return 'missing';
    case 'unrenderable':
      return `unrenderable:${resource.reason}`;
    default:
      return (resource as ImageResourceState).kind;
  }
}

/**
 * Story levels folded into a paragraph's drawing token.
 *
 * ONE, because one is what paints: `layoutTextboxStory` does not hand its own flow a
 * textbox-story layout function, so a box inside a box renders nothing. Walking deeper would
 * not just be wasted work — the token calls `resourceOf` on every atom it names, which
 * schedules a decode and retains validated bytes for a picture nothing will ever draw. Raise
 * this only together with nested story layout.
 */
const MAX_HOSTED_STORY_TOKEN_DEPTH = 1;

function collectStoryDrawingAtoms(node: OoxmlNode, ids: string[]): void {
  if (node.kind === 'paragraph') {
    for (const id of drawingAtomsInParagraph(node)) ids.push(id);
    return;
  }
  if ('children' in node) {
    for (const child of node.children) collectStoryDrawingAtoms(child, ids);
  }
}

function drawingAtomsInParagraph(paragraph: OoxmlNode): readonly string[] {
  if (paragraph.kind !== 'paragraph') return [];
  const ids: string[] = [];
  walkDrawingAtoms(paragraph, (node) => ids.push(node.id));
  return Object.freeze(ids);
}

function createPartDrawingContextSlot(options: {
  readonly ownerPartName: string;
  readonly part: OoxmlPart;
  readonly pkg: OoxmlPackage;
  readonly lookup: ImageResourceLookup;
  readonly onResourceSettled: (ownerPartName: string) => void;
  readonly rememberReadyHandle: (handle: ValidatedImageBytesHandle) => void;
  readonly forgetReadyHandle: (handle: ValidatedImageBytesHandle) => void;
}): PartDrawingContextSlot {
  const {
    ownerPartName,
    part,
    pkg,
    lookup,
    onResourceSettled,
    rememberReadyHandle,
    forgetReadyHandle,
  } = options;
  let disposed = false;
  let generation = 0;
  const resourceByKey = new Map<string, ImageResourceState>();
  const inFlight = new Set<string>();
  const resourceEpochByKey = new Map<string, number>();
  const drawingTokensByParagraph = new WeakMap<
    OoxmlNode,
    { readonly resourceEpoch: number; readonly token: string }
  >();
  const atomsByParagraph = new WeakMap<OoxmlNode, readonly string[]>();
  let resourceEpoch = 0;

  const resolveRelationshipTarget = createDrawingRelationshipResolver(pkg, ownerPartName);
  const theme = createPackageShapeThemeResolvers(pkg);
  const atomProjections = indexInlineDrawingProjectionsInPart(part, {
    resolveRelationship: resolveRelationshipTarget,
    resolveSchemeColor: theme.resolveSchemeColor,
    resolveStyleMatrixReference: theme.resolveStyleMatrixReference,
  });
  const atomIdentities = drawingAtomIdentities(part);

  const scheduleResolve = (projection: DrawingProjection, key: string): void => {
    if (disposed || inFlight.has(key)) return;
    inFlight.add(key);
    const startGeneration = generation;
    void lookup
      .resolveForProjection(projection)
      .then((state) => {
        if (disposed || startGeneration !== generation) return;
        resourceByKey.set(key, state);
        if (state.kind === 'ready') {
          rememberReadyHandle(state.validatedHandle);
        }
        resourceEpoch += 1;
        resourceEpochByKey.set(key, resourceEpoch);
        inFlight.delete(key);
        onResourceSettled(ownerPartName);
      })
      .catch(() => {
        if (disposed || startGeneration !== generation) return;
        resourceByKey.set(
          key,
          Object.freeze({
            kind: 'unrenderable',
            partName: null,
            mime: 'unknown',
            reason: 'decode-failed',
          })
        );
        resourceEpoch += 1;
        resourceEpochByKey.set(key, resourceEpoch);
        inFlight.delete(key);
        onResourceSettled(ownerPartName);
      });
  };

  const resourceOf = (projection: DrawingProjection): ImageResourceState => {
    const key = pendingResourceKey(projection);
    const cached = resourceByKey.get(key);
    if (cached) return cached;

    const linked = projection.picture?.linkedRelationshipId;
    if (linked) {
      const linkedState = lookup.resolveLinked(ownerPartName, linked);
      resourceByKey.set(key, linkedState);
      resourceEpoch += 1;
      resourceEpochByKey.set(key, resourceEpoch);
      return linkedState;
    }

    const pending = Object.freeze({
      kind: 'pending' as const,
      resourceKey: key,
    });
    resourceByKey.set(key, pending);
    resourceEpoch += 1;
    resourceEpochByKey.set(key, resourceEpoch);
    scheduleResolve(projection, key);
    return pending;
  };

  const projectionForAtom = (atomNodeId: string): DrawingProjection | null =>
    atomProjections.get(atomNodeId) ?? null;

  const context: InlineDrawingLayoutContext = Object.freeze({
    ownerPartName,
    projectionForAtom,
    project: (drawing: OoxmlDrawingNode) => projectionForAtom(drawing.id),
    resourceOf,
  });

  /**
   * Atom ids in the paragraph, plus the atoms of any text-box story they host.
   *
   * A text box's OWN resource is `unrenderable` — it is a shape, not a picture — and never
   * changes, so a picture inside it settling would move no token in the host paragraph's key
   * and repaint nothing. The story's atoms have to ride the host paragraph's key, because
   * that is what governs the break the story is laid out from.
   *
   * Memoized on the paragraph NODE, not on the resource epoch: which atoms a paragraph owns
   * is a fact about the tree, and the tree does not move when a picture decodes. Keying this
   * with the token would re-walk every hosted story of every paragraph in the part each time
   * any one image settles.
   */
  const atomsWithHostedStories = (paragraph: OoxmlNode): readonly string[] => {
    const memo = atomsByParagraph.get(paragraph);
    if (memo) return memo;
    const direct = drawingAtomsInParagraph(paragraph);
    let expanded: string[] | null = null;
    const visit = (atomIds: readonly string[], depth: number): void => {
      if (depth >= MAX_HOSTED_STORY_TOKEN_DEPTH) return;
      for (const atomId of atomIds) {
        const story = atomProjections.get(atomId)?.textboxStory;
        if (!story) continue;
        const inner: string[] = [];
        collectStoryDrawingAtoms(story.content, inner);
        if (inner.length === 0) continue;
        if (!expanded) expanded = [...direct];
        // A LOOP, not `push(...inner)`: the count comes from the file, and spreading a few
        // hundred thousand arguments is a stack overflow on V8, not a slow call.
        for (const id of inner) expanded.push(id);
        visit(inner, depth + 1);
      }
    };
    visit(direct, 0);
    const atoms = expanded ?? direct;
    atomsByParagraph.set(paragraph, atoms);
    return atoms;
  };

  const drawingTokenForParagraph = (paragraph: OoxmlNode): string => {
    const cached = drawingTokensByParagraph.get(paragraph);
    if (cached?.resourceEpoch === resourceEpoch) return cached.token;
    const atoms = atomsWithHostedStories(paragraph);
    if (atoms.length === 0) {
      drawingTokensByParagraph.set(paragraph, { resourceEpoch, token: '' });
      return '';
    }
    const tokens = atoms
      .map((atomId) =>
        framedAtomToken(
          atomProjections.get(atomId) ?? null,
          atomId,
          resourceOf,
          (projection) => resourceEpochByKey.get(pendingResourceKey(projection)) ?? 0
        )
      )
      .sort();
    const token = framedTokenJoin(tokens);
    drawingTokensByParagraph.set(paragraph, { resourceEpoch, token });
    return token;
  };

  return {
    context,
    cacheTokenForPart: () =>
      `${ownerPartName}|${resourceEpoch}|${generation}|${atomProjections.size}`,
    drawingTokenForParagraph,
    pendingResourceCount: () => inFlight.size,
    isCompatibleWith: (nextPart, nextPkg) => {
      const nextTheme = createPackageShapeThemeResolvers(nextPkg);
      if (nextTheme.cacheToken !== theme.cacheToken) return false;
      if (nextPart === part) return true;
      const nextAtomIdentities = drawingAtomIdentities(nextPart);
      if (atomIdentities && nextAtomIdentities && atomIdentities.size === nextAtomIdentities.size) {
        let unchanged = true;
        for (const [id, node] of atomIdentities) {
          if (nextAtomIdentities.get(id) !== node) {
            unchanged = false;
            break;
          }
        }
        if (unchanged) return true;
      }
      const nextProjections = indexInlineDrawingProjectionsInPart(nextPart, {
        resolveRelationship: createDrawingRelationshipResolver(nextPkg, ownerPartName),
        resolveSchemeColor: nextTheme.resolveSchemeColor,
        resolveStyleMatrixReference: nextTheme.resolveStyleMatrixReference,
      });
      if (nextProjections.size !== atomProjections.size) return false;
      for (const [atomId, projection] of atomProjections) {
        const next = nextProjections.get(atomId);
        if (
          !next ||
          drawingProjectionLayoutToken(next) !== drawingProjectionLayoutToken(projection)
        ) {
          return false;
        }
      }
      return true;
    },
    dispose: () => {
      disposed = true;
      generation += 1;
      for (const state of resourceByKey.values()) {
        if (state.kind === 'ready') forgetReadyHandle(state.validatedHandle);
      }
      resourceByKey.clear();
      inFlight.clear();
      resourceEpochByKey.clear();
    },
  };
}

/**
 * Monotonic PROCESS-WIDE slot mint, folded into `cacheTokenForPart`: a slot's own epoch
 * counters restart at zero when a reset recreates it, so `part|0|0|N` would recur and an
 * epoch-keyed consumer (the section prepass memo, {@link tableDrawingTokenCache}) could
 * validate against a stale token. A fresh mint per created slot makes every recreation
 * observably different, which fails safe — one extra rebuild, never a stale reuse.
 *
 * Process-wide, not per-bundle: {@link tableDrawingTokenCache} is module-level, so two
 * bundles that see the same node objects must never emit the same epoch string for
 * different resource states.
 */
let slotMintCounter = 0;

export function createInlineDrawingLayoutBundle(
  options: CreateInlineDrawingLayoutBundleOptions
): InlineDrawingLayoutBundle {
  let pkgRevision = options.session.packageRevision();
  let pkgSnapshot = options.session.currentPackage();
  let lookup =
    options.resourceLookup ??
    createOwnedImageResourceLookup(pkgSnapshot, {
      decodePort: options.decodePort,
    });
  const slots = new Map<string, PartDrawingContextSlot>();
  const partByName = new Map<string, OoxmlPart>();
  const slotMintBySlot = new WeakMap<PartDrawingContextSlot, number>();
  const handlesByKey = new Map<string, ValidatedImageBytesHandle>();
  const releaseTokensByKey = new Map<string, ValidatedImageBytesReleaseToken>();
  const rememberReadyHandle = (handle: ValidatedImageBytesHandle): void => {
    handlesByKey.set(handle.resourceKey, handle);
    const token = retainValidatedImageBytes(handle);
    if (token) releaseTokensByKey.set(handle.resourceKey, token);
  };
  const forgetReadyHandle = (handle: ValidatedImageBytesHandle): void => {
    handlesByKey.delete(handle.resourceKey);
    const token = releaseTokensByKey.get(handle.resourceKey);
    if (token) {
      releaseValidatedImageBytesToken(token);
      releaseTokensByKey.delete(handle.resourceKey);
    }
  };

  const resolvePart = (ownerPartName: string, reader: InlineDrawingPackageReader): OoxmlPart => {
    const pkg = reader.currentPackage();
    const existing = pkg.parts.get(ownerPartName) ?? partByName.get(ownerPartName);
    if (existing) return existing;
    if (ownerPartName === reader.part().name) return reader.part();
    throw new Error(`Missing inline drawing part ${ownerPartName}`);
  };

  const slotFor = (
    ownerPartName: string,
    reader: InlineDrawingPackageReader
  ): PartDrawingContextSlot => {
    // Slot first: layout keys a drawing token per paragraph through here, and slot
    // compatibility between flushes is `resetPackage`'s job (driven by `sync()`), not
    // this lookup's. Resolving the part on every hit made each token pay a package
    // snapshot for an answer the slot map already had.
    const existing = slots.get(ownerPartName);
    if (existing) return existing;
    const part = resolvePart(ownerPartName, reader);
    partByName.set(ownerPartName, part);
    const slot = createPartDrawingContextSlot({
      ownerPartName,
      part,
      pkg: reader.currentPackage(),
      lookup,
      onResourceSettled: () => options.onResourcesChanged(),
      rememberReadyHandle,
      forgetReadyHandle,
    });
    slots.set(ownerPartName, slot);
    slotMintCounter += 1;
    slotMintBySlot.set(slot, slotMintCounter);
    return slot;
  };

  const resetPackage = (reader: InlineDrawingPackageReader): void => {
    const nextPkg = reader.currentPackage();
    const resourceSubstrateUnchanged =
      nextPkg.partBytes === pkgSnapshot.partBytes &&
      nextPkg.relationships === pkgSnapshot.relationships &&
      nextPkg.contentTypes === pkgSnapshot.contentTypes;
    if (resourceSubstrateUnchanged) {
      for (const [ownerPartName, slot] of slots) {
        const nextPart =
          nextPkg.parts.get(ownerPartName) ??
          (ownerPartName === reader.part().name ? reader.part() : undefined);
        if (nextPart && slot.isCompatibleWith(nextPart, nextPkg)) {
          partByName.set(ownerPartName, nextPart);
          continue;
        }
        slot.dispose();
        slots.delete(ownerPartName);
        partByName.delete(ownerPartName);
      }
      pkgRevision = reader.packageRevision();
      pkgSnapshot = nextPkg;
      return;
    }
    for (const slot of slots.values()) slot.dispose();
    slots.clear();
    partByName.clear();
    for (const token of releaseTokensByKey.values()) releaseValidatedImageBytesToken(token);
    releaseTokensByKey.clear();
    handlesByKey.clear();
    if (!options.resourceLookup) lookup.dispose();
    pkgRevision = reader.packageRevision();
    pkgSnapshot = nextPkg;
    lookup =
      options.resourceLookup ??
      createOwnedImageResourceLookup(nextPkg, {
        decodePort: options.decodePort,
      });
  };

  return Object.freeze({
    get bodyContext() {
      return slotFor(options.session.part().name, options.session).context;
    },
    contextForPart(ownerPartName: string) {
      return slotFor(ownerPartName, options.session).context;
    },
    cacheTokenForPart(ownerPartName: string) {
      const slot = slotFor(ownerPartName, options.session);
      return `${slotMintBySlot.get(slot) ?? 0}|${slot.cacheTokenForPart()}`;
    },
    drawingTokenForParagraph(paragraph: OoxmlNode, ownerPartName: string) {
      const slot = slotFor(ownerPartName, options.session);
      // Slot mint belongs in the token: a package swap recreates the slot and
      // drops handle tracking, and a token that only names resource state would
      // reuse cached line records whose ready handles the new registry cannot mint.
      return `${slotMintBySlot.get(slot) ?? 0}|${slot.drawingTokenForParagraph(paragraph)}`;
    },
    pendingResourceCount() {
      let count = 0;
      for (const slot of slots.values()) count += slot.pendingResourceCount();
      return count;
    },
    mintValidatedBytes(handle: ValidatedImageBytesHandle, expectedContentId: string) {
      // A validated handle is a capability owned by the bundle that discovered and retained
      // it. The process registry can still mint a live handle belonging to another export
      // session, so check exact ownership before crossing the byte boundary.
      if (handlesByKey.get(handle.resourceKey) !== handle) return null;
      return mintValidatedImageBytes(handle, expectedContentId);
    },
    sync(reader: InlineDrawingPackageReader) {
      if (reader.packageRevision() === pkgRevision && reader.currentPackage() === pkgSnapshot)
        return;
      resetPackage(reader);
    },
    dispose() {
      for (const slot of slots.values()) slot.dispose();
      slots.clear();
      partByName.clear();
      for (const token of releaseTokensByKey.values()) releaseValidatedImageBytesToken(token);
      releaseTokensByKey.clear();
      handlesByKey.clear();
      if (!options.resourceLookup) lookup.dispose();
    },
  });
}

/** @deprecated Prefer {@link createInlineDrawingLayoutBundle}. */
export type InlineDrawingLayoutInput = InlineDrawingLayoutBundle;

/** @deprecated Prefer {@link createInlineDrawingLayoutBundle}. */
export const createInlineDrawingLayoutInput = createInlineDrawingLayoutBundle;

/** Whether a run child may carry an inline drawing atom. */
export function isInlineDrawingRunAtom(
  node: OoxmlNode
): node is OoxmlDrawingNode | OoxmlGenericElementNode {
  return node.kind === 'drawing' || isRunLevelMcAlternateContent(node);
}

/** Paragraph-local drawing cache token from a layout context (tests / headless callers). */
export function paragraphDrawingLayoutTokenFromContext(
  paragraph: OoxmlParagraphNode,
  context: InlineDrawingLayoutContext
): string {
  const atoms = drawingAtomsInParagraph(paragraph);
  if (atoms.length === 0) return '';
  return framedTokenJoin(
    atoms
      .map((atomId) =>
        framedAtomToken(context.projectionForAtom?.(atomId) ?? null, atomId, context.resourceOf)
      )
      .sort()
  );
}

/**
 * One framed atom entry of a paragraph drawing token — shared by the package slot builder
 * and the context builder so the two lanes cannot key different token shapes. The refused
 * arm is framed too; every part embeds file text, so no printable boundary survives.
 */
function framedAtomToken(
  projection: DrawingProjection | null,
  atomId: string,
  resourceOf: (projection: DrawingProjection) => ImageResourceState,
  epochOf?: (projection: DrawingProjection) => number
): string {
  if (!projection) return framedTokenJoin([atomId, 'refused']);
  const parts = [
    atomId,
    drawingProjectionLayoutToken(projection),
    drawingResourceLayoutToken(resourceOf(projection)),
  ];
  if (epochOf) parts.push(String(epochOf(projection)));
  return framedTokenJoin(parts);
}

/**
 * `drawingTokenForTableBlock` memoized per (immutable table node, drawing epoch).
 *
 * The table token exists to VALIDATE the prepass memo, so it is recomputed before every
 * memo hit — which walked every row and cell of every table on every layout pass. The
 * token is a pure function of the table subtree (node identity) and the part's drawing
 * projection/resource state, and `drawingLayoutEpoch` already stands in for the latter
 * (it moves whenever any projection or resource in the part does). No epoch means the
 * caller cannot see resource moves, so the recompute path is kept — the same rule the
 * section prepass memo follows.
 */
export function drawingTokenForTableBlockMemo(
  table: OoxmlNode,
  epoch: string | undefined,
  drawingTokenForParagraph: (paragraph: OoxmlNode) => string
): string {
  if (epoch === undefined) return drawingTokenForTableBlock(table, drawingTokenForParagraph);
  const cached = tableDrawingTokenCache.get(table);
  if (cached && cached.epoch === epoch) return cached.token;
  const token = drawingTokenForTableBlock(table, drawingTokenForParagraph);
  tableDrawingTokenCache.set(table, { epoch, token });
  return token;
}

/** Aggregated drawing token per immutable table node, valid for one drawing epoch. */
const tableDrawingTokenCache = new WeakMap<
  OoxmlNode,
  { readonly epoch: string; readonly token: string }
>();

/**
 * Aggregate per-paragraph drawing tokens for a table subtree (cache + incremental keys).
 *
 * The shared position-preserving walk (`aggregateParagraphTokensForTableBlock`): a
 * per-paragraph token embeds file-influenced values and its own printable separators, so a
 * printable join lets a token value shift a boundary, and sorting or skipping empties lets
 * two different paragraph-to-token ASSIGNMENTS over one byte-identical subtree concatenate
 * to the same string — and the table's prepared-block memo then serves a break with stale
 * drawing layout.
 */
export function drawingTokenForTableBlock(
  table: OoxmlNode,
  drawingTokenForParagraph: (paragraph: OoxmlNode) => string
): string {
  return aggregateParagraphTokensForTableBlock(table, drawingTokenForParagraph);
}

export { drawingProjectionLayoutToken, drawingResourceLayoutToken };
