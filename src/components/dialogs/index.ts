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

// Paste Special dialog for paste options
export {
  PasteSpecialDialog,
  type PasteSpecialDialogProps,
  type PasteOption,
  type UsePasteSpecialReturn,
  type UsePasteSpecialOptions,
  // Hook
  usePasteSpecial,
  // Utility functions
  getPasteOption,
  getAllPasteOptions,
  getDefaultPasteOption,
  isPasteSpecialShortcut,
} from './PasteSpecialDialog';

// Keyboard Shortcuts dialog for showing all shortcuts
export {
  KeyboardShortcutsDialog,
  type KeyboardShortcutsDialogProps,
  type KeyboardShortcut,
  type ShortcutCategory,
  type UseKeyboardShortcutsDialogOptions,
  type UseKeyboardShortcutsDialogReturn,
  // Hook
  useKeyboardShortcutsDialog,
  // Utility functions
  getDefaultShortcuts,
  getShortcutsByCategory,
  getCommonShortcuts,
  getCategoryLabel,
  getAllCategories,
  formatShortcutKeys,
} from './KeyboardShortcutsDialog';
