/**
 * Type exports for @eigenpal/docx-editor
 *
 * Re-exports all public TypeScript types from the split type modules.
 */

export type {
  // Color & Styling Primitives
  ThemeColorSlot,
  ColorValue,
  BorderSpec,
  ShadingProperties,

  // Text Formatting
  UnderlineStyle,
  TextEffect,
  EmphasisMark,
  TextFormatting,

  // Paragraph Formatting
  TabStopAlignment,
  TabLeader,
  TabStop,
  LineSpacingRule,
  ParagraphAlignment,
  ParagraphFormatting,

  // Table Formatting
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

  // Run Content
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

  // Hyperlinks & Bookmarks
  Hyperlink,
  BookmarkStart,
  BookmarkEnd,

  // Fields
  FieldType,
  SimpleField,
  ComplexField,
  Field,

  // Images
  ImageSize,
  ImageWrap,
  ImagePosition,
  ImageTransform,
  ImagePadding,
  Image,

  // Shapes & Text Boxes
  ShapeType,
  ShapeFill,
  ShapeOutline,
  ShapeTextBody,
  Shape,
  TextBox,

  // Tables
  TableCell,
  TableRow,
  Table,

  // Lists & Numbering
  NumberFormat,
  LevelSuffix,
  ListLevel,
  AbstractNumbering,
  NumberingInstance,
  ListRendering,
  NumberingDefinitions,

  // Headers & Footers
  HeaderFooterType,
  HeaderReference,
  FooterReference,
  HeaderFooter,

  // Footnotes & Endnotes
  FootnotePosition,
  EndnotePosition,
  NoteNumberRestart,
  FootnoteProperties,
  EndnoteProperties,
  Footnote,
  Endnote,

  // Paragraph
  ParagraphContent,
  Paragraph,

  // Section Properties
  PageOrientation,
  SectionStart,
  VerticalAlign,
  LineNumberRestart,
  Column,
  SectionProperties,

  // Section & Document Body
  BlockContent,
  Section,
  DocumentBody,

  // Styles
  StyleType,
  Style,
  DocDefaults,
  StyleDefinitions,

  // Theme
  ThemeColorScheme,
  ThemeFont,
  ThemeFontScheme,
  Theme,

  // Font Table
  FontInfo,
  FontTable,

  // Relationships
  RelationshipType,
  Relationship,
  RelationshipMap,

  // Media
  MediaFile,

  // Package & Document
  DocxPackage,
  Document,
} from './document';
