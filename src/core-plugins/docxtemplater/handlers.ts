/**
 * Docxtemplater Plugin Command Handlers
 *
 * Handles template-related commands for DocumentAgent.
 */

import type { Document, Paragraph, Run, TextContent } from '../../types/document';
import type { PluginCommand } from '../types';

// ============================================================================
// COMMAND TYPES
// ============================================================================

/**
 * Insert a template variable at a position
 */
export interface InsertTemplateVariableCommand extends PluginCommand {
  type: 'insertTemplateVariable';
  position: {
    paragraphIndex: number;
    offset: number;
  };
  variableName: string;
}

/**
 * Replace text with a template variable
 */
export interface ReplaceWithTemplateVariableCommand extends PluginCommand {
  type: 'replaceWithTemplateVariable';
  range: {
    start: { paragraphIndex: number; offset: number };
    end: { paragraphIndex: number; offset: number };
  };
  variableName: string;
}

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * Handle insertTemplateVariable command
 *
 * Inserts {{variableName}} at the specified position.
 */
export function handleInsertTemplateVariable(doc: Document, command: PluginCommand): Document {
  const cmd = command as InsertTemplateVariableCommand;
  const { position, variableName } = cmd;

  // Clone document for immutability
  const newDoc: Document = JSON.parse(JSON.stringify(doc));
  const body = newDoc.package.document;

  // Find the paragraph
  const paragraphs = body.content.filter((block): block is Paragraph => block.type === 'paragraph');

  if (position.paragraphIndex >= paragraphs.length) {
    throw new Error(`Paragraph index ${position.paragraphIndex} out of bounds`);
  }

  const paragraph = paragraphs[position.paragraphIndex];

  // Create the variable text
  const variableText = `{{${variableName}}}`;

  // Insert the variable at the offset
  insertTextAtOffset(paragraph, position.offset, variableText);

  // Track the variable in document metadata
  if (!newDoc.templateVariables) {
    newDoc.templateVariables = [];
  }
  if (!newDoc.templateVariables.includes(variableName)) {
    newDoc.templateVariables.push(variableName);
  }

  return newDoc;
}

/**
 * Handle replaceWithTemplateVariable command
 *
 * Replaces the text in the range with {{variableName}}.
 */
export function handleReplaceWithTemplateVariable(doc: Document, command: PluginCommand): Document {
  const cmd = command as ReplaceWithTemplateVariableCommand;
  const { range, variableName } = cmd;

  // Clone document for immutability
  const newDoc: Document = JSON.parse(JSON.stringify(doc));
  const body = newDoc.package.document;

  // Find the paragraphs
  const paragraphs = body.content.filter((block): block is Paragraph => block.type === 'paragraph');

  if (range.start.paragraphIndex !== range.end.paragraphIndex) {
    throw new Error('Template variable replacement cannot span multiple paragraphs');
  }

  if (range.start.paragraphIndex >= paragraphs.length) {
    throw new Error(`Paragraph index ${range.start.paragraphIndex} out of bounds`);
  }

  const paragraph = paragraphs[range.start.paragraphIndex];

  // Delete the range first
  deleteTextInRange(paragraph, range.start.offset, range.end.offset);

  // Insert the variable at the start position
  const variableText = `{{${variableName}}}`;
  insertTextAtOffset(paragraph, range.start.offset, variableText);

  // Track the variable
  if (!newDoc.templateVariables) {
    newDoc.templateVariables = [];
  }
  if (!newDoc.templateVariables.includes(variableName)) {
    newDoc.templateVariables.push(variableName);
  }

  return newDoc;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Insert text at a specific offset in a paragraph
 */
function insertTextAtOffset(paragraph: Paragraph, offset: number, text: string): void {
  let currentOffset = 0;
  let inserted = false;

  for (let i = 0; i < paragraph.content.length; i++) {
    const item = paragraph.content[i];

    if (item.type === 'run') {
      const runText = getRunText(item);
      const runStart = currentOffset;
      const runEnd = currentOffset + runText.length;

      if (!inserted && offset >= runStart && offset <= runEnd) {
        const insertPos = offset - runStart;

        // Split the run at the insertion point
        const beforeText = runText.slice(0, insertPos);
        const afterText = runText.slice(insertPos);

        const newContent: Paragraph['content'] = [];

        // Add items before this run
        for (let j = 0; j < i; j++) {
          newContent.push(paragraph.content[j]);
        }

        // Add text before insertion point (if any)
        if (beforeText) {
          newContent.push({
            type: 'run',
            formatting: item.formatting,
            content: [{ type: 'text', text: beforeText }],
          });
        }

        // Add the new text
        newContent.push({
          type: 'run',
          formatting: item.formatting,
          content: [{ type: 'text', text }],
        });

        // Add text after insertion point (if any)
        if (afterText) {
          newContent.push({
            type: 'run',
            formatting: item.formatting,
            content: [{ type: 'text', text: afterText }],
          });
        }

        // Add remaining items
        for (let j = i + 1; j < paragraph.content.length; j++) {
          newContent.push(paragraph.content[j]);
        }

        paragraph.content = newContent;
        inserted = true;
        break;
      }

      currentOffset = runEnd;
    } else if (item.type === 'hyperlink') {
      // Handle hyperlink text
      for (const child of item.children) {
        if (child.type === 'run') {
          currentOffset += getRunText(child).length;
        }
      }
    }
  }

  // If not inserted (empty paragraph or offset at end), append
  if (!inserted) {
    paragraph.content.push({
      type: 'run',
      content: [{ type: 'text', text }],
    });
  }
}

/**
 * Delete text in a range within a paragraph
 */
function deleteTextInRange(paragraph: Paragraph, startOffset: number, endOffset: number): void {
  const newContent: Paragraph['content'] = [];
  let currentOffset = 0;

  for (const item of paragraph.content) {
    if (item.type === 'run') {
      const runText = getRunText(item);
      const runStart = currentOffset;
      const runEnd = currentOffset + runText.length;

      // Check overlap with deletion range
      if (runEnd <= startOffset || runStart >= endOffset) {
        // No overlap, keep entire run
        newContent.push(item);
      } else {
        // Partial overlap
        let newText = '';

        if (runStart < startOffset) {
          // Keep text before start
          newText += runText.slice(0, startOffset - runStart);
        }

        if (runEnd > endOffset) {
          // Keep text after end
          newText += runText.slice(endOffset - runStart);
        }

        if (newText.length > 0) {
          newContent.push({
            type: 'run',
            formatting: item.formatting,
            content: [{ type: 'text', text: newText }],
          });
        }
      }

      currentOffset = runEnd;
    } else {
      newContent.push(item);
    }
  }

  paragraph.content = newContent;
}

/**
 * Get plain text from a run
 */
function getRunText(run: Run): string {
  return run.content
    .filter((c): c is TextContent => c.type === 'text')
    .map((c) => c.text)
    .join('');
}
