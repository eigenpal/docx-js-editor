/**
 * Relationship Parser
 *
 * Parses .rels files from DOCX packages to map relationship IDs (rId)
 * to their targets (images, hyperlinks, headers, footers, etc.).
 *
 * .rels files are XML with structure:
 * <Relationships xmlns="...">
 *   <Relationship Id="rId1" Type="..." Target="..." TargetMode="External|Internal"/>
 * </Relationships>
 *
 * Key relationship types:
 * - image: Embedded images (word/media/*)
 * - hyperlink: External URLs (TargetMode="External")
 * - header: Header XML files
 * - footer: Footer XML files
 * - footnotes: Footnotes XML
 * - endnotes: Endnotes XML
 * - styles: styles.xml
 * - numbering: numbering.xml
 * - fontTable: fontTable.xml
 * - theme: theme/theme1.xml
 */

import { parseXmlDocument, getChildElements, getAttribute } from './xmlParser';
import type { Relationship, RelationshipMap, RelationshipType } from '../types';

/**
 * Relationship type constants for common types
 */
export const RELATIONSHIP_TYPES = {
  image: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
  hyperlink: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
  header: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header',
  footer: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer',
  footnotes: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes',
  endnotes: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes',
  styles: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
  numbering: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering',
  fontTable: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable',
  theme: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme',
  settings: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings',
  webSettings: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings',
  oleObject: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject',
  chart: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart',
  diagramData: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData',
  officeDocument:
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
  coreProperties:
    'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
  extendedProperties:
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties',
  customProperties:
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties',
  customXml: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml',
} as const;

/**
 * Parse a .rels XML file into a RelationshipMap
 *
 * @param relsXml - XML content of a .rels file
 * @returns Map of relationship ID to Relationship object
 */
export function parseRelationships(relsXml: string): RelationshipMap {
  const map: RelationshipMap = new Map();

  if (!relsXml || relsXml.trim().length === 0) {
    return map;
  }

  const root = parseXmlDocument(relsXml);
  if (!root) {
    console.warn('Failed to parse relationships XML');
    return map;
  }

  // Get all Relationship elements
  const children = getChildElements(root);

  for (const child of children) {
    // Check if this is a Relationship element
    const name = child.name || '';
    if (!name.endsWith('Relationship') && !name.includes(':Relationship')) {
      continue;
    }

    // Extract attributes
    const id = getAttribute(child, null, 'Id');
    const type = getAttribute(child, null, 'Type');
    const target = getAttribute(child, null, 'Target');
    const targetMode = getAttribute(child, null, 'TargetMode');

    if (!id || !type || !target) {
      console.warn('Relationship missing required attributes:', { id, type, target });
      continue;
    }

    const relationship: Relationship = {
      id,
      type: type as RelationshipType,
      target,
    };

    if (targetMode === 'External') {
      relationship.targetMode = 'External';
    } else if (targetMode === 'Internal') {
      relationship.targetMode = 'Internal';
    }
    // If not specified, default is Internal (we don't set it explicitly)

    map.set(id, relationship);
  }

  return map;
}

/**
 * Get the short type name from a full relationship type URI
 *
 * @param typeUri - Full relationship type URI
 * @returns Short type name (e.g., "image", "hyperlink") or "unknown"
 */
export function getRelationshipTypeName(typeUri: string): string {
  for (const [name, uri] of Object.entries(RELATIONSHIP_TYPES)) {
    if (uri === typeUri) {
      return name;
    }
  }

  // Try to extract from URI
  const lastSlash = typeUri.lastIndexOf('/');
  if (lastSlash >= 0) {
    return typeUri.substring(lastSlash + 1);
  }

  return 'unknown';
}

/**
 * Check if a relationship type is an external link (hyperlink)
 *
 * @param rel - Relationship to check
 * @returns true if this is an external hyperlink
 */
export function isExternalHyperlink(rel: Relationship): boolean {
  return rel.type === RELATIONSHIP_TYPES.hyperlink && rel.targetMode === 'External';
}

/**
 * Check if a relationship type is an image
 *
 * @param rel - Relationship to check
 * @returns true if this is an image relationship
 */
export function isImageRelationship(rel: Relationship): boolean {
  return rel.type === RELATIONSHIP_TYPES.image;
}

/**
 * Check if a relationship type is a header
 *
 * @param rel - Relationship to check
 * @returns true if this is a header relationship
 */
export function isHeaderRelationship(rel: Relationship): boolean {
  return rel.type === RELATIONSHIP_TYPES.header;
}

/**
 * Check if a relationship type is a footer
 *
 * @param rel - Relationship to check
 * @returns true if this is a footer relationship
 */
export function isFooterRelationship(rel: Relationship): boolean {
  return rel.type === RELATIONSHIP_TYPES.footer;
}

