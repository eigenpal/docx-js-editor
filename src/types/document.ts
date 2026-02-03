/**
 * Comprehensive TypeScript types for full DOCX document representation
 *
 * These types represent all elements that can appear in a DOCX file,
 * supporting full Microsoft Word fidelity including:
 * - Text and paragraph formatting
 * - Tables, images, shapes
 * - Hyperlinks, bookmarks, fields
 * - Lists, headers/footers, footnotes
 * - Themes, styles, page layout
 */

// ============================================================================
// COLOR & STYLING PRIMITIVES
// ============================================================================

/**
 * Theme color slots from theme1.xml
 */
export type ThemeColorSlot =
  | 'dk1'
  | 'lt1'
  | 'dk2'
  | 'lt2'
  | 'accent1'
  | 'accent2'
  | 'accent3'
  | 'accent4'
  | 'accent5'
  | 'accent6'
  | 'hlink'
  | 'folHlink'
  | 'background1'
  | 'text1'
  | 'background2'
  | 'text2';

/**
 * Color value - can be direct RGB, theme reference, or auto
 */
export interface ColorValue {
  /** RGB hex value without # (e.g., "FF0000") */
  rgb?: string;
  /** Theme color slot reference */
  themeColor?: ThemeColorSlot;
  /** Tint modifier (0-255 as hex string, e.g., "80") - makes color lighter */
  themeTint?: string;
  /** Shade modifier (0-255 as hex string) - makes color darker */
  themeShade?: string;
  /** Auto color - context-dependent (usually black for text) */
  auto?: boolean;
}

/**
 * Border specification for any border (paragraph, table, page)
 */
export interface BorderSpec {
  /** Border style */
  style:
    | 'none'
    | 'single'
    | 'double'
    | 'dotted'
    | 'dashed'
    | 'thick'
    | 'triple'
    | 'thinThickSmallGap'
    | 'thickThinSmallGap'
    | 'thinThickMediumGap'
    | 'thickThinMediumGap'
    | 'thinThickLargeGap'
    | 'thickThinLargeGap'
    | 'wave'
    | 'doubleWave'
    | 'dashSmallGap'
    | 'dashDotStroked'
    | 'threeDEmboss'
    | 'threeDEngrave'
    | 'outset'
    | 'inset'
    | 'nil';
  /** Color of the border */
  color?: ColorValue;
  /** Width in eighths of a point (1/8 pt) */
  size?: number;
  /** Spacing from text in points */
  space?: number;
  /** Shadow effect */
  shadow?: boolean;
  /** Frame effect */
  frame?: boolean;
}

/**
 * Shading/background properties
 */
export interface ShadingProperties {
  /** Pattern fill color */
  color?: ColorValue;
  /** Background fill color */
  fill?: ColorValue;
  /** Shading pattern type */
  pattern?:
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
    | 'pct95'
    | 'nil';
}

// ============================================================================
// TEXT FORMATTING (Run Properties - rPr)
// ============================================================================

/**
 * Underline style options
 */
export type UnderlineStyle =
  | 'none'
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
  | 'wavyDouble';

/**
 * Text effect animations
 */
export type TextEffect =
  | 'none'
  | 'blinkBackground'
  | 'lights'
  | 'antsBlack'
  | 'antsRed'
  | 'shimmer'
  | 'sparkle';

/**
 * Emphasis mark type
 */
export type EmphasisMark = 'none' | 'dot' | 'comma' | 'circle' | 'underDot';

/**
 * Complete text formatting properties (w:rPr)
 */
export interface TextFormatting {
  // Basic formatting
  /** Bold (w:b) */
  bold?: boolean;
  /** Bold complex script (w:bCs) */
  boldCs?: boolean;
  /** Italic (w:i) */
  italic?: boolean;
  /** Italic complex script (w:iCs) */
  italicCs?: boolean;

  // Underline & strikethrough
  /** Underline style and color (w:u) */
  underline?: {
    style: UnderlineStyle;
    color?: ColorValue;
  };
  /** Strikethrough (w:strike) */
  strike?: boolean;
  /** Double strikethrough (w:dstrike) */
  doubleStrike?: boolean;

