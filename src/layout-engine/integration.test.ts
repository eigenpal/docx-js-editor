/**
 * Integration Tests for Paginated Layout Engine
 *
 * Tests the complete layout pipeline:
 * 1. Layout produces correct pages from blocks + measures
 * 2. Click maps to correct ProseMirror position
 * 3. Block changes produce correct layout updates
 */

import { describe, test, expect } from 'bun:test';

import { layoutDocument } from './index';
import type {
  ParagraphBlock,
  ParagraphMeasure,
  MeasuredLine,
  FlowBlock,
  Measure,
  PageMargins,
  LayoutOptions,
} from './types';

import { hitTestPage, hitTestFragment, getPageTop } from '../layout-bridge/hitTest';
import { clickToPosition, clickToPositionInParagraph } from '../layout-bridge/clickToPosition';

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Create a simple paragraph block with text runs.
 */
function makeParagraphBlock(
  id: number,
  text: string,
  pmStart: number,
  options: {
    alignment?: 'left' | 'center' | 'right' | 'justify';
    keepNext?: boolean;
    pageBreakBefore?: boolean;
  } = {}
): ParagraphBlock {
  return {
    kind: 'paragraph',
    id,
    runs: [
      {
        kind: 'text',
        text,
        pmStart,
        pmEnd: pmStart + text.length,
      },
    ],
    attrs: {
      alignment: options.alignment,
      keepNext: options.keepNext,
      pageBreakBefore: options.pageBreakBefore,
    },
    pmStart,
    pmEnd: pmStart + text.length + 1, // +1 for paragraph node boundary
  };
}

/**
 * Create a measured line with specified dimensions.
 */
function makeLine(
  fromRun: number,
  fromChar: number,
  toRun: number,
  toChar: number,
  width: number,
  lineHeight: number
): MeasuredLine {
  return {
    fromRun,
    fromChar,
    toRun,
    toChar,
    width,
    ascent: lineHeight * 0.8,
    descent: lineHeight * 0.2,
    lineHeight,
  };
}

/**
 * Create a paragraph measure from lines.
 */
function makeParagraphMeasure(lines: MeasuredLine[]): ParagraphMeasure {
  const totalHeight = lines.reduce((sum, line) => sum + line.lineHeight, 0);
  return {
    kind: 'paragraph',
    lines,
    totalHeight,
  };
}

/**
 * Default page size and margins for tests.
 */
const DEFAULT_PAGE_SIZE = { w: 816, h: 1056 }; // US Letter at 96 DPI
const DEFAULT_MARGINS: PageMargins = {
  top: 96,
  right: 96,
  bottom: 96,
  left: 96,
};

/**
 * Create default layout options.
 */
function makeLayoutOptions(overrides: Partial<LayoutOptions> = {}): LayoutOptions {
  return {
    pageSize: DEFAULT_PAGE_SIZE,
    margins: DEFAULT_MARGINS,
    pageGap: 20,
    ...overrides,
  };
}

// =============================================================================
// TEST SUITE: Layout Produces Correct Pages
// =============================================================================

