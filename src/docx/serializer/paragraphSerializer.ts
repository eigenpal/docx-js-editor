/**
 * Paragraph Serializer - Serialize paragraphs to OOXML XML
 *
 * Converts Paragraph objects back to <w:p> XML format for DOCX files.
 * Handles all paragraph properties and child content (runs, hyperlinks, fields, bookmarks).
 *
 * OOXML Reference:
 * - Paragraph: w:p
 * - Paragraph properties: w:pPr
 * - Runs, hyperlinks, bookmarks, fields as child elements
 */

import type {
  Paragraph,
  ParagraphContent,
  ParagraphFormatting,
  Hyperlink,
  BookmarkStart,
  BookmarkEnd,
  SimpleField,
  ComplexField,
  InlineSdt,
  Insertion,
  Deletion,
  TabStop,
  BorderSpec,
  ShadingProperties,
  TextFormatting,
} from '../../types/document';

import { serializeRun, serializeTextFormatting } from './runSerializer';

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
// BORDER SERIALIZATION
// ============================================================================

/**
 * Serialize a single border element
 */
function serializeBorder(border: BorderSpec | undefined, elementName: string): string {
  if (!border || border.style === 'none' || border.style === 'nil') {
    return '';
  }

  const attrs: string[] = [`w:val="${border.style}"`];

  if (border.size !== undefined) {
    attrs.push(`w:sz="${border.size}"`);
  }

  if (border.space !== undefined) {
    attrs.push(`w:space="${border.space}"`);
  }

  // Color
  if (border.color) {
    if (border.color.auto) {
      attrs.push('w:color="auto"');
    } else if (border.color.rgb) {
      attrs.push(`w:color="${border.color.rgb}"`);
    }

    if (border.color.themeColor) {
      attrs.push(`w:themeColor="${border.color.themeColor}"`);
    }

    if (border.color.themeTint) {
      attrs.push(`w:themeTint="${border.color.themeTint}"`);
    }

    if (border.color.themeShade) {
      attrs.push(`w:themeShade="${border.color.themeShade}"`);
    }
  }

  if (border.shadow) {
    attrs.push('w:shadow="true"');
  }

  if (border.frame) {
    attrs.push('w:frame="true"');
  }

  return `<w:${elementName} ${attrs.join(' ')}/>`;
}

/**
 * Serialize paragraph borders (w:pBdr)
 */
