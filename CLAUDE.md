# Ralph Loop — Eigenpal DOCX Editor

## Your job

You are running inside a Ralph autonomous loop (frankbria/ralph-claude-code). Each iteration you must:

1. Read `.ralph/fix_plan.md` to see the task checklist.
2. Find the **first** unchecked task (`- [ ]`).
3. If all tasks are checked, output the exit signal (see below) and stop.
4. Implement ONLY that one task. Do not touch other tasks.
5. Run the verify command: `bun install && bun build ./src/main.tsx --outdir ./dist --loader:.css=css`
6. If the build passes, mark the task as done (`- [x]`) in `.ralph/fix_plan.md`, commit everything with a message like `feat: <task title>`, and update `progress.txt` with any learnings.
7. If the build fails, fix the errors and retry until it passes. Do NOT move on.
8. At the end of your response, always output a RALPH_STATUS block:

```
RALPH_STATUS: {
  "status": "in_progress",
  "current_task": "<task title>",
  "exit_signal": false
}
```

If ALL tasks are complete, output:

```
RALPH_STATUS: {
  "status": "complete",
  "current_task": "none",
  "exit_signal": true
}
```

## WYSIWYG Fidelity — Hard Rule (applies to ALL stories)

This is a WYSIWYG editor. The output must look identical to the document in Microsoft Word. This is non-negotiable and applies across every story, not just US-03.

**What must be preserved:**
- **Fonts:** Custom and embedded fonts referenced in the DOCX must render. If SuperDoc has a font-loading config option, use it. If fonts are embedded in the DOCX zip, they must not be dropped.
- **Theme colors:** The DOCX contains a theme (theme1.xml) that defines the color palette. Text and shape colors that reference theme slots (e.g. `dk1`, `lt1`, `accent1`) must resolve to the correct colors.
- **Styles:** The DOCX contains style definitions in styles.xml (heading styles, body text styles, named character styles). These must apply. Do not rely only on inline formatting.
- **Character formatting:** Bold, italic, font size, font family, font color, highlight color, underline, strikethrough — all must render.
- **Tables:** Borders, cell shading, cell styles, merged cells must all render.
- **Headers and footers:** Must render on each page.
- **Section layout:** Page margins, page size, orientation must apply.
- **Template round-trip:** When docxtemplater processes the DOCX, it must ONLY substitute text in document.xml. It must NOT touch or drop styles.xml, theme1.xml, fontTable.xml, embeddings, or any .rels file. The output zip must contain all original files. Fidelity must survive the full load → template → re-render cycle.

**How to verify your assumptions:**
- SuperDoc source is available locally at `~/superdoc`. This is the authoritative reference — always investigate there first. Start with `ls ~/superdoc` to understand the repo structure, then read the README, then dig into source files as needed. Look specifically for: constructor options, font loading/resolution config, style/theme application, how documents are passed in, how to destroy an instance. Do NOT rely on node_modules or guesswork.
- Before writing docxtemplater code, confirm it only modifies document.xml by checking what PizZip contains before and after `.render()`. Read `node_modules/docxtemplater/README.md` and `node_modules/pizzip/README.md`.
- Do not guess. Do not assume defaults are correct. Read the source.

## Rules

- Work on exactly ONE task per iteration. Do not implement multiple tasks.
- Do NOT modify other tasks in `.ralph/fix_plan.md`. Only check off the task you completed.
- Do NOT delete or rewrite files from previous tasks unless the current task explicitly requires it.
- If you need to know how SuperDoc's API actually works (constructor options, how to pass a document, how to destroy an instance, font loading, style resolution), investigate `~/superdoc`. Start with `ls ~/superdoc`, read the README, then dig into source. Do not guess.
- If you need to know how docxtemplater + PizZip work together, check: `cat node_modules/docxtemplater/README.md` and `cat node_modules/pizzip/README.md`. Do not guess.
- Client-side only. No backend. No server-side processing. No WebSockets.
- No collaboration, no comments, no tracked changes, no PDF export. Minimal UI.
- CSS: import SuperDoc's CSS. For everything else, inline styles or a single minimal `.css` file is fine.

## Project context

This is a minimal Bun + React (TSX) app for EigenPal. Two features only:

1. **Display a DOCX** — load a `.docx` file and render it with full formatting fidelity using SuperDoc.
2. **Insert docxtemplater variables** — define `{{variable_name}}` mappings, run docxtemplater on the raw DOCX buffer, and re-render the result.

The target users are non-technical clients at European banks/insurance companies. The DOCX files contain docxtemplater template tags like `{{client_name}}`, `{{contract_date}}`. The app lets them fill in values and see the rendered document update live.

## Verify command

```
bun install && bun build ./src/main.tsx --outdir ./dist --loader:.css=css
```

Build must exit 0. That is the only success gate.
