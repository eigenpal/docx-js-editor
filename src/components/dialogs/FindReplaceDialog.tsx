/**
 * Find and Replace Dialog Component
 *
 * Modal dialog for searching and replacing text in the document.
 * Supports find, find next/previous, replace, and replace all operations.
 *
 * Features:
 * - Find input with next/previous navigation
 * - Replace input with replace/replace all
 * - Match case option
 * - Match whole word option
 * - Keyboard shortcuts (Ctrl+F, Ctrl+H, Enter, Escape)
 * - Match count display
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { CSSProperties, KeyboardEvent, ChangeEvent } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A single match result in the document
 */
export interface FindMatch {
  /** Index of the paragraph containing the match */
  paragraphIndex: number;
  /** Index of the run/content within the paragraph */
  contentIndex: number;
  /** Character offset within the content */
  startOffset: number;
  /** Character offset for end of match */
  endOffset: number;
  /** The matched text */
  text: string;
}

/**
 * Find options for controlling search behavior
 */
export interface FindOptions {
  /** Whether to match case */
  matchCase: boolean;
  /** Whether to match whole words only */
  matchWholeWord: boolean;
  /** Whether to use regular expressions (future) */
  useRegex?: boolean;
}

/**
 * Find result with all matches
 */
export interface FindResult {
  /** All matches found */
  matches: FindMatch[];
  /** Total match count */
  totalCount: number;
  /** Current match index (0-based) */
  currentIndex: number;
}

/**
 * Props for the FindReplaceDialog component
 */
export interface FindReplaceDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when searching for text */
  onFind: (searchText: string, options: FindOptions) => FindResult | null;
  /** Callback when navigating to next match */
  onFindNext: () => FindMatch | null;
  /** Callback when navigating to previous match */
  onFindPrevious: () => FindMatch | null;
  /** Callback when replacing current match */
  onReplace: (replaceText: string) => boolean;
  /** Callback when replacing all matches */
  onReplaceAll: (searchText: string, replaceText: string, options: FindOptions) => number;
  /** Callback to highlight matches in document */
  onHighlightMatches?: (matches: FindMatch[]) => void;
  /** Callback to clear highlights */
  onClearHighlights?: () => void;
  /** Initial search text (e.g., from selected text) */
  initialSearchText?: string;
  /** Whether to start in replace mode */
  replaceMode?: boolean;
  /** Current match result (from external state) */
  currentResult?: FindResult | null;
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
  backgroundColor: 'transparent',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'flex-end',
  zIndex: 10000,
  pointerEvents: 'none',
};

const DIALOG_CONTENT_STYLE: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '4px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
  minWidth: '360px',
  maxWidth: '440px',
  width: '100%',
  margin: '60px 20px 20px 20px',
  pointerEvents: 'auto',
};

const DIALOG_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  borderBottom: '1px solid #e0e0e0',
  backgroundColor: '#f5f5f5',
  borderTopLeftRadius: '4px',
  borderTopRightRadius: '4px',
};

const DIALOG_TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: '14px',
  fontWeight: 600,
  color: '#333',
};

const CLOSE_BUTTON_STYLE: CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '18px',
  cursor: 'pointer',
  color: '#666',
  padding: '2px 6px',
  lineHeight: 1,
};

const DIALOG_BODY_STYLE: CSSProperties = {
  padding: '16px',
};

const ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '12px',
};

const LABEL_STYLE: CSSProperties = {
  width: '60px',
  fontSize: '13px',
  color: '#333',
  flexShrink: 0,
};

const INPUT_STYLE: CSSProperties = {
  flex: 1,
  padding: '8px 10px',
  border: '1px solid #ccc',
  borderRadius: '3px',
  fontSize: '13px',
  boxSizing: 'border-box',
  outline: 'none',
};

const INPUT_FOCUS_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  borderColor: '#0563C1',
  boxShadow: '0 0 0 2px rgba(5, 99, 193, 0.1)',
};

const BUTTON_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  marginLeft: '8px',
};

const BUTTON_BASE_STYLE: CSSProperties = {
  padding: '6px 12px',
  borderRadius: '3px',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  border: '1px solid #ccc',
  backgroundColor: '#f8f8f8',
  color: '#333',
  minWidth: '80px',
  textAlign: 'center',
};

const BUTTON_HOVER_STYLE: CSSProperties = {
  backgroundColor: '#e8e8e8',
};

