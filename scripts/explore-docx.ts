/**
 * Script to explore a DOCX file and print its structure
 */
import { readFileSync } from 'fs';
import { exploreDocx, printExplorationSummary, getKeyFiles, extractXml } from '../src/docx/explorer';

async function main() {
  const filePath = process.argv[2] || './EP_ZMVZ_MULTI_v4.docx';

  console.log(`Exploring: ${filePath}\n`);

  const buffer = readFileSync(filePath);
  const exploration = await exploreDocx(buffer.buffer);

  printExplorationSummary(exploration);

  console.log('\n--- Key Files ---');
  const keyFiles = getKeyFiles(exploration);
  console.log(JSON.stringify(keyFiles, null, 2));

  // Print first 500 chars of document.xml
  console.log('\n--- document.xml preview ---');
  const docXml = extractXml(exploration, 'word/document.xml', true);
  if (docXml) {
    console.log(docXml.substring(0, 2000) + '\n...');
  }
}

main().catch(console.error);
