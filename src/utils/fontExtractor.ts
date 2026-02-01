/**
 * Font Extractor
 *
 * Extracts all font names used in a DOCX document for preloading.
 * Scans:
 * - Text runs (w:rFonts)
 * - Style definitions (styles.xml)
 * - Theme fonts (theme1.xml)
 * - Document defaults
 */

import type {
  Document,
  DocxPackage,
  StyleDefinitions,
  Theme,
  TextFormatting,
  ParagraphFormatting,
  Paragraph,
  Run,
  Table,
  TableRow,
  TableCell,
  BlockContent,
  ParagraphContent,
  Hyperlink,
  HeaderFooter,
  Footnote,
  Endnote,
} from '../types';

/**
 * Extract all fonts used in a Document
 *
 * @param doc - Parsed document
 * @returns Array of unique font family names
 */
export function extractFonts(doc: Document): string[] {
  const fonts = new Set<string>();

  const pkg = doc.package;

  // Extract from theme
  if (pkg.theme) {
    extractFontsFromTheme(pkg.theme, fonts);
  }

  // Extract from styles
  if (pkg.styles) {
    extractFontsFromStyles(pkg.styles, fonts);
  }

  // Extract from document body
  if (pkg.document) {
    for (const block of pkg.document.content) {
      extractFontsFromBlock(block, fonts);
    }
  }

  // Extract from headers
  if (pkg.headers) {
    for (const header of pkg.headers.values()) {
      extractFontsFromHeaderFooter(header, fonts);
    }
  }

  // Extract from footers
  if (pkg.footers) {
    for (const footer of pkg.footers.values()) {
      extractFontsFromHeaderFooter(footer, fonts);
    }
  }

  // Extract from footnotes
  if (pkg.footnotes) {
    for (const footnote of pkg.footnotes) {
      extractFontsFromFootnote(footnote, fonts);
    }
  }

  // Extract from endnotes
  if (pkg.endnotes) {
    for (const endnote of pkg.endnotes) {
      extractFontsFromEndnote(endnote, fonts);
    }
  }

  return Array.from(fonts).sort();
}

/**
 * Extract all fonts from a DocxPackage (before full parsing)
 *
 * @param pkg - DOCX package
 * @returns Array of unique font family names
 */
export function extractFontsFromPackage(pkg: DocxPackage): string[] {
  const fonts = new Set<string>();

  // Extract from theme
  if (pkg.theme) {
    extractFontsFromTheme(pkg.theme, fonts);
  }

  // Extract from styles
  if (pkg.styles) {
    extractFontsFromStyles(pkg.styles, fonts);
  }

  // Extract from font table
  if (pkg.fontTable) {
    for (const fontInfo of pkg.fontTable.fonts) {
      if (fontInfo.name) {
        fonts.add(fontInfo.name);
      }
    }
  }

  // Extract from document body
  if (pkg.document) {
    for (const block of pkg.document.content) {
      extractFontsFromBlock(block, fonts);
    }
  }

  return Array.from(fonts).sort();
}

/**
 * Extract fonts from theme
 */
function extractFontsFromTheme(theme: Theme, fonts: Set<string>): void {
  const fontScheme = theme.fontScheme;
  if (!fontScheme) return;

  // Major font (headings)
  if (fontScheme.majorFont) {
    addThemeFont(fontScheme.majorFont, fonts);
  }

  // Minor font (body text)
  if (fontScheme.minorFont) {
    addThemeFont(fontScheme.minorFont, fonts);
  }
}

/**
 * Add all fonts from a theme font definition
 */
function addThemeFont(
  themeFont: { latin?: string; ea?: string; cs?: string; fonts?: Record<string, string> },
  fonts: Set<string>
): void {
  if (themeFont.latin) {
    fonts.add(themeFont.latin);
  }
  if (themeFont.ea) {
    fonts.add(themeFont.ea);
  }
  if (themeFont.cs) {
    fonts.add(themeFont.cs);
  }
  if (themeFont.fonts) {
    for (const font of Object.values(themeFont.fonts)) {
      if (font) {
        fonts.add(font);
      }
    }
  }
}

/**
 * Extract fonts from style definitions
 */
function extractFontsFromStyles(styles: StyleDefinitions, fonts: Set<string>): void {
  // Document defaults
  if (styles.docDefaults) {
    if (styles.docDefaults.rPr) {
      extractFontsFromTextFormatting(styles.docDefaults.rPr, fonts);
    }
    if (styles.docDefaults.pPr?.runProperties) {
      extractFontsFromTextFormatting(styles.docDefaults.pPr.runProperties, fonts);
    }
  }

  // Each style
  for (const style of styles.styles) {
    if (style.rPr) {
      extractFontsFromTextFormatting(style.rPr, fonts);
    }
    if (style.pPr?.runProperties) {
      extractFontsFromTextFormatting(style.pPr.runProperties, fonts);
    }
  }
}

/**
 * Extract fonts from text formatting (rPr)
 */
