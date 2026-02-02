/**
 * Paste Special Dialog Component
 *
 * Provides paste options for pasting content with or without formatting.
 * Features:
 * - Paste with formatting (default)
 * - Paste as plain text (unformatted)
 * - Keyboard shortcut: Ctrl+Shift+V opens dialog
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ParsedClipboardContent } from '../../utils/clipboard';
import { readFromClipboard } from '../../utils/clipboard';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Paste option type
 */
export type PasteOption = 'formatted' | 'plainText';

/**
 * Paste special dialog props
 */
export interface PasteSpecialDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when paste is confirmed */
  onPaste: (content: ParsedClipboardContent, asPlainText: boolean) => void;
  /** Optional custom position */
  position?: { x: number; y: number };
  /** Additional className */
  className?: string;
}

/**
 * Paste option item
 */
interface PasteOptionItem {
  id: PasteOption;
  label: string;
  description: string;
  shortcut: string;
}

/**
 * Hook return value for paste special
 */
export interface UsePasteSpecialReturn {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Open the paste special dialog */
  openDialog: () => void;
  /** Close the dialog */
  closeDialog: () => void;
  /** Handle keyboard shortcut (Ctrl+Shift+V) */
  handleKeyDown: (event: KeyboardEvent) => boolean;
  /** Paste as plain text directly */
  pasteAsPlainText: () => Promise<void>;
}

/**
 * Options for usePasteSpecial hook
 */
export interface UsePasteSpecialOptions {
  /** Callback when paste is confirmed */
  onPaste?: (content: ParsedClipboardContent, asPlainText: boolean) => void;
  /** Whether paste operations are enabled */
  enabled?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Available paste options
 */
const PASTE_OPTIONS: PasteOptionItem[] = [
  {
    id: 'formatted',
    label: 'Keep Source Formatting',
    description: 'Paste with original formatting',
    shortcut: 'Ctrl+V',
  },
  {
    id: 'plainText',
    label: 'Paste as Plain Text',
    description: 'Paste without any formatting',
    shortcut: 'Ctrl+Shift+V',
  },
];

// ============================================================================
// ICONS
// ============================================================================

const FormattedIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 4h12v2H4V4zM4 8h8v2H4V8zM4 12h10v2H4v-2zM4 16h6v2H4v-2z"
      fill="currentColor"
    />
    <path
      d="M14 10l3 3-3 3v-2h-2v-2h2v-2z"
      fill="currentColor"
      opacity="0.6"
    />
  </svg>
);

const PlainTextIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 4h12v1H4V4zM4 7h12v1H4V7zM4 10h12v1H4v-1zM4 13h12v1H4v-1zM4 16h8v1H4v-1z"
      fill="currentColor"
    />
  </svg>
);

/**
 * Get icon for paste option
 */
function getPasteOptionIcon(option: PasteOption): React.ReactNode {
  switch (option) {
    case 'formatted':
      return <FormattedIcon />;
    case 'plainText':
      return <PlainTextIcon />;
    default:
      return null;
  }
}

// ============================================================================
// PASTE OPTION ITEM COMPONENT
// ============================================================================

