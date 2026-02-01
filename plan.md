# Development Plan - EigenPal DOCX Editor

**IMPORTANT:** Custom implementation. Reference `~/superdoc` for OOXML understanding. No SuperDoc imports.

## Development Approach

This plan is **exploratory and dynamic**. DOCX/OOXML is complex - we discover structure as we implement.

**When you encounter unexpected DOCX structure:**
- Document it in activity.md
- Adapt the implementation
- Add new sub-tasks if needed

---

# PHASE 1: FOUNDATION & EXPLORATION

### US-01: Project scaffold
**Title:** Clean project setup
**Description:** Setup package.json, tsconfig, entry points. Add dependencies: react, react-dom, jszip, xml-js, docxtemplater, pizzip. NO superdoc.
**Acceptance Criteria:**
- package.json with correct deps (no superdoc)
- tsconfig.json with jsx: react-jsx
- src/index.ts entry point
- bun build exits 0
**passes:** true

---

### US-02: DOCX exploration utility
**Title:** Build a DOCX explorer to understand structure
**Description:** Create a utility that opens a DOCX, lists all files in the ZIP, and can pretty-print any XML file. Save findings to activity.md.
**Acceptance Criteria:**
- src/docx/explorer.ts exists
- `exploreDocx(buffer): Promise<DocxExploration>`
- Lists all files in ZIP with sizes
- Can extract and format any XML file
- Document structure findings in activity.md
- bun build exits 0
**passes:** true

---

### US-03: Comprehensive document types
**Title:** Define TypeScript types for full document model
**Description:** Define ALL types needed for complete DOCX representation. Include everything: formatting, tables, images, hyperlinks, fields, footnotes, shapes.
**Acceptance Criteria:**
- src/types/document.ts with comprehensive types:
  - `Document`, `Section`, `SectionProperties`
  - `Paragraph`, `ParagraphFormatting` (alignment, spacing, indent, borders, shading, tabs, keepNext, keepLines, widowControl, bidi)
  - `Run`, `TextFormatting` (bold, italic, underline, strike, dstrike, superscript, subscript, smallCaps, allCaps, highlight, shading, color, fontSize, fontFamily, spacing, effects)
  - `Hyperlink`, `Bookmark`
  - `Field` (pageNum, numPages, date, docProperty, etc.)
  - `Table`, `TableRow`, `TableCell`, `TableFormatting`
  - `Image`, `Shape`, `TextBox`
  - `List`, `ListLevel`, `NumberingDefinition`
  - `HeaderFooter`, `Footnote`, `Endnote`
  - `Tab`, `TabStop`
- src/types/index.ts exports all
- bun build exits 0
**passes:** true

---

# PHASE 2: FONT INFRASTRUCTURE

### US-04: Google Fonts loader
**Title:** Dynamic font loading from Google Fonts
**Description:** Create a font loader that fetches fonts from Google Fonts API. Handle loading states and fallbacks.
**Acceptance Criteria:**
- src/utils/fontLoader.ts exists
- `loadFont(fontFamily: string): Promise<boolean>`
- `loadFonts(families: string[]): Promise<void>`
- `isFontLoaded(fontFamily: string): boolean`
- `onFontsLoaded(callback): void` - notify when fonts ready
- Uses Google Fonts CSS API
- Tracks loaded fonts to avoid duplicates
- Loading state tracking
- bun build exits 0
**passes:** true

---

### US-05: Font family resolver
**Title:** Resolve DOCX font names to Google Fonts
**Description:** Map DOCX font names to Google Fonts equivalents with proper fallback stacks.
**Acceptance Criteria:**
- src/utils/fontResolver.ts exists
- `resolveFontFamily(docxFontName: string): { googleFont: string | null, cssFallback: string }`
- Maps: Calibri→Carlito, Cambria→Caladea, Arial→Arimo, Times New Roman→Tinos, Courier New→Cousine
- Handles theme fonts (majorFont, minorFont)
- Returns proper CSS fallback stack
- bun build exits 0
**passes:** true

---

### US-06: Font extraction from DOCX
**Title:** Extract all fonts used in document
**Description:** Scan document to find all fonts for preloading.
**Acceptance Criteria:**
- src/utils/fontExtractor.ts exists
- `extractFonts(doc: Document): string[]`
- Scans runs, styles, theme
- Returns unique list
- bun build exits 0
**passes:** true

---

# PHASE 3: PARSING INFRASTRUCTURE

### US-07: XML parser utilities
**Title:** XML parsing helpers for OOXML
**Description:** Build utilities to parse XML with namespace handling (w:, a:, r:, wp:, wps:, m:).
**Acceptance Criteria:**
- src/docx/xmlParser.ts exists
- Uses xml-js to parse XML
- Helper functions: findChild, findChildren, getAttribute, getTextContent
- Handles all OOXML namespaces
- bun build exits 0
**passes:** true

---

