/**
 * DOCX Repacker - Repack modified document into valid DOCX
 *
 * Takes a Document with modified content and creates a new DOCX file
 * by updating document.xml while preserving all other files from
 * the original ZIP archive.
 *
 * This ensures round-trip fidelity:
 * - styles.xml, theme1.xml, fontTable.xml remain untouched
 * - Media files preserved
 * - Relationships preserved
 * - Only document.xml is updated with new content
 *
 * OOXML Package Structure:
 * - [Content_Types].xml - Content type declarations
 * - _rels/.rels - Package relationships
 * - word/document.xml - Main document (modified)
 * - word/styles.xml - Styles (preserved)
 * - word/theme/theme1.xml - Theme (preserved)
 * - word/numbering.xml - Numbering (preserved)
 * - word/fontTable.xml - Font table (preserved)
 * - word/settings.xml - Settings (preserved)
 * - word/header*.xml - Headers (preserved)
 * - word/footer*.xml - Footers (preserved)
 * - word/footnotes.xml - Footnotes (preserved)
 * - word/endnotes.xml - Endnotes (preserved)
 * - word/media/* - Media files (preserved)
 * - word/_rels/document.xml.rels - Document relationships (preserved)
 * - docProps/* - Document properties (preserved)
 */

import JSZip from 'jszip';
import type { Document, DocumentBody, Paragraph, Table } from '../types/document';
import { serializeDocument } from './serializer/documentSerializer';
import { unzipDocx, type RawDocxContent } from './unzip';

// ============================================================================
// MAIN REPACKER
// ============================================================================

/**
 * Options for repacking DOCX
 */
export interface RepackOptions {
  /** Compression level (0-9, default: 6) */
  compressionLevel?: number;
  /** Whether to update modification date in docProps/core.xml */
  updateModifiedDate?: boolean;
  /** Custom modifier name for lastModifiedBy */
  modifiedBy?: string;
}

/**
 * Repack a Document into a valid DOCX file
 *
 * @param doc - Document with modified content
 * @param options - Optional repack options
 * @returns Promise resolving to DOCX as ArrayBuffer
 * @throws Error if document has no original buffer for round-trip
 */
export async function repackDocx(
  doc: Document,
  options: RepackOptions = {}
): Promise<ArrayBuffer> {
  // Validate we have an original buffer to base on
  if (!doc.originalBuffer) {
    throw new Error(
      'Cannot repack document: no original buffer for round-trip. ' +
      'Use createDocx() for new documents.'
    );
  }

  const { compressionLevel = 6, updateModifiedDate = true, modifiedBy } = options;

  // Load the original ZIP
  const originalZip = await JSZip.loadAsync(doc.originalBuffer);

  // Create a new ZIP with all original files
  const newZip = new JSZip();

  // Copy all files from original ZIP
  for (const [path, file] of Object.entries(originalZip.files)) {
    // Skip directories
    if (file.dir) {
      newZip.folder(path.replace(/\/$/, ''));
      continue;
    }

    // Get original file content
    const content = await file.async('arraybuffer');

    // Add to new ZIP (we'll update specific files below)
    newZip.file(path, content, {
      compression: 'DEFLATE',
      compressionOptions: { level: compressionLevel },
    });
  }

  // Serialize and update document.xml
  const documentXml = serializeDocument(doc);
  newZip.file('word/document.xml', documentXml, {
    compression: 'DEFLATE',
    compressionOptions: { level: compressionLevel },
  });

  // Optionally update modification date in docProps/core.xml
  if (updateModifiedDate) {
    const corePropsPath = 'docProps/core.xml';
    const corePropsFile = originalZip.file(corePropsPath);

    if (corePropsFile) {
      const originalCoreProps = await corePropsFile.async('text');
      const updatedCoreProps = updateCoreProperties(originalCoreProps, {
        updateModifiedDate,
        modifiedBy,
      });

      newZip.file(corePropsPath, updatedCoreProps, {
        compression: 'DEFLATE',
        compressionOptions: { level: compressionLevel },
      });
    }
  }

  // Generate the new DOCX file
  const arrayBuffer = await newZip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: compressionLevel },
  });

  return arrayBuffer;
}

/**
 * Repack a Document using raw content for more control
 *
 * @param doc - Document with modified content
 * @param rawContent - Original raw content from unzipDocx
 * @param options - Optional repack options
 * @returns Promise resolving to DOCX as ArrayBuffer
 */
