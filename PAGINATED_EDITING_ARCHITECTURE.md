# Paginated Editing Architecture Plan

## Executive Summary

This document outlines the architecture for implementing **true paginated editing** in docx-editor, inspired by SuperDoc's approach. The goal is to replace the current continuous ProseMirror editor with a page-based editing experience where users see real pages while editing.

**Estimated scope:** ~30,000-40,000 lines of TypeScript
**Estimated timeline:** 3-6 months with focused effort

---

## Current State vs Target State

### Current Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    DocxEditor                           │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────────┐  │
│  │   ProseMirrorEditor │  │    DocumentViewer       │  │
│  │   (Editing Mode)    │  │    (Preview Mode)       │  │
│  │                     │  │                         │  │
│  │  • Continuous doc   │  │  • Paginated preview    │  │
│  │  • CSS page breaks  │  │  • Headers/footers      │  │
│  │  • No real pages    │  │  • Read-only            │  │
│  └─────────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Target Architecture (SuperDoc-style)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PagedEditor                                   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Hidden PM Host │  │ Layout Bridge│  │   Visible Page Host    │  │
│  │                │  │              │  │                        │  │
│  │ • Invisible    │  │ • PM → Block │  │  ┌────────┐ ┌────────┐ │  │
│  │ • Real editing │  │ • Measure    │  │  │ Page 1 │ │ Page 2 │ │  │
│  │ • Focus here   │  │ • Layout     │  │  │        │ │        │ │  │
│  │                │  │ • Paint      │  │  │ H/F    │ │ H/F    │ │  │
│  └────────────────┘  └──────────────┘  │  └────────┘ └────────┘ │  │
│         ↓                   ↓          └────────────────────────┘  │
│    EditorState      layoutDocument()           DOM Pages           │
│    Transaction       → Layout             (click → PM pos)         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Components

### 1. Core Layout Engine (`src/layout-engine/`)

**~5,000-6,000 lines**

Pure computation - no DOM, no side effects, fully testable.

```
src/layout-engine/
├── index.ts              # Main layoutDocument() export
├── types.ts              # Layout, Page, Fragment, Measure types
├── paginator.ts          # Page/column creation and tracking
├── section-breaks.ts     # Section property handling
├── layout-paragraph.ts   # Paragraph → ParaFragment positioning
├── layout-table.ts       # Table → TableFragment positioning
├── layout-image.ts       # Image/drawing positioning
├── floating-objects.ts   # Anchored object management
├── keep-next.ts          # keepNext chain calculations
└── column-balancing.ts   # Multi-column balancing
```

**Key Types:**

```typescript
// Input: Blocks with measurements
type FlowBlock = ParagraphBlock | TableBlock | ImageBlock | SectionBreakBlock | PageBreakBlock;

type Measure = ParagraphMeasure | TableMeasure | ImageMeasure | SectionBreakMeasure;

// Output: Positioned fragments on pages
type Layout = {
  pages: Page[];
  pageSize: { w: number; h: number };
  pageGap?: number;
};

type Page = {
  fragments: Fragment[];
  size?: { w: number; h: number };
  margins?: PageMargins;
  sectionIndex?: number;
};

type Fragment = ParaFragment | TableFragment | ImageFragment | DrawingFragment;

type ParaFragment = {
  kind: 'para';
  blockId: string;
  x: number;
  y: number;
  width: number;
  fromLine: number;
  toLine: number;
  pmStart?: number; // ProseMirror position mapping
  pmEnd?: number;
};
```

**Core Algorithm (`layoutDocument`):**

```typescript
function layoutDocument(blocks: FlowBlock[], measures: Measure[], options: LayoutOptions): Layout {
  // 1. Initialize paginator with page size, margins
  // 2. Pre-compute keepNext chains
  // 3. Walk blocks in order:
  //    - For each block, check if it fits
  //    - If not, start new page/column
  //    - Position fragment(s) on page
  //    - Handle section breaks (new margins, page size, columns)
  // 4. Apply vertical alignment if needed
  // 5. Return Layout with all pages
}
```

### 2. Layout Bridge (`src/layout-bridge/`)

**~10,000-12,000 lines**

Orchestration layer connecting ProseMirror to layout engine.

