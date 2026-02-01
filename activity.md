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

## Using Subagents for Research

**Use Task tool with subagents for exploration - keeps context clean:**

```
# Explore WYSIWYG Editor implementation
Task(subagent_type="Explore", prompt="How does ~/wysiwyg-editor parse tables? Find tableParser and explain the approach.")

# Understand OOXML structure
Task(subagent_type="Explore", prompt="Explore word/numbering.xml structure in a sample DOCX. Document the XML format.")

# Research a feature
Task(subagent_type="Explore", prompt="How does WYSIWYG Editor resolve theme colors? Find the code and summarize.")
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

**CRITICAL:** No WYSIWYG Editor imports. Custom implementation. Reference ~/wysiwyg-editor for learning only.

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
- package.json with correct deps (no wysiwyg-editor): ✓
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
- package.json has correct deps (no wysiwyg-editor): ✓
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

### US-05: Font family resolver
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/utils/fontResolver.ts` with:

**Main Function:**
- `resolveFontFamily(docxFontName)` - Returns `{ googleFont, cssFallback, originalFont, hasGoogleEquivalent }`

**Font Mappings (Microsoft → Google):**
- Calibri → Carlito
- Cambria → Caladea
- Arial → Arimo
- Times New Roman → Tinos
- Courier New → Cousine
- Georgia → Tinos
- Verdana, Tahoma → Open Sans
- Trebuchet MS → Fira Sans
- Comic Sans MS → Comic Neue
- Consolas → Inconsolata
- CJK fonts → Noto font family

**Helper Functions:**
- `resolveThemeFont(themeRef, fontScheme)` - Resolve theme font references (majorAscii, minorHAnsi, etc.)
- `getGoogleFontsToLoad(docxFonts)` - Get unique Google Font names to load
- `buildFontFamilyString(fonts, category)` - Build CSS font-family with proper quoting
- `getGoogleFontEquivalent(docxFontName)` - Get Google Font name
- `hasGoogleFontEquivalent(docxFontName)` - Check if mapping exists

**Features:**
- Detects font category (serif/sans-serif/monospace) from font name
- Proper CSS font-family quoting
- Default fallback stacks by category

**Verified:**
- bun build exits 0: ✓

---

### US-06: Font extraction from DOCX
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/utils/fontExtractor.ts` with:

**Main Functions:**
- `extractFonts(doc)` - Extract all fonts from a parsed Document
- `extractFontsFromPackage(pkg)` - Extract fonts from DocxPackage (before full parsing)
- `getFontSummary(doc)` - Get categorized font usage (theme, styles, body)

**Scans For Fonts In:**
- Theme (majorFont, minorFont) from theme1.xml
- Style definitions (docDefaults, each style's rPr)
- Document body (paragraphs, tables)
- Headers and footers
- Footnotes and endnotes
- Hyperlinks and fields

**Font Sources:**
- w:rFonts (ascii, hAnsi, eastAsia, cs)
- Theme font scheme (latin, ea, cs fonts)
- Font table (fontTable.xml)

**Verified:**
- bun build exits 0: ✓

---

### US-07: XML parser utilities
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/xmlParser.ts` with:

**Core Functions:**
- `parseXml(xml)` - Parse XML string to element tree using xml-js
- `parseXmlDocument(xml)` - Parse and return root element

**Element Search Functions:**
- `findChild(parent, namespace, localName)` - Find first matching child
- `findChildren(parent, namespace, localName)` - Find all matching children
- `findChildByLocalName(parent, localName)` - Find by local name only
- `findChildrenByLocalName(parent, localName)` - Find all by local name
- `getChildElements(parent)` - Get all child elements
- `findDeep(root, namespace, localName)` - Recursive search
- `findAllDeep(root, namespace, localName)` - Find all recursively

**Attribute Functions:**
- `getAttribute(element, namespace, name)` - Get attribute value
- `getAttributeAny(element, names)` - Try multiple attribute names
- `getAttributes(element)` - Get all attributes
- `parseNumericAttribute(element, namespace, name, scale)` - Parse numeric
- `hasFlag(element, namespace, name)` - Check boolean attribute

**Content Functions:**
- `getTextContent(element)` - Get concatenated text content
- `parseBooleanElement(element)` - Parse OOXML boolean element
- `parseColorElement(element)` - Parse color with theme support

**Namespace Support:**
- All OOXML namespaces defined: w:, a:, r:, wp:, wps:, wpc:, wpg:, pic:, m:, mc:, v:, o:
- `getLocalName(name)` - Extract local name from prefixed name
- `getNamespacePrefix(name)` - Extract namespace prefix
- `matchesName(element, namespace, localName)` - Check element name

**Verified:**
- bun build exits 0: ✓

---

