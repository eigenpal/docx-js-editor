/**
 * Word feature support matrix — single source of truth.
 *
 * Rendered on docx-editor.dev at /docs/2.x/word-fidelity via the site's
 * <FeatureMatrix> / <FeatureBadge> components (the site syncs this file at
 * build time, same pipeline as docs/site/content). The `tier` field exists
 * so the same data can later drive plan gating and pricing pages; today
 * everything ships in `community`.
 *
 * Status axes:
 * - editing:   can the user (or code driving the editor) change it in the editor?
 * - rendering: does it display like Microsoft Word renders it?
 * - roundTrip: does it survive open -> edit -> save -> reopen without loss?
 *
 * Honesty rule: when in doubt, downgrade. A "partial" that turns out to be
 * full delights; a "full" that turns out to be partial burns trust.
 *
 * Notes rule: notes render inside a table cell, so keep them short. Write
 * Simplified Technical English: active voice, one idea per sentence, 20 words
 * or fewer per sentence. Name the observable behavior, not the internal lane,
 * change proposal, or code path.
 */

export type FeatureStatus =
  | 'full'
  | 'partial'
  | 'render-only'
  | 'preserved' // round-trips losslessly as inert content; editing/rendering may be absent
  | 'planned'
  | 'none';

/**
 * The tiers, as values rather than a bare union, so the test beside this file can check every
 * row at runtime. An invalid tier shipped once because nothing typechecked this file; one source
 * of truth means the suite catches it even where a type gate does not reach.
 */
export const FEATURE_TIERS = ['community', 'premium'] as const;

export type FeatureTier = (typeof FEATURE_TIERS)[number];

export type FeatureCategory =
  | 'text'
  | 'paragraphs'
  | 'lists'
  | 'tables'
  | 'images'
  | 'layout'
  | 'review'
  | 'fields'
  | 'structure'
  | 'collaboration';

export interface WordFeature {
  /** Stable key, e.g. 'images.wmf'. Never rename; gating may reference it. */
  id: string;
  name: string;
  category: FeatureCategory;
  editing: FeatureStatus;
  rendering: FeatureStatus;
  roundTrip: FeatureStatus;
  tier: FeatureTier;
  notes?: string;
  /** Docs page that covers the feature, e.g. '/docs/2.x/pro/tracked-changes'. */
  docsLink?: string;
}

export const FEATURE_CATEGORY_LABELS: Record<FeatureCategory, string> = {
  text: 'Text & formatting',
  paragraphs: 'Paragraphs & styles',
  lists: 'Lists & numbering',
  tables: 'Tables',
  images: 'Images & drawings',
  layout: 'Page layout, headers & footers',
  review: 'Review: tracked changes, comments, notes',
  fields: 'Fields, links & TOC',
  structure: 'Document structure & content controls',
  collaboration: 'Collaboration, i18n & editing UX',
};

