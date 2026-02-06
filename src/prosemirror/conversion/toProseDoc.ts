/**
 * Document to ProseMirror Conversion
 *
 * Converts our Document type (from DOCX parsing) to a ProseMirror document.
 * Preserves all formatting attributes for round-trip fidelity.
 *
 * Style Resolution:
 * When styles are provided, paragraph properties are resolved from the style chain:
 * - Document defaults (docDefaults)
 * - Normal style (if no explicit styleId)
 * - Style chain (basedOn inheritance)
 * - Inline properties (highest priority)
 */

import type { Node as PMNode } from 'prosemirror-model';
import { schema } from '../schema';
import type { ParagraphAttrs } from '../schema/nodes';
import type {
  Document,
  Paragraph,
  Run,
  TextFormatting,
  RunContent,
  Hyperlink,
  Image,
  TextBox,
  Shape,
  StyleDefinitions,
  Table,
  TableRow,
  TableCell,
  TableCellFormatting,
  TableBorders,
  SimpleField,
  ComplexField,
  InlineSdt,
} from '../../types/document';
import { emuToPixels } from '../../docx/imageParser';
import { createStyleResolver, type StyleResolver } from '../styles';
import type { TableAttrs, TableRowAttrs, TableCellAttrs } from '../schema/nodes';

/**
 * Options for document conversion
 */
export interface ToProseDocOptions {
  /** Style definitions for resolving paragraph styles */
  styles?: StyleDefinitions;
}

/**
 * Convert a Document to a ProseMirror document
 *
 * @param document - The Document to convert
 * @param options - Conversion options including style definitions
 */
export function toProseDoc(document: Document, options?: ToProseDocOptions): PMNode {
  const paragraphs = document.package.document.content;
  const nodes: PMNode[] = [];

  // Create style resolver if styles are provided
  const styleResolver = options?.styles ? createStyleResolver(options.styles) : null;

  for (const block of paragraphs) {
    if (block.type === 'paragraph') {
      // Extract text boxes from paragraph runs before converting
      const textBoxes = extractTextBoxesFromParagraph(block);
      const pmParagraph = convertParagraph(block, styleResolver);
      nodes.push(pmParagraph);
      // Append any text box nodes after the paragraph
      for (const tb of textBoxes) {
        nodes.push(convertTextBox(tb, styleResolver));
      }
    } else if (block.type === 'table') {
      const pmTable = convertTable(block, styleResolver);
      nodes.push(pmTable);
    }
  }

  // Ensure we have at least one paragraph
  if (nodes.length === 0) {
    nodes.push(schema.node('paragraph', {}, []));
  }

  return schema.node('doc', null, nodes);
}

/**
 * Convert a Paragraph to a ProseMirror paragraph node
 *
 * Resolves style-based text formatting and passes it to runs so that
 * paragraph styles (like Heading1) apply their font size, color, etc.
 */
function convertParagraph(paragraph: Paragraph, styleResolver: StyleResolver | null): PMNode {
  const attrs = paragraphFormattingToAttrs(paragraph, styleResolver);
  const inlineNodes: PMNode[] = [];

  // Get style-based text formatting (font size, bold, color, etc.)
  // This comes from the paragraph's style (e.g., Heading1 defines fontSize: 28pt, bold: true)
  let styleRunFormatting: TextFormatting | undefined;
  if (styleResolver) {
    const resolved = styleResolver.resolveParagraphStyle(paragraph.formatting?.styleId);
    styleRunFormatting = resolved.runFormatting;
  }

  for (const content of paragraph.content) {
    if (content.type === 'run') {
      const runNodes = convertRun(content, styleRunFormatting);
      inlineNodes.push(...runNodes);
    } else if (content.type === 'hyperlink') {
      const linkNodes = convertHyperlink(content, styleRunFormatting);
      inlineNodes.push(...linkNodes);
    } else if (content.type === 'simpleField' || content.type === 'complexField') {
      const fieldNode = convertField(content);
      if (fieldNode) inlineNodes.push(fieldNode);
    } else if (content.type === 'inlineSdt') {
      const sdtNode = convertInlineSdt(content, styleRunFormatting);
      if (sdtNode) inlineNodes.push(sdtNode);
    }
    // Skip other content types for now (bookmarks, etc.)
  }

  return schema.node('paragraph', attrs, inlineNodes);
}

/**
 * Convert ParagraphFormatting to ProseMirror paragraph attrs
 *
 * If a styleResolver is provided, resolves style-based formatting and merges
 * with inline formatting. Inline formatting takes precedence.
 */
