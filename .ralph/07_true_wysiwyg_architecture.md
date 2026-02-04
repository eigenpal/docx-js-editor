# Plan 07: True WYSIWYG Architecture

## Overview

Our current PagedEditor uses the same architectural pattern as SuperDoc: **hidden ProseMirror editor + visible paginated rendering**. This is the correct approach for WYSIWYG paginated documents. However, our implementation is incomplete and buggy.

This plan fixes the architecture properly by implementing the missing components that SuperDoc has:

1. **Selection Sync Coordinator** - Epoch-based synchronization
2. **DOM Position Index** - Fast lookup for click-to-position mapping
3. **Centralized Input Manager** - Single source of truth for all input handling
4. **Proper Accessibility** - Screen reader support via hidden editor

## Architecture Comparison

### Current (Broken)

```
PagedEditor.tsx (1100+ lines, everything mixed together)
├── Layout pipeline (inline)
├── Selection rendering (inline, no sync)
├── Click handling (scattered)
├── Cursor rendering (fragile)
└── Many edge case bugs
```

### Target (SuperDoc-style)

```
PagedEditor/
├── PresentationEditor.ts      # Core orchestrator
├── SelectionSyncCoordinator.ts # Epoch-based sync
├── DomPositionIndex.ts        # Fast position lookups
├── EditorInputManager.ts      # Centralized input
├── SelectionOverlay.tsx       # Selection rendering
├── HiddenEditor.tsx           # Accessible PM wrapper
└── PagedViewport.tsx          # Visible pages
```

---

## Phase 1: Selection Sync Coordinator

**Goal:** Ensure selection only renders when layout is current, preventing stale cursor positions.

### Tasks

- [ ] **1.1 Create SelectionSyncCoordinator class**

  ```typescript
  // src/paged-editor/SelectionSyncCoordinator.ts
  class SelectionSyncCoordinator extends EventEmitter {
    #docEpoch = 0; // Document version
    #layoutEpoch = 0; // Painted layout version
    #layoutUpdating = false;

    setDocEpoch(epoch: number): void;
    onLayoutStart(): void;
    onLayoutComplete(epoch: number): void;
    requestRender(): void; // Emits 'render' when safe
    isSafeToRender(): boolean;
  }
  ```

- [ ] **1.2 Integrate coordinator with layout pipeline**
  - Increment docEpoch on every document change
  - Call onLayoutStart() before layout computation
  - Call onLayoutComplete() after DOM painting
  - Selection updates only proceed when isSafeToRender()

- [ ] **1.3 Add render event handling**
  - Subscribe to 'render' event for selection updates
  - Debounce rapid selection changes
  - Handle edge cases (focus loss, window blur)

- [ ] **1.4 Write tests for coordinator**
  - Test epoch synchronization
  - Test race conditions
  - Test rapid document changes

---

## Phase 2: DOM Position Index

**Goal:** Fast, accurate click-to-position mapping using indexed DOM data.

### Tasks

- [ ] **2.1 Create DomPositionIndex class**

  ```typescript
  // src/paged-editor/DomPositionIndex.ts
  class DomPositionIndex {
    #pageElements: Map<number, HTMLElement>;
    #fragmentsByPage: Map<number, HTMLElement[]>;
    #runsByFragment: Map<string, HTMLElement[]>;

    rebuild(container: HTMLElement): void;
    getPageAtY(y: number): { page: HTMLElement; index: number } | null;
    getFragmentAtPoint(pageIndex: number, x: number, y: number): HTMLElement | null;
    getRunAtPoint(fragment: HTMLElement, x: number): HTMLElement | null;
    getPositionInRun(run: HTMLElement, x: number): number;
  }
  ```

- [ ] **2.2 Implement page Y-position caching**
  - Cache page top/bottom coordinates
  - Binary search for page at Y coordinate
  - Invalidate on scroll/zoom/layout change

- [ ] **2.3 Implement fragment/run indexing**
  - Index all fragments by page
  - Index all runs by fragment
  - Store pmStart/pmEnd for fast lookup

- [ ] **2.4 Implement precise position finding**
  - Binary search within text runs
  - Handle tab runs (use visual bounds)
  - Handle image runs
  - Handle empty paragraphs

- [ ] **2.5 Integrate with existing clickToPositionDom**
  - Replace current implementation
  - Add fallback for edge cases
  - Profile performance improvement

---

## Phase 3: Centralized Input Manager

**Goal:** Single source of truth for all pointer/keyboard input handling.

### Tasks

