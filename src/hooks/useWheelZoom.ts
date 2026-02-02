/**
 * useWheelZoom Hook
 *
 * Enables Ctrl+scroll (or Cmd+scroll on Mac) to zoom in/out.
 * Features:
 * - Configurable zoom range and step
 * - Smooth zoom transitions
 * - Pinch-to-zoom support on trackpads
 * - Zoom reset (Ctrl+0)
 * - Zoom in/out shortcuts (Ctrl++, Ctrl+-)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for useWheelZoom hook
 */
export interface UseWheelZoomOptions {
  /** Initial zoom level (default: 1.0) */
  initialZoom?: number;
  /** Minimum zoom level (default: 0.25) */
  minZoom?: number;
  /** Maximum zoom level (default: 4.0) */
  maxZoom?: number;
  /** Zoom step for each scroll event (default: 0.1) */
  zoomStep?: number;
  /** Whether zoom is enabled (default: true) */
  enabled?: boolean;
  /** Container element ref to attach wheel listener */
  containerRef?: React.RefObject<HTMLElement>;
  /** Callback when zoom changes */
  onZoomChange?: (zoom: number) => void;
  /** Whether to enable keyboard shortcuts (Ctrl++, Ctrl+-, Ctrl+0) */
  enableKeyboardShortcuts?: boolean;
  /** Whether to prevent default browser zoom behavior */
  preventDefault?: boolean;
}

/**
 * Return value of useWheelZoom hook
 */
export interface UseWheelZoomReturn {
  /** Current zoom level */
  zoom: number;
  /** Set zoom level directly */
  setZoom: (zoom: number) => void;
  /** Zoom in by step */
  zoomIn: () => void;
  /** Zoom out by step */
  zoomOut: () => void;
  /** Reset zoom to initial level */
  resetZoom: () => void;
  /** Reset zoom to 100% */
  zoomTo100: () => void;
  /** Zoom to fit width */
  zoomToFit: (containerWidth: number, contentWidth: number) => void;
  /** Whether currently at minimum zoom */
  isMinZoom: boolean;
  /** Whether currently at maximum zoom */
  isMaxZoom: boolean;
  /** Zoom percentage (e.g., 100 for zoom level 1.0) */
  zoomPercent: number;
  /** Wheel event handler (for manual attachment) */
  handleWheel: (event: WheelEvent) => void;
  /** Keyboard event handler (for manual attachment) */
  handleKeyDown: (event: KeyboardEvent) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_INITIAL_ZOOM = 1.0;
const DEFAULT_MIN_ZOOM = 0.25;
const DEFAULT_MAX_ZOOM = 4.0;
const DEFAULT_ZOOM_STEP = 0.1;

/**
 * Preset zoom levels for snapping
 */
export const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Round zoom to 2 decimal places
 */
function roundZoom(zoom: number): number {
  return Math.round(zoom * 100) / 100;
}

/**
 * Find nearest preset zoom level
 */
function nearestPreset(zoom: number): number {
  let nearest = ZOOM_PRESETS[0];
  let minDiff = Math.abs(zoom - nearest);

  for (const preset of ZOOM_PRESETS) {
    const diff = Math.abs(zoom - preset);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = preset;
    }
  }

  return nearest;
}

/**
 * Get next preset zoom level (for zoom in)
 */
function nextPreset(currentZoom: number): number {
  for (const preset of ZOOM_PRESETS) {
    if (preset > currentZoom + 0.01) {
      return preset;
    }
  }
  return ZOOM_PRESETS[ZOOM_PRESETS.length - 1];
}

/**
 * Get previous preset zoom level (for zoom out)
 */
function prevPreset(currentZoom: number): number {
  for (let i = ZOOM_PRESETS.length - 1; i >= 0; i--) {
    if (ZOOM_PRESETS[i] < currentZoom - 0.01) {
      return ZOOM_PRESETS[i];
    }
  }
  return ZOOM_PRESETS[0];
}

// ============================================================================
// USE WHEEL ZOOM HOOK
// ============================================================================

/**
 * React hook for Ctrl+scroll zoom functionality
 */
