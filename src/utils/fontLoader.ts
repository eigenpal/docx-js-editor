/**
 * Google Fonts Loader
 *
 * Dynamically loads fonts from Google Fonts API with:
 * - Loading state tracking
 * - Duplicate prevention
 * - Callback notifications
 * - Font availability detection
 */

// Track loaded fonts to avoid duplicate requests
const loadedFonts = new Set<string>();

// Track fonts currently being loaded
const loadingFonts = new Map<string, Promise<boolean>>();

// Callbacks to notify when fonts are loaded
const loadCallbacks = new Set<(fonts: string[]) => void>();

// Track overall loading state
let isLoadingAny = false;

/**
 * Generate Google Fonts CSS URL for a font family
 *
 * @param fontFamily - The font family name (e.g., "Roboto", "Open Sans")
 * @param weights - Font weights to load (default: 400, 700)
 * @param styles - Font styles to load (default: normal, italic)
 * @returns Google Fonts CSS URL
 */
function getGoogleFontsUrl(
  fontFamily: string,
  weights: number[] = [400, 700],
  styles: ('normal' | 'italic')[] = ['normal', 'italic']
): string {
  // Encode font family name for URL
  const encodedFamily = encodeURIComponent(fontFamily);

  // Build weight/style combinations
  // Format: ital,wght@0,400;0,700;1,400;1,700
  const combinations: string[] = [];

  for (const style of styles) {
    const italVal = style === 'italic' ? 1 : 0;
    for (const weight of weights) {
      combinations.push(`${italVal},${weight}`);
    }
  }

  // Sort and join
  combinations.sort();
  const spec = combinations.join(';');

  return `https://fonts.googleapis.com/css2?family=${encodedFamily}:ital,wght@${spec}&display=swap`;
}

/**
 * Load a font from Google Fonts
 *
 * @param fontFamily - The font family name to load
 * @param options - Optional configuration
 * @returns Promise resolving to true if font loaded successfully, false otherwise
 */
export async function loadFont(
  fontFamily: string,
  options?: {
    weights?: number[];
    styles?: ('normal' | 'italic')[];
  }
): Promise<boolean> {
  // Normalize font family name
  const normalizedFamily = fontFamily.trim();

  // Already loaded?
  if (loadedFonts.has(normalizedFamily)) {
    return true;
  }

  // Currently loading? Return existing promise
  const existingLoad = loadingFonts.get(normalizedFamily);
  if (existingLoad) {
    return existingLoad;
  }

  // Create load promise
  const loadPromise = (async (): Promise<boolean> => {
    isLoadingAny = true;

    try {
      // Generate Google Fonts URL
      const url = getGoogleFontsUrl(normalizedFamily, options?.weights, options?.styles);

      // Create link element
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;

      // Wait for load or error
      const loaded = await new Promise<boolean>((resolve) => {
        link.onload = () => resolve(true);
        link.onerror = () => resolve(false);

        // Append to head
        document.head.appendChild(link);

        // Timeout after 5 seconds
        setTimeout(() => resolve(false), 5000);
      });

      if (loaded) {
        // Wait a bit for the font to be available
        await waitForFontAvailable(normalizedFamily, 3000);

        loadedFonts.add(normalizedFamily);

        // Notify callbacks
        notifyCallbacks([normalizedFamily]);

        return true;
      }

      return false;
    } catch (error) {
      console.warn(`Failed to load font "${normalizedFamily}":`, error);
      return false;
    } finally {
      loadingFonts.delete(normalizedFamily);

      // Check if still loading any fonts
      if (loadingFonts.size === 0) {
        isLoadingAny = false;
      }
    }
  })();

  loadingFonts.set(normalizedFamily, loadPromise);
  return loadPromise;
}

/**
 * Load multiple fonts from Google Fonts
 *
 * @param families - Array of font family names to load
 * @param options - Optional configuration
 * @returns Promise resolving when all fonts are loaded (or failed)
 */
