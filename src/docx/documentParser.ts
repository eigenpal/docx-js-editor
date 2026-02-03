/**
 * Document Body Parser - Parse document.xml body content
 *
 * Parses the main document body (w:body) containing paragraphs, tables,
 * and section properties. Also detects template variables {{...}}.
 *
 * OOXML Reference:
 * - Root: w:document
 * - Body: w:body
 * - Content: w:p (paragraphs), w:tbl (tables), w:sdt (structured document tags)
 * - Final section properties: w:body/w:sectPr
 */

import type {
  DocumentBody,
  BlockContent,
  Section,
  Paragraph,
  Table,
  SectionProperties,
  Theme,
  RelationshipMap,
  MediaFile,
} from '../types/document';
import type { StyleMap } from './styleParser';
import type { NumberingMap } from './numberingParser';
import { parseXml, findChild, getChildElements, type XmlElement } from './xmlParser';
import { parseParagraph, getParagraphText } from './paragraphParser';
import { parseTable } from './tableParser';
import { parseSectionProperties, getDefaultSectionProperties } from './sectionParser';

// ============================================================================
// LIST MARKER COMPUTATION
// ============================================================================

/**
 * Compute the actual list marker for a paragraph
 *
 * Replaces %1, %2, etc. in lvlText with actual counter values.
 * Tracks and increments counters as list items are encountered.
 *
 * @param paragraph - The paragraph to compute marker for
 * @param numbering - Numbering definitions
 * @param listCounters - Map tracking counters per numId
 */
function computeListMarker(
  paragraph: Paragraph,
  numbering: NumberingMap | null,
  listCounters: Map<number, number[]>
): void {
  const listRendering = paragraph.listRendering;
  if (!listRendering || !numbering) return;

  const { numId, level } = listRendering;
  if (numId === undefined || numId === 0) return;

  // Initialize counters for this numId if not exists
  if (!listCounters.has(numId)) {
    listCounters.set(numId, new Array(9).fill(0)); // Up to 9 levels
  }

  const counters = listCounters.get(numId)!;

  // Increment counter at current level
  counters[level] = (counters[level] || 0) + 1;

  // Reset all deeper level counters when we go to a shallower level
  for (let i = level + 1; i < counters.length; i++) {
    counters[i] = 0;
  }

  // Get the lvlText pattern (e.g., "%1.%2.%3.")
  const pattern = listRendering.marker;

  // For bullet lists, use the marker character directly
  if (listRendering.isBullet) {
    // Bullet markers are usually single characters like •, ●, ○, ■
    // The pattern might contain the actual bullet character
    return;
  }

  // Compute the actual marker by replacing %1, %2, etc.
  let computedMarker = pattern;

  // Replace %1, %2, etc. with actual counter values
  // Format each level according to its numFmt
  for (let lvl = 0; lvl <= level; lvl++) {
    const placeholder = `%${lvl + 1}`;
    if (computedMarker.includes(placeholder)) {
      const value = counters[lvl];
      const levelInfo = numbering.getLevel(numId, lvl);
      const formatted = formatNumber(value, levelInfo?.numFmt || 'decimal');
      computedMarker = computedMarker.replace(placeholder, formatted);
    }
  }

  // Update the marker with the computed value
  listRendering.marker = computedMarker;
}

/**
 * Format a number according to OOXML number format
 */
function formatNumber(value: number, numFmt: string): string {
  switch (numFmt) {
    case 'decimal':
    case 'decimalZero':
      return String(value);
    case 'lowerLetter':
      return String.fromCharCode(96 + ((value - 1) % 26) + 1); // a, b, c...
    case 'upperLetter':
      return String.fromCharCode(64 + ((value - 1) % 26) + 1); // A, B, C...
    case 'lowerRoman':
      return toRoman(value).toLowerCase();
    case 'upperRoman':
      return toRoman(value);
    case 'bullet':
      return '•';
    default:
      return String(value);
  }
}