### US-11: Style parser with full inheritance
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/styleParser.ts` with comprehensive style parsing:

**Main Functions:**
- `parseStyles(stylesXml, theme)` - Returns StyleMap with resolved inheritance
- `parseStyleDefinitions(stylesXml, theme)` - Returns full StyleDefinitions including docDefaults

**Style Parsing:**
- Parses all style types: paragraph, character, table, numbering
- Parses complete run properties (w:rPr): bold, italic, underline, strike, vertAlign, caps, color, highlight, shading, fontSize, fontFamily with theme refs, spacing, effects, etc.
- Parses complete paragraph properties (w:pPr): alignment, spacing, indentation, borders, shading, tabs, keepNext/Lines, numPr, outlineLevel, etc.
- Parses table properties (w:tblPr): width, justification, borders, cellMargins, look flags
- Parses table row properties (w:trPr): height, header, cantSplit
- Parses table cell properties (w:tcPr): width, borders, margins, shading, vAlign, gridSpan, vMerge
- Parses conditional table formatting (w:tblStylePr)

**Inheritance Resolution:**
- `resolveStyleInheritance()` - Fully resolves basedOn chains
- `mergeTextFormatting()` - Deep merge for run properties
- `mergeParagraphFormatting()` - Deep merge for paragraph properties
- Circular inheritance protection with visited set

**DocDefaults:**
- `parseDocDefaults()` - Extracts default run and paragraph properties

**Helper Functions:**
- `getResolvedStyle(styleId, styleMap)` - Look up resolved style
- `getDefaultParagraphStyle(styleMap)` - Get default/Normal style
- `getDefaultCharacterStyle(styleMap)` - Get default character style
- `getStylesByType(styleMap, type)` - Get all styles of a type

**Verified:**
- bun build exits 0: ✓

---

### US-12: Numbering/List parser
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/numberingParser.ts` with comprehensive list/numbering parsing:

**Main Functions:**
- `parseNumbering(numberingXml: string | null): NumberingMap` - Main parsing function

**NumberingMap Interface:**
- `definitions` - Raw NumberingDefinitions with abstractNums and nums arrays
- `getLevel(numId, ilvl)` - Get level info for a numId and ilvl (with override resolution)
- `getAbstract(abstractNumId)` - Get abstract numbering by ID
- `hasNumbering(numId)` - Check if numId exists

**Parses All OOXML Structures:**
- `w:abstractNum` - Abstract numbering definitions with all levels (0-8)
- `w:num` - Numbering instances referencing abstractNum
- `w:lvl` - Level definitions with:
  - `ilvl` - Level index (0-8)
  - `start` - Starting value
  - `numFmt` - Number format (decimal, upperRoman, lowerRoman, upperLetter, lowerLetter, bullet, etc.)
  - `lvlText` - Pattern text with placeholders (%1, %2, etc.)
  - `lvlJc` - Justification
  - `suff` - Suffix (tab, space, nothing)
  - `isLgl` - Legal numbering
  - `lvlRestart` - Restart from higher level
  - `legacy` - Legacy settings
  - `pPr` - Paragraph properties (indentation, tabs)
  - `rPr` - Run properties (fonts for bullets)
- `w:lvlOverride` - Level overrides in num instances with startOverride or full lvl redefinition

**Number Formats Supported:**
- All standard formats: decimal, upperRoman, lowerRoman, upperLetter, lowerLetter
- Special formats: ordinal, cardinalText, ordinalText, bullet, none
- CJK formats: ideographDigital, japaneseCounting, aiueo, iroha, and many more
- International formats: hebrew, arabic, hindi, thai, russian, vietnamese, korean

**Helper Functions:**
- `formatNumber(num, format)` - Format a number according to NumberFormat
- `renderListMarker(lvlText, counters, formats)` - Render marker text with placeholders
- `getBulletCharacter(level)` - Get bullet character for bullet levels
- `isBulletLevel(level)` - Check if level is bullet (not numbered)

**Internal Utilities:**
- `toRoman(num)` - Convert to Roman numerals
- `toLetter(num)` - Convert to letter (a, b, ... z, aa, ab, ...)
- `toOrdinal(num)` - Convert to ordinal (1st, 2nd, 3rd, ...)

**Verified:**
- bun build exits 0: ✓

---

### US-13: Run parser with full formatting
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/runParser.ts` with comprehensive run parsing:

**Main Functions:**
- `parseRun(node, styles, theme): Run` - Main parsing function
- `parseRunProperties(rPr, theme, styles): TextFormatting` - Parse w:rPr element

**Parses ALL Run Properties (w:rPr):**
- w:b (bold), w:bCs (bold complex script)
- w:i (italic), w:iCs (italic complex script)
- w:u (underline with style and color)
- w:strike (strikethrough), w:dstrike (double strike)
- w:vertAlign (superscript/subscript/baseline)
- w:smallCaps, w:caps (capitalization)
- w:vanish (hidden text)
- w:color (text color with theme resolution)
- w:highlight (text highlight color)
- w:shd (character shading/background)
- w:sz, w:szCs (font size in half-points)
- w:rFonts (font family with theme resolution - ascii, hAnsi, eastAsia, cs, and theme refs)
- w:spacing (character spacing in twips)
- w:position (raised/lowered position)
- w:w (horizontal text scale)
- w:kern (kerning threshold)
- w:effect (text animation effects)
- w:em (emphasis marks)
- w:emboss, w:imprint, w:outline, w:shadow (text effects)
- w:rtl, w:cs (right-to-left and complex script)
- w:rStyle (character style reference)

**Parses All Run Content Types:**
- w:t (text content with space preservation)
- w:tab (tab characters)
- w:br (line/page/column breaks)
- w:sym (symbol characters)
- w:footnoteReference, w:endnoteReference
- w:fldChar (field characters: begin/separate/end)
- w:instrText (field instruction text)
- w:softHyphen, w:noBreakHyphen
- w:drawing (images - placeholder, full parsing in US-20)
- w:cr (carriage return)

**Helper Functions:**
- `getRunText(run)` - Get plain text from a run
- `hasContent(run)` - Check if run has visible content
- `hasImage(run)` - Check if run contains an image
- `getImages(run)` - Get all images from a run
- `hasFieldChar(run)` - Check if run is part of a complex field
- `getFieldCharType(run)` - Get field character type

**Verified:**
- bun build exits 0: ✓

---
