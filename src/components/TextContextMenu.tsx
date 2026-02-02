/**
 * Text Context Menu Component
 *
 * Right-click context menu for text editing operations.
 * Shows Cut, Copy, Paste, and other text editing options.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Context menu action types
 */
export type TextContextAction =
  | 'cut'
  | 'copy'
  | 'paste'
  | 'pasteAsPlainText'
  | 'selectAll'
  | 'delete'
  | 'separator';

/**
 * Menu item configuration
 */
export interface TextContextMenuItem {
  /** Action type */
  action: TextContextAction;
  /** Display label */
  label: string;
  /** Keyboard shortcut hint */
  shortcut?: string;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Whether to show divider after this item */
  dividerAfter?: boolean;
}

/**
 * Context menu props
 */
export interface TextContextMenuProps {
  /** Whether the menu is visible */
  isOpen: boolean;
  /** Menu position */
  position: { x: number; y: number };
  /** Whether there's a selection (enables copy/cut) */
  hasSelection: boolean;
  /** Whether the editor is editable (enables paste/cut/delete) */
  isEditable: boolean;
  /** Whether clipboard has content (enables paste) */
  hasClipboardContent?: boolean;
  /** Callback when an action is selected */
  onAction: (action: TextContextAction) => void;
  /** Callback when menu is closed */
  onClose: () => void;
  /** Custom menu items (overrides default) */
  items?: TextContextMenuItem[];
  /** Additional className */
  className?: string;
}

/**
 * Hook options for text context menu
 */
export interface UseTextContextMenuOptions {
  /** Whether the context menu is enabled */
  enabled?: boolean;
  /** Whether the editor is editable */
  isEditable?: boolean;
  /** Container element ref */
  containerRef?: React.RefObject<HTMLElement>;
  /** Callback when an action is triggered */
  onAction?: (action: TextContextAction) => void;
}

/**
 * Hook return value
 */
export interface UseTextContextMenuReturn {
  /** Whether the menu is open */
  isOpen: boolean;
  /** Menu position */
  position: { x: number; y: number };
  /** Whether there's a text selection */
  hasSelection: boolean;
  /** Open the context menu */
  openMenu: (event: React.MouseEvent | MouseEvent) => void;
  /** Close the context menu */
  closeMenu: () => void;
  /** Handle action selection */
  handleAction: (action: TextContextAction) => void;
  /** Context menu event handler for onContextMenu prop */
  onContextMenu: (event: React.MouseEvent) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default menu items
 */
const DEFAULT_MENU_ITEMS: TextContextMenuItem[] = [
  { action: 'cut', label: 'Cut', shortcut: 'Ctrl+X' },
  { action: 'copy', label: 'Copy', shortcut: 'Ctrl+C' },
  { action: 'paste', label: 'Paste', shortcut: 'Ctrl+V' },
  {
    action: 'pasteAsPlainText',
    label: 'Paste as Plain Text',
    shortcut: 'Ctrl+Shift+V',
    dividerAfter: true,
  },
  { action: 'delete', label: 'Delete', shortcut: 'Del', dividerAfter: true },
  { action: 'selectAll', label: 'Select All', shortcut: 'Ctrl+A' },
];

// ============================================================================
// ICONS
// ============================================================================

const CutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="4" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M5.5 10.5L10.5 3M10.5 10.5L5.5 3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="8" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M11 5V3a1 1 0 00-1-1H4a1 1 0 00-1 1v8a1 1 0 001 1h2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const PasteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="10" height="11" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 3V2a1 1 0 011-1h2a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 8h4M6 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const SelectAllIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="2"
      y="2"
      width="12"
      height="12"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeDasharray="2 2"
    />
    <rect x="4" y="4" width="8" height="8" fill="currentColor" opacity="0.3" />
  </svg>
);

/**
 * Get icon for action
 */
function getActionIcon(action: TextContextAction): React.ReactNode {
  switch (action) {
    case 'cut':
      return <CutIcon />;
    case 'copy':
      return <CopyIcon />;
    case 'paste':
    case 'pasteAsPlainText':
      return <PasteIcon />;
    case 'delete':
      return <DeleteIcon />;
    case 'selectAll':
      return <SelectAllIcon />;
    default:
      return null;
  }
}

// ============================================================================
// MENU ITEM COMPONENT
// ============================================================================

