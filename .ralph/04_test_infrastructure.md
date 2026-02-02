# Test Infrastructure & Bug Fixes Plan

**Goal:** Get the 500+ Playwright e2e tests passing by fixing architectural gaps.

**Verify command pattern:**

```
bun run typecheck && npx playwright test --grep "<test-pattern>" --timeout=30000
```

---

## PHASE 1: CRITICAL RENDERING BUG

- [x] **Fix backwards text rendering** - Text displays reversed in editor ("Italic text" → "txet cilatI"). Investigate ProseMirror/Editor rendering, CSS direction, or contenteditable setup. Verify: `npx playwright test --grep "apply bold via toolbar" --timeout=30000`

---

## PHASE 2: TEST SELECTOR ALIGNMENT - Toolbar Buttons

- [x] **Fix alignment button selectors** - Update `e2e/helpers/editor-page.ts` alignLeft/Center/Right/Justify to use actual aria-labels like "Align Left (Ctrl+L)". Verify: `npx playwright test --grep "align text left" --timeout=30000`

- [x] **Fix list button selectors** - Update toggleBulletList/toggleNumberedList to match "Bullet List" / "Numbered List". Verify: `npx playwright test --grep "create bullet list" --timeout=30000`

- [x] **Fix indent button selectors** - Update indent/outdent to match "Increase Indent" / "Decrease Indent". Verify: `npx playwright test --grep "indent" --timeout=30000`

- [x] **Fix strikethrough button selector** - Verify strikethrough button testid/aria-label matches. Verify: `npx playwright test --grep "strikethrough" --timeout=30000`

- [x] **Fix clear formatting button selector** - Verify clear formatting button testid matches. Verify: `npx playwright test --grep "clear formatting" --timeout=30000`

---

## PHASE 3: TEST SELECTOR ALIGNMENT - Pickers & Dropdowns

- [x] **Fix font picker selector** - Tests use `.font-picker` but component uses `aria-label="Select font family"`. Update EditorPage.setFontFamily(). Verify: `npx playwright test --grep "font family" --timeout=30000`

- [x] **Fix font size picker selector** - Tests use `.font-size-picker input`. Find actual selector in FontSizePicker component. Verify: `npx playwright test --grep "font size" --timeout=30000`

- [x] **Fix text color picker selector** - Tests use `.text-color-picker` but component uses `.docx-color-picker-text`. Update EditorPage.setTextColor(). Verify: `npx playwright test --grep "text color to red" --timeout=30000`

- [x] **Fix highlight color picker selector** - Tests use `.highlight-color-picker` but component uses `.docx-color-picker-highlight`. Update EditorPage.setHighlightColor(). Verify: `npx playwright test --grep "highlight color" --timeout=30000`

- [x] **Fix line spacing picker selector** - Tests use `[aria-label="Line spacing"]` and `[data-line-spacing="..."]`. Verify these match. Verify: `npx playwright test --grep "line spacing" --timeout=30000`

- [ ] **Fix style picker selector** - Tests use `[data-testid="toolbar-styles"]` and `[data-style="..."]`. Verify these exist. Verify: `npx playwright test --grep "Heading 1" --timeout=30000`

---

## PHASE 4: FUNCTIONAL FIXES - Text Formatting

- [ ] **Fix bold formatting application** - Clicking bold doesn't apply fontWeight >= 700. Trace applyFormattingAction('bold') to ProseMirror. Verify: `npx playwright test --grep "apply bold via toolbar" --timeout=30000`

- [ ] **Fix italic formatting application** - Verify: `npx playwright test --grep "apply italic via toolbar" --timeout=30000`

- [ ] **Fix underline formatting application** - Verify: `npx playwright test --grep "apply underline" --timeout=30000`

- [ ] **Fix strikethrough formatting application** - Verify: `npx playwright test --grep "strikethrough" --timeout=30000`

- [ ] **Fix superscript formatting** - Verify: `npx playwright test --grep "superscript" --timeout=30000`

- [ ] **Fix subscript formatting** - Verify: `npx playwright test --grep "subscript" --timeout=30000`

---

## PHASE 5: FUNCTIONAL FIXES - Lists

- [ ] **Fix bullet list creation** - Toggle doesn't add bullet markers. Fix handleBulletList logic. Verify: `npx playwright test --grep "create bullet list" --timeout=30000`

- [ ] **Fix numbered list creation** - Verify: `npx playwright test --grep "create numbered list" --timeout=30000`

- [ ] **Fix list indentation** - Increase/decrease indent for list levels. Verify: `npx playwright test --grep "nested bullet" --timeout=30000`

- [ ] **Fix list to paragraph conversion** - Toggle list off removes markers. Verify: `npx playwright test --grep "toggle bullet list off" --timeout=30000`

---

## PHASE 6: FUNCTIONAL FIXES - Colors & Fonts

- [ ] **Fix text color application** - setTextColor doesn't apply color CSS. Verify: `npx playwright test --grep "set text color to red" --timeout=30000`

- [ ] **Fix highlight color application** - Verify: `npx playwright test --grep "set highlight color to yellow" --timeout=30000`

- [ ] **Fix font family change** - Verify: `npx playwright test --grep "font family" --timeout=30000`

- [ ] **Fix font size change** - Verify: `npx playwright test --grep "font size" --timeout=30000`

---

## PHASE 7: FUNCTIONAL FIXES - Paragraph & Alignment

- [ ] **Fix text alignment application** - Align left/center/right/justify should apply text-align CSS. Verify: `npx playwright test --grep "align text left" --timeout=30000`

