/**
 * Comprehensive TypeScript types for DOCX document representation
 * Based on OOXML (Office Open XML) specification
 */

// ============================================================================
// Theme Colors
// ============================================================================

export type ThemeColor =
  | 'dark1'
  | 'light1'
  | 'dark2'
  | 'light2'
  | 'accent1'
  | 'accent2'
  | 'accent3'
  | 'accent4'
  | 'accent5'
  | 'accent6'
  | 'hyperlink'
  | 'followedHyperlink'
  | 'none'
  | 'background1'
  | 'text1'
  | 'background2'
  | 'text2';

// ============================================================================
// Color Types
// ============================================================================

export interface ColorValue {
  /** Hex color value (e.g., "FF0000") */
  val?: string;
  /** Theme color reference */
  themeColor?: ThemeColor;
  /** Theme tint adjustment (0-255 as hex string) */
  themeTint?: string;
  /** Theme shade adjustment (0-255 as hex string) */
  themeShade?: string;
}

// ============================================================================
// Shading/Background Types
// ============================================================================

export type ShadingPattern =
  | 'nil'
  | 'clear'
  | 'solid'
  | 'horzStripe'
  | 'vertStripe'
  | 'reverseDiagStripe'
  | 'diagStripe'
  | 'horzCross'
  | 'diagCross'
  | 'thinHorzStripe'
  | 'thinVertStripe'
  | 'thinReverseDiagStripe'
  | 'thinDiagStripe'
  | 'thinHorzCross'
  | 'thinDiagCross'
  | 'pct5'
  | 'pct10'
  | 'pct12'
  | 'pct15'
  | 'pct20'
  | 'pct25'
  | 'pct30'
  | 'pct35'
  | 'pct37'
  | 'pct40'
  | 'pct45'
  | 'pct50'
  | 'pct55'
  | 'pct60'
  | 'pct62'
  | 'pct65'
  | 'pct70'
  | 'pct75'
  | 'pct80'
  | 'pct85'
  | 'pct87'
  | 'pct90'
  | 'pct95';

export interface ShadingProperties {
  /** Foreground color */
  color?: string | 'auto';
  /** Background/fill color */
  fill?: string | 'auto';
  /** Theme color for foreground */
  themeColor?: ThemeColor;
  /** Theme color for fill */
  themeFill?: ThemeColor;
  /** Theme fill shade adjustment */
  themeFillShade?: string;
  /** Theme fill tint adjustment */
  themeFillTint?: string;
  /** Theme shade adjustment */
  themeShade?: string;
  /** Theme tint adjustment */
  themeTint?: string;
  /** Shading pattern */
  val?: ShadingPattern;
}

// ============================================================================
// Border Types
// ============================================================================

export type BorderStyle =
  | 'nil'
  | 'none'
  | 'single'
  | 'thick'
  | 'double'
  | 'dotted'
  | 'dashed'
  | 'dotDash'
  | 'dotDotDash'
  | 'triple'
  | 'thinThickSmallGap'
  | 'thickThinSmallGap'
  | 'thinThickThinSmallGap'
  | 'thinThickMediumGap'
  | 'thickThinMediumGap'
  | 'thinThickThinMediumGap'
  | 'thinThickLargeGap'
  | 'thickThinLargeGap'
  | 'thinThickThinLargeGap'
  | 'wave'
  | 'doubleWave'
  | 'dashSmallGap'
  | 'dashDotStroked'
  | 'threeDEmboss'
  | 'threeDEngrave'
  | 'outset'
  | 'inset';

export interface BorderSpec {
  /** Border style */
  val?: BorderStyle;
  /** Border color (hex) */
  color?: string;
  /** Theme color reference */
  themeColor?: ThemeColor;
  /** Theme tint adjustment */
  themeTint?: string;
  /** Theme shade adjustment */
  themeShade?: string;
  /** Border width (eighths of a point) */
  sz?: number;
  /** Space from content (points) */
  space?: number;
  /** Shadow effect */
  shadow?: boolean;
  /** Frame mode */
  frame?: boolean;
}

export interface ParagraphBorders {
  top?: BorderSpec;
  bottom?: BorderSpec;
  left?: BorderSpec;
  right?: BorderSpec;
  between?: BorderSpec;
  bar?: BorderSpec;
}

// ============================================================================
// Font Types
// ============================================================================

export interface FontSelection {
  /** ASCII font (Latin text) */
  ascii?: string;
  /** High ANSI font */
  hAnsi?: string;
  /** East Asian font */
  eastAsia?: string;
  /** Complex script font */
  cs?: string;
  /** Font hint */
  hint?: 'default' | 'eastAsia' | 'cs';
  /** Theme font for ASCII */
  asciiTheme?: 'majorAscii' | 'minorAscii' | 'majorHAnsi' | 'minorHAnsi';
  /** Theme font for East Asia */
  eastAsiaTheme?: 'majorEastAsia' | 'minorEastAsia';
  /** Theme font for complex script */
  cstheme?: 'majorBidi' | 'minorBidi';
}

// ============================================================================
// Text/Run Formatting (w:rPr)
// ============================================================================

export type UnderlineStyle =
  | 'single'
  | 'words'
  | 'double'
  | 'thick'
  | 'dotted'
  | 'dottedHeavy'
  | 'dash'
  | 'dashedHeavy'
  | 'dashLong'
  | 'dashLongHeavy'
  | 'dotDash'
  | 'dashDotHeavy'
  | 'dotDotDash'
  | 'dashDotDotHeavy'
  | 'wave'
  | 'wavyHeavy'
  | 'wavyDouble'
  | 'none';

export type VerticalAlign = 'superscript' | 'subscript' | 'baseline';

export type TextEffect =
  | 'none'
  | 'blinkBackground'
  | 'lights'
  | 'antsBlack'
  | 'antsRed'
  | 'shimmer'
  | 'sparkle';

