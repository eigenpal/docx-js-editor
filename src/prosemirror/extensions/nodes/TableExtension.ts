/**
 * Table Extension — 4 node specs + plugins + commands
 *
 * Uses separate NodeExtension instances for each table node type,
 * plus an Extension for plugins and commands.
 */

import type { NodeSpec, Node as PMNode } from 'prosemirror-model';
import { TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import { Selection, type Command } from 'prosemirror-state';
import {
  columnResizing,
  tableEditing,
  mergeCells as pmMergeCells,
  splitCell as pmSplitCell,
  CellSelection,
} from 'prosemirror-tables';
import { createNodeExtension, createExtension } from '../create';
import type { ExtensionContext, ExtensionRuntime, AnyExtension } from '../types';
import type { TableAttrs, TableRowAttrs, TableCellAttrs } from '../../schema/nodes';

// ============================================================================
// TABLE NODE SPECS
// ============================================================================

const tableSpec: NodeSpec = {
  content: 'tableRow+',
  group: 'block',
  tableRole: 'table',
  isolating: true,
  attrs: {
    styleId: { default: null },
    width: { default: null },
    widthType: { default: null },
    justification: { default: null },
    columnWidths: { default: null },
  },
  parseDOM: [
    {
      tag: 'table',
      getAttrs(dom): TableAttrs {
        const element = dom as HTMLTableElement;
        return {
          styleId: element.dataset.styleId || undefined,
          justification: element.dataset.justification as TableAttrs['justification'] | undefined,
        };
      },
    },
  ],
  toDOM(node) {
    const attrs = node.attrs as TableAttrs;
    const domAttrs: Record<string, string> = { class: 'docx-table' };

    if (attrs.styleId) {
      domAttrs['data-style-id'] = attrs.styleId;
    }

    const styles: string[] = ['border-collapse: collapse', 'table-layout: auto'];

    if (attrs.width && attrs.widthType === 'pct') {
      styles.push(`width: ${attrs.width / 50}%`);
    } else if (attrs.width && attrs.widthType === 'dxa') {
      const widthPx = Math.round((attrs.width / 20) * 1.333);
      styles.push(`width: ${widthPx}px`);
    }

    if (attrs.justification === 'center') {
      styles.push('margin-left: auto', 'margin-right: auto');
    } else if (attrs.justification === 'right') {
      styles.push('margin-left: auto');
    }
    domAttrs.style = styles.join('; ');

    return ['table', domAttrs, ['tbody', 0]];
  },
};

const tableRowSpec: NodeSpec = {
  content: '(tableCell | tableHeader)+',
  tableRole: 'row',
  attrs: {
    height: { default: null },
    heightRule: { default: null },
    isHeader: { default: false },
  },
  parseDOM: [{ tag: 'tr' }],
  toDOM(node) {
    const attrs = node.attrs as TableRowAttrs;
    const domAttrs: Record<string, string> = {};

    if (attrs.height) {
      const heightPx = Math.round((attrs.height / 20) * 1.333);
      domAttrs.style = `height: ${heightPx}px`;
    }

    return ['tr', domAttrs, 0];
  },
};

// OOXML border style → CSS border-style mapping
const BORDER_STYLE_CSS: Record<string, string> = {
  single: 'solid',
  double: 'double',
  dotted: 'dotted',
  dashed: 'dashed',
  thick: 'solid',
  dashSmallGap: 'dashed',
  dotDash: 'dashed',
  dotDotDash: 'dotted',
  triple: 'double',
  thinThickSmallGap: 'double',
  thickThinSmallGap: 'double',
  thinThickThinSmallGap: 'double',
  thinThickMediumGap: 'double',
  thickThinMediumGap: 'double',
  thinThickThinMediumGap: 'double',
  thinThickLargeGap: 'double',
  thickThinLargeGap: 'double',
  thinThickThinLargeGap: 'double',
  wave: 'solid',
  doubleWave: 'double',
  dashDotStroked: 'dashed',
  threeDEmboss: 'ridge',
  threeDEngrave: 'groove',
  outset: 'outset',
  inset: 'inset',
};

// Helper for cell border rendering — works with full BorderSpec objects
function buildCellBorderStyles(attrs: TableCellAttrs): string[] {
  const styles: string[] = [];
  const borders = attrs.borders;

  if (!borders) return styles;

  const borderToCss = (border?: {
    style?: string;
    size?: number;
    color?: { rgb?: string };
  }): string => {
    if (!border || !border.style || border.style === 'none' || border.style === 'nil') {
      return 'none';
    }
    const widthPx = border.size ? Math.max(1, Math.ceil((border.size / 8) * 1.333)) : 1;
    const cssStyle = BORDER_STYLE_CSS[border.style] || 'solid';
    const color = border.color?.rgb ? `#${border.color.rgb}` : '#000000';
    return `${widthPx}px ${cssStyle} ${color}`;
  };

  styles.push(`border-top: ${borderToCss(borders.top)}`);
  styles.push(`border-bottom: ${borderToCss(borders.bottom)}`);
  styles.push(`border-left: ${borderToCss(borders.left)}`);
  styles.push(`border-right: ${borderToCss(borders.right)}`);

  return styles;
}

function buildCellWidthStyles(attrs: TableCellAttrs): string[] {
  const styles: string[] = [];

  if (attrs.colwidth && attrs.colwidth.length > 0) {
    const totalWidth = attrs.colwidth.reduce((sum, w) => sum + w, 0);
    styles.push(`width: ${totalWidth}px`);
  } else if (attrs.width && attrs.widthType === 'pct') {
    styles.push(`width: ${attrs.width}%`);
  } else if (attrs.width) {
    const widthPx = Math.round((attrs.width / 20) * 1.333);
    styles.push(`width: ${widthPx}px`);
  }

  return styles;
}

const tableCellSpec: NodeSpec = {
  content: '(paragraph | table)+',
  tableRole: 'cell',
  isolating: true,
  attrs: {
    colspan: { default: 1 },
    rowspan: { default: 1 },
    colwidth: { default: null },
    width: { default: null },
    widthType: { default: null },
    verticalAlign: { default: null },
    backgroundColor: { default: null },
    borders: { default: null },
    noWrap: { default: false },
  },
  parseDOM: [
    {
      tag: 'td',
      getAttrs(dom): TableCellAttrs {
        const element = dom as HTMLTableCellElement;
        return {
          colspan: element.colSpan || 1,
          rowspan: element.rowSpan || 1,
          verticalAlign: element.dataset.valign as TableCellAttrs['verticalAlign'] | undefined,
          backgroundColor: element.dataset.bgcolor || undefined,
        };
      },
    },
  ],
  toDOM(node) {
    const attrs = node.attrs as TableCellAttrs;
    const domAttrs: Record<string, string> = { class: 'docx-table-cell' };

    if (attrs.colspan > 1) domAttrs.colspan = String(attrs.colspan);
    if (attrs.rowspan > 1) domAttrs.rowspan = String(attrs.rowspan);

    const styles: string[] = ['padding: 4px 8px'];

    if (attrs.noWrap) {
      styles.push('white-space: nowrap');
    } else {
      styles.push('word-wrap: break-word', 'overflow-wrap: break-word', 'overflow: hidden');
    }

    styles.push(...buildCellWidthStyles(attrs));
    styles.push(...buildCellBorderStyles(attrs));

    if (attrs.verticalAlign) {
      domAttrs['data-valign'] = attrs.verticalAlign;
      styles.push(`vertical-align: ${attrs.verticalAlign}`);
    }
    if (attrs.backgroundColor) {
      domAttrs['data-bgcolor'] = attrs.backgroundColor;
      styles.push(`background-color: #${attrs.backgroundColor}`);
    }
    domAttrs.style = styles.join('; ');

    return ['td', domAttrs, 0];
  },
};

const tableHeaderSpec: NodeSpec = {
  content: '(paragraph | table)+',
  tableRole: 'header_cell',
  isolating: true,
  attrs: {
    colspan: { default: 1 },
    rowspan: { default: 1 },
    colwidth: { default: null },
    width: { default: null },
    widthType: { default: null },
    verticalAlign: { default: null },
    backgroundColor: { default: null },
    borders: { default: null },
    noWrap: { default: false },
  },
  parseDOM: [
    {
      tag: 'th',
      getAttrs(dom): TableCellAttrs {
        const element = dom as HTMLTableCellElement;
        return {
          colspan: element.colSpan || 1,
          rowspan: element.rowSpan || 1,
          verticalAlign: element.dataset.valign as TableCellAttrs['verticalAlign'] | undefined,
          backgroundColor: element.dataset.bgcolor || undefined,
        };
      },
    },
  ],
  toDOM(node) {
    const attrs = node.attrs as TableCellAttrs;
    const domAttrs: Record<string, string> = { class: 'docx-table-header' };

    if (attrs.colspan > 1) domAttrs.colspan = String(attrs.colspan);
    if (attrs.rowspan > 1) domAttrs.rowspan = String(attrs.rowspan);

    const styles: string[] = ['padding: 4px 8px', 'font-weight: bold'];

    if (attrs.noWrap) {
      styles.push('white-space: nowrap');
    } else {
      styles.push('word-wrap: break-word', 'overflow-wrap: break-word', 'overflow: hidden');
    }

    styles.push(...buildCellWidthStyles(attrs));
    styles.push(...buildCellBorderStyles(attrs));

    if (attrs.verticalAlign) {
      domAttrs['data-valign'] = attrs.verticalAlign;
      styles.push(`vertical-align: ${attrs.verticalAlign}`);
    }

    if (attrs.backgroundColor) {
      domAttrs['data-bgcolor'] = attrs.backgroundColor;
      styles.push(`background-color: #${attrs.backgroundColor}`);
    }

    domAttrs.style = styles.join('; ');

    return ['th', domAttrs, 0];
  },
};

// ============================================================================
// TABLE CONTEXT HELPERS
// ============================================================================

export interface TableContextInfo {
  isInTable: boolean;
  table?: PMNode;
  tablePos?: number;
  rowIndex?: number;
  columnIndex?: number;
  rowCount?: number;
  columnCount?: number;
  hasMultiCellSelection?: boolean;
  canSplitCell?: boolean;
}

function getTableContext(state: EditorState): TableContextInfo {
  const { selection } = state;
  const { $from } = selection;

  // Detect CellSelection (multi-cell selection from prosemirror-tables)
  const isCellSel = selection instanceof CellSelection;

  let table: PMNode | undefined;
  let tablePos: number | undefined;
  let rowIndex: number | undefined;
  let columnIndex: number | undefined;
  let cellNode: PMNode | undefined;

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);

    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      cellNode = node;
      const rowNode = $from.node(d - 1);
      if (rowNode && rowNode.type.name === 'tableRow') {
        let colIdx = 0;
        let found = false;
        rowNode.forEach((child, _offset, idx) => {
          if (!found) {
            if (idx === $from.index(d - 1)) {
              columnIndex = colIdx;
              found = true;
            } else {
              colIdx += child.attrs.colspan || 1;
            }
          }
        });
      }
    } else if (node.type.name === 'tableRow') {
      const tableNode = $from.node(d - 1);
      if (tableNode && tableNode.type.name === 'table') {
        rowIndex = $from.index(d - 1);
      }
    } else if (node.type.name === 'table') {
      table = node;
      tablePos = $from.before(d);
      break;
    }
  }

  if (!table) {
    return { isInTable: false };
  }

  let rowCount = 0;
  let columnCount = 0;

  table.forEach((row) => {
    if (row.type.name === 'tableRow') {
      rowCount++;
      let cols = 0;
      row.forEach((cell) => {
        cols += cell.attrs.colspan || 1;
      });
      columnCount = Math.max(columnCount, cols);
    }
  });

  const canSplitCell =
    cellNode && ((cellNode.attrs.colspan || 1) > 1 || (cellNode.attrs.rowspan || 1) > 1);

  return {
    isInTable: true,
    table,
    tablePos,
    rowIndex,
    columnIndex,
    rowCount,
    columnCount,
    hasMultiCellSelection: isCellSel,
    canSplitCell: !!canSplitCell,
  };
}

