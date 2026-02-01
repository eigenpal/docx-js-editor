/**
 * Table Serializer - Serialize tables to OOXML XML
 *
 * Converts Table objects back to <w:tbl> XML format for DOCX files.
 * Handles all table, row, and cell properties including merged cells.
 *
 * OOXML Reference:
 * - Table: w:tbl
 * - Table properties: w:tblPr
 * - Table grid: w:tblGrid
 * - Table row: w:tr
 * - Row properties: w:trPr
 * - Table cell: w:tc
 * - Cell properties: w:tcPr
 */

import type {
  Table,
  TableRow,
  TableCell,
  TableFormatting,
  TableRowFormatting,
  TableCellFormatting,
  TableMeasurement,
  TableBorders,
  TableLook,
  CellMargins,
  FloatingTableProperties,
  ConditionalFormatStyle,
  BorderSpec,
  ShadingProperties,
  Paragraph,
} from '../../types/document';

import { serializeParagraph } from './paragraphSerializer';

// ============================================================================
// XML ESCAPING
// ============================================================================

/**
 * Escape special XML characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================================================
// MEASUREMENT SERIALIZATION
// ============================================================================

/**
 * Serialize a table measurement (width, height)
 */
function serializeMeasurement(
  measurement: TableMeasurement | undefined,
  elementName: string
): string {
  if (!measurement) return '';

  const attrs: string[] = [
    `w:w="${measurement.value}"`,
    `w:type="${measurement.type}"`,
  ];

  return `<w:${elementName} ${attrs.join(' ')}/>`;
}

// ============================================================================
// BORDER SERIALIZATION
// ============================================================================

/**
 * Serialize a single border element
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

  // Color
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

/**
 * Serialize table borders (w:tblBorders or w:tcBorders)
 */
function serializeTableBorders(borders: TableBorders | undefined, elementName: string): string {
  if (!borders) return '';

  const parts: string[] = [];

  if (borders.top) {
    const topXml = serializeBorder(borders.top, 'top');
    if (topXml) parts.push(topXml);
  }

  if (borders.left) {
    const leftXml = serializeBorder(borders.left, 'left');
    if (leftXml) parts.push(leftXml);
  }

  if (borders.bottom) {
    const bottomXml = serializeBorder(borders.bottom, 'bottom');
    if (bottomXml) parts.push(bottomXml);
  }

  if (borders.right) {
    const rightXml = serializeBorder(borders.right, 'right');
    if (rightXml) parts.push(rightXml);
  }

  if (borders.insideH) {
    const insideHXml = serializeBorder(borders.insideH, 'insideH');
    if (insideHXml) parts.push(insideHXml);
  }

  if (borders.insideV) {
    const insideVXml = serializeBorder(borders.insideV, 'insideV');
    if (insideVXml) parts.push(insideVXml);
  }

  if (parts.length === 0) return '';

  return `<w:${elementName}>${parts.join('')}</w:${elementName}>`;
}

// ============================================================================
// CELL MARGINS SERIALIZATION
// ============================================================================

/**
 * Serialize cell margins (w:tblCellMar or w:tcMar)
 */
function serializeCellMargins(margins: CellMargins | undefined, elementName: string): string {
  if (!margins) return '';

  const parts: string[] = [];

  if (margins.top) {
    parts.push(serializeMeasurement(margins.top, 'top'));
  }

  if (margins.left) {
    parts.push(serializeMeasurement(margins.left, 'left'));
  }

  if (margins.bottom) {
    parts.push(serializeMeasurement(margins.bottom, 'bottom'));
  }

  if (margins.right) {
    parts.push(serializeMeasurement(margins.right, 'right'));
  }

  if (parts.length === 0) return '';

  return `<w:${elementName}>${parts.join('')}</w:${elementName}>`;
}

// ============================================================================
// SHADING SERIALIZATION
// ============================================================================

/**
 * Serialize shading properties (w:shd)
 */
