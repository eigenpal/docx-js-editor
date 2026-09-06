# @docx-editor.dev/core

## 2.16.0

### Minor Changes

- 0a3b35d: Fix East Asian wrapping across formatting changes, preserve full-width number groups, and apply CJK justification and document typography settings.
- 6fac0e1: Keep symbol faces, such as the MS Gothic face a Word checkbox names, out of the font substitution notice, and report them to the font resolver so an app can supply them. Fixes #729, fixes #730
- 1de0f64: Write a suggested replacement as Word does: the deletion first, then the insertion, each under its own revision id, wherever in the paragraph the replaced text sits. Add `replacementLanding` to the editor surface and the automation port, so a scripted replacement writes and reports the same position typing does. Fixes #691.

### Patch Changes

- 96d7e74: CJK text now wraps at the column width with UAX #14 ideographic break opportunities and basic kinsoku, instead of breaking only at run boundaries or spaces. Fixes #526
- 7a18c15: Render flipped DrawingML paths and open connectors with triangular line ends.
- 863680d: Honor explicit East Asian font hints for Latin-1 symbols, including middle dots, degree signs, multiplication and division signs. Keep ASCII text, model offsets and canonical run formatting unchanged.
- 62a6911: Keep floating image overlays visible beyond their anchor cells while preserving page clipping.
- a4a9bbc: Search body, header, and footer text-box stories during Find navigation. Fixes #711
- 76a4c5d: Keep overflowing whitespace-only runs at the end of their current line instead of indenting the next line, preserving their canonical text and caret ranges.
- b7c82fa: Render JPEG photos with large metadata segments and validate their EXIF-oriented dimensions without changing the original media.
- 03b88ea: Position supported legacy PAGE footer frames without adding an extra footer line. Clip fixed-width frames above empty or PAGE anchors while preserving fields, selections, and document structure.
- 485bfd4: Render the DrawingML bilevel picture color mode.
- 85bfd9c: Keep joined emoji and combining marks intact under East Asian font hints, avoid premature word wrapping at trailing spaces, and preserve terminal floating tables beside empty anchors with bookmarks or paragraph spacing.
- 3641f1e: Improve fidelity for justified lines, East Asian font hints, explicit symbol fonts, drawing and textbox updates, EXIF-oriented JPEG photos, and clicks beside legacy centered PAGE footer frames.
- 46c0de2: Render opaque solid Word 2010 text outlines with explicit RGB colors.
- eb0e520: Enabling suggesting mode without a configured author now returns a clear configuration error and raises it once through the `error` event, instead of entering the mode and silently ignoring keystrokes. Setting the author later enters the requested mode, and the toolbar's mode menu keeps the other modes available. Fixes #692
- 6f7da01: Avoid an extra blank page after simple text-anchored tables with a terminal empty paragraph that fits the same page.
- @docx-editor.dev/i18n@2.16.0

## 2.15.1

### Patch changes

- @docx-editor.dev/i18n@2.15.1

## 2.15.0

### Minor changes

- 5284df5: Add `@docx-editor.dev/core/export` for document layout without a DOM. Export sessions
  share the browser editor's layout engine and return immutable pages, comments, tracked changes,
  and font-resolution reports.
- 0d81033: Add font resources, shaped text, embedded fonts, metadata, internal link targets, and
  comment and tracked-change positions to export sessions.
- 8e6133f: Apply author, mode, translation, and locale changes without rebuilding the editor, including Vue root and packaged components. Fixes #695 and #561.

### Patch changes

- e9baf4d: Search headers, footers, footnotes, endnotes, table cells, and saved field results. Fixes #703 and #694.
- 087bb78: Fix floating table positions, vertical cell text, stacked fractions, and inline pictures
  in later columns. Preserve equation size and pagination with automatic line spacing. Fixes #662.
- a3819aa: Wrap long words across tracked insertions in suggesting mode without splitting Unicode graphemes. Fixes #716.
- a53f75c: Render hyperlinks in headers, footers, and anchored text boxes. While editing a header or footer, use Control+K to edit or remove its links. Links in these regions do not navigate. Fixes #643.
- 36c1f04: Update list markers in text boxes inside tables and reduce repeated paragraph layout work. Fixes #639.
- 678fe91: Group tracked field controls into one review card for each insertion or deletion. Fixes #718.
- cfe3fe1: Allow on-demand font resolvers to return empty results without a configuration error.
- 0e1360d: Keep underlined trailing spaces and underscore tab leaders as single rules that reach the line margin.
- 2a8e57e: Show tracked field controls with their adjacent replacement instead of separate **Deleted** cards.
- @docx-editor.dev/i18n@2.15.0

## 2.14.1

### Patch Changes

- @docx-editor.dev/i18n@2.14.1

## 2.14.0

### Minor Changes