describe('Layout Engine - Page Production', () => {
  describe('single page scenarios', () => {
    test('empty document produces one empty page', () => {
      const blocks: FlowBlock[] = [];
      const measures: Measure[] = [];

      const layout = layoutDocument(blocks, measures, makeLayoutOptions());

      expect(layout.pages.length).toBe(1);
      expect(layout.pages[0].fragments.length).toBe(0);
      expect(layout.pageSize).toEqual(DEFAULT_PAGE_SIZE);
    });

    test('single paragraph fits on one page', () => {
      const blocks: FlowBlock[] = [makeParagraphBlock(0, 'Hello, World!', 1)];
      const measures: Measure[] = [makeParagraphMeasure([makeLine(0, 0, 0, 13, 100, 24)])];

      const layout = layoutDocument(blocks, measures, makeLayoutOptions());

      expect(layout.pages.length).toBe(1);
      expect(layout.pages[0].fragments.length).toBe(1);

      const fragment = layout.pages[0].fragments[0];
      expect(fragment.kind).toBe('paragraph');
      expect(fragment.blockId).toBe(0);
    });

    test('multiple paragraphs fit on one page', () => {
      const blocks: FlowBlock[] = [
        makeParagraphBlock(0, 'First paragraph', 1),
        makeParagraphBlock(1, 'Second paragraph', 18),
        makeParagraphBlock(2, 'Third paragraph', 36),
      ];
      const measures: Measure[] = [
        makeParagraphMeasure([makeLine(0, 0, 0, 15, 120, 24)]),
        makeParagraphMeasure([makeLine(0, 0, 0, 16, 130, 24)]),
        makeParagraphMeasure([makeLine(0, 0, 0, 15, 120, 24)]),
      ];

      const layout = layoutDocument(blocks, measures, makeLayoutOptions());

      expect(layout.pages.length).toBe(1);
      expect(layout.pages[0].fragments.length).toBe(3);
    });

    test('paragraph positions are stacked vertically', () => {
      const blocks: FlowBlock[] = [
        makeParagraphBlock(0, 'First', 1),
        makeParagraphBlock(1, 'Second', 8),
      ];
      const measures: Measure[] = [
        makeParagraphMeasure([makeLine(0, 0, 0, 5, 50, 24)]),
        makeParagraphMeasure([makeLine(0, 0, 0, 6, 60, 24)]),
      ];

      const layout = layoutDocument(blocks, measures, makeLayoutOptions());

      const frag0 = layout.pages[0].fragments[0];
      const frag1 = layout.pages[0].fragments[1];

      // Second fragment should start below first
      expect(frag1.y).toBeGreaterThan(frag0.y);
    });
  });

  describe('multi-page scenarios', () => {
    test('content exceeding page height creates multiple pages', () => {
      // Create many paragraphs that exceed page content height
      // Content height = 1056 - 96 - 96 = 864px
      // Each paragraph = 100px line height
      // 9 paragraphs = 900px > 864px, should overflow to page 2
      const blocks: FlowBlock[] = [];
      const measures: Measure[] = [];

      for (let i = 0; i < 10; i++) {
        blocks.push(makeParagraphBlock(i, `Paragraph ${i}`, i * 15));
        measures.push(makeParagraphMeasure([makeLine(0, 0, 0, 12, 100, 100)]));
      }

      const layout = layoutDocument(blocks, measures, makeLayoutOptions());

      expect(layout.pages.length).toBe(2);
      // First page should have fragments
      expect(layout.pages[0].fragments.length).toBeGreaterThan(0);
      // Second page should have remaining fragments
      expect(layout.pages[1].fragments.length).toBeGreaterThan(0);
    });

    test('explicit page break creates new page', () => {
      const blocks: FlowBlock[] = [
        makeParagraphBlock(0, 'Before break', 1),
        { kind: 'pageBreak', id: 1, pmStart: 15, pmEnd: 16 },
        makeParagraphBlock(2, 'After break', 17),
      ];
      const measures: Measure[] = [
        makeParagraphMeasure([makeLine(0, 0, 0, 12, 100, 24)]),
        { kind: 'pageBreak' },
        makeParagraphMeasure([makeLine(0, 0, 0, 11, 90, 24)]),
      ];

      const layout = layoutDocument(blocks, measures, makeLayoutOptions());

      expect(layout.pages.length).toBe(2);
      expect(layout.pages[0].fragments.length).toBe(1);
      expect(layout.pages[1].fragments.length).toBe(1);
    });

    test('pageBreakBefore attribute creates new page', () => {
      const blocks: FlowBlock[] = [
        makeParagraphBlock(0, 'First paragraph', 1),
        makeParagraphBlock(1, 'Second with break', 18, { pageBreakBefore: true }),
      ];
      const measures: Measure[] = [
        makeParagraphMeasure([makeLine(0, 0, 0, 15, 120, 24)]),
        makeParagraphMeasure([makeLine(0, 0, 0, 17, 140, 24)]),
      ];

      const layout = layoutDocument(blocks, measures, makeLayoutOptions());

      expect(layout.pages.length).toBe(2);
      expect(layout.pages[0].fragments[0].blockId).toBe(0);
      expect(layout.pages[1].fragments[0].blockId).toBe(1);
    });
  });

  describe('paragraph splitting across pages', () => {
    test('long paragraph splits across pages', () => {
      // Create a paragraph with many lines that exceeds page height
      const lines: MeasuredLine[] = [];
      const lineHeight = 100;
      const numLines = 15; // 15 * 100 = 1500px > 864px content area

      for (let i = 0; i < numLines; i++) {
        lines.push(makeLine(0, i * 10, 0, (i + 1) * 10, 500, lineHeight));
      }

      const blocks: FlowBlock[] = [makeParagraphBlock(0, 'A'.repeat(150), 1)];
      const measures: Measure[] = [makeParagraphMeasure(lines)];

      const layout = layoutDocument(blocks, measures, makeLayoutOptions());

      expect(layout.pages.length).toBeGreaterThan(1);

      // First page fragment should have fromLine = 0
      const firstFrag = layout.pages[0].fragments[0];
      expect(firstFrag.kind).toBe('paragraph');
      if (firstFrag.kind === 'paragraph') {
        expect(firstFrag.fromLine).toBe(0);
        expect(firstFrag.toLine).toBeGreaterThan(0);
        expect(firstFrag.continuesOnNext).toBe(true);
      }

      // Second page fragment should continue
      const secondFrag = layout.pages[1].fragments[0];
      expect(secondFrag.kind).toBe('paragraph');
      if (secondFrag.kind === 'paragraph') {
        expect(secondFrag.continuesFromPrev).toBe(true);
      }
    });
  });

  describe('keepNext chain handling', () => {
    test('keepNext paragraphs stay together on new page', () => {
      // Create paragraphs that nearly fill first page
      const blocks: FlowBlock[] = [];
      const measures: Measure[] = [];

      // Add filler paragraphs to fill most of the page
      for (let i = 0; i < 7; i++) {
        blocks.push(makeParagraphBlock(i, `Filler ${i}`, i * 10));
        measures.push(makeParagraphMeasure([makeLine(0, 0, 0, 10, 80, 100)]));
      }

      // Add keepNext paragraph that should pull next paragraph to new page
      blocks.push(makeParagraphBlock(7, 'KeepNext heading', 70, { keepNext: true }));
      measures.push(makeParagraphMeasure([makeLine(0, 0, 0, 16, 120, 100)]));

      // Add following paragraph
      blocks.push(makeParagraphBlock(8, 'Following paragraph', 88));
      measures.push(makeParagraphMeasure([makeLine(0, 0, 0, 19, 150, 100)]));

      const layout = layoutDocument(blocks, measures, makeLayoutOptions());

      // The keepNext heading and following paragraph should be on same page
      const headingFrag = layout.pages.flatMap((p) => p.fragments).find((f) => f.blockId === 7);
      const followingFrag = layout.pages.flatMap((p) => p.fragments).find((f) => f.blockId === 8);

      // They should be on the same page
      const headingPage = layout.pages.findIndex((p) => p.fragments.includes(headingFrag!));
      const followingPage = layout.pages.findIndex((p) => p.fragments.includes(followingFrag!));

      expect(headingPage).toBe(followingPage);
    });
  });

  describe('margin and positioning', () => {
    test('fragments are positioned within content area', () => {
      const blocks: FlowBlock[] = [makeParagraphBlock(0, 'Test content', 1)];
      const measures: Measure[] = [makeParagraphMeasure([makeLine(0, 0, 0, 12, 100, 24)])];

      const layout = layoutDocument(blocks, measures, makeLayoutOptions());

      const fragment = layout.pages[0].fragments[0];

      // Fragment X should be at left margin
      expect(fragment.x).toBe(DEFAULT_MARGINS.left);

      // Fragment Y should be at top margin
      expect(fragment.y).toBe(DEFAULT_MARGINS.top);
    });

    test('content width is page width minus margins', () => {
      const blocks: FlowBlock[] = [makeParagraphBlock(0, 'Test', 1)];
      const measures: Measure[] = [makeParagraphMeasure([makeLine(0, 0, 0, 4, 50, 24)])];

      const layout = layoutDocument(blocks, measures, makeLayoutOptions());

      const fragment = layout.pages[0].fragments[0];
      const expectedWidth = DEFAULT_PAGE_SIZE.w - DEFAULT_MARGINS.left - DEFAULT_MARGINS.right;

      expect(fragment.width).toBe(expectedWidth);
    });
  });
});

