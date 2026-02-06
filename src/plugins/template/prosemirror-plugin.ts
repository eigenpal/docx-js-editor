/**
 * Template ProseMirror Plugin
 *
 * Simple plugin that finds template tags using regex and creates decorations.
 * No separate parsing layer - everything happens here.
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as ProseMirrorNode } from 'prosemirror-model';

/**
 * Template tag types
 */
export type TagType = 'variable' | 'sectionStart' | 'sectionEnd' | 'invertedStart' | 'raw';

/**
 * A found template tag
 */
export interface TemplateTag {
  id: string;
  type: TagType;
  name: string;
  rawTag: string;
  from: number;
  to: number;
  /** For sections: nested variable names */
  nestedVars?: string[];
  /** True if this variable is inside a section (shown in section's nested vars) */
  insideSection?: boolean;
}

/**
 * Plugin state
 */
interface TemplatePluginState {
  tags: TemplateTag[];
  decorations: DecorationSet;
  hoveredId?: string;
  selectedId?: string;
}

/**
 * Regex to match template tags: {name}, {#name}, {/name}, {^name}, {@name}
 */
const TAG_REGEX = /\{([#/^@]?)([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\}/g;

/**
 * Plugin key
 */
export const templatePluginKey = new PluginKey<TemplatePluginState>('template');

/**
 * Generate a stable tag ID based on content, not a counter.
 * This ensures React keys remain stable across re-parses,
 * preventing DOM destruction/recreation (which causes blinking).
 */
function stableId(type: TagType, name: string, occurrence: number): string {
  return `${type}:${name}:${occurrence}`;
}

/**
 * Find all template tags in the document
 */
function findTags(doc: ProseMirrorNode): TemplateTag[] {
  // Collect all text with positions
  const parts: { text: string; pos: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      parts.push({ text: node.text, pos });
    }
    return true;
  });

  // Build combined text and position map
  let combined = '';
  const posMap: number[] = [];
  for (const p of parts) {
    for (let i = 0; i < p.text.length; i++) {
      posMap.push(p.pos + i);
    }
    combined += p.text;
  }

  // Find tags
  const tags: TemplateTag[] = [];
  const sectionStack: TemplateTag[] = [];
  const occurrences = new Map<string, number>();
  let match: RegExpExecArray | null;

  TAG_REGEX.lastIndex = 0;
  while ((match = TAG_REGEX.exec(combined)) !== null) {
    const [rawTag, prefix, name] = match;
    const from = posMap[match.index];
    const to = posMap[match.index + rawTag.length - 1] + 1;

    let type: TagType;
    if (prefix === '#') type = 'sectionStart';
    else if (prefix === '/') type = 'sectionEnd';
    else if (prefix === '^') type = 'invertedStart';
    else if (prefix === '@') type = 'raw';
    else type = 'variable';

    const key = `${type}:${name}`;
    const occ = occurrences.get(key) ?? 0;
    occurrences.set(key, occ + 1);

    const tag: TemplateTag = { id: stableId(type, name, occ), type, name, rawTag, from, to };

    // Track nested variables in sections
    if (type === 'sectionStart' || type === 'invertedStart') {
      tag.nestedVars = [];
      sectionStack.push(tag);
    } else if (type === 'sectionEnd') {
      // Pop matching section
      for (let i = sectionStack.length - 1; i >= 0; i--) {
        if (sectionStack[i].name === name) {
          sectionStack.splice(i, 1);
          break;
        }
      }
    } else if (type === 'variable' && sectionStack.length > 0) {
      // Add to nearest section's nested vars and mark as inside section
      const section = sectionStack[sectionStack.length - 1];
      section.nestedVars?.push(name);
      tag.insideSection = true;
    }

    tags.push(tag);
  }

  return tags;
}

/**
 * Get color for tag type
 */
function getColor(type: TagType): string {
  switch (type) {
    case 'sectionStart':
    case 'sectionEnd':
      return '#3b82f6';
    case 'invertedStart':
      return '#8b5cf6';
    case 'raw':
      return '#ef4444';
    default:
      return '#f59e0b';
  }
}

/**
 * Create decorations for tags
 */
function createDecorations(
  doc: ProseMirrorNode,
  tags: TemplateTag[],
  hoveredId?: string,
  selectedId?: string
): DecorationSet {
  const decorations: Decoration[] = [];

  for (const tag of tags) {
    const isHovered = tag.id === hoveredId;
    const isSelected = tag.id === selectedId;
    const color = getColor(tag.type);

    const classes = ['docx-template-tag'];
    if (isHovered) classes.push('hovered');
    if (isSelected) classes.push('selected');

    decorations.push(
      Decoration.inline(tag.from, tag.to, {
        class: classes.join(' '),
        'data-tag-id': tag.id,
        style: `background-color: ${color}22; border-radius: 2px;`,
      })
    );
  }

  return DecorationSet.create(doc, decorations);
}

/**
 * Compare two tag arrays for structural equality (same tag IDs in same order).
 * Position shifts (from/to) are expected during typing and don't count as structural changes.
 */
function tagsStructureEqual(a: TemplateTag[], b: TemplateTag[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false;
  }
  return true;
}

/**
 * Create the template plugin
 */
export function createTemplatePlugin(): Plugin<TemplatePluginState> {
  return new Plugin<TemplatePluginState>({
    key: templatePluginKey,

    state: {
      init(_, state) {
        const tags = findTags(state.doc);
        return {
          tags,
          decorations: createDecorations(state.doc, tags),
        };
      },

      apply(tr, value, _oldState, newState) {
        // Re-parse on doc change
        if (tr.docChanged) {
          const newTags = findTags(newState.doc);

          // If the tag structure is identical (same IDs in same order),
          // reuse the old tags array reference. This prevents PluginHost
          // from triggering React re-renders on every keystroke.
          if (tagsStructureEqual(value.tags, newTags)) {
            return {
              ...value,
              // Keep old tags reference (positions are stale but overlays
              // use getRectsForRange which queries the live DOM)
              decorations: value.decorations.map(tr.mapping, tr.doc),
            };
          }

          return {
            tags: newTags,
            decorations: createDecorations(
              newState.doc,
              newTags,
              value.hoveredId,
              value.selectedId
            ),
            hoveredId: value.hoveredId,
            selectedId: value.selectedId,
          };
        }

        // Handle hover/select changes
        const meta = tr.getMeta(templatePluginKey);
        if (meta) {
          const newHovered = meta.hoveredId ?? value.hoveredId;
          const newSelected = meta.selectedId ?? value.selectedId;
          return {
            ...value,
            hoveredId: newHovered,
            selectedId: newSelected,
            decorations: createDecorations(newState.doc, value.tags, newHovered, newSelected),
          };
        }

        // Map decorations
        return {
          ...value,
          decorations: value.decorations.map(tr.mapping, tr.doc),
        };
      },
    },

    props: {
      decorations(state) {
        return templatePluginKey.getState(state)?.decorations ?? DecorationSet.empty;
      },

      handleClick(view: EditorView, pos: number) {
        const tags = templatePluginKey.getState(view.state)?.tags ?? [];
        const clicked = tags.find((t) => pos >= t.from && pos <= t.to);

        if (clicked) {
          view.dispatch(view.state.tr.setMeta(templatePluginKey, { selectedId: clicked.id }));
          return true;
        }

        const current = templatePluginKey.getState(view.state)?.selectedId;
        if (current) {
          view.dispatch(view.state.tr.setMeta(templatePluginKey, { selectedId: undefined }));
        }
        return false;
      },

      handleDOMEvents: {
        mouseover(view: EditorView, event) {
          const el = (event.target as HTMLElement).closest?.('[data-tag-id]');
          const id = el?.getAttribute('data-tag-id') || undefined;
          const current = templatePluginKey.getState(view.state)?.hoveredId;

          if (id !== current) {
            view.dispatch(view.state.tr.setMeta(templatePluginKey, { hoveredId: id }));
          }
          return false;
        },

        mouseout(view: EditorView, event: MouseEvent) {
          const related = event.relatedTarget as HTMLElement;
          if (!related?.closest?.('[data-tag-id]')) {
            const current = templatePluginKey.getState(view.state)?.hoveredId;
            if (current) {
              view.dispatch(view.state.tr.setMeta(templatePluginKey, { hoveredId: undefined }));
            }
          }
          return false;
        },
      },
    },
  });
}

/**
 * Get tags from editor state
 */
export function getTemplateTags(state: import('prosemirror-state').EditorState): TemplateTag[] {
  return templatePluginKey.getState(state)?.tags ?? [];
}

/**
 * Set hovered tag
 */
export function setHoveredElement(view: EditorView, id: string | undefined): void {
  view.dispatch(view.state.tr.setMeta(templatePluginKey, { hoveredId: id }));
}

/**
 * Set selected tag
 */
export function setSelectedElement(view: EditorView, id: string | undefined): void {
  view.dispatch(view.state.tr.setMeta(templatePluginKey, { selectedId: id }));
}

/**
 * CSS styles for template decorations
 */
export const TEMPLATE_DECORATION_STYLES = `
.docx-template-tag {
  cursor: pointer;
  transition: background-color 0.1s;
}

.docx-template-tag:hover,
.docx-template-tag.hovered {
  filter: brightness(0.95);
}

.docx-template-tag.selected {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}
`;
