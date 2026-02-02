/**
 * Numbering/List Parser for DOCX
 *
 * Parses numbering.xml to extract:
 * - Abstract numbering definitions (templates with levels)
 * - Numbering instances (concrete references with optional overrides)
 *
 * OOXML Structure:
 * - w:abstractNum - Template definitions with 9 levels (0-8)
 * - w:num - Instances that reference abstractNum and can override levels
 * - w:lvl - Level definition with start, format, text pattern, etc.
 */

import type {
  NumberingDefinitions,
  AbstractNumbering,
  NumberingInstance,
  ListLevel,
  NumberFormat,
  LevelSuffix,
  ParagraphFormatting,
  TextFormatting,
} from '../types/document';

import {
  parseXmlDocument,
  findChild,
  findChildren,
  getAttribute,
  parseBooleanElement,
  parseNumericAttribute,
  type XmlElement,
} from './xmlParser';

/**
 * Map of rId to numbering definitions
 */
export type NumberingMap = {
  definitions: NumberingDefinitions;
  /** Get level info for a numId and ilvl */
  getLevel: (numId: number, ilvl: number) => ListLevel | null;
  /** Get abstract numbering by ID */
  getAbstract: (abstractNumId: number) => AbstractNumbering | null;
  /** Check if numId exists */
  hasNumbering: (numId: number) => boolean;
};

/**
 * Parse numbering.xml into NumberingDefinitions
 *
 * @param numberingXml - Raw XML string from word/numbering.xml (or null if not present)
 * @returns NumberingMap with definitions and helper functions
 */
export function parseNumbering(numberingXml: string | null): NumberingMap {
  const definitions: NumberingDefinitions = {
    abstractNums: [],
    nums: [],
  };

  if (!numberingXml) {
    return createNumberingMap(definitions);
  }

  const root = parseXmlDocument(numberingXml);
  if (!root) {
    return createNumberingMap(definitions);
  }

  // Parse abstract numbering definitions
  const abstractNumElements = findChildren(root, 'w', 'abstractNum');
  for (const abstractNum of abstractNumElements) {
    const parsed = parseAbstractNumbering(abstractNum);
    if (parsed) {
      definitions.abstractNums.push(parsed);
    }
  }

  // Parse numbering instances
  const numElements = findChildren(root, 'w', 'num');
  for (const num of numElements) {
    const parsed = parseNumberingInstance(num);
    if (parsed) {
      definitions.nums.push(parsed);
    }
  }

  return createNumberingMap(definitions);
}

/**
 * Parse a single w:abstractNum element
 */
function parseAbstractNumbering(element: XmlElement): AbstractNumbering | null {
  const abstractNumIdStr = getAttribute(element, 'w', 'abstractNumId');
  if (abstractNumIdStr === null) return null;

  const abstractNumId = parseInt(abstractNumIdStr, 10);
  if (isNaN(abstractNumId)) return null;

  const abstractNum: AbstractNumbering = {
    abstractNumId,
    levels: [],
  };

  // Parse optional attributes/children
  const multiLevelTypeEl = findChild(element, 'w', 'multiLevelType');
  if (multiLevelTypeEl) {
    const mlType = getAttribute(multiLevelTypeEl, 'w', 'val');
    if (mlType === 'hybridMultilevel' || mlType === 'multilevel' || mlType === 'singleLevel') {
      abstractNum.multiLevelType = mlType;
    }
  }

  // Parse name
  const nameEl = findChild(element, 'w', 'name');
  if (nameEl) {
    abstractNum.name = getAttribute(nameEl, 'w', 'val') ?? undefined;
  }

  // Parse style links
  const numStyleLinkEl = findChild(element, 'w', 'numStyleLink');
  if (numStyleLinkEl) {
    abstractNum.numStyleLink = getAttribute(numStyleLinkEl, 'w', 'val') ?? undefined;
  }

  const styleLinkEl = findChild(element, 'w', 'styleLink');
  if (styleLinkEl) {
    abstractNum.styleLink = getAttribute(styleLinkEl, 'w', 'val') ?? undefined;
  }

  // Parse levels (w:lvl)
  const levelElements = findChildren(element, 'w', 'lvl');
  for (const lvlEl of levelElements) {
    const level = parseListLevel(lvlEl);
    if (level) {
      abstractNum.levels.push(level);
    }
  }

  // Sort levels by ilvl
  abstractNum.levels.sort((a, b) => a.ilvl - b.ilvl);

  return abstractNum;
}

