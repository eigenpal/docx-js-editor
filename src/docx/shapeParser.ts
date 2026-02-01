/**
 * Shape Parser - Parse shapes and drawings from wps:wsp elements
 *
 * DOCX shapes are contained in drawings with wps:wsp (Word Processing Shape) elements.
 * Shapes can be standalone or inside groups (wpg:wgp).
 *
 * OOXML Structure:
 * w:drawing
 *   └── wp:inline or wp:anchor
 *       └── a:graphic
 *           └── a:graphicData
 *               └── wps:wsp (shape)
 *                   ├── wps:cNvSpPr (non-visual properties)
 *                   ├── wps:spPr (shape properties)
 *                   │   ├── a:xfrm (transform: position, size, rotation)
 *                   │   ├── a:prstGeom (preset geometry/shape type)
 *                   │   ├── a:solidFill / a:noFill / a:gradFill (fill)
 *                   │   └── a:ln (line/outline properties)
 *                   ├── wps:style (style reference)
 *                   ├── wps:txbx (text box container)
 *                   │   └── w:txbxContent (text content)
 *                   └── wps:bodyPr (body/text properties)
 *
 * EMU (English Metric Units): 914400 EMU = 1 inch
 */

import type {
  Shape,
  ShapeType,
  ShapeFill,
  ShapeOutline,
  ShapeTextBody,
  ImageSize,
  ImagePosition,
  ImageWrap,
  ImageTransform,
  ColorValue,
  Paragraph,
  RelationshipMap,
  MediaFile,
} from '../types/document';
import {
  findChild,
  findChildren,
  getChildElements,
  getAttribute,
  parseNumericAttribute,
  getTextContent,
  type XmlElement,
} from './xmlParser';

// Import paragraph parser for text box content
// Note: This creates a circular dependency that we handle by lazy importing
// or by having textbox parsing as a separate step

// ============================================================================
// CONSTANTS
// ============================================================================

/** EMUs per inch */
const EMU_PER_INCH = 914400;

/** CSS pixels per inch (standard) */
const PIXELS_PER_INCH = 96;

/** Stroke DPI (used for line widths) */
const STROKE_DPI = 72;

/** Default theme colors (fallback if theme not available) */
const DEFAULT_THEME_COLORS: Record<string, string> = {
  accent1: '5B9BD5',
  accent2: 'ED7D31',
  accent3: 'A5A5A5',
  accent4: 'FFC000',
  accent5: '4472C4',
  accent6: '70AD47',
  dk1: '000000',
  lt1: 'FFFFFF',
  dk2: '1F497D',
  lt2: 'EEECE1',
  tx1: '000000',
  tx2: '1F497D',
  bg1: 'FFFFFF',
  bg2: 'EEECE1',
  text1: '000000',
  text2: '1F497D',
  background1: 'FFFFFF',
  background2: 'EEECE1',
  hlink: '0563C1',
  folHlink: '954F72',
};

// ============================================================================
// EMU CONVERSIONS
// ============================================================================

/**
 * Convert EMU to pixels
 */
export function emuToPixels(emu: number | undefined | null): number {
  if (emu == null || isNaN(emu)) return 0;
  return Math.round((emu * PIXELS_PER_INCH) / EMU_PER_INCH);
}

/**
 * Convert EMU to points (for stroke widths)
 */
function emuToPoints(emu: number | undefined | null): number {
  if (emu == null || isNaN(emu)) return 0;
  return (emu * STROKE_DPI) / EMU_PER_INCH;
}

/**
 * Convert rotation value (1/60000 of a degree) to degrees
 */
function rotToDegrees(rot: string | null | undefined): number | undefined {
  if (!rot) return undefined;
  const val = parseInt(rot, 10);
  if (isNaN(val)) return undefined;
  return val / 60000;
}

// ============================================================================
// ELEMENT FINDERS
// ============================================================================

/**
 * Find element by local name (ignoring namespace prefix)
 */
function findByLocalName(parent: XmlElement, localName: string): XmlElement | null {
  const children = getChildElements(parent);
  for (const child of children) {
    const name = child.name || '';
    const colonIdx = name.indexOf(':');
    const childLocalName = colonIdx >= 0 ? name.substring(colonIdx + 1) : name;
    if (childLocalName === localName) {
      return child;
    }
  }
  return null;
}

/**
 * Find element by full name with namespace prefix
 */
