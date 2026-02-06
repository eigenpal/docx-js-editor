/**
 * Document Serializer - Serialize complete document.xml
 *
 * Converts Document objects back to valid document.xml OOXML format.
 * Combines all content (paragraphs, tables) with section properties
 * and proper namespace declarations.
 *
 * OOXML Reference:
 * - Document root: w:document
 * - Document body: w:body
 * - Section properties: w:sectPr
 */

import type {
  Document,
  DocumentBody,
  BlockContent,
  SectionProperties,
  HeaderReference,
  FooterReference,
  FootnoteProperties,
  EndnoteProperties,
  BorderSpec,
} from '../../types/document';

import { serializeParagraph } from './paragraphSerializer';
import { serializeTable } from './tableSerializer';

// ============================================================================
// XML NAMESPACES
// ============================================================================

/**
 * Standard OOXML namespaces for document.xml
 */
const NAMESPACES = {
  wpc: 'http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas',
  cx: 'http://schemas.microsoft.com/office/drawing/2014/chartex',
  cx1: 'http://schemas.microsoft.com/office/drawing/2015/9/8/chartex',
  cx2: 'http://schemas.microsoft.com/office/drawing/2015/10/21/chartex',
  cx3: 'http://schemas.microsoft.com/office/drawing/2016/5/9/chartex',
  cx4: 'http://schemas.microsoft.com/office/drawing/2016/5/10/chartex',
  cx5: 'http://schemas.microsoft.com/office/drawing/2016/5/11/chartex',
  cx6: 'http://schemas.microsoft.com/office/drawing/2016/5/12/chartex',
  cx7: 'http://schemas.microsoft.com/office/drawing/2016/5/13/chartex',
  cx8: 'http://schemas.microsoft.com/office/drawing/2016/5/14/chartex',
  mc: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
  aink: 'http://schemas.microsoft.com/office/drawing/2016/ink',
  am3d: 'http://schemas.microsoft.com/office/drawing/2017/model3d',
  o: 'urn:schemas-microsoft-com:office:office',
  oel: 'http://schemas.microsoft.com/office/2019/extlst',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  m: 'http://schemas.openxmlformats.org/officeDocument/2006/math',
  v: 'urn:schemas-microsoft-com:vml',
  wp14: 'http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  w10: 'urn:schemas-microsoft-com:office:word',
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  w14: 'http://schemas.microsoft.com/office/word/2010/wordml',
  w15: 'http://schemas.microsoft.com/office/word/2012/wordml',
  w16cex: 'http://schemas.microsoft.com/office/word/2018/wordml/cex',
  w16cid: 'http://schemas.microsoft.com/office/word/2016/wordml/cid',
  w16: 'http://schemas.microsoft.com/office/word/2018/wordml',
  w16sdtdh: 'http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash',
  w16se: 'http://schemas.microsoft.com/office/word/2015/wordml/symex',
  wpg: 'http://schemas.microsoft.com/office/word/2010/wordprocessingGroup',
  wpi: 'http://schemas.microsoft.com/office/word/2010/wordprocessingInk',
  wne: 'http://schemas.microsoft.com/office/word/2006/wordml',
  wps: 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape',
};

/**
 * Build namespace declaration string for document element
 */
function buildNamespaceDeclarations(): string {
  // Minimal set of commonly used namespaces
  const minimalNamespaces = {
    wpc: NAMESPACES.wpc,
    mc: NAMESPACES.mc,
    o: NAMESPACES.o,
    r: NAMESPACES.r,
    m: NAMESPACES.m,
    v: NAMESPACES.v,
    wp14: NAMESPACES.wp14,
    wp: NAMESPACES.wp,
    w10: NAMESPACES.w10,
    w: NAMESPACES.w,
    w14: NAMESPACES.w14,
    w15: NAMESPACES.w15,
    wpg: NAMESPACES.wpg,
    wps: NAMESPACES.wps,
  };

  return Object.entries(minimalNamespaces)
    .map(([prefix, uri]) => `xmlns:${prefix}="${uri}"`)
    .join(' ');
}

// ============================================================================
// XML ESCAPING
// ============================================================================

// ============================================================================
// BORDER SERIALIZATION
// ============================================================================

/**
 * Serialize a border element
 */
