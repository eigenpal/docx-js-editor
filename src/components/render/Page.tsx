/**
 * Page Component
 *
 * Renders a single page with:
 * - Correct page dimensions
 * - Content area respecting margins
 * - Header at top, footer at bottom
 * - Page background and borders
 * - Page shadow for document appearance
 */

import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  SectionProperties,
  HeaderFooter as HeaderFooterType,
  Theme,
  Paragraph,
  Table,
} from '../../types/document';
import { twipsToPixels, formatPx } from '../../utils/units';
import { resolveColor } from '../../utils/colorResolver';
import type { Page as PageData, PageContent } from '../../layout/pageLayout';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for the Page component
 */
export interface PageProps {
  /** Page data from layout engine */
  page: PageData;
  /** Theme for resolving colors */
  theme?: Theme | null;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Zoom level (1.0 = 100%) */
  zoom?: number;
  /** Whether to show page shadow */
  showShadow?: boolean;
  /** Whether to show margin guides/boundaries */
  showMarginGuides?: boolean;
  /** Color for margin guides (default: #e0e0e0) */
  marginGuideColor?: string;
  /** Render function for paragraphs */
  renderParagraph?: (paragraph: Paragraph, index: number, pageContent: PageContent) => ReactNode;
  /** Render function for tables */
  renderTable?: (table: Table, index: number, pageContent: PageContent) => ReactNode;
  /** Render function for header */
  renderHeader?: (header: HeaderFooterType) => ReactNode;
  /** Render function for footer */
  renderFooter?: (footer: HeaderFooterType) => ReactNode;
  /** Click handler for page */
  onClick?: (e: React.MouseEvent, page: PageData) => void;
}

/**
 * Simplified props for standalone page rendering
 */
