/**
 * Color Resolver - Convert OOXML colors to CSS
 *
 * Handles:
 * - Theme color references (accent1, dk1, etc.)
 * - RGB hex values
 * - "auto" colors (context-dependent)
 * - Tint/shade modifications
 *
 * OOXML Color References:
 * - w:color/@w:val - RGB hex or "auto"
 * - w:color/@w:themeColor - Theme color slot
 * - w:color/@w:themeTint - Tint modifier (0-255, hex)
 * - w:color/@w:themeShade - Shade modifier (0-255, hex)
 *
 * Tint/Shade Calculations:
 * - Tint makes color lighter (blend with white)
 * - Shade makes color darker (blend with black)
 * - Value is in hex (00-FF), converted to 0-1 for calculation
 */

import type { ColorValue, Theme, ThemeColorSlot, ThemeColorScheme } from '../types/document';

/**
 * Default theme colors (Office 2016 default theme)
 */
const DEFAULT_THEME_COLORS: ThemeColorScheme = {
  dk1: '000000',
  lt1: 'FFFFFF',
  dk2: '44546A',
  lt2: 'E7E6E6',
  accent1: '4472C4',
  accent2: 'ED7D31',
  accent3: 'A5A5A5',
  accent4: 'FFC000',
  accent5: '5B9BD5',
  accent6: '70AD47',
  hlink: '0563C1',
  folHlink: '954F72',
};

/**
 * Highlight color mapping to hex values
 * These are the W3C standard colors for Word highlighting
 */
const HIGHLIGHT_COLORS: Record<string, string> = {
  black: '000000',
  blue: '0000FF',
  cyan: '00FFFF',
  darkBlue: '00008B',
  darkCyan: '008B8B',
  darkGray: 'A9A9A9',
  darkGreen: '006400',
  darkMagenta: '8B008B',
  darkRed: '8B0000',
  darkYellow: '808000',
  green: '00FF00',
  lightGray: 'D3D3D3',
  magenta: 'FF00FF',
  red: 'FF0000',
  white: 'FFFFFF',
  yellow: 'FFFF00',
  none: '',
};

/**
 * Map alternative theme color names to standard slots
 * OOXML uses different names in different contexts
 */
const THEME_COLOR_ALIASES: Record<string, ThemeColorSlot> = {
  // Standard names
  dk1: 'dk1',
  lt1: 'lt1',
  dk2: 'dk2',
  lt2: 'lt2',
  accent1: 'accent1',
  accent2: 'accent2',
  accent3: 'accent3',
  accent4: 'accent4',
  accent5: 'accent5',
  accent6: 'accent6',
  hlink: 'hlink',
  folHlink: 'folHlink',
  // Alternative names used in some OOXML contexts
  dark1: 'dk1',
  light1: 'lt1',
  dark2: 'dk2',
  light2: 'lt2',
  hyperlink: 'hlink',
  followedHyperlink: 'folHlink',
  // Background/text names (map to dk1/lt1)
  background1: 'lt1',
  text1: 'dk1',
  background2: 'lt2',
  text2: 'dk2',
  tx1: 'dk1',
  tx2: 'dk2',
  bg1: 'lt1',
  bg2: 'lt2',
};

/**
 * Parse a hex color modifier value (tint or shade)
 * OOXML stores tint/shade as hex string (00-FF) representing 0-255
 *
 * @param hexValue - Hex string like "80" or "FF"
 * @returns Decimal value 0-1
 */
function parseModifierValue(hexValue: string | undefined): number {
  if (!hexValue) return 1;

  const parsed = parseInt(hexValue, 16);
  if (isNaN(parsed)) return 1;

  // Value is 0-255, convert to 0-1
  return parsed / 255;
}

