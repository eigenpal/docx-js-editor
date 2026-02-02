/**
 * Command Executor
 *
 * Executes agent commands on a document immutably:
 * - Handles all command types from AgentCommand
 * - Preserves surrounding formatting
 * - Returns new document (immutable updates)
 */

import type {
  Document,
  DocumentBody,
  Paragraph,
  Run,
  TextContent,
  ParagraphContent,
  BlockContent,
  Table,
  TableRow,
  TableCell,
  TextFormatting,
  Image,
  Hyperlink,
} from '../types/document';

import type {
  AgentCommand,
  InsertTextCommand,
  ReplaceTextCommand,
  DeleteTextCommand,
  FormatTextCommand,
  FormatParagraphCommand,
  ApplyStyleCommand,
  InsertTableCommand,
  InsertImageCommand,
  InsertHyperlinkCommand,
  RemoveHyperlinkCommand,
  InsertParagraphBreakCommand,
  MergeParagraphsCommand,
  SplitParagraphCommand,
  SetVariableCommand,
  ApplyVariablesCommand,
} from '../types/agentApi';

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

/**
 * Execute an agent command on a document
 * Returns a new document with the command applied (immutable)
 *
 * @param doc - The document to modify
 * @param command - The command to execute
 * @returns New document with command applied
 */
export function executeCommand(doc: Document, command: AgentCommand): Document {
  switch (command.type) {
    case 'insertText':
      return executeInsertText(doc, command);
    case 'replaceText':
      return executeReplaceText(doc, command);
    case 'deleteText':
      return executeDeleteText(doc, command);
    case 'formatText':
      return executeFormatText(doc, command);
    case 'formatParagraph':
      return executeFormatParagraph(doc, command);
    case 'applyStyle':
      return executeApplyStyle(doc, command);
    case 'insertTable':
      return executeInsertTable(doc, command);
    case 'insertImage':
      return executeInsertImage(doc, command);
    case 'insertHyperlink':
      return executeInsertHyperlink(doc, command);
    case 'removeHyperlink':
      return executeRemoveHyperlink(doc, command);
    case 'insertParagraphBreak':
      return executeInsertParagraphBreak(doc, command);
    case 'mergeParagraphs':
      return executeMergeParagraphs(doc, command);
    case 'splitParagraph':
      return executeSplitParagraph(doc, command);
    case 'setVariable':
      return executeSetVariable(doc, command);
    case 'applyVariables':
      return executeApplyVariables(doc, command);
    default:
      // Exhaustive check - should never happen with proper types
      const _exhaustive: never = command;
      throw new Error(`Unknown command type: ${(_exhaustive as AgentCommand).type}`);
  }
}

/**
 * Execute multiple commands in sequence
 *
 * @param doc - The document to modify
 * @param commands - Commands to execute in order
 * @returns New document with all commands applied
 */
