/**
 * Bookmark Parser - Parse bookmark markers (w:bookmarkStart, w:bookmarkEnd)
 *
 * Bookmarks are named locations in a document that can be targeted by internal
 * hyperlinks. They consist of a start and end marker with matching IDs.
 *
 * OOXML Reference:
 * - Bookmark start: w:bookmarkStart (id, name, colFirst?, colLast?)
 * - Bookmark end: w:bookmarkEnd (id)
 * - Internal hyperlinks reference bookmarks by name via w:anchor attribute
 *
 * Bookmark Structure:
 * - Each bookmark has a unique numeric ID within the document
 * - The name is used for hyperlink references
 * - Start and end markers can span multiple paragraphs or be point bookmarks
 * - Table column bookmarks have colFirst/colLast for column ranges
 */

import type { BookmarkStart, BookmarkEnd } from '../types/document';
import { getAttribute, parseNumericAttribute, type XmlElement } from './xmlParser';

// ============================================================================
// BOOKMARK PARSING
// ============================================================================

/**
 * Parse a bookmark start element (w:bookmarkStart)
 *
 * Extracts:
 * - id: Numeric identifier (required, matches with bookmarkEnd)
 * - name: Bookmark name (required, used by hyperlinks)
 * - colFirst: First column for table bookmarks (optional)
 * - colLast: Last column for table bookmarks (optional)
 *
 * @param node - The w:bookmarkStart XML element
 * @returns Parsed BookmarkStart object
 */
export function parseBookmarkStart(node: XmlElement): BookmarkStart {
  const id = parseNumericAttribute(node, 'w', 'id') ?? 0;
  const name = getAttribute(node, 'w', 'name') ?? '';

  const bookmark: BookmarkStart = {
    type: 'bookmarkStart',
    id,
    name,
  };

  // Table column bookmarks (for bookmarks spanning table columns)
  const colFirst = parseNumericAttribute(node, 'w', 'colFirst');
  if (colFirst !== undefined) {
    bookmark.colFirst = colFirst;
  }

  const colLast = parseNumericAttribute(node, 'w', 'colLast');
  if (colLast !== undefined) {
    bookmark.colLast = colLast;
  }

  return bookmark;
}

/**
 * Parse a bookmark end element (w:bookmarkEnd)
 *
 * Bookmark ends only contain an ID that matches the corresponding start marker.
 *
 * @param node - The w:bookmarkEnd XML element
 * @returns Parsed BookmarkEnd object
 */
export function parseBookmarkEnd(node: XmlElement): BookmarkEnd {
  const id = parseNumericAttribute(node, 'w', 'id') ?? 0;

  return {
    type: 'bookmarkEnd',
    id,
  };
}

// ============================================================================
// BOOKMARK COLLECTION & UTILITIES
// ============================================================================

/**
 * Bookmark map for quick lookup by ID or name
 */
export interface BookmarkMap {
  /** Lookup bookmark start by ID */
  byId: Map<number, BookmarkStart>;
  /** Lookup bookmark start by name (for hyperlink resolution) */
  byName: Map<string, BookmarkStart>;
  /** All bookmark starts in document order */
  bookmarks: BookmarkStart[];
}

/**
 * Create an empty bookmark map
 */
export function createBookmarkMap(): BookmarkMap {
  return {
    byId: new Map(),
    byName: new Map(),
    bookmarks: [],
  };
}

/**
 * Add a bookmark to the map
 *
 * @param map - The bookmark map to update
 * @param bookmark - The bookmark start to add
 */
export function addBookmark(map: BookmarkMap, bookmark: BookmarkStart): void {
  map.byId.set(bookmark.id, bookmark);
  if (bookmark.name) {
    map.byName.set(bookmark.name, bookmark);
  }
  map.bookmarks.push(bookmark);
}

/**
 * Get a bookmark by name (for resolving internal hyperlinks)
 *
 * @param map - The bookmark map to search
 * @param name - Bookmark name to find
 * @returns The BookmarkStart or undefined if not found
 */
export function getBookmarkByName(map: BookmarkMap, name: string): BookmarkStart | undefined {
  return map.byName.get(name);
}

/**
 * Get a bookmark by ID (for matching start/end pairs)
 *
 * @param map - The bookmark map to search
 * @param id - Bookmark ID to find
 * @returns The BookmarkStart or undefined if not found
 */
export function getBookmarkById(map: BookmarkMap, id: number): BookmarkStart | undefined {
  return map.byId.get(id);
}

/**
 * Check if a bookmark exists by name
 *
 * @param map - The bookmark map to search
 * @param name - Bookmark name to check
 * @returns true if bookmark exists
 */
export function hasBookmark(map: BookmarkMap, name: string): boolean {
  return map.byName.has(name);
}

/**
 * Get all bookmark names in the document
 *
 * @param map - The bookmark map
 * @returns Array of bookmark names
 */
export function getAllBookmarkNames(map: BookmarkMap): string[] {
  return Array.from(map.byName.keys());
}

