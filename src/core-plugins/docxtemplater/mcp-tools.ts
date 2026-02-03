/**
 * Docxtemplater Plugin MCP Tools
 *
 * MCP tool definitions for template operations that can be called by AI clients.
 */

import type { McpToolDefinition, McpToolContext, McpToolResult, JsonSchema } from '../types';

import { detectVariablesDetailed } from '../../utils/variableDetector';
import { processTemplateDetailed, validateTemplate } from '../../utils/processTemplate';
import { parseDocx } from '../../docx/parser';

// ============================================================================
// SCHEMAS
// ============================================================================

const documentIdSchema: JsonSchema = {
  type: 'string',
  description: 'Document ID from a previous docx_load call',
};

const positionSchema: JsonSchema = {
  type: 'object',
  properties: {
    paragraphIndex: {
      type: 'number',
      description: 'Index of the paragraph (0-indexed)',
    },
    offset: {
      type: 'number',
      description: 'Character offset within the paragraph',
    },
  },
  required: ['paragraphIndex', 'offset'],
};

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

/**
 * Get template variables from a document
 */
export const getVariablesTool: McpToolDefinition = {
  name: 'docx_get_variables',
  description: `List all template variables ({{name}} format) found in the document.
Returns variable names without braces, along with their locations (body, headers, footers, etc.).
Use this to discover what data fields a template document expects.`,

  inputSchema: {
    type: 'object',
    properties: {
      documentId: documentIdSchema,
    },
    required: ['documentId'],
  },

  handler: async (input: unknown, context: McpToolContext): Promise<McpToolResult> => {
    const { documentId } = input as { documentId: string };

    const loaded = context.session.documents.get(documentId);
    if (!loaded) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Document not found: ${documentId}` }],
      };
    }

    try {
      const result = detectVariablesDetailed(loaded.document);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                variables: result.variables,
                count: result.variables.length,
                totalOccurrences: result.totalOccurrences,
                byLocation: result.byLocation,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          { type: 'text', text: `Failed to detect variables: ${(error as Error).message}` },
        ],
      };
    }
  },

  annotations: {
    category: 'template',
    readOnly: true,
    complexity: 'low',
    examples: [
      {
        description: 'Get all variables from a loaded document',
        input: { documentId: 'doc_123' },
        output: '{"variables": ["customer_name", "invoice_date"], "count": 2}',
      },
    ],
  },
};

/**
 * Insert a template variable at a position
 */
export const insertVariableTool: McpToolDefinition = {
  name: 'docx_insert_variable',
  description: `Insert a template variable placeholder ({{name}}) at a specific position in the document.
The variable can later be substituted with actual values using docx_apply_template.
Variable names should follow the pattern: letters, numbers, underscores, starting with a letter.`,

  inputSchema: {
    type: 'object',
    properties: {
      documentId: documentIdSchema,
      position: positionSchema,
      variableName: {
        type: 'string',
        description:
          'Variable name without braces (e.g., "customer_name"). Will be inserted as {{customer_name}}',
        pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
      },
    },
    required: ['documentId', 'position', 'variableName'],
  },

  handler: async (input: unknown, context: McpToolContext): Promise<McpToolResult> => {
    const { documentId, position, variableName } = input as {
      documentId: string;
      position: { paragraphIndex: number; offset: number };
      variableName: string;
    };

    const loaded = context.session.documents.get(documentId);
    if (!loaded) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Document not found: ${documentId}` }],
      };
    }

    // Validate variable name
    if (!/^[a-zA-Z_][a-zA-Z0-9_\-.]*$/.test(variableName)) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Invalid variable name: ${variableName}. Must start with letter/underscore and contain only alphanumeric, underscore, hyphen, or dot.`,
          },
        ],
      };
    }

    try {
      // Import the executor to run the command
      const { executeCommand } = await import('../../agent/executor');

      // Execute the insert command
      const newDoc = executeCommand(loaded.document, {
        type: 'insertText',
        position,
        text: `{{${variableName}}}`,
      });

      // Update the document in the session
      loaded.document = newDoc;
      loaded.lastModified = Date.now();

      // Track the variable
      if (!newDoc.templateVariables) {
        newDoc.templateVariables = [];
      }
      if (!newDoc.templateVariables.includes(variableName)) {
        newDoc.templateVariables.push(variableName);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              variable: variableName,
              insertedAs: `{{${variableName}}}`,
              position,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to insert variable: ${(error as Error).message}` }],
      };
    }
  },

  annotations: {
    category: 'template',
    readOnly: false,
    complexity: 'low',
    examples: [
      {
        description: 'Insert customer name variable at start of first paragraph',
        input: {
          documentId: 'doc_123',
          position: { paragraphIndex: 0, offset: 0 },
          variableName: 'customer_name',
        },
      },
    ],
  },
};

