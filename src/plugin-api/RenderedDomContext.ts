/**
 * RenderedDomContext Implementation
 *
 * Provides DOM-based position mapping for the LayoutPainter output.
 * Uses the same data-pm-start/data-pm-end attribute pattern as the
 * selection overlay in PagedEditor.
 */

import type { RenderedDomContext, PositionCoordinates } from './types';

/**
 * Implementation of RenderedDomContext.
 *
 * This class provides position mapping between ProseMirror document
 * positions and pixel coordinates in the rendered DOM. It uses the
 * data-pm-start and data-pm-end attributes that LayoutPainter adds
 * to span elements.
 */
export class RenderedDomContextImpl implements RenderedDomContext {
  public pagesContainer: HTMLElement;
  public zoom: number;

  constructor(pagesContainer: HTMLElement, zoom: number = 1) {
    this.pagesContainer = pagesContainer;
    this.zoom = zoom;
  }

  /**
   * Get pixel coordinates for a ProseMirror position.
   * Uses the browser's text rendering via Range API for precise positioning.
   */
  getCoordinatesForPosition(pmPos: number): PositionCoordinates | null {
    const containerRect = this.pagesContainer.getBoundingClientRect();

    // Find spans with PM position data
    const spans = this.pagesContainer.querySelectorAll('span[data-pm-start][data-pm-end]');

    for (const span of Array.from(spans)) {
      const spanEl = span as HTMLElement;
      const pmStart = Number(spanEl.dataset.pmStart);
      const pmEnd = Number(spanEl.dataset.pmEnd);

      // Handle tab spans with exclusive end (tab at [5,6) means pos 6 is next run)
      if (spanEl.classList.contains('layout-run-tab')) {
        if (pmPos >= pmStart && pmPos < pmEnd) {
          const spanRect = spanEl.getBoundingClientRect();
          const lineEl = spanEl.closest('.layout-line');
          const lineHeight = lineEl ? (lineEl as HTMLElement).offsetHeight : 16;

          return {
            x: (spanRect.left - containerRect.left) / this.zoom,
            y: (spanRect.top - containerRect.top) / this.zoom,
            height: lineHeight / this.zoom,
          };
        }
        continue;
      }

      // For text runs, use inclusive range
      if (pmPos >= pmStart && pmPos <= pmEnd && span.firstChild?.nodeType === Node.TEXT_NODE) {
        const textNode = span.firstChild as Text;
        const charIndex = Math.min(pmPos - pmStart, textNode.length);

        // Create a range at the exact character position
        const ownerDoc = spanEl.ownerDocument;
        if (!ownerDoc) continue;

        const range = ownerDoc.createRange();
        range.setStart(textNode, charIndex);
        range.setEnd(textNode, charIndex);

        const rangeRect = range.getBoundingClientRect();
        const lineEl = spanEl.closest('.layout-line');
        const lineHeight = lineEl ? (lineEl as HTMLElement).offsetHeight : 16;

        return {
          x: (rangeRect.left - containerRect.left) / this.zoom,
          y: (rangeRect.top - containerRect.top) / this.zoom,
          height: lineHeight / this.zoom,
        };
      }
    }

    // Fallback: try to find position in empty paragraphs
    const emptyRuns = this.pagesContainer.querySelectorAll('.layout-empty-run');
    for (const emptyRun of Array.from(emptyRuns)) {
      const paragraph = emptyRun.closest('.layout-paragraph') as HTMLElement;
      if (!paragraph) continue;

      const pmStart = Number(paragraph.dataset.pmStart);
      const pmEnd = Number(paragraph.dataset.pmEnd);

      if (pmPos >= pmStart && pmPos <= pmEnd) {
        const runRect = emptyRun.getBoundingClientRect();
        const lineEl = emptyRun.closest('.layout-line');
        const lineHeight = lineEl ? (lineEl as HTMLElement).offsetHeight : 16;

        return {
          x: (runRect.left - containerRect.left) / this.zoom,
          y: (runRect.top - containerRect.top) / this.zoom,
          height: lineHeight / this.zoom,
        };
      }
    }

    return null;
  }

  /**
   * Find DOM elements that overlap with a ProseMirror position range.
   */
  findElementsForRange(from: number, to: number): Element[] {
    const elements: Element[] = [];
    const spans = this.pagesContainer.querySelectorAll('span[data-pm-start][data-pm-end]');

    for (const span of Array.from(spans)) {
      const spanEl = span as HTMLElement;
      const pmStart = Number(spanEl.dataset.pmStart);
      const pmEnd = Number(spanEl.dataset.pmEnd);

      // Check if this span overlaps with the range
      if (pmEnd > from && pmStart < to) {
        elements.push(spanEl);
      }
    }

    return elements;
  }

  /**
   * Get bounding rectangles for a range of text.
   * Handles line wraps by returning multiple rects.
   */
  getRectsForRange(
    from: number,
    to: number
  ): Array<{ x: number; y: number; width: number; height: number }> {
    const containerRect = this.pagesContainer.getBoundingClientRect();
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];

    const spans = this.pagesContainer.querySelectorAll('span[data-pm-start][data-pm-end]');

    for (const span of Array.from(spans)) {
      const spanEl = span as HTMLElement;
      const pmStart = Number(spanEl.dataset.pmStart);
      const pmEnd = Number(spanEl.dataset.pmEnd);

      // Check if this span overlaps with selection
      if (pmEnd > from && pmStart < to) {
        // Handle tab spans - highlight full visual width
        if (spanEl.classList.contains('layout-run-tab')) {
          const spanRect = spanEl.getBoundingClientRect();
          rects.push({
            x: (spanRect.left - containerRect.left) / this.zoom,
            y: (spanRect.top - containerRect.top) / this.zoom,
            width: spanRect.width / this.zoom,
            height: spanRect.height / this.zoom,
          });
          continue;
        }

        if (span.firstChild?.nodeType !== Node.TEXT_NODE) continue;

        const textNode = span.firstChild as Text;
        const ownerDoc = spanEl.ownerDocument;
        if (!ownerDoc) continue;

        // Calculate character range within this span
        const startChar = Math.max(0, from - pmStart);
        const endChar = Math.min(textNode.length, to - pmStart);

        if (startChar < endChar) {
          const range = ownerDoc.createRange();
          range.setStart(textNode, startChar);
          range.setEnd(textNode, endChar);

          // Get all client rects (handles line wraps)
          const clientRects = range.getClientRects();
          for (const rect of Array.from(clientRects)) {
            rects.push({
              x: (rect.left - containerRect.left) / this.zoom,
              y: (rect.top - containerRect.top) / this.zoom,
              width: rect.width / this.zoom,
              height: rect.height / this.zoom,
            });
          }
        }
      }
    }

    return rects;
  }

  /**
   * Get the offset of the pages container from its parent viewport.
   * This is needed for positioning overlays that are rendered in the
   * viewport container rather than directly in the pages container.
   */
  getContainerOffset(): { x: number; y: number } {
    const parent = this.pagesContainer.parentElement;
    if (!parent) return { x: 0, y: 0 };

    const containerRect = this.pagesContainer.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();

    return {
      x: (containerRect.left - parentRect.left) / this.zoom,
      y: (containerRect.top - parentRect.top) / this.zoom,
    };
  }
}

/**
 * Create a RenderedDomContext for a pages container element.
 *
 * @param pagesContainer - The container element holding rendered pages
 * @param zoom - Current zoom level (default 1)
 */
export function createRenderedDomContext(
  pagesContainer: HTMLElement,
  zoom: number = 1
): RenderedDomContext {
  return new RenderedDomContextImpl(pagesContainer, zoom);
}
