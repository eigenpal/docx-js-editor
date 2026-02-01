/**
 * Template Processing Utility
 *
 * Uses docxtemplater to substitute template variables in DOCX documents:
 * - Processes {{variable_name}} patterns
 * - Preserves all formatting (fonts, styles, colors, tables)
 * - Error handling with useful messages
 */

import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for template processing
 */
export interface ProcessTemplateOptions {
  /** How to handle undefined variables */
  nullGetter?: 'keep' | 'empty' | 'error';
  /** Custom parser for variable names */
  parser?: (tag: string) => { get: (scope: any) => any };
  /** Line breaks: keep raw \n or convert to w:br */
  linebreaks?: boolean;
  /** Delimiter settings */
  delimiters?: {
    start?: string;
    end?: string;
  };
}

/**
 * Result of template processing
 */
export interface ProcessTemplateResult {
  /** The processed document buffer */
  buffer: ArrayBuffer;
  /** Variables that were found and replaced */
  replacedVariables: string[];
  /** Variables that were not replaced (no value provided) */
  unreplacedVariables: string[];
  /** Any warnings during processing */
  warnings: string[];
}

/**
 * Error details from template processing
 */
export interface TemplateError {
  /** Error message */
  message: string;
  /** Variable name that caused the error (if applicable) */
  variable?: string;
  /** Error type */
  type: 'parse' | 'render' | 'undefined' | 'unknown';
  /** Original error */
  originalError?: Error;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Process a DOCX template with variable substitution
 *
 * @param buffer - The DOCX file as ArrayBuffer
 * @param variables - Map of variable names to values
 * @param options - Processing options
 * @returns Processed DOCX as ArrayBuffer
 */
export function processTemplate(
  buffer: ArrayBuffer,
  variables: Record<string, string>,
  options: ProcessTemplateOptions = {}
): ArrayBuffer {
  const result = processTemplateDetailed(buffer, variables, options);
  return result.buffer;
}

/**
 * Process template with detailed result
 *
 * @param buffer - The DOCX file as ArrayBuffer
 * @param variables - Map of variable names to values
 * @param options - Processing options
 * @returns Detailed processing result
 */
export function processTemplateDetailed(
  buffer: ArrayBuffer,
  variables: Record<string, string>,
  options: ProcessTemplateOptions = {}
): ProcessTemplateResult {
  const {
    nullGetter = 'keep',
    linebreaks = true,
    delimiters,
  } = options;

  const warnings: string[] = [];
  const replacedVariables: string[] = [];
  const unreplacedVariables: string[] = [];

  try {
    // Load the docx as a zip
    const zip = new PizZip(buffer);

    // Create docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks,
      // Handle undefined tags based on option
      nullGetter: (part: { module?: string; value?: string }) => {
        const varName = part.value || '';

        if (nullGetter === 'error') {
          throw new Error(`Undefined variable: ${varName}`);
        }

        if (nullGetter === 'empty') {
          unreplacedVariables.push(varName);
          return '';
        }

        // Default: keep the tag as-is
        unreplacedVariables.push(varName);
        return `{{${varName}}}`;
      },
      // Custom delimiters if specified
      delimiters: delimiters
        ? { start: delimiters.start || '{{', end: delimiters.end || '}}' }
        : undefined,
    });

    // Track which variables are being replaced
    Object.keys(variables).forEach((key) => {
      if (variables[key] !== undefined && variables[key] !== null) {
        replacedVariables.push(key);
      }
    });

    // Set the data
    doc.setData(variables);

    // Render the document
    doc.render();