  // Vertical alignment
  /** Superscript/subscript (w:vertAlign) */
  vertAlign?: 'baseline' | 'superscript' | 'subscript';

  // Capitalization
  /** Small caps (w:smallCaps) */
  smallCaps?: boolean;
  /** All caps (w:caps) */
  allCaps?: boolean;

  // Visibility
  /** Hidden text (w:vanish) */
  hidden?: boolean;

  // Colors and highlighting
  /** Text color (w:color) */
  color?: ColorValue;
  /** Highlight/background color (w:highlight) */
  highlight?:
    | 'black'
    | 'blue'
    | 'cyan'
    | 'darkBlue'
    | 'darkCyan'
    | 'darkGray'
    | 'darkGreen'
    | 'darkMagenta'
    | 'darkRed'
    | 'darkYellow'
    | 'green'
    | 'lightGray'
    | 'magenta'
    | 'none'
    | 'red'
    | 'white'
    | 'yellow';
  /** Character shading (w:shd) */
  shading?: ShadingProperties;

  // Font properties
  /** Font size in half-points (w:sz) - e.g., 24 = 12pt */
  fontSize?: number;
  /** Font size complex script (w:szCs) */
  fontSizeCs?: number;
  /** Font family (w:rFonts) */
  fontFamily?: {
    ascii?: string;
    hAnsi?: string;
    eastAsia?: string;
    cs?: string;
    /** Theme font reference */
    asciiTheme?:
      | 'majorAscii'
      | 'majorHAnsi'
      | 'majorEastAsia'
      | 'majorBidi'
      | 'minorAscii'
      | 'minorHAnsi'
      | 'minorEastAsia'
      | 'minorBidi';
    hAnsiTheme?: string;
    eastAsiaTheme?: string;
    csTheme?: string;
  };

  // Spacing and position
  /** Character spacing in twips (w:spacing) */
  spacing?: number;
  /** Raised/lowered text position in half-points (w:position) */
  position?: number;
  /** Horizontal text scale percentage (w:w) */
  scale?: number;
  /** Kerning threshold in half-points (w:kern) */
  kerning?: number;

  // Effects
  /** Text effect animation (w:effect) */
  effect?: TextEffect;
  /** Emphasis mark (w:em) */
  emphasisMark?: EmphasisMark;
  /** Emboss effect (w:emboss) */
  emboss?: boolean;
  /** Imprint/engrave effect (w:imprint) */
  imprint?: boolean;
  /** Outline effect (w:outline) */
  outline?: boolean;
  /** Shadow effect (w:shadow) */
  shadow?: boolean;

  // Complex script
  /** Right-to-left text (w:rtl) */
  rtl?: boolean;
  /** Complex script formatting (w:cs) */
  cs?: boolean;

  // Style reference
  /** Character style ID (w:rStyle) */
  styleId?: string;
}

// ============================================================================
// PARAGRAPH FORMATTING (Paragraph Properties - pPr)
// ============================================================================

/**
 * Tab stop alignment
 */
export type TabStopAlignment = 'left' | 'center' | 'right' | 'decimal' | 'bar' | 'clear' | 'num';

/**
 * Tab leader character
 */
export type TabLeader = 'none' | 'dot' | 'hyphen' | 'underscore' | 'heavy' | 'middleDot';

/**
 * Tab stop definition
 */
export interface TabStop {
  /** Position in twips from left margin */
  position: number;
  /** Alignment at tab stop */
  alignment: TabStopAlignment;
  /** Leader character */
  leader?: TabLeader;
}

/**
 * Line spacing rule
 */
export type LineSpacingRule = 'auto' | 'exact' | 'atLeast';

/**
 * Paragraph alignment/justification
 */
export type ParagraphAlignment =
  | 'left'
  | 'center'
  | 'right'
  | 'both'
  | 'distribute'
  | 'mediumKashida'
  | 'highKashida'
  | 'lowKashida'
  | 'thaiDistribute';

