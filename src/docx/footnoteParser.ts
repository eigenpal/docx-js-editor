/**
 * Footnote/Endnote Parser - Parse footnotes.xml and endnotes.xml
 *
 * Footnotes and endnotes are stored in separate XML files within the DOCX package:
 * - word/footnotes.xml - Contains all footnote definitions
 * - word/endnotes.xml - Contains all endnote definitions
 *
 * Each note contains:
 * - An ID that matches references in document.xml (w:footnoteReference, w:endnoteReference)
 * - A type (normal, separator, continuationSeparator, continuationNotice)
 * - Content (paragraphs)
 *
 * The references in the document body are parsed by runParser as NoteReferenceContent.
 *
 * OOXML Reference:
 * - Footnote: w:footnote[@w:id][@w:type]
 * - Endnote: w:endnote[@w:id][@w:type]
 * - Content: w:p (paragraphs)
 */

import type {
  Footnote,
  Endnote,
  FootnoteProperties,
  EndnoteProperties,
  FootnotePosition,
  EndnotePosition,
  NoteNumberRestart,
  NumberFormat,
  Paragraph,
  Theme,
  RelationshipMap,
  MediaFile,
} from '../types/document';
import type { StyleMap } from './styleParser';
import type { NumberingMap } from './numberingParser';
import {
  parseXml,
  findChild,
  findChildren,
  getAttribute,
  parseNumericAttribute,
  type XmlElement,
} from './xmlParser';
import { parseParagraph } from './paragraphParser';

// ============================================================================
// FOOTNOTE MAP INTERFACE
// ============================================================================

/**
 * Footnote map returned by parseFootnotes
 */
export interface FootnoteMap {
  /** All footnotes indexed by ID */
  byId: Map<number, Footnote>;

  /** Array of all footnotes in document order */
  footnotes: Footnote[];

  /** Get footnote by ID */
  getFootnote(id: number): Footnote | undefined;

  /** Check if footnote exists */
  hasFootnote(id: number): boolean;

  /** Get all normal (non-separator) footnotes */
  getNormalFootnotes(): Footnote[];

  /** Get separator footnote if exists */
  getSeparator(): Footnote | undefined;

  /** Get continuation separator if exists */
  getContinuationSeparator(): Footnote | undefined;
}

/**
 * Endnote map returned by parseEndnotes
 */
export interface EndnoteMap {
  /** All endnotes indexed by ID */
  byId: Map<number, Endnote>;

  /** Array of all endnotes in document order */
  endnotes: Endnote[];

  /** Get endnote by ID */
  getEndnote(id: number): Endnote | undefined;

  /** Check if endnote exists */
  hasEndnote(id: number): boolean;

  /** Get all normal (non-separator) endnotes */
  getNormalEndnotes(): Endnote[];

  /** Get separator endnote if exists */
  getSeparator(): Endnote | undefined;

  /** Get continuation separator if exists */
  getContinuationSeparator(): Endnote | undefined;
}

// ============================================================================
// NOTE TYPE PARSING
// ============================================================================

/**
 * Parse note type attribute
 */
function parseNoteType(
  typeAttr: string | null
): 'normal' | 'separator' | 'continuationSeparator' | 'continuationNotice' {
  switch (typeAttr) {
    case 'separator':
      return 'separator';
    case 'continuationSeparator':
      return 'continuationSeparator';
    case 'continuationNotice':
      return 'continuationNotice';
    default:
      return 'normal';
  }
}

// ============================================================================
// FOOTNOTE PARSING
// ============================================================================

/**
 * Parse a single footnote element (w:footnote)
 */
function parseFootnote(
  element: XmlElement,
  styles: StyleMap | null,
  theme: Theme | null,
  numbering: NumberingMap | null,
  rels: RelationshipMap | null,
  _media: Map<string, MediaFile> | null
): Footnote {
  const id = parseNumericAttribute(element, 'w', 'id') ?? 0;
  const typeAttr = getAttribute(element, 'w', 'type');
  const noteType = parseNoteType(typeAttr);

  // Parse content paragraphs
  const paragraphElements = findChildren(element, 'w', 'p');
  const content: Paragraph[] = paragraphElements.map((pEl) =>
    parseParagraph(pEl, styles, theme, numbering, rels)
  );

  return {
    type: 'footnote',
    id,
    noteType,
    content,
  };
}

/**
 * Parse footnotes.xml
 *
 * @param footnotesXml - The raw XML content of word/footnotes.xml
 * @param styles - Parsed style map for applying styles
 * @param theme - Parsed theme for color resolution
 * @param numbering - Parsed numbering definitions for lists
 * @param rels - Relationships for resolving hyperlinks
 * @param media - Media files for images
 * @returns FootnoteMap with all footnotes
 */