/**
 * Check if a bookmark is a point bookmark (start and end at same location)
 *
 * Point bookmarks have no content between start and end markers.
 * This is commonly used for insertion points.
 *
 * @param start - The bookmark start
 * @param end - The bookmark end
 * @param contents - Content between them
 * @returns true if this is a point bookmark
 */
export function isPointBookmark(
  start: BookmarkStart,
  end: BookmarkEnd,
  contents: unknown[]
): boolean {
  return start.id === end.id && contents.length === 0;
}

/**
 * Check if a bookmark is a table column bookmark
 *
 * Table bookmarks have colFirst and colLast attributes indicating
 * they span specific table columns.
 *
 * @param bookmark - The bookmark to check
 * @returns true if bookmark has column range info
 */
export function isTableBookmark(bookmark: BookmarkStart): boolean {
  return bookmark.colFirst !== undefined || bookmark.colLast !== undefined;
}

/**
 * Generate an internal hyperlink href from a bookmark name
 *
 * Internal hyperlinks use #anchor format.
 *
 * @param bookmarkName - The bookmark name to link to
 * @returns Href string (e.g., "#BookmarkName")
 */
export function bookmarkToHref(bookmarkName: string): string {
  return `#${bookmarkName}`;
}

/**
 * Extract bookmark name from an internal hyperlink href
 *
 * @param href - The href string
 * @returns Bookmark name or null if not an internal link
 */
export function hrefToBookmarkName(href: string): string | null {
  if (href.startsWith('#')) {
    return href.substring(1);
  }
  return null;
}

// ============================================================================
// SPECIAL BOOKMARK TYPES
// ============================================================================

/**
 * Check if a bookmark is a built-in Word bookmark
 *
 * Word uses certain reserved bookmark names for special purposes:
 * - _GoBack: Last editing position
 * - _Toc*: Table of contents entries
 * - _Ref*: Cross-reference anchors
 * - _Hlt*: Highlight ranges
 *
 * @param name - Bookmark name to check
 * @returns true if this is a built-in bookmark
 */
export function isBuiltInBookmark(name: string): boolean {
  if (!name) return false;

  // Check for underscore prefix (Word internal bookmarks)
  if (name.startsWith('_')) {
    return true;
  }

  return false;
}

/**
 * Check if a bookmark is a TOC entry bookmark
 *
 * @param name - Bookmark name to check
 * @returns true if bookmark is for TOC
 */
export function isTocBookmark(name: string): boolean {
  return name.startsWith('_Toc');
}

/**
 * Check if a bookmark is a cross-reference anchor
 *
 * @param name - Bookmark name to check
 * @returns true if bookmark is for cross-reference
 */
export function isRefBookmark(name: string): boolean {
  return name.startsWith('_Ref');
}

/**
 * Get bookmark type category
 *
 * @param name - Bookmark name
 * @returns Bookmark type
 */
export function getBookmarkType(name: string): 'user' | 'toc' | 'ref' | 'goBack' | 'internal' {
  if (name === '_GoBack') {
    return 'goBack';
  }
  if (isTocBookmark(name)) {
    return 'toc';
  }
  if (isRefBookmark(name)) {
    return 'ref';
  }
  if (isBuiltInBookmark(name)) {
    return 'internal';
  }
  return 'user';
}

// ============================================================================
// BOOKMARK VALIDATION
// ============================================================================

/**
 * Validate that all bookmark starts have matching ends
 *
 * @param starts - Array of bookmark starts
 * @param ends - Array of bookmark ends
 * @returns Object with validation results
 */
export function validateBookmarkPairs(
  starts: BookmarkStart[],
  ends: BookmarkEnd[]
): {
  valid: boolean;
  unmatchedStarts: BookmarkStart[];
  unmatchedEnds: BookmarkEnd[];
} {
  const startIds = new Set(starts.map((s) => s.id));
  const endIds = new Set(ends.map((e) => e.id));

  const unmatchedStarts = starts.filter((s) => !endIds.has(s.id));
  const unmatchedEnds = ends.filter((e) => !startIds.has(e.id));

  return {
    valid: unmatchedStarts.length === 0 && unmatchedEnds.length === 0,
    unmatchedStarts,
    unmatchedEnds,
  };
}

/**
 * Validate a bookmark name (for creating new bookmarks)
 *
 * Valid bookmark names:
 * - Cannot be empty
 * - Must start with a letter or underscore
 * - Can contain letters, digits, and underscores
 * - Cannot exceed 40 characters
 *
 * @param name - Name to validate
 * @returns Object with validation result and error message if invalid
 */
export function validateBookmarkName(name: string): { valid: boolean; error?: string } {
  if (!name) {
    return { valid: false, error: 'Bookmark name cannot be empty' };
  }

  if (name.length > 40) {
    return { valid: false, error: 'Bookmark name cannot exceed 40 characters' };
  }

  // Check first character (letter or underscore)
  if (!/^[a-zA-Z_]/.test(name)) {
    return {
      valid: false,
      error: 'Bookmark name must start with a letter or underscore',
    };
  }

  // Check remaining characters (letters, digits, underscores)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    return {
      valid: false,
      error: 'Bookmark name can only contain letters, digits, and underscores',
    };
  }

  return { valid: true };
}