/**
 * Filter relationships by type
 *
 * @param map - RelationshipMap to filter
 * @param type - Relationship type URI to filter by
 * @returns Array of matching relationships
 */
export function filterByType(map: RelationshipMap, type: RelationshipType): Relationship[] {
  const results: Relationship[] = [];
  for (const rel of map.values()) {
    if (rel.type === type) {
      results.push(rel);
    }
  }
  return results;
}

/**
 * Get all images from a relationship map
 *
 * @param map - RelationshipMap to search
 * @returns Array of image relationships
 */
export function getImages(map: RelationshipMap): Relationship[] {
  return filterByType(map, RELATIONSHIP_TYPES.image);
}

/**
 * Get all hyperlinks from a relationship map
 *
 * @param map - RelationshipMap to search
 * @returns Array of hyperlink relationships
 */
export function getHyperlinks(map: RelationshipMap): Relationship[] {
  return filterByType(map, RELATIONSHIP_TYPES.hyperlink);
}

/**
 * Get all headers from a relationship map
 *
 * @param map - RelationshipMap to search
 * @returns Array of header relationships
 */
export function getHeaders(map: RelationshipMap): Relationship[] {
  return filterByType(map, RELATIONSHIP_TYPES.header);
}

/**
 * Get all footers from a relationship map
 *
 * @param map - RelationshipMap to search
 * @returns Array of footer relationships
 */
export function getFooters(map: RelationshipMap): Relationship[] {
  return filterByType(map, RELATIONSHIP_TYPES.footer);
}

/**
 * Resolve a relationship ID to a target path
 *
 * @param map - RelationshipMap to search
 * @param rId - Relationship ID (e.g., "rId1")
 * @returns Target path or undefined if not found
 */
export function resolveTarget(map: RelationshipMap, rId: string): string | undefined {
  const rel = map.get(rId);
  return rel?.target;
}

/**
 * Resolve a relationship ID to a full relationship
 *
 * @param map - RelationshipMap to search
 * @param rId - Relationship ID (e.g., "rId1")
 * @returns Relationship or undefined if not found
 */
export function resolveRelationship(map: RelationshipMap, rId: string): Relationship | undefined {
  return map.get(rId);
}

/**
 * Resolve a relative target path to an absolute path within the DOCX
 *
 * For example, if basePath is "word/_rels/document.xml.rels" and
 * target is "media/image1.png", the result is "word/media/image1.png"
 *
 * @param basePath - Path of the .rels file
 * @param target - Relative target from the relationship
 * @returns Absolute path within the DOCX
 */
export function resolveRelativePath(basePath: string, target: string): string {
  // If target starts with /, it's already absolute
  if (target.startsWith('/')) {
    return target.substring(1); // Remove leading /
  }

  // Get the directory of the .rels file
  // e.g., "word/_rels/document.xml.rels" -> "word/_rels"
  const lastSlash = basePath.lastIndexOf('/');
  let directory = lastSlash >= 0 ? basePath.substring(0, lastSlash) : '';

  // The .rels file is in _rels subdirectory, go up one level
  // e.g., "word/_rels" -> "word"
  if (directory.endsWith('/_rels')) {
    directory = directory.substring(0, directory.length - 6);
  } else if (directory === '_rels') {
    directory = '';
  }

  // Handle ../ in target
  const parts = target.split('/');
  const dirParts = directory ? directory.split('/') : [];

  for (const part of parts) {
    if (part === '..') {
      dirParts.pop();
    } else if (part !== '.') {
      dirParts.push(part);
    }
  }

  return dirParts.join('/');
}

/**
 * Parse document.xml.rels specifically
 *
 * This is a convenience wrapper for the main document relationships.
 *
 * @param relsXml - XML content of word/_rels/document.xml.rels
 * @returns RelationshipMap
 */
export function parseDocumentRelationships(relsXml: string): RelationshipMap {
  return parseRelationships(relsXml);
}

/**
 * Parse package-level .rels
 *
 * This is a convenience wrapper for the package relationships (_rels/.rels)
 *
 * @param relsXml - XML content of _rels/.rels
 * @returns RelationshipMap
 */
export function parsePackageRelationships(relsXml: string): RelationshipMap {
  return parseRelationships(relsXml);
}

/**
 * Debug: Print all relationships in a map
 *
 * @param map - RelationshipMap to print
 */
export function printRelationships(map: RelationshipMap): void {
  console.log('Relationships:');
  for (const [id, rel] of map.entries()) {
    const typeName = getRelationshipTypeName(rel.type);
    console.log(
      `  ${id}: ${typeName} -> ${rel.target}${rel.targetMode === 'External' ? ' (External)' : ''}`
    );
  }
}