export interface SimplePageProps {
  /** Page number (for display) */
  pageNumber?: number;
  /** Page width in twips */
  widthTwips?: number;
  /** Page height in twips */
  heightTwips?: number;
  /** Section properties */
  sectionProps?: SectionProperties;
  /** Theme for resolving colors */
  theme?: Theme | null;
  /** Content to render */
  children?: ReactNode;
  /** Header content */
  header?: ReactNode;
  /** Footer content */
  footer?: ReactNode;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Zoom level */
  zoom?: number;
  /** Whether to show page shadow */
  showShadow?: boolean;
  /** Whether to show margin guides/boundaries */
  showMarginGuides?: boolean;
  /** Color for margin guides (default: #e0e0e0) */
  marginGuideColor?: string;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_PAGE_WIDTH_TWIPS = 12240; // 8.5 inches
const DEFAULT_PAGE_HEIGHT_TWIPS = 15840; // 11 inches
const DEFAULT_MARGIN_TWIPS = 1440; // 1 inch
const DEFAULT_HEADER_FOOTER_DISTANCE = 720; // 0.5 inches

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Page component - renders a single page
 */
export function Page({
  page,
  theme,
  className,
  style: additionalStyle,
  zoom = 1,
  showShadow = true,
  showMarginGuides = false,
  marginGuideColor,
  renderParagraph,
  renderTable,
  renderHeader,
  renderFooter,
  onClick,
}: PageProps): React.ReactElement {
  const { sectionProps, pageNumber, content, header, footer } = page;

  // Calculate dimensions
  const pageWidth = page.widthPx * zoom;
  const pageHeight = page.heightPx * zoom;

  // Build class names
  const classNames: string[] = ['docx-page'];
  if (page.isFirstPageOfSection) {
    classNames.push('docx-page-first');
  }
  if (page.isLastPage) {
    classNames.push('docx-page-last');
  }
  if (className) {
    classNames.push(className);
  }

  // Build page style
  const pageStyle = buildPageStyle(sectionProps, theme, zoom, showShadow);
  const combinedStyle: CSSProperties = {
    ...pageStyle,
    ...additionalStyle,
    width: formatPx(pageWidth),
    height: formatPx(pageHeight),
  };

  // Handle click
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e, page);
    }
  };

  return (
    <div
      className={classNames.join(' ')}
      style={combinedStyle}
      data-page-number={pageNumber}
      onClick={handleClick}
      role="region"
      aria-label={`Page ${pageNumber}`}
    >
      {/* Header area */}
      {header && (
        <div
          className="docx-page-header-area"
          style={buildHeaderAreaStyle(sectionProps, zoom)}
        >
          {renderHeader ? renderHeader(header) : renderDefaultHeader(header)}
        </div>
      )}

      {/* Content area */}
      <div
        className="docx-page-content"
        style={buildContentAreaStyle(sectionProps, zoom)}
      >
        {content.map((item, index) => {
          if (item.type === 'paragraph') {
            return (
              <div
                key={`content-${index}`}
                className="docx-page-block docx-page-paragraph"
                style={{
                  position: 'absolute',
                  top: formatPx(item.y * zoom),
                  left: 0,
                  right: 0,
                }}
              >
                {renderParagraph
                  ? renderParagraph(item.block as Paragraph, item.blockIndex, item)
                  : renderDefaultParagraph(item.block as Paragraph)}
              </div>
            );
          } else if (item.type === 'table') {
            return (
              <div
                key={`content-${index}`}
                className="docx-page-block docx-page-table"
                style={{
                  position: 'absolute',
                  top: formatPx(item.y * zoom),
                  left: 0,
                  right: 0,
                }}
              >
                {renderTable
                  ? renderTable(item.block as Table, item.blockIndex, item)
                  : renderDefaultTable(item.block as Table)}
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* Footer area */}
      {footer && (
        <div
          className="docx-page-footer-area"
          style={buildFooterAreaStyle(sectionProps, zoom)}
        >
          {renderFooter ? renderFooter(footer) : renderDefaultFooter(footer)}
        </div>
      )}

      {/* Margin guides */}
      {showMarginGuides && (
        <PageMarginGuides sectionProps={sectionProps} zoom={zoom} color={marginGuideColor} />
      )}

      {/* Page borders */}
      {sectionProps.pageBorders && (
        <PageBorders borders={sectionProps.pageBorders} theme={theme} zoom={zoom} />
      )}
    </div>
  );
}

/**
 * Simple page component for standalone rendering
 */
export function SimplePage({
  pageNumber,
  widthTwips = DEFAULT_PAGE_WIDTH_TWIPS,
  heightTwips = DEFAULT_PAGE_HEIGHT_TWIPS,
  sectionProps,
  theme,
  children,
  header,
  footer,
  className,
  style: additionalStyle,
  zoom = 1,
  showShadow = true,
  showMarginGuides = false,
  marginGuideColor,
}: SimplePageProps): React.ReactElement {
  const effectiveSectionProps: SectionProperties = sectionProps ?? {
    pageSize: {
      width: widthTwips,
      height: heightTwips,
      orientation: 'portrait',
    },
    pageMargins: {
      top: DEFAULT_MARGIN_TWIPS,
      bottom: DEFAULT_MARGIN_TWIPS,
      left: DEFAULT_MARGIN_TWIPS,
      right: DEFAULT_MARGIN_TWIPS,
      header: DEFAULT_HEADER_FOOTER_DISTANCE,
      footer: DEFAULT_HEADER_FOOTER_DISTANCE,
      gutter: 0,
    },
  };

  const pageWidth = twipsToPixels(widthTwips) * zoom;
  const pageHeight = twipsToPixels(heightTwips) * zoom;

  // Build class names
  const classNames: string[] = ['docx-page'];
  if (className) {
    classNames.push(className);
  }

  // Build page style
  const pageStyle = buildPageStyle(effectiveSectionProps, theme, zoom, showShadow);
  const combinedStyle: CSSProperties = {
    ...pageStyle,
    ...additionalStyle,
    width: formatPx(pageWidth),
    height: formatPx(pageHeight),
  };

  return (
    <div
      className={classNames.join(' ')}
      style={combinedStyle}
      data-page-number={pageNumber}
      role="region"
      aria-label={pageNumber ? `Page ${pageNumber}` : 'Page'}
    >
      {/* Header area */}
      {header && (
        <div
          className="docx-page-header-area"
          style={buildHeaderAreaStyle(effectiveSectionProps, zoom)}
        >
          {header}
        </div>
      )}

      {/* Content area */}
      <div
        className="docx-page-content"
        style={buildContentAreaStyle(effectiveSectionProps, zoom)}
      >
        {children}
      </div>

      {/* Footer area */}
      {footer && (
        <div
          className="docx-page-footer-area"
          style={buildFooterAreaStyle(effectiveSectionProps, zoom)}
        >
          {footer}
        </div>
      )}

      {/* Margin guides */}
      {showMarginGuides && (
        <PageMarginGuides sectionProps={effectiveSectionProps} zoom={zoom} color={marginGuideColor} />
      )}
    </div>
  );
}

// ============================================================================
// PAGE MARGIN GUIDES
// ============================================================================

/**
 * Default color for margin guides
 */
const DEFAULT_MARGIN_GUIDE_COLOR = '#c0c0c0';

interface PageMarginGuidesProps {
  sectionProps: SectionProperties;
  zoom: number;
  color?: string;
}

/**
 * PageMarginGuides component - renders dotted lines showing margin boundaries
 */
function PageMarginGuides({ sectionProps, zoom, color = DEFAULT_MARGIN_GUIDE_COLOR }: PageMarginGuidesProps): React.ReactElement {
  const margins = sectionProps.pageMargins ?? {};
  const topMargin = margins.top ?? DEFAULT_MARGIN_TWIPS;
  const bottomMargin = margins.bottom ?? DEFAULT_MARGIN_TWIPS;
  const leftMargin = margins.left ?? DEFAULT_MARGIN_TWIPS;
  const rightMargin = margins.right ?? DEFAULT_MARGIN_TWIPS;

  // Convert to pixels
  const topPx = twipsToPixels(topMargin) * zoom;
  const bottomPx = twipsToPixels(bottomMargin) * zoom;
  const leftPx = twipsToPixels(leftMargin) * zoom;
  const rightPx = twipsToPixels(rightMargin) * zoom;

  // Common style for guide lines
  const guideLineStyle: CSSProperties = {
    position: 'absolute',
    borderColor: color,
    borderStyle: 'dashed',
    borderWidth: 0,
    pointerEvents: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div
      className="docx-page-margin-guides"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Top margin line (horizontal) */}
      <div
        className="docx-margin-guide docx-margin-guide-top"
        style={{
          ...guideLineStyle,
          top: formatPx(topPx),
          left: 0,
          right: 0,
          height: 0,
          borderTopWidth: 1,
        }}
      />

      {/* Bottom margin line (horizontal) */}
      <div
        className="docx-margin-guide docx-margin-guide-bottom"
        style={{
          ...guideLineStyle,
          bottom: formatPx(bottomPx),
          left: 0,
          right: 0,
          height: 0,
          borderTopWidth: 1,
        }}
      />

      {/* Left margin line (vertical) */}
      <div
        className="docx-margin-guide docx-margin-guide-left"
        style={{
          ...guideLineStyle,
          top: 0,
          bottom: 0,
          left: formatPx(leftPx),
          width: 0,
          borderLeftWidth: 1,
        }}
      />

      {/* Right margin line (vertical) */}
      <div
        className="docx-margin-guide docx-margin-guide-right"
        style={{
          ...guideLineStyle,
          top: 0,
          bottom: 0,
          right: formatPx(rightPx),
          width: 0,
          borderLeftWidth: 1,
        }}
      />

      {/* Corner markers for better visibility */}
      <MarginCorner position="top-left" top={topPx} left={leftPx} color={color} />
      <MarginCorner position="top-right" top={topPx} right={rightPx} color={color} />
      <MarginCorner position="bottom-left" bottom={bottomPx} left={leftPx} color={color} />
      <MarginCorner position="bottom-right" bottom={bottomPx} right={rightPx} color={color} />
    </div>
  );
}

interface MarginCornerProps {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  color: string;
}

/**
 * Small corner marker showing where margins intersect
 */
function MarginCorner({ position, top, bottom, left, right, color }: MarginCornerProps): React.ReactElement {
  const size = 6; // Corner marker size in pixels

  const style: CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    pointerEvents: 'none',
  };

  // Position the corner marker at the intersection
  if (top !== undefined) {
    style.top = formatPx(top - size / 2);
  }
  if (bottom !== undefined) {
    style.bottom = formatPx(bottom - size / 2);
  }
  if (left !== undefined) {
    style.left = formatPx(left - size / 2);
  }
  if (right !== undefined) {
    style.right = formatPx(right - size / 2);
  }

  // Draw corner lines based on position
  let borderStyle = '';
  switch (position) {
    case 'top-left':
      borderStyle = `border-top: 1px solid ${color}; border-left: 1px solid ${color};`;
      break;
    case 'top-right':
      borderStyle = `border-top: 1px solid ${color}; border-right: 1px solid ${color};`;
      break;
    case 'bottom-left':
      borderStyle = `border-bottom: 1px solid ${color}; border-left: 1px solid ${color};`;
      break;
    case 'bottom-right':
      borderStyle = `border-bottom: 1px solid ${color}; border-right: 1px solid ${color};`;
      break;
  }

  return (
    <div
      className={`docx-margin-corner docx-margin-corner-${position}`}
      style={style}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          ...(position === 'top-left' && { borderTop: `1px solid ${color}`, borderLeft: `1px solid ${color}` }),
          ...(position === 'top-right' && { borderTop: `1px solid ${color}`, borderRight: `1px solid ${color}` }),
          ...(position === 'bottom-left' && { borderBottom: `1px solid ${color}`, borderLeft: `1px solid ${color}` }),
          ...(position === 'bottom-right' && { borderBottom: `1px solid ${color}`, borderRight: `1px solid ${color}` }),
        }}
      />
    </div>
  );
}

