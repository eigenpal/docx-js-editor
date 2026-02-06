/**
 * Document Content Model
 *
 * All content-bearing types: runs, hyperlinks, bookmarks, fields,
 * images, shapes, tables, lists, paragraphs, headers/footers,
 * footnotes/endnotes, and sections.
 *
 * These types form a deeply interrelated tree (Paragraph ↔ Table ↔ ShapeTextBody)
 * and are kept together to avoid circular import issues.
 */

import type { ColorValue, ThemeColorSlot, BorderSpec } from './colors';
import type {
  TextFormatting,
  ParagraphFormatting,
  TableFormatting,
  TableRowFormatting,
  TableCellFormatting,
} from './formatting';
import type { NumberFormat, ListRendering } from './lists';

// ============================================================================
// RUN CONTENT TYPES
// ============================================================================

/**
 * Plain text content
 */
export interface TextContent {
  type: 'text';
  /** The text string */
  text: string;
  /** Preserve whitespace (xml:space="preserve") */
  preserveSpace?: boolean;
}

/**
 * Tab character
 */
export interface TabContent {
  type: 'tab';
}

/**
 * Line break
 */
export interface BreakContent {
  type: 'break';
  /** Break type */
  breakType?: 'page' | 'column' | 'textWrapping';
  /** Clear type for text wrapping break */
  clear?: 'none' | 'left' | 'right' | 'all';
}

/**
 * Symbol character (special font character)
 */
export interface SymbolContent {
  type: 'symbol';
  /** Font name */
  font: string;
  /** Character code */
  char: string;
}

/**
 * Footnote or endnote reference
 */
export interface NoteReferenceContent {
  type: 'footnoteRef' | 'endnoteRef';
  /** Note ID */
  id: number;
}

/**
 * Field character (begin/separate/end)
 */
export interface FieldCharContent {
  type: 'fieldChar';
  /** Field character type */
  charType: 'begin' | 'separate' | 'end';
  /** Field is locked */
  fldLock?: boolean;
  /** Field is dirty (needs update) */
  dirty?: boolean;
}

/**
 * Field instruction text
 */
export interface InstrTextContent {
  type: 'instrText';
  /** Field instruction */
  text: string;
}

/**
 * Soft hyphen
 */
export interface SoftHyphenContent {
  type: 'softHyphen';
}

/**
 * Non-breaking hyphen
 */
export interface NoBreakHyphenContent {
  type: 'noBreakHyphen';
}

/**
 * Drawing/image reference
 */
export interface DrawingContent {
  type: 'drawing';
  /** Image data */
  image: Image;
}

/**
 * Shape reference
 */
export interface ShapeContent {
  type: 'shape';
  /** Shape data */
  shape: Shape;
}

/**
 * All possible run content types
 */
export type RunContent =
  | TextContent
  | TabContent
  | BreakContent
  | SymbolContent
  | NoteReferenceContent
  | FieldCharContent
  | InstrTextContent
  | SoftHyphenContent
  | NoBreakHyphenContent
  | DrawingContent
  | ShapeContent;

// ============================================================================
// RUN (w:r)
// ============================================================================

/**
 * A run is a contiguous region of text with the same formatting
 */
export interface Run {
  type: 'run';
  /** Text formatting properties */
  formatting?: TextFormatting;
  /** Run content (text, tabs, breaks, etc.) */
  content: RunContent[];
}

// ============================================================================
// HYPERLINKS & BOOKMARKS
// ============================================================================

/**
 * Hyperlink (w:hyperlink)
 */
export interface Hyperlink {
  type: 'hyperlink';
  /** Relationship ID for external link */
  rId?: string;
  /** Resolved URL (from relationships) */
  href?: string;
  /** Internal bookmark anchor */
  anchor?: string;
  /** Tooltip text */
  tooltip?: string;
  /** Target frame */
  target?: string;
  /** Link history tracking */
  history?: boolean;
  /** Document location */
  docLocation?: string;
  /** Child runs */
  children: (Run | BookmarkStart | BookmarkEnd)[];
}

/**
 * Bookmark start marker (w:bookmarkStart)
 */
export interface BookmarkStart {
  type: 'bookmarkStart';
  /** Bookmark ID */
  id: number;
  /** Bookmark name */
  name: string;
  /** Column index for table bookmarks */
  colFirst?: number;
  colLast?: number;
}

/**
 * Bookmark end marker (w:bookmarkEnd)
 */