export function parseFootnotes(
  footnotesXml: string | null,
  styles: StyleMap | null = null,
  theme: Theme | null = null,
  numbering: NumberingMap | null = null,
  rels: RelationshipMap | null = null,
  media: Map<string, MediaFile> | null = null
): FootnoteMap {
  const byId = new Map<number, Footnote>();
  const footnotes: Footnote[] = [];

  if (!footnotesXml) {
    return createFootnoteMap(byId, footnotes);
  }

  const doc = parseXml(footnotesXml);
  if (!doc) {
    return createFootnoteMap(byId, footnotes);
  }

  // Find the root footnotes element
  const rootElement = doc.elements?.find(
    (el: XmlElement) =>
      el.type === 'element' && (el.name === 'w:footnotes' || el.name?.endsWith(':footnotes'))
  ) as XmlElement | undefined;

  if (!rootElement) {
    return createFootnoteMap(byId, footnotes);
  }

  // Parse all footnote elements
  const footnoteElements = findChildren(rootElement, 'w', 'footnote');

  for (const fnEl of footnoteElements) {
    const footnote = parseFootnote(fnEl, styles, theme, numbering, rels, media);
    byId.set(footnote.id, footnote);
    footnotes.push(footnote);
  }

  return createFootnoteMap(byId, footnotes);
}

/**
 * Create FootnoteMap object with helper methods
 */
function createFootnoteMap(byId: Map<number, Footnote>, footnotes: Footnote[]): FootnoteMap {
  return {
    byId,
    footnotes,

    getFootnote(id: number): Footnote | undefined {
      return byId.get(id);
    },

    hasFootnote(id: number): boolean {
      return byId.has(id);
    },

    getNormalFootnotes(): Footnote[] {
      return footnotes.filter((fn) => fn.noteType === 'normal');
    },

    getSeparator(): Footnote | undefined {
      return footnotes.find((fn) => fn.noteType === 'separator');
    },

    getContinuationSeparator(): Footnote | undefined {
      return footnotes.find((fn) => fn.noteType === 'continuationSeparator');
    },
  };
}

// ============================================================================
// ENDNOTE PARSING
// ============================================================================

/**
 * Parse a single endnote element (w:endnote)
 */
function parseEndnote(
  element: XmlElement,
  styles: StyleMap | null,
  theme: Theme | null,
  numbering: NumberingMap | null,
  rels: RelationshipMap | null,
  _media: Map<string, MediaFile> | null
): Endnote {
  const id = parseNumericAttribute(element, 'w', 'id') ?? 0;
  const typeAttr = getAttribute(element, 'w', 'type');
  const noteType = parseNoteType(typeAttr);

  // Parse content paragraphs
  const paragraphElements = findChildren(element, 'w', 'p');
  const content: Paragraph[] = paragraphElements.map((pEl) =>
    parseParagraph(pEl, styles, theme, numbering, rels)
  );

  return {
    type: 'endnote',
    id,
    noteType,
    content,
  };
}

/**
 * Parse endnotes.xml
 *
 * @param endnotesXml - The raw XML content of word/endnotes.xml
 * @param styles - Parsed style map for applying styles
 * @param theme - Parsed theme for color resolution
 * @param numbering - Parsed numbering definitions for lists
 * @param rels - Relationships for resolving hyperlinks
 * @param media - Media files for images
 * @returns EndnoteMap with all endnotes
 */
export function parseEndnotes(
  endnotesXml: string | null,
  styles: StyleMap | null = null,
  theme: Theme | null = null,
  numbering: NumberingMap | null = null,
  rels: RelationshipMap | null = null,
  media: Map<string, MediaFile> | null = null
): EndnoteMap {
  const byId = new Map<number, Endnote>();
  const endnotes: Endnote[] = [];

  if (!endnotesXml) {
    return createEndnoteMap(byId, endnotes);
  }

  const doc = parseXml(endnotesXml);
  if (!doc) {
    return createEndnoteMap(byId, endnotes);
  }

  // Find the root endnotes element
  const rootElement = doc.elements?.find(
    (el: XmlElement) =>
      el.type === 'element' && (el.name === 'w:endnotes' || el.name?.endsWith(':endnotes'))
  ) as XmlElement | undefined;

  if (!rootElement) {
    return createEndnoteMap(byId, endnotes);
  }

  // Parse all endnote elements
  const endnoteElements = findChildren(rootElement, 'w', 'endnote');

  for (const enEl of endnoteElements) {
    const endnote = parseEndnote(enEl, styles, theme, numbering, rels, media);
    byId.set(endnote.id, endnote);
    endnotes.push(endnote);
  }

  return createEndnoteMap(byId, endnotes);
}

/**
 * Create EndnoteMap object with helper methods
 */