export interface TextFormatting {
  /** Character style ID */
  rStyle?: string;
  /** Bold */
  bold?: boolean;
  /** Bold for complex script */
  boldCs?: boolean;
  /** Italic */
  italic?: boolean;
  /** Italic for complex script */
  italicCs?: boolean;
  /** Underline */
  underline?: {
    val?: UnderlineStyle;
    color?: string;
    themeColor?: ThemeColor;
  };
  /** Strikethrough */
  strike?: boolean;
  /** Double strikethrough */
  dstrike?: boolean;
  /** Outline */
  outline?: boolean;
  /** Shadow */
  shadow?: boolean;
  /** Emboss */
  emboss?: boolean;
  /** Imprint/engrave */
  imprint?: boolean;
  /** Small caps */
  smallCaps?: boolean;
  /** All caps */
  allCaps?: boolean;
  /** Hidden text */
  vanish?: boolean;
  /** Web hidden */
  webHidden?: boolean;
  /** Text color */
  color?: ColorValue;
  /** Character spacing (twips) */
  spacing?: number;
  /** Width scaling (percentage) */
  w?: number;
  /** Kerning threshold (half-points) */
  kern?: number;
  /** Vertical position (half-points) */
  position?: number;
  /** Font size (half-points, e.g., 24 = 12pt) */
  sz?: number;
  /** Font size for complex script */
  szCs?: number;
  /** Highlight color */
  highlight?: string;
  /** Text effect */
  effect?: TextEffect;
  /** Character border */
  bdr?: BorderSpec;
  /** Character shading */
  shd?: ShadingProperties;
  /** Vertical alignment (superscript/subscript) */
  vertAlign?: VerticalAlign;
  /** Right-to-left */
  rtl?: boolean;
  /** Complex script */
  cs?: boolean;
  /** Emphasis mark */
  em?: 'none' | 'dot' | 'comma' | 'circle' | 'underDot';
  /** Language settings */
  lang?: {
    val?: string;
    eastAsia?: string;
    bidi?: string;
  };
  /** Font selection */
  rFonts?: FontSelection;
  /** No proofing */
  noProof?: boolean;
  /** Snap to grid */
  snapToGrid?: boolean;
  /** Fit text width */
  fitText?: {
    val?: number;
    id?: string;
  };
  /** Revision tracking IDs */
  rsidRPr?: string;
  rsidDel?: string;
}

// ============================================================================
// Paragraph Formatting (w:pPr)
// ============================================================================

export type Justification = 'left' | 'center' | 'right' | 'both' | 'start' | 'end' | 'distribute';

export type LineSpacingRule = 'auto' | 'exact' | 'atLeast';

export type TextDirection = 'lrTb' | 'tbRl' | 'btLr' | 'lrTbV' | 'tbRlV' | 'tbLrV';

export interface SpacingProperties {
  /** Space before paragraph (twips) */
  before?: number;
  /** Space after paragraph (twips) */
  after?: number;
  /** Line spacing (twips, or 240ths of a line if auto) */
  line?: number;
  /** Line spacing rule */
  lineRule?: LineSpacingRule;
  /** Auto spacing before */
  beforeAutospacing?: boolean;
  /** Auto spacing after */
  afterAutospacing?: boolean;
  /** Space before in lines */
  beforeLines?: number;
  /** Space after in lines */
  afterLines?: number;
}

export interface IndentationProperties {
  /** Left indent (twips) */
  left?: number;
  /** Right indent (twips) */
  right?: number;
  /** First line indent (twips, positive) */
  firstLine?: number;
  /** Hanging indent (twips) */
  hanging?: number;
  /** Start indent for RTL (twips) */
  start?: number;
  /** End indent for RTL (twips) */
  end?: number;
  /** Left indent in characters */
  leftChars?: number;
  /** Right indent in characters */
  rightChars?: number;
  /** First line indent in characters */
  firstLineChars?: number;
  /** Hanging indent in characters */
  hangingChars?: number;
}

export interface TabStop {
  /** Tab stop position (twips) */
  pos: number;
  /** Tab stop type */
  val: 'left' | 'center' | 'right' | 'decimal' | 'bar' | 'clear' | 'num';
  /** Tab leader character */
  leader?: 'none' | 'dot' | 'hyphen' | 'underscore' | 'heavy' | 'middleDot';
}

export interface NumberingProperties {
  /** Numbering definition ID */
  numId?: number | string;
  /** List level (0-8) */
  ilvl?: number;
  /** Abstract numbering ID */
  abstractNumId?: number | string;
}

export interface ParagraphFormatting {
  /** Paragraph style ID */
  pStyle?: string;
  /** Keep with next paragraph */
  keepNext?: boolean;
  /** Keep lines together */
  keepLines?: boolean;
  /** Page break before */
  pageBreakBefore?: boolean;
  /** Widow/orphan control */
  widowControl?: boolean;
  /** Numbering/list properties */
  numPr?: NumberingProperties;
  /** Suppress line numbers */
  suppressLineNumbers?: boolean;
  /** Paragraph borders */
  pBdr?: ParagraphBorders;
  /** Paragraph shading */
  shd?: ShadingProperties;
  /** Tab stops */
  tabs?: TabStop[];
  /** Suppress auto hyphens */
  suppressAutoHyphens?: boolean;
  /** Kinsoku (Japanese line breaking) */
  kinsoku?: boolean;
  /** Word wrap */
  wordWrap?: boolean;
  /** Overflow punctuation */
  overflowPunct?: boolean;
  /** Top line punctuation */
  topLinePunct?: boolean;
  /** Auto space DE (auto spacing for double-byte/single-byte text) */
  autoSpaceDE?: boolean;
  /** Auto space DN */
  autoSpaceDN?: boolean;
  /** Bidirectional */
  bidi?: boolean;
  /** Adjust right indent */
  adjustRightInd?: boolean;
  /** Snap to grid */
  snapToGrid?: boolean;
  /** Spacing properties */
  spacing?: SpacingProperties;
  /** Indentation properties */
  ind?: IndentationProperties;
  /** Contextual spacing (ignore spacing between same style paragraphs) */
  contextualSpacing?: boolean;
  /** Mirror indents */
  mirrorIndents?: boolean;
  /** Suppress overlap */
  suppressOverlap?: boolean;
  /** Justification/alignment */
  jc?: Justification;
  /** Text direction */
  textDirection?: TextDirection;
  /** Text alignment (vertical within line) */
  textAlignment?: 'auto' | 'baseline' | 'bottom' | 'center' | 'top';
  /** Outline level (0-9, for headings) */
  outlineLvl?: number;
  /** Div ID (for HTML import) */
  divId?: number;
  /** Frame properties (for text frames) */
  framePr?: FrameProperties;
  /** Default run properties for paragraph */
  rPr?: TextFormatting;
  /** Section properties (if last paragraph in section) */
  sectPr?: SectionProperties;
  /** Revision tracking IDs */
  rsidR?: string;
  rsidRDefault?: string;
  rsidP?: string;
  rsidRPr?: string;
}

