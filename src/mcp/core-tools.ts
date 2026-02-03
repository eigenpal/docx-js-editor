/**
 * Core MCP Tools
 *
 * Built-in MCP tools for document operations that are always available.
 * These provide basic document manipulation without requiring plugins.
 */

import type {
  McpToolDefinition,
  McpToolContext,
  McpToolResult,
  JsonSchema,
} from '../core-plugins/types';
import { parseDocx } from '../docx/parser';
import { repackDocx, createDocx } from '../docx/rezip';
import { executeCommand } from '../agent/executor';

// ============================================================================
// SCHEMAS
// ============================================================================

const documentIdSchema: JsonSchema = {
  type: 'string',
  description: 'Document ID returned from docx_load',
};

const positionSchema: JsonSchema = {
  type: 'object',
  properties: {
    paragraphIndex: {
      type: 'number',
      description: 'Index of the paragraph (0-indexed)',
      minimum: 0,
    },
    offset: {
      type: 'number',
      description: 'Character offset within the paragraph',
      minimum: 0,
    },
  },
  required: ['paragraphIndex', 'offset'],
};

const rangeSchema: JsonSchema = {
  type: 'object',
  properties: {
    start: positionSchema,
    end: positionSchema,
  },
  required: ['start', 'end'],
};

// ============================================================================
// DOCUMENT LOADING/SAVING
// ============================================================================

/**
 * Load a DOCX document from base64
 */
export const loadDocumentTool: McpToolDefinition = {
  name: 'docx_load',
  description: `Load a DOCX document from base64-encoded content.
Returns a document ID that can be used with other tools.
The document remains in session memory until closed.`,

  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Base64-encoded DOCX file content',
      },
      source: {
        type: 'string',
        description: 'Optional source filename or identifier for reference',
      },
    },
    required: ['content'],
  },

  handler: async (input: unknown, context: McpToolContext): Promise<McpToolResult> => {
    const { content, source } = input as { content: string; source?: string };

    try {
      // Decode base64 to ArrayBuffer
      const binaryString = atob(content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = bytes.buffer;

      // Parse the document
      const document = await parseDocx(buffer);

      // Generate document ID
      const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store in session
      context.session.documents.set(docId, {
        id: docId,
        document,
        buffer,
        source,
        lastModified: Date.now(),
      });

      // Get basic info
      const paragraphCount = document.package.document.content.filter(
        (b) => b.type === 'paragraph'
      ).length;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              documentId: docId,
              source,
              paragraphCount,
              message: 'Document loaded successfully',
            }),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to load document: ${(error as Error).message}` }],
      };
    }
  },

  annotations: {
    category: 'core',
    readOnly: false,
    complexity: 'low',
  },
};

/**
 * Save a document to base64
 */
export const saveDocumentTool: McpToolDefinition = {
  name: 'docx_save',
  description: `Export the document to base64-encoded DOCX format.
Returns the document as a base64 string that can be saved to a file.`,

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
      // Repack or create the DOCX
      let buffer: ArrayBuffer;
      if (loaded.buffer) {
        // Preserve original structure
        buffer = await repackDocx(loaded.document);
      } else {
        // Create from scratch
        buffer = await createDocx(loaded.document);
      }

      // Encode to base64
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              documentId,
              base64,
              size: buffer.byteLength,
              message: 'Document exported successfully',
            }),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to save document: ${(error as Error).message}` }],
      };
    }
  },

  annotations: {
    category: 'core',
    readOnly: true,
    complexity: 'low',
  },
};

/**
 * Close a document
 */