function createEndnoteMap(byId: Map<number, Endnote>, endnotes: Endnote[]): EndnoteMap {
  return {
    byId,
    endnotes,

    getEndnote(id: number): Endnote | undefined {
      return byId.get(id);
    },

    hasEndnote(id: number): boolean {
      return byId.has(id);
    },

    getNormalEndnotes(): Endnote[] {
      return endnotes.filter((en) => en.noteType === 'normal');
    },

    getSeparator(): Endnote | undefined {
      return endnotes.find((en) => en.noteType === 'separator');
    },

    getContinuationSeparator(): Endnote | undefined {
      return endnotes.find((en) => en.noteType === 'continuationSeparator');
    },
  };
}

// ============================================================================
// FOOTNOTE/ENDNOTE PROPERTIES PARSING
// ============================================================================

/**
 * Parse number format from w:numFmt element
 */
function parseNumberFormat(numFmtAttr: string | null): NumberFormat | undefined {
  if (!numFmtAttr) return undefined;

  // Map OOXML numFmt values to our NumberFormat type
  const formatMap: Record<string, NumberFormat> = {
    decimal: 'decimal',
    upperRoman: 'upperRoman',
    lowerRoman: 'lowerRoman',
    upperLetter: 'upperLetter',
    lowerLetter: 'lowerLetter',
    ordinal: 'ordinal',
    cardinalText: 'cardinalText',
    ordinalText: 'ordinalText',
    bullet: 'bullet',
    chicago: 'chicago',
    none: 'none',
  };

  return formatMap[numFmtAttr] as NumberFormat | undefined;
}

/**
 * Parse footnote position
 */
function parseFootnotePosition(posAttr: string | null): FootnotePosition | undefined {
  switch (posAttr) {
    case 'pageBottom':
      return 'pageBottom';
    case 'beneathText':
      return 'beneathText';
    case 'sectEnd':
      return 'sectEnd';
    case 'docEnd':
      return 'docEnd';
    default:
      return undefined;
  }
}

/**
 * Parse endnote position
 */
function parseEndnotePosition(posAttr: string | null): EndnotePosition | undefined {
  switch (posAttr) {
    case 'sectEnd':
      return 'sectEnd';
    case 'docEnd':
      return 'docEnd';
    default:
      return undefined;
  }
}

/**
 * Parse number restart type
 */
function parseNumberRestart(restartAttr: string | null): NoteNumberRestart | undefined {
  switch (restartAttr) {
    case 'continuous':
      return 'continuous';
    case 'eachSect':
      return 'eachSect';
    case 'eachPage':
      return 'eachPage';
    default:
      return undefined;
  }
}

/**
 * Parse footnote properties from w:footnotePr element
 * (Can appear in w:sectPr or w:settings)
 */
export function parseFootnoteProperties(element: XmlElement | null): FootnoteProperties {
  const props: FootnoteProperties = {};

  if (!element) return props;

  // Position (w:pos)
  const posEl = findChild(element, 'w', 'pos');
  if (posEl) {
    const posAttr = getAttribute(posEl, 'w', 'val');
    props.position = parseFootnotePosition(posAttr);
  }

  // Number format (w:numFmt)
  const numFmtEl = findChild(element, 'w', 'numFmt');
  if (numFmtEl) {
    const fmtAttr = getAttribute(numFmtEl, 'w', 'val');
    props.numFmt = parseNumberFormat(fmtAttr);
  }

  // Start number (w:numStart)
  const numStartEl = findChild(element, 'w', 'numStart');
  if (numStartEl) {
    props.numStart = parseNumericAttribute(numStartEl, 'w', 'val') ?? undefined;
  }

  // Number restart (w:numRestart)
  const numRestartEl = findChild(element, 'w', 'numRestart');
  if (numRestartEl) {
    const restartAttr = getAttribute(numRestartEl, 'w', 'val');
    props.numRestart = parseNumberRestart(restartAttr);
  }

  return props;
}

/**
 * Parse endnote properties from w:endnotePr element
 * (Can appear in w:sectPr or w:settings)
 */
