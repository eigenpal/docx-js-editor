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
