# Ralph Loop — Eigenpal DOCX Editor (Optimized)

## Your job

You are running inside a Ralph autonomous loop. Each iteration you must:

1. Read the current plan file in `.ralph/` (highest numbered `##_*.md` file).
2. Find the **first** unchecked task (`- [ ]`).
3. If all tasks are checked, output the exit signal and stop.
4. Implement ONLY that one task.
5. Run the **fast verify**: `bun run typecheck` (catches most errors in <5s)
6. Run **targeted tests only** - see "Test Strategy" below
7. If tests pass, mark task done, commit, update progress.txt
8. Output RALPH_STATUS block.

```
RALPH_STATUS: {
  "status": "in_progress" | "complete",
  "current_task": "<task title>" | "none",
  "exit_signal": false | true
}
```

---

## SPEED OPTIMIZATIONS — Read This First

### Fast Verification Cycle

**DO NOT run the full test suite.** Run targeted tests only:

```bash
# Step 1: Type check (fast, catches 90% of issues)
bun run typecheck

# Step 2: Run ONLY the relevant test file(s)
npx playwright test tests/<relevant>.spec.ts --timeout=30000 --workers=4

# Step 3: If fixing a specific test, use --grep
npx playwright test --grep "test name pattern" --timeout=30000
```

### Test File Mapping

| Feature Area          | Test File                  | Quick Verify Pattern    |
| --------------------- | -------------------------- | ----------------------- |
| Bold/Italic/Underline | `formatting.spec.ts`       | `--grep "apply bold"`   |
| Alignment             | `alignment.spec.ts`        | `--grep "align text"`   |
| Lists                 | `lists.spec.ts`            | `--grep "bullet list"`  |
| Colors                | `colors.spec.ts`           | `--grep "text color"`   |
| Fonts                 | `fonts.spec.ts`            | `--grep "font family"`  |
| Enter/Paragraphs      | `text-editing.spec.ts`     | `--grep "Enter"`        |
| Undo/Redo             | `scenario-driven.spec.ts`  | `--grep "undo"`         |
| Line spacing          | `line-spacing.spec.ts`     | `--grep "line spacing"` |
| Paragraph styles      | `paragraph-styles.spec.ts` | `--grep "Heading"`      |
| Toolbar state         | `toolbar-state.spec.ts`    | `--grep "toolbar"`      |

### Avoid Hanging

- **Never run all 500+ tests at once** unless explicitly validating final results
- Use `--timeout=30000` (30s max per test)
- Use `--workers=4` for parallel execution
- If a command takes >60s, Ctrl+C and retry with narrower scope
- Avoid `git log` with large outputs; use `--oneline -10`

---

## SuperDoc Reference — ⚠️ LEGAL: CLEAN ROOM ONLY ⚠️

### Primary Reference: SuperDoc (`reference/superdoc`)

When stuck on implementation, **first check SuperDoc** — it's a working OOXML editor:

```bash
# Understand repo structure
ls reference/superdoc/packages/editor/src/

# Read specific files for concepts
cat reference/superdoc/packages/editor/src/[relevant-file].ts | head -200

# Search for how something is handled
grep -r "selectionChanged" reference/superdoc/packages --include="*.ts" -l
```

**Use SuperDoc to understand:**

- How OOXML concepts are implemented in practice
- Edge cases that specs don't make clear
- DOM APIs and event sequences used
- Architecture patterns for editor components

### ⚠️ CRITICAL LEGAL RULES — AGPL-3.0 COPYLEFT ⚠️

SuperDoc is licensed under **AGPL-3.0**, a strong copyleft license. If you copy ANY code:

- The ENTIRE EigenPal project becomes AGPL-3.0
- You MUST open-source all code
- This is INCOMPATIBLE with commercial use for banks

**CLEAN ROOM IMPLEMENTATION REQUIRED:**

1. ❌ **NEVER copy-paste code** — not even a single function
2. ❌ **NEVER copy variable names, function signatures, or class structures**
3. ❌ **NEVER copy comments or documentation text**
4. ✅ **DO read to understand the CONCEPT**
5. ✅ **DO close the file before writing**
6. ✅ **DO write your own implementation from scratch**