function serializeBorder(border: BorderSpec | undefined, elementName: string): string {
  if (!border || border.style === 'none' || border.style === 'nil') {
    return '';
  }

  const attrs: string[] = [`w:val="${border.style}"`];

  if (border.size !== undefined) {
    attrs.push(`w:sz="${border.size}"`);
  }

  if (border.space !== undefined) {
    attrs.push(`w:space="${border.space}"`);
  }

  if (border.color) {
    if (border.color.auto) {
      attrs.push('w:color="auto"');
    } else if (border.color.rgb) {
      attrs.push(`w:color="${border.color.rgb}"`);
    }

    if (border.color.themeColor) {
      attrs.push(`w:themeColor="${border.color.themeColor}"`);
    }

    if (border.color.themeTint) {
      attrs.push(`w:themeTint="${border.color.themeTint}"`);
    }

    if (border.color.themeShade) {
      attrs.push(`w:themeShade="${border.color.themeShade}"`);
    }
  }

  if (border.shadow) {
    attrs.push('w:shadow="true"');
  }

  if (border.frame) {
    attrs.push('w:frame="true"');
  }

  return `<w:${elementName} ${attrs.join(' ')}/>`;
}

// ============================================================================
// SECTION PROPERTIES SERIALIZATION
// ============================================================================

/**
 * Serialize header reference (w:headerReference)
 */
function serializeHeaderReference(ref: HeaderReference): string {
  const attrs: string[] = [`w:type="${ref.type}"`, `r:id="${ref.rId}"`];

  return `<w:headerReference ${attrs.join(' ')}/>`;
}

/**
 * Serialize footer reference (w:footerReference)
 */
function serializeFooterReference(ref: FooterReference): string {
  const attrs: string[] = [`w:type="${ref.type}"`, `r:id="${ref.rId}"`];

  return `<w:footerReference ${attrs.join(' ')}/>`;
}

/**
 * Serialize footnote properties (w:footnotePr)
 */
function serializeFootnoteProperties(props: FootnoteProperties | undefined): string {
  if (!props) return '';

  const parts: string[] = [];

  if (props.position) {
    parts.push(`<w:pos w:val="${props.position}"/>`);
  }

  if (props.numFmt) {
    parts.push(`<w:numFmt w:val="${props.numFmt}"/>`);
  }

  if (props.numStart !== undefined) {
    parts.push(`<w:numStart w:val="${props.numStart}"/>`);
  }

  if (props.numRestart) {
    parts.push(`<w:numRestart w:val="${props.numRestart}"/>`);
  }

  if (parts.length === 0) return '';

  return `<w:footnotePr>${parts.join('')}</w:footnotePr>`;
}

/**
 * Serialize endnote properties (w:endnotePr)
 */
function serializeEndnoteProperties(props: EndnoteProperties | undefined): string {
  if (!props) return '';

  const parts: string[] = [];

  if (props.position) {
    parts.push(`<w:pos w:val="${props.position}"/>`);
  }

  if (props.numFmt) {
    parts.push(`<w:numFmt w:val="${props.numFmt}"/>`);
  }

  if (props.numStart !== undefined) {
    parts.push(`<w:numStart w:val="${props.numStart}"/>`);
  }

  if (props.numRestart) {
    parts.push(`<w:numRestart w:val="${props.numRestart}"/>`);
  }

  if (parts.length === 0) return '';

  return `<w:endnotePr>${parts.join('')}</w:endnotePr>`;
}

/**
 * Serialize page size (w:pgSz)
 */
function serializePageSize(props: SectionProperties): string {
  const attrs: string[] = [];

  if (props.pageWidth !== undefined) {
    attrs.push(`w:w="${props.pageWidth}"`);
  }

  if (props.pageHeight !== undefined) {
    attrs.push(`w:h="${props.pageHeight}"`);
  }

  if (props.orientation === 'landscape') {
    attrs.push('w:orient="landscape"');
  }

  if (attrs.length === 0) return '';

  return `<w:pgSz ${attrs.join(' ')}/>`;
}

/**
 * Serialize page margins (w:pgMar)
 */
