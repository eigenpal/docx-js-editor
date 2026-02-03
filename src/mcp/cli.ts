/**
 * MCP Server CLI Entry Point
 *
 * Starts the MCP server with stdio transport for use with Claude Desktop
 * and other MCP-compatible clients.
 *
 * Usage:
 *   npx @eigenpal/docx-editor --mcp
 *   docx-editor-mcp
 *
 * Claude Desktop configuration:
 * ```json
 * {
 *   "mcpServers": {
 *     "docx-editor": {
 *       "command": "npx",
 *       "args": ["-y", "@eigenpal/docx-editor", "--mcp"]
 *     }
 *   }
 * }
 * ```
 */

import { pluginRegistry } from '../core-plugins/registry';
import { docxtemplaterPlugin } from '../core-plugins/docxtemplater';
import { startStdioServer, type McpServerConfig } from './server';

// ============================================================================
// PARSE ARGUMENTS
// ============================================================================

function parseArgs(): { debug: boolean; help: boolean; version: boolean } {
  const args = process.argv.slice(2);

  return {
    debug: args.includes('--debug') || args.includes('-d'),
    help: args.includes('--help') || args.includes('-h'),
    version: args.includes('--version') || args.includes('-v'),
  };
}

// ============================================================================
// HELP TEXT
// ============================================================================

const HELP_TEXT = `
docx-editor-mcp - MCP server for DOCX document editing

USAGE:
  docx-editor-mcp [OPTIONS]

OPTIONS:
  -d, --debug     Enable debug logging (logs to stderr)
  -h, --help      Show this help message
  -v, --version   Show version number

DESCRIPTION:
  Starts an MCP (Model Context Protocol) server that exposes DOCX document
  editing tools to AI clients like Claude Desktop.

AVAILABLE TOOLS:
  Core Tools:
    docx_load          Load a DOCX document from base64
    docx_save          Export document to base64
    docx_close         Close a document
    docx_get_info      Get document metadata
    docx_get_text      Get document plain text
    docx_insert_text   Insert text at position
    docx_replace_text  Replace text in range
    docx_delete_text   Delete text in range
    docx_format_text   Apply text formatting
    docx_apply_style   Apply paragraph style

  Template Tools (docxtemplater plugin):
    docx_get_variables     List template variables
    docx_insert_variable   Insert {{variable}} placeholder
    docx_apply_template    Substitute template variables
    docx_validate_template Validate template syntax

CLAUDE DESKTOP CONFIGURATION:
  Add to your Claude Desktop config:

  {
    "mcpServers": {
      "docx-editor": {
        "command": "npx",
        "args": ["-y", "@eigenpal/docx-editor", "--mcp"]
      }
    }
  }

EXAMPLES:
  # Start server (normal mode)
  docx-editor-mcp

  # Start server with debug logging
  docx-editor-mcp --debug
`;

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const { debug, help, version } = parseArgs();

  if (help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (version) {
    console.log('0.1.0');
    process.exit(0);
  }

  // Register plugins
  pluginRegistry.register(docxtemplaterPlugin);

  if (debug) {
    console.error('[MCP CLI] Registered docxtemplater plugin');
    console.error(`[MCP CLI] Total plugins: ${pluginRegistry.size}`);
    console.error(`[MCP CLI] Total MCP tools: ${pluginRegistry.getMcpTools().length}`);
  }

  // Start server
  const config: McpServerConfig = {
    name: 'docx-editor',
    version: '0.1.0',
    debug,
  };

  await startStdioServer(config);
}

// Run main
main().catch((error) => {
  console.error('[MCP CLI] Fatal error:', error);
  process.exit(1);
});
