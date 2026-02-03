/**
 * MCP Server
 *
 * Model Context Protocol server that exposes document editing tools to AI clients.
 * Discovers and registers tools from the plugin system plus core built-in tools.
 *
 * @example
 * ```ts
 * import { createMcpServer, startStdioServer } from '@eigenpal/docx-editor/mcp';
 * import { pluginRegistry, docxtemplaterPlugin } from '@eigenpal/docx-editor/core-plugins';
 *
 * // Register plugins
 * pluginRegistry.register(docxtemplaterPlugin);
 *
 * // Start MCP server
 * startStdioServer();
 * ```
 */

import type {
  McpToolDefinition,
  McpToolContext,
  McpSession,
  LoadedDocument,
  JsonSchema,
} from '../core-plugins/types';
import { pluginRegistry } from '../core-plugins/registry';
import { coreMcpTools } from './core-tools';

// ============================================================================
// TYPES
// ============================================================================

/**
 * MCP Server configuration
 */
export interface McpServerConfig {
  /** Server name */
  name?: string;

  /** Server version */
  version?: string;

  /** Include core tools (default: true) */
  includeCoreTools?: boolean;

  /** Enable debug logging */
  debug?: boolean;

  /** Custom tools to add */
  additionalTools?: McpToolDefinition[];
}

/**
 * MCP Server instance
 */
export interface McpServer {
  /** All registered tools */
  tools: Map<string, McpToolDefinition>;

  /** Active session */
  session: McpSession;

  /** Handle a tool call */
  handleToolCall(toolName: string, input: unknown): Promise<unknown>;

  /** List available tools */
  listTools(): McpToolInfo[];

  /** Get server info */
  getInfo(): { name: string; version: string; toolCount: number };
}

/**
 * Tool info for listing
 */
export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  category?: string;
}

// ============================================================================
// SERVER CREATION
// ============================================================================

/**
 * Create an MCP server instance
 *
 * @param config - Server configuration
 * @returns MCP server instance
 */
export function createMcpServer(config: McpServerConfig = {}): McpServer {
  const {
    name = 'docx-editor',
    version = '0.1.0',
    includeCoreTools = true,
    debug = false,
    additionalTools = [],
  } = config;

  const tools = new Map<string, McpToolDefinition>();

  // Create session
  const session: McpSession = {
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    documents: new Map<string, LoadedDocument>(),
    data: new Map<string, unknown>(),
  };

  // Register core tools
  if (includeCoreTools) {
    for (const tool of coreMcpTools) {
      tools.set(tool.name, tool);
      if (debug) {
        console.log(`[MCP] Registered core tool: ${tool.name}`);
      }
    }
  }

  // Register plugin tools
  const pluginTools = pluginRegistry.getMcpTools();
  for (const tool of pluginTools) {
    if (tools.has(tool.name)) {
      console.warn(`[MCP] Tool '${tool.name}' from plugin overrides existing tool`);
    }
    tools.set(tool.name, tool);
    if (debug) {
      console.log(`[MCP] Registered plugin tool: ${tool.name}`);
    }
  }

  // Register additional tools
  for (const tool of additionalTools) {
    tools.set(tool.name, tool);
    if (debug) {
      console.log(`[MCP] Registered additional tool: ${tool.name}`);
    }
  }

  // Create logger
  const log = debug
    ? (message: string, data?: unknown) => {
        console.log(`[MCP] ${message}`, data ?? '');
      }
    : () => {};

  // Handle tool call
  async function handleToolCall(toolName: string, input: unknown): Promise<unknown> {
    const tool = tools.get(toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    log(`Calling tool: ${toolName}`, input);

    // Create context
    const context: McpToolContext = {
      session,
      log,
    };

    // Execute handler
    try {
      const result = await tool.handler(input, context);
      log(`Tool ${toolName} completed`, result);
      return result;
    } catch (error) {
      log(`Tool ${toolName} failed`, error);
      throw error;
    }
  }

  // List tools
  function listTools(): McpToolInfo[] {
    return Array.from(tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: convertToJsonSchema(tool.inputSchema),
      category: tool.annotations?.category,
    }));
  }

  // Get info
  function getInfo() {
    return {
      name,
      version,
      toolCount: tools.size,
    };
  }

  return {
    tools,
    session,
    handleToolCall,
    listTools,
    getInfo,
  };
}

// ============================================================================
// JSON-RPC PROTOCOL
// ============================================================================

/**
 * JSON-RPC request
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC response
 */
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Handle a JSON-RPC request
 */
export async function handleJsonRpcRequest(
  server: McpServer,
  request: JsonRpcRequest
): Promise<JsonRpcResponse> {
  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: server.getInfo(),
          },
        };
      }

      case 'tools/list': {
        const tools = server.listTools();
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: tools.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          },
        };
      }

      case 'tools/call': {
        const { name, arguments: args } = params as {
          name: string;
          arguments: unknown;
        };
        const result = await server.handleToolCall(name, args);
        return {
          jsonrpc: '2.0',
          id,
          result,
        };
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
    }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32000,
        message: (error as Error).message,
      },
    };
  }
}

// ============================================================================
// STDIO TRANSPORT
// ============================================================================

/**
 * Start the MCP server with stdio transport
 *
 * Reads JSON-RPC requests from stdin, writes responses to stdout.
 * This is the standard way to run an MCP server for Claude Desktop.
 */
export async function startStdioServer(config: McpServerConfig = {}): Promise<void> {
  const server = createMcpServer(config);

  if (config.debug) {
    console.error(`[MCP] Server started: ${server.getInfo().name} v${server.getInfo().version}`);
    console.error(`[MCP] Tools registered: ${server.tools.size}`);
  }

  // Read from stdin
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  let buffer = '';

  rl.on('line', async (line) => {
    buffer += line;

    // Try to parse complete JSON
    try {
      const request = JSON.parse(buffer) as JsonRpcRequest;
      buffer = '';

      const response = await handleJsonRpcRequest(server, request);

      // Write response to stdout
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch {
      // Incomplete JSON, wait for more
    }
  });

  rl.on('close', () => {
    if (config.debug) {
      console.error('[MCP] Server closed');
    }
    process.exit(0);
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert schema to JSON Schema format
 */
function convertToJsonSchema(schema: JsonSchema | unknown): JsonSchema {
  // If it's already a JSON Schema object, return it
  if (
    typeof schema === 'object' &&
    schema !== null &&
    ('type' in schema || 'properties' in schema)
  ) {
    return schema as JsonSchema;
  }

  // If it's a Zod-like schema, try to convert
  // For now, just return a basic object schema
  return {
    type: 'object',
    properties: {},
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { coreMcpTools } from './core-tools';