function extractFontsFromTextFormatting(
  formatting: TextFormatting,
  fonts: Set<string>
): void {
  const fontFamily = formatting.fontFamily;
  if (!fontFamily) return;

  // Add all font references
  if (fontFamily.ascii) {
    fonts.add(fontFamily.ascii);
  }
  if (fontFamily.hAnsi) {
    fonts.add(fontFamily.hAnsi);
  }
  if (fontFamily.eastAsia) {
    fonts.add(fontFamily.eastAsia);
  }
  if (fontFamily.cs) {
    fonts.add(fontFamily.cs);
  }
}

/**
 * Extract fonts from paragraph formatting
 */
function extractFontsFromParagraphFormatting(
  formatting: ParagraphFormatting,
  fonts: Set<string>
): void {
  if (formatting.runProperties) {
    extractFontsFromTextFormatting(formatting.runProperties, fonts);
  }
}

/**
 * Extract fonts from a block (paragraph or table)
 */
function extractFontsFromBlock(block: BlockContent, fonts: Set<string>): void {
  if (block.type === 'paragraph') {
    extractFontsFromParagraph(block, fonts);
  } else if (block.type === 'table') {
    extractFontsFromTable(block, fonts);
  }
}

/**
 * Extract fonts from a paragraph
 */
function extractFontsFromParagraph(para: Paragraph, fonts: Set<string>): void {
  // Paragraph formatting
  if (para.formatting) {
    extractFontsFromParagraphFormatting(para.formatting, fonts);
  }

  // Content
  for (const item of para.content) {
    extractFontsFromParagraphContent(item, fonts);
  }
}

/**
 * Extract fonts from paragraph content item
 */
function extractFontsFromParagraphContent(
  content: ParagraphContent,
  fonts: Set<string>
): void {
  if (content.type === 'run') {
    extractFontsFromRun(content, fonts);
  } else if (content.type === 'hyperlink') {
    extractFontsFromHyperlink(content, fonts);
  } else if (content.type === 'simpleField' || content.type === 'complexField') {
    // Fields may contain runs with fonts
    if ('content' in content) {
      for (const item of content.content) {
        if (item.type === 'run') {
          extractFontsFromRun(item, fonts);
        }
      }
    }
    if ('fieldResult' in content) {
      for (const run of content.fieldResult) {
        extractFontsFromRun(run, fonts);
      }
    }
  }
}

/**
 * Extract fonts from a run
 */
function extractFontsFromRun(run: Run, fonts: Set<string>): void {
  if (run.formatting) {
    extractFontsFromTextFormatting(run.formatting, fonts);
  }
}

/**
 * Extract fonts from a hyperlink
 */
function extractFontsFromHyperlink(hyperlink: Hyperlink, fonts: Set<string>): void {
  for (const child of hyperlink.children) {
    if (child.type === 'run') {
      extractFontsFromRun(child, fonts);
    }
  }
}

/**
 * Extract fonts from a table
 */
function extractFontsFromTable(table: Table, fonts: Set<string>): void {
  for (const row of table.rows) {
    extractFontsFromTableRow(row, fonts);
  }
}

/**
 * Extract fonts from a table row
 */
function extractFontsFromTableRow(row: TableRow, fonts: Set<string>): void {
  for (const cell of row.cells) {
    extractFontsFromTableCell(cell, fonts);
  }
}

/**
 * Extract fonts from a table cell
 */
function extractFontsFromTableCell(cell: TableCell, fonts: Set<string>): void {
  for (const block of cell.content) {
    extractFontsFromBlock(block, fonts);
  }
}

/**
 * Extract fonts from header/footer
 */
function extractFontsFromHeaderFooter(hf: HeaderFooter, fonts: Set<string>): void {
  for (const block of hf.content) {
    extractFontsFromBlock(block, fonts);
  }
}

/**
 * Extract fonts from footnote
 */
function extractFontsFromFootnote(footnote: Footnote, fonts: Set<string>): void {
  for (const para of footnote.content) {
    extractFontsFromParagraph(para, fonts);
  }
}

/**
 * Extract fonts from endnote
 */
function extractFontsFromEndnote(endnote: Endnote, fonts: Set<string>): void {
  for (const para of endnote.content) {
    extractFontsFromParagraph(para, fonts);
  }
}

/**
 * Get a summary of fonts used in the document
 *
 * @param doc - Parsed document
 * @returns Object with font usage statistics
 */
export function getFontSummary(doc: Document): {
  fonts: string[];
  themeFonts: string[];
  styleFonts: string[];
  bodyFonts: string[];
} {
  const themeFonts = new Set<string>();
  const styleFonts = new Set<string>();
  const bodyFonts = new Set<string>();

  const pkg = doc.package;

  // Extract from theme
  if (pkg.theme) {
    extractFontsFromTheme(pkg.theme, themeFonts);
  }

  // Extract from styles
  if (pkg.styles) {
    extractFontsFromStyles(pkg.styles, styleFonts);
  }

  // Extract from document body
  if (pkg.document) {
    for (const block of pkg.document.content) {
      extractFontsFromBlock(block, bodyFonts);
    }
  }

  // Combine all
  const allFonts = new Set([...themeFonts, ...styleFonts, ...bodyFonts]);

  return {
    fonts: Array.from(allFonts).sort(),
    themeFonts: Array.from(themeFonts).sort(),
    styleFonts: Array.from(styleFonts).sort(),
    bodyFonts: Array.from(bodyFonts).sort(),
  };
}
