/**
 * Paragraph Fragment Renderer
 *
 * Renders paragraph fragments with lines and text runs to DOM.
 * Handles text formatting, alignment, and positioning.
 */

import type {
  ParagraphBlock,
  ParagraphMeasure,
  ParagraphFragment,
  ParagraphIndent,
  MeasuredLine,
  Run,
  TextRun,
  TabRun,
  ImageRun,
  LineBreakRun,
  FieldRun,
  TabStop,
} from '../layout-engine/types';
import type { RenderContext } from './renderPage';
import {
  calculateTabWidth,
  type TabContext,
  type TabStop as TabCalcStop,
} from '../prosemirror/utils/tabCalculator';

/**
 * CSS class names for paragraph rendering
 */
export const PARAGRAPH_CLASS_NAMES = {
  fragment: 'layout-paragraph',
  line: 'layout-line',
  run: 'layout-run',
  text: 'layout-run-text',
  tab: 'layout-run-tab',
  image: 'layout-run-image',
  lineBreak: 'layout-run-linebreak',
};

/**
 * Info about page-level floating images that affect text layout.
 * Passed from renderPage to renderParagraph to apply proper margins.
 */
export interface FloatingImageInfo {
  /** Left margin to reserve for floating images (pixels) */
  leftMargin: number;
  /** Right margin to reserve for floating images (pixels) */
  rightMargin: number;
  /** Top Y position where this zone starts (content-relative) */
  topY: number;
  /** Bottom Y position where this zone ends (content-relative) */
  bottomY: number;
}

// NOTE: Per-line floating margin calculation has been disabled.
// Text wrapping around floating images requires passing exclusion zones
// to the MEASUREMENT phase so lines can be broken at reduced widths.
// Currently, floating images render at page level and text flows under them.
// TODO: Implement measurement-time floating image support for proper text wrapping.

/**
 * Options for rendering a paragraph
 */
export interface RenderParagraphOptions {
  /** Document to create elements in */
  document?: Document;
  /** Page-level floating image info for text wrapping (exclusion zones) */
  floatingImageInfo?: FloatingImageInfo[];
  /** Fragment's Y position relative to content area (for per-line margin calculation) */
  fragmentContentY?: number;
}

/**
 * Check if run is a text run
 */
function isTextRun(run: Run): run is TextRun {
  return run.kind === 'text';
}

/**
 * Check if run is a tab run
 */
function isTabRun(run: Run): run is TabRun {
  return run.kind === 'tab';
}

/**
 * Check if run is an image run
 */
function isImageRun(run: Run): run is ImageRun {
  return run.kind === 'image';
}

/**
 * Check if run is a line break run
 */
function isLineBreakRun(run: Run): run is LineBreakRun {
  return run.kind === 'lineBreak';
}

/**
 * Check if run is a field run
 */
function isFieldRun(run: Run): run is FieldRun {
  return run.kind === 'field';
}

/**
 * Apply text run styles to an element
 */
/**
 * Font fallback chain - MUST match measureContainer.ts to ensure
 * measurement and rendering use the same fonts
 */
const FONT_FALLBACK = '"Segoe UI", Arial, sans-serif';

function applyRunStyles(element: HTMLElement, run: TextRun | TabRun): void {
  // Font properties
  if (run.fontFamily) {
    // Quote font names with spaces for proper CSS
    // Use the same fallback chain as measureContainer.ts to ensure
    // text renders with the same widths as measured
    const fontName = run.fontFamily.includes(' ') ? `"${run.fontFamily}"` : run.fontFamily;
    element.style.fontFamily = `${fontName}, ${FONT_FALLBACK}`;
  }
  if (run.fontSize) {
    // fontSize is in points - convert to pixels to match Canvas measurement
    // (1pt = 96/72 px at standard web DPI)
    // Using px ensures consistent rendering with Canvas-based measurements
    const fontSizePx = (run.fontSize * 96) / 72;
    element.style.fontSize = `${fontSizePx}px`;
  }
  if (run.bold) {
    element.style.fontWeight = 'bold';
  }
  if (run.italic) {
    element.style.fontStyle = 'italic';
  }

  // Color
  if (run.color) {
    element.style.color = run.color;
  }

  // Letter spacing
  if (run.letterSpacing) {
    element.style.letterSpacing = `${run.letterSpacing}px`;
  }

  // Highlight (background color)
  if (run.highlight) {
    element.style.backgroundColor = run.highlight;
  }

  // Text decorations
  const decorations: string[] = [];

  if (run.underline) {
    decorations.push('underline');
    if (typeof run.underline === 'object') {
      if (run.underline.style) {
        element.style.textDecorationStyle = run.underline.style;
      }
      if (run.underline.color) {
        element.style.textDecorationColor = run.underline.color;
      }
    }
  }

  if (run.strike) {
    decorations.push('line-through');
  }

  if (decorations.length > 0) {
    element.style.textDecorationLine = decorations.join(' ');
  }

  // Superscript/subscript
  if (run.superscript) {
    element.style.verticalAlign = 'super';
    element.style.fontSize = '0.75em';
  }
  if (run.subscript) {
    element.style.verticalAlign = 'sub';
    element.style.fontSize = '0.75em';
  }
}

