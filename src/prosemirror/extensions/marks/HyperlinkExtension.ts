/**
 * Hyperlink Mark Extension
 */

import { createMarkExtension } from '../create';
import { isMarkActive } from './markUtils';
import type { HyperlinkAttrs } from '../../schema/marks';
import type { Command, EditorState } from 'prosemirror-state';
import type { ExtensionContext, ExtensionRuntime } from '../types';

// ============================================================================
// HYPERLINK QUERY HELPERS (exported for toolbar)
// ============================================================================

export function isHyperlinkActive(state: EditorState): boolean {
  const hlType = state.schema.marks.hyperlink;
  if (!hlType) return false;
  return isMarkActive(state, hlType);
}

export function getHyperlinkAttrs(state: EditorState): { href: string; tooltip?: string } | null {
  const hlType = state.schema.marks.hyperlink;
  if (!hlType) return null;

  const { empty, $from, from, to } = state.selection;

  if (empty) {
    const marks = state.storedMarks || $from.marks();
    for (const mark of marks) {
      if (mark.type === hlType) {
        return { href: mark.attrs.href, tooltip: mark.attrs.tooltip };
      }
    }
    return null;
  }

  let attrs: { href: string; tooltip?: string } | null = null;
  state.doc.nodesBetween(from, to, (node) => {
    if (node.isText && attrs === null) {
      const mark = hlType.isInSet(node.marks);
      if (mark) {
        attrs = { href: mark.attrs.href, tooltip: mark.attrs.tooltip };
        return false;
      }
    }
    return true;
  });

  return attrs;
}

export function getSelectedText(state: EditorState): string {
  const { from, to, empty } = state.selection;
  if (empty) return '';
  return state.doc.textBetween(from, to, '');
}

// ============================================================================
// EXTENSION
// ============================================================================

export const HyperlinkExtension = createMarkExtension({
  name: 'hyperlink',
  schemaMarkName: 'hyperlink',
  markSpec: {
    attrs: {
      href: {},
      tooltip: { default: null },
      rId: { default: null },
    },
    inclusive: false,
    parseDOM: [
      {
        tag: 'a[href]',
        getAttrs: (dom) => {
          const element = dom as HTMLAnchorElement;
          return {
            href: element.getAttribute('href') || '',
            tooltip: element.getAttribute('title') || undefined,
          };
        },
      },
    ],
    toDOM(mark) {
      const attrs = mark.attrs as HyperlinkAttrs;
      const domAttrs: Record<string, string> = {
        href: attrs.href,
        target: '_blank',
        rel: 'noopener noreferrer',
      };
      if (attrs.tooltip) {
        domAttrs.title = attrs.tooltip;
      }
      return ['a', domAttrs, 0];
    },
  },
  onSchemaReady(ctx: ExtensionContext): ExtensionRuntime {
    const hlType = ctx.schema.marks.hyperlink;

    const setHyperlink = (href: string, tooltip?: string): Command => {
      return (state, dispatch) => {
        const { from, to, empty } = state.selection;

        if (empty) return false;

        if (dispatch) {
          const mark = hlType.create({ href, tooltip: tooltip || null });
          dispatch(state.tr.addMark(from, to, mark).scrollIntoView());
        }

        return true;
      };
    };

    const removeHyperlink: Command = (state, dispatch) => {
      const { from, to, empty } = state.selection;

      if (empty) {
        const $pos = state.selection.$from;
        const marks = $pos.marks();
        const linkMark = marks.find((m) => m.type === hlType);

        if (!linkMark) return false;

        let start = $pos.pos;
        let end = $pos.pos;

        const parent = $pos.parent;
        parent.forEach((node, offset) => {
          if (node.isText) {
            const nodeStart = $pos.start() + offset;
            const nodeEnd = nodeStart + node.nodeSize;

            if (nodeStart <= $pos.pos && $pos.pos <= nodeEnd) {
              const hasLink = node.marks.some((m) => m.type === hlType);
              if (hasLink) {
                start = Math.min(start, nodeStart);
                end = Math.max(end, nodeEnd);
              }
            }
          }
        });

        if (dispatch) {
          dispatch(state.tr.removeMark(start, end, hlType).scrollIntoView());
        }
        return true;
      }

      if (dispatch) {
        dispatch(state.tr.removeMark(from, to, hlType).scrollIntoView());
      }

      return true;
    };

    const insertHyperlink = (text: string, href: string, tooltip?: string): Command => {
      return (state, dispatch) => {
        if (dispatch) {
          const mark = hlType.create({ href, tooltip: tooltip || null });
          const textNode = state.schema.text(text, [mark]);
          dispatch(state.tr.replaceSelectionWith(textNode, false).scrollIntoView());
        }
        return true;
      };
    };

    return {
      commands: {
        setHyperlink,
        removeHyperlink: () => removeHyperlink,
        insertHyperlink,
      },
    };
  },
});
