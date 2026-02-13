/**
 * DOCX Unzipper
 *
 * Extracts all files from a DOCX ZIP archive and organizes them
 * into a structured format for further processing.
 *
 * A DOCX file is a ZIP archive containing:
 * - [Content_Types].xml - Content type declarations
 * - word/document.xml - Main document content
 * - word/styles.xml - Style definitions
 * - word/theme/theme1.xml - Theme colors and fonts
 * - word/numbering.xml - List/numbering definitions
 * - word/fontTable.xml - Font declarations
 * - word/settings.xml - Document settings
 * - word/webSettings.xml - Web settings
 * - word/header*.xml - Header content
 * - word/footer*.xml - Footer content
 * - word/footnotes.xml - Footnotes
 * - word/endnotes.xml - Endnotes
 * - word/media/* - Embedded images and media
 * - word/_rels/document.xml.rels - Relationships
 * - _rels/.rels - Package relationships
 * - docProps/core.xml - Core properties
 * - docProps/app.xml - Application properties
 */

import JSZip from 'jszip';

/**
 * Raw extracted content from a DOCX file
 */
export interface RawDocxContent {
  // Main document
  documentXml: string | null;

  // Styles and formatting
  stylesXml: string | null;
  themeXml: string | null;
  numberingXml: string | null;
  fontTableXml: string | null;
  settingsXml: string | null;
  webSettingsXml: string | null;

  // Headers and footers (keyed by filename, e.g., "header1.xml")
  headers: Map<string, string>;
  footers: Map<string, string>;

  // Footnotes and endnotes
  footnotesXml: string | null;
  endnotesXml: string | null;

  // Comments
  commentsXml: string | null;
  commentsExtensibleXml: string | null;

  // Relationships
  documentRels: string | null;
  packageRels: string | null;

  // Content types
  contentTypesXml: string | null;

  // Document properties
  corePropsXml: string | null;
  appPropsXml: string | null;
  customPropsXml: string | null;

  // Media files (images, etc.) - keyed by path, e.g., "word/media/image1.png"
  media: Map<string, ArrayBuffer>;

  // Embedded fonts - keyed by path
  fonts: Map<string, ArrayBuffer>;

  // All XML files (for any we might have missed)
  allXml: Map<string, string>;

  // Original ZIP for round-trip preservation
  originalZip: JSZip;

  // Original buffer for round-trip
  originalBuffer: ArrayBuffer;
}

/**
 * Extract all content from a DOCX file
 *
 * @param buffer - DOCX file as ArrayBuffer
 * @returns Promise resolving to extracted content
 */
export async function unzipDocx(buffer: ArrayBuffer): Promise<RawDocxContent> {
  const zip = await JSZip.loadAsync(buffer);

  const content: RawDocxContent = {
    documentXml: null,
    stylesXml: null,
    themeXml: null,
    numberingXml: null,
    fontTableXml: null,
    settingsXml: null,
    webSettingsXml: null,
    headers: new Map(),
    footers: new Map(),
    footnotesXml: null,
    endnotesXml: null,
    commentsXml: null,
    commentsExtensibleXml: null,
    documentRels: null,
    packageRels: null,
    contentTypesXml: null,
    corePropsXml: null,
    appPropsXml: null,
    customPropsXml: null,
    media: new Map(),
    fonts: new Map(),
    allXml: new Map(),
    originalZip: zip,
    originalBuffer: buffer,
  };

  // Process each file in the ZIP
  for (const [path, file] of Object.entries(zip.files)) {
    // Skip directories
    if (file.dir) continue;

    const lowerPath = path.toLowerCase();

    // Determine file type and extract
    if (lowerPath.endsWith('.xml') || lowerPath.endsWith('.rels')) {
      const xmlContent = await file.async('text');
      content.allXml.set(path, xmlContent);

      // Categorize known XML files
      if (lowerPath === 'word/document.xml') {
        content.documentXml = xmlContent;
      } else if (lowerPath === 'word/styles.xml') {
        content.stylesXml = xmlContent;
      } else if (lowerPath === 'word/theme/theme1.xml') {
        content.themeXml = xmlContent;
      } else if (lowerPath === 'word/numbering.xml') {
        content.numberingXml = xmlContent;
      } else if (lowerPath === 'word/fonttable.xml') {
        content.fontTableXml = xmlContent;
      } else if (lowerPath === 'word/settings.xml') {
        content.settingsXml = xmlContent;
      } else if (lowerPath === 'word/websettings.xml') {
        content.webSettingsXml = xmlContent;
      } else if (lowerPath === 'word/footnotes.xml') {
        content.footnotesXml = xmlContent;
      } else if (lowerPath === 'word/endnotes.xml') {
        content.endnotesXml = xmlContent;
      } else if (lowerPath === 'word/comments.xml') {
        content.commentsXml = xmlContent;
      } else if (
        lowerPath === 'word/commentsextensible.xml' ||
        lowerPath === 'word/commentsextended.xml'
      ) {
        // Prefer commentsExtensible (Word 2016+), fall back to commentsExtended
        if (!content.commentsExtensibleXml) {
          content.commentsExtensibleXml = xmlContent;
        }
      } else if (lowerPath === 'word/_rels/document.xml.rels') {
        content.documentRels = xmlContent;
      } else if (lowerPath === '_rels/.rels') {
        content.packageRels = xmlContent;
      } else if (lowerPath === '[content_types].xml') {
        content.contentTypesXml = xmlContent;
      } else if (lowerPath === 'docprops/core.xml') {
        content.corePropsXml = xmlContent;
      } else if (lowerPath === 'docprops/app.xml') {
        content.appPropsXml = xmlContent;
      } else if (lowerPath === 'docprops/custom.xml') {
        content.customPropsXml = xmlContent;
      } else if (lowerPath.match(/^word\/header\d+\.xml$/)) {
        const filename = path.split('/').pop() || path;
        content.headers.set(filename, xmlContent);
      } else if (lowerPath.match(/^word\/footer\d+\.xml$/)) {
        const filename = path.split('/').pop() || path;
        content.footers.set(filename, xmlContent);
      }
    } else if (lowerPath.startsWith('word/media/')) {
      // Media files (images, etc.)
      const binaryContent = await file.async('arraybuffer');
      content.media.set(path, binaryContent);
    } else if (lowerPath.startsWith('word/fonts/')) {
      // Embedded fonts
      const binaryContent = await file.async('arraybuffer');
      content.fonts.set(path, binaryContent);
    }
  }

  return content;
}

