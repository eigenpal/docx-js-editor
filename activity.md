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

### US-14: Paragraph parser with full formatting
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/paragraphParser.ts` with comprehensive paragraph parsing:

**Main Functions:**
- `parseParagraph(node, styles, theme, numbering): Paragraph` - Main parsing function
- `parseParagraphProperties(pPr, theme, styles): ParagraphFormatting` - Parse w:pPr element

**Parses ALL Paragraph Properties (w:pPr):**
- w:jc (alignment: left, center, right, both/justify, distribute)
- w:bidi (right-to-left text direction)
- w:spacing (before, after, line, lineRule, beforeAutospacing, afterAutospacing)
- w:ind (left, right, firstLine, hanging, start, end)
- w:pBdr (paragraph borders: top, bottom, left, right, between, bar)
- w:shd (paragraph shading/background)
- w:tabs (tab stops with position, alignment, leader)
- w:keepNext, w:keepLines, w:widowControl, w:pageBreakBefore (page break control)
- w:numPr (numbering/list properties: numId, ilvl)
- w:outlineLvl (outline level for TOC)
- w:pStyle (paragraph style reference)
- w:framePr (frame properties: width, height, anchors, alignment, wrap)
- w:suppressLineNumbers, w:suppressAutoHyphens
- w:rPr (default run properties for paragraph)

**Parses All Paragraph Content Types:**
- w:r (runs via parseRun)
- w:hyperlink (with rId, anchor, tooltip, target, history, docLocation)
- w:bookmarkStart, w:bookmarkEnd (bookmark markers with id, name, column info)
- w:fldSimple (simple fields with instruction, content)
- Complex fields (w:fldChar begin/separate/end with w:instrText) - properly tracked and assembled

**Field Type Detection:**
- Recognizes all OOXML field types: PAGE, NUMPAGES, DATE, TIME, REF, HYPERLINK, TOC, MERGEFIELD, etc.
- Parses field instructions to determine type
- Tracks field lock and dirty states

**List Rendering Computation:**
- If paragraph has numPr, looks up numbering level from NumberingMap
- Populates listRendering with: isListItem, level, marker, isBullet, indent, hanging

**Utility Functions:**
- `getParagraphText(paragraph)` - Get plain text from paragraph (including hyperlinks and fields)
- `isEmptyParagraph(paragraph)` - Check if paragraph has no visible content
- `isListItem(paragraph)` - Check if paragraph is a list item
- `getListLevel(paragraph)` - Get list level (0-8)
- `hasStyle(paragraph, styleId)` - Check if paragraph has specific style
- `getTemplateVariable(paragraph)` - Extract {{variable}} from text

**Verified:**
- bun build exits 0: ✓

---

### US-15: Tab stop parser
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/tabParser.ts` with comprehensive tab stop handling:

**Main Functions:**
- `parseTabStop(tab)` - Parse a single tab stop element (w:tab within w:tabs)
- `parseTabStops(tabs)` - Parse tab stops container (w:tabs), returns sorted array
- `parseTabStopsFromParagraphProperties(pPr)` - Parse tabs from w:pPr element

**Tab Stop Resolution:**
- `mergeTabStops(styleTabs, directTabs)` - Merge tabs from style and direct formatting
- `getNextTabStop(currentPosition, tabStops, pageWidth)` - Get next tab stop for position
- `findTabStopAtPosition(position, tabStops)` - Find tab at specific position

**Width Calculation:**
- `calculateTabWidth(currentPosition, tabStops, pageWidth)` - Simple width calculation
- `calculateTabWidthWithAlignment(...)` - Width considering alignment (center, right, decimal)

**Leader Character Utilities:**
- `getLeaderCharacter(leader)` - Get the fill character (dot, hyphen, underscore, middleDot)
- `hasVisibleLeader(leader)` - Check if leader needs visible characters
- `generateLeaderString(leader, widthInChars)` - Generate leader fill string

