/**
 * MCP Server Module
 *
 * Model Context Protocol server for exposing document editing tools to AI clients.
 *
 * @example
 * ```ts
 * import { createMcpServer, startStdioServer } from '@eigenpal/docx-editor/mcp';
 *
 * // Create server instance
 * const server = createMcpServer({ debug: true });
 *
 * // List available tools
 * console.log(server.listTools());
 *
 * // Call a tool programmatically
 * const result = await server.handleToolCall('docx_load', { content: base64 });
 * ```
 */

// ============================================================================
// SERVER
// ============================================================================

export {
  createMcpServer,
  startStdioServer,
  handleJsonRpcRequest,
  type McpServer,
  type McpServerConfig,
  type McpToolInfo,
} from './server';

// ============================================================================
// CORE TOOLS
// ============================================================================

export {
  coreMcpTools,
  loadDocumentTool,
  saveDocumentTool,
  closeDocumentTool,
  getDocumentInfoTool,
  getDocumentTextTool,
  insertTextTool,
  replaceTextTool,
  deleteTextTool,
  formatTextTool,
  applyStyleTool,
} from './core-tools';

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export { createMcpServer as default } from './server';