interface PasteOptionButtonProps {
  option: PasteOptionItem;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

const PasteOptionButton: React.FC<PasteOptionButtonProps> = ({
  option,
  isSelected,
  onClick,
  onMouseEnter,
}) => {
  return (
    <button
      type="button"
      className={`docx-paste-special-option ${isSelected ? 'docx-paste-special-option-selected' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      role="menuitem"
      aria-selected={isSelected}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '12px 16px',
        border: 'none',
        background: isSelected ? '#e8f0fe' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        borderRadius: '4px',
        transition: 'background-color 0.15s ease',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '4px',
          background: isSelected ? '#1a73e8' : '#f1f3f4',
          color: isSelected ? '#fff' : '#5f6368',
        }}
      >
        {getPasteOptionIcon(option.id)}
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: '#202124',
            marginBottom: '2px',
          }}
        >
          {option.label}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: '#5f6368',
          }}
        >
          {option.description}
        </div>
      </div>
      <span
        style={{
          fontSize: '11px',
          color: '#9aa0a6',
          fontFamily: 'monospace',
        }}
      >
        {option.shortcut}
      </span>
    </button>
  );
};

// ============================================================================
// PASTE SPECIAL DIALOG COMPONENT
// ============================================================================

export const PasteSpecialDialog: React.FC<PasteSpecialDialogProps> = ({
  isOpen,
  onClose,
  onPaste,
  position,
  className = '',
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [clipboardContent, setClipboardContent] = useState<ParsedClipboardContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read clipboard content when dialog opens
  useEffect(() => {
    if (!isOpen) {
      setClipboardContent(null);
      setError(null);
      setSelectedIndex(0);
      return;
    }

    const loadClipboard = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const content = await readFromClipboard({ cleanWordFormatting: true });
        setClipboardContent(content);
        if (!content) {
          setError('No content available to paste');
        }
      } catch (err) {
        setError('Unable to read clipboard. Please use Ctrl+V to paste.');
      } finally {
        setIsLoading(false);
      }
    };

    loadClipboard();
  }, [isOpen]);

  // Handle click outside to close
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
          setSelectedIndex((prev) => (prev + 1) % PASTE_OPTIONS.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + PASTE_OPTIONS.length) % PASTE_OPTIONS.length);
          break;
        case 'Enter':
          e.preventDefault();
          handlePaste(PASTE_OPTIONS[selectedIndex].id);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, onClose]);

  const handlePaste = useCallback(
    (option: PasteOption) => {
      if (!clipboardContent) {
        setError('No content available to paste');
        return;
      }

      const asPlainText = option === 'plainText';
      onPaste(clipboardContent, asPlainText);
      onClose();
    },
    [clipboardContent, onPaste, onClose]
  );

  // Calculate dialog position
  const getDialogStyle = useCallback((): React.CSSProperties => {
    const dialogWidth = 320;
    const dialogHeight = 200;

    let x = position?.x ?? (typeof window !== 'undefined' ? window.innerWidth / 2 - dialogWidth / 2 : 100);
    let y = position?.y ?? (typeof window !== 'undefined' ? window.innerHeight / 2 - dialogHeight / 2 : 100);

    // Adjust for viewport boundaries
    if (typeof window !== 'undefined') {
      if (x + dialogWidth > window.innerWidth) {
        x = window.innerWidth - dialogWidth - 10;
      }
      if (y + dialogHeight > window.innerHeight) {
        y = window.innerHeight - dialogHeight - 10;
      }
      if (x < 10) x = 10;
      if (y < 10) y = 10;
    }

    return {
      position: 'fixed',
      top: y,
      left: x,
      width: dialogWidth,
      background: '#fff',
      border: '1px solid #dadce0',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      zIndex: 10001,
      overflow: 'hidden',
    };
  }, [position]);

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      className={`docx-paste-special-dialog ${className}`}
      style={getDialogStyle()}
      role="dialog"
      aria-label="Paste Special"
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#202124',
          }}
        >
          Paste Special
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderRadius: '4px',
            color: '#5f6368',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '8px' }}>
        {isLoading ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: '#5f6368',
              fontSize: '13px',
            }}
          >
            Reading clipboard...
          </div>
        ) : error ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: '#d93025',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        ) : (
          <div role="menu">
            {PASTE_OPTIONS.map((option, index) => (
              <PasteOptionButton
                key={option.id}
                option={option}
                isSelected={index === selectedIndex}
                onClick={() => handlePaste(option.id)}
                onMouseEnter={() => setSelectedIndex(index)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Clipboard preview */}
      {clipboardContent && !isLoading && !error && (
        <div
          style={{
            padding: '8px 16px 12px',
            borderTop: '1px solid #e0e0e0',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: '#5f6368',
              marginBottom: '4px',
            }}
          >
            Preview:
          </div>
          <div
            style={{
              fontSize: '12px',
              color: '#202124',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              padding: '6px 8px',
              background: '#f8f9fa',
              borderRadius: '4px',
            }}
          >
            "{clipboardContent.plainText.slice(0, 50)}
            {clipboardContent.plainText.length > 50 ? '...' : ''}"
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// HOOK FOR PASTE SPECIAL
// ============================================================================

/**
 * Hook to manage paste special dialog
 */
export function usePasteSpecial(options: UsePasteSpecialOptions = {}): UsePasteSpecialReturn {
  const { onPaste, enabled = true } = options;
  const [isOpen, setIsOpen] = useState(false);

  const openDialog = useCallback(() => {
    if (enabled) {
      setIsOpen(true);
    }
  }, [enabled]);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  /**
   * Paste as plain text directly (without dialog)
   */
  const pasteAsPlainText = useCallback(async () => {
    if (!enabled || !onPaste) return;

    try {
      const content = await readFromClipboard({ cleanWordFormatting: true });
      if (content) {
        onPaste(content, true);
      }
    } catch (error) {
      console.error('Failed to paste as plain text:', error);
    }
  }, [enabled, onPaste]);

  /**
   * Handle keyboard shortcuts
   * Returns true if the event was handled
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      if (!enabled) return false;

      const isCtrlOrMeta = event.ctrlKey || event.metaKey;

      // Ctrl+Shift+V - Open paste special dialog OR paste as plain text
      if (isCtrlOrMeta && event.shiftKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        openDialog();
        return true;
      }

      return false;
    },
    [enabled, openDialog]
  );

  return {
    isOpen,
    openDialog,
    closeDialog,
    handleKeyDown,
    pasteAsPlainText,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get paste option by id
 */
export function getPasteOption(id: PasteOption): PasteOptionItem | undefined {
  return PASTE_OPTIONS.find((option) => option.id === id);
}

/**
 * Get all paste options
 */
export function getAllPasteOptions(): PasteOptionItem[] {
  return [...PASTE_OPTIONS];
}

/**
 * Get default paste option
 */
export function getDefaultPasteOption(): PasteOption {
  return 'formatted';
}

/**
 * Check if paste special shortcut
 */
export function isPasteSpecialShortcut(event: KeyboardEvent): boolean {
  const isCtrlOrMeta = event.ctrlKey || event.metaKey;
  return isCtrlOrMeta && event.shiftKey && event.key.toLowerCase() === 'v';
}

// ============================================================================
// EXPORTS
// ============================================================================

export default PasteSpecialDialog;
