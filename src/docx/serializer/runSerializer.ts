/**
 * Run Serializer - Serialize runs to OOXML XML
 *
 * Converts Run objects back to <w:r> XML format for DOCX files.
 * Handles all formatting properties and content types.
 *
 * OOXML Reference:
 * - Run: w:r
 * - Run properties: w:rPr
 * - Text content: w:t
 */

import type {
  Run,
  RunContent,
  TextContent,
  TabContent,
  BreakContent,
  SymbolContent,
  NoteReferenceContent,
  FieldCharContent,
  InstrTextContent,
  SoftHyphenContent,
  NoBreakHyphenContent,
  DrawingContent,
  ShapeContent,
  TextFormatting,
  ColorValue,
  ShadingProperties,
  Image,
  ShapeFill,
  ShapeOutline,
  ImagePosition,
  ImageWrap,
  Paragraph,
} from '../../types/document';
import { serializeParagraph } from './paragraphSerializer';

// ============================================================================
// XML ESCAPING
// ============================================================================

/**
 * Escape special XML characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================================================
// COLOR SERIALIZATION
// ============================================================================

/**
 * Serialize a color element (w:color)
 */
function serializeColorElement(color: ColorValue | undefined): string {
  if (!color) return '';

  const attrs: string[] = [];

  if (color.auto) {
    attrs.push('w:val="auto"');
  } else if (color.rgb) {
    attrs.push(`w:val="${color.rgb}"`);
  }

  if (color.themeColor) {
    attrs.push(`w:themeColor="${color.themeColor}"`);
  }

  if (color.themeTint) {
    attrs.push(`w:themeTint="${color.themeTint}"`);
  }

  if (color.themeShade) {
    attrs.push(`w:themeShade="${color.themeShade}"`);
  }

  if (attrs.length === 0) return '';

  return `<w:color ${attrs.join(' ')}/>`;
}

// ============================================================================
// SHADING SERIALIZATION
// ============================================================================

/**
 * Serialize shading properties (w:shd)
 */
function serializeShading(shading: ShadingProperties | undefined): string {
  if (!shading) return '';

  const attrs: string[] = [];

  // Pattern/val
  if (shading.pattern) {
    attrs.push(`w:val="${shading.pattern}"`);
  } else {
    attrs.push('w:val="clear"');
  }

  // Color (pattern color)
  if (shading.color?.rgb) {
    attrs.push(`w:color="${shading.color.rgb}"`);
  } else if (shading.color?.auto) {
    attrs.push('w:color="auto"');
  }

  // Fill (background color)
  if (shading.fill?.rgb) {
    attrs.push(`w:fill="${shading.fill.rgb}"`);
  } else if (shading.fill?.auto) {
    attrs.push('w:fill="auto"');
  }

  // Theme fill
  if (shading.fill?.themeColor) {
    attrs.push(`w:themeFill="${shading.fill.themeColor}"`);
  }

  if (shading.fill?.themeTint) {
    attrs.push(`w:themeFillTint="${shading.fill.themeTint}"`);
  }

  if (shading.fill?.themeShade) {
    attrs.push(`w:themeFillShade="${shading.fill.themeShade}"`);
  }

  if (attrs.length === 0) return '';

  return `<w:shd ${attrs.join(' ')}/>`;
}

// ============================================================================
// TEXT FORMATTING SERIALIZATION
// ============================================================================

/**
 * Serialize text formatting properties to w:rPr XML
 */
