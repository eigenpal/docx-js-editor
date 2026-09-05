import { expect, test } from 'bun:test';
import { readOoxmlPart, type HeadlessDocumentView } from '@docx-editor.dev/core/store';
import { compatibilityModeFromSettings } from '../document-compatibility-mode.ts';
import { createDocumentStyleDependencies } from '../document-style-deps.ts';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const URI = 'http://schemas.microsoft.com/office/word';
function settings(body: string, namespace = W) {
  const read = readOoxmlPart(
    `<w:settings xmlns:w="${namespace}" xmlns:x="urn:foreign">${body}</w:settings>`,
    { name: '/word/settings.xml', contentType: 'application/xml' }
  );
  if (!read.ok) throw new Error(read.reason);
  return read.part.root;
}
const setting = (mode: string) =>
  `<w:compatSetting w:name="compatibilityMode" w:uri="${URI}" w:val="${mode}"/>`;

test('projects only supported explicitly authored Word compatibility modes', () => {
  for (const mode of ['11', '12', '14', '15']) {
    expect(compatibilityModeFromSettings(settings(`<w:compat>${setting(mode)}</w:compat>`))).toBe(
      Number(mode)
    );
  }
  for (const mode of [
    '13',
    '16',
    '0',
    '-1',
    '12.0',
    '+12',
    ' 12 ',
    'NaN',
    '9999999999999999999999',
  ]) {
    expect(
      compatibilityModeFromSettings(settings(`<w:compat>${setting(mode)}</w:compat>`))
    ).toBeUndefined();
  }
  expect(compatibilityModeFromSettings(null)).toBeUndefined();
  expect(compatibilityModeFromSettings(settings(''))).toBeUndefined();
});

test('requires the settings/compat path and expanded names, not a matching local name alone', () => {
  const valid = setting('14');
  const bodies = [
    valid,
    `<x:compat>${valid}</x:compat>`,
    `<w:compat>${valid.replaceAll('w:compatSetting', 'x:compatSetting')}</w:compat>`,
    ...['name', 'uri', 'val'].map(
      (attr) => `<w:compat>${valid.replace(`w:${attr}`, `x:${attr}`)}</w:compat>`
    ),
    `<w:compat>${valid.replace(URI, 'urn:other')}</w:compat>`,
    `<w:compat>${valid.replace('compatibilityMode', 'other')}</w:compat>`,
    `<w:compat>${valid}${setting('15')}</w:compat>`,
    `<w:compat><x:wrapper>${valid}</x:wrapper></w:compat>`,
  ];
  for (const body of bodies) expect(compatibilityModeFromSettings(settings(body))).toBeUndefined();
  expect(
    compatibilityModeFromSettings(settings(`<w:compat>${valid}</w:compat>`, 'urn:foreign'))
  ).toBeUndefined();
  const aliased = settings(`<w:compat>${valid}</w:compat>`);
  // Prefixes are fidelity metadata; namespace URIs remain authoritative.
  expect(compatibilityModeFromSettings({ ...aliased, prefix: 'another' })).toBe(14);
});

test('a retained style-dependency callback observes settings changes and removals', () => {
  let current = settings(`<w:defaultTabStop w:val="720"/><w:compat>${setting('14')}</w:compat>`);
  const deps = createDocumentStyleDependencies({
    settingsRoot: () => current,
  } as unknown as HeadlessDocumentView);
  expect(deps.defaultTabStopPt()).toBe(36);
  expect(deps.compatibilityMode()).toBe(14);
  current = settings(`<w:defaultTabStop w:val="1440"/><w:compat>${setting('15')}</w:compat>`);
  expect(deps.compatibilityMode()).toBe(15);
  expect(deps.defaultTabStopPt()).toBe(72);
  current = settings('');
  expect(deps.defaultTabStopPt()).toBe(36);
  expect(deps.compatibilityMode()).toBeUndefined();
});