/**
 * Apply PM position data attributes
 */
function applyPmPositions(element: HTMLElement, pmStart?: number, pmEnd?: number): void {
  if (pmStart !== undefined) {
    element.dataset.pmStart = String(pmStart);
  }
  if (pmEnd !== undefined) {
    element.dataset.pmEnd = String(pmEnd);
  }
}

/**
 * Render a text run
 */
function renderTextRun(run: TextRun, doc: Document): HTMLElement {
  const span = doc.createElement('span');
  span.className = `${PARAGRAPH_CLASS_NAMES.run} ${PARAGRAPH_CLASS_NAMES.text}`;

  applyRunStyles(span, run);
  applyPmPositions(span, run.pmStart, run.pmEnd);

  // Handle hyperlinks
  if (run.hyperlink) {
    const anchor = doc.createElement('a');
    anchor.href = run.hyperlink.href;
    // Internal bookmark links (starting with #) should scroll within the document
    // External links should open in a new tab
    if (!run.hyperlink.href.startsWith('#')) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    }
    if (run.hyperlink.tooltip) {
      anchor.title = run.hyperlink.tooltip;
    }
    anchor.textContent = run.text;
    // Style hyperlink
    anchor.style.color = run.color || '#0563c1'; // Default Word hyperlink color
    anchor.style.textDecoration = 'underline';
    span.appendChild(anchor);
  } else {
    // Set text content
    span.textContent = run.text;
  }

  return span;
}

/**
 * Render a tab run with calculated width
 */
function renderTabRun(run: TabRun, doc: Document, width: number, leader?: string): HTMLElement {
  const span = doc.createElement('span');
  span.className = `${PARAGRAPH_CLASS_NAMES.run} ${PARAGRAPH_CLASS_NAMES.tab}`;

  span.style.display = 'inline-block';
  span.style.width = `${width}px`;

  applyPmPositions(span, run.pmStart, run.pmEnd);

  // Render leader character if specified
  if (leader && leader !== 'none') {
    const leaderChar = getLeaderChar(leader);
    if (leaderChar) {
      // Fill with leader characters
      span.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='4' height='16'><text x='0' y='12' font-size='12' fill='%23000'>${leaderChar}</text></svg>`
      )}")`;
      span.style.backgroundRepeat = 'repeat-x';
      span.style.backgroundPosition = 'bottom';
    }
  }

  // Tab character for accessibility (but invisible)
  span.textContent = '\u00A0'; // Non-breaking space for layout

  return span;
}

/**
 * Get leader character for tab
 */
function getLeaderChar(leader: string): string | null {
  switch (leader) {
    case 'dot':
      return '.';
    case 'hyphen':
      return '-';
    case 'underscore':
      return '_';
    case 'middleDot':
      return '·';
    default:
      return null;
  }
}

/**
 * Render an inline image run (flows with text)
 */
function renderInlineImageRun(run: ImageRun, doc: Document): HTMLElement {
  const img = doc.createElement('img');
  img.className = `${PARAGRAPH_CLASS_NAMES.run} ${PARAGRAPH_CLASS_NAMES.image}`;

  img.src = run.src;
  img.width = run.width;
  img.height = run.height;
  if (run.alt) {
    img.alt = run.alt;
  }
  if (run.transform) {
    img.style.transform = run.transform;
  }

  // Inline images should flow with text
  img.style.display = 'inline';
  img.style.verticalAlign = 'middle';

  applyPmPositions(img, run.pmStart, run.pmEnd);

  return img;
}

/**
 * Render a block image (on its own line, like topAndBottom)
 */
