/**
 * Core Plugin System Types
 *
 * Defines the interfaces for headless plugins that work in Node.js
 * without React/DOM dependencies. These plugins extend DocumentAgent
 * with additional commands and expose MCP tools for AI integration.
 */

import type { Document } from '../types/document';
import type { AgentCommand, Position, Range } from '../types/agentApi';

// ============================================================================
// PLUGIN INTERFACE
// ============================================================================

/**
 * Core plugin interface - headless, works in Node.js
 *
 * Plugins can:
 * - Register command handlers that DocumentAgent dispatches to
 * - Declare MCP tools that the MCP server exposes to AI clients
 * - Have optional initialization logic
 * - Declare dependencies on other plugins
 */
export interface CorePlugin {
  /** Unique plugin identifier */
  id: string;

  /** Human-readable plugin name */
  name: string;

  /** Plugin version (semver) */
  version?: string;

  /** Plugin description */
  description?: string;

  /**
   * Command handlers this plugin provides.
   * DocumentAgent dispatches commands to these handlers.
   *
   * @example
   * ```ts
   * commandHandlers: {
   *   'insertTemplateVariable': (doc, cmd) => {
   *     // Transform document
   *     return modifiedDoc;
   *   },
   * }
   * ```
   */
  commandHandlers?: Record<string, CommandHandler>;

  /**
   * MCP tools this plugin exposes.
   * MCP server collects these from all plugins.
   */
  mcpTools?: McpToolDefinition[];

  /**
   * Optional setup when plugin is registered.
   * Called once during plugin registration.
   */
  initialize?: () => void | Promise<void>;

  /**
   * Optional cleanup when plugin is unregistered.
   */
  destroy?: () => void | Promise<void>;

  /**
   * Dependencies on other plugins (by ID).
   * The registry ensures dependencies are loaded first.
   */
  dependencies?: string[];
}

// ============================================================================
// COMMAND TYPES
// ============================================================================

/**
 * Command handler function type
 *
 * Receives a document and a command, returns a modified document.
 * Must be pure/immutable - always return a new document.
 */
export type CommandHandler = (doc: Document, command: PluginCommand) => Document;

/**
 * Extended command type for plugins
 *
 * Plugins can define custom command types beyond the built-in AgentCommand types.
 */
export interface PluginCommand {
  /** Command type identifier */
  type: string;

  /** Unique command ID (for undo tracking) */
  id?: string;

  /** Position for positional commands */
  position?: Position;

  /** Range for range-based commands */
  range?: Range;

  /** Additional command-specific data */
  [key: string]: unknown;
}

/**
 * Result of command execution
 */
export interface CommandResult {
  /** The modified document */
  document: Document;

  /** Whether the command succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Metadata about the operation */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// MCP TOOL TYPES
// ============================================================================

/**
 * MCP tool definition
 *
 * Describes a tool that can be called by AI clients through the MCP server.
 */
export interface McpToolDefinition {
  /** Tool name (used in MCP protocol) */
  name: string;

  /** Human-readable description for AI */
  description: string;

  /**
   * JSON Schema for tool input validation.
   * Can be a Zod schema or plain JSON Schema object.
   */
  inputSchema: JsonSchema | ZodSchemaLike;

  /**
   * Handler function for the tool.
   * Receives validated input and returns a result.
   */
  handler: McpToolHandler;

  /**
   * Optional annotations for the tool
   */
  annotations?: McpToolAnnotations;
}

/**
 * MCP tool handler function
 */
export type McpToolHandler = (
  input: unknown,
  context: McpToolContext
) => Promise<McpToolResult> | McpToolResult;

/**
 * Context passed to MCP tool handlers
 */
export interface McpToolContext {
  /** Current document (if loaded) */
  document?: Document;

  /** Document buffer (if loaded) */
  documentBuffer?: ArrayBuffer;

  /** Session state */
  session: McpSession;

  /** Logger for debugging */
  log: (message: string, data?: unknown) => void;
}

/**
 * MCP session state
 *
 * Maintains state across tool calls within a session.
 */
export interface McpSession {
  /** Session ID */
  id: string;

  /** Loaded documents by ID */
  documents: Map<string, LoadedDocument>;

  /** Custom session data */
  data: Map<string, unknown>;
}

/**
 * A loaded document in the session
 */
export interface LoadedDocument {
  /** Document ID */
  id: string;

  /** Parsed document */
  document: Document;

  /** Original buffer (for repacking) */
  buffer?: ArrayBuffer;

  /** Source filename or path */
  source?: string;

  /** Last modified timestamp */
  lastModified: number;
}

/**
 * MCP tool result
 */
export interface McpToolResult {
  /** Result content */
  content: McpToolContent[];

  /** Whether this is an error result */
  isError?: boolean;
}

/**
 * MCP tool content types
 */
export type McpToolContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; uri: string; mimeType?: string; text?: string };

/**
 * MCP tool annotations
 */
export interface McpToolAnnotations {
  /** Tool category for organization */
  category?: string;

  /** Whether this tool modifies the document */
  readOnly?: boolean;

  /** Estimated cost/complexity */
  complexity?: 'low' | 'medium' | 'high';

  /** Example usage */
  examples?: McpToolExample[];
}

/**
 * MCP tool example
 */
export interface McpToolExample {
  /** Example description */
  description: string;

  /** Example input */
  input: unknown;

  /** Expected output description */
  output?: string;
}

// ============================================================================
// JSON SCHEMA TYPES
// ============================================================================

/**
 * JSON Schema definition (subset)
 */
export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  $ref?: string;
}

/**
 * Zod-like schema interface for compatibility
 */
export interface ZodSchemaLike {
  _def?: unknown;
  parse?: (data: unknown) => unknown;
  safeParse?: (data: unknown) => { success: boolean; data?: unknown; error?: unknown };
}

/**
 * Check if a schema is Zod-like
 */
export function isZodSchema(schema: unknown): schema is ZodSchemaLike {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    ('_def' in schema || 'parse' in schema || 'safeParse' in schema)
  );
}

// ============================================================================
// PLUGIN EVENTS
// ============================================================================

/**
 * Plugin lifecycle events
 */
export type PluginEvent =
  | { type: 'registered'; plugin: CorePlugin }
  | { type: 'unregistered'; pluginId: string }
  | { type: 'error'; pluginId: string; error: Error };

/**
 * Plugin event listener
 */
export type PluginEventListener = (event: PluginEvent) => void;

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Extract command type from a union
 */
export type ExtractCommand<T extends AgentCommand, Type extends string> = T extends { type: Type }
  ? T
  : never;

/**
 * Create a typed command handler
 */
export type TypedCommandHandler<T extends PluginCommand> = (doc: Document, command: T) => Document;

/**
 * Plugin configuration options
 */
export interface PluginOptions {
  /** Enable debug logging */
  debug?: boolean;

  /** Custom configuration */
  config?: Record<string, unknown>;
}

/**
 * Result of plugin registration
 */
export interface PluginRegistrationResult {
  /** Whether registration succeeded */
  success: boolean;

  /** Registered plugin (if successful) */
  plugin?: CorePlugin;

  /** Error message (if failed) */
  error?: string;

  /** Warning messages */
  warnings?: string[];
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  CorePlugin as Plugin,
  CommandHandler as PluginCommandHandler,
  McpToolDefinition as ToolDefinition,
  McpToolHandler as ToolHandler,
  McpToolResult as ToolResult,
};
