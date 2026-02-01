# Activity Log - EigenPal DOCX Editor

## Product Vision

A **complete WYSIWYG DOCX editor** with full Microsoft Word fidelity:

### Document Features
- **Full text formatting** - bold, italic, underline, strikethrough, superscript, subscript, small caps, highlight, colors, fonts
- **Full paragraph formatting** - alignment, spacing, indentation, borders, shading, tabs
- **Tables** - borders, shading, merged cells, nested tables
- **Images** - embedded with sizing, floating
- **Shapes & text boxes** - basic drawing objects
- **Hyperlinks & bookmarks** - internal and external links
- **Fields** - page numbers, dates, document properties
- **Footnotes/endnotes**
- **Lists** - bullets, numbers, multi-level
- **Headers/footers** - per section, first/even page variants
- **Page layout** - size, margins, orientation, columns

### Editor Features
- **Full toolbar** - all formatting controls
- **Font/size/color pickers**
- **Style picker** - apply named styles
- **Find/replace**
- **Zoom control**
- **Table editing** - add/remove rows/columns, merge cells
- **Image editing** - resize handles
- **Copy/paste** - with formatting preservation
- **Undo/redo**
- **Keyboard shortcuts**

### AI/Agent Features
- **DocumentAgent API** - programmatic editing
- **Context menu** - right-click AI actions
- **Template variables** - docxtemplater integration

---

## Development Approach

**Exploratory implementation** - DOCX/OOXML is complex, we discover as we build.

1. Explore actual DOCX files with explorer utility
2. **Reference ~/wysiwyg-editor when unsure** - it's a working implementation
3. Document findings here
4. Implement parser + renderer (your own code)
5. Adapt plan as needed

---

## WYSIWYG Editor Reference Guide

**Always check ~/wysiwyg-editor when unsure how to implement something:**

```
~/wysiwyg-editor/
├── packages/
│   ├── super-editor/src/
│   │   ├── core/converters/    # DOCX import/export
│   │   │   └── v2/importer/    # Main parsing logic
│   │   └── extensions/         # Editor features
│   ├── layout-engine/src/      # Page layout, line breaking
│   ├── style-engine/src/       # Style cascade resolution
│   └── pm-adapter/src/         # ProseMirror integration
├── shared/
│   └── font-utils/             # Font resolution & loading
└── README.md
```

**Quick searches:**
```bash
# Find how they parse something
grep -r "w:hyperlink" ~/wysiwyg-editor/packages/
grep -r "parseRun" ~/wysiwyg-editor/packages/

# Read a specific file
cat ~/wysiwyg-editor/packages/super-editor/src/core/converters/v2/importer/docxImporter.js
```

**Learn the approach, write your own code.**

---

## OOXML Quick Reference

### Namespaces
- `w:` - WordprocessingML (main content)
- `a:` - DrawingML (graphics)
- `r:` - Relationships
- `wp:` - Word Drawing positioning
- `wps:` - Word Drawing shapes
- `m:` - Math

### Key Elements
| Element | Purpose |
|---------|---------|
| `w:document` | Root document |
| `w:body` | Main content |
| `w:p` | Paragraph |
| `w:pPr` | Paragraph properties |
| `w:r` | Run (text with formatting) |
| `w:rPr` | Run properties |
| `w:t` | Text content |
| `w:tbl` | Table |
| `w:hyperlink` | Hyperlink |
| `w:drawing` | Image/shape container |
| `w:fldSimple` | Simple field |
| `w:sectPr` | Section properties |

*(Add discoveries as you explore)*

---

## Discoveries

*(Document unexpected DOCX structures here as found)*

---

## Font Mappings

| DOCX Font | Google Font | CSS Fallback |
|-----------|-------------|--------------|
| Calibri | Carlito | Carlito, Calibri, sans-serif |
| Cambria | Caladea | Caladea, Cambria, serif |
| Arial | Arimo | Arimo, Arial, sans-serif |
| Times New Roman | Tinos | Tinos, Times New Roman, serif |
| Courier New | Cousine | Cousine, Courier New, monospace |

---

## Public API

```jsx
import DocxEditor, { DocumentAgent, loadFonts } from '@eigenpal/docx-editor';

// Optional: preload fonts
await loadFonts(['Roboto', 'Open Sans']);

// Editor component
<DocxEditor
  documentBuffer={buffer}
  onSave={(buf) => download(buf)}
  onChange={(doc) => console.log('Changed')}
  onAgentRequest={async (action, context) => {
    const result = await myAI.process(action, context);
    return { newText: result };
  }}
/>

// Programmatic API
const agent = new DocumentAgent(buffer);
agent.getText();
agent.getWordCount();
agent.insertText(pos, "Hello", { bold: true });
agent.insertTable(pos, 3, 4);
agent.applyStyle(range, "Heading 1");
const newBuffer = await agent.toBuffer();
```

---

**CRITICAL:** No WYSIWYG Editor imports. Custom implementation. Reference ~/wysiwyg-editor for learning only.

---

## Progress Log

### Session Start
**Date:** 2026-02-01
**Status:** Comprehensive 91-task plan across 14 phases

---

### US-02: DOCX exploration utility
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/explorer.ts` with:
- `exploreDocx(buffer): Promise<DocxExploration>` - Main exploration function
- `extractXml(exploration, path, format?)` - Extract and format XML files
- `printExplorationSummary(exploration)` - Console output for debugging
- `getKeyFiles(exploration)` - Quick check for key DOCX components

**DocxExploration interface includes:**
- `fileCount` - Total files in ZIP
- `totalSize` - Uncompressed size
- `files` - Array of DocxFileInfo with path, size, type flags
- `directories` - Files grouped by directory
- `xmlCache` - Pre-loaded XML content for quick access

**Key DOCX structure detected:**
- `[Content_Types].xml` - Content type declarations
- `word/document.xml` - Main document content
- `word/styles.xml` - Style definitions
- `word/theme/theme1.xml` - Theme colors and fonts
- `word/numbering.xml` - List definitions
- `word/fontTable.xml` - Font declarations
- `word/header*.xml`, `word/footer*.xml` - Headers/footers
- `word/footnotes.xml`, `word/endnotes.xml` - Notes
- `word/media/*` - Embedded images
- `word/_rels/document.xml.rels` - Relationships

---
