// Property preservation for paragraph splits through lossless inline wrappers.

import { isInlineContainerProperty } from '../package/inline-container-properties.ts';
import type { OoxmlNode } from '../package/ooxml-tree.ts';
import { cloneWithNewIds } from './tree-op-nodes.ts';

/** Authored property children that every split copy of a lossless wrapper must retain. */
export function inlineWrapperProperties(wrapper: OoxmlNode): readonly OoxmlNode[] {
  if (wrapper.kind === 'textValue') return [];
  return wrapper.children.filter((child) => isInlineContainerProperty(wrapper, child));
}

/** Put wrapper properties before content, cloning them for a newly minted wrapper. */
export function wrapperChildren(
  properties: readonly OoxmlNode[],
  content: readonly OoxmlNode[],
  cloneProperties: boolean,
  nextId: () => string
): readonly OoxmlNode[] {
  const children: OoxmlNode[] = [];
  for (const property of properties) {
    children.push(cloneProperties ? cloneWithNewIds(property, nextId) : property);
  }
  for (const node of content) children.push(node);
  return children;
}
