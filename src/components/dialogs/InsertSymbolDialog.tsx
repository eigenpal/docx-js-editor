/**
 * Insert Symbol Dialog Component
 *
 * Modal dialog for inserting special characters and symbols into the document.
 * Provides categorized symbol picker with search functionality.
 *
 * Features:
 * - Categorized symbol groups
 * - Recent symbols
 * - Search functionality
 * - Unicode character display
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Symbol category
 */
export interface SymbolCategory {
  /** Category name */
  name: string;
  /** Display label */
  label: string;
  /** Symbols in this category */
  symbols: string[];
}

/**
 * Props for InsertSymbolDialog
 */
export interface InsertSymbolDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when symbol is inserted */
  onInsert: (symbol: string) => void;
  /** Recently used symbols */
  recentSymbols?: string[];
  /** Additional CSS class */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
}

// ============================================================================
// STYLES
// ============================================================================

const DIALOG_OVERLAY_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
};

const DIALOG_CONTENT_STYLE: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  minWidth: '450px',
  maxWidth: '550px',
  width: '100%',
  margin: '20px',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
};

const DIALOG_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 20px',
  borderBottom: '1px solid #e0e0e0',
};

const DIALOG_TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 600,
  color: '#333',
};

const CLOSE_BUTTON_STYLE: CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '20px',
  cursor: 'pointer',
  color: '#666',
  padding: '4px 8px',
  lineHeight: 1,
};

const DIALOG_BODY_STYLE: CSSProperties = {
  padding: '20px',
  flex: 1,
  overflow: 'auto',
};

const SEARCH_INPUT_STYLE: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '14px',
  marginBottom: '16px',
  boxSizing: 'border-box',
};

const CATEGORY_TABS_STYLE: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
  marginBottom: '16px',
};

const CATEGORY_TAB_STYLE: CSSProperties = {
  padding: '6px 12px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontSize: '12px',
  transition: 'all 0.15s',
};

const CATEGORY_TAB_ACTIVE_STYLE: CSSProperties = {
  ...CATEGORY_TAB_STYLE,
  backgroundColor: '#1a73e8',
  borderColor: '#1a73e8',
  color: '#fff',
};

const SYMBOLS_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(10, 1fr)',
  gap: '4px',
  maxHeight: '250px',
  overflow: 'auto',
};

const SYMBOL_BUTTON_STYLE: CSSProperties = {
  width: '36px',
  height: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #e0e0e0',
  borderRadius: '4px',
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontSize: '18px',
  transition: 'all 0.15s',
};

const SYMBOL_BUTTON_HOVER_STYLE: CSSProperties = {
  ...SYMBOL_BUTTON_STYLE,
  backgroundColor: '#f0f7ff',
  borderColor: '#1a73e8',
};

const PREVIEW_SECTION_STYLE: CSSProperties = {
  marginTop: '16px',
  padding: '12px',
  backgroundColor: '#f5f5f5',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
};

const PREVIEW_SYMBOL_STYLE: CSSProperties = {
  fontSize: '36px',
  width: '60px',
  height: '60px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#fff',
  borderRadius: '4px',
  border: '1px solid #e0e0e0',
};

const PREVIEW_INFO_STYLE: CSSProperties = {
  flex: 1,
};

const SECTION_TITLE_STYLE: CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#666',
  marginBottom: '8px',
  textTransform: 'uppercase',
};

const DIALOG_FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  padding: '16px 20px',
  borderTop: '1px solid #e0e0e0',
};

const BUTTON_BASE_STYLE: CSSProperties = {
  padding: '10px 20px',
  borderRadius: '4px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
};

const PRIMARY_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: '#1a73e8',
  color: '#ffffff',
};

const SECONDARY_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: '#f0f0f0',
  color: '#333',
  border: '1px solid #ccc',
};

const DISABLED_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: '#ccc',
  color: '#666',
  cursor: 'not-allowed',
};

// ============================================================================
// SYMBOL DATA
// ============================================================================

/**
 * Default symbol categories
 */
