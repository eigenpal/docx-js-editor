/**
 * Template ProseMirror Plugin
 *
 * ProseMirror plugin that parses template syntax and manages decorations.
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { DecorationSet } from 'prosemirror-view';
import type { TemplateElement, TemplateScope, TemplateSchema, ValidationError } from './types';
import { parseDocument, addLineNumbers } from './parser';
import { buildScopes, createRootScope, flattenScopes } from './scope-tracker';
import { validateAll } from './validator';
import { inferDataStructure } from './schema-inferrer';
import { createDecorations, TEMPLATE_DECORATION_STYLES } from './decorations';

/**
 * Plugin state interface.
 */
interface TemplatePluginState {
  /** All parsed elements */
  elements: TemplateElement[];

  /** All scopes */
  scopes: TemplateScope[];

  /** The root scope */
  rootScope: TemplateScope | null;

  /** The complete schema */
  schema: TemplateSchema | null;

  /** Validation errors */
  errors: ValidationError[];

  /** Current decorations */
  decorations: DecorationSet;

  /** Hovered element ID */
  hoveredElementId?: string;

  /** Selected element ID */
  selectedElementId?: string;

  /** Last document content hash (for caching) */
  lastDocHash: number;
}

/**
 * Plugin key for accessing plugin state.
 */
export const templatePluginKey = new PluginKey<TemplatePluginState>('template');

/**
 * Create a simple hash of document content.
 */