**The process:**

```
1. READ SuperDoc to understand the concept
2. CLOSE the file
3. WRITE your own implementation from memory/understanding
```

**✅ GOOD — Clean room approach:**

```
I read SuperDoc and understand that selection across runs requires
checking nodeType to handle Element vs Text nodes differently.

My implementation (written fresh):
function getSelectionOffset(node: Node): number {
  // My own logic based on understanding...
}
```

**❌ BAD — Copyright infringement:**

```typescript
// Based on reference/superdoc/packages/editor/src/selection.ts
function calculateOffset(node, offset) {
  // Any code that resembles SuperDoc
}
```

---

## ECMA-376 Official Spec — Secondary Reference

The DOCX format is standardized as ECMA-376 / ISO-29500. Local reference docs:

```bash
# Quick reference
reference/quick-ref/wordprocessingml.md   # Paragraphs, runs, formatting
reference/quick-ref/themes-colors.md      # Theme colors, fonts, tints

# XML Schemas
reference/ecma-376/part1/schemas/wml.xsd      # WordprocessingML
reference/ecma-376/part1/schemas/dml-main.xsd # DrawingML (themes, colors)

# Full spec PDFs (5000+ pages)
reference/ecma-376/part1/*.pdf
```

**Online resources:**

- ECMA-376: https://ecma-international.org/publications-and-standards/standards/ecma-376/
- Microsoft Open Specs: https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oe376/

**When in doubt about legal safety:** The ECMA-376 spec is always safe to reference directly.

---

## WYSIWYG Fidelity — Hard Rule

This is a WYSIWYG editor. Output must look identical to Microsoft Word.

**Must preserve:**

- **Fonts:** Custom/embedded fonts render correctly
- **Theme colors:** Theme slots (`dk1`, `lt1`, `accent1`) resolve to correct colors
- **Styles:** styles.xml definitions apply (headings, body, character styles)
- **Character formatting:** Bold, italic, font size/family/color, highlight, underline, strikethrough
- **Tables:** Borders, cell shading, merged cells
- **Headers/footers:** Render on each page
- **Section layout:** Margins, page size, orientation

---

## Known Bugs to Fix (Multi-Selection Issue)

**Multi-selection with different formatting:**

- User cannot select text spanning multiple runs with different formatting
- When selecting across bold → normal → italic, the selection breaks
- This is likely in `getSelectionRange()` or selection restoration logic
- **Reference:** ECMA-376 Part 1 for run structure, DOM Selection API spec for browser behavior

---

## Verify Commands

**Fast cycle (use this 95% of the time):**

```bash
bun run typecheck && npx playwright test --grep "<pattern>" --timeout=30000 --workers=4
```

**Single test file:**

```bash
bun run typecheck && npx playwright test tests/formatting.spec.ts --timeout=30000
```

**Full suite (only for final validation):**

```bash
bun run typecheck && npx playwright test --timeout=60000 --workers=4
```

---

## Rules

- **Screenshots:** Save to `screenshots/` folder
- Work on exactly ONE task per iteration
- Do NOT modify other tasks in the plan
- Do NOT delete files from previous tasks unless required
- Client-side only. No backend.
- No collaboration, comments, tracked changes, or PDF export

---

## Project Context

Minimal Bun + React (TSX) app for EigenPal:

1. **Display DOCX** — render with full WYSIWYG fidelity per ECMA-376 spec
2. **Insert docxtemplater variables** — `{{variable}}` mappings with live preview

Target users: Non-technical clients at European banks/insurance companies.

---

## Commit Message Format

```bash
git commit -m "$(cat <<'EOF'
feat: <task title>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## When Stuck

1. **Type error?** Read the actual types, don't guess
2. **Test failing?** Run with `--debug` and check console output
3. **Selection bug?** Add `console.log` in `getSelectionRange()` to trace
4. **Implementation question?** Check `reference/superdoc` first (read → close → write fresh!)
5. **OOXML spec question?** Check `reference/quick-ref/` or ECMA-376 schemas
6. **Timeout?** Kill command, narrow test scope, retry