/**
 * Parse RGB hex color to component values
 *
 * @param hex - 6-character hex color (no #)
 * @returns RGB object with r, g, b values 0-255
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Ensure 6 characters
  const normalized = hex.padStart(6, '0').slice(0, 6);

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  return {
    r: isNaN(r) ? 0 : r,
    g: isNaN(g) ? 0 : g,
    b: isNaN(b) ? 0 : b,
  };
}

/**
 * Convert RGB values to hex color
 *
 * @param r - Red 0-255
 * @param g - Green 0-255
 * @param b - Blue 0-255
 * @returns 6-character hex color (no #)
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');

  return `${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Convert RGB to HSL
 *
 * @param r - Red 0-255
 * @param g - Green 0-255
 * @param b - Blue 0-255
 * @returns HSL object with h (0-360), s (0-1), l (0-1)
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    case b:
      h = ((r - g) / d + 4) / 6;
      break;
    default:
      h = 0;
  }

  return { h: h * 360, s, l };
}

/**
 * Convert HSL to RGB
 *
 * @param h - Hue 0-360
 * @param s - Saturation 0-1
 * @param l - Lightness 0-1
 * @returns RGB object with r, g, b values 0-255
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = h / 360;

  if (s === 0) {
    const gray = Math.round(l * 255);
    return { r: gray, g: gray, b: gray };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * Apply tint to a color (make lighter by blending with white)
 *
 * OOXML tint algorithm:
 * - Converts to HSL
 * - Adjusts luminance: newLum = lum + (1 - lum) * tint
 *
 * @param hex - 6-character hex color (no #)
 * @param tint - Tint value 0-1 (0 = no change, 1 = fully white)
 * @returns Modified hex color
 */
