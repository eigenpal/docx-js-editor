import { expect, test } from 'bun:test';
import { narrowRectangularWrapSkip } from '../narrow-wrap-clearance.ts';
import { squareWrapZone } from './float-over-table-harness.ts';
import type { ExclusionZone } from '../drawing-exclusion.ts';

const square = squareWrapZone({
  anchorParagraphId: 'p',
  top: 20,
  height: 100,
  left: 2,
  width: 98,
  contentWidth: 100,
});
const tight: ExclusionZone = {
  ...square,
  input: {
    ...square.input,
    mode: 'tight',
    polygon: [
      { x: 2, y: 20 },
      { x: 100, y: 20 },
      { x: 100, y: 120 },
      { x: 2, y: 120 },
    ],
  },
};

test('square and rectangular tight contours clear the full prospective line box', () => {
  for (const zone of [square, tight]) {
    expect(narrowRectangularWrapSkip(30, 14, [zone], 0, 100, 14)).toBe(90);
    expect(narrowRectangularWrapSkip(10, 14, [zone], 0, 100, 14)).toBe(110);
    expect(narrowRectangularWrapSkip(0, 14, [zone], 0, 100, 14)).toBe(0);
    expect(narrowRectangularWrapSkip(120, 14, [zone], 0, 100, 14)).toBe(0);
  }
});

test('fitting gaps, oversized glyphs and curved contours retain their fallback', () => {
  expect(narrowRectangularWrapSkip(30, 14, [square], 0, 100, 1)).toBe(0);
  expect(narrowRectangularWrapSkip(30, 14, [square], 0, 100, 101)).toBe(0);
  const triangle: ExclusionZone = {
    ...tight,
    input: {
      ...tight.input,
      polygon: [
        { x: 2, y: 20 },
        { x: 100, y: 120 },
        { x: 2, y: 120 },
      ],
    },
  };
  expect(narrowRectangularWrapSkip(30, 14, [triangle], 0, 100, 14)).toBe(0);
});

test('overlapping rectangles advance across successive lower boundaries', () => {
  const left = squareWrapZone({
    anchorParagraphId: 'p',
    top: 20,
    height: 60,
    left: 0,
    width: 51,
    contentWidth: 100,
  });
  const right = squareWrapZone({
    anchorParagraphId: 'p',
    top: 20,
    height: 100,
    left: 49,
    width: 51,
    contentWidth: 100,
  });
  expect(narrowRectangularWrapSkip(30, 14, [left, right], 0, 100, 100)).toBe(90);
});