export async function repackDocxFromRaw(
  doc: Document,
  rawContent: RawDocxContent,
  options: RepackOptions = {}
): Promise<ArrayBuffer> {
  const { compressionLevel = 6, updateModifiedDate = true, modifiedBy } = options;

  // Create a new ZIP with all original files
  const newZip = new JSZip();

  // Copy all files from original ZIP
  for (const [path, file] of Object.entries(rawContent.originalZip.files)) {
    // Skip directories
    if (file.dir) {
      newZip.folder(path.replace(/\/$/, ''));
      continue;
    }

    // Get original file content
    const content = await file.async('arraybuffer');

    // Add to new ZIP
    newZip.file(path, content, {
      compression: 'DEFLATE',
      compressionOptions: { level: compressionLevel },
    });
  }

  // Serialize and update document.xml
  const documentXml = serializeDocument(doc);
  newZip.file('word/document.xml', documentXml, {
    compression: 'DEFLATE',
    compressionOptions: { level: compressionLevel },
  });

  // Optionally update core properties
  if (updateModifiedDate && rawContent.corePropsXml) {
    const updatedCoreProps = updateCoreProperties(rawContent.corePropsXml, {
      updateModifiedDate,
      modifiedBy,
    });

    newZip.file('docProps/core.xml', updatedCoreProps, {
      compression: 'DEFLATE',
      compressionOptions: { level: compressionLevel },
    });
  }

  // Generate the new DOCX file
  const arrayBuffer = await newZip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: compressionLevel },
  });

  return arrayBuffer;
}

// ============================================================================
// SELECTIVE UPDATES
// ============================================================================

/**
 * Update only document.xml in a DOCX buffer (minimal changes)
 *
 * @param originalBuffer - Original DOCX as ArrayBuffer
 * @param newDocumentXml - New document.xml content
 * @param options - Optional repack options
 * @returns Promise resolving to DOCX as ArrayBuffer
 */
export async function updateDocumentXml(
  originalBuffer: ArrayBuffer,
  newDocumentXml: string,
  options: RepackOptions = {}
): Promise<ArrayBuffer> {
  const { compressionLevel = 6 } = options;

  // Load original ZIP
  const zip = await JSZip.loadAsync(originalBuffer);

  // Update document.xml
  zip.file('word/document.xml', newDocumentXml, {
    compression: 'DEFLATE',
    compressionOptions: { level: compressionLevel },
  });

  // Generate new DOCX
  return zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: compressionLevel },
  });
}

/**
 * Update a specific XML file in a DOCX buffer
 *
 * @param originalBuffer - Original DOCX as ArrayBuffer
 * @param path - Path within the ZIP (e.g., "word/styles.xml")
 * @param content - New XML content
 * @param options - Optional repack options
 * @returns Promise resolving to DOCX as ArrayBuffer
 */
export async function updateXmlFile(
  originalBuffer: ArrayBuffer,
  path: string,
  content: string,
  options: RepackOptions = {}
): Promise<ArrayBuffer> {
  const { compressionLevel = 6 } = options;

  const zip = await JSZip.loadAsync(originalBuffer);

  zip.file(path, content, {
    compression: 'DEFLATE',
    compressionOptions: { level: compressionLevel },
  });

  return zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: compressionLevel },
  });
}

/**
 * Update multiple files in a DOCX buffer
 *
 * @param originalBuffer - Original DOCX as ArrayBuffer
 * @param updates - Map of path -> content for files to update
 * @param options - Optional repack options
 * @returns Promise resolving to DOCX as ArrayBuffer
 */
export async function updateMultipleFiles(
  originalBuffer: ArrayBuffer,
  updates: Map<string, string | ArrayBuffer>,
  options: RepackOptions = {}
): Promise<ArrayBuffer> {
  const { compressionLevel = 6 } = options;

  const zip = await JSZip.loadAsync(originalBuffer);

  for (const [path, content] of updates) {
    zip.file(path, content, {
      compression: 'DEFLATE',
      compressionOptions: { level: compressionLevel },
    });
  }

  return zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: compressionLevel },
  });
}

// ============================================================================
// RELATIONSHIP MANAGEMENT
// ============================================================================

/**
 * Add a new relationship to document.xml.rels
 *
 * @param originalBuffer - Original DOCX as ArrayBuffer
 * @param relationship - New relationship to add
 * @returns Promise resolving to { buffer: ArrayBuffer, rId: string }
 */
