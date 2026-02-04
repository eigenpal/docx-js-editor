/**
 * Layout Engine Types
 *
 * Core types for the paginated layout engine.
 * Converts document blocks + measurements into positioned fragments on pages.
 */

/**
 * Unique identifier for a block in the document.
 * Format: typically `${index}-${type}` or just the block index.
 */
export type BlockId = string | number;

// =============================================================================
// FLOW BLOCKS - Input to layout engine
// =============================================================================

/**
 * Common run formatting properties applied to text runs.
 */
export type RunFormatting = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean | { style?: string; color?: string };
  strike?: boolean;
  color?: string;
  highlight?: string;
  fontFamily?: string;
  fontSize?: number;
  letterSpacing?: number;
  superscript?: boolean;
  subscript?: boolean;
  /** Hyperlink info if this run is a link */
  hyperlink?: { href: string; tooltip?: string };
};

/**
 * A text run within a paragraph.
 */
export type TextRun = RunFormatting & {
  kind: 'text';
  text: string;
  /** Absolute ProseMirror position (inclusive) of first character. */
  pmStart?: number;
  /** Absolute ProseMirror position (exclusive) after last character. */
  pmEnd?: number;
};

/**
 * A tab character run.
 */
export type TabRun = RunFormatting & {
  kind: 'tab';
  width?: number;
  pmStart?: number;
  pmEnd?: number;
};

/**
 * Position data for floating/anchored images.
 */
export type ImageRunPosition = {
  horizontal?: {
    relativeTo?: string;
    posOffset?: number;
    align?: string;
  };
  vertical?: {
    relativeTo?: string;
    posOffset?: number;
    align?: string;
  };
};

/**
 * An inline image run.
 */
export type ImageRun = {
  kind: 'image';
  src: string;
  width: number;
  height: number;
  alt?: string;
  /** CSS transform string (rotation, flip) */
  transform?: string;
  /** Position for floating/anchored images */
  position?: ImageRunPosition;
  /** Wrap type from DOCX (inline, square, tight, through, topAndBottom, etc.) */
  wrapType?: string;
  /** Display mode for CSS rendering */
  displayMode?: 'inline' | 'block' | 'float';
  /** CSS float direction */
  cssFloat?: 'left' | 'right' | 'none';
  /** Wrap distances in pixels */
  distTop?: number;
  distBottom?: number;
  distLeft?: number;
  distRight?: number;
  pmStart?: number;
  pmEnd?: number;
};

/**
 * A line break run.
 */
export type LineBreakRun = {
  kind: 'lineBreak';
  pmStart?: number;
  pmEnd?: number;
};

/**
 * A field run (PAGE, NUMPAGES, etc.) that gets substituted at render time.
 */
export type FieldRun = RunFormatting & {
  kind: 'field';
  fieldType: 'PAGE' | 'NUMPAGES' | 'DATE' | 'TIME' | 'OTHER';
  /** Fallback text if field can't be resolved */
  fallback?: string;
  pmStart?: number;
  pmEnd?: number;
};

/**
 * Union of all run types.
 */
export type Run = TextRun | TabRun | ImageRun | LineBreakRun | FieldRun;

/**
 * Paragraph spacing configuration.
 */
export type ParagraphSpacing = {
  before?: number;
  after?: number;
  line?: number;
  lineUnit?: 'px' | 'multiplier';
  lineRule?: 'auto' | 'exact' | 'atLeast';
};

/**
 * Paragraph indentation configuration.
 */
export type ParagraphIndent = {
  left?: number;
  right?: number;
  firstLine?: number;
  hanging?: number;
};

/**
 * Tab stop alignment types
 */
export type TabAlignment = 'start' | 'end' | 'center' | 'decimal' | 'bar' | 'clear';

/**
 * Tab stop definition
 */
export type TabStop = {
  /** Tab alignment mode */
  val: TabAlignment;
  /** Position in twips from left margin */
  pos: number;
  /** Optional leader character */
  leader?: 'none' | 'dot' | 'hyphen' | 'underscore';
};

