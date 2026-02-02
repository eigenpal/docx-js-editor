/**
 * HorizontalRuler Component
 *
 * A horizontal ruler that displays above the document with:
 * - Page width scale with tick marks
 * - Left and right margin indicators
 * - First line indent indicator
 * - Optional dragging to adjust margins
 * - Support for zoom levels
 *
 * Similar to Microsoft Word's horizontal ruler.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { SectionProperties } from '../../types/document';
import { twipsToPixels, pixelsToTwips, formatPx } from '../../utils/units';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for the HorizontalRuler component
 */
export interface HorizontalRulerProps {
  /** Section properties for page layout */
  sectionProps?: SectionProperties | null;
  /** Zoom level (1.0 = 100%) */
  zoom?: number;
  /** Whether margins can be dragged to adjust */
  editable?: boolean;
  /** Callback when left margin changes (in twips) */
  onLeftMarginChange?: (marginTwips: number) => void;
  /** Callback when right margin changes (in twips) */
  onRightMarginChange?: (marginTwips: number) => void;
  /** Callback when first line indent changes (in twips) */
  onFirstLineIndentChange?: (indentTwips: number) => void;
  /** Show first line indent marker */
  showFirstLineIndent?: boolean;
  /** First line indent value (in twips) */
  firstLineIndent?: number;
  /** Unit to display (inches or cm) */
  unit?: 'inch' | 'cm';
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
}

/**
 * Ruler marker types
 */
type MarkerType = 'leftMargin' | 'rightMargin' | 'firstLineIndent';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PAGE_WIDTH_TWIPS = 12240; // 8.5 inches
const DEFAULT_MARGIN_TWIPS = 1440; // 1 inch
const TWIPS_PER_INCH = 1440;
const TWIPS_PER_CM = 567;

// Ruler styling
const RULER_HEIGHT = 24;
const RULER_BG_COLOR = '#f8f8f8';
const RULER_BORDER_COLOR = '#d0d0d0';
const RULER_TEXT_COLOR = '#666666';
const RULER_TICK_COLOR = '#888888';
const CONTENT_AREA_COLOR = '#ffffff';
const MARGIN_AREA_COLOR = '#e8e8e8';
const MARKER_COLOR = '#666666';
const MARKER_HOVER_COLOR = '#1a73e8';
const MARKER_ACTIVE_COLOR = '#1557b0';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * HorizontalRuler - displays a ruler with margin markers
 */