const BUTTON_DISABLED_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: '#f0f0f0',
  color: '#999',
  cursor: 'not-allowed',
};

const NAV_BUTTON_STYLE: CSSProperties = {
  padding: '6px 10px',
  borderRadius: '3px',
  fontSize: '14px',
  cursor: 'pointer',
  border: '1px solid #ccc',
  backgroundColor: '#f8f8f8',
  color: '#333',
};

const NAV_BUTTON_DISABLED_STYLE: CSSProperties = {
  ...NAV_BUTTON_STYLE,
  color: '#ccc',
  cursor: 'not-allowed',
};

const OPTIONS_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  gap: '16px',
  marginTop: '4px',
  marginLeft: '68px',
};

const CHECKBOX_LABEL_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '12px',
  color: '#555',
  cursor: 'pointer',
};

const CHECKBOX_STYLE: CSSProperties = {
  width: '14px',
  height: '14px',
  cursor: 'pointer',
};

const STATUS_STYLE: CSSProperties = {
  marginLeft: '68px',
  fontSize: '12px',
  color: '#666',
  marginBottom: '8px',
};

const NO_RESULTS_STYLE: CSSProperties = {
  ...STATUS_STYLE,
  color: '#c00',
};

// ============================================================================
// ICONS
// ============================================================================

