/**
 * Page Layout Engine
 *
 * Distributes document content across pages based on:
 * - Page size and margins
 * - Explicit page breaks
 * - Natural page breaks (content overflow)
 * - Headers and footers
 * - Keep-with-next, keep-lines-together constraints
 */

import type {
  Document,
  DocumentBody,
  Section,
  SectionProperties,
  Paragraph,
  Table,
  BlockContent,
  HeaderFooter,
  HeaderFooterType,
  Theme,
} from '../types/document';
import { twipsToPixels } from '../utils/units';
import { breakIntoLines, type Line, type LineBreakResult } from './lineBreaker';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A laid out page
 */
export interface Page {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Section this page belongs to */
  sectionIndex: number;
  /** Section properties for this page */
  sectionProps: SectionProperties;
  /** Content blocks on this page */
  content: PageContent[];
  /** Header for this page (if any) */
  header: HeaderFooter | null;
  /** Footer for this page (if any) */
  footer: HeaderFooter | null;
  /** Whether this is the first page of its section */
  isFirstPageOfSection: boolean;
  /** Whether this is the last page of the document */
  isLastPage: boolean;
  /** Page width in pixels */
  widthPx: number;
  /** Page height in pixels */
  heightPx: number;
  /** Content area width in pixels */
  contentWidthPx: number;
  /** Content area height in pixels */
  contentHeightPx: number;
  /** Content area top offset */
  contentTopPx: number;
  /** Content area left offset */
  contentLeftPx: number;
}

/**
 * Content positioned on a page
 */
export interface PageContent {
  /** Type of content */
  type: 'paragraph' | 'table';
  /** The original block */
  block: Paragraph | Table;
  /** Block index in the document */
  blockIndex: number;
  /** Y position on the page (relative to content area) */
  y: number;
  /** Height of this content */
  height: number;
  /** Whether this block continues from previous page */
  isContinuation: boolean;
  /** Whether this block continues on next page */
  continuesOnNextPage: boolean;
  /** Lines for paragraphs (if laid out) */
  lines?: Line[];
  /** First line index if continuation */
  startLineIndex?: number;
}

/**
 * Options for page layout
 */
export interface PageLayoutOptions {
  /** Theme for font resolution */
  theme?: Theme | null;
  /** Headers by type for each section */
  headers?: Map<number, Map<HeaderFooterType, HeaderFooter>>;
  /** Footers by type for each section */
  footers?: Map<number, Map<HeaderFooterType, HeaderFooter>>;
  /** Whether to update page number fields */
  updatePageNumbers?: boolean;
}

/**
 * Result of page layout
 */
export interface PageLayoutResult {
  /** All pages */
  pages: Page[];
  /** Total page count */
  totalPages: number;
  /** Page number field values by location */
  pageNumberFields?: Map<string, number>;
}

/**
 * Internal state for layout
 */
interface LayoutState {
  /** Current page number (1-indexed) */
  pageNumber: number;
  /** Current Y position on page */
  y: number;
  /** Remaining height on current page */
  remainingHeight: number;
  /** Current section index */
  sectionIndex: number;
  /** Content accumulated for current page */
  pageContent: PageContent[];
  /** All completed pages */
  pages: Page[];
  /** Current section properties */
  sectionProps: SectionProperties;
  /** Whether current page is first of section */
  isFirstPageOfSection: boolean;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Calculate page layout for a document
 *
 * @param doc - The document to lay out
 * @param options - Layout options
 * @returns Page layout result with all pages
 */
export function calculatePages(
  doc: Document,
  options: PageLayoutOptions = {}
): PageLayoutResult {
  const { theme, headers, footers, updatePageNumbers = true } = options;

  const body = doc.package.body;
  if (!body) {
    return { pages: [], totalPages: 0 };
  }

  // Process sections
  const sections = body.sections.length > 0
    ? body.sections
    : [{ properties: getDefaultSectionProps(), content: body.content }];

  // Initialize layout state
  let state = initializeState(sections[0].properties);

  // Process each section
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex];
    const sectionProps = section.properties || getDefaultSectionProps();

