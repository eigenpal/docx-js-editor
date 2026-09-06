import type { OoxmlNode, OoxmlPart } from '../package/ooxml-tree.ts';
import { WML_NAMESPACE_URI } from '../package/ooxml-shared.ts';

/**
 * Whether `settings.xml` enforces `w:documentProtection w:edit="forms"` (§17.15.1.29).
 *
 * Enforcement is a separate attribute from the mode: Word stores the mode a document was last
 * protected with even after the protection is lifted, so a file with `w:enforcement="0"` is an
 * ordinary editable document and treating it as protected would lock users out of their own
 * text.
 */
export function enforcesFormsProtection(settings: OoxmlPart | null | undefined): boolean {
  return formsProtectionEnabled(settings?.root);
}

/** Read forms protection from the settings root. */
export function formsProtectionEnabled(root: OoxmlNode | null | undefined): boolean {
  if (!root || root.kind === 'textValue') return false;
  for (const child of root.children) {
    if (child.kind === 'textValue') continue;
    if (child.namespaceUri !== WML_NAMESPACE_URI || child.localName !== 'documentProtection') {
      continue;
    }
    const attribute = (name: string): string | undefined =>
      child.attributes.find(
        (entry) => entry.localName === name && entry.namespaceUri === WML_NAMESPACE_URI
      )?.value;
    if (attribute('edit') !== 'forms') return false;
    return isTrue(attribute('enforcement'));
  }
  return false;
}

/** `ST_OnOff`: absent means on for a flag element, and "0"/"false"/"off" always means off. */
function isTrue(value: string | undefined): boolean {
  if (value === undefined) return true;
  return value !== '0' && value !== 'false' && value !== 'off';
}

/**
 * Whether the section owning a node still has form protection on.
 *
 * `w:formProt` is per-section, so a protected document may carry an unprotected section. The
 * owning section is the first `w:sectPr` at or after the node in body order, which is how a
 * section's extent is expressed in the body at all.
 */
export function sectionProtectsForms(part: OoxmlPart, nodeId: string): boolean {
  let seenTarget = false;
  let answer = true;
  const walk = (node: OoxmlNode): boolean => {
    if (node.kind === 'textValue') return false;
    if (node.id === nodeId) seenTarget = true;
    if (
      seenTarget &&
      node.namespaceUri === WML_NAMESPACE_URI &&
      node.localName === 'sectPr' &&
      node.id !== nodeId
    ) {
      const formProt = node.children.find(
        (child) =>
          child.kind !== 'textValue' &&
          child.namespaceUri === WML_NAMESPACE_URI &&
          child.localName === 'formProt'
      );
      // No `w:formProt` on the section leaves the document's own protection in force.
      if (formProt && formProt.kind !== 'textValue') {
        answer = isTrue(
          formProt.attributes.find(
            (entry) => entry.localName === 'val' && entry.namespaceUri === WML_NAMESPACE_URI
          )?.value
        );
      }
      return true;
    }
    for (const child of node.children) {
      if (walk(child)) return true;
    }
    return false;
  };
  walk(part.root);
  return answer;
}