/**
 * Convert number to Roman numerals
 */
function toRoman(num: number): string {
  const romanNumerals: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];

  let result = '';
  for (const [value, symbol] of romanNumerals) {
    while (num >= value) {
      result += symbol;
      num -= value;
    }
  }
  return result;
}

// ============================================================================
// TEMPLATE VARIABLE DETECTION
// ============================================================================

/**
 * Regular expression to match template variables {{...}}
 */
const TEMPLATE_VARIABLE_REGEX = /\{\{([^{}]+)\}\}/g;

/**
 * Extract template variables from text
 *
 * @param text - Text to search for variables
 * @returns Array of unique variable names (without braces)
 */
export function extractTemplateVariables(text: string): string[] {
  const variables: string[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  TEMPLATE_VARIABLE_REGEX.lastIndex = 0;

  while ((match = TEMPLATE_VARIABLE_REGEX.exec(text)) !== null) {
    const varName = match[1].trim();
    if (varName && !variables.includes(varName)) {
      variables.push(varName);
    }
  }

  return variables;
}

/**
 * Extract all template variables from document content
 *
 * @param content - Array of paragraphs and tables
 * @returns Array of unique variable names
 */
export function extractAllTemplateVariables(content: BlockContent[]): string[] {
  const variables: string[] = [];

  for (const block of content) {
    if (block.type === 'paragraph') {
      const text = getParagraphText(block);
      const vars = extractTemplateVariables(text);
      for (const v of vars) {
        if (!variables.includes(v)) {
          variables.push(v);
        }
      }
    } else if (block.type === 'table') {
      // Recursively check table cells
      const tableVars = extractTableVariables(block);
      for (const v of tableVars) {
        if (!variables.includes(v)) {
          variables.push(v);
        }
      }
    }
  }

  return variables;
}

/**
 * Extract template variables from a table
 */
function extractTableVariables(table: Table): string[] {
  const variables: string[] = [];

  for (const row of table.rows) {
    for (const cell of row.cells) {
      for (const cellContent of cell.content) {
        if (cellContent.type === 'paragraph') {
          const text = getParagraphText(cellContent);
          const vars = extractTemplateVariables(text);
          for (const v of vars) {
            if (!variables.includes(v)) {
              variables.push(v);
            }
          }
        } else if (cellContent.type === 'table') {
          // Nested table
          const nestedVars = extractTableVariables(cellContent);
          for (const v of nestedVars) {
            if (!variables.includes(v)) {
              variables.push(v);
            }
          }
        }
      }
    }
  }

  return variables;
}

// ============================================================================
// CONTENT PARSING
// ============================================================================

/**
 * Parse block content from an element (body or SDT content)
 *
 * @param parent - Parent element containing content
 * @param styles - Style map
 * @param theme - Theme
 * @param numbering - Numbering definitions
 * @param rels - Relationships
 * @param media - Media files
 * @returns Array of block content (paragraphs, tables)
 */
function parseBlockContent(
  parent: XmlElement,
  styles: StyleMap | null,
  theme: Theme | null,
  numbering: NumberingMap | null,
  rels: RelationshipMap | null,
  media: Map<string, MediaFile> | null
): BlockContent[] {
  const content: BlockContent[] = [];
  const children = getChildElements(parent);

  // Track list counters for computing markers
  // Map: numId -> array of counters for each level
  const listCounters = new Map<number, number[]>();

  for (const child of children) {
    const name = child.name ?? '';

    // Paragraph (w:p)
    if (name === 'w:p' || name.endsWith(':p')) {
      const paragraph = parseParagraph(child, styles, theme, numbering, rels, media);
      // Compute list marker if this is a list item
      computeListMarker(paragraph, numbering, listCounters);
      content.push(paragraph);
    }
    // Table (w:tbl)
    else if (name === 'w:tbl' || name.endsWith(':tbl')) {
      const table = parseTable(child, styles, theme, numbering, rels, media);
      content.push(table);
    }
    // Structured Document Tag (w:sdt) - container for content
    else if (name === 'w:sdt' || name.endsWith(':sdt')) {
      // Find the content element inside SDT
      const sdtContent = (child.elements ?? []).find(
        (el: XmlElement) =>
          el.type === 'element' && (el.name === 'w:sdtContent' || el.name?.endsWith(':sdtContent'))
      );
      if (sdtContent) {
        // Recursively parse content inside SDT
        const sdtBlockContent = parseBlockContent(
          sdtContent,
          styles,
          theme,
          numbering,
          rels,
          media
        );
        content.push(...sdtBlockContent);
      }
    }
    // Section properties (w:sectPr) - handled separately at body level
    // Skip here as we handle it after content parsing
  }

  return content;
}

// ============================================================================
// SECTION BUILDING
// ============================================================================

/**
 * Build sections from content based on section properties in paragraphs
 *
 * In OOXML, sections are delimited by:
 * 1. w:pPr/w:sectPr within a paragraph (marks end of a section)
 * 2. w:body/w:sectPr (final section properties)
 *
 * @param content - All block content
 * @param finalSectPr - Final section properties from body
 * @returns Array of sections
 */
function buildSections(
  content: BlockContent[],
  finalSectPr: SectionProperties | undefined
): Section[] {
  const sections: Section[] = [];
  let currentSectionContent: BlockContent[] = [];

  for (const block of content) {
    currentSectionContent.push(block);

    // Check if this paragraph ends a section
    if (block.type === 'paragraph' && block.sectionProperties) {
      // This paragraph ends a section
      sections.push({
        properties: block.sectionProperties,
        content: currentSectionContent,
      });

      // Start new section
      currentSectionContent = [];
    }
  }

  // Add final section with remaining content
  if (currentSectionContent.length > 0 || sections.length === 0) {
    sections.push({
      properties: finalSectPr ?? getDefaultSectionProperties(),
      content: currentSectionContent,
    });
  }

  return sections;
}

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse document.xml body content
 *
 * @param xml - Raw XML content of document.xml
 * @param styles - Parsed style map
 * @param theme - Parsed theme
 * @param numbering - Parsed numbering definitions
 * @param rels - Document relationships
 * @param media - Media files
 * @returns DocumentBody with content, sections, and template variables
 */
export function parseDocumentBody(
  xml: string,
  styles: StyleMap | null = null,
  theme: Theme | null = null,
  numbering: NumberingMap | null = null,
  rels: RelationshipMap | null = null,
  media: Map<string, MediaFile> | null = null
): DocumentBody {
  const result: DocumentBody = {
    content: [],
  };

  if (!xml) {
    return result;
  }

  // Parse XML
  const doc = parseXml(xml);
  if (!doc) {
    return result;
  }

  // Find root document element (w:document)
  const documentEl = (doc.elements ?? []).find(
    (el: XmlElement) =>
      el.type === 'element' && (el.name === 'w:document' || el.name?.endsWith(':document'))
  );
  if (!documentEl) {
    return result;
  }

  // Find body element (w:body)
  const bodyEl = findChild(documentEl, 'w', 'body');
  if (!bodyEl) {
    return result;
  }

  // Parse all block content (paragraphs, tables)
  result.content = parseBlockContent(bodyEl, styles, theme, numbering, rels, media);

  // Parse final section properties (w:body/w:sectPr)
  const finalSectPr = findChild(bodyEl, 'w', 'sectPr');
  if (finalSectPr) {
    result.finalSectionProperties = parseSectionProperties(finalSectPr, rels);
  }

  // Build sections from content
  result.sections = buildSections(result.content, result.finalSectionProperties);

  return result;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all paragraphs from document body (flattened)
 */
export function getAllParagraphs(body: DocumentBody): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const block of body.content) {
    if (block.type === 'paragraph') {
      paragraphs.push(block);
    } else if (block.type === 'table') {
      // Get paragraphs from table cells
      paragraphs.push(...getTableParagraphs(block));
    }
  }

  return paragraphs;
}

