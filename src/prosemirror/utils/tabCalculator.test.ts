/**
 * Tab Calculator Unit Tests
 */

import { describe, expect, it } from 'bun:test';
import {
  twipsToPixels,
  pixelsToTwips,
  computeTabStops,
  calculateTabWidth,
  calculateSimpleTabWidth,
} from './tabCalculator';

describe('twipsToPixels', () => {
  it('converts 1440 twips (1 inch) to 96 pixels', () => {
    expect(twipsToPixels(1440)).toBe(96);
  });

  it('converts 720 twips (0.5 inch) to 48 pixels', () => {
    expect(twipsToPixels(720)).toBe(48);
  });

  it('converts 0 twips to 0 pixels', () => {
    expect(twipsToPixels(0)).toBe(0);
  });
});

describe('pixelsToTwips', () => {
  it('converts 96 pixels to 1440 twips', () => {
    expect(pixelsToTwips(96)).toBe(1440);
  });

  it('converts 48 pixels to 720 twips', () => {
    expect(pixelsToTwips(48)).toBe(720);
  });
});

describe('computeTabStops', () => {
  it('generates default stops at 720 twip intervals', () => {
    const stops = computeTabStops({});
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[0].pos).toBe(720);
    expect(stops[1].pos).toBe(1440);
    expect(stops[2].pos).toBe(2160);
  });

  it('respects custom default interval', () => {
    const stops = computeTabStops({ defaultTabInterval: 1440 });
    expect(stops[0].pos).toBe(1440);
    expect(stops[1].pos).toBe(2880);
  });

  it('includes explicit stops', () => {
    const stops = computeTabStops({
      explicitStops: [
        { val: 'center', pos: 1000 },
        { val: 'end', pos: 2000 },
      ],
    });

    const centerStop = stops.find((s) => s.val === 'center' && s.pos === 1000);
    const endStop = stops.find((s) => s.val === 'end' && s.pos === 2000);

    expect(centerStop).toBeDefined();
    expect(endStop).toBeDefined();
  });

  it('filters out clear stops but removes default stops at cleared positions', () => {
    const stops = computeTabStops({
      explicitStops: [
        { val: 'clear', pos: 720 }, // Clear the first default stop
      ],
    });

    // First default stop should not be at 720
    expect(stops[0].pos).not.toBe(720);
  });

  it('filters stops before left indent', () => {
    const stops = computeTabStops({
      explicitStops: [
        { val: 'start', pos: 100 }, // Before indent
        { val: 'center', pos: 1000 }, // After indent
      ],
      leftIndent: 500,
    });

    // The stop at 100 should be filtered out
    const stop100 = stops.find((s) => s.pos === 100);
    expect(stop100).toBeUndefined();

    // The stop at 1000 should remain
    const stop1000 = stops.find((s) => s.pos === 1000);
    expect(stop1000).toBeDefined();
  });

  it('returns stops sorted by position', () => {
    const stops = computeTabStops({
      explicitStops: [
        { val: 'end', pos: 2000 },
        { val: 'center', pos: 1000 },
        { val: 'start', pos: 500 },
      ],
    });

    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].pos).toBeGreaterThan(stops[i - 1].pos);
    }
  });
});

describe('calculateTabWidth', () => {
  it('calculates width to next default stop', () => {
    // At position 0, should go to first default stop (48px)
    const result = calculateTabWidth(0, {});
    expect(result.width).toBe(48); // 720 twips = 48px
    expect(result.alignment).toBe('start');
  });

  it('calculates width to next stop from middle position', () => {
    // At position 20px, should reach 48px (720 twips)
    const result = calculateTabWidth(20, {});
    expect(result.width).toBe(28); // 48 - 20 = 28
  });

  it('wraps to next interval when close to stop', () => {
    // At position 46px, the result should be to the next stop
    // 48 - 46 = 2px which is less than 1/4 of 48 (12px)
    // But this is still a valid width > 1
    const result = calculateTabWidth(46, {});
    expect(result.width).toBeGreaterThan(0);
  });

  it('uses explicit stops when provided', () => {
    const result = calculateTabWidth(0, {
      explicitStops: [{ val: 'center', pos: 1000 }],
    });

    expect(result.alignment).toBe('center');
    const expectedWidth = twipsToPixels(1000); // ~66.67px
    expect(Math.abs(result.width - expectedWidth)).toBeLessThan(1);
  });

  it('returns fallback when width would be too small', () => {
    // When tab width calculates to less than 1, should use fallback
    const result = calculateTabWidth(twipsToPixels(719), {}); // Just before 720
    expect(result.width).toBeGreaterThan(0);
  });

  it('adjusts for center alignment with following text', () => {
    const measureText = (text: string) => text.length * 10; // 10px per char
    const result = calculateTabWidth(
      0,
      { explicitStops: [{ val: 'center', pos: 1440 }] },
      'test', // 4 chars = 40px
      measureText
    );

    // Center alignment: tab width should account for half of text width
    // 96px (1440 twips) - 0 - 20px (half of 40) = 76px
    expect(result.alignment).toBe('center');
    expect(result.width).toBe(76);
  });

  it('adjusts for end alignment with following text', () => {
    const measureText = (text: string) => text.length * 10;
    const result = calculateTabWidth(
      0,
      { explicitStops: [{ val: 'end', pos: 1440 }] },
      'test',
      measureText
    );

    // End alignment: tab width should account for full text width
    // 96px - 0 - 40px = 56px
    expect(result.alignment).toBe('end');
    expect(result.width).toBe(56);
  });

  it('handles decimal alignment', () => {
    const measureText = (text: string) => text.length * 10;
    const result = calculateTabWidth(
      0,
      { explicitStops: [{ val: 'decimal', pos: 1440 }] },
      '123.45',
      measureText,
      '.'
    );

    // Decimal alignment: aligns the decimal point
    // Before decimal: "123" = 30px
    // 96px - 0 - 30px = 66px
    expect(result.alignment).toBe('decimal');
    expect(result.width).toBe(66);
  });

  it('returns zero width for bar tabs', () => {
    const result = calculateTabWidth(0, {
      explicitStops: [{ val: 'bar', pos: 720 }],
    });

    expect(result.width).toBe(0);
    expect(result.alignment).toBe('bar');
  });
});

describe('calculateSimpleTabWidth', () => {
  it('calculates width to next default stop at position 0', () => {
    const width = calculateSimpleTabWidth(0);
    expect(width).toBe(48); // Full 0.5 inch
  });

  it('calculates remaining width at position 20', () => {
    const width = calculateSimpleTabWidth(20);
    expect(width).toBe(28); // 48 - 20
  });

  it('wraps to next interval when very close to a stop', () => {
    // At position 47, only 1px to next stop
    // 1 < 12 (1/4 of 48), so should add another interval
    const width = calculateSimpleTabWidth(47);
    expect(width).toBe(49); // 1 + 48
  });

  it('handles position exactly on a stop', () => {
    // At position 48, remainder is 0, so full interval
    const width = calculateSimpleTabWidth(48);
    expect(width).toBe(48);
  });
});
