/**
 * Canvas-based Text Measurement
 *
 * Provides accurate text measurement for line breaking and layout,
 * with font loading awareness and caching for performance.
 */

import type { TextFormatting, Theme } from '../types';
import { resolveFontFamily } from './fontResolver';
import { isFontLoaded } from './fontLoader';
import { halfPointsToPixels } from './units';

/**
 * Result of measuring text
 */
export interface TextMeasurement {
  /** Width of the text in pixels */
  width: number;
  /** Height of the text in pixels (based on font metrics) */
  height: number;
  /** Distance from top to baseline in pixels */
  baseline: number;
  /** Actual bounding box (if available from TextMetrics) */
  actualBoundingBox?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}

/**
 * Options for text measurement
 */
export interface MeasureOptions {
  /** Theme for resolving theme fonts */
  theme?: Theme;
  /** Whether to wait for fonts to load (default: false) */
  waitForFont?: boolean;
  /** Timeout for font loading in ms (default: 1000) */
  fontTimeout?: number;
}

// ============================================================================
// CACHING
// ============================================================================

/**
 * Cache key generation for text measurements
 */
function getCacheKey(
  text: string,
  fontFamily: string,
  fontSize: number,
  bold: boolean,
  italic: boolean
): string {
  return `${text}|${fontFamily}|${fontSize}|${bold ? 'b' : ''}${italic ? 'i' : ''}`;
}

/**
 * LRU cache for text measurements
 */
