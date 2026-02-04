/**
 * Measurement container for text layout
 *
 * Uses HTML5 Canvas API to measure text runs and calculate typography metrics.
 * Canvas-based measurement is more accurate and performant than DOM-based approaches.
 *
 * Typography conventions (matching Word behavior):
 * - ascent ≈ fontSize * 0.8 (baseline to top)
 * - descent ≈ fontSize * 0.2 (baseline to bottom)
 * - lineHeight = fontSize * 1.15 (Word 2007+ "single" line spacing)
 */

// Constants for OOXML unit conversions
const TWIPS_PER_INCH = 1440;
const PX_PER_INCH = 96; // Standard CSS/DOM DPI
const TWIPS_PER_PX = TWIPS_PER_INCH / PX_PER_INCH; // 15 twips per pixel

// Default typography values
const DEFAULT_FONT_SIZE = 12; // 12pt
const DEFAULT_FONT_FAMILY = 'Arial';
const DEFAULT_LINE_HEIGHT_MULTIPLIER = 1.15; // Word single spacing
const DEFAULT_ASCENT_RATIO = 0.8;
const DEFAULT_DESCENT_RATIO = 0.2;

/**
 * Font styling properties for measurement
 */
export interface FontStyle {
  fontFamily?: string;
  fontSize?: number; // in points
  bold?: boolean;
  italic?: boolean;
  letterSpacing?: number; // in pixels
}

/**
 * Typography metrics for a font
 */
export interface FontMetrics {
  fontSize: number;
  ascent: number;
  descent: number;
  lineHeight: number;
  fontFamily: string;
}

/**
 * Result of measuring a text string
 */
export interface TextMeasurement {
  width: number;
  height: number;
  ascent: number;
  descent: number;
}

/**
 * Result of measuring a run of text
 */
export interface RunMeasurement {
  width: number;
  charWidths: number[]; // Width of each character for click positioning
  metrics: FontMetrics;
}

// Cached canvas context for text measurement
let canvasContext: CanvasRenderingContext2D | null = null;

/**
 * Get or create a canvas 2D context for text measurement
 */
export function getCanvasContext(): CanvasRenderingContext2D {
  if (!canvasContext) {
    // Create offscreen canvas
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;

    if (!canvas) {
      throw new Error('Canvas not available. Ensure this runs in a DOM environment.');
    }

    canvasContext = canvas.getContext('2d');
    if (!canvasContext) {
      throw new Error('Failed to get 2D context from canvas');
    }
  }

  return canvasContext;
}

/**
 * Reset the canvas context (useful for testing)
 */
export function resetCanvasContext(): void {
  canvasContext = null;
}

/**
 * Build a CSS font string from styling properties
 *
 * Font sizes are in points and need to be converted to pixels for canvas.
 * 1pt = 96/72 px ≈ 1.333px at standard web DPI.
 *
 * @example
 * buildFontString({ fontFamily: "Arial", fontSize: 12, bold: true })
 * // Returns: "bold 16px Arial" (12pt = 16px)
 */
export function buildFontString(style: FontStyle): string {
  const parts: string[] = [];

  if (style.italic) parts.push('italic');
  if (style.bold) parts.push('bold');

  // Convert points to pixels for canvas measurement
  const fontSizePt = style.fontSize ?? DEFAULT_FONT_SIZE;
  const fontSizePx = ptToPx(fontSizePt);
  parts.push(`${fontSizePx}px`);

  const fontFamily = style.fontFamily ?? DEFAULT_FONT_FAMILY;
  parts.push(fontFamily);

  return parts.join(' ');
}

/**
 * Get typography metrics for a given font size and family
 *
 * Uses Canvas TextMetrics API when available for precise metrics,
 * falls back to ratio-based approximations.
 */
export function getFontMetrics(style: FontStyle): FontMetrics {
  const fontSize = style.fontSize ?? DEFAULT_FONT_SIZE;
  const fontFamily = style.fontFamily ?? DEFAULT_FONT_FAMILY;

  // Try to get precise metrics from canvas
  try {
    const ctx = getCanvasContext();
    ctx.font = buildFontString(style);

    // Measure a standard character to get ascent/descent
    const metrics = ctx.measureText('Hg');

    // Modern browsers provide actual bounding box metrics
    if (
      typeof metrics.actualBoundingBoxAscent === 'number' &&
      typeof metrics.actualBoundingBoxDescent === 'number'
    ) {
      const ascent = metrics.actualBoundingBoxAscent;
      const descent = metrics.actualBoundingBoxDescent;
      const lineHeight = (ascent + descent) * DEFAULT_LINE_HEIGHT_MULTIPLIER;

      return {
        fontSize,
        ascent,
        descent,
        lineHeight,
        fontFamily,
      };
    }
  } catch {
    // Fall through to approximation
  }

  // Fallback: ratio-based approximation
  // Convert font size from points to pixels for metrics calculation
  // (canvas metrics are in pixels, so fallback should match)
  const fontSizePx = ptToPx(fontSize);
  const ascent = fontSizePx * DEFAULT_ASCENT_RATIO;
  const descent = fontSizePx * DEFAULT_DESCENT_RATIO;
  const lineHeight = fontSizePx * DEFAULT_LINE_HEIGHT_MULTIPLIER;

  return {
    fontSize, // Keep in points for reference
    ascent,
    descent,
    lineHeight,
    fontFamily,
  };
}

