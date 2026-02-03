/**
 * Performance Benchmarks for Layout Engine
 *
 * Measures layout and repaint performance to ensure responsive editing:
 * - Initial layout: <100ms for 10-page document
 * - Incremental update: <50ms for single character edit
 *
 * Run with: bun test src/layout-engine/performance.bench.ts
 */

import { describe, test, expect, beforeAll } from 'bun:test';

import { layoutDocument } from './index';
import type {
  ParagraphBlock,
  ParagraphMeasure,
  MeasuredLine,
  FlowBlock,
  Measure,
  LayoutOptions,
} from './types';

// =============================================================================
// PERFORMANCE TARGETS
// =============================================================================

/**
 * Performance targets from plan 06_paginated_editing.md
 */
const TARGETS = {
  /**
   * Initial layout should complete in <100ms for a 10-page document.
   * This ensures fast document loading and responsive resizing.
   */
  layoutTime: 100, // ms

  /**
   * Incremental update should complete in <50ms for a single character edit.
   * This ensures responsive typing without visible lag.
   */
  incrementalTime: 50, // ms
} as const;

/**
 * Number of warmup iterations before measuring.
 * This allows JIT compilation to optimize the code.
 */
const WARMUP_ITERATIONS = 3;

/**
 * Number of measurement iterations for statistical accuracy.
 */
const MEASURE_ITERATIONS = 10;

// =============================================================================
// BENCHMARK HELPERS
// =============================================================================

/**
 * Create a paragraph block with specified text content.
 */
function makeParagraphBlock(id: number, text: string, pmStart: number): ParagraphBlock {
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
    attrs: {},
    pmStart,
    pmEnd: pmStart + text.length + 1,
  };
}

/**
 * Create a measured line with typical dimensions.
 */
function makeLine(
  fromRun: number,
  fromChar: number,
  toRun: number,
  toChar: number,
  width: number
): MeasuredLine {
  const lineHeight = 18; // Typical line height in pixels
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
 * Generate a multi-page document with realistic content.
 *
 * US Letter at 96 DPI:
 * - Page height: 1056px
 * - Margins: 96px top + 96px bottom
 * - Content height: 864px
 * - Lines per page at 18px: ~48 lines
 *
 * For a 10-page document with ~500 paragraphs (50/page), each paragraph ~1 line.
 */
function generateTenPageDocument(): { blocks: FlowBlock[]; measures: Measure[] } {
  const blocks: FlowBlock[] = [];
  const measures: Measure[] = [];

  // Calculate to fill about 10 pages
  // Page height - margins = 1056 - 192 = 864px content area
  // At 18px per line, that's ~48 lines per page
  // We'll create 500 single-line paragraphs, which gives us ~10 pages
  const totalParagraphs = 500;

  let pmStart = 0;

  for (let i = 0; i < totalParagraphs; i++) {
    // Create paragraph text
    const textLength = 60; // Fixed length for predictability
    const text = 'Lorem ipsum dolor sit amet consectetur. '.slice(0, textLength);

    const block = makeParagraphBlock(i, text, pmStart);
    blocks.push(block);

    // Single line measure
    const lines = [makeLine(0, 0, 0, textLength, textLength * 7)];
    measures.push(makeParagraphMeasure(lines));

    // Advance PM position
    pmStart += textLength + 1;
  }

  return { blocks, measures };
}

/**
 * Calculate statistics from a set of timing values.
 */
function calculateStats(values: number[]): {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
  };
}

/**
 * Run a function multiple times and measure timing.
 */
function benchmark(
  fn: () => void,
  warmupIterations: number,
  measureIterations: number
): { stats: ReturnType<typeof calculateStats>; timings: number[] } {
  // Warmup (allows JIT optimization)
  for (let i = 0; i < warmupIterations; i++) {
    fn();
  }

  // Measure
  const timings: number[] = [];
  for (let i = 0; i < measureIterations; i++) {
    const start = performance.now();
    fn();
    const elapsed = performance.now() - start;
    timings.push(elapsed);
  }

  return {
    stats: calculateStats(timings),
    timings,
  };
}

