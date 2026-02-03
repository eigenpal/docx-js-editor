/**
 * Template Plugin
 *
 * Docxtemplater template support as a plugin for the DOCX Editor.
 *
 * Features:
 * - Full docxtemplater syntax detection (variables, loops, conditionals)
 * - Schema annotation panel showing template structure
 * - Differentiated visual highlighting by element type
 * - Inferred TypeScript data structure display
 *
 * @example
 * ```tsx
 * import { PluginHost } from '@docx-editor/plugin-api';
 * import { templatePlugin } from '@docx-editor/plugins/template';
 *
 * function MyEditor() {
 *   return (
 *     <PluginHost plugins={[templatePlugin]}>
 *       <DocxEditor document={doc} onChange={handleChange} />
 *     </PluginHost>
 *   );
 * }
 * ```
 */

import type { EditorPlugin } from '../../plugin-api/types';
import type { EditorView } from 'prosemirror-view';
import type { TemplatePluginState, TemplateSchema } from './types';
import {
  createTemplatePlugin,
  templatePluginKey,
  TEMPLATE_DECORATION_STYLES,
} from './prosemirror-plugin';
import { AnnotationPanel, ANNOTATION_PANEL_STYLES } from './components/AnnotationPanel';

/**
 * Create the template plugin instance.
 *
 * @param options - Plugin configuration options
 */
export function createPlugin(
  options: {
    /** Callback when template schema changes */
    onSchemaChange?: (schema: TemplateSchema) => void;

    /** Initial panel collapsed state */
    defaultCollapsed?: boolean;

    /** Panel position */
    panelPosition?: 'left' | 'right';

    /** Panel default width */
    panelWidth?: number;
  } = {}
): EditorPlugin<TemplatePluginState> {
  // Store schema change callback for external access
  const schemaChangeCallback = options.onSchemaChange;

  // Create the ProseMirror plugin
  const pmPlugin = createTemplatePlugin({
    onSchemaChange: (schema) => {
      schemaChangeCallback?.(schema);
    },
  });

  return {
    id: 'template',
    name: 'Template',

    proseMirrorPlugins: [pmPlugin],

    Panel: AnnotationPanel,

    panelConfig: {
      position: options.panelPosition ?? 'right',
      defaultSize: options.panelWidth ?? 280,
      minSize: 200,
      maxSize: 400,
      resizable: true,
      collapsible: true,
      defaultCollapsed: options.defaultCollapsed ?? false,
    },

    onStateChange: (view: EditorView): TemplatePluginState | undefined => {
      const pluginState = templatePluginKey.getState(view.state);
      if (!pluginState) return undefined;

      return {
        schema: pluginState.schema,
        isParsing: false,
        hoveredElementId: pluginState.hoveredElementId,
        selectedElementId: pluginState.selectedElementId,
        showErrors: true,
        annotationsExpanded: true,
      };
    },

    initialize: (_view: EditorView | null): TemplatePluginState => {
      return {
        schema: null,
        isParsing: true,
        showErrors: true,
        annotationsExpanded: true,
      };
    },

    styles: `
${TEMPLATE_DECORATION_STYLES}
${ANNOTATION_PANEL_STYLES}
`,
  };
}

/**
 * Default template plugin instance.
 * Use this for quick setup without custom configuration.
 */
export const templatePlugin = createPlugin();

// Re-export types
export type {
  TemplateElement,
  TemplateElementType,
  TemplateScope,
  TemplateSchema,
  TemplatePluginState,
  InferredDataType,
  ValidationError,
} from './types';

// Re-export utilities
export {
  parseDocument,
  parseText,
  containsTemplateTags,
  extractTagNames,
  getUniqueVariableNames,
} from './parser';

export {
  buildScopes,
  createRootScope,
  getScopeById,
  getScopeAtPosition,
  flattenScopes,
} from './scope-tracker';

export { validateAll, validateElements, validateScopes, isValidVariableName } from './validator';

export {
  inferDataStructure,
  toTypeScriptInterface,
  getFullDataPath,
  getStructureSummary,
} from './schema-inferrer';

export {
  createTemplatePlugin,
  templatePluginKey,
  getTemplateSchema,
  getTemplateElements,
  getValidationErrors,
  setHoveredElement,
  setSelectedElement,
} from './prosemirror-plugin';

export { ELEMENT_COLORS, ELEMENT_ICONS, TEMPLATE_CLASS_PREFIX } from './types';
