/**
 * Image Parser - Parse embedded images from w:drawing elements
 *
 * DOCX images are contained in <w:drawing> elements with either:
 * - wp:inline - Inline images that flow with text
 * - wp:anchor - Floating/anchored images with text wrapping
 *
 * OOXML Structure:
 * w:drawing
 *   ├── wp:inline or wp:anchor
 *   │   ├── wp:extent (size: cx, cy in EMUs)
 *   │   ├── wp:effectExtent (effect margins)
 *   │   ├── wp:docPr (document properties: id, name, descr, title)
 *   │   ├── wp:positionH / wp:positionV (for anchor only)
 *   │   ├── wp:wrap* (wrapping mode for anchor: wrapNone, wrapSquare, etc.)
 *   │   └── a:graphic
 *   │       └── a:graphicData
 *   │           └── pic:pic
 *   │               ├── pic:nvPicPr (non-visual properties)
 *   │               ├── pic:blipFill
 *   │               │   └── a:blip (r:embed = rId)
 *   │               └── pic:spPr
 *   │                   └── a:xfrm (transform: rotation, flip)
 *
 * EMU (English Metric Units): 914400 EMU = 1 inch
 * Conversion: pixels = (emu * 96) / 914400
 */

import type {
  Image,
  ImageSize,
  ImageWrap,
  ImagePosition,
  ImageTransform,
  ImagePadding,
  RelationshipMap,
  MediaFile,
} from '../types/document';
import {
  getChildElements,
  getAttribute,
  parseNumericAttribute,
  type XmlElement,
} from './xmlParser';

// ============================================================================
// EMU CONVERSIONS
// ============================================================================

/** EMUs per inch */
const EMU_PER_INCH = 914400;

/** CSS pixels per inch (standard) */
const PIXELS_PER_INCH = 96;

/**
 * Convert EMU to pixels
 *
 * @param emu - Value in EMUs
 * @returns Value in CSS pixels
 */
export function emuToPixels(emu: number | undefined | null): number {
  if (emu == null || isNaN(emu)) return 0;
  return Math.round((emu * PIXELS_PER_INCH) / EMU_PER_INCH);
}

/**
 * Convert pixels to EMU
 *
 * @param px - Value in pixels
 * @returns Value in EMUs
 */
export function pixelsToEmu(px: number): number {
  return Math.round((px * EMU_PER_INCH) / PIXELS_PER_INCH);
}

/**
 * Convert rotation value (1/60000 of a degree) to degrees
 *
 * @param rot - Rotation in 60000ths of a degree
 * @returns Rotation in degrees
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
 * Find any of the specified elements
 */
function findAnyOf(parent: XmlElement, names: string[]): XmlElement | null {
  const children = getChildElements(parent);
  for (const child of children) {
    if (names.includes(child.name || '')) {
      return child;
    }
  }
  return null;
}

// ============================================================================
// SIZE PARSING
// ============================================================================

/**
 * Parse extent element for image size
 *
 * @param extent - wp:extent element
 * @returns ImageSize in EMUs
 */
function parseExtent(extent: XmlElement | null): ImageSize {
  if (!extent) {
    return { width: 0, height: 0 };
  }

  const cx = parseNumericAttribute(extent, null, 'cx') ?? 0;
  const cy = parseNumericAttribute(extent, null, 'cy') ?? 0;

  return { width: cx, height: cy };
}

/**
 * Parse effect extent for shadow/effect margins
 *
 * @param effectExtent - wp:effectExtent element
 * @returns Padding for effects
 */
function parseEffectExtent(effectExtent: XmlElement | null): ImagePadding | undefined {
  if (!effectExtent) return undefined;

  const l = parseNumericAttribute(effectExtent, null, 'l') ?? 0;
  const t = parseNumericAttribute(effectExtent, null, 't') ?? 0;
  const r = parseNumericAttribute(effectExtent, null, 'r') ?? 0;
  const b = parseNumericAttribute(effectExtent, null, 'b') ?? 0;

  if (l === 0 && t === 0 && r === 0 && b === 0) {
    return undefined;
  }

  return {
    left: l,
    top: t,
    right: r,
    bottom: b,
  };
}

