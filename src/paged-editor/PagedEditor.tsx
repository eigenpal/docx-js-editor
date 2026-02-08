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
import { CellSelection } from 'prosemirror-tables';
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
  TableMeasure,
  ImageBlock,
  ImageRun,
  PageMargins,
  Run,
  RunFormatting,
  ParagraphAttrs,
} from '../layout-engine/types';

// Layout bridge
import { toFlowBlocks } from '../layout-bridge/toFlowBlocks';
import {
  measureParagraph,
  resetCanvasContext,
  clearAllCaches,
  type FloatingImageZone,
} from '../layout-bridge/measuring';
import { hitTestFragment, hitTestTableCell } from '../layout-bridge/hitTest';
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
import { LayoutSelectionGate } from './LayoutSelectionGate';

// Visual line navigation hook
import { useVisualLineNavigation } from './useVisualLineNavigation';

// Types
import type {
  Document,
  Theme,
  StyleDefinitions,
  SectionProperties,
  HeaderFooter,
} from '../types/document';
import type { RenderedDomContext } from '../plugin-api/types';
import { createRenderedDomContext } from '../plugin-api/RenderedDomContext';

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
  /** Extension manager for plugins/schema/commands (optional — falls back to default) */
  extensionManager?: import('../prosemirror/extensions/ExtensionManager').ExtensionManager;
  /** Callback when editor is ready. */
  onReady?: (ref: PagedEditorRef) => void;
  /** Callback when rendered DOM context is ready. */
  onRenderedDomContextReady?: (context: RenderedDomContext) => void;
  /** Plugin overlays to render inside the viewport. */
  pluginOverlays?: React.ReactNode;
  /** Callback when header or footer is double-clicked for editing. */
  onHeaderFooterDoubleClick?: (position: 'header' | 'footer') => void;
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
  backgroundColor: 'var(--doc-bg, #f8f9fa)',
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

const pluginOverlaysStyles: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
  overflow: 'visible',
  zIndex: 8,
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
  const top = sectionProps?.marginTop ? twipsToPixels(sectionProps.marginTop) : DEFAULT_MARGINS.top;
  const bottom = sectionProps?.marginBottom
    ? twipsToPixels(sectionProps.marginBottom)
    : DEFAULT_MARGINS.bottom;

  return {
    top,
    right: sectionProps?.marginRight
      ? twipsToPixels(sectionProps.marginRight)
      : DEFAULT_MARGINS.right,
    bottom,
    left: sectionProps?.marginLeft ? twipsToPixels(sectionProps.marginLeft) : DEFAULT_MARGINS.left,
    // Header/footer distances - where the header/footer content starts
    // Default to 0.5 inch (48px at 96 DPI) if not specified
    header: sectionProps?.headerDistance ? twipsToPixels(sectionProps.headerDistance) : 48,
    footer: sectionProps?.footerDistance ? twipsToPixels(sectionProps.footerDistance) : 48,
  };
}

/**
 * Check if an image run is a floating image (should affect text wrapping)
 */
function isFloatingImageRun(run: ImageRun): boolean {
  const wrapType = run.wrapType;
  const displayMode = run.displayMode;

  // Floating images have specific wrap types that allow text to flow around them
  if (wrapType && ['square', 'tight', 'through'].includes(wrapType)) {
    return true;
  }

  // Or explicit float display mode
  if (displayMode === 'float') {
    return true;
  }

  return false;
}

/**
 * EMU to pixels conversion
 */
function emuToPixels(emu: number | undefined): number {
  if (emu === undefined) return 0;
  return Math.round((emu * 96) / 914400);
}

function resolveTableWidthPx(
  width: number | undefined,
  widthType: string | undefined,
  contentWidth: number
): number | undefined {
  if (!width) return undefined;
  if (widthType === 'pct') {
    // width is in 50ths of a percent (5000 = 100%)
    return (contentWidth * width) / 5000;
  }
  if (widthType === 'dxa' || !widthType || widthType === 'auto') {
    return Math.round((width / 20) * 1.333);
  }
  return undefined;
}

function measureTableBlock(tableBlock: TableBlock, contentWidth: number): TableMeasure {
  const TABLE_CELL_PADDING_Y = Math.round((108 / 20) * 1.333);
  const TABLE_CELL_PADDING_X = Math.round((108 / 20) * 1.333);
  const TABLE_MIN_ROW_HEIGHT = 24;

  // columnWidths are already in pixels (converted in toFlowBlocks)
  let columnWidths = tableBlock.columnWidths ?? [];
  const explicitWidthPx = resolveTableWidthPx(tableBlock.width, tableBlock.widthType, contentWidth);

  if (columnWidths.length === 0 && tableBlock.rows.length > 0) {
    // Determine total columns from first row's colSpans
    const colCount = tableBlock.rows[0].cells.reduce((sum, cell) => sum + (cell.colSpan ?? 1), 0);
    const totalWidth = explicitWidthPx ?? contentWidth;
    const equalWidth = totalWidth / Math.max(1, colCount);
    columnWidths = Array(colCount).fill(equalWidth);
  } else if (columnWidths.length > 0 && explicitWidthPx) {
    const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);
    if (totalWidth > 0 && Math.abs(totalWidth - explicitWidthPx) > 1) {
      const scale = explicitWidthPx / totalWidth;
      columnWidths = columnWidths.map((w) => w * scale);
    }
  }

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

        const cellContentWidth = Math.max(1, cellWidth - TABLE_CELL_PADDING_X * 2);
        return {
          blocks: cell.blocks.map((b) => measureBlock(b, cellContentWidth)),
          width: cellWidth,
          height: 0, // Calculated below
          colSpan: cell.colSpan,
          rowSpan: cell.rowSpan,
        };
      }),
      height: 0,
    };
  });

  // Calculate cell heights, respecting explicit row height rules
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    let maxHeight = 0;
    for (const cell of row.cells) {
      cell.height = cell.blocks.reduce((h, m) => {
        // Get height from any measure type (paragraph or table)
        if ('totalHeight' in m) return h + m.totalHeight;
        return h;
      }, 0);
      cell.height += TABLE_CELL_PADDING_Y * 2;
      maxHeight = Math.max(maxHeight, cell.height);
    }

    // Apply heightRule from the source row
    const sourceRow = tableBlock.rows[rowIdx];
    const explicitHeight = sourceRow?.height;
    const heightRule = sourceRow?.heightRule;

    if (explicitHeight && heightRule === 'exact') {
      row.height = explicitHeight;
    } else if (explicitHeight && heightRule === 'atLeast') {
      row.height = Math.max(maxHeight, explicitHeight);
    } else {
      row.height = Math.max(maxHeight, TABLE_MIN_ROW_HEIGHT);
    }
  }

  const totalHeight = rows.reduce((h, r) => h + r.height, 0);
  const totalWidth = columnWidths.reduce((w, cw) => w + cw, 0) || explicitWidthPx || contentWidth;

  return {
    kind: 'table',
    rows,
    columnWidths,
    totalWidth,
    totalHeight,
  };
}

