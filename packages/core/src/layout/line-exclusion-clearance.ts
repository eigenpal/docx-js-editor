import { topAndBottomSkipBeforeLine, type ExclusionZone } from './drawing-exclusion.ts';
import { narrowRectangularWrapSkip } from './narrow-wrap-clearance.ts';
import type { PendingLine } from './pending-line.ts';
import { applyLineSpacing, type ParagraphLineSpacing } from './paragraph-style.ts';
import { displayText, type ResolvedRunStyle } from './run-style.ts';
import type { TextMeasurer } from './semantic-records.ts';

/** Keep clearance on the pending line so placement and pagination consume it once. */
export function createLineExclusionClearance(context: {
  line: () => PendingLine;
  top: () => number;
  zones: () => readonly ExclusionZone[];
  left: () => number;
  right: number;
  emptyStyle: ResolvedRunStyle;
  measurer: TextMeasurer;
  lineSpacing: ParagraphLineSpacing;
}) {
  let appliedLine: PendingLine | undefined;
  const applyTopAndBottomSkipIfNeeded = (): void => {
    const line = context.line();
    if (appliedLine === line || line.spans.length > 0 || line.drawings.length > 0) return;
    const zones = context.zones();
    if (zones.length === 0) return;
    const metrics = context.measurer.lineMetrics(context.emptyStyle);
    const skip = topAndBottomSkipBeforeLine(
      context.top(),
      line.height > 0 ? line.height : metrics.height,
      zones
    );
    if (skip > 0.001) {
      appliedLine = line;
      line.exclusionSkipBefore = skip;
    }
  };
  const applyNarrowWrapSkipIfNeeded = (text: string, style: ResolvedRunStyle): void => {
    const line = context.line();
    if (line.spans.length > 0 || line.drawings.length > 0) return;
    applyTopAndBottomSkipIfNeeded();
    const zones = context.zones();
    if (zones.length === 0) return;
    const metrics = context.measurer.lineMetrics(style);
    const firstCodePoint = text.codePointAt(0);
    const glyph = firstCodePoint === undefined ? '' : String.fromCodePoint(firstCodePoint);
    const skip = narrowRectangularWrapSkip(
      context.top() + (line.exclusionSkipBefore ?? 0),
      Math.max(
        metrics.height,
        applyLineSpacing(context.lineSpacing, metrics.height, metrics.baseline).height
      ),
      zones,
      context.left(),
      context.right,
      context.measurer.measure(displayText(glyph, style), style)
    );
    if (skip > 0.001) {
      line.exclusionSkipBefore = (line.exclusionSkipBefore ?? 0) + skip;
      line.width = 0;
      appliedLine = line;
    }
  };
  const finalizeTopAndBottomClearance = (): void => {
    const line = context.line();
    const zones = context.zones();
    if (zones.length === 0) return;
    const skip = Math.max(
      topAndBottomSkipBeforeLine(context.top(), line.height, zones),
      line.exclusionSkipBefore ?? 0
    );
    if (skip > 0.001) line.exclusionSkipBefore = skip;
    else delete (line as { exclusionSkipBefore?: number }).exclusionSkipBefore;
  };
  return {
    applyTopAndBottomSkipIfNeeded,
    applyNarrowWrapSkipIfNeeded,
    finalizeTopAndBottomClearance,
  };
}
