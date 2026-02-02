/**
 * HeaderFooter Component
 *
 * Renders headers and footers from DOCX documents.
 * Supports:
 * - Paragraphs with all formatting
 * - Tables within headers/footers
 * - Images and shapes
 * - Page number and total pages fields
 * - Different header/footer types (default, first, even)
 */

import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  HeaderFooter as HeaderFooterType,
  HeaderFooterType as HFType,
  Theme,
  Paragraph,
  Table,
  SectionProperties,
} from '../../types/document';
import { twipsToPixels, formatPx } from '../../utils/units';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for the HeaderFooter component
 */
export interface HeaderFooterProps {
  /** The header/footer data to render */
  headerFooter: HeaderFooterType;
  /** Type: 'header' or 'footer' */
  position: 'header' | 'footer';
  /** Section properties for positioning (margins, distances) */
  sectionProps?: SectionProperties | null;
  /** Theme for resolving colors and fonts */
  theme?: Theme | null;
  /** Current page number (for PAGE field) */
  pageNumber?: number;
  /** Total page count (for NUMPAGES field) */
  totalPages?: number;
  /** Page width in pixels (for content width calculation) */
  pageWidthPx?: number;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Render function for paragraph content */
  renderParagraph?: (paragraph: Paragraph, index: number) => ReactNode;
  /** Render function for tables */
  renderTable?: (table: Table, index: number) => ReactNode;
}

/**
 * Props for the HeaderArea component (container)
 */
export interface HeaderAreaProps {
  /** Header content to render */
  header: HeaderFooterType | null | undefined;
  /** Section properties for positioning */
  sectionProps?: SectionProperties | null;
  /** Theme for resolving colors and fonts */
  theme?: Theme | null;
  /** Current page number */
  pageNumber?: number;
  /** Total page count */
  totalPages?: number;
  /** Page width in pixels */
  pageWidthPx?: number;
  /** Additional CSS class name */
  className?: string;
  /** Render function for paragraph content */
  renderParagraph?: (paragraph: Paragraph, index: number) => ReactNode;
  /** Render function for tables */
  renderTable?: (table: Table, index: number) => ReactNode;
}

/**
 * Props for the FooterArea component (container)
 */
