// Safe PAGE / NUMPAGES / SECTIONPAGES field projection for read-only page furniture.
//
// Field instructions are attacker-controlled and MUST NEVER execute. Recognition of
// allowlisted instructions and the shared complex-field scan machine live in
// `field-instruction.ts`. This module projects those fields into measurable pieces and
// finalizes furniture once document page counts are known.
//
// Well-formed computed fields and `w:fldSimple` each contribute one UTF-16 model unit
// (aligned with `paragraphTextOf` / `segmentsOf`). FORMTEXT results instead keep their literal
// character offsets because they are user input. Malformed fields demote so content remains.
//
// Simple and complex PAGE-family fields evaluate alike when a page context is supplied
// (headers/footers): the live value paints from that context. In the BODY there is no page
// context — the value depends on a pagination that has not happened yet — so a page field with
// no cached result paints a placeholder digit and records its kind on the span's field-atom
// marker; `substituteBodyPageFields` fills the real value once the page count is known. A
// non-page field paints its cached result, with allowlisted page fields nested inside that
// result (complex or simple) evaluated per sheet rather than concatenated from the saved cache.
// Other nested field instructions stay inert.
//
// Projection is a layout concern (span geometry + tab alignment), not paint-time substitution.

import {
  hardBreakKind,
  hasLegacyFormFieldData,
  isFldSimple,
  projectOmmlEquation,
  type DocumentProperties,
  type OoxmlElement,
  type OoxmlNode,
  type OoxmlProperty,
  type HardBreakKind,
} from '@docx-editor.dev/core/store';
import { isInlineRunContainer, MAX_INLINE_CONTAINER_DEPTH } from '../store/package/ooxml-shared.ts';
import {
  allowlistedPageField,
  consumeScanNode,
  createFieldParseState,
  createScanBudget,
  detectStoryPageFields,
  effectiveFieldInstruction,
  ingestInstrTextBounded,
  isCollectingInstruction,
  isFldChar,
  isInsideFieldResult,
  isInstrText,
  MAX_FIELD_INSTRUCTION_CHARS,
  MAX_STORY_FIELD_SCAN_DEPTH,
  MAX_STORY_FIELD_SCAN_NODES,
  normalizeFieldInstruction,
  onFldCharBegin,
  onFldCharEnd,
  onFldCharSeparate,
  resetFieldParseState,
  type StoryPageFieldNeeds,
} from './field-instruction.ts';
import {
  carryStrippedPageFieldProjection,
  fieldPageContextToken,
  finalizePageFieldProjection,
  formatPageNumber,
  projectPageFieldValue,
  storyNeedsPageFields,
  summarizeFlushedPage,
  withPageFieldSources,
  type BodyPageFieldContext,
  type FieldPageContext,
} from './field-page-furniture.ts';
import { projectSimpleFieldResult } from './field-simple-result.ts';
import { createNestedPageTracker } from './field-nested-page.ts';
import {
  modelTextOfRunChild,
  runPropertiesOf,
  type RunPropertyCascader,
} from './field-run-text.ts';
import { captureInstructionSpecs } from './field-form.ts';
import type { RefFieldContext } from './field-ref.ts';
import { synthesizeAtomicField } from './field-synthesis.ts';
import { isSymbolRunChild, symbolGlyphOf, symbolRunStyle } from './symbol-run.ts';
import {
  appendModelRange,
  applyEastAsiaFontSlots,
  positionalTabOf,
  type FieldAtomMarker,
  type FieldAwarePiece,
  type FieldLinkProjector,
  type HyperlinkProjector,
  type ModelRange,
  type MutableModelRange,
  type PendingFieldProjection,
  type PositionalTab,
} from './field-pieces.ts';
import type { InlineDrawingLayoutContext, InlineDrawingLayoutInput } from './drawing-layout.ts';
import { isRunDrawingAtom, runDrawingAtomPlan } from './field-drawing-atom.ts';
import { legacyFormFieldDataOf } from '../store/package/field-nodes.ts';
import { fieldProjectionSpansOf } from './field-projection-spans.ts';
import {
  emptyNamespaceScope,
  namespaceScopeForNode,
} from '../store/package/drawing-projection-walk.ts';
import {
  isProjectableNoteAtom,
  projectedNoteMarkText,
  type NoteMarkContext,
} from './note-projection.ts';
import {
  DEFAULT_REVISION_DISPLAY_MODE,
  NO_REVISIONS,
  isRevisionWrapper,
  revisionAttributionOf,
  projectedRevisions,
  projectedRevisionProperties,
  revisionsAreDeletion,
  revisionsVisible,
  withRevision,
  type RevisionAttribution,
  type RevisionAuthorFilter,
  type RevisionDisplayMode,
} from './revision-projection.ts';
import { resolveRunStyle, type ResolvedRunStyle, type ThemeFonts } from './run-style.ts';
import { equationRunStyle } from './equation-layout.ts';
import type { SpanLinkRecord } from './semantic-records.ts';
import {
  contentControlContentChildren,
  isContentControl,
} from '../store/package/content-control-walk.ts';