/**
 * Get all paragraphs from a table (recursively)
 */
function getTableParagraphs(table: Table): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const row of table.rows) {
    for (const cell of row.cells) {
      for (const content of cell.content) {
        if (content.type === 'paragraph') {
          paragraphs.push(content);
        } else if (content.type === 'table') {
          paragraphs.push(...getTableParagraphs(content));
        }
      }
    }
  }

  return paragraphs;
}

/**
 * Get all tables from document body
 */
export function getAllTables(body: DocumentBody): Table[] {
  const tables: Table[] = [];

  for (const block of body.content) {
    if (block.type === 'table') {
      tables.push(block);
      // Also get nested tables
      tables.push(...getNestedTables(block));
    }
  }

  return tables;
}

/**
 * Get nested tables from a table (recursively)
 */
function getNestedTables(table: Table): Table[] {
  const tables: Table[] = [];

  for (const row of table.rows) {
    for (const cell of row.cells) {
      for (const content of cell.content) {
        if (content.type === 'table') {
          tables.push(content);
          tables.push(...getNestedTables(content));
        }
      }
    }
  }

  return tables;
}

/**
 * Get plain text from entire document body
 */
export function getDocumentText(body: DocumentBody): string {
  const lines: string[] = [];

  for (const block of body.content) {
    if (block.type === 'paragraph') {
      lines.push(getParagraphText(block));
    } else if (block.type === 'table') {
      lines.push(getTableText(block));
    }
  }

  return lines.join('\n');
}

