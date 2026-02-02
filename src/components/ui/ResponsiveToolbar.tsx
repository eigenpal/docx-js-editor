/**
 * Responsive Toolbar Component
 *
 * A responsive toolbar wrapper that collapses items into an overflow menu
 * when the screen is narrow.
 *
 * Features:
 * - Automatically measures available space
 * - Moves items to overflow menu when they don't fit
 * - Priority-based item ordering
 * - Configurable breakpoints
 * - ResizeObserver for dynamic resizing
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode, CSSProperties, ReactElement } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Priority level for toolbar items
 * Lower numbers = higher priority (shown first, hidden last)
 */
export type ToolbarItemPriority = 1 | 2 | 3 | 4 | 5;

/**
 * Toolbar item configuration
 */
export interface ToolbarItem {
  /** Unique identifier */
  id: string;
  /** The content to render */
  content: ReactNode;
  /** Priority level (1 = highest, 5 = lowest) */
  priority?: ToolbarItemPriority;
  /** Minimum width in pixels (for measuring) */
  minWidth?: number;
  /** Whether this item should never be hidden */
  alwaysVisible?: boolean;
  /** Whether to show separator after this item */
  separatorAfter?: boolean;
  /** Group name for keeping items together */
  group?: string;
}

/**
 * Props for ResponsiveToolbar component
 */
export interface ResponsiveToolbarProps {
  /** Toolbar items */
  items: ToolbarItem[];
  /** Additional items for overflow menu only */
  overflowItems?: ToolbarItem[];
  /** Whether to show overflow button even when all items fit */
  alwaysShowOverflow?: boolean;
  /** Custom overflow button renderer */
  renderOverflowButton?: (itemCount: number, isOpen: boolean, onClick: () => void) => ReactNode;
  /** Custom overflow menu renderer */
  renderOverflowMenu?: (items: ToolbarItem[], onClose: () => void) => ReactNode;
  /** Gap between items in pixels */
  itemGap?: number;
  /** Padding for the toolbar */
  padding?: number | string;
  /** Minimum width for overflow button */
  overflowButtonWidth?: number;
  /** Additional className */
  className?: string;
  /** Additional styles */
  style?: CSSProperties;
  /** Height of the toolbar */
  height?: number | string;
  /** Background color */
  backgroundColor?: string;
  /** Border styles */
  borderBottom?: string;
}

/**
 * Options for useResponsiveToolbar hook
 */
export interface UseResponsiveToolbarOptions {
  /** Container ref */
  containerRef: React.RefObject<HTMLElement>;
  /** Total items */
  items: ToolbarItem[];
  /** Gap between items */
  itemGap?: number;
  /** Width reserved for overflow button */
  overflowButtonWidth?: number;
}

/**
 * Return value of useResponsiveToolbar hook
 */
export interface UseResponsiveToolbarReturn {
  /** Items that fit in visible area */
  visibleItems: ToolbarItem[];
  /** Items in overflow menu */
  overflowItems: ToolbarItem[];
  /** Whether overflow menu is needed */
  hasOverflow: boolean;
  /** Force a recalculation */
  recalculate: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_ITEM_GAP = 4;
const DEFAULT_OVERFLOW_BUTTON_WIDTH = 36;
const DEFAULT_ITEM_MIN_WIDTH = 32;

// ============================================================================
// ICONS
// ============================================================================

const MoreIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="3" cy="8" r="1.5" fill="currentColor" />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    <circle cx="13" cy="8" r="1.5" fill="currentColor" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ============================================================================
// USE RESPONSIVE TOOLBAR HOOK
// ============================================================================

/**
 * Hook to calculate which items fit in the toolbar
 */
export function useResponsiveToolbar(
  options: UseResponsiveToolbarOptions
): UseResponsiveToolbarReturn {
  const {
    containerRef,
    items,
    itemGap = DEFAULT_ITEM_GAP,
    overflowButtonWidth = DEFAULT_OVERFLOW_BUTTON_WIDTH,
  } = options;

  const [visibleCount, setVisibleCount] = useState(items.length);
  const itemWidthsRef = useRef<Map<string, number>>(new Map());

  /**
   * Calculate which items fit
   */
  const calculateVisibleItems = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      setVisibleCount(items.length);
      return;
    }

    const containerWidth = container.offsetWidth;
    if (containerWidth === 0) {
      return;
    }