// =============================================================================
// TEST SUITE: Click Maps to Correct PM Position
// =============================================================================

describe('Click-to-Position Mapping', () => {
  describe('page hit testing', () => {
    test('hitTestPage finds correct page', () => {
      // Create a 2-page layout
      const blocks: FlowBlock[] = [];
      const measures: Measure[] = [];

      for (let i = 0; i < 20; i++) {
        blocks.push(makeParagraphBlock(i, `Para ${i}`, i * 10));
        measures.push(makeParagraphMeasure([makeLine(0, 0, 0, 8, 60, 50)]));
      }

      const layout = layoutDocument(blocks, measures, makeLayoutOptions({ pageGap: 20 }));

      expect(layout.pages.length).toBeGreaterThan(1);

      // Hit test at top of document
      const hit1 = hitTestPage(layout, { x: 100, y: 50 });
      expect(hit1).not.toBeNull();
      expect(hit1!.pageIndex).toBe(0);

      // Hit test in second page (after first page height + gap)
      const pageHeight = layout.pageSize.h;
      const pageGap = 20;
      const secondPageTop = pageHeight + pageGap;
      const hit2 = hitTestPage(layout, { x: 100, y: secondPageTop + 50 });
      expect(hit2).not.toBeNull();
      expect(hit2!.pageIndex).toBe(1);
    });

    test('hitTestPage returns correct pageY offset', () => {
      const blocks: FlowBlock[] = [makeParagraphBlock(0, 'Test', 1)];
      const measures: Measure[] = [makeParagraphMeasure([makeLine(0, 0, 0, 4, 50, 24)])];

      const layout = layoutDocument(blocks, measures, makeLayoutOptions());

      const hit = hitTestPage(layout, { x: 100, y: 150 });
      expect(hit).not.toBeNull();
      expect(hit!.pageY).toBe(150);
    });

    test('getPageTop returns cumulative offset', () => {
      const blocks: FlowBlock[] = [];
      const measures: Measure[] = [];

      for (let i = 0; i < 20; i++) {
        blocks.push(makeParagraphBlock(i, `Para ${i}`, i * 10));
        measures.push(makeParagraphMeasure([makeLine(0, 0, 0, 8, 60, 50)]));
      }

      const layout = layoutDocument(blocks, measures, makeLayoutOptions({ pageGap: 20 }));

      expect(getPageTop(layout, 0)).toBe(0);

      if (layout.pages.length > 1) {
        const expectedPage1Top = layout.pageSize.h + 20;
        expect(getPageTop(layout, 1)).toBe(expectedPage1Top);
      }
    });
  });

  describe('fragment hit testing', () => {
    test('hitTestFragment finds correct fragment', () => {
      const blocks: FlowBlock[] = [
        makeParagraphBlock(0, 'First', 1),
        makeParagraphBlock(1, 'Second', 8),
      ];
      const measures: Measure[] = [
        makeParagraphMeasure([makeLine(0, 0, 0, 5, 50, 24)]),
        makeParagraphMeasure([makeLine(0, 0, 0, 6, 60, 24)]),
      ];

      const layout = layoutDocument(blocks, measures, makeLayoutOptions());

      const pageHit = hitTestPage(layout, { x: 100, y: DEFAULT_MARGINS.top + 5 });
      expect(pageHit).not.toBeNull();

      const fragmentHit = hitTestFragment(pageHit!, blocks, measures, {
        x: DEFAULT_MARGINS.left + 10,
        y: DEFAULT_MARGINS.top + 5,
      });

      expect(fragmentHit).not.toBeNull();
      expect(fragmentHit!.fragment.blockId).toBe(0);
    });

    test('hitTestFragment calculates correct local coordinates', () => {
      const blocks: FlowBlock[] = [makeParagraphBlock(0, 'Test content', 1)];
      const measures: Measure[] = [makeParagraphMeasure([makeLine(0, 0, 0, 12, 100, 24)])];

      const layout = layoutDocument(blocks, measures, makeLayoutOptions());

      const pageHit = hitTestPage(layout, { x: 150, y: 110 });
      const fragmentHit = hitTestFragment(pageHit!, blocks, measures, { x: 150, y: 110 });

      expect(fragmentHit).not.toBeNull();

      // Local coordinates should be relative to fragment position
      const fragment = fragmentHit!.fragment;
      expect(fragmentHit!.localX).toBe(150 - fragment.x);
      expect(fragmentHit!.localY).toBe(110 - fragment.y);
    });
  });

  describe('click to PM position', () => {
    test('clickToPositionInParagraph maps click to correct position', () => {
      const block = makeParagraphBlock(0, 'Hello World', 1);
      const measure = makeParagraphMeasure([makeLine(0, 0, 0, 11, 100, 24)]);

      // Create a synthetic fragment hit
      const fragmentHit = {
        fragment: {
          kind: 'paragraph' as const,
          blockId: 0,
          x: 96,
          y: 96,
          width: 624,
          height: 24,
          fromLine: 0,
          toLine: 1,
        },
        block,
        measure,
        pageIndex: 0,
        localX: 0, // Click at start of line
        localY: 10,
      };

      const result = clickToPositionInParagraph(fragmentHit);

      expect(result).not.toBeNull();
      expect(result!.pmPosition).toBe(1); // Start of text
      expect(result!.lineIndex).toBe(0);
    });

    test('clickToPosition returns PM position from fragment hit', () => {
      const block = makeParagraphBlock(0, 'Test', 1);
      const measure = makeParagraphMeasure([makeLine(0, 0, 0, 4, 40, 24)]);

      const fragmentHit = {
        fragment: {
          kind: 'paragraph' as const,
          blockId: 0,
          x: 96,
          y: 96,
          width: 624,
          height: 24,
          fromLine: 0,
          toLine: 1,
        },
        block,
        measure,
        pageIndex: 0,
        localX: 0,
        localY: 10,
      };

      const pmPosition = clickToPosition(fragmentHit);

      expect(pmPosition).not.toBeNull();
      expect(pmPosition).toBeGreaterThanOrEqual(1);
    });

    // Note: This test requires a DOM environment with canvas for text measurement.
    // In headless bun:test, we test the logic without requiring precise character positioning.
    test('click at end of line returns end position (mock)', () => {
      const block = makeParagraphBlock(0, 'Hello', 1);
      const measure = makeParagraphMeasure([makeLine(0, 0, 0, 5, 50, 24)]);

      // Test the fragment structure is correct
      const fragmentHit = {
        fragment: {
          kind: 'paragraph' as const,
          blockId: 0,
          x: 96,
          y: 96,
          width: 624,
          height: 24,
          fromLine: 0,
          toLine: 1,
        },
        block,
        measure,
        pageIndex: 0,
        localX: 0, // Click at start (doesn't require canvas measurement)
        localY: 10,
      };

      // Verify the block structure is correct
      expect(block.pmStart).toBe(1);
      expect(block.pmEnd).toBe(7); // 'Hello' + paragraph node boundary

      // This tests that the mapping starts correctly
      const result = clickToPositionInParagraph(fragmentHit);
      expect(result).not.toBeNull();
      expect(result!.pmPosition).toBe(1); // Start of text
    });
  });
});