function findByFullName(parent: XmlElement, fullName: string): XmlElement | null {
  const children = getChildElements(parent);
  for (const child of children) {
    if (child.name === fullName) {
      return child;
    }
  }
  return null;
}

/**
 * Find all elements by local name
 */
function findAllByLocalName(parent: XmlElement, localName: string): XmlElement[] {
  const children = getChildElements(parent);
  const result: XmlElement[] = [];
  for (const child of children) {
    const name = child.name || '';
    const colonIdx = name.indexOf(':');
    const childLocalName = colonIdx >= 0 ? name.substring(colonIdx + 1) : name;
    if (childLocalName === localName) {
      result.push(child);
    }
  }
  return result;
}

// ============================================================================
// COLOR PARSING
// ============================================================================

/**
 * Parse a color value from a DrawingML element
 * Handles: a:srgbClr, a:schemeClr, a:sysClr, a:prstClr
 */
function parseColorElement(element: XmlElement | null): ColorValue | undefined {
  if (!element) return undefined;

  const children = getChildElements(element);

  // Check for sRGB color: a:srgbClr[@val]
  const srgbClr = children.find((el) => el.name === 'a:srgbClr');
  if (srgbClr) {
    const val = getAttribute(srgbClr, null, 'val');
    if (val) {
      return applyColorModifiers({ rgb: val }, srgbClr);
    }
  }

  // Check for scheme color (theme): a:schemeClr[@val]
  const schemeClr = children.find((el) => el.name === 'a:schemeClr');
  if (schemeClr) {
    const val = getAttribute(schemeClr, null, 'val');
    if (val) {
      // Map scheme name to theme color slot
      const themeColorMap: Record<string, ColorValue['themeColor']> = {
        accent1: 'accent1',
        accent2: 'accent2',
        accent3: 'accent3',
        accent4: 'accent4',
        accent5: 'accent5',
        accent6: 'accent6',
        dk1: 'dk1',
        lt1: 'lt1',
        dk2: 'dk2',
        lt2: 'lt2',
        tx1: 'text1',
        tx2: 'text2',
        bg1: 'background1',
        bg2: 'background2',
        hlink: 'hlink',
        folHlink: 'folHlink',
      };

      const color: ColorValue = {
        themeColor: themeColorMap[val] ?? 'dk1',
      };

      return applyColorModifiers(color, schemeClr);
    }
  }

  // Check for system color: a:sysClr[@val][@lastClr]
  const sysClr = children.find((el) => el.name === 'a:sysClr');
  if (sysClr) {
    const lastClr = getAttribute(sysClr, null, 'lastClr');
    if (lastClr) {
      return { rgb: lastClr };
    }
    // Fall back to windowText = black
    return { rgb: '000000' };
  }

  // Check for preset color: a:prstClr[@val]
  const prstClr = children.find((el) => el.name === 'a:prstClr');
  if (prstClr) {
    const val = getAttribute(prstClr, null, 'val');
    // Map preset colors to RGB (common ones)
    const presetColors: Record<string, string> = {
      black: '000000',
      white: 'FFFFFF',
      red: 'FF0000',
      green: '00FF00',
      blue: '0000FF',
      yellow: 'FFFF00',
      cyan: '00FFFF',
      magenta: 'FF00FF',
    };
    if (val && presetColors[val]) {
      return { rgb: presetColors[val] };
    }
  }

  return undefined;
}

/**
 * Apply color modifiers (shade, tint, alpha, lumMod, lumOff)
 */
function applyColorModifiers(color: ColorValue, element: XmlElement): ColorValue {
  const children = getChildElements(element);

  // Check for shade modifier
  const shade = children.find((el) => el.name === 'a:shade');
  if (shade) {
    const val = getAttribute(shade, null, 'val');
    if (val) {
      // val is in 100000ths, convert to 255 scale hex
      const shadeVal = Math.round((parseInt(val, 10) / 100000) * 255)
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();
      color.themeShade = shadeVal;
    }
  }

  // Check for tint modifier
  const tint = children.find((el) => el.name === 'a:tint');
  if (tint) {
    const val = getAttribute(tint, null, 'val');
    if (val) {
      const tintVal = Math.round((parseInt(val, 10) / 100000) * 255)
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();
      color.themeTint = tintVal;
    }
  }

  return color;
}

/**
 * Get theme color hex value
 */