function serializeShading(shading: ShadingProperties | undefined): string {
  if (!shading) return '';

  const attrs: string[] = [];

  // Pattern/val
  if (shading.pattern) {
    attrs.push(`w:val="${shading.pattern}"`);
  } else {
    attrs.push('w:val="clear"');
  }

  // Color (pattern color)
  if (shading.color?.rgb) {
    attrs.push(`w:color="${shading.color.rgb}"`);
  } else if (shading.color?.auto) {
    attrs.push('w:color="auto"');
  }

  // Fill (background color)
  if (shading.fill?.rgb) {
    attrs.push(`w:fill="${shading.fill.rgb}"`);
  } else if (shading.fill?.auto) {
    attrs.push('w:fill="auto"');
  }

  // Theme fill
  if (shading.fill?.themeColor) {
    attrs.push(`w:themeFill="${shading.fill.themeColor}"`);
  }

  if (shading.fill?.themeTint) {
    attrs.push(`w:themeFillTint="${shading.fill.themeTint}"`);
  }

  if (shading.fill?.themeShade) {
    attrs.push(`w:themeFillShade="${shading.fill.themeShade}"`);
  }

  if (attrs.length === 0) return '';

  return `<w:shd ${attrs.join(' ')}/>`;
}

// ============================================================================
// TABLE LOOK SERIALIZATION
// ============================================================================

/**
 * Serialize table look flags (w:tblLook)
 */
function serializeTableLook(look: TableLook | undefined): string {
  if (!look) return '';

  const attrs: string[] = [];

  if (look.firstRow) {
    attrs.push('w:firstRow="1"');
  }

  if (look.lastRow) {
    attrs.push('w:lastRow="1"');
  }

  if (look.firstColumn) {
    attrs.push('w:firstColumn="1"');
  }

  if (look.lastColumn) {
    attrs.push('w:lastColumn="1"');
  }

  if (look.noHBand) {
    attrs.push('w:noHBand="1"');
  }

  if (look.noVBand) {
    attrs.push('w:noVBand="1"');
  }

  if (attrs.length === 0) return '';

  return `<w:tblLook ${attrs.join(' ')}/>`;
}

// ============================================================================
// FLOATING TABLE PROPERTIES SERIALIZATION
// ============================================================================

/**
 * Serialize floating table properties (w:tblpPr)
 */
function serializeFloatingTableProperties(floating: FloatingTableProperties | undefined): string {
  if (!floating) return '';

  const attrs: string[] = [];

  if (floating.horzAnchor) {
    attrs.push(`w:horzAnchor="${floating.horzAnchor}"`);
  }

  if (floating.vertAnchor) {
    attrs.push(`w:vertAnchor="${floating.vertAnchor}"`);
  }

  if (floating.tblpX !== undefined) {
    attrs.push(`w:tblpX="${floating.tblpX}"`);
  }

  if (floating.tblpXSpec) {
    attrs.push(`w:tblpXSpec="${floating.tblpXSpec}"`);
  }

  if (floating.tblpY !== undefined) {
    attrs.push(`w:tblpY="${floating.tblpY}"`);
  }

  if (floating.tblpYSpec) {
    attrs.push(`w:tblpYSpec="${floating.tblpYSpec}"`);
  }

  if (floating.topFromText !== undefined) {
    attrs.push(`w:topFromText="${floating.topFromText}"`);
  }

  if (floating.bottomFromText !== undefined) {
    attrs.push(`w:bottomFromText="${floating.bottomFromText}"`);
  }

  if (floating.leftFromText !== undefined) {
    attrs.push(`w:leftFromText="${floating.leftFromText}"`);
  }

  if (floating.rightFromText !== undefined) {
    attrs.push(`w:rightFromText="${floating.rightFromText}"`);
  }

  if (attrs.length === 0) return '';

  return `<w:tblpPr ${attrs.join(' ')}/>`;
}

// ============================================================================
// TABLE PROPERTIES SERIALIZATION (w:tblPr)
// ============================================================================

/**
 * Serialize table formatting properties (w:tblPr)
 */