export async function loadFonts(
  families: string[],
  options?: {
    weights?: number[];
    styles?: ('normal' | 'italic')[];
  }
): Promise<void> {
  // Filter out already loaded fonts
  const toLoad = families.filter((family) => !loadedFonts.has(family.trim()));

  if (toLoad.length === 0) {
    return;
  }

  // Load all fonts in parallel
  await Promise.all(toLoad.map((family) => loadFont(family, options)));
}

/**
 * Check if a font is loaded
 *
 * @param fontFamily - The font family name to check
 * @returns true if the font is loaded, false otherwise
 */
export function isFontLoaded(fontFamily: string): boolean {
  return loadedFonts.has(fontFamily.trim());
}

/**
 * Check if any fonts are currently loading
 *
 * @returns true if any fonts are loading, false otherwise
 */
export function isLoading(): boolean {
  return isLoadingAny;
}

/**
 * Get list of all loaded fonts
 *
 * @returns Array of loaded font family names
 */
export function getLoadedFonts(): string[] {
  return Array.from(loadedFonts);
}

/**
 * Register a callback to be notified when fonts are loaded
 *
 * @param callback - Function to call when fonts are loaded
 * @returns Cleanup function to remove the callback
 */
export function onFontsLoaded(callback: (fonts: string[]) => void): () => void {
  loadCallbacks.add(callback);

  // Return cleanup function
  return () => {
    loadCallbacks.delete(callback);
  };
}

/**
 * Notify all registered callbacks
 */
function notifyCallbacks(fonts: string[]): void {
  for (const callback of loadCallbacks) {
    try {
      callback(fonts);
    } catch (error) {
      console.warn('Font load callback error:', error);
    }
  }
}

/**
 * Wait for a font to be available using the CSS Font Loading API
 *
 * @param fontFamily - The font family to wait for
 * @param timeout - Maximum time to wait in milliseconds
 * @returns Promise resolving when font is available or timeout
 */
async function waitForFontAvailable(fontFamily: string, timeout: number): Promise<boolean> {
  // Use CSS Font Loading API if available
  if ('fonts' in document) {
    try {
      // Try to wait for the font
      const fontFace = `400 16px "${fontFamily}"`;
      await Promise.race([
        document.fonts.load(fontFace),
        new Promise((resolve) => setTimeout(resolve, timeout)),
      ]);

      return document.fonts.check(fontFace);
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback: just wait a bit
  await new Promise((resolve) => setTimeout(resolve, 100));
  return true;
}

/**
 * Check if a font is available on the system using canvas measurement
 *
 * This uses the technique of comparing text width with the target font
 * vs a known fallback font. If they differ, the font is available.
 *
 * @param fontFamily - The font family name to check
 * @param fallbackFont - Fallback font to compare against
 * @returns true if font is available, false otherwise
 */
export function canRenderFont(fontFamily: string, fallbackFont: string = 'sans-serif'): boolean {
  // Skip if we're not in a browser
  if (typeof document === 'undefined') {
    return false;
  }

  const _canRenderFont = (fontName: string, fallback: string): boolean => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return false;
    }

    ctx.textBaseline = 'top';

    const text = 'abcdefghijklmnopqrstuvwxyz0123456789';

    // Measure with fallback font only
    ctx.font = `72px ${fallback}`;
    const fallbackWidth = ctx.measureText(text).width;

    // Measure with target font (with fallback)
    ctx.font = `72px "${fontName}", ${fallback}`;
    const customWidth = ctx.measureText(text).width;

    // If widths differ, the custom font was used
    return customWidth !== fallbackWidth;
  };

  // Check with primary fallback
  if (_canRenderFont(fontFamily, fallbackFont)) {
    return true;
  }

  // Check with opposite fallback (handles edge case where font name
  // matches the browser's default sans-serif or serif)
  const oppositeFallback = fallbackFont === 'sans-serif' ? 'serif' : 'sans-serif';
  return _canRenderFont(fontFamily, oppositeFallback);
}

/**
 * Load a font from a raw buffer (e.g., embedded in DOCX)
 *
 * @param fontFamily - The font family name
 * @param buffer - Font file buffer (TTF, OTF, WOFF, WOFF2)
 * @param options - Font options
 * @returns Promise resolving when font is loaded
 */
