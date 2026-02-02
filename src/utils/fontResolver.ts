/**
 * Font Family Resolver
 *
 * Maps DOCX font names to Google Fonts equivalents with proper CSS fallback stacks.
 *
 * DOCX files often use fonts that aren't freely available (Calibri, Cambria, etc.)
 * This module provides mappings to metrically-compatible Google Fonts alternatives.
 */

import type { ThemeFontScheme, ThemeFont } from '../types';

/**
 * Result of resolving a font family
 */
export interface ResolvedFont {
  /** Google Font name to load (null if no mapping available) */
  googleFont: string | null;
  /** CSS font-family value with proper fallback stack */
  cssFallback: string;
  /** Original font name from the DOCX */
  originalFont: string;
  /** Whether this font has a Google Fonts equivalent */
  hasGoogleEquivalent: boolean;
}

/**
 * Font category for fallback selection
 */
type FontCategory = 'sans-serif' | 'serif' | 'monospace' | 'cursive' | 'fantasy' | 'system-ui';

/**
 * Font mapping entry
 */
interface FontMapping {
  googleFont: string;
  category: FontCategory;
  fallbackStack: string[];
}

/**
 * Mapping of common DOCX fonts to Google Fonts equivalents
 *
 * These are metrically compatible fonts that preserve document layout.
 * See: https://wiki.archlinux.org/title/Metric-compatible_fonts
 */
const FONT_MAPPINGS: Record<string, FontMapping> = {
  // Microsoft Office fonts -> Google equivalents (via Croscore)
  calibri: {
    googleFont: 'Carlito',
    category: 'sans-serif',
    fallbackStack: ['Carlito', 'Calibri', 'Arial', 'Helvetica', 'sans-serif'],
  },
  cambria: {
    googleFont: 'Caladea',
    category: 'serif',
    fallbackStack: ['Caladea', 'Cambria', 'Georgia', 'serif'],
  },
  arial: {
    googleFont: 'Arimo',
    category: 'sans-serif',
    fallbackStack: ['Arimo', 'Arial', 'Helvetica', 'sans-serif'],
  },
  'times new roman': {
    googleFont: 'Tinos',
    category: 'serif',
    fallbackStack: ['Tinos', 'Times New Roman', 'Times', 'serif'],
  },
  'courier new': {
    googleFont: 'Cousine',
    category: 'monospace',
    fallbackStack: ['Cousine', 'Courier New', 'Courier', 'monospace'],
  },

  // Additional common fonts
  georgia: {
    googleFont: 'Tinos', // Similar but not perfect match
    category: 'serif',
    fallbackStack: ['Georgia', 'Tinos', 'Times New Roman', 'serif'],
  },
  verdana: {
    googleFont: 'Open Sans', // Similar sans-serif
    category: 'sans-serif',
    fallbackStack: ['Verdana', 'Open Sans', 'Arial', 'sans-serif'],
  },
  tahoma: {
    googleFont: 'Open Sans',
    category: 'sans-serif',
    fallbackStack: ['Tahoma', 'Open Sans', 'Arial', 'sans-serif'],
  },
  'trebuchet ms': {
    googleFont: 'Fira Sans',
    category: 'sans-serif',
    fallbackStack: ['Trebuchet MS', 'Fira Sans', 'Arial', 'sans-serif'],
  },
  'comic sans ms': {
    googleFont: 'Comic Neue',
    category: 'cursive',
    fallbackStack: ['Comic Sans MS', 'Comic Neue', 'cursive'],
  },
  impact: {
    googleFont: 'Anton',
    category: 'sans-serif',
    fallbackStack: ['Impact', 'Anton', 'Arial Black', 'sans-serif'],
  },
  'palatino linotype': {
    googleFont: 'EB Garamond',
    category: 'serif',
    fallbackStack: ['Palatino Linotype', 'EB Garamond', 'Palatino', 'Georgia', 'serif'],
  },
  'book antiqua': {
    googleFont: 'EB Garamond',
    category: 'serif',
    fallbackStack: ['Book Antiqua', 'EB Garamond', 'Palatino', 'Georgia', 'serif'],
  },
  garamond: {
    googleFont: 'EB Garamond',
    category: 'serif',
    fallbackStack: ['Garamond', 'EB Garamond', 'Georgia', 'serif'],
  },
  'century gothic': {
    googleFont: 'Questrial',
    category: 'sans-serif',
    fallbackStack: ['Century Gothic', 'Questrial', 'Arial', 'sans-serif'],
  },
  'lucida sans': {
    googleFont: 'Open Sans',
    category: 'sans-serif',
    fallbackStack: ['Lucida Sans', 'Open Sans', 'Arial', 'sans-serif'],
  },
  'lucida console': {
    googleFont: 'Cousine',
    category: 'monospace',
    fallbackStack: ['Lucida Console', 'Cousine', 'Courier New', 'monospace'],
  },
  consolas: {
    googleFont: 'Inconsolata',
    category: 'monospace',
    fallbackStack: ['Consolas', 'Inconsolata', 'Cousine', 'Courier New', 'monospace'],
  },

  // CJK fonts
  'ms mincho': {
    googleFont: 'Noto Serif JP',
    category: 'serif',
    fallbackStack: ['MS Mincho', 'Noto Serif JP', 'serif'],
  },
  'ms gothic': {
    googleFont: 'Noto Sans JP',
    category: 'sans-serif',
    fallbackStack: ['MS Gothic', 'Noto Sans JP', 'sans-serif'],
  },
  simhei: {
    googleFont: 'Noto Sans SC',
    category: 'sans-serif',
    fallbackStack: ['SimHei', 'Noto Sans SC', 'sans-serif'],
  },
  simsun: {
    googleFont: 'Noto Serif SC',
    category: 'serif',
    fallbackStack: ['SimSun', 'Noto Serif SC', 'serif'],
  },
  'malgun gothic': {
    googleFont: 'Noto Sans KR',
    category: 'sans-serif',
    fallbackStack: ['Malgun Gothic', 'Noto Sans KR', 'sans-serif'],
  },
};

