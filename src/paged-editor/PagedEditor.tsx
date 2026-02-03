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
     * Update selection overlay from PM selection.
     */
    const updateSelectionOverlay = useCallback(
      (state: EditorState) => {
        if (!layout || blocks.length === 0) return;

        const { from, to } = state.selection;

        // Collapsed selection - show caret
        if (from === to) {
          const caret = getCaretPosition(layout, blocks, measures, from);
          setCaretPosition(caret);
          setSelectionRects([]);
        } else {
          // Range selection - show highlight rectangles
          const rects = selectionToRects(layout, blocks, measures, from, to);
          setSelectionRects(rects);
          setCaretPosition(null);
        }

        // Notify selection change
        if (onSelectionChange) {
          onSelectionChange(from, to);
        }
      },
      [layout, blocks, measures, pageGap, onSelectionChange]
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
     * Handle click on pages container - map to PM position.
     */
    const handlePagesClick = useCallback(
      (e: React.MouseEvent) => {
        if (!layout || !pagesContainerRef.current || !hiddenPMRef.current) return;

        // Find the page element that was clicked
        // Pages are rendered with class 'layout-page' and are centered in the container
        const pageElements = pagesContainerRef.current.querySelectorAll('.layout-page');
        let clickedPageIndex = -1;
        let pageRect: DOMRect | null = null;

        for (let i = 0; i < pageElements.length; i++) {
          const pageEl = pageElements[i];
          const rect = pageEl.getBoundingClientRect();
          if (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
          ) {
            clickedPageIndex = i;
            pageRect = rect;
            break;
          }
        }

        if (clickedPageIndex < 0 || !pageRect) {
          // Clicked outside all pages - position at end of document
          const view = hiddenPMRef.current.getView();
          if (view) {
            const endPos = view.state.doc.content.size - 1;
            hiddenPMRef.current.setSelection(Math.max(0, endPos));
          }
          hiddenPMRef.current.focus();
          setIsFocused(true);
          return;
        }

        // Get click position relative to the page element (not the container)
        const pageX = (e.clientX - pageRect.left) / zoom;
        const pageY = (e.clientY - pageRect.top) / zoom;

        // Get the page from layout
        const page = layout.pages[clickedPageIndex];
        if (!page) return;

        // Create a page hit result
        const pageHit = {
          pageIndex: clickedPageIndex,
          page,
          pageY,
        };

        // Hit test fragment within page using page-relative coordinates
        const fragmentHit = hitTestFragment(pageHit, blocks, measures, {
          x: pageX,
          y: pageY,
        });

        if (!fragmentHit) {
          // Clicked on empty page area - position at end of document
          const view = hiddenPMRef.current.getView();
          if (view) {
            const endPos = view.state.doc.content.size - 1;
            hiddenPMRef.current.setSelection(Math.max(0, endPos));
          }
          hiddenPMRef.current.focus();
          setIsFocused(true);
          return;
        }

        // Map click to PM position
        const pmPosition = clickToPosition(fragmentHit);
        if (pmPosition !== null) {
          hiddenPMRef.current.setSelection(pmPosition);
        }

        // Focus the hidden editor
        hiddenPMRef.current.focus();
        setIsFocused(true);
      },
      [layout, blocks, measures, zoom]
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
     * Handle mousedown on container to prepare for click handling.
     * This ensures the editor captures focus before the click event.
     */
    const handleMouseDown = useCallback(() => {
      // Focus hidden PM immediately on mousedown for better responsiveness
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
        onMouseDown={handleMouseDown}
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