**Default Tab Stops:**
- `generateDefaultTabStops(pageWidth, interval)` - Generate implicit tab stops
- `getEffectiveTabStops(explicitTabs, pageWidth)` - Combine explicit and default tabs
- `DEFAULT_TAB_INTERVAL_TWIPS` = 720 (0.5 inches)

**Validation:**
- `isValidTabAlignment(value)` - Type guard for TabStopAlignment
- `isValidTabLeader(value)` - Type guard for TabLeader

**OOXML Reference:**
- Tab stops are defined in `w:tabs` element within `w:pPr`
- Each `w:tab` has: `w:val` (alignment), `w:pos` (position in twips), `w:leader` (optional)
- Alignment types: left, center, right, decimal, bar, clear, num
- Leader types: none, dot, hyphen, underscore, heavy, middleDot
- Tab characters in runs are `w:tab` (different from tab stop definitions)

**Verified:**
- bun build exits 0: ✓

---

### US-16: Hyperlink parser
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/hyperlinkParser.ts` with comprehensive hyperlink parsing:

**Main Function:**
- `parseHyperlink(node, rels, styles?, theme?): Hyperlink` - Parse w:hyperlink element with URL resolution

**Features:**
- Resolves r:id to actual URL via RelationshipMap
- External links: Uses r:id → looks up in rels → gets target URL (for External targetMode)
- Internal links: Uses w:anchor → creates #anchor href for bookmark links
- Extracts tooltip (w:tooltip attribute)
- Extracts target frame (w:tgtFrame - _blank, _self, etc.)
- Extracts history tracking (w:history)
- Extracts document location (w:docLocation)
- Parses child runs for display text
- Handles nested bookmarks within hyperlinks

**Utility Functions:**
- `getHyperlinkText(hyperlink)` - Get plain text from hyperlink
- `isExternalLink(hyperlink)` - Check if URL is external (http/mailto/tel)
- `isInternalLink(hyperlink)` - Check if link points to internal bookmark
- `getHyperlinkUrl(hyperlink)` - Get resolved URL
- `hasContent(hyperlink)` - Check if hyperlink has child runs
- `getHyperlinkRuns(hyperlink)` - Get all runs from hyperlink
- `resolveHyperlinkUrl(hyperlink, rels)` - Resolve URL post-parsing
- `createInternalHyperlink(anchor, children, options?)` - Create bookmark link
- `createExternalHyperlink(url, children, options?)` - Create external link

**Integration:**
- Updated `paragraphParser.ts` to use new `hyperlinkParser.ts` module
- Added `rels` parameter to `parseParagraph()` function signature
- Updated `parseParagraphContents()` to pass relationships for URL resolution

**OOXML Reference:**
- w:hyperlink element contains r:id (external) or w:anchor (internal)
- External links stored in word/_rels/document.xml.rels with TargetMode="External"
- Internal links reference bookmarks by name

**Verified:**
- bun build exits 0: ✓

---

### US-17: Bookmark parser
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/bookmarkParser.ts` with comprehensive bookmark parsing:

**Main Functions:**
- `parseBookmarkStart(node): BookmarkStart` - Parse w:bookmarkStart element
- `parseBookmarkEnd(node): BookmarkEnd` - Parse w:bookmarkEnd element

**BookmarkMap Interface:**
- `byId: Map<number, BookmarkStart>` - Lookup by ID
- `byName: Map<string, BookmarkStart>` - Lookup by name (for hyperlink resolution)
- `bookmarks: BookmarkStart[]` - All bookmarks in document order

**Bookmark Collection Functions:**
- `createBookmarkMap()` - Create empty bookmark map
- `addBookmark(map, bookmark)` - Add bookmark to map
- `getBookmarkByName(map, name)` - Get bookmark by name
- `getBookmarkById(map, id)` - Get bookmark by ID
- `hasBookmark(map, name)` - Check if bookmark exists
- `getAllBookmarkNames(map)` - Get all bookmark names