- 7633b2c: Add Review > Markup Options > Reviewers to filter tracked changes and comments by author without changing saved document data. Keep an optional composable toolbar shortcut with a host-provided icon. Fixes #666.
- 01022a4: CJK text now measures and paints in the `eastAsia` font the document names (`w:rFonts w:eastAsia` / `w:eastAsiaTheme`, including through `w:docDefaults` and the theme's `a:ea` typefaces) instead of the run's Latin face. `ResolvedRunStyle` gains `fontFamilyEastAsia`, and `StyleSpanRecord` gains `fontSlot`; the format painter copies the East Asian face into `w:eastAsia`, and the font catalog lists the theme's East Asian faces.
- 6b5bb8d: Add `setTrackedChangesFilter` with a predicate over complete revision items. Filtered revisions render as accepted without changing saved OOXML. Fixes #668.
- f731c52: Add an `accept` or `reject` content projection mode to `setTrackedChangesFilter`. Both modes
  remain view-only and preserve tracked changes in saved DOCX files.

### Patch Changes

- 1afc5f2: Treat contextual table controls as the first collapsible preset-toolbar group, so entering a table moves those controls into More before ordinary formatting controls instead of overlapping them. Keep table color pickers contained within the More panel so later controls remain clipped and scrollable while a picker is open. Fixes #669.
- @docx-editor.dev/i18n@2.14.0

## 2.13.0

### Minor Changes

- 3c66a7c: The font-substitution notice now reports only families that rendered text resolves to through the style cascade, so declarations in unused styles no longer trigger it. Adds `renderedFontFamilies()` to the tree session.
- 2ea6a9d: Saving now refreshes stale REF field results inside footnotes and endnotes as one undoable transaction with the body, so the exported note parts carry the values the pages paint; a field inside a locked or data-bound content control keeps its cached result without blocking the others, and collaborative sessions keep exporting cached results. Fixes #611
- 0860dd2: Let a font substitution carry the requested family's line box through `FontSourceSubstitution.lineMetrics`, so a substitute with different vertical metrics still paginates like the face the document names.
- b1fa0d6: REF cross-reference fields now compute their results live from the bookmark target and the resolved numbering, so references such as "Section 1.2" track renumbering edits instead of painting the saved result forever. Fixes #601.
- f1d3940: Saving now rewrites stale REF field results into the exported bytes, and REF fields inside footnotes and endnotes paint live values. Fixes #606.
- 96cdbe2: Preserve Word page breaks, paragraph flow, list formats, tables, inline controls, links, and mislabeled preview images during rich copy and paste.

### Patch Changes

- b360c3c: Paragraph spacing-after no longer counts toward the page-fit decision: a line that fits stays on its page and trailing space clips at the boundary, so an oversized `w:after` (the signature-block idiom) no longer mints blank trailing pages. Fixes #615.
- 845e38f: `AUTONUM`, `AUTONUMLGL`, and `AUTONUMOUT` fields now paint a synthesized sequential number (one counter per kind, in document order, with `\*` format switches and `\e`) instead of nothing, and `REF` number switches resolve against bookmarked auto-numbered paragraphs. Fixes #618.
- fe26cd4: Numbered lists inside text boxes in table cells and headers stay correct after a numbering edit. Headers no longer keep stale list markers or images. Fixes #622
- 16966b2: Keep a footnote whole with its reference: a note that cannot fit below its reference line moves to the next page with the line instead of splitting mid-sentence or trailing its reference as an unmarked continuation. Fixes #627
- 2d7dc10: Price the `w:keepNext` group-height lookahead at the placed column's width, so a keep group in a section with unequal explicit column widths breaks on the correct block. Fixes #623
- 346f7e6: Layout no longer eagerly measures per-character caret edges for every laid span; caret and hit-test positions are measured on demand through the same measurer, and the selection-rect APIs accept an optional measurer for exact intra-span edges. Repagination after a page-boundary edit costs about a third of before. Fixes #632
- 5cf6f08: Re-break a renumbered list paragraph when its wider ordinal overflows the hanging indent, so the first line moves to the next tab stop instead of keeping its pre-renumber position under the marker.
- 7ea84c3: Hyperlinks inside footnotes and endnotes now resolve their relationship ids against the notes part's own relationships instead of the body part's. Fixes #637
- e268614: Typing in a paragraph that carries a footnote reference no longer re-lays every note story in the document, and unchanged footnote pages keep their identity across passes so the painter keeps their DOM. Fixes #631
- 8107826: Body `PAGEREF` fields now compute the page number of their bookmark target at pagination time and refresh on save, so table-of-contents page numbers stay correct after edits and in exported files. Each field is calibrated against its authored cache; unsupported switches or a missing bookmark keep the cached result. Fixes #617.
- 0a6e44c: Resolve the REF `\t` switch and NOTEREF fields live from the document's numbering, so those references track edits instead of painting stale cached results. Fixes #612.
- 72ff41f: Footnotes taller than the remaining page now start on their reference page, share it correctly with other references, and release their space when drained, so footnote-heavy documents paginate at the correct density. A `w:cantSplit` table row taller than the band a footnote reserve leaves now takes the full page instead of failing the layout. Fixes #608.
- 8506a62: Numbered paragraphs now inherit the list id through the style chain when a style sets only the level, so multilevel heading numbering in legal templates renders. Fixes #600.
- 0d782e3: Invalidate a table's cached break correctly when drawing layout moves between its cell paragraphs: the drawing-token aggregate now preserves paragraph position instead of sorting, so two different token assignments can no longer alias. Fixes #626
- 7e85377: Declare the Node floor the text shaper needs (`^20.16.0 || >=22.3.0`) so an installer reports it before a run fails. Fixes #595.
- @docx-editor.dev/i18n@2.13.0

## 2.12.0

### Minor Changes

- 531759c: Paint theme-coloured DrawingML shapes and grouped vector graphics.

### Patch Changes

- 40699c8: Keep note overflow sheets in separate page rectangles after insertion. Fixes #513.
- 31780e5: Every authorable op kind and every accepted property, image-wrap, and content-control variant is now proven to replicate through collaboration by a journal replay-convergence fixture, or declared not-expressible with a reason. Adding an editing capability without one fails the coverage gate.
- 4c2c119: A collaborative edit that moves an existing node while changing its content — a hyperlink inserted across a tracked-change run — now replicates the change instead of duplicating the old text on every receiving peer. Fixes #557.
- 3755b98: Combine style toggle properties per level of the style hierarchy, shape small capitals with matching advances, and draw one frame around consecutive identically bordered paragraphs in a table cell. Fixes #505.
- 8fe5920: A relationship, content type, or extra part written through a transaction's `applyPackage` now survives into the package, the save, and one shared undo unit with the story edit, instead of replicating to peers while vanishing from the author's own document. Fixes #558.
- fe3b8a3: Pasting rich content into non-empty documents no longer degrades to plain text or inserts Word's macOS preview image. Word headings, captions, and image dimensions now retain their source semantics and physical size.
- @docx-editor.dev/i18n@2.12.0

## 2.11.0

### Minor Changes

- e4872fb: Replicate a cross-paragraph collaboration selection as an anchor and a head address.
- 1542e73: Fix toolbar and menu bar popups rendering behind the open navigation pane. Fixes #522
- 40578c6: Add a format painter: the `format.painter` toolbar slot, `copyFormatting` and `pasteFormatting` commands, `Ctrl+Alt+C` / `Ctrl+Alt+V` (`Command` on macOS), and Copy formatting / Paste formatting rows on the right-click menu. Clear formatting now leaves a paragraph alone when the selection only ends at its start. Fixes #519
- e4872fb: Add a provider-neutral collaboration port and session contracts so the editor can attach a replication implementation without importing a CRDT or transport.
- e4872fb: Share table-cell and header selection presence as two endpoints plus an optional cell kind.
- af77c9b: Tables match Word's default cell metrics: a table that names no style resolves the document's default table style, cell margins fall back to Word's own values, the paragraph Word writes to close a cell after a nested table takes no height, and a single-spaced line box includes the font's line gap. `StyleCascadeTable` gains `defaultTableStyleId`, and `DEFAULT_CELL_MARGINS` is no longer a uniform 3pt.
- dfaafc0: Live collaboration now reports every failure a room can reach, including a session that fails after connecting, and presence chrome finds its session through the editor rather than a prop. Adds `DocxEditorCollaborationRoot` for mounting a room and `readCollaborationDocument` for reading one on a server.

### Patch Changes

- e4872fb: Allocate bookmark ids per collaboration actor so concurrent table-of-contents edits cannot mint the same id.
- e4872fb: Give each picture its own `wp:docPr` id when two people insert an image into the same document at the same time, so Word no longer renumbers the drawings when it opens the merged file.
- e4872fb: Allocate revision, comment, relationship, bookmark, and numbering ids per collaboration actor so concurrent peers no longer mint the same id from a shared snapshot.
- e4872fb: Keep both footnotes when two people add the first one to the same document at the same time, so neither author's note becomes unreachable after the edits merge.
- e4872fb: Give each paste its own bookmark, revision, and `wp:docPr` ids when two people paste into the same document at the same time, so the merged file keeps every marker, tracked change, and drawing addressable on its own.
- e4872fb: Allocate table-of-contents bookmark names and content-control ids per collaboration actor so concurrent peers cannot mint the same value.
- e4872fb: Headless automation writes now publish to a collaboration replica before the call returns, so a script that edits and then reads a peer no longer sees the document as it stood before the edit.
- e4872fb: Insert Picture and Replace Picture now mint their `wp:docPr` and relationship ids under the collaboration actor, so two people adding an image to the same document at the same time no longer produce colliding ids. A single author still gets Word's dense numbering.
- e4872fb: A rich clipboard paste now replicates story content and imported package resources to collaboration peers.
- e4872fb: Attach a collaboration session after the editing surface finishes mounting, so a session no longer fails to start and report an error status.
- e4872fb: Comments, tracked-change decisions, tables of contents, and custom nodes now replicate while a collaboration replica is attached, so those writes are no longer refused.
- e4872fb: Comment writes now replicate the comments part, relationship, and content type to collaboration peers.
- e4872fb: Add the `create-or-join` collaboration bootstrap: every peer opens a room with the same options, the first peer seeds it and later peers join it, so hosts no longer decide out-of-band which peer creates the room. A room that two partitioned peers seeded concurrently reports the new terminal failure code `concurrent-seed` on every replica; recover by creating a new room from saved bytes.
- e4872fb: Concurrent first-create of a customXml store keeps both custom nodes on collaboration peers.
- e4872fb: Give each review author slot its own hue, so two authors no longer read as the same colour.
- 2015f33: Grow a vertically merged cell by one row when you insert a row inside its span, instead of breaking the merge and shifting the grid. In a merged table, a row that holds a cell inside a content control refuses the insert rather than marking the wrong column. Fixes #57.
- e4872fb: Minted external hyperlink relationships are indexed in both `relationships` and `externalTargets`, matching the shape after save and reopen.
- e4872fb: Image insert, list numbering, and hyperlink minting now replicate to collaboration peers instead of staying local.
- e4872fb: A collaborative replica now rebuilds only the nodes a received edit names, keeps the rest of the document by identity, and revalidates only the parts that changed.
- e4872fb: Joining a collaboration room keeps inline images, and the image selection frame sits on the selected drawing.
- e4872fb: Typing in a large document with a collaboration replica attached no longer costs a scan of
  every node id in the part on each edit, so an attached editor now runs at close to solo speed.
- e4872fb: Add an `offlineEditing` option to the collaboration factories and hooks: a disconnected replica keeps accepting local edits, and the buffered updates merge on reconnect.
- c4b4dab: Minify the shipped `dist/editor.css`, which halves it from 212 KiB to 109 KiB.
- e4872fb: Keep a queued collaboration edit when a remote update arrives during it, and flush each document's queue independently so two documents in one process no longer strand each other.
- e4872fb: Resolve collaboration presence addresses without scanning the document, so remote carets no longer slow down typing on long documents.
- e4872fb: Remote carets now follow a collaborator's typing instead of stopping at the last place they clicked.
- e4872fb: Remote presence highlights now measure only visible pages, so a large remote selection no longer walks the whole document on every keystroke.
- e4872fb: Rejected tracked deletions restore ordinary run text on collaboration peers, and custom-node create-part writes now carry their content-type overrides.
- e4872fb: Receiving a collaborative edit now costs the size of the edit instead of the size of the document, and a received keystroke reaches layout as the same paragraph-scoped change a local one does.
- e4872fb: Review chrome no longer commits queued typing while it reads, and a missing image at paint time shows a placeholder instead of throwing.
- d11816f: A cell merged over several rows now takes the height of the rows it covers instead of loading all of it onto the row it starts on, so the rows beside it keep their own heights and shading. A `w:cantSplit` row holding such a merge can now split across a page rather than failing the table's layout. Fixes #504
- 0d770d9: Header and footer variants resolve per page, so a title page with no first-page header starts its body at the top margin, and a sheet added for note overflow takes the variant its own page number resolves. `PAGE` and `NUMPAGES` fields evaluate the `\#` numeric picture switch instead of painting the result cached in the file.
- @docx-editor.dev/i18n@2.11.0

## 2.10.0

### Minor Changes

- 79170d8: Add continuous section breaks: `insertBreak` takes a new `sectionContinuous` kind, and the Insert > Break > Section break (continuous) menu row is live. A next-page break cut from a continuous section now really starts a page.
- 56848c8: Add an Image row to the packaged Insert menu that opens the shared file picker, and scale an inserted image down proportionally when its natural size does not fit its cell, column, or page content box. Fixes #276
- 8ac2e88: Word-like copy and paste: copy writes plain text plus HTML with an embedded document fragment, and paste restores styles, lists, tables, links, images, and footnotes — inside the editor and from external HTML. Adds a `pasteWithoutFormatting` command (Ctrl+Shift+V) and an optional `html` payload on `paste`.
- 0e3663d: Suggesting mode records a formatting change as a tracked change instead of applying it outright, so a reviewer can reject it and get the previous properties back. Formatting also reaches the same runs through the toolbar and the automation object model, and only the runs the current view shows. Fixes #495, fixes #497, fixes #498

### Patch Changes

- 99c7408: Press Enter at the end of a paragraph, and the new paragraph takes the style's `w:next` the way Word does, so a heading is followed by body text instead of a second heading.
- ab81336: Remove leftover stylesheet rules for class names the painter no longer emits, and restore the text cursor over the page content area. Fixes #239
- 0928951: Mark a drawing inside a tracked insertion or deletion with a revision outline, the standard revision datasets, and a margin change bar; a deleted picture stays visible and dimmed under all-markup and disappears from the proposed result. In suggesting mode, inserting an image proposes a tracked insertion, deleting a selected image proposes a tracked deletion, and Delete on a pointer-selected picture deletes the picture instead of the paragraph break beside it. Fixes #479
- b10d396: Run formatting (bold, italic, font family, font size, color) now applies to text inside tracked changes; it previously did nothing over runs wrapped in `w:ins` or `w:del`. Fixes #493
- 0e3663d: Double-clicking either half of a tracked replacement now selects that half. A word no longer runs through struck text, which Word paints immediately before the text proposed to replace it.
- @docx-editor.dev/i18n@2.10.0

## 2.9.2

### Patch Changes

- 541e16f: Reduce per-keystroke latency on documents with footnotes or endnotes: mutation-path note-reference scans reuse per-subtree results instead of re-walking the whole package.
- d459c9b: Refresh header and footer pages when a picture that a text box clips out of the baseline layout finishes decoding, so a page-specific projection of the box no longer keeps a loading placeholder. Fixes #467
- 88935e6: Smart text substitutions (macOS double-space period, autocorrect) now replace the text they target instead of inserting beside it, and the browser's selection fix-up around them no longer highlights a stale range or moves the caret.
- 3289402: Repaint a header or footer once a picture inside one of its text boxes finishes decoding, so the picture no longer stays a loading placeholder. Fixes #442
- af18283: Fix the image selection overlay keeping the drawing's old frame after a resize, move, wrap, or transform. Image ops now commit through the same layout/paint tail as keystrokes, and multi-section layout no longer republishes a previous pass's sheets for a section that changed inside a balancing or re-run pass.
- e01432d: Drawing selection now follows Word's object-selection rule: a document no longer opens with a drawing selected, typing beside a drawing's anchor no longer selects it, and the selection ring and resize handles align with the image instead of landing outside the page.
- ba2fd94: Reduce input delay while typing into very large documents: when the browser reports queued input behind an expensive layout pass, a keystroke commits in its own task and layout and paint follow in separate tasks, instead of one blocking flush.
- d043089: Reduce per-keystroke latency on very large documents: structural edits no longer re-derive whole-document indexes, and page-field projection reuses unchanged pages.
- a11911c: Fix footnote placement in multi-section documents: a citation on a full page of a later section now reserves space on that page, so the note sits under its citation instead of draining onto the following pages. Fixes #460
- 067cec6: Reduce per-keystroke scan work and memory use on documents with footnotes or endnotes.
- 9716e13: PAGE and NUMPAGES footers on reused pages now update when an edit changes the page count in a single-section document. Fixes #441
- e506262: Speed up typing and document open on large multi-section documents: each keystroke now pays for the edit instead of the document, and documents with footnotes open with one pagination pass instead of two.
- 0d572e0: Render list markers for numbered paragraphs inside anchored text boxes, in the body and in headers and footers, and refresh reused pages when a numbering change moves a marker inside a box. Fixes #466
- 950d5c5: Draw a thinner insertion caret with a translucent contrast ring, so the caret no longer shows a hard outline over highlighted or shaded text.
- bb31f97: Fix tracked replacements over a rectangle of table cells to land in the first cell after its struck content, and allow `proposeReplacement` to span paragraph marks with the same landing rule as typing. Text-carrying proposals (`proposeInsertion`, `proposeReplacement`, and the matching `proposeTextChange` kinds) now refuse empty or newline-containing text instead of committing it. Fixes #459
- da051fc: Suggesting mode now records page field, hyperlink, and footnote/endnote insertion as tracked changes, and an armed caret format survives an IME replacement. Fixes #463
- e568148: Fix replacements over a selection in tracked-changes mode: typing, paste, Enter, tab, breaks, and page fields now land after the struck words with the caret following, instead of reversed or in front of the strike. Multi-line paste now splits its paragraphs inside the tracked insertion, and typing over your own pending Enter merges it instead of doing nothing.
- 263ceb1: Suggesting mode now records inserted tabs, line breaks, and page breaks as tracked insertions, and an armed typing format is no longer dropped when the insert relocates past struck text. Fixes #458
- @docx-editor.dev/i18n@2.9.2

## 2.9.1

### Patch Changes

- 36ea49a: Show selected paragraph marks and empty lines with a small selection block.
- @docx-editor.dev/i18n@2.9.1

## 2.9.0

### Minor Changes

- 686a9d6: Add agent-safe document writing and revision APIs.
  - Add an explicit `original` text projection. Pending deletions remain visible, while pending
    insertions stay hidden. This matches Word's Original review view.
  - Add the atomic `replaceStoryBlocks` automation operation with stable paragraph identities.
  - Add the DocxEditor `revisionTextView` runtime option outside the Office.js object model.
  - Implement `proposeInsertion`, `proposeDeletion`, and `proposeReplacement` editor commands.

  Projected search ranges map back to editable model offsets and retain their projection for later
  range reads and searches.

- dfe6d27: Display and edit Word mathematical equations through a bounded linear-math editor.
- 0fb376a: The store entry point now exports the full review-item vocabulary: `ReviewCustomItem` joins the `ReviewItem` union, and `ReviewModelInput` carries the custom-node inputs.

### Patch Changes

- 1b7ce7c: API report snapshots now use a canonical member order, so `api:check` no longer fails across machines; no runtime changes.
- 71052d6: Internal unit-type hardening: twips and points values now carry branded types and share one conversion module, with no behavior change.
- 91d3797: Typing now skips unused note pagination and reuses unchanged document layout data in large documents. Fixes #391.
- 1367058: Typing in a long document no longer rebuilds the review paragraph-order index on every keystroke, and repeated state reads reuse the resolved caret content control instead of re-running the hit test. Replacing a block content-control placeholder now reports the paragraph swap, so review items anchored in the replacement stay activatable.
- 5d08027: Lists now suppress paragraph spacing between consecutive items when converted documents omit the built-in contextual spacing rule.
- 0f09123: List markers now reflow when the numbering level's face or size changes.
- 5fbddee: Keep font, spacing, and alignment menus visible in the responsive toolbar overflow panel.
- fae8055: The note-properties state now refreshes when a shared header or footer is re-entered from a different section, instead of reporting the previously opened section's numbering.
- 865637a: New ordered lists now start at one instead of continuing an earlier disconnected list.
- 808ffac: Typing in a multi-page section keeps the section's untouched sheets identical across passes, so paint skips them, and repaints no longer walk the whole document to collect drawing keys.
- abd2d27: Selection writes in a repeating table header now land on the page the user is looking at, so copy and typing no longer target the first painted copy.
- 94ec84e: Plain horizontal arrow keys now collapse a text selection to its start or end without moving one extra character.
- 44f11db: The editor snapshot now notifies subscribers when `hasReviewContent` changes.
- 03262fc: Review author colours now remain stable while you edit, remove, and undo comments or tracked changes in an attached document.
- 2704c4d: Speed up large-document typing by caching paragraph, section, list, and content-control lookups so keystrokes avoid repeated full-document walks.
  - @docx-editor.dev/i18n@2.9.0

## 2.8.0

### Minor Changes

- 5ae7f4d: A blank document now ships Word's built-in style gallery, so the style picker offers Heading 1 through Heading 9, Title, Subtitle, Quote, No Spacing, and List Paragraph. Turning a list on applies List Paragraph the way Word does, which closes the space between consecutive items and leaves the paragraph indented when you turn the list back off.
- 91fc4c8: Add `insertContentControl`, so an open editor can create a content control as well as fill and remove one, as a single undoable step.

  A collapsed selection inserts an empty control showing its type's prompt, the way Word does, and the first character typed replaces the prompt whole. The same position now works through the automation protocol, which refused it before.

- 91cb3e0: Added the Paragraph dialog, which sets alignment, indentation, spacing, line spacing, tab stops and the pagination flags by value as one undo step. Open it from **Line spacing options…** on the line-spacing menu, or drive it yourself with the new `setParagraphFormat` command and `useParagraphFormat` hook.
- dab6700: `selectionRects` and `spansInSelection` now require the story's paragraph order as a third argument, so a two-argument call no longer compiles. Pass the new `everyStoryOrder(layout)` when you have no story in hand: the body-only order they used to assume is what made `spansInSelection` read a selection in a header, footer or note as empty. `selectionRects` still walks body fragments only, so it returns no rectangles outside the body whichever order you give it.
- dab6700: `PaginatedSurface` gains `sectionAnchorParagraphAt` and `sectionAtPage`, `TreeDocxSessionView` gains `storyParts`, and `PlacedCell` gains `offsetX` and `offsetY`. All three are produced by the engine and consumed by hosts, so this is additive for callers.
- dab6700: Editing in a header, footer, footnote or endnote now behaves as it does in the body: lists, tables, content controls, page setup, formatting and indent all act on the story the caret is in, and every story's paragraphs are addressable by anchor. A comment authored in one of those stories is now related from the main document, so Word can see it. Pointer chrome follows too: content control outlines and the hyperlink popover resolve in the story they are painted in, and table row and column handles are offered in the story you are editing.

### Patch Changes

- ac5ec3f: Fixed bordered paragraphs drawing a separate box each instead of one box, in a section whose columns have different widths.
- 130ba52: Fixed bordered paragraphs drawing the wrong edges, and pages breaking in the wrong place, after you edited a bordered run. Fixed a refreshed table of contents losing its empty-TOC placeholder line until you reopened the document.
- 5ae7f4d: Fixed list items and other same-style paragraphs not closing up until you reopened the document.
- 7a58fb2: Fixed IME text being dropped when you compose into an empty paragraph, and fixed a composition deleting an inline image or hidden text elsewhere in the same paragraph. Composing over a selection that spans two paragraphs now replaces the whole range in one step. Text in a header, a repeating table header row, or a footnote referenced twice no longer duplicates when you compose into it.
- dab6700: A document protected with `w:documentProtection w:edit="forms"` now refuses edits in headers, footers and notes as it already did in the body. Form fields in those stories stay fillable.
  - @docx-editor.dev/i18n@2.8.0

## 2.7.0

### Minor Changes

- 010a327: Fixed paragraph formatting controls reading a paragraph's document defaults instead of its own formatting, which left "Add space before/after paragraph" with no effect on the page. `PaginatedDocxEditorHandle.setParagraphProperty` takes an `options.mergeAttributes` flag so a line-spacing pick keeps the paragraph's spacing. Fixes #360

### Patch Changes

- 4c907ed: Fixes a group of caret and scope defects: undo after editing a header no longer leaves the editor unable to type, opening a header while a footnote is open no longer refuses every keystroke, inserting a footnote over a selection replaces it instead of destroying the note on the next keystroke, redo puts the caret where the redone edit ends, resolving a tracked change keeps the caret on the text it was in, accepting the deletion of a table's only row removes the table, a selection ending at a field no longer collapses, Backspace after a table is a quiet no-op instead of a dropped keystroke, and the paragraph, delete-row and delete-column commands act on every cell of a selected rectangle.
- 447d983: Fixed the caret jumping back to the start of a header or footer after each character typed. The `change` event's revision and `getDocumentHandle().revision` now rise for every edit, including one made in a header, footer or note, and an explicit table target is no longer refused as stale after such an edit. Fixes #361
- 047b2c6: Entering a header or moving between shared header copies no longer rebuilds every visible page. The active band is retinted in place.
- 4c907ed: Typing no longer rebuilds every visible page. A document carrying a footnotes part — which is nearly every file Word writes, even with no notes in it — discarded every page record on every layout pass, and pressing Enter in a list re-measured every paragraph in the document.
- 25235c1: Pressing Enter or Backspace in a large multi-section document no longer re-lays the whole document; layout now reuses unchanged sections and whole pages shifted by the edit, and typing latency in 500+ page documents drops sharply.
- 25235c1: Typing in long documents with footnotes gets faster again: the notes pass reuses per-page footnote areas, reserves, reference hits, and mark contexts across keystrokes when nothing note-related changed, instead of re-deriving them for every page on every edit.
- 25235c1: Typing in a long document repaints only the paragraph that changed, instead of rebuilding whole pages: pages keep their identity when content controls or page-level indexes have not moved, and the document-wide indexes the toolbar and review rail read are now built per page and reused.
- 4c907ed: Typed characters now stay in order after a repaint. A repaint that followed an edit could read the browser's own selection back as the paragraph start, so the first character landed and every one after it was inserted in front of it.
- 4c907ed: Backspace now takes back a paragraph break you proposed a moment earlier, instead of proposing to delete your own proposal. Enter then Backspace in suggesting mode left an empty paragraph behind and two entries in the review pane.
- 4c907ed: Typing over your own pending suggestion now replaces it. The keystroke was refused and silently dropped, because a suggestion the same author retracts leaves the paragraph instead of staying struck in place.
- 25235c1: Typing latency in very long documents drops further: layout reuses each unchanged section's whole prepass, list numbering, font catalogs, drawing scans, and note-mark projection reuse memoized answers across keystrokes, and shaped text measurement stops rebuilding string keys per probe.
- 4c907ed: Fixes four write lanes that had drifted from the rules the others follow: Enter inside a tracked insertion now breaks the paragraph at the caret, a table inside a header or footer can be deleted, IME text in suggesting mode is proposed rather than written, and a multi-line paste proposes its paragraph breaks and leaves the caret after the pasted text.
  - @docx-editor.dev/i18n@2.7.0

## 2.6.1

### Patch Changes

- @docx-editor.dev/i18n@2.6.1

## 2.6.0

### Minor Changes

- 56bb68f: The font compatibility notice no longer reports a document that renders no text, or a family whose metric-compatible substitute is available on the platform.
- 622c4f9: `document` and `load()` now accept `'blank'` for an empty document. Omitting `document` still means no document at all, which holds the editor on its loading screen with every control disabled. Fixes #275
- c6529c8: ESM browser builds no longer fail with `Module not found: Can't resolve 'module'`, and the new `setHarfBuzzWasmUrl` points bundlers that emit no WASM asset (esbuild, Bun) at a self-hosted `harfbuzz.wasm`. Server-side shaping over ESM now needs Node 20.16 or 22.3 and later. Fixes #282
- 0452f9c: Opening a review card no longer selects the change's text: the caret moves to the start of the range and the card's own highlight marks it, so the reader keeps whatever they had selected. Read `item.ranges` (revisions) or `item.range` (comments) for what a card is about, rather than the selection after `setActive`.
- 0652ae4: Replace `PaginatedSurface.session` with the PM-free `TreeDocxSessionView` and remove unsupported projection methods from the public editor surface.
- 9a64477: Tracked changes are now colored per author by default, the way Word shows them, and review cards carry each author's color. Mount `DocxEditor.AuthorStyle` to give a named author their own color, background, class names, or avatar, or `DocxEditor.ColorByChangeType` to keep the previous green-and-red rendering.

  Comment authors share the same colors, and every element with an author — painted spans, comment highlights, cards, balloons, and markers — carries `data-review-author` and `data-review-author-slot`. This renames the painted span's `data-revision-author` and the `--doc-review-author` custom property, which is now `--doc-review-author-current`; update any CSS that used the old names. Read the roster with `useReviewAuthors()` or `editor.getReviewAuthors()`.

- 008243e: Viewing mode no longer offers write affordances it refuses: the header and footer hover invitation, content-control widgets, image resize handles, and the custom-node and comment context-menu rows. Content-control edits are now refused in viewing instead of committing.

### Patch Changes

- 7e59774: The caret now moves freely through tracked-deleted text, one character at a time, as Word does. Text typed with the caret inside a deletion lands beside the deletion instead of corrupting it.
- 3c80f4f: Fix inter-word gap painting on lines that merge two paragraphs in a resolved revision view: a drawing in one half no longer shifts or doubles gaps in the other half.
- 3c80f4f: Fix the selection highlight in justified paragraphs: the band is now continuous across stretched inter-word spaces instead of breaking into one block per word. Underline and character shading also continue across those spaces, as Word draws them.
- bc614bd: Anchored images in the document body now keep their place when a header or footer is taller than its margin. A page-relative image was pushed down the page by the header height, and a bottom-margin-relative one followed an oversized footer. Fixes #274.
- 1ce2f55: Resolved comment miniatures now show a hover fill, and the reply field shows a focus outline.
- 887f67f: Viewing mode refuses every path into header and footer editing, not only a double-click, and a document opened in viewing no longer comes up with an editable pages layer.
  - @docx-editor.dev/i18n@2.6.0

## 2.5.0

### Minor Changes

- d905af3: PAGE, NUMPAGES, and SECTIONPAGES fields in the document body (and body tables) now render the page number, document page count, or section page count when the field has no cached result, instead of showing blank.
- 5c65a88: Opening a large document now shows a loading screen instead of freezing the page: the engine mounts it behind one painted frame, `snapshot().isOpening` reports that window, and `DocxEditor.Loading` gains an `overlay` variant that the packaged React frame mounts by default.
- d905af3: Document-property fields (TITLE, AUTHOR, SUBJECT, KEYWORDS, LASTSAVEDBY, COMMENTS, and DOCPROPERTY for those names) now render their value from the document properties when the field has no cached result, instead of showing blank.
- d905af3: HYPERLINK field links now work with the link popover the same way typed links do: the popover opens read-only over one, Ctrl/Cmd+K reaches it, and it dismisses when the caret leaves the field. Two adjacent HYPERLINK fields that point at the same target now render as two separate links.
- 346cc78: Tracked changes on a paragraph mark now reach the page and the review pane: every decision on a mark is read rather than the first, a paragraph moved whole raises a card and resolves, a format change on the mark is published, a mark inside a table cell is drawn, the margin gets its change bar, and a resolved view draws no attribution. Renumbering a list or a footnote, and every field a fragment publishes, now take part in incremental layout reuse, so a reused page no longer shows a value the document has moved past.
- 289a7a1: Clicking a tracked-change card now opens that card, and text one reviewer inserted and another struck opens the deletion, as Word reads it.
- 5a2f3ed: A review card for a paragraph break now says which change it is. A deleted break read as "Inserted paragraph break", which is the reverse of what accepting that card does, and both halves of a moved paragraph read the same way.
- 5a2f3ed: The resolved display modes now merge the paragraphs their decisions merge, in the body, in table cells, and in headers and footers: a paragraph whose mark a tracked change deleted runs into the next one in the final view, as it does in Word and as accepting the change already did. Accepting a run of deleted paragraph marks also collapses them into one paragraph rather than into pairs, and no longer carries content past a table or a content control.
- 266a086: The `mode` option accepts `'suggesting'` and now decides the mode a document opens in; the React and Vue `<DocxEditor>` components default it to `'edit'`, so a document carrying `w:trackRevisions` opens ready to type there. Omit `mode` on `createDocxEditor` or `DocxEditor.Root` to keep following the document's request.
- d905af3: SYMBOL, MACROBUTTON, and GOTOBUTTON fields and w:sym symbol runs now render, legacy FORMCHECKBOX and FORMDROPDOWN fields paint their w:ffData state, and PAGE-family fields nested inside other fields evaluate per page. HYPERLINK fields are clickable links with the same target sanitization as typed hyperlinks.

### Patch Changes

- f3e5d58: Keystrokes arriving in a burst now land as one transaction and one layout flush instead of one per character, so fast typing in long documents stays responsive; a burst is also one undo step and one tracked change.
- 192c644: Pasting from an application that offers only an HTML flavour now recovers its text more faithfully: an attribute value holding a `>` no longer truncates the paste, unterminated markup is no longer pasted as literal text, and a very large table no longer blocks the page. Reading a document's content types no longer uses a pattern a crafted file could make backtrack.
- f811b44: Memoize package snapshots, section enumeration, and list resolution so a keystroke in a long document no longer rescans the whole tree; typing in large documents is significantly faster.
- 4a57eed: Update harfbuzzjs to 1.6.0 (HarfBuzz 14.3.0). Shaping output does not change.
  - @docx-editor.dev/i18n@2.5.0

## 2.4.1

### Patch Changes

- @docx-editor.dev/i18n@2.4.1

## 2.4.0

### Patch Changes

- @docx-editor.dev/i18n@2.4.0

## 2.3.1

### Patch Changes

- 1c9b6a2: Long documents now reuse pagination after explicit page and section breaks, avoiding full-document work for ordinary typing, wrap-inducing edits, and character, word, line, vertical, or document-edge caret movement. Rapid typing preserves input order while coalescing pending page, toolbar, and review-rail refreshes, and repeated tracked deletions stay compact instead of adding one OOXML run per keypress.
- 1c9b6a2: Rapid typing no longer reorders characters when a deferred paint leaves the DOM caret behind the model. Native and touch carets that return to that leftover offset still edit there.
  - @docx-editor.dev/i18n@2.3.1

## 2.3.0

### Patch Changes

- @docx-editor.dev/i18n@2.3.0

## 2.2.1

### Patch Changes

- 35f6d04: Fix exported comment replies opening as separate comments instead of a thread in Microsoft Word.
  - @docx-editor.dev/i18n@2.2.1

## 2.2.0

### Minor Changes

- 3096225: The document now fits its container by default, so a narrow window shrinks the page instead of overflowing it and opening the comments pane shrinks the document rather than pushing it off screen. Drive it with `Editor.setZoomMode` or React's new `useZoom` hook, and pass `zoomMode={{ type: 'fixed' }}` to keep the old behavior.

### Patch Changes

- 9c25492: Keep legacy FORMTEXT result text editable with character-accurate caret and selection offsets.
- 04c2379: Programmatic selections made while embedded fonts load now keep their range and visible highlight after the shaped-font remount.
- f0e4ab9: Tracked changes on a field's result now render as tracked. A deletion or insertion around the value of a cross-reference, page number or form field previously painted as ordinary unchanged text, so a reviewer saw no strikethrough or author colour on an edit the review sidebar was reporting correctly. A paragraph containing such a field also measured longer than what was laid out from it, which put the caret and the keystroke at different offsets — clicking after the field placed the cursor in one place and typing appeared in another. `w:fldSimple` now paints its cached result instead of blank space, allowlisted PAGE/NUMPAGES/SECTIONPAGES nested inside a non-page simple field evaluate per sheet rather than reusing the saved cache, and field results carry Word's grey field shading — always for legacy form fields unless the document sets `w:doNotShadeFormData`, and per the new `fieldShading` option (`never` / `when-selected` / `always`) for the rest.
- Updated dependencies [568ccf7]
  - @docx-editor.dev/i18n@2.2.0

## 2.1.3

### Patch Changes

- @docx-editor.dev/i18n@2.1.3

## 2.1.2

### Patch Changes

- efd3d76: Menus and popovers now paint above the editor's own furniture. Toolbar dropdowns, the menu bar, colour pickers and the hyperlink popover sat at a lower z-index than the navigation gutter and table chrome, so opening File put the menu underneath the navigation toggle. Layering is now three `--doc-z-*` tokens (`chrome`, `overlay`, `context`) rather than a dozen hand-picked numbers.
- 69a97f3: `setActiveReviewItem` and `useReview().setActive` take a `reveal` option, so a host can choose where an activated change lands instead of taking the engine's default: `'start'`, `'center'`, `'centerIfNeeded'`, `'nearest'`, or `false` to select the item without moving the viewport at all.
- ede69f6: Activating a review card now reports whether it landed. `setActiveReviewItem` returns an `ExecResult` and `useReview().setActive` a boolean, so a host walking the queue with next/previous controls can tell a step that did nothing from one that worked — activation is refused for an unknown key, an item with no range, a story that will not open, and a revision kind the rail excluded. Review items carry a matching `activatable` flag, so a card that cannot be clicked can be drawn that way instead of discovering it on click.
- 802ab3e: The collapsed review rail now draws a glyph for what each marker actually is — an insertion, a deletion, a formatting change, a comment or a custom node — instead of one comment bubble for every kind. A custom node names its own through `reviewCard`'s new `icon`, and the `Markers` part takes an `icon` of its own for a host that wants to draw all of them itself.
- 4fa91bd: The painted-document rules are now scoped to the editor. Around a hundred `.layout-*` and `.paged-editor*` selectors shipped unscoped, so a host with its own `.layout-page-header` or `.layout-page-content` had those elements restyled by the editor's stylesheet. The class names are unchanged; only the rules moved under `.docx-editor`. The stylesheet guard now exempts `.docx-` alone, so nothing else can ship unanchored.
- 4fa91bd: The y-prosemirror remote-cursor styles are now scoped to the editor. `.ProseMirror-yjs-cursor` is y-prosemirror's class name rather than one the engine mints, and it shipped unscoped, so a host running its own ProseMirror editor with Yjs on the same page had its remote cursors restyled. The stylesheet guard no longer treats `.ProseMirror-` as an engine-owned namespace.
  - @docx-editor.dev/i18n@2.1.2

## 2.1.1

### Patch Changes

- d74c5d6: Jumping to a tracked change or a selection now lands on it: the reveal was measuring caret geometry against the top of the sheet rather than the page's content box, so every jump stopped one page margin short and left the target just under the fold. Reveals that have to travel now centre their target instead of stopping the moment it clears the bottom edge, and one that is already on screen still does not move.
  - @docx-editor.dev/i18n@2.1.1

## 2.1.0

### Minor Changes

- a9fd363: BMP and WebP images now render instead of showing an unsupported-format placeholder.
- 3310029: Custom nodes can carry a payload larger than the 64-character `w:tag` cap, in a customXml data part an SDT binds to, with a sweep that collects payloads whose control was deleted and a removal that leaves no record of the store for documents exported outside the system.
- d116599: Custom nodes can be inserted, updated and removed inside a header, footer or note, including a node carrying a payload: the control lands in that story while its customXml store stays on the main document part, where Word looks for it. Which story a write targets now comes from the node or paragraph id rather than from wherever the reader happens to be, so a caller can address a node in a story it has left. Inserting, updating and removing all refuse a document open for viewing instead of editing it — these writes go through the store, below the editing-mode gate — and report the same `locked` code the engine's own refusal uses.
- dbf5501: Every remaining `ep-` prefixed CSS class and keyframe is renamed to `docx-editor-`, so the whole stylesheet shares one namespace with the `.docx-editor` root class. If your own CSS targets an `.ep-*` class or the `ep-caret-blink` keyframe, switch it to the same name under `docx-editor-` (`.ep-one-surface__caret` becomes `.docx-editor-one-surface__caret`).
- 8b4830e: Review navigation now goes where it says it does: activating a card selects the item's whole range and scrolls to it even when your own UI holds focus or the target page is not yet materialized, walking from a header change back to a body change leaves the header story so the body card activates again, and the `setSelection` command reveals its target. New `setReviewActivationExclusions` lets a host rail tell the engine which revision kinds it hides, so clicking tracked text never opens a card the rail does not render.
- 7a72c42: Tracked changes and comments inside footnotes and endnotes now reach the review queue. They get cards with real geometry, `getTrackedChanges` names the story holding them, the caret can make one active, opening a card enters that note, accept and reject resolve against the note's own part, and a note card can be replied to — commenting anywhere after a note reference was refused before, because the offset walk counted note marks as no characters. Commenting outside the body works the same way: a range selected in a header, footer or note offers the affordance and the comment lands in that story. `focus(scope)` honours its argument, and a scope it cannot open is refused without first closing the story the reader had open.
- 43c3e6a: The shipped stylesheet is now precompiled and fully namespaced: every Tailwind utility, editable-surface rule and keyframe is scoped under the renamed `.docx-editor` root class (previously `.ep-root`), so the CSS no longer collides with a host app's Tailwind setup and styles the chrome correctly in hosts without Tailwind. If your own CSS targets `.ep-root`, switch it to `.docx-editor`.
- d793994: TIFF images now render instead of reserving their extent behind a placeholder. The image decode port's `convertMetafile` hook is renamed to `convertPreserved` and receives TIFF alongside EMF and WMF.

### Patch Changes

- d793994: The caret now carries a contrasting ring, so it stays visible against dark content. Clicking beside a dark image, or arrowing onto the line one sits on, no longer leaves the insertion point invisible.
- 6dee1e3: Comment markers now land on the character they were asked for in paragraphs holding a drawing, a field or an inline content control, and a comment can be anchored inside a content control at all. The comment writer measured those paragraphs with a walk of its own that counted such elements as nothing, so commenting near one was either refused outright or, worse, placed the marker silently on the wrong character. A marker at the far edge of a complex field is also placed after the whole field rather than among its parts, where Word would drop it on the next field rebuild.
- f4eac0c: Update fast-xml-parser to 5.10.1.
- b3e3457: Pin the node and mark name unions on `treeSchema` so the generated type declaration is identical between builds.
- 7dce3ba: Keep sub-1pt drawing extents at full paint height so Word's hairline form-rule bars stay visible instead of shrinking to a sub-pixel clip.
- a758db1: Fix images in a header or footer staying on the loading placeholder forever. The picture decodes, but the page kept the furniture it was laid out with, so it never showed.
- 42406bc: Header and footer ink now overflows its band like Word instead of being clipped: anchored shapes offset past the content width or below the header text stay visible, and negative indents hang into the margin. Overflowing shapes stay inert until the band is edited, so they never swallow clicks meant for the body.
- d793994: Fix a band of blank space under an inline image in a paragraph using multiple line spacing. The multiple now scales the text line, as Word does, instead of the image's own height.
- d89ef55: Stop binding Cmd+R for right alignment on macOS: the browser reserves that chord for reload, so the old binding re-aligned the paragraph and the page still reloaded. Right alignment stays on Ctrl+R on every platform.
- d56b1a5: Speed up the document pipeline on long documents: opening, laying out, editing and saving a 500-page document is roughly a third faster end to end, and unchanged-document layout passes drop by more than half. Parsing, validation, layout keying and serialization now avoid recomputing facts already proven for unchanged, immutable nodes; no validation or security bound changed.
- 34be525: Apply Word's automatic paragraph spacing when `w:beforeAutospacing` or `w:afterAutospacing` is set, instead of the measurement the flag replaces. Documents written by Word's HTML filter carry it on every paragraph and were laid out 9pt tight per boundary, which moved page breaks.
- 765e617: Stop applying paragraph-mark `w:pPr/w:rPr` font size to content runs that inherit the paragraph style. Mark formatting still sizes empty lines and last-line mark height.
- 113ed44: Tracked changes from other editors now coalesce the way Word shows them: adjacent same-author deletions or insertions merge into one review card, and a deletion meeting an insertion pairs into a single Replaced card regardless of how far apart their timestamps are.
- 3f70246: Speed up comment and tracked-change derivation on heavily reviewed long documents: re-reading the review queue over an unchanged document is ~25x faster, and the re-derive after an accept, reject, comment write or undo drops by more than half. Derivation semantics are unchanged.
- 8b4830e: Review and navigation now land in the story they name: accepting or rejecting a header or footer card leaves the caret inside that story instead of throwing it into the body (after which every keystroke was silently refused), replying to a header or footer card writes into that part instead of being refused, and jumping to a body search hit or outline heading leaves an open header or note first.
- 585413d: Fix caret and hit-test drift on lines containing superscript or subscript text. The shaped measurer rounded the reduced super/subscript size to a whole half-point, measuring those runs up to 3% wider than they paint; the caret landed mid-glyph for the rest of the line.
- cc82d50: Pictures inside footnotes, endnotes and text boxes now render. They previously painted nothing at all, not even a placeholder.
- ec538fa: Fix suggesting mode dropping text typed at the start of a paragraph that carries properties, which made the keyboard look dead in the item Enter had just opened. An empty list item's marker also no longer paints over the item above it.
- 45c9b93: Anchored text boxes now render their content clipped inside the shape's extent in the body, headers, and footers, with PAGE / NUMPAGES / SECTIONPAGES fields inside header/footer text boxes evaluated per page. Editing a header or footer whose direct content is nearly empty now shows a full-height edit band instead of a hairline.
- 0a62c6d: Typing in a tracked table row no longer drops that row's tracked-change card, so the row insertion stays acceptable and rejectable.
- e215962: Trailing tabs no longer start a new line, so a header authored as tabbed columns keeps its own height and stops pushing the body down the page. Header and footer shapes marked `behindDoc` now paint beneath the body text instead of over it.
- 434454d: Paint form-blank underlines across tab advances: an underlined `w:tab` now draws a rule for the reserved stop width instead of relying on CSS text-decoration on an invisible tab glyph.
- Updated dependencies [232728c]
  - @docx-editor.dev/i18n@2.1.0

## 2.0.1

### Patch Changes

- 51f14f5: Add the `repository` field to the core package manifest so npm can verify its provenance statement on publish.
  - @docx-editor.dev/i18n@2.0.1

## 2.0.0

### Major Changes

- 26095c6: Initial release.

  A WYSIWYG `.docx` editor that runs entirely in the browser: it opens a Word file, paints
  the real paginated layout, edits it in place, and writes a `.docx` back out.
  - `@docx-editor.dev/react` — the React adapter. `<DocxEditor document={bytes} />` for the
    packaged editor, or compose `DocxEditor.Root` / `.Viewport` / `.Content` with the hooks
    (`useEditorState`, `useEditorCommand`, `useDocxEditor`) to build your own chrome.
  - `@docx-editor.dev/core` — the framework-agnostic engine: OPC/XML reading, the canonical
    OOXML tree, layout, paint, and the `Editor` contract the adapters render.
  - `@docx-editor.dev/i18n` — the shared string catalogue, with nine locales.
  - `@docx-editor.dev/editor-api` — a batching document object model for automating a
    document from a server or from an editor already open in a page.
  - `@docx-editor.dev/pro` — tracked changes, comments, and custom nodes.

  Word fidelity is structural: styles, theme colours, tables, headers and footers, section
  layout, numbering, and tab stops resolve through the same cascade Word uses, and content
  the editor does not model round-trips untouched.

- 26095c6: `setSelection` now types the forms it actually accepts. `EditorSelection` gained the
  `{ anchor, head }` paragraph-id pair the engine honours, and lost the `SemanticTarget` and
  `DocLocation` arms it never accepted, so the outline and any other caller can move the caret
  without a cast.

  Breaking if you passed a `SemanticTarget` or a `DocLocation`-ended range to `setSelection`:
  both were refused at runtime with `unsupported`, so working code is unaffected.

- 26095c6: Remove `EditorHost`, `EditorConfig` and `createEditor` from the public surface. They described a retired pipeline in which the adapter supplied DOM handles and a display sink; the editor has painted its own surface since `createDocxEditor` replaced it, and none of the three had a caller. Use `createDocxEditor` with `DocxEditorConfig`.

### Minor Changes

- 26095c6: Put the caret in the right place on an empty paragraph. A centred or right-aligned one drew it at the left margin, and one with a first-line indent ignored the indent; in both cases it only jumped to the correct position once a character was typed. Lines now publish their aligned content origin as `LineRecord.contentX`.
- 26095c6: The root entry and the `contracts/*` entries now export the types their own signatures hand
  out — `CanResult` from `can()`, `TextMatch` from `findText()`, `TableContext` from `query()`
  and around 60 more that were previously unnameable from the entry point that returns them.
  The root re-exports the whole `Editor` contract rather than a hand-listed subset, so it cannot
  drift from it again.

  Removes `@docx-editor.dev/core/contracts/plugin` and `@docx-editor.dev/core/contracts/mcp`.
  Every function in them threw, and `coreTools` had no runtime binding at all. Extensions and
  MCP are deferred to a separately specified contract; `EditorModule` is the supported seam.

### Patch Changes

- Updated dependencies [26095c6]
  - @docx-editor.dev/i18n@2.0.0