    // Get the output buffer
    const outputBuffer = doc.getZip().generate({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return {
      buffer: outputBuffer,
      replacedVariables,
      unreplacedVariables,
      warnings,
    };
  } catch (error) {
    throw formatTemplateError(error);
  }
}

/**
 * Process template and return as Blob
 *
 * @param buffer - The DOCX file as ArrayBuffer
 * @param variables - Map of variable names to values
 * @param options - Processing options
 * @returns Processed DOCX as Blob
 */
export function processTemplateAsBlob(
  buffer: ArrayBuffer,
  variables: Record<string, string>,
  options: ProcessTemplateOptions = {}
): Blob {
  const resultBuffer = processTemplate(buffer, variables, options);
  return new Blob([resultBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/**
 * Process template and trigger download
 *
 * @param buffer - The DOCX file as ArrayBuffer
 * @param variables - Map of variable names to values
 * @param filename - Output filename (without extension)
 * @param options - Processing options
 */
export function processTemplateAndDownload(
  buffer: ArrayBuffer,
  variables: Record<string, string>,
  filename: string = 'document',
  options: ProcessTemplateOptions = {}
): void {
  const blob = processTemplateAsBlob(buffer, variables, options);
  downloadBlob(blob, `${filename}.docx`);
}

// ============================================================================
// VALIDATION & INSPECTION
// ============================================================================

/**
 * Get all template tags in a document without processing
 *
 * @param buffer - The DOCX file as ArrayBuffer
 * @returns List of tag names found
 */
export function getTemplateTags(buffer: ArrayBuffer): string[] {
  try {
    const zip = new PizZip(buffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Get the full text to extract tags
    const fullText = doc.getFullText();
    return extractTagsFromText(fullText);
  } catch (error) {
    throw formatTemplateError(error);
  }
}

/**
 * Validate that a document is a valid docxtemplater template
 *
 * @param buffer - The DOCX file as ArrayBuffer
 * @returns Validation result
 */
export function validateTemplate(buffer: ArrayBuffer): {
  valid: boolean;
  errors: TemplateError[];
  tags: string[];
} {
  const errors: TemplateError[] = [];
  let tags: string[] = [];

  try {
    const zip = new PizZip(buffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Try to get full text (validates structure)
    const fullText = doc.getFullText();
    tags = extractTagsFromText(fullText);

    // Check for unclosed tags
    const unclosedTags = findUnclosedTags(fullText);
    for (const tag of unclosedTags) {
      errors.push({
        message: `Unclosed tag: ${tag}`,
        variable: tag,
        type: 'parse',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      tags,
    };
  } catch (error) {
    errors.push(formatTemplateError(error));
    return {
      valid: false,
      errors,
      tags,
    };
  }
}

/**
 * Check if all required variables have values
 *
 * @param tags - List of template tags
 * @param variables - Provided variable values
 * @returns Missing variable names
 */
export function getMissingVariables(
  tags: string[],
  variables: Record<string, string>
): string[] {
  return tags.filter(
    (tag) => !(tag in variables) || variables[tag] === undefined || variables[tag] === null
  );
}

/**
 * Preview what the document will look like after processing
 * Returns the document text with variables replaced (for preview purposes)
 *
 * @param buffer - The DOCX file as ArrayBuffer
 * @param variables - Map of variable names to values
 * @returns Preview text
 */
export function previewTemplate(
  buffer: ArrayBuffer,
  variables: Record<string, string>
): string {
  try {
    const zip = new PizZip(buffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: (part: { value?: string }) => {
        const varName = part.value || '';
        return `[${varName}]`;
      },
    });

    doc.setData(variables);
    doc.render();

    return doc.getFullText();
  } catch (error) {
    throw formatTemplateError(error);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract tag names from text
 */
function extractTagsFromText(text: string): string[] {
  const tags: string[] = [];
  const regex = /\{([^{}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // docxtemplater uses single braces internally
    const tag = match[1].trim();
    if (tag && !tags.includes(tag)) {
      tags.push(tag);
    }
  }

  return tags.sort();
}

/**
 * Find unclosed template tags
 */
function findUnclosedTags(text: string): string[] {
  const unclosed: string[] = [];

  // Check for { without matching }
  let depth = 0;
  let currentTag = '';

  for (const char of text) {
    if (char === '{') {
      depth++;
      currentTag = '';
    } else if (char === '}') {
      depth--;
      if (depth < 0) {
        depth = 0; // Reset on extra close brace
      }
    } else if (depth > 0) {
      currentTag += char;
    }
  }

  if (depth > 0 && currentTag.trim()) {
    unclosed.push(currentTag.trim());
  }

  return unclosed;
}

/**
 * Format docxtemplater errors into useful messages
 */
function formatTemplateError(error: unknown): TemplateError {
  if (error instanceof Error) {
    // Check for docxtemplater specific errors
    const docxError = error as any;

    if (docxError.properties && docxError.properties.errors) {
      // Multi-error from docxtemplater
      const firstError = docxError.properties.errors[0];
      return {
        message: firstError?.message || 'Template processing error',
        variable: firstError?.properties?.tag,
        type: 'render',
        originalError: error,
      };
    }

    // Check for undefined tag errors
    if (error.message.includes('undefined')) {
      const match = error.message.match(/undefined (?:variable|tag):\s*(\S+)/i);
      return {
        message: error.message,
        variable: match ? match[1] : undefined,
        type: 'undefined',
        originalError: error,
      };
    }

    // Check for parse errors
    if (
      error.message.includes('parse') ||
      error.message.includes('unclosed') ||
      error.message.includes('syntax')
    ) {
      return {
        message: error.message,
        type: 'parse',
        originalError: error,
      };
    }

    return {
      message: error.message,
      type: 'unknown',
      originalError: error,
    };
  }

  return {
    message: String(error),
    type: 'unknown',
  };
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// ADVANCED FEATURES
// ============================================================================

/**
 * Process template with conditional sections
 * Supports #if, #unless, #each loops
 *
 * @param buffer - The DOCX file as ArrayBuffer
 * @param data - Full data object (can include arrays, nested objects)
 * @param options - Processing options
 * @returns Processed DOCX as ArrayBuffer
 */
export function processTemplateAdvanced(
  buffer: ArrayBuffer,
  data: Record<string, unknown>,
  options: ProcessTemplateOptions = {}
): ArrayBuffer {
  const { linebreaks = true, delimiters } = options;

  try {
    const zip = new PizZip(buffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks,
      delimiters: delimiters
        ? { start: delimiters.start || '{{', end: delimiters.end || '}}' }
        : undefined,
    });

    doc.setData(data);
    doc.render();

    return doc.getZip().generate({
      type: 'arraybuffer',
      compression: 'DEFLATE',
    });
  } catch (error) {
    throw formatTemplateError(error);
  }
}

/**
 * Create a template processor with preset options
 */
export function createTemplateProcessor(
  defaultOptions: ProcessTemplateOptions = {}
): (buffer: ArrayBuffer, variables: Record<string, string>) => ArrayBuffer {
  return (buffer: ArrayBuffer, variables: Record<string, string>) => {
    return processTemplate(buffer, variables, defaultOptions);
  };
}

export default processTemplate;
