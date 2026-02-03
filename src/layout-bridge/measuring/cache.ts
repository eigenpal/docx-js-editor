/**
 * Measurement Cache
 *
 * LRU cache for text width measurements and paragraph layout results.
 * Improves performance by avoiding repeated measurements of identical content.
 */

import type { ParagraphBlock, ParagraphMeasure } from '../../layout-engine/types';

// =============================================================================
// TEXT WIDTH CACHE
// =============================================================================

/**
 * Cache entry for text width measurements
 */
interface TextWidthEntry {
  width: number;
}

/**
 * Default max entries for text width cache
 * Typical documents contain thousands of unique text measurements
 */
const DEFAULT_TEXT_CACHE_SIZE = 5000;

/**
 * Current max size for text width cache
 */
let textCacheMaxSize = DEFAULT_TEXT_CACHE_SIZE;

/**
 * LRU cache for text width measurements
 * Key format: "text|font|letterSpacing"
 */
const textWidthCache = new Map<string, TextWidthEntry>();

/**
 * Create a cache key for text width lookup
 */
function makeTextKey(text: string, font: string, letterSpacing: number): string {
  return `${text}|${font}|${letterSpacing || 0}`;
}

/**
 * Evict oldest entries if cache exceeds max size
 */
function evictTextEntries(): void {
  while (textWidthCache.size > textCacheMaxSize) {
    const oldestKey = textWidthCache.keys().next().value;
    if (oldestKey === undefined) break;
    textWidthCache.delete(oldestKey);
  }
}

/**
 * Get cached text width or return undefined
 */
export function getCachedTextWidth(
  text: string,
  font: string,
  letterSpacing: number = 0
): number | undefined {
  const key = makeTextKey(text, font, letterSpacing);
  const entry = textWidthCache.get(key);

  if (entry !== undefined) {
    // Refresh LRU - move to end by re-inserting
    textWidthCache.delete(key);
    textWidthCache.set(key, entry);
    return entry.width;
  }

  return undefined;
}

/**
 * Store text width in cache
 */
export function setCachedTextWidth(
  text: string,
  font: string,
  letterSpacing: number,
  width: number
): void {
  const key = makeTextKey(text, font, letterSpacing);
  textWidthCache.set(key, { width });
  evictTextEntries();
}

/**
 * Clear the text width cache
 */
export function clearTextWidthCache(): void {
  textWidthCache.clear();
}

/**
 * Set the maximum size of the text width cache
 */
export function setTextCacheSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) {
    return;
  }
  textCacheMaxSize = size;
  evictTextEntries();
}

/**
 * Get current text width cache size
 */
export function getTextCacheSize(): number {
  return textWidthCache.size;
}

// =============================================================================
// FONT METRICS CACHE
// =============================================================================

/**
 * Cached font metrics entry
 */
interface FontMetricsEntry {
  ascent: number;
  descent: number;
  lineHeight: number;
}

/**
 * Default max entries for font metrics cache
 */
const DEFAULT_FONT_CACHE_SIZE = 1000;

/**
 * Current max size for font metrics cache
 */
let fontCacheMaxSize = DEFAULT_FONT_CACHE_SIZE;

/**
 * LRU cache for font metrics
 * Key format: "fontFamily|fontSize|bold|italic"
 */
const fontMetricsCache = new Map<string, FontMetricsEntry>();

/**
 * Create a cache key for font metrics lookup
 */
function makeFontKey(
  fontFamily: string,
  fontSize: number,
  bold: boolean = false,
  italic: boolean = false
): string {
  return `${fontFamily}|${fontSize}|${bold}|${italic}`;
}

/**
 * Evict oldest entries if font cache exceeds max size
 */
function evictFontEntries(): void {
  while (fontMetricsCache.size > fontCacheMaxSize) {
    const oldestKey = fontMetricsCache.keys().next().value;
    if (oldestKey === undefined) break;
    fontMetricsCache.delete(oldestKey);
  }
}

/**
 * Get cached font metrics or return undefined
 */
export function getCachedFontMetrics(
  fontFamily: string,
  fontSize: number,
  bold: boolean = false,
  italic: boolean = false
): FontMetricsEntry | undefined {
  const key = makeFontKey(fontFamily, fontSize, bold, italic);
  const entry = fontMetricsCache.get(key);

  if (entry !== undefined) {
    // Refresh LRU
    fontMetricsCache.delete(key);
    fontMetricsCache.set(key, entry);
    return entry;
  }

  return undefined;
}

/**
 * Store font metrics in cache
 */
export function setCachedFontMetrics(
  fontFamily: string,
  fontSize: number,
  bold: boolean,
  italic: boolean,
  metrics: FontMetricsEntry
): void {
  const key = makeFontKey(fontFamily, fontSize, bold, italic);
  fontMetricsCache.set(key, metrics);
  evictFontEntries();
}