function serializePageMargins(props: SectionProperties): string {
  const attrs: string[] = [];

  if (props.marginTop !== undefined) {
    attrs.push(`w:top="${props.marginTop}"`);
  }

  if (props.marginRight !== undefined) {
    attrs.push(`w:right="${props.marginRight}"`);
  }

  if (props.marginBottom !== undefined) {
    attrs.push(`w:bottom="${props.marginBottom}"`);
  }

  if (props.marginLeft !== undefined) {
    attrs.push(`w:left="${props.marginLeft}"`);
  }

  if (props.headerDistance !== undefined) {
    attrs.push(`w:header="${props.headerDistance}"`);
  }

  if (props.footerDistance !== undefined) {
    attrs.push(`w:footer="${props.footerDistance}"`);
  }

  if (props.gutter !== undefined) {
    attrs.push(`w:gutter="${props.gutter}"`);
  }

  if (attrs.length === 0) return '';

  return `<w:pgMar ${attrs.join(' ')}/>`;
}

/**
 * Serialize columns (w:cols)
 */
function serializeColumns(props: SectionProperties): string {
  if (!props.columnCount && !props.columns?.length) return '';

  const attrs: string[] = [];

  if (props.columnCount !== undefined && props.columnCount > 1) {
    attrs.push(`w:num="${props.columnCount}"`);
  }

  if (props.columnSpace !== undefined) {
    attrs.push(`w:space="${props.columnSpace}"`);
  }

  if (props.equalWidth !== undefined) {
    attrs.push(`w:equalWidth="${props.equalWidth ? '1' : '0'}"`);
  }

  if (props.separator) {
    attrs.push('w:sep="1"');
  }

  // Individual column definitions
  let colElements = '';
  if (props.columns && props.columns.length > 0) {
    colElements = props.columns
      .map((col) => {
        const colAttrs: string[] = [];
        if (col.width !== undefined) {
          colAttrs.push(`w:w="${col.width}"`);
        }
        if (col.space !== undefined) {
          colAttrs.push(`w:space="${col.space}"`);
        }
        return `<w:col ${colAttrs.join(' ')}/>`;
      })
      .join('');
  }

  if (attrs.length === 0 && !colElements) return '';

  const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
  return `<w:cols${attrsStr}>${colElements}</w:cols>`;
}

/**
 * Serialize line numbers (w:lnNumType)
 */
function serializeLineNumbers(props: SectionProperties): string {
  if (!props.lineNumbers) return '';

  const ln = props.lineNumbers;
  const attrs: string[] = [];

  if (ln.countBy !== undefined) {
    attrs.push(`w:countBy="${ln.countBy}"`);
  }

  if (ln.start !== undefined) {
    attrs.push(`w:start="${ln.start}"`);
  }

  if (ln.distance !== undefined) {
    attrs.push(`w:distance="${ln.distance}"`);
  }

  if (ln.restart) {
    attrs.push(`w:restart="${ln.restart}"`);
  }

  if (attrs.length === 0) return '';

  return `<w:lnNumType ${attrs.join(' ')}/>`;
}

/**
 * Serialize page borders (w:pgBorders)
 */
function serializePageBorders(props: SectionProperties): string {
  if (!props.pageBorders) return '';

  const pb = props.pageBorders;
  const attrs: string[] = [];
  const borderElements: string[] = [];

  if (pb.display) {
    attrs.push(`w:display="${pb.display}"`);
  }

  if (pb.offsetFrom) {
    attrs.push(`w:offsetFrom="${pb.offsetFrom}"`);
  }

  if (pb.zOrder) {
    attrs.push(`w:zOrder="${pb.zOrder}"`);
  }

  if (pb.top) {
    const topXml = serializeBorder(pb.top, 'top');
    if (topXml) borderElements.push(topXml);
  }

  if (pb.left) {
    const leftXml = serializeBorder(pb.left, 'left');
    if (leftXml) borderElements.push(leftXml);
  }

  if (pb.bottom) {
    const bottomXml = serializeBorder(pb.bottom, 'bottom');
    if (bottomXml) borderElements.push(bottomXml);
  }

  if (pb.right) {
    const rightXml = serializeBorder(pb.right, 'right');
    if (rightXml) borderElements.push(rightXml);
  }

  if (borderElements.length === 0) return '';

  const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
  return `<w:pgBorders${attrsStr}>${borderElements.join('')}</w:pgBorders>`;
}

