# Plan 08: Demo DOCX Critical Fixes

**Goal:** Fix all rendering and editing issues identified when loading `e2e/fixtures/demo/demo.docx`

**Reference Images:** `e2e/fixtures/demo/demo_1.jpg` through `demo_10.jpg` show expected rendering

---

## Phase 1: Layout Engine Critical Fixes (Paragraphs Overlapping)

### Task 1.1: Fix paragraph height calculation causing overlaps

- [ ] Investigate why paragraphs overlay with one another
- [ ] Check `measureParagraph.ts` for height calculation issues
- [ ] Verify line spacing is being applied correctly
- [ ] Fix spacing before/after paragraphs (spaceBefore, spaceAfter in twips)
- [ ] Test with demo.docx page 1 and page 2

### Task 1.2: Fix paragraph positioning in layout engine

- [ ] Review `layoutParagraph.ts` for y-position accumulation
- [ ] Ensure each paragraph starts after the previous one ends
- [ ] Handle paragraph margins correctly
- [ ] Verify with multiple paragraph styles

---

## Phase 2: Toolbar-Editor Synchronization

### Task 2.1: Fix toolbar state not reflecting editor selection

- [ ] Research SuperDoc selection tracking approach
- [ ] Check `selectionTracker.ts` plugin for issues
- [ ] Ensure selection changes emit correct formatting context
- [ ] Verify toolbar receives and displays current formatting
- [ ] Test: select bold text → toolbar bold button should be active

### Task 2.2: Fix alignment commands affecting wrong paragraph

- [ ] Debug why justifying title shifts different paragraph
- [ ] Check `paragraph.ts` commands for cursor position handling
- [ ] Ensure commands operate on paragraph at cursor, not selection
- [ ] Test: cursor in title → click align left → only title should change

---

## Phase 3: Hyperlinks Support

### Task 3.1: Parse hyperlinks from DOCX

- [ ] Check if `w:hyperlink` elements are parsed in documentParser
- [ ] Parse internal hyperlinks (bookmarks) and external URLs
- [ ] Store href attribute in run/hyperlink data structure
- [ ] Verify relationships are resolved for hyperlink targets

### Task 3.2: Render hyperlinks in ProseMirror

- [ ] Ensure hyperlink mark exists in schema (check marks.ts)
- [ ] Convert hyperlinks from Document to ProseMirror nodes
- [ ] Style hyperlinks (blue, underlined)
- [ ] Make hyperlinks clickable (Ctrl+click to open)

### Task 3.3: Render hyperlinks in PagedEditor

- [ ] Add hyperlink rendering in renderParagraph.ts
- [ ] Apply hyperlink styling in layout painter
- [ ] Test with demo.docx page 7 (Links section)

---

## Phase 4: Table of Contents (TOC)

### Task 4.1: Parse TOC structure from DOCX

- [ ] Identify TOC field codes in document (w:sdt with TOC)
- [ ] Parse TOC entries with their styles and page numbers
- [ ] Handle tab leaders (dots between text and page number)
- [ ] Store TOC as structured data

### Task 4.2: Render TOC with dot leaders

- [ ] Render TOC entries with proper indentation by level
- [ ] Implement tab leader rendering (dots)
- [ ] Right-align page numbers
- [ ] Apply TOC paragraph styles
- [ ] Test with demo.docx pages 7-8

---

## Phase 5: Table Editing

### Task 5.1: Enable table cell selection and editing

- [ ] Research SuperDoc table editing approach
- [ ] Ensure table cells are editable in ProseMirror
- [ ] Fix cursor navigation within tables (Tab, Shift+Tab)
- [ ] Enable text input in table cells

### Task 5.2: Fix table rendering in PagedEditor

- [ ] Verify table borders render correctly per cell
- [ ] Fix cell background colors
- [ ] Handle merged cells (colspan/rowspan)
- [ ] Test with demo.docx page 3-4 tables

---

## Phase 6: Nested Tables

### Task 6.1: Parse nested tables from DOCX

- [ ] Check documentParser handles tables inside table cells
- [ ] Ensure recursive table parsing works
- [ ] Verify nested table structure in Document model

### Task 6.2: Render nested tables

- [ ] Update toProseDoc to handle nested tables
- [ ] Update toFlowBlocks for nested table conversion
- [ ] Render nested tables in PagedEditor
- [ ] Test with demo.docx page 4 (nested table example)

---

## Phase 7: Multi-level Lists (1. 1.1. 1.1.1.)

### Task 7.1: Parse multi-level numbering definitions

- [ ] Review numberingParser.ts for multi-level support
- [ ] Parse w:lvl elements with lvlText patterns like "%1.%2.%3."
- [ ] Store level text format strings
- [ ] Track numbering counters per level

### Task 7.2: Generate correct list numbers

- [ ] Implement number generation based on lvlText format
- [ ] Handle level inheritance and restart rules
- [ ] Support different number formats (decimal, lowerLetter, lowerRoman)
- [ ] Test: 1. → 1.1. → 1.1.1. sequence

### Task 7.3: Render multi-level lists in PagedEditor

- [ ] Apply correct indentation per level
- [ ] Render generated numbers with proper formatting
- [ ] Handle hanging indents for wrapped list items
- [ ] Test with demo.docx page 10 (Multi-level Lists section)

---

## Phase 8: Additional List Features

### Task 8.1: Fix bullet list rendering

- [ ] Verify bullet characters render correctly
- [ ] Handle custom bullet images
- [ ] Apply correct bullet positioning
- [ ] Test with demo.docx page 10 (Bulleted List)

### Task 8.2: Handle continued lists

- [ ] Support lists that continue after interruption
- [ ] Track numbering across non-contiguous paragraphs
- [ ] Test with demo.docx page 10 (Continued Lists)

---

## Phase 9: Dropcaps

### Task 9.1: Parse dropcap formatting

- [ ] Identify dropcap elements (w:framePr with dropCap attribute)
- [ ] Extract dropcap settings (lines to span, font size)
- [ ] Store dropcap data in paragraph/run model

### Task 9.2: Render dropcaps

- [ ] Position dropcap character with float:left
- [ ] Size dropcap to span specified lines
- [ ] Flow text around dropcap
- [ ] Test with demo.docx page 6 (Dropcaps section)

---

## Phase 10: Floating Images

### Task 10.1: Parse floating image positions

- [ ] Check drawing parser for anchor/wrap settings
- [ ] Extract horizontal/vertical positioning
- [ ] Store wrap type (tight, square, none)

### Task 10.2: Render floating images

- [ ] Position images with CSS float or absolute positioning
- [ ] Handle text wrapping around images
- [ ] Test with demo.docx page 9 (Images section with arrows)

---

## Verification

After each phase:

1. Run `bun run typecheck`
2. Run relevant tests with `npx playwright test --grep "<pattern>"`
3. Visual test with demo.docx in browser
4. Compare against reference images in `e2e/fixtures/demo/`

---

## Priority Order

**Critical (breaks usability):**

1. Phase 1 - Paragraph overlapping
2. Phase 2 - Toolbar sync
3. Phase 5 - Table editing

**Important (missing features):** 4. Phase 3 - Hyperlinks 5. Phase 7 - Multi-level lists 6. Phase 4 - TOC

**Nice to have:** 7. Phase 6 - Nested tables 8. Phase 8 - List features 9. Phase 9 - Dropcaps 10. Phase 10 - Floating images
