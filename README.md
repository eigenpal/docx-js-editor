# @eigenpal/docx-js-editor

A powerful, fully-featured WYSIWYG DOCX editor for the browser. Built with React and ProseMirror, it renders Microsoft Word documents with pixel-perfect fidelity and provides a complete editing experience.

[![npm version](https://img.shields.io/npm/v/@eigenpal/docx-js-editor.svg)](https://www.npmjs.com/package/@eigenpal/docx-js-editor)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Features

- **Full WYSIWYG Editing** — Edit DOCX files directly in the browser with Microsoft Word-like fidelity
- **Complete Text Formatting** — Bold, italic, underline, strikethrough, superscript, subscript, text color, highlighting
- **Paragraph Formatting** — Alignment, line spacing, indentation, paragraph styles
- **Tables** — Full table support with cell formatting, borders, and background colors
- **Lists** — Bullet and numbered lists with multiple indent levels
- **Images** — Inline images with proper positioning
- **Hyperlinks** — Clickable links with tooltips
- **Headers & Footers** — Proper page layout rendering
- **Theme Support** — Resolves Word theme colors and fonts
- **Styles** — Full support for Word's style system (Heading 1-6, Normal, etc.)
- **Template Variables** — Insert and manage `{{variable}}` placeholders with docxtemplater
- **Undo/Redo** — Full history support
- **Keyboard Shortcuts** — Word-compatible shortcuts for common operations
- **Headless Mode** — Parse and manipulate DOCX files without UI
- **MCP Server** — Model Context Protocol server for AI-powered editing

## Installation

```bash
npm install @eigenpal/docx-js-editor
# or
yarn add @eigenpal/docx-js-editor
# or
pnpm add @eigenpal/docx-js-editor
# or
bun add @eigenpal/docx-js-editor
```

## Quick Start

### Basic Editor

```tsx
import { DocxEditor } from '@eigenpal/docx-js-editor';
import '@eigenpal/docx-js-editor/styles.css';

function App() {
  const handleChange = (document) => {
    console.log('Document changed:', document);
  };

  return <DocxEditor onDocumentChange={handleChange} height="600px" />;
}
```

### Load a DOCX File

```tsx
import { DocxEditor, parseDocx } from '@eigenpal/docx-js-editor';
import '@eigenpal/docx-js-editor/styles.css';

function App() {
  const [document, setDocument] = useState(null);

  const handleFileUpload = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const doc = await parseDocx(arrayBuffer);
    setDocument(doc);
  };

  return (
    <div>
      <input type="file" accept=".docx" onChange={(e) => handleFileUpload(e.target.files[0])} />
      {document && <DocxEditor document={document} onDocumentChange={setDocument} />}
    </div>
  );
}
```

### Headless Mode (No UI)

Parse and manipulate DOCX files without any React components:

```typescript
import { parseDocx, serializeDocx } from '@eigenpal/docx-js-editor/headless';

// Parse a DOCX file
const arrayBuffer = await fetch('/document.docx').then((r) => r.arrayBuffer());
const document = await parseDocx(arrayBuffer);

// Access document content
console.log(document.body.content); // Array of paragraphs, tables, etc.

// Serialize back to DOCX
const outputBuffer = await serializeDocx(document);
```

### Template Processing

Use docxtemplater integration for template variable substitution:

```typescript
import { processTemplate, getTemplateTags } from '@eigenpal/docx-js-editor';

// Get all template tags from a document
const tags = await getTemplateTags(arrayBuffer);
console.log(tags); // ['name', 'company', 'date', ...]

// Process template with data
const result = await processTemplate(arrayBuffer, {
  name: 'John Doe',
  company: 'Acme Inc',
  date: new Date().toLocaleDateString(),
});

// Download the processed document
const blob = new Blob([result], {
  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
});
```

## Components

### DocxEditor

The main editor component with full toolbar and editing capabilities.

```tsx
<DocxEditor
  document={document}
  onDocumentChange={handleChange}
  height="600px"
  width="100%"
  readOnly={false}
  showToolbar={true}
  zoom={100}
/>
```

### Toolbar

Standalone toolbar component for custom layouts:

```tsx
import { Toolbar } from '@eigenpal/docx-js-editor';

<Toolbar editorRef={editorRef} onFormatChange={handleFormat} />;
```

### DocumentViewer

Read-only document viewer:

```tsx
import { DocumentViewer } from '@eigenpal/docx-js-editor';

<DocumentViewer document={document} zoom={100} showPageNumbers={true} />;
```

## UI Components

The package includes a complete set of UI components:

- `FontPicker` — Font family selector
- `FontSizePicker` — Font size selector
- `ColorPicker` — Text and highlight color picker
- `AlignmentButtons` — Text alignment controls
- `ListButtons` — Bullet and numbered list toggles
- `LineSpacingPicker` — Line spacing selector
- `StylePicker` — Paragraph style selector
- `TableToolbar` — Table editing controls
- `ZoomControl` — Document zoom slider
- `PageNavigator` — Page navigation controls
- `FindReplaceDialog` — Find and replace functionality
- `InsertTableDialog` — Table insertion dialog
- `InsertImageDialog` — Image insertion dialog
- `HyperlinkDialog` — Hyperlink editor

## Hooks

```typescript
import {
  useAutoSave,
  useClipboard,
  useWheelZoom,
  useTableSelection,
  useFindReplace,
} from '@eigenpal/docx-js-editor';
```

## Utilities

```typescript
import {
  // Unit conversions
  twipsToPixels,
  pixelsToTwips,
  emuToPixels,
  pointsToPixels,

  // Color utilities
  resolveColor,
  resolveHighlightColor,
  createThemeColor,

  // Document operations
  createEmptyDocument,
  createDocumentWithText,
  createPageBreak,
  insertPageBreak,
} from '@eigenpal/docx-js-editor';
```

## Plugin System

Extend the editor with custom plugins:

```tsx
import { PluginHost, type EditorPlugin } from '@eigenpal/docx-js-editor';

const myPlugin: EditorPlugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  initialize: (context) => {
    // Plugin initialization
  },
  panel: MyPluginPanel,
};

<PluginHost plugins={[myPlugin]}>
  <DocxEditor document={document} />
</PluginHost>;
```

### Built-in Plugins

- **Template Plugin** — Visual template variable management with decorations

## MCP Server

The package includes an MCP (Model Context Protocol) server for AI-powered document editing:

```bash
# Run the MCP server
npx @eigenpal/docx-js-editor mcp

# Or use the CLI
docx-editor-mcp
```

```typescript
import { createMcpServer } from '@eigenpal/docx-js-editor/mcp';

const server = createMcpServer();
server.start();
```

## Document Types

```typescript
import type {
  Document,
  Paragraph,
  Run,
  Table,
  TableRow,
  TableCell,
  Image,
  Hyperlink,
  TextFormatting,
  ParagraphFormatting,
  Style,
  Theme,
} from '@eigenpal/docx-js-editor';
```

## Browser Support

- Chrome/Edge 90+
- Firefox 90+
- Safari 14+

## DOCX Format Support

The editor supports the Office Open XML (OOXML) format as specified in ECMA-376:

- **Text**: All character formatting (fonts, sizes, colors, effects)
- **Paragraphs**: Alignment, spacing, indentation, borders, shading
- **Styles**: Character styles, paragraph styles, linked styles
- **Tables**: Cell merging, borders, shading, column widths
- **Lists**: Bullet lists, numbered lists, multi-level lists
- **Images**: Inline images, floating images (partial)
- **Headers/Footers**: First page, odd/even page headers
- **Sections**: Page size, margins, orientation, columns
- **Themes**: Theme colors, theme fonts
- **Bookmarks**: Named locations within documents
- **Hyperlinks**: External and internal links
- **Fields**: Page numbers, dates, document properties

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

```bash
# Clone the repository
git clone https://github.com/eigenpal/docx-js-editor.git
cd docx-js-editor

# Install dependencies
bun install

# Run development server
bun dev

# Run tests
bun test

# Type check
bun run typecheck

# Build
bun run build
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [npm](https://www.npmjs.com/package/@eigenpal/docx-js-editor)
- [GitHub](https://github.com/eigenpal/docx-js-editor)
- [Documentation](https://github.com/eigenpal/docx-js-editor#readme)
- [Issues](https://github.com/eigenpal/docx-js-editor/issues)
