/**
 * Zoom Control Component
 *
 * A component for controlling document zoom level in the DOCX editor:
 * - Dropdown with zoom levels (50%, 75%, 100%, 125%, 150%, 200%)
 * - Zoom in/out buttons
 * - Scales page rendering
 * - Persists zoom preference via localStorage
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Zoom level preset
 */
export interface ZoomLevel {
  /** Zoom value (1.0 = 100%) */
  value: number;
  /** Display label (e.g., "100%") */
  label: string;
}

/**
 * Props for the ZoomControl component
 */
export interface ZoomControlProps {
  /** Current zoom level (1.0 = 100%) */
  value?: number;
  /** Callback when zoom changes */
  onChange?: (zoom: number) => void;
  /** Custom zoom levels */
  levels?: ZoomLevel[];
  /** Whether the control is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Minimum zoom level */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
  /** Show zoom in/out buttons */
  showButtons?: boolean;
  /** Persist zoom preference to localStorage */
  persistZoom?: boolean;
  /** Storage key for persisting zoom */
  storageKey?: string;
  /** Compact mode (smaller size) */
  compact?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default zoom levels
 */
const DEFAULT_ZOOM_LEVELS: ZoomLevel[] = [
  { value: 0.5, label: '50%' },
  { value: 0.75, label: '75%' },
  { value: 1.0, label: '100%' },
  { value: 1.25, label: '125%' },
  { value: 1.5, label: '150%' },
  { value: 2.0, label: '200%' },
];

/**
 * Extended zoom levels for custom input
 */
const EXTENDED_ZOOM_LEVELS: ZoomLevel[] = [
  { value: 0.25, label: '25%' },
  { value: 0.5, label: '50%' },
  { value: 0.75, label: '75%' },
  { value: 0.9, label: '90%' },
  { value: 1.0, label: '100%' },
  { value: 1.1, label: '110%' },
  { value: 1.25, label: '125%' },
  { value: 1.5, label: '150%' },
  { value: 1.75, label: '175%' },
  { value: 2.0, label: '200%' },
  { value: 3.0, label: '300%' },
  { value: 4.0, label: '400%' },
];

/**
 * Default constraints
 */
const DEFAULT_MIN_ZOOM = 0.25;
const DEFAULT_MAX_ZOOM = 4.0;
const DEFAULT_STORAGE_KEY = 'docx-editor-zoom';

/**
 * Zoom step for increment/decrement
 */
const ZOOM_STEP = 0.25;

// ============================================================================
// STYLES
// ============================================================================

const CONTAINER_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
};

const BUTTON_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  padding: 0,
  border: '1px solid #ccc',
  borderRadius: '4px',
  backgroundColor: '#fff',
  cursor: 'pointer',
  color: '#333',
  fontSize: '16px',
  fontWeight: 'bold',
  transition: 'background-color 0.15s, border-color 0.15s',
};

const BUTTON_HOVER_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  backgroundColor: '#f5f5f5',
  borderColor: '#999',
};

const BUTTON_DISABLED_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  backgroundColor: '#f5f5f5',
  color: '#999',
  cursor: 'not-allowed',
};

const DROPDOWN_CONTAINER_STYLE: CSSProperties = {
  position: 'relative',
  display: 'inline-block',
};

const DROPDOWN_TRIGGER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  minWidth: '80px',
  height: '28px',
  padding: '4px 8px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  backgroundColor: '#fff',
  fontSize: '13px',
  color: '#333',
  cursor: 'pointer',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const DROPDOWN_TRIGGER_FOCUS_STYLE: CSSProperties = {
  ...DROPDOWN_TRIGGER_STYLE,
  borderColor: '#0066cc',
  boxShadow: '0 0 0 2px rgba(0, 102, 204, 0.2)',
};

const DROPDOWN_TRIGGER_DISABLED_STYLE: CSSProperties = {
  ...DROPDOWN_TRIGGER_STYLE,
  backgroundColor: '#f5f5f5',
  color: '#999',
  cursor: 'not-allowed',
};