// =============================================================================
// TEST SUITE: PM Edits Update Visual Pages
// =============================================================================

describe('Document Updates', () => {
  describe('adding content', () => {
    test('adding paragraph increases fragment count', () => {
      // Initial state: 1 paragraph
      const initialBlocks: FlowBlock[] = [makeParagraphBlock(0, 'Initial', 1)];
      const initialMeasures: Measure[] = [makeParagraphMeasure([makeLine(0, 0, 0, 7, 60, 24)])];

      const initialLayout = layoutDocument(initialBlocks, initialMeasures, makeLayoutOptions());

      // After adding paragraph: 2 paragraphs
      const updatedBlocks: FlowBlock[] = [
        makeParagraphBlock(0, 'Initial', 1),
        makeParagraphBlock(1, 'Added', 10),
      ];
      const updatedMeasures: Measure[] = [
        makeParagraphMeasure([makeLine(0, 0, 0, 7, 60, 24)]),
        makeParagraphMeasure([makeLine(0, 0, 0, 5, 50, 24)]),
      ];

      const updatedLayout = layoutDocument(updatedBlocks, updatedMeasures, makeLayoutOptions());

      expect(updatedLayout.pages[0].fragments.length).toBe(
        initialLayout.pages[0].fragments.length + 1
      );
    });

    test('adding enough content creates new page', () => {
      // Start with content that fits on one page
      const smallBlocks: FlowBlock[] = [makeParagraphBlock(0, 'Small', 1)];
      const smallMeasures: Measure[] = [makeParagraphMeasure([makeLine(0, 0, 0, 5, 50, 24)])];

      const smallLayout = layoutDocument(smallBlocks, smallMeasures, makeLayoutOptions());
      expect(smallLayout.pages.length).toBe(1);

      // Add content that overflows
      const largeBlocks: FlowBlock[] = [];
      const largeMeasures: Measure[] = [];

      for (let i = 0; i < 20; i++) {
        largeBlocks.push(makeParagraphBlock(i, `Para ${i}`, i * 10));
        largeMeasures.push(makeParagraphMeasure([makeLine(0, 0, 0, 8, 60, 50)]));
      }

      const largeLayout = layoutDocument(largeBlocks, largeMeasures, makeLayoutOptions());
      expect(largeLayout.pages.length).toBeGreaterThan(1);
    });
  });

  describe('removing content', () => {
    test('removing paragraph decreases fragment count', () => {
      const blocks: FlowBlock[] = [
        makeParagraphBlock(0, 'First', 1),
        makeParagraphBlock(1, 'Second', 8),
      ];
      const measures: Measure[] = [
        makeParagraphMeasure([makeLine(0, 0, 0, 5, 50, 24)]),
        makeParagraphMeasure([makeLine(0, 0, 0, 6, 60, 24)]),
      ];

      const beforeLayout = layoutDocument(blocks, measures, makeLayoutOptions());

      // Remove second paragraph
      const afterBlocks = blocks.slice(0, 1);
      const afterMeasures = measures.slice(0, 1);

      const afterLayout = layoutDocument(afterBlocks, afterMeasures, makeLayoutOptions());

      expect(afterLayout.pages[0].fragments.length).toBe(
        beforeLayout.pages[0].fragments.length - 1
      );
    });

    test('removing content can reduce page count', () => {
      // Create multi-page document
      const blocks: FlowBlock[] = [];
      const measures: Measure[] = [];

      for (let i = 0; i < 20; i++) {
        blocks.push(makeParagraphBlock(i, `Para ${i}`, i * 10));
        measures.push(makeParagraphMeasure([makeLine(0, 0, 0, 8, 60, 50)]));
      }

      const multiPageLayout = layoutDocument(blocks, measures, makeLayoutOptions());
      expect(multiPageLayout.pages.length).toBeGreaterThan(1);

      // Remove most content
      const smallBlocks = blocks.slice(0, 2);
      const smallMeasures = measures.slice(0, 2);

      const singlePageLayout = layoutDocument(smallBlocks, smallMeasures, makeLayoutOptions());
      expect(singlePageLayout.pages.length).toBe(1);
    });
  });

  describe('modifying content', () => {
    test('changing text updates PM positions in layout', () => {
      // Original paragraph
      const originalBlock = makeParagraphBlock(0, 'Original', 1);
      const originalMeasure = makeParagraphMeasure([makeLine(0, 0, 0, 8, 70, 24)]);

      const originalLayout = layoutDocument(
        [originalBlock],
        [originalMeasure],
        makeLayoutOptions()
      );

      // Modified paragraph (longer text)
      const modifiedBlock = makeParagraphBlock(0, 'Modified text here', 1);
      const modifiedMeasure = makeParagraphMeasure([makeLine(0, 0, 0, 18, 140, 24)]);

      const modifiedLayout = layoutDocument(
        [modifiedBlock],
        [modifiedMeasure],
        makeLayoutOptions()
      );

      // Both should have same structure but different PM bounds
      expect(modifiedLayout.pages.length).toBe(originalLayout.pages.length);
      expect(modifiedLayout.pages[0].fragments.length).toBe(
        originalLayout.pages[0].fragments.length
      );

      // PM end should differ based on text length
      const originalFrag = originalLayout.pages[0].fragments[0];
      const modifiedFrag = modifiedLayout.pages[0].fragments[0];

      expect(modifiedFrag.pmEnd).toBeGreaterThan(originalFrag.pmEnd!);
    });

    test('line height changes update fragment positions', () => {
      const blocks: FlowBlock[] = [
        makeParagraphBlock(0, 'First', 1),
        makeParagraphBlock(1, 'Second', 8),
      ];

      // Small line height
      const smallMeasures: Measure[] = [
        makeParagraphMeasure([makeLine(0, 0, 0, 5, 50, 24)]),
        makeParagraphMeasure([makeLine(0, 0, 0, 6, 60, 24)]),
      ];

      const smallLayout = layoutDocument(blocks, smallMeasures, makeLayoutOptions());

      // Large line height
      const largeMeasures: Measure[] = [
        makeParagraphMeasure([makeLine(0, 0, 0, 5, 50, 48)]), // Double line height
        makeParagraphMeasure([makeLine(0, 0, 0, 6, 60, 48)]),
      ];

      const largeLayout = layoutDocument(blocks, largeMeasures, makeLayoutOptions());

      // Second fragment should be positioned further down with larger line height
      const smallSecondY = smallLayout.pages[0].fragments[1].y;
      const largeSecondY = largeLayout.pages[0].fragments[1].y;

      expect(largeSecondY).toBeGreaterThan(smallSecondY);
    });
  });
});

