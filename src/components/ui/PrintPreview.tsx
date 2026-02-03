/**
 * PrintPreview Component
 *
 * Provides print preview functionality with:
 * - Print-optimized rendering of document pages
 * - Browser print dialog trigger
 * - Print-specific CSS styles
 * - Page scale adjustment for printing
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  Document,
  Theme,
  Paragraph,
  Table,
  HeaderFooter as HeaderFooterType,
} from '../../types/document';
import { calculatePages, type Page as PageData, type PageContent } from '../../layout/pageLayout';
import { twipsToPixels, formatPx } from '../../utils/units';
import { resolveColor } from '../../utils/colorResolver';

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
 * PrintPreview props
 */
export interface PrintPreviewProps {
  /** Document to print */
  document: Document;
  /** Theme for color resolution */
  theme?: Theme | null;
  /** Print options */
  options?: PrintOptions;
  /** Whether the preview is open */
  isOpen: boolean;
  /** Callback when preview is closed */
  onClose: () => void;
  /** Callback when print is triggered */
  onPrint?: () => void;
  /** Render function for paragraphs */
  renderParagraph?: (paragraph: Paragraph, index: number, pageContent: PageContent) => ReactNode;
  /** Render function for tables */
  renderTable?: (table: Table, index: number, pageContent: PageContent) => ReactNode;
  /** Render function for headers */
  renderHeader?: (header: HeaderFooterType, pageNumber: number, totalPages: number) => ReactNode;
  /** Render function for footers */
  renderFooter?: (footer: HeaderFooterType, pageNumber: number, totalPages: number) => ReactNode;
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

const DEFAULT_MARGIN_TWIPS = 1440; // 1 inch
const DEFAULT_HEADER_FOOTER_DISTANCE = 720; // 0.5 inches

// ============================================================================
// PRINT PREVIEW COMPONENT
// ============================================================================

/**
 * PrintPreview - Modal showing print-optimized document view
 */
export function PrintPreview({
  document: doc,
  theme,
  options = DEFAULT_PRINT_OPTIONS,
  isOpen,
  onClose,
  onPrint,
  renderParagraph,
  renderTable,
  renderHeader,
  renderFooter,
}: PrintPreviewProps): React.ReactElement | null {
  const printFrameRef = useRef<HTMLIFrameElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const mergedOptions = { ...DEFAULT_PRINT_OPTIONS, ...options };

  // Calculate pages for print
  const pageLayout = React.useMemo(() => {
    if (!doc?.package?.document) return null;

    try {
      return calculatePages(doc, {
        theme,
      });
    } catch (error) {
      console.error('Failed to calculate pages for print:', error);
      return null;
    }
  }, [doc, theme]);

  // Get pages to print
  const pagesToPrint = React.useMemo(() => {
    if (!pageLayout) return [];

    const { pages } = pageLayout;
    const { pageRange } = mergedOptions;

    if (pageRange) {
      const start = Math.max(1, pageRange.start);
      const end = Math.min(pages.length, pageRange.end);
      return pages.filter((p) => p.pageNumber >= start && p.pageNumber <= end);
    }

    return pages;
  }, [pageLayout, mergedOptions]);

  // Handle print
  const handlePrint = useCallback(() => {
    setIsPrinting(true);

    // Use window.print() for the iframe content
    if (printFrameRef.current?.contentWindow) {
      printFrameRef.current.contentWindow.print();
    } else {
      // Fallback: print the preview container directly
      window.print();
    }

    setIsPrinting(false);
    onPrint?.();
  }, [onPrint]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalPages = pagesToPrint.length;

  return (
    <div className="docx-print-preview-overlay" style={overlayStyle}>
      <div className="docx-print-preview-container" style={containerStyle}>
        {/* Header bar */}
        <div className="docx-print-preview-header" style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PrintIcon />
            <span style={{ fontWeight: 500 }}>Print Preview</span>
            <span style={{ color: 'var(--doc-text-muted)', fontSize: '14px' }}>
              {totalPages} page{totalPages !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handlePrint}
              disabled={isPrinting || totalPages === 0}
              style={printButtonStyle}
              aria-label="Print document"
            >
              <PrintIcon size={16} />
              <span>Print</span>
            </button>
            <button onClick={onClose} style={closeButtonStyle} aria-label="Close print preview">
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Preview area */}
        <div className="docx-print-preview-content" style={contentStyle}>
          {totalPages === 0 ? (
            <div style={emptyStateStyle}>
              <p>No pages to print</p>
            </div>
          ) : (
            <div className="docx-print-pages" style={pagesContainerStyle}>
              {pagesToPrint.map((page, _index) => (
                <PrintPage
                  key={page.pageNumber}
                  page={page}
                  pageNumber={page.pageNumber}
                  totalPages={totalPages}
                  theme={theme}
                  options={mergedOptions}
                  renderParagraph={renderParagraph}
                  renderTable={renderTable}
                  renderHeader={renderHeader}
                  renderFooter={renderFooter}
                />
              ))}
            </div>
          )}
        </div>

        {/* Print styles */}
        <PrintStyles />
      </div>
    </div>
  );
}

// ============================================================================
// PRINT PAGE COMPONENT
// ============================================================================

interface PrintPageProps {
  page: PageData;
  pageNumber: number;
  totalPages: number;
  theme?: Theme | null;
  options: PrintOptions;
  renderParagraph?: (paragraph: Paragraph, index: number, pageContent: PageContent) => ReactNode;
  renderTable?: (table: Table, index: number, pageContent: PageContent) => ReactNode;
  renderHeader?: (header: HeaderFooterType, pageNumber: number, totalPages: number) => ReactNode;
  renderFooter?: (footer: HeaderFooterType, pageNumber: number, totalPages: number) => ReactNode;
}

function PrintPage({
  page,
  pageNumber,
  totalPages,
  theme,
  options,
  renderParagraph,
  renderTable,
  renderHeader,
  renderFooter,
}: PrintPageProps): React.ReactElement {
  const { sectionProps, content, header, footer } = page;
  const {
    scale = 1,
    includeHeaders,
    includeFooters,
    includePageNumbers,
    printBackground,
  } = options;

  // Get page dimensions
  const pageWidth = page.widthPx * scale;
  const pageHeight = page.heightPx * scale;

  const topMargin = sectionProps.marginTop ?? DEFAULT_MARGIN_TWIPS;
  const bottomMargin = sectionProps.marginBottom ?? DEFAULT_MARGIN_TWIPS;
  const leftMargin = sectionProps.marginLeft ?? DEFAULT_MARGIN_TWIPS;
  const rightMargin = sectionProps.marginRight ?? DEFAULT_MARGIN_TWIPS;
  const headerDistance = sectionProps.headerDistance ?? DEFAULT_HEADER_FOOTER_DISTANCE;
  const footerDistance = sectionProps.footerDistance ?? DEFAULT_HEADER_FOOTER_DISTANCE;

  // Build page style
  const pageStyle: CSSProperties = {
    width: formatPx(pageWidth),
    height: formatPx(pageHeight),
    position: 'relative',
    backgroundColor: printBackground ? '#ffffff' : 'transparent',
    boxSizing: 'border-box',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    marginBottom: '20px',
    pageBreakAfter: 'always',
    pageBreakInside: 'avoid',
  };

  // Page background
  if (printBackground && sectionProps.background?.color) {
    pageStyle.backgroundColor = resolveColor(sectionProps.background.color, theme, '#ffffff');
  }

  // Content area style
  const contentAreaStyle: CSSProperties = {
    position: 'absolute',
    top: formatPx(twipsToPixels(topMargin) * scale),
    left: formatPx(twipsToPixels(leftMargin) * scale),
    right: formatPx(twipsToPixels(rightMargin) * scale),
    bottom: formatPx(twipsToPixels(bottomMargin) * scale),
    overflow: 'hidden',
  };

  // Header area style
  const headerAreaStyle: CSSProperties = {
    position: 'absolute',
    top: formatPx(twipsToPixels(headerDistance) * scale),
    left: formatPx(twipsToPixels(leftMargin) * scale),
    right: formatPx(twipsToPixels(rightMargin) * scale),
    height: formatPx(twipsToPixels(topMargin - headerDistance) * scale),
    overflow: 'hidden',
  };

  // Footer area style
  const footerAreaStyle: CSSProperties = {
    position: 'absolute',
    bottom: formatPx(twipsToPixels(footerDistance) * scale),
    left: formatPx(twipsToPixels(leftMargin) * scale),
    right: formatPx(twipsToPixels(rightMargin) * scale),
    height: formatPx(twipsToPixels(bottomMargin - footerDistance) * scale),
    overflow: 'hidden',
  };

  return (
    <div className="docx-print-page" style={pageStyle} data-page-number={pageNumber}>
      {/* Header */}
      {includeHeaders && header && (
        <div className="docx-print-header" style={headerAreaStyle}>
          {renderHeader ? (
            renderHeader(header, pageNumber, totalPages)
          ) : (
            <DefaultHeaderFooterContent content={header} />
          )}
        </div>
      )}

      {/* Content */}
      <div className="docx-print-content" style={contentAreaStyle}>
        {content.map((item, index) => {
          const itemStyle: CSSProperties = {
            position: 'absolute',
            top: formatPx(item.y * scale),
            left: 0,
            right: 0,
          };

          if (item.type === 'paragraph') {
            return (
              <div key={`content-${index}`} style={itemStyle}>
                {renderParagraph ? (
                  renderParagraph(item.block as Paragraph, item.blockIndex, item)
                ) : (
                  <DefaultParagraphContent paragraph={item.block as Paragraph} />
                )}
              </div>
            );
          } else if (item.type === 'table') {
            return (
              <div key={`content-${index}`} style={itemStyle}>
                {renderTable ? (
                  renderTable(item.block as Table, item.blockIndex, item)
                ) : (
                  <DefaultTableContent table={item.block as Table} />
                )}
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* Footer */}
      {includeFooters && footer && (
        <div className="docx-print-footer" style={footerAreaStyle}>
          {renderFooter ? (
            renderFooter(footer, pageNumber, totalPages)
          ) : (
            <DefaultHeaderFooterContent content={footer} />
          )}
        </div>
      )}

      {/* Page number (if not in footer and option enabled) */}
      {includePageNumbers && !footer && (
        <div className="docx-print-page-number" style={pageNumberStyle}>
          Page {pageNumber} of {totalPages}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DEFAULT CONTENT RENDERERS
// ============================================================================

function DefaultHeaderFooterContent({
  content,
}: {
  content: HeaderFooterType;
}): React.ReactElement {
  return (
    <div>
      {content.content.map((block, index) => {
        if (block.type === 'paragraph') {
          return (
            <div key={index}>
              <DefaultParagraphContent paragraph={block} />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function DefaultParagraphContent({ paragraph }: { paragraph: Paragraph }): React.ReactElement {
  const text = getParagraphText(paragraph);
  return <div style={{ minHeight: '1em' }}>{text || '\u00A0'}</div>;
}

function DefaultTableContent({ table }: { table: Table }): React.ReactElement {
  return (
    <div style={{ border: '1px solid var(--doc-border)', padding: '8px' }}>
      [Table: {table.rows.length} rows]
    </div>
  );
}

function getParagraphText(paragraph: Paragraph): string {
  const parts: string[] = [];
  for (const content of paragraph.content) {
    if (content.type === 'run') {
      for (const item of content.content) {
        if (item.type === 'text') {
          parts.push(item.text);
        }
      }
    } else if (content.type === 'hyperlink') {
      for (const child of content.children) {
        if (child.type === 'run') {
          for (const item of child.content) {
            if (item.type === 'text') {
              parts.push(item.text);
            }
          }
        }
      }
    }
  }
  return parts.join('');
}

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

          /* Hide print preview UI */
          .docx-print-preview-header,
          .docx-print-preview-overlay {
            display: none !important;
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

function CloseIcon(): React.ReactElement {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const overlayStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  zIndex: 10000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const containerStyle: CSSProperties = {
  width: '90vw',
  maxWidth: '1200px',
  height: '90vh',
  backgroundColor: 'var(--doc-bg-muted)',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  backgroundColor: 'white',
  borderBottom: '1px solid var(--doc-border)',
};

const contentStyle: CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '24px',
  display: 'flex',
  justifyContent: 'center',
};

const pagesContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const emptyStateStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--doc-text-muted)',
};

const printButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 16px',
  backgroundColor: 'var(--doc-primary)',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
};

const closeButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '36px',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  color: 'var(--doc-text-muted)',
};

const pageNumberStyle: CSSProperties = {
  position: 'absolute',
  bottom: '20px',
  left: 0,
  right: 0,
  textAlign: 'center',
  fontSize: '11px',
  color: 'var(--doc-text-muted)',
};

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

// ============================================================================
// EXPORTS
// ============================================================================

export default PrintPreview;
