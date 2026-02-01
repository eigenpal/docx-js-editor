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
2. **Reference ~/superdoc when unsure** - it's a working implementation
3. Document findings here
4. Implement parser + renderer (your own code)
5. Adapt plan as needed

---

## SuperDoc Reference Guide

**Always check ~/superdoc when unsure how to implement something:**

```
~/superdoc/
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
grep -r "w:hyperlink" ~/superdoc/packages/
grep -r "parseRun" ~/superdoc/packages/

# Read a specific file
cat ~/superdoc/packages/super-editor/src/core/converters/v2/importer/docxImporter.js
```

**Learn the approach, write your own code.**

---

## Using Subagents for Research

**Use Task tool with subagents for exploration - keeps context clean:**

```
# Explore SuperDoc implementation
Task(subagent_type="Explore", prompt="How does ~/superdoc parse tables? Find tableParser and explain the approach.")

# Understand OOXML structure
Task(subagent_type="Explore", prompt="Explore word/numbering.xml structure in a sample DOCX. Document the XML format.")

# Research a feature
Task(subagent_type="Explore", prompt="How does SuperDoc resolve theme colors? Find the code and summarize.")
```

Subagents return concise summaries you can act on.

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

**CRITICAL:** No SuperDoc imports. Custom implementation. Reference ~/superdoc for learning only.

---

## Progress Log

### Session Start
**Date:** 2026-02-01
**Status:** Comprehensive 91-task plan across 14 phases

---

### US-01: Project scaffold
**Date:** 2026-02-01
**Status:** Complete ✅

Verified existing project scaffold meets all acceptance criteria:
- package.json with correct deps (no superdoc): ✓
- tsconfig.json with jsx: react-jsx: ✓
- src/index.ts entry point: ✓
- bun build exits 0: ✓

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

### US-03: Comprehensive document types
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/types/document.ts` with comprehensive TypeScript types for full DOCX representation:

**Core Types:**
- `Document`, `DocxPackage`, `DocumentBody`, `Section`
- `SectionProperties` (page size, margins, borders, columns, headers/footers)

**Paragraph & Text:**
- `Paragraph`, `ParagraphFormatting` (alignment, spacing, indent, borders, shading, tabs, keepNext, keepLines, widowControl, bidi, numPr)
- `Run`, `TextFormatting` (bold, italic, underline, strike, dstrike, superscript/subscript, smallCaps, allCaps, highlight, shading, color, fontSize, fontFamily, spacing, effects)
- `RunContent`, `TextContent`, `TabContent`, `BreakContent`, `SymbolContent`

**Links & Bookmarks:**
- `Hyperlink`, `BookmarkStart`, `BookmarkEnd`

**Fields:**
- `Field`, `SimpleField`, `ComplexField`, `FieldType` (PAGE, NUMPAGES, DATE, DOCPROPERTY, REF, TOC, etc.)

**Tables:**
- `Table`, `TableRow`, `TableCell`
- `TableFormatting`, `TableRowFormatting`, `TableCellFormatting`
- `TableBorders`, `CellMargins`, `TableLook`, `FloatingTableProperties`
- `ConditionalFormatStyle` for table style conditional formatting

**Images:**
- `Image`, `ImageSize`, `ImageWrap`, `ImagePosition`, `ImageTransform`, `ImagePadding`

**Shapes:**
- `Shape`, `ShapeType` (rect, ellipse, line, arrows, flowcharts, etc.)
- `ShapeFill`, `ShapeOutline`, `ShapeTextBody`

**Text Boxes:**
- `TextBox` with size, position, fill, outline, and content

**Lists:**
- `NumberingDefinitions`, `AbstractNumbering`, `NumberingInstance`
- `ListLevel`, `NumberFormat`, `ListRendering`

**Headers/Footers:**
- `HeaderFooter`, `HeaderReference`, `FooterReference`, `HeaderFooterType`

**Footnotes/Endnotes:**
- `Footnote`, `Endnote`, `FootnoteReference`
- `FootnoteProperties`, `EndnoteProperties`

**Supporting Types:**
- `Theme`, `ThemeColor`, `ThemeColorScheme`, `ThemeFontScheme`
- `Style`, `StyleDefinitions`, `DocDefaults`, `StyleType`
- `FontTable`, `FontInfo`
- `Relationship`, `RelationshipMap`, `MediaFile`
- `BorderSpec`, `ShadingProperties`, `ColorValue`

Created `src/types/index.ts` to export all types.

---

### Fresh Start
**Date:** 2026-02-01
**Status:** Source files were deleted - restarting from US-01

Previous implementations were lost. Starting fresh with clean implementation.

---

### US-01: Project scaffold (Fresh)
**Date:** 2026-02-01
**Status:** Complete ✅

Recreated project scaffold:
- `src/index.ts` - Main entry point with version export
- `src/types/index.ts` - Types barrel export (placeholder)
- `src/main.tsx` - React app entry point for demo

**Verified:**
- package.json has correct deps (no superdoc): ✓
- tsconfig.json with jsx: react-jsx: ✓
- src/index.ts entry point: ✓
- bun build exits 0: ✓

---

### US-02: DOCX exploration utility (Fresh)
**Date:** 2026-02-01
**Status:** Complete ✅

`src/docx/explorer.ts` exists with:
- `exploreDocx(buffer): Promise<DocxExploration>` - Main exploration function
- `extractXml(exploration, path, format?)` - Extract and format XML files
- `printExplorationSummary(exploration)` - Console output for debugging
- `getKeyFiles(exploration)` - Quick check for key DOCX components
- `extractBinary(exploration, path)` - Extract binary files (images, etc.)
- `getXmlPaths(exploration)` - List all XML paths
- `getMediaPaths(exploration)` - List all media paths

**Verified:**
- bun build exits 0: ✓

---

### US-03: Comprehensive document types (Fresh)
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/types/document.ts` with comprehensive TypeScript types (~1500 lines):