/**
 * Default fallback stacks by category
 */
const DEFAULT_FALLBACKS: Record<FontCategory, string> = {
  'sans-serif': 'Arial, Helvetica, sans-serif',
  serif: 'Times New Roman, Times, serif',
  monospace: 'Courier New, Courier, monospace',
  cursive: 'cursive',
  fantasy: 'fantasy',
  'system-ui': 'system-ui, sans-serif',
};

/**
 * Detect font category from font name
 */
function detectFontCategory(fontName: string): FontCategory {
  const lower = fontName.toLowerCase();

  // Monospace indicators
  if (
    lower.includes('mono') ||
    lower.includes('courier') ||
    lower.includes('consolas') ||
    lower.includes('console') ||
    lower.includes('code') ||
    lower.includes('terminal')
  ) {
    return 'monospace';
  }

  // Serif indicators
  if (
    lower.includes('times') ||
    lower.includes('georgia') ||
    lower.includes('garamond') ||
    lower.includes('palatino') ||
    lower.includes('baskerville') ||
    lower.includes('bodoni') ||
    lower.includes('cambria') ||
    lower.includes('mincho') ||
    lower.includes('ming') ||
    lower.includes('song') ||
    lower.includes('serif')
  ) {
    return 'serif';
  }

  // Cursive/script indicators
  if (
    lower.includes('script') ||
    lower.includes('cursive') ||
    lower.includes('comic') ||
    lower.includes('brush') ||
    lower.includes('hand')
  ) {
    return 'cursive';
  }

  // Default to sans-serif
  return 'sans-serif';
}

/**
 * Resolve a DOCX font name to a Google Font and CSS fallback stack
 *
 * @param docxFontName - The font name from the DOCX file
 * @returns Resolved font information
 */
