/**
 * ProseMirror Mark Type Interfaces
 *
 * Type definitions for mark attributes used by conversion modules,
 * extensions, and other consumers. MarkSpec definitions have moved
 * to the extension system (extensions/marks/).
 */

import type { UnderlineStyle, ThemeColorSlot } from '../../types/document';

/**
 * Text color mark attributes
 */
export interface TextColorAttrs {
  rgb?: string;
  themeColor?: ThemeColorSlot;
  themeTint?: string;
  themeShade?: string;
}

/**
 * Underline mark attributes
 */
export interface UnderlineAttrs {
  style?: UnderlineStyle;
  color?: TextColorAttrs;
}

/**
 * Font size mark attributes
 */
export interface FontSizeAttrs {
  size: number; // in half-points (OOXML format)
}

/**
 * Font family mark attributes
 */
export interface FontFamilyAttrs {
  ascii?: string;
  hAnsi?: string;
  asciiTheme?: string;
}

/**
 * Hyperlink mark attributes
 */
export interface HyperlinkAttrs {
  href: string;
  tooltip?: string;
  rId?: string;
}