export function executeCommands(doc: Document, commands: AgentCommand[]): Document {
  return commands.reduce((currentDoc, command) => executeCommand(currentDoc, command), doc);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Deep clone a document for immutable updates
 */
function cloneDocument(doc: Document): Document {
  return JSON.parse(JSON.stringify(doc));
}

/**
 * Get the block index for a paragraph index
 */
function getBlockIndexForParagraph(body: DocumentBody, paragraphIndex: number): number {
  let currentParagraphIndex = 0;
  for (let i = 0; i < body.content.length; i++) {
    if (body.content[i].type === 'paragraph') {
      if (currentParagraphIndex === paragraphIndex) {
        return i;
      }
      currentParagraphIndex++;
    }
  }
  return -1;
}

/**
 * Get plain text from a paragraph
 */
function getParagraphText(paragraph: Paragraph): string {
  let text = '';
  for (const item of paragraph.content) {
    if (item.type === 'run') {
      for (const content of item.content) {
        if (content.type === 'text') {
          text += content.text;
        }
      }
    } else if (item.type === 'hyperlink') {
      for (const child of item.children) {
        if (child.type === 'run') {
          for (const content of child.content) {
            if (content.type === 'text') {
              text += content.text;
            }
          }
        }
      }
    }
  }
  return text;
}

/**
 * Create a new run with text
 */
function createTextRun(text: string, formatting?: TextFormatting): Run {
  return {
    type: 'run',
    formatting,
    content: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

/**
 * Insert text at a specific offset within a paragraph
 * Returns new paragraph content
 */
function insertTextAtOffset(
  paragraph: Paragraph,
  offset: number,
  text: string,
  formatting?: TextFormatting
): ParagraphContent[] {
  const newContent: ParagraphContent[] = [];
  let currentOffset = 0;
  let inserted = false;

  for (const item of paragraph.content) {
    if (item.type === 'run') {
      const runText = item.content
        .filter((c): c is TextContent => c.type === 'text')
        .map((c) => c.text)
        .join('');

      const runStart = currentOffset;
      const runEnd = currentOffset + runText.length;

      if (!inserted && offset >= runStart && offset <= runEnd) {
        // Insert within this run
        const insertPos = offset - runStart;

        if (insertPos > 0) {
          // Text before insertion point
          newContent.push({
            ...item,
            content: [{ type: 'text', text: runText.slice(0, insertPos) }],
          });
        }

        // New text
        newContent.push(createTextRun(text, formatting || item.formatting));

        if (insertPos < runText.length) {
          // Text after insertion point
          newContent.push({
            ...item,
            content: [{ type: 'text', text: runText.slice(insertPos) }],
          });
        }

        inserted = true;
      } else {
        newContent.push(item);
      }

      currentOffset = runEnd;
    } else {
      newContent.push(item);
    }
  }

  // If not inserted yet, append at the end
  if (!inserted) {
    newContent.push(createTextRun(text, formatting));
  }

  return newContent;
}

/**
 * Delete text in a range within a single paragraph
 */
function deleteTextInParagraph(
  paragraph: Paragraph,
  startOffset: number,
  endOffset: number
): ParagraphContent[] {
  const newContent: ParagraphContent[] = [];
  let currentOffset = 0;

  for (const item of paragraph.content) {
    if (item.type === 'run') {
      const runText = item.content
        .filter((c): c is TextContent => c.type === 'text')
        .map((c) => c.text)
        .join('');

      const runStart = currentOffset;
      const runEnd = currentOffset + runText.length;

      // Check if run overlaps with deletion range
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
            ...item,
            content: [{ type: 'text', text: newText }],
          });
        }
      }

      currentOffset = runEnd;
    } else {
      newContent.push(item);
    }
  }

  return newContent;
}

/**
 * Apply formatting to text in a range within a paragraph
 */
function applyFormattingInParagraph(
  paragraph: Paragraph,
  startOffset: number,
  endOffset: number,
  formatting: Partial<TextFormatting>
): ParagraphContent[] {
  const newContent: ParagraphContent[] = [];
  let currentOffset = 0;

  for (const item of paragraph.content) {
    if (item.type === 'run') {
      const runText = item.content
        .filter((c): c is TextContent => c.type === 'text')
        .map((c) => c.text)
        .join('');

      const runStart = currentOffset;
      const runEnd = currentOffset + runText.length;

      // Check if run overlaps with formatting range
      if (runEnd <= startOffset || runStart >= endOffset) {
        // No overlap, keep entire run unchanged
        newContent.push(item);
      } else if (runStart >= startOffset && runEnd <= endOffset) {
        // Entire run is within range, apply formatting
        newContent.push({
          ...item,
          formatting: { ...item.formatting, ...formatting },
        });
      } else {
        // Partial overlap - need to split run
        const overlapStart = Math.max(startOffset, runStart);
        const overlapEnd = Math.min(endOffset, runEnd);

        // Text before overlap
        if (runStart < overlapStart) {
          newContent.push({
            ...item,
            content: [{ type: 'text', text: runText.slice(0, overlapStart - runStart) }],
          });
        }

        // Overlapping text with formatting
        newContent.push({
          ...item,
          formatting: { ...item.formatting, ...formatting },
          content: [
            {
              type: 'text',
              text: runText.slice(overlapStart - runStart, overlapEnd - runStart),
            },
          ],
        });

        // Text after overlap
        if (runEnd > overlapEnd) {
          newContent.push({
            ...item,
            content: [{ type: 'text', text: runText.slice(overlapEnd - runStart) }],
          });
        }
      }

      currentOffset = runEnd;
    } else {
      newContent.push(item);
    }
  }

  return newContent;
}

// ============================================================================
// COMMAND IMPLEMENTATIONS
// ============================================================================

/**
 * Insert text at a position
 */