export function parseEndnoteProperties(element: XmlElement | null): EndnoteProperties {
  const props: EndnoteProperties = {};

  if (!element) return props;

  // Position (w:pos)
  const posEl = findChild(element, 'w', 'pos');
  if (posEl) {
    const posAttr = getAttribute(posEl, 'w', 'val');
    props.position = parseEndnotePosition(posAttr);
  }

  // Number format (w:numFmt)
  const numFmtEl = findChild(element, 'w', 'numFmt');
  if (numFmtEl) {
    const fmtAttr = getAttribute(numFmtEl, 'w', 'val');
    props.numFmt = parseNumberFormat(fmtAttr);
  }

  // Start number (w:numStart)
  const numStartEl = findChild(element, 'w', 'numStart');
  if (numStartEl) {
    props.numStart = parseNumericAttribute(numStartEl, 'w', 'val') ?? undefined;
  }

  // Number restart (w:numRestart)
  const numRestartEl = findChild(element, 'w', 'numRestart');
  if (numRestartEl) {
    const restartAttr = getAttribute(numRestartEl, 'w', 'val');
    props.numRestart = parseNumberRestart(restartAttr);
  }

  return props;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get plain text content of a footnote
 */
export function getFootnoteText(footnote: Footnote): string {
  // Import getParagraphText dynamically to avoid circular dependency
  const texts: string[] = [];

  for (const para of footnote.content) {
    const paraTexts: string[] = [];
    for (const content of para.content) {
      if (content.type === 'run') {
        for (const runContent of content.content) {
          if (runContent.type === 'text') {
            paraTexts.push(runContent.text);
          }
        }
      }
    }
    texts.push(paraTexts.join(''));
  }

  return texts.join('\n');
}

/**
 * Get plain text content of an endnote
 */
export function getEndnoteText(endnote: Endnote): string {
  const texts: string[] = [];

  for (const para of endnote.content) {
    const paraTexts: string[] = [];
    for (const content of para.content) {
      if (content.type === 'run') {
        for (const runContent of content.content) {
          if (runContent.type === 'text') {
            paraTexts.push(runContent.text);
          }
        }
      }
    }
    texts.push(paraTexts.join(''));
  }

  return texts.join('\n');
}

/**
 * Check if a footnote is a separator (not regular content)
 */
export function isSeparatorFootnote(footnote: Footnote): boolean {
  return (
    footnote.noteType === 'separator' ||
    footnote.noteType === 'continuationSeparator' ||
    footnote.noteType === 'continuationNotice'
  );
}

/**
 * Check if an endnote is a separator (not regular content)
 */
export function isSeparatorEndnote(endnote: Endnote): boolean {
  return (
    endnote.noteType === 'separator' ||
    endnote.noteType === 'continuationSeparator' ||
    endnote.noteType === 'continuationNotice'
  );
}

/**
 * Get footnote number for display (excluding separators)
 * @param footnote - The footnote to get the number for
 * @param footnoteMap - The footnote map
 * @param startNumber - Starting number (default 1)
 * @returns The display number, or null for separator footnotes
 */
export function getFootnoteDisplayNumber(
  footnote: Footnote,
  footnoteMap: FootnoteMap,
  startNumber: number = 1
): number | null {
  if (isSeparatorFootnote(footnote)) {
    return null;
  }

  const normalFootnotes = footnoteMap.getNormalFootnotes();
  const index = normalFootnotes.findIndex((fn) => fn.id === footnote.id);

  if (index === -1) {
    return null;
  }

  return startNumber + index;
}

/**
 * Get endnote number for display (excluding separators)
 * @param endnote - The endnote to get the number for
 * @param endnoteMap - The endnote map
 * @param startNumber - Starting number (default 1)
 * @returns The display number, or null for separator endnotes
 */
export function getEndnoteDisplayNumber(
  endnote: Endnote,
  endnoteMap: EndnoteMap,
  startNumber: number = 1
): number | null {
  if (isSeparatorEndnote(endnote)) {
    return null;
  }

  const normalEndnotes = endnoteMap.getNormalEndnotes();
  const index = normalEndnotes.findIndex((en) => en.id === endnote.id);

  if (index === -1) {
    return null;
  }

  return startNumber + index;
}

/**
 * Create an empty footnote map
 */
export function createEmptyFootnoteMap(): FootnoteMap {
  return createFootnoteMap(new Map(), []);
}

/**
 * Create an empty endnote map
 */
export function createEmptyEndnoteMap(): EndnoteMap {
  return createEndnoteMap(new Map(), []);
}

/**
 * Merge multiple footnote maps (e.g., from different documents)
 */
export function mergeFootnoteMaps(...maps: FootnoteMap[]): FootnoteMap {
  const byId = new Map<number, Footnote>();
  const footnotes: Footnote[] = [];

  for (const map of maps) {
    for (const fn of map.footnotes) {
      if (!byId.has(fn.id)) {
        byId.set(fn.id, fn);
        footnotes.push(fn);
      }
    }
  }

  return createFootnoteMap(byId, footnotes);
}

/**
 * Merge multiple endnote maps (e.g., from different documents)
 */
export function mergeEndnoteMaps(...maps: EndnoteMap[]): EndnoteMap {
  const byId = new Map<number, Endnote>();
  const endnotes: Endnote[] = [];

  for (const map of maps) {
    for (const en of map.endnotes) {
      if (!byId.has(en.id)) {
        byId.set(en.id, en);
        endnotes.push(en);
      }
    }
  }

  return createEndnoteMap(byId, endnotes);
}
