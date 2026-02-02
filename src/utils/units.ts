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
export const STANDARD_DPI = 96;

/** Twips per inch (1 inch = 1440 twips) */
export const TWIPS_PER_INCH = 1440;

/** EMUs per inch (1 inch = 914400 EMUs) */
export const EMUS_PER_INCH = 914400;

/** Points per inch (1 inch = 72 points) */
export const POINTS_PER_INCH = 72;

/** Half-points per inch (1 inch = 144 half-points) */
export const HALF_POINTS_PER_INCH = 144;

/** Eighths of a point per inch (1 inch = 576) */
export const EIGHTHS_PER_INCH = 576;

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
 *
 * @param twips - Value in twips (1/20 of a point)
 * @returns Value in pixels
 */
export function twipsToPixels(twips: number): number {
  return (twips / TWIPS_PER_INCH) * PIXELS_PER_INCH;
}

/**
 * Convert pixels to twips
 *
 * @param px - Value in pixels
 * @returns Value in twips
 */
export function pixelsToTwips(px: number): number {
  return (px / PIXELS_PER_INCH) * TWIPS_PER_INCH;
}

/**
 * Convert twips to points
 *
 * 1 point = 20 twips
 *
 * @param twips - Value in twips
 * @returns Value in points
 */
export function twipsToPoints(twips: number): number {
  return twips / 20;
}

/**
 * Convert points to twips
 *
 * @param points - Value in points
 * @returns Value in twips
 */
export function pointsToTwips(points: number): number {
  return points * 20;
}

/**
 * Convert twips to inches
 *
 * @param twips - Value in twips
 * @returns Value in inches
 */
export function twipsToInches(twips: number): number {
  return twips / TWIPS_PER_INCH;
}

/**
 * Convert inches to twips
 *
 * @param inches - Value in inches
 * @returns Value in twips
 */
export function inchesToTwips(inches: number): number {
  return inches * TWIPS_PER_INCH;
}

/**
 * Convert twips to centimeters
 *
 * @param twips - Value in twips
 * @returns Value in centimeters
 */
export function twipsToCm(twips: number): number {
  return twipsToInches(twips) * 2.54;
}

/**
 * Convert centimeters to twips
 *
 * @param cm - Value in centimeters
 * @returns Value in twips
 */
export function cmToTwips(cm: number): number {
  return inchesToTwips(cm / 2.54);
}

// ============================================================================
// EMU CONVERSIONS
// ============================================================================

/**
 * Convert EMUs to pixels (at 96 DPI)
 *
 * 1 inch = 914400 EMUs = 96 pixels
 * → 1 EMU = 96/914400 pixels
 *
 * @param emu - Value in EMUs (English Metric Units)
 * @returns Value in pixels
 */
export function emuToPixels(emu: number): number {
  return (emu / EMUS_PER_INCH) * PIXELS_PER_INCH;
}

/**
 * Convert pixels to EMUs
 *
 * @param px - Value in pixels
 * @returns Value in EMUs
 */
export function pixelsToEmu(px: number): number {
  return (px / PIXELS_PER_INCH) * EMUS_PER_INCH;
}

/**
 * Convert EMUs to points
 *
 * @param emu - Value in EMUs
 * @returns Value in points
 */
export function emuToPoints(emu: number): number {
  return (emu / EMUS_PER_INCH) * POINTS_PER_INCH;
}

/**
 * Convert points to EMUs
 *
 * @param points - Value in points
 * @returns Value in EMUs
 */
export function pointsToEmu(points: number): number {
  return (points / POINTS_PER_INCH) * EMUS_PER_INCH;
}

/**
 * Convert EMUs to inches
 *
 * @param emu - Value in EMUs
 * @returns Value in inches
 */
export function emuToInches(emu: number): number {
  return emu / EMUS_PER_INCH;
}

/**
 * Convert inches to EMUs
 *
 * @param inches - Value in inches
 * @returns Value in EMUs
 */
export function inchesToEmu(inches: number): number {
  return inches * EMUS_PER_INCH;
}

/**
 * Convert EMUs to centimeters
 *
 * @param emu - Value in EMUs
 * @returns Value in centimeters
 */
export function emuToCm(emu: number): number {
  return emuToInches(emu) * 2.54;
}

/**
 * Convert centimeters to EMUs
 *
 * @param cm - Value in centimeters
 * @returns Value in EMUs
 */
export function cmToEmu(cm: number): number {
  return inchesToEmu(cm / 2.54);
}

/**
 * Convert EMUs to twips
 *
 * @param emu - Value in EMUs
 * @returns Value in twips
 */
