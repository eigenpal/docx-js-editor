/**
 * Footnote Reference Mark Extension
 *
 * Provides footnoteRef mark + insert/delete commands for footnotes and endnotes.
 */

import type { Command } from 'prosemirror-state';
import { createMarkExtension } from '../create';
import type { ExtensionContext, ExtensionRuntime } from '../types';

export const FootnoteRefExtension = createMarkExtension({
  name: 'footnoteRef',
  schemaMarkName: 'footnoteRef',
  markSpec: {
    attrs: {
      id: {},
      noteType: { default: 'footnote' },
    },
    parseDOM: [
      {
        tag: 'sup.docx-footnote-ref',
        getAttrs: (dom) => {
          const element = dom as HTMLElement;
          return {
            id: element.dataset.id || '',
            noteType: element.dataset.noteType || 'footnote',
          };
        },
      },
    ],
    toDOM(mark) {
      const attrs = mark.attrs as { id: string; noteType: string };
      return [
        'sup',
        {
          class: `docx-${attrs.noteType}-ref`,
          'data-id': attrs.id,
          'data-note-type': attrs.noteType,
        },
        0,
      ];
    },
  },
  onSchemaReady(ctx: ExtensionContext): ExtensionRuntime {
    const { schema } = ctx;

    function makeInsertNote(noteType: 'footnote' | 'endnote'): (id: number) => Command {
      return (id: number): Command => {
        return (state, dispatch) => {
          if (!dispatch) return true;

          const mark = schema.marks.footnoteRef.create({
            id: String(id),
            noteType,
          });
          const text = schema.text(String(id), [mark]);
          const tr = state.tr.replaceSelectionWith(text, false);
          dispatch(tr.scrollIntoView());
          return true;
        };
      };
    }

    const deleteNoteRef: Command = (state, dispatch) => {
      const { $from, $to } = state.selection;
      if (!dispatch) return true;

      let tr = state.tr;
      const markType = schema.marks.footnoteRef;

      // Remove footnoteRef marks in selection range
      tr = tr.removeMark($from.pos, $to.pos, markType);
      dispatch(tr.scrollIntoView());
      return true;
    };

    return {
      commands: {
        insertFootnote: makeInsertNote('footnote'),
        insertEndnote: makeInsertNote('endnote'),
        deleteNoteRef: () => deleteNoteRef,
      },
    };
  },
});