function getThemeColorHex(name: string): string {
  return DEFAULT_THEME_COLORS[name] ?? '000000';
}

// ============================================================================
// FILL PARSING
// ============================================================================

/**
 * Parse shape fill from spPr element
 */
function parseFill(spPr: XmlElement | null, style: XmlElement | null): ShapeFill | undefined {
  if (!spPr) {
    return undefined;
  }

  const children = getChildElements(spPr);

  // Check for no fill
  const noFill = children.find((el) => el.name === 'a:noFill');
  if (noFill) {
    return { type: 'none' };
  }

  // Check for solid fill
  const solidFill = children.find((el) => el.name === 'a:solidFill');
  if (solidFill) {
    const color = parseColorElement(solidFill);
    return {
      type: 'solid',
      color,
    };
  }

  // Check for gradient fill
  const gradFill = children.find((el) => el.name === 'a:gradFill');
  if (gradFill) {
    return parseGradientFill(gradFill);
  }

  // Check for pattern fill
  const pattFill = children.find((el) => el.name === 'a:pattFill');
  if (pattFill) {
    return { type: 'pattern' };
  }

  // Check for blip fill (picture)
  const blipFill = children.find((el) => el.name === 'a:blipFill');
  if (blipFill) {
    return { type: 'picture' };
  }

  // Check style reference for fill
  if (style) {
    const fillRef = findByFullName(style, 'a:fillRef');
    if (fillRef) {
      const idx = getAttribute(fillRef, null, 'idx');
      if (idx === '0') {
        // idx=0 means no fill
        return { type: 'none' };
      }
      // Check for color in the fillRef
      const color = parseColorElement(fillRef);
      if (color) {
        return { type: 'solid', color };
      }
    }
  }

  return undefined;
}

/**
 * Parse gradient fill
 */
function parseGradientFill(gradFill: XmlElement): ShapeFill {
  const children = getChildElements(gradFill);

  // Determine gradient type
  let gradientType: 'linear' | 'radial' | 'rectangular' | 'path' = 'linear';
  let angle: number | undefined;

  // Check for linear gradient
  const lin = children.find((el) => el.name === 'a:lin');
  if (lin) {
    gradientType = 'linear';
    const ang = getAttribute(lin, null, 'ang');
    if (ang) {
      // Angle is in 60000ths of a degree
      angle = parseInt(ang, 10) / 60000;
    }
  }

  // Check for path gradient (radial)
  const path = children.find((el) => el.name === 'a:path');
  if (path) {
    const pathType = getAttribute(path, null, 'path');
    if (pathType === 'circle') {
      gradientType = 'radial';
    } else if (pathType === 'rect') {
      gradientType = 'rectangular';
    } else {
      gradientType = 'path';
    }
  }

  // Parse gradient stops
  const gsLst = children.find((el) => el.name === 'a:gsLst');
  const stops: Array<{ position: number; color: ColorValue }> = [];

  if (gsLst) {
    const gsElements = findAllByLocalName(gsLst, 'gs');
    for (const gs of gsElements) {
      const pos = getAttribute(gs, null, 'pos');
      const position = pos ? parseInt(pos, 10) : 0;
      const color = parseColorElement(gs);
      if (color) {
        stops.push({ position, color });
      }
    }
  }

  return {
    type: 'gradient',
    gradient: {
      type: gradientType,
      angle,
      stops,
    },
  };
}

// ============================================================================
// OUTLINE PARSING
// ============================================================================

/**
 * Parse shape outline/stroke from a:ln element
 */
