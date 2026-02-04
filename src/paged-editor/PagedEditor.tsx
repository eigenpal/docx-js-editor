/**
 * PagedEditor Component
 *
 * Main paginated editing component that integrates:
 * - HiddenProseMirror: off-screen editor for keyboard input
 * - Layout engine: computes page layout from PM state
 * - DOM painter: renders pages to visible DOM
 * - Selection overlay: renders caret and selection highlights
 *
 * Architecture:
 * 1. User clicks on visible pages → hit test → update PM selection
 * 2. User types → hidden PM receives input → PM transaction
 * 3. PM transaction → convert to blocks → measure → layout → paint
 * 4. Selection changes → compute rects → update overlay
 */

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
  memo,
} from 'react';
import type { CSSProperties } from 'react';
import type { EditorState, Transaction, Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

// Internal components
import { HiddenProseMirror, type HiddenProseMirrorRef } from './HiddenProseMirror';
import { SelectionOverlay } from './SelectionOverlay';

// Layout engine
import { layoutDocument } from '../layout-engine';
import type {
  Layout,
  FlowBlock,
  Measure,
  ParagraphBlock,
  TableBlock,
  ImageBlock,
  PageMargins,
  Run,
  RunFormatting,
  ParagraphAttrs,
} from '../layout-engine/types';

// Layout bridge
import { toFlowBlocks } from '../layout-bridge/toFlowBlocks';
import { measureParagraph } from '../layout-bridge/measuring';
import { hitTestFragment } from '../layout-bridge/hitTest';
import { clickToPosition } from '../layout-bridge/clickToPosition';
import { clickToPositionDom } from '../layout-bridge/clickToPositionDom';
import {
  selectionToRects,
  getCaretPosition,
  type SelectionRect,
  type CaretPosition,
} from '../layout-bridge/selectionRects';

// Layout painter
import { LayoutPainter, type BlockLookup } from '../layout-painter';
import {
  renderPages,
  type RenderPageOptions,
  type HeaderFooterContent,
} from '../layout-painter/renderPage';

// Selection sync
import { SelectionSyncCoordinator } from './SelectionSyncCoordinator';

// Types
import type {
  Document,
  Theme,
  StyleDefinitions,
  SectionProperties,
  HeaderFooter,
} from '../types/document';

// =============================================================================
// TYPES
// =============================================================================

export interface PagedEditorProps {
  /** The document to edit. */
  document: Document | null;
  /** Document styles for style resolution. */
  styles?: StyleDefinitions | null;
  /** Theme for styling. */
  theme?: Theme | null;
  /** Section properties (page size, margins). */
  sectionProperties?: SectionProperties | null;
  /** Header content for all pages. */
  headerContent?: HeaderFooter | null;
  /** Footer content for all pages. */
  footerContent?: HeaderFooter | null;
  /** Whether the editor is read-only. */
  readOnly?: boolean;
  /** Gap between pages in pixels. */
  pageGap?: number;
  /** Zoom level (1 = 100%). */
  zoom?: number;
  /** Callback when document changes. */
  onDocumentChange?: (document: Document) => void;
  /** Callback when selection changes. */
  onSelectionChange?: (from: number, to: number) => void;
  /** External ProseMirror plugins. */
  externalPlugins?: Plugin[];
  /** Callback when editor is ready. */
  onReady?: (ref: PagedEditorRef) => void;
  /** Custom class name. */
  className?: string;
  /** Custom styles. */
  style?: CSSProperties;
}

export interface PagedEditorRef {
  /** Get the current document. */
  getDocument(): Document | null;
  /** Get the ProseMirror EditorState. */
  getState(): EditorState | null;
  /** Get the ProseMirror EditorView. */
  getView(): EditorView | null;
  /** Focus the editor. */
  focus(): void;
  /** Blur the editor. */
  blur(): void;
  /** Check if focused. */
  isFocused(): boolean;
  /** Dispatch a transaction. */
  dispatch(tr: Transaction): void;
  /** Undo. */
  undo(): boolean;
  /** Redo. */
  redo(): boolean;
  /** Set selection by PM position. */
  setSelection(anchor: number, head?: number): void;
  /** Get current layout. */
  getLayout(): Layout | null;
  /** Force re-layout. */
  relayout(): void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Default page size (US Letter at 96 DPI)
const DEFAULT_PAGE_WIDTH = 816;
const DEFAULT_PAGE_HEIGHT = 1056;

// Default margins (1 inch at 96 DPI)
const DEFAULT_MARGINS: PageMargins = {
  top: 96,
  right: 96,
  bottom: 96,
  left: 96,
};

const DEFAULT_PAGE_GAP = 24;

// Stable empty array to avoid re-creating on each render
const EMPTY_PLUGINS: Plugin[] = [];

// =============================================================================
// STYLES
// =============================================================================

const containerStyles: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'auto',
  backgroundColor: '#f0f0f0',
};

const viewportStyles: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: 24,
  paddingBottom: 24,
};

const pagesContainerStyles: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert twips to pixels (1 twip = 1/20 point, 96 pixels per inch).
 */
function twipsToPixels(twips: number): number {
  return Math.round((twips / 1440) * 96);
}

/**
 * Extract page size from section properties or use defaults.
 */
