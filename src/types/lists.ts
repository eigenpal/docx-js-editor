/**
 * Lists & Numbering Types
 *
 * Types for bullet lists, numbered lists, and numbering definitions.
 */

import type { TextFormatting, ParagraphFormatting } from './formatting';

// ============================================================================
// LISTS & NUMBERING
// ============================================================================

/**
 * Number format type
 */
export type NumberFormat =
  | 'decimal'
  | 'upperRoman'
  | 'lowerRoman'
  | 'upperLetter'
  | 'lowerLetter'
  | 'ordinal'
  | 'cardinalText'
  | 'ordinalText'
  | 'hex'
  | 'chicago'
  | 'ideographDigital'
  | 'japaneseCounting'
  | 'aiueo'
  | 'iroha'
  | 'decimalFullWidth'
  | 'decimalHalfWidth'
  | 'japaneseLegal'
  | 'japaneseDigitalTenThousand'
  | 'decimalEnclosedCircle'
  | 'decimalFullWidth2'
  | 'aiueoFullWidth'
  | 'irohaFullWidth'
  | 'decimalZero'
  | 'bullet'
  | 'ganada'
  | 'chosung'
  | 'decimalEnclosedFullstop'
  | 'decimalEnclosedParen'
  | 'decimalEnclosedCircleChinese'
  | 'ideographEnclosedCircle'
  | 'ideographTraditional'
  | 'ideographZodiac'
  | 'ideographZodiacTraditional'
  | 'taiwaneseCounting'
  | 'ideographLegalTraditional'
  | 'taiwaneseCountingThousand'
  | 'taiwaneseDigital'
  | 'chineseCounting'
  | 'chineseLegalSimplified'
  | 'chineseCountingThousand'
  | 'koreanDigital'
  | 'koreanCounting'
  | 'koreanLegal'
  | 'koreanDigital2'
  | 'vietnameseCounting'
  | 'russianLower'
  | 'russianUpper'
  | 'none'
  | 'numberInDash'
  | 'hebrew1'
  | 'hebrew2'
  | 'arabicAlpha'
  | 'arabicAbjad'
  | 'hindiVowels'
  | 'hindiConsonants'
  | 'hindiNumbers'
  | 'hindiCounting'
  | 'thaiLetters'
  | 'thaiNumbers'
  | 'thaiCounting';

/**
 * Multi-level suffix (what follows the number)
 */
export type LevelSuffix = 'tab' | 'space' | 'nothing';

/**
 * List level definition
 */
export interface ListLevel {
  /** Level index (0-8) */
  ilvl: number;
  /** Starting number */
  start?: number;
  /** Number format */
  numFmt: NumberFormat;
  /** Level text (e.g., "%1." or "•") */
  lvlText: string;
  /** Justification */
  lvlJc?: 'left' | 'center' | 'right';
  /** Suffix after number */
  suffix?: LevelSuffix;
  /** Paragraph properties for this level */
  pPr?: ParagraphFormatting;
  /** Run properties for the number/bullet */
  rPr?: TextFormatting;
  /** Restart numbering from higher level */
  lvlRestart?: number;
  /** Is legal numbering style */
  isLgl?: boolean;
  /** Legacy settings */
  legacy?: {
    legacy?: boolean;
    legacySpace?: number;
    legacyIndent?: number;
  };
}

/**
 * Abstract numbering definition (w:abstractNum)
 */
export interface AbstractNumbering {
  /** Abstract numbering ID */
  abstractNumId: number;
  /** Multi-level type */
  multiLevelType?: 'hybridMultilevel' | 'multilevel' | 'singleLevel';
  /** Numbering style link */
  numStyleLink?: string;
  /** Style link */
  styleLink?: string;
  /** Level definitions */
  levels: ListLevel[];
  /** Name */
  name?: string;
}

/**
 * Numbering instance (w:num)
 */
export interface NumberingInstance {
  /** Numbering ID (referenced by paragraphs) */
  numId: number;
  /** Reference to abstract numbering */
  abstractNumId: number;
  /** Level overrides */
  levelOverrides?: Array<{
    ilvl: number;
    startOverride?: number;
    lvl?: ListLevel;
  }>;
}

/**
 * Computed list rendering info
 */
export interface ListRendering {
  /** Computed marker text (e.g., "1.", "a)", "•") */
  marker: string;
  /** List level (0-8) */
  level: number;
  /** Numbering ID */
  numId: number;
  /** Whether this is a bullet or numbered list */
  isBullet: boolean;
  /** Number format type (decimal, lowerRoman, upperRoman, etc.) */
  numFmt?: NumberFormat;
}

/**
 * Complete numbering definitions
 */
export interface NumberingDefinitions {
  /** Abstract numbering definitions */
  abstractNums: AbstractNumbering[];
  /** Numbering instances */
  nums: NumberingInstance[];
}