function parseOutline(spPr: XmlElement | null, style: XmlElement | null): ShapeOutline | undefined {
  const ln = spPr ? findByFullName(spPr, 'a:ln') : null;

  if (!ln) {
    // Check style reference for outline
    if (style) {
      const lnRef = findByFullName(style, 'a:lnRef');
      if (lnRef) {
        const idx = getAttribute(lnRef, null, 'idx');
        if (idx === '0') {
          // idx=0 means no line
          return undefined;
        }
        const color = parseColorElement(lnRef);
        if (color) {
          return { color, width: 9525 }; // Default 0.75pt = 9525 EMU
        }
      }
    }
    return undefined;
  }

  const children = getChildElements(ln);

  // Check for no line
  const noFill = children.find((el) => el.name === 'a:noFill');
  if (noFill) {
    return undefined;
  }

  const outline: ShapeOutline = {};

  // Width in EMUs
  const w = getAttribute(ln, null, 'w');
  if (w) {
    outline.width = parseInt(w, 10);
  }

  // Cap style
  const cap = getAttribute(ln, null, 'cap');
  if (cap === 'flat' || cap === 'rnd' || cap === 'sq') {
    outline.cap = cap === 'rnd' ? 'round' : cap === 'sq' ? 'square' : 'flat';
  }

  // Join style
  const bevel = children.find((el) => el.name === 'a:bevel');
  const miter = children.find((el) => el.name === 'a:miter');
  const round = children.find((el) => el.name === 'a:round');
  if (bevel) {
    outline.join = 'bevel';
  } else if (round) {
    outline.join = 'round';
  } else if (miter) {
    outline.join = 'miter';
  }

  // Line color
  const solidFill = children.find((el) => el.name === 'a:solidFill');
  if (solidFill) {
    outline.color = parseColorElement(solidFill);
  }

  // Line dash style
  const prstDash = children.find((el) => el.name === 'a:prstDash');
  if (prstDash) {
    const val = getAttribute(prstDash, null, 'val');
    if (val) {
      outline.style = val as ShapeOutline['style'];
    }
  }

  // Head end (arrow)
  const headEnd = children.find((el) => el.name === 'a:headEnd');
  if (headEnd) {
    outline.headEnd = parseLineEnd(headEnd);
  }

  // Tail end (arrow)
  const tailEnd = children.find((el) => el.name === 'a:tailEnd');
  if (tailEnd) {
    outline.tailEnd = parseLineEnd(tailEnd);
  }

  return outline;
}

/**
 * Parse line end (arrow head/tail)
 */
function parseLineEnd(element: XmlElement): ShapeOutline['headEnd'] {
  const type = getAttribute(element, null, 'type') ?? 'none';
  const w = getAttribute(element, null, 'w') as 'sm' | 'med' | 'lg' | undefined;
  const len = getAttribute(element, null, 'len') as 'sm' | 'med' | 'lg' | undefined;

  const typeMap: Record<string, ShapeOutline['headEnd']['type']> = {
    none: 'none',
    triangle: 'triangle',
    stealth: 'stealth',
    diamond: 'diamond',
    oval: 'oval',
    arrow: 'arrow',
  };

  return {
    type: typeMap[type] ?? 'none',
    width: w,
    length: len,
  };
}

// ============================================================================
// TRANSFORM PARSING
// ============================================================================

/**
 * Parse transform from a:xfrm element
 */
function parseTransform(xfrm: XmlElement | null): {
  size: ImageSize;
  transform?: ImageTransform;
  offset?: { x: number; y: number };
} {
  if (!xfrm) {
    return { size: { width: 0, height: 0 } };
  }

  // Get extent (size)
  const ext = findByFullName(xfrm, 'a:ext');
  const cx = parseNumericAttribute(ext, null, 'cx') ?? 0;
  const cy = parseNumericAttribute(ext, null, 'cy') ?? 0;

  const size: ImageSize = { width: cx, height: cy };

  // Get offset
  const off = findByFullName(xfrm, 'a:off');
  let offset: { x: number; y: number } | undefined;
  if (off) {
    const x = parseNumericAttribute(off, null, 'x') ?? 0;
    const y = parseNumericAttribute(off, null, 'y') ?? 0;
    offset = { x, y };
  }

  // Get transform properties
  const rot = getAttribute(xfrm, null, 'rot');
  const flipH = getAttribute(xfrm, null, 'flipH') === '1';
  const flipV = getAttribute(xfrm, null, 'flipV') === '1';

  const rotation = rotToDegrees(rot);

  let transform: ImageTransform | undefined;
  if (rotation !== undefined || flipH || flipV) {
    transform = {};
    if (rotation !== undefined) transform.rotation = rotation;
    if (flipH) transform.flipH = true;
    if (flipV) transform.flipV = true;
  }

  return { size, transform, offset };
}

// ============================================================================
// SHAPE TYPE PARSING
// ============================================================================

/**
 * Parse preset geometry to get shape type
 */