export const closeDocumentTool: McpToolDefinition = {
  name: 'docx_close',
  description: `Close a document and free its memory.
Use this when done working with a document.`,

  inputSchema: {
    type: 'object',
    properties: {
      documentId: documentIdSchema,
    },
    required: ['documentId'],
  },

  handler: async (input: unknown, context: McpToolContext): Promise<McpToolResult> => {
    const { documentId } = input as { documentId: string };

    if (!context.session.documents.has(documentId)) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Document not found: ${documentId}` }],
      };
    }

    context.session.documents.delete(documentId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            documentId,
            message: 'Document closed',
          }),
        },
      ],
    };
  },

  annotations: {
    category: 'core',
    readOnly: false,
    complexity: 'low',
  },
};

// ============================================================================
// DOCUMENT INFORMATION
// ============================================================================

/**
 * Get document information
 */
export const getDocumentInfoTool: McpToolDefinition = {
  name: 'docx_get_info',
  description: `Get metadata and statistics about a document.
Returns paragraph count, word count, table count, and other useful info.`,

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

    const doc = loaded.document;
    const body = doc.package.document;

    const paragraphs = body.content.filter((b) => b.type === 'paragraph');
    const tables = body.content.filter((b) => b.type === 'table');

    // Count words
    let wordCount = 0;
    for (const para of paragraphs) {
      if (para.type === 'paragraph') {
        const text = getParagraphText(para);
        wordCount += text.split(/\s+/).filter((w) => w.length > 0).length;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            documentId,
            paragraphCount: paragraphs.length,
            tableCount: tables.length,
            wordCount,
            hasStyles: !!doc.package.styles,
            hasTheme: !!doc.package.theme,
            source: loaded.source,
            lastModified: loaded.lastModified,
          }),
        },
      ],
    };
  },

  annotations: {
    category: 'core',
    readOnly: true,
    complexity: 'low',
  },
};

/**
 * Get document plain text
 */
export const getDocumentTextTool: McpToolDefinition = {
  name: 'docx_get_text',
  description: `Get the plain text content of the document.
Returns all text concatenated with paragraph breaks.
Useful for understanding document content before making edits.`,

  inputSchema: {
    type: 'object',
    properties: {
      documentId: documentIdSchema,
      maxLength: {
        type: 'number',
        description: 'Maximum characters to return (default: 10000)',
        default: 10000,
      },
    },
    required: ['documentId'],
  },

  handler: async (input: unknown, context: McpToolContext): Promise<McpToolResult> => {
    const { documentId, maxLength = 10000 } = input as {
      documentId: string;
      maxLength?: number;
    };

    const loaded = context.session.documents.get(documentId);
    if (!loaded) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Document not found: ${documentId}` }],
      };
    }

    const body = loaded.document.package.document;
    const texts: string[] = [];

    for (const block of body.content) {
      if (block.type === 'paragraph') {
        texts.push(getParagraphText(block));
      } else if (block.type === 'table') {
        texts.push('[TABLE]');
      }
    }

    let text = texts.join('\n');
    const truncated = text.length > maxLength;
    if (truncated) {
      text = text.slice(0, maxLength) + '...';
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            documentId,
            text,
            truncated,
            totalLength: truncated ? texts.join('\n').length : text.length,
          }),
        },
      ],
    };
  },

  annotations: {
    category: 'core',
    readOnly: true,
    complexity: 'low',
  },
};

// ============================================================================
// TEXT MANIPULATION
// ============================================================================

/**
 * Insert text at a position
 */
export const insertTextTool: McpToolDefinition = {
  name: 'docx_insert_text',
  description: `Insert text at a specific position in the document.
Position is specified by paragraph index (0-indexed) and character offset.`,

  inputSchema: {
    type: 'object',
    properties: {
      documentId: documentIdSchema,
      position: positionSchema,
      text: {
        type: 'string',
        description: 'Text to insert',
      },
    },
    required: ['documentId', 'position', 'text'],
  },

  handler: async (input: unknown, context: McpToolContext): Promise<McpToolResult> => {
    const { documentId, position, text } = input as {
      documentId: string;
      position: { paragraphIndex: number; offset: number };
      text: string;
    };

    const loaded = context.session.documents.get(documentId);
    if (!loaded) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Document not found: ${documentId}` }],
      };
    }

    try {
      const newDoc = executeCommand(loaded.document, {
        type: 'insertText',
        position,
        text,
      });

      loaded.document = newDoc;
      loaded.lastModified = Date.now();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              insertedLength: text.length,
              position,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to insert text: ${(error as Error).message}` }],
      };
    }
  },

  annotations: {
    category: 'core',
    readOnly: false,
    complexity: 'low',
  },
};

/**
 * Replace text in a range
 */
export const replaceTextTool: McpToolDefinition = {
  name: 'docx_replace_text',
  description: `Replace text in a range with new text.
Specify start and end positions to define the range to replace.`,

  inputSchema: {
    type: 'object',
    properties: {
      documentId: documentIdSchema,
      range: rangeSchema,
      text: {
        type: 'string',
        description: 'Replacement text',
      },
    },
    required: ['documentId', 'range', 'text'],
  },

  handler: async (input: unknown, context: McpToolContext): Promise<McpToolResult> => {
    const { documentId, range, text } = input as {
      documentId: string;
      range: {
        start: { paragraphIndex: number; offset: number };
        end: { paragraphIndex: number; offset: number };
      };
      text: string;
    };

    const loaded = context.session.documents.get(documentId);
    if (!loaded) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Document not found: ${documentId}` }],
      };
    }

    try {
      const newDoc = executeCommand(loaded.document, {
        type: 'replaceText',
        range,
        text,
      });

      loaded.document = newDoc;
      loaded.lastModified = Date.now();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              replacedRange: range,
              newTextLength: text.length,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to replace text: ${(error as Error).message}` }],
      };
    }
  },

  annotations: {
    category: 'core',
    readOnly: false,
    complexity: 'low',
  },
};

/**
 * Delete text in a range
 */
