# Plan 06: Paginated Editing

## Goal

Replace continuous ProseMirror editor with true paginated editing where users see and edit real pages with headers/footers.

## ⚠️ CLEAN ROOM APPROACH - LEGAL REQUIREMENT

SuperDoc is licensed under **AGPL-3.0**. We use it ONLY to understand concepts.

**ALLOWED:**

- Read SuperDoc to understand HOW something works conceptually
- Check superdoc.dev demo to see expected behavior
- Close the file, then write your own implementation from scratch

**FORBIDDEN:**

- Copy any code, variable names, function signatures
- Copy comments or documentation text
- Use SuperDoc's specific algorithms verbatim

**Process for each task:**

1. Read SuperDoc reference to understand the CONCEPT
2. CLOSE the file
3. Write your OWN implementation from memory/understanding
4. Log what concept you learned in progress.txt

---

## Architecture Overview (Simple Version)

```
┌─────────────────────────────────────────────────────────────┐
│                      PagedEditor                             │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌─────────────┐    ┌───────────────┐  │
│  │ Hidden PM    │───▶│ Layout      │───▶│ Visible Pages │  │
│  │ (editing)    │    │ Engine      │    │ (rendering)   │  │
│  └──────────────┘    └─────────────┘    └───────────────┘  │
│         ▲                                       │           │
│         └───────── click mapping ◀──────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

**Key insight from SuperDoc:** ProseMirror is hidden, pages are just visual rendering. Clicks map back to PM positions.

---

## Phase 1: Layout Engine Refactor

### Task 1.1: Create layout engine types

- [x] Create `src/layout-engine/types.ts` with core types
- [x] Define: `FlowBlock`, `Measure`, `Layout`, `Page`, `Fragment`
- [x] Each fragment tracks `pmStart`/`pmEnd` for position mapping

**SuperDoc reference (concept only):**

- `~/superdoc/packages/layout-engine/contracts/src/index.ts` - see type definitions
- Understand: blocks have runs, measures have lines, fragments are positioned

**Clean room implementation:**

- Write your own TypeScript types based on our existing Document types
- Keep it simple - we don't need all of SuperDoc's complexity

### Task 1.2: Create basic paginator

- [x] Create `src/layout-engine/paginator.ts`
- [x] Track current page, cursor Y position, available height
- [x] Handle page breaks when content doesn't fit

**SuperDoc reference (concept only):**

- `~/superdoc/packages/layout-engine/layout-engine/src/paginator.ts` - ~129 lines
- Understand: paginator tracks page state, creates new pages when needed

**Clean room implementation:**

- Simple class with `currentPage`, `cursorY`, `availableHeight`
- Method `ensureFits(height)` - starts new page if needed
- Method `addFragment(fragment)` - positions and adds to current page

### Task 1.3: Create layoutDocument function

- [x] Create `src/layout-engine/index.ts` with main `layoutDocument()`
- [x] Input: blocks + measures + options → Output: Layout with pages
- [x] Walk blocks in order, position fragments on pages

**SuperDoc reference (concept only):**

- `~/superdoc/packages/layout-engine/layout-engine/src/index.ts:527` - layoutDocument
- Understand: greedy algorithm - walk blocks, stack fragments, new page when full

**Clean room implementation:**

- Simple loop over blocks
- For each block, get its measure, calculate fragment position
- If doesn't fit, start new page
- Return `{ pages: Page[], pageSize }`

### Task 1.4: Handle section breaks

- [x] Create `src/layout-engine/section-breaks.ts`
- [x] Handle page size changes, margin changes at section boundaries
- [x] Support `nextPage`, `continuous`, `evenPage`, `oddPage` break types

**SuperDoc reference (concept only):**

- `~/superdoc/packages/layout-engine/layout-engine/src/section-breaks.ts`
- Understand: sections can change page size/margins, different break types

**Clean room implementation:**

- Track active section properties
- On section break: check break type, maybe force new page
- Update margins/page size for next section

### Task 1.5: Handle keepNext/keepLines

- [x] Add keepNext chain detection to layout engine
- [x] If chain doesn't fit, move entire chain to next page

**SuperDoc reference (concept only):**

- `~/superdoc/packages/layout-engine/layout-engine/src/index.ts:188` - computeKeepNextChains
- Understand: consecutive keepNext paragraphs form chains that must stay together

**Clean room implementation:**

- Pre-scan blocks to find keepNext chains
- When laying out chain start, check if chain + anchor fits
- If not, start new page before the chain

---

## Phase 2: PM to Blocks Conversion

### Task 2.1: Create PM adapter

- [x] Create `src/layout-bridge/toFlowBlocks.ts`
- [x] Convert ProseMirror doc → FlowBlock array
- [x] Track pmStart/pmEnd positions for each block

**SuperDoc reference (concept only):**

- `~/superdoc/packages/layout-engine/pm-adapter/src/internal.ts`
- Understand: walk PM nodes, convert to blocks, track positions

**Clean room implementation:**

- Use our existing ProseMirror schema
- Walk `doc.forEach()`, convert each node to FlowBlock
- Store `pmStart = offset`, `pmEnd = offset + node.nodeSize`

### Task 2.2: Convert paragraph nodes

- [x] Convert PM paragraph → ParagraphBlock with runs
- [x] Extract formatting from marks into run properties
- [x] Handle inline content (text, images, tabs)

**Clean room implementation:**

- Map PM paragraph attrs to block attrs (alignment, spacing, etc.)
- Walk content, group by marks into runs
- Each run has: text, fontFamily, fontSize, bold, italic, etc.

### Task 2.3: Convert table nodes

- [x] Convert PM table → TableBlock with rows/cells
- [x] Handle cell content (can contain paragraphs)

**Clean room implementation:**

- Recursively convert cell content
- Track cell widths, row heights

---

## Phase 3: Text Measurement

### Task 3.1: Create measurement container

- [x] Create `src/layout-bridge/measuring/measureContainer.ts`
- [x] Hidden DOM element for measuring text
- [x] Set up with proper fonts, widths

**SuperDoc reference (concept only):**

- `~/superdoc/packages/layout-engine/measuring/dom/src/index.ts`
- Understand: render text to hidden DOM, measure with Range API

**Clean room implementation:**

- Create off-screen div with `position: absolute; left: -9999px`
- Set width to content area width
- Render runs with proper font styles

### Task 3.2: Measure paragraph lines

- [x] Create `src/layout-bridge/measuring/measureParagraph.ts`
- [x] Render paragraph text, measure line breaks
- [x] Return: `{ lines: Line[], totalHeight }`

**Clean room implementation:**

- Render runs as spans with proper styles
- Use `Range` API to detect line breaks (Y position changes)
- Calculate line heights from bounding rects

### Task 3.3: Add measurement cache

- [x] Create `src/layout-bridge/measuring/cache.ts`
- [x] Cache measurements by block content hash
- [x] Invalidate on font/width changes

**Clean room implementation:**

- Simple Map with key = hash of block content + width
- Clear cache when page width changes

---

## Phase 4: DOM Painter

### Task 4.1: Create page renderer

- [x] Create `src/layout-painter/renderPage.ts`
- [x] Render single page as DOM element
- [x] Position fragments absolutely within content area

**Clean room implementation:**

- Create page div with proper width/height
- Create content area div with margins
- For each fragment, render and position absolutely

### Task 4.2: Create fragment renderers

- [x] Create `src/layout-painter/renderParagraph.ts`
- [x] Render paragraph fragment (subset of lines) to DOM
- [x] Apply text formatting to runs

**Clean room implementation:**

- Create div for fragment at (x, y) position
- Render each line as a div
- Render runs as spans with formatting styles

### Task 4.3: Create painter class

- [x] Create `src/layout-painter/index.ts`
- [x] Paint Layout → DOM with reconciliation
- [x] Only update changed pages/fragments

**Clean room implementation:**

- Compare new layout with previous
- Reuse unchanged page elements
- Replace changed fragments

---

## Phase 5: Click-to-Position Mapping

### Task 5.1: Hit test pages

- [x] Create `src/layout-bridge/hitTest.ts`
- [x] Map click coordinates → page index
- [x] Account for page gaps

**SuperDoc reference (concept only):**

- `~/superdoc/packages/layout-engine/layout-bridge/src/index.ts:365` - hitTestPage
- Understand: walk pages, check if Y is within page bounds

**Clean room implementation:**

- Calculate cumulative page tops (with gaps)
- Binary search or linear scan to find page

### Task 5.2: Hit test fragments

- [x] Map click within page → fragment
- [x] Find fragment that contains the point

**Clean room implementation:**

- For each fragment on page, check if point is inside bounds
- Return first matching fragment

### Task 5.3: Map click to PM position

- [x] Create `src/layout-bridge/clickToPosition.ts`
- [x] Given fragment + local coordinates → PM position
- [x] Use character measurements to find exact position

**SuperDoc reference (concept only):**

- `~/superdoc/packages/layout-engine/layout-bridge/src/text-measurement.ts`
- Understand: measure character X positions, find closest

**Clean room implementation:**

- Find which line (by Y)
- Find which character (by X) using stored measurements
- Return pmStart + character offset

---

## Phase 6: Selection Overlay

### Task 6.1: PM selection to rectangles

- [x] Create `src/layout-bridge/selectionRects.ts`
- [x] Convert PM selection range → screen rectangles
- [x] Handle multi-line, multi-page selections

**SuperDoc reference (concept only):**

- `~/superdoc/packages/layout-engine/layout-bridge/src/index.ts` - selectionToRects
- Understand: find fragments in range, calculate rects for selected portions

**Clean room implementation:**

- Find all fragments that overlap with selection
- For each, calculate rect for the selected portion
- Return array of rects with page indices

### Task 6.2: Create selection overlay component

- [x] Create `src/paged-editor/SelectionOverlay.tsx`
- [x] Render caret (blinking cursor)
- [x] Render selection highlights

**Clean room implementation:**

- Absolute positioned div over pages
- For collapsed selection: render caret at position
- For range selection: render highlight rectangles

---

## Phase 7: PagedEditor Component

### Task 7.1: Create hidden PM host

- [x] Create `src/paged-editor/HiddenProseMirror.tsx`
- [x] Invisible ProseMirror that receives focus/input
- [x] Forward transactions to layout pipeline

**SuperDoc reference (concept only):**

- `~/superdoc/packages/super-editor/src/core/presentation-editor/PresentationEditor.ts:309`
- Understand: hidden host is off-screen, receives keyboard input

**Clean room implementation:**

- Div with `position: absolute; left: -9999px; opacity: 0`
- ProseMirror view mounted inside
- On transaction: trigger layout update

### Task 7.2: Create PagedEditor main component

- [x] Create `src/paged-editor/PagedEditor.tsx`
- [x] Integrate hidden PM, layout engine, painter
- [x] Wire up click handling and selection sync

**Clean room implementation:**

- State: layout, blocks, measures
- On PM transaction: convert to blocks, measure, layout, paint
- On click: hit test, update PM selection
- Render: pages container + selection overlay

### Task 7.3: Handle keyboard input

- [x] Route keyboard events to hidden PM
- [x] Keep focus on hidden PM during editing

**Clean room implementation:**

- Visible container redirects focus to hidden PM
- PM handles all keyboard input normally
- Layout updates on each transaction

---

## Phase 8: Headers and Footers

### Task 8.1: Measure header/footer content

- [x] Create `src/layout-bridge/measureHeaderFooter.ts`
- [x] Measure actual height of header/footer content
- [x] Pass heights to layout engine

**SuperDoc reference (concept only):**

- `~/superdoc/packages/layout-engine/layout-bridge/src/layoutHeaderFooter.ts`
- Understand: headers/footers measured separately, heights used for margin inflation

**Clean room implementation:**

- Render header/footer content to measurement container
- Get total height
- Return per-variant heights (default, first, even, odd)

### Task 8.2: Inflate margins for headers/footers

- [x] Adjust effective top margin based on header height
- [x] Adjust effective bottom margin based on footer height
- [x] Prevent body content overlap with header/footer

**SuperDoc reference (concept only):**

- `~/superdoc/packages/layout-engine/layout-engine/src/index.ts:642-670`
- Understand: `effectiveTopMargin = max(baseMargin, headerDistance + headerHeight)`

**Clean room implementation:**

- Calculate effective margins in layoutDocument
- Use per-page header/footer heights if available
- Content area shrinks when headers/footers are tall

### Task 8.3: Render headers/footers on pages

- [x] Add header/footer rendering to page painter
- [x] Position in header/footer areas (above/below margins)
- [x] Resolve page number tokens (context.pageNumber available)

**Clean room implementation:**

- Render header content at top of page (headerDistance from top)
- Render footer content at bottom (footerDistance from bottom)
- Replace `{{pageNumber}}` with actual page number

---

## Phase 9: Integration and Testing

### Task 9.1: Create integration tests

- [x] Test: layout produces correct pages
- [x] Test: click maps to correct PM position
- [x] Test: PM edits update visual pages

### Task 9.2: Performance baseline

- [x] Measure layout time for 10-page document
- [x] Measure repaint time after single character edit
- [x] Target: <100ms for layout, <50ms for incremental update

### Task 9.3: Replace DocumentViewer with PagedEditor

- [x] Update DocxEditor to use PagedEditor
- [x] Keep DocumentViewer as fallback/read-only option
- [x] Migrate existing tests

---

## File Structure

```
src/
├── layout-engine/           # Pure layout computation
│   ├── types.ts             # FlowBlock, Measure, Layout, Page, Fragment
│   ├── index.ts             # layoutDocument()
│   ├── paginator.ts         # Page state management
│   └── section-breaks.ts    # Section property handling
│
├── layout-bridge/           # PM ↔ Layout connection
│   ├── toFlowBlocks.ts      # PM Doc → FlowBlock[]
│   ├── measuring/
│   │   ├── measureContainer.ts
│   │   ├── measureParagraph.ts
│   │   └── cache.ts
│   ├── hitTest.ts           # Click → page/fragment
│   ├── clickToPosition.ts   # Click → PM position
│   └── selectionRects.ts    # PM selection → rectangles
│
├── layout-painter/          # Layout → DOM
│   ├── index.ts             # Painter class
│   ├── renderPage.ts
│   └── renderParagraph.ts
│
└── paged-editor/            # React components
    ├── PagedEditor.tsx      # Main component
    ├── HiddenProseMirror.tsx
    └── SelectionOverlay.tsx
```

---

## Success Criteria

1. **Visual fidelity**: Pages look identical to DocumentViewer output
2. **Editing works**: Can type, delete, format text in paginated view
3. **Selection works**: Click places cursor, drag selects text
4. **Headers/footers**: Render correctly, don't overlap content
5. **Page breaks**: Explicit and implicit breaks work correctly
6. **Performance**: Responsive typing (<100ms feedback)

---

## Notes

- Keep it simple - no web workers, no priority queues initially
- Get basic version working first, optimize later
- Test each phase before moving to next
- Maintain clean room discipline for every task
