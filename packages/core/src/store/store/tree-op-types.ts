import type { InsertTextOp, DeleteTextOp } from './text-edit-op-types.ts';
import type { SetTextFormFieldDefaultOp } from './text-form-fields.ts';
// The op vocabulary and effect/rejection contracts (tree-ops seam).
//
// This module owns what an op IS — the declarative, JSON-safe `TreeDocOp` shapes, the
// accepted property boundaries, and the effect/rejection contracts. Validation lives in
// tree-op-validate.ts; application lives in tree-op-apply.ts; both re-export via tree-ops.ts.

import type { ParagraphTabStop } from '../../contracts/types.ts';
import type { ContentControlLock } from '../package/content-control-nodes.ts';
import type { OoxmlDrawingNode, OoxmlNode, OoxmlPart } from '../package/ooxml-tree.ts';
import type {
  DrawingLocksInput,
  DrawingPositionInput,
  ImageWrapTarget,
  SourceCrop,
} from '../package/drawing-projection.ts';
import type {
  ContentControlValueInput,
  InsertableContentControlKind,
} from './tree-op-content-controls.ts';
import type { TableBorderStyle } from '../table-border-style.ts';

/**
 * A colour as an op carries it: a literal, a theme reference, or automatic.
 *
 * Theme references stay references so the document keeps following its theme; flattening one to
 * hex at write time would freeze the resolved value into the file.
 */
export type TreeDocColorValue =
  | { readonly kind: 'hex'; readonly value: string }
  | {
      readonly kind: 'theme';
      readonly slot: string;
      readonly resolvedHex: string;
      readonly tint?: number;
      readonly shade?: number;
    }
  | { readonly kind: 'auto'; readonly resolvedHex: string };

/** Which edges a border op addresses — the four sides, the interiors, all, or clear. */
export type TableBorderTarget =
  | 'all'
  | 'outside'
  | 'inside'
  | 'none'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right';

/** A {@link TableBorderTarget} that draws something — everything except clear. */
export type TableBorderEdgeTarget = Exclude<TableBorderTarget, 'none'>;

/** Complete border spec for non-`none` selected-cell border scopes. Size is in eighths of a point. */
/** A complete border spec: style, width and colour. Ops carry all three, never a partial edit. */
export interface TableBorderSpecInput {
  readonly style: TableBorderStyle;
  readonly size: number;
  readonly color: TreeDocColorValue;
}
/**
 * The accepted RUN property boundary (design D8), as the OOXML element names that carry it.
 *
 * An explicit allowlist rather than "any `w:rPr` child": a property outside D8 has no
 * resolver, no layout behavior and no support claim, so accepting it here would let an
 * operation assert support the engine does not have. Unknown properties still ROUND-TRIP —
 * they are generic nodes in the tree — they simply cannot be authored by an op.
 */
export const ACCEPTED_RUN_PROPERTIES = [
  'rFonts', // font family
  'sz', // half-point size
  'szCs',
  'color',
  'b', // bold
  'bCs',
  'i', // italic
  'iCs',
  'u', // underline variant and color
  'strike',
  'dstrike', // double strike
  'highlight',
  'vertAlign', // superscript / subscript
  'position', // baseline offset
  'caps',
  'smallCaps',
  'spacing', // character spacing
  'w', // horizontal scaling
  'kern',
] as const;
// `w:rStyle` is deliberately ABSENT. It is preserved, not accepted: this list is the set a
// property write REPLACES, so admitting the character style would make a bold toggle delete
// it. `insertHyperlink` writes `w:rStyle` itself, as part of making the run a link, which is
// what Word does and what leaves every other write alone.

/** The accepted PARAGRAPH property boundary (design D8). */
export const ACCEPTED_PARAGRAPH_PROPERTIES = [
  'pStyle',
  'jc', // alignment
  'spacing', // before/after + line spacing and rule
  'ind', // left/right/first-line/hanging indents
  'tabs',
  'numPr', // numbering identity and level
  'keepNext',
  'keepLines',
  'widowControl',
  'pageBreakBefore',
  // Word's "Don't add space between paragraphs of the same style". Layout has always read
  // it (`paragraphContextualSpacing`); until now nothing could write it.
  'contextualSpacing',
  'shd', // shading
] as const;

export type AcceptedRunProperty = (typeof ACCEPTED_RUN_PROPERTIES)[number];
export type AcceptedParagraphProperty = (typeof ACCEPTED_PARAGRAPH_PROPERTIES)[number];

/**
 * One tab stop an op can author: where it sits, how it aligns, and what fills the gap.
 *
 * An alias, not a second declaration. The contract lane already names this shape, and two
 * public names for one shape is a trap — a caller building a stop for a read and for an op
 * would otherwise have to name it two things.
 */
export type TabStopWrite = ParagraphTabStop;

/**
 * One authored property: an element name plus its `w:`-namespace attributes.
 *
 * Modeled as name+attributes rather than a typed record per property because that is what
 * the tree holds, so an op maps to nodes without a lossy intermediate vocabulary. Attribute
 * VALUES are validated as XML text; their meaning is the resolver's business.
 *
 * Deliberately structural rather than a typed union: the accepted property lists bound WHICH
 * properties may be written, so the shape itself does not need to enumerate them.
 */
export interface OoxmlProperty {
  readonly localName: string;
  readonly attributes?: Readonly<Record<string, string>>;
}

import type { RevisionAddress, RevisionAttributionInput } from './tree-op-revision-attribution.ts';
export {
  invalidRevisionAttribution,
  type RevisionAddress,
  type RevisionAttributionInput,
} from './tree-op-revision-attribution.ts';

/**
 * Every mutation the store accepts, as one JSON-safe discriminated union.
 *
 * The ONLY write path into a document. Each op addresses nodes by id plus UTF-16 offset, which is
 * what makes editing a paragraph inside a table cell no different from editing one at the top
 * level. Declarative and serializable, so the same op crosses a worker or transport boundary
 * unchanged.
 */
