import type { OoxmlParagraphNode } from '../store/package/ooxml-tree.ts';
import { parsedFieldSpansOf } from '../store/package/field-nodes.ts';
import { MAX_FIELD_INSTRUCTION_CHARS, MAX_FIELD_NESTING } from './field-instruction.ts';

export interface FieldProjectionSpans {
  readonly atomBeginIds: ReadonlySet<string>;
  readonly editableResultBeginIds: ReadonlySet<string>;
  readonly coveredIds: ReadonlySet<string>;
}

/** Prepare the field span indexes used by one paragraph projection. */
export function fieldProjectionSpansOf(paragraph: OoxmlParagraphNode): FieldProjectionSpans {
  const fields = parsedFieldSpansOf(paragraph, {
    maxNesting: MAX_FIELD_NESTING,
    maxInstructionChars: MAX_FIELD_INSTRUCTION_CHARS,
  });
  const atoms = fields.filter((span) => span.addressing === 'atomic');
  const atomBeginIds = new Set(
    atoms.filter((span) => span.kind === 'complex').map((span) => span.node.id)
  );
  const editableResultBeginIds = new Set(
    fields
      .filter((span) => span.kind === 'complex' && span.addressing === 'editable-result')
      .map((span) => span.node.id)
  );
  const coveredIds = new Set<string>();
  for (const span of atoms) {
    for (const id of span.removeNodeIds) coveredIds.add(id);
  }
  return { atomBeginIds, editableResultBeginIds, coveredIds };
}