/**
 * Extract floating image exclusion zones from all blocks.
 * Called before measurement to determine line width reductions.
 *
 * For images with vertical align="top" relative to margin, they're at Y=0.
 * The exclusion zones define the areas where text lines need reduced widths.
 */
/**
 * Extended floating zone info that includes anchor block index
 */
interface FloatingZoneWithAnchor extends FloatingImageZone {
  /** Block index where this floating image is anchored */
  anchorBlockIndex: number;
  /** If true, zone is positioned relative to margin/page and applies to all blocks */
  isMarginRelative?: boolean;
}

function extractFloatingZones(blocks: FlowBlock[], contentWidth: number): FloatingZoneWithAnchor[] {
  const zones: FloatingZoneWithAnchor[] = [];

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex];
    if (block.kind !== 'paragraph') continue;

    const paragraphBlock = block as ParagraphBlock;

    for (const run of paragraphBlock.runs) {
      if (run.kind !== 'image') continue;
      const imgRun = run as ImageRun;

      if (!isFloatingImageRun(imgRun)) continue;

      // Calculate Y position based on vertical alignment
      let topY = 0;
      const position = imgRun.position;
      const distTop = imgRun.distTop ?? 0;
      const distBottom = imgRun.distBottom ?? 0;
      const distLeft = imgRun.distLeft ?? 12;
      const distRight = imgRun.distRight ?? 12;

      if (position?.vertical) {
        const v = position.vertical;
        if (v.align === 'top' && v.relativeTo === 'margin') {
          // Image at top of content area
          topY = 0;
        } else if (v.posOffset !== undefined) {
          topY = emuToPixels(v.posOffset);
        }
        // Other cases (paragraph-relative) are harder to handle without knowing paragraph positions
      }

      const bottomY = topY + imgRun.height;

      // Calculate margins based on horizontal position
      let leftMargin = 0;
      let rightMargin = 0;

      if (position?.horizontal) {
        const h = position.horizontal;
        if (h.align === 'left') {
          // Image on left - text needs left margin
          leftMargin = imgRun.width + distRight;
        } else if (h.align === 'right') {
          // Image on right - text needs right margin
          rightMargin = imgRun.width + distLeft;
        } else if (h.posOffset !== undefined) {
          const x = emuToPixels(h.posOffset);
          if (x < contentWidth / 2) {
            leftMargin = x + imgRun.width + distRight;
          } else {
            rightMargin = contentWidth - x + distLeft;
          }
        }
      } else if (imgRun.cssFloat === 'left') {
        leftMargin = imgRun.width + distRight;
      } else if (imgRun.cssFloat === 'right') {
        rightMargin = imgRun.width + distLeft;
      }

      if (leftMargin > 0 || rightMargin > 0) {
        // Images positioned relative to margin/page apply globally (before their anchor paragraph)
        const isMarginRelative =
          position?.vertical?.relativeTo === 'margin' || position?.vertical?.relativeTo === 'page';
        zones.push({
          leftMargin,
          rightMargin,
          topY: topY - distTop,
          bottomY: bottomY + distBottom,
          anchorBlockIndex: blockIndex,
          isMarginRelative,
        });
      }
    }
  }

  // Floating tables (block-level) - treat them as exclusion zones for subsequent text
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex];
    if (block.kind !== 'table') continue;

    const tableBlock = block as TableBlock;
    const floating = tableBlock.floating;
    if (!floating) continue;

    const tableMeasure = measureTableBlock(tableBlock, contentWidth);
    const tableWidth = tableMeasure.totalWidth;
    const tableHeight = tableMeasure.totalHeight;

    const distLeft = floating.leftFromText ?? 12;
    const distRight = floating.rightFromText ?? 12;
    const distTop = floating.topFromText ?? 0;
    const distBottom = floating.bottomFromText ?? 0;

    let leftMargin = 0;
    let rightMargin = 0;

    // Determine horizontal position relative to content area
    let x = 0;
    if (floating.tblpX !== undefined) {
      x = floating.tblpX;
    } else if (floating.tblpXSpec) {
      if (floating.tblpXSpec === 'left' || floating.tblpXSpec === 'inside') {
        x = 0;
      } else if (floating.tblpXSpec === 'right' || floating.tblpXSpec === 'outside') {
        x = contentWidth - tableWidth;
      } else if (floating.tblpXSpec === 'center') {
        x = (contentWidth - tableWidth) / 2;
      }
    } else if (tableBlock.justification === 'center') {
      x = (contentWidth - tableWidth) / 2;
    } else if (tableBlock.justification === 'right') {
      x = contentWidth - tableWidth;
    }

    if (x < contentWidth / 2) {
      leftMargin = x + tableWidth + distRight;
    } else {
      rightMargin = contentWidth - x + distLeft;
    }

    const topY = floating.tblpY ?? 0;
    const bottomY = topY + tableHeight;

    zones.push({
      leftMargin,
      rightMargin,
      topY: topY - distTop,
      bottomY: bottomY + distBottom,
      anchorBlockIndex: blockIndex,
    });
  }

  return zones;
}

