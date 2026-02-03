/**
 * Selection Overlay Component
 *
 * Renders the selection overlay for the paged editor, including:
 * - Caret cursor (blinking vertical line for collapsed selection)
 * - Selection highlights (blue rectangles for range selection)
 *
 * The overlay is positioned absolutely over the pages container and
 * renders selection rectangles in container-relative coordinates.
 */

import React, { useEffect, useState, useRef } from 'react';
import type { SelectionRect, CaretPosition } from '../layout-bridge/selectionRects';

// =============================================================================
// TYPES
// =============================================================================

export interface SelectionOverlayProps {
  /** Selection rectangles for range selection. */
  selectionRects: SelectionRect[];
  /** Caret position for collapsed selection. */
  caretPosition: CaretPosition | null;
  /** Whether the editor is focused. */
  isFocused: boolean;
  /** Gap between pages (for coordinate adjustment). */
  pageGap?: number;
  /** Custom caret color. */
  caretColor?: string;
  /** Custom selection background color. */
  selectionColor?: string;
  /** Caret width in pixels. */
  caretWidth?: number;
  /** Blink interval in milliseconds (0 to disable). */
  blinkInterval?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_CARET_COLOR = '#000';
const DEFAULT_SELECTION_COLOR = 'rgba(66, 133, 244, 0.3)'; // Google Docs style blue
const DEFAULT_CARET_WIDTH = 2;
const DEFAULT_BLINK_INTERVAL = 530; // Standard cursor blink rate

// =============================================================================
// STYLES
// =============================================================================

const overlayStyles: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
  zIndex: 10,
  overflow: 'hidden',
};

const caretStyles = (
  caret: CaretPosition,
  color: string,
  width: number,
  visible: boolean
): React.CSSProperties => ({
  position: 'absolute',
  left: caret.x,
  top: caret.y,
  width: width,
  height: caret.height,
  backgroundColor: color,
  opacity: visible ? 1 : 0,
  transition: 'opacity 0.05s ease-out',
  pointerEvents: 'none',
});

const selectionRectStyles = (rect: SelectionRect, color: string): React.CSSProperties => ({
  position: 'absolute',
  left: rect.x,
  top: rect.y,
  width: rect.width,
  height: rect.height,
  backgroundColor: color,
  pointerEvents: 'none',
});

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Caret component with blinking animation.
 */
const Caret: React.FC<{
  position: CaretPosition;
  color: string;
  width: number;
  blinkInterval: number;
  isFocused: boolean;
}> = ({ position, color, width, blinkInterval, isFocused }) => {
  const [visible, setVisible] = useState(true);
  const blinkTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any existing timer
    if (blinkTimerRef.current) {
      window.clearInterval(blinkTimerRef.current);
      blinkTimerRef.current = null;
    }

    // Only blink when focused and interval is set
    if (isFocused && blinkInterval > 0) {
      setVisible(true);
      blinkTimerRef.current = window.setInterval(() => {
        setVisible((v) => !v);
      }, blinkInterval);
    } else {
      // Show solid caret when not focused or blinking disabled
      setVisible(isFocused);
    }

    return () => {
      if (blinkTimerRef.current) {
        window.clearInterval(blinkTimerRef.current);
      }
    };
  }, [isFocused, blinkInterval, position.x, position.y]);

  // Reset visibility when position changes (show immediately after typing)
  useEffect(() => {
    setVisible(true);
  }, [position.x, position.y]);

  return <div style={caretStyles(position, color, width, visible)} data-testid="caret" />;
};

/**
 * Selection rectangle component.
 */
const SelectionRectangle: React.FC<{
  rect: SelectionRect;
  color: string;
  index: number;
}> = ({ rect, color, index }) => {
  return (
    <div
      style={selectionRectStyles(rect, color)}
      data-testid={`selection-rect-${index}`}
      data-page-index={rect.pageIndex}
    />
  );
};

/**
 * Selection overlay component.
 *
 * Renders selection highlights and caret cursor over the paginated document.
 * Should be positioned as a child of the pages container with relative positioning.
 */
export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  selectionRects,
  caretPosition,
  isFocused,
  caretColor = DEFAULT_CARET_COLOR,
  selectionColor = DEFAULT_SELECTION_COLOR,
  caretWidth = DEFAULT_CARET_WIDTH,
  blinkInterval = DEFAULT_BLINK_INTERVAL,
}) => {
  // Determine if we have a range selection or collapsed selection
  const hasRangeSelection = selectionRects.length > 0;
  const hasCollapsedSelection = caretPosition !== null && !hasRangeSelection;

  return (
    <div style={overlayStyles} data-testid="selection-overlay">
      {/* Render selection rectangles for range selection */}
      {hasRangeSelection &&
        selectionRects.map((rect, index) => (
          <SelectionRectangle
            key={`sel-${rect.pageIndex}-${rect.x}-${rect.y}-${index}`}
            rect={rect}
            color={selectionColor}
            index={index}
          />
        ))}

      {/* Render caret for collapsed selection */}
      {hasCollapsedSelection && caretPosition && (
        <Caret
          position={caretPosition}
          color={caretColor}
          width={caretWidth}
          blinkInterval={blinkInterval}
          isFocused={isFocused}
        />
      )}
    </div>
  );
};

// =============================================================================
// HELPER HOOKS
// =============================================================================

/**
 * Hook to manage selection overlay state.
 *
 * @param pmSelection - ProseMirror selection {from, to}.
 * @param layout - Document layout.
 * @param blocks - Flow blocks.
 * @param measures - Measurements.
 * @returns Selection overlay props.
 */
export function useSelectionOverlay(
  pmSelection: { from: number; to: number } | null,
  layout: import('../layout-engine/types').Layout | null,
  blocks: import('../layout-engine/types').FlowBlock[],
  measures: import('../layout-engine/types').Measure[]
): {
  selectionRects: SelectionRect[];
  caretPosition: CaretPosition | null;
} {
  const [selectionRects, setSelectionRects] = useState<SelectionRect[]>([]);
  const [caretPosition, setCaretPosition] = useState<CaretPosition | null>(null);

  useEffect(() => {
    if (!layout || !pmSelection) {
      setSelectionRects([]);
      setCaretPosition(null);
      return;
    }

    // Import dynamically to avoid circular dependencies
    import('../layout-bridge/selectionRects').then(({ selectionToRects, getCaretPosition }) => {
      const { from, to } = pmSelection;

      if (from === to) {
        // Collapsed selection - show caret
        const caret = getCaretPosition(layout, blocks, measures, from);
        setCaretPosition(caret);
        setSelectionRects([]);
      } else {
        // Range selection - show highlight
        const rects = selectionToRects(layout, blocks, measures, from, to);
        setSelectionRects(rects);
        setCaretPosition(null);
      }
    });
  }, [pmSelection, layout, blocks, measures]);

  return { selectionRects, caretPosition };
}

export default SelectionOverlay;
