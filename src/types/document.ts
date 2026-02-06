/**
 * Comprehensive TypeScript types for full DOCX document representation
 *
 * This barrel file re-exports all types from the split modules.
 * Existing imports from './types/document' continue to work unchanged.
 *
 * Module structure:
 * - colors.ts      — Color primitives, borders, shading
 * - formatting.ts  — Text, paragraph, and table formatting properties
 * - lists.ts       — Numbering and list definitions
 * - content.ts     — Content model (runs, images, shapes, tables, paragraphs, sections)
 * - styles.ts      — Styles, theme, fonts, relationships, media
 */

// Color & Styling Primitives
export type { ThemeColorSlot, ColorValue, BorderSpec, ShadingProperties } from './colors';

// Text & Paragraph Formatting
export type {
  UnderlineStyle,
  TextEffect,
  EmphasisMark,
  TextFormatting,
  TabStopAlignment,
  TabLeader,
  TabStop,
  LineSpacingRule,
  ParagraphAlignment,
  ParagraphFormatting,
  TableWidthType,
  TableMeasurement,
  TableBorders,
  CellMargins,
  TableLook,
  FloatingTableProperties,
  TableFormatting,
  TableRowFormatting,
  ConditionalFormatStyle,
  TableCellFormatting,
} from './formatting';

// Lists & Numbering
export type {
  NumberFormat,
  LevelSuffix,
  ListLevel,
  AbstractNumbering,
  NumberingInstance,
  ListRendering,
  NumberingDefinitions,
} from './lists';

// Content Model
export type {
  TextContent,
  TabContent,
  BreakContent,
  SymbolContent,
  NoteReferenceContent,
  FieldCharContent,
  InstrTextContent,
  SoftHyphenContent,
  NoBreakHyphenContent,
  DrawingContent,
  ShapeContent,
  RunContent,
  Run,
  Hyperlink,
  BookmarkStart,
  BookmarkEnd,
  FieldType,
  SimpleField,
  ComplexField,
  Field,
  ImageSize,
  ImageWrap,
  ImagePosition,
  ImageTransform,
  ImagePadding,
  Image,
  ShapeType,
  ShapeFill,
  ShapeOutline,
  ShapeTextBody,
  Shape,
  TextBox,
  TableCell,
  TableRow,
  Table,
  Comment,
  CommentRangeStart,
  CommentRangeEnd,
  TrackedChangeInfo,
  Insertion,
  Deletion,
  SdtType,
  SdtProperties,
  InlineSdt,
  BlockSdt,
  ParagraphContent,
  Paragraph,
  HeaderFooterType,
  HeaderReference,
  FooterReference,
  HeaderFooter,
  FootnotePosition,
  EndnotePosition,
  NoteNumberRestart,
  FootnoteProperties,
  EndnoteProperties,
  Footnote,
  Endnote,
  PageOrientation,
  SectionStart,
  VerticalAlign,
  LineNumberRestart,
  Column,
  SectionProperties,
  BlockContent,
  Section,
  DocumentBody,
} from './content';

// Styles, Theme, Fonts, Relationships & Media
export type {
  StyleType,
  Style,
  DocDefaults,
  StyleDefinitions,
  ThemeColorScheme,
  ThemeFont,
  ThemeFontScheme,
  Theme,
  FontInfo,
  FontTable,
  RelationshipType,
  Relationship,
  RelationshipMap,
  MediaFile,
} from './styles';

// ============================================================================
// DOCX PACKAGE & TOP-LEVEL DOCUMENT
// ============================================================================

import type { DocumentBody } from './content';
import type { StyleDefinitions, Theme, FontTable, RelationshipMap, MediaFile } from './styles';
import type { NumberingDefinitions } from './lists';
import type { Footnote, Endnote, HeaderFooter } from './content';

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