export type TreeDocOp =
  | {
      /**
       * Replace one story's complete block structure with fresh plain paragraphs.
       *
       * Unlike a span replacement, this removes section-ending paragraphs and content-control
       * wrappers. A body's final direct `w:sectPr` survives to retain the page setup.
       */
      readonly op: 'replaceStoryBlocks';
      readonly storyRootId: string;
      readonly paragraphs: readonly string[];
    }
  | {
      /**
       * Insert an SDT-wrapped TOC immediately before a body paragraph.
       * The initial cached result and any heading bookmarks land in one undo unit.
       */
      readonly op: 'insertToc';
      readonly beforeParagraphId: string;
      readonly instruction: string;
      readonly alias: string;
      readonly entries: readonly {
        readonly level: number;
        readonly text: string;
        readonly headingParagraphId: string;
        readonly bookmarkName: string;
        readonly pageNumberText: string;
      }[];
      readonly bookmarksToCreate: readonly {
        readonly paragraphId: string;
        readonly name: string;
      }[];
    }
  | InsertTextOp
  | DeleteTextOp
  | {
      /**
       * Mark a paragraph's own MARK as inserted or deleted (`w:pPr/w:rPr/w:ins|w:del`,
       * §17.13.5). The change is to the paragraph break itself, so no character carries it.
       */
      readonly op: 'setParagraphMarkRevision';
      readonly paragraphId: string;
      readonly kind: 'ins' | 'del';
      readonly revision: RevisionAttributionInput;
    }
  | {
      /**
       * Propose merging this paragraph into its PREDECESSOR by striking the predecessor's
       * mark. Addressed by the SECOND paragraph so a multi-paragraph delete marks each
       * paragraph's own predecessor rather than stamping the group head N times.
       */
      readonly op: 'proposeParagraphMerge';
      readonly paragraphId: string;
      readonly revision: RevisionAttributionInput;
    }
  | {
      /**
       * Place one piece of comment markup at a model offset.
       *
       * Separate from the comment BODY, which lives in another part: this op is the story half
       * of a comment write, and the two are staged in one package transaction.
       */
      readonly op: 'insertCommentMarker';
      readonly paragraphId: string;
      readonly offset: number;
      readonly commentId: string;
      readonly marker: 'start' | 'end' | 'reference';
    }
  | {
      /**
       * Accept one revision, resolving every site in this part that carries its triple.
       */
      readonly op: 'acceptRevision';
      readonly revision: RevisionAddress;
      /** When set, only wrappers with this element local name resolve (ins/del/moveFrom/moveTo). */
      readonly localName?: string;
    }
  | {
      readonly op: 'rejectRevision';
      readonly revision: RevisionAddress;
      readonly localName?: string;
    }
  | {
      /**
       * Accept every revision in the part, or in one exact note root, in ONE transaction and one
       * history entry.
       *
       * Deliberately not a loop over `acceptRevision`: a reviewer who accepts a document's
       * changes made one decision, and one undo should restore all of them.
       */
      readonly op: 'acceptAllRevisions';
      /** Internal shared-notes scope. When present, this must be the canonical id of a note root. */
      readonly scopeRootId?: string;
    }
  | {
      readonly op: 'rejectAllRevisions';
      /** Internal shared-notes scope. When present, this must be the canonical id of a note root. */
      readonly scopeRootId?: string;
    }
  | {
      readonly op: 'insertTab';
      readonly paragraphId: string;
      readonly offset: number;
      /** Write this as a TRACKED insertion, on the same terms as `insertText`. */
      readonly revision?: RevisionAttributionInput;
    }
  | {
      readonly op: 'insertHardBreak';
      readonly paragraphId: string;
      readonly offset: number;
      /** Write this as a TRACKED insertion, on the same terms as `insertText`. */
      readonly revision?: RevisionAttributionInput;
    }
  | {
      readonly op: 'insertPageBreak';
      readonly paragraphId: string;
      readonly offset: number;
      /** Write this as a TRACKED insertion, on the same terms as `insertText`. */
      readonly revision?: RevisionAttributionInput;
    }
  | {
      /**
       * Insert an allowlisted page-number complex field at a UTF-16 offset.
       *
       * `PAGE_X_OF_Y` is PAGE + literal " of " + NUMPAGES in one undoable op. Non-page
       * instructions are refused — never authored through this path.
       */
      readonly op: 'insertPageField';
      readonly paragraphId: string;
      readonly offset: number;
      readonly field: 'PAGE' | 'NUMPAGES' | 'SECTIONPAGES' | 'PAGE_X_OF_Y';
      /**
       * Write this as a TRACKED insertion, on the same terms as `insertText`.
       *
       * The whole field — every `w:fldChar`, the instruction, the `PAGE_X_OF_Y` literal —
       * goes into ONE `w:ins`, because the field is one proposal: rejecting it must take
       * the complete atom back, never leave a `begin` standing without its `end`.
       */
      readonly revision?: RevisionAttributionInput;
    }
  | {
      /**
       * Move a numbered paragraph to another `w:numPr/w:ilvl`.
       *
       * A list item's LEVEL is what selects its format out of `numbering.xml`, so this is
       * the op behind Increase/Decrease Indent on a list: the marker changes with it. A
       * paragraph carrying no `w:numPr` is refused rather than silently numbered.
       */
      readonly op: 'setListLevel';
      readonly paragraphId: string;
      readonly level: number;
    }
  | {
      /**
       * Put a paragraph in a list, or take it out of one.
       *
       * `numId` names a `w:num` in `numbering.xml`; null removes `w:numPr` entirely, which
       * is what turning a bullet off means. Everything else in `w:pPr` survives.
       */
      /**
       * Run properties of the PARAGRAPH MARK (`w:pPr/w:rPr`, ECMA-376 17.3.1.29).
       *
       * The mark carries the formatting a paragraph's own pilcrow has, and Word keeps it
       * in step whenever formatting is applied to a whole paragraph. It is what a list
       * marker inherits its face from — so without it, sizing a bulleted paragraph leaves
       * the bullet at the old size.
       */
      readonly op: 'setParagraphMarkProperties';
      readonly paragraphId: string;
      readonly properties: readonly OoxmlProperty[];
      /** Record this as a TRACKED format change (`w:pPr/w:rPr/w:rPrChange`, §17.13.5.31). */
      readonly revision?: RevisionAttributionInput;
    }
  | {
      readonly op: 'setListNumbering';
      readonly paragraphId: string;
      readonly numId: string | null;
      readonly level?: number;
    }
  | {
      /**
       * Replace a paragraph's custom tab stops, or clear them with an empty list.
       *
       * Its OWN op rather than a `w:tabs` entry in `setParagraphProperties`, because
       * `OoxmlProperty` is flat and `w:tabs` carries its meaning in `w:tab` children — the
       * same reason `setListNumbering` exists for `w:numPr`.
       */
      readonly op: 'setParagraphTabStops';
      readonly paragraphId: string;
      readonly stops: readonly TabStopWrite[];
      /**
       * Every stop position IN FORCE when the editor read the paragraph, including the
       * ones a style supplied.
       *
       * Tab stops are read through the cascade and written at the paragraph level, so a
       * replace alone cannot remove an inherited stop — the user clears a row, the style
       * puts it straight back, and the command reports success. A position that was in
       * force and is not in `stops` is suppressed with `w:val="clear"`, which is what the
       * value exists for (§17.3.1.37). Omit when the caller has no cascade to speak of;
       * the write is then a plain paragraph-level replace.
       */
      readonly inForcePositionsTwips?: readonly number[];
    }
  | {
      readonly op: 'splitParagraph';
      readonly paragraphId: string;
      readonly offset: number;
      /**
       * The `w:pStyle` the MINTED tail takes, instead of the head's own.
       *
       * A split otherwise clones the whole `w:pPr`, which is right for every property but
       * the style when the caller is an Enter at the end of a paragraph: Word gives that
       * new paragraph the style's `w:next`, so a heading is followed by body text rather
       * than by a second heading. `null` authors no `w:pStyle` at all, which is what the
       * document's default style is spelled as. Omit to clone the head's style unchanged.
       */
      readonly tailStyleId?: string | null;
    }
  | {
      /**
       * Split one `w:p` at MANY offsets in a single op.
       *
       * Equivalent to applying `splitParagraph` at each offset from the last to the first,
       * but the paragraph's content is cut in one pass and the parent's child sequence is
       * rebuilt once. A plain-text paste is a paragraph mark per line: as individual ops,
       * a large paste rebuilt the body — and re-sliced the pasted text — once per line,
       * which is quadratic in paste size.
       */
      readonly op: 'splitParagraphMany';
      readonly paragraphId: string;
      /**
       * Non-decreasing UTF-16 offsets; each produces one paragraph boundary. A repeated
       * offset produces an empty paragraph between the two boundaries — a blank line.
       */
      readonly offsets: readonly number[];
      /**
       * Propose the breaks rather than making them, exactly as the single split does.
       *
       * Every boundary is a paragraph mark this author is adding, so each paragraph that
       * PRECEDES one carries `w:rPr/w:ins`. Without it a multi-line paste in suggesting mode
       * tracked its text and not its breaks, and Reject left the extra paragraphs standing.
       */
      readonly revision?: RevisionAttributionInput;
    }
  | { readonly op: 'joinParagraphs'; readonly firstId: string; readonly secondId: string }
  | {
      readonly op: 'setRunProperties';
      readonly paragraphId: string;
      readonly start: number;
      readonly end: number;
      readonly properties: readonly OoxmlProperty[];
      /**
       * Record this as a TRACKED format change: each run keeps its new `w:rPr` and gains a
       * `w:rPrChange` (§17.13.5.30) holding the properties it had, so Reject restores them.
       */
      readonly revision?: RevisionAttributionInput;
      /**
       * When set, format only these runs (field result ownership). Offset range still
       * gates the edit and drives edge splits; without this, multi-run field results that
       * share one atom offset would homogenise under a single property bag.
       */
      readonly targetRunIds?: readonly string[];
    }
  | {
      readonly op: 'setParagraphProperties';
      readonly paragraphId: string;
      readonly properties: readonly OoxmlProperty[];
      /** Record this as a TRACKED format change (`w:pPrChange`, §17.13.5.29). */
      readonly revision?: RevisionAttributionInput;
    }
  | {
      /**
       * Set page-setup fields — page size, orientation, margins — on every targeted
       * `w:sectPr`: all of them (Word's "Apply to: Whole document", the default) or
       * only the one governing `anchorParagraphId`. A document whose write must reach
       * the implicit tail section gets a body-level `w:sectPr` minted as the body's
       * last child. Omitted fields are left exactly as authored per section. Explicit
       * dimensions are written literally; `orientation` WITHOUT dimensions swaps each
       * section's own (see `plannedSectionDimensions`), so distinct paper sizes
       * survive a whole-document flip.
       */
      readonly op: 'setSectionProperties';
      readonly pageWidthTwips?: number;
      readonly pageHeightTwips?: number;
      readonly orientation?: 'portrait' | 'landscape';
      readonly marginTopTwips?: number;
      readonly marginRightTwips?: number;
      readonly marginBottomTwips?: number;
      readonly marginLeftTwips?: number;
      /**
       * Word's "Apply to: This section": update only the section GOVERNING this
       * paragraph — the nearest mid-body `w:sectPr` at or after it, else the body-level
       * one. Absent means every section.
       */
      readonly anchorParagraphId?: string;
    }
  | {
      /**
       * End a section AT this paragraph: mint a `w:pPr/w:sectPr` cloning the governing
       * section's effective page setup, so the blocks up to and including this paragraph
       * become their own section. The paragraph must not already carry one.
       */
      readonly op: 'setSectionMark';
      readonly paragraphId: string;
      /**
       * Where the section that STARTS after this mark begins — Word's Breaks menu.
       *
       * `w:type` states how a section starts relative to the previous one (§17.6.22), so it
       * is written on the section FOLLOWING the mark, never on the minted one, which keeps
       * the cloned type because it starts where the section it was cut from did. `'nextPage'`
       * clears `w:type` (absent IS nextPage), so a next-page break inside a continuous
       * section really starts a page. Omitted leaves the following section untouched.
       */
      readonly breakType?: 'nextPage' | 'continuous';
    }
  | {
      /**
       * Wrap `[start, end)` of a paragraph in a `w:hyperlink`.
       *
       * The RANGE is the link — text and formatting inside it are untouched, and runs that
       * straddle either edge are divided so the link covers exactly the characters asked
       * for. Exactly one of `relationshipId` (an external target, already minted on the
       * package) or `anchor` (a bookmark in this document) names where it goes.
       *
       * A collapsed range is refused: a link with no text is markup with nothing to click,
       * and the caller that wants "insert a link with display text" inserts the text first.
       */
      readonly op: 'insertHyperlink';
      readonly paragraphId: string;
      readonly start: number;
      readonly end: number;
      readonly relationshipId?: string;
      readonly anchor?: string;
      readonly tooltip?: string;
      /**
       * Character style to mark the linked runs with (`w:rStyle`), normally `Hyperlink`.
       *
       * Written HERE rather than through `setRunProperties` because `w:rStyle` is preserved,
       * not accepted: it is not in the set a property write replaces, and putting it there
       * would make a later bold toggle delete it. Marking the text is part of making it a
       * link — Word does both in one operation — so the op that wraps it also styles it.
       * Omitted for a document that declares no such style.
       */
      readonly styleId?: string;
    }
  | {
      /**
       * Re-aim an existing link. `relationshipId` moves it to another external target,
       * `anchor` to a bookmark; supplying one CLEARS the other, so a link never ends up
       * carrying both and resolving by the wrong one.
       */
      readonly op: 'setHyperlinkTarget';
      readonly linkId: string;
      readonly relationshipId?: string;
      readonly anchor?: string;
      readonly tooltip?: string;
    }
  | {
      /**
       * Unlink: splice the `w:hyperlink`'s children into the paragraph in its place.
       *
       * The runs keep their identity, their formatting and their order, and any bookmark
       * markers inside the link stay exactly where they were. Only the link element goes,
       * which is what Word's Remove Hyperlink does — the text is not the link's, it was
       * only wrapped by it.
       */
      readonly op: 'removeHyperlink';
      readonly linkId: string;
    }
  | {
      /**
       * Replace one preserved `m:oMath` atom from bounded linear-math input.
       *
       * The complete equation changes as one unit. Internal OMML text never enters the
       * paragraph offset space, so callers cannot leave a partially edited math tree.
       */
      readonly op: 'setMathEquation';
      readonly equationId: string;
      readonly linear: string;
    }
  | {
      /** Remove one complete `m:oMath` atom. */
      readonly op: 'removeMathEquation';
      readonly equationId: string;
    }
  | {
      /**
       * Insert a NEW run-level content control at a text offset: `w:sdt` with a
       * `w:sdtPr` carrying the given tag (and alias/lock) and a `w:sdtContent`
       * holding one run of `text`.
       *
       * The write half of the custom-node contract (pro-review-and-custom-nodes):
       * a node's identity lives in `w:tag`, `sdtLocked` keeps Word users from
       * unwrapping the anchor, and the literal run text is what Word (and the
       * free tier) render. The TAG IS ATTACKER-ADJACENT ON READ but authored
       * here; it is written as an ordinary attribute value, so the serializer's
       * escaping covers it like every other attribute.
       */
      readonly op: 'insertInlineContentControl';
      readonly paragraphId: string;
      readonly offset: number;
      readonly tag: string;
      readonly text: string;
      readonly alias?: string;
      /** `w:lock` value; omitted writes no lock. */
      readonly lock?: 'sdtLocked' | 'sdtContentLocked' | 'contentLocked';
      /**
       * `w:dataBinding` — the customXml data part node this control mirrors.
       *
       * The payload half of the custom-node contract: `w:tag` caps at 64
       * characters, so anything larger lives in a data part and the control
       * points at it. All three attributes travel together because Word needs
       * all three — the store's `ds:itemID`, the XPath to the node's label, and
       * the prefix declaration that XPath's steps resolve through.
       *
       * A control that carries one is READ-ONLY in Word (verified against
       * `sdt-custom-node-databinding-word-roundtrip.docx`), and this engine
       * refuses content edits inside it for the same reason — see
       * `bindingRefusal`. That is what keeps the store and the page from
       * drifting: there is no edit that could move one without the other.
       *
       * Nothing here is resolved or fetched. The op writes the three strings and
       * the store lane owns the part they name.
       */
      readonly dataBinding?: {
        readonly prefixMappings: string;
        readonly xpath: string;
        readonly storeItemId: string;
      };
    }
  | {
      /** Repeating-section item insert — unsupported at this layer (out of scope). */
      readonly op: 'addRepeatingSectionItem';
      readonly controlId: string;
      readonly index?: number;
    }
  | {
      /** Repeating-section item remove — unsupported at this layer (out of scope). */
      readonly op: 'removeRepeatingSectionItem';
      readonly controlId: string;
      readonly index: number;
    }
  | {
      /**
       * Remove a typed block and everything under it.
       *
       * Validation restricts this structural operation to `w:p`, `w:tbl`, and `w:tr`, and
       * refuses removals that would violate required-container or section-mark invariants.
       */
      readonly op: 'deleteBlock';
      readonly blockId: string;
    }
  | {
      /**
       * Insert a fresh empty table immediately before a block-level paragraph.
       *
       * Before, never after, so the anchor paragraph stays as the block that follows the
       * table: a `w:tbl` is not a valid final child of a story container, and two tables
       * that end up adjacent merge into one when the file is reopened. When the anchor's
       * previous sibling is already a table, a separating empty paragraph is authored with
       * it, which is what Word does for the same reason.
       */
      readonly op: 'insertTable';
      readonly beforeParagraphId: string;
      readonly rows: number;
      readonly cols: number;
      /** Width of every grid column, in twips. The caller divides the content width. */
      readonly columnWidthTwips: number;
    }
  | {
      /** Insert a fresh row above or below a canonical table row. */
      readonly op: 'insertTableRow';
      readonly tableId: string;
      readonly rowId: string;
      readonly where: 'above' | 'below';
      /** When present, author the row as a Word tracked insertion. */
      readonly revision?: RevisionAttributionInput;
    }
  | {
      /** Delete one canonical table row; refuses the final row. */
      readonly op: 'deleteTableRow';
      readonly tableId: string;
      readonly rowId: string;
      /** Optional anchor cell for column-aware caret recovery after deletion. */
      readonly referenceCellId?: string;
      /** When present, retain the row and author a Word tracked deletion. */
      readonly revision?: RevisionAttributionInput;
    }
  | {
      /** Insert one grid column left or right of a canonical `w:gridCol`. */
      readonly op: 'insertTableColumn';
      readonly tableId: string;
      readonly where: 'left' | 'right';
      readonly gridColumnId: string;
    }
  | {
      /**
       * Insert one grid column beside a first-row reference cell when `w:tblGrid` is absent.
       * Synthesizes a canonical grid before mutation.
       */
      readonly op: 'insertTableColumn';
      readonly tableId: string;
      readonly where: 'left' | 'right';
      readonly referenceCellId: string;
    }
  | {
      /** Delete one canonical grid column; refuses the final column. */
      readonly op: 'deleteTableColumn';
      readonly tableId: string;
      readonly gridColumnId: string;
    }
  | {
      /**
       * Resize one internal divider between two adjacent canonical grid columns.
       * Preserves the pair total and sets fixed table layout.
       */
      readonly op: 'setTableColumnWidths';
      readonly tableId: string;
      readonly leftGridColumnId: string;
      readonly rightGridColumnId: string;
      readonly leftWidthTwips: number;
      readonly rightWidthTwips: number;
    }
  | {
      /**
       * Resize the outer-right edge: last grid column, matching cells, and `w:tblW` total.
       */
      readonly op: 'setTableRightEdgeWidth';
      readonly tableId: string;
      readonly gridColumnId: string;
      readonly columnWidthTwips: number;
      readonly tableWidthTwips: number;
    }
  | {
      /** Set one authored table row to an exact height in twips. */
      readonly op: 'setTableRowHeight';
      readonly tableId: string;
      readonly rowId: string;
      readonly heightTwips: number;
    }
  | {
      /** Clear the active edge target on a bounded rectangular cell selection. */
      readonly op: 'setTableCellBorders';
      readonly tableId: string;
      readonly cellIds: readonly string[];
      readonly scope: 'none';
      readonly target: TableBorderEdgeTarget;
    }
  | {
      /** Apply a complete border spec to the requested edge target. */
      readonly op: 'setTableCellBorders';
      readonly tableId: string;
      readonly cellIds: readonly string[];
      readonly scope: TableBorderEdgeTarget;
      readonly spec: TableBorderSpecInput;
    }
  | {
      /** Write or remove direct selected-cell shading (`w:tcPr/w:shd`). */
      readonly op: 'setTableCellFill';
      readonly tableId: string;
      readonly cellIds: readonly string[];
      readonly color: TreeDocColorValue | null;
    }
  | {
      /** Set direct selected-cell vertical alignment (`w:tcPr/w:vAlign`). */
      readonly op: 'setTableCellVerticalAlignment';
      readonly tableId: string;
      readonly cellIds: readonly string[];
      readonly alignment: 'top' | 'center' | 'bottom';
    }
  | {
      /** Allocate an empty header/footer part and declare it on a section. Package-level. */
      readonly op: 'createHeaderFooter';
      readonly sectionIndex: number;
      readonly kind: 'header' | 'footer';
      readonly variant: 'default' | 'first' | 'even';
      /** When true, also set section `w:titlePg` in the same package transaction. */
      readonly titlePage?: boolean;
      /** When true, also set document `w:evenAndOddHeaders` in the same package transaction. */
      readonly evenAndOddHeaders?: boolean;
    }
  | {
      /** Remove a section's declared header/footer reference; GC when orphaned. Package-level. */
      readonly op: 'deleteHeaderFooter';
      readonly sectionIndex: number;
      readonly kind: 'header' | 'footer';
      readonly variant: 'default' | 'first' | 'even';
    }
  | {
      /** Drop a declared ref so the section inherits from the previous. Package-level. */
      readonly op: 'linkToPrevious';
      readonly sectionIndex: number;
      readonly kind: 'header' | 'footer';
      readonly variant: 'default' | 'first' | 'even';
    }
  | {
      /** Clone an inherited part into a new declared reference. Package-level. */
      readonly op: 'unlinkFromPrevious';
      readonly sectionIndex: number;
      readonly kind: 'header' | 'footer';
      readonly variant: 'default' | 'first' | 'even';
    }
  | {
      /**
       * Section/document furniture options: `titlePg`, header/footer distances on the
       * section; `evenAndOddHeaders` document-wide in settings. Package-level.
       */
      readonly op: 'setSectionFurnitureOptions';
      readonly sectionIndex?: number;
      readonly titlePage?: boolean;
      readonly evenAndOddHeaders?: boolean;
      readonly headerDistanceTwips?: number;
      readonly footerDistanceTwips?: number;
    }
  | {
      /**
       * Insert a footnote or endnote: body reference + notes-part body (+ create the
       * notes part/rel/content-type when missing). Package-level; one ModelChange.
       */
      readonly op: 'insertNote';
      readonly noteKind: 'footnote' | 'endnote';
      readonly paragraphId: string;
      readonly offset: number;
      /**
       * Write the citing REFERENCE as a tracked insertion (`w:ins` around the reference
       * run), on the same terms as `insertText`. The note body itself is not revision
       * markup: rejecting the reference removes it, and the body cascade sweeps the
       * orphaned note exactly as an untracked reference deletion does.
       */
      readonly revision?: RevisionAttributionInput;
    }
  | {
      /**
       * Delete a note body and every matching reference (body, HF, other notes).
       * Package-level; one ModelChange.
       */
      readonly op: 'deleteNote';
      readonly noteKind: 'footnote' | 'endnote';
      readonly noteId: number;
    }
  | {
      /** Convert a footnote ↔ endnote, reallocating id in the target part. Package-level. */
      readonly op: 'convertNote';
      readonly fromKind: 'footnote' | 'endnote';
      readonly noteId: number;
    }
  | {
      /**
       * Convert every normal footnote↔endnote of `fromKind` in one package transaction.
       * One ModelChange / undo unit; bounded by notes-part size.
       */
      readonly op: 'convertAllNotes';
      readonly fromKind: 'footnote' | 'endnote';
    }
  | {
      /**
       * Write a content control's VALUE, in the vocabulary its own type accepts.
       *
       * One transaction for the whole transition: the content, `w:showingPlcHdr`, and the
       * type's own record of the value (`@w:lastValue`, `@w:fullDate`, `w14:checked`) move
       * together, because a control whose glyph says checked and whose flag says unchecked is
       * a document Word and this engine read differently.
       */
      readonly op: 'setContentControlValue';
      readonly controlId: string;
      /** String is the editor-facing v2 form; structured input is the automation form. */
      readonly value: string | ContentControlValueInput;
    }
  | {
      /**
       * Author the metadata a control carries: its tag, its title, its lock.
       *
       * `null` removes the property. Everything else in `CT_SdtPr` — the type payload, a data
       * binding, an extension this vocabulary does not model — survives in schema order.
       */
      readonly op: 'setContentControlProperties';
      readonly controlId: string;
      readonly tag?: string | null;
      readonly alias?: string | null;
      readonly lock?: ContentControlLock;
    }
  | {
      /**
       * Remove a control. `keepContent` splices its content into its place — Word's own
       * "Remove content control" — and false takes the content with it.
       */
      readonly op: 'removeContentControl';
      readonly controlId: string;
      /** Defaults to true for the editor-facing v2 operation. */
      readonly keepContent?: boolean;
    }
  | {
      /**
       * Wrap `[start, end)` of a paragraph in a new control of the named type.
       *
       * A control is a SIBLING of runs, never a thing inside one, so a range ending mid-run
       * splits that run at both edges first. The characters and their formatting are the ones
       * that were there; only the run boundaries move.
       */
      readonly op: 'insertContentControl';
      readonly paragraphId: string;
      readonly start: number;
      readonly end: number;
      readonly type: InsertableContentControlKind;
      readonly tag?: string;
      readonly alias?: string;
      readonly lock?: ContentControlLock;
    }
  | {
      /**
       * Author `w:footnotePr` / `w:endnotePr` at document (settings) or section scope.
       * Refuse endnote `pageBottom`. Package-level; does not invent props on unedited saves.
       */
      readonly op: 'setNoteProperties';
      readonly scope: 'document' | 'section';
      readonly sectionIndex?: number;
      readonly footnote?: {
        readonly numFmt?: string;
        readonly numRestart?: string;
        readonly position?: string;
        readonly numStart?: number;
      };
      readonly endnote?: {
        readonly numFmt?: string;
        readonly numRestart?: string;
        readonly position?: string;
        readonly numStart?: number;
      };
    }
  | {
      /**
       * Insert clipboard-fragment blocks at a paragraph position, atomically.
       *
       * Blocks only — resources (styles, numbering, media, rels, note parts) merge through
       * the package-edit path in the same transaction, and the whole commit is promoted to
       * a package undo unit. A merged edge paragraph takes the properties of the paragraph
       * mark that ends it: the fragment's first mark leading, the host's original mark
       * trailing. Nodes receive fresh ids at apply.
       */
      readonly op: 'insertFragment';
      readonly paragraphId: string;
      readonly offset: number;
      readonly blocks: readonly OoxmlNode[];
      /** True when the fragment's last paragraph mark travelled (its paragraph stays whole). */
      readonly lastMarkCovered?: boolean;
    }
  | {
      readonly op: 'insertDrawing';
      readonly paragraphId: string;
      readonly offset: number;
      readonly drawing: OoxmlDrawingNode;
      /** Present in suggesting mode: the drawing's run goes into a `w:ins` as one proposal. */
      readonly revision?: RevisionAttributionInput;
    }
  | {
      readonly op: 'replaceDrawingResource';
      readonly drawingNodeId: string;
      readonly relationshipId: string;
    }
  | {
      readonly op: 'deleteDrawing';
      readonly drawingNodeId: string;
      /** Suggesting-mode tracked deletion is refused; owned by typed-revisions-and-comments. */
      readonly revision?: RevisionAttributionInput;
    }
  | {
      readonly op: 'resizeDrawing';
      readonly drawingNodeId: string;
      readonly extentEmu: { readonly cx: number; readonly cy: number };
    }
  | { readonly op: 'cropDrawing'; readonly drawingNodeId: string; readonly crop: SourceCrop }
  | {
      readonly op: 'positionDrawing';
      readonly drawingNodeId: string;
      readonly position: DrawingPositionInput;
    }
  | {
      readonly op: 'setDrawingWrap';
      readonly drawingNodeId: string;
      readonly wrap: ImageWrapTarget;
    }
  | {
      readonly op: 'setDrawingMetadata';
      readonly drawingNodeId: string;
      readonly title: string;
      readonly description: string;
      /** Omitted preserves existing `a:hlinkClick`; null removes it; a URL needs a package transaction. */
      readonly hyperlink?: string | null;
    }
  | {
      readonly op: 'setDrawingLocks';
      readonly drawingNodeId: string;
      readonly locks: DrawingLocksInput;
    }
  | {
      readonly op: 'transformDrawing';
      readonly drawingNodeId: string;
      readonly action: 'rotateCW' | 'rotateCCW' | 'flipH' | 'flipV';
    }
  | {
      /**
       * Replace a detected TOC field's cached result paragraphs and ensure heading bookmarks.
       * Preserves field chrome / instruction. One undo unit (phase A of TOC refresh).
       */
      readonly op: 'replaceTocResult';
      readonly tocId: string;
      readonly entries: readonly {
        readonly level: number;
        readonly text: string;
        readonly headingParagraphId: string;
        readonly bookmarkName: string;
        readonly pageNumberText: string;
      }[];
      readonly bookmarksToCreate: readonly {
        readonly paragraphId: string;
        readonly name: string;
      }[];
    }
  | {
      /**
       * Rewrite page-number text runs inside existing TOC result paragraphs.
       * One undo unit (phase B of TOC refresh).
       */
      readonly op: 'rewriteTocPageNumbers';
      readonly tocId: string;
      readonly updates: readonly {
        readonly paragraphId: string;
        readonly pageNumberText: string;
      }[];
    }
  | SetTextFormFieldDefaultOp
  | {
      /**
       * Rewrite recognized fields' cached RESULT runs in place — between the `separate` and
       * `end` fldChars, or a `w:fldSimple`'s content. The instruction is never modified; a
       * result holding anything but plain runs is skipped (see `tree-op-field-results.ts`).
       */
      readonly op: 'refreshFieldResults';
      readonly updates: readonly {
        readonly paragraphId: string;
        /** Node id of the field's begin `w:fldChar`, or of the `w:fldSimple` element. */
        readonly fieldNodeId: string;
        readonly text: string;
      }[];
    };

