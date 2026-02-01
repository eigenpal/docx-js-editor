import { describe, test, expect } from 'bun:test';
import {
  loadFixture,
  loadFixtureAsBlob,
  loadFixtureAsFile,
  validateDocx,
  assertValidDocx,
  getDocumentXml,
  extractTextContent,
} from './utils';

describe('Test utilities', () => {
  test('loadFixture loads minimal.docx as ArrayBuffer', async () => {
    const buffer = loadFixture('minimal.docx');
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  test('loadFixtureAsBlob loads minimal.docx as Blob', async () => {
    const blob = loadFixtureAsBlob('minimal.docx');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  test('loadFixtureAsFile loads minimal.docx as File', async () => {
    const file = loadFixtureAsFile('minimal.docx');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('minimal.docx');
    expect(file.size).toBeGreaterThan(0);
  });
});

describe('DOCX validation', () => {
  test('validateDocx returns valid for minimal.docx', async () => {
    const buffer = loadFixture('minimal.docx');
    const result = await validateDocx(buffer);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.files).toContain('[Content_Types].xml');
    expect(result.files).toContain('word/document.xml');
    expect(result.files).toContain('_rels/.rels');
  });

  test('assertValidDocx does not throw for valid DOCX', async () => {
    const buffer = loadFixture('minimal.docx');
    await expect(assertValidDocx(buffer)).resolves.toBeUndefined();
  });

  test('validateDocx returns valid for formatted.docx', async () => {
    const buffer = loadFixture('formatted.docx');
    const result = await validateDocx(buffer);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('validateDocx returns valid for complex.docx', async () => {
    const buffer = loadFixture('complex.docx');
    const result = await validateDocx(buffer);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('DOCX content extraction', () => {
  test('getDocumentXml returns XML string', async () => {
    const buffer = loadFixture('minimal.docx');
    const xml = await getDocumentXml(buffer);

    expect(xml).toContain('<?xml');
    expect(xml).toContain('w:document');
    expect(xml).toContain('w:body');
  });

  test('extractTextContent extracts text from minimal.docx', async () => {
    const buffer = loadFixture('minimal.docx');
    const text = await extractTextContent(buffer);

    expect(text).toBe('Hello World');
  });

  test('extractTextContent extracts text from formatted.docx', async () => {
    const buffer = loadFixture('formatted.docx');
    const text = await extractTextContent(buffer);

    expect(text).toContain('Bold text');
    expect(text).toContain('Italic text');
    expect(text).toContain('Underlined text');
  });

  test('extractTextContent extracts variables from complex.docx', async () => {
    const buffer = loadFixture('complex.docx');
    const text = await extractTextContent(buffer);

    expect(text).toContain('{client_name}');
    expect(text).toContain('{date}');
  });
});