// ============================================================================
// DOCUMENT PROPERTIES PARSING
// ============================================================================

/**
 * Parse document properties (wp:docPr)
 *
 * @param docPr - wp:docPr element
 * @returns Object with id, name, description, title
 */
function parseDocProps(docPr: XmlElement | null): {
  id?: string;
  name?: string;
  alt?: string;
  title?: string;
  decorative?: boolean;
} {
  if (!docPr) return {};

  const id = getAttribute(docPr, null, 'id') ?? undefined;
  const name = getAttribute(docPr, null, 'name') ?? undefined;
  const descr = getAttribute(docPr, null, 'descr') ?? undefined;
  const title = getAttribute(docPr, null, 'title') ?? undefined;

  // Check for decorative flag (accessibility)
  // In newer OOXML, this is indicated by a:decorative element or attribute
  const decorative = getAttribute(docPr, null, 'decorative') === '1';

  return {
    id,
    name,
    alt: descr,
    title,
    decorative: decorative || undefined,
  };
}

// ============================================================================
// POSITION PARSING (for anchored images)
// ============================================================================

/**
 * Parse horizontal position (wp:positionH)
 */
function parsePositionH(posH: XmlElement | null): ImagePosition['horizontal'] | undefined {
  if (!posH) return undefined;

  const relativeTo = getAttribute(posH, null, 'relativeFrom') ?? 'column';

  // Check for alignment child
  const alignEl = findByFullName(posH, 'wp:align');
  if (alignEl) {
    const alignment = alignEl.elements?.[0]?.text ?? null;
    return {
      relativeTo: relativeTo as ImagePosition['horizontal']['relativeTo'],
      alignment: alignment as ImagePosition['horizontal']['alignment'],
    };
  }

  // Check for posOffset child
  const posOffsetEl = findByFullName(posH, 'wp:posOffset');
  if (posOffsetEl) {
    const offsetText = String(posOffsetEl.elements?.[0]?.text ?? '0');
    const posOffset = parseInt(offsetText, 10);
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
 * Parse vertical position (wp:positionV)
 */
function parsePositionV(posV: XmlElement | null): ImagePosition['vertical'] | undefined {
  if (!posV) return undefined;

  const relativeTo = getAttribute(posV, null, 'relativeFrom') ?? 'paragraph';

  // Check for alignment child
  const alignEl = findByFullName(posV, 'wp:align');
  if (alignEl) {
    const alignment = alignEl.elements?.[0]?.text ?? null;
    return {
      relativeTo: relativeTo as ImagePosition['vertical']['relativeTo'],
      alignment: alignment as ImagePosition['vertical']['alignment'],
    };
  }

  // Check for posOffset child
  const posOffsetEl = findByFullName(posV, 'wp:posOffset');
  if (posOffsetEl) {
    const offsetText = String(posOffsetEl.elements?.[0]?.text ?? '0');
    const posOffset = parseInt(offsetText, 10);
    return {
      relativeTo: relativeTo as ImagePosition['vertical']['relativeTo'],
      posOffset: isNaN(posOffset) ? 0 : posOffset,
    };
  }

  return {
    relativeTo: relativeTo as ImagePosition['vertical']['relativeTo'],
  };
}

// ============================================================================
// WRAP PARSING (for anchored images)
// ============================================================================

/**
 * Wrap element names
 */
const WRAP_ELEMENTS = [
  'wp:wrapNone',
  'wp:wrapSquare',
  'wp:wrapTight',
  'wp:wrapThrough',
  'wp:wrapTopAndBottom',
];

/**
 * Parse wrap element to ImageWrap.
 *
 * Distance attributes (distT/distB/distL/distR) can appear on both
 * the wp:anchor element and the wrap child element. The wrap child
 * element values take priority; anchor-level values are used as fallbacks.
 */
function parseWrapElement(
  wrapEl: XmlElement | null,
  behindDoc: boolean,
  anchorDistances?: { distT?: number; distB?: number; distL?: number; distR?: number }
): ImageWrap {
  if (!wrapEl) {
    // No wrap element = wrapNone
    const wrap: ImageWrap = {
      type: behindDoc ? 'behind' : 'inFront',
    };
    // Use anchor-level distances as fallback
    if (anchorDistances?.distT !== undefined) wrap.distT = anchorDistances.distT;
    if (anchorDistances?.distB !== undefined) wrap.distB = anchorDistances.distB;
    if (anchorDistances?.distL !== undefined) wrap.distL = anchorDistances.distL;
    if (anchorDistances?.distR !== undefined) wrap.distR = anchorDistances.distR;
    return wrap;
  }

  const wrapName = wrapEl.name || '';
  const wrapType = wrapName.replace('wp:', '');

  // Parse distance attributes from the wrap child element
  const wrapDistT = parseNumericAttribute(wrapEl, null, 'distT') ?? undefined;
  const wrapDistB = parseNumericAttribute(wrapEl, null, 'distB') ?? undefined;
  const wrapDistL = parseNumericAttribute(wrapEl, null, 'distL') ?? undefined;
  const wrapDistR = parseNumericAttribute(wrapEl, null, 'distR') ?? undefined;

  // Wrap child values take priority, then anchor-level values
  const distT = wrapDistT ?? anchorDistances?.distT;
  const distB = wrapDistB ?? anchorDistances?.distB;
  const distL = wrapDistL ?? anchorDistances?.distL;
  const distR = wrapDistR ?? anchorDistances?.distR;

  // Parse wrapText attribute
  const wrapText = getAttribute(wrapEl, null, 'wrapText') ?? undefined;

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
      type = 'square'; // Default fallback
  }

  const wrap: ImageWrap = { type };

  if (wrapText) {
    wrap.wrapText = wrapText as ImageWrap['wrapText'];
  }

  if (distT !== undefined) wrap.distT = distT;
  if (distB !== undefined) wrap.distB = distB;
  if (distL !== undefined) wrap.distL = distL;
  if (distR !== undefined) wrap.distR = distR;

  return wrap;
}

// ============================================================================
// TRANSFORM PARSING
// ============================================================================

/**
 * Parse transform properties from a:xfrm
 */
function parseTransform(xfrm: XmlElement | null): ImageTransform | undefined {
  if (!xfrm) return undefined;

  const rot = getAttribute(xfrm, null, 'rot');
  const flipH = getAttribute(xfrm, null, 'flipH') === '1';
  const flipV = getAttribute(xfrm, null, 'flipV') === '1';

  const rotation = rotToDegrees(rot);

  if (rotation === undefined && !flipH && !flipV) {
    return undefined;
  }

  const transform: ImageTransform = {};
  if (rotation !== undefined) transform.rotation = rotation;
  if (flipH) transform.flipH = true;
  if (flipV) transform.flipV = true;

  return transform;
}

// ============================================================================
// BLIP EXTRACTION (image relationship ID)
// ============================================================================

/**
 * Find the a:blip element and extract the relationship ID
 *
 * Path: a:graphic > a:graphicData > pic:pic > pic:blipFill > a:blip
 */
function findBlipElement(container: XmlElement): XmlElement | null {
  // Find a:graphic
  const graphic = findByFullName(container, 'a:graphic');
  if (!graphic) return null;

  // Find a:graphicData
  const graphicData = findByFullName(graphic, 'a:graphicData');
  if (!graphicData) return null;

  // Find pic:pic
  const pic = findByFullName(graphicData, 'pic:pic');
  if (!pic) return null;

  // Find pic:blipFill
  const blipFill = findByFullName(pic, 'pic:blipFill');
  if (!blipFill) return null;

  // Find a:blip
  const blip = findByFullName(blipFill, 'a:blip');
  return blip;
}

/**
 * Extract rId from a:blip element
 */
function extractBlipRId(blip: XmlElement | null): string {
  if (!blip) return '';

  // The rId is in r:embed attribute
  const rEmbed = getAttribute(blip, 'r', 'embed');
  if (rEmbed) return rEmbed;

  // Sometimes it's just "embed" without namespace
  const embed = getAttribute(blip, null, 'embed');
  if (embed) return embed;

  // Check r:link for linked (not embedded) images
  const rLink = getAttribute(blip, 'r', 'link');
  if (rLink) return rLink;

  return '';
}

/**
 * Find transform (a:xfrm) from picture shape properties
 *
 * Path: a:graphic > a:graphicData > pic:pic > pic:spPr > a:xfrm
 */
function findPictureTransform(container: XmlElement): XmlElement | null {
  const graphic = findByFullName(container, 'a:graphic');
  if (!graphic) return null;

  const graphicData = findByFullName(graphic, 'a:graphicData');
  if (!graphicData) return null;

  const pic = findByFullName(graphicData, 'pic:pic');
  if (!pic) return null;

  const spPr = findByFullName(pic, 'pic:spPr');
  if (!spPr) return null;

  const xfrm = findByFullName(spPr, 'a:xfrm');
  return xfrm;
}

// ============================================================================
// MEDIA RESOLUTION
// ============================================================================

/**
 * Normalize a target path to the standard word/media/... format
 */
function normalizeMediaPath(targetPath: string): string {
  if (!targetPath) return targetPath;

  // Remove leading slashes
  let normalized = targetPath.replace(/^\/+/, '');

  // Ensure word/ prefix for media files
  if (normalized.startsWith('media/')) {
    normalized = `word/${normalized}`;
  } else if (!normalized.startsWith('word/')) {
    normalized = `word/${normalized}`;
  }

  return normalized;
}

/**
 * Get MIME type from file extension
 */
function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';

  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    emf: 'image/x-emf',
    wmf: 'image/x-wmf',
  };

  return mimeTypes[ext] ?? 'application/octet-stream';
}

