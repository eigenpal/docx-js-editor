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
  UnderlineStyle,
  Image,
  Shape,
} from '../../types/document';

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
 * Serialize a color value to XML attributes
 */
function serializeColorAttributes(
  color: ColorValue | undefined,
  prefix: string = ''
): string {
  if (!color) return '';

  const attrs: string[] = [];

  if (color.auto) {
    attrs.push(`w:${prefix}val="auto"`);
  } else if (color.rgb) {
    attrs.push(`w:${prefix}val="${color.rgb}"`);
  }

  if (color.themeColor) {
    const themeAttr = prefix ? `${prefix}themeColor` : 'themeColor';
    attrs.push(`w:${themeAttr}="${color.themeColor}"`);
  }

  if (color.themeTint) {
    const tintAttr = prefix ? `${prefix}themeTint` : 'themeTint';
    attrs.push(`w:${tintAttr}="${color.themeTint}"`);
  }

  if (color.themeShade) {
    const shadeAttr = prefix ? `${prefix}themeShade` : 'themeShade';
    attrs.push(`w:${shadeAttr}="${color.themeShade}"`);
  }

  return attrs.join(' ');
}

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
  const needsPreserve = content.preserveSpace ||
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
  const needsPreserve = content.text.startsWith(' ') ||
    content.text.endsWith(' ') ||
    content.text.includes('  ');

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

/**
 * Serialize drawing/image content (w:drawing)
 * Note: Full image serialization requires additional work on drawing XML
 * This provides a placeholder structure
 */
function serializeDrawingContent(content: DrawingContent): string {
  // TODO: Implement full drawing serialization with inline/anchor, extent, docPr, etc.
  // For now, return a comment placeholder indicating where image would go
  if (content.image.rId) {
    return `<!-- Drawing with rId="${content.image.rId}" -->`;
  }
  return '<!-- Drawing placeholder -->';
}

/**
 * Serialize shape content
 * Note: Full shape serialization requires additional work
 */
function serializeShapeContent(content: ShapeContent): string {
  // TODO: Implement full shape serialization
  return `<!-- Shape: ${content.shape.shapeType || 'unknown'} -->`;
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
    .map(c => c.text)
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
export function createTextRun(
  text: string,
  formatting?: TextFormatting
): Run {
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