function executeInsertText(doc: Document, command: InsertTextCommand): Document {
  const newDoc = cloneDocument(doc);
  const body = newDoc.package.document;
  const blockIndex = getBlockIndexForParagraph(body, command.position.paragraphIndex);

  if (blockIndex === -1) {
    throw new Error(`Paragraph index ${command.position.paragraphIndex} not found`);
  }

  const paragraph = body.content[blockIndex] as Paragraph;
  paragraph.content = insertTextAtOffset(
    paragraph,
    command.position.offset,
    command.text,
    command.formatting
  );

  return newDoc;
}

/**
 * Replace text in a range
 */
function executeReplaceText(doc: Document, command: ReplaceTextCommand): Document {
  const newDoc = cloneDocument(doc);
  const body = newDoc.package.document;

  const { start, end } = command.range;

  if (start.paragraphIndex === end.paragraphIndex) {
    // Same paragraph
    const blockIndex = getBlockIndexForParagraph(body, start.paragraphIndex);
    if (blockIndex === -1) {
      throw new Error(`Paragraph index ${start.paragraphIndex} not found`);
    }

    const paragraph = body.content[blockIndex] as Paragraph;

    // Delete the range first
    paragraph.content = deleteTextInParagraph(paragraph, start.offset, end.offset);

    // Then insert the new text
    paragraph.content = insertTextAtOffset(
      paragraph,
      start.offset,
      command.text,
      command.formatting
    );
  } else {
    // Multiple paragraphs - simplify by deleting and inserting
    // Delete from start to end of first paragraph
    const startBlockIndex = getBlockIndexForParagraph(body, start.paragraphIndex);
    const startParagraph = body.content[startBlockIndex] as Paragraph;
    const startText = getParagraphText(startParagraph);

    startParagraph.content = deleteTextInParagraph(startParagraph, start.offset, startText.length);
    startParagraph.content = insertTextAtOffset(
      startParagraph,
      start.offset,
      command.text,
      command.formatting
    );

    // Delete intermediate paragraphs and beginning of last paragraph
    const paragraphsToRemove: number[] = [];
    for (let i = start.paragraphIndex + 1; i <= end.paragraphIndex; i++) {
      paragraphsToRemove.push(getBlockIndexForParagraph(body, i));
    }

    // Remove in reverse order to preserve indices
    for (let i = paragraphsToRemove.length - 1; i >= 0; i--) {
      if (paragraphsToRemove[i] !== -1) {
        body.content.splice(paragraphsToRemove[i], 1);
      }
    }
  }

  return newDoc;
}

/**
 * Delete text in a range
 */
function executeDeleteText(doc: Document, command: DeleteTextCommand): Document {
  const newDoc = cloneDocument(doc);
  const body = newDoc.package.document;

  const { start, end } = command.range;

  if (start.paragraphIndex === end.paragraphIndex) {
    // Same paragraph
    const blockIndex = getBlockIndexForParagraph(body, start.paragraphIndex);
    if (blockIndex === -1) {
      throw new Error(`Paragraph index ${start.paragraphIndex} not found`);
    }

    const paragraph = body.content[blockIndex] as Paragraph;
    paragraph.content = deleteTextInParagraph(paragraph, start.offset, end.offset);
  } else {
    // Multiple paragraphs
    // Truncate first paragraph
    const startBlockIndex = getBlockIndexForParagraph(body, start.paragraphIndex);
    const startParagraph = body.content[startBlockIndex] as Paragraph;
    const startText = getParagraphText(startParagraph);
    startParagraph.content = deleteTextInParagraph(startParagraph, start.offset, startText.length);

    // Delete intermediate paragraphs and truncate last
    const endBlockIndex = getBlockIndexForParagraph(body, end.paragraphIndex);
    const endParagraph = body.content[endBlockIndex] as Paragraph;
    endParagraph.content = deleteTextInParagraph(endParagraph, 0, end.offset);

    // Merge last paragraph content into first
    startParagraph.content.push(...endParagraph.content);

    // Remove paragraphs between start and end (inclusive of end)
    const indicesToRemove: number[] = [];
    for (let i = start.paragraphIndex + 1; i <= end.paragraphIndex; i++) {
      indicesToRemove.push(getBlockIndexForParagraph(body, i));
    }

    for (let i = indicesToRemove.length - 1; i >= 0; i--) {
      if (indicesToRemove[i] !== -1) {
        body.content.splice(indicesToRemove[i], 1);
      }
    }
  }

  return newDoc;
}

/**
 * Apply formatting to a range
 */
