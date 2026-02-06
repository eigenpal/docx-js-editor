/**
 * Print Utilities
 *
 * Provides print functionality with:
 * - Print button component for toolbar
 * - Print-specific CSS styles
 * - Browser print dialog trigger
 * - Page range utilities
 */

import React from 'react';
import type { CSSProperties } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Print options
 */
export interface PrintOptions {
  /** Whether to include headers */
  includeHeaders?: boolean;
  /** Whether to include footers */
  includeFooters?: boolean;
  /** Whether to include page numbers */
  includePageNumbers?: boolean;
  /** Page range to print (null = all) */
  pageRange?: { start: number; end: number } | null;
  /** Scale factor for printing (1.0 = 100%) */
  scale?: number;
  /** Whether to show background colors */
  printBackground?: boolean;
  /** Margins mode */
  margins?: 'default' | 'none' | 'minimum';
}

/**
 * PrintButton props
 */
export interface PrintButtonProps {
  /** Callback when print is triggered */
  onPrint: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Button label */
  label?: string;
  /** Additional CSS class */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Show icon */
  showIcon?: boolean;
  /** Compact mode */
  compact?: boolean;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  includeHeaders: true,
  includeFooters: true,
  includePageNumbers: true,
  pageRange: null,
  scale: 1.0,
  printBackground: true,
  margins: 'default',
};

// ============================================================================
// PRINT BUTTON COMPONENT
// ============================================================================

/**
 * PrintButton - Standalone print button for toolbar
 */
export function PrintButton({
  onPrint,
  disabled = false,
  label = 'Print',
  className = '',
  style,
  showIcon = true,
  compact = false,
}: PrintButtonProps): React.ReactElement {
  const buttonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: compact ? '4px' : '6px',
    padding: compact ? '4px 8px' : '6px 12px',
    fontSize: compact ? '13px' : '14px',
    backgroundColor: 'white',
    border: '1px solid var(--doc-border)',
    borderRadius: '4px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? 'var(--doc-text-muted)' : 'var(--doc-text)',
    opacity: disabled ? 0.6 : 1,
    transition: 'background-color 0.15s, border-color 0.15s',
    ...style,
  };

  return (
    <button
      className={`docx-print-button ${className}`.trim()}
      style={buttonStyle}
      onClick={onPrint}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {showIcon && <PrintIcon size={compact ? 14 : 16} />}
      {!compact && <span>{label}</span>}
    </button>
  );
}

// ============================================================================
// PRINT STYLES COMPONENT
// ============================================================================

/**
 * PrintStyles - Injects print-specific CSS
 */
export function PrintStyles(): React.ReactElement {
  return (
    <style>
      {`
        @media print {
          /* Hide everything except print content */
          body * {
            visibility: hidden;
          }

          .docx-print-pages,
          .docx-print-pages * {
            visibility: visible;
          }

          .docx-print-pages {
            position: absolute;
            left: 0;
            top: 0;
          }

          /* Remove shadows and margins in print */
          .docx-print-page {
            box-shadow: none !important;
            margin: 0 !important;
            page-break-after: always;
            page-break-inside: avoid;
          }

          /* Ensure images print */
          img {
            max-width: 100%;
            page-break-inside: avoid;
          }

          /* Ensure tables don't break badly */
          table {
            page-break-inside: avoid;
          }

          tr {
            page-break-inside: avoid;
          }

          /* Keep headings with content */
          h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
          }

          /* Avoid orphan lines */
          p {
            orphans: 3;
            widows: 3;
          }
        }

        @page {
          margin: 0;
          size: auto;
        }
      `}
    </style>
  );
}

// ============================================================================
// ICONS
// ============================================================================

interface IconProps {
  size?: number;
}

function PrintIcon({ size = 18 }: IconProps): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Trigger browser print dialog for the current document
 */
export function triggerPrint(): void {
  window.print();
}

/**
 * Create print-optimized document view in a new window
 */
export function openPrintWindow(title: string = 'Document', content: string): Window | null {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return null;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          @page {
            margin: 0;
          }
        }
      </style>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `);

  printWindow.document.close();
  return printWindow;
}

/**
 * Get default print options
 */
export function getDefaultPrintOptions(): PrintOptions {
  return { ...DEFAULT_PRINT_OPTIONS };
}

/**
 * Create page range from string (e.g., "1-5", "3", "1,3,5")
 */
export function parsePageRange(
  input: string,
  maxPages: number
): { start: number; end: number } | null {
  if (!input || !input.trim()) return null;

  const trimmed = input.trim();

  // Single page
  if (/^\d+$/.test(trimmed)) {
    const page = parseInt(trimmed, 10);
    if (page >= 1 && page <= maxPages) {
      return { start: page, end: page };
    }
    return null;
  }

  // Range (e.g., "1-5")
  const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (start >= 1 && end <= maxPages && start <= end) {
      return { start, end };
    }
    return null;
  }

  return null;
}

/**
 * Format page range for display
 */
export function formatPageRange(
  range: { start: number; end: number } | null,
  totalPages: number
): string {
  if (!range) return `All (${totalPages} pages)`;
  if (range.start === range.end) return `Page ${range.start}`;
  return `Pages ${range.start}-${range.end}`;
}

/**
 * Check if browser supports good print functionality
 */
export function isPrintSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.print === 'function';
}