function renderBlockImage(run: ImageRun, doc: Document): HTMLElement {
  const container = doc.createElement('div');
  container.className = 'layout-block-image';
  container.style.display = 'block';
  container.style.textAlign = 'center';
  container.style.marginTop = `${run.distTop ?? 6}px`;
  container.style.marginBottom = `${run.distBottom ?? 6}px`;

  const img = doc.createElement('img');
  img.src = run.src;
  img.width = run.width;
  img.height = run.height;
  // Global CSS reset (Tailwind preflight) sets img { display: block },
  // which makes text-align: center on the container ineffective.
  // Use margin: auto on the img itself to center it.
  img.style.marginLeft = 'auto';
  img.style.marginRight = 'auto';
  if (run.alt) {
    img.alt = run.alt;
  }
  if (run.transform) {
    img.style.transform = run.transform;
  }

  applyPmPositions(container, run.pmStart, run.pmEnd);
  container.appendChild(img);

  return container;
}

/**
 * Render an image run based on its display mode
 * Note: Floating images (square/tight/through) are handled separately at paragraph level,
 * not through this function. If they reach here, render as block.
 */
function renderImageRun(run: ImageRun, doc: Document): HTMLElement {
  const displayMode = run.displayMode;
  const wrapType = run.wrapType;

  // Floating images should be handled at paragraph level, not here
  // If they reach here (e.g., during line rendering), render as block
  if (displayMode === 'float' || (wrapType && ['square', 'tight', 'through'].includes(wrapType))) {
    return renderBlockImage(run, doc);
  } else if (displayMode === 'block' || wrapType === 'topAndBottom') {
    return renderBlockImage(run, doc);
  } else {
    // Default: inline
    return renderInlineImageRun(run, doc);
  }
}

/**
 * Render a line break run
 */
function renderLineBreakRun(run: LineBreakRun, doc: Document): HTMLElement {
  const br = doc.createElement('br');
  br.className = `${PARAGRAPH_CLASS_NAMES.run} ${PARAGRAPH_CLASS_NAMES.lineBreak}`;

  applyPmPositions(br, run.pmStart, run.pmEnd);

  return br;
}

/**
 * Render a field run (PAGE, NUMPAGES, etc.)
 * Substitutes the field with actual values from context.
 */
function renderFieldRun(run: FieldRun, doc: Document, context: RenderContext): HTMLElement {
  let text = run.fallback ?? '';

  switch (run.fieldType) {
    case 'PAGE':
      text = String(context.pageNumber);
      break;
    case 'NUMPAGES':
      text = String(context.totalPages);
      break;
    case 'DATE':
      text = new Date().toLocaleDateString();
      break;
    case 'TIME':
      text = new Date().toLocaleTimeString();
      break;
    // OTHER fields use fallback
  }

  // Create a text run with the resolved value
  const resolvedRun: TextRun = {
    kind: 'text',
    text,
    bold: run.bold,
    italic: run.italic,
    underline: run.underline,
    strike: run.strike,
    color: run.color,
    highlight: run.highlight,
    fontFamily: run.fontFamily,
    fontSize: run.fontSize,
    pmStart: run.pmStart,
    pmEnd: run.pmEnd,
  };

  return renderTextRun(resolvedRun, doc);
}

/**
 * Render a single run (for non-tab runs)
 */
function renderRun(run: Run, doc: Document, context?: RenderContext): HTMLElement {
  if (isTextRun(run)) {
    return renderTextRun(run, doc);
  }
  if (isTabRun(run)) {
    // Tab runs should be handled by renderLine with proper width calculation
    // This is a fallback for cases where tab context isn't available
    return renderTabRun(run, doc, 48, undefined); // Default 0.5 inch tab
  }
  if (isImageRun(run)) {
    return renderImageRun(run, doc);
  }
  if (isLineBreakRun(run)) {
    return renderLineBreakRun(run, doc);
  }
  if (isFieldRun(run) && context) {
    return renderFieldRun(run, doc, context);
  }

  // Fallback for unknown run types
  const span = doc.createElement('span');
  span.className = PARAGRAPH_CLASS_NAMES.run;
  return span;
}

/**
 * Slice runs for a specific line
 *
 * @param block - The paragraph block
 * @param line - The line measurement
 * @returns Array of runs for this line
 */