export function serializeTableFormatting(formatting: TableFormatting | undefined): string {
  if (!formatting) return '';

  const parts: string[] = [];

  // Table style (must be first)
  if (formatting.styleId) {
    parts.push(`<w:tblStyle w:val="${escapeXml(formatting.styleId)}"/>`);
  }

  // Floating table properties
  const floatingXml = serializeFloatingTableProperties(formatting.floating);
  if (floatingXml) {
    parts.push(floatingXml);
  }

  // Bidirectional
  if (formatting.bidi) {
    parts.push('<w:bidiVisual/>');
  }

  // Table width
  const widthXml = serializeMeasurement(formatting.width, 'tblW');
  if (widthXml) {
    parts.push(widthXml);
  }

  // Table justification
  if (formatting.justification) {
    parts.push(`<w:jc w:val="${formatting.justification}"/>`);
  }

  // Cell spacing
  const cellSpacingXml = serializeMeasurement(formatting.cellSpacing, 'tblCellSpacing');
  if (cellSpacingXml) {
    parts.push(cellSpacingXml);
  }

  // Table indent
  const indentXml = serializeMeasurement(formatting.indent, 'tblInd');
  if (indentXml) {
    parts.push(indentXml);
  }

  // Table borders
  const bordersXml = serializeTableBorders(formatting.borders, 'tblBorders');
  if (bordersXml) {
    parts.push(bordersXml);
  }

  // Default cell margins
  const marginsXml = serializeCellMargins(formatting.cellMargins, 'tblCellMar');
  if (marginsXml) {
    parts.push(marginsXml);
  }

  // Table layout
  if (formatting.layout) {
    parts.push(`<w:tblLayout w:type="${formatting.layout}"/>`);
  }

  // Shading
  const shadingXml = serializeShading(formatting.shading);
  if (shadingXml) {
    parts.push(shadingXml);
  }

  // Table look
  const lookXml = serializeTableLook(formatting.look);
  if (lookXml) {
    parts.push(lookXml);
  }

  // Overlap
  if (formatting.overlap) {
    parts.push(`<w:tblOverlap w:val="${formatting.overlap}"/>`);
  }

  if (parts.length === 0) return '';

  return `<w:tblPr>${parts.join('')}</w:tblPr>`;
}

// ============================================================================
// TABLE ROW PROPERTIES SERIALIZATION (w:trPr)
// ============================================================================

/**
 * Serialize table row formatting properties (w:trPr)
 */
export function serializeTableRowFormatting(formatting: TableRowFormatting | undefined): string {
  if (!formatting) return '';

  const parts: string[] = [];

  // Can't split
  if (formatting.cantSplit) {
    parts.push('<w:cantSplit/>');
  }

  // Header row
  if (formatting.header) {
    parts.push('<w:tblHeader/>');
  }

  // Row height
  if (formatting.height) {
    const attrs: string[] = [
      `w:val="${formatting.height.value}"`,
    ];

    if (formatting.heightRule) {
      attrs.push(`w:hRule="${formatting.heightRule}"`);
    }

    parts.push(`<w:trHeight ${attrs.join(' ')}/>`);
  }

  // Row justification
  if (formatting.justification) {
    parts.push(`<w:jc w:val="${formatting.justification}"/>`);
  }

  // Hidden
  if (formatting.hidden) {
    parts.push('<w:hidden/>');
  }

  if (parts.length === 0) return '';

  return `<w:trPr>${parts.join('')}</w:trPr>`;
}

// ============================================================================
// CONDITIONAL FORMAT STYLE SERIALIZATION
// ============================================================================

/**
 * Serialize conditional format style (w:cnfStyle)
 */
function serializeConditionalFormatStyle(style: ConditionalFormatStyle | undefined): string {
  if (!style) return '';

  // Build the 12-character binary string
  const bits = [
    style.firstRow ? '1' : '0',
    style.lastRow ? '1' : '0',
    style.firstColumn ? '1' : '0',
    style.lastColumn ? '1' : '0',
    style.oddVBand ? '1' : '0',
    style.evenVBand ? '1' : '0',
    style.oddHBand ? '1' : '0',
    style.evenHBand ? '1' : '0',
    style.nwCell ? '1' : '0',
    style.neCell ? '1' : '0',
    style.swCell ? '1' : '0',
    style.seCell ? '1' : '0',
  ];

  const val = bits.join('');

  // Only serialize if any bits are set
  if (val === '000000000000') return '';

  return `<w:cnfStyle w:val="${val}"/>`;
}