function executeFormatText(doc: Document, command: FormatTextCommand): Document {
  const newDoc = cloneDocument(doc);
  const body = newDoc.package.document;

  const { start, end } = command.range;

  if (start.paragraphIndex === end.paragraphIndex) {
    // Same paragraph
    const blockIndex = getBlockIndexForParagraph(body, start.paragraphIndex);
    if (blockIndex === -1) {
      throw new Error(`Paragraph index ${start.paragraphIndex} not found`);
    }

    const paragraph = body.content[blockIndex] as Paragraph;
    paragraph.content = applyFormattingInParagraph(
      paragraph,
      start.offset,
      end.offset,
      command.formatting
    );
  } else {
    // Multiple paragraphs
    for (let i = start.paragraphIndex; i <= end.paragraphIndex; i++) {
      const blockIndex = getBlockIndexForParagraph(body, i);
      if (blockIndex === -1) continue;

      const paragraph = body.content[blockIndex] as Paragraph;
      const paragraphText = getParagraphText(paragraph);

      let startOffset = 0;
      let endOffset = paragraphText.length;

      if (i === start.paragraphIndex) {
        startOffset = start.offset;
      }
      if (i === end.paragraphIndex) {
        endOffset = end.offset;
      }

      paragraph.content = applyFormattingInParagraph(
        paragraph,
        startOffset,
        endOffset,
        command.formatting
      );
    }
  }

  return newDoc;
}

/**
 * Apply paragraph formatting
 */
function executeFormatParagraph(doc: Document, command: FormatParagraphCommand): Document {
  const newDoc = cloneDocument(doc);
  const body = newDoc.package.document;

  const blockIndex = getBlockIndexForParagraph(body, command.paragraphIndex);
  if (blockIndex === -1) {
    throw new Error(`Paragraph index ${command.paragraphIndex} not found`);
  }

  const paragraph = body.content[blockIndex] as Paragraph;
  paragraph.formatting = { ...paragraph.formatting, ...command.formatting };

  return newDoc;
}

/**
 * Apply a named style to a paragraph
 */
function executeApplyStyle(doc: Document, command: ApplyStyleCommand): Document {
  const newDoc = cloneDocument(doc);
  const body = newDoc.package.document;

  const blockIndex = getBlockIndexForParagraph(body, command.paragraphIndex);
  if (blockIndex === -1) {
    throw new Error(`Paragraph index ${command.paragraphIndex} not found`);
  }

  const paragraph = body.content[blockIndex] as Paragraph;
  paragraph.formatting = {
    ...paragraph.formatting,
    styleId: command.styleId,
  };

  return newDoc;
}

/**
 * Insert a table at a position
 */
function executeInsertTable(doc: Document, command: InsertTableCommand): Document {
  const newDoc = cloneDocument(doc);
  const body = newDoc.package.document;

  // Create table structure
  const rows: TableRow[] = [];

  for (let r = 0; r < command.rows; r++) {
    const cells: TableCell[] = [];

    for (let c = 0; c < command.columns; c++) {
      const cellText = command.data?.[r]?.[c] || '';
      cells.push({
        type: 'tableCell',
        content: [
          {
            type: 'paragraph',
            content: cellText ? [createTextRun(cellText)] : [],
          },
        ],
      });
    }

    rows.push({
      type: 'tableRow',
      formatting: r === 0 && command.hasHeader ? { header: true } : undefined,
      cells,
    });
  }

  const table: Table = {
    type: 'table',
    rows,
  };

  // Insert table after the specified paragraph
  const blockIndex = getBlockIndexForParagraph(body, command.position.paragraphIndex);
  if (blockIndex === -1) {
    body.content.push(table);
  } else {
    body.content.splice(blockIndex + 1, 0, table);
  }

  return newDoc;
}

/**
 * Insert an image at a position
 */
