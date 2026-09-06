import { describe, expect, test } from 'bun:test';
import { readOoxmlPart, serializeOoxmlPart } from '../../store/package/ooxml-tree.ts';
import { createParagraphLayoutCache } from '../layout-cache.ts';
import type { PendingLine } from '../paragraph-flow.ts';
import {
  createFixedMeasurer,
  createLayoutSession,
  layoutSemanticDocument,
} from '../semantic-layout.ts';
import type { TableCellFragmentRecord, TableFragmentRecord } from '../semantic-records.ts';
import { readTableStructure } from '../semantic-table.ts';
import { measureRowHeight, type TableFlowDeps } from '../semantic-table-layout.ts';
import { prepareRepeatedHeaderBorderPlan } from '../repeated-header-border-metrics.ts';
import { applyTreeOp } from '../../store/store/tree-ops.ts';

type Edge = number | 'nil' | 'omit';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const edge = (side: string, value: Edge): string =>
  value === 'omit'
    ? ''
    : `<w:${side} w:val="${value === 'nil' ? 'nil' : 'single'}"${typeof value === 'number' ? ` w:sz="${value * 8}"` : ''}/>`;
const paragraph = (text: string): string =>
  `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="exact"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
function cell(
  text: string,
  top: Edge = 0.5,
  bottom: Edge = 0.5,
  extra = '',
  content = paragraph(text)
): string {
  return `<w:tc><w:tcPr><w:tcW w:w="1600" w:type="dxa"/><w:tcBorders>${edge('top', top)}${edge('bottom', bottom)}</w:tcBorders>${extra}</w:tcPr>${content}</w:tc>`;
}
function row(cells: string, properties = '<w:cantSplit/>'): string {
  return `<w:tr><w:trPr>${properties}</w:trPr>${cells}</w:tr>`;
}
function fixture(
  options: {
    header?: string;
    body?: string;
    headerBottom?: Edge;
    bodyTop?: Edge;
    spacing?: number;
    columns?: number;
    tableProperties?: string;
    bodyProperties?: string;
  } = {}
) {
  const columns = options.columns ?? 1;
  const header = options.header ?? row(cell('H', 0.5, options.headerBottom ?? 2), '<w:tblHeader/>');
  const body =
    options.body ??
    Array.from({ length: 18 }, (_, index) =>
      row(cell(`B${index}`, options.bodyTop ?? 0.5), options.bodyProperties)
    ).join('');
  const xml = `<w:document xmlns:w="${W}"><w:body><w:tbl><w:tblPr>
    <w:tblLayout w:type="fixed"/><w:tblW w:w="${1600 * columns}" w:type="dxa"/>
    <w:tblCellSpacing w:w="${20 * (options.spacing ?? 0)}" w:type="dxa"/>
    <w:tblCellMar>${['top', 'bottom', 'left', 'right'].map((side) => `<w:${side} w:w="0" w:type="dxa"/>`).join('')}</w:tblCellMar>
    ${options.tableProperties ?? ''}</w:tblPr><w:tblGrid>${Array.from({ length: columns }, () => '<w:gridCol w:w="1600"/>').join('')}</w:tblGrid>
    ${header}${body}</w:tbl></w:body></w:document>`;
  const parsed = readOoxmlPart(xml, { name: '/word/document.xml', contentType: 'app/xml' });
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.part;
}
const geometry = { width: 200, height: 100, margin: { top: 10, right: 10, bottom: 10, left: 10 } };
const measurer = createFixedMeasurer(5, 12);
function layout(part: ReturnType<typeof fixture>, height = 100) {
  return layoutSemanticDocument(part, 0, { geometry: { ...geometry, height }, measurer });
}
function fragments(result: ReturnType<typeof layout>): TableFragmentRecord[] {
  return result.pages.flatMap((page) =>
    page.fragments.filter((item): item is TableFragmentRecord => item.kind === 'table')
  );
}
function repeated(result: ReturnType<typeof layout>): TableFragmentRecord[] {
  return fragments(result).filter((fragment) => fragment.rows[0]?.isHeaderRepeat);
}
function band(cell: TableCellFragmentRecord) {
  const paragraphs = cell.blocks.filter((block) => block.kind === 'paragraph');
  const top = Math.min(...paragraphs.map((block) => block.box.y));
  const bottom = Math.max(...paragraphs.map((block) => block.box.y + block.box.height));
  return { top: top - cell.box.y, bottom: cell.box.y + cell.box.height - bottom };
}
function structureOf(part: ReturnType<typeof fixture>) {
  const body = part.root.children.find(
    (node) => node.kind !== 'textValue' && node.localName === 'body'
  );
  if (!body || body.kind === 'textValue') throw new Error('missing body');
  const table = body.children.find((node) => node.kind === 'table');
  if (!table) throw new Error('missing table');
  const structure = readTableStructure(table, 180, 0);
  if (!structure) throw new Error('missing structure');
  return { table, structure };
}
function candidate(
  part: ReturnType<typeof fixture>,
  deps: TableFlowDeps = {
    measurer,
    producer: 'test',
    nextLineId: () => 'live',
  },
  bottom = 80
) {
  const { structure } = structureOf(part);
  const headers = structure.rows.filter((item) => item.isHeader);
  const body = structure.rows[headers.length]!;
  const headerHeight = headers.reduce(
    (sum, item) => sum + measureRowHeight(item, structure.columnWidthsPt, 0, 0, deps),
    0
  );
  const bodyHeight = measureRowHeight(body, structure.columnWidthsPt, 0, 0, deps);
  return prepareRepeatedHeaderBorderPlan(
    structure,
    headers,
    body,
    0,
    0,
    bottom,
    headerHeight,
    bodyHeight,
    deps
  );
}

describe('repeated-header shared horizontal border measurement', () => {
  test('both cells use the winning header edge before row sizing', () => {
    const part = fixture();
    const before = serializeOoxmlPart(part);
    const result = layout(part);
    expect(repeated(result).length).toBeGreaterThan(0);
    for (const fragment of repeated(result)) {
      const header = fragment.rows[0]!;
      const body = fragment.rows[1]!;
      expect(band(header.cells[0]!).bottom).toBeCloseTo(2, 6);
      expect(band(body.cells[0]!).top).toBeCloseTo(2, 6);
      expect(body.box.height).toBeCloseTo(14.5, 6);
    }
    expect(
      fragments(result).flatMap((fragment) =>
        fragment.rows.filter((item) => !item.isHeaderRepeat && !item.isHeaderRow)
      )
    ).toHaveLength(18);
    expect(serializeOoxmlPart(part)).toBe(before);
  });

  test('a winning body edge also grows the preceding repeated header', () => {
    const result = layout(fixture({ headerBottom: 0.5, bodyTop: 2 }));
    for (const fragment of repeated(result)) {
      expect(band(fragment.rows[0]!.cells[0]!).bottom).toBeCloseTo(2, 6);
      expect(fragment.rows[0]!.box.height).toBeCloseTo(14.5, 6);
      expect(band(fragment.rows[1]!.cells[0]!).top).toBeCloseTo(2, 6);
    }
  });

  for (const rule of ['auto', 'atLeast', 'exact']) {
    for (const align of ['top', 'center', 'bottom']) {
      test(`${rule} rows preserve resolved insets through final ${align} alignment`, () => {
        const height = rule === 'auto' ? '' : `<w:trHeight w:val="500" w:hRule="${rule}"/>`;
        const body = Array.from({ length: 12 }, (_, index) =>
          row(
            cell(`B${index}`, 0.5, 0.5, `<w:vAlign w:val="${align}"/>`),
            `<w:cantSplit/>${height}`
          )
        ).join('');
        for (const fragment of repeated(layout(fixture({ body })))) {
          const target = fragment.rows[1]!.cells[0]!;
          const spare = rule === 'auto' ? 0 : 25 - 12 - 2 - 0.5;
          const offset = align === 'center' ? spare / 2 : align === 'bottom' ? spare : 0;
          expect(target.box.height).toBeCloseTo(rule === 'auto' ? 14.5 : 25, 6);
          expect(band(target).top).toBeCloseTo(2 + offset, 6);
          expect(band(target).bottom).toBeCloseTo(0.5 + spare - offset, 6);
        }
      });
    }
  }

  test('positive cell spacing keeps independent authored insets', () => {
    for (const fragment of repeated(layout(fixture({ spacing: 2 })))) {
      expect(band(fragment.rows[0]!.cells[0]!).bottom).toBeCloseTo(2, 6);
      expect(band(fragment.rows[1]!.cells[0]!).top).toBeCloseTo(0.5, 6);
    }
  });

  test('one spanning body cell uses the maximum of its own shared intervals', () => {
    const header = row(cell('H0', 0.5, 2) + cell('H1', 0.5, 0.5), '<w:tblHeader/>');
    const body = Array.from({ length: 18 }, (_, index) =>
      row(cell(`B${index}`, 0.5, 0.5, '<w:gridSpan w:val="2"/>'))
    ).join('');
    for (const fragment of repeated(layout(fixture({ header, body, columns: 2 })))) {
      expect(band(fragment.rows[1]!.cells[0]!).top).toBeCloseTo(2, 6);
    }
  });

  test('the shared winner follows table fallback and explicit nil provenance', () => {
    for (const [headerBottom, bodyTop, expected] of [
      ['omit', 'omit', 2],
      ['nil', 'omit', 0],
      ['nil', 1, 1],
    ] as const) {
      const result = layout(
        fixture({
          headerBottom,
          bodyTop,
          tableProperties: '<w:tblBorders><w:insideH w:val="single" w:sz="16"/></w:tblBorders>',
        })
      );
      for (const fragment of repeated(result)) {
        expect(band(fragment.rows[0]!.cells[0]!).bottom).toBeCloseTo(expected, 6);
        expect(band(fragment.rows[1]!.cells[0]!).top).toBeCloseTo(expected, 6);
      }
    }
  });

  test('successive repeated occurrences and warm caches follow their pending row', () => {
    const cache = createParagraphLayoutCache<readonly PendingLine[]>();
    const session = createLayoutSession();
    for (const [version, top] of [0.5, 3, 0.5].entries()) {
      const part = fixture({
        headerBottom: 1,
        body: Array.from({ length: 18 }, (_, index) =>
          row(cell(`B${index}`, index % 2 === 0 ? top : 2))
        ).join(''),
      });
      const warm = layoutSemanticDocument(part, version, { geometry, measurer, cache, session });
      const cold = layoutSemanticDocument(part, version, { geometry, measurer });
      expect(JSON.parse(JSON.stringify(warm))).toEqual(JSON.parse(JSON.stringify(cold)));
      for (const fragment of repeated(warm)) {
        const target = fragment.rows[1]!.cells[0]!;
        const text = target.blocks
          .flatMap((block) => (block.kind === 'paragraph' ? block.lines : []))
          .flatMap((line) => line.spans)
          .map((span) => span.text)
          .join('');
        const expected = Math.max(1, Number(text.slice(1)) % 2 === 0 ? top : 2);
        expect(band(target).top).toBeCloseTo(expected, 6);
        expect(band(fragment.rows[0]!.cells[0]!).bottom).toBeCloseTo(expected, 6);
      }
    }
  });

  for (const [headerBottom, bodyTop] of [
    [2, 0.5],
    [0.5, 2],
  ]) {
    test(`joint preflight omits a repeat when ${headerBottom}/${bodyTop} leaves no complete body room`, () => {
      const result = layout(fixture({ headerBottom, bodyTop }), 48);
      expect(fragments(result).length).toBeGreaterThan(1);
      expect(repeated(result)).toHaveLength(0);
      for (const fragment of fragments(result).slice(1)) {
        expect(band(fragment.rows[0]!.cells[0]!).top).toBeCloseTo(bodyTop!, 6);
      }
      expect(fragments(result).flatMap((fragment) => fragment.rows)).toHaveLength(19);
    });
  }

  test('multiple headers keep the final boundary separate from earlier header rows', () => {
    const header =
      row(cell('H0', 0.5, 0.5), '<w:tblHeader/>') + row(cell('H1', 0.5, 2), '<w:tblHeader/>');
    for (const fragment of repeated(layout(fixture({ header })))) {
      expect(fragment.rows[1]!.isHeaderRepeat).toBe(true);
      expect(fragment.rows[0]!.box.height).toBeCloseTo(13, 6);
      expect(band(fragment.rows[1]!.cells[0]!).bottom).toBeCloseTo(2, 6);
      expect(band(fragment.rows[2]!.cells[0]!).top).toBeCloseTo(2, 6);
    }
  });

  test('an unrelated thick column does not enlarge its thin neighbours', () => {
    const header = row(
      cell('H0', 0.5, 1) + cell('H1', 0.5, 1) + cell('H2', 0.5, 6),
      '<w:tblHeader/>'
    );
    const body = Array.from({ length: 18 }, (_, index) =>
      row(cell(`B${index}`, 0.5, 0.5, '<w:gridSpan w:val="2"/>') + cell('side', 0.5))
    ).join('');
    for (const fragment of repeated(layout(fixture({ header, body, columns: 3 })))) {
      expect(band(fragment.rows[1]!.cells[0]!).top).toBeCloseTo(1, 6);
      expect(band(fragment.rows[1]!.cells[1]!).top).toBeCloseTo(6, 6);
    }
  });

  for (const align of ['center', 'bottom']) {
    test(`the repeated header keeps its ${align} alignment after a body edge wins`, () => {
      const header = row(
        cell('H', 0.5, 0.5, `<w:vAlign w:val="${align}"/>`),
        '<w:tblHeader/><w:trHeight w:val="500" w:hRule="exact"/>'
      );
      for (const fragment of repeated(layout(fixture({ header, bodyTop: 2 })))) {
        const target = fragment.rows[0]!.cells[0]!;
        expect(target.box.height).toBe(25);
        expect(band(target).bottom).toBeCloseTo(
          align === 'center' ? 2 + (25 - 12 - 2 - 0.5) / 2 : 2,
          6
        );
      }
    });
  }

  test('actual cell-border edits retain body nodes and produce cold-equivalent warm geometry', () => {
    const original = fixture();
    const { table, structure } = structureOf(original);
    const headerId = structure.rows[0]!.cells[0]!.id;
    const bodyBlock = structure.rows[1]!.cells[0]!.blocks[0];
    const cache = createParagraphLayoutCache<readonly PendingLine[]>();
    const session = createLayoutSession();
    layoutSemanticDocument(original, 0, { geometry, measurer, cache, session });
    const edited = applyTreeOp(original, {
      op: 'setTableCellBorders',
      tableId: table.id,
      cellIds: [headerId],
      scope: 'bottom',
      spec: { style: 'single', size: 32, color: { kind: 'hex', value: '000000' } },
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) throw new Error(edited.reason);
    expect(structureOf(edited.part).structure.rows[1]!.cells[0]!.blocks[0]).toBe(bodyBlock);
    for (const [index, part] of [edited.part, original, edited.part].entries()) {
      const version = index + 1;
      const warm = layoutSemanticDocument(part, version, { geometry, measurer, cache, session });
      const cold = layoutSemanticDocument(part, version, { geometry, measurer });
      expect(JSON.parse(JSON.stringify(warm))).toEqual(JSON.parse(JSON.stringify(cold)));
      for (const fragment of repeated(warm))
        expect(band(fragment.rows[1]!.cells[0]!).top).toBeCloseTo(part === original ? 2 : 4, 6);
    }
  });

  test('a preserved PAGE field has identical probe and committed metrics', () => {
    const field =
      '<w:p><w:pPr><w:spacing w:line="240" w:lineRule="exact"/></w:pPr><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p>';
    const part = fixture({ header: row(cell('H', 0.5, 2, '', field), '<w:tblHeader/>') });
    const before = serializeOoxmlPart(part);
    for (const fragment of repeated(layout(part)))
      expect(band(fragment.rows[1]!.cells[0]!).top).toBeCloseTo(2, 6);
    expect(serializeOoxmlPart(part)).toBe(before);
    const reparsed = readOoxmlPart(before, { name: part.name, contentType: part.contentType });
    expect(reparsed.ok).toBe(true);
    if (reparsed.ok) expect(serializeOoxmlPart(reparsed.part)).toBe(before);
  });

  test('a rejected candidate cannot publish or spend live counters', () => {
    let spent = 0;
    const cache = createParagraphLayoutCache<readonly PendingLine[]>();
    const cacheBefore = { ...cache.stats };
    const budget = { intervalsRemaining: 100 };
    const merges = { cellsRemaining: 100 };
    const deps: TableFlowDeps = {
      measurer,
      cache,
      producer: 'test',
      nextLineId: () => {
        spent++;
        return 'live';
      },
      collectAnchoredDrawings: () => {
        spent++;
      },
      onCellBreakKey: () => {
        spent++;
      },
      borderOwnershipBudget: budget,
      vMergeResolveBudget: merges,
    };
    const { structure } = structureOf(fixture());
    expect(
      prepareRepeatedHeaderBorderPlan(
        structure,
        [structure.rows[0]!],
        structure.rows[1]!,
        0,
        0,
        28,
        14.5,
        13,
        deps
      )
    ).toBeNull();
    expect(spent).toBe(0);
    expect(budget.intervalsRemaining).toBe(100);
    expect(merges.cellsRemaining).toBe(100);
    expect(cache.stats).toEqual(cacheBefore);
  });

  test('unchanged and unsupported candidates retain the existing path', () => {
    const plain = fixture();
    expect(candidate(fixture({ headerBottom: 0.5 }))).toBeUndefined();
    expect(candidate(fixture({ spacing: 2 }))).toBeUndefined();
    expect(candidate(fixture({ header: '' }))).toBeUndefined();
    expect(
      candidate(fixture({ tableProperties: '<w:tblpPr w:vertAnchor="text"/>' }))
    ).toBeUndefined();
    expect(
      candidate(
        fixture({ body: row(cell('vertical', 0.5, 0.5, '<w:textDirection w:val="btLr"/>')) })
      )
    ).toBeUndefined();
    expect(
      candidate(
        fixture({
          body:
            row(cell('merge', 0.5, 0.5, '<w:vMerge w:val="restart"/>')) +
            row(cell('ghost', 0.5, 0.5, '<w:vMerge/>')),
        })
      )
    ).toBeUndefined();
    expect(
      candidate(
        fixture({ body: row(cell('nested', 0.5, 0.5, '', `<w:tbl>${row(cell('N'))}</w:tbl>`)) })
      )
    ).toBeUndefined();
    expect(
      candidate(fixture({ body: row(cell('unknown', 0.5, 0.5, '', '<w:p><w:unknown/></w:p>')) }))
    ).toBeUndefined();
    expect(
      candidate(
        fixture({
          body: row(
            cell(
              'long',
              0.5,
              0.5,
              '',
              Array.from({ length: 20 }, (_, index) => paragraph(`L${index}`)).join('')
            ),
            ''
          ),
        })
      )
    ).toBeUndefined();
    expect(
      candidate(plain, {
        measurer,
        producer: 'test',
        nextLineId: () => 'x',
        borderOwnershipBudget: { intervalsRemaining: 0 },
      })
    ).toBeUndefined();
    expect(candidate(plain, undefined, Number.NaN)).toBeUndefined();
  });

  test('short splittable auto rows use the complete-row candidate', () => {
    const result = layout(fixture({ bodyProperties: '' }));
    expect(repeated(result).length).toBeGreaterThan(0);
    for (const fragment of repeated(result)) {
      expect(band(fragment.rows[1]!.cells[0]!).top).toBeCloseTo(2, 6);
      expect(fragment.rows[1]!.isContinuation).toBeUndefined();
    }
  });

  test('a spanning header resolves each body neighbour independently', () => {
    const header = row(cell('H', 0.5, 1, '<w:gridSpan w:val="2"/>'), '<w:tblHeader/>');
    const body = Array.from({ length: 18 }, (_, index) =>
      row(cell(`B${index}`, 0.5) + cell('side', 3))
    ).join('');
    const result = layout(fixture({ header, body, columns: 2 }));
    expect(repeated(result).length).toBeGreaterThan(0);
    for (const fragment of repeated(result)) {
      expect(band(fragment.rows[0]!.cells[0]!).bottom).toBeCloseTo(3, 6);
      expect(band(fragment.rows[1]!.cells[0]!).top).toBeCloseTo(1, 6);
      expect(band(fragment.rows[1]!.cells[1]!).top).toBeCloseTo(3, 6);
    }
  });

  test('omitting one repeat does not leak its insets or disable later repeats', () => {
    const body =
      row(cell('first')) +
      row(cell('large'), '<w:trHeight w:val="1360" w:hRule="exact"/>') +
      Array.from({ length: 10 }, (_, index) => row(cell(`B${index}`))).join('');
    const result = layout(fixture({ body }));
    const tables = fragments(result);
    expect(tables[1]!.rows[0]!.isHeaderRepeat).toBe(false);
    expect(band(tables[1]!.rows[0]!.cells[0]!).top).toBeCloseTo(0.5, 6);
    expect(tables[2]!.rows[0]!.isHeaderRepeat).toBe(true);
    expect(band(tables[2]!.rows[1]!.cells[0]!).top).toBeCloseTo(2, 6);
  });

  test('bounded candidate inspection rejects large, deep, sparse and foreign markup', () => {
    const run = '<w:r><w:t>X</w:t></w:r>';
    const oversized = `<w:p>${run.repeat(2800)}</w:p>`;
    expect(
      candidate(fixture({ body: row(cell('many', 0.5, 0.5, '', oversized)) }))
    ).toBeUndefined();
    const deep = `<w:p><w:pPr>${'<w:rPr>'.repeat(34)}${'</w:rPr>'.repeat(34)}</w:pPr>${run}</w:p>`;
    expect(candidate(fixture({ body: row(cell('deep', 0.5, 0.5, '', deep)) }))).toBeUndefined();
    expect(
      candidate(
        fixture({
          header: row(cell('H0') + cell('H1'), '<w:tblHeader/>'),
          body: row(cell('gap'), '<w:gridBefore w:val="1"/>'),
          columns: 2,
        })
      )
    ).toBeUndefined();
    const foreign = '<w:p><x:t xmlns:x="urn:unsupported">X</x:t></w:p>';
    expect(
      candidate(fixture({ body: row(cell('foreign', 0.5, 0.5, '', foreign)) }))
    ).toBeUndefined();
    const explicitBreak = '<w:p><w:r><w:br w:type="page"/><w:t>X</w:t></w:r></w:p>';
    expect(
      candidate(fixture({ body: row(cell('break', 0.5, 0.5, '', explicitBreak)) }))
    ).toBeUndefined();
  });

  test('first authored headers and tables without headers keep their existing insets', () => {
    const original = fragments(layout(fixture()))[0]!;
    expect(original.rows[0]!.isHeaderRepeat).toBe(false);
    expect(band(original.rows[1]!.cells[0]!).top).toBeCloseTo(0.5, 6);
    for (const fragment of fragments(layout(fixture({ header: '' })))) {
      expect(band(fragment.rows[0]!.cells[0]!).top).toBeCloseTo(0.5, 6);
    }
  });

  test('split body fragments keep their authored text and existing boundary path', () => {
    const body = row(
      cell(
        'long',
        0.5,
        0.5,
        '',
        Array.from({ length: 20 }, (_, index) => paragraph(`L${index}`)).join('')
      ),
      ''
    );
    const result = layout(fixture({ body }));
    expect(repeated(result).length).toBeGreaterThan(0);
    for (const fragment of repeated(result))
      expect(band(fragment.rows[1]!.cells[0]!).top).toBeCloseTo(0.5, 6);
    const text = fragments(result)
      .flatMap((fragment) => fragment.rows.filter((item) => !item.isHeaderRow))
      .flatMap((item) => item.cells)
      .flatMap((item) => item.blocks)
      .flatMap((block) => (block.kind === 'paragraph' ? block.lines : []))
      .flatMap((line) => line.spans)
      .map((span) => span.text);
    expect(text).toEqual(Array.from({ length: 20 }, (_, index) => `L${index}`));
  });
});