const DROPDOWN_MENU_STYLE: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  zIndex: 1000,
  minWidth: '100%',
  maxHeight: '200px',
  marginTop: '2px',
  padding: '4px 0',
  backgroundColor: '#fff',
  border: '1px solid #ccc',
  borderRadius: '4px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  overflowY: 'auto',
};

const DROPDOWN_ITEM_STYLE: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '6px 12px',
  border: 'none',
  backgroundColor: 'transparent',
  textAlign: 'left',
  cursor: 'pointer',
  fontSize: '13px',
  color: '#333',
  transition: 'background-color 0.1s',
};

const DROPDOWN_ITEM_HOVER_STYLE: CSSProperties = {
  ...DROPDOWN_ITEM_STYLE,
  backgroundColor: '#f0f4f8',
};

const DROPDOWN_ITEM_SELECTED_STYLE: CSSProperties = {
  ...DROPDOWN_ITEM_STYLE,
  backgroundColor: '#e3f2fd',
  fontWeight: 500,
};

const CHEVRON_STYLE: CSSProperties = {
  width: '12px',
  height: '12px',
  marginLeft: '4px',
  color: '#666',
};

const COMPACT_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  width: '24px',
  height: '24px',
  fontSize: '14px',
};

const COMPACT_TRIGGER_STYLE: CSSProperties = {
  ...DROPDOWN_TRIGGER_STYLE,
  minWidth: '70px',
  height: '24px',
  fontSize: '12px',
  padding: '2px 6px',
};

// ============================================================================
// ICONS
// ============================================================================

const ZoomInIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <path d="M6.5 1a5.5 5.5 0 0 1 4.383 8.823l3.647 3.647a.75.75 0 0 1-1.06 1.06l-3.647-3.647A5.5 5.5 0 1 1 6.5 1zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
    <path d="M6.5 4a.5.5 0 0 1 .5.5V6h1.5a.5.5 0 0 1 0 1H7v1.5a.5.5 0 0 1-1 0V7H4.5a.5.5 0 0 1 0-1H6V4.5a.5.5 0 0 1 .5-.5z" />
  </svg>
);

const ZoomOutIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <path d="M6.5 1a5.5 5.5 0 0 1 4.383 8.823l3.647 3.647a.75.75 0 0 1-1.06 1.06l-3.647-3.647A5.5 5.5 0 1 1 6.5 1zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
    <path d="M4.5 6a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1h-4z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg style={CHEVRON_STYLE} viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 6l4 4 4-4H4z" />
  </svg>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Zoom control component with dropdown and zoom in/out buttons
 */