export function sliceRunsForLine(block: ParagraphBlock, line: MeasuredLine): Run[] {
  const result: Run[] = [];
  const runs = block.runs;

  for (let runIndex = line.fromRun; runIndex <= line.toRun; runIndex++) {
    const run = runs[runIndex];
    if (!run) continue;

    if (isTextRun(run)) {
      // Get the character range for this run
      const startChar = runIndex === line.fromRun ? line.fromChar : 0;
      const endChar = runIndex === line.toRun ? line.toChar : run.text.length;

      // Slice the text if needed
      if (startChar > 0 || endChar < run.text.length) {
        const slicedText = run.text.slice(startChar, endChar);
        result.push({
          ...run,
          text: slicedText,
          pmStart: run.pmStart !== undefined ? run.pmStart + startChar : undefined,
          pmEnd: run.pmStart !== undefined ? run.pmStart + endChar : undefined,
        });
      } else {
        result.push(run);
      }
    } else {
      // Non-text runs are included as-is
      result.push(run);
    }
  }

  return result;
}

/**
 * Options for rendering a line with justify support
 */
interface RenderLineOptions {
  /** Available width for the line (content area width minus indentation) */
  availableWidth: number;
  /** Whether this is the last line of the paragraph */
  isLastLine: boolean;
  /** Whether this is the first line of the paragraph */
  isFirstLine: boolean;
  /** Whether the paragraph ends with a line break */
  paragraphEndsWithLineBreak: boolean;
  /** Tab stops from paragraph attributes */
  tabStops?: TabStop[];
  /** Render context for field substitution */
  context?: RenderContext;
  /** Left indent in pixels */
  leftIndentPx?: number;
  /** First line indent in pixels (positive) or hanging indent (negative) */
  firstLineIndentPx?: number;
  /** Line-specific floating image margins (calculated per-line based on Y overlap) */
  floatingMargins?: { leftMargin: number; rightMargin: number };
}

/**
 * Convert layout engine TabStop to tab calculator TabStop format
 */
function convertTabStopToCalc(stop: TabStop): TabCalcStop {
  return {
    val: stop.val,
    pos: stop.pos,
    leader: stop.leader as TabCalcStop['leader'],
  };
}

/**
 * Get the text content immediately following a tab run in the runs array
 * Used for center/end/decimal tab alignment calculations
 */
function getTextAfterTab(runs: Run[], tabRunIndex: number, context?: RenderContext): string {
  let text = '';
  for (let i = tabRunIndex + 1; i < runs.length; i++) {
    const run = runs[i];
    if (isTextRun(run)) {
      text += run.text;
    } else if (isFieldRun(run)) {
      // Resolve field values for TOC page numbers
      if (run.fieldType === 'PAGE' && context) {
        text += String(context.pageNumber);
      } else if (run.fieldType === 'NUMPAGES' && context) {
        text += String(context.totalPages);
      } else {
        text += run.fallback ?? '';
      }
    } else if (isTabRun(run) || isLineBreakRun(run)) {
      // Stop at next tab or line break
      break;
    }
  }
  return text;
}

/**
 * Create a text measurement function using a temporary canvas
 * Uses the same font fallback chain as measureContainer.ts
 */
function createTextMeasurer(
  doc: Document
): (text: string, fontSize?: number, fontFamily?: string) => number {
  const canvas = doc.createElement('canvas');
  const ctx = canvas.getContext('2d');

  return (text: string, fontSize = 11, fontFamily = 'Calibri') => {
    if (!ctx) return text.length * 7; // Fallback estimate
    // Use same fallback chain as measureContainer.ts to ensure consistent measurements
    const fontName = fontFamily.includes(' ') ? `"${fontFamily}"` : fontFamily;
    // Convert pt to px for canvas (1pt = 96/72 px)
    const fontSizePx = (fontSize * 96) / 72;
    ctx.font = `${fontSizePx}px ${fontName}, ${FONT_FALLBACK}`;
    return ctx.measureText(text).width;
  };
}

/**
 * Render a single line
 *
 * @param block - The paragraph block
 * @param line - The line measurement
 * @param alignment - Text alignment
 * @param doc - Document to create elements in
 * @param options - Additional options for justify calculation
 * @returns The line DOM element
 */