/** Drawing mutation ops from typed-drawings-and-images task 11. */
export type DrawingTreeDocOp = Extract<
  TreeDocOp,
  {
    readonly op:
      | 'insertDrawing'
      | 'replaceDrawingResource'
      | 'deleteDrawing'
      | 'resizeDrawing'
      | 'cropDrawing'
      | 'positionDrawing'
      | 'setDrawingWrap'
      | 'setDrawingMetadata'
      | 'setDrawingLocks'
      | 'transformDrawing';
  }
>;

/** Just the `op` discriminants, for dispatch tables and validation. */
export type TreeDocOpKind = TreeDocOp['op'];

/** Every {@link TreeDocOpKind}, for validation and exhaustiveness checks. */
export const TREE_DOC_OP_KINDS = [
  'replaceStoryBlocks',
  'insertText',
  'deleteText',
  'setParagraphMarkRevision',
  'proposeParagraphMerge',
  'insertCommentMarker',
  'acceptRevision',
  'rejectRevision',
  'acceptAllRevisions',
  'rejectAllRevisions',
  'insertTab',
  'insertHardBreak',
  'insertPageBreak',
  'insertPageField',
  'setListLevel',
  'setListNumbering',
  'setParagraphTabStops',
  'setParagraphMarkProperties',
  'splitParagraph',
  'splitParagraphMany',
  'joinParagraphs',
  'setRunProperties',
  'setParagraphProperties',
  'setSectionProperties',
  'setSectionMark',
  'insertHyperlink',
  'setHyperlinkTarget',
  'removeHyperlink',
  'setMathEquation',
  'removeMathEquation',
  'setContentControlValue',
  'removeContentControl',
  'insertInlineContentControl',
  'addRepeatingSectionItem',
  'removeRepeatingSectionItem',
  'deleteBlock',
  'insertTable',
  'insertTableRow',
  'deleteTableRow',
  'insertTableColumn',
  'deleteTableColumn',
  'setTableColumnWidths',
  'setTableRightEdgeWidth',
  'setTableRowHeight',
  'setTableCellBorders',
  'setTableCellFill',
  'setTableCellVerticalAlignment',
  'createHeaderFooter',
  'deleteHeaderFooter',
  'linkToPrevious',
  'unlinkFromPrevious',
  'setSectionFurnitureOptions',
  'insertNote',
  'deleteNote',
  'convertNote',
  'convertAllNotes',
  'setNoteProperties',
  'setContentControlProperties',
  'insertContentControl',
  'insertFragment',
  'insertDrawing',
  'replaceDrawingResource',
  'deleteDrawing',
  'resizeDrawing',
  'cropDrawing',
  'positionDrawing',
  'setDrawingWrap',
  'setDrawingMetadata',
  'setDrawingLocks',
  'transformDrawing',
  'insertToc',
  'replaceTocResult',
  'rewriteTocPageNumbers',
  'refreshFieldResults',
  'setTextFormFieldDefault',
] as const satisfies readonly TreeDocOpKind[];