/**
 * Complete paragraph formatting properties (w:pPr)
 */
export interface ParagraphFormatting {
  // Alignment
  /** Paragraph alignment (w:jc) */
  alignment?: ParagraphAlignment;
  /** Text direction (w:bidi) */
  bidi?: boolean;

  // Spacing
  /** Spacing before in twips (w:spacing/@w:before) */
  spaceBefore?: number;
  /** Spacing after in twips (w:spacing/@w:after) */
  spaceAfter?: number;
  /** Line spacing value (w:spacing/@w:line) */
  lineSpacing?: number;
  /** Line spacing rule (w:spacing/@w:lineRule) */
  lineSpacingRule?: LineSpacingRule;
  /** Auto space before (w:spacing/@w:beforeAutospacing) */
  beforeAutospacing?: boolean;
  /** Auto space after (w:spacing/@w:afterAutospacing) */
  afterAutospacing?: boolean;

  // Indentation
  /** Left indent in twips (w:ind/@w:left) */
  indentLeft?: number;
  /** Right indent in twips (w:ind/@w:right) */
  indentRight?: number;
  /** First line indent in twips - positive for indent, negative for hanging (w:ind/@w:firstLine or @w:hanging) */
  indentFirstLine?: number;
  /** Whether first line is hanging indent */
  hangingIndent?: boolean;

  // Borders
  /** Paragraph borders (w:pBdr) */
  borders?: {
    top?: BorderSpec;
    bottom?: BorderSpec;
    left?: BorderSpec;
    right?: BorderSpec;
    between?: BorderSpec;
    bar?: BorderSpec;
  };

  // Background
  /** Paragraph shading (w:shd) */
  shading?: ShadingProperties;

  // Tab stops
  /** Custom tab stops (w:tabs) */
  tabs?: TabStop[];

  // Page break control
  /** Keep with next paragraph (w:keepNext) */
  keepNext?: boolean;
  /** Keep lines together (w:keepLines) */
  keepLines?: boolean;
  /** Widow/orphan control (w:widowControl) */
  widowControl?: boolean;
  /** Page break before (w:pageBreakBefore) */
  pageBreakBefore?: boolean;

  // Numbering/List
  /** Numbering properties (w:numPr) */
  numPr?: {
    /** Numbering definition ID (w:numId) */
    numId?: number;
    /** List level (0-8) (w:ilvl) */
    ilvl?: number;
  };

  // Outline level (for TOC)
  /** Outline level 0-9 (w:outlineLvl) */
  outlineLevel?: number;

  // Style reference
  /** Paragraph style ID (w:pStyle) */
  styleId?: string;

  // Frame properties
  /** Text frame properties (w:framePr) */
  frame?: {
    width?: number;
    height?: number;
    hAnchor?: 'text' | 'margin' | 'page';
    vAnchor?: 'text' | 'margin' | 'page';
    x?: number;
    y?: number;
    xAlign?: 'left' | 'center' | 'right' | 'inside' | 'outside';
    yAlign?: 'top' | 'center' | 'bottom' | 'inside' | 'outside' | 'inline';
    wrap?: 'around' | 'auto' | 'none' | 'notBeside' | 'through' | 'tight';
  };

  // Suppress
  /** Suppress line numbers (w:suppressLineNumbers) */
  suppressLineNumbers?: boolean;
  /** Suppress auto hyphens (w:suppressAutoHyphens) */
  suppressAutoHyphens?: boolean;

  // Default run properties for this paragraph
  /** Run properties to apply to all runs (w:rPr) */
  runProperties?: TextFormatting;
}

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
 * Table width type
 */
export type TableWidthType = 'auto' | 'dxa' | 'nil' | 'pct';

/**
 * Table measurement (width or height)
 */
export interface TableMeasurement {
  /** Value in twips (for dxa) or fifths of a percent (for pct) */
  value: number;
  /** Measurement type */
  type: TableWidthType;
}

