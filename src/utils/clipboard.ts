/**
 * Clipboard utilities for copy/paste with formatting
 *
 * Handles:
 * - Copy: puts formatted HTML and plain text on clipboard
 * - Paste: reads HTML clipboard, converts to runs with formatting
 * - Handles paste from Word (cleans up Word HTML)
 * - Ctrl+C, Ctrl+V, Ctrl+X keyboard shortcuts
 */

import type { Run, TextFormatting, Paragraph } from '../types/document';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Clipboard content format
 */
export interface ClipboardContent {
  /** Plain text representation */
  plainText: string;
  /** HTML representation */
  html: string;
  /** Internal format (JSON) for preserving full formatting */
  internal?: string;
}

/**
 * Parsed clipboard content
 */
export interface ParsedClipboardContent {
  /** Runs parsed from clipboard */
  runs: Run[];
  /** Whether content came from Word */
  fromWord: boolean;
  /** Whether content came from our editor */
  fromEditor: boolean;
  /** Original plain text */
  plainText: string;
}

/**
 * Options for clipboard operations
 */
export interface ClipboardOptions {
  /** Whether to include formatting in copy */
  includeFormatting?: boolean;
  /** Whether to clean Word-specific formatting */
  cleanWordFormatting?: boolean;
  /** Callback for handling errors */
  onError?: (error: Error) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Custom MIME type for internal clipboard format
 */
export const INTERNAL_CLIPBOARD_TYPE = 'application/x-docx-editor';

/**
 * Standard clipboard MIME types
 */
export const CLIPBOARD_TYPES = {
  HTML: 'text/html',
  PLAIN: 'text/plain',
} as const;

// ============================================================================
// COPY FUNCTIONS
// ============================================================================

/**
 * Copy runs to clipboard with formatting
 */
export async function copyRuns(runs: Run[], options: ClipboardOptions = {}): Promise<boolean> {
  const { includeFormatting = true, onError } = options;

  try {
    const content = runsToClipboardContent(runs, includeFormatting);
    return await writeToClipboard(content);
  } catch (error) {
    onError?.(error as Error);
    return false;
  }
}

/**
 * Copy paragraphs to clipboard with formatting
 */
export async function copyParagraphs(
  paragraphs: Paragraph[],
  options: ClipboardOptions = {}
): Promise<boolean> {
  const { includeFormatting = true, onError } = options;

  try {
    const content = paragraphsToClipboardContent(paragraphs, includeFormatting);
    return await writeToClipboard(content);
  } catch (error) {
    onError?.(error as Error);
    return false;
  }
}

/**
 * Convert runs to clipboard content (HTML and plain text)
 */
export function runsToClipboardContent(
  runs: Run[],
  includeFormatting: boolean = true
): ClipboardContent {
  const plainText = runs.map(getRunText).join('');
  const html = includeFormatting ? runsToHtml(runs) : escapeHtml(plainText);
  const internal = JSON.stringify(runs);

  return { plainText, html, internal };
}

/**
 * Convert paragraphs to clipboard content
 */
export function paragraphsToClipboardContent(
  paragraphs: Paragraph[],
  includeFormatting: boolean = true
): ClipboardContent {
  const plainText = paragraphs.map(getParagraphText).join('\n');
  const html = includeFormatting ? paragraphsToHtml(paragraphs) : escapeHtml(plainText);
  const internal = JSON.stringify(paragraphs);

  return { plainText, html, internal };
}

/**
 * Write content to clipboard
 */
export async function writeToClipboard(content: ClipboardContent): Promise<boolean> {
  try {
    // Try to use the modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.write) {
      const items = [
        new ClipboardItem({
          [CLIPBOARD_TYPES.PLAIN]: new Blob([content.plainText], { type: CLIPBOARD_TYPES.PLAIN }),
          [CLIPBOARD_TYPES.HTML]: new Blob([content.html], { type: CLIPBOARD_TYPES.HTML }),
        }),
      ];
      await navigator.clipboard.write(items);
      return true;
    }

    // Fallback to execCommand
    return writeToClipboardFallback(content);
  } catch {
    // Fallback to execCommand
    return writeToClipboardFallback(content);
  }
}