interface MenuItemComponentProps {
  item: TextContextMenuItem;
  onClick: () => void;
  isHighlighted: boolean;
  onMouseEnter: () => void;
}

const MenuItemComponent: React.FC<MenuItemComponentProps> = ({
  item,
  onClick,
  isHighlighted,
  onMouseEnter,
}) => {
  if (item.action === 'separator') {
    return (
      <div
        className="docx-text-context-menu-separator"
        style={{
          height: '1px',
          backgroundColor: '#e0e0e0',
          margin: '4px 12px',
        }}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        className={`docx-text-context-menu-item ${isHighlighted ? 'docx-text-context-menu-item-highlighted' : ''} ${item.disabled ? 'docx-text-context-menu-item-disabled' : ''}`}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        disabled={item.disabled}
        role="menuitem"
        aria-disabled={item.disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          padding: '8px 12px',
          border: 'none',
          background: isHighlighted && !item.disabled ? '#e8f0fe' : 'transparent',
          cursor: item.disabled ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          color: item.disabled ? '#9e9e9e' : '#202124',
          textAlign: 'left',
          opacity: item.disabled ? 0.6 : 1,
        }}
      >
        <span style={{ display: 'flex', color: item.disabled ? '#bdbdbd' : '#5f6368' }}>
          {getActionIcon(item.action)}
        </span>
        <span style={{ flex: 1 }}>{item.label}</span>
        {item.shortcut && (
          <span
            style={{
              fontSize: '11px',
              color: '#9aa0a6',
              fontFamily: 'monospace',
            }}
          >
            {item.shortcut}
          </span>
        )}
      </button>
      {item.dividerAfter && (
        <div
          className="docx-text-context-menu-separator"
          style={{
            height: '1px',
            backgroundColor: '#e0e0e0',
            margin: '4px 12px',
          }}
        />
      )}
    </>
  );
};

// ============================================================================
// TEXT CONTEXT MENU COMPONENT
// ============================================================================

export const TextContextMenu: React.FC<TextContextMenuProps> = ({
  isOpen,
  position,
  hasSelection,
  isEditable,
  hasClipboardContent = true,
  onAction,
  onClose,
  items,
  className = '',
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Build menu items with disabled states
  const menuItems = (items || DEFAULT_MENU_ITEMS).map((item) => {
    const disabled = (() => {
      if (item.disabled !== undefined) return item.disabled;
      switch (item.action) {
        case 'cut':
        case 'copy':
        case 'delete':
          return !hasSelection;
        case 'paste':
        case 'pasteAsPlainText':
          return !isEditable || !hasClipboardContent;
        default:
          return false;
      }
    })();

    return { ...item, disabled };
  });

  // Filter out separators for keyboard navigation
  const navigableItems = menuItems.filter((item) => item.action !== 'separator');

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Use timeout to avoid immediately closing on right-click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => {
            let next = (prev + 1) % navigableItems.length;
            // Skip disabled items
            while (navigableItems[next]?.disabled && next !== prev) {
              next = (next + 1) % navigableItems.length;
            }
            return next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => {
            let next = (prev - 1 + navigableItems.length) % navigableItems.length;
            // Skip disabled items
            while (navigableItems[next]?.disabled && next !== prev) {
              next = (next - 1 + navigableItems.length) % navigableItems.length;
            }
            return next;
          });
          break;
        case 'Enter':
          e.preventDefault();
          const item = navigableItems[highlightedIndex];
          if (item && !item.disabled) {
            onAction(item.action);
            onClose();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, highlightedIndex, navigableItems, onAction, onClose]);

  // Reset highlighted index when menu opens
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  // Position menu to stay within viewport
  const getMenuStyle = useCallback((): React.CSSProperties => {
    const menuWidth = 220;
    const menuHeight = menuItems.length * 36 + 16;

    let x = position.x;
    let y = position.y;

    if (typeof window !== 'undefined') {
      if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - 10;
      }
      if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - 10;
      }
      if (x < 10) x = 10;
      if (y < 10) y = 10;
    }

    return {
      position: 'fixed',
      top: y,
      left: x,
      minWidth: menuWidth,
      background: '#fff',
      border: '1px solid #dadce0',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
      zIndex: 10000,
      padding: '4px 0',
      overflow: 'hidden',
    };
  }, [position, menuItems.length]);

  const handleItemClick = (item: TextContextMenuItem) => {
    if (item.disabled) return;
    onAction(item.action);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className={`docx-text-context-menu ${className}`}
      style={getMenuStyle()}
      role="menu"
      aria-label="Text editing menu"
    >
      {menuItems.map((item, index) => {
        // Find the index in navigable items for highlighting
        const navigableIndex = navigableItems.findIndex((ni) => ni === item);

        return (
          <MenuItemComponent
            key={`${item.action}-${index}`}
            item={item}
            onClick={() => handleItemClick(item)}
            isHighlighted={navigableIndex === highlightedIndex}
            onMouseEnter={() => {
              if (navigableIndex >= 0 && !item.disabled) {
                setHighlightedIndex(navigableIndex);
              }
            }}
          />
        );
      })}
    </div>
  );
};

