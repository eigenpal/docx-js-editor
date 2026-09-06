import { describe, expect, test } from 'bun:test';
import { strToU8, unzipSync, zipSync } from 'fflate';
import {
  projectDrawingsInPackage,
  projectDrawingsInPart,
  type DrawingProjection,
} from '../package/drawing-projection.ts';
import {
  createImageResourceCache,
  liveDrawingReferenceCount,
  type ImageDecodePort,
  type ImageResourceState,
} from '../package/image-resources.ts';
import {
  readOoxmlPackage,
  writeOoxmlPackage,
  type OoxmlPackage,
} from '../package/ooxml-package.ts';
import {
  readOoxmlPart,
  serializeOoxmlPart,
  type OoxmlPart,
  type OoxmlParagraphNode,
} from '../package/ooxml-tree.ts';
import { mintValidatedImageBytes } from '../package/validated-image-bytes.ts';
import { paragraphLength, segmentsOf } from '../store/tree-op-segments.ts';
import { paragraphTextOf } from '../store/tree-ops.ts';
import { TreeDocumentStore } from '../store/tree-store.ts';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const V = 'urn:schemas-microsoft-com:vml';
const O = 'urn:schemas-microsoft-com:office:office';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const metadata = {
  name: '/word/document.xml',
  contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
};
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const PNG = Uint8Array.from(atob(PNG_BASE64), (c) => c.charCodeAt(0));

function documentXml(content: string): string {
  return `<w:document xmlns:w="${W}" xmlns:v="${V}" xmlns:o="${O}" xmlns:r="${R}"><w:body><w:p><w:r><w:t>A</w:t>${content}<w:t>Z</w:t></w:r></w:p></w:body></w:document>`;
}

function parse(content: string, renamePrefixes = false): OoxmlPart {
  let xml = documentXml(content);
  if (renamePrefixes) {
    for (const [from, to] of [
      ['w', 'word'],
      ['v', 'legacy'],
      ['o', 'office'],
      ['r', 'rel'],
    ]) {
      xml = xml.replaceAll(`xmlns:${from}=`, `xmlns:${to}=`).replaceAll(`${from}:`, `${to}:`);
    }
  }
  const loaded = readOoxmlPart(xml, metadata);
  if (!loaded.ok) throw new Error(loaded.reason);
  return loaded.part;
}

function packageOf(content: string, external = false): OoxmlPackage {
  const loaded = readOoxmlPackage(
    zipSync(
      {
        '[Content_Types].xml': strToU8(
          `<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="${metadata.contentType}"/></Types>`
        ),
        '_rels/.rels': strToU8(
          `<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`
        ),
        'word/document.xml': strToU8(documentXml(content)),
        'word/_rels/document.xml.rels': strToU8(
          `<Relationships xmlns="${REL}"><Relationship Id="rPhoto" Type="${R}/image" Target="${external ? 'https://example.invalid/private.png' : 'media/photo.png'}"${external ? ' TargetMode="External"' : ''}/></Relationships>`
        ),
        'word/media/photo.png': PNG,
      },
      { level: 0 }
    )
  );
  if (!loaded.ok) throw new Error(loaded.reason);
  return loaded.package;
}

function photo(style = 'width:72pt;height:36pt'): string {
  return `<v:shape id="photo" type="#_x0000_t75" style="${style}"><v:imagedata r:id="rPhoto" o:title="photo"/></v:shape>`;
}

function group(extra = '', width = '200pt'): string {
  return `<w:pict><v:group id="annotation" style="width:${width};height:100pt" coordorigin="100,200" coordsize="1000,500">${photo('left:200;top:250;width:500;height:250')}<v:shape type="#_x0000_t32" style="left:200;top:250;width:500;height:250" strokecolor="#ff0000" strokeweight="2pt"><v:stroke endarrow="block" endarrowwidth="wide" endarrowlength="long"/></v:shape>${extra}</v:group></w:pict>`;
}

