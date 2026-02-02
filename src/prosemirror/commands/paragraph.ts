/**
 * Paragraph Formatting Commands
 *
 * ProseMirror commands for paragraph-level formatting:
 * - Alignment: left, center, right, justify
 * - Line spacing
 * - Indentation
 * - Lists: bullet, numbered, indent, outdent
 */

import type { Command, EditorState } from 'prosemirror-state';
import type { ParagraphAlignment, LineSpacingRule } from '../../types/document';

// ============================================================================
// ALIGNMENT
// ============================================================================

/**
 * Set paragraph alignment
 */
export function setAlignment(alignment: ParagraphAlignment): Command {
  return (state, dispatch) => {
    return setParagraphAttr('alignment', alignment)(state, dispatch);
  };
}

/**
 * Align left
 */
export const alignLeft: Command = setAlignment('left');

/**
 * Align center
 */
export const alignCenter: Command = setAlignment('center');

/**
 * Align right
 */
export const alignRight: Command = setAlignment('right');

/**
 * Justify
 */
export const alignJustify: Command = setAlignment('both');

// ============================================================================
// LINE SPACING
// ============================================================================

/**
 * Set line spacing
 * @param value - Line spacing value (240 = single, 360 = 1.5, 480 = double)
 * @param rule - Line spacing rule ('auto' for multiplier, 'exact' for fixed)
 */
export function setLineSpacing(value: number, rule: LineSpacingRule = 'auto'): Command {
  return (state, dispatch) => {
    return setParagraphAttrs({
      lineSpacing: value,
      lineSpacingRule: rule,
    })(state, dispatch);
  };
}

/**
 * Single line spacing (1.0)
 */
export const singleSpacing: Command = setLineSpacing(240);

/**
 * 1.5 line spacing
 */
export const oneAndHalfSpacing: Command = setLineSpacing(360);

/**
 * Double line spacing (2.0)
 */
export const doubleSpacing: Command = setLineSpacing(480);

// ============================================================================
// INDENTATION
// ============================================================================

/**
 * Increase paragraph indent
 * @param amount - Amount in twips (default: 720 = 0.5 inch)
 */
export function increaseIndent(amount: number = 720): Command {
  return (state, dispatch) => {
    const { $from, $to } = state.selection;

    if (!dispatch) return true;

    let tr = state.tr;
    const seen = new Set<number>();

    // Process all paragraphs in selection
    state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
      if (node.type.name === 'paragraph' && !seen.has(pos)) {
        seen.add(pos);
        const currentIndent = node.attrs.indentLeft || 0;
        tr = tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          indentLeft: currentIndent + amount,
        });
      }
    });

    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Decrease paragraph indent
 * @param amount - Amount in twips (default: 720 = 0.5 inch)
 */
export function decreaseIndent(amount: number = 720): Command {
  return (state, dispatch) => {
    const { $from, $to } = state.selection;

    if (!dispatch) return true;

    let tr = state.tr;
    const seen = new Set<number>();

    state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
      if (node.type.name === 'paragraph' && !seen.has(pos)) {
        seen.add(pos);
        const currentIndent = node.attrs.indentLeft || 0;
        const newIndent = Math.max(0, currentIndent - amount);
        tr = tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          indentLeft: newIndent > 0 ? newIndent : null,
        });
      }
    });

    dispatch(tr.scrollIntoView());
    return true;
  };
}

// ============================================================================
// LISTS
// ============================================================================

/**
 * Toggle bullet list on selected paragraphs
 */
export const toggleBulletList: Command = (state, dispatch) => {
  return toggleList(1)(state, dispatch); // numId 1 = bullet list
};

/**
 * Toggle numbered list on selected paragraphs
 */
export const toggleNumberedList: Command = (state, dispatch) => {
  return toggleList(2)(state, dispatch); // numId 2 = numbered list
};

/**
 * Toggle list with specific numId
 */
function toggleList(numId: number): Command {
  return (state, dispatch) => {
    const { $from, $to } = state.selection;

    // Check if current paragraph is already in this list type
    const paragraph = $from.parent;
    if (paragraph.type.name !== 'paragraph') return false;

    const currentNumPr = paragraph.attrs.numPr;
    const isInSameList = currentNumPr?.numId === numId;

    if (!dispatch) return true;

    let tr = state.tr;
    const seen = new Set<number>();

    state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
      if (node.type.name === 'paragraph' && !seen.has(pos)) {
        seen.add(pos);

        if (isInSameList) {
          // Remove list
          tr = tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            numPr: null,
          });
        } else {
          // Add list
          tr = tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            numPr: { numId, ilvl: node.attrs.numPr?.ilvl || 0 },
          });
        }
      }
    });

    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Increase list level (indent list item)
 */