function paragraphFormattingToAttrs(
  paragraph: Paragraph,
  styleResolver: StyleResolver | null
): ParagraphAttrs {
  const formatting = paragraph.formatting;
  const styleId = formatting?.styleId;

  // Start with base attrs
  const attrs: ParagraphAttrs = {
    paraId: paragraph.paraId ?? undefined,
    textId: paragraph.textId ?? undefined,
    styleId: styleId,
    numPr: formatting?.numPr,
    // List rendering info from parsed numbering definitions
    listNumFmt: paragraph.listRendering?.numFmt,
    listIsBullet: paragraph.listRendering?.isBullet,
    listMarker: paragraph.listRendering?.marker,
  };

  // If we have a style resolver, resolve the style and get base properties
  if (styleResolver) {
    const resolved = styleResolver.resolveParagraphStyle(styleId);
    const stylePpr = resolved.paragraphFormatting;

    // Apply style-based values as defaults (inline overrides)
    attrs.alignment = formatting?.alignment ?? stylePpr?.alignment;
    attrs.spaceBefore = formatting?.spaceBefore ?? stylePpr?.spaceBefore;
    attrs.spaceAfter = formatting?.spaceAfter ?? stylePpr?.spaceAfter;
    attrs.lineSpacing = formatting?.lineSpacing ?? stylePpr?.lineSpacing;
    attrs.lineSpacingRule = formatting?.lineSpacingRule ?? stylePpr?.lineSpacingRule;
    attrs.indentLeft = formatting?.indentLeft ?? stylePpr?.indentLeft;
    attrs.indentRight = formatting?.indentRight ?? stylePpr?.indentRight;
    attrs.indentFirstLine = formatting?.indentFirstLine ?? stylePpr?.indentFirstLine;
    attrs.hangingIndent = formatting?.hangingIndent ?? stylePpr?.hangingIndent;
    attrs.borders = formatting?.borders ?? stylePpr?.borders;
    attrs.shading = formatting?.shading ?? stylePpr?.shading;
    attrs.tabs = formatting?.tabs ?? stylePpr?.tabs;

    // Page break control
    attrs.pageBreakBefore = formatting?.pageBreakBefore ?? stylePpr?.pageBreakBefore;
    attrs.keepNext = formatting?.keepNext ?? stylePpr?.keepNext;
    attrs.keepLines = formatting?.keepLines ?? stylePpr?.keepLines;

    // Outline level (for TOC)
    attrs.outlineLevel = formatting?.outlineLevel ?? stylePpr?.outlineLevel;

    // Section break type from paragraph-level section properties
    if (paragraph.sectionProperties?.sectionStart) {
      const st = paragraph.sectionProperties.sectionStart;
      if (st === 'nextPage' || st === 'continuous' || st === 'oddPage' || st === 'evenPage') {
        attrs.sectionBreakType = st;
      }
    }

    // If style defines numPr but inline doesn't, use style's numPr
    if (!formatting?.numPr && stylePpr?.numPr) {
      attrs.numPr = stylePpr.numPr;
    }
  } else {
    // No style resolver - use inline formatting only
    attrs.alignment = formatting?.alignment;
    attrs.spaceBefore = formatting?.spaceBefore;
    attrs.spaceAfter = formatting?.spaceAfter;
    attrs.lineSpacing = formatting?.lineSpacing;
    attrs.lineSpacingRule = formatting?.lineSpacingRule;
    attrs.indentLeft = formatting?.indentLeft;
    attrs.indentRight = formatting?.indentRight;
    attrs.indentFirstLine = formatting?.indentFirstLine;
    attrs.hangingIndent = formatting?.hangingIndent;
    attrs.borders = formatting?.borders;
    attrs.shading = formatting?.shading;
    attrs.tabs = formatting?.tabs;

    // Page break control
    attrs.pageBreakBefore = formatting?.pageBreakBefore;
    attrs.keepNext = formatting?.keepNext;
    attrs.keepLines = formatting?.keepLines;

    // Outline level
    attrs.outlineLevel = formatting?.outlineLevel;
  }

  // Section break type from paragraph-level section properties
  if (paragraph.sectionProperties?.sectionStart) {
    const st = paragraph.sectionProperties.sectionStart;
    if (st === 'nextPage' || st === 'continuous' || st === 'oddPage' || st === 'evenPage') {
      attrs.sectionBreakType = st;
    }
  }

  return attrs;
}

// ============================================================================
// TABLE CONVERSION
// ============================================================================

/**
 * Resolve table style conditional formatting
 */
function resolveTableStyleConditional(
  styleResolver: StyleResolver | null,
  tableStyleId: string | undefined,
  conditionType: string
): { tcPr?: TableCellFormatting; rPr?: TextFormatting } | undefined {
  if (!styleResolver || !tableStyleId) return undefined;

  const style = styleResolver.getStyle(tableStyleId);
  if (!style?.tblStylePr) return undefined;

  const conditional = style.tblStylePr.find((p) => p.type === conditionType);
  return conditional ? { tcPr: conditional.tcPr, rPr: conditional.rPr } : undefined;
}

/**
 * Convert a Table to a ProseMirror table node
 *
 * Handles column widths from w:tblGrid - if cell widths aren't specified,
 * we use the grid column widths to set cell widths. This ensures tables
 * preserve their layout when opened from DOCX files.
 */
/**
 * Calculate rowSpan values from vMerge attributes.
 * OOXML uses vMerge="restart" to start a vertical merge and vMerge="continue" for cells that should be merged.
 * This function converts that to rowSpan values and marks which cells should be skipped.
 */
function calculateRowSpans(table: Table): Map<string, { rowSpan: number; skip: boolean }> {
  const result = new Map<string, { rowSpan: number; skip: boolean }>();
  const numRows = table.rows.length;

  // Track active vertical merges per column (stores the row index where merge started)
  const activeMerges = new Map<number, number>();

  // Process each row
  for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
    const row = table.rows[rowIndex];
    let colIndex = 0;

    for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex++) {
      const cell = row.cells[cellIndex];
      const colspan = cell.formatting?.gridSpan ?? 1;
      const vMerge = cell.formatting?.vMerge;
      const key = `${rowIndex}-${colIndex}`;

      if (vMerge === 'restart') {
        // Start of a new vertical merge
        activeMerges.set(colIndex, rowIndex);
        result.set(key, { rowSpan: 1, skip: false });
      } else if (vMerge === 'continue') {
        // Continuation of a merge - this cell should be skipped
        const startRow = activeMerges.get(colIndex);
        if (startRow !== undefined) {
          // Increment rowSpan of the starting cell
          const startKey = `${startRow}-${colIndex}`;
          const startCell = result.get(startKey);
          if (startCell) {
            startCell.rowSpan++;
          }
        }
        result.set(key, { rowSpan: 1, skip: true });
      } else {
        // No vMerge - clear any active merge for this column
        activeMerges.delete(colIndex);
        result.set(key, { rowSpan: 1, skip: false });
      }

      colIndex += colspan;
    }
  }

  return result;
}

