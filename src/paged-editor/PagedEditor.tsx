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
  ParagraphMeasure,
  TableBlock,
  ImageBlock,
  PageMargins,
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
import { renderPages, type RenderPageOptions } from '../layout-painter/renderPage';

// Types
import type { Document, Theme, StyleDefinitions, SectionProperties } from '../types/document';

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
      // Simple table measure - just calculate basic dimensions
      const tableBlock = block as TableBlock;
      const rows = tableBlock.rows.map((row) => ({
        cells: row.cells.map((cell) => ({
          blocks: cell.blocks.map((b) =>
            b.kind === 'paragraph'
              ? measureParagraph(b as ParagraphBlock, cell.width ?? 100)
              : {
                  kind: 'paragraph' as const,
                  lines: [],
                  totalHeight: 0,
                }
          ),
          width: cell.width ?? 100,
          height: 0, // Calculated below
          colSpan: cell.colSpan,
          rowSpan: cell.rowSpan,
        })),
        height: 0,
      }));

      // Calculate cell heights
      for (const row of rows) {
        let maxHeight = 0;
        for (const cell of row.cells) {
          cell.height = cell.blocks.reduce((h, m) => h + (m as ParagraphMeasure).totalHeight, 0);
          maxHeight = Math.max(maxHeight, cell.height);
        }
        row.height = maxHeight;
      }

      const totalHeight = rows.reduce((h, r) => h + r.height, 0);
      const columnWidths = tableBlock.columnWidths ?? [];
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

          // Render pages to container
          renderPages(newLayout.pages, pagesContainerRef.current, {
            pageGap,
            showShadow: true,
            pageBackground: '#fff',
            blockLookup,
          } as RenderPageOptions & { pageGap?: number; blockLookup?: BlockLookup });
        }
      },
      [contentWidth, pageSize, margins, pageGap]
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
              if (pmEnd > from && pmStart < to && span.firstChild?.nodeType === Node.TEXT_NODE) {
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

        // Always update selection
        updateSelectionOverlay(newState);
      },
      [runLayoutPipeline, updateSelectionOverlay, onDocumentChange]
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
            // Let ProseMirror handle word selection via double-click
            // The hidden editor will receive focus and process it
          }
        }
        // Triple-click for paragraph selection
        if (e.detail === 3 && hiddenPMRef.current) {
          const pmPos = getPositionFromMouse(e.clientX, e.clientY);
          if (pmPos !== null) {
            // Let ProseMirror handle paragraph selection
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