export const increaseListLevel: Command = (state, dispatch) => {
  const { $from } = state.selection;
  const paragraph = $from.parent;

  if (paragraph.type.name !== 'paragraph') return false;
  if (!paragraph.attrs.numPr) return false;

  const currentLevel = paragraph.attrs.numPr.ilvl || 0;
  if (currentLevel >= 8) return false; // Max level

  if (!dispatch) return true;

  // Find paragraph position
  const paragraphPos = $from.before($from.depth);

  dispatch(
    state.tr
      .setNodeMarkup(paragraphPos, undefined, {
        ...paragraph.attrs,
        numPr: { ...paragraph.attrs.numPr, ilvl: currentLevel + 1 },
      })
      .scrollIntoView()
  );

  return true;
};

/**
 * Decrease list level (outdent list item)
 */
export const decreaseListLevel: Command = (state, dispatch) => {
  const { $from } = state.selection;
  const paragraph = $from.parent;

  if (paragraph.type.name !== 'paragraph') return false;
  if (!paragraph.attrs.numPr) return false;

  const currentLevel = paragraph.attrs.numPr.ilvl || 0;

  if (!dispatch) return true;

  const paragraphPos = $from.before($from.depth);

  if (currentLevel <= 0) {
    // Remove from list entirely
    dispatch(
      state.tr
        .setNodeMarkup(paragraphPos, undefined, {
          ...paragraph.attrs,
          numPr: null,
        })
        .scrollIntoView()
    );
  } else {
    // Decrease level
    dispatch(
      state.tr
        .setNodeMarkup(paragraphPos, undefined, {
          ...paragraph.attrs,
          numPr: { ...paragraph.attrs.numPr, ilvl: currentLevel - 1 },
        })
        .scrollIntoView()
    );
  }

  return true;
};

/**
 * Remove list formatting from selected paragraphs
 */
export const removeList: Command = (state, dispatch) => {
  const { $from, $to } = state.selection;

  if (!dispatch) return true;

  let tr = state.tr;
  const seen = new Set<number>();

  state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
    if (node.type.name === 'paragraph' && node.attrs.numPr && !seen.has(pos)) {
      seen.add(pos);
      tr = tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        numPr: null,
      });
    }
  });

  dispatch(tr.scrollIntoView());
  return true;
};

// ============================================================================
// SPACING
// ============================================================================

/**
 * Set space before paragraph
 * @param twips - Space in twips (1440 twips = 1 inch)
 */
export function setSpaceBefore(twips: number): Command {
  return setParagraphAttr('spaceBefore', twips);
}

/**
 * Set space after paragraph
 * @param twips - Space in twips
 */
export function setSpaceAfter(twips: number): Command {
  return setParagraphAttr('spaceAfter', twips);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Set a single paragraph attribute on selected paragraphs
 */
function setParagraphAttr(attr: string, value: unknown): Command {
  return (state, dispatch) => {
    const { $from, $to } = state.selection;

    if (!dispatch) return true;

    let tr = state.tr;
    const seen = new Set<number>();

    state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
      if (node.type.name === 'paragraph' && !seen.has(pos)) {
        seen.add(pos);
        tr = tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          [attr]: value,
        });
      }
    });

    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Set multiple paragraph attributes on selected paragraphs
 */
function setParagraphAttrs(attrs: Record<string, unknown>): Command {
  return (state, dispatch) => {
    const { $from, $to } = state.selection;

    if (!dispatch) return true;

    let tr = state.tr;
    const seen = new Set<number>();

    state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
      if (node.type.name === 'paragraph' && !seen.has(pos)) {
        seen.add(pos);
        tr = tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          ...attrs,
        });
      }
    });

    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Get current paragraph alignment
 */
export function getParagraphAlignment(state: EditorState): ParagraphAlignment | null {
  const { $from } = state.selection;
  const paragraph = $from.parent;

  if (paragraph.type.name !== 'paragraph') return null;
  return paragraph.attrs.alignment || null;
}

/**
 * Check if current paragraph is in a list
 */
export function isInList(state: EditorState): boolean {
  const { $from } = state.selection;
  const paragraph = $from.parent;

  if (paragraph.type.name !== 'paragraph') return false;
  return !!paragraph.attrs.numPr?.numId;
}

/**
 * Get current list info
 */
export function getListInfo(state: EditorState): { numId: number; ilvl: number } | null {
  const { $from } = state.selection;
  const paragraph = $from.parent;

  if (paragraph.type.name !== 'paragraph') return null;
  if (!paragraph.attrs.numPr?.numId) return null;

  return {
    numId: paragraph.attrs.numPr.numId,
    ilvl: paragraph.attrs.numPr.ilvl || 0,
  };
}
