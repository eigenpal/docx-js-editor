<p align="center">
  <a href="https://github.com/eigenpal/docx-js-editor">
    <img src="https://raw.githubusercontent.com/eigenpal/docx-js-editor/main/assets/logo.png" alt="DOCX JS Editor" width="600" />
  </a>
</p>

<p align="center">
  <strong>A powerful WYSIWYG DOCX editor for the browser</strong>
</p>

<p align="center">
  Edit Microsoft Word documents directly in your web app with pixel-perfect fidelity
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@eigenpal/docx-js-editor"><img src="https://img.shields.io/npm/v/@eigenpal/docx-js-editor.svg?style=flat-square&color=00C853" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@eigenpal/docx-js-editor"><img src="https://img.shields.io/npm/dm/@eigenpal/docx-js-editor.svg?style=flat-square&color=00C853" alt="npm downloads" /></a>
  <a href="https://github.com/eigenpal/docx-js-editor/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square&color=00C853" alt="license" /></a>
</p>

<br />

## Why DOCX JS Editor?

Most document editors in the browser either lack features or produce inconsistent output. **DOCX JS Editor** is different:

- **True WYSIWYG** — What you see matches Microsoft Word exactly
- **Full Round-Trip** — Open a DOCX, edit it, save it back — no data loss
- **Production Ready** — Battle-tested with complex real-world documents
- **Framework Agnostic** — Works with React, or use headless mode for any stack

<br />

## Features

<table>
<tr>
<td width="50%">

**Text Formatting**

- Bold, italic, underline, strikethrough
- Superscript & subscript
- Text color & highlighting
- Any font family & size

</td>
<td width="50%">

**Paragraph Formatting**

- Alignment (left, center, right, justify)
- Line spacing & indentation
- Bullet & numbered lists
- Paragraph styles (Heading 1-6, etc.)

</td>
</tr>
<tr>
<td width="50%">

**Rich Content**

- Tables with borders & shading
- Images (inline & floating)
- Hyperlinks with tooltips
- Headers & footers

</td>
<td width="50%">

**Advanced**

- Theme colors & fonts
- Word style system
- Template variables `{{var}}`
- Undo/redo history

</td>
</tr>
</table>

<br />

## Quick Start

### Installation

```bash
npm install @eigenpal/docx-js-editor
```

### Basic Usage

```tsx
import { DocxEditor } from '@eigenpal/docx-js-editor';
import '@eigenpal/docx-js-editor/styles.css';

function App() {
  return <DocxEditor onDocumentChange={(doc) => console.log('Changed:', doc)} height="600px" />;
}
```

### Load a DOCX File

```tsx
import { DocxEditor, parseDocx } from '@eigenpal/docx-js-editor';
import '@eigenpal/docx-js-editor/styles.css';

function App() {
  const [document, setDocument] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    const buffer = await file.arrayBuffer();
    const doc = await parseDocx(buffer);
    setDocument(doc);
  };

  return (
    <>
      <input type="file" accept=".docx" onChange={handleFile} />
      {document && <DocxEditor document={document} onDocumentChange={setDocument} />}
    </>
  );
}
```

<br />

## Headless Mode

Parse and manipulate DOCX files without any UI — perfect for Node.js or serverless:

```typescript
import { parseDocx, serializeDocx } from '@eigenpal/docx-js-editor/headless';

// Parse
const buffer = await fetch('/doc.docx').then((r) => r.arrayBuffer());
const document = await parseDocx(buffer);

// Inspect
console.log(document.body.content);

// Modify & serialize
const output = await serializeDocx(document);
```

<br />

## Template Processing

Built-in [docxtemplater](https://docxtemplater.com/) integration for mail merge and document generation:

```typescript
import { processTemplate, getTemplateTags } from '@eigenpal/docx-js-editor';

// Discover all {{variables}} in a document
const tags = await getTemplateTags(buffer);
// → ['name', 'company', 'date']

// Fill in the template
const result = await processTemplate(buffer, {
  name: 'John Doe',
  company: 'Acme Inc',
  date: '2024-01-15',
});
```

<br />

## Components

### Main Editor

```tsx
<DocxEditor
  document={document}
  onDocumentChange={setDocument}
  height="600px"
  readOnly={false}
  showToolbar={true}
  zoom={100}
/>
```

### Read-Only Viewer

```tsx
import { DocumentViewer } from '@eigenpal/docx-js-editor';

<DocumentViewer document={document} zoom={100} />;
```

### UI Components

All the building blocks you need for custom interfaces:

| Component           | Description             |
| ------------------- | ----------------------- |
| `Toolbar`           | Full formatting toolbar |
| `FontPicker`        | Font family dropdown    |
| `FontSizePicker`    | Font size selector      |
| `ColorPicker`       | Text & highlight colors |
| `AlignmentButtons`  | Text alignment          |
| `ListButtons`       | Bullet & number lists   |
| `StylePicker`       | Paragraph styles        |
| `TableToolbar`      | Table editing           |
| `ZoomControl`       | Zoom slider             |
| `FindReplaceDialog` | Search & replace        |

<br />

## Plugin System

Extend the editor with custom functionality:

```tsx
import { PluginHost, type EditorPlugin } from '@eigenpal/docx-js-editor';

const myPlugin: EditorPlugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  initialize: (context) => {
    /* ... */
  },
  panel: MyPanel,
};

<PluginHost plugins={[myPlugin]}>
  <DocxEditor document={document} />
</PluginHost>;
```

<br />

## MCP Server

AI-powered editing via [Model Context Protocol](https://modelcontextprotocol.io/):

```bash
npx @eigenpal/docx-js-editor mcp
```

<br />

## DOCX Format Support

Full support for Office Open XML (ECMA-376):

| Category       | Features                                          |
| -------------- | ------------------------------------------------- |
| **Text**       | All character formatting, fonts, colors, effects  |
| **Paragraphs** | Alignment, spacing, indentation, borders, shading |
| **Styles**     | Character, paragraph, and linked styles           |
| **Tables**     | Merging, borders, shading, column widths          |
| **Lists**      | Bullets, numbers, multi-level                     |
| **Media**      | Inline images, floating images                    |
| **Layout**     | Headers, footers, sections, page settings         |
| **Advanced**   | Themes, bookmarks, hyperlinks, fields             |

<br />

## Browser Support

| Chrome | Firefox | Safari | Edge |
| :----: | :-----: | :----: | :--: |
|  90+   |   90+   |  14+   | 90+  |

<br />

## Contributing

We welcome contributions! See our [contributing guide](CONTRIBUTING.md) for details.

```bash
git clone https://github.com/eigenpal/docx-js-editor.git
cd docx-js-editor
bun install
bun dev
```

<br />

## License

[MIT](LICENSE) © [EigenPal](https://github.com/eigenpal)

<br />

<p align="center">
  <sub>Built with ❤️ by the EigenPal team</sub>
</p>
