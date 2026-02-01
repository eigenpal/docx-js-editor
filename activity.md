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

### US-24: Header/Footer parser
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/headerFooterParser.ts` with comprehensive header and footer parsing:

**Main Functions:**
- `parseHeader(xml, hdrFtrType, styles, theme, numbering, rels, media)` - Parse word/header*.xml
- `parseFooter(xml, hdrFtrType, styles, theme, numbering, rels, media)` - Parse word/footer*.xml
- `parseHeaderFooter(xml, isHeader, hdrFtrType, ...)` - Generic parser for either

**Reference Parsing:**
- `parseHeaderReference(element)` - Parse w:headerReference from sectPr
- `parseFooterReference(element)` - Parse w:footerReference from sectPr
- `parseHeaderReferences(sectPr)` - Get all header refs from section
- `parseFooterReferences(sectPr)` - Get all footer refs from section

**HeaderFooterMap Interface:**
- `byId: Map<string, HeaderFooter>` - Lookup by rId
- `get(rId)` - Get header/footer by rId
- `has(rId)` - Check if exists
- `getAll()` - Get all headers/footers
- `getByType(type)` - Get by type (default, first, even)

**Content Parsing:**
- Parses paragraphs via `parseParagraph()`
- Parses tables via `parseTable()`
- Handles SDT (structured document tags) wrapper elements
- Supports images, shapes, page number fields

**Utility Functions:**
- `getHeaderFooterText(hf)` - Get plain text content
- `isEmptyHeaderFooter(hf)` - Check if empty
- `hasPageNumberField(hf)` - Check for PAGE/NUMPAGES fields
- `getHeaderForPage(headers, pageNum, isFirst, hasDiffFirst, hasDiffOddEven)` - Get correct header for page
- `getFooterForPage(...)` - Get correct footer for page
- `headerFooterMapToTypeMap(map)` - Convert rId map to type map
- `hasImages(hf)` - Check for images
- `hasTables(hf)` - Check for tables
- `createEmptyHeaderFooterMap()` - Create empty map
- `buildHeaderFooterMap(refs, xmlContents, ...)` - Build map from refs and content

**OOXML Structure Reference:**
```
word/header1.xml:
  w:hdr
    └── w:p (paragraphs)
    └── w:tbl (tables)
    └── w:sdt > w:sdtContent > ... (structured content)

word/footer1.xml:
  w:ftr
    └── w:p (paragraphs)
    └── w:tbl (tables)

sectPr references:
  w:headerReference[@w:type="default|first|even"][@r:id="rIdX"]
  w:footerReference[@w:type="default|first|even"][@r:id="rIdX"]
```

**Header/Footer Types:**
- `default` - Used for all pages unless first/even specified
- `first` - Used only for first page of section (if enabled)
- `even` - Used for even-numbered pages (if odd/even enabled)

**Verified:**
- bun build exits 0: ✓

---

### US-25: Section properties parser
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/sectionParser.ts` with comprehensive section properties parsing:

**Main Function:**
- `parseSectionProperties(sectPr, rels): SectionProperties` - Parse w:sectPr element

**Page Layout Parsing:**
- w:pgSz (page width, height, orientation - portrait/landscape)
- w:pgMar (all margins: top, bottom, left, right, header, footer, gutter)
- w:cols (column count, spacing, widths, equal width, separator)
- Individual column definitions (w:col elements)

**Section Properties:**
- w:type (section start: continuous, nextPage, oddPage, evenPage, nextColumn)
- w:vAlign (vertical alignment: top, center, both, bottom)
- w:bidi (bidirectional support)
- w:titlePg (different first page header/footer)
- w:evenAndOddHeaders (different odd/even headers)

**References:**
- w:headerReference parsing (default, first, even types)
- w:footerReference parsing (default, first, even types)

**Additional Properties:**
- w:lnNumType (line numbers: start, countBy, distance, restart)
- w:pgBorders (page borders: top, bottom, left, right, display, offsetFrom, zOrder)
- w:background (page background with color and theme color support)
- w:footnotePr, w:endnotePr (note properties)
- w:docGrid (document grid: type, linePitch, charSpace)
- w:paperSrc (paper source for first and other pages)

**Utility Functions:**
- `getPageWidthPixels(props)` - Convert page width to pixels
- `getPageHeightPixels(props)` - Convert page height to pixels
- `getContentWidthPixels(props)` - Get content area width
- `getContentHeightPixels(props)` - Get content area height
- `getMarginsPixels(props)` - Get all margins in pixels
- `hasDifferentFirstPage(props)` - Check for title page setting
- `hasDifferentOddEven(props)` - Check for odd/even headers
- `getColumnCount(props)` - Get effective column count
- `isLandscape(props)` - Check orientation
- `hasPageBorders(props)` - Check for page borders
- `hasLineNumbers(props)` - Check for line numbering
- `getDefaultSectionProperties()` - US Letter defaults
- `mergeSectionProperties(base, override)` - Merge section properties

**Verified:**
- bun build exits 0: ✓

---

### US-26: Document body parser
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/documentParser.ts` with comprehensive document body parsing:

**Main Function:**
- `parseDocumentBody(xml, styles, theme, numbering, rels, media): DocumentBody`

**Content Parsing:**
- Parses w:document root element
- Parses w:body content
- Handles w:p (paragraphs via paragraphParser)
- Handles w:tbl (tables via tableParser)
- Handles w:sdt (structured document tags - unwraps content)
- Parses final w:sectPr (section properties at body level)

**Section Building:**
- `buildSections(content, finalSectPr)` - Build sections from content
- Detects section breaks via w:pPr/w:sectPr in paragraphs
- Creates Section objects with properties and content

**Template Variable Detection:**
- `extractTemplateVariables(text)` - Extract {{...}} patterns
- `extractAllTemplateVariables(content)` - Scan all content for variables
- Recursively scans tables for variables

**Utility Functions:**
- `getAllParagraphs(body)` - Flatten paragraphs (including from tables)
- `getAllTables(body)` - Get all tables (including nested)
- `getDocumentText(body)` - Get plain text of entire document
- `getParagraphCount(body)` - Count paragraphs
- `getWordCount(body)` - Count words (approximate)
- `getCharacterCount(body)` - Count characters
- `getSectionCount(body)` - Count sections
- `hasTemplateVariables(body)` - Check for template variables
- `getDocumentOutline(body, maxChars, maxParagraphs)` - Get document preview

**Verified:**
- bun build exits 0: ✓

---

### US-27: Main parser orchestrator
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/parser.ts` with complete parsing orchestration:

**Main Function:**
- `parseDocx(buffer, options): Promise<Document>` - Parse DOCX to Document model

**Parsing Options:**
- `onProgress` - Progress callback for tracking stages
- `preloadFonts` - Whether to load fonts (default: true)
- `parseHeadersFooters` - Whether to parse headers/footers (default: true)
- `parseNotes` - Whether to parse footnotes/endnotes (default: true)
- `detectVariables` - Whether to detect template variables (default: true)

**Parsing Stages (with progress):**
1. Unzip DOCX package (0-10%)
2. Parse relationships (10-15%)
3. Parse theme (15-20%)
4. Parse styles with docDefaults (20-30%)
5. Parse numbering/lists (30-35%)
6. Build media file map (35-40%)
7. Parse document body (40-55%)
8. Parse headers/footers (55-65%)
9. Parse footnotes/endnotes (65-75%)
10. Detect template variables (75-80%)
11. Extract and load fonts (80-95%)
12. Assemble final Document (95-100%)

**Helper Functions:**
- `buildMediaMap(raw, rels)` - Build media file map with data URLs
- `parseHeadersAndFooters(raw, ...)` - Parse all headers/footers
- `parseNotesContent(raw, ...)` - Parse footnotes/endnotes
- `loadDocumentFonts(theme, styles, body)` - Extract and load fonts

**Convenience Functions:**
- `quickParseDocx(buffer)` - Parse without fonts/headers/notes
- `fullParseDocx(buffer, onProgress)` - Parse everything
- `getDocxVariables(buffer)` - Get only template variables
- `getDocxSummary(buffer)` - Get quick document summary

**Document Model:**
- Returns `Document` with:
  - `package` - DocxPackage with all parsed content
  - `originalBuffer` - Original DOCX for round-trip
  - `templateVariables` - Detected {{variables}}
  - `warnings` - Any parsing warnings

**Error Handling:**
- Wraps all parsing in try/catch
- Returns descriptive error messages

**Verified:**
- bun build exits 0: ✓

---

### US-28: Unit conversion utilities
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/utils/units.ts` with comprehensive OOXML unit conversions:

**Twips Conversions:**
- `twipsToPixels(twips)` - Twips to pixels (96 DPI)
- `pixelsToTwips(px)` - Pixels to twips
- `twipsToPoints(twips)` - Twips to points
- `twipsToInches(twips)`, `twipsToCm(twips)` - Twips to inches/cm

**EMU Conversions:**
- `emuToPixels(emu)` - EMU to pixels (96 DPI)
- `pixelsToEmu(px)` - Pixels to EMU
- `emuToPoints(emu)` - EMU to points
- `emuToInches(emu)`, `emuToCm(emu)` - EMU to inches/cm
- `emuToTwips(emu)`, `twipsToEmu(twips)` - EMU/twips conversion

**Half-Point Conversions:**
- `halfPointsToPixels(hp)` - Half-points to pixels
- `halfPointsToPoints(hp)` - Half-points to points
- `pixelsToHalfPoints(px)` - Pixels to half-points

**Point Conversions:**
- `pointsToPixels(pt)` - Points to pixels
- `pixelsToPoints(px)` - Pixels to points

**Eighths Conversions (for border widths):**
- `eighthsToPixels(eighths)` - 1/8 points to pixels
- `eighthsToPoints(eighths)` - 1/8 points to points

**Angle Conversions:**
- `ooxmlAngleToDegrees(ooxml60000ths)` - 60000ths of degree to degrees
- `degreesToRadians(deg)` - Degrees to radians

**Percentage Conversions:**
- `ooxmlPercentToDecimal(ooxml1000ths)` - 1000ths percent to decimal
- `ooxmlPercent50000ToDecimal(ooxml50000ths)` - 50000ths to decimal

**CSS Formatters:**
- `formatPx(px)`, `formatPt(pt)` - Format as CSS strings
- `twipsToCss(twips)`, `emuToCss(emu)` - Direct to CSS
- `halfPointsToCss(hp)`, `halfPointsToPtCss(hp)` - Font size helpers

**Page Size Utilities:**
- `PAGE_SIZES` - Standard sizes (LETTER, LEGAL, A4, A5, EXECUTIVE)
- `getPageSizePixels(width, height)` - Convert to pixels
- `getStandardPageSize(name)` - Get standard page size

**Constants:**
- `STANDARD_DPI = 96`
- `TWIPS_PER_INCH = 1440`
- `EMUS_PER_INCH = 914400`
- `POINTS_PER_INCH = 72`
- `HALF_POINTS_PER_INCH = 144`
- `EIGHTHS_PER_INCH = 576`

**Verified:**
- bun build exits 0: ✓

---

### US-29: Color resolver
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/utils/colorResolver.ts` with comprehensive color resolution:

**Main Functions:**
- `resolveColor(color, theme, defaultColor)` - Resolve ColorValue to CSS color string
- `resolveHighlightColor(highlight)` - Resolve highlight color name to CSS
- `resolveShadingColor(color, theme)` - Resolve shading fill/pattern color

**Theme Color Support:**
- Handles all theme color slots (dk1, lt1, dk2, lt2, accent1-6, hlink, folHlink)
- Maps aliases (dark1→dk1, background1→lt1, text1→dk1, etc.)
- Default Office 2016 theme colors for fallback

