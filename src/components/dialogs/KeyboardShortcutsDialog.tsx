/**
 * Keyboard Shortcuts Dialog Component
 *
 * Displays all available keyboard shortcuts organized by category.
 * Features:
 * - Categorized shortcut list
 * - Search/filter functionality
 * - Platform-aware modifier keys (Ctrl/Cmd)
 * - Keyboard shortcut to open (Ctrl+/)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of what the shortcut does */
  description: string;
  /** Primary key combination (e.g., 'Ctrl+C') */
  keys: string;
  /** Alternative key combination */
  altKeys?: string;
  /** Category for grouping */
  category: ShortcutCategory;
  /** Whether this is a common/frequently used shortcut */
  common?: boolean;
}

/**
 * Shortcut category
 */
export type ShortcutCategory =
  | 'editing'
  | 'formatting'
  | 'navigation'
  | 'clipboard'
  | 'selection'
  | 'view'
  | 'file'
  | 'other';

/**
 * Dialog props
 */
export interface KeyboardShortcutsDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
  /** Custom shortcuts (merged with defaults) */
  customShortcuts?: KeyboardShortcut[];
  /** Whether to show search */
  showSearch?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Hook options
 */
export interface UseKeyboardShortcutsDialogOptions {
  /** Whether the dialog can be opened with Ctrl+? or F1 */
  enabled?: boolean;
  /** Custom open shortcut (default: Ctrl+/) */
  openShortcut?: string;
}

/**
 * Hook return value
 */
export interface UseKeyboardShortcutsDialogReturn {
  /** Whether dialog is open */
  isOpen: boolean;
  /** Open the dialog */
  open: () => void;
  /** Close the dialog */
  close: () => void;
  /** Toggle the dialog */
  toggle: () => void;
  /** Keyboard event handler */
  handleKeyDown: (event: KeyboardEvent) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Category labels
 */
const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  editing: 'Editing',
  formatting: 'Formatting',
  navigation: 'Navigation',
  clipboard: 'Clipboard',
  selection: 'Selection',
  view: 'View',
  file: 'File',
  other: 'Other',
};

/**
 * Category order for display
 */
const CATEGORY_ORDER: ShortcutCategory[] = [
  'file',
  'editing',
  'clipboard',
  'formatting',
  'selection',
  'navigation',
  'view',
  'other',
];

/**
 * Default keyboard shortcuts
 */
