/**
 * Paragraph measurement module
 *
 * Measures paragraph blocks and computes line breaking.
 * Converts runs into measured lines with typography metrics.
 */

import type {
  ParagraphBlock,
  ParagraphMeasure,
  MeasuredLine,
  Run,
  TextRun,
  TabRun,
  ImageRun,
  LineBreakRun,
  ParagraphSpacing,
} from '../../layout-engine/types';

import {
  measureTextWidth,
  measureRun,
  getFontMetrics,
  ptToPx,
  type FontStyle,
  type FontMetrics,
} from './measureContainer';

// Default values - match Word 2007+ defaults and renderPage.ts
const DEFAULT_FONT_SIZE = 11; // 11pt (Word 2007+ default)
const DEFAULT_FONT_FAMILY = 'Calibri';
const DEFAULT_LINE_HEIGHT_MULTIPLIER = 1.15; // Word single spacing

// Floating-point tolerance for line breaking (0.5px)
// Prevents premature line breaks due to measurement rounding
const WIDTH_TOLERANCE = 0.5;

/**
 * Typography metrics for a line
 */
interface LineTypography {
  ascent: number;
  descent: number;
  lineHeight: number;
}

/**
 * State tracking for line accumulation
 */
interface LineState {
  fromRun: number;
  fromChar: number;
  toRun: number;
  toChar: number;
  width: number;
  maxFontSize: number;
  maxFontMetrics: FontMetrics | null;
  availableWidth: number;
}

/**
 * Extract FontStyle from a text run for measurement
 */
function runToFontStyle(run: TextRun | TabRun): FontStyle {
  return {
    fontFamily: run.fontFamily ?? DEFAULT_FONT_FAMILY,
    fontSize: run.fontSize ?? DEFAULT_FONT_SIZE,
    bold: run.bold,
    italic: run.italic,
    letterSpacing: run.letterSpacing,
  };
}

/**
 * Calculate typography metrics from font size and spacing settings
 *
 * @param fontSize - Font size in points
 * @param spacing - Paragraph spacing settings
 * @param metrics - Pre-calculated font metrics (in pixels)
 */
function calculateTypographyMetrics(
  fontSize: number,
  spacing?: ParagraphSpacing,
  metrics?: FontMetrics | null
): LineTypography {
  // Use provided metrics or calculate from font size
  // When calculating from fontSize (points), convert to pixels first
  const fontSizePx = ptToPx(fontSize);
  const ascent = metrics?.ascent ?? fontSizePx * 0.8;
  const descent = metrics?.descent ?? fontSizePx * 0.2;

  // Base line height should match CSS rendering (em-box based, not ink bounding box)
  // Use metrics.lineHeight if available (already calculated correctly in getFontMetrics)
  // This is fontSizePx * 1.15 which matches what browsers render
  const defaultLineHeight = metrics?.lineHeight ?? fontSizePx * DEFAULT_LINE_HEIGHT_MULTIPLIER;

  // Apply line spacing rules
  let lineHeight: number;

  if (spacing?.lineRule === 'exact' && spacing.line !== undefined) {
    // Exact: use specified height exactly
    lineHeight = spacing.line;
  } else if (spacing?.lineRule === 'atLeast' && spacing.line !== undefined) {
    // At least: use specified height or natural height, whichever is larger
    lineHeight = Math.max(spacing.line, defaultLineHeight);
  } else if (spacing?.line !== undefined && spacing?.lineUnit === 'multiplier') {
    // Multiplier: In OOXML, lineRule="auto" the line value is a percentage of
    // single line spacing. line=240 → 1.0x, line=480 → 2.0x
    lineHeight = defaultLineHeight * spacing.line;
  } else if (spacing?.line !== undefined && spacing?.lineUnit === 'px') {
    // Pixel value
    lineHeight = spacing.line;
  } else {
    // Default: Word's single line spacing (1.15x) - already in defaultLineHeight
    lineHeight = defaultLineHeight;
  }

  return { ascent, descent, lineHeight };
}

/**
 * Calculate metrics for an empty paragraph
 */
function calculateEmptyParagraphMetrics(
  fontSize: number,
  spacing?: ParagraphSpacing
): LineTypography {
  const metrics = getFontMetrics({ fontSize, fontFamily: DEFAULT_FONT_FAMILY });
  return calculateTypographyMetrics(fontSize, spacing, metrics);
}

/**
 * Check if a run is a text run
 */
function isTextRun(run: Run): run is TextRun {
  return run.kind === 'text';
}

/**
 * Check if a run is a tab run
 */