export interface BookmarkEnd {
  type: 'bookmarkEnd';
  /** Bookmark ID */
  id: number;
}

// ============================================================================
// FIELDS
// ============================================================================

/**
 * Known field types
 */
export type FieldType =
  | 'PAGE'
  | 'NUMPAGES'
  | 'NUMWORDS'
  | 'NUMCHARS'
  | 'DATE'
  | 'TIME'
  | 'CREATEDATE'
  | 'SAVEDATE'
  | 'PRINTDATE'
  | 'AUTHOR'
  | 'TITLE'
  | 'SUBJECT'
  | 'KEYWORDS'
  | 'COMMENTS'
  | 'FILENAME'
  | 'FILESIZE'
  | 'TEMPLATE'
  | 'DOCPROPERTY'
  | 'DOCVARIABLE'
  | 'REF'
  | 'PAGEREF'
  | 'NOTEREF'
  | 'HYPERLINK'
  | 'TOC'
  | 'TOA'
  | 'INDEX'
  | 'SEQ'
  | 'STYLEREF'
  | 'AUTONUM'
  | 'AUTONUMLGL'
  | 'AUTONUMOUT'
  | 'IF'
  | 'MERGEFIELD'
  | 'NEXT'
  | 'NEXTIF'
  | 'ASK'
  | 'SET'
  | 'QUOTE'
  | 'INCLUDETEXT'
  | 'INCLUDEPICTURE'
  | 'SYMBOL'
  | 'ADVANCE'
  | 'EDITTIME'
  | 'REVNUM'
  | 'SECTION'
  | 'SECTIONPAGES'
  | 'USERADDRESS'
  | 'USERNAME'
  | 'USERINITIALS'
  | 'UNKNOWN';

/**
 * Simple field (w:fldSimple)
 */
export interface SimpleField {
  type: 'simpleField';
  /** Field instruction (e.g., "PAGE \\* MERGEFORMAT") */
  instruction: string;
  /** Parsed field type */
  fieldType: FieldType;
  /** Current display value */
  content: (Run | Hyperlink)[];
  /** Field is locked */
  fldLock?: boolean;
  /** Field is dirty */
  dirty?: boolean;
}

/**
 * Complex field (w:fldChar begin/separate/end with w:instrText)
 */
export interface ComplexField {
  type: 'complexField';
  /** Field instruction */
  instruction: string;
  /** Parsed field type */
  fieldType: FieldType;
  /** Field code runs */
  fieldCode: Run[];
  /** Display result runs */
  fieldResult: Run[];
  /** Field is locked */
  fldLock?: boolean;
  /** Field is dirty */
  dirty?: boolean;
}

export type Field = SimpleField | ComplexField;

// ============================================================================
// IMAGES
// ============================================================================

/**
 * Image size specification
 */
export interface ImageSize {
  /** Width in EMUs (English Metric Units) */
  width: number;
  /** Height in EMUs */
  height: number;
}

/**
 * Image wrap type for floating images
 */
export interface ImageWrap {
  type: 'inline' | 'square' | 'tight' | 'through' | 'topAndBottom' | 'behind' | 'inFront';
  /** Wrap text direction */
  wrapText?: 'bothSides' | 'left' | 'right' | 'largest';
  /** Distance from text */
  distT?: number;
  distB?: number;
  distL?: number;
  distR?: number;
}

/**
 * Position for floating images
 */
export interface ImagePosition {
  /** Horizontal positioning */
  horizontal: {
    relativeTo:
      | 'character'
      | 'column'
      | 'insideMargin'
      | 'leftMargin'
      | 'margin'
      | 'outsideMargin'
      | 'page'
      | 'rightMargin';
    alignment?: 'left' | 'right' | 'center' | 'inside' | 'outside';
    posOffset?: number;
  };
  /** Vertical positioning */
  vertical: {
    relativeTo:
      | 'insideMargin'
      | 'line'
      | 'margin'
      | 'outsideMargin'
      | 'page'
      | 'paragraph'
      | 'topMargin'
      | 'bottomMargin';
    alignment?: 'top' | 'bottom' | 'center' | 'inside' | 'outside';
    posOffset?: number;
  };
}

/**
 * Image transformation
 */
export interface ImageTransform {
  /** Rotation in degrees */
  rotation?: number;
  /** Flip horizontal */
  flipH?: boolean;
  /** Flip vertical */
  flipV?: boolean;
}

/**
 * Image padding/margins
 */