export const deleteTextTool: McpToolDefinition = {
  name: 'docx_delete_text',
  description: `Delete text in a range.
Specify start and end positions to define the range to delete.`,

  inputSchema: {
    type: 'object',
    properties: {
      documentId: documentIdSchema,
      range: rangeSchema,
    },
    required: ['documentId', 'range'],
  },

  handler: async (input: unknown, context: McpToolContext): Promise<McpToolResult> => {
    const { documentId, range } = input as {
      documentId: string;
      range: {
        start: { paragraphIndex: number; offset: number };
        end: { paragraphIndex: number; offset: number };
      };
    };

    const loaded = context.session.documents.get(documentId);
    if (!loaded) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Document not found: ${documentId}` }],
      };
    }

    try {
      const newDoc = executeCommand(loaded.document, {
        type: 'deleteText',
        range,
      });

      loaded.document = newDoc;
      loaded.lastModified = Date.now();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              deletedRange: range,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to delete text: ${(error as Error).message}` }],
      };
    }
  },

  annotations: {
    category: 'core',
    readOnly: false,
    complexity: 'low',
  },
};

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Apply text formatting
 */
export const formatTextTool: McpToolDefinition = {
  name: 'docx_format_text',
  description: `Apply formatting to text in a range.
Supports bold, italic, underline, font size, font family, color, and highlight.`,

  inputSchema: {
    type: 'object',
    properties: {
      documentId: documentIdSchema,
      range: rangeSchema,
      formatting: {
        type: 'object',
        description: 'Formatting options to apply',
        properties: {
          bold: { type: 'boolean' },
          italic: { type: 'boolean' },
          underline: { type: 'boolean' },
          strikethrough: { type: 'boolean' },
          fontSize: { type: 'number', description: 'Font size in points' },
          fontFamily: { type: 'string' },
          color: { type: 'string', description: 'Hex color (e.g., "#FF0000")' },
          highlight: { type: 'string', description: 'Highlight color name' },
        },
      },
    },
    required: ['documentId', 'range', 'formatting'],
  },

  handler: async (input: unknown, context: McpToolContext): Promise<McpToolResult> => {
    const { documentId, range, formatting } = input as {
      documentId: string;
      range: {
        start: { paragraphIndex: number; offset: number };
        end: { paragraphIndex: number; offset: number };
      };
      formatting: Record<string, unknown>;
    };

    const loaded = context.session.documents.get(documentId);
    if (!loaded) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Document not found: ${documentId}` }],
      };
    }

    try {
      const newDoc = executeCommand(loaded.document, {
        type: 'formatText',
        range,
        formatting,
      });

      loaded.document = newDoc;
      loaded.lastModified = Date.now();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              range,
              appliedFormatting: formatting,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to format text: ${(error as Error).message}` }],
      };
    }
  },

  annotations: {
    category: 'core',
    readOnly: false,
    complexity: 'medium',
  },
};

/**
 * Apply paragraph style
 */
export const applyStyleTool: McpToolDefinition = {
  name: 'docx_apply_style',
  description: `Apply a named style to a paragraph.
Use document styles like "Heading1", "Heading2", "Normal", etc.`,

  inputSchema: {
    type: 'object',
    properties: {
      documentId: documentIdSchema,
      paragraphIndex: {
        type: 'number',
        description: 'Index of the paragraph (0-indexed)',
        minimum: 0,
      },
      styleId: {
        type: 'string',
        description: 'Style ID (e.g., "Heading1", "Normal")',
      },
    },
    required: ['documentId', 'paragraphIndex', 'styleId'],
  },

  handler: async (input: unknown, context: McpToolContext): Promise<McpToolResult> => {
    const { documentId, paragraphIndex, styleId } = input as {
      documentId: string;
      paragraphIndex: number;
      styleId: string;
    };

    const loaded = context.session.documents.get(documentId);
    if (!loaded) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Document not found: ${documentId}` }],
      };
    }

    try {
      const newDoc = executeCommand(loaded.document, {
        type: 'applyStyle',
        paragraphIndex,
        styleId,
      });

      loaded.document = newDoc;
      loaded.lastModified = Date.now();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              paragraphIndex,
              styleId,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to apply style: ${(error as Error).message}` }],
      };
    }
  },

  annotations: {
    category: 'core',
    readOnly: false,
    complexity: 'low',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

import type { Paragraph, Run, Hyperlink } from '../types/document';

function getParagraphText(paragraph: Paragraph): string {
  const texts: string[] = [];

  for (const item of paragraph.content) {
    if (item.type === 'run') {
      texts.push(getRunText(item));
    } else if (item.type === 'hyperlink') {
      texts.push(getHyperlinkText(item));
    }
  }

  return texts.join('');
}

function getRunText(run: Run): string {
  return run.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { type: 'text'; text: string }).text)
    .join('');
}

function getHyperlinkText(hyperlink: Hyperlink): string {
  const texts: string[] = [];
  for (const child of hyperlink.children) {
    if (child.type === 'run') {
      texts.push(getRunText(child));
    }
  }
  return texts.join('');
}

// ============================================================================
// EXPORT ALL CORE TOOLS
// ============================================================================

export const coreMcpTools: McpToolDefinition[] = [
  // Document loading/saving
  loadDocumentTool,
  saveDocumentTool,
  closeDocumentTool,

  // Document information
  getDocumentInfoTool,
  getDocumentTextTool,

  // Text manipulation
  insertTextTool,
  replaceTextTool,
  deleteTextTool,

  // Formatting
  formatTextTool,
  applyStyleTool,
];

export default coreMcpTools;
