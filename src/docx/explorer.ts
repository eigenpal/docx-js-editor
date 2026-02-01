/**
 * DOCX Explorer Utility
 *
 * Opens a DOCX file (which is a ZIP archive) and provides utilities
 * to explore its structure, list files, and extract/format XML content.
 */

import JSZip from 'jszip';

/**
 * Information about a single file in the DOCX ZIP archive
 */
export interface DocxFileInfo {
  /** Full path within the ZIP (e.g., "word/document.xml") */
  path: string;
  /** Uncompressed file size in bytes */
  size: number;
  /** Whether this is an XML file */
  isXml: boolean;
  /** Whether this is in the word/ directory (main content) */
  isWordContent: boolean;
  /** Whether this is a relationship file */
  isRels: boolean;
  /** Whether this is a media file (image, etc.) */
  isMedia: boolean;
}

/**
 * Result of exploring a DOCX file
 */
export interface DocxExploration {
  /** Total number of files in the archive */
  fileCount: number;
  /** Total uncompressed size of all files */
  totalSize: number;
  /** List of all files with metadata */
  files: DocxFileInfo[];
  /** Files grouped by directory */
  directories: Record<string, DocxFileInfo[]>;
  /** Pre-loaded XML content for quick access */
  xmlCache: Record<string, string>;
  /** The underlying JSZip instance for further operations */
  zip: JSZip;
}

/**
 * Key files typically found in a DOCX
 */
export interface DocxKeyFiles {
  hasDocument: boolean;
  hasStyles: boolean;
  hasTheme: boolean;
  hasNumbering: boolean;
  hasFontTable: boolean;
  hasHeaders: boolean;
  hasFooters: boolean;
  hasFootnotes: boolean;
  hasEndnotes: boolean;
  hasMedia: boolean;
  hasComments: boolean;
  headerCount: number;
  footerCount: number;
  mediaCount: number;
}

/**
 * Explore a DOCX file and return information about its structure
 *
 * @param buffer - The DOCX file as an ArrayBuffer
 * @returns Promise resolving to exploration results
 */
export async function exploreDocx(buffer: ArrayBuffer): Promise<DocxExploration> {
  const zip = await JSZip.loadAsync(buffer);

  const files: DocxFileInfo[] = [];
  let totalSize = 0;
  const directories: Record<string, DocxFileInfo[]> = {};
  const xmlCache: Record<string, string> = {};

  // Process each file in the ZIP
  for (const [path, file] of Object.entries(zip.files)) {
    // Skip directories
    if (file.dir) continue;

    // Get file info
    const content = await file.async('arraybuffer');
    const size = content.byteLength;
    totalSize += size;

    const isXml = path.endsWith('.xml') || path.endsWith('.rels');
    const isWordContent = path.startsWith('word/') && !path.includes('/_rels/');
    const isRels = path.endsWith('.rels');
    const isMedia = path.startsWith('word/media/');

    const fileInfo: DocxFileInfo = {
      path,
      size,
      isXml,
      isWordContent,
      isRels,
      isMedia,
    };

    files.push(fileInfo);

    // Group by directory
    const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '/';
    if (!directories[dir]) {
      directories[dir] = [];
    }
    directories[dir].push(fileInfo);

    // Pre-load XML files into cache
    if (isXml) {
      const textContent = await file.async('text');
      xmlCache[path] = textContent;
    }
  }

  // Sort files by path
  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    fileCount: files.length,
    totalSize,
    files,
    directories,
    xmlCache,
    zip,
  };
}

/**
 * Extract and optionally format an XML file from the exploration
 *
 * @param exploration - The exploration result
 * @param path - Path to the XML file within the DOCX
 * @param format - Whether to pretty-print the XML (default: true)
 * @returns The XML content, or null if not found
 */
export function extractXml(
  exploration: DocxExploration,
  path: string,
  format: boolean = true
): string | null {
  const content = exploration.xmlCache[path];
  if (!content) return null;

  if (!format) return content;

  // Simple XML pretty-printing
  return formatXml(content);
}

/**
 * Simple XML formatter for debugging
 */