export function ZoomControl({
  value = 1.0,
  onChange,
  levels = DEFAULT_ZOOM_LEVELS,
  disabled = false,
  className,
  style,
  minZoom = DEFAULT_MIN_ZOOM,
  maxZoom = DEFAULT_MAX_ZOOM,
  showButtons = true,
  persistZoom = false,
  storageKey = DEFAULT_STORAGE_KEY,
  compact = false,
}: ZoomControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [isHoveredIn, setIsHoveredIn] = useState(false);
  const [isHoveredOut, setIsHoveredOut] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load persisted zoom on mount
  useEffect(() => {
    if (persistZoom && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = parseFloat(stored);
          if (!isNaN(parsed) && parsed >= minZoom && parsed <= maxZoom) {
            onChange?.(parsed);
          }
        }
      } catch {
        // localStorage not available or error
      }
    }
  }, []); // Only run on mount

  // Persist zoom when it changes
  useEffect(() => {
    if (persistZoom && typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, value.toString());
      } catch {
        // localStorage not available or error
      }
    }
  }, [value, persistZoom, storageKey]);

  // Find current level index
  const currentLevelIndex = useMemo(() => {
    return levels.findIndex((level) => Math.abs(level.value - value) < 0.001);
  }, [levels, value]);

  // Format current zoom for display
  const displayLabel = useMemo(() => {
    const matchingLevel = levels.find((level) => Math.abs(level.value - value) < 0.001);
    if (matchingLevel) return matchingLevel.label;
    return `${Math.round(value * 100)}%`;
  }, [levels, value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll focused item into view
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-zoom-item]');
      const focusedItem = items[focusedIndex] as HTMLElement;
      if (focusedItem) {
        focusedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen, focusedIndex]);

  /**
   * Handle zoom change with validation
   */
  const handleZoomChange = useCallback(
    (newZoom: number) => {
      const clamped = Math.min(Math.max(newZoom, minZoom), maxZoom);
      onChange?.(clamped);
    },
    [onChange, minZoom, maxZoom]
  );

  /**
   * Zoom in by one step
   */
  const handleZoomIn = useCallback(() => {
    if (disabled) return;

    // Find next zoom level
    const nextLevel = levels.find((level) => level.value > value + 0.001);
    if (nextLevel) {
      handleZoomChange(nextLevel.value);
    } else {
      // Use step increment
      const newZoom = Math.min(value + ZOOM_STEP, maxZoom);
      handleZoomChange(newZoom);
    }
  }, [disabled, levels, value, handleZoomChange, maxZoom]);

  /**
   * Zoom out by one step
   */
  const handleZoomOut = useCallback(() => {
    if (disabled) return;

    // Find previous zoom level
    const prevLevels = levels.filter((level) => level.value < value - 0.001);
    const prevLevel = prevLevels[prevLevels.length - 1];
    if (prevLevel) {
      handleZoomChange(prevLevel.value);
    } else {
      // Use step decrement
      const newZoom = Math.max(value - ZOOM_STEP, minZoom);
      handleZoomChange(newZoom);
    }
  }, [disabled, levels, value, handleZoomChange, minZoom]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;

      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (isOpen && focusedIndex >= 0) {
            const level = levels[focusedIndex];
            if (level) {
              handleZoomChange(level.value);
              setIsOpen(false);
            }
          } else {
            setIsOpen((prev) => !prev);
            if (!isOpen) {
              const idx = currentLevelIndex >= 0 ? currentLevelIndex : 0;
              setFocusedIndex(idx);
            }
          }
          break;

        case 'Escape':
          setIsOpen(false);
          break;

        case 'ArrowDown':
          event.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            const idx = currentLevelIndex >= 0 ? currentLevelIndex : 0;
            setFocusedIndex(idx);
          } else {
            setFocusedIndex((prev) => (prev < levels.length - 1 ? prev + 1 : prev));
          }
          break;

        case 'ArrowUp':
          event.preventDefault();
          if (isOpen) {
            setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          }
          break;

        case 'Home':
          if (isOpen) {
            event.preventDefault();
            setFocusedIndex(0);
          }
          break;

        case 'End':
          if (isOpen) {
            event.preventDefault();
            setFocusedIndex(levels.length - 1);
          }
          break;
      }
    },
    [disabled, isOpen, focusedIndex, levels, handleZoomChange, currentLevelIndex]
  );

  /**
   * Handle level selection from dropdown
   */
  const handleSelect = useCallback(
    (level: ZoomLevel) => {
      handleZoomChange(level.value);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [handleZoomChange]
  );

  /**
   * Toggle dropdown
   */
  const toggleDropdown = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
      if (!isOpen) {
        const idx = currentLevelIndex >= 0 ? currentLevelIndex : 0;
        setFocusedIndex(idx);
      }
    }
  }, [disabled, isOpen, currentLevelIndex]);

  // Determine if zoom in/out buttons are at limits
  const canZoomIn = value < maxZoom;
  const canZoomOut = value > minZoom;

  // Get button styles
  const buttonBaseStyle = compact ? COMPACT_BUTTON_STYLE : BUTTON_STYLE;
  const triggerBaseStyle = compact ? COMPACT_TRIGGER_STYLE : DROPDOWN_TRIGGER_STYLE;
  const iconSize = compact ? 14 : 16;

  const getZoomInButtonStyle = (): CSSProperties => {
    if (disabled || !canZoomIn) return { ...buttonBaseStyle, ...BUTTON_DISABLED_STYLE };
    if (isHoveredIn) return { ...buttonBaseStyle, ...BUTTON_HOVER_STYLE };
    return buttonBaseStyle;
  };

  const getZoomOutButtonStyle = (): CSSProperties => {
    if (disabled || !canZoomOut) return { ...buttonBaseStyle, ...BUTTON_DISABLED_STYLE };
    if (isHoveredOut) return { ...buttonBaseStyle, ...BUTTON_HOVER_STYLE };
    return buttonBaseStyle;
  };

  const getTriggerStyle = (): CSSProperties => {
    if (disabled) return { ...triggerBaseStyle, ...DROPDOWN_TRIGGER_DISABLED_STYLE };
    if (isOpen) return { ...triggerBaseStyle, ...DROPDOWN_TRIGGER_FOCUS_STYLE };
    return triggerBaseStyle;
  };

  return (
    <div
      ref={containerRef}
      className={`docx-zoom-control ${className || ''}`}
      style={{ ...CONTAINER_STYLE, ...style }}
    >
      {showButtons && (
        <button
          type="button"
          className="docx-zoom-out-button"
          style={getZoomOutButtonStyle()}
          onClick={handleZoomOut}
          onMouseEnter={() => setIsHoveredOut(true)}
          onMouseLeave={() => setIsHoveredOut(false)}
          disabled={disabled || !canZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <ZoomOutIcon size={iconSize} />
        </button>
      )}

      <div style={DROPDOWN_CONTAINER_STYLE}>
        <button
          ref={triggerRef}
          type="button"
          className="docx-zoom-dropdown-trigger"
          style={getTriggerStyle()}
          onClick={toggleDropdown}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label={`Zoom: ${displayLabel}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span>{displayLabel}</span>
          <ChevronDownIcon />
        </button>

        {isOpen && (
          <div
            ref={listRef}
            className="docx-zoom-dropdown-menu"
            style={DROPDOWN_MENU_STYLE}
            role="listbox"
            aria-label="Zoom levels"
          >
            {levels.map((level, index) => {
              const isSelected = Math.abs(level.value - value) < 0.001;
              const isFocusedItem = index === focusedIndex;

              const itemStyle: CSSProperties = isSelected
                ? DROPDOWN_ITEM_SELECTED_STYLE
                : isFocusedItem
                  ? DROPDOWN_ITEM_HOVER_STYLE
                  : DROPDOWN_ITEM_STYLE;

              return (
                <button
                  key={level.value}
                  type="button"
                  data-zoom-item
                  style={itemStyle}
                  onClick={() => handleSelect(level)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  role="option"
                  aria-selected={isSelected}
                >
                  {level.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showButtons && (
        <button
          type="button"
          className="docx-zoom-in-button"
          style={getZoomInButtonStyle()}
          onClick={handleZoomIn}
          onMouseEnter={() => setIsHoveredIn(true)}
          onMouseLeave={() => setIsHoveredIn(false)}
          disabled={disabled || !canZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <ZoomInIcon size={iconSize} />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get default zoom levels
 */
export function getDefaultZoomLevels(): ZoomLevel[] {
  return [...DEFAULT_ZOOM_LEVELS];
}

/**
 * Get extended zoom levels (more granular)
 */
export function getExtendedZoomLevels(): ZoomLevel[] {
  return [...EXTENDED_ZOOM_LEVELS];
}

/**
 * Create a zoom level from a decimal value
 */
export function createZoomLevel(value: number): ZoomLevel {
  return {
    value,
    label: `${Math.round(value * 100)}%`,
  };
}

/**
 * Create zoom levels from an array of percentages
 */
export function createZoomLevelsFromPercentages(percentages: number[]): ZoomLevel[] {
  return percentages.map((pct) => ({
    value: pct / 100,
    label: `${pct}%`,
  }));
}

/**
 * Check if a zoom value is valid
 */
export function isValidZoom(
  zoom: number,
  minZoom = DEFAULT_MIN_ZOOM,
  maxZoom = DEFAULT_MAX_ZOOM
): boolean {
  return !isNaN(zoom) && zoom >= minZoom && zoom <= maxZoom;
}

/**
 * Clamp a zoom value to valid range
 */
export function clampZoom(
  zoom: number,
  minZoom = DEFAULT_MIN_ZOOM,
  maxZoom = DEFAULT_MAX_ZOOM
): number {
  return Math.min(Math.max(zoom, minZoom), maxZoom);
}

/**
 * Convert zoom decimal to percentage string
 */
export function zoomToPercentage(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

/**
 * Convert percentage to zoom decimal
 */
export function percentageToZoom(percentage: number): number {
  return percentage / 100;
}

/**
 * Parse zoom from string input (handles both "100%" and "1.0" formats)
 */
export function parseZoom(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Handle percentage format (e.g., "100%", "150%")
  if (trimmed.endsWith('%')) {
    const numStr = trimmed.slice(0, -1);
    const parsed = parseFloat(numStr);
    if (!isNaN(parsed)) {
      return parsed / 100;
    }
  }

  // Handle decimal format (e.g., "1.0", "1.5")
  const parsed = parseFloat(trimmed);
  if (!isNaN(parsed)) {
    // If the value is greater than 10, assume it's a percentage
    if (parsed > 10) {
      return parsed / 100;
    }
    return parsed;
  }

  return null;
}

/**
 * Get the nearest zoom level from predefined levels
 */
export function nearestZoomLevel(
  zoom: number,
  levels: ZoomLevel[] = DEFAULT_ZOOM_LEVELS
): ZoomLevel {
  if (levels.length === 0) return createZoomLevel(zoom);

  let nearest = levels[0];
  let minDiff = Math.abs(zoom - nearest.value);

  for (const level of levels) {
    const diff = Math.abs(zoom - level.value);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = level;
    }
  }

  return nearest;
}

/**
 * Calculate zoom to fit page width in container
 */
export function calculateFitWidthZoom(
  containerWidth: number,
  pageWidth: number,
  padding = 40
): number {
  if (pageWidth <= 0) return 1.0;
  return (containerWidth - padding) / pageWidth;
}

/**
 * Calculate zoom to fit entire page in container
 */
export function calculateFitPageZoom(
  containerWidth: number,
  containerHeight: number,
  pageWidth: number,
  pageHeight: number,
  padding = 40
): number {
  if (pageWidth <= 0 || pageHeight <= 0) return 1.0;

  const widthZoom = (containerWidth - padding) / pageWidth;
  const heightZoom = (containerHeight - padding) / pageHeight;

  return Math.min(widthZoom, heightZoom);
}

/**
 * Get stored zoom from localStorage
 */
export function getStoredZoom(storageKey = DEFAULT_STORAGE_KEY): number | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  } catch {
    // localStorage not available
  }

  return null;
}

/**
 * Store zoom to localStorage
 */
export function storeZoom(zoom: number, storageKey = DEFAULT_STORAGE_KEY): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(storageKey, zoom.toString());
  } catch {
    // localStorage not available
  }
}

/**
 * Clear stored zoom from localStorage
 */
export function clearStoredZoom(storageKey = DEFAULT_STORAGE_KEY): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(storageKey);
  } catch {
    // localStorage not available
  }
}

/**
 * Check if zoom levels contain a specific zoom value
 */
export function hasZoomLevel(zoom: number, levels: ZoomLevel[] = DEFAULT_ZOOM_LEVELS): boolean {
  return levels.some((level) => Math.abs(level.value - zoom) < 0.001);
}

/**
 * Get zoom step for increment/decrement
 */
export function getZoomStep(): number {
  return ZOOM_STEP;
}

/**
 * Apply zoom transform to a CSS style object
 */
export function applyZoomTransform(style: CSSProperties, zoom: number): CSSProperties {
  return {
    ...style,
    transform: zoom !== 1 ? `scale(${zoom})` : undefined,
    transformOrigin: 'top left',
  };
}

/**
 * Calculate dimensions after zoom
 */
export function getZoomedDimensions(
  width: number,
  height: number,
  zoom: number
): { width: number; height: number } {
  return {
    width: width * zoom,
    height: height * zoom,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ZoomControl;

// Export icons for external use
export { ZoomInIcon, ZoomOutIcon };