/**
 * Fallback method using execCommand
 */
function writeToClipboardFallback(content: ClipboardContent): boolean {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content.html;
  tempDiv.style.position = 'fixed';
  tempDiv.style.left = '-9999px';
  document.body.appendChild(tempDiv);

  try {
    const selection = window.getSelection();
    if (!selection) return false;

    const range = document.createRange();
    range.selectNodeContents(tempDiv);
    selection.removeAllRanges();
    selection.addRange(range);

    const result = document.execCommand('copy');
    selection.removeAllRanges();
    return result;
  } finally {
    document.body.removeChild(tempDiv);
  }
}

// ============================================================================
// PASTE FUNCTIONS
// ============================================================================

/**
 * Read content from clipboard
 */
export async function readFromClipboard(
  options: ClipboardOptions = {}
): Promise<ParsedClipboardContent | null> {
  const { cleanWordFormatting = true, onError } = options;

  try {
    // Try modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.read) {
      const items = await navigator.clipboard.read();
      return await parseClipboardItems(items, cleanWordFormatting);
    }

    // Fallback to reading from event
    return null;
  } catch (error) {
    onError?.(error as Error);
    return null;
  }
}

/**
 * Parse clipboard items
 */
async function parseClipboardItems(
  items: ClipboardItems,
  cleanWordFormatting: boolean
): Promise<ParsedClipboardContent> {
  let html = '';
  let plainText = '';

  for (const item of items) {
    // Get HTML content
    if (item.types.includes(CLIPBOARD_TYPES.HTML)) {
      const blob = await item.getType(CLIPBOARD_TYPES.HTML);
      html = await blob.text();
    }

    // Get plain text
    if (item.types.includes(CLIPBOARD_TYPES.PLAIN)) {
      const blob = await item.getType(CLIPBOARD_TYPES.PLAIN);
      plainText = await blob.text();
    }
  }

  return parseClipboardHtml(html, plainText, cleanWordFormatting);
}

/**
 * Handle paste event
 */
export function handlePasteEvent(
  event: ClipboardEvent,
  options: ClipboardOptions = {}
): ParsedClipboardContent | null {
  const { cleanWordFormatting = true } = options;

  const clipboardData = event.clipboardData;
  if (!clipboardData) return null;

  const html = clipboardData.getData(CLIPBOARD_TYPES.HTML);
  const plainText = clipboardData.getData(CLIPBOARD_TYPES.PLAIN);

  return parseClipboardHtml(html, plainText, cleanWordFormatting);
}

/**
 * Parse HTML from clipboard
 */
export function parseClipboardHtml(
  html: string,
  plainText: string,
  cleanWordFormatting: boolean = true
): ParsedClipboardContent {
  const fromWord = isWordHtml(html);
  const fromEditor = isEditorHtml(html);

  // If from our editor, try to parse internal format
  if (fromEditor) {
    // Look for internal data in HTML comments or data attributes
    const internalMatch = html.match(/data-docx-editor-content="([^"]+)"/);
    if (internalMatch) {
      try {
        const runs = JSON.parse(decodeURIComponent(internalMatch[1]));
        return { runs, fromWord: false, fromEditor: true, plainText };
      } catch {
        // Fall through to HTML parsing
      }
    }
  }

  // Clean Word HTML if needed
  let processedHtml = html;
  if (fromWord && cleanWordFormatting) {
    processedHtml = cleanWordHtml(html);
  }

  // Parse HTML to runs
  const runs = htmlToRuns(processedHtml, plainText);

  return { runs, fromWord, fromEditor, plainText };
}

/**
 * Check if HTML is from Microsoft Word
 */
