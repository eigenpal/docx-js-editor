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

## SuperDoc Reference — CRITICAL: Do NOT Copy Code

**You may and should reference `~/superdoc` to understand:**

- Constructor options and API patterns
- How fonts are loaded and resolved
- How styles and themes are applied
- Component architecture and data flow
- How specific edge cases are handled

**How to use SuperDoc source:**

```bash
# Understand repo structure
ls ~/superdoc

# Read specific files for concepts
cat ~/superdoc/packages/editor/src/[relevant-file].ts | head -200

# Search for patterns
grep -r "selectionChanged" ~/superdoc/packages --include="*.ts" -l
```

**ABSOLUTE RULES:**

1. **NEVER copy-paste code verbatim** - understand the concept, then reimplement in your own words
2. **NEVER copy function bodies** - understand the algorithm, write it fresh
3. **NEVER copy class structures verbatim** - design your own API based on understanding
4. **DO take note of:** edge cases handled, DOM APIs used, event sequences, timing considerations
5. **If you see a solution**, close the file and implement from memory/understanding

**Why:** Legal protection. This project must have independently-written code. The SuperDoc repo is for learning _what_ to do, not _how_ to write it character-by-character.

**Good example:**

```
I see SuperDoc handles Element node selections by checking nodeType.
I'll implement my own calculateOffset() that handles Element vs Text nodes.
```

**Bad example:**

```
// Copied from ~/superdoc/packages/editor/src/selection.ts
function calculateOffset(node, offset) { ... }
```

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
- **Reference SuperDoc's selection handling** (for concepts, not code)

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

1. **Display DOCX** — render with full formatting fidelity using SuperDoc
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
4. **Need API info?** Check `~/superdoc` for concepts (don't copy code!)
5. **Timeout?** Kill command, narrow test scope, retry