function getPageSize(sectionProps: SectionProperties | null | undefined): {
  w: number;
  h: number;
} {
  return {
    w: sectionProps?.pageWidth ? twipsToPixels(sectionProps.pageWidth) : DEFAULT_PAGE_WIDTH,
    h: sectionProps?.pageHeight ? twipsToPixels(sectionProps.pageHeight) : DEFAULT_PAGE_HEIGHT,
  };
}

/**
 * Extract margins from section properties or use defaults.
 */
function getMargins(sectionProps: SectionProperties | null | undefined): PageMargins {
  return {
    top: sectionProps?.marginTop ? twipsToPixels(sectionProps.marginTop) : DEFAULT_MARGINS.top,
    right: sectionProps?.marginRight
      ? twipsToPixels(sectionProps.marginRight)
      : DEFAULT_MARGINS.right,
    bottom: sectionProps?.marginBottom
      ? twipsToPixels(sectionProps.marginBottom)
      : DEFAULT_MARGINS.bottom,
    left: sectionProps?.marginLeft ? twipsToPixels(sectionProps.marginLeft) : DEFAULT_MARGINS.left,
  };
}

/**
 * Measure a block based on its type.
 */
function measureBlock(block: FlowBlock, contentWidth: number): Measure {
  switch (block.kind) {
    case 'paragraph':
      return measureParagraph(block as ParagraphBlock, contentWidth);

    case 'table': {
      // Simple table measure - calculate dimensions with proper column handling
      const tableBlock = block as TableBlock;
      // columnWidths are already in pixels (converted in toFlowBlocks)
      const columnWidths = tableBlock.columnWidths ?? [];

      // Calculate cell widths based on colSpan and columnWidths
      const rows = tableBlock.rows.map((row) => {
        let columnIndex = 0;
        return {
          cells: row.cells.map((cell) => {
            const colSpan = cell.colSpan ?? 1;
            // Calculate cell width as sum of spanned columns
            let cellWidth = 0;
            for (let c = 0; c < colSpan && columnIndex + c < columnWidths.length; c++) {
              cellWidth += columnWidths[columnIndex + c] ?? 0;
            }
            // Fallback to cell.width or default if columnWidths not available
            if (cellWidth === 0) {
              cellWidth = cell.width ?? 100;
            }
            columnIndex += colSpan;

            return {
              blocks: cell.blocks.map((b) => measureBlock(b, cellWidth)),
              width: cellWidth,
              height: 0, // Calculated below
              colSpan: cell.colSpan,
              rowSpan: cell.rowSpan,
            };
          }),
          height: 0,
        };
      });

      // Calculate cell heights
      for (const row of rows) {
        let maxHeight = 0;
        for (const cell of row.cells) {
          cell.height = cell.blocks.reduce((h, m) => {
            // Get height from any measure type (paragraph or table)
            if ('totalHeight' in m) return h + m.totalHeight;
            return h;
          }, 0);
          maxHeight = Math.max(maxHeight, cell.height);
        }
        row.height = maxHeight;
      }

      const totalHeight = rows.reduce((h, r) => h + r.height, 0);
      const totalWidth = columnWidths.reduce((w, cw) => w + cw, 0);

      return {
        kind: 'table',
        rows,
        columnWidths,
        totalWidth: totalWidth || contentWidth,
        totalHeight,
      };
    }

    case 'image': {
      const imageBlock = block as ImageBlock;
      return {
        kind: 'image',
        width: imageBlock.width ?? 100,
        height: imageBlock.height ?? 100,
      };
    }

    case 'pageBreak':
      return { kind: 'pageBreak' };

    case 'columnBreak':
      return { kind: 'columnBreak' };

    case 'sectionBreak':
      return { kind: 'sectionBreak' };

    default:
      // Unknown block type - return empty paragraph measure
      return {
        kind: 'paragraph',
        lines: [],
        totalHeight: 0,
      };
  }
}

/**
 * Measure all blocks.
 */
function measureBlocks(blocks: FlowBlock[], contentWidth: number): Measure[] {
  return blocks.map((block) => measureBlock(block, contentWidth));
}

/**
 * Convert document Run content to FlowBlock runs.
 * Handles text, tabs, fields (PAGE, NUMPAGES), etc.
 *
 * Fields like PAGE and NUMPAGES are converted to FieldRun which gets
 * substituted with actual values at render time (in renderParagraph).
 *
 * @param content - Array of ParagraphContent from document
 */