function executeInsertImage(doc: Document, command: InsertImageCommand): Document {
  const newDoc = cloneDocument(doc);
  const body = newDoc.package.document;

  const blockIndex = getBlockIndexForParagraph(body, command.position.paragraphIndex);
  if (blockIndex === -1) {
    throw new Error(`Paragraph index ${command.position.paragraphIndex} not found`);
  }

  const paragraph = body.content[blockIndex] as Paragraph;

  // Create image
  const image: Image = {
    type: 'image',
    rId: `rId_img_${Date.now()}`,
    src: command.src,
    alt: command.alt,
    size: {
      width: (command.width || 100) * 914400, // Convert pixels to EMU
      height: (command.height || 100) * 914400,
    },
    wrap: { type: 'inline' },
  };

  // Create run with drawing content
  const imageRun: Run = {
    type: 'run',
    content: [
      {
        type: 'drawing',
        image,
      },
    ],
  };

  // Insert image run at offset
  const newContent = insertTextAtOffset(paragraph, command.position.offset, '', undefined);
  // Find insertion point and add image
  let inserted = false;
  let currentOffset = 0;

  for (let i = 0; i < newContent.length; i++) {
    const item = newContent[i];
    if (item.type === 'run') {
      const runText = item.content
        .filter((c): c is TextContent => c.type === 'text')
        .map((c) => c.text)
        .join('');
      currentOffset += runText.length;

      if (!inserted && currentOffset >= command.position.offset) {
        newContent.splice(i + 1, 0, imageRun);
        inserted = true;
        break;
      }
    }
  }

  if (!inserted) {
    newContent.push(imageRun);
  }

  paragraph.content = newContent;

  return newDoc;
}

/**
 * Insert a hyperlink at a range
 */
function executeInsertHyperlink(doc: Document, command: InsertHyperlinkCommand): Document {
  const newDoc = cloneDocument(doc);
  const body = newDoc.package.document;

  const { start, end } = command.range;

  if (start.paragraphIndex !== end.paragraphIndex) {
    throw new Error('Hyperlinks cannot span multiple paragraphs');
  }

  const blockIndex = getBlockIndexForParagraph(body, start.paragraphIndex);
  if (blockIndex === -1) {
    throw new Error(`Paragraph index ${start.paragraphIndex} not found`);
  }

  const paragraph = body.content[blockIndex] as Paragraph;
  const paragraphText = getParagraphText(paragraph);

  // Get the text that will become the link
  const linkText = command.displayText || paragraphText.slice(start.offset, end.offset);

  // Delete the original text
  paragraph.content = deleteTextInParagraph(paragraph, start.offset, end.offset);

  // Create hyperlink
  const hyperlink: Hyperlink = {
    type: 'hyperlink',
    href: command.url,
    tooltip: command.tooltip,
    children: [createTextRun(linkText)],
  };

  // Insert hyperlink at position
  let inserted = false;
  let currentOffset = 0;
  const newContent: ParagraphContent[] = [];

  for (const item of paragraph.content) {
    if (item.type === 'run') {
      const runText = item.content
        .filter((c): c is TextContent => c.type === 'text')
        .map((c) => c.text)
        .join('');

      const runEnd = currentOffset + runText.length;

      if (!inserted && currentOffset <= start.offset && start.offset <= runEnd) {
        const insertPos = start.offset - currentOffset;

        if (insertPos > 0) {
          newContent.push({
            ...item,
            content: [{ type: 'text', text: runText.slice(0, insertPos) }],
          });
        }

        newContent.push(hyperlink);

        if (insertPos < runText.length) {
          newContent.push({
            ...item,
            content: [{ type: 'text', text: runText.slice(insertPos) }],
          });
        }

        inserted = true;
      } else {
        newContent.push(item);
      }

      currentOffset = runEnd;
    } else {
      newContent.push(item);
    }
  }

  if (!inserted) {
    newContent.push(hyperlink);
  }

  paragraph.content = newContent;

  return newDoc;
}

/**
 * Remove a hyperlink but keep the text
 */
function executeRemoveHyperlink(doc: Document, command: RemoveHyperlinkCommand): Document {
  const newDoc = cloneDocument(doc);
  const body = newDoc.package.document;

  const { start } = command.range;

  const blockIndex = getBlockIndexForParagraph(body, start.paragraphIndex);
  if (blockIndex === -1) {
    throw new Error(`Paragraph index ${start.paragraphIndex} not found`);
  }

  const paragraph = body.content[blockIndex] as Paragraph;
  const newContent: ParagraphContent[] = [];

  for (const item of paragraph.content) {
    if (item.type === 'hyperlink') {
      // Convert hyperlink children to regular runs
      for (const child of item.children) {
        if (child.type === 'run') {
          newContent.push(child);
        }
      }
    } else {
      newContent.push(item);
    }
  }

  paragraph.content = newContent;

  return newDoc;
}

/**
 * Insert a paragraph break
 */
