/**
 * List Extension — list commands + keymaps
 *
 * No schema contribution — lists use paragraph attrs (numPr).
 * Provides: toggle bullet/number, indent/outdent, enter/backspace handling.
 */

import type { Command, EditorState } from 'prosemirror-state';
import { createExtension } from '../create';
import { Priority } from '../types';
import type { ExtensionRuntime } from '../types';

// ============================================================================
// CHAIN COMMANDS HELPER
// ============================================================================

function chainCommands(...commands: Command[]): Command {
  return (state, dispatch, view) => {
    for (const cmd of commands) {
      if (cmd(state, dispatch, view)) {
        return true;
      }
    }
    return false;
  };
}

// ============================================================================
// LIST COMMANDS
// ============================================================================

function toggleList(numId: number): Command {
  return (state, dispatch) => {
    const { $from, $to } = state.selection;

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
          tr = tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            numPr: null,
            listIsBullet: null,
            listNumFmt: null,
            listMarker: null,
          });
        } else {
          const isBullet = numId === 1;
          tr = tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            numPr: { numId, ilvl: node.attrs.numPr?.ilvl || 0 },
            listIsBullet: isBullet,
            listNumFmt: isBullet ? null : 'decimal',
            listMarker: null,
          });
        }
      }
    });

    dispatch(tr.scrollIntoView());
    return true;
  };
}

const toggleBulletList: Command = (state, dispatch) => {
  return toggleList(1)(state, dispatch);
};

const toggleNumberedList: Command = (state, dispatch) => {
  return toggleList(2)(state, dispatch);
};

const increaseListLevel: Command = (state, dispatch) => {
  const { $from } = state.selection;
  const paragraph = $from.parent;

  if (paragraph.type.name !== 'paragraph') return false;
  if (!paragraph.attrs.numPr) return false;

  const currentLevel = paragraph.attrs.numPr.ilvl || 0;
  if (currentLevel >= 8) return false;

  if (!dispatch) return true;

  const paragraphPos = $from.before($from.depth);

  dispatch(
    state.tr
      .setNodeMarkup(paragraphPos, undefined, {
        ...paragraph.attrs,
        numPr: { ...paragraph.attrs.numPr, ilvl: currentLevel + 1 },
        // Clear explicit indentation so layout engine computes from new level
        indentLeft: null,
        indentFirstLine: null,
        hangingIndent: null,
      })
      .scrollIntoView()
  );

  return true;
};

const decreaseListLevel: Command = (state, dispatch) => {
  const { $from } = state.selection;
  const paragraph = $from.parent;

  if (paragraph.type.name !== 'paragraph') return false;
  if (!paragraph.attrs.numPr) return false;

  const currentLevel = paragraph.attrs.numPr.ilvl || 0;

  if (!dispatch) return true;

  const paragraphPos = $from.before($from.depth);

  if (currentLevel <= 0) {
    dispatch(
      state.tr
        .setNodeMarkup(paragraphPos, undefined, {
          ...paragraph.attrs,
          numPr: null,
          listIsBullet: null,
          listNumFmt: null,
          listMarker: null,
          indentLeft: null,
          indentFirstLine: null,
          hangingIndent: null,
        })
        .scrollIntoView()
    );
  } else {
    dispatch(
      state.tr
        .setNodeMarkup(paragraphPos, undefined, {
          ...paragraph.attrs,
          numPr: { ...paragraph.attrs.numPr, ilvl: currentLevel - 1 },
          indentLeft: null,
          indentFirstLine: null,
          hangingIndent: null,
        })
        .scrollIntoView()
    );
  }

  return true;
};

const removeList: Command = (state, dispatch) => {
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
        listIsBullet: null,
        listNumFmt: null,
        listMarker: null,
      });
    }
  });

  dispatch(tr.scrollIntoView());
  return true;
};

// ============================================================================
// LIST QUERY HELPERS (exported for toolbar)
// ============================================================================

export function isInList(state: EditorState): boolean {
  const { $from } = state.selection;
  const paragraph = $from.parent;

  if (paragraph.type.name !== 'paragraph') return false;
  return !!paragraph.attrs.numPr?.numId;
}

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

// ============================================================================
// KEYMAP COMMANDS
// ============================================================================