// ============================================================================
// TABLE CELL PROPERTIES SERIALIZATION (w:tcPr)
// ============================================================================

/**
 * Serialize table cell formatting properties (w:tcPr)
 */
export function serializeTableCellFormatting(formatting: TableCellFormatting | undefined): string {
  if (!formatting) return '';

  const parts: string[] = [];

  // Conditional format style
  const cnfStyleXml = serializeConditionalFormatStyle(formatting.conditionalFormat);
  if (cnfStyleXml) {
    parts.push(cnfStyleXml);
  }

  // Cell width
  const widthXml = serializeMeasurement(formatting.width, 'tcW');
  if (widthXml) {
    parts.push(widthXml);
  }

  // Grid span (horizontal merge)
  if (formatting.gridSpan && formatting.gridSpan > 1) {
    parts.push(`<w:gridSpan w:val="${formatting.gridSpan}"/>`);
  }

  // Vertical merge
  if (formatting.vMerge) {
    if (formatting.vMerge === 'restart') {
      parts.push('<w:vMerge w:val="restart"/>');
    } else {
      // continue is the default when w:vMerge has no value
      parts.push('<w:vMerge/>');
    }
  }

  // Cell borders
  const bordersXml = serializeTableBorders(formatting.borders, 'tcBorders');
  if (bordersXml) {
    parts.push(bordersXml);
  }

  // Shading
  const shadingXml = serializeShading(formatting.shading);
  if (shadingXml) {
    parts.push(shadingXml);
  }

  // No wrap
  if (formatting.noWrap) {
    parts.push('<w:noWrap/>');
  }

  // Cell margins
  const marginsXml = serializeCellMargins(formatting.margins, 'tcMar');
  if (marginsXml) {
    parts.push(marginsXml);
  }

  // Text direction
  if (formatting.textDirection) {
    parts.push(`<w:textDirection w:val="${formatting.textDirection}"/>`);
  }

  // Fit text
  if (formatting.fitText) {
    parts.push('<w:tcFitText/>');
  }

  // Vertical alignment
  if (formatting.verticalAlign) {
    parts.push(`<w:vAlign w:val="${formatting.verticalAlign}"/>`);
  }

  // Hide mark
  if (formatting.hideMark) {
    parts.push('<w:hideMark/>');
  }

  if (parts.length === 0) return '';

  return `<w:tcPr>${parts.join('')}</w:tcPr>`;
}

// ============================================================================
// TABLE GRID SERIALIZATION
// ============================================================================

/**
 * Serialize table grid (w:tblGrid)
 */
function serializeTableGrid(columnWidths: number[] | undefined): string {
  if (!columnWidths || columnWidths.length === 0) return '';

  const cols = columnWidths.map(w => `<w:gridCol w:w="${w}"/>`);

  return `<w:tblGrid>${cols.join('')}</w:tblGrid>`;
}

// ============================================================================
// CELL CONTENT SERIALIZATION
// ============================================================================

/**
 * Serialize cell content (paragraphs, nested tables)
 */
function serializeCellContent(content: (Paragraph | Table)[]): string {
  const parts: string[] = [];

  for (const item of content) {
    if (item.type === 'paragraph') {
      parts.push(serializeParagraph(item));
    } else if (item.type === 'table') {
      parts.push(serializeTable(item));
    }
  }

  // Ensure at least one empty paragraph (Word requires this)
  if (parts.length === 0) {
    parts.push('<w:p/>');
  }

  return parts.join('');
}

// ============================================================================
// TABLE CELL SERIALIZATION
// ============================================================================

/**
 * Serialize a table cell (w:tc)
 */
export function serializeTableCell(cell: TableCell): string {
  const parts: string[] = [];

  // Cell properties
  const tcPrXml = serializeTableCellFormatting(cell.formatting);
  if (tcPrXml) {
    parts.push(tcPrXml);
  }

  // Cell content
  parts.push(serializeCellContent(cell.content));

  return `<w:tc>${parts.join('')}</w:tc>`;
}