/**
 * Get plain text from a table
 */
function getTableText(table: Table): string {
  const lines: string[] = [];

  for (const row of table.rows) {
    const rowTexts: string[] = [];
    for (const cell of row.cells) {
      const cellTexts: string[] = [];
      for (const content of cell.content) {
        if (content.type === 'paragraph') {
          cellTexts.push(getParagraphText(content));
        } else if (content.type === 'table') {
          cellTexts.push(getTableText(content));
        }
      }
      rowTexts.push(cellTexts.join('\n'));
    }
    lines.push(rowTexts.join('\t'));
  }

  return lines.join('\n');
}

/**
 * Count total paragraphs in document
 */
export function getParagraphCount(body: DocumentBody): number {
  return getAllParagraphs(body).length;
}

/**
 * Count total words in document (approximate)
 */
export function getWordCount(body: DocumentBody): number {
  const text = getDocumentText(body);
  // Simple word counting - split by whitespace
  const words = text.trim().split(/\s+/);
  return words.length > 0 && words[0] !== '' ? words.length : 0;
}

/**
 * Count total characters in document
 */
export function getCharacterCount(body: DocumentBody): number {
  return getDocumentText(body).length;
}

/**
 * Get section count
 */
export function getSectionCount(body: DocumentBody): number {
  return body.sections?.length ?? 1;
}

/**
 * Check if document has template variables
 */
export function hasTemplateVariables(body: DocumentBody): boolean {
  return extractAllTemplateVariables(body.content).length > 0;
}

/**
 * Get document outline (first N characters of each paragraph)
 *
 * @param body - Document body
 * @param maxCharsPerPara - Max characters per paragraph (default: 100)
 * @param maxParagraphs - Max paragraphs to include (default: 50)
 * @returns Array of paragraph previews
 */
export function getDocumentOutline(
  body: DocumentBody,
  maxCharsPerPara: number = 100,
  maxParagraphs: number = 50
): string[] {
  const outline: string[] = [];
  const paragraphs = getAllParagraphs(body);

  for (let i = 0; i < Math.min(paragraphs.length, maxParagraphs); i++) {
    const text = getParagraphText(paragraphs[i]).trim();
    if (text.length > 0) {
      outline.push(
        text.length > maxCharsPerPara ? text.substring(0, maxCharsPerPara) + '...' : text
      );
    }
  }

  return outline;
}