```
src/layout-bridge/
├── index.ts                 # Public API exports
├── pm-adapter/
│   ├── toFlowBlocks.ts      # PM Doc → FlowBlock[] conversion
│   ├── fromFlowBlocks.ts    # FlowBlock[] → PM Doc (if needed)
│   └── types.ts             # Adapter types
├── measuring/
│   ├── measureParagraph.ts  # DOM measurement for text
│   ├── measureTable.ts      # Table cell measurements
│   ├── measureHeaderFooter.ts
│   └── measureCache.ts      # Caching layer
├── orchestration/
│   ├── incrementalLayout.ts # Smart re-layout on changes
│   ├── layoutCoordinator.ts # Priority scheduling
│   ├── layoutScheduler.ts   # P0/P1/P2/P3 priorities
│   ├── dirtyTracker.ts      # Track changed regions
│   └── versionManager.ts    # Layout version tracking
├── header-footer/
│   ├── headerFooterLayout.ts
│   ├── headerFooterUtils.ts
│   └── headerFooterCache.ts
├── position-mapping/
│   ├── clickToPosition.ts   # (x,y) → PM position
│   ├── positionToRect.ts    # PM position → screen rect
│   └── selectionRects.ts    # Selection → rectangles
└── worker/
    ├── layoutWorker.ts      # Web Worker for P2/P3
    └── workerProtocol.ts    # Message passing
```

**PM Adapter - Converting ProseMirror to Layout Blocks:**

```typescript
function toFlowBlocks(
  pmDoc: ProseMirrorNode,
  styleResolver: StyleResolver,
  context: ConverterContext
): { blocks: FlowBlock[]; bookmarks: Map<string, number> } {
  const blocks: FlowBlock[] = [];

  pmDoc.forEach((node, offset) => {
    if (node.type.name === 'paragraph') {
      blocks.push(convertParagraph(node, offset, styleResolver));
    } else if (node.type.name === 'table') {
      blocks.push(convertTable(node, offset, styleResolver));
    }
    // ... etc
  });

  return { blocks, bookmarks };
}

function convertParagraph(
  node: ProseMirrorNode,
  baseOffset: number,
  styleResolver: StyleResolver
): ParagraphBlock {
  return {
    kind: 'paragraph',
    id: `para-${baseOffset}`,
    runs: convertRuns(node, baseOffset),
    attrs: {
      pmStart: baseOffset,
      pmEnd: baseOffset + node.nodeSize,
      alignment: node.attrs.alignment,
      spacing: node.attrs.spacing,
      // ... etc
    },
  };
}
```

**Priority-Based Layout Scheduling:**

```typescript
enum Priority {
  P0 = 0, // Sync, <5ms - cursor paragraph only
  P1 = 1, // Async 16ms debounce - visible viewport
  P2 = 2, // Async 50ms debounce - adjacent pages (worker)
  P3 = 3, // Async 150ms debounce - full document (worker)
}

class LayoutCoordinator {
  onTransaction(tr: Transaction, cursorParagraphIndex?: number) {
    // Cancel stale low-priority work
    this.interruptBelow(Priority.P1);

    // P0: Immediate cursor feedback
    if (cursorParagraphIndex !== undefined) {
      this.scheduleSync(Priority.P0, { scope: 'paragraph', index: cursorParagraphIndex });
    }

    // P1-P3: Debounced background work
    this.scheduleAsync(Priority.P1, { scope: 'viewport' });
    this.scheduleAsync(Priority.P2, { scope: 'adjacent' });
    this.scheduleAsync(Priority.P3, { scope: 'full' });
  }
}
```

### 3. DOM Painter (`src/layout-painter/`)

**~8,000-10,000 lines**

Renders Layout → DOM with efficient updates.

```
src/layout-painter/
├── index.ts              # createDomPainter() factory
├── painter.ts            # Main Painter class
├── page-renderer.ts      # Render single page
├── fragment-renderers/
│   ├── paragraph.ts      # ParaFragment → DOM
│   ├── table.ts          # TableFragment → DOM
│   ├── image.ts          # ImageFragment → DOM
│   └── list-marker.ts    # List bullet/number rendering
├── reconciliation/
│   ├── domReconciler.ts  # Diff and patch DOM
│   └── fragmentDiff.ts   # Fragment comparison
├── virtualization/
│   ├── virtualizer.ts    # Page virtualization
│   └── scrollObserver.ts # Viewport tracking
└── styles/
    ├── pageStyles.ts     # Page CSS generation
    └── fragmentStyles.ts # Fragment CSS
```

