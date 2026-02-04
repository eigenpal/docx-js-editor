/**
 * DOM Position Index
 *
 * Provides fast, indexed lookups for click-to-position mapping.
 * Caches page, fragment, and run positions for O(log n) lookups
 * instead of O(n) DOM traversal.
 *
 * Based on SuperDoc's DomPositionIndex pattern.
 */

/**
 * Cached page information for fast Y-coordinate lookup.
 */
interface PageInfo {
  element: HTMLElement;
  index: number;
  top: number;
  bottom: number;
}

/**
 * Cached fragment information.
 */
interface FragmentInfo {
  element: HTMLElement;
  blockId: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Cached run (text span) information.
 */
interface RunInfo {
  element: HTMLElement;
  pmStart: number;
  pmEnd: number;
  left: number;
  right: number;
  isTab: boolean;
}

/**
 * Result of a position lookup.
 */
export interface PositionLookupResult {
  pageIndex: number;
  pmPosition: number;
  element: HTMLElement;
}

/**
 * DomPositionIndex provides fast click-to-position mapping
 * by caching DOM element positions and using binary search.
 */
export class DomPositionIndex {
  /** Cached page info sorted by Y position */
  #pages: PageInfo[] = [];

  /** Fragments indexed by page */
  #fragmentsByPage: Map<number, FragmentInfo[]> = new Map();

  /** Runs indexed by fragment blockId */
  #runsByFragment: Map<string, RunInfo[]> = new Map();

  /** The container element we're indexing */
  #container: HTMLElement | null = null;

  /** Whether the index needs rebuilding */
  #dirty = true;

  /**
   * Rebuild the entire index from the container.
   * Call this after layout changes.
   */
  rebuild(container: HTMLElement): void {
    this.#container = container;
    this.#pages = [];
    this.#fragmentsByPage.clear();
    this.#runsByFragment.clear();

    // Index all pages
    const pageElements = container.querySelectorAll('.layout-page');
    for (let i = 0; i < pageElements.length; i++) {
      const pageEl = pageElements[i] as HTMLElement;
      const rect = pageEl.getBoundingClientRect();

      this.#pages.push({
        element: pageEl,
        index: i,
        top: rect.top,
        bottom: rect.bottom,
      });

      // Index fragments in this page
      this.#indexFragmentsInPage(pageEl, i);
    }

    // Sort pages by Y position for binary search
    this.#pages.sort((a, b) => a.top - b.top);

