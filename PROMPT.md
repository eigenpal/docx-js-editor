@plan.md @activity.md @CLAUDE.md

We are building a **complete WYSIWYG DOCX editor** with an exploratory approach.

**CRITICAL:** No SuperDoc imports. Write all code from scratch.

## Reference Implementation: ~/superdoc

**ALWAYS reference ~/superdoc when unsure how to implement something.** This is a working DOCX editor you can learn from:

```
~/superdoc/
├── packages/
│   ├── super-editor/      # Main editor, DOCX import/export
│   ├── layout-engine/     # Page layout, line breaking
│   ├── style-engine/      # Style cascade resolution
│   └── ...
├── shared/
│   └── font-utils/        # Font handling
└── README.md
```

**How to use it:**
1. `ls ~/superdoc/packages` - see package structure
2. `cat ~/superdoc/packages/super-editor/src/...` - read implementation
3. Look for: parsers, converters, renderers, layout logic

**Learn from SuperDoc, but write your own code.** Understand their approach, then implement it yourself.

## What We're Building

A full-featured DOCX editor matching Microsoft Word fidelity:

**Document Elements:**
- All text formatting (bold, italic, underline, strike, super/subscript, caps, highlight, colors)
- All paragraph formatting (alignment, spacing, indent, borders, shading, tabs)
- Tables, images, shapes, text boxes
- Hyperlinks, bookmarks, fields (page numbers)
- Footnotes, lists, headers/footers
- Page layout with margins and columns

**Editor UI:**
- Formatting toolbar with all controls
- Font/size/color/style pickers
- Find/replace, zoom
- Table and image editing
- Copy/paste, undo/redo

**Agent/AI:**
- DocumentAgent API for programmatic editing
- Right-click context menu with AI actions
- Template variable substitution

## Your Task

1. Read activity.md for progress and discoveries
2. Find FIRST `passes: false` in plan.md (91 tasks total)
3. Work on ONE task only
4. **Explore DOCX structure** when implementing parsers - document findings in activity.md
5. Verify build:
   ```
   bun install && bun build ./src/main.tsx --outdir ./dist --loader:.css=css
   ```

6. **Run Playwright visual tests** (for UI-related tasks):
   ```bash
   # Take screenshots and verify no JS errors
   bun run test:visual
   ```
   - Screenshots saved to `screenshots/` folder
   - Check for JavaScript errors
   - Verify components render correctly
   - If tests fail, fix the issues before proceeding

7. If build AND tests pass:
   - Update `passes: false` → `passes: true`
   - Add progress entry to activity.md (include screenshot results if relevant)
   - Document any OOXML discoveries
   - **ALWAYS COMMIT after each task:**
     ```bash
     git add -A && git commit -m "feat: US-XX description"
     ```
   - **Do NOT skip the commit step** - this is how we track progress

## Playwright Visual Testing

**For any task involving UI/rendering, run Playwright tests:**

```bash
# Quick visual test - takes screenshots, checks for errors
bun run test:visual

# Full e2e test suite
bun run test:e2e
```

**What Playwright checks:**
- Page loads without JavaScript errors
- Components render correctly
- Screenshots captured for visual verification
- Saves to `screenshots/` folder

**When to run Playwright:**
- After implementing any rendering component (US-32 to US-49)
- After implementing editor features (US-55 to US-73)
- After UI changes
- When debugging visual issues

## When Stuck: Check SuperDoc

If unsure how to implement a feature:

1. **Find the relevant code:**
   ```bash
   # Search for keywords
   grep -r "hyperlink" ~/superdoc/packages/super-editor/src/
   grep -r "parseTable" ~/superdoc/packages/
   ```

2. **Read the implementation:**
   ```bash
   cat ~/superdoc/packages/super-editor/src/core/converters/v2/importer/...
   ```

3. **Understand the approach, then write your own code**

**Key SuperDoc locations:**
- DOCX parsing: `~/superdoc/packages/super-editor/src/core/converters/`
- Style resolution: `~/superdoc/packages/style-engine/src/`
- Layout: `~/superdoc/packages/layout-engine/`
- Font handling: `~/superdoc/shared/font-utils/`

---

## Use Subagents for Discovery & Research

**IMPORTANT:** Use the Task tool with subagents for exploration and research tasks. This keeps the main context clean and allows thorough investigation.

**When to use subagents:**

1. **Exploring SuperDoc implementation:**
   ```
   Task(subagent_type="Explore", prompt="Investigate how ~/superdoc handles table parsing. Look at the tableParser, cell merging, borders. Summarize the approach.")
   ```

2. **Understanding OOXML structure:**
   ```
   Task(subagent_type="Explore", prompt="Explore the structure of word/numbering.xml in fixtures/sample.docx. Document the XML structure for lists.")
   ```

3. **Researching a specific feature:**
   ```
   Task(subagent_type="Explore", prompt="How does SuperDoc handle theme color resolution? Find the relevant code in ~/superdoc and explain the approach.")
   ```

4. **Comparing implementations:**
   ```
   Task(subagent_type="Explore", prompt="Compare how ~/superdoc handles hyperlinks vs bookmarks. What's the difference in parsing and rendering?")
   ```

**Benefits:**
- Thorough exploration without context bloat
- Agent can read multiple files and synthesize findings
- Returns concise summary you can act on
- Keeps main conversation focused on implementation

---

## Handling Discoveries

When you find unexpected DOCX structure:
```markdown
## Discoveries

### [Date] - Finding title
Description of what you found and how you handled it.
```

## Rules

- ONE task per iteration
- Document discoveries in activity.md
- Add new tasks to plan if needed (discovery-driven)
- Build MUST exit 0
- **COMMIT after EVERY completed task** - never skip this step

When ALL 91 tasks have `passes: true`:
<promise>COMPLETE</promise>