// ============================================================================
// PAGE BORDERS
// ============================================================================

interface PageBordersProps {
  borders: SectionProperties['pageBorders'];
  theme?: Theme | null;
  zoom: number;
}

function PageBorders({ borders, theme, zoom }: PageBordersProps): React.ReactElement | null {
  if (!borders) return null;

  const style: CSSProperties = {
    position: 'absolute',
    pointerEvents: 'none',
    boxSizing: 'border-box',
  };

  // Position based on offsetFrom
  if (borders.offsetFrom === 'text') {
    // Border is at text margin
    // Would need content area dimensions
  } else {
    // Border is at page edge
    style.top = 0;
    style.left = 0;
    style.right = 0;
    style.bottom = 0;
  }

  // Apply borders
  if (borders.top) {
    style.borderTopWidth = formatPx(twipsToPixels(borders.top.width ?? 8) * zoom);
    style.borderTopStyle = borders.top.style || 'solid';
    style.borderTopColor = borders.top.color
      ? resolveColor(borders.top.color, theme, '#000000')
      : '#000000';
  }

  if (borders.bottom) {
    style.borderBottomWidth = formatPx(twipsToPixels(borders.bottom.width ?? 8) * zoom);
    style.borderBottomStyle = borders.bottom.style || 'solid';
    style.borderBottomColor = borders.bottom.color
      ? resolveColor(borders.bottom.color, theme, '#000000')
      : '#000000';
  }

  if (borders.left) {
    style.borderLeftWidth = formatPx(twipsToPixels(borders.left.width ?? 8) * zoom);
    style.borderLeftStyle = borders.left.style || 'solid';
    style.borderLeftColor = borders.left.color
      ? resolveColor(borders.left.color, theme, '#000000')
      : '#000000';
  }

  if (borders.right) {
    style.borderRightWidth = formatPx(twipsToPixels(borders.right.width ?? 8) * zoom);
    style.borderRightStyle = borders.right.style || 'solid';
    style.borderRightColor = borders.right.color
      ? resolveColor(borders.right.color, theme, '#000000')
      : '#000000';
  }

  return <div className="docx-page-borders" style={style} />;
}