/**
 * Table borders
 */
export interface TableBorders {
  top?: BorderSpec;
  bottom?: BorderSpec;
  left?: BorderSpec;
  right?: BorderSpec;
  insideH?: BorderSpec;
  insideV?: BorderSpec;
}

/**
 * Cell margins
 */
export interface CellMargins {
  top?: TableMeasurement;
  bottom?: TableMeasurement;
  left?: TableMeasurement;
  right?: TableMeasurement;
}

/**
 * Table look flags (for table styles)
 */
export interface TableLook {
  firstColumn?: boolean;
  firstRow?: boolean;
  lastColumn?: boolean;
  lastRow?: boolean;
  noHBand?: boolean;
  noVBand?: boolean;
}

/**
 * Floating table properties
 */
export interface FloatingTableProperties {
  /** Horizontal anchor */
  horzAnchor?: 'margin' | 'page' | 'text';
  /** Vertical anchor */
  vertAnchor?: 'margin' | 'page' | 'text';
  /** Horizontal position */
  tblpX?: number;
  tblpXSpec?: 'left' | 'center' | 'right' | 'inside' | 'outside';
  /** Vertical position */
  tblpY?: number;
  tblpYSpec?: 'top' | 'center' | 'bottom' | 'inside' | 'outside' | 'inline';
  /** Distance from surrounding text */
  topFromText?: number;
  bottomFromText?: number;
  leftFromText?: number;
  rightFromText?: number;
}

/**
 * Table formatting properties (w:tblPr)
 */
export interface TableFormatting {
  /** Table width */
  width?: TableMeasurement;
  /** Table justification */
  justification?: 'left' | 'center' | 'right';
  /** Cell spacing */
  cellSpacing?: TableMeasurement;
  /** Table indent from left margin */
  indent?: TableMeasurement;
  /** Table borders */
  borders?: TableBorders;
  /** Default cell margins */
  cellMargins?: CellMargins;
  /** Table layout */
  layout?: 'fixed' | 'autofit';
  /** Table style ID */
  styleId?: string;
  /** Table look (conditional formatting flags) */
  look?: TableLook;
  /** Shading/background */
  shading?: ShadingProperties;
  /** Overlap for floating tables */
  overlap?: 'never' | 'overlap';
  /** Floating table properties */
  floating?: FloatingTableProperties;
  /** Right to left table */
  bidi?: boolean;
}

/**
 * Table row formatting properties (w:trPr)
 */
export interface TableRowFormatting {
  /** Row height */
  height?: TableMeasurement;
  /** Height rule */
  heightRule?: 'auto' | 'atLeast' | 'exact';
  /** Header row (repeats on each page) */
  header?: boolean;
  /** Allow row to break across pages */
  cantSplit?: boolean;
  /** Row justification */
  justification?: 'left' | 'center' | 'right';
  /** Hidden row */
  hidden?: boolean;
}

/**
 * Conditional format style
 */
export interface ConditionalFormatStyle {
  /** First row */
  firstRow?: boolean;
  /** Last row */
  lastRow?: boolean;
  /** First column */
  firstColumn?: boolean;
  /** Last column */
  lastColumn?: boolean;
  /** Odd horizontal band */
  oddHBand?: boolean;
  /** Even horizontal band */
  evenHBand?: boolean;
  /** Odd vertical band */
  oddVBand?: boolean;
  /** Even vertical band */
  evenVBand?: boolean;
  /** Northwest corner */
  nwCell?: boolean;
  /** Northeast corner */
  neCell?: boolean;
  /** Southwest corner */
  swCell?: boolean;
  /** Southeast corner */
  seCell?: boolean;
}

/**
 * Table cell formatting properties (w:tcPr)
 */