// Re-exports so existing layout-local imports stay stable: instruction recognition and
// detection, whole-document page-field finalization (pagination-time values, own module),
// the piece vocabulary, and the shared run-child text/property vocabulary.
export {
  MAX_FIELD_INSTRUCTION_CHARS,
  MAX_STORY_FIELD_SCAN_DEPTH,
  MAX_STORY_FIELD_SCAN_NODES,
  allowlistedPageField,
  detectStoryPageFields,
  normalizeFieldInstruction,
  type StoryPageFieldNeeds,
};
export {
  carryStrippedPageFieldProjection,
  fieldPageContextToken,
  finalizePageFieldProjection,
  formatPageNumber,
  projectPageFieldValue,
  storyNeedsPageFields,
  summarizeFlushedPage,
  withPageFieldSources,
  type FieldPageContext,
};
export {
  type FieldAwarePiece,
  type FieldLinkProjector,
  type HyperlinkProjector,
  type ModelRange,
  type PositionalTab,
};
export { propertiesOfRunContainer, type RunPropertyCascader } from './field-run-text.ts';

/**
 * Flatten a paragraph into measurable pieces, projecting allowlisted page fields when a
 * page context is supplied (furniture finalize / `withPageContext`).
 *
 * Well-formed computed fields (`begin`→`end`) and typed/generic `w:fldSimple` each contribute
 * one UTF-16 model unit so offsets stay aligned with `paragraphTextOf`. FORMTEXT results remain
 * editable at their natural length. Malformed fields demote the same way: markers contribute
 * nothing and interior result text stays visible.
 *
 * `w:fldSimple` advances the model offset by one and paints its result as a single projected
 * piece (live page value when allowlisted and a page context is supplied; otherwise cached
 * text, with nested allowlisted page fields evaluated live under that same context).
 *
 * Hidden runs (`w:vanish`) emit no piece while still advancing offsets.
 */