function convertDocumentRunsToFlowRuns(content: unknown[]): Run[] {
  const runs: Run[] = [];

  for (const item of content) {
    const itemObj = item as Record<string, unknown>;

    // Handle Run type (from Document)
    if (itemObj.type === 'run' && Array.isArray(itemObj.content)) {
      const formatting = itemObj.formatting as Record<string, unknown> | undefined;
      const runFormatting: RunFormatting = {};

      if (formatting) {
        if (formatting.bold) runFormatting.bold = true;
        if (formatting.italic) runFormatting.italic = true;
        if (formatting.underline) runFormatting.underline = true;
        if (formatting.strike) runFormatting.strike = true;
        if (formatting.color) {
          const color = formatting.color as Record<string, unknown>;
          if (color.val) runFormatting.color = `#${color.val}`;
          else if (color.rgb) runFormatting.color = `#${color.rgb}`;
        }
        if (formatting.fontSize) {
          runFormatting.fontSize = (formatting.fontSize as number) / 2; // half-points to points
        }
        if (formatting.fontFamily) {
          const ff = formatting.fontFamily as Record<string, unknown>;
          runFormatting.fontFamily = (ff.ascii || ff.hAnsi) as string;
        }
      }

      // Process run content
      for (const runContent of itemObj.content as unknown[]) {
        const rc = runContent as Record<string, unknown>;

        if (rc.type === 'text' && typeof rc.text === 'string') {
          runs.push({
            kind: 'text',
            text: rc.text,
            ...runFormatting,
          });
        } else if (rc.type === 'tab') {
          runs.push({
            kind: 'tab',
            ...runFormatting,
          });
        } else if (rc.type === 'break') {
          runs.push({
            kind: 'lineBreak',
          });
        }
      }
    }

    // Handle SimpleField (w:fldSimple) - PAGE, NUMPAGES, etc.
    if (itemObj.type === 'simpleField') {
      const fieldType = itemObj.fieldType as string;

      if (fieldType === 'PAGE') {
        runs.push({
          kind: 'field',
          fieldType: 'PAGE',
          fallback: '1',
        });
      } else if (fieldType === 'NUMPAGES') {
        runs.push({
          kind: 'field',
          fieldType: 'NUMPAGES',
          fallback: '1',
        });
      } else if (Array.isArray(itemObj.content)) {
        // Use the display content for other fields
        const displayRuns = convertDocumentRunsToFlowRuns(itemObj.content as unknown[]);
        runs.push(...displayRuns);
      }
      continue;
    }

    // Handle ComplexField (fldChar sequence)
    if (itemObj.type === 'complexField') {
      const fieldType = itemObj.fieldType as string;

      // Extract formatting from fieldResult runs if available
      const fieldFormatting: RunFormatting = {};
      if (Array.isArray(itemObj.fieldResult) && itemObj.fieldResult.length > 0) {
        const firstRun = itemObj.fieldResult[0] as Record<string, unknown>;
        if (firstRun?.type === 'run' && firstRun.formatting) {
          const formatting = firstRun.formatting as Record<string, unknown>;
          if (formatting.fontSize) {
            fieldFormatting.fontSize = (formatting.fontSize as number) / 2;
          }
          if (formatting.fontFamily) {
            const ff = formatting.fontFamily as Record<string, unknown>;
            fieldFormatting.fontFamily = (ff.ascii || ff.hAnsi) as string;
          }
          if (formatting.bold) fieldFormatting.bold = true;
          if (formatting.italic) fieldFormatting.italic = true;
        }
      }

      if (fieldType === 'PAGE') {
        runs.push({
          kind: 'field',
          fieldType: 'PAGE',
          fallback: '1',
          ...fieldFormatting,
        });
      } else if (fieldType === 'NUMPAGES') {
        runs.push({
          kind: 'field',
          fieldType: 'NUMPAGES',
          fallback: '1',
          ...fieldFormatting,
        });
      } else if (Array.isArray(itemObj.fieldResult)) {
        // Use the fieldResult for other fields
        const displayRuns = convertDocumentRunsToFlowRuns(itemObj.fieldResult as unknown[]);
        runs.push(...displayRuns);
      }
    }

    // Handle Hyperlink
    if (itemObj.type === 'hyperlink' && Array.isArray(itemObj.children)) {
      const childRuns = convertDocumentRunsToFlowRuns(itemObj.children as unknown[]);
      runs.push(...childRuns);
    }
  }

  return runs;
}

/**
 * Convert HeaderFooter (document type) to HeaderFooterContent (render type).
 *
 * This converts parsed header/footer content into FlowBlocks that can be
 * rendered by the layout painter.
 *
 * Fields like PAGE and NUMPAGES are converted to FieldRun which gets
 * substituted with actual values at render time.
 *
 * @param headerFooter - The header/footer document content
 * @param contentWidth - Available width for content
 */