export interface ImagePadding {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

/**
 * Embedded image (w:drawing)
 */
export interface Image {
  type: 'image';
  /** Unique ID */
  id?: string;
  /** Relationship ID for the image data */
  rId: string;
  /** Resolved image data (base64 or blob URL) */
  src?: string;
  /** Image MIME type */
  mimeType?: string;
  /** Original filename */
  filename?: string;
  /** Alt text for accessibility */
  alt?: string;
  /** Title/description */
  title?: string;
  /** Image size */
  size: ImageSize;
  /** Original size before any transforms */
  originalSize?: ImageSize;
  /** Wrap settings */
  wrap: ImageWrap;
  /** Position for floating images */
  position?: ImagePosition;
  /** Image transformations */
  transform?: ImageTransform;
  /** Padding around image */
  padding?: ImagePadding;
  /** Whether this is a decorative image */
  decorative?: boolean;
  /** Image effects */
  effects?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
  };
}

// ============================================================================
// SHAPES & TEXT BOXES
// ============================================================================

/**
 * Shape types
 */
export type ShapeType =
  // Basic shapes
  | 'rect'
  | 'roundRect'
  | 'ellipse'
  | 'triangle'
  | 'rtTriangle'
  | 'parallelogram'
  | 'trapezoid'
  | 'pentagon'
  | 'hexagon'
  | 'heptagon'
  | 'octagon'
  | 'decagon'
  | 'dodecagon'
  | 'star4'
  | 'star5'
  | 'star6'
  | 'star7'
  | 'star8'
  | 'star10'
  | 'star12'
  | 'star16'
  | 'star24'
  | 'star32'
  // Lines and connectors
  | 'line'
  | 'straightConnector1'
  | 'bentConnector2'
  | 'bentConnector3'
  | 'bentConnector4'
  | 'bentConnector5'
  | 'curvedConnector2'
  | 'curvedConnector3'
  | 'curvedConnector4'
  | 'curvedConnector5'
  // Arrows
  | 'rightArrow'
  | 'leftArrow'
  | 'upArrow'
  | 'downArrow'
  | 'leftRightArrow'
  | 'upDownArrow'
  | 'quadArrow'
  | 'leftRightUpArrow'
  | 'bentArrow'
  | 'uturnArrow'
  | 'leftUpArrow'
  | 'bentUpArrow'
  | 'curvedRightArrow'
  | 'curvedLeftArrow'
  | 'curvedUpArrow'
  | 'curvedDownArrow'
  | 'stripedRightArrow'
  | 'notchedRightArrow'
  | 'homePlate'
  | 'chevron'
  | 'rightArrowCallout'
  | 'downArrowCallout'
  | 'leftArrowCallout'
  | 'upArrowCallout'
  | 'leftRightArrowCallout'
  | 'quadArrowCallout'
  | 'circularArrow'
  // Flowchart
  | 'flowChartProcess'
  | 'flowChartAlternateProcess'
  | 'flowChartDecision'
  | 'flowChartInputOutput'
  | 'flowChartPredefinedProcess'
  | 'flowChartInternalStorage'
  | 'flowChartDocument'
  | 'flowChartMultidocument'
  | 'flowChartTerminator'
  | 'flowChartPreparation'
  | 'flowChartManualInput'
  | 'flowChartManualOperation'
  | 'flowChartConnector'
  | 'flowChartOffpageConnector'
  | 'flowChartPunchedCard'
  | 'flowChartPunchedTape'
  | 'flowChartSummingJunction'
  | 'flowChartOr'
  | 'flowChartCollate'
  | 'flowChartSort'
  | 'flowChartExtract'
  | 'flowChartMerge'
  | 'flowChartOnlineStorage'
  | 'flowChartDelay'
  | 'flowChartMagneticTape'
  | 'flowChartMagneticDisk'
  | 'flowChartMagneticDrum'
  | 'flowChartDisplay'
  // Callouts
  | 'wedgeRectCallout'
  | 'wedgeRoundRectCallout'
  | 'wedgeEllipseCallout'
  | 'cloudCallout'
  | 'borderCallout1'
  | 'borderCallout2'
  | 'borderCallout3'
  | 'accentCallout1'
  | 'accentCallout2'
  | 'accentCallout3'
  | 'callout1'
  | 'callout2'
  | 'callout3'
  | 'accentBorderCallout1'
  | 'accentBorderCallout2'
  | 'accentBorderCallout3'
  // Other
  | 'actionButtonBlank'
  | 'actionButtonHome'
  | 'actionButtonHelp'
  | 'actionButtonInformation'
  | 'actionButtonBackPrevious'
  | 'actionButtonForwardNext'
  | 'actionButtonBeginning'
  | 'actionButtonEnd'
  | 'actionButtonReturn'
  | 'actionButtonDocument'
  | 'actionButtonSound'
  | 'actionButtonMovie'
  | 'irregularSeal1'
  | 'irregularSeal2'
  | 'frame'
  | 'halfFrame'
  | 'corner'
  | 'diagStripe'
  | 'chord'
  | 'arc'
  | 'bracketPair'
  | 'bracePair'
  | 'leftBracket'
  | 'rightBracket'
  | 'leftBrace'
  | 'rightBrace'
  | 'can'
  | 'cube'
  | 'bevel'
  | 'donut'
  | 'noSmoking'
  | 'blockArc'
  | 'foldedCorner'
  | 'smileyFace'
  | 'heart'
  | 'lightningBolt'
  | 'sun'
  | 'moon'
  | 'cloud'
  | 'snip1Rect'
  | 'snip2SameRect'
  | 'snip2DiagRect'
  | 'snipRoundRect'
  | 'round1Rect'
  | 'round2SameRect'
  | 'round2DiagRect'
  | 'plaque'
  | 'teardrop'
  | 'mathPlus'
  | 'mathMinus'
  | 'mathMultiply'
  | 'mathDivide'
  | 'mathEqual'
  | 'mathNotEqual'
  | 'gear6'
  | 'gear9'
  | 'funnel'
  | 'pieWedge'
  | 'pie'
  | 'leftCircularArrow'
  | 'leftRightCircularArrow'
  | 'swooshArrow'
  | 'textBox';