function hashDocument(doc: import('prosemirror-model').Node): number {
  const text = doc.textContent;
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

/**
 * Parse template schema from document.
 */
function parseSchema(doc: import('prosemirror-model').Node): TemplateSchema {
  // Parse elements
  let elements = parseDocument(doc);

  // Add line numbers
  elements = addLineNumbers(elements, doc);

  // Build scopes
  const { scopes, errors: scopeErrors } = buildScopes(elements);

  // Create root scope
  const rootScope = createRootScope(elements, scopes);

  // Validate
  const validationErrors = validateAll(elements, scopes);

  // Infer data structure
  const dataStructure = inferDataStructure(elements, flattenScopes(scopes));

  return {
    elements,
    scopes,
    rootScope,
    dataStructure,
    errors: [...scopeErrors, ...validationErrors],
  };
}

/**
 * Create the template plugin.
 */
export function createTemplatePlugin(
  options: {
    /** Callback when schema changes */
    onSchemaChange?: (schema: TemplateSchema) => void;
    /** Callback when element is hovered */
    onElementHover?: (elementId: string | undefined) => void;
    /** Callback when element is selected */
    onElementSelect?: (elementId: string | undefined) => void;
  } = {}
): Plugin<TemplatePluginState> {
  return new Plugin<TemplatePluginState>({
    key: templatePluginKey,

    state: {
      init(_, state) {
        const docHash = hashDocument(state.doc);
        const schema = parseSchema(state.doc);

        if (options.onSchemaChange) {
          options.onSchemaChange(schema);
        }

        return {
          elements: schema.elements,
          scopes: schema.scopes,
          rootScope: schema.rootScope,
          schema,
          errors: schema.errors,
          decorations: createDecorations(state, schema.elements, schema.scopes),
          lastDocHash: docHash,
        };
      },

      apply(tr, value, _oldState, newState) {
        // Check if document changed
        const newDocHash = hashDocument(newState.doc);

        if (newDocHash !== value.lastDocHash || tr.docChanged) {
          // Re-parse the document
          const schema = parseSchema(newState.doc);

          if (options.onSchemaChange) {
            options.onSchemaChange(schema);
          }

          return {
            elements: schema.elements,
            scopes: schema.scopes,
            rootScope: schema.rootScope,
            schema,
            errors: schema.errors,
            decorations: createDecorations(
              newState,
              schema.elements,
              schema.scopes,
              value.hoveredElementId,
              value.selectedElementId
            ),
            hoveredElementId: value.hoveredElementId,
            selectedElementId: value.selectedElementId,
            lastDocHash: newDocHash,
          };
        }

        // Check for metadata changes (hover/select)
        const meta = tr.getMeta(templatePluginKey);
        if (meta) {
          const newHoveredId = meta.hoveredElementId ?? value.hoveredElementId;
          const newSelectedId = meta.selectedElementId ?? value.selectedElementId;

          if (newHoveredId !== value.hoveredElementId) {
            options.onElementHover?.(newHoveredId);
          }

          if (newSelectedId !== value.selectedElementId) {
            options.onElementSelect?.(newSelectedId);
          }

          return {
            ...value,
            hoveredElementId: newHoveredId,
            selectedElementId: newSelectedId,
            decorations: createDecorations(
              newState,
              value.elements,
              value.scopes,
              newHoveredId,
              newSelectedId
            ),
          };
        }

        // Map decorations through document changes
        return {
          ...value,
          decorations: value.decorations.map(tr.mapping, tr.doc),
        };
      },
    },

    props: {
      decorations(state) {
        const pluginState = templatePluginKey.getState(state);
        return pluginState?.decorations ?? DecorationSet.empty;
      },

      handleClick(view: EditorView, pos: number, _event: MouseEvent) {
        const pluginState = templatePluginKey.getState(view.state);
        if (!pluginState) return false;

        // Find clicked element
        const clickedElement = pluginState.elements.find((el) => pos >= el.from && pos <= el.to);

        if (clickedElement) {
          // Update selection
          const tr = view.state.tr.setMeta(templatePluginKey, {
            selectedElementId: clickedElement.id,
          });
          view.dispatch(tr);
          return true;
        }

        // Clear selection if clicking elsewhere
        if (pluginState.selectedElementId) {
          const tr = view.state.tr.setMeta(templatePluginKey, {
            selectedElementId: undefined,
          });
          view.dispatch(tr);
        }

        return false;
      },

      handleDOMEvents: {
        mouseover(view: EditorView, event) {
          const target = event.target as HTMLElement;
          const elementId = target.getAttribute?.('data-element-id');

          const pluginState = templatePluginKey.getState(view.state);
          if (!pluginState) return false;

          if (elementId !== pluginState.hoveredElementId) {
            const tr = view.state.tr.setMeta(templatePluginKey, {
              hoveredElementId: elementId || undefined,
            });
            view.dispatch(tr);
          }

          return false;
        },

        mouseout(view: EditorView, event: MouseEvent) {
          const relatedTarget = event.relatedTarget as HTMLElement;
          const stillInElement = relatedTarget?.closest?.(`[data-element-id]`);

          if (!stillInElement) {
            const pluginState = templatePluginKey.getState(view.state);
            if (pluginState?.hoveredElementId) {
              const tr = view.state.tr.setMeta(templatePluginKey, {
                hoveredElementId: undefined,
              });
              view.dispatch(tr);
            }
          }

          return false;
        },
      },
    },
  });
}

/**
 * Get the current template schema from editor state.
 */
export function getTemplateSchema(
  state: import('prosemirror-state').EditorState
): TemplateSchema | null {
  const pluginState = templatePluginKey.getState(state);
  return pluginState?.schema ?? null;
}

/**
 * Get template elements from editor state.
 */
export function getTemplateElements(
  state: import('prosemirror-state').EditorState
): TemplateElement[] {
  const pluginState = templatePluginKey.getState(state);
  return pluginState?.elements ?? [];
}

/**
 * Get validation errors from editor state.
 */
export function getValidationErrors(
  state: import('prosemirror-state').EditorState
): ValidationError[] {
  const pluginState = templatePluginKey.getState(state);
  return pluginState?.errors ?? [];
}

/**
 * Set hovered element programmatically.
 */
export function setHoveredElement(view: EditorView, elementId: string | undefined): void {
  const tr = view.state.tr.setMeta(templatePluginKey, {
    hoveredElementId: elementId,
  });
  view.dispatch(tr);
}

/**
 * Set selected element programmatically.
 */
export function setSelectedElement(view: EditorView, elementId: string | undefined): void {
  const tr = view.state.tr.setMeta(templatePluginKey, {
    selectedElementId: elementId,
  });
  view.dispatch(tr);
}

/**
 * Export CSS styles
 */
export { TEMPLATE_DECORATION_STYLES };