/**
 * Measure the width of a text string with specific styling
 *
 * @param text - The text to measure
 * @param style - Font styling properties
 * @returns Width in pixels
 */
export function measureTextWidth(text: string, style: FontStyle): number {
  if (!text) return 0;

  const ctx = getCanvasContext();
  ctx.font = buildFontString(style);

  const metrics = ctx.measureText(text);

  // Use actualBoundingBox for more accurate width that includes glyph overhang
  const advanceWidth = metrics.width;
  const paintedWidth = (metrics.actualBoundingBoxLeft || 0) + (metrics.actualBoundingBoxRight || 0);

  let width = Math.max(advanceWidth, paintedWidth);

  // Apply letter spacing if specified
  if (style.letterSpacing && text.length > 1) {
    width += style.letterSpacing * (text.length - 1);
  }

  return width;
}

/**
 * Measure text and return full metrics
 */
export function measureText(text: string, style: FontStyle): TextMeasurement {
  const width = measureTextWidth(text, style);
  const metrics = getFontMetrics(style);

  return {
    width,
    height: metrics.ascent + metrics.descent,
    ascent: metrics.ascent,
    descent: metrics.descent,
  };
}

/**
 * Measure a run of text and return per-character widths for click positioning
 *
 * @param text - The text to measure
 * @param style - Font styling properties
 * @returns Run measurement with width and per-character widths
 */
export function measureRun(text: string, style: FontStyle): RunMeasurement {
  const metrics = getFontMetrics(style);

  if (!text) {
    return {
      width: 0,
      charWidths: [],
      metrics,
    };
  }

  const ctx = getCanvasContext();
  ctx.font = buildFontString(style);

  const letterSpacing = style.letterSpacing ?? 0;
  const charWidths: number[] = [];
  let totalWidth = 0;

  // Measure each character individually for click positioning
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const charMetrics = ctx.measureText(char);

    // Use advance width for individual characters
    let charWidth = charMetrics.width;

    // Add letter spacing after each character except the last
    if (letterSpacing && i < text.length - 1) {
      charWidth += letterSpacing;
    }

    charWidths.push(charWidth);
    totalWidth += charWidth;
  }

  return {
    width: totalWidth,
    charWidths,
    metrics,
  };
}

/**
 * Find the character offset at a given X position within a text run
 *
 * @param x - X position relative to run start
 * @param charWidths - Per-character widths from measureRun
 * @returns Character offset (0-based index)
 */
export function findCharacterAtX(x: number, charWidths: number[]): number {
  if (charWidths.length === 0) return 0;
  if (x <= 0) return 0;

  let accumulatedWidth = 0;

  for (let i = 0; i < charWidths.length; i++) {
    const charWidth = charWidths[i];
    const charMidpoint = accumulatedWidth + charWidth / 2;

    // If x is before the midpoint, the cursor is at this character
    if (x <= charMidpoint) {
      return i;
    }

    accumulatedWidth += charWidth;
  }

  // X is past all characters, return position after last character
  return charWidths.length;
}

/**
 * Get the X position of a character offset within a text run
 *
 * @param offset - Character offset (0-based index)
 * @param charWidths - Per-character widths from measureRun
 * @returns X position in pixels
 */
export function getXForCharacter(offset: number, charWidths: number[]): number {
  if (offset <= 0 || charWidths.length === 0) return 0;

  const clampedOffset = Math.min(offset, charWidths.length);
  let x = 0;

  for (let i = 0; i < clampedOffset; i++) {
    x += charWidths[i];
  }

  return x;
}

// Unit conversion utilities

/**
 * Convert twips to pixels
 */
export function twipsToPx(twips: number): number {
  return twips / TWIPS_PER_PX;
}

/**
 * Convert pixels to twips
 */
export function pxToTwips(px: number): number {
  return Math.round(px * TWIPS_PER_PX);
}

/**
 * Convert points to pixels
 */
export function ptToPx(pt: number): number {
  return (pt * PX_PER_INCH) / 72;
}

/**
 * Convert pixels to points
 */
export function pxToPt(px: number): number {
  return (px * 72) / PX_PER_INCH;
}

/**
 * Convert OOXML half-points to pixels
 * OOXML font sizes are in half-points (24 = 12pt)
 */
export function halfPtToPx(halfPt: number): number {
  return ptToPx(halfPt / 2);
}

/**
 * Convert pixels to OOXML half-points
 */
export function pxToHalfPt(px: number): number {
  return pxToPt(px) * 2;
}
