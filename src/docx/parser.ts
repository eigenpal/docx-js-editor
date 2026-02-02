/**
 * Main Parser Orchestrator - Unified parseDocx function
 *
 * Coordinates all sub-parsers to produce a complete Document model.
 * Handles loading order, dependency resolution, and font preloading.
 *
 * Parsing order:
 * 1. Unzip DOCX package
 * 2. Parse relationships
 * 3. Parse theme (needed for style color/font resolution)
 * 4. Parse styles (depends on theme)
 * 5. Parse numbering
 * 6. Parse document body (depends on styles, theme, numbering, rels)
 * 7. Parse headers/footers (depends on styles, theme, numbering, rels)
 * 8. Parse footnotes/endnotes (depends on styles, theme, numbering, rels)
 * 9. Extract and load fonts
 * 10. Build media file map
 * 11. Assemble final Document
 */

import type {
  Document,
  DocxPackage,
  DocumentBody,
  Theme,
  Footnote,
  Endnote,
  HeaderFooter,
  RelationshipMap,
  MediaFile,
  StyleDefinitions,
} from '../types/document';
import { unzipDocx, getMediaMimeType, type RawDocxContent } from './unzip';
import { parseRelationships } from './relsParser';
import { parseTheme } from './themeParser';
import { parseStyles, parseStyleDefinitions, type StyleMap } from './styleParser';
import { parseNumbering, type NumberingMap } from './numberingParser';
import { parseDocumentBody, extractAllTemplateVariables } from './documentParser';
import { parseHeader, parseFooter } from './headerFooterParser';
import { parseFootnotes, parseEndnotes } from './footnoteParser';
import { loadFonts } from '../utils/fontLoader';
import { getGoogleFontsToLoad } from '../utils/fontResolver';

// ============================================================================
// PROGRESS CALLBACK
// ============================================================================

/**
 * Progress callback for tracking parsing stages
 */
export type ProgressCallback = (stage: string, percent: number) => void;

/**
 * Parsing options
 */
export interface ParseOptions {
  /** Progress callback for tracking parsing stages */
  onProgress?: ProgressCallback;
  /** Whether to preload fonts (default: true) */
  preloadFonts?: boolean;
  /** Whether to parse headers/footers (default: true) */
  parseHeadersFooters?: boolean;
  /** Whether to parse footnotes/endnotes (default: true) */
  parseNotes?: boolean;
  /** Whether to detect template variables (default: true) */
  detectVariables?: boolean;
}

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse a DOCX file into a complete Document model
 *
 * @param buffer - DOCX file as ArrayBuffer
 * @param options - Parsing options
 * @returns Promise resolving to Document
 * @throws Error if parsing fails
 */