// ============================================================================
// STYLE BUILDERS
// ============================================================================

/**
 * Build page container style
 */
function buildPageStyle(
  sectionProps: SectionProperties,
  theme: Theme | null | undefined,
  zoom: number,
  showShadow: boolean
): CSSProperties {
  const style: CSSProperties = {
    position: 'relative',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
    overflow: 'hidden',
  };

  // Page shadow
  if (showShadow) {
    style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)';
  }

  // Page background
  if (sectionProps.background) {
    if (sectionProps.background.color) {
      style.backgroundColor = resolveColor(sectionProps.background.color, theme, '#ffffff');
    }
  }

  return style;
}

/**
 * Build header area style
 */
function buildHeaderAreaStyle(sectionProps: SectionProperties, zoom: number): CSSProperties {
  const margins = sectionProps.pageMargins ?? {};
  const headerDistance = margins.header ?? DEFAULT_HEADER_FOOTER_DISTANCE;
  const topMargin = margins.top ?? DEFAULT_MARGIN_TWIPS;
  const leftMargin = margins.left ?? DEFAULT_MARGIN_TWIPS;
  const rightMargin = margins.right ?? DEFAULT_MARGIN_TWIPS;

  return {
    position: 'absolute',
    top: formatPx(twipsToPixels(headerDistance) * zoom),
    left: formatPx(twipsToPixels(leftMargin) * zoom),
    right: formatPx(twipsToPixels(rightMargin) * zoom),
    height: formatPx(twipsToPixels(topMargin - headerDistance) * zoom),
    overflow: 'hidden',
    boxSizing: 'border-box',
  };
}