/**
 * Shape fill type
 */
export interface ShapeFill {
  type: 'none' | 'solid' | 'gradient' | 'pattern' | 'picture';
  /** Solid fill color */
  color?: ColorValue;
  /** Gradient stops for gradient fill */
  gradient?: {
    type: 'linear' | 'radial' | 'rectangular' | 'path';
    angle?: number;
    stops: Array<{
      position: number; // 0-100000
      color: ColorValue;
    }>;
  };
}

/**
 * Shape outline/stroke
 */
export interface ShapeOutline {
  /** Line width in EMUs */
  width?: number;
  /** Line color */
  color?: ColorValue;
  /** Line style */
  style?:
    | 'solid'
    | 'dot'
    | 'dash'
    | 'lgDash'
    | 'dashDot'
    | 'lgDashDot'
    | 'lgDashDotDot'
    | 'sysDot'
    | 'sysDash'
    | 'sysDashDot'
    | 'sysDashDotDot';
  /** Line cap */
  cap?: 'flat' | 'round' | 'square';
  /** Line join */
  join?: 'bevel' | 'miter' | 'round';
  /** Head arrow */
  headEnd?: {
    type: 'none' | 'triangle' | 'stealth' | 'diamond' | 'oval' | 'arrow';
    width?: 'sm' | 'med' | 'lg';
    length?: 'sm' | 'med' | 'lg';
  };
  /** Tail arrow */
  tailEnd?: {
    type: 'none' | 'triangle' | 'stealth' | 'diamond' | 'oval' | 'arrow';
    width?: 'sm' | 'med' | 'lg';
    length?: 'sm' | 'med' | 'lg';
  };
}

/**
 * Text body inside a shape
 */
export interface ShapeTextBody {
  /** Text direction */
  vertical?: boolean;
  /** Rotation */
  rotation?: number;
  /** Anchor/vertical alignment */
  anchor?: 'top' | 'middle' | 'bottom' | 'distributed' | 'justified';
  /** Anchor center */
  anchorCenter?: boolean;
  /** Auto fit */
  autoFit?: 'none' | 'normal' | 'shape';
  /** Text margins */
  margins?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  /** Paragraphs inside the shape */
  content: Paragraph[];
}

/**
 * Shape/drawing object (wps:wsp)
 */
export interface Shape {
  type: 'shape';
  /** Shape type preset */
  shapeType: ShapeType;
  /** Unique ID */
  id?: string;
  /** Name */
  name?: string;
  /** Size in EMUs */
  size: ImageSize;
  /** Position for floating shapes */
  position?: ImagePosition;
  /** Wrap settings */
  wrap?: ImageWrap;
  /** Fill */
  fill?: ShapeFill;
  /** Outline/stroke */
  outline?: ShapeOutline;
  /** Transform */
  transform?: ImageTransform;
  /** Text content inside the shape */
  textBody?: ShapeTextBody;
  /** Custom geometry points */
  customGeometry?: string;
}

