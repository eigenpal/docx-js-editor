# PHASE 15: PRODUCTION READINESS (50 Tickets)

**Context:** Investigation via Playwright revealed critical gaps:
- Toolbar buttons don't apply formatting (props mismatch)
- No visible cursor when editing
- Text fragmented into 252 tiny spans
- No pagination/page breaks
- No headers/footers rendered
- No table editing UI

**Approach:** Use `~/superdoc` as reference only - implement everything ourselves.

---

## Category 1: Critical Bug Fixes

- [x] US-100: Fix Toolbar props mismatch in DocxEditor - P0 - DocxEditor passes wrong props to Toolbar
- [x] US-101: Add visible cursor/caret styling - P0 - CSS for caret-color in contentEditable
- [x] US-102: Fix text run fragmentation - P0 - Merge consecutive runs with identical formatting
- [x] US-103: Connect TableToolbar to table selection - P1 - Show toolbar when clicking table cells
- [x] US-104: Fix undo/redo history connection - P1 - Connect useHistory hook to Editor state

## Category 2: Essential Toolbar Features

- [x] US-110: Add Font Family picker to toolbar - P1 - Dropdown for font selection
- [x] US-111: Add Font Size picker to toolbar - P1 - Dropdown for font sizes
- [x] US-112: Add Text Color picker to toolbar - P1 - Color picker for text
- [x] US-113: Add Highlight Color picker to toolbar - P1 - Background color picker
- [x] US-114: Add Text Alignment buttons to toolbar - P1 - Left/center/right/justify
- [x] US-115: Add Bullet List button to toolbar - P1 - Toggle bullet lists
- [x] US-116: Add Numbered List button to toolbar - P1 - Toggle numbered lists
- [x] US-117: Add Indent/Outdent buttons to toolbar - P2 - Increase/decrease indent
- [x] US-118: Add Line Spacing dropdown to toolbar - P2 - 1.0, 1.15, 1.5, 2.0
- [x] US-119: Connect Style picker to toolbar - P2 - Wire StylePicker to document styles

## Category 3: Page Layout & Pagination

- [x] US-120: Implement page break rendering - P0 - Render document across multiple pages
- [x] US-121: Add page margins visualization - P1 - Show margins as visible boundaries
- [x] US-122: Implement headers rendering - P1 - Render headers on each page
- [ ] US-123: Implement footers rendering - P1 - Render footers on each page
- [ ] US-124: Add page number display - P2 - Show Page X of Y
- [ ] US-125: Implement scroll-to-page navigation - P2 - Jump to page number
- [ ] US-126: Add horizontal ruler - P3 - Ruler with margin markers
- [ ] US-127: Add print preview/export - P3 - Print with correct layout

## Category 4: Table Editing

- [ ] US-130: Wire table row insertion - P1 - Add rows above/below
- [ ] US-131: Wire table column insertion - P1 - Add columns left/right
- [ ] US-132: Wire table row deletion - P1 - Delete selected rows
- [ ] US-133: Wire table column deletion - P1 - Delete selected columns
- [ ] US-134: Wire cell merge functionality - P2 - Merge multi-cell selection
- [ ] US-135: Add table border styling UI - P2 - Change border style/color/width
- [ ] US-136: Add cell background color UI - P2 - Cell shading color picker

## Category 5: Insert Operations

- [ ] US-140: Add Insert Table dialog - P1 - Row/col selector for new tables
- [ ] US-141: Add Insert Image functionality - P2 - Insert images from file
- [ ] US-142: Add Insert Hyperlink dialog - P2 - Insert/edit hyperlinks
- [ ] US-143: Add Insert Page Break - P2 - Insert page break at cursor
- [ ] US-144: Add Insert Horizontal Rule - P3 - Insert horizontal line
- [ ] US-145: Add Insert Special Characters - P3 - Symbol picker dialog

## Category 6: Selection & Navigation

- [ ] US-150: Improve text selection highlighting - P1 - Visual highlighting across runs
- [ ] US-151: Add word-level double-click selection - P2 - Double-click selects word
- [ ] US-152: Add paragraph-level triple-click selection - P2 - Triple-click selects paragraph
- [ ] US-153: Wire Find & Replace dialog - P2 - Ctrl+F find and replace
- [ ] US-154: Improve keyboard navigation - P2 - Ctrl+Arrow, Home/End

## Category 7: Clipboard & History

- [ ] US-160: Implement proper copy/paste - P1 - Preserve/apply formatting
- [ ] US-161: Add paste special options - P3 - Paste plain text option
- [ ] US-162: Add unsaved changes indicator - P3 - Show unsaved status
- [ ] US-163: Add auto-save functionality - P3 - Auto-save to localStorage

## Category 8: UI/UX Improvements

- [ ] US-170: Add context menu for text - P1 - Right-click cut/copy/paste
- [ ] US-171: Add loading states for operations - P2 - Spinner during save
- [ ] US-172: Add keyboard shortcut help dialog - P3 - Show all shortcuts
- [ ] US-173: Add zoom via Ctrl+scroll - P2 - Mousewheel zoom
- [ ] US-174: Improve responsive toolbar - P3 - Overflow menu for narrow screens

---

## Priority Order

**P0 (Do First):** US-100, US-101, US-102, US-120
**P1 (Critical):** US-103, US-104, US-110-116, US-121-123, US-130-133, US-140, US-150, US-160, US-170
**P2 (Important):** US-117-119, US-124-125, US-134-136, US-141-144, US-151-154, US-171, US-173
**P3 (Nice to have):** US-126-127, US-145, US-161-163, US-172, US-174
