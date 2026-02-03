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
} from '../layout-engine/types';
import type { RenderContext } from './renderPage';

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
    element.style.fontFamily = run.fontFamily;
  }
  if (run.fontSize) {
    element.style.fontSize = `${run.fontSize}px`;
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
 * Render a tab run
 */
function renderTabRun(run: TabRun, doc: Document): HTMLElement {
  const span = doc.createElement('span');
  span.className = `${PARAGRAPH_CLASS_NAMES.run} ${PARAGRAPH_CLASS_NAMES.tab}`;

  // Apply tab width
  const width = run.width ?? 48; // Default 0.5 inch at 96 DPI
  span.style.display = 'inline-block';
  span.style.width = `${width}px`;

  applyPmPositions(span, run.pmStart, run.pmEnd);

  // Tab character for accessibility
  span.textContent = '\t';

  return span;
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
 * Render a single run
 */
function renderRun(run: Run, doc: Document): HTMLElement {
  if (isTextRun(run)) {
    return renderTextRun(run, doc);
  }
  if (isTabRun(run)) {
    return renderTabRun(run, doc);
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
 * Render a single line
 *
 * @param block - The paragraph block
 * @param line - The line measurement
 * @param alignment - Text alignment
 * @param doc - Document to create elements in
 * @returns The line DOM element
 */
export function renderLine(
  block: ParagraphBlock,
  line: MeasuredLine,
  alignment: 'left' | 'center' | 'right' | 'justify' | undefined,
  doc: Document
): HTMLElement {
  const lineEl = doc.createElement('div');
  lineEl.className = PARAGRAPH_CLASS_NAMES.line;

  // Apply line height
  lineEl.style.height = `${line.lineHeight}px`;
  lineEl.style.lineHeight = `${line.lineHeight}px`;

  // Apply text alignment
  if (alignment === 'center') {
    lineEl.style.textAlign = 'center';
  } else if (alignment === 'right') {
    lineEl.style.textAlign = 'right';
  } else {
    lineEl.style.textAlign = 'left';
  }

  // Use white-space: pre to preserve spaces
  lineEl.style.whiteSpace = 'pre';

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

  // Render each run
  for (const run of runsForLine) {
    const runEl = renderRun(run, doc);
    lineEl.appendChild(runEl);
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

  // Apply indentation
  const indent = block.attrs?.indent;
  if (indent) {
    if (indent.left && indent.left > 0) {
      fragmentEl.style.paddingLeft = `${indent.left}px`;
    }
    if (indent.right && indent.right > 0) {
      fragmentEl.style.paddingRight = `${indent.right}px`;
    }
  }

  // Render each line
  for (const line of lines) {
    const lineEl = renderLine(block, line, alignment, doc);
    fragmentEl.appendChild(lineEl);
  }

  return fragmentEl;
}