export interface FrameProperties {
  /** Drop cap type */
  dropCap?: 'none' | 'drop' | 'margin';
  /** Number of lines for drop cap */
  lines?: number;
  /** Width (twips) */
  w?: number;
  /** Height (twips) */
  h?: number;
  /** Vertical space from text (twips) */
  vSpace?: number;
  /** Horizontal space from text (twips) */
  hSpace?: number;
  /** Wrap type */
  wrap?: 'auto' | 'notBeside' | 'around' | 'tight' | 'through' | 'none';
  /** Horizontal anchor */
  hAnchor?: 'text' | 'margin' | 'page';
  /** Vertical anchor */
  vAnchor?: 'text' | 'margin' | 'page';
  /** X position (twips) */
  x?: number;
  /** X alignment */
  xAlign?: 'left' | 'center' | 'right' | 'inside' | 'outside';
  /** Y position (twips) */
  y?: number;
  /** Y alignment */
  yAlign?: 'inline' | 'top' | 'center' | 'bottom' | 'inside' | 'outside';
  /** Height rule */
  hRule?: 'auto' | 'exact' | 'atLeast';
  /** Anchor lock */
  anchorLock?: boolean;
}

// ============================================================================
// Run (Text) Types
// ============================================================================

export type RunContentType = 'text' | 'tab' | 'break' | 'image' | 'symbol' | 'field';

export interface TextContent {
  type: 'text';
  text: string;
  /** Preserve spaces */
  preserveSpace?: boolean;
}

export interface TabContent {
  type: 'tab';
}

export interface BreakContent {
  type: 'break';
  /** Break type */
  breakType?: 'page' | 'column' | 'textWrapping';
  /** Clear type for text wrapping break */
  clear?: 'none' | 'left' | 'right' | 'all';
}

export interface SymbolContent {
  type: 'symbol';
  /** Character code */
  char: string;
  /** Font */
  font?: string;
}

export type RunContent = TextContent | TabContent | BreakContent | SymbolContent | Image | Field;

export interface Run {
  /** Run properties/formatting */
  properties?: TextFormatting;
  /** Run content */
  content: RunContent[];
  /** Revision tracking ID */
  rsidR?: string;
  rsidRPr?: string;
}

// ============================================================================
// Hyperlink Types
// ============================================================================

export interface Hyperlink {
  /** Relationship ID for external URL */
  rId?: string;
  /** Actual URL (resolved from relationships) */
  href?: string;
  /** Internal bookmark anchor */
  anchor?: string;
  /** Tooltip text */
  tooltip?: string;
  /** Target frame */
  tgtFrame?: '_blank' | '_self' | '_parent' | '_top' | string;
  /** Add to visited hyperlinks history */
  history?: boolean;
  /** Document location (for external document links) */
  docLocation?: string;
  /** Child runs */
  runs: Run[];
}

// ============================================================================
// Bookmark Types
// ============================================================================

export interface BookmarkStart {
  /** Bookmark ID */
  id: string;
  /** Bookmark name */
  name: string;
  /** Column first (for table bookmarks) */
  colFirst?: number;
  /** Column last (for table bookmarks) */
  colLast?: number;
}

export interface BookmarkEnd {
  /** Bookmark ID (matches BookmarkStart.id) */
  id: string;
}

// ============================================================================
// Field Types
// ============================================================================

export type FieldType =
  | 'PAGE'
  | 'NUMPAGES'
  | 'DATE'
  | 'TIME'
  | 'AUTHOR'
  | 'TITLE'
  | 'SUBJECT'
  | 'FILENAME'
  | 'FILESIZE'
  | 'CREATEDATE'
  | 'SAVEDATE'
  | 'PRINTDATE'
  | 'DOCPROPERTY'
  | 'REF'
  | 'PAGEREF'
  | 'HYPERLINK'
  | 'TOC'
  | 'INDEX'
  | 'SEQ'
  | 'MERGEFIELD'
  | 'IF'
  | 'FORMTEXT'
  | 'FORMCHECKBOX'
  | 'FORMDROPDOWN';

export interface Field {
  type: 'field';
  /** Field type */
  fieldType?: FieldType;
  /** Full field instruction */
  instruction?: string;
  /** Current/cached field value */
  cachedValue?: string;
  /** Is dirty (needs recalculation) */
  dirty?: boolean;
  /** Is locked */
  locked?: boolean;
  /** Field result runs (displayed content) */
  result?: Run[];
}

export interface SimpleField {
  /** Field instruction */
  instruction: string;
  /** Child runs (field result) */
  runs: Run[];
}

export interface ComplexField {
  /** Field begin */
  begin: {
    dirty?: boolean;
    locked?: boolean;
  };
  /** Field instruction */
  instruction: string;
  /** Separate marker present */
  separate?: boolean;
  /** Field result */
  result?: Run[];
  /** Field end */
  end: boolean;
}

// ============================================================================
// Table Types
// ============================================================================

export interface TableMeasurement {
  /** Value */
  value: number;
  /** Type: dxa (twips), pct (percentage), auto */
  type?: 'dxa' | 'pct' | 'auto' | 'nil';
}

export interface TableBorders {
  top?: BorderSpec;
  bottom?: BorderSpec;
  left?: BorderSpec;
  right?: BorderSpec;
  start?: BorderSpec;
  end?: BorderSpec;
  insideH?: BorderSpec;
  insideV?: BorderSpec;
}

export interface CellMargins {
  top?: TableMeasurement;
  bottom?: TableMeasurement;
  left?: TableMeasurement;
  right?: TableMeasurement;
  start?: TableMeasurement;
  end?: TableMeasurement;
}