**Color & Styling Primitives:**
- `ThemeColorSlot`, `ColorValue`, `BorderSpec`, `ShadingProperties`

**Text Formatting (rPr):**
- `TextFormatting` with: bold, italic, underline (with styles), strike, doubleStrike, vertAlign (superscript/subscript), smallCaps, allCaps, hidden, color, highlight, shading, fontSize, fontFamily (with theme support), spacing, position, scale, kerning, effects, rtl, cs, styleId

**Paragraph Formatting (pPr):**
- `ParagraphFormatting` with: alignment, bidi, spacing (before/after/line), indentation (left/right/firstLine/hanging), borders (top/bottom/left/right/between/bar), shading, tabs, keepNext, keepLines, widowControl, pageBreakBefore, numPr, outlineLevel, styleId, frame properties

**Run Content Types:**
- `TextContent`, `TabContent`, `BreakContent`, `SymbolContent`, `NoteReferenceContent`, `FieldCharContent`, `InstrTextContent`, `SoftHyphenContent`, `NoBreakHyphenContent`, `DrawingContent`, `ShapeContent`

**Document Elements:**
- `Run`, `Hyperlink`, `BookmarkStart`, `BookmarkEnd`
- `SimpleField`, `ComplexField` with all `FieldType` values
- `Image` with size, wrap, position, transform, padding
- `Shape` with all shape types, fill, outline, text body
- `TextBox`

**Tables:**
- `Table`, `TableRow`, `TableCell`
- `TableFormatting`, `TableRowFormatting`, `TableCellFormatting`
- `TableBorders`, `CellMargins`, `TableLook`, `FloatingTableProperties`

**Lists & Numbering:**
- `ListLevel`, `AbstractNumbering`, `NumberingInstance`
- `NumberingDefinitions`, `ListRendering`
- All `NumberFormat` types

**Headers, Footers, Notes:**
- `HeaderFooter`, `HeaderReference`, `FooterReference`
- `Footnote`, `Endnote`, `FootnoteProperties`, `EndnoteProperties`

**Document Structure:**
- `Paragraph`, `ParagraphContent`
- `Section`, `SectionProperties` (page size, margins, columns, headers/footers, line numbers, page borders, background)
- `DocumentBody`, `BlockContent`

**Supporting Types:**
- `Style`, `DocDefaults`, `StyleDefinitions`
- `Theme`, `ThemeColorScheme`, `ThemeFontScheme`
- `FontInfo`, `FontTable`
- `Relationship`, `RelationshipMap`
- `MediaFile`
- `DocxPackage`, `Document`

Updated `src/types/index.ts` to export all types.

**Verified:**
- bun build exits 0: ✓

---

### US-04: Google Fonts loader
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/utils/fontLoader.ts` with:

**Main Functions:**
- `loadFont(fontFamily, options?)` - Load a single font from Google Fonts
- `loadFonts(families, options?)` - Load multiple fonts in parallel
- `isFontLoaded(fontFamily)` - Check if a font is loaded
- `onFontsLoaded(callback)` - Register callback for font load notifications
- `isLoading()` - Check if any fonts are currently loading
- `getLoadedFonts()` - Get list of all loaded fonts

**Additional Utilities:**
- `canRenderFont(fontFamily)` - Canvas-based font availability detection
- `loadFontFromBuffer(fontFamily, buffer, options?)` - Load font from raw buffer (for embedded DOCX fonts)
- `preloadCommonFonts()` - Preload common document fonts (Carlito, Caladea, Arimo, Tinos, Cousine)

**Features:**
- Uses Google Fonts CSS2 API with `display=swap`
- Tracks loaded fonts to avoid duplicate requests
- Tracks loading state with promises for concurrent requests
- Uses CSS Font Loading API with canvas fallback
- Supports custom weights and styles
- Timeout handling for slow loads

**Verified:**
- bun build exits 0: ✓

---