function parseShapeType(spPr: XmlElement | null): ShapeType {
  if (!spPr) {
    return 'rect';
  }

  // Check for preset geometry
  const prstGeom = findByFullName(spPr, 'a:prstGeom');
  if (prstGeom) {
    const prst = getAttribute(prstGeom, null, 'prst');
    if (prst) {
      return prst as ShapeType;
    }
  }

  // Check for custom geometry (return 'rect' as fallback for custom shapes)
  const custGeom = findByFullName(spPr, 'a:custGeom');
  if (custGeom) {
    return 'rect'; // Custom geometry gets rendered differently
  }

  return 'rect';
}

// ============================================================================
// TEXT BOX PARSING
// ============================================================================

/**
 * Parse text body properties from wps:bodyPr
 */
function parseBodyProperties(bodyPr: XmlElement | null): {
  vertical?: boolean;
  rotation?: number;
  anchor?: ShapeTextBody['anchor'];
  anchorCenter?: boolean;
  autoFit?: ShapeTextBody['autoFit'];
  margins?: ShapeTextBody['margins'];
} {
  if (!bodyPr) {
    return {};
  }

  const result: ReturnType<typeof parseBodyProperties> = {};

  // Vertical text
  const vert = getAttribute(bodyPr, null, 'vert');
  if (vert === 'vert' || vert === 'vert270' || vert === 'wordArtVert') {
    result.vertical = true;
  }

  // Rotation
  const rot = getAttribute(bodyPr, null, 'rot');
  if (rot) {
    result.rotation = rotToDegrees(rot);
  }

  // Anchor (vertical alignment)
  const anchor = getAttribute(bodyPr, null, 'anchor');
  if (anchor) {
    const anchorMap: Record<string, ShapeTextBody['anchor']> = {
      t: 'top',
      ctr: 'middle',
      b: 'bottom',
      dist: 'distributed',
      just: 'justified',
    };
    result.anchor = anchorMap[anchor];
  }

  // Anchor center
  if (getAttribute(bodyPr, null, 'anchorCtr') === '1') {
    result.anchorCenter = true;
  }

  // Auto fit
  const noAutofit = findByFullName(bodyPr, 'a:noAutofit');
  const normAutofit = findByFullName(bodyPr, 'a:normAutofit');
  const spAutofit = findByFullName(bodyPr, 'a:spAutoFit');

  if (noAutofit) {
    result.autoFit = 'none';
  } else if (normAutofit) {
    result.autoFit = 'normal';
  } else if (spAutofit) {
    result.autoFit = 'shape';
  }

  // Margins (insets) in EMUs
  const lIns = parseNumericAttribute(bodyPr, null, 'lIns');
  const rIns = parseNumericAttribute(bodyPr, null, 'rIns');
  const tIns = parseNumericAttribute(bodyPr, null, 'tIns');
  const bIns = parseNumericAttribute(bodyPr, null, 'bIns');

  if (lIns !== undefined || rIns !== undefined || tIns !== undefined || bIns !== undefined) {
    result.margins = {
      left: lIns,
      right: rIns,
      top: tIns,
      bottom: bIns,
    };
  }

  return result;
}

/**
 * Parse text box content (w:txbxContent)
 * This returns placeholder paragraphs - actual parsing happens in paragraphParser
 * to avoid circular dependencies
 */
function parseTextBoxContent(txbxContent: XmlElement | null): Paragraph[] {
  if (!txbxContent) {
    return [];
  }

  // Return placeholder - actual parsing requires paragraph parser
  // which creates a circular dependency. The document parser should
  // handle this by parsing text box content separately.
  const paragraphs: Paragraph[] = [];

  const pElements = findAllByLocalName(txbxContent, 'p');
  for (const _p of pElements) {
    // Create placeholder paragraph - will be filled by document parser
    paragraphs.push({
      type: 'paragraph',
      formatting: {},
      content: [],
    });
  }

  return paragraphs;
}

// ============================================================================
// MAIN SHAPE PARSING
// ============================================================================

/**
 * Parse a wps:wsp (Word Processing Shape) element
 *
 * @param node - The wps:wsp XML element
 * @returns Parsed Shape object
 */