export interface TableLook {
  /** First column has special formatting */
  firstColumn?: boolean;
  /** First row has special formatting (header) */
  firstRow?: boolean;
  /** Last column has special formatting */
  lastColumn?: boolean;
  /** Last row has special formatting */
  lastRow?: boolean;
  /** No horizontal banding */
  noHBand?: boolean;
  /** No vertical banding */
  noVBand?: boolean;
}

export interface FloatingTableProperties {
  /** Left margin from text (twips) */
  leftFromText?: number;
  /** Right margin from text (twips) */
  rightFromText?: number;
  /** Top margin from text (twips) */
  topFromText?: number;
  /** Bottom margin from text (twips) */
  bottomFromText?: number;
  /** Absolute X position (twips) */
  tblpX?: number;
  /** Absolute Y position (twips) */
  tblpY?: number;
  /** Horizontal anchor */
  horzAnchor?: 'margin' | 'page' | 'text';
  /** Vertical anchor */
  vertAnchor?: 'margin' | 'page' | 'text';
  /** Horizontal position specification */
  tblpXSpec?: 'left' | 'center' | 'right' | 'inside' | 'outside';
  /** Vertical position specification */
  tblpYSpec?: 'inline' | 'top' | 'center' | 'bottom' | 'inside' | 'outside';
}

export interface TableFormatting {
  /** Table style ID */
  tblStyle?: string;
  /** Table position (floating) */
  tblpPr?: FloatingTableProperties;
  /** Table overlap setting */
  tblOverlap?: 'never' | 'overlap';
  /** Bidirectional (right-to-left) */
  bidiVisual?: boolean;
  /** Table width */
  tblW?: TableMeasurement;
  /** Table justification */
  jc?: 'left' | 'center' | 'right' | 'start' | 'end';
  /** Cell spacing */
  tblCellSpacing?: TableMeasurement;
  /** Table indent */
  tblInd?: TableMeasurement;
  /** Table borders */
  tblBorders?: TableBorders;
  /** Table shading */
  shd?: ShadingProperties;
  /** Table layout */
  tblLayout?: 'fixed' | 'autofit';
  /** Default cell margins */
  tblCellMar?: CellMargins;
  /** Table look/conditional formatting */
  tblLook?: TableLook;
  /** Table caption (accessibility) */
  tblCaption?: string;
  /** Table description (accessibility) */
  tblDescription?: string;
  /** Column band size for alternating styles */
  tblStyleColBandSize?: number;
  /** Row band size for alternating styles */
  tblStyleRowBandSize?: number;
}

export interface TableRowFormatting {
  /** Row cannot split across pages */
  cantSplit?: boolean;
  /** Row is table header (repeats on each page) */
  tblHeader?: boolean;
  /** Row height */
  trHeight?: {
    val: number;
    hRule?: 'auto' | 'exact' | 'atLeast';
  };
  /** Row justification */
  jc?: 'left' | 'center' | 'right' | 'start' | 'end';
  /** Width before row (for indentation) */
  wBefore?: TableMeasurement;
  /** Width after row */
  wAfter?: TableMeasurement;
  /** Grid columns before */
  gridBefore?: number;
  /** Grid columns after */
  gridAfter?: number;
  /** Revision IDs */
  rsidR?: string;
  rsidRPr?: string;
  rsidTr?: string;
}

export interface ConditionalFormatStyle {
  /** First row */
  firstRow?: boolean;
  /** Last row */
  lastRow?: boolean;
  /** First column */
  firstColumn?: boolean;
  /** Last column */
  lastColumn?: boolean;
  /** Odd vertical band */
  oddVBand?: boolean;
  /** Even vertical band */
  evenVBand?: boolean;
  /** Odd horizontal band */
  oddHBand?: boolean;
  /** Even horizontal band */
  evenHBand?: boolean;
  /** First row, first column */
  firstRowFirstColumn?: boolean;
  /** First row, last column */
  firstRowLastColumn?: boolean;
  /** Last row, first column */
  lastRowFirstColumn?: boolean;
  /** Last row, last column */
  lastRowLastColumn?: boolean;
}

export interface TableCellFormatting {
  /** Conditional formatting style */
  cnfStyle?: ConditionalFormatStyle;
  /** Cell width */
  tcW?: TableMeasurement;
  /** Grid span (columns merged) */
  gridSpan?: number;
  /** Horizontal merge */
  hMerge?: 'restart' | 'continue';
  /** Vertical merge */
  vMerge?: 'restart' | 'continue';
  /** Cell borders */
  tcBorders?: TableBorders;
  /** Cell shading */
  shd?: ShadingProperties;
  /** No wrap */
  noWrap?: boolean;
  /** Cell margins */
  tcMar?: CellMargins;
  /** Text direction */
  textDirection?: 'lrTb' | 'tbRl' | 'btLr' | 'lrTbV' | 'tbRlV' | 'tbLrV';
  /** Fit text */
  tcFitText?: boolean;
  /** Vertical alignment */
  vAlign?: 'top' | 'center' | 'bottom';
  /** Hide cell marker */
  hideMark?: boolean;
  /** Accessibility headers */
  headers?: string[];
}

export interface TableCell {
  /** Cell formatting */
  properties?: TableCellFormatting;
  /** Computed colspan */
  colspan?: number;
  /** Computed rowspan */
  rowspan?: number;
  /** Cell content (paragraphs) */
  content: Paragraph[];
}

export interface TableRow {
  /** Row formatting */
  properties?: TableRowFormatting;
  /** Row cells */
  cells: TableCell[];
}

export interface TableGrid {
  /** Column widths (twips) */
  gridCol: number[];
}

export interface Table {
  /** Table formatting */
  properties?: TableFormatting;
  /** Table grid (column definitions) */
  tblGrid?: TableGrid;
  /** Table rows */
  rows: TableRow[];
}

// ============================================================================
// Image Types
// ============================================================================

export type ImageWrapType =
  | 'inline'
  | 'square'
  | 'tight'
  | 'through'
  | 'topAndBottom'
  | 'behind'
  | 'inFront';