/**
 * Serialize document grid (w:docGrid)
 */
function serializeDocGrid(props: SectionProperties): string {
  if (!props.docGrid) return '';

  const dg = props.docGrid;
  const attrs: string[] = [];

  if (dg.type) {
    attrs.push(`w:type="${dg.type}"`);
  }

  if (dg.linePitch !== undefined) {
    attrs.push(`w:linePitch="${dg.linePitch}"`);
  }

  if (dg.charSpace !== undefined) {
    attrs.push(`w:charSpace="${dg.charSpace}"`);
  }

  if (attrs.length === 0) return '';

  return `<w:docGrid ${attrs.join(' ')}/>`;
}

/**
 * Serialize section properties (w:sectPr)
 */
export function serializeSectionProperties(props: SectionProperties | undefined): string {
  if (!props) return '';

  const parts: string[] = [];

  // Header references
  if (props.headerReferences) {
    for (const ref of props.headerReferences) {
      parts.push(serializeHeaderReference(ref));
    }
  }

  // Footer references
  if (props.footerReferences) {
    for (const ref of props.footerReferences) {
      parts.push(serializeFooterReference(ref));
    }
  }

  // Footnote properties
  const footnotePrXml = serializeFootnoteProperties(props.footnotePr);
  if (footnotePrXml) {
    parts.push(footnotePrXml);
  }

  // Endnote properties
  const endnotePrXml = serializeEndnoteProperties(props.endnotePr);
  if (endnotePrXml) {
    parts.push(endnotePrXml);
  }

  // Section type
  if (props.sectionStart) {
    parts.push(`<w:type w:val="${props.sectionStart}"/>`);
  }

  // Page size
  const pgSzXml = serializePageSize(props);
  if (pgSzXml) {
    parts.push(pgSzXml);
  }

  // Page margins
  const pgMarXml = serializePageMargins(props);
  if (pgMarXml) {
    parts.push(pgMarXml);
  }

  // Paper source
  if (props.paperSrcFirst !== undefined || props.paperSrcOther !== undefined) {
    const attrs: string[] = [];
    if (props.paperSrcFirst !== undefined) {
      attrs.push(`w:first="${props.paperSrcFirst}"`);
    }
    if (props.paperSrcOther !== undefined) {
      attrs.push(`w:other="${props.paperSrcOther}"`);
    }
    parts.push(`<w:paperSrc ${attrs.join(' ')}/>`);
  }

  // Page borders
  const pgBordersXml = serializePageBorders(props);
  if (pgBordersXml) {
    parts.push(pgBordersXml);
  }

  // Line numbers
  const lnNumXml = serializeLineNumbers(props);
  if (lnNumXml) {
    parts.push(lnNumXml);
  }

  // Columns
  const colsXml = serializeColumns(props);
  if (colsXml) {
    parts.push(colsXml);
  }

  // Document grid
  const docGridXml = serializeDocGrid(props);
  if (docGridXml) {
    parts.push(docGridXml);
  }

  // Vertical alignment
  if (props.verticalAlign) {
    parts.push(`<w:vAlign w:val="${props.verticalAlign}"/>`);
  }

  // Bidirectional
  if (props.bidi) {
    parts.push('<w:bidi/>');
  }

  // Title page (different first page header/footer)
  if (props.titlePg) {
    parts.push('<w:titlePg/>');
  }

  // Even and odd headers
  if (props.evenAndOddHeaders) {
    parts.push('<w:evenAndOddHeaders/>');
  }

  if (parts.length === 0) return '';

  return `<w:sectPr>${parts.join('')}</w:sectPr>`;
}

// ============================================================================
// CONTENT SERIALIZATION
// ============================================================================

/**
 * Serialize a single block content item (paragraph or table)
 */
function serializeBlockContent(block: BlockContent): string {
  if (block.type === 'paragraph') {
    return serializeParagraph(block);
  } else if (block.type === 'table') {
    return serializeTable(block);
  } else if (block.type === 'blockSdt') {
    // Block-level SDT: wrap content in w:sdt
    const contentXml = block.content.map((b) => serializeBlockContent(b)).join('');
    const props = block.properties;
    const prParts: string[] = [];
    if (props.alias) prParts.push(`<w:alias w:val="${props.alias}"/>`);
    if (props.tag) prParts.push(`<w:tag w:val="${props.tag}"/>`);
    return `<w:sdt><w:sdtPr>${prParts.join('')}</w:sdtPr><w:sdtContent>${contentXml}</w:sdtContent></w:sdt>`;
  }
  return '';
}