- [ ] **3.1 Create EditorInputManager class**

  ```typescript
  // src/paged-editor/EditorInputManager.ts
  class EditorInputManager {
    #editor: ProseMirrorEditor;
    #positionIndex: DomPositionIndex;
    #isDragging = false;
    #dragAnchor: number | null = null;

    attach(container: HTMLElement): void;
    detach(): void;

    // Pointer events
    #onPointerDown(e: PointerEvent): void;
    #onPointerMove(e: PointerEvent): void;
    #onPointerUp(e: PointerEvent): void;

    // Click handling
    #handleSingleClick(pos: number): void;
    #handleDoubleClick(pos: number): void; // Word select
    #handleTripleClick(pos: number): void; // Paragraph select

    // Drag selection
    #startDrag(anchor: number): void;
    #extendDrag(to: number): void;
    #endDrag(): void;
  }
  ```

- [ ] **3.2 Implement pointer event handling**
  - Normalize coordinates for zoom
  - Handle multi-touch (ignore for now)
  - Track drag state properly

- [ ] **3.3 Implement click type detection**
  - Single click: position cursor
  - Double click: select word
  - Triple click: select paragraph
  - Use timestamp-based detection

- [ ] **3.4 Implement drag selection**
  - Track drag anchor position
  - Extend selection on move
  - Auto-scroll when near edges
  - End drag on pointer up/leave

- [ ] **3.5 Implement keyboard focus management**
  - Ensure hidden editor stays focused
  - Handle focus loss gracefully
  - Re-focus on click

- [ ] **3.6 Remove scattered event handlers from PagedEditor**
  - Delete inline handlers
  - Use InputManager exclusively
  - Clean up useCallback mess

---

## Phase 4: Selection Overlay Refactor

**Goal:** Clean, reliable selection and cursor rendering.

### Tasks

- [ ] **4.1 Create SelectionOverlay component**

  ```typescript
  // src/paged-editor/SelectionOverlay.tsx
  interface SelectionOverlayProps {
    container: HTMLElement;
    selection: { from: number; to: number } | null;
    positionIndex: DomPositionIndex;
    syncCoordinator: SelectionSyncCoordinator;
  }

  function SelectionOverlay(props: SelectionOverlayProps): JSX.Element;
  ```

- [ ] **4.2 Implement caret rendering**
  - Use positionIndex for accurate placement
  - Handle blinking animation
  - Handle caret at line boundaries

- [ ] **4.3 Implement selection highlight rendering**
  - Get rects from positionIndex
  - Handle multi-line selections
  - Handle cross-page selections
  - Handle tab/image selections properly

- [ ] **4.4 Implement selection change subscription**
  - Listen to syncCoordinator 'render' events
  - Update overlay only when safe
  - Smooth transitions

- [ ] **4.5 Handle edge cases**
  - Empty document
  - Selection at document end
  - Selection across page breaks
  - Selection including tables

---

## Phase 5: Hidden Editor Wrapper

**Goal:** Proper accessibility and focus management.

### Tasks

- [ ] **5.1 Create HiddenEditor component**

  ```typescript
  // src/paged-editor/HiddenEditor.tsx
  interface HiddenEditorProps {
    document: Document;
    onTransaction: (tr: Transaction, state: EditorState) => void;
    onSelectionChange: (state: EditorState) => void;
  }

  const HiddenEditor = forwardRef<HiddenEditorRef, HiddenEditorProps>(...);
  ```

- [ ] **5.2 Implement proper positioning**
  - Position off-screen but focusable
  - Use opacity: 0, not visibility: hidden
  - Ensure keyboard events work

- [ ] **5.3 Implement accessibility attributes**
  - role="textbox"
  - aria-multiline="true"
  - aria-label (document title)
  - tabindex="0"

- [ ] **5.4 Implement focus management**
  - Auto-focus on mount
  - Re-focus after blur
  - Handle programmatic focus

---

## Phase 6: PagedEditor Refactor

**Goal:** Clean orchestration of all components.

### Tasks

- [ ] **6.1 Refactor PagedEditor to use new components**

  ```typescript
  // src/paged-editor/PagedEditor.tsx (simplified)
  function PagedEditor(props: PagedEditorProps) {
    const syncCoordinator = useMemo(() => new SelectionSyncCoordinator(), []);
    const positionIndex = useMemo(() => new DomPositionIndex(), []);
    const inputManager = useMemo(() => new EditorInputManager(...), []);

    return (
      <div className="paged-editor">
        <HiddenEditor ref={editorRef} ... />
        <PagedViewport pages={layout.pages} ... />
        <SelectionOverlay ... />
      </div>
    );
  }
  ```

- [ ] **6.2 Simplify layout pipeline**
  - Extract to useLayoutPipeline hook
  - Integrate with syncCoordinator
  - Clean up state management

