<p align="center">
  <a href="https://github.com/eigenpal/docx-js-editor">
    <img src="./assets/logo.png" alt="DOCX JS Editor" width="600" />
  </a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@eigenpal/docx-js-editor"><img src="https://img.shields.io/npm/v/@eigenpal/docx-js-editor.svg?style=flat-square&color=00C853" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@eigenpal/docx-js-editor"><img src="https://img.shields.io/npm/dm/@eigenpal/docx-js-editor.svg?style=flat-square&color=00C853" alt="npm downloads" /></a>
  <a href="https://github.com/eigenpal/docx-js-editor/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square&color=00C853" alt="license" /></a>
  <a href="https://docx-js-editor.vercel.app/"><img src="https://img.shields.io/badge/Live_Demo-00C853?style=flat-square&logo=vercel&logoColor=white" alt="Live Demo" /></a>
</p>

# @eigenpal/docx-js-editor

Open-source WYSIWYG DOCX editor for React. Open, edit, and save `.docx` files entirely in the browser — no server required. [Try the live demo.](https://docx-js-editor.vercel.app/)

<p align="center">
  <a href="https://docx-js-editor.vercel.app/">
    <img src="./assets/editor.png" alt="DOCX JS Editor screenshot" width="500" />
  </a>
</p>

We built it for ourselves in [eigenpal.com](https://eigenpal.com)  in order to have an editor for `.docx` files, which serve as AI document workflow output templates for our clients.

### Framework Examples

| Framework                                                                                                           | Example                                                                        |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| <img src="https://vite.dev/logo.svg" width="14" /> Vite + React                                                     | [`examples/vite`](examples/vite) ([demo](https://docx-js-editor.vercel.app/)) |
| <img src="https://assets.vercel.com/image/upload/v1662130559/nextjs/Icon_dark_background.png" width="14" /> Next.js | [`examples/nextjs`](examples/nextjs)                                           |
| <img src="https://remix.run/favicon-192.png" width="14" /> Remix                                                    | [`examples/remix`](examples/remix)                                             |
| <img src="https://astro.build/favicon.svg" width="14" /> Astro                                                      | [`examples/astro`](examples/astro)                                             |

## Installation

```bash
npm install @eigenpal/docx-js-editor
```

## Quick Start

```tsx
import { useRef } from 'react';
import { DocxEditor, type DocxEditorRef } from '@eigenpal/docx-js-editor';
import '@eigenpal/docx-js-editor/styles.css';

function Editor({ file }: { file: ArrayBuffer }) {
  const editorRef = useRef<DocxEditorRef>(null);

  const handleSave = async () => {
    const buffer = await editorRef.current?.save();
    if (buffer) {
      await fetch('/api/documents/1', { method: 'PUT', body: buffer });
    }
  };

  return (
    <>
      <button onClick={handleSave}>Save</button>
      <DocxEditor ref={editorRef} documentBuffer={file} onChange={() => {}} />
    </>
  );
}
```

> **Next.js / SSR:** The editor requires the DOM. Use a dynamic import or lazy `useEffect` load to avoid server-side rendering issues.

## Props

| Prop                | Type                            | Default | Description                                 |
| ------------------- | ------------------------------- | ------- | ------------------------------------------- |
| `documentBuffer`    | `ArrayBuffer`                   | —       | `.docx` file contents to load               |
| `document`          | `Document`                      | —       | Pre-parsed document (alternative to buffer) |
| `readOnly`          | `boolean`                       | `false` | Read-only preview (no caret/selection)      |
| `showToolbar`       | `boolean`                       | `true`  | Show formatting toolbar                     |
| `showRuler`         | `boolean`                       | `false` | Show horizontal ruler                       |
| `showZoomControl`   | `boolean`                       | `true`  | Show zoom controls                          |
| `showVariablePanel` | `boolean`                       | `true`  | Show template variable panel                |
| `initialZoom`       | `number`                        | `1.0`   | Initial zoom level                          |
| `onChange`          | `(doc: Document) => void`       | —       | Called on document change                   |
| `onSave`            | `(buffer: ArrayBuffer) => void` | —       | Called on save                              |
| `onError`           | `(error: Error) => void`        | —       | Called on error                             |

## Ref Methods

```tsx
const ref = useRef<DocxEditorRef>(null);

await ref.current.save(); // Returns ArrayBuffer of the .docx
ref.current.getDocument(); // Current document object
ref.current.setZoom(1.5); // Set zoom to 150%
ref.current.focus(); // Focus the editor
ref.current.scrollToPage(3); // Scroll to page 3
ref.current.print(); // Print the document
```

## Read-Only Preview

Use `readOnly` for a preview-only viewer. This disables editing, caret, and selection UI.

```tsx
<DocxEditor documentBuffer={file} readOnly />
```

## Plugins

Extend the editor with the plugin system. Wrap `DocxEditor` in a `PluginHost` and pass plugins that can contribute ProseMirror plugins, side panels, document overlays, and custom CSS:

```tsx
import { DocxEditor, PluginHost, templatePlugin } from '@eigenpal/docx-js-editor';

function Editor({ file }: { file: ArrayBuffer }) {
  return (
    <PluginHost plugins={[templatePlugin]}>
      <DocxEditor documentBuffer={file} />
    </PluginHost>
  );
}
```

| Plugin                                 | Description                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| [Docxtemplater](src/plugins/template/) | Syntax highlighting and annotation panel for [docxtemplater](https://docxtemplater.com) tags |

See [docs/PLUGINS.md](docs/PLUGINS.md) for the full plugin API, including how to create custom plugins with panels, overlays, and ProseMirror integrations.

## Features

- Full WYSIWYG editing with Microsoft Word fidelity
- Text and paragraph formatting (bold, italic, fonts, colors, alignment, spacing)
- Tables, images, hyperlinks
- Extensible plugin architecture
- Undo/redo, find & replace, keyboard shortcuts
- Print preview
- Zero server dependencies

## Development

```bash
bun install
bun run dev          # Vite example on localhost:5173
bun run dev:nextjs   # Next.js example on localhost:3000
bun run dev:remix    # Remix example on localhost:3001
bun run dev:astro    # Astro example on localhost:4321
```

Each example is independently deployable. Copy any `examples/<framework>/` directory to start your own project — just `npm install` and go.

## License

MIT