export function resolveFontFamily(docxFontName: string): ResolvedFont {
  const normalizedName = docxFontName.trim().toLowerCase();

  // Check if we have a direct mapping
  const mapping = FONT_MAPPINGS[normalizedName];

  if (mapping) {
    return {
      googleFont: mapping.googleFont,
      cssFallback: mapping.fallbackStack.map(quoteFontName).join(', '),
      originalFont: docxFontName,
      hasGoogleEquivalent: true,
    };
  }

  // No mapping - detect category and create fallback
  const category = detectFontCategory(docxFontName);
  const defaultFallback = DEFAULT_FALLBACKS[category];

  return {
    googleFont: null,
    cssFallback: `${quoteFontName(docxFontName)}, ${defaultFallback}`,
    originalFont: docxFontName,
    hasGoogleEquivalent: false,
  };
}

/**
 * Quote a font name if it contains spaces or special characters
 */
function quoteFontName(fontName: string): string {
  // If it's a generic family, don't quote
  if (
    ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'].includes(
      fontName.toLowerCase()
    )
  ) {
    return fontName;
  }

  // Quote if contains spaces or special characters
  if (/[\s,'"()]/.test(fontName)) {
    return `"${fontName.replace(/"/g, '\\"')}"`;
  }

  return fontName;
}

/**
 * Resolve a theme font reference to actual font names
 *
 * @param themeRef - Theme font reference (e.g., 'majorAscii', 'minorHAnsi')
 * @param fontScheme - Theme font scheme from the DOCX
 * @returns Resolved font name or null if not found
 */
export function resolveThemeFont(themeRef: string, fontScheme?: ThemeFontScheme): string | null {
  if (!fontScheme) {
    return null;
  }

  // Parse the theme reference
  const isMajor = themeRef.toLowerCase().startsWith('major');
  const themeFont: ThemeFont | undefined = isMajor ? fontScheme.majorFont : fontScheme.minorFont;

  if (!themeFont) {
    return null;
  }

  // Determine which script variant to use
  const ref = themeRef.toLowerCase();

  if (ref.includes('eastasia') || ref.includes('ea')) {
    return themeFont.ea ?? themeFont.latin ?? null;
  }

  if (ref.includes('cs') || ref.includes('bidi')) {
    return themeFont.cs ?? themeFont.latin ?? null;
  }

  // Default to Latin/Western font
  return themeFont.latin ?? null;
}

/**
 * Get all Google Font names needed for a list of DOCX fonts
 *
 * @param docxFonts - Array of font names from the DOCX
 * @returns Array of Google Font names to load
 */
export function getGoogleFontsToLoad(docxFonts: string[]): string[] {
  const googleFonts = new Set<string>();

  for (const font of docxFonts) {
    const resolved = resolveFontFamily(font);
    if (resolved.googleFont) {
      googleFonts.add(resolved.googleFont);
    }
  }

  return Array.from(googleFonts);
}

/**
 * Build a CSS font-family string from an array of font names
 *
 * @param fonts - Array of font names
 * @param category - Fallback category
 * @returns CSS font-family value
 */
export function buildFontFamilyString(
  fonts: string[],
  category: FontCategory = 'sans-serif'
): string {
  const quoted = fonts.map(quoteFontName);

  // Ensure we have the generic fallback
  const parts = [...quoted];
  if (!parts.some((p) => p.toLowerCase() === category)) {
    parts.push(category);
  }

  return parts.join(', ');
}

/**
 * Get the Google Font equivalent for a DOCX font (if any)
 *
 * @param docxFontName - The font name from the DOCX file
 * @returns Google Font name or null
 */
export function getGoogleFontEquivalent(docxFontName: string): string | null {
  const normalizedName = docxFontName.trim().toLowerCase();
  const mapping = FONT_MAPPINGS[normalizedName];
  return mapping?.googleFont ?? null;
}

/**
 * Check if a font has a known Google Fonts equivalent
 *
 * @param docxFontName - The font name from the DOCX file
 * @returns true if there's a Google Fonts equivalent
 */
export function hasGoogleFontEquivalent(docxFontName: string): boolean {
  const normalizedName = docxFontName.trim().toLowerCase();
  return normalizedName in FONT_MAPPINGS;
}