export async function addRelationship(
  originalBuffer: ArrayBuffer,
  relationship: {
    type: string;
    target: string;
    targetMode?: 'External' | 'Internal';
  }
): Promise<{ buffer: ArrayBuffer; rId: string }> {
  const zip = await JSZip.loadAsync(originalBuffer);

  // Read existing relationships
  const relsPath = 'word/_rels/document.xml.rels';
  const relsFile = zip.file(relsPath);

  if (!relsFile) {
    throw new Error('document.xml.rels not found in DOCX');
  }

  const relsXml = await relsFile.async('text');

  // Find highest existing rId
  const rIdMatches = relsXml.matchAll(/Id="rId(\d+)"/g);
  let maxId = 0;
  for (const match of rIdMatches) {
    const id = parseInt(match[1], 10);
    if (id > maxId) maxId = id;
  }

  // Generate new rId
  const newRId = `rId${maxId + 1}`;

  // Build new relationship element
  const targetModeAttr = relationship.targetMode === 'External'
    ? ' TargetMode="External"'
    : '';

  const newRelElement = `<Relationship Id="${newRId}" Type="${relationship.type}" Target="${escapeXmlAttr(relationship.target)}"${targetModeAttr}/>`;

  // Insert before closing tag
  const updatedRelsXml = relsXml.replace(
    '</Relationships>',
    `${newRelElement}</Relationships>`
  );

  // Update the ZIP
  zip.file(relsPath, updatedRelsXml);

  const buffer = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return { buffer, rId: newRId };
}

/**
 * Add a media file to the DOCX
 *
 * @param originalBuffer - Original DOCX as ArrayBuffer
 * @param filename - Filename for the media (e.g., "image1.png")
 * @param data - Binary data for the media file
 * @param mimeType - MIME type (e.g., "image/png")
 * @returns Promise resolving to { buffer: ArrayBuffer, rId: string, path: string }
 */