export function serializeTextFormatting(formatting: TextFormatting | undefined): string {
  if (!formatting) return '';

  const parts: string[] = [];

  // Style reference (must be first)
  if (formatting.styleId) {
    parts.push(`<w:rStyle w:val="${escapeXml(formatting.styleId)}"/>`);
  }

  // Font family (w:rFonts)
  if (formatting.fontFamily) {
    const fontAttrs: string[] = [];
    if (formatting.fontFamily.ascii) {
      fontAttrs.push(`w:ascii="${escapeXml(formatting.fontFamily.ascii)}"`);
    }
    if (formatting.fontFamily.hAnsi) {
      fontAttrs.push(`w:hAnsi="${escapeXml(formatting.fontFamily.hAnsi)}"`);
    }
    if (formatting.fontFamily.eastAsia) {
      fontAttrs.push(`w:eastAsia="${escapeXml(formatting.fontFamily.eastAsia)}"`);
    }
    if (formatting.fontFamily.cs) {
      fontAttrs.push(`w:cs="${escapeXml(formatting.fontFamily.cs)}"`);
    }
    if (formatting.fontFamily.asciiTheme) {
      fontAttrs.push(`w:asciiTheme="${formatting.fontFamily.asciiTheme}"`);
    }
    if (formatting.fontFamily.hAnsiTheme) {
      fontAttrs.push(`w:hAnsiTheme="${formatting.fontFamily.hAnsiTheme}"`);
    }
    if (formatting.fontFamily.eastAsiaTheme) {
      fontAttrs.push(`w:eastAsiaTheme="${formatting.fontFamily.eastAsiaTheme}"`);
    }
    if (formatting.fontFamily.csTheme) {
      fontAttrs.push(`w:csTheme="${formatting.fontFamily.csTheme}"`);
    }
    if (fontAttrs.length > 0) {
      parts.push(`<w:rFonts ${fontAttrs.join(' ')}/>`);
    }
  }

  // Bold
  if (formatting.bold === true) {
    parts.push('<w:b/>');
  } else if (formatting.bold === false) {
    parts.push('<w:b w:val="0"/>');
  }

  if (formatting.boldCs === true) {
    parts.push('<w:bCs/>');
  } else if (formatting.boldCs === false) {
    parts.push('<w:bCs w:val="0"/>');
  }

  // Italic
  if (formatting.italic === true) {
    parts.push('<w:i/>');
  } else if (formatting.italic === false) {
    parts.push('<w:i w:val="0"/>');
  }

  if (formatting.italicCs === true) {
    parts.push('<w:iCs/>');
  } else if (formatting.italicCs === false) {
    parts.push('<w:iCs w:val="0"/>');
  }

  // Caps
  if (formatting.allCaps) {
    parts.push('<w:caps/>');
  }

  if (formatting.smallCaps) {
    parts.push('<w:smallCaps/>');
  }

  // Strike
  if (formatting.strike) {
    parts.push('<w:strike/>');
  }

  if (formatting.doubleStrike) {
    parts.push('<w:dstrike/>');
  }

  // Outline
  if (formatting.outline) {
    parts.push('<w:outline/>');
  }

  // Shadow
  if (formatting.shadow) {
    parts.push('<w:shadow/>');
  }

  // Emboss
  if (formatting.emboss) {
    parts.push('<w:emboss/>');
  }

  // Imprint
  if (formatting.imprint) {
    parts.push('<w:imprint/>');
  }

  // Hidden
  if (formatting.hidden) {
    parts.push('<w:vanish/>');
  }

  // Color
  const colorXml = serializeColorElement(formatting.color);
  if (colorXml) {
    parts.push(colorXml);
  }

  // Spacing
  if (formatting.spacing !== undefined) {
    parts.push(`<w:spacing w:val="${formatting.spacing}"/>`);
  }

  // Scale (w:w)
  if (formatting.scale !== undefined) {
    parts.push(`<w:w w:val="${formatting.scale}"/>`);
  }

  // Kerning
  if (formatting.kerning !== undefined) {
    parts.push(`<w:kern w:val="${formatting.kerning}"/>`);
  }

  // Position
  if (formatting.position !== undefined) {
    parts.push(`<w:position w:val="${formatting.position}"/>`);
  }

  // Font size
  if (formatting.fontSize !== undefined) {
    parts.push(`<w:sz w:val="${formatting.fontSize}"/>`);
  }

  if (formatting.fontSizeCs !== undefined) {
    parts.push(`<w:szCs w:val="${formatting.fontSizeCs}"/>`);
  }

  // Highlight
  if (formatting.highlight && formatting.highlight !== 'none') {
    parts.push(`<w:highlight w:val="${formatting.highlight}"/>`);
  }

  // Underline
  if (formatting.underline) {
    const uAttrs: string[] = [`w:val="${formatting.underline.style}"`];
    if (formatting.underline.color) {
      if (formatting.underline.color.rgb) {
        uAttrs.push(`w:color="${formatting.underline.color.rgb}"`);
      }
      if (formatting.underline.color.themeColor) {
        uAttrs.push(`w:themeColor="${formatting.underline.color.themeColor}"`);
      }
    }
    parts.push(`<w:u ${uAttrs.join(' ')}/>`);
  }

  // Effect
  if (formatting.effect && formatting.effect !== 'none') {
    parts.push(`<w:effect w:val="${formatting.effect}"/>`);
  }

  // Emphasis mark
  if (formatting.emphasisMark && formatting.emphasisMark !== 'none') {
    parts.push(`<w:em w:val="${formatting.emphasisMark}"/>`);
  }

  // Shading
  const shadingXml = serializeShading(formatting.shading);
  if (shadingXml) {
    parts.push(shadingXml);
  }

  // Vertical alignment
  if (formatting.vertAlign && formatting.vertAlign !== 'baseline') {
    parts.push(`<w:vertAlign w:val="${formatting.vertAlign}"/>`);
  }

  // RTL and CS
  if (formatting.rtl) {
    parts.push('<w:rtl/>');
  }

  if (formatting.cs) {
    parts.push('<w:cs/>');
  }

  if (parts.length === 0) return '';

  return `<w:rPr>${parts.join('')}</w:rPr>`;
}