function exitListOnEmptyEnter(): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty) return false;

    const paragraph = $from.parent;
    if (paragraph.type.name !== 'paragraph') return false;

    const numPr = paragraph.attrs.numPr;
    if (!numPr) return false;

    if (paragraph.textContent.length > 0) return false;

    if (dispatch) {
      const tr = state.tr.setNodeMarkup($from.before(), undefined, {
        ...paragraph.attrs,
        numPr: null,
        listIsBullet: null,
        listNumFmt: null,
        listMarker: null,
      });
      dispatch(tr);
    }
    return true;
  };
}

function splitListItem(): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty) return false;

    const paragraph = $from.parent;
    if (paragraph.type.name !== 'paragraph') return false;

    const numPr = paragraph.attrs.numPr;
    if (!numPr) return false;

    if (dispatch) {
      const { tr } = state;
      const pos = $from.pos;

      tr.split(pos, 1, [{ type: state.schema.nodes.paragraph, attrs: { ...paragraph.attrs } }]);

      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

function backspaceExitList(): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty) return false;

    if ($from.parentOffset !== 0) return false;

    const paragraph = $from.parent;
    if (paragraph.type.name !== 'paragraph') return false;

    const numPr = paragraph.attrs.numPr;
    if (!numPr) return false;

    if (dispatch) {
      const tr = state.tr.setNodeMarkup($from.before(), undefined, {
        ...paragraph.attrs,
        numPr: null,
        listIsBullet: null,
        listNumFmt: null,
        listMarker: null,
      });
      dispatch(tr);
    }
    return true;
  };
}

function increaseListIndent(): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    const paragraph = $from.parent;

    if (paragraph.type.name !== 'paragraph') return false;

    const numPr = paragraph.attrs.numPr;
    if (!numPr) return false;

    const currentLevel = numPr.ilvl ?? 0;
    if (currentLevel >= 8) return false;

    if (dispatch) {
      const tr = state.tr.setNodeMarkup($from.before(), undefined, {
        ...paragraph.attrs,
        numPr: { ...numPr, ilvl: currentLevel + 1 },
        // Clear explicit indentation so layout engine computes from new level
        indentLeft: null,
        indentFirstLine: null,
        hangingIndent: null,
      });
      dispatch(tr);
    }
    return true;
  };
}

function decreaseListIndent(): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    const paragraph = $from.parent;

    if (paragraph.type.name !== 'paragraph') return false;

    const numPr = paragraph.attrs.numPr;
    if (!numPr) return false;

    const currentLevel = numPr.ilvl ?? 0;
    if (currentLevel <= 0) {
      if (dispatch) {
        const tr = state.tr.setNodeMarkup($from.before(), undefined, {
          ...paragraph.attrs,
          numPr: null,
          listIsBullet: null,
          listNumFmt: null,
          listMarker: null,
          // Clear list-specific indentation when removing list
          indentLeft: null,
          indentFirstLine: null,
          hangingIndent: null,
        });
        dispatch(tr);
      }
      return true;
    }

    if (dispatch) {
      const tr = state.tr.setNodeMarkup($from.before(), undefined, {
        ...paragraph.attrs,
        numPr: { ...numPr, ilvl: currentLevel - 1 },
        // Clear explicit indentation so layout engine computes from new level
        indentLeft: null,
        indentFirstLine: null,
        hangingIndent: null,
      });
      dispatch(tr);
    }
    return true;
  };
}

function insertTab(): Command {
  return (state, dispatch) => {
    const { schema } = state;
    const tabType = schema.nodes.tab;

    if (!tabType) {
      return false;
    }

    if (dispatch) {
      const tr = state.tr.replaceSelectionWith(tabType.create());
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

// Import goToNextCell/goToPrevCell from table extension for chaining
import { goToNextCell, goToPrevCell } from '../nodes/TableExtension';

// ============================================================================
// EXTENSION
// ============================================================================

export const ListExtension = createExtension({
  name: 'list',
  priority: Priority.High, // Must be before base keymap
  onSchemaReady(): ExtensionRuntime {
    return {
      commands: {
        toggleBulletList: () => toggleBulletList,
        toggleNumberedList: () => toggleNumberedList,
        increaseListLevel: () => increaseListLevel,
        decreaseListLevel: () => decreaseListLevel,
        removeList: () => removeList,
      },
      keyboardShortcuts: {
        Tab: chainCommands(goToNextCell(), increaseListIndent(), insertTab()),
        'Shift-Tab': chainCommands(goToPrevCell(), decreaseListIndent()),
        'Shift-Enter': () => false, // Let base keymap handle this
        Enter: chainCommands(exitListOnEmptyEnter(), splitListItem()),
        Backspace: backspaceExitList(),
      },
    };
  },
});