export function piecesOfParagraph(
  paragraph: OoxmlNode,
  inheritedRunProperties: readonly OoxmlProperty[] = [],
  pageContext?: FieldPageContext,
  cascadeRuns?: RunPropertyCascader,
  projectLink?: HyperlinkProjector,
  noteMarks?: NoteMarkContext,
  displayMode: RevisionDisplayMode = DEFAULT_REVISION_DISPLAY_MODE,
  deletedRanges?: MutableModelRange[],
  inlineDrawingLayout?: InlineDrawingLayoutContext,
  themeFonts?: ThemeFonts,
  projectFieldLink?: FieldLinkProjector,
  documentProperties?: DocumentProperties,
  bodyPageFields: BodyPageFieldContext | false = false,
  refFields?: RefFieldContext,
  authorFilter?: RevisionAuthorFilter
): FieldAwarePiece[] {
  if (paragraph.kind === 'textValue') return [];
  if (paragraph.kind !== 'paragraph') return [];

  const pieces: FieldAwarePiece[] = [];
  let offset = 0;
  /** The link the walk is currently inside, so every piece it emits is tagged with it. */
  let currentLink: SpanLinkRecord | undefined;

  const { atomBeginIds, editableResultBeginIds, coveredIds } = fieldProjectionSpansOf(paragraph);

  const field = createFieldParseState();
  const budget = createScanBudget();
  let pending: PendingFieldProjection | null = null;
  /** Outermost begin id when the open field is atomic. */
  let openAtomicBeginId: string | null = null;
  // Live-evaluated allowlisted field nested inside the open atomic result (fldSimple parity).
  const nestedPage = createNestedPageTracker();
  /**
   * The revision wrappers enclosing the run being processed, outermost first.
   *
   * Held here rather than threaded through every emitter because the walk is synchronous and
   * depth-first: it is set on the way into a wrapper and restored on the way out, so every
   * piece emitted in between sees exactly its own enclosing stack.
   */
  let revisions: readonly RevisionAttribution[] = NO_REVISIONS;

  const push = (
    text: string,
    props: readonly OoxmlProperty[],
    style: ResolvedRunStyle,
    projected: boolean,
    start: number,
    end: number,
    extras?: {
      readonly positionalTab?: PositionalTab;
      readonly breakKind?: HardBreakKind;
      readonly measureText?: string;
      readonly noteNav?: FieldAwarePiece['noteNav'];
      readonly inlineDrawing?: InlineDrawingLayoutInput;
      readonly anchoredAtom?: true;
      readonly equation?: FieldAwarePiece['equation'];
      /**
       * Attribution to attach INSTEAD of the walk's live stack, for text emitted after the
       * walk has left the wrapper that owns it — a buffered field result is the only such
       * case. Passing it here keeps `push` the single place a piece is attributed.
       */
      readonly revisionsOverride?: readonly RevisionAttribution[];
      readonly linkOverride?: SpanLinkRecord;
      /** Marks this piece as a field's displayed result, for the shading Word draws under one. */
      readonly fieldAtom?: FieldAtomMarker;
    }
  ): void => {
    if (text.length === 0 && !projected && !extras?.inlineDrawing) return;
    const effectiveLink = extras?.linkOverride ?? currentLink;
    const authoredRevisions = extras?.revisionsOverride ?? revisions;
    const effectiveRevisions = authorFilter
      ? projectedRevisions(authoredRevisions, displayMode, authorFilter)
      : authoredRevisions;
    if (effectiveRevisions === null) return;
    const publishedProps = authorFilter ? projectedRevisionProperties(props, authorFilter) : props;
    const link = effectiveLink ? { link: effectiveLink } : {};
    const attribution = effectiveRevisions.length === 0 ? {} : { revisions: effectiveRevisions };
    if (projected) {
      pieces.push({
        text,
        props: publishedProps,
        style,
        start,
        end,
        projected: true,
        ...(extras?.measureText !== undefined ? { measureText: extras.measureText } : {}),
        ...(extras?.noteNav ? { noteNav: extras.noteNav } : {}),
        ...(extras?.inlineDrawing ? { inlineDrawing: extras.inlineDrawing } : {}),
        ...(extras?.anchoredAtom ? { anchoredAtom: true as const } : {}),
        ...(extras?.equation ? { equation: extras.equation } : {}),
        ...(extras?.fieldAtom ? { fieldAtom: extras.fieldAtom } : {}),
        ...link,
        ...attribution,
      });
      return;
    }
    if (text.length === 0) return;
    pieces.push({
      text,
      props: publishedProps,
      style,
      start,
      end,
      ...(extras?.positionalTab ? { positionalTab: extras.positionalTab } : {}),
      ...(extras?.breakKind ? { breakKind: extras.breakKind } : {}),
      ...link,
      ...attribution,
    });
  };

  const commitAtomicField = (): void => {
    if (!pending || !pending.atomic) {
      pending = null;
      openAtomicBeginId = null;
      return;
    }
    const start = pending.atomStart;
    const end = start + 1;
    if (pending.style.hidden) {
      // Vanish: no piece, atom still advances (already counted at begin).
      pending = null;
      openAtomicBeginId = null;
      return;
    }
    // The walk has already left any wrapper around this field, so its attribution comes from
    // what was captured on the way in rather than from the live stack.
    //
    // Which is also why VISIBILITY has to be asked of the captured stack here rather than left
    // to the emitters: a field wrapped whole in `w:ins`/`w:del` used never to form an atom at
    // all, so this path could not meet one — until `atomicFieldSpansOf` learned to descend into
    // revision wrappers. Without this, an inserted page number painted its digits in the
    // ORIGINAL view, which is the one view that must show the document before that insertion.
    if (!revisionsVisible(pending.resultRevisions, displayMode, authorFilter)) {
      if (deletedRanges && revisionsAreDeletion(pending.resultRevisions)) {
        appendModelRange(deletedRanges, start, end);
      }
      pending = null;
      openAtomicBeginId = null;
      return;
    }
    // A HYPERLINK field becomes a live link only when nothing already links it: an enclosing
    // `w:hyperlink` captured into `resultLink` wins, exactly as it does for every other field.
    // Resolved LAZILY (and memoized): a field that paints nothing — empty result, no synthesized
    // glyph — must never reach `projectFieldLink`, or it mints a registry id no piece ever uses.
    const { resultLink, linkSpec, resultRevisions, formField } = pending;
    let carriedMemo: NonNullable<Parameters<typeof push>[6]> | undefined;
    const carried = (): NonNullable<Parameters<typeof push>[6]> => {
      if (carriedMemo) return carriedMemo;
      const fieldLink = !resultLink && linkSpec ? (projectFieldLink?.(linkSpec) ?? null) : null;
      const carriedLink = resultLink ?? fieldLink;
      carriedMemo = {
        ...(resultRevisions.length > 0 ? { revisionsOverride: resultRevisions } : {}),
        ...(carriedLink ? { linkOverride: carriedLink } : {}),
        fieldAtom: { formField },
      };
      return carriedMemo;
    };
    // The whole synthesis dispatch — SYMBOL / form field / live PAGE / cached result / a
    // document-property value / MACROBUTTON display — lives in `field-synthesis.ts`; it reads
    // the pending state and the document-global context and returns the one glyph run to paint,
    // or null for nothing (the reserved model unit stays either way).
    const synthesis = synthesizeAtomicField(pending, {
      pageContext,
      themeFonts,
      documentProperties,
      bodyPageFields,
      ...(refFields ? { refFields } : {}),
    });
    if (synthesis) {
      const extras = carried();
      // A body page-field / PAGEREF placeholder rides the same field-atom marker its finalize
      // pass reads.
      const withPageField =
        synthesis.pageField || synthesis.pageRefField
          ? {
              ...extras,
              fieldAtom: {
                formField: pending.formField,
                ...(synthesis.pageField ? { pageField: synthesis.pageField } : {}),
                ...(synthesis.pageRefField ? { pageRef: synthesis.pageRefField } : {}),
              },
            }
          : extras;
      push(synthesis.text, synthesis.props, synthesis.style, true, start, end, withPageField);
    }
    pending = null;
    openAtomicBeginId = null;
  };

  const abandonPending = (): void => {
    if (!pending) return;
    // A demoted HYPERLINK keeps its link too, when nothing already linked its pieces — the
    // enclosing `w:hyperlink` a buffered piece carries wins, same precedence as the flush.
    const fieldLink =
      !pending.resultLink && pending.linkSpec
        ? (projectFieldLink?.(pending.linkSpec) ?? null)
        : null;
    const linked = (piece: FieldAwarePiece): FieldAwarePiece =>
      fieldLink && !piece.link ? { ...piece, link: fieldLink } : piece;
    if (pending.atomic) {
      // Missing end after an atomic begin should not happen (atoms require end). If the
      // scan budget aborts mid-field, roll the atom back and flush any buffered cache.
      offset = pending.atomStart;
      for (const piece of pending.buffered) {
        pieces.push({
          ...linked(piece),
          start: offset,
          end: offset + (piece.end - piece.start),
        });
        offset += piece.end - piece.start;
      }
      if (pending.cachedText.length > 0 && pending.buffered.length === 0) {
        push(
          pending.cachedText,
          pending.props,
          pending.style,
          false,
          offset,
          offset + pending.cachedText.length,
          fieldLink ? { linkOverride: fieldLink } : undefined
        );
        offset += pending.cachedText.length;
      }
    } else {
      for (const piece of pending.buffered) pieces.push(linked(piece));
      offset = pending.bufferOffset;
    }
    pending = null;
    openAtomicBeginId = null;
  };

  const pushRunContent = (
    grand: OoxmlNode,
    props: readonly OoxmlProperty[],
    style: ResolvedRunStyle
  ): void => {
    // One branch for both run-level drawing atoms \u2014 `w:drawing` and an MC wrapper carrying
    // one; the plan itself (visibility, deletion, payload) lives in field-drawing-atom.ts.
    if (isRunDrawingAtom(grand)) {
      const start = offset;
      offset += 1;
      const end = offset;
      if (!inlineDrawingLayout) return;
      const plan = runDrawingAtomPlan({
        node: grand,
        layout: inlineDrawingLayout,
        hiddenRun: style.hidden,
        revisions,
        displayMode,
        authorFilter,
      });
      if (plan.recordDeleted && deletedRanges) appendModelRange(deletedRanges, start, end);
      if (plan.emit) push('\uFFFC', props, style, true, start, end, plan.extras);
      return;
    }
    if (isProjectableNoteAtom(grand)) {
      const projected = projectedNoteMarkText(grand, noteMarks);
      const start = offset;
      const end = start + 1;
      offset = end;
      if (style.hidden) return;
      if (!projected) return;
      // Empty display (customMarkFollows / separator / dangling) still advances the model
      // unit; only non-empty marks emit a measurable projected piece.
      if (projected.text.length === 0 && !projected.measureText) return;
      const noteNav =
        projected.scopeId && projected.nav
          ? { scopeId: projected.scopeId, direction: projected.nav }
          : undefined;
      push(
        projected.text.length > 0 ? projected.text : (projected.measureText ?? ''),
        props,
        style,
        true,
        start,
        end,
        {
          ...(projected.measureText !== undefined ? { measureText: projected.measureText } : {}),
          ...(noteNav ? { noteNav } : {}),
        }
      );
      return;
    }
    // A `w:ptab` advances the line but occupies NO model offset, so it is pushed with a
    // zero-width range and the offset does not move.
    const positional = positionalTabOf(grand);
    if (positional) {
      if (!style.hidden)
        push('\t', props, style, false, offset, offset, { positionalTab: positional });
      return;
    }
    // A `w:sym` is generic in the canonical tree, so the store gives it NO model width. The
    // glyph is therefore a projected piece at a zero-width range — paint emits it as
    // furniture (no `data-start`) and every surrounding offset stays where the store put it.
    if (isSymbolRunChild(grand)) {
      const glyph = symbolGlyphOf(grand);
      if (!glyph || style.hidden || !revisionsVisible(revisions, displayMode, authorFilter)) return;
      const sym = symbolRunStyle(props, glyph, themeFonts);
      push(glyph.text, sym.props, sym.style, true, offset, offset);
      return;
    }
    const text = modelTextOfRunChild(grand);
    if (text.length === 0) return;
    // A revision the display mode resolves away is suppressed the same way `w:vanish` is, and
    // for the same reason: the offset space belongs to the model, not to the view, so the
    // characters keep their offsets whether or not they are laid out. `w:delText` outside any
    // deletion is malformed and is suppressed unconditionally, because the one thing that must
    // never happen is deleted text flowing as ordinary text.
    const deleted = revisionsAreDeletion(revisions);
    const suppressed =
      style.hidden ||
      !revisionsVisible(revisions, displayMode, authorFilter) ||
      (grand.kind === 'deletedText' && !deleted);
    if (!suppressed) {
      push(text, props, style, false, offset, offset + text.length, {
        ...(grand.kind === 'hardBreak' ? { breakKind: hardBreakKind(grand) } : {}),
      });
    }
    // Deleted characters are recorded whether or not they were laid out. They occupy model
    // offsets in every mode, and the caret must step over them in every mode — including the
    // proposed result, where they produce no span at all and an offset-by-offset walk would
    // otherwise stop at invisible positions.
    if (deleted && deletedRanges) appendModelRange(deletedRanges, offset, offset + text.length);
    offset += text.length;
  };

  const processRun = (run: OoxmlNode, runDepth: number): void => {
    if (run.kind !== 'run') return;
    const props = runPropertiesOf(run, inheritedRunProperties, cascadeRuns);
    const style = resolveRunStyle(props, themeFonts);

    /**
     * Donate the run's style and attribution to the pending atom's flush, first-wins.
     *
     * The first result content that survives to be displayed donates both, because by flush
     * time the walk has left any wrapper and the live stack is empty again. Locked by their
     * own flags, not by the stack being non-empty: an UNTRACKED first run leaves the stack
     * empty, and testing emptiness let a later tracked run donate its revision to the whole
     * atom — `Section <w:del>3</w:del>` painted "Section 3" struck through entire. Shared by
     * ordinary result text and a result `w:sym`, so a symbol-only result carries a style and
     * an attribution too.
     */
    const donateResultCapture = (): void => {
      if (!pending) return;
      if (!pending.capturedResultStyle) {
        pending.props = props;
        pending.style = style;
        pending.capturedResultStyle = true;
      }
      if (!pending.capturedResultRevisions) {
        pending.resultRevisions = revisions;
        pending.capturedResultRevisions = true;
        if (!pending.resultLink && currentLink) pending.resultLink = currentLink;
      }
    };

    for (const grand of run.children) {
      if (!consumeScanNode(budget)) {
        abandonPending();
        resetFieldParseState(field);
        nestedPage.reset();
        if (grand.kind === 'runProperties') continue;
        if (isFldChar(grand, 'begin') || isFldChar(grand, 'separate') || isFldChar(grand, 'end')) {
          continue;
        }
        if (isInstrText(grand)) continue;
        if (coveredIds.has(grand.id) && openAtomicBeginId === null) continue;
        pushRunContent(grand, props, style);
        continue;
      }

      if (grand.kind === 'runProperties') continue;

      if (isFldChar(grand, 'begin')) {
        const atomic = atomBeginIds.has(grand.id);
        onFldCharBegin(field);
        if (field.nesting === 1) {
          abandonPending();
          nestedPage.reset();
          openAtomicBeginId = atomic ? grand.id : null;
          pending = {
            kind: null,
            picture: null,
            symbolSpec: null,
            linkSpec: null,
            formSpec: null,
            buttonSpec: null,
            docPropertySpec: null,
            refSpec: null,
            autonumSpec: null,
            // Bounded ffData STATE read (checkbox checked/size, dropdown entries/selection —
            // macros never); `formField` below stays presence-based so an unreadable payload
            // still shades.
            formData: legacyFormFieldDataOf(grand),
            beginId: grand.id,
            atomic,
            editableResult: editableResultBeginIds.has(grand.id),
            atomStart: offset,
            props,
            style,
            capturedResultStyle: false,
            cachedText: '',
            sawResultContent: false,
            buffered: [],
            bufferOffset: offset,
            // A wrapper around the BEGIN marker wraps the whole field, and since
            // `atomicFieldSpansOf` learned to descend into revision wrappers such a field forms
            // an atom rather than demoting. Capturing here is what makes the flush able to
            // resolve visibility at all: a suppressed result run never reaches the donation
            // below — it is skipped before it gets there — so without this an inserted page
            // number painted its digits into the ORIGINAL view, with nothing recording that the
            // insertion was what put them there.
            resultRevisions: revisions,
            capturedResultRevisions: revisions.length > 0,
            formField: hasLegacyFormFieldData(grand),
            ...(currentLink ? { resultLink: currentLink } : {}),
          };
          if (atomic) {
            // Reserve the single model unit up front so surrounding offsets stay stable.
            offset += 1;
          }
        }
        continue;
      }

      if (isInstrText(grand)) {
        ingestInstrTextBounded(field, grand, budget, runDepth + 1);
        continue;
      }

      if (isFldChar(grand, 'separate')) {
        const outermostSeparate = field.nesting === 1 && field.phase === 'instruction';
        const separateLevel = field.nesting;
        const match = onFldCharSeparate(field);
        if (outermostSeparate && pending) {
          // Capture the allowlisted kind whether or not a page context is present. With one
          // (header/footer) the flush projects the live value; without one (body) it paints a
          // placeholder the kind marks, and document finalize substitutes the page's value.
          // The `\#` picture rides along: it decides how that computed value is rendered.
          pending.kind = match?.kind ?? null;
          pending.picture = match?.picture ?? null;
          // Capture the SYMBOL / HYPERLINK / form-field spec while the machine still holds the
          // raw instruction (`onFldCharEnd` resets the buffer before the flush reads anything).
          // Nesting overflow refuses exactly as PAGE projection does: a >4-deep hostile field
          // must not synthesize output from whatever outer fragments the buffer kept.
          const effective = effectiveFieldInstruction(field);
          if (!pending.kind && !effective.overflow && !field.nestingOverflow) {
            captureInstructionSpecs(pending, effective.instruction);
          }
          // Prefer separate-run style until a measurable result run donates one.
          pending.props = props;
          pending.style = style;
        } else if (pending?.atomic && field.phase === 'result' && !field.nestingOverflow) {
          // Inner separate inside the outer atomic result: live-evaluate an allowlisted
          // nested field instead of concatenating its cached digits (fldSimple parity).
          // Level-aware: the tracker arms at ANY nested level 2..MAX_FIELD_NESTING when idle,
          // and while armed ignores deeper separates (part of the replaced result) and null
          // duplicates at the tracked level. Overflowed nesting never arms — projection would
          // be replacing content the atom parser already demoted.
          nestedPage.onSeparate(pageContext ? match : null, separateLevel);
        }
        continue;
      }

      if (isFldChar(grand, 'end')) {
        const outermostEnd = field.nesting === 1;
        // A SYMBOL or FORMCHECKBOX with no `separate` at all (begin/instr/end) still renders
        // in Word. The machine's buffer is reset by `onFldCharEnd`, so capture BEFORE advancing.
        if (outermostEnd && pending?.atomic && field.phase === 'instruction') {
          const effective = effectiveFieldInstruction(field);
          if (!effective.overflow && !field.nestingOverflow) {
            captureInstructionSpecs(pending, effective.instruction);
          }
        }
        // The end closing the TRACKED inner field appends its live value; an inner result that
        // existed but was entirely suppressed appends nothing (fldSimple parity). Deeper ends
        // inside the replaced result return null and leave the tracker armed, so a begin/end
        // pair nested in a tracked result cannot clear tracking mid-field.
        const appendedLive = nestedPage.onEnd(field.nesting, pageContext);
        if (appendedLive !== null && pending?.atomic) {
          pending.cachedText += appendedLive;
        }
        onFldCharEnd(field);
        if (outermostEnd) {
          if (pending?.atomic) commitAtomicField();
          else abandonPending();
        }
        continue;
      }

      if (isCollectingInstruction(field)) {
        // Only well-formed atomic fields suppress instruction-phase run content.
        // Demoted / malformed opens must not make surrounding text disappear.
        //
        // An editable-result FORMTEXT field falls through ON PURPOSE: the offset authority
        // (`walkParagraph` over `atomicFieldSpansOf`) only zeroes the nodes of ATOMIC spans,
        // so ordinary `w:t` between its begin and separate keeps real model offsets — and
        // layout must paint what the store addresses, or every offset after the field lies.
        // Word would not save such content, but a file that carries it shows it.
        if (pending?.atomic) continue;
      }

      if (pending && isInsideFieldResult(field)) {
        // A cached result is one plain string and cannot carry a per-glyph font switch, so
        // only a `w:sym` with a real Unicode equivalent joins it; the rest are skipped.
        if (isSymbolRunChild(grand)) {
          if (pending.atomic) {
            // The flag records only what THIS display mode keeps: a `w:del`-wrapped result
            // hidden by the proposed view is gone from that view, and suppressing synthesis
            // over it would paint nothing where Word (after accepting) shows the display
            // text. Vanish-hidden content still sets it — that is the case the flag exists
            // for.
            if (revisionsVisible(revisions, displayMode, authorFilter))
              pending.sawResultContent = true;
            if (nestedPage.active) {
              // A symbol inside the skipped inner cache is result content too: a visible one
              // keeps the live replacement alive, a suppressed-only cache appends nothing.
              nestedPage.noteResult(
                !style.hidden && revisionsVisible(revisions, displayMode, authorFilter)
              );
              continue;
            }
            if (!style.hidden && revisionsVisible(revisions, displayMode, authorFilter)) {
              const glyph = symbolGlyphOf(grand);
              if (glyph?.unicode) {
                donateResultCapture();
                pending.cachedText += glyph.text;
              }
            }
            continue;
          }
          // Demoted / editable-result field: the sym paints the way it does in an ordinary
          // run — a projected zero-width glyph piece — instead of vanishing with the atomic
          // skips. Buffered like the surrounding result text, so it flushes with it.
          const glyph = symbolGlyphOf(grand);
          if (!glyph || style.hidden || !revisionsVisible(revisions, displayMode, authorFilter))
            continue;
          const sym = symbolRunStyle(props, glyph, themeFonts);
          pending.buffered.push({
            text: glyph.text,
            props: sym.props,
            style: sym.style,
            start: offset,
            end: offset,
            projected: true,
            ...(revisions.length > 0 ? { revisions } : {}),
            ...(currentLink ? { link: currentLink } : {}),
            fieldAtom: { formField: pending.formField },
          });
          continue;
        }
        const text = modelTextOfRunChild(grand);
        if (text.length === 0) continue;

        // A field can be tracked as a whole — Word writes a deleted hyperlink as `w:del`
        // around the begin/instr/separate/result/end run — and its result text is BUFFERED
        // here and flushed when the field closes, by which time the walk has already left the
        // wrapper and `revisions` is empty again. Apply the suppression at buffer time or a
        // deleted field's result survives the proposed result the deletion was accepted into.
        const fieldDeleted = revisionsAreDeletion(revisions);
        const fieldSuppressed =
          !revisionsVisible(revisions, displayMode, authorFilter) ||
          (grand.kind === 'deletedText' && !fieldDeleted);

        // The result EXISTS in this display mode, whatever hides it below (vanish included) —
        // the flush needs the distinction to keep synthesis from painting over a result the
        // file hid on purpose. Revision-suppressed content does NOT count: the mode resolved
        // it away, and Word (after accepting the deletion) synthesizes over the gap.
        if (pending.atomic && !fieldSuppressed) pending.sawResultContent = true;

        // Deleted characters are recorded whether or not they were laid out, exactly as they
        // are for ordinary runs: they occupy model offsets in every display mode, and the caret
        // has to step over them in every mode. Recording this only on the suppressed branch
        // left an all-markup deletion — the mode where it is VISIBLE — absent from the ranges.
        //
        // The atomic path reserved ONE unit at `begin` and never advanced by the text length,
        // so the range is that reserved unit. Deriving it from the running offset produced
        // `start` values before the paragraph began (a measured `{start: -16, end: 1}`).
        if (fieldDeleted && deletedRanges) {
          if (pending.atomic) {
            appendModelRange(deletedRanges, pending.atomStart, pending.atomStart + 1);
          } else {
            // Unconditional on this branch too. Gating it on suppression left an all-markup
            // deletion inside a DEMOTED field out of the ranges — visible, and so the one case
            // where the caret could walk into deleted content it is meant to step over.
            appendModelRange(deletedRanges, offset, offset + text.length);
          }
        }

        if (fieldSuppressed) {
          if (pending.atomic && nestedPage.active) nestedPage.noteResult(false);
          if (!pending.atomic) {
            offset += text.length;
            pending.bufferOffset = offset;
          }
          continue;
        }

        if (pending.atomic) {
          // Atomic unit: cache donates display text/style only — offset already reserved.
          if (nestedPage.active) {
            // Skipped inner cached digits: the live value replaces them at the inner end.
            // Donation is the FULL result capture — style, revision attribution and enclosing
            // link — exactly like the ordinary result branch: when the atom's first visible
            // result content is the nested digits wrapped in `w:ins` or `w:hyperlink`, the
            // live value that replaces them must paint attributed and linked the same way.
            nestedPage.noteResult(!style.hidden);
            if (style.hidden) continue;
            donateResultCapture();
            continue;
          }
          if (style.hidden) continue;
          donateResultCapture();
          pending.cachedText += text;
          continue;
        }

        // Demoted field: result text is ordinary addressable content.
        if (style.hidden) {
          offset += text.length;
          pending.bufferOffset = offset;
          continue;
        }
        if (!pending.capturedResultStyle) {
          pending.props = props;
          pending.style = style;
          pending.capturedResultStyle = true;
        }
        // Buffered rather than pushed, so it does not pass through `push` and has to carry its
        // own attribution. Here the walk is STILL inside the wrapper, so the live stack is the
        // right one — unlike the atomic flush, which happens after the walk has left it. The
        // link matters for the same reason: a demoted field inside a `w:hyperlink` lost its
        // href here while every ordinary run in the same link kept one.
        pending.buffered.push({
          text,
          props,
          style,
          start: offset,
          end: offset + text.length,
          ...(revisions.length > 0 ? { revisions } : {}),
          ...(currentLink ? { link: currentLink } : {}),
          // EVERY buffered result piece is a field's displayed result — a demoted
          // (unterminated) field's cache shades exactly like a FORMTEXT's editable one.
          fieldAtom: { formField: pending.formField },
        });
        offset += text.length;
        pending.bufferOffset = offset;
        continue;
      }

      // Covered by a closed atomic field we already committed — should not reach here
      // because those nodes are skipped via the begin→end control flow. Still guard.
      if (coveredIds.has(grand.id) && openAtomicBeginId === null && atomBeginIds.size > 0) {
        // Node belongs to a later/earlier atom; if we're between fields, skip chrome only.
      }

      pushRunContent(grand, props, style);
    }
  };

  /**
   * Walk content in document order, descending through every RUN CONTAINER.
   *
   * Typed runs contribute measurable / selectable text. Generic siblings stay structurally
   * preserved but layout-inert for page-field evaluation; typed/generic `w:fldSimple` advances
   * one model unit and paints through {@link projectSimpleField}. The exceptions are the
   * containers that are not content themselves but hold runs that are:
   *
   *   - `w:hyperlink`. Skipping it is what made every link's words vanish from the painted
   *     page while still occupying model offsets.
   *   - the revision wrappers. Skipping them dropped tracked content entirely, so the reader
   *     saw a third text belonging to neither the original nor the proposal.
   *   - inline content controls (`w:sdt`). Skipping them made their words vanish while still
   *     occupying model offsets (or, for generic SDTs, occupy none at all).
   *
   * Any can hold the others, and a link inside a tracked insertion is ordinary, so the walk
   * is one recursion rather than separate passes.
   *
   * The complex-field machine spans runs in document order within the paragraph, so descending
   * must not restart it — the walk visits runs in the same order a reader sees them, whatever
   * their nesting. Every transparent wrapper shares {@link MAX_INLINE_CONTAINER_DEPTH} with
   * paragraph offsets; field-scan depth stays separate.
   */
  if (!consumeScanNode(budget)) return applyEastAsiaFontSlots(pieces, themeFonts);
  const paragraphScope = emptyNamespaceScope();

  /**
   * Paint a `w:fldSimple` (§17.16.19) as one projected model unit.
   *
   * The instruction lives in `@w:instr` and the last-computed result as child runs — there is
   * no `separate` marker on the outer field itself. What the unit paints is decided by
   * {@link projectSimpleFieldResult}; this owns the model offset and OUTER visibility.
   *
   * Attribution comes from `push` reading the live stack — a `w:fldSimple` inside `w:ins` is
   * still inside it here, unlike a complex field's deferred flush.
   */
  const projectSimpleField = (simple: OoxmlNode, depth: number): void => {
    const start = offset;
    offset += 1;
    if (simple.kind === 'textValue') return;

    // The atom is one model offset whatever it paints, so a revision enclosing the WHOLE field
    // is answered here, once, before result collection — including the live page-field branch,
    // which would otherwise paint a deleted footer number straight into the accepted view.
    //
    // The deleted range is recorded whether or not it was laid out, exactly as the complex path
    // and inline drawings do: the offset exists in every display mode and the caret has to step
    // over it in every mode.
    if (revisionsAreDeletion(revisions) && deletedRanges) {
      appendModelRange(deletedRanges, start, start + 1);
    }
    if (!revisionsVisible(revisions, displayMode, authorFilter)) return;

    const projected = projectSimpleFieldResult({
      simple,
      depth,
      pageContext,
      budget,
      revisions,
      displayMode,
      authorFilter,
      inheritedRunProperties,
      cascadeRuns,
      themeFonts,
      currentLink,
      projectFieldLink,
      documentProperties,
      bodyPageFields,
      ...(refFields ? { refFields } : {}),
    });
    if (!projected) return;
    // `w:ffData` is a `w:fldChar` payload, so a simple field is never a legacy form field. A body
    // page field carries its kind so document finalize substitutes the page's value.
    push(projected.text, projected.props, projected.style, true, start, start + 1, {
      fieldAtom: {
        formField: false,
        ...(projected.pageField ? { pageField: projected.pageField } : {}),
        ...(projected.pageRef ? { pageRef: projected.pageRef } : {}),
      },
      ...(projected.link ? { linkOverride: projected.link } : {}),
    });
  };

  const processInline = (
    child: OoxmlNode,
    depth: number,
    namespaceScope: ReadonlyMap<string, string>,
    containerDepth: number
  ): void => {
    // Match `segmentsOf`: every transparent container consumes one level, and a child reached
    // at the cap is opaque. Check before runs and atoms so hidden content cannot reach layout.
    if (containerDepth >= MAX_INLINE_CONTAINER_DEPTH) return;
    const equation = projectOmmlEquation(child);
    if (equation) {
      const start = offset++;
      if (revisionsAreDeletion(revisions) && deletedRanges)
        appendModelRange(deletedRanges, start, offset);
      const style = equationRunStyle(resolveRunStyle(inheritedRunProperties, themeFonts));
      if (style.hidden || !revisionsVisible(revisions, displayMode, authorFilter)) return;
      return push('\uFFFC', inheritedRunProperties, style, true, start, offset, { equation });
    }
    if (isFldSimple(child)) {
      projectSimpleField(child, depth);
      return;
    }
    if (child.kind === 'run') {
      processRun(child, depth);
      return;
    }
    if (isContentControl(child)) {
      if (depth > MAX_STORY_FIELD_SCAN_DEPTH) return;
      for (const inner of contentControlContentChildren(child)) {
        processInline(inner, depth + 1, namespaceScope, containerDepth + 1);
      }
      return;
    }
    if (depth > MAX_STORY_FIELD_SCAN_DEPTH) return;
    const childScope =
      child.kind !== 'textValue' && 'localName' in child
        ? namespaceScopeForNode(namespaceScope, child)
        : namespaceScope;
    if (child.kind === 'hyperlink') {
      // The link is projected ONCE per element, not per run: sanitization is not free, and a
      // link's runs must all carry the same record so paint can group them by identity.
      const previous = currentLink;
      currentLink = projectLink?.(child) ?? undefined;
      for (const inner of child.children)
        processInline(inner, depth + 1, childScope, containerDepth + 1);
      currentLink = previous;
      return;
    }
    if (isRevisionWrapper(child)) {
      const attribution = revisionAttributionOf(child);
      if (!attribution) return;
      if (!consumeScanNode(budget)) return;
      const enclosing = revisions;
      revisions = withRevision(enclosing, attribution);
      for (const inner of child.children)
        processInline(inner, depth + 1, childScope, containerDepth + 1);
      revisions = enclosing;
      return;
    }
    if (!isInlineRunContainer(child)) return;
    // The wrapper text participates in layout. Its authored direction waits for the full
    // shaping, atom, and visual-caret pipeline tracked by #714.
    for (const inner of (child as OoxmlElement).children)
      processInline(inner, depth + 1, childScope, containerDepth + 1);
  };
  // Paragraph root counts as depth 0; run children sit at depth 1.
  for (const child of paragraph.children) processInline(child, 1, paragraphScope, 0);
  // Malformed field missing end: demote — surface cached/buffered text, no live projection.
  abandonPending();

  // Slot resolution is a paragraph-wide question (Common characters inherit across run
  // boundaries), so it runs after the walk, over the assembled pieces.
  return applyEastAsiaFontSlots(pieces, themeFonts);
}