export function parseShape(node: XmlElement): Shape {
  const children = getChildElements(node);

  // Get non-visual properties
  const cNvSpPr = children.find((el) => el.name === 'wps:cNvSpPr');
  const cNvPr = children.find((el) => el.name === 'wps:cNvPr');

  // Get shape properties
  const spPr = children.find((el) => el.name === 'wps:spPr');

  // Get style reference
  const style = children.find((el) => el.name === 'wps:style');

  // Get text box
  const txbx = children.find((el) => el.name === 'wps:txbx');
  const txbxContent = txbx ? findByFullName(txbx, 'w:txbxContent') : null;

  // Get body properties
  const bodyPr = children.find((el) => el.name === 'wps:bodyPr');

  // Parse shape type
  const shapeType = parseShapeType(spPr ?? null);

  // Parse transform (includes size)
  const xfrm = spPr ? findByFullName(spPr, 'a:xfrm') : null;
  const { size, transform } = parseTransform(xfrm);

  // Parse fill
  const fill = parseFill(spPr ?? null, style ?? null);

  // Parse outline
  const outline = parseOutline(spPr ?? null, style ?? null);

  // Parse document properties for ID and name
  let id: string | undefined;
  let name: string | undefined;

  if (cNvPr) {
    id = getAttribute(cNvPr, null, 'id') ?? undefined;
    name = getAttribute(cNvPr, null, 'name') ?? undefined;
  }

  // Build shape object
  const shape: Shape = {
    type: 'shape',
    shapeType,
    size,
  };

  // Add optional properties
  if (id) shape.id = id;
  if (name) shape.name = name;
  if (fill) shape.fill = fill;
  if (outline) shape.outline = outline;
  if (transform) shape.transform = transform;

  // Parse text body if present
  if (txbxContent || bodyPr) {
    const bodyProps = parseBodyProperties(bodyPr ?? null);
    const content = parseTextBoxContent(txbxContent);

    if (content.length > 0 || Object.keys(bodyProps).length > 0) {
      shape.textBody = {
        ...bodyProps,
        content,
      };
    }
  }

  return shape;
}

/**
 * Parse shape from a w:drawing element that contains a shape (not an image)
 *
 * @param drawingEl - The w:drawing element
 * @returns Parsed Shape object or null if not a shape
 */
export function parseShapeFromDrawing(drawingEl: XmlElement): Shape | null {
  const children = getChildElements(drawingEl);

  // Find wp:inline or wp:anchor
  const container = children.find(
    (el) => el.name === 'wp:inline' || el.name === 'wp:anchor'
  );

  if (!container) {
    return null;
  }

  const isAnchor = container.name === 'wp:anchor';

  // Navigate to graphic data
  const graphic = findByFullName(container, 'a:graphic');
  if (!graphic) return null;

  const graphicData = findByFullName(graphic, 'a:graphicData');
  if (!graphicData) return null;

  // Check for wps:wsp (shape)
  const wsp = findByFullName(graphicData, 'wps:wsp');
  if (!wsp) return null;

  // Parse the shape
  const shape = parseShape(wsp);

  // Get extent from container (overrides spPr size)
  const extent = findByFullName(container, 'wp:extent');
  if (extent) {
    const cx = parseNumericAttribute(extent, null, 'cx') ?? 0;
    const cy = parseNumericAttribute(extent, null, 'cy') ?? 0;
    shape.size = { width: cx, height: cy };
  }

  // Parse position for anchored shapes
  if (isAnchor) {
    const position = parseAnchorPosition(container);
    if (position) {
      shape.position = position;
    }

    const wrap = parseWrap(container);
    if (wrap) {
      shape.wrap = wrap;
    }
  }

  // Get document properties from container
  const docPr = findByFullName(container, 'wp:docPr');
  if (docPr) {
    const id = getAttribute(docPr, null, 'id');
    const name = getAttribute(docPr, null, 'name');
    if (id) shape.id = id;
    if (name) shape.name = name;
  }

  return shape;
}

/**
 * Parse anchor position
 */
function parseAnchorPosition(anchor: XmlElement): ImagePosition | undefined {
  const positionH = findByFullName(anchor, 'wp:positionH');
  const positionV = findByFullName(anchor, 'wp:positionV');

  if (!positionH && !positionV) {
    return undefined;
  }

  const horizontal = parsePositionH(positionH);
  const vertical = parsePositionV(positionV);

  return {
    horizontal: horizontal ?? { relativeTo: 'column' },
    vertical: vertical ?? { relativeTo: 'paragraph' },
  };
}

/**
 * Parse horizontal position
 */
