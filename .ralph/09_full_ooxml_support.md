# Plan 09: Full OOXML Support

**Goal:** Make the editor a complete WYSIWYG DOCX editor matching Microsoft Word functionality.
The editor has excellent OOXML parsing (~90% coverage) but limited editing capabilities.

**Branch:** `feat/work-on-supporting-all-ooxml`

---

## Phase 1: Table Editing Core (6 tasks)

- [x] **1.1 Cell merge/split via prosemirror-tables** — Import `mergeCells`, `splitCell`, `CellSelection` from prosemirror-tables. Wire real implementations into TableExtension.ts commands (replacing stubs). Detect CellSelection in `getTableContext()` for `hasMultiCellSelection`. Update commands/table.ts re-exports.
- [x] **1.2 Upgrade cell border model to full BorderSpec** — Change `TableCellAttrs.borders` from `{top?: boolean}` to `{top?: BorderSpec}` with style/color/width per side. Remove separate `borderColors`/`borderWidths` attrs. Update `buildCellBorderStyles()` to render OOXML border styles as CSS. Update toProseDoc/fromProseDoc conversion.
- [x] **1.3 Per-cell border editing commands** — `setCellBorder(side, spec)` operating on CellSelection or current cell. Wire into TableBorderPicker with style/color/width selectors.
- [x] **1.4 Vertical alignment + cell margins UI** — `setCellVerticalAlign()`, `setCellMargins()` commands. Add controls to TableOptionsDropdown.
- [x] **1.5 Text direction + no-wrap controls** — Map OOXML text directions (`lrTb`, `tbRl`, `btLr`) to CSS `writing-mode`+`direction`. Add `setCellTextDirection()` command and dropdown UI.
- [x] **1.6 Row height editing** — `setRowHeight(height, rule)` command. UI input in TableOptionsDropdown for height + rule (auto/atLeast/exact).

---

## Phase 2: Table Advanced Features (4 tasks)

- [x] **2.1 Header row repeat toggle** — `toggleHeaderRow` command on first row. Serializes to `<w:tblHeader/>`. Checkbox in TableOptionsDropdown.
- [x] **2.2 Auto-fit + distribute columns evenly** — `distributeColumns` divides total width equally. `autoFitContents` removes explicit widths. Menu items in dropdown.
- [x] **2.3 Table properties dialog** — Modal for table-level settings: preferred width, alignment, cell spacing, default margins, indent, layout mode. New `TablePropertiesDialog.tsx`.
- [x] **2.4 Table style gallery** — Visual gallery of predefined styles. `applyTableStyle(styleId)` resolves conditional formatting (firstRow/lastRow/banded). Apply rPr+pPr+tcPr per cell position.

---

## Phase 3: Image Editing Complete (6 tasks)

- [x] **3.1 Image insert from file** — File picker → read as data URL → get natural dimensions → create PM image node → insert at cursor. Track in media registry for DOCX export.
- [x] **3.2 Text wrapping mode selector** — `setImageWrapType(type, side?)` command updates wrapType+displayMode+cssFloat atomically. Floating toolbar with 7 mode icons on selected image.
- [x] **3.3 Image rotation + flip UI** — Circular rotation handle above selected image. Drag to rotate. Flip H/V buttons in image toolbar. Updates `transform` attr.
- [x] **3.4 Image positioning dialog** — Modal: horizontal/vertical alignment or offset, relative to page/column/margin/paragraph. Distance from text controls.
- [x] **3.5 Image alt text + border/outline** — Alt text editor in image properties. Border style/color/width applied as CSS border + serialized to `a:ln`.
- [x] **3.6 Image drag to reposition** — Floating images draggable to new position. Ghost outline during drag. Updates posOffset attrs. Inline images reorder in text flow.

---

## Phase 4: Shapes & Text Boxes (4 tasks)

- [x] **4.1 Editable text boxes** — New `TextBoxExtension` as isolating block node with `content: '(paragraph|table)+'`. Positioned absolutely. Focus management between main doc and text box. Round-trip `wps:wsp`/`wps:txbx` XML.
- [x] **4.2 Shape selection + basic properties** — `EditableShape.tsx`: selection outline, 8 resize handles, delete. Fill color picker, outline color/width.
- [x] **4.3 Shape insertion** — Shape gallery picker (rect, oval, line, arrow, text box). Creates anchored drawing with `wps:wsp` XML.
- [x] **4.4 Shape effects rendering** — Gradient fills as CSS gradients. Shadow via CSS box-shadow. Glow/reflection as CSS filters where possible.

---

## Phase 5: Headers, Footers & Sections (3 tasks)

- [x] **5.1 Editable headers/footers** — Double-click to enter header editing mode. Nested ProseMirror EditorView for header content. Dim main body. Separate undo history. Save changes back to document model on exit.
- [x] **5.2 Section break editing** — Visualize section boundaries. Insert/delete section breaks (nextPage, continuous, oddPage, evenPage). Each section has own margins/orientation/columns/headers.
- [x] **5.3 Page borders** — Render section-level page borders on page container. CSS border with full OOXML border spec styles.

---

## Phase 6: Footnotes & Endnotes (2 tasks)

- [ ] **6.1 Footnote/endnote editing** — Clickable reference markers. Footnote editing area at page bottom. Insert/delete commands. Auto-renumbering.
- [ ] **6.2 Footnote/endnote properties** — Position (page bottom vs beneath text), numbering format, restart rules per section.

---

## Phase 7: Remaining OOXML Features (10 tasks)

- [ ] **7.1 Additional text effects** — Emboss, imprint, outline, shadow, emphasis marks as mark extensions + toolbar toggles.
- [ ] **7.2 Custom tab stop editor** — Ruler component with visual tab stop placement. Add/remove/change alignment(L/C/R/decimal)/leader(dot/dash/underline).
- [ ] **7.3 Character spacing/position UI** — Font dialog or Format menu: spacing (twips), position (raise/lower), scale %, kerning.
- [ ] **7.4 Table of Contents** — Parse TOC field codes. Generate from heading styles + outline levels. Update command.
- [ ] **7.5 Field updates** — PAGE, NUMPAGES, DATE auto-update. MERGEFIELD preview with template data.
- [ ] **7.6 Content control (SDT) editing** — Make structured document tags editable with proper UI. Rich text, plain text, date, dropdown, checkbox controls.
- [ ] **7.7 Comments sidebar** — Parse comment ranges. Highlight commented text. Sidebar with comment list. Add/reply/resolve commands.
- [ ] **7.8 Tracked changes (foundation)** — Parse `w:ins`/`w:del`/`w:rPrChange`. Render insertions (underline) and deletions (strikethrough). Accept/reject commands.
- [ ] **7.9 Math equations (OMML)** — Read-only rendering first via MathML/KaTeX. Parse `m:oMath` structure. Display inline and block equations.
- [ ] **7.10 Improved image serialization** — Full DrawingML XML generation for images on DOCX export (currently minimal). Shapes + text boxes XML serialization.

---

## Verification Strategy

Each task follows the Ralph loop:

1. `bun run typecheck` after every edit
2. Targeted Playwright test for the feature area
3. Round-trip test: open DOCX → edit → export → verify XML structure
4. Visual comparison against Microsoft Word for WYSIWYG fidelity

New test files to create as needed:

- `e2e/tests/table-merge-split.spec.ts`
- `e2e/tests/image-editing.spec.ts`
- `e2e/tests/shape-editing.spec.ts`
- `e2e/tests/header-footer-edit.spec.ts`