const ChevronUpIcon: React.FC<{ style?: CSSProperties }> = ({ style }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const ChevronDownIcon: React.FC<{ style?: CSSProperties }> = ({ style }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * FindReplaceDialog component - Modal for finding and replacing text
 */
export function FindReplaceDialog({
  isOpen,
  onClose,
  onFind,
  onFindNext,
  onFindPrevious,
  onReplace,
  onReplaceAll,
  onHighlightMatches,
  onClearHighlights,
  initialSearchText = '',
  replaceMode = false,
  currentResult,
  className,
  style,
}: FindReplaceDialogProps): React.ReactElement | null {
  // State
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showReplace, setShowReplace] = useState(replaceMode);
  const [matchCase, setMatchCase] = useState(false);
  const [matchWholeWord, setMatchWholeWord] = useState(false);
  const [result, setResult] = useState<FindResult | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [replaceFocused, setReplaceFocused] = useState(false);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Sync with external result if provided
  useEffect(() => {
    if (currentResult !== undefined) {
      setResult(currentResult);
    }
  }, [currentResult]);

  // Initialize when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSearchText(initialSearchText);
      setReplaceText('');
      setShowReplace(replaceMode);
      setResult(null);

      // Focus search input
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 100);

      // If we have initial text, search for it
      if (initialSearchText) {
        const searchResult = onFind(initialSearchText, { matchCase, matchWholeWord });
        setResult(searchResult);
        if (searchResult?.matches && onHighlightMatches) {
          onHighlightMatches(searchResult.matches);
        }
      }
    } else {
      // Clear highlights when closing
      if (onClearHighlights) {
        onClearHighlights();
      }
    }
  }, [isOpen, initialSearchText, replaceMode]);

  /**
   * Perform search
   */
  const performSearch = useCallback(() => {
    if (!searchText.trim()) {
      setResult(null);
      if (onClearHighlights) {
        onClearHighlights();
      }
      return;
    }

    const searchResult = onFind(searchText, { matchCase, matchWholeWord });
    setResult(searchResult);

    if (searchResult?.matches && onHighlightMatches) {
      onHighlightMatches(searchResult.matches);
    } else if (onClearHighlights) {
      onClearHighlights();
    }
  }, [searchText, matchCase, matchWholeWord, onFind, onHighlightMatches, onClearHighlights]);

  // Search when options change
  useEffect(() => {
    if (isOpen && searchText.trim()) {
      performSearch();
    }
  }, [matchCase, matchWholeWord]);

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  }, []);

  /**
   * Handle search on Enter or input change with debounce
   */
  const handleSearchKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          handleFindPrevious();
        } else {
          if (!result) {
            performSearch();
          } else {
            handleFindNext();
          }
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [result, performSearch, onClose]
  );

  /**
   * Handle replace input key down
   */
  const handleReplaceKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleReplace();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  /**
   * Handle Find Next
   */
  const handleFindNext = useCallback(() => {
    if (!searchText.trim()) {
      performSearch();
      return;
    }

    // If no current result, search first
    if (!result) {
      performSearch();
      return;
    }

    const match = onFindNext();
    if (match && result) {
      const newIndex = (result.currentIndex + 1) % result.totalCount;
      setResult({
        ...result,
        currentIndex: newIndex,
      });
    }
  }, [searchText, result, performSearch, onFindNext]);

  /**
   * Handle Find Previous
   */
  const handleFindPrevious = useCallback(() => {
    if (!searchText.trim()) {
      performSearch();
      return;
    }

    // If no current result, search first
    if (!result) {
      performSearch();
      return;
    }

    const match = onFindPrevious();
    if (match && result) {
      const newIndex = result.currentIndex === 0 ? result.totalCount - 1 : result.currentIndex - 1;
      setResult({
        ...result,
        currentIndex: newIndex,
      });
    }
  }, [searchText, result, performSearch, onFindPrevious]);

  /**
   * Handle Replace
   */
  const handleReplace = useCallback(() => {
    if (!result || result.totalCount === 0) return;

    const success = onReplace(replaceText);
    if (success) {
      // Re-search after replacement
      const newResult = onFind(searchText, { matchCase, matchWholeWord });
      setResult(newResult);
      if (newResult?.matches && onHighlightMatches) {
        onHighlightMatches(newResult.matches);
      }
    }
  }, [result, replaceText, searchText, matchCase, matchWholeWord, onReplace, onFind, onHighlightMatches]);

  /**
   * Handle Replace All
   */
  const handleReplaceAll = useCallback(() => {
    if (!searchText.trim()) return;

    const count = onReplaceAll(searchText, replaceText, { matchCase, matchWholeWord });
    if (count > 0) {
      // Clear result after replace all
      setResult({
        matches: [],
        totalCount: 0,
        currentIndex: -1,
      });
      if (onClearHighlights) {
        onClearHighlights();
      }
    }
  }, [searchText, replaceText, matchCase, matchWholeWord, onReplaceAll, onClearHighlights]);

  /**
   * Toggle replace mode
   */
  const toggleReplaceMode = useCallback(() => {
    setShowReplace((prev) => {
      const newValue = !prev;
      if (newValue) {
        setTimeout(() => replaceInputRef.current?.focus(), 100);
      }
      return newValue;
    });
  }, []);

  /**
   * Handle overlay click
   */
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        // Don't close on overlay click - this is a non-modal dialog
      }
    },
    []
  );

  /**
   * Handle global key events
   */
  const handleDialogKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  const hasMatches = result && result.totalCount > 0;
  const noMatches = result && result.totalCount === 0 && searchText.trim();

  return (
    <div
      className={`docx-find-replace-dialog-overlay ${className || ''}`}
      style={{ ...DIALOG_OVERLAY_STYLE, ...style }}
      onClick={handleOverlayClick}
      onKeyDown={handleDialogKeyDown}
    >
      <div
        className="docx-find-replace-dialog"
        style={DIALOG_CONTENT_STYLE}
        role="dialog"
        aria-modal="false"
        aria-labelledby="find-replace-dialog-title"
      >
        {/* Header */}
        <div className="docx-find-replace-dialog-header" style={DIALOG_HEADER_STYLE}>
          <h2 id="find-replace-dialog-title" style={DIALOG_TITLE_STYLE}>
            {showReplace ? 'Find and Replace' : 'Find'}
          </h2>
          <button
            type="button"
            className="docx-find-replace-dialog-close"
            style={CLOSE_BUTTON_STYLE}
            onClick={onClose}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="docx-find-replace-dialog-body" style={DIALOG_BODY_STYLE}>
          {/* Find row */}
          <div className="docx-find-replace-dialog-row" style={ROW_STYLE}>
            <label htmlFor="find-text" style={LABEL_STYLE}>
              Find:
            </label>
            <input
              ref={searchInputRef}
              id="find-text"
              type="text"
              className="docx-find-replace-dialog-input"
              style={searchFocused ? INPUT_FOCUS_STYLE : INPUT_STYLE}
              value={searchText}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => {
                setSearchFocused(false);
                if (searchText.trim() && !result) {
                  performSearch();
                }
              }}
              placeholder="Enter text to find..."
              aria-label="Find text"
            />
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className="docx-find-replace-dialog-nav"
                style={hasMatches ? NAV_BUTTON_STYLE : NAV_BUTTON_DISABLED_STYLE}
                onClick={handleFindPrevious}
                disabled={!hasMatches}
                aria-label="Find previous"
                title="Find Previous (Shift+Enter)"
              >
                <ChevronUpIcon />
              </button>
              <button
                type="button"
                className="docx-find-replace-dialog-nav"
                style={hasMatches ? NAV_BUTTON_STYLE : NAV_BUTTON_DISABLED_STYLE}
                onClick={handleFindNext}
                disabled={!hasMatches}
                aria-label="Find next"
                title="Find Next (Enter)"
              >
                <ChevronDownIcon />
              </button>
            </div>
          </div>

          {/* Status line */}
          {hasMatches && (
            <div className="docx-find-replace-dialog-status" style={STATUS_STYLE}>
              {result.currentIndex + 1} of {result.totalCount} matches
            </div>
          )}
          {noMatches && (
            <div className="docx-find-replace-dialog-status" style={NO_RESULTS_STYLE}>
              No results found
            </div>
          )}

          {/* Replace row (togglable) */}
          {showReplace && (
            <>
              <div className="docx-find-replace-dialog-row" style={ROW_STYLE}>
                <label htmlFor="replace-text" style={LABEL_STYLE}>
                  Replace:
                </label>
                <input
                  ref={replaceInputRef}
                  id="replace-text"
                  type="text"
                  className="docx-find-replace-dialog-input"
                  style={replaceFocused ? INPUT_FOCUS_STYLE : INPUT_STYLE}
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  onKeyDown={handleReplaceKeyDown}
                  onFocus={() => setReplaceFocused(true)}
                  onBlur={() => setReplaceFocused(false)}
                  placeholder="Enter replacement text..."
                  aria-label="Replace text"
                />
                <div style={BUTTON_CONTAINER_STYLE}>
                  <button
                    type="button"
                    className="docx-find-replace-dialog-button"
                    style={hasMatches ? BUTTON_BASE_STYLE : BUTTON_DISABLED_STYLE}
                    onClick={handleReplace}
                    disabled={!hasMatches}
                    title="Replace current match"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    className="docx-find-replace-dialog-button"
                    style={hasMatches ? BUTTON_BASE_STYLE : BUTTON_DISABLED_STYLE}
                    onClick={handleReplaceAll}
                    disabled={!hasMatches}
                    title="Replace all matches"
                  >
                    Replace All
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Options */}
          <div className="docx-find-replace-dialog-options" style={OPTIONS_CONTAINER_STYLE}>
            <label className="docx-find-replace-dialog-option" style={CHECKBOX_LABEL_STYLE}>
              <input
                type="checkbox"
                style={CHECKBOX_STYLE}
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
              />
              Match case
            </label>
            <label className="docx-find-replace-dialog-option" style={CHECKBOX_LABEL_STYLE}>
              <input
                type="checkbox"
                style={CHECKBOX_STYLE}
                checked={matchWholeWord}
                onChange={(e) => setMatchWholeWord(e.target.checked)}
              />
              Whole words
            </label>
            {!showReplace && (
              <button
                type="button"
                style={{
                  ...CHECKBOX_LABEL_STYLE,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#0563C1',
                  padding: 0,
                }}
                onClick={toggleReplaceMode}
              >
                + Replace
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create default find options
 */
export function createDefaultFindOptions(): FindOptions {
  return {
    matchCase: false,
    matchWholeWord: false,
    useRegex: false,
  };
}

/**
 * Find all matches of search text in content
 * @param content - The text to search in
 * @param searchText - The text to find
 * @param options - Find options
 * @returns Array of match indices [startIndex, endIndex]
 */
export function findAllMatches(
  content: string,
  searchText: string,
  options: FindOptions
): Array<{ start: number; end: number }> {
  if (!content || !searchText) {
    return [];
  }

  const matches: Array<{ start: number; end: number }> = [];

  // Prepare search string
  let searchContent = content;
  let searchFor = searchText;

  if (!options.matchCase) {
    searchContent = content.toLowerCase();
    searchFor = searchText.toLowerCase();
  }

  // Escape regex special characters if not using regex
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Build pattern
  let pattern: string;
  if (options.matchWholeWord) {
    pattern = `\\b${escapeRegex(searchFor)}\\b`;
  } else {
    pattern = escapeRegex(searchFor);
  }

  const flags = options.matchCase ? 'g' : 'gi';
  const regex = new RegExp(pattern, flags);

  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
    });
    // Prevent infinite loop for zero-width matches
    if (match[0].length === 0) {
      regex.lastIndex++;
    }
  }

  return matches;
}