function executeInsertParagraphBreak(
  doc: Document,
  command: InsertParagraphBreakCommand
): Document {
  const newDoc = cloneDocument(doc);
  const body = newDoc.package.document;

  const blockIndex = getBlockIndexForParagraph(body, command.position.paragraphIndex);
  if (blockIndex === -1) {
    throw new Error(`Paragraph index ${command.position.paragraphIndex} not found`);
  }

  const paragraph = body.content[blockIndex] as Paragraph;
  const paragraphText = getParagraphText(paragraph);

  // Split the paragraph at the offset
  const beforeContent = deleteTextInParagraph(
    { ...paragraph, content: [...paragraph.content] },
    command.position.offset,
    paragraphText.length
  );

  const afterContent = deleteTextInParagraph(
    { ...paragraph, content: [...paragraph.content] },
    0,
    command.position.offset
  );

  // Update current paragraph with content before break
  paragraph.content = beforeContent;

  // Create new paragraph with content after break
  const newParagraph: Paragraph = {
    type: 'paragraph',
    formatting: paragraph.formatting,
    content: afterContent,
  };

  // Insert new paragraph after current one
  body.content.splice(blockIndex + 1, 0, newParagraph);

  return newDoc;
}

/**
 * Merge paragraphs
 */
function executeMergeParagraphs(doc: Document, command: MergeParagraphsCommand): Document {
  const newDoc = cloneDocument(doc);
  const body = newDoc.package.document;

  const startBlockIndex = getBlockIndexForParagraph(body, command.paragraphIndex);
  if (startBlockIndex === -1) {
    throw new Error(`Paragraph index ${command.paragraphIndex} not found`);
  }

  const baseParagraph = body.content[startBlockIndex] as Paragraph;

  // Collect all content from paragraphs to merge
  const indicesToRemove: number[] = [];

  for (let i = 1; i <= command.count; i++) {
    const blockIndex = getBlockIndexForParagraph(body, command.paragraphIndex + i);
    if (blockIndex !== -1) {
      const para = body.content[blockIndex] as Paragraph;
      baseParagraph.content.push(...para.content);
      indicesToRemove.push(blockIndex);
    }
  }

  // Remove merged paragraphs in reverse order
  for (let i = indicesToRemove.length - 1; i >= 0; i--) {
    body.content.splice(indicesToRemove[i], 1);
  }

  return newDoc;
}

/**
 * Split a paragraph at a position
 */
function executeSplitParagraph(doc: Document, command: SplitParagraphCommand): Document {
  // Split is the same as insert paragraph break
  return executeInsertParagraphBreak(doc, {
    type: 'insertParagraphBreak',
    position: command.position,
  });
}

/**
 * Set a template variable value
 */
function executeSetVariable(doc: Document, command: SetVariableCommand): Document {
  const newDoc = cloneDocument(doc);

  // Store variable in document for later application
  if (!newDoc.templateVariables) {
    newDoc.templateVariables = [];
  }

  if (!newDoc.templateVariables.includes(command.name)) {
    newDoc.templateVariables.push(command.name);
  }

  // Note: Actual variable substitution happens in applyVariables
  return newDoc;
}

/**
 * Apply all template variables
 */
function executeApplyVariables(doc: Document, command: ApplyVariablesCommand): Document {
  const newDoc = cloneDocument(doc);
  const body = newDoc.package.document;

  // Replace {{variable}} patterns in all text content
  function replaceVariablesInRun(run: Run): void {
    for (const content of run.content) {
      if (content.type === 'text') {
        for (const [name, value] of Object.entries(command.values)) {
          const pattern = new RegExp(`\\{\\{${name}\\}\\}`, 'g');
          content.text = content.text.replace(pattern, value);
        }
      }
    }
  }

  function replaceVariablesInParagraph(paragraph: Paragraph): void {
    for (const item of paragraph.content) {
      if (item.type === 'run') {
        replaceVariablesInRun(item);
      } else if (item.type === 'hyperlink') {
        for (const child of item.children) {
          if (child.type === 'run') {
            replaceVariablesInRun(child);
          }
        }
      }
    }
  }

  function replaceVariablesInBlock(block: BlockContent): void {
    if (block.type === 'paragraph') {
      replaceVariablesInParagraph(block);
    } else if (block.type === 'table') {
      for (const row of block.rows) {
        for (const cell of row.cells) {
          for (const cellBlock of cell.content) {
            replaceVariablesInBlock(cellBlock);
          }
        }
      }
    }
  }

  for (const block of body.content) {
    replaceVariablesInBlock(block);
  }

  return newDoc;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default executeCommand;