function convertHeaderFooterToContent(
  headerFooter: HeaderFooter | null | undefined,
  contentWidth: number
): HeaderFooterContent | undefined {
  if (!headerFooter || !headerFooter.content || headerFooter.content.length === 0) {
    return undefined;
  }

  const blocks: FlowBlock[] = [];

  for (const item of headerFooter.content) {
    const itemObj = item as unknown as Record<string, unknown>;

    // Check for Document Paragraph type
    if (itemObj.type === 'paragraph' && Array.isArray(itemObj.content)) {
      const formatting = itemObj.formatting as Record<string, unknown> | undefined;
      const attrs: ParagraphAttrs = {};

      if (formatting) {
        if (formatting.alignment) {
          const align = formatting.alignment as string;
          if (align === 'both') attrs.alignment = 'justify';
          else if (['left', 'center', 'right', 'justify'].includes(align)) {
            attrs.alignment = align as 'left' | 'center' | 'right' | 'justify';
          }
        }
      }

      const runs = convertDocumentRunsToFlowRuns(itemObj.content as unknown[]);

      // Only add paragraph if it has content
      if (runs.length > 0) {
        const paragraphBlock: ParagraphBlock = {
          kind: 'paragraph',
          id: String(blocks.length),
          runs,
          attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
        };
        blocks.push(paragraphBlock);
      }
    }
  }

  if (blocks.length === 0) {
    return undefined;
  }

  const measures = measureBlocks(blocks, contentWidth);
  const totalHeight = measures.reduce((h, m) => {
    if (m.kind === 'paragraph') {
      return h + m.totalHeight;
    }
    return h;
  }, 0);

  return {
    blocks,
    measures,
    height: totalHeight,
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * PagedEditor - Main paginated editing component.
 */
const PagedEditorComponent = forwardRef<PagedEditorRef, PagedEditorProps>(
  function PagedEditor(props, ref) {
    const {
      document,
      styles,
      theme: _theme,
      sectionProperties,
      headerContent,
      footerContent,
      readOnly = false,
      pageGap = DEFAULT_PAGE_GAP,
      zoom = 1,
      onDocumentChange,
      onSelectionChange,
      externalPlugins = EMPTY_PLUGINS,
      onReady,
      className,
      style,
    } = props;

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const pagesContainerRef = useRef<HTMLDivElement>(null);
    const hiddenPMRef = useRef<HiddenProseMirrorRef>(null);
    const painterRef = useRef<LayoutPainter | null>(null);

    // State
    const [layout, setLayout] = useState<Layout | null>(null);
    const [blocks, setBlocks] = useState<FlowBlock[]>([]);
    const [measures, setMeasures] = useState<Measure[]>([]);
    const [isFocused, setIsFocused] = useState(false);
    const [selectionRects, setSelectionRects] = useState<SelectionRect[]>([]);
    const [caretPosition, setCaretPosition] = useState<CaretPosition | null>(null);

    // Drag selection state
    const isDraggingRef = useRef(false);
    const dragAnchorRef = useRef<number | null>(null);

    // Selection sync coordinator - ensures selection renders only when layout is current
    const syncCoordinator = useMemo(() => new SelectionSyncCoordinator(), []);

    // Compute page size and margins
    const pageSize = useMemo(() => getPageSize(sectionProperties), [sectionProperties]);
    const margins = useMemo(() => getMargins(sectionProperties), [sectionProperties]);
    const contentWidth = pageSize.w - margins.left - margins.right;

    // Initialize painter using useMemo to ensure it's ready before first render callbacks
    const painter = useMemo(() => {
      return new LayoutPainter({
        pageGap,
        showShadow: true,
        pageBackground: '#fff',
      });
    }, [pageGap]);

    // Keep ref in sync with memoized painter
    painterRef.current = painter;

    // =========================================================================
    // Layout Pipeline
    // =========================================================================

    /**
     * Run the full layout pipeline:
     * 1. Convert PM doc to blocks
     * 2. Measure blocks
     * 3. Layout blocks onto pages
     * 4. Paint pages to DOM
     */
    const runLayoutPipeline = useCallback(
      (state: EditorState) => {
        // Capture current epoch for this layout run
        const currentEpoch = syncCoordinator.getDocEpoch();

        // Signal layout is starting
        syncCoordinator.onLayoutStart();

        // Step 1: Convert PM doc to flow blocks
        const newBlocks = toFlowBlocks(state.doc);
        setBlocks(newBlocks);

        // Step 2: Measure all blocks
        const newMeasures = measureBlocks(newBlocks, contentWidth);
        setMeasures(newMeasures);

        // Step 3: Layout blocks onto pages
        const newLayout = layoutDocument(newBlocks, newMeasures, {
          pageSize,
          margins,
        });
        setLayout(newLayout);

        // Step 4: Paint to DOM
        if (pagesContainerRef.current && painterRef.current) {
          // Build block lookup
          const blockLookup: BlockLookup = new Map();
          for (let i = 0; i < newBlocks.length; i++) {
            const block = newBlocks[i];
            const measure = newMeasures[i];
            if (block && measure) {
              blockLookup.set(String(block.id), { block, measure });
            }
          }
          painterRef.current.setBlockLookup(blockLookup);

          // Convert header/footer content for rendering
          const headerContentForRender = convertHeaderFooterToContent(headerContent, contentWidth);
          const footerContentForRender = convertHeaderFooterToContent(footerContent, contentWidth);

          // Render pages to container
          renderPages(newLayout.pages, pagesContainerRef.current, {
            pageGap,
            showShadow: true,
            pageBackground: '#fff',
            blockLookup,
            headerContent: headerContentForRender,
            footerContent: footerContentForRender,
            headerDistance: sectionProperties?.headerDistance
              ? twipsToPixels(sectionProperties.headerDistance)
              : undefined,
            footerDistance: sectionProperties?.footerDistance
              ? twipsToPixels(sectionProperties.footerDistance)
              : undefined,
          } as RenderPageOptions & { pageGap?: number; blockLookup?: BlockLookup });
        }

        // Signal layout is complete for this epoch
        syncCoordinator.onLayoutComplete(currentEpoch);
      },
      [
        contentWidth,
        pageSize,
        margins,
        pageGap,
        syncCoordinator,
        headerContent,
        footerContent,
        sectionProperties,
      ]
    );

    /**
     * Get caret position using DOM-based measurement (like SuperDoc).
     * This uses the browser's text rendering to get precise pixel positions.
     */
    const getCaretFromDom = useCallback((pmPos: number): CaretPosition | null => {
      if (!pagesContainerRef.current) return null;

      const overlay = pagesContainerRef.current.parentElement?.querySelector(
        '[data-testid="selection-overlay"]'
      );
      if (!overlay) return null;

      const overlayRect = overlay.getBoundingClientRect();

      // Find spans with PM position data
      const spans = pagesContainerRef.current.querySelectorAll('span[data-pm-start][data-pm-end]');

      for (const span of Array.from(spans)) {
        const spanEl = span as HTMLElement;
        const pmStart = Number(spanEl.dataset.pmStart);
        const pmEnd = Number(spanEl.dataset.pmEnd);

        // Special handling for tab spans - use exclusive end to avoid boundary conflicts
        // Tab at [5,6) means position 6 belongs to the next run, not the tab
        if (spanEl.classList.contains('layout-run-tab')) {
          if (pmPos >= pmStart && pmPos < pmEnd) {
            const spanRect = spanEl.getBoundingClientRect();
            const pageEl = spanEl.closest('.layout-page');
            const pageIndex = pageEl ? Number((pageEl as HTMLElement).dataset.pageNumber) - 1 : 0;
            const lineEl = spanEl.closest('.layout-line');
            const lineHeight = lineEl ? (lineEl as HTMLElement).offsetHeight : 16;

            return {
              x: spanRect.left - overlayRect.left,
              y: spanRect.top - overlayRect.top,
              height: lineHeight,
              pageIndex,
            };
          }
          continue; // Skip to next span
        }

        // For text runs, use inclusive range
        if (pmPos >= pmStart && pmPos <= pmEnd && span.firstChild?.nodeType === Node.TEXT_NODE) {
          const textNode = span.firstChild as Text;
          const charIndex = Math.min(pmPos - pmStart, textNode.length);

          // Create a range at the exact character position
          const ownerDoc = spanEl.ownerDocument;
          if (!ownerDoc) continue;
          const range = ownerDoc.createRange();
          range.setStart(textNode, charIndex);
          range.setEnd(textNode, charIndex);

          const rangeRect = range.getBoundingClientRect();

          // Find which page this span is on
          const pageEl = spanEl.closest('.layout-page');
          const pageIndex = pageEl ? Number((pageEl as HTMLElement).dataset.pageNumber) - 1 : 0;

          // Get line height from the line element or use default
          const lineEl = spanEl.closest('.layout-line');
          const lineHeight = lineEl ? (lineEl as HTMLElement).offsetHeight : 16;

          return {
            x: rangeRect.left - overlayRect.left,
            y: rangeRect.top - overlayRect.top,
            height: lineHeight,
            pageIndex,
          };
        }
      }

      // Fallback: try to find position in empty paragraphs (they have empty runs)
      const emptyRuns = pagesContainerRef.current.querySelectorAll('.layout-empty-run');
      for (const emptyRun of Array.from(emptyRuns)) {
        const paragraph = emptyRun.closest('.layout-paragraph') as HTMLElement;
        if (!paragraph) continue;

        const pmStart = Number(paragraph.dataset.pmStart);
        const pmEnd = Number(paragraph.dataset.pmEnd);

        if (pmPos >= pmStart && pmPos <= pmEnd) {
          const runRect = emptyRun.getBoundingClientRect();
          const pageEl = paragraph.closest('.layout-page');
          const pageIndex = pageEl ? Number((pageEl as HTMLElement).dataset.pageNumber) - 1 : 0;
          const lineEl = emptyRun.closest('.layout-line');
          const lineHeight = lineEl ? (lineEl as HTMLElement).offsetHeight : 16;

          return {
            x: runRect.left - overlayRect.left,
            y: runRect.top - overlayRect.top,
            height: lineHeight,
            pageIndex,
          };
        }
      }

      return null;
    }, []);

    /**
     * Update selection overlay from PM selection.
     */
    const updateSelectionOverlay = useCallback(
      (state: EditorState) => {
        if (!layout || blocks.length === 0) return;

        const { from, to } = state.selection;

        // Collapsed selection - show caret
        if (from === to) {
          // Use DOM-based caret positioning for accuracy
          const domCaret = getCaretFromDom(from);
          if (domCaret) {
            setCaretPosition(domCaret);
          } else {
            // Fallback to layout-based calculation if DOM not ready
            const overlay = pagesContainerRef.current?.parentElement?.querySelector(
              '[data-testid="selection-overlay"]'
            );
            const firstPage = pagesContainerRef.current?.querySelector('.layout-page');

            if (overlay && firstPage) {
              const overlayRect = overlay.getBoundingClientRect();
              const pageRect = firstPage.getBoundingClientRect();
              const caret = getCaretPosition(layout, blocks, measures, from);

              if (caret) {
                setCaretPosition({
                  ...caret,
                  x: caret.x + (pageRect.left - overlayRect.left),
                  y: caret.y + (pageRect.top - overlayRect.top),
                });
              } else {
                setCaretPosition(null);
              }
            } else {
              setCaretPosition(null);
            }
          }
          setSelectionRects([]);
        } else {
          // Range selection - show highlight rectangles using DOM-based approach
          const overlay = pagesContainerRef.current?.parentElement?.querySelector(
            '[data-testid="selection-overlay"]'
          );

          if (overlay && pagesContainerRef.current) {
            const overlayRect = overlay.getBoundingClientRect();
            const domRects: SelectionRect[] = [];

            // Find spans that intersect with the selection range
            const spans = pagesContainerRef.current.querySelectorAll(
              'span[data-pm-start][data-pm-end]'
            );

            for (const span of Array.from(spans)) {
              const spanEl = span as HTMLElement;
              const pmStart = Number(spanEl.dataset.pmStart);
              const pmEnd = Number(spanEl.dataset.pmEnd);

              // Check if this span overlaps with selection
              if (pmEnd > from && pmStart < to) {
                // Special handling for tab spans - highlight the full visual width
                if (spanEl.classList.contains('layout-run-tab')) {
                  const spanRect = spanEl.getBoundingClientRect();
                  const pageEl = spanEl.closest('.layout-page');
                  const pageIndex = pageEl
                    ? Number((pageEl as HTMLElement).dataset.pageNumber) - 1
                    : 0;

                  domRects.push({
                    x: spanRect.left - overlayRect.left,
                    y: spanRect.top - overlayRect.top,
                    width: spanRect.width,
                    height: spanRect.height,
                    pageIndex,
                  });
                  continue;
                }

                if (span.firstChild?.nodeType !== Node.TEXT_NODE) continue;

                const textNode = span.firstChild as Text;
                const ownerDoc = spanEl.ownerDocument;
                if (!ownerDoc) continue;

                // Calculate the character range within this span
                const startChar = Math.max(0, from - pmStart);
                const endChar = Math.min(textNode.length, to - pmStart);

                if (startChar < endChar) {
                  const range = ownerDoc.createRange();
                  range.setStart(textNode, startChar);
                  range.setEnd(textNode, endChar);

                  // Get all client rects for this range (handles line wraps)
                  const clientRects = range.getClientRects();
                  for (const rect of Array.from(clientRects)) {
                    const pageEl = spanEl.closest('.layout-page');
                    const pageIndex = pageEl
                      ? Number((pageEl as HTMLElement).dataset.pageNumber) - 1
                      : 0;

                    domRects.push({
                      x: rect.left - overlayRect.left,
                      y: rect.top - overlayRect.top,
                      width: rect.width,
                      height: rect.height,
                      pageIndex,
                    });
                  }
                }
              }
            }

            if (domRects.length > 0) {
              setSelectionRects(domRects);
            } else {
              // Fallback to layout-based calculation
              const firstPage = pagesContainerRef.current.querySelector('.layout-page');
              if (firstPage) {
                const pageRect = firstPage.getBoundingClientRect();
                const pageOffsetX = pageRect.left - overlayRect.left;
                const pageOffsetY = pageRect.top - overlayRect.top;

                const rects = selectionToRects(layout, blocks, measures, from, to);
                const adjustedRects = rects.map((rect) => ({
                  ...rect,
                  x: rect.x + pageOffsetX,
                  y: rect.y + pageOffsetY,
                }));
                setSelectionRects(adjustedRects);
              } else {
                setSelectionRects([]);
              }
            }
          } else {
            setSelectionRects([]);
          }
          setCaretPosition(null);
        }

        // Notify selection change
        if (onSelectionChange) {
          onSelectionChange(from, to);
        }
      },
      [layout, blocks, measures, getCaretFromDom, onSelectionChange]
    );

    // =========================================================================
    // Event Handlers
    // =========================================================================

    /**
     * Handle PM transaction - re-layout on content/selection change.
     */
    const handleTransaction = useCallback(
      (transaction: Transaction, newState: EditorState) => {
        if (transaction.docChanged) {
          // Increment doc epoch to signal document changed
          syncCoordinator.incrementDocEpoch();

          // Content changed - full layout
          runLayoutPipeline(newState);

          // Notify document change
          if (onDocumentChange) {
            const newDoc = hiddenPMRef.current?.getDocument();
            if (newDoc) {
              onDocumentChange(newDoc);
            }
          }
        }

        // Request selection update (will only execute when layout is current)
        syncCoordinator.requestRender();
        updateSelectionOverlay(newState);
      },
      [runLayoutPipeline, updateSelectionOverlay, onDocumentChange, syncCoordinator]
    );

    /**
     * Handle selection change from PM.
     */
    const handleSelectionChange = useCallback(
      (state: EditorState) => {
        updateSelectionOverlay(state);
      },
      [updateSelectionOverlay]
    );

    /**
     * Get PM position from mouse coordinates using DOM-based detection.
     * Falls back to geometry-based calculation if DOM mapping fails.
     */
    const getPositionFromMouse = useCallback(
      (clientX: number, clientY: number): number | null => {
        if (!pagesContainerRef.current || !layout) return null;

        // Try DOM-based click mapping first (most accurate)
        const domPos = clickToPositionDom(pagesContainerRef.current, clientX, clientY, zoom);
        if (domPos !== null) {
          return domPos;
        }

        // Fallback to geometry-based mapping
        const pageElements = pagesContainerRef.current.querySelectorAll('.layout-page');
        let clickedPageIndex = -1;
        let pageRect: DOMRect | null = null;

        for (let i = 0; i < pageElements.length; i++) {
          const pageEl = pageElements[i];
          const rect = pageEl.getBoundingClientRect();
          if (
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom
          ) {
            clickedPageIndex = i;
            pageRect = rect;
            break;
          }
        }

        if (clickedPageIndex < 0 || !pageRect) {
          return null;
        }

        const pageX = (clientX - pageRect.left) / zoom;
        const pageY = (clientY - pageRect.top) / zoom;

        const page = layout.pages[clickedPageIndex];
        if (!page) return null;

        const pageHit = {
          pageIndex: clickedPageIndex,
          page,
          pageY,
        };

        const fragmentHit = hitTestFragment(pageHit, blocks, measures, {
          x: pageX,
          y: pageY,
        });

        if (!fragmentHit) return null;

        return clickToPosition(fragmentHit);
      },
      [layout, blocks, measures, zoom]
    );

    /**
     * Handle mousedown on pages - start selection or drag.
     */
    const handlePagesMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!hiddenPMRef.current || e.button !== 0) return; // Only handle left click

        e.preventDefault(); // Prevent native text selection

        const pmPos = getPositionFromMouse(e.clientX, e.clientY);

        if (pmPos !== null) {
          // Start dragging
          isDraggingRef.current = true;
          dragAnchorRef.current = pmPos;

          // Set initial selection (collapsed)
          hiddenPMRef.current.setSelection(pmPos);
        } else {
          // Clicked outside content - move to end
          const view = hiddenPMRef.current.getView();
          if (view) {
            const endPos = Math.max(0, view.state.doc.content.size - 1);
            hiddenPMRef.current.setSelection(endPos);
            dragAnchorRef.current = endPos;
            isDraggingRef.current = true;
          }
        }

        // Focus the hidden editor
        hiddenPMRef.current.focus();
        setIsFocused(true);
      },
      [getPositionFromMouse]
    );

    /**
     * Handle mousemove - extend selection during drag.
     */
    const handleMouseMove = useCallback(
      (e: MouseEvent) => {
        if (!isDraggingRef.current || dragAnchorRef.current === null) return;
        if (!hiddenPMRef.current || !pagesContainerRef.current) return;

        const pmPos = getPositionFromMouse(e.clientX, e.clientY);
        if (pmPos === null) return;

        // Set selection from anchor to current position
        const anchor = dragAnchorRef.current;
        hiddenPMRef.current.setSelection(anchor, pmPos);
      },
      [getPositionFromMouse]
    );

    /**
     * Handle mouseup - end drag selection.
     */
    const handleMouseUp = useCallback(() => {
      isDraggingRef.current = false;
      // Keep dragAnchorRef for potential shift-click extension
    }, []);

    // Add global mouse event listeners for drag selection
    useEffect(() => {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }, [handleMouseMove, handleMouseUp]);

    /**
     * Handle click on pages container (for double-click word selection).
     */
    const handlePagesClick = useCallback(
      (e: React.MouseEvent) => {
        // Double-click for word selection
        if (e.detail === 2 && hiddenPMRef.current) {
          const pmPos = getPositionFromMouse(e.clientX, e.clientY);
          if (pmPos !== null) {
            const view = hiddenPMRef.current.getView();
            if (view) {
              const { doc } = view.state;
              const $pos = doc.resolve(pmPos);
              const parent = $pos.parent;

              // Find word boundaries
              if (parent.isTextblock) {
                const text = parent.textContent;
                const offset = $pos.parentOffset;

                // Find word start (go back until whitespace/punctuation)
                let start = offset;
                while (start > 0 && /\w/.test(text[start - 1])) {
                  start--;
                }

                // Find word end (go forward until whitespace/punctuation)
                let end = offset;
                while (end < text.length && /\w/.test(text[end])) {
                  end++;
                }

                // Convert to absolute positions
                const absStart = $pos.start() + start;
                const absEnd = $pos.start() + end;

                if (absStart < absEnd) {
                  hiddenPMRef.current.setSelection(absStart, absEnd);
                }
              }
            }
          }
        }
        // Triple-click for paragraph selection
        if (e.detail === 3 && hiddenPMRef.current) {
          const pmPos = getPositionFromMouse(e.clientX, e.clientY);
          if (pmPos !== null) {
            const view = hiddenPMRef.current.getView();
            if (view) {
              const { doc } = view.state;
              const $pos = doc.resolve(pmPos);

              // Find paragraph start and end
              const paragraphStart = $pos.start($pos.depth);
              const paragraphEnd = $pos.end($pos.depth);

              hiddenPMRef.current.setSelection(paragraphStart, paragraphEnd);
            }
          }
        }
      },
      [getPositionFromMouse]
    );

    /**
     * Handle focus on container - redirect to hidden PM.
     */
    const handleContainerFocus = useCallback(() => {
      hiddenPMRef.current?.focus();
      setIsFocused(true);
    }, []);

    /**
     * Handle blur from container.
     */
    const handleContainerBlur = useCallback((e: React.FocusEvent) => {
      // Check if focus is moving to hidden PM or staying within container
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      if (relatedTarget && containerRef.current?.contains(relatedTarget)) {
        return; // Focus staying within editor
      }
      setIsFocused(false);
    }, []);

    /**
     * Handle keyboard events on container.
     * Most keyboard handling is done by ProseMirror, but we intercept
     * specific keys for navigation and ensure focus stays on hidden PM.
     */
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      // Ensure hidden PM is focused if user types
      if (!hiddenPMRef.current?.isFocused()) {
        hiddenPMRef.current?.focus();
        setIsFocused(true);
      }

      // Arrow keys with no modifiers - handle scrolling when at document bounds
      if (
        ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key) &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        // Let PM handle the cursor movement first
        // If PM doesn't handle it (at bounds), the container will scroll
      }

      // Cmd/Ctrl+Home - scroll to top and move cursor to start
      if (e.key === 'Home' && (e.metaKey || e.ctrlKey)) {
        if (containerRef.current) {
          containerRef.current.scrollTop = 0;
        }
      }

      // Cmd/Ctrl+End - scroll to bottom and move cursor to end
      if (e.key === 'End' && (e.metaKey || e.ctrlKey)) {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      }
    }, []);

    /**
     * Handle mousedown on container (outside pages).
     */
    const handleContainerMouseDown = useCallback(() => {
      // Focus hidden PM if clicking outside pages area
      if (!hiddenPMRef.current?.isFocused()) {
        hiddenPMRef.current?.focus();
        setIsFocused(true);
      }
    }, []);

    // =========================================================================
    // Initial Layout
    // =========================================================================

    /**
     * Run initial layout when document or view changes.
     */
    const handleEditorViewReady = useCallback(
      (view: EditorView) => {
        runLayoutPipeline(view.state);
        updateSelectionOverlay(view.state);
      },
      [runLayoutPipeline, updateSelectionOverlay]
    );

    // =========================================================================
    // Imperative Handle
    // =========================================================================

    useImperativeHandle(
      ref,
      () => ({
        getDocument() {
          return hiddenPMRef.current?.getDocument() ?? null;
        },
        getState() {
          return hiddenPMRef.current?.getState() ?? null;
        },
        getView() {
          return hiddenPMRef.current?.getView() ?? null;
        },
        focus() {
          hiddenPMRef.current?.focus();
          setIsFocused(true);
        },
        blur() {
          hiddenPMRef.current?.blur();
          setIsFocused(false);
        },
        isFocused() {
          return hiddenPMRef.current?.isFocused() ?? false;
        },
        dispatch(tr: Transaction) {
          hiddenPMRef.current?.dispatch(tr);
        },
        undo() {
          return hiddenPMRef.current?.undo() ?? false;
        },
        redo() {
          return hiddenPMRef.current?.redo() ?? false;
        },
        setSelection(anchor: number, head?: number) {
          hiddenPMRef.current?.setSelection(anchor, head);
        },
        getLayout() {
          return layout;
        },
        relayout() {
          const state = hiddenPMRef.current?.getState();
          if (state) {
            runLayoutPipeline(state);
          }
        },
      }),
      [layout, runLayoutPipeline]
    );

    // Update selection overlay when layout changes
    // This is needed because handleEditorViewReady calls runLayoutPipeline which
    // sets layout asynchronously, so updateSelectionOverlay would return early
    // if layout is still null. This effect ensures we update once layout is ready.
    useEffect(() => {
      const state = hiddenPMRef.current?.getState();
      if (layout && state) {
        updateSelectionOverlay(state);
      }
    }, [layout, updateSelectionOverlay]);

    // Notify when ready
    useEffect(() => {
      if (onReady && hiddenPMRef.current) {
        onReady({
          getDocument: () => hiddenPMRef.current?.getDocument() ?? null,
          getState: () => hiddenPMRef.current?.getState() ?? null,
          getView: () => hiddenPMRef.current?.getView() ?? null,
          focus: () => {
            hiddenPMRef.current?.focus();
            setIsFocused(true);
          },
          blur: () => {
            hiddenPMRef.current?.blur();
            setIsFocused(false);
          },
          isFocused: () => hiddenPMRef.current?.isFocused() ?? false,
          dispatch: (tr) => hiddenPMRef.current?.dispatch(tr),
          undo: () => hiddenPMRef.current?.undo() ?? false,
          redo: () => hiddenPMRef.current?.redo() ?? false,
          setSelection: (anchor, head) => hiddenPMRef.current?.setSelection(anchor, head),
          getLayout: () => layout,
          relayout: () => {
            const state = hiddenPMRef.current?.getState();
            if (state) {
              runLayoutPipeline(state);
            }
          },
        });
      }
    }, [onReady, layout, runLayoutPipeline]);

    // =========================================================================
    // Render
    // =========================================================================

    // Calculate total height for scroll
    const totalHeight = useMemo(() => {
      if (!layout) return DEFAULT_PAGE_HEIGHT + 48;
      const numPages = layout.pages.length;
      return numPages * pageSize.h + (numPages - 1) * pageGap + 48;
    }, [layout, pageSize.h, pageGap]);

    return (
      <div
        ref={containerRef}
        className={`paged-editor ${className ?? ''}`}
        style={{ ...containerStyles, ...style }}
        tabIndex={0}
        onFocus={handleContainerFocus}
        onBlur={handleContainerBlur}
        onKeyDown={handleKeyDown}
        onMouseDown={handleContainerMouseDown}
      >
        {/* Hidden ProseMirror for keyboard input */}
        <HiddenProseMirror
          ref={hiddenPMRef}
          document={document}
          styles={styles}
          widthPx={contentWidth}
          readOnly={readOnly}
          onTransaction={handleTransaction}
          onSelectionChange={handleSelectionChange}
          externalPlugins={externalPlugins}
          onEditorViewReady={handleEditorViewReady}
        />

        {/* Viewport for visible pages */}
        <div
          style={{
            ...viewportStyles,
            minHeight: totalHeight,
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: 'top center',
          }}
        >
          {/* Pages container */}
          <div
            ref={pagesContainerRef}
            className="paged-editor__pages"
            style={pagesContainerStyles}
            onMouseDown={handlePagesMouseDown}
            onClick={handlePagesClick}
            aria-hidden="true" // Visual only, PM provides semantic content
          />

          {/* Selection overlay */}
          <SelectionOverlay
            selectionRects={selectionRects}
            caretPosition={caretPosition}
            isFocused={isFocused}
            pageGap={pageGap}
          />
        </div>
      </div>
    );
  }
);

export const PagedEditor = memo(PagedEditorComponent);

export default PagedEditor;