export async function addMedia(
  originalBuffer: ArrayBuffer,
  filename: string,
  data: ArrayBuffer,
  mimeType: string
): Promise<{ buffer: ArrayBuffer; rId: string; path: string }> {
  const zip = await JSZip.loadAsync(originalBuffer);

  // Determine media path
  const mediaPath = `word/media/${filename}`;

  // Add media file
  zip.file(mediaPath, data);

  // Add relationship
  const relResult = await addRelationship(await zip.generateAsync({ type: 'arraybuffer' }), {
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
    target: `media/${filename}`,
  });

  // Update content types if needed
  const contentTypesFile = zip.file('[Content_Types].xml');
  if (contentTypesFile) {
    const contentTypesXml = await contentTypesFile.async('text');
    const extension = filename.split('.').pop()?.toLowerCase() || '';

    // Check if extension is already registered
    const hasExtension = contentTypesXml.includes(`Extension="${extension}"`);

    if (!hasExtension && extension) {
      // Add content type for this extension
      const contentType = getContentTypeForExtension(extension, mimeType);
      const extensionElement = `<Default Extension="${extension}" ContentType="${contentType}"/>`;

      // Insert after other defaults
      const updatedContentTypes = contentTypesXml.replace(
        '</Types>',
        `${extensionElement}</Types>`
      );

      const finalZip = await JSZip.loadAsync(relResult.buffer);
      finalZip.file('[Content_Types].xml', updatedContentTypes);

      return {
        buffer: await finalZip.generateAsync({
          type: 'arraybuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        }),
        rId: relResult.rId,
        path: mediaPath,
      };
    }
  }

  return {
    buffer: relResult.buffer,
    rId: relResult.rId,
    path: mediaPath,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Update core properties XML with new modification date
 */
function updateCoreProperties(
  corePropsXml: string,
  options: { updateModifiedDate?: boolean; modifiedBy?: string }
): string {
  let result = corePropsXml;

  if (options.updateModifiedDate) {
    const now = new Date().toISOString();

    // Update dcterms:modified
    if (result.includes('<dcterms:modified')) {
      result = result.replace(
        /<dcterms:modified[^>]*>[^<]*<\/dcterms:modified>/,
        `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>`
      );
    } else {
      // Add modified date if not present
      result = result.replace(
        '</cp:coreProperties>',
        `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`
      );
    }
  }

  if (options.modifiedBy) {
    // Update cp:lastModifiedBy
    if (result.includes('<cp:lastModifiedBy')) {
      result = result.replace(
        /<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/,
        `<cp:lastModifiedBy>${escapeXmlText(options.modifiedBy)}</cp:lastModifiedBy>`
      );
    } else {
      // Add lastModifiedBy if not present
      result = result.replace(
        '</cp:coreProperties>',
        `<cp:lastModifiedBy>${escapeXmlText(options.modifiedBy)}</cp:lastModifiedBy></cp:coreProperties>`
      );
    }
  }

  return result;
}

/**
 * Escape special XML characters in text content
 */
function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape special XML characters in attribute values
 */
function escapeXmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Get content type for a file extension
 */
function getContentTypeForExtension(extension: string, mimeType: string): string {
  // Use provided mime type or fall back to common types
  if (mimeType) return mimeType;

  const contentTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    wmf: 'image/x-wmf',
    emf: 'image/x-emf',
  };

  return contentTypes[extension] || 'application/octet-stream';
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that a buffer is a valid DOCX file
 *
 * @param buffer - Buffer to validate
 * @returns Promise resolving to validation result
 */
export async function validateDocx(buffer: ArrayBuffer): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const zip = await JSZip.loadAsync(buffer);

    // Check for required files
    const requiredFiles = [
      '[Content_Types].xml',
      'word/document.xml',
    ];

    for (const file of requiredFiles) {
      if (!zip.file(file)) {
        errors.push(`Missing required file: ${file}`);
      }
    }

    // Check for recommended files
    const recommendedFiles = [
      '_rels/.rels',
      'word/_rels/document.xml.rels',
      'word/styles.xml',
    ];

    for (const file of recommendedFiles) {
      if (!zip.file(file)) {
        warnings.push(`Missing recommended file: ${file}`);
      }
    }

    // Validate document.xml is valid XML
    const docFile = zip.file('word/document.xml');
    if (docFile) {
      const docXml = await docFile.async('text');

      // Basic XML validation
      if (!docXml.includes('<?xml')) {
        warnings.push('document.xml missing XML declaration');
      }

      if (!docXml.includes('<w:document')) {
        errors.push('document.xml missing w:document element');
      }

      if (!docXml.includes('<w:body>')) {
        errors.push('document.xml missing w:body element');
      }
    }

    // Validate Content_Types.xml
    const ctFile = zip.file('[Content_Types].xml');
    if (ctFile) {
      const ctXml = await ctFile.async('text');

      if (!ctXml.includes('word/document.xml') && !ctXml.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml')) {
        warnings.push('Content_Types.xml may be missing document.xml type declaration');
      }
    }

  } catch (error) {
    errors.push(`Failed to read as ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if buffer looks like a DOCX file (quick check)
 *
 * @param buffer - Buffer to check
 * @returns true if buffer starts with ZIP signature
 */
export function isDocxBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;

  const view = new Uint8Array(buffer);

  // ZIP file signature: PK (0x50, 0x4B)
  return view[0] === 0x50 && view[1] === 0x4B;
}

// ============================================================================
// CREATE NEW DOCX
// ============================================================================

/**
 * Create a new empty DOCX file
 *
 * @returns Promise resolving to minimal DOCX as ArrayBuffer
 */
export async function createEmptyDocx(): Promise<ArrayBuffer> {
  const zip = new JSZip();

  // Content Types
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);

  // Package relationships
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

  // Document relationships
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

  // Document
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:r>
        <w:t></w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`);

  // Minimal styles
  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:sz w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="200" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
</w:styles>`);

  // Core properties
  const now = new Date().toISOString();
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>EigenPal DOCX Editor</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`);

  // App properties
  zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>EigenPal DOCX Editor</Application>
  <AppVersion>1.0.0</AppVersion>
</Properties>`);

  return zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * Create a new DOCX from a Document (without requiring original buffer)
 *
 * @param doc - Document to serialize
 * @returns Promise resolving to DOCX as ArrayBuffer
 */
export async function createDocx(doc: Document): Promise<ArrayBuffer> {
  // Start with an empty DOCX
  const emptyBuffer = await createEmptyDocx();

  // Add document as original buffer
  const docWithBuffer: Document = {
    ...doc,
    originalBuffer: emptyBuffer,
  };

  // Repack with the document content
  return repackDocx(docWithBuffer);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default repackDocx;