function parsePositionH(posH: XmlElement | null): ImagePosition['horizontal'] | undefined {
  if (!posH) return undefined;

  const relativeTo = getAttribute(posH, null, 'relativeFrom') ?? 'column';

  // Check for alignment
  const alignEl = findByFullName(posH, 'wp:align');
  if (alignEl) {
    const text = getTextContent(alignEl);
    return {
      relativeTo: relativeTo as ImagePosition['horizontal']['relativeTo'],
      alignment: text as ImagePosition['horizontal']['alignment'],
    };
  }

  // Check for posOffset
  const posOffsetEl = findByFullName(posH, 'wp:posOffset');
  if (posOffsetEl) {
    const text = getTextContent(posOffsetEl);
    const posOffset = parseInt(text, 10);
    return {
      relativeTo: relativeTo as ImagePosition['horizontal']['relativeTo'],
      posOffset: isNaN(posOffset) ? 0 : posOffset,
    };
  }

  return {
    relativeTo: relativeTo as ImagePosition['horizontal']['relativeTo'],
  };
}

/**
 * Parse vertical position
 */
function parsePositionV(posV: XmlElement | null): ImagePosition['vertical'] | undefined {
  if (!posV) return undefined;

  const relativeTo = getAttribute(posV, null, 'relativeFrom') ?? 'paragraph';

  // Check for alignment
  const alignEl = findByFullName(posV, 'wp:align');
  if (alignEl) {
    const text = getTextContent(alignEl);
    return {
      relativeTo: relativeTo as ImagePosition['vertical']['relativeTo'],
      alignment: text as ImagePosition['vertical']['alignment'],
    };
  }

  // Check for posOffset
  const posOffsetEl = findByFullName(posV, 'wp:posOffset');
  if (posOffsetEl) {
    const text = getTextContent(posOffsetEl);
    const posOffset = parseInt(text, 10);
    return {
      relativeTo: relativeTo as ImagePosition['vertical']['relativeTo'],
      posOffset: isNaN(posOffset) ? 0 : posOffset,
    };
  }

  return {
    relativeTo: relativeTo as ImagePosition['vertical']['relativeTo'],
  };
}

/**
 * Parse wrap settings
 */