export async function parseDocx(
  buffer: ArrayBuffer,
  options: ParseOptions = {}
): Promise<Document> {
  const {
    onProgress = () => {},
    preloadFonts = true,
    parseHeadersFooters = true,
    parseNotes = true,
    detectVariables = true,
  } = options;

  const warnings: string[] = [];

  try {
    // ========================================================================
    // STAGE 1: Unzip DOCX package (0-10%)
    // ========================================================================
    onProgress('Extracting DOCX...', 0);
    const raw = await unzipDocx(buffer);
    onProgress('Extracted DOCX', 10);

    // ========================================================================
    // STAGE 2: Parse relationships (10-15%)
    // ========================================================================
    onProgress('Parsing relationships...', 10);
    const rels = raw.documentRels ? parseRelationships(raw.documentRels) : new Map();
    onProgress('Parsed relationships', 15);

    // ========================================================================
    // STAGE 3: Parse theme (15-20%)
    // ========================================================================
    onProgress('Parsing theme...', 15);
    const theme = parseTheme(raw.themeXml);
    onProgress('Parsed theme', 20);

    // ========================================================================
    // STAGE 4: Parse styles (20-30%)
    // ========================================================================
    onProgress('Parsing styles...', 20);
    let styles: StyleMap | null = null;
    let styleDefinitions: StyleDefinitions | undefined;

    if (raw.stylesXml) {
      styles = parseStyles(raw.stylesXml, theme);
      styleDefinitions = parseStyleDefinitions(raw.stylesXml, theme);
    }
    onProgress('Parsed styles', 30);

    // ========================================================================
    // STAGE 5: Parse numbering (30-35%)
    // ========================================================================
    onProgress('Parsing numbering...', 30);
    const numbering = parseNumbering(raw.numberingXml);
    onProgress('Parsed numbering', 35);

    // ========================================================================
    // STAGE 6: Build media file map (35-40%)
    // ========================================================================
    onProgress('Processing media files...', 35);
    const media = buildMediaMap(raw, rels);
    onProgress('Processed media', 40);

    // ========================================================================
    // STAGE 7: Parse document body (40-55%)
    // ========================================================================
    onProgress('Parsing document body...', 40);
    let documentBody: DocumentBody = { content: [] };

    if (raw.documentXml) {
      documentBody = parseDocumentBody(raw.documentXml, styles, theme, numbering, rels, media);
    } else {
      warnings.push('No document.xml found in DOCX');
    }
    onProgress('Parsed document body', 55);

    // ========================================================================
    // STAGE 8: Parse headers/footers (55-65%)
    // ========================================================================
    let headers: Map<string, HeaderFooter> | undefined;
    let footers: Map<string, HeaderFooter> | undefined;

    if (parseHeadersFooters) {
      onProgress('Parsing headers/footers...', 55);
      const { headers: h, footers: f } = parseHeadersAndFooters(
        raw,
        styles,
        theme,
        numbering,
        rels,
        media
      );
      headers = h;
      footers = f;
      onProgress('Parsed headers/footers', 65);
    } else {
      onProgress('Skipping headers/footers', 65);
    }

    // ========================================================================
    // STAGE 9: Parse footnotes/endnotes (65-75%)
    // ========================================================================
    let footnotes: Footnote[] | undefined;
    let endnotes: Endnote[] | undefined;

    if (parseNotes) {
      onProgress('Parsing footnotes/endnotes...', 65);
      const { footnotes: fn, endnotes: en } = parseNotesContent(
        raw,
        styles,
        theme,
        numbering,
        rels,
        media
      );
      footnotes = fn;
      endnotes = en;
      onProgress('Parsed footnotes/endnotes', 75);
    } else {
      onProgress('Skipping footnotes/endnotes', 75);
    }

    // ========================================================================
    // STAGE 10: Detect template variables (75-80%)
    // ========================================================================
    let templateVariables: string[] | undefined;

    if (detectVariables) {
      onProgress('Detecting template variables...', 75);
      templateVariables = extractAllTemplateVariables(documentBody.content);
      onProgress('Detected variables', 80);
    } else {
      onProgress('Skipping variable detection', 80);
    }

    // ========================================================================
    // STAGE 11: Extract and load fonts (80-95%)
    // ========================================================================
    if (preloadFonts) {
      onProgress('Loading fonts...', 80);
      await loadDocumentFonts(theme, styleDefinitions, documentBody);
      onProgress('Loaded fonts', 95);
    } else {
      onProgress('Skipping font loading', 95);
    }

    // ========================================================================
    // STAGE 12: Assemble final Document (95-100%)
    // ========================================================================
    onProgress('Assembling document...', 95);

    const pkg: DocxPackage = {
      document: documentBody,
      styles: styleDefinitions,
      theme,
      numbering: numbering.definitions,
      headers,
      footers,
      footnotes,
      endnotes,
      relationships: rels,
      media,
    };

    const document: Document = {
      package: pkg,
      originalBuffer: buffer,
      templateVariables,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    onProgress('Complete', 100);
    return document;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse DOCX: ${message}`);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build media file map from raw content and relationships
 */
function buildMediaMap(raw: RawDocxContent, _rels: RelationshipMap): Map<string, MediaFile> {
  const media = new Map<string, MediaFile>();

  // Process each media file
  for (const [path, data] of raw.media.entries()) {
    const filename = path.split('/').pop() || path;
    const mimeType = getMediaMimeType(path);

    // Create a data URL for the image
    const bytes = new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const mediaFile: MediaFile = {
      path,
      filename,
      mimeType,
      data,
      dataUrl,
    };

    // Store by path and also by relationship target path
    media.set(path, mediaFile);

    // Also map normalized paths (without "word/" prefix)
    const normalizedPath = path.replace(/^word\//, '');
    if (normalizedPath !== path) {
      media.set(normalizedPath, mediaFile);
    }
  }

  return media;
}

/**
 * Parse headers and footers from raw content
 */
function parseHeadersAndFooters(
  raw: RawDocxContent,
  styles: StyleMap | null,
  theme: Theme | null,
  numbering: NumberingMap | null,
  rels: RelationshipMap,
  media: Map<string, MediaFile>
): { headers: Map<string, HeaderFooter>; footers: Map<string, HeaderFooter> } {
  const headers = new Map<string, HeaderFooter>();
  const footers = new Map<string, HeaderFooter>();

  // We need to map the relationship IDs to header/footer files
  // The relationships tell us which rId maps to which header/footer file

  // Find header/footer references in relationships
  for (const [rId, rel] of rels.entries()) {
    if (rel.type === 'header' && rel.target) {
      // Get the header XML for this relationship
      const filename = rel.target.split('/').pop() || rel.target;
      const headerXml = raw.headers.get(filename);

      if (headerXml) {
        const header = parseHeader(
          headerXml,
          'default', // We'll update this based on sectPr references
          styles,
          theme,
          numbering,
          rels,
          media
        );
        headers.set(rId, header);
      }
    } else if (rel.type === 'footer' && rel.target) {
      const filename = rel.target.split('/').pop() || rel.target;
      const footerXml = raw.footers.get(filename);

      if (footerXml) {
        const footer = parseFooter(footerXml, 'default', styles, theme, numbering, rels, media);
        footers.set(rId, footer);
      }
    }
  }

  return { headers, footers };
}

/**
 * Parse footnotes and endnotes from raw content
 */
function parseNotesContent(
  raw: RawDocxContent,
  styles: StyleMap | null,
  theme: Theme | null,
  numbering: NumberingMap | null,
  rels: RelationshipMap,
  media: Map<string, MediaFile>
): { footnotes: Footnote[]; endnotes: Endnote[] } {
  const footnoteMap = parseFootnotes(raw.footnotesXml, styles, theme, numbering, rels, media);

  const endnoteMap = parseEndnotes(raw.endnotesXml, styles, theme, numbering, rels, media);

  return {
    footnotes: footnoteMap.getNormalFootnotes(),
    endnotes: endnoteMap.getNormalEndnotes(),
  };
}

/**
 * Extract fonts from document and load them
 */
async function loadDocumentFonts(
  theme: Theme | null,
  styleDefinitions: StyleDefinitions | undefined,
  _documentBody: DocumentBody
): Promise<void> {
  const docxFonts: string[] = [];

  // Extract fonts from theme
  if (theme?.fontScheme) {
    const { majorFont, minorFont } = theme.fontScheme;
    if (majorFont?.latin) docxFonts.push(majorFont.latin);
    if (minorFont?.latin) docxFonts.push(minorFont.latin);
  }

  // Extract fonts from style defaults
  if (styleDefinitions?.docDefaults?.rPr?.fontFamily?.ascii) {
    docxFonts.push(styleDefinitions.docDefaults.rPr.fontFamily.ascii);
  }

  // Get Google Font equivalents
  const googleFonts = getGoogleFontsToLoad(docxFonts);

  // Load fonts
  if (googleFonts.length > 0) {
    try {
      await loadFonts(googleFonts);
    } catch (error) {
      // Font loading is non-critical, continue without fonts
      console.warn('Failed to load some fonts:', error);
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick parse - parse a DOCX without font loading
 * Useful for quick content extraction or when fonts aren't needed
 */
export async function quickParseDocx(buffer: ArrayBuffer): Promise<Document> {
  return parseDocx(buffer, {
    preloadFonts: false,
    parseHeadersFooters: false,
    parseNotes: false,
    detectVariables: true,
  });
}

/**
 * Full parse - parse everything including fonts
 */
export async function fullParseDocx(
  buffer: ArrayBuffer,
  onProgress?: ProgressCallback
): Promise<Document> {
  return parseDocx(buffer, {
    onProgress,
    preloadFonts: true,
    parseHeadersFooters: true,
    parseNotes: true,
    detectVariables: true,
  });
}

/**
 * Get template variables from a DOCX without full parsing
 * Faster than full parse when you only need variables
 */
export async function getDocxVariables(buffer: ArrayBuffer): Promise<string[]> {
  const raw = await unzipDocx(buffer);

  if (!raw.documentXml) {
    return [];
  }

  // Quick parse just the document body
  const documentBody = parseDocumentBody(raw.documentXml);
  return extractAllTemplateVariables(documentBody.content);
}

/**
 * Get document summary without full parsing
 */
export async function getDocxSummary(buffer: ArrayBuffer): Promise<{
  hasDocument: boolean;
  hasStyles: boolean;
  hasTheme: boolean;
  hasNumbering: boolean;
  headerCount: number;
  footerCount: number;
  mediaCount: number;
  variableCount: number;
}> {
  const raw = await unzipDocx(buffer);
  const variables = raw.documentXml
    ? extractAllTemplateVariables(parseDocumentBody(raw.documentXml).content)
    : [];

  return {
    hasDocument: raw.documentXml !== null,
    hasStyles: raw.stylesXml !== null,
    hasTheme: raw.themeXml !== null,
    hasNumbering: raw.numberingXml !== null,
    headerCount: raw.headers.size,
    footerCount: raw.footers.size,
    mediaCount: raw.media.size,
    variableCount: variables.length,
  };
}