**Utility Functions:**
- `isPointBookmark(start, end, contents)` - Check if bookmark is point bookmark
- `isTableBookmark(bookmark)` - Check if bookmark has column range
- `bookmarkToHref(name)` - Convert name to #anchor href
- `hrefToBookmarkName(href)` - Extract name from href

**Built-in Bookmark Detection:**
- `isBuiltInBookmark(name)` - Check for Word internal bookmarks (_*)
- `isTocBookmark(name)` - Check for _Toc* bookmarks
- `isRefBookmark(name)` - Check for _Ref* bookmarks
- `getBookmarkType(name)` - Returns 'user' | 'toc' | 'ref' | 'goBack' | 'internal'

**Validation:**
- `validateBookmarkPairs(starts, ends)` - Check start/end matching
- `validateBookmarkName(name)` - Validate name format (40 char limit, alphanumeric)

**Integration:**
- Updated `paragraphParser.ts` to import and use `bookmarkParser.ts` module
- Delegates parseBookmarkStart/End to the new module

**OOXML Reference:**
- w:bookmarkStart: id (numeric), name (string), colFirst/colLast (optional)
- w:bookmarkEnd: id (numeric, matches start)
- Internal hyperlinks reference bookmarks via w:anchor attribute

**Verified:**
- bun build exits 0: ✓

---

### US-18: Field parser
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/fieldParser.ts` with comprehensive field parsing:

**Main Functions:**
- `parseFieldType(instruction)` - Extract field type from instruction string
- `parseFieldInstruction(instruction)` - Full instruction parsing with arguments and switches
- `parseSimpleField(node, styles, theme)` - Parse w:fldSimple elements

**Field Type Detection:**
- All known field types defined in `KNOWN_FIELD_TYPES` constant
- Recognizes: PAGE, NUMPAGES, DATE, TIME, CREATEDATE, SAVEDATE, PRINTDATE, EDITTIME
- Document properties: AUTHOR, TITLE, SUBJECT, KEYWORDS, FILENAME, DOCPROPERTY
- Cross-references: REF, PAGEREF, NOTEREF, HYPERLINK
- TOC/Index: TOC, TOA, INDEX
- Mail merge: MERGEFIELD, IF, NEXT, NEXTIF, ASK, SET
- Numbering: SEQ, STYLEREF, AUTONUM

**Field Instruction Parsing:**
- `ParsedFieldInstruction` interface with type, raw, argument, switches
- `FieldSwitch` interface for parsed switches
- `getFormatSwitch(instruction)` - Get format switch (\* or \@)
- `hasMergeFormat(instruction)` - Check for MERGEFORMAT preservation

**Complex Field State Tracking:**
- `ComplexFieldContext` interface for tracking parsing state
- `createComplexFieldContext()` - Initialize new context
- `resetComplexFieldContext(ctx)` - Reset for new field
- `finalizeComplexField(ctx)` - Create ComplexField from context

**Field Value Extraction:**
- `getFieldDisplayValue(field)` - Get current display text
- `isPageNumberField(field)` - Check if PAGE field
- `isTotalPagesField(field)` - Check if NUMPAGES field
- `isDateTimeField(field)` - Check for date/time fields
- `isDocPropertyField(field)` - Check for document property fields
- `isReferenceField(field)` - Check for cross-reference fields
- `isMergeField(field)` - Check for mail merge fields
- `isHyperlinkField(field)` - Check for HYPERLINK fields
- `isTocField(field)` - Check for TOC/index fields

**Field Value Computation:**
- `computePageNumber(pageNumber, instruction)` - Format page numbers
- `formatDate(date, format)` - Format dates using OOXML format codes
- `toRoman(num)` - Convert to Roman numerals
- `toLetter(num)` - Convert to letter (A-Z, AA-AZ, etc.)

**Field Collection Utilities:**
- `collectFields(content)` - Collect all fields from content array
- `getFieldsByType(fields, type)` - Filter fields by type
- `getPageNumberFields(fields)` - Get all PAGE fields
- `getMergeFields(fields)` - Get all MERGEFIELD fields
- `getMergeFieldNames(fields)` - Extract merge field names

**Verified:**
- bun build exits 0: ✓

---

### US-19: Table parser
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/tableParser.ts` with comprehensive table parsing:

**Main Functions:**
- `parseTable(node, styles, theme, numbering, rels, media)` - Parse w:tbl element
- `parseTableRow(node, styles, theme, numbering, rels, media)` - Parse w:tr element
- `parseTableCell(node, styles, theme, numbering, rels, media)` - Parse w:tc element

**Table Properties (w:tblPr):**
- `parseTableProperties(element)` - Full table property parsing
- Width, justification, cell spacing, indent
- Table borders, default cell margins
- Layout (fixed/autofit), style ID
- Table look flags, shading
- Floating table properties (w:tblpPr)
- Bidirectional support

**Row Properties (w:trPr):**
- `parseTableRowProperties(element)` - Row property parsing
- Row height with height rule
- Header row, can't split
- Row justification, hidden

**Cell Properties (w:tcPr):**
- `parseTableCellProperties(element)` - Cell property parsing
- Cell width, borders, margins
- Shading, vertical alignment
- Text direction
- Grid span (horizontal merge)
- Vertical merge (restart/continue)
- Fit text, no wrap, hide mark
- Conditional format style

**Supporting Parsers:**
- `parseTableMeasurement(element)` - Width/height values
- `parseBorderSpec(element)` - Individual border
- `parseTableBorders(element)` - All borders
- `parseCellMargins(element)` - Cell margins
- `parseShading(element)` - Background shading
- `parseTableLook(element)` - Style flags
- `parseFloatingTableProperties(element)` - Floating positioning
- `parseConditionalFormatStyle(element)` - Conditional formatting
- `parseTableGrid(element)` - Column widths

**Table Utilities:**
- `getTableColumnCount(table)` - Count columns
- `getTableRowCount(table)` - Count rows
- `isCellMergeContinuation(cell)` - Check vertical merge
- `isCellMergeStart(cell)` - Check merge start
- `isCellHorizontallyMerged(cell)` - Check gridSpan
- `getTableText(table)` - Plain text extraction
- `hasHeaderRow(table)` - Check for header
- `getHeaderRows(table)` - Get all headers
- `isFloatingTable(table)` - Check floating

**Features:**
- Full cell content parsing (paragraphs, nested tables)
- Recursive nested table support
- Horizontal merge via gridSpan
- Vertical merge via vMerge (restart/continue)
- Floating table positioning
- Conditional formatting for table styles

**Verified:**
- bun build exits 0: ✓

---