**Page Rendering:**

```typescript
function renderPage(
  page: Page,
  pageIndex: number,
  blocks: FlowBlock[],
  measures: Measure[],
  context: RenderContext
): HTMLElement {
  const pageEl = document.createElement('div');
  pageEl.className = 'page';
  pageEl.style.cssText = `
    width: ${page.size?.w ?? context.pageSize.w}px;
    height: ${page.size?.h ?? context.pageSize.h}px;
    position: relative;
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  `;

  // Create content area (respecting margins)
  const contentArea = document.createElement('div');
  contentArea.className = 'page-content';
  contentArea.style.cssText = `
    position: absolute;
    top: ${page.margins?.top ?? 72}px;
    left: ${page.margins?.left ?? 72}px;
    right: ${page.margins?.right ?? 72}px;
    bottom: ${page.margins?.bottom ?? 72}px;
  `;

  // Render each fragment
  for (const fragment of page.fragments) {
    const fragmentEl = renderFragment(fragment, blocks, measures, context);
    contentArea.appendChild(fragmentEl);
  }

  pageEl.appendChild(contentArea);
  return pageEl;
}
```

### 4. Paged Editor Component (`src/paged-editor/`)

**~5,000-6,000 lines**

The main React component orchestrating everything.

```
src/paged-editor/
├── PagedEditor.tsx          # Main component
├── hooks/
│   ├── useLayoutEngine.ts   # Layout state management
│   ├── useInputBridge.ts    # Click/keyboard handling
│   ├── useSelectionSync.ts  # PM ↔ visual selection
│   └── useScrollPosition.ts # Scroll tracking
├── input/
│   ├── InputBridge.ts       # Unified input handling
│   ├── ClickHandler.ts      # Click → PM position
│   ├── KeyboardHandler.ts   # Keyboard events
│   └── DragSelection.ts     # Mouse drag selection
├── selection/
│   ├── SelectionOverlay.tsx # Visual selection rendering
│   ├── CaretRenderer.tsx    # Blinking cursor
│   └── SelectionRects.ts    # PM selection → screen rects
├── headers-footers/
│   ├── HeaderFooterEditor.tsx
│   └── HeaderFooterOverlay.tsx
└── styles/
    └── paged-editor.css
```

**PagedEditor Component:**

```tsx
export function PagedEditor({ document, onChange }: PagedEditorProps) {
  // Hidden ProseMirror for actual editing
  const hiddenHostRef = useRef<HTMLDivElement>(null);
  const visibleHostRef = useRef<HTMLDivElement>(null);

  // Layout state
  const [layoutState, setLayoutState] = useState<LayoutState>({
    blocks: [],
    measures: [],
    layout: null,
  });

  // Initialize hidden ProseMirror editor
  const editorView = useProseMirror({
    hostRef: hiddenHostRef,
    doc: document,
    onTransaction: (tr) => {
      // Update layout on doc changes
      if (tr.docChanged) {
        scheduleLayout(tr);
      }
      // Sync selection to visual overlay
      syncSelectionToOverlay(editorView.state.selection);
    },
  });

  // Layout coordination
  const { scheduleLayout, layout } = useLayoutEngine({
    editorView,
    onLayoutComplete: (result) => {
      setLayoutState(result);
      repaintPages(result);
    },
  });

  // Input handling - clicks on visual pages → PM positions
  const { handleClick, handleDrag } = useInputBridge({
    editorView,
    layout: layoutState.layout,
    blocks: layoutState.blocks,
    measures: layoutState.measures,
  });

  return (
    <div className="paged-editor">
      {/* Hidden ProseMirror - receives focus and keyboard input */}
      <div
        ref={hiddenHostRef}
        className="paged-editor__hidden-host"
        style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
      />

      {/* Visible pages - click/drag handled by InputBridge */}
      <div
        ref={visibleHostRef}
        className="paged-editor__pages"
        onClick={handleClick}
        onMouseDown={handleDrag}
      >
        {layoutState.layout?.pages.map((page, i) => (
          <PageComponent
            key={i}
            page={page}
            pageIndex={i}
            blocks={layoutState.blocks}
            measures={layoutState.measures}
          />
        ))}
      </div>

      {/* Selection overlay - renders caret and selection highlights */}
      <SelectionOverlay
        editorView={editorView}
        layout={layoutState.layout}
        blocks={layoutState.blocks}
        measures={layoutState.measures}
      />
    </div>
  );
}
```