// ============================================================================
// RUN CONTENT SERIALIZATION
// ============================================================================

/**
 * Serialize text content (w:t)
 */
function serializeTextContent(content: TextContent): string {
  const needsPreserve =
    content.preserveSpace ||
    content.text.startsWith(' ') ||
    content.text.endsWith(' ') ||
    content.text.includes('  ');

  const spaceAttr = needsPreserve ? ' xml:space="preserve"' : '';

  return `<w:t${spaceAttr}>${escapeXml(content.text)}</w:t>`;
}

/**
 * Serialize tab content (w:tab)
 */
function serializeTabContent(_content: TabContent): string {
  return '<w:tab/>';
}

/**
 * Serialize break content (w:br)
 */
function serializeBreakContent(content: BreakContent): string {
  const attrs: string[] = [];

  if (content.breakType === 'page') {
    attrs.push('w:type="page"');
  } else if (content.breakType === 'column') {
    attrs.push('w:type="column"');
  } else if (content.breakType === 'textWrapping') {
    attrs.push('w:type="textWrapping"');
    if (content.clear && content.clear !== 'none') {
      attrs.push(`w:clear="${content.clear}"`);
    }
  }

  if (attrs.length === 0) {
    return '<w:br/>';
  }

  return `<w:br ${attrs.join(' ')}/>`;
}

/**
 * Serialize symbol content (w:sym)
 */
function serializeSymbolContent(content: SymbolContent): string {
  return `<w:sym w:font="${escapeXml(content.font)}" w:char="${escapeXml(content.char)}"/>`;
}

/**
 * Serialize footnote/endnote reference
 */
function serializeNoteReference(content: NoteReferenceContent): string {
  if (content.type === 'footnoteRef') {
    return `<w:footnoteReference w:id="${content.id}"/>`;
  } else {
    return `<w:endnoteReference w:id="${content.id}"/>`;
  }
}

/**
 * Serialize field character (w:fldChar)
 */
function serializeFieldChar(content: FieldCharContent): string {
  const attrs: string[] = [`w:fldCharType="${content.charType}"`];

  if (content.fldLock) {
    attrs.push('w:fldLock="true"');
  }

  if (content.dirty) {
    attrs.push('w:dirty="true"');
  }

  return `<w:fldChar ${attrs.join(' ')}/>`;
}

/**
 * Serialize field instruction text (w:instrText)
 */
function serializeInstrText(content: InstrTextContent): string {
  const needsPreserve =
    content.text.startsWith(' ') || content.text.endsWith(' ') || content.text.includes('  ');

  const spaceAttr = needsPreserve ? ' xml:space="preserve"' : '';

  return `<w:instrText${spaceAttr}>${escapeXml(content.text)}</w:instrText>`;
}

/**
 * Serialize soft hyphen (w:softHyphen)
 */
function serializeSoftHyphen(_content: SoftHyphenContent): string {
  return '<w:softHyphen/>';
}

/**
 * Serialize non-breaking hyphen (w:noBreakHyphen)
 */
function serializeNoBreakHyphen(_content: NoBreakHyphenContent): string {
  return '<w:noBreakHyphen/>';
}

// ============================================================================
// DRAWING / IMAGE / SHAPE SERIALIZATION
// ============================================================================

