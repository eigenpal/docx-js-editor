/**
 * ProseMirror Node Type Interfaces
 *
 * Type definitions for node attributes used by conversion modules,
 * extensions, and other consumers. NodeSpec definitions have moved
 * to the extension system (extensions/core/ and extensions/nodes/).
 */

import type {
  ParagraphAlignment,
  LineSpacingRule,
  BorderSpec,
  ShadingProperties,
  TabStop,
  TextFormatting,
  NumberFormat,
} from '../../types/document';

/**
 * Paragraph node attributes - maps to ParagraphFormatting
 */
export interface ParagraphAttrs {
  // Identity
  paraId?: string;
  textId?: string;

  // Alignment
  alignment?: ParagraphAlignment;

  // Spacing (in twips)
  spaceBefore?: number;
  spaceAfter?: number;
  lineSpacing?: number;
  lineSpacingRule?: LineSpacingRule;

  // Indentation (in twips)
  indentLeft?: number;
  indentRight?: number;
  indentFirstLine?: number;
  hangingIndent?: boolean;

  // List properties
  numPr?: {
    numId?: number;
    ilvl?: number;
  };
  /** List number format (decimal, lowerRoman, upperRoman, etc.) for CSS counter styling */
  listNumFmt?: NumberFormat;
  /** Whether this is a bullet list */
  listIsBullet?: boolean;
  /** Computed list marker text (e.g., "1.", "1.1.", "•") */
  listMarker?: string;

  // Style reference
  styleId?: string;

  // Borders
  borders?: {
    top?: BorderSpec;
    bottom?: BorderSpec;
    left?: BorderSpec;
    right?: BorderSpec;
    between?: BorderSpec;
    bar?: BorderSpec;
  };

  // Background/Shading
  shading?: ShadingProperties;

  // Tab stops
  tabs?: TabStop[];

  // Page break control
  pageBreakBefore?: boolean;
  keepNext?: boolean;
  keepLines?: boolean;

  // Default text formatting for empty paragraphs (persists when navigating away)
  // Maps to OOXML pPr/rPr (paragraph's default run properties)
  defaultTextFormatting?: TextFormatting;

  // Section break type — marks end of a section
  sectionBreakType?: 'nextPage' | 'continuous' | 'oddPage' | 'evenPage';

  // Outline level for TOC (0-9)
  outlineLevel?: number;
}

/**
 * Image position for floating images (horizontal and vertical positioning)
 */
export interface ImagePositionAttrs {
  horizontal?: {
    relativeTo?: string;
    posOffset?: number; // In EMU
    align?: string;
  };
  vertical?: {
    relativeTo?: string;
    posOffset?: number; // In EMU
    align?: string;
  };
}

/**
 * Image node attributes
 */
export interface ImageAttrs {
  src: string;
  alt?: string;
  title?: string;
  /** Width in pixels (already converted from EMU) */
  width?: number;
  /** Height in pixels (already converted from EMU) */
  height?: number;
  rId?: string;
  /** Wrap type from DOCX: inline, square, tight, through, topAndBottom, behind, inFront */
  wrapType?: 'inline' | 'square' | 'tight' | 'through' | 'topAndBottom' | 'behind' | 'inFront';
  /** Display mode for CSS: inline (flows with text), float (left/right float), block (centered) */
  displayMode?: 'inline' | 'float' | 'block';
  /** CSS float direction for floating images */
  cssFloat?: 'left' | 'right' | 'none';
  /** CSS transform string (rotation, flip) */
  transform?: string;
  /** Distance from text above (pixels) */
  distTop?: number;
  /** Distance from text below (pixels) */
  distBottom?: number;
  /** Distance from text left (pixels) */
  distLeft?: number;
  /** Distance from text right (pixels) */
  distRight?: number;
  /** Position for floating images (horizontal and vertical alignment) */
  position?: ImagePositionAttrs;
  /** Border width in pixels */
  borderWidth?: number;
  /** Border color as CSS color string */
  borderColor?: string;
  /** Border style (CSS border-style value) */
  borderStyle?: string;
}

/**
 * Table node attributes
 */
export interface TableAttrs {
  /** Table style ID */
  styleId?: string;
  /** Table width (in twips) */
  width?: number;
  /** Table width type ('auto', 'pct', 'dxa') */
  widthType?: string;
  /** Table justification/alignment */
  justification?: 'left' | 'center' | 'right';
  /** Column widths (in twips) from w:tblGrid */
  columnWidths?: number[];
}

/**
 * Table row attributes
 */
export interface TableRowAttrs {
  /** Row height (in twips) */
  height?: number;
  /** Height rule ('auto', 'exact', 'atLeast') */
  heightRule?: string;
  /** Is header row */
  isHeader?: boolean;
}

/**
 * Table cell attributes
 */
export interface TableCellAttrs {
  /** Column span */
  colspan: number;
  /** Row span */
  rowspan: number;
  /** Column widths for prosemirror-tables resizing (array of pixel widths) */
  colwidth?: number[] | null;
  /** Cell width (in twips) */
  width?: number;
  /** Cell width type */
  widthType?: string;
  /** Vertical alignment */
  verticalAlign?: 'top' | 'center' | 'bottom';
  /** Background color (RGB hex) */
  backgroundColor?: string;
  /** OOXML text direction (e.g. 'tbRl', 'btLr') */
  textDirection?: string;
  /** No text wrapping in cell */
  noWrap?: boolean;
  /** Cell borders — full BorderSpec per side (style, color, size) */
  borders?: { top?: BorderSpec; bottom?: BorderSpec; left?: BorderSpec; right?: BorderSpec };
  /** Cell margins/padding in twips per side */
  margins?: { top?: number; bottom?: number; left?: number; right?: number };
}
