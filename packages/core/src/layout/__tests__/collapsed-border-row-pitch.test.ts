import { expect, test } from 'bun:test';
import { readOoxmlPart, serializeOoxmlPart } from '../../store/package/ooxml-tree.ts';
import { contentInsets } from '../table-cell-geometry.ts';
import { createFixedMeasurer, layoutSemanticDocument } from '../semantic-layout.ts';

test('collapsed horizontal borders contribute half their stroke to each cell', () => {
  const margins = { top: 0, right: 5, bottom: 0, left: 5 };
  const edge = { state: 'edge' as const, style: 'single' as const, widthPt: 0.5, color: '000000' };
  const borders = {
    top: edge,
    bottom: edge,
    left: { state: 'omitted' as const },
    right: { state: 'omitted' as const },
  };
  expect(contentInsets(margins, borders).top).toBe(0.25);
  expect(contentInsets(margins, borders).bottom).toBe(0.25);
  expect(contentInsets(margins, borders, 2).top).toBe(0.5);
  expect(contentInsets(margins, borders, 2).bottom).toBe(0.5);
});

test('twenty exact-height lines and collapsed rules fit a 322-point table band', () => {
  const rule = '<w:top w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/>';
  const row = (index: number) => `<w:tr><w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/>
    <w:tcBorders>${rule}</w:tcBorders></w:tcPr><w:p><w:pPr>
    <w:spacing w:line="312" w:lineRule="exact"/></w:pPr><w:r><w:t>${index}</w:t></w:r></w:p></w:tc></w:tr>`;
  const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
    <w:tbl><w:tblPr><w:tblBorders>${rule}</w:tblBorders><w:tblCellMar>
    <w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/>
    </w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="2000"/></w:tblGrid>
    ${Array.from({ length: 20 }, (_, index) => row(index + 1)).join('')}
    </w:tbl></w:body></w:document>`;
  const parsed = readOoxmlPart(xml, { name: '/word/document.xml', contentType: 'app/xml' });
  if (!parsed.ok) throw new Error(parsed.reason);
  const before = serializeOoxmlPart(parsed.part);
  const result = layoutSemanticDocument(parsed.part, 0, {
    geometry: { width: 200, height: 342, margin: { top: 10, right: 10, bottom: 10, left: 10 } },
    measurer: createFixedMeasurer(5, 12),
  });
  expect(result.pages).toHaveLength(1);
  const rows = result.pages.flatMap((page) =>
    page.fragments.flatMap((fragment) => (fragment.kind === 'table' ? fragment.rows : []))
  );
  expect(rows).toHaveLength(20);
  for (const item of rows) expect(item.box.height).toBeCloseTo(16.1, 7);
  expect(serializeOoxmlPart(parsed.part)).toBe(before);
});