/** Serialize a color value to DrawingML a:srgbClr or a:schemeClr */
function serializeDrawingColor(color: ColorValue | undefined): string {
  if (!color) return '';
  if (color.rgb) {
    return `<a:srgbClr val="${color.rgb.replace('#', '')}"/>`;
  }
  if (color.themeColor) {
    let clr = `<a:schemeClr val="${color.themeColor}"`;
    if (color.themeTint) {
      clr += `><a:tint val="${color.themeTint}"/></a:schemeClr>`;
    } else if (color.themeShade) {
      clr += `><a:shade val="${color.themeShade}"/></a:schemeClr>`;
    } else {
      clr += `/>`;
    }
    return clr;
  }
  return '';
}

/** Serialize shape fill to DrawingML */
function serializeFill(fill: ShapeFill | undefined): string {
  if (!fill || fill.type === 'none') return '<a:noFill/>';
  if (fill.type === 'solid' && fill.color) {
    return `<a:solidFill>${serializeDrawingColor(fill.color)}</a:solidFill>`;
  }
  if (fill.type === 'gradient' && fill.gradient) {
    const g = fill.gradient;
    const stops = g.stops
      .map((s) => `<a:gs pos="${s.position}">${serializeDrawingColor(s.color)}</a:gs>`)
      .join('');
    const direction =
      g.type === 'linear' ? `<a:lin ang="${(g.angle || 0) * 60000}" scaled="1"/>` : '';
    return `<a:gradFill><a:gsLst>${stops}</a:gsLst>${direction}</a:gradFill>`;
  }
  return '';
}

/** Serialize shape outline to DrawingML a:ln */
function serializeOutline(outline: ShapeOutline | undefined): string {
  if (!outline) return '';
  const attrs: string[] = [];
  if (outline.width != null) attrs.push(`w="${outline.width}"`);
  if (outline.cap) attrs.push(`cap="${outline.cap}"`);

  const parts: string[] = [];
  if (outline.color) {
    parts.push(`<a:solidFill>${serializeDrawingColor(outline.color)}</a:solidFill>`);
  }
  if (outline.style && outline.style !== 'solid') {
    parts.push(`<a:prstDash val="${outline.style}"/>`);
  }
  if (outline.headEnd) {
    parts.push(
      `<a:headEnd type="${outline.headEnd.type}"${outline.headEnd.width ? ` w="${outline.headEnd.width}"` : ''}${outline.headEnd.length ? ` len="${outline.headEnd.length}"` : ''}/>`
    );
  }
  if (outline.tailEnd) {
    parts.push(
      `<a:tailEnd type="${outline.tailEnd.type}"${outline.tailEnd.width ? ` w="${outline.tailEnd.width}"` : ''}${outline.tailEnd.length ? ` len="${outline.tailEnd.length}"` : ''}/>`
    );
  }

  if (parts.length === 0 && attrs.length === 0) return '';
  return `<a:ln${attrs.length ? ' ' + attrs.join(' ') : ''}>${parts.join('')}</a:ln>`;
}

/** Build wp:positionH and wp:positionV for floating drawings */
function serializePosition(pos: ImagePosition): string {
  const parts: string[] = [];

  // Horizontal
  const h = pos.horizontal;
  parts.push(`<wp:positionH relativeFrom="${h.relativeTo}">`);
  if (h.alignment) {
    parts.push(`<wp:align>${h.alignment}</wp:align>`);
  } else {
    parts.push(`<wp:posOffset>${h.posOffset || 0}</wp:posOffset>`);
  }
  parts.push('</wp:positionH>');

  // Vertical
  const v = pos.vertical;
  parts.push(`<wp:positionV relativeFrom="${v.relativeTo}">`);
  if (v.alignment) {
    parts.push(`<wp:align>${v.alignment}</wp:align>`);
  } else {
    parts.push(`<wp:posOffset>${v.posOffset || 0}</wp:posOffset>`);
  }
  parts.push('</wp:positionV>');

  return parts.join('');
}