function convertTable(table: Table, styleResolver: StyleResolver | null): PMNode {
  // Calculate rowSpan values from vMerge
  const rowSpanMap = calculateRowSpans(table);

  // Get column widths from table grid
  const columnWidths = table.columnWidths;

  const attrs: TableAttrs = {
    styleId: table.formatting?.styleId,
    width: table.formatting?.width?.value,
    widthType: table.formatting?.width?.type,
    justification: table.formatting?.justification,
    columnWidths: columnWidths,
  };

  // Calculate total width from columnWidths if available (for percentage calculation)
  const totalWidth = columnWidths?.reduce((sum, w) => sum + w, 0) ?? 0;

  // Get the table style's conditional formatting
  const tableStyleId = table.formatting?.styleId;
  const look = table.formatting?.look;

  // Resolve table borders: prefer table's own borders, fall back to table style's borders
  const tableStyle = tableStyleId ? styleResolver?.getStyle(tableStyleId) : undefined;
  const resolvedTableBorders = table.formatting?.borders ?? tableStyle?.tblPr?.borders;

  // Get firstRow style if enabled
  const firstRowStyle = look?.firstRow
    ? resolveTableStyleConditional(styleResolver, tableStyleId, 'firstRow')
    : undefined;

  // Get lastRow style if enabled
  const lastRowStyle = look?.lastRow
    ? resolveTableStyleConditional(styleResolver, tableStyleId, 'lastRow')
    : undefined;

  // Get banded row styles if horizontal banding is enabled (noHBand is false or undefined)
  const bandingEnabled = look?.noHBand !== true;
  const band1HorzStyle = bandingEnabled
    ? resolveTableStyleConditional(styleResolver, tableStyleId, 'band1Horz')
    : undefined;
  const band2HorzStyle = bandingEnabled
    ? resolveTableStyleConditional(styleResolver, tableStyleId, 'band2Horz')
    : undefined;

  // Track data row index (excluding header rows) for banding
  let dataRowIndex = 0;
  const totalRows = table.rows.length;
  const rows = table.rows.map((row, rowIndex) => {
    const isHeader = rowIndex === 0 && !!look?.firstRow;
    const isLastRow = rowIndex === totalRows - 1 && !!look?.lastRow;

    // Determine conditional style for this row
    // lastRow takes precedence over banding for the final row
    let conditionalStyle: { tcPr?: TableCellFormatting; rPr?: TextFormatting } | undefined;
    if (isHeader) {
      conditionalStyle = firstRowStyle;
    } else if (isLastRow) {
      conditionalStyle = lastRowStyle;
    } else if (bandingEnabled) {
      // Alternate between band1 and band2 for data rows
      conditionalStyle = dataRowIndex % 2 === 0 ? band1HorzStyle : band2HorzStyle;
      dataRowIndex++;
    }

    return convertTableRow(
      row,
      styleResolver,
      isHeader,
      columnWidths,
      totalWidth,
      conditionalStyle,
      resolvedTableBorders, // Pass resolved table borders (own or from style)
      rowIndex,
      totalRows,
      rowSpanMap
    );
  });

  return schema.node('table', attrs, rows);
}

/**
 * Convert a TableRow to a ProseMirror table row node
 */
function convertTableRow(
  row: TableRow,
  styleResolver: StyleResolver | null,
  isHeaderRow: boolean,
  columnWidths?: number[],
  totalWidth?: number,
  conditionalStyle?: { tcPr?: TableCellFormatting; rPr?: TextFormatting },
  tableBorders?: TableBorders,
  rowIndex?: number,
  totalRows?: number,
  rowSpanMap?: Map<string, { rowSpan: number; skip: boolean }>
): PMNode {
  const attrs: TableRowAttrs = {
    height: row.formatting?.height?.value,
    heightRule: row.formatting?.heightRule,
    isHeader: isHeaderRow || row.formatting?.header,
  };

  const numCells = row.cells.length;
  const isFirstRow = rowIndex === 0;
  const isLastRow = rowIndex === (totalRows ?? 1) - 1;

  // Track column index for mapping to columnWidths (accounting for colspan)
  let colIndex = 0;
  const cells: PMNode[] = [];

  for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex++) {
    const cell = row.cells[cellIndex];
    const colspan = cell.formatting?.gridSpan ?? 1;

    // Check if this cell should be skipped (it's a vMerge continue cell)
    const rowSpanKey = `${rowIndex ?? 0}-${colIndex}`;
    const rowSpanInfo = rowSpanMap?.get(rowSpanKey);
    const shouldSkip = rowSpanInfo?.skip ?? false;
    const calculatedRowSpan = rowSpanInfo?.rowSpan ?? 1;

    // Calculate the width for this cell from columnWidths if cell doesn't have own width
    let gridWidth: number | undefined;
    if (columnWidths && totalWidth && totalWidth > 0) {
      // Sum widths for all columns this cell spans
      let cellWidthTwips = 0;
      for (let i = 0; i < colspan && colIndex + i < columnWidths.length; i++) {
        cellWidthTwips += columnWidths[colIndex + i];
      }
      // Convert to percentage of total table width
      gridWidth = Math.round((cellWidthTwips / totalWidth) * 100);
    }
    colIndex += colspan;

    // Skip cells that are part of a vertical merge (vMerge="continue")
    if (shouldSkip) {
      continue;
    }

    // Determine cell position for table border application
    const isFirstCol = cellIndex === 0;
    const isLastCol = cellIndex === numCells - 1;

    cells.push(
      convertTableCell(
        cell,
        styleResolver,
        isHeaderRow,
        gridWidth,
        conditionalStyle,
        tableBorders,
        isFirstRow,
        isLastRow,
        isFirstCol,
        isLastCol,
        calculatedRowSpan
      )
    );
  }

  return schema.node('tableRow', attrs, cells);
}