/**
 * Parse a single w:num element (numbering instance)
 */
function parseNumberingInstance(element: XmlElement): NumberingInstance | null {
  const numIdStr = getAttribute(element, 'w', 'numId');
  if (numIdStr === null) return null;

  const numId = parseInt(numIdStr, 10);
  if (isNaN(numId)) return null;

  // Get abstract numbering reference
  const abstractNumIdEl = findChild(element, 'w', 'abstractNumId');
  if (!abstractNumIdEl) return null;

  const abstractNumIdStr = getAttribute(abstractNumIdEl, 'w', 'val');
  if (abstractNumIdStr === null) return null;

  const abstractNumId = parseInt(abstractNumIdStr, 10);
  if (isNaN(abstractNumId)) return null;

  const instance: NumberingInstance = {
    numId,
    abstractNumId,
  };

  // Parse level overrides (w:lvlOverride)
  const overrideElements = findChildren(element, 'w', 'lvlOverride');
  if (overrideElements.length > 0) {
    instance.levelOverrides = [];

    for (const overrideEl of overrideElements) {
      const ilvlStr = getAttribute(overrideEl, 'w', 'ilvl');
      if (ilvlStr === null) continue;

      const ilvl = parseInt(ilvlStr, 10);
      if (isNaN(ilvl)) continue;

      const override: {
        ilvl: number;
        startOverride?: number;
        lvl?: ListLevel;
      } = { ilvl };

      // Check for start override
      const startOverrideEl = findChild(overrideEl, 'w', 'startOverride');
      if (startOverrideEl) {
        const startVal = getAttribute(startOverrideEl, 'w', 'val');
        if (startVal !== null) {
          const startNum = parseInt(startVal, 10);
          if (!isNaN(startNum)) {
            override.startOverride = startNum;
          }
        }
      }

      // Check for full level redefinition
      const lvlEl = findChild(overrideEl, 'w', 'lvl');
      if (lvlEl) {
        override.lvl = parseListLevel(lvlEl) ?? undefined;
      }

      instance.levelOverrides.push(override);
    }
  }

  return instance;
}

/**
 * Parse a single w:lvl element (list level definition)
 */
