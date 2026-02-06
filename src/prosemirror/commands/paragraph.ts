/**
 * Paragraph Formatting Commands — thin re-exports from extension system
 *
 * Alignment, line spacing, indentation, lists, paragraph styles.
 * All implementations live in extensions/; this file re-exports
 * for backward compatibility.
 */

import type { Command } from 'prosemirror-state';
import type { ParagraphAlignment, LineSpacingRule } from '../../types/document';
import { singletonManager } from '../schema';

// Re-export types and query helpers from extensions
export type { ResolvedStyleAttrs } from '../extensions/core/ParagraphExtension';
export { getParagraphAlignment, getStyleId } from '../extensions/core/ParagraphExtension';
export { isInList, getListInfo } from '../extensions/features/ListExtension';

// ============================================================================
// COMMANDS — delegated to singleton extension manager
// ============================================================================

const cmds = singletonManager.getCommands();

// Alignment
export function setAlignment(alignment: ParagraphAlignment): Command {
  return cmds.setAlignment(alignment);
}
export const alignLeft: Command = cmds.alignLeft();
export const alignCenter: Command = cmds.alignCenter();
export const alignRight: Command = cmds.alignRight();
export const alignJustify: Command = cmds.alignJustify();

// Line spacing
export function setLineSpacing(value: number, rule: LineSpacingRule = 'auto'): Command {
  return cmds.setLineSpacing(value, rule);
}
export const singleSpacing: Command = cmds.singleSpacing();
export const oneAndHalfSpacing: Command = cmds.oneAndHalfSpacing();
export const doubleSpacing: Command = cmds.doubleSpacing();

// Indentation
export function increaseIndent(amount: number = 720): Command {
  return cmds.increaseIndent(amount);
}
export function decreaseIndent(amount: number = 720): Command {
  return cmds.decreaseIndent(amount);
}

// Lists
export const toggleBulletList: Command = cmds.toggleBulletList();
export const toggleNumberedList: Command = cmds.toggleNumberedList();
export const increaseListLevel: Command = cmds.increaseListLevel();
export const decreaseListLevel: Command = cmds.decreaseListLevel();
export const removeList: Command = cmds.removeList();

// Spacing
export function setSpaceBefore(twips: number): Command {
  return cmds.setSpaceBefore(twips);
}
export function setSpaceAfter(twips: number): Command {
  return cmds.setSpaceAfter(twips);
}

// Paragraph styles
import type { ResolvedStyleAttrs } from '../extensions/core/ParagraphExtension';
export function applyStyle(styleId: string, resolvedAttrs?: ResolvedStyleAttrs): Command {
  return cmds.applyStyle(styleId, resolvedAttrs);
}
export const clearStyle: Command = cmds.clearStyle();
