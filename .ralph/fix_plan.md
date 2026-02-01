# Ralph Fix Plan

## High Priority
- [x] Bun test runs with `bun test`
- [x] Test utilities created in `src/__tests__/utils/`
- [x] `loadFixture()` helper loads .docx from fixtures/
- [x] `assertValidDocx()` helper validates DOCX structure
- [x] At least 3 fixture files created: minimal.docx, formatted.docx, complex.docx
- [x] Sample test passes
- [ ] DocxParser class in src/docx/parser/DocxParser.ts
- [ ] DOCX → ProseMirror conversion (parse document.xml into PM nodes)
- [ ] ProseMirror → DOCX serialization (complete implementation)

## Medium Priority
- [ ] Round-trip testing
- [ ] Font size support in toolbar
- [ ] Font color support in toolbar
- [ ] Alignment support (paragraph level)
- [ ] Variable insertion with formatting inheritance

## Low Priority
- [ ] Highlight/background color support
- [ ] Table support (basic)
- [ ] List support (bullet, numbered)

## Completed
- [x] Project enabled for Ralph
- [x] package.json with dependencies: react, react-dom, prosemirror-*, jszip, tailwindcss, lucide-react
- [x] tsconfig.json with jsx: react-jsx, strict mode
- [x] tailwind.config.js configured
- [x] shadcn Button component initialized
- [x] index.html with #app mount point (in demo/)
- [x] src/main.tsx with React app shell (demo/main.tsx)
- [x] Library project structure created
- [x] `bun install` exits 0
- [x] `bun build` exits 0
- [x] Basic ProseMirror schema (doc, paragraph, text)
- [x] Basic marks defined (bold, italic, underline, strikethrough, fontSize, fontColor, highlight)
- [x] DocxEditor main component
- [x] Toolbar component with formatting buttons
- [x] FileLoader component with drag-and-drop
- [x] VariableInserter component
- [x] useDocxEditor hook
- [x] parseDocx utility (DOCX → DocxData)
- [x] serializeDocx utility (ProseMirror → XML)
- [x] exportDocx utility (DocxData → Blob)
- [x] tsup.config.ts for library build
- [x] AGENT.md updated with build commands
- [x] ProseMirror editor initializes in a React component
- [x] Basic schema with: doc, paragraph, text nodes
- [x] Editor accepts keyboard input
- [x] Editor content is accessible via EditorState
- [x] Clean React integration (useEffect for mount/unmount)
- [x] Bold mark (`<strong>`) with Mod-B shortcut
- [x] Italic mark (`<em>`) with Mod-I shortcut
- [x] Underline mark (`<u>`) with Mod-U shortcut
- [x] Marks apply to selected text (via toolbar buttons)
- [x] Marks toggle on/off correctly (with active state indication)
- [x] Multiple marks can combine (bold + italic)
- [x] src/editor/commands.ts with toggleBold, toggleItalic, toggleUnderline, isMarkActive

## Notes
- US-01 (Project Scaffold) is complete
- US-02 (ProseMirror Editor Setup) is complete - editor works with keyboard shortcuts
- US-03 (Basic Text Marks) is complete
- US-03b (Test Infrastructure) is complete - 11 tests passing
- Next: DocxParser class for DOCX → ProseMirror conversion