/**
 * Apply template substitution
 */
export const applyTemplateTool: McpToolDefinition = {
  name: 'docx_apply_template',
  description: `Substitute template variables with actual values in the document.
Replaces all {{variable}} placeholders with the corresponding values provided.
Preserves all formatting (fonts, styles, colors, tables).
Use docx_get_variables first to discover what variables exist in the document.`,

  inputSchema: {
    type: 'object',
    properties: {
      documentId: documentIdSchema,
      variables: {
        type: 'object',
        description:
          'Map of variable names to values (e.g., {"customer_name": "John Doe", "date": "2024-01-15"})',
        additionalProperties: {
          type: 'string',
        },
      },
      keepUnmatchedVariables: {
        type: 'boolean',
        description:
          'If true, keep {{variable}} placeholders for variables not in the map. If false, replace with empty string. Default: true',
        default: true,
      },
    },
    required: ['documentId', 'variables'],
  },

  handler: async (input: unknown, context: McpToolContext): Promise<McpToolResult> => {
    const {
      documentId,
      variables,
      keepUnmatchedVariables = true,
    } = input as {
      documentId: string;
      variables: Record<string, string>;
      keepUnmatchedVariables?: boolean;
    };

    const loaded = context.session.documents.get(documentId);
    if (!loaded) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Document not found: ${documentId}` }],
      };
    }

    if (!loaded.buffer) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Cannot apply template: document was not loaded from a DOCX buffer',
          },
        ],
      };
    }

    try {
      // Process the template
      const result = processTemplateDetailed(loaded.buffer, variables, {
        nullGetter: keepUnmatchedVariables ? 'keep' : 'empty',
      });

      // Re-parse the processed document
      const newDoc = await parseDocx(result.buffer);

      // Update session
      loaded.document = newDoc;
      loaded.buffer = result.buffer;
      loaded.lastModified = Date.now();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              replacedVariables: result.replacedVariables,
              unreplacedVariables: result.unreplacedVariables,
              warnings: result.warnings,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to apply template: ${(error as Error).message}` }],
      };
    }
  },

  annotations: {
    category: 'template',
    readOnly: false,
    complexity: 'medium',
    examples: [
      {
        description: 'Fill in customer and date values',
        input: {
          documentId: 'doc_123',
          variables: {
            customer_name: 'Jane Smith',
            invoice_date: '2024-02-15',
            amount: '$1,234.56',
          },
        },
      },
    ],
  },
};

/**
 * Validate a template document
 */
export const validateTemplateTool: McpToolDefinition = {
  name: 'docx_validate_template',
  description: `Validate that a document is a valid docxtemplater template.
Checks for syntax errors like unclosed braces, invalid tag names, etc.
Returns validation result with any errors found and list of valid tags.`,

  inputSchema: {
    type: 'object',
    properties: {
      documentId: documentIdSchema,
    },
    required: ['documentId'],
  },

  handler: async (input: unknown, context: McpToolContext): Promise<McpToolResult> => {
    const { documentId } = input as { documentId: string };

    const loaded = context.session.documents.get(documentId);
    if (!loaded) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Document not found: ${documentId}` }],
      };
    }

    if (!loaded.buffer) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Cannot validate template: document was not loaded from a DOCX buffer',
          },
        ],
      };
    }

    try {
      const result = validateTemplate(loaded.buffer);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                valid: result.valid,
                tags: result.tags,
                errors: result.errors.map((e) => ({
                  message: e.message,
                  variable: e.variable,
                  type: e.type,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          { type: 'text', text: `Failed to validate template: ${(error as Error).message}` },
        ],
      };
    }
  },

  annotations: {
    category: 'template',
    readOnly: true,
    complexity: 'low',
  },
};

// ============================================================================
// EXPORT ALL TOOLS
// ============================================================================

export const docxtemplaterMcpTools: McpToolDefinition[] = [
  getVariablesTool,
  insertVariableTool,
  applyTemplateTool,
  validateTemplateTool,
];

export default docxtemplaterMcpTools;