- [ ] **Fix line spacing application** - Verify: `npx playwright test --grep "single line spacing" --timeout=30000`

- [ ] **Fix paragraph style application** - Heading 1/2/3, Normal, Title styles. Verify: `npx playwright test --grep "apply Heading 1" --timeout=30000`

---

## PHASE 8: FUNCTIONAL FIXES - Undo/Redo

- [ ] **Fix undo functionality** - Undo button/Ctrl+Z should revert last change. Verify: `npx playwright test --grep "undo" --timeout=30000`

- [ ] **Fix redo functionality** - Redo button/Ctrl+Y should reapply. Verify: `npx playwright test --grep "redo" --timeout=30000`

---

## PHASE 9: FUNCTIONAL FIXES - Tables

- [ ] **Fix table insertion** - Insert table dialog and creation. Verify: `npx playwright test --grep "insert table" --timeout=30000`

- [ ] **Fix table cell navigation** - Click to select cells, type in cells. Verify: `npx playwright test --grep "table cell" --timeout=30000`

- [ ] **Fix table cell formatting** - Apply formatting to table cell content. Verify: `npx playwright test --grep "format table" --timeout=30000`

---

## PHASE 10: FUNCTIONAL FIXES - Text Editing

- [ ] **Fix basic text typing** - Characters appear correctly (not reversed). Verify: `npx playwright test --grep "type text" --timeout=30000`

- [ ] **Fix text selection** - Select text by dragging or keyboard. Verify: `npx playwright test --grep "select text" --timeout=30000`

- [ ] **Fix text deletion** - Backspace/Delete remove characters correctly. Verify: `npx playwright test --grep "delete" --timeout=30000`

- [ ] **Fix copy/paste** - Ctrl+C/Ctrl+V work correctly. Verify: `npx playwright test --grep "copy" --timeout=30000`

- [ ] **Fix Enter key** - Creates new paragraph. Verify: `npx playwright test --grep "new paragraph" --timeout=30000`

---

## PHASE 11: EDGE CASES & UNICODE

- [ ] **Fix unicode character handling** - Asian characters, emojis, special chars preserved. Verify: `npx playwright test --grep "unicode" --timeout=30000`

- [ ] **Fix rapid operations** - Quick typing, fast format toggles don't corrupt. Verify: `npx playwright test --grep "rapid" --timeout=30000`

- [ ] **Fix empty document operations** - Operations on empty doc don't crash. Verify: `npx playwright test --grep "empty document" --timeout=30000`

---

## PHASE 12: TOOLBAR STATE

- [ ] **Fix bold button state reflection** - Button shows active when cursor in bold text. Verify: `npx playwright test --grep "toolbar button reflects bold" --timeout=30000`

- [ ] **Fix italic button state reflection** - Verify: `npx playwright test --grep "toolbar button reflects italic" --timeout=30000`

- [ ] **Fix alignment button state reflection** - Shows which alignment is active. Verify: `npx playwright test --grep "alignment.*active" --timeout=30000`

- [ ] **Fix list button state reflection** - Shows when cursor in list. Verify: `npx playwright test --grep "bullet.*active" --timeout=30000`

---

## PHASE 13: VALIDATION - Test Suite Runs

- [ ] **Run formatting.spec.ts** - `npx playwright test tests/formatting.spec.ts --timeout=60000` - expect all pass

- [ ] **Run alignment.spec.ts** - `npx playwright test tests/alignment.spec.ts --timeout=60000` - expect all pass

- [ ] **Run lists.spec.ts** - `npx playwright test tests/lists.spec.ts --timeout=60000` - expect all pass

- [ ] **Run colors.spec.ts** - `npx playwright test tests/colors.spec.ts --timeout=60000` - expect all pass

- [ ] **Run fonts.spec.ts** - `npx playwright test tests/fonts.spec.ts --timeout=60000` - expect all pass

- [ ] **Run line-spacing.spec.ts** - `npx playwright test tests/line-spacing.spec.ts --timeout=60000` - expect all pass

- [ ] **Run paragraph-styles.spec.ts** - `npx playwright test tests/paragraph-styles.spec.ts --timeout=60000` - expect all pass

- [ ] **Run tables.spec.ts** - `npx playwright test tests/tables.spec.ts --timeout=60000` - expect all pass

- [ ] **Run text-editing.spec.ts** - `npx playwright test tests/text-editing.spec.ts --timeout=60000` - expect all pass

- [ ] **Run edge-cases.spec.ts** - `npx playwright test tests/edge-cases.spec.ts --timeout=60000` - expect all pass

- [ ] **Run toolbar-state.spec.ts** - `npx playwright test tests/toolbar-state.spec.ts --timeout=60000` - expect all pass

- [ ] **Run scenario-driven.spec.ts** - `npx playwright test tests/scenario-driven.spec.ts --timeout=60000` - expect all pass

---

## PHASE 14: FINAL VALIDATION

- [ ] **Run complete e2e suite** - `npx playwright test --timeout=60000` - capture full results

- [ ] **Document remaining failures** - If any tests still fail, create follow-up plan in `.ralph/05_remaining_fixes.md`

- [ ] **Update progress.txt** - Document what was learned and fixed

---

## Notes

- Task 1 (backwards text) is likely root cause of many failures - fix first
- Selector fixes (Phase 2-3) should be quick wins
- Functional fixes (Phase 4-11) may require deeper investigation
- Each task should be verified before moving to next
- If deeper issues found, document in progress.txt and adapt
