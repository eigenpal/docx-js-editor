/**
 * Page Renderer
 *
 * Renders a single page from Layout data to DOM elements.
 * Each page contains positioned fragments within a content area.
 */

import type {
  Page,
  Fragment,
  FlowBlock,
  Measure,
  ParagraphBlock,
  ParagraphMeasure,
  ParagraphFragment,
} from '../layout-engine/types';
import { renderFragment } from './renderFragment';
import { renderParagraphFragment } from './renderParagraph';

/**
 * CSS class names for page elements
 */
export const PAGE_CLASS_NAMES = {
  page: 'layout-page',
  content: 'layout-page-content',
  header: 'layout-page-header',
  footer: 'layout-page-footer',
};

/**
 * Context passed to fragment renderers
 */
export interface RenderContext {
  /** Current page number (1-indexed) */
  pageNumber: number;
  /** Total number of pages */
  totalPages: number;
  /** Which section is being rendered */
  section: 'body' | 'header' | 'footer';
}

/**
 * Header/footer content for rendering
 */
export interface HeaderFooterContent {
  /** Flow blocks for the header/footer content. */
  blocks: FlowBlock[];
  /** Measurements for the blocks. */
  measures: Measure[];
  /** Total height of the content. */
  height: number;
}

/**
 * Options for rendering a page
 */
export interface RenderPageOptions {
  /** Document to create elements in (default: window.document) */
  document?: Document;
  /** Custom page class name */
  pageClassName?: string;
  /** Show page borders (for debugging) */
  showBorders?: boolean;
  /** Background color for pages */
  backgroundColor?: string;
  /** Drop shadow on pages */
  showShadow?: boolean;
  /** Header content to render. */
  headerContent?: HeaderFooterContent;
  /** Footer content to render. */
  footerContent?: HeaderFooterContent;
  /** Distance from page top to header content. */
  headerDistance?: number;
  /** Distance from page bottom to footer content. */
  footerDistance?: number;
}

/**
 * Apply page styles to an element
 */
function applyPageStyles(
  element: HTMLElement,
  width: number,
  height: number,
  options: RenderPageOptions
): void {
  element.style.position = 'relative';
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  element.style.backgroundColor = options.backgroundColor ?? '#ffffff';
  element.style.overflow = 'hidden';

  if (options.showBorders) {
    element.style.border = '1px solid #ccc';
  }

  if (options.showShadow) {
    element.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
  }
}

/**
 * Apply content area styles to an element
 */
function applyContentAreaStyles(element: HTMLElement, page: Page): void {
  const margins = page.margins;

  element.style.position = 'absolute';
  element.style.top = `${margins.top}px`;
  element.style.left = `${margins.left}px`;
  element.style.right = `${margins.right}px`;
  element.style.bottom = `${margins.bottom}px`;
  element.style.overflow = 'visible';
}

/**
 * Apply fragment positioning styles
 */
function applyFragmentStyles(element: HTMLElement, fragment: Fragment): void {
  element.style.position = 'absolute';
  element.style.left = `${fragment.x}px`;
  element.style.top = `${fragment.y}px`;
  element.style.width = `${fragment.width}px`;

  // Height handling varies by fragment type
  if ('height' in fragment) {
    element.style.height = `${fragment.height}px`;
  }
}

/**
 * Render header or footer content
 */
function renderHeaderFooterContent(
  content: HeaderFooterContent,
  context: RenderContext,
  options: RenderPageOptions
): HTMLElement {
  const doc = options.document ?? document;
  const containerEl = doc.createElement('div');
  containerEl.style.position = 'relative';

  let cursorY = 0;

  for (let i = 0; i < content.blocks.length; i++) {
    const block = content.blocks[i];
    const measure = content.measures[i];

    if (block?.kind === 'paragraph' && measure?.kind === 'paragraph') {
      const paragraphBlock = block as ParagraphBlock;
      const paragraphMeasure = measure as ParagraphMeasure;

      // Create a synthetic fragment for the paragraph
      const syntheticFragment: ParagraphFragment = {
        kind: 'paragraph',
        blockId: paragraphBlock.id,
        x: 0,
        y: cursorY,
        width: 500, // Will be overridden by container width
        height: paragraphMeasure.totalHeight,
        fromLine: 0,
        toLine: paragraphMeasure.lines.length,
      };

      // Render paragraph fragment
      const fragEl = renderParagraphFragment(
        syntheticFragment,
        paragraphBlock,
        paragraphMeasure,
        context,
        { document: doc }
      );

      // Position the fragment
      fragEl.style.position = 'relative';
      fragEl.style.marginBottom = '0';

      containerEl.appendChild(fragEl);
      cursorY += paragraphMeasure.totalHeight;
    }
  }

  return containerEl;
}

