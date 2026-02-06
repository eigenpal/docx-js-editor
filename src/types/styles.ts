/**
 * Styles, Theme, Font Table, Relationships & Media Types
 *
 * Types for document-level definitions that don't form the content tree.
 */

import type {
  TextFormatting,
  ParagraphFormatting,
  TableFormatting,
  TableRowFormatting,
  TableCellFormatting,
} from './formatting';

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
