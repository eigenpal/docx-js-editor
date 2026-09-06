import { expect, test } from 'bun:test';
import { strToU8, zipSync } from 'fflate';
import { readOoxmlPackage } from '../../store/package/ooxml-package.ts';
import {
  readOoxmlPart,
  serializeOoxmlPart,
  type OoxmlPart,
  type OoxmlParagraphNode,
} from '../../store/package/ooxml-tree.ts';
import {
  createInlineDrawingLayoutBundle,
  drawingAtomIdentities,
} from '../inline-drawing-source.ts';
import {
  anchoredDrawingAtomsInParagraph,
  drawingModelOffsetsInParagraph,
  lineLayoutAtoms,
} from '../drawing-layout.ts';
import { paragraphTextOf } from '../../store/store/tree-ops.ts';
import { createFixedMeasurer, layoutSemanticDocument } from '../semantic-layout.ts';
import { linesOf } from '../semantic-records.ts';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const V = 'urn:schemas-microsoft-com:vml';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const metadata = {
  name: '/word/document.xml',
  contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
};

function xml(text = 'Old', width = 120, floating = false): string {
  return `<w:document xmlns:w="${W}" xmlns:v="${V}"><w:body><w:p><w:r><w:t>A</w:t><w:pict><v:shape type="#_x0000_t136" style="width:${width}pt;height:30pt;${floating ? 'position:absolute;left:20pt;top:10pt;' : ''}" stroked="f"><v:textpath on="t" style="font-family:serif;font-size:24pt" string="${text}"/></v:shape></w:pict><w:t>Z</w:t></w:r></w:p></w:body></w:document>`;
}

function partOf(source: string): OoxmlPart {
  const loaded = readOoxmlPart(source, metadata);
  if (!loaded.ok) throw new Error(loaded.reason);
  return loaded.part;
}

function paragraphOf(part: OoxmlPart): OoxmlParagraphNode {
  const body = part.root.children.find((n) => n.kind !== 'textValue' && n.localName === 'body');
  if (!body || body.kind === 'textValue') throw new Error('missing body');
  const paragraph = body.children.find((n) => n.kind === 'paragraph');
  if (!paragraph || paragraph.kind !== 'paragraph') throw new Error('missing paragraph');
  return paragraph;
}

function setup(source = xml()) {
  const loaded = readOoxmlPackage(
    zipSync(
      {
        '[Content_Types].xml': strToU8(
          `<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="${metadata.contentType}"/></Types>`
        ),
        '_rels/.rels': strToU8(
          `<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`
        ),
        'word/document.xml': strToU8(source),
      },
      { level: 0 }
    )
  );
  if (!loaded.ok) throw new Error(loaded.reason);
  let pkg = loaded.package;
  let revision = 0;
  const reader = {
    currentPackage: () => pkg,
    packageRevision: () => revision,
    part: () => pkg.parts.get(pkg.mainDocumentPart)!,
  };
  const bundle = createInlineDrawingLayoutBundle({
    session: reader,
    decodePort: {
      async decode() {
        throw new Error('WordArt has no raster media to decode');
      },
    },
    onResourcesChanged: () => {},
  });
  return {
    reader,
    bundle,
    replace(source: string) {
      // Model-only change: preserve resource substrate identity, as a tree edit does.
      pkg = Object.freeze({
        ...pkg,
        parts: new Map(pkg.parts).set(pkg.mainDocumentPart, partOf(source)),
      });
      revision++;
      bundle.sync(reader);
    },
  };
}

test('lays out straight WordArt as one inline drawing between adjacent text offsets', () => {
  const { reader, bundle } = setup();
  try {
    expect(drawingAtomIdentities(reader.part())?.size).toBe(1);
    const result = layoutSemanticDocument(reader.part(), 1, {
      measurer: createFixedMeasurer(6, 14),
      inlineDrawingLayout: bundle.bodyContext,
    });
    const line = linesOf(result)[0]!;
    expect(lineLayoutAtoms(line).map((atom) => atom.kind)).toEqual([
      'text',
      'inlineDrawing',
      'text',
    ]);
    expect(line.drawings).toHaveLength(1);
    expect(line.drawings![0]).toMatchObject({ start: 1, width: 120, height: 30 });
    expect(line.range.end).toBe(3);
  } finally {
    bundle.dispose();
  }
});

test('discovers floating VML and reserves its model offset without an inline picture', () => {
  const { reader, bundle } = setup(xml('Floating', 120, true));
  try {
    const result = layoutSemanticDocument(reader.part(), 1, {
      measurer: createFixedMeasurer(6, 14),
      inlineDrawingLayout: bundle.bodyContext,
    });
    expect(result.pages[0]!.anchoredDrawings).toHaveLength(1);
    expect(result.pages[0]!.anchoredDrawings![0]).toMatchObject({ width: 120, height: 30 });
    expect(linesOf(result).flatMap((line) => line.drawings ?? [])).toHaveLength(0);
    expect(linesOf(result)[0]!.range.end).toBe(3);
  } finally {
    bundle.dispose();
  }
});