### 5. Text Measurement System (`src/layout-bridge/measuring/`)

**~3,000 lines**

Critical for accurate layout - measures text in DOM.

```typescript
// Measure a paragraph by rendering to hidden DOM
async function measureParagraph(
  block: ParagraphBlock,
  constraints: { maxWidth: number }
): Promise<ParagraphMeasure> {
  // Create off-screen container
  const container = getMeasurementContainer();
  container.style.width = `${constraints.maxWidth}px`;

  // Render runs with actual fonts
  for (const run of block.runs) {
    const span = document.createElement('span');
    span.style.fontFamily = run.fontFamily;
    span.style.fontSize = `${run.fontSize}pt`;
    span.textContent = run.text;
    container.appendChild(span);
  }

  // Measure lines using Range API
  const lines = measureLines(container, block.runs);

  // Clean up
  container.innerHTML = '';

  return {
    kind: 'paragraph',
    lines,
    totalHeight: lines.reduce((sum, l) => sum + l.lineHeight, 0),
  };
}

function measureLines(container: HTMLElement, runs: Run[]): Line[] {
  const lines: Line[] = [];
  let currentLine: Line | null = null;
  let lastBottom = 0;

  // Walk through all text nodes
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    const range = document.createRange();

    for (let i = 0; i < node.length; i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();

      // New line detected when Y position jumps
      if (!currentLine || rect.bottom > lastBottom + 2) {
        if (currentLine) lines.push(currentLine);
        currentLine = {
          fromRun: /* ... */,
          toRun: /* ... */,
          fromChar: i,
          toChar: i,
          width: 0,
          lineHeight: rect.height,
        };
      }

      currentLine.toChar = i + 1;
      currentLine.width = Math.max(currentLine.width, rect.right - rect.left);
      lastBottom = rect.bottom;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER ACTION                                  │
│                    (typing, clicking, etc.)                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    HIDDEN PROSEMIRROR EDITOR                         │
│                                                                      │
│  • Receives keyboard input (focus stays here)                        │
│  • Manages EditorState and Transaction                               │
│  • Selection lives here                                              │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    Transaction (docChanged)
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       PM → FLOW BLOCKS                               │
│                                                                      │
│  toFlowBlocks(pmDoc) → FlowBlock[]                                   │
│  • Paragraphs → ParagraphBlock with runs                             │
│  • Tables → TableBlock with cells                                    │
│  • Each block has pmStart/pmEnd for position mapping                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      TEXT MEASUREMENT                                │
│                                                                      │
│  measureParagraph(block, { maxWidth }) → ParagraphMeasure            │
│  • Render text to hidden DOM with actual fonts                       │
│  • Measure line breaks and heights                                   │
│  • Cache results for performance                                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LAYOUT ENGINE                                   │
│                                                                      │
│  layoutDocument(blocks, measures, options) → Layout                  │
│  • Pure computation, no DOM                                          │
│  • Positions fragments on pages                                      │
│  • Handles page breaks, sections, keepNext                           │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DOM PAINTER                                    │
│                                                                      │
│  painter.paint(layout, blocks, measures)                             │
│  • Reconciles DOM with Layout                                        │
│  • Only updates changed fragments                                    │
│  • Renders pages with proper margins, headers, footers               │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    VISIBLE PAGES (DOM)                               │
│                                                                      │
│  • User sees real pages with correct layout                          │
│  • Click events mapped back to PM positions                          │
│  • Selection overlay renders caret/highlights                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Click-to-Position Mapping

When user clicks on a visual page:

```typescript
function handleClick(event: MouseEvent) {
  // 1. Get click coordinates relative to page container
  const { clientX, clientY } = event;

  // 2. Find which page was clicked
  const pageHit = hitTestPage(layout, { x: clientX, y: clientY });
  if (!pageHit) return;

  // 3. Find which fragment was clicked
  const fragmentHit = hitTestFragment(layout, pageHit, blocks, measures, {
    x: clientX - pageOffset.x,
    y: clientY - pageOffset.y,
  });
  if (!fragmentHit) return;

  // 4. Find character position within the fragment
  const pmPos = clickToCharacterPosition(
    fragmentHit.fragment,
    fragmentHit.block,
    fragmentHit.measure,
    { x: localX, y: localY }
  );

  // 5. Update ProseMirror selection
  const tr = editorView.state.tr.setSelection(TextSelection.create(editorView.state.doc, pmPos));
  editorView.dispatch(tr);
}
```

---

## Selection Rendering

PM selection → visual rectangles on pages:

```typescript
function selectionToRects(
  selection: Selection,
  layout: Layout,
  blocks: FlowBlock[],
  measures: Measure[]
): Rect[] {
  const rects: Rect[] = [];
  const { from, to } = selection;

  // Find all fragments that overlap with selection
  for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex++) {
    const page = layout.pages[pageIndex];

    for (const fragment of page.fragments) {
      if (fragment.kind !== 'para') continue;

      const pmStart = fragment.pmStart ?? 0;
      const pmEnd = fragment.pmEnd ?? pmStart;

      // Check if selection overlaps this fragment
      if (pmEnd <= from || pmStart >= to) continue;

      // Get block and measure for this fragment
      const block = findBlock(blocks, fragment.blockId);
      const measure = findMeasure(measures, fragment.blockId);

      // Calculate rectangles for the selected portion
      const fragmentRects = getSelectionRectsInFragment(
        fragment,
        block,
        measure,
        Math.max(from, pmStart),
        Math.min(to, pmEnd),
        pageIndex
      );

      rects.push(...fragmentRects);
    }
  }

  return rects;
}
```

---

## Header/Footer Handling

Headers and footers are measured separately and their heights are used to adjust page margins:

```typescript
async function layoutWithHeadersFooters(
  blocks: FlowBlock[],
  measures: Measure[],
  options: LayoutOptions,
  headerFooterBlocks: Map<string, FlowBlock[]>
): Promise<Layout> {
  // 1. First pass: measure all header/footer content
  const headerHeights = new Map<string, number>();
  const footerHeights = new Map<string, number>();

  for (const [id, hfBlocks] of headerFooterBlocks) {
    const hfMeasures = await measureBlocks(hfBlocks, options);
    const layout = layoutHeaderFooter(hfBlocks, hfMeasures, options);

    if (id.startsWith('header')) {
      headerHeights.set(id, layout.totalHeight);
    } else {
      footerHeights.set(id, layout.totalHeight);
    }
  }

  // 2. Second pass: layout body with inflated margins
  const layoutOptions: LayoutOptions = {
    ...options,
    headerContentHeights: {
      default: headerHeights.get('header-default') ?? 0,
      first: headerHeights.get('header-first') ?? 0,
      even: headerHeights.get('header-even') ?? 0,
      odd: headerHeights.get('header-odd') ?? 0,
    },
    footerContentHeights: {
      default: footerHeights.get('footer-default') ?? 0,
      first: footerHeights.get('footer-first') ?? 0,
      even: footerHeights.get('footer-even') ?? 0,
      odd: footerHeights.get('footer-odd') ?? 0,
    },
  };

  return layoutDocument(blocks, measures, layoutOptions);
}
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-4)