/**
 * Convert a TableCell to a ProseMirror table cell node
 */
function convertTableCell(
  cell: TableCell,
  styleResolver: StyleResolver | null,
  isHeader: boolean,
  gridWidthPercent?: number,
  conditionalStyle?: { tcPr?: TableCellFormatting; rPr?: TextFormatting },
  tableBorders?: TableBorders,
  isFirstRow?: boolean,
  isLastRow?: boolean,
  isFirstCol?: boolean,
  isLastCol?: boolean,
  calculatedRowSpan?: number
): PMNode {
  const formatting = cell.formatting;

  // Use the pre-calculated rowSpan from vMerge analysis
  const rowspan = calculatedRowSpan ?? 1;

  // Determine width: prefer cell's own width, fall back to grid width
  let width = formatting?.width?.value;
  let widthType = formatting?.width?.type;

  // If cell doesn't have its own width, use the grid-calculated percentage
  if (width === undefined && gridWidthPercent !== undefined) {
    width = gridWidthPercent;
    widthType = 'pct';
  }

  // Determine background color: prefer cell's own shading, fall back to conditional style
  const backgroundColor =
    formatting?.shading?.fill?.rgb ?? conditionalStyle?.tcPr?.shading?.fill?.rgb;

  // Convert borders — preserve full BorderSpec per side
  // Priority: cell borders > conditional style borders > table borders
  const cellBorders = formatting?.borders ?? conditionalStyle?.tcPr?.borders;
  let borders:
    | {
        top?: import('../../types/document').BorderSpec;
        bottom?: import('../../types/document').BorderSpec;
        left?: import('../../types/document').BorderSpec;
        right?: import('../../types/document').BorderSpec;
      }
    | undefined;

  if (cellBorders) {
    borders = {
      top: cellBorders.top,
      bottom: cellBorders.bottom,
      left: cellBorders.left,
      right: cellBorders.right,
    };
  } else if (tableBorders) {
    // Fall back to table-level borders based on cell position
    // Table borders: top/bottom/left/right for outer edges, insideH/insideV for internal
    borders = {
      top: isFirstRow ? tableBorders.top : tableBorders.insideH,
      bottom: isLastRow ? tableBorders.bottom : tableBorders.insideH,
      left: isFirstCol ? tableBorders.left : tableBorders.insideV,
      right: isLastCol ? tableBorders.right : tableBorders.insideV,
    };
  }

  const attrs: TableCellAttrs = {
    colspan: formatting?.gridSpan ?? 1,
    rowspan: rowspan,
    width: width,
    widthType: widthType,
    verticalAlign: formatting?.verticalAlign,
    backgroundColor: backgroundColor,
    textDirection: formatting?.textDirection,
    noWrap: formatting?.noWrap,
    borders: borders,
    margins: formatting?.margins
      ? {
          top: formatting.margins.top?.value,
          bottom: formatting.margins.bottom?.value,
          left: formatting.margins.left?.value,
          right: formatting.margins.right?.value,
        }
      : undefined,
  };

  // Convert cell content (paragraphs and nested tables)
  const contentNodes: PMNode[] = [];
  for (const content of cell.content) {
    if (content.type === 'paragraph') {
      contentNodes.push(convertParagraph(content, styleResolver));
    } else if (content.type === 'table') {
      // Nested tables - recursively convert
      contentNodes.push(convertTable(content, styleResolver));
    }
  }

  // Ensure cell has at least one paragraph
  if (contentNodes.length === 0) {
    contentNodes.push(schema.node('paragraph', {}, []));
  }

  // Use tableHeader for header cells, tableCell otherwise
  const nodeType = isHeader ? 'tableHeader' : 'tableCell';
  return schema.node(nodeType, attrs, contentNodes);
}

/**
 * Convert a SimpleField or ComplexField to a ProseMirror field node.
 */
function convertField(field: SimpleField | ComplexField): PMNode | null {
  // Extract display text from field content/result
  let displayText = '';
  const runs = field.type === 'simpleField' ? field.content : field.fieldResult;
  if (runs) {
    for (const r of runs) {
      if (r.type === 'run') {
        for (const c of r.content) {
          if (c.type === 'text') displayText += c.text;
        }
      }
    }
  }

  return schema.node('field', {
    fieldType: field.fieldType,
    instruction: field.instruction,
    displayText,
    fieldKind: field.type === 'simpleField' ? 'simple' : 'complex',
    fldLock: field.fldLock ?? false,
    dirty: field.dirty ?? false,
  });
}

/**
 * Convert an InlineSdt to a ProseMirror sdt node with inline content.
 */