/**
 * Text box (floating text container)
 */
export interface TextBox {
  type: 'textBox';
  /** Unique ID */
  id?: string;
  /** Size */
  size: ImageSize;
  /** Position */
  position?: ImagePosition;
  /** Wrap settings */
  wrap?: ImageWrap;
  /** Fill */
  fill?: ShapeFill;
  /** Outline */
  outline?: ShapeOutline;
  /** Text content */
  content: Paragraph[];
  /** Internal margins */
  margins?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
}

// ============================================================================
// TABLES
// ============================================================================

/**
 * Table cell
 */
export interface TableCell {
  type: 'tableCell';
  /** Cell formatting */
  formatting?: TableCellFormatting;
  /** Cell content (paragraphs, tables, etc.) */
  content: (Paragraph | Table)[];
}

/**
 * Table row
 */
export interface TableRow {
  type: 'tableRow';
  /** Row formatting */
  formatting?: TableRowFormatting;
  /** Cells in this row */
  cells: TableCell[];
}

/**
 * Table (w:tbl)
 */
export interface Table {
  type: 'table';
  /** Table formatting */
  formatting?: TableFormatting;
  /** Column widths in twips */
  columnWidths?: number[];
  /** Table rows */
  rows: TableRow[];
}

// ============================================================================
// PARAGRAPH
// ============================================================================

/**
 * Paragraph content types
 */
export type ParagraphContent =
  | Run
  | Hyperlink
  | BookmarkStart
  | BookmarkEnd
  | SimpleField
  | ComplexField;

/**
 * Paragraph (w:p)
 */
export interface Paragraph {
  type: 'paragraph';
  /** Unique paragraph ID */
  paraId?: string;
  /** Text ID */
  textId?: string;
  /** Paragraph formatting */
  formatting?: ParagraphFormatting;
  /** Paragraph content */
  content: ParagraphContent[];
  /** Computed list rendering (if this is a list item) */
  listRendering?: ListRendering;
  /** Section properties (if this paragraph ends a section) */
  sectionProperties?: SectionProperties;
}

// ============================================================================
// HEADERS & FOOTERS
// ============================================================================

/**
 * Header/footer type
 */
export type HeaderFooterType = 'default' | 'first' | 'even';

/**
 * Header or footer reference
 */
export interface HeaderReference {
  type: HeaderFooterType;
  rId: string;
}

export interface FooterReference {
  type: HeaderFooterType;
  rId: string;
}

/**
 * Header or footer content
 */
export interface HeaderFooter {
  type: 'header' | 'footer';
  /** Header/footer type */
  hdrFtrType: HeaderFooterType;
  /** Content (paragraphs, tables, etc.) */
  content: (Paragraph | Table)[];
}

// ============================================================================
// FOOTNOTES & ENDNOTES
// ============================================================================

/**
 * Footnote position
 */
export type FootnotePosition = 'pageBottom' | 'beneathText' | 'sectEnd' | 'docEnd';

/**
 * Endnote position
 */
export type EndnotePosition = 'sectEnd' | 'docEnd';

/**
 * Number restart type
 */
export type NoteNumberRestart = 'continuous' | 'eachSect' | 'eachPage';

/**
 * Footnote properties
 */
export interface FootnoteProperties {
  position?: FootnotePosition;
  numFmt?: NumberFormat;
  numStart?: number;
  numRestart?: NoteNumberRestart;
}

/**
 * Endnote properties
 */
export interface EndnoteProperties {
  position?: EndnotePosition;
  numFmt?: NumberFormat;
  numStart?: number;
  numRestart?: NoteNumberRestart;
}

/**
 * Footnote (w:footnote)
 */
export interface Footnote {
  type: 'footnote';
  /** Footnote ID */
  id: number;
  /** Special footnote type */
  noteType?: 'normal' | 'separator' | 'continuationSeparator' | 'continuationNotice';
  /** Content */
  content: Paragraph[];
}

/**
 * Endnote (w:endnote)
 */
export interface Endnote {
  type: 'endnote';
  /** Endnote ID */
  id: number;
  /** Special endnote type */
  noteType?: 'normal' | 'separator' | 'continuationSeparator' | 'continuationNotice';
  /** Content */
  content: Paragraph[];
}