- [ ] Create `src/layout-engine/` with core types
- [ ] Implement basic `layoutDocument()` for paragraphs only
- [ ] Create `Paginator` class for page management
- [ ] Write comprehensive tests for layout engine
- [ ] Refactor existing `pageLayout.ts` into new structure

### Phase 2: PM Adapter (Weeks 5-7)

- [ ] Create `toFlowBlocks()` conversion from ProseMirror
- [ ] Add pmStart/pmEnd tracking to all blocks
- [ ] Implement text measurement system
- [ ] Add measurement caching

### Phase 3: DOM Painter (Weeks 8-10)

- [ ] Create `createDomPainter()` factory
- [ ] Implement page and fragment rendering
- [ ] Add DOM reconciliation (diff and patch)
- [ ] Implement page virtualization

### Phase 4: Input Bridge (Weeks 11-13)

- [ ] Implement click-to-position mapping
- [ ] Create selection-to-rectangles conversion
- [ ] Build SelectionOverlay component
- [ ] Handle keyboard input routing

### Phase 5: PagedEditor Component (Weeks 14-16)

- [ ] Create main PagedEditor React component
- [ ] Integrate hidden ProseMirror host
- [ ] Wire up layout coordination
- [ ] Implement focus management

### Phase 6: Headers/Footers (Weeks 17-19)