/** Serialize wrap type to wp:wrap* element */
function serializeWrap(wrap: ImageWrap): string {
  const wrapText = wrap.wrapText ? ` wrapText="${wrap.wrapText}"` : ' wrapText="bothSides"';
  switch (wrap.type) {
    case 'square':
      return `<wp:wrapSquare${wrapText}/>`;
    case 'tight':
      return `<wp:wrapTight${wrapText}><wp:wrapPolygon edited="0"><wp:start x="0" y="0"/><wp:lineTo x="0" y="21600"/><wp:lineTo x="21600" y="21600"/><wp:lineTo x="21600" y="0"/><wp:lineTo x="0" y="0"/></wp:wrapPolygon></wp:wrapTight>`;
    case 'through':
      return `<wp:wrapThrough${wrapText}><wp:wrapPolygon edited="0"><wp:start x="0" y="0"/><wp:lineTo x="0" y="21600"/><wp:lineTo x="21600" y="21600"/><wp:lineTo x="21600" y="0"/><wp:lineTo x="0" y="0"/></wp:wrapPolygon></wp:wrapThrough>`;
    case 'topAndBottom':
      return '<wp:wrapTopAndBottom/>';
    case 'behind':
    case 'inFront':
      return '<wp:wrapNone/>';
    default:
      return '<wp:wrapNone/>';
  }
}

/** Build the common a:graphic > pic:pic element for images */
function serializePicGraphic(image: Image): string {
  const cx = image.size.width;
  const cy = image.size.height;
  const rId = image.rId || 'rId1';
  const id = image.id || '0';
  const name = image.filename || `image${id}`;

  let xfrmAttrs = '';
  if (image.transform?.rotation) {
    xfrmAttrs += ` rot="${Math.round(image.transform.rotation * 60000)}"`;
  }
  if (image.transform?.flipH) xfrmAttrs += ' flipH="1"';
  if (image.transform?.flipV) xfrmAttrs += ' flipV="1"';

  return [
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">',
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">',
    '<pic:nvPicPr>',
    `<pic:cNvPr id="${id}" name="${escapeXml(name)}"${image.alt ? ` descr="${escapeXml(image.alt)}"` : ''}/>`,
    '<pic:cNvPicPr/>',
    '</pic:nvPicPr>',
    '<pic:blipFill>',
    `<a:blip r:embed="${rId}"/>`,
    '<a:stretch><a:fillRect/></a:stretch>',
    '</pic:blipFill>',
    '<pic:spPr>',
    `<a:xfrm${xfrmAttrs}>`,
    '<a:off x="0" y="0"/>',
    `<a:ext cx="${cx}" cy="${cy}"/>`,
    '</a:xfrm>',
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>',
    image.outline ? serializeOutline(image.outline) : '',
    '</pic:spPr>',
    '</pic:pic>',
    '</a:graphicData>',
    '</a:graphic>',
  ].join('');
}

/**
 * Serialize drawing/image content (w:drawing) to full DrawingML XML
 */
function serializeDrawingContent(content: DrawingContent): string {
  const image = content.image;
  const isFloating = image.wrap.type !== 'inline';
  const cx = image.size.width;
  const cy = image.size.height;
  const distT = image.padding?.top ?? image.wrap.distT ?? 0;
  const distB = image.padding?.bottom ?? image.wrap.distB ?? 0;
  const distL = image.padding?.left ?? image.wrap.distL ?? 0;
  const distR = image.padding?.right ?? image.wrap.distR ?? 0;
  const docPrId = image.id || '1';
  const docPrName = image.title || image.filename || `Picture ${docPrId}`;

  const graphic = serializePicGraphic(image);

  if (!isFloating) {
    // Inline image
    return [
      '<w:drawing>',
      `<wp:inline distT="${distT}" distB="${distB}" distL="${distL}" distR="${distR}">`,
      `<wp:extent cx="${cx}" cy="${cy}"/>`,
      '<wp:effectExtent l="0" t="0" r="0" b="0"/>',
      `<wp:docPr id="${docPrId}" name="${escapeXml(docPrName)}"${image.alt ? ` descr="${escapeXml(image.alt)}"` : ''}${image.decorative ? ' hidden="1"' : ''}/>`,
      '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>',
      graphic,
      '</wp:inline>',
      '</w:drawing>',
    ].join('');
  }

  // Floating (anchored) image
  const behindDoc = image.wrap.type === 'behind' ? '1' : '0';
  const position = image.position
    ? serializePosition(image.position)
    : '<wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>';
  const wrap = serializeWrap(image.wrap);

  return [
    '<w:drawing>',
    `<wp:anchor distT="${distT}" distB="${distB}" distL="${distL}" distR="${distR}" simplePos="0" relativeHeight="251658240" behindDoc="${behindDoc}" locked="0" layoutInCell="1" allowOverlap="1">`,
    '<wp:simplePos x="0" y="0"/>',
    position,
    `<wp:extent cx="${cx}" cy="${cy}"/>`,
    '<wp:effectExtent l="0" t="0" r="0" b="0"/>',
    wrap,
    `<wp:docPr id="${docPrId}" name="${escapeXml(docPrName)}"${image.alt ? ` descr="${escapeXml(image.alt)}"` : ''}/>`,
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>',
    graphic,
    '</wp:anchor>',
    '</w:drawing>',
  ].join('');
}