export interface TableCellFormatting {
  /** Cell width */
  width?: TableMeasurement;
  /** Cell borders */
  borders?: TableBorders;
  /** Cell margins (override table default) */
  margins?: CellMargins;
  /** Cell shading/background */
  shading?: ShadingProperties;
  /** Vertical alignment */
  verticalAlign?: 'top' | 'center' | 'bottom';
  /** Text direction */
  textDirection?: 'lr' | 'lrV' | 'rl' | 'rlV' | 'tb' | 'tbV' | 'tbRl' | 'tbRlV' | 'btLr';
  /** Grid span (horizontal merge) */
  gridSpan?: number;
  /** Vertical merge */
  vMerge?: 'restart' | 'continue';
  /** Fit text to cell width */
  fitText?: boolean;
  /** Wrap text */
  noWrap?: boolean;
  /** Hide cell marker */
  hideMark?: boolean;
  /** Conditional format style */
  conditionalFormat?: ConditionalFormatStyle;
}

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
// LISTS & NUMBERING
// ============================================================================

/**
 * Number format type
 */
export type NumberFormat =
  | 'decimal'
  | 'upperRoman'
  | 'lowerRoman'
  | 'upperLetter'
  | 'lowerLetter'
  | 'ordinal'
  | 'cardinalText'
  | 'ordinalText'
  | 'hex'
  | 'chicago'
  | 'ideographDigital'
  | 'japaneseCounting'
  | 'aiueo'
  | 'iroha'
  | 'decimalFullWidth'
  | 'decimalHalfWidth'
  | 'japaneseLegal'
  | 'japaneseDigitalTenThousand'
  | 'decimalEnclosedCircle'
  | 'decimalFullWidth2'
  | 'aiueoFullWidth'
  | 'irohaFullWidth'
  | 'decimalZero'
  | 'bullet'
  | 'ganada'
  | 'chosung'
  | 'decimalEnclosedFullstop'
  | 'decimalEnclosedParen'
  | 'decimalEnclosedCircleChinese'
  | 'ideographEnclosedCircle'
  | 'ideographTraditional'
  | 'ideographZodiac'
  | 'ideographZodiacTraditional'
  | 'taiwaneseCounting'
  | 'ideographLegalTraditional'
  | 'taiwaneseCountingThousand'
  | 'taiwaneseDigital'
  | 'chineseCounting'
  | 'chineseLegalSimplified'
  | 'chineseCountingThousand'
  | 'koreanDigital'
  | 'koreanCounting'
  | 'koreanLegal'
  | 'koreanDigital2'
  | 'vietnameseCounting'
  | 'russianLower'
  | 'russianUpper'
  | 'none'
  | 'numberInDash'
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

/**
 * Multi-level suffix (what follows the number)
 */
export type LevelSuffix = 'tab' | 'space' | 'nothing';

/**
 * List level definition
 */
export interface ListLevel {
  /** Level index (0-8) */
  ilvl: number;
  /** Starting number */
  start?: number;
  /** Number format */
  numFmt: NumberFormat;
  /** Level text (e.g., "%1." or "•") */
  lvlText: string;
  /** Justification */
  lvlJc?: 'left' | 'center' | 'right';
  /** Suffix after number */
  suffix?: LevelSuffix;
  /** Paragraph properties for this level */
  pPr?: ParagraphFormatting;
  /** Run properties for the number/bullet */
  rPr?: TextFormatting;
  /** Restart numbering from higher level */
  lvlRestart?: number;
  /** Is legal numbering style */
  isLgl?: boolean;
  /** Legacy settings */
  legacy?: {
    legacy?: boolean;
    legacySpace?: number;
    legacyIndent?: number;
  };
}

/**
 * Abstract numbering definition (w:abstractNum)
 */
export interface AbstractNumbering {
  /** Abstract numbering ID */
  abstractNumId: number;
  /** Multi-level type */
  multiLevelType?: 'hybridMultilevel' | 'multilevel' | 'singleLevel';
  /** Numbering style link */
  numStyleLink?: string;
  /** Style link */
  styleLink?: string;
  /** Level definitions */
  levels: ListLevel[];
  /** Name */
  name?: string;
}

/**
 * Numbering instance (w:num)
 */