function isTabRun(run: Run): run is TabRun {
  return run.kind === 'tab';
}

/**
 * Check if a run is an image run
 */
function isImageRun(run: Run): run is ImageRun {
  return run.kind === 'image';
}

/**
 * Check if a run is a line break run
 */
function isLineBreakRun(run: Run): run is LineBreakRun {
  return run.kind === 'lineBreak';
}

/**
 * Check if text run is empty (only whitespace or no text)
 */
function isEmptyTextRun(run: TextRun): boolean {
  return !run.text || run.text.length === 0;
}

/**
 * Find word break points in text
 * Returns array of indices where words end (after space/punctuation)
 */
function findWordBreaks(text: string): number[] {
  const breaks: number[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    // Break after space or certain punctuation
    if (char === ' ' || char === '-' || char === '\t') {
      breaks.push(i + 1);
    }
  }

  return breaks;
}

/**
 * Default tab width in pixels (0.5 inch at 96 DPI)
 */
const DEFAULT_TAB_WIDTH = 48;

/**
 * Measure a paragraph block and compute line breaks
 *
 * @param block - The paragraph block to measure
 * @param maxWidth - Maximum available width for the paragraph
 * @returns ParagraphMeasure with lines and total height
 */
export function measureParagraph(block: ParagraphBlock, maxWidth: number): ParagraphMeasure {
  const runs = block.runs;
  const attrs = block.attrs;
  const spacing = attrs?.spacing;

  // Handle indentation
  const indent = attrs?.indent;
  const indentLeft = indent?.left ?? 0;
  const indentRight = indent?.right ?? 0;
  const firstLineOffset = (indent?.firstLine ?? 0) - (indent?.hanging ?? 0);

  // Calculate available widths
  const bodyContentWidth = Math.max(1, maxWidth - indentLeft - indentRight);
  // First line offset: positive = first-line indent (less space), negative = hanging (more space)
  // Subtracting gives correct width in both cases
  const firstLineWidth = Math.max(1, bodyContentWidth - firstLineOffset);

  const lines: MeasuredLine[] = [];

  // Handle empty paragraph
  if (runs.length === 0) {
    const emptyMetrics = calculateEmptyParagraphMetrics(DEFAULT_FONT_SIZE, spacing);
    lines.push({
      fromRun: 0,
      fromChar: 0,
      toRun: 0,
      toChar: 0,
      width: 0,
      ...emptyMetrics,
    });

    return {
      kind: 'paragraph',
      lines,
      totalHeight: emptyMetrics.lineHeight,
    };
  }

  // Check for empty text run only
  if (runs.length === 1 && isTextRun(runs[0]) && isEmptyTextRun(runs[0] as TextRun)) {
    const run = runs[0] as TextRun;
    const fontSize = run.fontSize ?? DEFAULT_FONT_SIZE;
    const emptyMetrics = calculateEmptyParagraphMetrics(fontSize, spacing);

    lines.push({
      fromRun: 0,
      fromChar: 0,
      toRun: 0,
      toChar: 0,
      width: 0,
      ...emptyMetrics,
    });

    return {
      kind: 'paragraph',
      lines,
      totalHeight: emptyMetrics.lineHeight,
    };
  }

  // Initialize line state
  let currentLine: LineState = {
    fromRun: 0,
    fromChar: 0,
    toRun: 0,
    toChar: 0,
    width: 0,
    maxFontSize: DEFAULT_FONT_SIZE,
    maxFontMetrics: null,
    availableWidth: firstLineWidth,
  };

  /**
   * Finalize and push the current line to the lines array
   */
  const finalizeLine = (): void => {
    const typography = calculateTypographyMetrics(
      currentLine.maxFontSize,
      spacing,
      currentLine.maxFontMetrics
    );

    lines.push({
      fromRun: currentLine.fromRun,
      fromChar: currentLine.fromChar,
      toRun: currentLine.toRun,
      toChar: currentLine.toChar,
      width: currentLine.width,
      ...typography,
    });
  };

  /**
   * Start a new line after the current one
   */
  const startNewLine = (runIndex: number, charIndex: number): void => {
    finalizeLine();

    currentLine = {
      fromRun: runIndex,
      fromChar: charIndex,
      toRun: runIndex,
      toChar: charIndex,
      width: 0,
      maxFontSize: DEFAULT_FONT_SIZE,
      maxFontMetrics: null,
      availableWidth: bodyContentWidth,
    };
  };

  /**
   * Update max font tracking for the current line
   */
  const updateMaxFont = (style: FontStyle): void => {
    const fontSize = style.fontSize ?? DEFAULT_FONT_SIZE;
    if (fontSize > currentLine.maxFontSize) {
      currentLine.maxFontSize = fontSize;
      currentLine.maxFontMetrics = getFontMetrics(style);
    }
  };

  // Process each run
  for (let runIndex = 0; runIndex < runs.length; runIndex++) {
    const run = runs[runIndex];

    if (isLineBreakRun(run)) {
      // Force line break
      currentLine.toRun = runIndex;
      currentLine.toChar = 0;
      startNewLine(runIndex + 1, 0);
      continue;
    }

    if (isTabRun(run)) {
      // Handle tab run
      const style = runToFontStyle(run);
      updateMaxFont(style);

      const tabWidth = run.width ?? DEFAULT_TAB_WIDTH;

      if (currentLine.width + tabWidth > currentLine.availableWidth + WIDTH_TOLERANCE) {
        // Tab doesn't fit, start new line
        startNewLine(runIndex, 0);
      }

      currentLine.width += tabWidth;
      currentLine.toRun = runIndex;
      currentLine.toChar = 1;
      continue;
    }

    if (isImageRun(run)) {
      // Skip floating/anchored images - they don't contribute to line height
      // (they are positioned absolutely and rendered separately)
      if (run.position) {
        currentLine.toRun = runIndex;
        currentLine.toChar = 1;
        continue;
      }

      // Handle inline image
      const imageWidth = run.width;
      const imageHeight = run.height;

      // Update max font size based on image height
      if (imageHeight > currentLine.maxFontSize) {
        currentLine.maxFontSize = imageHeight;
      }

      if (currentLine.width + imageWidth > currentLine.availableWidth + WIDTH_TOLERANCE) {
        // Image doesn't fit, start new line
        startNewLine(runIndex, 0);
      }

      currentLine.width += imageWidth;
      currentLine.toRun = runIndex;
      currentLine.toChar = 1;
      continue;
    }

    if (isTextRun(run)) {
      const textRun = run as TextRun;
      const text = textRun.text;
      const style = runToFontStyle(textRun);

      updateMaxFont(style);

      if (!text || text.length === 0) {
        // Empty text run, just update position
        currentLine.toRun = runIndex;
        currentLine.toChar = 0;
        continue;
      }

      // Find word break points for wrapping
      const wordBreaks = findWordBreaks(text);

      // Process text word by word
      let charIndex = 0;

      while (charIndex < text.length) {
        // Find next word boundary
        let nextBreak = text.length;
        for (const breakPoint of wordBreaks) {
          if (breakPoint > charIndex) {
            nextBreak = breakPoint;
            break;
          }
        }

        // Extract word (includes trailing space if present)
        const word = text.slice(charIndex, nextBreak);
        const wordWidth = measureTextWidth(word, style);

        // Check if word fits on current line
        if (
          currentLine.width > 0 &&
          currentLine.width + wordWidth > currentLine.availableWidth + WIDTH_TOLERANCE
        ) {
          // Word doesn't fit, start new line
          startNewLine(runIndex, charIndex);
        }

        // Add word to current line
        currentLine.width += wordWidth;
        currentLine.toRun = runIndex;
        currentLine.toChar = nextBreak;

        charIndex = nextBreak;
      }
    }
  }

  // Finalize the last line
  finalizeLine();

  // Calculate total height
  const totalHeight = lines.reduce((sum, line) => sum + line.lineHeight, 0);

  // Add spacing before/after
  let totalWithSpacing = totalHeight;
  if (spacing?.before) {
    totalWithSpacing += spacing.before;
  }
  if (spacing?.after) {
    totalWithSpacing += spacing.after;
  }

  return {
    kind: 'paragraph',
    lines,
    totalHeight: totalWithSpacing,
  };
}

/**
 * Measure multiple paragraph blocks
 *
 * @param blocks - Array of paragraph blocks to measure
 * @param maxWidth - Maximum available width
 * @returns Array of ParagraphMeasure results
 */
export function measureParagraphs(blocks: ParagraphBlock[], maxWidth: number): ParagraphMeasure[] {
  return blocks.map((block) => measureParagraph(block, maxWidth));
}

/**
 * Get per-character widths for a text run (for click positioning)
 *
 * @param run - The text run to measure
 * @returns Array of character widths
 */
export function getRunCharWidths(run: TextRun): number[] {
  const style = runToFontStyle(run);
  const result = measureRun(run.text, style);
  return result.charWidths;
}
