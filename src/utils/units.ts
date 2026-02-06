/**
 * Unit Conversion Utilities - Convert OOXML units to CSS/pixels
 *
 * OOXML uses various unit systems that need conversion for rendering:
 * - Twips: 1/20 of a point (1440 twips = 1 inch)
 * - EMUs (English Metric Units): 914400 EMUs = 1 inch
 * - Half-points: 1/2 of a point (144 half-points = 1 inch)
 * - Points: 72 points = 1 inch
 * - Eighths of a point: 1/8 of a point (576 eighths = 1 inch)
 *
 * Standard assumption: 96 DPI (pixels per inch)
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Standard DPI for screen rendering */
const STANDARD_DPI = 96;

/** Twips per inch (1 inch = 1440 twips) */
export const TWIPS_PER_INCH = 1440;

/** EMUs per inch (1 inch = 914400 EMUs) */
const EMUS_PER_INCH = 914400;

/** Points per inch (1 inch = 72 points) */
const POINTS_PER_INCH = 72;

/** Half-points per inch (1 inch = 144 half-points) */
const HALF_POINTS_PER_INCH = 144;

/** Eighths of a point per inch (1 inch = 576) */
const EIGHTHS_PER_INCH = 576;

/** Pixels per inch at standard DPI */
export const PIXELS_PER_INCH = STANDARD_DPI;

// ============================================================================
// TWIPS CONVERSIONS
// ============================================================================

/**
 * Convert twips to pixels (at 96 DPI)
 *
 * 1 inch = 1440 twips = 96 pixels
 * → 1 twip = 96/1440 pixels = 1/15 pixels
 */
export function twipsToPixels(twips: number): number {
  return (twips / TWIPS_PER_INCH) * PIXELS_PER_INCH;
}

/**
 * Convert pixels to twips
 */
export function pixelsToTwips(px: number): number {
  return (px / PIXELS_PER_INCH) * TWIPS_PER_INCH;
}

// ============================================================================
// EMU CONVERSIONS
// ============================================================================

/**
 * Convert EMUs to pixels (at 96 DPI)
 *
 * 1 inch = 914400 EMUs = 96 pixels
 */
export function emuToPixels(emu: number): number {
  return (emu / EMUS_PER_INCH) * PIXELS_PER_INCH;
}

/**
 * Convert pixels to EMUs
 */
export function pixelsToEmu(px: number): number {
  return (px / PIXELS_PER_INCH) * EMUS_PER_INCH;
}

/**
 * Convert EMUs to twips
 */
export function emuToTwips(emu: number): number {
  return (emu / EMUS_PER_INCH) * TWIPS_PER_INCH;
}

/**
 * Convert twips to EMUs
 */
export function twipsToEmu(twips: number): number {
  return (twips / TWIPS_PER_INCH) * EMUS_PER_INCH;
}

// ============================================================================
// POINT CONVERSIONS
// ============================================================================

/**
 * Convert points to pixels (at 96 DPI)
 *
 * 1 inch = 72 points = 96 pixels
 * → 1 point = 96/72 pixels = 4/3 pixels
 */
export function pointsToPixels(points: number): number {
  return (points / POINTS_PER_INCH) * PIXELS_PER_INCH;
}

// ============================================================================
// HALF-POINT CONVERSIONS
// ============================================================================

/**
 * Convert half-points to pixels (at 96 DPI)
 *
 * Half-points are commonly used for font sizes in OOXML (w:sz).
 */
export function halfPointsToPixels(halfPoints: number): number {
  return (halfPoints / HALF_POINTS_PER_INCH) * PIXELS_PER_INCH;
}

/**
 * Convert half-points to points
 */
export function halfPointsToPoints(halfPoints: number): number {
  return halfPoints / 2;
}

/**
 * Convert points to half-points
 */
export function pointsToHalfPoints(points: number): number {
  return points * 2;
}

// ============================================================================
// EIGHTHS OF A POINT CONVERSIONS
// ============================================================================

/**
 * Convert eighths of a point to pixels (at 96 DPI)
 *
 * Eighths of a point are used for border widths in OOXML.
 */
export function eighthsToPixels(eighths: number): number {
  return (eighths / EIGHTHS_PER_INCH) * PIXELS_PER_INCH;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Round a pixel value to avoid sub-pixel rendering issues
 */
export function roundPixels(px: number, decimalPlaces: number = 2): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(px * factor) / factor;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ============================================================================
// CSS VALUE FORMATTERS
// ============================================================================

/**
 * Format a pixel value as CSS string
 */
export function formatPx(px: number): string {
  return `${roundPixels(px)}px`;
}