// Compile-time exhaustiveness, matching the legacy `DOC_OP_KINDS` guard: a new op must be
// listed here or this fails to typecheck, so it can never be silently unvalidated.
type _MissingTreeOp = Exclude<TreeDocOpKind, (typeof TREE_DOC_OP_KINDS)[number]>;
const _treeOpsExhaustive: _MissingTreeOp extends never ? true : ['missing', _MissingTreeOp] = true;
void _treeOpsExhaustive;

/**
 * How far a committed op can reach, so layout can scope its work (task 5.2).
 *
 * `text-local` touches one paragraph's characters; `paragraph-local` changes one
 * paragraph's own properties; `flow-structural` changes the block sequence and can
 * repaginate everything after it; `global` invalidates every page that shares the
 * edited story (header/footer parts attached to many sections/pages).
 */
/**
 * How far an op's effects reach — what layout must re-do after it.
 *
 * The knob incremental layout turns: a `text-local` edit re-breaks one paragraph, while a
 * `global` one invalidates the document.
 */
export type ImpactClass = 'text-local' | 'paragraph-local' | 'flow-structural' | 'global';

/**
 * What one applied op changed: the ids dirtied, created and deleted.
 *
 * These ids are what let layout and paint re-do only what moved instead of the whole document.
 */
export interface TreeOpEffect {
  readonly dirty: readonly string[];
  readonly created: readonly string[];
  readonly deleted: readonly string[];
  readonly split?: { readonly from: string; readonly tail: string };
  /** One entry per boundary of a many-way split, in document order. */
  readonly splits?: readonly { readonly from: string; readonly tail: string }[];
  readonly join?: { readonly kept: string; readonly removed: string };
  readonly dependencyKeys: readonly string[];
  readonly impact: ImpactClass;
  /** First post-edit caret paragraph for table column structural ops. */
  readonly caret?: { readonly paragraphId: string };
}

