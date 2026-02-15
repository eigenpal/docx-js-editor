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
  TableBlock,
  TableMeasure,
  TableFragment,
  ImageBlock,
  ImageMeasure,
  ImageFragment,
  ImageRun,
} from '../layout-engine/types';
import { renderFragment } from './renderFragment';
import { renderParagraphFragment, type FloatingImageInfo } from './renderParagraph';
import { renderTableFragment } from './renderTable';
import { renderImageFragment } from './renderImage';
import type { BlockLookup } from './index';
import type { BorderSpec } from '../types/document';
import { borderToStyle } from '../utils/formatToStyle';
import type { Theme } from '../types/document';

/**
 * Page-level floating image that has been extracted from paragraphs.
 * These are positioned absolutely within the page's content area.
 */
interface PageFloatingImage {
  src: string;
  width: number;
  height: number;
  alt?: string;
  transform?: string;
  /** Which side: 'left' for left margin, 'right' for right margin */
  side: 'left' | 'right';
  /** X position relative to content area (0 = left edge of content) */
  x: number;
  /** Y position relative to content area (0 = top of content) */
  y: number;
  /** Wrap distances */
  distTop: number;
  distBottom: number;
  distLeft: number;
  distRight: number;
}

/**
 * Floating object exclusion rectangle used for text wrapping.
 */