    // Sort items by priority (always visible first, then by priority number)
    const sortedItems = [...items].sort((a, b) => {
      if (a.alwaysVisible && !b.alwaysVisible) return -1;
      if (!a.alwaysVisible && b.alwaysVisible) return 1;
      return (a.priority || 3) - (b.priority || 3);
    });

    // Calculate how many items fit
    let usedWidth = 0;
    let count = 0;

    for (const item of sortedItems) {
      const itemWidth = item.minWidth || itemWidthsRef.current.get(item.id) || DEFAULT_ITEM_MIN_WIDTH;
      const widthWithGap = itemWidth + (count > 0 ? itemGap : 0);

      // Reserve space for overflow button if not all items will fit
      const reservedWidth = count < items.length - 1 ? overflowButtonWidth + itemGap : 0;

      if (usedWidth + widthWithGap + reservedWidth <= containerWidth) {
        usedWidth += widthWithGap;
        count++;
      } else if (item.alwaysVisible) {
        // Force include always visible items
        usedWidth += widthWithGap;
        count++;
      } else {
        break;
      }
    }

    setVisibleCount(Math.max(0, count));
  }, [containerRef, items, itemGap, overflowButtonWidth]);

  /**
   * Set up ResizeObserver
   */
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial calculation
    calculateVisibleItems();

    // Set up observer
    const resizeObserver = new ResizeObserver(() => {
      calculateVisibleItems();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef, calculateVisibleItems]);

  // Recalculate when items change
  useEffect(() => {
    calculateVisibleItems();
  }, [items, calculateVisibleItems]);

  // Split items into visible and overflow
  const { visibleItems, overflowItems } = useMemo(() => {
    // Sort by priority for display
    const sortedItems = [...items].sort((a, b) => {
      if (a.alwaysVisible && !b.alwaysVisible) return -1;
      if (!a.alwaysVisible && b.alwaysVisible) return 1;
      return (a.priority || 3) - (b.priority || 3);
    });

    return {
      visibleItems: sortedItems.slice(0, visibleCount),
      overflowItems: sortedItems.slice(visibleCount),
    };
  }, [items, visibleCount]);

  return {
    visibleItems,
    overflowItems,
    hasOverflow: overflowItems.length > 0,
    recalculate: calculateVisibleItems,
  };
}

// ============================================================================
// OVERFLOW MENU COMPONENT
// ============================================================================

interface OverflowMenuProps {
  items: ToolbarItem[];
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}

const OverflowMenu: React.FC<OverflowMenuProps> = ({
  items,
  isOpen,
  onClose,
  anchorRef,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || items.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="docx-responsive-toolbar-overflow-menu"
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: '4px',
        backgroundColor: '#fff',
        border: '1px solid #dadce0',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        padding: '8px',
        zIndex: 1000,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        maxWidth: '300px',
      }}
      role="menu"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="docx-responsive-toolbar-overflow-item"
          role="menuitem"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// RESPONSIVE TOOLBAR COMPONENT
// ============================================================================

