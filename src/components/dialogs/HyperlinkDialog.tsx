/**
 * Hyperlink Dialog Component
 *
 * Modal dialog for inserting and editing hyperlinks in the document.
 * Supports both external URLs and internal bookmark links.
 *
 * Features:
 * - Input for URL (http, https, mailto, tel, etc.)
 * - Input for display text
 * - Edit existing hyperlinks
 * - Remove hyperlink option
 * - Internal bookmark selection
 * - Validation and error handling
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { CSSProperties, FormEvent, KeyboardEvent } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Hyperlink data structure for dialog
 */
export interface HyperlinkData {
  /** URL for external link */
  url?: string;
  /** Display text for the link */
  displayText?: string;
  /** Internal bookmark name */
  bookmark?: string;
  /** Tooltip text */
  tooltip?: string;
}

/**
 * Bookmark option for internal link selection
 */
export interface BookmarkOption {
  /** Bookmark name/ID */
  name: string;
  /** Optional display label */
  label?: string;
}

/**
 * Props for the HyperlinkDialog component
 */
export interface HyperlinkDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when hyperlink is inserted/updated */
  onSubmit: (data: HyperlinkData) => void;
  /** Callback when hyperlink is removed */
  onRemove?: () => void;
  /** Initial data for editing existing hyperlink */
  initialData?: HyperlinkData;
  /** Currently selected text (used as default display text) */
  selectedText?: string;
  /** Whether we're editing an existing hyperlink */
  isEditing?: boolean;
  /** Available bookmarks for internal links */
  bookmarks?: BookmarkOption[];
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
  minWidth: '400px',
  maxWidth: '500px',
  width: '100%',
  margin: '20px',
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
};

const FORM_GROUP_STYLE: CSSProperties = {
  marginBottom: '16px',
};

const LABEL_STYLE: CSSProperties = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '14px',
  fontWeight: 500,
  color: '#333',
};

const INPUT_STYLE: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '14px',
  boxSizing: 'border-box',
  outline: 'none',
};

const INPUT_ERROR_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  borderColor: '#dc3545',
};

const SELECT_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  cursor: 'pointer',
};

const ERROR_TEXT_STYLE: CSSProperties = {
  color: '#dc3545',
  fontSize: '12px',
  marginTop: '4px',
};

const HINT_TEXT_STYLE: CSSProperties = {
  color: '#666',
  fontSize: '12px',
  marginTop: '4px',
};

const TAB_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #e0e0e0',
  marginBottom: '16px',
};

const TAB_BUTTON_STYLE: CSSProperties = {
  padding: '10px 16px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  color: '#666',
  borderBottom: '2px solid transparent',
  marginBottom: '-1px',
};

const TAB_BUTTON_ACTIVE_STYLE: CSSProperties = {
  ...TAB_BUTTON_STYLE,
  color: '#0563C1',
  borderBottomColor: '#0563C1',
  fontWeight: 500,
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
  backgroundColor: '#0563C1',
  color: '#ffffff',
};

const SECONDARY_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: '#f0f0f0',
  color: '#333',
  border: '1px solid #ccc',
};

const DANGER_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: '#dc3545',
  color: '#ffffff',
};

const DISABLED_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: '#ccc',
  color: '#666',
  cursor: 'not-allowed',
};

// ============================================================================
// URL VALIDATION
// ============================================================================

/**
 * Validate a URL string
 * Supports http, https, mailto, tel, ftp protocols
 */
