/**
 * Floating Object Manager
 *
 * Manages floating/anchored images and computes exclusion zones for text wrapping.
 * Based on SuperDoc's approach: floating images create exclusion zones that reduce
 * available line widths during paragraph layout.
 */

export interface ExclusionZone {
  /** Unique ID for the floating object */
  id: string;
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Bounding box of the floating object */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Wrap distances (padding around the image) */
  distances: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  /** Which side text wraps on: 'left' = text on left, 'right' = text on right, 'both' = both sides */
  wrapSide: 'left' | 'right' | 'both' | 'none';
}

export interface AvailableWidth {
  /** Available width for text */
  width: number;
  /** X offset from normal start position */
  offsetX: number;
}

/**
 * Manages floating objects and computes text wrapping exclusions
 */
export class FloatingObjectManager {
  private exclusions: ExclusionZone[] = [];
  private contentWidth: number = 0;
  private leftMargin: number = 0;

  /**
   * Set the layout context (content width and margins)
   */
  setLayoutContext(contentWidth: number, leftMargin: number): void {
    this.contentWidth = contentWidth;
    this.leftMargin = leftMargin;
  }

  /**
   * Clear all exclusions (call when starting a new layout)
   */
  clear(): void {
    this.exclusions = [];
  }

  /**
   * Register a floating object as an exclusion zone
   */
  registerFloatingObject(zone: ExclusionZone): void {
    this.exclusions.push(zone);
  }

  /**
   * Compute available width and offset for a line at the given Y position
   *
   * @param lineY - Y position of the line (relative to page top)
   * @param lineHeight - Height of the line
   * @param pageNumber - Current page number
   * @returns Available width and X offset for the line
   */
  computeAvailableWidth(lineY: number, lineHeight: number, pageNumber: number): AvailableWidth {
    // Find all exclusions that overlap vertically with this line
    const lineTop = lineY;
    const lineBottom = lineY + lineHeight;

    const overlapping = this.exclusions.filter((zone) => {
      if (zone.pageNumber !== pageNumber) return false;
      if (zone.wrapSide === 'none') return false;

      const zoneTop = zone.bounds.y - zone.distances.top;
      const zoneBottom = zone.bounds.y + zone.bounds.height + zone.distances.bottom;

      // Check vertical overlap
      return lineTop < zoneBottom && lineBottom > zoneTop;
    });

    if (overlapping.length === 0) {
      return { width: this.contentWidth, offsetX: 0 };
    }

    // Calculate boundaries from left and right floats
    let leftBoundary = 0; // How far into content area from left
    let rightBoundary = this.contentWidth; // How far from left edge

    for (const zone of overlapping) {
      const zoneLeft = zone.bounds.x - this.leftMargin;
      const zoneRight = zoneLeft + zone.bounds.width;

      if (zone.wrapSide === 'right' || zone.wrapSide === 'both') {
        // Image on left side, text wraps on right
        // Text must start after the image
        const boundary = zoneRight + zone.distances.right;
        leftBoundary = Math.max(leftBoundary, boundary);
      }

      if (zone.wrapSide === 'left' || zone.wrapSide === 'both') {
        // Image on right side, text wraps on left
        // Text must end before the image
        const boundary = zoneLeft - zone.distances.left;
        rightBoundary = Math.min(rightBoundary, boundary);
      }
    }

    const availableWidth = Math.max(0, rightBoundary - leftBoundary);
    return {
      width: availableWidth,
      offsetX: leftBoundary,
    };
  }

  /**
   * Get all exclusions for a page (for rendering)
   */
  getExclusionsForPage(pageNumber: number): ExclusionZone[] {
    return this.exclusions.filter((z) => z.pageNumber === pageNumber);
  }
}

/**
 * Create a new FloatingObjectManager instance
 */
export function createFloatingObjectManager(): FloatingObjectManager {
  return new FloatingObjectManager();
}