interface FloatingExclusionRect {
  /** Which side: 'left' for left margin, 'right' for right margin */
  side: 'left' | 'right';
  /** X position relative to content area (0 = left edge of content) */
  x: number;
  /** Y position relative to content area (0 = top of content) */
  y: number;
  /** Object dimensions */
  width: number;
  height: number;
  /** Wrap distances */
  distTop: number;
  distBottom: number;
  distLeft: number;
  distRight: number;
}

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
  /** Content width in pixels (page width minus margins) - used for justify */
  contentWidth?: number;
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
  /** Block lookup for rendering actual content. */
  blockLookup?: BlockLookup;
  /** OOXML page borders from section properties. */
  pageBorders?: {
    top?: BorderSpec;
    bottom?: BorderSpec;
    left?: BorderSpec;
    right?: BorderSpec;
    offsetFrom?: 'page' | 'text';
  };
  /** Theme for resolving border colors. */
  theme?: Theme | null;
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

  // Set default font styles (matches Word default: 11pt Calibri)
  // Individual runs will override these with their own font settings
  element.style.fontFamily = 'Calibri, "Segoe UI", Arial, sans-serif';
  // Use pixels to match Canvas-based measurements (11pt = 11 * 96/72 ≈ 14.67px)
  element.style.fontSize = `${(11 * 96) / 72}px`;
  element.style.color = '#000000';

  if (options.showBorders) {
    element.style.border = '1px solid #ccc';
  }

  if (options.showShadow) {
    element.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
  }

  // Apply OOXML page borders
  if (options.pageBorders) {
    const pb = options.pageBorders;
    const sides = ['top', 'bottom', 'left', 'right'] as const;
    const cssSides = ['Top', 'Bottom', 'Left', 'Right'] as const;

    for (let i = 0; i < sides.length; i++) {
      const border = pb[sides[i]];
      if (border && border.style !== 'none' && border.style !== 'nil') {
        const styles = borderToStyle(border, cssSides[i], options.theme);
        for (const [key, value] of Object.entries(styles)) {
          (element.style as unknown as Record<string, string>)[key] = String(value);
        }
      }
    }
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
 * Note: Fragment x/y include page margins, but fragments are positioned
 * inside the content area which already has margin offsets applied.
 * So we subtract the margins to get content-area-relative positions.
 */
function applyFragmentStyles(
  element: HTMLElement,
  fragment: Fragment,
  margins: { left: number; top: number }
): void {
  element.style.position = 'absolute';
  element.style.left = `${fragment.x - margins.left}px`;
  element.style.top = `${fragment.y - margins.top}px`;
  element.style.width = `${fragment.width}px`;

  // Height handling varies by fragment type
  if ('height' in fragment) {
    element.style.height = `${fragment.height}px`;
  }
}

/**
 * EMU to pixels conversion for floating image positioning
 */
function emuToPixels(emu: number | undefined): number {
  if (emu === undefined) return 0;
  return Math.round((emu * 96) / 914400);
}

/**
 * Check if an image run is a floating image (should be positioned at page level)
 */
function isFloatingImageRun(run: ImageRun): boolean {
  const wrapType = run.wrapType;
  const displayMode = run.displayMode;

  // Floating images have specific wrap types that allow text to flow around them
  if (wrapType && ['square', 'tight', 'through'].includes(wrapType)) {
    return true;
  }

  // Or explicit float display mode
  if (displayMode === 'float') {
    return true;
  }

  return false;
}

/**
 * Extract floating images from a paragraph block and determine their page-level positions.
 * Returns extracted images and info for the paragraph about space reserved.
 */
function extractFloatingImagesFromParagraph(
  block: ParagraphBlock,
  fragmentY: number, // Y position of the paragraph fragment on the page (relative to content area)
  contentWidth: number // Width of the content area
): PageFloatingImage[] {
  const floatingImages: PageFloatingImage[] = [];

  for (const run of block.runs) {
    if (run.kind !== 'image') continue;
    const imgRun = run as ImageRun;

    if (!isFloatingImageRun(imgRun)) continue;

    // Determine position based on image attributes
    const position = imgRun.position;
    const distTop = imgRun.distTop ?? 0;
    const distBottom = imgRun.distBottom ?? 0;
    const distLeft = imgRun.distLeft ?? 12;
    const distRight = imgRun.distRight ?? 12;

    // Determine horizontal position (left or right side)
    let side: 'left' | 'right' = 'left';
    let x = 0;

    if (position?.horizontal) {
      const h = position.horizontal;
      if (h.align === 'right') {
        side = 'right';
        // Position from right edge of content
        x = contentWidth - imgRun.width;
      } else if (h.align === 'left') {
        side = 'left';
        x = 0;
      } else if (h.align === 'center') {
        side = 'left'; // Treat centered as left-aligned for simplicity
        x = (contentWidth - imgRun.width) / 2;
      } else if (h.posOffset !== undefined) {
        // Explicit offset from margin
        x = emuToPixels(h.posOffset);
        side = x > contentWidth / 2 ? 'right' : 'left';
      }
    } else if (imgRun.cssFloat === 'right') {
      side = 'right';
      x = contentWidth - imgRun.width;
    }

    // Determine vertical position
    let y = 0;

    if (position?.vertical) {
      const v = position.vertical;
      if (v.align === 'top') {
        // Align to top of margin area
        y = 0;
      } else if (v.align === 'bottom') {
        // Would need page height - not supported, use paragraph position
        y = fragmentY;
      } else if (v.posOffset !== undefined) {
        y = emuToPixels(v.posOffset);
      } else {
        // Default to paragraph position
        y = fragmentY;
      }

      // Check relativeTo for positioning context
      if (v.relativeTo === 'margin' && (v.align === 'top' || v.posOffset !== undefined)) {
        // Already in content-relative coordinates (margin = content area)
      } else if (v.relativeTo === 'paragraph') {
        // Add fragment Y offset
        y = fragmentY + y;
      }
    } else {
      // Default: position at paragraph
      y = fragmentY;
    }

    floatingImages.push({
      src: imgRun.src,
      width: imgRun.width,
      height: imgRun.height,
      alt: imgRun.alt,
      transform: imgRun.transform,
      side,
      x,
      y,
      distTop,
      distBottom,
      distLeft,
      distRight,
    });
  }

  return floatingImages;
}

/**
 * Calculate exclusion zones for floating images on a page.
 * Used to determine which paragraphs need margin adjustments.
 */
function calculateExclusionZones(
  rects: FloatingExclusionRect[],
  contentWidth: number
): FloatingImageInfo[] {
  const result: FloatingImageInfo[] = [];

  // Track the max extent on each side
  let leftExtent = 0;
  let rightExtent = 0;
  let topBound = Infinity;
  let bottomBound = 0;

  for (const rect of rects) {
    const rectLeft = rect.x - rect.distLeft;
    const rectRight = rect.x + rect.width + rect.distRight;
    const rectTop = rect.y - rect.distTop;
    const rectBottom = rect.y + rect.height + rect.distBottom;

    if (rect.side === 'left') {
      leftExtent = Math.max(leftExtent, rectRight);
    } else {
      rightExtent = Math.max(rightExtent, contentWidth - rectLeft);
    }

    topBound = Math.min(topBound, rectTop);
    bottomBound = Math.max(bottomBound, rectBottom);
  }

  // Create a single exclusion zone that covers all floating images
  if (leftExtent > 0 || rightExtent > 0) {
    result.push({
      leftMargin: leftExtent,
      rightMargin: rightExtent,
      topY: topBound === Infinity ? 0 : topBound,
      bottomY: bottomBound,
    });
  }

  return result;
}

/**
 * Render floating images into a page-level layer
 */
function renderFloatingImagesLayer(
  floatingImages: PageFloatingImage[],
  doc: Document
): HTMLElement {
  const layer = doc.createElement('div');
  layer.className = 'layout-floating-images-layer';
  layer.style.position = 'absolute';
  layer.style.top = '0';
  layer.style.left = '0';
  layer.style.right = '0';
  layer.style.bottom = '0';
  layer.style.pointerEvents = 'none'; // Allow clicks to pass through
  layer.style.zIndex = '10';

  for (const floatImg of floatingImages) {
    const container = doc.createElement('div');
    container.className = 'layout-page-floating-image';
    container.style.position = 'absolute';
    container.style.pointerEvents = 'auto'; // Make images clickable
    container.style.top = `${floatImg.y}px`;
    container.style.left = `${floatImg.x}px`;

    const img = doc.createElement('img');
    img.src = floatImg.src;
    img.width = floatImg.width;
    img.height = floatImg.height;
    if (floatImg.alt) img.alt = floatImg.alt;
    if (floatImg.transform) img.style.transform = floatImg.transform;

    container.appendChild(img);
    layer.appendChild(container);
  }

  return layer;
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

  // Use content width from context if available, otherwise default to reasonable width
  const contentWidth = context.contentWidth ?? 600;

  // Collect floating images to render separately, with their paragraph's Y position
  const floatingImages: Array<{
    src: string;
    width: number;
    height: number;
    alt?: string;
    paragraphY: number; // Y position of the containing paragraph
    position: {
      horizontal?: { relativeTo?: string; posOffset?: number; align?: string };
      vertical?: { relativeTo?: string; posOffset?: number; align?: string };
    };
  }> = [];

  let cursorY = 0;

  for (let i = 0; i < content.blocks.length; i++) {
    const block = content.blocks[i];
    const measure = content.measures[i];

    if (block?.kind === 'paragraph' && measure?.kind === 'paragraph') {
      const paragraphBlock = block as ParagraphBlock;
      const paragraphMeasure = measure as ParagraphMeasure;

      // Track the Y position where this paragraph starts
      const paragraphStartY = cursorY;

      // Extract floating images and filter them from runs
      const inlineRuns: typeof paragraphBlock.runs = [];
      for (const run of paragraphBlock.runs) {
        if (run.kind === 'image' && 'position' in run && run.position) {
          const imgRun = run as {
            kind: 'image';
            src: string;
            width: number;
            height: number;
            alt?: string;
            position: {
              horizontal?: { relativeTo?: string; posOffset?: number; align?: string };
              vertical?: { relativeTo?: string; posOffset?: number; align?: string };
            };
          };
          floatingImages.push({
            src: imgRun.src,
            width: imgRun.width,
            height: imgRun.height,
            alt: imgRun.alt,
            paragraphY: paragraphStartY, // Store where this paragraph starts
            position: imgRun.position,
          });
        } else {
          // Keep non-floating runs for inline rendering
          inlineRuns.push(run);
        }
      }

      // Create a modified paragraph block without floating images
      const inlineBlock: ParagraphBlock = {
        ...paragraphBlock,
        runs: inlineRuns,
      };

      // Create a synthetic fragment for the paragraph
      const syntheticFragment: ParagraphFragment = {
        kind: 'paragraph',
        blockId: paragraphBlock.id,
        x: 0,
        y: cursorY,
        width: contentWidth,
        height: paragraphMeasure.totalHeight,
        fromLine: 0,
        toLine: paragraphMeasure.lines.length,
      };

      // Render paragraph fragment (with floating images filtered out)
      const fragEl = renderParagraphFragment(
        syntheticFragment,
        inlineBlock,
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

  // Render floating images with absolute positioning
  for (const floatImg of floatingImages) {
    const img = doc.createElement('img');
    img.src = floatImg.src;
    img.width = floatImg.width;
    img.height = floatImg.height;
    if (floatImg.alt) img.alt = floatImg.alt;

    img.style.position = 'absolute';

    // Horizontal positioning
    const h = floatImg.position.horizontal;
    if (h) {
      if (h.align === 'right') {
        img.style.right = '0';
      } else if (h.align === 'center') {
        img.style.left = '50%';
        img.style.transform = 'translateX(-50%)';
      } else if (h.posOffset !== undefined) {
        // posOffset is in EMUs, convert to pixels
        img.style.left = `${emuToPixels(h.posOffset)}px`;
      } else {
        img.style.left = '0';
      }
    }

    // Vertical positioning - relative to containing paragraph
    const v = floatImg.position.vertical;
    if (v) {
      // Calculate base Y from paragraph position (for relativeFrom="paragraph")
      const baseY = floatImg.paragraphY;

      if (v.align === 'bottom') {
        img.style.bottom = '0';
      } else if (v.align === 'center') {
        img.style.top = '50%';
        img.style.transform = (img.style.transform || '') + ' translateY(-50%)';
      } else if (v.posOffset !== undefined) {
        // Add offset to paragraph's Y position
        img.style.top = `${baseY + emuToPixels(v.posOffset)}px`;
      } else {
        img.style.top = `${baseY}px`;
      }
    } else {
      // No vertical positioning - place at paragraph start
      img.style.top = `${floatImg.paragraphY}px`;
    }

    containerEl.appendChild(img);
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

  // Calculate content width for justify alignment
  const contentWidth = page.size.w - page.margins.left - page.margins.right;

  // PHASE 1: Extract all floating images from paragraphs on this page
  const allFloatingImages: PageFloatingImage[] = [];
  const floatingRects: FloatingExclusionRect[] = [];

  for (const fragment of page.fragments) {
    if (fragment.kind === 'paragraph' && options.blockLookup) {
      const blockData = options.blockLookup.get(String(fragment.blockId));
      if (blockData?.block.kind === 'paragraph') {
        const paragraphBlock = blockData.block as ParagraphBlock;
        // Fragment Y is relative to page top, we need it relative to content area
        const contentRelativeY = fragment.y - page.margins.top;
        const extracted = extractFloatingImagesFromParagraph(
          paragraphBlock,
          contentRelativeY,
          contentWidth
        );
        allFloatingImages.push(...extracted);
      }
    }
  }

  // Collect floating image exclusion rectangles
  for (const img of allFloatingImages) {
    floatingRects.push({
      side: img.side,
      x: img.x,
      y: img.y,
      width: img.width,
      height: img.height,
      distTop: img.distTop,
      distBottom: img.distBottom,
      distLeft: img.distLeft,
      distRight: img.distRight,
    });
  }

  // Collect floating table exclusion rectangles
  if (options.blockLookup) {
    for (const fragment of page.fragments) {
      if (fragment.kind !== 'table') continue;
      const blockData = options.blockLookup.get(String(fragment.blockId));
      if (blockData?.block.kind !== 'table') continue;
      const tableBlock = blockData.block as TableBlock;
      const floating = tableBlock.floating;
      if (!floating) continue;

      const contentX = fragment.x - page.margins.left;
      const contentY = fragment.y - page.margins.top;

      const distTop = floating.topFromText ?? 0;
      const distBottom = floating.bottomFromText ?? 0;
      const distLeft = floating.leftFromText ?? 12;
      const distRight = floating.rightFromText ?? 12;

      const side = contentX < contentWidth / 2 ? 'left' : 'right';

      floatingRects.push({
        side,
        x: contentX,
        y: contentY,
        width: fragment.width,
        height: fragment.height,
        distTop,
        distBottom,
        distLeft,
        distRight,
      });
    }
  }

  // PHASE 2: Calculate exclusion zones from floating objects
  const exclusionZones = calculateExclusionZones(floatingRects, contentWidth);

  // PHASE 3: Render floating images in a page-level layer
  if (allFloatingImages.length > 0) {
    const floatingLayer = renderFloatingImagesLayer(allFloatingImages, doc);
    contentEl.appendChild(floatingLayer);
  }

  // PHASE 4: Render each fragment with floating image awareness
  for (const fragment of page.fragments) {
    let fragmentEl: HTMLElement;
    const fragmentContext = { ...context, section: 'body' as const, contentWidth };

    // Calculate fragment's Y position relative to content area (for per-line margin calculation)
    const fragmentContentY = fragment.y - page.margins.top;

    // If we have block lookup, try to render full content based on fragment type
    if (options.blockLookup && fragment.blockId) {
      const blockData = options.blockLookup.get(String(fragment.blockId));

      if (
        fragment.kind === 'paragraph' &&
        blockData?.block.kind === 'paragraph' &&
        blockData?.measure.kind === 'paragraph'
      ) {
        fragmentEl = renderParagraphFragment(
          fragment as ParagraphFragment,
          blockData.block as ParagraphBlock,
          blockData.measure as ParagraphMeasure,
          fragmentContext,
          {
            document: doc,
            floatingImageInfo: exclusionZones.length > 0 ? exclusionZones : undefined,
            fragmentContentY: fragmentContentY,
          }
        );
      } else if (
        fragment.kind === 'table' &&
        blockData?.block.kind === 'table' &&
        blockData?.measure.kind === 'table'
      ) {
        fragmentEl = renderTableFragment(
          fragment as TableFragment,
          blockData.block as TableBlock,
          blockData.measure as TableMeasure,
          fragmentContext,
          { document: doc }
        );
      } else if (
        fragment.kind === 'image' &&
        blockData?.block.kind === 'image' &&
        blockData?.measure.kind === 'image'
      ) {
        fragmentEl = renderImageFragment(
          fragment as ImageFragment,
          blockData.block as ImageBlock,
          blockData.measure as ImageMeasure,
          fragmentContext,
          { document: doc }
        );
      } else {
        // Fallback to placeholder
        fragmentEl = renderFragment(fragment, fragmentContext, { document: doc });
      }
    } else {
      // Use placeholder when no blockLookup
      fragmentEl = renderFragment(fragment, fragmentContext, { document: doc });
    }

    applyFragmentStyles(fragmentEl, fragment, { left: page.margins.left, top: page.margins.top });
    contentEl.appendChild(fragmentEl);
  }

  pageEl.appendChild(contentEl);

  // Render header if provided
  if (options.headerContent && options.headerContent.blocks.length > 0) {
    // Default header distance is 0.5 inch (48px) from page top if not specified
    const defaultHeaderDistance = 48;
    const headerDistance = options.headerDistance ?? page.margins.header ?? defaultHeaderDistance;
    const headerContentWidth = page.size.w - page.margins.left - page.margins.right;
    // Calculate max header height (from header distance to top margin)
    // Ensure at least some height even if margins are weird
    const maxHeaderHeight = Math.max(page.margins.top - headerDistance, 48);

    const headerEl = doc.createElement('div');
    headerEl.className = PAGE_CLASS_NAMES.header;
    headerEl.style.position = 'absolute';
    headerEl.style.top = `${headerDistance}px`;
    headerEl.style.left = `${page.margins.left}px`;
    headerEl.style.right = `${page.margins.right}px`;
    headerEl.style.width = `${headerContentWidth}px`;
    // Clip header content to prevent overflow into body area
    headerEl.style.maxHeight = `${maxHeaderHeight}px`;
    headerEl.style.overflow = 'hidden';

    const headerContentEl = renderHeaderFooterContent(
      options.headerContent,
      { ...context, section: 'header', contentWidth: headerContentWidth },
      options
    );
    headerEl.appendChild(headerContentEl);
    pageEl.appendChild(headerEl);
  }

  // Render footer if provided
  if (options.footerContent && options.footerContent.blocks.length > 0) {
    // Default footer distance is 0.5 inch (48px) from page bottom if not specified
    const defaultFooterDistance = 48;
    const footerDistance = options.footerDistance ?? page.margins.footer ?? defaultFooterDistance;
    const footerContentWidth = page.size.w - page.margins.left - page.margins.right;
    // Calculate max footer height (from footer distance to bottom margin)
    const maxFooterHeight = Math.max(page.margins.bottom - footerDistance, 48);

    const footerEl = doc.createElement('div');
    footerEl.className = PAGE_CLASS_NAMES.footer;
    footerEl.style.position = 'absolute';
    footerEl.style.bottom = `${footerDistance}px`;
    footerEl.style.left = `${page.margins.left}px`;
    footerEl.style.right = `${page.margins.right}px`;
    footerEl.style.width = `${footerContentWidth}px`;
    // Clip footer content to prevent overflow into body area
    footerEl.style.maxHeight = `${maxFooterHeight}px`;
    footerEl.style.overflow = 'hidden';

    const footerContentEl = renderHeaderFooterContent(
      options.footerContent,
      { ...context, section: 'footer', contentWidth: footerContentWidth },
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
  container.style.backgroundColor = 'var(--doc-bg, #f8f9fa)';

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

    applyFragmentStyles(fragmentEl, fragment, { left: page.margins.left, top: page.margins.top });
    contentEl.appendChild(fragmentEl);
  }
}