function wordArt(text = 'A &amp; B &lt;tag&gt; &quot;quoted&quot;', width = '120pt'): string {
  return `<w:pict><v:shape id="title" type="#_x0000_t136" style="width:${width};height:30pt" fillcolor="#112233" stroked="f"><v:textpath on="t" fitshape="t" style="font-family:Times New Roman;font-size:24pt;font-weight:bold" string="${text}"/></v:shape></w:pict>`;
}

function onlyProjection(part: OoxmlPart): DrawingProjection {
  const projections = projectDrawingsInPart(part);
  expect(projections).toHaveLength(1);
  return projections[0]!;
}

function firstParagraph(part: OoxmlPart): OoxmlParagraphNode {
  const body = part.root.children.find((n) => n.kind !== 'textValue' && n.localName === 'body');
  if (!body || body.kind === 'textValue') throw new Error('missing body');
  const paragraph = body.children.find((n) => n.kind === 'paragraph');
  if (!paragraph || paragraph.kind !== 'paragraph') throw new Error('missing paragraph');
  return paragraph;
}

function decodePort(): ImageDecodePort & { calls: number } {
  return {
    calls: 0,
    async decode(bytes, mime) {
      this.calls++;
      expect(mime).toBe('image/png');
      expect(bytes).toEqual(PNG);
      return { pixelWidth: 1, pixelHeight: 1, dpiX: 96, dpiY: 96 };
    },
  };
}

function svgOf(state: ImageResourceState): string {
  expect(state.kind).toBe('ready');
  if (state.kind !== 'ready') throw new Error(`Expected ready, got ${state.kind}`);
  expect(state.mime).toBe('image/svg+xml');
  const bytes = mintValidatedImageBytes(state.validatedHandle, state.contentId);
  expect(bytes).not.toBeNull();
  return new TextDecoder().decode(bytes!);
}