export interface ImageSize {
  /** Width in EMUs (English Metric Units) */
  cx?: number;
  /** Height in EMUs */
  cy?: number;
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
}

export interface ImagePadding {
  /** Distance from text - left (EMUs) */
  distL?: number;
  /** Distance from text - top (EMUs) */
  distT?: number;
  /** Distance from text - right (EMUs) */
  distR?: number;
  /** Distance from text - bottom (EMUs) */
  distB?: number;
}

export interface ImagePosition {
  /** Horizontal position type */
  relativeFrom?: 'character' | 'column' | 'insideMargin' | 'leftMargin' | 'margin' | 'outsideMargin' | 'page' | 'rightMargin';
  /** Horizontal alignment */
  align?: 'left' | 'right' | 'center' | 'inside' | 'outside';
  /** Horizontal offset (EMUs) */
  posOffset?: number;
}

export interface ImageWrap {
  type: ImageWrapType;
  /** Wrap text side */
  wrapText?: 'bothSides' | 'largest' | 'left' | 'right';
  /** Wrap polygon points (for tight/through) */
  wrapPolygon?: Array<{ x: number; y: number }>;
}

export interface ImageTransform {
  /** Rotation in degrees */
  rotation?: number;
  /** Flip horizontal */
  flipH?: boolean;
  /** Flip vertical */
  flipV?: boolean;
}

export interface Image {
  type: 'image';
  /** Relationship ID */
  rId?: string;
  /** Image source URL or base64 */
  src?: string;
  /** Alt text */
  alt?: string;
  /** Title/description */
  title?: string;
  /** Image size */
  size?: ImageSize;
  /** Padding/distance from text */
  padding?: ImagePadding;
  /** Horizontal position */
  positionH?: ImagePosition;
  /** Vertical position */
  positionV?: ImagePosition;
  /** Wrap mode */
  wrap?: ImageWrap;
  /** Transform */
  transform?: ImageTransform;
  /** Is inline (in run) vs anchor (floating) */
  inline?: boolean;
  /** Behind document */
  behindDoc?: boolean;
  /** Drawing ID */
  id?: string;
  /** Name */
  name?: string;
  /** Original extension */
  extension?: string;
}

// ============================================================================
// Shape Types
// ============================================================================

export type ShapeType =
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
  | 'line'
  | 'straightConnector1'
  | 'bentConnector2'
  | 'bentConnector3'
  | 'curvedConnector2'
  | 'curvedConnector3'
  | 'arrow'
  | 'leftArrow'
  | 'rightArrow'
  | 'upArrow'
  | 'downArrow'
  | 'leftRightArrow'
  | 'upDownArrow'
  | 'quadArrow'
  | 'cube'
  | 'can'
  | 'heart'
  | 'lightningBolt'
  | 'sun'
  | 'moon'
  | 'cloud'
  | 'arc'
  | 'bracketPair'
  | 'bracePair'
  | 'frame'
  | 'callout1'
  | 'callout2'
  | 'callout3'
  | 'wedgeRectCallout'
  | 'wedgeRoundRectCallout'
  | 'wedgeEllipseCallout'
  | 'cloudCallout'
  | 'flowChartProcess'
  | 'flowChartDecision'
  | 'flowChartTerminator'
  | 'actionButtonBlank';

export interface ShapeFill {
  type: 'solid' | 'gradient' | 'pattern' | 'picture' | 'none';
  color?: string;
  themeColor?: ThemeColor;
  /** Gradient stops for gradient fill */
  gradientStops?: Array<{
    position: number;
    color: string;
  }>;
  /** Gradient direction */
  gradientDirection?: number;
}

export interface ShapeOutline {
  /** Line width (EMUs) */
  width?: number;
  /** Line color */
  color?: string;
  /** Theme color */
  themeColor?: ThemeColor;
  /** Line dash style */
  dash?: 'solid' | 'dot' | 'dash' | 'lgDash' | 'dashDot' | 'lgDashDot' | 'lgDashDotDot' | 'sysDot' | 'sysDash' | 'sysDashDot' | 'sysDashDotDot';
  /** Line cap */
  cap?: 'flat' | 'round' | 'square';
  /** Line join */
  join?: 'round' | 'bevel' | 'miter';
  /** Head end type (for arrows) */
  headEnd?: {
    type?: 'none' | 'triangle' | 'stealth' | 'diamond' | 'oval' | 'arrow';
    width?: 'sm' | 'med' | 'lg';
    length?: 'sm' | 'med' | 'lg';
  };
  /** Tail end type (for arrows) */
  tailEnd?: {
    type?: 'none' | 'triangle' | 'stealth' | 'diamond' | 'oval' | 'arrow';
    width?: 'sm' | 'med' | 'lg';
    length?: 'sm' | 'med' | 'lg';
  };
}

export interface ShapeTextBody {
  /** Text insets */
  insets?: {
    left?: number;
    top?: number;
    right?: number;
    bottom?: number;
  };
  /** Vertical alignment */
  anchor?: 'top' | 'center' | 'bottom';
  /** Horizontal alignment */
  anchorCtr?: boolean;
  /** Word wrap */
  wrap?: 'none' | 'square';
  /** Text rotation */
  rotation?: number;
  /** Paragraphs inside shape */
  paragraphs?: Paragraph[];
}

export interface Shape {
  /** Shape type preset */
  type?: ShapeType;
  /** Custom geometry (if not preset) */
  customGeometry?: string;
  /** Drawing ID */
  id?: string;
  /** Shape name */
  name?: string;
  /** Hidden */
  hidden?: boolean;
  /** Size */
  size?: ImageSize;
  /** Position */
  positionH?: ImagePosition;
  positionV?: ImagePosition;
  /** Fill */
  fill?: ShapeFill;
  /** Outline */
  outline?: ShapeOutline;
  /** Transform (rotation, flip) */
  transform?: ImageTransform;
  /** Effect extent */
  effectExtent?: {
    left?: number;
    top?: number;
    right?: number;
    bottom?: number;
  };
  /** Wrap mode */
  wrap?: ImageWrap;
  /** Text content inside shape */
  textBody?: ShapeTextBody;
  /** Behind document */
  behindDoc?: boolean;
}

