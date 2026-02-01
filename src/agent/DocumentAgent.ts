/**
 * DocumentAgent - High-level fluent API for programmatic document manipulation
 *
 * Provides a convenient interface for:
 * - Reading document content and metadata
 * - Editing text with formatting
 * - Inserting tables, images, and hyperlinks
 * - Managing template variables
 * - Exporting to DOCX buffer
 *
 * All operations are immutable - they return a new DocumentAgent instance
 * or don't modify the underlying document.
 */

import type {
  Document,
  DocumentBody,
  Paragraph,
  Table,
  Run,
  TextFormatting,
  ParagraphFormatting,
  BlockContent,
  Style,
  Section,
  Hyperlink,
} from '../types/document';

import type {
  Position,
  Range,
  AgentContext,
  StyleInfo,
  ParagraphOutline,
  SectionInfo,
} from '../types/agentApi';

import { executeCommand, executeCommands } from './executor';
import type { AgentCommand } from '../types/agentApi';
import { repackDocx } from '../docx/rezip';
import { detectVariables } from '../utils/variableDetector';
import { processTemplate } from '../utils/processTemplate';
import { parseDocx } from '../docx/parser';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for inserting text
 */
export interface InsertTextOptions {
  /** Text formatting */
  formatting?: TextFormatting;
}

/**
 * Options for inserting table
 */
export interface InsertTableOptions {
  /** Table data (2D array of strings) */
  data?: string[][];
  /** Whether first row is a header */
  hasHeader?: boolean;
}

/**
 * Options for inserting image
 */
export interface InsertImageOptions {
  /** Image width in pixels */
  width?: number;
  /** Image height in pixels */
  height?: number;
  /** Alt text for accessibility */
  alt?: string;
}

/**
 * Options for inserting hyperlink
 */
export interface InsertHyperlinkOptions {
  /** Display text (overrides selected text) */
  displayText?: string;
  /** Tooltip on hover */
  tooltip?: string;
}

/**
 * Formatted text segment
 */
export interface FormattedTextSegment {
  /** Text content */
  text: string;
  /** Applied formatting */
  formatting?: TextFormatting;
  /** Is part of a hyperlink */
  isHyperlink?: boolean;
  /** Hyperlink URL if applicable */
  hyperlinkUrl?: string;
}

// ============================================================================
// DOCUMENT AGENT CLASS
// ============================================================================

/**
 * DocumentAgent provides a fluent API for document manipulation
 *
 * @example
 * ```ts
 * const agent = new DocumentAgent(buffer);
 *
 * // Read operations
 * const text = agent.getText();
 * const wordCount = agent.getWordCount();
 * const variables = agent.getVariables();
 *
 * // Write operations (returns new agent)
 * const newAgent = agent
 *   .insertText({ paragraphIndex: 0, offset: 0 }, 'Hello ', { formatting: { bold: true } })
 *   .applyStyle({ paragraphIndex: 0, offset: 0 }, { paragraphIndex: 0, offset: 5 }, 'Heading1');
 *
 * // Export
 * const newBuffer = await newAgent.toBuffer();
 * ```
 */
export class DocumentAgent {
  private _document: Document;
  private _pendingVariables: Record<string, string>;