function serializeParagraphBorders(borders: ParagraphFormatting['borders']): string {
  if (!borders) return '';

  const parts: string[] = [];

  if (borders.top) {
    const topXml = serializeBorder(borders.top, 'top');
    if (topXml) parts.push(topXml);
  }

  if (borders.left) {
    const leftXml = serializeBorder(borders.left, 'left');
    if (leftXml) parts.push(leftXml);
  }

  if (borders.bottom) {
    const bottomXml = serializeBorder(borders.bottom, 'bottom');
    if (bottomXml) parts.push(bottomXml);
  }

  if (borders.right) {
    const rightXml = serializeBorder(borders.right, 'right');
    if (rightXml) parts.push(rightXml);
  }

  if (borders.between) {
    const betweenXml = serializeBorder(borders.between, 'between');
    if (betweenXml) parts.push(betweenXml);
  }

  if (borders.bar) {
    const barXml = serializeBorder(borders.bar, 'bar');
    if (barXml) parts.push(barXml);
  }

  if (parts.length === 0) return '';

  return `<w:pBdr>${parts.join('')}</w:pBdr>`;
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
// TAB STOPS SERIALIZATION
// ============================================================================

/**
 * Serialize tab stops (w:tabs)
 */
function serializeTabStops(tabs: TabStop[] | undefined): string {
  if (!tabs || tabs.length === 0) return '';

  const tabElements = tabs.map((tab) => {
    const attrs: string[] = [`w:val="${tab.alignment}"`, `w:pos="${tab.position}"`];

    if (tab.leader && tab.leader !== 'none') {
      attrs.push(`w:leader="${tab.leader}"`);
    }

    return `<w:tab ${attrs.join(' ')}/>`;
  });

  return `<w:tabs>${tabElements.join('')}</w:tabs>`;
}

// ============================================================================
// SPACING SERIALIZATION
// ============================================================================

/**
 * Serialize spacing properties (w:spacing)
 */
function serializeSpacing(formatting: ParagraphFormatting): string {
  const attrs: string[] = [];

  if (formatting.spaceBefore !== undefined) {
    attrs.push(`w:before="${formatting.spaceBefore}"`);
  }

  if (formatting.spaceAfter !== undefined) {
    attrs.push(`w:after="${formatting.spaceAfter}"`);
  }

  if (formatting.lineSpacing !== undefined) {
    attrs.push(`w:line="${formatting.lineSpacing}"`);
  }

  if (formatting.lineSpacingRule) {
    attrs.push(`w:lineRule="${formatting.lineSpacingRule}"`);
  }

  if (formatting.beforeAutospacing) {
    attrs.push('w:beforeAutospacing="1"');
  }

  if (formatting.afterAutospacing) {
    attrs.push('w:afterAutospacing="1"');
  }

  if (attrs.length === 0) return '';

  return `<w:spacing ${attrs.join(' ')}/>`;
}

// ============================================================================
// INDENTATION SERIALIZATION
// ============================================================================

/**
 * Serialize indentation properties (w:ind)
 */
function serializeIndentation(formatting: ParagraphFormatting): string {
  const attrs: string[] = [];

  if (formatting.indentLeft !== undefined) {
    attrs.push(`w:left="${formatting.indentLeft}"`);
  }

  if (formatting.indentRight !== undefined) {
    attrs.push(`w:right="${formatting.indentRight}"`);
  }

  if (formatting.indentFirstLine !== undefined) {
    if (formatting.hangingIndent) {
      // Hanging indent is stored as positive value but uses w:hanging attribute
      attrs.push(`w:hanging="${Math.abs(formatting.indentFirstLine)}"`);
    } else if (formatting.indentFirstLine !== 0) {
      attrs.push(`w:firstLine="${formatting.indentFirstLine}"`);
    }
  }

  if (attrs.length === 0) return '';

  return `<w:ind ${attrs.join(' ')}/>`;
}

// ============================================================================
// NUMBERING SERIALIZATION
// ============================================================================

/**
 * Serialize numbering properties (w:numPr)
 */
function serializeNumbering(numPr: ParagraphFormatting['numPr']): string {
  if (!numPr) return '';

  const parts: string[] = [];

  if (numPr.ilvl !== undefined) {
    parts.push(`<w:ilvl w:val="${numPr.ilvl}"/>`);
  }

  if (numPr.numId !== undefined) {
    parts.push(`<w:numId w:val="${numPr.numId}"/>`);
  }

  if (parts.length === 0) return '';

  return `<w:numPr>${parts.join('')}</w:numPr>`;
}

// ============================================================================
// FRAME PROPERTIES SERIALIZATION
// ============================================================================

/**
 * Serialize frame properties (w:framePr)
 */
function serializeFrameProperties(frame: ParagraphFormatting['frame']): string {
  if (!frame) return '';

  const attrs: string[] = [];

  if (frame.width !== undefined) {
    attrs.push(`w:w="${frame.width}"`);
  }

  if (frame.height !== undefined) {
    attrs.push(`w:h="${frame.height}"`);
  }

  if (frame.hAnchor) {
    attrs.push(`w:hAnchor="${frame.hAnchor}"`);
  }

  if (frame.vAnchor) {
    attrs.push(`w:vAnchor="${frame.vAnchor}"`);
  }

  if (frame.x !== undefined) {
    attrs.push(`w:x="${frame.x}"`);
  }

  if (frame.y !== undefined) {
    attrs.push(`w:y="${frame.y}"`);
  }

  if (frame.xAlign) {
    attrs.push(`w:xAlign="${frame.xAlign}"`);
  }

  if (frame.yAlign) {
    attrs.push(`w:yAlign="${frame.yAlign}"`);
  }

  if (frame.wrap) {
    attrs.push(`w:wrap="${frame.wrap}"`);
  }

  if (attrs.length === 0) return '';

  return `<w:framePr ${attrs.join(' ')}/>`;
}

// ============================================================================
// PARAGRAPH PROPERTIES SERIALIZATION
// ============================================================================

/**
 * Serialize paragraph formatting properties to w:pPr XML
 */
export function serializeParagraphFormatting(formatting: ParagraphFormatting | undefined): string {
  if (!formatting) return '';

  const parts: string[] = [];

  // Style reference (must be first)
  if (formatting.styleId) {
    parts.push(`<w:pStyle w:val="${escapeXml(formatting.styleId)}"/>`);
  }

  // Keep next/lines/widow
  if (formatting.keepNext) {
    parts.push('<w:keepNext/>');
  }

  if (formatting.keepLines) {
    parts.push('<w:keepLines/>');
  }

  if (formatting.pageBreakBefore) {
    parts.push('<w:pageBreakBefore/>');
  }

  // Frame properties
  const frameXml = serializeFrameProperties(formatting.frame);
  if (frameXml) {
    parts.push(frameXml);
  }

  // Widow control
  if (formatting.widowControl === false) {
    parts.push('<w:widowControl w:val="0"/>');
  } else if (formatting.widowControl === true) {
    parts.push('<w:widowControl/>');
  }

  // Numbering
  const numPrXml = serializeNumbering(formatting.numPr);
  if (numPrXml) {
    parts.push(numPrXml);
  }

  // Paragraph borders
  const bordersXml = serializeParagraphBorders(formatting.borders);
  if (bordersXml) {
    parts.push(bordersXml);
  }

  // Shading
  const shadingXml = serializeShading(formatting.shading);
  if (shadingXml) {
    parts.push(shadingXml);
  }

  // Tabs
  const tabsXml = serializeTabStops(formatting.tabs);
  if (tabsXml) {
    parts.push(tabsXml);
  }

  // Suppress line numbers
  if (formatting.suppressLineNumbers) {
    parts.push('<w:suppressLineNumbers/>');
  }

  // Suppress auto hyphens
  if (formatting.suppressAutoHyphens) {
    parts.push('<w:suppressAutoHyphens/>');
  }

  // Spacing
  const spacingXml = serializeSpacing(formatting);
  if (spacingXml) {
    parts.push(spacingXml);
  }

  // Indentation
  const indXml = serializeIndentation(formatting);
  if (indXml) {
    parts.push(indXml);
  }

  // Text direction (bidi)
  if (formatting.bidi) {
    parts.push('<w:bidi/>');
  }

  // Justification
  if (formatting.alignment) {
    parts.push(`<w:jc w:val="${formatting.alignment}"/>`);
  }

  // Outline level
  if (formatting.outlineLevel !== undefined) {
    parts.push(`<w:outlineLvl w:val="${formatting.outlineLevel}"/>`);
  }

  // Run properties (default run formatting for paragraph)
  if (formatting.runProperties) {
    const rPrXml = serializeTextFormatting(formatting.runProperties);
    if (rPrXml) {
      parts.push(rPrXml);
    }
  }

  if (parts.length === 0) return '';

  return `<w:pPr>${parts.join('')}</w:pPr>`;
}

// ============================================================================
// CONTENT SERIALIZATION
// ============================================================================

/**
 * Serialize a hyperlink (w:hyperlink)
 */
function serializeHyperlink(hyperlink: Hyperlink): string {
  const attrs: string[] = [];

  if (hyperlink.rId) {
    attrs.push(`r:id="${hyperlink.rId}"`);
  }

  if (hyperlink.anchor) {
    attrs.push(`w:anchor="${escapeXml(hyperlink.anchor)}"`);
  }

  if (hyperlink.tooltip) {
    attrs.push(`w:tooltip="${escapeXml(hyperlink.tooltip)}"`);
  }

  if (hyperlink.target) {
    attrs.push(`w:tgtFrame="${escapeXml(hyperlink.target)}"`);
  }

  if (hyperlink.history === false) {
    attrs.push('w:history="0"');
  }

  if (hyperlink.docLocation) {
    attrs.push(`w:docLocation="${escapeXml(hyperlink.docLocation)}"`);
  }

  // Serialize children
  const childrenXml = hyperlink.children
    .map((child) => {
      if (child.type === 'run') {
        return serializeRun(child);
      } else if (child.type === 'bookmarkStart') {
        return serializeBookmarkStart(child);
      } else if (child.type === 'bookmarkEnd') {
        return serializeBookmarkEnd(child);
      }
      return '';
    })
    .join('');

  const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
  return `<w:hyperlink${attrsStr}>${childrenXml}</w:hyperlink>`;
}

/**
 * Serialize bookmark start (w:bookmarkStart)
 */
function serializeBookmarkStart(bookmark: BookmarkStart): string {
  const attrs: string[] = [`w:id="${bookmark.id}"`, `w:name="${escapeXml(bookmark.name)}"`];

  if (bookmark.colFirst !== undefined) {
    attrs.push(`w:colFirst="${bookmark.colFirst}"`);
  }

  if (bookmark.colLast !== undefined) {
    attrs.push(`w:colLast="${bookmark.colLast}"`);
  }

  return `<w:bookmarkStart ${attrs.join(' ')}/>`;
}

/**
 * Serialize bookmark end (w:bookmarkEnd)
 */
function serializeBookmarkEnd(bookmark: BookmarkEnd): string {
  return `<w:bookmarkEnd w:id="${bookmark.id}"/>`;
}

/**
 * Serialize a simple field (w:fldSimple)
 */
function serializeSimpleField(field: SimpleField): string {
  const attrs: string[] = [`w:instr="${escapeXml(field.instruction)}"`];

  if (field.fldLock) {
    attrs.push('w:fldLock="true"');
  }

  if (field.dirty) {
    attrs.push('w:dirty="true"');
  }

  // Serialize content
  const contentXml = field.content
    .map((item) => {
      if (item.type === 'run') {
        return serializeRun(item);
      } else if (item.type === 'hyperlink') {
        return serializeHyperlink(item);
      }
      return '';
    })
    .join('');

  return `<w:fldSimple ${attrs.join(' ')}>${contentXml}</w:fldSimple>`;
}

/**
 * Serialize a complex field
 * Complex fields are represented by multiple runs with fldChar elements,
 * so we convert them back to that structure
 */
function serializeComplexField(field: ComplexField): string {
  const parts: string[] = [];

  // Begin field character
  const beginAttrs: string[] = ['w:fldCharType="begin"'];
  if (field.fldLock) {
    beginAttrs.push('w:fldLock="true"');
  }
  if (field.dirty) {
    beginAttrs.push('w:dirty="true"');
  }
  parts.push(`<w:r><w:fldChar ${beginAttrs.join(' ')}/></w:r>`);

  // Field code (instrText)
  if (field.fieldCode.length > 0) {
    parts.push(...field.fieldCode.map((run) => serializeRun(run)));
  } else {
    // Fallback: create instrText from instruction
    const needsPreserve =
      field.instruction.startsWith(' ') ||
      field.instruction.endsWith(' ') ||
      field.instruction.includes('  ');
    const spaceAttr = needsPreserve ? ' xml:space="preserve"' : '';
    parts.push(`<w:r><w:instrText${spaceAttr}>${escapeXml(field.instruction)}</w:instrText></w:r>`);
  }

  // Separate field character
  parts.push('<w:r><w:fldChar w:fldCharType="separate"/></w:r>');

  // Field result
  parts.push(...field.fieldResult.map((run) => serializeRun(run)));

  // End field character
  parts.push('<w:r><w:fldChar w:fldCharType="end"/></w:r>');

  return parts.join('');
}

/**
 * Serialize an inline SDT (w:sdt)
 */
function serializeInlineSdt(sdt: InlineSdt): string {
  const props = sdt.properties;
  const prParts: string[] = [];

  if (props.alias) prParts.push(`<w:alias w:val="${escapeXml(props.alias)}"/>`);
  if (props.tag) prParts.push(`<w:tag w:val="${escapeXml(props.tag)}"/>`);
  if (props.lock && props.lock !== 'unlocked') prParts.push(`<w:lock w:val="${props.lock}"/>`);
  if (props.showingPlaceholder) prParts.push('<w:showingPlcHdr/>');

  // Type-specific properties
  switch (props.sdtType) {
    case 'plainText':
      prParts.push('<w:text/>');
      break;
    case 'date':
      if (props.dateFormat) {
        prParts.push(`<w:date w:fullDate="${escapeXml(props.dateFormat)}"/>`);
      } else {
        prParts.push('<w:date/>');
      }
      break;
    case 'dropdown': {
      const items = (props.listItems ?? [])
        .map(
          (i) =>
            `<w:listItem w:displayText="${escapeXml(i.displayText)}" w:value="${escapeXml(i.value)}"/>`
        )
        .join('');
      prParts.push(`<w:dropDownList>${items}</w:dropDownList>`);
      break;
    }
    case 'comboBox': {
      const items = (props.listItems ?? [])
        .map(
          (i) =>
            `<w:listItem w:displayText="${escapeXml(i.displayText)}" w:value="${escapeXml(i.value)}"/>`
        )
        .join('');
      prParts.push(`<w:comboBox>${items}</w:comboBox>`);
      break;
    }
    case 'checkbox':
      prParts.push(
        `<w14:checkbox><w14:checked w14:val="${props.checked ? '1' : '0'}"/></w14:checkbox>`
      );
      break;
    case 'picture':
      prParts.push('<w:picture/>');
      break;
  }

  const contentXml = sdt.content
    .map((item) => {
      if (item.type === 'run') return serializeRun(item);
      if (item.type === 'hyperlink') return serializeHyperlink(item);
      return '';
    })
    .join('');

  return `<w:sdt><w:sdtPr>${prParts.join('')}</w:sdtPr><w:sdtContent>${contentXml}</w:sdtContent></w:sdt>`;
}

/**
 * Serialize a tracked change (insertion or deletion) wrapper
 */
function serializeTrackedChange(tag: 'ins' | 'del', change: Insertion | Deletion): string {
  const info = change.info;
  const attrs = [`w:id="${info.id}"`, `w:author="${escapeXml(info.author)}"`];
  if (info.date) attrs.push(`w:date="${escapeXml(info.date)}"`);

  const contentXml = change.content
    .map((item) => {
      if (item.type === 'run') return serializeRun(item);
      if (item.type === 'hyperlink') return serializeHyperlink(item);
      return '';
    })
    .join('');

  return `<w:${tag} ${attrs.join(' ')}>${contentXml}</w:${tag}>`;
}

/**
 * Serialize a single paragraph content item
 */
function serializeParagraphContent(content: ParagraphContent): string {
  switch (content.type) {
    case 'run':
      return serializeRun(content);
    case 'hyperlink':
      return serializeHyperlink(content);
    case 'bookmarkStart':
      return serializeBookmarkStart(content);
    case 'bookmarkEnd':
      return serializeBookmarkEnd(content);
    case 'simpleField':
      return serializeSimpleField(content);
    case 'complexField':
      return serializeComplexField(content);
    case 'inlineSdt':
      return serializeInlineSdt(content);
    case 'commentRangeStart':
      return `<w:commentRangeStart w:id="${content.id}"/>`;
    case 'commentRangeEnd':
      return `<w:commentRangeEnd w:id="${content.id}"/>`;
    case 'insertion':
      return serializeTrackedChange('ins', content);
    case 'deletion':
      return serializeTrackedChange('del', content);
    default:
      return '';
  }
}

// ============================================================================
// MAIN SERIALIZATION
// ============================================================================

/**
 * Serialize a paragraph to OOXML XML (w:p)
 *
 * @param paragraph - The paragraph to serialize
 * @returns XML string for the paragraph
 */
export function serializeParagraph(paragraph: Paragraph): string {
  const parts: string[] = [];

  // Paragraph ID attributes
  const attrs: string[] = [];
  if (paragraph.paraId) {
    attrs.push(`w14:paraId="${paragraph.paraId}"`);
  }
  if (paragraph.textId) {
    attrs.push(`w14:textId="${paragraph.textId}"`);
  }
  const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  // Add paragraph properties if present
  const pPrXml = serializeParagraphFormatting(paragraph.formatting);
  if (pPrXml) {
    parts.push(pPrXml);
  }

  // Add paragraph content
  for (const content of paragraph.content) {
    const contentXml = serializeParagraphContent(content);
    if (contentXml) {
      parts.push(contentXml);
    }
  }

  return `<w:p${attrsStr}>${parts.join('')}</w:p>`;
}

/**
 * Serialize multiple paragraphs to OOXML XML
 *
 * @param paragraphs - The paragraphs to serialize
 * @returns XML string for all paragraphs
 */
export function serializeParagraphs(paragraphs: Paragraph[]): string {
  return paragraphs.map(serializeParagraph).join('');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a paragraph has any content
 */
export function hasParagraphContent(paragraph: Paragraph): boolean {
  return paragraph.content.length > 0;
}

/**
 * Check if a paragraph has formatting
 */
export function hasParagraphFormatting(paragraph: Paragraph): boolean {
  return paragraph.formatting !== undefined && Object.keys(paragraph.formatting).length > 0;
}

/**
 * Get plain text from a paragraph (for comparison/debugging)
 */
export function getParagraphPlainText(paragraph: Paragraph): string {
  const texts: string[] = [];

  for (const content of paragraph.content) {
    if (content.type === 'run') {
      for (const item of content.content) {
        if (item.type === 'text') {
          texts.push(item.text);
        } else if (item.type === 'tab') {
          texts.push('\t');
        } else if (item.type === 'break') {
          texts.push('\n');
        }
      }
    } else if (content.type === 'hyperlink') {
      for (const child of content.children) {
        if (child.type === 'run') {
          for (const item of child.content) {
            if (item.type === 'text') {
              texts.push(item.text);
            }
          }
        }
      }
    } else if (content.type === 'simpleField') {
      for (const item of content.content) {
        if (item.type === 'run') {
          for (const subItem of item.content) {
            if (subItem.type === 'text') {
              texts.push(subItem.text);
            }
          }
        }
      }
    } else if (content.type === 'complexField') {
      for (const run of content.fieldResult) {
        for (const item of run.content) {
          if (item.type === 'text') {
            texts.push(item.text);
          }
        }
      }
    } else if (content.type === 'inlineSdt') {
      for (const item of content.content) {
        if (item.type === 'run') {
          for (const subItem of item.content) {
            if (subItem.type === 'text') {
              texts.push(subItem.text);
            }
          }
        }
      }
    } else if (content.type === 'insertion' || content.type === 'deletion') {
      for (const item of content.content) {
        if (item.type === 'run') {
          for (const subItem of item.content) {
            if (subItem.type === 'text') {
              texts.push(subItem.text);
            }
          }
        }
      }
    }
  }

  return texts.join('');
}

/**
 * Create an empty paragraph
 */
export function createEmptyParagraph(formatting?: ParagraphFormatting): Paragraph {
  return {
    type: 'paragraph',
    formatting,
    content: [],
  };
}

/**
 * Create a paragraph with a single text run
 */
export function createTextParagraph(
  text: string,
  paragraphFormatting?: ParagraphFormatting,
  textFormatting?: TextFormatting
): Paragraph {
  return {
    type: 'paragraph',
    formatting: paragraphFormatting,
    content: [
      {
        type: 'run',
        formatting: textFormatting,
        content: [{ type: 'text', text }],
      },
    ],
  };
}

/**
 * Check if paragraph is a list item
 */
export function isListParagraph(paragraph: Paragraph): boolean {
  return paragraph.formatting?.numPr !== undefined;
}

/**
 * Get list level of a paragraph (0-8, or -1 if not a list)
 */
export function getListLevel(paragraph: Paragraph): number {
  return paragraph.formatting?.numPr?.ilvl ?? -1;
}

export default serializeParagraph;