export function useWheelZoom(options: UseWheelZoomOptions = {}): UseWheelZoomReturn {
  const {
    initialZoom = DEFAULT_INITIAL_ZOOM,
    minZoom = DEFAULT_MIN_ZOOM,
    maxZoom = DEFAULT_MAX_ZOOM,
    zoomStep = DEFAULT_ZOOM_STEP,
    enabled = true,
    containerRef,
    onZoomChange,
    enableKeyboardShortcuts = true,
    preventDefault = true,
  } = options;

  const [zoom, setZoomState] = useState(initialZoom);
  const zoomRef = useRef(zoom);

  // Keep ref in sync with state
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  /**
   * Set zoom with clamping and callback
   */
  const setZoom = useCallback(
    (newZoom: number) => {
      const clampedZoom = roundZoom(clamp(newZoom, minZoom, maxZoom));
      if (clampedZoom !== zoomRef.current) {
        setZoomState(clampedZoom);
        onZoomChange?.(clampedZoom);
      }
    },
    [minZoom, maxZoom, onZoomChange]
  );

  /**
   * Zoom in by step
   */
  const zoomIn = useCallback(() => {
    setZoom(zoomRef.current + zoomStep);
  }, [zoomStep, setZoom]);

  /**
   * Zoom out by step
   */
  const zoomOut = useCallback(() => {
    setZoom(zoomRef.current - zoomStep);
  }, [zoomStep, setZoom]);

  /**
   * Reset zoom to initial level
   */
  const resetZoom = useCallback(() => {
    setZoom(initialZoom);
  }, [initialZoom, setZoom]);

  /**
   * Reset zoom to 100%
   */
  const zoomTo100 = useCallback(() => {
    setZoom(1.0);
  }, [setZoom]);

  /**
   * Zoom to fit width
   */
  const zoomToFit = useCallback(
    (containerWidth: number, contentWidth: number) => {
      if (contentWidth > 0) {
        const fitZoom = containerWidth / contentWidth;
        setZoom(fitZoom);
      }
    },
    [setZoom]
  );

  /**
   * Handle wheel event
   */
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (!enabled) return;

      // Check for Ctrl/Cmd key
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;
      if (!isCtrlOrMeta) return;

      // Prevent default browser zoom
      if (preventDefault) {
        event.preventDefault();
      }

      // Determine zoom direction
      // deltaY > 0 means scrolling down (zoom out)
      // deltaY < 0 means scrolling up (zoom in)
      const delta = event.deltaY;

      if (delta < 0) {
        // Scroll up = zoom in
        setZoom(zoomRef.current + zoomStep);
      } else if (delta > 0) {
        // Scroll down = zoom out
        setZoom(zoomRef.current - zoomStep);
      }
    },
    [enabled, preventDefault, zoomStep, setZoom]
  );

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled || !enableKeyboardShortcuts) return;

      const isCtrlOrMeta = event.ctrlKey || event.metaKey;
      if (!isCtrlOrMeta) return;

      // Ctrl+0 - Reset zoom to 100%
      if (event.key === '0') {
        event.preventDefault();
        zoomTo100();
        return;
      }

      // Ctrl++ or Ctrl+= - Zoom in
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomIn();
        return;
      }

      // Ctrl+- - Zoom out
      if (event.key === '-') {
        event.preventDefault();
        zoomOut();
        return;
      }
    },
    [enabled, enableKeyboardShortcuts, zoomIn, zoomOut, zoomTo100]
  );

  // Attach wheel listener to container
  useEffect(() => {
    if (!enabled) return;

    const container = containerRef?.current;
    if (!container) return;

    // Use passive: false to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [enabled, containerRef, handleWheel]);

  // Attach keyboard listener
  useEffect(() => {
    if (!enabled || !enableKeyboardShortcuts) return;

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, enableKeyboardShortcuts, handleKeyDown]);

  return {
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomTo100,
    zoomToFit,
    isMinZoom: zoom <= minZoom,
    isMaxZoom: zoom >= maxZoom,
    zoomPercent: Math.round(zoom * 100),
    handleWheel,
    handleKeyDown,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get zoom presets
 */
export function getZoomPresets(): number[] {
  return [...ZOOM_PRESETS];
}

/**
 * Find nearest zoom preset
 */
export function findNearestZoomPreset(zoom: number): number {
  return nearestPreset(zoom);
}

/**
 * Get next zoom preset (for zoom in)
 */
export function getNextZoomPreset(zoom: number): number {
  return nextPreset(zoom);
}

/**
 * Get previous zoom preset (for zoom out)
 */
export function getPreviousZoomPreset(zoom: number): number {
  return prevPreset(zoom);
}

/**
 * Format zoom level for display
 */
export function formatZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

/**
 * Parse zoom from percentage string
 */
export function parseZoom(zoomString: string): number | null {
  const match = zoomString.match(/(\d+(\.\d+)?)/);
  if (match) {
    const value = parseFloat(match[1]);
    if (!isNaN(value)) {
      return value / 100;
    }
  }
  return null;
}

/**
 * Check if zoom level is at a preset
 */
export function isZoomPreset(zoom: number): boolean {
  return ZOOM_PRESETS.some((preset) => Math.abs(preset - zoom) < 0.01);
}

/**
 * Clamp zoom to valid range
 */
export function clampZoom(
  zoom: number,
  minZoom: number = DEFAULT_MIN_ZOOM,
  maxZoom: number = DEFAULT_MAX_ZOOM
): number {
  return roundZoom(clamp(zoom, minZoom, maxZoom));
}

// ============================================================================
// EXPORTS
// ============================================================================

export default useWheelZoom;
