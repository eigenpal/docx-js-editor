/**
 * Script to generate test fixture DOCX files
 * Run with: bun run scripts/create-fixtures.ts
 */
import JSZip from 'jszip';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(process.cwd(), 'fixtures');

// Ensure fixtures directory exists
if (!existsSync(FIXTURES_DIR)) {
  mkdirSync(FIXTURES_DIR, { recursive: true });
}

// Common DOCX structure
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:sz w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`;

async function createMinimalDocx() {
  const zip = new JSZip();

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Hello World</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', RELS);
  zip.file('word/_rels/document.xml.rels', DOCUMENT_RELS);
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', STYLES);

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  writeFileSync(join(FIXTURES_DIR, 'minimal.docx'), buffer);
  console.log('Created minimal.docx');
}

async function createFormattedDocx() {
  const zip = new JSZip();

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:rPr>
          <w:b/>
        </w:rPr>
        <w:t>Bold text</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:i/>
        </w:rPr>
        <w:t>Italic text</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:u w:val="single"/>
        </w:rPr>
        <w:t>Underlined text</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:i/>
        </w:rPr>
        <w:t>Bold and italic</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:sz w:val="32"/>
          <w:color w:val="FF0000"/>
        </w:rPr>
        <w:t>Large red text</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', RELS);
  zip.file('word/_rels/document.xml.rels', DOCUMENT_RELS);
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', STYLES);

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  writeFileSync(join(FIXTURES_DIR, 'formatted.docx'), buffer);
  console.log('Created formatted.docx');
}

async function createComplexDocx() {
  const zip = new JSZip();

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="48"/>
        </w:rPr>
        <w:t>Document Title</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>This document contains a template variable: </w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:b/>
        </w:rPr>
        <w:t>{client_name}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>Date: </w:t>
      </w:r>
      <w:r>
        <w:t>{date}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="both"/>
      </w:pPr>
      <w:r>
        <w:t>This is a paragraph with justified alignment. It contains multiple sentences to demonstrate how text flows in a document. The content here is just placeholder text.</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:strike/>
        </w:rPr>
        <w:t>Strikethrough text</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:highlight w:val="yellow"/>
        </w:rPr>
        <w:t>Highlighted text</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', RELS);
  zip.file('word/_rels/document.xml.rels', DOCUMENT_RELS);
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', STYLES);

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  writeFileSync(join(FIXTURES_DIR, 'complex.docx'), buffer);
  console.log('Created complex.docx');
}

async function main() {
  console.log('Creating test fixtures...');
  await createMinimalDocx();
  await createFormattedDocx();
  await createComplexDocx();
  console.log('Done! Fixtures created in:', FIXTURES_DIR);
}

main().catch(console.error);