function convertInlineSdt(sdt: InlineSdt, styleRunFormatting?: TextFormatting): PMNode | null {
  const props = sdt.properties;
  const inlineNodes: PMNode[] = [];

  for (const content of sdt.content) {
    if (content.type === 'run') {
      const runNodes = convertRun(content, styleRunFormatting);
      inlineNodes.push(...runNodes);
    } else if (content.type === 'hyperlink') {
      const linkNodes = convertHyperlink(content, styleRunFormatting);
      inlineNodes.push(...linkNodes);
    }
  }

  return schema.node(
    'sdt',
    {
      sdtType: props.sdtType,
      alias: props.alias ?? null,
      tag: props.tag ?? null,
      lock: props.lock ?? null,
      placeholder: props.placeholder ?? null,
      showingPlaceholder: props.showingPlaceholder ?? false,
      dateFormat: props.dateFormat ?? null,
      listItems: props.listItems ? JSON.stringify(props.listItems) : null,
      checked: props.checked ?? null,
    },
    inlineNodes.length > 0 ? inlineNodes : undefined
  );
}

/**
 * Convert a Run to ProseMirror text nodes with marks
 *
 * @param run - The run to convert
 * @param styleFormatting - Text formatting from the paragraph's style (e.g., Heading1's font size/color)
 */
function convertRun(run: Run, styleFormatting?: TextFormatting): PMNode[] {
  const nodes: PMNode[] = [];

  // Merge style formatting with run's inline formatting
  // Inline formatting takes precedence over style formatting
  const mergedFormatting = mergeTextFormatting(styleFormatting, run.formatting);
  const marks = textFormattingToMarks(mergedFormatting);

  for (const content of run.content) {
    const contentNodes = convertRunContent(content, marks);
    nodes.push(...contentNodes);
  }

  return nodes;
}

/**
 * Merge two TextFormatting objects (source overrides target)
 */
function mergeTextFormatting(
  target: TextFormatting | undefined,
  source: TextFormatting | undefined
): TextFormatting | undefined {
  if (!source && !target) return undefined;
  if (!source) return target;
  if (!target) return source;

  // Start with target (style formatting), then overlay source (inline formatting)
  const result: TextFormatting = { ...target };

  // Merge each property - source (inline) takes precedence
  if (source.bold !== undefined) result.bold = source.bold;
  if (source.italic !== undefined) result.italic = source.italic;
  if (source.underline !== undefined) result.underline = source.underline;
  if (source.strike !== undefined) result.strike = source.strike;
  if (source.doubleStrike !== undefined) result.doubleStrike = source.doubleStrike;
  if (source.color !== undefined) result.color = source.color;
  if (source.highlight !== undefined) result.highlight = source.highlight;
  if (source.fontSize !== undefined) result.fontSize = source.fontSize;
  if (source.fontFamily !== undefined) result.fontFamily = source.fontFamily;
  if (source.vertAlign !== undefined) result.vertAlign = source.vertAlign;
  if (source.allCaps !== undefined) result.allCaps = source.allCaps;
  if (source.smallCaps !== undefined) result.smallCaps = source.smallCaps;

  return result;
}

/**
 * Convert RunContent to ProseMirror nodes
 */
function convertRunContent(content: RunContent, marks: ReturnType<typeof schema.mark>[]): PMNode[] {
  switch (content.type) {
    case 'text':
      if (content.text) {
        return [schema.text(content.text, marks)];
      }
      return [];

    case 'break':
      if (content.breakType === 'textWrapping' || !content.breakType) {
        return [schema.node('hardBreak')];
      }
      // Page breaks not supported in inline content
      return [];

    case 'tab':
      // Convert to tab node for proper rendering
      return [schema.node('tab')];

    case 'drawing':
      if (content.image) {
        return [convertImage(content.image)];
      }
      return [];

    case 'shape': {
      // Shapes with text body are handled as text boxes at block level
      // Other shapes render as inline SVG
      const shp = content.shape;
      if (shp.textBody && shp.textBody.content.length > 0) {
        // Skip - handled by extractTextBoxesFromParagraph
        return [];
      }
      return [convertShape(shp)];
    }

    case 'footnoteRef':
      // Footnote reference - render as superscript number with footnoteRef mark
      const footnoteMark = schema.mark('footnoteRef', {
        id: content.id.toString(),
        noteType: 'footnote',
      });
      return [schema.text(content.id.toString(), [...marks, footnoteMark])];

    case 'endnoteRef':
      // Endnote reference - render as superscript number with footnoteRef mark
      const endnoteMark = schema.mark('footnoteRef', {
        id: content.id.toString(),
        noteType: 'endnote',
      });
      return [schema.text(content.id.toString(), [...marks, endnoteMark])];

    default:
      return [];
  }
}

/**
 * Convert an Image to a ProseMirror image node
 *
 * DOCX images have size in EMUs (English Metric Units), which must be
 * converted to pixels for proper HTML rendering.
 * 914400 EMU = 1 inch = 96 CSS pixels
 *
 * Image types in DOCX:
 * 1. Inline (wp:inline) - flows with text like a character
 * 2. Floating/Anchored (wp:anchor) with wrap types:
 *    - Square/Tight/Through: text wraps around image
 *      - wrapText='left' → text on LEFT, image floats RIGHT
 *      - wrapText='right' → text on RIGHT, image floats LEFT
 *      - wrapText='bothSides' → depends on horizontal alignment
 *    - TopAndBottom: image on its own line, text above/below only
 *    - None/Behind/InFront: positioned image, no text wrap
 */