/**
 * Border specification for paragraphs.
 */
export type BorderStyle = {
  style?: string;
  width?: number; // in pixels
  color?: string; // CSS color
};

/**
 * Paragraph borders.
 */
export type ParagraphBorders = {
  top?: BorderStyle;
  bottom?: BorderStyle;
  left?: BorderStyle;
  right?: BorderStyle;
};

/**
 * List numbering properties for a paragraph.
 */
export type ListNumPr = {
  numId?: number;
  ilvl?: number;
};

/**
 * Paragraph block attributes.
 */
export type ParagraphAttrs = {
  alignment?: 'left' | 'center' | 'right' | 'justify';
  spacing?: ParagraphSpacing;
  indent?: ParagraphIndent;
  keepNext?: boolean;
  keepLines?: boolean;
  pageBreakBefore?: boolean;
  styleId?: string;
  borders?: ParagraphBorders;
  shading?: string; // CSS background color
  tabs?: TabStop[]; // Custom tab stops
  // List properties
  numPr?: ListNumPr;
  listMarker?: string; // Pre-computed marker text (e.g., "1.", "•", "a)")
  listIsBullet?: boolean;
};

/**
 * A paragraph block containing runs.
 */
export type ParagraphBlock = {
  kind: 'paragraph';
  id: BlockId;
  runs: Run[];
  attrs?: ParagraphAttrs;
  /** ProseMirror start position for this block. */
  pmStart?: number;
  /** ProseMirror end position for this block. */
  pmEnd?: number;
};

/**
 * Cell border specification for rendering.
 */
export type CellBorderSpec = {
  width?: number; // pixels
  color?: string; // CSS color
  style?: string; // CSS border-style (solid, dashed, dotted, double)
};

/**
 * Cell borders (all four sides).
 */
export type CellBorders = {
  top?: CellBorderSpec;
  bottom?: CellBorderSpec;
  left?: CellBorderSpec;
  right?: CellBorderSpec;
};

/**
 * A table cell with content.
 */
export type TableCell = {
  id: BlockId;
  blocks: FlowBlock[];
  colSpan?: number;
  rowSpan?: number;
  width?: number;
  verticalAlign?: 'top' | 'center' | 'bottom';
  background?: string;
  borders?: CellBorders;
};

/**
 * A table row containing cells.
 */
export type TableRow = {
  id: BlockId;
  cells: TableCell[];
  height?: number;
  isHeader?: boolean;
};

/**
 * A table block containing rows.
 */
export type TableBlock = {
  kind: 'table';
  id: BlockId;
  rows: TableRow[];
  columnWidths?: number[];
  /** Table horizontal alignment */
  justification?: 'left' | 'center' | 'right';
  pmStart?: number;
  pmEnd?: number;
};

/**
 * An anchored/floating image block.
 */
export type ImageBlock = {
  kind: 'image';
  id: BlockId;
  src: string;
  width: number;
  height: number;
  alt?: string;
  /** CSS transform string (rotation, flip) */
  transform?: string;
  anchor?: {
    isAnchored?: boolean;
    offsetH?: number;
    offsetV?: number;
    behindDoc?: boolean;
  };
  pmStart?: number;
  pmEnd?: number;
};

/**
 * Section break block defining page layout changes.
 */
export type SectionBreakBlock = {
  kind: 'sectionBreak';
  id: BlockId;
  type?: 'continuous' | 'nextPage' | 'evenPage' | 'oddPage';
  pageSize?: { w: number; h: number };
  orientation?: 'portrait' | 'landscape';
  margins?: PageMargins;
};

/**
 * Explicit page break block.
 */
export type PageBreakBlock = {
  kind: 'pageBreak';
  id: BlockId;
  pmStart?: number;
  pmEnd?: number;
};

/**
 * Column break block.
 */
export type ColumnBreakBlock = {
  kind: 'columnBreak';
  id: BlockId;
  pmStart?: number;
  pmEnd?: number;
};

/**
 * Union of all flow block types (input to layout engine).
 */