### US-20: Image parser
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/imageParser.ts` with comprehensive image parsing:

**Main Functions:**
- `parseImage(node, rels, media): Image | null` - Main entry point for image parsing
- `parseDrawing(drawingEl, rels, media)` - Parse w:drawing element
- `parseInline(inlineEl, rels, media)` - Parse wp:inline (inline images)
- `parseAnchor(anchorEl, rels, media)` - Parse wp:anchor (floating images)

**EMU Conversions:**
- `emuToPixels(emu)` - Convert EMU to CSS pixels (914400 EMU = 1 inch, 96 DPI)
- `pixelsToEmu(px)` - Convert pixels back to EMU

**Size & Position Parsing:**
- `parseExtent(extent)` - Parse wp:extent for image dimensions
- `parseEffectExtent(effectExtent)` - Parse effect margins
- `parsePositionH(posH)` - Parse horizontal position for anchored images
- `parsePositionV(posV)` - Parse vertical position for anchored images

**Wrap Mode Parsing:**
- `parseWrapElement(wrapEl, behindDoc)` - Parse wrap mode
- Supports: wrapNone, wrapSquare, wrapTight, wrapThrough, wrapTopAndBottom
- Extracts wrap distances (distT, distB, distL, distR)
- Maps to ImageWrap types: inline, square, tight, through, topAndBottom, behind, inFront

**Transform Parsing:**
- `parseTransform(xfrm)` - Parse a:xfrm for rotation and flip
- Rotation in 60000ths of a degree → degrees

**Blip Extraction:**
- `findBlipElement(container)` - Navigate to a:blip (a:graphic → a:graphicData → pic:pic → pic:blipFill → a:blip)
- `extractBlipRId(blip)` - Extract r:embed or r:link attribute

**Media Resolution:**
- `resolveImageData(rId, rels, media)` - Resolve rId to actual image data
- `normalizeMediaPath(targetPath)` - Normalize paths to word/media/...
- `getMimeType(path)` - Get MIME type from extension

**Document Properties:**
- `parseDocProps(docPr)` - Extract id, name, alt text, title, decorative flag

**Utility Functions:**
- `isInlineImage(image)`, `isFloatingImage(image)` - Check image type
- `isBehindText(image)`, `isInFrontOfText(image)` - Check z-order
- `getImageWidthPx(image)`, `getImageHeightPx(image)` - Get dimensions in pixels
- `getImageDimensionsPx(image)` - Get both dimensions
- `hasAltText(image)`, `isDecorativeImage(image)` - Accessibility checks
- `getWrapDistancesPx(image)` - Get wrap distances in pixels
- `needsTextWrapping(image)` - Check if text wrapping needed

**OOXML Structure Reference:**
```
w:drawing
  └── wp:inline or wp:anchor
      ├── wp:extent (size: cx, cy in EMUs)
      ├── wp:effectExtent (effect margins)
      ├── wp:docPr (document properties: id, name, descr, title)
      ├── wp:positionH / wp:positionV (for anchor only)
      ├── wp:wrap* (wrapping mode for anchor)
      └── a:graphic
          └── a:graphicData
              └── pic:pic
                  ├── pic:nvPicPr (non-visual properties)
                  ├── pic:blipFill
                  │   └── a:blip (r:embed = rId)
                  └── pic:spPr
                      └── a:xfrm (transform: rotation, flip)
```

**Verified:**
- bun build exits 0: ✓

---

### US-21: Shape parser
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/shapeParser.ts` with comprehensive shape parsing:

**Main Functions:**
- `parseShape(node): Shape` - Parse wps:wsp element
- `parseShapeFromDrawing(drawingEl): Shape | null` - Parse shape from w:drawing container
- `isShapeDrawing(drawingEl)` - Check if drawing contains a shape (not an image)

**Shape Properties Parsing (wps:spPr):**
- `parseShapeType(spPr)` - Extract preset geometry from a:prstGeom[@prst]
- `parseFill(spPr, style)` - Parse fill (solid, gradient, pattern, none)
- `parseOutline(spPr, style)` - Parse outline/stroke (color, width, style, arrows)
- `parseTransform(xfrm)` - Parse a:xfrm for size, rotation, flip

**Fill Types Supported:**
- Solid fill (a:solidFill) with theme and RGB colors
- Gradient fill (a:gradFill) with linear/radial/path types and stops
- Pattern fill (a:pattFill)
- Picture fill (a:blipFill)
- No fill (a:noFill)
- Style reference fallback (wps:style/a:fillRef)

**Color Parsing:**
- `parseColorElement(element)` - Parse DrawingML colors
- Theme colors (a:schemeClr) with accent1-6, dk1, lt1, dk2, lt2, etc.
- RGB colors (a:srgbClr)
- System colors (a:sysClr)
- Preset colors (a:prstClr)
- Color modifiers (a:shade, a:tint, a:lumMod)

**Outline Parsing:**
- Line width in EMUs
- Line color (solid fill)
- Line dash style (solid, dot, dash, etc.)
- Line cap and join styles
- Arrow heads (a:headEnd, a:tailEnd) with type, width, length

