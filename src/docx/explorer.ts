import JSZip from 'jszip';

/**
 * Information about a single file in the DOCX ZIP
 */
export interface DocxFileInfo {
  path: string;
  size: number;
  compressedSize: number;
  isXml: boolean;
  isMedia: boolean;
  isRelationship: boolean;
}

/**
 * Complete exploration result for a DOCX file
 */
export interface DocxExploration {
  /** Total number of files in the ZIP */
  fileCount: number;

  /** Total uncompressed size in bytes */
  totalSize: number;

  /** List of all files with metadata */
  files: DocxFileInfo[];

  /** Files grouped by directory */
  directories: Map<string, DocxFileInfo[]>;

  /** XML content cache for extracted files */
  xmlCache: Map<string, string>;
}

/**
 * Format XML with proper indentation for readability
 */
function formatXml(xml: string): string {
  let formatted = '';
  let indent = 0;
  const indentSize = 2;

  // Split on tags
  const parts = xml.replace(/>\s*</g, '><').split(/(<[^>]+>)/);

  for (const part of parts) {
    if (!part.trim()) continue;

    if (part.startsWith('</')) {
      // Closing tag - decrease indent first
      indent = Math.max(0, indent - indentSize);
      formatted += ' '.repeat(indent) + part + '\n';
    } else if (part.startsWith('<?') || part.endsWith('/>')) {
      // Processing instruction or self-closing tag
      formatted += ' '.repeat(indent) + part + '\n';
    } else if (part.startsWith('<')) {
      // Opening tag
      formatted += ' '.repeat(indent) + part + '\n';
      indent += indentSize;
    } else {
      // Text content
      formatted += ' '.repeat(indent) + part + '\n';
    }
  }

  return formatted;
}

/**
 * Get the directory from a file path
 */
function getDirectory(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash === -1 ? '' : path.substring(0, lastSlash);
}

/**
 * Explore a DOCX file and return detailed structure information
 *
 * @param buffer - ArrayBuffer containing the DOCX file data
 * @returns Promise resolving to DocxExploration with file structure details
 */
export async function exploreDocx(buffer: ArrayBuffer): Promise<DocxExploration> {
  const zip = new JSZip();
  const docx = await zip.loadAsync(buffer);

  const files: DocxFileInfo[] = [];
  const directories = new Map<string, DocxFileInfo[]>();
  const xmlCache = new Map<string, string>();
  let totalSize = 0;

  for (const [path, zipEntry] of Object.entries(docx.files)) {
    if (zipEntry.dir) continue;

    const isXml = path.endsWith('.xml') || path.endsWith('.rels');
    const isMedia = path.startsWith('word/media/');
    const isRelationship = path.endsWith('.rels');

    // Get file size info
    const content = await zipEntry.async('uint8array');
    const size = content.length;

    // Compressed size approximation (JSZip doesn't expose this directly)
    const compressedSize = zipEntry._data?.compressedSize ?? size;

    totalSize += size;

    const fileInfo: DocxFileInfo = {
      path,
      size,
      compressedSize,
      isXml,
      isMedia,
      isRelationship,
    };

    files.push(fileInfo);

    // Group by directory
    const dir = getDirectory(path);
    if (!directories.has(dir)) {
      directories.set(dir, []);
    }
    directories.get(dir)!.push(fileInfo);

    // Cache XML content for quick access
    if (isXml) {
      const xmlContent = new TextDecoder().decode(content);
      xmlCache.set(path, xmlContent);
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
  };
}

/**
 * Extract and format an XML file from a DOCX
 *
 * @param exploration - DocxExploration from exploreDocx()
 * @param path - Path to the XML file within the DOCX
 * @param format - Whether to pretty-print the XML (default: true)
 * @returns The XML content as a string, or null if not found
 */
export function extractXml(
  exploration: DocxExploration,
  path: string,
  format: boolean = true
): string | null {
  const content = exploration.xmlCache.get(path);
  if (!content) return null;

  return format ? formatXml(content) : content;
}

/**
 * Print exploration summary to console
 */
export function printExplorationSummary(exploration: DocxExploration): void {
  console.log('\n=== DOCX Structure ===\n');
  console.log(`Total files: ${exploration.fileCount}`);
  console.log(`Total size: ${(exploration.totalSize / 1024).toFixed(2)} KB\n`);

  console.log('Files by directory:\n');

  for (const [dir, files] of exploration.directories) {
    const dirName = dir || '(root)';
    console.log(`📁 ${dirName}/`);

    for (const file of files) {
      const fileName = file.path.split('/').pop() || file.path;
      const sizeKb = (file.size / 1024).toFixed(2);
      const typeIcon = file.isMedia ? '🖼️' : file.isXml ? '📄' : '📦';
      console.log(`   ${typeIcon} ${fileName} (${sizeKb} KB)`);
    }
    console.log();
  }
}

/**
 * Get key DOCX structure information
 */
export function getKeyFiles(exploration: DocxExploration): {
  hasDocument: boolean;
  hasStyles: boolean;
  hasTheme: boolean;
  hasNumbering: boolean;
  hasFontTable: boolean;
  hasFootnotes: boolean;
  hasEndnotes: boolean;
  headers: string[];
  footers: string[];
  mediaFiles: string[];
} {
  const files = exploration.files.map(f => f.path);

  return {
    hasDocument: files.includes('word/document.xml'),
    hasStyles: files.includes('word/styles.xml'),
    hasTheme: files.includes('word/theme/theme1.xml'),
    hasNumbering: files.includes('word/numbering.xml'),
    hasFontTable: files.includes('word/fontTable.xml'),
    hasFootnotes: files.includes('word/footnotes.xml'),
    hasEndnotes: files.includes('word/endnotes.xml'),
    headers: files.filter(f => /word\/header\d*\.xml/.test(f)),
    footers: files.filter(f => /word\/footer\d*\.xml/.test(f)),
    mediaFiles: files.filter(f => f.startsWith('word/media/')),
  };
}
