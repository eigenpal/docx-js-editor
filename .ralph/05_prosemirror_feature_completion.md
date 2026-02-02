# Phase 5: ProseMirror Feature Completion

## Overview

Complete the ProseMirror migration by implementing missing features:

- Style resolution (paragraph styles like Heading 1, Title, etc.)
- Table support
- Proper tab layout
- Full toolbar integration

## Current State

The ProseMirror editor is functional with basic formatting (bold, italic, underline, colors, fonts, alignment, lists). However:

- **Paragraph styles** - `styleId` is saved but not visually applied
- **Tables** - Skipped entirely in conversion
- **Tabs** - Fixed width instead of dynamic tab stops
- **Line spacing** - Connected but needs style defaults

## Reference

- **WYSIWYG Editor style engine**: `reference/wysiwyg-editor/packages/layout-engine/style-engine/`
- **WYSIWYG Editor table handling**: `reference/wysiwyg-editor/packages/super-editor/src/extensions/`
- **Our styles parser**: `src/docx/styleParser.ts`

---

## Tasks

### Phase 5.1: Style Resolution

- [x] **Task 1: Create style resolver utility**
  - Create `src/prosemirror/styles/styleResolver.ts`
  - Load styles from `document.package.styles`
  - Resolve style chain (basedOn inheritance)
  - Merge paragraph and run properties
  - **Verify**: Unit test that resolves Heading1 → Normal chain

- [x] **Task 2: Apply styles when rendering paragraphs**
  - Update `paragraphAttrsToDOMStyle` in `nodes.ts` to accept resolved styles
  - Pass document styles to ProseMirror schema or use CSS classes
  - When `styleId` is set, apply the style's formatting
  - **Verify**: Load styled-content.docx, headings should be larger/bolder

- [x] **Task 3: Apply styles when changing via toolbar**
  - When `applyStyle` command runs, also apply the style's formatting attrs
  - Update paragraph attrs with style's alignment, spacing, indentation
  - **Verify**: Select text, change to Heading 1, text should become larger

- [x] **Task 4: Sync style picker with current paragraph**
  - Extract styleId from current paragraph in selection state
  - Update toolbar to show current style
  - **Verify**: Click in Heading 1 paragraph, toolbar shows "Heading 1"

### Phase 5.2: Table Support

- [x] **Task 5: Add table nodes to schema**
  - Create `table`, `tableRow`, `tableCell` nodes in `nodes.ts`
  - Define proper content models and attributes
  - Reference: WYSIWYG Editor table nodes
  - **Verify**: `bun run typecheck` passes

- [x] **Task 6: Convert tables in toProseDoc**
  - Handle `block.type === 'table'` in conversion
  - Convert rows and cells with their formatting
  - Preserve cell spans (colspan, rowspan)
  - **Verify**: Load with-tables.docx, tables should render

- [x] **Task 7: Convert tables back in fromProseDoc**
  - Convert ProseMirror table nodes back to Document tables
  - Preserve all table formatting
  - **Verify**: Load table doc, edit text, save, reload - table intact

- [x] **Task 8: Add table CSS styling**
  - Add table styles to `editor.css`
  - Handle borders, cell padding, alignment
  - **Verify**: Tables render with proper borders and spacing

- [ ] **Task 9: Basic table editing**
  - Enable cursor navigation in tables
  - Tab to move between cells
  - **Verify**: Can click in cells and type

### Phase 5.3: Tab Layout

- [ ] **Task 10: Create tab calculation utility**
  - Create `src/prosemirror/utils/tabCalculator.ts`
  - Port logic from WYSIWYG Editor's `tabs.ts` (clean room)
  - Compute tab width based on position and tab stops
  - **Verify**: Unit test for tab width calculation

- [ ] **Task 11: Render tabs with dynamic width**
  - Update tab node to calculate width based on position
  - Pass tab stops from paragraph attrs
  - Use inline style for width
  - **Verify**: Load doc with tabs, content aligns to tab stops

### Phase 5.4: Full Toolbar Integration

- [ ] **Task 12: Connect superscript/subscript**
  - Verify toggleSuperscript/toggleSubscript work
  - **Verify**: Apply superscript, text renders raised

- [ ] **Task 13: Fix font family application**
  - Ensure setFontFamily applies to selection
  - Font should change visually
  - **Verify**: Select text, change font to Georgia, renders in Georgia

- [ ] **Task 14: Fix font size application**
  - Ensure setFontSize applies to selection
  - **Verify**: Select text, change to 24pt, text is larger

- [ ] **Task 15: Verify all toolbar buttons work**
  - Test each button systematically
  - Fix any that don't work
  - **Verify**: Run formatting.spec.ts, alignment.spec.ts, lists.spec.ts

### Phase 5.5: Final Integration & Testing

- [ ] **Task 16: Run full E2E test suite**
  - `npx playwright test --timeout=60000`
  - Fix any failures
  - **Verify**: All tests pass (or document known limitations)

- [ ] **Task 17: Test with real DOCX files**
  - Load the Slovak template document
  - Verify rendering matches Word
  - Test editing and saving
  - **Verify**: Document renders without squashed text or missing content

- [ ] **Task 18: Update CLAUDE.md with new architecture**
  - Document ProseMirror integration
  - List supported/unsupported features
  - **Verify**: CLAUDE.md is accurate

---

## Validation Commands

```bash
# Type check
bun run typecheck

# Single test file
npx playwright test tests/formatting.spec.ts --timeout=30000

# Full test suite
npx playwright test --timeout=60000 --workers=4

# Style resolution test (after Task 1)
bun test src/prosemirror/styles/styleResolver.test.ts

# Table rendering (after Task 6)
# Manual: Load with-tables.docx, verify tables render

# Tab calculation test (after Task 10)
bun test src/prosemirror/utils/tabCalculator.test.ts
```

---

## Files to Create/Modify

| File                                           | Action                                               |
| ---------------------------------------------- | ---------------------------------------------------- |
| `src/prosemirror/styles/styleResolver.ts`      | Create - style chain resolution                      |
| `src/prosemirror/styles/styleResolver.test.ts` | Create - unit tests                                  |
| `src/prosemirror/schema/nodes.ts`              | Modify - add table nodes, update paragraph rendering |
| `src/prosemirror/conversion/toProseDoc.ts`     | Modify - handle tables                               |
| `src/prosemirror/conversion/fromProseDoc.ts`   | Modify - convert tables back                         |
| `src/prosemirror/editor.css`                   | Modify - add table styles                            |
| `src/prosemirror/utils/tabCalculator.ts`       | Create - tab width calculation                       |
| `src/prosemirror/ProseMirrorEditor.tsx`        | Modify - pass styles context                         |
| `src/components/DocxEditor.tsx`                | Modify - pass styles to editor                       |

---

## Success Criteria

1. **Paragraph styles work visually** - Selecting "Heading 1" makes text large and bold
2. **Tables render and edit** - Can see tables, click in cells, type
3. **Tabs align correctly** - Tab-separated content aligns to tab stops
4. **All toolbar buttons functional** - Every button does something visible
5. **E2E tests pass** - formatting, alignment, lists tests all green
6. **Real documents render correctly** - Slovak template looks like Word

---

## Notes

- Focus on **visual correctness** over perfect OOXML fidelity
- Tables can be read-only initially if editing is complex
- Tab layout can use simplified calculation (not full OOXML spec)
- Check WYSIWYG Editor for concepts, but write clean-room implementations