function parseListLevel(element: XmlElement): ListLevel | null {
  const ilvlStr = getAttribute(element, 'w', 'ilvl');
  if (ilvlStr === null) return null;

  const ilvl = parseInt(ilvlStr, 10);
  if (isNaN(ilvl) || ilvl < 0 || ilvl > 8) return null;

  const level: ListLevel = {
    ilvl,
    numFmt: 'decimal', // Default
    lvlText: '',
  };

  // Parse start value
  const startEl = findChild(element, 'w', 'start');
  if (startEl) {
    const startVal = getAttribute(startEl, 'w', 'val');
    if (startVal !== null) {
      const startNum = parseInt(startVal, 10);
      if (!isNaN(startNum)) {
        level.start = startNum;
      }
    }
  }

  // Parse number format
  const numFmtEl = findChild(element, 'w', 'numFmt');
  if (numFmtEl) {
    const fmtVal = getAttribute(numFmtEl, 'w', 'val');
    if (fmtVal) {
      level.numFmt = parseNumberFormat(fmtVal);
    }
  }

  // Parse level text (the pattern like "%1." or "•")
  const lvlTextEl = findChild(element, 'w', 'lvlText');
  if (lvlTextEl) {
    level.lvlText = getAttribute(lvlTextEl, 'w', 'val') ?? '';
  }

  // Parse justification
  const lvlJcEl = findChild(element, 'w', 'lvlJc');
  if (lvlJcEl) {
    const jcVal = getAttribute(lvlJcEl, 'w', 'val');
    if (jcVal === 'left' || jcVal === 'center' || jcVal === 'right') {
      level.lvlJc = jcVal;
    }
  }

  // Parse suffix
  const suffEl = findChild(element, 'w', 'suff');
  if (suffEl) {
    const suffVal = getAttribute(suffEl, 'w', 'val');
    if (suffVal === 'tab' || suffVal === 'space' || suffVal === 'nothing') {
      level.suffix = suffVal as LevelSuffix;
    }
  }

  // Parse isLgl (legal numbering)
  const isLglEl = findChild(element, 'w', 'isLgl');
  if (isLglEl) {
    level.isLgl = parseBooleanElement(isLglEl);
  }

  // Parse lvlRestart (restart numbering from a higher level)
  const lvlRestartEl = findChild(element, 'w', 'lvlRestart');
  if (lvlRestartEl) {
    const restartVal = getAttribute(lvlRestartEl, 'w', 'val');
    if (restartVal !== null) {
      const restartNum = parseInt(restartVal, 10);
      if (!isNaN(restartNum)) {
        level.lvlRestart = restartNum;
      }
    }
  }

  // Parse legacy settings
  const legacyEl = findChild(element, 'w', 'legacy');
  if (legacyEl) {
    level.legacy = {
      legacy: parseBooleanElement(legacyEl),
      legacySpace: parseNumericAttribute(legacyEl, 'w', 'legacySpace'),
      legacyIndent: parseNumericAttribute(legacyEl, 'w', 'legacyIndent'),
    };
  }

  // Parse paragraph properties (w:pPr)
  const pPrEl = findChild(element, 'w', 'pPr');
  if (pPrEl) {
    level.pPr = parseLevelParagraphProps(pPrEl);
  }

  // Parse run properties (w:rPr)
  const rPrEl = findChild(element, 'w', 'rPr');
  if (rPrEl) {
    level.rPr = parseLevelRunProps(rPrEl);
  }

  return level;
}

/**
 * Parse number format string to NumberFormat type
 */
function parseNumberFormat(format: string): NumberFormat {
  // Map of known formats
  const formatMap: Record<string, NumberFormat> = {
    decimal: 'decimal',
    upperRoman: 'upperRoman',
    lowerRoman: 'lowerRoman',
    upperLetter: 'upperLetter',
    lowerLetter: 'lowerLetter',
    ordinal: 'ordinal',
    cardinalText: 'cardinalText',
    ordinalText: 'ordinalText',
    hex: 'hex',
    chicago: 'chicago',
    bullet: 'bullet',
    none: 'none',
    decimalZero: 'decimalZero',
    ganada: 'ganada',
    chosung: 'chosung',
    // CJK formats
    ideographDigital: 'ideographDigital',
    japaneseCounting: 'japaneseCounting',
    aiueo: 'aiueo',
    iroha: 'iroha',
    decimalFullWidth: 'decimalFullWidth',
    decimalHalfWidth: 'decimalHalfWidth',
    japaneseLegal: 'japaneseLegal',
    japaneseDigitalTenThousand: 'japaneseDigitalTenThousand',
    decimalEnclosedCircle: 'decimalEnclosedCircle',
    decimalFullWidth2: 'decimalFullWidth2',
    aiueoFullWidth: 'aiueoFullWidth',
    irohaFullWidth: 'irohaFullWidth',
    decimalEnclosedFullstop: 'decimalEnclosedFullstop',
    decimalEnclosedParen: 'decimalEnclosedParen',
    decimalEnclosedCircleChinese: 'decimalEnclosedCircleChinese',
    ideographEnclosedCircle: 'ideographEnclosedCircle',
    ideographTraditional: 'ideographTraditional',
    ideographZodiac: 'ideographZodiac',
    ideographZodiacTraditional: 'ideographZodiacTraditional',
    taiwaneseCounting: 'taiwaneseCounting',
    ideographLegalTraditional: 'ideographLegalTraditional',
    taiwaneseCountingThousand: 'taiwaneseCountingThousand',
    taiwaneseDigital: 'taiwaneseDigital',
    chineseCounting: 'chineseCounting',
    chineseLegalSimplified: 'chineseLegalSimplified',
    chineseCountingThousand: 'chineseCountingThousand',
    koreanDigital: 'koreanDigital',
    koreanCounting: 'koreanCounting',
    koreanLegal: 'koreanLegal',
    koreanDigital2: 'koreanDigital2',
    vietnameseCounting: 'vietnameseCounting',
    russianLower: 'russianLower',
    russianUpper: 'russianUpper',
    numberInDash: 'numberInDash',
    hebrew1: 'hebrew1',
    hebrew2: 'hebrew2',
    arabicAlpha: 'arabicAlpha',
    arabicAbjad: 'arabicAbjad',
    hindiVowels: 'hindiVowels',
    hindiConsonants: 'hindiConsonants',
    hindiNumbers: 'hindiNumbers',
    hindiCounting: 'hindiCounting',
    thaiLetters: 'thaiLetters',
    thaiNumbers: 'thaiNumbers',
    thaiCounting: 'thaiCounting',
  };

  return formatMap[format] ?? 'decimal';
}