// ============================================================================
// Text Box Types
// ============================================================================

export interface TextBox {
  /** Text box ID */
  id?: string;
  /** Text box name */
  name?: string;
  /** Size */
  size?: ImageSize;
  /** Position */
  positionH?: ImagePosition;
  positionV?: ImagePosition;
  /** Fill */
  fill?: ShapeFill;
  /** Outline */
  outline?: ShapeOutline;
  /** Text insets */
  insets?: {
    left?: number;
    top?: number;
    right?: number;
    bottom?: number;
  };
  /** Wrap mode */
  wrap?: ImageWrap;
  /** Content */
  content: Array<Paragraph | Table>;
}

// ============================================================================
// List/Numbering Types
// ============================================================================

export type NumberFormat =
  | 'decimal'
  | 'upperRoman'
  | 'lowerRoman'
  | 'upperLetter'
  | 'lowerLetter'
  | 'ordinal'
  | 'cardinalText'
  | 'ordinalText'
  | 'bullet'
  | 'none'
  | 'chicago'
  | 'decimalFullWidth'
  | 'decimalHalfWidth'
  | 'japaneseCounting'
  | 'japaneseDigitalTenThousand'
  | 'decimalEnclosedCircle'
  | 'decimalEnclosedFullstop'
  | 'decimalEnclosedParen'
  | 'decimalZero'
  | 'ideographDigital'
  | 'ideographTraditional'
  | 'ideographLegalTraditional'
  | 'ideographZodiac'
  | 'ideographZodiacTraditional'
  | 'taiwaneseCounting'
  | 'koreanDigital'
  | 'koreanCounting'
  | 'koreanLegal'
  | 'koreanDigital2'
  | 'vietnameseCounting'
  | 'russianLower'
  | 'russianUpper'
  | 'hebrew1'
  | 'hebrew2'
  | 'arabicAlpha'
  | 'arabicAbjad'
  | 'hindiVowels'
  | 'hindiConsonants'
  | 'hindiNumbers'
  | 'hindiCounting'
  | 'thaiLetters'
  | 'thaiNumbers'
  | 'thaiCounting';

export interface ListLevel {
  /** Level number (0-8) */
  ilvl: number;
  /** Starting number */
  start?: number;
  /** Number format */
  numFmt?: NumberFormat;
  /** Restart after level */
  lvlRestart?: number;
  /** Paragraph style link */
  pStyle?: string;
  /** Is legal numbering */
  isLgl?: boolean;
  /** Suffix (tab, space, nothing) */
  suff?: 'tab' | 'space' | 'nothing';
  /** Level text (e.g., "%1.", "%1.%2") */
  lvlText?: string;
  /** Level picture bullet */
  lvlPicBulletId?: number;
  /** Legacy settings */
  legacy?: {
    legacy?: boolean;
    legacySpace?: number;
    legacyIndent?: number;
  };
  /** Justification */
  lvlJc?: 'left' | 'center' | 'right' | 'start' | 'end';
  /** Paragraph properties for this level */
  pPr?: ParagraphFormatting;
  /** Run properties for the number/bullet */
  rPr?: TextFormatting;
}

export interface AbstractNumbering {
  /** Abstract numbering ID */
  abstractNumId: number | string;
  /** Numbering style link */
  nsid?: string;
  /** Multi-level type */
  multiLevelType?: 'singleLevel' | 'multilevel' | 'hybridMultilevel';
  /** Template code */
  tmpl?: string;
  /** Name */
  name?: string;
  /** Style link */
  styleLink?: string;
  /** Numbering style link */
  numStyleLink?: string;
  /** Levels */
  lvl: ListLevel[];
}

export interface NumberingInstance {
  /** Numbering instance ID */
  numId: number | string;
  /** Reference to abstract numbering */
  abstractNumId: number | string;
  /** Level overrides */
  lvlOverride?: Array<{
    ilvl: number;
    startOverride?: number;
    lvl?: ListLevel;
  }>;
}

export interface NumberingDefinitions {
  /** Abstract numbering definitions */
  abstractNum: AbstractNumbering[];
  /** Numbering instances */
  num: NumberingInstance[];
  /** Picture bullets */
  numPicBullet?: Array<{
    numPicBulletId: number;
    pict: Image;
  }>;
}

export interface ListRendering {
  /** Computed marker text (e.g., "1.", "a)", "•") */
  markerText?: string;
  /** Path in list hierarchy */
  path?: number[];
  /** Numbering type */
  numberingType?: NumberFormat;
}

// ============================================================================
// Footnote/Endnote Types
// ============================================================================

export type FootnoteType = 'normal' | 'separator' | 'continuationSeparator' | 'continuationNotice';

export interface FootnoteReference {
  /** Footnote ID */
  id: string;
  /** Custom mark */
  customMark?: string;
}

export interface Footnote {
  /** Footnote ID */
  id: string;
  /** Footnote type */
  type?: FootnoteType;
  /** Footnote content */
  content: Paragraph[];
}

export interface Endnote {
  /** Endnote ID */
  id: string;
  /** Endnote type */
  type?: FootnoteType;
  /** Endnote content */
  content: Paragraph[];
}

export interface FootnoteProperties {
  /** Footnote position */
  pos?: 'pageBottom' | 'beneathText' | 'sectEnd' | 'docEnd';
  /** Number format */
  numFmt?: NumberFormat;
  /** Starting number */
  numStart?: number;
  /** Restart numbering */
  numRestart?: 'continuous' | 'eachSect' | 'eachPage';
}

export interface EndnoteProperties {
  /** Endnote position */
  pos?: 'sectEnd' | 'docEnd';
  /** Number format */
  numFmt?: NumberFormat;
  /** Starting number */
  numStart?: number;
  /** Restart numbering */
  numRestart?: 'continuous' | 'eachSect';
}

// ============================================================================
// Header/Footer Types
// ============================================================================

export type HeaderFooterType = 'default' | 'first' | 'even';

export interface HeaderFooter {
  /** Header/footer type */
  type: HeaderFooterType;
  /** Relationship ID */
  rId: string;
  /** Content */
  content: Array<Paragraph | Table>;
}