/**
 * Serialize document body content
 */
function serializeBodyContent(content: BlockContent[]): string {
  return content.map((block) => serializeBlockContent(block)).join('');
}

// ============================================================================
// MAIN DOCUMENT SERIALIZATION
// ============================================================================

/**
 * Serialize a DocumentBody to document.xml body content
 *
 * @param body - The document body to serialize
 * @returns XML string for the body element (without body tags)
 */
export function serializeDocumentBody(body: DocumentBody): string {
  const parts: string[] = [];

  // Serialize all content blocks
  parts.push(serializeBodyContent(body.content));

  // Final section properties (at the end of body)
  if (body.finalSectionProperties) {
    parts.push(serializeSectionProperties(body.finalSectionProperties));
  }

  return parts.join('');
}

/**
 * Serialize a complete Document to valid document.xml
 *
 * @param doc - The document to serialize
 * @returns Complete XML string for document.xml
 */
export function serializeDocument(doc: Document): string {
  const parts: string[] = [];

  // XML declaration
  parts.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');

  // Document element with namespaces
  const nsDecl = buildNamespaceDeclarations();
  parts.push(`<w:document ${nsDecl} mc:Ignorable="w14 w15 wp14">`);

  // Document body
  parts.push('<w:body>');
  parts.push(serializeDocumentBody(doc.package.document));
  parts.push('</w:body>');

  // Close document element
  parts.push('</w:document>');

  return parts.join('');
}

/**
 * Serialize just the document body (useful for partial updates)
 *
 * @param body - The document body to serialize
 * @returns XML string for the w:body element
 */
export function serializeDocumentBodyElement(body: DocumentBody): string {
  return `<w:body>${serializeDocumentBody(body)}</w:body>`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if document has any content
 */
export function hasDocumentContent(doc: Document): boolean {
  return doc.package.document.content.length > 0;
}

/**
 * Check if document has sections
 */
export function hasDocumentSections(doc: Document): boolean {
  return (doc.package.document.sections?.length ?? 0) > 0;
}

/**
 * Check if document has section properties
 */
export function hasSectionProperties(doc: Document): boolean {
  return doc.package.document.finalSectionProperties !== undefined;
}

/**
 * Get document content count (paragraphs + tables)
 */
export function getDocumentContentCount(doc: Document): number {
  return doc.package.document.content.length;
}

/**
 * Get paragraph count in document
 */
export function getDocumentParagraphCount(doc: Document): number {
  return doc.package.document.content.filter((b) => b.type === 'paragraph').length;
}

/**
 * Get table count in document
 */
export function getDocumentTableCount(doc: Document): number {
  return doc.package.document.content.filter((b) => b.type === 'table').length;
}

/**
 * Get plain text from document (for comparison/debugging)
 */
export function getDocumentPlainText(doc: Document): string {
  const texts: string[] = [];

  for (const block of doc.package.document.content) {
    if (block.type === 'paragraph') {
      for (const content of block.content) {
        if (content.type === 'run') {
          for (const item of content.content) {
            if (item.type === 'text') {
              texts.push(item.text);
            } else if (item.type === 'tab') {
              texts.push('\t');
            } else if (item.type === 'break') {
              texts.push('\n');
            }
          }
        }
      }
      texts.push('\n'); // Paragraph break
    }
  }

  return texts.join('');
}

/**
 * Create an empty document
 */
export function createEmptyDocument(): Document {
  return {
    package: {
      document: {
        content: [],
      },
    },
  };
}

/**
 * Create a simple document with text content
 */
export function createSimpleDocument(
  paragraphs: Array<{ text: string; styleId?: string }>
): Document {
  return {
    package: {
      document: {
        content: paragraphs.map((p) => ({
          type: 'paragraph' as const,
          formatting: p.styleId ? { styleId: p.styleId } : undefined,
          content: [
            {
              type: 'run' as const,
              content: [{ type: 'text' as const, text: p.text }],
            },
          ],
        })),
      },
    },
  };
}

export default serializeDocument;
