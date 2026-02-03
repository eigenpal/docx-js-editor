/**
 * Fragment Renderer
 *
 * Renders individual fragments (paragraphs, tables, images) to DOM.
 * Each fragment is positioned within a page's content area.
 */

import type {
  Fragment,
  ParagraphFragment,
  TableFragment,
  ImageFragment,
} from '../layout-engine/types';
import type { RenderContext } from './renderPage';

/**
 * CSS class names for fragment elements
 */
export const FRAGMENT_CLASS_NAMES = {
  fragment: 'layout-fragment',
  paragraph: 'layout-fragment-paragraph',
  table: 'layout-fragment-table',
  image: 'layout-fragment-image',
  line: 'layout-line',
  run: 'layout-run',
};

/**
 * Options for rendering fragments
 */
export interface RenderFragmentOptions {
  /** Document to create elements in */
  document?: Document;
}

/**
 * Check if fragment is a paragraph fragment
 */
function isParagraphFragment(fragment: Fragment): fragment is ParagraphFragment {
  return fragment.kind === 'paragraph';
}

/**
 * Check if fragment is a table fragment
 */
function isTableFragment(fragment: Fragment): fragment is TableFragment {
  return fragment.kind === 'table';
}

/**
 * Check if fragment is an image fragment
 */
function isImageFragment(fragment: Fragment): fragment is ImageFragment {
  return fragment.kind === 'image';
}

/**
 * Apply base fragment styles
 */
function applyBaseFragmentStyles(element: HTMLElement): void {
  element.style.position = 'absolute';
  element.style.overflow = 'hidden';
}

/**
 * Render a paragraph fragment
 *
 * Note: The actual lines/runs are rendered separately since we need
 * access to the original ParagraphBlock and ParagraphMeasure.
 * This creates a placeholder that will be filled by the full painter.
 */
function renderParagraphFragmentPlaceholder(
  fragment: ParagraphFragment,
  _context: RenderContext,
  doc: Document
): HTMLElement {
  const el = doc.createElement('div');
  el.className = `${FRAGMENT_CLASS_NAMES.fragment} ${FRAGMENT_CLASS_NAMES.paragraph}`;
  applyBaseFragmentStyles(el);

  // Store fragment metadata
  el.dataset.blockId = String(fragment.blockId);
  el.dataset.fromLine = String(fragment.fromLine);
  el.dataset.toLine = String(fragment.toLine);

  if (fragment.pmStart !== undefined) {
    el.dataset.pmStart = String(fragment.pmStart);
  }
  if (fragment.pmEnd !== undefined) {
    el.dataset.pmEnd = String(fragment.pmEnd);
  }

  if (fragment.continuesFromPrev) {
    el.dataset.continuesFromPrev = 'true';
  }
  if (fragment.continuesOnNext) {
    el.dataset.continuesOnNext = 'true';
  }

  return el;
}

/**
 * Render a table fragment
 *
 * Note: Similar to paragraphs, actual table rendering requires
 * access to the TableBlock. This creates a placeholder.
 */
function renderTableFragmentPlaceholder(
  fragment: TableFragment,
  _context: RenderContext,
  doc: Document
): HTMLElement {
  const el = doc.createElement('div');
  el.className = `${FRAGMENT_CLASS_NAMES.fragment} ${FRAGMENT_CLASS_NAMES.table}`;
  applyBaseFragmentStyles(el);

  // Store fragment metadata
  el.dataset.blockId = String(fragment.blockId);
  el.dataset.fromRow = String(fragment.fromRow);
  el.dataset.toRow = String(fragment.toRow);

  if (fragment.pmStart !== undefined) {
    el.dataset.pmStart = String(fragment.pmStart);
  }
  if (fragment.pmEnd !== undefined) {
    el.dataset.pmEnd = String(fragment.pmEnd);
  }

  return el;
}

/**
 * Render an image fragment
 */
function renderImageFragmentPlaceholder(
  fragment: ImageFragment,
  _context: RenderContext,
  doc: Document
): HTMLElement {
  const el = doc.createElement('div');
  el.className = `${FRAGMENT_CLASS_NAMES.fragment} ${FRAGMENT_CLASS_NAMES.image}`;
  applyBaseFragmentStyles(el);

  // Store fragment metadata
  el.dataset.blockId = String(fragment.blockId);

  if (fragment.pmStart !== undefined) {
    el.dataset.pmStart = String(fragment.pmStart);
  }
  if (fragment.pmEnd !== undefined) {
    el.dataset.pmEnd = String(fragment.pmEnd);
  }

  if (fragment.isAnchored) {
    el.dataset.anchored = 'true';
  }

  // Set z-index for layering
  if (fragment.zIndex !== undefined) {
    el.style.zIndex = String(fragment.zIndex);
  }

  return el;
}

/**
 * Render a fragment to DOM
 *
 * @param fragment - The fragment to render
 * @param context - Rendering context
 * @param options - Rendering options
 * @returns The fragment DOM element
 */
export function renderFragment(
  fragment: Fragment,
  context: RenderContext,
  options: RenderFragmentOptions = {}
): HTMLElement {
  const doc = options.document ?? document;

  if (isParagraphFragment(fragment)) {
    return renderParagraphFragmentPlaceholder(fragment, context, doc);
  }

  if (isTableFragment(fragment)) {
    return renderTableFragmentPlaceholder(fragment, context, doc);
  }

  if (isImageFragment(fragment)) {
    return renderImageFragmentPlaceholder(fragment, context, doc);
  }

  // Fallback for unknown fragment types
  // This should not happen with current types, but provides safety
  const el = doc.createElement('div');
  el.className = FRAGMENT_CLASS_NAMES.fragment;
  applyBaseFragmentStyles(el);

  // Cast to access common properties
  const unknownFragment = fragment as { blockId?: unknown; kind?: string };
  if (unknownFragment.blockId !== undefined) {
    el.dataset.blockId = String(unknownFragment.blockId);
  }
  if (unknownFragment.kind) {
    el.dataset.kind = unknownFragment.kind;
  }

  return el;
}