function convertImage(image: Image): PMNode {
  // Convert EMU to pixels for proper sizing
  const widthPx = image.size?.width ? emuToPixels(image.size.width) : undefined;
  const heightPx = image.size?.height ? emuToPixels(image.size.height) : undefined;

  // Determine wrap type and float direction
  const wrapType = image.wrap.type;
  const wrapText = image.wrap.wrapText;
  const hAlign = image.position?.horizontal?.alignment;

  // Determine CSS float based on wrap settings
  // In DOCX: wrapText='left' means "text flows on the left" → image is on right → float: right
  //          wrapText='right' means "text flows on the right" → image is on left → float: left
  let cssFloat: 'left' | 'right' | 'none' | undefined;

  if (wrapType === 'inline') {
    cssFloat = 'none'; // Inline images don't float
  } else if (wrapType === 'topAndBottom') {
    cssFloat = 'none'; // Block images don't float
  } else if (wrapType === 'square' || wrapType === 'tight' || wrapType === 'through') {
    // These wrap types support text wrapping around the image
    if (wrapText === 'left') {
      cssFloat = 'right'; // Text on left → image floats right
    } else if (wrapText === 'right') {
      cssFloat = 'left'; // Text on right → image floats left
    } else if (wrapText === 'bothSides' || wrapText === 'largest') {
      // Use horizontal alignment to determine float
      if (hAlign === 'left') {
        cssFloat = 'left';
      } else if (hAlign === 'right') {
        cssFloat = 'right';
      } else {
        cssFloat = 'none'; // Center or no alignment → block
      }
    } else {
      // Default: use horizontal alignment
      if (hAlign === 'left') {
        cssFloat = 'left';
      } else if (hAlign === 'right') {
        cssFloat = 'right';
      } else {
        cssFloat = 'none';
      }
    }
  } else {
    // Behind, inFront, etc. - positioned images, no float
    cssFloat = 'none';
  }

  // Determine display mode for CSS
  let displayMode: 'inline' | 'block' | 'float' = 'inline';
  if (wrapType === 'inline') {
    displayMode = 'inline';
  } else if (cssFloat && cssFloat !== 'none') {
    displayMode = 'float';
  } else {
    displayMode = 'block'; // TopAndBottom or centered
  }

  // Build transform string if needed (rotation, flip)
  let transform: string | undefined;
  if (image.transform) {
    const transforms: string[] = [];
    if (image.transform.rotation) {
      transforms.push(`rotate(${image.transform.rotation}deg)`);
    }
    if (image.transform.flipH) {
      transforms.push('scaleX(-1)');
    }
    if (image.transform.flipV) {
      transforms.push('scaleY(-1)');
    }
    if (transforms.length > 0) {
      transform = transforms.join(' ');
    }
  }

  // Convert wrap distances from EMU to pixels for margins
  const distTop = image.wrap.distT ? emuToPixels(image.wrap.distT) : undefined;
  const distBottom = image.wrap.distB ? emuToPixels(image.wrap.distB) : undefined;
  const distLeft = image.wrap.distL ? emuToPixels(image.wrap.distL) : undefined;
  const distRight = image.wrap.distR ? emuToPixels(image.wrap.distR) : undefined;

  // Build position data for floating images
  let position:
    | {
        horizontal?: { relativeTo?: string; posOffset?: number; align?: string };
        vertical?: { relativeTo?: string; posOffset?: number; align?: string };
      }
    | undefined;
  if (image.position) {
    position = {
      horizontal: image.position.horizontal
        ? {
            relativeTo: image.position.horizontal.relativeTo,
            posOffset: image.position.horizontal.posOffset,
            align: image.position.horizontal.alignment,
          }
        : undefined,
      vertical: image.position.vertical
        ? {
            relativeTo: image.position.vertical.relativeTo,
            posOffset: image.position.vertical.posOffset,
            align: image.position.vertical.alignment,
          }
        : undefined,
    };
  }

  // Convert outline to border attrs
  let borderWidth: number | undefined;
  let borderColor: string | undefined;
  let borderStyle: string | undefined;
  if (image.outline && image.outline.width) {
    // Convert EMU to pixels (1 EMU = 1/914400 inch, 1 inch = 96 px)
    borderWidth = Math.round((image.outline.width / 914400) * 96 * 100) / 100;
    if (image.outline.color?.rgb) {
      borderColor = `#${image.outline.color.rgb}`;
    }
    // Map OOXML dash styles to CSS border styles
    const styleMap: Record<string, string> = {
      solid: 'solid',
      dot: 'dotted',
      dash: 'dashed',
      lgDash: 'dashed',
      dashDot: 'dashed',
      lgDashDot: 'dashed',
      lgDashDotDot: 'dashed',
      sysDot: 'dotted',
      sysDash: 'dashed',
      sysDashDot: 'dashed',
      sysDashDotDot: 'dashed',
    };
    borderStyle = image.outline.style ? styleMap[image.outline.style] || 'solid' : 'solid';
  }

  return schema.node('image', {
    src: image.src || '',
    alt: image.alt,
    title: image.title,
    width: widthPx,
    height: heightPx,
    rId: image.rId,
    wrapType: wrapType,
    displayMode: displayMode,
    cssFloat: cssFloat,
    transform: transform,
    distTop: distTop,
    distBottom: distBottom,
    distLeft: distLeft,
    distRight: distRight,
    position: position,
    borderWidth: borderWidth,
    borderColor: borderColor,
    borderStyle: borderStyle,
  });
}

/**
 * Convert a Hyperlink to ProseMirror nodes with link mark
 *
 * @param hyperlink - The hyperlink to convert
 * @param styleFormatting - Text formatting from the paragraph's style
 */
