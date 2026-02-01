import JSZip from 'jszip';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { DocxData } from '../types';
import { serializeDocx } from './serializer';

/**
 * Export a ProseMirror document back to DOCX format
 *
 * Strategy: Only modify word/document.xml, preserve everything else
 */
export async function exportDocx(
  originalData: DocxData,
  doc: ProseMirrorNode
): Promise<Blob> {
  const zip = new JSZip();

  // Serialize the document content
  const newDocumentContent = serializeDocx(doc);

  // Build the complete document.xml
  const documentXml = buildDocumentXml(originalData.documentXml, newDocumentContent);

  // Add all original files
  for (const [path, content] of originalData.files) {
    if (path === 'word/document.xml') {
      // Replace with new content
      zip.file(path, documentXml);
    } else if (typeof content === 'string') {
      zip.file(path, content);
    } else {
      zip.file(path, content);
    }
  }

  // Add media files
  for (const [path, blob] of originalData.media) {
    const buffer = await blob.arrayBuffer();
    zip.file(path, buffer);
  }

  // Generate the DOCX blob
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  return blob;
}

/**
 * Build a complete document.xml by replacing the body content
 */
function buildDocumentXml(originalXml: string, newBodyContent: string): string {
  // Extract the document wrapper (everything before and after <w:body>)
  const bodyStartMatch = originalXml.match(/<w:body[^>]*>/);
  const bodyEndMatch = originalXml.match(/<\/w:body>/);

  if (!bodyStartMatch || !bodyEndMatch) {
    throw new Error('Invalid document.xml: missing w:body element');
  }

  const bodyStartIndex = bodyStartMatch.index! + bodyStartMatch[0].length;
  const bodyEndIndex = bodyEndMatch.index!;

  // Keep everything before <w:body> content and after </w:body>
  const prefix = originalXml.substring(0, bodyStartIndex);
  const suffix = originalXml.substring(bodyEndIndex);

  // Extract sectPr if present (section properties should be preserved)
  const sectPrMatch = originalXml.substring(bodyStartIndex, bodyEndIndex).match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  const sectPr = sectPrMatch ? sectPrMatch[0] : '';

  return `${prefix}${newBodyContent}${sectPr}${suffix}`;
}
