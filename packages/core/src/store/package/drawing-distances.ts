import { schemaAttributeValue } from './ooxml-drawing-rules.ts';
import { parseEmu } from './drawing-shape-projection.ts';
import type { OoxmlElement } from './ooxml-tree.ts';

export function readDistances(
  node: OoxmlElement,
  fallback?: OoxmlElement
): Readonly<{ top: number; right: number; bottom: number; left: number }> {
  // An explicit wrap-side value, including zero, overrides only that anchor side.
  const distance = (name: string): number =>
    parseEmu(
      schemaAttributeValue(node.attributes, name) ??
        (fallback ? schemaAttributeValue(fallback.attributes, name) : undefined)
    ) ?? 0;
  return Object.freeze({
    top: distance('distT'),
    right: distance('distR'),
    bottom: distance('distB'),
    left: distance('distL'),
  });
}
