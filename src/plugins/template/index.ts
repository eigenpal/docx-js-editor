/**
 * Template Plugin
 *
 * Docxtemplater template support as a plugin for the DOCX Editor.
 *
 * Features:
 * - Full docxtemplater syntax detection (variables, loops, conditionals)
 * - Schema annotation panel showing template structure
 * - Differentiated visual highlighting by element type
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
import type { TemplateTag } from './prosemirror-plugin';
import {
  createTemplatePlugin,
  templatePluginKey,
  TEMPLATE_DECORATION_STYLES,
} from './prosemirror-plugin';
import { AnnotationPanel, ANNOTATION_PANEL_STYLES } from './components/AnnotationPanel';

/**
 * Plugin state interface
 */
interface TemplatePluginState {
  tags: TemplateTag[];
  hoveredId?: string;
  selectedId?: string;
}

/**
 * Create the template plugin instance.
 *
 * @param options - Plugin configuration options
 */
export function createPlugin(
  options: {
    /** Initial panel collapsed state */
    defaultCollapsed?: boolean;

    /** Panel position */
    panelPosition?: 'left' | 'right';

    /** Panel default width */
    panelWidth?: number;
  } = {}
): EditorPlugin<TemplatePluginState> {
  // Create the ProseMirror plugin
  const pmPlugin = createTemplatePlugin();

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
        tags: pluginState.tags,
        hoveredId: pluginState.hoveredId,
        selectedId: pluginState.selectedId,
      };
    },

    initialize: (_view: EditorView | null): TemplatePluginState => {
      return {
        tags: [],
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

// Re-export types and utilities from prosemirror-plugin
export type { TemplateTag, TagType } from './prosemirror-plugin';
export {
  createTemplatePlugin,
  templatePluginKey,
  getTemplateTags,
  setHoveredElement,
  setSelectedElement,
  TEMPLATE_DECORATION_STYLES,
} from './prosemirror-plugin';

export { AnnotationPanel, ANNOTATION_PANEL_STYLES } from './components/AnnotationPanel';