    this.#dirty = false;
  }

  /**
   * Index all fragments within a page.
   */
  #indexFragmentsInPage(pageEl: HTMLElement, pageIndex: number): void {
    const fragments: FragmentInfo[] = [];
    const fragmentEls = pageEl.querySelectorAll('.layout-paragraph, .layout-table, .layout-image');

    for (const fragEl of Array.from(fragmentEls)) {
      const element = fragEl as HTMLElement;
      const blockId = element.dataset.blockId || '';
      const rect = element.getBoundingClientRect();

      fragments.push({
        element,
        blockId,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      });

      // Index runs in this fragment
      this.#indexRunsInFragment(element, blockId);
    }

    // Sort by Y position
    fragments.sort((a, b) => a.top - b.top);
    this.#fragmentsByPage.set(pageIndex, fragments);
  }

  /**
   * Index all runs (text spans) within a fragment.
   */
  #indexRunsInFragment(fragmentEl: HTMLElement, blockId: string): void {
    const runs: RunInfo[] = [];
    const runEls = fragmentEl.querySelectorAll('span[data-pm-start][data-pm-end]');

    for (const runEl of Array.from(runEls)) {
      const element = runEl as HTMLElement;
      const pmStart = Number(element.dataset.pmStart);
      const pmEnd = Number(element.dataset.pmEnd);
      const rect = element.getBoundingClientRect();
      const isTab = element.classList.contains('layout-run-tab');

      runs.push({
        element,
        pmStart,
        pmEnd,
        left: rect.left,
        right: rect.right,
        isTab,
      });
    }

    // Sort by X position (left to right)
    runs.sort((a, b) => a.left - b.left);
    this.#runsByFragment.set(blockId, runs);
  }

  /**
   * Mark the index as dirty (needs rebuild).
   */
  invalidate(): void {
    this.#dirty = true;
  }

  /**
   * Check if index needs rebuilding.
   */
  isDirty(): boolean {
    return this.#dirty;
  }

  /**
   * Get the page at a Y coordinate using binary search.
   */
  getPageAtY(clientY: number): PageInfo | null {
    if (this.#pages.length === 0) return null;

    // Binary search for page containing Y
    let left = 0;
    let right = this.#pages.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const page = this.#pages[mid];

      if (clientY < page.top) {
        right = mid - 1;
      } else if (clientY > page.bottom) {
        left = mid + 1;
      } else {
        return page;
      }
    }

    // Not found - return closest page
    if (left >= this.#pages.length) {
      return this.#pages[this.#pages.length - 1];
    }
    if (right < 0) {
      return this.#pages[0];
    }

    return null;
  }

  /**
   * Get the fragment at a point within a page.
   */
  getFragmentAtPoint(pageIndex: number, _clientX: number, clientY: number): FragmentInfo | null {
    const fragments = this.#fragmentsByPage.get(pageIndex);
    if (!fragments || fragments.length === 0) return null;

    // Find fragment containing the Y coordinate
    for (const frag of fragments) {
      if (clientY >= frag.top && clientY <= frag.bottom) {
        return frag;
      }
    }

    // Find closest fragment by Y
    let closest: FragmentInfo | null = null;
    let minDist = Infinity;

    for (const frag of fragments) {
      const dist = clientY < frag.top ? frag.top - clientY : clientY - frag.bottom;
      if (dist < minDist) {
        minDist = dist;
        closest = frag;
      }
    }

    return closest;
  }

  /**
   * Get the run at an X coordinate within a fragment.
   */
  getRunAtX(blockId: string, clientX: number): RunInfo | null {
    const runs = this.#runsByFragment.get(blockId);
    if (!runs || runs.length === 0) return null;

    // Find run containing the X coordinate
    for (const run of runs) {
      if (clientX >= run.left && clientX <= run.right) {
        return run;
      }
    }

    // Find closest run by X
    let closest: RunInfo | null = null;
    let minDist = Infinity;

    for (const run of runs) {
      const dist = clientX < run.left ? run.left - clientX : clientX - run.right;
      if (dist < minDist) {
        minDist = dist;
        closest = run;
      }
    }

    return closest;
  }

  /**
   * Get the exact PM position within a run using binary search.
   */
  getPositionInRun(run: RunInfo, clientX: number): number {
    // For tabs, use simple left/right check
    if (run.isTab) {
      const midpoint = (run.left + run.right) / 2;
      return clientX < midpoint ? run.pmStart : run.pmEnd;
    }

    // For text runs, do binary search on character positions
    const textNode = run.element.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
      return run.pmStart;
    }

    const text = textNode as Text;
    const textLength = text.length;

    if (textLength === 0) {
      return run.pmStart;
    }

    const ownerDoc = run.element.ownerDocument;
    if (!ownerDoc) return run.pmStart;

    // Binary search for character boundary
    let left = 0;
    let right = textLength;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const range = ownerDoc.createRange();
      range.setStart(text, mid);
      range.setEnd(text, mid);

      const rect = range.getBoundingClientRect();
      if (clientX < rect.left) {
        right = mid;
      } else {
        left = mid + 1;
      }
    }

    // Clamp to valid range
    const charIndex = Math.max(0, Math.min(left, run.pmEnd - run.pmStart));
    return run.pmStart + charIndex;
  }

  /**
   * Get PM position from client coordinates.
   * Main entry point for click-to-position mapping.
   */
  getPositionAtPoint(clientX: number, clientY: number): PositionLookupResult | null {
    if (this.#dirty && this.#container) {
      this.rebuild(this.#container);
    }

    // Step 1: Find page
    const page = this.getPageAtY(clientY);
    if (!page) return null;

    // Step 2: Find fragment
    const fragment = this.getFragmentAtPoint(page.index, clientX, clientY);
    if (!fragment) return null;

    // Step 3: Find run
    const run = this.getRunAtX(fragment.blockId, clientX);
    if (!run) {
      // No run found - return fragment start position
      const pmStart = Number(fragment.element.dataset.pmStart);
      return {
        pageIndex: page.index,
        pmPosition: pmStart || 0,
        element: fragment.element,
      };
    }

    // Step 4: Find exact position in run
    const pmPosition = this.getPositionInRun(run, clientX);

    return {
      pageIndex: page.index,
      pmPosition,
      element: run.element,
    };
  }

  /**
   * Get the element containing a PM position.
   * Useful for caret positioning.
   */
  getElementAtPosition(pmPos: number): HTMLElement | null {
    // Linear search through all runs to find the one containing this position
    for (const runs of this.#runsByFragment.values()) {
      for (const run of runs) {
        // Use exclusive end for tabs, inclusive for text
        if (run.isTab) {
          if (pmPos >= run.pmStart && pmPos < run.pmEnd) {
            return run.element;
          }
        } else {
          if (pmPos >= run.pmStart && pmPos <= run.pmEnd) {
            return run.element;
          }
        }
      }
    }

    return null;
  }

  /**
   * Get all pages info (for debugging).
   */
  getPages(): ReadonlyArray<PageInfo> {
    return this.#pages;
  }

  /**
   * Get debug info.
   */
  getDebugInfo(): {
    pageCount: number;
    fragmentCount: number;
    runCount: number;
    dirty: boolean;
  } {
    let fragmentCount = 0;
    let runCount = 0;

    for (const fragments of this.#fragmentsByPage.values()) {
      fragmentCount += fragments.length;
    }

    for (const runs of this.#runsByFragment.values()) {
      runCount += runs.length;
    }

    return {
      pageCount: this.#pages.length,
      fragmentCount,
      runCount,
      dirty: this.#dirty,
    };
  }
}