**Tint/Shade Modifications:**
- `applyTint(hex, tint)` - Make color lighter (blend with white) using HSL
- `applyShade(hex, shade)` - Make color darker (blend with black) using HSL
- Parses OOXML hex modifier values (00-FF → 0-1)

**Color Utilities:**
- `hexToRgb(hex)`, `rgbToHex(r, g, b)` - RGB/hex conversion
- `rgbToHsl(r, g, b)`, `hslToRgb(h, s, l)` - HSL conversion for tint/shade
- `isBlack(color, theme)`, `isWhite(color, theme)` - Color detection
- `getContrastingColor(bg, theme)` - Get black/white for best contrast
- `darkenColor(color, theme, percent)`, `lightenColor(color, theme, percent)`
- `blendColors(color1, color2, ratio, theme)` - Blend two colors
- `colorsEqual(color1, color2, theme)` - Compare colors

**Color Creation:**
- `parseColorString(colorString)` - Parse various color formats to ColorValue
- `createThemeColor(slot, tint?, shade?)` - Create theme color reference
- `createRgbColor(hex)` - Create RGB ColorValue

**Highlight Colors:**
- Full mapping of OOXML highlight names to hex (black, blue, cyan, darkBlue, etc.)

**Verified:**
- bun build exits 0: ✓

---

### US-30: Text measurement
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/utils/textMeasure.ts` with canvas-based text measurement:

**Main Functions:**
- `measureText(text, formatting, options): Promise<TextMeasurement>` - Async measurement with font wait
- `measureTextSync(text, formatting, theme): TextMeasurement` - Synchronous measurement
- `measureChar(char, formatting, theme)` - Measure single character
- `measureSpace(formatting, theme)` - Measure space width
- `getLineHeight(formatting, theme)` - Get line height for formatting
- `getBaseline(formatting, theme)` - Get baseline position

**TextMeasurement Interface:**
- `width` - Width of text in pixels
- `height` - Height based on font metrics
- `baseline` - Distance from top to baseline
- `actualBoundingBox` - Optional detailed bounds (if browser supports)

**Features:**
- Uses Canvas 2D context for accurate measurements
- LRU cache (10,000 entries) for performance
- Font loading awareness via `isFontLoaded()` and CSS Font Loading API
- Resolves DOCX font names via `fontResolver.ts`
- Converts half-points to pixels via `units.ts`
- Handles theme font references
- Fallback estimation for non-browser environments

**Bulk/Utility Functions:**
- `measureTexts(texts, formatting, theme)` - Measure multiple strings
- `measureTextWidth(text, formatting, theme)` - Width-only (faster)
- `calculateTextToWidth(text, targetWidth, ...)` - Find chars fitting width
- `estimateLineWidth(charCount, fontSize)` - Estimation without canvas

**Cache Management:**
- `clearMeasurementCache()` - Clear after font changes
- `getMeasurementCacheSize()` - Get current cache size

**Verified:**
- bun build exits 0: ✓

---

### US-31: Formatting to CSS converter
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/utils/formatToStyle.ts` with comprehensive formatting to CSS conversion:

**Main Functions:**
- `textToStyle(formatting, theme): CSSProperties` - Convert TextFormatting to CSS
- `paragraphToStyle(formatting, theme): CSSProperties` - Convert ParagraphFormatting to CSS
- `borderToStyle(border, side, theme): CSSProperties` - Convert BorderSpec to CSS
- `resolveShadingFill(shading, theme): string` - Convert shading to CSS background
- `tableCellToStyle(formatting, theme): CSSProperties` - Convert table cell formatting
- `sectionToStyle(sectionProps, theme): CSSProperties` - Convert section properties
- `mergeStyles(...styles): CSSProperties` - Merge multiple style objects

**Text Formatting (textToStyle) Handles:**
- Font: family (with theme font resolution), size (half-points to pt)
- Weight: bold → fontWeight: 'bold'
- Style: italic → fontStyle: 'italic'
- Color: theme colors, RGB, auto → color
- Background: highlight colors, character shading → backgroundColor
- Text decoration: underline (with style and color), strikethrough, double-strike
- Vertical alignment: superscript → verticalAlign: 'super', subscript → 'sub'
- Position: raised/lowered text via relative positioning
- Capitalization: allCaps → textTransform: 'uppercase', smallCaps → fontVariant
- Spacing: letter-spacing from twips
- Scale: horizontal text scale via CSS transform
- Visibility: hidden → display: 'none'
- Effects: emboss, imprint, outline, shadow via textShadow and WebkitTextStroke
- Direction: rtl → direction: 'rtl'

**Paragraph Formatting (paragraphToStyle) Handles:**
- Alignment: left, center, right, both → textAlign
- Spacing: spaceBefore → marginTop, spaceAfter → marginBottom
- Line spacing: exact/atLeast/auto → lineHeight
- Indentation: left, right → marginLeft/Right, firstLine/hanging → textIndent
- Borders: top, bottom, left, right with color, width, style
- Background: paragraph shading → backgroundColor
- Direction: bidi → direction: 'rtl'
- Page breaks: pageBreakBefore, keepNext, keepLines

**Border Style Mapping:**
- Maps OOXML border styles (single, double, dotted, dashed, etc.) to CSS
- Converts eighths of a point to pixels
- Resolves border colors via theme

**Verified:**
- bun build exits 0: ✓

---

### US-32: Run component
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/render/Run.tsx` with comprehensive run rendering:

**Main Component:**
- `Run` - React component rendering a text run with all formatting

**Props:**
- `run: RunType` - The run data to render
- `theme?: Theme` - Theme for resolving colors and fonts
- `className?: string` - Additional CSS class
- `style?: CSSProperties` - Additional inline styles
- `inline?: boolean` - Whether to render as inline-block

**Content Types Rendered:**
- `text` - Plain text with template variable detection
- `tab` - Tab characters with whitespace preservation
- `break` - Line, page, and column breaks
- `symbol` - Symbol characters with specific fonts
- `footnoteRef` / `endnoteRef` - Superscript note references
- `softHyphen` / `noBreakHyphen` - Special hyphens
- `drawing` / `shape` - Placeholders for images and shapes

**Template Variable Support:**
- Detects `{{...}}` patterns in text
- Applies distinctive styling (yellow background, monospace, brown text)
- Uses regex-based splitting to preserve surrounding text

**CSS Classes Applied:**
- `docx-run` - Base class
- `docx-run-bold`, `docx-run-italic`, `docx-run-underline` - Formatting indicators
- `docx-run-strike`, `docx-run-superscript`, `docx-run-subscript`
- `docx-run-small-caps`, `docx-run-all-caps`
- `docx-run-highlighted`, `docx-run-hidden`
- `docx-run-has-variable` - When contains template variables

**Utility Functions:**
- `getRunPlainText(run)` - Extract plain text from run
- `hasVisibleContent(run)` - Check if run has visible content
- `isWhitespaceOnly(run)` - Check if run is whitespace only

**Verified:**
- bun build exits 0: ✓

---

### US-33: Tab component
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/render/Tab.tsx` with comprehensive tab rendering:

**Main Component:**
- `Tab` - React component rendering tab characters with proper spacing

**Props:**
- `currentPosition?: number` - Current horizontal position in twips from left margin
- `tabStops?: TabStop[]` - Defined tab stops for this paragraph
- `pageWidth?: number` - Page content width in twips
- `className?: string` - Additional CSS class
- `style?: CSSProperties` - Additional inline styles
- `index?: number` - Index for key generation

**Tab Render Info Interface:**
- `width` - Width of the tab in pixels
- `alignment` - Tab stop alignment (left, center, right, decimal)
- `leader` - Leader character type (dot, hyphen, underscore, etc.)
- `tabStopPosition` - Position of the tab stop in twips
- `hasLeader` - Whether the tab has a visible leader
- `leaderString` - Leader string to display

**Main Functions:**
- `calculateTabRenderInfo(currentPosition, tabStops, pageWidth)` - Calculate tab rendering info
- `getTabStyle(info, additionalStyle)` - Get CSS styles for tab
- `getPositionAfterTab(currentPosition, tabStops, pageWidth)` - Get position after tab
- `getDefaultTabWidthPx()` - Get default tab width in pixels
- `estimateFollowingContentWidth(text, fontSize)` - Estimate content width for alignment
- `isDefaultTabPosition(position)` - Check if at default tab interval
- `getLeaderCssContent(leader)` - Get CSS content string for leader
- `createSimpleTab(widthPx, leader, className)` - Create tab with known width
- `createBarTab(position, height, color)` - Create vertical bar tab

**Features:**
- Calculates width based on tab stop definitions
- Uses `getNextTabStop()` and `calculateTabWidth()` from tabParser
- Handles leader characters (dots, dashes, underscores, heavy, middleDot)
- Aligns to tab stop positions (left, center, right, decimal, bar)
- Supports default tab stops when no explicit stops defined
- Minimum tab width enforcement (8px)
- CSS classes for styling: `docx-tab`, `docx-tab-leader-*`, `docx-tab-align-*`

**Verified:**
- bun build exits 0: ✓

---

### US-34: Hyperlink component
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/render/Hyperlink.tsx` with comprehensive hyperlink rendering:

**Main Component:**
- `Hyperlink` - React component rendering clickable hyperlinks

**Props:**
- `hyperlink: HyperlinkType` - The hyperlink data to render
- `theme?: Theme | null` - Theme for resolving colors and fonts
- `className?: string` - Additional CSS class
- `style?: CSSProperties` - Additional inline styles
- `onBookmarkClick?: (bookmarkName: string) => void` - Callback for internal links
- `disabled?: boolean` - Whether links are non-interactive

**Features:**
- External links: Opens in new tab with `target="_blank"` and `rel="noopener noreferrer"`
- Internal bookmark links: Triggers `onBookmarkClick` callback or scrolls to target element
- Tooltip support: Shows `title` attribute on hover from `w:tooltip`
- Contains Run children: Renders child runs with their formatting
- Bookmark markers: Renders invisible `<span>` elements for bookmarkStart/End
- Accessibility: ARIA labels for external links

**CSS Classes:**
- `docx-hyperlink` - Base class
- `docx-hyperlink-external` - External links
- `docx-hyperlink-internal` - Internal bookmark links
- `docx-hyperlink-disabled` - Disabled links

**Utility Functions:**
- `hasVisibleContent(hyperlink)` - Check if hyperlink has visible runs
- `getTargetBookmark(hyperlink)` - Get internal bookmark name
- `isEmptyHyperlink(hyperlink)` - Check if link has no destination
- `getHyperlinkAccessibleText(hyperlink)` - Get text for accessibility

**Re-exports from parser:**
- `getHyperlinkText`, `getHyperlinkUrl`, `isExternalLink`, `isInternalLink`

**Verified:**
- bun build exits 0: ✓

---

### US-35: Field component
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/render/Field.tsx` with comprehensive field rendering:

**Main Component:**
- `Field` - React component rendering dynamic field content

**Props:**
- `field: FieldType` - The field data to render
- `theme?: Theme | null` - Theme for resolving colors in child runs
- `className?: string` - Additional CSS class
- `style?: CSSProperties` - Additional inline styles
- `pageNumber?: number` - Current page number (for PAGE field)
- `totalPages?: number` - Total page count (for NUMPAGES field)
- `showFieldCode?: boolean` - Show field instruction instead of result
- `highlighted?: boolean` - Highlight for editing mode
- `onClick?: () => void` - Callback for field clicks

