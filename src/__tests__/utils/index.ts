export { loadFixture, loadFixtureAsBlob, loadFixtureAsFile } from './loadFixture';
export {
  validateDocx,
  assertValidDocx,
  getDocumentXml,
  extractTextContent,
  type DocxValidationResult
} from './assertValidDocx';

// Re-export additional utilities for backwards compatibility
import JSZip from 'jszip';

/**
 * Extract a specific file from a DOCX
 */
export async function extractDocxFile(
  data: Blob | ArrayBuffer,
  filePath: string
): Promise<string | null> {
  const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file(filePath);
  return file ? await file.async('string') : null;
}

/**
 * Compare two DOCX files and return differences
 */
export async function compareDocx(
  original: Blob | ArrayBuffer,
  modified: Blob | ArrayBuffer
): Promise<{
  addedFiles: string[];
  removedFiles: string[];
  modifiedFiles: string[];
}> {
  const originalBuffer = original instanceof Blob ? await original.arrayBuffer() : original;
  const modifiedBuffer = modified instanceof Blob ? await modified.arrayBuffer() : modified;

  const originalZip = await JSZip.loadAsync(originalBuffer);
  const modifiedZip = await JSZip.loadAsync(modifiedBuffer);

  const originalFiles = Object.keys(originalZip.files);
  const modifiedFiles = Object.keys(modifiedZip.files);

  const addedFiles = modifiedFiles.filter(f => !originalFiles.includes(f));
  const removedFiles = originalFiles.filter(f => !modifiedFiles.includes(f));

  const modifiedFilesResult: string[] = [];

  for (const file of originalFiles) {
    if (modifiedFiles.includes(file)) {
      const originalContent = await originalZip.file(file)?.async('string');
      const modifiedContent = await modifiedZip.file(file)?.async('string');
      if (originalContent !== modifiedContent) {
        modifiedFilesResult.push(file);
      }
    }
  }

  return {
    addedFiles,
    removedFiles,
    modifiedFiles: modifiedFilesResult,
  };
}