function convertHyperlink(hyperlink: Hyperlink, styleFormatting?: TextFormatting): PMNode[] {
  const nodes: PMNode[] = [];

  // Create link mark
  const linkMark = schema.mark('hyperlink', {
    href: hyperlink.href || hyperlink.anchor || '',
    tooltip: hyperlink.tooltip,
    rId: hyperlink.rId,
  });

  for (const child of hyperlink.children) {
    if (child.type === 'run') {
      // Merge style formatting with run's inline formatting
      const mergedFormatting = mergeTextFormatting(styleFormatting, child.formatting);
      const runMarks = textFormattingToMarks(mergedFormatting);
      // Add link mark to run marks
      const allMarks = [...runMarks, linkMark];

      for (const content of child.content) {
        if (content.type === 'text' && content.text) {
          nodes.push(schema.text(content.text, allMarks));
        }
      }
    }
  }

  return nodes;
}

/**
 * Convert TextFormatting to ProseMirror marks
 */
function textFormattingToMarks(
  formatting: TextFormatting | undefined
): ReturnType<typeof schema.mark>[] {
  if (!formatting) return [];

  const marks: ReturnType<typeof schema.mark>[] = [];

  // Bold
  if (formatting.bold) {
    marks.push(schema.mark('bold'));
  }

  // Italic
  if (formatting.italic) {
    marks.push(schema.mark('italic'));
  }

  // Underline
  if (formatting.underline && formatting.underline.style !== 'none') {
    marks.push(
      schema.mark('underline', {
        style: formatting.underline.style,
        color: formatting.underline.color,
      })
    );
  }

  // Strikethrough
  if (formatting.strike || formatting.doubleStrike) {
    marks.push(
      schema.mark('strike', {
        double: formatting.doubleStrike || false,
      })
    );
  }

  // Text color
  if (formatting.color && !formatting.color.auto) {
    marks.push(
      schema.mark('textColor', {
        rgb: formatting.color.rgb,
        themeColor: formatting.color.themeColor,
        themeTint: formatting.color.themeTint,
        themeShade: formatting.color.themeShade,
      })
    );
  }

  // Highlight
  if (formatting.highlight && formatting.highlight !== 'none') {
    marks.push(
      schema.mark('highlight', {
        color: formatting.highlight,
      })
    );
  }

  // Font size
  if (formatting.fontSize) {
    marks.push(
      schema.mark('fontSize', {
        size: formatting.fontSize,
      })
    );
  }

  // Font family
  if (formatting.fontFamily) {
    marks.push(
      schema.mark('fontFamily', {
        ascii: formatting.fontFamily.ascii,
        hAnsi: formatting.fontFamily.hAnsi,
        asciiTheme: formatting.fontFamily.asciiTheme,
      })
    );
  }

  // Superscript/Subscript
  if (formatting.vertAlign === 'superscript') {
    marks.push(schema.mark('superscript'));
  } else if (formatting.vertAlign === 'subscript') {
    marks.push(schema.mark('subscript'));
  }

  // All caps (w:caps)
  if (formatting.allCaps) {
    marks.push(schema.mark('allCaps'));
  }

  // Small caps (w:smallCaps)
  if (formatting.smallCaps) {
    marks.push(schema.mark('smallCaps'));
  }

  // Character spacing (spacing, position, scale, kerning)
  if (
    formatting.spacing != null ||
    formatting.position != null ||
    formatting.scale != null ||
    formatting.kerning != null
  ) {
    marks.push(
      schema.mark('characterSpacing', {
        spacing: formatting.spacing ?? null,
        position: formatting.position ?? null,
        scale: formatting.scale ?? null,
        kerning: formatting.kerning ?? null,
      })
    );
  }

  // Emboss (w:emboss)
  if (formatting.emboss) {
    marks.push(schema.mark('emboss'));
  }

  // Imprint/Engrave (w:imprint)
  if (formatting.imprint) {
    marks.push(schema.mark('imprint'));
  }

  // Text shadow (w:shadow)
  if (formatting.shadow) {
    marks.push(schema.mark('textShadow'));
  }

  // Emphasis mark (w:em)
  if (formatting.emphasisMark && formatting.emphasisMark !== 'none') {
    marks.push(schema.mark('emphasisMark', { type: formatting.emphasisMark }));
  }

  // Text outline (w:outline)
  if (formatting.outline) {
    marks.push(schema.mark('textOutline'));
  }

  return marks;
}

// ============================================================================
// SHAPE CONVERSION
// ============================================================================

/**
 * Convert a Shape to a ProseMirror shape node (inline SVG)
 */