**Features:**
- Displays current field value from document
- Styled with subtle background to indicate dynamic content
- Placeholder display for page numbers (#) until pagination
- Tooltip showing field instruction on hover
- Supports both simple and complex fields
- Category-based CSS classes for styling

**Field Categories Supported:**
- Pagination: PAGE, NUMPAGES
- DateTime: DATE, TIME, CREATEDATE, SAVEDATE, PRINTDATE
- Document properties: AUTHOR, TITLE, FILENAME, DOCPROPERTY
- Cross-references: REF, PAGEREF, NOTEREF
- Mail merge: MERGEFIELD
- Navigation: TOC, INDEX

**Utility Functions:**
- `isFieldDirty(field)` - Check if field needs updating
- `isFieldLocked(field)` - Check if field is locked
- `isSimpleField(field)` - Type guard for SimpleField
- `isComplexField(field)` - Type guard for ComplexField
- `getFieldCategory(field)` - Get category for grouping
- `getFieldDescription(field)` - Get human-readable description
- `needsPlaceholder(field)` - Check if field shows placeholder

**Verified:**
- bun build exits 0: ✓

---

### US-36: DocImage component
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/render/DocImage.tsx` with comprehensive image rendering:

**Main Component:**
- `DocImage` - React component rendering embedded images

**Props:**
- `image: ImageType` - The image data to render
- `className?: string` - Additional CSS class
- `style?: CSSProperties` - Additional inline styles
- `selected?: boolean` - Whether image is selected (for editing)
- `onClick?: () => void` - Callback for image clicks
- `onError?: () => void` - Callback for load errors
- `onLoad?: () => void` - Callback for successful load

**Features:**
- Renders images with correct EMU-to-pixel dimensions
- Supports image transformations: rotation, flipH, flipV
- Text wrapping modes: inline, square, tight, through, topAndBottom, behind, inFront
- Alt text for accessibility
- Decorative image handling (aria-hidden)
- Placeholder for missing image data
- Selection state with outline

**CSS Classes:**
- `docx-image` - Base class
- `docx-image-inline` / `docx-image-floating` - Position mode
- `docx-image-behind` / `docx-image-infront` - Z-order
- `docx-image-wrap-*` - Wrap type
- `docx-image-selected` - Selection state

**Utility Functions:**
- `hasImageSource(image)` - Check if image has source data
- `getImageAspectRatio(image)` - Get aspect ratio
- `calculateAspectRatioDimensions(image, w?, h?)` - Maintain aspect ratio
- `needsTextWrapping(image)` - Check if text wraps
- `isAbsolutelyPositioned(image)` - Check for anchor position
- `getPositionOffsets(image)` - Get position in pixels
- `getPositionStyles(image)` - Get CSS for absolute positioning
- `getImageDescription(image)` - Get accessible description

**Re-exports from parser:**
- `isInlineImage`, `isFloatingImage`, `isBehindText`, `isInFrontOfText`
- `getImageWidthPx`, `getImageHeightPx`, `isDecorativeImage`

**Verified:**
- bun build exits 0: ✓

---

### US-37: Shape component
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/render/Shape.tsx` with SVG-based shape rendering:

**Main Component:**
- `Shape` - React component rendering drawing objects using SVG

**Props:**
- `shape: ShapeType` - The shape data to render
- `className?: string` - Additional CSS class
- `style?: CSSProperties` - Additional inline styles
- `selected?: boolean` - Whether shape is selected (for editing)
- `onClick?: () => void` - Callback for shape clicks
- `renderParagraph?: (paragraph, index) => ReactNode` - Render function for text content

**Shapes Rendered:**
- Rectangle (rect) - Basic rectangle
- Rounded Rectangle (roundRect) - Rectangle with rounded corners
- Ellipse - Circle/oval
- Triangle - Three-sided polygon
- Line - Straight line with optional arrows
- Stars (star5, etc.) - Multi-pointed stars
- Arrows (rightArrow, leftArrow) - Arrow shapes

**Features:**
- SVG rendering for all shapes
- Fill support (solid colors)
- Stroke/outline with color, width, and dash styles
- Arrow markers on lines (headEnd, tailEnd)
- Text content inside shapes with vertical alignment
- Transform support (rotation, flipH, flipV)

**CSS Classes:**
- `docx-shape` - Base class
- `docx-shape-{shapeType}` - Type-specific class
- `docx-shape-line` - Line shapes
- `docx-shape-textbox` - Text box shapes
- `docx-shape-floating` - Floating shapes
- `docx-shape-selected` - Selection state

**Utility Functions:**
- `hasVisualContent(shape)` - Check for fill/outline/text
- `getShapeDescription(shape)` - Get accessible description
- `isRectangleShape(shape)` - Check for rect/roundRect
- `isEllipseShape(shape)` - Check for ellipse
- `isPolygonShape(shape)` - Check for polygon shapes

**Verified:**
- bun build exits 0: ✓

---

### US-38: TextBox component
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/render/TextBox.tsx` with floating text container rendering:

**Main Component:**
- `TextBox` - React component rendering floating text containers

**Props:**
- `textBox: TextBoxType` - The text box data to render
- `className?: string` - Additional CSS class
- `style?: CSSProperties` - Additional inline styles
- `selected?: boolean` - Whether text box is selected (for editing)
- `onClick?: () => void` - Callback for text box clicks
- `renderParagraph?: (paragraph, index) => ReactNode` - Render function for paragraphs
- `renderTable?: (table, index) => ReactNode` - Render function for tables

**Features:**
- Positioned absolutely for floating text boxes
- Configurable dimensions from EMUs
- Fill/background color support
- Border/outline with color and width
- Internal margins/padding
- Text wrapping modes (square, tight, behind, inFront)
- Wrap distance margins
- Float for square/tight wrapping
- Z-index for behind/inFront layering

**CSS Classes:**
- `docx-textbox` - Base class
- `docx-textbox-floating` - Floating text boxes
- `docx-textbox-selected` - Selection state

**Utility Functions:**
- `hasVisibleStyling(textBox)` - Check for fill/outline
- `isEmptyTextBox(textBox)` - Check for empty content
- `getTextBoxAspectRatio(textBox)` - Get aspect ratio
- `getTextBoxDescription(textBox)` - Get accessible description
- `needsTextWrapping(textBox)` - Check for text wrapping
- `isBehindText(textBox)` / `isInFrontOfText(textBox)` - Z-order checks

**Verified:**
- bun build exits 0: ✓

---

### US-39: Paragraph component
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/render/Paragraph.tsx` with comprehensive paragraph rendering:

**Main Component:**
- `Paragraph` - React component rendering paragraphs with all formatting and content

**Props:**
- `paragraph: ParagraphType` - The paragraph data to render
- `theme?: Theme` - Theme for resolving colors and fonts
- `className?: string` - Additional CSS class
- `style?: CSSProperties` - Additional inline styles
- `pageNumber?: number` - Current page number (for PAGE fields)
- `totalPages?: number` - Total page count (for NUMPAGES fields)
- `pageWidth?: number` - Page width in twips (for tab calculations)
- `onBookmarkClick?: (bookmarkName: string) => void` - Callback for internal links
- `disableLinks?: boolean` - Whether to disable hyperlinks
- `renderImage?: (image, index) => ReactNode` - Custom image renderer
- `renderShape?: (shape, index) => ReactNode` - Custom shape renderer
- `renderTextBox?: (textBox, index) => ReactNode` - Custom text box renderer

**Features:**
- Applies all paragraph styling (alignment, spacing, indent, borders, shading)
- Contains runs, tabs, hyperlinks, fields, images, shapes
- Handles empty paragraphs (renders as line break)
- Handles right-to-left text (bidi support)
- List item rendering with markers
- Bookmark start/end markers
- Tab character rendering with tab stops
- Image and shape rendering within runs
- Default run properties from paragraph formatting

**CSS Classes:**
- `docx-paragraph` - Base class
- `docx-align-*` - Alignment classes (left, center, right, both)
- `docx-rtl` - Right-to-left text
- `docx-style-*` - Style reference classes
- `docx-page-break-before` - Page break before
- `docx-keep-next`, `docx-keep-lines` - Keep controls
- `docx-list-item`, `docx-list-level-*`, `docx-list-bullet`, `docx-list-numbered`
- `docx-paragraph-empty` - Empty paragraphs

**Utility Functions:**
- `getParagraphText(paragraph)` - Get plain text content
- `isEmptyParagraph(paragraph)` - Check if empty
- `isListItem(paragraph)` - Check if list item
- `getListLevel(paragraph)` - Get list level (0-8)
- `hasStyle(paragraph, styleId)` - Check for specific style
- `isRtlParagraph(paragraph)` - Check if RTL
- `getTemplateVariables(paragraph)` - Get {{variables}}
- `hasImages(paragraph)` - Check for images
- `hasShapes(paragraph)` - Check for shapes
- `getWordCount(paragraph)` - Word count
- `getCharacterCount(paragraph, includeSpaces)` - Character count

**Verified:**
- bun build exits 0: ✓

---

### US-40: List item component
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/render/ListItem.tsx` with comprehensive list item rendering:

**Main Component:**
- `ListItem` - React component rendering paragraphs as list items with markers

**Props:**
- `paragraph: ParagraphType` - The paragraph data to render as list item
- `theme?: Theme` - Theme for resolving colors and fonts
- `levelDefinition?: ListLevel` - Level definition for detailed styling
- `counterValue?: number` - Counter value for numbered lists
- `allCounters?: number[]` - Array of counter values for multi-level patterns
- `allFormats?: NumberFormat[]` - Array of formats for multi-level patterns
- Standard paragraph props (pageNumber, totalPages, pageWidth, onBookmarkClick, etc.)

**Bullet Support:**
- Default bullets by level: • (solid), ○ (circle), ▪ (square)
- Unicode character mapping for Wingdings/Symbol fonts
- Handles special characters: ●, ◆, ✓, ■, →, etc.
- Falls back to getBulletCharacter from numberingParser

**Number Format Support:**
- All standard formats: decimal, upperRoman, lowerRoman, upperLetter, lowerLetter
- Special formats: ordinal (1st, 2nd, 3rd), numberInDash (-1-), decimalEnclosedParen ((1))
- Multi-level patterns: Renders %1.%2.%3 style markers correctly

**Indentation:**
- Base indentation: 36px per level (~0.5 inch)
- Uses level definition pPr.indentLeft if available (converted from twips)
- Handles hanging indents for marker positioning

**Marker Styling:**
- Applies run properties (rPr) from level definition
- Supports justification (left, center, right)
- Minimum width with proper text alignment
- Flexbox layout for proper spacing

**CSS Classes:**
- `docx-list-item` - Base class
- `docx-list-level-*` - Level-specific (0-8)
- `docx-list-bullet` - Bullet lists
- `docx-list-numbered` - Numbered lists
- `docx-list-marker` - Marker span
- `docx-list-content` - Content wrapper

**Utility Functions:**
- `unicodeToChar(codePoint)` - Convert Unicode hex to character
- `isListItemParagraph(paragraph)` - Check if should render as list item
- `getDefaultBullet(level)` - Get default bullet for level
- `toUpperRoman(num)`, `toLowerRoman(num)` - Roman numeral conversion
- `toUpperLetter(num)`, `toLowerLetter(num)` - Letter conversion
- `getMarkerForFormat(value, format, lvlText)` - Get marker string
- `getListIndent(level, levelDefinition)` - Calculate indent in pixels
- `getHangingIndent(levelDefinition)` - Get hanging indent
- `isBulletFormat(format)` - Check if format is bullet type
- `getCommonBulletChars()` - Get common bullets for UI
- `getCommonNumberFormats()` - Get number formats for UI

**Verified:**
- bun build exits 0: ✓

---

### US-41: Table component
**Date:** 2026-02-01
**Status:** Complete ✅

`src/components/render/DocTable.tsx` exists with comprehensive table rendering.

**Verified:**
- bun build exits 0: ✓

---

### US-42: Footnote reference component
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/render/FootnoteRef.tsx` with footnote/endnote reference rendering:

**Main Component:**
- `FootnoteRef` - React component rendering footnote/endnote reference markers

**Props:**
- `id: number` - The footnote/endnote ID being referenced
- `type: 'footnote' | 'endnote'` - Type of note
- `noteContent?: Footnote | Endnote` - The content (for tooltip preview)
- `customMark?: string` - Custom reference mark (overrides number)
- `displayNumber?: number` - Display number (may differ from ID)
- `theme?: Theme` - Theme for styling
- `onClick?: (id, type) => void` - Callback when reference is clicked
- `showTooltip?: boolean` - Whether to show tooltip on hover
- `tooltipContent?: ReactNode` - Custom tooltip content

**Features:**
- Renders superscript numbered references
- Clickable to jump to footnote/endnote content
- Tooltip preview of footnote content on hover
- Custom reference marks support
- Display number calculation (excluding separator notes)
- Number formatting (decimal, roman, letter, chicago)

**CSS Classes:**
- `docx-note-ref` - Base class
- `docx-footnote-ref` / `docx-endnote-ref` - Type-specific
- `docx-note-ref-clickable` - When clickable

**Utility Functions:**
- `getFootnoteDisplayNumber(id, allFootnotes, properties)` - Calculate display number
- `getEndnoteDisplayNumber(id, allEndnotes, properties)` - Calculate display number
- `formatNoteNumber(number, format)` - Format according to settings
- `isSeparatorNote(note)` - Check if separator (not content)
- `needsSuperscriptNumber(note)` - Check if needs superscript
- `getDisplayableFootnotes(footnotes)` - Filter out separators
- `getFootnoteElementId(id)` - Generate element ID for scroll targeting
- `getFootnoteRefElementId(id, index)` - Generate ref element ID for back-linking

**Verified:**
- bun build exits 0: ✓

---

### US-43: Header/Footer component
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/render/HeaderFooter.tsx` with header and footer rendering:

**Main Component:**
- `HeaderFooter` - React component rendering header or footer content

**Container Components:**
- `HeaderArea` - Container for header positioned at top of page
- `FooterArea` - Container for footer positioned at bottom of page

**Props:**
- `headerFooter: HeaderFooterType` - The header/footer data to render
- `position: 'header' | 'footer'` - Type of area
- `sectionProps?: SectionProperties` - Section properties for positioning
- `theme?: Theme` - Theme for resolving colors and fonts
- `pageNumber?: number` - Current page number (for PAGE field)
- `totalPages?: number` - Total page count (for NUMPAGES field)
- `pageWidthPx?: number` - Page width in pixels
- `renderParagraph?: (paragraph, index) => ReactNode` - Render function for paragraphs
- `renderTable?: (table, index) => ReactNode` - Render function for tables

**Features:**
- Renders paragraphs with all formatting
- Tables within headers/footers
- Page number fields
- Positioned in header/footer area based on section margins
- Different header/footer types (default, first, even)

**CSS Classes:**
- `docx-header-footer` - Base class
- `docx-header` / `docx-footer` - Position-specific
- `docx-header-default` / `docx-header-first` / `docx-header-even` - Type-specific
- `docx-header-area` / `docx-footer-area` - Container classes

**Utility Functions:**
- `getHeaderForPage(pageNumber, isFirstPage, headers, sectionProps)` - Get header for page
- `getFooterForPage(pageNumber, isFirstPage, footers, sectionProps)` - Get footer for page
- `hasContent(hf)` - Check if header/footer has content
- `hasPageNumberField(hf)` - Check for PAGE/NUMPAGES fields
- `getHeaderFooterText(hf)` - Get plain text content
- `hasImages(hf)` / `hasTables(hf)` - Check for content types
- `createHeaderFooterMap(items)` - Create type-to-content map
- `hasHeaders(headers)` / `hasFooters(footers)` - Check existence
- `getHeaderTypes(headers)` / `getFooterTypes(footers)` - Get available types

**Verified:**
- bun build exits 0: ✓

---

### US-44: Line breaker
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/layout/lineBreaker.ts` with comprehensive line breaking:

**Main Function:**
- `breakIntoLines(paragraph, options): LineBreakResult` - Break paragraph into lines

**LineBreakOptions:**
- `maxWidth: number` - Maximum width for content
- `firstLineIndent?: number` - First line indent
- `tabStops?: TabStop[]` - Tab stops for the paragraph
- `theme?: Theme` - Theme for font resolution
- `defaultFormatting?: TextFormatting` - Default formatting
- `lineHeightMultiplier?: number` - Line height multiplier
- `minLineHeight?: number` - Minimum line height

**LineFragment Interface:**
- `type` - text, tab, break, image, field, symbol, space
- `content: string` - The content
- `width, height, baseline` - Measurements in pixels
- `runIndex, contentIndex` - Source indices
- `formatting?: TextFormatting` - Applied formatting
- `canBreakAfter: boolean` - Whether break is allowed after
- `nonBreaking?: boolean` - Whether element is non-breaking

**Line Interface:**
- `fragments: LineFragment[]` - Fragments on this line
- `width, height, baseline` - Line metrics
- `y: number` - Y position from paragraph top
- `isLastLine, hasHardBreak` - Line state
- `lineNumber: number` - 0-indexed line number

**Features:**
- Word boundary line breaking for natural text flow
- Multiple runs with different font sizes
- Tab stops and their alignment
- Non-breaking spaces and hyphens
- Soft hyphens for optional breaks

**Utility Functions:**
- `getLineText(line)` - Get text content of a line
- `getLineCharCount(line)` - Get character count
- `isLineEmpty(line)` - Check if line is whitespace only
- `getFragmentAtOffset(line, offset)` - Get fragment at character offset
- `getXPositionForOffset(line, offset)` - Calculate x position
- `getTotalLines(result)` - Get total line count
- `isMultiLine(result)` - Check if multiple lines

**Verified:**
- bun build exits 0: ✓

---

### US-45: Page layout engine
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/layout/pageLayout.ts` with comprehensive page layout:

**Main Function:**
- `calculatePages(doc, options): PageLayoutResult` - Calculate page layout

**Page Interface:**
- `pageNumber: number` - 1-indexed page number
- `sectionIndex: number` - Section this page belongs to
- `sectionProps: SectionProperties` - Section properties
- `content: PageContent[]` - Content blocks on this page
- `header, footer: HeaderFooter | null` - Header/footer for page
- `isFirstPageOfSection, isLastPage` - Page flags
- `widthPx, heightPx` - Page dimensions
- `contentWidthPx, contentHeightPx` - Content area dimensions
- `contentTopPx, contentLeftPx` - Content area offsets

**PageContent Interface:**
- `type: 'paragraph' | 'table'` - Content type
- `block: Paragraph | Table` - Original block
- `blockIndex: number` - Index in document
- `y: number` - Y position on page
- `height: number` - Height of content
- `isContinuation, continuesOnNextPage` - Split flags
- `lines?: Line[]` - Lines for paragraphs
- `startLineIndex?: number` - First line if continuation

**Features:**
- Respects page size and margins from section properties
- Handles explicit page breaks (pageBreakBefore)
- Natural page breaks when content overflows
- Places headers/footers per page
- Different first page header/footer (titlePage)
- Odd/even page headers/footers (evenAndOddHeaders)
- Keep-lines-together support for paragraphs
- Paragraph splitting across pages with line tracking
- Table layout (keeps together when possible)

**Utility Functions:**
- `getPageCount(result)` - Get total page count
- `getPage(result, pageNumber)` - Get specific page
- `getPagesForSection(result, sectionIndex)` - Get section pages
- `blockSpansPages(result, blockIndex)` - Check if block spans pages
- `getPagesForBlock(result, blockIndex)` - Get pages with block
- `getTotalHeight(result)` - Calculate total document height
- `getPageAtY(result, y, gap)` - Get page at Y position
- `getYForPage(result, pageNumber, gap)` - Get Y position for page

**Verified:**
- bun build exits 0: ✓

---

### US-46: Column layout
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/layout/columnLayout.ts` with multi-column layout support:

**Main Function:**
- `layoutColumns(content, options): ColumnLayoutResult` - Layout content in columns

**Column Interface:**
- `index: number` - 0-indexed column
- `widthPx, xPx, heightPx` - Column dimensions
- `content: ColumnContent[]` - Content in this column
- `currentY: number` - Current filled height

**ColumnContent Interface:**
- `type: 'paragraph' | 'table'`
- `block: Paragraph | Table` - Original block
- `y, height` - Position and size
- `lines?: Line[]` - Lines for paragraphs
- `isContinuation, continuesOnNextColumn` - Split flags

**Features:**
- Distributes content across columns
- Handles explicit column breaks
- Equal and custom column widths
- Column spacing configuration
- Content overflow to next page
- Paragraph splitting across columns
- Table layout in columns

**Utility Functions:**
- `getColumnCount(sectionProps)` - Get column count
- `isMultiColumn(sectionProps)` - Check if multi-column
- `getColumnWidths(sectionProps, contentWidthPx)` - Get widths
- `getColumnSpacing(sectionProps)` - Get spacing in pixels
- `hasColumnSeparator(sectionProps)` - Check for separator line
- `getColumnAtX(result, x)` - Get column at X position
- `getContentAtPosition(result, x, y)` - Get content at position

**Verified:**
- bun build exits 0: ✓

---

### US-47: Page component
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/render/Page.tsx` with single page rendering:

**Main Component:**
- `Page` - React component rendering a single page from layout data

**Alternative Component:**
- `SimplePage` - Standalone page rendering with children

**Props:**
- `page: PageData` - Page data from layout engine
- `theme?: Theme` - Theme for resolving colors
- `zoom?: number` - Zoom level (1.0 = 100%)
- `showShadow?: boolean` - Whether to show page shadow
- `renderParagraph, renderTable` - Custom content renderers
- `renderHeader, renderFooter` - Custom header/footer renderers
- `onClick?: (e, page) => void` - Click handler

**Features:**
- Renders at correct page dimensions with zoom support
- Content area respects margins from section properties
- Header at top, footer at bottom with proper positioning
- Page background color from section properties
- Page borders support (top/bottom/left/right)
- White background with shadow for document appearance

**CSS Classes:**
- `docx-page` - Base class
- `docx-page-first` / `docx-page-last` - Position flags
- `docx-page-header-area` / `docx-page-footer-area` - Header/footer areas
- `docx-page-content` - Content area
- `docx-page-borders` - Page borders overlay

**Utility Functions:**
- `getPageDimensionsPx(sectionProps, zoom)` - Get page dimensions
- `getContentAreaPx(sectionProps, zoom)` - Get content area dimensions
- `isLandscape(sectionProps)` - Check if landscape
- `getPageSizeName(sectionProps)` - Get standard page size name

**Verified:**
- bun build exits 0: ✓

---

### US-48: Footnote area component
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/render/FootnoteArea.tsx` with footnote/endnote rendering:

**Main Components:**
- `FootnoteArea` - Renders footnotes at page bottom
- `EndnoteArea` - Renders endnotes at section/document end

**Props (FootnoteArea):**
- `footnotes: Footnote[]` - Footnotes to render
- `pageNumber: number` - Current page number
- `theme?: Theme` - Theme for resolving colors
- `properties?: FootnoteProperties` - Numbering format, etc.
- `startNumber?: number` - Starting number for this page
- `showSeparator?: boolean` - Whether to show separator line
- `separator?: ReactNode` - Custom separator element
- `renderParagraph?: (paragraph, index) => ReactNode` - Custom renderer
- `onFootnoteClick?: (id) => void` - Callback for back-link clicks

**Features:**
- Renders all footnotes for current page
- Separator line above footnotes
- Smaller text for footnote content (10px)
- Numbered references that link back to text
- Number formatting support (decimal, roman, letter)
- Filters out separator footnotes

**CSS Classes:**
- `docx-footnote-area` / `docx-endnote-area` - Container
- `docx-footnote-separator` - Separator line
- `docx-footnote-list` / `docx-endnote-list` - List container
- `docx-footnote-item` / `docx-endnote-item` - Individual notes
- `docx-footnote-number` / `docx-endnote-number` - Number markers
- `docx-footnote-content` / `docx-endnote-content` - Note content

**Utility Functions:**
- `calculateFootnoteAreaHeight(footnotes, options)` - Estimate area height
- `getFootnotesForPage(allFootnotes, pageIds)` - Filter by page
- `getFootnoteStartNumber(pageNumber, idsByPage, restart)` - Calculate start number
- `hasFootnotes(footnotes)` / `hasEndnotes(endnotes)` - Check existence
- `getFootnoteCount(footnotes)` / `getEndnoteCount(endnotes)` - Count (excluding separators)

**Verified:**
- bun build exits 0: ✓

---

### US-49: Document viewer
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/DocumentViewer.tsx` with full paginated document view:

**Main Component:**
- `DocumentViewer` - React component rendering paginated document

**Props:**
- `document?: Document` - The document to render
- `theme?: Theme` - Theme for resolving colors and fonts
- `zoom?: number` - Zoom level (1.0 = 100%)
- `pageGap?: number` - Gap between pages in pixels
- `showPageShadows?: boolean` - Whether to show page shadows
- `showPageNumbers?: boolean` - Whether to show page numbers
- `isLoading?: boolean` - Loading state
- `loadingIndicator?: ReactNode` - Custom loading indicator
- `placeholder?: ReactNode` - Custom placeholder for no document
- `renderParagraph, renderTable` - Custom content renderers
- `renderHeader, renderFooter` - Custom header/footer renderers
- `onPageVisible?: (pageNumber) => void` - Callback when page visible
- `onDocumentClick?: (e, page) => void` - Callback for clicks

**Features:**
- Renders all pages vertically with configurable gap
- Scrollable container with gray background
- Shows loading state while parsing (with spinner)
- Shows placeholder when no document loaded
- Zoom control support
- Page number indicators below each page
- Scroll tracking with current page detection

**CSS Classes:**
- `docx-viewer` - Container
- `docx-viewer-loading` / `docx-viewer-empty` - State classes
- `docx-viewer-content` - Pages container
- `docx-page-wrapper` - Individual page wrapper
- `docx-page-number-indicator` - Page number display

**Utility Functions:**
- `scrollToPage(containerRef, pageNumber, layoutResult, zoom, gap)` - Scroll to page
- `getVisiblePages(containerRef, layoutResult, zoom, gap)` - Get visible page numbers
- `calculateFitWidthZoom(containerWidth, pageWidth, padding)` - Calculate zoom for width
- `calculateFitPageZoom(containerWidth, containerHeight, pageWidth, pageHeight)` - Zoom for page

**Verified:**
- bun build exits 0: ✓

---

### US-50: Run serializer
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/serializer/runSerializer.ts` with comprehensive run serialization:

**Main Functions:**
- `serializeRun(run): string` - Serialize a single run to OOXML XML
- `serializeRuns(runs): string` - Serialize multiple runs
- `serializeTextFormatting(formatting): string` - Serialize w:rPr element

**Text Formatting Serialization (w:rPr):**
- w:rStyle (character style reference)
- w:rFonts (font family with theme references)
- w:b, w:bCs (bold)
- w:i, w:iCs (italic)
- w:caps, w:smallCaps (capitalization)
- w:strike, w:dstrike (strikethrough)
- w:outline, w:shadow, w:emboss, w:imprint (effects)
- w:vanish (hidden text)
- w:color (text color with theme support)
- w:spacing, w:w, w:kern, w:position (spacing/positioning)
- w:sz, w:szCs (font size)
- w:highlight (text highlight)
- w:u (underline with style and color)
- w:effect, w:em (effects and emphasis)
- w:shd (character shading)
- w:vertAlign (superscript/subscript)
- w:rtl, w:cs (right-to-left and complex script)

**Run Content Serialization:**
- w:t (text with xml:space="preserve" when needed)
- w:tab (tab characters)
- w:br (line/page/column breaks)
- w:sym (symbol characters)
- w:footnoteReference, w:endnoteReference
- w:fldChar (field characters)
- w:instrText (field instructions)
- w:softHyphen, w:noBreakHyphen
- w:drawing (placeholder for images)
- Shape content (placeholder)

**Utility Functions:**
- `hasRunContent(run)` - Check if run has content
- `hasRunFormatting(run)` - Check if run has formatting
- `getRunPlainText(run)` - Get plain text for debugging
- `createEmptyRun()` - Create empty run
- `createTextRun(text, formatting)` - Create text run
- `createBreakRun(breakType, formatting)` - Create break run
- `createTabRun(formatting)` - Create tab run

**Verified:**
- bun build exits 0: ✓

---

### US-51: Paragraph serializer
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/serializer/paragraphSerializer.ts` with comprehensive paragraph serialization:

**Main Functions:**
- `serializeParagraph(para): string` - Serialize a single paragraph to OOXML XML
- `serializeParagraphs(paras): string` - Serialize multiple paragraphs
- `serializeParagraphFormatting(formatting): string` - Serialize w:pPr element

**Paragraph Properties Serialization (w:pPr):**
- w:pStyle (paragraph style reference)
- w:keepNext, w:keepLines, w:pageBreakBefore (page break control)
- w:framePr (text frame properties)
- w:widowControl
- w:numPr (numbering/list properties with numId and ilvl)
- w:pBdr (paragraph borders: top, bottom, left, right, between, bar)
- w:shd (paragraph shading/background)
- w:tabs (tab stops with position, alignment, leader)
- w:suppressLineNumbers, w:suppressAutoHyphens
- w:spacing (before, after, line, lineRule, autospacing)
- w:ind (left, right, firstLine, hanging indentation)
- w:bidi (right-to-left text direction)
- w:jc (justification/alignment)
- w:outlineLvl (outline level for TOC)
- w:rPr (default run properties for paragraph)

**Content Serialization:**
- w:r (runs via serializeRun from runSerializer.ts)
- w:hyperlink (with rId, anchor, tooltip, target, history, docLocation)
- w:bookmarkStart (with id, name, colFirst, colLast)
- w:bookmarkEnd (with id)
- w:fldSimple (simple fields with instruction and content)
- Complex fields (reconstructed from fieldCode and fieldResult runs)

**Utility Functions:**
- `hasParagraphContent(paragraph)` - Check if paragraph has content
- `hasParagraphFormatting(paragraph)` - Check if paragraph has formatting
- `getParagraphPlainText(paragraph)` - Get plain text for debugging
- `createEmptyParagraph(formatting)` - Create empty paragraph
- `createTextParagraph(text, pFormatting, rFormatting)` - Create text paragraph
- `isListParagraph(paragraph)` - Check if paragraph is list item
- `getListLevel(paragraph)` - Get list level (0-8)

**Verified:**
- bun build exits 0: ✓

---

### US-52: Table serializer
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/serializer/tableSerializer.ts` with comprehensive table serialization:

**Main Functions:**
- `serializeTable(table): string` - Serialize a single table to OOXML XML (w:tbl)
- `serializeTables(tables): string` - Serialize multiple tables
- `serializeTableFormatting(formatting): string` - Serialize w:tblPr element
- `serializeTableRowFormatting(formatting): string` - Serialize w:trPr element
- `serializeTableCellFormatting(formatting): string` - Serialize w:tcPr element

**Table Properties Serialization (w:tblPr):**
- w:tblStyle (table style reference)
- w:tblpPr (floating table properties)
- w:bidiVisual (bidirectional)
- w:tblW (table width)
- w:jc (justification)
- w:tblCellSpacing (cell spacing)
- w:tblInd (table indent)
- w:tblBorders (top, bottom, left, right, insideH, insideV)
- w:tblCellMar (default cell margins)
- w:tblLayout (fixed or autofit)
- w:shd (shading)
- w:tblLook (conditional formatting flags)
- w:tblOverlap (overlap)

**Row Properties Serialization (w:trPr):**
- w:cantSplit (prevent row split)
- w:tblHeader (header row)
- w:trHeight (row height with height rule)
- w:jc (row justification)
- w:hidden (hidden row)

**Cell Properties Serialization (w:tcPr):**
- w:cnfStyle (conditional format style)
- w:tcW (cell width)
- w:gridSpan (horizontal merge)
- w:vMerge (vertical merge: restart or continue)
- w:tcBorders (cell borders)
- w:shd (cell shading)
- w:noWrap (no text wrap)
- w:tcMar (cell margins)
- w:textDirection (text direction)
- w:tcFitText (fit text)
- w:vAlign (vertical alignment)
- w:hideMark (hide mark)

**Cell Content Handling:**
- Recursively serializes paragraphs and nested tables
- Ensures at least one empty paragraph per cell (Word requirement)

**Utility Functions:**
- `hasTableRows(table)` - Check if table has rows
- `hasTableFormatting(table)` - Check if table has formatting
- `hasRowCells(row)` - Check if row has cells
- `hasRowFormatting(row)` - Check if row has formatting
- `hasCellContent(cell)` - Check if cell has content
- `hasCellFormatting(cell)` - Check if cell has formatting
- `getTableColumnCount(table)` - Get column count
- `getTableRowCount(table)` - Get row count
- `createEmptyTable(rows, cols)` - Create empty table
- `createTextCell(text, formatting)` - Create cell with text

**Verified:**
- bun build exits 0: ✓

---

### US-53: Document serializer
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/serializer/documentSerializer.ts` with complete document.xml serialization:

**Main Functions:**
- `serializeDocument(doc): string` - Serialize complete document.xml with all namespaces
- `serializeDocumentBody(body): string` - Serialize w:body content
- `serializeDocumentBodyElement(body): string` - Serialize w:body element with tags
- `serializeSectionProperties(props): string` - Serialize w:sectPr element

**XML Namespaces:**
- All standard OOXML namespaces included (w:, r:, wp:, wps:, wpg:, m:, etc.)
- Minimal set for smaller output: wpc, mc, o, r, m, v, wp14, wp, w10, w, w14, w15, wpg, wps
- mc:Ignorable declaration for extensibility

**Section Properties Serialization (w:sectPr):**
- w:headerReference, w:footerReference (by type: default, first, even)
- w:footnotePr, w:endnotePr (position, numFmt, numStart, numRestart)
- w:type (section start: continuous, nextPage, oddPage, evenPage, nextColumn)
- w:pgSz (page width, height, orientation)
- w:pgMar (all margins: top, bottom, left, right, header, footer, gutter)
- w:paperSrc (first and other pages paper source)
- w:pgBorders (page borders with display, offsetFrom, zOrder)
- w:lnNumType (line numbers: countBy, start, distance, restart)
- w:cols (column count, spacing, individual column definitions)
- w:docGrid (type, linePitch, charSpace)
- w:vAlign (vertical alignment)
- w:bidi (bidirectional section)
- w:titlePg (different first page header/footer)
- w:evenAndOddHeaders (odd/even page headers)

**Content Serialization:**
- Serializes all BlockContent (paragraphs and tables) in document order
- Delegates to `serializeParagraph()` from paragraphSerializer.ts
- Delegates to `serializeTable()` from tableSerializer.ts
- Final section properties at end of body

**Utility Functions:**
- `hasDocumentContent(doc)` - Check if document has any content
- `hasDocumentSections(doc)` - Check if document has sections
- `hasSectionProperties(doc)` - Check if document has section properties
- `getDocumentContentCount(doc)` - Get total blocks count
- `getDocumentParagraphCount(doc)` - Get paragraph count
- `getDocumentTableCount(doc)` - Get table count
- `getDocumentPlainText(doc)` - Get plain text for debugging
- `createEmptyDocument()` - Create empty document
- `createSimpleDocument(paragraphs)` - Create document with text paragraphs

**Verified:**
- bun build exits 0: ✓

---

### US-54: DOCX repacker
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/docx/rezip.ts` with comprehensive DOCX repacking:

**Main Functions:**
- `repackDocx(doc, options): Promise<ArrayBuffer>` - Main repacker function
- `repackDocxFromRaw(doc, rawContent, options): Promise<ArrayBuffer>` - Repack using raw content
- `updateDocumentXml(buffer, newXml, options): Promise<ArrayBuffer>` - Update only document.xml
- `updateXmlFile(buffer, path, content, options): Promise<ArrayBuffer>` - Update specific file
- `updateMultipleFiles(buffer, updates, options): Promise<ArrayBuffer>` - Update multiple files

**Relationship Management:**
- `addRelationship(buffer, relationship): Promise<{ buffer, rId }>` - Add new relationship
- `addMedia(buffer, filename, data, mimeType): Promise<{ buffer, rId, path }>` - Add media file

**Validation:**
- `validateDocx(buffer): Promise<{ valid, errors, warnings }>` - Validate DOCX structure
- `isDocxBuffer(buffer): boolean` - Quick check for ZIP signature

**Create New DOCX:**
- `createEmptyDocx(): Promise<ArrayBuffer>` - Create minimal valid DOCX
- `createDocx(doc): Promise<ArrayBuffer>` - Create DOCX from Document

**Features:**
- Preserves all original files (styles.xml, theme1.xml, fontTable.xml, etc.)
- Only updates document.xml with serialized content
- Maintains round-trip fidelity for WYSIWYG editing
- Optionally updates modification date in docProps/core.xml
- Supports configurable compression level
- Handles content types and relationships properly

**Options:**
- `compressionLevel` - Compression level 0-9 (default: 6)
- `updateModifiedDate` - Update modification timestamp (default: true)
- `modifiedBy` - Custom modifier name for lastModifiedBy

**Verified:**
- bun build exits 0: ✓

---

### US-55: Selection manager
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/hooks/useSelection.ts` with comprehensive selection tracking:

**Main Hook:**
- `useSelection(options)` - React hook for tracking DOM selection

**Types Defined:**
- `DocumentPosition` - Position within document (paragraphIndex, contentIndex, offset)
- `DocumentRange` - Range with start/end positions and collapsed flag
- `SelectionState` - Full selection state (selectedText, selectedRange, hasSelection, isWithinEditor, nativeSelection)
- `UseSelectionOptions` - Hook configuration options

**Hook Returns:**
- `selectedText` - Currently selected text (empty if collapsed)
- `selectedRange` - Document range of selection
- `hasSelection` - Whether there's an active selection
- `isWithinEditor` - Whether selection is within editor container
- `nativeSelection` - The DOM Selection object
- `setSelection(range)` - Set selection programmatically
- `collapseSelection(toStart)` - Collapse to start or end
- `selectAll()` - Select all content
- `processSelection()` - Force reprocess current selection

**Data Attributes for DOM Mapping:**
- `PARAGRAPH_INDEX` - `data-paragraph-index`
- `CONTENT_INDEX` - `data-content-index`
- `RUN_INDEX` - `data-run-index` (deprecated)
- `EDITOR_ROOT` - `data-docx-editor`
- `PAGE_NUMBER` - `data-page-number`

**Helper Functions:**
- `findParagraphElement(node)` - Find containing paragraph element
- `findContentElement(node)` - Find containing content element
- `calculateOffset(container, targetNode, targetOffset)` - Calculate char offset
- `domToDocumentPosition(node, offset, container)` - Convert DOM to document position
- `comparePositions(a, b)` - Compare two positions
- `isSelectionWithinContainer(selection, container)` - Check containment
- `findElementAtPosition(container, position)` - Find DOM element at position
- `findTextNodeAtOffset(element, offset)` - Find text node at offset

**Utility Exports:**
- `positionsEqual(a, b)` - Check position equality
- `rangesEqual(a, b)` - Check range equality
- `createCollapsedRange(position)` - Create cursor-only range
- `createRange(start, end)` - Create range from positions
- `getRangeLength(range)` - Get character length of range

**Features:**
- Works with contentEditable elements
- Listens for `selectionchange` events
- Converts DOM Selection to document positions
- Handles backwards selections (focus before anchor)
- Provides programmatic selection control
- Supports selection callbacks via `onSelectionChange`

**Verified:**
- bun build exits 0: ✓

---


### US-56: Editable run component
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/edit/EditableRun.tsx` with editable text run support:

**Main Component:**
- `EditableRun` - React component with contentEditable span for text editing

**Props:**
- `run: RunType` - The run data to render
- `runIndex: number` - Index in parent content array
- `paragraphIndex: number` - Index of parent paragraph
- `theme?: Theme` - Theme for resolving colors and fonts
- `editable?: boolean` - Whether editing is enabled
- `onChange?: (newRun, runIndex) => void` - Callback when content changes
- `onKeyDown?: (event, runIndex) => void` - Callback for key events
- `onFocus?: (runIndex) => void` - Callback when focused
- `onBlur?: (runIndex) => void` - Callback when blurred
- `onSelectionChange?: (offset, runIndex) => void` - Callback when cursor moves

**Features:**
- contentEditable span for text editing
- Syncs text changes to document model via onChange
- Preserves formatting during edits
- Handles IME composition (for CJK input)
- Template variable highlighting (non-editable within)
- Non-text content (images, shapes) rendered as non-editable
- Selection tracking within run
- Uses data attributes for DOM-to-document position mapping

**Utility Functions:**
- `isEditableRun(run)` - Check if run can be edited
- `getEditableRunText(run)` - Get plain text content
- `updateRunText(run, newText)` - Create run with new text preserving formatting
- `createEmptyRun(formatting)` - Create empty run
- `createTextRun(text, formatting)` - Create text run
- `mergeRuns(run1, run2)` - Merge runs with same formatting
- `splitRunAtOffset(run, offset)` - Split run at character offset

**Design Notes:**
- Only runs with text-only content are editable
- Runs with images, shapes, fields render as non-editable placeholders
- Uses contentEditable warning suppression for React
- Tracks last text value to avoid duplicate onChange calls
- Composition events handled for proper IME support

**Verified:**
- bun build exits 0: ✓

---

### US-61: Formatting toolbar
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/Toolbar.tsx` with comprehensive formatting controls:

**Main Component:**
- `Toolbar` - React component with all formatting controls

**Subcomponents:**
- `ToolbarButton` - Individual button with active/disabled state and hover effects
- `ToolbarGroup` - Button group with separator for organization
- `ToolbarSeparator` - Visual separator between groups

**Props (Toolbar):**
- `currentFormatting: SelectionFormatting` - Current formatting of selection
- `onFormat: (action: FormattingAction) => void` - Format action callback
- `onUndo, onRedo` - History callbacks
- `canUndo, canRedo` - History state
- `disabled` - Disable all controls
- `enableShortcuts` - Enable keyboard shortcuts (default: true)
- `editorRef` - Reference to editor for keyboard events
- `children` - Custom toolbar items

**Formatting Buttons:**
- Bold (Ctrl+B) with active state
- Italic (Ctrl+I) with active state
- Underline (Ctrl+U) with active state
- Strikethrough with active state
- Superscript (Ctrl+Shift+=) with active state
- Subscript (Ctrl+=) with active state
- Clear Formatting button

**History Buttons:**
- Undo (Ctrl+Z)
- Redo (Ctrl+Y)

**Features:**
- Keyboard shortcuts for formatting (Ctrl+B/I/U, etc.)
- Shows active state for current selection formatting
- Applies formatting to selection via callback
- Disabled state support
- Accessible with ARIA labels and roles
- SVG icons for all buttons
- Hover effects on buttons

**Utility Functions:**
- `getSelectionFormatting(TextFormatting)` - Extract formatting state from document model
- `applyFormattingAction(formatting, action)` - Apply action to formatting, returns new formatting
- `hasActiveFormatting(formatting)` - Check if any formatting is active

**Types:**
- `SelectionFormatting` - Interface for selection formatting state
- `FormattingAction` - Union type for all formatting actions
- `ToolbarProps`, `ToolbarButtonProps`, `ToolbarGroupProps`

**Verified:**
- bun build exits 0: ✓

---

### US-62: Font picker
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/ui/FontPicker.tsx` with comprehensive font family selection:

**Main Component:**
- `FontPicker` - React component with dropdown for selecting font families

**Props:**
- `value?: string` - Currently selected font family
- `onChange?: (fontFamily: string) => void` - Callback when font is selected
- `fonts?: FontOption[]` - Custom font options (defaults provided)
- `disabled?: boolean` - Whether picker is disabled
- `placeholder?: string` - Placeholder text
- `width?: number | string` - Dropdown width
- `showPreview?: boolean` - Show fonts in their own typeface

**Features:**
- Dropdown with available fonts grouped by category (sans-serif, serif, monospace)
- Shows fonts in their own typeface for preview
- Keyboard navigation (Arrow keys, Enter, Escape)
- Shows current font of selection
- Google Fonts integration via fontLoader and fontResolver
- Hover and focus states
- Accessible with ARIA attributes

**Default Fonts Included:**
- Sans-serif: Arial, Calibri, Helvetica, Verdana, Tahoma, Trebuchet MS, Open Sans, Roboto, Lato
- Serif: Times New Roman, Cambria, Georgia, Palatino, Garamond, Book Antiqua
- Monospace: Courier New, Consolas, Monaco, Source Code Pro

**Utility Functions:**
- `getDefaultFonts()` - Get default font options
- `createFontOption(fontName)` - Create option from font name
- `mergeFontOptions(customFonts, includeDefaults)` - Merge custom with defaults
- `isFontAvailable(fontName)` - Check if font is loaded

**Verified:**
- bun build exits 0: ✓

---

### US-63: Font size picker
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/ui/FontSizePicker.tsx` with comprehensive font size selection:

**Main Component:**
- `FontSizePicker` - React component with dropdown/input for selecting font sizes

**Props:**
- `value?: number` - Currently selected font size (in points)
- `onChange?: (size: number) => void` - Callback when size is selected
- `sizes?: number[]` - Custom size options (defaults provided)
- `disabled?: boolean` - Whether picker is disabled
- `placeholder?: string` - Placeholder text
- `width?: number | string` - Picker width
- `minSize?: number` - Minimum allowed size (default: 1)
- `maxSize?: number` - Maximum allowed size (default: 999)

**Features:**
- Dropdown with common sizes (8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72)
- Text input for custom sizes
- Keyboard navigation (Arrow keys, Enter, Escape)
- Shows current size of selection
- Input validation and clamping
- Hover and focus states
- Accessible with ARIA attributes

**Utility Functions:**
- `getDefaultSizes()` - Get default size options
- `isValidFontSize(size, min, max)` - Validate font size
- `clampFontSize(size, min, max)` - Clamp to valid range
- `halfPointsToPoints(hp)` - Convert OOXML half-points to points
- `pointsToHalfPoints(pt)` - Convert points to half-points
- `formatFontSize(size)` - Format for display
- `parseFontSize(input)` - Parse from string input
- `getSizePresets()` - Get sizes grouped by category
- `nearestStandardSize(size)` - Find nearest standard size
- `nextLargerSize(currentSize)` - Get next larger standard size
- `nextSmallerSize(currentSize)` - Get next smaller standard size

**Verified:**
- bun build exits 0: ✓

---
### US-64: Color picker
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/ui/ColorPicker.tsx` with comprehensive color selection:

**Main Components:**
- `ColorPicker` - Main color picker with dropdown grid
- `ColorGrid` - Reusable color grid component
- `TextColorPicker` - Specialized text color picker (foreground)
- `HighlightColorPicker` - Specialized highlight color picker (background)

**Props:**
- `value?: string` - Currently selected color (hex)
- `onChange?: (color: string) => void` - Callback when color is selected
- `type?: 'text' | 'highlight'` - Type of color picker
- `theme?: Theme` - Theme for resolving theme colors
- `colors?: ColorOption[]` - Custom color options
- `disabled?: boolean` - Whether picker is disabled
- `showNoColor?: boolean` - Show "No Color" option
- `showMoreColors?: boolean` - Show custom hex input

**Features:**
- Grid of common colors (30 for text, 16 for highlight)
- Text color button with font color indicator bar
- Highlight color button with marker indicator
- Shows current color of selection via color bar
- Custom hex color input for text colors
- Keyboard navigation support
- Accessible with ARIA attributes

**Default Colors:**
- Text colors: 30 colors in 3 rows (dark, standard, tints)
- Highlight colors: 16 standard Word highlight colors

**Utility Functions:**
- `getTextColors()` - Get default text colors
- `getHighlightColors()` - Get default highlight colors
- `createColorOption(hex, name)` - Create color option
- `isColorInList(hex, colors)` - Check if color in list
- `getColorName(hex, colors)` - Get color name from hex
- `parseColorValue(color)` - Parse color from various formats
- `isValidHexColor(hex)` - Validate hex color
- `getContrastColor(bgHex)` - Get contrasting text color
- `getThemeColorsForPicker(theme)` - Get theme colors for picker

**Verified:**
- bun build exits 0: ✓

---

### US-65: Alignment buttons
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/ui/AlignmentButtons.tsx` with paragraph alignment controls:

**Main Components:**
- `AlignmentButtons` - Main component with left, center, right, justify buttons
- `AlignmentButton` - Individual button component with active/hover states

**Props:**
- `value?: ParagraphAlignment` - Current alignment value
- `onChange?: (alignment: ParagraphAlignment) => void` - Callback when changed
- `disabled?: boolean` - Whether buttons are disabled
- `showLabels?: boolean` - Show text labels next to icons
- `compact?: boolean` - Smaller button size

**Features:**
- Left, Center, Right, Justify buttons with SVG icons
- Shows active state for current paragraph alignment
- Applies alignment to current paragraph(s) via onChange callback
- Keyboard shortcut hints in tooltips (Ctrl+L/E/R/J)
- ARIA attributes for accessibility
- Compact mode for dense toolbars

**CSS Classes:**
- `docx-alignment-buttons` - Container
- `docx-alignment-button` - Individual button
- `docx-alignment-button-active` - Active state
- `docx-alignment-button-disabled` - Disabled state

**Utility Functions:**
- `getAlignmentOptions()` - Get all alignment options
- `isValidAlignment(value)` - Type guard for alignment values
- `getAlignmentLabel(value)` - Get display label
- `getAlignmentIcon(value)` - Get icon component
- `getAlignmentShortcut(value)` - Get keyboard shortcut
- `alignmentToCss(alignment)` - Convert OOXML to CSS text-align
- `cssToAlignment(textAlign)` - Convert CSS to OOXML alignment
- `cycleAlignment(current)` - Cycle to next alignment
- `handleAlignmentShortcut(event)` - Parse keyboard shortcut

**Exported Icons:**
- `AlignLeftIcon`, `AlignCenterIcon`, `AlignRightIcon`, `AlignJustifyIcon`

**Verified:**
- bun build exits 0: ✓

---

### US-66: List buttons
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/ui/ListButtons.tsx` with list formatting controls:

**Main Components:**
- `ListButtons` - Main component with bullet/numbered list buttons and indent controls
- `ListButton` - Individual button component with active/hover states

**Types:**
- `ListType` - 'bullet' | 'numbered' | 'none'
- `ListState` - State object with type, level, isInList, numId

**Props:**
- `listState?: ListState` - Current list state of selection
- `onBulletList?: () => void` - Callback for bullet list toggle
- `onNumberedList?: () => void` - Callback for numbered list toggle
- `onIndent?: () => void` - Callback for increase indent
- `onOutdent?: () => void` - Callback for decrease indent
- `disabled?: boolean` - Whether buttons are disabled
- `showIndentButtons?: boolean` - Show indent/outdent buttons
- `compact?: boolean` - Smaller button size

**Features:**
- Bullet list button with toggle behavior
- Numbered list button with toggle behavior
- Indent button (increase list level)
- Outdent button (decrease list level, disabled at level 0)
- Active states for current list type
- ARIA attributes for accessibility

**CSS Classes:**
- `docx-list-buttons` - Container
- `docx-list-button` - Individual button
- `docx-list-button-active` - Active state
- `docx-list-button-disabled` - Disabled state

**Utility Functions:**
- `createDefaultListState()` - Create non-list state
- `createBulletListState(level, numId)` - Create bullet list state
- `createNumberedListState(level, numId)` - Create numbered list state
- `isBulletListState(state)` / `isNumberedListState(state)` - Type checks
- `isAnyListState(state)` - Check if in any list
- `getNextIndentLevel(level)` / `getPreviousIndentLevel(level)` - Level manipulation
- `toggleListType(state, targetType)` - Toggle list type
- `getListIndentCss(level)` - Get CSS for list indent
- `getDefaultBulletForLevel(level)` - Get bullet character
- `getDefaultNumberFormatForLevel(level)` - Get number format
- `handleListShortcut(event)` - Parse keyboard shortcuts (Tab/Shift+Tab)

**Exported Icons:**
- `BulletListIcon`, `NumberedListIcon`, `IndentIcon`, `OutdentIcon`

**Verified:**
- bun build exits 0: ✓

---

### US-67: Style picker
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/ui/StylePicker.tsx` with comprehensive style selection:

**Main Component:**
- `StylePicker` - React component with dropdown for selecting paragraph/character styles

**Props:**
- `value?: string` - Currently selected style ID
- `onChange?: (styleId: string) => void` - Callback when style is selected
- `styles?: Style[]` - Available styles from document
- `theme?: Theme` - Document theme for color resolution
- `disabled?: boolean` - Whether picker is disabled
- `showPreview?: boolean` - Show styles in their formatting
- `styleTypes?: StyleType[]` - Filter to specific style types
- `quickFormatOnly?: boolean` - Only show qFormat styles

**Features:**
- Dropdown with available styles from document
- Shows style name in its formatting (preview)
- Shows current style of selection
- Applies style to paragraph via onChange callback
- Keyboard navigation (Arrow keys, Enter, Escape)
- Grouped by category: Headings, Paragraph, Quotes, Lists & TOC
- Sorts by UI priority then name
- Default styles when no document styles provided

**Default Styles Included:**
- Normal, Heading 1-3, Title, Subtitle, Quote, Intense Quote

**Utility Functions:**
- `getDefaultStyles()` - Get default style options
- `createStyleOptions(styles, options)` - Convert Style[] to StyleOption[]
- `findStyleById(styles, styleId)` - Find style by ID
- `findStyleByName(styles, name)` - Find style by name
- `getParagraphStyles(styles)` - Filter paragraph styles
- `getCharacterStyles(styles)` - Filter character styles
- `getTableStyles(styles)` - Filter table styles
- `getQuickFormatStyles(styles)` - Filter qFormat styles
- `getDefaultParagraphStyle(styles)` - Get default/Normal style
- `isHeadingStyle(style)` - Check if style is a heading
- `getHeadingLevel(style)` - Get heading level (1-9)

**Verified:**
- bun build exits 0: ✓

---

### US-68: Insert hyperlink dialog
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/dialogs/HyperlinkDialog.tsx` with comprehensive hyperlink dialog:

**Main Component:**
- `HyperlinkDialog` - React modal component for inserting/editing hyperlinks

**Props:**
- `isOpen: boolean` - Whether the dialog is open
- `onClose: () => void` - Callback when dialog is closed
- `onSubmit: (data: HyperlinkData) => void` - Callback when hyperlink is submitted
- `onRemove?: () => void` - Callback when hyperlink is removed
- `initialData?: HyperlinkData` - Initial data for editing existing hyperlink
- `selectedText?: string` - Currently selected text (default display text)
- `isEditing?: boolean` - Whether editing an existing hyperlink
- `bookmarks?: BookmarkOption[]` - Available bookmarks for internal links

**Features:**
- Input for URL with validation (http, https, mailto, tel, ftp)
- Input for display text
- Edit existing hyperlinks
- Remove hyperlink option
- Internal bookmark selection via tabs (when bookmarks available)
- Tooltip input
- Form validation with error messages
- Keyboard support (Enter to submit, Escape to close)
- Focus management
- Accessible with ARIA attributes

**Types:**
- `HyperlinkData` - Interface for hyperlink data (url, displayText, bookmark, tooltip)
- `BookmarkOption` - Interface for bookmark selection options
- `HyperlinkDialogProps` - Component props interface

**Utility Functions:**
- `isValidUrl(url)` - Validate URL string (supports http, https, mailto, tel, ftp)
- `normalizeUrl(url)` - Add protocol if missing
- `getUrlType(url)` - Detect URL type (web, email, phone, ftp)
- `createHyperlinkData(url, displayText)` - Create hyperlink data from URL
- `createBookmarkLinkData(bookmark, displayText)` - Create bookmark link data
- `isExternalHyperlinkData(data)` - Check if external URL
- `isBookmarkHyperlinkData(data)` - Check if internal bookmark
- `getDisplayText(data)` - Get display text with fallback
- `emailToMailto(email)` - Convert email to mailto: link
- `phoneToTel(phone)` - Convert phone to tel: link
- `extractBookmarksForDialog(bookmarks)` - Convert bookmarks for dialog

**CSS Classes:**
- `docx-hyperlink-dialog-overlay` - Overlay backdrop
- `docx-hyperlink-dialog` - Dialog container
- `docx-hyperlink-dialog-header` - Header with title and close button
- `docx-hyperlink-dialog-body` - Body with form fields
- `docx-hyperlink-dialog-footer` - Footer with action buttons
- `docx-hyperlink-dialog-tabs` - Tab buttons for URL/bookmark switch
- `docx-hyperlink-dialog-field` - Form field container
- `docx-hyperlink-dialog-input` - Text input
- `docx-hyperlink-dialog-select` - Select dropdown

Also created `src/components/dialogs/index.ts` for exports.

**Verified:**
- bun build exits 0: ✓

---

### US-69: Find and Replace dialog
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/dialogs/FindReplaceDialog.tsx` with comprehensive find and replace functionality:

**Main Component:**
- `FindReplaceDialog` - React modal component for find and replace

**Props:**
- `isOpen: boolean` - Whether the dialog is open
- `onClose: () => void` - Callback when dialog is closed
- `onFind: (searchText, options) => FindResult | null` - Callback for searching
- `onFindNext: () => FindMatch | null` - Callback for navigating to next match
- `onFindPrevious: () => FindMatch | null` - Callback for navigating to previous match
- `onReplace: (replaceText) => boolean` - Callback for replacing current match
- `onReplaceAll: (searchText, replaceText, options) => number` - Callback for replacing all
- `onHighlightMatches?: (matches) => void` - Callback to highlight matches
- `onClearHighlights?: () => void` - Callback to clear highlights
- `initialSearchText?: string` - Pre-populated search text
- `replaceMode?: boolean` - Start in replace mode (Ctrl+H)

**Features:**
- Find input with next/previous navigation buttons (Enter/Shift+Enter)
- Replace input with replace/replace all buttons
- Match case option checkbox
- Match whole word option checkbox
- Match count display (e.g., "3 of 12 matches")
- No results indicator
- Non-modal positioning (top-right, doesnt block document)
- Keyboard shortcuts (Escape to close)
- Toggle between Find and Find+Replace modes
- Focus management
- ARIA accessibility attributes

**Types:**
- `FindMatch` - Interface for a single match (paragraphIndex, contentIndex, offsets, text)
- `FindOptions` - Interface for search options (matchCase, matchWholeWord, useRegex)
- `FindResult` - Interface for search result (matches, totalCount, currentIndex)
- `HighlightOptions` - Interface for highlight colors

**Utility Functions:**
- `createDefaultFindOptions()` - Create default find options
- `findAllMatches(content, searchText, options)` - Find all matches in text
- `escapeRegexString(str)` - Escape string for regex use
- `createSearchPattern(searchText, options)` - Create regex from options
- `replaceAllInContent(content, searchText, replaceText, options)` - Replace all in text
- `replaceFirstInContent(content, searchText, replaceText, options, startIndex)` - Replace first match
- `getMatchCountText(result)` - Format match count for display
- `isEmptySearch(searchText)` - Check if search is empty
- `getDefaultHighlightOptions()` - Get default highlight colors

**CSS Classes:**
- `docx-find-replace-dialog-overlay` - Non-blocking overlay
- `docx-find-replace-dialog` - Dialog container
- `docx-find-replace-dialog-header` - Header with title and close
- `docx-find-replace-dialog-body` - Body with inputs
- `docx-find-replace-dialog-row` - Input row layout
- `docx-find-replace-dialog-input` - Text inputs
- `docx-find-replace-dialog-nav` - Navigation buttons
- `docx-find-replace-dialog-options` - Options checkboxes
- `docx-find-replace-dialog-status` - Match count display

**Keyboard Shortcuts:**
- Enter - Find next (or initial search)
- Shift+Enter - Find previous
- Escape - Close dialog

**Verified:**
- bun build exits 0: ✓

---

### US-70: Zoom control
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/ui/ZoomControl.tsx` with comprehensive zoom control functionality:

**Main Component:**
- `ZoomControl` - React component with dropdown and zoom in/out buttons

**Props:**
- `value?: number` - Current zoom level (1.0 = 100%)
- `onChange?: (zoom: number) => void` - Callback when zoom changes
- `levels?: ZoomLevel[]` - Custom zoom levels
- `disabled?: boolean` - Whether the control is disabled
- `minZoom?: number` - Minimum zoom level (default: 0.25)
- `maxZoom?: number` - Maximum zoom level (default: 4.0)
- `showButtons?: boolean` - Show zoom in/out buttons (default: true)
- `persistZoom?: boolean` - Persist zoom preference to localStorage
- `storageKey?: string` - Storage key for persisting zoom
- `compact?: boolean` - Compact mode (smaller size)

**Features:**
- Dropdown with zoom levels (50%, 75%, 100%, 125%, 150%, 200%)
- Zoom in/out buttons with proper limits
- Scales page rendering (via onChange callback)
- Persists zoom preference to localStorage (configurable)
- Keyboard navigation (Arrow keys, Enter, Escape)
- Accessible with ARIA attributes
- Compact mode for dense toolbars

**Default Zoom Levels:**
- 50%, 75%, 100%, 125%, 150%, 200%

**Extended Zoom Levels (available via getExtendedZoomLevels):**
- 25%, 50%, 75%, 90%, 100%, 110%, 125%, 150%, 175%, 200%, 300%, 400%

**Utility Functions:**
- `getDefaultZoomLevels()` - Get default zoom levels
- `getExtendedZoomLevels()` - Get extended zoom levels
- `createZoomLevel(value)` - Create zoom level from decimal
- `createZoomLevelsFromPercentages(percentages)` - Create levels from percentages
- `isValidZoom(zoom, min, max)` - Check if zoom is valid
- `clampZoom(zoom, min, max)` - Clamp zoom to valid range
- `zoomToPercentage(zoom)` - Convert zoom to percentage string
- `percentageToZoom(percentage)` - Convert percentage to zoom decimal
- `parseZoom(input)` - Parse zoom from string (handles "100%" and "1.0")
- `nearestZoomLevel(zoom, levels)` - Find nearest predefined zoom level
- `calculateFitWidthZoom(containerWidth, pageWidth, padding)` - Calculate fit-width zoom
- `calculateFitPageZoom(containerWidth, containerHeight, pageWidth, pageHeight, padding)` - Calculate fit-page zoom
- `getStoredZoom(storageKey)` - Get zoom from localStorage
- `storeZoom(zoom, storageKey)` - Store zoom to localStorage
- `clearStoredZoom(storageKey)` - Clear stored zoom
- `hasZoomLevel(zoom, levels)` - Check if zoom level exists
- `getZoomStep()` - Get zoom increment step (0.25)
- `applyZoomTransform(style, zoom)` - Apply zoom transform to CSS
- `getZoomedDimensions(width, height, zoom)` - Calculate zoomed dimensions

**Exported Icons:**
- `ZoomInIcon` - SVG icon for zoom in
- `ZoomOutIcon` - SVG icon for zoom out

**CSS Classes:**
- `docx-zoom-control` - Container
- `docx-zoom-out-button` - Zoom out button
- `docx-zoom-in-button` - Zoom in button
- `docx-zoom-dropdown-trigger` - Dropdown trigger
- `docx-zoom-dropdown-menu` - Dropdown menu

**Verified:**
- bun build exits 0: ✓

---

### US-71: Table editing toolbar
**Date:** 2026-02-01
**Status:** Complete ✅

`src/components/ui/TableToolbar.tsx` exists with comprehensive table manipulation controls:

**Main Components:**
- `TableToolbar` - Main component with all table editing controls
- `TableToolbarButton` - Individual button component with hover/disabled states

**Table Actions Supported:**
- Add row above/below
- Add column left/right
- Delete row/column
- Merge cells (when multiple cells selected)
- Split cell (when cell is merged)
- Delete table

**Context Detection:**
- Uses `TableContext` interface to track:
  - Current table and selection
  - Whether multiple cells are selected
  - Whether current cell can be split
  - Row and column counts

**SVG Icons:**
- `AddRowAboveIcon`, `AddRowBelowIcon` - Row insertion icons
- `AddColumnLeftIcon`, `AddColumnRightIcon` - Column insertion icons
- `DeleteRowIcon`, `DeleteColumnIcon` - Deletion icons with red accent
- `MergeCellsIcon`, `SplitCellIcon` - Merge/split icons
- `DeleteTableIcon` - Full table deletion icon

**Utility Functions:**
- `createTableContext(table, selection)` - Create context from table and selection
- `getColumnCount(table)` - Get column count accounting for merged cells
- `getCellAt(table, row, col)` - Get cell at specific position
- `isMultiCellSelection(selection)` - Check for multi-cell selection
- `getSelectionBounds(selection)` - Get selection boundaries
- `isCellInSelection(row, col, selection)` - Check if cell in selection
- `createEmptyRow(template, colCount)` - Create new row from template
- `createEmptyCell()` - Create empty cell with paragraph
- `addRow(table, index, position)` - Add row before/after
- `deleteRow(table, rowIndex)` - Delete row from table
- `addColumn(table, index, position)` - Add column before/after
- `deleteColumn(table, columnIndex)` - Delete column from table
- `mergeCells(table, selection)` - Merge selected cells
- `splitCell(table, row, col)` - Split merged cell
- `getActionLabel(action)` - Get display label for action
- `isDeleteAction(action)` - Check if action is destructive

**CSS Classes:**
- `docx-table-toolbar` - Main container
- `docx-table-toolbar-compact` - Compact mode
- `docx-table-toolbar-floating` - Floating position
- `docx-table-toolbar-button` - Individual button

**Features:**
- Shows when cursor is in a table (via context prop)
- Disables row/column deletion when only one row/column remains
- Disables merge when single cell selected
- Disables split when cell not merged
- Supports compact mode for dense UIs
- Supports floating mode for popup positioning
- ARIA labels for accessibility

**Verified:**
- bun build exits 0: ✓

---

### US-72: Image editing
**Date:** 2026-02-01
**Status:** Complete ✅

Created `src/components/edit/EditableImage.tsx` with comprehensive image editing capabilities:

**Main Component:**
- `EditableImage` - React component with resize handles and editing support

**Props:**
- `image: ImageType` - The image data to render
- `imageIndex?: number` - Index for identification
- `editable?: boolean` - Whether editing is enabled
- `selected?: boolean` - Whether image is selected
- `onSelect?: (index) => void` - Selection callback
- `onDeselect?: () => void` - Deselection callback
- `onResize?: (newSize) => void` - Resize callback
- `onDelete?: () => void` - Deletion callback
- `onChange?: (image) => void` - Change callback
- `minWidth/minHeight/maxWidth/maxHeight` - Size constraints

**Resize Handles:**
- 8 handles: nw, n, ne, e, se, s, sw, w
- Corner handles (larger) and edge handles (smaller)
- Blue colored handles with white border and shadow
- Proper cursors for each handle direction

**Resize Behavior:**
- Maintains aspect ratio by default
- Hold Shift to unlock aspect ratio (free resize)
- Minimum size constraints (default 20px)
- Maximum size constraints (default 2000px)
- Real-time dimension indicator during resize
- Converts to EMUs on completion

**Selection & Keyboard:**
- Click to select image
- Blue outline when selected
- Delete/Backspace key removes image
- Escape key deselects
- Tab focus support for accessibility

**CSS Classes:**
- `docx-editable-image` - Base class
- `docx-editable-image-inline` / `docx-editable-image-floating` - Position mode
- `docx-editable-image-selected` - Selection state
- `docx-editable-image-resizing` - During resize
- `docx-resize-handle` - Resize handle elements

**Utility Functions:**
- `isResizableImage(image)` - Check if image can be resized
- `getOriginalAspectRatio(image)` - Get original aspect ratio
- `calculateProportionalSize(w, h, newW, newH)` - Maintain aspect ratio
- `resizeImage(image, newSize)` - Create resized image copy
- `scaleImage(image, scale)` - Scale by percentage
- `resetImageSize(image)` - Reset to original size
- `getImageBounds(image)` - Get dimensions in pixels
- `isPointInImage(image, x, y, imgX, imgY)` - Hit testing

**Features:**
- Floating/inline image support
- Transform support (rotation, flip)
- Placeholder for missing images
- Accessibility with ARIA attributes
- Dimension indicator shows current size during resize

**Verified:**
- bun build exits 0: ✓

---