/** Serialize text body content for shapes/textboxes */
function serializeShapeTextBody(paragraphs: Paragraph[]): string {
  return paragraphs.map((p) => serializeParagraph(p)).join('');
}

/**
 * Serialize shape content to full DrawingML XML (wps:wsp inside w:drawing)
 */
function serializeShapeContent(content: ShapeContent): string {
  const shape = content.shape;
  const cx = shape.size.width;
  const cy = shape.size.height;
  const isTextBox = shape.shapeType === 'textBox';
  const isFloating = shape.wrap && shape.wrap.type !== 'inline';
  const distT = shape.wrap?.distT ?? 0;
  const distB = shape.wrap?.distB ?? 0;
  const distL = shape.wrap?.distL ?? 0;
  const distR = shape.wrap?.distR ?? 0;
  const docPrId = shape.id || '1';
  const docPrName = shape.name || (isTextBox ? `TextBox ${docPrId}` : `Shape ${docPrId}`);

  // Build xfrm
  let xfrmAttrs = '';
  if (shape.transform?.rotation) {
    xfrmAttrs += ` rot="${Math.round(shape.transform.rotation * 60000)}"`;
  }
  if (shape.transform?.flipH) xfrmAttrs += ' flipH="1"';
  if (shape.transform?.flipV) xfrmAttrs += ' flipV="1"';

  // Build wps:spPr
  const spPr = [
    '<wps:spPr>',
    `<a:xfrm${xfrmAttrs}>`,
    '<a:off x="0" y="0"/>',
    `<a:ext cx="${cx}" cy="${cy}"/>`,
    '</a:xfrm>',
    `<a:prstGeom prst="${shape.shapeType === 'textBox' ? 'rect' : shape.shapeType}"><a:avLst/></a:prstGeom>`,
    serializeFill(shape.fill),
    serializeOutline(shape.outline),
    '</wps:spPr>',
  ].join('');

  // Build text body if present
  let textBody = '';
  if (shape.textBody) {
    const tb = shape.textBody;
    const bpAttrs: string[] = ['rot="0"', 'vert="horz"'];
    if (tb.anchor) bpAttrs.push(`anchor="${tb.anchor === 'middle' ? 'ctr' : tb.anchor}"`);
    if (tb.anchorCenter) bpAttrs.push('anchorCtr="1"');
    if (tb.margins) {
      if (tb.margins.left != null) bpAttrs.push(`lIns="${tb.margins.left}"`);
      if (tb.margins.top != null) bpAttrs.push(`tIns="${tb.margins.top}"`);
      if (tb.margins.right != null) bpAttrs.push(`rIns="${tb.margins.right}"`);
      if (tb.margins.bottom != null) bpAttrs.push(`bIns="${tb.margins.bottom}"`);
    }

    if (isTextBox) {
      textBody = [
        '<wps:txbx><w:txbxContent>',
        serializeShapeTextBody(tb.content),
        '</w:txbxContent></wps:txbx>',
        `<wps:bodyPr ${bpAttrs.join(' ')}/>`,
      ].join('');
    } else {
      textBody = [`<wps:bodyPr ${bpAttrs.join(' ')}/>`].join('');
    }
  }

  // Build wps:wsp
  const wsp = [
    '<wps:wsp>',
    `<wps:cNvSpPr${isTextBox ? ' txBox="1"' : ''}/>`,
    spPr,
    textBody,
    '</wps:wsp>',
  ].join('');

  // Wrap in a:graphic
  const graphic = [
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
    '<a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">',
    wsp,
    '</a:graphicData>',
    '</a:graphic>',
  ].join('');

  if (!isFloating) {
    return [
      '<w:drawing>',
      `<wp:inline distT="${distT}" distB="${distB}" distL="${distL}" distR="${distR}">`,
      `<wp:extent cx="${cx}" cy="${cy}"/>`,
      '<wp:effectExtent l="0" t="0" r="0" b="0"/>',
      `<wp:docPr id="${docPrId}" name="${escapeXml(docPrName)}"/>`,
      '<wp:cNvGraphicFramePr/>',
      graphic,
      '</wp:inline>',
      '</w:drawing>',
    ].join('');
  }

  // Floating shape
  const behindDoc = shape.wrap?.type === 'behind' ? '1' : '0';
  const position = shape.position
    ? serializePosition(shape.position)
    : '<wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>';
  const wrap = serializeWrap(shape.wrap!);

  return [
    '<w:drawing>',
    `<wp:anchor distT="${distT}" distB="${distB}" distL="${distL}" distR="${distR}" simplePos="0" relativeHeight="251658240" behindDoc="${behindDoc}" locked="0" layoutInCell="1" allowOverlap="1">`,
    '<wp:simplePos x="0" y="0"/>',
    position,
    `<wp:extent cx="${cx}" cy="${cy}"/>`,
    '<wp:effectExtent l="0" t="0" r="0" b="0"/>',
    wrap,
    `<wp:docPr id="${docPrId}" name="${escapeXml(docPrName)}"/>`,
    '<wp:cNvGraphicFramePr/>',
    graphic,
    '</wp:anchor>',
    '</w:drawing>',
  ].join('');
}