// ============================================================================
// SECTION PROPERTIES
// ============================================================================

/**
 * Page orientation
 */
export type PageOrientation = 'portrait' | 'landscape';

/**
 * Section start type
 */
export type SectionStart = 'continuous' | 'nextPage' | 'oddPage' | 'evenPage' | 'nextColumn';

/**
 * Vertical alignment
 */
export type VerticalAlign = 'top' | 'center' | 'both' | 'bottom';

/**
 * Line number restart type
 */
export type LineNumberRestart = 'continuous' | 'newPage' | 'newSection';

/**
 * Column definition
 */
export interface Column {
  /** Column width in twips */
  width?: number;
  /** Space after column in twips */
  space?: number;
}

/**
 * Section properties (w:sectPr)
 */
export interface SectionProperties {
  // Page size
  /** Page width in twips */
  pageWidth?: number;
  /** Page height in twips */
  pageHeight?: number;
  /** Page orientation */
  orientation?: PageOrientation;

  // Margins
  /** Top margin in twips */
  marginTop?: number;
  /** Bottom margin in twips */
  marginBottom?: number;
  /** Left margin in twips */
  marginLeft?: number;
  /** Right margin in twips */
  marginRight?: number;
  /** Header distance from top in twips */
  headerDistance?: number;
  /** Footer distance from bottom in twips */
  footerDistance?: number;
  /** Gutter margin in twips */
  gutter?: number;

  // Columns
  /** Number of columns */
  columnCount?: number;
  /** Space between columns in twips */
  columnSpace?: number;
  /** Equal width columns */
  equalWidth?: boolean;
  /** Separator line between columns */
  separator?: boolean;
  /** Individual column definitions */
  columns?: Column[];

  // Section behavior
  /** Section start type */
  sectionStart?: SectionStart;
  /** Vertical alignment of text */
  verticalAlign?: VerticalAlign;
  /** Right-to-left section */
  bidi?: boolean;

  // Headers and footers
  /** Header references */
  headerReferences?: HeaderReference[];
  /** Footer references */
  footerReferences?: FooterReference[];
  /** Different first page header/footer */
  titlePg?: boolean;
  /** Different odd/even page headers/footers */
  evenAndOddHeaders?: boolean;

  // Line numbers
  /** Line numbering settings */
  lineNumbers?: {
    start?: number;
    countBy?: number;
    distance?: number;
    restart?: LineNumberRestart;
  };

  // Page borders
  /** Page borders */
  pageBorders?: {
    top?: BorderSpec;
    bottom?: BorderSpec;
    left?: BorderSpec;
    right?: BorderSpec;
    /** Display setting */
    display?: 'allPages' | 'firstPage' | 'notFirstPage';
    /** Offset from */
    offsetFrom?: 'page' | 'text';
    /** Z-order */
    zOrder?: 'front' | 'back';
  };

  // Background
  /** Page background */
  background?: {
    color?: ColorValue;
    themeColor?: ThemeColorSlot;
    themeTint?: string;
    themeShade?: string;
  };

  // Footnote/Endnote properties
  /** Footnote properties for this section */
  footnotePr?: FootnoteProperties;
  /** Endnote properties for this section */
  endnotePr?: EndnoteProperties;

  // Document grid
  /** Document grid */
  docGrid?: {
    type?: 'default' | 'lines' | 'linesAndChars' | 'snapToChars';
    linePitch?: number;
    charSpace?: number;
  };

  // Paper source
  /** First page paper source */
  paperSrcFirst?: number;
  /** Other pages paper source */
  paperSrcOther?: number;
}

// ============================================================================
// SECTION & DOCUMENT BODY
// ============================================================================

/**
 * Block-level content types
 */
export type BlockContent = Paragraph | Table;

/**
 * Section (implicit or explicit based on sectPr)
 */
export interface Section {
  /** Section properties */
  properties: SectionProperties;
  /** Content in this section */
  content: BlockContent[];
  /** Headers for this section */
  headers?: Map<HeaderFooterType, HeaderFooter>;
  /** Footers for this section */
  footers?: Map<HeaderFooterType, HeaderFooter>;
}

/**
 * Document body (w:body)
 */
export interface DocumentBody {
  /** All content (paragraphs, tables) */
  content: BlockContent[];
  /** Sections (derived from sectPr in paragraphs and final sectPr) */
  sections?: Section[];
  /** Final section properties (from body's sectPr) */
  finalSectionProperties?: SectionProperties;
}