/**
 * Get a list of all files in the DOCX
 *
 * @param content - Extracted DOCX content
 * @returns Array of file paths
 */
export function getFileList(content: RawDocxContent): string[] {
  const files: string[] = [];

  for (const path of Object.keys(content.originalZip.files)) {
    if (!content.originalZip.files[path].dir) {
      files.push(path);
    }
  }

  return files.sort();
}

/**
 * Get the MIME type for a media file based on extension
 *
 * @param path - File path
 * @returns MIME type string
 */
export function getMediaMimeType(path: string): string {
  const ext = path.toLowerCase().split('.').pop();

  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    case 'tif':
    case 'tiff':
      return 'image/tiff';
    case 'wmf':
      return 'image/x-wmf';
    case 'emf':
      return 'image/x-emf';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Convert media file to data URL
 *
 * @param data - Binary data
 * @param mimeType - MIME type
 * @returns Data URL string
 */
export function mediaToDataUrl(data: ArrayBuffer, mimeType: string): string {
  const bytes = new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Extract a specific file from the original ZIP
 *
 * @param content - Extracted DOCX content
 * @param path - File path within the ZIP
 * @returns File content as string or ArrayBuffer, or null if not found
 */
export async function extractFile(
  content: RawDocxContent,
  path: string
): Promise<string | ArrayBuffer | null> {
  const file = content.originalZip.file(path);
  if (!file) return null;

  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith('.xml') || lowerPath.endsWith('.rels')) {
    return file.async('text');
  } else {
    return file.async('arraybuffer');
  }
}

/**
 * Check if a file exists in the DOCX
 *
 * @param content - Extracted DOCX content
 * @param path - File path to check
 * @returns true if file exists
 */
export function hasFile(content: RawDocxContent, path: string): boolean {
  return content.originalZip.file(path) !== null;
}

/**
 * Get summary of DOCX content
 *
 * @param content - Extracted DOCX content
 * @returns Object with file counts and presence flags
 */
export function getContentSummary(content: RawDocxContent): {
  hasDocument: boolean;
  hasStyles: boolean;
  hasTheme: boolean;
  hasNumbering: boolean;
  hasFontTable: boolean;
  hasFootnotes: boolean;
  hasEndnotes: boolean;
  hasComments: boolean;
  headerCount: number;
  footerCount: number;
  mediaCount: number;
  fontCount: number;
  totalFiles: number;
} {
  return {
    hasDocument: content.documentXml !== null,
    hasStyles: content.stylesXml !== null,
    hasTheme: content.themeXml !== null,
    hasNumbering: content.numberingXml !== null,
    hasFontTable: content.fontTableXml !== null,
    hasFootnotes: content.footnotesXml !== null,
    hasEndnotes: content.endnotesXml !== null,
    hasComments: content.commentsXml !== null,
    headerCount: content.headers.size,
    footerCount: content.footers.size,
    mediaCount: content.media.size,
    fontCount: content.fonts.size,
    totalFiles: Object.keys(content.originalZip.files).filter(
      (p) => !content.originalZip.files[p].dir
    ).length,
  };
}