// ============================================================================
// USE TEXT CONTEXT MENU HOOK
// ============================================================================

/**
 * Hook to manage text context menu state
 */
export function useTextContextMenu(
  options: UseTextContextMenuOptions = {}
): UseTextContextMenuReturn {
  const {
    enabled = true,
    isEditable: _isEditable = true,
    containerRef: _containerRef,
    onAction,
  } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hasSelection, setHasSelection] = useState(false);

  /**
   * Check if there's a text selection
   */
  const checkSelection = useCallback(() => {
    const selection = window.getSelection();
    const hasText = selection && !selection.isCollapsed && selection.toString().length > 0;
    setHasSelection(!!hasText);
    return !!hasText;
  }, []);

  /**
   * Open the context menu
   */
  const openMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      if (!enabled) return;

      event.preventDefault();
      event.stopPropagation();

      // Update selection state
      checkSelection();

      setPosition({ x: event.clientX, y: event.clientY });
      setIsOpen(true);
    },
    [enabled, checkSelection]
  );

  /**
   * Close the context menu
   */
  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  /**
   * Handle action selection
   */
  const handleAction = useCallback(
    (action: TextContextAction) => {
      closeMenu();

      // Execute the action
      switch (action) {
        case 'cut':
          document.execCommand('cut');
          break;
        case 'copy':
          document.execCommand('copy');
          break;
        case 'paste':
          document.execCommand('paste');
          break;
        case 'pasteAsPlainText':
          // Trigger paste event with shift key simulation
          // Note: This may not work in all browsers due to security restrictions
          navigator.clipboard
            .readText?.()
            .then((text) => {
              document.execCommand('insertText', false, text);
            })
            .catch(() => {
              // Fallback - just try regular paste
              document.execCommand('paste');
            });
          break;
        case 'delete':
          document.execCommand('delete');
          break;
        case 'selectAll':
          document.execCommand('selectAll');
          break;
      }

      onAction?.(action);
    },
    [closeMenu, onAction]
  );

  /**
   * Context menu event handler
   */
  const onContextMenu = useCallback(
    (event: React.MouseEvent) => {
      openMenu(event);
    },
    [openMenu]
  );

  // Close menu when clicking elsewhere or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeMenu]);

  return {
    isOpen,
    position,
    hasSelection,
    openMenu,
    closeMenu,
    handleAction,
    onContextMenu,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get action label
 */
export function getTextActionLabel(action: TextContextAction): string {
  const labels: Record<TextContextAction, string> = {
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    pasteAsPlainText: 'Paste as Plain Text',
    selectAll: 'Select All',
    delete: 'Delete',
    separator: '',
  };
  return labels[action];
}

/**
 * Get action shortcut
 */
export function getTextActionShortcut(action: TextContextAction): string {
  const shortcuts: Record<TextContextAction, string> = {
    cut: 'Ctrl+X',
    copy: 'Ctrl+C',
    paste: 'Ctrl+V',
    pasteAsPlainText: 'Ctrl+Shift+V',
    selectAll: 'Ctrl+A',
    delete: 'Del',
    separator: '',
  };
  return shortcuts[action];
}

/**
 * Get default menu items
 */
export function getDefaultTextContextMenuItems(): TextContextMenuItem[] {
  return [...DEFAULT_MENU_ITEMS];
}

/**
 * Check if action is available
 */
export function isTextActionAvailable(
  action: TextContextAction,
  hasSelection: boolean,
  isEditable: boolean
): boolean {
  switch (action) {
    case 'cut':
    case 'copy':
    case 'delete':
      return hasSelection;
    case 'paste':
    case 'pasteAsPlainText':
      return isEditable;
    case 'selectAll':
      return true;
    default:
      return true;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default TextContextMenu;
