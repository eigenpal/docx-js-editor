/**
 * VerticalRuler Component
 *
 * A vertical ruler that displays alongside the document with:
 * - Page height scale with tick marks
 * - Top and bottom margin indicators
 * - Optional dragging to adjust margins
 * - Support for zoom levels
 *
 * Similar to Google Docs' vertical ruler.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { SectionProperties } from '../../types/document';
import { twipsToPixels, pixelsToTwips, formatPx } from '../../utils/units';

// ============================================================================
// TYPES
// ============================================================================

export interface VerticalRulerProps {
  /** Section properties for page layout */
  sectionProps?: SectionProperties | null;
  /** Zoom level (1.0 = 100%) */
  zoom?: number;
  /** Whether margins can be dragged to adjust */
  editable?: boolean;
  /** Callback when top margin changes (in twips) */
  onTopMarginChange?: (marginTwips: number) => void;
  /** Callback when bottom margin changes (in twips) */
  onBottomMarginChange?: (marginTwips: number) => void;
  /** Unit to display (inches or cm) */
  unit?: 'inch' | 'cm';
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
}

type MarkerType = 'topMargin' | 'bottomMargin';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PAGE_HEIGHT_TWIPS = 15840; // 11 inches
const DEFAULT_MARGIN_TWIPS = 1440; // 1 inch
const TWIPS_PER_INCH = 1440;
const TWIPS_PER_CM = 567;

// Ruler styling - Google Docs style
const RULER_WIDTH = 20;
const RULER_TEXT_COLOR = 'var(--doc-text-muted)';
const RULER_TICK_COLOR = 'var(--doc-text-subtle)';
const MARKER_COLOR = 'var(--doc-primary)';
const MARKER_HOVER_COLOR = 'var(--doc-primary)';
const MARKER_ACTIVE_COLOR = 'var(--doc-primary-hover)';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VerticalRuler({
  sectionProps,
  zoom = 1,
  editable = false,
  onTopMarginChange,
  onBottomMarginChange,
  unit = 'inch',
  className = '',
  style,
}: VerticalRulerProps): React.ReactElement {
  const [dragging, setDragging] = useState<MarkerType | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<MarkerType | null>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  // Get page dimensions
  const pageHeightTwips = sectionProps?.pageHeight ?? DEFAULT_PAGE_HEIGHT_TWIPS;
  const topMarginTwips = sectionProps?.marginTop ?? DEFAULT_MARGIN_TWIPS;
  const bottomMarginTwips = sectionProps?.marginBottom ?? DEFAULT_MARGIN_TWIPS;

  // Convert to pixels with zoom
  const pageHeightPx = twipsToPixels(pageHeightTwips) * zoom;
  const topMarginPx = twipsToPixels(topMarginTwips) * zoom;
  const bottomMarginPx = twipsToPixels(bottomMarginTwips) * zoom;

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
      const y = e.clientY - rect.top;

      const positionTwips = pixelsToTwips(y / zoom);

      if (dragging === 'topMargin') {
        const maxMargin = pageHeightTwips - bottomMarginTwips - 720;
        const newMargin = Math.max(0, Math.min(positionTwips, maxMargin));
        onTopMarginChange?.(Math.round(newMargin));
      } else if (dragging === 'bottomMargin') {
        const fromBottom = pageHeightTwips - positionTwips;
        const maxMargin = pageHeightTwips - topMarginTwips - 720;
        const newMargin = Math.max(0, Math.min(fromBottom, maxMargin));
        onBottomMarginChange?.(Math.round(newMargin));
      }
    },
    [
      dragging,
      zoom,
      pageHeightTwips,
      topMarginTwips,
      bottomMarginTwips,
      onTopMarginChange,
      onBottomMarginChange,
    ]
  );

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDragging(null);
  }, []);

  // Add/remove document event listeners
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
  const ticks = generateVerticalTicks(pageHeightTwips, zoom, unit);

  const rulerStyle: CSSProperties = {
    position: 'relative',
    width: RULER_WIDTH,
    height: formatPx(pageHeightPx),
    backgroundColor: 'transparent',
    overflow: 'visible',
    userSelect: 'none',
    cursor: dragging ? 'ns-resize' : 'default',
    ...style,
  };

  return (
    <div
      ref={rulerRef}
      className={`docx-vertical-ruler ${className}`}
      style={rulerStyle}
      role="slider"
      aria-label="Vertical ruler"
      aria-orientation="vertical"
    >
      {/* Tick marks */}
      <div
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
          <VerticalTick key={index} tick={tick} />
        ))}
      </div>

      {/* Top margin marker */}
      <VerticalMarginMarker
        type="topMargin"
        position={topMarginPx}
        editable={editable}
        isDragging={dragging === 'topMargin'}
        isHovered={hoveredMarker === 'topMargin'}
        onMouseEnter={() => setHoveredMarker('topMargin')}
        onMouseLeave={() => setHoveredMarker(null)}
        onMouseDown={(e) => handleDragStart(e, 'topMargin')}
      />

      {/* Bottom margin marker */}
      <VerticalMarginMarker
        type="bottomMargin"
        position={pageHeightPx - bottomMarginPx}
        editable={editable}
        isDragging={dragging === 'bottomMargin'}
        isHovered={hoveredMarker === 'bottomMargin'}
        onMouseEnter={() => setHoveredMarker('bottomMargin')}
        onMouseLeave={() => setHoveredMarker(null)}
        onMouseDown={(e) => handleDragStart(e, 'bottomMargin')}
      />
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface VerticalTickData {
  position: number;
  width: number;
  label?: string;
}

