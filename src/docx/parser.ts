import JSZip from 'jszip';
import type { DocxData } from '../types';

/**
 * Parse a DOCX file and extract its contents
 */
export async function parseDocx(file: File | Blob | ArrayBuffer): Promise<DocxData> {
  const zip = new JSZip();

  let data: ArrayBuffer;
  if (file instanceof ArrayBuffer) {
    data = file;
  } else {
    data = await file.arrayBuffer();
  }

  const docx = await zip.loadAsync(data);

  // Extract all files
  const files = new Map<string, string | Uint8Array>();
  const media = new Map<string, Blob>();

  for (const [path, zipEntry] of Object.entries(docx.files)) {
    if (zipEntry.dir) continue;

    if (path.startsWith('word/media/')) {
      // Media files as blobs
      const blob = await zipEntry.async('blob');
      media.set(path, blob);
    } else if (
      path.endsWith('.xml') ||
      path.endsWith('.rels') ||
      path === '[Content_Types].xml'
    ) {
      // XML files as strings
      const content = await zipEntry.async('string');
      files.set(path, content);
    } else {
      // Other files as binary
      const content = await zipEntry.async('uint8array');
      files.set(path, content);
    }
  }

  // Get main document content
  const documentXml = files.get('word/document.xml') as string;
  if (!documentXml) {
    throw new Error('Invalid DOCX: missing word/document.xml');
  }

  const filename = file instanceof File ? file.name : 'document.docx';

  return {
    filename,
    files,
    documentXml,
    media,
    stylesXml: files.get('word/styles.xml') as string | undefined,
    themeXml: files.get('word/theme/theme1.xml') as string | undefined,
  };
}