/**
 * Parse paragraph properties for a list level (subset of full pPr)
 * Main concern: indentation and tabs
 */
function parseLevelParagraphProps(pPr: XmlElement): ParagraphFormatting {
  const formatting: ParagraphFormatting = {};

  // Parse indentation (w:ind)
  const indEl = findChild(pPr, 'w', 'ind');
  if (indEl) {
    const left = parseNumericAttribute(indEl, 'w', 'left');
    const right = parseNumericAttribute(indEl, 'w', 'right');
    const firstLine = parseNumericAttribute(indEl, 'w', 'firstLine');
    const hanging = parseNumericAttribute(indEl, 'w', 'hanging');

    if (left !== undefined) formatting.indentLeft = left;
    if (right !== undefined) formatting.indentRight = right;

    if (hanging !== undefined) {
      formatting.indentFirstLine = -hanging;
      formatting.hangingIndent = true;
    } else if (firstLine !== undefined) {
      formatting.indentFirstLine = firstLine;
    }
  }

  // Parse tabs (w:tabs)
  const tabsEl = findChild(pPr, 'w', 'tabs');
  if (tabsEl) {
    formatting.tabs = [];
    const tabElements = findChildren(tabsEl, 'w', 'tab');
    for (const tabEl of tabElements) {
      const pos = parseNumericAttribute(tabEl, 'w', 'pos');
      const val = getAttribute(tabEl, 'w', 'val');
      const leader = getAttribute(tabEl, 'w', 'leader');

      if (pos !== undefined && val) {
        formatting.tabs.push({
          position: pos,
          alignment: parseTabAlignment(val),
          leader: parseTabLeader(leader),
        });
      }
    }
  }

  return formatting;
}

/**
 * Parse tab alignment value
 */
function parseTabAlignment(
  val: string
): 'left' | 'center' | 'right' | 'decimal' | 'bar' | 'clear' | 'num' {
  switch (val) {
    case 'left':
      return 'left';
    case 'center':
      return 'center';
    case 'right':
      return 'right';
    case 'decimal':
      return 'decimal';
    case 'bar':
      return 'bar';
    case 'clear':
      return 'clear';
    case 'num':
      return 'num';
    default:
      return 'left';
  }
}

/**
 * Parse tab leader value
 */
function parseTabLeader(
  val: string | null
): 'none' | 'dot' | 'hyphen' | 'underscore' | 'heavy' | 'middleDot' | undefined {
  if (!val) return undefined;
  switch (val) {
    case 'none':
      return 'none';
    case 'dot':
      return 'dot';
    case 'hyphen':
      return 'hyphen';
    case 'underscore':
      return 'underscore';
    case 'heavy':
      return 'heavy';
    case 'middleDot':
      return 'middleDot';
    default:
      return undefined;
  }
}

