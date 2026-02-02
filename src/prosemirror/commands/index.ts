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