export function emuToTwips(emu: number): number {
  return (emu / EMUS_PER_INCH) * TWIPS_PER_INCH;
}

/**
 * Convert twips to EMUs
 *
 * @param twips - Value in twips
 * @returns Value in EMUs
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
 *
 * @param points - Value in points
 * @returns Value in pixels
 */
export function pointsToPixels(points: number): number {
  return (points / POINTS_PER_INCH) * PIXELS_PER_INCH;
}

/**
 * Convert pixels to points
 *
 * @param px - Value in pixels
 * @returns Value in points
 */
export function pixelsToPoints(px: number): number {
  return (px / PIXELS_PER_INCH) * POINTS_PER_INCH;
}

// ============================================================================
// HALF-POINT CONVERSIONS
// ============================================================================

/**
 * Convert half-points to pixels (at 96 DPI)
 *
 * 1 inch = 144 half-points = 96 pixels
 * → 1 half-point = 96/144 pixels = 2/3 pixels
 *
 * Half-points are commonly used for font sizes in OOXML (w:sz).
 *
 * @param halfPoints - Value in half-points
 * @returns Value in pixels
 */
export function halfPointsToPixels(halfPoints: number): number {
  return (halfPoints / HALF_POINTS_PER_INCH) * PIXELS_PER_INCH;
}

/**
 * Convert pixels to half-points
 *
 * @param px - Value in pixels
 * @returns Value in half-points
 */
export function pixelsToHalfPoints(px: number): number {
  return (px / PIXELS_PER_INCH) * HALF_POINTS_PER_INCH;
}

/**
 * Convert half-points to points
 *
 * @param halfPoints - Value in half-points
 * @returns Value in points
 */
export function halfPointsToPoints(halfPoints: number): number {
  return halfPoints / 2;
}

/**
 * Convert points to half-points
 *
 * @param points - Value in points
 * @returns Value in half-points
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
 * 1 inch = 576 eighths = 96 pixels
 * → 1 eighth = 96/576 pixels = 1/6 pixels
 *
 * Eighths of a point are used for border widths in OOXML.
 *
 * @param eighths - Value in eighths of a point
 * @returns Value in pixels
 */
export function eighthsToPixels(eighths: number): number {
  return (eighths / EIGHTHS_PER_INCH) * PIXELS_PER_INCH;
}

/**
 * Convert pixels to eighths of a point
 *
 * @param px - Value in pixels
 * @returns Value in eighths of a point
 */
export function pixelsToEighths(px: number): number {
  return (px / PIXELS_PER_INCH) * EIGHTHS_PER_INCH;
}

/**
 * Convert eighths of a point to points
 *
 * @param eighths - Value in eighths of a point
 * @returns Value in points
 */
export function eighthsToPoints(eighths: number): number {
  return eighths / 8;
}

/**
 * Convert points to eighths of a point
 *
 * @param points - Value in points
 * @returns Value in eighths of a point
 */
export function pointsToEighths(points: number): number {
  return points * 8;
}

// ============================================================================
// ANGLE CONVERSIONS
// ============================================================================

/**
 * Convert 60000ths of a degree to degrees
 *
 * OOXML uses 60000ths of a degree for rotation values.
 *
 * @param ooxml60000ths - Value in 60000ths of a degree
 * @returns Value in degrees
 */
export function ooxmlAngleToDegrees(ooxml60000ths: number): number {
  return ooxml60000ths / 60000;
}

/**
 * Convert degrees to 60000ths of a degree
 *
 * @param degrees - Value in degrees
 * @returns Value in 60000ths of a degree
 */
export function degreesToOoxmlAngle(degrees: number): number {
  return degrees * 60000;
}

/**
 * Convert degrees to radians
 *
 * @param degrees - Value in degrees
 * @returns Value in radians
 */
export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 *
 * @param radians - Value in radians
 * @returns Value in degrees
 */
export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

// ============================================================================
// PERCENTAGE CONVERSIONS
// ============================================================================

/**
 * Convert OOXML percentage (in 1000ths of a percent) to decimal
 *
 * OOXML uses 1000ths of a percent for some values (e.g., w:w for text scale)
 * e.g., 100000 = 100% = 1.0
 *
 * @param ooxml1000ths - Value in 1000ths of a percent
 * @returns Decimal value (1.0 = 100%)
 */
export function ooxmlPercentToDecimal(ooxml1000ths: number): number {
  return ooxml1000ths / 100000;
}