/**
 * Resolve image data from relationships and media map
 *
 * @param rId - Relationship ID (e.g., "rId1")
 * @param rels - Relationship map
 * @param media - Media files map
 * @returns Object with src (data URL or blob), mimeType, and filename
 */
function resolveImageData(
  rId: string,
  rels: RelationshipMap | undefined,
  media: Map<string, MediaFile> | undefined
): { src?: string; mimeType?: string; filename?: string } {
  if (!rId || !rels) {
    return {};
  }

  const rel = rels.get(rId);
  if (!rel) {
    return {};
  }

  // Get the target path
  const targetPath = rel.target;
  if (!targetPath) {
    return {};
  }

  // Normalize the path
  const normalizedPath = normalizeMediaPath(targetPath);
  const filename = targetPath.split('/').pop();

  // Case-insensitive lookup helper for media map
  const findMediaCaseInsensitive = (
    map: Map<string, MediaFile>,
    searchPath: string
  ): MediaFile | undefined => {
    const lowerPath = searchPath.toLowerCase();
    for (const [key, value] of map.entries()) {
      if (key.toLowerCase() === lowerPath) {
        return value;
      }
    }
    return undefined;
  };

  // Try to find the media file (case-insensitive)
  if (media) {
    // Try normalized path first
    const mediaFile = findMediaCaseInsensitive(media, normalizedPath);
    if (mediaFile) {
      return {
        src: mediaFile.dataUrl || mediaFile.base64, // Use data URL or base64
        mimeType: mediaFile.mimeType,
        filename,
      };
    }

    // Try without word/ prefix
    const altPath = targetPath.replace(/^\/+/, '');
    const altMediaFile = findMediaCaseInsensitive(media, altPath);
    if (altMediaFile) {
      return {
        src: altMediaFile.dataUrl || altMediaFile.base64,
        mimeType: altMediaFile.mimeType,
        filename,
      };
    }

    // Try with word/ prefix added
    const withWordPrefix = `word/${altPath}`;
    const prefixedMediaFile = findMediaCaseInsensitive(media, withWordPrefix);
    if (prefixedMediaFile) {
      return {
        src: prefixedMediaFile.dataUrl || prefixedMediaFile.base64,
        mimeType: prefixedMediaFile.mimeType,
        filename,
      };
    }
  }

  // Return at least the MIME type based on extension
  return {
    mimeType: getMimeType(targetPath),
    filename,
  };
}