const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  // File
  {
    id: 'save',
    name: 'Save',
    description: 'Save document',
    keys: 'Ctrl+S',
    category: 'file',
    common: true,
  },
  { id: 'print', name: 'Print', description: 'Print document', keys: 'Ctrl+P', category: 'file' },

  // Editing
  {
    id: 'undo',
    name: 'Undo',
    description: 'Undo last action',
    keys: 'Ctrl+Z',
    category: 'editing',
    common: true,
  },
  {
    id: 'redo',
    name: 'Redo',
    description: 'Redo last action',
    keys: 'Ctrl+Y',
    altKeys: 'Ctrl+Shift+Z',
    category: 'editing',
    common: true,
  },
  {
    id: 'delete',
    name: 'Delete',
    description: 'Delete selected text',
    keys: 'Del',
    altKeys: 'Backspace',
    category: 'editing',
  },
  {
    id: 'find',
    name: 'Find',
    description: 'Find text in document',
    keys: 'Ctrl+F',
    category: 'editing',
    common: true,
  },
  {
    id: 'replace',
    name: 'Find & Replace',
    description: 'Find and replace text',
    keys: 'Ctrl+H',
    category: 'editing',
  },

  // Clipboard
  {
    id: 'cut',
    name: 'Cut',
    description: 'Cut selected text',
    keys: 'Ctrl+X',
    category: 'clipboard',
    common: true,
  },
  {
    id: 'copy',
    name: 'Copy',
    description: 'Copy selected text',
    keys: 'Ctrl+C',
    category: 'clipboard',
    common: true,
  },
  {
    id: 'paste',
    name: 'Paste',
    description: 'Paste from clipboard',
    keys: 'Ctrl+V',
    category: 'clipboard',
    common: true,
  },
  {
    id: 'paste-plain',
    name: 'Paste as Plain Text',
    description: 'Paste without formatting',
    keys: 'Ctrl+Shift+V',
    category: 'clipboard',
  },

  // Formatting
  {
    id: 'bold',
    name: 'Bold',
    description: 'Toggle bold formatting',
    keys: 'Ctrl+B',
    category: 'formatting',
    common: true,
  },
  {
    id: 'italic',
    name: 'Italic',
    description: 'Toggle italic formatting',
    keys: 'Ctrl+I',
    category: 'formatting',
    common: true,
  },
  {
    id: 'underline',
    name: 'Underline',
    description: 'Toggle underline formatting',
    keys: 'Ctrl+U',
    category: 'formatting',
    common: true,
  },
  {
    id: 'strikethrough',
    name: 'Strikethrough',
    description: 'Toggle strikethrough',
    keys: 'Ctrl+Shift+X',
    category: 'formatting',
  },
  {
    id: 'subscript',
    name: 'Subscript',
    description: 'Toggle subscript',
    keys: 'Ctrl+=',
    category: 'formatting',
  },
  {
    id: 'superscript',
    name: 'Superscript',
    description: 'Toggle superscript',
    keys: 'Ctrl+Shift+=',
    category: 'formatting',
  },
  {
    id: 'align-left',
    name: 'Align Left',
    description: 'Left align paragraph',
    keys: 'Ctrl+L',
    category: 'formatting',
  },
  {
    id: 'align-center',
    name: 'Align Center',
    description: 'Center align paragraph',
    keys: 'Ctrl+E',
    category: 'formatting',
  },
  {
    id: 'align-right',
    name: 'Align Right',
    description: 'Right align paragraph',
    keys: 'Ctrl+R',
    category: 'formatting',
  },
  {
    id: 'align-justify',
    name: 'Justify',
    description: 'Justify paragraph',
    keys: 'Ctrl+J',
    category: 'formatting',
  },
  {
    id: 'indent',
    name: 'Increase Indent',
    description: 'Increase paragraph indent',
    keys: 'Tab',
    category: 'formatting',
  },
  {
    id: 'outdent',
    name: 'Decrease Indent',
    description: 'Decrease paragraph indent',
    keys: 'Shift+Tab',
    category: 'formatting',
  },

  // Selection
  {
    id: 'select-all',
    name: 'Select All',
    description: 'Select all content',
    keys: 'Ctrl+A',
    category: 'selection',
    common: true,
  },
  {
    id: 'select-word',
    name: 'Select Word',
    description: 'Select current word',
    keys: 'Double-click',
    category: 'selection',
  },
  {
    id: 'select-paragraph',
    name: 'Select Paragraph',
    description: 'Select current paragraph',
    keys: 'Triple-click',
    category: 'selection',
  },
  {
    id: 'extend-selection-word',
    name: 'Extend Selection by Word',
    description: 'Extend selection to next/previous word',
    keys: 'Ctrl+Shift+Arrow',
    category: 'selection',
  },
  {
    id: 'extend-selection-line',
    name: 'Extend Selection to Line Edge',
    description: 'Extend selection to line start/end',
    keys: 'Shift+Home/End',
    category: 'selection',
  },

  // Navigation
  {
    id: 'move-word',
    name: 'Move by Word',
    description: 'Move cursor to next/previous word',
    keys: 'Ctrl+Arrow',
    category: 'navigation',
  },
  {
    id: 'move-line-start',
    name: 'Move to Line Start',
    description: 'Move cursor to start of line',
    keys: 'Home',
    category: 'navigation',
  },
  {
    id: 'move-line-end',
    name: 'Move to Line End',
    description: 'Move cursor to end of line',
    keys: 'End',
    category: 'navigation',
  },
  {
    id: 'move-doc-start',
    name: 'Move to Document Start',
    description: 'Move cursor to start of document',
    keys: 'Ctrl+Home',
    category: 'navigation',
  },
  {
    id: 'move-doc-end',
    name: 'Move to Document End',
    description: 'Move cursor to end of document',
    keys: 'Ctrl+End',
    category: 'navigation',
  },
  {
    id: 'page-up',
    name: 'Page Up',
    description: 'Scroll up one page',
    keys: 'Page Up',
    category: 'navigation',
  },
  {
    id: 'page-down',
    name: 'Page Down',
    description: 'Scroll down one page',
    keys: 'Page Down',
    category: 'navigation',
  },

  // View
  {
    id: 'zoom-in',
    name: 'Zoom In',
    description: 'Increase zoom level',
    keys: 'Ctrl++',
    altKeys: 'Ctrl+Scroll Up',
    category: 'view',
  },
  {
    id: 'zoom-out',
    name: 'Zoom Out',
    description: 'Decrease zoom level',
    keys: 'Ctrl+-',
    altKeys: 'Ctrl+Scroll Down',
    category: 'view',
  },
  {
    id: 'zoom-reset',
    name: 'Reset Zoom',
    description: 'Reset zoom to 100%',
    keys: 'Ctrl+0',
    category: 'view',
  },
  {
    id: 'shortcuts',
    name: 'Keyboard Shortcuts',
    description: 'Show this help dialog',
    keys: 'Ctrl+/',
    altKeys: 'F1',
    category: 'view',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Detect if running on Mac
 */
function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

/**
 * Format key combination for current platform
 */
function formatKeys(keys: string): string {
  if (isMac()) {
    return keys
      .replace(/Ctrl\+/g, '\u2318')
      .replace(/Alt\+/g, '\u2325')
      .replace(/Shift\+/g, '\u21E7');
  }
  return keys;
}

// ============================================================================
// SHORTCUT ITEM COMPONENT
// ============================================================================

interface ShortcutItemProps {
  shortcut: KeyboardShortcut;
}

const ShortcutItem: React.FC<ShortcutItemProps> = ({ shortcut }) => {
  const formattedKeys = formatKeys(shortcut.keys);
  const formattedAltKeys = shortcut.altKeys ? formatKeys(shortcut.altKeys) : null;

  return (
    <div
      className="docx-shortcut-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid var(--doc-border-light)',
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--doc-text)',
          }}
        >
          {shortcut.name}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: 'var(--doc-text-muted)',
            marginTop: '2px',
          }}
        >
          {shortcut.description}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <kbd
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 8px',
            fontSize: '12px',
            fontFamily: 'monospace',
            color: 'var(--doc-text)',
            backgroundColor: 'var(--doc-bg-hover)',
            borderRadius: '4px',
            border: '1px solid var(--doc-border-light)',
            boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
          }}
        >
          {formattedKeys}
        </kbd>
        {formattedAltKeys && (
          <>
            <span style={{ color: 'var(--doc-text-subtle)', fontSize: '11px' }}>or</span>
            <kbd
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 8px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: 'var(--doc-text)',
                backgroundColor: 'var(--doc-bg-hover)',
                borderRadius: '4px',
                border: '1px solid var(--doc-border-light)',
                boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
              }}
            >
              {formattedAltKeys}
            </kbd>
          </>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// KEYBOARD SHORTCUTS DIALOG COMPONENT