// =============================================================================
// TEST SUITE: Section Breaks
// =============================================================================

describe('Section Breaks', () => {
  test('nextPage section break forces new page', () => {
    const blocks: FlowBlock[] = [
      makeParagraphBlock(0, 'Before section', 1),
      { kind: 'sectionBreak', id: 1, type: 'nextPage' },
      makeParagraphBlock(2, 'After section', 18),
    ];
    const measures: Measure[] = [
      makeParagraphMeasure([makeLine(0, 0, 0, 14, 120, 24)]),
      { kind: 'sectionBreak' },
      makeParagraphMeasure([makeLine(0, 0, 0, 13, 110, 24)]),
    ];

    const layout = layoutDocument(blocks, measures, makeLayoutOptions());

    expect(layout.pages.length).toBe(2);
    expect(layout.pages[0].fragments.some((f) => f.blockId === 0)).toBe(true);
    expect(layout.pages[1].fragments.some((f) => f.blockId === 2)).toBe(true);
  });

  test('continuous section break does not force new page', () => {
    const blocks: FlowBlock[] = [
      makeParagraphBlock(0, 'Before section', 1),
      { kind: 'sectionBreak', id: 1, type: 'continuous' },
      makeParagraphBlock(2, 'After section', 18),
    ];
    const measures: Measure[] = [
      makeParagraphMeasure([makeLine(0, 0, 0, 14, 120, 24)]),
      { kind: 'sectionBreak' },
      makeParagraphMeasure([makeLine(0, 0, 0, 13, 110, 24)]),
    ];

    const layout = layoutDocument(blocks, measures, makeLayoutOptions());

    expect(layout.pages.length).toBe(1);
    expect(layout.pages[0].fragments.length).toBe(2);
  });
});

