import { expect, test } from 'bun:test';
import { strToU8, zipSync } from 'fflate';
import { readOoxmlPart } from '@docx-editor.dev/core/store';
import { createFixedMeasurer } from '../../layout/fixed-measurer.ts';
import { createParagraphLayoutCache } from '../../layout/layout-cache.ts';
import { createLayoutSession } from '../../layout/layout-session.ts';
import { layoutSemanticDocument } from '../../layout/semantic-layout.ts';
import type { PendingLine } from '../../layout/pending-line.ts';
import type { SemanticLayout } from '../../layout/semantic-records.ts';
import { openDocumentForExport } from '../../export/export-session.ts';
import { mountPaginatedSurface } from '../paginated-surface.ts';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const body =
  '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblInd w:w="0" w:type="dxa"/>' +
  '<w:tblLayout w:type="autofit"/><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
  '<w:tblGrid><w:gridCol w:w="4788"/><w:gridCol w:w="4788"/></w:tblGrid><w:tr>' +
  '<w:tc><w:p><w:r><w:t>one</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>two</w:t></w:r></w:p></w:tc>' +
  '</w:tr></w:tbl><w:p/><w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:left="1440" w:right="1440" w:top="1440" w:bottom="1440"/></w:sectPr>';
const documentXml = `<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`;
const measurer = createFixedMeasurer(6, 14);

function bytes(mode: number | undefined) {
  return zipSync({
    '[Content_Types].xml': strToU8(
      `<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>`
    ),
    '_rels/.rels': strToU8(
      `<Relationships xmlns="${REL}"><Relationship Id="rDoc" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`
    ),
    'word/_rels/document.xml.rels': strToU8(
      `<Relationships xmlns="${REL}"><Relationship Id="rSettings" Type="${R}/settings" Target="settings.xml"/></Relationships>`
    ),
    'word/document.xml': strToU8(documentXml),
    'word/settings.xml': strToU8(
      `<w:settings xmlns:w="${W}">${mode === undefined ? '' : `<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="${mode}"/></w:compat>`}</w:settings>`
    ),
  });
}
function table(layout: SemanticLayout) {
  const result = layout.pages
    .flatMap((page) => page.fragments)
    .find((fragment) => fragment.kind === 'table');
  if (!result || result.kind !== 'table') throw new Error('missing table');
  return result;
}

test('browser and byte-export hosts share explicitly authored compatibility geometry', async () => {
  for (const mode of [11, 12, 14, 15, undefined, 16]) {
    const input = bytes(mode);
    const container = document.createElement('div');
    document.body.append(container);
    const mounted = mountPaginatedSurface(container, input, { measurer, scale: 1 });
    if (!mounted.ok) throw new Error(mounted.reason);
    const exported = openDocumentForExport(input, { measurer });
    if (!exported.ok) throw new Error(exported.reason);
    try {
      const browser = table(mounted.surface.layout());
      const headless = table(await exported.session.layout());
      const expected = mode === 11 || mode === 12 || mode === 14 ? 478.8 : 468;
      expect(browser.box.width).toBeCloseTo(expected, 8);
      expect(headless.box.width).toBeCloseTo(expected, 8);
      expect(headless.columnEdges).toEqual(browser.columnEdges);
      expect(headless.box.x).toBeCloseTo(browser.box.x, 8);
    } finally {
      mounted.surface.destroy();
      exported.session.dispose();
      container.remove();
    }
  }
});

test('switching compatibility mode invalidates prepared tables and retained layout sessions', () => {
  const parsed = readOoxmlPart(documentXml, {
    name: '/word/document.xml',
    contentType: 'application/xml',
  });
  if (!parsed.ok) throw new Error(parsed.reason);
  const session = createLayoutSession();
  const cache = createParagraphLayoutCache<readonly PendingLine[]>();
  const layout = (mode: number | undefined) =>
    layoutSemanticDocument(parsed.part, 0, {
      measurer,
      session,
      cache,
      producer: 'compatibility-cache-test',
      compatibilityMode: mode,
      drawingLayoutEpoch: 'stable',
      projectionEpoch: 'stable',
    });
  expect(table(layout(14)).box.width).toBeCloseTo(478.8, 8);
  const initialKeys = [...session.keys];
  const initialPrepass = session.prepass;
  layout(14);
  expect(session.stats.placed).toBe(0);
  expect(session.prepass).toBe(initialPrepass);
  expect(table(layout(15)).box.width).toBeCloseTo(468, 8);
  expect(session.keys).not.toEqual(initialKeys);
  expect(session.prepass).not.toBe(initialPrepass);
  expect(session.stats.placed).toBeGreaterThan(0);
  expect(table(layout(14)).box.width).toBeCloseTo(478.8, 8);
  expect(session.keys).toEqual(initialKeys);
  expect(table(layout(undefined)).box.width).toBeCloseTo(468, 8);
});