### US-08: DOCX unzipper
**Title:** Extract all files from DOCX
**Description:** Extract all XML files, media, relationships from DOCX ZIP.
**Acceptance Criteria:**
- src/docx/unzip.ts exists
- `unzipDocx(buffer): Promise<DocxPackage>`
- Extracts: document.xml, styles.xml, theme/theme1.xml, numbering.xml, fontTable.xml
- Extracts: header*.xml, footer*.xml, footnotes.xml, endnotes.xml
- Extracts: word/media/* (images)
- Extracts: word/_rels/*.rels
- Stores original zip for round-trip
- bun build exits 0
**passes:** true

---

### US-09: Relationship parser
**Title:** Parse .rels files for resource mapping
**Description:** Parse relationships to map rId references to targets (images, hyperlinks, headers, etc.).
**Acceptance Criteria:**
- src/docx/relsParser.ts exists
- `parseRelationships(relsXml: string): RelationshipMap`
- Maps rId → { target, type }
- Handles: images, hyperlinks, headers, footers, footnotes
- bun build exits 0
**passes:** true

---

### US-10: Theme parser
**Title:** Parse theme colors and fonts
**Description:** Extract color scheme and font scheme from theme1.xml.
**Acceptance Criteria:**
- src/docx/themeParser.ts exists
- `parseTheme(themeXml: string | null): Theme`
- Extracts color scheme (dk1, lt1, dk2, lt2, accent1-6, hlink, folHlink)
- Extracts font scheme (majorFont, minorFont for different scripts)
- Default values if theme missing
- bun build exits 0
**passes:** true

---

### US-11: Style parser with full inheritance
**Title:** Parse styles.xml with complete style resolution
**Description:** Parse all style types with full inheritance chain resolution.
**Acceptance Criteria:**
- src/docx/styleParser.ts exists
- `parseStyles(stylesXml: string, theme: Theme): StyleMap`
- Parses paragraph styles, character styles, table styles, list styles
- Resolves basedOn inheritance chains completely
- Resolves theme font/color references
- Extracts docDefaults
- bun build exits 0
**passes:** true

---

### US-12: Numbering/List parser
**Title:** Parse numbering.xml for lists
**Description:** Parse abstract numbering definitions and number instances.
**Acceptance Criteria:**
- src/docx/numberingParser.ts exists
- `parseNumbering(numberingXml: string | null): NumberingMap`
- Parses abstractNum with all levels
- Parses num instances
- Handles bullet characters, number formats (decimal, lowerLetter, upperLetter, lowerRoman, upperRoman)
- Handles restart numbering, start values
- bun build exits 0
**passes:** true

---

# PHASE 4: CONTENT PARSING

### US-13: Run parser with full formatting
**Title:** Parse text runs with ALL formatting properties
**Description:** Parse <w:r> with complete formatting extraction.
**Acceptance Criteria:**
- src/docx/runParser.ts exists
- `parseRun(node, styles, theme): Run`
- Extracts text from w:t
- Parses ALL rPr properties:
  - w:b (bold), w:i (italic), w:u (underline with style)
  - w:strike (strikethrough), w:dstrike (double strike)
  - w:vertAlign (superscript/subscript)
  - w:smallCaps, w:caps (capitalization)
  - w:highlight (text highlight color)
  - w:shd (character shading)
  - w:color (text color with theme resolution)
  - w:sz (font size in half-points)
  - w:rFonts (font family with theme resolution)
  - w:spacing (character spacing)
  - w:effect (text effects)
- Detects images (w:drawing)
- bun build exits 0
**passes:** true

---

### US-14: Paragraph parser with full formatting
**Title:** Parse paragraphs with ALL properties
**Description:** Parse <w:p> with complete property extraction.
**Acceptance Criteria:**
- src/docx/paragraphParser.ts exists
- `parseParagraph(node, styles, theme, numbering): Paragraph`
- Parses ALL pPr properties:
  - w:jc (alignment: left, center, right, both/justify)
  - w:spacing (before, after, line, lineRule)
  - w:ind (left, right, firstLine, hanging)
  - w:pBdr (paragraph borders: top, bottom, left, right, between)
  - w:shd (paragraph shading/background)
  - w:tabs (tab stops with positions and types)
  - w:keepNext, w:keepLines, w:widowControl, w:pageBreakBefore
  - w:bidi (right-to-left)
  - w:numPr (list info)
  - w:pStyle (style reference)
- Parses child runs
- bun build exits 0
**passes:** true

---

### US-15: Tab stop parser
**Title:** Parse and handle tab stops
**Description:** Parse tab definitions and handle tab characters in content.
**Acceptance Criteria:**
- src/docx/tabParser.ts exists
- Parses w:tabs with w:tab entries
- Extracts: position, alignment (left, center, right, decimal), leader (dot, hyphen, underscore)
- Handles w:tab elements in runs (tab characters)
- bun build exits 0
**passes:** true

---

### US-16: Hyperlink parser
**Title:** Parse hyperlinks
**Description:** Parse <w:hyperlink> elements with internal and external links.
**Acceptance Criteria:**
- src/docx/hyperlinkParser.ts exists
- `parseHyperlink(node, rels): Hyperlink`
- Resolves r:id to actual URL via relationships
- Handles internal bookmarks (w:anchor)
- Extracts tooltip if present
- Contains child runs for link text
- bun build exits 0
**passes:** true

---

### US-17: Bookmark parser
**Title:** Parse bookmarks
**Description:** Parse bookmark start/end markers for internal links.
**Acceptance Criteria:**
- src/docx/bookmarkParser.ts exists
- Parses w:bookmarkStart, w:bookmarkEnd
- Extracts bookmark name and ID
- Used for internal hyperlink targets
- bun build exits 0
**passes:** true

---

### US-18: Field parser
**Title:** Parse field codes (page numbers, dates, etc.)
**Description:** Parse simple and complex fields for dynamic content.
**Acceptance Criteria:**
- src/docx/fieldParser.ts exists
- Parses w:fldSimple (simple fields)
- Parses w:fldChar + w:instrText (complex fields)
- Recognizes field types: PAGE, NUMPAGES, DATE, TIME, DOCPROPERTY, REF, TOC
- Extracts current field value for display
- bun build exits 0
**passes:** true

---

### US-19: Table parser
**Title:** Parse tables with full structure
**Description:** Parse <w:tbl> with all properties and nested content.
**Acceptance Criteria:**
- src/docx/tableParser.ts exists
- `parseTable(node, styles, theme, numbering): Table`
- Parses table properties (width, alignment, borders, cellMargins)
- Parses rows and cells
- Cell properties: borders, shading, width, vAlign, vMerge, gridSpan
- Handles merged cells (horizontal and vertical)
- Cells contain paragraphs (recursive)
- Handles nested tables
- bun build exits 0
**passes:** true

---

### US-20: Image parser
**Title:** Parse embedded images
**Description:** Parse <w:drawing> elements for inline and floating images.
**Acceptance Criteria:**
- src/docx/imageParser.ts exists
- `parseImage(node, rels, media): Image`
- Parses wp:inline and wp:anchor (floating)
- Extracts image rId, resolves to media file
- Extracts dimensions (EMU to pixels)
- Handles text wrapping mode for anchored images
- Extracts alt text if present
- bun build exits 0
**passes:** true

---

### US-21: Shape parser
**Title:** Parse shapes and drawings
**Description:** Parse <wps:wsp> shape elements.
**Acceptance Criteria:**
- src/docx/shapeParser.ts exists
- `parseShape(node): Shape`
- Parses shape type (rectangle, oval, line, etc.)
- Extracts dimensions and position
- Parses fill (solid, gradient, none)
- Parses outline (color, width)
- Parses text content inside shapes (w:txbxContent)
- bun build exits 0
**passes:** true

---

### US-22: Text box parser
**Title:** Parse text boxes
**Description:** Parse floating text box containers.
**Acceptance Criteria:**
- src/docx/textBoxParser.ts exists
- Parses w:txbxContent
- Contains paragraphs/tables like document body
- Extracts position and dimensions
- bun build exits 0
**passes:** true

---

### US-23: Footnote/Endnote parser
**Title:** Parse footnotes and endnotes
**Description:** Parse footnotes.xml and endnotes.xml, link references in document.
**Acceptance Criteria:**
- src/docx/footnoteParser.ts exists
- `parseFootnotes(xml): FootnoteMap`
- `parseEndnotes(xml): EndnoteMap`
- Parses w:footnoteReference in runs
- Each footnote/endnote contains paragraphs
- bun build exits 0
**passes:** true

---

### US-24: Header/Footer parser
**Title:** Parse headers and footers
**Description:** Parse header*.xml and footer*.xml files.
**Acceptance Criteria:**
- src/docx/headerFooterParser.ts exists
- `parseHeaderFooter(xml, styles, theme, numbering): HeaderFooter`
- Parses content (paragraphs, tables, images)
- Identifies type (default, first, even)
- bun build exits 0
**passes:** true

---

### US-25: Section properties parser
**Title:** Parse section/page layout properties
**Description:** Parse <w:sectPr> for complete page layout.
**Acceptance Criteria:**
- src/docx/sectionParser.ts exists
- `parseSectionProperties(node, rels): SectionProperties`
- Parses w:pgSz (page width, height, orientation)
- Parses w:pgMar (all margins including header/footer distance)
- Parses w:cols (column count, spacing, widths)
- Parses header/footer references by type
- Parses w:lnNumType (line numbers)
- Parses w:pgBorders (page borders)
- Parses w:background (page background)
- bun build exits 0
**passes:** true

---

### US-26: Document body parser
**Title:** Parse document.xml body
**Description:** Parse main document body with all content types.
**Acceptance Criteria:**
- src/docx/documentParser.ts exists
- `parseDocumentBody(xml, styles, theme, numbering, rels, media): DocumentBody`
- Parses mix of paragraphs, tables, and section breaks
- Handles all content types (hyperlinks, fields, images, shapes)
- Detects template variables {{...}}
- bun build exits 0
**passes:** true

---

### US-27: Main parser orchestrator
**Title:** Unified parseDocx function
**Description:** Coordinate all parsing into complete Document model.
**Acceptance Criteria:**
- src/docx/parser.ts exists
- `parseDocx(buffer): Promise<Document>`
- Shows loading progress
- Orchestrates all sub-parsers
- Loads fonts before completing
- Returns complete Document
- Error handling with descriptive messages
- bun build exits 0
**passes:** true

---

# PHASE 5: RENDERING INFRASTRUCTURE

### US-28: Unit conversion utilities
**Title:** Convert OOXML units to CSS
**Description:** Convert twips, EMUs, half-points to pixels.
**Acceptance Criteria:**
- src/utils/units.ts exists
- `twipsToPixels(twips)`, `pixelsToTwips(px)`
- `emuToPixels(emu)`, `pixelsToEmu(px)`
- `halfPointsToPixels(hp)`, `pointsToPixels(pt)`
- Standard 96 DPI assumption
- bun build exits 0
**passes:** true

---

### US-29: Color resolver
**Title:** Resolve OOXML colors to CSS
**Description:** Convert theme colors, RGB, auto colors to CSS values.
**Acceptance Criteria:**
- src/utils/colorResolver.ts exists
- `resolveColor(color, theme): string`
- Handles theme color references (accent1, dk1, etc.)
- Handles RGB hex values
- Handles "auto" (black or context-dependent)
- Handles tint/shade modifications
- bun build exits 0
**passes:** true

---

### US-30: Text measurement
**Title:** Canvas-based text measurement
**Description:** Measure text for line breaking. Wait for fonts.
**Acceptance Criteria:**
- src/utils/textMeasure.ts exists
- `measureText(text, formatting): { width, height, baseline }`
- Uses Canvas 2D context
- Waits for font to load
- Caches measurements
- bun build exits 0
**passes:** true

---

### US-31: Formatting to CSS converter
**Title:** Convert all formatting to CSS
**Description:** Transform complete formatting objects to React styles.
**Acceptance Criteria:**
- src/utils/formatToStyle.ts exists
- `textToStyle(formatting, theme): CSSProperties`
- `paragraphToStyle(formatting, theme): CSSProperties`
- Handles ALL formatting properties:
  - Font: family, size, weight, style
  - Text: color, background, decoration (underline, strike, double-strike)
  - Effects: superscript, subscript, small-caps, all-caps
  - Spacing: letter-spacing
  - Paragraph: alignment, line-height, margins, padding, borders, background
- bun build exits 0
**passes:** true

---

# PHASE 6: CONTENT RENDERING

### US-32: Run component
**Title:** Render text runs with all formatting
**Description:** <Run /> renders span with complete styling.
**Acceptance Criteria:**
- src/components/render/Run.tsx exists
- Renders span with all formatting styles
- Handles superscript/subscript with proper positioning
- Handles small-caps, all-caps text transformation
- Handles highlight backgrounds
- Template variables {{...}} styled distinctively
- bun build exits 0
**passes:** true

---

### US-33: Tab component
**Title:** Render tab characters
**Description:** Render tabs with proper spacing based on tab stops.
**Acceptance Criteria:**
- src/components/render/Tab.tsx exists
- Calculates width based on tab stop definitions
- Handles leader characters (dots, dashes)
- Aligns to tab stop positions
- bun build exits 0
**passes:** true

---

### US-34: Hyperlink component
**Title:** Render clickable hyperlinks
**Description:** <Hyperlink /> renders links with proper styling.
**Acceptance Criteria:**
- src/components/render/Hyperlink.tsx exists
- Renders as <a> tag with href
- Contains Run children for link text
- Handles internal bookmarks (scroll to target)
- Opens external links in new tab
- Shows tooltip on hover
- bun build exits 0
**passes:** true

---

### US-35: Field component
**Title:** Render field values
**Description:** <Field /> displays dynamic field content.
**Acceptance Criteria:**
- src/components/render/Field.tsx exists
- Displays current field value
- Styled to indicate it's a field (subtle background?)
- Handles page numbers (placeholder until pagination)
- bun build exits 0
**passes:** true

---

### US-36: Image component
**Title:** Render embedded images
**Description:** <DocImage /> renders images with sizing.
**Acceptance Criteria:**
- src/components/render/DocImage.tsx exists
- Renders img with src from base64/blob
- Applies width/height
- Handles alt text
- Handles floating images with wrapping
- bun build exits 0
**passes:** true

---

### US-37: Shape component
**Title:** Render shapes
**Description:** <Shape /> renders basic shapes using SVG or CSS.
**Acceptance Criteria:**
- src/components/render/Shape.tsx exists
- Renders rectangles, ovals, lines using SVG
- Applies fill and stroke
- Renders text inside shapes
- Handles positioning (inline or floating)
- bun build exits 0
**passes:** true

---

### US-38: Text box component
**Title:** Render text boxes
**Description:** <TextBox /> renders floating text containers.
**Acceptance Criteria:**
- src/components/render/TextBox.tsx exists
- Positions absolutely based on anchor
- Contains paragraphs/tables
- Applies borders and background
- bun build exits 0
**passes:** true

---

### US-39: Paragraph component
**Title:** Render paragraphs with all styling
**Description:** <Paragraph /> renders complete paragraph.
**Acceptance Criteria:**
- src/components/render/Paragraph.tsx exists
- Applies all paragraph styling (alignment, spacing, indent, borders, shading)
- Contains runs, tabs, hyperlinks, fields, images
- Handles empty paragraphs (line break)
- Handles right-to-left text
- bun build exits 0
**passes:** true

---

### US-40: List item component
**Title:** Render list items with markers
**Description:** <ListItem /> renders paragraph with list marker.
**Acceptance Criteria:**
- src/components/render/ListItem.tsx exists
- Renders bullet or number marker
- Handles all bullet characters
- Handles all number formats (1, a, A, i, I)
- Proper indentation per level
- Handles multi-level lists
- bun build exits 0
**passes:** true

---

### US-41: Table component
**Title:** Render tables with full styling
**Description:** <DocTable /> renders complete table.
**Acceptance Criteria:**
- src/components/render/DocTable.tsx exists
- Renders HTML table structure
- Applies table-level styling
- Renders rows and cells
- Cell borders (individual sides)
- Cell shading/background
- Cell vertical alignment
- Merged cells (colspan, rowspan)
- Nested tables
- bun build exits 0
**passes:** true

---

### US-42: Footnote reference component
**Title:** Render footnote markers
**Description:** Render superscript footnote/endnote references.
**Acceptance Criteria:**
- src/components/render/FootnoteRef.tsx exists
- Renders superscript number
- Clickable to jump to footnote
- Tooltip with footnote preview
- bun build exits 0
**passes:** true

---

### US-43: Header/Footer component
**Title:** Render headers and footers
**Description:** <HeaderFooter /> renders header/footer content.
**Acceptance Criteria:**
- src/components/render/HeaderFooter.tsx exists
- Renders paragraphs, tables, images
- Handles page number fields
- Positioned in header/footer area
- bun build exits 0
**passes:** true

---

# PHASE 7: PAGE LAYOUT

### US-44: Line breaker
**Title:** Break paragraphs into lines
**Description:** Wrap text into lines based on page width.
**Acceptance Criteria:**
- src/layout/lineBreaker.ts exists
- `breakIntoLines(paragraph, maxWidth): Line[]`
- Respects word boundaries
- Handles multiple runs with different sizes
- Handles tabs and their alignment
- Handles non-breaking spaces
- bun build exits 0
**passes:** true

---

### US-45: Page layout engine
**Title:** Distribute content across pages
**Description:** Calculate page breaks and content positioning.
**Acceptance Criteria:**
- src/layout/pageLayout.ts exists
- `calculatePages(doc): Page[]`
- Respects page size and margins
- Handles explicit page breaks
- Handles natural page breaks
- Places headers/footers per page
- Handles different first page header/footer
- Handles odd/even page headers/footers
- Updates PAGE and NUMPAGES fields
- Handles keep-with-next, keep-lines-together
- bun build exits 0
**passes:** true

---

### US-46: Column layout
**Title:** Handle multi-column sections
**Description:** Layout content in multiple columns.
**Acceptance Criteria:**
- src/layout/columnLayout.ts exists
- Distributes content across columns
- Handles column breaks
- Handles column widths and spacing
- bun build exits 0
**passes:** true

---

### US-47: Page component
**Title:** Render a single page
**Description:** <Page /> renders page with all areas.
**Acceptance Criteria:**
- src/components/render/Page.tsx exists
- Renders at correct dimensions
- Content area respects margins
- Header at top, footer at bottom
- Page background if specified
- Page borders if specified
- White background with shadow (page appearance)
- bun build exits 0
**passes:** true

---

### US-48: Footnote area component
**Title:** Render footnotes at page bottom
**Description:** Render footnotes above footer.
**Acceptance Criteria:**
- src/components/render/FootnoteArea.tsx exists
- Renders all footnotes for current page
- Separator line above footnotes
- Footnotes are smaller text
- bun build exits 0
**passes:** true

---

### US-49: Document viewer
**Title:** Full paginated document viewer
**Description:** <DocumentViewer /> renders all pages.
**Acceptance Criteria:**
- src/components/DocumentViewer.tsx exists
- Renders all pages vertically
- Gap between pages
- Scrollable container
- Shows loading state while parsing
- Shows placeholder when no document
- bun build exits 0
**passes:** true

---

# PHASE 8: SERIALIZATION

### US-50: Run serializer
**Title:** Serialize runs to OOXML
**Description:** Convert Run objects back to <w:r> XML.
**Acceptance Criteria:**
- src/docx/serializer/runSerializer.ts exists
- `serializeRun(run): string`
- Serializes ALL formatting properties
- Handles images, tabs
- bun build exits 0
**passes:** true

---

### US-51: Paragraph serializer
**Title:** Serialize paragraphs to OOXML
**Description:** Convert Paragraph objects to <w:p> XML.
**Acceptance Criteria:**
- src/docx/serializer/paragraphSerializer.ts exists
- `serializeParagraph(para): string`
- Serializes ALL paragraph properties
- Serializes child content (runs, hyperlinks, fields)
- bun build exits 0
**passes:** true

---

### US-52: Table serializer
**Title:** Serialize tables to OOXML
**Description:** Convert Table objects to <w:tbl> XML.
**Acceptance Criteria:**
- src/docx/serializer/tableSerializer.ts exists
- `serializeTable(table): string`
- Serializes table, row, cell properties
- Handles merged cells
- Serializes cell content
- bun build exits 0
**passes:** true

---

### US-53: Document serializer
**Title:** Serialize complete document.xml
**Description:** Combine all content into valid document.xml.
**Acceptance Criteria:**
- src/docx/serializer/documentSerializer.ts exists
- `serializeDocument(doc): string`
- Complete document.xml with namespaces
- All content in order
- Section properties
- bun build exits 0
**passes:** true

---

### US-54: DOCX repacker
**Title:** Repack into valid DOCX
**Description:** Update document.xml in original ZIP.
**Acceptance Criteria:**
- src/docx/rezip.ts exists
- `repackDocx(doc): Promise<ArrayBuffer>`
- Updates document.xml
- Preserves all other files
- Updates relationships if needed
- Result opens in Word
- bun build exits 0
**passes:** true

---

# PHASE 9: EDITING INFRASTRUCTURE

### US-55: Selection manager
**Title:** Track and manage text selection
**Description:** Hook to track DOM selection and convert to document positions.
**Acceptance Criteria:**
- src/hooks/useSelection.ts exists
- Returns: selectedText, selectedRange, hasSelection
- Converts DOM selection to document Range (paragraph + offset)
- `setSelection(range)` to programmatically select
- Works with contentEditable
- bun build exits 0
**passes:** true

---

### US-56: Editable run component
**Title:** Make runs editable
**Description:** Editable span that tracks text changes.
**Acceptance Criteria:**
- src/components/edit/EditableRun.tsx exists
- contentEditable span
- Syncs text changes to document model
- Preserves formatting during edits
- bun build exits 0
**passes:** false

---

### US-57: Editable paragraph component
**Title:** Make paragraphs editable
**Description:** Editable paragraph handling splits and merges.
**Acceptance Criteria:**
- src/components/edit/EditableParagraph.tsx exists
- Contains editable runs
- Enter key splits paragraph
- Backspace at start merges with previous
- Delete at end merges with next
- Tracks cursor position
- bun build exits 0
**passes:** false

---

### US-58: Editor component
**Title:** Full editor with state management
**Description:** <Editor /> manages document state and edits.
**Acceptance Criteria:**
- src/components/Editor.tsx exists
- Renders editable pages/paragraphs
- Manages document state (immutable updates)
- onChange callback on any edit
- Handles keyboard navigation between paragraphs
- bun build exits 0
**passes:** false

---

### US-59: Undo/Redo system
**Title:** Implement undo/redo
**Description:** History stack for document changes.
**Acceptance Criteria:**
- src/hooks/useHistory.ts exists
- Maintains undo/redo stacks
- `undo()`, `redo()`, `canUndo`, `canRedo`
- Ctrl+Z for undo, Ctrl+Y / Ctrl+Shift+Z for redo
- Groups rapid changes
- bun build exits 0
**passes:** false

---

### US-60: Copy/Paste with formatting
**Title:** Handle copy/paste preserving formatting
**Description:** Copy and paste text with formatting intact.
**Acceptance Criteria:**
- src/utils/clipboard.ts exists
- Copy: puts formatted HTML and plain text on clipboard
- Paste: reads HTML clipboard, converts to runs with formatting
- Handles paste from Word (cleans up Word HTML)
- Ctrl+C, Ctrl+V, Ctrl+X
- bun build exits 0
**passes:** false

---

# PHASE 10: EDITOR UI

### US-61: Formatting toolbar
**Title:** Toolbar with formatting buttons
**Description:** <Toolbar /> with all formatting controls.
**Acceptance Criteria:**
- src/components/Toolbar.tsx exists
- Bold (Ctrl+B), Italic (Ctrl+I), Underline (Ctrl+U), Strikethrough buttons
- Superscript, Subscript buttons
- Shows active state for current selection formatting
- Applies formatting to selection
- bun build exits 0
**passes:** false

---

### US-62: Font picker
**Title:** Font family dropdown
**Description:** Dropdown to select font family.
**Acceptance Criteria:**
- src/components/ui/FontPicker.tsx exists
- Dropdown with available fonts
- Shows fonts in their own typeface
- Applies to selection
- Shows current font of selection
- bun build exits 0
**passes:** false

---

### US-63: Font size picker
**Title:** Font size selector
**Description:** Dropdown/input for font size.
**Acceptance Criteria:**
- src/components/ui/FontSizePicker.tsx exists
- Dropdown with common sizes (8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72)
- Also accepts custom input
- Shows current size of selection
- bun build exits 0
**passes:** false

---

### US-64: Color picker
**Title:** Text color picker
**Description:** Color picker for text and highlight.
**Acceptance Criteria:**
- src/components/ui/ColorPicker.tsx exists
- Grid of common colors
- Text color button (foreground)
- Highlight color button (background)
- Shows current color of selection
- bun build exits 0
**passes:** false

---

### US-65: Alignment buttons
**Title:** Paragraph alignment controls
**Description:** Buttons for left, center, right, justify.
**Acceptance Criteria:**
- src/components/ui/AlignmentButtons.tsx exists
- Left, Center, Right, Justify buttons
- Shows active state for current paragraph
- Applies to current paragraph(s)
- bun build exits 0
**passes:** false

---

### US-66: List buttons
**Title:** Bullet and number list buttons
**Description:** Toggle list formatting.
**Acceptance Criteria:**
- src/components/ui/ListButtons.tsx exists
- Bullet list button
- Numbered list button
- Toggles list on/off for selection
- Indent/outdent for list levels
- bun build exits 0
**passes:** false

---

### US-67: Style picker
**Title:** Named style dropdown
**Description:** Apply named styles (Heading 1, Normal, etc.).
**Acceptance Criteria:**
- src/components/ui/StylePicker.tsx exists
- Dropdown with available styles from document
- Shows style name in its formatting
- Shows current style of selection
- Applies style to paragraph
- bun build exits 0
**passes:** false

---

### US-68: Insert hyperlink dialog
**Title:** Dialog to insert/edit hyperlinks
**Description:** Modal for hyperlink URL and text.
**Acceptance Criteria:**
- src/components/dialogs/HyperlinkDialog.tsx exists
- Input for URL
- Input for display text
- Edit existing hyperlinks
- Remove hyperlink option
- bun build exits 0
**passes:** false

---

### US-69: Find and Replace dialog
**Title:** Find and replace functionality
**Description:** Search and replace text in document.
**Acceptance Criteria:**
- src/components/dialogs/FindReplaceDialog.tsx exists
- Find input with next/previous buttons
- Replace input with replace/replace all
- Match case option
- Highlights matches in document
- Ctrl+F to open, Ctrl+H for replace mode
- bun build exits 0
**passes:** false

---

### US-70: Zoom control
**Title:** Document zoom control
**Description:** Zoom in/out on document view.
**Acceptance Criteria:**
- src/components/ui/ZoomControl.tsx exists
- Dropdown with zoom levels (50%, 75%, 100%, 125%, 150%, 200%)
- Zoom in/out buttons
- Scales page rendering
- Persists zoom preference
- bun build exits 0
**passes:** false

---

### US-71: Table editing toolbar
**Title:** Table manipulation controls
**Description:** Controls for editing tables.
**Acceptance Criteria:**
- src/components/ui/TableToolbar.tsx exists
- Shows when cursor in table
- Add row above/below
- Add column left/right
- Delete row/column
- Merge cells, split cell
- bun build exits 0
**passes:** false

---

### US-72: Image editing
**Title:** Image manipulation controls
**Description:** Resize and edit images.
**Acceptance Criteria:**
- src/components/edit/EditableImage.tsx exists
- Resize handles on corners
- Maintains aspect ratio (unless shift held)
- Click to select, show controls
- Delete key removes image
- bun build exits 0
**passes:** false

---

### US-73: Variable insertion
**Title:** Insert template variables
**Description:** UI to insert {{variables}}.
**Acceptance Criteria:**
- Variable name input in toolbar
- Insert button adds {{name}} at cursor
- Styled distinctively
- Also in context menu
- bun build exits 0
**passes:** false

---

# PHASE 11: TEMPLATE VARIABLES

### US-74: Variable detector
**Title:** Find {{variables}} in document
**Description:** Scan document for template variables.
**Acceptance Criteria:**
- src/utils/variableDetector.ts exists
- `detectVariables(doc): string[]`
- Finds all {{...}} patterns
- Returns unique names sorted
- bun build exits 0
**passes:** false

---

### US-75: Variable panel
**Title:** Panel for variable values
**Description:** <VariablePanel /> lists variables with inputs.
**Acceptance Criteria:**
- src/components/VariablePanel.tsx exists
- Lists detected variables
- Input field for each value
- Apply button
- Shows empty state
- bun build exits 0
**passes:** false

---

### US-76: docxtemplater integration
**Title:** Process template substitution
**Description:** Use docxtemplater to substitute variables.
**Acceptance Criteria:**
- src/utils/processTemplate.ts exists
- `processTemplate(buffer, variables): ArrayBuffer`
- Uses PizZip + Docxtemplater
- Preserves all formatting
- Error handling with useful messages
- bun build exits 0
**passes:** false

---

# PHASE 12: AGENT API

### US-77: Agent types
**Title:** TypeScript interfaces for agent API
**Description:** Define Position, Range, Command types.
**Acceptance Criteria:**
- src/types/agentApi.ts with:
  - Position { paragraphIndex, offset }
  - Range { start, end }
  - AgentCommand union type
  - InsertCommand, ReplaceCommand, DeleteCommand, FormatCommand
  - InsertTableCommand, InsertImageCommand, InsertHyperlinkCommand
  - AgentContext, AgentResponse, SelectionContext
- bun build exits 0
**passes:** false

---

### US-78: Command executor
**Title:** Execute agent commands
**Description:** Apply commands to document immutably.
**Acceptance Criteria:**
- src/agent/executor.ts exists
- `executeCommand(doc, command): Document`
- Handles all command types
- Preserves surrounding formatting
- Returns new document
- bun build exits 0
**passes:** false

---

### US-79: DocumentAgent class
**Title:** High-level agent API
**Description:** Fluent API for programmatic document manipulation.
**Acceptance Criteria:**
- src/agent/DocumentAgent.ts exists
- Reading: `getText()`, `getFormattedText()`, `getVariables()`, `getStyles()`, `getPageCount()`, `getWordCount()`
- Writing: `insertText()`, `replaceRange()`, `deleteRange()`, `applyFormatting()`, `applyStyle()`
- Complex: `insertTable(pos, rows, cols)`, `insertImage(pos, data)`, `insertHyperlink(range, url)`
- Variables: `setVariable()`, `applyVariables()`
- Export: `toBuffer()`
- bun build exits 0
**passes:** false

---

### US-80: Agent context builder
**Title:** Build context for AI agents
**Description:** Generate context object for LLM consumption.
**Acceptance Criteria:**
- src/agent/context.ts exists
- `getAgentContext(doc): AgentContext`
- Includes: paragraphCount, wordCount, variableCount
- Content outline (first N chars per paragraph)
- Detected variables
- Available styles
- JSON serializable
- bun build exits 0
**passes:** false

---

# PHASE 13: CONTEXT MENU AI

### US-81: Context menu component
**Title:** Right-click menu for AI actions
**Description:** Menu with AI options on text selection.
**Acceptance Criteria:**
- src/components/ContextMenu.tsx exists
- Shows on right-click when text selected
- Positioned near cursor
- Options: Ask AI, Rewrite, Expand, Summarize, Translate, Explain
- Custom prompt option
- Keyboard Escape to close
- bun build exits 0
**passes:** false

---

### US-82: Selection context builder
**Title:** Build rich context from selection
**Description:** Context for AI with selection details.
**Acceptance Criteria:**
- src/agent/selectionContext.ts exists
- `buildSelectionContext(doc, range): SelectionContext`
- Includes: selectedText, selectedFormatting
- Surrounding context (before/after paragraphs)
- Document summary
- Suggested actions based on content
- bun build exits 0
**passes:** false

---

### US-83: Response preview
**Title:** Preview AI changes before applying
**Description:** Show diff of proposed changes.
**Acceptance Criteria:**
- src/components/ResponsePreview.tsx exists
- Shows original (strikethrough) vs new (highlighted)
- Accept button applies
- Reject button cancels
- Edit text before accepting
- Loading state while waiting
- bun build exits 0
**passes:** false

---

### US-84: Context menu integration
**Title:** Wire context menu into editor
**Description:** Full flow: select → menu → AI → preview → apply.
**Acceptance Criteria:**
- Editor handles right-click with selection
- Calls onAgentRequest prop with action + context
- Shows ResponsePreview on response
- Applies changes on accept
- Full flow works end-to-end
- bun build exits 0
**passes:** false

---

# PHASE 14: INTEGRATION & POLISH

### US-85: Loading states
**Title:** Loading indicators throughout
**Description:** Show loading states during async operations.
**Acceptance Criteria:**
- Loading spinner while parsing DOCX
- Loading indicator while fonts load
- Loading state in AI response preview
- Progress indication for large documents
- bun build exits 0
**passes:** false

---

### US-86: Error handling
**Title:** Graceful error handling
**Description:** Handle and display errors gracefully.
**Acceptance Criteria:**
- src/components/ErrorBoundary.tsx exists
- Catches render errors, shows fallback UI
- Parse errors show helpful message
- Unsupported features show warning, don't crash
- Error toast/notification system
- bun build exits 0
**passes:** false

---

### US-87: Accessibility
**Title:** Accessibility improvements
**Description:** Make editor accessible.
**Acceptance Criteria:**
- ARIA labels on all controls
- Keyboard navigation for toolbar
- Focus visible indicators
- Screen reader friendly structure
- bun build exits 0
**passes:** false

---

### US-88: Main DocxEditor component
**Title:** Main component integrating everything
**Description:** <DocxEditor /> is the complete editor.
**Acceptance Criteria:**
- src/components/DocxEditor.tsx exists
- Props: documentBuffer, onSave, onAgentRequest, onChange
- Renders: Toolbar, Editor, VariablePanel
- Context menu integration
- Zoom control
- Error boundary
- Loading states
- Exposes DocumentAgent via ref
- bun build exits 0
**passes:** false

---

### US-89: Events and callbacks
**Title:** Editor events API
**Description:** Callback props for all editor events.
**Acceptance Criteria:**
- onSelectionChange(selection)
- onContentChange(doc)
- onSave(buffer)
- onError(error)
- onFontsLoaded()
- bun build exits 0
**passes:** false

---

### US-90: Public API exports
**Title:** Clean public API
**Description:** Export all public APIs from index.ts.
**Acceptance Criteria:**
- src/index.ts exports:
  - DocxEditor (default and named)
  - DocumentAgent
  - parseDocx, serializeDocx, processTemplate
  - loadFont, loadFonts
  - All public types
- Clean, documented exports
- bun build exits 0
**passes:** false

---

### US-91: Demo page
**Title:** Demo showing all features
**Description:** Complete demo page.
**Acceptance Criteria:**
- demo/index.html exists
- Loads sample DOCX
- Full editing works
- All toolbar features work
- Context menu AI works (mock handler)
- Save/download works
- Shows how to integrate
- bun build exits 0
**passes:** false

---

# Summary

**91 User Stories across 14 Phases**

| Phase | Stories | Focus |
|-------|---------|-------|
| 1 | 3 | Foundation & exploration |
| 2 | 3 | Font infrastructure |
| 3 | 5 | Parsing infrastructure |
| 4 | 15 | Content parsing (runs, paragraphs, tables, images, hyperlinks, fields, footnotes, shapes) |
| 5 | 4 | Rendering infrastructure |
| 6 | 12 | Content rendering components |
| 7 | 6 | Page layout engine |
| 8 | 5 | Serialization |
| 9 | 6 | Editing infrastructure |
| 10 | 13 | Editor UI (toolbar, pickers, dialogs) |
| 11 | 3 | Template variables |
| 12 | 4 | Agent API |
| 13 | 4 | Context menu AI |
| 14 | 7 | Integration & polish |

**Complete WYSIWYG Features:**
- ✅ Full character formatting (bold, italic, underline, strike, super/subscript, caps, highlight, color, fonts)
- ✅ Full paragraph formatting (alignment, spacing, indent, borders, shading, tabs)
- ✅ Tables with borders, shading, merged cells
- ✅ Images with sizing
- ✅ Shapes and text boxes
- ✅ Hyperlinks and bookmarks
- ✅ Fields (page numbers, dates)
- ✅ Footnotes/endnotes
- ✅ Lists (bullets, numbers, multi-level)
- ✅ Headers/footers
- ✅ Page layout with margins
- ✅ Multi-column layout
- ✅ Google Fonts dynamic loading

**Editor Features:**
- ✅ Full formatting toolbar
- ✅ Font/size/color pickers
- ✅ Style picker
- ✅ Find/replace
- ✅ Zoom control
- ✅ Table editing
- ✅ Image editing
- ✅ Copy/paste with formatting
- ✅ Undo/redo
- ✅ Keyboard shortcuts

**Agent/AI Features:**
- ✅ DocumentAgent API
- ✅ Right-click context menu
- ✅ AI action preview
- ✅ Template variables
