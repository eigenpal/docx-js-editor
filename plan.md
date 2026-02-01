# Development Plan - EigenPal DOCX Editor

## User Stories

### US-01: Project scaffold
**Title:** Project scaffold: package.json, tsconfig.json, bun dev server, index.html entry
**Description:** Bootstrap the project. package.json with bun dev script serving index.html. tsconfig with JSX react. index.html mounts #app. src/main.tsx is the React entry rendering an empty <div id='app'>. This is a WYSIWYG editor — fonts, colors, styles, and layout must be preserved exactly as they appear in Word. All dependencies required for full fidelity must be included. bun install must succeed. bun build must succeed with zero errors.
**Acceptance Criteria:**
- package.json exists with correct dependencies: react, react-dom, @harbour-enterprises/superdoc, docxtemplater, pizzip
- package.json includes any peer or optional deps that SuperDoc requires for font rendering
- tsconfig.json exists with jsx: react-jsx
- index.html exists and loads the bundled JS
- src/main.tsx exists, imports React, renders into #app
- bun install exits 0
- bun build exits 0
**passes:** true

---

### US-02: DOCX file loader
**Title:** DOCX file loader: file input + drag-and-drop, loads raw ArrayBuffer into state
**Description:** A <FileLoader /> component. Renders a file <input accept='.docx'> and a drag-and-drop zone. On file select or drop, reads the File into an ArrayBuffer and stores it in React state (lifted up to App via props/callback). Shows filename once loaded. No processing yet — just raw buffer in state.
**Acceptance Criteria:**
- FileLoader component exists in src/components/FileLoader.tsx
- Renders an <input type='file' accept='.docx'>
- Has a drag-and-drop zone that accepts .docx files
- On file selection or drop, reads file as ArrayBuffer via FileReader
- Calls a callback prop (e.g. onFileLoaded) with the File object and ArrayBuffer
- Displays the loaded filename in the UI
- bun build exits 0
**passes:** true

---

### US-03: SuperDoc viewer
**Title:** SuperDoc viewer: WYSIWYG render of DOCX with full formatting fidelity
**Description:** A <DocxViewer /> component. Receives a File object (or ArrayBuffer) as a prop. Mounts SuperDoc pointed at that file. This is a WYSIWYG editor — the rendered output must be pixel-faithful to how the document looks in Microsoft Word. That means: custom fonts, theme colors, style definitions, headers/footers, table borders/shading, character-level formatting must all render correctly. Import the FULL superdoc CSS. On re-render, destroy the SuperDoc instance cleanly and re-mount.
**Acceptance Criteria:**
- DocxViewer component exists in src/components/DocxViewer.tsx
- Imports and initializes SuperDoc from @harbour-enterprises/superdoc
- Imports the FULL superdoc CSS
- SuperDoc is initialized with documentMode: 'editing'
- Fonts, theme colors, styles, headers/footers, tables, character formatting all render
- Renders using SuperDoc's paginated layout
- Shows a placeholder when no file is loaded
- Cleans up SuperDoc instance properly on unmount or when document changes
- bun build exits 0
**passes:** false

---

### US-04: Template variable panel
**Title:** Template variable panel: UI for defining key/value pairs
**Description:** A <TemplatePanel /> component. Renders a small panel with: an input for variable name, an input for value, an 'Add' button that pushes to a list, and an 'Apply' button that triggers substitution. Shows the current list of variables as simple rows with a remove button on each. State is local to this component; the variable map is passed up via callback on Apply. Minimal styling — functional, not pretty.
**Acceptance Criteria:**
- TemplatePanel component exists in src/components/TemplatePanel.tsx
- Has two text inputs: variable name and value
- Add button appends to a local list of variables
- Each variable row has a remove button
- Apply button calls a callback prop (e.g. onApply) with the full variables map
- bun build exits 0
**passes:** false

---

### US-05: docxtemplater integration
**Title:** docxtemplater integration: process raw DOCX buffer with variables, produce new DOCX buffer — preserve all styles
**Description:** A utility function processTemplate(rawBuffer: ArrayBuffer, variables: Record<string, string>): ArrayBuffer. Uses PizZip to parse the raw DOCX buffer. Passes the PizZip instance to docxtemplater. Calls .render(variables). Generates a new DOCX buffer. CRITICAL: docxtemplater must NOT touch styles.xml, theme1.xml, fonts, or any .rels files.
**Acceptance Criteria:**
- src/utils/processTemplate.ts exists
- Exports a function processTemplate(rawBuffer: ArrayBuffer, variables: Record<string, string>): ArrayBuffer
- Internally uses PizZip to load the buffer
- Passes PizZip instance to Docxtemplater
- Calls .render(variables)
- Generates and returns a new ArrayBuffer via pizzip.generate({ type: 'arraybuffer' })
- The output DOCX zip still contains all original files
- Wrapped in try/catch with a descriptive error thrown on failure
- bun build exits 0
**passes:** false

---

### US-06: Wire everything together
**Title:** Wire everything together: App orchestrates load → template → render cycle with full fidelity preserved
**Description:** The App component (src/main.tsx) holds state: rawBuffer (original file), processedBuffer (after template run), variables map. Renders FileLoader, TemplatePanel, and DocxViewer. Flow: user loads a .docx → rawBuffer is set → DocxViewer renders it. User adds variables and clicks Apply → processTemplate runs → processedBuffer is set → DocxViewer re-renders. Fidelity must be preserved through the round-trip.
**Acceptance Criteria:**
- App state holds: rawBuffer, processedBuffer, variables
- FileLoader updates rawBuffer on file load
- DocxViewer renders processedBuffer if set, otherwise rawBuffer
- TemplatePanel Apply triggers processTemplate(rawBuffer, variables)
- After Apply, the rendered document preserves all original formatting
- Errors from processTemplate are caught and displayed in the UI
- Full flow works end-to-end
- bun build exits 0
**passes:** false
