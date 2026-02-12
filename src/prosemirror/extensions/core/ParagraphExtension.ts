/**
 * Paragraph Extension — paragraph node with alignment, spacing, indent, style commands
 *
 * Moves:
 * - NodeSpec from nodes.ts (paragraph, ParagraphAttrs, paragraphAttrsToDOMStyle, getListClass helpers)
 * - Commands from paragraph.ts (alignment, spacing, indent, style)
 */

import type { NodeSpec, Schema } from 'prosemirror-model';
import type { Command, EditorState } from 'prosemirror-state';
import type {
  ParagraphAlignment,
  LineSpacingRule,
  ParagraphFormatting,
  TextFormatting,
  NumberFormat,
  TabStop,
  TabStopAlignment,
  TabLeader,
} from '../../../types/document';
import { paragraphToStyle } from '../../../utils/formatToStyle';
import { createNodeExtension } from '../create';
import type { ExtensionContext, ExtensionRuntime } from '../types';
import type { ParagraphAttrs } from '../../schema/nodes';

// ============================================================================
// HELPERS (from nodes.ts)
// ============================================================================

function paragraphAttrsToDOMStyle(attrs: ParagraphAttrs): string {
  let indentLeft = attrs.indentLeft;
  if (attrs.numPr?.numId && indentLeft == null) {
    const level = attrs.numPr.ilvl ?? 0;
    indentLeft = (level + 1) * 720;
  }

  const formatting = {
    alignment: attrs.alignment,
    spaceBefore: attrs.spaceBefore,
    spaceAfter: attrs.spaceAfter,
    lineSpacing: attrs.lineSpacing,
    lineSpacingRule: attrs.lineSpacingRule,
    indentLeft: indentLeft,
    indentRight: attrs.indentRight,
    indentFirstLine: attrs.indentFirstLine,
    hangingIndent: attrs.hangingIndent,
    borders: attrs.borders,
    shading: attrs.shading,
  };

  const style = paragraphToStyle(formatting);
  return Object.entries(style)
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${value}`;
    })
    .join('; ');
}

function numFmtToClass(numFmt: NumberFormat | undefined): string {
  switch (numFmt) {
    case 'upperRoman':
      return 'docx-list-upper-roman';
    case 'lowerRoman':
      return 'docx-list-lower-roman';
    case 'upperLetter':
      return 'docx-list-upper-alpha';
    case 'lowerLetter':
      return 'docx-list-lower-alpha';
    case 'decimal':
    case 'decimalZero':
    default:
      return 'docx-list-decimal';
  }
}

function getListClass(
  numPr?: ParagraphAttrs['numPr'],
  listIsBullet?: boolean,
  listNumFmt?: NumberFormat
): string {
  if (!numPr?.numId) return '';

  const level = numPr.ilvl ?? 0;

  if (listIsBullet) {
    return `docx-list-bullet docx-list-level-${level}`;
  }

  const formatClass = numFmtToClass(listNumFmt);
  return `docx-list-numbered ${formatClass} docx-list-level-${level}`;
}

// ============================================================================
// PARAGRAPH NODE SPEC
// ============================================================================

const paragraphNodeSpec: NodeSpec = {
  content: 'inline*',
  group: 'block',
  attrs: {
    paraId: { default: null },
    textId: { default: null },
    alignment: { default: null },
    spaceBefore: { default: null },
    spaceAfter: { default: null },
    lineSpacing: { default: null },
    lineSpacingRule: { default: null },
    indentLeft: { default: null },
    indentRight: { default: null },
    indentFirstLine: { default: null },
    hangingIndent: { default: false },
    numPr: { default: null },
    listNumFmt: { default: null },
    listIsBullet: { default: null },
    listMarker: { default: null },
    styleId: { default: null },
    borders: { default: null },
    shading: { default: null },
    tabs: { default: null },
    pageBreakBefore: { default: null },
    keepNext: { default: null },
    keepLines: { default: null },
    defaultTextFormatting: { default: null },
    sectionBreakType: { default: null },
    outlineLevel: { default: null },
  },
  parseDOM: [
    {
      tag: 'p',
      getAttrs(dom): ParagraphAttrs {
        const element = dom as HTMLElement;
        return {
          paraId: element.dataset.paraId || undefined,
          alignment: element.dataset.alignment as ParagraphAlignment | undefined,
          styleId: element.dataset.styleId || undefined,
          sectionBreakType:
            (element.dataset.sectionBreak as ParagraphAttrs['sectionBreakType']) || undefined,
        };
      },
    },
  ],
  toDOM(node) {
    const attrs = node.attrs as ParagraphAttrs;
    const style = paragraphAttrsToDOMStyle(attrs);
    const listClass = getListClass(attrs.numPr, attrs.listIsBullet, attrs.listNumFmt);

    const domAttrs: Record<string, string> = {};

    if (style) {
      domAttrs.style = style;
    }

    if (listClass) {
      domAttrs.class = listClass;
    }

    if (attrs.paraId) {
      domAttrs['data-para-id'] = attrs.paraId;
    }

    if (attrs.alignment) {
      domAttrs['data-alignment'] = attrs.alignment;
    }

    if (attrs.styleId) {
      domAttrs['data-style-id'] = attrs.styleId;
    }

    if (attrs.listMarker) {
      domAttrs['data-list-marker'] = attrs.listMarker;
    }

    if (attrs.sectionBreakType) {
      domAttrs['data-section-break'] = attrs.sectionBreakType;
      domAttrs.class = (domAttrs.class ? domAttrs.class + ' ' : '') + 'docx-section-break';
    }

    return ['p', domAttrs, 0];
  },
};

// ============================================================================
// PARAGRAPH COMMAND HELPERS
// ============================================================================

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

function setParagraphAttrsCmd(attrs: Record<string, unknown>): Command {
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

// ============================================================================
// RESOLVED STYLE ATTRS (for applyStyle)
// ============================================================================

export interface ResolvedStyleAttrs {
  paragraphFormatting?: ParagraphFormatting;
  runFormatting?: TextFormatting;
}

// ============================================================================
// COMMAND FACTORIES
// ============================================================================

function makeSetAlignment(alignment: ParagraphAlignment): Command {
  return (state, dispatch) => {
    return setParagraphAttr('alignment', alignment)(state, dispatch);
  };
}

function makeSetLineSpacing(value: number, rule: LineSpacingRule = 'auto'): Command {
  return (state, dispatch) => {
    return setParagraphAttrsCmd({
      lineSpacing: value,
      lineSpacingRule: rule,
    })(state, dispatch);
  };
}

function makeIncreaseIndent(amount: number = 720): Command {
  return (state, dispatch) => {
    const { $from, $to } = state.selection;

    if (!dispatch) return true;

    let tr = state.tr;
    const seen = new Set<number>();

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

function makeDecreaseIndent(amount: number = 720): Command {
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

function makeApplyStyle(schema: Schema) {
  return (styleId: string, resolvedAttrs?: ResolvedStyleAttrs): Command => {
    return (state, dispatch) => {
      const { $from, $to } = state.selection;

      if (!dispatch) return true;

      let tr = state.tr;
      const seen = new Set<number>();

      // Build marks from run formatting if provided
      const styleMarks: import('prosemirror-model').Mark[] = [];
      if (resolvedAttrs?.runFormatting) {
        const rpr = resolvedAttrs.runFormatting;

        if (rpr.bold) {
          styleMarks.push(schema.marks.bold.create());
        }
        if (rpr.italic) {
          styleMarks.push(schema.marks.italic.create());
        }
        if (rpr.fontSize) {
          styleMarks.push(schema.marks.fontSize.create({ size: rpr.fontSize }));
        }
        if (rpr.fontFamily) {
          styleMarks.push(
            schema.marks.fontFamily.create({
              ascii: rpr.fontFamily.ascii,
              hAnsi: rpr.fontFamily.hAnsi,
              asciiTheme: rpr.fontFamily.asciiTheme,
            })
          );
        }
        if (rpr.color && !rpr.color.auto) {
          styleMarks.push(
            schema.marks.textColor.create({
              rgb: rpr.color.rgb,
              themeColor: rpr.color.themeColor,
              themeTint: rpr.color.themeTint,
              themeShade: rpr.color.themeShade,
            })
          );
        }
        if (rpr.underline && rpr.underline.style !== 'none') {
          styleMarks.push(
            schema.marks.underline.create({
              style: rpr.underline.style,
              color: rpr.underline.color,
            })
          );
        }
        if (rpr.strike || rpr.doubleStrike) {
          styleMarks.push(schema.marks.strike.create({ double: rpr.doubleStrike || false }));
        }
      }

      // Mark types that are controlled by style definitions
      const styleControlledMarks = [
        schema.marks.bold,
        schema.marks.italic,
        schema.marks.fontSize,
        schema.marks.fontFamily,
        schema.marks.textColor,
        schema.marks.underline,
        schema.marks.strike,
      ].filter(Boolean);

      state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
        if (node.type.name === 'paragraph' && !seen.has(pos)) {
          seen.add(pos);

          const newAttrs: Record<string, unknown> = {
            ...node.attrs,
            styleId,
          };

          if (resolvedAttrs?.paragraphFormatting) {
            const ppr = resolvedAttrs.paragraphFormatting;
            if (ppr.alignment !== undefined) newAttrs.alignment = ppr.alignment;
            if (ppr.spaceBefore !== undefined) newAttrs.spaceBefore = ppr.spaceBefore;
            if (ppr.spaceAfter !== undefined) newAttrs.spaceAfter = ppr.spaceAfter;
            if (ppr.lineSpacing !== undefined) newAttrs.lineSpacing = ppr.lineSpacing;
            if (ppr.lineSpacingRule !== undefined) newAttrs.lineSpacingRule = ppr.lineSpacingRule;
            if (ppr.indentLeft !== undefined) newAttrs.indentLeft = ppr.indentLeft;
            if (ppr.indentRight !== undefined) newAttrs.indentRight = ppr.indentRight;
            if (ppr.indentFirstLine !== undefined) newAttrs.indentFirstLine = ppr.indentFirstLine;
          }

          tr = tr.setNodeMarkup(pos, undefined, newAttrs);

          // Only modify marks when we have resolved style attrs
          // (fallback path without resolvedAttrs just sets styleId)
          if (resolvedAttrs) {
            const paragraphStart = pos + 1;
            const paragraphEnd = pos + node.nodeSize - 1;

            if (paragraphEnd > paragraphStart) {
              // Clear old style-controlled marks first
              for (const markType of styleControlledMarks) {
                tr = tr.removeMark(paragraphStart, paragraphEnd, markType);
              }
              // Then add the new style's marks
              for (const mark of styleMarks) {
                tr = tr.addMark(paragraphStart, paragraphEnd, mark);
              }
            }
          }
        }
      });

      if (styleMarks.length > 0) {
        tr = tr.setStoredMarks(styleMarks);
      }

      dispatch(tr.scrollIntoView());
      return true;
    };
  };
}

// ============================================================================
// QUERY HELPERS (exported for toolbar)
// ============================================================================

export function getParagraphAlignment(state: EditorState): ParagraphAlignment | null {
  const { $from } = state.selection;
  const paragraph = $from.parent;

  if (paragraph.type.name !== 'paragraph') return null;
  return paragraph.attrs.alignment || null;
}

export function getParagraphTabs(state: EditorState): TabStop[] | null {
  const { $from } = state.selection;
  const paragraph = $from.parent;

  if (paragraph.type.name !== 'paragraph') return null;
  return paragraph.attrs.tabs || null;
}

export function getStyleId(state: EditorState): string | null {
  const { $from } = state.selection;
  const paragraph = $from.parent;

  if (paragraph.type.name !== 'paragraph') return null;
  return paragraph.attrs.styleId || null;
}

// ============================================================================
// EXTENSION
// ============================================================================

export const ParagraphExtension = createNodeExtension({
  name: 'paragraph',
  schemaNodeName: 'paragraph',
  nodeSpec: paragraphNodeSpec,
  onSchemaReady(ctx: ExtensionContext): ExtensionRuntime {
    const applyStyleFn = makeApplyStyle(ctx.schema);

    return {
      commands: {
        setAlignment: (alignment: ParagraphAlignment) => makeSetAlignment(alignment),
        alignLeft: () => makeSetAlignment('left'),
        alignCenter: () => makeSetAlignment('center'),
        alignRight: () => makeSetAlignment('right'),
        alignJustify: () => makeSetAlignment('both'),
        setLineSpacing: (value: number, rule?: LineSpacingRule) => makeSetLineSpacing(value, rule),
        singleSpacing: () => makeSetLineSpacing(240),
        oneAndHalfSpacing: () => makeSetLineSpacing(360),
        doubleSpacing: () => makeSetLineSpacing(480),
        setSpaceBefore: (twips: number) => setParagraphAttr('spaceBefore', twips),
        setSpaceAfter: (twips: number) => setParagraphAttr('spaceAfter', twips),
        increaseIndent: (amount?: number) => makeIncreaseIndent(amount),
        decreaseIndent: (amount?: number) => makeDecreaseIndent(amount),
        applyStyle: (styleId: string, resolvedAttrs?: ResolvedStyleAttrs) =>
          applyStyleFn(styleId, resolvedAttrs),
        clearStyle: () => setParagraphAttr('styleId', null),
        insertSectionBreak: (breakType: 'nextPage' | 'continuous' | 'oddPage' | 'evenPage') =>
          setParagraphAttr('sectionBreakType', breakType),
        removeSectionBreak: () => setParagraphAttr('sectionBreakType', null),
        generateTOC: () => {
          return (
            state: EditorState,
            dispatch?: (tr: import('prosemirror-state').Transaction) => void
          ) => {
            if (!dispatch) return true;

            // Collect headings with outline levels
            const headings: { text: string; level: number }[] = [];
            state.doc.descendants((node) => {
              if (node.type.name === 'paragraph') {
                const level = node.attrs.outlineLevel;
                const styleId = node.attrs.styleId as string | null;
                // Heading styles typically have outline levels, or detect from styleId
                let effectiveLevel = level;
                if (effectiveLevel == null && styleId) {
                  const match = styleId.match(/^[Hh]eading(\d)$/);
                  if (match) effectiveLevel = parseInt(match[1], 10) - 1;
                }
                if (effectiveLevel != null && effectiveLevel >= 0 && effectiveLevel <= 8) {
                  let text = '';
                  node.forEach((child) => {
                    if (child.isText) text += child.text || '';
                  });
                  if (text.trim()) {
                    headings.push({ text: text.trim(), level: effectiveLevel });
                  }
                }
              }
            });

            if (headings.length === 0) return false;

            // Build TOC paragraphs and insert at cursor
            const { schema: s } = state;
            const tocNodes: import('prosemirror-model').Node[] = [];

            // TOC title
            tocNodes.push(
              s.node('paragraph', { alignment: 'center' }, [
                s.text('Table of Contents', [s.marks.bold.create()]),
              ])
            );

            // TOC entries
            for (const h of headings) {
              const indent = h.level * 720; // 0.5 inch per level
              tocNodes.push(
                s.node(
                  'paragraph',
                  {
                    indentLeft: indent > 0 ? indent : null,
                  },
                  [s.text(h.text)]
                )
              );
            }

            const tr = state.tr;
            const insertPos = state.selection.from;
            for (let i = tocNodes.length - 1; i >= 0; i--) {
              tr.insert(insertPos, tocNodes[i]);
            }
            dispatch(tr.scrollIntoView());
            return true;
          };
        },
        setTabs: (tabs: TabStop[]) => setParagraphAttr('tabs', tabs.length > 0 ? tabs : null),
        addTabStop: (
          position: number,
          alignment: TabStopAlignment = 'left',
          leader: TabLeader = 'none'
        ) => {
          return (
            state: EditorState,
            dispatch?: (tr: import('prosemirror-state').Transaction) => void
          ) => {
            const { $from } = state.selection;
            const paragraph = $from.parent;
            if (paragraph.type.name !== 'paragraph') return false;
            const currentTabs: TabStop[] = paragraph.attrs.tabs || [];
            const filtered = currentTabs.filter((t: TabStop) => t.position !== position);
            const newTabs = [...filtered, { position, alignment, leader }].sort(
              (a: TabStop, b: TabStop) => a.position - b.position
            );
            return setParagraphAttr('tabs', newTabs)(state, dispatch);
          };
        },
        removeTabStop: (position: number) => {
          return (
            state: EditorState,
            dispatch?: (tr: import('prosemirror-state').Transaction) => void
          ) => {
            const { $from } = state.selection;
            const paragraph = $from.parent;
            if (paragraph.type.name !== 'paragraph') return false;
            const currentTabs: TabStop[] = paragraph.attrs.tabs || [];
            const newTabs = currentTabs.filter((t: TabStop) => t.position !== position);
            return setParagraphAttr('tabs', newTabs.length > 0 ? newTabs : null)(state, dispatch);
          };
        },
      },
    };
  },
});