/**
 * Build content area style
 */
function buildContentAreaStyle(sectionProps: SectionProperties, zoom: number): CSSProperties {
  const margins = sectionProps.pageMargins ?? {};
  const topMargin = margins.top ?? DEFAULT_MARGIN_TWIPS;
  const bottomMargin = margins.bottom ?? DEFAULT_MARGIN_TWIPS;
  const leftMargin = margins.left ?? DEFAULT_MARGIN_TWIPS;
  const rightMargin = margins.right ?? DEFAULT_MARGIN_TWIPS;

  return {
    position: 'absolute',
    top: formatPx(twipsToPixels(topMargin) * zoom),
    left: formatPx(twipsToPixels(leftMargin) * zoom),
    right: formatPx(twipsToPixels(rightMargin) * zoom),
    bottom: formatPx(twipsToPixels(bottomMargin) * zoom),
    overflow: 'hidden',
    boxSizing: 'border-box',
  };
}

/**
 * Build footer area style
 */
function buildFooterAreaStyle(sectionProps: SectionProperties, zoom: number): CSSProperties {
  const margins = sectionProps.pageMargins ?? {};
  const footerDistance = margins.footer ?? DEFAULT_HEADER_FOOTER_DISTANCE;
  const bottomMargin = margins.bottom ?? DEFAULT_MARGIN_TWIPS;
  const leftMargin = margins.left ?? DEFAULT_MARGIN_TWIPS;
  const rightMargin = margins.right ?? DEFAULT_MARGIN_TWIPS;

  return {
    position: 'absolute',
    bottom: formatPx(twipsToPixels(footerDistance) * zoom),
    left: formatPx(twipsToPixels(leftMargin) * zoom),
    right: formatPx(twipsToPixels(rightMargin) * zoom),
    height: formatPx(twipsToPixels(bottomMargin - footerDistance) * zoom),
    overflow: 'hidden',
    boxSizing: 'border-box',
  };
}

// ============================================================================
// DEFAULT RENDERERS
// ============================================================================

/**
 * Default header renderer
 */