function VerticalTick({ tick }: { tick: VerticalTickData }): React.ReactElement {
  const tickStyle: CSSProperties = {
    position: 'absolute',
    top: formatPx(tick.position),
    right: 0,
    height: 1,
    width: tick.width,
    backgroundColor: RULER_TICK_COLOR,
  };

  const labelStyle: CSSProperties = {
    position: 'absolute',
    top: formatPx(tick.position),
    left: 2,
    transform: 'translateY(-50%)',
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

interface VerticalMarginMarkerProps {
  type: 'topMargin' | 'bottomMargin';
  position: number;
  editable: boolean;
  isDragging: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

function VerticalMarginMarker({
  type,
  position,
  editable,
  isDragging,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
}: VerticalMarginMarkerProps): React.ReactElement {
  const color = isDragging ? MARKER_ACTIVE_COLOR : isHovered ? MARKER_HOVER_COLOR : MARKER_COLOR;

  const markerStyle: CSSProperties = {
    position: 'absolute',
    top: formatPx(position - 5),
    right: 0,
    width: RULER_WIDTH,
    height: 10,
    cursor: editable ? 'ns-resize' : 'default',
    zIndex: isDragging ? 10 : 1,
  };

  // Triangle pointing left (for top) or right (for bottom)
  const triangleStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 2,
    width: 0,
    height: 0,
    borderTop: '5px solid transparent',
    borderBottom: '5px solid transparent',
    borderRight: `8px solid ${color}`,
    transition: 'border-right-color 0.1s',
  };

  return (
    <div
      className={`docx-ruler-marker docx-ruler-marker-${type}`}
      style={markerStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      role="slider"
      aria-label={type === 'topMargin' ? 'Top margin' : 'Bottom margin'}
      aria-orientation="vertical"
      tabIndex={editable ? 0 : -1}
    >
      <div style={triangleStyle} />
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateVerticalTicks(
  pageHeightTwips: number,
  zoom: number,
  unit: 'inch' | 'cm'
): VerticalTickData[] {
  const ticks: VerticalTickData[] = [];

  if (unit === 'inch') {
    const eighthInchTwips = TWIPS_PER_INCH / 8;
    const totalEighths = Math.ceil(pageHeightTwips / eighthInchTwips);

    for (let i = 0; i <= totalEighths; i++) {
      const twipsPos = i * eighthInchTwips;
      if (twipsPos > pageHeightTwips) break;

      const pxPos = twipsToPixels(twipsPos) * zoom;

      if (i % 8 === 0) {
        const inches = i / 8;
        ticks.push({
          position: pxPos,
          width: 10,
          label: inches > 0 ? String(inches) : undefined,
        });
      } else if (i % 4 === 0) {
        ticks.push({ position: pxPos, width: 6 });
      } else if (i % 2 === 0) {
        ticks.push({ position: pxPos, width: 4 });
      } else {
        ticks.push({ position: pxPos, width: 2 });
      }
    }
  } else {
    const mmTwips = TWIPS_PER_CM / 10;
    const totalMm = Math.ceil(pageHeightTwips / mmTwips);

    for (let i = 0; i <= totalMm; i++) {
      const twipsPos = i * mmTwips;
      if (twipsPos > pageHeightTwips) break;

      const pxPos = twipsToPixels(twipsPos) * zoom;

      if (i % 10 === 0) {
        const cm = i / 10;
        ticks.push({
          position: pxPos,
          width: 10,
          label: cm > 0 ? String(cm) : undefined,
        });
      } else if (i % 5 === 0) {
        ticks.push({ position: pxPos, width: 6 });
      } else {
        ticks.push({ position: pxPos, width: 3 });
      }
    }
  }

  return ticks;
}

export default VerticalRuler;
