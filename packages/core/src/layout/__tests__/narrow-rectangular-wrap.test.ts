import { expect, test } from 'bun:test';
import { readOoxmlPart, serializeOoxmlPart } from '../../store/package/ooxml-tree.ts';
import { indexInlineDrawingProjectionsInPart } from '../../store/package/drawing-projection.ts';
import { layoutSemanticDocument } from '../semantic-layout.ts';
import { paragraphFragmentsOf } from '../semantic-records.ts';
import type { InlineDrawingLayoutContext } from '../drawing-layout.ts';

function layoutCaption(text: string) {
  const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
    xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
    xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><w:body>
    <w:p><w:r><w:drawing><wp:anchor simplePos="0" relativeHeight="1" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">
    <wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>25400</wp:posOffset></wp:positionH>
    <wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>
    <wp:extent cx="1244600" cy="1270000"/><wp:wrapSquare wrapText="bothSides"/><wp:docPr id="1" name="rectangle"/>
    <wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">
    <wps:wsp><wps:cNvSpPr/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1244600" cy="1270000"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="123456"/></a:solidFill>
    </wps:spPr><wps:bodyPr/></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>
    <w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`;
  const parsed = readOoxmlPart(xml, { name: '/word/document.xml', contentType: 'app/xml' });
  if (!parsed.ok) throw new Error(parsed.reason);
  const before = serializeOoxmlPart(parsed.part);
  const projections = indexInlineDrawingProjectionsInPart(parsed.part);
  const drawings: InlineDrawingLayoutContext = {
    ownerPartName: '/word/document.xml',
    project: (node) => projections.get(node.id) ?? null,
    projectionForAtom: (id) => projections.get(id) ?? null,
    resourceOf: () => ({
      kind: 'ready',
      partName: '/word/media/fixture.png',
      contentId: 'fixture',
      resourceKey: 'fixture',
      mime: 'image/png',
      pixelWidth: 100,
      pixelHeight: 100,
      dpiX: 96,
      dpiY: 96,
    }),
  };
  const result = layoutSemanticDocument(parsed.part, 0, {
    geometry: { width: 120, height: 220, margin: { left: 10, right: 10, top: 10, bottom: 10 } },
    measurer: {
      measure: (text) => Array.from(text).length * 10,
      lineMetrics: () => ({ height: 12, baseline: 10 }),
    },
    inlineDrawingLayout: drawings,
  });
  expect(serializeOoxmlPart(parsed.part)).toBe(before);
  return result;
}

test('a full caption line clears a float with a side gap narrower than one glyph', () => {
  const result = layoutCaption('Caption');
  const lines = paragraphFragmentsOf(result.pages[0]!)
    .flatMap((fragment) => fragment.lines)
    .filter((line) => line.spans.length);
  expect(lines).toHaveLength(1);
  expect(lines[0]!.spans.map((span) => span.text).join('')).toBe('Caption');
  expect(lines[0]!.box.y).toBeGreaterThanOrEqual(100);
});

test('following lines and pages do not repeat the float clearance or lose text', () => {
  const text = 'Caption'.repeat(30);
  const result = layoutCaption(text);
  expect(result.pages).toHaveLength(2);
  const lines = result.pages
    .flatMap((page) => paragraphFragmentsOf(page))
    .flatMap((fragment) => fragment.lines)
    .filter((line) => line.spans.length);
  expect(lines.flatMap((line) => line.spans.map((span) => span.text)).join('')).toBe(text);
  expect(lines[0]!.box.y).toBeGreaterThanOrEqual(100);
  expect(lines[1]!.box.y - lines[0]!.box.y).toBe(12);
  expect(paragraphFragmentsOf(result.pages[1]!)[0]!.lines[0]!.box.y).toBe(0);
});