**Text Box Parsing:**
- `parseBodyProperties(bodyPr)` - Parse wps:bodyPr
- Vertical text direction
- Anchor/vertical alignment (top, middle, bottom)
- Auto fit modes
- Text margins/insets
- `parseTextBoxContent(txbxContent)` - Parse w:txbxContent (placeholder for paragraph parsing)

**Position and Wrap (for anchored shapes):**
- `parseAnchorPosition(anchor)` - Parse wp:positionH/V
- `parseWrap(anchor)` - Parse wrap mode (none, square, tight, through, topAndBottom)

**Utility Functions:**
- `isLineShape(shape)` - Check if shape is a line/connector
- `isTextBoxShape(shape)` - Check if shape is a text box
- `hasTextContent(shape)` - Check if shape has text
- `getShapeWidthPx(shape)`, `getShapeHeightPx(shape)` - Get dimensions in pixels
- `getShapeDimensionsPx(shape)` - Get both dimensions
- `isFloatingShape(shape)` - Check if shape is anchored
- `hasFill(shape)`, `hasOutline(shape)` - Check for styling
- `getOutlineWidthPx(shape)` - Get outline width in pixels
- `resolveFillColor(shape)` - Resolve fill to CSS color
- `resolveOutlineColor(shape)` - Resolve outline to CSS color

**OOXML Structure Reference:**
```
w:drawing
  └── wp:inline or wp:anchor
      └── a:graphic
          └── a:graphicData
              └── wps:wsp (shape)
                  ├── wps:cNvSpPr (non-visual properties)
                  ├── wps:spPr (shape properties)
                  │   ├── a:xfrm (transform)
                  │   ├── a:prstGeom (preset geometry)
                  │   ├── a:solidFill / a:noFill / a:gradFill
                  │   └── a:ln (line/outline)
                  ├── wps:style (style reference)
                  ├── wps:txbx
                  │   └── w:txbxContent (text)
                  └── wps:bodyPr (body properties)
```

**Verified:**
- bun build exits 0: ✓

---

### US-22: Text box parser
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/textBoxParser.ts` with comprehensive text box parsing:

**Main Functions:**
- `parseTextBox(drawingEl)` - Parse text box from w:drawing element
- `parseTextBoxFromShape(wsp, size, position?, wrap?)` - Parse from shape element directly
- `parseTextBoxContent(txbxContent, parseParagraph, parseTable, ...)` - Parse content with external parsers
- `extractTextBoxContentElements(txbxContent)` - Extract raw paragraph/table elements
- `getTextBoxContentElement(wsp)` - Get w:txbxContent element from shape

**Detection Functions:**
- `isTextBoxDrawing(drawingEl)` - Check if drawing contains a text box
- `isShapeTextBox(wsp)` - Check if a shape element is a text box

**Parsing Components:**
- Position parsing (horizontal/vertical with posOffset and alignment)
- Wrap settings (square, tight, through, topAndBottom, behind, inFront)
- Fill parsing (solid, gradient, none)
- Outline parsing (width, color, style)
- Body properties (margins/insets)

**Utility Functions:**
- `getTextBoxWidthPx(textBox)`, `getTextBoxHeightPx(textBox)` - Get dimensions in pixels
- `getTextBoxDimensionsPx(textBox)` - Get both dimensions
- `getTextBoxMarginsPx(textBox)` - Get margins in pixels
- `isFloatingTextBox(textBox)` - Check if text box is anchored
- `hasTextBoxFill(textBox)`, `hasTextBoxOutline(textBox)` - Check for styling
- `hasTextBoxContent(textBox)` - Check if text box has content
- `getTextBoxText(textBox)` - Get plain text for search/indexing
- `resolveTextBoxFillColor(textBox)` - Resolve fill to CSS color
- `resolveTextBoxOutlineColor(textBox)` - Resolve outline to CSS color
- `getTextBoxOutlineWidthPx(textBox)` - Get outline width in pixels

**Design Notes:**
- Avoids circular dependencies by accepting parser functions as parameters
- Content parsing delegated to document parser via `parseTextBoxContent()`
- Uses placeholder content array that document parser fills in

**OOXML Structure Reference:**
```
w:drawing
  └── wp:inline or wp:anchor
      └── a:graphic
          └── a:graphicData
              └── wps:wsp (shape)
                  ├── wps:spPr (shape properties)
                  │   ├── a:xfrm (transform: position, size)
                  │   ├── a:prstGeom (preset geometry)
                  │   ├── a:solidFill / a:noFill
                  │   └── a:ln (outline)
                  ├── wps:txbx (text box container)
                  │   └── w:txbxContent (text content)
                  │       ├── w:p (paragraphs)
                  │       └── w:tbl (tables)
                  └── wps:bodyPr (body properties - margins)