/**
 * Escape string for use in regex pattern
 */
export function escapeRegexString(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a regex pattern from search text and options
 */
export function createSearchPattern(searchText: string, options: FindOptions): RegExp | null {
  if (!searchText) return null;

  try {
    let pattern: string;

    if (options.useRegex) {
      pattern = searchText;
    } else {
      pattern = escapeRegexString(searchText);
    }

    if (options.matchWholeWord) {
      pattern = `\\b${pattern}\\b`;
    }

    const flags = options.matchCase ? 'g' : 'gi';
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

/**
 * Replace text in content
 * @param content - Original content
 * @param searchText - Text to find
 * @param replaceText - Text to replace with
 * @param options - Find options
 * @returns New content with replacements
 */
export function replaceAllInContent(
  content: string,
  searchText: string,
  replaceText: string,
  options: FindOptions
): string {
  const pattern = createSearchPattern(searchText, options);
  if (!pattern) return content;

  return content.replace(pattern, replaceText);
}

/**
 * Replace first match in content
 * @param content - Original content
 * @param searchText - Text to find
 * @param replaceText - Text to replace with
 * @param options - Find options
 * @param startIndex - Index to start searching from
 * @returns New content with replacement, or original if no match
 */
export function replaceFirstInContent(
  content: string,
  searchText: string,
  replaceText: string,
  options: FindOptions,
  startIndex: number = 0
): { content: string; replaced: boolean; matchStart: number; matchEnd: number } {
  const matches = findAllMatches(content, searchText, options);

  // Find match at or after startIndex
  const match = matches.find((m) => m.start >= startIndex) || matches[0];

  if (!match) {
    return { content, replaced: false, matchStart: -1, matchEnd: -1 };
  }

  const newContent =
    content.substring(0, match.start) +
    replaceText +
    content.substring(match.end);

  return {
    content: newContent,
    replaced: true,
    matchStart: match.start,
    matchEnd: match.start + replaceText.length,
  };
}

/**
 * Get match count for status display
 */
export function getMatchCountText(result: FindResult | null): string {
  if (!result) return '';
  if (result.totalCount === 0) return 'No results';
  if (result.totalCount === 1) return '1 match';
  return `${result.currentIndex + 1} of ${result.totalCount} matches`;
}

/**
 * Check if search text is empty or whitespace-only
 */
export function isEmptySearch(searchText: string): boolean {
  return !searchText || searchText.trim() === '';
}

/**
 * Highlight options for document rendering
 */
export interface HighlightOptions {
  /** Background color for current match */
  currentMatchColor: string;
  /** Background color for other matches */
  otherMatchColor: string;
}

/**
 * Get default highlight options
 */
export function getDefaultHighlightOptions(): HighlightOptions {
  return {
    currentMatchColor: '#FFFF00', // Bright yellow for current
    otherMatchColor: '#FFFFAA', // Light yellow for others
  };
}

// ============================================================================
// HOOK: useFindReplace
// ============================================================================

/**
 * Options for the useFindReplace hook
 */
export interface FindReplaceOptions {
  /** Whether to show replace functionality initially */
  initialReplaceMode?: boolean;
  /** Callback when matches change */
  onMatchesChange?: (matches: FindMatch[]) => void;
  /** Callback when current match changes */
  onCurrentMatchChange?: (match: FindMatch | null, index: number) => void;
}

/**
 * State for the find/replace hook
 */
export interface FindReplaceState {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Current search text */
  searchText: string;
  /** Current replace text */
  replaceText: string;
  /** Find options */
  options: FindOptions;
  /** All matches found */
  matches: FindMatch[];
  /** Current match index */
  currentIndex: number;
  /** Whether in replace mode */
  replaceMode: boolean;
}

/**
 * Return type for the useFindReplace hook
 */
export interface UseFindReplaceReturn {
  /** Current state */
  state: FindReplaceState;
  /** Open the find dialog */
  openFind: (selectedText?: string) => void;
  /** Open the replace dialog */
  openReplace: (selectedText?: string) => void;
  /** Close the dialog */
  close: () => void;
  /** Toggle dialog visibility */
  toggle: () => void;
  /** Update search text */
  setSearchText: (text: string) => void;
  /** Update replace text */
  setReplaceText: (text: string) => void;
  /** Update find options */
  setOptions: (options: Partial<FindOptions>) => void;
  /** Set search results */
  setMatches: (matches: FindMatch[], currentIndex?: number) => void;
  /** Go to next match */
  goToNextMatch: () => number;
  /** Go to previous match */
  goToPreviousMatch: () => number;
  /** Go to a specific match by index */
  goToMatch: (index: number) => void;
  /** Get current match */
  getCurrentMatch: () => FindMatch | null;
  /** Check if has matches */
  hasMatches: () => boolean;
}

/**
 * Hook for managing find/replace dialog state
 */
export function useFindReplace(hookOptions?: FindReplaceOptions): UseFindReplaceReturn {
  const [state, setState] = useState<FindReplaceState>({
    isOpen: false,
    searchText: '',
    replaceText: '',
    options: createDefaultFindOptions(),
    matches: [],
    currentIndex: 0,
    replaceMode: hookOptions?.initialReplaceMode ?? false,
  });

  const openFind = useCallback((selectedText?: string) => {
    setState((prev) => ({
      ...prev,
      isOpen: true,
      replaceMode: false,
      searchText: selectedText || prev.searchText,
      matches: [],
      currentIndex: 0,
    }));
  }, []);

  const openReplace = useCallback((selectedText?: string) => {
    setState((prev) => ({
      ...prev,
      isOpen: true,
      replaceMode: true,
      searchText: selectedText || prev.searchText,
      matches: [],
      currentIndex: 0,
    }));
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const toggle = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: !prev.isOpen,
    }));
  }, []);

  const setSearchText = useCallback((text: string) => {
    setState((prev) => ({
      ...prev,
      searchText: text,
    }));
  }, []);

  const setReplaceText = useCallback((text: string) => {
    setState((prev) => ({
      ...prev,
      replaceText: text,
    }));
  }, []);

  const setOptions = useCallback((options: Partial<FindOptions>) => {
    setState((prev) => ({
      ...prev,
      options: { ...prev.options, ...options },
    }));
  }, []);

  const setMatches = useCallback(
    (matches: FindMatch[], currentIndex: number = 0) => {
      const newIndex = Math.max(0, Math.min(currentIndex, matches.length - 1));
      setState((prev) => ({
        ...prev,
        matches,
        currentIndex: matches.length > 0 ? newIndex : 0,
      }));
      hookOptions?.onMatchesChange?.(matches);
      if (matches.length > 0) {
        hookOptions?.onCurrentMatchChange?.(matches[newIndex], newIndex);
      } else {
        hookOptions?.onCurrentMatchChange?.(null, -1);
      }
    },
    [hookOptions]
  );

  const goToNextMatch = useCallback(() => {
    let newIndex = 0;
    setState((prev) => {
      if (prev.matches.length === 0) return prev;
      newIndex = (prev.currentIndex + 1) % prev.matches.length;
      return { ...prev, currentIndex: newIndex };
    });
    return newIndex;
  }, []);

  const goToPreviousMatch = useCallback(() => {
    let newIndex = 0;
    setState((prev) => {
      if (prev.matches.length === 0) return prev;
      newIndex = prev.currentIndex === 0 ? prev.matches.length - 1 : prev.currentIndex - 1;
      return { ...prev, currentIndex: newIndex };
    });
    return newIndex;
  }, []);

  const goToMatch = useCallback((index: number) => {
    setState((prev) => {
      if (prev.matches.length === 0 || index < 0 || index >= prev.matches.length) {
        return prev;
      }
      return { ...prev, currentIndex: index };
    });
  }, []);

  const getCurrentMatch = useCallback((): FindMatch | null => {
    if (state.matches.length === 0) return null;
    return state.matches[state.currentIndex] || null;
  }, [state.matches, state.currentIndex]);

  const hasMatches = useCallback(() => state.matches.length > 0, [state.matches.length]);

  return {
    state,
    openFind,
    openReplace,
    close,
    toggle,
    setSearchText,
    setReplaceText,
    setOptions,
    setMatches,
    goToNextMatch,
    goToPreviousMatch,
    goToMatch,
    getCurrentMatch,
    hasMatches,
  };
}