export interface HeaderReference {
  type: HeaderFooterType;
  rId: string;
}

export interface FooterReference {
  type: HeaderFooterType;
  rId: string;
}

// ============================================================================
// Section Properties
// ============================================================================

export type PageOrientation = 'portrait' | 'landscape';

export type SectionType = 'continuous' | 'nextPage' | 'nextColumn' | 'evenPage' | 'oddPage';

export interface PageSize {
  /** Width (twips) */
  w: number;
  /** Height (twips) */
  h: number;
  /** Orientation */
  orient?: PageOrientation;
  /** Paper code */
  code?: number;
}

export interface PageMargins {
  /** Top margin (twips) */
  top: number;
  /** Bottom margin (twips) */
  bottom: number;
  /** Left margin (twips) */
  left: number;
  /** Right margin (twips) */
  right: number;
  /** Header distance from top (twips) */
  header?: number;
  /** Footer distance from bottom (twips) */
  footer?: number;
  /** Gutter (twips) */
  gutter?: number;
}

export interface PageBorders {
  top?: BorderSpec;
  bottom?: BorderSpec;
  left?: BorderSpec;
  right?: BorderSpec;
  /** Apply to */
  display?: 'allPages' | 'firstPage' | 'notFirstPage';
  /** Offset from */
  offsetFrom?: 'page' | 'text';
  /** Z-ordering */
  zOrder?: 'front' | 'back';
}

export interface ColumnDefinition {
  /** Column width (twips) */
  w?: number;
  /** Space after column (twips) */
  space?: number;
}

export interface Columns {
  /** Equal width columns */
  equalWidth?: boolean;
  /** Number of columns */
  num?: number;
  /** Space between columns (twips) */
  space?: number;
  /** Separator line between columns */
  sep?: boolean;
  /** Individual column definitions */
  col?: ColumnDefinition[];
}

export interface LineNumbers {
  /** Count by */
  countBy?: number;
  /** Starting line number */
  start?: number;
  /** Distance from text (twips) */
  distance?: number;
  /** Restart */
  restart?: 'newPage' | 'newSection' | 'continuous';
}

export interface SectionProperties {
  /** Section type */
  type?: SectionType;
  /** Page size */
  pgSz?: PageSize;
  /** Page margins */
  pgMar?: PageMargins;
  /** Page borders */
  pgBorders?: PageBorders;
  /** Page numbering */
  pgNumType?: {
    fmt?: NumberFormat;
    start?: number;
    chapStyle?: number;
    chapSep?: 'hyphen' | 'period' | 'colon' | 'emDash' | 'enDash';
  };
  /** Columns */
  cols?: Columns;
  /** Line numbers */
  lnNumType?: LineNumbers;
  /** Header references */
  headerReference?: HeaderReference[];
  /** Footer references */
  footerReference?: FooterReference[];
  /** Footnote properties */
  footnotePr?: FootnoteProperties;
  /** Endnote properties */
  endnotePr?: EndnoteProperties;
  /** Form protection */
  formProt?: boolean;
  /** Vertical alignment */
  vAlign?: 'top' | 'center' | 'both' | 'bottom';
  /** No endnote */
  noEndnote?: boolean;
  /** Title page (different first page header/footer) */
  titlePg?: boolean;
  /** Text direction */
  textDirection?: TextDirection;
  /** Bidirectional */
  bidi?: boolean;
  /** RTL gutter */
  rtlGutter?: boolean;
  /** Document grid */
  docGrid?: {
    type?: 'default' | 'lines' | 'linesAndChars' | 'snapToChars';
    linePitch?: number;
    charSpace?: number;
  };
  /** Printer settings relationship */
  printerSettings?: string;
  /** Revision IDs */
  rsidR?: string;
  rsidSect?: string;
}

// ============================================================================
// Paragraph Types
// ============================================================================

export type ParagraphContent =
  | Run
  | Hyperlink
  | BookmarkStart
  | BookmarkEnd
  | SimpleField
  | { type: 'sdt'; content: ParagraphContent[] }
  | { type: 'del'; author?: string; date?: string; content: ParagraphContent[] }
  | { type: 'ins'; author?: string; date?: string; content: ParagraphContent[] };

export interface Paragraph {
  /** Paragraph properties */
  properties?: ParagraphFormatting;
  /** Paragraph content */
  content: ParagraphContent[];
  /** Computed list rendering info */
  listRendering?: ListRendering;
  /** Section properties (if last paragraph of section) */
  sectPr?: SectionProperties;
  /** Revision IDs */
  rsidR?: string;
  rsidRDefault?: string;
  rsidP?: string;
  rsidRPr?: string;
}

// ============================================================================
// Document Structure Types
// ============================================================================

export type DocumentContent = Paragraph | Table | { type: 'sdt'; content: DocumentContent[] };

export interface DocumentBody {
  /** Body content */
  content: DocumentContent[];
  /** Body section properties */
  sectPr?: SectionProperties;
}

export interface Section {
  /** Section ID */
  id?: string;
  /** Section content */
  content: DocumentContent[];
  /** Section properties */
  properties: SectionProperties;
  /** Headers for this section */
  headers?: HeaderFooter[];
  /** Footers for this section */
  footers?: HeaderFooter[];
}

// ============================================================================
// Theme Types
// ============================================================================

export interface ThemeColorScheme {
  name: string;
  dk1: string;
  lt1: string;
  dk2: string;
  lt2: string;
  accent1: string;
  accent2: string;
  accent3: string;
  accent4: string;
  accent5: string;
  accent6: string;
  hlink: string;
  folHlink: string;
}

export interface ThemeFontScheme {
  name: string;
  majorFont: {
    latin: string;
    ea?: string;
    cs?: string;
  };
  minorFont: {
    latin: string;
    ea?: string;
    cs?: string;
  };
}

export interface Theme {
  name?: string;
  colorScheme: ThemeColorScheme;
  fontScheme: ThemeFontScheme;
}

// ============================================================================
// Style Types
// ============================================================================

export type StyleType = 'paragraph' | 'character' | 'table' | 'numbering';