// ============================================================================
// MAIN PARSING FUNCTIONS
// ============================================================================

/**
 * Parse a wp:inline element (inline image)
 *
 * @param inlineEl - The wp:inline element
 * @param rels - Relationship map for resolving rId
 * @param media - Media files map
 * @returns Parsed Image object
 */
function parseInline(
  inlineEl: XmlElement,
  rels: RelationshipMap | undefined,
  media: Map<string, MediaFile> | undefined
): Image {
  // Parse extent (size)
  const extent = findByFullName(inlineEl, 'wp:extent');
  const size = parseExtent(extent);

  // Parse effect extent
  const effectExtent = findByFullName(inlineEl, 'wp:effectExtent');
  const padding = parseEffectExtent(effectExtent);

  // Parse document properties
  const docPr = findByFullName(inlineEl, 'wp:docPr');
  const props = parseDocProps(docPr);

  // Find blip and extract rId
  const blip = findBlipElement(inlineEl);
  const rId = extractBlipRId(blip);

  // Resolve image data
  const imageData = resolveImageData(rId, rels, media);

  // Find transform
  const xfrm = findPictureTransform(inlineEl);
  const transform = parseTransform(xfrm);

  // Read distance attributes from wp:inline (OOXML spec: distT, distB, distL, distR)
  const distT = parseNumericAttribute(inlineEl, null, 'distT') ?? undefined;
  const distB = parseNumericAttribute(inlineEl, null, 'distB') ?? undefined;
  const distL = parseNumericAttribute(inlineEl, null, 'distL') ?? undefined;
  const distR = parseNumericAttribute(inlineEl, null, 'distR') ?? undefined;

  const wrap: ImageWrap = { type: 'inline' };
  if (distT !== undefined) wrap.distT = distT;
  if (distB !== undefined) wrap.distB = distB;
  if (distL !== undefined) wrap.distL = distL;
  if (distR !== undefined) wrap.distR = distR;

  const image: Image = {
    type: 'image',
    rId,
    size,
    wrap,
  };

  // Add optional properties
  if (props.id) image.id = props.id;
  if (props.alt) image.alt = props.alt;
  if (props.title) image.title = props.title;
  if (props.decorative) image.decorative = true;
  if (imageData.src) image.src = imageData.src;
  if (imageData.mimeType) image.mimeType = imageData.mimeType;
  if (imageData.filename) image.filename = imageData.filename;
  if (padding) image.padding = padding;
  if (transform) image.transform = transform;

  return image;
}

