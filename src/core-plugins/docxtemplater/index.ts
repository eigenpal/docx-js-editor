/**
 * Docxtemplater Plugin
 *
 * Core plugin for template variable functionality using docxtemplater.
 * Provides:
 * - Command handlers for inserting template variables
 * - MCP tools for template operations (get variables, apply template)
 *
 * @example
 * ```ts
 * import { pluginRegistry } from '@eigenpal/docx-editor/core-plugins';
 * import { docxtemplaterPlugin } from '@eigenpal/docx-editor/core-plugins/docxtemplater';
 *
 * pluginRegistry.register(docxtemplaterPlugin);
 * ```
 */

import type { CorePlugin } from '../types';
import { handleInsertTemplateVariable, handleReplaceWithTemplateVariable } from './handlers';
import { docxtemplaterMcpTools } from './mcp-tools';

// ============================================================================
// PLUGIN DEFINITION
// ============================================================================

/**
 * Docxtemplater plugin for template variable functionality
 */
export const docxtemplaterPlugin: CorePlugin = {
  id: 'docxtemplater',
  name: 'Docxtemplater',
  version: '1.0.0',
  description: 'Template variable support using docxtemplater syntax ({{variable}})',

  /**
   * Command handlers for template operations
   */
  commandHandlers: {
    insertTemplateVariable: handleInsertTemplateVariable,
    replaceWithTemplateVariable: handleReplaceWithTemplateVariable,
  },

  /**
   * MCP tools exposed to AI clients
   */
  mcpTools: docxtemplaterMcpTools,

  /**
   * Initialize the plugin
   *
   * Checks that docxtemplater and pizzip are available.
   * Note: These are already dependencies, but this validates they're importable.
   */
  initialize: () => {
    // Validate docxtemplater is available
    // We don't actually need to import it here since processTemplate handles that
    // This is just a validation step
    try {
      // Check if the utilities are importable
       
      require('docxtemplater');
       
      require('pizzip');
    } catch {
      console.warn(
        '[docxtemplater-plugin] Warning: docxtemplater or pizzip not installed. ' +
          'Template features may not work. Install with: npm install docxtemplater pizzip'
      );
    }
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

// Export handlers for direct use
export {
  handleInsertTemplateVariable,
  handleReplaceWithTemplateVariable,
  type InsertTemplateVariableCommand,
  type ReplaceWithTemplateVariableCommand,
} from './handlers';

// Export MCP tools for customization
export {
  docxtemplaterMcpTools,
  getVariablesTool,
  insertVariableTool,
  applyTemplateTool,
  validateTemplateTool,
} from './mcp-tools';

// Default export is the plugin
export default docxtemplaterPlugin;