/**
 * Render a single page to DOM
 *
 * @param page - The page to render
 * @param context - Rendering context
 * @param options - Rendering options
 * @returns The page DOM element
 */
export function renderPage(
  page: Page,
  context: RenderContext,
  options: RenderPageOptions = {}
): HTMLElement {
  const doc = options.document ?? document;

  // Create page container
  const pageEl = doc.createElement('div');
  pageEl.className = options.pageClassName ?? PAGE_CLASS_NAMES.page;
  pageEl.dataset.pageNumber = String(page.number);

  applyPageStyles(pageEl, page.size.w, page.size.h, options);

  // Create content area
  const contentEl = doc.createElement('div');
  contentEl.className = PAGE_CLASS_NAMES.content;
  applyContentAreaStyles(contentEl, page);

  // Render each fragment
  for (const fragment of page.fragments) {
    const fragmentEl = renderFragment(
      fragment,
      { ...context, section: 'body' },
      {
        document: doc,
      }
    );

    applyFragmentStyles(fragmentEl, fragment);
    contentEl.appendChild(fragmentEl);
  }

  pageEl.appendChild(contentEl);

  // Render header if provided
  if (options.headerContent && options.headerContent.blocks.length > 0) {
    const headerDistance = options.headerDistance ?? page.margins.header ?? page.margins.top;
    const headerEl = doc.createElement('div');
    headerEl.className = PAGE_CLASS_NAMES.header;
    headerEl.style.position = 'absolute';
    headerEl.style.top = `${headerDistance}px`;
    headerEl.style.left = `${page.margins.left}px`;
    headerEl.style.right = `${page.margins.right}px`;
    headerEl.style.width = `${page.size.w - page.margins.left - page.margins.right}px`;

    const headerContentEl = renderHeaderFooterContent(
      options.headerContent,
      { ...context, section: 'header' },
      options
    );
    headerEl.appendChild(headerContentEl);
    pageEl.appendChild(headerEl);
  }

  // Render footer if provided
  if (options.footerContent && options.footerContent.blocks.length > 0) {
    const footerDistance = options.footerDistance ?? page.margins.footer ?? page.margins.bottom;
    const footerEl = doc.createElement('div');
    footerEl.className = PAGE_CLASS_NAMES.footer;
    footerEl.style.position = 'absolute';
    footerEl.style.bottom = `${footerDistance}px`;
    footerEl.style.left = `${page.margins.left}px`;
    footerEl.style.right = `${page.margins.right}px`;
    footerEl.style.width = `${page.size.w - page.margins.left - page.margins.right}px`;

    const footerContentEl = renderHeaderFooterContent(
      options.footerContent,
      { ...context, section: 'footer' },
      options
    );
    footerEl.appendChild(footerContentEl);
    pageEl.appendChild(footerEl);
  }

  return pageEl;
}

/**
 * Render multiple pages to a container
 *
 * @param pages - Array of pages to render
 * @param container - Container element to append pages to
 * @param options - Rendering options
 */
export function renderPages(
  pages: Page[],
  container: HTMLElement,
  options: RenderPageOptions & { pageGap?: number } = {}
): void {
  const totalPages = pages.length;
  const pageGap = options.pageGap ?? 24;

  // Clear existing content
  container.innerHTML = '';

  // Apply container styles
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.gap = `${pageGap}px`;
  container.style.padding = `${pageGap}px`;
  container.style.backgroundColor = '#e0e0e0';

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const context: RenderContext = {
      pageNumber: page.number,
      totalPages,
      section: 'body',
    };

    const pageEl = renderPage(page, context, options);
    container.appendChild(pageEl);
  }
}

/**
 * Update a single page (for incremental rendering)
 *
 * @param pageEl - Existing page element to update
 * @param page - New page data
 * @param context - Rendering context
 * @param options - Rendering options
 */
export function updatePage(
  pageEl: HTMLElement,
  page: Page,
  context: RenderContext,
  options: RenderPageOptions = {}
): void {
  const doc = options.document ?? document;

  // Find or create content area
  let contentEl = pageEl.querySelector(`.${PAGE_CLASS_NAMES.content}`) as HTMLElement;
  if (!contentEl) {
    contentEl = doc.createElement('div');
    contentEl.className = PAGE_CLASS_NAMES.content;
    applyContentAreaStyles(contentEl, page);
    pageEl.appendChild(contentEl);
  }

  // Clear existing fragments
  contentEl.innerHTML = '';

  // Re-render fragments
  for (const fragment of page.fragments) {
    const fragmentEl = renderFragment(
      fragment,
      { ...context, section: 'body' },
      {
        document: doc,
      }
    );

    applyFragmentStyles(fragmentEl, fragment);
    contentEl.appendChild(fragmentEl);
  }
}