/**
 * Measure a block based on its type.
 */
function measureBlock(
  block: FlowBlock,
  contentWidth: number,
  floatingZones?: FloatingImageZone[],
  cumulativeY?: number
): Measure {
  switch (block.kind) {
    case 'paragraph':
      return measureParagraph(block as ParagraphBlock, contentWidth, {
        floatingZones,
        paragraphYOffset: cumulativeY ?? 0,
      });

    case 'table': {
      return measureTableBlock(block as TableBlock, contentWidth);
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
 * Measure all blocks with floating image support.
 *
 * Pre-scans all blocks to find floating images and creates exclusion zones.
 * Then measures each block, passing the zones so paragraphs can calculate
 * per-line widths based on vertical overlap with floating images.
 */
function measureBlocks(blocks: FlowBlock[], contentWidth: number): Measure[] {
  // Pre-extract floating image exclusion zones with anchor block indices
  const floatingZonesWithAnchors = extractFloatingZones(blocks, contentWidth);

  // Find the anchor block indices where paragraph-relative floating zones become active
  const anchorIndices = new Set(
    floatingZonesWithAnchors.filter((z) => !z.isMarginRelative).map((z) => z.anchorBlockIndex)
  );

  // Separate margin-relative zones (apply globally) from paragraph-relative zones
  const marginRelativeZones: FloatingImageZone[] = floatingZonesWithAnchors
    .filter((z) => z.isMarginRelative)
    .map((z) => ({
      leftMargin: z.leftMargin,
      rightMargin: z.rightMargin,
      topY: z.topY,
      bottomY: z.bottomY,
    }));

  const paragraphRelativeZones: FloatingImageZone[] = floatingZonesWithAnchors
    .filter((z) => !z.isMarginRelative)
    .map((z) => ({
      leftMargin: z.leftMargin,
      rightMargin: z.rightMargin,
      topY: z.topY,
      bottomY: z.bottomY,
    }));

  // Track cumulative Y position for floating zone overlap calculation
  // This resets when we reach a block with page-level floating images
  let cumulativeY = 0;
  let paragraphZonesActive = false;

  return blocks.map((block, blockIndex) => {
    // Check if this block is an anchor for paragraph-relative floating images
    // If so, reset cumulative Y so zones apply from this point
    if (anchorIndices.has(blockIndex)) {
      cumulativeY = 0;
      paragraphZonesActive = true;
    }

    // Margin-relative zones always apply; paragraph-relative only after anchor
    const activeZones = [
      ...marginRelativeZones,
      ...(paragraphZonesActive ? paragraphRelativeZones : []),
    ];
    const zones = activeZones.length > 0 ? activeZones : undefined;

    try {
      const blockStart = performance.now();
      const measure = measureBlock(block, contentWidth, zones, cumulativeY);
      const blockTime = performance.now() - blockStart;
      if (blockTime > 500) {
        console.warn(
          `[measureBlocks] Block ${blockIndex} (${block.kind}) took ${Math.round(blockTime)}ms`
        );
      }

      // Update cumulative Y for next block
      if ('totalHeight' in measure) {
        if (!(block.kind === 'table' && (block as TableBlock).floating)) {
          cumulativeY += measure.totalHeight;
        }
      }

      return measure;
    } catch (error) {
      console.error(`[measureBlocks] Error measuring block ${blockIndex} (${block.kind}):`, error);
      // Return a minimal measure so we don't crash the entire layout
      return { totalHeight: 20 } as Measure;
    }
  });
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
        } else if (rc.type === 'drawing' && rc.image) {
          // Handle images/drawings
          const image = rc.image as Record<string, unknown>;
          const size = image.size as { width: number; height: number } | undefined;
          // EMU to pixels: 1 inch = 914400 EMU, 1 inch = 96 pixels
          const emuToPixels = (emu: number) => Math.round((emu / 914400) * 96);
          const widthPx = size?.width ? emuToPixels(size.width) : 100;
          const heightPx = size?.height ? emuToPixels(size.height) : 100;

          // Check for position (floating/anchored images)
          const position = image.position as
            | {
                horizontal?: { relativeTo?: string; posOffset?: number; align?: string };
                vertical?: { relativeTo?: string; posOffset?: number; align?: string };
              }
            | undefined;

          runs.push({
            kind: 'image',
            src: (image.src as string) || '',
            width: widthPx,
            height: heightPx,
            alt: (image.alt as string) || undefined,
            // Include position for floating images
            position: position
              ? {
                  horizontal: position.horizontal,
                  vertical: position.vertical,
                }
              : undefined,
          } as Run);
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
      extensionManager,
      onReady,
      onRenderedDomContextReady,
      pluginOverlays,
      onHeaderFooterDoubleClick,
      className,
      style,
    } = props;

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const pagesContainerRef = useRef<HTMLDivElement>(null);
    const hiddenPMRef = useRef<HiddenProseMirrorRef>(null);
    const painterRef = useRef<LayoutPainter | null>(null);

    // Visual line navigation (ArrowUp/ArrowDown with sticky X)
    const { handlePMKeyDown } = useVisualLineNavigation({ pagesContainerRef });

    // Store callbacks in refs to avoid infinite re-render loops
    // when parent passes unstable callback references
    const onSelectionChangeRef = useRef(onSelectionChange);
    const onDocumentChangeRef = useRef(onDocumentChange);
    const onReadyRef = useRef(onReady);
    const onRenderedDomContextReadyRef = useRef(onRenderedDomContextReady);

    // Keep refs in sync with latest props
    onSelectionChangeRef.current = onSelectionChange;
    onDocumentChangeRef.current = onDocumentChange;
    onReadyRef.current = onReady;
    onRenderedDomContextReadyRef.current = onRenderedDomContextReady;

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

    // Column resize state
    const isResizingColumnRef = useRef(false);
    const resizeStartXRef = useRef(0);
    const resizeColumnIndexRef = useRef(0);
    const resizeTablePmStartRef = useRef(0);
    const resizeOrigWidthsRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
    const resizeHandleRef = useRef<HTMLElement | null>(null);

    // Row resize state
    const isResizingRowRef = useRef(false);
    const resizeStartYRef = useRef(0);
    const resizeRowIndexRef = useRef(0);
    const resizeRowTablePmStartRef = useRef(0);
    const resizeRowOrigHeightRef = useRef(0); // twips
    const resizeRowHandleRef = useRef<HTMLElement | null>(null);
    const resizeRowIsEdgeRef = useRef(false);

    // Right edge resize state (grows last column only)
    const isResizingRightEdgeRef = useRef(false);
    const resizeRightEdgeStartXRef = useRef(0);
    const resizeRightEdgeColIndexRef = useRef(0);
    const resizeRightEdgePmStartRef = useRef(0);
    const resizeRightEdgeOrigWidthRef = useRef(0); // twips
    const resizeRightEdgeHandleRef = useRef<HTMLElement | null>(null);

    // Cell selection drag state
    const isCellDraggingRef = useRef(false);
    const cellDragAnchorPosRef = useRef<number | null>(null);

    // Selection gate - ensures selection renders only when layout is current
    const syncCoordinator = useMemo(() => new LayoutSelectionGate(), []);

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
        const pipelineStart = performance.now();

        // Capture current state sequence for this layout run
        const currentEpoch = syncCoordinator.getStateSeq();

        // Signal layout is starting
        syncCoordinator.onLayoutStart();

        try {
          // Step 1: Convert PM doc to flow blocks
          let stepStart = performance.now();
          const newBlocks = toFlowBlocks(state.doc, { theme: _theme });
          let stepTime = performance.now() - stepStart;
          if (stepTime > 500) {
            console.warn(
              `[PagedEditor] toFlowBlocks took ${Math.round(stepTime)}ms (${newBlocks.length} blocks)`
            );
          }
          setBlocks(newBlocks);

          // Step 2: Measure all blocks
          stepStart = performance.now();
          const newMeasures = measureBlocks(newBlocks, contentWidth);
          stepTime = performance.now() - stepStart;
          if (stepTime > 1000) {
            console.warn(
              `[PagedEditor] measureBlocks took ${Math.round(stepTime)}ms (${newBlocks.length} blocks)`
            );
          }
          setMeasures(newMeasures);

          // Step 3: Layout blocks onto pages
          // Use document margins directly for WYSIWYG fidelity (matches Word behavior)
          stepStart = performance.now();
          const newLayout = layoutDocument(newBlocks, newMeasures, {
            pageSize,
            margins,
          });
          stepTime = performance.now() - stepStart;
          if (stepTime > 500) {
            console.warn(
              `[PagedEditor] layoutDocument took ${Math.round(stepTime)}ms (${newLayout.pages.length} pages)`
            );
          }
          setLayout(newLayout);

          // Step 3.5: Prepare header/footer content for rendering
          const headerContentForRender = convertHeaderFooterToContent(headerContent, contentWidth);
          const footerContentForRender = convertHeaderFooterToContent(footerContent, contentWidth);

          // Step 4: Paint to DOM
          if (pagesContainerRef.current && painterRef.current) {
            stepStart = performance.now();

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

            // Render pages to container (using header/footer content computed above)
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
              pageBorders: sectionProperties?.pageBorders,
              theme: _theme,
            } as RenderPageOptions & { pageGap?: number; blockLookup?: BlockLookup });

            stepTime = performance.now() - stepStart;
            if (stepTime > 500) {
              console.warn(`[PagedEditor] renderPages took ${Math.round(stepTime)}ms`);
            }

            // Create and expose RenderedDomContext after DOM is painted
            if (onRenderedDomContextReady) {
              const domContext = createRenderedDomContext(pagesContainerRef.current, zoom);
              onRenderedDomContextReady(domContext);
            }
          }

          const totalTime = performance.now() - pipelineStart;
          if (totalTime > 2000) {
            console.warn(
              `[PagedEditor] Layout pipeline took ${Math.round(totalTime)}ms total ` +
                `(${newBlocks.length} blocks, ${newMeasures.length} measures)`
            );
          }
        } catch (error) {
          console.error('[PagedEditor] Layout pipeline error:', error);
        }

        // Signal layout is complete for this sequence
        syncCoordinator.onLayoutComplete(currentEpoch);
      },
      [
        contentWidth,
        pageSize,
        margins,
        pageGap,
        zoom,
        syncCoordinator,
        headerContent,
        footerContent,
        sectionProperties,
        onRenderedDomContextReady,
      ]
    );

    /**
     * Get caret position using DOM-based measurement.
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
        const { from, to } = state.selection;

        // Always notify selection change (for toolbar sync) even if layout not ready
        // Use ref to avoid infinite loops when callback is unstable
        onSelectionChangeRef.current?.(from, to);

        // Update visual cell selection highlighting on visible layout table cells
        if (pagesContainerRef.current) {
          // Clear previous cell highlighting
          const prevSelected = pagesContainerRef.current.querySelectorAll(
            '.layout-table-cell-selected'
          );
          for (const el of Array.from(prevSelected)) {
            el.classList.remove('layout-table-cell-selected');
          }

          // If CellSelection, highlight the corresponding visible cells
          // Use duck-typing ($anchorCell) instead of instanceof to avoid bundling issues
          const sel = state.selection as CellSelection;
          const isCellSel = '$anchorCell' in sel && typeof sel.forEachCell === 'function';
          if (isCellSel) {
            // Collect ranges [cellStart, cellEnd) for each selected cell
            const selectedRanges: Array<[number, number]> = [];
            sel.forEachCell((node, pos) => {
              selectedRanges.push([pos, pos + node.nodeSize]);
            });

            // Find visible layout cells whose pmStart falls inside a selected cell range
            const allCells = pagesContainerRef.current.querySelectorAll('.layout-table-cell');
            for (const cellEl of Array.from(allCells)) {
              const htmlEl = cellEl as HTMLElement;
              const pmStartAttr = htmlEl.dataset.pmStart;
              if (pmStartAttr !== undefined) {
                const pmPos = Number(pmStartAttr);
                for (const [start, end] of selectedRanges) {
                  if (pmPos >= start && pmPos < end) {
                    htmlEl.classList.add('layout-table-cell-selected');
                    break;
                  }
                }
              }
            }
          }
        }

        if (!layout || blocks.length === 0) return;

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
      },
      [layout, blocks, measures, getCaretFromDom]
      // NOTE: onSelectionChange removed from dependencies - accessed via ref to prevent infinite loops
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
          // Increment state sequence to signal document changed
          syncCoordinator.incrementStateSeq();

          // Content changed - full layout
          runLayoutPipeline(newState);

          // Notify document change - use ref to avoid infinite loops
          const newDoc = hiddenPMRef.current?.getDocument();
          if (newDoc) {
            onDocumentChangeRef.current?.(newDoc);
          }
        }

        // Request selection update (will only execute when layout is current)
        syncCoordinator.requestRender();
        updateSelectionOverlay(newState);
      },
      [runLayoutPipeline, updateSelectionOverlay, syncCoordinator]
      // NOTE: onDocumentChange removed from dependencies - accessed via ref to prevent infinite loops
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

        // For table fragments, do cell-level hit testing
        if (fragmentHit.fragment.kind === 'table') {
          const tableCellHit = hitTestTableCell(pageHit, blocks, measures, {
            x: pageX,
            y: pageY,
          });
          return clickToPosition(fragmentHit, tableCellHit);
        }

        return clickToPosition(fragmentHit);
      },
      [layout, blocks, measures, zoom]
    );

    /**
     * Find the table cell position in ProseMirror doc for a given PM position.
     * Returns the position just inside the cell node, suitable for CellSelection.create().
     */
    const findCellPosFromPmPos = useCallback((pmPos: number): number | null => {
      const view = hiddenPMRef.current?.getView();
      if (!view) return null;
      try {
        const $pos = view.state.doc.resolve(pmPos);
        for (let d = $pos.depth; d > 0; d--) {
          const node = $pos.node(d);
          if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
            // Return position of the cell node itself (before(d)).
            // CellSelection.create will resolve this and use cellAround() internally.
            return $pos.before(d);
          }
        }
      } catch {
        // Position resolution failed
      }
      return null;
    }, []);

    /**
     * Handle mousedown on pages - start selection or drag.
     */
    const handlePagesMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!hiddenPMRef.current || e.button !== 0) return; // Only handle left click
        if (readOnly) return;

        // Column resize: intercept clicks on resize handles
        const target = e.target as HTMLElement;
        if (target.classList.contains('layout-table-resize-handle')) {
          e.preventDefault();
          e.stopPropagation();
          isResizingColumnRef.current = true;
          resizeStartXRef.current = e.clientX;
          resizeHandleRef.current = target;
          target.classList.add('dragging');

          const colIndex = parseInt(target.dataset.columnIndex ?? '0', 10);
          resizeColumnIndexRef.current = colIndex;
          resizeTablePmStartRef.current = parseInt(target.dataset.tablePmStart ?? '0', 10);

          // Get current column widths from the ProseMirror doc
          const view = hiddenPMRef.current.getView();
          if (view) {
            const $pos = view.state.doc.resolve(resizeTablePmStartRef.current + 1);
            for (let d = $pos.depth; d >= 0; d--) {
              const node = $pos.node(d);
              if (node.type.name === 'table') {
                const widths = node.attrs.columnWidths as number[] | null;
                if (
                  widths &&
                  widths[colIndex] !== undefined &&
                  widths[colIndex + 1] !== undefined
                ) {
                  resizeOrigWidthsRef.current = {
                    left: widths[colIndex],
                    right: widths[colIndex + 1],
                  };
                }
                break;
              }
            }
          }
          return;
        }

        // Row resize: intercept clicks on row resize handles or bottom edge handle
        if (
          target.classList.contains('layout-table-row-resize-handle') ||
          target.classList.contains('layout-table-edge-handle-bottom')
        ) {
          e.preventDefault();
          e.stopPropagation();
          isResizingRowRef.current = true;
          resizeStartYRef.current = e.clientY;
          resizeRowHandleRef.current = target;
          resizeRowIsEdgeRef.current = target.dataset.isEdge === 'bottom';
          target.classList.add('dragging');

          const rowIndex = parseInt(target.dataset.rowIndex ?? '0', 10);
          resizeRowIndexRef.current = rowIndex;
          resizeRowTablePmStartRef.current = parseInt(target.dataset.tablePmStart ?? '0', 10);

          // Get current row height from ProseMirror doc
          const view = hiddenPMRef.current.getView();
          if (view) {
            const $pos = view.state.doc.resolve(resizeRowTablePmStartRef.current + 1);
            for (let d = $pos.depth; d >= 0; d--) {
              const node = $pos.node(d);
              if (node.type.name === 'table') {
                let rowNode: typeof node | null = null;
                let idx = 0;
                node.forEach((child) => {
                  if (idx === rowIndex) rowNode = child;
                  idx++;
                });
                if (rowNode) {
                  const height = (rowNode as typeof node).attrs.height as number | null;
                  if (height) {
                    resizeRowOrigHeightRef.current = height;
                  } else {
                    // Estimate from rendered height: find the row element
                    const tableEl = target.closest('.layout-table');
                    const rowEl = tableEl?.querySelector(`[data-row-index="${rowIndex}"]`);
                    const renderedHeight = rowEl
                      ? (rowEl as HTMLElement).getBoundingClientRect().height
                      : 30;
                    resizeRowOrigHeightRef.current = Math.round(renderedHeight * 15);
                  }
                }
                break;
              }
            }
          }
          return;
        }

        // Right edge resize: intercept clicks on right edge handle
        if (target.classList.contains('layout-table-edge-handle-right')) {
          e.preventDefault();
          e.stopPropagation();
          isResizingRightEdgeRef.current = true;
          resizeRightEdgeStartXRef.current = e.clientX;
          resizeRightEdgeHandleRef.current = target;
          target.classList.add('dragging');

          const colIndex = parseInt(target.dataset.columnIndex ?? '0', 10);
          resizeRightEdgeColIndexRef.current = colIndex;
          resizeRightEdgePmStartRef.current = parseInt(target.dataset.tablePmStart ?? '0', 10);

          // Get current last column width from ProseMirror doc
          const view = hiddenPMRef.current.getView();
          if (view) {
            const $pos = view.state.doc.resolve(resizeRightEdgePmStartRef.current + 1);
            for (let d = $pos.depth; d >= 0; d--) {
              const node = $pos.node(d);
              if (node.type.name === 'table') {
                const widths = node.attrs.columnWidths as number[] | null;
                if (widths && widths[colIndex] !== undefined) {
                  resizeRightEdgeOrigWidthRef.current = widths[colIndex];
                }
                break;
              }
            }
          }
          return;
        }

        e.preventDefault(); // Prevent native text selection

        const pmPos = getPositionFromMouse(e.clientX, e.clientY);

        if (pmPos !== null) {
          // Check if click is inside a table cell - track for potential cell drag selection
          const cellPos = findCellPosFromPmPos(pmPos);
          if (cellPos !== null) {
            cellDragAnchorPosRef.current = cellPos;
          } else {
            cellDragAnchorPosRef.current = null;
          }
          isCellDraggingRef.current = false;

          // Start dragging
          isDraggingRef.current = true;
          dragAnchorRef.current = pmPos;

          // Set initial selection (collapsed)
          hiddenPMRef.current.setSelection(pmPos);
        } else {
          // Clicked outside content - move to end
          cellDragAnchorPosRef.current = null;
          isCellDraggingRef.current = false;
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
      [getPositionFromMouse, findCellPosFromPmPos, readOnly]
    );

    /**
     * Handle mousemove - extend selection during drag.
     */
    const handleMouseMove = useCallback(
      (e: MouseEvent) => {
        // Column resize drag
        if (isResizingColumnRef.current) {
          e.preventDefault();
          const delta = e.clientX - resizeStartXRef.current;
          // Move the handle visually
          if (resizeHandleRef.current) {
            const origLeft = parseFloat(resizeHandleRef.current.style.left);
            resizeHandleRef.current.style.left = `${origLeft + delta}px`;
            resizeStartXRef.current = e.clientX;

            // Update stored widths (convert pixel delta to twips: 1px ≈ 15 twips at 96dpi)
            const deltaTwips = Math.round(delta * 15);
            const minWidth = 300; // ~0.2 inches minimum
            const newLeft = resizeOrigWidthsRef.current.left + deltaTwips;
            const newRight = resizeOrigWidthsRef.current.right - deltaTwips;
            if (newLeft >= minWidth && newRight >= minWidth) {
              resizeOrigWidthsRef.current = { left: newLeft, right: newRight };
            }
          }
          return;
        }

        // Row resize drag
        if (isResizingRowRef.current) {
          e.preventDefault();
          const delta = e.clientY - resizeStartYRef.current;
          if (resizeRowHandleRef.current) {
            const origTop = parseFloat(resizeRowHandleRef.current.style.top);
            resizeRowHandleRef.current.style.top = `${origTop + delta}px`;
            resizeStartYRef.current = e.clientY;

            // Update stored height (convert pixel delta to twips)
            const deltaTwips = Math.round(delta * 15);
            const minHeight = 200; // ~0.14 inches minimum
            const newHeight = resizeRowOrigHeightRef.current + deltaTwips;
            if (newHeight >= minHeight) {
              resizeRowOrigHeightRef.current = newHeight;
            }
          }
          return;
        }

        // Right edge resize drag
        if (isResizingRightEdgeRef.current) {
          e.preventDefault();
          const delta = e.clientX - resizeRightEdgeStartXRef.current;
          if (resizeRightEdgeHandleRef.current) {
            const origLeft = parseFloat(resizeRightEdgeHandleRef.current.style.left);
            resizeRightEdgeHandleRef.current.style.left = `${origLeft + delta}px`;
            resizeRightEdgeStartXRef.current = e.clientX;

            // Update stored width (convert pixel delta to twips)
            const deltaTwips = Math.round(delta * 15);
            const minWidth = 300; // ~0.2 inches minimum
            const newWidth = resizeRightEdgeOrigWidthRef.current + deltaTwips;
            if (newWidth >= minWidth) {
              resizeRightEdgeOrigWidthRef.current = newWidth;
            }
          }
          return;
        }

        if (!isDraggingRef.current || dragAnchorRef.current === null) return;
        if (!hiddenPMRef.current || !pagesContainerRef.current) return;

        const pmPos = getPositionFromMouse(e.clientX, e.clientY);
        if (pmPos === null) return;

        // Check if we're dragging across table cells
        if (cellDragAnchorPosRef.current !== null) {
          const currentCellPos = findCellPosFromPmPos(pmPos);
          if (currentCellPos !== null && currentCellPos !== cellDragAnchorPosRef.current) {
            isCellDraggingRef.current = true;
            hiddenPMRef.current.setCellSelection(cellDragAnchorPosRef.current, currentCellPos);
            return;
          }
          // If already in cell-drag mode but still moving, update head cell
          if (isCellDraggingRef.current && currentCellPos !== null) {
            hiddenPMRef.current.setCellSelection(cellDragAnchorPosRef.current, currentCellPos);
            return;
          }
        }

        // Regular text selection drag
        const anchor = dragAnchorRef.current;
        hiddenPMRef.current.setSelection(anchor, pmPos);
      },
      [getPositionFromMouse, findCellPosFromPmPos]
    );

    /**
     * Handle mouseup - end drag selection.
     */
    const handleMouseUp = useCallback(() => {
      // Commit column resize
      if (isResizingColumnRef.current) {
        isResizingColumnRef.current = false;
        if (resizeHandleRef.current) {
          resizeHandleRef.current.classList.remove('dragging');
          resizeHandleRef.current = null;
        }

        // Update ProseMirror document with new column widths
        const view = hiddenPMRef.current?.getView();
        if (view) {
          const pmStart = resizeTablePmStartRef.current;
          const colIdx = resizeColumnIndexRef.current;
          const { left: newLeft, right: newRight } = resizeOrigWidthsRef.current;

          // Find the table node and update columnWidths + cell widths
          const $pos = view.state.doc.resolve(pmStart + 1);
          for (let d = $pos.depth; d >= 0; d--) {
            const node = $pos.node(d);
            if (node.type.name === 'table') {
              const tablePos = $pos.before(d);
              const tr = view.state.tr;
              const widths = [...(node.attrs.columnWidths as number[])];
              widths[colIdx] = newLeft;
              widths[colIdx + 1] = newRight;

              // Update table columnWidths attr
              tr.setNodeMarkup(tablePos, undefined, {
                ...node.attrs,
                columnWidths: widths,
              });

              // Update cell width attrs in each row
              let rowOffset = tablePos + 1;
              node.forEach((row) => {
                let cellOffset = rowOffset + 1;
                let cellColIdx = 0;
                row.forEach((cell) => {
                  const colspan = (cell.attrs.colspan as number) || 1;
                  if (cellColIdx === colIdx || cellColIdx === colIdx + 1) {
                    const newWidth = cellColIdx === colIdx ? newLeft : newRight;
                    tr.setNodeMarkup(tr.mapping.map(cellOffset), undefined, {
                      ...cell.attrs,
                      width: newWidth,
                      widthType: 'dxa',
                      colwidth: null,
                    });
                  }
                  cellOffset += cell.nodeSize;
                  cellColIdx += colspan;
                });
                rowOffset += row.nodeSize;
              });

              view.dispatch(tr);
              break;
            }
          }
        }
        return;
      }

      // Commit row resize
      if (isResizingRowRef.current) {
        isResizingRowRef.current = false;
        if (resizeRowHandleRef.current) {
          resizeRowHandleRef.current.classList.remove('dragging');
          resizeRowHandleRef.current = null;
        }

        const view = hiddenPMRef.current?.getView();
        if (view) {
          const pmStart = resizeRowTablePmStartRef.current;
          const rowIdx = resizeRowIndexRef.current;
          const newHeight = resizeRowOrigHeightRef.current;

          const $pos = view.state.doc.resolve(pmStart + 1);
          for (let d = $pos.depth; d >= 0; d--) {
            const node = $pos.node(d);
            if (node.type.name === 'table') {
              const tablePos = $pos.before(d);
              const tr = view.state.tr;

              // Walk to the target row
              let rowOffset = tablePos + 1;
              let idx = 0;
              node.forEach((row) => {
                if (idx === rowIdx) {
                  tr.setNodeMarkup(tr.mapping.map(rowOffset), undefined, {
                    ...row.attrs,
                    height: newHeight,
                    heightRule: 'atLeast',
                  });
                }
                rowOffset += row.nodeSize;
                idx++;
              });

              view.dispatch(tr);
              break;
            }
          }
        }
        return;
      }

      // Commit right edge resize
      if (isResizingRightEdgeRef.current) {
        isResizingRightEdgeRef.current = false;
        if (resizeRightEdgeHandleRef.current) {
          resizeRightEdgeHandleRef.current.classList.remove('dragging');
          resizeRightEdgeHandleRef.current = null;
        }

        const view = hiddenPMRef.current?.getView();
        if (view) {
          const pmStart = resizeRightEdgePmStartRef.current;
          const colIdx = resizeRightEdgeColIndexRef.current;
          const newWidth = resizeRightEdgeOrigWidthRef.current;

          const $pos = view.state.doc.resolve(pmStart + 1);
          for (let d = $pos.depth; d >= 0; d--) {
            const node = $pos.node(d);
            if (node.type.name === 'table') {
              const tablePos = $pos.before(d);
              const tr = view.state.tr;

              // Update columnWidths — only change last column
              const widths = [...(node.attrs.columnWidths as number[])];
              widths[colIdx] = newWidth;

              tr.setNodeMarkup(tablePos, undefined, {
                ...node.attrs,
                columnWidths: widths,
              });

              // Update cell width attrs in the last column of each row
              let rowOffset = tablePos + 1;
              node.forEach((row) => {
                let cellOffset = rowOffset + 1;
                let cellColIdx = 0;
                row.forEach((cell) => {
                  const colspan = (cell.attrs.colspan as number) || 1;
                  if (cellColIdx === colIdx) {
                    tr.setNodeMarkup(tr.mapping.map(cellOffset), undefined, {
                      ...cell.attrs,
                      width: newWidth,
                      widthType: 'dxa',
                      colwidth: null,
                    });
                  }
                  cellOffset += cell.nodeSize;
                  cellColIdx += colspan;
                });
                rowOffset += row.nodeSize;
              });

              view.dispatch(tr);
              break;
            }
          }
        }
        return;
      }

      isDraggingRef.current = false;
      isCellDraggingRef.current = false;
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
        // Double-click on header/footer area triggers editing mode
        if (e.detail === 2 && onHeaderFooterDoubleClick) {
          const target = e.target as HTMLElement;
          const headerEl = target.closest('.layout-page-header');
          const footerEl = target.closest('.layout-page-footer');
          if (headerEl) {
            e.preventDefault();
            e.stopPropagation();
            onHeaderFooterDoubleClick('header');
            return;
          }
          if (footerEl) {
            e.preventDefault();
            e.stopPropagation();
            onHeaderFooterDoubleClick('footer');
            return;
          }
        }

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
      [getPositionFromMouse, onHeaderFooterDoubleClick]
    );

    /**
     * Handle focus on container - redirect to hidden PM.
     */
    const handleContainerFocus = useCallback(() => {
      if (readOnly) return;
      hiddenPMRef.current?.focus();
      setIsFocused(true);
    }, [readOnly]);

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
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (readOnly) return;
        // Ensure hidden PM is focused if user types
        if (!hiddenPMRef.current?.isFocused()) {
          hiddenPMRef.current?.focus();
          setIsFocused(true);
        }

        // Prevent space from scrolling the container - let PM handle it as text input
        if (e.key === ' ' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          // Forward to hidden PM by dispatching a native event
          const view = hiddenPMRef.current?.getView();
          if (view) {
            // Insert space text via PM transaction
            const { state, dispatch } = view;
            dispatch(state.tr.insertText(' '));
          }
          return;
        }

        // PageUp/PageDown - let container handle scrolling
        if (['PageUp', 'PageDown'].includes(e.key) && !e.metaKey && !e.ctrlKey) {
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
      },
      [readOnly]
    );

    /**
     * Handle mousedown on container (outside pages).
     */
    const handleContainerMouseDown = useCallback(() => {
      if (readOnly) return;
      // Focus hidden PM if clicking outside pages area
      if (!hiddenPMRef.current?.isFocused()) {
        hiddenPMRef.current?.focus();
        setIsFocused(true);
      }
    }, [readOnly]);

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

        // Auto-focus the editor so the user can start typing immediately
        if (!readOnly) {
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            view.focus();
            setIsFocused(true);
          });
        }
      },
      [runLayoutPipeline, updateSelectionOverlay, readOnly]
    );

    // Re-layout when web fonts finish loading to fix measurements that were
    // computed against fallback fonts during initial render.
    // Uses FontFaceSet.onloadingdone to detect when new fonts complete loading.
    useEffect(() => {
      const handleFontsLoaded = () => {
        const view = hiddenPMRef.current?.getView();
        if (view) {
          // Clear all cached measurements — font metrics have changed
          resetCanvasContext();
          clearAllCaches();
          runLayoutPipeline(view.state);
          updateSelectionOverlay(view.state);
        }
      };

      // Listen for font loading completion events
      window.document.fonts.addEventListener('loadingdone', handleFontsLoaded);
      return () => {
        window.document.fonts.removeEventListener('loadingdone', handleFontsLoaded);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-compute selection overlay when the container resizes.
    // Page elements shift during window resize (centering, scrollbar changes),
    // causing caret/selection coordinates to become stale.
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new ResizeObserver(() => {
        const state = hiddenPMRef.current?.getState();
        if (state) {
          updateSelectionOverlay(state);
        }
      });

      observer.observe(container);
      return () => observer.disconnect();
    }, [updateSelectionOverlay]);

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
    // Notify when ready - use ref for callback to prevent infinite loops
    useEffect(() => {
      if (onReadyRef.current && hiddenPMRef.current) {
        onReadyRef.current({
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
    }, [layout, runLayoutPipeline]);
    // NOTE: onReady removed from dependencies - accessed via ref to prevent infinite loops

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
        className={`ep-root paged-editor ${className ?? ''}`}
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
          extensionManager={extensionManager}
          onEditorViewReady={handleEditorViewReady}
          onKeyDown={handlePMKeyDown}
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
            readOnly={readOnly}
          />

          {/* Plugin overlays (highlights, annotations) */}
          {pluginOverlays && (
            <div className="paged-editor__plugin-overlays" style={pluginOverlaysStyles}>
              {pluginOverlays}
            </div>
          )}
        </div>
      </div>
    );
  }
);

export const PagedEditor = memo(PagedEditorComponent);

export default PagedEditor;