// ============================================================================
// DOCUMENT SEARCH UTILITIES
// ============================================================================

/**
 * Get plain text from a run
 */
function getRunText(run: any): string {
  if (!run || !run.content) return '';
  let text = '';
  for (const item of run.content) {
    if (item.type === 'text') {
      text += item.text || '';
    } else if (item.type === 'tab') {
      text += '\t';
    } else if (item.type === 'break' && item.breakType === 'textWrapping') {
      text += '\n';
    }
  }
  return text;
}

/**
 * Get plain text from a paragraph
 */
function getParagraphPlainText(paragraph: any): string {
  if (!paragraph || !paragraph.content) return '';
  let text = '';
  for (const item of paragraph.content) {
    if (item.type === 'run') {
      text += getRunText(item);
    } else if (item.type === 'hyperlink') {
      for (const child of item.children || []) {
        if (child.type === 'run') {
          text += getRunText(child);
        }
      }
    }
  }
  return text;
}

/**
 * Find all matches in a document
 */
export function findInDocument(
  document: any,
  searchText: string,
  options: FindOptions
): FindMatch[] {
  if (!document || !searchText) return [];

  const matches: FindMatch[] = [];
  const body = document.package?.document || document.package?.body;
  if (!body || !body.content) return matches;

  // Iterate through paragraphs
  let paragraphIndex = 0;
  for (const block of body.content) {
    if (block.type === 'paragraph') {
      const paragraphMatches = findInParagraph(block, searchText, options, paragraphIndex);
      matches.push(...paragraphMatches);
      paragraphIndex++;
    } else if (block.type === 'table') {
      // Search in table cells
      for (const row of block.rows || []) {
        for (const cell of row.cells || []) {
          for (const cellContent of cell.content || []) {
            if (cellContent.type === 'paragraph') {
              // Note: table paragraphs are tracked separately in the document model
              // For now, we skip table content in the simple search
              // A more complete implementation would track table cell positions
            }
          }
        }
      }
    }
  }

  return matches;
}