function applyTint(hex: string, tint: number): string {
  if (tint <= 0 || tint >= 1) {
    return tint >= 1 ? 'FFFFFF' : hex;
  }

  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Apply tint: increase luminance toward white
  hsl.l = hsl.l + (1 - hsl.l) * tint;

  const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * Apply shade to a color (make darker by blending with black)
 *
 * OOXML shade algorithm:
 * - Converts to HSL
 * - Adjusts luminance: newLum = lum * shade
 *
 * @param hex - 6-character hex color (no #)
 * @param shade - Shade value 0-1 (0 = fully black, 1 = no change)
 * @returns Modified hex color
 */
function applyShade(hex: string, shade: number): string {
  if (shade <= 0 || shade >= 1) {
    return shade <= 0 ? '000000' : hex;
  }

  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Apply shade: decrease luminance toward black
  hsl.l = hsl.l * shade;

  const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * Get a theme color by slot name
 *
 * @param theme - Theme object
 * @param slot - Color slot name
 * @returns Hex color (6 characters, no #)
 */
function getThemeColorValue(theme: Theme | null | undefined, slot: ThemeColorSlot): string {
  // Map alias slots to actual color scheme keys
  const schemeKey = THEME_COLOR_ALIASES[slot] ?? slot;

  // Define the actual keys that exist on ThemeColorScheme
  const schemeKeys = [
    'dk1',
    'lt1',
    'dk2',
    'lt2',
    'accent1',
    'accent2',
    'accent3',
    'accent4',
    'accent5',
    'accent6',
    'hlink',
    'folHlink',
  ] as const;
  type SchemeKey = (typeof schemeKeys)[number];

  const isSchemeKey = (key: string): key is SchemeKey => schemeKeys.includes(key as SchemeKey);

  if (!theme?.colorScheme) {
    if (isSchemeKey(schemeKey)) {
      return DEFAULT_THEME_COLORS[schemeKey] ?? '000000';
    }
    return '000000';
  }

  if (isSchemeKey(schemeKey)) {
    return theme.colorScheme[schemeKey] ?? DEFAULT_THEME_COLORS[schemeKey] ?? '000000';
  }

  return '000000';
}

/**
 * Resolve a theme color name to a standard slot
 *
 * @param colorName - Theme color name (could be alias)
 * @returns Standard ThemeColorSlot or null if unknown
 */
function resolveThemeColorSlot(colorName: string): ThemeColorSlot | null {
  if (!colorName) return null;

  const normalized = colorName.toLowerCase();
  const slot = THEME_COLOR_ALIASES[colorName] ?? THEME_COLOR_ALIASES[normalized];

  return slot ?? null;
}

/**
 * Resolve a ColorValue to a CSS color string
 *
 * @param color - ColorValue object with rgb, themeColor, tint/shade, or auto
 * @param theme - Theme for resolving theme colors
 * @param defaultColor - Default color if auto or undefined (default: black)
 * @returns CSS color string (e.g., "#FF0000" or "inherit")
 */
export function resolveColor(
  color: ColorValue | undefined | null,
  theme: Theme | null | undefined,
  defaultColor: string = '000000'
): string {
  if (!color) {
    return `#${defaultColor}`;
  }

  // Handle "auto" color
  if (color.auto) {
    // Auto typically means black for text, but can be context-dependent
    return `#${defaultColor}`;
  }

  let hexColor: string;

  // Check for theme color first
  if (color.themeColor) {
    const slot = resolveThemeColorSlot(color.themeColor);
    if (slot) {
      hexColor = getThemeColorValue(theme, slot);
    } else {
      // Unknown theme color, use RGB if available or default
      hexColor = color.rgb ?? defaultColor;
    }

    // Apply tint/shade modifiers
    if (color.themeTint) {
      const tintValue = parseModifierValue(color.themeTint);
      hexColor = applyTint(hexColor, tintValue);
    } else if (color.themeShade) {
      const shadeValue = parseModifierValue(color.themeShade);
      hexColor = applyShade(hexColor, shadeValue);
    }
  } else if (color.rgb) {
    // Direct RGB value
    hexColor = color.rgb;
  } else {
    // No color specified
    hexColor = defaultColor;
  }

  // Ensure proper format
  return `#${hexColor.toUpperCase().replace(/^#/, '')}`;
}

/**
 * Resolve a highlight color name to CSS
 *
 * @param highlight - Highlight color name (e.g., "yellow", "cyan")
 * @returns CSS color string or empty string for "none"
 */
export function resolveHighlightColor(highlight: string | undefined): string {
  if (!highlight || highlight === 'none') {
    return '';
  }

  const hex = HIGHLIGHT_COLORS[highlight];
  return hex ? `#${hex}` : '';
}

/**
 * Resolve a shading fill or pattern color to CSS
 *
 * @param color - ColorValue for fill
 * @param theme - Theme for resolving theme colors
 * @returns CSS color string
 */
export function resolveShadingColor(
  color: ColorValue | undefined | null,
  theme: Theme | null | undefined
): string {
  if (!color) return '';

  // For shading, "auto" typically means transparent
  if (color.auto) {
    return 'transparent';
  }

  return resolveColor(color, theme);
}

/**
 * Check if a color is effectively black
 *
 * @param color - ColorValue object
 * @param theme - Theme for resolving theme colors
 * @returns True if color resolves to black or very dark
 */
export function isBlack(
  color: ColorValue | undefined | null,
  theme: Theme | null | undefined
): boolean {
  if (!color) return false;
  if (color.auto) return true;

  const resolved = resolveColor(color, theme);
  const hex = resolved.replace(/^#/, '').toLowerCase();

  // Check if it's black or very dark
  const rgb = hexToRgb(hex);
  const luminance = (rgb.r + rgb.g + rgb.b) / 3;

  return luminance < 20;
}

/**
 * Check if a color is effectively white
 *
 * @param color - ColorValue object
 * @param theme - Theme for resolving theme colors
 * @returns True if color resolves to white or very light
 */
export function isWhite(
  color: ColorValue | undefined | null,
  theme: Theme | null | undefined
): boolean {
  if (!color) return false;

  const resolved = resolveColor(color, theme);
  const hex = resolved.replace(/^#/, '').toLowerCase();

  // Check if it's white or very light
  const rgb = hexToRgb(hex);
  const luminance = (rgb.r + rgb.g + rgb.b) / 3;

  return luminance > 235;
}

/**
 * Get contrasting text color for a background
 *
 * @param backgroundColor - Background ColorValue
 * @param theme - Theme for resolving theme colors
 * @returns Black or white hex color for best contrast
 */
export function getContrastingColor(
  backgroundColor: ColorValue | undefined | null,
  theme: Theme | null | undefined
): string {
  if (!backgroundColor) return '#000000';

  const bgResolved = resolveColor(backgroundColor, theme);
  const bgHex = bgResolved.replace(/^#/, '');
  const bgRgb = hexToRgb(bgHex);

  // Calculate relative luminance using sRGB formula
  const luminance = (0.299 * bgRgb.r + 0.587 * bgRgb.g + 0.114 * bgRgb.b) / 255;

  // Return black for light backgrounds, white for dark
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Parse a color string (various formats) to ColorValue
 *
 * @param colorString - Color string like "FF0000", "auto", or theme color name
 * @returns ColorValue object
 */
export function parseColorString(colorString: string | undefined): ColorValue | undefined {
  if (!colorString) return undefined;

  const normalized = colorString.trim();

  if (normalized.toLowerCase() === 'auto') {
    return { auto: true };
  }

  // Check if it's a theme color name
  const themeSlot = resolveThemeColorSlot(normalized);
  if (themeSlot) {
    return { themeColor: themeSlot };
  }

  // Assume it's an RGB hex value
  // Remove # if present and normalize to 6 chars
  const hex = normalized.replace(/^#/, '').toUpperCase();

  // Validate hex format
  if (/^[0-9A-F]{6}$/i.test(hex)) {
    return { rgb: hex };
  }

  // 3-character shorthand
  if (/^[0-9A-F]{3}$/i.test(hex)) {
    const expanded = hex
      .split('')
      .map((c) => c + c)
      .join('');
    return { rgb: expanded };
  }

  // Unknown format, return as RGB anyway
  return { rgb: hex.padStart(6, '0').slice(0, 6) };
}

/**
 * Create a ColorValue from theme color reference
 *
 * @param themeColor - Theme color slot name
 * @param tint - Optional tint modifier
 * @param shade - Optional shade modifier
 * @returns ColorValue object
 */
export function createThemeColor(
  themeColor: ThemeColorSlot,
  tint?: number,
  shade?: number
): ColorValue {
  const result: ColorValue = { themeColor };

  if (tint !== undefined && tint > 0 && tint < 1) {
    result.themeTint = Math.round(tint * 255)
      .toString(16)
      .toUpperCase()
      .padStart(2, '0');
  }

  if (shade !== undefined && shade > 0 && shade < 1) {
    result.themeShade = Math.round(shade * 255)
      .toString(16)
      .toUpperCase()
      .padStart(2, '0');
  }

  return result;
}

/**
 * Create a ColorValue from RGB hex
 *
 * @param hex - 6-character hex color (no #)
 * @returns ColorValue object
 */
export function createRgbColor(hex: string): ColorValue {
  return { rgb: hex.replace(/^#/, '').toUpperCase() };
}

/**
 * Darken a color by a percentage
 *
 * @param color - ColorValue to darken
 * @param theme - Theme for resolving
 * @param percent - Percentage to darken (0-100)
 * @returns CSS color string
 */
export function darkenColor(
  color: ColorValue | undefined | null,
  theme: Theme | null | undefined,
  percent: number
): string {
  const resolved = resolveColor(color, theme);
  const hex = resolved.replace(/^#/, '');
  const shade = 1 - percent / 100;
  return `#${applyShade(hex, shade)}`;
}

/**
 * Lighten a color by a percentage
 *
 * @param color - ColorValue to lighten
 * @param theme - Theme for resolving
 * @param percent - Percentage to lighten (0-100)
 * @returns CSS color string
 */
export function lightenColor(
  color: ColorValue | undefined | null,
  theme: Theme | null | undefined,
  percent: number
): string {
  const resolved = resolveColor(color, theme);
  const hex = resolved.replace(/^#/, '');
  const tint = percent / 100;
  return `#${applyTint(hex, tint)}`;
}

/**
 * Blend two colors together
 *
 * @param color1 - First color
 * @param color2 - Second color
 * @param ratio - Blend ratio (0 = all color1, 1 = all color2)
 * @param theme - Theme for resolving
 * @returns CSS color string
 */
export function blendColors(
  color1: ColorValue | undefined | null,
  color2: ColorValue | undefined | null,
  ratio: number,
  theme: Theme | null | undefined
): string {
  const resolved1 = resolveColor(color1, theme).replace(/^#/, '');
  const resolved2 = resolveColor(color2, theme).replace(/^#/, '');

  const rgb1 = hexToRgb(resolved1);
  const rgb2 = hexToRgb(resolved2);

  const blended = {
    r: Math.round(rgb1.r * (1 - ratio) + rgb2.r * ratio),
    g: Math.round(rgb1.g * (1 - ratio) + rgb2.g * ratio),
    b: Math.round(rgb1.b * (1 - ratio) + rgb2.b * ratio),
  };

  return `#${rgbToHex(blended.r, blended.g, blended.b)}`;
}

/**
 * Get opacity from a color (for future alpha channel support)
 *
 * @param color - ColorValue with potential alpha
 * @returns Opacity value 0-1
 */
export function getColorOpacity(_color: ColorValue | undefined | null): number {
  // OOXML colors don't typically have alpha in ColorValue
  // This is a placeholder for future extension
  return 1;
}

/**
 * Check if two colors are equal
 *
 * @param color1 - First color
 * @param color2 - Second color
 * @param theme - Theme for resolving
 * @returns True if colors resolve to the same value
 */
export function colorsEqual(
  color1: ColorValue | undefined | null,
  color2: ColorValue | undefined | null,
  theme: Theme | null | undefined
): boolean {
  if (!color1 && !color2) return true;
  if (!color1 || !color2) return false;

  const resolved1 = resolveColor(color1, theme).toUpperCase();
  const resolved2 = resolveColor(color2, theme).toUpperCase();

  return resolved1 === resolved2;
}
