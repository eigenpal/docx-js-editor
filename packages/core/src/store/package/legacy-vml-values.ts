import type { OoxmlElement, OoxmlNode } from './ooxml-tree.ts';

export const VML = 'urn:schemas-microsoft-com:vml';
export const OFFICE = 'urn:schemas-microsoft-com:office:office';
export const WORD_VML = 'urn:schemas-microsoft-com:office:word';
export const element = (node: OoxmlNode): node is OoxmlElement => node.kind !== 'textValue';
export const named = (node: OoxmlNode, ns: string, name: string): boolean =>
  element(node) && node.namespaceUri === ns && node.localName === name;
export const attribute = (node: OoxmlElement, name: string, ns = '') =>
  node.attributes.find((a) => (a.namespaceUri ?? '') === ns && a.localName === name)?.value;
export function children(node: OoxmlElement): OoxmlElement[] {
  const values: readonly OoxmlNode[] = node.children;
  return values.filter(element);
}
export const off = (value: string | undefined) => /^(f|false|0)$/i.test(value ?? '');
export const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!
  );
export function numeric(value: string | undefined): number {
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value ?? '')) return NaN;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= 1_000_000 ? n : NaN;
}
export function points(value: string | undefined): number {
  const match = value?.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))(pt|in|cm|mm|px)?$/i);
  if (!match) return NaN;
  return (
    numeric(match[1]) *
    { pt: 1, in: 72, cm: 72 / 2.54, mm: 72 / 25.4, px: 0.75 }[match[2]?.toLowerCase() ?? 'pt']!
  );
}
export function pair(value: string): [number, number] | null {
  const values = value
    .trim()
    .split(/[,\s]+/)
    .map(numeric);
  return values.length === 2 && values.every(Number.isFinite) ? (values as [number, number]) : null;
}
export function styleOf(node: OoxmlElement): ReadonlyMap<string, string> | null {
  const styles = new Map<string, string>();
  for (const part of (attribute(node, 'style') ?? '').split(';')) {
    if (!part.trim()) continue;
    const i = part.indexOf(':');
    if (i < 1 || styles.size >= 48) return null;
    const key = part.slice(0, i).trim().toLowerCase();
    if (styles.has(key)) return null;
    styles.set(key, part.slice(i + 1).trim());
  }
  return styles;
}
export function color(value: string | undefined, fallback: string): string | null {
  const raw = (value ?? fallback).replace(/\s+\[\d+\]$/, '').toLowerCase();
  if (/^#[\da-f]{6}$/.test(raw)) return raw;
  return (
    new Map([
      ['black', '#000000'],
      ['white', '#ffffff'],
      ['red', '#ff0000'],
      ['blue', '#0000ff'],
      ['green', '#008000'],
    ]).get(raw) ?? null
  );
}

/** Bound the complete input before doing any splitting, recursion or SVG allocation. */
export function boundedVml(node: OoxmlNode): boolean {
  const stack = [{ node, depth: 0 }];
  let visited = 0,
    characters = 0;
  while (stack.length) {
    const current = stack.pop()!;
    if (++visited > 512 || current.depth > 16) return false;
    if (!element(current.node)) {
      if (current.node.value.trim()) return false;
      characters += current.node.value.length;
    } else {
      if (
        visited + stack.length + current.node.children.length > 512 ||
        current.node.attributes.length > 48
      )
        return false;
      for (const attr of current.node.attributes) {
        // Equation Editor stores opaque source metadata beside its preview.
        // Never parse or emit that metadata into SVG. It still counts against
        // the complete 64 KiB input budget below.
        const equationMetadata =
          named(current.node, VML, 'shape') &&
          attr.localName === 'equationxml' &&
          (!attr.namespaceUri || attr.namespaceUri === OFFICE);
        if (attr.value.length > (equationMetadata ? 65_536 : 8192)) return false;
        characters += attr.value.length;
      }
      for (const child of current.node.children)
        stack.push({ node: child, depth: current.depth + 1 });
    }
    if (characters > 65_536) return false;
  }
  return true;
}