/**
 * Parse a wp:anchor element (floating/anchored image)
 *
 * @param anchorEl - The wp:anchor element
 * @param rels - Relationship map for resolving rId
 * @param media - Media files map
 * @returns Parsed Image object
 */
function parseAnchor(
  anchorEl: XmlElement,
  rels: RelationshipMap | undefined,
  media: Map<string, MediaFile> | undefined
): Image {
  // Parse extent (size)
  const extent = findByFullName(anchorEl, 'wp:extent');
  const size = parseExtent(extent);

  // Parse effect extent
  const effectExtent = findByFullName(anchorEl, 'wp:effectExtent');
  const padding = parseEffectExtent(effectExtent);

  // Parse document properties
  const docPr = findByFullName(anchorEl, 'wp:docPr');
  const props = parseDocProps(docPr);

  // Check behindDoc attribute
  const behindDoc = getAttribute(anchorEl, null, 'behindDoc') === '1';

  // Read distance attributes from the wp:anchor element itself (fallback values)
  const anchorDistances = {
    distT: parseNumericAttribute(anchorEl, null, 'distT') ?? undefined,
    distB: parseNumericAttribute(anchorEl, null, 'distB') ?? undefined,
    distL: parseNumericAttribute(anchorEl, null, 'distL') ?? undefined,
    distR: parseNumericAttribute(anchorEl, null, 'distR') ?? undefined,
  };

  // Parse wrap element (wrap child values take priority over anchor-level values)
  const wrapEl = findAnyOf(anchorEl, WRAP_ELEMENTS);
  const wrap = parseWrapElement(wrapEl, behindDoc, anchorDistances);

  // Parse position
  const posH = findByFullName(anchorEl, 'wp:positionH');
  const posV = findByFullName(anchorEl, 'wp:positionV');
  const horizontal = parsePositionH(posH);
  const vertical = parsePositionV(posV);

  let position: ImagePosition | undefined;
  if (horizontal || vertical) {
    position = {
      horizontal: horizontal ?? { relativeTo: 'column' },
      vertical: vertical ?? { relativeTo: 'paragraph' },
    };
  }

  // Find blip and extract rId
  const blip = findBlipElement(anchorEl);
  const rId = extractBlipRId(blip);

  // Resolve image data
  const imageData = resolveImageData(rId, rels, media);

  // Find transform
  const xfrm = findPictureTransform(anchorEl);
  const transform = parseTransform(xfrm);

  const image: Image = {
    type: 'image',
    rId,
    size,
    wrap,
  };

  // Add optional properties
  if (props.id) image.id = props.id;
  if (props.alt) image.alt = props.alt;
  if (props.title) image.title = props.title;
  if (props.decorative) image.decorative = true;
  if (imageData.src) image.src = imageData.src;
  if (imageData.mimeType) image.mimeType = imageData.mimeType;
  if (imageData.filename) image.filename = imageData.filename;
  if (position) image.position = position;
  if (padding) image.padding = padding;
  if (transform) image.transform = transform;

  return image;
}

