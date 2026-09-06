// Bounded, inert detection of cross-paragraph TOC complex fields.

import { isContentControl, isContentControlContent } from './content-control-walk.ts';
import { fldCharType, instrTextValue, isInstrTextNode } from './field-nodes.ts';
import type { OoxmlElement, OoxmlNode, OoxmlPart } from './ooxml-tree.ts';
import { MAX_INLINE_CONTAINER_DEPTH, nextInlineContainerDepth } from './ooxml-shared.ts';
import {
  TOC_MAX_FIELD_NESTING,
  TOC_MAX_INSTRUCTION_CHARS,
  parseTocInstruction,
  type TocInstruction,
} from './toc-instruction.ts';

/** A table of contents found in a document, whether wrapped in an SDT or a bare field. */
export interface DetectedToc {
  /** Enclosing control id when it identifies one TOC, otherwise the begin fldChar id. */
  readonly id: string;
  readonly beginNodeId: string;
  readonly beginParagraphId: string;
  readonly endParagraphId: string;
  readonly resultParagraphIds: readonly string[];
  /** Direct parent whose paragraph children delimit the cached result. */
  readonly containerId: string;
  readonly contentControlId?: string;
  readonly instruction: TocInstruction;
}

interface OpenField {
  readonly beginNodeId: string;
  readonly beginParagraphId: string;
  readonly containerId: string;
  readonly contentControlId?: string;
  readonly instructionChunks: string[];
  readonly resultParagraphIds: string[];
  instructionLength: number;
  separated: boolean;
  invalid: boolean;
}

function bodyOf(part: OoxmlPart): OoxmlElement | null {
  if (part.root.kind === 'body') return part.root;
  for (const child of part.root.children) {
    if (child.kind === 'body') return child;
  }
  return null;
}

const fieldTokensByParagraph = new WeakMap<OoxmlElement, readonly OoxmlNode[]>();

function fieldTokens(paragraph: OoxmlElement): readonly OoxmlNode[] {
  const cached = fieldTokensByParagraph.get(paragraph);
  if (cached) return cached;
  const tokens: OoxmlNode[] = [];
  const walk = (node: OoxmlNode, depth: number): void => {
    if (node.kind === 'textValue') return;
    if (depth >= MAX_INLINE_CONTAINER_DEPTH) return;
    if (fldCharType(node) !== null || isInstrTextNode(node)) {
      tokens.push(node);
      return;
    }
    const nextDepth = nextInlineContainerDepth(node, depth);
    for (const child of node.children) walk(child, nextDepth);
  };
  for (const child of paragraph.children) walk(child, 0);
  fieldTokensByParagraph.set(paragraph, tokens);
  return tokens;
}

type DetectedTocCandidate = Omit<DetectedToc, 'id'>;
type ContainerTocResult = DetectedToc | DetectedTocCandidate;

const EMPTY_TOCS: readonly DetectedToc[] = Object.freeze([]);
const detectedTocsByContainer = new WeakMap<OoxmlElement, readonly DetectedToc[]>();

/**
 * Detect fields whose paragraphs share one direct container.
 *
 * A commit rebuilds the edited ancestor chain. Unchanged content-control containers retain
 * their identity, so their complete TOC answers remain reusable across part revisions.
 */
function detectTocsInContainer(
  container: OoxmlElement,
  contentControlId: string | undefined,
  depth: number
): readonly DetectedToc[] {
  const cached = detectedTocsByContainer.get(container);
  if (cached) return cached;
  const stack: (OpenField | null)[] = [];
  const completed: ContainerTocResult[] = [];

  const processParagraph = (paragraph: OoxmlElement): void => {
    for (const token of fieldTokens(paragraph)) {
      const type = fldCharType(token);
      if (type === 'begin') {
        if (stack.length >= TOC_MAX_FIELD_NESTING) {
          stack.push(null);
        } else {
          stack.push({
            beginNodeId: token.id,
            beginParagraphId: paragraph.id,
            containerId: container.id,
            contentControlId,
            instructionChunks: [],
            resultParagraphIds: [],
            instructionLength: 0,
            separated: false,
            invalid: false,
          });
        }
        continue;
      }

      const field = stack[stack.length - 1];
      if (isInstrTextNode(token)) {
        if (field && !field.separated) {
          const chunk = instrTextValue(token);
          field.instructionLength += chunk.length;
          if (field.instructionLength > TOC_MAX_INSTRUCTION_CHARS) field.invalid = true;
          else field.instructionChunks.push(chunk);
        }
        continue;
      }
      if (type === 'separate') {
        if (field) field.separated = true;
        continue;
      }
      if (type !== 'end' || stack.length === 0) continue;

      const ended = stack.pop();
      if (
        ended &&
        ended.separated &&
        !ended.invalid &&
        ended.containerId === container.id &&
        ended.beginParagraphId !== paragraph.id
      ) {
        const instruction = parseTocInstruction(ended.instructionChunks.join(''));
        if (instruction) {
          completed.push({
            beginNodeId: ended.beginNodeId,
            beginParagraphId: ended.beginParagraphId,
            endParagraphId: paragraph.id,
            resultParagraphIds: ended.resultParagraphIds,
            containerId: ended.containerId,
            ...(ended.contentControlId ? { contentControlId: ended.contentControlId } : {}),
            instruction,
          });
        }
      }
    }

    for (const field of stack) {
      if (
        field &&
        field.separated &&
        field.beginParagraphId !== paragraph.id &&
        field.containerId === container.id
      ) {
        field.resultParagraphIds.push(paragraph.id);
      }
    }
  };

  for (const child of container.children) {
    if (child.kind === 'paragraph') {
      processParagraph(child);
      continue;
    }
    if (!isContentControl(child) || depth >= TOC_MAX_FIELD_NESTING) continue;
    for (const content of child.children) {
      if (!isContentControlContent(content)) continue;
      completed.push(...detectTocsInContainer(content, child.id, depth + 1));
    }
  }

  const controlCounts = new Map<string, number>();
  for (const toc of completed) {
    if (!('id' in toc) && toc.contentControlId) {
      controlCounts.set(toc.contentControlId, (controlCounts.get(toc.contentControlId) ?? 0) + 1);
    }
  }
  const result = completed.map(
    (toc): DetectedToc =>
      'id' in toc
        ? toc
        : {
            ...toc,
            id:
              toc.contentControlId && controlCounts.get(toc.contentControlId) === 1
                ? toc.contentControlId
                : toc.beginNodeId,
          }
  );
  const immutable = result.length > 0 ? Object.freeze(result) : EMPTY_TOCS;
  detectedTocsByContainer.set(container, immutable);
  return immutable;
}

/** Memoized per immutable part identity for repeated reads within one revision. */
const detectBodyTocsCache = new WeakMap<OoxmlPart, readonly DetectedToc[]>();

/** Discover refreshable body TOCs without evaluating any field instruction. */
export function detectBodyTocs(part: OoxmlPart): readonly DetectedToc[] {
  const cached = detectBodyTocsCache.get(part);
  if (cached) return cached;
  const body = bodyOf(part);
  const result = body ? detectTocsInContainer(body, undefined, 0) : EMPTY_TOCS;
  detectBodyTocsCache.set(part, result);
  return result;
}

/** Locate the table of contents containing a position, or null. */
export function findDetectedToc(tocs: readonly DetectedToc[], tocId: string): DetectedToc | null {
  return tocs.find((toc) => toc.id === tocId) ?? null;
}