// ============================================================================

export const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({
  isOpen,
  onClose,
  customShortcuts = [],
  showSearch = true,
  className = '',
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Merge custom shortcuts with defaults
  const allShortcuts = useMemo(() => {
    const merged = [...DEFAULT_SHORTCUTS];
    for (const custom of customShortcuts) {
      const existingIndex = merged.findIndex((s) => s.id === custom.id);
      if (existingIndex >= 0) {
        merged[existingIndex] = custom;
      } else {
        merged.push(custom);
      }
    }
    return merged;
  }, [customShortcuts]);

  // Filter shortcuts by search query
  const filteredShortcuts = useMemo(() => {
    if (!searchQuery.trim()) return allShortcuts;

    const query = searchQuery.toLowerCase();
    return allShortcuts.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.keys.toLowerCase().includes(query) ||
        (s.altKeys && s.altKeys.toLowerCase().includes(query))
    );
  }, [allShortcuts, searchQuery]);

  // Group shortcuts by category
  const groupedShortcuts = useMemo(() => {
    const groups = new Map<ShortcutCategory, KeyboardShortcut[]>();

    for (const shortcut of filteredShortcuts) {
      const existing = groups.get(shortcut.category) || [];
      existing.push(shortcut);
      groups.set(shortcut.category, existing);
    }

    // Sort by category order
    const sorted: Array<{ category: ShortcutCategory; shortcuts: KeyboardShortcut[] }> = [];
    for (const category of CATEGORY_ORDER) {
      const shortcuts = groups.get(category);
      if (shortcuts && shortcuts.length > 0) {
        sorted.push({ category, shortcuts });
      }
    }

    return sorted;
  }, [filteredShortcuts]);

  // Focus search on open
  useEffect(() => {
    if (isOpen && showSearch && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isOpen, showSearch]);

  // Reset search on close
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Handle Escape key
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

  if (!isOpen) return null;

  return (
    <div
      className="docx-shortcuts-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
      }}
    >
      <div
        ref={dialogRef}
        className={`docx-shortcuts-dialog ${className}`}
        style={{
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        role="dialog"
        aria-label="Keyboard Shortcuts"
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--doc-border)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--doc-text)',
            }}
          >
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: '50%',
              color: 'var(--doc-text-muted)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Search */}
        {showSearch && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--doc-border)' }}>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcuts..."
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid var(--doc-border-light)',
                borderRadius: '6px',
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
          }}
        >
          {groupedShortcuts.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '32px',
                color: 'var(--doc-text-muted)',
              }}
            >
              No shortcuts found matching "{searchQuery}"
            </div>
          ) : (
            groupedShortcuts.map(({ category, shortcuts }) => (
              <div key={category} style={{ marginBottom: '24px' }}>
                <h3
                  style={{
                    margin: '0 0 12px 0',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--doc-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {CATEGORY_LABELS[category]}
                </h3>
                <div>
                  {shortcuts.map((shortcut) => (
                    <ShortcutItem key={shortcut.id} shortcut={shortcut} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--doc-border)',
            backgroundColor: 'var(--doc-bg)',
            fontSize: '12px',
            color: 'var(--doc-text-muted)',
            textAlign: 'center',
          }}
        >
          Press{' '}
          <kbd
            style={{
              padding: '2px 6px',
              backgroundColor: 'white',
              borderRadius: '4px',
              border: '1px solid var(--doc-border-light)',
            }}
          >
            Esc
          </kbd>{' '}
          to close
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// HOOK FOR KEYBOARD SHORTCUTS DIALOG
// ============================================================================

/**
 * Hook to manage keyboard shortcuts dialog
 */
export function useKeyboardShortcutsDialog(
  options: UseKeyboardShortcutsDialogOptions = {}
): UseKeyboardShortcutsDialogReturn {
  const { enabled = true, openShortcut: _openShortcut = 'Ctrl+/' } = options;
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    if (enabled) setIsOpen(true);
  }, [enabled]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const isCtrlOrMeta = event.ctrlKey || event.metaKey;

      // Ctrl+/ or Ctrl+? to open
      if (isCtrlOrMeta && (event.key === '/' || event.key === '?')) {
        event.preventDefault();
        toggle();
        return;
      }

      // F1 to open
      if (event.key === 'F1') {
        event.preventDefault();
        open();
        return;
      }
    },
    [enabled, toggle, open]
  );

  // Set up global keyboard listener
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  return {
    isOpen,
    open,
    close,
    toggle,
    handleKeyDown,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all default shortcuts
 */
export function getDefaultShortcuts(): KeyboardShortcut[] {
  return [...DEFAULT_SHORTCUTS];
}

/**
 * Get shortcuts by category
 */
export function getShortcutsByCategory(category: ShortcutCategory): KeyboardShortcut[] {
  return DEFAULT_SHORTCUTS.filter((s) => s.category === category);
}

/**
 * Get common/frequently used shortcuts
 */
export function getCommonShortcuts(): KeyboardShortcut[] {
  return DEFAULT_SHORTCUTS.filter((s) => s.common);
}

/**
 * Get category label
 */
export function getCategoryLabel(category: ShortcutCategory): string {
  return CATEGORY_LABELS[category];
}

/**
 * Get all categories
 */
export function getAllCategories(): ShortcutCategory[] {
  return [...CATEGORY_ORDER];
}

/**
 * Format shortcut keys for display
 */
export function formatShortcutKeys(keys: string): string {
  return formatKeys(keys);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default KeyboardShortcutsDialog;