export function HorizontalRuler({
  sectionProps,
  zoom = 1,
  editable = false,
  onLeftMarginChange,
  onRightMarginChange,
  onFirstLineIndentChange,
  showFirstLineIndent = false,
  firstLineIndent = 0,
  unit = 'inch',
  className = '',
  style,
}: HorizontalRulerProps): React.ReactElement {
  // State for dragging
  const [dragging, setDragging] = useState<MarkerType | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<MarkerType | null>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  // Get page dimensions from section properties
  const pageWidthTwips = sectionProps?.pageSize?.width ?? DEFAULT_PAGE_WIDTH_TWIPS;
  const leftMarginTwips = sectionProps?.pageMargins?.left ?? DEFAULT_MARGIN_TWIPS;
  const rightMarginTwips = sectionProps?.pageMargins?.right ?? DEFAULT_MARGIN_TWIPS;

  // Convert to pixels with zoom
  const pageWidthPx = twipsToPixels(pageWidthTwips) * zoom;
  const leftMarginPx = twipsToPixels(leftMarginTwips) * zoom;
  const rightMarginPx = twipsToPixels(rightMarginTwips) * zoom;
  const firstLineIndentPx = twipsToPixels(firstLineIndent) * zoom;

  // Content area width (between margins)
  const contentWidthPx = pageWidthPx - leftMarginPx - rightMarginPx;

  // Handle drag start
  const handleDragStart = useCallback(
    (e: React.MouseEvent, marker: MarkerType) => {
      if (!editable) return;
      e.preventDefault();
      setDragging(marker);
    },
    [editable]
  );

  // Handle drag
  const handleDrag = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !rulerRef.current) return;

      const rect = rulerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;

      // Convert pixel position to twips
      const positionTwips = pixelsToTwips(x / zoom);

      if (dragging === 'leftMargin') {
        // Constrain left margin: minimum 0, maximum pageWidth - rightMargin - 720 (0.5 inch minimum content)
        const maxMargin = pageWidthTwips - rightMarginTwips - 720;
        const newMargin = Math.max(0, Math.min(positionTwips, maxMargin));
        onLeftMarginChange?.(Math.round(newMargin));
      } else if (dragging === 'rightMargin') {
        // Right margin is measured from the right edge
        const fromRight = pageWidthTwips - positionTwips;
        // Constrain: minimum 0, maximum pageWidth - leftMargin - 720
        const maxMargin = pageWidthTwips - leftMarginTwips - 720;
        const newMargin = Math.max(0, Math.min(fromRight, maxMargin));
        onRightMarginChange?.(Math.round(newMargin));
      } else if (dragging === 'firstLineIndent') {
        // First line indent is relative to left margin
        const indentFromLeftMargin = positionTwips - leftMarginTwips;
        // Constrain: minimum -leftMargin (hanging indent), maximum content width
        const contentTwips = pageWidthTwips - leftMarginTwips - rightMarginTwips;
        const newIndent = Math.max(-leftMarginTwips, Math.min(indentFromLeftMargin, contentTwips - 720));
        onFirstLineIndentChange?.(Math.round(newIndent));
      }
    },
    [dragging, zoom, pageWidthTwips, leftMarginTwips, rightMarginTwips, onLeftMarginChange, onRightMarginChange, onFirstLineIndentChange]
  );

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDragging(null);
  }, []);

  // Add/remove document event listeners for dragging
  useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [dragging, handleDrag, handleDragEnd]);

  // Generate tick marks
  const ticks = generateTicks(pageWidthTwips, zoom, unit);

  // Ruler container style
  const rulerStyle: CSSProperties = {
    position: 'relative',
    width: formatPx(pageWidthPx),
    height: RULER_HEIGHT,
    backgroundColor: RULER_BG_COLOR,
    borderBottom: `1px solid ${RULER_BORDER_COLOR}`,
    overflow: 'hidden',
    userSelect: 'none',
    cursor: dragging ? 'ew-resize' : 'default',
    ...style,
  };

  // Margin area styles
  const leftMarginStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: formatPx(leftMarginPx),
    height: '100%',
    backgroundColor: MARGIN_AREA_COLOR,
    borderRight: `1px solid ${RULER_BORDER_COLOR}`,
  };

  const rightMarginStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 0,
    width: formatPx(rightMarginPx),
    height: '100%',
    backgroundColor: MARGIN_AREA_COLOR,
    borderLeft: `1px solid ${RULER_BORDER_COLOR}`,
  };

  // Content area style
  const contentAreaStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: formatPx(leftMarginPx),
    width: formatPx(contentWidthPx),
    height: '100%',
    backgroundColor: CONTENT_AREA_COLOR,
  };

  return (
    <div
      ref={rulerRef}
      className={`docx-horizontal-ruler ${className}`}
      style={rulerStyle}
      role="slider"
      aria-label="Horizontal ruler"
      aria-valuemin={0}
      aria-valuemax={pageWidthTwips}
    >
      {/* Margin areas (gray) */}
      <div className="docx-ruler-margin-left" style={leftMarginStyle} />
      <div className="docx-ruler-margin-right" style={rightMarginStyle} />

      {/* Content area (white) */}
      <div className="docx-ruler-content-area" style={contentAreaStyle} />

      {/* Tick marks */}
      <div
        className="docx-ruler-ticks"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
        }}
      >
        {ticks.map((tick, index) => (
          <RulerTick key={index} tick={tick} />
        ))}
      </div>

      {/* Left margin marker */}
      <MarginMarker
        type="leftMargin"
        position={leftMarginPx}
        editable={editable}
        isDragging={dragging === 'leftMargin'}
        isHovered={hoveredMarker === 'leftMargin'}
        onMouseEnter={() => setHoveredMarker('leftMargin')}
        onMouseLeave={() => setHoveredMarker(null)}
        onMouseDown={(e) => handleDragStart(e, 'leftMargin')}
      />

      {/* Right margin marker */}
      <MarginMarker
        type="rightMargin"
        position={pageWidthPx - rightMarginPx}
        editable={editable}
        isDragging={dragging === 'rightMargin'}
        isHovered={hoveredMarker === 'rightMargin'}
        onMouseEnter={() => setHoveredMarker('rightMargin')}
        onMouseLeave={() => setHoveredMarker(null)}
        onMouseDown={(e) => handleDragStart(e, 'rightMargin')}
      />

      {/* First line indent marker */}
      {showFirstLineIndent && (
        <FirstLineIndentMarker
          position={leftMarginPx + firstLineIndentPx}
          editable={editable}
          isDragging={dragging === 'firstLineIndent'}
          isHovered={hoveredMarker === 'firstLineIndent'}
          onMouseEnter={() => setHoveredMarker('firstLineIndent')}
          onMouseLeave={() => setHoveredMarker(null)}
          onMouseDown={(e) => handleDragStart(e, 'firstLineIndent')}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Tick mark data
 */
interface TickData {
  position: number; // Position in pixels
  height: number; // Height of tick (8 = major, 4 = minor, 2 = sub-minor)
  label?: string; // Label for major ticks
}

/**
 * Single tick mark
 */
function RulerTick({ tick }: { tick: TickData }): React.ReactElement {
  const tickStyle: CSSProperties = {
    position: 'absolute',
    left: formatPx(tick.position),
    bottom: 0,
    width: 1,
    height: tick.height,
    backgroundColor: RULER_TICK_COLOR,
  };

  const labelStyle: CSSProperties = {
    position: 'absolute',
    left: formatPx(tick.position),
    top: 2,
    transform: 'translateX(-50%)',
    fontSize: '9px',
    color: RULER_TEXT_COLOR,
    fontFamily: 'sans-serif',
    whiteSpace: 'nowrap',
  };

  return (
    <>
      <div style={tickStyle} />
      {tick.label && <div style={labelStyle}>{tick.label}</div>}
    </>
  );
}

/**
 * Margin marker (triangle on top)
 */
interface MarginMarkerProps {
  type: 'leftMargin' | 'rightMargin';
  position: number;
  editable: boolean;
  isDragging: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

function MarginMarker({
  type,
  position,
  editable,
  isDragging,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
}: MarginMarkerProps): React.ReactElement {
  const color = isDragging
    ? MARKER_ACTIVE_COLOR
    : isHovered
    ? MARKER_HOVER_COLOR
    : MARKER_COLOR;

  const markerStyle: CSSProperties = {
    position: 'absolute',
    left: formatPx(position - 5),
    top: 0,
    width: 10,
    height: RULER_HEIGHT,
    cursor: editable ? 'ew-resize' : 'default',
    zIndex: isDragging ? 10 : 1,
  };

  // Triangle pointing down
  const triangleStyle: CSSProperties = {
    position: 'absolute',
    top: 2,
    left: 0,
    width: 0,
    height: 0,
    borderLeft: '5px solid transparent',
    borderRight: '5px solid transparent',
    borderTop: `8px solid ${color}`,
    transition: 'border-top-color 0.1s',
  };

  // Vertical line extending down
  const lineStyle: CSSProperties = {
    position: 'absolute',
    top: 10,
    left: 4.5,
    width: 1,
    height: RULER_HEIGHT - 12,
    backgroundColor: color,
    transition: 'background-color 0.1s',
  };

  return (
    <div
      className={`docx-ruler-marker docx-ruler-marker-${type}`}
      style={markerStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      role="slider"
      aria-label={type === 'leftMargin' ? 'Left margin' : 'Right margin'}
      aria-orientation="horizontal"
      tabIndex={editable ? 0 : -1}
    >
      <div style={triangleStyle} />
      <div style={lineStyle} />
    </div>
  );
}

/**
 * First line indent marker (small triangle)
 */
interface FirstLineIndentMarkerProps {
  position: number;
  editable: boolean;
  isDragging: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

function FirstLineIndentMarker({
  position,
  editable,
  isDragging,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
}: FirstLineIndentMarkerProps): React.ReactElement {
  const color = isDragging
    ? MARKER_ACTIVE_COLOR
    : isHovered
    ? MARKER_HOVER_COLOR
    : MARKER_COLOR;

  const markerStyle: CSSProperties = {
    position: 'absolute',
    left: formatPx(position - 4),
    bottom: 0,
    width: 8,
    height: 10,
    cursor: editable ? 'ew-resize' : 'default',
    zIndex: isDragging ? 10 : 1,
  };

  // Small triangle pointing up
  const triangleStyle: CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 0,
    height: 0,
    borderLeft: '4px solid transparent',
    borderRight: '4px solid transparent',
    borderBottom: `6px solid ${color}`,
    transition: 'border-bottom-color 0.1s',
  };

  return (
    <div
      className="docx-ruler-marker docx-ruler-marker-first-line-indent"
      style={markerStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      role="slider"
      aria-label="First line indent"
      aria-orientation="horizontal"
      tabIndex={editable ? 0 : -1}
    >
      <div style={triangleStyle} />
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate tick marks for the ruler
 */
function generateTicks(pageWidthTwips: number, zoom: number, unit: 'inch' | 'cm'): TickData[] {
  const ticks: TickData[] = [];

  if (unit === 'inch') {
    // Ticks every 1/8 inch, labels every inch
    const eighthInchTwips = TWIPS_PER_INCH / 8;
    const totalEighths = Math.ceil(pageWidthTwips / eighthInchTwips);

    for (let i = 0; i <= totalEighths; i++) {
      const twipsPos = i * eighthInchTwips;
      if (twipsPos > pageWidthTwips) break;

      const pxPos = twipsToPixels(twipsPos) * zoom;

      if (i % 8 === 0) {
        // Full inch - major tick with label
        const inches = i / 8;
        ticks.push({
          position: pxPos,
          height: 10,
          label: inches > 0 ? String(inches) : undefined,
        });
      } else if (i % 4 === 0) {
        // Half inch - medium tick
        ticks.push({
          position: pxPos,
          height: 6,
        });
      } else if (i % 2 === 0) {
        // Quarter inch - small tick
        ticks.push({
          position: pxPos,
          height: 4,
        });
      } else {
        // Eighth inch - tiny tick
        ticks.push({
          position: pxPos,
          height: 2,
        });
      }
    }
  } else {
    // Centimeter mode - ticks every millimeter, labels every centimeter
    const mmTwips = TWIPS_PER_CM / 10;
    const totalMm = Math.ceil(pageWidthTwips / mmTwips);

    for (let i = 0; i <= totalMm; i++) {
      const twipsPos = i * mmTwips;
      if (twipsPos > pageWidthTwips) break;

      const pxPos = twipsToPixels(twipsPos) * zoom;

      if (i % 10 === 0) {
        // Full centimeter - major tick with label
        const cm = i / 10;
        ticks.push({
          position: pxPos,
          height: 10,
          label: cm > 0 ? String(cm) : undefined,
        });
      } else if (i % 5 === 0) {
        // Half centimeter - medium tick
        ticks.push({
          position: pxPos,
          height: 6,
        });
      } else {
        // Millimeter - small tick
        ticks.push({
          position: pxPos,
          height: 3,
        });
      }
    }
  }

  return ticks;
}

/**
 * Convert a ruler position to margin value
 */
export function positionToMargin(
  positionPx: number,
  side: 'left' | 'right',
  pageWidthPx: number,
  zoom: number
): number {
  const positionTwips = pixelsToTwips(positionPx / zoom);

  if (side === 'left') {
    return Math.max(0, positionTwips);
  } else {
    const pageWidthTwips = pixelsToTwips(pageWidthPx / zoom);
    return Math.max(0, pageWidthTwips - positionTwips);
  }
}

/**
 * Get ruler dimensions based on section properties
 */
export function getRulerDimensions(
  sectionProps?: SectionProperties | null,
  zoom: number = 1
): { width: number; leftMargin: number; rightMargin: number; contentWidth: number } {
  const pageWidthTwips = sectionProps?.pageSize?.width ?? DEFAULT_PAGE_WIDTH_TWIPS;
  const leftMarginTwips = sectionProps?.pageMargins?.left ?? DEFAULT_MARGIN_TWIPS;
  const rightMarginTwips = sectionProps?.pageMargins?.right ?? DEFAULT_MARGIN_TWIPS;

  const width = twipsToPixels(pageWidthTwips) * zoom;
  const leftMargin = twipsToPixels(leftMarginTwips) * zoom;
  const rightMargin = twipsToPixels(rightMarginTwips) * zoom;
  const contentWidth = width - leftMargin - rightMargin;

  return { width, leftMargin, rightMargin, contentWidth };
}

/**
 * Get margin value in display units
 */
export function getMarginInUnits(
  marginTwips: number,
  unit: 'inch' | 'cm'
): string {
  if (unit === 'inch') {
    return (marginTwips / TWIPS_PER_INCH).toFixed(2) + '"';
  } else {
    return (marginTwips / TWIPS_PER_CM).toFixed(1) + ' cm';
  }
}

/**
 * Parse a margin value from display units to twips
 */
export function parseMarginFromUnits(
  value: string,
  unit: 'inch' | 'cm'
): number | null {
  const num = parseFloat(value.replace(/[^\d.]/g, ''));
  if (isNaN(num)) return null;

  if (unit === 'inch') {
    return Math.round(num * TWIPS_PER_INCH);
  } else {
    return Math.round(num * TWIPS_PER_CM);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default HorizontalRuler;