export type FlowBlock =
  | ParagraphBlock
  | TableBlock
  | ImageBlock
  | SectionBreakBlock
  | PageBreakBlock
  | ColumnBreakBlock;

// =============================================================================
// MEASURES - Measurement results for blocks
// =============================================================================

/**
 * A measured line within a paragraph.
 */
export type MeasuredLine = {
  /** Starting run index (inclusive). */
  fromRun: number;
  /** Starting character index within fromRun. */
  fromChar: number;
  /** Ending run index (inclusive). */
  toRun: number;
  /** Ending character index within toRun (exclusive). */
  toChar: number;
  /** Total width of the line in pixels. */
  width: number;
  /** Ascent (height above baseline) in pixels. */
  ascent: number;
  /** Descent (height below baseline) in pixels. */
  descent: number;
  /** Total line height in pixels. */
  lineHeight: number;
};

/**
 * Measurement result for a paragraph block.
 */
export type ParagraphMeasure = {
  kind: 'paragraph';
  lines: MeasuredLine[];
  totalHeight: number;
};

/**
 * Measurement result for an image block.
 */
export type ImageMeasure = {
  kind: 'image';
  width: number;
  height: number;
};

/**
 * Measurement result for a table cell.
 */
export type TableCellMeasure = {
  blocks: Measure[];
  width: number;
  height: number;
  colSpan?: number;
  rowSpan?: number;
};

/**
 * Measurement result for a table row.
 */
export type TableRowMeasure = {
  cells: TableCellMeasure[];
  height: number;
};

/**
 * Measurement result for a table block.
 */
export type TableMeasure = {
  kind: 'table';
  rows: TableRowMeasure[];
  columnWidths: number[];
  totalWidth: number;
  totalHeight: number;
};

/**
 * Measurement result for section break (no visual size).
 */
export type SectionBreakMeasure = {
  kind: 'sectionBreak';
};

/**
 * Measurement result for page break (no visual size).
 */
export type PageBreakMeasure = {
  kind: 'pageBreak';
};

/**
 * Measurement result for column break (no visual size).
 */
export type ColumnBreakMeasure = {
  kind: 'columnBreak';
};

/**
 * Union of all measurement types.
 */
export type Measure =
  | ParagraphMeasure
  | ImageMeasure
  | TableMeasure
  | SectionBreakMeasure
  | PageBreakMeasure
  | ColumnBreakMeasure;

// =============================================================================
// FRAGMENTS - Positioned content on pages
// =============================================================================

/**
 * Base fragment properties common to all fragment types.
 */
export type FragmentBase = {
  /** Block ID this fragment belongs to. */
  blockId: BlockId;
  /** X position on page (relative to page left). */
  x: number;
  /** Y position on page (relative to page top). */
  y: number;
  /** Width of the fragment. */
  width: number;
  /** ProseMirror start position (for click mapping). */
  pmStart?: number;
  /** ProseMirror end position (for click mapping). */
  pmEnd?: number;
};

/**
 * A paragraph fragment positioned on a page.
 * May span only part of the paragraph's lines if split across pages.
 */
export type ParagraphFragment = FragmentBase & {
  kind: 'paragraph';
  /** First line index (inclusive) from the measure. */
  fromLine: number;
  /** Last line index (exclusive) from the measure. */
  toLine: number;
  /** Height of this fragment. */
  height: number;
  /** True if this continues from a previous page. */
  continuesFromPrev?: boolean;
  /** True if this continues onto the next page. */
  continuesOnNext?: boolean;
};

/**
 * A table fragment positioned on a page.
 * May span only part of the table's rows if split across pages.
 */
export type TableFragment = FragmentBase & {
  kind: 'table';
  /** First row index (inclusive). */
  fromRow: number;
  /** Last row index (exclusive). */
  toRow: number;
  /** Height of this fragment. */
  height: number;
  /** True if this continues from a previous page. */
  continuesFromPrev?: boolean;
  /** True if this continues onto the next page. */
  continuesOnNext?: boolean;
};