export interface Style {
  /** Style ID */
  styleId: string;
  /** Style type */
  type: StyleType;
  /** Display name */
  name?: string;
  /** Based on style */
  basedOn?: string;
  /** Next paragraph style */
  next?: string;
  /** Linked style */
  link?: string;
  /** Auto redefine */
  autoRedefine?: boolean;
  /** Hidden */
  hidden?: boolean;
  /** UI priority */
  uiPriority?: number;
  /** Semi-hidden */
  semiHidden?: boolean;
  /** Unhide when used */
  unhideWhenUsed?: boolean;
  /** Quick format */
  qFormat?: boolean;
  /** Locked */
  locked?: boolean;
  /** Is default style */
  default?: boolean;
  /** Personal style */
  personal?: boolean;
  /** Personal compose */
  personalCompose?: boolean;
  /** Personal reply */
  personalReply?: boolean;
  /** Custom style */
  customStyle?: boolean;
  /** Paragraph properties (for paragraph/table styles) */
  pPr?: ParagraphFormatting;
  /** Run properties */
  rPr?: TextFormatting;
  /** Table properties (for table styles) */
  tblPr?: TableFormatting;
  /** Table row properties */
  trPr?: TableRowFormatting;
  /** Table cell properties */
  tcPr?: TableCellFormatting;
  /** Table style conditional formatting */
  tblStylePr?: Array<{
    type: string;
    pPr?: ParagraphFormatting;
    rPr?: TextFormatting;
    tblPr?: TableFormatting;
    trPr?: TableRowFormatting;
    tcPr?: TableCellFormatting;
  }>;
  /** Revision ID */
  rsid?: string;
}

export interface DocDefaults {
  /** Default run properties */
  rPrDefault?: {
    rPr?: TextFormatting;
  };
  /** Default paragraph properties */
  pPrDefault?: {
    pPr?: ParagraphFormatting;
  };
}

export interface StyleDefinitions {
  /** Document defaults */
  docDefaults?: DocDefaults;
  /** Latent styles */
  latentStyles?: {
    defLockedState?: boolean;
    defUIPriority?: number;
    defSemiHidden?: boolean;
    defUnhideWhenUsed?: boolean;
    defQFormat?: boolean;
    count?: number;
    lsdException?: Array<{
      name: string;
      locked?: boolean;
      uiPriority?: number;
      semiHidden?: boolean;
      unhideWhenUsed?: boolean;
      qFormat?: boolean;
    }>;
  };
  /** Styles */
  style: Style[];
}

// ============================================================================
// Font Table Types
// ============================================================================

export interface FontInfo {
  /** Font name */
  name: string;
  /** Font family */
  family?: 'auto' | 'decorative' | 'modern' | 'roman' | 'script' | 'swiss';
  /** Character set */
  charset?: string;
  /** Pitch */
  pitch?: 'default' | 'fixed' | 'variable';
  /** Panose-1 number */
  panose1?: string;
  /** Signature */
  sig?: {
    usb0?: string;
    usb1?: string;
    usb2?: string;
    usb3?: string;
    csb0?: string;
    csb1?: string;
  };
  /** Embedded font */
  embedRegular?: {
    fontKey?: string;
    rId: string;
    subsetted?: boolean;
  };
  /** Embedded bold font */
  embedBold?: {
    fontKey?: string;
    rId: string;
    subsetted?: boolean;
  };
  /** Embedded italic font */
  embedItalic?: {
    fontKey?: string;
    rId: string;
    subsetted?: boolean;
  };
  /** Embedded bold italic font */
  embedBoldItalic?: {
    fontKey?: string;
    rId: string;
    subsetted?: boolean;
  };
  /** Alternate name */
  altName?: string;
}

export interface FontTable {
  font: FontInfo[];
}

// ============================================================================
// Relationship Types
// ============================================================================

export type RelationshipType =
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments'
  | 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties'
  | string;

export interface Relationship {
  /** Relationship ID */
  id: string;
  /** Relationship type */
  type: RelationshipType;
  /** Target path */
  target: string;
  /** Target mode (external for hyperlinks) */
  targetMode?: 'External' | 'Internal';
}

export interface RelationshipMap {
  [rId: string]: Relationship;
}

// ============================================================================
// Document Package Types
// ============================================================================

export interface MediaFile {
  /** File path within package */
  path: string;
  /** File content */
  data: Uint8Array | ArrayBuffer;
  /** Content type */
  contentType: string;
}

export interface DocxPackage {
  /** Document body */
  body: DocumentBody;
  /** Styles */
  styles?: StyleDefinitions;
  /** Theme */
  theme?: Theme;
  /** Numbering definitions */
  numbering?: NumberingDefinitions;
  /** Font table */
  fontTable?: FontTable;
  /** Headers */
  headers: Map<string, HeaderFooter>;
  /** Footers */
  footers: Map<string, HeaderFooter>;
  /** Footnotes */
  footnotes: Map<string, Footnote>;
  /** Endnotes */
  endnotes: Map<string, Endnote>;
  /** Media files */
  media: Map<string, MediaFile>;
  /** Relationships */
  relationships: RelationshipMap;
  /** Document relationships */
  documentRelationships: RelationshipMap;
  /** Core properties */
  coreProperties?: {
    title?: string;
    subject?: string;
    creator?: string;
    keywords?: string;
    description?: string;
    lastModifiedBy?: string;
    revision?: number;
    created?: string;
    modified?: string;
  };
  /** App properties */
  appProperties?: {
    application?: string;
    appVersion?: string;
    pages?: number;
    words?: number;
    characters?: number;
    lines?: number;
    paragraphs?: number;
  };
  /** Settings */
  settings?: Record<string, unknown>;
  /** Web settings */
  webSettings?: Record<string, unknown>;
}

// ============================================================================
// Complete Document Type
// ============================================================================

export interface Document {
  /** Document package data */
  package: DocxPackage;
  /** Sections */
  sections: Section[];
  /** All bookmarks in document */
  bookmarks: Map<string, BookmarkStart>;
  /** Detected template variables */
  templateVariables?: string[];
  /** Original ZIP for round-trip */
  originalZip?: unknown;
}