  /**
   * Create a new DocumentAgent
   *
   * @param source - Document object or ArrayBuffer to parse
   */
  constructor(source: Document | ArrayBuffer) {
    if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
      // Will be loaded asynchronously - store buffer for now
      this._document = {
        package: {
          document: { content: [] },
        },
        originalBuffer: source instanceof ArrayBuffer ? source : source.buffer as ArrayBuffer,
      };
    } else {
      this._document = source;
    }
    this._pendingVariables = {};
  }

  /**
   * Create a DocumentAgent from an ArrayBuffer (async)
   *
   * @param buffer - DOCX file as ArrayBuffer
   * @returns Promise resolving to DocumentAgent
   */
  static async fromBuffer(buffer: ArrayBuffer): Promise<DocumentAgent> {
    const document = await parseDocx(buffer);
    return new DocumentAgent(document);
  }

  /**
   * Create a DocumentAgent from a Document object
   *
   * @param document - Parsed Document
   * @returns DocumentAgent
   */
  static fromDocument(document: Document): DocumentAgent {
    return new DocumentAgent(document);
  }

  // ==========================================================================
  // READING METHODS
  // ==========================================================================

  /**
   * Get the underlying document
   */
  getDocument(): Document {
    return this._document;
  }

  /**
   * Get plain text content of the document
   *
   * @returns All document text concatenated
   */
  getText(): string {
    const body = this._document.package.document;
    return this._getBodyText(body);
  }

  /**
   * Get formatted text segments
   *
   * @returns Array of text segments with formatting info
   */
  getFormattedText(): FormattedTextSegment[] {
    const segments: FormattedTextSegment[] = [];
    const body = this._document.package.document;

    for (const block of body.content) {
      if (block.type === 'paragraph') {
        this._extractParagraphSegments(block, segments);
      }
    }

    return segments;
  }

  /**
   * Get detected template variables
   *
   * @returns Array of variable names (without braces)
   */
  getVariables(): string[] {
    return detectVariables(this._document);
  }

  /**
   * Get available styles from the document
   *
   * @returns Array of style info
   */
  getStyles(): StyleInfo[] {
    const styleDefinitions = this._document.package.styles;
    if (!styleDefinitions?.styles) {
      return [];
    }

    const styleInfos: StyleInfo[] = [];

    for (const [styleId, style] of Object.entries(styleDefinitions.styles)) {
      if (typeof style === 'object' && style !== null) {
        const styleObj = style as Style;
        styleInfos.push({
          id: styleId,
          name: styleObj.name || styleId,
          type: styleObj.type === 'numbering' ? 'paragraph' : styleObj.type || 'paragraph',
          builtIn: styleObj.builtIn,
        });
      }
    }

    return styleInfos;
  }

  /**
   * Get approximate page count
   *
   * Note: This is an estimate based on content length.
   * Actual page count requires full layout computation.
   *
   * @returns Estimated page count
   */
  getPageCount(): number {
    // Estimate: ~500 words per page
    const wordCount = this.getWordCount();
    return Math.max(1, Math.ceil(wordCount / 500));
  }

  /**
   * Get word count
   *
   * @returns Number of words in the document
   */
  getWordCount(): number {
    const text = this.getText();
    // Split by whitespace and filter empty strings
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    return words.length;
  }

  /**
   * Get character count
   *
   * @param includeSpaces - Whether to include whitespace
   * @returns Number of characters
   */
  getCharacterCount(includeSpaces = true): number {
    const text = this.getText();
    if (includeSpaces) {
      return text.length;
    }
    return text.replace(/\s/g, '').length;
  }

  /**
   * Get paragraph count
   *
   * @returns Number of paragraphs
   */
  getParagraphCount(): number {
    return this._document.package.document.content.filter(
      (block) => block.type === 'paragraph'
    ).length;
  }

  /**
   * Get table count
   *
   * @returns Number of tables
   */
  getTableCount(): number {
    return this._document.package.document.content.filter(
      (block) => block.type === 'table'
    ).length;
  }

  /**
   * Get document context for AI agents
   *
   * @param outlineMaxChars - Max characters per paragraph in outline
   * @returns Agent context
   */
  getAgentContext(outlineMaxChars = 100): AgentContext {
    const body = this._document.package.document;
    const paragraphs = body.content.filter((b): b is Paragraph => b.type === 'paragraph');

    const outline: ParagraphOutline[] = paragraphs.map((para, index) => {
      const text = this._getParagraphText(para);
      const styleId = para.formatting?.styleId;

      return {
        index,
        preview: text.slice(0, outlineMaxChars),
        style: styleId,
        isHeading: styleId?.toLowerCase().includes('heading') || false,
        headingLevel: this._parseHeadingLevel(styleId),
        isListItem: !!para.listRendering?.isListItem,
        isEmpty: text.trim().length === 0,
      };
    });

    const sections: SectionInfo[] = (body.sections || []).map((section, index) => ({
      index,
      paragraphCount: section.content?.length || 0,
      pageSize: section.properties?.pageSize
        ? {
            width: section.properties.pageSize.width,
            height: section.properties.pageSize.height,
          }
        : undefined,
      isLandscape: section.properties?.pageSize?.orientation === 'landscape',
      hasHeader: !!section.properties?.headerRefs?.length,
      hasFooter: !!section.properties?.footerRefs?.length,
    }));

    return {
      paragraphCount: paragraphs.length,
      wordCount: this.getWordCount(),
      characterCount: this.getCharacterCount(),
      variables: this.getVariables(),
      variableCount: this.getVariables().length,
      availableStyles: this.getStyles(),
      outline,
      sections,
      hasTables: this.getTableCount() > 0,
      hasImages: this._hasImages(),
      hasHyperlinks: this._hasHyperlinks(),
    };
  }

  // ==========================================================================
  // WRITING METHODS
  // ==========================================================================

  /**
   * Insert text at a position
   *
   * @param position - Where to insert
   * @param text - Text to insert
   * @param options - Insert options
   * @returns New DocumentAgent with text inserted
   */
  insertText(position: Position, text: string, options: InsertTextOptions = {}): DocumentAgent {
    const command: AgentCommand = {
      type: 'insertText',
      position,
      text,
      formatting: options.formatting,
    };
    return this._executeCommand(command);
  }

  /**
   * Replace text in a range
   *
   * @param range - Range to replace
   * @param text - Replacement text
   * @param options - Replace options
   * @returns New DocumentAgent with text replaced
   */
  replaceRange(range: Range, text: string, options: InsertTextOptions = {}): DocumentAgent {
    const command: AgentCommand = {
      type: 'replaceText',
      range,
      text,
      formatting: options.formatting,
    };
    return this._executeCommand(command);
  }

  /**
   * Delete text in a range
   *
   * @param range - Range to delete
   * @returns New DocumentAgent with text deleted
   */
  deleteRange(range: Range): DocumentAgent {
    const command: AgentCommand = {
      type: 'deleteText',
      range,
    };
    return this._executeCommand(command);
  }

  /**
   * Apply text formatting to a range
   *
   * @param range - Range to format
   * @param formatting - Formatting to apply
   * @returns New DocumentAgent with formatting applied
   */
  applyFormatting(range: Range, formatting: Partial<TextFormatting>): DocumentAgent {
    const command: AgentCommand = {
      type: 'formatText',
      range,
      formatting,
    };
    return this._executeCommand(command);
  }

  /**
   * Apply a named style to a paragraph
   *
   * @param paragraphIndex - Index of the paragraph
   * @param styleId - Style ID to apply
   * @returns New DocumentAgent with style applied
   */
  applyStyle(paragraphIndex: number, styleId: string): DocumentAgent {
    const command: AgentCommand = {
      type: 'applyStyle',
      paragraphIndex,
      styleId,
    };
    return this._executeCommand(command);
  }

  /**
   * Apply paragraph formatting
   *
   * @param paragraphIndex - Index of the paragraph
   * @param formatting - Formatting to apply
   * @returns New DocumentAgent with formatting applied
   */
  applyParagraphFormatting(
    paragraphIndex: number,
    formatting: Partial<ParagraphFormatting>
  ): DocumentAgent {
    const command: AgentCommand = {
      type: 'formatParagraph',
      paragraphIndex,
      formatting,
    };
    return this._executeCommand(command);
  }

  // ==========================================================================
  // COMPLEX OPERATIONS
  // ==========================================================================

  /**
   * Insert a table at a position
   *
   * @param position - Where to insert the table
   * @param rows - Number of rows
   * @param cols - Number of columns
   * @param options - Table options
   * @returns New DocumentAgent with table inserted
   */
  insertTable(
    position: Position,
    rows: number,
    cols: number,
    options: InsertTableOptions = {}
  ): DocumentAgent {
    const command: AgentCommand = {
      type: 'insertTable',
      position,
      rows,
      columns: cols,
      data: options.data,
      hasHeader: options.hasHeader,
    };
    return this._executeCommand(command);
  }

  /**
   * Insert an image at a position
   *
   * @param position - Where to insert the image
   * @param src - Image source (base64 data URL or URL)
   * @param options - Image options
   * @returns New DocumentAgent with image inserted
   */
  insertImage(position: Position, src: string, options: InsertImageOptions = {}): DocumentAgent {
    const command: AgentCommand = {
      type: 'insertImage',
      position,
      src,
      width: options.width,
      height: options.height,
      alt: options.alt,
    };
    return this._executeCommand(command);
  }

  /**
   * Insert a hyperlink
   *
   * @param range - Range to make into a hyperlink
   * @param url - URL of the hyperlink
   * @param options - Hyperlink options
   * @returns New DocumentAgent with hyperlink inserted
   */
  insertHyperlink(range: Range, url: string, options: InsertHyperlinkOptions = {}): DocumentAgent {
    const command: AgentCommand = {
      type: 'insertHyperlink',
      range,
      url,
      displayText: options.displayText,
      tooltip: options.tooltip,
    };
    return this._executeCommand(command);
  }

  /**
   * Remove a hyperlink but keep the text
   *
   * @param range - Range containing the hyperlink
   * @returns New DocumentAgent with hyperlink removed
   */
  removeHyperlink(range: Range): DocumentAgent {
    const command: AgentCommand = {
      type: 'removeHyperlink',
      range,
    };
    return this._executeCommand(command);
  }

  /**
   * Insert a paragraph break
   *
   * @param position - Where to break the paragraph
   * @returns New DocumentAgent with paragraph broken
   */
  insertParagraphBreak(position: Position): DocumentAgent {
    const command: AgentCommand = {
      type: 'insertParagraphBreak',
      position,
    };
    return this._executeCommand(command);
  }

  /**
   * Merge consecutive paragraphs
   *
   * @param startParagraphIndex - First paragraph index
   * @param count - Number of paragraphs to merge with the first
   * @returns New DocumentAgent with paragraphs merged
   */
  mergeParagraphs(startParagraphIndex: number, count: number): DocumentAgent {
    const command: AgentCommand = {
      type: 'mergeParagraphs',
      paragraphIndex: startParagraphIndex,
      count,
    };
    return this._executeCommand(command);
  }

  // ==========================================================================
  // TEMPLATE VARIABLE METHODS
  // ==========================================================================

  /**
   * Set a template variable value
   *
   * Note: Variables are not applied until `applyVariables()` is called
   *
   * @param name - Variable name (without braces)
   * @param value - Variable value
   * @returns This DocumentAgent (for chaining)
   */
  setVariable(name: string, value: string): DocumentAgent {
    this._pendingVariables[name] = value;
    return this;
  }

  /**
   * Set multiple template variables
   *
   * @param variables - Map of variable names to values
   * @returns This DocumentAgent (for chaining)
   */
  setVariables(variables: Record<string, string>): DocumentAgent {
    for (const [name, value] of Object.entries(variables)) {
      this._pendingVariables[name] = value;
    }
    return this;
  }

  /**
   * Get pending variable values
   *
   * @returns Map of pending variable values
   */
  getPendingVariables(): Record<string, string> {
    return { ...this._pendingVariables };
  }

  /**
   * Clear pending variables
   *
   * @returns This DocumentAgent (for chaining)
   */
  clearPendingVariables(): DocumentAgent {
    this._pendingVariables = {};
    return this;
  }

  /**
   * Apply all pending template variables
   *
   * Uses docxtemplater to substitute variables while preserving formatting.
   *
   * @param variables - Optional additional variables (merged with pending)
   * @returns New DocumentAgent with variables applied
   */
  async applyVariables(variables?: Record<string, string>): Promise<DocumentAgent> {
    const allVariables = { ...this._pendingVariables, ...variables };

    if (Object.keys(allVariables).length === 0) {
      // No variables to apply
      return this;
    }

    // Get the original buffer
    const buffer = this._document.originalBuffer;
    if (!buffer) {
      throw new Error('Cannot apply variables: no original buffer for processing');
    }

    // Process template using docxtemplater
    const processedBuffer = processTemplate(buffer, allVariables);

    // Parse the processed document
    const processedDoc = await parseDocx(processedBuffer);

    // Create new agent with processed document
    const newAgent = new DocumentAgent(processedDoc);
    newAgent._pendingVariables = {};

    return newAgent;
  }

  // ==========================================================================
  // EXPORT METHODS
  // ==========================================================================

  /**
   * Export document to DOCX ArrayBuffer
   *
   * @returns Promise resolving to DOCX file as ArrayBuffer
   */
  async toBuffer(): Promise<ArrayBuffer> {
    return repackDocx(this._document);
  }

  /**
   * Export document to Blob
   *
   * @param mimeType - MIME type for the blob
   * @returns Promise resolving to DOCX file as Blob
   */
  async toBlob(
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ): Promise<Blob> {
    const buffer = await this.toBuffer();
    return new Blob([buffer], { type: mimeType });
  }

  /**
   * Execute multiple commands in sequence
   *
   * @param commands - Commands to execute
   * @returns New DocumentAgent with all commands applied
   */
  executeCommands(commands: AgentCommand[]): DocumentAgent {
    const newDoc = executeCommands(this._document, commands);
    return new DocumentAgent(newDoc);
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Execute a single command and return new agent
   */
  private _executeCommand(command: AgentCommand): DocumentAgent {
    const newDoc = executeCommand(this._document, command);
    const newAgent = new DocumentAgent(newDoc);
    newAgent._pendingVariables = { ...this._pendingVariables };
    return newAgent;
  }

  /**
   * Get plain text from document body
   */
  private _getBodyText(body: DocumentBody): string {
    const texts: string[] = [];

    for (const block of body.content) {
      if (block.type === 'paragraph') {
        texts.push(this._getParagraphText(block));
      } else if (block.type === 'table') {
        texts.push(this._getTableText(block));
      }
    }

    return texts.join('\n');
  }

  /**
   * Get plain text from a paragraph
   */
  private _getParagraphText(paragraph: Paragraph): string {
    const texts: string[] = [];

    for (const item of paragraph.content) {
      if (item.type === 'run') {
        texts.push(this._getRunText(item));
      } else if (item.type === 'hyperlink') {
        texts.push(this._getHyperlinkText(item));
      }
    }

    return texts.join('');
  }

  /**
   * Get plain text from a run
   */
  private _getRunText(run: Run): string {
    return run.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('');
  }

  /**
   * Get plain text from a hyperlink
   */
  private _getHyperlinkText(hyperlink: Hyperlink): string {
    const texts: string[] = [];
    for (const child of hyperlink.children) {
      if (child.type === 'run') {
        texts.push(this._getRunText(child));
      }
    }
    return texts.join('');
  }

  /**
   * Get plain text from a table
   */
  private _getTableText(table: Table): string {
    const texts: string[] = [];

    for (const row of table.rows) {
      for (const cell of row.cells) {
        for (const block of cell.content) {
          if (block.type === 'paragraph') {
            texts.push(this._getParagraphText(block));
          }
        }
      }
    }

    return texts.join('\t');
  }

  /**
   * Extract formatted text segments from a paragraph
   */
  private _extractParagraphSegments(
    paragraph: Paragraph,
    segments: FormattedTextSegment[]
  ): void {
    for (const item of paragraph.content) {
      if (item.type === 'run') {
        const text = this._getRunText(item);
        if (text) {
          segments.push({
            text,
            formatting: item.formatting,
          });
        }
      } else if (item.type === 'hyperlink') {
        const url = item.href || '';
        for (const child of item.children) {
          if (child.type === 'run') {
            const text = this._getRunText(child);
            if (text) {
              segments.push({
                text,
                formatting: child.formatting,
                isHyperlink: true,
                hyperlinkUrl: url,
              });
            }
          }
        }
      }
    }
  }

  /**
   * Parse heading level from style ID
   */
  private _parseHeadingLevel(styleId?: string): number | undefined {
    if (!styleId) return undefined;
    const match = styleId.match(/heading\s*(\d)/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    return undefined;
  }

  /**
   * Check if document has images
   */
  private _hasImages(): boolean {
    const body = this._document.package.document;

    for (const block of body.content) {
      if (block.type === 'paragraph') {
        for (const item of block.content) {
          if (item.type === 'run') {
            for (const content of item.content) {
              if (content.type === 'drawing') {
                return true;
              }
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Check if document has hyperlinks
   */
  private _hasHyperlinks(): boolean {
    const body = this._document.package.document;

    for (const block of body.content) {
      if (block.type === 'paragraph') {
        for (const item of block.content) {
          if (item.type === 'hyperlink') {
            return true;
          }
        }
      }
    }

    return false;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a DocumentAgent from a DOCX buffer
 *
 * @param buffer - DOCX file as ArrayBuffer
 * @returns Promise resolving to DocumentAgent
 */
export async function createAgent(buffer: ArrayBuffer): Promise<DocumentAgent> {
  return DocumentAgent.fromBuffer(buffer);
}

/**
 * Create a DocumentAgent from a parsed Document
 *
 * @param document - Parsed Document
 * @returns DocumentAgent
 */
export function createAgentFromDocument(document: Document): DocumentAgent {
  return DocumentAgent.fromDocument(document);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default DocumentAgent;