describe('bounded legacy VML projections', () => {
  test('projects colour-keyed equation previews without interpreting their source metadata', () => {
    for (const renamed of [false, true]) {
      const content = photo()
        .replace(
          'id="photo"',
          `id="photo" ${renamed ? 'o:' : ''}equationxml="${'x'.repeat(28_000)}"`
        )
        .replace('o:title="photo"', 'o:title="photo" chromakey="#FFFFFF" cropleft="8192f"');
      const part = parse(`<w:pict>${content}</w:pict>`, renamed);
      const before = serializeOoxmlPart(part);
      const fragment = onlyProjection(part).legacyGraphic!.fragments[0]!;
      expect(typeof fragment).toBe('object');
      if (typeof fragment === 'string') throw new Error('Expected image slot');
      expect(fragment.before).toContain('color-interpolation-filters="sRGB"');
      expect(fragment.before).toContain('filter="url(#vml-key-ffffff)"');
      expect(fragment.before).not.toContain('equationxml');
      expect(fragment.before).not.toContain('x'.repeat(100));
      expect(serializeOoxmlPart(part)).toBe(before);
    }
  });

  test('refuses invalid colour keys and retains all input budgets', () => {
    for (const key of ['url(https://example.invalid)', '#ffff', '', 'transparent']) {
      expect(
        projectDrawingsInPart(
          parse(`<w:pict>${photo().replace('o:title="photo"', `chromakey="${key}"`)}</w:pict>`)
        )
      ).toHaveLength(0);
    }
    for (const metadata of [
      `o:equationxml="${'x'.repeat(65_537)}"`,
      `o:title="${'x'.repeat(8193)}"`,
      `r:equationxml="${'x'.repeat(28_000)}"`,
    ]) {
      expect(
        projectDrawingsInPart(parse(`<w:pict>${photo().replace('id="photo"', metadata)}</w:pict>`))
      ).toHaveLength(0);
    }
  });

  test('accepts disabled equation picture decorations but not visible or custom ones', () => {
    const decorations =
      '<v:path/><v:fill on="f" focussize="0,0"/><v:stroke on="f"/><word:anchorlock xmlns:word="urn:schemas-microsoft-com:office:word"/>';
    const content = `<w:pict>${photo()
      .replace('id="photo"', 'id="photo" filled="f" stroked="f"')
      .replace('<v:imagedata', decorations + '<v:imagedata')
      .replace('o:title="photo"', 'chromakey="#ffffff"')}</w:pict>`;
    expect(projectDrawingsInPart(parse(content))).toHaveLength(1);
    for (const [from, to] of [
      ['<v:path/>', '<v:path v="m0,0l1,1e"/>'],
      ['<v:fill on="f"', '<v:fill on="t"'],
      ['<v:stroke on="f"', '<v:stroke on="t"'],
    ]) {
      expect(projectDrawingsInPart(parse(content.replace(from!, to!)))).toHaveLength(0);
    }
  });

  test('recognizes a standalone picture by namespace, not authored prefix', () => {
    for (const renamed of [false, true]) {
      const part = parse(`<w:pict>${photo()}</w:pict>`, renamed);
      const before = serializeOoxmlPart(part);
      const projection = onlyProjection(part);
      expect(projection.kind).toBe('inline');
      expect(projection.extentEmu).toEqual({ cx: 914400, cy: 457200 });
      expect(projection.ownerPartName).toBe('/word/document.xml');
      expect(projection.legacyGraphic?.fragments).toHaveLength(1);
      expect(projection.legacyGraphic?.fragments[0]).toMatchObject({ relationshipId: 'rPhoto' });
      expect(serializeOoxmlPart(part)).toBe(before);
    }
  });

  test('does not project a dead VML fallback beside the selected DrawingML picture', () => {
    const wp = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
    const a = 'http://schemas.openxmlformats.org/drawingml/2006/main';
    const pic = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
    const mc = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
    const choice = `<w:drawing xmlns:wp="${wp}" xmlns:a="${a}" xmlns:pic="${pic}"><wp:inline><wp:extent cx="914400" cy="457200"/><wp:docPr id="1" name="modern"/><a:graphic><a:graphicData uri="${pic}"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="modern"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rModern"/></pic:blipFill><pic:spPr/></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
    const part = parse(
      `<mc:AlternateContent xmlns:mc="${mc}" xmlns:supported="urn:test-supported"><mc:Choice Requires="supported">${choice}</mc:Choice><mc:Fallback>${group()}</mc:Fallback></mc:AlternateContent>`
    );
    const projections = projectDrawingsInPart(part, {
      supportedMcRequires: new Set(['urn:test-supported']),
    });
    expect(projections).toHaveLength(1);
    expect(projections[0]!.picture?.embeddedRelationshipId).toBe('rModern');
    expect(projections[0]!.legacyGraphic).toBeUndefined();
  });

  test('maps group coordinates and retains photo-before-arrow paint order', () => {
    const projection = onlyProjection(parse(group()));
    expect(projection.legacyGraphic).toMatchObject({ width: 200, height: 100 });
    const fragments = projection.legacyGraphic!.fragments;
    expect(fragments).toHaveLength(2);
    expect(fragments[0]).toMatchObject({ relationshipId: 'rPhoto' });
    const photoFragment = fragments[0]!;
    if (typeof photoFragment === 'string') throw new Error('Expected photo slot');
    expect(photoFragment.before).toContain('x="20" y="10" width="100" height="50"');
    expect(fragments[1]).toContain('<polyline points="20,10 120,60"');
    expect(fragments[1]).toContain('<path d="M');
    expect(fragments[1]).toContain('fill="#ff0000" stroke="#ff0000"');
  });

  test('maps nested group origin and size without flattening the source tree', () => {
    const nested = `<v:group style="left:100;top:200;width:500;height:250" coordorigin="10,20" coordsize="100,50">${photo('left:20;top:25;width:50;height:25')}</v:group>`;
    const part = parse(group(nested));
    const before = serializeOoxmlPart(part);
    const fragments = onlyProjection(part).legacyGraphic!.fragments;
    expect(fragments).toHaveLength(3);
    const last = fragments[2]!;
    if (typeof last === 'string') throw new Error('Expected nested photo slot');
    expect(last.before).toContain('x="10" y="5" width="50" height="25"');
    expect(serializeOoxmlPart(part)).toBe(before);
  });

  test('escapes straight WordArt text and keeps canonical OOXML unchanged', () => {
    const part = parse(wordArt());
    const before = serializeOoxmlPart(part);
    const projection = onlyProjection(part);
    const svg = projection.legacyGraphic!.fragments.join('');
    expect(svg).toContain('A &amp; B &lt;tag&gt; &quot;quoted&quot;');
    expect(svg).not.toContain('<tag>');
    expect(svg).toContain('font-family="Times New Roman"');
    expect(svg).toContain('fill="#112233"');
    expect(serializeOoxmlPart(part)).toBe(before);
  });

  test('refuses an entire mixed group when any member is unsupported', () => {
    for (const extra of [
      '<v:arc style="left:0;top:0;width:1;height:1"/>',
      '<v:shape type="#_x0000_t137" style="left:0;top:0;width:1;height:1"/>',
      '<v:shape style="left:0;top:0;width:1;height:1"><v:textbox/></v:shape>',
    ]) {
      const part = parse(group(extra));
      const before = serializeOoxmlPart(part);
      expect(projectDrawingsInPart(part)).toHaveLength(0);
      expect(serializeOoxmlPart(part)).toBe(before);
    }
  });

  test('refuses rotation, unsupported crop, remote source markup and oversized drawings', () => {
    const samples = [
      `<w:pict>${photo('width:72pt;height:36pt;rotation:90')}</w:pict>`,
      `<w:pict>${photo('width:10001pt;height:36pt')}</w:pict>`,
      `<w:pict>${photo().replace('r:id="rPhoto"', 'src="https://example.invalid/image.png"')}</w:pict>`,
      `<w:pict>${photo().replace('r:id="rPhoto"', 'r:id="rPhoto" cropleft="0.6" cropright="0.6"')}</w:pict>`,
      wordArt().replace('#_x0000_t136', '#_x0000_t137'),
      wordArt().replace('width:120pt', 'rotation:10;width:120pt'),
      wordArt('x'.repeat(1025)),
    ];
    for (const sample of samples) expect(projectDrawingsInPart(parse(sample))).toHaveLength(0);
  });

  test('bounds group member count and nesting before generating previews', () => {
    const child = '<v:rect style="left:100;top:200;width:1;height:1"/>';
    expect(projectDrawingsInPart(parse(group(child.repeat(129))))).toHaveLength(0);
    let nested = photo('left:0;top:0;width:10;height:10');
    for (let depth = 0; depth < 10; depth++) {
      nested = `<v:group style="left:0;top:0;width:10;height:10">${nested}</v:group>`;
    }
    expect(projectDrawingsInPart(parse(group(nested)))).toHaveLength(0);
  });

  test('refuses groups whose members or arrow ink would be clipped by the viewport', () => {
    const outside = photo('left:50;top:200;width:500;height:250');
    const edgeArrow =
      '<v:shape type="#_x0000_t32" style="left:100;top:200;width:900;height:0" strokecolor="#ff0000" strokeweight="12pt"><v:stroke startarrow="block" endarrow="block"/></v:shape>';
    expect(projectDrawingsInPart(parse(group(outside)))).toHaveLength(0);
    expect(projectDrawingsInPart(parse(group(edgeArrow)))).toHaveLength(0);
  });

  test('treats the complete photo/arrow group as one offset and restores it on undo', () => {
    const part = parse(group());
    const before = serializeOoxmlPart(part);
    const paragraph = firstParagraph(part);
    const atom = segmentsOf(paragraph).find(
      (s) => s.node.kind !== 'textValue' && s.node.localName === 'pict'
    );
    expect(paragraphLength(paragraph)).toBe(3);
    expect(paragraphTextOf(part, paragraph.id)).toBe('A\uFFFCZ');
    expect(atom).toMatchObject({ start: 1, end: 2 });
    expect(atom?.removeNodeIds).toEqual([atom?.node.id]);
    const store = new TreeDocumentStore(part);
    expect(
      store.transact((ctx) =>
        ctx.apply({ op: 'deleteText', paragraphId: paragraph.id, start: 1, end: 2 })
      ).ok
    ).toBe(true);
    expect(paragraphTextOf(store.part, paragraph.id)).toBe('AZ');
    expect(projectDrawingsInPart(store.part)).toHaveLength(0);
    expect(store.undo()).not.toBeNull();
    expect(serializeOoxmlPart(store.part)).toBe(before);
    expect(projectDrawingsInPart(store.part)).toHaveLength(1);
  });
});

describe('derived legacy graphics resources', () => {
  test('invalidates colour-key previews without changing original XML or PNG bytes', async () => {
    const keyed = (key: string) =>
      `<w:pict>${photo().replace('o:title="photo"', `chromakey="${key}"`)}</w:pict>`;
    const pkg = packageOf(keyed('#ffffff'));
    const before = unzipSync(writeOoxmlPackage(pkg));
    const lookup = createImageResourceCache(pkg, { decodePort: decodePort() });
    try {
      const white = await lookup.resolveForProjection(onlyProjection(parse(keyed('#ffffff'))));
      const red = await lookup.resolveForProjection(onlyProjection(parse(keyed('#ff0000'))));
      expect(svgOf(white)).toContain('vml-key-ffffff');
      expect(svgOf(red)).toContain('vml-key-ff0000');
      expect(svgOf(white)).toContain(`data:image/png;base64,${PNG_BASE64}`);
      if (white.kind !== 'ready' || red.kind !== 'ready')
        throw new Error('Expected ready previews');
      expect(white.contentId).not.toBe(red.contentId);
      const after = unzipSync(writeOoxmlPackage(pkg));
      expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
      for (const name of Object.keys(before)) expect(after[name]).toEqual(before[name]);
    } finally {
      lookup.dispose();
    }
  });

  test('enforces encoded, decoded, pixel and dimension budgets on derived SVG previews', async () => {
    for (const limits of [
      { maxEncodedBytes: 256 },
      { maxDecodedBytes: 64 },
      { maxPixels: 10 },
      { maxDimension: 100 },
    ]) {
      const pkg = packageOf(wordArt('x'.repeat(900)));
      const decode = decodePort();
      const lookup = createImageResourceCache(pkg, { decodePort: decode, limits });
      try {
        expect(await lookup.resolveForProjection(projectDrawingsInPackage(pkg)[0]!)).toMatchObject({
          kind: 'unrenderable',
          reason: 'resource-limit',
        });
        expect(decode.calls).toBe(0);
      } finally {
        lookup.dispose();
      }
    }
  });

  test('resolves validated embedded photo bytes and arrow paint in a single SVG', async () => {
    const pkg = packageOf(group());
    const decode = decodePort();
    const lookup = createImageResourceCache(pkg, { decodePort: decode });
    try {
      const projection = projectDrawingsInPackage(pkg)[0]!;
      const state = await lookup.resolveForProjection(projection);
      const svg = svgOf(state);
      expect(svg).toContain(`href="data:image/png;base64,${PNG_BASE64}"`);
      expect(svg).toContain('<polyline points="20,10 120,60"');
      expect(svg).toContain('<path d="M');
      expect(svg.indexOf('<image')).toBeLessThan(svg.indexOf('<polyline'));
      expect(decode.calls).toBe(1);
      expect(await lookup.resolveForProjection(projection)).toBe(state);
      expect(decode.calls).toBe(1);
    } finally {
      lookup.dispose();
    }
  });

  test('counts every photo member without counting vector annotations', () => {
    const pkg = packageOf(
      group(photo('left:200;top:250;width:10;height:10')) + `<w:pict>${photo()}</w:pict>`
    );
    expect(liveDrawingReferenceCount(pkg, '/word/media/photo.png')).toBe(3);
    expect(liveDrawingReferenceCount(pkg, '/word/media/missing.png')).toBe(0);
  });

  test('does not fetch or decode an external photo relationship', async () => {
    const pkg = packageOf(group(), true);
    const decode = decodePort();
    const lookup = createImageResourceCache(pkg, { decodePort: decode });
    const fetchBefore = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error('No external fetch is permitted');
    }) as typeof fetch;
    try {
      const state = await lookup.resolveForProjection(projectDrawingsInPackage(pkg)[0]!);
      expect(state.kind).toBe('external');
      expect(decode.calls).toBe(0);
    } finally {
      globalThis.fetch = fetchBefore;
      lookup.dispose();
    }
  });

  test('does not paint a partial group when a photo relationship is missing', async () => {
    const pkg = packageOf(group().replace('r:id="rPhoto"', 'r:id="missing"'));
    const decode = decodePort();
    const lookup = createImageResourceCache(pkg, { decodePort: decode });
    try {
      expect((await lookup.resolveForProjection(projectDrawingsInPackage(pkg)[0]!)).kind).toBe(
        'missing'
      );
      expect(decode.calls).toBe(0);
    } finally {
      lookup.dispose();
    }
  });

  test('invalidates generated resources when geometry or WordArt text changes', async () => {
    const pkg = packageOf(wordArt('Old'));
    const lookup = createImageResourceCache(pkg, { decodePort: decodePort() });
    try {
      const oldProjection = onlyProjection(parse(wordArt('Old')));
      const resizedProjection = onlyProjection(parse(wordArt('Old', '240pt')));
      const editedProjection = onlyProjection(parse(wordArt('New', '240pt')));
      expect(resizedProjection.drawingNodeId).toBe(oldProjection.drawingNodeId);
      expect(editedProjection.drawingNodeId).toBe(oldProjection.drawingNodeId);
      const oldState = await lookup.resolveForProjection(oldProjection);
      const resized = await lookup.resolveForProjection(resizedProjection);
      const edited = await lookup.resolveForProjection(editedProjection);
      expect(svgOf(oldState)).toContain('>Old</text>');
      expect(svgOf(resized)).toContain('viewBox="0 0 240 30"');
      expect(svgOf(edited)).toContain('>New</text>');
      if (oldState.kind !== 'ready' || resized.kind !== 'ready' || edited.kind !== 'ready')
        throw new Error('Expected ready resources');
      expect(resized.contentId).not.toBe(oldState.contentId);
      expect(edited.contentId).not.toBe(resized.contentId);
      // A new resource must not revoke a previously retained paint frame.
      expect(svgOf(oldState)).toContain('>Old</text>');
    } finally {
      lookup.dispose();
    }
  });

  test('save/reopen keeps original media and adds no synthetic part or relationship', async () => {
    const pkg = packageOf(group() + wordArt());
    const before = unzipSync(writeOoxmlPackage(pkg));
    const documentBefore = serializeOoxmlPart(pkg.parts.get(pkg.mainDocumentPart)!);
    const lookup = createImageResourceCache(pkg, { decodePort: decodePort() });
    try {
      for (const projection of projectDrawingsInPackage(pkg))
        svgOf(await lookup.resolveForProjection(projection));
      const saved = writeOoxmlPackage(pkg);
      const after = unzipSync(saved);
      expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
      expect(after['word/media/photo.png']).toEqual(PNG);
      expect(after['word/_rels/document.xml.rels']).toEqual(before['word/_rels/document.xml.rels']);
      expect(after['[Content_Types].xml']).toEqual(before['[Content_Types].xml']);
      const reopened = readOoxmlPackage(saved);
      if (!reopened.ok) throw new Error(reopened.reason);
      expect(
        serializeOoxmlPart(reopened.package.parts.get(reopened.package.mainDocumentPart)!)
      ).toBe(documentBefore);
      expect(projectDrawingsInPackage(reopened.package)).toHaveLength(2);
    } finally {
      lookup.dispose();
    }
  });
});
