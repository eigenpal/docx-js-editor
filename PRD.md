# Product Requirements Document: EigenPal Template Editor

## Overview

| Field | Value |
|-------|-------|
| **Package Name** | `@eigenpal/docx-editor` |
| **Language** | TypeScript |
| **Framework** | React 18+ |
| **Build Tool** | Bun (dev) / tsup (library build) |
| **Target Users** | Non-technical clients at European banks/insurance companies |
| **Distribution** | npm package |

## Package Distribution

### Installation

```bash
npm install @eigenpal/docx-editor
# or
bun add @eigenpal/docx-editor
```

### Usage

```tsx
import { DocxEditor } from '@eigenpal/docx-editor';
import '@eigenpal/docx-editor/styles.css';

function App() {
  const handleExport = (blob: Blob) => {
    // Save or upload the exported DOCX
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.docx';
    a.click();
  };

  return (
    <DocxEditor
      onExport={handleExport}
      // Optional: load initial document
      initialFile={file}
      // Optional: customize toolbar
      toolbar={{
        bold: true,
        italic: true,
        underline: true,
        fontSize: true,
        color: true,
        alignment: true,
        insertVariable: true,
      }}
    />
  );
}
```

### Exports

```tsx
// Main component
export { DocxEditor } from './components/DocxEditor';

// Individual components (for custom layouts)
export { Toolbar } from './components/Toolbar';
export { Editor } from './components/Editor';
export { FileLoader } from './components/FileLoader';
export { VariableInserter } from './components/VariableInserter';

// Hooks
export { useDocxEditor } from './hooks/useDocxEditor';

// Utilities
export { parseDocx } from './docx/parser';
export { serializeDocx } from './docx/serializer';
export { exportDocx } from './docx/exporter';

// Types
export type { DocxEditorProps, ToolbarConfig, DocxData } from './types';
```

### Component API

```tsx
interface DocxEditorProps {
  // Document
  initialFile?: File | Blob | ArrayBuffer;

  // Callbacks
  onExport?: (blob: Blob, filename: string) => void;
  onChange?: (hasChanges: boolean) => void;
  onLoad?: (data: DocxData) => void;
  onError?: (error: Error) => void;

  // Toolbar configuration
  toolbar?: ToolbarConfig | boolean;  // true = all, false = none

  // Styling
  className?: string;
  style?: React.CSSProperties;

  // Editor options
  readOnly?: boolean;
  placeholder?: string;

  // Variable insertion
  variablePrefix?: string;  // default: '{'
  variableSuffix?: string;  // default: '}'
  suggestedVariables?: string[];  // autocomplete suggestions
}

interface ToolbarConfig {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: boolean;
  fontColor?: boolean;
  highlight?: boolean;
  alignment?: boolean;
  insertVariable?: boolean;
  export?: boolean;
  load?: boolean;
}
```

## Product Description

A browser-based DOCX template editor built from scratch. Users can load existing DOCX files, edit them with a familiar toolbar interface, insert template variables (`{variable_name}`), and export the result as a new DOCX file.

**Primary use case:** Clients create or modify document templates by adding `{placeholder}` variables that will later be filled programmatically via docxtemplater.

### Template Syntax (docxtemplater)

The editor supports docxtemplater syntax:

| Syntax | Purpose | Example |
|--------|---------|---------|
| `{variable}` | Simple variable | `{date}`, `{fullName}` |
| `{#list}...{/list}` | Loop (v2) | `{#shareholders}...{/shareholders}` |
| `{#condition}...{/condition}` | Conditional (v2) | `{#hasSignature}...{/hasSignature}` |

**v1 Scope:** Simple `{variable}` insertion only. Loop/conditional syntax will be preserved but not editable.

### Core Features

1. **Load DOCX** — Import an existing .docx file via file picker or drag-and-drop
2. **WYSIWYG Editing** — Edit document content with formatting (bold, italic, fonts, colors, etc.)
3. **Toolbar** — Standard formatting controls at the top of the editor
4. **Insert Template Variable** — "+" button opens a quick input to insert `{variable_name}` at cursor, styled to match surrounding text
5. **Export DOCX** — Save the edited document back to .docx format with all formatting preserved

---

## Technical Architecture

We are building our own DOCX editing engine. The architecture draws inspiration from open-source document editors but is our own original implementation.

### Core Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Editing Framework** | ProseMirror | Rich text editing engine (MIT licensed, widely used) |
| **DOCX Handling** | JSZip | Parse/create DOCX files (which are ZIP archives) |
| **XML Parsing** | Native DOMParser + XMLSerializer | Parse DOCX XML content |
| **UI Components** | shadcn/ui + Tailwind CSS | Toolbar, buttons, popovers |
| **Icons** | lucide-react | Toolbar icons |
| **Framework** | React + TypeScript | UI layer |
| **Build** | Bun | Fast bundling and dev server |

### DOCX File Structure (Background)