class MeasurementCache {
  private cache = new Map<string, TextMeasurement>();
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  get(key: string): TextMeasurement | undefined {
    const value = this.cache.get(key);
    if (value) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: string, value: TextMeasurement): void {
    // Delete if exists to move to end
    this.cache.delete(key);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// Global measurement cache
const measurementCache = new MeasurementCache();

// ============================================================================
// CANVAS CONTEXT MANAGEMENT
// ============================================================================

/**
 * Cached canvas context for measurements
 */
let measureCanvas: HTMLCanvasElement | null = null;
let measureContext: CanvasRenderingContext2D | null = null;

/**
 * Get or create canvas context for measurements
 */
function getMeasureContext(): CanvasRenderingContext2D | null {
  // Skip if we're not in a browser
  if (typeof document === 'undefined') {
    return null;
  }

  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas');
    measureContext = measureCanvas.getContext('2d');
  }

  return measureContext;
}

// ============================================================================
// FONT STRING BUILDING
// ============================================================================

/**
 * Build CSS font string for canvas context
 */
function buildFontString(
  fontFamily: string,
  fontSize: number,
  bold: boolean,
  italic: boolean
): string {
  const style = italic ? 'italic ' : '';
  const weight = bold ? 'bold ' : '';
  // Use px for canvas measurements
  return `${style}${weight}${fontSize}px ${fontFamily}`;
}

/**
 * Extract font parameters from TextFormatting
 */
function extractFontParams(
  formatting?: TextFormatting,
  theme?: Theme
): { fontFamily: string; fontSize: number; bold: boolean; italic: boolean } {
  // Default values matching Word defaults
  const DEFAULT_FONT_SIZE = 24; // 12pt in half-points
  const DEFAULT_FONT_FAMILY = 'Calibri';

  if (!formatting) {
    const resolved = resolveFontFamily(DEFAULT_FONT_FAMILY);
    return {
      fontFamily: resolved.cssFallback,
      fontSize: halfPointsToPixels(DEFAULT_FONT_SIZE),
      bold: false,
      italic: false,
    };
  }

  // Resolve font family
  let fontFamilyName = DEFAULT_FONT_FAMILY;

  if (formatting.fontFamily) {
    // Priority: ascii > hAnsi > theme reference
    fontFamilyName =
      formatting.fontFamily.ascii ||
      formatting.fontFamily.hAnsi ||
      DEFAULT_FONT_FAMILY;

    // Handle theme font references
    if (!fontFamilyName && theme?.fonts) {
      const themeRef = formatting.fontFamily.asciiTheme || formatting.fontFamily.hAnsiTheme;
      if (themeRef) {
        const isMajor = themeRef.toLowerCase().includes('major');
        const themeFont = isMajor ? theme.fonts.majorFont : theme.fonts.minorFont;
        fontFamilyName = themeFont?.latin || DEFAULT_FONT_FAMILY;
      }
    }
  }

  const resolved = resolveFontFamily(fontFamilyName);

  // Get font size (in half-points, convert to pixels)
  const fontSize = formatting.fontSize
    ? halfPointsToPixels(formatting.fontSize)
    : halfPointsToPixels(DEFAULT_FONT_SIZE);

  return {
    fontFamily: resolved.cssFallback,
    fontSize,
    bold: formatting.bold ?? false,
    italic: formatting.italic ?? false,
  };
}

// ============================================================================
// FONT LOADING
// ============================================================================

/**
 * Wait for a font to be available
 */
async function waitForFontAvailable(
  fontFamily: string,
  timeout: number
): Promise<boolean> {
  // Check if font is already loaded via our loader
  const primaryFont = fontFamily.split(',')[0].trim().replace(/['"]/g, '');
  if (isFontLoaded(primaryFont)) {
    return true;
  }

  // Use CSS Font Loading API if available
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      const fontFace = `400 16px ${fontFamily}`;
      await Promise.race([
        document.fonts.load(fontFace),
        new Promise((resolve) => setTimeout(resolve, timeout)),
      ]);

      return document.fonts.check(fontFace);
    } catch {
      // Fall through
    }
  }

  // Fallback: wait a bit and hope for the best
  await new Promise((resolve) => setTimeout(resolve, Math.min(100, timeout)));
  return true;
}

// ============================================================================
// MAIN MEASUREMENT FUNCTIONS
// ============================================================================

/**
 * Measure text with the given formatting
 *
 * @param text - The text to measure
 * @param formatting - Text formatting properties
 * @param options - Measurement options
 * @returns Text measurements (width, height, baseline)
 */
export async function measureText(
  text: string,
  formatting?: TextFormatting,
  options?: MeasureOptions
): Promise<TextMeasurement> {
  // Handle empty text
  if (!text || text.length === 0) {
    const { fontSize } = extractFontParams(formatting, options?.theme);
    return {
      width: 0,
      height: fontSize * 1.2, // Approximate line height
      baseline: fontSize * 0.8, // Approximate baseline
    };
  }

  const { fontFamily, fontSize, bold, italic } = extractFontParams(
    formatting,
    options?.theme
  );

  // Check cache first
  const cacheKey = getCacheKey(text, fontFamily, fontSize, bold, italic);
  const cached = measurementCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Wait for font if requested
  if (options?.waitForFont) {
    await waitForFontAvailable(fontFamily, options.fontTimeout ?? 1000);
  }

  // Get canvas context
  const ctx = getMeasureContext();
  if (!ctx) {
    // Fallback for non-browser environments
    const fallbackMeasurement = estimateTextMeasurement(text, fontSize);
    return fallbackMeasurement;
  }

  // Set up font
  const fontString = buildFontString(fontFamily, fontSize, bold, italic);
  ctx.font = fontString;
  ctx.textBaseline = 'alphabetic';

  // Measure
  const metrics = ctx.measureText(text);

  // Calculate measurements
  // Modern browsers provide detailed metrics; older ones need estimation
  const width = metrics.width;

  // Height from font metrics if available, otherwise estimate
  let height: number;
  let baseline: number;

  if (metrics.fontBoundingBoxAscent !== undefined && metrics.fontBoundingBoxDescent !== undefined) {
    // Modern browsers with full metrics
    height = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
    baseline = metrics.fontBoundingBoxAscent;
  } else if (metrics.actualBoundingBoxAscent !== undefined && metrics.actualBoundingBoxDescent !== undefined) {
    // Actual text bounds (varies with specific glyphs)
    height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    baseline = metrics.actualBoundingBoxAscent;
  } else {
    // Fallback estimation
    height = fontSize * 1.2;
    baseline = fontSize * 0.8;
  }

  const measurement: TextMeasurement = {
    width,
    height,
    baseline,
  };

  // Add actual bounding box if available
  if (
    metrics.actualBoundingBoxLeft !== undefined &&
    metrics.actualBoundingBoxRight !== undefined &&
    metrics.actualBoundingBoxAscent !== undefined &&
    metrics.actualBoundingBoxDescent !== undefined
  ) {
    measurement.actualBoundingBox = {
      left: metrics.actualBoundingBoxLeft,
      right: metrics.actualBoundingBoxRight,
      top: metrics.actualBoundingBoxAscent,
      bottom: metrics.actualBoundingBoxDescent,
    };
  }

  // Cache the result
  measurementCache.set(cacheKey, measurement);

  return measurement;
}

/**
 * Synchronous text measurement (doesn't wait for fonts)
 *
 * Use this when you need immediate results and font loading is
 * already handled separately.
 *
 * @param text - The text to measure
 * @param formatting - Text formatting properties
 * @param theme - Optional theme for font resolution
 * @returns Text measurements
 */
export function measureTextSync(
  text: string,
  formatting?: TextFormatting,
  theme?: Theme
): TextMeasurement {
  // Handle empty text
  if (!text || text.length === 0) {
    const { fontSize } = extractFontParams(formatting, theme);
    return {
      width: 0,
      height: fontSize * 1.2,
      baseline: fontSize * 0.8,
    };
  }

  const { fontFamily, fontSize, bold, italic } = extractFontParams(formatting, theme);

  // Check cache first
  const cacheKey = getCacheKey(text, fontFamily, fontSize, bold, italic);
  const cached = measurementCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Get canvas context
  const ctx = getMeasureContext();
  if (!ctx) {
    return estimateTextMeasurement(text, fontSize);
  }

  // Set up font and measure
  const fontString = buildFontString(fontFamily, fontSize, bold, italic);
  ctx.font = fontString;
  ctx.textBaseline = 'alphabetic';

  const metrics = ctx.measureText(text);

  let height: number;
  let baseline: number;

  if (metrics.fontBoundingBoxAscent !== undefined && metrics.fontBoundingBoxDescent !== undefined) {
    height = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
    baseline = metrics.fontBoundingBoxAscent;
  } else if (metrics.actualBoundingBoxAscent !== undefined && metrics.actualBoundingBoxDescent !== undefined) {
    height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    baseline = metrics.actualBoundingBoxAscent;
  } else {
    height = fontSize * 1.2;
    baseline = fontSize * 0.8;
  }

  const measurement: TextMeasurement = {
    width: metrics.width,
    height,
    baseline,
  };

  if (
    metrics.actualBoundingBoxLeft !== undefined &&
    metrics.actualBoundingBoxRight !== undefined &&
    metrics.actualBoundingBoxAscent !== undefined &&
    metrics.actualBoundingBoxDescent !== undefined
  ) {
    measurement.actualBoundingBox = {
      left: metrics.actualBoundingBoxLeft,
      right: metrics.actualBoundingBoxRight,
      top: metrics.actualBoundingBoxAscent,
      bottom: metrics.actualBoundingBoxDescent,
    };
  }

  measurementCache.set(cacheKey, measurement);
  return measurement;
}

/**
 * Measure a single character
 */
export function measureChar(
  char: string,
  formatting?: TextFormatting,
  theme?: Theme
): TextMeasurement {
  return measureTextSync(char, formatting, theme);
}

/**
 * Measure the width of a space character
 */
export function measureSpace(formatting?: TextFormatting, theme?: Theme): number {
  return measureTextSync(' ', formatting, theme).width;
}

/**
 * Get line height for given formatting
 */
export function getLineHeight(formatting?: TextFormatting, theme?: Theme): number {
  // Measure a typical line (capital M is good for this)
  const measurement = measureTextSync('M', formatting, theme);
  // Return height with a bit of leading
  return measurement.height * 1.15;
}

/**
 * Get baseline position for given formatting
 */
export function getBaseline(formatting?: TextFormatting, theme?: Theme): number {
  return measureTextSync('M', formatting, theme).baseline;
}

// ============================================================================
// ESTIMATION FALLBACKS
// ============================================================================

/**
 * Estimate text measurement without canvas
 *
 * This provides rough estimates for server-side rendering or
 * when canvas is not available.
 */
function estimateTextMeasurement(text: string, fontSize: number): TextMeasurement {
  // Average character width is roughly 0.5-0.6 of font size for proportional fonts
  const avgCharWidth = fontSize * 0.55;
  const width = text.length * avgCharWidth;

  return {
    width,
    height: fontSize * 1.2,
    baseline: fontSize * 0.8,
  };
}

/**
 * Estimate line width from character count
 */
export function estimateLineWidth(charCount: number, fontSize: number): number {
  return charCount * fontSize * 0.55;
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Clear the measurement cache
 *
 * Call this after font loading or when fonts change to ensure
 * measurements are recalculated.
 */
export function clearMeasurementCache(): void {
  measurementCache.clear();
}

/**
 * Get the current cache size
 */
export function getMeasurementCacheSize(): number {
  return measurementCache.size;
}

// ============================================================================
// BULK MEASUREMENT
// ============================================================================

/**
 * Measure multiple text strings with the same formatting
 *
 * More efficient than calling measureText multiple times.
 */
export function measureTexts(
  texts: string[],
  formatting?: TextFormatting,
  theme?: Theme
): TextMeasurement[] {
  return texts.map((text) => measureTextSync(text, formatting, theme));
}

/**
 * Measure text width only (faster, skips height calculation)
 */
export function measureTextWidth(
  text: string,
  formatting?: TextFormatting,
  theme?: Theme
): number {
  if (!text || text.length === 0) {
    return 0;
  }

  const { fontFamily, fontSize, bold, italic } = extractFontParams(formatting, theme);
  const ctx = getMeasureContext();

  if (!ctx) {
    return estimateTextMeasurement(text, fontSize).width;
  }

  const fontString = buildFontString(fontFamily, fontSize, bold, italic);
  ctx.font = fontString;

  return ctx.measureText(text).width;
}

/**
 * Calculate the width of text needed to fill a target width
 *
 * Useful for determining tab stops and alignment.
 */
export function calculateTextToWidth(
  text: string,
  targetWidth: number,
  formatting?: TextFormatting,
  theme?: Theme
): { charCount: number; actualWidth: number } {
  if (targetWidth <= 0 || !text) {
    return { charCount: 0, actualWidth: 0 };
  }

  const fullWidth = measureTextWidth(text, formatting, theme);
  if (fullWidth <= targetWidth) {
    return { charCount: text.length, actualWidth: fullWidth };
  }

  // Binary search for the right number of characters
  let low = 0;
  let high = text.length;
  let bestCount = 0;
  let bestWidth = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const substr = text.substring(0, mid);
    const width = measureTextWidth(substr, formatting, theme);

    if (width <= targetWidth) {
      bestCount = mid;
      bestWidth = width;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return { charCount: bestCount, actualWidth: bestWidth };
}