/**
 * Parse run properties for a list level (subset of full rPr)
 * Main concern: fonts for bullet characters
 */
function parseLevelRunProps(rPr: XmlElement): TextFormatting {
  const formatting: TextFormatting = {};

  // Parse fonts (w:rFonts) - important for bullet characters
  const rFontsEl = findChild(rPr, 'w', 'rFonts');
  if (rFontsEl) {
    formatting.fontFamily = {
      ascii: getAttribute(rFontsEl, 'w', 'ascii') ?? undefined,
      hAnsi: getAttribute(rFontsEl, 'w', 'hAnsi') ?? undefined,
      eastAsia: getAttribute(rFontsEl, 'w', 'eastAsia') ?? undefined,
      cs: getAttribute(rFontsEl, 'w', 'cs') ?? undefined,
    };
  }

  // Parse font size (w:sz)
  const szEl = findChild(rPr, 'w', 'sz');
  if (szEl) {
    const size = parseNumericAttribute(szEl, 'w', 'val');
    if (size !== undefined) {
      formatting.fontSize = size; // In half-points
    }
  }

  // Parse color (w:color)
  const colorEl = findChild(rPr, 'w', 'color');
  if (colorEl) {
    const val = getAttribute(colorEl, 'w', 'val');
    const themeColor = getAttribute(colorEl, 'w', 'themeColor');

    if (val === 'auto') {
      formatting.color = { auto: true };
    } else if (themeColor) {
      formatting.color = {
        themeColor: themeColor as any,
        themeTint: getAttribute(colorEl, 'w', 'themeTint') ?? undefined,
        themeShade: getAttribute(colorEl, 'w', 'themeShade') ?? undefined,
      };
    } else if (val) {
      formatting.color = { rgb: val };
    }
  }

  // Parse bold (w:b)
  const bEl = findChild(rPr, 'w', 'b');
  if (bEl) {
    formatting.bold = parseBooleanElement(bEl);
  }

  // Parse italic (w:i)
  const iEl = findChild(rPr, 'w', 'i');
  if (iEl) {
    formatting.italic = parseBooleanElement(iEl);
  }

  return formatting;
}

/**
 * Create a NumberingMap with helper functions
 */
function createNumberingMap(definitions: NumberingDefinitions): NumberingMap {
  // Build lookup maps for efficient access
  const abstractMap = new Map<number, AbstractNumbering>();
  for (const abs of definitions.abstractNums) {
    abstractMap.set(abs.abstractNumId, abs);
  }

  const numMap = new Map<number, NumberingInstance>();
  for (const num of definitions.nums) {
    numMap.set(num.numId, num);
  }

  return {
    definitions,

    getLevel(numId: number, ilvl: number): ListLevel | null {
      const num = numMap.get(numId);
      if (!num) return null;

      // Check for level override first
      if (num.levelOverrides) {
        const override = num.levelOverrides.find((o) => o.ilvl === ilvl);
        if (override) {
          if (override.lvl) {
            // Full level redefinition
            return override.lvl;
          }
          // Start override - need to get base level and modify
          const abstractNum = abstractMap.get(num.abstractNumId);
          if (abstractNum) {
            const baseLevel = abstractNum.levels.find((l) => l.ilvl === ilvl);
            if (baseLevel && override.startOverride !== undefined) {
              return {
                ...baseLevel,
                start: override.startOverride,
              };
            }
          }
        }
      }

      // Get from abstract numbering
      const abstractNum = abstractMap.get(num.abstractNumId);
      if (!abstractNum) return null;

      return abstractNum.levels.find((l) => l.ilvl === ilvl) ?? null;
    },

    getAbstract(abstractNumId: number): AbstractNumbering | null {
      return abstractMap.get(abstractNumId) ?? null;
    },

    hasNumbering(numId: number): boolean {
      return numMap.has(numId);
    },
  };
}

