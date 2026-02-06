/**
 * Text Formatting Commands — thin re-exports from extension system
 *
 * Toggle marks, set marks, clear formatting, hyperlinks.
 * All implementations live in extensions/marks/; this file re-exports
 * for backward compatibility.
 */

import type { Command } from 'prosemirror-state';
import { singletonManager, schema } from '../schema';
import type { TextColorAttrs } from '../schema';

// Utility re-exports from markUtils (used by toolbar, conversion, etc.)
export {
  isMarkActive,
  getMarkAttr,
  clearFormatting,
  createSetMarkCommand,
  createRemoveMarkCommand,
} from '../extensions/marks/markUtils';

// Hyperlink query helpers (used by toolbar)
export {
  isHyperlinkActive,
  getHyperlinkAttrs,
  getSelectedText,
} from '../extensions/marks/HyperlinkExtension';

// ============================================================================
// PARAGRAPH DEFAULT FORMATTING HELPERS
// ============================================================================

/**
 * textFormattingToMarks — wraps markUtils version to use singleton schema
 */
import { textFormattingToMarks as _textFormattingToMarks } from '../extensions/marks/markUtils';
import type { TextFormatting } from '../../types/document';
import type { Mark } from 'prosemirror-model';

export function textFormattingToMarks(formatting: TextFormatting): Mark[] {
  return _textFormattingToMarks(formatting, schema);
}

// ============================================================================
// COMMANDS — delegated to singleton extension manager
// ============================================================================

const cmds = singletonManager.getCommands();

// Toggle marks (simple on/off)
export const toggleBold: Command = cmds.toggleBold();
export const toggleItalic: Command = cmds.toggleItalic();
export const toggleUnderline: Command = cmds.toggleUnderline();
export const toggleStrike: Command = cmds.toggleStrike();
export const toggleSuperscript: Command = cmds.toggleSuperscript();
export const toggleSubscript: Command = cmds.toggleSubscript();

// Set marks (with attributes)
export function setTextColor(attrs: TextColorAttrs): Command {
  return cmds.setTextColor(attrs);
}
export const clearTextColor: Command = cmds.clearTextColor();

export function setHighlight(color: string): Command {
  return cmds.setHighlight(color);
}
export const clearHighlight: Command = cmds.clearHighlight();

export function setFontSize(size: number): Command {
  return cmds.setFontSize(size);
}
export const clearFontSize: Command = cmds.clearFontSize();

export function setFontFamily(fontName: string): Command {
  return cmds.setFontFamily(fontName);
}
export const clearFontFamily: Command = cmds.clearFontFamily();

export function setUnderlineStyle(style: string, color?: TextColorAttrs): Command {
  return cmds.setUnderlineStyle(style, color);
}

// Hyperlink commands
export function setHyperlink(href: string, tooltip?: string): Command {
  return cmds.setHyperlink(href, tooltip);
}
export const removeHyperlink: Command = cmds.removeHyperlink();

export function insertHyperlink(text: string, href: string, tooltip?: string): Command {
  return cmds.insertHyperlink(text, href, tooltip);
}
