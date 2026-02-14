/**
 * Paragraph Parser - Parse paragraphs (w:p) with complete formatting
 *
 * A paragraph is the fundamental block-level element containing text runs,
 * hyperlinks, bookmarks, and fields.
 *
 * OOXML Reference:
 * - Paragraph: w:p
 * - Paragraph properties: w:pPr
 * - Content: runs, hyperlinks, bookmarks, fields
 */

import type {
  Paragraph,
  ParagraphContent,
  ParagraphFormatting,
  Run,
  Hyperlink,
  BookmarkStart,
  BookmarkEnd,
  SimpleField,
  ComplexField,
  FieldType,
  Theme,
  ColorValue,
  BorderSpec,
  ShadingProperties,
  TabStop,
  TabStopAlignment,
  TabLeader,
  LineSpacingRule,
  ParagraphAlignment,
  RelationshipMap,
  MediaFile,
  InlineSdt,
  SdtProperties,
  Insertion,
  Deletion,
  TrackedChangeInfo,
  MathEquation,
} from '../types/document';
import type { StyleMap } from './styleParser';
import type { NumberingMap } from './numberingParser';
import {
  findChild,
  findChildren,
  getAttribute,
  getChildElements,
  parseBooleanElement,
  parseNumericAttribute,
  elementToXml,
  type XmlElement,
} from './xmlParser';
import { parseRun, parseRunProperties } from './runParser';
import { parseHyperlink as parseHyperlinkFromModule } from './hyperlinkParser';
import {
  parseBookmarkStart as parseBookmarkStartFromModule,
  parseBookmarkEnd as parseBookmarkEndFromModule,
} from './bookmarkParser';
import { parseSectionProperties } from './sectionParser';
import { consolidateParagraphContent } from './runConsolidator';

// ============================================================================
// SDT PROPERTIES PARSER
// ============================================================================

/**
 * Parse SDT properties (w:sdtPr) element
 */
function parseSdtProperties(sdtPr: XmlElement | null): SdtProperties {
  const props: SdtProperties = { sdtType: 'richText' };
  if (!sdtPr || !sdtPr.elements) return props;

  for (const el of sdtPr.elements) {
    if (el.type !== 'element') continue;
    const name = el.name?.replace(/^w:/, '') ?? '';

    switch (name) {
      case 'alias':
        props.alias = getAttribute(el, 'w', 'val') ?? undefined;
        break;
      case 'tag':
        props.tag = getAttribute(el, 'w', 'val') ?? undefined;
        break;
      case 'lock':
        props.lock = (getAttribute(el, 'w', 'val') ?? 'unlocked') as SdtProperties['lock'];
        break;
      case 'placeholder': {
        const docPart = findChild(el, 'w', 'docPart');
        if (docPart) {
          const valEl = findChild(docPart, 'w', 'val');
          props.placeholder = valEl ? (getAttribute(valEl, 'w', 'val') ?? undefined) : undefined;
        }
        break;
      }
      case 'showingPlcHdr':
        props.showingPlaceholder = true;
        break;
      case 'text':
        props.sdtType = 'plainText';
        break;
      case 'date':
        props.sdtType = 'date';
        props.dateFormat = getAttribute(el, 'w', 'fullDate') ?? undefined;
        break;
      case 'dropDownList':
        props.sdtType = 'dropdown';
        props.listItems = parseListItems(el);
        break;
      case 'comboBox':
        props.sdtType = 'comboBox';
        props.listItems = parseListItems(el);
        break;
      case 'checkbox': {
        props.sdtType = 'checkbox';
        const checked = findChild(el, 'w14', 'checked') ?? findChild(el, 'w', 'checked');
        props.checked = checked
          ? getAttribute(checked, 'w14', 'val') === '1' || getAttribute(checked, 'w', 'val') === '1'
          : false;
        break;
      }
      case 'picture':
        props.sdtType = 'picture';
        break;
      case 'docPartObj':
        props.sdtType = 'buildingBlockGallery';
        break;
      case 'group':
        props.sdtType = 'group';
        break;
    }
  }

  return props;
}

function parseListItems(el: XmlElement): { displayText: string; value: string }[] {
  const items: { displayText: string; value: string }[] = [];
  for (const child of el.elements ?? []) {
    if (
      child.type === 'element' &&
      (child.name === 'w:listItem' || child.name?.endsWith(':listItem'))
    ) {
      items.push({
        displayText: getAttribute(child, 'w', 'displayText') ?? '',
        value: getAttribute(child, 'w', 'value') ?? '',
      });
    }
  }
  return items;
}

/**
 * Extract plain text from a math element (recursive text content extraction)
 */