function renderDefaultHeader(header: HeaderFooterType): ReactNode {
  return (
    <div className="docx-page-header-default">
      {header.content.map((block, index) => {
        if (block.type === 'paragraph') {
          return (
            <div key={index} className="docx-hf-para">
              {getBlockText(block)}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

/**
 * Default footer renderer
 */
function renderDefaultFooter(footer: HeaderFooterType): ReactNode {
  return (
    <div className="docx-page-footer-default">
      {footer.content.map((block, index) => {
        if (block.type === 'paragraph') {
          return (
            <div key={index} className="docx-hf-para">
              {getBlockText(block)}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

/**
 * Default paragraph renderer
 */
function renderDefaultParagraph(paragraph: Paragraph): ReactNode {
  return (
    <div className="docx-para-default">
      {getBlockText(paragraph)}
    </div>
  );
}

/**
 * Default table renderer
 */
function renderDefaultTable(table: Table): ReactNode {
  return (
    <div className="docx-table-default">
      [Table with {table.rows.length} rows]
    </div>
  );
}

/**
 * Get plain text from block
 */
function getBlockText(block: Paragraph | Table): string {
  if (block.type === 'paragraph') {
    const parts: string[] = [];
    for (const content of block.content) {
      if (content.type === 'run') {
        for (const item of content.content) {
          if (item.type === 'text') {
            parts.push(item.text);
          }
        }
      }
    }
    return parts.join('') || '\u00A0';
  }
  return '[Table]';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get page dimensions in pixels
 */
export function getPageDimensionsPx(
  sectionProps?: SectionProperties,
  zoom: number = 1
): { width: number; height: number } {
  const width = sectionProps?.pageSize?.width ?? DEFAULT_PAGE_WIDTH_TWIPS;
  const height = sectionProps?.pageSize?.height ?? DEFAULT_PAGE_HEIGHT_TWIPS;

  return {
    width: twipsToPixels(width) * zoom,
    height: twipsToPixels(height) * zoom,
  };
}

/**
 * Get content area dimensions in pixels
 */
export function getContentAreaPx(
  sectionProps?: SectionProperties,
  zoom: number = 1
): { width: number; height: number; top: number; left: number } {
  const pageWidth = sectionProps?.pageSize?.width ?? DEFAULT_PAGE_WIDTH_TWIPS;
  const pageHeight = sectionProps?.pageSize?.height ?? DEFAULT_PAGE_HEIGHT_TWIPS;
  const margins = sectionProps?.pageMargins ?? {};

  const topMargin = margins.top ?? DEFAULT_MARGIN_TWIPS;
  const bottomMargin = margins.bottom ?? DEFAULT_MARGIN_TWIPS;
  const leftMargin = margins.left ?? DEFAULT_MARGIN_TWIPS;
  const rightMargin = margins.right ?? DEFAULT_MARGIN_TWIPS;

  return {
    width: twipsToPixels(pageWidth - leftMargin - rightMargin) * zoom,
    height: twipsToPixels(pageHeight - topMargin - bottomMargin) * zoom,
    top: twipsToPixels(topMargin) * zoom,
    left: twipsToPixels(leftMargin) * zoom,
  };
}

/**
 * Check if page is landscape
 */
export function isLandscape(sectionProps?: SectionProperties): boolean {
  return sectionProps?.pageSize?.orientation === 'landscape';
}

/**
 * Get standard page size name
 */
export function getPageSizeName(sectionProps?: SectionProperties): string {
  const width = sectionProps?.pageSize?.width ?? DEFAULT_PAGE_WIDTH_TWIPS;
  const height = sectionProps?.pageSize?.height ?? DEFAULT_PAGE_HEIGHT_TWIPS;

  // Standard sizes (in twips, portrait)
  if (width === 12240 && height === 15840) return 'Letter';
  if (width === 12240 && height === 20160) return 'Legal';
  if (width === 11906 && height === 16838) return 'A4';
  if (width === 8391 && height === 11906) return 'A5';

  return 'Custom';
}

export default Page;