```

**Verified:**
- bun build exits 0: ✓

---

### US-23: Footnote/Endnote parser
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/footnoteParser.ts` with comprehensive footnote and endnote parsing:

**Main Functions:**
- `parseFootnotes(xml, styles?, theme?, numbering?, rels?, media?)` - Parse word/footnotes.xml
- `parseEndnotes(xml, styles?, theme?, numbering?, rels?, media?)` - Parse word/endnotes.xml
- `parseFootnoteProperties(element)` - Parse w:footnotePr from section properties
- `parseEndnoteProperties(element)` - Parse w:endnotePr from section properties

**FootnoteMap Interface:**
- `byId: Map<number, Footnote>` - Lookup by ID
- `footnotes: Footnote[]` - All footnotes in document order
- `getFootnote(id)` - Get footnote by ID
- `hasFootnote(id)` - Check if footnote exists
- `getNormalFootnotes()` - Get non-separator footnotes
- `getSeparator()` - Get separator footnote if exists
- `getContinuationSeparator()` - Get continuation separator

**EndnoteMap Interface:**
- Same structure as FootnoteMap but for endnotes

**Note Types Supported:**
- `normal` - Regular footnote/endnote content
- `separator` - Line separating notes from body text
- `continuationSeparator` - Separator for continued notes
- `continuationNotice` - Notice for continued notes

**Properties Parsing:**
- Position (pageBottom, beneathText, sectEnd, docEnd)
- Number format (decimal, upperRoman, lowerRoman, etc.)
- Start number (numStart)
- Number restart (continuous, eachSect, eachPage)

**Utility Functions:**
- `getFootnoteText(footnote)` - Get plain text content
- `getEndnoteText(endnote)` - Get plain text content
- `isSeparatorFootnote(footnote)` - Check if separator type
- `isSeparatorEndnote(endnote)` - Check if separator type
- `getFootnoteDisplayNumber(footnote, map, startNumber)` - Get display number
- `getEndnoteDisplayNumber(endnote, map, startNumber)` - Get display number
- `createEmptyFootnoteMap()` - Create empty map
- `createEmptyEndnoteMap()` - Create empty map
- `mergeFootnoteMaps(...maps)` - Merge multiple footnote maps
- `mergeEndnoteMaps(...maps)` - Merge multiple endnote maps

**OOXML Structure Reference:**
```
word/footnotes.xml:
  w:footnotes
    └── w:footnote[@w:id][@w:type]
        └── w:p (paragraphs)

word/endnotes.xml:
  w:endnotes
    └── w:endnote[@w:id][@w:type]
        └── w:p (paragraphs)

Note types:
  - normal (default)
  - separator (horizontal line)
  - continuationSeparator
  - continuationNotice
```

**Integration Notes:**
- Footnote/endnote references in document body are already parsed by runParser as NoteReferenceContent
- This parser handles the actual footnote/endnote content definitions
- Content is parsed using paragraphParser for full formatting support

**Verified:**
- bun build exits 0: ✓

---