/**
 * Format a number according to the specified format
 *
 * @param num - The number to format
 * @param format - The number format
 * @returns Formatted string
 */
export function formatNumber(num: number, format: NumberFormat): string {
  switch (format) {
    case 'decimal':
    case 'decimalZero':
      return num.toString();

    case 'upperRoman':
      return toRoman(num).toUpperCase();

    case 'lowerRoman':
      return toRoman(num).toLowerCase();

    case 'upperLetter':
      return toLetter(num).toUpperCase();

    case 'lowerLetter':
      return toLetter(num).toLowerCase();

    case 'ordinal':
      return toOrdinal(num);

    case 'bullet':
      return '•'; // Default bullet

    case 'none':
      return '';

    case 'decimalEnclosedParen':
      return `(${num})`;

    case 'numberInDash':
      return `-${num}-`;

    default:
      // For CJK and other special formats, fall back to decimal
      return num.toString();
  }
}

/**
 * Convert number to Roman numerals
 */
function toRoman(num: number): string {
  if (num <= 0 || num > 3999) return num.toString();

  const romanNumerals: [number, string][] = [
    [1000, 'm'],
    [900, 'cm'],
    [500, 'd'],
    [400, 'cd'],
    [100, 'c'],
    [90, 'xc'],
    [50, 'l'],
    [40, 'xl'],
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ];

  let result = '';
  let remaining = num;

  for (const [value, numeral] of romanNumerals) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }

  return result;
}

/**
 * Convert number to letter (a, b, c, ... z, aa, ab, ...)
 */
function toLetter(num: number): string {
  if (num <= 0) return '';

  let result = '';
  let remaining = num;

  while (remaining > 0) {
    remaining--;
    result = String.fromCharCode(97 + (remaining % 26)) + result;
    remaining = Math.floor(remaining / 26);
  }

  return result;
}

/**
 * Convert number to ordinal (1st, 2nd, 3rd, ...)
 */
function toOrdinal(num: number): string {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return num + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
}

/**
 * Render list marker text by replacing placeholders with formatted numbers
 *
 * @param lvlText - The level text pattern (e.g., "%1.", "%1.%2")
 * @param counters - Array of counter values for each level (index 0 = level 0, etc.)
 * @param formats - Array of number formats for each level
 * @returns Rendered marker text
 */
export function renderListMarker(
  lvlText: string,
  counters: number[],
  formats: NumberFormat[]
): string {
  let result = lvlText;

  // Replace %1 through %9 with formatted counter values
  for (let i = 1; i <= 9; i++) {
    const placeholder = `%${i}`;
    if (result.includes(placeholder)) {
      const counterIndex = i - 1;
      const counter = counters[counterIndex] ?? 1;
      const format = formats[counterIndex] ?? 'decimal';
      const formatted = formatNumber(counter, format);
      result = result.replace(placeholder, formatted);
    }
  }

  return result;
}

/**
 * Get the bullet character for a bullet list level
 *
 * @param level - The list level definition
 * @returns The bullet character to display
 */
export function getBulletCharacter(level: ListLevel): string {
  // If lvlText is set and not empty, use it
  if (level.lvlText) {
    return level.lvlText;
  }

  // Check font for common bullet font mappings
  const fontFamily = level.rPr?.fontFamily?.ascii || level.rPr?.fontFamily?.hAnsi;

  if (fontFamily) {
    const fontLower = fontFamily.toLowerCase();

    // Symbol font common bullets
    if (fontLower === 'symbol') {
      return '•'; // Standard bullet
    }

    // Wingdings common bullets
    if (fontLower.includes('wingding')) {
      return '❑'; // Square bullet
    }
  }

  // Default bullet
  return '•';
}

/**
 * Check if a list level is a bullet (not numbered)
 */
export function isBulletLevel(level: ListLevel): boolean {
  return level.numFmt === 'bullet' || level.numFmt === 'none';
}