/**
 * Parse a w:drawing element
 *
 * The drawing element contains either wp:inline or wp:anchor.
 *
 * @param drawingEl - The w:drawing element
 * @param rels - Relationship map for resolving rId
 * @param media - Media files map
 * @returns Parsed Image object or null if not an image
 */
export function parseDrawing(
  drawingEl: XmlElement,
  rels: RelationshipMap | undefined,
  media: Map<string, MediaFile> | undefined
): Image | null {
  const children = getChildElements(drawingEl);

  for (const child of children) {
    const name = child.name || '';

    if (name === 'wp:inline') {
      return parseInline(child, rels, media);
    }

    if (name === 'wp:anchor') {
      return parseAnchor(child, rels, media);
    }
  }

  return null;
}

/**
 * Parse an image from a w:drawing element
 *
 * This is the main entry point for image parsing.
 *
 * @param node - The w:drawing XML element
 * @param rels - Relationship map for resolving rId
 * @param media - Media files map
 * @returns Parsed Image object or null if parsing fails
 */
export function parseImage(
  node: XmlElement,
  rels: RelationshipMap | undefined,
  media: Map<string, MediaFile> | undefined
): Image | null {
  return parseDrawing(node, rels, media);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if an image is inline (not floating)
 */
export function isInlineImage(image: Image): boolean {
  return image.wrap.type === 'inline';
}

/**
 * Check if an image is floating (anchored)
 */
export function isFloatingImage(image: Image): boolean {
  return image.wrap.type !== 'inline';
}

/**
 * Check if an image is behind text
 */
export function isBehindText(image: Image): boolean {
  return image.wrap.type === 'behind';
}

/**
 * Check if an image is in front of text
 */
export function isInFrontOfText(image: Image): boolean {
  return image.wrap.type === 'inFront';
}

/**
 * Get image width in pixels
 */
export function getImageWidthPx(image: Image): number {
  return emuToPixels(image.size.width);
}

/**
 * Get image height in pixels
 */
export function getImageHeightPx(image: Image): number {
  return emuToPixels(image.size.height);
}

/**
 * Get image dimensions in pixels
 */
export function getImageDimensionsPx(image: Image): { width: number; height: number } {
  return {
    width: emuToPixels(image.size.width),
    height: emuToPixels(image.size.height),
  };
}

/**
 * Check if image has alt text (for accessibility)
 */
export function hasAltText(image: Image): boolean {
  return !!image.alt && image.alt.trim().length > 0;
}

/**
 * Check if image is decorative (should be ignored by screen readers)
 */
export function isDecorativeImage(image: Image): boolean {
  return image.decorative === true;
}

/**
 * Get wrap distances in pixels
 */
export function getWrapDistancesPx(image: Image): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  return {
    top: emuToPixels(image.wrap.distT),
    bottom: emuToPixels(image.wrap.distB),
    left: emuToPixels(image.wrap.distL),
    right: emuToPixels(image.wrap.distR),
  };
}

/**
 * Check if image needs text wrapping
 */
export function needsTextWrapping(image: Image): boolean {
  const wrapTypes = ['square', 'tight', 'through', 'topAndBottom'];
  return wrapTypes.includes(image.wrap.type);
}
