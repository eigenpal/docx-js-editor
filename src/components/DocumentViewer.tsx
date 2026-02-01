/**
 * DocumentViewer Component
 *
 * Full paginated document viewer:
 * - Renders all pages vertically
 * - Gap between pages
 * - Scrollable container
 * - Loading state while parsing
 * - Placeholder when no document
 * - Zoom control
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  Document,
  Theme,
  Paragraph,
  Table,
  HeaderFooter as HeaderFooterType,
} from '../types/document';
import { Page, type PageProps } from './render/Page';
import { calculatePages, type PageLayoutResult, type Page as PageData, type PageContent } from '../layout/pageLayout';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for the DocumentViewer component
 */
export interface DocumentViewerProps {
  /** The document to render */
  document?: Document | null;
  /** Theme for resolving colors and fonts */
  theme?: Theme | null;
  /** Zoom level (1.0 = 100%) */
  zoom?: number;
  /** Gap between pages in pixels */
  pageGap?: number;
  /** Whether to show page shadows */
  showPageShadows?: boolean;
  /** Whether to show page numbers */
  showPageNumbers?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Custom loading indicator */
  loadingIndicator?: ReactNode;
  /** Custom placeholder for no document */
  placeholder?: ReactNode;
  /** Custom paragraph renderer */
  renderParagraph?: (paragraph: Paragraph, index: number, pageContent: PageContent) => ReactNode;
  /** Custom table renderer */
  renderTable?: (table: Table, index: number, pageContent: PageContent) => ReactNode;
  /** Custom header renderer */
  renderHeader?: (header: HeaderFooterType, pageNumber: number) => ReactNode;
  /** Custom footer renderer */
  renderFooter?: (footer: HeaderFooterType, pageNumber: number) => ReactNode;
  /** Callback when page becomes visible */
  onPageVisible?: (pageNumber: number) => void;
  /** Callback when document is clicked */
  onDocumentClick?: (e: React.MouseEvent, page: PageData | null) => void;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
}

/**
 * State for scroll tracking
 */
