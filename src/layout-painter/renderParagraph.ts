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
  MeasuredLine,
  Run,
  TextRun,
  TabRun,
  ImageRun,
  LineBreakRun,
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
 * Options for rendering a paragraph
 */
export interface RenderParagraphOptions {
  /** Document to create elements in */
  document?: Document;
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
 * Apply text run styles to an element
 */
function applyRunStyles(element: HTMLElement, run: TextRun | TabRun): void {
  // Font properties
  if (run.fontFamily) {
    // Quote font names with spaces for proper CSS
    const fontName = run.fontFamily.includes(' ') ? `"${run.fontFamily}"` : run.fontFamily;
    element.style.fontFamily = `${fontName}, sans-serif`;
  }
  if (run.fontSize) {
    // fontSize is in points - use pt unit for browser to handle conversion
    // This matches how ProseMirror renders font sizes
    element.style.fontSize = `${run.fontSize}pt`;
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

  // Set text content
  span.textContent = run.text;

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
 * Render an inline image run
 */
function renderImageRun(run: ImageRun, doc: Document): HTMLElement {
  const img = doc.createElement('img');
  img.className = `${PARAGRAPH_CLASS_NAMES.run} ${PARAGRAPH_CLASS_NAMES.image}`;

  img.src = run.src;
  img.width = run.width;
  img.height = run.height;
  if (run.alt) {
    img.alt = run.alt;
  }

  applyPmPositions(img, run.pmStart, run.pmEnd);

  return img;
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
 * Render a single run (for non-tab runs)
 */
function renderRun(run: Run, doc: Document): HTMLElement {
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
  /** Left indent in pixels */
  leftIndentPx?: number;
  /** First line indent in pixels (positive) or hanging indent (negative) */
  firstLineIndentPx?: number;
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
function getTextAfterTab(runs: Run[], tabRunIndex: number): string {
  let text = '';
  for (let i = tabRunIndex + 1; i < runs.length; i++) {
    const run = runs[i];
    if (isTextRun(run)) {
      text += run.text;
    } else if (isTabRun(run) || isLineBreakRun(run)) {
      // Stop at next tab or line break
      break;
    }
  }
  return text;
}

/**
 * Create a text measurement function using a temporary canvas
 */
function createTextMeasurer(
  doc: Document
): (text: string, fontSize?: number, fontFamily?: string) => number {
  const canvas = doc.createElement('canvas');
  const ctx = canvas.getContext('2d');

  return (text: string, fontSize = 11, fontFamily = 'Calibri') => {
    if (!ctx) return text.length * 7; // Fallback estimate
    ctx.font = `${fontSize}pt ${fontFamily}`;
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

  // Use white-space: normal for justified text (needed for text-align to work)
  // and pre-wrap for others (to preserve multiple spaces)
  lineEl.style.whiteSpace = shouldJustify ? 'normal' : 'pre-wrap';

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
      const followingText = getTextAfterTab(runsForLine, i);

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
      const runEl = renderImageRun(run, doc);
      lineEl.appendChild(runEl);
      currentX += run.width;
    } else if (isLineBreakRun(run)) {
      const runEl = renderLineBreakRun(run, doc);
      lineEl.appendChild(runEl);
    } else {
      // Fallback for unknown run types
      const runEl = renderRun(run, doc);
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
  _context: RenderContext,
  options: RenderParagraphOptions = {}
): HTMLElement {
  const doc = options.document ?? document;

  const fragmentEl = doc.createElement('div');
  fragmentEl.className = PARAGRAPH_CLASS_NAMES.fragment;

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

  // Get the lines for this fragment
  const lines = measure.lines.slice(fragment.fromLine, fragment.toLine);
  const alignment = block.attrs?.alignment;

  // Apply paragraph-level styles
  if (block.attrs?.styleId) {
    fragmentEl.dataset.styleId = block.attrs.styleId;
  }

  // Apply text alignment at paragraph level
  // For justify: use text-align: left and apply word-spacing per line (like SuperDoc)
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

  // Apply indentation and track for justify calculation
  const indent = block.attrs?.indent;
  let indentLeft = 0;
  let indentRight = 0;

  if (indent) {
    // Left indent (margin, not padding, for proper text-indent interaction)
    if (indent.left && indent.left > 0) {
      fragmentEl.style.marginLeft = `${indent.left}px`;
      indentLeft = indent.left;
    }
    // Right indent
    if (indent.right && indent.right > 0) {
      fragmentEl.style.marginRight = `${indent.right}px`;
      indentRight = indent.right;
    }
    // First line indent or hanging indent
    // Only apply to first fragment (not continuation fragments)
    if (!fragment.continuesFromPrev) {
      if (indent.hanging && indent.hanging > 0) {
        // Hanging indent: first line is outdented (negative text-indent)
        fragmentEl.style.textIndent = `-${indent.hanging}px`;
        // Add padding to compensate so text doesn't go outside container
        fragmentEl.style.paddingLeft = `${indent.hanging}px`;
      } else if (indent.firstLine && indent.firstLine > 0) {
        // Regular first line indent
        fragmentEl.style.textIndent = `${indent.firstLine}px`;
      }
    }
  }

  // Apply line spacing if specified
  const spacing = block.attrs?.spacing;
  if (spacing?.line) {
    if (spacing.lineUnit === 'multiplier') {
      fragmentEl.style.lineHeight = String(spacing.line);
    } else if (spacing.lineUnit === 'px') {
      fragmentEl.style.lineHeight = `${spacing.line}px`;
    }
  }

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
    const hasBorder = borders.top || borders.bottom || borders.left || borders.right;
    if (hasBorder) {
      fragmentEl.style.paddingLeft = borders.left ? '4px' : '0';
      fragmentEl.style.paddingRight = borders.right ? '4px' : '0';
      fragmentEl.style.paddingTop = borders.top ? '2px' : '0';
      fragmentEl.style.paddingBottom = borders.bottom ? '2px' : '0';
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

  // Render each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Calculate the actual line index in the full paragraph
    const lineIndex = fragment.fromLine + i;
    const isLastLine = lineIndex === totalLines - 1;
    // First line of the paragraph (not just this fragment)
    const isFirstLine = lineIndex === 0 && !fragment.continuesFromPrev;

    const lineEl = renderLine(block, line, alignment, doc, {
      availableWidth,
      isLastLine,
      isFirstLine,
      paragraphEndsWithLineBreak,
      tabStops: block.attrs?.tabs,
      leftIndentPx: indentLeft,
      firstLineIndentPx: isFirstLine ? firstLineIndentPx : 0,
    });
    fragmentEl.appendChild(lineEl);
  }

  return fragmentEl;
}