/**
 * Serialize a single run content item
 */
function serializeRunContent(content: RunContent): string {
  switch (content.type) {
    case 'text':
      return serializeTextContent(content);
    case 'tab':
      return serializeTabContent(content);
    case 'break':
      return serializeBreakContent(content);
    case 'symbol':
      return serializeSymbolContent(content);
    case 'footnoteRef':
    case 'endnoteRef':
      return serializeNoteReference(content);
    case 'fieldChar':
      return serializeFieldChar(content);
    case 'instrText':
      return serializeInstrText(content);
    case 'softHyphen':
      return serializeSoftHyphen(content);
    case 'noBreakHyphen':
      return serializeNoBreakHyphen(content);
    case 'drawing':
      return serializeDrawingContent(content);
    case 'shape':
      return serializeShapeContent(content);
    default:
      return '';
  }
}

// ============================================================================
// MAIN SERIALIZATION
// ============================================================================

/**
 * Serialize a run to OOXML XML (w:r)
 *
 * @param run - The run to serialize
 * @returns XML string for the run
 */
export function serializeRun(run: Run): string {
  const parts: string[] = [];

  // Add run properties if present
  const rPrXml = serializeTextFormatting(run.formatting);
  if (rPrXml) {
    parts.push(rPrXml);
  }

  // Add run content
  for (const content of run.content) {
    const contentXml = serializeRunContent(content);
    if (contentXml) {
      parts.push(contentXml);
    }
  }

  return `<w:r>${parts.join('')}</w:r>`;
}

/**
 * Serialize multiple runs to OOXML XML
 *
 * @param runs - The runs to serialize
 * @returns XML string for all runs
 */
export function serializeRuns(runs: Run[]): string {
  return runs.map(serializeRun).join('');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a run has any content
 */
export function hasRunContent(run: Run): boolean {
  return run.content.length > 0;
}

/**
 * Check if a run has formatting
 */
export function hasRunFormatting(run: Run): boolean {
  return run.formatting !== undefined && Object.keys(run.formatting).length > 0;
}

/**
 * Get plain text from a run (for comparison/debugging)
 */
export function getRunPlainText(run: Run): string {
  return run.content
    .filter((c): c is TextContent => c.type === 'text')
    .map((c) => c.text)
    .join('');
}

/**
 * Create an empty run
 */
export function createEmptyRun(): Run {
  return {
    type: 'run',
    content: [],
  };
}

/**
 * Create a text run
 */
export function createTextRun(text: string, formatting?: TextFormatting): Run {
  return {
    type: 'run',
    formatting,
    content: [{ type: 'text', text }],
  };
}

/**
 * Create a break run
 */
export function createBreakRun(
  breakType?: 'page' | 'column' | 'textWrapping',
  formatting?: TextFormatting
): Run {
  return {
    type: 'run',
    formatting,
    content: [{ type: 'break', breakType }],
  };
}

/**
 * Create a tab run
 */
export function createTabRun(formatting?: TextFormatting): Run {
  return {
    type: 'run',
    formatting,
    content: [{ type: 'tab' }],
  };
}

export default serializeRun;