    // Check if we need to start a new page for this section
    if (sectionIndex > 0) {
      const sectionStart = sectionProps.sectionType || 'nextPage';
      if (shouldStartNewPage(sectionStart, state)) {
        state = finalizePage(state, headers, footers);
        state.sectionIndex = sectionIndex;
        state.sectionProps = sectionProps;
        state.isFirstPageOfSection = true;
        state = initializePageContent(state);
      }
    }

    // Process content in this section
    for (let blockIndex = 0; blockIndex < section.content.length; blockIndex++) {
      const block = section.content[blockIndex];
      state = layoutBlock(block, blockIndex, state, theme, headers, footers);
    }
  }

  // Finalize last page
  if (state.pageContent.length > 0) {
    state = finalizePage(state, headers, footers);
  }

  // Mark last page
  if (state.pages.length > 0) {
    state.pages[state.pages.length - 1].isLastPage = true;
  }

  return {
    pages: state.pages,
    totalPages: state.pages.length,
  };
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Initialize layout state for a section
 */
function initializeState(sectionProps: SectionProperties): LayoutState {
  const contentHeight = calculateContentHeight(sectionProps);

  return {
    pageNumber: 1,
    y: 0,
    remainingHeight: contentHeight,
    sectionIndex: 0,
    pageContent: [],
    pages: [],
    sectionProps,
    isFirstPageOfSection: true,
  };
}

/**
 * Initialize content area for a new page
 */
function initializePageContent(state: LayoutState): LayoutState {
  const contentHeight = calculateContentHeight(state.sectionProps);

  return {
    ...state,
    y: 0,
    remainingHeight: contentHeight,
    pageContent: [],
  };
}

/**
 * Finalize current page and start new one
 */
function finalizePage(
  state: LayoutState,
  headers?: Map<number, Map<HeaderFooterType, HeaderFooter>>,
  footers?: Map<number, Map<HeaderFooterType, HeaderFooter>>
): LayoutState {
  const { sectionProps, pageNumber, sectionIndex, isFirstPageOfSection } = state;

  // Get header and footer for this page
  const header = getHeaderForPage(
    pageNumber,
    isFirstPageOfSection,
    sectionIndex,
    headers,
    sectionProps
  );
  const footer = getFooterForPage(
    pageNumber,
    isFirstPageOfSection,
    sectionIndex,
    footers,
    sectionProps
  );

  // Calculate page dimensions
  const pageWidth = sectionProps.pageSize?.width ?? 12240; // Default 8.5"
  const pageHeight = sectionProps.pageSize?.height ?? 15840; // Default 11"
  const margins = sectionProps.pageMargins ?? {};

  const widthPx = twipsToPixels(pageWidth);
  const heightPx = twipsToPixels(pageHeight);
  const contentLeftPx = twipsToPixels(margins.left ?? 1440);
  const contentTopPx = twipsToPixels(margins.top ?? 1440);
  const contentWidthPx = widthPx - contentLeftPx - twipsToPixels(margins.right ?? 1440);
  const contentHeightPx = heightPx - contentTopPx - twipsToPixels(margins.bottom ?? 1440);

  // Create page
  const page: Page = {
    pageNumber,
    sectionIndex,
    sectionProps,
    content: state.pageContent,
    header,
    footer,
    isFirstPageOfSection,
    isLastPage: false,
    widthPx,
    heightPx,
    contentWidthPx,
    contentHeightPx,
    contentTopPx,
    contentLeftPx,
  };

  // Return new state
  const contentHeight = calculateContentHeight(sectionProps);

  return {
    ...state,
    pageNumber: pageNumber + 1,
    y: 0,
    remainingHeight: contentHeight,
    pageContent: [],
    pages: [...state.pages, page],
    isFirstPageOfSection: false,
  };
}

// ============================================================================
// BLOCK LAYOUT
// ============================================================================

/**
 * Layout a content block
 */
function layoutBlock(
  block: BlockContent,
  blockIndex: number,
  state: LayoutState,
  theme: Theme | null | undefined,
  headers?: Map<number, Map<HeaderFooterType, HeaderFooter>>,
  footers?: Map<number, Map<HeaderFooterType, HeaderFooter>>
): LayoutState {
  if (block.type === 'paragraph') {
    return layoutParagraph(block, blockIndex, state, theme, headers, footers);
  } else if (block.type === 'table') {
    return layoutTable(block, blockIndex, state, theme, headers, footers);
  }
  return state;
}