test('does not paint VML graphics in a hidden run', () => {
  for (const floating of [false, true]) {
    const { reader, bundle } = setup(
      xml('Hidden', 120, floating).replace('<w:r>', '<w:r><w:rPr><w:vanish/></w:rPr>')
    );
    try {
      const result = layoutSemanticDocument(reader.part(), 1, {
        measurer: createFixedMeasurer(6, 14),
        inlineDrawingLayout: bundle.bodyContext,
      });
      expect(linesOf(result).flatMap((line) => line.drawings ?? [])).toHaveLength(0);
      expect(result.pages.flatMap((page) => page.anchoredDrawings ?? [])).toHaveLength(0);
    } finally {
      bundle.dispose();
    }
  }
});

test('direct vanish suppresses VML and DrawingML anchors without moving model offsets', () => {
  const wp = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
  const a = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const pic = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
  const modern = `<w:drawing xmlns:wp="${wp}" xmlns:a="${a}" xmlns:pic="${pic}" xmlns:r="${R}"><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>254000</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>127000</wp:posOffset></wp:positionV><wp:extent cx="1524000" cy="381000"/><wp:wrapSquare wrapText="bothSides"/><wp:docPr id="1" name="modern"/><a:graphic><a:graphicData uri="${pic}"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="modern"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rPhoto"/></pic:blipFill><pic:spPr/></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing>`;
  const legacy = xml('Hidden', 120, true).match(/<w:pict>[\s\S]*?<\/w:pict>/)![0];
  for (const drawing of [legacy, modern]) {
    for (const [properties, hidden] of [
      ['<w:vanish/>', true],
      ['<w:vanish w:val="1"/>', true],
      ['<w:vanish w:val="0"/>', false],
      ['<w:vanish w:val="false"/>', false],
    ] as const) {
      const source = xml().replace(
        /<w:p>[\s\S]*?<\/w:p>/,
        `<w:p><w:r><w:t>A</w:t></w:r><w:r><w:rPr>${properties}</w:rPr>${drawing}</w:r><w:r><w:t>Z</w:t></w:r></w:p>`
      );
      const { reader, bundle } = setup(source);
      try {
        const before = serializeOoxmlPart(reader.part());
        const paragraph = paragraphOf(reader.part());
        expect(paragraphTextOf(reader.part(), paragraph.id)).toBe('A\uFFFCZ');
        expect([...drawingModelOffsetsInParagraph(paragraph).values()]).toEqual([1]);
        expect(anchoredDrawingAtomsInParagraph(paragraph, bundle.bodyContext)).toHaveLength(
          hidden ? 0 : 1
        );
        const result = layoutSemanticDocument(reader.part(), 1, {
          measurer: createFixedMeasurer(6, 14),
          inlineDrawingLayout: bundle.bodyContext,
        });
        expect(result.pages.flatMap((page) => page.anchoredDrawings ?? [])).toHaveLength(
          hidden ? 0 : 1
        );
        const trailing = linesOf(result)
          .flatMap((line) => line.spans)
          .find((span) => span.text === 'Z');
        expect(trailing?.range).toEqual({ paragraphId: paragraph.id, start: 2, end: 3 });
        expect(serializeOoxmlPart(reader.part())).toBe(before);
      } finally {
        bundle.dispose();
      }
    }
  }
});

test('model-only WordArt text and geometry edits invalidate the drawing cache and preview', async () => {
  const { reader, bundle, replace } = setup();
  try {
    const token = () => bundle.drawingTokenForParagraph(paragraphOf(reader.part()), metadata.name);
    const projection = () => {
      const id = [...drawingAtomIdentities(reader.part())!.keys()][0]!;
      const value = bundle.bodyContext.projectionForAtom?.(id);
      if (!value) throw new Error('Expected drawing projection');
      return value;
    };
    const preview = async () => {
      let state = bundle.bodyContext.resourceOf(projection());
      for (let attempt = 0; attempt < 20 && state.kind === 'pending'; attempt++) {
        await Promise.resolve();
        state = bundle.bodyContext.resourceOf(projection());
      }
      expect(state.kind).toBe('ready');
      if (state.kind !== 'ready') throw new Error('Expected ready preview');
      return new TextDecoder().decode(
        bundle.mintValidatedBytes(state.validatedHandle, state.contentId)!
      );
    };
    expect(await preview()).toContain('>Old</text>');
    const before = token();
    replace(xml('New'));
    expect(token()).not.toBe(before);
    expect(await preview()).toContain('>New</text>');
    const afterText = token();
    replace(xml('New', 240));
    expect(token()).not.toBe(afterText);
    expect(await preview()).toContain('viewBox="0 0 240 30"');
    const result = layoutSemanticDocument(reader.part(), 3, {
      measurer: createFixedMeasurer(6, 14),
      inlineDrawingLayout: bundle.bodyContext,
    });
    expect(linesOf(result)[0]!.drawings![0]!.width).toBe(240);
  } finally {
    bundle.dispose();
  }
});
