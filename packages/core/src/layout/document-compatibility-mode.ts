import { WML_NAMESPACE_URI, type OoxmlElement } from '@docx-editor.dev/core/store';

const WORD_COMPATIBILITY_URI = 'http://schemas.microsoft.com/office/word';

/** Only an explicitly authored, supported Word compatibility mode affects this layout lane. */
export function compatibilityModeFromSettings(root: OoxmlElement | null): number | undefined {
  if (!root || root.namespaceUri !== WML_NAMESPACE_URI || root.localName !== 'settings') {
    return undefined;
  }
  let result: number | undefined;
  let found = false;
  for (const compat of root.children) {
    if (
      compat.kind === 'textValue' ||
      compat.namespaceUri !== WML_NAMESPACE_URI ||
      compat.localName !== 'compat'
    )
      continue;
    for (const setting of compat.children) {
      if (
        setting.kind === 'textValue' ||
        setting.namespaceUri !== WML_NAMESPACE_URI ||
        setting.localName !== 'compatSetting'
      )
        continue;
      const attribute = (name: string): string | undefined =>
        setting.attributes.find(
          (item) => item.namespaceUri === WML_NAMESPACE_URI && item.localName === name
        )?.value;
      if (attribute('name') !== 'compatibilityMode' || attribute('uri') !== WORD_COMPATIBILITY_URI)
        continue;
      // Duplicate/conflicting declarations are ambiguous; do not invent a winner.
      if (found) return undefined;
      found = true;
      const value = attribute('val');
      result =
        value === '11' || value === '12' || value === '14' || value === '15'
          ? Number(value)
          : undefined;
    }
  }
  // In particular, absence does not silently opt existing callers into legacy mode 12.
  return result;
}
