/**
 * Core Plugin System
 *
 * Headless plugin system for extending DocumentAgent with custom
 * commands and exposing MCP tools for AI integration.
 *
 * @example
 * ```ts
 * import {
 *   pluginRegistry,
 *   docxtemplaterPlugin,
 *   type CorePlugin
 * } from '@eigenpal/docx-editor/core-plugins';
 *
 * // Register the docxtemplater plugin
 * pluginRegistry.register(docxtemplaterPlugin);
 *
 * // Get MCP tools for MCP server
 * const tools = pluginRegistry.getMcpTools();
 *
 * // Check available command handlers
 * const commandTypes = pluginRegistry.getCommandTypes();
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  // Core plugin types
  CorePlugin,
  Plugin,
  PluginCommand,
  CommandHandler,
  PluginCommandHandler,
  CommandResult,
  PluginOptions,
  PluginRegistrationResult,

  // MCP tool types
  McpToolDefinition,
  ToolDefinition,
  McpToolHandler,
  ToolHandler,
  McpToolResult,
  ToolResult,
  McpToolContent,
  McpToolContext,
  McpToolAnnotations,
  McpToolExample,
  McpSession,
  LoadedDocument,

  // Schema types
  JsonSchema,
  ZodSchemaLike,

  // Event types
  PluginEvent,
  PluginEventListener,

  // Utility types
  TypedCommandHandler,
  ExtractCommand,
} from './types';

// ============================================================================
// UTILITIES
// ============================================================================

export { isZodSchema } from './types';

// ============================================================================
// REGISTRY
// ============================================================================

export { PluginRegistry, pluginRegistry, registerPlugins, createPluginRegistrar } from './registry';

// ============================================================================
// BUILT-IN PLUGINS
// ============================================================================

export { docxtemplaterPlugin } from './docxtemplater';

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export { pluginRegistry as default } from './registry';