function formatXml(xml: string): string {
  let formatted = '';
  let indent = 0;
  const INDENT_SIZE = 2;

  // Remove existing whitespace between tags
  const cleaned = xml.replace(/>\s+</g, '><').trim();

  // Process each character
  let i = 0;
  while (i < cleaned.length) {
    if (cleaned[i] === '<') {
      // Find the end of this tag
      const tagEnd = cleaned.indexOf('>', i);
      if (tagEnd === -1) break;

      const tag = cleaned.substring(i, tagEnd + 1);

      if (tag.startsWith('</')) {
        // Closing tag - decrease indent first
        indent = Math.max(0, indent - INDENT_SIZE);
        formatted += '\n' + ' '.repeat(indent) + tag;
      } else if (tag.endsWith('/>') || tag.startsWith('<?') || tag.startsWith('<!')) {
        // Self-closing tag, XML declaration, or comment
        formatted += '\n' + ' '.repeat(indent) + tag;
      } else {
        // Opening tag
        formatted += '\n' + ' '.repeat(indent) + tag;
        indent += INDENT_SIZE;
      }

      i = tagEnd + 1;
    } else {
      // Text content
      const nextTag = cleaned.indexOf('<', i);
      const text = nextTag === -1 ? cleaned.substring(i) : cleaned.substring(i, nextTag);
      if (text.trim()) {
        formatted += text;
      }
      i = nextTag === -1 ? cleaned.length : nextTag;
    }
  }

  return formatted.trim();
}

/**
 * Print a summary of the DOCX exploration to the console
 */
export function printExplorationSummary(exploration: DocxExploration): void {
  console.log('=== DOCX Exploration Summary ===');
  console.log(`Total files: ${exploration.fileCount}`);
  console.log(`Total size: ${(exploration.totalSize / 1024).toFixed(2)} KB`);
  console.log('\n--- Files ---');

  for (const file of exploration.files) {
    const flags: string[] = [];
    if (file.isXml) flags.push('XML');
    if (file.isRels) flags.push('RELS');
    if (file.isMedia) flags.push('MEDIA');

    console.log(
      `  ${file.path} (${file.size} bytes)${flags.length ? ' [' + flags.join(', ') + ']' : ''}`
    );
  }

  console.log('\n--- By Directory ---');
  for (const [dir, files] of Object.entries(exploration.directories)) {
    console.log(`  ${dir}/: ${files.length} file(s)`);
  }
}

/**
 * Get a quick summary of key DOCX files
 */
export function getKeyFiles(exploration: DocxExploration): DocxKeyFiles {
  const paths = exploration.files.map((f) => f.path);

  const headerCount = paths.filter((p) => p.match(/word\/header\d+\.xml/)).length;
  const footerCount = paths.filter((p) => p.match(/word\/footer\d+\.xml/)).length;
  const mediaCount = paths.filter((p) => p.startsWith('word/media/')).length;

  return {
    hasDocument: paths.includes('word/document.xml'),
    hasStyles: paths.includes('word/styles.xml'),
    hasTheme: paths.includes('word/theme/theme1.xml'),
    hasNumbering: paths.includes('word/numbering.xml'),
    hasFontTable: paths.includes('word/fontTable.xml'),
    hasHeaders: headerCount > 0,
    hasFooters: footerCount > 0,
    hasFootnotes: paths.includes('word/footnotes.xml'),
    hasEndnotes: paths.includes('word/endnotes.xml'),
    hasMedia: mediaCount > 0,
    hasComments: paths.includes('word/comments.xml'),
    headerCount,
    footerCount,
    mediaCount,
  };
}

/**
 * Extract raw binary content from a file in the DOCX
 * Useful for extracting images and other media
 */
export async function extractBinary(
  exploration: DocxExploration,
  path: string
): Promise<ArrayBuffer | null> {
  const file = exploration.zip.file(path);
  if (!file) return null;
  return file.async('arraybuffer');
}

/**
 * Get a list of all XML file paths in the DOCX
 */
export function getXmlPaths(exploration: DocxExploration): string[] {
  return exploration.files.filter((f) => f.isXml).map((f) => f.path);
}

/**
 * Get a list of all media file paths in the DOCX
 */
export function getMediaPaths(exploration: DocxExploration): string[] {
  return exploration.files.filter((f) => f.isMedia).map((f) => f.path);
}