/**
 * Clear the font metrics cache
 */
export function clearFontMetricsCache(): void {
  fontMetricsCache.clear();
}

/**
 * Set the maximum size of the font metrics cache
 */
export function setFontCacheSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) {
    return;
  }
  fontCacheMaxSize = size;
  evictFontEntries();
}

/**
 * Get current font metrics cache size
 */
export function getFontCacheSize(): number {
  return fontMetricsCache.size;
}

// =============================================================================
// PARAGRAPH MEASURE CACHE
// =============================================================================

/**
 * Cached paragraph measurement entry
 */
interface ParagraphMeasureEntry {
  measure: ParagraphMeasure;
  maxWidth: number;
}

/**
 * Default max entries for paragraph measure cache
 */
const DEFAULT_PARAGRAPH_CACHE_SIZE = 1000;

/**
 * Current max size for paragraph measure cache
 */
let paragraphCacheMaxSize = DEFAULT_PARAGRAPH_CACHE_SIZE;

/**
 * LRU cache for paragraph measurements
 * Key format: block content hash
 */
const paragraphMeasureCache = new Map<string, ParagraphMeasureEntry>();

/**
 * Generate a simple hash for a paragraph block
 * Used as cache key to identify identical content
 */
export function hashParagraphBlock(block: ParagraphBlock): string {
  // Simple hash based on runs content
  const parts: string[] = [];

  for (const run of block.runs) {
    if (run.kind === 'text') {
      parts.push(`t:${run.text}|${run.fontFamily}|${run.fontSize}|${run.bold}|${run.italic}`);
    } else if (run.kind === 'tab') {
      parts.push(`tab:${run.width}`);
    } else if (run.kind === 'image') {
      parts.push(`img:${run.width}x${run.height}`);
    } else if (run.kind === 'lineBreak') {
      parts.push('br');
    }
  }

  // Include relevant attrs in hash
  const attrs = block.attrs;
  if (attrs) {
    if (attrs.alignment) parts.push(`align:${attrs.alignment}`);
    if (attrs.indent) {
      parts.push(
        `indent:${attrs.indent.left}|${attrs.indent.right}|${attrs.indent.firstLine}|${attrs.indent.hanging}`
      );
    }
    if (attrs.spacing) {
      parts.push(
        `spacing:${attrs.spacing.before}|${attrs.spacing.after}|${attrs.spacing.line}|${attrs.spacing.lineRule}`
      );
    }
  }

  return parts.join('||');
}

/**
 * Evict oldest entries if paragraph cache exceeds max size
 */
function evictParagraphEntries(): void {
  while (paragraphMeasureCache.size > paragraphCacheMaxSize) {
    const oldestKey = paragraphMeasureCache.keys().next().value;
    if (oldestKey === undefined) break;
    paragraphMeasureCache.delete(oldestKey);
  }
}

/**
 * Get cached paragraph measurement or return undefined
 */
export function getCachedParagraphMeasure(
  block: ParagraphBlock,
  maxWidth: number
): ParagraphMeasure | undefined {
  const key = hashParagraphBlock(block);
  const entry = paragraphMeasureCache.get(key);

  if (entry !== undefined && entry.maxWidth === maxWidth) {
    // Refresh LRU
    paragraphMeasureCache.delete(key);
    paragraphMeasureCache.set(key, entry);
    return entry.measure;
  }

  return undefined;
}

/**
 * Store paragraph measurement in cache
 */
export function setCachedParagraphMeasure(
  block: ParagraphBlock,
  maxWidth: number,
  measure: ParagraphMeasure
): void {
  const key = hashParagraphBlock(block);
  paragraphMeasureCache.set(key, { measure, maxWidth });
  evictParagraphEntries();
}

/**
 * Clear the paragraph measure cache
 */
export function clearParagraphMeasureCache(): void {
  paragraphMeasureCache.clear();
}

/**
 * Set the maximum size of the paragraph measure cache
 */
export function setParagraphCacheSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) {
    return;
  }
  paragraphCacheMaxSize = size;
  evictParagraphEntries();
}

/**
 * Get current paragraph measure cache size
 */
export function getParagraphCacheSize(): number {
  return paragraphMeasureCache.size;
}

// =============================================================================
// GLOBAL CACHE MANAGEMENT
// =============================================================================

/**
 * Clear all measurement caches
 * Call when fonts change, page width changes, or for testing
 */
export function clearAllCaches(): void {
  clearTextWidthCache();
  clearFontMetricsCache();
  clearParagraphMeasureCache();
}

/**
 * Get total size of all caches
 */
export function getTotalCacheSize(): number {
  return getTextCacheSize() + getFontCacheSize() + getParagraphCacheSize();
}