// ============================================================================
// TABLE NAVIGATION
// ============================================================================

function isInTableCell(state: EditorState): boolean {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      return true;
    }
  }
  return false;
}

function findCellInfo(
  state: EditorState
): { cellDepth: number; cellPos: number; rowDepth: number; tableDepth: number } | null {
  const { $from } = state.selection;
  let cellDepth = -1;
  let rowDepth = -1;
  let tableDepth = -1;

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      cellDepth = d;
    } else if (node.type.name === 'tableRow') {
      rowDepth = d;
    } else if (node.type.name === 'table') {
      tableDepth = d;
      break;
    }
  }

  if (cellDepth === -1 || rowDepth === -1 || tableDepth === -1) {
    return null;
  }

  return { cellDepth, cellPos: $from.before(cellDepth), rowDepth, tableDepth };
}

function goToNextCell(): Command {
  return (state, dispatch) => {
    if (!isInTableCell(state)) return false;

    const info = findCellInfo(state);
    if (!info) return false;

    const { $from } = state.selection;
    const table = $from.node(info.tableDepth);
    const row = $from.node(info.rowDepth);
    const cellIndex = $from.index(info.rowDepth);
    const rowIndex = $from.index(info.tableDepth);

    if (cellIndex < row.childCount - 1) {
      const nextCellPos = info.cellPos + $from.node(info.cellDepth).nodeSize;
      if (dispatch) {
        const textPos = nextCellPos + 1 + 1;
        const tr = state.tr.setSelection(Selection.near(state.doc.resolve(textPos)));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    if (rowIndex < table.childCount - 1) {
      const rowPos = $from.before(info.rowDepth);
      const nextRowPos = rowPos + row.nodeSize;
      if (dispatch) {
        const textPos = nextRowPos + 1 + 1 + 1;
        const tr = state.tr.setSelection(Selection.near(state.doc.resolve(textPos)));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    return false;
  };
}

function goToPrevCell(): Command {
  return (state, dispatch) => {
    if (!isInTableCell(state)) return false;

    const info = findCellInfo(state);
    if (!info) return false;

    const { $from } = state.selection;
    const table = $from.node(info.tableDepth);
    const cellIndex = $from.index(info.rowDepth);
    const rowIndex = $from.index(info.tableDepth);

    if (cellIndex > 0) {
      const row = $from.node(info.rowDepth);
      const prevCell = row.child(cellIndex - 1);
      const cellStartPos = info.cellPos - prevCell.nodeSize;
      if (dispatch) {
        const textPos = cellStartPos + prevCell.nodeSize - 2;
        const tr = state.tr.setSelection(Selection.near(state.doc.resolve(textPos), -1));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    if (rowIndex > 0) {
      const prevRow = table.child(rowIndex - 1);
      const rowPos = $from.before(info.rowDepth);
      const prevRowPos = rowPos - prevRow.nodeSize;
      if (dispatch) {
        const cellEndPos = prevRowPos + prevRow.nodeSize - 1;
        const textPos = cellEndPos - 1;
        const tr = state.tr.setSelection(Selection.near(state.doc.resolve(textPos), -1));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    return false;
  };
}

// ============================================================================
// NODE EXTENSIONS (4 separate ones for schema contribution)
// ============================================================================

export const TableNodeExtension = createNodeExtension({
  name: 'table',
  schemaNodeName: 'table',
  nodeSpec: tableSpec,
});

export const TableRowExtension = createNodeExtension({
  name: 'tableRow',
  schemaNodeName: 'tableRow',
  nodeSpec: tableRowSpec,
});

export const TableCellExtension = createNodeExtension({
  name: 'tableCell',
  schemaNodeName: 'tableCell',
  nodeSpec: tableCellSpec,
});

export const TableHeaderExtension = createNodeExtension({
  name: 'tableHeader',
  schemaNodeName: 'tableHeader',
  nodeSpec: tableHeaderSpec,
});

// ============================================================================
// TABLE PLUGIN/COMMANDS EXTENSION
// ============================================================================

export type BorderPreset = 'all' | 'outside' | 'inside' | 'none';

export const TablePluginExtension = createExtension({
  name: 'tablePlugin',
  onSchemaReady(ctx: ExtensionContext): ExtensionRuntime {
    const { schema } = ctx;

    // ---- Commands ----

    function createTable(rows: number, cols: number, borderColor: string = '000000'): PMNode {
      const tableRows: PMNode[] = [];
      const defaultContentWidthTwips = 9360;
      const colWidthTwips = Math.floor(defaultContentWidthTwips / cols);

      const defaultBorder = { style: 'single', size: 4, color: { rgb: borderColor } };
      const defaultBorders = {
        top: defaultBorder,
        bottom: defaultBorder,
        left: defaultBorder,
        right: defaultBorder,
      };

      for (let r = 0; r < rows; r++) {
        const cells: PMNode[] = [];
        for (let c = 0; c < cols; c++) {
          const paragraph = schema.nodes.paragraph.create();
          const cellAttrs: Record<string, unknown> = {
            colspan: 1,
            rowspan: 1,
            borders: defaultBorders,
            width: colWidthTwips,
            widthType: 'dxa',
          };
          cells.push(schema.nodes.tableCell.create(cellAttrs, paragraph));
        }
        tableRows.push(schema.nodes.tableRow.create(null, cells));
      }

      const columnWidths = Array(cols).fill(colWidthTwips);
      return schema.nodes.table.create({ columnWidths }, tableRows);
    }

    function insertTable(rows: number, cols: number): Command {
      return (state, dispatch) => {
        const { $from } = state.selection;

        let borderColor = '000000';
        const marks = state.storedMarks || $from.marks();
        for (const mark of marks) {
          if (mark.type.name === 'textColor' && mark.attrs.rgb) {
            borderColor = mark.attrs.rgb;
            break;
          }
        }

        let insertPos = $from.pos;

        const tableContext = getTableContext(state);
        if (tableContext.isInTable && tableContext.tablePos !== undefined && tableContext.table) {
          insertPos = tableContext.tablePos + tableContext.table.nodeSize;
        } else {
          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d);
            if (node.type.spec.group === 'block' || d === 1) {
              insertPos = $from.after(d);
              break;
            }
          }
        }

        if (dispatch) {
          const table = createTable(rows, cols, borderColor);
          const emptyParagraph = schema.nodes.paragraph.create();
          const tr = state.tr.insert(insertPos, [table, emptyParagraph]);
          const tableStartPos = insertPos + 1;
          const firstCellPos = tableStartPos + 1;
          const firstCellContentPos = firstCellPos + 1;
          tr.setSelection(TextSelection.create(tr.doc, firstCellContentPos));
          dispatch(tr.scrollIntoView());
        }

        return true;
      };
    }

    function addRowAbove(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
      const context = getTableContext(state);
      if (
        !context.isInTable ||
        context.rowIndex === undefined ||
        !context.table ||
        context.tablePos === undefined
      )
        return false;

      if (dispatch) {
        const tr = state.tr;
        const rowNode = context.table.child(context.rowIndex);
        const cells: PMNode[] = [];
        rowNode.forEach((cell) => {
          const paragraph = schema.nodes.paragraph.create();
          cells.push(
            schema.nodes.tableCell.create(
              { colspan: cell.attrs.colspan || 1, rowspan: 1 },
              paragraph
            )
          );
        });
        const newRow = schema.nodes.tableRow.create(null, cells);

        let rowPos = context.tablePos + 1;
        for (let i = 0; i < context.rowIndex; i++) {
          rowPos += context.table.child(i).nodeSize;
        }

        tr.insert(rowPos, newRow);
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    function addRowBelow(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
      const context = getTableContext(state);
      if (
        !context.isInTable ||
        context.rowIndex === undefined ||
        !context.table ||
        context.tablePos === undefined
      )
        return false;

      if (dispatch) {
        const tr = state.tr;
        const rowNode = context.table.child(context.rowIndex);
        const cells: PMNode[] = [];
        rowNode.forEach((cell) => {
          const paragraph = schema.nodes.paragraph.create();
          cells.push(
            schema.nodes.tableCell.create(
              { colspan: cell.attrs.colspan || 1, rowspan: 1 },
              paragraph
            )
          );
        });
        const newRow = schema.nodes.tableRow.create(null, cells);

        let rowPos = context.tablePos + 1;
        for (let i = 0; i <= context.rowIndex; i++) {
          rowPos += context.table.child(i).nodeSize;
        }

        tr.insert(rowPos, newRow);
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    function deleteRow(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
      const context = getTableContext(state);
      if (
        !context.isInTable ||
        context.rowIndex === undefined ||
        !context.table ||
        context.tablePos === undefined ||
        (context.rowCount || 0) <= 1
      )
        return false;

      if (dispatch) {
        const tr = state.tr;
        let rowStart = context.tablePos + 1;
        for (let i = 0; i < context.rowIndex; i++) {
          rowStart += context.table.child(i).nodeSize;
        }
        const rowEnd = rowStart + context.table.child(context.rowIndex).nodeSize;
        tr.delete(rowStart, rowEnd);
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    function addColumnLeft(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
      const context = getTableContext(state);
      if (
        !context.isInTable ||
        context.columnIndex === undefined ||
        !context.table ||
        context.tablePos === undefined
      )
        return false;

      if (dispatch) {
        let tr = state.tr;
        const newColumnCount = (context.columnCount || 1) + 1;
        const newColWidthPercent = Math.floor(100 / newColumnCount);

        let rowPos = context.tablePos + 1;
        let rowIndex = 0;

        context.table.forEach((row) => {
          if (row.type.name === 'tableRow') {
            let cellPos = rowPos + 1;
            let colIdx = 0;

            row.forEach((cell) => {
              if (colIdx === context.columnIndex) {
                const paragraph = schema.nodes.paragraph.create();
                const cellAttrs: any = { colspan: 1, rowspan: 1 };
                if (rowIndex === 0) {
                  cellAttrs.width = newColWidthPercent;
                  cellAttrs.widthType = 'pct';
                }
                const newCell = schema.nodes.tableCell.create(cellAttrs, paragraph);
                tr = tr.insert(cellPos, newCell);
              }
              cellPos += cell.nodeSize;
              colIdx += cell.attrs.colspan || 1;
            });

            if (colIdx <= context.columnIndex!) {
              const paragraph = schema.nodes.paragraph.create();
              const cellAttrs: any = { colspan: 1, rowspan: 1 };
              if (rowIndex === 0) {
                cellAttrs.width = newColWidthPercent;
                cellAttrs.widthType = 'pct';
              }
              const newCell = schema.nodes.tableCell.create(cellAttrs, paragraph);
              tr = tr.insert(cellPos, newCell);
            }

            rowIndex++;
          }
          rowPos += row.nodeSize;
        });

        const updatedTable = tr.doc.nodeAt(context.tablePos);
        if (updatedTable && updatedTable.type.name === 'table') {
          const firstRow = updatedTable.child(0);
          if (firstRow && firstRow.type.name === 'tableRow') {
            let cellPos = context.tablePos + 2;
            firstRow.forEach((cell) => {
              if (cell.type.name === 'tableCell' || cell.type.name === 'tableHeader') {
                tr = tr.setNodeMarkup(cellPos, undefined, {
                  ...cell.attrs,
                  width: newColWidthPercent,
                  widthType: 'pct',
                });
              }
              cellPos += cell.nodeSize;
            });
          }
        }

        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    function addColumnRight(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
      const context = getTableContext(state);
      if (
        !context.isInTable ||
        context.columnIndex === undefined ||
        !context.table ||
        context.tablePos === undefined
      )
        return false;

      if (dispatch) {
        let tr = state.tr;
        const newColumnCount = (context.columnCount || 1) + 1;
        const newColWidthPercent = Math.floor(100 / newColumnCount);

        let rowPos = context.tablePos + 1;
        let rowIndex = 0;

        context.table.forEach((row) => {
          if (row.type.name === 'tableRow') {
            let cellPos = rowPos + 1;
            let colIdx = 0;
            let inserted = false;

            row.forEach((cell) => {
              cellPos += cell.nodeSize;
              colIdx += cell.attrs.colspan || 1;

              if (!inserted && colIdx > context.columnIndex!) {
                const paragraph = schema.nodes.paragraph.create();
                const cellAttrs: any = { colspan: 1, rowspan: 1 };
                if (rowIndex === 0) {
                  cellAttrs.width = newColWidthPercent;
                  cellAttrs.widthType = 'pct';
                }
                const newCell = schema.nodes.tableCell.create(cellAttrs, paragraph);
                tr = tr.insert(cellPos, newCell);
                inserted = true;
              }
            });

            if (!inserted) {
              const paragraph = schema.nodes.paragraph.create();
              const cellAttrs: any = { colspan: 1, rowspan: 1 };
              if (rowIndex === 0) {
                cellAttrs.width = newColWidthPercent;
                cellAttrs.widthType = 'pct';
              }
              const newCell = schema.nodes.tableCell.create(cellAttrs, paragraph);
              tr = tr.insert(cellPos, newCell);
            }

            rowIndex++;
          }
          rowPos += row.nodeSize;
        });

        const updatedTable = tr.doc.nodeAt(context.tablePos);
        if (updatedTable && updatedTable.type.name === 'table') {
          const firstRow = updatedTable.child(0);
          if (firstRow && firstRow.type.name === 'tableRow') {
            let cellPos = context.tablePos + 2;
            firstRow.forEach((cell) => {
              if (cell.type.name === 'tableCell' || cell.type.name === 'tableHeader') {
                tr = tr.setNodeMarkup(cellPos, undefined, {
                  ...cell.attrs,
                  width: newColWidthPercent,
                  widthType: 'pct',
                });
              }
              cellPos += cell.nodeSize;
            });
          }
        }

        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    function deleteColumn(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
      const context = getTableContext(state);
      if (
        !context.isInTable ||
        context.columnIndex === undefined ||
        !context.table ||
        context.tablePos === undefined ||
        (context.columnCount || 0) <= 1
      )
        return false;

      if (dispatch) {
        let tr = state.tr;
        const newColumnCount = (context.columnCount || 2) - 1;
        const newColWidthPercent = Math.floor(100 / newColumnCount);

        const deleteOps: { start: number; end: number }[] = [];
        let rowPos = context.tablePos + 1;

        context.table.forEach((row) => {
          if (row.type.name === 'tableRow') {
            let cellPos = rowPos + 1;
            let colIdx = 0;

            row.forEach((cell) => {
              const cellStart = cellPos;
              const cellEnd = cellPos + cell.nodeSize;
              const cellColspan = cell.attrs.colspan || 1;

              if (colIdx <= context.columnIndex! && context.columnIndex! < colIdx + cellColspan) {
                deleteOps.push({ start: cellStart, end: cellEnd });
              }

              cellPos = cellEnd;
              colIdx += cellColspan;
            });
          }
          rowPos += row.nodeSize;
        });

        deleteOps.reverse().forEach(({ start, end }) => {
          tr = tr.delete(start, end);
        });

        const updatedTable = tr.doc.nodeAt(context.tablePos);
        if (updatedTable && updatedTable.type.name === 'table') {
          const firstRow = updatedTable.child(0);
          if (firstRow && firstRow.type.name === 'tableRow') {
            let cellPos = context.tablePos + 2;
            firstRow.forEach((cell) => {
              if (cell.type.name === 'tableCell' || cell.type.name === 'tableHeader') {
                tr = tr.setNodeMarkup(cellPos, undefined, {
                  ...cell.attrs,
                  width: newColWidthPercent,
                  widthType: 'pct',
                });
              }
              cellPos += cell.nodeSize;
            });
          }
        }

        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    function deleteTable(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
      const context = getTableContext(state);
      if (!context.isInTable || context.tablePos === undefined || !context.table) return false;

      if (dispatch) {
        const tr = state.tr;
        tr.delete(context.tablePos, context.tablePos + context.table.nodeSize);
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    function setTableBorders(preset: BorderPreset): Command {
      return (state, dispatch) => {
        const context = getTableContext(state);
        if (!context.isInTable || context.tablePos === undefined || !context.table) return false;

        if (dispatch) {
          const tr = state.tr;
          const { $from } = state.selection;

          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d);
            if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
              const pos = $from.before(d);

              const solidBorder = { style: 'single', size: 4, color: { rgb: '000000' } };
              const noBorder = { style: 'none' as const };
              let borders;

              switch (preset) {
                case 'all':
                case 'outside':
                  borders = {
                    top: solidBorder,
                    bottom: solidBorder,
                    left: solidBorder,
                    right: solidBorder,
                  };
                  break;
                case 'inside':
                case 'none':
                  borders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
                  break;
              }

              const newAttrs = { ...node.attrs, borders };
              tr.setNodeMarkup(pos, undefined, newAttrs);
              dispatch(tr.scrollIntoView());
              return true;
            }
          }
        }

        return true;
      };
    }

    function setCellFillColor(color: string | null): Command {
      return (state, dispatch) => {
        const context = getTableContext(state);
        if (!context.isInTable || context.tablePos === undefined || !context.table) return false;

        if (dispatch) {
          const tr = state.tr;
          const { $from } = state.selection;

          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d);
            if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
              const pos = $from.before(d);
              const bgColor = color ? color.replace(/^#/, '') : null;
              const newAttrs = { ...node.attrs, backgroundColor: bgColor };
              tr.setNodeMarkup(pos, undefined, newAttrs);
              dispatch(tr.scrollIntoView());
              return true;
            }
          }
        }

        return true;
      };
    }

    function setTableBorderColor(color: string): Command {
      return (state, dispatch) => {
        const context = getTableContext(state);
        if (!context.isInTable || context.tablePos === undefined || !context.table) return false;

        if (dispatch) {
          const tr = state.tr;
          const { $from } = state.selection;

          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d);
            if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
              const pos = $from.before(d);
              const rgb = color.replace(/^#/, '');
              const currentBorders = node.attrs.borders || {};
              const defaultBorder = { style: 'single', size: 4 };
              const newBorders = {
                top: { ...defaultBorder, ...currentBorders.top, color: { rgb } },
                bottom: { ...defaultBorder, ...currentBorders.bottom, color: { rgb } },
                left: { ...defaultBorder, ...currentBorders.left, color: { rgb } },
                right: { ...defaultBorder, ...currentBorders.right, color: { rgb } },
              };
              const newAttrs = { ...node.attrs, borders: newBorders };
              tr.setNodeMarkup(pos, undefined, newAttrs);
              dispatch(tr.scrollIntoView());
              return true;
            }
          }
        }

        return true;
      };
    }

    return {
      plugins: [
        columnResizing({
          handleWidth: 5,
          cellMinWidth: 25,
          lastColumnResizable: true,
        }),
        tableEditing(),
      ],
      commands: {
        insertTable: (rows: number, cols: number) => insertTable(rows, cols),
        addRowAbove: () => addRowAbove,
        addRowBelow: () => addRowBelow,
        deleteRow: () => deleteRow,
        addColumnLeft: () => addColumnLeft,
        addColumnRight: () => addColumnRight,
        deleteColumn: () => deleteColumn,
        deleteTable: () => deleteTable,
        mergeCells: () => pmMergeCells,
        splitCell: () => pmSplitCell,
        setTableBorders: (preset: BorderPreset) => setTableBorders(preset),
        setCellFillColor: (color: string | null) => setCellFillColor(color),
        setTableBorderColor: (color: string) => setTableBorderColor(color),
        removeTableBorders: () => setTableBorders('none'),
        setAllTableBorders: () => setTableBorders('all'),
        setOutsideTableBorders: () => setTableBorders('outside'),
        setInsideTableBorders: () => setTableBorders('inside'),
      },
    };
  },
});

// ============================================================================
// CONVENIENCE: all table extensions grouped
// ============================================================================

export function createTableExtensions(): AnyExtension[] {
  return [
    TableNodeExtension(),
    TableRowExtension(),
    TableCellExtension(),
    TableHeaderExtension(),
    TablePluginExtension(),
  ];
}

// Re-export for backward compat
export { getTableContext, isInTableCell as isInTable, goToNextCell, goToPrevCell };