export function renderLine(
  block: ParagraphBlock,
  line: MeasuredLine,
  alignment: 'left' | 'center' | 'right' | 'justify' | undefined,
  doc: Document,
  options?: RenderLineOptions
): HTMLElement {
  const lineEl = doc.createElement('div');
  lineEl.className = PARAGRAPH_CLASS_NAMES.line;

  // Apply line height
  lineEl.style.height = `${line.lineHeight}px`;
  lineEl.style.lineHeight = `${line.lineHeight}px`;

  // Get runs for this line
  const runsForLine = sliceRunsForLine(block, line);

  // Handle empty lines
  if (runsForLine.length === 0) {
    const emptySpan = doc.createElement('span');
    emptySpan.className = `${PARAGRAPH_CLASS_NAMES.run} layout-empty-run`;
    emptySpan.innerHTML = '&nbsp;';
    lineEl.appendChild(emptySpan);
    return lineEl;
  }

  // Calculate justify spacing if needed
  const isJustify = alignment === 'justify';
  let shouldJustify = false;

  if (isJustify && options) {
    // Justify all lines except the last line (unless it ends with line break)
    shouldJustify = !options.isLastLine || options.paragraphEndsWithLineBreak;

    if (shouldJustify) {
      // Use CSS text-align: justify with text-align-last: justify
      // This forces the browser to justify even single-line blocks
      lineEl.style.textAlign = 'justify';
      lineEl.style.textAlignLast = 'justify';
      // Set explicit width so browser knows how wide to justify to
      lineEl.style.width = `${options.availableWidth}px`;
    }
  }

  // Use white-space: pre to prevent internal wrapping AND preserve consecutive spaces.
  // All line breaking is done during measurement. 'pre' ensures multiple spaces
  // are rendered visually (unlike 'nowrap' which collapses them).
  lineEl.style.whiteSpace = 'pre';
  lineEl.style.overflow = 'visible'; // Allow text to render fully (don't clip descenders)

  // NOTE: Per-line floating image margins are NOT applied here because:
  // 1. Text was already measured and line-broken at full paragraph width
  // 2. Applying margins at render time would push content without re-wrapping
  // 3. This causes text overflow and paragraph overlapping
  //
  // Proper text wrapping around floating images requires:
  // - Passing floating image info to measureParagraph
  // - Re-calculating line widths based on vertical overlap
  // - This is a significant architectural change (TODO)
  //
  // For now, floating images render at page level and text flows under them.

  // Build tab context if we have tab runs - also create for text measurement
  const hasTabRuns = runsForLine.some(isTabRun);
  let tabContext: TabContext | undefined;

  // Always create text measurer for accurate X position tracking
  const measureText = createTextMeasurer(doc);

  if (hasTabRuns) {
    // Convert tab stops from layout engine format to tab calculator format
    const explicitStops = options?.tabStops?.map(convertTabStopToCalc);

    // Convert left indent from pixels to twips for tab calculation
    // The leftIndent serves two purposes in the tab calculator:
    // 1. For hanging indent paragraphs, it adds an implicit tab stop at the left margin
    // 2. Default tab stops are generated at regular intervals from the left margin
    const leftIndentTwips = options?.leftIndentPx ? Math.round(options.leftIndentPx * 15) : 0;

    tabContext = {
      explicitStops,
      leftIndent: leftIndentTwips,
    };
  }

  // Track current X position for tab calculations
  // Tab stops are measured from the content area left edge (page text area)
  // We need to track where on that coordinate system our text is
  let currentX = 0;
  const leftIndentPx = options?.leftIndentPx ?? 0;

  if (options?.isFirstLine) {
    // First line position depends on first-line indent or hanging indent:
    // - With hanging indent (firstLineIndentPx < 0): starts at leftIndent + firstLineIndent
    // - With first-line indent (firstLineIndentPx > 0): starts at leftIndent + firstLineIndent
    // - No indent: starts at leftIndent
    const firstLineIndentPx = options?.firstLineIndentPx ?? 0;
    currentX = leftIndentPx + firstLineIndentPx;
  } else {
    // Non-first lines start at the left indent position
    currentX = leftIndentPx;
  }

  // Render each run
  for (let i = 0; i < runsForLine.length; i++) {
    const run = runsForLine[i];

    if (isTabRun(run) && tabContext) {
      // Get text following this tab for alignment calculations
      const followingText = getTextAfterTab(runsForLine, i, options?.context);

      // Calculate tab width based on current position
      const tabResult = calculateTabWidth(currentX, tabContext, followingText, measureText);

      // Render tab with calculated width and leader
      const tabEl = renderTabRun(run, doc, tabResult.width, tabResult.leader);
      lineEl.appendChild(tabEl);

      // Update X position
      currentX += tabResult.width;
    } else if (isTextRun(run)) {
      const runEl = renderTextRun(run, doc);
      lineEl.appendChild(runEl);

      // Measure text width for accurate tab position tracking
      const fontSize = run.fontSize || 11;
      const fontFamily = run.fontFamily || 'Calibri';
      currentX += measureText(run.text, fontSize, fontFamily);
    } else if (isImageRun(run)) {
      // Skip floating images - they're rendered separately at paragraph level
      const isFloating =
        run.displayMode === 'float' ||
        (run.wrapType && ['square', 'tight', 'through'].includes(run.wrapType));
      if (isFloating) {
        continue;
      }
      // Inline or block image - render in the text flow
      const runEl = renderImageRun(run, doc);
      lineEl.appendChild(runEl);
      // Block images don't contribute to horizontal position
      if (run.displayMode !== 'block' && run.wrapType !== 'topAndBottom') {
        currentX += run.width;
      }
    } else if (isLineBreakRun(run)) {
      const runEl = renderLineBreakRun(run, doc);
      lineEl.appendChild(runEl);
    } else if (isFieldRun(run) && options?.context) {
      // Render field run with context for PAGE/NUMPAGES substitution
      const runEl = renderFieldRun(run, doc, options.context);
      lineEl.appendChild(runEl);
      // Estimate field text width for tab calculations
      let fieldText = run.fallback ?? '';
      if (run.fieldType === 'PAGE') fieldText = String(options.context.pageNumber);
      else if (run.fieldType === 'NUMPAGES') fieldText = String(options.context.totalPages);
      const fontSize = run.fontSize || 11;
      const fontFamily = run.fontFamily || 'Calibri';
      currentX += measureText(fieldText, fontSize, fontFamily);
    } else {
      // Fallback for unknown run types
      const runEl = renderRun(run, doc, options?.context);
      lineEl.appendChild(runEl);
    }
  }

  return lineEl;
}