/**
 * Layout a paragraph
 */
function layoutParagraph(
  paragraph: Paragraph,
  blockIndex: number,
  state: LayoutState,
  theme: Theme | null | undefined,
  headers?: Map<number, Map<HeaderFooterType, HeaderFooter>>,
  footers?: Map<number, Map<HeaderFooterType, HeaderFooter>>
): LayoutState {
  let currentState = state;

  // Check for explicit page break before
  if (paragraph.formatting?.pageBreakBefore) {
    if (currentState.pageContent.length > 0) {
      currentState = finalizePage(currentState, headers, footers);
      currentState = initializePageContent(currentState);
    }
  }

  // Calculate paragraph height
  const contentWidth = calculateContentWidth(currentState.sectionProps);
  const firstLineIndent = paragraph.formatting?.indentation?.firstLine
    ? twipsToPixels(paragraph.formatting.indentation.firstLine)
    : 0;

  // Break paragraph into lines
  const lineResult = breakIntoLines(paragraph, {
    maxWidth: contentWidth,
    firstLineIndent,
    tabStops: paragraph.formatting?.tabs,
    theme,
    defaultFormatting: paragraph.defaultRunFormatting,
  });

  // Calculate spacing
  const spaceBefore = paragraph.formatting?.spacing?.spaceBefore
    ? twipsToPixels(paragraph.formatting.spacing.spaceBefore)
    : 0;
  const spaceAfter = paragraph.formatting?.spacing?.spaceAfter
    ? twipsToPixels(paragraph.formatting.spacing.spaceAfter)
    : 0;

  const totalHeight = spaceBefore + lineResult.totalHeight + spaceAfter;

  // Check if paragraph fits on current page
  if (totalHeight <= currentState.remainingHeight) {
    // Paragraph fits entirely
    currentState.pageContent.push({
      type: 'paragraph',
      block: paragraph,
      blockIndex,
      y: currentState.y + spaceBefore,
      height: totalHeight,
      isContinuation: false,
      continuesOnNextPage: false,
      lines: lineResult.lines,
    });

    currentState.y += totalHeight;
    currentState.remainingHeight -= totalHeight;
  } else {
    // Paragraph doesn't fit - need to break
    currentState = layoutParagraphAcrossPages(
      paragraph,
      blockIndex,
      lineResult,
      spaceBefore,
      spaceAfter,
      currentState,
      headers,
      footers
    );
  }

  return currentState;
}

/**
 * Layout a paragraph that spans multiple pages
 */
function layoutParagraphAcrossPages(
  paragraph: Paragraph,
  blockIndex: number,
  lineResult: LineBreakResult,
  spaceBefore: number,
  spaceAfter: number,
  state: LayoutState,
  headers?: Map<number, Map<HeaderFooterType, HeaderFooter>>,
  footers?: Map<number, Map<HeaderFooterType, HeaderFooter>>
): LayoutState {
  let currentState = state;
  let lineIndex = 0;
  let isFirstPart = true;
  const keepLines = paragraph.formatting?.keepLines ?? false;

  // If keepLines is true, try to keep paragraph together
  if (keepLines && lineResult.lines.length > 0) {
    // Start on new page if it won't fit
    if (currentState.pageContent.length > 0) {
      currentState = finalizePage(currentState, headers, footers);
      currentState = initializePageContent(currentState);
    }
  }

  while (lineIndex < lineResult.lines.length) {
    const availableHeight = currentState.remainingHeight - (isFirstPart ? spaceBefore : 0);
    const linesToFit: Line[] = [];
    let heightUsed = 0;

    // Find how many lines fit on this page
    for (let i = lineIndex; i < lineResult.lines.length; i++) {
      const line = lineResult.lines[i];
      if (heightUsed + line.height <= availableHeight) {
        linesToFit.push(line);
        heightUsed += line.height;
      } else {
        break;
      }
    }

    // If no lines fit and page has content, start new page
    if (linesToFit.length === 0 && currentState.pageContent.length > 0) {
      currentState = finalizePage(currentState, headers, footers);
      currentState = initializePageContent(currentState);
      isFirstPart = false;
      continue;
    }

    // If still no lines fit (first on page), force at least one line
    if (linesToFit.length === 0 && lineIndex < lineResult.lines.length) {
      linesToFit.push(lineResult.lines[lineIndex]);
      heightUsed = lineResult.lines[lineIndex].height;
    }

    const isLastPart = lineIndex + linesToFit.length >= lineResult.lines.length;
    const partHeight = (isFirstPart ? spaceBefore : 0) + heightUsed + (isLastPart ? spaceAfter : 0);

    // Add content to page
    currentState.pageContent.push({
      type: 'paragraph',
      block: paragraph,
      blockIndex,
      y: currentState.y + (isFirstPart ? spaceBefore : 0),
      height: partHeight,
      isContinuation: !isFirstPart,
      continuesOnNextPage: !isLastPart,
      lines: linesToFit,
      startLineIndex: lineIndex,
    });

    currentState.y += partHeight;
    currentState.remainingHeight -= partHeight;
    lineIndex += linesToFit.length;
    isFirstPart = false;

    // Start new page if more content remains
    if (lineIndex < lineResult.lines.length) {
      currentState = finalizePage(currentState, headers, footers);
      currentState = initializePageContent(currentState);
    }
  }

  return currentState;
}

