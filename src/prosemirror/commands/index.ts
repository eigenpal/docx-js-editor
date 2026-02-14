/**
 * ProseMirror Commands
 *
 * Commands for formatting text and paragraphs.
 */

// Text formatting
export {
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrike,
  toggleSuperscript,
  toggleSubscript,
  setTextColor,
  clearTextColor,
  setHighlight,
  clearHighlight,
  setFontSize,
  clearFontSize,
  setFontFamily,
  clearFontFamily,
  setUnderlineStyle,
  clearFormatting,
  isMarkActive,
  getMarkAttr,
  createSetMarkCommand,
  createRemoveMarkCommand,
  // Hyperlink commands
  isHyperlinkActive,
  getHyperlinkAttrs,
  getSelectedText,
  setHyperlink,
  removeHyperlink,
  insertHyperlink,
} from './formatting';

// Paragraph formatting
export {
  setAlignment,
  alignLeft,
  alignCenter,
  alignRight,
  alignJustify,
  setLineSpacing,
  singleSpacing,
  oneAndHalfSpacing,
  doubleSpacing,
  increaseIndent,
  decreaseIndent,
  toggleBulletList,
  toggleNumberedList,
  increaseListLevel,
  decreaseListLevel,
  removeList,
  setSpaceBefore,
  setSpaceAfter,
  getParagraphAlignment,
  isInList,
  getListInfo,
  applyStyle,
  clearStyle,
  getStyleId,
} from './paragraph';
export type { ResolvedStyleAttrs } from './paragraph';

// Table operations
export {
  isInTable,
  getTableContext,
  insertTable,
  addRowAbove,
  addRowBelow,
  deleteRow,
  addColumnLeft,
  addColumnRight,
  deleteColumn,
  deleteTable,
  selectTable,
  selectRow,
  selectColumn,
  mergeCells,
  splitCell,
  setTableBorders,
  removeTableBorders,
  setAllTableBorders,
  setOutsideTableBorders,
  setInsideTableBorders,
  setCellBorder,
  setCellVerticalAlign,
  setCellMargins,
  setCellTextDirection,
  toggleNoWrap,
  setRowHeight,
  toggleHeaderRow,
  distributeColumns,
  autoFitContents,
  setTableProperties,
  applyTableStyle,
  setCellFillColor,
  setTableBorderColor,
  setTableBorderWidth,
} from './table';
export type { TableContextInfo, BorderPreset } from './table';