/**
 * Find matches in a single paragraph
 */
export function findInParagraph(
  paragraph: any,
  searchText: string,
  options: FindOptions,
  paragraphIndex: number
): FindMatch[] {
  const matches: FindMatch[] = [];
  const paragraphText = getParagraphPlainText(paragraph);

  if (!paragraphText) return matches;

  // Find all text matches
  const textMatches = findAllMatches(paragraphText, searchText, options);

  // Map each match back to the run/content structure
  for (const match of textMatches) {
    // For now, we'll use a simplified approach: store the paragraph index and offsets
    // A more complex implementation would track exact run and content indices
    const contentInfo = findContentAtOffset(paragraph, match.start);

    matches.push({
      paragraphIndex,
      contentIndex: contentInfo.contentIndex,
      startOffset: contentInfo.offsetInContent,
      endOffset: contentInfo.offsetInContent + (match.end - match.start),
      text: paragraphText.substring(match.start, match.end),
    });
  }

  return matches;
}

/**
 * Find the content (run) at a specific character offset in a paragraph
 */
function findContentAtOffset(
  paragraph: any,
  offset: number
): { contentIndex: number; runIndex: number; offsetInContent: number } {
  if (!paragraph || !paragraph.content) {
    return { contentIndex: 0, runIndex: 0, offsetInContent: offset };
  }

  let currentOffset = 0;
  let contentIndex = 0;

  for (const item of paragraph.content) {
    let itemText = '';

    if (item.type === 'run') {
      itemText = getRunText(item);
    } else if (item.type === 'hyperlink') {
      for (const child of item.children || []) {
        if (child.type === 'run') {
          itemText += getRunText(child);
        }
      }
    }

    const itemLength = itemText.length;

    if (currentOffset + itemLength > offset) {
      // The offset is within this content
      return {
        contentIndex,
        runIndex: contentIndex, // Simplified: same as contentIndex
        offsetInContent: offset - currentOffset,
      };
    }

    currentOffset += itemLength;
    contentIndex++;
  }

  // Offset is past the end, return last position
  return {
    contentIndex: Math.max(0, paragraph.content.length - 1),
    runIndex: Math.max(0, paragraph.content.length - 1),
    offsetInContent: 0,
  };
}

/**
 * Scroll to a match in the document (to be used with the editor)
 */
export function scrollToMatch(
  containerElement: HTMLElement | null,
  match: FindMatch
): void {
  if (!containerElement || !match) return;

  // Find the paragraph element
  const paragraphElement = containerElement.querySelector(
    `[data-paragraph-index="${match.paragraphIndex}"]`
  );

  if (paragraphElement) {
    paragraphElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

export default FindReplaceDialog;