/**
 * Layout a table
 */
function layoutTable(
  table: Table,
  blockIndex: number,
  state: LayoutState,
  theme: Theme | null | undefined,
  headers?: Map<number, Map<HeaderFooterType, HeaderFooter>>,
  footers?: Map<number, Map<HeaderFooterType, HeaderFooter>>
): LayoutState {
  let currentState = state;

  // Estimate table height (simplified - real implementation would measure cells)
  const estimatedRowHeight = 30; // Default row height in pixels
  const estimatedHeight = table.rows.length * estimatedRowHeight;

  // Check if table fits on current page
  if (estimatedHeight <= currentState.remainingHeight) {
    // Table fits entirely
    currentState.pageContent.push({
      type: 'table',
      block: table,
      blockIndex,
      y: currentState.y,
      height: estimatedHeight,
      isContinuation: false,
      continuesOnNextPage: false,
    });

    currentState.y += estimatedHeight;
    currentState.remainingHeight -= estimatedHeight;
  } else {
    // Table doesn't fit - simplified: start on new page
    if (currentState.pageContent.length > 0) {
      currentState = finalizePage(currentState, headers, footers);
      currentState = initializePageContent(currentState);
    }

    // Place table on new page (may still overflow for very large tables)
    currentState.pageContent.push({
      type: 'table',
      block: table,
      blockIndex,
      y: currentState.y,
      height: Math.min(estimatedHeight, currentState.remainingHeight),
      isContinuation: false,
      continuesOnNextPage: estimatedHeight > currentState.remainingHeight,
    });

    currentState.y += Math.min(estimatedHeight, currentState.remainingHeight);
    currentState.remainingHeight -= Math.min(estimatedHeight, currentState.remainingHeight);
  }

  return currentState;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate content area height in pixels
 */
function calculateContentHeight(sectionProps: SectionProperties): number {
  const pageHeight = sectionProps.pageSize?.height ?? 15840; // Default 11"
  const margins = sectionProps.pageMargins ?? {};
  const topMargin = margins.top ?? 1440;
  const bottomMargin = margins.bottom ?? 1440;

  return twipsToPixels(pageHeight - topMargin - bottomMargin);
}

/**
 * Calculate content area width in pixels
 */
function calculateContentWidth(sectionProps: SectionProperties): number {
  const pageWidth = sectionProps.pageSize?.width ?? 12240; // Default 8.5"
  const margins = sectionProps.pageMargins ?? {};
  const leftMargin = margins.left ?? 1440;
  const rightMargin = margins.right ?? 1440;

  return twipsToPixels(pageWidth - leftMargin - rightMargin);
}

/**
 * Check if we should start a new page for a section
 */
function shouldStartNewPage(
  sectionType: string,
  state: LayoutState
): boolean {
  switch (sectionType) {
    case 'nextPage':
    case 'oddPage':
    case 'evenPage':
      return true;
    case 'continuous':
      return false;
    case 'nextColumn':
      // For single-column, treat like nextPage
      return true;
    default:
      return true;
  }
}

/**
 * Get header for a specific page
 */
function getHeaderForPage(
  pageNumber: number,
  isFirstPageOfSection: boolean,
  sectionIndex: number,
  headers: Map<number, Map<HeaderFooterType, HeaderFooter>> | undefined,
  sectionProps: SectionProperties
): HeaderFooter | null {
  if (!headers) return null;

  const sectionHeaders = headers.get(sectionIndex);
  if (!sectionHeaders) return null;

  // First page header
  if (isFirstPageOfSection && sectionProps.titlePage && sectionHeaders.has('first')) {
    return sectionHeaders.get('first') || null;
  }

  // Even/odd page headers
  if (sectionProps.evenAndOddHeaders) {
    const isEven = pageNumber % 2 === 0;
    if (isEven && sectionHeaders.has('even')) {
      return sectionHeaders.get('even') || null;
    }
  }

  // Default header
  return sectionHeaders.get('default') || null;
}

/**
 * Get footer for a specific page
 */
function getFooterForPage(
  pageNumber: number,
  isFirstPageOfSection: boolean,
  sectionIndex: number,
  footers: Map<number, Map<HeaderFooterType, HeaderFooter>> | undefined,
  sectionProps: SectionProperties
): HeaderFooter | null {
  if (!footers) return null;

  const sectionFooters = footers.get(sectionIndex);
  if (!sectionFooters) return null;

  // First page footer
  if (isFirstPageOfSection && sectionProps.titlePage && sectionFooters.has('first')) {
    return sectionFooters.get('first') || null;
  }

  // Even/odd page footers
  if (sectionProps.evenAndOddHeaders) {
    const isEven = pageNumber % 2 === 0;
    if (isEven && sectionFooters.has('even')) {
      return sectionFooters.get('even') || null;
    }
  }

  // Default footer
  return sectionFooters.get('default') || null;
}

/**
 * Get default section properties
 */
function getDefaultSectionProps(): SectionProperties {
  return {
    pageSize: {
      width: 12240, // 8.5" in twips
      height: 15840, // 11" in twips
      orientation: 'portrait',
    },
    pageMargins: {
      top: 1440, // 1"
      bottom: 1440,
      left: 1440,
      right: 1440,
      header: 720, // 0.5"
      footer: 720,
      gutter: 0,
    },
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get page count from layout result
 */
export function getPageCount(result: PageLayoutResult): number {
  return result.totalPages;
}

/**
 * Get a specific page by number (1-indexed)
 */
export function getPage(result: PageLayoutResult, pageNumber: number): Page | null {
  return result.pages[pageNumber - 1] || null;
}

/**
 * Get all pages for a section
 */
export function getPagesForSection(result: PageLayoutResult, sectionIndex: number): Page[] {
  return result.pages.filter((p) => p.sectionIndex === sectionIndex);
}

/**
 * Check if a block spans multiple pages
 */
export function blockSpansPages(result: PageLayoutResult, blockIndex: number): boolean {
  const pagesWithBlock = result.pages.filter((p) =>
    p.content.some((c) => c.blockIndex === blockIndex)
  );
  return pagesWithBlock.length > 1;
}

/**
 * Get page numbers where a block appears
 */
export function getPagesForBlock(result: PageLayoutResult, blockIndex: number): number[] {
  return result.pages
    .filter((p) => p.content.some((c) => c.blockIndex === blockIndex))
    .map((p) => p.pageNumber);
}

/**
 * Calculate total document height
 */
export function getTotalHeight(result: PageLayoutResult): number {
  return result.pages.reduce((sum, p) => sum + p.heightPx, 0);
}

/**
 * Get page at a specific Y position (for scrolling)
 */
export function getPageAtY(result: PageLayoutResult, y: number, gap: number = 20): Page | null {
  let currentY = 0;

  for (const page of result.pages) {
    if (y >= currentY && y < currentY + page.heightPx) {
      return page;
    }
    currentY += page.heightPx + gap;
  }

  return result.pages[result.pages.length - 1] || null;
}

/**
 * Get Y position for a page (for scrolling)
 */
export function getYForPage(result: PageLayoutResult, pageNumber: number, gap: number = 20): number {
  let y = 0;

  for (let i = 0; i < pageNumber - 1 && i < result.pages.length; i++) {
    y += result.pages[i].heightPx + gap;
  }

  return y;
}

export default calculatePages;