export function isWordHtml(html: string): boolean {
  return (
    html.includes('urn:schemas-microsoft-com:office') ||
    html.includes('mso-') ||
    html.includes('MsoNormal') ||
    html.includes('class="Mso') ||
    html.includes('<!--[if gte mso')
  );
}

/**
 * Check if HTML is from our editor
 */
export function isEditorHtml(html: string): boolean {
  return (
    html.includes('data-docx-editor') ||
    html.includes('docx-run') ||
    html.includes('docx-paragraph')
  );
}

/**
 * Clean Microsoft Word HTML
 */
export function cleanWordHtml(html: string): string {
  let cleaned = html;

  // Remove Word-specific comments
  cleaned = cleaned.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove XML declarations
  cleaned = cleaned.replace(/<\?xml[^>]*>/gi, '');

  // Remove o: (Office) namespace tags
  cleaned = cleaned.replace(/<o:[^>]*>[\s\S]*?<\/o:[^>]*>/gi, '');
  cleaned = cleaned.replace(/<o:[^>]*\/>/gi, '');

  // Remove w: (Word) namespace tags
  cleaned = cleaned.replace(/<w:[^>]*>[\s\S]*?<\/w:[^>]*>/gi, '');
  cleaned = cleaned.replace(/<w:[^>]*\/>/gi, '');

  // Remove mso styles but keep other styles
  cleaned = cleaned.replace(/\s*mso-[^:;]+:[^;]+;?/gi, '');

  // Remove empty style attributes
  cleaned = cleaned.replace(/\s*style="\s*"/gi, '');

  // Remove class attributes containing Mso
  cleaned = cleaned.replace(/\s*class="[^"]*Mso[^"]*"/gi, '');

  // Remove empty spans
  cleaned = cleaned.replace(/<span[^>]*>\s*<\/span>/gi, '');

  // Remove font tags (convert to spans with style if needed)
  cleaned = cleaned.replace(/<\/?font[^>]*>/gi, '');

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Convert HTML to runs
 */
export function htmlToRuns(html: string, plainTextFallback: string): Run[] {
  if (!html || html.trim() === '') {
    // Use plain text fallback
    return plainTextFallback ? [createTextRun(plainTextFallback)] : [];
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  const runs: Run[] = [];
  processNode(container, runs, {});

  // If no runs were extracted, use plain text
  if (runs.length === 0 && plainTextFallback) {
    return [createTextRun(plainTextFallback)];
  }

  return runs;
}

/**
 * Process a DOM node and extract runs
 */
function processNode(node: Node, runs: Run[], inheritedFormatting: TextFormatting): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    if (text.trim() || text.includes(' ')) {
      runs.push(createTextRun(text, inheritedFormatting));
    }
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  // Merge formatting from this element
  const formatting = { ...inheritedFormatting, ...extractFormatting(element) };

  // Handle specific elements
  switch (tagName) {
    case 'br':
      runs.push(createBreakRun(formatting));
      return;

    case 'p':
    case 'div':
      // Process children
      for (const child of element.childNodes) {
        processNode(child, runs, formatting);
      }
      // Add line break after block elements if not the last element
      if (element.nextSibling) {
        runs.push(createBreakRun(formatting));
      }
      return;

    case 'b':
    case 'strong':
      formatting.bold = true;
      break;

    case 'i':
    case 'em':
      formatting.italic = true;
      break;

    case 'u':
      formatting.underline = { style: 'single' };
      break;

    case 's':
    case 'strike':
    case 'del':
      formatting.strike = true;
      break;

    case 'sup':
      formatting.vertAlign = 'superscript';
      break;

    case 'sub':
      formatting.vertAlign = 'subscript';
      break;

    case 'code':
    case 'pre':
      formatting.fontFamily = { ascii: 'Courier New' };
      break;
  }

  // Process children
  for (const child of element.childNodes) {
    processNode(child, runs, formatting);
  }
}

/**
 * Extract formatting from an HTML element
 */
function extractFormatting(element: HTMLElement): TextFormatting {
  const formatting: TextFormatting = {};
  const style = element.style;

  // Font weight (bold)
  if (style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 700) {
    formatting.bold = true;
  }

  // Font style (italic)
  if (style.fontStyle === 'italic') {
    formatting.italic = true;
  }

  // Text decoration (underline, strikethrough)
  const textDecoration = style.textDecoration || style.textDecorationLine;
  if (textDecoration) {
    if (textDecoration.includes('underline')) {
      formatting.underline = { style: 'single' };
    }
    if (textDecoration.includes('line-through')) {
      formatting.strike = true;
    }
  }

  // Font size
  if (style.fontSize) {
    const sizePx = parseFloat(style.fontSize);
    if (!isNaN(sizePx)) {
      // Convert pixels to half-points (1pt = 1.333px at 96dpi)
      formatting.fontSize = Math.round((sizePx / 1.333) * 2);
    }
  }

  // Font family
  if (style.fontFamily) {
    const fontFamily = style.fontFamily.replace(/["']/g, '').split(',')[0].trim();
    if (fontFamily) {
      formatting.fontFamily = { ascii: fontFamily };
    }
  }

  // Color
  if (style.color) {
    const hex = colorToHex(style.color);
    if (hex) {
      formatting.color = { rgb: hex };
    }
  }

  // Background color (highlight)
  if (style.backgroundColor && style.backgroundColor !== 'transparent') {
    const hex = colorToHex(style.backgroundColor);
    if (hex) {
      formatting.shading = { fill: { rgb: hex } };
    }
  }

  return formatting;
}

/**
 * Convert a CSS color value to hex
 */
function colorToHex(color: string): string | null {
  if (!color || color === 'transparent' || color === 'inherit') {
    return null;
  }

  // Already hex
  if (color.startsWith('#')) {
    return color.slice(1).toUpperCase();
  }

  // RGB/RGBA
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return (r + g + b).toUpperCase();
  }

  return null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get plain text from a run
 */
function getRunText(run: Run): string {
  return run.content
    .map((content) => {
      if (content.type === 'text') return content.text;
      if (content.type === 'tab') return '\t';
      if (content.type === 'break') return content.breakType === 'textWrapping' ? '\n' : '';
      return '';
    })
    .join('');
}

/**
 * Get plain text from a paragraph
 */
function getParagraphText(paragraph: Paragraph): string {
  return (paragraph.content || [])
    .map((content) => {
      if (content.type === 'run') return getRunText(content);
      return '';
    })
    .join('');
}

/**
 * Convert runs to HTML
 */
function runsToHtml(runs: Run[]): string {
  return runs.map(runToHtml).join('');
}

/**
 * Convert paragraphs to HTML
 */
function paragraphsToHtml(paragraphs: Paragraph[]): string {
  return paragraphs
    .map((p) => `<p>${runsToHtml(p.content?.filter((c): c is Run => c.type === 'run') || [])}</p>`)
    .join('');
}

/**
 * Convert a run to HTML
 */
function runToHtml(run: Run): string {
  const text = getRunText(run);
  if (!text) return '';

  let html = escapeHtml(text);
  const formatting = run.formatting;

  if (!formatting) return html;

  // Apply formatting
  if (formatting.bold) {
    html = `<strong>${html}</strong>`;
  }
  if (formatting.italic) {
    html = `<em>${html}</em>`;
  }
  if (formatting.underline) {
    html = `<u>${html}</u>`;
  }
  if (formatting.strike) {
    html = `<s>${html}</s>`;
  }
  if (formatting.vertAlign === 'superscript') {
    html = `<sup>${html}</sup>`;
  }
  if (formatting.vertAlign === 'subscript') {
    html = `<sub>${html}</sub>`;
  }

  // Build inline styles
  const styles: string[] = [];

  if (formatting.fontSize) {
    const sizePt = formatting.fontSize / 2;
    styles.push(`font-size: ${sizePt}pt`);
  }

  if (formatting.fontFamily?.ascii) {
    styles.push(`font-family: "${formatting.fontFamily.ascii}"`);
  }

  if (formatting.color?.rgb) {
    styles.push(`color: #${formatting.color.rgb}`);
  }

  if (formatting.shading?.fill?.rgb) {
    styles.push(`background-color: #${formatting.shading.fill.rgb}`);
  }

  if (styles.length > 0) {
    html = `<span style="${styles.join('; ')}">${html}</span>`;
  }

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Create a text run
 */
function createTextRun(text: string, formatting?: TextFormatting): Run {
  return {
    type: 'run',
    formatting,
    content: [{ type: 'text', text }],
  };
}

/**
 * Create a break run
 */
function createBreakRun(formatting?: TextFormatting): Run {
  return {
    type: 'run',
    formatting,
    content: [{ type: 'break', breakType: 'textWrapping' }],
  };
}

// ============================================================================
// KEYBOARD HANDLER
// ============================================================================

/**
 * Create clipboard keyboard handlers for an editor
 */
export function createClipboardHandlers(options: {
  onCopy?: () => { runs: Run[] } | null;
  onCut?: () => { runs: Run[] } | null;
  onPaste?: (content: ParsedClipboardContent) => void;
  clipboardOptions?: ClipboardOptions;
}) {
  const { onCopy, onCut, onPaste, clipboardOptions = {} } = options;

  const handleCopy = async (event: ClipboardEvent) => {
    if (!onCopy) return;

    const data = onCopy();
    if (!data) return;

    event.preventDefault();

    const content = runsToClipboardContent(data.runs);

    if (event.clipboardData) {
      event.clipboardData.setData(CLIPBOARD_TYPES.PLAIN, content.plainText);
      event.clipboardData.setData(CLIPBOARD_TYPES.HTML, content.html);
    } else {
      await writeToClipboard(content);
    }
  };

  const handleCut = async (event: ClipboardEvent) => {
    if (!onCut) return;

    const data = onCut();
    if (!data) return;

    event.preventDefault();

    const content = runsToClipboardContent(data.runs);

    if (event.clipboardData) {
      event.clipboardData.setData(CLIPBOARD_TYPES.PLAIN, content.plainText);
      event.clipboardData.setData(CLIPBOARD_TYPES.HTML, content.html);
    } else {
      await writeToClipboard(content);
    }
  };

  const handlePaste = (event: ClipboardEvent) => {
    if (!onPaste) return;

    event.preventDefault();

    const content = handlePasteEvent(event, clipboardOptions);
    if (content) {
      onPaste(content);
    }
  };

  const handleKeyDown = async (event: KeyboardEvent) => {
    const isCtrlOrMeta = event.ctrlKey || event.metaKey;

    // Ctrl+C / Cmd+C
    if (isCtrlOrMeta && event.key === 'c' && !event.shiftKey) {
      if (onCopy) {
        const data = onCopy();
        if (data) {
          await copyRuns(data.runs, clipboardOptions);
        }
      }
    }

    // Ctrl+X / Cmd+X
    if (isCtrlOrMeta && event.key === 'x' && !event.shiftKey) {
      if (onCut) {
        const data = onCut();
        if (data) {
          await copyRuns(data.runs, clipboardOptions);
        }
      }
    }

    // Ctrl+V / Cmd+V handled by paste event
  };

  return {
    handleCopy,
    handleCut,
    handlePaste,
    handleKeyDown,
  };
}

export default {
  copyRuns,
  copyParagraphs,
  readFromClipboard,
  handlePasteEvent,
  htmlToRuns,
  cleanWordHtml,
  isWordHtml,
  isEditorHtml,
  createClipboardHandlers,
};