// ============================================================================
// TABLE ROW SERIALIZATION
// ============================================================================

/**
 * Serialize a table row (w:tr)
 */
export function serializeTableRow(row: TableRow): string {
  const parts: string[] = [];

  // Row properties
  const trPrXml = serializeTableRowFormatting(row.formatting);
  if (trPrXml) {
    parts.push(trPrXml);
  }

  // Cells
  for (const cell of row.cells) {
    parts.push(serializeTableCell(cell));
  }

  return `<w:tr>${parts.join('')}</w:tr>`;
}

// ============================================================================
// MAIN TABLE SERIALIZATION
// ============================================================================

/**
 * Serialize a table to OOXML XML (w:tbl)
 *
 * @param table - The table to serialize
 * @returns XML string for the table
 */
export function serializeTable(table: Table): string {
  const parts: string[] = [];

  // Table properties
  const tblPrXml = serializeTableFormatting(table.formatting);
  if (tblPrXml) {
    parts.push(tblPrXml);
  }

  // Table grid
  const tblGridXml = serializeTableGrid(table.columnWidths);
  if (tblGridXml) {
    parts.push(tblGridXml);
  }

  // Rows
  for (const row of table.rows) {
    parts.push(serializeTableRow(row));
  }

  return `<w:tbl>${parts.join('')}</w:tbl>`;
}

/**
 * Serialize multiple tables to OOXML XML
 *
 * @param tables - The tables to serialize
 * @returns XML string for all tables
 */
export function serializeTables(tables: Table[]): string {
  return tables.map(serializeTable).join('');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a table has any rows
 */
export function hasTableRows(table: Table): boolean {
  return table.rows.length > 0;
}

/**
 * Check if a table has formatting
 */
export function hasTableFormatting(table: Table): boolean {
  return table.formatting !== undefined && Object.keys(table.formatting).length > 0;
}

/**
 * Check if a row has any cells
 */
export function hasRowCells(row: TableRow): boolean {
  return row.cells.length > 0;
}

/**
 * Check if a row has formatting
 */
export function hasRowFormatting(row: TableRow): boolean {
  return row.formatting !== undefined && Object.keys(row.formatting).length > 0;
}

/**
 * Check if a cell has any content
 */
export function hasCellContent(cell: TableCell): boolean {
  return cell.content.length > 0;
}

/**
 * Check if a cell has formatting
 */
export function hasCellFormatting(cell: TableCell): boolean {
  return cell.formatting !== undefined && Object.keys(cell.formatting).length > 0;
}

/**
 * Get the number of columns in a table
 */
export function getTableColumnCount(table: Table): number {
  if (table.columnWidths && table.columnWidths.length > 0) {
    return table.columnWidths.length;
  }

  if (table.rows.length === 0) return 0;

  // Count cells in first row, accounting for grid span
  return table.rows[0].cells.reduce((count, cell) => {
    return count + (cell.formatting?.gridSpan ?? 1);
  }, 0);
}

/**
 * Get the number of rows in a table
 */
export function getTableRowCount(table: Table): number {
  return table.rows.length;
}

/**
 * Create an empty table
 */
export function createEmptyTable(rows: number = 1, cols: number = 1): Table {
  const tableRows: TableRow[] = [];

  for (let r = 0; r < rows; r++) {
    const cells: TableCell[] = [];
    for (let c = 0; c < cols; c++) {
      cells.push({
        type: 'tableCell',
        content: [{ type: 'paragraph', content: [] }],
      });
    }
    tableRows.push({
      type: 'tableRow',
      cells,
    });
  }

  return {
    type: 'table',
    rows: tableRows,
  };
}

/**
 * Create a table cell with text content
 */
export function createTextCell(
  text: string,
  formatting?: TableCellFormatting
): TableCell {
  return {
    type: 'tableCell',
    formatting,
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'run',
            content: [{ type: 'text', text }],
          },
        ],
      },
    ],
  };
}

export default serializeTable;