/**
 * Convert decimal to OOXML percentage (in 1000ths of a percent)
 *
 * @param decimal - Decimal value (1.0 = 100%)
 * @returns Value in 1000ths of a percent
 */
export function decimalToOoxmlPercent(decimal: number): number {
  return decimal * 100000;
}

/**
 * Convert OOXML percentage (in 1/50000ths) to decimal
 *
 * Some OOXML values use 1/50000ths (e.g., tint/shade)
 * e.g., 50000 = 100% = 1.0
 *
 * @param ooxml50000ths - Value in 1/50000ths
 * @returns Decimal value (1.0 = 100%)
 */
export function ooxmlPercent50000ToDecimal(ooxml50000ths: number): number {
  return ooxml50000ths / 50000;
}

/**
 * Convert decimal to OOXML percentage (in 1/50000ths)
 *
 * @param decimal - Decimal value (1.0 = 100%)
 * @returns Value in 1/50000ths
 */
export function decimalToOoxmlPercent50000(decimal: number): number {
  return decimal * 50000;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Round a pixel value to avoid sub-pixel rendering issues
 *
 * @param px - Value in pixels
 * @param decimalPlaces - Number of decimal places (default: 2)
 * @returns Rounded pixel value
 */
export function roundPixels(px: number, decimalPlaces: number = 2): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(px * factor) / factor;
}

/**
 * Convert a value and round to whole pixels
 *
 * @param value - Value to convert
 * @param converter - Conversion function
 * @returns Rounded pixel value
 */
export function toWholePixels(value: number, converter: (v: number) => number): number {
  return Math.round(converter(value));
}

/**
 * Clamp a value between min and max
 *
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ============================================================================
// CSS VALUE FORMATTERS
// ============================================================================

/**
 * Format a pixel value as CSS string
 *
 * @param px - Value in pixels
 * @returns CSS string (e.g., "16px")
 */
export function formatPx(px: number): string {
  return `${roundPixels(px)}px`;
}

/**
 * Format a point value as CSS string
 *
 * @param pt - Value in points
 * @returns CSS string (e.g., "12pt")
 */
export function formatPt(pt: number): string {
  return `${pt}pt`;
}

/**
 * Format twips as CSS pixel string
 *
 * @param twips - Value in twips
 * @returns CSS string (e.g., "96px")
 */
export function twipsToCss(twips: number): string {
  return formatPx(twipsToPixels(twips));
}

/**
 * Format EMUs as CSS pixel string
 *
 * @param emu - Value in EMUs
 * @returns CSS string (e.g., "96px")
 */
export function emuToCss(emu: number): string {
  return formatPx(emuToPixels(emu));
}

/**
 * Format half-points as CSS pixel string
 *
 * @param halfPoints - Value in half-points
 * @returns CSS string (e.g., "12px")
 */
export function halfPointsToCss(halfPoints: number): string {
  return formatPx(halfPointsToPixels(halfPoints));
}

/**
 * Format half-points as CSS pt string (for font sizes)
 *
 * @param halfPoints - Value in half-points
 * @returns CSS string (e.g., "12pt")
 */
export function halfPointsToPtCss(halfPoints: number): string {
  return formatPt(halfPointsToPoints(halfPoints));
}

// ============================================================================
// PAGE SIZE UTILITIES
// ============================================================================

/** Standard page sizes in twips */
export const PAGE_SIZES = {
  /** US Letter: 8.5" x 11" */
  LETTER: { width: 12240, height: 15840 },
  /** US Legal: 8.5" x 14" */
  LEGAL: { width: 12240, height: 20160 },
  /** A4: 210mm x 297mm */
  A4: { width: 11906, height: 16838 },
  /** A5: 148mm x 210mm */
  A5: { width: 8391, height: 11906 },
  /** Executive: 7.25" x 10.5" */
  EXECUTIVE: { width: 10440, height: 15120 },
} as const;

/**
 * Get page size in pixels
 *
 * @param width - Page width in twips
 * @param height - Page height in twips
 * @returns Object with width and height in pixels
 */
export function getPageSizePixels(
  width: number,
  height: number
): { width: number; height: number } {
  return {
    width: twipsToPixels(width),
    height: twipsToPixels(height),
  };
}

/**
 * Get standard page size by name
 *
 * @param name - Page size name ('LETTER', 'LEGAL', 'A4', 'A5', 'EXECUTIVE')
 * @returns Page dimensions in twips
 */
export function getStandardPageSize(name: keyof typeof PAGE_SIZES): {
  width: number;
  height: number;
} {
  return { ...PAGE_SIZES[name] };
}