export const ResponsiveToolbar: React.FC<ResponsiveToolbarProps> = ({
  items,
  overflowItems: additionalOverflowItems = [],
  alwaysShowOverflow = false,
  renderOverflowButton,
  renderOverflowMenu,
  itemGap = DEFAULT_ITEM_GAP,
  padding = '8px 12px',
  overflowButtonWidth = DEFAULT_OVERFLOW_BUTTON_WIDTH,
  className = '',
  style,
  height = 44,
  backgroundColor = '#f8f9fa',
  borderBottom = '1px solid #e0e0e0',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const overflowButtonRef = useRef<HTMLButtonElement>(null);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const { visibleItems, overflowItems, hasOverflow } = useResponsiveToolbar({
    containerRef,
    items,
    itemGap,
    overflowButtonWidth,
  });

  // Combine overflow items with additional items
  const allOverflowItems = [...overflowItems, ...additionalOverflowItems];
  const showOverflow = hasOverflow || alwaysShowOverflow || additionalOverflowItems.length > 0;

  const toggleOverflow = useCallback(() => {
    setIsOverflowOpen((prev) => !prev);
  }, []);

  const closeOverflow = useCallback(() => {
    setIsOverflowOpen(false);
  }, []);

  // Default overflow button
  const defaultOverflowButton = (
    <button
      ref={overflowButtonRef}
      type="button"
      className="docx-responsive-toolbar-overflow-button"
      onClick={toggleOverflow}
      aria-label={`Show ${allOverflowItems.length} more options`}
      aria-expanded={isOverflowOpen}
      aria-haspopup="menu"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${overflowButtonWidth}px`,
        height: '32px',
        border: 'none',
        borderRadius: '4px',
        backgroundColor: isOverflowOpen ? '#e8f0fe' : 'transparent',
        color: '#5f6368',
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
      }}
    >
      <MoreIcon />
    </button>
  );

  return (
    <div
      ref={containerRef}
      className={`docx-responsive-toolbar ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: `${itemGap}px`,
        height: typeof height === 'number' ? `${height}px` : height,
        padding,
        backgroundColor,
        borderBottom,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Visible items */}
      {visibleItems.map((item) => (
        <React.Fragment key={item.id}>
          <div
            className="docx-responsive-toolbar-item"
            data-item-id={item.id}
            style={{ flexShrink: 0 }}
          >
            {item.content}
          </div>
          {item.separatorAfter && (
            <div
              className="docx-responsive-toolbar-separator"
              style={{
                width: '1px',
                height: '24px',
                backgroundColor: '#dadce0',
                margin: '0 4px',
              }}
            />
          )}
        </React.Fragment>
      ))}

      {/* Spacer to push overflow button to the right */}
      {showOverflow && <div style={{ flex: 1, minWidth: 0 }} />}

      {/* Overflow button */}
      {showOverflow && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {renderOverflowButton
            ? renderOverflowButton(allOverflowItems.length, isOverflowOpen, toggleOverflow)
            : defaultOverflowButton}

          {/* Overflow menu */}
          {renderOverflowMenu ? (
            isOverflowOpen && renderOverflowMenu(allOverflowItems, closeOverflow)
          ) : (
            <OverflowMenu
              items={allOverflowItems}
              isOpen={isOverflowOpen}
              onClose={closeOverflow}
              anchorRef={overflowButtonRef}
            />
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// TOOLBAR GROUP COMPONENT
// ============================================================================

export interface ToolbarGroupProps {
  /** Group items */
  children: ReactNode;
  /** Gap between items */
  gap?: number;
  /** Whether to show separator after group */
  separatorAfter?: boolean;
  /** Additional className */
  className?: string;
  /** Additional styles */
  style?: CSSProperties;
}

export const ToolbarGroup: React.FC<ToolbarGroupProps> = ({
  children,
  gap = 2,
  separatorAfter = false,
  className = '',
  style,
}) => {
  return (
    <>
      <div
        className={`docx-toolbar-group ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: `${gap}px`,
          ...style,
        }}
      >
        {children}
      </div>
      {separatorAfter && (
        <div
          className="docx-toolbar-group-separator"
          style={{
            width: '1px',
            height: '24px',
            backgroundColor: '#dadce0',
            margin: '0 4px',
          }}
        />
      )}
    </>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a toolbar item
 */
export function createToolbarItem(
  id: string,
  content: ReactNode,
  options?: Partial<Omit<ToolbarItem, 'id' | 'content'>>
): ToolbarItem {
  return {
    id,
    content,
    priority: 3,
    ...options,
  };
}

/**
 * Create toolbar items from an array of configs
 */
export function createToolbarItems(
  configs: Array<{
    id: string;
    content: ReactNode;
    priority?: ToolbarItemPriority;
    minWidth?: number;
    alwaysVisible?: boolean;
    separatorAfter?: boolean;
    group?: string;
  }>
): ToolbarItem[] {
  return configs.map((config) => ({
    ...config,
    priority: config.priority || 3,
  }));
}

/**
 * Get recommended priority for common toolbar items
 */
export function getRecommendedPriority(itemType: string): ToolbarItemPriority {
  const priorities: Record<string, ToolbarItemPriority> = {
    undo: 1,
    redo: 1,
    bold: 1,
    italic: 1,
    underline: 2,
    fontFamily: 2,
    fontSize: 2,
    textColor: 3,
    highlightColor: 3,
    alignment: 3,
    lists: 4,
    indent: 4,
    lineSpacing: 5,
    styles: 5,
  };
  return priorities[itemType] || 3;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ResponsiveToolbar;