export interface FooterAreaProps extends Omit<HeaderAreaProps, 'header'> {
  /** Footer content to render */
  footer: HeaderFooterType | null | undefined;
  /** Header is not used in FooterAreaProps */
  header?: undefined;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * HeaderFooter component - renders header or footer content
 */
export function HeaderFooter({
  headerFooter,
  position,
  sectionProps,
  theme: _theme,
  pageNumber: _pageNumber,
  totalPages: _totalPages,
  pageWidthPx,
  className,
  style: additionalStyle,
  renderParagraph,
  renderTable,
}: HeaderFooterProps): React.ReactElement {
  // Build class names
  const classNames: string[] = ['docx-header-footer', `docx-${position}`];
  if (headerFooter.type) {
    classNames.push(`docx-${position}-${headerFooter.type}`);
  }
  if (className) {
    classNames.push(className);
  }

  // Calculate positioning
  const positionStyles = getPositionStyles(position, sectionProps);

  // Build final style
  const style: CSSProperties = {
    ...positionStyles,
    ...additionalStyle,
  };

  // If page width provided, set content width
  if (pageWidthPx) {
    style.width = formatPx(pageWidthPx);
  }

  // Render content
  return (
    <div
      className={classNames.join(' ')}
      style={style}
      data-position={position}
      data-type={headerFooter.type || 'default'}
      role="region"
      aria-label={position === 'header' ? 'Page header' : 'Page footer'}
    >
      {headerFooter.content.map((block, index) => {
        if (block.type === 'paragraph') {
          if (renderParagraph) {
            return (
              <React.Fragment key={`${position}-para-${index}`}>
                {renderParagraph(block, index)}
              </React.Fragment>
            );
          }
          // Default: render placeholder
          return (
            <div key={`${position}-para-${index}`} className="docx-hf-paragraph">
              {getBlockText(block)}
            </div>
          );
        } else if (block.type === 'table') {
          if (renderTable) {
            return (
              <React.Fragment key={`${position}-table-${index}`}>
                {renderTable(block, index)}
              </React.Fragment>
            );
          }
          // Default: render placeholder
          return (
            <div key={`${position}-table-${index}`} className="docx-hf-table">
              [Table]
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

// ============================================================================
// AREA COMPONENTS
// ============================================================================

/**
 * HeaderArea component - container for header positioned at top of page
 */
export function HeaderArea({
  header,
  sectionProps,
  theme,
  pageNumber,
  totalPages,
  pageWidthPx,
  className,
  renderParagraph,
  renderTable,
}: HeaderAreaProps): React.ReactElement | null {
  if (!header) {
    return null;
  }

  // Calculate header distance from top
  const headerDistance = sectionProps?.headerDistance ?? 720; // Default 0.5 inch
  const topMargin = sectionProps?.marginTop ?? 1440; // Default 1 inch

  // Header container style
  const containerStyle: CSSProperties = {
    position: 'absolute',
    top: formatPx(twipsToPixels(headerDistance)),
    left: formatPx(twipsToPixels(sectionProps?.marginLeft ?? 1440)),
    right: formatPx(twipsToPixels(sectionProps?.marginRight ?? 1440)),
    height: formatPx(twipsToPixels(topMargin - headerDistance)),
    overflow: 'hidden',
    boxSizing: 'border-box',
  };

  const classNames = ['docx-header-area'];
  if (className) {
    classNames.push(className);
  }

  return (
    <div className={classNames.join(' ')} style={containerStyle}>
      <HeaderFooter
        headerFooter={header}
        position="header"
        sectionProps={sectionProps}
        theme={theme}
        pageNumber={pageNumber}
        totalPages={totalPages}
        pageWidthPx={pageWidthPx}
        renderParagraph={renderParagraph}
        renderTable={renderTable}
      />
    </div>
  );
}

/**
 * FooterArea component - container for footer positioned at bottom of page
 */
export function FooterArea({
  footer,
  sectionProps,
  theme,
  pageNumber,
  totalPages,
  pageWidthPx,
  className,
  renderParagraph,
  renderTable,
}: Omit<FooterAreaProps, 'header'>): React.ReactElement | null {
  if (!footer) {
    return null;
  }

  // Calculate footer distance from bottom
  const footerDistance = sectionProps?.footerDistance ?? 720; // Default 0.5 inch
  const bottomMargin = sectionProps?.marginBottom ?? 1440; // Default 1 inch

  // Footer container style
  const containerStyle: CSSProperties = {
    position: 'absolute',
    bottom: formatPx(twipsToPixels(footerDistance)),
    left: formatPx(twipsToPixels(sectionProps?.marginLeft ?? 1440)),
    right: formatPx(twipsToPixels(sectionProps?.marginRight ?? 1440)),
    height: formatPx(twipsToPixels(bottomMargin - footerDistance)),
    overflow: 'hidden',
    boxSizing: 'border-box',
  };

  const classNames = ['docx-footer-area'];
  if (className) {
    classNames.push(className);
  }

  return (
    <div className={classNames.join(' ')} style={containerStyle}>
      <HeaderFooter
        headerFooter={footer}
        position="footer"
        sectionProps={sectionProps}
        theme={theme}
        pageNumber={pageNumber}
        totalPages={totalPages}
        pageWidthPx={pageWidthPx}
        renderParagraph={renderParagraph}
        renderTable={renderTable}
      />
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get position styles for header/footer
 */
function getPositionStyles(
  position: 'header' | 'footer',
  sectionProps: SectionProperties | null | undefined
): CSSProperties {
  const style: CSSProperties = {
    boxSizing: 'border-box',
  };

  // Set min-height based on section properties
  if (position === 'header') {
    const headerDistance = sectionProps?.headerDistance ?? 720;
    const topMargin = sectionProps?.marginTop ?? 1440;
    style.minHeight = formatPx(twipsToPixels(topMargin - headerDistance));
  } else {
    const footerDistance = sectionProps?.footerDistance ?? 720;
    const bottomMargin = sectionProps?.marginBottom ?? 1440;
    style.minHeight = formatPx(twipsToPixels(bottomMargin - footerDistance));
  }

  return style;
}

/**
 * Extract plain text from a block element (simplified)
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

/**
 * Determine which header to use for a given page
 *
 * @param pageNumber - Current page number (1-indexed)
 * @param isFirstPage - Whether this is the first page of the section
 * @param headers - Map of header type to content
 * @param sectionProps - Section properties
 * @returns The appropriate header, or null if none
 */
export function getHeaderForPage(
  pageNumber: number,
  isFirstPage: boolean,
  headers: Map<HFType, HeaderFooterType>,
  sectionProps?: SectionProperties | null
): HeaderFooterType | null {
  // First page header (if enabled and available)
  if (isFirstPage && sectionProps?.titlePg && headers.has('first')) {
    return headers.get('first') || null;
  }

  // Even/odd page headers (if enabled)
  if (sectionProps?.evenAndOddHeaders) {
    const isEvenPage = pageNumber % 2 === 0;
    if (isEvenPage && headers.has('even')) {
      return headers.get('even') || null;
    }
    // Odd pages use default
    return headers.get('default') || null;
  }

  // Default header
  return headers.get('default') || null;
}

/**
 * Determine which footer to use for a given page
 */
export function getFooterForPage(
  pageNumber: number,
  isFirstPage: boolean,
  footers: Map<HFType, HeaderFooterType>,
  sectionProps?: SectionProperties | null
): HeaderFooterType | null {
  // First page footer (if enabled and available)
  if (isFirstPage && sectionProps?.titlePg && footers.has('first')) {
    return footers.get('first') || null;
  }

  // Even/odd page footers (if enabled)
  if (sectionProps?.evenAndOddHeaders) {
    const isEvenPage = pageNumber % 2 === 0;
    if (isEvenPage && footers.has('even')) {
      return footers.get('even') || null;
    }
    // Odd pages use default
    return footers.get('default') || null;
  }

  // Default footer
  return footers.get('default') || null;
}

/**
 * Check if header/footer has any content
 */
export function hasContent(hf: HeaderFooterType | null | undefined): boolean {
  if (!hf) return false;
  if (hf.content.length === 0) return false;

  // Check if any content block has actual content
  return hf.content.some((block) => {
    if (block.type === 'paragraph') {
      return block.content.length > 0;
    }
    if (block.type === 'table') {
      return true; // Tables always count as content
    }
    return false;
  });
}

/**
 * Check if header/footer contains page number fields
 */
export function hasPageNumberField(hf: HeaderFooterType | null | undefined): boolean {
  if (!hf) return false;

  for (const block of hf.content) {
    if (block.type === 'paragraph') {
      for (const content of block.content) {
        if (content.type === 'run') {
          for (const item of content.content) {
            // Check for field char content (complex fields)
            if (item.type === 'fieldChar' && item.charType === 'begin') {
              // This might be a PAGE field
              return true;
            }
          }
        }
        // Check for simple fields
        if (content.type === 'simpleField') {
          const fieldType = content.fieldType?.toUpperCase();
          if (fieldType === 'PAGE' || fieldType === 'NUMPAGES') {
            return true;
          }
        }
        // Check for complex fields
        if (content.type === 'complexField') {
          const fieldType = content.fieldType?.toUpperCase();
          if (fieldType === 'PAGE' || fieldType === 'NUMPAGES') {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Get plain text content from header/footer
 */
export function getHeaderFooterText(hf: HeaderFooterType | null | undefined): string {
  if (!hf) return '';

  const parts: string[] = [];

  for (const block of hf.content) {
    if (block.type === 'paragraph') {
      parts.push(getBlockText(block));
    }
  }

  return parts.join('\n').trim();
}

/**
 * Check if header/footer contains images
 */
export function hasImages(hf: HeaderFooterType | null | undefined): boolean {
  if (!hf) return false;

  for (const block of hf.content) {
    if (block.type === 'paragraph') {
      for (const content of block.content) {
        if (content.type === 'run') {
          for (const item of content.content) {
            if (item.type === 'drawing' || item.type === 'shape') {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

/**
 * Check if header/footer contains tables
 */
export function hasTables(hf: HeaderFooterType | null | undefined): boolean {
  if (!hf) return false;
  return hf.content.some((block) => block.type === 'table');
}

/**
 * Create header/footer content map from arrays
 */
export function createHeaderFooterMap(
  items: HeaderFooterType[] | null | undefined
): Map<HFType, HeaderFooterType> {
  const map = new Map<HFType, HeaderFooterType>();

  if (!items) return map;

  for (const item of items) {
    const type = item.hdrFtrType || 'default';
    map.set(type, item);
  }

  return map;
}

/**
 * Check if section has any headers
 */
export function hasHeaders(
  headers: Map<HFType, HeaderFooterType> | HeaderFooterType[] | null | undefined
): boolean {
  if (!headers) return false;

  if (Array.isArray(headers)) {
    return headers.length > 0;
  }

  return headers.size > 0;
}

/**
 * Check if section has any footers
 */
export function hasFooters(
  footers: Map<HFType, HeaderFooterType> | HeaderFooterType[] | null | undefined
): boolean {
  if (!footers) return false;

  if (Array.isArray(footers)) {
    return footers.length > 0;
  }

  return footers.size > 0;
}

/**
 * Get all header types present in a map
 */
export function getHeaderTypes(
  headers: Map<HFType, HeaderFooterType> | null | undefined
): HFType[] {
  if (!headers) return [];
  return Array.from(headers.keys());
}

/**
 * Get all footer types present in a map
 */
export function getFooterTypes(
  footers: Map<HFType, HeaderFooterType> | null | undefined
): HFType[] {
  if (!footers) return [];
  return Array.from(footers.keys());
}

export default HeaderFooter;
