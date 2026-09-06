// Clear a rectangular float when none of its passages can hold the next glyph.
// Curved contours retain their scanline fallback because later bands may widen.
import { mergeAvailableIntervalsAtY, type ExclusionZone } from './drawing-exclusion.ts';
import { intersectScanlineIntervals, type ScanlineInterval } from './drawing-wrap.ts';
import type { DrawingPoint } from './drawing-geometry.ts';

const EPSILON = 0.001;
const MAX_CLEARANCE_STEPS = 32;

function isRectangularContour(polygon: readonly DrawingPoint[] | null): boolean {
  if (!polygon || polygon.length < 4) return false;
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  for (const point of polygon) {
    left = Math.min(left, point.x);
    right = Math.max(right, point.x);
    top = Math.min(top, point.y);
    bottom = Math.max(bottom, point.y);
  }
  if (!(right > left && bottom > top)) return false;
  return polygon.every((point, index) => {
    const next = polygon[(index + 1) % polygon.length]!;
    const onPerimeter =
      Math.abs(point.x - left) < EPSILON ||
      Math.abs(point.x - right) < EPSILON ||
      Math.abs(point.y - top) < EPSILON ||
      Math.abs(point.y - bottom) < EPSILON;
    return (
      onPerimeter && (Math.abs(point.x - next.x) < EPSILON || Math.abs(point.y - next.y) < EPSILON)
    );
  });
}

/** Return a bounded vertical skip for an empty line, in page-content coordinates. */
export function narrowRectangularWrapSkip(
  y: number,
  height: number,
  zones: readonly ExclusionZone[],
  left: number,
  right: number,
  glyphWidth: number
): number {
  if (!(height > 0 && glyphWidth > 0 && glyphWidth <= right - left) || zones.length === 0) return 0;
  let current = y;
  for (let attempt = 0; attempt < MAX_CLEARANCE_STEPS; attempt++) {
    const active = zones.filter(
      (zone) =>
        zone.verticalBand.y < current + height - EPSILON &&
        zone.verticalBand.y + zone.verticalBand.height > current + EPSILON
    );
    if (
      active.length === 0 ||
      active.some(
        (zone) =>
          zone.input.mode !== 'square' &&
          zone.input.mode !== 'topAndBottom' &&
          !(zone.input.mode === 'tight' && isRectangularContour(zone.input.polygon))
      )
    )
      return current - y;

    // A line can start above the float while its lower glyph band intersects it.
    // Intersect all relevant scanlines instead of probing only the line's top.
    let available: readonly ScanlineInterval[] = [{ start: left, end: right }];
    const samples = [current + EPSILON, current + height - EPSILON];
    for (const zone of active) samples.push(Math.max(current, zone.verticalBand.y) + EPSILON);
    for (const sample of samples) {
      available = intersectScanlineIntervals(
        available,
        mergeAvailableIntervalsAtY(sample, zones, left, right)
      ).filter((interval) => interval.end - interval.start >= glyphWidth - EPSILON);
      if (available.length === 0) break;
    }
    if (available.length > 0) return current - y;
    let next = Infinity;
    for (const zone of active) {
      const bottom = zone.verticalBand.y + zone.verticalBand.height;
      if (bottom > current + EPSILON) next = Math.min(next, bottom);
    }
    if (!Number.isFinite(next) || next <= current || next - y > 100_000) return current - y;
    current = next;
  }
  return current - y;
}