export const wordFeatures: WordFeature[] = [
  // --- Text & formatting -----------------------------------------------
  {
    id: 'text.basic-formatting',
    name: 'Bold, italic, underline, strikethrough',
    category: 'text',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
  },
  {
    id: 'text.format-painter',
    name: 'Format painter',
    category: 'text',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Copies character formatting, and paragraph formatting when the selection covers ' +
      'the paragraph mark. Paragraph borders and character styles stay on the target.',
  },
  {
    id: 'text.sub-superscript',
    name: 'Subscript & superscript',
    category: 'text',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
  },
  {
    id: 'text.fonts',
    name: 'Font family & size',
    category: 'text',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      "Register custom fonts with the fonts prop. The editor fetches your URLs and checks each hash. Theme fonts come from the OOXML theme. Word-accurate wrap and pagination need real font bytes, so the optional @docx-editor.dev/fonts package supplies substitutes for common Word fonts. Word's five document defaults match advance widths exactly. Century Gothic loads on demand and runs within 1%, so a wrap point can still move. A family with no metric-compatible substitute keeps your own measurement rather than being given an arbitrary face. packagedFonts() serves all six on demand and reaches no third party. It loads a family when a document names it, or when that family is the default face. googleFonts() adds a pinned open-licensed catalog once an app opts into the network. Both are resolvers with the same call shape, so useFonts and useDocxSource compose them as a list in precedence order. A later origin is told which faces an earlier one can already paint, so composing them never downloads the same face twice.",
  },
  {
    id: 'text.embedded-fonts',
    name: 'Embedded fonts',
    category: 'text',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'preserved',
    tier: 'community',
    notes:
      'The editor de-obfuscates the fonts in word/fonts on load and measures text with them. No configuration and no network request are necessary. The binaries round-trip on save. The editor does not add new embedded fonts.',
  },
  {
    id: 'text.color',
    name: 'Text color (RGB + theme colors)',
    category: 'text',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes: 'Theme color references (accent1...) round-trip as references, not flattened to hex.',
  },
  {
    id: 'text.highlight',
    name: 'Highlight & shading',
    category: 'text',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes: 'Word highlight palette plus arbitrary w:shd fills.',
  },
  {
    id: 'text.rtl',
    name: 'Right-to-left & bidirectional text',
    category: 'text',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes: 'Bidi layout with mirrored alignment; Hebrew locale ships in @docx-editor.dev/i18n.',
  },
  {
    id: 'text.effects',
    name: 'Text effects (outline, shadow, emboss, emphasis mark)',
    category: 'text',
    editing: 'none',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'w:outline, w:shadow, w:emboss, w:imprint, and w:em render and round-trip. You cannot set them from the toolbar. w14 glow and gradient text fill are not supported.',
  },
  {
    id: 'text.hidden',
    name: 'Hidden text (vanish)',
    category: 'text',
    editing: 'none',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'The editor does not draw w:vanish runs and gives them no space, so pages break where Word breaks them. The text survives a round trip. There is no "show hidden text" option. A paragraph with a vanished mark still occupies a line.',
  },
  {
    id: 'text.math',
    name: 'Math equations (OMML)',
    category: 'text',
    editing: 'none',
    rendering: 'partial',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Equations round-trip verbatim as raw OMML and show a styled text fallback. Laid-out math and equation editing are not built yet.',
  },
  {
    id: 'text.symbols',
    name: 'Symbol characters (w:sym)',
    category: 'text',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Symbol runs render and survive editing and save. You can insert a symbol from the Insert menu. Existing symbol run properties are not editable.',
  },

  // --- Paragraphs & styles ---------------------------------------------
  {
    id: 'paragraphs.alignment',
    name: 'Alignment & justification',
    category: 'paragraphs',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Justified East Asian lines distribute inter-character spacing. The last line stays left-aligned. Tabs and float passages retain their reserved positions.',
  },
  {
    id: 'paragraphs.east-asian-typography',
    name: 'East Asian typography',
    category: 'paragraphs',
    editing: 'preserved',
    rendering: 'partial',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Protects graphemes, punctuation, and full-width number groups across run boundaries. East Asian font hints cover supported punctuation, symbols, Greek, and Cyrillic ranges while preserving explicit symbol fonts. Reads kinsoku, wordWrap, overflowPunct, strictFirstAndLastChars, language-specific custom line-break sets, and characterSpacingControl. Korean character wrapping follows wordWrap. Compression uses deterministic punctuation and kana advance reductions; font-specific optical compression and vertical Japanese composition are not modeled. Typography settings have no dedicated UI.',
  },
  {
    id: 'paragraphs.spacing',
    name: 'Line & paragraph spacing',
    category: 'paragraphs',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Space before, space after, and line spacing (single, multiple, exactly, at least) all reach pagination. A 1.5-spaced or double-spaced document breaks pages where Word breaks them. The paragraph mark size counts in the last line metrics, like Word. Contextual spacing drops the gap between neighbours of the same style, and the Paragraph dialog sets it. Automatic spacing (w:beforeAutospacing, w:afterAutospacing) uses 14pt in body paragraphs and 0pt in list items and table cells.',
  },
  {
    id: 'paragraphs.pagination',
    name: 'Keep with next, keep lines, widow/orphan control',
    category: 'paragraphs',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'w:keepNext, w:keepLines, w:widowControl and w:pageBreakBefore all reach pagination, and the Paragraph dialog sets each of them. A value a style supplies reads through the cascade, so a checkbox shows what is in force rather than only what the paragraph authors itself.',
  },
  {
    id: 'paragraphs.indentation',
    name: 'Indentation (incl. hanging indents)',
    category: 'paragraphs',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Left, right, first-line, and hanging indents all reach line geometry, so an indented first line starts where Word starts it. Increase Indent and Decrease Indent are on the toolbar, on Tab, and on Ctrl+M. Inside a list they change the level, so the marker changes too.',
  },
  {
    id: 'paragraphs.styles',
    name: 'Paragraph styles (Heading 1, Quote, custom styles)',
    category: 'paragraphs',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'The style picker applies document styles, including custom styles with their numbering and indents. Pressing Enter at the end of a paragraph starts the next one in the style that the current style names as its follower (w:next), so a heading is followed by body text. Defining a new style in the UI is not supported yet.',
  },
  {
    id: 'paragraphs.borders',
    name: 'Paragraph borders & fills',
    category: 'paragraphs',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Paragraph shading (w:shd) is editable. Borders render the common ST_Border styles: single, double, dashed, and dotted. Thick, 3-D, inset, and outset styles use CSS approximations, and art borders paint as a solid rule. Borders round-trip, but you cannot add, change, or remove them in the editor yet.',
  },
  {
    id: 'paragraphs.tabs',
    name: 'Tab stops & leaders',
    category: 'paragraphs',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      "Existing tab stops render, with right and decimal tabs and dot, hyphen, and underscore leaders. Positional tabs (w:ptab) render too, so a contents line reads as one: entry left, leader dots between, page number right. The document's own w:defaultTabStop is honored, in the body and in headers and footers. The Paragraph dialog sets, clears, and replaces tab stops, including clearing one that a style supplies. Bar tabs are preserved on save but aren't drawn or editable.",
  },
  {
    id: 'paragraphs.frames',
    name: 'Drop caps & text frames (framePr)',
    category: 'paragraphs',
    editing: 'none',
    rendering: 'partial',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'A centered, auto-sized PAGE footer frame can overlay an empty or centered middle-dot anchor without adding a footer line. Supported single-line fixed-width PAGE frames use their page-relative horizontal position and clip overflow above an empty anchor or a second PAGE paragraph. All fields and paragraphs survive save. Frames that need text wrapping, unsupported positions, and drop caps stay in ordinary flow.',
  },
  {
    id: 'paragraphs.hyphenation',
    name: 'Automatic hyphenation',
    category: 'paragraphs',
    editing: 'none',
    rendering: 'none',
    roundTrip: 'preserved',
    tier: 'community',
    notes: 'Document hyphenation settings round-trip; the layout engine does not hyphenate.',
  },

  // --- Lists & numbering -------------------------------------------------
  {
    id: 'lists.bullets',
    name: 'Bullet lists (multi-level)',
    category: 'lists',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'The toolbar toggle creates the numbering definition on first use, so a document that never carried a list can start one. It also applies the List Paragraph style, the way Word does, which is what closes the space between consecutive items. Turning the list off leaves the paragraph in List Paragraph, and indented, as Word does; pressing Enter on an empty item leaves the list and returns to the margin. Tab and the indent buttons change the level, and the marker changes with it.',
  },
  {
    id: 'lists.numbered',
    name: 'Numbered lists (decimal, roman, letters)',
    category: 'lists',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Numbered lists take the List Paragraph style on the same terms as bulleted ones, so consecutive items close up.',
  },
  {
    id: 'lists.custom-numbering',
    name: 'Custom numbering definitions & style-linked numbering',
    category: 'lists',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes: 'Numbering attached to custom paragraph styles resolves with Word’s precedence rules.',
  },
  {
    id: 'lists.continuation',
    name: 'List continuation & restart',
    category: 'lists',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
  },
  {
    id: 'lists.picture-bullets',
    name: 'Picture bullets (numPicBullet)',
    category: 'lists',
    editing: 'none',
    rendering: 'none',
    roundTrip: 'preserved',
    tier: 'community',
    notes:
      'Not rendered and not editable. The numPicBullet definition and its markup are preserved on save.',
  },

  // --- Tables -------------------------------------------------------------
  {
    id: 'tables.editing',
    name: 'Table insertion & cell editing',
    category: 'tables',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
  },
  {
    id: 'tables.rows-columns',
    name: 'Row/column insert, delete, resize',
    category: 'tables',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Hover controls insert a row or column. Drag a divider or the outer right edge to resize. The context menu adds seven structural actions. Both adapters ship the same table chrome. Tables stay read-only in the automation object model.',
  },
  {
    id: 'tables.borders-shading',
    name: 'Cell borders & shading',
    category: 'tables',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Both adapters expose contextual toolbar controls that set borders and fill on the selected cells. Authored table and cell borders and table-style shading render and round-trip.',
  },
  {
    id: 'tables.merge',
    name: 'Merged cells (horizontal & vertical)',
    category: 'tables',
    editing: 'none',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Authored merges render and round-trip. A row inserted at a boundary inside a vertical merge extends the merge by one row and keeps one cell per column. The merge and split commands are declared but refused. Column insert, delete, and resize on a merged table report the engine reason.',
  },
  {
    id: 'tables.page-break',
    name: 'Tables split across pages',
    category: 'tables',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Rows split mid-content with correct cut borders. Vertically merged cells repaint on continuation pages, like Word.',
  },
  {
    id: 'tables.nested',
    name: 'Nested tables',
    category: 'tables',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'The innermost table owns the resize controls, the structural edits, and the cell borders and fill. Outer tables stay unchanged through save and reopen.',
  },
  {
    id: 'tables.conditional-formatting',
    name: 'Table styles & conditional formatting (header row, banding)',
    category: 'tables',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Table styles resolve through their basedOn chain, and a table that names no style resolves the document default. Borders, cell margins, shading, and conditional paragraph and run formatting come from styles.xml, so a header row comes out bold and centered. w:tblLook gates which conditional formats apply, and an explicit w:cnfStyle wins. Conditional cell margins and a table-style picker are not built yet.',
  },
  {
    id: 'tables.floating',
    name: 'Floating tables (tblpPr anchored position)',
    category: 'tables',
    editing: 'none',
    rendering: 'partial',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'An anchored table uses tblpXSpec or tblpX across the text, margin, or page box. It uses tblpY or tblpYSpec against the selected vertical anchor. Page-anchored and margin-anchored tables do not advance body flow. Simple text-anchored tables can share a terminal empty paragraph without adding a blank page when the complete group fits the same content box. Other text-anchored tables remain in flow. Text does not wrap beside them yet.',
  },
  {
    id: 'tables.text-direction',
    name: 'Vertical cell text (textDirection)',
    category: 'tables',
    editing: 'none',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'tbRl and btLr cell text renders through writing-mode and round-trips. You cannot set it from the UI.',
  },

  // --- Images & drawings ---------------------------------------------------
  {
    id: 'images.inline',
    name: 'Inline images (paste, drag-drop, resize)',
    category: 'images',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    docsLink: '/docs/2.x/guides/images',
    notes:
      'The engine lays out and paints embedded PNG, JPEG, and GIF at the authored size. JPEG validation accepts large metadata segments and accounts for EXIF-oriented intrinsic dimensions without rewriting the photo. Both adapters ship insert and overlay authoring: the Insert menu, toolbar, properties dialog, and keyboard resize through the shared engine commands. An inserted image keeps its natural size when it fits and scales down proportionally to its cell, column, or page content box when it does not.',
  },
  {
    id: 'images.anchored',
    name: 'Floating images & wrap modes (square, topAndBottom...)',
    category: 'images',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    docsLink: '/docs/2.x/guides/images',
    notes:
      'Nine wrap modes, exclusion reflow, z-order, and drag and resize in both adapters. In-front and behind-text overlays are not cropped by their anchor cell. Both share setImageWrapType and toolbarCommandState.',
  },
  {
    id: 'images.bmp-webp',
    name: 'BMP and WebP images',
    category: 'images',
    editing: 'none',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    docsLink: '/docs/2.x/guides/images',
    notes:
      'The browser decodes these and the editor paints them at the authored size, like PNG or JPEG. BMP covers what older documents carry, including top-down bitmaps and the 12-byte BITMAPCOREHEADER. WebP covers the lossy, lossless, and extended containers. Inserting a new one is not supported yet.',
  },
  {
    id: 'images.svg',
    name: 'SVG images',
    category: 'images',
    editing: 'none',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    docsLink: '/docs/2.x/guides/images',
    notes:
      'Embedded SVG paints at the authored size. The browser renders it in secure static mode, so scripts and external references inside the file stay inert. Inserting a new SVG is not supported yet.',
  },
  {
    id: 'images.wmf',
    name: 'WMF / EMF legacy vector images',
    category: 'images',
    editing: 'none',
    rendering: 'partial',
    roundTrip: 'full',
    tier: 'community',
    docsLink: '/docs/2.x/guides/images',
    notes:
      'The browser rasterizes the metafile and the editor paints it at the authored extent. A metafile that will not convert keeps its extent and shows a labelled placeholder. The original bytes round-trip untouched.',
  },
  {
    id: 'images.tiff',
    name: 'TIFF images',
    category: 'images',
    editing: 'none',
    rendering: 'partial',
    roundTrip: 'full',
    tier: 'community',
    docsLink: '/docs/2.x/guides/images',
    notes:
      'The browser decodes baseline TIFF and the editor paints it at the authored extent. A multi-page file shows its first page. A flavour that will not decode keeps its extent and shows a labelled placeholder. Inserting a new TIFF is not supported yet.',
  },
  {
    id: 'images.tracked',
    name: 'Tracked image changes',
    category: 'images',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Suggesting mode records image insertion and deletion. Review actions can accept or reject both changes. Image property edits are unavailable in suggesting mode.',
  },
  {
    id: 'images.textboxes',
    name: 'Text boxes',
    category: 'images',
    editing: 'none',
    rendering: 'partial',
    roundTrip: 'preserved',
    tier: 'community',
    docsLink: '/docs/2.x/guides/images',
    notes:
      'Anchored text boxes render their content clipped inside the authored extent. This works in the body, in headers, and in footers, including page-relative anchors. PAGE, NUMPAGES, and SECTIONPAGES fields inside a header or footer text box are evaluated per page. The content is read-only. Inline text boxes, linked chains, autofit, and rotation render as a placeholder or clip.',
  },
  {
    id: 'images.shapes',
    name: 'Drawing shapes & geometry',
    category: 'images',
    editing: 'none',
    rendering: 'partial',
    roundTrip: 'preserved',
    tier: 'community',
    docsLink: '/docs/2.x/guides/images',
    notes:
      'Solid rectangles, ellipses, bounded polygon geometry, and grouped shapes render with sRGB or theme colors. Other payloads reserve their extent with a placeholder.',
  },
  {
    id: 'images.crop',
    name: 'Picture cropping (srcRect)',
    category: 'images',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    docsLink: '/docs/2.x/guides/images',
    notes:
      'Crop renders and round-trips. The properties dialog edits the crop in percent in both adapters.',
  },
  {
    id: 'images.adjustments',
    name: 'Picture adjustments (brightness, contrast, recolor)',
    category: 'images',
    editing: 'none',
    rendering: 'partial',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Transparency, brightness, contrast, and grayscale project where supported. Authored adjustment markup is preserved on save.',
  },
  {
    id: 'images.effects',
    name: 'Picture effects (shadow, glow, reflection)',
    category: 'images',
    editing: 'none',
    rendering: 'none',
    roundTrip: 'preserved',
    tier: 'community',
    notes:
      'Not painted and not editable. Authored effect markup and effectExtent spacing are preserved.',
  },
  {
    id: 'images.charts',
    name: 'Charts (DrawingML)',
    category: 'images',
    editing: 'none',
    rendering: 'partial',
    roundTrip: 'preserved',
    tier: 'community',
    docsLink: '/docs/2.x/guides/images',
    notes:
      'The extent is reserved with a labelled placeholder. The chart payload is preserved generically, not edited.',
  },
  {
    id: 'images.smartart',
    name: 'SmartArt & diagrams',
    category: 'images',
    editing: 'none',
    rendering: 'partial',
    roundTrip: 'preserved',
    tier: 'community',
    docsLink: '/docs/2.x/guides/images',
    notes: 'Same placeholder policy as charts. The payload is preserved inertly.',
  },
  {
    id: 'images.ink',
    name: 'Ink annotations (w:ink)',
    category: 'images',
    editing: 'none',
    rendering: 'none',
    roundTrip: 'preserved',
    tier: 'community',
    notes: 'Not rendered and not editable. Ink markup is preserved generically on save.',
  },

  // --- Page layout, headers & footers --------------------------------------
  {
    id: 'layout.pagination',
    name: 'True pagination (Word-metric pages)',
    category: 'layout',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'The layout engine paginates like Word: page breaks, keep rules, and paragraphs split across pages. You can insert a hard page break, which writes `w:br w:type="page"`.',
  },
  {
    id: 'layout.sections',
    name: 'Sections (margins, size, orientation, per-section headers)',
    category: 'layout',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Page size, orientation, and margins are editable per section or for the whole document, from the Page Setup dialog or a ruler drag. Each section paginates against its own geometry, so a mixed portrait and landscape document renders as Word shows it. You can insert a next-page or a continuous section break; a continuous one keeps the new section on the sheet the previous section ended. Even and odd page break parity and per-section columns are not modelled yet.',
  },
  {
    id: 'layout.headers-footers',
    name: 'Headers and footers (edit in place)',
    category: 'layout',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Both adapters have scoped header and footer editing: enter and exit the story, create and remove it, link and unlink to the previous section, and set the title-page and even/odd options. They also insert PAGE, NUMPAGES, and SECTIONPAGES. `editHeaderFooter` takes `variant`, `evenPage`, and `firstPage` on the shared Editor contract. Per-section first, even, and default variants paint like Word. Editing inside a header or footer matches the body: lists, tables, content controls, pictures, fonts, comments, bookmarks, and page setup all act on the story you are in. Tracked changes work in a header or footer: you can suggest an edit there, and the review list shows it with the accept and reject verbs. Selection and comment highlight bands paint in the body only. Watermark authoring is not supported.',
    docsLink: '/docs/2.x/guides/headers-footers',
  },
  {
    id: 'layout.watermarks',
    name: 'Watermarks (text & image)',
    category: 'layout',
    editing: 'none',
    rendering: 'none',
    roundTrip: 'preserved',
    tier: 'community',
    notes:
      'Watermarks use VML or drawing markup in header parts. The editor does not render or edit them. It preserves the authored markup and package relationships through save.',
    docsLink: '/docs/2.x/guides/headers-footers',
  },
  {
    id: 'layout.footnotes',
    name: 'Footnotes and endnotes',
    category: 'layout',
    editing: 'partial',
    rendering: 'partial',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Both adapters have a typed note model, note layout (pageBottom, beneathText, sectEnd, docEnd), scoped note editing, insert, delete, convert, and chrome slots. A footnote stays whole with its reference: when it cannot fit below the referencing line, the line moves to the next page instead of the note splitting. Only a note taller than the page note column splits across pages. Overflow sheets retain separate page rectangles for painting and hit testing. Editing inside a note matches the body: lists, tables, content controls, pictures, fonts, comments, bookmarks, and page setup. Suggesting mode tracks an inserted reference and requires reference deletion to propose note removal. Notes in headers and footers are out of scope.',
    docsLink: '/docs/2.x/guides/footnotes-and-endnotes',
  },
  {
    id: 'layout.columns',
    name: 'Multi-column layout',
    category: 'layout',
    editing: 'none',
    rendering: 'partial',
    roundTrip: 'full',
    tier: 'community',
    notes:
      "Section w:cols count, gap, separator, and equal or unequal widths paginate into columns. An explicit column break leaves the break paragraph's empty remainder at the top of the next column. Continuous multi-column sections balance. Column editing chrome is not exposed.",
  },
  {
    id: 'layout.page-borders',
    name: 'Page borders',
    category: 'layout',
    editing: 'none',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Page borders render with z-order, offset modes, and first-page filters. You cannot edit them from the UI.',
  },
  {
    id: 'layout.line-numbers',
    name: 'Line numbers (lnNumType)',
    category: 'layout',
    editing: 'none',
    rendering: 'none',
    roundTrip: 'full',
    tier: 'community',
    notes: 'Parsed and round-tripped; not drawn in the margin.',
  },
  {
    id: 'layout.even-odd-headers',
    name: 'Different even & odd headers',
    category: 'layout',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      "The page number in the document selects the first, even, or default variant, so the alternation carries across section breaks. You can edit each variant in an open furniture scope. `editHeaderFooter({ variant: 'even' })` creates or opens the even story and enables `w:evenAndOddHeaders` in one undo unit. Header and footer chrome in both adapters can toggle different even and odd pages.",
  },
  {
    id: 'layout.vertical-align',
    name: 'Section vertical alignment (vAlign)',
    category: 'layout',
    editing: 'none',
    rendering: 'none',
    roundTrip: 'full',
    tier: 'community',
    notes: 'Round-trips; page content stays top-aligned.',
  },
  {
    id: 'layout.background',
    name: 'Page background color/image (w:background)',
    category: 'layout',
    editing: 'none',
    rendering: 'none',
    roundTrip: 'preserved',
    tier: 'community',
    notes:
      'Not rendered and not editable. Authored background markup and relationships are preserved.',
  },
  {
    id: 'layout.page-num-format',
    name: 'Page number format (pgNumType)',
    category: 'layout',
    editing: 'none',
    rendering: 'partial',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Section numbering start, format, chapter style, and chapter separator parse and serialize. PAGE fields in headers and footers honor the authored start and format, for example lowerRoman. A non-decimal format wins over a numeric picture switch, because a roman or alphabetic page number has no digits to place. NUMPAGES and SECTIONPAGES are decimal unless the field states a picture. There is no authoring UI for pgNumType yet.',
  },

  // --- Review ---------------------------------------------------------------
  {
    id: 'review.tracked-changes',
    name: 'Tracked changes (insert, delete, format)',
    category: 'review',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'A full revision model, including structural changes to paragraph breaks, paragraph properties, and table rows and cells. A change to a paragraph mark draws a pilcrow and a change bar wherever the paragraph is, table cells included, and a mark that one author inserted and another proposed removing carries both decisions. A tracked insert or delete around a field result paints as tracked, not as ordinary text. Attribution is drawn in All Markup only, as in Word. The resolved views drop the attribution and merge the paragraphs the decision merges, so No Markup shows the document as accepting every change would leave it. The Reviewers menu can hide individual authors without mutating the DOCX. The setTrackedChangesFilter API accepts a predicate over complete revision items, so a host can combine author, date, kind, range, and other revision metadata. Excluded content, moves, paragraph marks, and table-row revisions can render as temporarily accepted or rejected without changing saved OOXML. Suggesting mode records a formatting change rather than applying it outright: a run gets w:rPrChange, a paragraph mark gets w:pPr/w:rPr/w:rPrChange, and paragraph properties get w:pPrChange, so reject restores what the change replaced, and one press is one card however many runs it covers. Lists, indent level, tab stops, and table properties changed in the editor are applied without a record. A document that sets w:doNotTrackFormatting gets no formatting records. Painted markup follows Word’s by-author view by default — one color per author, matched by the review cards — and named authors can take a color, a background, class names, and an avatar of their own. The output opens cleanly in Word’s review pane.',
    docsLink: '/docs/2.x/pro/tracked-changes',
  },
  {
    id: 'review.accept-reject',
    name: 'Accept / reject changes (UI + API)',
    category: 'review',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Accept or reject one shown change in the sidebar, or through acceptReviewItem and rejectReviewItem. Reviewer visibility is view-only; hidden authors are excluded from the review item list and therefore from bulk operations over that list. The automation object model adds revision.accept(), revision.reject(), revisions.acceptAll(), and revisions.rejectAll(). The sidebar has no bulk control, so call the per-item command for every shown item.',
    docsLink: '/docs/2.x/pro/tracked-changes',
  },
  {
    id: 'review.comments',
    name: 'Comments (threads, replies, resolve)',
    category: 'review',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Threaded comments with replies and resolve/reopen in the review rail. React hosts use `@docx-editor.dev/pro/react`; Vue hosts use `@docx-editor.dev/pro/vue` with the same engine commands.',
    docsLink: '/docs/2.x/pro/comments',
  },
  {
    id: 'review.ai-redlining',
    name: 'Programmatic redlining (code-proposed tracked changes)',
    category: 'review',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'The automation object model writes Word-native tracked changes. It works over DOCX bytes on a server, or over an editor open in a page.',
    docsLink: '/docs/2.x/editor-api',
  },
  {
    id: 'review.moves',
    name: 'Tracked moves (move from/to)',
    category: 'review',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes: 'Imported moves render distinctly from insert and delete, and they round-trip.',
  },

  // --- Fields, links & TOC ---------------------------------------------------
  {
    id: 'fields.hyperlinks',
    name: 'Hyperlinks (external)',
    category: 'fields',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Insert, edit, and remove a link with Ctrl+K, Cmd+K, or the toolbar. Targets are allowlisted: http, https, mailto, tel, and ftp. Any other target renders inert and still round-trips. A HYPERLINK field, complex or w:fldSimple, is a live link too: its target passes the same allowlist, and the link panel shows it read-only. Links in footnote and endnote text work the same way. Links in headers, footers, and anchored text boxes resolve through their own part. You can edit or remove header and footer links with Ctrl+K while editing their story. Secondary-story anchors remain inert and do not open. Opening a document never requests a link target, because activation needs an explicit gesture.',
  },
  {
    id: 'fields.bookmarks',
    name: 'Bookmarks & internal links',
    category: 'fields',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Internal links jump to their bookmark and move the caret. This includes a target on a page the editor has not painted yet. Creating and renaming bookmarks is deferred.',
  },
  {
    id: 'fields.page-numbers',
    name: 'PAGE / NUMPAGES / SECTIONPAGES fields',
    category: 'fields',
    editing: 'partial',
    rendering: 'partial',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'PAGE, NUMPAGES, and SECTIONPAGES project as a complex field or w:fldSimple. They evaluate in headers and footers and in the body flow, body tables included. PAGE respects the section pgNumType start and format. Fields inside an anchored header or footer text box also project, as does a page field nested inside another field — simple or complex, such as STYLEREF — up to four levels deep, evaluated per page. React header and footer chrome can insert them, including Page X of Y. A numeric picture switch, for example PAGE \\# 0#, renders the computed value. Pictures support digit placeholders, a grouping comma, and literal text. In a header or footer the picture always renders the computed value, so a result cached in the file never reaches the page; in the body a non-empty cached result still wins until the field is updated. A body field with no cached result paints a placeholder that document layout substitutes per page. Without a picture, a multi-digit body value keeps the one-digit measured width, so mid-line following text does not reflow; with one, the picture sets that width, and a value wider than the picture overflows it the same way.',
  },
  {
    id: 'fields.toc',
    name: 'Table of contents',
    category: 'fields',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Insert a body TOC from the shared Insert menu, then refresh it from the document headings. A refresh can update the page numbers only. Tab leaders, section-formatted page numbers, and bookmark links all work. The generated rows are read-only navigation links.',
  },
  {
    id: 'fields.cross-references',
    name: 'REF and NOTEREF cross-references',
    category: 'fields',
    editing: 'partial',
    rendering: 'partial',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'REF resolves bookmark text and numbered paragraph references in the body, footnotes, and endnotes. The editor supports the \\r, \\w, \\n, \\t, \\h, and \\* MERGEFORMAT switches. The \\r switch uses the same full-context number as \\w, and \\t needs a numbering switch. Bookmark text stops at the target paragraph boundary. NOTEREF resolves bookmarked note numbers with section formats and eachSect restarts. Unsupported switches, missing targets, bullet targets, eachPage note restarts, and custom note marks keep the saved result. Save refreshes calibrated, writable body and note results as one undo step. Header, footer, and text-box results keep their saved values.',
    docsLink: '/docs/2.x/guides/fields',
  },
  {
    id: 'fields.autonum',
    name: 'AUTONUM field numbers',
    category: 'fields',
    editing: 'none',
    rendering: 'partial',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'AUTONUM, AUTONUMLGL, and AUTONUMOUT generate separate document-order sequences. They do not restart by heading context. The \\* switch supports Arabic, alphabetic, Roman, ordinal, cardinal text, ordinal text, and hexadecimal formats. The \\e switch removes the trailing period. Unsupported switches produce no generated value. Save does not add result runs.',
    docsLink: '/docs/2.x/guides/fields',
  },
  {
    id: 'fields.other-codes',
    name: 'Other field codes (DATE, SEQ, MERGEFIELD...)',
    category: 'fields',
    editing: 'none',
    rendering: 'partial',
    roundTrip: 'preserved',
    tier: 'community',
    notes:
      'The saved result displays for a complex field and for w:fldSimple. Field codes round-trip unchanged. SYMBOL renders its character with the requested font and size. MACROBUTTON and GOTOBUTTON render display text without running the macro or jump. TITLE, AUTHOR, SUBJECT, KEYWORDS, LASTSAVEDBY, COMMENTS, and matching DOCPROPERTY fields render sanitized document metadata. DATE-valued properties stay inert. DATE, TIME, FILENAME, SEQ, LISTNUM, and EQ do not calculate a new value. The editor never runs macros, DDE instructions, or external include instructions.',
    docsLink: '/docs/2.x/guides/fields',
  },
  {
    id: 'fields.citations',
    name: 'Citations & bibliography',
    category: 'fields',
    editing: 'none',
    rendering: 'none',
    roundTrip: 'preserved',
    tier: 'community',
    notes:
      'CITATION and BIBLIOGRAPHY fields stay inert, and the b:Sources store is preserved. Citation evaluation and editing are not supported.',
  },
  {
    id: 'fields.legacy-forms',
    name: 'Legacy form fields (FORMTEXT, FORMCHECKBOX, FORMDROPDOWN)',
    category: 'fields',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'preserved',
    tier: 'community',
    notes:
      'FORMTEXT supports partial text edits, whole-field replacement in unprotected documents, and a default-text dialog on double-click. In documents protected for forms, plain text results remain fillable and Tab selects the next enabled text field. FORMCHECKBOX renders its checked or default state from w:ffData, and an explicit w:size sets the glyph size. FORMDROPDOWN renders the cached result, or the selected list entry when the file caches none. Field markers, instructions, and w:ffData round-trip, and tracked edits survive. Form-field shading applies unless w:doNotShadeFormData is set. Checkbox and dropdown interaction and ffData formatting constraints are not built. Results with nested fields, revisions, or non-text structure cannot use the default-text dialog or protected filling.',
  },

  // --- Document structure & content controls ---------------------------------
  {
    id: 'structure.content-controls',
    name: 'Content controls (SDT): block, inline',
    category: 'structure',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Block, inline, row, and cell controls are typed and addressable in every story, table cells, headers, footers, and note bodies included. A control around a row or cell lays out as that row or cell, and keeps its column, span, and row semantics. Find, create, fill, and remove a control by tag, title, or file id from the document object model. The open editor authors a control too, over the selection or at the caret, as one undoable step: a caret insertion arrives empty and showing its prompt, the way it does in Word. Content is editable, and tag, title, and lock are writable through the API, but they have no toolbar chrome. All four `w:lock` modes are enforced against what an edit would change, and an enclosing lock wins over an inner one. The editor resolves a write against every control it would land in, so filling an outer control cannot write into a locked or bound control nested at its edge. A lock protects the control and its content, not the rest of the document. Under `w:documentProtection w:edit="forms"` only control content is editable. Picture, repeating-section, custom-XML-bound, and docPart gallery controls are preserved as authored rather than typed; the editor refuses an edit inside a bound control, but it allows you to remove the control.',
    docsLink: '/docs/2.x/guides/content-controls',
  },
  {
    id: 'structure.repeating-sections',
    name: 'Repeating section controls',
    category: 'structure',
    editing: 'none',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Repeating-section markup is preserved and rendered. Item add and remove operations and section configuration edits are unsupported.',
    docsLink: '/docs/2.x/guides/content-controls',
  },
  {
    id: 'structure.typed-controls',
    name: 'Dropdown, checkbox & date controls',
    category: 'structure',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Each control accepts only the value its own type allows. A dropdown must name an item it declares, and a combo box also takes free text. A date validates an ISO instant and writes both `w:fullDate` and the formatted text. A checkbox writes its declared glyph and its state together. The first write replaces a literal prompt whole, so clearing the value later leaves the control empty. A `w:temporary` control removes its own wrapper on the first edit and keeps the content.',
    docsLink: '/docs/2.x/guides/content-controls',
  },
  {
    id: 'structure.custom-xml',
    name: 'Custom XML parts & data binding',
    category: 'structure',
    editing: 'none',
    rendering: 'none',
    roundTrip: 'preserved',
    tier: 'community',
    notes:
      'customXml parts and w:dataBinding round-trip with structural fidelity. The editor does not evaluate a binding.',
  },
  {
    id: 'structure.macros',
    name: 'VBA macros',
    category: 'structure',
    editing: 'none',
    rendering: 'none',
    roundTrip: 'preserved',
    tier: 'community',
    notes:
      'The editor never executes a macro, by design. The vbaProject part survives open and save.',
  },
  {
    id: 'structure.ole',
    name: 'OLE & embedded objects',
    category: 'structure',
    editing: 'none',
    rendering: 'none',
    roundTrip: 'preserved',
    tier: 'community',
    notes:
      'The editor never executes or renders OLE. OLE markup and embedded binaries are preserved through editing and save.',
  },
  {
    id: 'structure.protection',
    name: 'Document protection & editing restrictions',
    category: 'structure',
    editing: 'partial',
    rendering: 'none',
    roundTrip: 'preserved',
    tier: 'community',
    notes:
      'Protection settings round-trip. Forms protection is enforced: only addressed control content stays editable, and the rest of the document is read-only. Other protection modes are not enforced, and inline permission ranges may be dropped.',
  },

  // --- Collaboration, i18n & editing UX ---------------------------------------
  {
    id: 'collab.realtime',
    name: 'Real-time collaboration',
    category: 'collaboration',
    editing: 'partial',
    rendering: 'partial',
    roundTrip: 'preserved',
    tier: 'premium',
    docsLink: '/docs/2.x/pro/collaboration',
    notes:
      'Yjs replicates text, formatting, document structure, review content, tables of contents, notes, headers, footers, drawings, and custom nodes. Presence includes participants, carets, and cross-paragraph selections. Each participant can undo only their edits. One simultaneous run-formatting split converges without duplicate text. A later split after one concurrent run-formatting round can duplicate text. Replicas still converge. Use WebRTC, Hocuspocus, or another Yjs 13 provider. Optional offline editing merges buffered changes after reconnection. Applying an edited ProseMirror document is unavailable while a replica is attached.',
  },
  {
    id: 'collab.find-replace',
    name: 'Find & replace',
    category: 'collaboration',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Searches headers, footers, footnotes, endnotes, body, header, and footer text boxes, table cells, and saved field results. Only anchored text boxes are searched, because an inline one paints no story. Note-owned text boxes are excluded until their drawings are selectable. A text-box match selects the text box instead of placing the caret inside it.',
  },
  {
    id: 'collab.clipboard',
    name: 'Rich copy/paste (HTML clipboard)',
    category: 'collaboration',
    editing: 'partial',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'Copy writes plain text and HTML with an embedded document fragment. Pasting that fragment restores styles, lists, tables, links, images, footnotes, and endnotes. External HTML does not restore notes. Sections, headers, footers, and comments do not travel on the clipboard. Suggesting mode and non-body scopes use plain-text paste.',
  },
  {
    id: 'collab.undo-redo',
    name: 'Undo / redo',
    category: 'collaboration',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
  },
  {
    id: 'collab.i18n',
    name: 'Editor UI in 10 languages',
    category: 'collaboration',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes: 'de, en, fr, he, hi, id, pl, pt-BR, tr, and zh-CN via @docx-editor.dev/i18n.',
    docsLink: '/docs/2.x/i18n',
  },
  {
    id: 'collab.zoom-fit',
    name: 'Automatic fit / responsive zoom',
    category: 'collaboration',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      "The default zoom mode is `auto`: it fits the page width between 50% and 100%. A container narrower than a Letter sheet shrinks the document instead of overflowing. Chrome that pads the scroll container, such as the navigation pane or the review rail, recomputes the fit. A host can pin a fixed scale with `zoom` or `zoomMode={{ type: 'fixed' }}`, or ask for uncapped fit-width. The toolbar ladder and the Ctrl+= and Cmd+= shortcuts use the same engine-owned mode.",
  },
  {
    id: 'collab.agent-tools',
    name: 'Document automation object model',
    category: 'collaboration',
    editing: 'full',
    rendering: 'full',
    roundTrip: 'full',
    tier: 'community',
    notes:
      'A batching object model shaped after a documented subset of the Word JavaScript API. The server entry works over bytes and reports exceeded resource limits with typed errors. The browser entry works over an open editor. It ships no model integration, tool catalog, or MCP transport.',
    docsLink: '/docs/2.x/editor-api',
  },
];

/** Lookup by stable id; used by <FeatureBadge id="..."/>. */
export const wordFeatureById: Record<string, WordFeature> = Object.fromEntries(
  wordFeatures.map((f) => [f.id, f])
);
