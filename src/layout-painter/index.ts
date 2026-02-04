/**
 * Layout Painter
 *
 * Main entry point for rendering Layout data to DOM.
 * Provides reconciliation for efficient incremental updates.
 */

import type {
  Layout,
  Page,
  Fragment,
  FlowBlock,
  Measure,
  ParagraphBlock,
  ParagraphMeasure,
  ParagraphFragment,
  TableBlock,
  TableMeasure,
  TableFragment,
} from '../layout-engine/types';
import { renderPage, renderPages, updatePage, type RenderContext } from './renderPage';
import { renderParagraphFragment, sliceRunsForLine, renderLine } from './renderParagraph';
import { renderFragment, FRAGMENT_CLASS_NAMES } from './renderFragment';
import { renderTableFragment, TABLE_CLASS_NAMES } from './renderTable';

// Re-export render functions
export {
  renderPage,
  renderPages,
  updatePage,
  renderParagraphFragment,
  renderTableFragment,
  renderFragment,
  sliceRunsForLine,
  renderLine,
  FRAGMENT_CLASS_NAMES,
  TABLE_CLASS_NAMES,
  type RenderContext,
};

/**
 * Block lookup entry for painter
 */
export interface BlockLookupEntry {
  block: FlowBlock;
  measure: Measure;
  version?: string;
}

/**
 * Block lookup map type
 */
export type BlockLookup = Map<string, BlockLookupEntry>;

/**
 * Painter options
 */
export interface PainterOptions {
  /** Document to create elements in */
  document?: Document;
  /** Gap between pages in pixels */
  pageGap?: number;
  /** Show page shadows */
  showShadow?: boolean;
  /** Background color for pages */
  pageBackground?: string;
  /** Container background color */
  containerBackground?: string;
}

/**
 * Page DOM state for reconciliation
 */
interface PageState {
  element: HTMLElement;
  pageNumber: number;
  fragmentCount: number;
}

/**
 * Layout Painter class
 *
 * Renders Layout data to DOM with efficient reconciliation.
 * Only updates changed pages and fragments for better performance.
 */
export class LayoutPainter {
  private container: HTMLElement | null = null;
  private blockLookup: BlockLookup = new Map();
  private pageStates: PageState[] = [];
  private totalPages = 0;
  private options: PainterOptions;
  private doc: Document;

  constructor(options: PainterOptions = {}) {
    this.options = options;
    this.doc = options.document ?? document;
  }

  /**
   * Set the block lookup map for rendering fragments
   */
  setBlockLookup(lookup: BlockLookup): void {
    this.blockLookup = lookup;
  }

  /**
   * Mount the painter to a container element
   */
  mount(container: HTMLElement): void {
    this.container = container;
    this.applyContainerStyles();
  }

  /**
   * Unmount the painter
   */
  unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.pageStates = [];
  }

  /**
   * Apply styles to the container
   */
  private applyContainerStyles(): void {
    if (!this.container) return;

    const pageGap = this.options.pageGap ?? 24;

    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.alignItems = 'center';
    this.container.style.gap = `${pageGap}px`;
    this.container.style.padding = `${pageGap}px`;
    this.container.style.backgroundColor = this.options.containerBackground ?? '#e0e0e0';
    this.container.style.minHeight = '100%';
  }

  /**
   * Paint a layout to the container
   */
  paint(layout: Layout): void {
    if (!this.container) {
      throw new Error('LayoutPainter: not mounted');
    }

    const { pages } = layout;
    this.totalPages = pages.length;

    // Full repaint for now (reconciliation can be added later)
    this.container.innerHTML = '';
    this.pageStates = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const context: RenderContext = {
        pageNumber: page.number,
        totalPages: this.totalPages,
        section: 'body',
      };

      const pageEl = this.renderPageWithLookup(page, context);
      this.container.appendChild(pageEl);

      this.pageStates.push({
        element: pageEl,
        pageNumber: page.number,
        fragmentCount: page.fragments.length,
      });
    }
  }

  /**
   * Render a page using block lookup for full fragment rendering
   */
  private renderPageWithLookup(page: Page, context: RenderContext): HTMLElement {
    const pageEl = this.doc.createElement('div');
    pageEl.className = 'layout-page';
    pageEl.dataset.pageNumber = String(page.number);

    // Apply page styles
    pageEl.style.position = 'relative';
    pageEl.style.width = `${page.size.w}px`;
    pageEl.style.height = `${page.size.h}px`;
    pageEl.style.backgroundColor = this.options.pageBackground ?? '#ffffff';
    pageEl.style.overflow = 'hidden';

    if (this.options.showShadow) {
      pageEl.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    }

    // Create content area
    const contentEl = this.doc.createElement('div');
    contentEl.className = 'layout-page-content';
    contentEl.style.position = 'absolute';
    contentEl.style.top = `${page.margins.top}px`;
    contentEl.style.left = `${page.margins.left}px`;
    contentEl.style.right = `${page.margins.right}px`;
    contentEl.style.bottom = `${page.margins.bottom}px`;
    contentEl.style.overflow = 'visible';

    // Render fragments
    for (const fragment of page.fragments) {
      const fragmentEl = this.renderFragmentWithLookup(fragment, context);
      this.applyFragmentPosition(fragmentEl, fragment);
      contentEl.appendChild(fragmentEl);
    }

    pageEl.appendChild(contentEl);
    return pageEl;
  }

  /**
   * Render a fragment using block lookup for full content rendering
   */
  private renderFragmentWithLookup(fragment: Fragment, context: RenderContext): HTMLElement {
    const lookup = this.blockLookup.get(String(fragment.blockId));

    if (fragment.kind === 'paragraph' && lookup) {
      const block = lookup.block as ParagraphBlock;
      const measure = lookup.measure as ParagraphMeasure;
      return renderParagraphFragment(fragment as ParagraphFragment, block, measure, context, {
        document: this.doc,
      });
    }

    if (fragment.kind === 'table' && lookup) {
      const block = lookup.block as TableBlock;
      const measure = lookup.measure as TableMeasure;
      return renderTableFragment(fragment as TableFragment, block, measure, context, {
        document: this.doc,
      });
    }

    // Fallback to placeholder for other fragment types
    return renderFragment(fragment, context, { document: this.doc });
  }

  /**
   * Apply positioning styles to a fragment element
   */
  private applyFragmentPosition(element: HTMLElement, fragment: Fragment): void {
    element.style.position = 'absolute';
    element.style.left = `${fragment.x}px`;
    element.style.top = `${fragment.y}px`;
    element.style.width = `${fragment.width}px`;

    if ('height' in fragment) {
      element.style.height = `${fragment.height}px`;
    }
  }

  /**
   * Get the current page count
   */
  getPageCount(): number {
    return this.totalPages;
  }

  /**
   * Get a page element by index
   */
  getPageElement(index: number): HTMLElement | null {
    return this.pageStates[index]?.element ?? null;
  }

  /**
   * Scroll to a specific page
   */
  scrollToPage(pageNumber: number): void {
    const state = this.pageStates.find((s) => s.pageNumber === pageNumber);
    if (state?.element) {
      state.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

/**
 * Create a new LayoutPainter instance
 */
export function createPainter(options?: PainterOptions): LayoutPainter {
  return new LayoutPainter(options);
}