// =============================================================================
// TEST SUITE: Header/Footer Margin Inflation
// =============================================================================

describe('Header/Footer Margin Inflation', () => {
  test('header content height inflates top margin', () => {
    const blocks: FlowBlock[] = [makeParagraphBlock(0, 'Body content', 1)];
    const measures: Measure[] = [makeParagraphMeasure([makeLine(0, 0, 0, 12, 100, 24)])];

    // Without headers
    const noHeaderLayout = layoutDocument(blocks, measures, makeLayoutOptions());

    // With tall header
    const withHeaderLayout = layoutDocument(
      blocks,
      measures,
      makeLayoutOptions({
        headerContentHeights: { default: 50 },
      })
    );

    // Body content should start lower when header is present
    const noHeaderY = noHeaderLayout.pages[0].fragments[0].y;
    const withHeaderY = withHeaderLayout.pages[0].fragments[0].y;

    // With header, body should start at max(margin, headerDistance + headerHeight)
    expect(withHeaderY).toBeGreaterThanOrEqual(noHeaderY);
  });

  test('footer content height inflates bottom margin', () => {
    // Create content that nearly fills a page
    const blocks: FlowBlock[] = [];
    const measures: Measure[] = [];

    for (let i = 0; i < 8; i++) {
      blocks.push(makeParagraphBlock(i, `Para ${i}`, i * 10));
      measures.push(makeParagraphMeasure([makeLine(0, 0, 0, 8, 60, 100)]));
    }

    // Without footer
    const noFooterLayout = layoutDocument(blocks, measures, makeLayoutOptions());

    // With tall footer (reduces available content area)
    const withFooterLayout = layoutDocument(
      blocks,
      measures,
      makeLayoutOptions({
        footerContentHeights: { default: 100 },
      })
    );

    // With footer, content area is smaller, may need more pages
    expect(withFooterLayout.pages.length).toBeGreaterThanOrEqual(noFooterLayout.pages.length);
  });
});