interface ScrollState {
  currentPage: number;
  scrollTop: number;
  scrollHeight: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * DocumentViewer component - renders paginated document view
 */
export function DocumentViewer({
  document,
  theme,
  zoom = 1,
  pageGap = 20,
  showPageShadows = true,
  showPageNumbers = true,
  isLoading = false,
  loadingIndicator,
  placeholder,
  renderParagraph,
  renderTable,
  renderHeader,
  renderFooter,
  onPageVisible,
  onDocumentClick,
  className,
  style: additionalStyle,
}: DocumentViewerProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState<ScrollState>({
    currentPage: 1,
    scrollTop: 0,
    scrollHeight: 0,
  });

  // Calculate page layout
  const layoutResult = useMemo<PageLayoutResult | null>(() => {
    if (!document) return null;

    try {
      return calculatePages(document, { theme });
    } catch (error) {
      console.error('Error calculating page layout:', error);
      return null;
    }
  }, [document, theme]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !layoutResult) return;

    const { scrollTop } = containerRef.current;
    let currentPage = 1;
    let accumulatedHeight = 0;

    for (let i = 0; i < layoutResult.pages.length; i++) {
      const page = layoutResult.pages[i];
      const pageHeight = page.heightPx * zoom + pageGap;

      if (scrollTop < accumulatedHeight + pageHeight / 2) {
        currentPage = page.pageNumber;
        break;
      }

      accumulatedHeight += pageHeight;
      currentPage = page.pageNumber;
    }

    if (currentPage !== scrollState.currentPage) {
      setScrollState((prev) => ({
        ...prev,
        currentPage,
        scrollTop,
      }));

      if (onPageVisible) {
        onPageVisible(currentPage);
      }
    }
  }, [layoutResult, zoom, pageGap, scrollState.currentPage, onPageVisible]);

  // Set up scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Handle document click
  const handleClick = useCallback(
    (e: React.MouseEvent, page: PageData) => {
      if (onDocumentClick) {
        onDocumentClick(e, page);
      }
    },
    [onDocumentClick]
  );

  // Handle container click (outside pages)
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      // Only fire if clicking the container itself, not a page
      if (e.target === containerRef.current && onDocumentClick) {
        onDocumentClick(e, null);
      }
    },
    [onDocumentClick]
  );

  // Build class names
  const classNames: string[] = ['docx-viewer'];
  if (isLoading) {
    classNames.push('docx-viewer-loading');
  }
  if (!document && !isLoading) {
    classNames.push('docx-viewer-empty');
  }
  if (className) {
    classNames.push(className);
  }

  // Build style
  const style: CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'auto',
    backgroundColor: '#e0e0e0',
    padding: `${pageGap}px`,
    boxSizing: 'border-box',
    ...additionalStyle,
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className={classNames.join(' ')} style={style}>
        {loadingIndicator || <DefaultLoadingIndicator />}
      </div>
    );
  }

  // Render placeholder when no document
  if (!document || !layoutResult || layoutResult.pages.length === 0) {
    return (
      <div
        className={classNames.join(' ')}
        style={style}
        onClick={handleContainerClick}
      >
        {placeholder || <DefaultPlaceholder />}
      </div>
    );
  }

  // Calculate total height for virtual scrolling (future enhancement)
  const totalHeight = layoutResult.pages.reduce(
    (sum, page) => sum + page.heightPx * zoom + pageGap,
    0
  ) - pageGap; // Remove last gap

  return (
    <div
      ref={containerRef}
      className={classNames.join(' ')}
      style={style}
      onClick={handleContainerClick}
    >
      <div
        className="docx-viewer-content"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: `${pageGap}px`,
          minHeight: `${totalHeight}px`,
        }}
      >
        {layoutResult.pages.map((page) => (
          <PageWrapper
            key={page.pageNumber}
            page={page}
            theme={theme}
            zoom={zoom}
            showShadow={showPageShadows}
            showPageNumber={showPageNumbers}
            totalPages={layoutResult.totalPages}
            renderParagraph={renderParagraph}
            renderTable={renderTable}
            renderHeader={renderHeader}
            renderFooter={renderFooter}
            onClick={handleClick}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// PAGE WRAPPER
// ============================================================================

interface PageWrapperProps {
  page: PageData;
  theme?: Theme | null;
  zoom: number;
  showShadow: boolean;
  showPageNumber: boolean;
  totalPages: number;
  renderParagraph?: (paragraph: Paragraph, index: number, pageContent: PageContent) => ReactNode;
  renderTable?: (table: Table, index: number, pageContent: PageContent) => ReactNode;
  renderHeader?: (header: HeaderFooterType, pageNumber: number) => ReactNode;
  renderFooter?: (footer: HeaderFooterType, pageNumber: number) => ReactNode;
  onClick: (e: React.MouseEvent, page: PageData) => void;
}

function PageWrapper({
  page,
  theme,
  zoom,
  showShadow,
  showPageNumber,
  totalPages,
  renderParagraph,
  renderTable,
  renderHeader,
  renderFooter,
  onClick,
}: PageWrapperProps): React.ReactElement {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      onClick(e, page);
    },
    [onClick, page]
  );

  // Wrap header renderer to include page number
  const wrappedRenderHeader = useMemo(() => {
    if (!renderHeader) return undefined;
    return (header: HeaderFooterType) => renderHeader(header, page.pageNumber);
  }, [renderHeader, page.pageNumber]);

  // Wrap footer renderer to include page number
  const wrappedRenderFooter = useMemo(() => {
    if (!renderFooter) return undefined;
    return (footer: HeaderFooterType) => renderFooter(footer, page.pageNumber);
  }, [renderFooter, page.pageNumber]);

  return (
    <div
      className="docx-page-wrapper"
      style={{ position: 'relative' }}
    >
      <Page
        page={page}
        theme={theme}
        zoom={zoom}
        showShadow={showShadow}
        renderParagraph={renderParagraph}
        renderTable={renderTable}
        renderHeader={wrappedRenderHeader}
        renderFooter={wrappedRenderFooter}
        onClick={handleClick}
      />

      {/* Page number indicator */}
      {showPageNumber && (
        <div
          className="docx-page-number-indicator"
          style={{
            position: 'absolute',
            bottom: '-20px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '12px',
            color: '#666',
            whiteSpace: 'nowrap',
          }}
        >
          Page {page.pageNumber} of {totalPages}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DEFAULT COMPONENTS
// ============================================================================

/**
 * Default loading indicator
 */
function DefaultLoadingIndicator(): React.ReactElement {
  return (
    <div
      className="docx-viewer-loading-indicator"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#666',
      }}
    >
      <div
        className="docx-loading-spinner"
        style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e0e0e0',
          borderTop: '3px solid #666',
          borderRadius: '50%',
          animation: 'docx-spin 1s linear infinite',
        }}
      />
      <style>
        {`
          @keyframes docx-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={{ marginTop: '16px' }}>Loading document...</div>
    </div>
  );
}

/**
 * Default placeholder for no document
 */
function DefaultPlaceholder(): React.ReactElement {
  return (
    <div
      className="docx-viewer-placeholder"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#999',
      }}
    >
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
      <div style={{ marginTop: '16px' }}>No document loaded</div>
      <div style={{ marginTop: '8px', fontSize: '12px' }}>
        Open a DOCX file to view it here
      </div>
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Scroll to a specific page
 */
export function scrollToPage(
  containerRef: React.RefObject<HTMLDivElement>,
  pageNumber: number,
  layoutResult: PageLayoutResult | null,
  zoom: number = 1,
  pageGap: number = 20
): void {
  if (!containerRef.current || !layoutResult) return;

  let targetY = 0;

  for (let i = 0; i < pageNumber - 1 && i < layoutResult.pages.length; i++) {
    targetY += layoutResult.pages[i].heightPx * zoom + pageGap;
  }

  containerRef.current.scrollTo({
    top: targetY,
    behavior: 'smooth',
  });
}

/**
 * Get visible page numbers
 */
export function getVisiblePages(
  containerRef: React.RefObject<HTMLDivElement>,
  layoutResult: PageLayoutResult | null,
  zoom: number = 1,
  pageGap: number = 20
): number[] {
  if (!containerRef.current || !layoutResult) return [];

  const { scrollTop, clientHeight } = containerRef.current;
  const visiblePages: number[] = [];
  let accumulatedHeight = 0;

  for (const page of layoutResult.pages) {
    const pageHeight = page.heightPx * zoom;
    const pageTop = accumulatedHeight;
    const pageBottom = accumulatedHeight + pageHeight;

    // Check if page is visible
    if (pageBottom > scrollTop && pageTop < scrollTop + clientHeight) {
      visiblePages.push(page.pageNumber);
    }

    accumulatedHeight += pageHeight + pageGap;

    // Stop if we've passed the visible area
    if (pageTop > scrollTop + clientHeight) break;
  }

  return visiblePages;
}

/**
 * Calculate zoom to fit page width
 */
export function calculateFitWidthZoom(
  containerWidth: number,
  pageWidth: number,
  padding: number = 40
): number {
  return (containerWidth - padding) / pageWidth;
}

/**
 * Calculate zoom to fit whole page
 */
export function calculateFitPageZoom(
  containerWidth: number,
  containerHeight: number,
  pageWidth: number,
  pageHeight: number,
  padding: number = 40
): number {
  const widthZoom = (containerWidth - padding) / pageWidth;
  const heightZoom = (containerHeight - padding) / pageHeight;
  return Math.min(widthZoom, heightZoom);
}

export default DocumentViewer;