function convertShape(shape: Shape): PMNode {
  const widthPx = shape.size?.width ? emuToPixels(shape.size.width) : 100;
  const heightPx = shape.size?.height ? emuToPixels(shape.size.height) : 80;

  let fillColor: string | undefined;
  let fillType: string = 'solid';
  let gradientType: string | undefined;
  let gradientAngle: number | undefined;
  let gradientStops: string | undefined;
  if (shape.fill) {
    fillType = shape.fill.type;
    if (shape.fill.color?.rgb) {
      fillColor = `#${shape.fill.color.rgb}`;
    }
    // Extract gradient data
    if (shape.fill.type === 'gradient' && shape.fill.gradient) {
      const g = shape.fill.gradient;
      gradientType = g.type;
      gradientAngle = g.angle;
      // Convert stops to serializable format with CSS colors
      gradientStops = JSON.stringify(
        g.stops.map((s) => ({
          position: s.position,
          color: s.color.rgb ? `#${s.color.rgb}` : '#000000',
        }))
      );
    }
  }

  let outlineWidth: number | undefined;
  let outlineColor: string | undefined;
  let outlineStyle: string | undefined;
  if (shape.outline) {
    if (shape.outline.width) {
      outlineWidth = Math.round((shape.outline.width / 914400) * 96 * 100) / 100;
    }
    if (shape.outline.color?.rgb) {
      outlineColor = `#${shape.outline.color.rgb}`;
    }
    outlineStyle = shape.outline.style || 'solid';
  }

  let transform: string | undefined;
  if (shape.transform) {
    const transforms: string[] = [];
    if (shape.transform.rotation) {
      transforms.push(`rotate(${shape.transform.rotation}deg)`);
    }
    if (shape.transform.flipH) {
      transforms.push('scaleX(-1)');
    }
    if (shape.transform.flipV) {
      transforms.push('scaleY(-1)');
    }
    if (transforms.length > 0) {
      transform = transforms.join(' ');
    }
  }

  return schema.node('shape', {
    shapeType: shape.shapeType || 'rect',
    shapeId: shape.id,
    width: widthPx,
    height: heightPx,
    fillColor,
    fillType,
    gradientType,
    gradientAngle,
    gradientStops,
    outlineWidth,
    outlineColor,
    outlineStyle,
    transform,
  });
}

// ============================================================================
// TEXT BOX CONVERSION
// ============================================================================

/**
 * Extract text boxes from paragraph runs.
 * Text boxes appear as ShapeContent where the shape has textBody,
 * or as DrawingContent that contains a text box instead of an image.
 */
function extractTextBoxesFromParagraph(paragraph: Paragraph): TextBox[] {
  const textBoxes: TextBox[] = [];
  for (const content of paragraph.content) {
    if (content.type === 'run') {
      for (const rc of content.content) {
        if (rc.type === 'shape' && 'shape' in rc) {
          const shape = rc.shape as Shape;
          if (shape.textBody && shape.textBody.content.length > 0) {
            // Convert shape with text body to TextBox
            textBoxes.push({
              type: 'textBox',
              id: shape.id,
              size: shape.size,
              position: shape.position,
              wrap: shape.wrap,
              fill: shape.fill,
              outline: shape.outline,
              content: shape.textBody.content,
              margins: shape.textBody.margins,
            });
          }
        }
      }
    }
  }
  return textBoxes;
}

/**
 * Convert a TextBox to a ProseMirror textBox node
 */
function convertTextBox(textBox: TextBox, styleResolver: StyleResolver | null): PMNode {
  const widthPx = textBox.size?.width ? emuToPixels(textBox.size.width) : 200;
  const heightPx = textBox.size?.height ? emuToPixels(textBox.size.height) : undefined;

  // Convert fill color
  let fillColor: string | undefined;
  if (textBox.fill?.color?.rgb) {
    fillColor = `#${textBox.fill.color.rgb}`;
  }

  // Convert outline
  let outlineWidth: number | undefined;
  let outlineColor: string | undefined;
  let outlineStyle: string | undefined;
  if (textBox.outline && textBox.outline.width) {
    outlineWidth = Math.round((textBox.outline.width / 914400) * 96 * 100) / 100;
    if (textBox.outline.color?.rgb) {
      outlineColor = `#${textBox.outline.color.rgb}`;
    }
    outlineStyle = textBox.outline.style || 'solid';
  }

  // Convert margins from EMU to pixels
  const marginTop = textBox.margins?.top != null ? emuToPixels(textBox.margins.top) : 4;
  const marginBottom = textBox.margins?.bottom != null ? emuToPixels(textBox.margins.bottom) : 4;
  const marginLeft = textBox.margins?.left != null ? emuToPixels(textBox.margins.left) : 7;
  const marginRight = textBox.margins?.right != null ? emuToPixels(textBox.margins.right) : 7;

  // Convert text box content (paragraphs) to PM nodes
  const contentNodes: PMNode[] = [];
  for (const para of textBox.content) {
    contentNodes.push(convertParagraph(para, styleResolver));
  }

  // Ensure at least one paragraph
  if (contentNodes.length === 0) {
    contentNodes.push(schema.node('paragraph', {}, []));
  }

  return schema.node(
    'textBox',
    {
      width: widthPx,
      height: heightPx,
      textBoxId: textBox.id,
      fillColor,
      outlineWidth,
      outlineColor,
      outlineStyle,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
    },
    contentNodes
  );
}

/**
 * Convert HeaderFooter content (array of Paragraph/Table blocks) to a ProseMirror document.
 * Used for editing headers/footers in their own ProseMirror editor.
 */
export function headerFooterToProseDoc(
  content: Array<Paragraph | Table>,
  options?: ToProseDocOptions
): PMNode {
  const nodes: PMNode[] = [];
  const styleResolver = options?.styles ? createStyleResolver(options.styles) : null;

  for (const block of content) {
    if (block.type === 'paragraph') {
      const textBoxes = extractTextBoxesFromParagraph(block);
      nodes.push(convertParagraph(block, styleResolver));
      for (const tb of textBoxes) {
        nodes.push(convertTextBox(tb, styleResolver));
      }
    } else if (block.type === 'table') {
      nodes.push(convertTable(block, styleResolver));
    }
  }

  if (nodes.length === 0) {
    nodes.push(schema.node('paragraph', {}, []));
  }

  return schema.node('doc', null, nodes);
}

/**
 * Create an empty ProseMirror document
 */
export function createEmptyDoc(): PMNode {
  return schema.node('doc', null, [schema.node('paragraph', {}, [])]);
}