A `.docx` file is a ZIP archive containing XML files:

```
docx.zip/
├── [Content_Types].xml          # Manifest of content types
├── _rels/.rels                  # Root relationships
├── word/
│   ├── document.xml             # Main document content
│   ├── styles.xml               # Style definitions
│   ├── fontTable.xml            # Fonts used
│   ├── settings.xml             # Document settings
│   ├── theme/
│   │   └── theme1.xml           # Theme colors and fonts
│   ├── media/                   # Images (if any)
│   └── _rels/
│       └── document.xml.rels    # Document relationships
└── docProps/
    ├── core.xml                 # Metadata
    └── app.xml                  # App metadata
```

Key insight: We only need to parse `word/document.xml` for editing, but we must preserve ALL other files unchanged when exporting.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         React UI Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │FileLoader│  │ Toolbar  │  │ Editor   │  │ VariableInserter ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Editor Core Layer                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    ProseMirror Editor                     │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │  │
│  │  │  Nodes  │  │  Marks  │  │Commands │  │   Schema    │  │  │
│  │  │(para,   │  │(bold,   │  │(toggle, │  │(doc struct) │  │  │
│  │  │ table)  │  │ italic) │  │ insert) │  │             │  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DOCX I/O Layer                             │
│  ┌────────────────┐              ┌────────────────────────┐    │
│  │  DocxParser    │              │    DocxSerializer      │    │
│  │  (DOCX → PM)   │              │    (PM → DOCX)         │    │
│  │                │              │                        │    │
│  │  - Unzip       │              │  - Convert PM to XML   │    │
│  │  - Parse XML   │              │  - Preserve styles.xml │    │
│  │  - Convert to  │              │  - Preserve theme.xml  │    │
│  │    ProseMirror │              │  - Rezip               │    │
│  └────────────────┘              └────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Approach

- **Our implementation is original:** We build our own DOCX parser, serializer, and UI. We do not copy any existing implementation.
- **ProseMirror is the editing engine:** It's MIT licensed, battle-tested, and used by many editors (Notion, NYT, Atlassian). We build on top of it.
- **Preserve-first export strategy:** When exporting, we only modify `word/document.xml`. All other files (styles, themes, fonts, media) are preserved exactly as imported.
- **Client-side only:** No backend, no server processing.

---

## Technical Constraints

- Client-side only — no backend, no server-side processing
- No collaboration features — no comments, no tracked changes, no real-time sync
- No PDF export (DOCX only)
- Minimal, functional UI — clean but not fancy
- Must work in modern browsers (Chrome, Firefox, Safari, Edge)

---

## Commands

| Command | Script | Purpose |
|---------|--------|---------|
| `bun install` | Install dependencies | Setup |
| `bun run dev` | Start dev server with demo app | Development |
| `bun test` | Run test suite | Testing |
| `bun test --watch` | Run tests in watch mode | Development |
| `bun run build` | Build library for npm | Production |
| `bun run build:demo` | Build demo app | Demo deployment |
| `bun run prepublishOnly` | Test + build before publish | Publishing |
| `npm publish` | Publish to npm | Distribution |

### Build Configuration

