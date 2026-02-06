/**
 * Color & Styling Primitives
 *
 * Basic types used throughout OOXML for colors, borders, and shading.
 */

/**
 * Theme color slots from theme1.xml
 */
export type ThemeColorSlot =
  | 'dk1'
  | 'lt1'
  | 'dk2'
  | 'lt2'
  | 'accent1'
  | 'accent2'
  | 'accent3'
  | 'accent4'
  | 'accent5'
  | 'accent6'
  | 'hlink'
  | 'folHlink'
  | 'background1'
  | 'text1'
  | 'background2'
  | 'text2';

/**
 * Color value - can be direct RGB, theme reference, or auto
 */
export interface ColorValue {
  /** RGB hex value without # (e.g., "FF0000") */
  rgb?: string;
  /** Theme color slot reference */
  themeColor?: ThemeColorSlot;
  /** Tint modifier (0-255 as hex string, e.g., "80") - makes color lighter */
  themeTint?: string;
  /** Shade modifier (0-255 as hex string) - makes color darker */
  themeShade?: string;
  /** Auto color - context-dependent (usually black for text) */
  auto?: boolean;
}

/**
 * Border specification for any border (paragraph, table, page)
 */
export interface BorderSpec {
  /** Border style */
  style:
    | 'none'
    | 'single'
    | 'double'
    | 'dotted'
    | 'dashed'
    | 'thick'
    | 'triple'
    | 'thinThickSmallGap'
    | 'thickThinSmallGap'
    | 'thinThickMediumGap'
    | 'thickThinMediumGap'
    | 'thinThickLargeGap'
    | 'thickThinLargeGap'
    | 'wave'
    | 'doubleWave'
    | 'dashSmallGap'
    | 'dashDotStroked'
    | 'threeDEmboss'
    | 'threeDEngrave'
    | 'outset'
    | 'inset'
    | 'nil';
  /** Color of the border */
  color?: ColorValue;
  /** Width in eighths of a point (1/8 pt) */
  size?: number;
  /** Spacing from text in points */
  space?: number;
  /** Shadow effect */
  shadow?: boolean;
  /** Frame effect */
  frame?: boolean;
}

/**
 * Shading/background properties
 */
export interface ShadingProperties {
  /** Pattern fill color */
  color?: ColorValue;
  /** Background fill color */
  fill?: ColorValue;
  /** Shading pattern type */
  pattern?:
    | 'clear'
    | 'solid'
    | 'horzStripe'
    | 'vertStripe'
    | 'reverseDiagStripe'
    | 'diagStripe'
    | 'horzCross'
    | 'diagCross'
    | 'thinHorzStripe'
    | 'thinVertStripe'
    | 'thinReverseDiagStripe'
    | 'thinDiagStripe'
    | 'thinHorzCross'
    | 'thinDiagCross'
    | 'pct5'
    | 'pct10'
    | 'pct12'
    | 'pct15'
    | 'pct20'
    | 'pct25'
    | 'pct30'
    | 'pct35'
    | 'pct37'
    | 'pct40'
    | 'pct45'
    | 'pct50'
    | 'pct55'
    | 'pct60'
    | 'pct62'
    | 'pct65'
    | 'pct70'
    | 'pct75'
    | 'pct80'
    | 'pct85'
    | 'pct87'
    | 'pct90'
    | 'pct95'
    | 'nil';
}