/**
 * Render a paragraph fragment
 *
 * @param fragment - The fragment to render
 * @param block - The paragraph block
 * @param measure - The paragraph measurement
 * @param context - Rendering context
 * @param options - Rendering options
 * @returns The fragment DOM element
 */
export function renderParagraphFragment(
  fragment: ParagraphFragment,
  block: ParagraphBlock,
  measure: ParagraphMeasure,
  context: RenderContext,
  options: RenderParagraphOptions = {}
): HTMLElement {
  const doc = options.document ?? document;

  const fragmentEl = doc.createElement('div');
  fragmentEl.className = PARAGRAPH_CLASS_NAMES.fragment;
  fragmentEl.style.position = 'relative'; // For absolute positioning of floating images

  // Store block and fragment metadata
  fragmentEl.dataset.blockId = String(fragment.blockId);
  fragmentEl.dataset.fromLine = String(fragment.fromLine);
  fragmentEl.dataset.toLine = String(fragment.toLine);

  applyPmPositions(fragmentEl, fragment.pmStart, fragment.pmEnd);

  if (fragment.continuesFromPrev) {
    fragmentEl.dataset.continuesFromPrev = 'true';
  }
  if (fragment.continuesOnNext) {
    fragmentEl.dataset.continuesOnNext = 'true';
  }

  // NOTE: Floating image exclusion zones (options.floatingImageInfo) and
  // fragment Y position (options.fragmentContentY) are accepted but not used.
  // Text wrapping around floating images is not yet implemented at measurement time.
  // Floating images skip during inline rendering - they're rendered at page level.
  for (const run of block.runs) {
    if (isImageRun(run)) {
      const isFloating =
        run.displayMode === 'float' ||
        (run.wrapType && ['square', 'tight', 'through'].includes(run.wrapType));
      if (isFloating) {
        // Skip floating images - they're rendered at page level
        continue;
      }
    }
  }

  // NOTE: Floating images are no longer rendered here - they're rendered
  // at page level in renderPage.ts for proper cross-paragraph positioning
  // Per-line margins are calculated below during line rendering

  // Get the lines for this fragment
  const lines = measure.lines.slice(fragment.fromLine, fragment.toLine);
  const alignment = block.attrs?.alignment;

  // Apply paragraph-level styles
  if (block.attrs?.styleId) {
    fragmentEl.dataset.styleId = block.attrs.styleId;
  }

  // Apply text alignment at paragraph level
  // For justify: use text-align: left and apply word-spacing per line
  if (alignment) {
    if (alignment === 'center') {
      fragmentEl.style.textAlign = 'center';
    } else if (alignment === 'right') {
      fragmentEl.style.textAlign = 'right';
    } else {
      // Both 'justify' and 'left' use text-align: left
      // Justify is implemented via word-spacing on individual lines
      fragmentEl.style.textAlign = 'left';
    }
  }

  // Track indentation for line-level application
  // Indentation is applied per-line, not at fragment level
  const indent = block.attrs?.indent;
  let indentLeft = 0;
  let indentRight = 0;

  if (indent) {
    // Track indent values for line-level application
    if (indent.left && indent.left > 0) {
      indentLeft = indent.left;
    }
    if (indent.right && indent.right > 0) {
      indentRight = indent.right;
    }
  }

  // Note: Line spacing is applied per-line div (renderLine sets lineEl.style.height
  // and lineEl.style.lineHeight), not at fragment level. Fragment-level line-height
  // was removed to avoid conflicts with the explicit per-line pixel heights.

  // Apply borders
  const borders = block.attrs?.borders;
  if (borders) {
    const borderStyleToCss = (style?: string): string => {
      // Map OOXML border styles to CSS
      switch (style) {
        case 'single':
          return 'solid';
        case 'double':
          return 'double';
        case 'dotted':
          return 'dotted';
        case 'dashed':
          return 'dashed';
        case 'thick':
          return 'solid';
        case 'wave':
          return 'wavy';
        case 'dashSmallGap':
          return 'dashed';
        case 'nil':
        case 'none':
          return 'none';
        default:
          return 'solid';
      }
    };

    // Ensure box-sizing is set for proper border calculations
    fragmentEl.style.boxSizing = 'border-box';

    if (borders.top) {
      fragmentEl.style.borderTop = `${borders.top.width}px ${borderStyleToCss(borders.top.style)} ${borders.top.color}`;
    }
    if (borders.bottom) {
      fragmentEl.style.borderBottom = `${borders.bottom.width}px ${borderStyleToCss(borders.bottom.style)} ${borders.bottom.color}`;
    }
    if (borders.left) {
      fragmentEl.style.borderLeft = `${borders.left.width}px ${borderStyleToCss(borders.left.style)} ${borders.left.color}`;
    }
    if (borders.right) {
      fragmentEl.style.borderRight = `${borders.right.width}px ${borderStyleToCss(borders.right.style)} ${borders.right.color}`;
    }

    // Add small padding inside borders for text not to touch the border
    // This is standard Word behavior
    // Bottom padding needs to be larger to clear text descenders
    const hasBorder = borders.top || borders.bottom || borders.left || borders.right;
    if (hasBorder) {
      fragmentEl.style.paddingLeft = borders.left ? '4px' : '0';
      fragmentEl.style.paddingRight = borders.right ? '4px' : '0';
      fragmentEl.style.paddingTop = borders.top ? '2px' : '0';
      // Use larger bottom padding to ensure border is below text descenders
      fragmentEl.style.paddingBottom = borders.bottom ? '6px' : '0';
    }
  }

  // Apply shading (background color)
  if (block.attrs?.shading) {
    fragmentEl.style.backgroundColor = block.attrs.shading;
  }

  // Calculate available width for justify
  // Subtract indentation since those are applied as CSS margins on the fragment
  const availableWidth = fragment.width - indentLeft - indentRight;

  // Check if paragraph ends with line break (for justify last line handling)
  const lastRun = block.runs[block.runs.length - 1];
  const paragraphEndsWithLineBreak = lastRun?.kind === 'lineBreak';

  // Total number of lines in the paragraph (not just this fragment)
  const totalLines = measure.lines.length;

  // Calculate first line indent for tab positioning
  // Hanging indent is stored as positive value but means negative offset for first line
  let firstLineIndentPx = 0;
  if (indent?.hanging && indent.hanging > 0) {
    firstLineIndentPx = -indent.hanging; // Negative because first line starts further left
  } else if (indent?.firstLine && indent.firstLine > 0) {
    firstLineIndentPx = indent.firstLine; // Positive because first line is indented right
  }

  // Render each line with per-line floating margin calculation
  let cumulativeLineY = 0; // Track Y position within the fragment

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Calculate the actual line index in the full paragraph
    const lineIndex = fragment.fromLine + i;
    const isLastLine = lineIndex === totalLines - 1;
    // First line of the paragraph (not just this fragment)
    const isFirstLine = lineIndex === 0 && !fragment.continuesFromPrev;

    // Get per-line floating margins from measurement phase
    const lineLeftOffset = line.leftOffset ?? 0;
    const lineRightOffset = line.rightOffset ?? 0;

    const lineEl = renderLine(block, line, alignment, doc, {
      availableWidth: availableWidth - lineLeftOffset - lineRightOffset,
      isLastLine,
      isFirstLine,
      paragraphEndsWithLineBreak,
      tabStops: block.attrs?.tabs,
      leftIndentPx: indentLeft,
      firstLineIndentPx: isFirstLine ? firstLineIndentPx : 0,
      context,
      floatingMargins: { leftMargin: lineLeftOffset, rightMargin: lineRightOffset },
    });

    // Apply left offset from floating images (lines start after the floating image)
    if (lineLeftOffset > 0) {
      lineEl.style.marginLeft = `${lineLeftOffset}px`;
    }
    if (lineRightOffset > 0) {
      lineEl.style.marginRight = `${lineRightOffset}px`;
    }

    // Update cumulative Y for next line
    cumulativeLineY += line.lineHeight;

    // Apply line-level indentation
    // Indentation is applied per-line for correct text wrapping
    const hasHanging = indent?.hanging && indent.hanging > 0;
    const hasFirstLine = indent?.firstLine && indent.firstLine > 0;

    if (isFirstLine) {
      // First line handling
      if (indentLeft > 0 && hasHanging) {
        // Hanging indent: first line starts at (indentLeft - hanging)
        lineEl.style.paddingLeft = `${indentLeft}px`;
        lineEl.style.textIndent = `-${indent!.hanging}px`;
      } else if (indentLeft > 0 && hasFirstLine) {
        // First line indent: first line starts at (indentLeft + firstLine)
        lineEl.style.paddingLeft = `${indentLeft}px`;
        lineEl.style.textIndent = `${indent!.firstLine}px`;
      } else if (indentLeft > 0) {
        // Just left indent, no special first line treatment
        lineEl.style.paddingLeft = `${indentLeft}px`;
      } else if (hasFirstLine) {
        // No left indent, but has first line indent
        lineEl.style.textIndent = `${indent!.firstLine}px`;
      }
      // No hanging without left indent (handled by firstLineOffset in measurement)
    } else {
      // Body lines (not first line)
      if (indentLeft > 0) {
        lineEl.style.paddingLeft = `${indentLeft}px`;
      } else if (hasHanging) {
        // Hanging indent without left indent: body lines need padding = hanging
        lineEl.style.paddingLeft = `${indent!.hanging}px`;
      }
    }

    if (indentRight > 0) {
      lineEl.style.paddingRight = `${indentRight}px`;
    }

    // Add list marker to first line
    // List first lines have special handling:
    // - Marker starts at (indentLeft - hanging)
    // - Text starts at indentLeft
    // - The marker box fills the hanging space
    if (isFirstLine && block.attrs?.listMarker) {
      // Override padding for list first lines
      // Marker position = indentLeft - hanging (where first line content starts)
      const markerPos = Math.max(0, indentLeft - (indent?.hanging ?? 0));
      lineEl.style.paddingLeft = `${markerPos}px`;
      lineEl.style.textIndent = '0'; // Don't use textIndent for lists

      const marker = renderListMarker(block.attrs.listMarker, indent, doc);
      lineEl.insertBefore(marker, lineEl.firstChild);
    }

    // Append line directly to fragment (per-line margins are applied in renderLine)
    fragmentEl.appendChild(lineEl);
  }

  return fragmentEl;
}

/**
 * Render a list marker element
 *
 * The marker is rendered as an inline-block with a consistent space after it.
 * For short markers, the box fills the hanging indent area.
 * For long markers (like "1.1.1"), we ensure minimum spacing after the text.
 */
function renderListMarker(
  marker: string,
  indent: ParagraphIndent | undefined,
  doc: Document
): HTMLElement {
  const span = doc.createElement('span');
  span.className = 'layout-list-marker';
  span.style.display = 'inline-block';

  // In Word, the marker character is followed by a tab that extends to the
  // text indent position. We emulate this by left-aligning the marker within
  // the hanging indent box — the marker sits at the start and the remaining
  // space acts as the tab gap, just like Word.
  span.textContent = marker;

  // The marker box fills the hanging indent space
  const hanging = indent?.hanging ?? 24; // Default 24px if not specified

  // min-width so short markers fill the space; long markers can extend
  span.style.minWidth = `${hanging}px`;
  span.style.textAlign = 'left';
  span.style.boxSizing = 'border-box';

  return span;
}