export const SYMBOL_CATEGORIES: SymbolCategory[] = [
  {
    name: 'common',
    label: 'Common',
    symbols: [
      '©', '®', '™', '•', '…', '—', '–', '°', '±', '×',
      '÷', '≠', '≤', '≥', '∞', '√', '∑', '∏', '∫', 'π',
      '€', '£', '¥', '¢', '§', '¶', '†', '‡', '‰', '№',
    ],
  },
  {
    name: 'arrows',
    label: 'Arrows',
    symbols: [
      '←', '↑', '→', '↓', '↔', '↕', '↖', '↗', '↘', '↙',
      '⇐', '⇑', '⇒', '⇓', '⇔', '⇕', '⟵', '⟶', '⟷', '➔',
      '➜', '➞', '➡', '➢', '➣', '➤', '➥', '➦', '➧', '➨',
    ],
  },
  {
    name: 'math',
    label: 'Math',
    symbols: [
      '+', '−', '×', '÷', '=', '≠', '<', '>', '≤', '≥',
      '±', '∓', '∞', '√', '∛', '∜', '∑', '∏', '∫', '∂',
      '∆', '∇', '∈', '∉', '∋', '∅', '∀', '∃', '∄', '⊂',
      '⊃', '⊆', '⊇', '∪', '∩', '⊕', '⊗', '⊥', '∠', '∟',
    ],
  },
  {
    name: 'greek',
    label: 'Greek',
    symbols: [
      'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ',
      'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ',
      'φ', 'χ', 'ψ', 'ω', 'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ',
      'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ', 'Ν', 'Ξ', 'Ο', 'Π',
    ],
  },
  {
    name: 'shapes',
    label: 'Shapes',
    symbols: [
      '■', '□', '▪', '▫', '▬', '▭', '▮', '▯', '▰', '▱',
      '▲', '△', '▴', '▵', '▶', '▷', '▸', '▹', '►', '▻',
      '▼', '▽', '▾', '▿', '◀', '◁', '◂', '◃', '◄', '◅',
      '●', '○', '◎', '◉', '◌', '◍', '◐', '◑', '◒', '◓',
    ],
  },
  {
    name: 'punctuation',
    label: 'Punctuation',
    symbols: [
      '–', '—', ''', ''', '"', '"', '«', '»', '‹', '›',
      '…', '·', '•', '‣', '⁃', '‐', '‑', '‒', '―', '‖',
      '′', '″', '‴', '⁗', '‵', '‶', '‷', '※', '‽', '⁂',
    ],
  },
  {
    name: 'currency',
    label: 'Currency',
    symbols: [
      '$', '¢', '£', '¤', '¥', '₠', '₡', '₢', '₣', '₤',
      '₥', '₦', '₧', '₨', '₩', '₪', '₫', '€', '₭', '₮',
      '₯', '₰', '₱', '₲', '₳', '₴', '₵', '₶', '₷', '₸',
    ],
  },
  {
    name: 'music',
    label: 'Music',
    symbols: [
      '♩', '♪', '♫', '♬', '♭', '♮', '♯', '𝄞', '𝄢', '𝄪',
      '𝄫', '𝅗𝅥', '𝅘𝅥', '𝅘𝅥𝅮', '𝅘𝅥𝅯', '𝅘𝅥𝅰', '𝆒', '𝆓', '𝄐', '𝄑',
    ],
  },
  {
    name: 'emoji',
    label: 'Emoji',
    symbols: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺', '😚',
      '❤', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣',
      '👍', '👎', '👌', '✌', '🤞', '🤟', '🤘', '👋', '🙏', '✅',
    ],
  },
];

/**
 * Get all symbols flattened
 */