function parseWrap(anchor: XmlElement): ImageWrap | undefined {
  const children = getChildElements(anchor);

  const behindDoc = getAttribute(anchor, null, 'behindDoc') === '1';

  // Check for wrap elements
  const wrapElements = [
    'wp:wrapNone',
    'wp:wrapSquare',
    'wp:wrapTight',
    'wp:wrapThrough',
    'wp:wrapTopAndBottom',
  ];

  const wrapEl = children.find((el) => wrapElements.includes(el.name ?? ''));

  if (!wrapEl) {
    return {
      type: behindDoc ? 'behind' : 'inFront',
    };
  }

  const wrapName = wrapEl.name || '';
  const wrapType = wrapName.replace('wp:', '');

  let type: ImageWrap['type'];
  switch (wrapType) {
    case 'wrapNone':
      type = behindDoc ? 'behind' : 'inFront';
      break;
    case 'wrapSquare':
      type = 'square';
      break;
    case 'wrapTight':
      type = 'tight';
      break;
    case 'wrapThrough':
      type = 'through';
      break;
    case 'wrapTopAndBottom':
      type = 'topAndBottom';
      break;
    default:
      type = 'square';
  }

  const wrap: ImageWrap = { type };

  // Parse wrap text attribute
  const wrapText = getAttribute(wrapEl, null, 'wrapText');
  if (wrapText) {
    wrap.wrapText = wrapText as ImageWrap['wrapText'];
  }

  // Parse distances
  const distT = parseNumericAttribute(wrapEl, null, 'distT');
  const distB = parseNumericAttribute(wrapEl, null, 'distB');
  const distL = parseNumericAttribute(wrapEl, null, 'distL');
  const distR = parseNumericAttribute(wrapEl, null, 'distR');

  if (distT !== undefined) wrap.distT = distT;
  if (distB !== undefined) wrap.distB = distB;
  if (distL !== undefined) wrap.distL = distL;
  if (distR !== undefined) wrap.distR = distR;

  return wrap;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a drawing element contains a shape (not an image)
 */
export function isShapeDrawing(drawingEl: XmlElement): boolean {
  const children = getChildElements(drawingEl);
  const container = children.find(
    (el) => el.name === 'wp:inline' || el.name === 'wp:anchor'
  );

  if (!container) return false;

  const graphic = findByFullName(container, 'a:graphic');
  if (!graphic) return false;

  const graphicData = findByFullName(graphic, 'a:graphicData');
  if (!graphicData) return false;

  // Check for wps:wsp (shape)
  const wsp = findByFullName(graphicData, 'wps:wsp');
  return wsp !== null;
}

/**
 * Check if a shape is a line (connector)
 */
export function isLineShape(shape: Shape): boolean {
  const lineTypes: ShapeType[] = [
    'line',
    'straightConnector1',
    'bentConnector2',
    'bentConnector3',
    'bentConnector4',
    'bentConnector5',
    'curvedConnector2',
    'curvedConnector3',
    'curvedConnector4',
    'curvedConnector5',
  ];
  return lineTypes.includes(shape.shapeType);
}

/**
 * Check if a shape is a text box
 */
export function isTextBoxShape(shape: Shape): boolean {
  return shape.shapeType === 'textBox' || (shape.textBody !== undefined && shape.textBody.content.length > 0);
}

/**
 * Check if a shape has text content
 */
export function hasTextContent(shape: Shape): boolean {
  return shape.textBody !== undefined && shape.textBody.content.length > 0;
}

/**
 * Get shape width in pixels
 */
export function getShapeWidthPx(shape: Shape): number {
  return emuToPixels(shape.size.width);
}

/**
 * Get shape height in pixels
 */
export function getShapeHeightPx(shape: Shape): number {
  return emuToPixels(shape.size.height);
}

/**
 * Get shape dimensions in pixels
 */
export function getShapeDimensionsPx(shape: Shape): { width: number; height: number } {
  return {
    width: emuToPixels(shape.size.width),
    height: emuToPixels(shape.size.height),
  };
}

/**
 * Check if shape is floating (anchored)
 */
export function isFloatingShape(shape: Shape): boolean {
  return shape.position !== undefined || shape.wrap !== undefined;
}

/**
 * Check if shape has fill
 */
export function hasFill(shape: Shape): boolean {
  return shape.fill !== undefined && shape.fill.type !== 'none';
}

/**
 * Check if shape has outline
 */
export function hasOutline(shape: Shape): boolean {
  return shape.outline !== undefined;
}

/**
 * Get outline width in pixels
 */
export function getOutlineWidthPx(shape: Shape): number {
  if (!shape.outline?.width) return 0;
  return emuToPixels(shape.outline.width);
}

/**
 * Resolve fill color to CSS color string
 */
export function resolveFillColor(shape: Shape): string | undefined {
  if (!shape.fill || shape.fill.type !== 'solid') {
    return undefined;
  }

  const color = shape.fill.color;
  if (!color) return undefined;

  if (color.rgb) {
    return `#${color.rgb}`;
  }

  if (color.themeColor) {
    // Map theme color slot to default color
    const themeColorMap: Record<string, string> = {
      accent1: '5B9BD5',
      accent2: 'ED7D31',
      accent3: 'A5A5A5',
      accent4: 'FFC000',
      accent5: '4472C4',
      accent6: '70AD47',
      dk1: '000000',
      lt1: 'FFFFFF',
      dk2: '1F497D',
      lt2: 'EEECE1',
      text1: '000000',
      text2: '1F497D',
      background1: 'FFFFFF',
      background2: 'EEECE1',
      hlink: '0563C1',
      folHlink: '954F72',
    };
    return `#${themeColorMap[color.themeColor] ?? '000000'}`;
  }

  return undefined;
}

/**
 * Resolve outline color to CSS color string
 */
export function resolveOutlineColor(shape: Shape): string | undefined {
  if (!shape.outline?.color) {
    return undefined;
  }

  const color = shape.outline.color;

  if (color.rgb) {
    return `#${color.rgb}`;
  }

  if (color.themeColor) {
    const themeColorMap: Record<string, string> = {
      accent1: '5B9BD5',
      accent2: 'ED7D31',
      accent3: 'A5A5A5',
      accent4: 'FFC000',
      accent5: '4472C4',
      accent6: '70AD47',
      dk1: '000000',
      lt1: 'FFFFFF',
      dk2: '1F497D',
      lt2: 'EEECE1',
      text1: '000000',
      text2: '1F497D',
      background1: 'FFFFFF',
      background2: 'EEECE1',
      hlink: '0563C1',
      folHlink: '954F72',
    };
    return `#${themeColorMap[color.themeColor] ?? '000000'}`;
  }

  return undefined;
}