export function isValidUrl(url: string): boolean {
  if (!url || url.trim() === '') {
    return false;
  }

  const trimmed = url.trim();

  // Allow mailto: and tel: links
  if (trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) {
    return trimmed.length > 7; // Has content after protocol
  }

  // Allow ftp: links
  if (trimmed.startsWith('ftp://')) {
    return trimmed.length > 6;
  }

  // HTTP/HTTPS URLs
  try {
    // Add protocol if missing for validation
    const urlToValidate = trimmed.match(/^https?:\/\//) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(urlToValidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalize a URL by adding protocol if needed
 */
export function normalizeUrl(url: string): string {
  if (!url) return '';

  const trimmed = url.trim();

  // Keep special protocols as-is
  if (trimmed.startsWith('mailto:') || trimmed.startsWith('tel:') || trimmed.startsWith('ftp://')) {
    return trimmed;
  }

  // Add https:// if no protocol specified
  if (!trimmed.match(/^https?:\/\//)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

/**
 * Detect URL type from string
 */
export function getUrlType(url: string): 'web' | 'email' | 'phone' | 'ftp' | 'unknown' {
  if (!url) return 'unknown';

  const trimmed = url.trim().toLowerCase();

  if (trimmed.startsWith('mailto:')) return 'email';
  if (trimmed.startsWith('tel:')) return 'phone';
  if (trimmed.startsWith('ftp://')) return 'ftp';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return 'web';
  if (trimmed.includes('@') && !trimmed.includes(' ')) return 'email';

  return 'web'; // Default to web
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type LinkType = 'url' | 'bookmark';

/**
 * HyperlinkDialog component - Modal for inserting/editing hyperlinks
 */
export function HyperlinkDialog({
  isOpen,
  onClose,
  onSubmit,
  onRemove,
  initialData,
  selectedText = '',
  isEditing = false,
  bookmarks = [],
  className,
  style,
}: HyperlinkDialogProps): React.ReactElement | null {
  // State
  const [linkType, setLinkType] = useState<LinkType>('url');
  const [url, setUrl] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [bookmark, setBookmark] = useState('');
  const [tooltip, setTooltip] = useState('');
  const [urlError, setUrlError] = useState('');
  const [touched, setTouched] = useState(false);

  // Refs
  const urlInputRef = useRef<HTMLInputElement>(null);
  const bookmarkSelectRef = useRef<HTMLSelectElement>(null);

  // Initialize form with initial data or selected text
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Editing existing hyperlink
        if (initialData.bookmark) {
          setLinkType('bookmark');
          setBookmark(initialData.bookmark);
        } else {
          setLinkType('url');
          setUrl(initialData.url || '');
        }
        setDisplayText(initialData.displayText || '');
        setTooltip(initialData.tooltip || '');
      } else {
        // New hyperlink
        setLinkType('url');
        setUrl('');
        setDisplayText(selectedText);
        setBookmark('');
        setTooltip('');
      }
      setUrlError('');
      setTouched(false);
    }
  }, [isOpen, initialData, selectedText]);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (linkType === 'url') {
          urlInputRef.current?.focus();
        } else {
          bookmarkSelectRef.current?.focus();
        }
      }, 100);
    }
  }, [isOpen, linkType]);

  /**
   * Validate URL on blur
   */
  const validateUrl = useCallback(() => {
    if (linkType === 'url' && url.trim()) {
      if (!isValidUrl(url)) {
        setUrlError('Please enter a valid URL');
      } else {
        setUrlError('');
      }
    } else {
      setUrlError('');
    }
  }, [linkType, url]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();

      // Validate
      if (linkType === 'url') {
        if (!url.trim()) {
          setUrlError('URL is required');
          setTouched(true);
          return;
        }
        if (!isValidUrl(url)) {
          setUrlError('Please enter a valid URL');
          setTouched(true);
          return;
        }
      } else if (linkType === 'bookmark') {
        if (!bookmark) {
          return; // No bookmark selected
        }
      }

      // Build hyperlink data
      const data: HyperlinkData = {
        displayText: displayText.trim() || undefined,
        tooltip: tooltip.trim() || undefined,
      };

      if (linkType === 'url') {
        data.url = normalizeUrl(url);
      } else {
        data.bookmark = bookmark;
      }

      onSubmit(data);
    },
    [linkType, url, bookmark, displayText, tooltip, onSubmit]
  );

  /**
   * Handle keyboard events
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        // Submit on Enter (except in textarea)
        const target = e.target as HTMLElement;
        if (target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          handleSubmit();
        }
      }
    },
    [onClose, handleSubmit]
  );

  /**
   * Handle overlay click (close dialog)
   */
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  const hasBookmarks = bookmarks.length > 0;
  const canSubmit =
    (linkType === 'url' && url.trim() && !urlError) || (linkType === 'bookmark' && bookmark);

  return (
    <div
      className={`docx-hyperlink-dialog-overlay ${className || ''}`}
      style={{ ...DIALOG_OVERLAY_STYLE, ...style }}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hyperlink-dialog-title"
    >
      <div className="docx-hyperlink-dialog" style={DIALOG_CONTENT_STYLE}>
        {/* Header */}
        <div className="docx-hyperlink-dialog-header" style={DIALOG_HEADER_STYLE}>
          <h2 id="hyperlink-dialog-title" style={DIALOG_TITLE_STYLE}>
            {isEditing ? 'Edit Hyperlink' : 'Insert Hyperlink'}
          </h2>
          <button
            type="button"
            className="docx-hyperlink-dialog-close"
            style={CLOSE_BUTTON_STYLE}
            onClick={onClose}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <form
          className="docx-hyperlink-dialog-body"
          style={DIALOG_BODY_STYLE}
          onSubmit={handleSubmit}
        >
          {/* Link type tabs */}
          {hasBookmarks && (
            <div className="docx-hyperlink-dialog-tabs" style={TAB_CONTAINER_STYLE}>
              <button
                type="button"
                className={`docx-hyperlink-dialog-tab ${linkType === 'url' ? 'active' : ''}`}
                style={linkType === 'url' ? TAB_BUTTON_ACTIVE_STYLE : TAB_BUTTON_STYLE}
                onClick={() => setLinkType('url')}
                aria-selected={linkType === 'url'}
              >
                Web Address
              </button>
              <button
                type="button"
                className={`docx-hyperlink-dialog-tab ${linkType === 'bookmark' ? 'active' : ''}`}
                style={linkType === 'bookmark' ? TAB_BUTTON_ACTIVE_STYLE : TAB_BUTTON_STYLE}
                onClick={() => setLinkType('bookmark')}
                aria-selected={linkType === 'bookmark'}
              >
                Bookmark
              </button>
            </div>
          )}

          {/* URL input */}
          {linkType === 'url' && (
            <div className="docx-hyperlink-dialog-field" style={FORM_GROUP_STYLE}>
              <label htmlFor="hyperlink-url" style={LABEL_STYLE}>
                URL
              </label>
              <input
                ref={urlInputRef}
                id="hyperlink-url"
                type="text"
                className="docx-hyperlink-dialog-input"
                style={urlError && touched ? INPUT_ERROR_STYLE : INPUT_STYLE}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (touched) setUrlError('');
                }}
                onBlur={() => {
                  setTouched(true);
                  validateUrl();
                }}
                placeholder="https://example.com"
                aria-invalid={!!urlError}
                aria-describedby={urlError ? 'url-error' : 'url-hint'}
              />
              {urlError && touched && (
                <div id="url-error" style={ERROR_TEXT_STYLE}>
                  {urlError}
                </div>
              )}
              {!urlError && (
                <div id="url-hint" style={HINT_TEXT_STYLE}>
                  Enter a web address, email (mailto:), or phone (tel:)
                </div>
              )}
            </div>
          )}

          {/* Bookmark select */}
          {linkType === 'bookmark' && (
            <div className="docx-hyperlink-dialog-field" style={FORM_GROUP_STYLE}>
              <label htmlFor="hyperlink-bookmark" style={LABEL_STYLE}>
                Bookmark
              </label>
              <select
                ref={bookmarkSelectRef}
                id="hyperlink-bookmark"
                className="docx-hyperlink-dialog-select"
                style={SELECT_STYLE}
                value={bookmark}
                onChange={(e) => setBookmark(e.target.value)}
              >
                <option value="">Select a bookmark...</option>
                {bookmarks.map((bm) => (
                  <option key={bm.name} value={bm.name}>
                    {bm.label || bm.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Display text */}
          <div className="docx-hyperlink-dialog-field" style={FORM_GROUP_STYLE}>
            <label htmlFor="hyperlink-display-text" style={LABEL_STYLE}>
              Display Text
            </label>
            <input
              id="hyperlink-display-text"
              type="text"
              className="docx-hyperlink-dialog-input"
              style={INPUT_STYLE}
              value={displayText}
              onChange={(e) => setDisplayText(e.target.value)}
              placeholder="Text to display (optional)"
            />
            <div style={HINT_TEXT_STYLE}>Leave empty to use the selected text</div>
          </div>

          {/* Tooltip */}
          <div className="docx-hyperlink-dialog-field" style={FORM_GROUP_STYLE}>
            <label htmlFor="hyperlink-tooltip" style={LABEL_STYLE}>
              Tooltip (optional)
            </label>
            <input
              id="hyperlink-tooltip"
              type="text"
              className="docx-hyperlink-dialog-input"
              style={INPUT_STYLE}
              value={tooltip}
              onChange={(e) => setTooltip(e.target.value)}
              placeholder="Text shown on hover"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="docx-hyperlink-dialog-footer" style={DIALOG_FOOTER_STYLE}>
          {isEditing && onRemove && (
            <button
              type="button"
              className="docx-hyperlink-dialog-remove"
              style={DANGER_BUTTON_STYLE}
              onClick={onRemove}
            >
              Remove Link
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="docx-hyperlink-dialog-cancel"
            style={SECONDARY_BUTTON_STYLE}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="docx-hyperlink-dialog-submit"
            style={canSubmit ? PRIMARY_BUTTON_STYLE : DISABLED_BUTTON_STYLE}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isEditing ? 'Update' : 'Insert'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create HyperlinkData from a URL string
 */
export function createHyperlinkData(url: string, displayText?: string): HyperlinkData {
  return {
    url: normalizeUrl(url),
    displayText,
  };
}

/**
 * Create HyperlinkData for an internal bookmark
 */
export function createBookmarkLinkData(bookmark: string, displayText?: string): HyperlinkData {
  return {
    bookmark,
    displayText,
  };
}

/**
 * Check if HyperlinkData is for an external URL
 */
export function isExternalHyperlinkData(data: HyperlinkData): boolean {
  return !!data.url && !data.bookmark;
}

/**
 * Check if HyperlinkData is for an internal bookmark
 */
export function isBookmarkHyperlinkData(data: HyperlinkData): boolean {
  return !!data.bookmark;
}

/**
 * Get display text from HyperlinkData, falling back to URL/bookmark
 */
export function getDisplayText(data: HyperlinkData): string {
  if (data.displayText) {
    return data.displayText;
  }
  if (data.url) {
    // Strip protocol for display
    return data.url.replace(/^https?:\/\//, '');
  }
  if (data.bookmark) {
    return data.bookmark;
  }
  return '';
}

/**
 * Convert email address to mailto: link
 */
export function emailToMailto(email: string): string {
  if (email.startsWith('mailto:')) {
    return email;
  }
  return `mailto:${email}`;
}

/**
 * Convert phone number to tel: link
 */
export function phoneToTel(phone: string): string {
  if (phone.startsWith('tel:')) {
    return phone;
  }
  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  return `tel:${cleaned}`;
}

/**
 * Extract bookmarks from document for the dialog
 */
export function extractBookmarksForDialog(
  bookmarks: { name: string; id: number }[]
): BookmarkOption[] {
  return bookmarks
    .filter((bm) => !bm.name.startsWith('_')) // Filter out internal bookmarks
    .map((bm) => ({
      name: bm.name,
      label: bm.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook state for the Hyperlink dialog
 */
export interface UseHyperlinkDialogState {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Initial data for the dialog (for editing) */
  initialData?: HyperlinkData;
  /** Currently selected text */
  selectedText?: string;
  /** Whether we're editing an existing hyperlink */
  isEditing: boolean;
}

/**
 * Hook return type for the Hyperlink dialog
 */
export interface UseHyperlinkDialogReturn {
  /** Current state */
  state: UseHyperlinkDialogState;
  /** Open dialog for inserting new hyperlink */
  openInsert: (selectedText?: string) => void;
  /** Open dialog for editing existing hyperlink */
  openEdit: (data: HyperlinkData) => void;
  /** Close the dialog */
  close: () => void;
  /** Toggle dialog open/closed */
  toggle: () => void;
}

/**
 * Hook for managing Hyperlink dialog state
 */
export function useHyperlinkDialog(): UseHyperlinkDialogReturn {
  const [state, setState] = useState<UseHyperlinkDialogState>({
    isOpen: false,
    isEditing: false,
  });

  const openInsert = useCallback((selectedText?: string) => {
    setState({
      isOpen: true,
      selectedText,
      initialData: undefined,
      isEditing: false,
    });
  }, []);

  const openEdit = useCallback((data: HyperlinkData) => {
    setState({
      isOpen: true,
      initialData: data,
      selectedText: data.displayText,
      isEditing: true,
    });
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

  return { state, openInsert, openEdit, close, toggle };
}

export default HyperlinkDialog;