/**
 * An image fragment positioned on a page.
 */
export type ImageFragment = FragmentBase & {
  kind: 'image';
  /** Height of the image. */
  height: number;
  /** True if this is an anchored/floating image. */
  isAnchored?: boolean;
  /** Z-index for layering. */
  zIndex?: number;
};

/**
 * Union of all fragment types.
 */
export type Fragment = ParagraphFragment | TableFragment | ImageFragment;

// =============================================================================
// PAGES AND LAYOUT - Output of layout engine
// =============================================================================

/**
 * Page margin configuration.
 */
export type PageMargins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  /** Distance from page top to header content. */
  header?: number;
  /** Distance from page bottom to footer content. */
  footer?: number;
};

/**
 * A rendered page containing positioned fragments.
 */
export type Page = {
  /** Page number (1-indexed). */
  number: number;
  /** Fragments positioned on this page. */
  fragments: Fragment[];
  /** Page margins. */
  margins: PageMargins;
  /** Page size (width, height). */
  size: { w: number; h: number };
  /** Page orientation. */
  orientation?: 'portrait' | 'landscape';
  /** Section index this page belongs to. */
  sectionIndex?: number;
  /** Header/footer references for this page. */
  headerFooterRefs?: {
    headerDefault?: string;
    headerFirst?: string;
    headerEven?: string;
    footerDefault?: string;
    footerFirst?: string;
    footerEven?: string;
  };
};

/**
 * Column layout configuration.
 */
export type ColumnLayout = {
  count: number;
  gap: number;
  equalWidth?: boolean;
};

/**
 * Header/footer layout for a specific type.
 */
export type HeaderFooterLayout = {
  height: number;
  fragments: Fragment[];
};

/**
 * Final layout output ready for rendering/painting.
 */
export type Layout = {
  /** Default page size for the document. */
  pageSize: { w: number; h: number };
  /** All rendered pages with positioned fragments. */
  pages: Page[];
  /** Column configuration (if multi-column). */
  columns?: ColumnLayout;
  /** Header layouts by type (default, first, even). */
  headers?: Record<string, HeaderFooterLayout>;
  /** Footer layouts by type (default, first, even). */
  footers?: Record<string, HeaderFooterLayout>;
  /** Gap between pages in pixels (for rendering). */
  pageGap?: number;
};

// =============================================================================
// LAYOUT OPTIONS - Configuration for layout engine
// =============================================================================

/**
 * Header/footer content heights by variant type.
 */
export type HeaderFooterContentHeights = Partial<
  Record<'default' | 'first' | 'even' | 'odd', number>
>;

/**
 * Options for the layout engine.
 */
export type LayoutOptions = {
  /** Default page size. */
  pageSize: { w: number; h: number };
  /** Default page margins. */
  margins: PageMargins;
  /** Column configuration. */
  columns?: ColumnLayout;
  /** Gap between rendered pages (for UI). */
  pageGap?: number;
  /** Default line height multiplier. */
  defaultLineHeight?: number;
  /** Header content heights by variant. */
  headerContentHeights?: HeaderFooterContentHeights;
  /** Footer content heights by variant. */
  footerContentHeights?: HeaderFooterContentHeights;
  /** Whether section has different first page header/footer. */
  titlePage?: boolean;
  /** Whether section has different even/odd headers/footers. */
  evenAndOddHeaders?: boolean;
};

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Result of hit-testing a click position.
 */
export type HitTestResult = {
  /** Page index (0-based). */
  pageIndex: number;
  /** Fragment that was hit, if any. */
  fragment?: Fragment;
  /** Local X coordinate within the fragment. */
  localX?: number;
  /** Local Y coordinate within the fragment. */
  localY?: number;
};

/**
 * Position within the document model.
 */
export type DocumentPosition = {
  /** Block index. */
  blockIndex: number;
  /** Run index within the block (for paragraphs). */
  runIndex?: number;
  /** Character offset within the run. */
  charOffset?: number;
  /** ProseMirror position. */
  pmPos?: number;
};
