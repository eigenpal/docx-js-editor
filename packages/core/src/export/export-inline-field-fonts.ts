import {
  createFieldParseState,
  effectiveFieldInstruction,
  onFldCharBegin,
  onFldCharEnd,
  onFldCharSeparate,
  onInstrText,
  resetFieldParseState,
} from '../layout/field-instruction.ts';
import { parseSymbolInstruction } from '../layout/field-symbol.ts';
import type { OoxmlElement } from '../store/package/ooxml-tree.ts';
import {
  MAX_INLINE_CONTAINER_DEPTH,
  nextInlineContainerDepth,
  WML_NAMESPACE_URI,
} from '../store/package/ooxml-shared.ts';

function attributeValue(node: OoxmlElement, localName: string): string | undefined {
  return node.attributes.find((attribute) => attribute.localName === localName)?.value;
}

export function boundedTextContent(root: OoxmlElement): string {
  let text = '';
  const stack = [...root.children].reverse();
  while (stack.length > 0 && text.length <= 256) {
    const node = stack.pop()!;
    if (node.kind === 'textValue') text += node.value;
    else {
      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        stack.push(node.children[index]!);
      }
    }
  }
  return text;
}

function noteEffectiveSymbolFont(
  state: ReturnType<typeof createFieldParseState>,
  families: string[]
): void {
  const effective = effectiveFieldInstruction(state);
  if (effective.overflow) return;
  const spec = parseSymbolInstruction(effective.instruction);
  if (spec?.font) families.push(spec.font);
}

export function complexSymbolFieldFonts(paragraph: OoxmlElement): readonly string[] {
  const families: string[] = [];
  const state = createFieldParseState();
  const stack: Array<{ node: OoxmlElement; containerDepth: number }> = [];
  for (let index = paragraph.children.length - 1; index >= 0; index -= 1) {
    const child = paragraph.children[index]!;
    if (child.kind !== 'textValue') stack.push({ node: child as OoxmlElement, containerDepth: 0 });
  }
  while (stack.length > 0) {
    const { node, containerDepth } = stack.pop()!;
    if (containerDepth >= MAX_INLINE_CONTAINER_DEPTH) continue;
    if (node.namespaceUri === WML_NAMESPACE_URI && node.localName === 'p') continue;
    if (node.namespaceUri === WML_NAMESPACE_URI && node.localName === 'fldChar') {
      const kind = attributeValue(node, 'fldCharType');
      if (kind === 'begin') onFldCharBegin(state);
      else if (kind === 'separate') {
        if (state.nesting === 1) noteEffectiveSymbolFont(state, families);
        onFldCharSeparate(state);
      } else if (kind === 'end') {
        if (state.nesting === 1) noteEffectiveSymbolFont(state, families);
        onFldCharEnd(state);
      }
      continue;
    }
    if (
      node.namespaceUri === WML_NAMESPACE_URI &&
      (node.localName === 'instrText' || node.localName === 'delInstrText')
    ) {
      onInstrText(state, boundedTextContent(node), node.localName === 'delInstrText');
      continue;
    }
    if (node.namespaceUri === WML_NAMESPACE_URI && node.localName === 'fldSimple') {
      const spec = parseSymbolInstruction(attributeValue(node, 'instr') ?? '');
      if (spec?.font) families.push(spec.font);
    }
    const depth = nextInlineContainerDepth(node, containerDepth);
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      const child = node.children[index]!;
      if (child.kind !== 'textValue')
        stack.push({ node: child as OoxmlElement, containerDepth: depth });
    }
  }
  resetFieldParseState(state);
  return families;
}