/** Post-edit caret target published by a committed store transaction. */
export interface TreeOpCaret {
  readonly paragraphId: string;
}

/**
 * Why an op was refused.
 *
 * `not-adjacent-siblings` is the notable one: a join across table cells is refused rather than
 * silently merging content out of the cell that owned it.
 */
export type TreeOpRejection =
  | 'unknown-op'
  | 'unknown-paragraph'
  | 'not-a-paragraph'
  | 'offset-out-of-range'
  | 'invalid-range'
  | 'not-a-list-paragraph'
  | 'splits-surrogate-pair'
  | 'invalid-text'
  | 'unsupported-property'
  | 'invalid-property-value'
  | 'not-adjacent-siblings'
  /**
   * The addressed position is strictly inside content nothing can divide: a hyperlink, an
   * inline content control, a revision wrapper, or an atomic field.
   *
   * Distinct from `invalid-range`, which is an offset the paragraph does not have. This one is
   * a real offset that is not a PLACE — refused rather than resolved to the nearest one, so a
   * caller learns the node would not have landed where they asked.
   */
  | 'indivisible-content'
  | 'unknown-block'
  | 'not-a-block'
  | 'block-required'
  | 'carries-section-mark'
  /** The transaction named a part the package does not hold. */
  | 'unknown-part'
  /**
   * The transaction would have published a package that does not open: a relationship
   * pointing at a part nobody created, or a part with no declared content type.
   */
  | 'package-invariant'
  /** No revision in this part carries the addressed `(id, author, date)` triple. */
  | 'unknown-revision'
  /**
   * A matched revision is a kind whose accept/reject semantics are structural and not
   * implemented. Refusing is deliberate: removing the markup alone would report the decision
   * applied while leaving the row, cell, or section it describes untouched.
   */
  | 'unsupported-revision'
  | 'tree-invariant'
  /** No content control in this part carries the addressed node id. */
  | 'unknown-content-control'
  /** The addressed node exists and is not a `w:sdt`. */
  | 'not-a-content-control'
  /**
   * A content control's `w:lock` — or one an enclosing control imposes — forbids this.
   *
   * The same code for an edit inside `contentLocked` content and for the removal of an
   * `sdtLocked` control: both are "the document says no", and the two halves are already
   * distinguished by which operation was refused.
   */
  | 'locked'
  /** The control declares `w:dataBinding`; its value belongs to a custom XML part. */
  | 'bound'
  /** The value offered is not one this control's type accepts. */
  | 'typeMismatch'
  | 'unknown-control'
  | 'unsupported'
  /** Malformed lifecycle args / first-section link — mirrors Editor `invalidArgs`. */
  | 'invalidArgs'
  /** The addressed table id is missing, duplicated, or not a typed table. */
  | 'unknown-table'
  /** The addressed row id is missing or not a direct child of the table. */
  | 'unknown-row'
  /** A table property container appears more than once on a typed node. */
  | 'duplicate-property-container'
  /**
   * A row holds a `w:tc` inside a cell-level wrapper such as `w:sdt`, so the row's grid
   * mapping cannot be trusted and the inserted row would not match it.
   */
  | 'row-hides-cell'
  /** Column edit refused because the table carries horizontal or vertical merges. */
  | 'table-has-merge'
  /** The addressed grid column id is missing or ambiguous without `w:tblGrid`. */
  | 'unknown-grid-column'
  /** The operation would exceed bounded table topology limits. */
  | 'resource-limit'
  /** The addressed node is not a top-level `w:drawing`. */
  | 'not-a-drawing'
  /** No `w:drawing` with this id exists in the part. */
  | 'unknown-drawing'
  /** The drawing's graphic payload is not a supported picture. */
  | 'not-a-picture-drawing'
  /** A lock flag or `@locked` forbids this mutation. */
  | 'drawing-locked'
  /** Finite EMU extent, crop, or position value is out of range. */
  | 'invalid-drawing-value'
  /** Insertion would cross a table-cell boundary or wrong story container. */
  | 'cross-cell-drawing'
  /** Suggesting-mode drawing deletion is not implemented in this change. */
  | 'trackedDrawingDeletionUnsupported'
  /** Hyperlink target creation or change needs an OPC relationship in a package transaction. */
  | 'packageTransactionRequired'
  /** A clipboard fragment block nests deeper than the recursion cap. */
  | 'fragment-too-deep'
  /** A clipboard fragment block is not a paragraph, table, or content control subtree. */
  | 'fragment-invalid-block'
  /** A clipboard fragment exceeds its block or node budget. */
  | 'fragment-resource-budget';

/** Whether an op applied, with the effect it produced or the reason it was refused. */
export type TreeOpResult =
  | { readonly ok: true; readonly part: OoxmlPart; readonly effect: TreeOpEffect }
  | { readonly ok: false; readonly reason: TreeOpRejection; readonly detail?: string };