function getAllSymbols(): string[] {
  return SYMBOL_CATEGORIES.flatMap((cat) => cat.symbols);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * InsertSymbolDialog - Modal for inserting special characters
 */
export function InsertSymbolDialog({
  isOpen,
  onClose,
  onInsert,
  recentSymbols = [],
  className,
  style,
}: InsertSymbolDialogProps): React.ReactElement | null {
  // State
  const [selectedCategory, setSelectedCategory] = useState('common');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedSymbol(null);
      setSearchQuery('');
      setHoveredSymbol(null);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Filter symbols based on search
  const filteredSymbols = useMemo(() => {
    if (!searchQuery.trim()) {
      if (selectedCategory === 'recent') {
        return recentSymbols;
      }
      const category = SYMBOL_CATEGORIES.find((c) => c.name === selectedCategory);
      return category?.symbols || [];
    }

    const query = searchQuery.toLowerCase();
    const allSymbols = getAllSymbols();

    // Search by character or Unicode code point
    return allSymbols.filter((symbol) => {
      const codePoint = symbol.codePointAt(0)?.toString(16).toUpperCase() || '';
      return (
        symbol.includes(query) ||
        codePoint.includes(query.toUpperCase()) ||
        `U+${codePoint}`.toLowerCase().includes(query)
      );
    });
  }, [searchQuery, selectedCategory, recentSymbols]);

  /**
   * Handle symbol click
   */
  const handleSymbolClick = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
  }, []);

  /**
   * Handle symbol double-click (insert immediately)
   */
  const handleSymbolDoubleClick = useCallback(
    (symbol: string) => {
      onInsert(symbol);
    },
    [onInsert]
  );

  /**
   * Handle insert
   */
  const handleInsert = useCallback(() => {
    if (selectedSymbol) {
      onInsert(selectedSymbol);
    }
  }, [selectedSymbol, onInsert]);

  /**
   * Handle keyboard events
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && selectedSymbol) {
        e.preventDefault();
        handleInsert();
      }
    },
    [onClose, selectedSymbol, handleInsert]
  );

  /**
   * Handle overlay click
   */
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  /**
   * Get symbol info
   */
  const getSymbolInfo = (symbol: string | null) => {
    if (!symbol) return null;
    const codePoint = symbol.codePointAt(0);
    return {
      character: symbol,
      codePoint: codePoint ? `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}` : '',
      decimal: codePoint || 0,
    };
  };

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  const displaySymbol = hoveredSymbol || selectedSymbol;
  const symbolInfo = getSymbolInfo(displaySymbol);
  const canInsert = selectedSymbol !== null;

  // Categories including recent
  const categories = [
    ...(recentSymbols.length > 0 ? [{ name: 'recent', label: 'Recent' }] : []),
    ...SYMBOL_CATEGORIES.map((c) => ({ name: c.name, label: c.label })),
  ];

  return (
    <div
      className={`docx-insert-symbol-dialog-overlay ${className || ''}`}
      style={{ ...DIALOG_OVERLAY_STYLE, ...style }}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="insert-symbol-dialog-title"
    >
      <div className="docx-insert-symbol-dialog" style={DIALOG_CONTENT_STYLE}>
        {/* Header */}
        <div className="docx-insert-symbol-dialog-header" style={DIALOG_HEADER_STYLE}>
          <h2 id="insert-symbol-dialog-title" style={DIALOG_TITLE_STYLE}>
            Insert Symbol
          </h2>
          <button
            type="button"
            className="docx-insert-symbol-dialog-close"
            style={CLOSE_BUTTON_STYLE}
            onClick={onClose}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="docx-insert-symbol-dialog-body" style={DIALOG_BODY_STYLE}>
          {/* Search */}
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search symbols (character or Unicode)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={SEARCH_INPUT_STYLE}
          />

          {/* Category tabs */}
          {!searchQuery && (
            <div className="docx-insert-symbol-categories" style={CATEGORY_TABS_STYLE}>
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  style={
                    selectedCategory === cat.name
                      ? CATEGORY_TAB_ACTIVE_STYLE
                      : CATEGORY_TAB_STYLE
                  }
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* Symbols grid */}
          <div className="docx-insert-symbol-grid" style={SYMBOLS_GRID_STYLE}>
            {filteredSymbols.map((symbol, index) => (
              <button
                key={`${symbol}-${index}`}
                type="button"
                onClick={() => handleSymbolClick(symbol)}
                onDoubleClick={() => handleSymbolDoubleClick(symbol)}
                onMouseEnter={() => setHoveredSymbol(symbol)}
                onMouseLeave={() => setHoveredSymbol(null)}
                style={{
                  ...SYMBOL_BUTTON_STYLE,
                  ...(selectedSymbol === symbol ? { backgroundColor: '#e3f2fd', borderColor: '#1a73e8' } : {}),
                }}
                title={`${symbol} - U+${symbol.codePointAt(0)?.toString(16).toUpperCase()}`}
              >
                {symbol}
              </button>
            ))}
          </div>

          {/* No results */}
          {filteredSymbols.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
              No symbols found for "{searchQuery}"
            </div>
          )}

          {/* Preview */}
          {symbolInfo && (
            <div className="docx-insert-symbol-preview" style={PREVIEW_SECTION_STYLE}>
              <div style={PREVIEW_SYMBOL_STYLE}>{symbolInfo.character}</div>
              <div style={PREVIEW_INFO_STYLE}>
                <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                  {symbolInfo.codePoint}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  Decimal: {symbolInfo.decimal}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="docx-insert-symbol-dialog-footer" style={DIALOG_FOOTER_STYLE}>
          <button
            type="button"
            className="docx-insert-symbol-dialog-cancel"
            style={SECONDARY_BUTTON_STYLE}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="docx-insert-symbol-dialog-insert"
            style={canInsert ? PRIMARY_BUTTON_STYLE : DISABLED_BUTTON_STYLE}
            onClick={handleInsert}
            disabled={!canInsert}
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for managing Insert Symbol dialog state with recent symbols
 */
export function useInsertSymbolDialog(maxRecent = 20): {
  isOpen: boolean;
  recentSymbols: string[];
  open: () => void;
  close: () => void;
  toggle: () => void;
  addRecent: (symbol: string) => void;
} {
  const [isOpen, setIsOpen] = useState(false);
  const [recentSymbols, setRecentSymbols] = useState<string[]>([]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const addRecent = useCallback(
    (symbol: string) => {
      setRecentSymbols((prev) => {
        // Remove if already exists, then add to front
        const filtered = prev.filter((s) => s !== symbol);
        return [symbol, ...filtered].slice(0, maxRecent);
      });
    },
    [maxRecent]
  );

  return { isOpen, recentSymbols, open, close, toggle, addRecent };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all symbol categories
 */
export function getSymbolCategories(): SymbolCategory[] {
  return SYMBOL_CATEGORIES;
}

/**
 * Get symbols by category name
 */
export function getSymbolsByCategory(categoryName: string): string[] {
  const category = SYMBOL_CATEGORIES.find((c) => c.name === categoryName);
  return category?.symbols || [];
}

/**
 * Get symbol Unicode info
 */
export function getSymbolInfo(symbol: string): {
  character: string;
  codePoint: string;
  decimal: number;
  hex: string;
} {
  const code = symbol.codePointAt(0) || 0;
  return {
    character: symbol,
    codePoint: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
    decimal: code,
    hex: code.toString(16).toUpperCase(),
  };
}

/**
 * Search symbols by query
 */
export function searchSymbols(query: string): string[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  return getAllSymbols().filter((symbol) => {
    const code = symbol.codePointAt(0)?.toString(16).toUpperCase() || '';
    return (
      symbol.includes(query) ||
      code.includes(lowerQuery.toUpperCase()) ||
      `U+${code}`.toLowerCase().includes(lowerQuery)
    );
  });
}

/**
 * Get symbol from Unicode code point string
 */
export function symbolFromCodePoint(codePointStr: string): string | null {
  // Handle formats: "U+0041", "0041", "41"
  const cleaned = codePointStr.replace(/^U\+/i, '').replace(/^0x/i, '');
  const code = parseInt(cleaned, 16);

  if (isNaN(code) || code < 0 || code > 0x10ffff) {
    return null;
  }

  return String.fromCodePoint(code);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default InsertSymbolDialog;
