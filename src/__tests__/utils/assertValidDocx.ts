import JSZip from 'jszip';
import { expect } from 'bun:test';

/**
 * Required files that must exist in a valid DOCX file
 */
const REQUIRED_FILES = [
  '[Content_Types].xml',
  '_rels/.rels',
  'word/document.xml',
];

/**
 * Common optional files in DOCX
 */
const COMMON_FILES = [
  'word/_rels/document.xml.rels',
  'word/styles.xml',
  'word/fontTable.xml',
  'word/settings.xml',
  'word/theme/theme1.xml',
];

export interface DocxValidationResult {
  isValid: boolean;
  files: string[];
  errors: string[];
  hasStyles: boolean;
  hasTheme: boolean;
  hasFontTable: boolean;
}

/**
 * Validate the structure of a DOCX file
 * @param data - ArrayBuffer, Blob, or Uint8Array containing DOCX data
 * @returns Validation result with details about the DOCX structure
 */
export async function validateDocx(
  data: ArrayBuffer | Blob | Uint8Array
): Promise<DocxValidationResult> {
  const errors: string[] = [];
  let files: string[] = [];

  try {
    const zip = new JSZip();
    const docx = await zip.loadAsync(data);
    files = Object.keys(docx.files);

    // Check required files
    for (const requiredFile of REQUIRED_FILES) {
      if (!docx.file(requiredFile)) {
        errors.push(`Missing required file: ${requiredFile}`);
      }
    }

    // Validate Content_Types.xml structure
    const contentTypesFile = docx.file('[Content_Types].xml');
    if (contentTypesFile) {
      const contentTypes = await contentTypesFile.async('string');
      if (!contentTypes.includes('Types')) {
        errors.push('[Content_Types].xml is malformed');
      }
    }

    // Validate document.xml structure
    const documentFile = docx.file('word/document.xml');
    if (documentFile) {
      const documentXml = await documentFile.async('string');
      if (!documentXml.includes('w:document') && !documentXml.includes('<document')) {
        errors.push('word/document.xml is malformed - missing document element');
      }
      if (!documentXml.includes('w:body') && !documentXml.includes('<body')) {
        errors.push('word/document.xml is malformed - missing body element');
      }
    }

    return {
      isValid: errors.length === 0,
      files,
      errors,
      hasStyles: !!docx.file('word/styles.xml'),
      hasTheme: !!docx.file('word/theme/theme1.xml'),
      hasFontTable: !!docx.file('word/fontTable.xml'),
    };
  } catch (error) {
    errors.push(`Failed to parse DOCX: ${error instanceof Error ? error.message : String(error)}`);
    return {
      isValid: false,
      files,
      errors,
      hasStyles: false,
      hasTheme: false,
      hasFontTable: false,
    };
  }
}

/**
 * Assert that the provided data is a valid DOCX file
 * Throws an assertion error if validation fails
 * @param data - ArrayBuffer, Blob, or Uint8Array containing DOCX data
 * @param options - Optional validation options
 */
export async function assertValidDocx(
  data: ArrayBuffer | Blob | Uint8Array,
  options: {
    requireStyles?: boolean;
    requireTheme?: boolean;
    requireFontTable?: boolean;
  } = {}
): Promise<void> {
  const result = await validateDocx(data);

  if (!result.isValid) {
    throw new Error(`Invalid DOCX:\n${result.errors.join('\n')}`);
  }

  if (options.requireStyles && !result.hasStyles) {
    throw new Error('DOCX is missing styles.xml');
  }

  if (options.requireTheme && !result.hasTheme) {
    throw new Error('DOCX is missing theme1.xml');
  }

  if (options.requireFontTable && !result.hasFontTable) {
    throw new Error('DOCX is missing fontTable.xml');
  }
}

/**
 * Get the content of word/document.xml from a DOCX
 * @param data - ArrayBuffer, Blob, or Uint8Array containing DOCX data
 * @returns The document.xml content as a string
 */
export async function getDocumentXml(data: ArrayBuffer | Blob | Uint8Array): Promise<string> {
  const zip = new JSZip();
  const docx = await zip.loadAsync(data);
  const documentFile = docx.file('word/document.xml');
  if (!documentFile) {
    throw new Error('DOCX is missing word/document.xml');
  }
  return documentFile.async('string');
}

/**
 * Extract all text content from a DOCX file
 * @param data - ArrayBuffer, Blob, or Uint8Array containing DOCX data
 * @returns Plain text content extracted from the document
 */
export async function extractTextContent(data: ArrayBuffer | Blob | Uint8Array): Promise<string> {
  const documentXml = await getDocumentXml(data);
  // Simple text extraction - matches <w:t>...</w:t> content
  const textMatches = documentXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  return textMatches
    .map(match => {
      const content = match.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
      return content ? content[1] : '';
    })
    .join('');
}
