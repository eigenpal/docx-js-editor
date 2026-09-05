import { describe, expect, test } from 'bun:test';
import { readOoxmlPart, serializeOoxmlPart } from '../../store/package/ooxml-tree.ts';
import { contentInsets } from '../table-cell-geometry.ts';
import { contentInsets as compatibilityInsets } from '../table-cell-box.ts';
import type { CellBorderBox, TableBorderSide } from '../table-borders.ts';
import {
  readTableStructure,
  tableOriginX,
  type SemanticTableStructure,
} from '../semantic-table.ts';
import { createFixedMeasurer, layoutSemanticDocument } from '../semantic-layout.ts';
import { layoutTableFragment } from '../semantic-table-layout.ts';
import type { ParagraphFragmentRecord, TableFragmentRecord } from '../semantic-records.ts';

const edge = (
  widthPt: number,
  style: 'single' | 'thick' | 'double' = 'single'
): TableBorderSide => ({ state: 'edge', widthPt, style, color: '000000' });
const borders = (left = edge(0.5), right = left): CellBorderBox => ({
  top: edge(0.5),
  bottom: edge(0.5),
  left,
  right,
});
const margins = (left = 5.4, right = left) => ({ top: 1, bottom: 2, left, right });

describe('narrow legacy collapsed-cell horizontal inset policy', () => {
  for (const [name, calculate] of [
    ['geometry', contentInsets],
    ['compatibility', compatibilityInsets],
  ] as const) {
    test(`${name}: the ordinary border-box path is unchanged`, () => {
      expect(calculate(margins(), borders())).toEqual({
        top: 1.5,
        bottom: 2.5,
        left: 5.9,
        right: 5.9,
      });
    });
    test(`${name}: covered half-strokes do not add a second horizontal charge`, () => {
      expect(calculate(margins(), borders(), true)).toEqual({
        top: 1.5,
        bottom: 2.5,
        left: 5.4,
        right: 5.4,
      });
      expect(calculate(margins(1, 2), borders(), true).left).toBe(1);
      expect(calculate(margins(1, 2), borders(), true).right).toBe(2);
      expect(calculate(margins(0.25), borders(), true).left).toBe(0.25);
      expect(calculate(margins(), borders(edge(6, 'thick')), true).left).toBe(5.4);
    });
    test(`${name}: uncovered thick, zero, asymmetric and compound margins keep the old path`, () => {
      for (const [pad, rules] of [
        [margins(), borders(edge(12))],
        [margins(0), borders()],
        [margins(0.1, 5.4), borders()],
        [margins(5.4, 0.1), borders()],
        [margins(), borders(edge(0.5, 'double'))],
      ] as const) {
        expect(calculate(pad, rules, true)).toEqual(calculate(pad, rules));
      }
    });
    test(`${name}: omitted and explicitly absent rules do not invent an inset`, () => {
      expect(calculate(margins(0), borders({ state: 'omitted' }, { state: 'none' }), true)).toEqual(
        { top: 1.5, bottom: 2.5, left: 0, right: 0 }
      );
    });
  }
});

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const measurer = createFixedMeasurer(4.9, 15.6);

function specimen(explicitCellMargins = false) {
  const cellMargins = '<w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/>';
  const cell = (width: number, text: string) =>
    `<w:tc><w:tcPr><w:tcW w:type="pct" w:w="${width}"/>` +
    (explicitCellMargins ? `<w:tcMar>${cellMargins}</w:tcMar>` : '') +
    '<w:tcBorders><w:left w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/></w:tcBorders>' +
    '</w:tcPr><w:p><w:r><w:rPr><w:sz w:val="22"/></w:rPr>' +
    `<w:t>${text}</w:t></w:r></w:p></w:tc>`;
  const xml =
    `<w:document xmlns:w="${W}"><w:body><w:tbl><w:tblPr>` +
    '<w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="autofit"/><w:tblInd w:w="0" w:type="dxa"/>' +
    `<w:tblCellMar>${cellMargins}<w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/></w:tblCellMar>` +
    '</w:tblPr><w:tblGrid><w:gridCol w:w="910"/><w:gridCol w:w="3306"/></w:tblGrid>' +
    `<w:tr>${cell(1000, '1234567')}${cell(3500, 'x')}</w:tr></w:tbl>` +
    '<w:sectPr><w:pgSz w:w="6880" w:h="15840"/><w:pgMar w:left="1440" w:right="1440" w:top="1440" w:bottom="1440"/>' +
    '</w:sectPr></w:body></w:document>';
  const result = readOoxmlPart(xml, { name: '/word/document.xml', contentType: 'application/xml' });
  if (!result.ok) throw new Error(result.reason);
  const table = result.part.root.children
    .flatMap((node) => (node.kind === 'textValue' ? [] : node.children))
    .find((node) => node.kind === 'table');
  if (!table || table.kind !== 'table') throw new Error('missing synthetic table');
  const structure = readTableStructure(table, 200, 0, undefined, undefined, undefined, 11);
  if (!structure) throw new Error('missing synthetic structure');
  return { part: result.part, structure, tableId: table.id };
}