- [ ] **6.3 Remove deprecated code**
  - Delete inline event handlers
  - Delete old selection code
  - Delete old click mapping

- [ ] **6.4 Add proper TypeScript types**
  - Define clear interfaces
  - Remove any types
  - Add JSDoc comments

---

## Phase 7: Tab and Special Character Handling

**Goal:** Proper handling of tabs, images, and other special runs.

### Tasks

- [ ] **7.1 Fix tab width calculation**
  - Use document's actual tab stops
  - Handle default tab stops correctly
  - Handle hanging indent + tabs

- [ ] **7.2 Fix tab click/cursor handling**
  - Position index handles tabs
  - Cursor renders at correct position
  - Selection highlights full tab width

- [ ] **7.3 Fix image handling**
  - Click selects image
  - Cursor before/after image
  - Selection includes image

- [ ] **7.4 Fix line break handling**
  - Soft breaks (shift+enter)
  - Hard breaks (enter)
  - Cursor at line boundaries

---

## Phase 8: Testing and Validation

**Goal:** Comprehensive tests for the new architecture.

### Tasks

- [ ] **8.1 Unit tests for SelectionSyncCoordinator**
  - Epoch management
  - Race conditions
  - Event emission

- [ ] **8.2 Unit tests for DomPositionIndex**
  - Page lookup
  - Fragment lookup
  - Position calculation

- [ ] **8.3 Unit tests for EditorInputManager**
  - Click handling
  - Drag selection
  - Multi-click detection

- [ ] **8.4 Integration tests**
  - Full editing flow
  - Selection rendering
  - Tab handling
  - Cross-page selection

- [ ] **8.5 Visual regression tests**
  - Cursor position
  - Selection highlight
  - Page layout

---

## Phase 9: Performance Optimization

**Goal:** Ensure smooth editing experience.

### Tasks

- [ ] **9.1 Profile layout performance**
  - Measure layout time
  - Identify bottlenecks
  - Optimize hot paths

- [ ] **9.2 Optimize position index**
  - Lazy rebuilding
  - Incremental updates
  - Cache invalidation

- [ ] **9.3 Optimize selection rendering**
  - Batch rect calculations
  - Minimize DOM operations
  - Use requestAnimationFrame

- [ ] **9.4 Add performance metrics**
  - Layout time
  - Selection update time
  - Input latency

---

## Success Criteria

1. **Cursor positioning is pixel-perfect** - No more off-by-one errors
2. **Selection works reliably** - No missing characters, proper boundaries
3. **Tabs render correctly** - Jump to correct positions, cursor works
4. **No race conditions** - Selection only updates when layout is current
5. **Performance is acceptable** - <16ms for selection updates (60fps)
6. **Code is maintainable** - Clear separation of concerns

---

## File Structure After Refactor

```
src/paged-editor/
├── index.ts                      # Public exports
├── PagedEditor.tsx               # Main component (simplified)
├── PagedViewport.tsx             # Visible pages container
├── HiddenEditor.tsx              # Accessible PM wrapper
├── SelectionOverlay.tsx          # Cursor and selection rendering
├── SelectionSyncCoordinator.ts   # Epoch-based sync
├── DomPositionIndex.ts           # Position lookup
├── EditorInputManager.ts         # Input handling
├── hooks/
│   ├── useLayoutPipeline.ts      # Layout computation hook
│   ├── useSelectionSync.ts       # Selection sync hook
│   └── useInputManager.ts        # Input manager hook
├── utils/
│   ├── coordinates.ts            # Coordinate normalization
│   ├── textMeasurement.ts        # Text width measurement
│   └── accessibility.ts          # A11y helpers
└── types.ts                      # Shared types
```

---

## Estimated Effort

| Phase                         | Effort  | Priority |
| ----------------------------- | ------- | -------- |
| Phase 1: Selection Sync       | 1 day   | Critical |
| Phase 2: DOM Position Index   | 2 days  | Critical |
| Phase 3: Input Manager        | 2 days  | Critical |
| Phase 4: Selection Overlay    | 1 day   | High     |
| Phase 5: Hidden Editor        | 0.5 day | High     |
| Phase 6: PagedEditor Refactor | 1 day   | High     |
| Phase 7: Tab Handling         | 1 day   | High     |
| Phase 8: Testing              | 2 days  | Medium   |
| Phase 9: Performance          | 1 day   | Medium   |

**Total: ~12 days of focused work**

---

## References

- SuperDoc architecture: `reference/superdoc/packages/super-editor/src/core/presentation-editor/`
- Current PagedEditor: `src/paged-editor/PagedEditor.tsx`
- Layout engine: `src/layout-engine/`
- Layout bridge: `src/layout-bridge/`