- [ ] Header/footer measurement and layout
- [ ] Margin inflation based on content height
- [ ] Section-aware header/footer selection
- [ ] Header/footer editing mode

### Phase 7: Advanced Features (Weeks 20-24)

- [ ] Web Worker for P2/P3 layout
- [ ] Incremental layout optimization
- [ ] Tables (complex cell layouts)
- [ ] Images and floating objects
- [ ] Performance optimization

---

## File Structure Summary

```
src/
├── layout-engine/           # ~6,000 lines - Pure layout computation
│   ├── index.ts
│   ├── types.ts
│   ├── paginator.ts
│   ├── section-breaks.ts
│   ├── layout-paragraph.ts
│   ├── layout-table.ts
│   ├── keep-next.ts
│   └── tests/
│
├── layout-bridge/           # ~12,000 lines - Orchestration
│   ├── pm-adapter/
│   │   ├── toFlowBlocks.ts
│   │   └── types.ts
│   ├── measuring/
│   │   ├── measureParagraph.ts
│   │   ├── measureTable.ts
│   │   └── measureCache.ts
│   ├── orchestration/
│   │   ├── incrementalLayout.ts
│   │   ├── layoutCoordinator.ts
│   │   └── dirtyTracker.ts
│   ├── header-footer/
│   │   └── headerFooterLayout.ts
│   ├── position-mapping/
│   │   ├── clickToPosition.ts
│   │   └── selectionRects.ts
│   └── worker/
│       └── layoutWorker.ts
│
├── layout-painter/          # ~8,000 lines - DOM rendering
│   ├── painter.ts
│   ├── page-renderer.ts
│   ├── fragment-renderers/
│   ├── reconciliation/
│   └── virtualization/
│
├── paged-editor/           # ~6,000 lines - React integration
│   ├── PagedEditor.tsx
│   ├── hooks/
│   ├── input/
│   ├── selection/
│   └── headers-footers/
│
└── prosemirror/            # Existing - keep for schema/commands
    ├── schema/
    ├── commands/
    └── plugins/
```

---

## Key Decisions

1. **Hidden ProseMirror**: The real editing happens in a hidden ProseMirror instance. The visible pages are pure rendering.

2. **Pure Layout Engine**: No DOM dependencies in the layout engine. Makes it testable and potentially usable in Node.js for server-side rendering.

3. **Priority-Based Updates**: P0 (sync) for instant cursor feedback, P1-P3 (async) for larger updates. Ensures responsive typing.

4. **Fragment-Based Rendering**: Content is rendered as positioned fragments, not as a continuous document. A paragraph can span multiple pages.

5. **PM Position Tracking**: Every fragment knows its pmStart/pmEnd positions, enabling bidirectional mapping between clicks and PM state.

---

## Questions to Resolve

1. **Undo/Redo**: How to handle undo when visual representation is disconnected from PM state?
2. **IME Input**: How to handle composition events when PM is hidden?
3. **Copy/Paste**: How to intercept and handle clipboard operations?
4. **Accessibility**: How to maintain screen reader compatibility with hidden PM?
5. **Performance**: Target metrics for P0 latency (<16ms), full layout budget?

---

## Next Steps

1. **Review this document** - Does this architecture make sense?
2. **Set up project structure** - Create the directory scaffold
3. **Start with layout engine** - Build the foundation first
4. **Incremental migration** - Keep existing editor working while building new one