// =============================================================================
// LAYOUT OPTIONS
// =============================================================================

const DEFAULT_OPTIONS: LayoutOptions = {
  pageSize: { w: 816, h: 1056 }, // US Letter at 96 DPI
  margins: {
    top: 96,
    right: 96,
    bottom: 96,
    left: 96,
  },
};

// =============================================================================
// BENCHMARKS
// =============================================================================

describe('Layout Engine Performance', () => {
  let tenPageDoc: { blocks: FlowBlock[]; measures: Measure[] };

  beforeAll(() => {
    // Generate test document once before all tests
    tenPageDoc = generateTenPageDocument();
  });

  describe('Initial Layout', () => {
    test('10-page document layout time', () => {
      const { stats } = benchmark(
        () => layoutDocument(tenPageDoc.blocks, tenPageDoc.measures, DEFAULT_OPTIONS),
        WARMUP_ITERATIONS,
        MEASURE_ITERATIONS
      );

      // Log results for debugging
      console.log('\n10-page layout performance:');
      console.log(`  Blocks: ${tenPageDoc.blocks.length}`);
      console.log(`  Min: ${stats.min.toFixed(2)}ms`);
      console.log(`  Max: ${stats.max.toFixed(2)}ms`);
      console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
      console.log(`  Median: ${stats.median.toFixed(2)}ms`);
      console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
      console.log(`  Target: <${TARGETS.layoutTime}ms`);

      // Verify layout produces expected output (around 10 pages, give or take due to spacing)
      const layout = layoutDocument(tenPageDoc.blocks, tenPageDoc.measures, DEFAULT_OPTIONS);
      expect(layout.pages.length).toBeGreaterThanOrEqual(8);
      // With 500 paragraphs at 18px each + spacing, we may get more than 10 pages
      expect(layout.pages.length).toBeLessThanOrEqual(20);

      // Check median time is within target (more stable than mean)
      expect(stats.median).toBeLessThanOrEqual(TARGETS.layoutTime);
    });

    test('layout scales linearly with document size', () => {
      // Measure for various document sizes
      const sizes = [50, 100, 200, 400];
      const timePerBlock: number[] = [];

      for (const size of sizes) {
        const doc = generateNParagraphDocument(size);
        const { stats } = benchmark(
          () => layoutDocument(doc.blocks, doc.measures, DEFAULT_OPTIONS),
          2,
          5
        );
        timePerBlock.push(stats.median / size);
      }

      // Log results
      console.log('\nLayout scaling:');
      sizes.forEach((size, i) => {
        console.log(`  ${size} paragraphs: ${(timePerBlock[i] * 1000).toFixed(3)}µs/paragraph`);
      });

      // Time per block should be relatively stable (within 3x of smallest)
      const minTime = Math.min(...timePerBlock);
      const maxTime = Math.max(...timePerBlock);
      expect(maxTime / minTime).toBeLessThanOrEqual(3);
    });
  });

  describe('Incremental Update', () => {
    test('single character edit repaint time', () => {
      // First, do initial layout
      const layout = layoutDocument(tenPageDoc.blocks, tenPageDoc.measures, DEFAULT_OPTIONS);
      const originalPageCount = layout.pages.length;

      // Create modified document (simulate single char edit in first paragraph)
      const modifiedBlocks = [...tenPageDoc.blocks];
      const originalBlock = modifiedBlocks[0] as ParagraphBlock;
      const firstRun = originalBlock.runs[0];

      // Only modify if it's a text run
      if (firstRun.kind !== 'text') {
        throw new Error('Expected first run to be text');
      }

      const originalText = firstRun.text;

      // Add one character
      modifiedBlocks[0] = {
        ...originalBlock,
        runs: [
          {
            ...firstRun,
            text: originalText + 'X',
            pmEnd: (firstRun.pmEnd ?? 0) + 1,
          },
        ],
        pmEnd: (originalBlock.pmEnd ?? 0) + 1,
      };

      // Measure incremental layout time
      const { stats } = benchmark(
        () => layoutDocument(modifiedBlocks, tenPageDoc.measures, DEFAULT_OPTIONS),
        WARMUP_ITERATIONS,
        MEASURE_ITERATIONS
      );

      console.log('\nIncremental update performance (single char):');
      console.log(`  Min: ${stats.min.toFixed(2)}ms`);
      console.log(`  Max: ${stats.max.toFixed(2)}ms`);
      console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
      console.log(`  Median: ${stats.median.toFixed(2)}ms`);
      console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
      console.log(`  Target: <${TARGETS.incrementalTime}ms`);

      // Verify layout still produces correct output
      const newLayout = layoutDocument(modifiedBlocks, tenPageDoc.measures, DEFAULT_OPTIONS);
      // Page count should stay the same for a single char edit
      expect(newLayout.pages.length).toBe(originalPageCount);

      // Check median time is within target
      expect(stats.median).toBeLessThanOrEqual(TARGETS.incrementalTime);
    });

    test('paragraph insertion repaint time', () => {
      // Create document with new paragraph inserted in the middle
      const modifiedBlocks = [...tenPageDoc.blocks];
      const modifiedMeasures = [...tenPageDoc.measures];

      // Insert new paragraph at position 250 (middle of document)
      const insertPos = 250;
      // Get the block at insert position
      const blockAtInsert = modifiedBlocks[insertPos];
      const pmStartForNewBlock = (blockAtInsert as ParagraphBlock).pmStart ?? 0;

      const newBlock = makeParagraphBlock(
        9999,
        'Newly inserted paragraph with some text content.',
        pmStartForNewBlock
      );
      const newMeasure = makeParagraphMeasure([makeLine(0, 0, 0, 48, 384)]);

      modifiedBlocks.splice(insertPos, 0, newBlock);
      modifiedMeasures.splice(insertPos, 0, newMeasure);

      const { stats } = benchmark(
        () => layoutDocument(modifiedBlocks, modifiedMeasures, DEFAULT_OPTIONS),
        WARMUP_ITERATIONS,
        MEASURE_ITERATIONS
      );

      console.log('\nIncremental update performance (paragraph insert):');
      console.log(`  Min: ${stats.min.toFixed(2)}ms`);
      console.log(`  Max: ${stats.max.toFixed(2)}ms`);
      console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
      console.log(`  Median: ${stats.median.toFixed(2)}ms`);
      console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
      console.log(`  Target: <${TARGETS.incrementalTime}ms`);

      // Verify layout produces output
      const layout = layoutDocument(modifiedBlocks, modifiedMeasures, DEFAULT_OPTIONS);
      expect(layout.pages.length).toBeGreaterThanOrEqual(9);

      // Paragraph insertion might take slightly longer but should still be fast
      // Allow 2x the incremental target for insertion
      expect(stats.median).toBeLessThanOrEqual(TARGETS.incrementalTime * 2);
    });
  });

  describe('Edge Cases', () => {
    test('empty document layout is fast', () => {
      const { stats } = benchmark(
        () => layoutDocument([], [], DEFAULT_OPTIONS),
        WARMUP_ITERATIONS,
        MEASURE_ITERATIONS
      );

      console.log('\nEmpty document layout:');
      console.log(`  Median: ${stats.median.toFixed(3)}ms`);

      // Empty document should be nearly instant (<1ms)
      expect(stats.median).toBeLessThanOrEqual(1);
    });

    test('single paragraph layout is fast', () => {
      const blocks = [makeParagraphBlock(0, 'Hello, World!', 0)];
      const measures = [makeParagraphMeasure([makeLine(0, 0, 0, 13, 104)])];

      const { stats } = benchmark(
        () => layoutDocument(blocks, measures, DEFAULT_OPTIONS),
        WARMUP_ITERATIONS,
        MEASURE_ITERATIONS
      );

      console.log('\nSingle paragraph layout:');
      console.log(`  Median: ${stats.median.toFixed(3)}ms`);

      // Single paragraph should be very fast (<5ms)
      expect(stats.median).toBeLessThanOrEqual(5);
    });

    test('layout with keepNext chains', () => {
      // Create document with many keepNext chains
      const blocks: FlowBlock[] = [];
      const measures: Measure[] = [];

      // 100 chains of 3 paragraphs each
      for (let chain = 0; chain < 100; chain++) {
        for (let para = 0; para < 3; para++) {
          const id = chain * 3 + para;
          const isLast = para === 2;
          const block: ParagraphBlock = {
            kind: 'paragraph',
            id,
            runs: [
              {
                kind: 'text',
                text: `Chain ${chain} para ${para}`,
                pmStart: id * 20,
                pmEnd: id * 20 + 18,
              },
            ],
            attrs: { keepNext: !isLast },
            pmStart: id * 20,
            pmEnd: id * 20 + 19,
          };
          blocks.push(block);
          measures.push(makeParagraphMeasure([makeLine(0, 0, 0, 18, 144)]));
        }
      }

      const { stats } = benchmark(
        () => layoutDocument(blocks, measures, DEFAULT_OPTIONS),
        WARMUP_ITERATIONS,
        MEASURE_ITERATIONS
      );

      console.log('\nLayout with 100 keepNext chains:');
      console.log(`  Blocks: ${blocks.length}`);
      console.log(`  Median: ${stats.median.toFixed(2)}ms`);

      // Should still complete within layout target (keepNext adds overhead)
      expect(stats.median).toBeLessThanOrEqual(TARGETS.layoutTime);
    });

    test('layout with page breaks', () => {
      // Create document with explicit page breaks
      const blocks: FlowBlock[] = [];
      const measures: Measure[] = [];

      // 10 pages with explicit page breaks
      for (let page = 0; page < 10; page++) {
        const block: ParagraphBlock = {
          kind: 'paragraph',
          id: page,
          runs: [
            {
              kind: 'text',
              text: `Page ${page + 1} content`,
              pmStart: page * 20,
              pmEnd: page * 20 + 16,
            },
          ],
          attrs: { pageBreakBefore: page > 0 },
          pmStart: page * 20,
          pmEnd: page * 20 + 17,
        };
        blocks.push(block);
        measures.push(makeParagraphMeasure([makeLine(0, 0, 0, 16, 128)]));
      }

      const { stats } = benchmark(
        () => layoutDocument(blocks, measures, DEFAULT_OPTIONS),
        WARMUP_ITERATIONS,
        MEASURE_ITERATIONS
      );

      console.log('\nLayout with 10 explicit page breaks:');
      console.log(`  Median: ${stats.median.toFixed(3)}ms`);

      // Verify page count
      const layout = layoutDocument(blocks, measures, DEFAULT_OPTIONS);
      expect(layout.pages.length).toBe(10);

      // Should be very fast with explicit breaks
      expect(stats.median).toBeLessThanOrEqual(10);
    });
  });
});

// =============================================================================
// HELPER: Generate N-paragraph document
// =============================================================================

function generateNParagraphDocument(n: number): { blocks: FlowBlock[]; measures: Measure[] } {
  const blocks: FlowBlock[] = [];
  const measures: Measure[] = [];

  let pmStart = 0;

  for (let i = 0; i < n; i++) {
    const textLength = 50;
    const text = 'Lorem ipsum dolor sit amet consectetur. '.slice(0, textLength);

    blocks.push(makeParagraphBlock(i, text, pmStart));
    measures.push(makeParagraphMeasure([makeLine(0, 0, 0, textLength, 400)]));

    pmStart += textLength + 1;
  }

  return { blocks, measures };
}