export async function loadFontFromBuffer(
  fontFamily: string,
  buffer: ArrayBuffer,
  options?: {
    weight?: number | string;
    style?: 'normal' | 'italic';
  }
): Promise<boolean> {
  const normalizedFamily = fontFamily.trim();

  // Already loaded?
  if (loadedFonts.has(normalizedFamily)) {
    return true;
  }

  try {
    // Create blob URL
    const blob = new Blob([buffer], { type: 'font/ttf' });
    const url = URL.createObjectURL(blob);

    // Create @font-face CSS
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: "${normalizedFamily}";
        src: url(${url}) format('truetype');
        font-weight: ${options?.weight ?? 'normal'};
        font-style: ${options?.style ?? 'normal'};
        font-display: swap;
      }
    `;

    document.head.appendChild(style);

    // Wait for font to be available
    await waitForFontAvailable(normalizedFamily, 3000);

    loadedFonts.add(normalizedFamily);
    notifyCallbacks([normalizedFamily]);

    return true;
  } catch (error) {
    console.warn(`Failed to load font "${normalizedFamily}" from buffer:`, error);
    return false;
  }
}

/**
 * Mapping from common Office/system fonts to Google Fonts equivalents
 *
 * Google Fonts doesn't have exact matches for many Microsoft fonts,
 * but these are close alternatives that work well for document rendering.
 */
export const FONT_MAPPING: Record<string, string> = {
  // Microsoft Office fonts → Google Fonts equivalents
  Calibri: 'Carlito',
  Cambria: 'Caladea',
  Arial: 'Arimo',
  'Times New Roman': 'Tinos',
  'Courier New': 'Cousine',
  Garamond: 'EB Garamond',
  'Book Antiqua': 'EB Garamond',
  Georgia: 'Tinos',
  Verdana: 'Open Sans',
  Tahoma: 'Open Sans',
  'Trebuchet MS': 'Source Sans Pro',
  'Century Gothic': 'Poppins',
  'Franklin Gothic': 'Libre Franklin',
  Palatino: 'EB Garamond',
  'Palatino Linotype': 'EB Garamond',
  'Lucida Sans': 'Open Sans',
  'Segoe UI': 'Open Sans',
  Impact: 'Anton',
  'Comic Sans MS': 'Comic Neue',
  Consolas: 'Inconsolata',
  'Lucida Console': 'Inconsolata',
  Monaco: 'Fira Code',
};

/**
 * Get the Google Fonts equivalent for a font name
 *
 * @param fontName - The original font name from the document
 * @returns The Google Fonts equivalent, or the original name if no mapping exists
 */
export function getGoogleFontEquivalent(fontName: string): string {
  const trimmed = fontName.trim();
  return FONT_MAPPING[trimmed] || trimmed;
}

/**
 * Load a font, automatically mapping to Google Fonts equivalent if needed.
 * If the font needs mapping, also creates a CSS alias so the original font
 * name works in stylesheets.
 *
 * @param fontFamily - The font family name (may be an Office font)
 * @returns Promise resolving to true if font loaded
 */
export async function loadFontWithMapping(fontFamily: string): Promise<boolean> {
  const trimmed = fontFamily.trim();
  const googleFont = getGoogleFontEquivalent(trimmed);

  // If there's a mapping, fetch the CSS and create alias with original name
  // This avoids loading the font twice (once for Google name, once for alias)
  if (googleFont !== trimmed) {
    await createFontAlias(trimmed, googleFont);
    loadedFonts.add(trimmed);
    loadedFonts.add(googleFont);
    return true;
  }

  // No mapping needed, load directly
  return loadFont(googleFont);
}

/**
 * Create a CSS font-family alias by fetching the Google Fonts CSS and
 * rewriting it to use the original font name.
 *
 * @param originalName - The original font name (e.g., "Garamond")
 * @param googleFontName - The Google Font name (e.g., "EB Garamond")
 */
async function createFontAlias(originalName: string, googleFontName: string): Promise<void> {
  // Create a style element with @font-face that aliases the original name
  const styleId = `font-alias-${originalName.toLowerCase().replace(/\s+/g, '-')}`;

  // Don't create duplicate aliases
  if (document.getElementById(styleId)) {
    return;
  }

  try {
    // Fetch the Google Fonts CSS to get the actual font URLs
    const url = getGoogleFontsUrl(googleFontName, [400, 700], ['normal', 'italic']);
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`Failed to fetch Google Fonts CSS for "${googleFontName}": ${response.status}`);
      return;
    }

    const css = await response.text();

    // Replace the Google Font name with the original name in all @font-face rules
    // The CSS contains: font-family: 'EB Garamond';
    // We want: font-family: 'Garamond';
    const regex = new RegExp(`font-family:\\s*['"]${escapeRegExp(googleFontName)}['"]`, 'gi');
    const aliasedCss = css.replace(regex, `font-family: '${originalName}'`);

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = aliasedCss;

    document.head.appendChild(style);
    console.log(`Loaded font: "${originalName}" (via ${googleFontName})`);
  } catch (error) {
    console.warn(`Failed to create font alias for "${originalName}":`, error);
  }
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Load multiple fonts with automatic mapping to Google Fonts equivalents
 *
 * @param families - Array of font family names
 * @returns Promise resolving when all fonts are loaded
 */
export async function loadFontsWithMapping(families: string[]): Promise<void> {
  // Remove duplicates
  const uniqueFonts = [...new Set(families.map((f) => f.trim()))];
  // Load each font with mapping (creates aliases for Office → Google font mappings)
  await Promise.all(uniqueFonts.map((family) => loadFontWithMapping(family)));
}

/**
 * Preload a list of common document fonts
 *
 * This preloads fonts commonly used in DOCX documents that have
 * Google Fonts equivalents.
 */
export async function preloadCommonFonts(): Promise<void> {
  const commonFonts = [
    'Carlito', // Calibri equivalent
    'Caladea', // Cambria equivalent
    'Arimo', // Arial equivalent
    'Tinos', // Times New Roman equivalent
    'Cousine', // Courier New equivalent
    'EB Garamond', // Garamond equivalent
  ];

  await loadFonts(commonFonts);
}

/**
 * Extract all font families used in a document
 *
 * Uses loose typing to handle any document-like structure.
 *
 * @param document - The parsed document
 * @returns Set of unique font family names
 */
export function extractFontsFromDocument(document: unknown): Set<string> {
  const fonts = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = document as any;
  if (!doc?.package) return fonts;

  // Extract from document content
  const content = doc.package?.document?.content;
  if (Array.isArray(content)) {
    for (const paragraph of content) {
      if (paragraph?.type === 'paragraph' && Array.isArray(paragraph.content)) {
        for (const run of paragraph.content) {
          if (run?.type === 'run' && run.formatting?.fontFamily) {
            const { ascii, hAnsi } = run.formatting.fontFamily;
            if (ascii) fonts.add(ascii);
            if (hAnsi && hAnsi !== ascii) fonts.add(hAnsi);
          }
        }
      }
    }
  }

  // Extract from styles
  const styles = doc.package?.styles?.styles;
  if (Array.isArray(styles)) {
    for (const style of styles) {
      if (style?.runProperties?.fontFamily) {
        const { ascii, hAnsi } = style.runProperties.fontFamily;
        if (ascii) fonts.add(ascii);
        if (hAnsi && hAnsi !== ascii) fonts.add(hAnsi);
      }
    }
  }

  return fonts;
}

/**
 * Extract fonts from a document and load them from Google Fonts
 *
 * @param document - The parsed document
 * @returns Promise resolving when fonts are loaded
 */
export async function loadDocumentFonts(document: unknown): Promise<void> {
  const fonts = extractFontsFromDocument(document);

  if (fonts.size === 0) {
    return;
  }

  console.log('Loading document fonts:', Array.from(fonts));
  await loadFontsWithMapping(Array.from(fonts));
}
