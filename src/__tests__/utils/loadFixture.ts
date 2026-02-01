import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Load a DOCX fixture file as an ArrayBuffer
 * @param filename - Name of the fixture file (e.g., 'minimal.docx')
 * @returns ArrayBuffer containing the DOCX file data
 */
export function loadFixture(filename: string): ArrayBuffer {
  const fixturePath = join(import.meta.dir, '../../../fixtures', filename);
  const buffer = readFileSync(fixturePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/**
 * Load a DOCX fixture file as a Blob
 * @param filename - Name of the fixture file (e.g., 'minimal.docx')
 * @returns Blob containing the DOCX file data
 */
export function loadFixtureAsBlob(filename: string): Blob {
  const buffer = loadFixture(filename);
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

/**
 * Load a DOCX fixture file as a File object
 * @param filename - Name of the fixture file (e.g., 'minimal.docx')
 * @returns File object containing the DOCX file data
 */
export function loadFixtureAsFile(filename: string): File {
  const buffer = loadFixture(filename);
  return new File([buffer], filename, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}