function renderStructure(structure: SemanticTableStructure, tableId: string) {
  return layoutTableFragment(structure, tableOriginX(structure, 200), 0, 0, tableId, 0, {
    measurer,
    producer: 'legacy-horizontal-insets-test',
    nextLineId: (paragraphId, start, lineIndex) => `${paragraphId}-${start}-${lineIndex}`,
  }).fragment;
}
function firstParagraph(fragment: TableFragmentRecord): ParagraphFragmentRecord {
  const paragraph = fragment.rows[0]!.cells[0]!.blocks[0];
  if (!paragraph || paragraph.kind !== 'paragraph') throw new Error('missing synthetic paragraph');
  return paragraph;
}

test('an admitted 45.5 pt grid cell keeps seven digits on one line, including explicit tcMar', () => {
  for (const explicitMargins of [false, true]) {
    const { part, structure, tableId } = specimen(explicitMargins);
    const canonical = serializeOoxmlPart(part);
    expect(structure.legacyContentAlignment).toBe(true);
    expect(structure.rows[0]!.cells[0]!.legacyContentAlignment).toBe(true);
    const correct = renderStructure(structure, tableId);
    const oldInsets = renderStructure(
      {
        ...structure,
        rows: structure.rows.map((row) => ({
          ...row,
          cells: row.cells.map(({ legacyContentAlignment: _flag, ...cell }) => cell),
        })),
      },
      tableId
    );
    expect(correct.rows[0]!.cells[0]!.box.width).toBeCloseTo(45.5, 6);
    expect(firstParagraph(correct).lines[0]!.box.width).toBeCloseTo(34.7, 6);
    expect(firstParagraph(oldInsets).lines[0]!.box.width).toBeCloseTo(33.7, 6);
    expect(firstParagraph(correct).lines).toHaveLength(1);
    expect(firstParagraph(oldInsets).lines).toHaveLength(2);
    expect(correct.rows[0]!.box.height * 2).toBeCloseTo(oldInsets.rows[0]!.box.height, 6);
    expect(
      firstParagraph(correct)
        .lines[0]!.spans.map((span) => span.text)
        .join('')
    ).toBe('1234567');
    expect(serializeOoxmlPart(part)).toBe(canonical);
  }
});

test('cell spacing disables the exception even when a caller retains the legacy marker', () => {
  const { structure, tableId } = specimen();
  const spaced = renderStructure({ ...structure, cellSpacingPt: 2 }, tableId);
  expect(spaced.rows[0]!.cells[0]!.box.width).toBeCloseTo(43.5, 6);
  expect(firstParagraph(spaced).lines[0]!.box.width).toBeCloseTo(31.7, 6);
  expect(firstParagraph(spaced).lines).toHaveLength(2);
});

test('full document flow applies the admitted mode, without changing canonical OOXML', () => {
  const { part } = specimen();
  const canonical = serializeOoxmlPart(part);
  const firstTable = (compatibilityMode: number) => {
    const layout = layoutSemanticDocument(part, 0, { measurer, compatibilityMode });
    const table = layout.pages
      .flatMap((page) => page.fragments)
      .find((fragment): fragment is TableFragmentRecord => fragment.kind === 'table');
    if (!table) throw new Error('missing full-document table');
    return table;
  };
  expect(firstParagraph(firstTable(11)).lines).toHaveLength(1);
  expect(firstParagraph(firstTable(15)).lines).toHaveLength(2);
  expect(serializeOoxmlPart(part)).toBe(canonical);
});
