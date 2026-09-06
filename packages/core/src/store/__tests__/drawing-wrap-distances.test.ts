import { expect, test } from 'bun:test';
import { readOoxmlPart, serializeOoxmlPart } from '../package/ooxml-tree.ts';
import { indexInlineDrawingProjectionsInPart } from '../package/drawing-projection.ts';

function project(
  wrap: string,
  anchorDistances = 'distT="12700" distB="25400" distL="114300" distR="228600"'
) {
  const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
    xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><w:body><w:p><w:r><w:drawing>
    <wp:anchor ${anchorDistances} simplePos="0" relativeHeight="0" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">
    <wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH>
    <wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>
    <wp:extent cx="1270000" cy="1270000"/>${wrap}<wp:docPr id="1" name="fixture"/>
    <wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="urn:fixture"/></a:graphic>
    </wp:anchor></w:drawing></w:r></w:p></w:body></w:document>`;
  const parsed = readOoxmlPart(xml, { name: '/word/document.xml', contentType: 'app/xml' });
  if (!parsed.ok) throw new Error(parsed.reason);
  const before = serializeOoxmlPart(parsed.part);
  const projections = indexInlineDrawingProjectionsInPart(parsed.part);
  expect(projections.size).toBeGreaterThan(0);
  expect(serializeOoxmlPart(parsed.part)).toBe(before);
  return projections.values().next().value!.wrapGeometry!.distancesEmu;
}

const tight =
  '<wp:wrapTight wrapText="bothSides"><wp:wrapPolygon edited="0"><wp:start x="0" y="0"/><wp:lineTo x="21600" y="0"/><wp:lineTo x="21600" y="21600"/><wp:lineTo x="0" y="21600"/></wp:wrapPolygon></wp:wrapTight>';
const inherited = { top: 12700, right: 228600, bottom: 25400, left: 114300 };

test('tight and square wraps inherit all anchor text distances', () => {
  expect(project(tight)).toEqual(inherited);
  expect(project('<wp:wrapSquare wrapText="bothSides"/>')).toEqual(inherited);
});

test('an explicit wrap-side zero overrides only that anchor distance', () => {
  expect(
    project(tight.replace('wrapText="bothSides"', 'wrapText="bothSides" distL="0" distR="6350"'))
  ).toEqual({ ...inherited, left: 0, right: 6350 });
  expect(project('<wp:wrapTopAndBottom distT="0"/>')).toEqual({ ...inherited, top: 0 });
});

test('missing wrap and anchor distances retain zero defaults', () => {
  expect(project('<wp:wrapSquare wrapText="bothSides"/>', '')).toEqual({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });
});
