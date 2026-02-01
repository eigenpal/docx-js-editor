import type { Node as ProseMirrorNode } from 'prosemirror-model';

/**
 * Serialize ProseMirror document to DOCX XML format
 */
export function serializeDocx(doc: ProseMirrorNode): string {
  const paragraphs: string[] = [];

  doc.forEach((node) => {
    if (node.type.name === 'paragraph') {
      paragraphs.push(serializeParagraph(node));
    }
  });

  return paragraphs.join('');
}

function serializeParagraph(node: ProseMirrorNode): string {
  const runs: string[] = [];

  node.forEach((child) => {
    if (child.isText) {
      runs.push(serializeTextRun(child));
    }
  });

  return `<w:p>${runs.join('')}</w:p>`;
}

function serializeTextRun(node: ProseMirrorNode): string {
  const text = node.text || '';
  const runProps: string[] = [];

  // Check marks
  node.marks.forEach((mark) => {
    switch (mark.type.name) {
      case 'bold':
        runProps.push('<w:b/>');
        break;
      case 'italic':
        runProps.push('<w:i/>');
        break;
      case 'underline':
        runProps.push('<w:u w:val="single"/>');
        break;
      case 'strikethrough':
        runProps.push('<w:strike/>');
        break;
      case 'fontSize':
        // Font size in DOCX is in half-points
        const size = mark.attrs.size;
        if (size) {
          const halfPoints = parseFloat(size) * 2;
          runProps.push(`<w:sz w:val="${halfPoints}"/>`);
        }
        break;
      case 'fontColor':
        const color = mark.attrs.color;
        if (color) {
          const hex = color.replace('#', '');
          runProps.push(`<w:color w:val="${hex}"/>`);
        }
        break;
    }
  });

  const rPr = runProps.length > 0 ? `<w:rPr>${runProps.join('')}</w:rPr>` : '';

  // Escape XML special characters
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<w:r>${rPr}<w:t xml:space="preserve">${escapedText}</w:t></w:r>`;
}