function extractMathText(el: XmlElement): string {
  let text = '';
  if (el.type === 'text' && typeof el.text === 'string') {
    return el.text;
  }
  if (el.elements) {
    for (const child of el.elements) {
      // m:t elements contain the actual math text
      const childName = child.name?.replace(/^.*:/, '') ?? '';
      if (childName === 't' && child.elements) {
        for (const t of child.elements) {
          if (t.type === 'text' && typeof t.text === 'string') {
            text += t.text;
          }
        }
      } else {
        text += extractMathText(child);
      }
    }
  }
  return text;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse color value from attributes
 */
function parseColorValue(
  rgb: string | null,
  themeColor: string | null,
  themeTint: string | null,
  themeShade: string | null
): ColorValue {
  const color: ColorValue = {};

  if (rgb && rgb !== 'auto') {
    color.rgb = rgb;
  } else if (rgb === 'auto') {
    color.auto = true;
  }

  if (themeColor) {
    color.themeColor = themeColor as ColorValue['themeColor'];
  }

  if (themeTint) {
    color.themeTint = themeTint;
  }

  if (themeShade) {
    color.themeShade = themeShade;
  }

  return color;
}

/**
 * Parse shading properties (w:shd)
 */
function parseShadingProperties(shd: XmlElement | null): ShadingProperties | undefined {
  if (!shd) return undefined;

  const props: ShadingProperties = {};

  const color = getAttribute(shd, 'w', 'color');
  if (color && color !== 'auto') {
    props.color = { rgb: color };
  }

  const fill = getAttribute(shd, 'w', 'fill');
  if (fill && fill !== 'auto') {
    props.fill = { rgb: fill };
  }

  const themeFill = getAttribute(shd, 'w', 'themeFill');
  if (themeFill) {
    props.fill = props.fill || {};
    props.fill.themeColor = themeFill as ColorValue['themeColor'];
  }

  const themeFillTint = getAttribute(shd, 'w', 'themeFillTint');
  if (themeFillTint && props.fill) {
    props.fill.themeTint = themeFillTint;
  }

  const themeFillShade = getAttribute(shd, 'w', 'themeFillShade');
  if (themeFillShade && props.fill) {
    props.fill.themeShade = themeFillShade;
  }

  const pattern = getAttribute(shd, 'w', 'val');
  if (pattern) {
    props.pattern = pattern as ShadingProperties['pattern'];
  }

  return Object.keys(props).length > 0 ? props : undefined;
}

/**
 * Parse border specification (w:top, w:bottom, w:left, w:right, etc.)
 */
function parseBorderSpec(border: XmlElement | null): BorderSpec | undefined {
  if (!border) return undefined;

  const style = getAttribute(border, 'w', 'val');
  if (!style) return undefined;

  const spec: BorderSpec = {
    style: style as BorderSpec['style'],
  };

  const colorVal = getAttribute(border, 'w', 'color');
  const themeColor = getAttribute(border, 'w', 'themeColor');
  if (colorVal || themeColor) {
    spec.color = parseColorValue(
      colorVal,
      themeColor,
      getAttribute(border, 'w', 'themeTint'),
      getAttribute(border, 'w', 'themeShade')
    );
  }

  const sz = parseNumericAttribute(border, 'w', 'sz');
  if (sz !== undefined) spec.size = sz;

  const space = parseNumericAttribute(border, 'w', 'space');
  if (space !== undefined) spec.space = space;

  const shadowAttr = getAttribute(border, 'w', 'shadow');
  if (shadowAttr) spec.shadow = shadowAttr === '1' || shadowAttr === 'true';

  const frame = getAttribute(border, 'w', 'frame');
  if (frame) spec.frame = frame === '1' || frame === 'true';

  return spec;
}

/**
 * Parse tab stops (w:tabs)
 */
function parseTabStops(tabs: XmlElement | null): TabStop[] | undefined {
  if (!tabs) return undefined;

  const tabElements = findChildren(tabs, 'w', 'tab');
  if (tabElements.length === 0) return undefined;

  const result: TabStop[] = [];

  for (const tab of tabElements) {
    const pos = parseNumericAttribute(tab, 'w', 'pos');
    const val = getAttribute(tab, 'w', 'val');

    if (pos !== undefined && val) {
      const tabStop: TabStop = {
        position: pos,
        alignment: val as TabStopAlignment,
      };

      const leader = getAttribute(tab, 'w', 'leader');
      if (leader) {
        tabStop.leader = leader as TabLeader;
      }

      result.push(tabStop);
    }
  }

  return result.length > 0 ? result : undefined;
}

/**
 * Parse frame properties (w:framePr)
 */
function parseFrameProperties(
  framePr: XmlElement | null
): ParagraphFormatting['frame'] | undefined {
  if (!framePr) return undefined;

  const frame: ParagraphFormatting['frame'] = {};

  const w = parseNumericAttribute(framePr, 'w', 'w');
  if (w !== undefined) frame.width = w;

  const h = parseNumericAttribute(framePr, 'w', 'h');
  if (h !== undefined) frame.height = h;

  const hAnchor = getAttribute(framePr, 'w', 'hAnchor');
  if (hAnchor === 'text' || hAnchor === 'margin' || hAnchor === 'page') {
    frame.hAnchor = hAnchor;
  }

  const vAnchor = getAttribute(framePr, 'w', 'vAnchor');
  if (vAnchor === 'text' || vAnchor === 'margin' || vAnchor === 'page') {
    frame.vAnchor = vAnchor;
  }

  const x = parseNumericAttribute(framePr, 'w', 'x');
  if (x !== undefined) frame.x = x;

  const y = parseNumericAttribute(framePr, 'w', 'y');
  if (y !== undefined) frame.y = y;

  const xAlign = getAttribute(framePr, 'w', 'xAlign');
  if (xAlign) {
    frame.xAlign = xAlign as NonNullable<ParagraphFormatting['frame']>['xAlign'];
  }

  const yAlign = getAttribute(framePr, 'w', 'yAlign');
  if (yAlign) {
    frame.yAlign = yAlign as NonNullable<ParagraphFormatting['frame']>['yAlign'];
  }

  const wrap = getAttribute(framePr, 'w', 'wrap');
  if (wrap) {
    frame.wrap = wrap as NonNullable<ParagraphFormatting['frame']>['wrap'];
  }

  return Object.keys(frame).length > 0 ? frame : undefined;
}

// ============================================================================
// PARAGRAPH PROPERTIES PARSER
// ============================================================================

/**
 * Parse paragraph formatting properties (w:pPr)
 *
 * Handles ALL pPr properties:
 * - w:jc (alignment: left, center, right, both/justify)
 * - w:spacing (before, after, line, lineRule)
 * - w:ind (left, right, firstLine, hanging)
 * - w:pBdr (paragraph borders: top, bottom, left, right, between)
 * - w:shd (paragraph shading/background)
 * - w:tabs (tab stops with positions and types)
 * - w:keepNext, w:keepLines, w:widowControl, w:pageBreakBefore
 * - w:bidi (right-to-left)
 * - w:numPr (list info)
 * - w:pStyle (style reference)
 * - w:outlineLvl (outline level)
 * - w:framePr (frame properties)
 * - w:rPr (default run properties)
 */
export function parseParagraphProperties(
  pPr: XmlElement | null,
  theme: Theme | null,
  styles?: StyleMap
): ParagraphFormatting | undefined {
  if (!pPr) return undefined;

  const formatting: ParagraphFormatting = {};

  // === Alignment ===
  const jc = findChild(pPr, 'w', 'jc');
  if (jc) {
    const val = getAttribute(jc, 'w', 'val');
    if (val) {
      formatting.alignment = val as ParagraphAlignment;
    }
  }

  // === Bidi (right-to-left) ===
  const bidi = findChild(pPr, 'w', 'bidi');
  if (bidi) {
    formatting.bidi = parseBooleanElement(bidi);
  }

  // === Spacing ===
  const spacing = findChild(pPr, 'w', 'spacing');
  if (spacing) {
    const before = parseNumericAttribute(spacing, 'w', 'before');
    if (before !== undefined) formatting.spaceBefore = before;

    const after = parseNumericAttribute(spacing, 'w', 'after');
    if (after !== undefined) formatting.spaceAfter = after;

    const line = parseNumericAttribute(spacing, 'w', 'line');
    if (line !== undefined) formatting.lineSpacing = line;

    const lineRule = getAttribute(spacing, 'w', 'lineRule');
    if (lineRule) {
      formatting.lineSpacingRule = lineRule as LineSpacingRule;
    }

    const beforeAuto = getAttribute(spacing, 'w', 'beforeAutospacing');
    if (beforeAuto) {
      formatting.beforeAutospacing = beforeAuto === '1' || beforeAuto === 'true';
    }

    const afterAuto = getAttribute(spacing, 'w', 'afterAutospacing');
    if (afterAuto) {
      formatting.afterAutospacing = afterAuto === '1' || afterAuto === 'true';
    }
  }

  // === Indentation ===
  const ind = findChild(pPr, 'w', 'ind');
  if (ind) {
    const left = parseNumericAttribute(ind, 'w', 'left');
    if (left !== undefined) formatting.indentLeft = left;

    const right = parseNumericAttribute(ind, 'w', 'right');
    if (right !== undefined) formatting.indentRight = right;

    const firstLine = parseNumericAttribute(ind, 'w', 'firstLine');
    if (firstLine !== undefined) formatting.indentFirstLine = firstLine;

    const hanging = parseNumericAttribute(ind, 'w', 'hanging');
    if (hanging !== undefined) {
      // Hanging indent is stored as negative first line indent
      formatting.indentFirstLine = -hanging;
      formatting.hangingIndent = true;
    }

    // Also check for w:start and w:end (alternative attributes)
    const start = parseNumericAttribute(ind, 'w', 'start');
    if (start !== undefined && formatting.indentLeft === undefined) {
      formatting.indentLeft = start;
    }

    const end = parseNumericAttribute(ind, 'w', 'end');
    if (end !== undefined && formatting.indentRight === undefined) {
      formatting.indentRight = end;
    }
  }

  // === Borders ===
  const pBdr = findChild(pPr, 'w', 'pBdr');
  if (pBdr) {
    const borders: ParagraphFormatting['borders'] = {};

    const top = parseBorderSpec(findChild(pBdr, 'w', 'top'));
    if (top) borders.top = top;

    const bottom = parseBorderSpec(findChild(pBdr, 'w', 'bottom'));
    if (bottom) borders.bottom = bottom;

    const left = parseBorderSpec(findChild(pBdr, 'w', 'left'));
    if (left) borders.left = left;

    const right = parseBorderSpec(findChild(pBdr, 'w', 'right'));
    if (right) borders.right = right;

    const between = parseBorderSpec(findChild(pBdr, 'w', 'between'));
    if (between) borders.between = between;

    const bar = parseBorderSpec(findChild(pBdr, 'w', 'bar'));
    if (bar) borders.bar = bar;

    if (Object.keys(borders).length > 0) {
      formatting.borders = borders;
    }
  }

  // === Shading ===
  const shd = findChild(pPr, 'w', 'shd');
  if (shd) {
    formatting.shading = parseShadingProperties(shd);
  }

  // === Tab Stops ===
  const tabs = findChild(pPr, 'w', 'tabs');
  if (tabs) {
    formatting.tabs = parseTabStops(tabs);
  }

  // === Page Break Control ===
  const keepNext = findChild(pPr, 'w', 'keepNext');
  if (keepNext) {
    formatting.keepNext = parseBooleanElement(keepNext);
  }

  const keepLines = findChild(pPr, 'w', 'keepLines');
  if (keepLines) {
    formatting.keepLines = parseBooleanElement(keepLines);
  }

  const widowControl = findChild(pPr, 'w', 'widowControl');
  if (widowControl) {
    formatting.widowControl = parseBooleanElement(widowControl);
  }

  const pageBreakBefore = findChild(pPr, 'w', 'pageBreakBefore');
  if (pageBreakBefore) {
    formatting.pageBreakBefore = parseBooleanElement(pageBreakBefore);
  }

  // === Numbering Properties (List Info) ===
  const numPr = findChild(pPr, 'w', 'numPr');
  if (numPr) {
    const numIdEl = findChild(numPr, 'w', 'numId');
    const ilvlEl = findChild(numPr, 'w', 'ilvl');

    if (numIdEl || ilvlEl) {
      formatting.numPr = {};

      if (numIdEl) {
        const val = parseNumericAttribute(numIdEl, 'w', 'val');
        if (val !== undefined) formatting.numPr.numId = val;
      }

      if (ilvlEl) {
        const val = parseNumericAttribute(ilvlEl, 'w', 'val');
        if (val !== undefined) formatting.numPr.ilvl = val;
      }
    }
  }

  // === Outline Level ===
  const outlineLvl = findChild(pPr, 'w', 'outlineLvl');
  if (outlineLvl) {
    const val = parseNumericAttribute(outlineLvl, 'w', 'val');
    if (val !== undefined) formatting.outlineLevel = val;
  }

  // === Style Reference ===
  const pStyle = findChild(pPr, 'w', 'pStyle');
  if (pStyle) {
    const val = getAttribute(pStyle, 'w', 'val');
    if (val) formatting.styleId = val;
  }

  // === Frame Properties ===
  const framePr = findChild(pPr, 'w', 'framePr');
  if (framePr) {
    formatting.frame = parseFrameProperties(framePr);
  }

  // === Suppress Line Numbers ===
  const suppressLineNumbers = findChild(pPr, 'w', 'suppressLineNumbers');
  if (suppressLineNumbers) {
    formatting.suppressLineNumbers = parseBooleanElement(suppressLineNumbers);
  }

  // === Suppress Auto Hyphens ===
  const suppressAutoHyphens = findChild(pPr, 'w', 'suppressAutoHyphens');
  if (suppressAutoHyphens) {
    formatting.suppressAutoHyphens = parseBooleanElement(suppressAutoHyphens);
  }

  // === Default Run Properties ===
  const rPr = findChild(pPr, 'w', 'rPr');
  if (rPr) {
    formatting.runProperties = parseRunProperties(rPr, theme, styles);
  }

  return Object.keys(formatting).length > 0 ? formatting : undefined;
}

// ============================================================================
// PARAGRAPH CONTENT PARSERS
// ============================================================================

/**
 * Get the local name of an element (without namespace prefix)
 */
function getLocalName(name: string | undefined): string {
  if (!name) return '';
  const colonIndex = name.indexOf(':');
  return colonIndex >= 0 ? name.substring(colonIndex + 1) : name;
}

/**
 * Parse hyperlink element (w:hyperlink)
 *
 * Delegates to hyperlinkParser module which resolves URLs via relationships.
 */
function parseHyperlink(
  node: XmlElement,
  rels: RelationshipMap | null,
  styles: StyleMap | null,
  theme: Theme | null,
  media: Map<string, MediaFile> | null
): Hyperlink {
  return parseHyperlinkFromModule(node, rels, styles, theme, media);
}

/**
 * Parse bookmark start (w:bookmarkStart)
 * Delegates to bookmarkParser module.
 */
function parseBookmarkStart(node: XmlElement): BookmarkStart {
  return parseBookmarkStartFromModule(node);
}

/**
 * Parse bookmark end (w:bookmarkEnd)
 * Delegates to bookmarkParser module.
 */
function parseBookmarkEnd(node: XmlElement): BookmarkEnd {
  return parseBookmarkEndFromModule(node);
}

/**
 * Parse field type from instruction string
 */
function parseFieldType(instruction: string): FieldType {
  // Extract the field name (first word)
  const match = instruction.trim().match(/^\\?([A-Z]+)/i);
  if (!match) return 'UNKNOWN';

  const fieldName = match[1].toUpperCase();

  const knownFields: FieldType[] = [
    'PAGE',
    'NUMPAGES',
    'NUMWORDS',
    'NUMCHARS',
    'DATE',
    'TIME',
    'CREATEDATE',
    'SAVEDATE',
    'PRINTDATE',
    'AUTHOR',
    'TITLE',
    'SUBJECT',
    'KEYWORDS',
    'COMMENTS',
    'FILENAME',
    'FILESIZE',
    'TEMPLATE',
    'DOCPROPERTY',
    'DOCVARIABLE',
    'REF',
    'PAGEREF',
    'NOTEREF',
    'HYPERLINK',
    'TOC',
    'TOA',
    'INDEX',
    'SEQ',
    'STYLEREF',
    'AUTONUM',
    'AUTONUMLGL',
    'AUTONUMOUT',
    'IF',
    'MERGEFIELD',
    'NEXT',
    'NEXTIF',
    'ASK',
    'SET',
    'QUOTE',
    'INCLUDETEXT',
    'INCLUDEPICTURE',
    'SYMBOL',
    'ADVANCE',
    'EDITTIME',
    'REVNUM',
    'SECTION',
    'SECTIONPAGES',
    'USERADDRESS',
    'USERNAME',
    'USERINITIALS',
  ];

  if (knownFields.includes(fieldName as FieldType)) {
    return fieldName as FieldType;
  }

  return 'UNKNOWN';
}

/**
 * Parse simple field (w:fldSimple)
 */
function parseSimpleField(
  node: XmlElement,
  styles: StyleMap | null,
  theme: Theme | null,
  rels: RelationshipMap | null,
  media: Map<string, MediaFile> | null
): SimpleField {
  const instruction = getAttribute(node, 'w', 'instr') ?? '';
  const fieldType = parseFieldType(instruction);

  const field: SimpleField = {
    type: 'simpleField',
    instruction,
    fieldType,
    content: [],
  };

  // Check for fldLock
  const fldLock = getAttribute(node, 'w', 'fldLock');
  if (fldLock === '1' || fldLock === 'true') {
    field.fldLock = true;
  }

  // Check for dirty
  const dirty = getAttribute(node, 'w', 'dirty');
  if (dirty === '1' || dirty === 'true') {
    field.dirty = true;
  }

  // Parse child runs (the display value)
  const children = getChildElements(node);
  for (const child of children) {
    const localName = getLocalName(child.name);
    if (localName === 'r') {
      field.content.push(parseRun(child, styles, theme, rels, media));
    }
  }

  return field;
}

/**
 * Parse all content within a paragraph
 *
 * Returns the parsed content and any complex fields that span multiple runs
 */
function parseParagraphContents(
  paraElement: XmlElement,
  styles: StyleMap | null,
  theme: Theme | null,
  _numbering: NumberingMap | null,
  rels: RelationshipMap | null,
  media: Map<string, MediaFile> | null
): ParagraphContent[] {
  const contents: ParagraphContent[] = [];
  const children = getChildElements(paraElement);

  // State for tracking complex fields
  let inComplexField = false;
  let complexFieldInstr = '';
  let complexFieldCodeRuns: Run[] = [];
  let complexFieldResultRuns: Run[] = [];
  let afterSeparator = false;
  let complexFieldLock = false;
  let complexFieldDirty = false;

  for (const child of children) {
    const localName = getLocalName(child.name);

    switch (localName) {
      case 'r': {
        // Check for field characters in this run
        const run = parseRun(child, styles, theme, rels, media);

        // Look for field characters
        let hasFieldBegin = false;
        let hasFieldSeparate = false;
        let hasFieldEnd = false;
        let instrText = '';

        for (const content of run.content) {
          if (content.type === 'fieldChar') {
            if (content.charType === 'begin') {
              hasFieldBegin = true;
              if (content.fldLock) complexFieldLock = true;
              if (content.dirty) complexFieldDirty = true;
            } else if (content.charType === 'separate') {
              hasFieldSeparate = true;
            } else if (content.charType === 'end') {
              hasFieldEnd = true;
            }
          } else if (content.type === 'instrText') {
            instrText += content.text;
          }
        }

        if (hasFieldBegin) {
          // Starting a new complex field
          inComplexField = true;
          afterSeparator = false;
          complexFieldInstr = '';
          complexFieldCodeRuns = [];
          complexFieldResultRuns = [];
          complexFieldLock = false;
          complexFieldDirty = false;
        }

        if (inComplexField) {
          if (instrText) {
            complexFieldInstr += instrText;
          }

          if (hasFieldSeparate) {
            afterSeparator = true;
          }

          if (afterSeparator && !hasFieldEnd) {
            // Add to result runs (excluding the separator run itself)
            if (!hasFieldSeparate) {
              complexFieldResultRuns.push(run);
            }
          } else if (!afterSeparator && !hasFieldBegin) {
            // Add to code runs
            complexFieldCodeRuns.push(run);
          }

          if (hasFieldEnd) {
            // Close the complex field
            const complexField: ComplexField = {
              type: 'complexField',
              instruction: complexFieldInstr.trim(),
              fieldType: parseFieldType(complexFieldInstr),
              fieldCode: complexFieldCodeRuns,
              fieldResult: complexFieldResultRuns,
            };

            if (complexFieldLock) complexField.fldLock = true;
            if (complexFieldDirty) complexField.dirty = true;

            contents.push(complexField);
            inComplexField = false;
          }
        } else {
          // Regular run, not part of a field
          contents.push(run);
        }
        break;
      }

      case 'hyperlink':
        contents.push(parseHyperlink(child, rels, styles, theme, media));
        break;

      case 'bookmarkStart':
        contents.push(parseBookmarkStart(child));
        break;

      case 'bookmarkEnd':
        contents.push(parseBookmarkEnd(child));
        break;

      case 'fldSimple':
        contents.push(parseSimpleField(child, styles, theme, rels, media));
        break;

      case 'pPr':
        // Already handled separately
        break;

      case 'proofErr':
      case 'permStart':
      case 'permEnd':
      case 'customXml':
        // Skip these elements
        break;

      case 'sdt': {
        // Structured document tag - extract properties and content
        const sdtPr = (child.elements ?? []).find(
          (el: XmlElement) =>
            el.type === 'element' && (el.name === 'w:sdtPr' || el.name?.endsWith(':sdtPr'))
        );
        const sdtContentEl = (child.elements ?? []).find(
          (el: XmlElement) =>
            el.type === 'element' &&
            (el.name === 'w:sdtContent' || el.name?.endsWith(':sdtContent'))
        );
        if (sdtContentEl) {
          const sdtParsed = parseParagraphContents(sdtContentEl, styles, theme, null, rels, media);
          const properties = parseSdtProperties(sdtPr ?? null);
          const inlineSdt: InlineSdt = {
            type: 'inlineSdt',
            properties,
            content: sdtParsed.filter(
              (c): c is Run | Hyperlink => c.type === 'run' || c.type === 'hyperlink'
            ),
          };
          contents.push(inlineSdt);
        }
        break;
      }

      case 'ins': {
        // Track change: insertion — parse content and wrap
        const insInfo: TrackedChangeInfo = {
          id: parseInt(getAttribute(child, 'w', 'id') ?? '0', 10),
          author: getAttribute(child, 'w', 'author') ?? 'Unknown',
          date: getAttribute(child, 'w', 'date') ?? undefined,
        };
        const insContent = parseParagraphContents(child, styles, theme, null, rels, media);
        const insertion: Insertion = {
          type: 'insertion',
          info: insInfo,
          content: insContent.filter(
            (c): c is Run | Hyperlink => c.type === 'run' || c.type === 'hyperlink'
          ),
        };
        contents.push(insertion);
        break;
      }
      case 'del': {
        // Track change: deletion — parse content and wrap
        const delInfo: TrackedChangeInfo = {
          id: parseInt(getAttribute(child, 'w', 'id') ?? '0', 10),
          author: getAttribute(child, 'w', 'author') ?? 'Unknown',
          date: getAttribute(child, 'w', 'date') ?? undefined,
        };
        const delContent = parseParagraphContents(child, styles, theme, null, rels, media);
        const deletion: Deletion = {
          type: 'deletion',
          info: delInfo,
          content: delContent.filter(
            (c): c is Run | Hyperlink => c.type === 'run' || c.type === 'hyperlink'
          ),
        };
        contents.push(deletion);
        break;
      }
      case 'smartTag':
      case 'moveTo':
      case 'moveFrom':
        // Other track changes - skip for now
        break;

      case 'commentRangeStart': {
        const commentId = parseInt(getAttribute(child, 'w', 'id') ?? '0', 10);
        contents.push({ type: 'commentRangeStart', id: commentId });
        break;
      }
      case 'commentRangeEnd': {
        const commentId = parseInt(getAttribute(child, 'w', 'id') ?? '0', 10);
        contents.push({ type: 'commentRangeEnd', id: commentId });
        break;
      }

      case 'oMath':
      case 'oMathPara': {
        // Math equations — store raw OMML XML and extract text fallback
        const isBlock = localName === 'oMathPara';
        const ommlXml = elementToXml(child);
        const plainText = extractMathText(child);
        const mathEq: MathEquation = {
          type: 'mathEquation',
          display: isBlock ? 'block' : 'inline',
          ommlXml,
          plainText: plainText || undefined,
        };
        contents.push(mathEq);
        break;
      }

      default:
        // Unknown element - skip
        break;
    }
  }

  return contents;
}

// ============================================================================
// MAIN PARAGRAPH PARSER
// ============================================================================

/**
 * Parse a paragraph element (w:p)
 *
 * @param node - The w:p XML element
 * @param styles - Style map for resolving style references
 * @param theme - Theme for resolving theme colors/fonts
 * @param numbering - Numbering definitions for list info
 * @param rels - Relationship map for resolving hyperlink URLs
 * @param media - Media files map for image data
 * @returns Parsed Paragraph object
 */
export function parseParagraph(
  node: XmlElement,
  styles: StyleMap | null,
  theme: Theme | null,
  numbering: NumberingMap | null,
  rels: RelationshipMap | null = null,
  media: Map<string, MediaFile> | null = null
): Paragraph {
  const paragraph: Paragraph = {
    type: 'paragraph',
    content: [],
  };

  // Get paragraph ID attributes (Word 2010+ uses these for collaboration)
  const paraId = getAttribute(node, 'w14', 'paraId') ?? getAttribute(node, 'w', 'paraId');
  if (paraId) {
    paragraph.paraId = paraId;
  }

  const textId = getAttribute(node, 'w14', 'textId') ?? getAttribute(node, 'w', 'textId');
  if (textId) {
    paragraph.textId = textId;
  }

  // Parse paragraph properties (w:pPr)
  const pPr = findChild(node, 'w', 'pPr');
  if (pPr) {
    paragraph.formatting = parseParagraphProperties(pPr, theme, styles ?? undefined);

    // Check for section properties within paragraph (marks end of a section)
    const sectPr = findChild(pPr, 'w', 'sectPr');
    if (sectPr) {
      paragraph.sectionProperties = parseSectionProperties(sectPr, rels);
    }
  }

  // Parse paragraph contents (runs, hyperlinks, bookmarks, fields)
  const rawContent = parseParagraphContents(node, styles, theme, numbering, rels, media);

  // Consolidate consecutive runs with identical formatting
  // This reduces fragmentation (e.g., 252 tiny runs → a few larger runs)
  paragraph.content = consolidateParagraphContent(rawContent);

  // Compute list rendering if this is a list item
  if (paragraph.formatting?.numPr && numbering) {
    const { numId, ilvl = 0 } = paragraph.formatting.numPr;
    if (numId !== undefined && numId !== 0) {
      const level = numbering.getLevel(numId, ilvl);
      if (level) {
        paragraph.listRendering = {
          level: ilvl,
          numId,
          marker: level.lvlText,
          isBullet: level.numFmt === 'bullet',
          numFmt: level.numFmt,
        };

        // Apply level's paragraph properties (indentation) as defaults.
        // Per OOXML spec, direct w:ind on the paragraph overrides numbering
        // level indent — only use numbering indent as fallback.
        if (level.pPr) {
          if (!paragraph.formatting) {
            paragraph.formatting = {};
          }
          const directInd = pPr ? findChild(pPr, 'w', 'ind') : null;
          const hasDirectLeft =
            directInd != null &&
            (getAttribute(directInd, 'w', 'left') !== null ||
              getAttribute(directInd, 'w', 'start') !== null);
          const hasDirectFirstLineOrHanging =
            directInd != null &&
            (getAttribute(directInd, 'w', 'firstLine') !== null ||
              getAttribute(directInd, 'w', 'hanging') !== null);

          if (!hasDirectLeft && level.pPr.indentLeft !== undefined) {
            paragraph.formatting.indentLeft = level.pPr.indentLeft;
          }
          if (!hasDirectFirstLineOrHanging) {
            if (level.pPr.indentFirstLine !== undefined) {
              paragraph.formatting.indentFirstLine = level.pPr.indentFirstLine;
            }
            if (level.pPr.hangingIndent !== undefined) {
              paragraph.formatting.hangingIndent = level.pPr.hangingIndent;
            }
          }
        }
      }
    }
  }

  return paragraph;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get plain text from a paragraph
 *
 * @param paragraph - Parsed Paragraph object
 * @returns Concatenated text content
 */
export function getParagraphText(paragraph: Paragraph): string {
  let text = '';

  for (const content of paragraph.content) {
    if (content.type === 'run') {
      for (const runContent of content.content) {
        if (runContent.type === 'text') {
          text += runContent.text;
        } else if (runContent.type === 'tab') {
          text += '\t';
        } else if (runContent.type === 'break') {
          if (runContent.breakType === 'page') {
            text += '\f';
          } else {
            text += '\n';
          }
        }
      }
    } else if (content.type === 'hyperlink') {
      for (const child of content.children) {
        if (child.type === 'run') {
          for (const runContent of child.content) {
            if (runContent.type === 'text') {
              text += runContent.text;
            }
          }
        }
      }
    } else if (content.type === 'simpleField') {
      for (const child of content.content) {
        if (child.type === 'run') {
          for (const runContent of child.content) {
            if (runContent.type === 'text') {
              text += runContent.text;
            }
          }
        }
      }
    } else if (content.type === 'complexField') {
      for (const run of content.fieldResult) {
        for (const runContent of run.content) {
          if (runContent.type === 'text') {
            text += runContent.text;
          }
        }
      }
    }
  }

  return text;
}

/**
 * Check if a paragraph is empty (no visible content)
 *
 * @param paragraph - Parsed Paragraph object
 * @returns true if paragraph has no visible content
 */
export function isEmptyParagraph(paragraph: Paragraph): boolean {
  return (
    getParagraphText(paragraph).trim() === '' &&
    !paragraph.content.some(
      (c) =>
        c.type === 'run' && c.content.some((rc) => rc.type === 'drawing' || rc.type === 'shape')
    )
  );
}

/**
 * Check if a paragraph is a list item
 *
 * @param paragraph - Parsed Paragraph object
 * @returns true if paragraph has numbering properties
 */
export function isListItem(paragraph: Paragraph): boolean {
  return (
    paragraph.formatting?.numPr !== undefined &&
    paragraph.formatting.numPr.numId !== undefined &&
    paragraph.formatting.numPr.numId !== 0
  );
}

/**
 * Get the list level of a paragraph (0-8)
 *
 * @param paragraph - Parsed Paragraph object
 * @returns List level or undefined if not a list item
 */
export function getListLevel(paragraph: Paragraph): number | undefined {
  if (!isListItem(paragraph)) return undefined;
  return paragraph.formatting?.numPr?.ilvl ?? 0;
}

/**
 * Check if paragraph has a specific style
 *
 * @param paragraph - Parsed Paragraph object
 * @param styleId - Style ID to check for
 * @returns true if paragraph has the specified style
 */
export function hasStyle(paragraph: Paragraph, styleId: string): boolean {
  return paragraph.formatting?.styleId === styleId;
}

/**
 * Check if paragraph starts with a template variable {{...}}
 *
 * @param paragraph - Parsed Paragraph object
 * @returns The variable name or null
 */
export function getTemplateVariable(paragraph: Paragraph): string | null {
  const text = getParagraphText(paragraph);
  const match = text.match(/\{\{([^}]+)\}\}/);
  return match ? match[1] : null;
}