export interface NumberingInstance {
  /** Numbering ID (referenced by paragraphs) */
  numId: number;
  /** Reference to abstract numbering */
  abstractNumId: number;
  /** Level overrides */
  levelOverrides?: Array<{
    ilvl: number;
    startOverride?: number;
    lvl?: ListLevel;
  }>;
}

/**
 * Computed list rendering info
 */
export interface ListRendering {
  /** Computed marker text (e.g., "1.", "a)", "•") */
  marker: string;
  /** List level (0-8) */
  level: number;
  /** Numbering ID */
  numId: number;
  /** Whether this is a bullet or numbered list */
  isBullet: boolean;
  /** Number format type (decimal, lowerRoman, upperRoman, etc.) */
  numFmt?: NumberFormat;
}

/**
 * Complete numbering definitions
 */
export interface NumberingDefinitions {
  /** Abstract numbering definitions */
  abstractNums: AbstractNumbering[];
  /** Numbering instances */
  nums: NumberingInstance[];
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

// ============================================================================
// STYLES
// ============================================================================

/**
 * Style type
 */
export type StyleType = 'paragraph' | 'character' | 'numbering' | 'table';

/**
 * Style definition
 */
export interface Style {
  /** Style ID */
  styleId: string;
  /** Style type */
  type: StyleType;
  /** Display name */
  name?: string;
  /** Based on style ID */
  basedOn?: string;
  /** Next style after Enter (for paragraph styles) */
  next?: string;
  /** Linked style (paragraph/character pair) */
  link?: string;
  /** UI sort priority */
  uiPriority?: number;
  /** Hidden from UI */
  hidden?: boolean;
  /** Semi-hidden from UI */
  semiHidden?: boolean;
  /** Unhide when used */
  unhideWhenUsed?: boolean;
  /** Quick format in gallery */
  qFormat?: boolean;
  /** Is default style */
  default?: boolean;
  /** Personal style (custom) */
  personal?: boolean;
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
  /** Conditional table style parts */
  tblStylePr?: Array<{
    type:
      | 'band1Horz'
      | 'band1Vert'
      | 'band2Horz'
      | 'band2Vert'
      | 'firstCol'
      | 'firstRow'
      | 'lastCol'
      | 'lastRow'
      | 'neCell'
      | 'nwCell'
      | 'seCell'
      | 'swCell';
    pPr?: ParagraphFormatting;
    rPr?: TextFormatting;
    tblPr?: TableFormatting;
    trPr?: TableRowFormatting;
    tcPr?: TableCellFormatting;
  }>;
}

/**
 * Document defaults (w:docDefaults)
 */
export interface DocDefaults {
  /** Default run properties */
  rPr?: TextFormatting;
  /** Default paragraph properties */
  pPr?: ParagraphFormatting;
}

/**
 * Style definitions from styles.xml
 */
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
  };
  /** Style definitions */
  styles: Style[];
}

// ============================================================================
// THEME
// ============================================================================

/**
 * Theme color scheme (a:clrScheme)
 */
export interface ThemeColorScheme {
  /** Dark 1 color (usually black) */
  dk1?: string;
  /** Light 1 color (usually white) */
  lt1?: string;
  /** Dark 2 color */
  dk2?: string;
  /** Light 2 color */
  lt2?: string;
  /** Accent colors 1-6 */
  accent1?: string;
  accent2?: string;
  accent3?: string;
  accent4?: string;
  accent5?: string;
  accent6?: string;
  /** Hyperlink color */
  hlink?: string;
  /** Followed hyperlink color */
  folHlink?: string;
}

/**
 * Theme font (with script variants)
 */
export interface ThemeFont {
  /** Latin font */
  latin?: string;
  /** East Asian font */
  ea?: string;
  /** Complex script font */
  cs?: string;
  /** Script-specific fonts */
  fonts?: Record<string, string>;
}

/**
 * Theme font scheme (a:fontScheme)
 */
export interface ThemeFontScheme {
  /** Major font (headings) */
  majorFont?: ThemeFont;
  /** Minor font (body text) */
  minorFont?: ThemeFont;
}

