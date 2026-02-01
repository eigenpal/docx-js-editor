/**
 * Dialog Components
 *
 * Modal dialogs for user interaction in the DOCX editor.
 */

// Hyperlink dialog for inserting and editing hyperlinks
export {
  HyperlinkDialog,
  type HyperlinkDialogProps,
  type HyperlinkData,
  type BookmarkOption,
  // Utility functions
  isValidUrl,
  normalizeUrl,
  getUrlType,
  createHyperlinkData,
  createBookmarkLinkData,
  isExternalHyperlinkData,
  isBookmarkHyperlinkData,
  getDisplayText,
  emailToMailto,
  phoneToTel,
  extractBookmarksForDialog,
} from './HyperlinkDialog';

// Find and Replace dialog for searching and replacing text
export {
  FindReplaceDialog,
  type FindReplaceDialogProps,
  type FindMatch,
  type FindOptions,
  type FindResult,
  type HighlightOptions,
  // Utility functions
  createDefaultFindOptions,
  findAllMatches,
  escapeRegexString,
  createSearchPattern,
  replaceAllInContent,
  replaceFirstInContent,
  getMatchCountText,
  isEmptySearch,
  getDefaultHighlightOptions,
} from './FindReplaceDialog';