The library is built with **tsup** for optimal npm distribution:

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
  injectStyle: false, // CSS exported separately
});
```

### Package.json (key fields)

```json
{
  "name": "@eigenpal/docx-editor",
  "version": "0.1.0",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./styles.css": "./dist/styles.css"
  },
  "files": ["dist"],
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "scripts": {
    "dev": "bun run demo/main.tsx",
    "build": "tsup && bun run build:css",
    "build:css": "tailwindcss -i ./src/styles.css -o ./dist/styles.css --minify",
    "build:demo": "bun build ./demo/main.tsx --outdir ./demo/dist",
    "test": "bun test",
    "prepublishOnly": "bun test && bun run build"
  }
}
```

---

## Testing Strategy

Testing is critical for a document editor. We need confidence that:
1. DOCX files parse correctly
2. Edits serialize back to valid DOCX XML
3. Round-trip preserves formatting (load → edit → export → reload)
4. Edge cases don't corrupt documents

### Testing Stack

| Tool | Purpose |
|------|---------|
| **Bun Test** | Built-in test runner (Jest-compatible API) |
| **@testing-library/react** | React component testing |
| **Test fixtures** | Sample .docx files with known content |

### Test Categories

#### 1. Unit Tests (Fast, Isolated)

**Parser Tests** (`src/docx/parser/__tests__/`)
- Parse minimal DOCX with single paragraph
- Parse DOCX with bold/italic/underline text
- Parse DOCX with multiple paragraphs
- Parse DOCX with font sizes
- Parse DOCX with colors
- Handle malformed/empty DOCX gracefully

**Serializer Tests** (`src/docx/serializer/__tests__/`)
- Serialize single paragraph to valid XML
- Serialize text with marks (bold, italic, underline)
- Serialize font size correctly (points → half-points)
- Serialize color as hex
- Serialize paragraph alignment
- Output valid OOXML structure

**Mark Tests** (`src/editor/marks/__tests__/`)
- Bold mark toggles correctly
- Italic mark toggles correctly
- Marks combine properly
- Mark attributes preserved

#### 2. Integration Tests (Round-trip)

**Round-trip Tests** (`src/__tests__/roundtrip/`)

The core validation loop:
```
Load DOCX → Parse → Edit → Serialize → Export → Reload → Compare
```

Test cases:
- Simple text survives round-trip
- Bold text survives round-trip
- Multiple formatting survives round-trip
- Font sizes survive round-trip
- Colors survive round-trip
- Paragraph alignment survives round-trip
- Inserted `{variables}` survive round-trip
- Unmodified files are byte-identical (except document.xml)

**Preservation Tests**
- styles.xml unchanged after export
- theme1.xml unchanged after export
- fontTable.xml unchanged after export
- Media files unchanged after export
- Relationship files unchanged after export

#### 3. Component Tests

**UI Component Tests** (`src/components/__tests__/`)
- FileLoader accepts .docx files
- FileLoader rejects non-.docx files
- Toolbar buttons trigger correct commands
- Variable insertion popover works
- Export button triggers download

#### 4. Fixture Files

Create test fixtures in `src/__tests__/fixtures/`:

```
fixtures/
├── minimal.docx           # Single paragraph, no formatting
├── formatted.docx         # Bold, italic, underline
├── fonts.docx             # Various font sizes
├── colors.docx            # Text and highlight colors
├── alignment.docx         # Left, center, right, justify
├── complex.docx           # All of the above combined
├── with-styles.docx       # Document using named styles
├── with-theme.docx        # Document with custom theme colors
├── with-images.docx       # Document containing images
└── EP_ZMVZ_MULTI_v4.docx  # Real-world template (Slovak legal doc)
```

**Real-world fixture: `EP_ZMVZ_MULTI_v4.docx`**

A Slovak legal document (meeting minutes) with:
- **Font:** Garamond, various sizes (11pt, 12pt, 8.5pt)
- **Formatting:** Bold, italic, underline, caps
- **Alignment:** Center, justify, with indentation
- **Paragraph borders**
- **Footer**
- **Template variables:**
  - Simple: `{date}`, `{city}`, `{country}`, `{fullName}`
  - Nested: `{businessLine_company}`, `{currentExecutive_fullName}`
  - Loops: `{#shareholders}...{/shareholders}`, `{#transferClauses}...{/transferClauses}`
  - In-loop: `{index}`, `{dateOfBirth}`, `{streetAndNumber}`, `{zipCode}`

### Validation Checks

For each export, verify:

1. **Structural validity**
   - ZIP contains required files ([Content_Types].xml, document.xml, etc.)
   - XML is well-formed (parses without error)

2. **Content validity**
   - Text content matches expected
   - Formatting marks present where expected

3. **Preservation validity**
   - Unchanged files are identical (binary compare)
   - Only document.xml differs

### Test Utilities

Create helpers in `src/__tests__/utils/`:

```typescript
// Load a fixture file
export async function loadFixture(name: string): Promise<File>

// Parse a DOCX and return structured data for assertions
export async function parseDocxForTest(file: File): Promise<TestDocxData>

// Compare two DOCX files, return differences
export async function diffDocx(a: File, b: File): Promise<DocxDiff>

// Assert that a DOCX is structurally valid
export async function assertValidDocx(file: Blob): Promise<void>

// Extract specific XML file from DOCX for inspection
export async function extractXml(file: Blob, path: string): Promise<string>
```

### CI Integration

The verify command runs the full validation loop:

```bash
bun install && bun test && bun build ./src/main.tsx --outdir ./dist --loader:.css=css
```

All tests must pass before build succeeds.

---

## Formatting Fidelity Requirements

The editor must preserve document formatting through the load → edit → export cycle:

### Must Preserve
- **Character formatting:** Bold, italic, underline, strikethrough, font color, highlight
- **Font properties:** Font family, font size
- **Paragraph formatting:** Alignment (left, center, right, justify), line spacing, indentation
- **Styles:** Heading styles (H1-H6), named paragraph styles
- **Tables:** Basic table structure, cell content (advanced table styling is stretch goal)

### Preserve via Pass-Through (don't parse, just keep)
- **Theme colors:** Keep theme1.xml unchanged
- **Style definitions:** Keep styles.xml unchanged
- **Fonts:** Keep fontTable.xml unchanged
- **Headers/Footers:** Keep as-is (editing is stretch goal)
- **Images:** Keep in word/media/ unchanged
- **Page layout:** Keep section properties unchanged

### Variable Insertion
When a `{variable}` is inserted, it must inherit the formatting at the cursor position (same font, size, bold/italic state, color).

---

## User Stories

### Phase 1: Foundation

---

#### US-01: Project Scaffold

**Title:** Project setup with Bun, React, Tailwind, ProseMirror, and shadcn

**Description:**
Initialize the project structure with all core dependencies. Set up the build pipeline, Tailwind CSS, and shadcn components.

**Acceptance Criteria:**
- [ ] package.json with dependencies: react, react-dom, prosemirror-*, jszip, tailwindcss, lucide-react
- [ ] tsconfig.json with jsx: react-jsx, strict mode
- [ ] tailwind.config.js configured
- [ ] shadcn components initialized (Button, Input, Popover, Select, DropdownMenu)
- [ ] index.html with #app mount point
- [ ] src/main.tsx with React app shell
- [ ] Library project structure:
  ```
  /
  ├── src/
  │   ├── index.ts              # Main exports
  │   ├── types.ts              # TypeScript types
  │   ├── styles.css            # Tailwind entry
  │   ├── components/
  │   │   ├── DocxEditor.tsx    # Main component
  │   │   ├── Toolbar.tsx
  │   │   ├── Editor.tsx
  │   │   ├── FileLoader.tsx
  │   │   ├── VariableInserter.tsx
  │   │   └── ui/               # shadcn components
  │   ├── hooks/
  │   │   └── useDocxEditor.ts  # Editor state hook
  │   ├── editor/
  │   │   ├── core/             # ProseMirror setup
  │   │   ├── schema.ts         # Document schema
  │   │   ├── nodes/            # Node definitions
  │   │   ├── marks/            # Mark definitions
  │   │   └── commands/         # Editor commands
  │   └── docx/
  │       ├── parser/           # DOCX → ProseMirror
  │       └── serializer/       # ProseMirror → DOCX
  ├── demo/
  │   ├── index.html            # Demo page
  │   └── main.tsx              # Demo app
  ├── tsup.config.ts            # Library build config
  ├── tailwind.config.js
  ├── tsconfig.json
  └── package.json
  ```
- [ ] `bun install` exits 0
- [ ] `bun build` exits 0

---

#### US-02: ProseMirror Editor Setup

**Title:** Basic ProseMirror editor with document schema

**Description:**
Set up ProseMirror with a basic document schema supporting paragraphs and text. The editor should render in a container and allow basic text input.

**Acceptance Criteria:**
- [ ] ProseMirror editor initializes in a React component
- [ ] Basic schema with: doc, paragraph, text nodes
- [ ] Editor accepts keyboard input
- [ ] Editor content is accessible via EditorState
- [ ] Clean React integration (useEffect for mount/unmount)
- [ ] `bun build` exits 0

---

#### US-03: Basic Text Marks (Bold, Italic, Underline)

**Title:** Character formatting marks with keyboard shortcuts

**Description:**
Add mark types for bold, italic, and underline. These should be toggleable via keyboard shortcuts (Cmd/Ctrl+B, I, U) and apply to selected text.

**Acceptance Criteria:**
- [ ] Bold mark (`<strong>`) with Mod-B shortcut
- [ ] Italic mark (`<em>`) with Mod-I shortcut
- [ ] Underline mark (`<u>`) with Mod-U shortcut
- [ ] Marks apply to selected text
- [ ] Marks toggle on/off correctly
- [ ] Multiple marks can combine (bold + italic)
- [ ] `bun build` exits 0

---

#### US-03b: Test Infrastructure Setup

**Title:** Set up test infrastructure and fixtures

**Description:**
Set up the testing infrastructure: Bun test configuration, test utilities, and initial fixture files.

**Acceptance Criteria:**
- [ ] Bun test runs with `bun test`
- [ ] Test utilities created in `src/__tests__/utils/`
- [ ] `loadFixture()` helper loads .docx from fixtures/
- [ ] `assertValidDocx()` helper validates DOCX structure
- [ ] At least 3 fixture files created: minimal.docx, formatted.docx, complex.docx
- [ ] Sample test passes
- [ ] `bun test` exits 0

---

### Phase 2: DOCX I/O

---

#### US-04: DOCX Parser - Unzip and Extract

**Title:** Unzip DOCX and extract XML files

**Description:**
Create a DocxParser class that uses JSZip to extract a DOCX file. Store all files in memory for later use. Parse `word/document.xml` as XML.

**Acceptance Criteria:**
- [ ] DocxParser class in src/docx/parser/DocxParser.ts
- [ ] `parse(file: File): Promise<DocxData>` method
- [ ] Extracts all files from DOCX ZIP
- [ ] Parses word/document.xml as XML DOM
- [ ] Stores other files (styles.xml, theme1.xml, etc.) as raw strings
- [ ] Stores media files as base64/blob
- [ ] Error handling for invalid DOCX files
- [ ] `bun build` exits 0

---

#### US-05: DOCX to ProseMirror Conversion

**Title:** Convert document.xml content to ProseMirror document

**Description:**
Convert the parsed DOCX XML (specifically the paragraph and run structure) to a ProseMirror document. Handle basic text and formatting.

DOCX structure:
- `<w:p>` = paragraph
- `<w:r>` = run (text with consistent formatting)
- `<w:t>` = text content
- `<w:rPr>` = run properties (formatting)
- `<w:b/>` = bold, `<w:i/>` = italic, `<w:u/>` = underline

**Acceptance Criteria:**
- [ ] DocxConverter class in src/docx/parser/DocxConverter.ts
- [ ] `convert(xml: Document): ProseMirrorDoc` method
- [ ] Converts `<w:p>` to paragraph nodes
- [ ] Converts `<w:r>/<w:t>` to text with marks
- [ ] Detects `<w:b/>` and applies bold mark
- [ ] Detects `<w:i/>` and applies italic mark
- [ ] Detects `<w:u/>` and applies underline mark
- [ ] Handles empty paragraphs
- [ ] Returns valid ProseMirror document JSON
- [ ] `bun build` exits 0

---

#### US-06: File Loader Component

**Title:** Load DOCX files via file picker and drag-and-drop

**Description:**
A `<FileLoader />` component that allows users to select or drag-drop a .docx file. Uses the DocxParser to parse the file and passes the result to the parent.

**Acceptance Criteria:**
- [ ] FileLoader component in src/components/FileLoader.tsx
- [ ] shadcn Button triggers hidden file input
- [ ] File input accepts .docx files only
- [ ] Drag-and-drop zone with visual feedback (border highlight on drag)
- [ ] Calls DocxParser.parse() on file load
- [ ] Passes parsed DocxData to parent via callback
- [ ] Shows loading state during parsing
- [ ] Displays loaded filename
- [ ] Error handling for invalid files
- [ ] `bun build` exits 0

---

#### US-07: Load DOCX into Editor

**Title:** Wire FileLoader to ProseMirror editor

**Description:**
When a DOCX is loaded, convert it to ProseMirror format and display in the editor. Store the original DocxData for later export.

**Acceptance Criteria:**
- [ ] App component manages: docxData, editorState
- [ ] FileLoader onLoad → parse → convert → set editor state
- [ ] Editor displays the loaded document content
- [ ] Basic formatting (bold, italic, underline) renders correctly
- [ ] Original docxData stored for export
- [ ] Placeholder shown when no document loaded
- [ ] `bun build` exits 0

---

#### US-07b: Parser Unit Tests

**Title:** Unit tests for DOCX parser and converter

**Description:**
Write unit tests for the DocxParser and DocxConverter classes.

**Acceptance Criteria:**
- [ ] Test: parses minimal.docx without error
- [ ] Test: extracts correct text content
- [ ] Test: detects bold formatting
- [ ] Test: detects italic formatting
- [ ] Test: detects underline formatting
- [ ] Test: handles empty paragraphs
- [ ] Test: handles multiple paragraphs
- [ ] Test: gracefully handles invalid DOCX (throws descriptive error)
- [ ] All tests pass with `bun test`

---

### Phase 3: Export

---

#### US-08: ProseMirror to DOCX XML Serializer

**Title:** Convert ProseMirror document back to DOCX XML

**Description:**
Create a serializer that converts the ProseMirror document back to `word/document.xml` format. This is the inverse of US-05.

**Acceptance Criteria:**
- [ ] DocxSerializer class in src/docx/serializer/DocxSerializer.ts
- [ ] `serialize(doc: ProseMirrorDoc): string` method returns XML string
- [ ] Converts paragraph nodes to `<w:p>` elements
- [ ] Converts text with marks to `<w:r>` with `<w:rPr>` and `<w:t>`
- [ ] Bold mark → `<w:b/>`
- [ ] Italic mark → `<w:i/>`
- [ ] Underline mark → `<w:u/>`
- [ ] Preserves text content exactly
- [ ] Produces valid OOXML structure
- [ ] `bun build` exits 0

---

#### US-09: DOCX Export with File Preservation

**Title:** Export edited document as .docx preserving all original files

**Description:**
Create a DocxExporter that takes the original DocxData, replaces only `word/document.xml` with the new content, and zips everything back into a valid DOCX.

**Critical:** All files except document.xml must be preserved exactly as imported (styles.xml, theme1.xml, fonts, media, etc.).

**Acceptance Criteria:**
- [ ] DocxExporter class in src/docx/serializer/DocxExporter.ts
- [ ] `export(docxData: DocxData, newDocumentXml: string): Promise<Blob>` method
- [ ] Uses JSZip to create new ZIP
- [ ] Copies all original files unchanged
- [ ] Replaces word/document.xml with new content
- [ ] Preserves: styles.xml, theme1.xml, fontTable.xml, [Content_Types].xml, all .rels files
- [ ] Preserves: word/media/* images
- [ ] Generated DOCX opens correctly in Microsoft Word
- [ ] `bun build` exits 0

---

#### US-10: Export Button and Download

**Title:** Export button triggers DOCX download

**Description:**
Add an Export button that serializes the current editor state and downloads as a .docx file.

**Acceptance Criteria:**
- [ ] Export button (shadcn Button + lucide Download icon)
- [ ] Clicking triggers: serialize editor → export DOCX → download
- [ ] Downloaded file has sensible name (original name or "document.docx")
- [ ] Downloaded file opens in Word with formatting intact
- [ ] Button disabled when no document loaded
- [ ] Loading state during export
- [ ] `bun build` exits 0

---

#### US-10b: Serializer and Round-trip Tests

**Title:** Unit tests for serializer and round-trip validation

**Description:**
Write tests for the DocxSerializer and DocxExporter. Most importantly, test the round-trip: load → parse → serialize → export → reload and verify content is preserved.

**Acceptance Criteria:**
- [ ] Test: serializes paragraph to valid `<w:p>` XML
- [ ] Test: serializes bold text with `<w:b/>`
- [ ] Test: serializes italic text with `<w:i/>`
- [ ] Test: serializes underline text with `<w:u/>`
- [ ] Test: exported DOCX is valid ZIP with required files
- [ ] Test: round-trip preserves plain text content
- [ ] Test: round-trip preserves bold formatting
- [ ] Test: round-trip preserves italic formatting
- [ ] Test: styles.xml unchanged after round-trip
- [ ] Test: theme1.xml unchanged after round-trip
- [ ] All tests pass with `bun test`

---

### Phase 4: Toolbar & Formatting

---

#### US-11: Toolbar Component

**Title:** Formatting toolbar with shadcn components

**Description:**
Create a toolbar with formatting buttons. Uses shadcn Button components and lucide icons. Buttons reflect current selection state (pressed when format is active).

**Acceptance Criteria:**
- [ ] Toolbar component in src/components/Toolbar.tsx
- [ ] Bold button (lucide Bold icon) - toggles bold
- [ ] Italic button (lucide Italic icon) - toggles italic
- [ ] Underline button (lucide Underline icon) - toggles underline
- [ ] Buttons show active state when format is applied to selection
- [ ] Buttons are disabled when no document loaded
- [ ] Toolbar updates on selection change
- [ ] `bun build` exits 0

---

#### US-12: Font Size Support

**Title:** Font size mark and toolbar control

**Description:**
Add font size as a mark attribute. Add a dropdown in the toolbar to select font size.

DOCX: `<w:sz w:val="24"/>` (value is in half-points, so 24 = 12pt)

**Acceptance Criteria:**
- [ ] Font size mark with `size` attribute
- [ ] Parser extracts `<w:sz>` values (convert half-points to points)
- [ ] Serializer outputs `<w:sz>` correctly
- [ ] Toolbar has font size dropdown (shadcn Select)
- [ ] Common sizes: 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72
- [ ] Dropdown shows current selection's font size
- [ ] Selecting size applies to selection
- [ ] `bun build` exits 0

---

#### US-13: Font Color Support

**Title:** Text color mark and toolbar control

**Description:**
Add text color as a mark. Add a color picker popover in the toolbar.

DOCX: `<w:color w:val="FF0000"/>` (hex RGB)

**Acceptance Criteria:**
- [ ] Color mark with `color` attribute (hex string)
- [ ] Parser extracts `<w:color>` values
- [ ] Serializer outputs `<w:color>` correctly
- [ ] Toolbar has color button with popover (shadcn Popover)
- [ ] Color picker with common colors (grid of swatches)
- [ ] Clicking color applies to selection
- [ ] Button shows current color indicator
- [ ] `bun build` exits 0

---

#### US-14: Text Alignment

**Title:** Paragraph alignment support

**Description:**
Add paragraph alignment as a node attribute. Add alignment buttons to toolbar.

DOCX: `<w:jc w:val="center"/>` (left, center, right, both/justify)

**Acceptance Criteria:**
- [ ] Paragraph node has `alignment` attribute
- [ ] Parser extracts `<w:jc>` from `<w:pPr>`
- [ ] Serializer outputs `<w:pPr><w:jc>` correctly
- [ ] Toolbar has alignment buttons (AlignLeft, AlignCenter, AlignRight icons)
- [ ] Buttons toggle paragraph alignment
- [ ] Active alignment button shows pressed state
- [ ] `bun build` exits 0

---

#### US-14b: Formatting Round-trip Tests

**Title:** Tests for font size, color, and alignment round-trip

**Description:**
Extend round-trip tests to cover font size, text color, and paragraph alignment.

**Acceptance Criteria:**
- [ ] Test: font size survives round-trip (parse → serialize → parse)
- [ ] Test: font size conversion correct (half-points ↔ points)
- [ ] Test: text color survives round-trip
- [ ] Test: color serializes as correct hex format
- [ ] Test: paragraph alignment survives round-trip
- [ ] Test: complex formatting combination survives round-trip
- [ ] All tests pass with `bun test`

---

### Phase 5: Template Variables

---

#### US-15: Variable Insertion UI

**Title:** "+" button to insert template variables

**Description:**
Add a "+" button in the toolbar that opens a popover. User types a variable name, clicks Insert, and `{variable_name}` is inserted at cursor.

**Acceptance Criteria:**
- [ ] "+" button (lucide Plus icon) in toolbar
- [ ] Clicking opens shadcn Popover
- [ ] Popover contains: Input field, Insert button
- [ ] User types variable name (without braces)
- [ ] Insert button inserts `{variable_name}` at cursor
- [ ] Pressing Enter in input also inserts
- [ ] Popover closes after insertion
- [ ] Empty input shows validation error
- [ ] `bun build` exits 0

---

#### US-16: Variable Formatting Inheritance

**Title:** Inserted variables inherit cursor formatting

**Description:**
When a variable is inserted, it must inherit all formatting from the current cursor position (font, size, color, bold, italic, etc.).

**Acceptance Criteria:**
- [ ] Get current marks at cursor position
- [ ] Insert `{variable_name}` text with those marks
- [ ] If cursor is in bold text, variable appears bold
- [ ] If cursor has specific font size, variable has same size
- [ ] If cursor has specific color, variable has same color
- [ ] Works with multiple combined formats
- [ ] `bun build` exits 0

---

### Phase 6: Polish & Integration

---

#### US-17: Full App Integration

**Title:** Wire all components together in App

**Description:**
The main App component orchestrates the full flow with proper state management and error handling.

**Acceptance Criteria:**
- [ ] App manages: docxData, editorView, isLoading states
- [ ] FileLoader → parse → editor flow works
- [ ] Toolbar → editor formatting commands work
- [ ] Variable insertion works
- [ ] Export produces valid DOCX
- [ ] Errors display in UI via toast/alert (shadcn)
- [ ] Loading states shown during async operations
- [ ] `bun build` exits 0

---

#### US-18: Strikethrough Support

**Title:** Add strikethrough mark

**Description:**
Add strikethrough formatting with toolbar button.

DOCX: `<w:strike/>`

**Acceptance Criteria:**
- [ ] Strikethrough mark
- [ ] Parser/serializer support
- [ ] Toolbar button (lucide Strikethrough icon)
- [ ] Keyboard shortcut (Mod-Shift-S)
- [ ] `bun build` exits 0

---

#### US-19: Highlight/Background Color

**Title:** Text highlight mark

**Description:**
Add text highlight (background color) support.

DOCX: `<w:highlight w:val="yellow"/>` or `<w:shd w:fill="FFFF00"/>`

**Acceptance Criteria:**
- [ ] Highlight mark with color attribute
- [ ] Parser/serializer support
- [ ] Toolbar button with color popover
- [ ] Common highlight colors (yellow, green, cyan, magenta, etc.)
- [ ] `bun build` exits 0

---

#### US-20: End-to-End Validation Suite

**Title:** Comprehensive E2E validation tests

**Description:**
Create a comprehensive test suite that validates the entire workflow with real-world document scenarios.

**Acceptance Criteria:**
- [ ] Test: load complex.docx → make no edits → export → binary compare shows only document.xml changed
- [ ] Test: load → insert `{variable}` → export → variable present in exported XML
- [ ] Test: load → apply bold to text → export → bold preserved
- [ ] Test: load → change font size → export → font size preserved
- [ ] Test: load → change alignment → export → alignment preserved
- [ ] Test: exported DOCX opens in Word without errors (manual verification documented)
- [ ] Test: all fixture files round-trip without content loss
- [ ] Test: error handling - corrupt DOCX shows user-friendly error
- [ ] Test: error handling - non-DOCX file rejected
- [ ] Test coverage report shows >80% coverage on core modules
- [ ] All tests pass with `bun test`

---

### Phase 7: Package & Publish

---

#### US-21: Library Build Configuration

**Title:** Configure tsup for npm package build

**Description:**
Set up tsup to build the library for npm distribution. Output CommonJS, ESM, and TypeScript declarations.

**Acceptance Criteria:**
- [ ] tsup.config.ts configured
- [ ] `bun run build` produces dist/ folder
- [ ] dist/index.js (ESM)
- [ ] dist/index.cjs (CommonJS)
- [ ] dist/index.d.ts (TypeScript declarations)
- [ ] dist/styles.css (Tailwind CSS)
- [ ] React and React-DOM are external (peer deps)
- [ ] Source maps generated
- [ ] `bun run build` exits 0

---

#### US-22: Package.json for npm

**Title:** Configure package.json for npm publishing

**Description:**
Set up package.json with correct fields for npm publishing: exports, peer dependencies, files, etc.

**Acceptance Criteria:**
- [ ] Package name: `@eigenpal/docx-editor`
- [ ] `main`, `module`, `types` fields set correctly
- [ ] `exports` field with ESM/CJS/types
- [ ] `peerDependencies`: react >=18, react-dom >=18
- [ ] `files` includes only dist/
- [ ] `prepublishOnly` runs tests and build
- [ ] Package installs correctly in a test project
- [ ] TypeScript types work in consuming project
- [ ] CSS imports work: `import '@eigenpal/docx-editor/styles.css'`

---

#### US-23: Demo Application

**Title:** Create demo app for development and showcase

**Description:**
Build a demo application that showcases the editor. This serves as both a development environment and a reference implementation.

**Acceptance Criteria:**
- [ ] demo/index.html and demo/main.tsx exist
- [ ] Demo imports from src/ (not dist/) for dev
- [ ] Demo shows all features: load, edit, insert variable, export
- [ ] Demo includes sample DOCX file
- [ ] `bun run dev` starts demo server
- [ ] Demo can be built for deployment: `bun run build:demo`

---

#### US-24: Documentation and README

**Title:** Write README with usage docs

**Description:**
Create comprehensive README.md with installation, usage examples, API documentation, and contribution guide.

**Acceptance Criteria:**
- [ ] README.md with:
  - [ ] Installation instructions (npm, yarn, bun)
  - [ ] Quick start code example
  - [ ] Full props API documentation
  - [ ] Exports reference
  - [ ] Styling/customization guide
  - [ ] Browser support
  - [ ] Contributing guide
- [ ] CHANGELOG.md initialized
- [ ] LICENSE file (MIT)

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [📁 Open]                                         [⬇ Export]   │
├─────────────────────────────────────────────────────────────────┤
│  [B] [I] [U] [S̶] │ Size ▾ │ A▾ │ 🖍▾ │ ⬅ ⬌ ➡ │      [＋]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                                                                 │
│                     ProseMirror Editor                          │
│                                                                 │
│  This is some sample text with `{variable}` placeholders.      │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

[+] Popover:
  ┌─────────────────────────┐
  │ Variable name:          │
  │ [_________________]     │
  │              [Insert]   │
  └─────────────────────────┘
```

---

## Dependencies

### Runtime

| Package | Purpose |
|---------|---------|
| react, react-dom | UI framework |
| prosemirror-state | Editor state management |
| prosemirror-view | Editor rendering |
| prosemirror-model | Document model and schema |
| prosemirror-transform | Document transformations |
| prosemirror-commands | Basic editing commands |
| prosemirror-keymap | Keyboard shortcut handling |
| prosemirror-history | Undo/redo support |
| jszip | DOCX ZIP handling |
| tailwindcss | Utility CSS framework |
| shadcn/ui | UI components (Button, Input, Popover, Select, etc.) |
| lucide-react | Icons |

### Dev/Testing/Build

| Package | Purpose |
|---------|---------|
| typescript | Type checking |
| @types/react | React type definitions |
| @testing-library/react | React component testing |
| @happy-dom/global-registrator | DOM environment for Bun tests |
| tsup | Library bundling (ESM, CJS, DTS) |
| autoprefixer | CSS vendor prefixes |
| postcss | CSS processing |

---

## Out of Scope (v1)

- PDF export
- Real-time collaboration
- Comments and tracked changes
- Headers and footers editing (preserved but not editable)
- Images (preserved but not insertable)
- Tables (basic support may be added, but not full editing)
- Lists (may be added in v1.1)
- Find and replace
- Spell check
- Print preview
- Version history

---

## Stretch Goals (v1.1+)

- Table editing (insert, delete rows/cols)
- List support (bullet, numbered)
- Image insertion
- Header/footer editing
- Font family selection
- More heading styles
- Undo/redo toolbar buttons
- Keyboard shortcuts help overlay

---

## Success Criteria

### Build & Test Gates
1. `bun test` exits 0 (all tests pass)
2. `bun run build` exits 0 (library builds successfully)
3. Test coverage >80% on core modules (parser, serializer, editor)

### Functional Requirements
4. User can load a .docx file and see its content with basic formatting
5. User can edit text and apply formatting (bold, italic, underline, font size, color, alignment)
6. User can insert `{variable}` placeholders that inherit formatting
7. User can export and the resulting .docx opens correctly in Microsoft Word

### Fidelity Requirements
8. All formatting survives the load → edit → export round-trip
9. Original document styling (from styles.xml, theme.xml) is preserved in export
10. Files not touched during editing are byte-identical after export

### Package Requirements
11. Package publishes to npm successfully
12. `npm install @eigenpal/docx-editor` works in a fresh project
13. TypeScript types are correctly exported and usable
14. CSS can be imported: `import '@eigenpal/docx-editor/styles.css'`
15. Works with React 18+
16. Bundle size is reasonable (<500KB gzipped for core)