/**
 * Theme (from theme1.xml)
 */
export interface Theme {
  /** Theme name */
  name?: string;
  /** Color scheme */
  colorScheme?: ThemeColorScheme;
  /** Font scheme */
  fontScheme?: ThemeFontScheme;
  /** Format scheme (fills, lines, effects) - simplified */
  formatScheme?: {
    name?: string;
  };
}

// ============================================================================
// FONT TABLE
// ============================================================================

/**
 * Font info from fontTable.xml
 */
export interface FontInfo {
  /** Font name */
  name: string;
  /** Alternate names */
  altName?: string;
  /** Panose-1 classification */
  panose1?: string;
  /** Character set */
  charset?: string;
  /** Font family type */
  family?: 'decorative' | 'modern' | 'roman' | 'script' | 'swiss' | 'auto';
  /** Pitch (fixed or variable) */
  pitch?: 'default' | 'fixed' | 'variable';
  /** Signature */
  sig?: {
    usb0?: string;
    usb1?: string;
    usb2?: string;
    usb3?: string;
    csb0?: string;
    csb1?: string;
  };
  /** Embedded font data reference */
  embedRegular?: string;
  embedBold?: string;
  embedItalic?: string;
  embedBoldItalic?: string;
}

/**
 * Font table from fontTable.xml
 */
export interface FontTable {
  fonts: FontInfo[];
}

// ============================================================================
// RELATIONSHIPS
// ============================================================================

/**
 * Relationship type
 */
export type RelationshipType =
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart'
  | 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData'
  | string; // Allow other relationship types

/**
 * Relationship entry
 */
export interface Relationship {
  /** Relationship ID (e.g., "rId1") */
  id: string;
  /** Relationship type URI */
  type: RelationshipType;
  /** Target path or URL */
  target: string;
  /** Target mode */
  targetMode?: 'External' | 'Internal';
}

/**
 * Relationship map (keyed by rId)
 */
export type RelationshipMap = Map<string, Relationship>;

// ============================================================================
// MEDIA
// ============================================================================

/**
 * Media file from word/media/
 */
export interface MediaFile {
  /** File path in ZIP */
  path: string;
  /** Original filename */
  filename?: string;
  /** MIME type */
  mimeType: string;
  /** Binary data */
  data: ArrayBuffer;
  /** Base64 encoded data for rendering */
  base64?: string;
  /** Data URL for direct use in src attributes */
  dataUrl?: string;
}

// ============================================================================
// DOCX PACKAGE
// ============================================================================

/**
 * Complete DOCX package structure
 */
export interface DocxPackage {
  /** Document body */
  document: DocumentBody;
  /** Style definitions */
  styles?: StyleDefinitions;
  /** Theme */
  theme?: Theme;
  /** Numbering definitions */
  numbering?: NumberingDefinitions;
  /** Font table */
  fontTable?: FontTable;
  /** Footnotes */
  footnotes?: Footnote[];
  /** Endnotes */
  endnotes?: Endnote[];
  /** Headers by relationship ID */
  headers?: Map<string, HeaderFooter>;
  /** Footers by relationship ID */
  footers?: Map<string, HeaderFooter>;
  /** Document relationships */
  relationships?: RelationshipMap;
  /** Media files */
  media?: Map<string, MediaFile>;
  /** Document properties */
  properties?: {
    title?: string;
    subject?: string;
    creator?: string;
    keywords?: string;
    description?: string;
    lastModifiedBy?: string;
    revision?: number;
    created?: Date;
    modified?: Date;
  };
}

// ============================================================================
// TOP-LEVEL DOCUMENT
// ============================================================================

/**
 * Complete parsed DOCX document
 */
export interface Document {
  /** DOCX package with all parsed content */
  package: DocxPackage;
  /** Original ArrayBuffer for round-trip */
  originalBuffer?: ArrayBuffer;
  /** Detected template variables ({{...}}) */
  templateVariables?: string[];
  /** Parsing warnings/errors */
  warnings?: string[];
}
